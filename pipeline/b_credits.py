"""credits-retires.json — the 23 « état B » amendments of PLF 2027 part 2 (nos 1 to 22 and no 40):
credits (AE, CP) removed mission by mission.

Input: data/derived-2026-11-21/etat_b_credits_retires_plf2027.csv (99 rows = 63 programme lines, 13 « dont titre 2 »
sub-lines and 23 totals, parsed from the PDF by scripts/parse_etat_b_v2.py) cross-checked against the amendment
texts: every figure of the CSV must appear in the amendment it comes from.
Amounts in the source are euros; exported in euros and in Md€ (3 decimals).

The authors rewrote every état B table between the October and the November 2026 versions (AE 43,86 → 24,26 Md€,
CP 39,91 → 21,03 Md€; 22 → 23 missions, the mission « Outre-mer » being PLF-P2 n° 40). The new exposés
date each kind of credit separately (1er janvier, 1er avril or 1er juillet 2027).
"""
from __future__ import annotations

import csv
import re

from amend import amendment, page_label, pdf_url, quote_in_amendment, quote_pages
from lib import ETAT_B_CSV, ETAT_B_CSV_REL, clean, fr, ws

# The 23 amendments, in order: n° 1 to 22 (one mission each), then n° 40 added last by the authors.
NUMBERS = list(range(1, 23)) + [40]

# Totals of the TOTAUX rows, independently summed from research/diff-2026-10-to-2026-11/etat_b.md § 3.7.1 (euros).
EXPECTED_TOTAL_AE_EUR = 24_261_621_967
EXPECTED_TOTAL_CP_EUR = 21_034_477_811
# October 2026 version (22 missions), kept to show the change.
OCTOBER_TOTAL_AE_EUR = 43_855_438_934
OCTOBER_TOTAL_CP_EUR = 39_905_020_176
OCTOBER_N_MISSIONS = 22

MONTHS = {"janvier": 1, "avril": 4, "juillet": 7}
_EFFECT = re.compile(
    r"^(?:La mesure|Elle) prend effet au 1er (janvier|avril|juillet) (2027)"
    r"(?: pour (?P<what>.+?)|(?:, [^:]*)? ?: (?P<q>.+?))\.$"
)


def _int(s):
    return int(s)


