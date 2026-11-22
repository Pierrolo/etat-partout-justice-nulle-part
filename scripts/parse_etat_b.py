#!/usr/bin/env python3
"""Extract the 'état B' credit tables (PLF 2027 part 2 amendments 1-22) from the
Résolution amendment PDF into CSV.
Usage: python3 -I parse_etat_b.py <Liasse_PLF_P2.pdf> <out.csv>"""
import sys, re, subprocess, csv
pdf, out = sys.argv[1], sys.argv[2]
txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
blocks = re.split(r"\n\s*AMENDEMENT N° (\d+) \[", txt)
rows = []
def num(s):
    s = s.replace("−", "-").replace(" ", " ").replace("\xa0", " ")
    return int(re.sub(r"[^\d-]", "", s)) if re.search(r"\d", s) else None
for i in range(1, len(blocks), 2):
    n = int(blocks[i]); body = blocks[i + 1]
    if n > 22: continue
    m = re.search(r"mission\s+«\s*(.*?)\s*»\]", body, re.S)
    mission = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
    m2 = re.search(r"Modifier ainsi les crédits de la mission « (.*?) » :", body, re.S)
    if m2: mission = re.sub(r"\s+", " ", m2.group(1))
    sect = body.split("Programmes", 1)[1].split("TOTAUX", 1)
    lines = sect[0].split("\n")[1:]
    cur = None
    for ln in lines:
        if not ln.strip(): continue
        parts = re.split(r"\s{2,}", ln.strip())
        nums = [p for p in parts if re.fullmatch(r"[−\-]?\d[\d ]*", p)]
        if len(nums) >= 4:
            name = " ".join(p for p in parts if p not in nums)
            cur = {"amendment": n, "mission": mission, "programme": name,
                   "AE_plus": num(nums[0]), "AE_moins": num(nums[1]), "CP_plus": num(nums[2]), "CP_moins": num(nums[3])}
            rows.append(cur)
        elif cur is not None:
            cur["programme"] += " " + ln.strip()
    t = sect[1].split("SOLDE")[0]
    tn = re.findall(r"\d[\d ]*\d|\d", re.sub(r"\s{2,}", "|", t.strip()).replace("|", "  "))
    tparts = [p for p in re.split(r"\s{2,}", t.strip()) if re.fullmatch(r"[−\-]?\d[\d ]*", p)]
    if len(tparts) >= 4:
        rows.append({"amendment": n, "mission": mission, "programme": "TOTAL", "AE_plus": num(tparts[0]), "AE_moins": num(tparts[1]), "CP_plus": num(tparts[2]), "CP_moins": num(tparts[3])})
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["amendment", "mission", "programme", "AE_plus", "AE_moins", "CP_plus", "CP_moins"])
    w.writeheader(); w.writerows(rows)
print(len(rows), "rows")
