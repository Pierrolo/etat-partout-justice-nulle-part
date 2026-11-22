#!/usr/bin/env python3
"""
Golden test cases for the French household baseline, computed with OpenFisca-France.

Usage (OpenFisca is installed in a throw-away venv, NOT in the repo):

    uv venv /tmp/ofvenv --python 3.11
    uv pip install --python /tmp/ofvenv/bin/python openfisca-france
    /tmp/ofvenv/bin/python scripts/openfisca_golden.py            # writes research/baseline/golden-cases.json

What it does
------------
For each household described in CASES (a neutral, TS-friendly schema) it builds an
OpenFisca simulation and reads the outputs for ONE reference month (REF_MONTH =
2026-10, i.e. legislation in force on 24 Oct 2026) plus the annual income tax of
calendar year 2026 (barème = latest published, LF 2026 / revenus 2025).

Steady-state convention
-----------------------
* All earnings are constant monthly amounts for 2024, 2025 and 2026 so that the
  look-back rules (3 last months for RSA/PA, 12 last months for APL, N-2 for AF/CF/ARS and
  for the CSG rate on pensions) see the same income as today.
* Monthly amounts are read at 2026-10 (SMIC 12.31 EUR/h since 1 Jun 2026, benefits
  revalorised 1 Apr 2026, APL barème revalorised 1 Oct 2026, réduction générale frozen on
  the 1 Jan 2026 SMIC (décret 2026-509)).
* The réduction générale is recovered "progressively" by OpenFisca (year-to-date),
  so the monthly value is YTD(2026-10) - YTD(2026-09).
* Annual income tax is for tax year 2026 and is divided by 12 for the monthly
  "revenu disponible" (steady state).
* Signs: everything is exported as a POSITIVE amount (costs and levies too).
"""
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
from openfisca_core.reforms import Reform  # noqa: E402
from openfisca_core.simulation_builder import SimulationBuilder  # noqa: E402
from openfisca_france import FranceTaxBenefitSystem  # noqa: E402

AT_MP_RATE = 0.0208      # taux net moyen national AT/MP 2026 (arrêté du 30 décembre 2025)
AGS_RATE_2026 = 0.0025   # cotisation AGS patronale 2026 (OpenFisca parameter is stale at 0.20%)
DEFAULT_HEADCOUNT = 5    # <11 salariés : formation 0,55 %, FNAL 0,10 %, pas de versement mobilité


class OracleFixes(Reform):
    """Align two OpenFisca defaults with the official 2026 value (see meta.known_oracle_deviations)."""

    def apply(self):
        def modify(parameters):
            ags = parameters.prelevements_sociaux.cotisations_regime_assurance_chomage.ags.employeur.ags
            ags.brackets[0].rate.update(start="2026-01-01", value=AGS_RATE_2026)
            return parameters

        self.modify_parameters(modifier_function=modify)

REF_MONTH = "2026-10"
REF_PREV_MONTH = "2026-09"
REF_YEAR = "2026"
YEARS = ("2024", "2025", "2026")
ALL_MONTHS = [f"{y}-{mm:02d}" for y in YEARS for mm in range(1, 13)]

# SMIC brut mensuel (35h = 151.67 h) at 12.31 EUR/h since 1 June 2026.  Official: 1 867.02 EUR
SMIC = 1867.02

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "research", "baseline", "golden-cases.json")


# --------------------------------------------------------------------------------------
# Case definitions (neutral schema)
# --------------------------------------------------------------------------------------
def adult(gross=0.0, age=35, status="salarie", work_ratio=1.0, **kw):
    """status: salarie | retraite | inactif | aah | micro_bnc | micro_services | micro_vente."""
    d = {"age": age, "status": status, "gross_monthly": gross, "work_ratio": work_ratio}
    d.update(kw)
    return d


def case(id_, label, adults, children=(), couple=False, rent=None, zone=2, owner=False,
         isolement_recent=False, childcare_annual=0.0, tags=(), company=None):
    return {
        "id": id_,
        "label": label,
        "tags": list(tags),
        "inputs": {
            "couple": couple,
            "adults": adults,
            "children_ages": list(children),
            "housing": (
                {"status": "proprietaire"} if owner else
                ({"status": "locataire", "rent_monthly": rent, "zone": zone} if rent else {"status": "aucun_loyer"})
            ),
            "single_parent_recent_isolation": isolement_recent,
            "childcare_expenses_annual_per_child_under6": childcare_annual,
            "company": company or {"size_ge_50": False, "at_mp_rate": None, "versement_mobilite": 0.0},
        },
    }


