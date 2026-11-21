#!/usr/bin/env python3
"""Validate site/src/data/*.json (built from the November 2026 version of the plan): totals reconcile, every fact is sourced, quotes are verbatim,
cross-file figures agree, every discrepancy is documented.

    python3 -I pipeline/validate.py

Exit code 0 when no FAIL.  WARN lines are *documented discrepancies of the sources* (each has a
code D01…D34 that must have a section in pipeline/DISCREPANCIES.md) — they are not pipeline errors.
"""
from __future__ import annotations

import datetime
import json
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import eurostat  # noqa: E402
from amend import LIASSES, all_amendments, quote_in_amendment  # noqa: E402
from lib import OUT_DIR, ROOT, SHEET_TITLES, WORKBOOKS, Sheet, fr, load_reform_params, quote_in, rp  # noqa: E402

TIERS = {"loi", "annonce", "donnee", "calcul"}
KINDS = {"workbook", "amendment", "site", "insee", "eurostat", "dgafp", "legifrance", "reglementation", "fipeco", "calcul"}
TOL = 1e-6


class Report:
    def __init__(self):
        self.rows: list[tuple[str, str, str]] = []

    def ok(self, area, msg):
        self.rows.append(("OK", area, msg))

    def warn(self, code, msg):
        self.rows.append(("WARN", code, msg))

    def fail(self, area, msg):
        self.rows.append(("FAIL", area, msg))

    def check(self, cond, area, msg_ok, msg_fail=None):
        if cond:
            self.ok(area, msg_ok)
        else:
            self.fail(area, msg_fail or msg_ok)
        return cond

    @property
    def fails(self):
        return [r for r in self.rows if r[0] == "FAIL"]


def close(a, b, tol=TOL):
    return abs(a - b) <= tol


def load():
    data = {}
    for p in sorted(OUT_DIR.glob("*.json")):
        with open(p, encoding="utf-8") as fh:
            data[p.name] = json.load(fh)
    return data


# --------------------------------------------------------------------------------------------
# facts
# --------------------------------------------------------------------------------------------
_WB_BY_FILE = {v[1]: k for k, v in WORKBOOKS.items()}
_SLUG_BY_TITLE = {v: k for k, v in SHEET_TITLES.items()}


def _reread_cell(ref: str):
    """'Fichier.xlsx › Feuille › D50' -> raw number from the CSV dump, or None."""
    parts = [p.strip() for p in ref.split("›")]
    if len(parts) < 3 or parts[0] not in _WB_BY_FILE:
        return None
    wb = _WB_BY_FILE[parts[0]]
    slug = _SLUG_BY_TITLE.get(parts[1], parts[1])
    cell = parts[2].split()[0].split(",")[0]
    if not re.fullmatch(r"[A-Z]+\d+", cell):
        return None
    return Sheet.get(wb, slug).num(cell)


MUST_HAVE = [
    "dep_total_2024_md", "dep_par_foyer_manifeste_eur", "dep_par_foyer_jour_eur", "eu_dep_pib_fr_2024_pct", "eu_deficit_fr_2024_pct", "po_pib_2024_pct", "po_pib_cible_pct",
    "etat_ministeres_avant", "etat_ministeres_apres", "agences_etat_avant", "agences_etat_apres", "impots_nombre_manifeste", "niches_nombre", "niches_total_nombre", "niches_total_md",
    "cerfa_nombre_manifeste", "droit_mots_2026", "droit_mots_manifeste", "fp_effectifs_2023_k", "postes_publics_fermes_manifeste", "eco236_total_md", "eco236_total_eur_foyer",
    "actifs_a_restituer_md", "actifs_manifeste_md", "va_heure_total_eur", "va_heure_etat_eur", "va_heure_capital_eur", "va_heure_salaire_net_eur", "eu_revenu_median_fr_eur", "eu_revenu_median_ch_eur",
    "csg_crds_activite_md", "afu_adulte_eur_an", "ir_taux_unique_pct", "credits_retires_cp_md",
]


def check_facts(R: Report, facts: dict):
    area = "facts"
    R.check(len(facts) >= 300, area, f"{len(facts)} facts")
    bad = []
    for fid, f in facts.items():
        errs = []
        if not re.fullmatch(r"[a-z][a-z0-9_]*", fid):
            errs.append("id format")
        for k in ("value", "unit", "label_fr", "year", "source", "tier"):
            if k not in f:
                errs.append(f"missing {k}")
        if errs:
            bad.append((fid, errs))
            continue
        if f["value"] is None:
            errs.append("value is null")
        if not isinstance(f["unit"], str) or not f["unit"].strip():
            errs.append("unit")
        if not isinstance(f["label_fr"], str) or not f["label_fr"].strip():
            errs.append("label_fr")
        if f["tier"] not in TIERS:
            errs.append(f"tier {f['tier']}")
        if f["year"] is not None and not isinstance(f["year"], int):
            errs.append("year type")
        s = f["source"]
        if s.get("kind") not in KINDS:
            errs.append(f"source.kind {s.get('kind')}")
        if not s.get("ref"):
            errs.append("source.ref empty")
        if s.get("kind") == "calcul":
            if f["tier"] != "calcul":
                errs.append("calcul source but tier != calcul")
            if "inputs" not in s or not isinstance(s["inputs"], list):
                errs.append("calcul without inputs")
            else:
                for i in s["inputs"]:
                    if i not in facts:
                        errs.append(f"calcul input {i} unknown")
            if not f.get("note"):
                errs.append("calcul without formula note")
        else:
            if not s.get("url"):
                errs.append("source.url empty")
            if f["tier"] == "calcul":
                errs.append("tier calcul with non-calcul source")
        if s.get("kind") == "amendment" and "liasse" in s:
            if not quote_in_amendment(s["liasse"], s["number"], s["quote"]):
                errs.append("amendment quote not found")
        elif s.get("kind") == "site":
            if not s.get("quote") or not quote_in(s["page"], s["quote"]):
                errs.append("site quote not found")
        elif s.get("kind") == "eurostat" and "snapshot" in s:
            # value taken from the Eurostat API snapshot of data/eurostat/ (see eurostat.py)
            snap = s["snapshot"]
            raw = eurostat.value(snap["key"], snap["geo"], snap["year"])
            if raw is None:
                errs.append("snapshot value missing")
            elif snap["updated"] != eurostat.updated(eurostat.dataset_of(snap["key"])):
                errs.append("snapshot vintage changed")
            elif abs(f["value"] - raw * s.get("scale", 1)) > 0.05 + 1e-9:
                errs.append(f"value {f['value']} != snapshot {raw}")
        elif s.get("kind") in ("workbook", "insee", "eurostat", "dgafp", "legifrance") and not f.get("verified_by"):  # verified_by : lu dans la source officielle, hors classeur
            raw = _reread_cell(s["ref"].split(" — repris dans ")[-1])
            if raw is None:
                errs.append("cell not re-readable")
            elif isinstance(f["value"], (int, float)):
                if not any(abs(f["value"] - raw * sc) <= 1e-5 * max(1.0, abs(raw * sc)) + 5e-7 for sc in (1, 100, 0.001)):
                    errs.append(f"value {f['value']} != cell {raw}")
        for c in f.get("conflicts", []):
            for j in c["with"]:
                if j not in facts:
                    errs.append(f"conflict with unknown {j}")
                elif not any(cc["group"] == c["group"] and fid in cc["with"] for cc in facts[j].get("conflicts", [])):
                    errs.append(f"conflict {c['group']} not reciprocal with {j}")
        if errs:
            bad.append((fid, errs))
    R.check(not bad, area, f"all {len(facts)} facts: value/unit/label/tier/source present; calcul inputs exist; quotes verbatim; workbook cells re-read",
            f"{len(bad)} facts invalid, e.g. {bad[:5]}")
    missing = [i for i in MUST_HAVE if i not in facts]
    R.check(not missing, area, f"{len(MUST_HAVE)} headline facts present", f"missing headline facts: {missing}")
    groups = {}
    for fid, f in facts.items():
        for c in f.get("conflicts", []):
            groups.setdefault(c["group"], set()).add(fid)
    R.check(all(len(v) >= 2 for v in groups.values()), area, f"{len(groups)} conflict groups, each with ≥ 2 members (conflict=true on {sum(1 for f in facts.values() if f.get('conflict'))} facts)")
    tiers = {}
    for f in facts.values():
        tiers[f["tier"]] = tiers.get(f["tier"], 0) + 1
    R.ok(area, "tiers: " + ", ".join(f"{k}={v}" for k, v in sorted(tiers.items())))
    return groups


