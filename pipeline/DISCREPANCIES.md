# Écarts et ambiguïtés des sources

Chaque section `## Dxx` correspond à un avertissement (`WARN [Dxx]`) émis par `pipeline/validate.py`. `validate.py` échoue si un code émis n'a pas de section ici.

**Version des sources.** Depuis le 21 novembre 2026, le pipeline lit la version republiée par les auteurs les 17 et 18 novembre 2026 : liasses PDF/DOCX (84 amendements : 35 + 40 + 9), classeurs renommés (« Synthèse des chiffrages », « Séries des graphiques », « Emplois publics » et « Agences publiques » — l'ancien classeur ETP a été scindé en deux —, « Niches fiscales », « Dépenses de l'État », « Dépenses locales », « Taxes affectées aux agences ») et pages du site (`research/pages-2026-11-21/`, `data/derived-2026-11-21/`). Les fichiers d'octobre 2026 restent dans le dépôt comme historique (`data/derived/`, `research/pages/`, `data/raw/`) ; le pipeline ne les lit plus. Les sections marquées **Résolu** décrivent un écart d'octobre qui a disparu en novembre ; elles gardent leur code pour que les renvois restent stables et ne sont plus émises par `validate.py`. Les sections D35 à D40 sont nées de la version de novembre.

Règle générale : **aucun chiffre n'est corrigé en silence**. Quand deux sources divergent, les deux valeurs sont conservées (`facts.json`, champ `conflict: true` et liste `conflicts[]` avec `group`, `with`, `note`), et la valeur retenue pour un graphique est indiquée ci-dessous. Les valeurs sont lues dans les cellules du classeur, jamais saisies à la main ; les références sont `feuille!cellule`.

Légende des traitements : **Corrigé** = le pipeline calcule ou choisit la valeur et l'écart est exposé ; **Documenté** = écart conservé tel quel dans les données, à afficher avec sa note ; **Hors périmètre** = non traité par le pipeline.

---

## D01 — COFOG : somme des 10 divisions = total + 0,001 Md€
- Constat : la somme des 10 divisions INSEE (tableau 3.301) dépasse de 0,001 Md€ le total publié.
- Interprétation : arrondi de la source.
- Traitement : Documenté. `depenses-cofog.json › checks` conserve l'écart ; le total retenu est celui du classeur (1 671,794 Md€).

## D02 — COFOG : les 6 groupes du livre sont 0,005 Md€ sous le total
- Constat : la sous-fonction 01.5 (R&D des services généraux, 0,006 Md€) n'apparaît dans aucun des 16 postes du graphique du livre ; somme des groupes = 1 671,789 Md€.
- Interprétation : omission du graphique ; arithmétique : 0,006 (01.5) − 0,001 (D01) = 0,005.
- Traitement : Documenté. Le total de l'arbre est celui d'INSEE ; `unassigned_subfunctions` liste 01.5.

## D03 — COFOG : rattachement des sous-fonctions déduit pour « Administrations » et « Éducation »
- Constat : le graphique ne donne que les 16 montants ; la liste des sous-fonctions qui les composent n'est pas publiée.
- Interprétation : le mapping est reconstitué de façon exacte (±0,0025 Md€ par poste, assertion du build) à partir des sous-fonctions INSEE. Deux postes ne sont exacts qu'avec une hypothèse : 09.6 « Services annexes à l'enseignement » (20,023 Md€) est compté dans « Administrations », et l'« Éducation » du livre est la division 09 moins 09.6. 06.5 est rattaché à « infrastructures ».
- Traitement : Corrigé (mapping explicite) et signalé `mapping_inferred: true` sur les nœuds concernés.

