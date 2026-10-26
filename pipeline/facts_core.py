"""Registry for facts.json.

Every fact:  id -> { value, unit, label_fr, year, source{kind, ref, url[, quote, also]}, tier, note?,
                    conflict?: true, conflicts?: [{group, with: [ids], note}] }

tier:
  loi      figure written in an amendment (dispositif or exposé sommaire)
  annonce  claim or estimate of the authors (manifeste, fiches, letters, Résolution workbooks), no legal text
  donnee   published third-party statistic (Insee, Eurostat, DGAFP, Légifrance, PLF documents), possibly
           carried by a Résolution workbook
  calcul   derived by this pipeline; `source.inputs` lists the facts used and `note` gives the formula

Every site / amendment quote is verified verbatim against research/pages/*.md at build time.
Values read from workbooks are read from the CSV dump at the cited cell (and checked against `expect`
when given), never typed by hand.
"""
from __future__ import annotations

from amend import amendment, pdf_url, quote_in_amendment
from lib import SITE, Sheet, clean, quote_in

TIERS = ("loi", "annonce", "donnee", "calcul")

PAGE_URL = {
    "manifeste": f"{SITE}/manifeste.html",
    "donnees": f"{SITE}/donnees.html",
    "fiches": f"{SITE}/fiches.html",
    "index": f"{SITE}/",
    "livre": f"{SITE}/livre.html",
}
INSEE_3301 = "https://www.insee.fr/fr/statistiques/8574707?sommaire=8574832"
INSEE_3217 = "https://www.insee.fr/fr/statistiques/8988845?sommaire=8988934"
INSEE_PATRIMOINE = "https://www.insee.fr/fr/statistiques/8988859?sommaire=8988934"
EUROSTAT = {
    "tec00023": "https://ec.europa.eu/eurostat/databrowser/view/tec00023/default/table",
    "tec00127": "https://ec.europa.eu/eurostat/databrowser/view/tec00127/default/table?lang=en",
    "ilc_di03": "https://ec.europa.eu/eurostat/databrowser/view/ilc_di03/default/table?lang=fr&category=qol.qol_mlc.qol_mlc_i",
}
DGAFP = "https://www.fonction-publique.gouv.fr/toutes-les-publications/rapport-annuel-sur-letat-de-la-fonction-publique-edition-2025"
LEGIFRANCE = "https://www.legifrance.gouv.fr/contenu/menu/autour-de-la-loi/legislatif-et-reglementaire/statistiques-de-la-norme"
PLF_DEPENSES_FISCALES = "https://www.budget.gouv.fr/documentation/documents-budgetaires-lois/exercice-2026/plf-2026"


def page_url(page: str) -> str:
    if page in PAGE_URL:
        return PAGE_URL[page]
    if page.startswith("fiches__"):
        return f"{SITE}/fiches/{page[len('fiches__'):]}.html"
    if page.startswith("lettres__"):
        return f"{SITE}/ecrire.html"
    raise KeyError(page)


class Facts:
    def __init__(self):
        self.d: dict[str, dict] = {}

    # -- low level -----------------------------------------------------------------
    def add(self, id, value, unit, label_fr, year, source, tier, note=None, **extra):
        assert id not in self.d, f"duplicate fact id {id}"
        assert tier in TIERS, (id, tier)
        assert source and source.get("kind") and source.get("ref"), id
        rec = {"value": value, "unit": unit, "label_fr": label_fr, "year": year, "source": source, "tier": tier}
        if note:
            rec["note"] = note
        rec.update(extra)
        self.d[id] = rec
        return rec

    def v(self, id):
        return self.d[id]["value"]

    # -- workbook ------------------------------------------------------------------
    def wb(self, id, wbkey, slug, cell, unit, label_fr, year, tier, note=None, scale=1.0, nd=6, expect=None, kind="workbook", url=None, ref_prefix=None, also=True, **extra):
        sh = Sheet.get(wbkey, slug)
        raw = sh.num(cell)
        assert raw is not None, f"{id}: empty cell {sh.ref(cell)}"
        val = clean(raw * scale, 6)  # source precision (binary float noise removed); display rounding is the site's job
        if expect is not None:
            assert abs(val - expect) < 1e-6, f"{id}: {sh.ref(cell)} = {val}, expected {expect}"
        src = sh.source(cell)
        if kind != "workbook":
            src = {"kind": kind, "ref": (ref_prefix + " — repris dans " if ref_prefix else "") + sh.ref(cell), "url": url or src["url"]}
            if also:
                src["also"] = {"kind": "workbook", "ref": sh.ref(cell), "url": sh.source(cell)["url"]}
        return self.add(id, val, unit, label_fr, year, src, tier, note, **extra)

    # -- site pages ----------------------------------------------------------------
    def site(self, id, value, unit, label_fr, year, page, quote, tier="annonce", note=None, ref=None, **extra):
        assert quote_in(page, quote), f"{id}: quote not found in {page}: {quote!r}"
        src = {"kind": "site", "ref": ref or f"france-resolution.fr › {page.replace('__', ' › ')}", "url": page_url(page), "quote": quote, "page": page}
        return self.add(id, value, unit, label_fr, year, src, tier, note, **extra)

    # -- amendments ----------------------------------------------------------------
    def amend(self, id, value, unit, label_fr, year, liasse, n, quote, tier="loi", note=None, **extra):
        assert quote_in_amendment(liasse, n, quote), f"{id}: quote not found in {liasse} n°{n}: {quote!r}"
        a = amendment(liasse, n)
        src = {"kind": "amendment", "ref": f"Amendement {liasse} n° {n} (page {a['page']} du PDF)", "url": pdf_url(liasse, a["page"]), "quote": quote, "liasse": liasse, "number": n}
        return self.add(id, value, unit, label_fr, year, src, tier, note, **extra)

    # -- external statistics (not through a workbook cell) -------------------------
    def external(self, id, value, unit, label_fr, year, kind, ref, url, tier="donnee", note=None, **extra):
        return self.add(id, value, unit, label_fr, year, {"kind": kind, "ref": ref, "url": url}, tier, note, **extra)

    # -- derived -------------------------------------------------------------------
    def calc(self, id, inputs, fn, unit, label_fr, year, formula, nd=6, note=None, **extra):
        vals = [self.d[i]["value"] for i in inputs]
        val = clean(fn(*vals), nd)
        src = {"kind": "calcul", "ref": "Calcul du pipeline : " + formula, "url": None, "inputs": list(inputs)}
        n = formula if not note else f"{note} Formule : {formula}"
        return self.add(id, val, unit, label_fr, year, src, "calcul", n, **extra)

    def calc_value(self, id, value, inputs, unit, label_fr, year, formula, note=None, **extra):
        """derived value computed by the caller (when it needs more than the facts' values)."""
        src = {"kind": "calcul", "ref": "Calcul du pipeline : " + formula, "url": None, "inputs": list(inputs)}
        n = formula if not note else f"{note} Formule : {formula}"
        return self.add(id, value, unit, label_fr, year, src, "calcul", n, **extra)

    # -- conflicts -----------------------------------------------------------------
    def conflict(self, group: str, ids: list[str], note: str):
        """flag every fact of `ids` as part of a conflict group (a fact may belong to several groups)."""
        for i in ids:
            assert i in self.d, f"conflict {group}: unknown fact {i}"
        for i in ids:
            f = self.d[i]
            f["conflict"] = True
            f.setdefault("conflicts", []).append({"group": group, "with": [j for j in ids if j != i], "note": note})

    def dump(self) -> dict:
        return {k: self.d[k] for k in sorted(self.d)}
