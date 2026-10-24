"""etat-partout.json — « L'État partout » : ministères, agences, impôts, niches,
CERFA, mots de loi, effectifs publics, chaîne de représentation démocratique.

Sources: Synthèse Graphiques (GraphAgences, GraphCodes, GraphETP, Graph51pc),
Synthèse ETP et agences (Synthèse ETP, Synthèse agences R), Synthèse Chiffres
(Refonte fiscalité, Détail Economies), PLF 2026 V&M (Synthèse, Synthèse TA),
and verbatim claims of the manifeste.
"""
from __future__ import annotations

from lib import SITE, Sheet, clean, pct, quote_in, ws

MANIFESTE = f"{SITE}/manifeste.html"
LEGIFRANCE = "https://www.legifrance.gouv.fr/contenu/menu/autour-de-la-loi/legislatif-et-reglementaire/statistiques-de-la-norme"

# the seven missions kept, in the order of the seven column groups of GraphAgences
# (same order as PLF-P2 amendment 27: « la défense, l'intérieur, la justice, les affaires
# étrangères, les comptes publics, la solidarité nationale et l'enseignement »)
SEVEN = [
    ("defense", "Défense"),
    ("interieur", "Intérieur (Sécurités)"),
    ("justice", "Justice"),
    ("action_exterieure", "Action extérieure"),
    ("finances_publiques", "Économie, finances et comptes publics"),
    ("solidarite", "Solidarité, travail, santé"),
    ("enseignement", "Enseignement"),
]


def _ministeres():
    sh = Sheet.get("graphiques", "GraphAgences")
    total, supprimes, indispensables = (sh.num("B47"), sh.num("B48"), sh.num("B49"))
    assert (total, supprimes, indispensables) == (35, 28, 7)
    removed, groups = [], []
    cur_col, cur = None, None
    for r in range(51, 70):
        left = sh.at(r - 1, 0)
        if left.strip():
            removed.append({"label_fr": ws(left), "cell": f"A{r}"})
        for col in (7, 8):
            val = sh.at(r - 1, col)
            if val.strip():
                if col != cur_col:
                    cur = {"members": []}
                    groups.append(cur)
                    cur_col = col
                cur["members"].append({"label_fr": ws(val), "cell": f"{'ABCDEFGHI'[col]}{r}"})
    assert len(removed) == 19, len(removed)
    assert len(groups) == 7, len(groups)
    n_grouped = sum(len(g["members"]) for g in groups)
    assert len(removed) + n_grouped == 35 and n_grouped == 16
    out_groups = []
    for (gid, glabel), g in zip(SEVEN, groups):
        out_groups.append({
            "id": gid,
            "label_fr": glabel,
            "n_ministeres_regroupes": len(g["members"]),
            "ministeres": g["members"],
        })
    ministeres = []
    for x in removed:
        ministeres.append({**x, "status": "supprime", "group_id": None})
    for g in out_groups:
        for i, m in enumerate(g["ministeres"]):
            ministeres.append({**m, "status": "regroupe", "group_id": g["id"],
                               "is_first_of_group": i == 0})
    return {
        "avant": clean(total), "apres": clean(indispensables), "supprimes_net": clean(supprimes),
        "supprimes_integralement": len(removed),
        "regroupes_dans_les_sept": n_grouped,
        "detail": ministeres,
        "groupes_maintenus": out_groups,
        "reconciliation": f"35 ministères = {len(removed)} supprimés sans successeur + {n_grouped} regroupés en 7 ; "
                          f"35 − 7 = 28 « supprimés » en nombre net = {len(removed)} + ({n_grouped} − 7).",
        "grouping_inferred": True,
        "grouping_note": "Les 16 ministères maintenus sont rangés dans deux colonnes alternées du graphique du livre (colonnes H et I de GraphAgences) ; chaque bloc de lignes consécutives dans une même colonne forme un des 7 ministères. Le classement en 7 blocs, et leur nom (ordre identique à celui de l'amendement PLF-P2 n° 27), est déduit de cette mise en page : le classeur ne l'écrit pas.",
        "source": sh.source("A47:I69"),
    }