## D04 — Dépenses publiques 2024 : 57,0 % (Eurostat) contre 57,26 % (INSEE ÷ PIB du classeur)
- Constat : Eurostat tec00023 donne 57,0 % du PIB ; le total COFOG INSEE (1 671,794 Md€) rapporté au PIB 2024 du classeur (2 919,9 Md€, feuille « Refonte fiscalité », cellule C3, d'après l'INSEE, tableau 3.217, extraits) donne 57,26 %.
- Interprétation : la dépense est la même ; l'écart vient du PIB pris au dénominateur. Avec 1 671,794 Md€, un taux de 57,0 % correspond à un PIB d'environ 2 933 Md€, soit 13 Md€ (0,4 %) de plus que celui du classeur (à l'arrondi de 57,0 % près : 2 930 à 2 936 Md€). Le PIB du classeur est celui de l'édition de mai 2025 des comptes nationaux ; l'édition de mai 2026 le porte à 2 935,2 Md€ (Eurostat nama_10_gdp, fait `pib_2024_insee_2026_md`), ce qui donne 56,96 % avec la même dépense COFOG.
- Traitement : Documenté. `europe.json` utilise Eurostat (comparabilité entre pays) ; `facts.json` expose les deux (groupe `depenses_pib_france_2024`, le second est un calcul) et la note donne le PIB implicite.

## D05 — « Record mondial » : la Finlande dépasse la France
- Constat : dans les données Eurostat (mise à jour du 21 octobre 2026), 2024 : Finlande 57,9 %, France 57,0 % (France 2e sur 30) ; 2025 : 57,5 % contre 57,3 %. Le classeur, d'un millésime antérieur, donnait 57,7 % et 57,0 % ; 57,5 % et 57,2 %. Le manifeste parle de « record mondial ».
- Interprétation : la France est bien très au-dessus de la zone euro (EA20 : 49,3 % en 2024) mais seconde, pas première, sur ces données ; la source du « record » n'est pas précisée dans le manifeste.
- Traitement : Documenté. `europe.json › points_cles` fournit le rang, la Finlande et la France ; groupe de conflit `record_mondial`. À ne pas afficher « 1re » sans nuance.

## D06 — Eurostat : solde public de l'Islande, de la Norvège et de la Suisse absent de tec00127
- Constat : le classeur laissait une cellule vide (« : », donnée non disponible) pour le solde suisse de 2025 et portait un millésime plus ancien pour l'Islande (−3,7 % et −2,8 %), la Norvège 2025 (+10,4 %) et la Suisse 2024 (+0,5 %). Le jeu `tec00127` (mise à jour du 21 octobre 2026) ne publie plus aucune valeur pour ces trois pays, mais le jeu `gov_10a_main` (solde B9, secteur S13, % du PIB, même mise à jour du 21 octobre 2026) les publie : Islande −4,1 % (2024) et −2,6 % (2025), Norvège +12,7 % et +10,5 %, Suisse +0,3 % et +0,2 %.
- Interprétation : `tec00127` est un extrait limité aux pays de l'Union et de la zone euro ; la donnée existe à la source. Elle n'était pas « non disponible » : nous ne l'avions pas lue au bon endroit.
- Traitement : `europe.json` prend ces trois soldes dans `gov_10a_main` (`data/eurostat/gov_10a_main.json`, téléchargé le 21 novembre 2026 ; `dataset_eurostat` dit lequel des deux jeux a fourni la valeur) et garde la valeur du classeur dans `value_classeur`. La dépense suisse de 2025 (33,6 %) vient de `tec00023`. Aucune valeur n'est plus manquante ; si une valeur l'était, elle resterait `null`, jamais 0.

## D07 — Trois agrégats « zone euro » dans le classeur
- Constat : EA19, EA20, EA21 coexistent.
- Interprétation : EA20 (20 pays, 2023-2025) couvre 2024-2025 ; EA21 existe depuis l'adhésion de la Bulgarie (1er janvier 2026) ; EA19 a la même valeur que EA20 sur 2024-2025. Choix de convention du pipeline, non fait par la source.
- Traitement : Documenté. `europe.json › agregats` garde EA19, EA20, EA21 et UE27 ; `is_euro_area_reference: true` sur EA20.

## D08 — 236 Md€ : total colonne C contre somme E + F (résolu en novembre 2026)
- Constat : en octobre, la ligne « Patrimoine public valorisé et restitué » valait 18 en colonne C et 18,209 en colonne F ; le total de la colonne C (236,055) était inférieur de 0,209 Md€ à E + F (236,264). En novembre 2026 la cellule `Annexe Manuscrit!C28` n'est plus tronquée (`=SUM(E28,F28)` au lieu de `=TRUNC(SUM(E28,F28))`) : C = E + F sur chacune des 26 lignes, total 236,352699 Md€ (« 236 milliards » inchangé).
- Interprétation : la troncature du classeur d'octobre a été corrigée par les auteurs.
- Traitement : résolu, plus d'avertissement ; `validate.py` vérifie l'égalité ligne à ligne. Reste l'écart du total avec la feuille Graph236 (D39) et avec la réconciliation Input Capitalisation (D10).

## D09 — Gain de l'année 1 : Annexe Manuscrit contre feuille Flux (résolu en novembre 2026)
- Constat : en octobre, 127,352 (Annexe) contre 129,4 (Flux), écart de 2,048 Md€. En novembre 2026 l'Annexe donne 129,4593 et la feuille Flux 129,459 (écart de 0,0003 Md€ : arrondi).
- Interprétation : les deux onglets s'accordent ; « année 1 » reste une étiquette non datée du classeur (l'exposé de PLFSS n° 1 écrit 33 Md€ de CSG/CRDS en 2027 et 114 Md€ « en année pleine dès 2028 »).
- Traitement : résolu, plus d'avertissement ; le Sankey par catégorie utilise l'Annexe Manuscrit.

