# Workbook diff (October snapshot → 2026-11-21), cell level

Values are the cached cell values dumped by `scripts/dump_workbooks.py`; A1 refs are those of the sheet. Floats are shown rounded to 6 decimals; ∅ = cell absent.

## 1. Workbook inventory (renames and splits)

| October file (sha256[:12], bytes) | Live file(s) (sha256[:12], bytes) | Verdict |
|---|---|---|
| `Synthèse Chiffres Résolution_0910.xlsx` (3264cd06e973, 352149) | `Synthèse des chiffrages.xlsx` (bfa58c04d1d5, 344589) | CONTENT CHANGED |
| `Synthèse Graphiques Résolution_0910.xlsx` (a8a6f04ade72, 173343) | `Séries des graphiques.xlsx` (0c13c4d5bc2a, 154841) | CONTENT CHANGED |
| `Synthèse ETP et agences Résolution_0910.xlsx` (e266fc1d376d, 204771) | `Emplois publics.xlsx` (c442223e3a82, 131715)<br>`Agences publiques.xlsx` (5fd4a209d5fd, 156855) | SPLIT in two files |
| `T_3305_APUL_Résolution_0910.xlsx` (7b31996972e5, 192604) | `Dépenses locales.xlsx` (7b31996972e5, 192604) | byte-identical (renamed only) |
| `PLF 2026_V&M tome I - Annexe 2 - Taxes affectees_0910.xls` (bda4d27671b6, 209920) | `Taxes affectées aux agences.xls` (bda4d27671b6, 209920) | byte-identical (renamed only) |
| `PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls` (6d89483a7c46, 1286144) | `Niches fiscales.xls` (6d89483a7c46, 1286144) | byte-identical (renamed only) |
| `PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls` (cbc2dda7e603, 1543168) | `Dépenses de l'État.xls` (b07c6a47d3e7, 1543168) | CONTENT CHANGED |

## 2. Sheet-by-sheet status

