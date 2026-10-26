"""fiches.json — the 18 « situations » (one-page fiches of france-resolution.fr).

Parsed from research/pages/fiches.md (index: groups, order, taglines) and
research/pages/fiches__<slug>.md (header counts, gains / pertes verbatim).
Wording is copied verbatim (whitespace-normalised, typographic characters kept).
The header counts (« 1 perte · 13 gains ») are the site's own and do not always match
the number of items displayed on the fiche: both are exported (`header_vs_listed`).
"""
from __future__ import annotations

import re

from lib import SITE, PAGES_DIR, read_page, ws, clean

# slug -> id of the facts.json fact holding the population shown in the header (when there is one)
POP_FACT = {
    "citoyen": "fiche_pop_citoyens",
    "contribuable": "fiche_pop_foyers",
    "foyer": "fiche_pop_foyers",
    "travailleur": "fiche_pop_travailleurs",
    "personne-sans-emploi": "fiche_pop_sans_emploi",
    "agent-public-indispensable": "fiche_pop_agents_indispensables",
    "agent-public-dont-le-poste-est-supprime": "postes_publics_fermes_fiche",
    "jeune-adulte": "fiche_pop_jeunes_adultes",
    "retraite": "fiche_pop_retraites",
}

_FIG = re.compile(r"^(\+)?\s*([\d\s  ]+(?:,\d+)?)\s*(Md€|M€|€|%)?$")


def parse_figure(raw: str):
    """Parse a headline like '+13 %', '600 €', '36 %', '68,9 Md€', '0,77 €' ; None if not numeric."""
    t = raw.replace(" ", " ").replace(" ", " ").strip()
    m = _FIG.match(t)
    if not m or not m.group(2).strip():
        return None
    num = float(re.sub(r"\s", "", m.group(2)).replace(",", "."))
    return {"raw": raw, "value": clean(num, 4), "unit": m.group(3) or None, "signed_plus": bool(m.group(1))}


def _index():
    txt = read_page("fiches")
    groups, cur = [], None
    for line in txt.splitlines():
        if line.startswith("## "):
            cur = {"label_fr": ws(line[3:]), "description_fr": None, "fiches": []}
            groups.append(cur)
        elif cur is not None and not cur["fiches"] and cur["description_fr"] is None and line.strip() and not line.startswith("- "):
            cur["description_fr"] = ws(line)
        elif cur is not None and line.startswith("- "):
            m = re.match(r"- (.+?) (Un |Ce |Votre |Ce que|Six |Produire|Mieux|Partir|Vous |Démarrer|Se |Plus |Les |La )", line)
            cur["fiches"].append(ws(line[2:]))
    return groups