## D10 — Sankey : capitalisation 121,893 (calculée) contre 121,938 (classeur)
- Constat : en additionnant reliquat d'année 1 et année pleine de l'Annexe, la destination capitalisation vaut 121,893 Md€ ; Input Capitalisation!E2 affirme 121,938 Md€. Résidu de −0,045 Md€ (octobre : +0,055 Md€ avec 121,804 contre 121,749).
- Interprétation : les économies État + collectivités en année pleine valent 59,786 Md€ dans Input Capitalisation (39,871 + 19,915) contre 59,741 dans l'Annexe (27,0307 + 32,71) ; la hausse de 1,371 Md€ des taxes affectées a été ajoutée à l'Annexe (F8, F12) mais pas dans les mêmes proportions.
- Traitement : Corrigé par construction : `plan-flux.json` contient deux Sankeys équilibrés, `sankey` (par catégorie, 236,353 en entrée et en sortie, valeurs de l'Annexe) et `sankey_classeur` (feuille Input Capitalisation, 114,46 + 121,938 = 236,398). Ne jamais mélanger les deux dans un même graphique.

## D11 — Tableau web arrondi : sous-totaux affichés ≠ somme des lignes affichées
- Constat : le tableau de donnees.html affiche « structures 67 » mais ses lignes affichées somment à 69 (classeur de novembre : 68,242), et « subventions 69 » contre 70 (classeur : 68,858) ; « fonctionnement 39 » somme ses cinq sous-lignes à 39 (4 + 10 + 9 + 12 + 4) contre 38,117 dans le classeur.
- Interprétation : chaque ligne est arrondie au Md€ séparément, le sous-total est arrondi indépendamment. Ce tableau n'a pas été mis à jour en novembre 2026 (D36).
- Traitement : Documenté (groupe `eco236_arrondis_web`). `plan-flux.json › savings_table` fournit les valeurs du classeur (`md_par_an`, 6 décimales de précision source) et les valeurs web arrondies (`web_arrondi`, `web_md_ecart`). Utiliser le classeur pour tout graphique.

## D12 — Gain CSG/CRDS : 300 €/mois et 13 % contre 275,08 €/mois et 12,56 %
- Constat : au salaire net médian (2 190 €), le manifeste annonce « 300 € » et « +13 % » ; le classeur donne 275,08 €/mois (12,56 %). 13 % × 2 190 = 284,7 €. Au SMIC : 180 € (fiche) contre 171,72 € (SMIC 2025, 12,04 %), 173,74 € (01/2026) et 177,93 € (06/2026).
- Interprétation : le « 13 % » arrondit les 12,56 % du classeur au salaire net médian (les 12,04 % du SMIC arrondissent à 12 %) ; l'écart de 300 € à 275 € n'est pas expliqué. Depuis novembre 2026 le manifeste écrit « +13 % ». Le classeur est la source de calcul.
- Traitement : Documenté (groupes `gain_csg_median`, `gain_csg_smic`). Les graphiques « mon gain » doivent partir des courbes du classeur (`plan-flux.json › csg_cas_types`) et non des annonces.

## D13 — « 600 € par mois » non vérifiable à partir du classeur
- Constat : « 600 € = 300 € de salaire net + 300 € d'épargne ». Le flux du classeur vers la capitalisation (121,938 Md€) représente ≈ 339 €/mois par foyer (30 M de foyers) ou ≈ 350 € par travailleur (29 M). Les lettres annoncent par ailleurs « 25 % » de hausse en trois ans.
- Interprétation : le montant dépend du dénominateur (D16) ; les sources ne donnent pas la décomposition par tête.
- Traitement : Documenté (groupe `restitution_600_eur`). Ne présenter « 300 € d'épargne » que comme annonce (tier `annonce`).

## D14 — Quatre impôts (manifeste) contre cinq impôts (lettres)
- Constat : « quatre impôts » (TVA, revenu, sociétés, foncier) dans le manifeste ; « 5 impôts au lieu de 438 » dans les lettres. Les amendements PLFSS n° 1 à 3 maintiennent en outre : n° 1, la CSG sur les pensions, les allocations de chômage et les indemnités journalières ; n° 2, les parts de la CSG sur les revenus du capital et les produits de placement dans la clé de répartition (« inchangées ») ; n° 3, une taxe sur les salaires jusqu'en 2029 (réduite d'un tiers en 2028, de deux tiers en 2029, abrogée au 1er janvier 2030). Mais le n° 9 (PLFSS) compense la suppression de vingt et une contributions « par la majoration du taux des contributions mentionnées aux articles L. 136-6 et L. 136-7 » du code de la sécurité sociale, soit la CSG sur les revenus du patrimoine et les produits de placement : cette CSG est majorée, non laissée inchangée (hausse non chiffrée dans les sources).
- Interprétation : le 5e impôt n'est pas nommé dans les sources.
- Traitement : Documenté (groupe `nb_impots_cibles`). Aucune interprétation n'est imposée dans les données.

## D15 — Aide fondamentale au SMIC : 550 € brut contre ≈ 220 € net
- Constat : l'exposé de PLF-P1 n° 28 écrit que le salarié au SMIC « reçoit 550 € par mois de l'administration fiscale » (6 600 €/an brut) ; la fiche annonce « +220 € » ; le classeur (GraphIR) raisonne en net.
- Interprétation : brut contre net d'un impôt de 23 % sur le revenu : à l'aide de 6 600 € on retire 23 % du revenu (SMIC), soit ≈ 222 €/mois net au niveau du SMIC (hypothèse : revenu net imposable = salaire net ; sa définition après réforme n'est pas écrite, cf. D27). Le prélèvement de 23 % est vérifié sur les 73 points de la courbe.
- Traitement : Corrigé : `afu_smic_net_calc_eur_mois` (calcul, ≈ 222 €/mois) est distinct des deux annonces ; groupe `afu_smic`.

## D16 — Quatre « foyers » différents
- Constat : 30 M de foyers dans les fiches et dans « 600 Md€ soit 20 000 € par foyer » ; 29,544 M implicites dans « 236 Md€ soit 8 000 € par foyer » (29,507 M en octobre) ; 30,959 M implicites dans « 1 671,794 Md€ soit 54 000 € par foyer » ; 40,2 M de foyers fiscaux dans l'exposé de PLF-P1 n° 28 (dont 18,5 M seulement imposés à l'impôt sur le revenu). L'aide fondamentale est versée par personne.
- Interprétation : le livre ne définit pas son « foyer » ; les « par foyer » du tableau sont arrondis ligne à ligne.
- Traitement : Documenté. Chaque ré-échelonnement « par foyer » du pipeline (tier `calcul`) indique dans `note` le dénominateur utilisé ; les dénominateurs sont des faits (`foyers_implicites_*`, groupe `foyer_denominateurs`). Ne jamais comparer deux montants « par foyer » de sources différentes.

