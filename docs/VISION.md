# VISION — « Et moi, dans tout ça ? »

*An independent, open-source companion to the book « État partout, justice nulle part » (Barrat, Marle, Mitterrand — Éditions Chronique, 2026).*

Status: v1.1 spec (review by an independent agent folded in — see docs/VISION-review.md), written by the orchestrator. Inputs: `research/source-analysis.md`, `research/reform_parameters.json`, `research/sota-inspiration.md`, `research/baseline/*`.

---

## 1. Why this exists

The book makes a big, abstract claim — "the State is everywhere, so justice is nowhere; refocus it and give the money back" — and backs it with 7 workbooks and 81 amendments that almost nobody will read. Our job is to **de-abstract** it:

1. **"Et moi ?"** — In under a minute, a person sees what the plan would change *for their household*, in euros per month, with every euro traceable to an amendment or a stated hypothesis.
2. **"Où va l'argent ?"** — A visual, explorable walk through the book's data: 1 672 Md€ of public spending, 1 104 agencies, 486 niches, 49 million words of law, reframed at human scale (per household, per day, per hour worked).

**North-star sentence on the result page:** *« Avec le plan complet appliqué à votre situation de 2026, votre ménage disposerait de **[±X] €/mois** ([±Y] %). »* — one honest sentence, then the "why". (Never hard-code an example figure.)

**Signature visual — « Votre heure de travail »**: the book's 63 €/h value-added split (29 € État / 11 € capital / 23 € salaire net) recomputed for *the user's own pay*, today vs with the plan. It appears on the landing page (generic, average worker), on the simulator result (personal), and on /comprendre/le-plan.

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
  /comprendre/depenses       1 672 Md€ : où va l'argent public (treemap COFOG, per-foyer/per-day reframing) + section « Et ailleurs en Europe ? » (spending % GDP, deficit, median income; the Finland-above-France conflict shown honestly)
  /comprendre/etat-partout   L'État partout : ministères, agences (waffle of the 1 104 agencies' fate + searchable list), impôts, niches, CERFA, mots de loi (unit viz, growth line)
  /comprendre/le-plan        Le plan en un schéma : 236 Md€ → salaire net + épargne (Sankey) ; heure de travail 63 € (29/11/23)
  /comprendre/niches         Explorer les 465 niches fiscales (search, sort by cost, "me concerne ?")
  /comprendre/calendrier     La transition 2027 → 2030 (timeline of every dated measure)
  /comprendre/amendements    Les 81 amendements, par thème (searchable)
