# Code review — « Et moi, dans tout ça ? »

Reviewer: senior staff code review (QA agent), 2026-10-24. Scope: commit `1b6bac0` (HEAD). Engine economics are out of scope (see `docs/ENGINE-AUDIT.md`).

**Not reviewed.** Another agent changed `site/package.json` and `pnpm-lock.yaml` during this review (adds `@fontsource/jetbrains-mono` and `@fontsource/schibsted-grotesk`). These changes are not committed.

## Commands run

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK |
| `pnpm lint` | **FAILS**: ESLint is clean, but Prettier `--check` fails on `engine/README.md` and `engine/test/audit.test.ts` |
| `pnpm typecheck` | OK (engine `tsc`, site `astro check`: 0 errors, 0 warnings, 0 hints) |
| `pnpm test` | OK: engine 92 tests in 6 files, site 137 tests in 15 files |
| `pnpm build` | OK: 16 pages. Only warnings are Rollup notes about comments inside zod |
| `BASE_PATH=/etat-partout-justice-nulle-part/ astro build --outDir <scratch>` | OK. No unprefixed `href`, `src` or `component-url` in the HTML, no `url(/…)` in the CSS. The only absolute paths in the JS are wrapped in `withBase()` |
| `pnpm test:e2e` (private port) | 216 passed, 6 failed, 4 skipped. The 6 failures were 404s on `_astro/*` because another agent rebuilt `site/dist` during the run. A clean re-run of `story.spec.ts` passed 20/20 |
| `python3 -I pipeline/build.py --check` | OK: 13 files identical to a fresh build. The `manifest.json` sha256 values match |
| Extra: ESLint with `eslint-plugin-react-hooks`, from a scratch install | 7 `exhaustive-deps` warnings (see React) |
| Extra: fuzzing `decodeState` with garbage, oversized and out-of-range payloads | Returns `null` or clamps; no exception, no XSS path (see URL state) |

Severity scale: **blocker** (must fix before publishing), **major** (fix before launch), **minor**, **nit**.

---

## 1. CI / build / deploy

### 1.1 `pnpm lint` fails, so CI is red on the first push — **blocker**
- Files: `engine/README.md`, `engine/test/audit.test.ts`. Both fail Prettier: the audit commit `841fbdc` never ran `pnpm format`.
- Why it matters: `.github/workflows/ci.yml` runs `pnpm lint` before every other step. The first push to `main` or the first PR fails at that step, so typecheck, test, build and e2e never run.
- Fix: run `pnpm format` (or `prettier --write engine/README.md engine/test/audit.test.ts`) and commit. Also add a pre-commit or `lint-staged` hook, or tell agents to run `pnpm lint` before committing.