## D17 — Opérateurs : 431, 434 ou 433
- Constat : 431 opérateurs dans l'exposé de PLF-P2 n° 25 ; 434 dans le classeur (somme de la colonne « Nb/cat. » des 180 lignes de la matrice) ; 433 dans la somme citée par la source-analyse.
- Interprétation : écart non expliqué par les sources.
- Traitement : Documenté (groupe `operateurs_nombre`). `agences.json` utilise 434 (somme vérifiée des 180 lignes).

## D18 — Agences : 746 fermetures du livre contre 337 entités nommées dans la loi ; commissions 318/324/317
- Constat : 746 agences d'État supprimées ou cédées dans le livre (sur 1 104) contre 337 personnes morales nommées dans la liste de dissolution de PLF-P2 n° 25 (1er juillet 2027). Commissions : 318 (matrice et amendement) contre 324 lignes dans la feuille Commissions R, dont 317 « en vigueur ».
- Interprétation : périmètres différents ; aucune table de correspondance entre les deux listes n'est publiée.
- Traitement : Documenté (groupe `agences_fermees_vs_dissoutes`). `agences.json` publie la liste des 337 numérotée (1 à 337) et la matrice de devenir des 1 104 agences (746 + 55 + 303) sans les relier l'une à l'autre.

## D19 — APL : 5,4 Md€ (exposé de n° 32) contre 2,690 Md€ (état B n° 1)
- Constat : l'exposé de PLF-P2 n° 32 chiffre l'économie 2027 de l'APL à 5,4 Md€ ; l'amendement n° 1 (état B) retire désormais 2,690 Md€ de crédits de paiement du programme « Aide à l'accès au logement » (16,52 Md€ au texte déposé) — 8,068 Md€ dans la version d'octobre, qui dépassait alors les 5,4 Md€ ; le classeur donne 5,4 Md€ en année 1 puis 10,7 Md€. La date d'effet de la ligne est le 1er juillet 2027 pour les « aides personnelles au logement » (exposé de n° 1, version de novembre).
- Interprétation : non expliqué dans les sources (années, périmètre, crédits restants non reconduits) ; l'écart a changé de sens : l'état B retire moins que l'économie annoncée.
- Traitement : Documenté (groupe `apl_economie_2027`). `credits-retires.json` utilise l'état B (2,690) comme valeur de loi.

## D20 — Niches : 79,5 contre 79,613 Md€ ; 143 contre 134,7 contre 89,4 Md€
- Constat : (a) l'exposé de PLF-P1 n° 1 cite 79,5 Md€ pour 2026 ; la somme des 465 lignes 2026 du classeur vaut 79,613 Md€ (ε et nc comptés pour 0). (b) 134,7 Md€ (486 niches et taux réduits, 2024), 89,406 Md€ (les 465 niches seules, 2024) et « 143 Md€ de niches supprimées » (fiche Contribuable).
- Interprétation : (b) le 134,7 Md€ n'est pas une donnée du PLF : 89,406 (les 465 niches) + 11,915 (« TVA toutes APU », calcul des auteurs) + 33,382 (les 21 taux réduits de TVA, estimation du CPO de février 2023 projetée par les auteurs, D32) ; seuls les 89,406 sont le chiffre de l'annexe. 143 ≈ 72,3 + 18 + 53 de la feuille Flux (niches fiscales + niches sociales + autre gisement) : inférence ; ce périmètre inclut 18 Md€ de niches sociales hors des 486.
- Traitement : Documenté (groupes `niches_cout_2026`, `niches_montant`). `niches.json › synthese` expose chaque périmètre séparément ; 21 taux réduits de TVA sont agrégés (D32).

## D21 — Postes fermés : 151 000 + 428 500 = 579 500 ≠ 580 000
- Constat : écart de 500 entre la somme des administrations centrales (APUC) et des collectivités (APUL) et le total annoncé.
- Interprétation : arrondi de l'objectif.
- Traitement : Documenté (groupe `postes_fermes_arrondi`) ; les deux valeurs sont dans `facts.json`.

## D22 — Mots de loi : rupture de série en 2010 et 2012
- Constat : la série 2005–2026 (GraphCodes) comporte une rupture en 2010 (+48,3 %) et en 2012 (−27,0 %).
- Interprétation : les deux ruptures portent sur la série « réglementaire non codifié » (14,08 → 20,89 millions de mots en 2010 ; 21,59 → 15,76 en 2012) ; cause non documentée (changement de périmètre probable, non confirmé).
- Traitement : Documenté. `etat-partout.json › mots_de_loi › series_break_flags` signale les années ; les graphiques doivent afficher la rupture, pas lisser.

