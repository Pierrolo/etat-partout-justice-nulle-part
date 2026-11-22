# Fact-check — plan-engine

Checked: **≈ 140 statements**. Coverage:
- `engine/src/params/plan.ts`: all 22 parameters and their units, dates and sources, plus the 17 source labels.
- `engine/src/plan/periods.ts` and `engine/src/plan/afu.ts`: every dated schedule and the header comment.
- `engine/src/simulate.ts`: the `formula`, `label`, `sources` and `tier` of all 21 components, each run for the steady state and for 2027, 2028 and 2030.
- `engine/src/unquantified.ts`: 33 catalogue entries.
- `engine/src/compare.ts`: hypotheses H1–H20, 18 `notModelled` strings and 5 `warnings`.
- `engine/src/explain.ts`: the `summary.certainty` and tier texts.
- `engine/src/employer.ts`: the notes. `engine/src/index.ts`: `PARAMS_META`.

Everything was checked against `research/pages/amendements__Liasse_PLF_P1.md`, `…PLF_P2.md` and `…PLFSS.md`, the fiches, the manifeste and the workbook CSVs.

Errors: **12** (blocker 0 / major 2 / minor 10). À vérifier: **5**.

## Book cas types reproduced (script in the scratchpad, run against the engine)

Script: `/tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/pe/check.ts`, run with `node` from `engine/`.

| Case | Book / workbook | Engine | OK |
|---|---|---|---|
| CSG+CRDS gain, SMIC 2025 (1 801,80 € brut) | 171,72 €/mois | waterfall `salaire_net` +171,72 (net 1 426,30 → 1 598,02) | yes |
| GraphIR 0 / 8 000 / 21 000 / 34 000 / 48 000 / 72 000 € (H2 off) | tax 0 / −1 840 / −4 830 / −7 820 / −11 040 / −16 560; disposable 6 600 / 12 760 / 22 770 / 32 780 / 43 560 / 62 040 | identical within 0,08 € (rounding to the cent each month) | yes |
| Break-even 28 695,65 € (= 6 600 / 0,23; exposé of am. 28: « 28 700 € ») | impôt = AFU | IR + AFU = 0,0000 €/mois | yes |
| Adult with the CMI « invalidité », no income | 1 100 €/mois | AFU 1 100 €, disposable 1 100 € (formula « 6 600 € × 1 personne majeure + 6 600 € × 1 titulaire CMI invalidité ») | yes |
| Retiree (pension liquidated 2020) + one child | 550 + 275 + 275 | 1 100 €/mois | yes |

A transition run (couple with a salary, a pension, 2 children, renter, dons and emploi à domicile) gave the expected averages. In 2027 the average CSG+CRDS rate is 6,867 % = (6 × 9,7 + 8,1 + 6,5 + 4,8 + 3,2 + 1,6 + 0) / 12. In 2027 the APL keeps 83,3 % of its amount and in 2028 it keeps 50 %. In 2027 the dons reduction keeps 75 % and garde/emploi à domicile keep 2/3. In 2027 the CEE gain counts for half the year.

## Errors