# --------------------------------------------------------------------------------------------
# page files
# --------------------------------------------------------------------------------------------
def check_cofog(R, d, facts):
    area = "depenses-cofog"
    tree = d["tree"]
    total = tree["value_md"]
    R.check(close(total, 1671.794), area, "total 1 671,794 Md€")
    worst = 0.0
    n_internal = 0

    def walk(node):
        nonlocal worst, n_internal
        ch = node.get("children")
        if ch:
            n_internal += 1
            s = sum(c["value_md"] for c in ch)
            if node["level"] == 0:
                return_residual = total - s
            else:
                worst = max(worst, abs(s - node["value_md"]))
            for c in ch:
                walk(c)

    walk(tree)
    R.check(worst <= 0.0031, area, f"children sum to parent for the {n_internal - 1} internal nodes below the root (max gap {worst:.3f} Md€)", f"gap {worst}")
    resid = round(total - sum(c["value_md"] for c in tree["children"]), 3)
    R.check(0 <= resid <= 0.006, area, f"root − sum(groups) = {resid} Md€ (documented residual)")
    if resid:
        R.warn("D02", f"COFOG : somme des 6 groupes du livre = {fr(total - resid, 3)} Md€, soit {fr(resid, 3)} Md€ sous le total INSEE (01.5 absent du graphique).")
    dv = d["checks"]["divisions_minus_total_md"]
    if dv:
        R.warn("D01", f"COFOG : somme des 10 divisions INSEE = total + {fr(dv, 3)} Md€ (arrondi de la source).")
    inferred = [n["id"] for g in tree["children"] for n in g["children"] if n.get("mapping_inferred")]
    if inferred:
        R.warn("D03", f"COFOG : rattachement déduit de l'arithmétique pour {inferred}.")
    flat_leaves = [r for r in d["flat"] if r["is_leaf"]]
    R.check(abs(sum(r["value_md"] for r in flat_leaves) - (total - resid)) < 0.0035 + 1e-9, area, f"flat table: {len(d['flat'])} rows, {len(flat_leaves)} leaves sum to the tree total")
    R.check(close(facts["dep_total_2024_md"]["value"], total), area, "fact dep_total_2024_md = tree total")
    sec = next(g for g in tree["children"] if g["id"] == "securite")
    R.check(close(facts["dep_groupe_securite_2024_md"]["value"], sec["value_md"], 1e-6), area, "fact dep_groupe_securite_2024_md = tree group")
    R.check(len(d["cofog_divisions"]) == 10 and len(d["cofog_subfunctions"]) == 69, area, "10 COFOG divisions, 69 sub-functions")


def check_europe(R, d, facts):
    area = "europe"
    sp = d["depenses_publiques_pib"]
    ct = [r for r in sp if r["kind"] == "country" and r["year"] == 2024]
    R.check(len(ct) == 30, area, f"{len(ct)} countries with spending 2024 + {len([r for r in sp if r['kind']=='aggregate' and r['year']==2024])} aggregates")
    R.check(sum(1 for r in sp if r["is_france"]) == 2 and sum(1 for r in sp if r["is_euro_area_reference"]) == 2, area, "France and euro-area (EA20) flagged in every table")
    pk = d["points_cles"]
    for fid, key in (("eu_dep_pib_fr_2024_pct", "france_depenses_pib_2024"), ("eu_dep_pib_fr_2025_pct", "france_depenses_pib_2025"), ("eu_deficit_fr_2024_pct", "france_solde_pib_2024"),
                     ("eu_revenu_median_fr_eur", "france_revenu_median_eur_2024"), ("eu_revenu_median_ch_eur", "suisse_revenu_median_eur_2024"), ("eu_dep_rang_fr_2024", "france_rang_depenses_2024")):
        R.check(close(facts[fid]["value"], pk[key]), area, f"fact {fid} = europe.json {key}")
    R.check(len(d["revenu_median_eur"]) == 33 and len(d["revenu_median_spa"]) == 33, area, "median income: 33 geos in € and in PPS")
    miss = sorted({(r["geo"], r["year"]) for r in sp + d["solde_public_pib"] if r["missing"]})
    if miss:
        R.warn("D06", f"Eurostat : valeur manquante (« : ») dans la source pour {miss} dans l'une des tables → null.")
    if pk["finlande_depenses_pib_2024"] > pk["france_depenses_pib_2024"]:
        R.warn("D05", f"« record mondial » : Finlande {fr(pk['finlande_depenses_pib_2024'], 1)} % > France {fr(pk['france_depenses_pib_2024'], 1)} % en 2024 (France {pk['france_rang_depenses_2024']}e sur 30).")
    eas = [a["geo"] for a in d["agregats"] if a["is_euro_area"]]
    if len(eas) > 1:
        R.warn("D07", f"Eurostat : {len(eas)} agrégats « zone euro » ({', '.join(sorted(eas))}) dans le classeur ; EA20 retenu comme référence.")