def _agences():
    sh = Sheet.get("etp", "Synth_se_agences_R")
    heads = {"cession": "E", "suppression": "F", "internalisation": "G", "epic_musee": "H", "epic_enseignement": "I", "autorite_independante": "J"}
    rows = []
    for r in range(5, 13):
        label = sh.raw(f"C{r}")
        rec = {"id": None, "label_fr": ws(label), "total": clean(sh.num(f"D{r}")), "row": r}
        for k, col in heads.items():
            rec[k] = clean(sh.num(f"{col}{r}") or 0)
        assert abs(sum(rec[k] for k in heads) - rec["total"]) < 1e-9, (label, rec)
        rows.append(rec)
    ids = ["agences_etat", "operateurs_plf", "organismes_hors_plf", "autorites_independantes", "commissions", "agences_locales", "organismes_hors_plf_locaux", "total_agences"]
    for rec, i in zip(rows, ids):
        rec["id"] = i
    state = rows[0]
    parts = rows[1:5]
    for k in ["total", *heads]:
        assert sum(p[k] for p in parts) == state[k], k
    assert rows[7]["total"] == state["total"] + rows[5]["total"]
    apres = state["epic_musee"] + state["epic_enseignement"] + state["autorite_independante"]
    return {
        "etat_avant": state["total"], "etat_apres": clean(apres),
        "fermees": clean(state["cession"] + state["suppression"]),
        "cession": state["cession"], "suppression": state["suppression"], "internalisation": state["internalisation"],
        "autonomie": clean(apres),
        "locales": rows[5]["total"], "total_avec_locales": rows[7]["total"],
        "matrice": rows,
        "source": sh.source("C5:J12"),
        "note": "Agences d'État 1 104 = opérateurs PLF 434 + organismes hors PLF 328 + autorités indépendantes 24 + commissions 318. La ligne « Organismes hors PLF » sous « Agences locales » répète les 23 264 agences locales (même nombre) : ne pas la sommer deux fois. Détail dans agences.json.",
    }


def _taxes():
    sh = Sheet.get("chiffres", "Refonte_fiscalit")
    cols = {"montant_2024_md": "C", "niches_restituees_md": "E", "solde_brut_a_restituer_md": "F", "gisement_md": "G",
            "taxes_a_supprimer_md": "H", "somme_niches_md": "I", "hausses_equilibre_md": "K"}
    rows = []
    for r in range(15, 43):
        lab = sh.at(r - 1, 1)
        if not lab.strip():
            continue
        v = sh.num(f"C{r}")
        if v is None and not any(sh.num(f"{c}{r}") is not None for c in cols.values()):
            continue
        rec = {"label_fr": ws(lab).replace("*", "").strip(), "level": 2 if (lab.strip().startswith("dont ") or lab.strip() in ("à titre onéreux", "à titre gratuit")) else 1, "row": r,
               "sheet_cell": f"B{r}"}
        for k, c in cols.items():
            rec[k] = clean(sh.num(f"{c}{r}"), 3) if sh.num(f"{c}{r}") is not None else None
        rows.append(rec)
    # assign ids / parents
    parent = None
    for i, rec in enumerate(rows):
        rec["id"] = f"taxe_{i + 1:02d}"
        if rec["level"] == 1:
            parent = rec["id"]
            rec["parent_id"] = None
        else:
            rec["parent_id"] = parent
    top = [r for r in rows if r["level"] == 1]
    total = sh.num("C13")
    top_sum = clean(sum(r["montant_2024_md"] for r in top), 3)
    assert abs(top_sum - 624.9) < 1e-6 and abs(total - 624.9) < 1e-6, (top_sum, total)
    # exact children check (informational)
    gaps = {}
    for r in top:
        kids = [k for k in rows if k["parent_id"] == r["id"]]
        if kids:
            s = clean(sum(k["montant_2024_md"] or 0 for k in kids), 3)
            gaps[r["label_fr"]] = {"parent_md": r["montant_2024_md"], "children_sum_md": s, "gap_md": clean(s - r["montant_2024_md"], 3)}
    ta = Sheet.get("taxes_aff", "Synth_se_TA")
    ta_rows = []
    for r in range(8, 16):
        ta_rows.append({
            "label_fr": ws(ta.raw(f"C{r}")).replace("dont ", ""),
            "depense_totale_md": clean(ta.num(f"D{r}") / 1000, 3),
            "economie_md": clean(ta.num(f"E{r}") / 1000, 3),
            "economie_1_an_md": clean(ta.num(f"F{r}") / 1000, 3),
            "economie_apres_1_an_md": clean(ta.num(f"G{r}") / 1000, 3),
            "cell": f"C{r}:G{r}",
        })
    return {
        "recettes_2024": {
            "year": 2024, "unit": "Md€", "total_md": clean(total, 3),
            "pib_2024_md": clean(sh.num("C3"), 1),
            "po_2024_md": clean(sh.num("F3"), 1),
            "po_pib_2024_pct": clean(sh.num("E3") * 100, 6),
            "po_pib_cible_pct": clean(sh.num("E4") * 100, 6),
            "po_cible_md": clean(sh.num("F4"), 5),
            "table": rows,
            "children_sums_check": gaps,
            "children_note": "Les lignes « dont » ne partitionnent pas toujours le poste parent (ex. taxes sur la consommation : 105,1 Md€ contre 105,7 Md€ de détail, car le poste est « corrigé du bouclier tarifaire électricité » dans le classeur) ; écarts documentés ci-dessus.",
            "colonnes": {
                "montant_2024_md": "Montant 2024 (Insee 3.217, extraits)",
                "niches_restituees_md": "Niches restituées",
                "solde_brut_a_restituer_md": "Solde brut à restituer post CSG",
                "gisement_md": "Gisement à supprimer",
                "taxes_a_supprimer_md": "Taxes à supprimer (négatif = recette supprimée)",
                "somme_niches_md": "Somme niches",
                "hausses_equilibre_md": "Hausses d'équilibre (IS à 27 points ; taxe foncière)",
            },
            "source": sh.source("B13:K42"),
            "insee_ref": "https://www.insee.fr/fr/statistiques/8988845?sommaire=8988934",
        },
        "taxes_affectees": {
            "unit": "Md€", "year": 2026,
            "note": "Taxes affectées à des opérateurs « non indispensables » (PLF 2026, V&M tome I annexe 2).",
            "table": ta_rows,
            "source": ta.source("C7:G15"),
        },
    }


