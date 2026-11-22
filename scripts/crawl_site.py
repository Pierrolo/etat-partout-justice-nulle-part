#!/usr/bin/env python3
"""BFS crawl of france-resolution.fr: saves raw HTML under data/raw/site_html and
lists every internal link / asset referenced (href/src/fetch URLs).
Usage: python3 -I crawl_site.py <outdir>"""
import sys, re, os, urllib.request, urllib.parse, json
BASE = "https://france-resolution.fr/"
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
seen, queue, assets = set(), ["index.html", "donnees.html"], {}
def fetch(path):
    url = urllib.parse.urljoin(BASE, path)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (research crawler)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.headers.get("content-type", ""), r.read()
while queue:
    p = queue.pop(0)
    if p in seen: continue
    seen.add(p)
    try:
        st, ct, body = fetch(p)
    except Exception as e:
        print("ERR", p, e); continue
    if st != 200 or "html" not in ct:
        assets[p] = ct; continue
    dest = os.path.join(out, p.replace("/", "__"))
    open(dest, "wb").write(body)
    txt = body.decode("utf-8", "replace")
    for m in re.finditer(r'(?:href|src)=["\']?([^"\' >]+)', txt):
        u = m.group(1)
        if u.startswith(("http", "mailto:", "#", "javascript:", "data:")): continue
        u = u.split("#")[0].split("?")[0]
        if not u: continue
        u = urllib.parse.urljoin(urllib.parse.urljoin(BASE, p), u)
        if not u.startswith(BASE): continue
        rel = u[len(BASE):]
        if rel.endswith(".html"):
            queue.append(rel)
        else:
            assets.setdefault(rel, "")
    print("OK", p, len(body))
json.dump(sorted(assets), open(os.path.join(out, "_assets.json"), "w"), indent=1)
print(len(seen), "pages;", len(assets), "assets")