| October workbook | sheet file | live workbook | status | shape old → new |
|---|---|---|---|---|
| Synthèse Chiffres Résolution_0910.xlsx | Annexe_Manuscrit.csv | Synthèse des chiffrages.xlsx | 30 cells changed | 28×10 → 28×10 |
| Synthèse Chiffres Résolution_0910.xlsx | CSG_CRDS.csv | Synthèse des chiffrages.xlsx | identical | 16×10 → 16×10 |
| Synthèse Chiffres Résolution_0910.xlsx | D_tail_Economies.csv | Synthèse des chiffrages.xlsx | 17 cells changed | 43×22 → 43×22 |
| Synthèse Chiffres Résolution_0910.xlsx | D_tail_Niches.csv | Synthèse des chiffrages.xlsx | identical | 24×16 → 24×16 |
| Synthèse Chiffres Résolution_0910.xlsx | Flux.csv | Synthèse des chiffrages.xlsx | 15 cells changed | 28×10 → 28×10 |
| Synthèse Chiffres Résolution_0910.xlsx | Input_Capitalisation.csv | Synthèse des chiffrages.xlsx | 11 cells changed | 95×38 → 95×38 |
| Synthèse Chiffres Résolution_0910.xlsx | Refonte_fiscalit.csv | Synthèse des chiffrages.xlsx | 2 cells changed | 76×13 → 76×13 |
| Synthèse Graphiques Résolution_0910.xlsx | Graph1672Md.csv | Séries des graphiques.xlsx | identical | 129×4 → 129×4 |
| Synthèse Graphiques Résolution_0910.xlsx | Graph236.csv | Séries des graphiques.xlsx | 7 cells changed | 34×4 → 34×4 |
| Synthèse Graphiques Résolution_0910.xlsx | Graph51pc.csv | Séries des graphiques.xlsx | identical | 26×8 → 26×8 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphAFU.csv | Séries des graphiques.xlsx | identical | 30×88 → 30×88 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphAgences.csv | Séries des graphiques.xlsx | identical | 69×9 → 69×9 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphCodes.csv | Séries des graphiques.xlsx | identical | 14×24 → 14×24 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphETP.csv | Séries des graphiques.xlsx | identical | 67×5 → 67×5 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphGov.csv | Séries des graphiques.xlsx | identical | 84×21 → 84×21 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphIR.csv | Séries des graphiques.xlsx | identical | 38×75 → 38×75 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphPatrimoine.csv | Séries des graphiques.xlsx | identical | 79×6 → 79×6 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphRDB.csv | Séries des graphiques.xlsx | identical | 78×10 → 78×10 |
| Synthèse Graphiques Résolution_0910.xlsx | GraphVA.csv | Séries des graphiques.xlsx | identical | 28×3 → 28×3 |
| Synthèse ETP et agences Résolution_0910.xlsx | Annexe_Etat.csv | Agences publiques.xlsx | identical | 164×10 → 164×10 |
| Synthèse ETP et agences Résolution_0910.xlsx | Commissions_R.csv | Agences publiques.xlsx | identical | 325×13 → 325×13 |
| Synthèse ETP et agences Résolution_0910.xlsx | Emplois_Etat_RAP_2024.csv | Emplois publics.xlsx | identical | 333×25 → 333×25 |
| Synthèse ETP et agences Résolution_0910.xlsx | FPE.csv | Emplois publics.xlsx | identical | 28×13 → 28×13 |
| Synthèse ETP et agences Résolution_0910.xlsx | FPH.csv | Emplois publics.xlsx | identical | 10×15 → 10×15 |
| Synthèse ETP et agences Résolution_0910.xlsx | FPT.csv | Emplois publics.xlsx | identical | 38×12 → 38×12 |
| Synthèse ETP et agences Résolution_0910.xlsx | ODAC_ODAL_R.csv | Agences publiques.xlsx | identical | 777×9 → 777×9 |
| Synthèse ETP et agences Résolution_0910.xlsx | Op_rateurs_R.csv | Agences publiques.xlsx | 1656 cells changed | 184×19 → 184×28 |
| Synthèse ETP et agences Résolution_0910.xlsx | Synth_se_ETP.csv | Emplois publics.xlsx | identical | 25×3 → 25×3 |
| Synthèse ETP et agences Résolution_0910.xlsx | Synth_se_agences_R.csv | Agences publiques.xlsx | identical | 12×10 → 12×10 |
| T_3305_APUL_Résolution_0910.xlsx | M_tadonn_es.csv | Dépenses locales.xlsx | identical | 117×5 → 117×5 |
| T_3305_APUL_Résolution_0910.xlsx | T_3305.csv | Dépenses locales.xlsx | identical | 898×40 → 898×40 |
| PLF 2026_V&M tome I - Annexe 2 - Taxes affectees_0910.xls | Synth_se_TA.csv | Taxes affectées aux agences.xls | identical | 15×7 → 15×7 |
| PLF 2026_V&M tome I - Annexe 2 - Taxes affectees_0910.xls | taxes_affect_es.csv | Taxes affectées aux agences.xls | identical | 283×26 → 283×26 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | B_n_ficiaires.csv | Niches fiscales.xls | identical | 467×7 → 467×7 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | Chiffrages.csv | Niches fiscales.xls | identical | 469×8 → 469×8 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | Chiffrages_R_solution.csv | Niches fiscales.xls | identical | 471×17 → 471×17 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | Ech_ances.csv | Niches fiscales.xls | identical | 469×12 → 469×12 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | Explication_d_taill.csv | Niches fiscales.xls | identical | 468×12 → 468×12 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | M_thodologie.csv | Niches fiscales.xls | identical | 467×8 → 467×8 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | Modalit_s_de_calcul_de_l_imp_t.csv | Niches fiscales.xls | identical | 84×18 → 84×18 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | Programme_de_rattachement.csv | Niches fiscales.xls | identical | 523×8 → 523×8 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | R_f_rences_juridiques.csv | Niches fiscales.xls | identical | 467×8 → 467×8 |
| PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls | Synth_se.csv | Niches fiscales.xls | identical | 26×7 → 26×7 |
| PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls | Cr_dits_RAP_2024.csv | Dépenses de l'État.xls | identical | 1408×22 → 1408×22 |
| PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls | Donn_es_PAP_2026.csv | Dépenses de l'État.xls | identical | 2352×17 → 2352×17 |
| PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls | Economies_R.csv | Dépenses de l'État.xls | identical | 206×25 → 206×25 |
| PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls | Emplois_RAP_2024.csv | Dépenses de l'État.xls | identical | 325×25 → 325×25 |
| PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls | Synth_seR.csv | Dépenses de l'État.xls | 13 cells changed | 41×11 → 41×11 |

