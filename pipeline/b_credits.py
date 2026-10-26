"""credits-retires.json — the 22 « état B » amendments of PLF 2027 part 2 (nos 1 to 22):
credits (AE, CP) removed mission by mission.

Input: data/derived/etat_b_credits_retires_plf2027.csv (79 rows = 57 programme lines + 22 totals,
parsed from the PDF by scripts/parse_etat_b.py) cross-checked against the amendment texts.
Amounts in the source are euros; exported in euros and in Md€ (3 decimals).
"""
from __future__ import annotations

import csv
import re

from amend import amendment, pdf_url
from lib import ETAT_B_CSV, clean, ws, fr

# Appendix A of research/source-analysis.md (M€, rounded to 0,1)
APPENDIX_A = {
    1: (13292.8, 13129.0), 2: (12065.4, 10695.6), 3: (2334.8, 2185.6), 4: (3772.5, 3269.8), 5: (3760.1, 2814.6), 6: (2027.9, 1743.3),
    7: (1005.6, 974.4), 8: (1259.2, 1257.0), 9: (781.6, 779.2), 10: (772.7, 670.1), 11: (674.7, 568.9), 12: (630.4, 556.6), 13: (513.5, 368.2),
    14: (207.8, 168.0), 15: (225.4, 225.4), 16: (205.8, 200.1), 17: (102.1, 102.0), 18: (92.1, 78.7), 19: (68.7, 68.7), 20: (49.3, 37.9),
    21: (6.9, 5.9), 22: (6.3, 5.8),
}
APPENDIX_A_TOTAL = (43855.4, 39905.0)


def _int(s):
    return int(s)