CASES = [
    # ---- single, no children, salaried -------------------------------------------------
    case("single_smic_z2", "Célibataire, 1 SMIC, loyer 550 zone 2",
         [adult(SMIC)], rent=550, zone=2, tags=["single", "salaried", "apl"]),
    case("single_smic_z1", "Célibataire, 1 SMIC, loyer 750 zone 1",
         [adult(SMIC)], rent=750, zone=1, tags=["single", "salaried", "apl"]),
    case("single_smic_z3", "Célibataire, 1 SMIC, loyer 450 zone 3",
         [adult(SMIC)], rent=450, zone=3, tags=["single", "salaried", "apl"]),
    case("single_smic_owner", "Célibataire, 1 SMIC, propriétaire sans loyer",
         [adult(SMIC)], owner=True, tags=["single", "salaried", "forfait_logement"]),
    case("single_half_smic_z2", "Célibataire, 0,5 SMIC (mi-temps), loyer 500 zone 2",
         [adult(round(SMIC * 0.5, 2), work_ratio=0.5)], rent=500, zone=2, tags=["single", "salaried", "part_time"]),
    case("single_1_5smic_z2", "Célibataire, 1,5 SMIC, loyer 650 zone 2",
         [adult(round(SMIC * 1.5, 2))], rent=650, zone=2, tags=["single", "salaried"]),
    case("single_2smic_z1", "Célibataire, 2 SMIC, loyer 900 zone 1",
         [adult(round(SMIC * 2, 2))], rent=900, zone=1, tags=["single", "salaried"]),
    case("single_no_income_z2", "Célibataire sans revenu, loyer 450 zone 2 (RSA + APL)",
         [adult(0.0, status="inactif")], rent=450, zone=2, tags=["single", "rsa", "apl"]),
    case("single_net5k", "Célibataire, brut 6 400 EUR (net ~5 000), loyer 1 200 zone 1",
         [adult(6400.0)], rent=1200, zone=1, tags=["single", "salaried", "high_earner"]),
    case("single_net10k", "Célibataire, brut 12 800 EUR (net ~10 000), loyer 1 800 zone 1",
         [adult(12800.0)], rent=1800, zone=1, tags=["single", "salaried", "high_earner"]),
    # ---- couples with children ----------------------------------------------------------
    case("couple_nokid_2smic_z2", "Couple sans enfant, 2 x SMIC, loyer 800 zone 2",
         [adult(SMIC), adult(SMIC)], couple=True, rent=800, zone=2, tags=["couple", "salaried"]),
    case("couple_2kids_1earner_smic", "Couple + 2 enfants (6 et 10 ans), 1 seul salaire à 1 SMIC, loyer 700 zone 2",
         [adult(SMIC), adult(0.0, status="inactif")], children=[6, 10], couple=True, rent=700, zone=2,
         tags=["couple", "kids", "salaried", "apl", "rsa"]),
    case("couple_2kids_2smic", "Couple + 2 enfants (6 et 10 ans), 2 x SMIC, loyer 800 zone 2",
         [adult(SMIC), adult(SMIC)], children=[6, 10], couple=True, rent=800, zone=2,
         tags=["couple", "kids", "salaried"]),
    case("couple_2kids_mid", "Couple + 2 enfants, brut 3 000 + 2 200, loyer 900 zone 2",
         [adult(3000.0), adult(2200.0)], children=[6, 10], couple=True, rent=900, zone=2,
         tags=["couple", "kids", "salaried"]),
    case("couple_2kids_high", "Couple + 2 enfants, brut 6 000 + 4 000, loyer 1 400 zone 1",
         [adult(6000.0), adult(4000.0)], children=[6, 10], couple=True, rent=1400, zone=1,
         tags=["couple", "kids", "salaried", "af_modulation"]),
    case("couple_2kids_vhigh_af", "Couple + 2 enfants, brut 9 000 + 6 000 (AF divisées par 4), loyer 1 800 zone 1",
         [adult(9000.0), adult(6000.0)], children=[6, 10], couple=True, rent=1800, zone=1,
         tags=["couple", "kids", "salaried", "af_modulation"]),
    case("couple_3kids_low", "Couple + 3 enfants (5, 9, 16 ans), 1,5 SMIC + 1 SMIC, loyer 850 zone 2 (CF, AF majoration)",
         [adult(round(SMIC * 1.5, 2)), adult(SMIC)], children=[5, 9, 16], couple=True, rent=850, zone=2,
         tags=["couple", "kids", "cf", "salaried"]),
    case("couple_3kids_mid_toddler", "Couple + 3 enfants (2, 8, 12 ans), 3 000 + 2 000, loyer 950 zone 2 (CF exclu: enfant < 3 ans)",
         [adult(3000.0), adult(2000.0)], children=[2, 8, 12], couple=True, rent=950, zone=2,
         tags=["couple", "kids", "salaried"]),
    case("couple_1kid_childcare", "Couple + 1 enfant (4 ans), 3 500 + 3 000, garde hors domicile 3 500 EUR/an (crédit d'impôt)",
         [adult(3500.0), adult(3000.0)], children=[4], couple=True, rent=1000, zone=2,
         childcare_annual=3500.0, tags=["couple", "kids", "tax_credit"]),
    # ---- single parents -----------------------------------------------------------------
    case("sp1_no_income", "Parent isolé, 1 enfant (5 ans), sans revenu, isolement récent (RSA majoré), loyer 600 zone 2",
         [adult(0.0, status="inactif")], children=[5], rent=600, zone=2, isolement_recent=True,
         tags=["single_parent", "rsa", "apl"]),
    case("sp1_half_smic", "Parent isolé, 1 enfant (5 ans), 0,5 SMIC, loyer 600 zone 2",
         [adult(round(SMIC * 0.5, 2), work_ratio=0.5)], children=[5], rent=600, zone=2,
         tags=["single_parent", "salaried", "part_time"]),
    case("sp1_smic", "Parent isolé, 1 enfant (5 ans), 1 SMIC, loyer 600 zone 2",
         [adult(SMIC)], children=[5], rent=600, zone=2, tags=["single_parent", "salaried"]),
    case("sp1_1_5smic", "Parent isolé, 1 enfant (5 ans), 1,5 SMIC, loyer 650 zone 2",
         [adult(round(SMIC * 1.5, 2))], children=[5], rent=650, zone=2, tags=["single_parent", "salaried"]),
    case("sp2_no_income", "Parent isolé, 2 enfants (4 et 9 ans), sans revenu, loyer 700 zone 2 (RSA non majoré)",
         [adult(0.0, status="inactif")], children=[4, 9], rent=700, zone=2, tags=["single_parent", "rsa", "apl"]),
    case("sp2_half_smic", "Parent isolé, 2 enfants (4 et 9 ans), 0,5 SMIC, loyer 700 zone 2",
         [adult(round(SMIC * 0.5, 2), work_ratio=0.5)], children=[4, 9], rent=700, zone=2,
         tags=["single_parent", "salaried", "part_time"]),
    case("sp2_smic", "Parent isolé, 2 enfants (4 et 9 ans), 1 SMIC, loyer 700 zone 2",
         [adult(SMIC)], children=[4, 9], rent=700, zone=2, tags=["single_parent", "salaried"]),
    case("sp2_1_5smic", "Parent isolé, 2 enfants (4 et 9 ans), 1,5 SMIC, loyer 750 zone 2",
         [adult(round(SMIC * 1.5, 2))], children=[4, 9], rent=750, zone=2, tags=["single_parent", "salaried"]),
    case("sp3_smic_z1", "Parent isolé, 3 enfants (2, 7, 12 ans), 1 SMIC, loyer 850 zone 1",
         [adult(SMIC)], children=[2, 7, 12], rent=850, zone=1, tags=["single_parent", "salaried"]),
    case("sp3_1_5smic_z3", "Parent isolé, 3 enfants (4, 8, 13 ans), 1,5 SMIC, loyer 650 zone 3",
         [adult(round(SMIC * 1.5, 2))], children=[4, 8, 13], rent=650, zone=3, tags=["single_parent", "salaried"]),
    # ---- retirees -----------------------------------------------------------------------
    case("retired_single_1200", "Retraité seul, pension brute 1 200 EUR/mois (CSG exonérée), loyer 500 zone 2",
         [adult(0.0, age=70, status="retraite", pension_gross_monthly=1200.0)], rent=500, zone=2,
         tags=["retired", "aspa_border"]),
    case("retired_single_1800", "Retraité seul, pension brute 1 800 EUR/mois (CSG taux médian), propriétaire",
         [adult(0.0, age=70, status="retraite", pension_gross_monthly=1800.0)], owner=True, tags=["retired"]),
    case("retired_single_4000", "Retraité seul, pension brute 4 000 EUR/mois (CSG taux plein), propriétaire",
         [adult(0.0, age=72, status="retraite", pension_gross_monthly=4000.0)], owner=True, tags=["retired", "high_earner"]),
    case("retired_couple_3200", "Couple de retraités, pensions brutes 2 000 + 1 200 EUR/mois, propriétaires",
         [adult(0.0, age=70, status="retraite", pension_gross_monthly=2000.0),
          adult(0.0, age=68, status="retraite", pension_gross_monthly=1200.0)], couple=True, owner=True,
         tags=["retired", "couple"]),
    case("retired_single_900_aspa", "Retraité seul, pension brute 900 EUR/mois (ASPA), loyer 450 zone 3",
         [adult(0.0, age=75, status="retraite", pension_gross_monthly=900.0)], rent=450, zone=3,
         tags=["retired", "aspa"]),
    # ---- edge cases around thresholds (AF / ARS / CF / low earnings) ---------------------
    case("single_0_2smic_z2", "Célibataire, 0,2 SMIC (brut 373,40), loyer 450 zone 2 (RSA + PA cumulés)",
         [adult(373.4, work_ratio=0.2)], rent=450, zone=2, tags=["single", "salaried", "rsa", "ppa"]),
    case("edge_af_degressif", "Couple + 2 enfants (6 et 10 ans), 1 salaire brut 9 065 (revenu net catégoriel ~80 800 : juste au-dessus du plafond AF 79 980)",
         [adult(9065.0), adult(0.0, status="inactif")], children=[6, 10], couple=True, rent=1500, zone=1,
         tags=["couple", "kids", "af_modulation", "edge"]),
    case("edge_ars_differentielle", "Parent isolé, 1 enfant (8 ans), brut 3 308 (revenu ~29 300 : juste au-dessus du plafond ARS 28 956)",
         [adult(3308.0)], children=[8], rent=800, zone=2, tags=["single_parent", "ars", "edge"]),
    case("edge_cf_none", "Couple + 3 enfants (5, 9, 13 ans), brut 3 274 + 3 274 (revenu ~58 000 : au-dessus du plafond CF 54 724)",
         [adult(3274.0), adult(3274.0)], children=[5, 9, 13], couple=True, rent=1000, zone=2,
         tags=["couple", "kids", "cf", "edge"]),
    case("couple_2kids_teens", "Couple + 2 enfants (17 et 15 ans), 1,5 SMIC + 1 SMIC (majoration d'âge AF pour le cadet seulement)",
         [adult(round(SMIC * 1.5, 2)), adult(SMIC)], children=[17, 15], couple=True, rent=800, zone=2,
         tags=["couple", "kids", "af_age_majoration"]),
    # ---- AAH (optional) -----------------------------------------------------------------
    case("single_aah_only", "Adulte handicapé seul (taux d'incapacité 80 %), AAH sans autre revenu, loyer 450 zone 2",
         [adult(0.0, age=40, status="aah")], rent=450, zone=2, tags=["aah", "optional"]),
]