| id | where (page URL path + source file:line) | stated | correct | source (path:line or URL + date) | severity | fix |
|---|---|---|---|---|---|---|
| PE-1 | Simulator « non chiffré » losses, item `titres_restaurant_heures_sup` — `engine/src/unquantified.ts` (detail of that item, ~l. 458) | « Heures supplémentaires, titres-restaurant, intéressement : … Ces exonérations d’impôt … tombent dès les revenus 2026 (impôt) » | Only right for overtime (art. 81 quater = am. 1 III 71°) and titres-restaurant (art. 81 19° = III 55°): both fall under IV.A, i.e. 2026 incomes. The income-tax exemptions for **intéressement/participation** (art. 80 sexdecies, 81 18° bis, 81 ter, 163 bis AA, 163 bis B = III 43°, and 81 18° = III 54°) are in the IV.C list. They end with the **IR on 2028 incomes**, not 2026. | `research/pages/amendements__Liasse_PLF_P1.md:189-201` (43°, 54°), `:729-735` (IV.C list « 43° à 46° … 54° ») | major | « … tombent dès les revenus 2026 (heures supplémentaires, titres-restaurant) ou 2028 (intéressement, participation) pour l’impôt, et le 1er juillet 2027 pour les cotisations ». |
| PE-2 | Losses, item `chomage_6_mois` — `engine/src/unquantified.ts:211` and `:215` | « (la durée maximale actuelle est de 18 mois selon l’âge) » and « 6 mois d’indemnisation au lieu de 13 à 18 » | Under current law the maximum depends on age: 548 days (≈ 18 months) for the youngest band, 685 days (≈ 22,5 months) and 822 days (≈ 27 months) for the older ones. 18 months is the lowest of the three maxima, not « the maximum depending on age ». « 13 » is the plan’s own figure, not current law. | service-public.gouv.fr F14860, verified on 23 July 2026, fetched 2026-11-21 (548 / 685 / 822 days; bands < 53, 53–54, ≥ 55 on that page) | major | « (aujourd’hui 18 mois au plus, jusqu’à 22,5 ou 27 mois selon l’âge) » and « 6 mois au lieu de 18 à 27 mois aujourd’hui (13 selon le plan) ». |
| PE-3 | Source label `SRC_CEE` — `engine/src/params/plan.ts:30` (shown on the `cee` component and as the source of `plan.cee_end`) | « Liasse PLF 2027 — 1re partie, am. n° 14-16 — accises et certificats d’économies d’énergie » | The CEE are abrogated by **am. 16** alone (I–IV, from 1 July 2027). Am. 14 (accise on energy, a single rate) and am. 15 (agricultural regimes) are not modelled and do not concern the CEE. | `amendements__Liasse_PLF_P1.md:1520-1545`; liasse table `:33-36` | minor | `am(PLF_P1, '16', 'certificats d’économies d’énergie abrogés')`. |
| PE-4 | Losses, item `plus_value_residence` — `engine/src/unquantified.ts` (title « (à vérifier) », detail « semble-t-il … Point à confirmer sur Légifrance ») | Abolition of the main-residence exemption presented as uncertain | It is explicit. Am. 20 I 3° reads « Les 1°, 3°, 4°, 5° et 6° du II de l’article 150 U sont abrogés », and 150 U II 1° is the main-residence exemption. This applies to sales from **1 January 2027** (am. 20 II A). The other II items are abrogated by am. 1 III 91°–97°. | `amendements__Liasse_PLF_P1.md:1798`, `:1890-1891`; `:242-248` | minor | Drop the hedge. Write « Exonération de la résidence principale abrogée (am. 20, I 3°) pour les cessions à partir du 1er janvier 2027 », and keep « droits de mutation imputables ». |
| PE-5 | Losses, item `parc_social` — `engine/src/unquantified.ts` (tier `announced`, source fiche Locataire only) | « … plus aucun logement social neuf financé par l’État à partir de 2027 » | This sentence is not in the fiche Locataire. It is legal text: **PLF-P2 am. 29**, from 1 January 2027 « l’État n’attribue aucune aide nouvelle à l’investissement pour la construction … de logements locatifs sociaux ». Only the « vente en trois ans » part is announced (fiche). | `amendements__Liasse_PLF_P2.md:1968-1983`; `research/pages/fiches__locataire.md:23-25` | minor | Add the PLF-P2 am. 29 source, and split the item or mark that sentence as « proposé dans un amendement ». |
| PE-6 | Losses, item `gel_indexation` — `engine/src/unquantified.ts` (sources `SRC_PLFSS5_INDEX` + fiche) | « pensions, AAH, RSA, prime d’activité ne sont plus revalorisées automatiquement » | For AAH, RSA and prime d’activité, the amendment that names them is **PLF-P2 am. 28** (I 1°–3°), which is not cited. PLFSS am. 5 covers only « régimes obligatoires de base » (and these benefits only through L. 161-25). Complementary pensions (Agirc-Arrco) are covered by neither. | `amendements__Liasse_PLF_P2.md:1907-1920`; `amendements__Liasse_PLFSS.md:419-428` | minor | Add PLF-P2 am. 28 to the sources. Write « pensions de base ». |
| PE-7 | Employer view — `engine/src/employer.ts:86` | « le plan ne modifie pas les cotisations patronales et garde la réduction générale (amendement PLFSS n° 1, II 3°) » | The general reduction is indeed kept (II 3°). But PLFSS am. 1 I and III abolish, from 1 July 2027, all derogatory employer exemptions. Examples: L. 241-18 overtime deduction, L. 6243-2 apprentices, L. 131-6-4, L. 241-10 particuliers employeurs (phased to 2029), and the L. 242-1 II exclusions. The sentence is only true for an ordinary employee with none of these. | `amendements__Liasse_PLFSS.md:41-77` | minor | « …ne modifie pas les cotisations patronales de droit commun (hors exonérations particulières supprimées au 1er juillet 2027) ». |
| PE-8 | Hypothesis H13 — `engine/src/compare.ts` (`H13` value) | « le rattachement au foyer des parents (art. 196 B) étant abrogé en 2028 » | Art. 196 B is abrogated (am. 1 III 130°, IV.C), but that removes the half-part or abattement for rattachement, not the rattachement itself (art. 6, 3 CGI is not abrogated). The adult AFU follows directly from am. 28: « 6 600 € … pour chaque personne majeure composant le foyer fiscal ». The conclusion holds; the legal reason given is wrong. | `amendements__Liasse_PLF_P1.md:284`, `:2569-2571` | minor | « la personne majeure, rattachée ou non, reçoit l’AFU adulte (am. 28 : “chaque personne majeure composant le foyer fiscal”) ». |
| PE-9 | Hypotheses register — `engine/src/compare.ts` (`H12` tier `law`; `H3` tier `law`) | H12 « 6 600 € nominaux appliqués aux revenus 2026 (non indexée) » = law; H3 « Revenu imposable du plan : salaire net (sans CSG/CRDS) … » = law | « Appliqués aux revenus 2026 » is a simulator choice, so the tier should be hypothesis; only « 6 600 €, non indexée » is law. H3 omits the 10 % deduction for professional expenses that the engine applies by default under H2, which is a hypothesis. So the line is neither « salaire net » nor fully law. | am. 28 `amendements__Liasse_PLF_P1.md:2566-2603`; `engine/src/params/plan.ts` `plan.frais_pro_10_kept` (status hypothesis) | minor | Set H12 to tier hypothesis, or split it. For H3 write « salaire après cotisations, moins 10 % de frais professionnels si H2 ». |
| PE-10 | Component `pension_nette` (plan), steady state and 2030 — `engine/src/simulate.ts` (pension block, `tier: 'law'`) | Pension change shown as « écrit dans les amendements » in `summary.certainty` | In steady state and 2030 the CSG band is recomputed with « 1 part par adulte + ½ par enfant », which the formula itself labels « hypothèse » (H16). The resulting change is therefore an estimate. In 2028 it comes from am. 1 120° (pension abattement, inferred reading). | `engine/src/plan/periods.ts` header; `compare.ts` H16 tier `hypothesis` | minor | Use tier `hypothesis` when `pensionTier` is `fixedpoint` in the plan. |
| PE-11 | Promises, item `bouclier_sanitaire` — `engine/src/unquantified.ts` | « le ticket modérateur et le forfait journalier sont plafonnés à 5 % des ressources du foyer » | The cap covers the participations of L. 160-13 **I, II and III**: ticket modérateur, participation forfaitaire and franchises. It also covers the forfait journalier. Resources are those of the **foyer fiscal**, **net of IR**. | `amendements__Liasse_PLFSS.md:318-334` | minor | « ticket modérateur, participations forfaitaires, franchises et forfait journalier … plafonnés à 5 % des ressources du foyer fiscal, nettes de l’impôt sur le revenu ». |
| PE-12 | Losses, item `reste_a_charge_10` (tier `announced`) and item `indemnite_agent_public` / `postes_publics` (shown to every `fonctionnaire`) | (a) « L’ALD disparaît pour les nouvelles affections reconnues à partir de 2028 » under tier « annoncé ». (b) « Si votre poste public est supprimé : 70 % … jusqu’à 7 ans » shown to any civil servant. | (a) The ALD part is legal text: PLFSS am. 4, L. 160-13-1 VII and L. 160-14 last paragraph. The cap replaces the 3°/4°/10° exemptions for affections recognised from 1 Jan 2028. Only the « 10 % par acte » is announced (fiche Patient). (b) PLF-P2 am. 26 V A limits the indemnity to « corps de fonctionnaires de l’État » whose mission is abolished by the law. It does not cover territorial or hospital civil servants. | `amendements__Liasse_PLFSS.md:342-345`, `:361-362`; `amendements__Liasse_PLF_P2.md:1688-1692` | minor | (a) Split the tiers, or say « (ce point-ci est dans l’amendement PLFSS n° 4) ». (b) Add « fonctionnaire de l’État » to the item’s title or detail. |