def _claims():
    """Verbatim claims of the book / manifeste / letters (tier annonce).  Each quote is
    verified against research/pages/*.md (manifeste or lettre-depute) by validate.py."""
    L = ("lettres__lettre-depute", "france-resolution.fr › lettre type au député (idem maire, sénateur)", f"{SITE}/ecrire.html")
    M = ("manifeste", "france-resolution.fr › manifeste", MANIFESTE)
    claims = [
        ("impots_nombre", "Nombre d'impôts en France (affirmé par le manifeste)", 438, "impôts", "438 impôts", M),
        ("niches_nombre", "Nombre de niches fiscales (manifeste)", 486, "niches", "486 niches fiscales", M),
        ("cerfa_nombre", "Nombre de formulaires CERFA (manifeste ; ordre de grandeur, aucun jeu de données)", 2000, "formulaires", "2 000 CERFA", M),
        ("combinaisons_charges", "Combinaisons pour calculer un taux de charges sociales (manifeste)", 1.7, "milliards de combinaisons", "1,7 milliard de combinaisons pour calculer un taux de charges sociales", M),
        ("ministeres_apres", "« 7 ministères au lieu de 35 » (manifeste)", 7, "ministères", "7 ministères au lieu de 35", M),
        ("agences_apres", "« 303 agences nationales au lieu de 1 104 » (manifeste)", 303, "agences", "303 agences nationales au lieu de 1 104", M),
        ("echelons_territoriaux_apres", "Échelons territoriaux après réforme : « 2 échelons au lieu de 5 » (lettres aux élus)", 2, "échelons", "2 échelons territoriaux au lieu de 5", L),
        ("impots_cibles_manifeste", "Impôts cibles dans le manifeste : « Quatre impôts » (TVA, revenu, sociétés, foncier)", 4, "impôts", "Quatre impôts pour fusionner toute la fiscalité", M),
        ("impots_cibles_lettres", "Impôts cibles dans les lettres aux élus : « 5 impôts au lieu de 438 »", 5, "impôts", "5 impôts au lieu de 438", L),
        ("postes_publics_fermes", "Postes publics fermés (manifeste)", 580000, "postes", "580 000 postes publics fermés", M),
        ("mots_droit", "Mots du droit applicable (manifeste)", 49000000, "mots", "49 millions de mots du droit applicable", M),
        ("hausse_travailleurs_lettres", "« augmenter tous les travailleurs de 25 % d'ici trois ans » (lettres aux élus)", 25, "%", "augmenter tous les travailleurs de 25 % d’ici trois ans", L),
    ]
    out = []
    for cid, label, value, unit, q, (page, ref, url) in claims:
        assert quote_in(page, q), (cid, q)
        out.append({"id": cid, "label_fr": label, "value": value, "unit": unit, "tier": "annonce",
                    "conflict_group": "nb_impots_cibles" if cid.startswith("impots_cibles") else None,
                    "source": {"kind": "site", "ref": ref, "url": url, "quote": q}})
    return out