# --------------------------------------------------------------------------------------
# OpenFisca plumbing
# --------------------------------------------------------------------------------------
def yearly(value, years=YEARS):
    return {y: value for y in years}


def birth_date_from_age(age):
    # reference date 2026-10-24 -> someone aged `age` was born in (2026 - age), January 1st-ish
    # (mid-year birthdays would create ambiguity for age thresholds; use 1 Feb to be safely "already aged")
    return f"{2026 - age}-02-01"


def build_simulation(tbs, c):
    inp = c["inputs"]
    individus, enfants_ids, parents_ids = {}, [], []
    for i, a in enumerate(inp["adults"]):
        pid = f"p{i + 1}"
        parents_ids.append(pid)
        d = {"date_naissance": {"ETERNITY": birth_date_from_age(a["age"])}}
        if inp["couple"]:
            d["statut_marital"] = {"2024": "marie", "2025": "marie", "2026": "marie"}
        if a["status"] == "salarie" and a["gross_monthly"] > 0:
            d["salaire_de_base"] = yearly(a["gross_monthly"] * 12)
            comp = inp["company"]
            d["taux_accident_travail"] = {m: (comp["at_mp_rate"] or AT_MP_RATE) for m in ALL_MONTHS}
            d["effectif_entreprise"] = {m: (50 if comp["size_ge_50"] else DEFAULT_HEADCOUNT) for m in ALL_MONTHS}
            if a["work_ratio"] < 1.0:
                d["contrat_de_travail"] = {m: "temps_partiel" for m in ALL_MONTHS}
                # hours worked per month (151.67 h = full time)
                d["heures_remunerees_volume"] = {m: round(151.67 * a["work_ratio"], 4) for m in ALL_MONTHS}
        elif a["status"] == "retraite":
            d["retraite_brute"] = yearly(a["pension_gross_monthly"] * 12)
            d["activite"] = {m: "retraite" for m in ALL_MONTHS}
        elif a["status"] == "aah":
            d["taux_incapacite"] = {m: 0.8 for m in ALL_MONTHS}
        individus[pid] = d
    for j, age in enumerate(inp["children_ages"]):
        eid = f"e{j + 1}"
        enfants_ids.append(eid)
        individus[eid] = {"date_naissance": {"ETERNITY": birth_date_from_age(age)}}

    famille = {"parents": parents_ids, "enfants": enfants_ids}
    foyer = {"declarants": parents_ids, "personnes_a_charge": enfants_ids}
    menage = {"personne_de_reference": [parents_ids[0]], "enfants": enfants_ids}
    if len(parents_ids) > 1:
        menage["conjoint"] = [parents_ids[1]]

    n_children = len(enfants_ids)
    if not inp["couple"] and n_children > 0:
        foyer["caseT"] = {y: True for y in YEARS}  # parent isolé : 1/2 part supplémentaire
    if inp["single_parent_recent_isolation"]:
        # RSA / PA "majoré" (isolement récent) -- a FAMILLE-level input in OpenFisca
        famille["rsa_isolement_recent"] = {m: True for m in ALL_MONTHS}
    if inp["childcare_expenses_annual_per_child_under6"]:
        foyer["f7ga"] = {y: inp["childcare_expenses_annual_per_child_under6"] for y in ("2026",)}

    h = inp["housing"]
    if h["status"] == "proprietaire":
        menage["statut_occupation_logement"] = yearly("proprietaire")
    elif h["status"] == "locataire":
        menage["statut_occupation_logement"] = yearly("locataire_vide")
        # loyer is a monthly amount (set_input_divide_by_period would divide a yearly input by 12)
        menage["loyer"] = {m: h["rent_monthly"] for m in ALL_MONTHS}
        menage["zone_apl"] = yearly(f"zone_{h['zone']}")
    else:
        menage["statut_occupation_logement"] = yearly("loge_gratuitement")

    entities = {
        "individus": individus,
        "familles": {"f1": famille},
        "foyers_fiscaux": {"ff1": foyer},
        "menages": {"m1": menage},
    }
    return SimulationBuilder().build_from_entities(tbs, entities), parents_ids, enfants_ids