/methode               Méthode & hypothèses: modelled / not modelled, hypotheses register, sources, gap table vs official simulators, changelog
/a-propos              Independence statement, licence, credits, contact (GitHub issues)
```

## 5. The simulator

### 5.1 Inputs — "Express" (one screen on desktop, stepper on mobile)

1. **Votre foyer** : seul·e / en couple (+ « marié·e ou pacsé·e ? » — only today's tax depends on it; the plan side is individual) — + children with **age** (bucket per child: 0–2, 3–5, 6–10, 11–13, 14–17, 18–24 à charge/rattaché). Parent isolé derived.
2. **Chaque adulte** : **âge** (RSA ≥ 25, ASPA, AFU adulte vs enfant, rattachement) ; activité : salarié·e (**salaire net mensuel**, toggle brut; statut **privé non-cadre / cadre / fonctionnaire**), sans emploi (indemnisé·e : ARE mensuelle / non), retraité·e (pension nette + **année de départ** — the +3 300 € supplement only applies to pensions liquidated before 1/1/2028), étudiant·e, inactif·ve. *(Indépendants: "pas encore" in v1.)*
3. **Logement** : locataire (loyer hors charges, zone 1/2/3 via a commune → zone helper or a simple 3-choice with explanations), propriétaire (avec / sans crédit), hébergé·e gratuitement.
4. **Handicap** (per person) : AAH avec taux ≥ 80 % (→ carte mobilité inclusion « invalidité ») / AAH 50–79 % / enfant bénéficiaire AEEH. The two adult cases diverge sharply under the plan (+6 600 € supplement only with CMI invalidité).
5. **Aides** — *computed by default* (RSA, prime d'activité, APL, AF, CF, ARS, ASF, AEEH, AAH…), shown with: « je ne touche pas ces aides » (non-recours, ~34 % for RSA, ~39 % for PA per DREES) and a single override « total versé chaque mois par la CAF » if different. Never ask people to type benefit amounts first.

"Affiner" (progressive disclosure): mode de garde for children < 6 (crèche / assistante maternelle → CMG / parent), emploi à domicile, dons, frais réels, épargne (Livret A / assurance-vie balance), consommation (TVA estimate), public-agent-whose-post-is-removed scenario (stretch).

### 5.2 Outputs

1. **The sentence** (headline, € and %), monthly, **« plan complet appliqué à 2026 »**: all measures fully phased in, applied to 2026 incomes and 2026 baseline rules (AFU at its nominal 6 600 € — it is not indexed, see H12).
2. **Before → after waterfall**, one bar per measure: + salaire net (fin CSG/CRDS), − impôt à 23 %, + AFU, − prestations familiales, − RSA/prime d'activité, − APL, − TVA (estimation), etc. Each bar expandable → formula with *your* numbers + source chip ("Amendement PLF-P1 n° 28").
3. **Side-by-side table** "Aujourd'hui (règles 2026)" vs "Avec le plan", every component, monthly & yearly.
4. **Two equal "non chiffré" panels, side by side, same visual weight** (dashed, outside disposable income):
   - *Promesses non chiffrées dans la loi*: CEP (300 €/mois annoncés), restitution du patrimoine (20 000 €/foyer annoncés), compte éducation (6 600 €/enfant/an annoncés), lower rents/notary fees… — « montant fixé chaque année par la loi de finances ; 0 € par défaut dans le texte ».
   - *Pertes non chiffrées*: unemployment duration 6 months, end of crèche funding / CMG, health co-pay 10 %/acte (capped by bouclier), pension indexation frozen, end of savings tax exemptions, taxe foncière unknown, loss of public job, etc. — filtered to those relevant to the household.
5. **La transition, en 3 photos**: annual disposable income for **2027, 2028, 2030** (e.g., retirees' 2027 dip: pension abattement gone + indexation frozen before the AFU arrives in 2028; CSG steps H2 2027; APL –1/3 steps; TVA steps).
6. **"Si je gagnais plus ?"** chart: disposable income vs gross earnings, today vs plan, with the marginal effective tax rate (0,77 € kept per € claim made visible vs today's cliffs). Expert toggle shows MTR line.
7. **"Les gens comme vous"**: where you sit in the cas-types heatmap / income decile.
8. **Votre heure de travail** (signature visual, workers only).
9. **Hypothèses actives** list with toggles (see §6), and a share button (copy URL with hash). No PNG card in v1.
10. **No population claims** ("X % des ménages gagnent") — we have no microdata. Only cas types, clearly labelled as such.

### 5.3 Modes of time
- **Plan complet appliqué à 2026 (défaut)**: all measures fully phased in, applied to 2026 situation and € (existing pensions keep the +3 300 supplement if liquidated before 2028).
- **Transition**: annual snapshots 2027, 2028, 2030 with the dated measures in force (2026 €, no inflation projection; indexation freeze shown as a note).

## 6. Modelling decisions (the hypotheses register v1.1 — after review, see docs/VISION-review.md)

| # | Where the text is silent | Default | Tier | Toggle? |
|---|---|---|---|---|
| H1 | RSA, prime d'activité, AAH, ASPA, bourses replaced by the AFU? (manifesto « à la place de toutes les aides »; financing counts 135 Md€ merged; Am. 1 IV.C & Am. 28 VII abrogate the tax exemptions of « revenus que remplace l'aide fondamentale »; but no amendment abrogates the benefits) | **Replaced** | Annoncé | Yes: « maintenus en différentiel » (AFU counted as a resource; benefit tops up to today's level; maintained benefits taxable at 23 %) |
| H2 | 10 % frais professionnels deduction on wages survives? (art. 83 3° not abrogated; common-law definition of income is an explicit exception) | **Maintenu** — consequence shown honestly: 0,793 € kept per € and break-even ≈ 31 900 € net; the book's 0,77 € / 28 700 € figures are reproduced with H2 off | Hypothèse | Yes |
| H3 | Baseline net → taxable: taxable = net + CSG non déductible 2,4 % + CRDS 0,5 % (of 98,25 % of gross); plan: taxable = net salary (no CSG/CRDS left) − 10 % (H2). Pensions: CSG stays, deductible part (154 quinquies) survives; 10 % pension abattement abolished | as stated | Loi | — |
| H4 | Employer-side: who captures removal of exonérations/taxe sur salaires? | Not modelled; CSG gain 100 % to employee (authors' claim) | Annoncé | No |
| H5 | TVA reduced rates → 20 % + end of CEE (−) / energy accises: pass-through to prices | **100 % pass-through**, **smooth** fixed-basket estimate (share of consumption at reduced rates as a smooth function of income, INSEE BdF) — no decile cliffs | Hypothèse | Yes: 0 % / 50 % / 100 % |
| H6 | Unemployment 13 → 6 months (no legal text) | ARE monthly amount **unchanged**; separate line « à partir du 7e mois d'indemnisation : ARE = 0 » shown in the "pertes non chiffrées" panel and as an alternative figure | Annoncé | — |
| H7 | CEP, patrimoine, compte éducation | Shown outside disposable income at authors' announced amounts | Annoncé | Show/hide |
| H8 | Taxe foncière unique | Not modelled (INSEE tariffs don't exist) — said explicitly | — | — |
| H9 | Pension & benefit indexation frozen | Steady state in 2026 €: not modelled; transition notes it | Loi | — |
| H10 | Shared custody / AFU split between separated parents | Not modelled (children in one ménage) | — | — |
| H11 | Couples: plan is individual (AFU per person, flat 23 %); today IR depends on married/PACS (joint) vs not (2 foyers); CAF benefits per ménage either way | Ask married/PACS in Express; headline unit = **ménage** | Loi | — |
| H12 | AFU not indexed (6 600 € nominal) | Applied at 6 600 € to 2026 incomes ("plan complet appliqué à 2026") | Loi | — |
| H13 | Young adults 18–24: every person 18+ gets the adult AFU (550 €/mois), whether rattaché·e to parents' foyer or not | as stated | Loi | — |
| H14 | Non-recours today | Default: aides perçues if eligible; user can tick « je ne touche pas ces aides » | Hypothèse | Yes |

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
- Plan (steady state, H1 default, H5 smooth): no cliffs — marginal retention on net earnings ≥ 0,77 − ε (0,793 with H2 on).
- Plan side is independent of marital status (married vs not gives identical plan disposable income).
- Baseline matches OpenFisca golden cases within tolerance (± 2 % or ± 15 €/mois per component; documented gap table).
- Book cas types reproduced exactly: CSG gain at SMIC 171,72 €/mois (2025 SMIC), GraphIR 5-point table, 1 100 €/mois disabled adult, 28 695,65 € break-even.

## 8. Visual identity & tone

- **Editorial, calm, factual** — a newsroom explainer, not a campaign tract and not a ministry site. Think FT/Le Monde Décodeurs × Our World in Data × PolicyEngine.
- Paper off-white background, deep ink text, **one accent** for the plan, a **colour-blind-safe diverging pair** for gain (blue-teal) / loss (orange-vermilion) — never red/green. Dark mode supported.
- Type: a characterful serif for display numbers/headlines (e.g., *Fraunces* or *Source Serif 4*), a clean grotesque for UI (*Inter* / *Public Sans*), **tabular figures** everywhere money is shown. Self-hosted.
- Big numbers are always paired with a human-scale reframing ("= 148 € par foyer et par jour").
- Copy in plain French, *tu*? no — **vous**, short sentences, no jargon without a tooltip-free inline definition (`<abbr>` + glossary).

## 9. Scope cut for v1

**In**: express simulator (salariés privé/cadre/fonctionnaire, sans-emploi, retraités, inactifs, étudiants, handicap, familles, locataires), steady state + 3-snapshot transition, waterfall, side-by-side, two "non chiffré" panels, hypotheses, si-je-gagnais-plus, votre heure de travail, cas-types heatmap, share link; dashboard pages listed in §4; méthode page; tests; CI.
**Out (v1, listed as "pas encore")**: indépendants, agriculteurs, DOM, capital income & wealth taxation detail, taxe foncière, health out-of-pocket, public-agent exit indemnity (stretch goal), PNG share card, maps (the book's data is national only — **no fake geography**).

## 10. Definition of done
- `pnpm test` green (golden, property, unit); `pnpm build` green; Playwright e2e + axe: 0 serious violations; Lighthouse ≥ 95 perf/a11y on simulator & landing (mobile).
- 6 persona agents completed their tasks; top issues fixed.
- README explains how to run, the methodology, and the independence statement.
