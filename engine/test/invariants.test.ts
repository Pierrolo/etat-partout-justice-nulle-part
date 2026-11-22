/** Property tests of docs/ENGINE-API.md invariants 1, 2, 5, 6, 7 (fast-check, fixed seed for reproducibility). */
import { describe, expect } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import {
  compare,
  decodeState,
  encodeState,
  simulate,
  type Household,
  type ScenarioResult,
} from '../src/index.ts';
import { ALL_SWITCHES_OFF } from '../src/hypotheses.ts';
import {
  adultArb,
  householdArb,
  hypothesesArb,
  periodArb,
  salaryArb,
} from './helpers/arbitraries.ts';

// FC_RUNS=10000 for the nightly / exploratory run (see README); seed fixed for reproducibility unless FC_SEED is set.
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
fc.configureGlobal({
  seed: env.FC_SEED ? Number(env.FC_SEED) : 20261024,
  numRuns: Number(env.FC_RUNS ?? 150),
});

const sumDirect = (r: ScenarioResult) =>
  r.components.filter((c) => c.group !== 'impots_indirects').reduce((s, c) => s + c.amount, 0);
const sumIndirect = (r: ScenarioResult) =>
  r.components.filter((c) => c.group === 'impots_indirects').reduce((s, c) => s + c.amount, 0);

describe('invariant 1 — components sum to disposable income (to the cent)', () => {
  test.prop([householdArb(), hypothesesArb, periodArb])(
    'both scenarios, every period and hypothesis set',
    (h, hyp, period) => {
      const c = compare(h, { period, hypotheses: hyp });
      for (const r of [c.baseline, c.plan]) {
        expect(Math.abs(sumDirect(r) - r.disposable)).toBeLessThan(0.005);
        expect(Math.abs(r.disposable + sumIndirect(r) - r.disposableAfterTva)).toBeLessThan(0.006);
        if (!hyp.includeTva) expect(r.disposableAfterTva).toBe(r.disposable);
        expect(r.components.map((x) => x.id)).toEqual(c.baseline.components.map((x) => x.id));
        for (const k of r.components) expect(Number.isFinite(k.amount)).toBe(true);
      }
      expect(Math.abs(c.delta - (c.plan.disposable - c.baseline.disposable))).toBeLessThan(0.006);
    },
  );
});

describe('invariant 2 — plan with every reform switch off ≡ baseline', () => {
  test.prop([householdArb(), hypothesesArb, periodArb])(
    'component by component',
    (h, hyp, period) => {
      const base = simulate(h, 'baseline', { hypotheses: hyp });
      const plan = simulate(h, 'plan', {
        period,
        hypotheses: hyp,
        __planSwitches: ALL_SWITCHES_OFF,
      });
      expect(plan.disposable).toBeCloseTo(base.disposable, 2);
      plan.components.forEach((c, i) =>
        expect(Math.abs(c.amount - base.components[i]!.amount)).toBeLessThan(0.011),
      );
    },
  );
});

describe('invariant 5 — steady-state plan: marginal retention ≥ 0,77 on net earnings (no cliffs), default hypotheses', () => {
  // households without pensions (the pension CSG tiers, kept by the plan, create cliffs for retired members)
  const noPension = adultArb().filter((a) => a.activity !== 'retraite');
  test.prop([
    householdArb({ adults: noPension }),
    salaryArb,
    fc.integer({ min: 0, max: 15000 }),
    fc.integer({ min: 1, max: 400 }),
  ])('Δ disposable / Δ net salary of adult 1', (h0, sal, net, step) => {
    const at = (x: number): Household => ({
      ...h0,
      adults: [
        { ...h0.adults[0], activity: 'salarie', salary: { ...sal, amount: x, basis: 'net' } },
        ...h0.adults.slice(1),
      ] as Household['adults'],
    });
    const a = simulate(at(net), 'plan');
    const b = simulate(at(net + step), 'plan');
    const dNet = b.perAdult[0]!.net - a.perAdult[0]!.net;
    expect(dNet).toBeGreaterThan(0);
    expect((b.disposable - a.disposable) / dNet).toBeGreaterThanOrEqual(0.77 - 0.02 / dNet - 1e-9);
  });
});

describe('invariant 6 — plan side independent of marriedOrPacs', () => {
  // gross incomes held constant (pensions typed gross): today's tier — and so the gross behind a NET pension — depends on the foyer fiscal
  test.prop([
    householdArb({
      adults: adultArb({ pensionBasis: ['brut'] }),
      twoAdults: true,
      noCafOverride: true,
    }),
    hypothesesArb,
    fc.constantFrom('steady' as const, 2030 as const),
  ])('married vs unmarried couples', (h, hyp, period) => {
    const m = simulate({ ...h, marriedOrPacs: true }, 'plan', { period, hypotheses: hyp });
    const u = simulate({ ...h, marriedOrPacs: false }, 'plan', { period, hypotheses: hyp });
    expect(m.disposable).toBe(u.disposable);
    m.components
      .filter((c) => c.group !== 'impots_indirects')
      .forEach((c, i) => expect(c.amount).toBe(u.components[i]!.amount));
  });
});

describe('invariant 7 — URL state round trip', () => {
  test.prop([householdArb(), hypothesesArb, periodArb])(
    'decodeState(encodeState(x)) deep-equals x',
    (h, hyp, period) => {
      const s = encodeState(h, hyp, period);
      expect(s).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
      expect(decodeState(s)).toEqual({ household: h, hypotheses: hyp, period });
      expect(JSON.stringify(decodeState(s)?.household)).toBe(JSON.stringify(h));
    },
  );
  test.prop([fc.string(), fc.string({ unit: 'binary' })])(
    'garbage never throws and returns null',
    (a, b) => {
      for (const s of [a, b, `v1.${a}`, `v1.${b}`]) {
        const r = decodeState(s);
        if (r !== null) expect(typeof r.household).toBe('object');
      }
      expect(decodeState(`v1.${a}`.slice(0, 3))).toBeNull();
    },
  );
});
