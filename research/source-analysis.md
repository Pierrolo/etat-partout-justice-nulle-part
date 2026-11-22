# Source analysis: "État partout, justice nulle part" (Résolution) and france-resolution.fr

Retrieved 2026-10-24 (site files last modified 2026-10-22; legal amendment liasses dated 2026-10-19).
Everything below comes from files stored in this repo. Paths are relative to `/home/user/etat-partout-justice-nulle-part/`.
Verbatim French quotes are in «guillemets». Where I infer something it is tagged **[inference]**. Where the sources disagree it is tagged **[conflict]** (all collected in section 7).

**Companion files**
- `research/reform_parameters.json`: machine-readable parameters (income tax, AFU, CSG, CEP, TVA, bouclier, etc.) with source pointers.
- `research/pages/*.md`: cleaned text of every page of the site, plus full text of the three amendment liasses.
- `data/raw/`: all downloaded originals (84 files, SHA-256 in `data/raw/SHA256SUMS`).
- `data/derived/csv/<workbook>/<sheet>.csv`: every sheet of the 7 workbooks dumped to CSV (values only). `data/derived/etat_b_credits_retires_plf2027.csv`: parsed table of the 22 «état B» credit amendments.
- `scripts/`: `crawl_site.py` (BFS crawler), `html_to_md.py`, `dump_workbooks.py`, `parse_etat_b.py` (run with `python3 -I`; nothing downloaded was executed).

---

## 0. TL;DR for the simulator and dashboard builders

1. **The book itself is not online.** The site holds a manifesto, 18 one-page "fiches" (what the plan gives/takes per situation), 7 Excel workbooks, and, most importantly, **3 liasses of ready-to-file amendments (81 amendments) to the PLF 2027 and PLFSS 2027 with exact legal parameters**. These amendments are the only place where parameters are written precisely. Treat them as the specification.
2. **The reform is fully specified for one core mechanic, and only that one:** a 23 % flat income tax minus a universal "aide fondamentale universelle" (AFU) of 6 600 €/adult/yr, 3 300 €/child/yr (+ supplements), combined with abolition of CSG/CRDS on earned income (-9.7 points on pay). With these two blocks a household's *after-reform* income tax and salary uplift can be computed exactly. The "before" side needs baseline French rules that are **not** in the source (section 8).
3. Much of what the marketing promises (600 €/month, 300 € into a savings account, 20 000 € of public assets per household, compte éducation 6 600 €/child, unemployment 13 -> 6 months, bouclier sanitaire 10 % co-pay) has **no legal text** in the liasses; amounts are "voted each year by finance law" (default zero) or only appear on fiches/workbooks.
4. Several headline numbers differ between sources (300 € vs 275 €/month for the median worker; +13 % vs +12.0/12.6 %; "4 impôts" vs "5 impôts"; AFU 550 €/month "received" vs net-of-tax transfer). See section 7.

---

## 1. The book and the project

| Item | Value | Source |
|---|---|---|
| Title | **État partout, justice nulle part** (matches the repo name) | `data/raw/site_html/livre.html`, `index.html` |
| Authors | Ingrid Barrat, Arthur Marle, Moïse Mitterrand | same |
| Publisher / price / ISBN | Éditions Chronique; 9,90 €; ISBN 978-2-36-602648-1; «Disponible dès maintenant en librairie» | `livre.html` |
| Publication date | 9 October 2026 (LGDJ, Eyrolles, leslibraires listings via web search; not stated on the site) | web search 2026-10-24 |
| Pages | **[conflict]** 180 (LGDJ / leslibraires) vs 84 (Google Books / Eyrolles; Google Books also shows a different ISBN 9782366026498). A footnote in the PLFSS amendments cites the book «p. 141», which fits 180 pages. | web search; `Liasse_PLFSS.pdf` |
| Author bios (site + 4th cover `data/raw/img/quatrieme.png`) | **Ingrid Barrat**: Polytechnique, «a travaillé plusieurs années au ministère des Finances», «a mis le projet en musique»; appears monthly on BFM Business "Les Experts". **Arthur Marle**: ESSEC, ex-professeur d'économie, dirigeant d'entreprise, «Son intuition est à l'origine du projet». **Moïse Mitterrand**: HEC, ex-professeur de mathématiques, dirigeant d'entreprise, «préside Résolution et porte le projet». | `auteurs.html`, `videos.html` |
| Association | association Résolution, déclarée n° 991 580 622, 113 avenue de Verdun, 92130 Issy-les-Moulineaux; directeur de la publication Moïse Mitterrand; hosted on Vercel | `mentions-legales.html` |
| Contact / movement | contact@france-resolution.fr; membership free; "J'écris à mon élu" letter tool (43 letters sent at 2026-10-22 per `donnees/compteur.json`) | `contact.html`, `adherer.html`, `ecrire.html`, `data/raw/site_json/compteur.json` |
| Tagline | «Sauvons l'État. Enrichissons les Français.» | `manifeste.html` |
| Home promise | «Vous rendre **600 €** par mois» | `index.html` |

### Central thesis in plain language

France is not condemned to decline; its *State* is the problem: it tries to be everywhere (35 ministries, 1 104 national agencies, 438 taxes, 486 tax niches, ~2 000 CERFA forms) and as a result is nowhere where it is needed (defence, police, justice get ~6 % of public spending; «insécurité et pauvreté»). Because taxing work makes people work less, high spending forces ever more taxation («l'engrenage»). The authors' answer, presented as non-partisan, non-austerity and with no scapegoat (immigrants, civil servants, retirees, welfare recipients, the rich and the EU are explicitly *not* blamed): **concentrate the State on 7 essential missions (sécurité, solidarité, éducation: «7 ministères au lieu de 35») and stop everything else, then give the money back**. The "grande restitution" is first **salarial** (CSG/CRDS abolished on earned income: ~+13 % net pay) then **patrimoniale** (600 Md€ of public assets "rendered" to households, ~20 000 €/foyer, plus a personal savings/retirement account fed with ~300 €/month). Welfare is replaced by one universal cash payment (AFU) netted against a single flat income tax, so "le travail paie largement mieux que l'inactivité" (marginal take-home 0,77 € per euro earned). The tax system is collapsed to four taxes (TVA, revenu, sociétés, foncier). Everything is sold as a plan the reader can verify: all figures, sources and amendments are published.

### Chapter structure

- **Not available.** No table of contents is on the site; the retail pages show none. The only partial list found (Google Books, possibly a different edition): «Copyright», «L'État nous appauvrit» (p. 44), «Sauvons l'État de lui-même» (p. 52), «Choisissons un avenir meilleur» (p. 84). Page numbers do not look reliable.
- Indirect evidence of the book's architecture: the data page cites the book's **«annexe, partie II – 4»** for the 236 Md€ table, so the book has at least Parts I–II and an annex; amendments cite «p. 141» for "ce que l'État cesse de dépenser va d'abord au salaire net".
- The manifesto (the one-page version of the book) is structured: *Le constat* (4 blocks) -> *La solution* (2 blocks + 4 measures) -> *Les propositions* (7 measures) -> *chute*.

### Site map (29 HTML pages crawled, no `sitemap.xml`/`robots.txt`)

`/` (cover), `/manifeste.html` (+ `manifeste.pdf`), `/fiches.html` (index of 18 fiches), `/fiches/<slug>.html` + `.pdf` ×18, `/donnees.html`, `/videos.html`, `/auteurs.html`, `/livre.html`, `/contact.html`, `/adherer.html`, `/ecrire.html`, `/mentions-legales.html`. No JS chart configs or inline datasets exist in the HTML (the site is static; `ecrire.html` loads `lettres/textes.json`, `donnees/elus/<dept>.json`, `donnees/compteur.json`, `api/etat`). The datasets are all in the downloadable workbooks/PDFs.

**The 18 "situations" (fiches)**, i.e. the site's own persona taxonomy (useful as simulator profiles). Counts in the header are "perte(s) · gain(s)":

| Group | Fiche (slug) | Header |
|---|---|---|
| Tout le monde | Citoyen (`citoyen`) | 68 M · 1 perte · 13 gains |
| | Contribuable (`contribuable`) | 30 M foyers · 10 gains |
| | Foyer (`foyer`) | 30 M · 1 perte · 5 gains |
| Le travail et l'entreprise | Travailleur | 29 M · 8 gains |
| | Personne sans emploi (`personne-sans-emploi`) | 5,7 M · 3 pertes · 3 gains |
| | Entreprise | 2 pertes · 9 gains |
| | Agent public indispensable | 5,22 M · 1 perte · 4 gains |
| | Agent public dont le poste est supprimé | 580 000 postes publics · 1 perte · 3 gains |
| | Enseignant | 1 perte · 3 gains |
| La famille et les âges de la vie | Jeune adulte | 4 M · 1 perte · 8 gains |
| | Famille | 1 perte · 5 gains |
| | Retraité (`retraite`) | 17 M · 2 pertes · 3 gains |
| Se loger, se soigner, se former | Locataire | 2 pertes · 3 gains |
| | Patient | 1 perte · 4 gains |
| | Personne handicapée | 2 gains |
| Épargner et consommer | Consommateur | 1 perte · 3 gains |
| Quand un dispositif public tient lieu de ressource | Bénéficiaire d'un chèque ciblé | 1 perte · 3 gains |
| | Entreprise ou association subventionnée | 1 perte · 4 gains |

---

## 2. THE REFORM PROPOSALS

Legend for the last column: **EXACT** = enough in the sources to compute the *reform side* of a household's change exactly (baseline "before" still needs external rules); **PARTIAL** = some parameters, others left to future laws/decrees or unspecified; **NO** = claim only.

Vehicles: **PLF-P1** = `Liasse_PLF_P1.pdf` (34 amendments to PLF 2027 n° 3210, première partie); **PLF-P2** = `Liasse_PLF_P2.pdf` (39, seconde partie); **PLFSS** = `Liasse_PLFSS.pdf` (8, PLFSS 2027 n° 3211). "Am. n" = amendment number inside that liasse. Text of each is in `research/pages/amendements__*.md`.

### 2.1 Income tax and universal aid (simulator core) [PLF-P1 Am. 28, art. 2 PLF; PLFSS Am. 7]

| Parameter | Exact value (verbatim where quoted) |
|---|---|
| Income tax schedule | «L'impôt est égal à **23 %** du revenu net imposable.» (replaces the progressive barème; art. 193-197 CGI rewritten; art. 194 abrogated). Workbook estimates the revenue-neutral rate at **22,737 %** before rounding to 23 % (`Synthèse Chiffres`, sheet *Refonte fiscalité*, cell for «Taux unique d'IR brut estimé»). |
| AFU, per adult | «Le montant de l'aide fondamentale est de **6 600 € par an** pour chaque personne majeure composant le foyer fiscal.» (= **550 €/month**) |
| AFU, per child | «**3 300 € par an** pour chaque personne à charge au sens de l'article 196, jusqu'à l'année au cours de laquelle elle atteint l'âge de dix-huit ans.» (= **275 €/month**) |
| Invalidity supplement | «majoré de **6 600 € par an** pour chaque membre du foyer fiscal titulaire de la carte "mobilité inclusion" portant la mention "invalidité"» (art. L. 241-3 CASF) -> **1 100 €/month** for a disabled adult (matches fiche Personne handicapée «1 100 € par mois, versés automatiquement») |
| Pension supplement | «majoré de **3 300 € par an** pour chaque membre du foyer fiscal titulaire d'une pension de retraite liquidée avant le 1er janvier 2028. Cette majoration s'applique jusqu'à l'imposition des revenus de l'année 2051.» |
| Mechanics | The AFU is *subtracted from the tax* (not a credit): «Lorsque le montant de l'aide fondamentale excède celui de l'impôt, l'excédent est restitué.» Paid by monthly instalments by the tax administration from 1 Jan 2028 («par acomptes mensuels»; default: equal twelfths, regularised at tax assessment). «élément du calcul de l'impôt et ne constitue ni une réduction ni un crédit d'impôt.» |
| Quotient familial, décote | Abolished (IR on 2028 incomes): «à taux proportionnel, diviser le revenu en parts ne change plus l'impôt». Also abrogated: art. 157 bis, 81 (2°, 9° ter, 14°, 14° bis), 195 (c, d, d bis, 1; 2; 3-5), 196 A bis CGI. |
| Not cumulable | «L'aide fondamentale ne se cumule pas avec les prestations familiales ni avec l'action sociale des caisses d'allocations familiales.» PLFSS Am. 7 abrogates the 9 prestations familiales (L. 511-1 CSS) and CAF action sociale on 1 Jan 2028 «à la date d'entrée en vigueur de l'aide fondamentale universelle et sous réserve de cette entrée en vigueur»; only «l'allocation de logement» remains in L. 511-1 until 1 Jan 2030. |
| Break-even | «l'impôt devient négatif en deçà de **28 700 €** pour une personne seule» (= 6 600 / 0,23 = 28 695,65 €/yr; workbook cell 28 695,652…). |
| Marginal retention | «**0,77 €** ce qui vous reste par euro gagné, quel que soit votre revenu» (fiche Travailleur) |
| Effective | IR on 2028 incomes; monthly AFU from 1 Jan 2028 |
| Claim of «substitution, non économie» | PLFSS Am. 7: the AFU «ne coûte pas plus que ce qu'elle remplace» |
| Workbook sizing (`Synthèse Chiffres` *Refonte fiscalité*) | Population fiscale 2025: 63,4 M (50,4 M adults + 13,04 M children); recensed 68,6 M (54,5 + 14,1); AAH adults 1,24 M, AEEH children 0,435 M. **AFU gross cost 402,0 Md€/yr**; «Dépenses fusionnées en aide fondamentale» **135,35 Md€/yr** = fiscal (hors quotient) 21,6 [niches fléchées 12,6 + niches sociales supprimées 9,0] + budgétaire 31,8 [RSA, PA, AAH, etc.] + social 81,95 [aides CNAF 40,9 (y c. discrétionnaires) + charges de gestion CNAF 0,846 + ASPA/ASV 4,1 + aides sociales locales 36,1]. Current IR total brut 114,3 Md€, mean rate 7,322 %. |
| Household-computable? | **EXACT for the reform side**, once "revenu net imposable" is defined. The liasses do not say whether the 10 % professional-expense deduction on wages, or other deductions outside the abrogation lists, survive **[gap]**. Workbook charts (GraphIR) apply 23 % straight to "revenu personnel imposable". |

