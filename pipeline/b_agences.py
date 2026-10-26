"""agences.json — le sort des 1 104 agences d'État (et des organismes locaux).

Sources (Synthèse ETP et agences Résolution_0910.xlsx):
  Synthèse agences R  fate matrix (1 104 = opérateurs PLF 434 + hors PLF 328 + AAI 24 + commissions 318)
  Opérateurs R        180 lines = 434 operators (« Nb/cat. » entities per line), ETPT LFI 2025 / PLF 2026, fate flags
  ODAC-ODAL R         Insee ODAC (700 organisms, 372 already counted as operators) and ODAL (23 276 local)
  Commissions R       324 commissions (Jaune 2026)
  Emplois Etat RAP 2024, FPE  State employment by mission / physical headcount by ministry
plus the 337 legal entities dissolved on 1 July 2027 by PLF-P2 amendment 25.

Fates (workbook vocabulary): cession d'actif | suppression | internalisation |
autonomie = EPIC musée & patrimoine, EPIC enseignement & recherche, autorité indépendante.
"""
from __future__ import annotations

import collections
import re

from amend import amendment, pdf_url
from lib import Sheet, clean, ws
import b_etat

FATES = [
    ("cession", "Cession d'actif", "fermeture"),
    ("suppression", "Suppression", "fermeture"),
    ("internalisation", "Internalisation dans un ministère", "internalisation"),
    ("epic_musee", "Autonomie : EPIC musée et patrimoine", "autonomie"),
    ("epic_enseignement", "Autonomie : EPIC enseignement et recherche", "autonomie"),
    ("autorite_independante", "Autonomie : autorité indépendante", "autonomie"),
]
FATE_LABEL = {k: l for k, l, _ in FATES}
FATE_GROUP = {k: g for k, _, g in FATES}
GROUP_LABEL = {"fermeture": "Fermeture (cession ou suppression)", "internalisation": "Internalisation", "autonomie": "Autonomie (maintenue)"}

OP_FLAG_COLS = {13: "cession", 14: "suppression", 15: "epic_musee", 16: "epic_enseignement", 17: "internalisation"}  # N..R
ODAC_FLAG_COLS = {3: "cession", 4: "suppression", 5: "epic_musee", 6: "epic_enseignement", 7: "internalisation"}  # D..H

MISSIONS_CONSERVEES = {  # PLF-P2 amendment 27, I.1°-7°
    "DA": "Défense", "SB": "Sécurités", "JA": "Justice", "AA": "Action extérieure de l'État", "GA": "Gestion des finances publiques et lutte contre les fraudes",
    "SE": "Solidarité, insertion et égalité des chances", "EC": "Enseignement scolaire",
}


def _int(s):
    try:
        return int(float(str(s).replace("\xa0", "").strip()))
    except (ValueError, TypeError):
        return None


def _operateurs():
    sh = Sheet.get("etp", "Op_rateurs_R")
    out = []
    for r in range(5, len(sh.rows) + 1):
        row = sh.rows[r - 1]
        if len(row) < 18 or not row[4].strip():
            continue
        flags = [OP_FLAG_COLS[c] for c in OP_FLAG_COLS if row[c].strip()]
        assert len(flags) == 1, (r, row[4], flags)
        fate = flags[0]
        nb = _int(row[5])
        rec = {
            "id": f"op_{r:03d}",
            "name": ws(row[4]),
            "mission_code": row[0].strip(),
            "mission_fr": ws(row[1]),
            "programme_code": _int(row[2]),
            "programme_fr": ws(row[3]),
            "n_entities": nb,
            "etpt_lfi_2025": {"total": _int(row[6]), "sous_plafond": _int(row[7]), "hors_plafond": _int(row[8])},
            "etpt_plf_2026": {"total": _int(row[9]), "sous_plafond": _int(row[10]), "hors_plafond": _int(row[11])},
            "fate": fate, "fate_label_fr": FATE_LABEL[fate], "fate_group": FATE_GROUP[fate],
            "mission_conservee": row[0].strip() in MISSIONS_CONSERVEES,
            "cell_row": r,
        }
        out.append(rec)
    return sh, out


