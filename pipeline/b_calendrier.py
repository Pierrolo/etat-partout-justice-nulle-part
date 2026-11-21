"""calendrier.json — la transition 2027 → 2030 : every dated measure of the plan.

* `events`: one record per dated effect written in an amendment (curated_amendements.py, each
  verified verbatim against the amendment text, each linking to the PDF page that holds the quote)
  + the dated effects of the 23 état B amendments (1er janvier, 1er avril and 1er juillet 2027).
* `trajectoires`: phase-in paths (CSG rates by month, VAT on food, APL, taxe sur les salaires,
  dons, niches agricoles/services à la personne/garde d'enfants, dotation forfaitaire, emplois
  de l'État) with a verified quote per step.
* `jalons`: the milestone dates (source-analysis §6 phase-in cheat-sheet) with the events that fall on them.
* `annonces_sans_date`: claims of the authors with a relative horizon (« en trois ans ») and no legal date.
"""
from __future__ import annotations

import collections

import b_credits
import b_niches
from amend import amendment, page_label, pdf_url, quote_in_amendment, quote_pages
from curated_amendements import CURATED, THEMES
from lib import PLAN_VERSION, SITE, clean, fr, quote_in, read_page, ws
from amend import all_amendments

DOMAINS = [
    ("impots_taxes", "Impôts et taxes"),
    ("revenu_salaire_aides", "Revenu, salaire net et aides"),
    ("epargne_retraite", "Épargne et retraite"),
    ("sante", "Santé"),
    ("logement_energie", "Logement et énergie"),
    ("etat_agences_agents", "L'État, ses agences et ses agents"),
    ("collectivites", "Collectivités locales"),
]
THEME_DOMAIN = {
    "niches": "impots_taxes", "refonte_fiscale": "impots_taxes", "aide_fondamentale": "revenu_salaire_aides", "csg_salaire_net": "revenu_salaire_aides",
    "epargne": "epargne_retraite", "retraites_indexations": "epargne_retraite", "sante": "sante", "logement_aides": "logement_energie",
    "credits_etat": "etat_agences_agents", "etat_agences_emplois": "etat_agences_agents", "regles_depense": "etat_agences_agents",
    "securite_sociale": "etat_agences_agents", "collectivites": "collectivites",
}
DOMAIN_OVERRIDE = {("PLF-P2", 28): "revenu_salaire_aides", ("PLF-P1", 3): "impots_taxes"}
DOMAIN_ORDER = {d: i for i, (d, _) in enumerate(DOMAINS)}

