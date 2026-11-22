# Performance and accessibility audit: « Et moi, dans tout ça ? »

Auditor: web performance + accessibility pass (QA agent), 2026-10-24. Target: the frozen static build in `scratchpad/qa-dist` (16 HTML pages, built **without** `SITE_URL`/`BASE_PATH`; repo HEAD is `1b6bac0`). Nothing in the repo was modified except this file.

## 1. Method and caveats

| Item | Detail |
| --- | --- |
| Server | `python3 -m http.server 4503` over `qa-dist`: **no compression, no cache headers**. A second run used a small Node server on :4504 that adds gzip (level 6) and `Cache-Control: max-age=600` to mimic GitHub Pages. Both sets of scores are given. |
| Lighthouse | 12.8.2, Chromium 1243 headless, mobile preset (Moto-G-class, 412 px, slow-4G + 4x CPU, `throttlingMethod: simulate`), one run per page (no median; expect ±3 points of noise). |
| axe-core | `@axe-core/playwright` 4.14, tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. 16 pages (the 12 requested + `/comprendre/agences/`, `/comprendre/europe/`, `/styleguide/`, `/404.html`), light and dark (OS `prefers-color-scheme` emulation, plus the theme toggle path), then about 50 interacted states (see 2.3). |
| Manual checks | Playwright scripts: heading outline (1280 and 390 px), landmarks, tab walk with focus-ring and obscured-focus test, control names, target size, reflow at 320 px and 640 px (= 200 % zoom), WCAG 1.4.12 text-spacing override, reduced motion, forced colors, grayscale, live-region mutation counting, custom contrast scan of every text node (light and dark, details opened), French typography on the rendered DOM and on the static HTML. |
| Not covered | External links (offline), real screen readers, Safari/Firefox rendering, real GitHub Pages headers. Lighthouse "JS bytes" only count scripts fetched before `load`: islands using `client:visible` (e.g. `/comprendre/depenses/`) show 0 until scrolled, hence the second JS column below. |

All scripts and raw JSON are in `scratchpad/qa/audit/` (`lh.mjs`, `axe-static.mjs`, `axe-states.mjs`, `manual.mjs`, `kbd.mjs`, `live.mjs`, `contrast.mjs`, `typo-dom.mjs`, `modes.mjs`, `extra.mjs`, `*.json`).

## 2. Scores

### 2.1 Lighthouse mobile, raw server (no compression), as requested

| Page | Perf | A11y | BP | SEO | LCP | CLS | TBT | JS at load (raw / gzip) | JS after scrolling (raw / gzip) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 99 | 100 | 100 | 100 | 2.1 s | 0.000 | 0 ms | 0 / 0 KB | 0 / 0 KB |
| `/simulateur/` | **75** | 100 | 100 | 100 | 4.6 s | 0.000 | 216 ms | 741 / 234 KB | 741 / 234 KB (28 files) |
| `/simulateur/cas-types/` | **78** | 100 | 100 | 100 | 4.2 s | 0.000 | 230 ms | 465 / 138 KB | 465 / 138 KB (19 files) |
| `/comprendre/` | 91 | 100 | 100 | 100 | 3.5 s | 0.002 | 0 ms | 4 / 2 KB | 234 / 76 KB (12 files) |
| `/comprendre/depenses/` | 87 | **99** | 100 | 100 | 3.5 s | 0.000 | 0 ms | 0 / 0 KB | 298 / 100 KB (17 files) |
| `/comprendre/etat-partout/` | **72** | 100 | 100 | 100 | 5.3 s | 0.000 | 0 ms | 234 / 76 KB | 307 / 105 KB (26 files) |
| `/comprendre/le-plan/` | 95 | 100 | 100 | 100 | 2.7 s | 0.000 | 0 ms | 247 / 81 KB | 307 / 104 KB (20 files) |
| `/comprendre/niches/` | 80 | 100 | 100 | 100 | 4.3 s | 0.000 | 0 ms | 292 / 97 KB | 292 / 97 KB (16 files) |
| `/comprendre/calendrier/` | **68** | 100 | 100 | 100 | 5.7 s | 0.000 | 69 ms | 284 / 93 KB | 314 / 104 KB (17 files) |
| `/comprendre/amendements/` | **69** | 100 | 100 | 100 | 5.6 s | 0.000 | 8 ms | 239 / 78 KB | 239 / 78 KB (12 files) |
| `/methode/` | 99 | 100 | 100 | 100 | 2.1 s | 0.000 | 0 ms | 0 / 0 KB | 0 / 0 KB |
| `/a-propos/` | 99 | 100 | 100 | 100 | 2.1 s | 0.000 | 0 ms | 0 / 0 KB | 0 / 0 KB |

