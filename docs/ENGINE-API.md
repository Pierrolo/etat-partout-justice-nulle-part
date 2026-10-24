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
export interface Child { age: number; aeeh?: boolean; cmiInvalidite?: boolean /* added: read only when aeeh; DEFAULT FALSE since the audit (H15) */ }   // 18–24 = rattaché·e / à charge

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
    isolementRecent?: boolean;       // added: lone parent separated < 18 months ⇒ RSA/PA « majorés »
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
// ComponentId (exported as COMPONENT_IDS, always all present in this order, amount 0 when absent):
// 'salaire_net', 'are', 'pension_nette', 'impot_revenu', 'credits_impot', 'afu', 'rsa', 'prime_activite',
// 'aides_logement', 'allocations_familiales', 'complement_familial', 'paje_base', 'ars', 'asf', 'aeeh', 'aah', 'aspa',
// 'aides_caf_declarees', 'tva', 'cee'   (group 'impots_indirects' = tva + cee)

export interface ScenarioResult {
  disposable: number;              // === sum of components whose group !== 'impots_indirects' (to the cent)
  disposableAfterTva: number;      // === disposable + sum('impots_indirects' components); === disposable when includeTva is false
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
export function simulate(h: Household, scenario: 'baseline' | 'plan', opts?: { period?: Period; hypotheses?: Partial<Hypotheses>; __planSwitches?: Partial<PlanSwitches> /* internal, tests */ }): ScenarioResult;

/** « Si je gagnais plus ? » — vary the first adult's salary. x = net monthly salary TODAY (what users know). */
export function earningsCurve(h: Household, opts?: { hypotheses?: Partial<Hypotheses>; maxNet?: number; step?: number }):
  Array<{ netToday: number; gross: number; baseline: number; plan: number; mtrBaseline: number; mtrPlan: number;
          mtrBaselineGross: number; mtrPlanGross: number; baselineAfterTva: number; planAfterTva: number /* added */ }>;
// mtr* = 1 − Δdisposable / Δ(salaire net of THAT scenario) between consecutive points (forward difference);
// mtr*Gross = same per € of gross salary. baseline/plan = disposable before TVA.

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

## Implementation notes (engine 1.0.0 — additions and clarifications, no removal)

- **Which income is used.** `salary` is used when `activity` is `'salarie'` (or `'etudiant'` with a job), `unemployment` only for `'chomage'`, `pension` only for `'retraite'`; anything else is ignored with a warning (cumuls not modelled in v1). `unemployment.areMonthly` is the NET ARE received.
- **Gross is the anchor.** A NET salary is inverted to gross (bisection, per status) with today's rules; the plan keeps the same gross. A NET pension is inverted with today's CSG tier; the plan keeps the same gross.
- **Components are per household** (one per id; `personIndex` unused in v1). Per-adult salary detail is in `perAdult`.
- **`deltaPct`** is 0 when `baseline.disposable ≤ 0`.
- **Periods 2027/2028/2030** are the average month of the calendar year (12 monthly computations averaged; income tax computed once on the year's average taxable income).
- **Extra exports:** `COMPONENT_IDS`, `COMPONENT_META`, `PERIODS`, `PARAMS` (every parameter with value/unit/effective/source/status), `TIERS`, `ENGINE_VERSION`, types `CasType`, `CurvePoint`, `HourSplit`, `PlanSwitches`.
- **Invariant scopes.** (5) households without pensions (the pension CSG tiers, kept by the plan, create cliffs for retired members); tested as Δdisposable/Δ(plan net salary of adult 1) ≥ 0,77 at cent precision. (6) holds for gross incomes held constant: tested with pensions typed gross, no CAF override, periods `'steady'` and `2030` (in 2027–2028 the income tax is still the joint barème).

## Audit changes (docs/ENGINE-AUDIT.md, 2026-10) — no signature changed, no field removed

- **`Child.cmiInvalidite` now defaults to `false`** (was `true` when `aeeh`). The AEEH is granted from 50 % of
  incapacity, the CMI « invalidité » requires 80 %: the +6 600 €/an AFU supplement (and today's extra ½ part) is only
  applied when the user says so. **UI: when « AEEH » is ticked for a child, offer a second checkbox « titulaire de la
  carte mobilité inclusion “invalidité” (taux ≥ 80 %) » mapped to `cmiInvalidite: true`.** The URL state already
  round-trips the field.
- Baseline IR: ½ part per CMI holder (adult `aah_80`, child with `cmiInvalidite`), art. 157 bis abattement per person
  aged ≥ 65 or `aah_80` (doubled for a married couple when both qualify). Visible in the `impot_revenu` formula
  (« abattement âge ou invalidité (art. 157 bis) »).
- Period 2027: deductible CSG = min(rate, 6,8 points) (H18 is now tier `law`). Period 2028: the pension CSG tier uses
  the RFR 2026 without the 10 % pension abattement (formula says « RFR 2026 »).
- Wording of `activeHypotheses` H13, H15, H16, H17, H18 and of the steady-state APL formula refined (French text only).

## Invariants (tested)
1. `sum(components.amount) === disposable` (to the cent), both scenarios.
2. Plan with every reform switch neutralised ≡ baseline (identity test; internal `__planSwitches`).
3. Baseline reproduces `research/baseline/golden-cases.json` within documented tolerance.
4. Plan reproduces the book's cas types (CSG gain at SMIC 2025 = 171,72 €/mois; GraphIR table with H2 off; 1 100 €/mois disabled adult (CMI); break-even 28 695,65 € with H2 off).
5. Steady-state plan: marginal retention ≥ 0,77 − ε on net earnings (no cliffs) under default hypotheses.
6. Plan side independent of `marriedOrPacs`.
7. `decodeState(encodeState(x))` deep-equals x (fast-check).
