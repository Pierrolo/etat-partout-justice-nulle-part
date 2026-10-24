# Écarts et ambiguïtés des sources

Chaque section `## Dxx` correspond à un avertissement (`WARN [Dxx]`) émis par `pipeline/validate.py`. `validate.py` échoue si un code émis n'a pas de section ici.

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
- Constat : Eurostat tec00023 donne 57,0 % du PIB ; le total COFOG INSEE (1 671,794 Md€) rapporté au PIB 2024 du classeur (2 919,9 Md€) donne 57,26 %.
- Interprétation : non expliqué par les sources (agrégats ou millésimes de PIB différents, hypothèse non vérifiée).
- Traitement : Documenté. `europe.json` utilise Eurostat (comparabilité entre pays) ; `facts.json` expose les deux (groupe `depenses_pib_france_2024`, le second est un calcul).

## D05 — « Record mondial » : la Finlande dépasse la France
- Constat : dans les données Eurostat du classeur, 2024 : Finlande 57,7 %, France 57,0 % (France 2e sur 30) ; 2025 : 57,5 % contre 57,2 %. Le manifeste parle de « record mondial ».
- Interprétation : la France est bien très au-dessus de la zone euro (EA20 : 49,4 % en 2024) mais seconde, pas première, sur ces données ; la source du « record » n'est pas précisée dans le manifeste.
- Traitement : Documenté. `europe.json › points_cles` fournit le rang, la Finlande et la France ; groupe de conflit `record_mondial`. À ne pas afficher « 1re » sans nuance.

## D06 — Eurostat : valeur manquante (« : ») pour la Suisse en 2025
- Constat : une cellule vide (« : », donnée non disponible) pour CH 2025.
- Interprétation : donnée non disponible dans la source.
- Traitement : Corrigé en `null` (jamais 0). Les graphiques doivent gérer `null` (classement sur 2024 pour ce pays).

## D07 — Trois agrégats « zone euro » dans le classeur
- Constat : EA19, EA20, EA21 coexistent.
- Interprétation : EA20 (20 pays, 2023-2025) couvre 2024-2025 ; EA21 existe depuis l'adhésion de la Bulgarie (1er janvier 2026) ; EA19 a la même valeur que EA20 sur 2024-2025. Choix de convention du pipeline, non fait par la source.
- Traitement : Documenté. `europe.json › agregats` garde EA19, EA20, EA21 et UE27 ; `is_euro_area_reference: true` sur EA20.

## D08 — 236 Md€ : 236,055 (total colonne C) contre 236,264 (E + F)
- Constat : dans l'Annexe Manuscrit, la ligne « Patrimoine public valorisé et restitué » vaut 18 en colonne C et 18,209 en colonne F. Le total de la colonne C (236,055) est donc inférieur de 0,209 Md€ à la somme du gain d'année 1 et du gain supplémentaire (236,264). 18,209 = 3 % × 606,973 (Input Capitalisation).
- Interprétation : la colonne C est arrondie à 18 pour le patrimoine seul.
- Traitement : Documenté. « 236 Md€ » = 236,055 (colonne C) retenu comme total ; les deux autres valeurs sont des faits distincts (groupe `eco236_total`). Les trois valeurs arrondissent à 236.

## D09 — Gain de l'année 1 : 127,352 (Annexe) contre 129,4 (feuille Flux)
- Constat : écart de 2,048 Md€ entre l'Annexe Manuscrit et la feuille Flux.
- Interprétation : arrondis différents entre les feuilles ; en année pleine, les économies État + collectivités sont de 58,6 (Input Capitalisation : 38,5 + 20,1) contre 60,7025 (Annexe : 27,9025 + 32,8), soit −2,102. Les deux écarts se compensent presque (solde −0,055, cf. D10).
- Traitement : Documenté (groupe `plan_gain_annee_1`). Le Sankey par catégorie utilise l'Annexe Manuscrit.

