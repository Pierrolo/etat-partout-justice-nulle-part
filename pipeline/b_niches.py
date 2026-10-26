"""niches.json — the 465 tax expenditures of the PLF 2026 annex « Dépenses fiscales »
(Voies et moyens, tome II, annexe 3), plus the 81 « modalités de calcul de l'impôt »
(dépenses fiscales déclassées, not counted in the 465) and the aggregate of the
21 reduced VAT rates that the PLF does not count as niches.

Joins on the niche number across the sheets
  Chiffrages Résolution (labels, tax, beneficiaries count, 2024 cost, Résolution typology),
  Chiffrages (2024 / 2025 / 2026 costs), Échéances (dates), Bénéficiaires (nature),
  Explication détaillée (purpose), Méthodologie, Références juridiques,
  Programme de rattachement (budget programme).
All joins are checked to be 1:1 on the 465 ids.

Cost cells carry three kinds of non-numeric markers (sheet legend): « - » no budgetary
effect, « ε » below 0,5 M€ and not computed, « nc » not computed.  They are exported as
null plus a flag (aucun_effet / epsilon / nc) — never as 0.

Coarse category (for filters) = ONE category per niche, first matching rule:
  1. outre-mer   label mentions an overseas territory
  2. TVA         tax = taxe sur la valeur ajoutée
  3. épargne     label mentions livret / épargne / PEA / PEL / assurance-vie / capitalisation / PER
  4. logement    label mentions housing terms, or local tax TFPB / TH
  5. ménages | entreprises   by beneficiary nature (Bénéficiaires sheet)
  6. autre       everything else (mixed beneficiaries, vehicles, parcels, premises)
`category_tags` lists every rule that fires; `category_rule` says which fired first.
"""
from __future__ import annotations

import collections
import re
import unicodedata

from lib import Sheet, cell_flag, clean, parse_num, ws

# --------------------------------------------------------------------------
# classification
# --------------------------------------------------------------------------
def _fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()


OUTRE_MER = re.compile(
    r"outre-mer|outremer|\bdom\b|guadeloupe|martinique|reunion|guyane|mayotte|saint-pierre|polynesie|nouvelle-caledonie|wallis|article 73 de la constitution|terres australes"
)
EPARGNE = re.compile(
    r"livret|epargne|plan d'epargne|\bpea\b|\bpel\b|assurance-vie|assurance vie|contrats? de capitalisation|bons ou contrats|\bper\b|\bperp\b|plans d'epargne populaire|produits des plans"
)
LOGEMENT_STRONG = re.compile(
    r"logement|habitation|\bhlm\b|locatif|pinel|scellier|duflot|malraux|censi|denormandie|perissol|robien|borloo|cosse|\banah\b|residence principale|"
    r"pret a taux zero|loc'avantages|nu-proprietaire|deficit foncier|revenus fonciers|societe fonciere|proprietes baties|locaux a usage"
)
# weaker hits only count when the beneficiaries are not businesses (keeps SIIC / SPPICAV-type regimes out of « logement »)
LOGEMENT_WEAK = re.compile(r"immobilier|immobiliere|immeubles? (?:bati|classe|inscrit|a caractere social|anti-sismique)")
NOT_HOUSING = re.compile(r"vehicule")
# local taxes on built property / housing: counted as « logement » unless the label is about businesses
LOCAL_BUSINESS = re.compile(r"etablissement|entreprise|\bcfe\b|activite")