def _mots():
    sh = Sheet.get("graphiques", "GraphCodes")
    years = [int(sh.at(1, c)) for c in range(2, 24)]
    assert years == list(range(2005, 2027)), years
    def row(r):
        return [sh.num(f"{c}{r}") for c in "CDEFGHIJKLMNOPQRSTUVWX"]
    leg_cod, leg_non, leg_tot = row(9), row(10), row(11)
    reg_cod, reg_non, reg_tot = row(12), row(13), row(14)
    series = []
    for i, y in enumerate(years):
        assert leg_cod[i] + leg_non[i] == leg_tot[i], (y, "legislatif")
        assert reg_cod[i] + reg_non[i] == reg_tot[i], (y, "reglementaire")
        series.append({
            "year": y,
            "legislatif_codifie": clean(leg_cod[i]), "legislatif_non_codifie": clean(leg_non[i]), "legislatif_total": clean(leg_tot[i]),
            "reglementaire_codifie": clean(reg_cod[i]), "reglementaire_non_codifie": clean(reg_non[i]), "reglementaire_total": clean(reg_tot[i]),
            "total": clean(leg_tot[i] + reg_tot[i]),
            "total_millions": clean((leg_tot[i] + reg_tot[i]) / 1e6, 3),
        })
    # year-on-year jump check (non-codified regulatory text) -> flag series breaks
    flags = []
    for i in range(1, len(years)):
        prev, cur = reg_non[i - 1], reg_non[i]
        if prev and abs(cur / prev - 1) > 0.25:
            flags.append({"year": years[i], "series": "reglementaire_non_codifie", "from": clean(prev), "to": clean(cur),
                          "change_pct": clean((cur / prev - 1) * 100, 1)})
    codes = []
    for r in range(4, 8):
        lab = ws(sh.at(r - 1, 1))
        right = lab.endswith("(à droite)")
        lab = lab.replace("(à droite)", "").strip().rstrip(".")
        vals = row(r)
        codes.append({"code_fr": lab, "right_axis_in_book_chart": right, "values": [{"year": y, "words": clean(v)} for y, v in zip(years, vals)]})
    t26, t05 = series[-1]["total"], series[0]["total"]
    return {
        "unit": "mots", "years": [2005, 2026],
        "source": {"kind": "legifrance", "ref": "Légifrance, statistiques de la norme — repris dans " + sh.ref("C2:X14"), "url": LEGIFRANCE,
                   "workbook": sh.source("C2:X14")},
        "tier": "donnee",
        "series": series,
        "codes": codes,
        "growth": {"total_2005": clean(t05), "total_2026": clean(t26), "multiple": clean(t26 / t05, 3), "growth_pct": clean((t26 / t05 - 1) * 100, 1),
                   "target_manifeste": "diviser au moins par 10 (annonce, sans jalon chiffré)"},
        "series_break_flags": flags,
        "series_break_note": "Rupture probable dans la série « réglementaire non codifié » en 2010-2011 (≈14 M → 20,9 M → 21,6 M puis retour à 15,8 M en 2012) : non expliquée par la source (Légifrance) ni par le classeur ; à signaler en note de graphique plutôt qu'à corriger.",
        "total_2026_check": {"legislatif": series[-1]["legislatif_total"], "reglementaire": series[-1]["reglementaire_total"], "total": t26,
                             "manifeste_49_millions": "48,834 M de mots arrondis en « 49 millions »"},
    }


