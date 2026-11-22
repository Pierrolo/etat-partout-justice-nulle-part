#!/usr/bin/env python3
"""Text diff of the site pages (research/pages vs research/pages-2026-11-21), of the PDF text of
the manifeste and fiches, and an inventory of the new pages.
Usage: python3 -I scripts/diff_pages.py <repo_root> <out.md>"""
import sys, os, re, difflib, subprocess, json
from bs4 import BeautifulSoup

root, out = sys.argv[1:3]
OLDP, NEWP = os.path.join(root, "research/pages"), os.path.join(root, "research/pages-2026-11-21")
RAWO, RAWN = os.path.join(root, "data/raw"), os.path.join(root, "data/raw-2026-11-21")


def wd(a, b):
    wa, wb = a.split(), b.split()
    sm = difflib.SequenceMatcher(None, wa, wb, autojunk=False)
    o = []
    for t, i1, i2, j1, j2 in sm.get_opcodes():
        if t == "equal":
            o.append(" ".join(wa[i1:i2]))
        else:
            if i2 > i1: o.append("[-" + " ".join(wa[i1:i2]) + "-]")
            if j2 > j1: o.append("{+" + " ".join(wb[j1:j2]) + "+}")
    return " ".join(o)


def page_diff(a_lines, b_lines):
    sm = difflib.SequenceMatcher(None, a_lines, b_lines, autojunk=False)
    res = []
    for t, i1, i2, j1, j2 in sm.get_opcodes():
        if t == "equal":
            continue
        if t == "replace" and (i2 - i1) == (j2 - j1):
            for x, y in zip(a_lines[i1:i2], b_lines[j1:j2]):
                res.append("~ " + wd(x, y))
        else:
            for x in a_lines[i1:i2]:
                if x.strip(): res.append("- " + x)
            for y in b_lines[j1:j2]:
                if y.strip(): res.append("+ " + y)
    return res


L = ["# Site pages, manifeste, fiches: text diff (October snapshot → 2026-11-21)", "",
     "Notation: `~ line` = same line with word-level edits (`[-old-]` `{+new+}`); `- line` removed; `+ line` added. Source: markdown conversions (`research/pages` vs `research/pages-2026-11-21`, the latter built with `scripts/html_to_md_v2.py`).", ""]
old_md = {f for f in os.listdir(OLDP) if f.endswith(".md")}
new_md = {f for f in os.listdir(NEWP) if f.endswith(".md")}
common = sorted(f for f in old_md & new_md if not f.startswith(("amendements__", "lettres__")))
L += ["## 1. Pages present in both snapshots", "", f"{len(common)} pages. All 29 October pages still exist (none removed).", ""]
ident = []
for f in common:
    a = open(os.path.join(OLDP, f), encoding="utf-8").read().split("\n")
    b = open(os.path.join(NEWP, f), encoding="utf-8").read().split("\n")
    d = page_diff(a, b)
    if not d:
        ident.append(f)
        continue
    L += [f"### {f[:-3].replace('__', '/')}.html — {len(d)} changed lines", ""] + ["    " + x for x in d] + [""]
L += ["Identical text (only navigation/markup differs): " + ", ".join(f"`{f[:-3].replace('__', '/')}.html`" for f in ident), ""]

# navigation
L += ["## 2. Navigation and markup changes (not in the markdown text)", ""]
def nav(raw, f):
    t = open(os.path.join(raw, "site_html", f), encoding="utf-8").read()
    m = re.search(r'<ul class=a-rub>(.*?)</ul>', t, re.S)
    top = re.findall(r'>([^<]+)</a></li>', m.group(1)) if m else []
    foot = re.findall(r'<a class=s-ml href="[^"]*">([^<]+)</a>', t)
    return top, foot
to, fo = nav(RAWO, "index.html"); tn, fn = nav(RAWN, "index.html")
L += [f"- top menu: {' · '.join(to)} → {' · '.join(tn)}", f"- footer links: {' · '.join(fo)} → {' · '.join(fn)}",
      "- every fiche page gained a « Les propositions » link under the download button and its menu points « Propositions » to `propositions.html` instead of `fiches.html`; `fiche.css` grew from 48 366 to 59 082 bytes.", ""]

# PDFs
def pdfwords(p):
    t = subprocess.run(["pdftotext", p, "-"], capture_output=True, text=True).stdout
    return t.replace(" ", " ").replace(" ", " ").replace("\x0c", " ¶PAGE ").split()
L += ["## 3. PDF text (manifeste and fiches whose bytes changed)", "",
      "Hunks that only change letter-spacing of the headings (e.g. `P LA N CHA NGE` → `PLAN CHANGE`) are filtered out; page-break position changes are shown as `¶PAGE`.", ""]
