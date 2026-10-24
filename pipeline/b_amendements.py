"""amendements.json — the 81 ready-to-file amendments (PLF 2027 parts 1 and 2, PLFSS 2027).

Structure parsed from research/pages/amendements__*.md (see amend.py); themes, plain-French
summaries and dated effects come from curated_amendements.py, every dated effect being
verified against the amendment text; the 22 « état B » amendments are summarised from
the credits data.
"""
from __future__ import annotations

import re

from amend import LIASSES, all_amendments, docx_url, first_sentence, pdf_url, quote_in_amendment
from curated_amendements import CURATED, THEMES
import b_credits
from lib import fr, ws


def _sentence_case(art: str) -> str:
    s = ws(art).lower()
    s = s.replace("l'article", "l’article")
    return s[:1].upper() + s[1:]


def build() -> dict:
    A = all_amendments()
    credits = {m["amendment"]: m for m in b_credits.build()["missions"]}
    recs = []
    for lid, meta in LIASSES.items():
        assert len(A[lid]) == meta["count"], (lid, len(A[lid]))
        for n in sorted(A[lid]):
            a = A[lid][n]
            t = a["table"]
            assert t, (lid, n)
            lot = t.get("lot")
            if lid == "PLF-P2" and n <= 22:
                c = credits[n]
                theme = "credits_etat"
                resume = (
                    f"Retire {fr(c['cp_retirees_md'], 3)} Md€ de crédits de paiement (et {fr(c['ae_retirees_md'], 3)} Md€ d'autorisations d'engagement) "
                    f"de la mission « {c['mission_fr']} », soit {fr(c['part_ae_retiree_pct'], 1)} % des autorisations d'engagement des {c['n_programmes']} "
                    f"programme{'s' if c['n_programmes'] > 1 else ''} visé{'s' if c['n_programmes'] > 1 else ''}."
                )
                dates = [{"date": d["date"], "precision": "jour", "label_fr": f"Crédits retirés pour les {d['applies_to_fr']}"} for d in c["effets"]]
            else:
                cur = CURATED[(lid, n)]
                theme, resume = cur["theme"], cur["resume"]
                dates = []
                for iso, prec, label, q in cur["dates"]:
                    assert quote_in_amendment(lid, n, q), f"quote not found in {lid} n°{n}: {q!r}"
                    dates.append({"date": iso, "precision": prec, "label_fr": label})
            assert theme in THEMES
            art = _sentence_case(a["article_corps"]) if a["article_corps"] else t["article_vise"]
            if lid == "PLF-P2" and n <= 22:
                art = "Article 58, état B"
            recs.append({
                "id": a["id"],
                "liasse": lid,
                "liasse_label_fr": meta["label_fr"],
                "bill_fr": meta["bill"],
                "number": n,
                "title_fr": t["objet"],
                "article_fr": art,
                "lot_fr": lot,
                "theme": theme,
                "theme_label_fr": THEMES[theme],
                "objet_expose_fr": first_sentence(a["expose"]),
                "resume_fr": resume,
                "dates": dates,
                "effective_from": min((d["date"] for d in dates), default=None),
                "effective_to": max((d["date"] for d in dates), default=None),
                "pdf_page": a["page"],
                "pdf_url": pdf_url(lid, a["page"]),
                "liasse_pdf_url": pdf_url(lid),
                "docx_url": docx_url(lid),
                "tier": "loi",
            })
    assert len(recs) == 81
    by_theme: dict = {}
    for r in recs:
        by_theme.setdefault(r["theme"], []).append(r["id"])
    return {
        "meta": {
            "title_fr": "Les 81 amendements « prêts à déposer » de Résolution",
            "tier": "loi",
            "tier_note": "Ce sont des projets d'amendements rédigés par l'association Résolution (liasses d'octobre 2026) : ils ne sont ni déposés ni adoptés ; leur texte est la seule spécification précise des paramètres du plan.",
            "counts": {"total": 81, **{lid: m["count"] for lid, m in LIASSES.items()}},
            "liasses": [
                {"id": lid, "label_fr": m["label_fr"], "bill_fr": m["bill"], "n_amendements": m["count"], "n_pages": m["pages"], "pdf_url": pdf_url(lid), "docx_url": docx_url(lid), "date_fr": "19 octobre 2026"}
                for lid, m in LIASSES.items()
            ],
            "themes": [{"id": k, "label_fr": v, "n": len(by_theme.get(k, []))} for k, v in THEMES.items()],
            "dates_note": "dates : une entrée par effet daté écrit dans le texte (precision : jour = jour écrit ; annee = année sans jour, 1er janvier par convention ; approx = point de départ non écrit). Chaque entrée a été vérifiée contre le texte de l'amendement lors de la construction.",
            "resume_note": "resume_fr : une phrase neutre rédigée par le pipeline d'après l'exposé sommaire et le dispositif ; objet_expose_fr : première phrase de l'exposé sommaire, reprise telle quelle.",
            "pdf_note": "pdf_url pointe vers la page du PDF de la liasse (ancre #page=N) sur france-resolution.fr.",
        },
        "amendements": recs,
    }