**What the AFU replaces, according to the sources** (not all with legal text): prestations familiales + action sociale CAF (PLFSS Am. 7: legal text), quotient familial/décote (PLF-P1 Am. 28), «toutes les aides» (manifeste), "chèques ciblés dont APL" (workbook), RSA, prime d'activité, AAH, ASPA/ASV, aides sociales locales, bourses (workbook sizing sheets). The liasses only *freeze* RSA/prime d'activité/AAH/ASS indexation in 2027 (PLF-P2 Am. 28) and abolish APL by 2030; **no amendment abrogates RSA, prime d'activité, AAH, ASPA, bourses**. The legal basis for those is missing in the published texts.

### 2.2 CSG/CRDS on earned income and social contributions [PLFSS Am. 1, 2, 3]

| Parameter | Exact value |
|---|---|
| Measure | CSG and CRDS abolished on **revenus d'activité** (salaried and self-employed: «pour les salariés par le bulletin de paie, pour les travailleurs indépendants par l'appel de cotisations»). CSG stays on pensions, unemployment benefits, indemnités journalières «aux taux que rien ne modifie». |
| Current load on pay | «9,7 points» = CSG 9,2 % + CRDS 0,5 % |
| Phase-out 2027 | No rate change Jan–Jun 2027 («mise en place»). CSG rate by month: **Jul 7,6 %; Aug 6,0 %; Sep 4,3 %; Oct 2,7 %; Nov 1,1 %**; CRDS held at 0,5 % through November; **both = 0 from 1 Dec 2027**. Total on pay: 9,7 -> 8,1 -> 6,5 -> 4,8 -> 3,2 -> 1,6 -> 0 (five steps of 1,6 pt and Sept 1,7). Self-employed: 2027 income deemed split 50/50 around 1 July, rate for H2 = mean of the six monthly rates, Dec = 0 (Am. 1 VIII). |
| Amount | «33 milliards d'euros en 2027 et **114 milliards en année pleine dès 2028**» (workbook: CSG+CRDS activité 114,46 Md€ in 2024 data; CSG alone 108,56; 1 point of CSG = 11,8 Md€; source PLACSS 2024 annexe 1). «Au terme de la montée en charge, la rémunération nette augmente de près de 13 %». |
| Financing («gage») | Savings in the PLF + **abrogation of social-contribution exemptions**: all derogatory bases/rates/exemptions on earned income cease 1 Jul 2027 (24 provisions in 3 codes abrogated), except (i) professional-expense reimbursements, (ii) affiliation/redevable rules, (iii) general reductions «applicables à l'ensemble des employeurs sans condition» incl. L. 241-13 (Fillon). This «rend 9 milliards d'euros au salaire net». Exonérations L. 241-10 (emploi à domicile) and L. 741-16 (CSS/rural code) reduced by 1/3 from 1 Jul 2027, 2/3 from 1 Jan 2028, abrogated 1 Jan 2029. |
| Recipient split of the 114 Md€ (Am. 2) | 50 Md€ health insurance, 25 caisse d'autonomie, 17 assurance chômage, 11 allocations familiales, 11 CADES (5 CSG + 6 CRDS) |
| Taxe sur les salaires (Am. 3) | Yield **17,9 Md€**; rates **4,25 % / 8,50 % / 13,60 %** (upper brackets); paid by employers without VAT (hospitals, clinics, banks, insurers, associations, health professionals). **Reduced by 1/3 for pay of 2028, 2/3 for 2029, abrogated 1 Jan 2030**; gap financed by raising CSG on capital income (L. 136-6, 136-7). |
| Household-computable? | **EXACT** for a salaried person: gain = gross × 0,9825 × (9,2 % + 0,5 %) **[inference, verified on workbook: 1 801,8 × 0,9825 × 0,097 = 171,716 €/month]**. Self-employed base not worked out in the sources. Does **not** capture employer-side effects (taxe sur salaires, exonérations) on wages. |

### 2.3 Personal savings account (CEP), restitution of public assets, retirement