## À vérifier (uncertain)

| id | where | stated | doubt | what would settle it |
|---|---|---|---|---|
| V-1 | `engine/src/params/plan.ts` `plan.tva_food_path` and `engine/src/baseline/tva.ts` `tvaExtraCost` | The food path 10 → 15 → 20 % applies to 85 % of the 5,5 % basket. The whole 2,1 % basket moves to 20 % on 1 July 2028. | Am. 21 I 2° puts the « taux réduit **et** taux très réduit » goods of CIBS **L. 213-159 and L. 213-166** (plus the services of L. 213-157) on the slow path. If L. 213-166 lists 2,1 % goods, part of the « particular » share should follow 10/15/20 rather than jump to 20 %. The impact is small (0,6 % of the basket). | The text of CIBS L. 213-157, L. 213-159 and L. 213-166 on Légifrance (not consulted from this sandbox). |
| V-2 | `unquantified.ts` `bouclier_sanitaire` | « plancher : 5 % de l’AFU annuelle, soit 330 € » | Am. 4 III says « montant annuel de l’aide fondamentale universelle » without saying whose. 330 € is a single adult’s AFU; for a family the household’s AFU would give more. | A reading of the amendment by its authors, or the décret it provides for. Otherwise write « 330 € pour une personne seule ». |
| V-3 | `engine/src/plan/afu.ts` (`age >= 18` → adult part) | A child aged 18 gets 6 600 € | Am. 28 gives the 3 300 € child part « jusqu’à l’année au cours de laquelle elle atteint l’âge de dix-huit ans ». This is ambiguous for the year of the 18th birthday (child part, adult part, or both). | The authors’ reading. The effect is only for one year. |
| V-4 | `unquantified.ts` `etudes_payantes` | « Les bourses sont comptées parmi les aides remplacées par l’AFU (H1) », source fiche Jeune adulte | The fiche does not mention scholarships. `research/source-analysis.md:104` says the workbook sizing sheets count bourses among the expenditures folded into the AFU, but I did not find the row in `data/derived/csv`. | The workbook row (or sheet) that includes the bourses. Then cite it instead of the fiche. |
| V-5 | `explain.ts` `TIER_TXT.law` | « écrit dans les amendements proposés (pas encore votés) » | Status of the Résolution liasses in the PLF/PLFSS 2027 debates as of 2026-11-21 (whether any was filed by a member of parliament or put to a vote) was not checked online. | Assemblée nationale amendment search for PLF n° 3210 / PLFSS n° 3211. |