def _effectifs():
    sh = Sheet.get("etp", "Synth_se_ETP")
    st = {"fonctionnaires": "C4", "contractuels": "C5", "militaires": "C6", "autres": "C7"}
    total = sh.num("C8")
    by_status = {k: clean(sh.num(a), 3) for k, a in st.items()}
    assert abs(sum(by_status.values()) - total) < 0.002
    versants = {}
    for vid, label, base in (("fpe", "Fonction publique de l'État", 9), ("fpt", "Fonction publique territoriale", 14), ("fph", "Fonction publique hospitalière", 18)):
        parts = []
        r = base
        names = ["Fonctionnaires", "Contractuels", "Militaires", "Autres catégories et statuts"] if vid == "fpe" else (
            ["Fonctionnaires", "Contractuels", "Autres catégories et statuts"])
        for n_i, nm in enumerate(names):
            parts.append({"statut": nm, "milliers": clean(sh.num(f"C{r + n_i}"), 3), "cell": f"C{r + n_i}"})
        tot_row = base + len(names)
        tot = sh.num(f"C{tot_row}")
        assert abs(sum(p["milliers"] for p in parts) - tot) < 0.002, vid
        versants[vid] = {"label_fr": label, "total_milliers": clean(tot, 3), "par_statut": parts, "total_cell": f"C{tot_row}"}
    assert abs(sum(v["total_milliers"] for v in versants.values()) - total) < 0.003
    # GraphETP: the book's "who is the State" chart
    g = Sheet.get("graphiques", "GraphETP")
    etat = [{"id": "securite", "label_fr": "Sécurité (armées, intérieur, justice…)", "milliers": clean(g.num("C27"), 3)},
            {"id": "enseignants", "label_fr": "Enseignants", "milliers": clean(g.num("C28"), 3)},
            {"id": "non_regaliens", "label_fr": "Ministères non régaliens", "milliers": clean(g.num("C29"), 3)},
            {"id": "agences", "label_fr": "Agences (opérateurs)", "milliers": clean(g.num("C30"), 3)}]
    local = [{"id": "communes", "label_fr": "Communes", "milliers": clean(g.num("C31"), 3)},
             {"id": "etab_communaux_interco", "label_fr": "Établissements communaux et intercommunaux", "milliers": clean(g.num("C32"), 3)},
             {"id": "departements", "label_fr": "Départements (y c. établissements départementaux)", "milliers": clean(g.num("C33"), 3)},
             {"id": "regions", "label_fr": "Régions", "milliers": clean(g.num("C34"), 3)}]
    sante = [{"id": "fph", "label_fr": "Caisses et établissements de santé (FPH)", "milliers": clean(g.num("C35"), 3)}]
    assert abs(sum(x["milliers"] for x in etat) - versants["fpe"]["total_milliers"]) < 0.003
    assert abs(sum(x["milliers"] for x in local) - versants["fpt"]["total_milliers"]) < 0.01, sum(x["milliers"] for x in local)
    d = Sheet.get("chiffres", "D_tail_Economies")
    postes = {
        "total_apu": clean(d.num("J2")), "etat_apuc_hors_operateurs": clean(d.num("J38")), "apuc": clean(d.num("J3")),
        "collectivites_apul": clean(d.num("J43")), "france_travail": clean(d.num("J6")),
        "cells": {"total_apu": "J2", "apuc": "J3", "france_travail": "J6", "etat": "J38", "apul": "J43"},
        "check_apuc_plus_apul": clean(d.num("J3") + d.num("J43")),
        "check_apuc_plus_apul_vs_total": clean(d.num("J3") + d.num("J43") - d.num("J2")),
        "check_note": "151 000 (APUC) + 428 500 (APUL) = 579 500, soit 500 de moins que les 580 000 du manifeste et de la cellule J2 : arrondi de l'objectif de 580 000.",
        "restants_si_580000_fermes_milliers": clean(total - 580, 3),
        "source": d.source("I2:J43"),
    }
    return {
        "year": 2023, "unit": "milliers de personnes (effectifs physiques au 31 décembre)",
        "total_milliers": clean(total, 3), "par_statut": by_status, "par_versant": versants,
        "etat": etat, "collectivites": local, "hopitaux": sante,
        "etat_note": "GraphETP : 2 570,237 k = ministères (2 021,258) + opérateurs/EPA (548,979), regroupés par le livre en Sécurité / Enseignants / non régaliens / Agences.",
        "postes_fermes": postes,
        "source": {"kind": "dgafp", "ref": "DGAFP, Rapport annuel sur l'état de la fonction publique, édition 2025 — repris dans " + sh.ref("A3:C21") + " et " + g.ref("A27:C35"),
                   "url": "https://www.fonction-publique.gouv.fr/toutes-les-publications/rapport-annuel-sur-letat-de-la-fonction-publique-edition-2025",
                   "workbook": sh.source("C4:C21")},
        "tier": "donnee",
    }


