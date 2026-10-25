/**
 * Public types of @epjn/engine — see docs/ENGINE-API.md (the contract).
 * All amounts are €/month unless suffixed `Annual`.
 */

/** The three epistemic tiers of every figure (VISION §2.3). */
export const TIERS = ['law', 'announced', 'hypothesis'] as const;
/**
 * - `law`        « Écrit dans la loi » — amendment text (or current law for the baseline).
 * - `announced`  « Annoncé » — fiches / manifesto / workbook, no legal text.
 * - `hypothesis` « Hypothèse du simulateur » — our choice where the text is silent.
 */
export type Tier = (typeof TIERS)[number];

export interface SourceRef {
  /** Short human label, e.g. « Amendement PLF-P1 n° 28 ». */
  label: string;
  url?: string;
}

export type Activity = 'salarie' | 'chomage' | 'retraite' | 'etudiant' | 'inactif';
/**
 * v1.1: 'dirigeant_assimile' = président·e de SAS/SASU, gérant·e minoritaire ou égalitaire de SARL (assimilé·e
 * salarié·e: no unemployment insurance, otherwise like a cadre); 'tns' = travailleur non salarié (gérant·e
 * majoritaire, indépendant·e, micro-entrepreneur·e) — NOT modelled: the income is ignored and a warning is returned.
 */
export type SalaryStatus = 'prive' | 'cadre' | 'fonctionnaire' | 'dirigeant_assimile' | 'tns';
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
    /**
     * v1.1: child support (pension alimentaire) received, €/month. Default: not received (the ASF is then paid
     * in full to a lone parent). The ASF is differential: ASF − child support, nothing at or above its amount.
     * Counted as a resource for the RSA and the prime d'activité; not added to disposable income (identical in
     * both scenarios; its taxation is not modelled).
     */
    childSupportReceivedMonthly?: number;
  };
  extras?: {
    /**
     * for children < 6. v1.1 adds 'micro_creche' (micro-crèche PAJE, CMG « structure »). 'creche' = crèche PSU
     * (municipal / associative): no CMG.
     */
    childcare?: 'parent' | 'creche' | 'assistante_maternelle' | 'micro_creche';
    /**
     * Total monthly childcare bill for the children < 6 (net salary + indemnités for an assistante maternelle,
     * hors cotisations). v1.1: when missing, a documented default is used and a warning says so.
     */
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
  'cmg',
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
  /** v1.1: short plain-language title (always set by the engine). */
  plainTitle?: string;
  /**
   * v1.1: true when the item could plausibly exceed ~50 €/month for THIS household (always set by the engine):
   * show it next to the headline.
   */
  prominent?: boolean;
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
  /**
   * relative to baseline.disposable. v1.1: `null` when baseline.disposable ≤ 50 €/month (a percentage of almost
   * nothing is meaningless: « +560 € / 0,0 % »). Was `number` (0) in 1.0.
   */
  deltaPct: number | null;
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
  /** v1.1: plain-language summary for a non-expert (top gains and losses, main driver, certainty). */
  summary: Summary;
  /** v1.1: today's main benefits, including those at 0 € with the rule that zeroed them. */
  baselineBenefitsExplained: BenefitExplained[];
  /**
   * v1.1: the other reading of H1 (RSA, prime d'activité, AAH, ASPA replaced vs kept in differential) when it
   * changes the headline by more than 5 €/month for this household; absent otherwise.
   */
  h1Alternative?: { hypothesis: 'differential' | 'replaced'; delta: number; deltaAfterTva: number };
  /**
   * v1.1: present when part of the household is outside the model (e.g. a 'tns' adult): the result does not
   * describe this household and the UI should say so before showing any figure.
   */
  unsupported?: string[];
}

export interface SummaryLine {
  /** plain French, acronyms expanded */
  label: string;
  /** €/month, signed (gains > 0, losses < 0), rounded to the cent */
  amount: number;
}

export interface Summary {
  /** one or two sentences, e.g. « Avec le plan complet, votre ménage aurait environ 945 € de plus par mois. » */
  sentence: string;
  /** top 3 gains by absolute monthly amount (waterfall steps > 0, TVA lines included when shown) */
  gains: SummaryLine[];
  /** top 3 losses by absolute monthly amount */
  losses: SummaryLine[];
  /** one line naming the main driver */
  why: string;
  /** which part is written in the proposed amendments, announced without text, or estimated by us */
  certainty: string;
}

export interface BenefitExplained {
  id: ComponentId;
  /** plain label */
  label: string;
  /** today's monthly amount (the baseline component amount) */
  amount: number;
  /** plain one-line reason, set when amount is 0 (computed from the rule that zeroed it) */
  reason?: string;
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
