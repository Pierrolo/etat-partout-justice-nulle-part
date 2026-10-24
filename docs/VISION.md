# VISION — « Et moi, dans tout ça ? »

*An independent, open-source companion to the book « État partout, justice nulle part » (Barrat, Marle, Mitterrand — Éditions Chronique, 2026).*

Status: v1 spec, written by the orchestrator. Inputs: `research/source-analysis.md`, `research/reform_parameters.json`, `research/sota-inspiration.md`, `research/baseline/*`.

---

## 1. Why this exists

The book makes a big, abstract claim — "the State is everywhere, so justice is nowhere; refocus it and give the money back" — and backs it with 7 workbooks and 81 amendments that almost nobody will read. Our job is to **de-abstract** it:

1. **"Et moi ?"** — In under a minute, a person sees what the plan would change *for their household*, in euros per month, with every euro traceable to an amendment or a stated hypothesis.
2. **"Où va l'argent ?"** — A visual, explorable walk through the book's data: 1 672 Md€ of public spending, 1 104 agencies, 486 niches, 49 million words of law, reframed at human scale (per household, per day, per hour worked).

**North-star sentence on the result page:** *« Avec le plan Résolution, en régime de croisière, votre foyer disposerait de **+212 €/mois** (+9 %). »* — one honest sentence, then the "why".

## 2. Principles (non-negotiable)

1. **Faithful *and* honest.** We present the plan as the authors wrote it — that is the point — but we never hide a loser. If a single RSA recipient renting in Paris loses, the simulator says so, plainly. Credibility *is* the product (cf. the 2024 « simulateur mensonger » lawsuit).
2. **Every number has a source.** Each parameter: value, unit, effective date, source (amendment n°, workbook cell, Légifrance/CAF URL). Each headline figure in the dashboard comes from `facts.json`; CI fails on an unsourced figure.
3. **Separate law from promise.** Three tiers, visually distinct everywhere:
   - **Écrit dans la loi** (amendment text) — solid.
   - **Annoncé par les auteurs** (fiches, manifesto, workbook; no legal text) — hatched / dashed, shown *outside* disposable income (e.g., CEP savings, asset restitution).
   - **Hypothèse du simulateur** (our choice where the text is silent) — listed in a visible hypotheses register, user-toggleable where it matters.
4. **Client-side only.** No backend, no tracker, no cookie, no third-party request, no runtime LLM. State in the URL **hash** (shareable, never logged).
5. **Independent, not official, not the authors.** Own visual identity. No DSFR, no Marianne, no Résolution logo. Clear banner: « Outil indépendant, non affilié à l'association Résolution ni à l'État. »
6. **Accessible by construction.** WCAG 2.2 AA; every chart has a text summary + data table; no hover-only info; keyboard everything; French number formatting via `Intl` (narrow NBSP).
7. **Fast, mobile-first.** Most visitors arrive from a phone via a shared link. Simulator interactive < 2 s on mid-range 4G.

## 3. Audience & key jobs

| Persona | Job to be done |
|---|---|
| Curious reader of the book / viewer of a TV segment | "Is this real? What would it mean for me?" → Simulator express |
| Sceptic / journalist | "Show me the assumptions and who loses." → Hypotheses register, cas-types heatmap, sources |
| Engaged citizen / supporter | "I want to explain it to others." → Shareable result card, dashboard stories |
| Policy nerd | "Show me the marginal rates and the transition." → Expert mode: MTR curve, 2027–2030 timeline |

## 4. Information architecture

```
/                      Landing: the promise, the 2 doors (Et moi ? / Comprendre), 3 big human-scale numbers
/simulateur            Simulator (express → result → détails)  — state in #hash
/simulateur/cas-types  "Qui gagne, qui perd ?" heatmap over ~40 standard households (pre-computed by the engine at build time)
/comprendre            Dashboard hub (scrolly intro + cards)
  /comprendre/depenses       1 672 Md€ : où va l'argent public (treemap COFOG, per-foyer/per-day reframing)
  /comprendre/europe         France vs Europe (spending % GDP, deficit, median income)  — OWID-style chart/table tabs
  /comprendre/etat-partout   L'État partout : ministères, agences, impôts, niches, CERFA, mots de loi (unit viz, growth line)
  /comprendre/le-plan        Le plan en un schéma : 236 Md€ → salaire net + épargne (Sankey) ; heure de travail 63 € (29/11/23)
  /comprendre/niches         Explorer les 465 niches fiscales (search, sort by cost, "me concerne ?")
  /comprendre/agences        Le sort des 1 104 agences (waffle + searchable list)
  /comprendre/calendrier     La transition 2027 → 2030 (timeline of every dated measure)
  /comprendre/amendements    Les 81 amendements, par thème (searchable)
/methode               Méthode & hypothèses: modelled / not modelled, hypotheses register, sources, gap table vs official simulators, changelog
/a-propos              Independence statement, licence, credits, contact (GitHub issues)
```

