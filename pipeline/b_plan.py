"""plan-flux.json — « Le plan en un schéma » : 236 Md€ → salaire net + épargne.

Sources: Synthèse Chiffres (Annexe Manuscrit, Flux, CSG-CRDS, Input Capitalisation,
Refonte fiscalité), Synthèse Graphiques (GraphVA, GraphIR), donnees.md (rounded web
table), PLFSS amendment 2 (where the 114 Md€ of CSG/CRDS go).

Interpretation of the Sankey (documented in `sankey.interpretation`):
  catégorie d'économie  →  calendrier (année 1 | gain supplémentaire en année pleine)
                         →  destination (salaire net | capitalisation)
* The first link layer is exact: columns E (« Gain en année 1 ») and F (« Gain supp. en
  année pleine ») of the Annexe Manuscrit, per category.
* The workbook's own reconciliation (sheet Input Capitalisation) funds the CSG/CRDS
  restitution (114,46 Md€) from the year-1 gains and sends everything else — the year-1
  leftover, the later gains, the unemployment-insurance savings and the asset yield —
  to the capitalisation / savings account (121,749 Md€).  The year-1 → salaire net link
  is therefore the stated 114,46 Md€; the year-1 → capitalisation link is the remainder.
* Residuals are never hidden: see `reconciliation`.
"""
from __future__ import annotations

import re

from lib import Sheet, clean, fr, parse_num, quote_in, read_page, ws, SITE

AM = "Annexe_Manuscrit"

# row -> (id, parent id, level, kind)
ROWS = {
    3: ("total", None, 0, "total"),
    4: ("structures", "total", 1, "categorie"),
    5: ("fonctionnement", "structures", 2, "sous_total"),
    6: ("etat_fonctionnement", "fonctionnement", 3, "poste"),
    7: ("echelons_locaux", "fonctionnement", 3, "poste"),
    8: ("agences", "fonctionnement", 3, "poste"),
    9: ("culture_loisirs_locaux", "fonctionnement", 3, "poste"),
    10: ("audiovisuel_public", "fonctionnement", 3, "poste"),
    11: ("masse_salariale", "structures", 2, "sous_total"),
    12: ("depart_agents_etat", "masse_salariale", 3, "poste"),
    13: ("depart_agents_locaux", "masse_salariale", 3, "poste"),
    14: ("subventions", "total", 1, "categorie"),
    15: ("subv_entreprises", "subventions", 2, "sous_total"),
    16: ("aides_emploi_entreprises", "subv_entreprises", 3, "poste"),
    17: ("aides_investissement", "subv_entreprises", 3, "poste"),
    18: ("aides_locales_entreprises", "subv_entreprises", 3, "poste"),
    19: ("subv_particuliers_asso", "subventions", 2, "sous_total"),
    20: ("cheques_cibles", "subv_particuliers_asso", 3, "poste"),
    21: ("hebergement_soins", "subv_particuliers_asso", 3, "poste"),
    22: ("autres_associations", "subv_particuliers_asso", 3, "poste"),
    23: ("apd", "subv_particuliers_asso", 3, "poste"),
    24: ("niches", "total", 1, "categorie"),
    25: ("niches_revenus", "niches", 2, "poste"),
    26: ("niches_tva_societes", "niches", 2, "poste"),
    27: ("chomage", "total", 1, "categorie"),
    28: ("patrimoine", "total", 1, "categorie"),
}
EXPECT = {  # sanity: start of the label expected on each row
    3: "Total des économies", 4: "Economies sur les structures facultatives", 5: "Économies sur le fonctionnement",
    11: "Économies sur la masse salariale", 14: "Economies sur les subventions", 24: "Économies sur les niches",
    27: "Assurance chômage", 28: "Patrimoine public",
}
CATEGORY_LABELS = {
    "structures": "Structures facultatives de l'État et des collectivités",
    "subventions": "Subventions aux entreprises, particuliers et associations",
    "niches": "Niches fiscales et sociales (net)",
    "chomage": "Assurance chômage transformée en épargne",
    "patrimoine": "Rendement net du patrimoine public valorisé",
}


def _num0(sh: Sheet, addr: str) -> float:
    """cell value; the workbook writes a dash (-) for nil gains."""
    v = sh.num(addr)
    return 0.0 if v is None else v


def _web_table():
    """rows of the rounded web table in research/pages/donnees.md (26 rows)."""
    txt = read_page("donnees")
    rows = []
    for line in txt.splitlines():
        m = re.match(r"^\|\s*(.+?)\s*\|\s*([\d\s  ]+)\s*\|\s*([\d\s  ]+)\s*\|\s*$", line)
        if m and not line.startswith("|---") and "Md€" not in line:
            def n(x):
                return int(re.sub(r"[\s  ]", "", x))
            rows.append({"label_fr": ws(m.group(1)), "md": n(m.group(2)), "eur_par_foyer": n(m.group(3))})
    return rows


