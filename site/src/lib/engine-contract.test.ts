/**
 * Contract checks (docs/ENGINE-API.md invariants) run against WHATEVER `@/lib/engine` currently
 * exports — the mock today, the real engine once `USE_MOCK_ENGINE` is flipped. They protect the UI's
 * assumptions: stable ids, components add up, hash state round-trips.
 */
import { describe, expect, it } from 'vitest';
import {
  CAS_TYPES,
  compare,
  DEFAULT_HYPOTHESES,
  decodeState,
  earningsCurve,
  encodeState,
  hourOfWork,
} from './engine';
import type { Household } from './engine-types';

const h = CAS_TYPES[0]!.household;

describe('engine contract as used by the site', () => {
  it('components add up to disposable income (invariant 1) — direct ones to `disposable`, all of them to `disposableAfterTva`', () => {
    for (const cas of CAS_TYPES) {
      const c = compare(cas.household);
      for (const s of [c.baseline, c.plan]) {
        const direct = s.components
          .filter((x) => x.group !== 'impots_indirects')
          .reduce((a, x) => a + x.amount, 0);
        const all = s.components.reduce((a, x) => a + x.amount, 0);
        expect(Math.abs(direct - s.disposable)).toBeLessThan(0.01);
        expect(Math.abs(all - s.disposableAfterTva)).toBeLessThan(0.01);
      }
      expect(
        Math.abs(c.deltaAfterTva - (c.plan.disposableAfterTva - c.baseline.disposableAfterTva)),
      ).toBeLessThan(0.01);
      // the waterfall adds up to the after-TVA delta: the figure the headline announces
      const steps = c.waterfall.reduce((a, w) => a + w.delta, 0);
      expect(Math.abs(steps - c.deltaAfterTva)).toBeLessThan(0.05);
    }
  });

  it('component ids are stable between scenarios', () => {
    const c = compare(CAS_TYPES[Math.floor(CAS_TYPES.length / 2)]!.household);
    const key = (x: { id: string; personIndex?: number }) => `${x.id}|${x.personIndex ?? ''}`;
    const b = c.baseline.components.map(key).sort();
    const p = c.plan.components.map(key).sort();
    expect(p).toEqual(b);
  });

  it('every non-zero waterfall step names its sources and formulas', () => {
    const c = compare(h);
    for (const w of c.waterfall) {
      expect(Math.abs(w.delta)).toBeGreaterThan(0);
      expect(typeof w.formulaBefore).toBe('string');
      expect(typeof w.formulaAfter).toBe('string');
      expect(Array.isArray(w.sources)).toBe(true);
    }
  });

  it('changing a hypothesis changes the result', () => {
    // someone who pays tax in the plan: the 10 % deduction matters
    const earner: Household = {
      adults: [
        {
          age: 38,
          activity: 'salarie',
          disability: 'none',
          salary: { amount: 3000, basis: 'net', status: 'prive' },
        },
      ],
      marriedOrPacs: false,
      children: [],
      housing: { status: 'locataire', rentMonthly: 700, zone: 2 },
      benefits: { nonRecours: false },
    };
    const a = compare(earner, { hypotheses: { H2_fraisPro10: true } });
    const b = compare(earner, { hypotheses: { H2_fraisPro10: false } });
    expect(a.delta).not.toBe(b.delta);
  });

  it('state round-trips through the URL hash encoding (invariant 7)', () => {
    for (const period of ['steady', 2027, 2028, 2030] as const) {
      const s = encodeState(h, { ...DEFAULT_HYPOTHESES, H5_tvaPassThrough: 0.5 }, period);
      expect(s).toMatch(/^v\d+\.[A-Za-z0-9_-]+$/);
      const d = decodeState(s);
      expect(d).not.toBeNull();
      expect(d!.household).toEqual(h);
      expect(d!.period).toBe(period);
      expect(d!.hypotheses.H5_tvaPassThrough).toBe(0.5);
    }
    expect(decodeState('v1.@@@')).toBeNull();
    expect(decodeState('garbage')).toBeNull();
  });

  it('earnings curve and hour of work have the documented shapes', () => {
    const curve = earningsCurve(h, { maxNet: 3000, step: 500 });
    expect(curve.length).toBeGreaterThan(2);
    expect(curve[0]).toMatchObject({
      netToday: expect.any(Number),
      baseline: expect.any(Number),
      plan: expect.any(Number),
    });
    const hw = hourOfWork(h, 0);
    const parts = (x: typeof hw.baseline) =>
      x.cotisationsPatronales +
      x.cotisationsSalariales +
      x.csgCrds +
      x.impotRevenu +
      x.tva +
      x.youKeep;
    expect(Math.abs(parts(hw.baseline) - hw.baseline.employerCostPerHour)).toBeLessThan(0.05);
    expect(Math.abs(parts(hw.plan) - hw.plan.employerCostPerHour)).toBeLessThan(0.05);
  });
});