def check_etat(R, d, facts):
    area = "etat-partout"
    m = d["ministeres"]
    R.check(m["avant"] == 35 and m["apres"] == 7 and m["supprimes_net"] == 28 and len(m["detail"]) == 35 and m["supprimes_integralement"] + m["regroupes_dans_les_sept"] == 35, area,
            "ministries: 35 listed = 19 removed + 16 grouped into 7; 35 − 7 = 28")
    if m.get("grouping_inferred"):
        R.warn("D29", "Ministères : regroupement en 7 blocs déduit de la mise en page du graphique (colonnes alternées).")
    ag = d["agences"]
    R.check(ag["etat_avant"] == 1104 and ag["fermees"] + ag["internalisation"] + ag["autonomie"] == 1104 and ag["etat_apres"] == 303, area, "agencies: 746 + 55 + 303 = 1 104")
    R.check(ag["total_avec_locales"] == 24368, area, "agencies incl. local = 24 368")
    for fid, v in (("agences_etat_avant", ag["etat_avant"]), ("agences_etat_apres", ag["etat_apres"]), ("agences_fermees", ag["fermees"]), ("agences_total_avec_locales", ag["total_avec_locales"])):
        R.check(close(facts[fid]["value"], v), area, f"fact {fid} = file")
    tx = d["impots"]["recettes_2024"]
    R.check(close(tx["total_md"], 624.9) and close(sum(r["montant_2024_md"] for r in tx["table"] if r["level"] == 1), 624.9, 1e-6), area, "taxes 2024: top-level lines sum to 624,9 Md€")
    gaps = {k: v["gap_md"] for k, v in tx["children_sums_check"].items() if v["gap_md"]}
    if gaps:
        R.warn("D26", f"Impôts : les lignes « dont » ne partitionnent pas toujours le poste (écarts {gaps}).")
    mw = d["mots_de_loi"]
    R.check(len(mw["series"]) == 22 and mw["series"][0]["year"] == 2005 and mw["series"][-1]["year"] == 2026, area, "legal words: 22 years 2005-2026")
    R.check(all(close(r["legislatif_codifie"] + r["legislatif_non_codifie"], r["legislatif_total"], 0) and close(r["reglementaire_codifie"] + r["reglementaire_non_codifie"], r["reglementaire_total"], 0) for r in mw["series"]), area,
            "legal words: codified + non-codified = totals every year")
    R.check(close(facts["droit_mots_2026"]["value"], mw["series"][-1]["total"], 0), area, "fact droit_mots_2026 = series 2026")
    if mw["series_break_flags"]:
        R.warn("D22", "Mots de loi : rupture de série (réglementaire non codifié) " + ", ".join(f"{x['year']} ({fr(x['change_pct'], 1)} %)" for x in mw["series_break_flags"]) + ".")
    ef = d["effectifs_publics"]
    R.check(close(sum(v["total_milliers"] for v in ef["par_versant"].values()), ef["total_milliers"], 0.003) and close(sum(ef["par_statut"].values()), ef["total_milliers"], 0.003), area,
            "public workforce: versants and statuts sum to 5 803,862 k")
    R.check(close(sum(x["milliers"] for x in ef["etat"]), ef["par_versant"]["fpe"]["total_milliers"], 0.003), area, "State headcount chart (4 groups) = FPE 2 570,237 k")
    R.check(close(facts["fp_effectifs_2023_k"]["value"], ef["total_milliers"], 0.0005), area, "fact fp_effectifs_2023_k = file")
    pf = ef["postes_fermes"]
    if pf["check_apuc_plus_apul_vs_total"]:
        R.warn("D21", f"Postes fermés : APUC {fr(pf['apuc'])} + APUL {fr(pf['collectivites_apul'])} = {fr(pf['check_apuc_plus_apul'])} ≠ {fr(pf['total_apu'])} (écart {fr(pf['check_apuc_plus_apul_vs_total'])}).")
    rp = d["representation_democratique"]["steps"]
    R.check(all(close(s["pct_of_previous"], 51, 1e-6) for s in rp[1:]), area, "representation chain: each step = 51 % of the previous")
    R.check(d["niches"]["nombre_recensees_plf2026"] == 465 and d["niches"]["total_niches_et_taux_reduits"]["nombre"] == 486, area, "niches summary 465 / 486")


def check_plan(R, d, facts):
    area = "plan-flux"
    t = d["savings_table"]
    by = {r["id"]: r for r in t}
    R.check(len(t) == 26, area, "savings table: 26 rows")
    for key in ("md_par_an", "gain_annee_1_md", "gain_supp_annee_pleine_md"):
        worst = 0.0
        for r in t:
            kids = [k for k in t if k["parent_id"] == r["id"]]
            if kids:
                worst = max(worst, abs(sum(k[key] for k in kids) - r[key]))
        R.check(worst <= 1e-6, area, f"236 Md€ table: every parent = sum of its children for {key} (max gap {worst:.1e})")
    R.check(close(by["total"]["md_par_an"], 236.352699, 1e-6), area, "total 236,353 Md€ (Annexe Manuscrit!C3, version de novembre 2026)")
    R.check(all(abs(r["ecart_c_vs_e_plus_f_md"]) < 1e-6 for r in t) and d["savings_checks"]["rows_where_C_differs_from_E_plus_F"] == [], area, "236 Md€ table: C = E + F on all 26 rows (D08, résolu en novembre 2026)")
    R.check(close(facts["eco236_total_md"]["value"], by["total"]["md_par_an"]), area, "fact eco236_total_md = savings_table total")
    sk = d["sankey"]
    R.check(sk["balanced"] and close(sk["total_in_md"], sk["total_out_md"]), area, f"Sankey (par catégorie): in = out = {sk['total_in_md']} Md€")
    for n in sk["nodes"]:
        inflow = sum(l["value_md"] for l in sk["links"] if l["target"] == n["id"])
        outflow = sum(l["value_md"] for l in sk["links"] if l["source"] == n["id"])
        if n["layer"] == 0:
            R.check(close(outflow, n["value_md"], 1e-6), area, f"Sankey node {n['id']}: out = value")
        elif n["layer"] == 1:
            R.check(close(inflow, outflow, 1e-6), area, f"Sankey node {n['id']}: in = out")
        else:
            R.check(close(inflow, n["value_md"], 1e-6), area, f"Sankey node {n['id']}: in = value")
    sc = d["sankey_classeur"]
    R.check(sc["balanced"] and close(sc["total_in_md"], sc["total_out_md"]), area, f"Sankey du classeur (Input Capitalisation): in = out = {sc['total_in_md']} Md€ (114,46 + 121,938)")
    R.check(close(sk["destinations"]["salaire_net_md"], 114.46) and close(sc["parts"]["capitalisation_total"], 121.937699, 1e-5), area, "destinations: salaire net 114,46 ; capitalisation 121,938 (classeur)")
    rec = d["reconciliation"]
    resid = {r["id"]: r["md"] for r in rec["residuels"]}
    R.check(not resid.get("patrimoine_18_vs_18_209") and close(rec["totaux"]["annexe_manuscrit_colonne_C"], rec["totaux"]["annexe_manuscrit_E_plus_F"], 1e-6), area,
            f"236 Md€ : total colonne C = E + F = {fr(rec['totaux']['annexe_manuscrit_colonne_C'], 3)} (D08 résolu)")
    R.check(abs(rec["year_1_vs_flux"]["ecart_md"]) < 0.001, area, f"gain année 1 : Annexe Manuscrit {fr(rec['year_1_vs_flux']['annexe'], 4)} = feuille Flux {fr(rec['year_1_vs_flux']['flux'], 3)} (D09 résolu)")
    g236 = rec["graph236"]
    if abs(g236["ecart_vs_annexe_md"]) > 1e-6:
        R.warn("D39", f"Graph236 : total {fr(g236['total_md'], 3)} Md€ (D24) et patrimoine {fr(g236['rendement_actifs_md'], 3)} Md€ (D34) contre {fr(rec['totaux']['annexe_manuscrit_colonne_C'], 3)} et 17,553 dans l'Annexe Manuscrit (écart {fr(g236['ecart_vs_annexe_md'], 3)} Md€).")
    if resid.get("capitalisation_calcule_vs_affirme"):
        R.warn("D10", f"Sankey : capitalisation {fr(sk['destinations']['capitalisation_md_calcule'], 3)} (calculée) vs {fr(sk['destinations']['capitalisation_md_classeur'], 3)} Md€ (classeur) : résidu {fr(resid['capitalisation_calcule_vs_affirme'], 3)} Md€.")
    brk = d["savings_checks"]["web_rounding_breaks"]
    mis = d["savings_checks"]["web_vs_workbook_mismatches"]
    if mis:
        R.warn("D36", "Tableau des 236 Md€ de donnees.html non mis à jour : " + " ; ".join(f"{m['label_fr'][:46]} affiché {m['web_md']} vs {fr(m['workbook_md'], 3)} (classeur)" for m in mis) + ".")
    if brk:
        R.warn("D11", "Tableau web arrondi : " + " ; ".join(f"{b['id']} affiché {b['web_subtotal']} vs somme des lignes affichées {b['web_children_sum']} (classeur {fr(b['workbook_subtotal_md'], 3)})" for b in brk))
    va = d["valeur_ajoutee_horaire"]
    R.check(sum(p["eur_par_heure"] for p in va["parts"]) == va["total_eur_par_heure"] == 63, area, "value added per hour: 29 + 11 + 23 = 63")
    R.check(len(d["afu_courbe"]["serie"]) == 73 and len(d["afu_courbe"]["cas"]) == 5, area, "AFU curve: 73 points (0-72 000 €) + 5 cases, tax = 23 % verified on every point")
    R.warn("D31", "GraphIR : « Impôt brut à payer » est affiché avec le signe − (flux sortant) dans le classeur ; exporté en positif (impot_brut_eur).")
    R.check(close(facts["csg_crds_activite_md"]["value"], d["destinations"]["salaire_net"]["md_par_an"]), area, "fact csg_crds_activite_md = destination salaire net")
    R.check(close(facts["actifs_a_restituer_md"]["value"], d["destinations"]["actifs_a_restituer"]["total_md"]), area, "fact actifs_a_restituer_md = file")
    R.check(close(facts["po_pib_2024_pct"]["value"], d["prelevements_obligatoires"]["po_pib_2024_pct"]), area, "fact po_pib_2024_pct = file")
    R.warn("D28", "Coût net de l'aide fondamentale (402,0 Md€ brut − 135,3 Md€ de dépenses existantes fusionnées = 266,7 Md€) : aucune microsimulation (gagnants/perdants par décile) publiée dans les sources.")


