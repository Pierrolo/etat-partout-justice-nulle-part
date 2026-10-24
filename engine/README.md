# @epjn/engine

Pure-TypeScript household tax-benefit simulator behind « Et moi, dans tout ça ? ». It compares, for one household,
**today's law (2026)** with **the plan of « État partout, justice nulle part »** (Résolution, 2026). Every euro of
the result is a `Component` with a formula rendered with the household's numbers, its sources and its tier
(`law` / `announced` / `hypothesis`).

- Contract: [`docs/ENGINE-API.md`](../docs/ENGINE-API.md). Public method page (French): [`docs/METHODE.md`](../docs/METHODE.md).
- No DOM, no I/O, no `Date`, no runtime dependency. Deterministic. Imported by the site as source (`exports → src/index.ts`).

```ts
import {
  compare,
  simulate,
  earningsCurve,
  hourOfWork,
  CAS_TYPES,
  encodeState,
  decodeState,
} from '@epjn/engine';

const c = compare(household, { period: 'steady', hypotheses: { H2_fraisPro10: true } });
c.delta; // €/month, plan − today (disposable income before TVA)
c.waterfall; // one step per component that changes, with formulaBefore / formulaAfter and sources
c.unquantified; // { promises, losses } — never summed
```

## Model overview

```
normalize()            input validation, warnings, NET salary → gross (bisection per status)
core.runScenario()     rules = 1 month (today, steady state) or 12 months (2027, 2028, 2030)
  computeMonth()       salary chain (privé / cadre / fonctionnaire) · ARE · pensions (CSG tier ← RFR fixed point)
                       → revenu net catégoriel → AF, CF, PAJE, ARS, ASF, AEEH → APL → AAH, ASPA → RSA, prime d'activité
                       → AFU (plan)
  year                 average of the months; income tax once on the average taxable income
                       (barème 2026 with QF, plafonnement, décote, credits — or flat 23 % in the plan)
simulate.build()       components, formulas, sources, tiers; TVA on a fixed basket; rounding to the cent
compare()              waterfall, non-chiffré panels, hypotheses register, not-modelled list, warnings
```

