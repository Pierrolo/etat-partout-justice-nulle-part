"""europe.json — France vs Europe (sheets GraphGov and GraphRDB).

GraphGov holds two Eurostat tables stacked in one sheet:
  rows 9-42   tec00023  total general government expenditure, % of GDP (2024, 2025)
  rows 50-83  tec00127  net lending (+) / net borrowing (-), % of GDP (2024, 2025)
GraphRDB holds ilc_di03 (median equivalised net income) twice:
  rows 7-39   in euros (2024)
  rows 46-78  in purchasing power standards, PPS (2024)
Country labels are a mix of English and French in the source; they are mapped
below to a French name and the Eurostat geo code.

The workbook gives the rows (countries, aggregates); the VALUES come from the Eurostat snapshot of
data/eurostat/ (vintage of 21 October 2026, see eurostat.py). The workbook value is kept as
`value_classeur`; a cell Eurostat no longer publishes keeps the workbook value (`vintage: "classeur"`).
"""
from __future__ import annotations

import eurostat
from lib import Sheet, clean

# label in the workbook -> (Eurostat geo code, nom français, kind)
GEO = {
    # GraphGov (mixed EN / FR labels)
    "Finland": ("FI", "Finlande"), "France": ("FR", "France"), "Austria": ("AT", "Autriche"),
    "Belgium": ("BE", "Belgique"), "Sweden": ("SE", "Suède"), "Italy": ("IT", "Italie"),
    "Allemagne": ("DE", "Allemagne"), "Poland": ("PL", "Pologne"), "Croatia": ("HR", "Croatie"),
    "Greece": ("EL", "Grèce"), "Norway": ("NO", "Norvège"), "Slovakia": ("SK", "Slovaquie"),
    "Danemark": ("DK", "Danemark"), "Hungary": ("HU", "Hongrie"), "Iceland": ("IS", "Islande"),
    "Luxembourg": ("LU", "Luxembourg"), "Slovenia": ("SI", "Slovénie"), "Spain": ("ES", "Espagne"),
    "Latvia": ("LV", "Lettonie"), "Pays-Bas": ("NL", "Pays-Bas"), "Estonie": ("EE", "Estonie"),
    "Romania": ("RO", "Roumanie"), "Czechia": ("CZ", "Tchéquie"), "Portugal": ("PT", "Portugal"),
    "Lithuania": ("LT", "Lituanie"), "Bulgaria": ("BG", "Bulgarie"), "Cyprus": ("CY", "Chypre"),
    "Malta": ("MT", "Malte"), "Suisse": ("CH", "Suisse"), "Ireland": ("IE", "Irlande"),
    # GraphRDB (French labels)
    "Turquie": ("TR", "Turquie"), "Serbie": ("RS", "Serbie"), "Bulgarie": ("BG", "Bulgarie"),
    "Roumanie": ("RO", "Roumanie"), "Hongrie": ("HU", "Hongrie"), "Slovaquie": ("SK", "Slovaquie"),
    "Grèce": ("EL", "Grèce"), "Pologne": ("PL", "Pologne"), "Lituanie": ("LT", "Lituanie"),
    "Croatie": ("HR", "Croatie"), "Lettonie": ("LV", "Lettonie"), "Tchéquie": ("CZ", "Tchéquie"),
    "Espagne": ("ES", "Espagne"), "Slovénie": ("SI", "Slovénie"), "Malte": ("MT", "Malte"),
    "Italie": ("IT", "Italie"), "Chypre": ("CY", "Chypre"), "Suède": ("SE", "Suède"),
    "Allemagne ": ("DE", "Allemagne"), "Finlande": ("FI", "Finlande"), "Belgique": ("BE", "Belgique"),
    "Irlande": ("IE", "Irlande"), "Autriche": ("AT", "Autriche"), "Norvège": ("NO", "Norvège"),
}
GEO["Allemagne"] = ("DE", "Allemagne")