def _parse(slug: str, order: int, group_label: str, group_desc: str | None):
    txt = read_page(f"fiches__{slug}")
    lines = txt.splitlines()
    m_src = re.match(r"<!-- source: (.+?) -->", lines[0])
    page_url = m_src.group(1)
    assert page_url == f"{SITE}/fiches/{slug}.html", (slug, page_url)
    # title: second '# ' heading (first is « Title — Résolution »)
    heads = [i for i, l in enumerate(lines) if l.startswith("# ")]
    title = ws(lines[heads[1]][2:])
    # group line = last non-empty line before the title heading
    j = heads[1] - 1
    while not lines[j].strip():
        j -= 1
    group_in_page = ws(lines[j])
    assert group_in_page == group_label, (slug, group_in_page, group_label)
    # tagline and header
    k = heads[1] + 1
    nonempty = []
    while len(nonempty) < 2:
        if lines[k].strip():
            nonempty.append(ws(lines[k]))
        k += 1
    tagline, header = nonempty
    # header counts
    pop = None
    pertes = gains = 0
    for part in [p.strip() for p in header.split("·")]:
        mm = re.match(r"^(\d+) perte(?:s)?$", part)
        if mm:
            pertes = int(mm.group(1))
            continue
        mm = re.match(r"^(\d+) gain(?:s)?$", part)
        if mm:
            gains = int(mm.group(1))
            continue
        pop = part
    population = None
    if pop:
        mm = re.match(r"^([\d\s  ]+(?:,\d+)?)\s*(M)?\s*(.*)$", pop)
        num = float(re.sub(r"\s", "", mm.group(1)).replace(",", "."))
        mult = 1_000_000 if mm.group(2) else 1
        population = {"raw": pop, "value": int(round(num * mult)), "unit_fr": mm.group(3).strip() or None}
    # sections
    body = lines[k:]
    sect = None
    gains_items, pertes_items, common = [], [], []
    pending_title = None
    for l in body:
        if l.startswith("### "):
            sect = "g" if "gagnez" in l else "p"
            pending_title = None
            continue
        if l.startswith("Télécharger cette fiche"):
            break
        if not l.strip():
            continue
        if l.startswith("_Et comme chacun_"):
            rest = l.split(":", 1)[1]
            common = [ws(x) for x in rest.split("·") if x.strip()]
            continue
        if sect == "g":
            mm = re.match(r"^- \*\*(.+?)\*\* : (.*)$", l)
            if mm:
                gains_items.append({"headline_fr": ws(mm.group(1)), "text_fr": ws(mm.group(2)), "sub_items_fr": [], "figure": parse_figure(ws(mm.group(1)))})
                continue
            mm = re.match(r"^- \*\*(.+?)\*\*\s*$", l)
            if mm:
                gains_items.append({"headline_fr": ws(mm.group(1)), "text_fr": "", "sub_items_fr": [], "figure": parse_figure(ws(mm.group(1)))})
                continue
            mm = re.match(r"^\s{2,}- (.*)$", l)
            if mm and gains_items:
                gains_items[-1]["sub_items_fr"].append(ws(mm.group(1)))
                continue
            raise ValueError(f"{slug}: unparsed gains line: {l!r}")
        elif sect == "p":
            if pending_title is None:
                pending_title = ws(l)
            else:
                pertes_items.append({"title_fr": pending_title, "text_fr": ws(l)})
                pending_title = None
        else:
            raise ValueError(f"{slug}: line outside section: {l!r}")
    assert pending_title is None, (slug, pending_title)
    listed_gains = len(gains_items) + sum(len(g["sub_items_fr"]) for g in gains_items)
    return {
        "slug": slug,
        "order": order,
        "title_fr": title,
        "tagline_fr": tagline,
        "group_fr": group_label,
        "group_description_fr": group_desc,
        "header_fr": header,
        "header_population": population,
        "header_counts": {"pertes": pertes, "gains": gains},
        "gains": gains_items,
        "pertes": pertes_items,
        "comme_chacun_fr": common,
        "header_vs_listed": {
            "pertes_header": pertes, "pertes_listees": len(pertes_items),
            "gains_header": gains, "gains_listes_avec_sous_points": listed_gains, "gains_listes_hors_sous_points": len(gains_items),
            "gains_listes_plus_comme_chacun": listed_gains + len(common),
            "gains_match": gains == listed_gains or gains == listed_gains + len(common),
            "pertes_match": pertes == len(pertes_items),
        },
        "population_fact_id": POP_FACT.get(slug),
        "url": page_url,
        "pdf_url": f"{SITE}/fiches/{slug}.pdf",
        "source": {"kind": "site", "ref": f"france-resolution.fr › fiches › {slug}", "url": page_url},
        "tier": "annonce",
    }


def build() -> dict:
    idx = _index()
    # fiches.md lists "Title Tagline" per fiche; recover slugs from the fiches__*.md files by title
    files = sorted(p.stem[len("fiches__"):] for p in PAGES_DIR.glob("fiches__*.md"))
    assert len(files) == 18, files
    # map title -> slug by reading each file
    title_of = {}
    for slug in files:
        lines = read_page(f"fiches__{slug}").splitlines()
        heads = [l for l in lines if l.startswith("# ")]
        title_of[ws(heads[1][2:])] = slug
    recs = []
    order = 0
    for g in idx:
        for item in g["fiches"]:
            # item = "<Title> <Tagline>" ; find the longest title that prefixes it
            cands = [t for t in title_of if item.startswith(t + " ")]
            assert cands, item
            t = max(cands, key=len)
            order += 1
            recs.append(_parse(title_of[t], order, g["label_fr"], g["description_fr"]))
    assert len(recs) == 18 and len({r["slug"] for r in recs}) == 18
    # header counts as listed on the fiches index (source-analysis §1)
    mism = [r["slug"] for r in recs if not r["header_vs_listed"]["gains_match"] or not r["header_vs_listed"]["pertes_match"]]
    return {
        "meta": {
            "title_fr": "Les 18 situations : ce que le plan donne et retire",
            "tier": "annonce",
            "tier_note": "Textes des fiches de france-resolution.fr : affirmations des auteurs, sans texte de loi ; reprises mot pour mot.",
            "count": len(recs),
            "groups": [{"label_fr": g["label_fr"], "description_fr": g["description_fr"], "slugs": [r["slug"] for r in recs if r["group_fr"] == g["label_fr"]]} for g in idx],
            "header_mismatch_slugs": mism,
            "header_note": "Le compte « N pertes · N gains » de l'en-tête de chaque fiche est celui du site ; il ne correspond pas toujours au nombre d'éléments affichés (voir header_vs_listed et DISCREPANCIES.md). Les éléments « Et comme chacun » sont des rappels de gains communs à plusieurs fiches.",
            "persona_link": "slug = clé stable pour relier les fiches aux profils du simulateur ; population_fact_id renvoie à facts.json ; figure donne la valeur numérique analysée des chiffres en gras.",
        },
        "fiches": recs,
    }
