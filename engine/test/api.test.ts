/** Unit tests of the public API surface and of the modelling choices that are not oracle-checked. */
import { describe, expect, it } from 'vitest';
import {
  CAS_TYPES,
  COMPONENT_IDS,
  DEFAULT_HYPOTHESES,
  ENGINE_VERSION,
  PARAMS,
  PARAMS_META,
  TIERS,
  compare,
  decodeState,
  earningsCurve,
  encodeState,
  hourOfWork,
  simulate,
  type Household,
} from '../src/index.ts';
import { salaryChain, grossFromNet } from '../src/baseline/salaire.ts';
import { areFromNet } from '../src/baseline/chomage.ts';

const amt = (r: ReturnType<typeof simulate>, id: string) =>
  r.components.find((c) => c.id === id)!.amount;
const base = (over: Partial<Household> = {}): Household => ({
  adults: [
    {
      age: 35,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: 1477.93, basis: 'net', status: 'prive' },
    },
  ],
  marriedOrPacs: false,
  children: [],
  housing: { status: 'locataire', rentMonthly: 550, zone: 2 },
  benefits: { nonRecours: false },
  ...over,
});

describe('exports', () => {
  it('version, tiers, defaults, params', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(TIERS).toEqual(['law', 'announced', 'hypothesis']);
    expect(DEFAULT_HYPOTHESES).toEqual({
      H1_benefits: 'replaced',
      H2_fraisPro10: true,
      H5_tvaPassThrough: 1,
      includeTva: true,
    });
    expect(PARAMS_META.engineVersion).toBe(ENGINE_VERSION);
    expect(Object.keys(PARAMS).length).toBeGreaterThan(290);
    for (const [k, p] of Object.entries(PARAMS)) {
      expect(p.source.label.length, k).toBeGreaterThan(2);
      expect(p.effective, k).toBeTruthy();
    }
  });
});

describe('net → gross inversion', () => {
  it('SMIC net 1 477,93 € ↔ gross 1 867,02 € (service-public F2300)', () => {
    expect(grossFromNet(1477.93, 'prive')).toBeCloseTo(1867.02, 1);
    for (const st of ['prive', 'cadre', 'fonctionnaire'] as const) {
      const g = grossFromNet(2345.67, st);
      expect(salaryChain(g, st, 1).net).toBeCloseTo(2345.67, 4);
    }
  });
  it('fonctionnaire: no RGDU, CSG identical to the private sector', () => {
    const f = salaryChain(3000, 'fonctionnaire', 1);
    const p = salaryChain(3000, 'prive', 1);
    expect(f.rgdu).toBe(0);
    expect(f.csgDed + f.csgNonDed + f.crds).toBeCloseTo(p.csgDed + p.csgNonDed + p.crds, 8);
    expect(f.cotisationsSalariales / 3000).toBeCloseTo(0.111 * 0.8 + 0.05 * 0.16, 6);
  });
  it('cadre pays APEC on top of the non-cadre chain', () => {
    expect(
      salaryChain(4000, 'cadre', 1).cotisationsSalariales -
        salaryChain(4000, 'prive', 1).cotisationsSalariales,
    ).toBeCloseTo(0.00024 * 4000, 6);
  });
});

describe('ARE', () => {
  it('below the gross SMIC: no CSG; above: 6,7 % × 98,25 % with écrêtement', () => {
    expect(areFromNet(1000).gross).toBe(1000);
    const r = areFromNet(2500);
    expect(r.net).toBeCloseTo(2500, 8);
    expect(r.gross - r.net).toBeCloseTo(r.csg + r.crds, 8);
  });
  it('is taxed at 23 % in the plan and counted as a resource for RSA', () => {
    const h = base({
      adults: [
        { age: 40, activity: 'chomage', disability: 'none', unemployment: { areMonthly: 900 } },
      ],
    });
    const c = compare(h);
    expect(amt(c.baseline, 'rsa')).toBe(0);
    expect(amt(c.plan, 'are')).toBe(900);
    expect(amt(c.plan, 'impot_revenu')).toBeCloseTo(-0.23 * 900 * 0.9, 1);
    expect(c.unquantified.losses.find((l) => l.id === 'chomage_6_mois')?.amountHint).toMatch(/900/);
  });
});