def check_niches(R, d, facts):
    area = "niches"
    n = d["niches"]
    ids = [r["id"] for r in n]
    R.check(len(n) == 465 and len(set(ids)) == 465, area, "465 niches, unique ids")
    c24 = round(sum(r["cost_2024_meur"] or 0 for r in n), 3)
    R.check(close(c24, 89406, 1e-6), area, f"2024 cost sums to 89 406 M€ (= 89,406 Md€)")
    R.check(close(facts["niches_cout_2024_md"]["value"], c24 / 1000, 1e-6), area, "fact niches_cout_2024_md = sum of lines")
    R.check(all(r["category"] in {"ménages", "entreprises", "logement", "épargne", "TVA", "outre-mer", "autre"} for r in n), area, "every niche has one of the 7 coarse categories")
    R.check(close(sum(x["cost_2024_meur"] for x in d["synthese"]["par_categorie"]), c24, 1e-6) and sum(x["count"] for x in d["synthese"]["par_categorie"]) == 465, area, "category aggregates sum to the total")
    R.check(all(isinstance(r["household_common"], bool) for r in n), area, f"household_common set on every niche ({sum(1 for r in n if r['household_common'])} true)")
    R.check(len(d["provisions_calcul_impot"]) == 81, area, "81 provisions de calcul de l'impôt (hors 465)")
    R.check(d["taux_reduits_tva_hors_niches"]["count"] == 21, area, "21 reduced VAT rates (aggregate only)")
    pt = d["plan_texte"]
    byid = {r["id"]: r for r in n}
    R.check(all(r["resolution"]["plan_final"] in {"supprimee", "trois-ans", "aide-fondamentale", "outre-mer", "partielle", "maintenue", "eteinte"} for r in n) and sum(v["n_niches"] for v in pt["plan_final"].values()) == 465, area,
            "plan_final set on the 465 niches (text of PLF-P1 n° 1 over the authors' column)")
    tva = pt["tva"]
    R.check(tva["n_niches"] == 46 and [tva[k]["n_niches"] for k in ("nommees_iii_bis", "exonerations_regle_generale", "taux_non_nommes_maintenus", "partiellement_nommees", "outre_mer_hors_champ", "outre_mer_flux_om", "deja_eteintes")] == [22, 6, 6, 2, 2, 5, 3], area,
            "46 TVA niches: 22 named by III bis + 6 exemptions (general rule) + 6 rates kept by II 4° + 2 partly named + 2 overseas out of scope + 5 « Flux OM » + 3 extinct")
    R.check(pt["outre_mer"]["hors_champ"]["n_niches"] == 16 and pt["outre_mer"]["hors_champ"]["dont_oui_au_classeur"]["n_niches"] == 10, area,
            "16 overseas niches outside Am. 1 (II, last paragraph): 6 « Flux OM » + 10 « Oui » of the workbook")
    R.check((byid["110240"]["resolution"]["plan_final"], byid["120124"]["resolution"]["plan_final"], byid["60203"]["resolution"]["plan_final"]) == ("trois-ans", "supprimee", "trois-ans"), area,
            "110240 = trois-ans (Am. 8), 120124 = supprimée (IV.A), 60203 = trois-ans (agricultural, inferred)")
    R.check(byid["520110"]["resolution"]["plan_texte"]["groupe"] == "Cbis" and byid["110203"]["resolution"]["plan_texte"]["groupe"] == "E" and byid["110107"]["resolution"]["plan_texte"]["groupe"] == "C", area,
            "Pacte Dutreil = IV.C bis (1er janvier 2027), garde d'enfants = IV.E (par tiers), quotient conjugal = IV.C (IR 2028)")
    R.check(pt["ir_2028"]["n_niches"] >= 19, area, f"{pt['ir_2028']['n_niches']} IR niches fall under IV.C (impôt dû au titre de 2028)")
    flagged = sum(1 for r in n if r["cost_flags"])
    nulls = sum(1 for r in n if r["cost_2024_meur"] is None)
    R.ok(area, f"{flagged} niches carry a cost marker (ε / nc / -), {nulls} have a null 2024 cost")
    R.check(all(r["category_rule"] for r in n), area, "category_rule recorded for each niche")
    R.check(all(i in {r['id'] for r in n} | {p['id'] for p in d['provisions_calcul_impot']} for i in d['synthese']['household_common']['editorial_ids_in_465'] + d['synthese']['household_common']['editorial_ids_in_provisions']), area, "editorial household ids all exist")
    e = d["meta"]["eteint"]["fin_2025"]
    if abs(e["cout_2024_meur"] - 1298.731207) > 1:
        R.warn("D34", f"Niches au fait générateur éteint fin 2025 : {fr(e['cout_2024_meur'])} M€ en réalisation 2024 (Chiffrages Résolution) contre 1 298,73 M€ (Synthèse) ; avec la colonne « yc TVA APU » : {fr(e['cout_2024_avec_tva_apu_meur'], 3)} M€.")
    cmp = d["synthese"]["cout_2026_vs_exposé"]
    if abs(cmp["somme_lignes_2026_meur"] / 1000 - cmp["exposé_plf_p1_1_md"]) > 1e-6:
        R.warn("D20", f"Niches 2026 : somme des lignes {fr(cmp['somme_lignes_2026_meur'] / 1000, 3)} Md€ vs 79,5 Md€ de l'exposé de PLF-P1 n° 1 ; fiche Contribuable « 143 Md€ » vs 134,7 Md€ (486) vs 89,4 Md€ (465).")
    cf = pt["conflits_avec_le_classeur"]
    if cf:
        R.warn("D40", f"Niches : {len(cf)} niches pour lesquelles la colonne « Suppression » du classeur et le texte de PLF-P1 n° 1 (II, III, III bis, IV.A à F) donnent deux traitements (" + ", ".join(f"{c['id']} {c['plan_classeur']} → {c['plan_final']}" for c in cf[:6]) + f", …) ; {len(pt['lectures_inferees'])} lectures inférées par la nature du dispositif ({', '.join(x['id'] for x in pt['lectures_inferees'])}).")
    # D41 : qui paie les droits de mutation (PLF-P1 n° 19 et n° 20), citations vérifiées dans le texte
    from amend import quote_in_amendment
    q19 = ["le vendeur pour une vente, l’héritier pour une succession", "le vendeur acquitte 3 900 euros", "supportés par celui qui liquide la plus-value sur laquelle ils s’imputent"]
    q20 = ["des droits acquittés à titre d’acompte par le cédant en application du III de l’article 683", "lors de l’acquisition, intervenue à compter du 1er janvier 2027", "le droit de mutation payé à l’achat s’impute sur l’impôt dû à la revente"]
    R.check(all(quote_in_amendment("PLF-P1", 19, q) for q in q19) and all(quote_in_amendment("PLF-P1", 20, q) for q in q20), area, "D41 quotes found verbatim in PLF-P1 n° 19 and n° 20")
    R.warn("D41", "Droits de mutation : l'exposé de PLF-P1 n° 19 dit « le vendeur pour une vente » et que le vendeur acquitte 3 900 € ; le dispositif dit « supportés par celui qui liquide la plus-value sur laquelle ils s'imputent » ; le n° 20 (200 B) impute « les droits acquittés … par le cédant … lors de l'acquisition » (« payé à l'achat »).")
    R.warn("D30", "Niches : colonne « S / E » du classeur sans légende (S = exonérations salariales, E = épargne : interprétation par recoupement).")
    R.warn("D32", "TVA : la liste individuelle des 21 taux réduits non comptés comme niches n'est publiée dans aucune source (nombre et coût agrégé seulement).")