def classify(label: str, tax: str, subcat: str, benef: str):
    f = _fold(label)
    tags, first = [], None

    def hit(cat, rule, m=None):
        nonlocal first
        tags.append(cat)
        if first is None:
            first = (cat, rule + (f":{m.group(0)}" if m else ""))

    m = OUTRE_MER.search(f)
    if m:
        hit("outre-mer", "libellé~outre-mer", m)
    if tax == "Taxe sur la valeur ajoutée":
        hit("TVA", "impôt=TVA")
    m = EPARGNE.search(f)
    if m:
        hit("épargne", "libellé~épargne", m)
    nature = benef.replace("\xa0", " ")
    m = LOGEMENT_STRONG.search(f) if not NOT_HOUSING.search(f) else None
    if m is None and nature != "Entreprises" and not NOT_HOUSING.search(f):
        m = LOGEMENT_WEAK.search(f)
    if m:
        hit("logement", "libellé~logement", m)
    elif subcat in ("TFPB", "TH") and not LOCAL_BUSINESS.search(f):
        tags.append("logement")
        if first is None:
            first = ("logement", f"sous-catégorie={subcat}")
    if nature == "Ménages":
        tags.append("ménages")
        if first is None:
            first = ("ménages", "bénéficiaires=Ménages")
    elif nature == "Entreprises":
        tags.append("entreprises")
        if first is None:
            first = ("entreprises", "bénéficiaires=Entreprises")
    if first is None:
        first = ("autre", f"bénéficiaires={nature or 'n/d'}")
    # ordered, de-duplicated
    seen, ordered = set(), []
    for t in tags:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return first[0], first[1], ordered


# editorial list of niches/provisions that most households meet (id -> (kind, reason))
HOUSEHOLD_EDITORIAL = {
    # explicit in the brief / fiches
    "110246": ("beneficiaire_direct", "emploi à domicile (crédit d'impôt)"),
    "110203": ("beneficiaire_direct", "garde d'enfants de moins de 6 ans (crédit d'impôt)"),
    "120401": ("beneficiaire_direct", "abattement de 10 % sur les pensions et retraites"),
    "110201": ("beneficiaire_direct", "dons : réduction d'impôt (IR)"),
    "110102": ("beneficiaire_direct", "demi-part : parent isolé ayant élevé seul un enfant"),
    "110103": ("beneficiaire_direct", "demi-part : anciens combattants de plus de 74 ans"),
    "110104": ("beneficiaire_direct", "demi-part : contribuables invalides"),
    "110107": ("beneficiaire_direct", "quotient conjugal des veufs ayant des enfants à charge"),
    "110109": ("beneficiaire_direct", "demi-part : enfant ou personne invalide rattachée"),
    "110110": ("beneficiaire_direct", "demi-part : parents isolés"),
    "110101": ("beneficiaire_direct", "demi-part supplémentaire à partir du 3e enfant"),
    "110106": ("beneficiaire_direct", "rattachement d'un enfant majeur ou orphelin majeur"),
    "110306": ("beneficiaire_direct", "décote de l'impôt sur le revenu"),
    "140102": ("beneficiaire_direct", "Livret A"),
    "140101": ("beneficiaire_direct", "épargne-logement (PEL, CEL)"),
    "140103": ("beneficiaire_direct", "livret bleu"),
    "140104": ("beneficiaire_direct", "livret de développement durable (LDDS)"),
    "140105": ("beneficiaire_direct", "livret d'épargne populaire (LEP)"),
    "140106": ("beneficiaire_direct", "livret jeune"),
    "140123": ("beneficiaire_direct", "plan d'épargne populaire"),
    "140119": ("beneficiaire_direct", "assurance-vie et contrats de capitalisation"),
    "140120": ("beneficiaire_direct", "assurance-vie en unités de compte (contrats avant 2014)"),
    "120128": ("beneficiaire_direct", "PEA : rente viagère au dénouement"),
    "140117": ("beneficiaire_direct", "PEA : dividendes capitalisés"),
    "150708": ("beneficiaire_direct", "PEA : gains de cession"),
    "140109": ("beneficiaire_direct", "épargne salariale"),
    "150701": ("beneficiaire_direct", "épargne salariale : gains de cession"),
    "120108": ("beneficiaire_direct", "participation, intéressement, abondement"),
    "120146": ("beneficiaire_direct", "heures supplémentaires"),
    "120111": ("beneficiaire_direct", "titres-restaurant (part employeur)"),
    "120112": ("beneficiaire_direct", "chèques-vacances"),
    "120113": ("beneficiaire_direct", "frais de transport domicile-travail pris en charge"),
    "120202": ("beneficiaire_direct", "prestations familiales et AAH exonérées d'impôt (remplacées par l'AFU)"),
    "110215": ("beneficiaire_direct", "frais de scolarité (secondaire)"),
    "110242": ("beneficiaire_direct", "frais de scolarité (supérieur)"),
    "110213": ("beneficiaire_direct", "frais de dépendance et d'hébergement"),
    "50101": ("beneficiaire_direct", "taxe foncière : exonération des personnes âgées ou de condition modeste"),
    "210313": ("beneficiaire_direct", "prêt à taux zéro (crédit d'impôt versé aux banques, avantage pour l'emprunteur)"),
    "100112": ("beneficiaire_direct", "déduction des versements PERP / épargne retraite individuelle"),
    "150113": ("beneficiaire_direct", "plus-value de cession de la résidence principale (exonération)"),
    "150208": ("beneficiaire_direct", "abattement pour durée de détention : plus-values immobilières"),
    "520119": ("beneficiaire_direct", "dons de sommes d'argent en famille (31 865 €)"),
    "520203": ("beneficiaire_direct", "abattement sur les donations aux petits-enfants"),
    "520204": ("beneficiaire_direct", "abattement sur la résidence principale (succession)"),
    # VAT: the household bears it through prices
    "730213": ("prix_consommation", "TVA à 10 % sur les travaux dans les logements anciens"),
    "730223": ("prix_consommation", "TVA à 5,5 % sur les travaux de rénovation énergétique"),
    "730221": ("prix_consommation", "TVA à 10 % sur la restauration"),
    "730205": ("prix_consommation", "TVA à 10 % sur l'hébergement hôtelier"),
    "730231": ("prix_consommation", "TVA à 5,5 % sur les spectacles (théâtre, cinéma, concerts)"),
    "730214": ("prix_consommation", "TVA à 10 % sur les services à la personne"),
}
HOUSEHOLD_MIN_BENEFICIARIES = 1_000_000  # rule: nature « Ménages » and ≥ 1 M bénéficiaires