def _odac():
    sh = Sheet.get("etp", "ODAC_ODAL_R")
    recs = []
    fonction = None
    for r in range(6, 725):
        row = sh.rows[r - 1]
        if not row[0].strip():
            continue
        m = re.match(r"Fonction (\d+) : (.+)$", row[0])
        if m:
            fonction = (int(m.group(1)), ws(m.group(2)))
            continue
        flags = [ODAC_FLAG_COLS[c] for c in ODAC_FLAG_COLS if row[c].strip()]
        treated = row[2].strip().lower() == "oui"
        assert (treated and not flags) or (not treated and len(flags) == 1), (r, row)
        recs.append({
            "id": f"odac_{r:03d}", "name": ws(row[0]), "function_code": fonction[0], "function_fr": fonction[1],
            "already_counted_as_operator": treated,
            "fate": flags[0] if flags else None,
            "fate_label_fr": FATE_LABEL[flags[0]] if flags else None,
            "fate_group": FATE_GROUP[flags[0]] if flags else None,
            "cell_row": r,
        })
    assert len(recs) == 700
    assert sum(1 for x in recs if x["already_counted_as_operator"]) == 372
    # ODAL categories (rows 728-750)
    odal = []
    for r in range(728, 751):
        row = sh.rows[r - 1]
        if not row[0].strip():
            continue
        n = _int(row[1])
        treated = row[2].strip().lower() == "oui"
        flags = [ODAC_FLAG_COLS[c] for c in ODAC_FLAG_COLS if row[c].strip()]
        label = re.sub(r"\s+\d+$", "", ws(row[0]))
        assert treated or len(flags) == 1, (r, row)
        odal.append({"id": f"odal_{r:03d}", "category_fr": label, "n_organisms": n, "already_counted_as_operator": treated,
                     "fate": flags[0] if flags else None, "fate_label_fr": FATE_LABEL[flags[0]] if flags else None, "cell_row": r})
    # AAPI (independent authorities), rows 754-777
    aapi = []
    for r in range(754, 778):
        row = sh.rows[r - 1]
        if not row[0].strip():
            continue
        flags = [ODAC_FLAG_COLS[c] for c in ODAC_FLAG_COLS if row[c].strip()]
        assert len(flags) <= 1
        fate = flags[0] if flags else "autorite_independante"
        aapi.append({"id": f"aai_{r:03d}", "name": ws(row[0]), "fate": fate, "fate_label_fr": FATE_LABEL[fate], "fate_group": FATE_GROUP[fate],
                     "fate_is_default_kept": not flags, "cell_row": r})
    assert len(aapi) == 24, len(aapi)
    return sh, recs, odal, aapi


def _commissions():
    sh = Sheet.get("etp", "Commissions_R")
    recs = []
    for r in range(2, len(sh.rows) + 1):
        row = sh.rows[r - 1]
        if not row[1].strip():
            continue
        def num(i):
            v = row[i].strip().replace("\xa0", "")
            try:
                return float(v)
            except ValueError:
                return None
        recs.append({
            "id": f"com_{r:03d}", "ministere_fr": ws(row[0]), "name": ws(row[1]), "texte_institutif_fr": ws(row[2]) or None,
            "members": _int(row[3]),
            "cost_2022_keur": num(4), "cost_2023_keur": num(5), "cost_2024_keur": num(6),
            "meetings_2022": _int(row[7]), "meetings_2023": _int(row[8]), "meetings_2024": _int(row[9]),
            "statut_jaune_2026": ws(row[10]) or None,
            "fate": "suppression", "fate_label_fr": FATE_LABEL["suppression"],
            "cell_row": r,
        })
    for x in recs:
        for k in ("cost_2022_keur", "cost_2023_keur", "cost_2024_keur"):
            if x[k] is not None:
                x[k] = clean(x[k], 3)
    return sh, recs


