#!/usr/bin/env python3
"""
Executable reference of research/baseline/baseline-rules.md (French household baseline, law of 24 Oct 2026).

* Every number is read from research/baseline/parameters.json (single source of truth) via pv("a.b.c").
* Pure functions, no dependency (stdlib only) -> easy to port to TypeScript.
* `python3 scripts/baseline_reference.py --check` re-computes the 40 households of
  research/baseline/golden-cases.json (produced with OpenFisca-France by scripts/openfisca_golden.py) and prints the
  differences per component; exit code 1 if a difference exceeds the tolerance listed in TOL.

Known, documented gaps versus the oracle (see baseline-rules.md section 12): AF degressive complement uses our Rnc
(oracle base is ~20 EUR higher), PA when the APL barème changed within the last 3 months, IR/RNI rounding by OpenFisca.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, "..", "research", "baseline")
PARAMS = json.load(open(os.path.join(BASE, "parameters.json"), encoding="utf-8"))


def pv(path):
    node = PARAMS
    for k in path.split("."):
        node = node[k]
    return node["value"]


def r2(x, n=2):
    return round(x + 1e-12, n)


# ---------------------------------------------------------------------------------------------- salary
def salary_chain(brut, work_ratio=1.0, size_ge_50=False, at_mp=None, vm=0.0):
    pm = pv("general.pmss_monthly")
    t1 = min(brut, pm)
    t2 = max(0.0, min(brut, 8 * pm) - pm)
    e = "salary.employee."
    emp = {
        "vieillesse_plaf": pv(e + "vieillesse_plafonnee") * t1,
        "vieillesse_deplaf": pv(e + "vieillesse_deplafonnee") * brut,
        "agirc_arrco": pv(e + "agirc_arrco_t1") * t1 + pv(e + "agirc_arrco_t2") * t2,
        "ceg": pv(e + "ceg_t1") * t1 + pv(e + "ceg_t2") * t2,
        "cet": pv(e + "cet") * min(brut, 8 * pm) if brut > pm else 0.0,
    }
    cot_sal = sum(emp.values())
    c = "salary.csg_crds."
    base = pv(c + "base_abattement_factor") * min(brut, 4 * pm) + max(0.0, brut - 4 * pm)
    csg_ded = pv(c + "csg_deductible") * base
    csg_nd = pv(c + "csg_non_deductible") * base
    crds = pv(c + "crds") * base
    net_pay = brut - cot_sal - csg_ded - csg_nd - crds
    net_taxable = brut - cot_sal - csg_ded

    q = "salary.employer."
    b4 = min(brut, 4 * pm)
    er = {
        "maladie": pv(q + "maladie") * brut,
        "vieillesse_plaf": pv(q + "vieillesse_plafonnee") * t1,
        "vieillesse_deplaf": pv(q + "vieillesse_deplafonnee") * brut,
        "af": pv(q + "allocations_familiales") * brut,
        "at_mp": (pv(q + "at_mp_default") if at_mp is None else at_mp) * brut,
        "fnal": pv(q + "fnal_ge50") * brut if size_ge_50 else pv(q + "fnal_lt50") * t1,
        "csa": pv(q + "csa") * brut,
        "chomage": pv(q + "assurance_chomage") * b4,
        "ags": pv(q + "ags") * b4,
        "agirc_arrco": pv(q + "agirc_arrco_t1") * t1 + pv(q + "agirc_arrco_t2") * t2,
        "ceg": pv(q + "ceg_t1") * t1 + pv(q + "ceg_t2") * t2,
        "cet": pv(q + "cet") * min(brut, 8 * pm) if brut > pm else 0.0,
        "formation": (pv(q + "formation_ge11") if size_ge_50 else pv(q + "formation_lt11")) * brut,
        "apprentissage": pv(q + "taxe_apprentissage") * brut,
        "dialogue": pv(q + "contribution_dialogue_social") * brut,
        "versement_mobilite": vm * brut,
    }
    employer_gross = sum(er.values())

    # RGDU (réduction générale dégressive unique)
    smic_ref = work_ratio * pv("salary.rgdu.smic_reference_hourly") * pv("general.legal_monthly_hours")
    t_min = pv("salary.rgdu.t_min")
    t_delta = pv("salary.rgdu.t_delta_ge50") if size_ge_50 else pv("salary.rgdu.t_delta_lt50")
    if 0 < brut < pv("salary.rgdu.exit_threshold_in_smic") * smic_ref:
        x = max(0.0, 0.5 * (3 * smic_ref / brut - 1))
        coef = t_min + round(t_delta * x ** pv("salary.rgdu.power"), 4)
        coef = min(coef, t_min + t_delta)
    else:
        coef = 0.0
    rgdu = coef * brut
    return {
        "gross": brut, "employee_social_contributions": cot_sal, "csg_deductible": csg_ded,
        "csg_non_deductible": csg_nd, "crds": crds, "net_pay_before_tax": net_pay, "net_taxable": net_taxable,
        "employer_contributions_before_rgdu": employer_gross, "rgdu_coefficient": coef, "rgdu_reduction": rgdu,
        "super_gross_total_labour_cost": brut + employer_gross - rgdu, "employer_detail": er,
    }


# ---------------------------------------------------------------------------------------------- pensions
def pension_chain(pension_gross_monthly, rfr_n2, parts):
    k = (parts - 1) * 2
    inc = pv("pensions.csg_rfr_increment_half_part")
    th = pv("pensions.csg_rfr_thresholds_1_part")
    exempt = th["exempt_up_to"] + k * inc["exempt_limit"]
    reduced = th["reduced_up_to"] + k * inc["reduced_limit"]
    median = th["median_up_to"] + k * inc["median_limit"]
    if rfr_n2 <= exempt:
        tier, csg, ded, crds, casa = "zero", 0.0, 0.0, 0.0, 0.0
    elif rfr_n2 <= reduced:
        tier, csg, ded = "reduced", pv("pensions.csg_rate_reduced"), pv("pensions.csg_deductible_reduced")
        crds, casa = pv("pensions.crds"), 0.0
    elif rfr_n2 <= median:
        tier, csg, ded = "median", pv("pensions.csg_rate_median"), pv("pensions.csg_deductible_median")
        crds, casa = pv("pensions.crds"), pv("pensions.casa")
    else:
        tier, csg, ded = "full", pv("pensions.csg_rate_full"), pv("pensions.csg_deductible_full")
        crds, casa = pv("pensions.crds"), pv("pensions.casa")
    p = pension_gross_monthly
    return {"tier": tier, "csg_total": csg * p, "csg_deductible": ded * p, "crds": crds * p, "casa": casa * p,
            "pension_net_before_tax": p * (1 - csg - crds - casa), "pension_taxable": p * (1 - ded)}


# ---------------------------------------------------------------------------------------------- income tax
def bareme(q):
    br = pv("income_tax.bareme_2026")
    tax = 0.0
    for i, b in enumerate(br):
        hi = br[i + 1]["from"] if i + 1 < len(br) else float("inf")
        if q > b["from"]:
            tax += (min(q, hi) - b["from"]) * b["rate"]
    return tax


def fiscal_parts(couple, n_children, parent_isole):
    n = 2.0 if couple else 1.0
    for k in range(1, n_children + 1):
        n += pv("income_tax.parts.child_1_and_2") if k <= 2 else pv("income_tax.parts.child_3_and_more")
    if parent_isole and not couple and n_children > 0:
        n += pv("income_tax.parts.parent_isole_bonus")
    return n


def net_categorical_income(salary_taxable_annual, pension_taxable_annual):
    """Revenu net catégoriel annual (after the 10 % abattements): used by IR and by family benefits."""
    rate = pv("income_tax.abattement_salaires_rate")
    tot = 0.0
    for s in salary_taxable_annual:
        if s > 0:
            a = min(max(rate * s, pv("income_tax.abattement_salaires_min")), pv("income_tax.abattement_salaires_max"))
            tot += s - min(a, s)
    p = sum(pension_taxable_annual)
    if p > 0:
        holders = len([x for x in pension_taxable_annual if x > 0])
        a = min(max(pv("income_tax.abattement_pensions_rate") * p,
                    pv("income_tax.abattement_pensions_min_per_pension") * holders),
                pv("income_tax.abattement_pensions_max_per_household"))
        tot += p - min(a, p)
    return tot


def income_tax(rnc, couple, n_children, ages_adults, n_under6=0, childcare_per_child=0.0):
    parent_isole = (not couple) and n_children > 0
    age_ab = 0.0
    if any(a >= 65 for a in ages_adults):
        t1, t2 = pv("income_tax.abattement_age_65_tier1"), pv("income_tax.abattement_age_65_tier2")
        age_ab = t1["amount"] if rnc <= t1["rng_max"] else t2["amount"] if rnc <= t2["rng_max"] else 0.0
    rni = max(0.0, rnc - age_ab)
    n = fiscal_parts(couple, n_children, parent_isole)
    n_base = 2.0 if couple else 1.0
    ir1 = n * bareme(rni / n)
    ir0 = n_base * bareme(rni / n_base)
    halves = (n - n_base) / 0.5
    cap_half = pv("income_tax.qf_cap_per_half_part")
    if parent_isole:
        cap = pv("income_tax.qf_cap_parent_isole_first_child") + cap_half * max(0.0, halves - 2)
    else:
        cap = cap_half * halves
    ir = max(ir1, ir0 - cap) if halves > 0 else ir1
    dec_base = pv("income_tax.decote_couple") if couple else pv("income_tax.decote_single")
    rate = pv("income_tax.decote_rate")
    decote = max(0.0, dec_base - rate * ir) if ir < dec_base / rate else 0.0
    after = max(0.0, ir - decote)
    credit = pv("income_tax.garde_enfant_credit_rate") * min(childcare_per_child, pv("income_tax.garde_enfant_credit_expense_cap")) * n_under6
    net = after - credit
    if after < pv("income_tax.recouvrement_minimum") and credit == 0:
        net = 0.0
    return {"parts": n, "rni": rni, "rfr": rni, "ir_before_decote": ir, "decote": decote, "credit": credit, "ir_net": net}


# ---------------------------------------------------------------------------------------------- housing aid
def apl(zone, couple, n_children, rent, resources_annual):
    a = "benefits.housing_apl_private_rented."

    def ceil_of(z):
        pre = a + f"rent_ceiling_zone{z}_"
        if n_children == 0:
            return pv(pre + ("couple" if couple else "single"))
        return pv(pre + "one_child") + max(0, n_children - 1) * pv(pre + "per_extra_child")

    l2, lref = ceil_of(zone), ceil_of(2)
    L = min(rent, l2)
    C = pv(a + "charges_flat_base") + pv(a + "charges_flat_per_child") * n_children
    R = math.ceil(round(resources_annual, 2) / pv(a + "resources_rounding")) * pv(a + "resources_rounding")

    def table(prefix):
        if n_children == 0:
            return pv(a + prefix + ("couple" if couple else "single"))
        if n_children <= 6:
            return pv(a + prefix + f"{n_children}_dependent" + ("" if n_children == 1 else "s"))
        return pv(a + prefix + "6_dependents") + pv(a + prefix + "per_dependent_beyond_6") * (n_children - 6)

    R0 = table("r0_")
    TF = table("tf_")
    rl = round(100 * L / lref, 2)
    s1, s2 = pv(a + "tl_threshold_1") * 100, pv(a + "tl_threshold_2") * 100
    t2, t3 = pv(a + "tl_rate_tranche_2"), pv(a + "tl_rate_tranche_3")
    tl_pct = t3 * (rl - s2) + t2 * (s2 - s1) if rl >= s2 else max(0.0, t2 * (rl - s1))
    TL = round(tl_pct / 100, 5)
    P0 = max(pv(a + "p0_rate") * (L + C), pv(a + "p0_minimum_amount"))
    Pp = P0 + (TF + TL) * max(0.0, R - R0)
    al = max(0.0, L + C - Pp)
    if zone == 1:
        d, s = pv(a + "degressivity_zone1_start"), pv(a + "degressivity_zone1_end")
    else:
        d, s = pv(a + "degressivity_zone23_start"), pv(a + "degressivity_zone23_end")
    ld, ls = round(l2 * d, 2), round(l2 * s, 2)
    coef = 1.0 if rent <= ld else (0.0 if rent > ls else 1 - (rent - ld) / (ls - ld))
    al = max(0.0, round(al * coef, 2) - pv(a + "flat_reduction"))
    if al < pv(a + "minimum_paid_non_conventionne"):
        al = 0.0
    return {"gross": al, "net_of_crds": al * (1 - pv(a + "crds"))}


# ---------------------------------------------------------------------------------------------- family benefits
def af(n_af, ages_af, rnc):
    """Allocations familiales. Returns total and the 'base' (without age majoration/complement) counted in RSA/PA."""
    if n_af < 2:
        return {"af": 0.0, "af_base": 0.0}
    bmaf = pv("general.bmaf")
    f = "benefits.family."
    rate = {2: pv(f + "af_rate_2_children"), 3: pv(f + "af_rate_3_children")}.get(
        n_af, pv(f + "af_rate_3_children") + pv(f + "af_rate_each_additional_child") * (n_af - 3))
    full = rate * bmaf
    t1 = pv(f + "af_ceiling_tier1_base") + pv(f + "af_ceiling_per_child") * n_af
    t2 = pv(f + "af_ceiling_tier2_base") + pv(f + "af_ceiling_per_child") * n_af
    maj_kids = 0
    for i, a in enumerate(sorted(ages_af, reverse=True)):
        if n_af == 2 and i == 0:
            continue  # the eldest child of a 2-child family never gets the majoration
        if a >= 15:  # born before 1 Mar 2012 -> threshold 14 ; later -> 18 ; age 14 ambiguous (treated as "no")
            maj_kids += 1
    a1 = full + pv(f + "af_age_majoration_rate") * bmaf * maj_kids
    months = pv(f + "af_degressive_complement_months")
    f2, f3 = pv(f + "af_tier2_factor"), pv(f + "af_tier3_factor")
    if rnc <= t1:
        total = a1
    elif rnc <= t2:
        total = max(a1 * f2, (t1 + months * a1 - rnc) / months)
    else:
        total = max(a1 * f3, (t2 + months * a1 * f2 - rnc) / months)
    tier = 1.0 if rnc <= t1 else f2 if rnc <= t2 else f3
    return {"af": total, "af_base": full * tier}


def cf(children_ages, rnc, bonus):
    f = "benefits.family."
    n = len([a for a in children_ages if a < 21])
    if n < pv(f + "cf_min_children") or any(a < pv(f + "cf_min_child_age") for a in children_ages):
        return 0.0
    bmaf = pv("general.bmaf")
    m = 1 + pv(f + "cf_ceiling_child_1_2_increment") * 2 + pv(f + "cf_ceiling_child_3_plus_increment") * (n - 2)
    ceil_base = pv(f + "cf_ceiling_base_0_child") * m + (pv(f + "cf_ceiling_bonus_two_incomes_or_lone_parent") if bonus else 0)
    ceil_maj = pv(f + "cf_ceiling_majore_base_0_child") * m + (pv(f + "cf_ceiling_majore_bonus_two_incomes_or_lone_parent") if bonus else 0)
    if rnc <= ceil_maj:
        return pv(f + "cf_rate_majore") * bmaf
    if rnc <= ceil_base:
        return pv(f + "cf_rate_base") * bmaf
    return 0.0


def paje_base(children_ages, rnc, bonus):
    f = "benefits.family."
    n_u3 = len([a for a in children_ages if a < 3])
    if n_u3 == 0:
        return 0.0
    n = len([a for a in children_ages if a < 20])
    m = 1 + 0.25 * min(n, 2) + 0.30 * max(n - 2, 0)
    full = pv(f + "paje_ceiling_full_base") * m + (pv(f + "paje_ceiling_bonus_full") if bonus else 0)
    part = pv(f + "paje_ceiling_partial_base") * m + (pv(f + "paje_ceiling_bonus_partial") if bonus else 0)
    bmaf = pv("general.bmaf")
    if rnc <= full:
        return n_u3 * pv(f + "paje_base_rate_full") * bmaf
    if rnc <= part:
        return n_u3 * pv(f + "paje_base_rate_partial") * bmaf
    return 0.0


def ars(children_ages, rnc):
    f = "benefits.family."
    bmaf = pv("general.bmaf")
    n = len(children_ages)
    ceiling = pv(f + "ars_ceiling_base") * (1 + pv(f + "ars_ceiling_per_child_increment") * n)
    total = 0.0
    for a in children_ages:
        if 6 <= a <= 10:
            total += pv(f + "ars_rate_6_10") * bmaf
        elif 11 <= a <= 14:
            total += pv(f + "ars_rate_11_14") * bmaf
        elif 15 <= a <= 18:
            total += pv(f + "ars_rate_15_18") * bmaf
    if total == 0:
        return 0.0
    if rnc <= ceiling:
        return total
    diff = ceiling + total - rnc
    return diff if diff >= pv(f + "ars_minimum_paid") else 0.0


def asf(n_children, child_support_monthly=0.0):
    f = "benefits.family."
    amount = max(0.0, pv(f + "asf_rate") * pv("general.bmaf") * n_children - child_support_monthly)
    return amount if amount > pv(f + "asf_minimum_paid") else 0.0


# ---------------------------------------------------------------------------------------------- RSA / PA
def household_factor(np_, prefix):
    f = 1.0
    if np_ >= 2:
        f = pv(prefix + "household_factor_2_persons")
    if np_ >= 3:
        f = pv(prefix + "household_factor_3_persons")
    if np_ >= 4:
        f = pv(prefix + "household_factor_4_persons")
    if np_ >= 5:
        f += pv(prefix + "household_factor_per_additional_person_from_5") * (np_ - 4)
    return f


def housing_flat_rate(prefix, base, np_, apl_gross, owner_or_free):
    rate = pv(prefix + "housing_flat_rate_1_person") if np_ == 1 else \
        pv(prefix + "housing_flat_rate_2_persons") if np_ == 2 else pv(prefix + "housing_flat_rate_3_plus")
    g = 1.0 if np_ == 1 else pv(prefix + "household_factor_2_persons") if np_ == 2 else pv(prefix + "household_factor_3_persons")
    forfait = rate * base * g
    if owner_or_free:
        return forfait
    return min(apl_gross, forfait) if apl_gross > 0 else 0.0


def rsa(n_adults, n_children, earnings, other_resources, apl_gross, owner_or_free, majoration):
    pre = "benefits.rsa."
    base = pv(pre + "base_amount_single")
    np_ = n_adults + n_children
    socle = base * household_factor(np_, pre)
    if majoration and n_adults == 1:
        socle = max(socle, base * (pv(pre + "lone_parent_base_rate") + pv(pre + "lone_parent_per_child_rate") * n_children))
    fl = housing_flat_rate(pre, base, np_, apl_gross, owner_or_free)
    m = max(0.0, socle - fl - earnings - other_resources)
    return (m if m >= pv(pre + "minimum_paid") else 0.0), fl


def prime_activite(n_adults, n_children, earnings_each, other_resources, apl_gross, owner_or_free, majoration):
    pre = "benefits.prime_activite."
    base = pv(pre + "base_amount_single")
    np_ = n_adults + n_children
    forfait = base * household_factor(np_, pre)
    if majoration and n_adults == 1:
        forfait = max(forfait, base * (pv(pre + "lone_parent_base_rate") + pv(pre + "lone_parent_per_child_rate") * n_children))
    fl = housing_flat_rate(pre, base, np_, apl_gross, owner_or_free)
    h = pv("general.smic_hourly_gross")
    bmax = round(pv(pre + "bonification_max_rate") * base, 2)
    s1, s2 = pv(pre + "bonification_start_hours") * h, pv(pre + "bonification_full_hours") * h
    bonif = sum(min(max(bmax * (e - s1) / (s2 - s1), 0.0), bmax) for e in earnings_each)
    earn = sum(earnings_each)
    m = forfait + bonif + pv(pre + "earnings_rate") * earn - max(earn + other_resources + fl, forfait)
    m = max(0.0, m)
    return (m if m >= pv(pre + "minimum_paid") else 0.0), fl, bonif


def aspa_monthly(n_pension_holders, couple, resources_monthly):
    single, cpl = pv("benefits.aspa.max_monthly_single"), pv("benefits.aspa.max_monthly_couple")
    if not couple:
        return max(0.0, single - resources_monthly) if resources_monthly < single else 0.0
    if n_pension_holders == 1:
        return min(single, max(0.0, cpl - resources_monthly))
    return max(0.0, cpl - resources_monthly)


def aah_monthly(own_earnings_gross_monthly, other_resources_monthly):
    mx = pv("benefits.aah.max_amount")
    low = pv("benefits.aah.earnings_low_tranche_smic_share") * pv("general.smic_monthly_gross_35h")
    e = own_earnings_gross_monthly
    abatted = min(e, low) * (1 - pv("benefits.aah.earnings_abattement_low_tranche")) + \
        max(0.0, e - low) * (1 - pv("benefits.aah.earnings_abattement_high_tranche"))
    return max(0.0, mx - abatted - other_resources_monthly)


# ---------------------------------------------------------------------------------------------- micro (optional, not oracle-checked)
def micro_entrepreneur(ca_monthly, kind):
    m = "self_employed_micro."
    soc = {"sales": "social_rate_sales", "services_bic": "social_rate_services_bic", "services_bnc": "social_rate_services_bnc"}[kind]
    form = {"sales": "formation_pro_sales", "services_bic": "formation_pro_services", "services_bnc": "formation_pro_services"}[kind]
    ab = {"sales": "ir_abattement_sales", "services_bic": "ir_abattement_services_bic", "services_bnc": "ir_abattement_bnc"}[kind]
    social = pv(m + soc) * ca_monthly + pv(m + form) * ca_monthly
    ca_y = 12 * ca_monthly
    taxable_y = ca_y - max(pv(m + ab) * ca_y, pv(m + "ir_abattement_minimum"))
    return {"net_before_tax": ca_monthly - social, "taxable_annual": taxable_y}


# ---------------------------------------------------------------------------------------------- VAT
def vat_estimate(disposable_annual, n_adults, n_children_under14, n_other_14_plus):
    uc = 1.0 + 0.5 * (n_adults - 1 + n_other_14_plus) + 0.3 * n_children_under14
    nv = disposable_annual / uc
    d1, d5, d9 = (pv("vat.niveau_de_vie_deciles_2023")[k] for k in ("D1", "D5", "D9"))
    it = pv("vat.niveau_de_vie_deciles_2023_interpolated")
    cuts = [d1, it["D2"], it["D3"], it["D4"], d5, it["D6"], it["D7"], it["D8"], d9]
    decile = 1 + sum(1 for c in cuts if nv > c)
    eff = pv("vat.effort_rate_by_decile")[f"D{decile}"]
    return {"decile": decile, "niveau_de_vie": nv, "effort_rate": eff, "vat_annual": eff * disposable_annual}


# ---------------------------------------------------------------------------------------------- household orchestration
def run_household(inp):
    adults, ages, couple = inp["adults"], inp["children_ages"], inp["couple"]
    n_a, n_k = len(adults), len(ages)
    comp = inp["company"]
    chains, sal_tax_y = [], []
    for a in adults:
        if a["status"] == "salarie" and a["gross_monthly"] > 0:
            ch = salary_chain(a["gross_monthly"], a["work_ratio"], comp["size_ge_50"], comp["at_mp_rate"], comp["versement_mobilite"])
            chains.append(ch)
            sal_tax_y.append(12 * ch["net_taxable"])
    pens_holders = [a for a in adults if a["status"] == "retraite"]
    isolated = (not couple) and n_k > 0
    n_under6 = len([k for k in ages if k < 6])
    rfr = 0.0
    for _ in range(4):  # CSG tier on pensions depends on RFR (N-2 ~ current): fixed point
        pens = [pension_chain(a["pension_gross_monthly"], rfr, fiscal_parts(couple, n_k, isolated)) for a in pens_holders]
        rnc = net_categorical_income(sal_tax_y, [12 * p["pension_taxable"] for p in pens])
        tax = income_tax(rnc, couple, n_k, [a["age"] for a in adults], n_under6,
                         inp["childcare_expenses_annual_per_child_under6"])
        rfr = tax["rfr"]
    h = inp["housing"]
    owner_or_free = h["status"] in ("proprietaire", "aucun_loyer")
    housing = apl(h["zone"], couple, n_k, h["rent_monthly"], rnc) if h["status"] == "locataire" else {"gross": 0.0, "net_of_crds": 0.0}
    n_af = len([k for k in ages if k < pv("benefits.family.af_max_child_age")])
    af_r = af(n_af, [k for k in ages if k < 20], rnc)
    two_incomes = couple and len([s for s in sal_tax_y if s > 0]) >= 2
    bonus = two_incomes or isolated
    cf_amt = cf(ages, rnc, bonus)
    paje = paje_base(ages, rnc, bonus)
    ars_amt = ars(ages, rnc)
    asf_amt = asf(n_af, inp.get("child_support_monthly", 0.0)) if isolated else 0.0
    bmaf = pv("general.bmaf")
    earn_each = [c["net_pay_before_tax"] for c in chains]
    pension_net = sum(p["pension_net_before_tax"] for p in pens)
    aspa = 0.0
    if pens_holders:
        aspa = aspa_monthly(len(pens_holders), couple, pension_net)
    f = "benefits.family."
    other = (af_r["af_base"] + paje + (pv(f + "cf_rate_base") * bmaf if cf_amt > 0 else 0.0)
             + (pv(f + "asf_in_rsa_pa_base_rate") * bmaf * n_k if asf_amt > 0 else 0.0) + pension_net + aspa)
    majoration = inp["single_parent_recent_isolation"] or (isolated and min(ages) < 3)
    rsa_amt, ppa_amt, bonif = 0.0, 0.0, 0.0
    aah = 0.0
    if any(a["status"] == "aah" for a in adults):
        aah = aah_monthly(0.0, 0.0)
    elif not pens_holders:
        rsa_amt, _ = rsa(n_a, n_k, sum(earn_each), other, housing["gross"], owner_or_free, majoration)
        ppa_amt, _, bonif = prime_activite(n_a, n_k, earn_each, other, housing["gross"], owner_or_free, majoration)
        if not chains:
            ppa_amt = 0.0
    crds = pv("general.crds_rate")
    benefits_net = (ppa_amt * (1 - crds) + rsa_amt + housing["net_of_crds"] + af_r["af"] * (1 - crds) + cf_amt * (1 - crds)
                    + asf_amt * (1 - crds) + paje * (1 - crds) + aspa + aah + ars_amt * (1 - crds) / 12)
    disposable = sum(earn_each) + pension_net + benefits_net - tax["ir_net"] / 12
    return {"chains": chains, "pensions": pens, "tax": tax, "rnc": rnc, "ppa_gross": ppa_amt, "rsa": rsa_amt,
            "housing_benefit_gross": housing["gross"], "af_gross": af_r["af"], "cf_gross": cf_amt, "paje_gross": paje,
            "asf_gross": asf_amt, "ars_gross": ars_amt, "aspa": aspa, "aah": aah, "disposable_monthly": disposable,
            "benefits_net_monthly": benefits_net}


# ---------------------------------------------------------------------------------------------- check vs. oracle
TOL = {"salary": 0.05, "rgdu_rounding": 0.4, "ir_net": 3.0, "rni": 7.0, "benefit": 0.6, "af_degressive": 7.0, "ppa_apl_change": 7.0, "disposable": 8.0}
KNOWN = {("edge_af_degressif", "af_gross"): "af_degressive", ("sp2_1_5smic", "ppa_gross"): "ppa_apl_change"}


def check():
    golden = json.load(open(os.path.join(BASE, "golden-cases.json"), encoding="utf-8"))
    worst, bad = 0.0, 0
    for c in golden["cases"]:
        o = c["outputs"]
        r = run_household(c["inputs"])
        hm, ta = o["household_monthly"], o["tax_annual"]
        rows = []
        if r["chains"]:
            ch, oa = r["chains"][0], o["adults"][0]
            for k in ("net_pay_before_tax", "net_taxable", "employer_contributions_before_rgdu"):
                rows.append((k, ch[k], oa[k], TOL["salary"] + 0.03))
            # OpenFisca uses 151.67 h/month (legal value 151.6667): the 4-decimal RGDU coefficient can flip by 1e-4
            for k in ("rgdu_reduction", "super_gross_total_labour_cost"):
                rows.append((k, ch[k], oa[k], TOL["rgdu_rounding"]))
        for pens, oa in zip(r["pensions"], [a for a in o["adults"] if a["status"] == "retraite"]):
            rows.append(("pension_net", pens["pension_net_before_tax"], oa["pension_net_before_tax"], 0.05))
        for k, mine, theirs in (("ppa_gross", r["ppa_gross"], hm["ppa_gross"]), ("rsa", r["rsa"], hm["rsa"]),
                                ("housing_benefit_gross", r["housing_benefit_gross"], hm["housing_benefit_gross"]),
                                ("af_gross", r["af_gross"], hm["af_gross"]), ("cf_gross", r["cf_gross"], hm["cf_gross"]),
                                ("paje_gross", r["paje_gross"], hm["paje_base_gross"]),
                                ("aspa", r["aspa"], hm["aspa"]), ("aah", r["aah"], hm["aah"])):
            rows.append((k, mine, theirs, TOL[KNOWN[(c["id"], k)]] if (c["id"], k) in KNOWN else TOL["benefit"]))
        rows.append(("asf_net", r["asf_gross"] * 0.995, hm["asf_net_of_crds"], TOL["benefit"]))
        rows.append(("ars_gross_august", r["ars_gross"], o["benefits_annual"]["ars_gross_august"], 1.0))
        rows.append(("rni", r["tax"]["rni"], ta["net_taxable_income_rni"], TOL["rni"]))
        rows.append(("parts", r["tax"]["parts"], ta["parts"], 0.001))
        rows.append(("ir_net_signed_abs", abs(r["tax"]["ir_net"]), abs(ta["ir_signed_economic"]), TOL["ir_net"]))
        rows.append(("disposable_monthly", r["disposable_monthly"], o["disposable_income_monthly_steady_state"], TOL["disposable"]))
        flagged = [(k, round(m, 2), round(t, 2)) for k, m, t, tol in rows if abs(m - t) > tol]
        worst = max([worst] + [abs(m - t) for k, m, t, tol in rows if abs(m - t) <= tol])
        bad += len(flagged)
        print(f"{c['id']:<28} {'OK' if not flagged else 'DIFF ' + str(flagged)}")
    print(f"\n{len(golden['cases'])} cases, {bad} component(s) above tolerance")
    return 1 if bad else 0


if __name__ == "__main__":
    if "--check" in sys.argv or len(sys.argv) == 1:
        sys.exit(check())
    if "--case" in sys.argv:
        cid = sys.argv[sys.argv.index("--case") + 1]
        g = json.load(open(os.path.join(BASE, "golden-cases.json"), encoding="utf-8"))
        for c in g["cases"]:
            if c["id"] == cid:
                res = run_household(c["inputs"])
                print(json.dumps(res, indent=2, default=lambda x: round(x, 4)))