def build() -> dict:
    with open(ETAT_B_CSV, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 79
    by_n: dict[int, list] = {}
    for r in rows:
        by_n.setdefault(int(r["amendment"]), []).append(r)
    assert sorted(by_n) == list(range(1, 23))
    out = []
    tot_ae = tot_cp = 0
    for n in range(1, 23):
        rs = by_n[n]
        progs = [r for r in rs if r["programme"] != "TOTAL"]
        totals = [r for r in rs if r["programme"] == "TOTAL"]
        assert len(totals) == 1, n
        t = totals[0]
        mission = ws(t["mission"])
        s_ae = sum(_int(r["AE_moins"]) for r in progs)
        s_cp = sum(_int(r["CP_moins"]) for r in progs)
        # the amendment's own TOTAUX row is the published figure; programme lines may differ by 1 € (rounding in the source)
        gap_ae, gap_cp = s_ae - _int(t["AE_moins"]), s_cp - _int(t["CP_moins"])
        assert abs(gap_ae) <= 1 and abs(gap_cp) <= 1, (n, s_ae, _int(t["AE_moins"]), s_cp, _int(t["CP_moins"]))
        assert all(_int(r["AE_plus"]) == 0 and _int(r["CP_plus"]) == 0 for r in rs), n
        a = amendment("PLF-P2", n)
        ex = a["expose"]
        # mission name in the amendment heading must match the CSV
        assert mission.upper() in a["title_upper"].upper().replace("« ", "").replace(" »", ""), (mission, a["title_upper"])
        m_np = re.search(r"Il porte sur (\d+) programmes? et sur les crédits (?:de |d’)(.*?)\.\s", re.sub(r"\s+", " ", ex))
        assert m_np, n
        n_prog = int(m_np.group(1))
        assert n_prog == len(progs), (n, n_prog, len(progs))
        natures = [x.strip() for x in re.split(r",\s*", m_np.group(2)) if x.strip()]
        m_base = re.search(r"reçoivent ([\d\s  ]+) euros d’autorisations d’engagement dans le texte déposé", re.sub(r"\s+", " ", ex))
        assert m_base, n
        base_ae = int(re.sub(r"\D", "", m_base.group(1)))
        m_eff = re.search(r"(La mesure prend effet au [^.]*\.)", re.sub(r"\s+", " ", ex))
        assert m_eff, n
        eff_txt = ws(m_eff.group(1)).replace("1 er", "1er")
        dates = []
        if "1er janvier 2027 pour les personnes morales" in eff_txt:
            dates = [{"date": "2027-01-01", "applies_to_fr": "personnes morales"}, {"date": "2027-07-01", "applies_to_fr": "personnes physiques"}]
            assert "1er juillet 2027 pour les personnes physiques" in eff_txt
        elif "1er juillet 2027" in eff_txt:
            dates = [{"date": "2027-07-01", "applies_to_fr": "personnes physiques (demi-exercice)"}]
        elif "1er janvier 2027" in eff_txt:
            dates = [{"date": "2027-01-01", "applies_to_fr": "personnes morales (exercice plein)"}]
        assert dates, (n, eff_txt)
        ae, cp = _int(t["AE_moins"]), _int(t["CP_moins"])
        tot_ae += ae
        tot_cp += cp
        ae_m, cp_m = clean(ae / 1e6, 1), clean(cp / 1e6, 1)
        assert (ae_m, cp_m) == APPENDIX_A[n], (n, ae_m, cp_m, APPENDIX_A[n])
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
                {"programme_fr": ws(r["programme"]), "ae_retirees_eur": _int(r["AE_moins"]), "cp_retirees_eur": _int(r["CP_moins"]),
                 "ae_retirees_md": clean(_int(r["AE_moins"]) / 1e9, 3), "cp_retirees_md": clean(_int(r["CP_moins"]) / 1e9, 3)}
                for r in progs
            ],
            "ae_programmes_vises_texte_depose_eur": base_ae,
            "part_ae_retiree_pct": clean(ae / base_ae * 100, 1),
            "natures_de_credits_fr": natures,
            "effet_fr": eff_txt,
            "effets": dates,
            "ecart_ae_cp_eur": ae - cp,
            "ecart_somme_programmes_vs_total_eur": {"ae": gap_ae, "cp": gap_cp},
            "source": {"kind": "amendment", "ref": f"Amendement PLF-P2 n° {n} (article 58, état B, mission « {mission} »)", "url": pdf_url("PLF-P2", a["page"]),
                       "csv": "data/derived/etat_b_credits_retires_plf2027.csv"},
            "tier": "loi",
        })
    tot_ae_m, tot_cp_m = clean(tot_ae / 1e6, 1), clean(tot_cp / 1e6, 1)
    assert (tot_ae_m, tot_cp_m) == APPENDIX_A_TOTAL, (tot_ae_m, tot_cp_m)
    out_sorted = sorted(out, key=lambda r: (-r["cp_retirees_eur"], r["amendment"]))
    ranks = {r["amendment"]: i + 1 for i, r in enumerate(out_sorted)}
    for r in out:
        r["rang_par_cp"] = ranks[r["amendment"]]
        r["part_du_total_cp_pct"] = clean(r["cp_retirees_eur"] / tot_cp * 100, 2)
    return {
        "meta": {
            "title_fr": "Crédits de l'État retirés par les 22 amendements « état B » (PLF 2027, seconde partie)",
            "unit": "euros ; *_md = milliards d'euros (3 décimales) ; *_meur = millions d'euros (1 décimale)",
            "ae": "autorisations d'engagement", "cp": "crédits de paiement",
            "source": {"kind": "amendment", "ref": "Liasse PLF seconde partie, amendements n° 1 à 22 (article 58, état B) ; tableau extrait de la liasse dans data/derived/etat_b_credits_retires_plf2027.csv", "url": pdf_url("PLF-P2")},
            "tier": "loi",
            "totals": {
                "n_amendements": 22, "n_programmes": sum(r["n_programmes"] for r in out),
                "ae_retirees_eur": tot_ae, "cp_retirees_eur": tot_cp,
                "ae_retirees_md": clean(tot_ae / 1e9, 3), "cp_retirees_md": clean(tot_cp / 1e9, 3),
                "ae_retirees_meur": tot_ae_m, "cp_retirees_meur": tot_cp_m,
            },
            "notes": [
                "Chaque ligne TOTAUX de la liasse est reprise telle que publiée ; la somme des programmes diffère de 1 € d'autorisations d'engagement pour les amendements " + ", ".join(f"n° {r['amendment']}" for r in out if r["ecart_somme_programmes_vs_total_eur"]["ae"] or r["ecart_somme_programmes_vs_total_eur"]["cp"]) + " : arrondi de la source (voir ecart_somme_programmes_vs_total_eur).",
                "Les 22 amendements ne retirent que des crédits (colonnes « + » toutes à zéro). Total : 43 855,4 M€ d'AE et 39 905,0 M€ de CP.",
                "Effet : 1er janvier 2027 pour les personnes morales et 1er juillet 2027 pour les personnes physiques (demi-exercice) — voir effet_fr pour la phrase exacte de chaque amendement.",
                "Écart APL : l'exposé de PLF-P2 n° 32 chiffre l'économie 2027 de l'aide personnelle au logement à 5,4 Md€, alors que l'amendement n° 1 retire 8 067,8 M€ de CP du programme « Aide à l'accès au logement » (voir DISCREPANCIES.md).",
                "Les 7 missions conservées par le plan (Défense, Sécurités, Justice, Action extérieure, Gestion des finances publiques, Solidarité, Enseignement scolaire) sont peu touchées : Sécurités 37,9 M€, Justice 5,9 M€, Action extérieure 200,1 M€, Solidarité 102,0 M€, Enseignement scolaire 225,4 M€ de CP ; Défense et Gestion des finances publiques ne figurent pas dans les 22 amendements.",
            ],
        },
        "missions": out,
    }