Why the low scores are an artefact: LCP is a text paragraph on every page (`p.lede`, element-render delay 100–240 ms), so LCP follows FCP, which is gated by the uncompressed HTML (up to 544 KB for `/comprendre/calendrier/`) plus the render-blocking 62 KB CSS on a simulated 1.6 Mbit/s link. The same pages gzip to 12–48 KB of HTML and 12.5 KB of CSS (`gzip -9`: `index.html` 26 KB → 6.6 KB; `calendrier` 544 KB → 48 KB; `amendements` 520 KB → 45 KB; `etat-partout` 385 KB → 47 KB; all JS 939 KB → 291 KB; CSS 62 KB → 12.5 KB; fonts are already woff2 and do not shrink).

### 2.2 Lighthouse mobile, gzip + 10 min cache (GitHub Pages-like)

| Page | Perf | A11y | BP | SEO | FCP | LCP | CLS | TBT | Total transfer (est.) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 100 | 100 | 100 | 100 | 0.8 s | 1.7 s | 0.000 | 0 ms | 132 KB |
| `/simulateur/` | 97 | 100 | 100 | 100 | 1.3 s | 2.3 s | 0.000 | 150 ms | 387 KB |
| `/simulateur/cas-types/` | 96 | 100 | 100 | 100 | 1.2 s | 2.4 s | 0.000 | 155 ms | 281 KB |
| `/comprendre/` | 99 | 100 | 100 | 100 | 1.2 s | 2.1 s | 0.002 | 0 ms | 214 KB |
| `/comprendre/depenses/` | 99 | 99 | 100 | 100 | 1.4 s | 2.1 s | 0.000 | 0 ms | 316 KB |
| `/comprendre/etat-partout/` | 97 | 100 | 100 | 100 | 1.1 s | 2.3 s | 0.000 | 147 ms | 277 KB |
| `/comprendre/le-plan/` | 100 | 100 | 100 | 100 | 0.9 s | 1.8 s | 0.000 | 5 ms | 251 KB |
| `/comprendre/niches/` | 99 | 100 | 100 | 100 | 1.2 s | 2.1 s | 0.000 | 0 ms | 294 KB |
| `/comprendre/calendrier/` | 98 | 100 | 100 | 100 | 1.4 s | 2.3 s | 0.000 | 59 ms | 278 KB |
| `/comprendre/amendements/` | 92 | 100 | 100 | 100 | 2.1 s | 2.9 s | 0.000 | 132 ms | 248 KB |
| `/methode/` | 100 | 100 | 100 | 100 | 0.8 s | 1.7 s | 0.000 | 11 ms | 130 KB |
| `/a-propos/` | 100 | 100 | 100 | 100 | 0.8 s | 1.7 s | 0.000 | 22 ms | 131 KB |

On compressed hosting the site is fast. Remaining Lighthouse flags: `dom-size` (> 1,400 nodes) on 9 pages, `unused-javascript` (109–305 KB) on 8, cache TTL (GitHub Pages fixes it at 10 min), render-blocking CSS (12.5 KB gz, acceptable). Accessibility is 100 everywhere except `/comprendre/depenses/` (99: heading-order, finding m3).

### 2.3 axe-core summary

