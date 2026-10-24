# Données du site (`site/src/data/`)

Ces fichiers JSON sont **générés** par `pipeline/build.py` (seule exception, écrite à la main : `glossaire.json`, les définitions des sigles du site) (Python 3, bibliothèque standard seulement). Ne pas les modifier à la main : relancer le pipeline.

```sh
python3 -I pipeline/build.py              # reconstruit les 12 fichiers + manifest.json, puis valide
python3 -I pipeline/build.py --check      # reconstruit en mémoire, échoue si un fichier du disque diffère
python3 -I pipeline/validate.py           # rapport de validation seul (totaux, sources, citations, écarts)
```

Entrées (traitées comme des données non fiables, jamais exécutées) : `data/derived/csv/**` (7 classeurs exportés cellule par cellule), `data/derived/etat_b_credits_retires_plf2027.csv`, `research/pages/amendements__*.md` (liasses PLF-P1, PLF-P2, PLFSS, converties par `pdftotext -layout`), `research/pages/{manifeste,donnees,index,fiches*,lettres*}.md`, `research/reform_parameters.json` (recoupement uniquement, voir « Validation »).

Les écarts entre sources sont décrits dans `pipeline/DISCREPANCIES.md` (codes D01 à D34, cités par `validate.py`).

## Règles communes

| Sujet | Règle |
|---|---|
| Déterminisme | JSON à clés triées, indentation 1, UTF-8, sauts de ligne `\n`. Deux exécutions donnent les mêmes octets ; `manifest.json` contient le sha256 de chaque fichier. |
| Arrondis | Valeurs lues dans les classeurs : précision de la source, 6 décimales au plus, bruit binaire des flottants supprimé (arrondi « moitié vers le haut » via `Decimal`). Valeurs dérivées : Md€ à 3 décimales, pourcentages à 2 décimales, € par foyer à l'euro, € par jour au centime. L'arrondi d'affichage est l'affaire du site. |
| Valeurs absentes | `null` (jamais 0). Marqueurs de coût des niches (`ε`, `nc`, `-`) : `null` + `cost_flags`. |
| Unités | Chaque nœud ou fait porte son unité : `Md€`, `M€`, `k€`, `€`, `%`, ETPT, etc. Les noms de champ finissent par `_md`, `_meur`, `_eur`, `_pct` quand il y a un risque de confusion. |
| Provenance | Chaque fichier a un bloc `source` (classeur, feuille et plage de cellules, avec URL) ou `meta.source`. |
| Niveaux de fiabilité (`tier`) | `loi` : chiffre écrit dans un amendement (dispositif ou exposé sommaire). `annonce` : affirmation ou estimation des auteurs (manifeste, fiches, lettres, classeurs Résolution), sans texte de loi. `donnee` : statistique publiée par un tiers (Insee, Eurostat, DGAFP, Légifrance, documents du PLF). `calcul` : dérivé par le pipeline, avec formule et entrées. Les graphiques doivent distinguer visuellement ces niveaux. |
| Citations | Toute citation de site ou d'amendement est vérifiée **mot pour mot** (espaces et apostrophes normalisés) dans `research/pages/` au moment du build ; le build échoue sinon. |
| « Par foyer » | Le livre emploie plusieurs dénominateurs (voir ci-dessous). Chaque dérivé du pipeline dit lequel il utilise. |

### Les « foyers » du livre

