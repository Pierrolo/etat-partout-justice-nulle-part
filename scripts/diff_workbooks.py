#!/usr/bin/env python3
"""Cell-level diff of the workbook dumps (data/derived vs data/derived-2026-11-21) plus a
formula-level diff for the xlsx workbooks (openpyxl, data_only=False; nothing is executed).
Workbooks were renamed on the live site; MAP gives old file -> new file(s) (checked with the
redirects recorded in data/raw-2026-11-21/_crawl_manifest.json).
Usage: python3 -I scripts/diff_workbooks.py <repo_root> <out.md>"""
import sys, os, csv, re, hashlib
import openpyxl
from openpyxl.utils import get_column_letter as L

root, out = sys.argv[1], sys.argv[2]
OLD = os.path.join(root, "data/derived/csv")
NEW = os.path.join(root, "data/derived-2026-11-21/csv")
RAW_OLD = os.path.join(root, "data/raw/donnees")
RAW_NEW = os.path.join(root, "data/raw-2026-11-21/donnees")


def slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")[:60]


MAP = [  # (old workbook file, [new workbook files])
    ("Synthèse Chiffres Résolution_0910.xlsx", ["Synthèse des chiffrages.xlsx"]),
    ("Synthèse Graphiques Résolution_0910.xlsx", ["Séries des graphiques.xlsx"]),
    ("Synthèse ETP et agences Résolution_0910.xlsx", ["Emplois publics.xlsx", "Agences publiques.xlsx"]),
    ("T_3305_APUL_Résolution_0910.xlsx", ["Dépenses locales.xlsx"]),
    ("PLF 2026_V&M tome I - Annexe 2 - Taxes affectees_0910.xls", ["Taxes affectées aux agences.xls"]),
    ("PLF 2026_V&M tome II - Annexe 3 - Depenses fiscales - 0910.xls", ["Niches fiscales.xls"]),
    ("PLF26 - Depenses 2026 du BG et des BA selon nomenclatures destination et nature_0910.xls", ["Dépenses de l'État.xls"]),
]


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def grid(p):
    return list(csv.reader(open(p, encoding="utf-8")))


def num(s):
    try:
        return float(s)
    except Exception:
        return None


def same(x, y):
    if x == y:
        return True
    a, b = num(x), num(y)
    return a is not None and b is not None and abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))


def fmt(s):
    if s is None:
        return "∅"
    f = num(s)
    if f is not None and s.strip() != "" and re.search(r"\.\d{5,}", s):
        return repr(round(f, 6)).rstrip("0").rstrip(".") if abs(f) < 1e6 else repr(round(f, 2))
    return s if s != "" else "(vide)"


def label(rb, ra):
    for row in (rb, ra):
        cands = [c.strip().replace("\n", " ") for c in row[:4] if c.strip() and num(c) is None]
        if cands:
            return max(cands, key=len)   # the long text, not the one-letter code of column A
    return ""


def header(g, j):
    for r in g[:6]:
        if j < len(r) and r[j].strip() and num(r[j]) is None:
            return r[j].strip()
    return ""


lines = ["# Workbook diff (October snapshot → 2026-11-21), cell level", "",
         "Values are the cached cell values dumped by `scripts/dump_workbooks.py`; A1 refs are those of the sheet. "
         "Floats are shown rounded to 6 decimals; ∅ = cell absent.", "",
         "## 1. Workbook inventory (renames and splits)", "",
         "| October file (sha256[:12], bytes) | Live file(s) (sha256[:12], bytes) | Verdict |", "|---|---|---|"]
sheet_rows = []
detail = []
for of, nfs in MAP:
    op = os.path.join(RAW_OLD, of)
    osha, osz = sha(op)[:12], os.path.getsize(op)
    ncell = []
    for nf in nfs:
        np_ = os.path.join(RAW_NEW, nf)
        ncell.append(f"`{nf}` ({sha(np_)[:12]}, {os.path.getsize(np_)})")
    verdict = "byte-identical (renamed only)" if len(nfs) == 1 and sha(op) == sha(os.path.join(RAW_NEW, nfs[0])) else ("SPLIT in two files" if len(nfs) > 1 else "CONTENT CHANGED")
    lines.append(f"| `{of}` ({osha}, {osz}) | " + "<br>".join(ncell) + f" | {verdict} |")
    # sheets
    od = os.path.join(OLD, slug(os.path.splitext(of)[0]))
    nds = {nf: os.path.join(NEW, slug(os.path.splitext(nf)[0])) for nf in nfs}
    newsheets = {}
    for nf, d in nds.items():
        for f in os.listdir(d):
            newsheets[f] = (nf, os.path.join(d, f))
    for f in sorted(os.listdir(od)):
        if f not in newsheets:
            sheet_rows.append((of, f, "(absent)", "REMOVED"))
            continue
        nf, npth = newsheets[f]
        a, b = grid(os.path.join(od, f)), grid(npth)
        cells = []
        for i in range(max(len(a), len(b))):
            ra = a[i] if i < len(a) else []
            rb = b[i] if i < len(b) else []
            for j in range(max(len(ra), len(rb))):
                x = ra[j] if j < len(ra) else None
                y = rb[j] if j < len(rb) else None
                if not same(x, y):
                    cells.append((i, j, x, y, ra, rb))
        shape = f"{len(a)}×{max(map(len, a), default=0)} → {len(b)}×{max(map(len, b), default=0)}"
        sheet_rows.append((of, f, nf, f"{len(cells)} cells changed" if cells else "identical", shape))
        if cells:
            detail.append((of, nf, f, a, b, cells, shape))
    for f in newsheets:
        if not os.path.exists(os.path.join(od, f)):
            sheet_rows.append((of, "(absent)", newsheets[f][0] + " / " + f, "NEW SHEET"))

