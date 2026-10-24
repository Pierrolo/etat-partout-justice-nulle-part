"""depenses-cofog.json — the 1 672 Md€ hierarchy (sheet Graph1672Md).

The sheet holds two views of the same INSEE table 3.301 (COFOG, 2024):

* rows 29-44: the book's own 6-group / 16-member regrouping (chart labels such
  as « Sécurité 106 » carry the *rounded* group totals);
* rows 50-129: the INSEE COFOG divisions (10) and sub-functions (≈80).

The regrouping is not documented in the workbook, but every one of the 16
members can be rebuilt *exactly* (to the rounding of the source) from COFOG
sub-functions.  ``MEMBER_LEAVES`` below is that mapping; the build asserts that
each member equals the sum of its leaves (±0.002 Md€) so that the tree can be
drawn down to the COFOG sub-function while staying faithful to the sheet.
Two points are inferences made from the arithmetic and are flagged in the
output: « Administrations » includes 09.6 (Services annexes à l'enseignement,
20,023) and excludes 01.5 (R&D, 0,006 Md€, left out of the book's chart).
"""
from __future__ import annotations

import re

from lib import Sheet, clean, pct

SHEET = ("graphiques", "Graph1672Md")
TOTAL_CELL = "D50"
FOYER_EUR = 54000  # « L'État dépense 54 000 euros par foyer et par an » (manifeste)

# (group id, group label, [(member id, member label, row of the member in the sheet, [leaf codes])])
GROUPS = [
    ("securite", "Sécurité", 29, [
        ("defense", "Défense", 29, ["02.1", "02.2", "02.3", "02.4", "02.5"]),
        ("interieur", "Intérieur (police, sécurité civile)", 30, ["03.1", "03.2", "03.6"]),
        ("justice", "Justice (tribunaux, prisons)", 31, ["03.3", "03.4", "03.5"]),
    ]),
    ("depenses_collectives", "Dépenses collectives", 32, [
        ("administrations", "Administrations", 32, ["01.1", "01.3", "01.6", "09.6"]),
        ("infrastructures", "Infrastructures", 33, ["06.2", "06.3", "06.4", "06.5", "06.6"]),
        ("environnement", "Environnement", 34, ["05.1", "05.2", "05.3", "05.4", "05.5", "05.6"]),
    ]),
    ("enseignement_recherche", "Enseignement et recherche", 35, [
        ("education", "Éducation", 35, ["09.1", "09.2", "09.3", "09.4", "09.5", "09.7", "09.8"]),
        ("recherche", "Recherche fondamentale", 36, ["01.4"]),
    ]),
    ("secu_solidarite", "Sécurité sociale et solidarité", 37, [
        ("aides_sociales", "Aides sociales", 37, ["10.1", "10.3", "10.4", "10.7", "10.8", "10.9"]),
        ("sante", "Santé", 38, ["07.1", "07.2", "07.3", "07.4", "07.5", "07.6"]),
        ("retraites", "Retraites", 39, ["10.2"]),
        ("chomage", "Allocations chômage", 40, ["10.5"]),
    ]),
    ("soutiens_sectoriels", "Soutiens sectoriels", 41, [
        ("subventions_eco", "Subventions économiques", 41, ["01.2", "04.1", "04.2", "04.3", "04.4", "04.5", "04.6", "04.7", "04.8", "04.9"]),
        ("logement", "Aides au logement", 42, ["06.1", "10.6"]),
        ("loisirs_culture", "Loisirs, culture", 43, ["08.1", "08.2", "08.3", "08.4", "08.5", "08.6"]),
    ]),
    ("dette", "Charge de la dette", 44, [
        ("charge_dette", "Charge de la dette", 44, ["01.7"]),
    ]),
]

# Leaves present in the INSEE table but absent from the book's regrouping
UNASSIGNED = {"01.5": "R&D concernant les services généraux (0,006 Md€, non repris dans le graphique du livre)",
              "01.8": "Transferts de caractère général entre administrations publiques (0)"}

