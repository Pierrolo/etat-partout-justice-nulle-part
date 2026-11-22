/** ASPA (minimum vieillesse), baseline-rules.md §7.10 — couples partly validated only. */
import { n } from '../params/index.ts';

export function aspaMonthly(nEntitled: number, couple: boolean, resourcesMonthly: number): number {
  if (nEntitled <= 0) return 0;
  const single = n('benefits.aspa.max_monthly_single');
  const cpl = n('benefits.aspa.max_monthly_couple');
  if (!couple) return resourcesMonthly < single ? Math.max(0, single - resourcesMonthly) : 0;
  if (nEntitled === 1) return Math.min(single, Math.max(0, cpl - resourcesMonthly));
  return Math.max(0, cpl - resourcesMonthly);
}