AGGREGATES = {
    "Euro area – 21 countries (from 2026)": ("EA21", "Zone euro (21 pays, depuis 2026)"),
    "Euro area – 20 countries (2023-2025)": ("EA20", "Zone euro (20 pays, 2023-2025)"),
    "Euro area - 19 countries  (2015-2022)": ("EA19", "Zone euro (19 pays, 2015-2022)"),
    "European Union - 27 countries (from 2020)": ("EU27_2020", "Union européenne (27 pays)"),
    "Union européenne - 27 pays (à partir de 2020)": ("EU27_2020", "Union européenne (27 pays)"),
    "Zone euro - 20 pays (2023-2025)": ("EA20", "Zone euro (20 pays, 2023-2025)"),
}

# Euro-area members over 2023-2025 (Eurostat aggregate « Euro area – 20 countries (2023-2025) »).
# Bulgaria joins on 1 Jan 2026 (aggregate « from 2026 » in the same sheet).
EURO_AREA_20 = {"AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "EL", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"}
EU27 = EURO_AREA_20 | {"BG", "CZ", "DK", "HU", "PL", "RO", "SE"}

URLS = {
    "tec00023": "https://ec.europa.eu/eurostat/databrowser/view/tec00023/default/table",
    "tec00127": "https://ec.europa.eu/eurostat/databrowser/view/tec00127/default/table?lang=en",
    "gov_10a_main": "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table?lang=en",
    "ilc_di03": "https://ec.europa.eu/eurostat/databrowser/view/ilc_di03/default/table?lang=fr&category=qol.qol_mlc.qol_mlc_i",
}


def _geo(label: str):
    lab = label.strip()
    if lab in AGGREGATES:
        code, name = AGGREGATES[lab]
        return code, name, "aggregate"
    if lab in GEO:
        code, name = GEO[lab]
        return code, name, "country"
    if label in GEO:
        code, name = GEO[label]
        return code, name, "country"
    raise KeyError(f"unmapped geo label: {label!r}")


def _read_block(sh: Sheet, first: int, last: int, cols):
    """rows first..last (1-based, inclusive); label in col A, values in cols."""
    out = []
    for r in range(first, last + 1):
        label = sh.at(r - 1, 0)
        if not label.strip():
            continue
        code, name, kind = _geo(label)
        vals = {}
        for year, col in cols.items():
            raw = sh.at(r - 1, col)
            vals[year] = sh.num(f"{chr(65 + col)}{r}")
            if vals[year] is None and raw.strip() not in ("",):
                vals[year] = None
        out.append({"label_src": label.strip(), "geo": code, "name_fr": name, "kind": kind, "row": r, "values": vals,
                    "raw": {y: sh.at(r - 1, c) for y, c in cols.items()}})
    return out