## D23 — Fiches : en-tête de gains ≠ éléments affichés
- Constat : le compte annoncé en en-tête dépasse les éléments listés pour citoyen (13 annoncés, 6 + 3 « comme chacun »), contribuable (10, 6 + 2) et entreprise (9, 6 + 2).
- Interprétation : non expliqué par la source.
- Traitement : Documenté. `fiches.json › fiches[].header_vs_listed` expose les deux comptes pour chaque fiche ; aucun gain n'est ajouté.

## D24 — État B : arrondi de 1 € sur les amendements n° 4, 5 et 13 (résolu en novembre 2026)
- Constat : en octobre, la somme des programmes dépassait le total publié de 1 € en autorisations d'engagement (n° 4, 5, 13). En novembre 2026, tous les états B ont été réécrits (23 missions, 63 programmes, 13 sous-lignes « dont titre 2 ») et la somme des programmes est égale à la ligne TOTAUX pour les 23 amendements.
- Interprétation : arrondi de la source d'octobre, absent des nouveaux tableaux.
- Traitement : résolu, plus d'avertissement ; `credits-retires.json › ecart_somme_programmes_vs_total_eur` vaut 0 partout. Totaux : 24 261,6 M€ d'AE et 21 034,5 M€ de CP (43 855,4 et 39 905,0 en octobre).

## D25 — GraphAFU : deux séries « Epargne retraite personnelle »
- Constat : lignes 29 et 30 portent le même libellé (20 064 € et 6 600 € à partir de 64 ans).
- Interprétation : sens non documenté dans le classeur (20 064 = 19 800 + 264 est un rapprochement du pipeline, non écrit dans le classeur).
- Traitement : Documenté. `lifecycle.json` les exporte séparément (`epargne_retraite_serie_1`, `epargne_retraite_serie_2`) et les exclut du total de flux annuels.

## D26 — Impôts : les lignes « dont » ne partitionnent pas toujours le poste
- Constat : taxes sur la consommation : 105,7 Md€ de détail contre 105,1 Md€ de poste (écart 0,6) ; taxes sur la main-d'œuvre : écart de −49,2 Md€.
- Interprétation : pour la consommation, le poste est « corrigé du bouclier tarifaire électricité » dans le classeur ; l'écart sur la main-d'œuvre n'est pas expliqué.
- Traitement : Documenté (`etat-partout.json › impots › recettes_2024 › children_note`). L'arbre n'additionne que les niveaux validés ; les lignes « à titre onéreux / gratuit » sont traitées en niveau 2 pour que le total (624,9) soit juste.

## D27 — Textes de loi : ambiguïtés juridiques
- Constat : (a) le « revenu net imposable » après réforme (déduction de 10 %, CSG) n'est pas défini ; (b) l'abrogation de 150 U-II-1° (exonération de la plus-value de résidence principale) découle de PLF-P1 n° 20 et n° 1 : inférence de la source-analyse ; (c) le calendrier de l'abattement de 10 % sur les pensions est déduit ; (d) l'exposé de PLF-P1 n° 20 écrit « 17,2 % de contributions sociales, soit 30 % sur les titres et 36,2 % sur l'immobilier », alors que depuis la loi de financement de la sécurité sociale pour 2026 (promulguée le 30 décembre 2025) les prélèvements sociaux sur les revenus de titres sont de 18,6 % (CSG de 10,6 %) et le prélèvement forfaitaire de 31,4 % ; 17,2 % ne subsiste que pour l'immobilier, les revenus fonciers et certains placements (vérification d'après des synthèses juridiques ; Légifrance n'a pas été consulté).
- Interprétation : aucune réécriture juridique n'est faite par le pipeline ; pour (d), le chiffre de l'exposé est celui des auteurs, la mise à jour 18,6 % est une glose du site sur le droit actuel.
- Traitement : Documenté. Le résumé de PLF-P1 n° 20 dit « 18,6 % sur les titres depuis 2026, 17,2 % sur l'immobilier » (glose du site, séparée de la citation des auteurs). Les provisions de calcul de l'impôt concernées sont sorties dans `niches.json › provisions_calcul_impot` et signalées ; les dates ne sont publiées que si la citation est vérifiée mot pour mot dans l'amendement.

## D28 — Pas de microsimulation de l'aide fondamentale
- Constat : coût brut 402,006 Md€ − dépenses existantes fusionnées dans l'aide 135,346 Md€ (fiscal 21,6 + budgétaire 31,8 + social 81,946, feuille « Refonte fiscalité ») = 266,66 Md€ ; aucune répartition gagnants/perdants par décile n'est publiée.
- Interprétation : le calcul net est celui du pipeline (tier `calcul`), pas une donnée des sources.
- Traitement : Hors périmètre. `facts.json` porte `afu_cout_brut_md` et le calcul `afu_cout_net_calc_md` avec ses entrées ; le moteur de simulation est un autre chantier.

## D29 — Ministères : regroupement en 7 blocs déduit de la mise en page
- Constat : 35 ministères avant, 7 après (19 supprimés sans successeur + 16 regroupés en 7). Les 16 ministères maintenus sont rangés dans deux colonnes alternées du graphique (GraphAgences, colonnes H et I) ; le classeur n'écrit pas le découpage en 7 blocs.
- Interprétation : chaque bloc de lignes consécutives d'une même colonne forme un des 7 ministères ; leurs noms suivent l'ordre de l'amendement PLF-P2 n° 27.
- Traitement : Documenté (`etat-partout.json › ministeres › grouping_inferred: true`, `grouping_note`).

