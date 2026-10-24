/**
 * Table-driven rules per scenario and period. A period is 1 month (steady state / baseline) or the 12 months of a
 * calendar year (2027, 2028, 2030): every monthly flow is averaged over the year ("moyenne mensuelle"), the income
 * tax is computed once on the year's average taxable income under that year's tax rules.
 *
 * Dates (research/source-analysis.md §6, research/reform_parameters.json):
 * - CSG/CRDS on earned income: 9,2/0,5 % Jan–Jun 2027, then 7,6 / 6,0 / 4,3 / 2,7 / 1,1 % (CRDS 0,5 %) Jul–Nov,
 *   0 from 1 Dec 2027 (PLFSS am. 1). Deductible part = min(rate, 6,8 points) (CGI 154 quinquies, untouched).
 * - 10 % pension abattement: gone from IR on 2026 incomes (PLF-P1 am. 1 III 120°, IV.A — inferred) ⇒ every
 *   transition year is computed without it.
 * - Crédits garde d'enfants / emploi à domicile: 2/3 kept for 2027, 1/3 for 2028, 0 from 2029 (am. 1 IV.E);
 *   dons: halved from 1 Jul 2027, abolished from 1 Jan 2028 (am. 3 / IV.F).
 * - AFU + flat 23 % on 2028 incomes, end of the prestations familiales and of RSA/PA/AAH/ASPA (H1) on 1 Jan 2028.
 * - APL, existing lease (assumed conventioned-or-equivalent): amount frozen at Dec 2026, −1/3 from 1 Jul 2027,
 *   −2/3 from 1 Jul 2028, 0 from 1 Jul 2029 (PLF-P2 am. 32); all aides personnelles end 1 Jan 2030.
 * - TVA: reduced rates counted as tax expenditures → 20 % on 1 Jul 2027; other reduced rates → 20 % on
 *   1 Jul 2028; food 10 % (1 Jul 2028), 15 % (1 Jul 2029), 20 % (1 Jul 2030). CEE abrogated 1 Jul 2027.
 * - Pension CSG tier: N-2 RFR ⇒ today's tier in 2027 (RFR 2025); in 2028, RFR 2026 = today's barème without the
 *   10 % pension abattement; recomputed with the plan's taxable income (1 part per adult + ½ per child, art. 194
 *   being abrogated — hypothesis H16) in 2030 and steady state.
 */
import { CSG_NONE, CSG_TODAY, type CsgRates } from '../baseline/salaire.ts';
import { RATES_TODAY, TVA_NO_SHIFT, type TvaShift } from '../baseline/tva.ts';
import { ALL_SWITCHES_ON } from '../hypotheses.ts';
import { pv } from '../params/index.ts';
import type { Hypotheses, Period, PlanSwitches } from '../types.ts';

export interface MonthRules {
  csg: CsgRates;
  apl: { mode: 'computed' } | { mode: 'frozen'; factor: number };
  family: 'computed' | 'frozen' | 'abolished';
  minima: 'computed' | 'replaced' | 'differential';
  afu: boolean;
  tva: TvaShift;
  cee: boolean;
  /**
   * Pension CSG tier: 'fixedpoint' = RFR of the same year's rules (steady state, baseline, 2030 = RFR 2028);
   * 'frozen' = today's tier (2027 = RFR 2025); 'rfr2026' = RFR of 2026 incomes, i.e. today's barème WITHOUT the
   * 10 % pension abattement (gone from the IR on 2026 incomes) — used in 2028.
   */
  pensionTier: 'fixedpoint' | 'frozen' | 'rfr2026';
}

export interface YearRules {
  ir: 'bareme' | 'flat';
  pensionAbattement: boolean;
  /** 10 % frais professionnels in the flat regime (H2); always applied in the barème regime */
  fraisPro: boolean;
  /** share of each credit/reduction kept */
  credits: { garde: number; emploiDomicile: number; dons: number };
}

export interface Rules {
  months: MonthRules[];
  year: YearRules;
}

const BASE_MONTH: MonthRules = {
  csg: CSG_TODAY,
  apl: { mode: 'computed' },
  family: 'computed',
  minima: 'computed',
  afu: false,
  tva: TVA_NO_SHIFT,
  cee: false,
  pensionTier: 'fixedpoint',
};

export const BASELINE_RULES: Rules = {
  months: [BASE_MONTH],
  year: {
    ir: 'bareme',
    pensionAbattement: true,
    fraisPro: true,
    credits: { garde: 1, emploiDomicile: 1, dons: 1 },
  },
};

/**
 * H18: CGI art. 154 quinquies admits the CSG on earned income in deduction « à hauteur de 6,8 points » and no
 * amendment touches it, so while the rate falls the deductible part is min(rate, 6,8 %) (not a pro rata).
 */
function csg2027(month: number): CsgRates {
  const step = pv('plan.csg_activity_2027')[month]!;
  return { csg: step.csg, csgDed: Math.min(step.csg, CSG_TODAY.csgDed), crds: step.crds };
}

