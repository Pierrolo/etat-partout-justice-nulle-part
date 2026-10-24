"""Parse the three amendment liasses (research/pages/amendements__*.md).

The markdown files are `pdftotext -layout` output with form feeds (\\f) between
PDF pages, so a page number can be recovered for each amendment heading.
"""
from __future__ import annotations

import re

from lib import SITE, norm_text, read_page, squash, ws

LIASSES = {
    "PLF-P1": {
        "page": "amendements__Liasse_PLF_P1",
        "pdf": "Liasse_PLF_P1",
        "label_fr": "PLF 2027, première partie",
        "bill": "PLF 2027 n° 3210",
        "count": 34,
        "pages": 91,
    },
    "PLF-P2": {
        "page": "amendements__Liasse_PLF_P2",
        "pdf": "Liasse_PLF_P2",
        "label_fr": "PLF 2027, seconde partie",
        "bill": "PLF 2027 n° 3210",
        "count": 39,
        "pages": 66,
    },
    "PLFSS": {
        "page": "amendements__Liasse_PLFSS",
        "pdf": "Liasse_PLFSS",
        "label_fr": "PLFSS 2027",
        "bill": "PLFSS 2027 n° 3211",
        "count": 8,
        "pages": 22,
    },
}

_HEAD = re.compile(r"AMENDEMENT N° (\d+) \[(.*?)\]\s*\n", re.S)


def pdf_url(liasse: str, page: int | None = None) -> str:
    u = f"{SITE}/amendements/{LIASSES[liasse]['pdf']}.pdf"
    return f"{u}#page={page}" if page else u


def docx_url(liasse: str) -> str:
    return f"{SITE}/amendements/{LIASSES[liasse]['pdf']}.docx"


def _parse_summary_table(head_text: str) -> dict[int, dict]:
    """Parse the 'n° / article visé / objet' summary table(s) that precede the
    first amendment, using the column positions of each table header line."""
    out: dict[int, dict] = {}
    art_col = obj_col = None
    cur = None
    lot = None
    for raw in head_text.split("\n"):
        line = raw.rstrip()
        m_lot = re.match(r"\s*(LOT [IVX]+ : .+)$", line)
        if m_lot:
            lot = m_lot.group(1).strip()
            continue
        if re.match(r"^n°\s+article visé\s+objet", line):
            art_col = line.index("article visé")
            obj_col = line.index("objet")
            cur = None
            continue
        if art_col is None or not line.strip():
            continue
        m = re.match(r"^(\d{1,2})\s", line)
        if m and line.index(m.group(1)) == 0:
            n = int(m.group(1))
            art = line[art_col:obj_col].strip() if len(line) > obj_col else line[art_col:].strip()
            obj = line[obj_col:].strip()
            cur = {"n": n, "article_vise": art, "objet": obj, "lot": lot}
            out[n] = cur
        elif cur is not None:
            # continuation line of the previous row
            if len(line) > obj_col:
                art_more = line[art_col:obj_col].strip()
                obj_more = line[obj_col:].strip()
            else:  # only the article column wrapped
                art_more = line[art_col:].strip()
                obj_more = ""
            if art_more:
                cur["article_vise"] = (cur["article_vise"] + " " + art_more).strip()
            if obj_more:
                cur["objet"] = (cur["objet"] + " " + obj_more).strip()
    for r in out.values():
        r["objet"] = ws(r["objet"])
        r["article_vise"] = ws(r["article_vise"])
    return out


def parse_liasse(liasse: str) -> dict[int, dict]:
    """Return {n: record} for a liasse."""
    meta = LIASSES[liasse]
    raw = read_page(meta["page"])
    first = _HEAD.search(raw)
    assert first, f"no amendment heading in {liasse}"
    table = _parse_summary_table(raw[: first.start()].replace("\f", "\n"))

    recs: dict[int, dict] = {}
    heads = list(_HEAD.finditer(raw))
    for i, m in enumerate(heads):
        n = int(m.group(1))
        end = heads[i + 1].start() if i + 1 < len(heads) else len(raw)
        body = raw[m.start() : end]
        page = raw[: m.start()].count("\f") + 1
        title_up = ws(m.group(2))
        parts = body.split("EXPOSÉ SOMMAIRE", 1)
        dispositif = parts[0].replace("\f", "\n")
        expose = parts[1].replace("\f", "\n") if len(parts) > 1 else ""
        # article line in the body
        m_art = re.search(
            r"(ARTICLE ADDITIONNEL\s+APRÈS L’ARTICLE \d+|ARTICLE ADDITIONNEL AVANT L’ARTICLE \d+|ARTICLE ADDITIONNEL|ARTICLE \d+(?:, état B)?|Article additionnel[^\n]*)",
            dispositif,
        )
        recs[n] = {
            "liasse": liasse,
            "n": n,
            "id": f"{liasse}-{n}",
            "page": page,
            "title_upper": title_up,
            "dispositif": dispositif,
            "expose": expose,
            "article_corps": ws(m_art.group(1)) if m_art else None,
            "table": table.get(n),
        }
    return recs


_CACHE: dict = {}


def all_amendments() -> dict[str, dict[int, dict]]:
    if not _CACHE:
        for lid in LIASSES:
            _CACHE[lid] = parse_liasse(lid)
    return _CACHE


def amendment(liasse: str, n: int) -> dict:
    return all_amendments()[liasse][n]


def amendment_text(liasse: str, n: int) -> str:
    a = amendment(liasse, n)
    return a["dispositif"] + "\n" + a["expose"]


def first_sentence(expose: str) -> str:
    """First sentence of the exposé sommaire, verbatim (whitespace-normalised)."""
    t = ws(expose)
    m = re.match(r"(.+?[.!?])(?:\s+(?=[A-ZÀ-ÖØ-ÞÉ«\"(]|\d)|$)", t)
    return m.group(1).strip() if m else t[:240]


def quote_in_amendment(liasse: str, n: int, q: str) -> bool:
    return squash(q) in squash(amendment_text(liasse, n))
