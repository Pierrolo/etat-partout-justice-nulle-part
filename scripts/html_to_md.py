#!/usr/bin/env python3
"""Convert crawled HTML pages (data/raw/site_html/*.html) into readable markdown
files in research/pages/. Usage: python3 -I html_to_md.py <html_dir> <out_dir>"""
import sys, os, re
from bs4 import BeautifulSoup, NavigableString
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
SKIP_CLASSES = {"s-retour", "s-pied", "s-xls"}
def txt(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).replace(" ,", ",").replace(" .", ".").replace(" )", ")").replace("( ", "(").strip()
def walk(el, lines):
    for ch in el.children:
        if isinstance(ch, NavigableString): continue
        if ch.name in ("script", "style", "svg", "nav") : continue
        cl = set(ch.get("class") or [])
        if cl & SKIP_CLASSES: continue
        if ch.name == "h1": lines.append("# " + txt(ch)); lines.append("")
        elif ch.name == "h2": lines.append("## " + txt(ch)); lines.append("")
        elif ch.name == "h3": lines.append("### " + txt(ch)); lines.append("")
        elif ch.name == "table":
            for tr in ch.find_all("tr"):
                cells = [txt(c) for c in tr.find_all(["th", "td"])]
                lines.append("| " + " | ".join(cells) + " |")
                if tr.find("th", scope="col") and tr.parent.name == "thead":
                    lines.append("|" + "---|" * len(cells))
            lines.append("")
        elif ch.name == "li": lines.append("- " + txt(ch))
        elif ch.name in ("ul", "ol"): walk(ch, lines); lines.append("")
        elif "rappel" in cl:
            lab = ch.find("span"); items = [txt(b) for b in ch.find_all("b")]
            lines.append("")
            lines.append("_" + (txt(lab) if lab else "Et comme chacun") + "_ : " + " · ".join(items)); lines.append("")
        elif ch.name == "p": lines.append(txt(ch)); lines.append("")
        elif "bande" in cl: lines.append("### " + txt(ch)); lines.append("")
        elif "lg" in cl or "dom" in cl:
            v = ch.find(class_="v"); t = ch.find(class_="t") or ch.find(class_="p")
            lines.append("- **" + (txt(v) if v else "") + "** : " + (txt(t) if t else ""))
            for li in ch.select("ul.suite li"):
                lines.append("  - " + txt(li))

        elif ch.name == "a" and "m-bouton" in cl: lines.append("[" + txt(ch) + "](" + ch.get("href", "") + ")"); lines.append("")
        elif ch.name == "div" or ch.name in ("section", "article", "header", "details", "summary", "span", "b"):
            if ch.find(["div", "p", "section", "ul", "h1", "h2", "table", "li"]): walk(ch, lines)
            else:
                t = txt(ch)
                if t: lines.append(t); lines.append("")
        else:
            t = txt(ch)
            if t: lines.append(t); lines.append("")
for f in sorted(os.listdir(src)):
    if not f.endswith(".html"): continue
    soup = BeautifulSoup(open(os.path.join(src, f), encoding="utf-8"), "lxml")
    title = soup.title.get_text() if soup.title else f
    desc = (soup.find("meta", attrs={"name": "description"}) or {}).get("content", "")
    lines = ["<!-- source: https://france-resolution.fr/" + f.replace("__", "/") + " -->", "", f"# {title}", "", f"_Meta description_: {desc}", ""]
    body = soup.body or soup
    walk(body, lines)
    md = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)) + "\n"
    open(os.path.join(out, f[:-5] + ".md"), "w", encoding="utf-8").write(md)
    print(f, len(md))