# --------------------------------------------------------------------------------------------
# trajectories: (liasse, n) for the quote check
# --------------------------------------------------------------------------------------------
def _traj():
    _E = b_niches.build()["plan_texte"]["plan_final"]["trois-ans"]
    T = []
    T.append({
        "id": "csg_crds_activite_2027",
        "label_fr": "CSG et CRDS sur les revenus d'activité, en points de rémunération (2027)",
        "unit": "% de l'assiette",
        "steps": [
            {"from": "2027-01-01", "to": "2027-06-30", "csg_pct": 9.2, "crds_pct": 0.5, "total_pct": 9.7, "label_fr": "Premier semestre : aucun changement de taux (mise en place)", "q": [("PLFSS", 2, "ventile aujourd’hui 9,20 points"), ("PLFSS", 1, "9,7 points partent au titre de deux contributions uniformes")]},
            {"from": "2027-07-01", "to": "2027-07-31", "csg_pct": 7.6, "crds_pct": 0.5, "total_pct": 8.1, "label_fr": "Juillet", "q": [("PLFSS", 1, "7,6 % pour les périodes courant en juillet 2027")]},
            {"from": "2027-08-01", "to": "2027-08-31", "csg_pct": 6.0, "crds_pct": 0.5, "total_pct": 6.5, "label_fr": "Août", "q": [("PLFSS", 1, "6,0 % pour les périodes courant en août 2027")]},
            {"from": "2027-09-01", "to": "2027-09-30", "csg_pct": 4.3, "crds_pct": 0.5, "total_pct": 4.8, "label_fr": "Septembre", "q": [("PLFSS", 1, "4,3 % pour les périodes courant en septembre 2027")]},
            {"from": "2027-10-01", "to": "2027-10-31", "csg_pct": 2.7, "crds_pct": 0.5, "total_pct": 3.2, "label_fr": "Octobre", "q": [("PLFSS", 1, "2,7 % pour les périodes courant en octobre 2027")]},
            {"from": "2027-11-01", "to": "2027-11-30", "csg_pct": 1.1, "crds_pct": 0.5, "total_pct": 1.6, "label_fr": "Novembre", "q": [("PLFSS", 1, "1,1 % pour les périodes courant en novembre 2027")]},
            {"from": "2027-12-01", "to": None, "csg_pct": 0.0, "crds_pct": 0.0, "total_pct": 0.0, "label_fr": "À partir du 1er décembre 2027 : plus de CSG ni de CRDS sur les revenus d'activité", "q": [("PLFSS", 1, "Les V et VI entrent en vigueur le 1er décembre 2027")]},
        ],
        "note": "Taux de CSG écrits dans l'amendement PLFSS n° 1 (VII). Le taux de CRDS n'y est pas écrit mois par mois : 0,5 point = 9,7 points au total − 9,2 points de CSG (calcul), maintenu jusqu'au 1er décembre 2027 (la CRDS cesse d'être due à cette date, VI et IX). La CSG reste due sur les pensions, allocations chômage et indemnités journalières.",
        "tier": "loi",
    })
    T.append({
        "id": "tva_alimentation",
        "label_fr": "TVA sur l'alimentation",
        "unit": "% (taux de TVA)",
        "steps": [
            {"from": "2026-01-01", "to": "2028-06-30", "value": 5.5, "label_fr": "Taux actuel (taux réduit) : non écrit dans l'amendement, rappel pour la lecture", "q": [("PLF-P1", 21, "Le consommateur paie trois taux différents")], "hypothesis": True},
            {"from": "2028-07-01", "to": "2029-06-30", "value": 10, "label_fr": "10 % au 1er juillet 2028", "q": [("PLF-P1", 21, "elle passe à 10 % au 1er juillet 2028")]},
            {"from": "2029-07-01", "to": "2030-06-30", "value": 15, "label_fr": "15 % au 1er juillet 2029", "q": [("PLF-P1", 21, "à 15 % au 1er juillet 2029")]},
            {"from": "2030-07-01", "to": None, "value": 20, "label_fr": "Taux normal (20 %) au 1er juillet 2030", "q": [("PLF-P1", 21, "puis rejoint le taux normal au 1er juillet 2030")]},
        ],
        "note": "L'alimentation est désignée par renvoi au code des impositions sur les biens et services (L. 213-159 et L. 213-166). Le premier palier (5,5 %) est le taux réduit actuel de l'alimentation ; il n'est pas écrit dans l'amendement (hypothèse de lecture, hypothesis = true).",
        "tier": "loi",
    })
    T.append({
        "id": "tva_autres_taux_reduits",
        "label_fr": "TVA : autres taux réduits (10 %, 5,5 %, 2,1 %) alignés sur le taux normal",
        "unit": "% (taux de TVA)",
        "steps": [{"from": "2028-07-01", "to": None, "value": 20, "label_fr": "Tous les taux réduits passent à 20 % (métropole, Corse comprise ; outre-mer inchangé)", "q": [("PLF-P1", 21, "au 1er juillet 2028, sur tout le territoire métropolitain, Corse comprise")]}],
        "note": "Les taux dérogatoires comptés comme niches fiscales (46 niches de TVA) sont supprimés plus tôt, au 1er juillet 2027 (PLF-P1 n° 1, IV.D).",
        "tier": "loi",
    })
    T.append({
        "id": "apl_parc_conventionne",
        "label_fr": "Aide personnelle au logement, parc conventionné, droits existants (part du montant de décembre 2026)",
        "unit": "% du montant de décembre 2026",
        "steps": [
            {"from": "2027-01-01", "to": "2027-06-30", "value": 100, "label_fr": "Montant plafonné à celui de décembre 2026 (jamais revalorisé)", "q": [("PLF-P2", 32, "l’aide ne peut plus remonter")]},
            {"from": "2027-07-01", "to": "2028-06-30", "value": 66.67, "label_fr": "Réduction d'un tiers", "q": [("PLF-P2", 32, "réduit d’un tiers au titre des mois courant à compter du 1er juillet 2027")], "calc": "1 − 1/3"},
            {"from": "2028-07-01", "to": "2029-06-30", "value": 33.33, "label_fr": "Réduction de deux tiers", "q": [("PLF-P2", 32, "des deux tiers au titre des mois courant à compter du 1er juillet 2028")], "calc": "1 − 2/3"},
            {"from": "2029-07-01", "to": None, "value": 0, "label_fr": "L'aide cesse (ou au départ du locataire)", "q": [("PLF-P2", 32, "L’aide cesse d’être due à compter du 1er juillet 2029")]},
        ],
        "note": "Aucune demande déposée à partir du 1er juin 2027 n'ouvre droit à l'aide ; parc libre : fin au terme du bail et au plus tard le 1er janvier 2030, date à laquelle toutes les aides personnelles au logement sont supprimées.",
        "tier": "loi",
    })
    T.append({
        "id": "taxe_sur_salaires",
        "label_fr": "Taxe sur les salaires (part restant due)",
        "unit": "% du montant actuel",
        "steps": [
            {"from": "2027-01-01", "to": "2027-12-31", "value": 100, "label_fr": "Rémunérations versées en 2027 : inchangée", "q": [("PLFSS", 3, "La taxe sur les salaires rapporte 17,9 milliards d’euros")]},
            {"from": "2028-01-01", "to": "2028-12-31", "value": 66.67, "label_fr": "Rémunérations versées en 2028 : réduite d'un tiers", "q": [("PLFSS", 3, "est réduit d’un tiers pour les rémunérations versées en 2028")], "calc": "1 − 1/3"},
            {"from": "2029-01-01", "to": "2029-12-31", "value": 33.33, "label_fr": "Rémunérations versées en 2029 : réduite de deux tiers", "q": [("PLFSS", 3, "de deux tiers pour les rémunérations versées en 2029")], "calc": "1 − 2/3"},
            {"from": "2030-01-01", "to": None, "value": 0, "label_fr": "Abrogée au 1er janvier 2030", "q": [("PLFSS", 3, "Les II et III entrent en vigueur le 1er janvier 2030")]},
        ],
        "note": "17,9 Md€ de rendement ; taux de 4,25 %, 8,50 % et 13,60 % pour les employeurs qui ne facturent pas de TVA (hôpitaux, cliniques, banques, assurances, associations, professions de santé).",
        "tier": "loi",
    })
    T.append({
        "id": "dons_reduction_impot",
        "label_fr": "Réduction d'impôt pour dons (taux actuel = 100 %)",
        "unit": "% du taux actuel",
        "steps": [
            {"from": "2027-01-01", "to": "2027-06-30", "value": 100, "label_fr": "Dons faits avant le 1er juillet 2027 : taux actuels", "q": [("PLF-P1", 3, "Le foyer imposable qui donne récupère les deux tiers de son don sur son impôt")]},
            {"from": "2027-07-01", "to": "2027-12-31", "value": 50, "label_fr": "Dons du 1er juillet au 31 décembre 2027 : taux réduits de moitié", "q": [("PLF-P1", 3, "les taux mentionnés aux articles 200, 238 bis et 978 du code général des impôts sont réduits de moitié")], "calc": "1 − 1/2"},
            {"from": "2028-01-01", "to": None, "value": 0, "label_fr": "Dons à partir du 1er janvier 2028 : plus de réduction", "q": [("PLF-P1", 3, "Le présent B s’applique aux dons et versements effectués à compter du 1er janvier 2028")]},
        ],
        "note": "Les réductions acquises avant le 1er janvier 2028, reports compris, demeurent régies par le droit antérieur.",
        "tier": "loi",
    })
    T.append({
        "id": "niches_agri_services_garde",
        "label_fr": "Avantages fiscaux agricoles, services à la personne et garde de jeunes enfants (part restante)",
        "unit": "% de l'avantage actuel",
        "steps": [
            {"from": "2026-01-01", "to": "2026-12-31", "value": 100, "label_fr": "Revenus 2026 : avantage inchangé", "q": [("PLF-P1", 1, "l’avantage est réduit d’un tiers au titre de 2027 et de deux tiers au titre de 2028")], "hypothesis": True},
            {"from": "2027-01-01", "to": "2027-12-31", "value": 66.67, "label_fr": "Au titre de 2027 : réduit d'un tiers", "q": [("PLF-P1", 1, "l’avantage est réduit d’un tiers au titre de 2027")], "calc": "1 − 1/3"},
            {"from": "2028-01-01", "to": "2028-12-31", "value": 33.33, "label_fr": "Au titre de 2028 : réduit de deux tiers", "q": [("PLF-P1", 1, "de deux tiers au titre de 2028")], "calc": "1 − 2/3"},
            {"from": "2029-01-01", "to": None, "value": 0, "label_fr": "À partir de 2029 : supprimé", "q": [("PLF-P1", 1, "Le I s’applique en totalité aux impositions dues au titre de 2029")]},
        ],
        "note": f"Les numéros du III cités par le IV.E de PLF-P1 n° 1 recouvrent {_E['n_niches']} niches du classeur ({fr(_E['cout_2024_meur'] / 1000, 1)} Md€ en 2024) : le crédit d'impôt emploi à domicile (6 420 M€), le crédit d'impôt garde d'enfants de moins de 6 ans (1 737 M€, art. 200 quater B : rapprochement inféré, voir niches.json) et des niches agricoles ou de coopératives. Ne s'applique pas à la TVA.",
        "tier": "loi",
    })
    T.append({
        "id": "exonerations_emploi_domicile",
        "label_fr": "Exonérations de cotisations pour emploi à domicile (L. 241-10 CSS, L. 741-16 code rural) : part restante",
        "unit": "% de l'exonération actuelle",
        "steps": [
            {"from": "2027-01-01", "to": "2027-06-30", "value": 100, "label_fr": "Avant le 1er juillet 2027 : inchangée", "q": [("PLFSS", 1, "réduites d’un tiers au titre des périodes d’activité courant à compter du 1er juillet 2027")], "hypothesis": True},
            {"from": "2027-07-01", "to": "2027-12-31", "value": 66.67, "label_fr": "À partir du 1er juillet 2027 : réduite d'un tiers", "q": [("PLFSS", 1, "réduites d’un tiers au titre des périodes d’activité courant à compter du 1er juillet 2027")], "calc": "1 − 1/3"},
            {"from": "2028-01-01", "to": "2028-12-31", "value": 33.33, "label_fr": "À partir du 1er janvier 2028 : réduite de deux tiers", "q": [("PLFSS", 1, "de deux tiers au titre des périodes d’activité courant à compter du 1er janvier 2028")], "calc": "1 − 2/3"},
            {"from": "2029-01-01", "to": None, "value": 0, "label_fr": "À partir du 1er janvier 2029 : abrogée", "q": [("PLFSS", 1, "Les 10° et 24° du III s’appliquent aux périodes d’activité courant à compter du 1er janvier 2029")]},
        ],
        "note": "Le texte indique « réduites d'un tiers … et de deux tiers » ; le pourcentage restant est calculé par le pipeline.",
        "tier": "loi",
    })
    T.append({
        "id": "dotation_forfaitaire_communes",
        "label_fr": "Dotation forfaitaire des communes (part restante de celle de 2026)",
        "unit": "% de la dotation 2026",
        "steps": [
            {"from": "2026-01-01", "to": "2026-12-31", "value": 100, "label_fr": "2026 : dotation actuelle", "q": [("PLF-P1", 33, "au titre de 2026")], "hypothesis": True},
            {"from": "2027-01-01", "to": "2027-12-31", "value": 66.67, "label_fr": "2027 : minorée d'un tiers", "q": [("PLF-P1", 33, "est minorée, en 2027, d’un montant égal au tiers de la dotation forfaitaire qu’elle a perçue au titre de 2026")], "calc": "1 − 1/3"},
            {"from": "2028-01-01", "to": "2028-12-31", "value": 33.33, "label_fr": "2028 : minorée des deux tiers", "q": [("PLF-P1", 33, "en 2028, d’un montant égal aux deux tiers de cette dotation")], "calc": "1 − 2/3"},
            {"from": "2029-01-01", "to": None, "value": 0, "label_fr": "2029 : supprimée", "q": [("PLF-P1", 33, "la totalité en 2029")]},
        ],
        "note": "Les communes peuvent reprendre la somme sur leur taxe foncière (au-delà des plafonds de taux à due concurrence) ou réduire leur dépense.",
        "tier": "loi",
    })
    T.append({
        "id": "emplois_etat_plafond",
        "label_fr": "Emplois de l'État supprimés (fermeture de 61 400 postes à partir du 1er juillet 2027)",
        "unit": "emplois supprimés (ETPT du plafond)",
        "steps": [
            {"from": "2027-07-01", "to": "2027-12-31", "value": 30698, "label_fr": "2027 : demi-année, 30 698 ETPT retirés du plafond (2 032 750 → 2 002 052)", "q": [("PLF-P2", 24, "Cet amendement abaisse de 30 698 emplois le plafond d’autorisation des emplois de l’État")]},
            {"from": "2028-01-01", "to": None, "value": 61400, "label_fr": "2028 : effet entier, 61 400 emplois", "q": [("PLF-P2", 24, "L’exercice 2028 portera l’effet entier, soit 61 400 emplois")]},
        ],
        "note": "Sorties d'agents : indemnité de 70 % de la base pendant 24 mois plus un mois par trimestre de services, 84 mois au plus (PLF-P2 n° 26). Hors collectivités locales et opérateurs.",
        "tier": "loi",
    })
    for t in T:
        for s in t["steps"]:
            for (lid, n, q) in s.pop("q"):
                assert quote_in_amendment(lid, n, q), f"trajectory quote not found {t['id']} {lid} n°{n}: {q!r}"
                first, _last = quote_pages(lid, n, q)  # the page that holds the quote
                s.setdefault("sources", []).append({"liasse": lid, "number": n, "page": first, "quote": q, "url": pdf_url(lid, first)})
        t["steps"] = [{k: v for k, v in s.items()} for s in t["steps"]]
    return T


