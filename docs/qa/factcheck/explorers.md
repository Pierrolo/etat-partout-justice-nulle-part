# Fact-check — explorers (/comprendre/niches, /comprendre/calendrier, /comprendre/amendements)

Checked: about 4 900 data points and 70 prose statements. Pages and files covered:
- the 3 pages and their `.astro` sources;
- `site/src/data/{niches,calendrier,amendements,credits-retires}.json`, plus `data/niches.json` in `factcheck-dist`;
- 465 niches × 8 fields (id, label, tax, legal reference, 3 costs with ε/nc/- markers, plan code) = 3 720, checked against the **raw** xls and not only the derived CSVs;
- 104 events (date, verbatim quote, liasse + number, PDF page, theme/domain, tier);
- 10 trajectories (47 steps), 10 jalons, 9 « annonces »;
- 81 amendments (id, title, article, theme, 143 dated effects, PDF page, summary read against the text);
- 22 état B amendments (57 programmes, totals, % of AE).

Errors: 18 (blocker 4 / major 9 / minor 5). À vérifier: 10.

**Read this first.** The authors republished all three liasses on **17–18 Nov 2026**. This is after the 19 Oct 2026 snapshot in `data/raw` and `research/pages`. The live PDFs at the URLs the site links to no longer say what the site says (rows B1–B4 and M7–M9). Everything else in the report is checked against the repo snapshot, which is the brief's authority. Those errors exist even if the owner keeps the October texts.

Scripts and downloads are in `/tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/fc-explorers/` (`n*.py` niches, `c*.py` calendar, `am*.py` amendments, `l*.py` live diff, `pm*.py` plan mapping).

## Errors

### A. The source documents changed after the snapshot (live state at 2026-11-21 18:30 UTC)
Evidence:
- `curl https://france-resolution.fr/amendements/Liasse_PLF_P1.pdf` (and `_PLF_P2`, `_PLFSS`).
- PDF metadata `CreationDate`: P1 17 Nov, PLFSS 17 Nov, P2 18 Nov 2026. The snapshot was 19 Oct 2026.
- `https://france-resolution.fr/amendements.html` announces « 35 amendements / 40 amendements / 9 amendements ».
- Texts diffed with `l1.py`, `l2.py`, `l3.py`, `l4.py`.

