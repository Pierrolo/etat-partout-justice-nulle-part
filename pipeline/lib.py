"""Shared helpers for the data pipeline (stdlib only, Python 3.13).

Design rules
------------
* Everything is deterministic: no timestamps, no randomness, no dict-order
  dependence (JSON is written with sorted keys; lists keep an explicit order).
* Inputs are *untrusted data*: they are only ever parsed (csv / json / text),
  never executed.  Run with ``python3 -I`` (isolated mode: no cwd / script dir
  on ``sys.path``; ``build.py`` adds this directory explicitly).
* Rounding policy (documented in site/src/data/README.md):
    - values copied from a source cell keep the source precision; binary float
      noise is removed by rounding half-up to 6 decimals (231.40699999999998
      -> 231.407);
    - derived Md€ values are rounded to 3 decimals (= millions of euros);
    - derived percentages are rounded to 2 decimals unless stated otherwise;
    - derived euros per foyer are rounded to the euro (half-up), per day to
      the cent.
"""
from __future__ import annotations

import csv
import json
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / "data" / "derived" / "csv"
PAGES_DIR = ROOT / "research" / "pages"
OUT_DIR = ROOT / "site" / "src" / "data"
ETAT_B_CSV = ROOT / "data" / "derived" / "etat_b_credits_retires_plf2027.csv"
REFORM_PARAMS = ROOT / "research" / "reform_parameters.json"

SITE = "https://france-resolution.fr"

# --------------------------------------------------------------------------
# Workbooks (CSV dumps).  key -> (csv folder, original file name on the site)
# --------------------------------------------------------------------------
WORKBOOKS = {
    "chiffres": ("Synth_se_Chiffres_R_solution_0910", "Synthèse Chiffres Résolution_0910.xlsx"),
    "graphiques": ("Synth_se_Graphiques_R_solution_0910", "Synthèse Graphiques Résolution_0910.xlsx"),
    "etp": ("Synth_se_ETP_et_agences_R_solution_0910", "Synthèse ETP et agences Résolution_0910.xlsx"),
    "niches": (
        "PLF_2026_V_M_tome_II_Annexe_3_Depenses_fiscales_0910",
        "PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls",
    ),
    "taxes_aff": (
        "PLF_2026_V_M_tome_I_Annexe_2_Taxes_affectees_0910",
        "PLF 2026_V&M tome I - Annexe 2 - Taxes affectees_0910.xls",
    ),
    "budget": (
        "PLF26_Depenses_2026_du_BG_et_des_BA_selon_nomenclatures_dest",
        "PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls",
    ),
    "apul": ("T_3305_APUL_R_solution_0910", "T_3305_APUL_Résolution_0910.xlsx"),
}

# CSV slug -> real sheet title (only for sheets we cite)
SHEET_TITLES = {
    "Annexe_Manuscrit": "Annexe Manuscrit",
    "CSG_CRDS": "CSG-CRDS",
    "Flux": "Flux",
    "D_tail_Niches": "Détail Niches",
    "D_tail_Economies": "Détail Economies",
    "Refonte_fiscalit": "Refonte fiscalité",
    "Input_Capitalisation": "Input Capitalisation",
    "Synth_se_agences_R": "Synthèse agences R",
    "Op_rateurs_R": "Opérateurs R",
    "ODAC_ODAL_R": "ODAC-ODAL R",
    "Synth_se_ETP": "Synthèse ETP",
    "Emplois_Etat_RAP_2024": "Emplois Etat RAP 2024",
    "Annexe_Etat": "Annexe Etat",
    "Commissions_R": "Commissions R",
    "Synth_se": "Synthèse",
    "Chiffrages_R_solution": "Chiffrages Résolution",
    "Ech_ances": "Échéances",
    "B_n_ficiaires": "Bénéficiaires",
    "Explication_d_taill": "Explication détaillée",
    "M_thodologie": "Méthodologie",
    "R_f_rences_juridiques": "Références juridiques",
    "Programme_de_rattachement": "Programme de rattachement",
    "Modalit_s_de_calcul_de_l_imp_t": "Modalités de calcul de l'impôt",
    "Synth_se_TA": "Synthèse TA",
    "taxes_affect_es": "taxes affectées",
    "Synth_seR": "SynthèseR",
    "M_tadonn_es": "Métadonnées",
}


def workbook_url(key: str) -> str:
    return f"{SITE}/donnees/{quote(WORKBOOKS[key][1])}"


# --------------------------------------------------------------------------
# Numbers
# --------------------------------------------------------------------------
_MISSING = {"", "-", "\xa0-", "\xa0", ":", "nc", "ε", "Non déterminé", "n.d."}


def clean(x, nd: int = 6):
    """Round half-up to ``nd`` decimals, return int when integral."""
    if x is None:
        return None
    d = Decimal(repr(float(x))).quantize(Decimal(1).scaleb(-nd), rounding=ROUND_HALF_UP)
    f = float(d)
    return int(f) if f == int(f) else f


