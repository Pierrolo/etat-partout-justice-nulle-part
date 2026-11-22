/**
 * TVA — smooth fixed-basket estimate (VISION H5; replaces the decile table of baseline-rules.md §9 to avoid cliffs).
 *
 *   niveau de vie  nv = 12 × disposable / UC (INSEE UC: 1 + 0,5 per other person ≥ 14 + 0,3 per child < 14)
 *   consumption    C  = disposable × c(nv),  c(nv) = 0,72 + (0,97 − 0,72) / (1 + (nv / 25 760)^4)
 *                  (CPO 2023: consumption = 97 % of disposable income for D1-D2, 72 % for D9-D10; smooth logistic)
 *   basket shares  s_20 = 52,2 %, s_10 = 13,3 % × (1 − 0,10·t), s_5,5 = 15,4 % × (1 + 0,25·t), s_2,1 = 0,6 %,
 *                  t = tanh(ln(25 760 / nv)) ∈ (−1, 1)   (INSEE ES 522-523 national shares; tilt = hypothesis)
 *   TVA today      C × Σ s_k τ_k / (1 + τ_k)          (national check: 10,7 % of consumption, INSEE 10,73 %)
 *   plan           same basket C (first-order, fixed basket), prices × (1 + passThrough × (τ'_k − τ_k)/(1 + τ_k))
 * The basket is computed ONCE from today's disposable income and used for both scenarios.
 */
import { n } from '../params/index.ts';

export interface Basket {
  consumption: number;
  nv: number;
  uc: number;
  propensity: number;
  shares: { normal: number; intermediate: number; reduced: number; particular: number };
  userProvided: boolean;
}

export const RATES_TODAY = { normal: 0.2, intermediate: 0.1, reduced: 0.055, particular: 0.021 };

export function consumptionUnits(nAdults: number, childAges: number[]): number {
  let uc = 1 + 0.5 * (nAdults - 1);
  for (const a of childAges) uc += a >= 14 ? 0.5 : 0.3;
  return uc;
}

export function propensity(nv: number): number {
  const lo = n('x.tva.propensity_low');
  const hi = n('x.tva.propensity_high');
  const mid = n('x.tva.nv_mid');
  const k = n('x.tva.propensity_steepness');
  return hi + (lo - hi) / (1 + (Math.max(nv, 0) / mid) ** k);
}

export function basketShares(nv: number) {
  const mid = n('x.tva.nv_mid');
  const t = Math.tanh(Math.log(mid / Math.max(nv, 1)));
  return {
    normal: n('x.tva.share_normal'),
    intermediate: n('x.tva.share_intermediate') * (1 + n('x.tva.intermediate_tilt') * t),
    reduced: n('x.tva.share_reduced') * (1 + n('x.tva.reduced_tilt') * t),
    particular: n('x.tva.share_particular'),
  };
}

export function makeBasket(
  disposableMonthly: number,
  uc: number,
  userConsumption: number | null,
): Basket {
  const nv = (12 * Math.max(0, disposableMonthly)) / uc;
  const p = propensity(nv);
  const consumption =
    userConsumption !== null ? userConsumption : Math.max(0, disposableMonthly) * p;
  return {
    consumption,
    nv,
    uc,
    propensity: p,
    shares: basketShares(nv),
    userProvided: userConsumption !== null,
  };
}

export function tvaToday(b: Basket): number {
  const s = b.shares;
  const r = RATES_TODAY;
  return (
    b.consumption *
    (s.normal * (r.normal / (1 + r.normal)) +
      s.intermediate * (r.intermediate / (1 + r.intermediate)) +
      s.reduced * (r.reduced / (1 + r.reduced)) +
      s.particular * (r.particular / (1 + r.particular)))
  );
}

/** State of the reduced rates in a given month of the plan. */
export interface TvaShift {
  /** non-food reduced rates counted as tax expenditures (share x.tva.niche_share_of_nonfood_gap) moved to 20 % */
  niche: boolean;
  /** the other non-food reduced rates moved to 20 % */
  nonFood: boolean;
  /** VAT rate on food (5,5 % today) */
  foodRate: number;
}
export const TVA_NO_SHIFT: TvaShift = {
  niche: false,
  nonFood: false,
  foodRate: RATES_TODAY.reduced,
};

/** Monthly extra cost of the same basket when prices pass through `passThrough` of the VAT increase. */
export function tvaExtraCost(b: Basket, shift: TvaShift, passThrough: number): number {
  const s = b.shares;
  const r = RATES_TODAY;
  const nu = n('x.tva.niche_share_of_nonfood_gap');
  const moved = (shift.niche ? nu : 0) + (shift.nonFood ? 1 - nu : 0);
  const phi = n('x.tva.food_share_of_reduced');
  const up = (from: number, to: number) => (to - from) / (1 + from);
  const nonFood =
    moved *
    (s.intermediate * up(r.intermediate, 0.2) +
      s.reduced * (1 - phi) * up(r.reduced, 0.2) +
      s.particular * up(r.particular, 0.2));
  const food = s.reduced * phi * up(r.reduced, shift.foodRate);
  return passThrough * b.consumption * (nonFood + food);
}

/** Monthly gain from the end of the CEE (energy bills fall by their cost), per household scaled by UC. */
export function ceeGain(uc: number, passThrough: number): number {
  return (
    (passThrough *
      (n('x.cee.cost_annual') / n('x.cee.households')) *
      (uc / n('x.cee.uc_average'))) /
    12
  );
}
