# VISION — independent review

Adversarial review. `research/baseline/` did not exist at review time; baseline remarks should be checked against it.

**Verdict.** The principles are right. The hypotheses register misses items that flip the *sign* of the result for large groups: AAH at 50–79 %, childcare (CMG/crèche), non-take-up, adults aged 18–24, pensions liquidated after 2028, and AFU non-indexation. H1 and H6 also break the spec's own three-tier rule. Scope is about 2× too large.

## 1. Modelling — hypotheses register

**H1 (RSA/PA/AAH/ASPA replaced).** Keep the default, but tag it *Annoncé*: no amendment abrogates them.
- Keep it inside disposable income. The AFU's financing (135 Md€ merged) assumes these benefits go. Am. 1 IV.C and Am. 28 VII also abrogate the IR exemptions of «revenus que remplace l'aide fondamentale» (art. 81 2°, 9° ter, 14°, 14° bis).
- The toggle "maintenus en complément" (RSA *on top of* the AFU) is not a credible counterfactual. Replace it with **"maintenus en différentiel"**: the AFU counts as a resource and the benefit tops up to today's floor. Maintained benefits would then be taxable at 23 %.
- Add bourses and the prime de Noël to the replaced list.
- **AAH is the biggest error.** The +6 600 € supplement requires a *CMI-invalidité* (rate ≥ 80 %). About half of AAH recipients are at 50–79 % and lose about 490 €/month (AAH ≈ 1 040 € → 550 €). The input "handicap (CMI invalidité)" hides this. Ask: AAH? rate ≥ 80 % or 50–79 %? Same for AEEH children.
- **ASPA.** The result depends on the +3 300 € flag for a pension liquidated before 1/1/2028. A post-2028 ASPA retiree loses: 550 € + small pension − 23 % < 1 034 €. Ask the liquidation year.

**H2 (10 % frais pro kept).** Agree. Art. 83 3° is not in Am. 1 III, and the 10 % on wages is not a *dépense fiscale*; the 10 % on pensions is, and item 120° abrogates it. Consequences to show:
- Marginal retention is **0,793**, not 0,77.
- Break-even is **≈ 31 900 € of net salary**, not 28 700 €.
- The book's GraphIR applies 23 % to raw income, so reproduce it with H2 off and say H2-off is the authors' reading.

**H3 (taxable income).** Correct for the plan side, but the baseline side is forgotten.
- Today's net imposable = net à payer + CSG non-déductible 2,4 % + CRDS 0,5 % (× 0,9825 × gross) + employer mutual share. Users type *net à payer*, so the engine must go net → gross → net imposable, or every salaried result is off by about 3 %.
- Under the plan the base rises by 6,8 % × 0,9825 × gross. Show this inside the "− impôt" bar, otherwise "+13 %" looks double-counted.
- **Pensions:** CSG déductible (154 quinquies) survives. Taxable = pension − 5,9 %, with no 10 % abattement.
- Early losses at IR 2026 (Am. 1 IV.A): overtime (81 quater; L. 241-17/18 CSS), titres-restaurant (81 19°), apprentices, intéressement.
- Gap: CSG rate bands on pensions use RFR thresholds *per part*, and parts disappear (art. 194). Default: 1 per adult + ½ per child, flagged.

**H4 (CSG cut 100 % to the employee).** Fine. Call it *incidence légale de court terme*.

**H5 (TVA 100 % pass-through).** A reasonable default, but:
- (a) It is one-sided. The CEE abrogation (≈ 6 Md€ passed through energy bills, about 200 €/household/year) and abolished affected taxes lower prices. Model the CEE, or the app reads as a hit piece.
- (b) Decile budget shares create cliffs and break the MTR invariant. Use a smooth function.
- (c) Use a fixed baseline basket (first-order) and state it.

**H6 (ARE × 6/13).** Wrong. It mixes this month's benefit with the length of the spell. Today's maximum is 18 months, not 13. There is no legal text. Default: ARE unchanged (still subject to CSG, taxed at 23 %) plus AFU. Add a separate *Annoncé* line: «au 7e mois : ARE = 0».

**H7, H8, H10.** Fine. For H8, cite Am. 29: «à 10 %, à peu près la taxe d'aujourd'hui».

**H9 / steady state.** The 6 600 € is nominal in the CGI and not indexed; baseline benefits are. "2030 rules in 2026 €" overstates the AFU by about 8 %. Redefine the default as **"plan complet appliqué aux revenus et prix 2026"** and add **H12 "AFU non indexée"**.

**H11 (couples).** The plan is individual (6 600 per adult, flat rate, 10 % per person), so marital status matters only for the *baseline* IR (quotient conjugal, large when incomes are unequal).
- Compute the baseline IR per foyer fiscal and CAF benefits per *ménage* (concubins included).
- Move "marié·e/pacsé·e ?" to Express. Headline = **ménage**.

**Missing (add):**
- **Age** (absent!). It drives RSA (≥ 25), ASPA, the adult/child AFU and the pension supplement.
- **18–24.**
  - Plan: art. 196 B is abrogated, but attachment (art. 6-3) remains. An adult gets 6 600 € whether attached or filing alone, so default: **every person ≥ 18 gets 550 €**, their income taxed at 23 %.
  - Baseline: ½ part; AF/CF/APL count them up to 20–21; no RSA under 25.
  - Students and families with young adults are big winners. Show it.