| id | where (page + source) | stated | correct (live liasses) | severity | fix |
|---|---|---|---|---|---|
| B1 | `/comprendre/amendements/` (title, lede, `amendements.json:2583,2689`), `/comprendre/calendrier/` callout, `facts` | « Les **81** amendements » (34 / 39 / 8) | **84**: PLF-P1 35, PLF-P2 40, PLFSS 9. New: PLF-P1 n° 35 « Contribution exceptionnelle : pas de troisième exercice… », PLF-P2 n° 40 mission « Outre-mer », PLFSS n° 9 « Contributions sociales : vingt et une impositions fondues dans l'impôt… » | blocker | Re-snapshot the liasses and rebuild, or pin the site to archived copies of the 19 Oct files and say so on the page |
| B2 | every « Lire le texte (PDF, p. N) » link: `amendements.json › pdf_url/pdf_page` (50 of 81), calendar `source.url` (41 of 104 events) | `#page=N` from the 91 / 66 / 22-page files | In the live files the start page of PLF-P1 n° 23–34 is +1 to +3 pages (e.g. n° 34: p. 93, not 90). The start page of PLF-P2 n° 2–39 is +1 to +3 (n° 25: p. 31, not 29; n° 39: p. 69, not 66). The link opens the **previous** amendment | blocker | Regenerate `pdf_page` from the file being linked |
| B3 | `/comprendre/amendements/` « crédits retirés » chart, tiles and table; `credits-retires.json`; facts `credits_retires_cp_md/ae_md`; calendar events cal_026/cal_050 | **39 905 M€ CP / 43 855 M€ AE**, 22 missions, 57 programmes. Cohésion des territoires 13 129 M€ CP (APL 8 068) | **All 22 état B tables were recomputed.** Live totals of `TOTAUX` rows: **21 004 M€ CP / 24 226 M€ AE** for n° 1–22, and 21 034 M€ CP / 24 262 M€ AE with the new n° 40 (Outre-mer: 30,1 M€ CP). Examples (CP): n° 1 **6 447** (was 13 129; 5 programmes, « Interventions territoriales » dropped); n° 2 **2 737** (was 10 696); n° 3 548 (was 2 186); n° 4 **4 120** (was 3 270, up); n° 5 941 (was 2 815); n° 12 920 (was 557); n° 18 mission renamed « Agriculture et alimentation ». Effect dates were rewritten mission by mission (new: « 1er avril 2027 pour l'hébergement d'urgence »; n° 5 and n° 21 now 1 Jan only; n° 15 and n° 19 now 1 Jul only; n° 19 and n° 21 swapped vs the snapshot) | blocker | Rebuild from the live PDFs (`pipeline/b_credits.py`); every number on the chart, in the tiles and in the 22 cards changes |
| B4 | `/comprendre/amendements/` card PLF-P1-28 (`amendements.json` resume « majorations pour invalidité et pensions anciennes »); `/comprendre/calendrier/` cal_104 + jalon 2051 « majoration de 3 300 € » | AFU: « majoré de 3 300 € … pension liquidée avant le 1er janvier 2028 » (snapshot Am. 28, p. 75) | Live PLF-P1 n° 28: « Il est **minoré** de 3 300 € par an pour chaque membre du foyer fiscal titulaire d'une pension de retraite … liquidée avant le 1er janvier 2028 … prorata des droits acquis avant cette date … jusqu'à l'imposition des revenus de 2051 ». **The sign flips** (bonus becomes deduction). This also hits the simulator and other pages, outside my scope | blocker | Update Am. 28 text, resume, cal_104, jalon, and the engine parameter |
| M7 | cal_042 and card PLF-P1-12 (`amendements.json` effective 2027-07-01); jalon « Gros bloc de l'été 2027 »; PLF-P1-22 / PLF-P1-25 titles, resumes, facts; credits (PLF-P2 n° 18 name) | Crédit d'impôt famille abrogé « pour les dépenses exposées à partir du **1er juillet 2027** ». Am. 22 « **vingt et une** » taxes d'État; Am. 25 « **cinquante-sept** » taxes affectées | Live PLF-P1 n° 12: « **1er janvier** 2027 » (3 occurrences). Live n° 22: « **cinquante-quatre** » (titles and text, 33 more articles). Live n° 25: « **soixante-douze** ». Live n° 11 (tonnage): « exercices **clos** ». 7 calendar quotes are no longer verbatim in the live text: cal_013, 024, 026, 042, 046, 050, 104 | major | Rebuild (same fix as B1) |
| M8 | `/comprendre/amendements/` callout (`amendements.astro:89`, `pipeline/b_amendements.py:88`) | « projets d'amendements, **datés du 19 octobre 2026** » | The liasses print only « Résolution — **octobre 2026** » (no day). 19 Oct is the PDF-metadata date of the snapshot. The files served today are dated 17 and 18 Nov 2026 | major | Say « octobre 2026 », or « version du … » with the date of the file actually used |
| M9 | `niches.json › meta.source.url`, `facts` | URL `…/donnees/PLF 2026_V&M tome II - Annexe 3 - … - 0910.xls` | HTTP 308 redirect to `/donnees/Niches fiscales.xls`. The workbook is **unchanged** (same sha256 `6d89483a…`); only the file name changed. The link still works | minor | Update the URL |

### B. Errors that exist against the October snapshot too