| Scope | Result |
| --- | --- |
| 16 pages × light/dark (32 runs) | **0 violations except `region` (best-practice, moderate)** on every run (finding m2). |
| About 50 interacted states × light/dark (simulator with results, waterfall rows all expanded, all `<details>` open, couple + children, invalid inputs, period "2027", hypotheses toggled, high income, mobile stepper, 4 steps + result, cas-types with 2028/% du revenu, hub revealed, depenses tabs Tableau/Sources/unit switch/zoom/Europe toggles, niches search+chip+switch / year+sort+page 2 / empty result, calendrier filter + marker, amendements search+select, agences search/slider/"Afficher plus", le-plan year1+handicap+node+age, Europe income+country) | `region` everywhere, plus: `label-content-name-mismatch` ×1 (m4) and `target-size` ×2 (m5). Nothing else. |
| "Needs review" (incomplete) | `color-contrast` 1–140 nodes per page (hatched/gradient/`color-mix` backgrounds, 140 on `/comprendre/calendrier/`), `aria-prohibited-attr` on Plot axis `<g>` (m9), `th-has-data-cells` on one table. My own contrast scan (about 8,500 text nodes per theme, 17,000 in total, details open, solid backgrounds: **0 failures** in light and dark; sanity-checked against injected low-contrast text) covers all but the gradient-backed nodes (about 1.4 % of text nodes), which I could not verify automatically. |

## 3. Findings

Severity scale: **blocker** = must not ship; **major** = fails a stated requirement or WCAG 2.2 AA in normal use, or touches every page; **minor** = real but local or low-impact; **polish**.

### 3.1 Blocker

#### B1. `/methode/` ships six visible `TODO(builder)` placeholders

- Evidence: the rendered page has six dashed boxes reading "TODO(builder) · Liste des mécanismes modélisés", "… Liste des limites", "… Tableau H1 … Hn", "… Liste des sources", "… Table des écarts", "… Changelog", each with a note like « À écrire (VISION §6 et §9). ». They are the page's whole substance: the hypothesis register, sources, gaps with official simulators and changelog. The header nav, the simulator ("Méthode" links) and the footer all point to this page, and its title/meta description promise "ses hypothèses et ses sources". It scores 100/100/100/100 in Lighthouse, so tooling will not catch it.
- Fix: write the six sections in `site/src/pages/methode.astro` (the TODO comments at lines 60, 74, 84, 92, 100, 111 say what each needs), then delete `site/src/components/site/Todo.astro`. Add an e2e guard in `site/e2e/` that fails the build when `main` contains `TODO(builder)`, `À écrire` or `data-todo`.

### 3.2 Major

#### M1. French typography: regular spaces before `: ; ? »` and after `«` almost everywhere

- Evidence (rendered DOM, 14 pages at 1280 px, `<details>` open; `scratchpad/qa/audit/typo-dom.json`):
  - before `; : ! ? »`: **1,518** regular spaces (998 before `:`), against **0** U+202F and only 34 U+00A0 (all in the "Source :" / "Sources :" label, which is hand-coded with `&nbsp;`);
  - after `«`: **341** regular spaces, **0** non-breaking; before `»` the same;
  - hard-coded figures in prose with regular spaces: 268 "digit + space + `%`/`€`" (e.g. « 80 % ou plus », « 10 % pour frais professionnels »), 62 grouped numbers (« 10 000 € », « 1 104 agences », « 61 400 emplois », « 2 190 € »), 8 "10%" with no space (niche titles from data);
  - consequence, measured with `Range.getClientRects`: **66 orphan wraps at 390 px** (a line starts with `:`, `;`, `%`, `€` or `»`), e.g. « Zone euro / : 49,4 % » on `/comprendre/depenses/` and `/comprendre/europe/`, « Déduction de 10 / % pour frais professionnels » on cas-types (6), « fait générateur / : non borné » on niches (28), « Prêt à taux zéro / : les intérêts payés » on calendrier (15), amendements (10). 25 more on desktop at 1280 px.
  - The brand « Et moi, dans tout ça ? » itself (header, footer, `<title>` of every page, 404, OG image) has a regular space before `?`.
  - What is right: numbers produced by `site/src/lib/format.ts` use U+202F for thousands and U+00A0 before `€`/`%` (1,622 occurrences). The convention is consistent there; prose does not follow it. « » are consistently used (no straight or English quotes anywhere).