## D30 — Niches : colonne « S / E » sans légende
- Constat : la colonne « S / E » du classeur n'a pas de légende.
- Interprétation : S = 16 exonérations salariales (somme des gages 4,80 Md€ = « dont exonérations salariales » de Détail Niches) ; E = 12 exonérations d'épargne et de produits financiers (2,75 Md€) : recoupement, non écrit dans le classeur.
- Traitement : Documenté (`niches.json › meta › typologie_se`) ; la colonne n'intervient pas dans les montants.

## D31 — GraphIR : signe de « Impôt brut à payer »
- Constat : le classeur affiche l'impôt brut avec un signe négatif (flux sortant).
- Interprétation : convention d'affichage de la feuille.
- Traitement : Corrigé : exporté en positif sous `impot_brut_eur` ; les autres flux conservent leur signe.

## D32 — TVA : liste des 21 taux réduits non publiée
- Constat : 21 taux réduits de TVA (33,382 Md€) ne sont pas comptés comme niches ; seule la somme et le nombre sont publiés.
- Interprétation : aucune liste individuelle n'existe dans les sources. Les 33,382 Md€ ne sont pas un chiffre du PLF 2026 : c'est l'estimation du CPO de février 2023 (30 Md€ en 2021, dont 20 Md€ sur l'eau et l'alimentation), projetée sur 2024 au prorata de la TVA des comptes nationaux de l'Insee, par les auteurs (feuille « Synthèse » de leur copie du classeur « Niches fiscales »).
- Traitement : Documenté. `niches.json › meta › counts.taux_reduits_tva_hors_niches` et `taux_reduits_tva_hors_niches` n'ont que des agrégats ; ne pas inventer de lignes.

## D33 — Calendrier : CRDS mensuelle déduite, paliers de référence hypothétiques
- Constat : la trajectoire mensuelle CSG/CRDS (9,7 → 8,1 → 6,5 → 4,8 → 3,2 → 1,6 → 0 point) est vérifiée mot pour mot dans les amendements PLFSS n° 1 et 2 ; en revanche la part CRDS (0,5 = 9,7 − 9,2) est déduite par soustraction. Quatre paliers de départ ne sont pas écrits dans les amendements et ne servent qu'à compléter la courbe : taux de TVA actuel de l'alimentation (5,5 %, `tva_alimentation`), « avantage inchangé » en 2026 (`niches_agri_services_garde`, base 100), exonérations emploi à domicile avant le 1er juillet 2027 (`exonerations_emploi_domicile`), dotation forfaitaire 2026 (`dotation_forfaitaire_communes`).
- Interprétation : ces paliers décrivent la situation avant réforme ; ils sont déduits, pas cités.
- Traitement : Documenté : `trajectoires[].steps[].hypothesis: true` dans `calendrier.json` sur ces quatre paliers ; chacun porte une citation vérifiée du contexte, qui n'établit pas le chiffre de départ lui-même. Les autres paliers (dates et valeurs de la réforme) sont tous vérifiés verbatim. La trajectoire CSG/CRDS est aussi recoupée avec `research/reform_parameters.json` par `validate.py`.

## D34 — Niches éteintes fin 2025 : 1 278 contre 1 298,73 M€
- Constat : 1 278 M€ en réalisation 2024 (feuille Chiffrages Résolution) contre 1 298,73 M€ (Synthèse) ; avec la colonne « yc TVA APU » : 1 298,732 M€.
- Interprétation : la différence correspond à la TVA des administrations publiques (APU).
- Traitement : Documenté ; `niches.json` exporte les deux colonnes.

## D35 — Page « Données » des auteurs : cartes de liasses périmées
- Constat : la page donnees.html (novembre 2026) annonce « 84 amendements » en en-tête mais ses trois cartes affichent « 35 amendements · 94 pages » (PLF-P1 : 35 amendements et 95 pages dans le PDF), « 39 amendements · 66 pages » (PLF-P2 : 40 et 70) et « 9 amendements · 24 pages » (PLFSS), toutes datées « 10 novembre 2026 » ; la somme des cartes est 83. Les PDF eux-mêmes ont été générés le 17 novembre (PLF-P1, PLFSS) et le 18 novembre 2026 (PLF-P2) et leur couverture dit encore « Résolution — octobre 2026 ».
- Interprétation : cartes non mises à jour après l'ajout de PLF-P2 n° 40 et de PLF-P1 n° 35.
- Traitement : Documenté. Les données comptent dans les PDF : 35 + 40 + 9 = 84 amendements et 95 + 70 + 24 = 189 pages ; `amendements.json › meta › donnees_page_cards` garde les deux lectures ; la date affichée sur le site est « 18 novembre 2026 » (date du dernier PDF généré) avec la précision ci-dessus.

