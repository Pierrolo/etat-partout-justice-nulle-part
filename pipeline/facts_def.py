"""Definition of every public figure of the site (facts.json).

Sections: A dépenses publiques · B Europe · C prélèvements · D l'État partout · E le plan (236 Md€,
CSG, aide fondamentale, épargne, actifs) · F paramètres légaux · G fiches · H reframings · I conflits.
"""
from __future__ import annotations

from facts_core import (DGAFP, EUROSTAT, INSEE_3217, INSEE_3301, INSEE_PATRIMOINE, LEGIFRANCE, PLF_DEPENSES_FISCALES, Facts)
from lib import Sheet, clean, quote_in
import b_credits
import b_niches
import b_plan

G = "graphiques"
C = "chiffres"
EM = "emplois"  # Emplois publics.xlsx
AG = "agences"  # Agences publiques.xlsx


def build_facts() -> Facts:
    F = Facts()
    _a_depenses(F)
    _b_europe(F)
    _c_prelevements(F)
    _d_etat_partout(F)
    _e_plan(F)
    _f_loi(F)
    _g_fiches(F)
    _h_reframings(F)
    _i_conflicts(F)
    return F


# ======================================================================================
# A. dépenses publiques (Insee 3.301, 2024)
# ======================================================================================
def _a_depenses(F: Facts):
    ins = dict(kind="insee", url=INSEE_3301, ref_prefix="Insee, comptes nationaux, tableau 3.301 (COFOG, 2024)")
    F.wb("dep_total_2024_md", G, "Graph1672Md", "D50", "Md€", "Dépenses des administrations publiques en 2024", 2024, "donnee", expect=1671.794, nd=3, **ins,
         note="Total COFOG de l'Insee (tableau 3.301). Le titre du graphique du livre : « 1 672 Md€ ».")
    members = [
        ("defense", "Défense", 29), ("interieur", "Intérieur (police, sécurité civile)", 30), ("justice", "Justice", 31),
        ("administrations", "Administrations", 32), ("infrastructures", "Infrastructures", 33), ("environnement", "Environnement", 34),
        ("education", "Éducation", 35), ("recherche", "Recherche fondamentale", 36), ("aides_sociales", "Aides sociales", 37),
        ("sante", "Santé", 38), ("retraites", "Retraites", 39), ("chomage", "Allocations chômage", 40),
        ("subventions_eco", "Subventions économiques", 41), ("logement", "Aides au logement", 42), ("loisirs_culture", "Loisirs, culture", 43),
        ("charge_dette", "Charge de la dette", 44),
    ]
    for mid, label, row in members:
        F.wb(f"dep_{mid}_2024_md", G, "Graph1672Md", f"D{row}", "Md€", f"Dépenses publiques 2024 : {label}", 2024, "donnee", nd=3, **ins,
             note="Regroupement du livre (graphique « 1 672 Md€ ») ; mapping vers les sous-fonctions COFOG dans depenses-cofog.json.")
    # COFOG division 09 « Enseignement » as published by the Insee (the book's « Éducation » leaves out 09.6, « services
    # annexes à l'enseignement », counted in its « Administrations »)
    F.wb("dep_cofog09_enseignement_2024_md", G, "Graph1672Md", "D111", "Md€", "Dépenses publiques 2024 : Enseignement (division COFOG 09 de l'Insee)", 2024, "donnee",
         expect=148.64, nd=3, **ins,
         note="Fonction « Enseignement » entière (division 09 de la COFOG), services annexes compris (cantine, transport et internat scolaires : 20,0 Md€). Le regroupement « Éducation » du livre (128,6 Md€) les compte dans « Administrations ».")
    groups = [
        ("securite", "Sécurité (défense, intérieur, justice)", ["defense", "interieur", "justice"]),
        ("depenses_collectives", "Dépenses collectives (administrations, infrastructures, environnement)", ["administrations", "infrastructures", "environnement"]),
        ("enseignement_recherche", "Enseignement et recherche", ["education", "recherche"]),
        ("secu_solidarite", "Sécurité sociale et solidarité (aides sociales, santé, retraites, chômage)", ["aides_sociales", "sante", "retraites", "chomage"]),
        ("soutiens_sectoriels", "Soutiens sectoriels (subventions économiques, logement, culture)", ["subventions_eco", "logement", "loisirs_culture"]),
    ]
    for gid, label, mem in groups:
        ids = [f"dep_{m}_2024_md" for m in mem]
        F.calc(f"dep_groupe_{gid}_2024_md", ids, lambda *x: sum(x), "Md€", f"Dépenses publiques 2024 : {label}", 2024, " + ".join(ids), nd=3,
               note="Le graphique du livre n'affiche que le total arrondi dans le libellé du groupe (106, 181, 149, 933, 244).")
    F.calc("dep_part_securite_pct", ["dep_groupe_securite_2024_md", "dep_total_2024_md"], lambda a, b: a / b * 100, "%",
           "Part de la défense, de la police et de la justice dans la dépense publique", 2024, "dep_groupe_securite_2024_md ÷ dep_total_2024_md × 100", nd=2,
           note="6,36 % ; le manifeste arrondit à 6 %.")
    F.site("dep_part_regalien_manifeste_pct", 6, "%", "« Défense, police et justice ne reçoivent aujourd'hui que 6 % des dépenses publiques »", 2026, "manifeste",
           "ne reçoivent aujourd’hui que 6 % des dépenses publiques")
    F.site("dep_par_foyer_manifeste_eur", 54000, "€ par foyer et par an", "« L'État dépense 54 000 euros par foyer et par an, record mondial »", 2026, "manifeste",
           "L’État dépense 54 000 euros par foyer et par an", note="Le manifeste ne dit pas quelle année ni quelle définition du foyer ; voir le groupe de conflit « foyer_denominateurs ».")
    F.site("dep_prise_sur_revenus_manifeste", "plus de la moitié", "texte", "« il prend plus de la moitié de ce que nous gagnons »", 2026, "manifeste",
           "il prend plus de la moitié de ce que nous gagnons")
    F.calc("foyers_implicites_dep_m", ["dep_total_2024_md", "dep_par_foyer_manifeste_eur"], lambda t, p: t * 1000 / p, "millions de foyers",
           "Nombre de foyers implicite du chiffre « 54 000 € par foyer »", 2024, "dep_total_2024_md × 1 000 ÷ dep_par_foyer_manifeste_eur", nd=3,
           note="Dénominateur utilisé par le manifeste pour ce chiffre (1 671,794 Md€ ÷ 54 000 €).")
    F.calc("dep_par_foyer_mois_eur", ["dep_par_foyer_manifeste_eur"], lambda x: x / 12, "€ par foyer et par mois", "Dépense publique par foyer et par mois", 2024,
           "dep_par_foyer_manifeste_eur ÷ 12", nd=0, note="Dénominateur : 30,96 M de foyers implicites (celui du manifeste pour les 54 000 €).")
    F.calc("dep_par_foyer_jour_eur", ["dep_par_foyer_manifeste_eur"], lambda x: x / 365, "€ par foyer et par jour", "Dépense publique par foyer et par jour", 2024,
           "dep_par_foyer_manifeste_eur ÷ 365", nd=2, note="Dénominateur : 30,96 M de foyers implicites (celui du manifeste pour les 54 000 €) ; ≈ 148 €.")
    F.calc("dep_par_foyer_heure_eur", ["dep_par_foyer_manifeste_eur"], lambda x: x / 365 / 24, "€ par foyer et par heure", "Dépense publique par foyer et par heure", 2024,
           "dep_par_foyer_manifeste_eur ÷ 365 ÷ 24", nd=2, note="Dénominateur : 30,96 M de foyers implicites.")
    # per-foyer value of the main items (denominator 54 000)
    lab = dict((m[0], m[1]) for m in members)
    for mid in ("retraites", "sante", "aides_sociales", "chomage", "subventions_eco", "education", "defense", "interieur", "justice", "charge_dette"):
        F.calc(f"dep_{mid}_par_foyer_eur", [f"dep_{mid}_2024_md", "dep_total_2024_md", "dep_par_foyer_manifeste_eur"], lambda v, t, p: v / t * p, "€ par foyer et par an",
               f"Dépenses publiques 2024 par foyer : {lab[mid]}", 2024, f"dep_{mid}_2024_md ÷ dep_total_2024_md × dep_par_foyer_manifeste_eur", nd=0,
               note="Dénominateur implicite de 54 000 € par foyer (30,96 M de foyers).")


