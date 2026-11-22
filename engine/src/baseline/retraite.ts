/** Pensions gross → net (baseline-rules.md §4): CSG tier set by the RFR (N-2, steady state) and the number of parts. */
import { n, pv } from '../params/index.ts';

export type PensionTier = 'zero' | 'reduced' | 'median' | 'full';

export interface PensionRates {
  csg: number;
  csgDed: number;
  crds: number;
  casa: number;
}

export function pensionRates(tier: PensionTier): PensionRates {
  switch (tier) {
    case 'zero':
      return { csg: 0, csgDed: 0, crds: 0, casa: 0 };
    case 'reduced':
      return {
        csg: n('pensions.csg_rate_reduced'),
        csgDed: n('pensions.csg_deductible_reduced'),
        crds: n('pensions.crds'),
        casa: 0,
      };
    case 'median':
      return {
        csg: n('pensions.csg_rate_median'),
        csgDed: n('pensions.csg_deductible_median'),
        crds: n('pensions.crds'),
        casa: n('pensions.casa'),
      };
    case 'full':
      return {
        csg: n('pensions.csg_rate_full'),
        csgDed: n('pensions.csg_deductible_full'),
        crds: n('pensions.crds'),
        casa: n('pensions.casa'),
      };
  }
}

export function pensionTotalRate(tier: PensionTier): number {
  const r = pensionRates(tier);
  return r.csg + r.crds + r.casa;
}

export function pensionTierFor(rfr: number, parts: number): PensionTier {
  const th = pv('pensions.csg_rfr_thresholds_1_part');
  const inc = pv('pensions.csg_rfr_increment_half_part');
  const k = (parts - 1) * 2;
  if (rfr <= th.exempt_up_to + k * inc.exempt_limit) return 'zero';
  if (rfr <= th.reduced_up_to + k * inc.reduced_limit) return 'reduced';
  if (rfr <= th.median_up_to + k * inc.median_limit) return 'median';
  return 'full';
}

export interface PensionResult {
  gross: number;
  tier: PensionTier;
  csg: number;
  csgDed: number;
  crds: number;
  casa: number;
  net: number;
  taxable: number;
}

export function pensionChain(gross: number, tier: PensionTier): PensionResult {
  const r = pensionRates(tier);
  const p = Math.max(0, gross);
  return {
    gross: p,
    tier,
    csg: r.csg * p,
    csgDed: r.csgDed * p,
    crds: r.crds * p,
    casa: r.casa * p,
    net: p * (1 - r.csg - r.crds - r.casa),
    taxable: p * (1 - r.csgDed),
  };
}

export const TIER_LABEL: Record<PensionTier, string> = {
  zero: 'exonéré',
  reduced: 'taux réduit (4,3 %)',
  median: 'taux médian (7,4 %)',
  full: 'taux plein (9,1 %)',
};