def _emplois_etat():
    sh = Sheet.get("etp", "Emplois_Etat_RAP_2024")
    out = []
    for r in range(4, len(sh.rows) + 1):
        row = sh.rows[r - 1]
        if row[0] not in ("Mission", "Budget"):
            continue
        def num(i):
            v = row[i].strip() if len(row) > i else ""
            try:
                return clean(float(v), 2)
            except ValueError:
                return None
        out.append({
            "kind": "budget" if row[0] == "Budget" else "mission",
            "budget": row[1].strip(), "code": row[2].strip() or None, "label_fr": ws(row[3]),
            "etpt_realise_2023": num(5), "etpt_lfi_lfr_2024": num(6), "etpt_realise_2024": num(8), "ecart_realise_vs_lfi_2024": num(9),
            "sorties": num(17), "dont_retraites": num(18), "entrees": num(20), "dont_primo_recrutements": num(21),
            "schema_emplois_realise": num(23), "schema_emplois_prevision_pap": num(24),
            "mission_conservee": row[2].strip() in MISSIONS_CONSERVEES and row[1].strip() == "BG",
            "cell_row": r,
        })
    return sh, out


def _fpe():
    sh = Sheet.get("etp", "FPE")
    out = []
    for r in range(5, 18):
        label = ws(sh.at(r - 1, 0))
        tot = sh.num(f"F{r}")
        etat = sh.num(f"M{r}")
        out.append({
            "ministere_fr": label, "is_subtotal_child": label in ("Solidarités et santé", "Travail"),
            "total_tutelle_milliers": clean(tot, 3), "ministere_milliers": clean(etat, 3), "operateurs_milliers": clean(tot - etat, 3),
            "fonctionnaires": clean(sh.num(f"B{r}"), 3), "contractuels": clean(sh.num(f"C{r}"), 3), "militaires": clean(sh.num(f"D{r}"), 3), "autres": clean(sh.num(f"E{r}"), 3),
            "cells": f"A{r}:F{r}, M{r}",
        })
    top = [x for x in out if not x["is_subtotal_child"]]
    assert abs(sum(x["total_tutelle_milliers"] for x in top) - sh.num("F18")) < 0.002
    assert abs(sum(x["ministere_milliers"] for x in top) - sh.num("M18")) < 0.002
    return sh, out


def _dissolutions_am25():
    a = amendment("PLF-P2", 25)
    disp = a["dispositif"]
    i = disp.index("III. – Sont dissoutes")
    j = disp.index("IV. –", i)
    seg = re.sub(r"\s+", " ", disp[i:j])
    items = re.split(r"\s(?=\d{1,3}° )", seg)[1:]
    out = []
    for k, it in enumerate(items, 1):
        m = re.match(r"(\d+)° (.*)$", it)
        assert int(m.group(1)) == k, (k, it[:40])
        txt = ws(m.group(2)).rstrip(".")
        legal = None
        mm = re.search(r",? régie par (.*)$", txt)
        name = txt
        if mm:
            name = txt[: mm.start()].strip()
            legal = mm.group(1).strip()
        out.append({"n": k, "name": name, "legal_basis_fr": legal, "text_fr": txt})
    assert len(out) == 337, len(out)
    return out, a["page"]