# ======================================================================================
# B. Europe
# ======================================================================================
def _b_europe(F: Facts):
    """Eurostat, vintage of 21 October 2026 (data/eurostat/, see eurostat.py); the workbook cell the book used
    is kept as `source.also` with its own (older) value."""
    import eurostat

    def es(id, key, geo, year, sheet, cell, unit, label, expect, nd, wb_expect):
        ds = eurostat.dataset_of(key)
        names = {
            "tec00023": "Eurostat tec00023, dépenses des administrations publiques, % du PIB",
            "tec00127": "Eurostat tec00127, capacité (+) / besoin (−) de financement, % du PIB",
            "ilc_di03": "Eurostat ilc_di03, revenu médian équivalent (enquête SILC 2024, revenus 2023)",
        }
        v = eurostat.value(key, geo, year)
        assert v is not None and abs(v - expect) < 1e-6, (id, v, expect)
        sh = Sheet.get(G, sheet)
        wbv = clean(sh.num(cell), 6)
        assert abs(wbv - wb_expect) < 1e-6, (id, wbv, wb_expect)
        src = {"kind": "eurostat", "ref": f"{names[ds]} (mise à jour du {eurostat.vintage_fr(ds)})", "url": EUROSTAT[ds],
               "snapshot": eurostat.snapshot_ref(key, geo, year),
               "also": {"kind": "workbook", "ref": sh.ref(cell), "url": sh.source(cell)["url"], "value": wbv}}
        note = None if abs(wbv - v) < 1e-6 else f"Le classeur des auteurs (millésime antérieur) donne {str(wbv).replace('.', ',')}."
        return F.add(id, clean(v, nd), unit, label, year, src, "donnee", note)

    es("eu_dep_pib_fr_2024_pct", "tec00023", "FR", 2024, "GraphGov", "B10", "% du PIB", "Dépenses publiques de la France en 2024", expect=57.0, nd=1, wb_expect=57.0)
    es("eu_dep_pib_fr_2025_pct", "tec00023", "FR", 2025, "GraphGov", "C10", "% du PIB", "Dépenses publiques de la France en 2025", expect=57.3, nd=1, wb_expect=57.2)
    es("eu_dep_pib_fi_2024_pct", "tec00023", "FI", 2024, "GraphGov", "B9", "% du PIB", "Dépenses publiques de la Finlande en 2024", expect=57.9, nd=1, wb_expect=57.7)
    es("eu_dep_pib_fi_2025_pct", "tec00023", "FI", 2025, "GraphGov", "C9", "% du PIB", "Dépenses publiques de la Finlande en 2025", expect=57.5, nd=1, wb_expect=57.5)
    es("eu_dep_pib_ea20_2024_pct", "tec00023", "EA20", 2024, "GraphGov", "B16", "% du PIB", "Dépenses publiques de la zone euro (20 pays) en 2024", expect=49.3, nd=1, wb_expect=49.4)
    es("eu_dep_pib_ea20_2025_pct", "tec00023", "EA20", 2025, "GraphGov", "C16", "% du PIB", "Dépenses publiques de la zone euro (20 pays) en 2025", expect=49.8, nd=1, wb_expect=49.8)
    es("eu_dep_pib_de_2024_pct", "tec00023", "DE", 2024, "GraphGov", "B18", "% du PIB", "Dépenses publiques de l'Allemagne en 2024", expect=49.0, nd=1, wb_expect=49.4)
    es("eu_dep_pib_de_2025_pct", "tec00023", "DE", 2025, "GraphGov", "C18", "% du PIB", "Dépenses publiques de l'Allemagne en 2025", expect=50.1, nd=1, wb_expect=50.5)
    es("eu_dep_pib_ch_2024_pct", "tec00023", "CH", 2024, "GraphGov", "B41", "% du PIB", "Dépenses publiques de la Suisse en 2024", expect=32.8, nd=1, wb_expect=33.6)
    es("eu_dep_pib_ie_2024_pct", "tec00023", "IE", 2024, "GraphGov", "B42", "% du PIB", "Dépenses publiques de l'Irlande en 2024", expect=22.4, nd=1, wb_expect=22.3)
    F.calc("eu_dep_pib_ecart_fr_ea20_2024_pts", ["eu_dep_pib_fr_2024_pct", "eu_dep_pib_ea20_2024_pct"], lambda a, b: a - b, "points de PIB",
           "Écart de dépenses publiques entre la France et la zone euro en 2024", 2024, "eu_dep_pib_fr_2024_pct − eu_dep_pib_ea20_2024_pct", nd=1)
    import b_europe
    rk = b_europe.build()["points_cles"]["france_rang_depenses_2024"]
    F.calc_value("eu_dep_rang_fr_2024", rk, ["eu_dep_pib_fr_2024_pct", "eu_dep_pib_fi_2024_pct"], "rang sur 30 pays",
                 "Rang de la France pour les dépenses publiques (% du PIB) en 2024, parmi les 30 pays de la table", 2024,
                 "classement décroissant des 30 pays de GraphGov!B9:B42 (hors agrégats)",
                 note="La Finlande est première en 2024 (57,9 %) et en 2025 (57,5 %) ; la France est deuxième (Eurostat, mise à jour du 21 octobre 2026).")
    es("eu_deficit_fr_2024_pct", "tec00127", "FR", 2024, "GraphGov", "B52", "% du PIB", "Solde public de la France en 2024 (déficit)", expect=-5.8, nd=1, wb_expect=-5.8)
    es("eu_deficit_fr_2025_pct", "tec00127", "FR", 2025, "GraphGov", "C52", "% du PIB", "Solde public de la France en 2025 (déficit)", expect=-5.1, nd=1, wb_expect=-5.1)
    es("eu_deficit_ea20_2024_pct", "tec00127", "EA20", 2024, "GraphGov", "B64", "% du PIB", "Solde public de la zone euro (20 pays) en 2024", expect=-3.0, nd=1, wb_expect=-3.0)
    es("eu_deficit_ea20_2025_pct", "tec00127", "EA20", 2025, "GraphGov", "C64", "% du PIB", "Solde public de la zone euro (20 pays) en 2025", expect=-3.0, nd=1, wb_expect=-2.9)
    es("eu_deficit_de_2024_pct", "tec00127", "DE", 2024, "GraphGov", "B67", "% du PIB", "Solde public de l'Allemagne en 2024", expect=-2.7, nd=1, wb_expect=-2.7)
    es("eu_revenu_median_fr_eur", "ilc_di03_eur", "FR", 2024, "GraphRDB", "B28", "€ par an", "Revenu médian équivalent en France", expect=25557, nd=0, wb_expect=25557)
    es("eu_revenu_median_ch_eur", "ilc_di03_eur", "CH", 2024, "GraphRDB", "B39", "€ par an", "Revenu médian équivalent en Suisse", expect=51926, nd=0, wb_expect=51926)
    es("eu_revenu_median_lu_eur", "ilc_di03_eur", "LU", 2024, "GraphRDB", "B38", "€ par an", "Revenu médian équivalent au Luxembourg", expect=50799, nd=0, wb_expect=50799)
    es("eu_revenu_median_ea20_eur", "ilc_di03_eur", "EA20", 2024, "GraphRDB", "B27", "€ par an", "Revenu médian équivalent, zone euro (20 pays)", expect=23767, nd=0, wb_expect=23767)
    es("eu_revenu_median_eu27_eur", "ilc_di03_eur", "EU27_2020", 2024, "GraphRDB", "B26", "€ par an", "Revenu médian équivalent, Union européenne (27 pays)", expect=21582, nd=0, wb_expect=21582)
    es("eu_revenu_median_fr_spa", "ilc_di03_pps", "FR", 2024, "GraphRDB", "B56", "SPA par an", "Revenu médian équivalent en France, en standards de pouvoir d'achat", expect=23222, nd=0, wb_expect=23222)
    es("eu_revenu_median_ch_spa", "ilc_di03_pps", "CH", 2024, "GraphRDB", "B48", "SPA par an", "Revenu médian équivalent en Suisse, en standards de pouvoir d'achat", expect=29828, nd=0, wb_expect=29828)
    es("eu_revenu_median_lu_spa", "ilc_di03_pps", "LU", 2024, "GraphRDB", "B46", "SPA par an", "Revenu médian équivalent au Luxembourg, en standards de pouvoir d'achat", expect=37781, nd=0, wb_expect=37781)
    F.calc("eu_revenu_median_fr_mois_eur", ["eu_revenu_median_fr_eur"], lambda x: x / 12, "€ par mois", "Revenu médian équivalent en France par mois", 2024, "eu_revenu_median_fr_eur ÷ 12", nd=2)
    F.calc("eu_revenu_median_ch_mois_eur", ["eu_revenu_median_ch_eur"], lambda x: x / 12, "€ par mois", "Revenu médian équivalent en Suisse par mois", 2024, "eu_revenu_median_ch_eur ÷ 12", nd=2)
    F.calc("eu_revenu_median_ratio_ch_fr", ["eu_revenu_median_ch_eur", "eu_revenu_median_fr_eur"], lambda a, b: a / b, "ratio", "Revenu médian suisse rapporté au revenu médian français (euros courants)", 2024,
           "eu_revenu_median_ch_eur ÷ eu_revenu_median_fr_eur", nd=3)
    F.calc("eu_revenu_median_ratio_ch_fr_spa", ["eu_revenu_median_ch_spa", "eu_revenu_median_fr_spa"], lambda a, b: a / b, "ratio", "Revenu médian suisse rapporté au revenu médian français (pouvoir d'achat)", 2024,
           "eu_revenu_median_ch_spa ÷ eu_revenu_median_fr_spa", nd=3,
           note="En standards de pouvoir d'achat l'écart est bien plus faible (1,28) qu'en euros courants (2,03) : le manifeste compare des euros courants.")
    F.site("eu_revenu_median_fr_manifeste_mois", 2100, "€ par mois", "« Le revenu médian est de 2 100 euros par mois en France »", 2026, "manifeste",
           "Le revenu médian est de 2 100 euros par mois en France", note="25 557 € ÷ 12 = 2 129,75 € : arrondi par le manifeste.")
    F.site("eu_revenu_median_ch_manifeste_mois", 4300, "€ par mois", "« … contre 4 300 en Suisse »", 2026, "manifeste", "contre 4 300 en Suisse",
           note="51 926 € ÷ 12 = 4 327,17 € : arrondi par le manifeste.")


# ======================================================================================
# C. prélèvements obligatoires
# ======================================================================================
def _c_prelevements(F: Facts):
    # The workbook's PIB is the May-2025 edition of the national accounts; its PO total (1 251,8 Md€, 42,87 %) is in
    # neither the May-2025 nor the May-2026 edition: sourced to the authors' workbook, with the Insee figures beside.
    F.wb("po_pib_2024_md", C, "Refonte_fiscalit", "C3", "Md€", "PIB 2024", 2024, "donnee", expect=2919.9, nd=1,
         note="PIB 2024 de l'édition de mai 2025 des comptes nationaux de l'Insee, repris par le classeur des auteurs ; l'édition de mai 2026 le porte à 2 935,2 Md€ (fait pib_2024_insee_2026_md).")
    F.wb("po_2024_md", C, "Refonte_fiscalit", "F3", "Md€", "Prélèvements obligatoires 2024", 2024, "donnee", expect=1251.8, nd=1,
         note="Valeur du classeur des auteurs, de millésime non précisé. L'édition de mai 2026 des comptes nationaux de l'Insee (tableau 3.217) donne 1 254,0 Md€, soit 42,7 % du PIB.")
    F.wb("po_pib_2024_pct", C, "Refonte_fiscalit", "E3", "% du PIB", "Taux de prélèvements obligatoires 2024", 2024, "donnee", scale=100, nd=6,
         note="42,87 % : valeur du classeur des auteurs, de millésime non précisé. L'édition de mai 2026 des comptes nationaux de l'Insee donne 42,7 % (1 254,0 Md€ pour un PIB de 2 935,2 Md€).")
    import eurostat
    gdp = eurostat.value("nama_10_gdp", "FR", 2024)
    assert gdp is not None and abs(gdp - 2935236.2) < 1e-6, gdp
    F.add("pib_2024_insee_2026_md", clean(gdp / 1000, 1), "Md€", "PIB 2024 (Insee, édition de mai 2026)", 2024,
          {"kind": "eurostat", "ref": f"Eurostat nama_10_gdp (PIB aux prix courants, France), mise à jour du {eurostat.vintage_fr('nama_10_gdp')}, qui reprend l'édition de mai 2026 des comptes nationaux de l'Insee",
           "url": "https://ec.europa.eu/eurostat/databrowser/view/nama_10_gdp/default/table", "snapshot": eurostat.snapshot_ref("nama_10_gdp", "FR", 2024), "scale": 0.001},
          "donnee")
    F.wb("po_pib_cible_pct", C, "Refonte_fiscalit", "E4", "% du PIB", "Taux de prélèvements obligatoires cible du plan", None, "annonce", scale=100, nd=6, note="36,33 % : cible calculée par Résolution (schéma PO Résolution).")
    F.wb("po_cible_md", C, "Refonte_fiscalit", "F4", "Md€", "Prélèvements obligatoires cible du plan (sur le PIB 2024)", None, "annonce", nd=5)
    F.calc("po_baisse_pts", ["po_pib_2024_pct", "po_pib_cible_pct"], lambda a, b: a - b, "points de PIB", "Baisse du taux de prélèvements obligatoires visée", None,
           "po_pib_2024_pct − po_pib_cible_pct", nd=2)
    F.calc("po_baisse_md", ["po_2024_md", "po_cible_md"], lambda a, b: a - b, "Md€", "Baisse des prélèvements obligatoires visée (sur le PIB 2024)", None, "po_2024_md − po_cible_md", nd=3)
    F.site("po_actuel_fiche_pct", 43, "% du PIB", "« 36 % de la richesse produite, contre 43 % aujourd'hui » (fiche Contribuable) : niveau actuel", 2026, "fiches__contribuable", "De la richesse produite, contre 43 % aujourd'hui")
    F.site("po_cible_fiche_pct", 36, "% du PIB", "« 36 % de la richesse produite… » (fiche Contribuable) : cible", 2026, "fiches__contribuable", "**36 %** : De la richesse produite")
    F.calc("dep_pib_insee_calc_pct", ["dep_total_2024_md", "po_pib_2024_md"], lambda a, b: a / b * 100, "% du PIB", "Dépenses publiques COFOG 2024 rapportées au PIB 2024 (Insee)", 2024,
           "dep_total_2024_md ÷ po_pib_2024_md × 100", nd=2,
           note="57,26 % avec le total COFOG Insee (1 671,794 Md€) et le PIB 2024 du classeur (2 919,9 Md€, feuille « Refonte fiscalité », cellule C3), contre 57,0 % pour Eurostat (tec00023). Avec la même dépense, 57,0 % correspond à un PIB d'environ 2 933 Md€, soit 13 Md€ (0,4 %) de plus que celui du classeur : l'écart vient du PIB pris au dénominateur, pas de la dépense.")