def check_agences(R, d, facts):
    area = "agences"
    mat = {r["id"]: r for r in d["matrice_sorts"]}
    ops = d["operateurs"]
    R.check(sum(o["n_entities"] for o in ops) == 434 == mat["operateurs_plf"]["total"], area, f"{len(ops)} operator lines = 434 operators")
    R.check(sum(w["n"] for w in d["sorts_agences_etat"]) == 1104 and [g["n"] for g in d["sorts_groupes"]] == [746, 55, 303], area, "fates of the 1 104 State agencies: 746 + 55 + 303")
    odac = d["organismes_odac"]
    R.check(len(odac) == 700 and sum(1 for x in odac if not x["already_counted_as_operator"]) == 328, area, "ODAC 700 organisms = 372 already operators + 328 hors PLF")
    R.check(sum(x["n_organisms"] for x in d["organismes_odal_categories"] if not x["already_counted_as_operator"]) == 23264, area, "ODAL categories: 23 264 local organisms")
    R.check(len(d["autorites_independantes"]) == 24 and len(d["commissions"]) == 324, area, "24 independent authorities, 324 commission lines")
    R.check(d["entites_dissoutes_loi"]["n"] == 337 == len(d["entites_dissoutes_loi"]["liste"]), area, "337 entities dissolved by PLF-P2 n° 25, numbered 1..337")
    R.check(close(facts["agences_dissoutes_loi"]["value"], 337, 0), area, "fact agences_dissoutes_loi = 337")
    R.check([x["n"] for x in d["entites_dissoutes_loi"]["liste"]] == list(range(1, 338)), area, "dissolution list numbering is contiguous")
    R.check(d["operateurs_totaux"]["etpt_lfi_2025"] == 479514 and d["operateurs_totaux"]["etpt_plf_2026"] == 478026, area, "operators' ETPT 479 514 (LFI 2025) / 478 026 (PLF 2026)")
    R.warn("D17", "Opérateurs : 431 (exposé PLF-P2 n° 25) vs 434 (classeur, matrice) vs 433 (somme citée par la source-analyse) ; ici 434 = somme des « Nb/cat. » des 180 lignes.")
    ct = d["commissions_totaux"]
    R.warn("D18", f"Agences : 746 fermetures du livre vs 337 entités nommées dans PLF-P2 n° 25 ; commissions : 318 (matrice et amendement) vs {ct['n']} lignes dont {ct['en_vigueur']} « en vigueur » (feuille Commissions R).")


def check_credits(R, d, facts):
    area = "credits-retires"
    ms = d["missions"]
    R.check(len(ms) == 23 and [m["amendment"] for m in ms] == list(range(1, 23)) + [40], area, "23 état B amendments (n° 1 à 22 et n° 40)")
    for m in ms:
        s_ae = sum(p["ae_retirees_eur"] for p in m["programmes"])
        s_cp = sum(p["cp_retirees_eur"] for p in m["programmes"])
        if abs(s_ae - m["ae_retirees_eur"]) > 1 or abs(s_cp - m["cp_retirees_eur"]) > 1:
            R.fail(area, f"n°{m['amendment']}: programme sums differ from total by more than 1 €")
        gap = m["ecart_somme_programmes_vs_total_eur"]
        if gap["ae"] or gap["cp"]:
            R.warn("D24", f"État B n° {m['amendment']} : somme des programmes − total publié = {gap} € (arrondi de la source).")
        if not m["effets"] or any(e["date"] not in ("2027-01-01", "2027-04-01", "2027-07-01") for e in m["effets"]):
            R.fail(area, f"n°{m['amendment']}: effect dates")
    T = d["meta"]["totals"]
    R.check(sum(m["ae_retirees_eur"] for m in ms) == T["ae_retirees_eur"] and sum(m["cp_retirees_eur"] for m in ms) == T["cp_retirees_eur"], area, "23 totals sum to the grand total")
    R.check(T["ae_retirees_eur"] == 24261621967 and T["cp_retirees_eur"] == 21034477811, area, "totals = TOTAUX rows summed in research/diff-2026-10-to-2026-11 § 3.7.1: 24 261 621 967 € AE / 21 034 477 811 € CP")
    R.check(all(not (m["ecart_somme_programmes_vs_total_eur"]["ae"] or m["ecart_somme_programmes_vs_total_eur"]["cp"]) for m in ms), area, "programme lines add up exactly to every TOTAUX row (D24, résolu en novembre 2026)")
    R.check(close(facts["credits_retires_cp_md"]["value"], T["cp_retirees_md"]), area, "fact credits_retires_cp_md = file")
    apl = ms[0]["programmes"][0]
    R.warn("D19", f"APL 2027 : exposé PLF-P2 n° 32 « 5,4 Md€ » vs état B n° 1 : {fr(apl['cp_retirees_md'], 3)} Md€ retirés du programme « Aide à l'accès au logement » (classeur : 5,4 + 10,7 Md€).")
    R.check(all(m["rang_par_cp"] >= 1 for m in ms) and sorted(m["rang_par_cp"] for m in ms) == list(range(1, 24)), area, "ranks by CP are 1..23")