- Fix:
  1. One codemod over `site/src/pages/**/*.astro` and `site/src/components/**/*.tsx` that touches only JSX text nodes and string literals (use the TypeScript AST: `JsxText`, `StringLiteral`, `NoSubstitutionTemplateLiteral`, template heads/middles; **do not** regex the whole file, `a ? b : c` is everywhere): `(?<=[^\s]) ([;!?])` → ` $1`, ` :` → ` :`, `« ` → `« `, ` »` → ` »`, `(\d) ([%€])` → `$1 $2`, `(\d) (\d{3})\b` → `$1 $2`. About 900 source lines are concerned.
  2. For text that comes from data (`site/src/data/*.json`, `site/src/lib/*-data.ts`: niche titles, amendment summaries, agency names, calendar text) apply the same function once at load time, or in `pipeline/` so the JSON is clean.
  3. Export `typo(s)` from `format.ts` (next to `NBSP`/`NNBSP`) and use it for the few dynamic strings.
  4. Add a Playwright guard (`site/e2e/typography.spec.ts`): on every page `main.innerText` must not match `/[^\s  ] [;:!?»%€]|« /`.
  5. The `<title>`/brand: put `ça ?` in `SITE.name` (`site/src/lib/site.ts`) and in `site/scripts/make-og.mjs`.

#### M2. Forced colors (Windows High Contrast): several chart encodings disappear

- Evidence (Chromium `forcedColors: 'active'`, screenshots in `scratchpad/qa/audit/shots/forced*.png`). Background-colour-only shapes are repainted as Canvas, so the bar is simply gone and only labels remain:
  - Simulator waterfall (`site/src/components/simulator/Waterfall.tsx`): rows of tier "law" (Salaire net, Impôt sur le revenu, AFU) and the final "Avec le plan" bar are invisible, while "announced" (dashed) and "hypothesis" (dotted) rows keep an outline: the chart then suggests that only unsure items have bars. The "Écrit dans la loi" legend swatch is also blank.
  - "Votre heure de travail" stacked bars (`simulator/HourOfWork.tsx:223`) and the hub/plan "Sur une heure de travail" bar (`story/HourBar.tsx:109`): whole bar vanishes (empty band above the numbers).
  - Europe bar chart (`story/EuropeSection.tsx`, bars around lines 270-320): **all 30 bars vanish**, only country names and values remain.
  - Dépenses treemap tiles (`.tm-t`, `.tm-box` in `site/src/components/story/story.css`): tile fills vanish, rectangles have no edges, so the structure cannot be read.
  - "Si je gagnais plus ?" legend swatches (`simulator/EarningsCurve.tsx`) and the ministries dot legend ("Maintenus" vs "Regroupés" look identical).
  - Fine in forced colors: Sankey, lifecycle area chart, calendrier step charts, cas-types tiles (outlined, with arrows and signs), niches stacked bars (they already carry `forced-color-adjust-none`), source chips, tier badges (dashed/dotted borders), tabs, focus rings. Numbers and arrows stay, so no information is lost entirely, hence "major" and not "blocker".
- Fix: give every filled shape a system-colour fallback in the existing `@media (forced-colors: active)` block of `site/src/styles/global.css`, e.g. a shared class `.chart-fill { forced-color-adjust: none; }` for categorical fills that already have text labels, or `background-color: CanvasText; border: 1px solid CanvasText` for single-colour bars (waterfall law bars, final bar, Europe bars, HourBar segments with `border: 1px solid CanvasText` to separate them). For the treemap: `.tm-t { outline: 1px solid CanvasText }`. Add a forced-colors screenshot test for waterfall, treemap, Europe.

#### M3. The fixed "live result" bar covers focused elements on phones (WCAG 2.4.11 Focus Not Obscured, AA)

