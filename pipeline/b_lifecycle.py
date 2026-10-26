"""lifecycle.json — « Solidarité nationale au cours de la vie » (sheet GraphAFU).

Seven series of annual amounts (euros per year, by age 0 to 85) as drawn in the book's
stacked chart.  Rows 23-30 of GraphAFU: header row 23 (ages in C..CJ), series rows 24-30.
Two series are both called « Epargne retraite personnelle » in the source (rows 29 and 30,
values 20 064 and 6 600 from age 64): their meaning is not documented in the workbook.
"""
from __future__ import annotations

from lib import Sheet, clean, col_letters

SERIES = [
    # row, id, label_fr, kind, note
    (24, "aide_fondamentale", "Aide fondamentale universelle", "loi",
     "3 300 €/an jusqu'à 17 ans, 6 600 €/an à partir de 18 ans (PLF-P1 n° 28 : 3 300 € par personne à charge « jusqu'à l'année au cours de laquelle elle atteint l'âge de dix-huit ans », 6 600 € par adulte)."),
    (25, "compte_education", "Compte éducation", "annonce",
     "6 600 €/an de 0 à 18 ans inclus (19 valeurs) : annonce du manifeste, sans texte de loi (l'aide fondamentale cesse de 3 300 € à l'âge de 18 ans mais le compte éducation court jusqu'à 18 ans inclus)."),
    (26, "part_contributive_retraite", "Part contributive de retraite", "annonce",
     "6 600 €/an à partir de 64 ans (le modèle suppose un départ à 64 ans) : sens non documenté dans le classeur."),
    (27, "rendement_patrimoine", "Rendement du patrimoine restitué", "annonce",
     "264 €/an à tout âge (18,209 Md€ de rendement net annuel ÷ population) : voir facts.json."),
    (28, "aide_handicap", "Part d'aide handicap", "loi",
     "6 600 €/an de 0 à 63 ans (majoration invalidité de l'aide fondamentale, PLF-P1 n° 28) ; la série s'arrête à 63 ans, quand la part contributive de retraite prend le relais."),
    (29, "epargne_retraite_serie_1", "Épargne retraite personnelle (série 1)", "annonce",
     "20 064 €/an à partir de 64 ans — même libellé que la série 2 dans le classeur ; sens non documenté (20 064 = 3 × 6 600 + 264, calcul du pipeline : 19 800 + 264, non écrit dans le classeur)."),
    (30, "epargne_retraite_serie_2", "Épargne retraite personnelle (série 2)", "annonce",
     "6 600 €/an à partir de 64 ans — même libellé que la série 1 dans le classeur ; sens non documenté."),
]


def build() -> dict:
    sh = Sheet.get("graphiques", "GraphAFU")
    ages = []
    c = 2
    while c < len(sh.rows[22]) and sh.at(22, c).strip() != "":
        ages.append(int(float(sh.at(22, c))))
        c += 1
    assert ages == list(range(0, 86)), (ages[:3], ages[-3:])
    series_out = []
    records = []
    by_age = {a: {"age": a} for a in ages}
    for row, sid, label, kind, note in SERIES:
        src_label = sh.at(row - 1, 1).strip()
        assert src_label, (row, sid)
        vals = {}
        for i, a in enumerate(ages):
            raw = sh.at(row - 1, 2 + i)
            if raw.strip() != "":
                vals[a] = float(raw)
        assert vals, sid
        distinct = sorted(set(vals.values()))
        a_min, a_max = min(vals), max(vals)
        assert sorted(vals) == list(range(a_min, a_max + 1)), (sid, "non contiguous")
        series_out.append({
            "id": sid, "label_fr": label, "label_source": sh.at(row - 1, 1).strip(), "tier": kind, "unit": "€ par an",
            "age_min": a_min, "age_max": a_max, "n_values": len(vals), "distinct_values_eur": [clean(v, 0) for v in distinct],
            "row": row, "cells": f"C{row}:{col_letters(2 + 85)}{row}", "note": note,
        })
        for a in sorted(vals):
            records.append({"age": a, "series_id": sid, "label_fr": label, "value_eur_an": clean(vals[a], 0)})
            by_age[a][sid] = clean(vals[a], 0)
    ids = [s[1] for s in SERIES]
    wide = []
    for a in ages:
        rec = {"age": a}
        for sid in ids:
            rec[sid] = by_age[a].get(sid)
        rec["total_flux_annuels_eur_an"] = clean(sum(by_age[a].get(s) or 0 for s in ids if not s.startswith("epargne")), 0)
        wide.append(rec)
    # checks against the documented rules
    af = {r["age"]: r["value_eur_an"] for r in records if r["series_id"] == "aide_fondamentale"}
    assert all(af[a] == 3300 for a in range(0, 18)) and all(af[a] == 6600 for a in range(18, 86))
    return {
        "meta": {
            "title_fr": "Solidarité nationale au cours de la vie (aide fondamentale, compte éducation, retraite, patrimoine)",
            "unit": "€ par an et par personne",
            "ages": [0, 85],
            "source": sh.source("B23:CJ30"),
            "tier": "annonce",
            "tier_note": "Calcul de Résolution sur des hypothèses du plan ; seule l'aide fondamentale (et sa majoration invalidité) a une base légale (PLF-P1 n° 28).",
            "notes": [
                "Deux séries portent le même libellé « Epargne retraite personnelle » dans le classeur (lignes 29 et 30) : elles sont exportées séparément (serie_1 = 20 064 €, serie_2 = 6 600 €) ; leur sens n'est pas documenté.",
                "total_flux_annuels_eur_an = somme des cinq séries de flux annuels (hors les deux séries « épargne retraite personnelle », dont le sens — stock ou flux — n'est pas documenté) : calcul du pipeline, aucun total n'est publié dans le classeur.",
                "Âge de 64 ans : début de la « part contributive de retraite » et de l'épargne retraite dans le modèle.",
                "L'aide fondamentale de l'enfant (3 300 €) cesse l'année des 18 ans ; le compte éducation court de 0 à 18 ans inclus (19 valeurs) : écart d'un an signalé dans source-analysis §7.6.",
            ],
        },
        "series": series_out,
        "records": records,
        "by_age": wide,
    }