for name, o, n in [("manifeste.pdf", "manifeste.pdf", "manifeste.pdf")] + [(f"fiches/{f}.pdf", f"fiches_pdf/{f}.pdf", f"fiches_pdf/{f}.pdf") for f in ("contribuable", "entreprise-ou-association-subventionnee", "entreprise", "retraite")]:
    a, b = pdfwords(os.path.join(RAWO, o)), pdfwords(os.path.join(RAWN, n))
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    hunks = []
    for t, i1, i2, j1, j2 in sm.get_opcodes():
        if t == "equal": continue
        x, y = " ".join(a[i1:i2]), " ".join(b[j1:j2])
        if re.sub(r"[\s¶]|PAGE", "", x).casefold() == re.sub(r"[\s¶]|PAGE", "", y).casefold(): continue
        hunks.append(f"…{' '.join(a[max(0, i1 - 6):i1])} [-{x}-]{{+{y}+}} {' '.join(a[i2:i2 + 6])}…")
    L += [f"### {name}", ""] + ([f"- {h}" for h in hunks] if hunks else ["- no textual change"]) + [""]

# key promise numbers
L += ["## 4. Key promise numbers on the pages that exist in both snapshots", "",
      "Counts of occurrences (HTML visible text + manifeste.pdf + fiches PDFs) in the files common to both snapshots. Equal counts = the promise is unchanged.", ""]
def vis(p):
    s = BeautifulSoup(open(p, encoding="utf-8"), "lxml")
    for t in s(["style", "svg"]): t.decompose()
    return re.sub(r"\s+", " ", re.sub(r"data:[a-z/+\-]+;base64,[A-Za-z0-9+/=]+", "", s.get_text(" ", strip=True)).replace(" ", " ").replace(" ", " "))
def pdft(p):
    return re.sub(r"\s+", " ", subprocess.run(["pdftotext", p, "-"], capture_output=True, text=True).stdout.replace(" ", " ").replace(" ", " "))
def collect(raw):
    d = {}
    for f in sorted(os.listdir(os.path.join(raw, "site_html"))):
        if f.endswith(".html"): d["html:" + f] = vis(os.path.join(raw, "site_html", f))
    d["pdf:manifeste.pdf"] = pdft(os.path.join(raw, "manifeste.pdf"))
    for f in sorted(os.listdir(os.path.join(raw, "fiches_pdf"))): d["pdf:fiches/" + f] = pdft(os.path.join(raw, "fiches_pdf", f))
    return d
do, dn = collect(RAWO), collect(RAWN)
TERMS = [("600 € / 600 euros", r"600 (?:€|euros)"), ("300 € / 300 euros", r"\b300 (?:€|euros)"), ("20 000 €", r"20 000 (?:€|euros)"), ("236 Md€ / milliards", r"\b236 (?:Md€|milliards)"),
         ("580 000", r"580 000"), ("7 ministères", r"\b7 ministères"), ("303", r"\b303\b"), ("1 104", r"1 104"), ("550 €", r"550 €"), ("275 €", r"275 €"), ("6 600", r"6 600"),
         ("0,77 / 77 centimes", r"77 centimes|0,77"), ("13 % (avec ou sans +)", r"\+?13 %"), ("« +13 % »", r"\+13 %"), ("438", r"\b438\b"), ("486", r"\b486\b"),
         ("81 amendements", r"81 amendements"), ("84 amendements", r"84 amendements")]
L += ["The count differences for « 236 », « 13 % », « 486 » and « 81/84 amendements » come from `donnees.html` (descriptive paragraphs removed, header counts changed) and from the manifeste (« +13 % »); none comes from a fiche.", ""]
L += ["| term | October (common files) | new (same files) | changed? |", "|---|---:|---:|---|"]
for lab, rx in TERMS:
    co = sum(len(re.findall(rx, v)) for v in do.values())
    cn = sum(len(re.findall(rx, v)) for k, v in dn.items() if k in do)
    L.append(f"| {lab} | {co} | {cn} | {'**yes**' if co != cn else 'no'} |")
L.append("")

# new pages
L += ["## 5. New pages (absent in October)", "", "| URL | title | meta description | markdown chars |", "|---|---|---|---:|"]
newpages = sorted(f for f in new_md - old_md if not f.startswith(("amendements__", "lettres__")) and not f.endswith(".docx.txt"))
for f in newpages:
    t = open(os.path.join(NEWP, f), encoding="utf-8").read()
    title = re.search(r"^# (.*)$", t, re.M).group(1)
    desc = re.search(r"_Meta description_: (.*)", t)
    L.append(f"| `{f[:-3].replace('__', '/')}.html` | {title} | {desc.group(1) if desc else ''} | {len(t)} |")
L += ["", "The 39 `onglets/*.html` pages are HTML renderings of the worksheets of `Synthèse des chiffrages` (7), `Séries des graphiques` (12), `Emplois publics` (5), `Agences publiques` (5) and `Niches fiscales` (10); `graphiques/*.html` are the 14 chart pages (each with a PNG landscape/portrait and a PDF; titles carry figures, e.g. « 1 104 agences aujourd’hui, 303 demain », « 486 niches fiscales aujourd’hui, 0 demain » and **« 434 prélèvements aujourd’hui, 4 grands impôts demain »**, whereas manifeste/fiches/propositions say « 438 »); `propositions.html` is a JavaScript map of the proposals whose card texts are in `research/pages-2026-11-21/propositions.md`; `coin-marginal.html` is a 22-slide dossier « Résolution × AIRE, taxation marginale » (modèle SISSI 2026, novembre 2026: marginal rates of 100 %, 116 %, 155 %, 84 % … for the cases shown).", ""]
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print("written", out, len(L), "lines")