def _representation():
    sh = Sheet.get("graphiques", "Graph51pc")
    steps = []
    prev = None
    labels = {"Citoyens": "Citoyens", "Elu direct": "Élu direct", "Assemblée": "Assemblée", "Commission": "Commission", "Conseil": "Conseil", "Comité": "Comité"}
    for i, c in enumerate("CDEFGH"):
        lab = sh.raw(f"{c}25")
        v = sh.num(f"{c}26")
        steps.append({"step": i, "label_fr": labels[lab], "value": clean(v, 6), "pct_of_previous": clean(v / prev * 100, 4) if prev else None, "cell": f"{c}26"})
        prev = v
    assert all(abs(s["pct_of_previous"] - 51) < 1e-6 for s in steps[1:]), [s["pct_of_previous"] for s in steps]
    return {
        "unit": "pour 100 citoyens", "steps": steps,
        "rule": "Chaque étape = 51 % de la précédente (100 → 51 → 26,01 → 13,27 → 6,77 → 3,45) : la chaîne est une construction du livre (calcul de Résolution), pas une statistique observée.",
        "source": sh.source("C25:H26"), "tier": "annonce",
    }


def _niches_summary():
    sh = Sheet.get("niches", "Synth_se")
    return {
        "unit": "Md€", "year": 2024,
        "nombre_recensees_plf2026": clean(sh.num("C7")), "cout_2024_md": clean(sh.num("D7"), 3),
        "cout_2024_avec_tva_toutes_apu_md": clean(sh.num("D8"), 3),
        "fait_generateur_eteint": {"nombre": clean(sh.num("C9")), "cout_md": clean(sh.num("D9"), 3)},
        "fait_generateur_eteint_fin_2025": {"nombre": clean(sh.num("C10")), "cout_md": clean(sh.num("D10"), 3)},
        "taux_reduits_tva_hors_niches": {"nombre": clean(sh.num("C11")), "cout_md": clean(sh.num("D11"), 3)},
        "total_niches_et_taux_reduits": {"nombre": clean(sh.num("C12")), "cout_md": clean(sh.num("D12"), 3)},
        "source": sh.source("B4:D14"),
        "detail": "Voir niches.json (465 niches une à une).",
    }


def build() -> dict:
    return {
        "meta": {
            "title_fr": "L'État partout : ministères, agences, impôts, niches, formulaires, mots de loi, agents publics",
            "tier_legend": {"donnee": "statistique publiée (Insee, Eurostat, DGAFP, Légifrance, PLF)", "annonce": "affirmation ou calcul des auteurs, sans texte de loi", "calcul": "dérivé par le pipeline"},
            "notes": [
                "Aucun jeu de données n'existe pour les « 2 000 CERFA » ni pour les « 438 impôts » : seuls les chiffres du manifeste sont repris (tier annonce) ; la ventilation des recettes 2024 par impôt vient de l'onglet « Refonte fiscalité ».",
            ],
        },
        "ministeres": _ministeres(),
        "agences": _agences(),
        "impots": _taxes(),
        "niches": _niches_summary(),
        "revendications_manifeste": _claims(),
        "mots_de_loi": _mots(),
        "effectifs_publics": _effectifs(),
        "representation_democratique": _representation(),
    }