# ======================================================================================
# D. l'État partout
# ======================================================================================
def _d_etat_partout(F: Facts):
    a = "GraphAgences"
    F.wb("etat_ministeres_avant", G, a, "B47", "ministères", "Ministères aujourd'hui", 2026, "annonce", expect=35, nd=0, note="Inclut les ministres délégués ; 19 supprimés sans successeur et 16 regroupés en 7 (voir etat-partout.json).")
    F.wb("etat_ministeres_apres", G, a, "B49", "ministères", "Ministères conservés par le plan", None, "annonce", expect=7, nd=0)
    F.wb("etat_ministeres_supprimes", G, a, "B48", "ministères", "Ministères supprimés (en nombre net)", None, "annonce", expect=28, nd=0)
    ag = "Synth_se_agences_R"
    F.wb("agences_etat_avant", G, a, "B26", "agences", "Agences nationales aujourd'hui", 2023, "annonce", expect=1104, nd=0,
         note="434 opérateurs PLF + 328 organismes hors PLF + 24 autorités indépendantes + 318 commissions.")
    F.wb("agences_fermees", G, a, "B28", "agences", "Agences nationales supprimées ou cédées", None, "annonce", expect=746, nd=0, note="78 cessions d'actif + 668 suppressions.")
    F.wb("agences_cession", AG, ag, "E5", "agences", "Agences nationales : cessions d'actif", None, "annonce", expect=78, nd=0)
    F.wb("agences_suppression", AG, ag, "F5", "agences", "Agences nationales : suppressions", None, "annonce", expect=668, nd=0)
    F.wb("agences_internalisation", G, a, "B29", "agences", "Agences nationales internalisées dans un ministère", None, "annonce", expect=55, nd=0)
    F.wb("agences_epic_musees", G, a, "B32", "agences", "Agences nationales maintenues : EPIC musées et patrimoine", None, "annonce", expect=40, nd=0)
    F.wb("agences_epic_enseignement", G, a, "B33", "agences", "Agences nationales maintenues : EPIC universités et recherche", None, "annonce", expect=258, nd=0)
    F.wb("agences_autorites_independantes", G, a, "B31", "agences", "Agences nationales maintenues : autorités indépendantes", None, "annonce", expect=5, nd=0)
    F.calc("agences_etat_apres", ["agences_epic_musees", "agences_epic_enseignement", "agences_autorites_independantes"], lambda *x: sum(x), "agences", "Agences nationales après réforme", None,
           "40 + 258 + 5", nd=0, note="Le manifeste écrit « 303 agences nationales au lieu de 1 104 ».")
    F.site("agences_apres_manifeste", 303, "agences", "« 303 agences nationales au lieu de 1 104 »", 2026, "manifeste", "303 agences nationales au lieu de 1 104")
    F.wb("agences_operateurs_plf", AG, ag, "D6", "organismes", "Opérateurs de l'État (PLF)", 2023, "donnee", expect=434, nd=0, note="Le PLF 2026 en liste 434 ; l'exposé de PLF-P2 n° 25 en cite 431.")
    F.wb("agences_hors_plf", AG, ag, "D7", "organismes", "Organismes hors PLF (ODAC non opérateurs)", 2023, "donnee", expect=328, nd=0)
    F.wb("agences_autorites_total", AG, ag, "D8", "organismes", "Autorités administratives et publiques indépendantes", 2023, "donnee", expect=24, nd=0)
    F.wb("agences_commissions_matrice", AG, ag, "D9", "organismes", "Commissions et instances consultatives (matrice)", 2023, "donnee", expect=318, nd=0)
    F.wb("agences_locales", AG, ag, "D10", "organismes", "Organismes locaux (ODAL, hors agences et offices de l'eau et sociétés de grands projets déjà comptés)", 2023, "annonce", expect=23264, nd=0,
         note="Compte des auteurs (feuille « Synthèse agences R », construite sur la liste ODAL de l'Insee avec leur classement) : même classeur et même statut que les 1 104 agences et le total de 24 368.")
    F.wb("agences_total_avec_locales", AG, ag, "D12", "organismes", "Total des agences, nationales et locales", 2023, "annonce", expect=24368, nd=0)
    F.wb("agences_locales_suppression", AG, ag, "F10", "organismes", "Organismes locaux : suppressions", None, "annonce", expect=13481, nd=0)
    F.wb("agences_locales_epic_enseignement", AG, ag, "I10", "organismes", "Organismes locaux maintenus : EPIC enseignement et recherche", None, "annonce", expect=9140, nd=0)
    F.amend("agences_operateurs_loi", 431, "opérateurs", "Opérateurs de l'État cités par l'exposé de PLF-P2 n° 25", 2026, "PLF-P2", 25, "431 opérateurs", tier="loi",
            note="Le classeur en compte 434 (somme de la colonne « Nb/cat. » de ses 180 lignes) ; 433 est le chiffre cité par la source-analyse du dépôt, pas une somme des lignes du classeur.")
    n_dissous = len(b_agences_list())
    F.amend("agences_dissoutes_loi", n_dissous, "personnes morales", "Entités dissoutes au 1er juillet 2027 par PLF-P2 n° 25 (liste nominative)", 2027, "PLF-P2", 25,
            "Sont dissoutes en application du A du I les personnes morales suivantes", tier="loi",
            note="Périmètre différent des 746 fermetures du livre : 337 personnes morales nommées dans l'amendement. Aucune table de correspondance entre les deux listes n'est publiée.")
    F.wb("operateurs_etpt_lfi_2025", AG, "Op_rateurs_R", "G4", "ETPT", "Emplois (ETPT) des opérateurs, LFI 2025", 2025, "donnee", expect=479514, nd=0)
    F.wb("operateurs_etpt_plf_2026", AG, "Op_rateurs_R", "J4", "ETPT", "Emplois (ETPT) des opérateurs, PLF 2026", 2026, "donnee", expect=478026, nd=0)
    F.wb("operateurs_etpt_plf_2026_sous_plafond", AG, "Op_rateurs_R", "K4", "ETPT", "Emplois (ETPT) des opérateurs sous plafond, PLF 2026", 2026, "donnee", expect=401310, nd=0)
    # taxes
    F.site("impots_nombre_manifeste", 438, "impôts", "« 438 impôts »", 2026, "manifeste", "438 impôts", note="Aucune liste des 438 impôts dans les données publiées.")
    F.site("impots_nombre_graphique_fusion", 434, "prélèvements", "« 434 prélèvements aujourd'hui, 4 grands impôts demain » (page graphique « Fusion des impôts »)", 2026, "graphiques__fusion-des-impots",
           "434 prélèvements aujourd’hui, 4 grands impôts demain",
           note="Titre du graphique de la page graphiques/fusion-des-impots.html, publiée en novembre 2026 ; le manifeste, la page « Propositions » et les fiches disent « 438 ». La source ne dit pas quels prélèvements font la différence.")
    F.site("niches_nombre_manifeste", 486, "niches fiscales", "« 486 niches fiscales »", 2026, "manifeste", "486 niches fiscales")
    F.site("cerfa_nombre_manifeste", 2000, "formulaires", "« 2 000 CERFA »", 2026, "manifeste", "2 000 CERFA", note="Ordre de grandeur du manifeste ; aucun jeu de données n'accompagne ce chiffre.")
    F.site("charges_sociales_combinaisons_manifeste", 1.7, "milliards de combinaisons", "« 1,7 milliard de combinaisons pour calculer un taux de charges sociales »", 2026, "manifeste",
           "1,7 milliard de combinaisons pour calculer un taux de charges sociales")
    F.site("impots_cibles_manifeste", 4, "impôts", "« Quatre impôts pour fusionner toute la fiscalité : TVA, revenu, sociétés, foncier »", 2026, "manifeste",
           "Quatre impôts pour fusionner toute la fiscalité")
    F.site("impots_cibles_lettres", 5, "impôts", "« 5 impôts au lieu de 438 » (lettres aux élus)", 2026, "lettres__lettre-depute", "5 impôts au lieu de 438")
    F.site("impots_75pct_recettes_manifeste", 75, "% des recettes", "Les quatre impôts « portent déjà 75 % des recettes »", 2026, "manifeste", "Ils portent déjà 75 % des recettes")
    F.amend("taxes_etat_supprimees_loi", 54, "impositions", "Impositions de l'État supprimées par PLF-P1 n° 22", 2027, "PLF-P1", 22, "Cet amendement supprime cinquante-quatre impositions de l’État", note="Valeur : « cinquante-quatre » (vingt et une dans la version d'octobre 2026) ; l'amendement ramène aussi l'accise sur l'électricité à 1 € par mégawattheure (ménages) et 0,5 € (autres consommations) à partir du 1er juillet 2027.")
    F.amend("taxes_affectees_supprimees_loi", 72, "impositions", "Impositions affectées supprimées par PLF-P1 n° 25", 2027, "PLF-P1", 25, "Cet amendement supprime soixante-douze impositions affectées", note="Valeur : « soixante-douze » (cinquante-sept dans la version d'octobre 2026).")
    F.amend("contributions_sociales_supprimees_loi", 21, "contributions", "Contributions affectées à la sécurité sociale supprimées par PLFSS n° 9", 2027, "PLFSS", 9, "Cet amendement supprime vingt et une contributions affectées à la sécurité sociale", note="Valeur : « vingt et une ». Nouvel amendement de novembre 2026 ; leur produit atteint 13 Md€ et la perte est compensée par la majoration du taux des contributions sur les revenus du patrimoine et des placements (L. 136-6 et L. 136-7 du code de la sécurité sociale).")
    F.amend("contributions_sociales_produit_expose_md", 13, "Md€", "Produit des 21 contributions supprimées par PLFSS n° 9 (exposé)", 2027, "PLFSS", 9, "Leur produit atteint 13 milliards d’euros", tier="donnee")
    F.amend("taxes_affectees_plafond_zero_loi", 82, "lignes de ressources affectées", "Ressources affectées dont le plafond est porté à zéro par PLF-P1 n° 24", 2027, "PLF-P1", 24, "plafonne à zéro l’affectation de quatre-vingt-deux ressources", note="Valeur : « quatre-vingt-deux ».")
    F.amend("taxes_affectees_plafond_zero_rendement_meur", 29980.5, "M€", "Rendement prévisionnel 2027 des 82 lignes dont le plafond est porté à zéro", 2027, "PLF-P1", 24, "rendement prévisionnel de 29 980,5 millions d’euros au titre de 2027")
    ta = "Synth_se_TA"
    F.wb("taxes_affectees_non_indispensables_md", "taxes_aff", ta, "D7", "Md€", "Taxes affectées aux opérateurs non indispensables (dépense totale)", 2026, "donnee", scale=0.001, nd=3, kind="workbook",
         note="PLF 2026, V&M tome I annexe 2 ; classement « non indispensable » par Résolution.")
    F.wb("taxes_affectees_economie_md", "taxes_aff", ta, "E7", "Md€", "Économie visée sur ces taxes affectées", None, "annonce", scale=0.001, nd=3, note="8,12 Md€ en un an et 9,80 Md€ ensuite.")
    # niches
    ny = "Synth_se"
    pl = dict(kind="workbook", also=False)
    F.wb("niches_nombre", "niches", ny, "C7", "niches", "Niches fiscales recensées au PLF 2026", 2024, "donnee", expect=465, nd=0, note="PLF 2026, Évaluation des voies et moyens, tome II, annexe 3.")
    F.wb("niches_cout_2024_md", "niches", ny, "D7", "Md€", "Coût des 465 niches fiscales (réalisation 2024)", 2024, "donnee", expect=89.406, nd=3)
    F.wb("niches_cout_2024_tva_apu_md", "niches", ny, "D8", "Md€", "Coût des 465 niches fiscales, TVA de toutes les administrations publiques comprise (2024)", 2024, "annonce", nd=3,
         note="Calcul des auteurs (colonne « yc TVA APU » de la feuille « Chiffrages Résolution » de leur copie du classeur) : ce n'est pas un chiffre de l'annexe du PLF.")
    F.wb("niches_tva_hors_niches_nombre", "niches", ny, "C11", "taux réduits", "Taux réduits de TVA non comptés comme niches", 2024, "annonce", expect=21, nd=0,
         note="Compte des auteurs (feuille « Synthèse » de leur copie du classeur « Niches fiscales ») : le PLF ne compte pas ces taux comme dépenses fiscales.")
    F.wb("niches_tva_hors_niches_md", "niches", ny, "D11", "Md€", "Coût des 21 taux réduits de TVA non comptés comme niches (projection 2024 par les auteurs)", 2024, "annonce", nd=3,
         note="Estimation du CPO (février 2023, p. 32) : 30 Md€ en 2021 dont 20 Md€ sur l'eau et l'alimentation, projetée sur 2024 par les auteurs au prorata de la TVA des comptes nationaux de l'Insee. Ce n'est pas un chiffre du PLF 2026.")
    F.wb("niches_total_nombre", "niches", ny, "C12", "niches", "Niches fiscales et taux réduits de TVA (total)", 2024, "annonce", expect=486, nd=0,
         note="465 niches de l'annexe du PLF + 21 taux réduits de TVA ajoutés par les auteurs (465 + 21 = 486 exactement, feuille « Synthèse » C12 ; ce n'est pas un arrondi).")
    F.wb("niches_total_md", "niches", ny, "D12", "Md€", "Coût des 486 niches et taux réduits de TVA (2024), calcul des auteurs", 2024, "annonce", nd=3,
         note="134,70 Md€ = 89,406 (465 niches, annexe du PLF 2026) + 11,915 (TVA de toutes les administrations publiques, calcul des auteurs) + 33,382 (21 taux réduits : estimation du CPO de février 2023 projetée sur 2024 par les auteurs). Seuls les 89,406 Md€ sont un chiffre de l'annexe du PLF.")
    F.wb("niches_eteintes_avant_2025_nombre", "niches", ny, "C9", "niches", "Niches dont le fait générateur est éteint (fin ≤ 2024)", 2024, "donnee", expect=47, nd=0)
    F.wb("niches_eteintes_avant_2025_md", "niches", ny, "D9", "Md€", "Coût 2024 des niches au fait générateur éteint (fin ≤ 2024)", 2024, "donnee", nd=3)
    F.wb("niches_eteintes_fin_2025_nombre", "niches", ny, "C10", "niches", "Niches dont le fait générateur s'éteint en 2025", 2024, "donnee", expect=35, nd=0)
    F.external("niches_nombre_plf2027", 459, "niches", "Niches fiscales recensées au PLF 2027 (rapport annexé)", 2027, "fipeco",
               "FIPECO, « Les dépenses fiscales », 29 octobre 2026 : « Le rapport annexé au PLF pour 2027 recense 459 niches (465 dans le PLF précédent) »",
               "https://fipeco.fr/fiche/Les-depenses-fiscales",
               note="Le chiffre du PLF 2027 (Évaluation des voies et moyens, tome II, déposé en octobre 2026) est repris de FIPECO : le tome II officiel n'a pas pu être ouvert depuis nos outils. Le classeur des auteurs, et donc les 465 niches de ce site, reposent sur le PLF 2026.")
    F.amend("niches_cout_2026_expose_md", 79.5, "Md€", "Coût prévisionnel des niches en 2026 cité par l'exposé de PLF-P1 n° 1", 2026, "PLF-P1", 1, "pour un coût prévisionnel de 79,5 milliards d’euros en 2026", tier="loi")
    nb = b_niches.build()
    F.calc_value("niches_cout_2026_somme_md", clean(nb["meta"]["totals"]["cost_2026_meur"] / 1000, 3), [], "Md€", "Somme des 465 lignes de coût 2026 du classeur", 2026,
                 "somme de la colonne « Prévision 2026 » de la feuille Chiffrages (ε et nc comptés pour 0)", note="79,613 Md€, contre 79,5 Md€ cités par l'exposé de PLF-P1 n° 1.")
    hc = nb["synthese"]["household_common"]
    F.calc_value("niches_menages_communes_nombre", hc["count"], [], "niches", "Niches qui touchent couramment les ménages (liste éditoriale + règle ≥ 1 M de ménages)", 2024,
                 "comptage de household_common dans niches.json", note="Règle et liste dans niches.json (meta.household_common_rule).")
    F.calc_value("niches_menages_communes_cout_2024_md", clean(hc["cost_2024_meur"] / 1000, 3), [], "Md€", "Coût 2024 des niches qui touchent couramment les ménages", 2024,
                 "somme des cost_2024_meur des niches household_common dans niches.json ÷ 1 000", note="Hors modalités de calcul de l'impôt (décote, etc.) listées à part.")
    # mots de loi
    gc = "GraphCodes"
    lg = dict(kind="legifrance", url=LEGIFRANCE, ref_prefix="Légifrance, statistiques de la norme")
    F.wb("droit_mots_legislatif_2026", G, gc, "X11", "mots", "Mots des textes législatifs en 2026", 2026, "donnee", nd=0, expect=15318365, **lg)
    F.wb("droit_mots_reglementaire_2026", G, gc, "X14", "mots", "Mots des textes réglementaires en 2026", 2026, "donnee", nd=0, expect=33516078, **lg)
    F.wb("droit_mots_legislatif_2005", G, gc, "C11", "mots", "Mots des textes législatifs en 2005", 2005, "donnee", nd=0, expect=7045177, **lg)
    F.wb("droit_mots_reglementaire_2005", G, gc, "C14", "mots", "Mots des textes réglementaires en 2005", 2005, "donnee", nd=0, expect=18963617, **lg)
    # durée légale du travail (sert à convertir des heures de lecture en années à temps plein)
    F.external("duree_legale_travail_h_an", 1607, "heures par an", "Durée annuelle légale du travail à temps plein", 2026, "reglementation",
               "Légifrance, Code du travail : 35 heures par semaine et journée de solidarité (loi n° 2004-626 du 30 juin 2004), soit 1 607 heures par an",
               "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050/",
               note="Convention usuelle de la durée annuelle légale (1 607 h) ; sert aux réexpressions « années à temps plein » du site.")
    F.calc("droit_mots_2026", ["droit_mots_legislatif_2026", "droit_mots_reglementaire_2026"], lambda a, b: a + b, "mots", "Mots du droit applicable en 2026", 2026,
           "droit_mots_legislatif_2026 + droit_mots_reglementaire_2026", nd=0, note="48,83 millions de mots : le manifeste arrondit à « 49 millions ».")
    F.calc("droit_mots_2005", ["droit_mots_legislatif_2005", "droit_mots_reglementaire_2005"], lambda a, b: a + b, "mots", "Mots du droit applicable en 2005", 2005,
           "droit_mots_legislatif_2005 + droit_mots_reglementaire_2005", nd=0)
    F.calc("droit_mots_croissance_pct", ["droit_mots_2026", "droit_mots_2005"], lambda a, b: (a / b - 1) * 100, "%", "Croissance du volume de droit applicable entre 2005 et 2026", 2026,
           "(droit_mots_2026 ÷ droit_mots_2005 − 1) × 100", nd=1)
    F.calc("droit_mots_multiple", ["droit_mots_2026", "droit_mots_2005"], lambda a, b: a / b, "ratio", "Volume de droit applicable en 2026 rapporté à 2005", 2026, "droit_mots_2026 ÷ droit_mots_2005", nd=2)
    F.site("droit_mots_manifeste", 49000000, "mots", "« 49 millions de mots du droit applicable »", 2026, "manifeste", "49 millions de mots du droit applicable")
    F.site("droit_mots_cible_diviseur", 10, "facteur de réduction", "« Diviser au moins par 10 » le volume du droit", None, "manifeste", "Diviser au moins par 10 les 49 millions de mots du droit applicable")
    # effectifs
    se = "Synth_se_ETP"
    dg = dict(kind="dgafp", url=DGAFP, ref_prefix="DGAFP, rapport annuel sur l'état de la fonction publique, édition 2025 (effectifs physiques au 31 décembre 2023)")
    F.wb("fp_effectifs_2023_k", EM, se, "C8", "milliers de personnes", "Effectifs des trois fonctions publiques", 2023, "donnee", expect=5803.862, nd=3, **dg, note="5,80 millions de personnes (physiques, au 31 décembre 2023).")
    F.wb("fp_fpe_2023_k", EM, se, "C13", "milliers de personnes", "Fonction publique de l'État", 2023, "donnee", expect=2570.237, nd=3, **dg)
    F.wb("fp_fpt_2023_k", EM, se, "C17", "milliers de personnes", "Fonction publique territoriale", 2023, "donnee", expect=1994.19, nd=3, **dg)
    F.wb("fp_fph_2023_k", EM, se, "C21", "milliers de personnes", "Fonction publique hospitalière", 2023, "donnee", expect=1239.435, nd=3, **dg)
    # édition 2026 du rapport (octobre 2026) : effectifs au 31 décembre 2024, lus dans le PDF officiel (figure 2), hors classeur des auteurs
    DGAFP_CC2026 = "https://www.fonction-publique.gouv.fr/files/files/publications/publications-dgafp/cc-2026-web.pdf"
    F.external("fp_effectifs_2024_k", 5848.3, "milliers de personnes", "Effectifs des trois fonctions publiques au 31 décembre 2024", 2024, "dgafp",
               "DGAFP, Fonction publique, chiffres clés, édition 2026 (octobre 2026), figure 2 : « 5 848,3 » milliers d'agents au 31 décembre 2024, France hors Mayotte (emplois principaux, tous statuts)",
               DGAFP_CC2026, verified_by="lecture du PDF officiel (figure 2, 21 novembre 2026), hors classeur", note="5,85 millions de personnes. Le classeur des auteurs reprend l'édition 2025 du rapport (31 décembre 2023 : 5,80 millions) : le site garde ses chiffres détaillés par versant et statut, datés de 2023, et signale cette édition plus récente.")
    F.external("fp_fpe_2024_k", 2581.9, "milliers de personnes", "Fonction publique de l'État au 31 décembre 2024", 2024, "dgafp",
               "DGAFP, Fonction publique, chiffres clés, édition 2026 (octobre 2026), figure 2 : « 2 581,9 » milliers d'agents de la fonction publique de l'État au 31 décembre 2024",
               DGAFP_CC2026, verified_by="lecture du PDF officiel (figure 2, 21 novembre 2026), hors classeur", note="2,58 millions, soit 44 % de l'emploi public (2 581,9 ÷ 5 848,3) : l'État n'est pas la majorité des agents, comme en 2023.")
    F.wb("fp_fonctionnaires_2023_k", EM, se, "C4", "milliers de personnes", "Fonctionnaires", 2023, "donnee", nd=3, **dg)
    F.wb("fp_contractuels_2023_k", EM, se, "C5", "milliers de personnes", "Contractuels", 2023, "donnee", nd=3, **dg)
    F.wb("fp_militaires_2023_k", EM, se, "C6", "milliers de personnes", "Militaires", 2023, "donnee", nd=3, **dg)
    F.wb("fp_autres_statuts_2023_k", EM, se, "C7", "milliers de personnes", "Autres catégories et statuts", 2023, "donnee", nd=3, **dg)
    F.wb("fp_etat_ministeres_2023_k", EM, "FPE", "M18", "milliers de personnes", "Agents de l'État dans les ministères (hors opérateurs)", 2023, "donnee", nd=3, **dg)
    F.wb("fp_etat_operateurs_2023_k", EM, "FPE", "F27", "milliers de personnes", "Agents des opérateurs de l'État (EPA)", 2023, "donnee", nd=3, **dg)
    F.site("postes_publics_fermes_manifeste", 580000, "postes", "« 580 000 postes publics fermés, 70 % du traitement conservé jusqu'à sept ans »", 2026, "manifeste", "580 000 postes publics fermés")
    de = "D_tail_Economies"
    F.wb("postes_fermes_total_classeur", C, de, "J2", "postes", "Baisse d'ETP, toutes administrations publiques (classeur)", None, "annonce", expect=580000, nd=0)
    F.wb("postes_fermes_apuc_classeur", C, de, "J3", "postes", "Baisse d'ETP, administrations publiques centrales (classeur)", None, "annonce", expect=151000, nd=0)
    F.wb("postes_fermes_etat_classeur", C, de, "J38", "postes", "Baisse d'ETP, État (classeur)", None, "annonce", expect=61400, nd=0)
    F.wb("postes_fermes_apul_classeur", C, de, "J43", "postes", "Baisse d'ETP, collectivités locales (classeur)", None, "annonce", expect=428500, nd=0)
    F.wb("postes_fermes_france_travail_classeur", C, de, "J6", "postes", "Baisse d'ETP, France Travail (classeur)", None, "annonce", expect=47880, nd=0)
    F.calc("postes_fermes_apuc_plus_apul", ["postes_fermes_apuc_classeur", "postes_fermes_apul_classeur"], lambda a, b: a + b, "postes", "APUC + APUL", None,
           "postes_fermes_apuc_classeur + postes_fermes_apul_classeur", nd=0, note="579 500 : 500 de moins que les 580 000 annoncés (arrondi).")
    F.amend("emplois_etat_plafond_baisse_2027_loi", 30698, "ETPT", "Baisse du plafond d'emplois de l'État en 2027 (PLF-P2 n° 24)", 2027, "PLF-P2", 24, "abaisse de 30 698 emplois le plafond d’autorisation des emplois de l’État")
    F.amend("emplois_etat_plafond_avant_loi", 2032750, "ETPT", "Plafond d'emplois de l'État avant l'amendement (article 63 du PLF)", 2027, "PLF-P2", 24, "Le contribuable paie 2 032 750 équivalents temps plein travaillé")
    F.amend("emplois_etat_plafond_apres_loi", 2002052, "ETPT", "Plafond d'emplois de l'État après l'amendement", 2027, "PLF-P2", 24, "Total général 2 002 052")
    F.amend("emplois_etat_fermes_annee_pleine_loi", 61400, "emplois", "Postes d'État fermés en année pleine (à partir du 1er juillet 2027)", 2028, "PLF-P2", 24, "Ces postes sont au nombre de 61 400")
    F.calc("fp_agents_restants_calc_k", ["fp_effectifs_2023_k"], lambda t: t - 580, "milliers de personnes",
           "Agents publics restants si 580 000 postes sont fermés (effectifs 2023)", 2023, "fp_effectifs_2023_k − 580", nd=3,
           note="5 223,862 milliers : cohérent avec les « 5,22 M » d'agents indispensables de la fiche (580 000 est l'objectif du manifeste).")
    # représentation
    r = "Graph51pc"
    for col, cid, lab in (("D", "elu_direct", "Citoyens qui élisent directement leurs représentants"), ("E", "assemblee", "Assemblée"), ("F", "commission", "Commission"), ("G", "conseil", "Conseil"), ("H", "comite", "Comité")):
        F.wb(f"representation_{cid}_pct", G, r, f"{col}26", "pour 100 citoyens", f"Dégradation de la représentation démocratique : {lab}", None, "annonce", nd=6,
             note="Construction du livre : chaque étape = 51 % de la précédente (100 → 51 → 26,01 → 13,27 → 6,77 → 3,45).")


