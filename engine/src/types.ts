/**
 * Public types of @epjn/engine — see docs/ENGINE-API.md (the contract).
 * All amounts are €/month unless suffixed `Annual`.
 */

/** The three epistemic tiers of every figure (VISION §2.3). */
export const TIERS = ['law', 'announced', 'hypothesis'] as const;
/**
 * - `law`        « Écrit dans la loi » — amendment text (or current law for the baseline).
 * - `announced`  « Annoncé par les auteurs » — fiches / manifesto / workbook, no legal text.
 * - `hypothesis` « Hypothèse du simulateur » — our choice where the text is silent.
 */
export type Tier = (typeof TIERS)[number];

export interface SourceRef {
  /** Short human label, e.g. « Amendement PLF-P1 n° 28 ». */
  label: string;
  url?: string;
}

export type Activity = 'salarie' | 'chomage' | 'retraite' | 'etudiant' | 'inactif';
export type SalaryStatus = 'prive' | 'cadre' | 'fonctionnaire';
/** aah_80 ⇒ CMI « invalidité » ⇒ plan supplement (+6 600 €/an). */
export type Disability = 'none' | 'aah_80' | 'aah_50_79';

export interface Adult {
  /** years */
  age: number;
  activity: Activity;
  /** Used when activity is 'salarie' (or 'etudiant' with a job). */
  salary?: { amount: number; basis: 'net' | 'brut'; status: SalaryStatus; workRatio?: number };
  /** Net monthly ARE actually received (indemnisé·e if > 0). Used when activity is 'chomage'. */
  unemployment?: { areMonthly: number };
  /** Used when activity is 'retraite'. */
  pension?: { amount: number; basis: 'net' | 'brut'; startYear: number };
  disability: Disability;
}

/** 18–24 = rattaché·e / à charge. */
export interface Child {
  age: number;
  aeeh?: boolean;
  /**
   * Engine extension (optional): the AEEH child holds the CMI « invalidité » (taux ≥ 80 %),
   * which opens the +6 600 € AFU supplement in the plan and the extra ½ part of today's quotient familial.
   * Only read when `aeeh` is true. Default: false (hypothesis H15 — the AEEH can be granted at 50–79 %).
   */
  cmiInvalidite?: boolean;
}

export type HousingStatus = 'locataire' | 'proprietaire' | 'proprietaire_credit' | 'gratuit';

export interface Household {
  adults: [Adult] | [Adult, Adult];
  /** only matters for today's IR (joint vs 2 foyers fiscaux) */
  marriedOrPacs: boolean;
  children: Child[];
  housing: {
    status: HousingStatus;
    /** hors charges */
    rentMonthly?: number;
    zone?: 1 | 2 | 3;
  };
  benefits: {
    /** « je ne touche pas ces aides » (RSA/PA/APL/AF… today) */
    nonRecours: boolean;
    /** single override of the computed total CAF today */
    cafOverrideMonthly?: number;
    /**
     * Engine extension (optional): lone parent separated recently (< 18 months) ⇒ RSA / prime
     * d'activité « majoré » even when the youngest child is 3 or older.
     */
    isolementRecent?: boolean;
  };
  extras?: {
    /** for children < 6 */
    childcare?: 'parent' | 'creche' | 'assistante_maternelle';
    childcareCostMonthly?: number;
    /** dépenses services à la personne */
    emploiDomicileAnnual?: number;
    donsAnnual?: number;
    /** for TVA; default derived from disposable income */
    consumptionMonthly?: number;
  };
}

export interface Hypotheses {
  /** default 'replaced' */
  H1_benefits: 'replaced' | 'differential';
  /** default true */
  H2_fraisPro10: boolean;
  /** default 1 */
  H5_tvaPassThrough: 0 | 0.5 | 1;
  /** default true (show TVA estimate lines) */
  includeTva: boolean;
}

/** 'steady' = « plan complet appliqué à 2026 ». */
export type Period = 'steady' | 2027 | 2028 | 2030;
export const PERIODS: readonly Period[] = ['steady', 2027, 2028, 2030];

export type ComponentGroup = 'revenus' | 'prelevements' | 'prestations' | 'impots_indirects';

export const COMPONENT_IDS = [
  'salaire_net',
  'are',
  'pension_nette',
  'impot_revenu',
  'credits_impot',
  'afu',
  'rsa',
  'prime_activite',
  'aides_logement',
  'allocations_familiales',
  'complement_familial',
  'paje_base',
  'ars',
  'asf',
  'aeeh',
  'aah',
  'aspa',
  'aides_caf_declarees',
  'tva',
  'cee',
] as const;
export type ComponentId = (typeof COMPONENT_IDS)[number];

export interface Component {
  /** STABLE across scenarios: same id in baseline & plan (amount 0 when absent). */
  id: ComponentId;
  /** French, user-facing */
  label: string;
  group: ComponentGroup;
  /** signed contribution to disposable income (taxes negative) */
  amount: number;
  /** French, rendered with the household's numbers, e.g. « 23 % × 1 820 € − 550 € » */
  formula: string;
  sources: SourceRef[];
  tier: Tier;
  personIndex?: number;
}

export interface PerAdultResult {
  gross: number;
  net: number;
  employerCost: number;
  csgCrds: number;
  cotisationsSalariales: number;
  cotisationsPatronales: number;
}

export interface ScenarioResult {
  /** === sum of components whose group is not 'impots_indirects' (to the cent). */
  disposable: number;
  /** disposable + sum of 'impots_indirects' components (TVA, CEE); === disposable when includeTva is false. */
  disposableAfterTva: number;
  components: Component[];
  /** total employer cost of salaried adults */
  employerCost: number;
  perAdult: PerAdultResult[];
  taxableIncomeAnnual: number;
}

export interface UnquantifiedItem {
  id: string;
  title: string;
  detail: string;
  tier: Tier;
  sources: SourceRef[];
  direction: 'promise' | 'loss';
  /** e.g. « 300 €/mois annoncés » — text, never summed */
  amountHint?: string;
}

export interface WaterfallStep {
  id: ComponentId;
  label: string;
  delta: number;
  tier: Tier;
  sources: SourceRef[];
  formulaBefore: string;
  formulaAfter: string;
}

export interface Comparison {
  baseline: ScenarioResult;
  plan: ScenarioResult;
  /** plan.disposable − baseline.disposable (headline) */
  delta: number;
  /** relative to baseline.disposable (0 when baseline.disposable ≤ 0) */
  deltaPct: number;
  deltaAfterTva: number;
  /** non-zero deltas, ordered: revenus, prélèvements, prestations, impôts indirects */
  waterfall: WaterfallStep[];
  /** filtered to the household */
  unquantified: { promises: UnquantifiedItem[]; losses: UnquantifiedItem[] };
  /** French bullet list relevant to this household */
  notModelled: string[];
  activeHypotheses: Array<{ id: string; label: string; value: string; tier: Tier }>;
  /** e.g. input out of modelled range */
  warnings: string[];
}

/** Internal reform switches (invariant 2: all false ⇒ plan ≡ baseline). */
export interface PlanSwitches {
  csgActivite: boolean;
  flatTaxAfu: boolean;
  pensionAbattement: boolean;
  prestationsFamiliales: boolean;
  aidesLogement: boolean;
  minimaSociaux: boolean;
  niches: boolean;
  tva: boolean;
  cee: boolean;
}

export interface SimulateOptions {
  period?: Period;
  hypotheses?: Partial<Hypotheses>;
  /** INTERNAL (tests): neutralise individual reform blocks of the plan. */
  __planSwitches?: Partial<PlanSwitches>;
}