def check_amendements(R, d, facts, themes):
    area = "amendements"
    am = d["amendements"]
    ids = [a["id"] for a in am]
    R.check(len(am) == 84 and len(set(ids)) == 84, area, "84 amendments, unique ids")
    cnt = {l: sum(1 for a in am if a["liasse"] == l) for l in LIASSES}
    R.check(cnt == {"PLF-P1": 35, "PLF-P2": 40, "PLFSS": 9}, area, f"35 + 40 + 9 ({cnt})")
    ok = True
    for a in am:
        try:
            for dt in a["dates"]:
                datetime.date.fromisoformat(dt["date"])
            if a["dates"]:
                assert a["effective_from"] <= a["effective_to"]
            assert a["theme"] in themes and a["resume_fr"].strip().endswith(".") and a["title_fr"] and a["objet_expose_fr"]
            assert re.fullmatch(r"https://france-resolution\.fr/amendements/Liasse_[A-Z_0-9]+\.pdf#page=\d+", a["pdf_url"])
            assert 1 <= a["pdf_page"] <= LIASSES[a["liasse"]]["pages"]
            assert a["pdf_page"] == all_amendments()[a["liasse"]][a["number"]]["page"], "pdf_page is the amendment's first page"
            for dt in a["dates"]:
                assert a["pdf_page"] <= dt["pdf_page"] <= all_amendments()[a["liasse"]][a["number"]]["page_end"], ("date page outside the amendment", dt)
                assert dt["pdf_url"].endswith(f"#page={dt['pdf_page']}")
        except Exception as e:  # noqa: BLE001
            ok = False
            R.fail(area, f"{a['id']}: {e!r}")
    if ok:
        R.ok(area, "every amendment: ISO dates, valid theme, summary sentence, title, PDF page link within the liasse")
    A = all_amendments()
    R.check(all(a["number"] in A[a["liasse"]] for a in am), area, "every record maps to a parsed amendment of the liasse")
    R.check(sum(1 for a in am if a["theme"] == "credits_etat") == 23, area, "23 amendments on theme credits_etat")
    R.check(sum(len(a["dates"]) for a in am) >= 100, area, f"{sum(len(a['dates']) for a in am)} dated effects (each verified verbatim at build time)")
    R.check(sum(m["n"] for m in d["meta"]["themes"]) == 84, area, "theme counts sum to 84")
    cards = d["meta"]["donnees_page_cards"]
    stale = {k: v for k, v in cards.items() if k != "_header_total" and not v["match"]}
    R.check(cards["_header_total"] == 84, area, "donnees.html header says 84 amendments")
    if stale:
        R.warn("D35", "Page « Données » des auteurs : cartes de liasses non mises à jour (" + " ; ".join(f"{k} : {v['n_amendements_page']} amendements · {v['n_pages_page']} pages affichés, {v['n_amendements_pdf']} · {v['n_pages_pdf']} dans le PDF" for k, v in stale.items()) + f") ; elles datent toutes du « {next(iter(cards.values()))['date_page_fr']} » alors que les PDF ont été générés les 17 et 18 novembre 2026 ; l'en-tête de la page dit {cards['_header_total']} amendements, la somme des cartes en donne {sum(v['n_amendements_page'] for k, v in cards.items() if k != '_header_total')}.")


def check_calendrier(R, d, amend_ids):
    area = "calendrier"
    ev = d["events"]
    R.check(len({e["id"] for e in ev}) == len(ev), area, f"{len(ev)} events, unique ids")
    bad = []
    for e in ev:
        try:
            datetime.date.fromisoformat(e["date"])
            assert e["tier"] in TIERS and e["source"]["quote"] and e["source"]["url"]
            lid0, n0 = e["amendments"][0]["liasse"], e["amendments"][0]["number"]
            pg = int(e["source"]["url"].rsplit("#page=", 1)[1])
            am0 = all_amendments()[lid0][n0]
            assert am0["page"] <= pg <= am0["page_end"], f"source page {pg} outside n° {n0} ({am0['page']}-{am0['page_end']})"
            assert quote_in_amendment(lid0, n0, e["source"]["quote"]), "event quote not verbatim in the first amendment of the event"
            for r in e["amendments"]:
                assert f"{r['liasse']}-{r['number']}" in amend_ids
        except Exception as x:  # noqa: BLE001
            bad.append((e["id"], repr(x)))
    R.check(not bad, area, "every event: ISO date, source quote and url, existing amendment refs", f"{bad[:3]}")
    dates = [e["date"] for e in ev]
    R.check(dates == sorted(dates), area, "events are in chronological order")
    ids = {e["id"] for e in ev}
    R.check(all(i in ids for j in d["jalons"] for i in j["event_ids"]), area, f"{len(d['jalons'])} milestones reference existing events")
    for t in d["trajectoires"]:
        steps = t["steps"]
        good = all(steps[i]["from"] <= (steps[i]["to"] or "9999") for i in range(len(steps))) and all(steps[i]["to"] is None or steps[i]["to"] < steps[i + 1]["from"] for i in range(len(steps) - 1))
        if not good:
            R.fail(area, f"trajectory {t['id']}: steps overlap or are unordered")
        for st in steps:
            for src in st.get("sources", []):
                am0 = all_amendments()[src["liasse"]][src["number"]]
                if not (am0["page"] <= src["page"] <= am0["page_end"]) or not quote_in_amendment(src["liasse"], src["number"], src["quote"]):
                    R.fail(area, f"trajectory {t['id']}: source page or quote outside the amendment")
        if not all(s.get("sources") for s in steps):
            R.fail(area, f"trajectory {t['id']}: a step has no verified quote")
    R.ok(area, f"{len(d['trajectoires'])} trajectories: ordered, non-overlapping, one verified quote per step")
    csg = next(t for t in d["trajectoires"] if t["id"] == "csg_crds_activite_2027")
    R.check(all(close(s["csg_pct"] + s["crds_pct"], s["total_pct"], 1e-9) for s in csg["steps"]), area, "CSG path: csg + crds = total at each step (9,7 → 8,1 → 6,5 → 4,8 → 3,2 → 1,6 → 0)")
    R.warn("D33", "Calendrier : taux de CRDS mensuel 2027 déduit (9,7 − 9,2 = 0,5) ; paliers de départ non écrits dans les amendements signalés hypothesis=true.")