ANNONCES = [
    ("restitution_300", "« 300 euros par mois restitués dès la première année, soit +13 % de salaire net en plus pour tous » (CSG/CRDS)", "dès la première année", "manifeste", "300 euros par mois restitués dès la première année", f"{SITE}/manifeste.html"),
    ("cep_300", "« 300 euros par mois versés sur un compte épargne retraite personnel d'ici trois ans »", "d'ici trois ans", "manifeste", "300 euros par mois versés sur un compte épargne retraite personnel d’ici trois ans", f"{SITE}/manifeste.html"),
    ("patrimoine_20000", "« 600 milliards d'euros de patrimoine public rendus aux Français, soit 20 000 euros par foyer en trois ans »", "en trois ans", "manifeste", "soit 20 000 euros par foyer en trois ans", f"{SITE}/manifeste.html"),
    ("parc_social_vente", "Les logements sociaux sont « proposés à la vente en trois ans » (4,5 millions de logements)", "en trois ans", "fiches__locataire", "Les logements sociaux sont proposés à la vente en trois ans", f"{SITE}/fiches/locataire.html"),
    ("chomage_13_6", "L'indemnisation du chômage passe de treize à six mois (puis un compte personnel)", "sans date", "fiches__personne-sans-emploi", "L’indemnisation passe de treize à six mois", f"{SITE}/fiches/personne-sans-emploi.html"),
    ("compte_education", "6 600 euros par an sur un compte éducation au nom de l'enfant, jusqu'à 18 ans", "sans date", "manifeste", "6 600 euros par an sur un compte éducation au nom de l’enfant, jusqu’à 18 ans", f"{SITE}/manifeste.html"),
    ("droit_divise_10", "« Diviser au moins par 10 les 49 millions de mots du droit applicable, en réécrivant les codes en entier »", "sans date", "manifeste", "Diviser au moins par 10 les 49 millions de mots du droit applicable", f"{SITE}/manifeste.html"),
    ("hausse_25", "« augmenter tous les travailleurs de 25 % d'ici trois ans » (lettres aux élus)", "d'ici trois ans", "lettres__lettre-depute", "augmenter tous les travailleurs de 25 % d’ici trois ans", f"{SITE}/ecrire.html"),
    ("mille_feuille", "« Fin du mille-feuille territorial » : communautés de communes, régions et départements disparaissent (aucun texte de loi : les amendements retirent compétences et financements)", "sans date", "manifeste", "Fin du mille-feuille territorial", f"{SITE}/manifeste.html"),
]

