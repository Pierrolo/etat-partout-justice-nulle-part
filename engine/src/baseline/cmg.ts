/**
 * Complément de libre choix du mode de garde (CMG) of the PAJE — engine v1.1.
 *
 * - « Emploi direct », assistante maternelle (AM): linearised barème in force since 1 September 2025.
 *   CMG rémunération = H × T − H × R × te × T / Tref, with T the hourly rate (≤ 8 €/h), H the hours, R the monthly
 *   resources (RNC N-2 / 12, between a floor and a ceiling), te the taux d'effort of the PSU barème (by number of
 *   dependent children) and Tref the reference hourly rate. Since H × T is the monthly cost C, the amount is
 *   C × (1 − R × te / Tref) for any rate up to the cap: the simulator only needs the monthly cost. The « CMG
 *   cotisations » (100 % of the AM's social contributions, paid directly by Pajemploi) is not a cash flow of the
 *   household and is not modelled. Same formula for children aged 0–3 and 3–6.
 * - « Structure », micro-crèche PAJE: not reformed in 2025. Flat monthly maxima per child by resource tier
 *   (couple / parent isolé), halved from 3 to 6 years, capped at 85 % of the bill.
 * - Crèche PSU (municipal, associative): no CMG (the CAF funds the crèche directly through the PSU).
 */
import { n, pv } from '../params/index.ts';

export type CmgMode = 'assistante_maternelle' | 'micro_creche';

export interface CmgResult {
  amount: number;
  /** monthly resources retained (AM) */
  resources: number;
  /** taux d'effort (AM) */
  effortRate: number;
  /** share of the cost covered (AM) */
  coverage: number;
  /** resource tier 1..3 (structure) */
  tier: number;
}

export function effortRate(nDependentChildren: number): number {
  const rates = pv('x.cmg.effort_rates');
  const i = Math.min(Math.max(nDependentChildren, 1), rates.length) - 1;
  return rates[i]!;
}

/** CMG « emploi direct » for an assistante maternelle; `costMonthly` = net salary + indemnités (hors cotisations). */
export function cmgAssistanteMaternelle(
  costMonthly: number,
  nDependentChildren: number,
  rncAnnual: number,
): CmgResult {
  const R = Math.min(
    n('x.cmg.resources_ceiling'),
    Math.max(n('x.cmg.resources_floor'), rncAnnual / 12),
  );
  const te = effortRate(nDependentChildren);
  const coverage = Math.max(0, 1 - (R * te) / n('x.cmg.am_reference_hourly'));
  return {
    amount: Math.max(0, costMonthly) * coverage,
    resources: R,
    effortRate: te,
    coverage,
    tier: 0,
  };
}

/** CMG « structure » (micro-crèche) for the children under 6, the bill being shared equally between them. */
export function cmgMicroCreche(
  costMonthly: number,
  agesUnder6: number[],
  nDependentChildren: number,
  rncAnnual: number,
  loneParent: boolean,
): CmgResult {
  if (agesUnder6.length === 0)
    return { amount: 0, resources: 0, effortRate: 0, coverage: 0, tier: 0 };
  const c = loneParent
    ? pv('x.cmg.structure_ceilings_isole')
    : pv('x.cmg.structure_ceilings_couple');
  const amounts = loneParent
    ? pv('x.cmg.structure_amounts_isole')
    : pv('x.cmg.structure_amounts_couple');
  const extra = Math.max(0, nDependentChildren - 1);
  const t1 = c.t1 + c.t1PerChild * extra;
  const t2 = c.t2 + c.t2PerChild * extra;
  const tier = rncAnnual <= t1 ? 1 : rncAnnual <= t2 ? 2 : 3;
  const perChildCost = Math.max(0, costMonthly) / agesUnder6.length;
  let amount = 0;
  for (const age of agesUnder6) {
    const max = amounts[tier - 1]! * (age >= n('x.cmg.structure_half_from_age') ? 0.5 : 1);
    amount += Math.min(max, n('x.cmg.structure_max_share') * perChildCost);
  }
  return { amount, resources: rncAnnual, effortRate: 0, coverage: 0, tier };
}

/** Default monthly cost of a full-time crèche place at the PSU barème: 180 h × resources × taux d'effort. */
export function psuDefaultCost(
  nChildrenInCare: number,
  nDependentChildren: number,
  rncAnnual: number,
) {
  const R = Math.min(
    n('x.cmg.resources_ceiling'),
    Math.max(n('x.cmg.resources_floor'), rncAnnual / 12),
  );
  return nChildrenInCare * 180 * R * effortRate(nDependentChildren);
}
