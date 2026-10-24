/**
 * Impôt sur le revenu, barème LF 2026 (baseline-rules.md §6) — port of scripts/baseline_reference.py.
 * Per foyer fiscal. Unmarried couples are two foyers (children attached to the first adult).
 */
import { n, pv } from '../params/index.ts';

export function bareme(q: number): number {
  const br = pv('income_tax.bareme_2026');
  let tax = 0;
  for (let i = 0; i < br.length; i++) {
    const b = br[i]!;
    const hi = i + 1 < br.length ? br[i + 1]!.from : Infinity;
    if (q > b.from) tax += (Math.min(q, hi) - b.from) * b.rate;
  }
  return tax;
}

export function fiscalParts(couple: boolean, nChildren: number, parentIsole: boolean): number {
  let parts = couple ? 2 : 1;
  for (let k = 1; k <= nChildren; k++)
    parts += k <= 2 ? n('income_tax.parts.child_1_and_2') : n('income_tax.parts.child_3_and_more');
  if (parentIsole && !couple && nChildren > 0) parts += n('income_tax.parts.parent_isole_bonus');
  return parts;
}

/** 10 % deduction on salaries (and ARE): min 509, max 14 555, never above the income. */
export function abattementSalaire(s: number): number {
  if (s <= 0) return 0;
  const a = Math.min(
    Math.max(n('income_tax.abattement_salaires_rate') * s, n('income_tax.abattement_salaires_min')),
    n('income_tax.abattement_salaires_max'),
  );
  return Math.min(a, s);
}

/** 10 % pension abattement (per foyer): min 454 per holder, max 4 439 per foyer. */
export function abattementPensions(pensions: number[]): number {
  const p = pensions.reduce((s, x) => s + x, 0);
  if (p <= 0) return 0;
  const holders = pensions.filter((x) => x > 0).length;
  const a = Math.min(
    Math.max(
      n('income_tax.abattement_pensions_rate') * p,
      n('income_tax.abattement_pensions_min_per_pension') * holders,
    ),
    n('income_tax.abattement_pensions_max_per_household'),
  );
  return Math.min(a, p);
}

/** Revenu net catégoriel (annual): salaries/ARE after 10 %, pensions after the 10 % abattement (if still in force). */
export function netCategoricalIncome(
  salaryTaxableAnnual: number[],
  pensionTaxableAnnual: number[],
  pensionAbattement = true,
): number {
  let tot = 0;
  for (const s of salaryTaxableAnnual) if (s > 0) tot += s - abattementSalaire(s);
  const p = pensionTaxableAnnual.reduce((s, x) => s + x, 0);
  tot += p - (pensionAbattement ? abattementPensions(pensionTaxableAnnual) : 0);
  return tot;
}

export interface IncomeTaxInput {
  rnc: number;
  couple: boolean;
  nChildren: number;
  parentIsole: boolean;
  anyoneAged65: boolean;
  /** refundable credits (garde d'enfants, emploi à domicile), annual, already computed */
  refundableCredits: number;
  /** réduction d'impôt pour dons (non refundable), annual, before the cap at the tax */
  reductionDons: number;
}

export interface IncomeTaxResult {
  parts: number;
  ageAbattement: number;
  rni: number;
  rfr: number;
  irBeforeDecote: number;
  decote: number;
  /** IR after décote and recouvrement threshold, before réductions/crédits */
  irAfterDecote: number;
  reduction: number;
  credits: number;
  /** signed: IR paid (positive) or refund (negative) */
  irNet: number;
}

export function incomeTax(x: IncomeTaxInput): IncomeTaxResult {
  let ageAb = 0;
  if (x.anyoneAged65) {
    const t1 = pv('income_tax.abattement_age_65_tier1');
    const t2 = pv('income_tax.abattement_age_65_tier2');
    ageAb = x.rnc <= t1.rng_max ? t1.amount : x.rnc <= t2.rng_max ? t2.amount : 0;
  }
  const rni = Math.max(0, x.rnc - ageAb);
  const parts = fiscalParts(x.couple, x.nChildren, x.parentIsole);
  const nBase = x.couple ? 2 : 1;
  const ir1 = parts * bareme(rni / parts);
  const ir0 = nBase * bareme(rni / nBase);
  const halves = (parts - nBase) / 0.5;
  const capHalf = n('income_tax.qf_cap_per_half_part');
  const cap = x.parentIsole
    ? n('income_tax.qf_cap_parent_isole_first_child') + capHalf * Math.max(0, halves - 2)
    : capHalf * halves;
  const ir = halves > 0 ? Math.max(ir1, ir0 - cap) : ir1;
  const decBase = x.couple ? n('income_tax.decote_couple') : n('income_tax.decote_single');
  const rate = n('income_tax.decote_rate');
  const decote = ir < decBase / rate ? Math.max(0, decBase - rate * ir) : 0;
  let after = Math.max(0, ir - decote);
  if (after < n('income_tax.recouvrement_minimum') && x.refundableCredits === 0) after = 0;
  const reduction = Math.min(Math.max(0, x.reductionDons), after);
  return {
    parts,
    ageAbattement: ageAb,
    rni,
    rfr: rni,
    irBeforeDecote: ir,
    decote,
    irAfterDecote: after,
    reduction,
    credits: x.refundableCredits,
    irNet: after - reduction - x.refundableCredits,
  };
}