| id | where | stated | correct | source | severity | fix |
|---|---|---|---|---|---|---|
| M1 | `/comprendre/niches/` list, top-20 row 3, chart « Ce que le plan en ferait » (`niches-model.ts:113-118, 247-251`); niche 520110 (Pacte Dutreil, 787 B/787 C, **5 000 M€**) | « Supprimée en trois ans : un tiers en 2027, deux tiers en 2028, supprimée en 2029 » | Am. 1 III 223° abroge « les articles 787 B et 787 C ». 223° is in IV.C bis (« 218° à 223° … successions ouvertes et donations consenties à compter du **1er janvier 2027** »), not in the IV.E list (31°–36°, 39°, 142°, 150°, 153°, 158°–162°, 197°, 200°, 209°, 212°, 244°, 245°, 257°, 258°, 262°, 263°, 274°, 318°, 346°, 347°, 350°). The workbook says « En 3 ans » and the page does not show the conflict. It makes 35 % of the 14,3 Md€ « trois ans » bar | `research/pages/amendements__Liasse_PLF_P1.md` Am. 1 III 223°, IV.C bis, IV.E (pdf p. 4 → text p. 20–21) | major | Classify « supprimée au 1er janvier 2027 », or flag the workbook/amendment conflict |
| M2 | `/comprendre/niches/` plan column for 12 agricultural / coop niches classed « Supprimée » | « Supprimée … dès l'entrée en vigueur » with date « Dès 2027 » (or « Dès le 1er juillet 2027 ») | They are listed in Am. 1 IV.E and are phased by thirds (Am. 15 III: « les exonérations prévues aux 2°, 3° et 3° bis du 1 de l'article 207 portent respectivement sur les deux tiers et sur le tiers » for 2027 / 2028, abrogation 2029). Niches: **300101** (192 M€, 207-1-2°/3°/3° bis = III 159°, exactly Am. 15), **300102** (400 M€, 207-1-4° = III 160°), **60102** (101 M€, 1394 B bis = 258°), 60104 (2, 1394 B = 257°), 120147 (3, 72 A bis = 31°), 300110 (4, 207-1-4° quater = 161°), 300208 (46, 207-1-9°–11° = 162°), 530208 (2, 1028 bis/ter = 244°); unpriced: 60202 (1398 A = 263°), 300109 (207-1-1° bis = 158°), 500101 (1030/1031 = 245°), 530216 (730 bis/ter = 209°). About 750 M€ priced | Am. 1 IV.E; Am. 15 III (pdf p. 43) | major | Reclassify as « en trois ans » (or show the conflict with the workbook) |
| M3 | `/comprendre/niches/` niche 110203 (crédit d'impôt garde d'enfants < 6 ans, 1 737 M€) vs `/comprendre/calendrier/` trajectory note (`calendrier.json` `niches_agri_services_garde.note`) | Niches: « Intégrée à l'aide fondamentale … à partir du 1er janvier 2028 ». Calendar: the same credit falls « d'un tiers au titre de 2027, de deux tiers en 2028, supprimé 2029 » | Internal contradiction on the same measure. Am. 1 IV.E names « la garde des jeunes enfants », and Am. 28 VII's gage list does not include art. 200 quater B. Which is right depends on III 150° (« 23° bis du II de la section V »); I could not confirm this is 200 quater B because Legifrance is unreachable (403) | Am. 1 IV.E; Am. 28 VII; `research/source-analysis.md` §2.9 (« crédit emploi à domicile and garde d'enfants … 1/3 for 2027, 2/3 for 2028 ») | major | Make the two pages agree; the project's own source-analysis supports the « thirds » reading |
| M4 | `/comprendre/niches/` plan column for IR niches: `whenOf` returns « **Dès 2027 (cas général)** » with a link to the 2027-01-01 calendar group | IR niches classed « Supprimée » show « Dès 2027 » | Under IV.C the abrogation applies to « l'impôt sur le revenu dû au titre de **2028** et aux opérations à compter du 1er janvier 2028 » (the site's own cal_065). Concerned niches: **110102** (674 M€, 195-1-a,b,e = III 126°), **110103** (493, 195-1-f = 128°), 110107 (114, quotient conjugal, art. 194 abrogated by Am. 28 V 2°, IR 2028), 100202 (6, 196 B = 130°), 140122 (9, 163 quinquies B/C = 125°), 150114 (15), 150117 (10), 150120 (35), 150515 (84, 150-0 D ter = 90°), 150518 (196, 150-0 D 1 quater = 89°), 190208 (85, 151 septies A = 101°); unpriced 150121, 150210, 150211, 150406, 150705, 150706, 150707, 150710. About 1 720 M€ priced. The « Fusion CI IR » siblings (110104/109/110) correctly say 2028. Also 520114 (788-III, dons, III 224°) is in IV.F (halved 1 Jul 2027, nil 1 Jan 2028) but shows « Dès 2027 » | Am. 1 IV.C, IV.F; `niches-model.ts:261-282` | major | Add an IV.C rule (« IR dû au titre de 2028 ») to `whenOf` |
| M5 | `/comprendre/niches/` (`niches.astro:283-293, 331`) | « Les deux sont des données du PLF 2026 »; table column « Niveau de preuve : Donnée (PLF 2026) » for 101,3 and 134,7 Md€ | 89,406 Md€ is the sum of the official 465 lines ✓. But 33,382 Md€ (the 21 taux réduits) is, per the workbook's own footnotes (`Synthèse` sheet), « Estimation du CPO, février 2023, p. 32 … Projection sur 2024 au pro-rata de la TVA dans les comptes nationaux de l'Insee ». The +11,9 Md€ « yc TVA APU » is a column of the Résolution sheet « Chiffrages Résolution ». Neither is a PLF 2026 figure | `data/derived/csv/PLF_2026_V_M_tome_II_Annexe_3_Depenses_fiscales_0910/Synth_se.csv` rows 11, 13–14; xls sheet « Chiffrages Résolution » col J | major | Label 101,3 / 134,7 « estimation (CPO 2023 + Insee, calcul des auteurs) » and keep « Donnée PLF 2026 » only for 89,4 |
| M6 | `/comprendre/amendements/` card PLF-P1-20 (`amendements.json:641`) | « les prélèvements sociaux (**17,2 %**) … prélèvement unique de 30 % » | Since the LFSS 2026 (promulgated 30 Dec 2025) CSG on capital income is 10,6 %, so PS are **18,6 %** and PFU 31,4 % on dividends/interest and securities gains. 17,2 % remains only for the excluded list (revenus fonciers, plus-values immobilières, livrets/PEL, assurance-vie). The amendment's exposé says « 17,2 % … soit 30 % sur les titres », so the authors' text is itself outdated | https://www.mayerbrown.com/fr/insights/publications/2026/01/budget-social-2026-augmentation-du-taux-de-csg-et-perennisation-du-regime-social-management-package (27 Jan 2026); other results from search the same day | major | Rewrite the summary without the rate, or add « 18,6 % sur les titres depuis 2026 » |
| m1 | `/comprendre/calendrier/` second chart title (`calendrier.astro:192, 198`) | « Six avantages et dotations qui s'éteignent **par tiers** » | The dons panel falls by **halves** (100 → 50 → 0 %), as in the data (`dons_reduction_impot`). The five others are thirds | Am. 1 IV.F; Am. 3 V | minor | « … par paliers » |
| m2 | `/comprendre/niches/` callout « Et 143 Md€ ? » (`niches.astro:336`), chart label, `facts.json:4574` | Quote in guillemets: « 143 Md€ de niches supprimées, dont 52 Md€ vous reviennent » | The fiche reads « **143 Md€** : De niches supprimées, dont **52 milliards** vous reviennent en baisse de charges et de taxes. » (not verbatim, abridged, unit changed) | `research/pages/fiches__contribuable.md:20` | minor | Quote in full or without guillemets |
| m3 | `/comprendre/calendrier/` cal_104 and jalon 2051-01-01 « Fin de la majoration … » (snapshot text) | End dated 1 Jan 2051 | The text says « jusqu'à l'imposition des revenus de l'année 2051 » (inclusive), so the last application is the 2051 revenues. « Fin » on 1 Jan 2051 is one year early. Moot if B4 is applied | Am. 28 (pdf p. 75) | minor | « dernière année : revenus 2051 » |
| m4 | `NichesExplorer.tsx:545` filter hint | « 47 niches que **la plupart des foyers** rencontrent » | The rule is « Ménages avec ≥ 1 M de bénéficiaires » or an editorial list. Only 1 of the 47 exceeds 15 M beneficiaries; 9 have fewer than 1 M (e.g. 110107: 132 147; 730231: 10 000). The tile says « couramment » | `niches.json` beneficiaries | minor | « que beaucoup de foyers rencontrent » |
| m5 | card PLF-P2-33 (`amendements.json` resume) | « … la charge d'un jeune enfant » | Text: « la charge d'un enfant en bas âge **ou atteint d'une incapacité** » (narrower in the summary) | PLF-P2 n° 33 | minor | Add « ou atteint d'une incapacité » |