## 3. Cell-level changes

### Synthèse des chiffrages.xlsx — sheet `Annexe_Manuscrit.csv` (from `Synthèse Chiffres Résolution_0910.xlsx`), shape 28×10 → 28×10

| cell | row label | column header | old | new | Δ |
|---|---|---|---|---|---|
| C3 | Total des économies | En Md€ par an | `236.054667` | `236.352699` | +0.298032 |
| E3 | Total des économies | En Md€ | `127.352167` | `129.4593` | +2.10713 |
| F3 | Total des économies | En Md€ | `108.91168` | `106.893399` | -2.01828 |
| C4 | Economies sur les structures facultatives | En Md€ par an | `67.006667` | `68.242` | +1.23533 |
| E4 | Economies sur les structures facultatives | En Md€ | `39.104167` | `41.2113` | +2.10713 |
| F4 | Economies sur les structures facultatives | En Md€ | `27.9025` | `27.0307` | -0.8718 |
| C5 | Économies sur le fonctionnement des administrations | En Md€ par an | `37.431667` | `38.117167` | +0.6855 |
| E5 | Économies sur le fonctionnement des administrations | En Md€ | `30.231667` | `32.3795` | +2.14783 |
| F5 | Économies sur le fonctionnement des administrations | En Md€ | `7.2` | `5.737667` | -1.46233 |
| C8 | Fermeture des agences non indispensables, dont interventions | En Md€ par an | `8.631667` | `9.317167` | +0.6855 |
| E8 | Fermeture des agences non indispensables, dont interventions | En Md€ | `4.931667` | `7.0795` | +2.14783 |
| F8 | Fermeture des agences non indispensables, dont interventions | En Md€ | `3.7` | `2.237667` | -1.46233 |
| C11 | Économies sur la masse salariale des administrations | En Md€ par an | `29.575` | `30.124833` | +0.549833 |
| E11 | Économies sur la masse salariale des administrations | En Md€ | `8.8725` | `8.8318` | -0.0407 |
| F11 | Économies sur la masse salariale des administrations | En Md€ | `20.7025` | `21.293033` | +0.590533 |
| C12 | Plan de départ des agents administratifs de l'Etat et ses ag | En Md€ par an | `9.575` | `10.2605` | +0.6855 |
| F12 | Plan de départ des agents administratifs de l'Etat et ses ag | En Md€ | `6.7025` | `7.388` | +0.6855 |
| C13 | Plan de départ des agents administratifs locaux | En Md€ par an | `20` | `19.864333` | -0.135667 |
| E13 | Plan de départ des agents administratifs locaux | En Md€ | `6` | `5.9593` | -0.0407 |
| F13 | Plan de départ des agents administratifs locaux | En Md€ | `14` | `13.905033` | -0.0949667 |
| C14 | Economies sur les subventions | En Md€ par an | `68.948` | `68.858` | -0.09 |
| F14 | Economies sur les subventions | En Md€ | `32.8` | `32.71` | -0.09 |
| C15 | Économies sur les subventions aux entreprises | En Md€ par an | `41.448` | `41.358` | -0.09 |
| F15 | Économies sur les subventions aux entreprises | En Md€ | `20` | `19.91` | -0.09 |
| C18 | Extinction des aides locales aux entreprises | En Md€ par an | `12.3` | `12.21` | -0.09 |
| F18 | Extinction des aides locales aux entreprises | En Md€ | `2.6` | `2.51` | -0.09 |
| C27 | Assurance chômage transformée en épargne | En Md€ par an | `30` | `29.6` | -0.4 |
| F27 | Assurance chômage transformée en épargne | En Md€ | `30` | `29.6` | -0.4 |
| C28 | Patrimoine public valorisé et restitué (rendement net par an | En Md€ par an | `18` | `17.552699` | -0.447301 |
| F28 | Patrimoine public valorisé et restitué (rendement net par an | En Md€ | `18.20918` | `17.552699` | -0.656481 |

### Synthèse des chiffrages.xlsx — sheet `D_tail_Economies.csv` (from `Synthèse Chiffres Résolution_0910.xlsx`), shape 43×22 → 43×22

| cell | row label | column header | old | new | Δ |
|---|---|---|---|---|---|
| E3 | Economies Etat | Solde à restituer | `38.5` | `39.871` | +1.371 |
| F3 | Economies Etat | Total supprimé | `82.5` | `83.871` | +1.371 |
| S3 | Economies Etat | Actifs | `-10.15` | `-10.1093` | +0.0407 |
| E4 | Opérateurs (y. c. salaires) | Solde à restituer | `13.454667` | `14.825667` | +1.371 |
| F4 | Opérateurs (y. c. salaires) | Total supprimé | `28` | `29.371` | +1.371 |
| E16 | autres | Solde à restituer | `0.2` | `1.571` | +1.371 |
| F16 | autres | Total supprimé | `2.745333` | `4.116333` | +1.371 |
| G37 | Charges courantes et achats | Hypothèses | `Hors régalien et éducation, 80 % d'économies` | `Hors régalien, éducation et entretien des routes nationales, 85 % d'économies` |  |
| D39 | Economies Collectivités locales | Restitué en CSG | `33.3` | `33.359` | +0.059 |
| E39 | Economies Collectivités locales | Solde à restituer | `20.1` | `19.915` | -0.185 |
| F39 | Economies Collectivités locales | Total supprimé | `53.4` | `53.274` | -0.126 |
| E41 | Aides aux entreprises | Solde à restituer | `2.6` | `2.51` | -0.09 |
| F41 | Aides aux entreprises | Total supprimé | `12.3` | `12.21` | -0.09 |
| D43 | Départs fonctionnaires locaux | Restitué en CSG | `6` | `5.9593` | -0.0407 |
| E43 | Départs fonctionnaires locaux | Solde à restituer | `14` | `13.905033` | -0.0949667 |
| F43 | Départs fonctionnaires locaux | Total supprimé | `20` | `19.864` | -0.136 |
| S43 | Départs fonctionnaires locaux | Actifs | `-6` | `-5.9593` | +0.0407 |

### Synthèse des chiffrages.xlsx — sheet `Flux.csv` (from `Synthèse Chiffres Résolution_0910.xlsx`), shape 28×10 → 28×10

| cell | row label | column header | old | new | Δ |
|---|---|---|---|---|---|
| C6 | en Md€ | CSG+CRDS activité | `129.4` | `129.459` | +0.059 |
| E6 | en Md€ | Gain supp. à terme | `96.7` | `97.886` | +1.186 |
| G6 | en Md€ | Total supprimé à terme | `226.2` | `227.445` | +1.245 |
| E15 | Dont taxes affectées | Gain supp. à terme | `38.5` | `39.871` | +1.371 |
| G15 | Dont taxes affectées | Total supprimé à terme | `82.5` | `83.871` | +1.371 |
| E16 | Transfert des secteurs subventionnés et agents publics aux a | Gain supp. à terme | `13.454667` | `14.825667` | +1.371 |
| G16 | Transfert des secteurs subventionnés et agents publics aux a | Total supprimé à terme | `28` | `29.371` | +1.371 |
| C22 | Economies Collectivités | CSG+CRDS activité | `33.3` | `33.359` | +0.059 |
| E22 | Economies Collectivités | Gain supp. à terme | `20.1` | `19.915` | -0.185 |
| G22 | Economies Collectivités | Total supprimé à terme | `53.4` | `53.274` | -0.126 |
| E24 | Transfert des secteurs subventionnés vers les actifs | Gain supp. à terme | `2.6` | `2.51` | -0.09 |
| G24 | Transfert des secteurs subventionnés vers les actifs | Total supprimé à terme | `12.3` | `12.21` | -0.09 |
| C26 | Transfert des agents publics (compensés à 70 %) vers les act | CSG+CRDS activité | `6` | `5.9593` | -0.0407 |
| E26 | Transfert des agents publics (compensés à 70 %) vers les act | Gain supp. à terme | `14` | `13.905033` | -0.0949667 |
| G26 | Transfert des agents publics (compensés à 70 %) vers les act | Total supprimé à terme | `20` | `19.864` | -0.136 |

### Synthèse des chiffrages.xlsx — sheet `Input_Capitalisation.csv` (from `Synthèse Chiffres Résolution_0910.xlsx`), shape 95×38 → 95×38

| cell | row label | column header | old | new | Δ |
|---|---|---|---|---|---|
| E2 | Actifs à valoriser et transférer |  | `121.74918` | `121.937699` | +0.188519 |
| E4 |  |  | `103.54` | `104.385` | +0.845 |
| E5 |  |  | `38.5` | `39.871` | +1.371 |
| E6 |  |  | `20.1` | `19.915` | -0.185 |
| E7 |  |  | `30` | `29.6` | -0.4 |
| E8 |  |  | `14.94` | `14.999` | +0.059 |
| C10 | Total des actifs à restituer | Actifs à valoriser et transférer | `606.972666` | `605.26548` | -1.70719 |
| D10 | Total des actifs à restituer | => | `0.03` | `0.029` | -0.001 |
| E10 | Total des actifs à restituer |  | `18.20918` | `17.552699` | -0.656481 |
| C13 | Logements publics | Actifs à valoriser et transférer | `51.96` | `51.527` | -0.433 |
| C14 | Parc social | Actifs à valoriser et transférer | `152.902294` | `151.628108` | -1.27419 |

### Synthèse des chiffrages.xlsx — sheet `Refonte_fiscalit.csv` (from `Synthèse Chiffres Résolution_0910.xlsx`), shape 76×13 → 76×13

| cell | row label | column header | old | new | Δ |
|---|---|---|---|---|---|
| E4 | cible | Taux de PO | `0.363284` | `0.363264` | -2.02062e-05 |
| F4 | cible | PO | `1060.75436` | `1060.69536` | -0.059 |

### Séries des graphiques.xlsx — sheet `Graph236.csv` (from `Synthèse Graphiques Résolution_0910.xlsx`), shape 34×4 → 34×4

| cell | row label | column header | old | new | Δ |
|---|---|---|---|---|---|
| D24 | Total des économies |  | `236.054667` | `236.402207` | +0.347541 |
| B26 | Administrations non indispensables 68 |  | `Administrations non indispensables 67` | `Administrations non indispensables 68` |  |
| D26 | Administrations non indispensables 68 |  | `37.431667` | `38.117167` | +0.6855 |
| D27 | Masse salariale |  | `29.575` | `30.124833` | +0.549833 |
| D28 | Aides aux entreprises |  | `41.448` | `41.358` | -0.09 |
| D33 | Cotisations chômage |  | `30` | `29.6` | -0.4 |
| D34 | Rendement des actifs publics |  | `18` | `17.602207` | -0.397793 |

### Agences publiques.xlsx — sheet `Op_rateurs_R.csv` (from `Synthèse ETP et agences Résolution_0910.xlsx`), shape 184×19 → 184×28

1656 cells differ; 0 of them lie inside the October grid (columns A–S), the rest are NEW columns T–AB. Header row 2 of the new columns:

- T: `` — Total général (row 3): ``; units (row 4): ``
- U: `PLF 2026 – Subvention pour charges de service public` — Total général (row 3): `33893819`; units (row 4): `k€`
- V: `PLF 2026 – Subvention pour charges d'investissement` — Total général (row 3): `1022878`; units (row 4): `k€`
- W: `PLF 2026 – Transferts` — Total général (row 3): `16696523`; units (row 4): `k€`
- X: `PLF 2026 – Taxes affectées` — Total général (row 3): `21675051`; units (row 4): `k€`
- Y: `PLF 2026 – Financement public total` — Total général (row 3): `73288271`; units (row 4): `k€`
- Z: `Taxes affectées – économie à horizon 1 an` — Total général (row 3): `6015559`; units (row 4): `k€`
- AA: `Taxes affectées – économie supplémentaire` — Total général (row 3): `8350288`; units (row 4): `k€`
- AB: `Taxes affectées – économie totale` — Total général (row 3): `14365847`; units (row 4): `k€`


### Dépenses de l'État.xls — sheet `Synth_seR.csv` (from `PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls`), shape 41×11 → 41×11

| cell | row label | column header | old | new | Δ |
|---|---|---|---|---|---|
| C6 | Economie totale restituée | Total Etat | `82473.203825` | `83623.780524` | +1150.58 |
| E6 | Economie totale restituée | Fonctionnement | `2731.472907` | `2704.139964` | -27.3329 |
| F6 | Economie totale restituée | Investissement | `1052.992591` | `1075.454628` | +22.462 |
| H6 | Economie totale restituée | Subvention | `9989.554328` | `11360.679542` | +1371.13 |
| I6 | Economie totale restituée | Subvention | `20093.821967` | `19878.144358` | -215.678 |
| C7 | Economie à horizon 1 an | Total Etat | `44206.085103` | `43985.536588` | -220.549 |
| E7 | Economie à horizon 1 an | Fonctionnement | `2731.472907` | `2704.139964` | -27.3329 |
| F7 | Economie à horizon 1 an | Investissement | `1052.992591` | `1075.454628` | +22.462 |
| I7 | Economie à horizon 1 an | Subvention | `8641.260811` | `8425.583202` | -215.678 |
| C8 | Economie à plus d'1 an | Total Etat | `38267.118722` | `39638.243936` | +1371.13 |
| H8 | Economie à plus d'1 an | Subvention | `3609.601877` | `4980.727091` | +1371.13 |
| F31 | Total | Investissement | `1820.310233` | `1604.632624` | -215.678 |
| F32 | A 1 an | Investissement | `1820.310233` | `1604.632624` | -215.678 |

## 4. Formula-level check (xlsx, data_only=False)

- `Synthèse des chiffrages.xlsx` / `Annexe Manuscrit`: 4 formula cells differ
  - E8: `=SUMIFS('Détail Economies'!D:D,'Détail Economies'!$A:$A,"O")-1.052*42/48*10/3` → `=SUMIFS('Détail Economies'!D:D,'Détail Economies'!$A:$A,"O")-1.052*42/48`
  - F8: `=SUMIFS('Détail Economies'!E:E,'Détail Economies'!$A:$A,"O")` → `=SUMIFS('Détail Economies'!E:E,'Détail Economies'!$A:$A,"O")-1.052*42/48*7/3-1.371/2`
  - F12: `=E12*7/3` → `=E12*7/3+1.371/2`
  - C28: `=TRUNC(SUM(E28,F28))` → `=SUM(E28,F28)`
- `Synthèse des chiffrages.xlsx` / `Flux`: 1 formula cells differ
  - E16: `=11+1.052*7/3` → `=12.371+1.052*7/3`
- `Synthèse des chiffrages.xlsx` / `Input Capitalisation`: 2 formula cells differ
  - C13: `=C20*2/3*0.9` → `=C20*0.7*0.85`
  - C14: `=(L27-C20)*2/3*0.9` → `=(L27-C20)*0.7*0.85`
- `Synthèse des chiffrages.xlsx`: 7 formula cells differ in total (0 means every change above is a hard-coded value change).

- `Séries des graphiques.xlsx`: 0 formula cells differ in total (0 means every change above is a hard-coded value change).

- `Dépenses locales.xlsx`: 0 formula cells differ in total (0 means every change above is a hard-coded value change).