def b_agences_list():
    import b_agences
    return b_agences._dissolutions_am25()[0]


# ======================================================================================
# E. le plan
# ======================================================================================
def _e_plan(F: Facts):
    am = "Annexe_Manuscrit"
    for row, (rid, parent, level, kind) in b_plan.ROWS.items():
        sh = Sheet.get(C, am)
        label = sh.at(row - 1, 1).replace("\n", " ").strip()
        lbl = " ".join(label.split())
        F.wb(f"eco236_{rid}_md", C, am, f"C{row}", "Md€ par an", f"236 Md€ : {lbl}", None, "annonce", nd=6)
        F.wb(f"eco236_{rid}_eur_foyer", C, am, f"D{row}", "€ par foyer et par an", f"236 Md€, par foyer : {lbl}", None, "annonce", nd=0)
        if sh.num(f"E{row}") is not None:
            F.wb(f"eco236_{rid}_an1_md", C, am, f"E{row}", "Md€", f"236 Md€, gain dès l'année 1 : {lbl}", None, "annonce", nd=6)
        if sh.num(f"F{row}") is not None:
            F.wb(f"eco236_{rid}_supp_md", C, am, f"F{row}", "Md€", f"236 Md€, gain supplémentaire en année pleine : {lbl}", None, "annonce", nd=6)
    F.d["eco236_total_md"]["note"] = "236,353 Md€ (« 236 milliards ») ; 236,055 Md€ dans la version d'octobre 2026 du classeur."
    F.d["eco236_patrimoine_supp_md"]["note"] = "17,553 en colonne F, égal à la colonne C de la même ligne depuis la version de novembre 2026 (octobre : 18 en colonne C et 18,209 en colonne F)."
    F.wb("eco236_graph236_total_md", G, "Graph236", "D24", "Md€ par an", "Total des économies dans la feuille Graph236 (série du graphique « 236 milliards »)", None, "annonce", nd=6,
         note="236,402 Md€ : la feuille Graph236 de « Séries des graphiques » n'a pas été mise à jour comme l'Annexe Manuscrit (236,353) ; son rendement des actifs publics (D34) est 17,602 contre 17,553.")
    F.site("eco236_manifeste_md", 236, "Md€ par an", "« 236 milliards d'euros économisés chaque année » (manifeste)", 2026, "manifeste", "236 milliards d’euros économisés chaque année")
    F.site("eco236_web_total_md", 236, "Md€ par an", "Tableau des 236 milliards de donnees.html : total des économies (arrondi)", 2026, "donnees", "Total des économies | 236 | 8 000", note="Le tableau du site est arrondi ; voir eco236_*_md pour les valeurs exactes du classeur.")
    F.site("eco236_web_eur_foyer", 8000, "€ par foyer et par an", "Tableau des 236 milliards de donnees.html : total par foyer", 2026, "donnees", "Total des économies | 236 | 8 000")
    F.site("eco236_web_fonctionnement_md", 39, "Md€ par an", "Tableau de donnees.html : économies sur le fonctionnement des administrations (arrondi)", 2026, "donnees",
           "Économies sur le fonctionnement des administrations | 39 | 1 280", note="Les cinq sous-lignes affichées (4 + 10 + 9 + 12 + 4) font 39 ; le classeur de novembre 2026 donne 38,117 (37,432 en octobre).")
    F.site("eco236_web_subventions_md", 69, "Md€ par an", "Tableau de donnees.html : économies sur les subventions (arrondi)", 2026, "donnees", "Économies sur les subventions | 69 | 2 330")
    F.calc("eco236_somme_e_plus_f_md", ["eco236_total_an1_md", "eco236_total_supp_md"], lambda a, b: a + b, "Md€ par an", "236 Md€ : somme du gain d'année 1 et du gain supplémentaire en année pleine", None,
           "eco236_total_an1_md + eco236_total_supp_md", nd=6, note="236,353 Md€ : égale au total de la colonne C (236,353 Md€) depuis la version de novembre 2026 ; en octobre, 236,264 dépassait de 0,209 Md€ le total (patrimoine : 18 contre 18,209).")
    F.calc("foyers_implicites_236_m", ["eco236_total_md", "eco236_total_eur_foyer"], lambda a, b: a * 1000 / b, "millions de foyers", "Nombre de foyers implicite du tableau des 236 Md€ (8 000 € par foyer)", None,
           "eco236_total_md × 1 000 ÷ eco236_total_eur_foyer", nd=3, note="Dénominateur du tableau « € par foyer » du livre.")
    F.calc("eco236_par_foyer_mois_eur", ["eco236_total_eur_foyer"], lambda x: x / 12, "€ par foyer et par mois", "Économies de 236 Md€ par foyer et par mois", None, "eco236_total_eur_foyer ÷ 12", nd=0,
           note="Dénominateur : 29,5 M de foyers (celui du tableau des 236 Md€).")
    F.calc("eco236_par_foyer_jour_eur", ["eco236_total_eur_foyer"], lambda x: x / 365, "€ par foyer et par jour", "Économies de 236 Md€ par foyer et par jour", None, "eco236_total_eur_foyer ÷ 365", nd=2,
           note="Dénominateur : 29,5 M de foyers (celui du tableau des 236 Md€).")
    # year-1 per Flux
    F.wb("plan_gain_annee_1_flux_md", C, "Flux", "C6", "Md€", "Gain de la première année selon la feuille Flux", None, "annonce", expect=129.459, nd=3,
         note="129,459 Md€, égal à 0,0003 Md€ près au gain de l'année 1 de l'Annexe Manuscrit (129,4593) : l'écart de 2,048 Md€ d'octobre 2026 est résolu. « Année 1 » n'est pas datée dans le classeur.")
    # CSG / CRDS
    cs = "CSG_CRDS"
    plac = dict(kind="workbook")
    F.wb("csg_crds_activite_md", C, cs, "I3", "Md€ par an", "CSG + CRDS sur les revenus d'activité (données 2024)", 2024, "donnee", expect=114.46, nd=3, note="Source du classeur : PLACSS 2024, annexe 1 ; l'amendement PLFSS n° 1 écrit « 114 milliards d'euros en année pleine ».")
    F.wb("csg_seule_md", C, cs, "H3", "Md€ par an", "CSG seule (données 2024)", 2024, "donnee", expect=108.56, nd=3)
    F.wb("csg_point_md", C, cs, "J3", "Md€ par point", "Rendement d'un point de CSG", 2024, "donnee", expect=11.8, nd=3)
    F.amend("csg_points_sur_salaire_loi", 9.7, "points", "CSG + CRDS sur la fiche de paie : 9,7 points", 2026, "PLFSS", 1, "9,7 points partent au titre de deux contributions uniformes")
    F.amend("csg_taux_csg_activite_loi", 9.2, "% de l'assiette", "Taux actuel de CSG sur les revenus d'activité (clé de répartition : 9,20 points)", 2026, "PLFSS", 2, "ventile aujourd’hui 9,20 points")
    F.calc("csg_taux_crds_calc", ["csg_points_sur_salaire_loi", "csg_taux_csg_activite_loi"], lambda a, b: a - b, "% de l'assiette", "Taux de CRDS sur les revenus d'activité", 2026,
           "csg_points_sur_salaire_loi − csg_taux_csg_activite_loi", nd=1, note="0,5 point, maintenu jusqu'au 1er décembre 2027.")
    F.amend("csg_cout_2027_md_loi", 33, "Md€", "Coût de la suppression de la CSG/CRDS d'activité en 2027", 2027, "PLFSS", 1, "33 milliards d’euros en 2027 et 114 milliards en année pleine dès 2028")
    F.amend("csg_cout_annee_pleine_md_loi", 114, "Md€ par an", "Coût de la suppression de la CSG/CRDS d'activité en année pleine (dès 2028)", 2028, "PLFSS", 1, "114 milliards en année pleine dès 2028")
    F.amend("csg_gage_exonerations_md_loi", 9, "Md€", "Exonérations de cotisations abrogées : rendus au salaire net", 2027, "PLFSS", 1, "elle rend 9 milliards d’euros au salaire net")
    F.amend("csg_gain_net_pct_loi", 13, "%", "Hausse de la rémunération nette « de près de 13 % » au terme de la montée en charge", None, "PLFSS", 1, "la rémunération nette augmente de près de 13 %")
    for cid, val, lab in (("assurance_maladie", 50, "régimes obligatoires d'assurance maladie"), ("autonomie", 25, "caisse d'autonomie"), ("assurance_chomage", 17, "assurance chômage"),
                          ("allocations_familiales", 11, "caisse des allocations familiales"), ("cades", 11, "caisse d'amortissement de la dette sociale")):
        F.amend(f"csg_recettes_perdues_{cid}_md_loi", val, "Md€ par an", f"Recettes affectées perdues avec la CSG/CRDS d'activité : {lab}", 2028, "PLFSS", 2,
                "dont 50 aux régimes obligatoires d’assurance maladie, 25 à la caisse d’autonomie, 17 à l’assurance chômage, 11 à la caisse des allocations familiales et 11 à la caisse d’amortissement de la dette sociale")
    for rid, key, lab in (("smic_brut_2025", 7, "SMIC brut mensuel 2025"), ("smic_net_2025", 8, "SMIC net mensuel 2025")):
        F.wb(f"csg_{rid}_eur", C, cs, f"C{key}", "€ par mois", lab, 2025, "donnee", nd=2)
    F.wb("csg_salaire_net_median_eur", C, cs, "C13", "€ par mois", "Salaire net médian mensuel (hypothèse du classeur)", 2024, "donnee", expect=2190, nd=2,
         note="Le manifeste : « un salaire net médian de 2 190 euros ».")
    F.wb("csg_gain_smic_mois_eur", C, cs, "F7", "€ par mois", "Gain mensuel de la fin de la CSG/CRDS au SMIC (2025)", 2025, "annonce", nd=2, note="171,72 €/mois.")
    F.wb("csg_gain_smic_pct", C, cs, "G8", "% du net", "Gain de la fin de la CSG/CRDS au SMIC, en % du salaire net", 2025, "annonce", scale=100, nd=2)
    F.wb("csg_gain_smic_an_eur", C, cs, "I7", "€ par an", "Gain annuel de la fin de la CSG/CRDS au SMIC (2025)", 2025, "annonce", nd=2)
    F.wb("csg_gain_median_mois_eur", C, cs, "F13", "€ par mois", "Gain mensuel de la fin de la CSG/CRDS au salaire net médian", 2024, "annonce", nd=2, note="275,08 €/mois ; le manifeste annonce 300 €.")
    F.wb("csg_gain_median_pct", C, cs, "G13", "% du net", "Gain de la fin de la CSG/CRDS au salaire net médian, en % du net", 2024, "annonce", scale=100, nd=2, note="12,56 % ; le manifeste annonce « 13 % ».")
    F.wb("csg_gain_median_an_eur", C, cs, "I13", "€ par an", "Gain annuel de la fin de la CSG/CRDS au salaire net médian", 2024, "annonce", nd=2)
    F.wb("csg_gain_moyen_mois_eur", C, cs, "F14", "€ par mois", "Gain mensuel de la fin de la CSG/CRDS au salaire moyen (brut 3 602 €)", 2024, "annonce", nd=2)
    F.site("csg_gain_median_manifeste_eur_mois", 300, "€ par mois", "« 300 euros par mois restitués dès la première année » (manifeste)", 2026, "manifeste", "300 euros par mois restitués dès la première année")
    F.site("csg_gain_pct_manifeste", 13, "%", "« +13 % de salaire net en plus pour tous » (manifeste)", 2026, "manifeste", "soit +13 % de salaire net en plus pour tous")
    F.site("csg_gain_smic_fiche_eur_mois", 180, "€ par mois", "« 180 euros de plus par mois au SMIC » (fiche Travailleur)", 2026, "fiches__travailleur", "180 euros de plus par mois au SMIC")
    F.site("csg_gain_pct_fiche", 13, "%", "« +13 % votre salaire net en un an, au salaire médian » (fiche Travailleur)", 2026, "fiches__travailleur", "Votre salaire net en un an, au salaire médian")
    F.site("restitution_totale_manifeste_eur_mois", 600, "€ par mois", "« 600 euros par mois rendus aux travailleurs » (300 € de salaire net + 300 € d'épargne)", 2026, "manifeste", "600 euros par mois rendus aux travailleurs")
    F.site("restitution_epargne_manifeste_eur_mois", 300, "€ par mois", "« 300 euros par mois versés sur un compte épargne retraite personnel d'ici trois ans »", 2026, "manifeste",
           "300 euros par mois versés sur un compte épargne retraite personnel d’ici trois ans")
    # AFU
    F.amend("afu_adulte_eur_an", 6600, "€ par an", "Aide fondamentale universelle par adulte", 2028, "PLF-P1", 28, "6 600 € par an et par adulte")
    F.amend("afu_enfant_eur_an", 3300, "€ par an", "Aide fondamentale universelle par enfant à charge", 2028, "PLF-P1", 28, "3 300 € par enfant à charge")
    F.amend("afu_invalidite_eur_an", 6600, "€ par an", "Majoration invalidité de l'aide fondamentale", 2028, "PLF-P1", 28, "majorés de 6 600 € pour une personne invalide")
    F.amend("afu_pension_eur_an", -3300, "€ par an (négatif : minoration)", "Minoration de l'aide fondamentale pour une pension de retraite liquidée avant le 1er janvier 2028 (montant négatif)", 2028, "PLF-P1", 28,
            "minorés de 3 300 € pour une pension de retraite liquidée avant le 1er janvier 2028",
            note="Dans la version d'octobre 2026 de l'amendement ce montant était une majoration de +3 300 € (« majoré de 3 300 € ») ; en novembre 2026 le texte dit « minoré » : −3 300 €, pour une pension servie par un régime obligatoire, jusqu'à l'imposition des revenus de 2051 ; pour une pension liquidée à compter de 2028, la minoration est réduite à proportion des droits acquis avant 2028 (à défaut de décret : 3 300 € × durée d'assurance validée avant 2028 ÷ durée d'assurance totale).")
    F.amend("ir_taux_unique_pct", 23, "%", "Taux unique de l'impôt sur le revenu", 2028, "PLF-P1", 28, "un taux unique de 23 %")
    F.calc("afu_adulte_eur_mois", ["afu_adulte_eur_an"], lambda x: x / 12, "€ par mois", "Aide fondamentale universelle par adulte et par mois", 2028, "afu_adulte_eur_an ÷ 12", nd=0, note="550 €/mois.")
    F.calc("afu_enfant_eur_mois", ["afu_enfant_eur_an"], lambda x: x / 12, "€ par mois", "Aide fondamentale universelle par enfant et par mois", 2028, "afu_enfant_eur_an ÷ 12", nd=2, note="275 €/mois.")
    F.calc("afu_invalide_adulte_eur_mois", ["afu_adulte_eur_an", "afu_invalidite_eur_an"], lambda a, b: (a + b) / 12, "€ par mois", "Aide fondamentale d'un adulte invalide, par mois", 2028,
           "(afu_adulte_eur_an + afu_invalidite_eur_an) ÷ 12", nd=0, note="1 100 €/mois, comme la fiche Personne handicapée.")
    F.calc("afu_seuil_equilibre_eur_an", ["afu_adulte_eur_an", "ir_taux_unique_pct"], lambda a, t: a / (t / 100), "€ par an", "Revenu à partir duquel l'impôt dépasse l'aide pour une personne seule", 2028,
           "afu_adulte_eur_an ÷ (ir_taux_unique_pct ÷ 100)", nd=2, note="28 695,65 € ; l'exposé de PLF-P1 n° 28 écrit « 28 700 € ».")
    F.amend("afu_seuil_loi_eur_an", 28700, "€ par an", "« l'impôt devient négatif en deçà de 28 700 € pour une personne seule »", 2028, "PLF-P1", 28, "l’impôt devient négatif en deçà de 28 700 € pour une personne seule")
    F.calc("ir_retention_marginale_calc", ["ir_taux_unique_pct"], lambda t: 1 - t / 100, "€ gardé par euro gagné", "Part de chaque euro gagné qui reste au foyer sous le taux unique", 2028, "1 − ir_taux_unique_pct ÷ 100", nd=2,
           note="0,77 € ; la fiche Travailleur : « 0,77 € ce qui vous reste par euro gagné, quel que soit votre revenu ».")
    F.site("ir_retention_marginale_fiche", 0.77, "€ gardé par euro gagné", "« 0,77 € : ce qui vous reste par euro gagné, quel que soit votre revenu » (fiche Travailleur)", 2026, "fiches__travailleur", "Ce qui vous reste par euro gagné, quel que soit votre revenu")
    ref = "Refonte_fiscalit"
    F.wb("ir_taux_unique_estime_pct", C, ref, "K50", "%", "Taux unique d'impôt sur le revenu estimé par le classeur avant arrondi", None, "annonce", scale=100, nd=4, note="22,737 % ; arrondi à 23 % dans l'amendement.")
    F.wb("afu_cout_brut_md", C, ref, "G58", "Md€ par an", "Coût brut de l'aide fondamentale universelle", None, "annonce", expect=402.006, nd=3)
    F.wb("afu_depenses_fusionnees_md", C, ref, "C60", "Md€ par an", "Dépenses existantes fusionnées dans l'aide fondamentale", None, "annonce", nd=5, note="Fiscal 21,6 + budgétaire 31,8 + social 81,946.")
    F.calc("afu_cout_net_calc_md", ["afu_cout_brut_md", "afu_depenses_fusionnees_md"], lambda a, b: a - b, "Md€ par an", "Coût de l'aide fondamentale net des dépenses fusionnées", None,
           "afu_cout_brut_md − afu_depenses_fusionnees_md", nd=3, note="À financer par l'impôt à 23 % sur une assiette élargie ; aucune microsimulation (gagnants/perdants par décile) n'est publiée.")
    F.wb("afu_adultes_millions", C, ref, "C50", "millions de personnes", "Adultes de la population fiscale 2025 retenus pour l'aide fondamentale", 2025, "donnee", nd=2)
    F.wb("afu_enfants_millions", C, ref, "C51", "millions de personnes", "Enfants de la population fiscale 2025 retenus pour l'aide fondamentale", 2025, "donnee", nd=2)
    F.site("afu_manifeste_550_275", 550, "€ par mois", "« 550 euros par mois d'aide fondamentale universelle, plus 275 euros par enfant, à la place de toutes les aides »", 2026, "manifeste",
           "550 euros par mois d’aide fondamentale universelle, plus 275 euros par enfant")
    F.amend("afu_smic_amendement_eur_mois", 550, "€ par mois", "« à partir de janvier 2028, le salarié au SMIC reçoit 550 € par mois de l'administration fiscale »", 2028, "PLF-P1", 28,
            "le salarié au SMIC reçoit 550 € par mois de l’administration fiscale")
    F.site("afu_smic_net_fiche_eur_mois", 220, "€ par mois", "« +220 € de plus par mois au salaire type » (fiche Bénéficiaire d'un chèque ciblé)", 2026, "fiches__beneficiaire-d-un-cheque-cible", "De plus par mois au salaire type")
    F.calc_value("afu_smic_net_calc_eur_mois", clean((F.v("afu_adulte_eur_an") - F.v("ir_taux_unique_pct") / 100 * 12 * F.v("csg_smic_net_2025_eur")) / 12, 1),
                 ["afu_adulte_eur_an", "ir_taux_unique_pct", "csg_smic_net_2025_eur"], "€ par mois", "Versement net de l'administration à un salarié au SMIC net (revenu imposable ≈ salaire net)", 2028,
                 "(afu_adulte_eur_an − ir_taux_unique_pct ÷ 100 × 12 × csg_smic_net_2025_eur) ÷ 12",
                 note="≈ 222 €/mois, proche des « +220 € » de la fiche. Hypothèse : revenu net imposable = salaire net (la définition du revenu net imposable après réforme n'est pas écrite ; voir DISCREPANCIES.md).")
    # CEP and assets
    cap = "Input_Capitalisation"
    F.wb("cep_flux_capitalisation_md", C, cap, "E2", "Md€ par an", "Flux annuels affectés à la capitalisation", None, "annonce", nd=3, note="121,94 Md€ = 104,385 d'économies + 17,553 de rendement des actifs (121,75 = 103,54 + 18,21 en octobre 2026).")
    F.wb("cep_flux_economise_md", C, cap, "E4", "Md€ par an", "Flux économisé affecté à la capitalisation", None, "annonce", nd=3)
    F.wb("cep_eco_budgetaire_pleine_md", C, cap, "E5", "Md€ par an", "Économie budgétaire en année pleine affectée à la capitalisation", None, "annonce", nd=3)
    F.wb("cep_eco_locale_pleine_md", C, cap, "E6", "Md€ par an", "Économie locale en année pleine affectée à la capitalisation", None, "annonce", nd=3)
    F.wb("cep_assurance_chomage_md", C, cap, "E7", "Md€ par an", "Assurance chômage transformée en épargne", None, "annonce", nd=3, note="Base de dépenses : 37,1 Md€.")
    F.wb("cep_reliquat_annee_1_md", C, cap, "E8", "Md€", "Reliquat de l'année 1 après suppression de la CSG, affecté à la capitalisation", None, "annonce", nd=3)
    F.wb("actifs_a_restituer_md", C, cap, "C10", "Md€", "Actifs publics à restituer (participations, foncier, logements publics, parc social)", 2024, "annonce", nd=3,
         note="605,27 Md€ (606,97 en octobre 2026) ; le manifeste : « 600 milliards d'euros de patrimoine public rendus aux Français ».")
    F.wb("actifs_rendement_net_pct", C, cap, "D10", "%", "Rendement net annuel supposé des actifs rendus", None, "annonce", scale=100, nd=2)
    F.wb("actifs_rendement_md", C, cap, "E10", "Md€ par an", "Rendement net annuel des actifs rendus", None, "annonce", nd=3, note="17,553 Md€ (18,209 en octobre 2026), égal à la ligne « patrimoine » de l'Annexe Manuscrit ; affiché « 18 » dans le tableau de donnees.html.")
    F.wb("actifs_participations_md", C, cap, "C11", "Md€", "Actifs à restituer : participations financières", 2024, "annonce", nd=3)
    F.wb("actifs_foncier_public_md", C, cap, "C12", "Md€", "Actifs à restituer : patrimoine foncier public", 2024, "annonce", nd=3)
    F.wb("actifs_logements_publics_md", C, cap, "C13", "Md€", "Actifs à restituer : logements publics", 2024, "annonce", nd=3)
    F.wb("actifs_parc_social_md", C, cap, "C14", "Md€", "Actifs à restituer : parc social", 2024, "annonce", nd=3)
    F.site("actifs_manifeste_md", 600, "Md€", "« 600 milliards d'euros de patrimoine public rendus aux Français »", 2026, "manifeste", "600 milliards d’euros de patrimoine public rendus aux Français")
    F.site("actifs_par_foyer_manifeste_eur", 20000, "€ par foyer", "« soit 20 000 euros par foyer en trois ans »", 2026, "manifeste", "soit 20 000 euros par foyer en trois ans")
    F.site("actifs_rendement_foyer_fiche_eur_an", 600, "€ par foyer et par an", "« 600 € par an, ce que votre capital rapporte » (fiche Foyer)", 2026, "fiches__foyer", "**600 €** : Par an, ce que votre capital rapporte")
    F.wb("actifs_rendement_personne_eur_an", G, "GraphAFU", "C27", "€ par personne et par an", "Rendement du patrimoine restitué par personne (graphique « Solidarité nationale au cours de la vie »)", None, "annonce", nd=0, expect=264)
    F.calc("foyers_implicites_actifs_m", ["actifs_manifeste_md", "actifs_par_foyer_manifeste_eur"], lambda a, b: a * 1000 / b, "millions de foyers", "Nombre de foyers implicite de « 600 Md€ soit 20 000 € par foyer »", 2026,
           "actifs_manifeste_md × 1 000 ÷ actifs_par_foyer_manifeste_eur", nd=3, note="30 M : le même dénominateur que le « 30 M de foyers » des fiches.")
    F.calc_value("cep_implicite_classeur_eur_mois_30m", clean(F.v("cep_flux_capitalisation_md") * 1e9 / 12 / 30e6, 0), ["cep_flux_capitalisation_md"],
                 "€ par foyer et par mois", "Flux vers la capitalisation du classeur, par foyer et par mois (30 M de foyers)", None,
                 "cep_flux_capitalisation_md × 10⁹ ÷ 12 ÷ 30 000 000", note="≈ 339 €/mois avec 30 M de foyers (nombre des fiches), 344 € avec les 29,5 M du tableau des 236 Md€, 350 € si l'on divise par les 29 M de travailleurs : le « 300 € » du manifeste n'est pas directement vérifiable. 121,94 Md€ comprend 29,6 Md€ d'assurance chômage, qui ne vont pas tous aux travailleurs en emploi.")
    # value added per hour
    va = "GraphVA"
    F.wb("va_heure_total_eur", G, va, "B25", "€ par heure", "Valeur ajoutée créée par une heure de travail", None, "annonce", expect=63, nd=0, note="Calcul de Résolution, sans source externe dans l'onglet.")
    F.wb("va_heure_etat_eur", G, va, "B26", "€ par heure", "Valeur ajoutée d'une heure de travail : prélèvements de l'État", None, "annonce", expect=29, nd=0)
    F.wb("va_heure_capital_eur", G, va, "B27", "€ par heure", "Valeur ajoutée d'une heure de travail : rémunération du capital", None, "annonce", expect=11, nd=0)
    F.wb("va_heure_salaire_net_eur", G, va, "B28", "€ par heure", "Valeur ajoutée d'une heure de travail : salaire net du travailleur", None, "annonce", expect=23, nd=0)
    for cid, lab in (("etat", "prélèvements de l'État"), ("capital", "rémunération du capital"), ("salaire_net", "salaire net")):
        F.calc(f"va_heure_{cid}_pct", [f"va_heure_{cid}_eur", "va_heure_total_eur"], lambda a, t: a / t * 100, "%", f"Part de la valeur ajoutée horaire : {lab}", None, f"va_heure_{cid}_eur ÷ va_heure_total_eur × 100", nd=1)
    # chômage etc.
    F.site("chomage_duree_avant_mois", 13, "mois", "Durée d'indemnisation du chômage aujourd'hui (fiche)", 2026, "fiches__personne-sans-emploi", "L’indemnisation passe de treize à six mois")
    F.site("chomage_duree_apres_mois", 6, "mois", "Durée d'indemnisation du chômage après le plan (fiche)", 2026, "fiches__personne-sans-emploi", "L’indemnisation passe de treize à six mois",
           note="Aucun texte de loi pour cette règle ; seule la contribution de l'assurance chômage à France Travail est supprimée (PLF-P2 n° 23).")
    # état B
    cr = b_credits.build()
    t = cr["meta"]["totals"]
    from amend import pdf_url, quote_pages
    from lib import ETAT_B_CSV_REL
    src_b = {"kind": "amendment", "ref": "Amendements PLF-P2 n° 1 à 22 et n° 40 (article 58, état B) — lignes TOTAUX extraites dans " + ETAT_B_CSV_REL, "url": pdf_url("PLF-P2", 4)}
    F.add("credits_retires_cp_md", t["cp_retirees_md"], "Md€", "Crédits de paiement retirés par les 23 amendements d'état B", 2027, dict(src_b), "loi",
          note="21 034,5 M€ (39 905,0 M€ pour les 22 amendements de la version d'octobre 2026) ; effet au 1er janvier, au 1er avril ou au 1er juillet 2027 selon la nature des crédits de chaque mission.")
    F.add("credits_retires_ae_md", t["ae_retirees_md"], "Md€", "Autorisations d'engagement retirées par les 23 amendements d'état B", 2027, dict(src_b), "loi", note="24 261,6 M€ (43 855,4 M€ en octobre 2026).")
    _cover = "Les 22 premiers retirent, mission par mission, les crédits de l’état B que la présente loi interrompt. Le n° 23 supprime la contribution de l’assurance chômage à France Travail. Les 16 suivants sont normatifs. Le n° 40, ajouté en dernier numéro, retire les crédits de la mission « Outre-mer »."
    assert quote_in("amendements__Liasse_PLF_P2", _cover), "cover quote of Liasse PLF-P2"
    F.add("credits_retires_amendements_nombre", len(cr["missions"]), "amendements", "Amendements d'état B qui retirent les crédits des missions", 2027,
          {"kind": "amendment", "ref": "Liasse PLF-P2, page de couverture (page 1 du PDF) : 22 amendements d'état B, plus le n° 40 « Outre-mer »", "url": pdf_url("PLF-P2", 1), "quote": _cover, "page": 1}, "loi",
          note="Valeur : 23 amendements, un par mission (n° 1 à 22, plus le n° 40 « Outre-mer » ajouté en novembre 2026).")
    apl_cp = next(p for p in cr["missions"][0]["programmes"] if p["programme_fr"].startswith("Aide à l’accès au logement"))
    F.add("apl_etat_b_cp_md", apl_cp["cp_retirees_md"], "Md€", "Crédits de paiement retirés du programme « Aide à l'accès au logement » (PLF-P2 n° 1)", 2027,
          {"kind": "amendment", "ref": "Amendement PLF-P2 n° 1 (état B), ligne « Aide à l'accès au logement » : 2 690 349 921 € (8 067 767 822 € en octobre 2026), page " + str(quote_pages("PLF-P2", 1, "2 690 349 921")[0]) + " du PDF", "url": pdf_url("PLF-P2", quote_pages("PLF-P2", 1, "2 690 349 921")[0])}, "loi")
    F.amend("apl_economie_2027_expose_md", 5.4, "Md€", "Économie 2027 sur l'aide personnelle au logement selon l'exposé de PLF-P2 n° 32", 2027, "PLF-P2", 32, "L’économie de l’exercice 2027 est de 5,4 milliards d’euros")
    F.wb("apl_economie_annee_1_classeur_md", C, "D_tail_Economies", "D18", "Md€", "APL : économie de la première année (classeur)", None, "annonce", nd=1, note="5,4 Md€ en année 1 + 10,7 Md€ ensuite = 16,1 Md€ (Détail Economies).")


