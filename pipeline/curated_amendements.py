"""Hand-curated metadata for the 81 amendments (themes, plain-French summaries, dated effects).

Faithfulness rules
------------------
* `resume_fr` is one neutral sentence written from the exposé sommaire / dispositif of the
  amendment; no figure or date appears that is not in the amendment text.
* every dated effect carries `q`, a verbatim snippet of the amendment (dispositif or exposé);
  build/validate fail if the snippet cannot be found in the amendment text (whitespace and
  apostrophe differences of the PDF extraction are ignored).
* PLF-P2 amendments 1 to 22 (état B) are generated from the data (see b_amendements.py).

A date entry is (ISO date, precision, label_fr, quote).  precision:
  'jour'    exact day written in the text
  'annee'   a year / tax year without a day (ISO date = 1 January of that year)
  'approx'  start date not written (e.g. « lendemain de la publication de la loi »)
"""
from __future__ import annotations

THEMES = {
    "niches": "Niches fiscales et avantages particuliers",
    "refonte_fiscale": "Refonte de la fiscalité (mutations, plus-values, TVA, IS, taxes)",
    "epargne": "Compte d'épargne personnel",
    "aide_fondamentale": "Impôt unique et aide fondamentale universelle",
    "collectivites": "Collectivités locales et fiscalité locale",
    "credits_etat": "Crédits de l'État retirés (état B)",
    "etat_agences_emplois": "Agences, emplois et agents publics",
    "regles_depense": "Règles de dépense de l'État",
    "logement_aides": "Logement, hébergement et énergie",
    "csg_salaire_net": "CSG, CRDS et salaire net",
    "sante": "Santé",
    "retraites_indexations": "Retraites et indexations",
    "securite_sociale": "Organismes de sécurité sociale",
}

J, A, X = "jour", "annee", "approx"