def _savings():
    sh = Sheet.get("chiffres", AM)
    web = _web_table()
    assert len(web) == 26, len(web)
    recs = []
    for r in range(3, 29):
        rid, parent, level, kind = ROWS[r]
        label = ws(sh.at(r - 1, 1))
        if r in EXPECT:
            assert label.startswith(EXPECT[r]), (r, label)
        rec = {
            "id": rid, "parent_id": parent, "level": level, "kind": kind,
            "code": sh.at(r - 1, 0) or None,
            "label_fr": label,
            "md_par_an": clean(_num0(sh, f"C{r}"), 6),
            "eur_par_foyer_an": clean(_num0(sh, f"D{r}"), 0),
            "gain_annee_1_md": clean(_num0(sh, f"E{r}"), 6),
            "gain_supp_annee_pleine_md": clean(_num0(sh, f"F{r}"), 6),
            "cells": f"C{r}:F{r}",
            "web_arrondi": {"label_fr": web[r - 3]["label_fr"], "md": web[r - 3]["md"], "eur_par_foyer": web[r - 3]["eur_par_foyer"]},
        }
        rec["ecart_c_vs_e_plus_f_md"] = clean(rec["md_par_an"] - rec["gain_annee_1_md"] - rec["gain_supp_annee_pleine_md"], 6)
        rec["web_md_ecart"] = clean(rec["web_arrondi"]["md"] - rec["md_par_an"], 3)
        recs.append(rec)
    by_id = {x["id"]: x for x in recs}

    checks = {"children_sums": [], "rows_where_C_differs_from_E_plus_F": [], "web_rounding_breaks": []}
    for rec in recs:
        kids = [k for k in recs if k["parent_id"] == rec["id"]]
        if not kids:
            continue
        for key in ("md_par_an", "gain_annee_1_md", "gain_supp_annee_pleine_md"):
            s = sum(k[key] for k in kids)
            assert abs(s - rec[key]) < 1e-6, (rec["id"], key, s, rec[key])
        checks["children_sums"].append({"id": rec["id"], "n_children": len(kids), "ok": True})
        s_web = sum(k["web_arrondi"]["md"] for k in kids)
        if s_web != rec["web_arrondi"]["md"]:
            checks["web_rounding_breaks"].append({"id": rec["id"], "web_subtotal": rec["web_arrondi"]["md"], "web_children_sum": s_web,
                                                  "workbook_subtotal_md": rec["md_par_an"]})
    for rec in recs:
        if abs(rec["ecart_c_vs_e_plus_f_md"]) > 1e-6:
            checks["rows_where_C_differs_from_E_plus_F"].append({"id": rec["id"], "label_fr": rec["label_fr"], "md_par_an": rec["md_par_an"],
                                                                 "e_plus_f": clean(rec["gain_annee_1_md"] + rec["gain_supp_annee_pleine_md"], 6),
                                                                 "ecart_md": rec["ecart_c_vs_e_plus_f_md"]})
    assert sorted(x["id"] for x in checks["rows_where_C_differs_from_E_plus_F"]) == ["patrimoine", "total"], checks["rows_where_C_differs_from_E_plus_F"]
    return sh, recs, by_id, checks