def check_fiches(R, d, facts):
    area = "fiches"
    f = d["fiches"]
    R.check(len(f) == 18 and len({x["slug"] for x in f}) == 18, area, "18 fiches, unique slugs")
    R.check(all(x["gains"] or x["pertes"] for x in f), area, "every fiche has at least one gain or perte")
    R.check(all(x["population_fact_id"] in facts for x in f if x["population_fact_id"]), area, "population_fact_id values exist in facts.json")
    mism = d["meta"]["header_mismatch_slugs"]
    if mism:
        R.warn("D23", "Fiches : compte « gains » de l'en-tête ≠ éléments affichés pour " + ", ".join(f"{x['slug']} ({x['header_vs_listed']['gains_header']} annoncés, {x['header_vs_listed']['gains_listes_avec_sous_points']} + {len(x['comme_chacun_fr'])} « comme chacun » affichés)" for x in f if x["slug"] in mism) + ".")


def check_lifecycle(R, d):
    area = "lifecycle"
    R.check(len(d["by_age"]) == 86 and d["by_age"][0]["age"] == 0 and d["by_age"][-1]["age"] == 85, area, "86 ages (0-85)")
    exp = {"aide_fondamentale": 86, "compte_education": 19, "part_contributive_retraite": 22, "rendement_patrimoine": 86, "aide_handicap": 64, "epargne_retraite_serie_1": 22, "epargne_retraite_serie_2": 22}
    got = {s["id"]: s["n_values"] for s in d["series"]}
    R.check(got == exp, area, f"series lengths {got}")
    R.check(len(d["records"]) == sum(exp.values()), area, f"{len(d['records'])} tidy records")
    R.warn("D25", "GraphAFU : deux séries portent le libellé « Epargne retraite personnelle » (20 064 € et 6 600 € à partir de 64 ans), sens non documenté.")


def check_conflicts_from_facts(R, facts, data):
    """New conflicts of the November 2026 version, raised from the data (not typed)."""
    a, b = facts["impots_nombre_manifeste"]["value"], facts["impots_nombre_graphique_fusion"]["value"]
    if a != b:
        R.warn("D37", f"Nombre de prélèvements : « {a} impôts » (manifeste, page Propositions, fiches) contre « {b} prélèvements aujourd'hui » (titre du graphique « Fusion des impôts », novembre 2026).")
    lc = data["lifecycle.json"]
    aide_adulte = {r["age"]: r.get("aide_fondamentale") for r in lc["by_age"]}
    if aide_adulte[70] == facts["afu_adulte_eur_an"]["value"]:
        R.warn("D38", f"GraphAFU (« Solidarité au cours de la vie ») : aide fondamentale de {fr(aide_adulte[70])} € à 70 ans, sans la minoration de {fr(abs(facts['afu_pension_eur_an']['value']))} € que PLF-P1 n° 28 (version de novembre 2026) applique aux pensions de retraite liquidées avant 2028 (soit {fr(aide_adulte[70] + facts['afu_pension_eur_an']['value'])} € par an) ; la fiche Retraité ne la liste pas parmi les pertes.")


def check_static_warns(R):
    R.warn("D27", "Textes de loi : le « revenu net imposable » après réforme (déduction de 10 %, CSG) n'est pas défini ; l'abrogation de 150 U-II-1° (exonération de la résidence principale) découle de PLF-P1 n° 20 et n° 1 [inférence de la source-analyse] ; calendrier de l'abattement de 10 % sur les pensions déduit.")
    R.warn("D12", "Gain CSG/CRDS : 300 €/mois et 13 % (manifeste) vs 275,08 €/mois et 12,56 % (classeur) au salaire médian ; 180 € (fiche) vs 171,72 € au SMIC.")
    R.warn("D13", "« 600 €/mois » : flux du classeur vers la capitalisation ≈ 339 €/mois/foyer (30 M) ; lettres : « 25 % » en trois ans.")
    R.warn("D14", "« Quatre impôts » (manifeste) vs « 5 impôts » (lettres).")
    R.warn("D15", "AFU au SMIC : 550 € brut (exposé n° 28) vs ≈ 220 € net (fiche, GraphIR).")
    R.warn("D16", "« Foyer » : 29,5 / 30 / 31,0 M implicites (8 000 € / 600 Md€→20 000 € / 54 000 €) vs 40,2 M de foyers fiscaux.")
    R.warn("D04", "Dépenses publiques 2024 : Eurostat 57,0 % du PIB vs 57,26 % (total COFOG Insee ÷ PIB du classeur).")


def check_discrepancy_doc(R):
    p = ROOT / "pipeline" / "DISCREPANCIES.md"
    if not p.exists():
        R.fail("discrepancies", "pipeline/DISCREPANCIES.md missing")
        return
    txt = p.read_text(encoding="utf-8")
    documented = set(re.findall(r"^## (D\d{2})\b", txt, flags=re.M))
    emitted = {r[1] for r in R.rows if r[0] == "WARN"}
    undocumented = sorted(emitted - documented)
    R.check(not undocumented, "discrepancies", f"all {len(emitted)} warning codes are documented in DISCREPANCIES.md ({len(documented)} sections)", f"undocumented warning codes: {undocumented}")
    stale = sorted(documented - emitted)
    if stale:
        R.ok("discrepancies", f"documented but not raised in this run: {stale}")


def check_cross_files(R, data, facts):
    area = "cross-file"
    pairs = [
        ("niches_nombre", len(data["niches.json"]["niches"])),
        ("agences_etat_avant", data["agences.json"]["matrice_sorts"][0]["total"]),
        ("credits_retires_amendements_nombre", len(data["credits-retires.json"]["missions"])),
        ("eco236_total_eur_foyer", data["plan-flux.json"]["savings_table"][0]["eur_par_foyer_an"]),
    ]
    for fid, v in pairs:
        R.check(close(facts[fid]["value"], v, 1e-9), area, f"fact {fid} = {v} in its page file")
    R.check(facts["agences_dissoutes_loi"]["value"] == data["agences.json"]["entites_dissoutes_loi"]["n"], area, "agences_dissoutes_loi matches agences.json")
    R.check(facts["niches_menages_communes_nombre"]["value"] == data["niches.json"]["synthese"]["household_common"]["count"], area, "niches_menages_communes_nombre matches niches.json")