def parse_num(s):
    """Parse a CSV cell into float, or None for empty / flagged cells."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    t = str(s).strip().replace("\xa0", "").replace(" ", "")
    if t in _MISSING or t == "":
        return None
    t = t.replace("−", "-").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def cell_flag(s):
    """Return the non-numeric flag carried by a niche cost cell, or None."""
    if s is None:
        return None
    t = str(s).strip().replace("\xa0", "")
    if t in ("ε",):
        return "epsilon"  # < 0,5 M€, not computed
    if t in ("nc",):
        return "nc"  # not computed
    if t in ("-",):
        return "aucun_effet"  # no budgetary effect
    if t in ("Non déterminé",):
        return "non_determine"
    return None


# --------------------------------------------------------------------------
# Sheets
# --------------------------------------------------------------------------
def col_letters(idx: int) -> str:
    s = ""
    idx += 1
    while idx:
        idx, r = divmod(idx - 1, 26)
        s = chr(65 + r) + s
    return s


def a1(r: int, c: int) -> str:
    """0-based (row, col) -> A1 address."""
    return f"{col_letters(c)}{r + 1}"


def parse_a1(addr: str) -> tuple[int, int]:
    m = re.fullmatch(r"([A-Z]+)(\d+)", addr)
    if not m:
        raise ValueError(f"bad A1 address: {addr}")
    col = 0
    for ch in m.group(1):
        col = col * 26 + (ord(ch) - 64)
    return int(m.group(2)) - 1, col - 1


class Sheet:
    """A CSV-dumped worksheet addressed in A1 notation (row/col positions are
    those of the original workbook because the dump keeps leading blanks)."""

    _cache: dict = {}

    def __init__(self, wb: str, slug: str):
        self.wb, self.slug = wb, slug
        folder = WORKBOOKS[wb][0]
        path = CSV_DIR / folder / f"{slug}.csv"
        with open(path, newline="", encoding="utf-8") as fh:
            self.rows = [list(r) for r in csv.reader(fh)]

    @classmethod
    def get(cls, wb: str, slug: str) -> "Sheet":
        k = (wb, slug)
        if k not in cls._cache:
            cls._cache[k] = cls(wb, slug)
        return cls._cache[k]

    # -- access -----------------------------------------------------------
    def raw(self, addr: str) -> str:
        r, c = parse_a1(addr)
        if r >= len(self.rows) or c >= len(self.rows[r]):
            return ""
        return self.rows[r][c]

    def at(self, r: int, c: int) -> str:
        if r < 0 or r >= len(self.rows) or c < 0 or c >= len(self.rows[r]):
            return ""
        return self.rows[r][c]

    def num(self, addr: str):
        return parse_num(self.raw(addr))

    @property
    def title(self) -> str:
        return SHEET_TITLES.get(self.slug, self.slug)

    @property
    def file_name(self) -> str:
        return WORKBOOKS[self.wb][1]

    def ref(self, cells: str | None = None) -> str:
        base = f"{self.file_name} › {self.title}"
        return f"{base} › {cells}" if cells else base

    def source(self, cells: str | None = None, kind: str = "workbook") -> dict:
        return {"kind": kind, "ref": self.ref(cells), "url": workbook_url(self.wb)}


# --------------------------------------------------------------------------
# Text normalisation / research pages
# --------------------------------------------------------------------------
def norm_text(s: str) -> str:
    """Normalise text for verbatim-quote checks (spaces, apostrophes, '1 er')."""
    s = s.replace(" ", " ").replace(" ", " ").replace(" ", " ")
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"(\d) er\b", r"\1er", s)
    return s.strip()


def ws(s: str) -> str:
    """Display-safe whitespace normalisation: keeps typographic characters
    (’ « » …) but collapses spaces/newlines and repairs PDF '1 er' artefacts."""
    s = s.replace("\u00a0", " ").replace("\u202f", " ")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"(\d) er\b", r"\1er", s)
    return s.strip()


def squash(s: str) -> str:
    """Aggressive normalisation (no whitespace at all) for tolerant matching of
    text that PDF extraction wrapped across lines."""
    return re.sub(r"\s+", "", norm_text(s))


_PAGE_CACHE: dict = {}


def read_page(name: str) -> str:
    """Return the raw text of research/pages/<name>.md."""
    if name not in _PAGE_CACHE:
        _PAGE_CACHE[name] = (PAGES_DIR / f"{name}.md").read_text(encoding="utf-8")
    return _PAGE_CACHE[name]


def quote_in(page: str, q: str) -> bool:
    return squash(q) in squash(read_page(page))


# --------------------------------------------------------------------------
# JSON output
# --------------------------------------------------------------------------
def dumps(obj, indent: int | None = 1) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=indent) + "\n"


def write_json(name: str, obj, indent: int | None = 1) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    p = OUT_DIR / name
    p.write_text(dumps(obj, indent), encoding="utf-8", newline="\n")
    return p


def load_reform_params() -> dict:
    with open(REFORM_PARAMS, encoding="utf-8") as fh:
        return json.load(fh)


def rp(params: dict, path: str):
    """Fetch a value from reform_parameters.json by dotted path."""
    cur = params
    for part in path.split("."):
        cur = cur[part]
    return cur


def fr(x, nd: int | None = None) -> str:
    """French-formatted number for prose (comma decimal, narrow no-break space
    thousands separator, true minus sign)."""
    v = clean(x, nd if nd is not None else 6)
    neg = v < 0
    s = f"{abs(v):.{nd}f}" if nd is not None else repr(abs(v))
    if "e" in s:
        s = f"{abs(v):f}".rstrip("0").rstrip(".")
    ip, _, fp = s.partition(".")
    ip = f"{int(ip):,}".replace(",", "\u202f")
    out = ip + ("," + fp if fp else "")
    return ("−" if neg else "") + out


def pct(part: float, whole: float, nd: int = 2):
    return clean(part / whole * 100.0, nd)