def _sankey(sh, recs, by_id):
    cats = ["structures", "subventions", "niches", "chomage", "patrimoine"]
    y1 = {c: by_id[c]["gain_annee_1_md"] for c in cats}
    full = {c: by_id[c]["gain_supp_annee_pleine_md"] for c in cats}
    y1_tot = clean(sum(y1.values()), 6)
    full_tot = clean(sum(full.values()), 6)
    assert abs(y1_tot - by_id["total"]["gain_annee_1_md"]) < 1e-6
    assert abs(full_tot - by_id["total"]["gain_supp_annee_pleine_md"]) < 1e-6
    csg = sheet_csg()
    salaire = csg["csg_crds_activite_md"]  # 114.46
    cap_from_y1 = clean(y1_tot - salaire, 6)
    cap_total = clean(cap_from_y1 + full_tot, 6)
    stated_cap = Sheet.get("chiffres", "Input_Capitalisation").num("E2")
    nodes = [
        {"id": c, "label_fr": CATEGORY_LABELS[c], "layer": 0, "kind": "categorie",
         "value_md": clean(y1[c] + full[c], 6), "md_par_an_classeur": by_id[c]["md_par_an"]}
        for c in cats
    ] + [
        {"id": "annee_1", "label_fr": "Gain dès l'année 1", "layer": 1, "kind": "calendrier", "value_md": y1_tot},
        {"id": "annee_pleine", "label_fr": "Gain supplémentaire en année pleine", "layer": 1, "kind": "calendrier", "value_md": full_tot},
        {"id": "salaire_net", "label_fr": "Salaire net (fin de la CSG/CRDS sur l'activité)", "layer": 2, "kind": "destination",
         "value_md": clean(salaire, 6), "value_md_classeur": clean(salaire, 6)},
        {"id": "capitalisation", "label_fr": "Capitalisation / compte d'épargne", "layer": 2, "kind": "destination",
         "value_md": cap_total, "value_md_classeur": clean(stated_cap, 6)},
    ]
    links = []
    for c in cats:
        if y1[c]:
            links.append({"source": c, "target": "annee_1", "value_md": y1[c], "kind": "exact_classeur", "cell": f"E{_row(c)}"})
        if full[c]:
            links.append({"source": c, "target": "annee_pleine", "value_md": full[c], "kind": "exact_classeur", "cell": f"F{_row(c)}"})
    links.append({"source": "annee_1", "target": "salaire_net", "value_md": clean(salaire, 6), "kind": "montant_affirme_classeur",
                  "ref": "Synthèse Chiffres › CSG-CRDS!I3 (114,46 Md€, PLACSS 2024 annexe 1)"})
    links.append({"source": "annee_1", "target": "capitalisation", "value_md": cap_from_y1, "kind": "calcule",
                  "formula": "gain année 1 (127,352) − CSG/CRDS restituée (114,46)"})
    links.append({"source": "annee_pleine", "target": "capitalisation", "value_md": full_tot, "kind": "exact_classeur"})
    # balance checks
    for n in nodes:
        inflow = sum(l["value_md"] for l in links if l["target"] == n["id"])
        outflow = sum(l["value_md"] for l in links if l["source"] == n["id"])
        if n["layer"] == 0:
            assert abs(outflow - n["value_md"]) < 1e-6, n
        elif n["layer"] == 1:
            assert abs(inflow - outflow) < 1e-6, (n, inflow, outflow)
        else:
            assert abs(inflow - n["value_md"]) < 1e-6, (n, inflow)
    total_in = clean(sum(n["value_md"] for n in nodes if n["layer"] == 0), 6)
    total_out = clean(sum(n["value_md"] for n in nodes if n["layer"] == 2), 6)
    assert abs(total_in - total_out) < 1e-6
    return {
        "unit": "Md€ par an (régime de croisière)",
        "nodes": nodes, "links": links,
        "total_in_md": total_in, "total_out_md": total_out, "balanced": abs(total_in - total_out) < 1e-6,
        "interpretation": (
            "Catégories d'économies (Annexe Manuscrit, colonnes E et F) → calendrier → destination. "
            "Conformément à l'onglet « Input Capitalisation », la restitution de la CSG/CRDS sur l'activité (114,46 Md€) est financée par les gains de l'année 1 ; "
            "le reliquat de l'année 1, les gains supplémentaires de l'année pleine, l'assurance chômage transformée en épargne et le rendement des actifs publics alimentent la capitalisation. "
            "Le classeur n'affecte pas chaque économie à une destination précise : seuls les totaux par destination (114,46 et 121,749 Md€) sont affirmés."
        ),
        "node_value_note": (
            "value_md des catégories = colonnes E + F de l'Annexe Manuscrit (donc 18,209 pour le patrimoine, alors que la colonne C du même onglet affiche 18) ; "
            "md_par_an_classeur = colonne C. La destination « capitalisation » vaut 121,804 Md€ dans ce schéma, contre 121,749 Md€ affirmés (Input Capitalisation!E2) : "
            "écart de 0,055 Md€ documenté dans reconciliation."
        ),
        "destinations": {
            "salaire_net_md": clean(salaire, 6),
            "capitalisation_md_calcule": cap_total,
            "capitalisation_md_classeur": clean(stated_cap, 6),
        },
    }


def _row(cat: str) -> int:
    return {v[0]: k for k, v in ROWS.items()}[cat]


def sheet_csg() -> dict:
    sh = Sheet.get("chiffres", "CSG_CRDS")
    return {
        "csg_md": sh.num("H3"), "csg_crds_activite_md": sh.num("I3"), "point_csg_md": sh.num("J3"),
    }