def build() -> dict:
    etat_ag = b_etat._agences()
    sh_op, ops = _operateurs()
    sh_od, odac, odal, aapi = _odac()
    sh_co, coms = _commissions()
    sh_em, emplois = _emplois_etat()
    sh_fpe, fpe = _fpe()
    diss, page25 = _dissolutions_am25()

    # ---- checks vs matrix
    mat = {r["id"]: r for r in etat_ag["matrice"]}
    sum_nb = sum(o["n_entities"] for o in ops)
    assert sum_nb == mat["operateurs_plf"]["total"] == 434, sum_nb
    for k, _, _ in FATES:
        n = sum(o["n_entities"] for o in ops if o["fate"] == k)
        assert n == mat["operateurs_plf"].get(k, 0), (k, n)
    row4 = {k: sh_op.num(f"{c}4") for c, k in zip("NOPQR", ["cession", "suppression", "epic_musee", "epic_enseignement", "internalisation"])}
    for k, v in row4.items():
        s = sum(o["etpt_lfi_2025"]["total"] for o in ops if o["fate"] == k)
        assert s == v, (k, s, v)
    etpt_lfi = sum(o["etpt_lfi_2025"]["total"] for o in ops)
    etpt_plf = sum(o["etpt_plf_2026"]["total"] for o in ops)
    sous_plafond_plf = sum(o["etpt_plf_2026"]["sous_plafond"] for o in ops)
    assert (etpt_lfi, etpt_plf, sous_plafond_plf) == (479514, 478026, 401310), (etpt_lfi, etpt_plf, sous_plafond_plf)

    odac_hors = [x for x in odac if not x["already_counted_as_operator"]]
    cnt = collections.Counter(x["fate"] for x in odac_hors)
    for k in ("cession", "suppression", "internalisation", "epic_musee", "epic_enseignement"):
        assert cnt.get(k, 0) == mat["organismes_hors_plf"][k], (k, cnt.get(k, 0), mat["organismes_hors_plf"][k])
    assert len(odac_hors) == 328
    odal_n = sum(x["n_organisms"] for x in odal)
    odal_untreated = sum(x["n_organisms"] for x in odal if not x["already_counted_as_operator"])
    assert odal_n == 23276 and odal_untreated == mat["agences_locales"]["total"] == 23264, (odal_n, odal_untreated)
    odal_by_fate = collections.Counter()
    for x in odal:
        if x["fate"]:
            odal_by_fate[x["fate"]] += x["n_organisms"]
    for k in ("cession", "suppression", "internalisation", "epic_enseignement"):
        assert odal_by_fate[k] == mat["agences_locales"][k], (k, odal_by_fate[k])
    aapi_cnt = collections.Counter(x["fate"] for x in aapi)
    assert aapi_cnt["suppression"] == mat["autorites_independantes"]["suppression"] == 10
    assert aapi_cnt["internalisation"] == mat["autorites_independantes"]["internalisation"] == 9
    assert aapi_cnt["autorite_independante"] == 5
    n_com = len(coms)
    en_vigueur = sum(1 for c in coms if (c["statut_jaune_2026"] or "").lower().startswith("en vigueur"))
    cost24 = clean(sum(c["cost_2024_keur"] or 0 for c in coms), 3)

    # ---- by mission (operators)
    by_m = collections.OrderedDict()
    for o in ops:
        d = by_m.setdefault((o["mission_code"], o["mission_fr"]), {"mission_code": o["mission_code"], "mission_fr": o["mission_fr"], "lines": 0, "n_entities": 0, "etpt_lfi_2025": 0, "etpt_plf_2026": 0,
                                                              "mission_conservee": o["mission_conservee"], "par_sort": collections.Counter()})
        d["lines"] += 1
        d["n_entities"] += o["n_entities"]
        d["etpt_lfi_2025"] += o["etpt_lfi_2025"]["total"]
        d["etpt_plf_2026"] += o["etpt_plf_2026"]["total"]
        d["par_sort"][o["fate"]] += o["n_entities"]
    par_mission = []
    for k, d in sorted(by_m.items(), key=lambda kv: (-kv[1]["n_entities"], kv[0][1])):
        d["par_sort"] = {f: d["par_sort"].get(f, 0) for f, _, _ in FATES if d["par_sort"].get(f, 0)}
        par_mission.append(d)
    assert sum(d["n_entities"] for d in par_mission) == 434

    # ---- by ministry de rattachement (commissions)
    by_min = collections.OrderedDict()
    for c in coms:
        d = by_min.setdefault(c["ministere_fr"], {"ministere_fr": c["ministere_fr"], "n_commissions": 0, "members": 0, "cost_2024_keur": 0.0, "meetings_2024": 0})
        d["n_commissions"] += 1
        d["members"] += c["members"] or 0
        d["cost_2024_keur"] += c["cost_2024_keur"] or 0
        d["meetings_2024"] += c["meetings_2024"] or 0
    com_by_min = [{**d, "cost_2024_keur": clean(d["cost_2024_keur"], 3)} for d in sorted(by_min.values(), key=lambda d: (-d["n_commissions"], d["ministere_fr"]))]

    waffle = [{"fate": k, "label_fr": l, "group": g, "n": etat_ag["matrice"][0][k]} for k, l, g in FATES]
    assert sum(w["n"] for w in waffle) == 1104
    groups = collections.OrderedDict()
    for w in waffle:
        groups[w["group"]] = groups.get(w["group"], 0) + w["n"]
    group_counts = [{"group": g, "label_fr": GROUP_LABEL[g], "n": n} for g, n in groups.items()]
    assert [g["n"] for g in group_counts] == [746, 55, 303]

    return {
        "meta": {
            "title_fr": "Le sort des 1 104 agences d'État",
            "source": sh_op.source("A2:R184") | {"also": [etat_ag["source"]["ref"], sh_od.ref(), sh_co.ref(), sh_em.ref(), sh_fpe.ref()]},
            "tier": "annonce",
            "tier_note": "Les « sorts » (cession, suppression, internalisation, autonomie) sont la proposition de Résolution (colonnes ajoutées au classeur) ; les effectifs et les listes d'organismes viennent de LFI 2025, PLF 2026, Insee (ODAC/ODAL), Jaune 2026, DGAFP, RAP 2024. Seule la liste de l'amendement PLF-P2 n° 25 (337 entités dissoutes au 1er juillet 2027) a valeur de texte de loi.",
            "fates": [{"id": k, "label_fr": l, "group": g, "group_label_fr": GROUP_LABEL[g]} for k, l, g in FATES],
            "counts": {"agences_etat": 1104, "apres_reforme": 303, "fermees": 746, "internalisees": 55, "locales": 23264, "total": 24368,
                       "operateurs_plf": 434, "organismes_hors_plf": 328, "autorites_independantes": 24, "commissions_matrice": 318, "commissions_feuille": n_com},
            "notes": [
                "1 104 = 434 opérateurs (feuille Opérateurs R, 180 lignes dont certaines regroupent plusieurs entités : n_entities) + 328 organismes hors PLF (ODAC Insee non déjà comptés) + 24 autorités indépendantes + 318 commissions.",
                "La feuille Commissions R compte " + f"{n_com} lignes dont {en_vigueur} « en vigueur » (le reste : supprimées depuis 2024) ; la matrice retient 318 commissions, toutes supprimées.",
                "L'amendement PLF-P2 n° 25 cite « 431 opérateurs » et dissout 337 personnes morales nommées : périmètre différent des 746 fermetures du livre (voir DISCREPANCIES.md).",
                "Les ETPT des opérateurs sont ceux de la LFI 2025 (479 514 au total) et du PLF 2026 (478 026 ; 401 310 sous plafond).",
            ],
        },
        "matrice_sorts": etat_ag["matrice"],
        "sorts_agences_etat": waffle,
        "sorts_groupes": group_counts,
        "operateurs": ops,
        "operateurs_totaux": {"n_lignes": len(ops), "n_entites": sum_nb, "etpt_lfi_2025": etpt_lfi, "etpt_plf_2026": etpt_plf, "etpt_plf_2026_sous_plafond": sous_plafond_plf,
                              "etpt_lfi_2025_par_sort": {k: int(v) for k, v in row4.items()}},
        "operateurs_par_mission": par_mission,
        "organismes_odac": odac,
        "organismes_odal_categories": odal,
        "autorites_independantes": aapi,
        "commissions": coms,
        "commissions_par_ministere": com_by_min,
        "commissions_totaux": {"n": n_com, "en_vigueur": en_vigueur, "cout_2024_keur": cost24,
                               "note": "Coût de fonctionnement 2024 cumulé ≈ 32,5 M€ (Jaune 2026)."},
        "emplois_etat_rap_2024": emplois,
        "effectifs_fpe_par_ministere_2023": {"unit": "milliers (effectifs physiques au 31 décembre 2023)", "rows": fpe, "source": sh_fpe.source("A4:M19")},
        "entites_dissoutes_loi": {
            "amendement": "PLF-P2 n° 25", "date": "2027-07-01", "n": len(diss), "tier": "loi",
            "source": {"kind": "amendment", "ref": "Amendement PLF-P2 n° 25, III (liste de 337 personnes morales dissoutes)", "url": pdf_url("PLF-P2", page25)},
            "liste": diss,
        },
        "missions_conservees": [{"code": k, "mission_fr": v} for k, v in MISSIONS_CONSERVEES.items()],
        "missions_conservees_source": {"kind": "amendment", "ref": "Amendement PLF-P2 n° 27, I (1° à 7°)", "url": pdf_url("PLF-P2", amendment("PLF-P2", 27)["page"]), "tier": "loi"},
    }