function aplFactor(year: number, month: number): number {
  const t = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  let f = 1;
  for (const s of pv('plan.apl_existing_factor')) if (t >= s.from) f = s.factor;
  if (year >= 2030) f = 0;
  return f;
}

function foodRate(year: number, month: number): number {
  const t = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  let r = RATES_TODAY.reduced;
  for (const s of pv('plan.tva_food_path')) if (t >= s.from) r = s.rate;
  return r;
}

function creditsFactor(year: number): { garde: number; emploiDomicile: number } {
  let f = 1;
  for (const s of pv('plan.niches_garde_emploi_domicile')) if (year >= s.year) f = s.factor;
  return { garde: f, emploiDomicile: f };
}

function donsFactor(year: number): number {
  // average over the 12 months of the year
  let sum = 0;
  for (let m = 0; m < 12; m++) {
    const t = `${year}-${String(m + 1).padStart(2, '0')}-01`;
    let f = 1;
    for (const s of pv('plan.niches_dons')) if (t >= s.from) f = s.factor;
    sum += f;
  }
  return sum / 12;
}

/** Steady state with explicit switches (identity when all are off). */
function steadyRules(h: Hypotheses, sw: PlanSwitches): Rules {
  const minima: MonthRules['minima'] = sw.minimaSociaux
    ? h.H1_benefits === 'replaced'
      ? 'replaced'
      : 'differential'
    : 'computed';
  const month: MonthRules = {
    csg: sw.csgActivite ? CSG_NONE : CSG_TODAY,
    apl: sw.aidesLogement ? { mode: 'frozen', factor: 0 } : { mode: 'computed' },
    family: sw.prestationsFamiliales ? 'abolished' : 'computed',
    minima,
    afu: sw.flatTaxAfu,
    tva: sw.tva ? { niche: true, nonFood: true, foodRate: 0.2 } : TVA_NO_SHIFT,
    cee: sw.cee,
    pensionTier: 'fixedpoint',
  };
  return {
    months: [month],
    year: {
      ir: sw.flatTaxAfu ? 'flat' : 'bareme',
      pensionAbattement: !sw.pensionAbattement,
      fraisPro: sw.flatTaxAfu ? h.H2_fraisPro10 : true,
      credits: sw.niches
        ? { garde: 0, emploiDomicile: 0, dons: 0 }
        : { garde: 1, emploiDomicile: 1, dons: 1 },
    },
  };
}

function yearRules(year: 2027 | 2028 | 2030, h: Hypotheses, sw: PlanSwitches): Rules {
  const any = Object.values(sw).some(Boolean);
  const minimaOn: MonthRules['minima'] = h.H1_benefits === 'replaced' ? 'replaced' : 'differential';
  const afuYear = year >= 2028;
  const months: MonthRules[] = [];
  for (let m = 0; m < 12; m++) {
    months.push({
      csg: !sw.csgActivite ? CSG_TODAY : year === 2027 ? csg2027(m) : CSG_NONE,
      apl: sw.aidesLogement ? { mode: 'frozen', factor: aplFactor(year, m) } : { mode: 'computed' },
      family: !sw.prestationsFamiliales ? 'computed' : afuYear ? 'abolished' : 'frozen',
      minima: sw.minimaSociaux && afuYear ? minimaOn : 'computed',
      afu: sw.flatTaxAfu && afuYear,
      tva: sw.tva
        ? {
            niche: year > 2027 || m >= 6,
            nonFood: year > 2028 || (year === 2028 && m >= 6),
            foodRate: foodRate(year, m),
          }
        : TVA_NO_SHIFT,
      cee: sw.cee && (year > 2027 || m >= 6),
      pensionTier: !any
        ? 'fixedpoint'
        : year === 2027 || (year === 2028 && !sw.pensionAbattement)
          ? 'frozen'
          : year === 2028
            ? 'rfr2026'
            : 'fixedpoint',
    });
  }
  const cf = creditsFactor(year);
  return {
    months,
    year: {
      ir: sw.flatTaxAfu && afuYear ? 'flat' : 'bareme',
      pensionAbattement: !sw.pensionAbattement,
      fraisPro: sw.flatTaxAfu && afuYear ? h.H2_fraisPro10 : true,
      credits: sw.niches
        ? { ...cf, dons: donsFactor(year) }
        : { garde: 1, emploiDomicile: 1, dons: 1 },
    },
  };
}

export function planRules(period: Period, h: Hypotheses, switches?: Partial<PlanSwitches>): Rules {
  const sw: PlanSwitches = { ...ALL_SWITCHES_ON, ...(switches ?? {}) };
  if (period === 'steady') return steadyRules(h, sw);
  return yearRules(period, h, sw);
}

export const PERIOD_LABEL: Record<string, string> = {
  steady: 'plan complet appliqué à 2026',
  '2027': 'année 2027 (moyenne mensuelle)',
  '2028': 'année 2028 (moyenne mensuelle)',
  '2030': 'année 2030 (moyenne mensuelle)',
};
