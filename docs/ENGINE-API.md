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
  deltaPct: number | null;         // relative to baseline.disposable; null when baseline.disposable ≤ 50 €/mois (v1.1)
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
- **`deltaPct`** is 0 when `baseline.disposable ≤ 0` (1.0). **Since 1.1 it is `null` when `baseline.disposable ≤ 50`.**
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

## v1.1 — after user testing (engine 1.1.0, 2026-10)

Source: docs/qa/users/*.md and docs/qa/code-review.md. Everything below is **additive**, except one type change
(`deltaPct: number | null`) and one input-union widening (`extras.childcare` gains `'micro_creche'`, `SalaryStatus`
gains `'dirigeant_assimile' | 'tns'`), which can break exhaustive `switch`/`Record` code in consumers. Tests:
`engine/test/v11.test.ts`.

### Inputs

```ts
export type SalaryStatus = 'prive' | 'cadre' | 'fonctionnaire' | 'dirigeant_assimile' | 'tns';
Household.benefits.childSupportReceivedMonthly?: number;          // pension alimentaire reçue, €/mois
Household.extras.childcare?: 'parent' | 'creche' | 'assistante_maternelle' | 'micro_creche';
Household.extras.childcareCostMonthly?: number;                    // total bill of the children < 6, hors cotisations
```

- **`dirigeant_assimile`** — président·e de SAS/SASU, gérant·e minoritaire ou égalitaire de SARL. Computed like a
  cadre, without the employer's assurance chômage (4 %) and AGS (0,25 %), and without the RGDU (reserved for pay
  subject to unemployment insurance). Employee net = cadre net for the same gross.
- **`tns`** — gérant·e majoritaire, indépendant·e, micro-entrepreneur·e: **not modelled**. Safe behaviour: the
  adult's income is ignored in both scenarios (computed as without income), a `warnings` entry explains it and
  `compare().unsupported` is set. **UI: when `unsupported` is present, do not present the figures as the
  household's result.**
- **Child support** — counted as a resource for the RSA and the prime d'activité; the ASF is differential (ASF −
  child support; nothing at or above its amount, nor under the 15 € minimum). Not added to disposable income
  (identical in both scenarios; its taxation is not modelled). URL state: a 4th slot of the benefits array, written
  only when the field is set (every 1.0 hash is unchanged and still decodes).
- **Childcare** — see below. URL state: `micro_creche`, `dirigeant_assimile`, `tns` are appended to their enum
  lists (1.0 hashes unchanged).

### Childcare: CMG and crédit d'impôt garde d'enfants (new component `cmg`)

`COMPONENT_IDS` gains **`'cmg'`** (« Complément de libre choix du mode de garde (CMG) », group `prestations`,
between `paje_base` and `ars`). Today's rules (2026):

| Mode | Today | Plan |
|---|---|---|
| `assistante_maternelle` (CMG « emploi direct ») | barème linéarisé in force since **1 Sept 2025**: CMG = heures × tarif − heures × R × taux d'effort × tarif / tarif de référence, with R = RNC N-2 / 12 bounded by 815 € and 8 500 €, taux d'effort of the PSU barème (0,0619 % for 1 child, 0,0516 % for 2, 0,0413 % for 3, 0,0310 % for 4–7, 0,0206 % for 8+), tarif de référence 4,85 €/h, hourly cap 8 €/h. For a rate ≤ 8 €/h this is **cost × (1 − R × taux / 4,85)**: only the monthly cost is needed. Same formula 0–3 and 3–6 years. Net of CRDS. Activity condition: each parent works, is indemnified, studies or receives the AAH. | 0 from 1 Jan 2028 (PAJE abrogated, PLFSS am. 7); 2027 = today's amount |
| `micro_creche` (CMG « structure », not reformed in 2025) | per child < 6, by resource tier (couple 1 child: ≤ 24 333 € / ≤ 54 075 € / above: 992,12 / 855,25 / 718,41 €; parent isolé 34 066 / 75 705 €: 1 289,77 / 1 111,82 / 933,94 €; thresholds + 3 453 / 7 676 € (couple), + 4 834 / 10 746 € (isolé) per additional child), halved from 3 to 6 years, ≤ 85 % of the bill | 0 from 2028 |
| `creche` (PSU) | no CMG (reason given); the end of CAF funding of crèches stays in `unquantified.losses` (`creche_cmg`, `prominent: true`) | — |

- **Crédit d'impôt** (CGI 200 quater B): 50 % × min(12 × (cost − CMG) / n, 3 500 €) × n children < 6 — the CMG is
  now deducted from the expense base (it was not in 1.0). Plan: 2/3 kept in 2027, 1/3 in 2028, 0 from 2029
  (am. 1 IV.E); in 2028 the base is the full cost (no CMG any more).
- **Missing cost** (`childcareCostMonthly` absent for a paid mode): default per child under 6 — assistante
  maternelle **873 €** (180 h × 4,85 €, the CAF's median rate), micro-crèche **1 620 €** (180 h × 9 €/h), crèche
  **180 h × R × taux d'effort** (national PSU barème). A `warnings` entry and hypothesis **H20** say so. The plan
  keeps today's bill.
- Sources: CAF « Réforme du CMG 2025 » (présentation SDSF), service-public F39152 and F345 (micro-crèche, 2026
  amounts). OpenFisca-France 176.1.3 still implements the pre-September-2025 barème, so this is **not**
  oracle-checked. The 2026 revaluation of the 4,85 € reference rate was not found on an official page (a secondary
  source gives 4,91 €; at 4,91 € the CMG is slightly higher): parameter `x.cmg.am_reference_hourly`, status
  `approximation`. Not modelled: CMG « cotisations » (100 % of an AM's contributions, paid by Pajemploi — listed in
  `unquantified.losses` as `prominent`), garde à domicile, complément transitoire, majorations, 6–12 years for lone
  parents.

### `compare()` additions

```ts
interface Comparison {
  // …1.0 fields…
  deltaPct: number | null;                       // null when baseline.disposable ≤ 50 €/mois (DELTA_PCT_MIN_BASELINE)
  summary: {
    sentence: string;                            // « Avec le plan complet …, votre ménage aurait environ 835 € de plus par mois. Après la hausse des prix estimée …, l'écart serait de +685 € par mois. »
    gains: Array<{ label: string; amount: number }>;   // top 3 waterfall steps > 0 by |amount| (TVA/CEE included when shown)
    losses: Array<{ label: string; amount: number }>;  // top 3 steps < 0
    why: string;                                 // « Votre gain vient surtout de l'aide universelle de 550 € par adulte (aide fondamentale universelle, AFU), qui compense largement la hausse de votre impôt sur le revenu (taux unique de 23 %). »
    certainty: string;                           // which lines are written in the amendments / announced / estimated, with € at stake
  };
  baselineBenefitsExplained: Array<{ id: ComponentId; label: string; amount: number; reason?: string }>;
  h1Alternative?: { hypothesis: 'differential' | 'replaced'; delta: number; deltaAfterTva: number };
  unsupported?: string[];
}
```

- **`summary`** — plain French, every acronym expanded in the same label (« le revenu de solidarité active
  (RSA) »). Amounts are the waterfall deltas (cents); the sentence rounds to 5 €. `why` names the largest line of
  the headline (TVA excluded) with the same sign as `delta`, and the largest opposite line (« compense
  largement » when gains ≥ 1,5 × losses; « ne compense pas » for a loss). `certainty` groups the waterfall lines
  by tier: `law` = « écrit dans les amendements proposés (pas encore votés) », `announced` = « annoncé par les
  auteurs, sans texte de loi », `hypothesis` = « estimé par le simulateur ».
- **`baselineBenefitsExplained`** — always 12 entries in this order: `aides_logement`, `allocations_familiales`,
  `complement_familial`, `paje_base`, `cmg`, `ars`, `asf`, `aeeh`, `prime_activite`, `rsa`, `aah`, `aspa`. `amount`
  = the baseline component. `reason` is set iff amount is 0, from the same rule conditions as the calculation (and
  re-running the APL with zero resources to tell « revenus » from « loyer trop élevé »). Examples: « versées à
  partir du 2e enfant de moins de 20 ans », « vos revenus (33 072 € par an) dépassent le plafond pour votre loyer et
  votre zone », « la pension alimentaire que vous recevez (250 € par mois) atteint son montant », « pas pour une
  crèche municipale ou associative … ».
- **`h1Alternative`** — the other reading of H1 (from `'replaced'` → `'differential'` and vice versa), present when
  |delta(other) − delta| > 5 €/mois (`H1_ALTERNATIVE_THRESHOLD`). Costs one more evaluation per `compare()`.
- **`activeHypotheses`** gains **H19** (pension alimentaire: « non déclarée : supposée non versée … », lone parent
  with a child < 20) and **H20** (frais de garde: declared or default, for a paid mode with a child < 6).
- **`unquantified` items** gain `plainTitle?: string` and `prominent?: boolean` — typed optional for compatibility,
  **always set by the engine**. `prominent` = could plausibly exceed ~50 €/mois for this household:
  `chomage_6_mois` (ARE recipient), `creche_cmg` (any declared paid mode: crèche funding, AM contributions,
  micro-crèche), `postes_publics` (fonctionnaire; title « 580 000 postes publics fermés, fin du statut (indemnité de
  70 % jusqu'à 7 ans) »), `gel_indexation` (retirees, RSA or disabled adults), `reste_a_charge_10` (AAH),
  `droits_connexes` (RSA), `aeeh_complements`, `apl_nouveau_bail` (APL ≥ 50 €), `emploi_domicile_cotisations`
  (≥ 3 000 €/an). The 1.0 `creche_cmg` item is now specific to the declared mode (and generic when no mode is
  given).

### `hourOfWork()` additions (per scenario)

```ts
interface HourSplit {
  // …1.0 fields unchanged (impotRevenu = gross 23 % share, youKeep excludes the AFU)…
  afuPerHour: number;                  // this adult's OWN AFU (6 600 €/an + own CMI / pension supplements, children excluded) ÷ 12 ÷ hours worked; 0 today
  netIncomeTaxPerHour: number;         // impotRevenu − afuPerHour; < 0 = « l'État vous verse » for each hour
  youKeepIncludingTransfers: number;   // youKeep + afuPerHour (= youKeep today: household-level benefits are not attributed per hour)
}
```

At the SMIC (single, plan): impotRevenu ≈ 2,26 €/h, afuPerHour = 550 / 151,67 = 3,63 €/h, so the net income tax is
negative and `youKeepIncludingTransfers` is higher than today — the per-hour view now agrees with the household gain.

### New exports

```ts
export function roundForDisplay(c: Comparison, step = 5): DisplayComparison;
// { step, baseline, plan, delta, baselineAfterTva, planAfterTva, deltaAfterTva, deltaPct,
//   lines: Array<{ id, label, group, before, after, delta }>, waterfall: Array<{ id, delta }> }
// Totals are rounded directly (delta = round5(c.delta)); lines are distributed by largest remainder so that
// Σ lines.before (non-indirect) = baseline, Σ lines.after = plan = baseline + delta, Σ waterfall (non-indirect) = delta;
// indirect taxes (TVA, CEE) are distributed separately (baselineAfterTva, planAfterTva). Every screen should use it.
export function roundSumPreserving(values: number[], step = 5, target?: number): number[];

export function employerView(amount: number, basis: 'net' | 'brut', status: SalaryStatus): EmployerView;
// { status, supported, today: EmployerSide, plan: EmployerSide, employeeNetGain, employerCostChange, notes }
// EmployerSide = { gross, employeeNet, employerCost, cotisationsPatronales, cotisationsSalariales, csgCrds }
// One full-time employee, steady state: same gross (H4), CSG/CRDS removed ⇒ net +9,7 % × 98,25 % of gross;
// employer cost unchanged (contributions and RGDU kept; the taxe sur les salaires only concerns employers not
// subject to VAT — not modelled); 'tns' ⇒ supported: false.
export const DELTA_PCT_MIN_BASELINE = 50;
export const H1_ALTERNATIVE_THRESHOLD = 5;
// types: DisplayComparison, DisplayLine, EmployerView, EmployerSide, Summary, SummaryLine, BenefitExplained
```

`ENGINE_VERSION` = `'1.1.0'`.

### Behavioural changes

- Households declaring an assistante maternelle or a micro-crèche for a child < 6 now see the CMG today and its
  loss with the plan (e.g. Thomas, married, 4 800 € net cadre + 2 300 € net, children 7 and 3, the 3-year-old at
  an AM, cost not given: default 873 €, CMG 256,89 €/mois and crédit garde 145,83 €/mois today, both gone in the
  plan ⇒ delta **+1 239,89 → +837,17 €/mois**). In 1.0 a missing cost meant no crédit d'impôt at all.
- Crédit d'impôt garde: base net of the CMG.
- ASF reduced by a declared child support; RSA/PA resources include it.
- `deltaPct` is `null` (was 0) when today's disposable income is ≤ 50 €/mois (cas type `jeune-22-inactif`).
- The not-modelled bullet on early childhood now lists only what remains unmodelled.
- No cas type changes in steady state (none declares an AM); `cas-types-results.json` and the snapshot only change
  `engineVersion` and `jeune-22-inactif.deltaPct` (null).