def val(sim, var, period, idx=0):
    try:
        arr = sim.calculate(var, period)
        return float(np.asarray(arr)[idx])
    except Exception as exc:  # pragma: no cover - diagnostic only
        return {"error": str(exc)[:160]}


def pos(x):
    return abs(x) if isinstance(x, float) else x


def r2(x):
    return round(x, 2) if isinstance(x, float) else x


def run_case(tbs, c):
    sim, parents, kids = build_simulation(tbs, c)
    out = {"adults": [], "household_monthly": {}, "tax_annual": {}, "benefits_annual": {}}
    inp = c["inputs"]

    for i, a in enumerate(inp["adults"]):
        o = {"status": a["status"]}
        if a["status"] == "salarie" and a["gross_monthly"] > 0:
            brut = a["gross_monthly"]
            reg_m = val(sim, "allegement_general", REF_MONTH, i)
            reg_p = val(sim, "allegement_general", REF_PREV_MONTH, i)
            rgdu_month = reg_m - reg_p if isinstance(reg_m, float) and isinstance(reg_p, float) else None
            emp = pos(val(sim, "cotisations_employeur", REF_MONTH, i))
            o.update({
                "gross_monthly": brut,
                "employee_social_contributions": r2(pos(val(sim, "cotisations_salariales", REF_MONTH, i))),
                "csg_deductible": r2(pos(val(sim, "csg_deductible_salaire", REF_MONTH, i))),
                "csg_non_deductible": r2(pos(val(sim, "csg_imposable_salaire", REF_MONTH, i))),
                "crds": r2(pos(val(sim, "crds_salaire", REF_MONTH, i))),
                "net_pay_before_tax": r2(val(sim, "salaire_net", REF_MONTH, i)),
                "net_taxable": r2(val(sim, "salaire_imposable", REF_MONTH, i)),
                "employer_contributions_before_rgdu": r2(emp),
                "rgdu_reduction": r2(rgdu_month) if rgdu_month is not None else None,
                "super_gross_total_labour_cost": r2(brut + emp - (rgdu_month or 0.0)),
            })
        elif a["status"] == "retraite":
            csg_ded = pos(val(sim, "csg_deductible_retraite", REF_MONTH, i))
            csg_nd = pos(val(sim, "csg_imposable_retraite", REF_MONTH, i))
            crds_r = pos(val(sim, "crds_retraite", REF_MONTH, i))
            casa_r = pos(val(sim, "casa", REF_MONTH, i))
            # NB: OpenFisca's own `retraite_nette` can omit the deductible CSG depending on evaluation order
            # (circular N-2 RFR dependency); we therefore rebuild the net pension from its components.
            o.update({
                "pension_gross_monthly": a["pension_gross_monthly"],
                "csg_total": r2(csg_ded + csg_nd),
                "csg_deductible": r2(csg_ded),
                "crds": r2(crds_r),
                "casa": r2(casa_r),
                "pension_net_before_tax": r2(a["pension_gross_monthly"] - csg_ded - csg_nd - crds_r - casa_r),
            })
        out["adults"].append(o)

    hm = out["household_monthly"]
    hm["ppa_gross"] = r2(val(sim, "ppa", REF_MONTH))
    hm["ppa_net_of_crds"] = r2(val(sim, "ppa", REF_MONTH) * 0.995)
    hm["rsa"] = r2(val(sim, "rsa", REF_MONTH))
    # aide_logement is the AL/APL amount before CRDS in OpenFisca (net = gross + crds_logement(<0))
    apl_gross = val(sim, "aide_logement_montant_brut", REF_MONTH)
    hm["housing_benefit_gross"] = r2(apl_gross)
    hm["housing_benefit_net_of_crds"] = r2(val(sim, "aide_logement", REF_MONTH))
    hm["af_gross"] = r2(val(sim, "af", REF_MONTH))
    hm["af_net_of_crds"] = r2(val(sim, "af_nettes_crds", REF_MONTH))
    hm["cf_gross"] = r2(val(sim, "cf", REF_MONTH))
    hm["cf_net_of_crds"] = r2(val(sim, "cf_net_crds", REF_MONTH))
    hm["asf_net_of_crds"] = r2(val(sim, "asf_nette_crds", REF_MONTH))
    hm["paje_base_gross"] = r2(val(sim, "paje_base", REF_MONTH))
    hm["paje_base_net_of_crds"] = r2(val(sim, "paje_base", REF_MONTH) * 0.995)
    hm["aspa"] = r2(val(sim, "aspa", REF_MONTH))
    hm["aah"] = r2(sum(val(sim, "aah", REF_MONTH, i) for i in range(len(c["inputs"]["adults"]))
                       if isinstance(val(sim, "aah", REF_MONTH, i), float)))

    ba = out["benefits_annual"]
    ba["ars_gross_august"] = r2(val(sim, "ars", REF_YEAR))
    ba["ars_net_of_crds"] = r2(val(sim, "ars_nette_crds", REF_YEAR))

    ta = out["tax_annual"]
    ta["tax_year"] = 2026
    ta["parts"] = r2(val(sim, "nbptr", REF_YEAR))
    ta["net_taxable_income_rni"] = r2(val(sim, "rni", REF_YEAR))
    ta["rfr"] = r2(val(sim, "rfr", REF_YEAR))
    ta["ir_after_quotient_familial_cap_before_decote"] = r2(pos(val(sim, "ir_plaf_qf", REF_YEAR)))
    ta["decote"] = r2(pos(val(sim, "decote", REF_YEAR)))
    ta["tax_credits_and_reductions"] = r2(pos(val(sim, "credits_impot", REF_YEAR)) + pos(val(sim, "reductions", REF_YEAR)))
    ta["ir_net_payable"] = r2(pos(val(sim, "impot_revenu_restant_a_payer", REF_YEAR)))
    ta["ir_signed_economic"] = r2(val(sim, "irpp_economique", REF_YEAR))  # negative = tax paid

    # ---- steady-state monthly disposable income (our definition, see baseline-rules.md §8) ----
    net_work = sum(o.get("net_pay_before_tax", 0.0) or 0.0 for o in out["adults"])
    net_pension = sum(o.get("pension_net_before_tax", 0.0) or 0.0 for o in out["adults"])
    benefits = (hm["ppa_net_of_crds"] + hm["rsa"] + hm["housing_benefit_net_of_crds"] + hm["af_net_of_crds"]
                + hm["cf_net_of_crds"] + hm["asf_net_of_crds"] + hm["paje_base_net_of_crds"] + hm["aspa"] + hm["aah"]
                + (ba["ars_net_of_crds"] or 0.0) / 12.0)
    ir_signed = ta["ir_signed_economic"]  # negative when tax is due, positive if net credit refund
    out["disposable_income_monthly_steady_state"] = r2(net_work + net_pension + benefits + ir_signed / 12.0)
    out["disposable_income_components_monthly"] = {
        "net_pay": r2(net_work), "pensions_net": r2(net_pension), "benefits_net_of_crds": r2(benefits),
        "income_tax_signed_over_12": r2(ir_signed / 12.0),
    }
    # informational only: OpenFisca's own annual aggregate for calendar 2026 (mixes pre/post revalorisation months)
    out["openfisca_revenu_disponible_calendar_2026"] = r2(val(sim, "revenu_disponible", REF_YEAR))
    return out



