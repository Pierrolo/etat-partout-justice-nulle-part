#!/usr/bin/env python3
"""État B (PLF 2027 part 2, amendments « Modifier ainsi les crédits de la mission ») old vs new:
mission totals (AE and CP removed), programme lines, the exposé's base figure and effect dates.
Input: JSON of scripts/liasses_parse.py for both snapshots.  Output: markdown.
Usage: python3 -I scripts/diff_etat_b.py <old.json> <new.json> <out.md>"""
import sys, json, re

o = json.load(open(sys.argv[1]))["Liasse_PLF_P2"]["amendments"]
n = json.load(open(sys.argv[2]))["Liasse_PLF_P2"]["amendments"]


def num(s):
    s = s.replace("−", "-").replace(" ", "")
    return int(s) if re.fullmatch(r"-?\d+", s) else None


def table(a):
    """(programme rows [(name, AEm, CPm, is_titre2)], total (AEm, CPm), solde)"""
    rows, tot = [], None
    for b in a["dispositif"]:
        if isinstance(b, dict):
            for r in b["table"]:
                if r[0] in ("Programmes", "SOLDE"):
                    continue
                if r[0] == "TOTAUX":
                    tot = (num(r[2]), num(r[4]))
                else:
                    rows.append((r[0], num(r[2]), num(r[4]), r[0].startswith("dont titre 2")))
    return rows, tot


def expose_facts(a):
    t = re.sub(r"\s+", " ", " ".join(x for x in a["expose"] if isinstance(x, str)))
    m = re.search(r"Il porte sur (\d+) programmes?", t)
    b = re.search(r"reçoivent ([\d ]+) euros d’autorisations d’engagement dans le texte déposé", t)
    r = re.search(r"L’amendement en retire (.*?) d’euros en autorisations d’engagement et (.*?) d’euros en crédits de paiement", t)
    e = re.findall(r"(?:La mesure prend effet|Elle prend effet)[^.]*\.", t)
    return (m and m.group(1)), (b and b.group(1).replace(" ", " ")), (r and (r.group(1), r.group(2))), e


def mission(a):
    m = re.search(r"mission « (.*?) »", a["title"])
    return m.group(1) if m else a["title"]


def md(x):
    return f"{x:,}".replace(",", " ") if x is not None else "—"


ids = sorted(k for k in set(o) | set(n) if k in n and n[k]["title"].startswith("Retirer les crédits") or k in o and o[k]["title"].startswith("Retirer les crédits"))
ids = sorted(set(int(i) for i in ids))
L = ["# État B — crédits retirés, mission par mission (PLF 2027, 2de partie)", "",
     "Amounts in euros. AE = autorisations d'engagement, CP = crédits de paiement; « retirés » = column « AE − » / « CP − » of the TOTAUX row of each amendment. "
     "Rounding: the October programme lines of n° 4, 5 and 13 sum to the TOTAUX row ±1 €.", "",
     "## 1. Totals", ""]
to = {i: table(o[str(i)])[1] for i in ids if str(i) in o}
tn = {i: table(n[str(i)])[1] for i in ids if str(i) in n}
sao, sco = sum(v[0] for v in to.values()), sum(v[1] for v in to.values())
san, scn = sum(v[0] for v in tn.values()), sum(v[1] for v in tn.values())
L += ["| | October (22 missions, n° 1-22) | 2026-11-21 (23 missions, n° 1-22 + 40) | Δ | Δ % |", "|---|---:|---:|---:|---:|",
      f"| AE retirées | {md(sao)} | {md(san)} | {md(san - sao)} | {100 * (san - sao) / sao:+.1f} % |",
      f"| CP retirés | {md(sco)} | {md(scn)} | {md(scn - sco)} | {100 * (scn - sco) / sco:+.1f} % |", ""]
L += ["## 2. Per mission (TOTAUX row)", "",
      "| n° | mission | AE old | AE new | CP old | CP new | programmes old → new (« Il porte sur ») | base AE texte déposé (état B) old → new | « retire » (AE ; CP) in the exposé: old → new |", "|---|---|---:|---:|---:|---:|---|---|---|"]
for i in ids:
    a, b = o.get(str(i)), n.get(str(i))
    fo = expose_facts(a) if a else (None,) * 4
    fn = expose_facts(b) if b else (None,) * 4
    def f2(t):
        return "—" if not t else f"{t[0]} ; {t[1]}"
    L.append(f"| {i} | {mission(b or a)} | {md(to[i][0]) if i in to else '— (new)'} | {md(tn[i][0]) if i in tn else '—'} | {md(to[i][1]) if i in to else '—'} | {md(tn[i][1]) if i in tn else '—'} | {fo[0] or '—'} → {fn[0] or '—'} | {fo[1] or '—'} → {fn[1] or '—'} | {f2(fo[2])} → {f2(fn[2])} |")
L += ["", "## 3. Effect dates written in each exposé (verbatim)", ""]
for i in ids:
    a, b = o.get(str(i)), n.get(str(i))
    eo = " ".join(expose_facts(a)[3]) if a else "— (new amendment)"
    en = " ".join(expose_facts(b)[3])
    L.append(f"- **n° {i} {mission(b or a)}** — old: « {eo} » — new: « {en} »")
L += ["", "## 4. Programme lines (old → new)", ""]
for i in ids:
    a, b = o.get(str(i)), n.get(str(i))
    ro = table(a)[0] if a else []
    rn = table(b)[0] if b else []
    L += [f"### n° {i} — {mission(b or a)}", "", "| programme | AE old | AE new | CP old | CP new |", "|---|---:|---:|---:|---:|"]
    do = {r[0]: r for r in ro if not r[3]}
    dn = {r[0]: r for r in rn if not r[3]}
    order = [r[0] for r in rn if not r[3]] + [r[0] for r in ro if not r[3] and r[0] not in dn]
    # titre-2 sub-lines belong to the programme above them
    sub = {}
    last = None
    for r in rn:
        if r[3] and last:
            sub[last] = r
        elif not r[3]:
            last = r[0]
    for p in order:
        x, y = do.get(p), dn.get(p)
        tag = "" if x and y else (" (removed)" if x else " (new line)")
        L.append(f"| {p}{tag} | {md(x[1]) if x else '—'} | {md(y[1]) if y else '—'} | {md(x[2]) if x else '—'} | {md(y[2]) if y else '—'} |")
        if p in sub:
            L.append(f"| &nbsp;&nbsp;dont titre 2 (new) | | {md(sub[p][1])} | | {md(sub[p][2])} |")
    L.append(f"| **TOTAUX** | {md(to[i][0]) if i in to else '—'} | {md(tn[i][0]) if i in tn else '—'} | {md(to[i][1]) if i in to else '—'} | {md(tn[i][1]) if i in tn else '—'} |")
    L.append("")
    L.append("Effect dates (exposé), old: " + (" ".join(expose_facts(a)[3]) if a else "—"))
    L.append("")
    L.append("Effect dates (exposé), new: " + " ".join(expose_facts(b)[3]))
    L.append("")
open(sys.argv[3], "w", encoding="utf-8").write("\n".join(L) + "\n")
print("written", sys.argv[3])