## D36 — Tableau des 236 Md€ de donnees.html non mis à jour
- Constat : le tableau arrondi de donnees.html est identique à celui d'octobre (structures 67, fonctionnement 39, subventions aux entreprises 42…) alors que le classeur de novembre donne 68,242, 38,117 et 41,358 ; la page « Propositions » écrit « 68 Md€ économisés par an · 38 Md€ de fonctionnement · 30 Md€ de masse salariale ». Le « 236 » et le « 8 000 € par foyer » ne changent pas.
- Interprétation : le tableau n'a pas été régénéré ; les autres lignes arrondissent encore correctement les valeurs du classeur.
- Traitement : Documenté. `plan-flux.json › savings_checks › web_vs_workbook_mismatches` liste les lignes concernées ; le site utilise le classeur.

## D37 — 434 prélèvements (graphique) contre 438 impôts (manifeste, Propositions, fiches)
- Constat : le titre du graphique « Fusion des impôts » (graphiques/fusion-des-impots.html, novembre 2026) dit « 434 prélèvements aujourd'hui, 4 grands impôts demain » ; le manifeste, la page « Propositions » et les fiches parlent de « 438 impôts, taxes et contributions ».
- Interprétation : la source ne dit pas quels prélèvements séparent 434 de 438.
- Traitement : Documenté (groupe `nb_impots_graphique`). Le site garde « 438 » (manifeste) et expose le « 434 » comme conflit.

## D38 — GraphAFU et fiche Retraité contre la minoration de pension de PLF-P1 n° 28
- Constat : la version de novembre 2026 de PLF-P1 n° 28 minore l'aide fondamentale de 3 300 € par an « pour chaque membre du foyer fiscal titulaire d'une pension de retraite servie par un régime obligatoire et liquidée avant le 1er janvier 2028 » (au lieu de la majorer, comme en octobre), jusqu'à l'imposition des revenus de 2051 ; pour une pension liquidée ensuite, la minoration est réduite au prorata des droits acquis avant 2028. La feuille GraphAFU (« Solidarité au cours de la vie », identique en octobre et en novembre) donne de 64 à 85 ans 6 600 € d'aide fondamentale plus une « part contributive de retraite » de +6 600 €, jamais une minoration de 3 300 € ; la fiche Retraité liste deux pertes (abattement de 10 %, indexation) et ne mentionne pas la minoration.
- Interprétation : le classeur et les fiches n'ont pas été mis en cohérence avec le texte de l'amendement ; pour un retraité d'aujourd'hui, l'aide est de 6 600 − 3 300 = 3 300 € par an (275 € par mois) selon l'amendement.
- Traitement : Documenté. `lifecycle.json` reprend GraphAFU tel quel (série annoncée) et signale l'écart dans la note de la série ; le texte de l'amendement fait foi.

## D39 — Feuille Graph236 : total 236,402 Md€ contre 236,353 Md€ dans l'Annexe Manuscrit
- Constat : `Séries des graphiques › Graph236` donne un total de 236,402207 Md€ (D24) et un rendement des actifs publics de 17,602207 Md€ (D34) ; l'Annexe Manuscrit donne 236,352699 et 17,552699. Écart de 0,0495 Md€ (« Administrations non indispensables 68 » y est en revanche à jour).
- Interprétation : la feuille qui alimente le graphique n'a pas suivi la modification de l'Annexe Manuscrit.
- Traitement : Documenté (groupe `eco236_total`). `plan-flux.json › reconciliation › graph236` garde les deux valeurs ; le total retenu est celui de l'Annexe Manuscrit.