- Evidence: at 390 × 844, tabbing through `/simulateur/` with the bar visible, 4 of 23 stops sit under `div[data-testid=live-bar]` (`fixed inset-x-0 bottom-0 z-40`, `Simulator.tsx:365`): the footer links « Le plan en un schéma » (half hidden), « Les 465 niches fiscales » and « Toutes les pages → » (fully hidden) are covered when focused, and in the form view the stepper's **« Suivant » button is covered by the bar's own « Voir le détail »** button (`elementFromPoint` at the button's centre returns the bar's button). `html` only has `scroll-padding-top` (`site/src/styles/global.css:158`), nothing at the bottom.
- Fix: `html:has([data-testid='live-bar']) { scroll-padding-bottom: 5.5rem; }` (bar height + margin) and, in `Simulator.tsx`, render the bar only while it does not duplicate the stepper actions (it already hides `Voir le détail` in result view; do the same while the step footer is on screen).

#### M4. Every page with a number logs a font warning: the custom narrow-space font is rejected by the browser

- Evidence: 28 of 32 page loads (every page except `/methode/`, `/a-propos/`, `/404.html`, which contain no U+202F) log two console warnings: `Failed to decode downloaded font: data:font/woff2;base64,…` and `OTS parsing error: glyf: zero-length table`. Cause: `site/src/styles/epjn-space.woff2` (312 bytes, `@font-face 'EPJN Narrow Space'`, `unicode-range: U+202F`, `global.css:54`) has a `glyf` table with no outlines, which Chromium's sanitizer refuses; `document.fonts` reports `error`. So the font that is supposed to guarantee a narrow-space glyph for every thousands separator never applies and rendering falls back to whatever system font has U+202F. It looks right in Chromium/Linux; other platforms are untested. This is the only console message on the whole site (0 errors, 0 failed requests, 0 4xx).
- Fix (verified in Chromium): give `.notdef` one tiny contour so `glyf` is non-empty. With fontTools: `pen = TTGlyphPen(f.getGlyphSet()); pen.moveTo((0,0)); pen.lineTo((0,1)); pen.lineTo((1,1)); pen.closePath(); f['glyf']['.notdef'] = pen.glyph(); f.flavor='woff2'; f.save(...)` → `document.fonts` status `loaded`, no warning (test file: `scratchpad/qa/audit/fonttest/epjn-space-fixed.woff2`). Keep the U+202F advance of 200/1000 em. Add a console-warning check to the e2e smoke test (fail on any `warning` or `error`).

### 3.3 Minor

