#!/usr/bin/env python3
"""Text conversion of the amendment liasses (PDF -> pdftotext -layout) and of the
letter templates (docx -> paragraphs) into the markdown files that sit next to the
html_to_md.py output, in exactly the format of research/pages/amendements__*.md and
research/pages/lettres__*.md (verified byte-for-byte against the October files).
Also writes, for each liasse, a docx-derived plain text (one paragraph per line) used by
the diff tooling: <out_dir>/amendements__<name>.docx.txt.

Usage: python3 -I scripts/liasses_lettres_to_md.py <raw_dir> <out_dir> "<edition label>"
  e.g. python3 -I scripts/liasses_lettres_to_md.py data/raw-2026-11-21 research/pages-2026-11-21 "novembre 2026"
Nothing downloaded is executed: pdftotext only reads the PDFs, python-docx only parses XML."""
import sys, os, subprocess
import docx

raw, out, label = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
for name in ("Liasse_PLF_P1", "Liasse_PLF_P2", "Liasse_PLFSS"):
    pdf = os.path.join(raw, "amendements", name + ".pdf")
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True).stdout
    head = (f"<!-- source: https://france-resolution.fr/amendements/{name}.pdf "
            f"(text extracted with pdftotext -layout; tables preserved) -->\n\n"
            f"# Amendements Résolution — {name} ({label})\n\n")
    with open(os.path.join(out, f"amendements__{name}.md"), "w", encoding="utf-8") as fh:
        fh.write(head + txt)
    D = docx.Document(os.path.join(raw, "amendements", name + ".docx"))
    paras = [p.text for p in D.paragraphs]
    with open(os.path.join(out, f"amendements__{name}.docx.txt"), "w", encoding="utf-8") as fh:
        fh.write(f"<!-- source: https://france-resolution.fr/amendements/{name}.docx "
                 f"(python-docx paragraphs, one per line; Heading 2 = '## ') -->\n")
        W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        for p in D.paragraphs:
            ps = p._p.pPr.find(W + "pStyle") if p._p.pPr is not None else None
            h = ps is not None and ps.get(W + "val", "").startswith("Heading")
            fh.write(("## " if h else "") + p.text + "\n")
        for ti, t in enumerate(D.tables):
            fh.write(f"\n[TABLE {ti + 1}]\n")
            for r in t.rows:
                fh.write(" | ".join(c.text.replace("\n", " ") for c in r.cells) + "\n")
    print(name, len(txt), "chars pdf;", len(paras), "docx paragraphs;", len(D.tables), "tables")

ldir = os.path.join(raw, "lettres")
for f in sorted(os.listdir(ldir)):
    if not f.endswith(".docx"):
        continue
    D = docx.Document(os.path.join(ldir, f))
    paras = [p.text for p in D.paragraphs if p.text.strip()]
    with open(os.path.join(out, "lettres__" + f[:-5] + ".md"), "w", encoding="utf-8") as fh:
        fh.write(f"<!-- source: https://france-resolution.fr/lettres/{f} -->\n\n" + "\n\n".join(paras) + "\n")
    print(f, len(paras), "paragraphs")
