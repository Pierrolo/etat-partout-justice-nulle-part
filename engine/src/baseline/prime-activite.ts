/** Prime d'activité (baseline-rules.md §7.9) — port of scripts/baseline_reference.py. */
import { n } from '../params/index.ts';
import { forfait, housingFlatRate } from './rsa.ts';

export interface PaResult {
  pa: number;
  forfait: number;
  bonification: number;
  fl: number;
  earnings: number;
  resources: number;
}

export function primeActivite(
  nAdults: number,
  nChildren: number,
  earningsEach: number[],
  otherResources: number,
  aplGross: number,
  ownerOrFree: boolean,
  majoration: boolean,
): PaResult {
  const pre = 'benefits.prime_activite.';
  const base = n('benefits.prime_activite.base_amount_single');
  const f = forfait(pre, nAdults, nChildren, majoration);
  const fl = housingFlatRate(pre, base, nAdults + nChildren, aplGross, ownerOrFree);
  const h = n('general.smic_hourly_gross');
  const bmax = Math.round(n('benefits.prime_activite.bonification_max_rate') * base * 100) / 100;
  const s1 = n('benefits.prime_activite.bonification_start_hours') * h;
  const s2 = n('benefits.prime_activite.bonification_full_hours') * h;
  const bonif = earningsEach.reduce(
    (s, e) => s + Math.min(Math.max((bmax * (e - s1)) / (s2 - s1), 0), bmax),
    0,
  );
  const earn = earningsEach.reduce((s, e) => s + e, 0);
  let m =
    f +
    bonif +
    n('benefits.prime_activite.earnings_rate') * earn -
    Math.max(earn + otherResources + fl, f);
  m = Math.max(0, m);
  return {
    pa: m >= n('benefits.prime_activite.minimum_paid') ? m : 0,
    forfait: f,
    bonification: bonif,
    fl,
    earnings: earn,
    resources: otherResources,
  };
}