| ID | Finding and evidence | Fix |
| --- | --- | --- |
| m1 | **Premature error messages + chatty live regions in the simulator.** Typing a valid age "42" announces « Votre âge doit être compris entre 18 et 110 ans… » after the first digit (polite live region, then cleared); empty salary announces « Indiquez votre salaire mensuel… » while the user is still typing. After each committed change (250 ms debounce) two live regions announce a 257-character headline sentence and a 108-character comparison (≈ 365 characters per change). On `/comprendre/le-plan/` each arrow press on the age slider announces a 138-character paragraph (10 presses → 10 announcements). Other live regions are fine: niches/amendements/agences announce one short result count per pause (1-4 per scenario). | Show range/empty errors on blur (or after ~800 ms idle) in `site/src/components/ui/NumberInput.tsx` (`message = error ?? parseError ?? rangeError`) and `site/src/lib/sim/form.ts` errors; in `Headline.tsx` announce only « +360 €/mois (+17 %) » and keep the long sentence as static text; on the le-plan slider set `aria-valuetext` and drop `aria-live` from the detail block (or debounce it). |
| m2 | **`region` (axe, moderate): the independence strip is outside every landmark** (`<div class="border-b border-rule bg-sunken…">« Outil indépendant, non affilié… »` sits before `<header>`), on all 32 runs and all 40 states. | Move that `<p>` inside the `<header>` in `site/src/components/site/Header.astro` (lines 9-16 → inside line 18's `<header>`), or give the wrapper `role="region" aria-label="Indépendance"`. |
| m3 | **Heading skip h2 → h4 on `/comprendre/depenses/` at phone width** (Lighthouse a11y 99; confirmed at 390 px: « Sécurité sociale et solidarité » `<h4>` follows an `h2`). At 1280 px that block is not rendered. | `site/src/components/story/CofogBars.tsx:50`: `h4` → `h3`. |
| m4 | **WCAG 2.5.3 Label in Name (level A): cas-types tiles with a zero delta.** Visible text "0,0 %" but `aria-label` says « … : pas d'écart. Ouvrir dans le simulateur. » (axe `label-content-name-mismatch`, appears once the period is switched to 2028). Voice-control users cannot say what they read. | `site/src/components/simulator/CasTypes.tsx:259-263`: `r.delta === 0 ? '0 €, 0,0 %, pas d’écart'` (include the visible figures). |
| m5 | **Treemap tiles smaller than 24 × 24 px** after unit change/zoom (axe `target-size`: `Santé n.c.a.` 62.5 × 12.7 px, `Protection sociale n.c.a.` 16 × 117 px). The same data is reachable through the bar list and the "Tableau" tab, which counts as an equivalent control under 2.5.8, so this is minor. Elsewhere axe passes: controls are ≥ 44 px (`min-h-11`); standalone source links in the calendrier/amendements details are only 19-22 px high (`Voir le texte (PDF)` 144 × 22, `Toutes les pages « Comprendre »` 239 × 19) and pass through the spacing exception. | Hide tiles below ~24 px from the tab order (`tabindex=-1`, label in the list) or merge tiny tiles into "Autres"; give those links `min-h-6 inline-flex items-center`. |
| m6 | **Text spacing (WCAG 1.4.12): two spots lose text.** With the standard override (line-height 1.5, letter-spacing 0.12 em, word-spacing 0.16 em, paragraph 2 em): treemap labels (`button.tm-t`, `span.tm-name`, e.g. « Intérieur (police, sécurité civile) ») and niche titles clamped with `line-clamp-3` (7 new truncated titles on `/comprendre/niches/`). Reflow itself is clean: no horizontal scroll on any of the 14 pages at 320 px or 640 px (200 % zoom). | Let the tile label wrap or move it to the tile detail; for niche titles keep `line-clamp-3` but make sure the expanded row repeats the full title (check that it does, and add `title` as a fallback). |
| m7 | **Straight apostrophes in data-derived text: 489 occurrences** (`Prime d'activité`, `certificats d'économies d'énergie` in the waterfall; `Crédit d'impôt…` in niches (104), amendements (250), calendrier (73), agences, ministères) against 1,494 typographic `’` in hand-written copy. | Normalise at load/pipeline: `.replace(/(\p{L})'(\p{L})/gu, '$1’$2')`. |
| m8 | **Date format inconsistencies in data text:** « au 1 juillet 2027 » (should be « 1er ») on `/comprendre/etat-partout/` and `/comprendre/agences/` (3); ISO `2027-01-01` shown in the calendrier data table (36). The other 636 dates are consistently « 1er janvier 2027 ». | Format the table column with the site's date helper (`site/src/lib/dates.ts`); fix the 3 strings in the source text. |
| m9 | **Plot SVGs are not `role="img"`**: Observable Plot leaves axis `<g aria-label="y-axis tick label">` etc. exposed (axe "needs review": `aria-prohibited-attr`, 4 nodes on the simulator earnings curve). | In `site/src/components/charts/PlotFigure.tsx`, set `role="img"` on the `<svg>` and `aria-hidden="true"` on its children (the figure already has summary + table). |
| m10 | **No `<noscript>` on `/simulateur/`.** Without JavaScript the page shows the full form (44 inputs, SSR) that does nothing. `/comprendre/niches/` and `/comprendre/` do have noscript notes; `/comprendre/depenses/` islands rely on the ChartFrame summary/table. | Add a `<noscript>` callout in `site/src/pages/simulateur/index.astro` and hide the dead form with `<noscript><style>…</style></noscript>`. |
| m11 | **Performance on a plain (uncompressed) host.** `/simulateur/` loads 741 KB JS (234 KB gz): `client` (react-dom) 215 KB, `PlotFigure` (Observable Plot + d3) 179 KB, engine chunk `Hypotheses` 173 KB, `Simulator` 91 KB; 305 KB flagged unused. Plot is only needed for the below-the-fold earnings curve. `/comprendre/amendements/` (4,029 DOM nodes, 520 KB HTML), `/comprendre/etat-partout/` (4,059 nodes, a 1,104-child list) and `/comprendre/calendrier/` (3,893 nodes) are the heaviest; with gzip they score 92-98 with TBT up to 147 ms. About 115 KB of fonts load on every page (Fraunces 67 KB + Inter 48 KB), plus 52 KB Inter italic on `/comprendre/depenses/` and `/comprendre/europe/` (not preloaded, fetched late). | If hosting is GitHub Pages (gzip on) none of this blocks. Cheap wins: lazy-load `EarningsCurve` (`React.lazy` + IntersectionObserver) so Plot leaves the critical path; `content-visibility: auto; contain-intrinsic-size` on the amendments/agencies/calendar rows; drop or preload the italic; subset Fraunces to the used axes. |
| m12 | **Sitemap/robots.** No `sitemap.xml` (no `@astrojs/sitemap`), `public/robots.txt` is only `Allow: /` with no `Sitemap:` line. On a GitHub Pages project site `https://<user>.github.io/<repo>/robots.txt` is ignored by crawlers (only the host root counts). `/styleguide/` (noindex, unlinked, contains `https://example.org/` links) is still published. | Add `@astrojs/sitemap` (works because `site` is set in CI), exclude `/styleguide/` and `404`; consider not building `styleguide.astro` in production (`pages/_styleguide` or a build-time filter). |
| m13 | **Canonical / OG / Twitter image are absent from this frozen build** (no `canonical`, `og:url`, `og:image`, `twitter:image`; `twitter:card=summary`). By design: `BaseLayout.astro` only emits them when `Astro.site` is set, and `.github/workflows/deploy.yml` sets `SITE_URL` and `BASE_PATH`, so production should have them (and the default `og-default.png` is a good 1200×630, 74 KB image that uses the right wording). Not verifiable here. | After the first deploy, fetch the home page and check that `canonical`, `og:url` and `og:image` are present with the `/<repo>/` prefix, and look at one OG preview. Add the same check to the deploy workflow. |

### 3.4 Polish

- **Brand `<h1>` on the simulator**: `/simulateur/` has `<h1>Et moi, dans tout ça ?</h1>` (the site name, `pages/simulateur/index.astro`); the `<title>` says « Simulateur ». Prefer a descriptive h1 (« Ce que le plan changerait pour votre foyer ») and keep the brand in the header.
- **Duplicate headings**: `/comprendre/depenses/` has h2 « Où va l’argent public ? » right under the h1 of the same text, and h3 « Si l’argent public était 100 € » under an identical h2; `/comprendre/amendements/` has 21 identical `h3` « Retirer les crédits que la présente loi interrompt » (use the amendment number in the heading).
- **Short meta descriptions**: calendrier « Chaque mesure datée, sur une frise. » (35 characters), amendements, agences, etat-partout (< 70). Titles are unique and well formed; one `h1` per page; `lang="fr"` everywhere.
- **Inclusive middle dot** in 34 labels (« Seul·e », « Retraité·e », « Conjoint·e »): screen readers read it inconsistently; keep, or use full forms in `aria-label`.
- **Agency names** use ` - ` (hyphen with spaces, 50 occurrences: « ADEME - Agence… ») where an en dash ` – ` is expected; « 10% » without space in 8 niche titles (data).
- **Treemap focus order** jumps back and forth visually (3 back-jumps of 330-460 px on `/comprendre/depenses/`): expected for a treemap, the bar list provides a linear path.
- **Cache**: GitHub Pages serves `max-age=600`; hashed `_astro/*` assets could be immutable on a CDN (Cloudflare Pages/Netlify) if cache scores matter.

## 4. Checklist of requested items

| Check | Result |
| --- | --- |
| Lighthouse x 12 pages | Done, raw and gzip (section 2). |
| axe light/dark + interacted states | Done (2.3). Only m2, m4, m5 + needs-review items. |
| Heading hierarchy | One `h1` per page on all 14 pages; no skip at 1280 px; one skip at 390 px (m3). Duplicates in polish. |
| Landmarks | `banner`, labelled `nav`s (3-6 per page, all named), one `main`, `contentinfo`, `search` where relevant, labelled `aside` on the simulator. Strip outside landmark (m2). Skip link first, targets `main#main` (tabindex -1). |
| Keyboard / focus | Skip link is first stop; tab order follows the DOM (27-130 stops on the 5 pages walked, ends cleanly, no trap, no positive tabindex, no duplicate ids). Focus ring: 3 px solid accent (`#602E9D` light, `#D4BCFF` dark), offset 2 px; numeric inputs show it on the wrapper (`focus-within`), so they are fine. WAI-ARIA tabs respond to ArrowRight/End. Gaps: M3 (obscured on phones), treemap order (polish). |
| Form controls labelled | 100 % of the ~580 controls (14 pages) have an accessible name (label, `aria-label` or text); no placeholder-only fields; groups use `fieldset/legend`. |
| Live regions | See m1 (verbose headline, premature errors, slider). |
| Charts have text alternatives | Yes: every `ChartFrame` has a visible « Lecture. » summary, a data table, a CSV and sources; SVGs carry labels; heatmap tiles are links with full labels. Plot SVG role (m9). |
| Colour not sole signal | Yes: gain/loss use arrows + signs; tiers use hatching/dash + text badge; legends and direct labels on line charts; grayscale screenshots of waterfall, treemap, hour bars, cas-types stay readable. Text contrast: 0 failures on solid backgrounds in light and dark (custom scan), gradients unverified. |
| Target size 2.5.8 | axe: passes except treemap tiles (m5). |
| Reflow 320 px / zoom 200 % | Pass on 14 pages (no horizontal page scroll; wide tables scroll inside their own `overflow-x-auto` region). |
| Text spacing 1.4.12 | Pass except m6. |
| `prefers-reduced-motion` | Pass: no `@keyframes` in the codebase; global rule zeroes transitions (0 elements with a non-zero `transition-duration` under `reduce`, against 24-2,116 normally); `scrollIntoView` calls check the media query. |
| Forced colors | Fail for bars/tiles (M2). |
| French typography | M1 + m7 + m8; no English text found (a regex hit on "tax" was `taxés`), no straight or English double quotes, no `lorem`, `undefined`, `NaN`, `Infinity`, `null`, `[object` in rendered text or attributes (they only occur as code in the JS bundles). Only `TODO` hits: B1. |
| Broken links / assets | 1,882 internal `href/src` in 16 pages: **0 broken, 0 missing assets, 0 bad fragments** (state-hash links to `/simulateur/#v1.…` excluded). Another agent's `docs/qa/code-review.md` reports that a build with `BASE_PATH=/etat-partout-justice-nulle-part/` has no unprefixed URLs. External links (France Résolution, Insee, Eurostat, GitHub…) were not fetched. |
| Console | 0 errors, 0 failed requests; only M4's font warning. |
| 404 | `404.html` is well formed, `noindex, nofollow`, links go through `withBase`, assets are absolute. (`python -m http.server` shows its own 404 page, GitHub Pages serves `404.html`.) |
| SEO / sharing | Titles unique, descriptions present, `lang=fr`, `theme-color` light/dark, `og:*` and `twitter:*` text tags present, `robots=noindex` on 404 and styleguide. Gaps: m12, m13. |
| Theme toggle | Works both ways (OS light → dark and OS dark → light), persists after reload via `localStorage`, `aria-pressed` and label « Thème sombre » stay in sync, axe clean in both. |
| Bad state hash | `/simulateur/#v1.garbage` shows the « Lien incomplet » notice and falls back to defaults. |

## 5. Suggested order of work

1. B1 (content), M4 (one-file font fix), M3 (two lines of CSS).
2. M1 codemod + e2e guard (largest visible quality gain for a French public site).
3. M2 forced-colors fallbacks (one shared utility class).
4. m1-m4 (small component edits), then m7-m8 data normalisation.
5. m11-m13 when the hosting choice is final (compression and SITE_URL decide most of the Lighthouse story).