## À vérifier (uncertain)

| id | where | stated | doubt | what would settle it |
|---|---|---|---|---|
| V1 | Everything on `/comprendre/niches/` | « 465 avantages fiscaux ont un coût pour l'État » (present tense, PLF 2026 annex, Oct 2025) | The PLF 2027 annex « Voies et moyens tome II » (Oct 2026) and the final LFI 2026 may list a different count and 2025 realised costs. A search snippet mentions « 459 » dépenses fiscales in Senate PLF 2027 documents. I could not open the annex | Read V&M II PLF 2027; add « PLF 2026 » to the lede if the count differs |
| V2 | niche 120124 (81 A, 369 M€) and 60203 (1647-00 bis, 8 M€) classed « En 3 ans » | « trois ans » | Neither article is named in Am. 1 III/IV.E; they would fall under the general rule (abrogation from 1 Jan 2028) | Resolve with the authors' list |
| V3 | the 41 TVA niches classed « Supprimée dès le 1er juillet 2027 » | all abrogated | Am. 1 II 4° keeps reduced/derogatory VAT rates « à l'exception de celles que le III abroge »; III bis names 21 CIBS groups of lines. Exemptions (261-7…, 293 B, 298 bis) and rates not named in III bis may not be abrogated by Am. 1 | Map each of the 46 TVA niches to III bis |
| V4 | accise niche 800119 (28 M€) | « Supprimée » | Am. 14 keeps EU-mandated exemptions (navigation, aviation) | Check L. 312-64 / L. 312-69 against Am. 14 |
| V5 | `whenOf` « Dès 2027 » for tax = ir/is/droits | « cas général » | IV.A says IR « dû au titre de **2026** » (tax paid in 2027) for non-incentive provisions; « Dès 2027 » is defensible but the calendar flags « revenus 2026 » only in the jalon | Wording choice |
| V6 | calendar lanes (`calendrier-model.ts laneOf`) | e.g. PLFSS n° 8 under « État et agences »; PLF-P1 n° 15 gazole agricole under « Impôts » not « TVA, accises » | Classification, not facts | none |
| V7 | niche counts per category (« Ménages 115 », …) | regex classification | Editorial rule (`pipeline/b_niches.py`), not checkable against a source | none |
| V8 | status « rédigés et publiés, pas en vigueur » / « Aucun n'est adopté ni en vigueur » (see Status below) | true on 21 Nov | will stay true only while no parliamentarian tables them | re-run the scans before launch |
| V9 | `/comprendre/calendrier/` note « Palier de départ à 100 %… pas écrit dans l'amendement » and 5,5 % baseline for food | hypothesis steps | 5,5 % is current law for most food ✓; some food stays at 10 % (restauration) or 2,1 % (not food) | none |
| V10 | PLF-P1 n° 22/25 snapshot facts « 21 taxes d'État / 57 taxes affectées » | — | superseded by the live 54 / 72 (see M7) | the owner's choice of version |