def _fr1(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def _refresh(records, key, years, fallback=None):
    """replace the workbook values by the Eurostat snapshot (key of eurostat.FIXED); `fallback` = another dataset of
    the snapshot for the geos that `key` does not publish (tec00127 → gov_10a_main for IS, NO, CH)."""
    changed = []
    for rec in records:
        rec["classeur"] = dict(rec["values"])
        rec["vintage"] = {}
        rec["dataset"] = {}
        for y in years:
            new, used = eurostat.value(key, rec["geo"], y), key
            if new is None and fallback:
                new, used = eurostat.value(fallback, rec["geo"], y), fallback
            if new is None:
                rec["vintage"][y] = "classeur" if rec["values"][y] is not None else None
                continue
            rec["vintage"][y] = "eurostat"
            rec["dataset"][y] = eurostat.dataset_of(used)
            if rec["values"][y] is None or abs(rec["values"][y] - new) > 1e-9:
                changed.append((rec["geo"], y, rec["values"][y], new))
            rec["values"][y] = new
    return changed


def _ranked(records, year):
    """competition ranks among countries only: (desc ranks, asc ranks, n).
    desc: 1 = highest value; asc: 1 = lowest value (ties share the best rank)."""
    items = [(r["values"][year], r["geo"]) for r in records if r["kind"] == "country" and r["values"].get(year) is not None]

    def comp(sign):
        srt = sorted(items, key=lambda t: (sign * t[0], t[1]))
        ranks, prev, rank = {}, None, 0
        for i, (v, g) in enumerate(srt, 1):
            if v != prev:
                rank, prev = i, v
            ranks[g] = rank
        return ranks

    return comp(-1), comp(1), len(items)


def build() -> dict:
    gov = Sheet.get("graphiques", "GraphGov")
    rdb = Sheet.get("graphiques", "GraphRDB")

    spend = _read_block(gov, 9, 42, {2024: 1, 2025: 2})
    deficit = _read_block(gov, 50, 83, {2024: 1, 2025: 2})
    med_eur = _read_block(rdb, 7, 39, {2024: 1})
    med_pps = _read_block(rdb, 46, 78, {2024: 1})
    assert len(spend) == 34 and len(deficit) == 34, (len(spend), len(deficit))  # 30 countries + 4 aggregates (EA21, EA20, EA19, EU27)
    assert len(med_eur) == 33 and len(med_pps) == 33, (len(med_eur), len(med_pps))

    # the sheet's own « relative to France » column (C29:C39) must equal the ratio of ITS values
    fr_wb = next(r for r in med_eur if r["geo"] == "FR")["values"][2024]
    for r in range(29, 40):
        src = rdb.num(f"C{r}")
        geo = _geo(rdb.at(r - 1, 0))[0]
        v = next(x for x in med_eur if x["geo"] == geo)["values"][2024]
        assert abs(src * 100 - (v / fr_wb - 1) * 100) < 0.01, (geo, src, v)

    # values: Eurostat snapshot (21 Oct 2026); the workbook's own figures are kept as value_classeur
    _refresh(spend, "tec00023", (2024, 2025))
    _refresh(deficit, "tec00127", (2024, 2025), fallback="gov_10a_main")
    _refresh(med_eur, "ilc_di03_eur", (2024,))
    _refresh(med_pps, "ilc_di03_pps", (2024,))

    def decorate(rec, family, unit):
        geo = rec["geo"]
        return {
            "geo": geo,
            "name_fr": rec["name_fr"],
            "label_source": rec["label_src"],
            "kind": rec["kind"],
            "is_france": geo == "FR",
            "is_euro_area": rec["kind"] == "aggregate" and geo.startswith("EA"),
            "is_euro_area_reference": geo == "EA20",
            "euro_area_member_2024": (geo in EURO_AREA_20) if rec["kind"] == "country" else None,
            "eu27_member": (geo in EU27) if rec["kind"] == "country" else None,
            "indicator": family,
            "unit": unit,
        }

    # ---- tidy long records
    spend_rows, deficit_rows = [], []
    for family, recs, unit, store, code in (
        ("depenses_publiques_pib", spend, "% du PIB", spend_rows, "tec00023"),
        ("solde_public_pib", deficit, "% du PIB", deficit_rows, "tec00127"),
    ):
        ranks = {y: _ranked(recs, y) for y in (2024, 2025)}
        for rec in recs:
            for y in (2024, 2025):
                v = rec["values"][y]
                base = decorate(rec, family, unit)
                base.update({
                    "year": y,
                    "value": clean(v, 3) if v is not None else None,
                    "missing": v is None,
                    "value_classeur": clean(rec["classeur"][y], 3) if rec["classeur"][y] is not None else None,
                    "vintage": rec["vintage"][y],
                    "dataset_eurostat": rec["dataset"].get(y),
                    "rank_desc": ranks[y][0].get(rec["geo"]) if rec["kind"] == "country" and v is not None else None,
                    "rank_asc": ranks[y][1].get(rec["geo"]) if rec["kind"] == "country" and v is not None else None,
                    "n_countries_ranked": ranks[y][2] if rec["kind"] == "country" else None,
                    "cell": f"{'BC'[y - 2024]}{rec['row']}",
                })
                store.append(base)

    # ---- median income
    def med_rows(recs, unit, indicator):
        fr = next(r for r in recs if r["geo"] == "FR")["values"][2024]
        ranks = _ranked(recs, 2024)
        out = []
        for rec in recs:
            v = rec["values"][2024]
            b = decorate(rec, indicator, unit)
            b.update({
                "year": 2024,
                "value": clean(v, 0),
                "value_classeur": clean(rec["classeur"][2024], 0),
                "vintage": rec["vintage"][2024],
                "vs_france_pct": clean((v / fr - 1) * 100, 2),
                "rank_desc": ranks[0].get(rec["geo"]) if rec["kind"] == "country" else None,
                "rank_asc": ranks[1].get(rec["geo"]) if rec["kind"] == "country" else None,
                "n_countries_ranked": ranks[2] if rec["kind"] == "country" else None,
                "cell": f"B{rec['row']}",
            })
            out.append(b)
        return out

    med_eur_rows = med_rows(med_eur, "€ par an", "revenu_median_eur")
    med_pps_rows = med_rows(med_pps, "SPA par an", "revenu_median_spa")

    # ---- wide country table for tables / small multiples
    countries = {}
    def put(rows, key):
        for x in rows:
            if x["kind"] != "country":
                continue
            c = countries.setdefault(x["geo"], {
                "geo": x["geo"], "name_fr": x["name_fr"], "is_france": x["is_france"],
                "euro_area_member_2024": x["euro_area_member_2024"], "eu27_member": x["eu27_member"],
            })
            c[key] = x["value"]
    for x in spend_rows:
        if x["kind"] == "country":
            c = countries.setdefault(x["geo"], {"geo": x["geo"], "name_fr": x["name_fr"], "is_france": x["is_france"],
                                                "euro_area_member_2024": x["euro_area_member_2024"], "eu27_member": x["eu27_member"]})
            c[f"depenses_pib_{x['year']}"] = x["value"]
    for x in deficit_rows:
        if x["kind"] == "country":
            countries[x["geo"]][f"solde_pib_{x['year']}"] = x["value"]
    put(med_eur_rows, "revenu_median_eur_2024")
    put(med_pps_rows, "revenu_median_spa_2024")
    wide = [countries[k] for k in sorted(countries, key=lambda g: countries[g]["name_fr"])]

    aggregates = {}
    for rows, key in ((spend_rows, "depenses_pib"), (deficit_rows, "solde_pib"), (med_eur_rows, "revenu_median_eur"), (med_pps_rows, "revenu_median_spa")):
        for x in rows:
            if x["kind"] == "aggregate":
                aggregates.setdefault(x["geo"], {"geo": x["geo"], "name_fr": x["name_fr"], "is_euro_area": x["is_euro_area"], "is_euro_area_reference": x["is_euro_area_reference"]})[f"{key}_{x['year']}"] = x["value"]
    aggs = [aggregates[k] for k in sorted(aggregates)]

    # sanity: values quoted by the book / source analysis
    fr_spend = {x["year"]: x["value"] for x in spend_rows if x["geo"] == "FR"}
    assert fr_spend == {2024: 57, 2025: 57.3}, fr_spend
    fr_def = {x["year"]: x["value"] for x in deficit_rows if x["geo"] == "FR"}
    assert fr_def == {2024: -5.8, 2025: -5.1}, fr_def
    fr_med = next(x for x in med_eur_rows if x["geo"] == "FR")["value"]
    ch_med = next(x for x in med_eur_rows if x["geo"] == "CH")["value"]
    assert (fr_med, ch_med) == (25557, 51926)

    fin = {x["year"]: x["value"] for x in spend_rows if x["geo"] == "FI"}
    rank_fr_24 = next(x for x in spend_rows if x["geo"] == "FR" and x["year"] == 2024)["rank_desc"]

    return {
        "meta": {
            "title_fr": "La France et l'Europe : dépenses publiques, solde public, revenu médian",
            "source": {
                "kind": "eurostat",
                "ref": f"Eurostat tec00023 (dépenses des administrations publiques, % du PIB) et tec00127 (capacité/besoin de financement, % du PIB ; gov_10a_main pour l'Islande, la Norvège et la Suisse, que tec00127 ne publie pas), mise à jour du {eurostat.vintage_fr('tec00023')} ; ilc_di03 (revenu médian équivalent, enquête SILC), mise à jour du {eurostat.vintage_fr('ilc_di03')}. Lignes (pays, agrégats) d'après " + gov.file_name + " › GraphGov, GraphRDB",
                "vintage": {"tec00023": eurostat.updated("tec00023"), "tec00127": eurostat.updated("tec00127"), "gov_10a_main": eurostat.updated("gov_10a_main"), "ilc_di03": eurostat.updated("ilc_di03")},
                "vintage_fr": eurostat.vintage_fr("tec00023"),
                "downloaded": "2026-11-21",
                "url": URLS["tec00023"],
                "datasets": URLS,
                "workbook": gov.source("A2:C83") | {"also": rdb.source("A2:B78")},
            },
            "tier": "donnee",
            "years": {"depenses_publiques_pib": [2024, 2025], "solde_public_pib": [2024, 2025], "revenu_median": [2024]},
            "income_year": {"revenu_median": 2023},
            "highlight": {"france": "FR", "euro_area_reference": "EA20", "euro_area_members": sorted(EURO_AREA_20)},
            "notes": [
                "Les libellés pays du classeur mélangent anglais et français ; geo = code Eurostat (EL = Grèce).",
                "Quatre agrégats par table : zone euro à 21 pays (depuis 2026), à 20 pays (2023-2025, valeurs 2024-2025 de référence), à 19 pays (2015-2022, même valeur que EA20 en 2024-2025) et UE27. Utiliser EA20 pour « la zone euro » ; EA21 et EA19 sont conservés tels que dans le classeur.",
                f"Valeurs : Eurostat, mise à jour du {eurostat.vintage_fr('tec00023')} (dépenses, solde) et du {eurostat.vintage_fr('ilc_di03')} (revenu médian), téléchargées le 21 novembre 2026 (data/eurostat/). value_classeur = valeur du classeur des auteurs (millésime antérieur) ; vintage = « eurostat », ou « classeur » quand Eurostat ne publie plus la cellule (solde public de l'Islande, de la Norvège et de la Suisse : valeur du classeur conservée).",
                "Revenu médian : enquête SILC 2024, qui mesure les revenus de 2023 (Irlande : les 12 mois précédant l'entretien).",
                "Appartenance à la zone euro (euro_area_member_2024) : métadonnée ajoutée par le pipeline d'après l'agrégat Eurostat « Euro area – 20 countries (2023-2025) » ; la Bulgarie rejoint la zone euro le 1er janvier 2026 (agrégat « 21 pays, depuis 2026 » de la même feuille).",
                "rank_desc : rang décroissant (1 = valeur la plus haute) et rank_asc : rang croissant (1 = valeur la plus basse), parmi les pays de la table (hors agrégats ; 30 pour les dépenses et le solde, 31 pour le revenu médian). Pour le solde public, rank_asc = 3 signifie « 3e plus mauvais solde » (France 2024).",
                f"« Record mondial » (manifeste) : dans ce jeu de données la Finlande ({_fr1(fin[2024])} %) dépasse la France ({_fr1(fr_spend[2024])} %) en 2024 ; la France est {rank_fr_24}e sur 30 en 2024 et 2e en 2025 (Finlande {_fr1(fin[2025])} %, France {_fr1(fr_spend[2025])} %) — voir facts.json, conflit « record_mondial ».",
                "revenu_median_eur : revenu médian équivalent, euros courants par an ; revenu_median_spa : en standards de pouvoir d'achat (SPA/PPS). Manifeste : « 2 100 euros par mois en France, contre 4 300 en Suisse » = 25 557 / 12 = 2 130 € et 51 926 / 12 = 4 327 € arrondis.",
            ],
        },
        "depenses_publiques_pib": spend_rows,
        "solde_public_pib": deficit_rows,
        "revenu_median_eur": med_eur_rows,
        "revenu_median_spa": med_pps_rows,
        "pays": wide,
        "agregats": aggs,
        "points_cles": {
            "france_depenses_pib_2024": fr_spend[2024],
            "france_depenses_pib_2025": fr_spend[2025],
            "finlande_depenses_pib_2024": fin[2024],
            "finlande_depenses_pib_2025": fin[2025],
            "france_rang_depenses_2024": rank_fr_24,
            "france_rang_deficit_2024_plus_mauvais": next(x for x in deficit_rows if x["geo"] == "FR" and x["year"] == 2024)["rank_asc"],
            "france_solde_pib_2024": fr_def[2024],
            "france_solde_pib_2025": fr_def[2025],
            "france_revenu_median_eur_2024": fr_med,
            "suisse_revenu_median_eur_2024": ch_med,
        },
    }
