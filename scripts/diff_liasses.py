#!/usr/bin/env python3
"""Word-level diff of the amendment liasses between two snapshots.
Input: the JSON files written by scripts/liasses_parse.py for the old and new snapshot.
Output (under <out_dir>): one markdown file per liasse with, for EVERY amendment, old/new
number, title, status, PDF page, and (if changed) the word-level diff of the dispositif and
of the exposé sommaire, in wdiff notation:  [-deleted-]  {+inserted+}  ('¶' = paragraph break).
Also writes amendments_index.json (machine-readable status table).
Usage: python3 -I scripts/diff_liasses.py <old.json> <new.json> <out_dir>"""
import sys, json, difflib, re, os

CTX = 12          # words of unchanged context kept around each hunk
MERGE = 2 * CTX   # unchanged runs shorter than this merge neighbouring hunks


def flat(blocks, tables=True):
    out = []
    for b in blocks:
        if isinstance(b, str):
            out.append(b)
        elif tables:
            for r in b["table"]:
                out.append(" | ".join(r))
        else:
            out.append("[tableau des crédits : voir etat_b.md]")
    return out


def tables_of(blocks):
    return [b["table"] for b in blocks if isinstance(b, dict)]


def totaux(blocks):
    for b in blocks:
        if isinstance(b, dict):
            for r in b["table"]:
                if r[0] == "TOTAUX":
                    return f"AE− {r[2]} €, CP− {r[4]} €"
    return "—"


def is_etat_b(a):
    return a["title"].startswith("Retirer les crédits que la présente loi interrompt, mission")


def tokens(paras):
    t = []
    for i, p in enumerate(paras):
        if i:
            t.append("¶")
        t.extend(p.split())
    return t


def wdiff(wa, wb, ctx=CTX):
    sm = difflib.SequenceMatcher(None, wa, wb, autojunk=False)
    ops = sm.get_opcodes()
    # group
    out, n = [], len(ops)
    for k, (t, i1, i2, j1, j2) in enumerate(ops):
        if t == "equal":
            seg = wa[i1:i2]
            first, last = k == 0, k == n - 1
            if len(seg) <= (ctx if (first or last) else MERGE):
                out.append(" ".join(seg))
            else:
                head = " ".join(seg[:ctx]) if not first else ""
                tail = " ".join(seg[-ctx:]) if not last else ""
                out.append((head + " " if head else "") + "[…]" + (" " + tail if tail else ""))
        else:
            parts = []
            if i2 > i1:
                parts.append("[-" + " ".join(wa[i1:i2]) + "-]")
            if j2 > j1:
                parts.append("{+" + " ".join(wb[j1:j2]) + "+}")
            out.append("".join(parts) if len(parts) == 1 else parts[0] + parts[1])
    n_changed = sum(1 for o in ops if o[0] != "equal")
    n_words = sum(max(i2 - i1, j2 - j1) for t, i1, i2, j1, j2 in ops if t != "equal")
    return " ".join(x for x in out if x), n_changed, n_words


def esc(s):
    return s


def main(old_json, new_json, out_dir):
    o = json.load(open(old_json))
    n = json.load(open(new_json))
    os.makedirs(out_dir, exist_ok=True)
    index = {}
    for L in o:
        oa, na = o[L]["amendments"], n[L]["amendments"]
        lines = [f"# {L} — amendment-by-amendment diff (October snapshot → 2026-11-21)", "",
                 f"Old: {len(oa)} amendments, {o[L]['n_pdf_pages']} PDF pages. New: {len(na)} amendments, {n[L]['n_pdf_pages']} PDF pages.",
                 "Notation: `[-old-]` deleted, `{+new+}` inserted, `[…]` unchanged text elided, `¶` paragraph break. "
                 "Typographic non-breaking spaces are normalised to plain spaces. 'p.' = physical page of the NEW PDF.", ""]
        index[L] = {}
        for k in sorted(set(oa) | set(na), key=int):
            a, b = oa.get(k), na.get(k)
            if a and not b:
                status = "REMOVED"
            elif b and not a:
                status = "NEW"
            else:
                tb = not (is_etat_b(a) or is_etat_b(b))
                dd = wdiff(tokens(flat(a["dispositif"], tb)), tokens(flat(b["dispositif"], tb)))
                ee = wdiff(tokens(flat(a["expose"])), tokens(flat(b["expose"])))
                tabs_changed = (not tb) and tables_of(a["dispositif"]) != tables_of(b["dispositif"])
                ch = dd[1] or ee[1] or tabs_changed or a["title"] != b["title"] or a["article"] != b["article"]
                status = "CHANGED" if ch else "UNCHANGED"
            rec = {"old_n": int(k) if a else None, "new_n": int(k) if b else None,
                   "title_old": a and a["title"], "title_new": b and b["title"],
                   "article_old": a and a["article"], "article_new": b and b["article"],
                   "pdf_pages_old": a and a["pages"], "pdf_pages_new": b and b["pages"], "status": status}
            hdr = f"## n° {k} — {(b or a)['title']}"
            lines += [hdr, ""]
            pg = ""
            if b and b["pages"]:
                pg = f"PDF p. {b['pages'][0]}" + (f"–{b['pages'][1]}" if b["pages"][1] != b["pages"][0] else "")
            lines.append(f"- **Status**: {status}; old n° {rec['old_n']} → new n° {rec['new_n']}; article visé: {(b or a)['article']}; new PDF page: {pg or '—'}"
                         + (f" (old: p. {a['pages'][0]}–{a['pages'][1]})" if a and a['pages'] else ""))
            if status == "CHANGED":
                if a["title"] != b["title"]:
                    lines.append(f"- **Title**: `[-{a['title']}-]` → `{{+{b['title']}+}}`")
                if a["article"] != b["article"]:
                    lines.append(f"- **Article visé**: {a['article']} → {b['article']}")
                if tabs_changed:
                    lines.append(f"- **Dispositif, tableau des crédits (état B)**: CHANGED — TOTAUX old: {totaux(a['dispositif'])} → new: {totaux(b['dispositif'])} ; lignes de programme: voir etat_b.md")
                    rec["etat_b_totaux_old"], rec["etat_b_totaux_new"] = totaux(a["dispositif"]), totaux(b["dispositif"])
                if dd[1]:
                    lines += [f"- **Dispositif (texte hors tableau)**: {dd[1]} hunks, ~{dd[2]} words changed", "", dd[0], ""]
                    rec["dispositif_words_changed"] = dd[2]
                elif not tabs_changed:
                    lines.append("- **Dispositif**: unchanged")
                else:
                    lines.append("- **Dispositif (texte hors tableau)**: unchanged")
                if ee[1]:
                    lines += [f"- **Exposé**: {ee[1]} hunks, ~{ee[2]} words changed", "", ee[0], ""]
                    rec["expose_words_changed"] = ee[2]
                else:
                    lines.append("- **Exposé**: unchanged")
            elif status in ("NEW", "REMOVED"):
                x = b or a
                lines += [f"- **Title**: {x['title']}", "", "**Dispositif (full)**", ""] + flat(x["dispositif"]) + ["", "**Exposé (full)**", ""] + flat(x["expose"])
            lines.append("")
            index[L][k] = rec
        with open(os.path.join(out_dir, f"{L}.md"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
        cnt = {s: sum(1 for r in index[L].values() if r["status"] == s) for s in ("UNCHANGED", "CHANGED", "NEW", "REMOVED")}
        print(L, cnt)
    json.dump(index, open(os.path.join(out_dir, "amendments_index.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(*sys.argv[1:4])
