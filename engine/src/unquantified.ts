/**
 * « Non chiffré » panels: announced promises and unquantified losses, each with tier + source, filtered to the
 * household. Never summed into disposable income. Amount hints are text only.
 */
import { eur0 } from './fmt.ts';
import type { NHousehold } from './normalize.ts';
import {
  MANIFESTE,
  PLF_P1,
  SRC_AM19_DMTO,
  SRC_AM1_NICHES,
  SRC_AM20_PV,
  SRC_AM27_CEP,
  SRC_AM29_TF,
  SRC_P2_26_FP,
  SRC_P2_32_APL,
  SRC_P2_34_CHEQUE,
  SRC_PLFSS4_BOUCLIER,
  SRC_PLFSS5_INDEX,
  SRC_PLFSS7_PF,
  fiche,
} from './params/plan.ts';
import type { UnquantifiedItem } from './types.ts';

interface Ctx {
  nh: NHousehold;
  /** today's computed amounts, monthly */
  today: { rsa: number; apl: number; are: number; lowIncome: boolean; anyBenefit: boolean };
}

interface Entry {
  item: UnquantifiedItem | ((c: Ctx) => UnquantifiedItem);
  when: (c: Ctx) => boolean;
}

const has = (c: Ctx, pred: (a: NHousehold['adults'][number]) => boolean) => c.nh.adults.some(pred);
const workers = (c: Ctx) => has(c, (a) => a.salary !== null);
const retirees = (c: Ctx) => has(c, (a) => a.activity === 'retraite');
const renters = (c: Ctx) => c.nh.housing.status === 'locataire';
const owners = (c: Ctx) =>
  c.nh.housing.status === 'proprietaire' || c.nh.housing.status === 'proprietaire_credit';
const kids = (c: Ctx, max = 25) => c.nh.children.some((k) => k.age < max);