CURATED: dict[tuple[str, int], dict] = {
    # ------------------------------------------------------------------ PLF 2027, première partie
    ("PLF-P1", 1): {
        "theme": "niches",
        "resume": "Supprime tous les avantages fiscaux dérogatoires (exonérations, abattements, déductions, réductions et crédits d'impôt, taux réduits, reports, dégrèvements) sur sept impôts, avec six exceptions de principe et un calendrier d'extinction qui s'étale de 2027 à 2029.",
        "dates": [
            ("2027-01-01", A, "Cas général : impôt sur le revenu dû au titre de 2026, impôt sur les sociétés des exercices clos à partir du 1er janvier 2027, droits d'enregistrement sur les actes à partir du 1er janvier 2027", "le I s’applique à l’impôt sur le revenu dû au titre de 2026"),
            ("2027-01-01", J, "Avantages liés à un investissement, une dépense ou un engagement : investissements et engagements à partir du 1er janvier 2027", "aux engagements pris à compter du 1er janvier 2027"),
            ("2027-01-01", J, "Successions et donations : à partir du 1er janvier 2027", "aux successions ouvertes et aux donations consenties à compter du 1er janvier 2027"),
            ("2027-07-01", J, "TVA, accises et taxes douanières : opérations dont le fait générateur est à partir du 1er juillet 2027", "aux opérations dont le fait générateur intervient à compter du 1er juillet 2027"),
            ("2027-07-01", J, "Plans, comptes, contrats et livrets d'épargne ouverts ou alimentés à partir du 1er juillet 2027 : plus d'avantage fiscal", "les versements effectués à compter du 1er juillet 2027 n’ouvrent pas droit au bénéfice de ces dispositions"),
            ("2027-07-01", J, "Dons : avantage réduit de moitié pour les dons faits à partir du 1er juillet 2027", "l’avantage est réduit de moitié pour les dons et versements effectués à compter du 1 er juillet 2027"),
            ("2027-01-01", A, "Agriculture, services à la personne, garde de jeunes enfants : avantage réduit d'un tiers au titre de 2027", "l’avantage est réduit d’un tiers au titre de 2027 et de deux tiers au titre de 2028"),
            ("2028-01-01", A, "Agriculture, services à la personne, garde de jeunes enfants : avantage réduit de deux tiers au titre de 2028", "de deux tiers au titre de 2028"),
            ("2028-01-01", J, "Décote, nombre de parts et quotient familial, revenus remplacés par l'aide fondamentale, abattements de plus-values, plans et livrets d'épargne : impôt sur le revenu dû au titre de 2028", "le I s’applique à l’impôt sur le revenu dû au titre de 2028 et aux opérations réalisées à compter du 1er janvier 2028"),
            ("2028-01-01", J, "Dons : plus aucun avantage à partir du 1er janvier 2028", "Le I s’applique en totalité aux dons et versements effectués à compter du 1er janvier 2028"),
            ("2029-01-01", J, "Agriculture, services à la personne, garde de jeunes enfants : abolition totale à partir de 2029", "Le I s’applique en totalité aux impositions dues au titre de 2029"),
        ],
    },
    ("PLF-P1", 2): {
        "theme": "niches",
        "resume": "Fait verser au salarié, sous forme de salaire, la valeur des titres-restaurant et titres-transport périmés, aujourd'hui reversée au budget des activités sociales et culturelles de l'entreprise.",
        "dates": [("2027-01-01", J, "Titres dont la péremption intervient à partir du 1er janvier 2027", "intervient à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 3): {
        "theme": "niches",
        "resume": "Réduit de moitié, pour les dons faits à partir du 1er juillet 2027, les taux des réductions d'impôt pour dons (IR, IS, IFI), puis supprime ces réductions au 1er janvier 2028.",
        "dates": [
            ("2027-07-01", J, "Taux des réductions d'impôt pour dons réduits de moitié", "Pour les dons et versements effectués à compter du 1er juillet 2027, les taux mentionnés aux articles 200, 238 bis et 978 du code général des impôts sont réduits de moitié"),
            ("2028-01-01", J, "Abrogation des réductions d'impôt pour dons", "Le présent B s’applique aux dons et versements effectués à compter du 1er janvier 2028"),
        ],
    },
    ("PLF-P1", 4): {
        "theme": "niches",
        "resume": "Abroge le crédit d'impôt versé aux banques pour financer le prêt à taux zéro, pour les offres émises à partir du 1er janvier 2027 ; les avances déjà accordées continuent jusqu'à leur terme.",
        "dates": [("2027-01-01", J, "Offres de prêt à taux zéro émises à partir du 1er janvier 2027", "dont l’offre est émise à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 5): {
        "theme": "niches",
        "resume": "Supprime le suramortissement industriel prévu par le projet de loi et abroge le crédit d'impôt pour l'industrie verte pour les demandes d'agrément à partir du 1er janvier 2027.",
        "dates": [
            ("2027-01-01", J, "Demandes d'agrément déposées à partir du 1er janvier 2027", "aux investissements dont l’agrément est demandé à compter du 1er janvier 2027"),
            ("2029-07-01", J, "Les projets déjà agréés gardent leur crédit s'ils sont réalisés avant le 1er juillet 2029", "réalisés avant le 1er juillet 2029"),
        ],
    },
    ("PLF-P1", 6): {
        "theme": "niches",
        "resume": "Supprime l'article du projet de loi qui crée trois avantages fiscaux pour les cessions et reprises d'entreprises (abattement, droits de mutation à 0,1 %, déduction sur biens neufs).",
        "dates": [],
    },
    ("PLF-P1", 7): {
        "theme": "niches",
        "resume": "Supprime la prorogation jusqu'en 2029 de sept avantages fiscaux du secteur culturel : quatre expirent fin 2026 et le terme de trois crédits d'impôt de production est avancé d'un an.",
        "dates": [("2026-12-31", J, "Les dépenses engagées jusqu'au 31 décembre 2026 restent éligibles", "Les dépenses engagées jusqu’au 31 décembre 2026 restent éligibles")],
    },
    ("PLF-P1", 8): {
        "theme": "niches",
        "resume": "Supprime le suramortissement agricole et réduit puis abroge le crédit d'impôt de remplacement des agriculteurs : un tiers en moins pour 2027, deux tiers pour 2028, abrogation à partir de 2029.",
        "dates": [
            ("2027-01-01", A, "Crédit d'impôt de remplacement réduit d'un tiers pour les dépenses engagées en 2027", "réduit d’un tiers pour les dépenses engagées en 2027 et de deux tiers pour les dépenses engagées en 2028"),
            ("2028-01-01", A, "Crédit d'impôt de remplacement réduit de deux tiers pour les dépenses engagées en 2028", "de deux tiers pour les dépenses engagées en 2028"),
            ("2029-01-01", J, "Abrogation pour les dépenses engagées à partir du 1er janvier 2029", "Le B du II s’applique aux dépenses engagées à compter du 1er janvier 2029"),
        ],
    },
    ("PLF-P1", 9): {
        "theme": "niches",
        "resume": "Abroge les crédits d'impôt recherche, innovation et recherche collaborative pour les dépenses exposées à partir du 1er janvier 2027.",
        "dates": [("2027-01-01", J, "Dépenses exposées à partir du 1er janvier 2027", "Le I s’applique aux dépenses exposées à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 10): {
        "theme": "niches",
        "resume": "Abroge les dix régimes d'exonération d'impôt sur les bénéfices attachés à l'implantation dans une zone (articles 44 sexies à 44 septdecies du CGI) pour les exercices ouverts à partir du 1er janvier 2027.",
        "dates": [("2027-01-01", J, "Exercices ouverts à partir du 1er janvier 2027", "Le I s’applique aux exercices ouverts à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 11): {
        "theme": "niches",
        "resume": "Abroge le régime de taxation au tonnage des armateurs : leur bénéfice réel est imposé comme celui des autres entreprises, pour les exercices ouverts à partir du 1er janvier 2027.",
        "dates": [("2027-01-01", J, "Exercices ouverts à partir du 1er janvier 2027", "Le I s’applique aux exercices ouverts à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 12): {
        "theme": "niches",
        "resume": "Abroge le crédit d'impôt famille (places de crèche financées par l'employeur) pour les dépenses exposées à partir du 1er juillet 2027.",
        "dates": [("2027-07-01", J, "Dépenses exposées à partir du 1er juillet 2027", "Le I s’applique aux dépenses exposées à compter du 1er juillet 2027")],
    },
    ("PLF-P1", 13): {
        "theme": "niches",
        "resume": "Abroge huit déductions exceptionnelles d'investissement (poids lourds, robots, navires, engins, simulateurs, cuves…) pour les biens acquis à partir du 1er janvier 2027.",
        "dates": [("2027-01-01", J, "Biens acquis à partir du 1er janvier 2027", "pris en location avec option d’achat à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 14): {
        "theme": "niches",
        "resume": "Abroge les tarifs réduits d'accise sur l'énergie qui relèvent d'un choix national (les exonérations imposées par le droit de l'Union sont maintenues), à partir du 1er juillet 2027.",
        "dates": [("2027-07-01", J, "Opérations dont le fait générateur est à partir du 1er juillet 2027", "Le I s’applique aux opérations dont le fait générateur intervient à compter du 1er juillet 2027")],
    },
    ("PLF-P1", 15): {
        "theme": "niches",
        "resume": "Abroge d'ici 2029, par tiers, trois régimes fiscaux réservés à l'agriculture : crédit d'impôt pour l'agriculture biologique, exonération des coopératives et tarif réduit du gazole agricole.",
        "dates": [
            ("2027-01-01", J, "Tarif réduit du gazole agricole réduit d'un tiers (fait générateur à partir du 1er janvier 2027)", "réduit d’un tiers pour les opérations dont le fait générateur intervient à compter du 1er janvier 2027"),
            ("2028-01-01", J, "Tarif réduit du gazole agricole réduit de deux tiers (à partir du 1er janvier 2028)", "de deux tiers pour celles dont le fait générateur intervient à compter du 1er janvier 2028"),
            ("2029-01-01", J, "Abrogation complète à partir du 1er janvier 2029", "Le II s’applique aux opérations dont le fait générateur intervient à compter du 1er janvier 2029"),
        ],
    },
    ("PLF-P1", 16): {
        "theme": "niches",
        "resume": "Abroge le dispositif des certificats d'économies d'énergie et les obligations qui le portent, à partir du 1er juillet 2027.",
        "dates": [("2027-07-01", J, "Abrogation à partir du 1er juillet 2027", "Les I à III s’appliquent à compter du 1er juillet 2027")],
    },
    ("PLF-P1", 17): {
        "theme": "niches",
        "resume": "Supprime les prorogations d'un an des exonérations d'impôts accordées aux entreprises des zones aidées et ramène au 31 décembre 2026 la date limite de création dans les zones de développement prioritaire ; les entreprises déjà exonérées gardent leurs droits.",
        "dates": [("2026-12-31", J, "Date limite de création dans les zones de développement prioritaire", "ramène au 31 décembre 2026 la date limite de création ouvrant droit à l’exonération dans les zones de développement prioritaire")],
    },
    ("PLF-P1", 18): {
        "theme": "niches",
        "resume": "Abroge quatre régimes d'aide fiscale à l'investissement (investissement maritime et trois aides outre-mer) au lieu d'en reporter l'extinction, pour les investissements à partir du 1er janvier 2027.",
        "dates": [
            ("2027-01-01", J, "Investissements dont le fait générateur est à partir du 1er janvier 2027", "aux investissements dont le fait générateur intervient à compter du 1er janvier 2027"),
            ("2029-07-01", J, "Les opérations déjà engagées et achevées avant le 1er juillet 2029 restent régies par le droit ancien", "achevés avant le 1er juillet 2029"),
        ],
    },
    ("PLF-P1", 19): {
        "theme": "refonte_fiscale",
        "resume": "Remplace les droits de mutation (achat, succession, donation) par un barème unique — rien sous 10 000 €, 1 % de 10 000 à 100 000 €, 3 % au-delà — supporté par le vendeur ou l'héritier et imputé sur l'impôt sur la plus-value.",
        "dates": [("2027-01-01", J, "Actes, mutations et successions à partir du 1er janvier 2027", "aux successions ouvertes à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 20): {
        "theme": "refonte_fiscale",
        "resume": "Fond l'impôt sur le revenu (12,8 % ou 19 %) et les prélèvements sociaux (17,2 %) sur les plus-values en un prélèvement unique de 30 % calculé sur le gain réel, sans abattements ni exonérations.",
        "dates": [
            ("2027-01-01", J, "Immobilier et biens meubles : cessions à partir du 1er janvier 2027", "aux plus-values réalisées lors des cessions intervenant à compter du 1er janvier 2027"),
            ("2028-01-01", J, "Titres, compte d'épargne personnel : opérations à partir du 1er janvier 2028", "aux plus-values et gains réalisés lors des cessions, rachats et autres opérations intervenant à compter du 1er janvier 2028"),
        ],
    },
    ("PLF-P1", 21): {
        "theme": "refonte_fiscale",
        "resume": "Aligne les taux réduits de TVA sur le taux normal de 20 % au 1er juillet 2028 en métropole ; l'alimentation passe par 10 % en 2028, 15 % en 2029 puis 20 % en 2030.",
        "dates": [
            ("2028-07-01", J, "Taux réduits alignés sur 20 % ; alimentation à 10 %", "Le I s’applique aux opérations dont le fait générateur intervient à compter du 1er juillet 2028"),
            ("2029-07-01", J, "Alimentation à 15 %", "Le II s’applique aux opérations dont le fait générateur intervient à compter du 1er juillet 2029"),
            ("2030-07-01", J, "Alimentation à 20 %", "Le III s’applique aux opérations dont le fait générateur intervient à compter du 1er juillet 2030"),
        ],
    },
    ("PLF-P1", 22): {
        "theme": "refonte_fiscale",
        "resume": "Supprime vingt et une impositions de l'État (contribution sociale sur l'IS, taxe sur les transactions financières, taxe sur les rachats d'actions, droits de timbre…), la plupart au 1er juillet 2027, les taxes annuelles au 1er janvier 2028.",
        "dates": [
            ("2027-07-01", J, "Impositions dont le fait générateur est à partir du 1er juillet 2027", "Le I s’applique aux impositions dont le fait générateur intervient à compter du 1er juillet 2027"),
            ("2028-01-01", J, "Taxes annuelles et contributions sur le revenu", "suivent au 1er janvier 2028, avec le taux unique de l’impôt sur le revenu"),
        ],
    },
    ("PLF-P1", 23): {
        "theme": "refonte_fiscale",
        "resume": "Fixe un taux unique d'impôt sur les sociétés de 27 % pour tous les bénéfices, sans taux réduit, pour les exercices ouverts à partir du 1er juillet 2027.",
        "dates": [("2027-07-01", J, "Exercices ouverts à partir du 1er juillet 2027", "Les I et II s’appliquent aux exercices ouverts à compter du 1er juillet 2027")],
    },
    ("PLF-P1", 24): {
        "theme": "refonte_fiscale",
        "resume": "Porte à zéro le plafond d'affectation de quatre-vingt-deux taxes affectées à des organismes : leur produit revient au budget général, voté chaque année par le Parlement.",
        "dates": [("2027-01-01", A, "Plafonds portés à zéro au titre de 2027 (rendement prévisionnel 29 980,5 M€)", "rendement prévisionnel de 29 980,5 millions d’euros au titre de 2027")],
    },
    ("PLF-P1", 25): {
        "theme": "refonte_fiscale",
        "resume": "Abroge cinquante-sept impositions affectées à des opérateurs et organismes (versement mobilité, formation, apprentissage, effort de construction…) : au 1er juillet 2027 pour celles qui se perçoivent par opération ou sur les rémunérations, avec un dernier exercice 2027 pour les taxes annuelles.",
        "dates": [
            ("2027-07-01", J, "Impositions dont le fait générateur est à partir du 1er juillet 2027 et rémunérations versées à partir de cette date", "à compter du 1er juillet 2027 et, pour les contributions assises sur les rémunérations, aux rémunérations versées à compter de cette date"),
            ("2027-12-31", A, "Taxes annuelles : dues une dernière fois au titre de 2027", "sont dues une dernière fois au titre de 2027"),
        ],
    },
    ("PLF-P1", 26): {
        "theme": "refonte_fiscale",
        "resume": "Retire France Télévisions, Radio France, France Médias Monde et TV5 Monde du compte de concours financiers alimenté par une fraction de TVA : leur financement revient au budget général.",
        "dates": [
            ("2027-01-01", J, "Entrée en vigueur", "Le I, le II, le III et le IV entrent en vigueur le 1er janvier 2027"),
            ("2027-04-01", J, "Les avances d'actions de transformation non employées sont restituées avant le 1er avril 2027", "sont restituées à l’État avant le 1er avril 2027"),
        ],
    },
    ("PLF-P1", 27): {
        "theme": "epargne",
        "resume": "Crée un compte d'épargne personnel unique par résident fiscal, alimenté chaque année par un versement proportionnel aux revenus d'activité et un versement de patrimoine identique pour tous (montants fixés en loi de finances, nuls à défaut), bloqué jusqu'à la retraite puis servi en rente viagère.",
        "dates": [("2028-01-01", J, "Entrée en vigueur ; les produits d'épargne existants deviennent des compartiments du compte", "Les I à VII entrent en vigueur le 1er janvier 2028")],
    },
    ("PLF-P1", 28): {
        "theme": "aide_fondamentale",
        "resume": "Remplace le barème progressif de l'impôt sur le revenu par un taux unique de 23 % diminué d'une aide fondamentale universelle de 6 600 € par adulte et 3 300 € par enfant à charge (majorations pour invalidité et pensions anciennes), l'excédent étant versé ; supprime le quotient familial et la décote.",
        "dates": [
            ("2028-01-01", J, "Versement mensuel de l'aide par acomptes à partir du 1er janvier 2028 (impôt sur le revenu de 2028)", "s’applique aux acomptes dus à compter du 1er janvier 2028"),
            ("2051-01-01", A, "Fin de la majoration de 3 300 € pour les pensions liquidées avant le 1er janvier 2028 : jusqu'à l'imposition des revenus de 2051", "Cette majoration s’applique jusqu’à l’imposition des revenus de l’année 2051"),
        ],
    },
    ("PLF-P1", 29): {
        "theme": "collectivites",
        "resume": "Fusionne les impôts fonciers locaux (taxes foncières, taxe d'habitation sur les résidences secondaires, ordures ménagères, taxe d'aménagement) en une taxe communale unique assise sur la valeur locative de marché, au taux voté par la commune entre 10 % et 30 %.",
        "dates": [("2028-01-01", J, "Entrée en vigueur ; premières impositions au titre de 2028", "Le IV entre en vigueur le 1er janvier 2028")],
    },
    ("PLF-P1", 30): {
        "theme": "collectivites",
        "resume": "Supprime à partir de 2027 les dotations de l'État qui compensent des impôts locaux disparus ou des exonérations décidées par la loi.",
        "dates": [("2027-01-01", A, "Compensations cessent d'être versées à partir de 2027", "Il cesse d’être versé à compter de 2027")],
    },
    ("PLF-P1", 31): {
        "theme": "collectivites",
        "resume": "Conditionne les concours de l'État aux compétences que la collectivité exerce effectivement : quand une compétence est retirée, la dotation baisse de ce que la collectivité y consacrait en moyenne sur trois ans.",
        "dates": [("2027-01-01", J, "Retraits de compétences prenant effet à partir du 1er janvier 2027", "Le présent article s’applique aux retraits de compétences prenant effet à compter du 1er janvier 2027")],
    },
    ("PLF-P1", 32): {
        "theme": "collectivites",
        "resume": "Retire aux départements et aux régions plusieurs compétences facultatives (égalité femmes-hommes, culture, sport, tourisme, langues régionales, éducation populaire) et leurs pouvoirs d'aide aux entreprises, avec la baisse correspondante des concours de l'État.",
        "dates": [
            ("2027-01-01", J, "Entrée en vigueur des retraits de compétences", "Les I et II entrent en vigueur le 1er janvier 2027"),
            ("2028-01-01", A, "Aides économiques plafonnées aux deux tiers de la moyenne 2024-2026 en 2028", "ne peut excéder les deux tiers, en 2028, et le tiers, en 2029"),
            ("2030-01-01", J, "Abrogation des pouvoirs d'aide aux entreprises", "sont abrogés à compter du 1er janvier 2030"),
        ],
    },
    ("PLF-P1", 33): {
        "theme": "collectivites",
        "resume": "Supprime en trois ans la dotation forfaitaire des communes (un tiers en 2027, deux tiers en 2028, la totalité en 2029) ; chaque commune peut la compenser par sa taxe foncière ou réduire sa dépense.",
        "dates": [
            ("2027-01-01", A, "Dotation forfaitaire minorée d'un tiers en 2027", "est minorée, en 2027, d’un montant égal au tiers de la dotation forfaitaire qu’elle a perçue au titre de 2026"),
            ("2028-01-01", A, "Minorée de deux tiers en 2028", "en 2028, d’un montant égal aux deux tiers de cette dotation"),
            ("2029-01-01", A, "Suppression totale en 2029", "la totalité en 2029"),
        ],
    },
    ("PLF-P1", 34): {
        "theme": "collectivites",
        "resume": "Plafonne, à partir de 2028, la fraction de TVA versée aux départements et aux régions à ce qu'ils justifient avoir dépensé pour leurs compétences obligatoires, et fait absorber par la TVA, en dernier recours, les baisses de ressources liées aux compétences retirées.",
        "dates": [("2028-01-01", A, "Plafonnement à partir de 2028", "à compter de 2028, la fraction versée aux départements et aux régions")],
    },
    # ------------------------------------------------------------------ PLF 2027, seconde partie (23 à 39)
    ("PLF-P2", 23): {
        "theme": "etat_agences_emplois",
        "resume": "Supprime la contribution que l'assurance chômage verse à France Travail (au moins 10 % de ses ressources), puisque les dépenses d'intervention et de fonctionnement qu'elle finance sont interrompues.",
        "dates": [("2027-01-01", J, "Entrée en vigueur", "Le présent article entre en vigueur le 1er janvier 2027")],
    },
    ("PLF-P2", 24): {
        "theme": "etat_agences_emplois",
        "resume": "Abaisse de 30 698 emplois le plafond des emplois de l'État pour 2027 (de 2 032 750 à 2 002 052 ETPT), soit la moitié de l'effet annuel de la fermeture de 61 400 postes à partir du 1er juillet 2027.",
        "dates": [
            ("2027-07-01", J, "Fermeture des 61 400 postes des missions abandonnées", "ils ne disparaissent qu’à compter du 1 er juillet 2027"),
            ("2028-01-01", A, "Effet entier en 2028 : 61 400 emplois", "L’exercice 2028 portera l’effet entier, soit 61 400 emplois"),
        ],
    },
    ("PLF-P2", 25): {
        "theme": "etat_agences_emplois",
        "resume": "Dissout au 1er juillet 2027 les personnes morales autres que l'État qui exercent une mission facultative (337 entités nommées), reprend les missions de puissance publique dans les ministères et épargne les établissements vivant de leur patrimoine et les autorités indépendantes.",
        "dates": [
            ("2027-07-01", J, "Dissolution des personnes morales listées", "Sont dissoutes au 1er juillet 2027 les personnes morales autres que l’État qui exercent une mission facultative"),
            ("2027-12-01", J, "Fin des subventions pour charges de service public aux établissements vivant de leur patrimoine", "ne reçoivent plus de subvention pour charges de service public à compter du 1er décembre 2027"),
        ],
    },
    ("PLF-P2", 26): {
        "theme": "etat_agences_emplois",
        "resume": "Organise la sortie des agents dont l'emploi est supprimé : indemnité mensuelle de 70 % d'une base de traitement pendant 1 à 7 ans selon l'ancienneté, cumulable avec un emploi privé.",
        "dates": [
            ("2027-07-01", J, "Entrée en vigueur ; indemnité due à partir du 1er juillet 2027", "Le présent article entre en vigueur le 1er juillet 2027"),
            ("2035-01-01", A, "Rapport annuel au Parlement jusqu'en 2035", "chaque année jusqu’en 2035"),
        ],
    },
    ("PLF-P2", 27): {
        "theme": "regles_depense",
        "resume": "Suspend en 2027 les engagements de dépenses nouvelles sur les sept missions que l'État conserve, sauf décision motivée du ministre du budget pour les dépenses indispensables.",
        "dates": [("2027-01-01", X, "À partir du lendemain de la publication de la loi et jusqu'au 1er janvier 2028", "À compter du lendemain de la publication de la présente loi et avant le 1 er janvier 2028")],
    },
    ("PLF-P2", 28): {
        "theme": "retraites_indexations",
        "resume": "Retire l'automaticité de la revalorisation de l'AAH, de la prime d'activité, du RSA, de l'ASS et de l'aide aux anciens migrants : la revalorisation n'est possible que si le solde du dernier exercice clos n'est pas déficitaire.",
        "dates": [("2027-01-01", J, "Revalorisations prenant effet à partir du 1er janvier 2027", "Le présent article s’applique aux revalorisations prenant effet à compter du 1er janvier 2027")],
    },
    ("PLF-P2", 29): {
        "theme": "logement_aides",
        "resume": "Met fin à toute aide nouvelle de l'État à la construction et à l'acquisition de logements locatifs sociaux ; les décisions déjà prises sont exécutées.",
        "dates": [("2027-01-01", J, "À partir du 1er janvier 2027", "À compter du 1er janvier 2027, l’État n’attribue aucune aide nouvelle à l’investissement pour la construction")],
    },
    ("PLF-P2", 30): {
        "theme": "regles_depense",
        "resume": "Interdit à l'État d'apporter du capital et d'acheter des titres (hors engagements antérieurs) et lui fait publier chaque année l'état de ses participations et le calendrier de leur cession.",
        "dates": [("2027-01-01", J, "À partir du 1er janvier 2027", "À compter du 1er janvier 2027, les dépenses mentionnées aux c et d du 2° se limitent à l’exécution des engagements juridiques souscrits avant cette date")],
    },
    ("PLF-P2", 31): {
        "theme": "regles_depense",
        "resume": "Interdit tout concours de l'État à une personne morale de droit privé et toute attribution de crédits sur sélection de dossiers, ainsi que l'affectation d'une imposition à une personne privée ; les engagements en cours s'achèvent au plus tard le 1er janvier 2029.",
        "dates": [
            ("2027-01-01", J, "Interdictions à partir du 1er janvier 2027", "À compter du 1er janvier 2027, les crédits ouverts au budget général"),
            ("2029-01-01", J, "Engagements antérieurs : terme au plus tard le 1er janvier 2029", "au plus tard jusqu’au 1er janvier 2029"),
        ],
    },
    ("PLF-P2", 32): {
        "theme": "logement_aides",
        "resume": "Éteint l'aide personnelle au logement : plus de droit ouvert pour une demande déposée à partir du 1er juin 2027, baisse d'un tiers puis de deux tiers des aides du parc conventionné, et suppression de toutes les aides au 1er janvier 2030.",
        "dates": [
            ("2027-06-01", J, "Plus aucun droit ouvert pour une demande déposée à partir du 1er juin 2027", "Aucune demande d’aide personnelle au logement déposée à compter du 1er juin 2027 n’ouvre droit à l’aide"),
            ("2027-07-01", J, "Parc conventionné : aide réduite d'un tiers", "réduit d’un tiers au titre des mois courant à compter du 1er juillet 2027"),
            ("2028-07-01", J, "Parc conventionné : aide réduite de deux tiers", "des deux tiers au titre des mois courant à compter du 1er juillet 2028"),
            ("2029-07-01", J, "Parc conventionné : l'aide cesse", "L’aide cesse d’être due à compter du 1er juillet 2029"),
            ("2030-01-01", J, "Toutes les aides personnelles au logement supprimées", "Les aides personnelles au logement ne sont plus dues à compter du 1er janvier 2030"),
        ],
    },
    ("PLF-P2", 33): {
        "theme": "logement_aides",
        "resume": "Fait de l'hébergement d'urgence une faculté temporaire réservée aux personnes en danger ou qui ne peuvent se loger en raison d'une grossesse, d'une incapacité ou de la charge d'un jeune enfant, sous condition de régularité du séjour.",
        "dates": [("2027-01-01", J, "Entrée en vigueur", "Le I entre en vigueur le 1er janvier 2027")],
    },
    ("PLF-P2", 34): {
        "theme": "logement_aides",
        "resume": "Abroge le chèque énergie et le régime qui l'organise : la campagne d'émission de 2027 n'a pas lieu.",
        "dates": [("2027-01-01", J, "Entrée en vigueur", "Le I entre en vigueur le 1er janvier 2027")],
    },
    ("PLF-P2", 35): {
        "theme": "collectivites",
        "resume": "Abroge les subventions que l'État attribue aux collectivités sur dossier (DETR, DSIL, politique de la ville, fonds d'aménagement du territoire…) ; les subventions déjà attribuées sont honorées.",
        "dates": [("2027-01-01", J, "Entrée en vigueur", "Les A et B entrent en vigueur le 1er janvier 2027")],
    },
    ("PLF-P2", 36): {
        "theme": "collectivites",
        "resume": "Supprime la dotation pour les communes rurales de faible densité (50 M€ en 2027) que crée l'article 85 du projet de loi de finances.",
        "dates": [],
    },
    ("PLF-P2", 37): {
        "theme": "collectivites",
        "resume": "Supprime l'extension aux départements des subventions exceptionnelles que l'État attribue aux collectivités en difficulté financière (article 86 du projet de loi de finances).",
        "dates": [],
    },
    ("PLF-P2", 38): {
        "theme": "collectivites",
        "resume": "Supprime le fonds de soutien exceptionnel que le projet de loi de finances crée pour les communes soumises à la contribution à l'effort budgétaire (article 87).",
        "dates": [],
    },
    ("PLF-P2", 39): {
        "theme": "regles_depense",
        "resume": "Fait publier chaque année un rapport sur l'équilibre de la refonte des impositions : impositions supprimées, produits supplémentaires, solde et rapport des prélèvements obligatoires au PIB comparé à son niveau de 2026.",
        "dates": [("2028-01-01", A, "Rapport publié à partir du projet de loi de finances pour 2028", "Le I s’applique à compter du projet de loi de finances pour 2028")],
    },
    # ------------------------------------------------------------------ PLFSS 2027
    ("PLFSS", 1): {
        "theme": "csg_salaire_net",
        "resume": "Supprime la CSG et la CRDS sur les revenus d'activité (114 Md€ en année pleine rendus au salaire net) par paliers de juillet à novembre 2027 puis totalement au 1er décembre 2027, et se gage sur l'abrogation d'exonérations de cotisations sociales.",
        "dates": [
            ("2027-07-01", J, "Abrogation des exonérations de cotisations ; début de la baisse : CSG à 7,6 % (juillet)", "7,6 % pour les périodes courant en juillet 2027"),
            ("2027-08-01", J, "CSG à 6,0 % (août)", "6,0 % pour les périodes courant en août 2027"),
            ("2027-09-01", J, "CSG à 4,3 % (septembre)", "4,3 % pour les périodes courant en septembre 2027"),
            ("2027-10-01", J, "CSG à 2,7 % (octobre)", "2,7 % pour les périodes courant en octobre 2027"),
            ("2027-11-01", J, "CSG à 1,1 % (novembre)", "1,1 % pour les périodes courant en novembre 2027"),
            ("2027-12-01", J, "CSG et CRDS supprimées sur les revenus d'activité", "Les V et VI entrent en vigueur le 1er décembre 2027"),
            ("2028-01-01", J, "Exonérations emploi à domicile et assimilées : réduites de deux tiers", "de deux tiers au titre des périodes d’activité courant à compter du 1er janvier 2028"),
            ("2029-01-01", J, "Exonérations emploi à domicile et assimilées : abrogées", "Les 10° et 24° du III s’appliquent aux périodes d’activité courant à compter du 1er janvier 2029"),
        ],
    },
    ("PLFSS", 2): {
        "theme": "csg_salaire_net",
        "resume": "Retire de la clé de répartition de la CSG les cinq parts assises sur la contribution sur les revenus d'activité (114 Md€ de recettes affectées en rythme annuel).",
        "dates": [("2027-12-01", J, "Entrée en vigueur", "Le I entre en vigueur le 1er décembre 2027")],
    },
    ("PLFSS", 3): {
        "theme": "csg_salaire_net",
        "resume": "Éteint la taxe sur les salaires (17,9 Md€) par étapes — réduction d'un tiers pour les rémunérations de 2028, de deux tiers pour celles de 2029 — puis l'abroge au 1er janvier 2030.",
        "dates": [
            ("2028-01-01", J, "Réduction d'un tiers (rémunérations versées en 2028)", "Le I entre en vigueur le 1er janvier 2028"),
            ("2029-01-01", A, "Réduction de deux tiers (rémunérations versées en 2029)", "de deux tiers pour les rémunérations versées en 2029"),
            ("2030-01-01", J, "Abrogation", "Les II et III entrent en vigueur le 1er janvier 2030"),
        ],
    },
    ("PLFSS", 4): {
        "theme": "sante",
        "resume": "Plafonne le reste à charge annuel en santé à une part fixe des ressources du foyer (5 %, nettes de l'impôt), avec un plancher de 5 % de l'aide fondamentale universelle, sous réserve de l'entrée en vigueur de cette aide.",
        "dates": [("2028-01-01", J, "Entrée en vigueur, à la date d'entrée en vigueur de l'aide fondamentale et sous réserve de celle-ci", "Le I entre en vigueur le 1er janvier 2028, à la date d’entrée en vigueur de l’aide fondamentale universelle et sous réserve de cette entrée en vigueur")],
    },
    ("PLFSS", 5): {
        "theme": "retraites_indexations",
        "resume": "Retire aux prestations sociales et aux pensions leur revalorisation automatique : elle redevient un acte voté ou une décision réglementaire conditionnée à un solde non déficitaire des régimes de base.",
        "dates": [("2027-01-01", J, "Revalorisations prenant effet à partir du 1er janvier 2027", "Le présent article s’applique aux revalorisations prenant effet à compter du 1er janvier 2027")],
    },
    ("PLFSS", 6): {
        "theme": "retraites_indexations",
        "resume": "Remplace les régimes de retraite de base par répartition par un régime socle unique : plus d'affiliation nouvelle aux anciens régimes, droits acquis et pensions liquidées servis jusqu'à leur terme ; une loi ultérieure fixera les règles.",
        "dates": [("2028-01-01", J, "Remplacement des régimes de base", "À compter du 1er janvier 2028, les régimes obligatoires de base d’assurance vieillesse fonctionnant par répartition sont remplacés par un régime socle unique par répartition")],
    },
    ("PLFSS", 7): {
        "theme": "aide_fondamentale",
        "resume": "Abroge les neuf prestations familiales et l'action sociale des caisses d'allocations familiales (sauf l'allocation de logement, éteinte en 2030), à la date et sous réserve de l'entrée en vigueur de l'aide fondamentale universelle.",
        "dates": [
            ("2028-01-01", J, "Entrée en vigueur, à la date d'entrée en vigueur de l'aide fondamentale et sous réserve de celle-ci", "Le I entre en vigueur le 1er janvier 2028, à la date d’entrée en vigueur de l’aide fondamentale universelle et sous réserve de cette entrée en vigueur"),
            ("2030-01-01", J, "Abrogation de l'article L. 511-1 (allocation de logement)", "est abrogé à compter du 1er janvier 2030"),
        ],
    },
    ("PLFSS", 8): {
        "theme": "securite_sociale",
        "resume": "Interdit aux organismes de sécurité sociale et au fonds d'intervention régional tout concours financier sans contrepartie définie : seul l'achat de prestations déterminées reste possible.",
        "dates": [
            ("2027-07-01", J, "Entrée en vigueur", "Les I et II entrent en vigueur le 1er juillet 2027"),
            ("2029-07-01", J, "Engagements en cours exécutés au plus tard jusqu'au 1er juillet 2029", "au plus tard jusqu’au 1er juillet 2029"),
        ],
    },
}