JALONS = [
    ("2027-01-01", "Premières coupes", "Crédits d'État retirés pour le fonctionnement courant, l'investissement, les aides aux entreprises et les transferts aux collectivités, chèque énergie et aides au logement social neuf supprimés, mutations à 1 % / 3 %, plus-values immobilières au réel, indexations gelées, crédit d'impôt famille abrogé, premières niches supprimées (revenus 2026, successions et donations, Pacte Dutreil)."),
    ("2027-04-01", "Hébergement d'urgence recentré", "L'hébergement d'urgence devient une faculté temporaire ; les crédits d'hébergement d'urgence sont retirés à cette date."),
    ("2027-06-01", "Fin des nouvelles demandes d'APL", "Aucune demande d'aide personnelle au logement déposée à partir de cette date n'ouvre de droit."),
    ("2027-07-01", "Gros bloc de l'été 2027", "Début de la baisse de la CSG/CRDS sur les revenus d'activité, abrogation des exonérations de cotisations, dissolution de 337 entités, 61 400 postes d'État fermés, IS à 27 %, 54 taxes d'État, 72 taxes affectées et 21 contributions sociales supprimées, accise sur l'électricité à 1 € par mégawattheure, TVA dérogatoire, accises et CEE, dons réduits de moitié, et, dans les crédits d'État retirés, les aides au logement, les subventions aux associations, aux opérateurs et les rémunérations."),
    ("2027-12-01", "Plus de CSG ni de CRDS sur le travail", "CSG et CRDS à zéro sur les revenus d'activité."),
    ("2028-01-01", "Impôt unique et aide fondamentale", "Impôt à 23 % et aide fondamentale universelle (revenus 2028), compte d'épargne personnel, bouclier sanitaire (sous réserve de l'aide), régime socle unique, prestations familiales abrogées, taxe foncière unique, dons sans réduction."),
    ("2028-07-01", "TVA : taux réduits à 20 %", "Taux réduits de TVA alignés sur 20 % ; alimentation à 10 % ; APL du parc conventionné réduite de deux tiers."),
    ("2029-07-01", "Deuxième palier de la TVA alimentaire", "Alimentation à 15 % ; fin de l'APL du parc conventionné."),
    ("2030-01-01", "Fin des aides au logement et de la taxe sur les salaires", "Toutes les aides personnelles au logement supprimées, taxe sur les salaires abrogée, allocation de logement abrogée du CSS, pouvoirs d'aide aux entreprises des départements et régions abrogés."),
    ("2030-07-01", "TVA alimentaire à 20 %", "L'alimentation rejoint le taux normal."),
    ("2051-01-01", "Dernière année de la minoration de pension de l'aide fondamentale", "La minoration de 3 300 € pour les pensions liquidées avant 2028 s'applique jusqu'à l'imposition des revenus de 2051 (réduite au prorata pour les pensions liquidées ensuite)."),
]


