"""Eurostat snapshot (JSON-stat 2.0 responses of the dissemination API, saved under data/eurostat/).

The authors' workbook (GraphGov, GraphRDB) holds an older vintage of the same tables. The site shows the
vintage below; the workbook value is kept next to it (`value_classeur`) when it differs.

    tec00023  updated 2026-10-21  total general government expenditure, % of GDP  (freq A, unit PC_GDP, na_item TE, sector S13)
    tec00127  updated 2026-10-21  net lending (+) / net borrowing (-), % of GDP   (freq A, unit PC_GDP, na_item B9, sector S13)
    gov_10a_main updated 2026-10-21  same indicator (B9, % of GDP, S13) from the main aggregates table; it also publishes Iceland, Norway and
                                  Switzerland, which tec00127 leaves out (R2-03)
    ilc_di03  updated 2026-10-20  median equivalised net income (EU-SILC)       (statinfo MED_EI, unit EUR / PPS, age TOTAL, sex T)
    nama_10_gdp updated 2026-11-11  GDP at current prices, France only, M€     (unit CP_MEUR, na_item B1GQ, geo FR)

Downloaded on 2026-11-21 from
https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/<dataset>?format=JSON&lang=EN&sinceTimePeriod=2024
(ilc_di03 also with &age=TOTAL&sex=T; nama_10_gdp with &geo=FR&unit=CP_MEUR&na_item=B1GQ; gov_10a_main with
&unit=PC_GDP&sector=S13&na_item=B9). The files are only
parsed as JSON.
"""
from __future__ import annotations

import functools
import json

from lib import ROOT

DIR = ROOT / "data" / "eurostat"

FIXED = {
    "tec00023": {"freq": "A", "unit": "PC_GDP", "na_item": "TE", "sector": "S13"},
    "tec00127": {"freq": "A", "unit": "PC_GDP", "na_item": "B9", "sector": "S13"},
    "gov_10a_main": {"freq": "A", "unit": "PC_GDP", "na_item": "B9", "sector": "S13"},
    "ilc_di03_eur": {"freq": "A", "age": "TOTAL", "sex": "T", "statinfo": "MED_EI", "unit": "EUR"},
    "ilc_di03_pps": {"freq": "A", "age": "TOTAL", "sex": "T", "statinfo": "MED_EI", "unit": "PPS"},
    "nama_10_gdp": {"freq": "A", "unit": "CP_MEUR", "na_item": "B1GQ"},
}
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"


@functools.cache
def _raw(dataset: str) -> dict:
    with open(DIR / f"{dataset}.json", encoding="utf-8") as fh:
        return json.load(fh)


def updated(dataset: str) -> str:
    """last update of the dataset at Eurostat, ISO date (e.g. « 2026-10-21 »)."""
    return _raw(dataset)["updated"][:10]


def vintage_fr(dataset: str) -> str:
    y, m, d = updated(dataset).split("-")
    months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    return f"{int(d)}{'er' if d == '01' else ''} {months[int(m) - 1]} {y}"


@functools.cache
def series(key: str) -> dict[tuple[str, int], float | None]:
    """{(geo, year): value} for one of FIXED's keys; None when Eurostat publishes no value."""
    j = _raw(dataset_of(key))
    ids, size = j["id"], j["size"]
    idx = {k: j["dimension"][k]["category"]["index"] for k in ids}
    fixed = FIXED[key]
    out: dict[tuple[str, int], float | None] = {}
    for geo, gi in idx["geo"].items():
        for t, ti in idx["time"].items():
            flat = 0
            for k, s in zip(ids, size):
                p = gi if k == "geo" else ti if k == "time" else idx[k][fixed[k]]
                flat = flat * s + p
            v = j["value"].get(str(flat))
            out[(geo, int(t))] = float(v) if v is not None else None
    return out


def value(key: str, geo: str, year: int) -> float | None:
    return series(key).get((geo, year))


def snapshot_ref(key: str, geo: str, year: int) -> dict:
    """what validate.py needs to re-read a value from the snapshot."""
    return {"key": key, "geo": geo, "year": year, "updated": updated(dataset_of(key))}


def dataset_of(key: str) -> str:
    return key.split("_eur")[0].split("_pps")[0]
