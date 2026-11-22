#!/usr/bin/env python3
"""File-level diff of two raw snapshots (SHA256SUMS + the crawl manifest of the new one).
Usage: python3 -I scripts/diff_files.py <old_raw_dir> <new_raw_dir> <out.md>"""
import sys, os, json, collections

old_d, new_d, out = sys.argv[1:4]


def load(d):
    r = {}
    for l in open(os.path.join(d, "SHA256SUMS"), encoding="utf-8"):
        h, p = l.rstrip("\n").split("  ", 1)
        p = p[2:]
        r[p] = (h, os.path.getsize(os.path.join(d, p)))
    return r


o, n = load(old_d), load(new_d)
man = json.load(open(os.path.join(new_d, "_crawl_manifest.json"), encoding="utf-8"))
changed = sorted(p for p in n if p in o and n[p][0] != o[p][0])
same = sorted(p for p in n if p in o and n[p][0] == o[p][0])
removed = sorted(p for p in o if p not in n)
added = sorted(p for p in n if p not in o)
byhash = collections.defaultdict(list)
for p in n:
    byhash[n[p][0]].append(p)
L = ["# File-level diff of the raw snapshots", "",
     f"Old: `{old_d}` ({len(o)} files hashed in SHA256SUMS). New: `{new_d}` ({len(n)} files, crawl at {man['crawled_at']}).", "",
     f"- unchanged (same path, same sha256): **{len(same)}**",
     f"- changed (same path, different sha256): **{len(changed)}**",
     f"- removed (path no longer present): **{len(removed)}**",
     f"- added: **{len(added)}** (includes `_crawl_manifest.json`, `_unlinked_but_online/site_html/404.html` = the site's own 404 page served with status 200, and the re-written `site_html/_assets.json`)", "",
     "## Changed files", "", "| path | old bytes | new bytes | old sha256 | new sha256 |", "|---|---:|---:|---|---|"]
for p in changed:
    L.append(f"| `{p}` | {o[p][1]} | {n[p][1]} | `{o[p][0]}` | `{n[p][0]}` |")
L += ["", "## Removed files (October path no longer in the new tree)", "",
      "The October workbook URLs now answer **HTTP 308** to the new names (see « Redirects »); the bytes are identical, or changed, as shown.", "",
      "| old path | old bytes | old sha256 | now served as | same bytes? |", "|---|---:|---|---|---|"]
for p in removed:
    same_as = [q for q in byhash.get(o[p][0], []) if q != p]
    rd = next((v for k, v in man["files"].items() if v.get("dest", "").endswith(os.path.basename(p)) is False and False), None)
    tgt = ""
    for k, v in man["files"].items():
        if v.get("redirect_to") and os.path.basename(p) in __import__("urllib.parse", fromlist=["x"]).unquote(k):
            tgt = __import__("urllib.parse", fromlist=["x"]).unquote(v["redirect_to"]).replace("https://france-resolution.fr/", "")
    now = ('`donnees/' + os.path.basename(same_as[0]) + '`') if same_as else (('`' + tgt + '`') if tgt else '—')
    if "ETP et agences" in p:
        now = "`donnees.html#agences` (308); content split into `donnees/Agences publiques.xlsx` + `donnees/Emplois publics.xlsx`"
    L.append(f"| `{p}` | {o[p][1]} | `{o[p][0]}` | {now} | {'yes (renamed only)' if same_as else 'no'} |")
L += ["", "## Redirects found when probing the October URLs", "", "| October URL | status | location |", "|---|---:|---|"]
for k, v in sorted(man["files"].items()):
    if v.get("redirect_to"):
        L.append(f"| `{k}` | {v['status']} | `{v['redirect_to']}` |")
L += ["", "## Added files", ""]
groups = collections.defaultdict(list)
for p in added:
    groups[p.split("/")[0] if "/" in p else "(root)"].append(p)
for g in sorted(groups):
    L += [f"### {g} ({len(groups[g])} files)", "", "| path | bytes | sha256 |", "|---|---:|---|"]
    for p in groups[g]:
        L.append(f"| `{p}` | {n[p][1]} | `{n[p][0]}` |")
    L.append("")
L += ["## Unchanged files", "", ", ".join(f"`{p}`" for p in same), "",
      "## Dead references (found in HTML/JS, answer 404/405; not files of the site)", ""]
for k, v in sorted(man.get("dead_references", {}).items()):
    L.append(f"- `{k}` → HTTP {v['status']} (referenced from `{v.get('referenced_from', '?')}`)")
L += ["", "## HTTP Last-Modified", "",
      "Not a reliable change signal on this host: most files carry the request time, and `donnees/Niches fiscales.xls` (byte-identical to October) carries 2026-11-21 18:30:03 GMT. "
      "Stable stamps seen on 2026-11-21 (18:28-18:30 UTC): " +
      ", ".join(f"`{k}` ({v['last_modified']})" for k, v in sorted(man['files'].items()) if v.get('last_modified', '').startswith(('Sat, 21 Nov 2026 18:28', 'Sat, 21 Nov 2026 18:29', 'Sat, 21 Nov 2026 18:30'))) +
      ". The liasse PDFs' own metadata gives their generation time: P1 and PLFSS 2026-11-17 18:43 UTC, P2 2026-11-18 19:14 UTC (October: 2026-10-19 09:44-09:53 UTC).", ""]
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print("written", out, len(L), "lines")
