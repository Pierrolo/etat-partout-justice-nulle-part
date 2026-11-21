/**
 * Aide fondamentale universelle (PLF-P1 am. 28, version of 17–18 Nov 2026) — per member of the foyer fiscal, the
 * same total whether the couple is married or not.
 *
 * 6 600 €/an per adult, 3 300 €/an per dependent child until the year they turn 18, +6 600 € per holder of the CMI
 * « invalidité », and a MINORATION of 3 300 €/an per member holding a pension of a régime obligatoire:
 * - pension liquidated before 1 Jan 2028: the whole 3 300 €;
 * - pension liquidated from 1 Jan 2028: 3 300 € × (insurance duration validated before 1 Jan 2028 ÷ total insurance
 *   duration retained for the liquidation) — the text's rule « à défaut » of the decree. When the share is not
 *   given, the simulator assumes a full career of 172 quarters ending on 1 July of the start year (hypothesis).
 * The minoration applies until IR on 2051 incomes, i.e. in every simulated period.
 */
import { n } from '../params/index.ts';
import type { NAdult, NHousehold } from '../normalize.ts';

export interface PensionMinoration {
  /** adult index */
  index: number;
  startYear: number;
  /** share of the insurance duration validated before 1 Jan 2028 (1 for a pension liquidated before 2028) */
  share: number;
  /** where the share comes from: liquidated before 2028, declared by the user, or the simulator's default */
  shareSource: 'before_cutoff' | 'declared' | 'default';
  /** €/year subtracted from the AFU */
  annual: number;
}

export interface AfuBreakdown {
  /** persons ≥ 18 (adults + children aged 18–24, hypothesis H13) */
  nAdultParts: number;
  nChildParts: number;
  nInvalidity: number;
  /** number of members whose AFU is reduced for a pension (minoration > 0) */
  nPension: number;
  /** per pensioner: the minoration and its share (empty when nobody holds a pension) */
  pensions: PensionMinoration[];
  /** total €/year subtracted for pensions (≥ 0) */
  pensionMinorationAnnual: number;
  annual: number;
  /** annual AFU attributable to each adult (base + own supplements − own pension minoration) */
  perAdultAnnual: number[];
}

/** Default share validated before 1 Jan 2028 for a pension liquidated in `startYear` ≥ 2028 (hypothesis). */
export function defaultShareBefore2028(startYear: number): number {
  const cutoff = n('plan.afu_pension_cutoff_year');
  const total = n('plan.afu_pension_default_career_quarters');
  // liquidation on 1 July of the start year ⇒ 4 quarters per full year since the cutoff + 2
  const after = 4 * (startYear - cutoff) + 2;
  return Math.min(1, Math.max(0, (total - after) / total));
}

export function pensionMinorationOf(a: NAdult): PensionMinoration | null {
  const p = a.pension;
  if (p === null || p.amount <= 0) return null;
  const cutoff = n('plan.afu_pension_cutoff_year');
  const full = n('plan.afu_pension_minoration');
  let share: number;
  let shareSource: PensionMinoration['shareSource'];
  if (p.startYear < cutoff) {
    share = 1;
    shareSource = 'before_cutoff';
  } else if (p.shareBefore2028 !== null) {
    share = p.shareBefore2028;
    shareSource = 'declared';
  } else {
    share = defaultShareBefore2028(p.startYear);
    shareSource = 'default';
  }
  return { index: a.index, startYear: p.startYear, share, shareSource, annual: full * share };
}

export function afuOf(nh: NHousehold): AfuBreakdown {
  const adultAge = n('plan.afu_child_max_age');
  const kidsAdult = nh.children.filter((c) => c.age >= adultAge).length;
  const kidsChild = nh.children.length - kidsAdult;
  const invalidAdults = nh.adults.filter((a) => a.disability === 'aah_80').length;
  const invalidKids = nh.children.filter((c) => c.cmiInvalidite).length;
  const pensions = nh.adults
    .map(pensionMinorationOf)
    .filter((x): x is PensionMinoration => x !== null);
  const minoOf = (i: number) => pensions.find((p) => p.index === i)?.annual ?? 0;
  const pensionMinorationAnnual = pensions.reduce((s, p) => s + p.annual, 0);
  const nAdultParts = nh.adults.length + kidsAdult;
  const annual =
    n('plan.afu_adult') * nAdultParts +
    n('plan.afu_child') * kidsChild +
    n('plan.afu_invalidity') * (invalidAdults + invalidKids) -
    pensionMinorationAnnual;
  const perAdultAnnual = nh.adults.map(
    (a) =>
      n('plan.afu_adult') +
      (a.disability === 'aah_80' ? n('plan.afu_invalidity') : 0) -
      minoOf(a.index),
  );
  return {
    nAdultParts,
    nChildParts: kidsChild,
    nInvalidity: invalidAdults + invalidKids,
    nPension: pensions.filter((p) => p.annual > 0).length,
    pensions,
    pensionMinorationAnnual,
    annual,
    perAdultAnnual,
  };
}
