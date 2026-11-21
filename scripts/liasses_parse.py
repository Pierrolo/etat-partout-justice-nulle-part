#!/usr/bin/env python3
"""Parse the three amendment liasses (docx for text structure, pdftotext for PDF pages)
into a JSON of amendments:
  {liasse: {n: {n, title, article, header, dispositif:[blocks], expose:[blocks], pages:[first,last]}}}
A "block" is a paragraph (str) or {"table": [[cell,...],...]} (état B credit tables etc.).
No-break / thin spaces are normalised to plain spaces so that words diff cleanly.
Usage: python3 -I scripts/liasses_parse.py <raw_dir> <out.json>"""
import sys, re, json, subprocess, os
import docx

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NAMES = ("Liasse_PLF_P1", "Liasse_PLF_P2", "Liasse_PLFSS")


def norm(s):
    s = s.replace(" ", " ").replace(" ", " ").replace(" ", " ").replace("​", "")
    return re.sub(r"[ \t]+", " ", s).strip()


def blocks_of(D):
    """Body elements in document order: ('p', style, text) / ('t', rows)."""
    out = []
    for el in D.element.body.iterchildren():
        if el.tag == W + "p":
            ps = el.find(W + "pPr/" + W + "pStyle")
            style = ps.get(W + "val") if ps is not None else None
            text = "".join(t.text or "" for t in el.iter(W + "t"))
            out.append(("p", style, norm(text)))
        elif el.tag == W + "tbl":
            rows = []
            for tr in el.iter(W + "tr"):
                cells = []
                for tc in tr.iter(W + "tc"):
                    cells.append(norm(" ".join("".join(t.text or "" for t in p.iter(W + "t")) for p in tc.iter(W + "p"))))
                rows.append(cells)
            out.append(("t", rows))
    return out


def pdf_pages(pdf):
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True).stdout
    return txt.split("\f")[:-1] if txt.endswith("\f") else txt.split("\f")


def parse(raw):
    res = {}
    for name in NAMES:
        D = docx.Document(os.path.join(raw, "amendements", name + ".docx"))
        bl = blocks_of(D)
        pages = pdf_pages(os.path.join(raw, "amendements", name + ".pdf"))
        # PDF start page of each amendment
        start = {}
        top = {}
        for pi, pg in enumerate(pages, 1):
            for m in re.finditer(r"AMENDEMENT\s+N°\s*(\d+)\s*\[", pg):
                n = int(m.group(1))
                if n not in start:
                    start[n] = pi
                    first = next((ln for ln in pg.split("\n") if ln.strip()), "")
                    top[n] = "AMENDEMENT" in first
        am = {}
        cover = {"title": "", "intro": "", "summary_rows": []}
        cur = None
        for b in bl:
            if b[0] == "p" and b[1] and b[1].startswith("Heading"):
                m = re.match(r"Amendement n°\s*(\d+)\s*(?:\[(.*)\])?\s*$", b[2], re.S)
                if m:
                    cur = {"n": int(m.group(1)), "title": norm(m.group(2) or ""), "raw": []}
                    am[cur["n"]] = cur
                    continue
                cur = None  # a "Lot ..." heading: not part of an amendment
                continue
            if cur is None:
                if b[0] == "p" and b[2]:
                    if not cover["title"]:
                        cover["title"] = b[2]
                    elif len(cover["intro"]) < 400:
                        cover["intro"] += (" " if cover["intro"] else "") + b[2]
                elif b[0] == "t":
                    cover["summary_rows"].extend(b[1])
                continue
            cur["raw"].append(b)
        for n, a in am.items():
            raw_b = a.pop("raw")
            # split on the EXPOSÉ SOMMAIRE marker (a paragraph)
            ei = next((i for i, b in enumerate(raw_b) if b[0] == "p" and re.match(r"^EXPOS[ÉE] SOMMAIRE$", b[2], re.I)), None)
            pre = raw_b[:ei] if ei is not None else raw_b
            post = raw_b[ei + 1:] if ei is not None else []
            # header: AMENDEMENT / présenté par / ———— / ARTICLE ... / (APRÈS L'ARTICLE N, insérer ...)
            di = next((i for i, b in enumerate(pre) if b[0] == "p" and set(b[2]) <= set("—-– ") and b[2]), None)
            body = pre[di + 1:] if di is not None else pre
            hdr = []
            while body and body[0][0] == "p" and (re.match(r"^(ARTICLE|APRÈS|AVANT|TITRE|CHAPITRE)", body[0][2]) or (hdr and hdr[-1].startswith("ARTICLE ADDITIONNEL") and len(hdr) < 2)):
                hdr.append(body[0][2]); body = body[1:]
                if hdr[-1].endswith("suivant :") or (len(hdr) == 1 and not hdr[0].startswith("ARTICLE ADDITIONNEL")):
                    break
            a["article"] = " — ".join(hdr)
            conv = lambda b: b[2] if b[0] == "p" else {"table": b[1]}
            a["dispositif"] = [conv(b) for b in body]
            a["expose"] = [conv(b) for b in post]
            if n in start:
                s = start[n]
                nxt = [start[k] for k in start if k > n]
                nxt_top = [top[k] for k in start if k > n]
                if nxt:
                    k = min(k for k in start if k > n)
                    e = start[k] - 1 if top[k] else start[k]
                else:
                    e = len(pages)
                a["pages"] = [s, max(s, e)]
            else:
                a["pages"] = None
        res[name] = {"cover": cover, "n_pdf_pages": len(pages), "amendments": {str(k): v for k, v in sorted(am.items())}}
    return res


if __name__ == "__main__":
    raw, out = sys.argv[1], sys.argv[2]
    r = parse(raw)
    json.dump(r, open(out, "w"), ensure_ascii=False, indent=1)
    for k, v in r.items():
        print(k, len(v["amendments"]), "amendments;", v["n_pdf_pages"], "pdf pages;", v["cover"]["intro"][:140])