## D10 — Sankey : capitalisation 121,804 (calculée) contre 121,749 (classeur)
- Constat : en additionnant reliquat d'année 1 et année pleine de l'Annexe, la destination capitalisation vaut 121,804 Md€ ; Input Capitalisation!E2 affirme 121,749 Md€. Résidu de 0,055 Md€.
- Interprétation : conséquence de D09.
- Traitement : Corrigé par construction : `plan-flux.json` contient deux Sankeys équilibrés, `sankey` (par catégorie, 236,264 en entrée et en sortie, valeurs de l'Annexe) et `sankey_classeur` (feuille Input Capitalisation, 114,46 + 121,749 = 236,209). Ne jamais mélanger les deux dans un même graphique.

## D11 — Tableau web arrondi : sous-totaux affichés ≠ somme des lignes affichées
- Constat : le tableau de donnees.html affiche « structures 67 » mais ses lignes affichées somment à 69 (classeur : 67,007), et « subventions 69 » contre 70 (classeur : 68,948) ; « fonctionnement 39 » contre 37,43 du classeur.
- Interprétation : chaque ligne est arrondie au Md€ séparément, le sous-total est arrondi indépendamment.
- Traitement : Documenté (groupe `eco236_arrondis_web`). `plan-flux.json › savings_table` fournit les valeurs du classeur (`md_par_an`, 6 décimales de précision source) et les valeurs web arrondies (`web_arrondi`, `web_md_ecart`). Utiliser le classeur pour tout graphique.

## D12 — Gain CSG/CRDS : 300 €/mois et 13 % contre 275,08 €/mois et 12,56 %
- Constat : au salaire net médian (2 190 €), le manifeste annonce « 300 € » et « +13 % » ; le classeur donne 275,08 €/mois (12,56 %). 13 % × 2 190 = 284,7 €. Au SMIC : 180 € (fiche) contre 171,72 € (SMIC 2025, 12,04 %), 173,74 € (01/2026) et 177,93 € (06/2026).
- Interprétation : le « 13 % » est un arrondi de 12,0 à 12,6 % ; l'écart de 300 € à 275 € n'est pas expliqué. Le classeur est la source de calcul.
- Traitement : Documenté (groupes `gain_csg_median`, `gain_csg_smic`). Les graphiques « mon gain » doivent partir des courbes du classeur (`plan-flux.json › csg_cas_types`) et non des annonces.

## D13 — « 600 € par mois » non vérifiable à partir du classeur
- Constat : « 600 € = 300 € de salaire net + 300 € d'épargne ». Le flux du classeur vers la capitalisation (121,749 Md€) représente ≈ 338 €/mois par foyer (30 M de foyers) ou ≈ 350 € par travailleur (29 M). Les lettres annoncent par ailleurs « 25 % » de hausse en trois ans.
- Interprétation : le montant dépend du dénominateur (D16) ; les sources ne donnent pas la décomposition par tête.
- Traitement : Documenté (groupe `restitution_600_eur`). Ne présenter « 300 € d'épargne » que comme annonce (tier `annonce`).

## D14 — Quatre impôts (manifeste) contre cinq impôts (lettres)
- Constat : « quatre impôts » (TVA, revenu, sociétés, foncier) dans le manifeste ; « 5 impôts au lieu de 438 » dans les lettres. L'amendement PLFSS n° 1 maintient en outre la CSG sur les pensions et le capital, et une taxe sur les salaires jusqu'en 2029.
- Interprétation : le 5e impôt n'est pas nommé dans les sources.
- Traitement : Documenté (groupe `nb_impots_cibles`). Aucune interprétation n'est imposée dans les données.

## D15 — Aide fondamentale au SMIC : 550 € brut contre ≈ 220 € net
- Constat : l'exposé de PLF-P1 n° 28 écrit que le salarié au SMIC « reçoit 550 € par mois de l'administration fiscale » (6 600 €/an brut) ; la fiche annonce « +220 € » ; le classeur (GraphIR) raisonne en net.
- Interprétation : brut contre net d'un impôt de 23 % sur le revenu : à l'aide de 6 600 € on retire 23 % du revenu (SMIC), soit ≈ 222 €/mois net au niveau du SMIC (hypothèse : revenu net imposable = salaire net ; sa définition après réforme n'est pas écrite, cf. D27). Le prélèvement de 23 % est vérifié sur les 73 points de la courbe.
- Traitement : Corrigé : `afu_smic_net_calc_eur_mois` (calcul, ≈ 222 €/mois) est distinct des deux annonces ; groupe `afu_smic`.

## D16 — Quatre « foyers » différents
- Constat : 30 M de foyers dans les fiches et dans « 600 Md€ soit 20 000 € par foyer » ; 29,507 M implicites dans « 236 Md€ soit 8 000 € par foyer » ; 30,959 M implicites dans « 1 671,794 Md€ soit 54 000 € par foyer » ; 40,2 M de foyers fiscaux dans l'exposé de PLF-P1 n° 28 (dont 18,5 M seulement imposés à l'impôt sur le revenu). L'aide fondamentale est versée par personne.
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

## D19 — APL : 5,4 Md€ (exposé) contre 8,068 Md€ (état B n° 1)
- Constat : l'exposé de PLF-P2 n° 32 chiffre l'économie 2027 de l'APL à 5,4 Md€ ; l'amendement n° 1 (état B) retire 8,068 Md€ de crédits de paiement du programme « Aide à l'accès au logement » (16,52 Md€) ; le classeur donne 5,4 Md€ en année 1 puis 10,7 Md€.
- Interprétation : non expliqué dans les sources (années, périmètre, ou crédits restants non reconduits).
- Traitement : Documenté (groupe `apl_economie_2027`). `credits-retires.json` utilise l'état B (8,068) comme valeur de loi.

## D20 — Niches : 79,5 contre 79,613 Md€ ; 143 contre 134,7 contre 89,4 Md€
- Constat : (a) l'exposé de PLF-P1 n° 1 cite 79,5 Md€ pour 2026 ; la somme des 465 lignes 2026 du classeur vaut 79,613 Md€ (ε et nc comptés pour 0). (b) 134,7 Md€ (486 niches et taux réduits, 2024), 89,406 Md€ (les 465 niches seules, 2024) et « 143 Md€ de niches supprimées » (fiche Contribuable).
- Interprétation : (b) 143 ≈ 72,3 + 18 + 53 de la feuille Flux (niches fiscales + niches sociales + autre gisement) : inférence ; ce périmètre inclut 18 Md€ de niches sociales hors des 486.
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

## D24 — État B : arrondi de 1 € sur les amendements n° 4, 5 et 13
- Constat : la somme des programmes dépasse le total publié de 1 € en autorisations d'engagement (n° 4, 5, 13) ; aucun écart en crédits de paiement.
- Interprétation : arrondi de la source.
- Traitement : Documenté. `credits-retires.json` exporte `ecart_somme_programmes_vs_total_eur` ; le total général (43 855,4 M€ AE, 39 905,0 M€ CP) correspond à l'annexe A de la source-analyse.

## D25 — GraphAFU : deux séries « Epargne retraite personnelle »
- Constat : lignes 29 et 30 portent le même libellé (20 064 € et 6 600 € à partir de 64 ans).
- Interprétation : sens non documenté dans le classeur (20 064 = 19 800 + 264 est un rapprochement du pipeline, non écrit dans le classeur).
- Traitement : Documenté. `lifecycle.json` les exporte séparément (`epargne_retraite_serie_1`, `epargne_retraite_serie_2`) et les exclut du total de flux annuels.

## D26 — Impôts : les lignes « dont » ne partitionnent pas toujours le poste
- Constat : taxes sur la consommation : 105,7 Md€ de détail contre 105,1 Md€ de poste (écart 0,6) ; taxes sur la main-d'œuvre : écart de −49,2 Md€.
- Interprétation : pour la consommation, le poste est « corrigé du bouclier tarifaire électricité » dans le classeur ; l'écart sur la main-d'œuvre n'est pas expliqué.
- Traitement : Documenté (`etat-partout.json › impots › recettes_2024 › children_note`). L'arbre n'additionne que les niveaux validés ; les lignes « à titre onéreux / gratuit » sont traitées en niveau 2 pour que le total (624,9) soit juste.

## D27 — Textes de loi : ambiguïtés juridiques
- Constat : (a) le « revenu net imposable » après réforme (déduction de 10 %, CSG) n'est pas défini ; (b) l'abrogation de 150 U-II-1° (exonération de la plus-value de résidence principale) découle de PLF-P1 n° 20 et n° 1 : inférence de la source-analyse ; (c) le calendrier de l'abattement de 10 % sur les pensions est déduit.
- Interprétation : aucune réécriture juridique n'est faite par le pipeline.
- Traitement : Documenté. Les provisions de calcul de l'impôt concernées sont sorties dans `niches.json › provisions_calcul_impot` et signalées ; les dates ne sont publiées que si la citation est vérifiée mot pour mot dans l'amendement.

## D28 — Pas de microsimulation de l'aide fondamentale
- Constat : coût brut 402,006 Md€ − retour d'impôt 135,346 Md€ = 266,66 Md€ net ; aucune répartition gagnants/perdants par décile n'est publiée.
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
- Interprétation : aucune liste individuelle n'existe dans les sources.
- Traitement : Documenté. `niches.json › meta › counts.taux_reduits_tva_hors_niches` et `taux_reduits_tva_hors_niches` n'ont que des agrégats ; ne pas inventer de lignes.

## D33 — Calendrier : CRDS mensuelle déduite, paliers de référence hypothétiques
- Constat : la trajectoire mensuelle CSG/CRDS (9,7 → 8,1 → 6,5 → 4,8 → 3,2 → 1,6 → 0 point) est vérifiée mot pour mot dans les amendements PLFSS n° 1 et 2 ; en revanche la part CRDS (0,5 = 9,7 − 9,2) est déduite par soustraction. Quatre paliers de départ ne sont pas écrits dans les amendements et ne servent qu'à compléter la courbe : taux de TVA actuel de l'alimentation (5,5 %, `tva_alimentation`), « avantage inchangé » en 2026 (`niches_agri_services_garde`, base 100), exonérations emploi à domicile avant le 1er juillet 2027 (`exonerations_emploi_domicile`), dotation forfaitaire 2026 (`dotation_forfaitaire_communes`).
- Interprétation : ces paliers décrivent la situation avant réforme ; ils sont déduits, pas cités.
- Traitement : Documenté : `trajectoires[].steps[].hypothesis: true` dans `calendrier.json` sur ces quatre paliers ; chacun porte une citation vérifiée du contexte, qui n'établit pas le chiffre de départ lui-même. Les autres paliers (dates et valeurs de la réforme) sont tous vérifiés verbatim. La trajectoire CSG/CRDS est aussi recoupée avec `research/reform_parameters.json` par `validate.py`.

## D34 — Niches éteintes fin 2025 : 1 278 contre 1 298,73 M€
- Constat : 1 278 M€ en réalisation 2024 (feuille Chiffrages Résolution) contre 1 298,73 M€ (Synthèse) ; avec la colonne « yc TVA APU » : 1 298,732 M€.
- Interprétation : la différence correspond à la TVA des administrations publiques (APU).
- Traitement : Documenté ; `niches.json` exporte les deux colonnes.

---

## Hors périmètre
- Nombre de pages du livre : 180 pages (LGDJ, librairies) contre 84 (Google Books, Eyrolles) ; une note de bas de page de l'amendement PLFSS cite « p. 141 », ce qui correspond à 180 pages. Non utilisé dans les données.
