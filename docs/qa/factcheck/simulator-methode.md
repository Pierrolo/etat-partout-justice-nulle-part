# Fact-check — simulator-methode

Checked: ≈ 330 statements. Pages and files covered:

- `/simulateur/`: every label, hint and help text in `site/src/components/simulator/**` and `site/src/lib/sim/**`, plus the 17 glossary terms the simulator links to. The result screens were rendered on the frozen build with Playwright (port 8713, every lazy section opened) for 8 households:
  - single at the SMIC, renter in zone 2;
  - lone parent with 2 children;
  - retired couple;
  - adult with AAH 50–79 %;
  - cadre couple with an assistante maternelle;
  - fonctionnaire (lone parent);
  - dirigeant assimilé salarié (with « Et pour mes salariés ? » filled in);
  - student aged 20.
- `/simulateur/cas-types/` (47 rows, pattern sentence, caveat).
- `/methode/` (`docs/METHODE.md`):
  - §1–§12, H1–H20 checked against `engine/src/**`;
  - the OpenFisca table, recomputed;
  - the D01–D34 arithmetic, spot-checked;
  - the denominators and the changelog, checked against `git log`.
- `/a-propos/`: licences, privacy, how the site is made.
- Privacy: all 18 pages were crawled with request logging and every `<details>` opened. Result: 396 requests, **0 to third parties**, **0 cookies**. The only browser storage is `localStorage.epjn-theme`, set by the theme toggle.

Errors: 13 (blocker 2 / major 4 / minor 7). À vérifier: 3.

## Errors

