# Fact-check, round 2 — round2-pages (rendered pages of the 18 Nov 2026 build)

Checked: about 1 150 statements, values and links on the frozen build at `scratchpad/factcheck-dist/` (rebuilt from 8d0cf1f; 18 HTML pages): `/`, `/comprendre/`, `/comprendre/{depenses,europe,etat-partout,agences,le-plan,situations,niches,calendrier,amendements}/`, `/questionnaire/` (19 questions, answers, explanations, sources, tiers, `<noscript>` text and the interactive island, read question by question with Playwright), `/methode/`, `/a-propos/`, `/simulateur/cas-types/`, `/simulateur/` (static part and 3 result screens), the 54 glossary entries (toggletips), the `<title>`, description and OG metas of all 18 pages. Sources: `research/pages-2026-11-21/`, the November PDFs (`pdftotext`, page by page), `data/derived-2026-11-21/csv/`, `research/DIFF-2026-10-to-2026-11.md`, `engine/cas-types-results.json`, live Eurostat API, web search for law and news.

Programmatic sweeps on top of the reading:
- 192 cells of the Europe table (32 countries × 6 values) against the live Eurostat API (`tec00023`, `tec00127`, `gov_10a_main`, `ilc_di03`);
- GDP FR 2024 against `nama_10_gdp` (2 935 236 M€, updated 2026-11-11);
- 96 fiche bullets and 18 headers of `/comprendre/situations/` against `fiches__*.md`: 96/96 verbatim;
- 106 quotes of the calendar, each found on the page cited in the November PDF: 106/106;
- the start page of the 84 amendments (`#page=N`) against the PDFs: 84/84;
- the 23 état B `TOTAUX` lines: AE 24 261 621 967 €, CP 21 034 477 811 €, as displayed;
- the 47 cas-types tiles against `cas-types-results.json`;
- a grep of every HTML page, JS bundle and `data/niches.json` for the October leftovers.

**Errors: 10 (blocker 0 / major 2 / minor 8). À vérifier: 14.**
Of the 10, five are round-1 errors that are still on the site (R2-03, R2-06, R2-07, R2-08, R2-10) and five are new or newly visible (R2-01, R2-02, R2-04, R2-05, R2-09).

All other round-1 items are FIXED or N/A: see the status table (80 round-1 error ids: 70 FIXED, 5 STILL WRONG, 5 N/A).

## Errors