| Folder                              | Content                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/params/baseline-2026.ts`       | **generated** from `research/baseline/parameters.json` (257 sourced parameters)                                                                  |
| `src/params/baseline-extra.ts`      | parameters the baseline research did not cover (cadre, fonctionnaire, ARE, AEEH, dons, emploi à domicile, TVA curve, CEE)                        |
| `src/params/plan.ts`                | the plan: rates, AFU amounts, dated schedules, amendment sources                                                                                 |
| `src/baseline/*.ts`                 | today's rules: `salaire`, `retraite`, `chomage`, `ir`, `rsa`, `prime-activite`, `aides-logement`, `prestations-familiales`, `aah`, `aspa`, `tva` |
| `src/plan/*.ts`                     | `afu` (aide fondamentale universelle), `periods` (table-driven rules per period and reform switch)                                               |
| `src/core.ts`                       | month / year computation shared by both scenarios                                                                                                |
| `src/simulate.ts`, `src/compare.ts` | components, formulas, waterfall                                                                                                                  |
| `src/curves.ts`, `src/hour.ts`      | « Si je gagnais plus ? », « Votre heure de travail »                                                                                             |
| `src/cas-types.ts`                  | 47 standard households (heatmap)                                                                                                                 |
| `src/unquantified.ts`               | catalogue of announced promises and unquantified losses, filtered per household                                                                  |
| `src/state.ts`                      | URL hash state `v1.<base64url>`                                                                                                                  |

**Baseline = plan with every switch off.** The plan is not a separate code path: it is the same core with
`PlanSwitches` (CSG on earned income, flat tax + AFU, pension abattement, prestations familiales, aides au
logement, minima sociaux, niches, TVA, CEE) turned on and dated. Turning every switch off reproduces the baseline to
the cent (invariant 2, property-tested).

## Hypotheses (defaults, see VISION §6 and `compare().activeHypotheses`)

| #                                   | Default                                                                                        | Toggle                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| H1 RSA, prime d'activité, AAH, ASPA | replaced by the AFU (announced, no legal text)                                                 | `'differential'`: AFU counted as a resource, top-up to today's level, taxable at 23 % |
| H2 10 % frais professionnels        | kept (art. 83 3° CGI not abrogated) ⇒ 0,793 € kept per €, break-even ≈ 31 884 € net            | off = the authors' reading (0,77 €, 28 695,65 €)                                      |
| H5 pass-through of TVA and CEE      | 100 %                                                                                          | 0 / 50 %                                                                              |
| H4                                  | CSG cut fully to the employee, gross pay unchanged                                             | —                                                                                     |
| H6                                  | ARE amount unchanged; « 7th month: ARE = 0 » shown in the losses panel                         | —                                                                                     |
| H11                                 | couples: today joint IR if married/PACS, else 2 foyers (children on adult 1); CAF = one ménage | —                                                                                     |
| H12                                 | AFU nominal 6 600 € applied to 2026 incomes                                                    | —                                                                                     |
| H13                                 | every person ≥ 18 gets the adult AFU                                                           | —                                                                                     |
| H14                                 | benefits received if eligible; `nonRecours` zeroes them                                        | —                                                                                     |
| H15                                 | an AEEH child holds the CMI invalidité (+6 600 €) unless `cmiInvalidite: false`                | —                                                                                     |
| H16                                 | pension CSG tier in the plan: plan taxable income, 1 part per adult + ½ per child              | —                                                                                     |
| H17                                 | transition: existing lease keeps the APL on the conventioned schedule                          | —                                                                                     |

## How to add or change a parameter

1. **Baseline (2026 law)**: edit `research/baseline/parameters.json` (value, unit, effective_date, source, status),
   run `python3 -I engine/scripts/import_baseline_params.py`, then `python3 scripts/baseline_reference.py --check`
   and `pnpm --filter @epjn/engine test`. Never edit `baseline-2026.ts` by hand.
2. **Engine-only baseline parameter**: add it to `src/params/baseline-extra.ts` with a `source` and an honest
   `status` (`official`, `approximation`, `hypothesis`).
3. **Plan**: add it to `src/params/plan.ts` with the amendment as source; dated schedules are arrays
   (`{ from, factor }`) read by `src/plan/periods.ts`.
4. Read it with `n('key')` (number) or `pv('key')` (typed value); cite it with `src('key', …)` in the component.
   Keys are type-checked.

## Tests (`pnpm --filter @epjn/engine test`)

| File                      | What                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/golden.test.ts`     | the 40 OpenFisca-France 176.1.3 golden cases, per component, within baseline-rules.md §12 tolerances (salary 0,08 €, RGDU/coût employeur 0,40 €, benefits 0,60 €, ARS 1 €, RNI 7 €/an, IR 3 €/an, revenu disponible 8 €; two documented 7 € exceptions)             |
| `test/book.test.ts`       | the book's figures: CSG gain 171,72 €/mois at the 2025 SMIC (1 801,80 € brut) and the other workbook rows, the GraphIR table with H2 off, break-even 28 695,65 €, 0,77 / 0,793 retention, 1 100 €/mois disabled adult                                               |
| `test/invariants.test.ts` | fast-check properties: components sum to disposable (1), identity reform (2), retention ≥ 0,77 (5), marital-status independence (6), state round trip and garbage (7). Fixed seed; `FC_RUNS=10000 FC_SEED=… pnpm --filter @epjn/engine test` for an exploratory run |
| `test/api.test.ts`        | API surface, net→gross, ARE, fonctionnaire, couples, transition schedules, curves, hour of work, state                                                                                                                                                              |
| `test/cas-types.test.ts`  | snapshot of every cas type's deltas (`test/__snapshots__`), same data as `cas-types-results.json`                                                                                                                                                                   |

`pnpm --filter @epjn/engine gen:cas-types` rewrites `engine/cas-types-results.json` (winners/losers, transition
years, H1/H2/H5 variants) for human review.