## Status statements, as of 2026-11-21

- **Statements:** « rédigés et publiés, pas en vigueur », « Aucun n'est adopté ni en vigueur », `tier_note` « ni déposés ni adoptés ».
- **Searches in the parliamentary open data** for 20 distinctive phrases of the liasses: « aide fondamentale universelle », « régime socle unique », « Dit simplement », « Constitue un avantage fiscal », « 23 % du revenu net imposable », « Sont dissoutes au 1er juillet 2027 », « compte d'épargne personnel », « clé de répartition la part qui n'a plus de produit », the état B totals, and others.
  - Assemblée nationale: `Amendements.json.zip` (last modified 21 Nov 2026 13:23 GMT), all **13 894 amendments on PLF n° 3210 and 4 781 on PLFSS n° 3211**: **0 matches** (the 6 hits on « Constitue un avantage fiscal » are unrelated exposés).
  - Sénat: `ameli.zip` (last modified 21 Nov 2026 03:32 GMT), all PLF/PLFSS 2027 séance amendments: **0 matches**.
  - So, as of 21 Nov 2026, **none of the 81 (or 84) amendments was tabled** in either chamber, and the status wording is still literally true.
- **Procedural context that the wording does not mention:**
  - PLF 2027: the Assemblée rejected the first part on 4 Nov 2026 (458–0). The second part was never examined and the text went to the Sénat in the government's version (séance from 20 Nov, solemn vote 9 Dec, CMP mid-Dec) (https://www.legifiscal.fr/actualites-fiscales/4722-plf-2027-rejete-assemblee-amendements-pourraient-revenir-senat.html, 5 Nov 2026).
  - PLFSS 2027: rejected by the Assemblée in October 2026, Sénat séance from 9 Nov (https://www.publicsenat.fr/actualites/sante/budget-2027-de-la-securite-sociale-les-senateurs-proposent-de-revaloriser-sur-linflation-les-pensions-allant-jusqua-1500-euros, 4 Nov 2026).
  - The liasses are written against the n° 3210/3211 texts at first reading in the Assemblée. That reading is over, so these amendments could now only be tabled in the Sénat (or in a later reading). The wording « projets d'amendements » is therefore right; avoid implying they are about to be debated at the Assemblée.

## Verified correct (brief list)

**Niches (all 465, raw xls `Chiffrages`, `Chiffrages Résolution`, `Echéances`, `Bénéficiaires`, `Références juridiques`, `Méthodologie`)**
- ids, labels (typography only: ’, %, – spacing), tax, legal code and reference, costs 2024/2025/2026 and ε/nc/- flags: **0 differences**.
- Sums: 89 406 / 88 932 / 79 613 M€; 101 320,989; 134 702,866.
- Creation and end years, beneficiary counts, reliability, plan code (359 / 11 / 7 / 6 / 82) match the sheet.
- Compact `data/niches.json` equals `niches.json` row for row (category, tax, plan, costs, flags, household).
- 122 unpriced = 57 nc + 53 ε + 12 « - ».
- 47 household niches = 39 648 M€ = 44 %; 2 980 and 1 320 € per foyer (30 M).
- Top-20 (51,6 Md€, 58 %); category and plan totals sum to 89,406.
- 79,5 vs 79,613 Md€ for 2026 (écart 113 M€).
- 465 + 21 = 486; 101,321 + 33,382 = 134,703; +11,9 Md€.
- « 143 Md€ » and « 52 milliards » exist in the fiche Contribuable.
- Plan labels « trois ans » (E), « dons » (F: IR 200, IS 238 bis, IFI 978), « plans et livrets 1er juillet 2027 » (C), « TVA/accises 1er juillet 2027 » (D), « aide fondamentale 1er janvier 2028 » (IR 2028): all match Am. 1 IV for the niches they name; the exceptions are M1–M4.
- AFU « Fusion CI IR » group = Am. 28 VII gage list, except 110203 (M3).

**Calendar**
- All 104 events: the quote is verbatim in the cited amendment (PDF-extracted text), the liasse and number are right, and the `#page` is the amendment's start page (this changes only in the live files, B2).
- Dates match the quote. 20 + 21 missions split of cal_026/050 matches each état B text (n° 15, 21 July only; n° 19 January only).
- `amendments[].dates` ↔ events consistent (143 effects); theme = amendment theme for all 143 links.
- CSG steps 9,2 → 7,6 / 6,0 / 4,3 / 2,7 / 1,1 / 0 (total 9,7 → 8,1 / 6,5 / 4,8 / 3,2 / 1,6 / 0, CRDS 0,5 until 1 Dec 2027).
- TVA food 5,5 (current) → 10 % 1 Jul 2028 → 15 % 1 Jul 2029 → 20 % 1 Jul 2030; other rates 20 % 1 Jul 2028.
- APL (conventionné) 100 / 66,67 / 33,33 / 0 on 1 Jul 2027 / 2028 / 2029; applications from 1 Jun 2027 get no right; all aides end 1 Jan 2030.
- Taxe sur les salaires 100 / 66,67 (2028) / 33,33 (2029) / 0 (1 Jan 2030).
- Niches agri/services/garde, emploi à domicile exonérations (1/3 at 1 Jul 2027, 2/3 at 1 Jan 2028, 0 at 1 Jan 2029), dotation forfaitaire, 30 698 → 61 400 ETPT (2 032 750 → 2 002 052).
- 9 « annonces sans date » quotes exist verbatim in the manifeste / fiches / lettres (4,5 M logements = « quatre millions et demi »).
- Jalons text and the tile counts (104, 60 in 2027, 33 on 1 Jan 2027, 10 jalons) are right.

**Amendments**
- For all 81: id, liasse, number, title (character for character), `article_fr`, theme, `pdf_page` / `pdf_url` (against the October PDFs).
- `objet_expose_fr` is the exposé's first sentence (spot-checked on 40).
- `resume_fr` read against the dispositif/exposé for all 81. No misstatement except M6, m5, and the stale items of section A.
- Verified in detail: 21 (TVA), 19 (10 000 € / 1 % / 3 %), 23 (27 %), 27, 28, 29, 31, 32, 34, P2-23/24/25/26/27/28/29/32/34/35/36 and PLFSS 1–8.
- credits-retires: 22 `TOTAUX` rows, 57 programmes, totals 43 855 438 934 € AE / 39 905 020 176 € CP, AE base per mission and % of AE, CP share (32,9 + 26,8 = 59,7 %), APL 8 068 vs 5,4 Md€ (n° 32), 16 520 517 313 € programme.
- The CSV `data/derived/etat_b_credits_retires_plf2027.csv` holds the 57 programme rows plus 22 total rows (79 rows).