DIV_RE = re.compile(r"^\s*(\d{2}) - (.+)$")
SUB_RE = re.compile(r"^\s*(\d{2}\.\d) - (.+)$")


def _tidy_label(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    return s


def build() -> dict:
    sh = Sheet.get(*SHEET)
    total = sh.num(TOTAL_CELL)
    assert abs(total - 1671.794) < 1e-9, total

    # ---- INSEE divisions and sub-functions (rows 51-129, label in col C, value in col D)
    divisions, subs = [], {}
    cur_div = None
    for r in range(50, len(sh.rows)):
        label = sh.at(r, 2)
        val = sh.num(f"D{r + 1}")
        m1, m2 = DIV_RE.match(label), SUB_RE.match(label)
        if m2:
            code = m2.group(1)
            subs[code] = {
                "code": code,
                "division": code[:2],
                "label_fr": _tidy_label(m2.group(2)),
                "value_md": clean(val, 3),
                "cell": f"D{r + 1}",
            }
        elif m1 and not m2:
            cur_div = m1.group(1)
            divisions.append({
                "code": cur_div,
                "label_fr": _tidy_label(m1.group(2)),
                "value_md": clean(val, 3),
                "cell": f"D{r + 1}",
            })
    assert len(divisions) == 10, len(divisions)
    assert len(subs) == 69, len(subs)

    # ---- checks on the INSEE side
    div_sum = sum(d["value_md"] for d in divisions)
    insee_checks = {
        "divisions_sum_md": clean(div_sum, 3),
        "total_md": clean(total, 3),
        "divisions_minus_total_md": clean(div_sum - total, 3),
        "note": "La somme des 10 divisions COFOG dépasse le total de 0,001 Md€ : arrondi de la source (INSEE, tableau 3.301).",
    }
    for d in divisions:
        s = sum(v["value_md"] for v in subs.values() if v["division"] == d["code"])
        d["subfunctions_sum_md"] = clean(s, 3)
        d["subfunctions_gap_md"] = clean(s - d["value_md"], 3)
        assert abs(s - d["value_md"]) <= 0.0025, (d, s)

    # ---- the book's regrouping
    used = {}
    tree_children = []
    for gid, glabel, grow, members in GROUPS:
        gnode_children = []
        g_sum = 0.0
        for mid, mlabel, mrow, leafcodes in members:
            # (for « Charge de la dette » the value sits on the group row itself, D44)
            sheet_val = sh.num(f"D{mrow}")
            leaves = []
            for code in leafcodes:
                assert code in subs, code
                assert code not in used, (code, used[code])
                used[code] = mid
                leaves.append(subs[code])
            leaf_sum = sum(l["value_md"] for l in leaves)
            assert abs(leaf_sum - sheet_val) <= 0.0025, (mid, leaf_sum, sheet_val)
            inferred = mid in ("administrations", "education")
            mnode = {
                "id": mid,
                "label_fr": mlabel,
                "level": 2,
                "value_md": clean(sheet_val, 3),
                "sheet_cell": f"D{mrow}",
                "leaf_sum_md": clean(leaf_sum, 3),
                "children": [
                    {
                        "id": f"cofog_{l['code']}",
                        "label_fr": l["label_fr"],
                        "level": 3,
                        "cofog_code": l["code"],
                        "value_md": l["value_md"],
                        "sheet_cell": l["cell"],
                    }
                    for l in leaves
                ],
                "mapping_inferred": inferred,
            }
            g_sum += sheet_val
            gnode_children.append(mnode)
        gnode = {
            "id": gid,
            "label_fr": glabel,
            "level": 1,
            "value_md": clean(g_sum, 3),
            "children": gnode_children,
        }
        tree_children.append(gnode)
    unassigned = []
    for code, why in UNASSIGNED.items():
        if code in subs:
            unassigned.append({"cofog_code": code, "label_fr": subs[code]["label_fr"], "value_md": subs[code]["value_md"], "why": why})
    assert set(used) | set(UNASSIGNED) == set(subs), set(subs) - set(used) - set(UNASSIGNED)

    tree_sum = clean(sum(g["value_md"] for g in tree_children), 3)
    residual = clean(total - tree_sum, 3)
    assert 0 <= residual <= 0.01, residual

    # group labels carry rounded totals: « Sécurité \n106 »
    for g_node, (gid, glabel, grow, _) in zip(tree_children, GROUPS):
        lab = sh.at(grow - 1, 1)
        m = re.search(r"(\d+)\s*$", lab)
        g_node["label_total_rounded_md"] = int(m.group(1)) if m else None
        if m:
            assert abs(g_node["label_total_rounded_md"] - g_node["value_md"]) < 0.51, (gid, lab, g_node["value_md"])

    # shares + per-foyer reframing (denominator: 54 000 €/foyer => 30,96 M foyers implicites)
    def decorate(node, depth=0):
        v = node["value_md"]
        node["share_pct"] = pct(v, total, 2)
        node["eur_par_foyer_an"] = clean(v / total * FOYER_EUR, 0) if v else 0
        node["eur_par_foyer_jour"] = clean(v / total * FOYER_EUR / 365, 2) if v else 0
        for ch in node.get("children", []):
            decorate(ch, depth + 1)

    root = {
        "id": "total",
        "label_fr": "Dépenses publiques 2024",
        "level": 0,
        "value_md": clean(total, 3),
        "sheet_cell": TOTAL_CELL,
        "children": tree_children,
    }
    decorate(root)
    root["share_pct"] = 100

    # flat table (tree order)
    flat = []
    flat.append({"id": "total", "parent_id": None, "level": 0, "label_fr": root["label_fr"], "value_md": root["value_md"],
                 "share_pct": 100, "eur_par_foyer_an": FOYER_EUR, "eur_par_foyer_jour": clean(FOYER_EUR / 365, 2),
                 "group_id": None, "member_id": None, "cofog_code": None, "is_leaf": False})
    for g in tree_children:
        flat.append({"id": g["id"], "parent_id": "total", "level": 1, "label_fr": g["label_fr"], "value_md": g["value_md"],
                     "share_pct": g["share_pct"], "eur_par_foyer_an": g["eur_par_foyer_an"], "eur_par_foyer_jour": g["eur_par_foyer_jour"],
                     "group_id": g["id"], "member_id": None, "cofog_code": None, "is_leaf": False})
        for m in g["children"]:
            flat.append({"id": m["id"], "parent_id": g["id"], "level": 2, "label_fr": m["label_fr"], "value_md": m["value_md"],
                         "share_pct": m["share_pct"], "eur_par_foyer_an": m["eur_par_foyer_an"], "eur_par_foyer_jour": m["eur_par_foyer_jour"],
                         "group_id": g["id"], "member_id": m["id"], "cofog_code": None, "is_leaf": False})
            for l in m["children"]:
                flat.append({"id": l["id"], "parent_id": m["id"], "level": 3, "label_fr": l["label_fr"], "value_md": l["value_md"],
                             "share_pct": l["share_pct"], "eur_par_foyer_an": l["eur_par_foyer_an"], "eur_par_foyer_jour": l["eur_par_foyer_jour"],
                             "group_id": g["id"], "member_id": m["id"], "cofog_code": l["cofog_code"], "is_leaf": True})

    securite = next(g for g in tree_children if g["id"] == "securite")

    return {
        "meta": {
            "title_fr": "Où va l'argent public : 1 672 Md€ de dépenses des administrations publiques en 2024",
            "year": 2024,
            "unit": "Md€",
            "total_md": clean(total, 3),
            "source": {
                "kind": "insee",
                "ref": "Insee, comptes nationaux, tableau 3.301 (dépenses des APU par fonction, COFOG) — repris dans " + sh.ref(),
                "url": "https://www.insee.fr/fr/statistiques/8574707?sommaire=8574832",
                "workbook": sh.source("A29:D44, C50:D129"),
            },
            "tier": "donnee",
            "per_foyer_denominator": {
                "eur_par_foyer_an": FOYER_EUR,
                "foyers_implicites_millions": clean(total * 1000 / FOYER_EUR / 1000, 3),
                "note": (
                    "eur_par_foyer_* = part du total × 54 000 € (chiffre du manifeste : « L'État dépense 54 000 euros par foyer et par an »). "
                    "Le dénominateur implicite est donc 1 671,794 Md€ ÷ 54 000 € = 30,96 M de foyers ; c'est celui de la source pour ce chiffre, "
                    "différent des 30 M des fiches, des 29,5 M du tableau des 236 Md€ et des 40,2 M de foyers fiscaux (voir facts.json, groupe conflit « foyer_denominateurs »)."
                ),
            },
            "hierarchy_levels": {
                "0": "total",
                "1": "6 groupes du livre (libellés du graphique)",
                "2": "16 postes du livre (colonne C, lignes 29-44)",
                "3": "sous-fonctions COFOG (Insee 3.301), reconstituées de façon exacte pour chaque poste",
            },
            "d3_hint": "d3.hierarchy(tree).sum(d => d.children ? 0 : d.value_md) ; value_md des nœuds internes = somme de leurs enfants (à l'arrondi près).",
            "notes": [
                "Les valeurs value_md des groupes sont calculées (somme des postes) ; le graphique du livre n'affiche que des totaux arrondis (106, 181, 149, 933, 244) dans les libellés : voir label_total_rounded_md.",
                "Postes « Administrations » et « Éducation » : rattachement des sous-fonctions déduit de l'arithmétique (09.6 « Services annexes à l'enseignement », 20,023 Md€, est compté dans « Administrations » ; l'« Éducation » du livre = division 09 moins 09.6) — mapping_inferred = true.",
                "La sous-fonction 01.5 (R&D des services généraux, 0,006 Md€) n'apparaît dans aucun des 16 postes du livre : écart résiduel de 0,005 Md€ entre le total INSEE et la somme des postes (voir checks).",
                "« Défense, police et justice reçoivent 6 % des dépenses publiques » (manifeste) : groupe Sécurité = 106,312 Md€ = 6,36 % du total.",
            ],
        },
        "tree": root,
        "flat": flat,
        "groups": [
            {
                "id": g["id"],
                "label_fr": g["label_fr"],
                "value_md": g["value_md"],
                "label_total_rounded_md": g["label_total_rounded_md"],
                "share_pct": g["share_pct"],
                "eur_par_foyer_an": g["eur_par_foyer_an"],
                "members": [m["id"] for m in g["children"]],
            }
            for g in tree_children
        ],
        "cofog_divisions": [
            {**d, "share_pct": pct(d["value_md"], total, 2)} for d in divisions
        ],
        "cofog_subfunctions": [
            {**subs[c], "share_pct": pct(subs[c]["value_md"], total, 2), "member_id": used.get(c)}
            for c in sorted(subs)
        ],
        "unassigned_subfunctions": unassigned,
        "checks": {
            **insee_checks,
            "tree_groups_sum_md": tree_sum,
            "tree_vs_total_residual_md": residual,
            "tree_residual_explained_by": "sous-fonction 01.5 absente du graphique du livre (0,006 Md€) moins l'arrondi INSEE de 0,001 Md€ sur la somme des divisions",
            "securite_share_pct": securite["share_pct"],
            "all_members_equal_leaf_sums_within_md": 0.002,
        },
    }


if __name__ == "__main__":
    import json
    out = build()
    print(json.dumps(out["checks"], ensure_ascii=False, indent=1))
    print(len(out["flat"]), "flat rows")
