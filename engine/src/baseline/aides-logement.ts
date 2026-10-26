/**
 * APL / AL — private rented sector, simplified (baseline-rules.md §7.2), port of `apl()` in
 * scripts/baseline_reference.py (to the cent on the 16 golden renter cases).
 */
import { n, type ParamKey } from '../params/index.ts';
import { roundTo } from '../fmt.ts';

const A = 'benefits.housing_apl_private_rented.';
const k = (s: string) => (A + s) as ParamKey;

export interface AplResult {
  gross: number;
  /** resources R rounded up to the next 100 € */
  resources: number;
  rentRetained: number;
  charges: number;
  participation: number;
}

export function apl(
  zone: 1 | 2 | 3,
  couple: boolean,
  nChildren: number,
  rent: number,
  resourcesAnnual: number,
): AplResult {
  const ceilOf = (z: number): number => {
    const pre = `rent_ceiling_zone${z}_`;
    if (nChildren === 0) return n(k(pre + (couple ? 'couple' : 'single')));
    return n(k(pre + 'one_child')) + Math.max(0, nChildren - 1) * n(k(pre + 'per_extra_child'));
  };
  const l2 = ceilOf(zone);
  const lref = ceilOf(2);
  const L = Math.min(rent, l2);
  const C = n(k('charges_flat_base')) + n(k('charges_flat_per_child')) * nChildren;
  const step = n(k('resources_rounding'));
  const R = Math.ceil(roundTo(Math.max(0, resourcesAnnual), 2) / step) * step;
  const table = (prefix: string): number => {
    if (nChildren === 0) return n(k(prefix + (couple ? 'couple' : 'single')));
    if (nChildren <= 6) return n(k(`${prefix}${nChildren}_dependent${nChildren === 1 ? '' : 's'}`));
    return (
      n(k(prefix + '6_dependents')) + n(k(prefix + 'per_dependent_beyond_6')) * (nChildren - 6)
    );
  };
  const R0 = table('r0_');
  const TF = table('tf_');
  const rl = roundTo((100 * L) / lref, 2);
  const s1 = n(k('tl_threshold_1')) * 100;
  const s2 = n(k('tl_threshold_2')) * 100;
  const t2 = n(k('tl_rate_tranche_2'));
  const t3 = n(k('tl_rate_tranche_3'));
  const tlPct = rl >= s2 ? t3 * (rl - s2) + t2 * (s2 - s1) : Math.max(0, t2 * (rl - s1));
  const TL = roundTo(tlPct / 100, 5);
  const P0 = Math.max(n(k('p0_rate')) * (L + C), n(k('p0_minimum_amount')));
  const Pp = P0 + (TF + TL) * Math.max(0, R - R0);
  let al = Math.max(0, L + C - Pp);
  const d = zone === 1 ? n(k('degressivity_zone1_start')) : n(k('degressivity_zone23_start'));
  const s = zone === 1 ? n(k('degressivity_zone1_end')) : n(k('degressivity_zone23_end'));
  const ld = roundTo(l2 * d, 2);
  const ls = roundTo(l2 * s, 2);
  const coef = rent <= ld ? 1 : rent > ls ? 0 : 1 - (rent - ld) / (ls - ld);
  al = Math.max(0, roundTo(al * coef, 2) - n(k('flat_reduction')));
  if (al < n(k('minimum_paid_non_conventionne'))) al = 0;
  return { gross: al, resources: R, rentRetained: L, charges: C, participation: Pp };
}