def build() -> dict:
    A = all_amendments()
    events = []
    credits = b_credits.build()["missions"]
    # --- état B (aggregated by date) -------------------------------------------------
    # Since the November 2026 version each exposé dates every kind of credit separately (1er janvier, 1er avril,
    # 1er juillet 2027): one event per date, listing the missions concerned and what stops in each.
    by_date = collections.OrderedDict()
    for c in sorted(credits, key=lambda c: c["amendment"]):
        for e in c["effets"]:
            by_date.setdefault(e["date"], []).append((c, e))
    rep_quote = {  # verbatim fragment of the exposé of n° 1, which has the three dates
        "2027-01-01": "La mesure prend effet au 1er janvier 2027 pour le fonctionnement courant et l’investissement",
        "2027-04-01": "Elle prend effet au 1er avril 2027 pour l’hébergement d’urgence",
        "2027-07-01": "Elle prend effet au 1er juillet 2027 pour les aides personnelles au logement",
    }
    assert set(by_date) == set(rep_quote), sorted(by_date)
    n_etat_b = len(credits)
    day_fr = {"2027-01-01": "1er janvier 2027", "2027-04-01": "1er avril 2027", "2027-07-01": "1er juillet 2027"}
    for date, lst in by_date.items():
        cs = [c for c, _ in lst]
        q = rep_quote[date]
        first, last = quote_pages("PLF-P2", 1, q)
        events.append({
            "date": date, "precision": "jour",
            "subject_fr": f"Crédits de l'État retirés (état B, {n_etat_b} amendements)",
            "label_fr": f"Crédits retirés à compter du {day_fr[date]} : {len(cs)} mission{'s' if len(cs) > 1 else ''} sur {n_etat_b}" + (" (selon la nature des crédits de chaque mission)" if len(cs) > 1 else ""),
            "domain": "etat_agences_agents", "theme": "credits_etat",
            "amendments": [{"liasse": "PLF-P2", "number": c["amendment"]} for c in cs],
            "n_amendments": len(cs),
            "missions_detail": [{"liasse": "PLF-P2", "number": c["amendment"], "mission_fr": c["mission_fr"], "applies_to_fr": e["applies_to_fr"]} for c, e in lst],
            "amount_note": "Les montants retirés par mission (credits-retires.json) ne sont pas ventilés par date : une même mission peut avoir plusieurs dates.",
            "tier": "loi",
            "source": {"kind": "amendment", "ref": f"Amendement PLF-P2 n° 1 (exposé : « prend effet au … »), {page_label(first, last)} du PDF ; les autres missions : même phrase dans leur exposé", "url": pdf_url("PLF-P2", first), "quote": q},
        })
    # --- all other amendments --------------------------------------------------------
    for (lid, n), cur in sorted(CURATED.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        a = amendment(lid, n)
        theme = cur["theme"]
        dom = DOMAIN_OVERRIDE.get((lid, n), THEME_DOMAIN[theme])
        for iso, prec, label, q in cur["dates"]:
            assert quote_in_amendment(lid, n, q), (lid, n, q)
            events.append({
                "date": iso, "precision": prec,
                "subject_fr": a["table"]["objet"],
                "label_fr": label,
                "domain": dom, "theme": theme,
                "amendments": [{"liasse": lid, "number": n}], "n_amendments": 1,
                "tier": "loi",
                "source": {"kind": "amendment", "ref": f"Amendement {lid} n° {n} ({page_label(*quote_pages(lid, n, q))} du PDF)", "url": pdf_url(lid, quote_pages(lid, n, q)[0]), "quote": q},
            })
    events.sort(key=lambda e: (e["date"], DOMAIN_ORDER[e["domain"]], e["amendments"][0]["liasse"], e["amendments"][0]["number"], e["label_fr"]))
    for i, e in enumerate(events, 1):
        e["id"] = f"cal_{i:03d}"
        e["year"] = int(e["date"][:4])
        e["in_timeline_2027_2030"] = 2027 <= e["year"] <= 2030
        e["domain_label_fr"] = dict(DOMAINS)[e["domain"]]

    # --- milestones ------------------------------------------------------------------
    jalons = []
    for date, title, summary in JALONS:
        ev = [e["id"] for e in events if e["date"] == date]
        assert ev, f"jalon {date} has no event"
        jalons.append({"date": date, "title_fr": title, "summary_fr": summary, "event_ids": ev, "n_events": len(ev)})

    # --- announcements without a legal date -----------------------------------------
    ann = []
    for aid, label, horizon, page, q, url in ANNONCES:
        assert quote_in(page, q), (aid, q)
        ann.append({"id": aid, "label_fr": label, "horizon_fr": horizon, "tier": "annonce", "source": {"kind": "site", "ref": f"france-resolution.fr › {page.replace('__', ' › ')}", "url": url, "quote": q}})

    traj = _traj()
    per_year = collections.Counter(e["year"] for e in events)
    return {
        "meta": {
            "title_fr": "La transition 2027 → 2030 : chaque mesure datée du plan",
            "tier": "loi",
            "tier_note": "Les dates viennent exclusivement du texte des 84 amendements (rédigés et publiés par Résolution, pas en vigueur). Chaque événement cite un extrait vérifié mot à mot et renvoie à la page du PDF qui le contient. Les promesses sans base légale datée sont séparées dans annonces_sans_date (tier annonce).",
            "version": {k: PLAN_VERSION[k] for k in ("date_iso", "date_fr", "label_fr", "pdf_dates_fr", "cover_fr", "previous_fr")},
            "counts": {"events": len(events), "events_par_annee": dict(sorted(per_year.items())), "jalons": len(jalons), "trajectoires": len(traj), "annonces_sans_date": len(ann)},
            "domains": [{"id": d, "label_fr": l} for d, l in DOMAINS],
            "precision": {"jour": "jour écrit dans le texte", "annee": "année (ou année fiscale) sans jour : date = 1er janvier par convention", "approx": "point de départ non écrit (ex. « lendemain de la publication de la loi »)"},
            "conditions": [
                "Bouclier sanitaire (PLFSS n° 4) et abrogation des prestations familiales (PLFSS n° 7) : « à la date d'entrée en vigueur de l'aide fondamentale universelle et sous réserve de cette entrée en vigueur ».",
                "Compte d'épargne personnel : structure légale au 1er janvier 2028, mais montants « fixés chaque année par la loi de finances » (nuls à défaut).",
            ],
            "etat_b_note": "Pour les 23 amendements d'état B (PLF-P2 n° 1 à 22 et n° 40), l'exposé de chaque mission date séparément chaque nature de crédit : 1er janvier 2027 (fonctionnement courant, investissement, aides aux entreprises, transferts aux collectivités…), 1er avril 2027 (hébergement d'urgence, mission « Cohésion des territoires ») ou 1er juillet 2027 (rémunérations, subventions aux associations et aux opérateurs, transferts aux ménages…). La version d'octobre 2026 ne distinguait que les personnes morales (1er janvier) et les personnes physiques (1er juillet).",
        },
        "events": events,
        "jalons": jalons,
        "trajectoires": traj,
        "annonces_sans_date": ann,
    }