## Verified correct (brief)

**Flat tax (am. 28).**
- 23 % of revenu net imposable (am. 28 V 3° a, CGI 197 I 1). It applies to IR on 2028 incomes and later (VI A), with monthly payments from 1 Jan 2028 (VI B).
- No quotient familial and no décote: art. 194 and 197 I 2 and 4 are abrogated. The formula « ni quotient familial ni décote » is right.

**AFU amounts (am. 28).**
- 6 600 € per adult; 3 300 € per dependent until 18.
- +6 600 € for each member of the foyer holding the CMI « invalidité » (L. 241-3 CASF). Engine proxy: incapacity ≥ 80 %. The AAH 50–79 % text correctly reserves the supplement to CMI holders.
- +3 300 € for each pension liquidated before 1 Jan 2028, until IR on 2051 incomes. The warning « Pension liquidée en 2028 ou après : pas de majoration » is right.
- The excess is paid out. The quote « ne se cumule pas avec les prestations familiales » is verbatim.
- Break-even 28 695,65 € (exposé: 28 700 €). « 0,77 € / 0,793 € » kept per euro is right.

**CSG/CRDS on earned income (PLFSS am. 1).**
- Jan–Jun 2027 at 9,2 / 0,5 %. Then CSG 7,6 / 6,0 / 4,3 / 2,7 / 1,1 % for Jul–Nov with CRDS at 0,5 %, and 0 from 1 Dec 2027 (VII, IX, exposé).
- CSG is kept on pensions, ARE and IJ (V 1° and exposé).
- The general reduction (L. 241-13) is kept (II 3°).
- Particuliers employeurs exemption L. 241-10: −1/3 from 1 Jul 2027, −2/3 from 1 Jan 2028, gone from 1 Jan 2029 (IV).
- H18 « min(taux ; 6,8 points) »: art. 154 quinquies is not in any abrogation list.

**Prestations familiales (PLFSS am. 7).**
- Abolished on 1 Jan 2028, conditional on the AFU entering into force: L. 511-1 rewritten; titres II–IV of livre V abrogated (AF, CF, ASF, PAJE incl. CMG, AEEH, ARS); CAF action sociale (L. 263-1) abrogated.
- Only the allocation de logement remains in L. 511-1 until 2030.
- Items `creche_cmg` (PSU, Pajemploi cotisations) and `aeeh_complements` are right.