const CATALOGUE: Entry[] = [
  // ------------------------------------------------------------------ promises
  {
    when: workers,
    item: {
      id: 'cep_restitution',
      direction: 'promise',
      tier: 'announced',
      title: 'Compte d’épargne personnel : « 300 € par mois »',
      detail:
        'Le versement de restitution est égal au revenu d’activité × un taux fixé chaque année par la loi de finances ; à défaut de taux voté, il est nul. L’argent est bloqué jusqu’à la retraite puis versé en rente viagère.',
      amountHint: '300 €/mois annoncés « d’ici trois ans » ; 0 € par défaut dans le texte',
      sources: [MANIFESTE, SRC_AM27_CEP, fiche('travailleur', 'Travailleur')],
    },
  },
  {
    when: () => true,
    item: {
      id: 'patrimoine_restitue',
      direction: 'promise',
      tier: 'announced',
      title: 'Patrimoine public « rendu » : 20 000 € par foyer',
      detail:
        '600 Md€ d’actifs publics (participations, foncier, logements) seraient cédés et « rendus » en trois ans, avec un rendement annoncé de 600 €/an par foyer. Le « versement de patrimoine » au compte d’épargne est un montant global voté chaque année (nul à défaut).',
      amountHint: '20 000 €/foyer en trois ans annoncés ; 0 € par défaut dans le texte',
      sources: [MANIFESTE, fiche('foyer', 'Foyer'), SRC_AM27_CEP],
    },
  },
  {
    when: (c) => kids(c, 19),
    item: (c) => ({
      id: 'compte_education',
      direction: 'promise',
      tier: 'announced',
      title: 'Compte éducation : 6 600 € par enfant et par an',
      detail:
        'Versé sur un compte au nom de l’enfant jusqu’à 18 ans pour payer l’école choisie (publique, privée ou associative). Aucun texte juridique ne le crée.',
      amountHint: `6 600 €/an × ${c.nh.children.filter((k) => k.age < 19).length} enfant(s) annoncés (non versés au foyer)`,
      sources: [MANIFESTE, fiche('famille', 'Famille')],
    }),
  },
  {
    when: retirees,
    item: {
      id: 'complement_viager',
      direction: 'promise',
      tier: 'announced',
      title: 'Retraités : complément viager « 500 € par an au moins »',
      detail:
        'Part du patrimoine restitué versée en rente. Aucun mécanisme juridique dans les amendements.',
      amountHint: '500 €/an annoncés',
      sources: [fiche('retraite', 'Retraité')],
    },
  },
  {
    when: renters,
    item: {
      id: 'loyers_baisse',
      direction: 'promise',
      tier: 'announced',
      title: 'Loyers en baisse',
      detail:
        '« +25 % d’offre locative privée » et fin de l’APL qui « cesse de pousser les prix » : les auteurs annoncent une baisse des loyers, non chiffrée par ménage.',
      sources: [fiche('locataire', 'Locataire')],
    },
  },
  {
    when: (c) => renters(c) || owners(c),
    item: {
      id: 'droits_mutation',
      direction: 'promise',
      tier: 'law',
      title: 'Frais de notaire : 1 % / 3 % payés par le vendeur',
      detail:
        'Barème unique au 1er janvier 2027 : rien sous 10 000 €, 1 % de 10 000 à 100 000 €, 3 % au-delà, à la charge de celui qui réalise la plus-value. Exemple des auteurs : appartement de 200 000 € → 3 900 € payés par le vendeur, au lieu d’environ 10 000 € par l’acheteur aujourd’hui.',
      amountHint: '−6 100 € sur un achat à 200 000 € (exemple des auteurs)',
      sources: [SRC_AM19_DMTO, fiche('locataire', 'Locataire')],
    },
  },
  {
    when: () => true,
    item: {
      id: 'bouclier_sanitaire',
      direction: 'promise',
      tier: 'law',
      title: 'Bouclier sanitaire : reste à charge plafonné à 5 % du revenu',
      detail:
        'À partir de 2028 (si l’AFU entre en vigueur), le ticket modérateur et le forfait journalier sont plafonnés à 5 % des ressources du foyer (plancher : 5 % de l’AFU annuelle, soit 330 €).',
      sources: [SRC_PLFSS4_BOUCLIER, fiche('patient', 'Patient')],
    },
  },
  {
    when: () => true,
    item: {
      id: 'frais_gestion_sante',
      direction: 'promise',
      tier: 'announced',
      title: '« 300 € par an de frais de gestion en moins » (santé)',
      detail:
        'Concurrence des complémentaires et fin de « l’intermédiaire obligatoire ». Aucun texte.',
      amountHint: '300 €/an annoncés',
      sources: [fiche('patient', 'Patient')],
    },
  },
  {
    when: () => true,
    item: {
      id: 'prix_taxes',
      direction: 'promise',
      tier: 'announced',
      title: 'Taxes spécifiques supprimées dans les prix',
      detail:
        '57 taxes affectées et 21 taxes d’État supprimées ; les auteurs annoncent que les produits faits en France deviennent « plus abordables » et une « inflation faciale inférieure à 2 % ». Seule la fin des certificats d’économies d’énergie est estimée ici.',
      sources: [fiche('consommateur', 'Consommateur'), fiche('citoyen', 'Citoyen'), PLF_P1],
    },
  },
  {
    when: workers,
    item: {
      id: 'exonerations_salaire',
      direction: 'promise',
      tier: 'announced',
      title: '« 9 Md€ rendus au salaire net » (fin des exonérations patronales)',
      detail:
        'Les auteurs affirment que la suppression des exonérations de cotisations et de la taxe sur les salaires « va au salarié, non à l’entreprise ». Le simulateur ne suppose aucune hausse de salaire brut (H4).',
      sources: [fiche('entreprise', 'Entreprise'), MANIFESTE],
    },
  },
  {
    when: (c) => has(c, (a) => a.activity === 'chomage'),
    item: {
      id: 'compte_chomage',
      direction: 'promise',
      tier: 'announced',
      title: 'Compte épargne alimenté par les cotisations chômage',
      detail:
        'Après six mois, « un compte qui est le vôtre : ce que vous n’utilisez pas vous reste ». Aucun texte ne fixe ses règles.',
      sources: [fiche('personne-sans-emploi', 'Personne sans emploi')],
    },
  },
  {
    when: (c) => has(c, (a) => a.salary?.status === 'fonctionnaire'),
    item: {
      id: 'indemnite_agent_public',
      direction: 'promise',
      tier: 'law',
      title: 'Si votre poste public est supprimé : 70 % du traitement jusqu’à 7 ans',
      detail:
        'Indemnité égale à 70 % du traitement indiciaire (plus une part de primes fixée par décret), durée de 1 à 7 ans selon l’ancienneté, cumulable avec un emploi privé.',
      sources: [
        SRC_P2_26_FP,
        fiche('agent-public-dont-le-poste-est-supprime', 'Agent public dont le poste est supprimé'),
      ],
    },
  },

  // ------------------------------------------------------------------ losses
  {
    when: (c) => has(c, (a) => a.activity === 'chomage' || a.salary !== null),
    item: (c) => {
      const are = c.today.are;
      return {
        id: 'chomage_6_mois',
        direction: 'loss',
        tier: 'announced',
        title: 'Indemnisation chômage limitée à six mois',
        detail:
          'Les auteurs annoncent que l’indemnisation « passe de treize à six mois » (la durée maximale actuelle est de 18 mois selon l’âge). Aucun texte juridique. Le simulateur garde le montant mensuel de l’ARE inchangé (H6).',
        amountHint:
          are > 0
            ? `à partir du 7e mois d’indemnisation : ARE = 0, soit −${eur0(are)}/mois`
            : 'en cas de perte d’emploi : 6 mois d’indemnisation au lieu de 13 à 18',
        sources: [fiche('personne-sans-emploi', 'Personne sans emploi')],
      };
    },
  },
  {
    when: (c) => kids(c, 6),
    item: (c) => ({
      id: 'creche_cmg',
      direction: 'loss',
      tier: 'law',
      title: 'Fin du financement CAF des crèches et du complément de mode de garde',
      detail:
        'La PAJE (dont le complément de libre choix du mode de garde, CMG) et l’action sociale des CAF (qui finance les crèches PSU) sont abrogées au 1er janvier 2028. Le simulateur ne chiffre pas le CMG ni la hausse possible du tarif de crèche.',
      amountHint:
        c.nh.childcare === 'assistante_maternelle'
          ? 'CMG : souvent plusieurs centaines d’euros par mois pour une assistante maternelle'
          : undefined,
      sources: [SRC_PLFSS7_PF],
    }),
  },
  {
    when: () => true,
    item: {
      id: 'reste_a_charge_10',
      direction: 'loss',
      tier: 'announced',
      title: 'Reste à charge de 10 % par acte de soin',
      detail:
        '« Un reste à charge de 10 % par acte apparaît, plafonné à 5 % de votre revenu, et les dépenses de confort sortent du bouclier. » L’ALD disparaît pour les nouvelles affections reconnues à partir de 2028.',
      sources: [fiche('patient', 'Patient'), SRC_PLFSS4_BOUCLIER],
    },
  },
  {
    when: (c) => retirees(c) || c.today.anyBenefit,
    item: {
      id: 'gel_indexation',
      direction: 'loss',
      tier: 'law',
      title: 'Fin de la revalorisation automatique des pensions et prestations',
      detail:
        'À partir de 2027, pensions, AAH, RSA, prime d’activité ne sont plus revalorisées automatiquement (seulement par loi ou si les comptes sont à l’équilibre). L’AFU elle-même n’est pas indexée (6 600 € nominaux). Le simulateur raisonne en euros 2026.',
      sources: [SRC_PLFSS5_INDEX, fiche('retraite', 'Retraité')],
    },
  },
  {
    when: () => true,
    item: {
      id: 'epargne_exonerations',
      direction: 'loss',
      tier: 'law',
      title: 'Fin des exonérations sur l’épargne (Livret A, assurance-vie, PEA, PEL…)',
      detail:
        'Tous les produits deviennent des compartiments du compte d’épargne personnel ; les gains sont taxés à 30 % de la plus-value réelle à la sortie. Les plans ouverts ou alimentés à partir du 1er juillet 2027 perdent leurs avantages.',
      sources: [SRC_AM20_PV, SRC_AM1_NICHES],
    },
  },
  {
    when: owners,
    item: {
      id: 'taxe_fonciere',
      direction: 'loss',
      tier: 'law',
      title: 'Taxe foncière unique : montant inconnu',
      detail:
        'À partir de 2028 : base = valeur locative de marché (tarifs INSEE à créer), taux communal entre 10 et 30 %. Les auteurs écrivent qu’« à 10 %, un logement acquitte à peu près la taxe foncière d’aujourd’hui ». Non chiffrable aujourd’hui (H8).',
      sources: [SRC_AM29_TF],
    },
  },
  {
    when: owners,
    item: {
      id: 'plus_value_residence',
      direction: 'loss',
      tier: 'law',
      title: 'Plus-value sur la résidence principale (à vérifier)',
      detail:
        'Les amendements abrogent toutes les exonérations de l’article 150 U II du CGI, y compris, semble-t-il, celle de la résidence principale : la revente serait taxée à 30 % du gain réel (après inflation). Point à confirmer sur Légifrance.',
      sources: [SRC_AM20_PV, SRC_AM1_NICHES],
    },
  },
  {
    when: (c) => has(c, (a) => a.salary?.status === 'fonctionnaire'),
    item: {
      id: 'postes_publics',
      direction: 'loss',
      tier: 'announced',
      title: '580 000 postes publics supprimés, fin du statut',
      detail:
        'Les auteurs annoncent 580 000 suppressions de postes et la fin du statut de la fonction publique (droit du travail commun).',
      sources: [MANIFESTE, fiche('agent-public-indispensable', 'Agent public indispensable')],
    },
  },
  {
    when: (c) => c.today.lowIncome,
    item: {
      id: 'cheque_energie',
      direction: 'loss',
      tier: 'law',
      title: 'Chèque énergie supprimé au 1er janvier 2027',
      detail:
        'Le chèque énergie (48 à 277 € par an selon les revenus) est abrogé. Il n’est pas calculé dans la situation actuelle du simulateur.',
      amountHint: '48 à 277 €/an aujourd’hui',
      sources: [SRC_P2_34_CHEQUE],
    },
  },
  {
    when: (c) => c.today.rsa > 0,
    item: {
      id: 'droits_connexes',
      direction: 'loss',
      tier: 'announced',
      title:
        'Droits liés au RSA : complémentaire santé solidaire, tarifs sociaux, aides locales, prime de Noël',
      detail:
        'Les aides sociales locales (36 Md€) sont « fusionnées » dans l’AFU selon les classeurs des auteurs ; les droits connexes au RSA ne sont pas modélisés.',
      sources: [
        {
          label:
            'Classeur « Synthèse Chiffres », onglet Refonte fiscalité (aides sociales locales 36,1 Md€)',
        },
      ],
    },
  },
  {
    when: (c) => has(c, (a) => a.activity === 'etudiant') || c.nh.children.some((k) => k.age >= 16),
    item: {
      id: 'etudes_payantes',
      direction: 'loss',
      tier: 'announced',
      title: 'Bourses et gratuité des études',
      detail:
        '« Vos études se paient sur votre compte éducation. » Les bourses sont comptées parmi les aides remplacées par l’AFU (H1). Les bourses ne sont pas modélisées dans la situation actuelle.',
      sources: [fiche('jeune-adulte', 'Jeune adulte')],
    },
  },
  {
    when: (c) => c.nh.emploiDomicileAnnual > 0,
    item: {
      id: 'emploi_domicile_cotisations',
      direction: 'loss',
      tier: 'law',
      title: 'Emploi à domicile : exonérations de cotisations supprimées',
      detail:
        'En plus du crédit d’impôt (chiffré), l’exonération de cotisations patronales des particuliers employeurs (CSS L241-10) est réduite d’un tiers au 1er juillet 2027, de deux tiers en 2028 et supprimée en 2029 : le coût horaire augmente.',
      sources: [
        {
          label: 'Liasse PLFSS 2027, am. n° 1 (IV)',
          url: 'https://france-resolution.fr/amendements/Liasse_PLFSS.pdf',
        },
        fiche('foyer', 'Foyer'),
      ],
    },
  },
  {
    when: (c) => renters(c) && c.today.apl > 0,
    item: {
      id: 'apl_nouveau_bail',
      direction: 'loss',
      tier: 'law',
      title: 'Plus d’APL en cas de déménagement',
      detail:
        'Aucun droit nouveau pour une demande déposée à partir du 1er juin 2027 ; un droit existant s’éteint au départ du logement (et au terme du bail pour les logements non conventionnés, au plus tard le 1er janvier 2030).',
      sources: [SRC_P2_32_APL],
    },
  },
  {
    when: (c) => renters(c),
    item: {
      id: 'parc_social',
      direction: 'loss',
      tier: 'announced',
      title: 'Vente du parc social en trois ans',
      detail:
        'Les 4,5 millions de logements sociaux seraient proposés à la vente ; plus aucun logement social neuf financé par l’État à partir de 2027.',
      sources: [fiche('locataire', 'Locataire')],
    },
  },
  {
    when: (c) => c.nh.children.some((k) => k.aeeh),
    item: {
      id: 'aeeh_complements',
      direction: 'loss',
      tier: 'law',
      title: 'Compléments d’AEEH et PCH enfant',
      detail:
        'L’AEEH (base et compléments) fait partie des prestations familiales abrogées en 2028. Seule l’AEEH de base est chiffrée ; les compléments (jusqu’à plus de 1 000 €/mois) ne le sont pas.',
      sources: [SRC_PLFSS7_PF],
    },
  },
  {
    when: workers,
    item: {
      id: 'titres_restaurant_heures_sup',
      direction: 'loss',
      tier: 'law',
      title: 'Heures supplémentaires, titres-restaurant, intéressement : fin des exonérations',
      detail:
        'Ces exonérations d’impôt et de cotisations (non modélisées) tombent dès les revenus 2026 (impôt) et le 1er juillet 2027 (cotisations).',
      sources: [SRC_AM1_NICHES],
    },
  },
];

export function unquantifiedFor(c: Ctx): {
  promises: UnquantifiedItem[];
  losses: UnquantifiedItem[];
} {
  const items = CATALOGUE.filter((e) => e.when(c)).map((e) =>
    typeof e.item === 'function' ? e.item(c) : e.item,
  );
  const clean = (it: UnquantifiedItem): UnquantifiedItem => {
    const out = { ...it };
    if (out.amountHint === undefined) delete out.amountHint;
    return out;
  };
  return {
    promises: items.filter((i) => i.direction === 'promise').map(clean),
    losses: items.filter((i) => i.direction === 'loss').map(clean),
  };
}