# ======================================================================================
# F. paramètres légaux
# ======================================================================================
def _f_loi(F: Facts):
    F.amend("tva_taux_normal_pct", 20, "%", "Taux normal de TVA (inchangé)", 2028, "PLF-P1", 21, "au taux normal, qui reste fixé à 20 %")
    F.amend("tva_alimentation_palier_1_pct", 10, "%", "TVA sur l'alimentation à partir du 1er juillet 2028", 2028, "PLF-P1", 21, "elle passe à 10 % au 1er juillet 2028")
    F.amend("tva_alimentation_palier_2_pct", 15, "%", "TVA sur l'alimentation à partir du 1er juillet 2029", 2029, "PLF-P1", 21, "à 15 % au 1er juillet 2029")
    F.amend("tva_alimentation_palier_3_pct", 20, "%", "TVA sur l'alimentation à partir du 1er juillet 2030", 2030, "PLF-P1", 21, "puis rejoint le taux normal au 1er juillet 2030")
    F.amend("tva_taux_reduits_cpo_2021_md", 30, "Md€", "Coût des taux réduits de TVA en 2021 (estimation du CPO citée par l'exposé)", 2021, "PLF-P1", 21, "à 30 milliards d’euros en 2021, dont 20 milliards sur l’eau et l’alimentation", tier="donnee")
    F.amend("is_taux_unique_pct", 27, "%", "Taux unique de l'impôt sur les sociétés", 2027, "PLF-P1", 23, "un seul taux, 27 %")
    F.amend("is_taux_affiche_pct", 25, "%", "Taux affiché de l'impôt sur les sociétés avant réforme", 2026, "PLF-P1", 23, "Le taux affiché de l’impôt sur les sociétés est de 25 %", tier="donnee")
    F.amend("is_taux_implicite_pme_pct", 21.4, "%", "Taux implicite d'IS des petites et moyennes entreprises (2022)", 2022, "PLF-P1", 23, "il s’établit à 21,4 % pour les petites et moyennes entreprises contre 14,3 % pour les grandes", tier="donnee")
    F.amend("is_taux_implicite_grandes_pct", 14.3, "%", "Taux implicite d'IS des grandes entreprises (2022)", 2022, "PLF-P1", 23, "il s’établit à 21,4 % pour les petites et moyennes entreprises contre 14,3 % pour les grandes", tier="donnee")
    F.amend("mutation_seuil_exoneration_eur", 10000, "€", "Droits de mutation : rien en dessous de ce montant", 2027, "PLF-P1", 19, "rien sous 10 000 euros, 1 % de 10 000 à 100 000 euros, 3 % au-delà")
    F.amend("mutation_taux_tranche_1_pct", 1, "%", "Droits de mutation : taux entre 10 000 et 100 000 €", 2027, "PLF-P1", 19, "rien sous 10 000 euros, 1 % de 10 000 à 100 000 euros, 3 % au-delà")
    F.amend("mutation_seuil_tranche_2_eur", 100000, "€", "Droits de mutation : seuil du taux supérieur", 2027, "PLF-P1", 19, "rien sous 10 000 euros, 1 % de 10 000 à 100 000 euros, 3 % au-delà")
    F.amend("mutation_taux_tranche_2_pct", 3, "%", "Droits de mutation : taux au-delà de 100 000 €", 2027, "PLF-P1", 19, "rien sous 10 000 euros, 1 % de 10 000 à 100 000 euros, 3 % au-delà")
    F.amend("mutation_exemple_vendeur_eur", 3900, "€", "Exemple de l'amendement n° 19 : pour un appartement de 200 000 €, le vendeur acquitte 3 900 €", 2027, "PLF-P1", 19, "le vendeur acquitte 3 900 euros",
            note="Qui paie : voir D41 (l'exposé dit le vendeur, le n° 20 impute les droits payés à l'achat). L'exposé compte 10 000 € payés comptant aujourd'hui (3,80 % + 1,20 %) ; ce n'est plus le cas : depuis la hausse permise par la loi de finances pour 2025 (art. 116, du 1er avril 2025), 88 départements appliquent 5 % (au 1er juin 2026), soit environ 6,32 % avec la taxe communale et les frais d'assiette, donc environ 12 640 € sur 200 000 € (BOFiP 14771-PGP, 17 juin 2026 ; Banque des Territoires, jechange.fr). Environ 11 610 € dans un département resté à 4,50 % et pour un premier achat de résidence principale.")
    F.amend("plusvalue_taux_unique_pct", 30, "%", "Prélèvement unique sur les plus-values (gain réel)", 2027, "PLF-P1", 20, "un prélèvement unique de 30 %")
    F.amend("taxe_fonciere_taux_min_pct", 10, "%", "Taxe foncière unique : taux communal minimal", 2028, "PLF-P1", 29, "Ce taux est compris entre 10 % et 30 %")
    F.amend("taxe_fonciere_taux_max_pct", 30, "%", "Taxe foncière unique : taux communal maximal", 2028, "PLF-P1", 29, "Ce taux est compris entre 10 % et 30 %")
    F.amend("taxe_sur_salaires_rendement_md", 17.9, "Md€", "Rendement de la taxe sur les salaires", 2026, "PLFSS", 3, "La taxe sur les salaires rapporte 17,9 milliards d’euros")
    F.amend("bouclier_sanitaire_taux_pct", 5, "% des ressources", "Plafond annuel du reste à charge en santé", 2028, "PLFSS", 4, "IV. – Ce taux est de 5 %")
    F.amend("indemnite_sortie_taux_pct", 70, "% de l'assiette", "Indemnité de sortie des agents publics dont l'emploi est supprimé", 2027, "PLF-P2", 26, "Le taux de l’indemnité est de 70 % de l’assiette")
    F.amend("indemnite_sortie_duree_max_ans", 7, "années", "Durée maximale de l'indemnité de sortie (84 mois)", 2027, "PLF-P2", 26, "Cet amendement indemnise jusqu’à sept ans le fonctionnaire de l’État dont l’emploi est supprimé",
            note="Version de novembre 2026 : 24 mois plus un mois par trimestre de services, 84 mois au plus (voir indemnite_sortie_duree_max_mois), et au plus jusqu'à la date à laquelle une pension sans coefficient de minoration peut être obtenue. En octobre : 1 à 7 ans selon l'ancienneté.")
    F.amend("indemnite_sortie_duree_max_mois", 84, "mois", "Durée maximale de l'indemnité de sortie des agents publics dont l'emploi est supprimé", 2027, "PLF-P2", 26, "Elle est au plus égale à quatre-vingt-quatre mois")
    F.amend("indemnite_sortie_duree_base_mois", 24, "mois", "Durée de base de l'indemnité de sortie (avant l'ajout d'un mois par trimestre de services)", 2027, "PLF-P2", 26, "Sa durée est de vingt-quatre mois, augmentée d’un mois par trimestre de services publics effectifs")
    F.amend("foyers_fiscaux_loi_m", 40.2, "millions de foyers fiscaux", "Foyers fiscaux (exposé de PLF-P1 n° 28, source CPO octobre 2024)", 2023, "PLF-P1", 28, "Sur 40,2 millions de foyers fiscaux", tier="donnee")
    F.amend("foyers_fiscaux_irpp_loi_m", 18.5, "millions de foyers fiscaux", "Foyers fiscaux ayant acquitté l'impôt sur le revenu au titre de 2023", 2023, "PLF-P1", 28, "18,5 millions seulement ont acquitté l’impôt sur le revenu au titre de 2023", tier="donnee")
    F.amend("cep_montant_loi_eur", 0, "€", "Compte d'épargne personnel : aucun montant n'est inscrit dans l'amendement (versements fixés chaque année par la loi de finances, nuls à défaut)", 2028, "PLF-P1", 27,
            "aucun montant n’est inscrit ici", note="Valeur 0 = valeur par défaut, pas un montant inscrit : « À défaut de montant global fixé au titre d’une année, ce montant est nul » ; les 300 €/mois et 20 000 €/foyer sont des annonces sans base légale chiffrée.")