| Usage | Foyers | Origine |
|---|---|---|
| Fiches, « 600 Md€ soit 20 000 € par foyer » | 30 M | fiches |
| « 236 Md€ soit 8 000 € par foyer » | 29,507 M implicites | 236,055 Md€ ÷ 8 000 € |
| « 54 000 € par foyer et par an » (dépenses publiques) | 30,959 M implicites | 1 671,794 Md€ ÷ 54 000 € |
| Exposé de PLF-P1 n° 28 | 40,2 M foyers fiscaux | loi (18,5 M payent l'impôt sur le revenu) |

Ne jamais comparer ou additionner deux montants « par foyer » de sources différentes.

## Fichiers

Tailles indicatives ; les nombres exacts d'enregistrements sont dans `manifest.json › files[].top_level_lists`.

### `facts.json` (411 faits, 232 Ko)

Dictionnaire `id → fait`, trié par `id`. Un fait est un chiffre cité quelque part sur le site.

```json
"dep_total_2024_md": {
  "value": 1671.794, "unit": "Md€", "year": 2024,
  "label_fr": "Dépenses des administrations publiques en 2024",
  "tier": "donnee",
  "source": { "kind": "insee", "ref": "Insee, … — repris dans Synthèse Graphiques Résolution_0910.xlsx › Graph1672Md › D50",
              "url": "https://www.insee.fr/…", "also": { "kind": "workbook", "ref": "… › D50", "url": "…" } },
  "note": "…"
}
```

| Champ | Contenu |
|---|---|
| `value` | nombre (un seul fait est du texte) ; jamais `null` |
| `unit`, `label_fr`, `year` | `year` peut être `null` (fait sans millésime) |
| `tier` | `loi`, `annonce`, `donnee`, `calcul` (voir plus haut) |
| `source.kind` | `workbook`, `amendment`, `site`, `insee`, `eurostat`, `dgafp`, `legifrance`, `calcul` |
| `source.ref`, `source.url` | référence lisible (feuille!cellule, n° d'amendement et page du PDF, page du site) et lien (`#page=N` pour les PDF) ; `url: null` pour un calcul |
| `source.quote` | citation vérifiée (sources `site` et `amendment`), avec `page` ou `liasse` + `number` |
| `source.also` | classeur qui reprend une statistique externe, avec la cellule |
| `source.inputs` | (calculs) ids des faits utilisés ; la formule est dans `note` et `source.ref` |
| `note` | précision d'interprétation, hypothèse, formule |
| `conflict`, `conflicts[]` | présents quand le chiffre diverge d'un autre : `conflicts[] = {group, with: [ids], note}` ; un fait peut appartenir à plusieurs groupes. Les deux valeurs sont conservées. |

Répartition : `annonce` 206, `donnee` 90, `calcul` 63, `loi` 52 ; 45 faits en conflit (17 groupes, voir `DISCREPANCIES.md`). Les réexpressions à échelle humaine (par foyer, par jour, par heure travaillée) sont des faits `calcul`, avec la formule et le dénominateur dans `note`.

### `depenses-cofog.json` — « Où vont les 1 672 Md€ »

Dépenses publiques 2024 par fonction (Insee, tableau 3.301), regroupées comme dans le graphique du livre.
- `tree` : hiérarchie récursive `children` (total → 6 groupes → 16 postes → sous-fonctions COFOG). Utilisation : `d3.hierarchy(tree).sum(d => d.children ? 0 : d.value_md)`. Chaque nœud : `id`, `label_fr`, `level`, `value_md`, `share_pct`, `eur_par_foyer_an`, `eur_par_foyer_jour` (base 54 000 € par foyer), `sheet_cell`.
- `flat` (90 lignes) : même arbre à plat (`parent_id`, `level`, `is_leaf`, `group_id`, `member_id`, `cofog_code`).
- `groups` (6), `cofog_divisions` (10), `cofog_subfunctions` (69), `unassigned_subfunctions` (01.5 pour 0,006 Md€ et 01.8 à 0), `checks` (sommes de recoupement), `meta`.
- Écarts : D01, D02, D03.

### `europe.json` — comparaisons européennes

30 pays + agrégats (zone euro EA19/EA20/EA21 et UE27), 2024 et 2025.
- `pays` (32 lignes larges : dépenses publiques/PIB, solde/PIB, revenu médian), `agregats` (4), et trois tables longues `depenses_publiques_pib`, `solde_public_pib`, `revenu_median_eur`, `revenu_median_spa` avec `rank_desc`, `rank_asc`, `is_france`, `is_euro_area_reference` (EA20), `missing`.
- `points_cles` : chiffres du manifeste (France, Finlande, Suisse).
- Codes pays Eurostat (`EL` = Grèce). Suisse 2025 : `null`.
- Écarts : D04 à D07.

### `etat-partout.json` — « L'État partout »

Sections : `ministeres` (35 avant, 7 après : 19 supprimés, 16 regroupés ; D29), `agences` (matrice de devenir des agences, vue d'ensemble), `impots` (`recettes_2024` : arbre des recettes, `taxes_affectees`), `revendications_manifeste` (12 affirmations chiffrées avec citation), `mots_de_loi` (nombre de mots de loi 2005–2026 par code et en total, `series_break_flags` en 2010 et 2012 ; D22), `effectifs_publics` (versants, statuts, postes fermés ; D21), `representation_democratique` (chaîne de 51 %), `niches` (résumé).

### `plan-flux.json` — « Le plan en flux »

- `savings_table` (26 lignes) : tableau des 236 Md€ (`md_par_an`, `gain_annee_1_md`, `gain_supp_annee_pleine_md`, `eur_par_foyer_an`, arbre par `parent_id`, valeurs arrondies du site dans `web_arrondi`).
- `sankey` : catégories (Annexe Manuscrit) → échéance (année 1 / année pleine) → destinations (`nodes`, `links`, `balanced`). `sankey_classeur` : feuille « Input Capitalisation » (114,46 salaire net + 121,749 capitalisation = 236,209). **Deux Sankeys distincts, ne pas les mélanger** (D08 à D10).
- `reconciliation` (3 définitions de « 236 »), `year_split`, `destinations`, `valeur_ajoutee_horaire` (63 € par heure : 29 + 11 + 23), `csg_cas_types` (gain CSG/CRDS par salaire), `flux_mesures` (feuille Flux), `afu_courbe` (73 points de revenu imposable 0–72 000 € avec impôt brut, versement net, revenu disponible, plus 5 cas ; `impot_brut_eur` exporté en positif, D31), `afu_economie`, `prelevements_obligatoires`, `savings_checks`.

### `niches.json` — 465 niches fiscales

- `niches` (465) : `id`, `label_fr`, `category` (une des 7 catégories : outre-mer > TVA > épargne > logement > ménages / entreprises selon les bénéficiaires > autre ; règle ordonnée, expressions régulières dans `pipeline/b_niches.py`, `category_tags` pour toutes les règles qui s'appliquent), `cost_2024_meur`, `cost_2025_meur`, `cost_2026_meur` (millions d'euros ; `null` + `cost_flags` pour ε / nc / -), `beneficiaries`, `dates`, `legal_ref`, `household_common` (47 niches « communes » à la plupart des ménages : liste éditoriale plus règle « Ménages ≥ 1 M de bénéficiaires », `household_common_reason`), `eteint_avant_2025`, `eteint_fin_2025`, `resolution` (chiffrage Résolution), etc.
- `provisions_calcul_impot` (81, hors des 465 : décote, plus-value de résidence principale, etc.), `taux_reduits_tva_hors_niches` (21 taux, agrégat seulement ; D32), `synthese` (par catégorie, par impôt, top 10, etc.), `meta.totals`.
- Total 2024 des 465 : 89 406 M€ ; avec les taux réduits : 134,7 Md€ pour 486. Écarts : D20, D30, D34.
- Fichier le plus gros (≈ 970 Ko) : à charger à la demande.

### `agences.json` — agences, opérateurs, commissions

`matrice_sorts` et `sorts_agences_etat` (1 104 agences d'État : 746 fermées dont 668 suppressions et 78 cessions, 55 internalisées dans un ministère, 303 maintenues en autonomie), `operateurs` (180 lignes, 434 entités), `operateurs_par_mission`, `operateurs_totaux`, `organismes_odac` (700), `organismes_odal_categories` (23 catégories, 23 264 organismes locaux non traités), `autorites_independantes` (24), `commissions` (324), `commissions_par_ministere`, `entites_dissoutes_loi` (337 personnes morales dissoutes par PLF-P2 n° 25, numérotées 1 à 337), `emplois_etat_rap_2024`, `effectifs_fpe_par_ministere_2023`, `missions_conservees`. Écarts : D17, D18.

### `credits-retires.json` — crédits retirés (état B, PLF 2027)

`missions` : 22 amendements d'état B (un par mission), chacun avec `ae_retirees_*`, `cp_retirees_*` (en €, M€ et Md€), `programmes` (57 au total), `effets` (dates), `part_du_total_cp_pct`, `rang_par_cp`, `ecart_somme_programmes_vs_total_eur`. Totaux : 43 855,4 M€ en autorisations d'engagement, 39 905,0 M€ en crédits de paiement (= annexe A de `research/source-analysis.md`). `meta` contient les totaux et les notes. Écarts : D19, D24.

### `calendrier.json` — calendrier 2027–2030

`events` (104, chronologiques, avec `date`, `precision`, `domain`, `amendments[]`, `source.quote` vérifiée, `in_timeline_2027_2030`), `jalons` (10 dates charnières), `trajectoires` (10 séries de paliers datés : CSG/CRDS mois par mois, TVA de l'alimentation, APL en conventionné, taxe sur les salaires, dons, niches, exonérations emploi à domicile, dotation forfaitaire, emplois de l'État ; chaque palier porte ses citations ; `hypothesis: true` pour un palier de départ non écrit dans la loi), `annonces_sans_date` (9). Écart : D33.

### `amendements.json` — les 81 amendements

`amendements` : `id` (ex. `PLF-P1-28`), `liasse` (PLF-P1 : 34, PLF-P2 : 39, PLFSS : 8), `number`, `title_fr`, `article_fr`, `lot_fr`, `theme` (13 thèmes, libellés dans `meta.themes`), `objet_expose_fr` (première phrase de l'exposé sommaire, reprise telle quelle), `resume_fr` (résumé neutre en une phrase, rédigé d'après l'exposé et le dispositif ; textes dans `pipeline/curated_amendements.py` pour 59 amendements, générés par `pipeline/b_amendements.py` pour les 22 de l'état B), `dates[]` (143 effets datés, chacun vérifié dans le texte ; `precision` : `jour`, `annee` ou `approx`), `effective_from`, `effective_to`, `pdf_page`, `pdf_url` (ouvre la bonne page), `docx_url`, `tier: "loi"`.

### `fiches.json` — 18 fiches « Et moi, dans tout ça ? »

`fiches` : `slug`, `title_fr`, `group_fr`, `tagline_fr`, `header_fr`, `header_population` et `population_fact_id`, `gains[]` (`headline_fr`, `text_fr`, `sub_items_fr`, `figure` si un chiffre est lisible), `pertes[]`, `comme_chacun_fr`, `header_counts`, `header_vs_listed` (comptes de l'en-tête et éléments listés ; D23), `url`, `tier: "annonce"`.

### `lifecycle.json` — solidarité au fil de la vie

Âges 0 à 85, 7 séries annuelles (€ par an et par personne) de la feuille GraphAFU : aide fondamentale (3 300 jusqu'à 17 ans, 6 600 ensuite), compte éducation, part contributive de retraite, rendement du patrimoine, part d'aide handicap, deux séries « épargne retraite personnelle » (D25). Formes : `series` (métadonnées), `records` (321 enregistrements longs `age` / `series_id` / `value_eur_an`), `by_age` (86 lignes larges avec `total_flux_annuels_eur_an`, somme des cinq séries de flux, sans les deux séries d'épargne). Seule l'aide fondamentale (et sa majoration) a une base légale (PLF-P1 n° 28).

### `manifest.json`

`files[nom] = {bytes, sha256, top_level_lists}` pour les 12 fichiers de données.

## Hypothèses et interprétations du pipeline

Toutes sont signalées dans les données et dans `DISCREPANCIES.md` :
- Référence « zone euro » = EA20 (D07).
- Catégorie de chaque niche = première règle applicable (outre-mer > TVA > épargne > logement > ménages ou entreprises > autre) ; `household_common` = liste éditoriale ou « Ménages » avec au moins 1 000 000 de bénéficiaires.
- Rattachement COFOG des postes « Administrations » et « Éducation » déduit de l'arithmétique (D03) ; regroupement des ministères en 7 blocs déduit de la mise en page (D29).
- Réexpressions « par foyer » : dénominateur indiqué dans chaque fait `calcul`.
- Aucune valeur n'est inventée : toute valeur manquante reste `null`, tout total non publié est un `calcul` avec ses entrées.

## Validation (`pipeline/validate.py`)

Le rapport vérifie notamment : somme des enfants = parent pour les arbres (COFOG, 236 Md€, impôts, effectifs) ; Sankeys équilibrés (entrée = sortie) ; 465 niches, total 2024 = 89 406 M€ ; 22 amendements d'état B et totaux de l'annexe A ; 81 amendements, 143 dates et toutes les citations vérifiées dans le texte ; cohérence entre fichiers ; recoupement indépendant des cellules de classeur citées par les faits ; recoupement de 19 paramètres et de la trajectoire CSG/CRDS avec `research/reform_parameters.json` ; empreintes du manifeste ; reconstruction identique à celle du disque. Les `WARN [Dxx]` sont des écarts **des sources**, documentés ; seul un `FAIL` fait échouer le build.