| id | where (page + source) | stated | correct | source | severity | fix |
|---|---|---|---|---|---|---|
| R2-01 | 7 pages (`/`, `/comprendre/`, `/depenses/`, `/etat-partout/`, `/agences/`, `/le-plan/`, `/questionnaire/`): 29 `href` and 46 occurrences including the serialized island props. Root cause: `site/src/lib/vite-typo-json.mjs:23` runs `typoDeep(…, {spaceBeforePercent: true})` on every JSON string, URLs included; `site/src/lib/typo.ts:67` rewrites `(\d)%` into `\d NBSP %`. | Source chips for the two most cited workbooks link to `https://france-resolution.fr/donnees/S%C3<U+00A0>%A9ries%20des%20graphiques.xlsx` and `…/Synth%C3<U+00A0>%A8se%20des%20chiffrages.xlsx` (a no-break space inside `%C3%A9` / `%C3%A8`) | `…/S%C3%A9ries%20des%20graphiques.xlsx` and `…/Synth%C3%A8se%20des%20chiffrages.xlsx`. `facts.json` holds the right URLs (`facts.json:135, 469`); the build corrupts them. | `curl -I` on 2026-11-21: the correct URLs return 200; the corrupted ones (as a browser sends them, `%C3%C2%A0%A9`) return 404. Affects every « Chiffrage publié », GraphVA, GraphAgences, Annexe Manuscrit, Graph236 chip. | **major** (the source of each « Annoncé » number is a dead link). Probably older than the update (the October file names had the same `%C3%A9` pattern); not caught in round 1 because the checkers read link labels, not targets. | Skip `url` / `href` strings (or any string starting with `http`) in `typoDeep`, or apply `spaceBeforePercent` only to non-URL strings. Add a test: no U+00A0 / U+202F inside an `href`. |
| R2-02 | `/comprendre/calendrier/`, « Dates clés » tile reframe, `site/src/pages/comprendre/calendrier.astro:142` (rendered `comprendre/calendrier/index.html`, « un dernier palier en 2051 (majoration de pension) ») | « un dernier palier en 2051 (majoration de pension) » | In the 18 Nov version of PLF-P1 n° 28 the pension adjustment is a **minoration** of 3 300 €: « Il est minoré de 3 300 € par an … Cette minoration s’applique jusqu’à l’imposition des revenus de l’année 2051 ». The same page, a few lines below, says « Date clé 11 … Dernière année de la minoration de pension de l’aide fondamentale ». | `research/pages-2026-11-21/amendements__Liasse_PLF_P1.md` n° 28; PDF p. 76 | **major** (stale October leftover, sign of the measure inverted, in the key-figures strip) | « (minoration de pension) », or build the string from the jalon title. |
| R2-03 | `/comprendre/europe/` and `/comprendre/depenses/`, « Déficit » view and the table, 5 cells; `site/src/data/europe.json` `solde_pib_*` for IS, NO, CH. `/methode/` D06. Still wrong from round 1 (public-statistics E2). | Islande 2024 **−3,7 %**, 2025 **−2,8 %**; Norvège 2025 **+10,4 %**; Suisse 2024 **+0,5 %**, 2025 **« — »**. D06: « l’API ne publie plus le solde public de l’Islande, de la Norvège et de la Suisse (tec00127) ». | Eurostat `gov_10a_main` (B9, % GDP, `updated` 2026-10-21): Islande **−4,1 / −2,6**; Norvège 2024 +12,7 ✓, 2025 **+10,5**; Suisse **+0,3 / +0,2**. Only `tec00127` lacks these three countries; the same API (`gov_10a_main`) publishes them. The values kept are the workbook's (older vintage), while the page says « mise à jour du 21 octobre 2026 pour la dépense et le déficit ». Ranks are unchanged (Islande 22e, Suisse 8e). | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_main?unit=PC_GDP&sector=S13&na_item=B9&geo=IS&geo=NO&geo=CH&time=2024&time=2025` fetched 2026-11-21: IS −4.1 / −2.6, NO 12.7 / 10.5, CH 0.3 / 0.2 | minor | Refresh the 5 cells from `gov_10a_main`; rewrite D06. |
| R2-04 | `/comprendre/etat-partout/`, « 438 impôts, 486 niches et taux réduits » (`etat-partout.astro:111`) | « Le dernier recensement en compte 465, auxquelles s’ajoutent 21 taux réduits de TVA » | 465 is the census of the PLF **2026** annex. The PLF **2027** annex (« Évaluation des voies et moyens », tome II, tabled Oct 2026) « recense 459 niches » (403 costed), 91,7 Md€ with a new VAT method. « Dernier » is false as of 2026-11-21. (The other pages label the vintage « PLF 2026 », and `/niches/` says « De l’annexe … du PLF 2026 »; the title « Les 465 niches fiscales » and the lede are a vintage choice.) | FIPECO, « Les dépenses fiscales », dated 29.10.2026: « Le rapport annexé au PLF pour 2027 recense 459 niches » (le PLF précédent en comptait 465), « 403 niches fiscales (sur 459) ». The official PDF could not be opened from the sandbox. | minor | « Le recensement du PLF 2026 en compte 465 (celui du PLF 2027 en compte 459) ». Round-1 `V4`/`V-07`/`V1` closed as an error. |
| R2-05 | `/questionnaire/` Q8 reveal (`questionnaire.ts:378`), `/comprendre/etat-partout/` « Quatre impôts ou 5 ? », `/methode/` D14 (`pipeline/facts_def.py:600`) | « La CSG sur les revenus du capital est laissée inchangée par le n° 2 » / « … sur les revenus du capital (n° 2) » presented as what the plan maintains | Newly misleading with the 18 Nov version. PLFSS n° 9 (new) compensates the 21 abolished contributions « par la majoration du taux des contributions mentionnées aux articles L. 136-6 et L. 136-7 » (CSG on patrimoine and placement income), ~13 Md€. PLFSS n° 2 itself still says the capital shares of the key are « inchangées », so the sentence is literally about n° 2, but a reader concludes that the plan leaves the CSG on capital as is. The simulator (« Pertes non chiffrées ») and the PLFSS-9 card already say it rises. | `amendements__Liasse_PLFSS.md` n° 9 IV and exposé (PDF p. 23-24); `display.lWMrpe7p.js` (« hausse, non chiffrée, de la CSG sur les revenus du patrimoine et des placements ») | minor | Add « … mais PLFSS n° 9 en majore le taux pour compenser vingt et une contributions supprimées ». |
| R2-06 | `/comprendre/niches/`, callout « Et 143 Md€ ? » (`niches.astro:376`). Still wrong from round 1 (explorers m2). | « « 143 Md€ de niches supprimées, dont 52 Md€ vous reviennent » est une annonce de la fiche Contribuable » (inside guillemets) | The fiche reads « **143 Md€** : De niches supprimées, dont 52 milliards d’euros vous reviennent en baisse de charges et de taxes » (the November fiche added « d’euros »). The guillemets enclose an abridged, unit-changed text. | `research/pages-2026-11-21/fiches__contribuable.md` l. 20 (bullet 2) | minor | Quote in full or drop the guillemets. |
| R2-07 | `/comprendre/niches/`, filter hint (`components/explorer/NichesExplorer.tsx:552`). Still wrong from round 1 (explorers m4). | « 47 niches que la plupart des foyers rencontrent » | The rule is « au moins un million de ménages bénéficiaires » or an editorial list; most of the 47 are met by far fewer than « la plupart des foyers ». The tile on the same page says « couramment », and the page below says « liste éditoriale ». | `niches.json` beneficiaries; the page's own « Qui est ménages » section | minor | « 47 niches que beaucoup de foyers rencontrent ». |
| R2-08 | `/methode/` § 12 journal, row « 24 octobre 2026 \| site » (`docs/METHODE.md:270`). Still wrong from round 1 (simulator-methode E10). | « Niveaux de certitude renommés (« Proposé dans un amendement », « **Annoncé** », « Notre estimation ») » on 24 Oct | On 24 Oct the second tier was « **Promis par les auteurs** » (`git show 71125e2:docs/METHODE.md:55` and `:240`); « Annoncé » arrived on 25-26 Oct (the 26 Oct row records the unification). | git history, commits 71125e2 / f2b2237 / 9d85b26 | minor | Restore « Promis par les auteurs » in the 24 Oct row. |
| R2-09 | `/methode/` § 11, paragraph « 57,0 % ou 57,3 % du PIB ? » | « Le classeur ne précise pas le millésime ou le périmètre de son PIB ; nous n’avons pas la table qui l’expliquerait. » | Contradicted a few lines below by D04 (« Le PIB du classeur est celui de l’édition de mai 2025 des comptes nationaux ; l’édition de mai 2026 le porte à 2 935,2 Md€ … 56,96 % ») and by `/depenses/` and `/europe/`, which were fixed in round 1 (public-statistics E3). The Méthode paragraph was not updated. Eurostat `nama_10_gdp` FR 2024 = 2 935 236 M€ confirms 2 935 Md€. | `/comprendre/depenses/` « Pourquoi 57,0 % ici… » vs `/methode/` D04 | minor (internal inconsistency) | Reuse the `/depenses/` wording. |
| R2-10 | `/questionnaire/` Q14 (« effectifs au 31 décembre 2023 », 5 803 862 / 2 570 237 / 1 358 476) and `/comprendre/etat-partout/` « 5,8 millions d’agents publics ». Still the same as round 1 (questionnaire Q-06). | DGAFP end-2023 headcounts as the current figure | DGAFP *Chiffres clés, édition 2026* (Oct 2026) gives end-2024: 5,85 M agents, FPE 2,58 M. The year is printed on the page and the conclusion (State 44 %, not a majority) does not change. | `https://www.fonction-publique.gouv.fr/files/files/publications/publications-dgafp/cc-2026-web.pdf` (as read in round 1; not re-opened here) | minor (vintage, labelled) | Update to end-2024 or add « (édition 2025 ; l’édition 2026 donne … au 31/12/2024) ». |