def _dates(v):
    n = parse_num(v)
    if n is not None:
        return int(n)
    t = (v or "").strip()
    return t or None


def _cost(sh_val):
    n = parse_num(sh_val)
    if n is not None:
        return clean(n, 3), None
    return None, cell_flag(sh_val)


def _idstr(v: str) -> str:
    return str(int(float(v)))


def _rows(sh: Sheet, first_row: int, key_col: int = 3):
    return [r for r in sh.rows[first_row:] if len(r) > key_col and r[key_col].strip()]


def build() -> dict:
    cr = Sheet.get("niches", "Chiffrages_R_solution")
    ch = Sheet.get("niches", "Chiffrages")
    ec = Sheet.get("niches", "Ech_ances")
    be = Sheet.get("niches", "B_n_ficiaires")
    ex = Sheet.get("niches", "Explication_d_taill")
    me = Sheet.get("niches", "M_thodologie")
    rj = Sheet.get("niches", "R_f_rences_juridiques")
    pr = Sheet.get("niches", "Programme_de_rattachement")
    sy = Sheet.get("niches", "Synth_se")

    CR = {_idstr(r[3]): r for r in _rows(cr, 6)}
    CH = {_idstr(r[3]): r for r in _rows(ch, 4)}
    EC = {_idstr(r[3]): r for r in _rows(ec, 4)}
    BE = {_idstr(r[3]): r for r in _rows(be, 2)}
    EX = {_idstr(r[3]): r for r in _rows(ex, 3)}
    ME = {_idstr(r[3]): r for r in _rows(me, 2)}
    RJ = {_idstr(r[3]): r for r in _rows(rj, 2)}
    PR = collections.defaultdict(list)
    for r in _rows(pr, 4):
        PR[_idstr(r[3])].append(r)
    ids = list(CR)  # sheet order (tax, then number)
    assert len(ids) == 465 and len(set(ids)) == 465
    for name, d in (("CH", CH), ("EC", EC), ("BE", BE), ("EX", EX), ("ME", ME), ("RJ", RJ), ("PR", PR)):
        assert set(d) == set(ids), name

    recs = []
    for i in ids:
        a, c_, e, b, x, m, j, p = CR[i], CH[i], EC[i], BE[i], EX[i], ME[i], RJ[i], PR[i]
        # cross-check 2024 cost between the two sheets
        v_cr, f_cr = _cost(a[8])
        v_ch, f_ch = _cost(c_[5])
        assert (v_cr, f_cr) == (v_ch, f_ch), (i, a[8], c_[5])
        c24, f24 = v_ch, f_ch
        c25, f25 = _cost(c_[6])
        c26, f26 = _cost(c_[7])
        label = ws(a[4])
        assert ws(c_[4]) == label and ws(e[4]) == label and ws(b[4]) == label, i
        tax, subcat, subsub = ws(a[0]), ws(a[1]), ws(a[2])
        nature = ws(b[5]).replace("\xa0", " ")
        count = parse_num(b[6])
        assert parse_num(a[7]) == count or (count is None and parse_num(a[7]) is None), (i, a[7], b[6])
        cat, rule, tags = classify(label, tax, subcat, nature)
        main_prog = [r for r in p if r[7] == "A titre principal"]
        assert len(main_prog) == 1, i
        sec_prog = [r for r in p if r[7] != "A titre principal"]
        fin_fg = _dates(a[6])
        supp_code = ws(a[12]) or None
        flags = {}
        for yr, fl in (("2024", f24), ("2025", f25), ("2026", f26)):
            if fl:
                flags[yr] = fl
        purpose = " | ".join(ws(t) for t in x[5:] if t.strip())
        rec = {
            "id": i,
            "tax": tax,
            "subcategory": subcat or None,
            "subsubcategory": subsub or None,
            "label_fr": label,
            "beneficiaries": {"type": nature, "count": clean(count, 0) if count is not None else None,
                              "count_flag": "non_determine" if count is None and b[6].strip() == "Non déterminé" else None},
            "cost_2024_meur": c24, "cost_2025_meur": c25, "cost_2026_meur": c26,
            "cost_flags": flags or None,
            "legal_ref": {"reference_norm": ws(j[5]) or None, "code": ws(j[6]).replace("\xa0", " ") or None, "reference": ws(j[7]).lstrip("# ").strip() or None},
            "programme": {"code": int(float(main_prog[0][5])) if main_prog[0][5].strip() else None, "label_fr": ws(main_prog[0][6]),
                          "secondary": [{"code": int(float(r[5])) if r[5].strip() else None, "label_fr": ws(r[6])} for r in sec_prog] or None},
            "purpose_fr": purpose or None,
            "dates": {"creation": _dates(a[5]), "last_modified": _dates(e[6]), "fin_fait_generateur": fin_fg,
                      "fin_incidence_budgetaire": _dates(e[8]), "suppression": _dates(e[9]),
                      "motif_fr": ws(e[11]) or None},
            "eteint_avant_2025": isinstance(fin_fg, int) and fin_fg <= 2024,
            "eteint_fin_2025": isinstance(fin_fg, int) and fin_fg == 2025,
            "reliability": ws(m[5]) or None,
            "method_fr": ws(m[6]) or None,
            "category": cat, "category_rule": rule, "category_tags": tags,
            "resolution": {
                "suppression_code": supp_code,
                "pct_effet_net": clean(parse_num(a[10]), 4) if parse_num(a[10]) is not None else None,
                "pct_solde_brut": clean(parse_num(a[11]), 4) if parse_num(a[11]) is not None else None,
                "gage_csg_meur": clean(parse_num(a[13]), 3) if parse_num(a[13]) is not None else None,
                "solde_po_meur": clean(parse_num(a[14]), 3) if parse_num(a[14]) is not None else None,
                "typologie_se": ws(a[15]) or None,
                "type_dispositif": ws(a[16]) or None,
                "cost_2024_avec_tva_apu_meur": clean(parse_num(a[9]), 3) if parse_num(a[9]) is not None else None,
            },
        }
        recs.append(rec)

    # --- Résolution suppression codes
    by_code = collections.Counter(r["resolution"]["suppression_code"] for r in recs)
    assert by_code == {"Oui": 359, None: 82, "En 3 ans": 11, "Fusion CI IR": 7, "Flux OM": 6}, by_code
    # blank code == fait générateur éteint at the end of 2025 (fin <= 2025)
    blank = {r["id"] for r in recs if r["resolution"]["suppression_code"] is None}
    ext25 = {r["id"] for r in recs if r["eteint_avant_2025"] or r["eteint_fin_2025"]}
    assert blank == ext25, (len(blank), len(ext25))
    for r in recs:
        c = r["resolution"]["suppression_code"]
        r["resolution"]["suppression_fr"] = {
            "Oui": "supprimée dès l'entrée en vigueur (suppression immédiate)",
            "En 3 ans": "supprimée progressivement en trois ans",
            "Fusion CI IR": "fusionnée dans l'aide fondamentale (crédits d'impôt sur le revenu)",
            "Flux OM": "outre-mer : refondue (« flux OM » dans le classeur)",
            None: "sans objet : fait générateur éteint fin 2025 ou avant",
        }[c]
    # --- Household flags
    ids_set = set(ids)
    for r in recs:
        kind = reason = None
        if r["id"] in HOUSEHOLD_EDITORIAL:
            kind, reason = HOUSEHOLD_EDITORIAL[r["id"]]
            reason = "liste éditoriale : " + reason
        elif r["beneficiaries"]["type"] == "Ménages" and (r["beneficiaries"]["count"] or 0) >= HOUSEHOLD_MIN_BENEFICIARIES:
            kind, reason = "beneficiaire_direct", f"règle : nature « Ménages » et au moins {HOUSEHOLD_MIN_BENEFICIARIES:,} bénéficiaires".replace(",", " ")
        r["household_common"] = kind is not None
        r["household_common_kind"] = kind
        r["household_common_reason"] = reason
    editorial_in_465 = {k for k in HOUSEHOLD_EDITORIAL if k in ids_set}

    # --- aggregates
    total24 = clean(sum(r["cost_2024_meur"] or 0 for r in recs), 3)
    total25 = clean(sum(r["cost_2025_meur"] or 0 for r in recs), 3)
    total26 = clean(sum(r["cost_2026_meur"] or 0 for r in recs), 3)
    assert total24 == 89406, total24
    assert abs(sy.num("D7") * 1000 - total24) < 1e-6

    def agg(key_fn, extra=None):
        g = collections.OrderedDict()
        for r in recs:
            k = key_fn(r)
            d = g.setdefault(k, {"count": 0, "cost_2024_meur": 0.0, "cost_2025_meur": 0.0, "cost_2026_meur": 0.0, "household_common_count": 0, "household_common_cost_2024_meur": 0.0})
            d["count"] += 1
            for y in ("2024", "2025", "2026"):
                d[f"cost_{y}_meur"] += r[f"cost_{y}_meur"] or 0
            if r["household_common"]:
                d["household_common_count"] += 1
                d["household_common_cost_2024_meur"] += r["cost_2024_meur"] or 0
        out = []
        for k, d in sorted(g.items(), key=lambda kv: (-kv[1]["cost_2024_meur"], str(kv[0]))):
            out.append({"key": k, **{kk: (clean(vv, 3) if isinstance(vv, float) else vv) for kk, vv in d.items()}})
        return out

    by_tax = agg(lambda r: r["tax"])
    by_cat = agg(lambda r: r["category"])
    by_benef = agg(lambda r: r["beneficiaries"]["type"])
    by_supp = agg(lambda r: r["resolution"]["suppression_code"] or "sans objet")
    assert sum(x["count"] for x in by_tax) == 465
    assert {x["key"]: x["count"] for x in by_tax} == {
        "Impôt sur le revenu": 170, "Impôt sur le revenu et impôt sur les sociétés": 53, "Droits d'enregistrement et de timbre": 50, "Taxe sur la valeur ajoutée": 46,
        "Impôts locaux": 42, "Impôt sur les sociétés": 38, "Accise sur les énergies": 37, "Autres droits": 23, "Autres impôts directs": 6}

    eteint_sum = clean(sum(r["cost_2024_meur"] or 0 for r in recs if r["eteint_avant_2025"]), 3)
    assert sum(1 for r in recs if r["eteint_avant_2025"]) == 47 and eteint_sum == clean(sy.num("D9") * 1000, 3), eteint_sum
    fin25 = [r for r in recs if r["eteint_fin_2025"]]
    fin25_sum = clean(sum(r["cost_2024_meur"] or 0 for r in fin25), 3)
    fin25_sum_tva = clean(sum(r["resolution"]["cost_2024_avec_tva_apu_meur"] or 0 for r in fin25), 3)
    assert len(fin25) == 35

    # --- provisions déclassées (modalités de calcul de l'impôt)
    mo = Sheet.get("niches", "Modalit_s_de_calcul_de_l_imp_t")
    prov = []
    for r in _rows(mo, 3):
        i = _idstr(r[3])
        label = ws(r[4])
        tax = ws(r[0])
        subcat = ws(r[1])
        costs = [_cost(r[6]), _cost(r[7]), _cost(r[8])]
        flags = {y: fl for y, (v, fl) in zip(("2024", "2025", "2026"), costs) if fl}
        kind = reason = None
        if i in HOUSEHOLD_EDITORIAL:
            kind, reason = HOUSEHOLD_EDITORIAL[i]
            reason = "liste éditoriale : " + reason
        prov.append({
            "id": i, "tax": tax, "subcategory": subcat or None, "subsubcategory": ws(r[2]) or None, "label_fr": label,
            "declassement_year": _dates(r[5]),
            "cost_2024_meur": costs[0][0], "cost_2025_meur": costs[1][0], "cost_2026_meur": costs[2][0], "cost_flags": flags or None,
            "dates": {"creation": _dates(r[9]), "last_modified": _dates(r[10]), "fin_fait_generateur": _dates(r[11]), "fin_incidence_budgetaire": _dates(r[12]),
                      "suppression": _dates(r[13]), "motif_fr": ws(r[15]) or None},
            "legal_ref": {"code": ws(r[16]).replace("\xa0", " ") or None, "reference": ws(r[17]) or None},
            "household_common": kind is not None, "household_common_kind": kind, "household_common_reason": reason,
        })
    assert len(prov) == 81, len(prov)
    for k in HOUSEHOLD_EDITORIAL:
        assert k in ids_set or k in {p["id"] for p in prov}, f"editorial id {k} not found"

    # --- 21 reduced VAT rates (aggregate only)
    tva_n, tva_md = int(sy.num("C11")), clean(sy.num("D11"), 6)
    assert tva_n == 21

    # headline per-niche checks vs source-analysis
    by_id = {r["id"]: r for r in recs}
    assert by_id["110246"]["cost_2024_meur"] == 6420 and by_id["120401"]["cost_2024_meur"] == 4803
    assert by_id["110201"]["cost_2024_meur"] == 1990 and by_id["110203"]["cost_2024_meur"] == 1737
    assert [by_id[k]["cost_2024_meur"] for k in ("110110", "110102", "110104", "110103")] == [849, 674, 523, 493]
    assert by_id["140102"]["cost_2024_meur"] == 950
    dec = next(p for p in prov if p["id"] == "110306")
    assert (dec["cost_2024_meur"], dec["cost_2026_meur"]) == (7652, 7618)
    res150113 = next(p for p in prov if p["id"] == "150113")
    assert res150113["cost_2024_meur"] == 955

    top10 = sorted(recs, key=lambda r: -(r["cost_2024_meur"] or 0))[:10]

    return {
        "meta": {
            "title_fr": "Les 465 niches fiscales recensées au PLF 2026",
            "source": sy.source("A1:D14") | {"also": [cr.ref("A5:Q471"), ch.ref("A3:H469"), ec.ref(), be.ref(), ex.ref(), me.ref(), rj.ref(), pr.ref()],
                                            "origin": "PLF 2026, Évaluation des voies et moyens, tome II, annexe 3 — Dépenses fiscales"},
            "origin_url": "https://www.budget.gouv.fr/documentation/documents-budgetaires-lois/exercice-2026/plf-2026",
            "tier": "donnee",
            "units": {"cost_*_meur": "millions d'euros (M€) : 2024 réalisé, 2025 prévision de réalisation, 2026 prévision"},
            "counts": {"niches": 465, "provisions_calcul_impot": 81, "taux_reduits_tva_hors_niches": 21, "total_niches_et_taux_reduits": int(sy.num("C12"))},
            "totals": {"cost_2024_meur": total24, "cost_2025_meur": total25, "cost_2026_meur": total26,
                       "cost_2024_avec_tva_apu_meur": clean(sy.num("D8") * 1000, 3), "total_486_cost_2024_meur": clean(sy.num("D12") * 1000, 3)},
            "cost_markers": {"aucun_effet": "« - » : aucun effet budgétaire", "epsilon": "« ε » : moins de 0,5 M€, non calculé", "nc": "« nc » : non calculé"},
            "non_determine_beneficiaries": "« Non déterminé » dans la source → count = null et count_flag = non_determine.",
            "category_rule": "1 catégorie par niche, première règle qui s'applique : outre-mer > TVA > épargne > logement > ménages | entreprises (selon la nature des bénéficiaires) > autre ; category_tags liste toutes les règles qui s'appliquent. Les expressions régulières sont dans pipeline/b_niches.py.",
            "household_common_rule": f"household_common = vrai si l'id figure dans la liste éditoriale (emploi à domicile, garde d'enfants, abattement 10 % pensions, dons, demi-parts, décote, livrets, assurance-vie, PEA, épargne salariale, heures supplémentaires, titres-restaurant, TVA des travaux et de la restauration…) OU si la nature des bénéficiaires est « Ménages » avec au moins 1 000 000 de bénéficiaires. household_common_kind : beneficiaire_direct | prix_consommation (TVA payée via les prix).",
            "typologie_se": "Colonne « S / E » du classeur, sans légende : S regroupe 16 exonérations salariales (somme des gages = 4,80 Md€ = « dont exonérations salariales » de Détail Niches) ; E regroupe 12 exonérations d'épargne et de produits financiers (somme des gages = 2,75 Md€). Interprétation par recoupement, non écrite dans le classeur.",
            "eteint": {
                "avant_2025": {"nombre": 47, "cout_2024_meur": eteint_sum, "regle": "fin du fait générateur ≤ 2024 (= 47 niches, 3,775 Md€ de la feuille Synthèse)"},
                "fin_2025": {"nombre": 35, "cout_2024_meur": fin25_sum, "cout_2024_avec_tva_apu_meur": fin25_sum_tva,
                             "regle": "fin du fait générateur = 2025 (35 niches) ; la feuille Synthèse indique 1,2987 Md€ pour ce groupe, contre " + f"{fin25_sum:g} M€ en réalisation 2024 dans Chiffrages Résolution (écart documenté dans DISCREPANCIES.md)"},
                "suppression_sans_objet": "les 82 lignes sans code de suppression sont exactement celles dont le fait générateur s'éteint en 2025 ou avant",
            },
        },
        "niches": recs,
        "provisions_calcul_impot": prov,
        "taux_reduits_tva_hors_niches": {
            "count": tva_n, "cost_2024_meur": clean(tva_md * 1000, 3), "cost_2024_md": tva_md,
            "estimation": "Projection sur 2024 au pro-rata de la TVA dans les comptes nationaux de l'Insee ; estimation du CPO (février 2023, p. 32) : 30 Md€ en 2021 dont 20 Md€ sur l'eau et l'alimentation.",
            "liste_individuelle": None,
            "liste_note": "Les sources du dépôt ne publient pas la liste des 21 taux réduits (seulement leur nombre et leur coût agrégé) ; les taux visés par l'amendement PLF-P1 n° 21 sont 10 %, 5,5 % et 2,1 % (alimentation : 10 % au 1er juillet 2028, 15 % en 2029, 20 % en 2030).",
            "source": sy.source("B11:D14"),
        },
        "synthese": {
            "par_impot": by_tax, "par_categorie": by_cat, "par_beneficiaires": by_benef, "par_suppression": by_supp,
            "top10_cout_2024": [{"id": r["id"], "label_fr": r["label_fr"], "cost_2024_meur": r["cost_2024_meur"], "category": r["category"]} for r in top10],
            "household_common": {"count": sum(1 for r in recs if r["household_common"]),
                                 "cost_2024_meur": clean(sum(r["cost_2024_meur"] or 0 for r in recs if r["household_common"]), 3),
                                 "editorial_ids_in_465": sorted(editorial_in_465),
                                 "editorial_ids_in_provisions": sorted(k for k in HOUSEHOLD_EDITORIAL if k not in ids_set)},
            "cout_2026_vs_exposé": {"somme_lignes_2026_meur": total26, "exposé_plf_p1_1_md": 79.5,
                                    "note": "L'exposé de PLF-P1 n° 1 cite « un coût prévisionnel de 79,5 milliards d'euros en 2026 » ; la somme des 465 lignes 2026 du classeur vaut 79,613 Md€ (ε et nc comptés pour 0)."},
        },
    }
