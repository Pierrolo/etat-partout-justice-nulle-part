#!/usr/bin/env python3
"""Convert crawled HTML pages (data/raw*/site_html/*.html) into readable markdown
files. Adapted from html_to_md.py for the 2026-11-21 snapshot; the output is byte-identical to
research/pages/ on the October HTML (regression-checked) except where the October converter
silently dropped text:
  * a secondary paragraph <p class=s> inside a "lg"/"dom" block (e.g. the new sentence
    « La refonte fiscale se fait sans augmenter les impôts… » of the fiches contribuable /
    entreprise / entreprise-ou-association-subventionnee) is now appended to the bullet text;
  * the fiche download button is written as plain text, as in October, although the new HTML
    nests it differently (a « Les propositions » note now follows it);
  * propositions.html is a JavaScript application whose text lives in inline data
    (const D = {...}, RENVOIS, AMENDEMENTS, MOTS): its cards are dumped as markdown after
    the page text (regex extraction only, the script is never executed).
Usage: python3 -I html_to_md_v2.py <html_dir> <out_dir>"""
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
            extra = " ".join(txt(p) for p in ch.find_all("p", class_="s"))
            lines.append("- **" + (txt(v) if v else "") + "** : " + ((txt(t) if t else "") + (" " + extra if extra else "")).strip() if extra else "- **" + (txt(v) if v else "") + "** : " + (txt(t) if t else ""))
            for li in ch.select("ul.suite li"):
                lines.append("  - " + txt(li))

        elif ch.name == "a" and "m-bouton" in cl and txt(ch).startswith("Télécharger cette fiche"): lines.append(txt(ch)); lines.append("")  # October format: plain text (the button was nested in a block without block children)
        elif ch.name == "a" and "m-bouton" in cl: lines.append("[" + txt(ch) + "](" + ch.get("href", "") + ")"); lines.append("")
        elif ch.name == "div" or ch.name in ("section", "article", "header", "details", "summary", "span", "b"):
            if ch.find(["div", "p", "section", "ul", "h1", "h2", "table", "li"]): walk(ch, lines)
            else:
                t = txt(ch)
                if t: lines.append(t); lines.append("")
        else:
            t = txt(ch)
            if t: lines.append(t); lines.append("")

def _js_str(m):
    return m.encode().decode("unicode_escape").encode("latin-1", "ignore").decode("utf-8", "ignore") if False else m.replace("\\u00a0", "\u00a0").replace('\\"', '"').replace("<br>", " ")
def propositions_cards(html):
    """Text of the cards of propositions.html (inline JS data), by regex; nothing is executed."""
    html = re.sub(r"data:image/[a-z]+;base64,[A-Za-z0-9+/=]+", "data:IMG", html)
    out = ["", "## Cartes de propositions.html (données JavaScript `const D`)", ""]
    i = html.find("const D={")
    j = html.find("let pile", i)
    block = html[i:j] if i >= 0 and j > i else ""
    # grids: id:{q:"...",type:"grille",cartes:[[key,title,"a|b"],...]}
    for m in re.finditer(r'\n ?(\w+):\{q:"(.*?)",type:"grille",\s*cartes:\[(.*?)\]\}', block, re.S):
        out.append(f"### {m.group(1)} — {_js_str(m.group(2))}")
        for c in re.finditer(r'\["(\w+)","(.*?)","(.*?)"\]', m.group(3), re.S):
            out.append(f"- **{c.group(2)}** ({c.group(1)}) : {_js_str(c.group(3)).replace('|', ' — ')}")
        out.append("")
    # cards: id:{t:"..",c:"..",a:"..",d:"..",d2:"..",d3:"..",m:"..",f:"..",...}
    for m in re.finditer(r'\n ?(\w+):\{t:"(.*?)",c:"(.*?)",\s*a:"(.*?)",\s*d:"(.*?)",(?:\s*d2:"(.*?)",)?(?:\s*d3:"(.*?)",)?\s*m:"(.*?)",f:"(.*?)"', block, re.S):
        k, t, c, a, d, d2, d3, mm, ff = m.groups()
        out.append(f"### {k} — {_js_str(t)} ({_js_str(c)})")
        out.append("")
        for lab, v in (("Constat", a), ("Dispositif", d), ("Suite", d2), ("Précision", d3), ("Mesures", mm), ("Folios", ff)):
            if v:
                out.append(f"- {lab} : {_js_str(v)}")
        out.append("")
    return out
for f in sorted(os.listdir(src)):
    if not f.endswith(".html"): continue
    soup = BeautifulSoup(open(os.path.join(src, f), encoding="utf-8"), "lxml")
    title = soup.title.get_text() if soup.title else f
    desc = (soup.find("meta", attrs={"name": "description"}) or {}).get("content", "")
    lines = ["<!-- source: https://france-resolution.fr/" + f.replace("__", "/") + " -->", "", f"# {title}", "", f"_Meta description_: {desc}", ""]
    body = soup.body or soup
    walk(body, lines)
    if f == "propositions.html":
        lines += propositions_cards(open(os.path.join(src, f), encoding="utf-8").read())
    md = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)) + "\n"
    open(os.path.join(out, f[:-5] + ".md"), "w", encoding="utf-8").write(md)
    print(f, len(md))
