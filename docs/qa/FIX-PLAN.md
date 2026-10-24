# Fix plan — round 1 (after code review + 8 unbiased user tests)

Sources: `docs/qa/code-review.md`, `docs/qa/audit.md` (when present), `docs/qa/users/*.md` (Nadia, Thomas, Élise, Marc, Josiane, Samir, Camille, Hugo).
Owner: orchestrator. Workstreams are split by file ownership to avoid conflicts.

## What users told us (synthesis)

Every single tester:
1. Hit the **empty /methode page** ("TODO(builder)") — the #1 trust killer.
2. Took the **default "+115 €" result** shown before answering as their own.
3. Found **"Votre heure de travail" contradicting the headline** (you keep less per hour, yet the household gains).
4. Asked **"where does the money come from?"** — no plain sentence explains the result; « AFU » is opaque.
5. Drowned in **jargon** (AFU, ASPA, ASF, CEE, BMAF, UC, TMEF, « différentiel », H1/H2) and in a **result page 11 000–34 000 px long**.

Plus: the **« Écrit dans la loi » label** misleads (amendments are proposed, not voted; it was even stuck on simulator outputs); « Annoncé » items said to be "outside disposable income" while the end of RSA/PA is counted; **unquantified losses are buried** far from the headline (Marc, Camille); **childcare not counted** (Thomas); **no child-support question** (Hugo); **fonctionnaires get no warning** about post closures (Camille); **business owners** have no option (Samir); 465 vs 486 niches; « 0,0 % »; step count jumps 4→5; « Je saisis mon salaire » for the partner; no « veuf/veuve »; waterfall header overlaps on tablet; rounding 940 vs 945; « docs/METHODE.md » leaked in UI; duplicated sources; shared link doesn't show the answers.

## Design decisions (orchestrator)

- **Result page = 3 layers.** (1) *En clair*: headline + 3-line plain summary (what you gain, what you lose, why) + certainty line + the compact "non compté" strip with the household's prominent unquantified losses. (2) *Le détail*: waterfall, open. (3) *Pour aller plus loin*: everything else collapsed by default (heure de travail, si je gagnais plus, transition, cas proches, hypothèses, ce qui n'est pas compté), with a small sticky in-page nav on desktop. Target: layers 1+2 fit in ~3 phone screens.
- **No result before the user has answered.** Before the first meaningful input (activity + income or pension) the result panel shows an explicit, greyed **« Exemple : personne seule au SMIC »** or an empty state « Répondez aux questions pour voir votre résultat ». No fields pre-filled with a value except where a default is truly neutral; married/PACS is an explicit unanswered question for couples.
- **Tier vocabulary, plain first.** Rename everywhere:
  - `law` → **« Proposé dans un amendement »** (short: « Amendement proposé ») with the explanation « texte précis rédigé par les auteurs, ni déposé ni voté ».
  - `announced` → **« Promis par les auteurs »** (« annoncé, sans texte précis »).
  - `hypothesis` → **« Notre estimation »** (« choix du simulateur là où le texte est muet »).
  - Simulator outputs carry **no tier**; each line carries the tier of the rule that drives it. The landing copy must say *promises without an amount are shown apart; the authors' announced replacement of RSA / prime d'activité / AAH is counted by default (they say the AFU replaces them) and can be switched*.
- **Hour of work** uses the engine's new `youKeepIncludingTransfers` / `netIncomeTaxPerHour` (negative tax = « l'État vous verse »), so it can never contradict the headline; one sentence explains it.
- **Both readings of H1** side by side when they differ (engine `h1Alternative`).
- **Glossary**: one `site/src/data/glossaire.json` (plain definitions), rendered as click/tap toggletips (`<button aria-expanded>`), never hover-only; every acronym on first use per section.
- **« Qui gagne, qui perd ? »**: no « 37 sur 47 » headline counter; lead with the pattern in words + caveat.
- **New page `/comprendre/situations`**: « Ce que le plan prévoit pour… » the book's 18 situations (fiches.json — tier « promis »), linked from the simulator by profile (fonctionnaire → agent public / enseignant; retraité; chef d'entreprise → entreprise; parent; locataire; handicap…).

## Workstreams

### A — Engine (in progress)
CMG + crédit garde; child support → ASF; `summary`; `baselineBenefitsExplained` (zero reasons); hour-of-work consistency fields; `h1Alternative`; `deltaPct: number|null`; `dirigeant_assimile` + `tns` warning + `employerView()`; `roundForDisplay()`; `prominent` unquantified losses.

### B — Simulator UX (`site/src/components/simulator/**`, `site/src/lib/sim/**`, `site/src/pages/simulateur/**`)
Everything in "Design decisions" that touches the simulator, plus: form fixes (seul·e → « Seul / seule (célibataire, veuf ou veuve, divorcé…) », hide salaried fields for retirees, « Son salaire » for the partner, fixed step count, child-support question for lone parents, childcare cost when a mode is chosen, dirigeant/TNS options, zone helper with concrete examples + « je ne sais pas → zone 2 »); answers recap on the result + in shared links; Web Share API with copy fallback; pre-render guard for shared links (inline script hides the default result when a hash is present + `<noscript>` notice); share copies the current valid state; decoded hash goes through form validation; investigate Marc's "field shows 1 400 but calc uses 1 478" bug (NumberInput commit/debounce) and add an e2e regression; waterfall header overlap at 820 px; « 0,0 % » → « — »; remove `docs/METHODE.md` leak → link `/methode#h1`…; dedupe sources; « Et pour mes salariés ? » mini-panel via `employerView()` for salaried/dirigeant users; fonctionnaire prominent warning; lazy-load secondary islands (≈200 kB gz upfront today).

### C — Content, dashboard, infra (`site/src/pages/**` except simulateur, `site/src/components/story|explorer/**`, `site/src/lib/facts*`, `.github/**`, docs)
`/methode` rendered from `docs/METHODE.md` (with anchors per hypothesis, the tier vocabulary, the gap table) + e2e "no `TODO(` on any page"; landing: simulator CTA above the fold on mobile, simpler hero, 63 € caveat visible; 465 vs 486 explained consistently (« 465 niches + 21 taux réduits de TVA = 486 »); ministries « 9 » vs « 16 → 7 »; 57,3 % explanation; workbook links name sheet + cell; one default « par foyer » denominator site-wide with a footnote (conflicts listed on /methode); `/comprendre/situations` page; glossary JSON + toggletip component (shared, used by B); tier label rename in `lib/tiers.ts` + TierBadge (shared, used by B); hard-coded numbers → facts.json + a unit test that fails on unsourced numerals in pages (pragmatic allow-list); CI: `pnpm format`, deploy gated on CI success (`workflow_run` or single workflow with `needs`), pipeline `--check` in CI, e2e with production base path; react-hooks ESLint plugin; dedupe `useWidth`/CSV/accent-folding helpers; shrink calendrier/amendements HTML.

Order: C's shared bits (tier labels, glossary component) land first or are created by C under agreed paths: `site/src/lib/tiers.ts` (labels), `site/src/components/ui/Glossary.tsx` + `site/src/data/glossaire.json`. B imports them.
