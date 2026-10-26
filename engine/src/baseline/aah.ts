/**
 * Allocation aux adultes handicapés (baseline-rules.md §7.11), individual since Oct 2023 (déconjugalisée).
 * Resources = own earnings after the 80 % / 40 % abattement (tranche limit 30 % of the gross SMIC) + own other
 * resources. Ceiling raised by 50 % per dependent child. Indicative (only the no-income case is oracle-checked).
 */
import { n } from '../params/index.ts';

export function aahMonthly(
  ownEarningsMonthly: number,
  otherResourcesMonthly: number,
  nChildren: number,
): { aah: number; resources: number } {
  const mx = n('benefits.aah.max_amount');
  const low =
    n('benefits.aah.earnings_low_tranche_smic_share') * n('general.smic_monthly_gross_35h');
  const e = Math.max(0, ownEarningsMonthly);
  const counted =
    Math.min(e, low) * (1 - n('benefits.aah.earnings_abattement_low_tranche')) +
    Math.max(0, e - low) * (1 - n('benefits.aah.earnings_abattement_high_tranche'));
  const resources = counted + Math.max(0, otherResourcesMonthly);
  const ceiling =
    nChildren > 0
      ? (n('benefits.aah.ceiling_annual_single') *
          (1 + n('benefits.aah.ceiling_per_child_increment') * nChildren)) /
        12
      : Infinity;
  return { aah: Math.max(0, Math.min(mx - resources, ceiling - resources, mx)), resources };
}