def check_reform_params(R, data, facts):
    """research/reform_parameters.json is an independent, hand-curated extract of the plan's parameters
    (retrieved 24 October 2026, i.e. the October version): every parameter it shares with the pipeline must agree
    with facts.json / the page files, except the ones the authors changed in November 2026, which are listed below
    with their October value (still asserted against the file) and the November value (asserted against the facts)."""
    area = "reform_parameters"
    params = load_reform_params()
    plan = data["plan-flux.json"]
    cal = {t["id"]: t for t in data["calendrier.json"]["trajectoires"]}
    pairs = [
        ("income_tax_and_fundamental_aid.afu_per_adult_per_year_eur", facts["afu_adulte_eur_an"]["value"], 1e-9),
        ("income_tax_and_fundamental_aid.afu_per_dependent_child_per_year_eur", facts["afu_enfant_eur_an"]["value"], 1e-9),
        ("income_tax_and_fundamental_aid.afu_supplement_invalidity_per_year_eur", facts["afu_invalidite_eur_an"]["value"], 1e-9),
        # the sign flipped in November 2026 (« majoré » → « minoré » de 3 300 €): same amount, compared in absolute value (facts.json now holds −3 300)
        ("income_tax_and_fundamental_aid.afu_supplement_pension_per_year_eur", facts["afu_pension_eur_an"]["value"], 1e-9),
        ("income_tax_and_fundamental_aid.flat_rate_on_net_taxable_income", plan["afu_courbe"]["taux_unique"], 1e-9),
        ("income_tax_and_fundamental_aid.break_even_income_single_adult_eur_per_year", facts["afu_seuil_equilibre_eur_an"]["value"], 0.005),
        ("aggregate_savings_workbook_Md_per_year.per_foyer_eur", plan["savings_table"][0]["eur_par_foyer_an"], 1e-9),
        ("macro_targets_workbook.GDP_2024_Md", facts["po_pib_2024_md"]["value"], 1e-6),
        ("macro_targets_workbook.PO_2024_Md", facts["po_2024_md"]["value"], 1e-6),
        ("macro_targets_workbook.PO_rate_2024", facts["po_pib_2024_pct"]["value"] / 100, 1e-6),
        ("public_employment_exit.jobs_closed_full_year", facts["emplois_etat_fermes_annee_pleine_loi"]["value"], 1e-9),
        ("public_employment_exit.etpt_ceiling_cut_2027", facts["emplois_etat_plafond_baisse_2027_loi"]["value"], 1e-9),
        ("public_employment_exit.etpt_ceiling_state_2027_total", facts["emplois_etat_plafond_apres_loi"]["value"], 1e-9),
        ("housing_aids.first_year_saving_Md", facts["apl_economie_2027_expose_md"]["value"], 1e-9),
        ("vat.normal_rate_pct", facts["tva_taux_normal_pct"]["value"], 1e-9),
    ]
    # parameters of the October extract that moved with the November 2026 workbooks: (October value in the file, November value in the facts)
    moved = [
        ("aggregate_savings_workbook_Md_per_year.total", 236.05466666666666, facts["eco236_total_md"]["value"], 236.352699),
        ("aggregate_savings_workbook_Md_per_year.gain_year1_Md", 127.35216666666668, facts["eco236_total_an1_md"]["value"], 129.4593),
        ("macro_targets_workbook.PO_target_Md", 1060.75436, facts["po_cible_md"]["value"], 1060.69536),
        ("macro_targets_workbook.PO_rate_target", 0.3632844823452858, facts["po_pib_cible_pct"]["value"] / 100, 0.36326428),
    ]
    bad = []
    for path, mine_oct, mine_nov, expect_nov in moved:
        if abs(rp(params, path) - mine_oct) > 1e-9:
            bad.append(f"{path}: October extract changed ({rp(params, path)} != {mine_oct})")
        if abs(mine_nov - expect_nov) > 1e-6:
            bad.append(f"{path}: facts.json = {mine_nov}, expected November value {expect_nov}")
    for path, mine, tol in pairs:
        theirs = rp(params, path)
        if abs(abs(theirs) - abs(mine)) > tol:
            bad.append(f"{path}: reform_parameters = {theirs}, pipeline = {mine}")
    R.check(not bad, area, f"{len(pairs)} parameters of research/reform_parameters.json (October extract) agree with facts.json / page files; {len(moved)} moved in November 2026 (asserted both ways)", "; ".join(bad))
    traj = rp(params, "csg_crds_on_earned_income.monthly_trajectory_2027")
    steps = cal["csg_crds_activite_2027"]["steps"]
    a = [(t["csg_pct"], t["crds_pct"], t["total_pct"]) for t in traj]
    b = [(t["csg_pct"], t["crds_pct"], t["total_pct"]) for t in steps]
    R.check(a == b, area, f"CSG/CRDS monthly path of reform_parameters.json = calendrier.json ({len(b)} steps)", f"CSG path differs: {a} vs {b}")


def check_manifest(R, data):
    import hashlib
    m = data["manifest.json"]["files"]
    bad = []
    for name, e in m.items():
        txt = (OUT_DIR / name).read_text(encoding="utf-8")
        if hashlib.sha256(txt.encode("utf-8")).hexdigest() != e["sha256"]:
            bad.append(name)
    R.check(not bad and len(m) == 12, "manifest", f"manifest.json sha256 matches the {len(m)} files on disk", f"stale files: {bad}")


def main(argv):
    R = Report()
    data = load()
    expected = ["agences", "amendements", "calendrier", "credits-retires", "depenses-cofog", "etat-partout", "europe", "facts", "fiches", "lifecycle", "manifest", "niches", "plan-flux"]
    missing = [e for e in expected if f"{e}.json" not in data]
    if missing:
        print("missing output files:", missing)
        return 1
    R.ok("files", f"{len(data)} JSON files parse")
    facts = data["facts.json"]
    check_facts(R, facts)
    check_cofog(R, data["depenses-cofog.json"], facts)
    check_europe(R, data["europe.json"], facts)
    check_etat(R, data["etat-partout.json"], facts)
    check_plan(R, data["plan-flux.json"], facts)
    check_niches(R, data["niches.json"], facts)
    check_agences(R, data["agences.json"], facts)
    check_credits(R, data["credits-retires.json"], facts)
    themes = {t["id"] for t in data["amendements.json"]["meta"]["themes"]}
    check_amendements(R, data["amendements.json"], facts, themes)
    check_calendrier(R, data["calendrier.json"], {a["id"] for a in data["amendements.json"]["amendements"]})
    check_fiches(R, data["fiches.json"], facts)
    check_lifecycle(R, data["lifecycle.json"])
    check_cross_files(R, data, facts)
    check_reform_params(R, data, facts)
    check_conflicts_from_facts(R, facts, data)
    check_static_warns(R)
    check_manifest(R, data)
    # determinism: a fresh in-memory build must equal what is on disk
    import build as _build
    fresh = _build.build_all()
    stale = [n for n, t in fresh.items() if (OUT_DIR / n).read_text(encoding="utf-8") != t]
    R.check(not stale, "determinism", f"fresh build identical to disk for {len(fresh)} files", f"files on disk differ from a fresh build: {stale} (run build.py)")
    check_discrepancy_doc(R)

    n_ok = sum(1 for r in R.rows if r[0] == "OK")
    print("=" * 100)
    print("VALIDATION REPORT")
    print("=" * 100)
    for lvl, area, msg in R.rows:
        if lvl == "OK":
            print(f"  OK    [{area}] {msg}")
    print("-" * 100)
    warns = sorted((r for r in R.rows if r[0] == "WARN"), key=lambda r: r[1])
    seen = set()
    for lvl, code, msg in warns:
        print(f"  WARN  [{code}] {msg}")
    for lvl, area, msg in R.rows:
        if lvl == "FAIL":
            print(f"  FAIL  [{area}] {msg}")
    print("-" * 100)
    print(f"  {n_ok} checks OK, {len(warns)} documented source discrepancies (WARN), {len(R.fails)} FAIL")
    return 1 if R.fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