describe('compare()', () => {
  const c = compare(base());
  it('every component id in both scenarios, in the same order', () => {
    expect(c.baseline.components.map((x) => x.id)).toEqual([...COMPONENT_IDS]);
    expect(c.plan.components.map((x) => x.id)).toEqual([...COMPONENT_IDS]);
  });
  it('waterfall: non-zero deltas, grouped revenus → prélèvements → prestations → impôts indirects, summing to the deltas', () => {
    const order = ['revenus', 'prelevements', 'prestations', 'impots_indirects'];
    const groups = c.waterfall.map((w) =>
      order.indexOf(c.plan.components.find((k) => k.id === w.id)!.group),
    );
    expect(groups).toEqual([...groups].sort((a, b) => a - b));
    expect(
      c.waterfall.every((w) => w.delta !== 0 && w.sources.length > 0 && w.formulaAfter.length > 0),
    ).toBe(true);
    const direct = c.waterfall
      .filter((w) => !['tva', 'cee'].includes(w.id))
      .reduce((s, w) => s + w.delta, 0);
    expect(direct).toBeCloseTo(c.delta, 1);
    expect(c.waterfall.reduce((s, w) => s + w.delta, 0)).toBeCloseTo(c.deltaAfterTva, 1);
  });
  it('symmetric non-chiffré panels, hypotheses and caveats', () => {
    expect(c.unquantified.promises.length).toBeGreaterThan(3);
    expect(c.unquantified.losses.length).toBeGreaterThan(3);
    expect(c.unquantified.promises.find((p) => p.id === 'compte_education')).toBeUndefined(); // no child
    expect(c.activeHypotheses.map((h) => h.id)).toEqual(expect.arrayContaining(['H1', 'H2', 'H5']));
    expect(c.notModelled.length).toBeGreaterThan(3);
  });
  it('formulas are rendered with the household’s numbers (French formatting)', () => {
    expect(c.baseline.components.find((k) => k.id === 'salaire_net')!.formula).toContain(
      '1 867,02',
    );
    expect(c.plan.components.find((k) => k.id === 'impot_revenu')!.formula).toMatch(
      /^23 % × revenu net imposable|^23 % × revenu/,
    );
  });
  it('non-recours zeroes today’s benefits; the CAF override rescales them', () => {
    const nr = compare(base({ benefits: { nonRecours: true } }));
    expect(amt(nr.baseline, 'prime_activite')).toBe(0);
    const ov = compare(base({ benefits: { nonRecours: false, cafOverrideMonthly: 100 } }));
    expect(amt(ov.baseline, 'prime_activite')).toBeCloseTo(100, 2);
    const none = compare(
      base({
        adults: [
          {
            age: 35,
            activity: 'salarie',
            disability: 'none',
            salary: { amount: 4000, basis: 'net', status: 'cadre' },
          },
        ],
        benefits: { nonRecours: false, cafOverrideMonthly: 80 },
      }),
    );
    expect(amt(none.baseline, 'aides_caf_declarees')).toBe(80);
    expect(amt(none.plan, 'aides_caf_declarees')).toBe(0);
  });
  it('invalid input never throws and is reported', () => {
    const bad = {
      adults: [],
      children: [{ age: 40 }, { age: 'x' }],
      housing: { status: 'castle' },
      benefits: {},
    } as unknown as Household;
    const r = compare(bad);
    expect(r.warnings.length).toBeGreaterThan(2);
    expect(Number.isFinite(r.delta)).toBe(true);
  });
});

describe('couples and foyers fiscaux', () => {
  const couple = (married: boolean): Household => ({
    adults: [
      {
        age: 40,
        activity: 'salarie',
        disability: 'none',
        salary: { amount: 6000, basis: 'net', status: 'cadre' },
      },
      { age: 40, activity: 'inactif', disability: 'none' },
    ],
    marriedOrPacs: married,
    children: [],
    housing: { status: 'proprietaire' },
    benefits: { nonRecours: false },
  });
  it('quotient conjugal today, identical plan', () => {
    const m = compare(couple(true));
    const u = compare(couple(false));
    expect(amt(m.baseline, 'impot_revenu')).toBeGreaterThan(amt(u.baseline, 'impot_revenu')); // less tax when married
    expect(m.plan.disposable).toBe(u.plan.disposable);
  });
});