def _grouped(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _effects(n: int, eff_txt: str) -> list[dict]:
    """Dated effects of an état B amendment, one entry per sentence of the exposé's « prend effet » paragraph."""
    out = []
    sentences = re.split(r"(?<=\.)\s+(?=Elle prend effet|La mesure prend effet)", eff_txt)
    for sent in sentences:
        m = _EFFECT.match(sent.strip())
        assert m, (n, sent)
        iso = f"{m.group(2)}-{MONTHS[m.group(1)]:02d}-01"
        if m.group("what"):
            what = m.group("what")
        else:
            q = m.group("q")
            if "n’atteint que des personnes morales" in q:
                what = "tous les crédits de la mission (personnes morales uniquement)"
            elif "atteint des personnes physiques" in q:
                what = "tous les crédits de la mission (personnes physiques)"
            else:
                raise AssertionError((n, sent))
        out.append({"date": iso, "applies_to_fr": what, "sentence_fr": sent.strip()})
    assert out, n
    return out


def build() -> dict:
    with open(ETAT_B_CSV, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 99, len(rows)
    by_n: dict[int, list] = {}
    for r in rows:
        by_n.setdefault(int(r["amendment"]), []).append(r)
    assert sorted(by_n) == NUMBERS, sorted(by_n)
    out = []
    tot_ae = tot_cp = 0
    n_titre2 = 0
    for n in NUMBERS:
        rs = by_n[n]
        totals = [r for r in rs if r["programme"] == "TOTAL"]
        assert len(totals) == 1, n
        t = totals[0]
        # « dont titre 2 » lines are sub-lines of the programme above (staff costs); they are not programmes
        progs: list[dict] = []
        for r in rs:
            if r["programme"] == "TOTAL":
                continue
            if r["programme"].startswith("dont titre 2"):
                progs[-1]["titre2"] = r
                n_titre2 += 1
            else:
                progs.append({"row": r, "titre2": None})
        mission = ws(t["mission"])
        s_ae = sum(_int(p["row"]["AE_moins"]) for p in progs)
        s_cp = sum(_int(p["row"]["CP_moins"]) for p in progs)
        # the amendment's own TOTAUX row is the published figure; since the November 2026 tables the programme lines add up exactly
        gap_ae, gap_cp = s_ae - _int(t["AE_moins"]), s_cp - _int(t["CP_moins"])
        assert abs(gap_ae) <= 1 and abs(gap_cp) <= 1, (n, s_ae, _int(t["AE_moins"]), s_cp, _int(t["CP_moins"]))
        assert all(_int(r["AE_plus"]) == 0 and _int(r["CP_plus"]) == 0 for r in rs), n
        a = amendment("PLF-P2", n)
        ex = a["expose"]
        # mission name in the amendment heading must match the CSV
        assert mission.upper() in a["title_upper"].upper().replace("« ", "").replace(" »", ""), (mission, a["title_upper"])
        # every figure of the CSV is in the amendment text
        for r in rs:
            for col in ("AE_moins", "CP_moins"):
                v = _int(r[col])
                if v:
                    assert quote_in_amendment("PLF-P2", n, _grouped(v)), (n, r["programme"], col, v)
        exs = re.sub(r"\s+", " ", ex)
        m_np = re.search(r"Il porte sur (\d+) programmes? et sur les crédits (?:de |d’)(.*?)\.\s", exs)
        assert m_np, n
        n_prog = int(m_np.group(1))
        assert n_prog == len(progs), (n, n_prog, len(progs))
        natures = [x.strip() for x in re.split(r",\s*", m_np.group(2)) if x.strip()]
        m_base = re.search(r"reçoivent ([\d\s  ]+) euros d’autorisations d’engagement dans le texte déposé", exs)
        assert m_base, n
        base_ae = int(re.sub(r"\D", "", m_base.group(1)))
        m_eff = re.search(r"(La mesure prend effet .*?)(?=\s+Dit simplement|$)", exs)
        assert m_eff, n
        eff_txt = ws(m_eff.group(1)).replace("1 er", "1er")
        dates = _effects(n, eff_txt)
        ae, cp = _int(t["AE_moins"]), _int(t["CP_moins"])
        tot_ae += ae
        tot_cp += cp
        ae_m, cp_m = clean(ae / 1e6, 1), clean(cp / 1e6, 1)
        p_first, p_last = quote_pages("PLF-P2", n, _grouped(ae))
        out.append({
            "amendment": n,
            "id": f"PLF-P2-{n}",
            "mission_fr": mission,
            "article_fr": "Article 58, état B",
            "ae_retirees_eur": ae, "cp_retirees_eur": cp,
            "ae_retirees_md": clean(ae / 1e9, 3), "cp_retirees_md": clean(cp / 1e9, 3),
            "ae_retirees_meur": ae_m, "cp_retirees_meur": cp_m,
            "n_programmes": len(progs),
            "programmes": [
                {"programme_fr": ws(p["row"]["programme"]), "ae_retirees_eur": _int(p["row"]["AE_moins"]), "cp_retirees_eur": _int(p["row"]["CP_moins"]),
                 "ae_retirees_md": clean(_int(p["row"]["AE_moins"]) / 1e9, 3), "cp_retirees_md": clean(_int(p["row"]["CP_moins"]) / 1e9, 3),
                 "dont_titre_2_ae_eur": _int(p["titre2"]["AE_moins"]) if p["titre2"] else None,
                 "dont_titre_2_cp_eur": _int(p["titre2"]["CP_moins"]) if p["titre2"] else None}
                for p in progs
            ],
            "ae_programmes_vises_texte_depose_eur": base_ae,
            "part_ae_retiree_pct": clean(ae / base_ae * 100, 1),
            "natures_de_credits_fr": natures,
            "effet_fr": eff_txt,
            "effets": [{"date": d["date"], "applies_to_fr": d["applies_to_fr"], "sentence_fr": d["sentence_fr"]} for d in dates],
            "ecart_ae_cp_eur": ae - cp,
            "ecart_somme_programmes_vs_total_eur": {"ae": gap_ae, "cp": gap_cp},
            "pdf_page": p_first,
            "source": {"kind": "amendment", "ref": f"Amendement PLF-P2 n° {n} (article 58, état B, mission « {mission} »), ligne TOTAUX, {page_label(p_first, p_last)} du PDF",
                       "url": pdf_url("PLF-P2", p_first), "csv": ETAT_B_CSV_REL},
            "tier": "loi",
        })
    assert (tot_ae, tot_cp) == (EXPECTED_TOTAL_AE_EUR, EXPECTED_TOTAL_CP_EUR), (tot_ae, tot_cp)
    assert n_titre2 == 13, n_titre2
    tot_ae_m, tot_cp_m = clean(tot_ae / 1e6, 1), clean(tot_cp / 1e6, 1)
    out_sorted = sorted(out, key=lambda r: (-r["cp_retirees_eur"], r["amendment"]))
    ranks = {r["amendment"]: i + 1 for i, r in enumerate(out_sorted)}
    for r in out:
        r["rang_par_cp"] = ranks[r["amendment"]]
        r["part_du_total_cp_pct"] = clean(r["cp_retirees_eur"] / tot_cp * 100, 2)
    n_prog_total = sum(r["n_programmes"] for r in out)
    assert n_prog_total == 63, n_prog_total
    first_two = sorted(out, key=lambda r: -r["cp_retirees_eur"])[:2]
    return {
        "meta": {
            "title_fr": "Crédits de l'État retirés par les 23 amendements « état B » (PLF 2027, seconde partie)",
            "unit": "euros ; *_md = milliards d'euros (3 décimales) ; *_meur = millions d'euros (1 décimale)",
            "ae": "autorisations d'engagement", "cp": "crédits de paiement",
            "source": {"kind": "amendment", "ref": "Liasse PLF seconde partie, amendements n° 1 à 22 et n° 40 (article 58, état B) ; tableau extrait de la liasse dans " + ETAT_B_CSV_REL, "url": pdf_url("PLF-P2")},
            "tier": "loi",
            "totals": {
                "n_amendements": len(out), "n_programmes": n_prog_total,
                "ae_retirees_eur": tot_ae, "cp_retirees_eur": tot_cp,
                "ae_retirees_md": clean(tot_ae / 1e9, 3), "cp_retirees_md": clean(tot_cp / 1e9, 3),
                "ae_retirees_meur": tot_ae_m, "cp_retirees_meur": tot_cp_m,
            },
            "october_2026": {
                "note": "Version d'octobre 2026 des mêmes amendements (22 missions, n° 1 à 22), réécrite en novembre 2026 ; gardée pour mémoire, plus lue par le pipeline.",
                "n_amendements": OCTOBER_N_MISSIONS, "ae_retirees_eur": OCTOBER_TOTAL_AE_EUR, "cp_retirees_eur": OCTOBER_TOTAL_CP_EUR,
                "ae_retirees_md": clean(OCTOBER_TOTAL_AE_EUR / 1e9, 3), "cp_retirees_md": clean(OCTOBER_TOTAL_CP_EUR / 1e9, 3),
            },
            "notes": [
                "Chaque ligne TOTAUX de la liasse est reprise telle que publiée. Dans la version de novembre 2026, la somme des programmes est égale à la ligne TOTAUX pour les 23 amendements (en octobre, elle différait de 1 € pour n° 4, 5 et 13) ; les lignes « dont titre 2 » sont des sous-lignes, pas des programmes.",
                f"Les 23 amendements ne retirent que des crédits (colonnes « + » toutes à zéro). Total : {fr(tot_ae_m, 1)} M€ d'AE et {fr(tot_cp_m, 1)} M€ de CP.",
                "Effet : l'exposé de chaque amendement date séparément chaque nature de crédit (« La mesure prend effet au 1er janvier 2027 pour …, au 1er avril 2027 pour l'hébergement d'urgence, au 1er juillet 2027 pour … ») ; voir effet_fr et effets pour chaque mission. L'exposé précise : « Un dispositif qui s'éteint en trois ans est retiré pour sa première année. »",
                "Écart APL : l'exposé de PLF-P2 n° 32 chiffre l'économie 2027 de l'aide personnelle au logement à 5,4 Md€, alors que l'amendement n° 1 retire 2 690,3 M€ de CP du programme « Aide à l'accès au logement » (8 067,8 M€ dans la version d'octobre) ; voir DISCREPANCIES.md.",
                "Les 7 missions conservées par le plan (Défense, Sécurités, Justice, Action extérieure, Gestion des finances publiques, Solidarité, Enseignement scolaire) sont peu touchées ; Défense et Gestion des finances publiques ne figurent pas dans les 23 amendements.",
            ],
            "plus_gros": [{"amendment": r["amendment"], "mission_fr": r["mission_fr"], "cp_retirees_md": r["cp_retirees_md"]} for r in first_two],
        },
        "missions": out,
    }
