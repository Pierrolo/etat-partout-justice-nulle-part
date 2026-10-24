/** Aide fondamentale universelle (PLF-P1 am. 28) — per person, independent of marital status. */
import { n } from '../params/index.ts';
import type { NHousehold } from '../normalize.ts';

export interface AfuBreakdown {
  /** persons ≥ 18 (adults + children aged 18–24, hypothesis H13) */
  nAdultParts: number;
  nChildParts: number;
  nInvalidity: number;
  nPension: number;
  annual: number;
  /** annual AFU attributable to each adult (base + own supplements) */
  perAdultAnnual: number[];
}

export function afuOf(nh: NHousehold): AfuBreakdown {
  const adultAge = n('plan.afu_child_max_age');
  const cutoff = n('plan.afu_pension_cutoff_year');
  const kidsAdult = nh.children.filter((c) => c.age >= adultAge).length;
  const kidsChild = nh.children.length - kidsAdult;
  const invalidAdults = nh.adults.filter((a) => a.disability === 'aah_80').length;
  const invalidKids = nh.children.filter((c) => c.cmiInvalidite).length;
  const pensioners = nh.adults.filter(
    (a) => a.pension !== null && a.pension.amount > 0 && a.pension.startYear < cutoff,
  ).length;
  const nAdultParts = nh.adults.length + kidsAdult;
  const annual =
    n('plan.afu_adult') * nAdultParts +
    n('plan.afu_child') * kidsChild +
    n('plan.afu_invalidity') * (invalidAdults + invalidKids) +
    n('plan.afu_pension') * pensioners;
  const perAdultAnnual = nh.adults.map(
    (a) =>
      n('plan.afu_adult') +
      (a.disability === 'aah_80' ? n('plan.afu_invalidity') : 0) +
      (a.pension !== null && a.pension.amount > 0 && a.pension.startYear < cutoff
        ? n('plan.afu_pension')
        : 0),
  );
  return {
    nAdultParts,
    nChildParts: kidsChild,
    nInvalidity: invalidAdults + invalidKids,
    nPension: pensioners,
    annual,
    perAdultAnnual,
  };
}
