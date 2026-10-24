/**
 * Prestations familiales (baseline-rules.md §7.3–7.7) — AF, CF, PAJE (allocation de base), ARS, ASF —
 * ports of scripts/baseline_reference.py; plus AEEH de base (32 % BMAF, not means-tested; compléments not modelled).
 */
import { n } from '../params/index.ts';

export function allocationsFamiliales(
  agesUnder20: number[],
  rnc: number,
): { af: number; afBase: number; nMajorations: number; tier: number } {
  const nAf = agesUnder20.length;
  if (nAf < 2) return { af: 0, afBase: 0, nMajorations: 0, tier: 1 };
  const bmaf = n('general.bmaf');
  const rate =
    nAf === 2
      ? n('benefits.family.af_rate_2_children')
      : nAf === 3
        ? n('benefits.family.af_rate_3_children')
        : n('benefits.family.af_rate_3_children') +
          n('benefits.family.af_rate_each_additional_child') * (nAf - 3);
  const full = rate * bmaf;
  const t1 =
    n('benefits.family.af_ceiling_tier1_base') + n('benefits.family.af_ceiling_per_child') * nAf;
  const t2 =
    n('benefits.family.af_ceiling_tier2_base') + n('benefits.family.af_ceiling_per_child') * nAf;
  let maj = 0;
  [...agesUnder20]
    .sort((a, b) => b - a)
    .forEach((a, i) => {
      if (nAf === 2 && i === 0) return; // eldest of 2 children never gets the age majoration
      if (a >= 15) maj++; // born before 1 Mar 2012 → 14 ; later → 18 ; age 14 ambiguous (treated as no)
    });
  const a1 = full + n('benefits.family.af_age_majoration_rate') * bmaf * maj;
  const months = n('benefits.family.af_degressive_complement_months');
  const f2 = n('benefits.family.af_tier2_factor');
  const f3 = n('benefits.family.af_tier3_factor');
  let total: number;
  if (rnc <= t1) total = a1;
  else if (rnc <= t2) total = Math.max(a1 * f2, (t1 + months * a1 - rnc) / months);
  else total = Math.max(a1 * f3, (t2 + months * a1 * f2 - rnc) / months);
  const tier = rnc <= t1 ? 1 : rnc <= t2 ? f2 : f3;
  return { af: total, afBase: full * tier, nMajorations: maj, tier };
}

export function complementFamilial(childrenAges: number[], rnc: number, bonus: boolean): number {
  const nC = childrenAges.filter((a) => a < 21).length;
  if (
    nC < n('benefits.family.cf_min_children') ||
    childrenAges.some((a) => a < n('benefits.family.cf_min_child_age'))
  )
    return 0;
  const bmaf = n('general.bmaf');
  const m =
    1 +
    n('benefits.family.cf_ceiling_child_1_2_increment') * 2 +
    n('benefits.family.cf_ceiling_child_3_plus_increment') * (nC - 2);
  const ceilBase =
    n('benefits.family.cf_ceiling_base_0_child') * m +
    (bonus ? n('benefits.family.cf_ceiling_bonus_two_incomes_or_lone_parent') : 0);
  const ceilMaj =
    n('benefits.family.cf_ceiling_majore_base_0_child') * m +
    (bonus ? n('benefits.family.cf_ceiling_majore_bonus_two_incomes_or_lone_parent') : 0);
  if (rnc <= ceilMaj) return n('benefits.family.cf_rate_majore') * bmaf;
  if (rnc <= ceilBase) return n('benefits.family.cf_rate_base') * bmaf;
  return 0;
}

export function pajeBase(childrenAges: number[], rnc: number, bonus: boolean): number {
  const nU3 = childrenAges.filter((a) => a < 3).length;
  if (nU3 === 0) return 0;
  const nC = childrenAges.filter((a) => a < 20).length;
  const m = 1 + 0.25 * Math.min(nC, 2) + 0.3 * Math.max(nC - 2, 0);
  const full =
    n('benefits.family.paje_ceiling_full_base') * m +
    (bonus ? n('benefits.family.paje_ceiling_bonus_full') : 0);
  const part =
    n('benefits.family.paje_ceiling_partial_base') * m +
    (bonus ? n('benefits.family.paje_ceiling_bonus_partial') : 0);
  const bmaf = n('general.bmaf');
  if (rnc <= full) return nU3 * n('benefits.family.paje_base_rate_full') * bmaf;
  if (rnc <= part) return nU3 * n('benefits.family.paje_base_rate_partial') * bmaf;
  return 0;
}

/** Allocation de rentrée scolaire, ANNUAL amount (paid in August). */
export function ars(childrenAges: number[], rnc: number): number {
  const bmaf = n('general.bmaf');
  const ceiling =
    n('benefits.family.ars_ceiling_base') *
    (1 + n('benefits.family.ars_ceiling_per_child_increment') * childrenAges.length);
  let total = 0;
  for (const a of childrenAges) {
    if (a >= 6 && a <= 10) total += n('benefits.family.ars_rate_6_10') * bmaf;
    else if (a >= 11 && a <= 14) total += n('benefits.family.ars_rate_11_14') * bmaf;
    else if (a >= 15 && a <= 18) total += n('benefits.family.ars_rate_15_18') * bmaf;
  }
  if (total === 0) return 0;
  if (rnc <= ceiling) return total;
  const diff = ceiling + total - rnc;
  return diff >= n('benefits.family.ars_minimum_paid') ? diff : 0;
}

/** Allocation de soutien familial: lone parent receiving no child support (assumed, as OpenFisca). */
export function asf(nChildrenUnder20: number, childSupportMonthly = 0): number {
  const amount = Math.max(
    0,
    n('benefits.family.asf_rate') * n('general.bmaf') * nChildrenUnder20 - childSupportMonthly,
  );
  return amount > n('benefits.family.asf_minimum_paid') ? amount : 0;
}

/** AEEH de base (not means-tested). Compléments (6 catégories) and the majoration parent isolé are not modelled. */
export function aeehBase(nAeehChildrenUnder20: number): number {
  return nAeehChildrenUnder20 * n('x.aeeh.base_rate') * n('general.bmaf');
}