lines += ["", "## 2. Sheet-by-sheet status", "", "| October workbook | sheet file | live workbook | status | shape old → new |", "|---|---|---|---|---|"]
for r in sheet_rows:
    r = list(r) + [""] * (5 - len(r))
    lines.append("| " + " | ".join(str(x) for x in r) + " |")

lines += ["", "## 3. Cell-level changes", ""]
for of, nf, f, a, b, cells, shape in detail:
    lines += [f"### {nf} — sheet `{f}` (from `{of}`), shape {shape}", ""]
    if len(cells) > 120:
        # structural change (e.g. columns added): summarise
        oldcols = max(map(len, a))
        newcols = max(map(len, b))
        inside = [c for c in cells if c[1] < oldcols and c[0] < len(a)]
        lines.append(f"{len(cells)} cells differ; {len(inside)} of them lie inside the October grid (columns A–{L(oldcols)}), the rest are NEW columns {L(oldcols + 1)}–{L(newcols)}. Header row 2 of the new columns:")
        lines.append("")
        for j in range(oldcols, newcols):
            lines.append(f"- {L(j + 1)}: `{b[1][j] if len(b) > 1 and j < len(b[1]) else ''}` — Total général (row 3): `{b[2][j] if len(b) > 2 and j < len(b[2]) else ''}`; units (row 4): `{b[3][j] if len(b) > 3 and j < len(b[3]) else ''}`")
        lines.append("")
        if inside:
            for i, j, x, y, ra, rb in inside[:60]:
                lines.append(f"- {L(j + 1)}{i + 1} ({label(rb, ra)}): `{fmt(x)}` → `{fmt(y)}`")
        lines.append("")
        continue
    lines += ["| cell | row label | column header | old | new | Δ |", "|---|---|---|---|---|---|"]
    for i, j, x, y, ra, rb in cells:
        fx, fy = num(x) if x is not None else None, num(y) if y is not None else None
        d = f"{fy - fx:+.6g}" if fx is not None and fy is not None else ""
        lines.append(f"| {L(j + 1)}{i + 1} | {label(rb, ra)[:60]} | {header(b, j)[:40]} | `{fmt(x)}` | `{fmt(y)}` | {d} |")
    lines.append("")

# formulas (xlsx only)
lines += ["## 4. Formula-level check (xlsx, data_only=False)", ""]
for of, nfs in MAP:
    if not of.endswith(".xlsx") or len(nfs) != 1:
        continue
    wa = openpyxl.load_workbook(os.path.join(RAW_OLD, of), data_only=False)
    wb = openpyxl.load_workbook(os.path.join(RAW_NEW, nfs[0]), data_only=False)
    tot = 0
    for ws in wa.worksheets:
        if ws.title not in wb.sheetnames:
            lines.append(f"- `{nfs[0]}`: sheet `{ws.title}` removed")
            continue
        w2 = wb[ws.title]
        diffs = []
        for row in range(1, max(ws.max_row, w2.max_row) + 1):
            for col in range(1, max(ws.max_column, w2.max_column) + 1):
                u, v = ws.cell(row, col).value, w2.cell(row, col).value
                if isinstance(u, str) and u.startswith("=") or isinstance(v, str) and str(v).startswith("="):
                    if u != v:
                        diffs.append((L(col) + str(row), u, v))
        tot += len(diffs)
        if diffs:
            lines.append(f"- `{nfs[0]}` / `{ws.title}`: {len(diffs)} formula cells differ")
            for ref, u, v in diffs[:40]:
                lines.append(f"  - {ref}: `{u}` → `{v}`")
    lines.append(f"- `{nfs[0]}`: {tot} formula cells differ in total (0 means every change above is a hard-coded value change).")
    lines.append("")
open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("written", out, len(lines), "lines")
