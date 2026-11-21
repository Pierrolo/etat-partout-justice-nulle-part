"""amendements.json — the 84 written and published amendments (PLF 2027 parts 1 and 2, PLFSS 2027): 35 + 40 + 9.

Structure parsed from research/pages-2026-11-21/amendements__*.md (see amend.py); themes, plain-French
summaries and dated effects come from curated_amendements.py, every dated effect being
verified against the amendment text; the 23 « état B » amendments (PLF-P2 n° 1 to 22 and n° 40)
are summarised from the credits data.  Each dated effect links to the PDF page that holds its quote.
"""
from __future__ import annotations

import re

from amend import LIASSES, all_amendments, docx_url, donnees_cards, first_sentence, page_label, pdf_url, quote_pages
from curated_amendements import CURATED, THEMES
import b_credits
from lib import PLAN_VERSION, fr, ws


def _sentence_case(art: str) -> str:
    s = ws(art).lower()
    s = s.replace("l'article", "l’article")
    return s[:1].upper() + s[1:]


def _effect_sentence(dts: list[str]) -> str:
    names = {"2027-01-01": "1er janvier", "2027-04-01": "1er avril", "2027-07-01": "1er juillet"}
    labels = [names[d] for d in dts]
    if len(labels) == 1:
        return f"Les crédits cessent au {labels[0]} 2027."
    return "Les crédits cessent au " + ", au ".join(labels[:-1]) + f" ou au {labels[-1]} 2027 selon leur nature."


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
            is_etat_b = lid == "PLF-P2" and n in credits
            if is_etat_b:
                c = credits[n]
                theme = "credits_etat"
                dts = sorted({d["date"] for d in c["effets"]})
                resume = (
                    f"Retire {fr(c['cp_retirees_md'], 3)} Md€ de crédits de paiement (et {fr(c['ae_retirees_md'], 3)} Md€ d'autorisations d'engagement) "
                    f"de la mission « {c['mission_fr']} », soit {fr(c['part_ae_retiree_pct'], 1)} % des autorisations d'engagement des {c['n_programmes']} "
                    f"programme{'s' if c['n_programmes'] > 1 else ''} visé{'s' if c['n_programmes'] > 1 else ''}. "
                    + _effect_sentence(dts)
                )
                dates = []
                for d in c["effets"]:
                    first, _last = quote_pages(lid, n, d["sentence_fr"])
                    dates.append({"date": d["date"], "precision": "jour", "label_fr": f"Crédits retirés pour {d['applies_to_fr']}", "pdf_page": first, "pdf_url": pdf_url(lid, first)})
            else:
                cur = CURATED[(lid, n)]
                theme, resume = cur["theme"], cur["resume"]
                dates = []
                for iso, prec, label, q in cur["dates"]:
                    first, _last = quote_pages(lid, n, q)  # raises when the quote is not in the amendment
                    dates.append({"date": iso, "precision": prec, "label_fr": label, "pdf_page": first, "pdf_url": pdf_url(lid, first)})
            pdf_page = a["page"]
            assert theme in THEMES
            art = _sentence_case(a["article_corps"]) if a["article_corps"] else t["article_vise"]
            if is_etat_b:
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
                "pdf_page": pdf_page,
                "pdf_pages_fr": page_label(a["page"], a["page_end"]),
                "pdf_url": pdf_url(lid, pdf_page),
                "liasse_pdf_url": pdf_url(lid),
                "docx_url": docx_url(lid),
                "tier": "loi",
            })
    assert len(recs) == 84
    by_theme: dict = {}
    for r in recs:
        by_theme.setdefault(r["theme"], []).append(r["id"])
    return {
        "meta": {
            "title_fr": "Les 84 amendements rédigés et publiés par Résolution",
            "tier": "loi",
            "tier_note": "Ce sont des projets d'amendements rédigés et publiés par l'association Résolution (liasses republiées les 17 et 18 novembre 2026) : ils ne sont pas en vigueur, aucun n'a été déposé au Parlement à la date du 21 novembre 2026 ; leur texte est la seule spécification précise des paramètres du plan.",
            "version": {k: PLAN_VERSION[k] for k in ("date_iso", "date_fr", "pdf_dates_fr", "cover_fr", "previous_fr")},
            "donnees_page_cards": donnees_cards(),
            "counts": {"total": 84, **{lid: m["count"] for lid, m in LIASSES.items()}},
            "liasses": [
                {"id": lid, "label_fr": m["label_fr"], "bill_fr": m["bill"], "n_amendements": m["count"], "n_pages": m["pages"], "pdf_url": pdf_url(lid), "docx_url": docx_url(lid), "date_fr": m["pdf_date_fr"]}
                for lid, m in LIASSES.items()
            ],
            "themes": [{"id": k, "label_fr": v, "n": len(by_theme.get(k, []))} for k, v in THEMES.items()],
            "dates_note": "dates : une entrée par effet daté écrit dans le texte (precision : jour = jour écrit ; annee = année sans jour, 1er janvier par convention ; approx = point de départ non écrit). Chaque entrée a été vérifiée contre le texte de l'amendement lors de la construction.",
            "resume_note": "resume_fr : une phrase neutre rédigée par le pipeline d'après l'exposé sommaire et le dispositif ; objet_expose_fr : première phrase de l'exposé sommaire, reprise telle quelle.",
            "pdf_note": "pdf_url pointe vers la première page de l'amendement dans le PDF de la liasse (ancre #page=N) sur france-resolution.fr ; chaque entrée de dates[] pointe vers la page qui contient la phrase citée.",
        },
        "amendements": recs,
    }