**APL (PLF-P2 am. 32).**
- No right for claims filed from 1 Jun 2027.
- Conventioned housing: amount capped at Dec 2026, −1/3 from 1 Jul 2027, −2/3 from 1 Jul 2028, 0 from 1 Jul 2029 or on leaving.
- Private housing: ends at the end of the lease, 1 Jan 2030 at the latest. All aides personnelles end 1 Jan 2030.
- H17 « même moyenne pour un bail de 3 ans d’échéance inconnue » checks out: with uniform lease ends the private averages are 0,833 / 0,5 / 0,167, the same as conventioned.
- Items `apl_nouveau_bail` and `loyers_baisse` (fiche quote) are right.

**TVA (am. 21 and am. 1 IV.D).**
- 10 / 5,5 / 2,1 % → 20 % on 1 Jul 2028.
- Food at 10 % (1 Jul 2028), 15 % (1 Jul 2029), 20 % (1 Jul 2030).
- Tax-expenditure reduced rates (III / III bis) end on 1 Jul 2027.
- The TVA lines are tier hypothesis.

**Pension abattement of 10 % (am. 1 III 120°, IV.A).**
- Gone from IR on 2026 incomes, consistent with the exposé « les dispositifs non incitatifs tombent dès les revenus de 2026 ».
- 2028 pension CSG band taken on the RFR of 2026 incomes without the abattement.

**Niches.**
- Garde d’enfants (200 quater B = III 150°) and emploi à domicile (199 sexdecies = III 142°): 2/3 kept for 2027, 1/3 for 2028, 0 from 2029 (IV.E).
- Dons: rates halved for gifts from 1 Jul 2027, abolished from 1 Jan 2028 (am. 3 V A–B and am. 1 IV.F). The year-2027 average of 75 % is right.
- Garde ceiling 3 500 € per child.
- Epargne: plans opened or paid into from 1 Jul 2027 lose their advantages (IV.C); withdrawals taxed at 30 % of the real gain (am. 20, am. 27).

**Other plan items.**
- Bouclier sanitaire: 5 %, from 1 Jan 2028, conditional on the AFU.
- CEE abolished 1 Jul 2027 (am. 16); the 6 Md€ figure is from Cour des comptes 2024 as cited by am. 16.
- Indexation removed for revaluations from 1 Jan 2027 (PLFSS am. 5, PLF-P2 am. 28); the AFU has no indexation clause.
- Chèque énergie abolished 1 Jan 2027 (P2 am. 34); 48 to 277 €.
- DMTO: nothing below 10 000 €, 1 % up to 100 000 €, 3 % above, paid by the seller, from 1 Jan 2027. The 200 000 € example gives 3 900 € against 10 000 € today (am. 19).
- Taxe foncière: 2028, market rental value set by Insee, rate 10–30 %; the quote « à 10 % … » is verbatim (am. 29).
- Civil-servant indemnity: 70 % of the traitement indiciaire plus a share of primes set by décret, 1 to 7 years, can be combined with a private job (P2 am. 26), subject to PE-12b.
- CEP: restitution rate set by the finance law and 0 by default; locked until retirement, paid as an annuity (am. 27).

**Unemployment.** No amendment touches ARE duration (only P2 am. 23 on the France Travail contribution). « Treize à six mois » is correctly labelled Annoncé and quotes the fiche Personne sans emploi verbatim.

**Announced items checked against their sources.**
- Manifeste: « 300 euros par mois … d’ici trois ans », « 600 milliards … 20 000 euros par foyer en trois ans », « 580 000 postes », « 6 600 euros … compte éducation … jusqu’à 18 ans », « à la place de toutes les aides » (basis of H1, labelled Annoncé).
- Fiches Foyer (600 €), Retraité (500 €), Patient (300 €, quote « reste à charge de 10 % par acte »), Locataire (+25 %, 4,5 M), Consommateur, Citoyen (« inflation faciale inférieure à 2 % »), Agent public indispensable (fin du statut).
- Workbook « Refonte fiscalité », aides sociales locales 36,1 Md€ among « Dépenses fusionnées en aide fondamentale ».

**Engine texts.**
- RSA, PA, AAH and ASPA texts are labelled annoncé with « aucun texte ne l’abroge », which is right: no amendment abrogates them.
- `notModelled` and `warnings` are consistent with the engine: CNRACL 37,65 % (2026) and CAS Pensions ≈ 78 % are right.
- H2, H4, H5, H6, H14–H20 have tier and wording consistent with the sources.
- Liasse names, articles visés (am. 28 on art. 2; PLFSS am. 1 after art. 7) and the date 19 Oct 2026 (`research/pages/donnees.md:136-156`) are right.