- **RSA/PA forfait logement** (owners, people housed for free, APL recipients). Without it the baseline is overstated by 80–190 €/month.
- **CMG (PAJE), ARS, CF, ASF, AEEH** in "prestations familiales". The CMG (assistante maternelle) is worth hundreds of €/month. Crèche PSU is funded by CAF action sociale, which is abrogated: list it as a loss. Ask "mode de garde < 6 ans" in Express.
- **Non-take-up** (RSA ≈ 34 %, PA ≈ 39 %, per DREES, which Am. 28 cites). Offer «je ne touche pas ces aides».
- **The 2027 dip.** The pension abattement goes at IR 2026 and indexation freezes, while the AFU only starts in 2028.
- Unquantified losses tied to RSA status: C2S, tarifs sociaux, local aid (36 Md€ "fusionnées").

## 2. Honesty and credibility

**Propaganda risks**
- The "+212 €/mois" example is invented. No placeholder numbers in the product.
- Hatched bars for promised gains (CEP, 20 000 €, compte éducation) sit next to a mere *list* of losses (crèche, services, bouclier co-pay, 580 k jobs). Fix: **two symmetric panels**, "Promis, non chiffré par la loi" and "Retiré, non chiffré ici", with equal weight.
- The 236 Md€ Sankey "→ salaire net" is an authors' claim. Title it «Selon les auteurs» and show the 402 Md€ gross AFU cost beside it.
- Avoid the authors' vocabulary ("restitution", "rendre") in the UI chrome.

**Hit-piece risks**
- H1 combined with full take-up makes every poor household a loser.
- TVA without the CEE.
- **Any "X % des ménages gagnent" claim.** There is no microdata, so label the heatmap "cas-types illustratifs, non pondérés".

**Framing**
- «votre revenu disponible serait…», never "vous gagnerez".
- Give € and % of disposable income, rounded to 10 €.
- Show a range when toggles flip the sign.
- Publish the cas-types table before launch. Invite the authors and one critical economist to review. Keep a public changelog.
- Report the authors' inconsistencies neutrally (13 % vs 12,0–12,6 %; Finland > France).

## 3. Scope

The baseline engine (IR with QF cap and décote, RSA, PA, APL, 9 prestations, AAH, ASPA, pension CSG) is the critical path and alone fills a session.

**Cut / defer to v1.1:**
- `/europe`.
- Merge `/agences` + `/niches` into `/etat-partout` as searchable tables.
- Canvas PNG card (link only).
- Monthly transition chart → **3 snapshots** (aujourd'hui / 2027 / plan complet).
- The expert MTR toggle (keep the curve).
- Indépendants in Express: drop, or badge "estimation fragile".

**Weak pages:** `/calendrier` duplicates the personal timeline, so keep one. The `/depenses` treemap is boring unless it is reframed per household.

**Strongest de-abstraction visual:** a personalised **"Votre heure de travail"**. Take the book's 63 € = 29 État / 11 capital / 23 net, applied to the user's pay, today vs plan, as two stacked bars. Runner-up: the net-transfer line with break-even and a "vous êtes ici" marker.

## 4. UX

- **Net à payer is the right default**, but net → gross depends on status (privé non-cadre / cadre / **public**). Add a selector and echo the derived gross for checking.
- **Monthly:** add "13e mois/primes" in Affiner and label results «moyenne mensuelle».
- **Couples:** one card per adult, with a "même situation" shortcut.
- **Benefits override:** people know their *CAF total*, not its components. Options: total / «je ne touche rien» / «je ne sais pas».
- **Housing:** drop "locataire avant juin 2027" from Express (in 2026, everyone is). Add "logement social ?": conventionné vs not drives the APL schedule.
- **Trip-ups:** "foyer" vs "ménage"; an adult child at home (whose simulation?); students typing parents' income; retirees not knowing gross pension (derive it from net, show a range).

## 5. Architecture

- Sound. Simplify: compute cas-types and curves at build time in a Node script importing the engine. Keep Python only for CSV → JSON, or port it.
- **Golden data:** OpenFisca cases generated offline and committed as JSON. Check its 2026 coverage; fall back to IPP barèmes plus CAF simulator cases.
- **MTR invariant:** scope it to steady state with smooth TVA. Add a *marital-status invariance* test for the plan side.
- Book reproductions need param overrides (2025 SMIC, H2 off).
- Version the hash schema. Specify an MDX `<Fact id>` lint, or "CI fails on unsourced figure" won't happen.

## 6. Changes to VISION.md

**Must-fix**
1. Express: age per adult; pension liquidation year.
2. Disability: split AAH ≥ 80 % (CMI-inv.) from 50–79 %; AEEH likewise.
3. H1 → *Annoncé* tier; toggle "maintenus en différentiel"; add bourses.
4. H6 → ARE unchanged + "7e mois" scenario.
5. H3 → baseline net → gross → net imposable; CSG déductible on pensions.
6. Add the forfait logement, CMG/ARS/CF/ASF/AEEH, and the 18–24 rule.
7. Non-take-up option in the benefits override.
8. Steady state = plan applied to 2026; H12 "AFU non indexée".
9. Symmetric unquantified-gains/losses panels; no population-share claims; no placeholder numbers.

**Should-fix**
- H2: show 0,793 / ~31 900 €; book reproduced with H2 off.
- H5: model the CEE; smooth TVA; fixed basket.
- H11: marital status in Express; headline = ménage.
- 2027 dip; 3 snapshots instead of a monthly chart.
- Status selector; single CAF-total override.
- Cut `/europe`; merge `/agences` + `/niches`; drop the PNG card.
- MTR invariant scope; marital-invariance test; `<Fact>` lint.

**Nice-to-have**
- "Votre heure de travail" visual.
- Overtime / titres-restaurant fields.
- Sign-flip ranges.
- Pre-launch cas-types publication and external review.