# ======================================================================================
# G. fiches (population anchors and other headline figures)
# ======================================================================================
def _g_fiches(F: Facts):
    pops = [
        ("fiche_pop_citoyens", 68_000_000, "personnes", "Citoyens (en-tête de la fiche Citoyen)", "fiches__citoyen", "68 M · 1 perte · 13 gains"),
        ("fiche_pop_foyers", 30_000_000, "foyers", "Foyers (en-tête des fiches Foyer et Contribuable)", "fiches__foyer", "30 M · 1 perte · 5 gains"),
        ("fiche_pop_travailleurs", 29_000_000, "personnes", "Travailleurs (en-tête de la fiche Travailleur)", "fiches__travailleur", "29 M · 8 gains"),
        ("fiche_pop_retraites", 17_000_000, "personnes", "Retraités (en-tête de la fiche Retraité)", "fiches__retraite", "17 M · 2 pertes · 3 gains"),
        ("fiche_pop_sans_emploi", 5_700_000, "personnes", "Personnes sans emploi (en-tête de la fiche)", "fiches__personne-sans-emploi", "5,7 M · 3 pertes · 3 gains"),
        ("fiche_pop_jeunes_adultes", 4_000_000, "personnes", "Jeunes adultes (en-tête de la fiche)", "fiches__jeune-adulte", "4 M · 1 perte · 8 gains"),
        ("fiche_pop_agents_indispensables", 5_220_000, "personnes", "Agents publics indispensables (en-tête de la fiche)", "fiches__agent-public-indispensable", "5,22 M · 1 perte · 4 gains"),
        ("postes_publics_fermes_fiche", 580_000, "postes", "Postes publics fermés (en-tête de la fiche Agent public dont le poste est supprimé)", "fiches__agent-public-dont-le-poste-est-supprime", "580 000 postes publics · 1 perte · 3 gains"),
    ]
    for fid, val, unit, label, page, q in pops:
        F.site(fid, val, unit, label, 2026, page, q)
    F.site("fiche_afu_handicap_eur_mois", 1100, "€ par mois", "« 1 100 € par mois, versés automatiquement » (fiche Personne handicapée)", 2026, "fiches__personne-handicapee", "**1 100 €** : Par mois, versés automatiquement")
    F.site("fiche_retraite_complement_eur_an", 500, "€ par an", "« 500 € par an au moins, votre complément viager du patrimoine restitué » (fiche Retraité)", 2026, "fiches__retraite", "Par an au moins, votre complément viager du patrimoine restitué")
    F.site("fiche_locataire_offre_pct", 25, "%", "« +25 % d'offre locative privée en plus » (fiche Locataire)", 2026, "fiches__locataire", "D'offre locative privée en plus")
    F.site("fiche_patient_gestion_eur_an", 300, "€ par an", "« 300 € par an de frais de gestion en moins » (fiche Patient)", 2026, "fiches__patient", "Par an de frais de gestion en moins")
    F.site("fiche_consommateur_81_pct", 81, "%", "« 81 % : les produits faits en France que vous consommez deviennent plus abordables » (fiche Consommateur, sans source)", 2026, "fiches__consommateur", "Les produits faits en France que vous consommez deviennent plus abordables")
    F.site("fiche_inflation_faciale_pct", 2, "% (borne haute)", "« inflation faciale inférieure à 2 % » (fiche Citoyen)", 2026, "fiches__citoyen", "inflation faciale inférieure à 2 %")
    F.site("fiche_niches_supprimees_md", 143, "Md€", "« 143 Md€ : De niches supprimées, dont 52 milliards d'euros vous reviennent en baisse de charges et de taxes » (fiche Contribuable)", 2026, "fiches__contribuable", "**143 Md€** : De niches supprimées")
    F.site("fiche_niches_baisse_charges_md", 52, "Md€", "« dont 52 milliards d'euros vous reviennent en baisse de charges et de taxes » (fiche Contribuable)", 2026, "fiches__contribuable", "dont 52 milliards d'euros vous reviennent en baisse de charges et de taxes")
    F.site("fiche_parc_social_actif_net_md", 340, "Md€", "Actif net des organismes de logement social estimé à « 340 milliards d'euros » (fiche Locataire)", 2026, "fiches__locataire", "L’actif net des organismes de logement social est estimé à 340 milliards d’euros")
    F.site("fiche_parc_social_logements_m", 4.5, "millions de logements", "« quatre millions et demi de logements » remis sur le marché par la vente du parc social (fiche Locataire)", 2026, "fiches__locataire", "remet quatre millions et demi de logements sur le marché")


