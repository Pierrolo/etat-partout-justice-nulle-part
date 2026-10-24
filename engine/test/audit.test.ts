/**
 * Regression tests for the findings of docs/ENGINE-AUDIT.md (independent modelling audit, October 2026).
 */
import { describe, expect, it } from 'vitest';
import { compare, simulate, type Household, type ScenarioResult } from '../src/index.ts';
import { evaluate } from '../src/simulate.ts';

const amt = (r: ScenarioResult, id: string) => r.components.find((c) => c.id === id)!.amount;

const family = (child: Household['children'][number]): Household => ({
  adults: [
    {
      age: 40,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: 2800.53, basis: 'brut', status: 'prive' },
    },
    {
      age: 38,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: 1867.02, basis: 'brut', status: 'prive' },
    },
  ],
  marriedOrPacs: true,
  children: [child],
  housing: { status: 'proprietaire' },
  benefits: { nonRecours: false },
});

describe('A1 — AEEH does not imply the CMI « invalidité » (H15)', () => {
  it('AEEH alone: no +6 600 € supplement, ordinary parts today', () => {
    const e = evaluate(family({ age: 8, aeeh: true }));
    expect(amt(e.plan!, 'afu')).toBe((2 * 6600 + 3300) / 12);
    expect(e.baselineCore.tax.foyers[0]!.parts).toBe(2.5);
    const c = compare(family({ age: 8, aeeh: true }));
    expect(c.activeHypotheses.find((h) => h.id === 'H15')!.value).toMatch(/sans CMI/);
  });
  it('AEEH + declared CMI: +550 €/mois in the plan and ½ part more today (art. 195 CGI)', () => {
    const e = evaluate(family({ age: 8, aeeh: true, cmiInvalidite: true }));
    expect(amt(e.plan!, 'afu')).toBe((2 * 6600 + 3300 + 6600) / 12);
    expect(e.baselineCore.tax.foyers[0]!.parts).toBe(3);
  });
  it('cmiInvalidite is ignored without the AEEH flag', () => {
    const e = evaluate(family({ age: 8, cmiInvalidite: true }));
    expect(amt(e.plan!, 'afu')).toBe((2 * 6600 + 3300) / 12);
  });
});

describe('A2 — today’s income tax of CMI holders and of couples aged 65+ (CGI 157 bis, 195)', () => {
  it('adult with the CMI (aah_80): 1,5 part and the 157 bis abattement', () => {
    const h: Household = {
      adults: [
        {
          age: 40,
          activity: 'salarie',
          disability: 'aah_80',
          salary: { amount: 3500, basis: 'brut', status: 'prive' },
        },
      ],
      marriedOrPacs: false,
      children: [],
      housing: { status: 'proprietaire' },
      benefits: { nonRecours: false },
    };
    const fo = evaluate(h, {}, false).baselineCore.tax.foyers[0]!;
    expect(fo.parts).toBe(1.5);
    // RNG ≈ 33 000 € > 28 430 €: no abattement at that income
    expect(fo.ageAbattement).toBe(0);
    const low = evaluate(
      {
        ...h,
        adults: [{ ...h.adults[0], salary: { amount: 1867.02, basis: 'brut', status: 'prive' } }],
      },
      {},
      false,
    ).baselineCore.tax.foyers[0]!;
    expect(low.ageAbattement).toBe(2822);
  });
  it('married couple both aged ≥ 65: the abattement is doubled', () => {
    const r = (age: number) => ({
      age,
      activity: 'retraite' as const,
      disability: 'none' as const,
      pension: { amount: 700, basis: 'brut' as const, startYear: 2015 },
    });
    const h: Household = {
      adults: [r(70), r(68)],
      marriedOrPacs: true,
      children: [],
      housing: { status: 'proprietaire' },
      benefits: { nonRecours: false },
    };
    const fo = evaluate(h, {}, false).baselineCore.tax.foyers[0]!;
    expect(fo.ageAbattement).toBe(2 * 2822);
    const one = evaluate({ ...h, adults: [r(70), r(60)] }, {}, false).baselineCore.tax.foyers[0]!;
    expect(one.ageAbattement).toBe(2822);
  });
});

describe('A3 — 2027: deductible CSG = min(rate, 6,8 points) (CGI 154 quinquies)', () => {
  it('taxable salary of 2027 follows the legal deductibility', () => {
    const gross = 1867.02;
    const h: Household = {
      adults: [
        {
          age: 35,
          activity: 'salarie',
          disability: 'none',
          salary: { amount: gross, basis: 'brut', status: 'prive' },
        },
      ],
      marriedOrPacs: false,
      children: [],
      housing: { status: 'gratuit' },
      benefits: { nonRecours: false },
    };
    const e = evaluate(h, { period: 2027 });
    const s = e.planCore!.flows.sal[0]!;
    const dedPts = (6 * 6.8 + 6.8 + 6.0 + 4.3 + 2.7 + 1.1 + 0) / 12 / 100;
    expect(s.csgDed).toBeCloseTo(dedPts * 0.9825 * gross, 6);
    expect(
      compare(h, { period: 2027 }).activeHypotheses.find((x) => x.id === 'H18')!.tier,
    ).toBe('law');
  });
});

describe('A4 — 2028: pension CSG rate on the RFR 2026, computed without the 10 % abattement', () => {
  it('a retiree just below the reduced-rate threshold today moves to the median rate in 2028', () => {
    const P = 1559.25; // taxable 18 000 €/an: 16 200 € after the 10 % abattement (reduced), 18 000 € without (median)
    const h: Household = {
      adults: [
        {
          age: 64,
          activity: 'retraite',
          disability: 'none',
          pension: { amount: P, basis: 'brut', startYear: 2024 },
        },
      ],
      marriedOrPacs: false,
      children: [],
      housing: { status: 'proprietaire' },
      benefits: { nonRecours: false },
    };
    const y27 = simulate(h, 'plan', { period: 2027 });
    const y28 = simulate(h, 'plan', { period: 2028 });
    expect(amt(y27, 'pension_nette')).toBeCloseTo(P * (1 - 0.043), 2);
    expect(amt(y28, 'pension_nette')).toBeCloseTo(P * (1 - 0.066 - 0.005 - 0.003), 2);
    expect(y28.components.find((c) => c.id === 'pension_nette')!.formula).toMatch(/RFR 2026/);
  });
});