| Proposal | Parameters | Source | Computable? |
|---|---|---|---|
| **Compte d'épargne personnel (CEP)**, one per tax resident, effective 1 Jan 2028, first payments due for 2028 | Two annual payments into a «compartiment de restitution» held by the Caisse des dépôts: (1) **versement de restitution** = earned income of the year × **a rate fixed by each finance law** («À défaut de taux fixé, ce taux est nul»); (2) **versement de patrimoine** = **a global amount voted each year ÷ number of holders at 1 Jan**, identical for all («À défaut … nul»). Not taxable income. Locked until legal pension age (L. 161-17-2 CSS) or liquidation of pension, then delivered as **lifetime annuity**; enters estate at death. All existing savings products (PEA, assurance-vie, PER, livrets, PEL, épargne salariale, compte-titres) become compartments (1 Jan 2028), transfers tax-free, freely transferable. Default compartment opened by the bank holding the pay account. | PLF-P1 Am. 27 | **PARTIAL**: structure exact, amounts «aucun montant n'est inscrit ici» |
| Taxation of savings at withdrawal | Taxed only on exit: taxable fraction = withdrawal × (value − base)/value; **30 % flat**; base indexed on CPI hors tabac (coefficient d'érosion monétaire); dividends and interest outside the account taxed on payment; plans/livrets opened or paid into from **1 Jul 2027** lose existing exemptions; deposit/payment ceilings frozen at their 1 Jan 2027 level | PLF-P1 Am. 20, Am. 1 IV.C | EXACT for a given portfolio |
| **«300 euros par mois versés sur un compte épargne retraite personnel d'ici trois ans»** | Site claim only. Workbook sizing: flows to capitalisation = **121,75 Md€/yr** = 103,54 [38,5 State savings + 20,1 local + 30 chômage + 14,94 year-1 leftover after CSG] + 18,21 net yield of assets | manifeste; `Synthèse Chiffres` *Input Capitalisation* | NO (claim); 121,75 Md€ ÷ ~30 M foyers ≈ 338 €/month **[inference]** |
| **«600 milliards d'euros de patrimoine public rendus aux Français, soit 20 000 euros par foyer en trois ans»** | Workbook: assets to return **606,97 Md€** = participations financières 201,9 + patrimoine foncier public 200,2 + logements publics 52,0 + parc social 152,9; assumed 3 % net yield -> **18,21 Md€/yr** ⇒ «**600 €** par an, ce que votre capital rapporte» per foyer (fiche Foyer) and **264 €/yr per person** in the lifecycle chart; retirees: «500 € par an au moins, votre complément viager» (fiche Retraité). Social-housing stock for sale in 3 years («4,5 M logements», net asset «340 Md€» per fiche Locataire; workbook 341,4). Public participations to be valorised; PLF-P2 Am. 30 stops State equity purchases from 1 Jan 2027 | manifeste, fiches Foyer/Retraité/Locataire, workbook | NO (no legal mechanism for the 20 000 € allocation in the liasses) |
| **Régime socle unique** | From 1 Jan 2028 the PAYG basic pension schemes are replaced by one «régime socle unique par répartition»; no new affiliations to old schemes; acquired rights and liquidated pensions «servis jusqu'à leur terme»; a future law sets rules/timetable; if no law before 1 Jan 2028 the old regimes keep running | PLFSS Am. 6 | NO |
| **Indexation of pensions and social benefits** | Automatic revalorisation removed at source (L. 161-25 CSS rewritten); revalorisation only by express finance law, or by decree only if the last closed-year balance of the basic regimes is not in deficit and the cost over 3 years is below that surplus. In force for revaluations from 1 Jan 2027. State-side twin (PLF-P2 Am. 28) lists AAH, prime d'activité, RSA, ASS, aide aux anciens migrants; cumulated non-revalorised sums are to be reported, with the share proposed for the CEP «versement de patrimoine» | PLFSS Am. 5; PLF-P2 Am. 28 | EXACT as a rule (0 % automatic); fiche Retraité: «L'indexation automatique des pensions est suspendue.» |
| Retirees: other losses | «L'abattement de 10 % sur les pensions imposables s'arrête» (cost 4,8 Md€/yr; CGI 158-5-a is item 120° of Am. 1 III). Timing **[inference, verify]**: item 120° is *not* in the list of items that IV.C defers to IR 2028 (the list reads «…114° à 119°, 121°…»), so the default rule IV.A applies, i.e. **IR due for 2026 (tax return filed in 2027)**, which matches the workbook counting the 4,8 Md€ in *year 1* («Détail Niches»: abattement retraites 4,8, «Retraités -4,8»). Retirees with a pension liquidated before 2028 get the +3 300 €/yr AFU supplement until IR 2051. | fiche Retraité; PLF-P1 Am. 1, 28 | EXACT |
| Workers' retirement claims | «Une carrière longue vous paie un départ plus tôt, ou une pension plus élevée.» | fiche Travailleur | NO |

### 2.4 Health

| Proposal | Parameters | Source | Computable? |
|---|---|---|---|
| **Bouclier sanitaire** (annual cap on out-of-pocket) | Cap = **5 %** × foyer resources («revenus d'activité (L. 136-1-1) + revenus de remplacement + prestations en espèces», **minus IR due that year**); **floor = 5 % × annual AFU** (= 330 € with AFU 6 600 €). Covers ticket modérateur (L. 160-13 I-III) + forfait journalier (L. 174-4); above cap insurer pays «pour le reste de l'année civile». Complémentaires may cover at most **half** of what stays with the insured below the cap. Rate (5 %) can be changed by an LFSS; if no vote it self-corrects so health-insurance spending does not rise. Replaces ALD exoneration for affections recognised from 1 Jan 2028 (existing ALD holders keep theirs). Effective 1 Jan 2028, **conditional on the AFU entering into force**. | PLFSS Am. 4; fiche Patient | EXACT for the cap; pre-reform out-of-pocket needs health spending data |
| 10 % co-pay per act, comfort spending out of the shield, competing complémentaires, «300 € par an de frais de gestion en moins» | Fiche only: «Un reste à charge de **10 % par acte** apparaît, plafonné à 5 % de votre revenu» | fiche Patient | NO |
| Health insurance subsidies | Social-security bodies and the FIR (5,9 Md€ in 2027) can no longer subsidise private entities (profit or not), only buy defined services; from 1 Jul 2027, existing agreements run to 1 Jul 2029 at the latest | PLFSS Am. 8 | NO (organisation-level) |
| Disabled | AFU supplement 6 600 € = 1 100 €/month incl. base; bouclier sanitaire | fiche Personne handicapée; Am. 28 | EXACT |

### 2.5 Unemployment and work

| Proposal | Parameters | Source | Computable? |
|---|---|---|---|
| Unemployment compensation | «L'indemnisation passe de **treize à six mois**.» After six months a personal account fed monthly by the unemployment contributions; «ce que vous n'avez pas consommé de votre compte vous reste». «Assurance-chômage transformée en épargne»: **30 Md€/yr** (base of spending 37,1 Md€ in the workbook). Hiring aids and State insertion schemes stop. «+220 €» and «550 €» are shown in the reminder strip of the fiche (see 3.) | fiche Personne sans emploi; workbook | **NO**: no replacement rate, ceilings, or legal text (the only text: PLF-P2 Am. 23 removes the unemployment insurance's ≥10 % contribution to France Travail, saving 1,5 Md€ in 2027 / 5,3 Md€ in régime) |
| Business aid | Aids to firms for employment, apprenticeship, insertion (incl. France Compétences) **22,5 Md€**; for investment (incl. France 2030) **6,6 Md€**; local business aids **12,3 Md€** (`Annexe Manuscrit`); 57 taxes affectées abrogated incl. apprenticeship/training contributions, versement mobilité, effort construction (PLF-P1 Am. 25) | workbook; PLF-P1 | n/a (firm level) |
| Entrepreneurs | «Votre revenu d'indépendant est imposé au même taux que celui d'un salarié» (23 %); IS single rate 27 % (below) | fiche Entreprise | PARTIAL |

### 2.6 Public employees

| Proposal | Parameters | Source |
|---|---|---|
| Jobs closed | **580 000** public jobs (manifeste); State 61 400 full-year (30 698 ETPT removed from the 2027 ceiling: 2 032 750 -> 2 002 052), local ≈ 428 500, France Travail 47 880 (workbook *Détail Economies* col. J). 5,22 M agents remain «indispensables». | manifeste; PLF-P2 Am. 24; workbook |
| Exit indemnity (**fully specified**) | Indemnity = **70 %** of base = gross indiciary pay of last step held in grade + a *decree-set* share of recurring primes (≤ 1/4 of pay, decreasing from cat. C to A; **zero if no decree**), capped at the base. **Duration by seniority**: <2 y -> 1 yr; 2–<5 -> 2; 5–<10 -> 3; 10–<15 -> 4; 15–<20 -> 5; 20–<25 -> 6; ≥25 -> **7 years**. Fully cumulable with private-sector income, no cap; suspended while holding a public job; stops at retirement age / full-rate pension / death. CDI offer first; 1st refusal keeps full indemnity, 2nd halves the rate, 3rd forfeits. 6-month notice before dismissal. Starts 1 Jul 2027. Local authorities may opt in. | PLF-P2 Am. 26 |
| Status | «Le statut de la fonction publique prend fin» (fiche Agent public indispensable); «+13 %» net pay; teachers lose the grille, pay negotiated | fiches (no legal text in liasses) |
| Household-computable? | **EXACT** for the indemnity given grade/step/seniority | |

### 2.7 Housing, property, local taxes

| Proposal | Parameters | Source |
|---|---|---|
| **APL / aides personnelles au logement** | No right opened by a request filed **from 1 Jun 2027**; a right opened by a request filed from 1 Jan 2027 runs ≤ 12 months at the amount fixed at opening. Conventioned housing, existing rights: capped at Dec 2026 amount (never rises), **-1/3 from 1 Jul 2027, -2/3 from 1 Jul 2028, zero from 1 Jul 2029** or on moving. Other housing: ends at lease/loan term, at the latest 1 Jan 2030. **All aides personnelles abolished 1 Jan 2030.** 2027 first-year saving 5,4 Md€ (programme 16,52 Md€). Fiche: «L'APL s'arrête pour les nouveaux contrats et se maintient jusqu'au terme des baux en cours.» | PLF-P2 Am. 32 |
| Social housing | No new State aid for social-housing construction/acquisition from 1 Jan 2027 (PLF-P2 Am. 29); stock to be sold «en trois ans» (site only); site claims +25 % private rental supply and falling rents, notary fees «s'effondrent» | fiche Locataire |
| Other housing-related | Chèque énergie abrogated 1 Jan 2027 (campaign cost 600 M€; PLF-P2 Am. 34); the fiche Bénéficiaire d'un chèque ciblé only names pass culture and chèque restaurant; PTZ tax credit abrogated for offers from 1 Jan 2027; emergency accommodation limited to temporary offers for pregnancy/disability/infant care/danger, regular residence required (PLF-P2 Am. 33); «Plus un logement social neuf financé par l'État» | PLF-P2 Am. 29-34; PLF-P1 Am. 4 |
| **Droits de mutation (DMTO + succession + donation)** | Single scale, effective **1 Jan 2027**: nothing if base < 10 000 €; **1 %** on 10 000–100 000 €; **3 %** above 100 000 €; per act and per taxpayer; base increased by transfers from the same person in the previous **15 years**; borne by whoever realises the capital gain (seller/heir), parties may agree otherwise; credited as an **acompte** against the capital-gains tax. Replaces buyer duties 3,80 % (up to 4,50 %) + 1,20 % communal, and succession rates 5 %–60 % + allowances. Example: 200 000 € flat: **10 000 € paid by the buyer today -> 3 900 € by the seller** (1 % × 90 000 + 3 % × 100 000). | PLF-P1 Am. 19 |
| **Capital gains** | **30 %** flat (replacing 12,8 % or 19 % IR + 17,2 % social = «30 % sur les titres et 36,2 % sur l'immobilier»), computed on **real gain**: acquisition price × CPI(hors tabac) ratio; holding-period abatements, exemptions, expense lump sums and >50 000 € surtax abolished; real estate and movables from 1 Jan 2027, securities/CEP from 1 Jan 2028. Example: 200 000 -> 260 000 with prices +10 % => real gain 40 000 => tax 12 000 => **8 100** after crediting 3 900. **High-impact point to verify:** Am. 20 I.3° abrogates «les 1°, 3°, 4°, 5° et 6° du II de l'article 150 U»; Am. 1 III (91°–96°) abrogates 1° bis, 1° ter, 2°, 7°, 8°, 9°. Together that is **every exemption of art. 150 U II, including 1° = exemption of the sale of the principal residence** (the workbook labels niche 150113 «Exonération des plus-values de cession des résidences principales», 955 M€ in 2024, legal ref «150 U-II-1°»). The exposés never mention the main home explicitly (only «les abattements, les exonérations … disparaissent»). So, as written, selling a main residence would be taxed at 30 % of the CPI-indexed gain (with the 1 %/3 % duty credited). Confirm against Légifrance before using it in a simulator. | PLF-P1 Am. 20, Am. 1; workbook *Modalités de calcul de l'impôt* |
| **Taxe foncière unique** (communal), effective tax year **2028** | Base = **market rental value** (INSEE publishes tariff per m² by category and sector from rents of the last 3 years; value = tariff × surface); municipal rate voted **between 10 % and 30 %** («à 10 %, un logement acquitte à peu près la taxe foncière d'aujourd'hui, ordures ménagères comprises»); default 2028 rate = local 2027 product (+ 2026 additional DMTO tax) ÷ total market rental value, clipped to [10 %, 30 %]. Equalisation fund: each metropolitan commune pays **2 %** of its total rental values **+ 2 %** of its product; communes ranked in 3 equal-population terciles by revenue per head; lowest tercile gets **2/3**, middle **1/3**. Abolished: IFI, taxe d'habitation on secondary homes, TEOM, taxe d'aménagement, and other local land levies; mutation duties and the annual tax on the market value of properties (art. 990 D CGI) paid in the 5 years before 1 Jan 2028 are deductible from the new tax for 2028–2032 (only the part above what the new 1 %/3 % scale would have charged; excess not refunded). | PLF-P1 Am. 29 |
| Local-authority finance | End of State compensation for vanished local taxes from 2027 (Am. 30); State grants drop by what a withdrawn competence cost (3-year average) (Am. 31); départements/régions lose culture, sport, tourism, languages, equality, popular education and their business-aid powers (agriculture/forest/fishing aid capped at 2/3 in 2028, 1/3 in 2029, abolished 1 Jan 2030) (Am. 32); communal dotation forfaitaire -1/3 2027, -2/3 2028, zero 2029, with municipalities allowed to raise taxe foncière to compensate (Am. 33); TVA shares capped at costs of mandatory competences from 2028 (Am. 34); PLF-P2 Am. 35 abolishes DETR/DSIL/etc. discretionary grants from 1 Jan 2027 | PLF-P1 Am. 30-34; PLF-P2 Am. 35-38 |
| Intermediate tiers | «Fin du mille-feuille territorial. La commune et l'État, rien entre. Communautés de communes, régions et départements disparaissent, la préfecture reste le relais unique» (manifeste). Letters: «2 échelons au lieu de 5». Legal text only withdraws competences/funding. | manifeste; PLF-P1 Am. 31-32 |
| Household-computable? | Mutation, gains: **EXACT** per transaction. Taxe foncière: **NO** until INSEE tariffs and communal rates exist; only the formula and the 10 %–30 % range are known |

### 2.8 Consumption taxes (TVA and others)

| Proposal | Parameters | Source |
|---|---|---|
| **TVA** | Normal rate stays **20 %**. All reduced rates move to 20 % on **1 Jul 2028** (intermediate 10 %, reduced 5,5 %, super-reduced 2,1 %), mainland incl. Corsica; overseas unchanged. **Food** (goods of L. 213-159 and L. 213-166 CIBS and the services leading to them, per the exposé «l'alimentation») follows a slower path: **10 % from 1 Jul 2028, 15 % from 1 Jul 2029, 20 % from 1 Jul 2030**. TVA provisions that the PLF annex counts as tax expenditures (46 of the 465 niches) are abrogated on **1 Jul 2027** via Am. 1 (III + IV.D); the 21 reduced rates *not* counted as niches (33,4 Md€ per workbook) are handled by Am. 21 on 1 Jul 2028. Sector taxes vanish the same dates (spectacles, bois, matériaux de construction, immatriculation, déchets on 1 Jul 2027; TV, publicité, activités polluantes due last for 2027). «à rendement constant». CPO estimate cited: reduced rates ≈ **30 Md€ (2021), of which 20 Md€ water and food**. | PLF-P1 Am. 21, 1, 25 |
| Fiche Consommateur | «Les taux réduits de TVA disparaissent : tout passe à 20 %.» fiche tile «81 %» with «Les produits faits en France que vous consommez deviennent plus abordables» (unsourced claim); price effect: «inflation faciale inférieure à 2 %» (fiche Citoyen) | fiches |
| 21 State taxes abolished | Contribution sociale sur l'IS, taxe sur les transactions financières, taxe sur rachats d'actions, TGAP, taxe sur certains services numériques, contribution de sécurité immobilière, droits de timbre (passeport, naturalisation, attestation d'accueil)… 1 Jul 2027 / 1 Jan 2028; offset by IS | PLF-P1 Am. 22 |
| 57 taxes affectées abolished; 82 ceilings set to 0 | 82 affected-resource lines (rendement 2027 **29 980,5 M€**) routed to the general budget; 57 abolished (culture, CTI, transport, autoroutes, vehicle registration, waste, apprenticeship, training, effort de construction, versement mobilité, etc.); compensated by IS (State) and DGF (communes) | PLF-P1 Am. 24, 25 |
| Energy | Reduced accise tariffs that are national choices abrogated 1 Jul 2027 (EU-mandated exemptions kept); agricultural tariffs phased out in thirds to 2029; **certificats d'économies d'énergie abrogated 1 Jul 2027** (cost 6 Md€/yr per Cour des comptes, passed through energy bills; penalty 0,02 €/kWh) | PLF-P1 Am. 14, 15, 16 |
| Household-computable? | **PARTIAL**: rates and dates exact; needs a consumption basket and a price pass-through assumption |

### 2.9 Corporate and business taxation

| Proposal | Parameters | Source |
|---|---|---|
| **Corporate tax (IS)** | Single rate **27 %** for all firms and all profit types (no reduced/zero rates), financial years opened from **1 Jul 2027**. Cited headline today: 25 %; implicit rates 21,4 % (SME) vs 14,3 % (large), 2022. A decree may raise/lower the rate by **≤ 2 points** to keep PO/GDP at the 2026 level («la majoration ne peut porter le même rapport au-delà de son niveau de l'année 2026»). Plays the role of balancing item of the whole tax overhaul (together with taxe foncière unique). | PLF-P1 Am. 23 |
| **Tax expenditures (niches), general abolition** | All "avantages fiscaux" (7 forms: exemption, abatement/deduction/exclusion, reduction or credit, reduced/zero rate, deferral, dégrèvement) cease on IR, IS, IFI, enregistrement/timbre, TVA, accises, direct local taxes, with 6 exceptions (common-law definition of income/expenses, double-taxation relief, EU/treaty obligations, TVA reduced rates other than those abrogated, rules open to everybody regardless of nature of income [modulation by age/disability allowed], CEP and mutation-tariff rules). Calendar (A–F in Am. 1 IV): non-incentive provisions fall on **2026 incomes / 1 Jan 2027**; commitment-based ones for engagements from 1 Jan 2027; mutation gratuite 1 Jan 2027; TVA/accises 1 Jul 2027; barème/épargne/décote/quotient 2028; agriculture, services à la personne, garde d'enfants reduced **by 1/3 for 2027, 2/3 for 2028, total 2029**; dons halved from 1 Jul 2027, abolished 1 Jan 2028. Pre-existing credits stay usable. Cited stock: «plus de quatre cent soixante» niches costing **79,5 Md€ (2026 forecast)**; workbook: **465 niches / 89,406 Md€ realised 2024** (101,3 incl. TVA all APU), +21 reduced TVA rates 33,4 Md€ = 486 / 134,7 Md€. | PLF-P1 Am. 1 |
| Specific niche amendments | Titres-restaurant périmés paid to employee as salary (Am. 2); dons: IR/IS/IFI reduction rates halved from 1 Jul 2027, abolished 1 Jan 2028 (Am. 3); PTZ credit (Am. 4); industrial suramortissement/credit "industrie verte" (Am. 5); cessions d'entreprise advantages (Am. 6); 7 culture advantages (Am. 7); agricultural regimes (Am. 8, 15); **CIR/CII/CIC abrogated for expenses from 1 Jan 2027** (Am. 9, ≈ 7,8 Md€ in 2024); 10 zone-franche exonerations (Am. 10); tonnage tax (Am. 11); **crédit d'impôt famille** abrogated from 1 Jul 2027 (Am. 12); 8 exceptional deductions (Am. 13); aides à l'investissement/outre-mer (Am. 18) | PLF-P1 Am. 2–18 |
| Entreprise fiche claims | «0 € avant profit»: production taxes disappear; «Un impôt unique sur les bénéfices»; «Le gain net: la suppression des taxes sur les salaires va au salarié, non à l'entreprise»; «L'impôt sur les sociétés augmente, en échange des impôts de production supprimés» | fiche Entreprise |
| Household-computable? | n/a for firms; **EXACT** for individual niches (e.g., emploi à domicile credit, garde d'enfants, dons) if the user supplies the baseline amount |

**Household niches that disappear.** Default date rule (Am. 1 IV.A): **IR due for 2026**, i.e., tax return filed in 2027, for provisions with no special rule (this appears to include the 10 % pension abattement and salary-side exemptions such as heures supplémentaires, intéressement/participation, employer share of titres-restaurant, apprentis; **verify item by item**: the full list is the 350+ items of Am. 1 III and the date split is in IV.A–F). Special dates: **IR 2028 / operations from 1 Jan 2028** for décote, quotient familial/demi-parts (all supplementary half-parts), benefits replaced by the AFU, capital-gain abatements and savings plans/livrets/contracts (IV.C; plans opened or paid into from **1 Jul 2027** already lose the benefit; ceilings frozen at their 1 Jan 2027 level); commitment-based niches (PTZ, réparation/amélioration, investissement locatif…) for engagements from **1 Jan 2027** (IV.B); crédit emploi à domicile and garde d'enfants (and agriculture) reduced **by 1/3 for 2027, 2/3 for 2028, abolished 2029** (IV.E; fiche Foyer «L'exonération sur l'emploi à domicile s'arrête»); réduction dons **halved for gifts from 1 Jul 2027, abolished from 1 Jan 2028** (IV.F); TVA/accises **1 Jul 2027** (IV.D); gratuit-transfer allowances **1 Jan 2027** (IV.C bis). Savings exemptions (Livret A, LDDS, PEL, assurance-vie, PEA, épargne salariale) end with the move to the CEP regime: taxed at 30 % of the CPI-indexed gain on exit, from 2028. Workbook sizes (2024): crédit emploi à domicile 6 420 M€; abattement 10 % pensions 4 803 M€; dons 1 990 M€; garde d'enfants <6 ans 1 737 M€; demi-parts 849 / 674 / 523 / 493 M€; décote 7 652 M€ (PLF 2026 prévision 7 618); Livret A 950 M€.

### 2.10 State, agencies, spending (PLF-P2)

| Proposal | Parameters | Source |
|---|---|---|
| Ministries | 35 -> 7 («28 supprimés»); no secrétariat d'État. Seven missions kept: Défense, Sécurités, Justice, Action extérieure, Gestion des finances publiques, Solidarité-insertion-égalité des chances, Enseignement scolaire. | `GraphAgences`; PLF-P2 Am. 27 |
| Agencies | 1 104 -> **303** national agencies: 746 closures/sales (78 cession d'actif + 668 suppression), 55 internalised, 303 autonomous (5 independent authorities, 40 EPIC musées/patrimoine, 258 EPIC universités/recherche). With local agencies (23 264): total 24 368, of which 425 cession, 14 149 suppression, 351 internalisation, 9 398 autonomy. PLF-P2 Am. 25 dissolves **337 named legal entities on 1 Jul 2027** (e.g., ADEME, ANAH, ANCT, AFPA, France Compétences, France Travail, Business France, CNC, CNL, Pass Culture, Campus France, FranceAgriMer, Voies navigables de France, Bpifrance Participations, 100+ CDAD…); puissance-publique tasks go back to ministries; asset-rich EPs and independent authorities spared. 431 operators/318 commissions/73 Md€/401 310 ETPT are the cited baseline. | `Synthèse ETP et agences`; PLF-P2 Am. 25 |
| Credits removed (état B) | **22 amendments, 39,905 Md€ CP and 43,855 Md€ AE removed** from 22 missions (table in Appendix A). Largest: Cohésion des territoires 13,13 Md€ CP (APL 8,07), Travail-emploi 10,70, Écologie 3,27, Relations avec les collectivités 2,81, APD 2,19, Culture 1,74. Effective 1 Jan 2027 for legal persons, 1 Jul 2027 for natural persons. | PLF-P2 Am. 1–22; `data/derived/etat_b_credits_retires_plf2027.csv` |
| Spending rules | Freeze of new commitments on the 7 retained missions during 2027 (Am. 27); no State financing of private legal persons or selection-by-call-for-projects from 1 Jan 2027, old commitments end by 1 Jan 2029 at the latest (Am. 31); end of State equity purchases (Am. 30); annual report on the balance of the tax overhaul (Am. 39) | PLF-P2 |
| Targets | PO/GDP **42,87 % (2024) -> 36,33 %** target; fiche Contribuable «36 % de la richesse produite, contre 43 % aujourd'hui» | `Refonte fiscalité`; fiche |
| Aggregate savings | **236 Md€/yr** (≈ **8 000 €/foyer/yr**): structures facultatives 67; subventions 69; niches fiscales & sociales 52; assurance-chômage -> épargne 30; assets yield 18 (table in section 5, workbook `Annexe Manuscrit`). Year-1 gain **127,35 Md€** + **108,91 Md€** more at full year. | `donnees.html`; workbook |

### 2.11 Education, youth, family, other

| Proposal | Parameters | Source | Computable? |
|---|---|---|---|
| **Compte éducation** | «**6 600 euros par an** sur un compte éducation au nom de l'enfant, jusqu'à 18 ans. Chaque famille choisit son école, publique, privée ou associative, évaluée sur ses résultats.» Lifecycle chart: 6 600 €/yr for ages 0 to 18 inclusive (19 values). Fiche Famille: «où que vous viviez», «Agrément simple, sanction réelle». Jeune adulte: «Vos études se paient sur votre compte éducation»; reduced tuition tariffs; «Chaque année travaillée compte pour vous». | manifeste; fiches; `GraphAFU` | **NO legal text**; amounts clear, rules absent |
| Family benefits | «**275 €** par mois et par enfant, versés à votre foyer sans dossier» = AFU child part; «La part de chacun des deux parents est versée, quelle que soit leur situation»; quotient familial and child surcharges stop | fiche Famille; Am. 28 | EXACT for AFU; shared custody split not specified |
| Teachers | Statut/grille end; pay negotiated; first-year teachers revalorised | fiche Enseignant | NO |
| Law simplification | «Diviser au moins par 10 les 49 millions de mots du droit applicable» | manifeste | n/a |

---

## 3. Per-household examples ("cas types") and validation targets

**There are only a handful, and none comes from a narrated full-household case study in the book (the book text is not available).** Capture of everything found:

### 3.1 Earned-income gain from CSG/CRDS abolition (workbook `Synthèse Chiffres`, sheet *CSG-CRDS*; "Données 2024, SMIC 2025")

| Case | Gross €/month | Net €/month | 1 pt CSG €/month | CSG alone €/month | **Gain CSG+CRDS €/month** | **Gain % of net** | Annual gain € |
|---|---:|---:|---:|---:|---:|---:|---:|
| SMIC | 1 801,80 | 1 426,30 | 17,70 | 162,86 | **171,72** | 12,04 % | 2 060,59 |
| SMIC 01/2026 | 1 823 | 1 443 | 17,91 | 164,78 | **173,74** | 12,04 % | 2 084,84 |
| SMIC 06/2026 (+2,4 %) | 1 867 | 1 478 | 18,34 | 168,76 | **177,93** | 12,04 % | 2 135,16 |
| Net médian | (≈ 2 886 implied) | 2 190 | 28,36 | 260,90 | **275,08** | 12,56 % | 3 300,91 |
| Brut moyen / net moyen | 3 602 | 2 733 | 35,39 | 325,58 | **343,28** | 12,56 % (9,53 % of gross) | 4 119,36 |

Formula consistent with these numbers **[inference]**: gain = gross × 0,9825 × 9,7 %.

**Site statements to reconcile** (see section 7): «300 euros par mois restitués dès la première année, soit 13 % de salaire net en plus pour tous» (manifeste); «+13 % votre salaire net en un an, au salaire médian. 180 euros de plus par mois au SMIC» (fiche Travailleur); «600 euros par mois rendus aux travailleurs, pour un salaire net médian de 2 190 euros» (300 net + 300 CEP).

### 3.2 Flat tax + AFU, single adult (workbook GraphIR, formulas `=-D28*0.23`)

| Taxable income €/yr | Tax (negative = refund) | AFU | Disposable after tax | Net transfer from/to administration |
|---:|---:|---:|---:|---:|
| 0 | 0 | 6 600 | 6 600 | **+6 600** |
| 8 000 | -1 840 | 6 600 | 12 760 | **+4 760** |
| 21 000 | -4 830 | 6 600 | 22 770 | **+1 770** |
| 34 000 | -7 820 | 6 600 | 32 780 | **-1 220** |
| 48 000 | -11 040 | 6 600 | 43 560 | **-4 440** |

Full series 0 to 72 000 € in 1 000 € steps in sheet `GraphIR` (rows 32–37), e.g., 72 000 € -> -16 560 tax, disposable 62 040, net -9 960. Break-even 28 695,65 €.

### 3.3 Other quantified single cases in the texts

- **Salarié au SMIC** (PLF-P1 Am. 28): «à partir de janvier 2028, le salarié au SMIC reçoit **550 € par mois** de l'administration fiscale au lieu d'attendre qu'une caisse lui reconnaisse un droit.» (gross AFU before offsetting his 23 % tax; **[conflict]** with GraphIR net-transfer logic).
- **"+220 €" per month «au salaire type»** (fiche Bénéficiaire d'un chèque ciblé; also in the reminder strips of Personne sans emploi and others) with «550 € par mois en argent libre». **[inference]** 220 €/month = 2 640 €/yr = 6 600 - 0,23 × 17 217, i.e., the net AFU effect for someone earning ≈ 1 435 €/month, consistent with SMIC-level income; the sources do not define "salaire type".
- **Disabled adult**: 1 100 €/month (550 + 550).
- **Family**: 275 €/child/month; 6 600 €/child/yr education account.
- **Retiree**: «500 € par an au moins»; +3 300 €/yr AFU supplement until IR 2051 (derived from Am. 28).
- **Public servant exit**: 70 % of base up to 7 years (see 2.6).
- **Apartment 200 000 €**: acquisition duties 10 000 € today (3,80 % + 1,20 % = 5 %) -> 3 900 € paid by seller under the new scale; resale 260 000 € after +10 % prices -> real gain 40 000 € -> 12 000 € tax -> 8 100 € after credit.
- **Worker, all-in**: 600 €/month = 300 € net + 300 € into the account (manifeste); 0,77 € kept per euro earned.
- **Household assets**: 20 000 €/foyer in 3 years -> 600 €/yr yield; 6 600 € × 3 = 19 800 + 264 = 20 064 appears as "épargne retraite personnelle" at age 64 in GraphAFU **[meaning not documented]**.
- **Value-added per hour of work** (GraphVA): 63 € = 29 State + 11 capital + 23 net wage.

### 3.4 Lifecycle table (workbook `GraphAFU`, "Solidarité nationale au cours de la vie")

Age 0–17: AFU 3 300 €/yr; 18+: 6 600 €. Compte éducation 6 600 €/yr age 0–18. Disability supplement 6 600 €/yr age 0–63. «Part contributive de retraite» 6 600 €/yr from age 64 (→ the model assumes retirement at **64**). Restored-asset yield 264 €/yr at every age. «Épargne retraite personnelle» 20 064 and 6 600 from age 64.

---

## 4. Headline figures used by the book/site (verbatim values)

**Diagnosis (manifeste + workbook sources)**
- Median income: «2 100 euros par mois en France, contre 4 300 en Suisse» (Eurostat ilc_di03 2024 in `GraphRDB`: France 25 557 €/yr, Suisse 51 926 €/yr; PPS: France 23 222, Suisse 29 828, Luxembourg 37 781).
- «438 impôts, 486 niches fiscales, 2 000 CERFA, 1,7 milliard de combinaisons pour calculer un taux de charges sociales».
- «L'État dépense **54 000 euros par foyer et par an, record mondial**. … il prend plus de la moitié de ce que nous gagnons.» Eurostat `GraphGov` (general government expenditure, % GDP): France **57,0 % (2024), 57,2 % (2025)**; Finland 57,7 / 57,5; Austria 55,3 / 55,2; Belgium 54,1 / 54,2; euro area 49,4 / 49,8; Allemagne 49,4 / 50,5; Suisse 33,6; Irlande 22,3 / 21. **[conflict: Finland is higher]**.
- Public deficit, % GDP (`GraphGov`): France **-5,8 % (2024), -5,1 % (2025)**.
- Public spending 2024 (INSEE table 3.301, COFOG, `Graph1672Md`): **1 671,794 Md€**: sécurité 106 (Défense 54,2 + Intérieur 38,7 + Justice 13,4 = 6,4 % ≈ «6 % des dépenses publiques»); dépenses collectives 181 (administrations 117,5; infrastructures 33,7; environnement 30,3); enseignement-recherche 149 (éducation 128,6; recherche 19,9); sécurité sociale et solidarité 933 (aides sociales 231,4; santé 261,2; retraites 392,0; chômage 48,5); soutiens sectoriels 244 (subventions économiques 171,0; aides au logement 29,6; loisirs-culture 43,1); charge de la dette 58,9.
- PO/GDP: **42,87 %** (1 251,8 Md€ / 2 919,9 Md€ GDP, 2024) -> target **36,33 %** (1 060,75 Md€).
- Law volume (`GraphCodes`, Légifrance, 2026): législatif 15 318 365 words + réglementaire 33 516 078 = **48,8 M ≈ «49 millions de mots»**; growth from 26,0 M (2005); target ÷ 10.
- Democratic representation (`Graph51pc`): 100 citizens -> 51 elect directly -> 26,01 assemblée -> 13,27 commission -> 6,77 conseil -> 3,45 comité.
- Value added: 63 €/h = 29 State + 11 capital + 23 net wage (`GraphVA`).
- «Nos enfants sont derniers d'Europe en mathématiques» (no figure/source given).

**Plan outputs**
- «**600 €** par mois» to each worker: 300 € net pay + 300 € savings; «**13 %**» net pay; «**25 %**» in the letters («augmenter tous les travailleurs de 25 % d'ici trois ans»).
- «**236 milliards d'euros**» savings/yr = **8 000 €/foyer/yr**; «**600 milliards**» assets = «**20 000 €** par foyer en trois ans».
- «7 ministères au lieu de 35; 303 agences d'État au lieu de 1 104; 2 échelons territoriaux au lieu de 5; **5 impôts** au lieu de 438; 0 niche au lieu de 486; 1 aide fondamentale unique au lieu de 2 000 CERFA» (letters) vs «**Quatre impôts** … TVA, revenu, sociétés, foncier. Ils portent déjà 75 % des recettes» (manifeste). **[conflict 4 vs 5]**
- «550 euros par mois d'aide fondamentale universelle, plus 275 euros par enfant, à la place de toutes les aides».
- «580 000 postes publics fermés, 70 % du traitement conservé jusqu'à sept ans».
- Population anchors in fiches: 68 M citizens, 30 M foyers, 29 M workers, 17 M retirees, 5,7 M unemployed, 4 M young adults, 5,22 M agents kept, 580 000 closed. In the amendments: «40,2 millions de foyers fiscaux, 18,5 millions seulement ont acquitté l'impôt sur le revenu au titre de 2023» (CPO, Oct 2024) **[so "foyer" ≈ ménage 30 M in fiches vs foyer fiscal 40,2 M in the law]**.
- Public workforce 2023 (`Synthèse ETP`): 5 803,9 k (fonctionnaires 3 753,1; contractuels 1 358,5; militaires 313,4; autres 378,9); FPE 2 570,2; FPT 1 994,2; FPH 1 239,4.
- Tax expenditures: 465 niches (89,4 Md€ 2024) + 21 reduced TVA rates (33,4 Md€) = 486 (134,7 Md€).
- Taxes affectées: 22,78 Md€ allocated to "non-indispensable" operators of which Fr Compétences 11,25, AFITF 3,04, agences de l'eau 2,32, Action Logement 1,91, CNC etc. 0,89, CCI 0,85, EPF 0,31, Anah 0,70; saving 17,92 Md€ (8,12 in 1 year + 9,80 after). 82 lines to ceiling zero = 29 980,5 M€; 57 taxes abolished; 21 State taxes abolished.

**The 236 Md€ table (donnees.html vs workbook `Annexe Manuscrit`, Md€/yr, € per foyer/yr, Gain year 1, Extra gain at full year)**

| Item | Web (rounded) | Workbook exact | €/foyer | Year 1 | Extra full-year |
|---|---:|---:|---:|---:|---:|
| **Total** | 236 | 236,055 | 8 000 | 127,35 | 108,91 |
| Structures facultatives | 67 | 67,007 | 2 280 | 39,10 | 27,90 |
| – Fonctionnement des administrations | 39 | 37,432 | 1 280 | 30,23 | 7,20 |
| – – Administrations de l'État non indispensables | 4 | 3,8 | 130 | 3,8 | – |
| – – Échelons locaux non indispensables | 10 | 9,6 | 330 | 6,1 | 3,5 |
| – – Agences non indispensables (logement, culture, écologie…) | 9 | 8,632 | 300 | 4,93 | 3,70 |
| – – Dépenses locales culture et loisirs | 12 | 11,6 | 390 | 11,6 | – |
| – – Privatisation audiovisuel public | 4 | 3,8 | 130 | 3,8 | – |
| – Masse salariale des administrations | 30 | 29,575 | 1 000 | 8,87 | 20,70 |
| – – Plan de départ agents État + agences | 10 | 9,575 | 330 | 2,87 | 6,70 |
| – – Plan de départ agents locaux | 20 | 20,0 | 670 | 6,0 | 14,0 |
| Subventions | 69 | 68,948 | 2 330 | 36,15 | 32,8 |
| – Aux entreprises | 42 | 41,448 | 1 400 | 21,45 | 20,0 |
| – – emploi/apprentissage/insertion (dont France Compétences) | 23 | 22,548 | 770 | 8,45 | 14,1 |
| – – investissement (dont France 2030) | 7 | 6,6 | 230 | 3,3 | 3,3 |
| – – aides locales aux entreprises | 12 | 12,3 | 400 | 9,7 | 2,6 |
| – Aux particuliers et associations | 28 | 27,5 | 930 | 14,7 | 12,8 |
| – – Chèques ciblés (dont APL) | 18 | 17,7 | 600 | 6,9 | 10,8 |
| – – Hébergement/soins inconditionnels (HU + AME) | 4 | 3,6 | 130 | 3,6 | – |
| – – Autres associations | 3 | 3,2 | 100 | 3,2 | – |
| – – Aide publique au développement | 3 | 3,0 | 100 | 1,0 | 2,0 |
| Niches fiscales et sociales | 52 | 52,1 | 1 750 | 52,1 | – |
| – Niches sur les revenus | 29 | 28,8 | 970 | 28,8 | – |
| – Niches TVA et sociétés | 23 | 23,3 | 780 | 23,3 | – |
| Assurance-chômage transformée en épargne | 30 | 30 | 1 000 | – | 30 |
| Patrimoine public valorisé (rendement net/an) | 18 | 18,0 (18,21 in Input) | 600 | – | 18,21 |

(Web rounded sub-items do not sum to the web subtotal, e.g., 4+10+9+12+4 = 39 vs workbook 37,4; use the workbook.) Reconciliation **[inference]**: 236,05 ≈ 114,46 (CSG+CRDS activité) + 121,75 (flows to capitalisation).

---

## 5. Dataset catalogue

All files are from `https://france-resolution.fr/donnees/…` and `…/amendements/…`. **No licence is stated anywhere on the site** (mentions légales only cover publisher/host). Underlying public sources (Insee, DGFiP/budget.gouv.fr PLF documents, Eurostat, Légifrance, fonction-publique.gouv.fr) are normally reusable (Etalab Licence Ouverte / CC BY 4.0 for Eurostat) **[to verify before republishing]**; the Résolution columns/calculations are "Calculs de Résolution". Workbook sheets are dumped to `data/derived/csv/<workbook-slug>/<sheet>.csv`. File names end in `_0910` (9 October 2026 build). Granularity is **national** everywhere (no régional/département/commune data, no household micro-data), except the "elus" directory (see 5.8).

### 5.1 `Synthèse Chiffres Résolution_0910.xlsx` (343 Ko, 7 sheets) - the plan's costing

| Sheet | Dims | Content / columns | Notes |
|---|---|---|---|
| Annexe Manuscrit | 28×10 | The 236 Md€ table: code, item, *En Md€ par an*, *En € par an par foyer*, *Gain en année 1*, *Gain supp. en année pleine* (Md€). Codes O, AVP, AE, E, M, HU+AME, A, APD tie to *Détail Economies*. | Basis of donnees.html table. Year 1 127,35 + 108,91 |
| CSG-CRDS | 16×10 | CSG cost 2024: 108,56; CSG+CRDS activité 114,46; 1 pt CSG 11,8 Md€. Cases SMIC/net médian/brut moyen (€/month and /yr) | PLACSS 2024 annexe 1; service-public.gouv.fr; Insee |
| Flux | 28×10 | Measures × (gain year 1, effect, extra gain at term, total removed at term, other gisement), Md€: niches fiscales 43,1+29,1=72,3 (+53 gisement), TVA 19,9 (+33,4), IR 27 (+12,6), IS 16, autres 9,4; niches sociales 18; Économies État 44 + 38,5 = 82,5; Opérateurs 14,5/28; Chèques ménages 8,4/19,9; Aides entreprises 8,4/15,2; Associations 8/12,6; Collectivités 33,3+20,1 = 53,4 | |
| Détail Niches | 24×16 | 465 niches 89,406 Md€; restitué en CSG 43,1 / en taxes 29,1 / total 72,3 by tax (TVA, IR, IS, énergie, locales, mutation, sociales) and by payer (ménages, actifs, retraités, entreprises) | hypotheses: recycled at 50 %/100 % |
| Détail Economies | 43×22 | Line-by-line savings by category with horizon & hypothesis text, ETP cut (580 000 APU = 151 000 APUC + 428 500 APUL; State 61 400; France Travail 47 880) | |
| Refonte fiscalité | 76×13 | PO/GDP 2024 vs target; tax-by-tax table (TVA 206,3; taxes conso 105,1; main-d'œuvre 58; IR net 87,3; IS net 57,4; taxe foncière 42,9; mutations 37,9…, with niches restituées, solde brut, gisement, taxes à supprimer 137,05, hausses d'équilibre 67,75 = **27 pt IS** / taxe foncière 42,06); AFU schema (population, 550 €/month, 23 % estimated 22,74 %, entry threshold 28 695,65 €/yr), IR deciles D6-D10 (RFR/part 17 452…62 716; mean IR rate 1,05 %…16,35 %) | |
| Input Capitalisation | 95×38 | Assets to return 606,97 Md€ at 3 % = 18,21 Md€; INSEE S1313 balance sheet 2024 (non-financial 2 821,1; financial 1 678,2; total 4 499,3 Md€); social-housing parameters (4,8 M dwellings, 106,9 k€/logement…) | INSEE national accounts 8988859; Union sociale pour l'habitat |

*Story*: waterfall from 236 Md€ to "8 000 €/foyer"; Sankey of savings -> CSG restitution + savings account; "where the CSG goes" (50/25/17/11/11); PO/GDP before/after; tax-by-tax swap (which taxes disappear, which two take the strain).

### 5.2 `Synthèse Graphiques Résolution_0910.xlsx` (169 Ko, 12 sheets) - series behind the book's charts (source line at top of each sheet)

| Sheet | Dims | Columns / content | Source | Chart title |
|---|---|---|---|---|
| GraphGov | 84×21 | Government expenditure % GDP (tec00023) and net lending/borrowing % GDP (tec00127), 2024 & 2025, ~33 countries | Eurostat | «Déficit public en % du PIB en 2024», «Dépenses publiques en % du PIB en 2024» |
| GraphRDB | 78×10 | Median equivalised income € and PPS 2024 (ilc_di03); relative to France | Eurostat | «Revenu réel médian PPA», «Revenu médian par pays en €» |
| GraphVA | 28×3 | Value added per hour: 63 = 29/11/23 | Résolution | «Répartition de la valeur ajoutée créée par une heure de travail» |
| GraphCodes | 14×24 | Words in législatif/réglementaire texts (codified/non-codified) 2005–2026; 4 codes (construction, environnement, urbanisme, CGCT) | Légifrance | «Volume de normes en France, en nombre de mots» |
| Graph51pc | 26×8 | 100 -> 51 -> 26 -> 13,3 -> 6,8 -> 3,5 | Résolution | «Dégradation de la représentation démocratique» |
| Graph1672Md | 129×4 | INSEE 3.301 COFOG 2024: 1 671,794 Md€ by function and sub-function (≈ 100 lines) + 6 groups | Insee | (no chart) |
| GraphETP | 67×5 | State/local/hospital headcount (km) 2023 by ministry and operator split | fonction-publique.gouv.fr | |
| Graph236 | 34×4 | 236 Md€ category series | Résolution | |
| GraphAgences | 69×9 | Fate of 1 104 agencies (table 5.3), ministries 35 -> 7 (list of 18 + 17) | Résolution | «Devenir des 1104 agences d'Etat», «Devenir des 35 ministères» |
| GraphPatrimoine | 79×6 | INSEE S1313 assets 2024 (non-financial 2 821,1; financial 1 678,2); by category (équipements 1 908,7; crédits 939,9; bâtiments 619,3/138,7; participations non cotées 611,1; cotées 127,3) | Insee 8988859 | |
| GraphIR | 38×75 | 23 % flat tax + AFU cases and 0–72 000 € series | Résolution formulas | «Impôt et aide fondamentale», «Aide fondamentale et impôt unique selon le revenu» |
| GraphAFU | 30×88 | Lifecycle 0–85 (see 3.4) | Résolution | «Solidarité nationale au cours de la vie» |

*Stories*: international rankings (spending, deficit, median income), 100 -> 3,45 representation funnel, legal-word growth area chart, COFOG treemap, "who is the State" headcount, lifecycle aid chart, tax-vs-income curve with break-even.

### 5.3 `Synthèse ETP et agences Résolution_0910.xlsx` (199 Ko, 10 sheets)

| Sheet | Dims | Content | Source |
|---|---|---|---|
| Synthèse agences R | 12×10 | Fate matrix: Agences État 1 104 (cession 78, suppression 668, internalisation 55, EPIC musée 40, EPIC enseignement 258, autorité indép. 5); opérateurs PLF 434; hors PLF 328; AAI 24; commissions 318; local agencies 23 264; total 24 368 | Résolution |
| Opérateurs R | 184×19 | Mission, programme, operator, Nb/cat, ETPT LFI 2025 total/sous plafond/hors plafond and PLF 2026, fate flags (Vente/Suppression/EPIC/Internalisation). 179 lines = 433–434 operators, 479 514 → 478 026 ETPT (401 310 sous plafond PLF 2026) | LFI 2025, PLF 2026 «Opérateurs de l'État» |
| ODAC-ODAL R | 777×9 | Insee ODAC 2023 (700; 372 already treated) and ODAL (~24 000) organisation lists by COFOG function with fate flags | Insee |
| Synthèse ETP, FPT, FPH, FPE | 25/38/10/28 rows | Physical headcount 2023 by status, by ministry (FPE incl. military), by territorial type and category (FPT), by hospital category (FPH) | DGAFP rapport annuel 2025 |
| Emplois Etat RAP 2024 | 333×25 | Employment per mission/programme: realised 2023-24, LFI+LFR, transfers, schémas d'emplois, exits/entries/retirements | RAP 2024 |
| Annexe Etat | 164×10 | Mission/programme codes (M/P) | PLF 2026 |
| Commissions R | 325×13 | 324 commissions (317 en vigueur, 7 supprimées depuis 2024): ministère de rattachement, instance, texte, members, operating cost k€ 2022-24 (sum 2024 ≈ 32,5 M€), meetings, Jaune 2026 status/comments | «Jaune» 2026 |

*Stories*: "1 104 agencies -> 303", cost of consultative commissions, headcount by ministry.

### 5.4 `PLF26 - Dépenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls` (1,5 Mo, 5 sheets; Excel 97 `.xls`)

| Sheet | Dims | Columns |
|---|---|---|
| SynthèseR | 41×11 | Restitution hypotheses (M€): total State economy 82 473 (at 1 yr 44 206 + beyond 38 267) by nature: salaires 2 959, fonctionnement 2 731, investissement 1 053, taxe affectée opérateurs 17 923, subventions opérateurs 9 990, ménages 20 094, entreprises 15 154, associations 12 569; ~61 392 State FTE cut at average salary 47 013 € ; detail of subsidy savings (France Travail, Anah, MaPrimeRénov', Ademe, APL 16 117, AME 1 095, APD 2 953, hébergement 2 455…) |
| Economies R | 206×25 | by mission and programme × nature (salaires, cotisations, avantages, fonctionnement, investissement, subventions opérateurs/ménages/entreprises/collectivités/autres): "périmètre essentiel", "à arrêter" with horizons («En 3 ans»). 38 missions + 160 programme lines |
| Données PAP 2026 | 2 352×17 | **2 351 rows**: type mission (BG/BA), mission, code, programme, action, sous-action, catégorie (title 2…), AE PLF, CP PLF, FDC/ADP, ministry. Sum **AE 842,79 Md€, CP 818,51 Md€; 45 missions, 162 programmes** |
| Crédits RAP 2024 | 1 408×22 | AE/CP 2023 & 2024 (titre 2/hors titre 2), LFI 2024 and execution |
| Emplois RAP 2024 | 325×25 | employment per programme |

Source: PLF 2026 (budget.gouv.fr/documentation/documents-budgetaires-lois/exercice-2026/plf-2026), RAP 2024. *Stories*: treemap of State budget by mission/nature; "what stays (7 missions) vs what stops"; cost of subsidies by recipient type.

### 5.5 `PLF 2026_V&M tome II - Annexe 3 - Dépenses fiscales - 0910.xls` (1,3 Mo, 10 sheets)

| Sheet | Dims | Content |
|---|---|---|
| Synthèse | 26×7 | 465 niches 89,406 Md€; +TVA all APU 101,32; 47 niches with extinguished fait générateur (3,775 Md€); 35 extinguished end-2025 (1,299); 21 reduced TVA rates not counted (33,38); 486 / 134,70 Md€; restitution hypotheses: net effect restituted in CSG 43,13 / solde brut refonte 29,14 / niches restituées en 3 ans 47,72 / niches refondues outre-mer 4,38 / fusionnées aide unique 5,26 |
| Chiffrages Résolution | 471×17 | **465 niches**: category (Impôt sur le revenu 170; IR+IS 53; droits d'enregistrement 50; TVA 46; impôts locaux 42; IS 38; accises énergies 37; autres droits 23; autres impôts directs 6), sous-catégorie, numéro, libellé législatif, date de création, fin du fait générateur, nombre de bénéficiaires, réalisation 2024 (M€), 2024 y c. TVA APU, **% effet net / % solde brut** (1,0 = base inerte; 0,5 = base active), suppression immédiate (Oui 359 / En 3 ans 11 / Fusion CI IR 7 / Flux OM 6), gage CSG (M€) (sum 43 126), solde PO (sum 29 141), typologie |
| Chiffrages | 469×8 | Réalisation 2024, prévision 2025, 2026 per niche |
| Échéances | 469×12 | création, dernière modification, fin du fait générateur, fin d'incidence budgétaire, suppression, motif |
| Bénéficiaires | 467×7 | nature (ménages/entreprises) and number |
| Explication détaillée, Méthodologie, Références juridiques, Programme de rattachement | 468/467/467/523 rows | free-text explanations, method codes, legal references (CGI articles), budget programme |
| Modalités de calcul de l'impôt | 84×18 | 81 provisions ("déclassées") that define the tax computation (décote 7 652 M€, demi-parts…) |

Source: PLF 2026, Voies et moyens tome II annexe 3. *Stories*: bubble chart of 465 niches by cost × beneficiaries × age; "who benefits" (ménages vs entreprises); what is recycled to CSG vs kept; treemap by tax.

### 5.6 `PLF 2026_V&M tome I - Annexe 2 - Taxes affectées_0910.xls` (205 Ko, 2 sheets)

- *Synthèse TA* (15×7): taxes affectées to non-indispensable operators: total 22 784 M€; saving 17 922 M€ (8 120 in 1 yr + 9 803 after); France Compétences 11 250 / AFITF 3 042 / Agences de l'eau 2 317 / Action Logement 1 910 / CNC… 889 / CCI 846 / EPF 310 / Anah 700.
- *taxes affectées* (283×26): **279 tax lines** × 169 beneficiaries: nature juridique, SIREN, programme, mission, beneficiary code/label, **Suppression immédiate** (Oui 76, Collocs 86, Sécu 52, Flux OM 11, Bourse 3, Fermé 3, Fusion CI 1), saving at 1 yr / supplementary, tax code & label, net allocation 2024, execution/ceiling/reversement to general budget 2024-2026, start of ceiling, legal reference.

### 5.7 `T_3305_APUL_Résolution_0910.xlsx` (188 Ko, 2 sheets)

- *Métadonnées* (117×5): INSEE metadata, file created 2025-02-18, "Comptes nationaux annuels (base 2020)", period 1995→2023, France entière, national.
- *T_3305* (898×40): **table 3.305: expenditure of local public administrations (APUL, S1313) by COFOG function**, in Md€, 1995–2023; 11 operation blocks (OTE total, D1 compensation of employees, P2 intermediate consumption, OED other, D3 subsidies, D4 property income, D62 social benefits, D632 social transfers in kind, D7 other transfers, D9 capital transfers, P5L net acquisition of non-financial assets) × 80 COFOG codes (GF01…GF1004 …). Added Résolution columns: *Mission régalienne* (X), *Champ non indispensable*, *Économie année 1* (e.g., total non-indispensable 39,49; year-1 saving 33,35), *économie hors MS*, *en plus*, *Fusion aide fondamentale (10 % fdg/social)*.

*Stories*: 28 years of local spending by function; "what a commune actually spends on culture/loisirs" (11,6 Md€ extinguished).

### 5.8 Amendments, letters and other files

| File | Size | Content |
|---|---|---|
| `amendements/Liasse_PLF_P1.pdf/.docx` | 91 p. / 34 amendments | Lots I–V; text in `research/pages/amendements__Liasse_PLF_P1.md` |
| `amendements/Liasse_PLF_P2.pdf/.docx` | 66 p. / 39 amendments | 22 état-B credit tables (parsed to `data/derived/etat_b_credits_retires_plf2027.csv`, 79 rows incl. totals, validated: each programme sum = mission total), 337-entity dissolution list, ETPT ceiling table by ministry (Am. 24) |
| `amendements/Liasse_PLFSS.pdf/.docx` | 22 p. / 8 amendments | |
| `manifeste.pdf` | 1 page | = `manifeste.html` |
| `fiches_pdf/*.pdf` | 18 × ~0,2 Mo | PDF of each fiche (identical content to HTML) |
| `lettres/lettre-{depute,maire,senateur}.docx`, `site_json/lettres_textes.json`, `lettres/commun.js` | | letter templates (contain the "25 %" and "5 impôts" wording) |
| `site_json/compteur.json`, `api_etat.json`, `elus/sources.json` | | counter (43 letters), feature flag, élus-directory metadata (574 deputies, 348 senators, 34 826 mayors, 35 726 mairies, 105 files, as of 2026-10-19) |
| `img/*` | | cover, 4th cover (blurb), video thumbnails |
| **Not downloaded (deliberate)** | | `donnees/elus/<dept>.json` (105 files naming individual elected officials with addresses/e-mails; peripheral to the book's data; schema seen on `75.json`: arrondissement/commune -> mayor name, mairie address, e-mail, URL, plus députés/sénateurs) |

### 5.9 Video pages
`videos.html` lists 2 Résolution videos (conférence de lancement; «On ne veut pas tuer l'État, on veut le sauver»), 4 appearances of M. Mitterrand (Europe 1 13 Oct 2026; LCI Brunet sans filtre 7 Oct; RMC Grandes Gueules 11 Sep; Europe 1 4 Sep «On ne s'en sortira pas par l'impôt») and 5 BFM Business "Les Experts" shows with Ingrid Barrat (15 May, 22 Jun, 24 Aug, 25 Sep, 21 Oct). Not data; useful for tone and possible additional statements (not transcribed).

---

## 6. What the legal text says about timing (phase-in cheat-sheet)

| Date | Event |
|---|---|
| 1 Jan 2027 | State credits cut / aid abolitions (chèque énergie, new social-housing aid, PTZ credit, subsidies to private persons); mutation duties + real-gain capital-gain tax on real estate/movables; indexations frozen (benefits, pensions); niches "non incitatives" fall on 2026 incomes; commitment-based niches for engagements from 1 Jan 2027 |
| 1 Jun 2027 | No APL for requests filed after this date |
| 1 Jul 2027 | Exemptions of social contributions abolished; CSG/CRDS step-down starts (Jul 7,6 % … Nov 1,1 %); 337 entities dissolved; 61 400 State jobs closed (ETPT cut 30 698 in 2027); IS 27 %; 21 State taxes + 57 affected taxes abolished; TVA derogatory rates abolished; accise tariffs; CEE abrogated; dons halved; indemnity for exiting civil servants starts; crédit d'impôt famille ends |
| 1 Dec 2027 | CSG/CRDS = 0 on earned income |
| 1 Jan 2028 | **AFU + 23 % flat IR (on 2028 incomes), CEP, bouclier sanitaire (if AFU), régime socle unique, CAF benefits abrogated**, taxe foncière unique, plans/livrets/contracts become CEP compartments (securities taxed at 30 % on exit), dons credit abolished, taxe sur salaires -1/3 |
| 1 Jul 2028 | TVA reduced/intermediate rates -> 20 %; food 10 %; APL conventioned -2/3 |
| 1 Jul 2029 | Food TVA 15 %; APL conventioned ends; agriculture/domestic-service niches at -2/3 -> zero (2029) |
| 1 Jan 2030 | All APL abolished; taxe sur salaires abolished; L. 511-1 CSS (allocation de logement) abrogated; régions/départements business-aid powers abrogated |
| 1 Jul 2030 | Food TVA 20 % |
| IR 2051 | End of the +3 300 € pension AFU supplement |

---

## 7. Conflicts, ambiguities and numbers that do not reconcile

1. **Median worker gain**: manifeste «300 euros par mois … soit 13 % de salaire net» vs workbook **275,08 €/month (12,56 %)** at net 2 190 €; 13 % × 2 190 = 284,7 €. At SMIC: fiche «180 euros de plus par mois» vs workbook 171,7–177,9 € (12,04 %). "13 %" is a rounded version of 12,0–12,6 % **[inference]**.
2. **600 €/month**: «300 net + 300 savings»; workbook flows to capitalisation imply ~338 €/month/foyer **[inference]**; letters claim «augmenter tous les travailleurs de **25 %** d'ici trois ans».
3. **"4 impôts" (manifeste) vs "5 impôts" (letters)**; manifeste: TVA, revenu, sociétés, foncier = 4; PLFSS keeps CSG on pensions/capital and a taxe sur salaires to 2029, etc.
4. **AFU «550 € par mois» received by SMIC worker (Am. 28 exposé)** vs net transfer shown by GraphIR (6 600 - 23 % × income). At SMIC (~17 200 €/yr) net transfer ≈ 2 640 €/yr ≈ 220 €/month. The fiche «+220 €» matches the latter **[inference]**.
5. **"Foyer"** = ~30 M ménages in the fiches (236 Md€ ÷ ~29,5 M = 8 000 €) vs **40,2 M foyers fiscaux** in the legal exposé; AFU is per adult/child, so use persons.
6. **Child cut-off**: AFU child part until the year of the 18th birthday; the "compte éducation" is drawn for ages 0–18 (19 values in the chart). The AFU text says «chaque personne majeure composant le foyer fiscal», so 18–25-year-olds attached to parents' foyer are ambiguous (art. 196 attached students).
7. **Operators**: PLF-P2 Am. 25 cites «431 opérateurs»; workbook says 434 (and 433 in line sum).
8. **Agencies "suppressions et cessions" 746** (GraphAgences) vs 337 named dissolutions in Am. 25; the latter is a legal list for 1 Jul 2027 (different perimeter; 318 commissions and local organisms are outside it).
9. **APL saving 2027**: PLF-P2 Am. 32 exposé «5,4 milliards d'euros» vs état-B amendment removing **8 067,8 M€** from programme «Aide à l'accès au logement» (programme 16 520,5 M€). Unexplained (Détail Economies: APL year-1 5,4 + 10,7 later = 16,1).
10. **«record mondial» of State spending**: Eurostat data in the book's own workbook place Finland (57,7 %) above France (57,0 %) in 2024.
11. **Web table rounding**: web sub-items don't add to subtotals (39 vs 37,4; 69 vs 68,9). Use workbook.
12. **Book length**: 84 vs 180 pages in retail listings.
13. **Salary base**: whether the 10 % deduction for professional expenses and CSG deductibility still shape "revenu net imposable" is not stated.
14. **CSG on capital**: PLFSS Am. 3 says the loss from the taxe sur salaires is covered by «la majoration du taux des contributions mentionnées aux articles L. 136-6 et L. 136-7» (CSG on capital income) while PLF-P1 Am. 20 folds the 17,2 % social levy into a 30 % total; interplay unclear.
15. **Cost of AFU**: "gross 402 Md€; merges 135,3 Md€ of existing items" -> net new ≈ 266,7 Md€ funded by 23 % flat tax on a larger base; the sources do not publish a micro-simulation showing winners/losers by decile (only IR decile data D6–D10 in *Refonte fiscalité*).

---

## 8. Gaps for a personal "how does this reform change MY situation" simulator, and where to fill them

**A. Baseline ("before") rules, none included in the source**
- IR barème 2025/2026 (tranches, quotient familial + plafonnement, décote, CEHR, abattements 10 %/20 %, frais réels), CSG/CRDS rates by income type, deductible CSG, cotisations salariales/patronales by gross pay, auto-entrepreneur regimes, prélèvements sociaux on capital (17,2 %), PFU.
- Benefits: RSA, prime d'activité, AF/ALF/ARS/CF/PAJE/ASF, AAH, ASPA, APL/AL (zone barèmes, loyers plafonds, forfaits charges), bourses, chèque énergie, ARE/ASS (unemployment), retraite (régime général formulas, minimum contributif), taxe d'habitation (now only secondary residences), taxe foncière (current), DMTO, droits de succession, plus-values (abattements), TVA by COICOP category.
- Where: **OpenFisca-France** (open-source Python microsimulation of the French tax-benefit system; web API available), **IPP barèmes** (Institut des politiques publiques, ipp.eu "Barèmes IPP"), **service-public.gouv.fr** (SMIC, PASS, barèmes), **impots.gouv.fr** (barème IR 2026 on 2025 income), **CAF/Mes-Aides (mes-aides.gouv.fr, built on OpenFisca)**, **Légifrance/LEGI** (exact article versions; the liasses cite LEGI millésime 20261001), DREES (non-recours, minima sociaux), INSEE (ERFS, Budget de famille, Filosofi, Enquête Revenus fiscaux), DGFiP (REI taux locaux, statistiques IR), data.gouv.fr (barèmes, DVF valeurs foncières, taux foncier par commune), ANIL/observatoires des loyers.

**B. Reform parameters missing or only claimed**
- CEP: rate of the «versement de restitution», global «versement de patrimoine», annuity conversion (all "fixés chaque année"). Needed to convert "20 000 €" and "300 €/month" into account trajectories. Use the site's 3-year/3 % assumptions as scenario inputs.
- Compte éducation mechanics (6 600 €/yr, school choice, adult education), unemployment 6-month rule and replacement rate, RSA/prime d'activité/AAH/ASPA/bourses abolition rules and timing (AFU replacing them is asserted, not legislated), régime socle unique rules, pension indexation after 2027, bouclier "10 % per act" and complémentaire rules, retirement age/carrière longue.
- Definition of "revenu net imposable" after reform (frais professionnels 10 %, CSG deductibility, self-employed base), treatment of 18–25 attached children, shared custody, couples (AFU per adult: 2 × 6 600 so no couple penalty).
- Taxe foncière: INSEE rental-value tariffs by sector and local rates 2028 do not exist yet; use current local taxe foncière as proxy (the text says 10 % ≈ today's tax incl. ordures ménagères).
- TVA pass-through and price effects («inflation faciale < 2 %», rents falling, "+13 % purchasing power" for clients), employer pass-through of the CSG cut into net pay, wage dynamics.
- Employer-side changes (taxe sur salaires, exonérations phase-out) and their wage incidence; assumptions behind "+13 %" are macro.

**C. Data that would help the public dashboard**
- Geography: none in the workbooks (all national). For regional/commune views use INSEE (Filosofi, comptes locaux), DGCL (comptes des collectivités, REI), DGFiP.
- Time: only 1995–2023 (APUL), 2005–2026 (legal words), 2022–2026 (taxes affectées), 2023–2024 (staff). No time series of the plan's own trajectory except CSG monthly steps, TVA/APL/food phase-in, and the cited timeline in section 6.

**D. Risks / caveats to display in the apps**
- These are *proposals* by an association (amendments are drafted «prêts à déposer»), not adopted law; the book's marketing numbers are rounded and sometimes inconsistent with the authors' own workbooks (section 7).
- Do not present the 600 €/month as individual-computable: only the CSG/CRDS salary uplift and the flat-tax/AFU mechanics are exact.

---

## Appendix A: état B credits removed by the PLF-P2 amendments 1–22 (M€)

| # | Mission | AE removed | CP removed |
|---|---|---:|---:|
| 1 | Cohésion des territoires | 13 292,8 | 13 129,0 |
| 2 | Travail, emploi et administration des ministères sociaux | 12 065,4 | 10 695,6 |
| 3 | Aide publique au développement | 2 334,8 | 2 185,6 |
| 4 | Écologie, développement et mobilité durables | 3 772,5 | 3 269,8 |
| 5 | Relations avec les collectivités territoriales | 3 760,1 | 2 814,6 |
| 6 | Culture | 2 027,9 | 1 743,3 |
| 7 | Sport, jeunesse et vie associative | 1 005,6 | 974,4 |
| 8 | Immigration, asile et intégration | 1 259,2 | 1 257,0 |
| 9 | Santé | 781,6 | 779,2 |
| 10 | Recherche et enseignement supérieur | 772,7 | 670,1 |
| 11 | Médias, livre et industries culturelles | 674,7 | 568,9 |
| 12 | Économie | 630,4 | 556,6 |
| 13 | Direction de l'action du Gouvernement | 513,5 | 368,2 |
| 14 | Transformation et fonction publiques | 207,8 | 168,0 |
| 15 | Enseignement scolaire | 225,4 | 225,4 |
| 16 | Action extérieure de l'État | 205,8 | 200,1 |
| 17 | Solidarité, insertion et égalité des chances | 102,1 | 102,0 |
| 18 | Agriculture, alimentation, forêt et affaires rurales | 92,1 | 78,7 |
| 19 | Administration générale et territoriale de l'État | 68,7 | 68,7 |
| 20 | Sécurités | 49,3 | 37,9 |
| 21 | Justice | 6,9 | 5,9 |
| 22 | Conseil et contrôle de l'État | 6,3 | 5,8 |
| | **Total** | **43 855,4** | **39 905,0** |

Notes: Solidarité (RSA, AAH, prime d'activité ≈ 27,6 Md€ of "ménages" transfers in the workbook) is barely touched in 2027 (102 M€), consistent with the AFU taking over from 2028. The first-year state economy in the workbook is 44,2 Md€ (SynthèseR), in line with the AE removed.

## Appendix B: crawl method and coverage

BFS from `/` and `/donnees.html` following every `href`/`src` (29 HTML pages, 50 assets); the 404 page for `robots.txt`/`sitemap.xml` is the site's standard 404. Hidden JS endpoints probed: `lettres/textes.json`, `donnees/compteur.json`, `donnees/elus/{sources,etranger,75,01}.json`, `api/etat` (all 200); `donnees/elus/index.json` 404. WebFetch of retail pages (leslibraires, LGDJ, Google Books) gave publisher blurb but no table of contents (Cultura returned 403). Nothing in the downloaded files was executed; the xlsx/xls files were read with openpyxl/xlrd (values only) via `python3 -I`; PDFs via `pdftotext`; docx via pandoc.
