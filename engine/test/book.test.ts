/**
 * Invariant 4: the plan reproduces the book's own worked figures (research/source-analysis.md §3).
 */
import { describe, expect, it } from 'vitest';
import { CSG_NONE, grossFromNet } from '../src/baseline/salaire.ts';
import { compare, simulate, type Household, type Hypotheses } from '../src/index.ts';

const amount = (r: ReturnType<typeof simulate>, id: string) =>
  r.components.find((c) => c.id === id)!.amount;

const single = (gross: number | null, extra: Partial<Household> = {}): Household => ({
  adults: [
    gross === null
      ? { age: 35, activity: 'inactif', disability: 'none' }
      : {
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
  ...extra,
});

describe('CSG/CRDS gain on pay (workbook « Synthèse Chiffres », sheet CSG-CRDS)', () => {
  // gain = gross × 0,9825 × 9,7 %
  const rows: Array<[string, number, number]> = [
    ['SMIC 2025 (1 801,80 € brut)', 1801.8, 171.72],
    ['SMIC 01/2026 (1 823 € brut)', 1823, 173.74],
    ['SMIC 06/2026 (1 867 € brut)', 1867, 177.93],
    ['brut moyen 3 602 €', 3602, 343.28],
  ];
  for (const [label, gross, gain] of rows) {
    it(`${label} → +${gain} €/mois`, () => {
      const c = compare(single(gross));
      const step = c.waterfall.find((w) => w.id === 'salaire_net')!;
      expect(Math.abs(step.delta - gain)).toBeLessThan(0.005);
    });
  }
});

describe('GraphIR table — flat tax 23 % + AFU, single adult, H2 off (the authors’ reading)', () => {
  const hyp: Partial<Hypotheses> = { H2_fraisPro10: false, includeTva: false };
  const table: Array<[number, number, number]> = [
    // taxable income/yr, tax (negative = paid), disposable after tax/yr
    [0, 0, 6600],
    [8000, -1840, 12760],
    [21000, -4830, 22770],
    [34000, -7820, 32780],
    [48000, -11040, 43560],
  ];
  for (const [income, tax, disp] of table) {
    it(`revenu imposable ${income} € → impôt ${tax} €, revenu ${disp} €`, () => {
      const gross = income === 0 ? null : grossFromNet(income / 12, 'prive', CSG_NONE);
      const plan = simulate(single(gross), 'plan', { hypotheses: hyp });
      expect(plan.taxableIncomeAnnual).toBeCloseTo(income, 1);
      expect(Math.abs(amount(plan, 'impot_revenu') * 12 - tax)).toBeLessThan(0.07);
      expect(amount(plan, 'afu')).toBe(550);
      expect(Math.abs(plan.disposable * 12 - disp)).toBeLessThan(0.1);
    });
  }

  it('break-even 28 695,65 € : impôt = AFU', () => {
    const plan = simulate(single(grossFromNet(28695.65 / 12, 'prive', CSG_NONE)), 'plan', {
      hypotheses: hyp,
    });
    expect(Math.abs(amount(plan, 'impot_revenu') + amount(plan, 'afu'))).toBeLessThan(0.01);
  });

  it('H2 on: break-even ≈ 31 884 € of net salary (6 600 / (23 % × 0,9))', () => {
    const plan = simulate(
      single(grossFromNet(6600 / (0.23 * 0.9) / 12, 'prive', CSG_NONE)),
      'plan',
      { hypotheses: { includeTva: false } },
    );
    expect(Math.abs(amount(plan, 'impot_revenu') + amount(plan, 'afu'))).toBeLessThan(0.01);
  });

  it('marginal retention: 0,77 € per € with H2 off, 0,793 € with H2 on', () => {
    for (const [h2, expected] of [
      [false, 0.77],
      [true, 0.793],
    ] as const) {
      const a = simulate(single(2500), 'plan', { hypotheses: { H2_fraisPro10: h2 } });
      const b = simulate(single(2600), 'plan', { hypotheses: { H2_fraisPro10: h2 } });
      const ratio = (b.disposable - a.disposable) / (b.perAdult[0]!.net - a.perAdult[0]!.net);
      expect(ratio).toBeCloseTo(expected, 2);
    }
  });
});

describe('Disabled adult with the CMI « invalidité » (fiche Personne handicapée)', () => {
  it('receives 1 100 €/mois (550 + 550) with no other income', () => {
    const plan = simulate(
      { ...single(null), adults: [{ age: 40, activity: 'inactif', disability: 'aah_80' }] },
      'plan',
    );
    expect(amount(plan, 'afu')).toBe(1100);
    expect(plan.disposable).toBe(1100);
  });
  it('AAH 50–79 % (no CMI invalidité): only 550 €/mois — the loss is shown', () => {
    const c = compare({
      ...single(null),
      adults: [{ age: 40, activity: 'inactif', disability: 'aah_50_79' }],
    });
    expect(amount(c.plan, 'afu')).toBe(550);
    expect(c.delta).toBeLessThan(-450);
  });
});

describe('Other book figures', () => {
  it('child part 275 €/mois, pension supplement 275 €/mois before 2028 only', () => {
    const h: Household = {
      adults: [
        {
          age: 70,
          activity: 'retraite',
          disability: 'none',
          pension: { amount: 1500, basis: 'brut', startYear: 2020 },
        },
      ],
      marriedOrPacs: false,
      children: [{ age: 10 }],
      housing: { status: 'proprietaire' },
      benefits: { nonRecours: false },
    };
    expect(amount(simulate(h, 'plan'), 'afu')).toBe(550 + 275 + 275);
    const after = {
      ...h,
      adults: [
        { ...h.adults[0], pension: { amount: 1500, basis: 'brut' as const, startYear: 2028 } },
      ] as Household['adults'],
    };
    expect(amount(simulate(after, 'plan'), 'afu')).toBe(550 + 275);
  });
  it('young adults 18–24 get the adult AFU (H13)', () => {
    const h = { ...single(null), children: [{ age: 19 }] };
    expect(amount(simulate(h, 'plan'), 'afu')).toBe(1100);
  });
});