def _classeur_reconciliation(by_id):
    cap = Sheet.get("chiffres", "Input_Capitalisation")
    flux = Sheet.get("chiffres", "Flux")
    csg = sheet_csg()
    parts = {
        "annee_1": clean(flux.num("C6"), 6),
        "economie_budgetaire_annee_pleine": clean(cap.num("E5"), 6),
        "economie_locale_annee_pleine": clean(cap.num("E6"), 6),
        "assurance_chomage": clean(cap.num("E7"), 6),
        "reliquat_annee_1": clean(cap.num("E8"), 6),
        "flux_economise": clean(cap.num("E4"), 6),
        "rendement_actifs": clean(cap.num("E10"), 6),
        "capitalisation_total": clean(cap.num("E2"), 6),
        "salaire_net": clean(csg["csg_crds_activite_md"], 6),
    }
    assert abs(parts["economie_budgetaire_annee_pleine"] + parts["economie_locale_annee_pleine"] + parts["assurance_chomage"] + parts["reliquat_annee_1"] - parts["flux_economise"]) < 1e-9
    assert abs(parts["flux_economise"] + parts["rendement_actifs"] - parts["capitalisation_total"]) < 1e-9
    assert abs(parts["annee_1"] - parts["salaire_net"] - parts["reliquat_annee_1"]) < 1e-9, "reliquat = gain année 1 (Flux) − CSG/CRDS"
    total_out = clean(parts["salaire_net"] + parts["capitalisation_total"], 6)
    nodes = [
        {"id": "gain_annee_1", "label_fr": "Gains de l'année 1 (feuille Flux)", "layer": 0, "value_md": parts["annee_1"], "cell": "Flux!C6"},
        {"id": "eco_budgetaire_pleine", "label_fr": "Économie budgétaire en année pleine", "layer": 0, "value_md": parts["economie_budgetaire_annee_pleine"], "cell": "Input Capitalisation!E5"},
        {"id": "eco_locale_pleine", "label_fr": "Économie locale en année pleine", "layer": 0, "value_md": parts["economie_locale_annee_pleine"], "cell": "Input Capitalisation!E6"},
        {"id": "assurance_chomage", "label_fr": "Assurance chômage transformée en épargne", "layer": 0, "value_md": parts["assurance_chomage"], "cell": "Input Capitalisation!E7"},
        {"id": "rendement_actifs", "label_fr": "Rendement net des actifs rendus (3 % de 606,97 Md€)", "layer": 0, "value_md": parts["rendement_actifs"], "cell": "Input Capitalisation!E10"},
        {"id": "salaire_net", "label_fr": "Salaire net (fin CSG/CRDS activité)", "layer": 1, "value_md": parts["salaire_net"], "cell": "CSG-CRDS!I3"},
        {"id": "capitalisation", "label_fr": "Capitalisation / épargne", "layer": 1, "value_md": parts["capitalisation_total"], "cell": "Input Capitalisation!E2"},
    ]
    links = [
        {"source": "gain_annee_1", "target": "salaire_net", "value_md": parts["salaire_net"]},
        {"source": "gain_annee_1", "target": "capitalisation", "value_md": parts["reliquat_annee_1"], "note": "reliquat de l'année 1 après suppression de la CSG (Input Capitalisation!E8)"},
        {"source": "eco_budgetaire_pleine", "target": "capitalisation", "value_md": parts["economie_budgetaire_annee_pleine"]},
        {"source": "eco_locale_pleine", "target": "capitalisation", "value_md": parts["economie_locale_annee_pleine"]},
        {"source": "assurance_chomage", "target": "capitalisation", "value_md": parts["assurance_chomage"]},
        {"source": "rendement_actifs", "target": "capitalisation", "value_md": parts["rendement_actifs"]},
    ]
    tot_in = clean(sum(n["value_md"] for n in nodes if n["layer"] == 0), 6)
    assert abs(tot_in - total_out) < 1e-6, (tot_in, total_out)
    c_total = by_id["total"]["md_par_an"]
    ef_total = clean(by_id["total"]["gain_annee_1_md"] + by_id["total"]["gain_supp_annee_pleine_md"], 6)
    return {
        "description": "Réconciliation propre au classeur (feuilles Flux, CSG-CRDS et Input Capitalisation) : équilibrée à l'euro près, mais sur 236,209 Md€ et non 236,055.",
        "nodes": nodes, "links": links, "total_in_md": tot_in, "total_out_md": total_out, "balanced": True,
        "parts": parts,
        "vs_annexe_manuscrit": {
            "annexe_total_colonne_C_md": c_total,
            "annexe_total_E_plus_F_md": ef_total,
            "flux_et_input_capitalisation_md": total_out,
            "ecart_C_vs_flux_md": clean(total_out - c_total, 6),
            "ecart_E_plus_F_vs_flux_md": clean(total_out - ef_total, 6),
        },
    }


def _reconciliation(by_id, sk, classeur):
    c_total = by_id["total"]["md_par_an"]
    ef_total = classeur["vs_annexe_manuscrit"]["annexe_total_E_plus_F_md"]
    flux_total = classeur["total_out_md"]
    a1 = by_id["total"]["gain_annee_1_md"]
    a1_flux = classeur["parts"]["annee_1"]
    eco_state_loc_annexe = clean(by_id["structures"]["gain_supp_annee_pleine_md"] + by_id["subventions"]["gain_supp_annee_pleine_md"], 6)
    eco_state_loc_flux = clean(classeur["parts"]["economie_budgetaire_annee_pleine"] + classeur["parts"]["economie_locale_annee_pleine"], 6)
    return {
        "unit": "Md€",
        "totaux": {
            "annexe_manuscrit_colonne_C": c_total,
            "annexe_manuscrit_E_plus_F": ef_total,
            "destinations_classeur_114_46_plus_121_749": flux_total,
        },
        "residuels": [
            {
                "id": "patrimoine_18_vs_18_209", "md": clean(ef_total - c_total, 6),
                "explication": "Dans l'Annexe Manuscrit, la ligne « Patrimoine public valorisé et restitué » vaut 18 en colonne C (et dans le total 236,055) mais 18,209 en colonne F (gain supplémentaire en année pleine) : la somme E + F du tableau (236,264) dépasse donc son propre total de 0,209 Md€. 18,209 = 3 % × 606,973 (Input Capitalisation).",
            },
            {
                "id": "annexe_vs_flux", "md": clean(flux_total - ef_total, 6),
                "explication": f"Les montants de la réconciliation (feuilles Flux et Input Capitalisation) sont arrondis différemment de l'Annexe Manuscrit : gain année 1 de {fr(a1_flux)} (Flux) contre {fr(a1, 3)} (Annexe), et économies État + collectivités en année pleine de {fr(eco_state_loc_flux)} (Input Capitalisation : 38,5 + 20,1) contre {fr(eco_state_loc_annexe, 4)} (Annexe : structures 27,9025 + subventions 32,8). Les deux écarts (+{fr(a1_flux - a1, 3)} et −{fr(eco_state_loc_annexe - eco_state_loc_flux, 3)}) se compensent presque : solde {fr(flux_total - ef_total, 3)} Md€.",
            },
            {
                "id": "capitalisation_calcule_vs_affirme", "md": clean(sk["destinations"]["capitalisation_md_calcule"] - sk["destinations"]["capitalisation_md_classeur"], 6),
                "explication": "Dans le Sankey par catégorie, la destination capitalisation vaut 121,804 Md€ (reliquat année 1 + année pleine, d'après l'Annexe Manuscrit) contre 121,749 Md€ affirmés par Input Capitalisation!E2 : même écart de 0,055 Md€ que ci-dessus.",
            },
        ],
        "headline_236": "« 236 milliards » (manifeste, lettres) = 236,055 Md€ (colonne C) ; 236,264 si l'on additionne E + F ; 236,209 si l'on additionne les destinations 114,46 + 121,749. Les trois valeurs arrondissent à 236.",
        "year_1_vs_flux": {"annexe": a1, "flux": a1_flux, "ecart_md": clean(a1_flux - a1, 4)},
        "per_foyer": {"md_par_an": c_total, "eur_par_foyer": by_id["total"]["eur_par_foyer_an"], "foyers_implicites_millions": clean(c_total * 1000 / by_id["total"]["eur_par_foyer_an"], 3),
                      "note": "Dénominateur implicite du tableau « € par foyer » : 236,055 Md€ ÷ 8 000 € = 29,507 M de foyers (les fiches parlent de 30 M, la loi de 40,2 M de foyers fiscaux)."},
    }