| id | where (page URL path + source file:line) | stated | correct | source (path:line or URL + date) | severity | fix |
|---|---|---|---|---|---|---|
| E1 | `/simulateur/` « Vos aides aujourd'hui » and the APL line for any student, e.g. student 20 y, rent 400 € zone 2: APL **310 €**, result **+240 €**. Same on `/simulateur/cas-types/` « Étudiant·e de 20 ans… » (+240 €, +87 %). Rule omission is in `engine/src/core.ts`, APL call; `research/baseline/baseline-rules.md:291` notes « no student floor ». Not disclosed on `/methode/` §6 « Étudiant·es ». | APL computed on actual resources (0 €) → 309,96 €/month | The CAF applies a flat resource floor to students: **8 600 €/yr** for a non-boursier in ordinary housing, 6 900 € for a boursier (frozen for 2026). With 8 600 € the engine's own barème gives **204,47 €**, about −105 €/month. The student's plan gain is then ≈ **+345 €**, not +240 €. | service-public.gouv.fr F12006 / caf.fr « forfait étudiant », amounts found by web search 2026-11-21 (several sources agree: 8 600 € / 6 900 € / 6 600 € / 5 400 €, not revalued in 2026). Engine recomputation: `apl(2,false,0,400,8600)` = 204,47. | blocker | Apply the student forfait in the baseline APL (at least the non-boursier default), or state it on `/methode/` §6 and in the student result. |
| E2 | `/simulateur/` step 1 hint (`site/src/components/simulator/InputForm.tsx:221`); `/methode/` H11 (`docs/METHODE.md:76`, tier « Amendement proposé ») | « Avec le plan, l'impôt est individuel. » / H11 « Plan : individuel, indépendant du mariage » (Amendement proposé) | No amendment individualises the income tax. Art. 6 CGI (joint taxation of married and pacsés couples) is not repealed. PLF-P1 am. 28 keeps the **foyer fiscal**: « chaque personne majeure composant le foyer fiscal », « chaque membre du foyer fiscal ». Only art. 194 (parts) and art. 196 B (rattachement) go. With a flat 23 % rate and a per-adult AFU the couple's total is the same either way, so no figure changes. The legal claim is still wrong, and it is presented as amendment text. | `research/pages/amendements__Liasse_PLF_P1.md:2566-2585` (am. 28). Grep of all 3 liasses: no « article 6 » / « imposition commune ». | blocker (wrong legal claim, 0 € impact) | « Avec le plan, l'impôt reste calculé par foyer fiscal, mais à 23 % sans quotient : se marier ne change plus rien. » H11 plan side: « foyer fiscal maintenu ; taux proportionnel et AFU par adulte ⇒ résultat indépendant du mariage ». |
| E3 | `/simulateur/` zone help (`InputForm.tsx:626-645`, `ZoneHelp`) | Zone 1 is « Paris et la petite couronne…, plus **quelques communes** proches de Paris ». Zone 2 includes « le reste de l'Île-de-France ». | The official I/II/III table puts **735 communes** in zone 1 (I + I bis), all in Île-de-France. **641 of them are in the grande couronne**: 179 in 77, 161 in 78, 141 in 91, 160 in 95, including Versailles, Argenteuil, Cergy and Meaux. Only 516 IdF communes are zone 2. A resident of Versailles or Argenteuil reading this help would pick zone 2, which lowers the APL rent ceiling. The other examples are right: Roubaix, Tourcoing and Lille are zone 2; Montreuil, Saint-Denis and Boulogne are zone 1 (I bis); Lyon, Marseille, Toulouse, Nantes, Bordeaux and Strasbourg are zone 2. | DGALN table « zonage I/II/III, arrêté du 17 mars 1978 », `https://www.ecologie.gouv.fr/sites/default/files/documents/DGALN_zonage_i-ii-iii%20avec%20changement%20trilport.xls` (linked from ecologie.gouv.fr/zonage-1-2-3), downloaded 2026-11-21 | major | « Zone 1 : Paris, la petite couronne et une grande partie de la grande couronne (Versailles, Argenteuil, Cergy, Meaux, villes nouvelles…). Zone 2 : le reste de l'Île-de-France… ». Add a link to service-public « Connaître le zonage de sa commune ». |
| E4 | `/simulateur/` « Pertes non chiffrées », item « Le chômage payé six mois seulement » (`engine/src/unquantified.ts:211-215`); shown to every household | « 6 mois d'indemnisation **au lieu de 13 à 18** » ; « la durée maximale actuelle est de **18 mois** selon l'âge » | The current duration runs from a **minimum of 182 days (6 months)**. The maximum is **548 days (18 months)** for younger claimants, **685 days (22,5 months)** and **822 days (27 months)** for older ones. « 13 » is the plan's own figure (fiche), not a legal bound. | service-public.gouv.fr/particuliers/vosdroits/F14860 (« Vérifié le 23 juillet 2026 »): < 53 ans 548 j, 53–54 ans 685 j, ≥ 55 ans 822 j, minimum 182 j | major | « …au lieu de 6 à 18 mois aujourd'hui (jusqu'à 27 mois après 55 ans) ». Keep « treize » only inside the quotation of the fiche. |
| E5 | `/simulateur/` « Et pour mes salariés ? » (`engine/src/employer.ts:96`); `/methode/` H4 (`docs/METHODE.md:69`) | « Coût employeur inchangé… : **le plan ne modifie pas les cotisations patronales** et garde la réduction générale ». H4: « fin des exonérations patronales… 100 % au salarié…, coût employeur inchangé ». | PLFSS am. 1 I and III end every non-general employer exemption from 1 July 2027. Examples: CSS L.241-10 (particuliers employeurs / aide à domicile, phased 1/3, 2/3, then abrogated 2029); L.241-17 and L.241-18 (heures supplémentaires, including the employer's déduction forfaitaire); C. trav. L.6243-2; L.5134-31 1°; C. rur. L.741-16 (TO-DE). For those employers the cost **rises**. Only the general reduction (L.241-13) is kept (II 3°). Two internal contradictions: the site's own item « Emploi à domicile : … le coût horaire augmente », and H4, which says the end of employer exemptions goes « 100 % au salarié » while gross pay and employer cost stay unchanged, which cannot both hold. | `research/pages/amendements__Liasse_PLFSS.md:39-82` (am. 1 I, II, III, IV) | major | « Pour un salarié sans exonération particulière, coût employeur inchangé ; les employeurs qui bénéficient d'exonérations spécifiques (heures supplémentaires, apprentis, emploi à domicile, travailleurs saisonniers agricoles…) les perdent à partir du 1er juillet 2027. » Rewrite H4 accordingly. |
| E6 | Every result page. `engine/src/display.ts:113` computes `deltaAfterTva = round5(delta) + round5(TVA delta)`. | Headline / « Avec le plan » vs « En clair » and the earnings curve on the **same page**: SMIC single **+115 €** vs « +110 € » (curve: 1 625 € / +110 €), exact 111,68. Lone parent **−255 €** vs « −260 € », exact −259,27. Retired couple **+945 €** vs « +940 € », exact 940,32. Dirigeant **+730 €** vs « +725 € », exact 727,43. | The headline is not the nearest multiple of 5 to the true value (up to 4,3 € off), and it contradicts the « En clair » paragraph and the curve right below it. This happened in 4 of the 8 households tested. Waterfall lines do add up to the headline (checked: all 8). | Engine recomputation (`compare`, `roundForDisplay`), scratchpad `hh.json` | major (visible inconsistency, ≤ 5 €) | Round the after-TVA total directly (`roundStep(c.deltaAfterTva)`), then distribute the TVA lines to that target. Or have « En clair » and the curve use `display.deltaAfterTva`. |
| E7 | `/simulateur/` « Votre heure de travail » sentence (`site/src/components/simulator/HourOfWork.tsx:97,190`) | « l'aide universelle (**551 €** par mois, versée à chaque adulte…) » (SMIC case) | **550 €** per month (6 600 €/yr ÷ 12, PLF-P1 am. 28). 551 € comes from `afuPerHour` rounded to 3,63 € × 151,67 h. | `amendements__Liasse_PLF_P1.md:2570-2572` | minor | Use the unrounded per-adult AFU (`perAdultAnnual/12`), not `afuPerHour × hours`. |
| E8 | `/methode/` §6 AAH (`docs/METHODE.md:144`); reason « versée seulement jusqu'à l'âge de la retraite » with `x.aah.age_limit_50_79 = 62` (`engine/src/params/baseline-extra.ts:167`) | « 50–79 % (jusqu'à 62 ans) » | AAH 50–79 % stops at the **âge légal de départ**. That age is no longer 62 for the people concerned in 2026: 62 ans 6 mois for the 1963 generation and 62 ans 9 mois for 1964 (2023 reform as frozen by the LFSS 2026 suspension). A 62-year-old in 2026 can still be entitled, but the engine sets the AAH to 0. | CSS L.821-2; CSS L.161-17-2 (âge légal by generation) | minor | « jusqu'à l'âge légal de départ (62 ans et 6 à 9 mois pour les générations 1963-1964) ». Raise the parameter or make it depend on the year of birth. |
| E9 | `/simulateur/` « Affiner », checkbox « Je me suis séparé·e il y a moins de 18 mois » (`InputForm.tsx:724-725`) | « Le RSA et la prime d'activité sont alors majorés… » | The isolement majoration lasts **12 months at most**, within 18 months of the separation (CASF L.262-9; CSS L.842-7). Someone separated 13–18 months ago who claimed promptly no longer gets it. | service-public F19778 (RSA majoré) / F2882 | minor | « …si vous vous êtes séparé·e il y a moins de 12 mois (ou si vous n'avez pas encore touché la majoration et que la séparation date de moins de 18 mois) ». |
| E10 | `/methode/` §12 journal, row « 24 octobre 2026 \| site » (`docs/METHODE.md:240`) | « Niveaux de certitude renommés (« Proposé dans un amendement », **« Annoncé »**, « Notre estimation ») » on 24 Oct | On 24 Oct the second tier was renamed « **Promis par les auteurs** ». « Annoncé » arrived on 25–26 Oct, the change the 26 Oct row describes. The 24 Oct row was rewritten after the fact. | `git show a8a0419:docs/METHODE.md` line 240 | minor | Restore « Promis par les auteurs » in the 24 Oct row (the 26 Oct row already records the change). |
| E11 | `/methode/` §1 table, AFU row (`docs/METHODE.md:38`) | « +3 300 € par **pension** liquidée avant 2028 » | « pour chaque **membre du foyer fiscal titulaire d'une pension** de retraite liquidée avant le 1er janvier 2028 »: one supplement per person, however many pensions they have. The engine does it per person, which is correct. | `amendements__Liasse_PLF_P1.md:2578-2580` | minor | « +3 300 € par titulaire d'une pension liquidée avant 2028 ». |
| E12 | `/simulateur/` « Pertes non chiffrées », « Les logements sociaux mis en vente », tier « Annoncé » (`engine/src/unquantified.ts:416-421`) | « …plus aucun logement social neuf financé par l'État à partir de 2027 » shown as Annoncé, sourced only to the fiche | That half is written in **PLF-P2 am. 29** (no new State aid to social-housing investment from 1 January 2027). Only the sale of 4,5 M dwellings is « Annoncé ». | `amendements__Liasse_PLF_P2.md`, am. 29 I–IV | minor | Split the item, or add the PLF-P2 am. 29 source and say which half is amendment text. |
| E13 | `/simulateur/` « Et pour mes salariés ? » note (`engine/src/employer.ts:97`); same claim in `employer.ts:5` | Taxe sur les salaires « ne concerne que les employeurs qui ne paient pas la TVA » | It is due by employers **not subject to VAT on at least 90 % of their turnover**, so partially subject employers pay pro rata (CGI art. 231-1). | CGI art. 231 | minor | « …les employeurs pas ou peu soumis à la TVA (moins de 90 % de leur chiffre d'affaires)… » |

## À vérifier (uncertain)

| id | where | stated | doubt | what would settle it |
|---|---|---|---|---|
| V1 | `/methode/` H13; engine `plan.afu_child_max_age = 18` (`engine/src/plan/afu.ts`) | A person aged 18 or over gets the adult AFU (6 600 €) | Am. 28 gives the 3 300 € child amount to a dependant « jusqu'à l'année au cours de laquelle elle atteint l'âge de dix-huit ans ». In the year of the 18th birthday the text points to the child amount, while the « personne majeure » clause points to 6 600 €. | A reading of art. 196 / am. 28 for the birthday year, then a note in H13 if the engine keeps 6 600 €. |
| V2 | Glossary entry `cmg` shown in the simulator (`site/src/data/glossaire.json`) | CMG « pour un enfant de moins de 6 ans » | The LFSS 2023 (art. 86) reform planned to extend the CMG to children aged 6–12 in single-parent families. If that has taken effect by Nov 2026, the definition is incomplete. | service-public F345 / caf.fr, current state of the « CMG 6-12 ans familles monoparentales » extension |
| V3 | `/methode/` §11 D05 | « Finlande 57,7 %, France 57,0 % (2024) » | Matches the workbook. Not re-checked against the live Eurostat table (outside this area, owned by the Europe checker). | Eurostat tec00023, latest release |

## Verified correct (brief list)

- **Simulator copy:**
  - Activity, status and disability option labels.
  - Dirigeant assimilé salarié: président·e de SAS/SASU, gérant·e minoritaire of a SARL; régime général without unemployment insurance; no réduction générale (no contrat de travail).
  - TNS definition (gérant majoritaire, indépendant, micro-entrepreneur).
  - CMI « invalidité » ⇔ taux ≥ 80 %, and the supplement written in am. 28. AEEH « existe dès 50 % », with CMI only at 80 %.
  - AAH 50–79 %: the RSDAE condition is disclosed in « Ce que le simulateur ne compte pas » (`engine/src/compare.ts:249`).
  - ARE paid by France Travail.
  - « Le plan supprime l'aide à la garde (CMG) » and « l'ASF, que le plan supprime aussi » (PLFSS am. 7: titre III livre V and chap. III titre II abrogated on 1 Jan 2028; L.263-1 action sociale CAF abrogated).
  - Pensions starting from 1 Jan 2028 are treated differently (am. 28, pension supplement).
  - RSA from 25. Glossary: AAH, AEEH (< 20 ans), ARE, ASF, cotisations, coût employeur, RSA, prime d'activité, différentiel, non-recours, AFU (550 / 275 €).
  - Roubaix and Tourcoing in zone 2; Paris and Montreuil / Saint-Denis / Boulogne in zone 1; the big-city examples in zone 2.
- **8 households, all on the frozen build:**
  - The waterfall lines add up to the headline in all 8.
  - Percentages are right on the after-TVA base.
  - « par jour » = headline ÷ 30,4.
  - « en jeu » certainty totals match the sums of the lines.
  - Tier per line: salary, IR, AFU, APL and family benefits are « Proposé dans un amendement »; RSA, PA and AAH are « Annoncé » (H1); TVA and CEE are « Notre estimation ».
  - « Pourquoi ? » sentences match the largest lines.
  - Every « Pourquoi 0 € » reason is right for its household (AF from the 2nd child under 20; CF 3 children; PAJE < 3 ans; CMG < 6 ans; ARS 6–18; ASF lone parent; ASPA 65; PA needs earnings; no RSA for students).
  - H1 two readings shown for the AAH case (−815 € vs −435 €).
  - The fonctionnaire warning (580 000 posts; 70 % for 1–7 years matches PLF-P2 am. 26 II C).
  - The assistante-maternelle cotisations item (100 % Pajemploi).
  - Notary example (1 % × 90 000 + 3 % × 100 000 = 3 900 €; −6 100 €).
  - Bouclier sanitaire 5 %, floor 5 % × 6 600 = 330 € (PLFSS am. 4).
  - Heures sup / titres-restaurant taxed from 2026 incomes (am. 1 III 55°/71°, IV.A).
  - Chèque énergie abrogated on 1 Jan 2027 (PLF-P2 am. 34). Emploi-à-domicile exemption phased 1/3 → 2/3 → 2029 (PLFSS am. 1 IV).
  - Verbatim quotes from the Patient, Locataire, Entreprise, Citoyen and Personne sans emploi fiches.
- **Hand-verified end to end:**
  - **SMIC single:** brut 1 822,90; cotisations 11,31 %; CSG/CRDS 173,73; IR 500 − décote 671 = 0; PA 236,26 − CRDS; plan IR 23 % × 17 461 = 334,66; disposable 1 678,07 → 1 832,07.
  - **Retired couple:** RNI 30 168, 2 parts → 766 − décote 1 136 = 0; plan 23 % × 33 520 = 642,46; AFU 19 800/12; disposable 2 700 → 3 707,54.
  - **Cadre couple:** QF cap 2 × 1 807 → IR 6 091; CMG formula 458,39; childcare credit = 50 % × min(expense, 3 500) × 2 children = 3 500 €; plan IR 23 % × 84 708.
  - Dirigeant (IR 9 885) and lone-parent figures checked line by line.
  - Employer panel: 2 527 € brut × 98,25 % × 9,7 % = +241 €.
- **Cas-types:** 47 rows. The pattern sentence is right: below 1 500 € net, all losers are singles without income or part-time, lone parents and disabled adults, and winners range from +110 € to +560 €. Range −835 € / +1 645 € and −69 % / +87 % correct. Caveat « illustratifs et non pondérés » correct.
- **`/methode/`:**
  - Every hypothesis matches the engine: H2 (0,793 €; 31 884 €; art. 83 3° not in am. 1), H5 shares and curve parameters, H13 (art. 196 B abrogated, am. 1 III 130°, IV.C → 2028), H15, H16, H17 (5/6, 1/2, 1/6 checked), H18 (154 quinquies untouched), H19, H20 (180 × 4,85 = 873; 180 × 9 = 1 620).
  - H1: manifesto quote « à la place de toutes les aides »; 135,35 Md€ in « Refonte fiscalité »; no amendment abolishes RSA / PA / AAH, which PLF-P2 am. 28 only de-indexes.
  - The 10 % pension abattement ends on 2026 incomes (120° falls under IV.A).
  - CSG steps 7,6 / 6,0 / 4,3 / 2,7 / 1,1 % and CRDS 0,5 % (PLFSS am. 1 VII). APL calendar (PLF-P2 am. 32).
  - « plus de 300 paramètres » (328).
  - OpenFisca table recomputed from the 40 golden cases: net 0,0145; RGDU 0,30; pensions 0; RSA / APL / CF / PAJE / ASF / ASPA / AAH ≤ 0,015; AF 1,63 (1 case); PA 6,12; ARS 0,49 €/yr; IR 2,18 €/yr; disposable 6,08 (1 case), 27 cases within 0,01; tolerances as in `engine/test/golden.test.ts`.
  - Plan checks: 1 801,80 × 98,25 % × 9,7 % = 171,72; 6 600 / 0,23 = 28 695,65.
  - Denominators 30 / 29,507 / 30,959 / 40,2 M.
  - D04, D08, D09, D10, D12, D13, D15, D16, D21, D25, D33 arithmetic re-done; D07 (EA21 since 1 Jan 2026).
  - Changelog dates match git except E10.
- **`/a-propos/`:**
  - MIT licence and copyright match `LICENSE`.
  - Insee and DGFiP / Direction du budget under Licence Ouverte 2.0; Eurostat CC BY 4.0; fonts under SIL OFL 1.1, served locally.
  - Stack (Astro, React, Tailwind, d3, Observable Plot) matches `site/package.json`. GitHub Pages deploy workflow exists. Axe tests are in `site/e2e`.
  - Privacy, verified with Playwright: no cookie, no third-party request, theme stored only in localStorage, simulation state in the URL hash.
