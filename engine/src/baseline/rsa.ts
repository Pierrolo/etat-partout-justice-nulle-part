/** RSA (baseline-rules.md §7.8) and shared RSA/PA helpers — port of scripts/baseline_reference.py. */
import { n, type ParamKey } from '../params/index.ts';

export type MinimaPrefix = 'benefits.rsa.' | 'benefits.prime_activite.';
const k = (pre: MinimaPrefix, s: string) => (pre + s) as ParamKey;

/** Couple/household factor f(np): 1, 1.5, 1.8, 2.1, +0.4 per person from the 5th. */
export function householdFactor(np: number, pre: MinimaPrefix): number {
  let f = 1;
  if (np >= 2) f = n(k(pre, 'household_factor_2_persons'));
  if (np >= 3) f = n(k(pre, 'household_factor_3_persons'));
  if (np >= 4) f = n(k(pre, 'household_factor_4_persons'));
  if (np >= 5) f += n(k(pre, 'household_factor_per_additional_person_from_5')) * (np - 4);
  return f;
}

/** Forfait logement: owners without loan / housed for free: full; tenants: min(housing aid, forfait); else 0. */
export function housingFlatRate(
  pre: MinimaPrefix,
  base: number,
  np: number,
  aplGross: number,
  ownerOrFree: boolean,
): number {
  const rate =
    np === 1
      ? n(k(pre, 'housing_flat_rate_1_person'))
      : np === 2
        ? n(k(pre, 'housing_flat_rate_2_persons'))
        : n(k(pre, 'housing_flat_rate_3_plus'));
  const g =
    np === 1
      ? 1
      : np === 2
        ? n(k(pre, 'household_factor_2_persons'))
        : n(k(pre, 'household_factor_3_persons'));
  const forfait = rate * base * g;
  if (ownerOrFree) return forfait;
  return aplGross > 0 ? Math.min(aplGross, forfait) : 0;
}

export function forfait(
  pre: MinimaPrefix,
  nAdults: number,
  nChildren: number,
  majoration: boolean,
): number {
  const base = n(k(pre, 'base_amount_single'));
  let f = base * householdFactor(nAdults + nChildren, pre);
  if (majoration && nAdults === 1)
    f = Math.max(
      f,
      base *
        (n(k(pre, 'lone_parent_base_rate')) + n(k(pre, 'lone_parent_per_child_rate')) * nChildren),
    );
  return f;
}

export interface RsaResult {
  rsa: number;
  socle: number;
  fl: number;
  resources: number;
}

export function rsa(
  nAdults: number,
  nChildren: number,
  earnings: number,
  otherResources: number,
  aplGross: number,
  ownerOrFree: boolean,
  majoration: boolean,
): RsaResult {
  const pre = 'benefits.rsa.';
  const base = n('benefits.rsa.base_amount_single');
  const socle = forfait(pre, nAdults, nChildren, majoration);
  const fl = housingFlatRate(pre, base, nAdults + nChildren, aplGross, ownerOrFree);
  const resources = earnings + otherResources;
  const m = Math.max(0, socle - fl - resources);
  return { rsa: m >= n('benefits.rsa.minimum_paid') ? m : 0, socle, fl, resources };
}