# --------------------------------------------------------------------------------------
# Cross-checks of the ORACLE itself against figures published by official sources
# --------------------------------------------------------------------------------------
IR_OFFICIAL_EXAMPLES = [
    # (label, revenu net imposable, couple, children, parent isolé, official "impôt brut" before décote)
    # Source: service-public.gouv.fr F1419 "Impôt sur le revenu : barème 2026" (revenus 2025), worked examples.
    ("Célibataire, RNI 30 000", 30000, False, 0, False, 2103.99),
    ("Couple, RNI 60 000", 60000, True, 0, False, 4207.98),
    ("Couple, RNI 90 000", 90000, True, 0, False, 13207.98),
    ("Couple + 1 enfant, RNI 60 000", 60000, True, 1, False, 3410.00),
    ("Couple + 1 enfant, RNI 90 000 (plafonnement du QF)", 90000, True, 1, False, 11400.98),
    ("Couple + 2 enfants, RNI 60 000", 60000, True, 2, False, 2772.00),
    ("Couple + 2 enfants, RNI 90 000 (plafonnement du QF)", 90000, True, 2, False, 9593.98),
    ("Parent isolé + 1 enfant, RNI 30 000", 30000, False, 1, True, 748.00),
    ("Parent isolé + 2 enfants, RNI 30 000", 30000, False, 2, True, 110.00),
]