### 1.2 Deploy is not gated on CI (lint and e2e are skipped) — **major**
- File: `.github/workflows/deploy.yml:20-42`. On every push to `main` it runs install, typecheck, test, build, then deploys. Lint and e2e (axe, no third-party requests, reflow) are never required. It also runs in parallel with `ci.yml`.
- Why it matters: a build that fails CI (an axe violation, a third-party request, or today's Prettier failure) is still published.
- Fix: either merge both into one workflow with `deploy: needs: [check]`, or trigger deploy with `on: workflow_run: workflows: [CI], types: [completed], branches: [main]` plus `if: github.event.workflow_run.conclusion == 'success'`.

### 1.3 e2e never runs against the base path that production uses — **minor**
- Files: `ci.yml:44-48` builds and tests with `BASE_PATH=/`. Production (`deploy.yml:35`) uses `/${repo}/`.
- Why it matters: base-path regressions such as a raw `href="/…"` or a `fetch('/data/…')` would only show up in production. I checked the current build by hand and it is clean. `playwright.config.ts` already supports `BASE_PATH`.
- Fix: in `ci.yml`, run the build and e2e with `BASE_PATH: /etat-partout-justice-nulle-part/`, or add a second, smaller job that does so.

### 1.4 The data pipeline is not checked in CI — **minor**
- `pipeline/build.py --check` exists, is deterministic and uses only the standard library, but CI never runs it. Someone can hand-edit `site/src/data/*.json` (forbidden by `site/src/data/README.md`) or let it drift from `data/` without CI noticing.
- Fix: add `- run: python3 -I pipeline/build.py --check` to `ci.yml`. `ubuntu-latest` ships Python 3. The check validates too (`validate.py`), which partly covers the VISION §2.2 rule « CI fails on an unsourced figure ».

### 1.5 Small CI points — **nit**
- `ci.yml:16-17` relies on `pnpm/action-setup@v4` reading `packageManager: pnpm@10.28.0`. This is correct; keep the `engines.pnpm` range consistent with it.
- `.nvmrc` = `22` resolves to the latest 22.x on runners (≥ 22.18), so `engine` `gen:cas-types` (`node scripts/gen-cas-types.ts`, which needs unflagged type stripping) works. The `engines` field still says `>=22.12.0`, where that script fails. Either bump `engines` to `>=22.18` or add `--experimental-strip-types` as `site` `contrast` does.
- `deploy.yml:36`: `SITE_URL: https://${{ github.repository_owner }}.github.io` produces `https://Pierrolo.github.io` in canonical and `og:url`. Lower-case it. GitHub expressions have no `toLower`, so compute it in a `run:` step with `echo "SITE_URL=https://${GITHUB_REPOSITORY_OWNER,,}.github.io" >> "$GITHUB_ENV"`.
- `site/public/robots.txt`: on a project Pages site it is served at `/<repo>/robots.txt`, where crawlers never read it. Harmless; remove it or document why it is there.
- `playwright.config.ts:13-21`: the sandbox Chromium fallback is correctly skipped when `CI` is set, and CI installs with `--with-deps chromium`. Correct as written.

---

## 2. Placeholders, mocks, stale docs

### 2.1 `/methode` ships six visible « TODO(builder) » boxes — **blocker**
- Files: `site/src/pages/methode.astro:60-112` (`<Todo>` in « Ce qui est modélisé », « Ce qui ne l'est pas », « Registre des hypothèses », « Sources », « Écarts », « Journal ») and `site/src/components/site/Todo.astro`. The built `dist/methode/index.html` contains `TODO(builder)` six times.
- Why it matters: /methode is the credibility page. The simulator links to it (`Hypotheses.tsx`, « Méthode, sources et registre complet des hypothèses → »). Sceptics and journalists (VISION §3) would land on a page of developer placeholders. It also breaks VISION §6 and §4.
- Fix: the content already exists in `docs/METHODE.md` (sections 1–10: register, TVA, calendar, simplifications, OpenFisca gaps, not-modelled list, sources). Import and render it (`import { Content } from '../../../docs/METHODE.md'` works in Astro), or move it to `src/content/`. Build the H-register from `compare(...).activeHypotheses`, `ENGINE_VERSION` and `PARAMS_META`. Then delete `Todo.astro` and its `.todo` CSS. Add an e2e assertion that no built page contains `data-todo` or `TODO(`.

### 2.2 Stale « mock » and « squelette » references — **minor**
- `site/src/lib/engine-contract.test.ts:2-4` says « the mock today, the real engine once `USE_MOCK_ENGINE` is flipped ». No mock or flag exists: `lib/engine.ts` re-exports `@epjn/engine`. Reword it.
- `README.md:43` says `engine/ … (squelette ; voir docs/VISION.md §7)`, but the engine is complete (92 tests, audited).
- `README.md:78` says « Les hypothèses du simulateur sont publiées sur la page « Méthode » ». That is false until 2.1 is fixed. The pointer to `TODO(builder)` should go once 2.1 lands.

### 2.3 Styleguide ships fictitious data and `example.org` links — **nit**
- `site/src/pages/styleguide.astro:447,450` and `components/charts/StyleguideChart.tsx:17-115` (« exemple fictif »). The page is `noindex` and not in the nav, so this is acceptable. Consider excluding it from production builds (`if (import.meta.env.PROD) return Astro.redirect(...)`, or move it under a `dev`-only route) so no fictitious € figure is publicly reachable.

---

## 3. Every number has a source (VISION §2.2)

### 3.1 Engine output is labelled « Écrit dans la loi » — **major**
- Files: `components/simulator/Waterfall.tsx:11`, `EarningsCurve.tsx:19`, `CasTypes.tsx:31`, `HourOfWork.tsx:12`, `Transition.tsx:11`. Each one does `SOURCES = [{ label: 'Moteur de calcul du simulateur…', tier: 'law' }]`, and `SourceChip` renders the solid « loi » tier mark next to it.
- Why it matters: the simulator result mixes all three tiers. H1 « remplacés » is *Annoncé*, H5/TVA is *Hypothèse*, and the default steady state (H12) is a convention. Marking the whole chart as law breaks the central rule « ne jamais faire passer une promesse pour un texte de loi » (methode.astro:53, VISION §2.3).
- Fix: drop `tier` on the engine source chip (neutral source). Let per-line tiers come from `component.tier` / `waterfall[].tier`, which the engine already provides. Add a second chip « Hypothèses H1, H2, H5 » with `tier: 'hypothesis'` (as `HourOfWork.tsx:13` does). For `Transition.tsx`, the calendar is partly *annoncé* (`calendrier.json` has `annonces_sans_date`), so use no tier or `announced`.

### 3.2 Hard-coded figures that already exist in `facts.json` — **minor**
VISION says « never type a figure in a page » (`lib/facts.ts:8`). There is no lint or test enforcing it, and these slipped through:
- `lib/site.ts:67` « Les 465 niches fiscales » → `niches_nombre`. `lib/site.ts:85` « Les 81 amendements »: count `amendements.json` or use a fact.
- `pages/comprendre/niches.astro:220,286,291,296,396,518,523`: « 465 », « 486 », « 143 Md€ ». Use `niches_nombre`, `niches_total_nombre` and `fiche_niches_supprimees_md`. Lines 268/284 already use them for the values but not in the labels.
- `pages/comprendre/amendements.astro:212`: « 5,4 Md€ … 8,1 Md€ » in a `note` string → `apl_economie_2027_expose_md`, plus a fact for 8.1.
- `pages/comprendre/etat-partout.astro:256`: « garde 51 % » → `representation_elu_direct_pct`.
- `pages/comprendre/le-plan.astro:117`: « 236 milliards » → `eco236_manifeste_md`.
- `lib/reading.ts:12`: `fullTimeHoursPerYear: 1607` is a legal figure. Make it a fact with its Légifrance source.
- `lib/sim/form.ts:20`: `SMIC_NET_MONTHLY = 1478` duplicates `PARAMS['general.smic_monthly_net_indicative']` (1477.93) in the engine. Read it from `PARAMS`, or export it from the engine, so the default salary follows the engine when the SMIC is revalued.
- Fix (systemic): add a Vitest or ESLint check that scans `src/pages/**/*.astro` and `src/lib/site.ts` text and string literals for `\d[\d  ]*\s?(Md€|€|%|niches|agences|amendements)` outside `{…}` expressions, with an allow-list. This is the VISION « CI fails on an unsourced figure ».

### 3.3 No tax logic in the site — OK
`lib/engine.ts` is the only entry point. Simulator, cas-types, transition, earnings curve and hour of work all call `compare`, `earningsCurve` or `hourOfWork`. `lib/sim/result.ts` only rounds and joins. Nothing to fix. (`lib/tiers.ts:9` and `methode.astro:2` import `@epjn/engine` directly, in breach of the « one place » rule in `lib/engine.ts:2`. **nit**: route them through `@/lib/engine`.)

---

## 4. Simulator / URL-hash state

### 4.1 Shared link shows the default household's result until hydration, and without JS — **major**
- Files: `pages/simulateur/index.astro:18` (`<Simulator client:load />`) and `components/simulator/Simulator.tsx:94-96,124-128`. The SSR HTML contains the full result (headline sentence, waterfall, table) for `defaultFormState()`, a single person on the SMIC. The hash is applied only in a layout effect after hydration.
- Why it matters: VISION §7 says most visitors arrive from a shared link on a phone. On mid-range 4G, the ~200 kB gz of JS on this page (§6.1) means several seconds during which they read « votre ménage disposerait de +X €/mois » for someone else's household. Without JS, that figure never changes. For a project built on « credibility is the product », that is a misleading figure.
- Fix: add an inline `<script is:inline>` in `simulateur/index.astro` that sets `document.documentElement.dataset.simHash = '1'` when `/^#v\d+\./.test(location.hash)`. Use CSS to hide `#detail` and the headline and show « Chargement de la situation partagée… » under `[data-sim-hash]`. Clear the flag once `applyHash` runs. Also add a `<noscript>` notice that the simulator needs JavaScript. The SSR default result could carry an explicit « Exemple : une personne seule au SMIC » label.

### 4.2 « Copier le lien » can copy a stale or last-valid state — **minor**
- `Simulator.tsx:149-156`: `buildUrl` reads `latest.current = committed`, which is debounced by 250 ms and only updated when the form is valid. Clicking « Copier » within 250 ms of an edit, or while a field is invalid, silently shares the previous situation.
- Fix: build from `parsed.household ?? committed.household` with the current `hyp`/`period`. When `invalid`, disable the share button or say « le lien reprend votre dernière situation complète ».

### 4.3 Decoded hash bypasses form validation — **minor**
- `Simulator.tsx:174-178` calls `setCommitted({ household: decoded.household, … })` directly. `decodeState` (`engine/src/state.ts:144-221`) checks shape and enums but not ranges. Age −5 or 400, rent −100 and salary 1e15 all decode. The engine clamps them and adds warnings, so nothing crashes or injects: values are numbers and enums only, and React escapes all text. But the form then shows errors while the result displays the clamped computation.
- Fix: run `formToHousehold(householdToForm(decoded.household))`. If it has errors, show the « Lien incomplet » notice and keep the defaults, as already done for undecodable hashes.

### 4.4 Explorer hash handling — **nit**
- `components/explorer/NichesExplorer.tsx:366` ignores any hash without `=`, so Back to an empty hash does not reset the filters. The same pattern is in `AmendementsExplorer.tsx:148`. Treat `''` as « reset to defaults ».

---

## 5. React

### 5.1 No `eslint-plugin-react-hooks` — **minor**
- `eslint.config.js` has only js, typescript-eslint and astro rules. Running `react-hooks/exhaustive-deps` from a scratch install gives 7 warnings. Today all of them are harmless, because the missing deps are derived from listed ones. But the rule is the only guard against stale closures in this hook-heavy code:
  - `explorer/AmendementsExplorer.tsx:175`: `ui` missing; `ui.liasses`/`ui.theme` are listed, but `filterItems` gets the whole `{...ui}`.
  - `explorer/CalendrierExplorer.tsx:442`: `lanes.join('|')` as the dep. Better: `useMemo` on `lanes` itself.
  - `explorer/NichesExplorer.tsx:433`: same `ui` pattern.
  - `story/Lifecycle.tsx:99`: `ids.join()` as the dep.
  - `story/PlanSankey.tsx:96`: `margin`/`height` missing (derived from `narrow`).
- Fix: add `eslint-plugin-react-hooks` (and `eslint-plugin-jsx-a11y`) to the flat config and fix or justify each warning.

### 5.2 Click-after-hover toggles the selection off — **minor**
- `components/story/HundredSquares.tsx:89-93` and `components/story/UnitGrid.tsx:61-65`. `onMouseEnter` (and `onFocus` on mousedown) set `active = id`, then `onClick` sees `active === id` and sets `null`. A mouse click therefore clears the highlight it just set; only keyboard and touch work as designed.
- Fix: make hover a separate « preview » state, or drop the toggle in `onClick` (`setActive(g.id)`) and clear on `onMouseLeave` / Escape.

### 5.3 Duplicated hooks and helpers — **minor**
- `components/story/useWidth.ts` and `components/simulator/useWidth.ts` are two different `useWidth` implementations (initial 720 vs 0, clamp 240 vs none). Move one to `components/charts/useWidth.ts`.
- `components/story/AgencyList.tsx:14` re-implements accent folding. Use `lib/search.ts` `normalize`.
- There are two CSV download mechanisms: a Blob plus a temporary `<a>` (`NichesExplorer.tsx:521-531`, `AgencyList.tsx:58-66`), and `csvDataUri` (`ChartFrame.tsx:72`, `CasTypes.tsx:96`). Add one `downloadCsv(name, columns, rows)` in `lib/csv.ts`.

### 5.4 Dead code — **nit**
Defined but never used outside their file or tests:
- `components/charts/useColorMode.ts` (the whole hook)
- `lib/sim/cas-types.ts:129` `stateHash`
- `lib/format.ts` `formatEuroPerMonth`
- `lib/sim/result.ts` `deltaText`
- `lib/etat-data.ts` `manifestoClaims`
- `lib/facts.ts` `sourceLine`
- `lib/dates.ts` `formatMonthYearFr`
- `lib/chart-theme.ts` `resolveColor`, `otherColor`, `chrome`
- `lib/plan-data.ts` `SANKEY_NARROW`
- `components/ui/icons.tsx` `IconAlert`
- `components/simulator/InputForm.tsx` exported `STEP_LABEL`/`MAX_CHILDREN` (used only internally)

Delete them, or run `knip` in CI.

### 5.5 Small things — **nit**
- `Simulator.tsx:234`: `comparison?.activeHypotheses.length ?? 4` is a magic fallback. Use `null` and hide the count.
- `Simulator.tsx:75-78`: `sameState` calls `JSON.stringify` on the household twice per render. Fine at this size; a cheap structural compare would do.
- Hydration: there is no `Math.random`, `Date.now` or `matchMedia` in render paths. `usePhone` uses `useSyncExternalStore` with a server snapshot. Explorers read the hash in effects. No mismatch found.

---

## 6. Performance

### 6.1 Per-page JS (gzip), from `site/dist/_astro`
| Chunk | raw | gz | Loaded by |
| --- | --- | --- | --- |
| `client.*.js` (React DOM) | 215 kB | 67 kB | every page with an island |
| `PlotFigure.*.js` (Observable Plot + d3 parts) | 179 kB | 63 kB | simulateur, comprendre charts |
| `Hypotheses.*.js` (actually the **engine** + params, hoisted into this chunk) | 173 kB | 41 kB | simulateur, cas-types |
| `Simulator.*.js` | 91 kB | 27 kB | simulateur |

`/simulateur/` needs about 200 kB gz of JS before it is interactive, all `client:load`. That is borderline for VISION « interactive < 2 s on mid-range 4G ». **minor**:
- Lazy-load `EarningsCurve` (and so Plot) below the fold with `React.lazy` + `Suspense`, or split it into its own `client:visible` island. Plot is not needed for the headline.
- The engine chunk is named `Hypotheses` because Rollup picked the first importer. Add a `manualChunks: { engine: ['@epjn/engine'] }` so budgets and caching are readable.

### 6.2 Heavy HTML — **minor**
- `comprendre/calendrier/` is 526 kB (49 kB gz) and `comprendre/amendements/` is 502 kB (45 kB gz). Most of it is SSR markup: 284 and 245 inline `<svg>` icons repeated per item, plus about 100 kB of serialized island props each. Use an SVG `<symbol>` sprite with `<use href="#i-…">`, and pass ids instead of whole objects in props where the island can import the JSON itself.
- `niches.json` loading is done right: a static endpoint at `pages/data/niches.json.ts`, 249 kB raw, fetched with an `AbortController`, base-prefixed via `withBase`. One improvement: it is fetched eagerly on `client:load` even when the visitor never filters. Fetch on the first interaction, or on `requestIdleCallback`.

### 6.3 Engine work per simulator change — **minor**
Measured in Node: `compare` takes about 0.5 ms; `earningsCurve` (121 points) takes about 73 ms cold; the 47 cas-types take about 70 ms. Every committed change in the simulator runs compare, 4 transition compares, the curve and `hourOfWork` on the main thread, which is likely 200–400 ms on a mid-range phone. Recompute the curve with `useDeferredValue`, or only when its section is visible, or step it at 200 € on phones.

---

## 7. Accessibility

- **minor**: `components/explorer/StepCharts.tsx:222-226`: data points react to `onPointerEnter`/`onPointerDown` only, with no keyboard access. The ChartFrame table keeps the data available, but the « active point » readout is pointer-only. Add a roving `tabIndex` or arrow-key handling, or make the readout table-driven.
- **nit**: `components/ui/DataTable.tsx:16-17`: the default cell formatter is `String(v)`, which bypasses `lib/format.ts`. 1234.5 renders as « 1234.5 ». Only the styleguide shows it today (`<td>1234.5</td>`), but any future numeric column without `format` will leak English formatting. Default numeric cells to `formatNumber(v)`.
- **nit**: `e2e/no-third-party.spec.ts:23-26` visits each page without scrolling, so `client:visible` islands (most of /comprendre) never hydrate during the « no foreign request » check. Reuse `scrollThrough()` from `story.spec.ts`.
- What works: axe (wcag2a/aa/21/22) runs on every page in light and dark mode and at 320 px reflow; live regions in the simulator are deliberate; `SourceChip` and tier marks use icon + text + border, not colour alone.

---

## 8. Security and privacy

No blocker or major issue.
- There is no `dangerouslySetInnerHTML`, `set:html`, `innerHTML`, `eval` or `new Function` anywhere in `site/src`.
- The hash payload (`engine/src/state.ts`) is a versioned, length-capped (20 000) base64url JSON array of numbers and enum indexes. Garbage, wrong versions, bad shapes and NaN or Infinity all return `null`. There is no string field, so no XSS path.
- No third-party request appears in the build: all `https://` occurrences are outbound source links (`<a href>`). Fonts are self-hosted. There is no analytics. `localStorage` is used only for the theme (`epjn-theme`), wrapped in try/catch.
- **nit**: `pages/a-propos.astro:8` hard-codes `https://github.com/Pierrolo/…`. Move it to `lib/site.ts` (`SITE.repo`) so a fork or transfer changes it in one place.

---

## 9. Information architecture and consistency

- **minor**: `/comprendre/europe/` reuses `EuropeBlock`, already on `/comprendre/depenses/`. `/comprendre/agences/` reuses `AgenciesBlock`, already on `/comprendre/etat-partout/`. VISION §4 places them as sections of those pages. Two URLs carry identical content with self-canonicals, and two hub cards lead to content seen elsewhere. Either keep the stand-alone pages and drop the duplicate section (link to it instead), or set `canonical` to the main page.
- **nit**: `lib/site.ts:46-90` titles « Les 465 niches fiscales » and « Les 81 amendements » sit next to the hub text « 486 niches » used on other pages (`TaxNicheGrids.tsx:68`, landing). The two perimeters are explained on /niches, but the hub card could say « 465 niches (hors taux réduits de TVA) » to avoid looking inconsistent.

---

## Summary of blockers and majors

| # | Severity | Item |
| --- | --- | --- |
| 1.1 | blocker | `pnpm lint` fails (Prettier on 2 engine files), so CI is red |
| 2.1 | blocker | `/methode` ships 6 « TODO(builder) » placeholders. The content exists in `docs/METHODE.md` |
| 1.2 | major | Deploy is not gated on CI (no lint or e2e before publishing) |
| 3.1 | major | Simulator and cas-types charts label engine output « Écrit dans la loi » |
| 4.1 | major | A shared simulator link shows the default household's € result until hydration, and without JS |