# ======================================================================================
# H. human-scale reframings (calcul)
# ======================================================================================
def _h_reframings(F: Facts):
    F.calc("niches_total_par_foyer_eur", ["niches_total_md", "foyers_implicites_236_m"], lambda a, f: a * 1000 / f, "€ par foyer et par an", "Niches fiscales et taux réduits de TVA (486) par foyer et par an", 2024,
           "niches_total_md × 1 000 ÷ foyers_implicites_236_m", nd=0, note="Dénominateur : 29,5 M de foyers (celui du tableau des 236 Md€) ; le livre ne publie pas ce chiffre.")
    F.calc("po_baisse_par_foyer_eur", ["po_baisse_md", "foyers_implicites_236_m"], lambda a, f: a * 1000 / f, "€ par foyer et par an", "Baisse des prélèvements obligatoires visée par foyer et par an", None,
           "po_baisse_md × 1 000 ÷ foyers_implicites_236_m", nd=0, note="Dénominateur : 29,5 M de foyers (celui du tableau des 236 Md€).")
    F.calc("csg_crds_par_foyer_eur", ["csg_crds_activite_md", "foyers_implicites_236_m"], lambda a, f: a * 1000 / f, "€ par foyer et par an", "CSG + CRDS sur les revenus d'activité par foyer et par an", 2024,
           "csg_crds_activite_md × 1 000 ÷ foyers_implicites_236_m", nd=0, note="Dénominateur : 29,5 M de foyers (celui du tableau des 236 Md€) ; par foyer et non par salarié.")
    F.calc("agences_par_foyer_eur", ["eco236_agences_md", "foyers_implicites_236_m"], lambda a, f: a * 1000 / f, "€ par foyer et par an", "Agences non indispensables : coût par foyer et par an", None,
           "eco236_agences_md × 1 000 ÷ foyers_implicites_236_m", nd=0, note="Le tableau du livre affiche 300 € (arrondi aux 10 € ; les « € par foyer » du tableau sont arrondis ligne à ligne, ce qui laisse un dénominateur implicite de 27,7 à 30,8 M de foyers selon la ligne).")
    F.calc("dep_dette_part_pct", ["dep_charge_dette_2024_md", "dep_total_2024_md"], lambda a, b: a / b * 100, "%", "Part de la charge de la dette dans la dépense publique", 2024,
           "dep_charge_dette_2024_md ÷ dep_total_2024_md × 100", nd=2)
    F.calc("dep_retraites_sante_part_pct", ["dep_retraites_2024_md", "dep_sante_2024_md", "dep_total_2024_md"], lambda a, b, t: (a + b) / t * 100, "%", "Part des retraites et de la santé dans la dépense publique", 2024,
           "(dep_retraites_2024_md + dep_sante_2024_md) ÷ dep_total_2024_md × 100", nd=2)
    F.calc("cep_300_en_part_net_median_pct", ["restitution_epargne_manifeste_eur_mois", "csg_salaire_net_median_eur"], lambda a, b: a / b * 100, "% du salaire net médian", "« 300 € par mois » d'épargne rapportés au salaire net médian", None,
           "restitution_epargne_manifeste_eur_mois ÷ csg_salaire_net_median_eur × 100", nd=1)


