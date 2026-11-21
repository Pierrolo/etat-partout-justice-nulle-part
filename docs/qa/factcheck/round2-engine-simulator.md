# Fact-check — round2-engine-simulator

Checked: **≈ 290 statements** against the 18 Nov 2026 texts (`research/pages-2026-11-21/`, `data/derived-2026-11-21/`). Errors: **12** (blocker 1 / major 1 / minor 10). À vérifier: **5**.

Coverage:
- `engine/src/params/plan.ts`: 26 parameters and 20 source labels.
- `engine/src/plan/afu.ts` and `engine/src/plan/periods.ts`: every rule and header comment.
- `engine/src/unquantified.ts`: 33 catalogue entries, their titles, plain titles, amount hints, tiers and sources.
- `engine/src/compare.ts`: H1–H21, `notModelled` and warnings.
- `engine/src/explain.ts`: summary, `why`, `certainty`, `TIER_TXT`.
- `engine/src/simulate.ts`: labels, formulas, sources and tiers of the 21 components.
- `engine/src/employer.ts`: notes.
- `engine/src/cas-types.ts` and `engine/cas-types-results.json`: the 7 retiree cases.
- Frozen build, driven with Playwright with every panel expanded (`/simulateur/#…`). Four households:
  - a retiree since 2020 on 1 500 € net;
  - a retiree starting in 2030 (1 500 € net);
  - a married retired couple (1 800 + 1 100 € net);
  - a fonctionnaire on 2 500 € brut, renting.

  Page texts are in `/tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/r2es/page-*.txt`. The scripts are `check.ts`, `ret.ts` and `drive.mjs` in the same folder.
- `/simulateur/cas-types/`: the retiree rows.

## Book cas types and retiree cas types (engine v1.2.0)

| Case | Expected | Engine | OK |
|---|---|---|---|
| CSG+CRDS gain at the 2025 SMIC (1 801,80 € brut) | 171,72 €/mois | +171,72 | yes |
| GraphIR 0 / 8 000 / 21 000 / 34 000 / 48 000 / 72 000 € (H2 off) | tax 0 / −1 840 / −4 830 / −7 820 / −11 040 / −16 560 | identical within 0,04 €/an | yes |
| Break-even 28 695,65 € (= 6 600 / 0,23; exposé « 28 700 € ») | IR = AFU | IR + AFU = 0,0000 | yes |
| Adult holding the CMI « invalidité », no income | 1 100 €/mois | 1 100 | yes |
| Pensioner (liquidated 2020) + 1 child | 6 600 − 3 300 + 3 300 = 6 600 → 550 €/mois | 550 | yes |
| Pensioner holding the CMI invalidité | 6 600 + 6 600 − 3 300 → 825 €/mois | 825 | yes |
| Default share, pension liquidated 2028 / 2030 | 170/172 = 98,84 %, 162/172 = 94,19 % → AFU 278,20 / 290,99 €/mois | same | yes |

Three retiree cas types recomputed by hand (steady state, before TVA). Each changes sign compared with the October majoration.

| Case | By hand | Engine | Old rule (+3 300) |
|---|---|---|---|
| `retraite-1800` (single, 70) | Today: median CSG band, net 1 666,80; IR 0 (RNI 18 624 − 157 bis abattement 1 411 → décote ≥ tax). Plan: 23 % × 20 692,80 = 396,61; AFU 275 → **−121,61** | −121,61 | +428,39 |
| `retraite-3000` | Today: IR 2 251 €/an (RNI 30 488). Plan: 23 % × 33 876 = 649,29; AFU 275 → **−186,75** | −186,75 | +363,25 |
| `retraite-couple-3200` (married) | Today: RNI 33 108, 2 parts, 1 090 − décote 990 = 100 €/an. Plan: 23 % × 36 787,20 = 705,09; AFU 13 200 − 6 600 = 550 → **−146,75** | −146,75 | +953,25 |

`cas-types-results.json` and the `/simulateur/cas-types/` page match the engine. For example, `retraite-1800` shows −165 € after TVA, with 1 505 → 1 340.

## Errors