def _destinations():
    cap = Sheet.get("chiffres", "Input_Capitalisation")
    csg = Sheet.get("chiffres", "CSG_CRDS")
    pl = read_page("amendements__Liasse_PLFSS")
    q = "dont 50 aux régimes obligatoires d’assurance maladie, 25 à la caisse d’autonomie, 17 à l’assurance chômage, 11 à la caisse des allocations familiales et 11 à la caisse d’amortissement de la dette sociale"
    assert quote_in("amendements__Liasse_PLFSS", q)
    split = [("assurance_maladie", "Régimes obligatoires d'assurance maladie", 50), ("autonomie", "Caisse d'autonomie", 25),
             ("assurance_chomage", "Assurance chômage", 17), ("allocations_familiales", "Caisse des allocations familiales", 11),
             ("cades", "Caisse d'amortissement de la dette sociale (5 CSG + 6 CRDS)", 11)]
    assert sum(x[2] for x in split) == 114
    return {
        "salaire_net": {
            "id": "salaire_net", "label_fr": "Salaire net : fin de la CSG et de la CRDS sur les revenus d'activité",
            "md_par_an": clean(csg.num("I3"), 6), "csg_seule_md": clean(csg.num("H3"), 6), "point_de_csg_md": clean(csg.num("J3"), 6),
            "source": csg.source("H3:J3"), "tier": "donnee",
            "note": "PLACSS 2024, annexe 1 (données 2024). L'amendement PLFSS n° 1 écrit « 114 milliards d'euros en année pleine » et « 33 milliards d'euros en 2027 ».",
            "recettes_perdues_par_affectataire_md": [
                {"id": i, "label_fr": l, "md": v} for i, l, v in split
            ] ,
            "recettes_perdues_source": {"kind": "amendment", "ref": "PLFSS, amendement n° 2 (exposé sommaire)", "tier": "loi", "quote": q,
                                        "url": f"{SITE}/amendements/Liasse_PLFSS.pdf#page=8"},
        },
        "capitalisation": {
            "id": "capitalisation", "label_fr": "Capitalisation / compte d'épargne personnel",
            "md_par_an": clean(cap.num("E2"), 6),
            "composition_md": [
                {"id": "eco_budgetaire_pleine", "label_fr": "Économie budgétaire en année pleine", "md": clean(cap.num("E5"), 6)},
                {"id": "eco_locale_pleine", "label_fr": "Économie locale en année pleine", "md": clean(cap.num("E6"), 6)},
                {"id": "assurance_chomage", "label_fr": "Transformation de l'assurance chômage", "md": clean(cap.num("E7"), 6)},
                {"id": "reliquat_annee_1", "label_fr": "Reliquat de l'année 1 après suppression de la CSG", "md": clean(cap.num("E8"), 6)},
                {"id": "rendement_actifs", "label_fr": "Rendement net des actifs publics rendus", "md": clean(cap.num("E10"), 6)},
            ],
            "source": cap.source("E2:E10"), "tier": "annonce",
            "manifeste_300_eur_par_mois": "« 300 euros par mois versés sur un compte épargne retraite personnel d'ici trois ans » : aucune base légale chiffrée (PLF-P1 n° 27 : « aucun montant n'est inscrit ici »)",
        },
        "actifs_a_restituer": {
            "total_md": clean(cap.num("C10"), 6), "rendement_net": clean(cap.num("D10"), 4), "rendement_md": clean(cap.num("E10"), 6),
            "postes": [
                {"id": "participations", "label_fr": "Participations financières", "md": clean(cap.num("C11"), 6), "cell": "C11"},
                {"id": "foncier_public", "label_fr": "Patrimoine foncier public", "md": clean(cap.num("C12"), 6), "cell": "C12"},
                {"id": "logements_publics", "label_fr": "Logements publics", "md": clean(cap.num("C13"), 6), "cell": "C13"},
                {"id": "parc_social", "label_fr": "Parc social", "md": clean(cap.num("C14"), 6), "cell": "C14"},
            ],
            "source": cap.source("B10:E14"), "tier": "annonce",
        },
    }