## 5. The simulator

### 5.1 Inputs — "Express" (≤ 6 questions, one screen on desktop, stepper on mobile)

1. **Votre foyer** : seul·e / en couple — + number of children (and ages bucket: <3, 3–13, 14–17, 18+ à charge).
2. **Votre activité** (per adult): salarié·e (salaire **net mensuel** — what people know; toggle brut), indépendant·e, sans emploi (indemnisé / non), retraité·e (pension nette), étudiant·e, inactif·ve.
3. **Logement** : locataire (loyer, zone 1/2/3 via a "ville" picker mapping to zone), propriétaire, hébergé·e. "Locataire depuis avant juin 2027 ?" matters for APL transition — default: existing lease.
4. **Situation particulière** : handicap (CMI invalidité), parent isolé.
5. (Optional) **Aides que vous touchez** — *computed by default* (RSA, prime d'activité, APL, AF…), displayed with "corriger si différent" override. Never ask people to type benefit amounts first.

"Affiner" (progressive disclosure): second earner details, frais réels, garde d'enfants, emploi à domicile, dons, épargne (Livret A / assurance-vie balance), consommation (to estimate TVA), public-agent-whose-post-is-removed scenario (grade, seniority).

### 5.2 Outputs

1. **The sentence** (headline, € and %), monthly, régime de croisière (2030 rules, 2026 € — no inflation modelling).
2. **Before → after waterfall**, one bar per measure: + salaire net (fin CSG/CRDS), − impôt à 23 %, + AFU, − prestations familiales, − RSA/prime d'activité, − APL, − TVA (estimation), etc. Each bar expandable → formula with *your* numbers + source chip ("Amendement PLF-P1 n° 28").
3. **Side-by-side table** "Aujourd'hui (règles 2026)" vs "Avec le plan", every component, monthly & yearly.
4. **"Hors revenu disponible" panel** (dashed): promises without legal amounts — CEP (300 €/mois annoncés), restitution du patrimoine (20 000 €/foyer annoncés), compte éducation (6 600 €/enfant/an annoncés) — shown with « montant fixé chaque année par la loi de finances ; 0 € par défaut dans le texte ».
5. **Calendrier personnel 2027 → 2030**: monthly disposable income line through the transition (CSG steps Jul–Dec 2027, AFU Jan 2028, APL –1/3 steps, TVA steps) — the transition is where real people get hurt or helped; show it.
6. **"Si je gagnais plus ?"** chart: disposable income vs gross earnings, today vs plan, with the marginal effective tax rate (0,77 € kept per € claim made visible vs today's cliffs). Expert toggle shows MTR line.
7. **"Les gens comme vous"**: where you sit in the cas-types heatmap / income decile.
8. **Hypothèses actives** list with toggles (see §6), and a share button (URL hash + generated OG-style summary card, client-side canvas → PNG download).

### 5.3 Modes of time
- **Régime de croisière (défaut)**: all measures fully phased in (2030 rules, existing pensions keep +3 300 supplement).
- **Année par année**: 2027, 2028, 2029, 2030 annual figures + monthly transition chart.

## 6. Modelling decisions (the hypotheses register v1)

| # | Where the text is silent | Default | Toggle? |
|---|---|---|---|
| H1 | RSA, prime d'activité, AAH, ASPA replaced by the AFU? (manifesto says « à la place de toutes les aides »; no amendment abrogates them) | **Replaced** (authors' stated intent) | Yes: "maintenus en complément" |
| H2 | 10 % frais professionnels deduction on wages survives the niche abolition? | **Maintenu** (common-law definition of income is an explicit exception) — *to be challenged* | Yes |
| H3 | Revenu net imposable after CSG/CRDS removal | = net salary (no non-deductible CSG left) − 10 % (if H2) | — |
| H4 | Employer-side: who captures removal of exonérations/taxe sur salaires? | Not modelled; CSG gain goes 100 % to employee (authors' claim) | No |
| H5 | TVA reduced rates → 20 %: pass-through to prices | **100 % pass-through**, budget shares by income decile (INSEE BdF) | Yes: 0 % / 50 % / 100 % |
| H6 | Unemployment benefit 13 → 6 months | Indemnisé·e: ARE annualised at 6/13 of current duration-weighted amount — *simplified; flagged* | — |
| H7 | CEP, patrimoine, compte éducation | Shown outside disposable income at authors' announced amounts, tagged "annoncé" | Show/hide |
| H8 | Taxe foncière unique | Not modelled (INSEE tariffs don't exist) — said explicitly | — |
| H9 | Pension indexation frozen | Régime de croisière in 2026 €: not modelled; timeline mode shows a "pouvoir d'achat" note | — |
| H10 | Shared custody / AFU split between separated parents | Not modelled (v1 assumes children in one foyer) | — |
| H11 | Couple: foyer fiscal = couple married/PACS; unmarried couple = 2 foyers fiscaux in IR but 1 ménage for CAF | Ask "marié·e/pacsé·e ?" only in Affiner; default married/PACS | Yes |

Anything not modelled appears in a **"Ce que le simulateur ne compte pas"** list on the result page (not hidden in /methode).

## 7. Architecture

```
/engine        @epjn/engine — pure TypeScript, zero deps except zod. No DOM.
  src/params/baseline-2026.json   (sourced, dated)
  src/params/plan-resolution.json (sourced: amendment refs)
  src/baseline/*.ts   salaire.ts, ir.ts, prime-activite.ts, rsa.ts, aides-logement.ts, prestations-familiales.ts, aah.ts, retraite.ts, tva.ts
  src/plan/*.ts       csg-activite.ts, flat-tax-afu.ts, transition.ts, …
  src/simulate.ts     simulate(household, scenario, {year|steady}) → { components[], disposable, explanations[] }
  src/explain.ts      each component returns { id, label, amount, formula (string with user values), sources[], tier }
  test/               golden (OpenFisca oracle + book cas types), property-based (fast-check), snapshot of cas-types
/site          Astro 6 static site + React 19 islands (simulator, charts). Observable Plot + d3 (sankey, treemap).
  src/data/*.json     produced by /pipeline; facts.json = every public number with source
/pipeline      python3 scripts: data/derived/csv → site/src/data/*.json (deterministic, committed outputs)
/docs          VISION.md, METHODE.md (also rendered at /methode)
```

- pnpm workspaces; Vitest + fast-check; Playwright + @axe-core/playwright; Lighthouse CI budget.
- Engine is the single source of truth: the site **never** computes tax logic itself; cas-types heatmap and "si je gagnais plus" curves are produced by calling the engine (build-time or in-browser).
- Reforms are **parameter patches + a small number of structural switches**, so an identity reform must give Δ = 0 (property test).

### Engine invariants (tests)
- Components sum exactly to headline disposable income (both scenarios).
- Identity: plan with all switches off ≡ baseline.
- Plan: for any household, d(disposable)/d(gross) ≥ 0.77 × (1−cotisations) ± ε in the steady state (no cliffs) under H1-default.
- Baseline matches OpenFisca golden cases within tolerance (± 2 % or ± 15 €/mois per component; documented gap table).
- Book cas types reproduced exactly: CSG gain at SMIC 171,72 €/mois (2025 SMIC), GraphIR 5-point table, 1 100 €/mois disabled adult, 28 695,65 € break-even.

## 8. Visual identity & tone

- **Editorial, calm, factual** — a newsroom explainer, not a campaign tract and not a ministry site. Think FT/Le Monde Décodeurs × Our World in Data × PolicyEngine.
- Paper off-white background, deep ink text, **one accent** for the plan, a **colour-blind-safe diverging pair** for gain (blue-teal) / loss (orange-vermilion) — never red/green. Dark mode supported.
- Type: a characterful serif for display numbers/headlines (e.g., *Fraunces* or *Source Serif 4*), a clean grotesque for UI (*Inter* / *Public Sans*), **tabular figures** everywhere money is shown. Self-hosted.
- Big numbers are always paired with a human-scale reframing ("= 148 € par foyer et par jour").
- Copy in plain French, *tu*? no — **vous**, short sentences, no jargon without a tooltip-free inline definition (`<abbr>` + glossary).

## 9. Scope cut for v1

**In**: express simulator (salariés, sans-emploi, retraités, inactifs, étudiants, handicap, familles, locataires), steady state + 2027–2030 timeline, waterfall, side-by-side, hypotheses, si-je-gagnais-plus, cas-types heatmap, share link; dashboard pages listed in §4; méthode page; tests; CI.
**Out (v1, listed as "pas encore")**: indépendants beyond a simple flat model, agriculteurs, DOM, capital income & wealth taxation detail, taxe foncière, health out-of-pocket, public-agent exit indemnity (stretch goal), maps (the book's data is national only — **no fake geography**).

## 10. Definition of done
- `pnpm test` green (golden, property, unit); `pnpm build` green; Playwright e2e + axe: 0 serious violations; Lighthouse ≥ 95 perf/a11y on simulator & landing (mobile).
- 6 persona agents completed their tasks; top issues fixed.
- README explains how to run, the methodology, and the independence statement.