# Official CAF simulator, célibataire sans enfant, sans logement ni autre ressource, JANUARY 2026
# (MoneyVox, 3 Jul 2026, "CAF: ce qui change vraiment à partir de juillet 2026 pour la prime d'activité").
# The CAF displays the amount NET of CRDS (0.5%).
CAF_PA_JAN_2026 = [(700, 350), (1000, 306), (1600, 174), (1800, 94), (1900, 54), (2000, 0)]
NET_TO_BRUT = 1 / 0.79159  # below the PMSS: net = brut x (1 - 11.31% - 9.7% x 98.25%)


def _simple_sim(tbs, individus, ff_extra=None, couple=False, n_kids=0):
    parents = [k for k in individus if k.startswith("p")]
    kids = [k for k in individus if k.startswith("e")]
    entities = {
        "individus": individus,
        "familles": {"f1": {"parents": parents, "enfants": kids}},
        "foyers_fiscaux": {"ff1": {"declarants": parents, "personnes_a_charge": kids, **(ff_extra or {})}},
        "menages": {"m1": {"personne_de_reference": [parents[0]], "enfants": kids,
                           **({"conjoint": [parents[1]]} if len(parents) > 1 else {})}},
    }
    return SimulationBuilder().build_from_entities(tbs, entities)


def cross_checks(tbs):
    out = {"income_tax_official_examples": [], "caf_simulator_prime_activite_jan_2026": [], "smic_net": None}
    for label, rni, couple, kids, isole, official in IR_OFFICIAL_EXAMPLES:
        parents = ["p1", "p2"] if couple else ["p1"]
        ind = {}
        for p in parents:
            ind[p] = {"salaire_imposable": {"2026": rni / 0.9 / len(parents)},   # 10% abattement -> RNI
                      "date_naissance": {"ETERNITY": "1985-01-01"}}
            if couple:
                ind[p]["statut_marital"] = {"2026": "marie"}
        for k in range(kids):
            ind[f"e{k + 1}"] = {"date_naissance": {"ETERNITY": "2014-01-01"}}
        ff = {"caseT": {"2026": True}} if isole else {}
        sim = _simple_sim(tbs, ind, ff)
        out["income_tax_official_examples"].append({
            "label": label, "rni": rni, "couple": couple, "children": kids, "parent_isole": isole,
            "official_ir_before_decote": official,
            "openfisca_ir_before_decote": r2(pos(val(sim, "ir_plaf_qf", REF_YEAR))),
            "difference": r2(pos(val(sim, "ir_plaf_qf", REF_YEAR)) - official),
            "note": "service-public examples ignore the décote; OpenFisca rounds to the euro.",
        })
    # SMIC net (service-public F2300: 1 867.02 brut -> 1 477.93 net, verified 1 Jun 2026)
    sim = _simple_sim(tbs, {"p1": {"salaire_de_base": yearly(SMIC * 12), "date_naissance": {"ETERNITY": "1990-01-01"}}})
    out["smic_net"] = {"official_gross": SMIC, "official_net": 1477.93,
                       "openfisca_net": r2(val(sim, "salaire_net", REF_MONTH)),
                       "source": "https://www.service-public.gouv.fr/particuliers/vosdroits/F2300"}
    # CAF simulator PA, January 2026
    for net, official in CAF_PA_JAN_2026:
        brut = net * NET_TO_BRUT
        sim = _simple_sim(tbs, {"p1": {"salaire_de_base": yearly(brut * 12), "date_naissance": {"ETERNITY": "1990-01-01"}}})
        pa_net = val(sim, "ppa", "2026-01") * 0.995
        out["caf_simulator_prime_activite_jan_2026"].append({
            "net_salary_input": net, "official_caf_amount_net_of_crds": official,
            "openfisca_amount_net_of_crds": r2(pa_net), "difference": r2(pa_net - official),
            "source": "official CAF simulator as reported by MoneyVox, 3 Jul 2026",
        })
    return out


