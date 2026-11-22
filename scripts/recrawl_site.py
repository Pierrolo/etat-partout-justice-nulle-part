#!/usr/bin/env python3
"""Full re-crawl of france-resolution.fr into a NEW raw directory (never touches data/raw/).

Adapted from crawl_site.py (BFS over the HTML pages, collecting every internal
href/src), extended to:
  * download every referenced non-HTML asset (liasses, workbooks, fiches PDF,
    manifeste PDF, lettres, images, css, JSON endpoints used by ecrire.html);
  * find assets also in CSS url(...) and in quoted path strings inside inline JS;
  * probe every URL known from the October snapshot (data/raw/site_html/_assets.json
    and the October page list) so that "removed" can be told from "no longer linked
    but still online";
  * record a manifest (_crawl_manifest.json: URL, status, content-type, size, sha256,
    ETag, Last-Modified, destination) and write SHA256SUMS (same format as data/raw).

Layout mirrors data/raw/: site_html/, amendements/, donnees/, fiches_pdf/, img/,
lettres/, elus/, site_json/, manifeste.pdf; paths that have no October equivalent
(graphiques/, illustrations/, actualites.js) keep their site path.

Downloads are untrusted: bytes are written to disk, never parsed with anything but
regex / hashlib, never executed.
Usage: python3 -I scripts/recrawl_site.py <outdir> [<october_raw_dir>]"""
import sys, re, os, urllib.request, urllib.parse, urllib.error, json, hashlib, time

BASE = "https://france-resolution.fr/"
out = sys.argv[1]
oct_raw = sys.argv[2] if len(sys.argv) > 2 else "data/raw"
UA = {"User-Agent": "Mozilla/5.0 (research crawler)"}
os.makedirs(out, exist_ok=True)

manifest = {}   # url-path -> record


def fetch(path):
    url = urllib.parse.urljoin(BASE, path)
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, dict(r.headers), r.read(), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), b"", url
    except Exception as e:  # network error
        return 0, {"error": str(e)}, b"", url


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def fetch_noredirect(path):
    """Like fetch() but does not follow redirects: returns the raw status and Location."""
    url = urllib.parse.urljoin(BASE, path)
    req = urllib.request.Request(url, headers=UA)
    try:
        with _opener.open(req, timeout=120) as r:
            return r.status, dict(r.headers), r.read(), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read() if e.code < 300 else b"", url
    except Exception as e:
        return 0, {"error": str(e)}, b"", url


def dest_for(rel):
    """Map a site-relative URL path to the local layout used in data/raw/."""
    rel = urllib.parse.unquote(rel)
    if rel.endswith(".html"):
        return os.path.join("site_html", rel.replace("/", "__"))
    if rel == "fiche.css":
        return os.path.join("site_html", "fiche.css")
    if rel.startswith("fiches/") and rel.endswith(".pdf"):
        return os.path.join("fiches_pdf", rel[len("fiches/"):])
    if rel == "api/etat":
        return os.path.join("site_json", "api_etat.json")
    if rel == "donnees/compteur.json":
        return os.path.join("site_json", "compteur.json")
    if rel == "lettres/textes.json":
        return os.path.join("site_json", "lettres_textes.json")
    if rel.startswith("donnees/elus/"):
        return os.path.join("elus", rel[len("donnees/elus/"):])
    if rel.split("/")[0] in ("amendements", "donnees", "img", "lettres") or rel == "manifeste.pdf":
        return rel
    return rel   # graphiques/, illustrations/, actualites.js ... keep the site path


def save(rel, status, hdrs, body, final):
    rec = {
        "url": urllib.parse.urljoin(BASE, rel),
        "final_url": final,
        "status": status,
        "content_type": hdrs.get("content-type") or hdrs.get("Content-Type", ""),
        "last_modified": hdrs.get("last-modified") or hdrs.get("Last-Modified", ""),
        "etag": hdrs.get("etag") or hdrs.get("Etag") or hdrs.get("ETag", ""),
        "size": len(body),
        "sha256": hashlib.sha256(body).hexdigest() if body else "",
        "dest": "",
    }
    if status == 200 and body:
        d = dest_for(rel)
        rec["dest"] = d.replace(os.sep, "/")
        full = os.path.join(out, d)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as fh:
            fh.write(body)
    manifest[rel] = rec
    return rec


URL_RES = [
    re.compile(r'(?:href|src|data-src|poster|action)=["\']?([^"\' >]+)'),
    re.compile(r'url\(\s*["\']?([^"\')]+)'),
    re.compile(r'fetch\(\s*["\']([^"\']+)["\']'),
    # quoted path-like strings in inline JS, with a known extension
    re.compile(r'["\']((?:[A-Za-z0-9_%.+\-]+/)*[A-Za-z0-9_%.+\- ]+\.(?:pdf|docx|xlsx|xls|json|csv|js|css|webp|png|jpg|jpeg|svg|html))["\']'),
]


B64 = re.compile(r'data:[A-Za-z0-9/+.\-]+;base64,[A-Za-z0-9+/=]+')


def refs(txt, page):
    found = set()
    txt = B64.sub("data:", txt)   # inlined fonts/images: no URL inside, and they slow the regexes
    for rx in URL_RES:
        for m in rx.finditer(txt):
            u = m.group(1).strip()
            if u.startswith(("http", "mailto:", "#", "javascript:", "data:", "tel:", "//")):
                continue
            u = u.split("#")[0].split("?")[0]
            if not u:
                continue
            u = urllib.parse.urljoin(urllib.parse.urljoin(BASE, page), u)
            if not u.startswith(BASE):
                continue
            rel = u[len(BASE):]
            # string-concatenation fragments inside inline JS (`'+il.src+'`, `${u}`...), directories
            if re.search(r'[${}()+\[\];|<>\\"\'`]', rel) or rel.endswith("/"):
                continue
            found.add(rel)
    return found