describe('transition', () => {
  it('2027: CSG gain is the yearly average of the monthly path; no AFU yet', () => {
    const c = compare(base({ housing: { status: 'gratuit' } }), { period: 2027 });
    const gross = 1867.02;
    const avgRate = (6 * 0.097 + 0.081 + 0.065 + 0.048 + 0.032 + 0.016 + 0) / 12;
    expect(c.waterfall.find((w) => w.id === 'salaire_net')!.delta).toBeCloseTo(
      gross * 0.9825 * (0.097 - avgRate),
      1,
    );
    expect(amt(c.plan, 'afu')).toBe(0);
  });
  it('retiree: 2027 dip (pension abattement gone before the AFU arrives)', () => {
    const h: Household = {
      ...base(),
      adults: [
        {
          age: 70,
          activity: 'retraite',
          disability: 'none',
          pension: { amount: 2500, basis: 'brut', startYear: 2015 },
        },
      ],
      housing: { status: 'proprietaire' },
    };
    expect(compare(h, { period: 2027 }).delta).toBeLessThan(0);
    expect(compare(h, { period: 2028 }).delta).toBeGreaterThan(0);
  });
  it('APL: −1/3 from July 2027, −2/3 from July 2028, 0 in 2030', () => {
    const h = base({
      adults: [{ age: 35, activity: 'inactif', disability: 'none' }],
      housing: { status: 'locataire', rentMonthly: 450, zone: 2 },
    });
    const today = amt(simulate(h, 'baseline'), 'aides_logement');
    expect(amt(simulate(h, 'plan', { period: 2027 }), 'aides_logement')).toBeCloseTo(
      (today * (6 + 4)) / 12,
      1,
    );
    expect(amt(simulate(h, 'plan', { period: 2028 }), 'aides_logement')).toBeCloseTo(
      (today * (4 + 2)) / 12,
      1,
    );
    expect(amt(simulate(h, 'plan', { period: 2030 }), 'aides_logement')).toBe(0);
  });
});

describe('earningsCurve and hourOfWork', () => {
  it('curve has the requested points and the plan retention is 0,793 per € (H2 on) in the flat zone', () => {
    const pts = earningsCurve(base({ housing: { status: 'gratuit' } }), {
      maxNet: 4000,
      step: 100,
    });
    expect(pts.length).toBe(41);
    expect(pts[0]!.netToday).toBe(0);
    const mid = pts.find((p) => p.netToday === 2500)!;
    expect(mid.mtrPlan).toBeCloseTo(1 - 0.793, 2);
    expect(Math.max(...pts.map((p) => p.mtrPlan))).toBeLessThan(0.2305); // cent rounding
  });
  it('hour of work: the split adds up to the employer cost per hour', () => {
    const r = hourOfWork(base());
    expect(r.hoursPerMonth).toBeCloseTo(151.67, 2);
    for (const s of [r.baseline, r.plan]) {
      const sum =
        s.cotisationsPatronales +
        s.cotisationsSalariales +
        s.csgCrds +
        s.impotRevenu +
        s.tva +
        s.youKeep;
      expect(sum).toBeCloseTo(s.employerCostPerHour, 1);
    }
    expect(r.plan.csgCrds).toBe(0);
    expect(r.plan.employerCostPerHour).toBe(r.baseline.employerCostPerHour);
  });
});

describe('state', () => {
  it('encodes every cas type compactly and decodes it back', () => {
    for (const c of CAS_TYPES) {
      const s = encodeState(c.household, DEFAULT_HYPOTHESES, 'steady');
      expect(s.length).toBeLessThan(400);
      expect(decodeState(s)).toEqual({
        household: c.household,
        hypotheses: DEFAULT_HYPOTHESES,
        period: 'steady',
      });
    }
  });
  it('rejects garbage', () => {
    for (const s of [
      '',
      'v1.',
      'v2.AAAA',
      'v1.!!!!',
      'v1.e30',
      `v1.${'A'.repeat(30001)}`,
      'v1.WzEsW10sW10sInMiXQ',
    ])
      expect(decodeState(s)).toBeNull();
  });
});
