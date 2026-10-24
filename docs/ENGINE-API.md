# Engine API contract (`@epjn/engine`)

Owner: orchestrator. The engine builder implements it; the simulator UI builder codes against it. Changes to this contract must be reflected here first.

All amounts **€/month** unless suffixed `Annual`. Pure functions, no I/O, no `Date`. Deterministic.

## Inputs

```ts
export type Activity = 'salarie' | 'chomage' | 'retraite' | 'etudiant' | 'inactif';
export type SalaryStatus = 'prive' | 'cadre' | 'fonctionnaire';
export type Disability = 'none' | 'aah_80' | 'aah_50_79'; // aah_80 ⇒ CMI « invalidité » ⇒ plan supplement

export interface Adult {
  age: number;                       // years
  activity: Activity;
  salary?: { amount: number; basis: 'net' | 'brut'; status: SalaryStatus; workRatio?: number /* 0..1, default 1 */ };
  unemployment?: { areMonthly: number };            // indemnisé·e if > 0
  pension?: { amount: number; basis: 'net' | 'brut'; startYear: number };
  disability: Disability;
}
export interface Child { age: number; aeeh?: boolean }   // 18–24 = rattaché·e / à charge

export interface Household {
  adults: [Adult] | [Adult, Adult];
  marriedOrPacs: boolean;            // only matters for today's IR (joint vs 2 foyers fiscaux)
  children: Child[];
  housing: {
    status: 'locataire' | 'proprietaire' | 'proprietaire_credit' | 'gratuit';
    rentMonthly?: number;            // hors charges
    zone?: 1 | 2 | 3;
  };
  benefits: {
    nonRecours: boolean;             // « je ne touche pas ces aides » (RSA/PA/APL/AF… today)
    cafOverrideMonthly?: number;     // single override of the computed total CAF today
  };
  extras?: {
    childcare?: 'parent' | 'creche' | 'assistante_maternelle'; // for children < 6
    childcareCostMonthly?: number;
    emploiDomicileAnnual?: number;   // dépenses services à la personne
    donsAnnual?: number;
    consumptionMonthly?: number;     // for TVA; default derived from disposable income
  };
}

export interface Hypotheses {
  H1_benefits: 'replaced' | 'differential';     // default 'replaced'
  H2_fraisPro10: boolean;                       // default true
  H5_tvaPassThrough: 0 | 0.5 | 1;               // default 1
  includeTva: boolean;                          // default true (show TVA estimate lines)
}
export const DEFAULT_HYPOTHESES: Hypotheses;

export type Period = 'steady' | 2027 | 2028 | 2030;   // 'steady' = « plan complet appliqué à 2026 »
```

## Outputs