def _va():
    sh = Sheet.get("graphiques", "GraphVA")
    total = sh.num("B25")
    rows = [("etat", "Prélèvements de l'État", "B26"), ("capital", "Rémunération du capital", "B27"), ("salaire_net", "Salaire net du travailleur", "B28")]
    items = []
    for rid, lab, cell in rows:
        v = sh.num(cell)
        items.append({"id": rid, "label_fr": lab, "eur_par_heure": clean(v), "share_pct": clean(v / total * 100, 2), "cell": cell})
    assert sum(i["eur_par_heure"] for i in items) == total == 63
    return {
        "titre_fr": "Répartition de la valeur ajoutée créée par une heure de travail",
        "total_eur_par_heure": clean(total), "total_cell": "B25", "unit": "€ par heure de travail",
        "parts": items,
        "source": sh.source("A25:B28"), "tier": "annonce",
        "note": "Calcul de Résolution, sans source externe indiquée dans l'onglet (colonne source vide). 29 + 11 + 23 = 63. Les parts en % sont calculées par le pipeline.",
    }


def _afu_curve():
    sh = Sheet.get("graphiques", "GraphIR")
    cases = []
    for c in "CDEFG":
        income = sh.num(f"{c}28")
        cases.append({
            "revenu_imposable_eur": clean(income, 0),
            "afu_eur": clean(sh.num(f"{c}27"), 0),
            "impot_brut_eur": clean(-sh.num(f"{c}29"), 0),
            "revenu_net_apres_impot_eur": clean(sh.num(f"{c}30"), 0),
            "versement_net_eur": clean(sh.num(f"{c}31"), 0),
            "cells": f"{c}27:{c}31",
        })
    series = []
    c = 2
    while c < len(sh.rows[32]) and sh.at(32, c).strip() != "":
        col = ("" if c < 26 else chr(64 + c // 26)) + chr(65 + c % 26)
        inc = sh.num(f"{col}35")
        rec = {
            "revenu_imposable_eur": clean(inc, 0),
            "afu_eur": clean(sh.num(f"{col}34"), 0),
            "impot_brut_eur": clean(-sh.num(f"{col}36"), 0),
            "revenu_disponible_net_eur": clean(sh.num(f"{col}37"), 0),
            "versement_net_eur": clean(sh.num(f"{col}38"), 0),
        }
        # formula checks: tax = 23 % ; disposable = AFU + income − tax
        assert abs(rec["impot_brut_eur"] - 0.23 * rec["revenu_imposable_eur"]) < 1e-6, rec
        assert abs(rec["revenu_disponible_net_eur"] - (rec["revenu_imposable_eur"] + rec["afu_eur"] - rec["impot_brut_eur"])) < 1e-6, rec
        assert abs(rec["versement_net_eur"] - (rec["afu_eur"] - rec["impot_brut_eur"])) < 1e-6, rec
        series.append(rec)
        c += 1
    assert len(series) == 73 and series[0]["revenu_imposable_eur"] == 0 and series[-1]["revenu_imposable_eur"] == 72000, (len(series), series[-1])
    for cs in cases:
        assert abs(cs["impot_brut_eur"] - 0.23 * cs["revenu_imposable_eur"]) < 1e-6
    beq = 6600 / 0.23
    ref = Sheet.get("chiffres", "Refonte_fiscalit")
    assert abs(ref.num("J53") - beq) < 1e-6
    return {
        "taux_unique": 0.23, "afu_adulte_eur_an": 6600,
        "seuil_equilibre_personne_seule_eur_an": clean(beq, 2),
        "seuil_equilibre_workbook": clean(ref.num("J53"), 2),
        "seuil_equilibre_loi": "« l'impôt devient négatif en deçà de 28 700 € pour une personne seule » (PLF-P1 n° 28, exposé)",
        "conventions": {
            "impot_brut_eur": "montant dû = 23 % du revenu imposable (positif). Le classeur l'affiche avec le signe − (flux sortant du foyer) dans les lignes « Impôt brut à payer ».",
            "versement_net_eur": "AFU − impôt brut ; positif = le foyer reçoit de l'administration, négatif = il lui verse (ligne « Versement net de / à l'administration »).",
            "revenu_net_apres_impot_eur": "revenu imposable + AFU − impôt brut (ligne « Revenu net après impôt »).",
        },
        "retention_marginale": 0.77,
        "cas": cases,
        "serie": series,
        "source": sh.source("B26:G31, B33:BW38"), "tier": "loi",
        "note": "Courbe pour une personne seule, sans enfant, sans majoration ; formules du classeur : impôt = 23 % × revenu, AFU = 6 600 €. Le revenu « imposable » n'est pas défini plus précisément par les textes (voir DISCREPANCIES.md).",
    }


def _csg_cases():
    sh = Sheet.get("chiffres", "CSG_CRDS")
    rows = []
    spec = [(7, "SMIC brut 2025", "smic_brut_2025"), (8, "SMIC net 2025", "smic_net_2025"), (9, "SMIC brut 01/2026", "smic_brut_2026_01"), (10, "SMIC net 01/2026", "smic_net_2026_01"),
            (11, "SMIC brut 06/2026", "smic_brut_2026_06"), (12, "SMIC net 06/2026", "smic_net_2026_06"), (13, "Salaire net médian", "net_median"),
            (14, "Salaire brut moyen", "brut_moyen"), (15, "Salaire net moyen", "net_moyen")]
    for r, lab, rid in spec:
        rows.append({
            "id": rid, "label_fr": lab, "row": r,
            "salaire_mensuel_eur": clean(sh.num(f"C{r}"), 2),
            "point_csg_mensuel_eur": clean(sh.num(f"D{r}"), 4),
            "csg_mensuelle_eur": clean(sh.num(f"E{r}"), 4),
            "gain_mensuel_csg_crds_eur": clean(sh.num(f"F{r}"), 4),
            "gain_pct": clean(sh.num(f"G{r}") * 100, 4) if sh.num(f"G{r}") is not None else None,
            "gain_annuel_eur": clean(sh.num(f"I{r}"), 2),
            "cells": f"C{r}:I{r}",
        })
    # check the inferred formula gain = brut × 0.9825 × 9.7 %  (SMIC brut 2025)
    gross = sh.num("C7")
    assert abs(gross * 0.9825 * 0.097 - sh.num("F7")) < 1e-3
    return {
        "rows": rows,
        "formule_inferee": "gain mensuel = salaire brut × 0,9825 × 9,7 % (vérifiée sur le SMIC brut 2025 : 1 801,80 × 0,9825 × 0,097 = 171,716 €) — inférence du pipeline, non écrite dans le classeur",
        "annonces_a_rapprocher": [
            {"id": "manifeste_300", "texte": "« 300 euros par mois restitués dès la première année, soit 13 % de salaire net en plus pour tous » (manifeste)", "valeur_eur_mois": 300, "valeur_pct": 13},
            {"id": "fiche_travailleur_180", "texte": "« +13 % votre salaire net en un an, au salaire médian. 180 euros de plus par mois au SMIC » (fiche Travailleur)", "valeur_eur_mois": 180, "valeur_pct": 13},
            {"id": "classeur_median", "texte": "classeur : 275,08 €/mois (12,56 %) au salaire net médian de 2 190 € ; 171,72 €/mois (12,04 %) au SMIC 2025", "valeur_eur_mois": 275.076, "valeur_pct": 12.56},
        ],
        "source": sh.source("B2:J16"), "tier": "annonce",
    }


def _flux_mesures():
    sh = Sheet.get("chiffres", "Flux")
    rows = []
    group = None
    for r in range(8, 27):
        lab = ws(sh.at(r - 1, 1))
        if not lab:
            continue
        gain1 = sh.num(f"C{r}")
        if gain1 is None:
            continue
        top = lab in ("Niches fiscales", "Niches sociales", "Economies Etat", "Economies Collectivités")
        if top:
            group = lab
        rows.append({
            "label_fr": lab, "level": 1 if top else 2, "parent": None if top else group,
            "gain_annee_1_md": clean(gain1, 3),
            "effet_annee_1_fr": ws(sh.at(r - 1, 3)) or None,
            "gain_supp_terme_md": clean(sh.num(f"E{r}"), 3) if sh.num(f"E{r}") is not None else None,
            "commentaire_terme_fr": ws(sh.at(r - 1, 5)) or None,
            "total_supprime_a_terme_md": clean(sh.num(f"G{r}"), 3) if sh.num(f"G{r}") is not None else None,
            "autre_gisement_md": clean(sh.num(f"H{r}"), 3) if sh.num(f"H{r}") is not None else None,
            "commentaire_gisement_fr": ws(sh.at(r - 1, 8)) or None,
            "source_fr": ws(sh.at(r - 1, 9)) or None,
            "cells": f"B{r}:J{r}",
        })
    tops = [x for x in rows if x["level"] == 1]
    s1 = clean(sum(x["gain_annee_1_md"] for x in tops), 3)
    return {
        "unit": "Md€",
        "rows": rows,
        "totaux": {"gain_annee_1_md": clean(sh.num("C6"), 3), "gain_supp_terme_md": clean(sh.num("E6"), 3), "total_supprime_a_terme_md": clean(sh.num("G6"), 3), "autre_gisement_md": clean(sh.num("H6"), 3),
                   "somme_postes_niveau_1_annee_1_md": s1},
        "note": "Autre lecture des mêmes économies, par mesure (feuille Flux) : 129,4 Md€ la première année (niches 52,1 + État 44 + collectivités 33,3), dont 114,46 pour la CSG/CRDS et 14,94 de reliquat. Les niches fiscales ont un « gain supplémentaire à terme » (29,1 + 9 de niches sociales) qui compense la refonte fiscale et n'entre pas dans les 236 Md€.",
        "source": sh.source("B5:J26"), "tier": "annonce",
    }


def _po():
    ref = Sheet.get("chiffres", "Refonte_fiscalit")
    return {
        "pib_2024_md": clean(ref.num("C3"), 1), "po_2024_md": clean(ref.num("F3"), 1),
        "po_pib_2024_pct": clean(ref.num("E3") * 100, 6), "po_pib_cible_pct": clean(ref.num("E4") * 100, 6), "po_cible_md": clean(ref.num("F4"), 5),
        "baisse_pts": clean((ref.num("E3") - ref.num("E4")) * 100, 3), "baisse_md": clean(ref.num("F3") - ref.num("F4"), 3),
        "source": ref.source("C3:F4"), "tier": "annonce",
        "fiche_contribuable": "« 36 % de la richesse produite, contre 43 % aujourd'hui »",
    }


def _afu_economics():
    ref = Sheet.get("chiffres", "Refonte_fiscalit")
    gross = ref.num("G58")
    merged = ref.num("C60")
    parts = {"fiscal_hors_quotient": ref.num("C62"), "budgetaire": ref.num("C66"), "social": ref.num("C69")}
    assert abs(sum(parts.values()) - merged) < 1e-6
    return {
        "population_fiscale_2025_millions": ref.num("C49"), "adultes_millions": ref.num("C50"), "enfants_millions": ref.num("C51"),
        "population_recensee_2025_millions": ref.num("C53"), "adultes_recenses_millions": ref.num("C54"), "enfants_recenses_millions": ref.num("C55"),
        "aah_adultes_millions": ref.num("C57"), "aeeh_enfants_millions": ref.num("C58"),
        "afu_brute_md_par_an": clean(gross, 3), "depenses_fusionnees_md_par_an": clean(merged, 5),
        "cout_net_calcule_md": clean(gross - merged, 3),
        "cout_net_note": "calcul du pipeline : 402,006 − 135,346 = 266,660 Md€ à financer par l'impôt à 23 % sur une assiette élargie ; le classeur ne publie pas de microsimulation (gagnants/perdants par décile).",
        "fusion_detail_md": {"fiscal_hors_quotient": clean(parts["fiscal_hors_quotient"], 3), "budgetaire_rsa_pa_aah": clean(parts["budgetaire"], 3), "social_cnaf_aspa_local": clean(parts["social"], 5)},
        "taux_unique_estime_pct": clean(ref.num("K50") * 100, 4), "taux_legal_pct": 23,
        "seuil_entree_ir_net_eur": clean(ref.num("J53"), 2),
        "ir_total_brut_md": clean(ref.num("C75"), 1), "taux_moyen_ir_reference_pct": clean(ref.num("C76") * 100, 4),
        "source": ref.source("B47:K76"), "tier": "annonce",
    }


def build() -> dict:
    sh, recs, by_id, checks = _savings()
    sk = _sankey(sh, recs, by_id)
    classeur = _classeur_reconciliation(by_id)
    recon = _reconciliation(by_id, sk, classeur)
    return {
        "meta": {
            "title_fr": "Le plan en un schéma : 236 Md€ d'économies → salaire net et épargne",
            "unit": "Md€ par an (régime de croisière) sauf mention contraire",
            "source": sh.source("A2:F28"), "tier": "annonce",
            "tier_note": "Estimations de Résolution (Calculs de Résolution) : aucune de ces valeurs n'est écrite dans un amendement, sauf mention « loi ».",
            "notes": [
                "Utiliser le tableau savings_table (26 lignes) pour la table de données ; id/parent_id donnent la hiérarchie.",
                "Les valeurs « web_arrondi » viennent du tableau arrondi de donnees.html ; leurs sous-totaux ne s'additionnent pas toujours (39 affiché contre 37,43 exact pour le fonctionnement des administrations).",
            ],
        },
        "savings_table": recs,
        "savings_checks": checks,
        "sankey": sk,
        "sankey_classeur": classeur,
        "reconciliation": recon,
        "year_split": {
            "unit": "Md€",
            "annee_1_md": by_id["total"]["gain_annee_1_md"], "supplement_annee_pleine_md": by_id["total"]["gain_supp_annee_pleine_md"],
            "total_E_plus_F_md": clean(by_id["total"]["gain_annee_1_md"] + by_id["total"]["gain_supp_annee_pleine_md"], 6),
            "par_categorie": [
                {"id": c, "label_fr": CATEGORY_LABELS[c], "annee_1_md": by_id[c]["gain_annee_1_md"], "supplement_annee_pleine_md": by_id[c]["gain_supp_annee_pleine_md"]}
                for c in ("structures", "subventions", "niches", "chomage", "patrimoine")
            ],
            "autre_lecture_flux": {"annee_1_md": classeur["parts"]["annee_1"], "note": "feuille Flux : 129,4 Md€ la première année (écart de 2,048 Md€ avec l'Annexe Manuscrit, voir reconciliation)"},
            "source": sh.source("E3:F28"),
        },
        "destinations": _destinations(),
        "valeur_ajoutee_horaire": _va(),
        "csg_cas_types": _csg_cases(),
        "flux_mesures": _flux_mesures(),
        "afu_courbe": _afu_curve(),
        "afu_economie": _afu_economics(),
        "prelevements_obligatoires": _po(),
    }