# ---------------------------------------------------------------- HTML crawl
seeds = ["index.html", "donnees.html"]
seen, queue, assets, errors = set(), list(seeds), {}, []
html_text = {}
while queue:
    p = queue.pop(0)
    if p in seen:
        continue
    seen.add(p)
    st, hd, body, final = fetch(p)
    ct = hd.get("content-type", hd.get("Content-Type", ""))
    if st != 200 or "html" not in ct:
        save(p, st, hd, body, final)
        errors.append((p, st, ct))
        print("ERR/NONHTML", p, st, ct)
        continue
    rec = save(p, st, hd, body, final)
    txt = body.decode("utf-8", "replace")
    html_text[p] = txt
    for rel in refs(txt, p):
        if rel.endswith(".html") or rel == "":
            queue.append(rel)
        else:
            assets.setdefault(rel, p)
    print("OK", p, len(body), rec["sha256"][:12])

# ------------------------------------------------- assets (+ nested refs in css/js)
extra_text = {}
pending = sorted(assets)
done = set()
while pending:
    rel = pending.pop(0)
    if rel in done:
        continue
    done.add(rel)
    st, hd, body, final = fetch(rel)
    rec = save(rel, st, hd, body, final)
    print("ASSET", rel, st, rec["size"], rec["sha256"][:12])
    if st == 200 and rel.endswith((".js", ".css")):
        txt = body.decode("utf-8", "replace")
        extra_text[rel] = txt
        for r2 in refs(txt, rel):
            if r2.endswith(".html"):
                if r2 not in seen:
                    queue.append(r2)
            elif r2 not in done:
                assets.setdefault(r2, rel)
                pending.append(r2)
    time.sleep(0.05)

# pages discovered late (from css/js)
while queue:
    p = queue.pop(0)
    if p in seen:
        continue
    seen.add(p)
    st, hd, body, final = fetch(p)
    save(p, st, hd, body, final)

# ------------------------------------------------------- endpoints used by ecrire.html
for rel in ["api/etat", "donnees/compteur.json", "lettres/textes.json",
            "donnees/elus/sources.json", "donnees/elus/etranger.json"]:
    if rel not in manifest:
        st, hd, body, final = fetch(rel)
        rec = save(rel, st, hd, body, final)
        print("ENDPOINT", rel, st, rec["size"])

# ------------------------------------------------------- probes: everything known in October
probe = set()
try:
    probe.update(json.load(open(os.path.join(oct_raw, "site_html", "_assets.json"))))
except Exception as e:
    print("no October _assets.json:", e)
for f in os.listdir(os.path.join(oct_raw, "site_html")):
    if f.endswith(".html"):
        probe.add(f.replace("__", "/"))
probe.update(["robots.txt", "sitemap.xml", "favicon.ico", "404.html", "graphiques.html",
              "propositions.html", "lettres/textes.json"])
for rel in sorted(probe):
    if rel in manifest:
        continue
    st, hd, body, final = fetch_noredirect(rel)
    if 300 <= st < 400:
        loc = hd.get("location") or hd.get("Location", "")
        rec = {"url": urllib.parse.urljoin(BASE, rel), "status": st, "redirect_to": urllib.parse.urljoin(BASE + rel, loc),
               "content_type": "", "size": 0, "sha256": "", "dest": "", "probe": True}
        manifest[rel] = rec
    else:
        rec = save(rel, st, hd, body, final)
        rec["probe"] = True
        if rec["dest"]:
            src = os.path.join(out, rec["dest"])
            newd = os.path.join("_unlinked_but_online", rec["dest"])
            os.makedirs(os.path.dirname(os.path.join(out, newd)), exist_ok=True)
            os.replace(src, os.path.join(out, newd))
            rec["dest"] = newd.replace(os.sep, "/")
            rec["unlinked_but_online"] = True
    print("PROBE", rel, st, rec.get("redirect_to", ""), rec["size"])

for _rel, _rec in manifest.items():
    if _rel in assets:
        _rec["referenced_from"] = assets[_rel]

# dead references (404/405 found while following links or JS strings) are kept apart from the file list
dead = {k: manifest.pop(k) for k in list(manifest) if manifest[k]["status"] in (404, 405, 0) and not manifest[k].get("probe")}

# --------------------------------------------------------------- _assets.json + manifest
json.dump(sorted(a for a in assets), open(os.path.join(out, "site_html", "_assets.json"), "w"), indent=1)
json.dump({"crawled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "base": BASE, "pages": sorted(seen), "assets_found_by_links": sorted(assets),
           "dead_references": dead, "files": manifest}, open(os.path.join(out, "_crawl_manifest.json"), "w"),
          indent=1, ensure_ascii=False, sort_keys=True)

# --------------------------------------------------------------- SHA256SUMS (same format as data/raw)
lines = []
for root, _, files in os.walk(out):
    for f in files:
        if f == "SHA256SUMS":
            continue
        full = os.path.join(root, f)
        rel = "./" + os.path.relpath(full, out).replace(os.sep, "/")
        lines.append((rel, hashlib.sha256(open(full, "rb").read()).hexdigest()))
lines.sort()
with open(os.path.join(out, "SHA256SUMS"), "w") as fh:
    for rel, h in lines:
        fh.write(f"{h}  {rel}\n")
print(len(seen), "pages;", len(assets), "assets;", len(lines), "files hashed")