## D40 — Niches : colonne « Suppression » du classeur contre texte de PLF-P1 n° 1
- Constat : pour 37 niches (9,2 Md€ de coût 2024), la colonne « Suppression » du classeur ne dit pas ce que dit le texte de PLF-P1 n° 1. Le Pacte Dutreil (5 000 M€, « En 3 ans » dans le classeur) est supprimé au 1er janvier 2027 (IV.C bis). Quinze niches agricoles, de coopératives, d'HLM, de syndicats ou d'accise (« Oui ») et le crédit d'impôt de remplacement agricole (110240, par l'amendement n° 8) sont réduites par tiers jusqu'en 2029 (IV.E). Le crédit d'impôt garde d'enfants (110203, 1 737 M€, « Fusion CI IR ») est dans le IV.E par un rapprochement inféré avec le III 150° ; 60203 (agricole) l'est par sa nature, et 120124 (salariés détachés, 369 M€) relève du cas général du IV.A, non du IV.E. Pour la TVA, le II, 4° maintient les taux réduits ou dérogatoires que le III n'abroge pas : sur 38 niches de TVA « Oui », seules 22 lignes nommées au III bis (8 330 M€) tombent au 1er juillet 2027 ; 6 exonérations relèvent de la règle générale (IV.D), 2 taux ne sont nommés qu'en partie et 6 ne le sont pas du tout (526 M€), et 2 sont d'outre-mer. Le II, dernier alinéa, met hors du I et du III les dispositions propres aux collectivités des articles 73 et 74 et à la Nouvelle-Calédonie : dix niches « Oui » (661 M€) et les six « Flux OM » n'ont pas de date. Le cas général est le IV.A (impôt sur le revenu dû au titre de 2026, IS des exercices clos à partir du 1er janvier 2027, droits d'enregistrement à partir du 1er janvier 2027), non 2028.
- Interprétation : le classeur est la lecture des auteurs ; le texte de l'amendement fait foi. Pour les taux de TVA non nommés (et les deux nommés en partie), les exposés disent davantage que le texte : l'exposé du n° 21 écrit « Les taux dérogatoires recensés comme dépenses fiscales ne sont pas visés ici : une disposition distincte les supprime au 1er juillet 2027 », et celui du n° 1 date « les taux réduits de taxe sur la valeur ajoutée au 1er juillet 2027 » tout en rangeant parmi les exceptions « les taux réduits … autres que ceux que le III abroge ». C'est un conflit entre le texte et l'exposé, affiché comme tel et non tranché. La correspondance entre le code général des impôts et les lignes du code des impositions sur les biens et services (III bis) n'est pas dans les sources : le rapprochement se fait par l'intitulé. Le III 150° (« 23° bis du II de la section V ») ne cite pas l'article 200 quater B (`inferred: true`, Légifrance n'a pas pu être consulté).
- Traitement : Documenté. `niches.json › niches[].resolution` garde `plan_classeur` (colonne des auteurs), `plan_texte` (groupe du IV, numéros du III, note affichée sous la niche) et `plan_final` (le texte l'emporte), avec `plan_conflit_classeur` ; `plan_texte › conflits_avec_le_classeur`, `lectures_inferees`, `tva` et `outre_mer` listent les niches. Détail : (a) quinze niches IV.E : 300101, 300102, 300109, 300110, 300208, 60102, 60104, 60202, 120147, 500101, 530208, 530216 et les tarifs L. 312-60 à L. 312-63 (800224, 830203, 830204) ; 300102, 300109, 300110 et 300208 n'y sont que par le bloc 158° à 162°, non par leur nature. (b) TVA : 22 nommées (8 330 M€), 6 règle générale (440 M€), 2 en partie (173 M€), 6 maintenues (526 M€), 2 outre-mer (710109, 710110). (c) Hors champ outre-mer : 50109, 60108, 90108, 110302, 210322, 500102, 550105, 710109, 710110, 990202 ; les avantages d'investisseurs non domiciliés (110210, 110224, 110260, 320113, 210325) restent dans le champ, 110210, 110224 et 110256 par le III 135° (IV.B), 110256, 320136 et 320146 aussi par l'amendement n° 18. Nouveaux effets : « Supprimée en partie » (2), « Maintenue par le texte » (6), « Hors du champ (outre-mer) » (16). Totaux : 327 niches supprimées (65,1 Md€), 26 en trois ans (11,5 Md€), 6 dans l'aide fondamentale (3,5 Md€), 16 hors champ (3,5 Md€), 8 TVA en partie ou maintenues (0,7 Md€), 82 éteintes (5,1 Md€). Pour les niches de l'impôt sur le revenu du IV.C, la date est l'imposition des revenus de 2028.

## D41 — Qui paie les droits de mutation (PLF-P1 n° 19 et n° 20)
- Constat : l'exposé de PLF-P1 n° 19 écrit que le droit « est supporté par celui qui liquide la plus-value sur laquelle il s'impute : le vendeur pour une vente, l'héritier pour une succession » et que « pour le même appartement, le vendeur acquitte 3 900 euros, qui viennent en déduction de l'impôt sur sa plus-value ». Le dispositif (article 683, III, nouveau) dit que « la taxe ou le droit sont supportés par celui qui liquide la plus-value sur laquelle ils s'imputent » (« les parties peuvent en convenir autrement ») et qu'ils constituent « un acompte de l'impôt sur le revenu dû par le redevable à raison de la plus-value qu'il réalise lors de la cession du bien » ; le seuil s'apprécie « par acte et par redevable », en rappelant « les mutations consenties au même redevable par la même personne ». L'amendement n° 20 (12°, b, article 200 B) impute sur l'impôt de plus-value « les droits acquittés à titre d'acompte par le cédant […] lors de l'acquisition, intervenue à compter du 1er janvier 2027, du bien ou du droit cédé », et son exposé écrit « le droit de mutation payé à l'achat s'impute sur l'impôt dû à la revente » (12 000 € d'impôt moins 3 900 € = 8 100 € à payer). Selon le n° 20, l'acheteur paie donc à l'achat et récupère à la revente ; selon l'exposé du n° 19, le vendeur paie à la vente.
- Interprétation : les deux lectures coexistent dans les textes ; la formule du dispositif (« celui qui liquide la plus-value ») ne dit pas si c'est le vendeur du jour ou l'acheteur de demain, et les parties peuvent en convenir autrement.
- Traitement : Documenté. Le site montre les deux lectures (résumé de l'amendement n° 19, simulateur) et n'affirme pas qui paie ; l'exemple de 3 900 € pour un appartement de 200 000 € est présenté comme l'exemple de l'amendement. Le montant payé aujourd'hui n'est pas non plus celui de l'exposé (« 10 000 euros ») : avec le taux départemental de 5 % en vigueur depuis le 1er avril 2025 dans la plupart des départements, la taxe communale et les frais d'assiette, il est d'environ 12 640 € sur 200 000 € (BOFiP 14771-PGP).

---

## Hors périmètre
- Nombre de pages du livre : 180 pages (LGDJ, librairies) contre 84 (Google Books, Eyrolles) ; une note de bas de page de l'amendement PLFSS cite « p. 141 », ce qui correspond à 180 pages. Non utilisé dans les données.