def main():
    tbs = OracleFixes(FranceTaxBenefitSystem())
    try:
        from importlib.metadata import version
        of_version = version("OpenFisca-France")
    except Exception:
        of_version = "unknown"
    results = []
    for i, c in enumerate(CASES, 1):
        try:
            res = run_case(tbs, c)
        except Exception as exc:
            res = {"error": f"{type(exc).__name__}: {exc}"[:400]}
        c = dict(c)
        c["outputs"] = res
        results.append(c)
        print(f"[{i:02d}/{len(CASES)}] {c['id']}: disposable={res.get('disposable_income_monthly_steady_state')}", file=sys.stderr)

    payload = {
        "meta": {
            "reference_implementation": "scripts/baseline_reference.py (reads research/baseline/parameters.json; run with --check)",
            "oracle": "OpenFisca-France",
            "oracle_version": of_version,
            "oracle_released": "2026-10-23 (PyPI 176.1.3)",
            "reference_month": REF_MONTH,
            "tax_year": 2026,
            "legislation_note": (
                "State of the law on 24 Oct 2026: SMIC 12.31 EUR/h (1 Jun 2026); RSA/PA/AAH/BMAF revalorised +0.8% on "
                "1 Apr 2026 with exceptional PA bonification increase; APL barème +1.15% on 1 Oct 2026; réduction "
                "générale computed on the 1 Jan 2026 SMIC (décret 2026-509); IR barème = LF 2026 (revenus 2025), "
                "no 2026-income barème is published yet (PLF 2027 not enacted)."
            ),
            "conventions": [
                "Monthly amounts at 2026-10; positive numbers for levies and contributions.",
                "Constant earnings 2024-2026 (steady state) so look-back rules see current income.",
                "net_pay_before_tax = salaire net 'avant impôt' (net après CSG/CRDS), the base used for RSA/PA.",
                "RGDU monthly = YTD(2026-10) - YTD(2026-09) because OpenFisca recovers it progressively.",
                "housing_benefit_* = APL/AL (private rented sector), gross and net of 0.5% CRDS.",
                "ars_* is the ARS paid in August 2026 (annual figure).",
                "disposable_income_monthly_steady_state = net pay + net pensions + benefits (net of CRDS, ARS/12) "
                "- income tax/12 (+ credits). VAT NOT deducted.",
                "Single parents: ASF (allocation de soutien familial) is paid by OpenFisca whenever no child support is received (assumed).",
                "Families with a child under 3 receive the PAJE allocation de base (41.65% BMAF if under ceiling) in the oracle.",
            ],
            "oracle_adjustments": [
                "OpenFisca's AGS employer rate parameter is 0.20% (stale); official 2026 rate is 0.25% -> patched to 0.25% "
                "through a Reform in this script.",
                "AT/MP rate set to the 2026 national mean 2.08% (OpenFisca default is 0.70%).",
                "Company headcount set to 5 (<11 employees, <50): formation 0.55%, FNAL 0.10%, no versement mobilité.",
            ],
        },
        "cross_checks_of_the_oracle": cross_checks(tbs),
        "cases": results,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"wrote {os.path.abspath(OUT)} ({len(results)} cases)", file=sys.stderr)


if __name__ == "__main__":
    main()