# ======================================================================================
# I. conflicts (source-analysis §7 and the pipeline's own findings)
# ======================================================================================
def _i_conflicts(F: Facts):
    F.conflict("gain_csg_median", ["csg_gain_median_manifeste_eur_mois", "csg_gain_median_mois_eur", "csg_gain_pct_manifeste", "csg_gain_median_pct", "csg_gain_pct_fiche"],
               "Au salaire net médian (2 190 €), le manifeste annonce 300 €/mois et +13 % ; le classeur du livre donne 275,08 €/mois (12,56 %). 13 % × 2 190 € = 284,7 €. Le « 13 % » arrondit les 12,56 % du classeur au salaire net médian (12,04 % au SMIC).")
    F.conflict("gain_csg_smic", ["csg_gain_smic_fiche_eur_mois", "csg_gain_smic_mois_eur"],
               "Au SMIC, la fiche Travailleur annonce « 180 euros de plus par mois » ; le classeur donne 171,72 €/mois (SMIC 2025, 12,04 %), 173,74 € (01/2026) et 177,93 € (06/2026).")
    F.conflict("restitution_600_eur", ["restitution_epargne_manifeste_eur_mois", "cep_implicite_classeur_eur_mois_30m"],
               "« 600 € par mois » = 300 € de salaire net + 300 € d'épargne. Les flux du classeur vers la capitalisation (121,94 Md€) représentent ≈ 339 €/mois par foyer (30 M de foyers) ou 350 € par travailleur (29 M) : le 300 € n'est pas directement vérifiable, et les lettres aux élus annoncent « 25 % » de hausse en trois ans.")
    F.conflict("nb_impots_cibles", ["impots_cibles_manifeste", "impots_cibles_lettres"],
               "« Quatre impôts » (TVA, revenu, sociétés, foncier) dans le manifeste ; « 5 impôts au lieu de 438 » dans les lettres aux élus. Les amendements PLFSS n° 1 à 3 maintiennent en outre la CSG sur les pensions, le chômage et les indemnités journalières (n° 1) et sur les revenus du capital (n° 2, qui laisse leurs parts « inchangées » dans la clé de répartition), et une taxe sur les salaires jusqu'en 2029 (n° 3, abrogée au 1er janvier 2030). Le n° 9, en revanche, majore le taux de la CSG sur les revenus du patrimoine et les produits de placement (articles L. 136-6 et L. 136-7) pour compenser la suppression de vingt et une contributions : la CSG sur le capital n'est donc pas laissée telle quelle.")
    F.conflict("afu_smic", ["afu_smic_amendement_eur_mois", "afu_smic_net_fiche_eur_mois", "afu_smic_net_calc_eur_mois"],
               "L'exposé de PLF-P1 n° 28 dit que le salarié au SMIC « reçoit 550 € par mois de l'administration fiscale » (aide brute) ; la fiche annonce « +220 € » et le classeur (GraphIR) raisonne en versement net : aide 6 600 € − 23 % du revenu, soit ≈ 220 €/mois au niveau du SMIC.")
    F.conflict("foyer_denominateurs", ["fiche_pop_foyers", "foyers_implicites_dep_m", "foyers_implicites_236_m", "foyers_implicites_actifs_m", "foyers_fiscaux_loi_m"],
               "Le livre utilise quatre « foyers » différents : 30 M dans les fiches et dans « 600 Md€ soit 20 000 € par foyer » ; 31,0 M implicites dans « 54 000 € par foyer » ; 29,5 M implicites dans « 8 000 € par foyer » ; et 40,2 M de foyers fiscaux dans l'exposé de PLF-P1 n° 28 (dont 18,5 M seulement ont payé l'impôt sur le revenu au titre de 2023). L'aide fondamentale est versée par personne.")
    F.conflict("operateurs_nombre", ["agences_operateurs_plf", "agences_operateurs_loi"],
               "L'exposé de PLF-P2 n° 25 cite 431 opérateurs ; le classeur en compte 434 (somme de ses 180 lignes ; 433 selon la source-analyse du dépôt).")
    F.conflict("agences_fermees_vs_dissoutes", ["agences_fermees", "agences_dissoutes_loi"],
               "746 agences d'État supprimées ou cédées dans le livre (périmètre : 1 104 agences d'État) contre 337 personnes morales nommées dans la liste de dissolution de PLF-P2 n° 25 (au 1er juillet 2027) : périmètres différents, pas de table de correspondance publiée.")
    F.conflict("apl_economie_2027", ["apl_economie_2027_expose_md", "apl_etat_b_cp_md", "apl_economie_annee_1_classeur_md"],
               "L'exposé de PLF-P2 n° 32 chiffre l'économie 2027 de l'APL à 5,4 Md€ ; l'amendement n° 1 (état B) retire désormais 2,690 Md€ de crédits de paiement du programme « Aide à l'accès au logement » (16,52 Md€ au texte déposé ; 8,068 Md€ retirés dans la version d'octobre 2026) ; le classeur donne 5,4 Md€ en année 1 puis 10,7 Md€ ensuite. L'écart n'est pas expliqué dans les sources et a changé de sens : l'état B retire moins que l'économie annoncée.")
    F.conflict("record_mondial", ["eu_dep_rang_fr_2024", "eu_dep_pib_fi_2024_pct", "eu_dep_pib_fr_2024_pct"],
               "Le manifeste parle de « record mondial » de dépense publique. Dans les données Eurostat (mise à jour du 21 octobre 2026), la Finlande (57,9 % du PIB en 2024 ; 57,5 % en 2025) dépasse la France (57,0 % ; 57,3 %) : la France est 2e sur 30 pays. Le classeur du livre, d'un millésime antérieur, donnait déjà la Finlande devant (57,7 % ; 57,5 %, contre 57,0 % ; 57,2 %).")
    F.conflict("depenses_pib_france_2024", ["eu_dep_pib_fr_2024_pct", "dep_pib_insee_calc_pct"],
               "57,0 % (Eurostat tec00023) contre 57,26 % en rapportant le total COFOG Insee (1 671,794 Md€) au PIB 2024 du classeur (2 919,9 Md€, « Refonte fiscalité », C3). Pour obtenir 57,0 % avec cette dépense, il faudrait un PIB d'environ 2 933 Md€ (13 Md€, soit 0,4 %, de plus) : l'écart tient au PIB pris au dénominateur, la dépense étant la même.")
    F.conflict("eco236_total", ["eco236_total_md", "eco236_graph236_total_md"],
               "Le total des économies est 236,353 Md€ dans l'Annexe Manuscrit (colonne C, égale à E + F depuis novembre 2026), 236,402 Md€ dans la feuille Graph236 de « Séries des graphiques » qui alimente le graphique du livre (écart 0,050 Md€ : la ligne patrimoine y vaut 17,602 au lieu de 17,553), et 236,398 Md€ en additionnant les destinations de la feuille Input Capitalisation (114,46 + 121,938). Les quatre valeurs arrondissent à 236.")
    F.conflict("nb_impots_graphique", ["impots_nombre_manifeste", "impots_nombre_graphique_fusion"],
               "« 438 impôts » (manifeste, page Propositions, fiches) contre « 434 prélèvements aujourd'hui » dans le titre du graphique « Fusion des impôts » (novembre 2026) : la source ne dit pas quels prélèvements séparent 434 de 438.")
    F.conflict("eco236_arrondis_web", ["eco236_web_fonctionnement_md", "eco236_fonctionnement_md", "eco236_web_subventions_md", "eco236_subventions_md"],
               "Le tableau arrondi du site (donnees.html) affiche 39 Md€ pour le fonctionnement des administrations (4 + 10 + 9 + 12 + 4) et 69 pour les subventions ; le classeur de novembre 2026 donne 38,117 et 68,858 (37,432 et 68,948 en octobre) ; le tableau de donnees.html n'a pas été mis à jour par les auteurs. Utiliser le classeur.")
    F.conflict("niches_cout_2026", ["niches_cout_2026_expose_md", "niches_cout_2026_somme_md"],
               "L'exposé de PLF-P1 n° 1 cite 79,5 Md€ pour 2026 ; la somme des 465 lignes 2026 du classeur est 79,613 Md€ (écart 0,113 Md€, ε et nc comptés pour 0).")
    F.conflict("niches_montant", ["niches_total_md", "fiche_niches_supprimees_md", "niches_cout_2024_md"],
               "Trois montants de « niches » : 134,7 Md€ (486 niches et taux réduits, 2024) ; 89,4 Md€ (les 465 niches seules) ; 143 Md€ « de niches supprimées » dans la fiche Contribuable. 143 ≈ 72,3 + 18 + 53 de la feuille Flux (niches fiscales + niches sociales + autre gisement) [inférence] : périmètre incluant 18 Md€ de niches sociales qui ne sont pas dans les 486.")
    F.conflict("postes_fermes_arrondi", ["postes_fermes_total_classeur", "postes_fermes_apuc_plus_apul"],
               "151 000 (administrations centrales) + 428 500 (collectivités) = 579 500, contre 580 000 annoncés : arrondi de l'objectif.")
