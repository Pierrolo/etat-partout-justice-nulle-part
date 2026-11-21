/**
 * Regression tests for the current-law fixes of the fact-check of 2026-11-21 (docs/qa/factcheck/VERIFIED-nonplan.md).
 * One block per verified row.
 */
import { test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { incomeTax } from '../src/baseline/ir.ts';
import {
  CAS_TYPES,
  compare,
  decodeState,
  DEFAULT_HYPOTHESES,
  encodeState,
  hourOfWork,
  roundForDisplay,
  type Household,
} from '../src/index.ts';
import { householdArb, hypothesesArb, periodArb } from './helpers/arbitraries.ts';

const amt = (r: { components: Array<{ id: string; amount: number }> }, id: string) =>
  r.components.find((c) => c.id === id)!.amount;
const cas = (id: string) => structuredClone(CAS_TYPES.find((c) => c.id === id)!.household);
const nearest5 = (x: number) => {
  const r = Math.round(x / 5 + 1e-9) * 5;
  return Object.is(r, -0) ? 0 : r;
};

/** Lone parent, 1 SMIC-ish, one child of `age`, assistante maternelle billed `cost` €/month. */
const loneParent = (age: number, childcare: 'assistante_maternelle' | 'micro_creche', cost = 400) =>
  ({
    adults: [
      {
        age: 32,
        activity: 'salarie',
        disability: 'none',
        salary: { amount: 1700, basis: 'net', status: 'prive' },
      },
    ],
    marriedOrPacs: false,
    children: [{ age }],
    housing: { status: 'locataire', rentMonthly: 600, zone: 2 },
    benefits: { nonRecours: false, childSupportReceivedMonthly: 0 },
    extras: { childcare, childcareCostMonthly: cost },
  }) satisfies Household;

describe('row 1 — CMG until 12 for a lone parent with an assistante maternelle (F39152), < 6 for a micro-crèche (F345)', () => {
  it('lone parent, child of 8, assistante maternelle: CMG paid', () => {
    const c = compare(loneParent(8, 'assistante_maternelle'));
    expect(amt(c.baseline, 'cmg')).toBeGreaterThan(50);
  });
  it('lone parent, child of 12: no CMG', () => {
    const c = compare(loneParent(12, 'assistante_maternelle'));
    expect(amt(c.baseline, 'cmg')).toBe(0);
    const why = c.baselineBenefitsExplained.find((b) => b.id === 'cmg')!.reason!;
    expect(why).toContain('12 ans pour un parent seul');
  });
  it('lone parent, child of 8, micro-crèche: no CMG (structure stays < 6)', () => {
    expect(amt(compare(loneParent(8, 'micro_creche')).baseline, 'cmg')).toBe(0);
  });
  it('couple, child of 8, assistante maternelle: no CMG', () => {
    const h: Household = { ...loneParent(8, 'assistante_maternelle'), marriedOrPacs: true };
    h.adults = [h.adults[0], { ...h.adults[0] }];
    expect(amt(compare(h).baseline, 'cmg')).toBe(0);
  });
  it('the crédit garde only counts the children < 6 (the bill is shared with the child of 8)', () => {
    const one = loneParent(3, 'assistante_maternelle', 800);
    const two: Household = { ...one, children: [{ age: 3 }, { age: 8 }] };
    const g1 = compare(one).baseline.components.find((x) => x.id === 'credits_impot')!.amount;
    const g2 = compare(two).baseline.components.find((x) => x.id === 'credits_impot')!.amount;
    expect(g2).toBeLessThan(g1);
  });
  it('no default bill for a child of 6 or more: CMG 0 and a warning', () => {
    const h: Household = loneParent(8, 'assistante_maternelle');
    h.extras = { childcare: 'assistante_maternelle' };
    const c = compare(h);
    expect(amt(c.baseline, 'cmg')).toBe(0);
    expect(c.warnings.join(' ')).toContain('aucun coût n’est supposé');
  });
});

describe('row 4 — IR recouvrement threshold (BOI-IR-LIQ-20-20-40 §80-90)', () => {
  const single = (rnc: number, credits = 0, dons = 0) =>
    incomeTax({
      rnc,
      couple: false,
      nChildren: 0,
      parentIsole: false,
      anyoneAged65: false,
      refundableCredits: credits,
      reductionDons: dons,
    });
  /** IR after décote, before the threshold */
  const taxOf = (rnc: number) => {
    const t = single(rnc);
    return Math.max(0, t.irBeforeDecote - t.decote);
  };
  const findRnc = (lo: number, hi: number) => {
    for (let r = 15000; r < 40000; r += 10) {
      const t = taxOf(r);
      if (t >= lo && t <= hi) return r;
    }
    throw new Error('no rnc');
  };
  it('tax < 61 € with a smaller credit: nothing paid, nothing refunded', () => {
    const r = findRnc(30, 55);
    expect(single(r, 10).irNet).toBe(0);
  });
  it('tax < 61 € with a larger credit: only the difference is refunded', () => {
    const r = findRnc(30, 55);
    const tax = taxOf(r);
    expect(single(r, tax + 15).irNet).toBeCloseTo(-15, 6);
  });
  it('a dons reduction that brings the tax under 61 €: nothing paid', () => {
    const r = findRnc(90, 130);
    const tax = taxOf(r);
    expect(single(r, 0, tax - 30).irNet).toBe(0);
  });
  it('above the threshold, unchanged: tax − reduction − credits', () => {
    const r = findRnc(500, 700);
    const tax = taxOf(r);
    expect(single(r, 100, 50).irNet).toBeCloseTo(tax - 50 - 100, 6);
  });
});

describe('row 9 — student housing aid: CAF resource floor (8 600 € / 6 900 € boursier, 2026)', () => {
  it('the etudiant cas-type: APL computed on 8 600 €/an, not 0 €', () => {
    const c = compare(cas('etudiant'));
    // apl(zone 2, single, 0 child, rent 400, R = 8 600) = 204,47 € gross
    expect(amt(c.baseline, 'aides_logement')).toBeCloseTo(204.47 * 0.995, 1);
  });
  it('boursier: 6 900 €/an', () => {
    const h = cas('etudiant');
    h.adults[0]!.boursier = true;
    expect(amt(compare(h).baseline, 'aides_logement')).toBeCloseTo(257.76 * 0.995, 1);
  });
  it('the floor does not apply to a non-student, nor when actual resources are higher', () => {
    const h = cas('etudiant');
    h.adults[0]!.activity = 'inactif';
    expect(amt(compare(h).baseline, 'aides_logement')).toBeCloseTo(309.96 * 0.995, 1);
    const rich = cas('etudiant');
    rich.adults[0]!.salary = { amount: 1200, basis: 'net', status: 'prive' };
    const poorStudent = compare(cas('etudiant'));
    expect(amt(compare(rich).baseline, 'aides_logement')).toBeLessThan(
      amt(poorStudent.baseline, 'aides_logement'),
    );
  });
  it('« boursier » round-trips in the URL state; older hashes still decode', () => {
    const h = cas('etudiant');
    const plain = encodeState(h, DEFAULT_HYPOTHESES, 'steady');
    expect(decodeState(plain)!.household.adults[0]!.boursier).toBeUndefined();
    h.adults[0]!.boursier = true;
    const s = encodeState(h, DEFAULT_HYPOTHESES, 'steady');
    expect(decodeState(s)!.household.adults[0]!.boursier).toBe(true);
  });
});

describe('row 12 — the after-TVA headline is the nearest multiple of 5 of the exact value', () => {
  it('on every cas-type (seul-0.5, seul-1, couple-1-0, retraite-1800… were off by 5 €)', () => {
    for (const ct of CAS_TYPES) {
      const c = compare(ct.household);
      const d = roundForDisplay(c);
      expect(d.deltaAfterTva, ct.id).toBe(nearest5(c.deltaAfterTva));
      expect(d.baselineAfterTva, ct.id).toBe(nearest5(c.baseline.disposableAfterTva));
    }
  });
  test.prop([householdArb(), hypothesesArb, periodArb], { seed: 20261121, numRuns: 150 })(
    'property: headline = nearest 5 € of the exact value, and the lines still add up',
    (h, hypotheses, period) => {
      const c = compare(h, { hypotheses, period });
      const d = roundForDisplay(c);
      const ind = d.lines.filter((l) => l.group === 'impots_indirects');
      expect(d.deltaAfterTva).toBe(nearest5(c.deltaAfterTva));
      expect(d.baselineAfterTva).toBe(nearest5(c.baseline.disposableAfterTva));
      expect(d.planAfterTva).toBe(d.baselineAfterTva + d.deltaAfterTva);
      expect(d.baselineAfterTva).toBe(d.baseline + ind.reduce((s, l) => s + l.before, 0));
      expect(d.planAfterTva).toBe(d.plan + ind.reduce((s, l) => s + l.after, 0));
      expect(d.deltaAfterTva).toBe(d.delta + ind.reduce((s, l) => s + l.delta, 0));
    },
  );
});

describe('row 13 — the AFU per month of the « heure de travail » sentence is 550 €, not 551 €', () => {
  it('afuMonthly is unrounded: 6 600 / 12', () => {
    const h = hourOfWork(cas('seul-1'));
    expect(h.plan.afuMonthly).toBeCloseTo(550, 6);
    expect(h.baseline.afuMonthly).toBe(0);
  });
});