```ts
export type Tier = 'law' | 'announced' | 'hypothesis';
export interface SourceRef { label: string; url?: string }

export type ComponentGroup = 'revenus' | 'prelevements' | 'prestations' | 'impots_indirects';

export interface Component {
  id: ComponentId;                 // STABLE across scenarios: same id in baseline & plan (amount 0 when absent)
  label: string;                   // French, user-facing
  group: ComponentGroup;
  amount: number;                  // signed contribution to disposable income (taxes negative)
  formula: string;                 // French, rendered with the household's numbers, e.g. « 23 % × 1 820 € − 550 € »
  sources: SourceRef[];
  tier: Tier;
  personIndex?: number;            // when per adult
}
// ComponentId examples: 'salaire_net', 'pension_nette', 'are', 'impot_revenu', 'afu', 'rsa', 'prime_activite',
// 'aides_logement', 'allocations_familiales', 'complement_familial', 'paje_base', 'ars', 'asf', 'aeeh', 'aah', 'aspa', 'tva'

export interface ScenarioResult {
  disposable: number;              // === sum(components.amount) (excluding tva unless includeTva) — see `disposableAfterTva`
  disposableAfterTva: number;
  components: Component[];
  employerCost: number;            // total employer cost of salaried adults
  perAdult: Array<{ gross: number; net: number; employerCost: number; csgCrds: number; cotisationsSalariales: number; cotisationsPatronales: number }>;
  taxableIncomeAnnual: number;
}

export interface UnquantifiedItem {
  id: string; title: string; detail: string; tier: Tier; sources: SourceRef[];
  direction: 'promise' | 'loss';
  amountHint?: string;             // e.g. « 300 €/mois annoncés » — text, never summed
}

export interface Comparison {
  baseline: ScenarioResult;
  plan: ScenarioResult;
  delta: number;                   // plan.disposable − baseline.disposable (headline)
  deltaPct: number;                // relative to baseline.disposable
  deltaAfterTva: number;
  waterfall: Array<{ id: ComponentId; label: string; delta: number; tier: Tier; sources: SourceRef[]; formulaBefore: string; formulaAfter: string }>; // non-zero deltas, ordered: revenus, prélèvements, prestations, impôts indirects
  unquantified: { promises: UnquantifiedItem[]; losses: UnquantifiedItem[] }; // filtered to the household
  notModelled: string[];           // French bullet list relevant to this household
  activeHypotheses: Array<{ id: string; label: string; value: string; tier: Tier }>;
  warnings: string[];              // e.g. input out of modelled range
}

export function compare(h: Household, opts?: { period?: Period; hypotheses?: Partial<Hypotheses> }): Comparison;
export function simulate(h: Household, scenario: 'baseline' | 'plan', opts?: { period?: Period; hypotheses?: Partial<Hypotheses> }): ScenarioResult;

/** « Si je gagnais plus ? » — vary the first adult's salary. x = net monthly salary TODAY (what users know). */
export function earningsCurve(h: Household, opts?: { hypotheses?: Partial<Hypotheses>; maxNet?: number; step?: number }):
  Array<{ netToday: number; gross: number; baseline: number; plan: number; mtrBaseline: number; mtrPlan: number }>;

/** « Votre heure de travail » — for a salaried adult: per hour of labour cost, where the money goes. */
export function hourOfWork(h: Household, adultIndex?: number, opts?: { hypotheses?: Partial<Hypotheses> }): {
  hoursPerMonth: number;
  baseline: { employerCostPerHour: number; cotisationsPatronales: number; cotisationsSalariales: number; csgCrds: number; impotRevenu: number; tva: number; youKeep: number };
  plan:     { employerCostPerHour: number; cotisationsPatronales: number; cotisationsSalariales: number; csgCrds: number; impotRevenu: number; tva: number; youKeep: number };
  // impotRevenu in plan = gross 23 % tax share before AFU (the AFU is shown separately as a per-person transfer, not per hour)
};

/** Standard households for the « Qui gagne, qui perd ? » heatmap. */
export const CAS_TYPES: Array<{ id: string; label: string; family: string; household: Household }>;

/** URL hash state (versioned, compact, round-trip safe). */
export function encodeState(h: Household, hyp: Hypotheses, period: Period): string;  // e.g. 'v1.<base64url>'
export function decodeState(s: string): { household: Household; hypotheses: Hypotheses; period: Period } | null;

export const PARAMS_META: { baselineYear: string; planSource: string; engineVersion: string };
```

## Invariants (tested)
1. `sum(components.amount) === disposable` (to the cent), both scenarios.
2. Plan with every reform switch neutralised ≡ baseline (identity test; internal `__planSwitches`).
3. Baseline reproduces `research/baseline/golden-cases.json` within documented tolerance.
4. Plan reproduces the book's cas types (CSG gain at SMIC 2025 = 171,72 €/mois; GraphIR table with H2 off; 1 100 €/mois disabled adult (CMI); break-even 28 695,65 € with H2 off).
5. Steady-state plan: marginal retention ≥ 0,77 − ε on net earnings (no cliffs) under default hypotheses.
6. Plan side independent of `marriedOrPacs`.
7. `decodeState(encodeState(x))` deep-equals x (fast-check).