| id | where (page URL path + source file:line) | stated | correct | source (path:line or URL + date) | severity | fix |
|---|---|---|---|---|---|---|
| R2E-1 | `/simulateur/`, shown to any fonctionnaire. Promise `indemnite_agent_public` (`engine/src/unquantified.ts:217`) and loss `postes_publics` (`:358`) | « (les fonctions publiques territoriale et hospitalière ne sont pas visées) »; « Cet amendement ne vise pas les fonctionnaires territoriaux et hospitaliers. » | Wrong for territorial civil servants. Am. 26 VI A lets « la collectivité territoriale ou l’établissement public mentionné à l’article L. 4 » decide, by a reasoned deliberation, « d’appliquer au fonctionnaire territorial concerné le régime prévu aux II à IV ». The indemnity is then paid by that employer (VI B). Only the hospital service is outside the text. The sentence came from the round-1 fix PE-12b; the October text already had VI. | `research/pages-2026-11-21/amendements__Liasse_PLF_P2.md:1830-1845` (am. 26 VI) | **blocker** (wrong legal claim; the simulator's own option reads « école, hôpital, mairie ») | « …de plein droit pour les fonctionnaires de l’État ; une collectivité territoriale peut, par délibération, l’appliquer à ses fonctionnaires ; la fonction publique hospitalière n’est pas visée. » Same fix in `postes_publics`. |
| R2E-2 | Promise `complement_viager` (`engine/src/unquantified.ts:97-98`), shown to every retiree | « Part du patrimoine restitué versée en rente. Aucun mécanisme juridique dans les amendements. » | The mechanism is in the text. Am. 27 III A credits a yearly « versement de patrimoine » to the « compartiment de restitution ». III C sets it at a global amount voted each finance law, « nul à défaut ». IV says the compartment is « délivré sous forme de rente viagère » from retirement age. What has no legal text is the amount: the « 500 € par an au moins ». The item does not cite am. 27, and the `patrimoine_restitue` item cites it for this same mechanism. | `amendements__Liasse_PLF_P1.md:2524-2539` (am. 27 III–IV) | **major** | « Mécanisme écrit (am. 27 : versement de patrimoine porté au compartiment de restitution, servi en rente viagère), mais montant voté chaque année et nul à défaut ; aucun plancher de 500 € dans le texte. » Add `SRC_AM27_CEP`. |
| R2E-3 | Promise `droits_mutation` (`unquantified.ts:123-124`), shown to owners and renters | « …au lieu d’environ 10 000 € par l’acheteur aujourd’hui » ; hint « −6 100 € sur un achat à 200 000 € » | That is the exposé's 3,80 % + 1,20 %. Since 1 Apr 2025 (LF 2025 art. 116), 88 départements charge 5 %, for 6,32 % in total. That gives about 12 640 € on 200 000 € (≈ 11 600 € at 4,50 %). The gap is about −8 700 €, not −6 100 €. | BOFiP BOI 14771-PGP (17 Jun 2026); Banque des Territoires; jechange.fr, situation on 1 Jun 2026 | minor | « environ 10 000 € selon l’exposé (en fait 11 600 à 12 640 € dans la plupart des départements depuis 2025) ». |
| R2E-4 | Promise `exonerations_salaire` (`unquantified.ts:190-193`) | Title « « 9 Md€ rendus au salaire net » » sourced to fiche Entreprise + Manifeste. Detail: the suppression « des exonérations de cotisations et de la taxe sur les salaires « va au salarié, non à l’entreprise » » | « 9 Md€ » is in neither the fiche nor the manifeste. It comes from the PLFSS am. 1 exposé (« elle rend 9 milliards d’euros au salaire net »). The fiche quote concerns « la suppression des taxes sur les salaires » only. | `amendements__Liasse_PLFSS.md:132-135`; `fiches__entreprise.md:36` | minor | Cite PLFSS am. 1 (exposé) for the 9 Md€. Attribute the quote to the taxes sur les salaires. |
| R2E-5 | `droits_connexes` source (`unquantified.ts:392`); `x.tva.niche_share_of_nonfood_gap` source (`engine/src/params/baseline-extra.ts:352`) | « Classeur « Synthèse Chiffres », onglet … » | The workbook is now « Synthèse des chiffrages.xlsx ». The 36,1 Md€ and the Détail Niches values are unchanged. `engine/src/index.ts:29` already uses the new name. | `research/DIFF-2026-10-to-2026-11.md` §4.1; `data/derived-2026-11-21/csv/Synth_se_des_chiffrages/Refonte_fiscalit.csv:73` | minor | Rename to « Synthèse des chiffrages ». |
| R2E-6 | `indemnite_agent_public` (`unquantified.ts:217`) and `postes_publics` (`:358`) | « indemnité de 70 % du traitement indiciaire brut, plus une part des primes fixée par décret » ; « une baisse d’au moins 30 % de votre traitement » | The 70 % applies to the base: TIB + part of primes (II A–B). The part is at most ¼ of the TIB, and the monthly amount is capped at the TIB (III C). The wording reads as primes added on top of 70 %. « Au moins 30 % » holds only while no décret sets a part; with a 25 % part the drop is 12,5 % of the TIB. | `amendements__Liasse_PLF_P2.md:1700-1707`, `:1732-1733` | minor | « 70 % d’une assiette égale au traitement indiciaire brut plus une part des primes fixée par décret (nulle à défaut, donc 70 % du traitement) » ; « une baisse de 30 % de votre traitement tant qu’aucun décret ne fixe la part des primes ». |
| R2E-7 | Loss `chomage_6_mois` (`unquantified.ts:236`) | « 15 mois après une rupture conventionnelle depuis le 1er septembre 2026 » | 15 months below 55 and **20,5 months from 55** (loi 2026-470). Round 1 row 11 gave both figures. | `docs/qa/factcheck/VERIFIED-nonplan.md:36,75`; P2 am. 26 footnote 3 (`amendements__Liasse_PLF_P2.md:1878-1880`) | minor | « 15 mois avant 55 ans, 20,5 mois ensuite, après une rupture conventionnelle ». |
| R2E-8 | `/simulateur/` H1 legend (`site/src/components/simulator/Hypotheses.tsx:29`) vs register (`engine/src/compare.ts:83`) | « Le RSA, la prime d’activité, l’AAH et les bourses sont-ils remplacés ? » vs « RSA, prime d’activité, AAH, ASPA » | The engine's H1 replaces the ASPA, not the bourses, which are not modelled. A retiree is not told the question covers the minimum vieillesse. The workbook merges « ASPA/ASV 4,1 » into the AFU; bourses are not itemised. | `Refonte_fiscalit.csv:72` | minor | « …l’AAH et le minimum vieillesse (ASPA)… » |
| R2E-9 | `engine/src/params/plan.ts:196` (`plan.prestations_familiales_end` unit) | « 9 prestations familiales of L.511-1 CSS » abolished | PLFSS am. 7 rewrites L. 511-1 so that it keeps the allocation de logement until 2030. Eight are abolished on 1 Jan 2028; the exposé says « huit allocations ». | `amendements__Liasse_PLFSS.md:528-538, 559-560` | minor | « 8 of the 9 (allocation de logement kept until 2030, P2 am. 32) ». |
| R2E-10 | APL formula, plan steady state (`engine/src/simulate.ts`, `aides_logement` block) | « plus de droit nouveau après le 1er juin 2027 » | « Aucune demande … déposée **à compter du** 1er juin 2027 » (1 June included). A claim filed from 1 Jan 2027 is also served for 12 months at most. | `amendements__Liasse_PLF_P2.md:2183-2186` | minor | « à partir du 1er juin 2027 ». |
| R2E-11 | `engine/src/plan/afu.ts:45-70`, `normalize.ts:165` (startYear accepted up to 2060 through the API or a link; the form stops at 2040) | A pension liquidated in 2052–2060 still carries a pro-rata minoration (e.g. 2060 → 3 300 × 24,4 % = 806 €/an) | The minoration « s’applique jusqu’à l’imposition des revenus de l’année 2051 ». A pension liquidated after 2051 never carries it. | `amendements__Liasse_PLF_P1.md:2626-2627` | minor | Annual = 0 when startYear > `plan.afu_pension_last_income_year`, or cap startYear at 2051. |
| R2E-12 | `/simulateur/` footer vs `engine/src/index.ts:29` | « Amendements publiés le 18 novembre 2026 » vs « version publiée les 17 et 18 novembre 2026 » | The PDFs were generated on 17 Nov (P1, PLFSS) and 18 Nov (P2). The footer gives a single date. | `research/DIFF-2026-10-to-2026-11.md` §1.1 | minor | « publiés les 17 et 18 novembre 2026 ». |

## À vérifier (uncertain)

| id | where | stated | doubt | what would settle it |
|---|---|---|---|---|
| R2V-1 | `droits_mutation` (« payés par le vendeur ») vs `plus_value_residence` (« les droits de mutation payés lors d’un achat fait à partir de 2027 viennent en déduction ») | Who bears the 1 %/3 % | The sources conflict. Am. 19 exposé: « le vendeur pour une vente ». The dispositif points the other way: CGI 683 III (droits supportés « par celui qui liquide la plus-value sur laquelle ils s’imputent ») and am. 20 12° b (imputed on the plus-value of the cédant for droits he paid « lors de l’acquisition »). Read together, the buyer pays at purchase as an advance on his own future gain. The engine states both readings, and `pipeline/DISCREPANCIES.md` does not list the conflict. | The authors' reading. Otherwise, show the conflict. |
| R2V-2 | `bouclier_sanitaire` (`unquantified.ts:136`), shown to retirees | « plancher : 5 % du montant annuel de l’aide fondamentale, soit 330 € pour une personne seule » | If « montant annuel de l’aide fondamentale universelle » (L. 160-13-1 III) means the foyer's own amount, a single retiree whose pension was liquidated before 2028 has 3 300 € and a floor of 165 €. Round-1 V-2 raised the same ambiguity; the minoration makes it visible. | The authors' reading or the décret. Otherwise: « 330 € pour une personne seule non retraitée ». |
| R2V-3 | Transition photos for a pension liquidated after 2028 (retiree starting 2030) | 2027 and 2028 show the pension, and 2028 applies the 2030 minoration (AFU +290 €) | Before liquidation the person has no pension. Their 2028 AFU would be the full 6 600 €, and their incomes would be different. The page says « revenus supposés constants », but this case is not flagged. | Methodological choice: add a warning, or drop the minoration for periods before startYear. |
| R2V-4 | Plan pension CSG (CASA 0,3 % kept) vs PLFSS am. 9 | — | The exposé lists the « contribution additionnelle de solidarité pour l’autonomie sur les pensions » among the 21 abolished contributions. The dispositif cites no CASF L. 14-10-4, so keeping the CASA follows the legal text. This is a conflict inside the source. | Authors; DISCREPANCIES entry. |
| R2V-5 | `TIER_TXT.law` | « (pas encore votés) » | Carried over from round 1 (V-5). | AN amendment search, PLF n° 3210 / PLFSS n° 3211. |

## Verified correct (brief)

**PLF-P1 am. 28 (new text).**
- 23 %; 6 600 € per adult; 3 300 € per dependent until the year of 18; +6 600 € for the CMI invalidité; the excess is paid; no cumulation with the prestations familiales; acomptes from 1 Jan 2028.
- Minoration: 3 300 € per member of the foyer holding a pension « servie par un régime obligatoire » liquidated before 1 Jan 2028. For a pension liquidated later, the décret rule applies, « à défaut » 3 300 × (insurance duration validated before 2028 ÷ total duration retained). It applies until IR on 2051 incomes. The engine implements exactly this, with startYear < 2028 counting as « before ».
- The minoration is per pensioner and combines additively with the +6 600 € and the child 3 300 €.
- Default of 172 quarters ending 1 July of the start year: status hypothesis. The AFU component, H21 and the warning carry tier « Notre estimation » when the default applies and « Proposé dans un amendement » when the share is declared or the pension predates 2028.
- Form hints and the warning text (« 94,2 % retenus … soit −259,01 € par mois ») are arithmetically right.
- Am. 1 II 5° (modulation « à titre transitoire, du bénéfice d’une pension de retraite servie par un régime obligatoire ») is consistent with this.

**PLF-P2 am. 26.**
- 70 %; 24 months + 1 month per quarter of public service; cap 84 months and the date of a pension without décote.
- Combinable in full with a private job; counts for pension rights like ARE within the ARE duration (III F).
- Applies to State corps (V A); stated scope otherwise as in R2E-1.

**Tax counts and the electricity accise.**
- 54 State taxes (am. 22), 72 taxes affectées (am. 25), 21 social contributions (PLFSS am. 9, gage on L. 136-6/136-7 = CSG on capital income), 20 local taxes (am. 29 III bis, compensated by the DGF).
- Accise on electricity: 1 €/MWh « ménages et assimilés », 0,5 € for other consumption, from 1 Jul 2027; « niveau appliqué en 2023 et 2024 » is the exposé's wording.

**CSG/CRDS (PLFSS am. 1).**
- 9,2/0,5 % for Jan–Jun 2027; 7,6 / 6,0 / 4,3 / 2,7 / 1,1 % for Jul–Nov; 0 from 1 Dec 2027.
- CSG kept on replacement incomes; general reduction kept; employer notes right (L. 241-10 and L. 741-16 by thirds until 2029).

**Other measures.**
- APL schedule (P2 am. 32). TVA 1 Jul 2027 (niches) and 1 Jul 2028, food 10/15/20 % (am. 21).
- Niche calendar IV.A/C/E/F: garde and emploi à domicile 2/3, 1/3, 0; dons ½ from 1 Jul 2027 and 0 from 2028.
- Intéressement/participation (43°, 54° in IV.C) on 2028 incomes; overtime and titres-restaurant (71°, 55°) on 2026 incomes; 10 % pension abattement (120°, IV.A) on 2026 incomes.
- CEE abolished 1 Jul 2027 (am. 16, 6 Md€ Cour des comptes).
- Capital gains: am. 20 I 3° abrogates 150 U II 1°, for sales from 1 Jan 2027, at 30 %, real gain.
- Epargne: plans opened or paid into from 1 Jul 2027 lose the advantage.
- Indexation: PLFSS am. 5 (régimes de base) and P2 am. 28 (AAH, prime d’activité, RSA named), from 1 Jan 2027; Agirc-Arrco not covered; the AFU is not indexed.
- Bouclier: 5 %, foyer fiscal, net of IR, conditional on the AFU. ALD: only affections recognised from 2028 lose their exemption.
- Chèque énergie abolished 1 Jan 2027, 48–277 €.
- Social housing (P2 am. 29). Taxe foncière: 10–30 %, Insee; the quote is verbatim.
- CEP rate and global amount are nil by default.
- Manifeste and fiche quotes (300 €, 20 000 €, 600 Md€, 600 €, 500 €, 580 000, 6 600 €, +25 %, 4,5 M, « treize à six mois », « inflation faciale inférieure à 2 % ») match the November pages.

**Playwright, four households.** Every displayed number matched the engine and hand arithmetic:
- Retiree 2020: IR 4 144 €/an; AFU 275; CSG band moves from reduced to median, shown as H16; transition +5 / −80 / −155.
- Retiree 2030: AFU 290,99; H21 « 94,2 % … hypothèse d’une carrière complète ».
- Couple: 23 % × 36 003 = 690,05; décote 1 025; AFU 550; H11.
- Fonctionnaire: net 2 019,74 → 2 258,00; IR 858 → 5 609 €/an; prime d’activité 67,98 replaced (H1).

Beyond the errors above, the factual sentences on these pages are consistent with the sources. They include H1–H21, the `notModelled` list, the summary, `why` and `certainty`, and the 12 to 17 « non chiffré » items per household. The built bundle contains no October strings (« majoré », « cinquante-sept », « 1 à 7 ans »). It shows engine v1.2.0.