## À vérifier (uncertain)

| id | where | stated | doubt | what would settle it |
|---|---|---|---|---|
| V2-01 | « Amendements publiés le 18 novembre 2026 » (le-plan, calendrier, amendements, méthode, simulateur) and card headings « liasse du 17 novembre 2026 » (P1, PLFSS) / « 18 novembre » (P2) | A single publication date | The date comes from the PDF creation metadata (P1 and PLFSS 17 Nov, P2 18 Nov). The authors' own `donnees.html` says « 10 novembre 2026 » on all three cards, the PDF covers still say « octobre 2026 », and the HTTP `Last-Modified` is the crawl day (21 Nov). The site explains the 17/18 Nov dates (« republiées les 17 et 18 novembre ») so the label is defensible; « publiés le 18 novembre » is exact only for the last file. | The authors' publication date, or a wording « version du 18 novembre 2026 ». |
| V2-02 | « à la date du 21 novembre 2026, aucun n’avait été déposé au Parlement » (calendrier, amendements, `amendements.json › tier_note`) and « rédigés et publiés, pas en vigueur » everywhere | No amendment of the 84 was tabled | Verified in round 1 on the Assemblée (13 894 PLF + 4 781 PLFSS amendments, `Amendements.json.zip` of 21 Nov 13:23 GMT) and Sénat (`ameli.zip`) open data: 0 matches on 20 distinctive phrases. I did not re-download the 366 MB archive. The status is time-stamped, which is correct, but must be re-run before launch. | Re-run the open-data scans on the release day. |
| V2-03 | `/methode/` and `cas-types-results.json`: « la législation en vigueur au 24 octobre 2026 » | Reference date of « aujourd’hui » | The baseline was re-verified through 21 Nov (no change found: SMIC decree not published as of 19 Nov, APL revalued 1 Oct, ARE rupture conventionnelle 15 / 20,5 months from 1 Sept). The label says 24 Oct. Not false, but the verification date is now later. | Decide on the label; re-check on 1 Dec 2026 (SMIC +1,6 % announced, 12,51 €/h, 1 897,39 € brut expected; decree not yet in the JO). |
| V2-04 | `/`, `/comprendre/etat-partout/`, `/comprendre/agences/`: « Il chiffre à environ 310 € par foyer et par an (sur 30 M de foyers) l’économie / le coût de la fermeture des agences » | 310 € credited to the plan | 9,317 Md€ ÷ 30 M = 310,6 (site's computation, denominator shown). The workbook's own per-foyer cell (Annexe Manuscrit D8) says **300 €** on its 29,5 M base. Same doubt as round 1 (290 vs 300). The wording differs (« économie » on `/`, « coût » on the two others). | Say « environ 310 € (9,3 Md€ ÷ 30 M de foyers ; 300 € dans le classeur) ». |
| V2-05 | Glossary `afu`, questionnaire Q18, `/methode/` « En deux minutes »: « 550 € par adulte et par mois » | Generic AFU definition | Correct as the base amount, but silent on the 18 Nov minoration (275 € per month for a pension liquidated before 2028; pro-rata after). Explained on the Retraité situation, the le-plan list and Méthode. Not false; incomplete for a retiree reading only the toggletip. | Optional clause in the glossary. |
| V2-06 | `/comprendre/le-plan/` and Méthode: « 3 300 € jusqu’à 17 ans / l’aide de l’enfant cesse l’année de ses 18 ans »; engine adult amount at 18 | 6 600 € at 18 | Am. 28: child amount « jusqu’à l’année au cours de laquelle elle atteint l’âge de dix-huit ans ». Literal reading: the child amount runs through the year of the 18th birthday. Unchanged since round 1 (story V5, simulator V1, plan-engine V-3). | The authors' reading. |
| V2-07 | `/comprendre/etat-partout/` « 35 ministères aujourd’hui » | Government of Dec 2024 names (workbook) | A search on 2026-11-21 reports 35 members (PM + 19 ministres + 15 ministres délégués) for the Lecornu government, so the count coincides; names not compared with the 7 Nov 2026 décret (Légifrance not opened). | Decree of 7 Nov 2026 on Légifrance. |
| V2-08 | `/comprendre/le-plan/` « salaire net médian de 2 190 € » | Median net salary, no scope | Insee Première 2079: private sector, EQTP, 2024. Unchanged from round 1 (V8). | Add « privé, EQTP ». |
| V2-09 | `/comprendre/le-plan/`, « Année 1 du chiffrage » tab: ribbon « Année 1 → Salaire net 114,46 » tagged « proposé dans un amendement » in the CSV table | Year-1 114 Md€ as amendment text | The tab now says « Année 1 est l’étiquette non datée du chiffrage : tout est hachuré (annoncé) » and the CSV row (« proposé dans un amendement ») is the only residue. Round-1 E4 fixed on the page; the table tag is the leftover. PLFSS n° 1 gives 33 Md€ for 2027, 114 Md€ « en année pleine dès 2028 ». | Retag the row, or keep it and rely on the tab note. |
| V2-10 | Questionnaire Q11, `/etat-partout/`: 48 834 443 mots (2026), 26 008 794 (2005) | Légifrance « statistiques de la norme » | Légifrance returns 403 from the sandbox, as in round 1; SGG says « près de 48,8 millions » for 2026. | Open the Légifrance page from a browser. |
| V2-11 | `/comprendre/situations/#enseignant`: « Amendements concernés » lists PLF-P2 n° 26 | Link under the Enseignant fiche | Round-1 V-01 unchanged: n° 24 expressly spares « l’enseignement scolaire », and the fiche says « Votre salaire est maintenu ». Not literally false (n° 26 covers any State corps whose mission is cut). | Owner's decision. |
| V2-12 | `/methode/` § 6 CMG: « ressources entre 815 € et 8 500 € ; tarif de référence 4,85 €/h, valeur 2025 » | 2025 value used in 2026 | Round-1 V-2 / verdict 29 unsettled: the 2026 PSU floor is 814,62 €; the 2026 tarif de référence could not be read (caf.fr unreachable). Effect ≤ 8 €/month. | CNAF circular. |
| V2-13 | `/styleguide/` (published, not in the nav): « Retraité·e, pension moyenne +35 € », tier « Proposé dans un amendement » | Fictitious data | Labelled « Données fictives pour le guide de style », so not a claim; but it now contradicts the retiree results (all 7 retiree cas-types lose). Outside the requested pages. | Remove or relabel. |
| V2-14 | `/comprendre/etat-partout/` « Ils portent déjà 75 % des recettes » | Manifesto quote | Round-1 V3: 75 % is not reproducible from the workbook (63,0 % on the book's table). It is quoted and tagged « Annoncé ». Unchanged. | The authors' derivation. |

## Round-1 errors: status on the rendered 18 Nov build

Legend: FIXED = correct on the build; STILL WRONG = see the R2 id; N/A = superseded or not a rendered statement. Counts: 70 FIXED, 5 STILL WRONG, 5 N/A (80 ids).

### story-pages.md (9)
| id | status | evidence on the build |
|---|---|---|
| E1 lifecycle « dès 18 ans, 13 464 € » | FIXED | « à 18 ans, 13 464 € (compte éducation compris), puis 6 864 € par an de 19 à 63 ans » (Lecture, both modes) |
| E2 PLFSS n° 1 « CSG capital et taxe sur les salaires » | FIXED (see R2-05 for a new nuance) | « PLFSS n° 1 à 3 … CSG sur les pensions, le chômage et les indemnités journalières (n° 1) et sur les revenus du capital (n° 2), taxe sur les salaires … (n° 3, abrogée au 1er janvier 2030) » |
| E3 134,7 Md€ / 486 shown as PLF data | FIXED | 89,4 Md€ « PLF 2026 » for 465; 134,7 Md€ « Annoncé, calcul des auteurs (CPO 2023 projetée) » on `/`, `/comprendre/`, `/etat-partout/`, `/niches/`, Q6 |
| E4 Sankey « première année » | FIXED (see V2-09) | Tab renamed « Année 1 du chiffrage », undated, all hatched, PLFSS 33 / 114 Md€ explained |
| E5 « a valeur de loi » | FIXED | « figure dans un texte d’amendement : proposé, rédigé et publié, pas en vigueur » on `/agences/`, `/etat-partout/` |
| E6 TVA « en 2028 » | FIXED | « 10 % dès le 1er juillet 2028, … 15 % … 2029, … 20 % … 2030 » |
| E7 « 300 € par mois d’ici trois ans » quote | FIXED | full quote « 300 euros par mois versés sur un compte épargne retraite personnel d’ici trois ans » |
| E8 « 13 % arrondi de 12,0 à 12,6 % » | FIXED | « Le « 13 % » arrondit les 12,56 % du classeur au salaire net médian (12,04 % au SMIC) » |
| E9 aria « Répartition de 100 € » sums to 101 | FIXED | 56 + 15 + 11 + 9 + 6 + 3 = 100 |

### questionnaire-situations-glossary.md (11)
| id | status | evidence |
|---|---|---|
| Q-01 Q6 niches vs éducation (blocker) | FIXED | Reference answer « Non, moins que l’éducation » (89,406 / 134,703 vs 148,640 Md€ Insee COFOG 09); 128,617 disclosed as the book's regrouping; chips relabelled; Q5 uses 8,9 % |
| Q-02 Q8 PLFSS n° 1 / taxe sur les salaires | FIXED | n° 1 and n° 3 correctly split (see R2-05 for n° 9) |
| Q-03 Q7 « Selon le plan … 148 € » | FIXED | « Le plan, ramené à un jour : 148 € » |
| Q-04 Q13 tier | FIXED | `Annoncé` on all three chips |
| Q-05 Q19 Finland / euro area | FIXED | 57,9 % and 49,3 % |
| Q-06 Q14 DGAFP vintage | STILL WRONG (R2-10) | end-2023 |
| Q-07 Q6 « nombre arrondi » | FIXED | « Le « 486 » du plan n’est pas arrondi : c’est exactement 465 niches … plus 21 taux réduits » |
| S-01 sub-points omitted (Travailleur, Jeune adulte) | FIXED | sub-items rendered under their parent (3 under « 300 € », 5 under « Vos études ») |
| S-02 « 0 perte » | FIXED | « annonce 10 gains » |
| G-01 PAJE | FIXED | « allocation de base (moins de 3 ans), aide à la garde (CMG, moins de 6 ans ; jusqu’à 12 ans …) » |
| G-02 ménage | FIXED | « … le simulateur raisonne sur une famille … comme la CAF » |

### explorers.md (18)
| id | status | evidence |
|---|---|---|
| B1 81 → 84 | FIXED | 84 everywhere (35 + 40 + 9); title « Les 84 amendements » |
| B2 PDF page anchors | FIXED | 84/84 start pages equal the November PDFs; 106/106 calendar quotes on the cited page |
| B3 état B | FIXED | 23 missions, 63 programmes, CP 21 034 477 811 €, AE 24 261 621 967 € (summed from the PDF); 30,7 % + 19,6 % = 50,2 % |
| B4 AFU majoré → minoré | FIXED (card, calendar, jalon) / see R2-02 for the one stale word | card PLF-P1-28 « minorée … servie par un régime obligatoire … au prorata », jalon « Dernière année de la minoration » |
| M7 dates and counts (12 / 22 / 25 / 11) | FIXED | n° 12 1er janvier 2027, 54 / 72 taxes, « clos » |
| M8 « datés du 19 octobre » | FIXED | « republiées les 17 et 18 novembre 2026, couverture … octobre 2026 » |
| m6 old workbook URL | FIXED | `Niches%20fiscales.xls` |
| M1 Pacte Dutreil | FIXED | « supprimé au 1er janvier 2027 », conflict shown |
| M2 12 agricultural niches | FIXED | classed IV.E « par tiers jusqu’en 2029 », conflict shown |
| M3 garde d’enfants credit | FIXED | thirds on both pages; flagged as an inference |
| M4 IR niches « Dès 2027 » | FIXED | « à partir de l’impôt sur le revenu de 2028 (45 niches …) » |
| M5 101,3 / 134,7 as PLF data | FIXED | tiers and wording corrected |
| M6 PS 17,2 % | FIXED | « 18,6 % sur les titres depuis 2026, 17,2 % sur l’immobilier » |
| m1 « par tiers » (dons) | FIXED | « par paliers » |
| m2 « 143 Md€ » quote | STILL WRONG (R2-06) | |
| m3 « Fin » 2051 | FIXED | « Dernière année de la minoration … revenus de 2051 » |
| m4 « la plupart des foyers » | STILL WRONG (R2-07) | |
| m5 PLF-P2-33 summary | FIXED | « … ou atteint d’une incapacité » |

### public-statistics.md (6)
| id | status | evidence |
|---|---|---|
| E1 Eurostat vintage (49,3 / 48,9 / 57,9 / 57,3 / 7,7 pts / ≈ 7 500 €) | FIXED | Expenditure (2024, 2025) and median income (€, SPA) cells match the live API for all 32 rows; 7,7 × 2 919,9 ÷ 30 M = 7 494 € ✓; ÷ 12 = 624,5 (« ≈ 620 », rounded to 10) |
| E2 deficits | STILL WRONG (R2-03) | EA20, FI, DE, BG, SE, DK, EE… fixed; IS / NO / CH not |
| E3 PIB 2 920 vs 2 935 | FIXED on `/depenses/`, `/europe/` (edition of May 2025 vs May 2026); Méthode paragraph R2-09 | |
| E4 1 672 vs 1 673 | N/A (rejected in the verification round) | |
| E5 Malta | FIXED | 19 701 € / 22 077 SPA |
| E6 SILC income year | FIXED | « enquête SILC 2024, revenus 2023 » on every title and header |

### baseline-law.md (6)
| id | status | evidence |
|---|---|---|
| BL-1 CMG 12 years (blocker) | FIXED | reason text, glossary `cmg`/`paje`, form « enfants de moins de 12 ans », Méthode § 6 |
| BL-2 isolement 18 → 12 months | FIXED | « séparé·e il y a moins de 12 mois … pendant 12 mois » |
| BL-3 IR 61 € | FIXED as documented in Méthode (« après réductions, avant crédits ; sous le seuil, seul l’excédent d’un crédit sur l’impôt est remboursé »); engine not re-run | |
| BL-4 PAJE | FIXED | |
| BL-5 CSG on ARE | FIXED | « taux réduit 3,8 % ou exonération selon le revenu fiscal de référence : non modélisé » |
| BL-6 baseline-rules 157 bis | N/A (internal research doc; corrected in the repo) | |

### simulator-methode.md (13)
| id | status | evidence |
|---|---|---|
| E1 student APL floor (blocker) | FIXED | Méthode § 1 and § 6: 8 600 / 6 900 € applied; boursier question |
| E2 « l’impôt est individuel » (blocker) | FIXED | form hint and H11: « foyer fiscal maintenu … se marier ne change plus le montant » |
| E3 zone 1 | FIXED | « une grande partie de la grande couronne (Versailles, Argenteuil, Cergy, Évry, Meaux…) », « environ 500 communes » |
| E4 ARE durations | FIXED | « 548 / 685 / 822 jours … 15 mois après une rupture conventionnelle depuis le 1er septembre 2026 » (verified: loi n° 2026-470, code.travail.gouv.fr) |
| E5 employer cost | FIXED | H4 and employer panel: « coût employeur inchangé pour un salarié sans exonération particulière … exonérations spécifiques … disparaissent » |
| E6 rounding | FIXED | SMIC single: headline +115 = « En clair » +115 = tile +115; mono-1-1e −85; retraite-1800 −165; seul-5 +1 100 |
| E7 « 551 € » | FIXED | « 550 € par mois » |
| E8 AAH 62 y | FIXED | « 62 ans et 9 mois pour les personnes nées entre 1963 et mars 1965 ; simplifié à 62 ans » |
| E9 isolement | FIXED | see BL-2 |
| E10 journal « Annoncé » | STILL WRONG (R2-08) | |
| E11 « par pension » | FIXED | « −3 300 € par titulaire d’une pension … » |
| E12 parc social tier | FIXED | PLF-P2 n° 29 half written, sale « annoncé » |
| E13 taxe sur les salaires | FIXED | « pas ou peu soumis à la TVA (moins de 90 % de leur chiffre d’affaires) » |

### plan-engine.md (12)
| id | status | evidence |
|---|---|---|
| PE-1 | FIXED | « revenus 2026 (heures supplémentaires, titres-restaurant) ou 2028 (intéressement, participation) » |
| PE-2 | FIXED | see simulator E4 |
| PE-3 | FIXED | CEE source = am. 16 |
| PE-4 | FIXED | « abrogée (amendement PLF-P1 n° 20, I 3°) pour les cessions à partir du 1er janvier 2027 » |
| PE-5 | FIXED | |
| PE-6 | FIXED | « pensions des régimes de base (PLFSS n° 5), AAH, PA et RSA (PLF-P2 n° 28) » |
| PE-7 | FIXED | |
| PE-8 | FIXED | H13 rewritten |
| PE-9 | FIXED | H12 « Estimation », H3 « Estimation (… sans elle : amendement proposé) » |
| PE-10 | N/A (engine tier of one component; retiree results show the AFU as « Estimé » when the 2028 pro-rata is assumed; not testable on static pages) | |
| PE-11 | FIXED | « ticket modérateur, participations forfaitaires, franchises et forfait journalier … foyer fiscal, diminuées de l’impôt » |
| PE-12 | FIXED | ALD part split out, « fonctionnaire de l’État » |

### facts-plan-sources.md (5)
| id | status | evidence |
|---|---|---|
| E1 D28 « retour d’impôt » | FIXED | « dépenses existantes fusionnées dans l’aide 135,346 Md€ » |
| E2 D14 | FIXED | (see R2-05) |
| E3 « 433 en sommant » | N/A (`facts.json` note; corrected there, not rendered) | |
| E4 CEP « montant inscrit : 0 € » | FIXED | « Aucun montant n’est inscrit … nul à défaut » |
| E5 « hors agences et offices de l’eau » | N/A (fact label; corrected in `facts.json`, not rendered) | |

### VERIFIED-nonplan.md (29 verdicts, duplicates of the above)
Rows 1-3, 5, 7-16, 21-22, 24-27 FIXED as listed; row 4 (IR 61 €) FIXED as documented; row 6 N/A; rows 17-18 FIXED except the five IS/NO/CH deficit cells (R2-03); row 19 FIXED on the pages (the « 42,87 % / 1 251,8 Md€ » is no longer displayed); rows 20 and 23 rejected (N/A); row 28 (SMIC) correct and now noted on Méthode (« Note du 21 novembre 2026 sur le SMIC »); row 29 (CMG tarif 4,85 €/h, floor 815 €) still unsettled (V2-12).

## Stale October leftovers: scan result

Searched every HTML page, every `_astro/*.js` bundle and `data/niches.json`.
- « 81 » appears only in the amendments page « (81 amendements) » sentence about the October version, and in the Méthode changelog; both are correct history.
- « 34/39/8 », « 21 taxes », « 57 taxes », « cinquante-sept », « 1 à 7 ans », « majoré de 3 300 », « +3 300 », « 39 905 », « 43 855 », « 606,97 », « 236,05 », « 19 octobre », « 22 missions », « 22 amendements », « 8 067 », « 13 129 »: **none**.
- « 39,9 » / « 43,9 » / « 236,055 » / « 127,35 »: only in the Méthode changelog and D08/D09, as dated October history.
- Retiree claims: no page assumes the old +3 300 €; the Retraité situation, le-plan, the amendments card, Méthode (§ 1, § 3 H21, § 5, § 7, D38), the cas-types (7 retiree cases all lose) and the simulator hints use the minoration. **One stale word: R2-02** (« majoration de pension », calendar tile).
- Lifecycle text and « Qui gagne, qui perd » wording: correct (« Le classeur n’applique pas la minoration … dès 64 ans … 3 300 € par an selon l’amendement »; « les foyers types qui perdent … retraités »).

## Status wording and label: consistency

- « rédigés et publiés, pas en vigueur » / « aucun n’est en vigueur »: identical meaning on `/`, `/comprendre/le-plan/`, `/comprendre/situations/` (18 footers), `/comprendre/calendrier/`, `/comprendre/amendements/`, `/questionnaire/` (Q8, Q12, Q15, Q18), `/methode/` (header, § 2, « Rien ici n’est présenté comme une loi votée ni comme un texte déjà déposé »), `/a-propos/`, glossary `amendement`.
- « à la date du 21 novembre 2026, aucun n’avait été déposé au Parlement » only on calendar and amendments (time-stamped); see V2-02.
- « Amendements publiés le 18 novembre 2026 »: used on le-plan, calendrier, amendements, Méthode (header, § 10, § 11), simulator; always glossed « republiées les 17 et 18 novembre 2026 »; see V2-01 for the dating nuance. The numbers it covers are right: 84 = 35 + 40 + 9; PDF pages 95 / 70 / 24; PLF n° 3210 and PLFSS n° 3211 appear in the liasses.

## Reframings recomputed (underlying numbers that changed)

- 236,353 Md€ ÷ 30 M ÷ 365 = 21,6 → « 22 € par jour » ✓. 236,353 ÷ 8 000 € = 29,544 M foyers ✓ (D16).
- Year 1 129,4593 = 41,2113 + 36,148 + 52,1 ✓; full-year 106,8934 = 27,0307 + 32,71 + 29,6 + 17,5527 ✓; épargne year 1 14,9993 = 129,4593 − 114,46 ✓; 121,893 vs 121,938 residual −0,045 ✓ (D10); Sankey node values 68,2 / 68,9 / 52,1 / 29,6 / 17,6 and « 129 » / « 107 » / « 122 » ✓; « 236,398 » and « 236,402 » ✓ (Graph236 D24).
- Agences: 9,317 ÷ 30 M = 310,6 → « environ 310 € » (V2-04 for the attribution).
- Niches: 89,406 ÷ 30 M = 2 980 → « 3 000 € » ✓; 39,648 ÷ 30 M = 1 322 → « 1 320 » ✓; 134,703 ÷ 30 M = 4 490 ✓; 143 ≈ 72,3 + 18 + 53 (Flux) ✓; 7,49 Md€ for the 17 divergent niches = 5 000 + 757 + 1 737 ✓.
- État B: 21,034 ÷ 30 M = 701 → « ≈ 700 € » ✓; 6,447 ÷ 21,034 = 30,65 % ✓; 4,120 ÷ 21,034 = 19,59 % ✓.
- Europe: 57,0 − 49,3 = 7,7 pts ✓; 7,7 % × 2 919,9 ÷ 30 M = 7 494 € ✓; 1 671,794 ÷ 2 935,236 = 56,96 % ✓.
- H21: 170 / 172 = 98,84 % → 3 300 × 0,9884 ÷ 12 = 271,8 €/month ✓ (simulator: « −271,80 € par mois », AFU 278 € for retraite-2028 ✓); 142 / 172 for 2035 ✓.
- Retraité with a child: 550 + 275 − 275 = 550 (was 1 100) ✓.
- 7 retiree cas-types: −141 / −164 / −219 / −244 / −255 / −422 / −141 after TVA → tiles −140 / −165 / −220 / −245 / −255 / −420 / −140 ✓; pattern sentence (« personnes seules, familles monoparentales, retraités et handicap »; « de +115 € à +560 € » = Seul 1 SMIC … Jeune de 22 ans hébergé·e; range −835 / +1 645 €) all derive from the JSON ✓.
- PLF-P2 n° 26: « 24 mois plus un mois par trimestre, 84 mois au plus, jusqu’à une pension sans décote » = II.C verbatim (PDF p. 47) ✓; 61 400 / 30 698 ETPT ✓ (p. 30).

## Verified correct (what was found right)

- **Home and hub**: 1 672 Md€ and 153 € par jour; 1 104 / 746 / 303; 1 607 h and 3 260 h (3 256 computed); 48,8 M words, +87,8 %; 63 € (29 + 11 + 23); step 1 aria and legend (100 €); step 2 answer (6,36 %, 106 Md€, 3 544 €, 9,71 €); 465 + 21 = 486; 438 impôts.
- **Depenses**: all COFOG figures unchanged and previously matched Insee 3.301 to the cell; 100 € grid; 54 000 € ÷ 12 = 4 500; Europe values (192 cells, all but five); readouts of the three views (rank 2e / 28e / 12e; Suisse 2,0 ×).
- **État partout / agences**: 35 → 7 ministries (7 + 9 + 19); 668 / 78 / 55 / 303 and every « dont »; 1 104 = 434 + 328 + 24 + 318; 337 entities, 431 operators (PDF p. 45); 438 / 4; 47 / 418 / 21; 51 % chain; DGAFP 2023 values and 580 000 = 10 %.
- **Le plan**: Sankey and « 236 milliards » reconciliation; CSG gain 275 €, 12,56 %; lifecycle 10 164 / 6 864 / 13 464; both lists (114 / 33 Md€; 6 600 / 550 / 3 300; 23 % / 27 %; TVA steps; 21 Md€ CP, 23 missions; 61 400; ARE durations).
- **Situations**: 96/96 fiche bullets verbatim, headers and mismatch notes, 49 amendment links and titles (« soixante-douze », PLF-P1 n° 28 « minorée »), Retraité site note (« servie par un régime obligatoire … au prorata »).
- **Niches** (prose and totals): 465 / 89,4 / 122 unchecked / 343 costed; four totals and their perimeters; 345 / 26 / 82 / 6 / 6 = 465; 66,1 + 11,8 + 5,05 + 3,52 + 2,86; 17 divergent niches; 79,5 vs 79,613.
- **Calendar**: 109 events (65 in 2027, 33 on 1 Jan 2027, 19 on 1 Jul 2027, 21 on 1 Jan 2028), 11 key dates, trajectories (CSG 9,7 → 0; TVA 5,5 → 10 / 15 / 20; ETPT 30 698 / 61 400; APL, taxe sur les salaires, dons, thirds, emploi à domicile, dotation).
- **Amendments** (prose and totals): 84, theme counts sum to 84, PDF pages 95 / 70 / 24, état B totals and shares, n° 22 / 25 / 26 / 28 / 29 / 33 / 34 / 35 / 40 / PLFSS 9 cards against the PDFs (accise électricité 1 € / 0,5 €, « 2023 et 2024 » in the exposé; 15,7 %, 5,2 Md€; 300 M€ in 2027, 600 M€ full year).
- **Questionnaire**: all 19 questions, reference answers, ratios (« N fois »), explanations, sources and tiers; interactive island equals the `<noscript>` text.
- **Méthode**: § 1 table, H1-H21, § 5 calendar, § 7 OpenFisca table, § 11 D01-D40 arithmetic (D04 56,96 %, D08-D10, D13 339 / 350 €, D15 222 €, D16, D19 2,690 Md€ vs 5,4 Md€, D24 63 programmes), changelog dates.
- **À propos**: licences (MIT; Licence Ouverte 2.0; CC BY 4.0; OFL), privacy statements, stack.
- **Glossary** (54 entries): all current-law and plan definitions correct after the PAJE / CMG / ménage fixes; AFU, CEP, CMI, CSG, IR, liasse, amendement consistent with the 18 Nov version.
- **Metas / OG**: no number is wrong; titles « Les 84 amendements », « Les 465 niches fiscales » (vintage PLF 2026, see R2-04).
