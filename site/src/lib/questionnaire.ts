/**
 * The questionnaire: one guess, then the sourced figure.
 * The questions are the counts and comparisons people do not carry around — not a tour of every
 * budget line. Every number is read from facts.json. Shares other than the security line are the
 * site's own ratio, part ÷ dep_total_2024_md. Per-household amounts use the single foyer
 * denominator (lib/foyers.ts), never the book's other ones.
 */
import { chip, fact, num, type FactId } from '@/lib/facts';
import { FOYERS_LABEL, FOYERS_NOTE, perFoyerDay, perFoyerYear } from '@/lib/foyers';
import {
  formatEuro,
  formatInteger,
  formatMdEuro,
  formatNumber,
  formatPercentPoints,
} from '@/lib/format';
import type { ChoiceQuestion, Question, ScaleQuestion } from '@/lib/questionnaire-model';
import { europeData } from '@/lib/story-data';

function cited(id: FactId): string {
  return fact(id).label_fr.replace(/[«»]/g, '').replace(/'/g, '’').trim();
}

function share(part: FactId, total: number): number {
  return (num(part) / total) * 100;
}

/** Three decimals, so a rounded percent is not asked to multiply back to a rounded total. */
const md = (n: number) => formatMdEuro(n, { decimals: 3 });

function shareLine(amount: number, pct: number, totalMd: number): string {
  return `${md(amount)}, soit ${formatPercentPoints(pct, { decimals: 1 })} du total (${md(totalMd)}).`;
}

function foyerLine(amount: number): string {
  return `${formatEuro(perFoyerYear(amount))} par foyer et par an, sur ${FOYERS_LABEL}. ${FOYERS_NOTE}`;
}

/** Headcount facts are stored in thousands. */
const heads = (id: FactId) => formatInteger(num(id) * 1_000);

const yearOf = (id: FactId) => {
  const year = fact(id).year;
  return year == null ? '' : String(year);
};

const SPEND = {
  eyebrow: (year: string) => `Part calculée sur l’Insee, ${year}`,
  marker: 'calcul',
  answerLead: 'Le calcul',
} as const;

const COMPTES = {
  hitText: 'C’est le sens des comptes.',
  missText: 'Les comptes vont dans l’autre sens.',
  answerLead: 'Les comptes',
} as const;

const DEPIN = { href: '/comprendre/depenses/', label: 'Explorer la dépense, bloc par bloc' };

/**
 * Upper bounds of sliders. Wide enough that the reference is not stuck at the end, narrow enough
 * that a small guess can still be expressed. Not statistics.
 */
const AGENCY_SCALE_MAX = 5_000;
const LOCAL_SCALE_MAX = 40_000;
const IMPOT_SCALE_MAX = 1_000;
const CERFA_SCALE_MAX = 5_000;
const MOTS_SCALE_MAX = 80;
const JOUR_SCALE_MAX = 400;

function side(left: number, right: number): 'more' | 'less' | 'same' {
  const span = Math.max(Math.abs(left), Math.abs(right), 1);
  if (Math.abs(left - right) / span < 0.08) return 'same';
  return left > right ? 'more' : 'less';
}

export function questionnaire(): Question[] {
  const totalMd = num('dep_total_2024_md');
  const yearBit = yearOf('dep_total_2024_md');
  const spent = `En pourcentage des dépenses publiques de ${yearBit}.`;

  const secuPct = num('dep_part_securite_pct');
  const secuMd = num('dep_groupe_securite_2024_md');
  const defenseMd = num('dep_defense_2024_md');
  const interieurMd = num('dep_interieur_2024_md');
  const justiceMd = num('dep_justice_2024_md');
  const debtMd = num('dep_charge_dette_2024_md');
  const cultureMd = num('dep_loisirs_culture_2024_md');
  const chomageMd = num('dep_chomage_2024_md');
  const retraitesMd = num('dep_retraites_2024_md');
  const retraitesPct = share('dep_retraites_2024_md', totalMd);
  const santeMd = num('dep_sante_2024_md');
  const santePct = share('dep_sante_2024_md', totalMd);
  const eduMd = num('dep_education_2024_md');
  const eduPct = share('dep_education_2024_md', totalMd);
  const nichesMd = num('niches_total_md');
  const nichesSeulesMd = num('niches_cout_2024_md');

  const securite: ScaleQuestion = {
    id: 'securite',
    kind: 'scale',
    eyebrow: SPEND.eyebrow(yearBit),
    prompt:
      'À votre avis, quelle part des dépenses publiques va à la sécurité : police, justice, défense ?',
    hint: spent,
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    decimals: 0,
    truth: secuPct,
    truthLabel: formatPercentPoints(secuPct, { decimals: 1 }),
    closeAbs: 1.5,
    marker: SPEND.marker,
    answerLead: SPEND.answerLead,
    body: [
      shareLine(secuMd, secuPct, totalMd),
      `${formatEuro(perFoyerYear(secuMd))} par foyer et par an, soit ${formatEuro(perFoyerDay(secuMd), { decimals: 2 })} par jour, sur ${FOYERS_LABEL}. ${FOYERS_NOTE}`,
      `Ce total additionne la défense (${md(defenseMd)}), l’intérieur — police et sécurité civile — (${md(interieurMd)}) et la justice (${md(justiceMd)}).`,
      `On lit aussi : « ${cited('dep_part_regalien_manifeste_pct')} ».`,
    ],
    sources: [
      chip('dep_part_securite_pct', { label: 'Insee, calcul du site' }),
      chip('dep_defense_2024_md', { label: 'Insee, défense' }),
      chip('dep_interieur_2024_md', { label: 'Insee, intérieur' }),
      chip('dep_justice_2024_md', { label: 'Insee, justice' }),
      chip('dep_part_regalien_manifeste_pct', { label: 'Annonce' }),
    ],
    more: DEPIN,
  };

  const debtOverDefense = debtMd > defenseMd;
  const debtOverJustice = debtMd > justiceMd;
  const debtId =
    debtOverDefense && debtOverJustice ? 'both' : debtOverJustice ? 'justice' : 'neither';
  const dette: ChoiceQuestion = {
    id: 'dette',
    kind: 'choice',
    eyebrow: `Insee, comptes nationaux, ${yearBit}`,
    prompt:
      'Les intérêts de la dette sont-ils plus lourds que la justice, la défense, ou les deux ?',
    hint: 'Même tableau de dépenses publiques.',
    options: [
      { id: 'justice', label: 'Plus lourde que la justice, plus légère que la défense' },
      { id: 'both', label: 'Plus lourde que la justice et que la défense' },
      { id: 'neither', label: 'Plus légère que les deux' },
    ],
    correctId: debtId,
    ...COMPTES,
    body: [
      `La charge de la dette fait ${md(debtMd)}, la défense ${md(defenseMd)}, la justice ${md(justiceMd)}.`,
      debtMd > justiceMd
        ? `Rapportée à la justice, la charge de la dette pèse ${formatNumber(debtMd / justiceMd, { decimals: 1 })} fois plus. C’est la ligne des intérêts (opérations sur la dette), pas le capital remboursé.`
        : `C’est la ligne des intérêts (opérations sur la dette), pas le capital remboursé.`,
      foyerLine(debtMd),
    ],
    sources: [
      chip('dep_charge_dette_2024_md', { label: 'Insee, charge de la dette' }),
      chip('dep_defense_2024_md', { label: 'Insee, défense' }),
      chip('dep_justice_2024_md', { label: 'Insee, justice' }),
    ],
    more: DEPIN,
  };

  const cultureSide = side(cultureMd, justiceMd);
  const culture: ChoiceQuestion = {
    id: 'culture',
    kind: 'choice',
    eyebrow: `Insee, comptes nationaux, ${yearBit}`,
    prompt: 'Loisirs et culture pèsent-ils plus, ou moins, que la justice ?',
    hint: 'Les deux lignes du même tableau.',
    options: [
      { id: 'more', label: 'Plus que la justice' },
      { id: 'same', label: 'À peu près autant' },
      { id: 'less', label: 'Moins que la justice' },
    ],
    correctId: cultureSide,
    ...COMPTES,
    body: [
      `Loisirs et culture : ${md(cultureMd)}. Justice : ${md(justiceMd)}. Intérieur — police et sécurité civile — : ${md(interieurMd)}.`,
    ],
    sources: [
      chip('dep_loisirs_culture_2024_md', { label: 'Insee, loisirs et culture' }),
      chip('dep_justice_2024_md', { label: 'Insee, justice' }),
      chip('dep_interieur_2024_md', { label: 'Insee, intérieur' }),
    ],
    more: DEPIN,
  };

  const chomage: ChoiceQuestion = {
    id: 'chomage',
    kind: 'choice',
    eyebrow: `Insee, comptes nationaux, ${yearBit}`,
    prompt:
      'Les allocations chômage dépassent-elles le budget de l’intérieur, police et sécurité civile comprises ?',
    hint: 'Toujours le même tableau.',
    options: [
      { id: 'yes', label: 'Oui, elles dépassent l’intérieur' },
      { id: 'no', label: 'Non, l’intérieur est plus lourd' },
    ],
    correctId: chomageMd > interieurMd ? 'yes' : 'no',
    ...COMPTES,
    body: [
      `Allocations chômage : ${md(chomageMd)}. Intérieur : ${md(interieurMd)}. Justice : ${md(justiceMd)}.`,
      chomageMd > justiceMd
        ? `Rapportée à la justice, la ligne chômage pèse ${formatNumber(chomageMd / justiceMd, { decimals: 1 })} fois plus.`
        : `La justice est la plus petite des trois.`,
    ],
    sources: [
      chip('dep_chomage_2024_md', { label: 'Insee, allocations chômage' }),
      chip('dep_interieur_2024_md', { label: 'Insee, intérieur' }),
      chip('dep_justice_2024_md', { label: 'Insee, justice' }),
    ],
    more: DEPIN,
  };

  const retraites: ChoiceQuestion = {
    id: 'retraites',
    kind: 'choice',
    eyebrow: SPEND.eyebrow(yearBit),
    prompt:
      'Les retraites, à elles seules, pèsent-elles plus que la sécurité et l’éducation réunies ?',
    hint: spent,
    options: [
      { id: 'yes', label: 'Oui, davantage que les deux réunies' },
      { id: 'no', label: 'Non, les deux réunies pèsent plus' },
    ],
    correctId: retraitesPct > secuPct + eduPct ? 'yes' : 'no',
    ...COMPTES,
    body: [
      shareLine(retraitesMd, retraitesPct, totalMd),
      `La sécurité fait ${formatPercentPoints(secuPct, { decimals: 1 })}, l’éducation ${formatPercentPoints(eduPct, { decimals: 1 })}. La santé, à côté des retraites, fait ${md(santeMd)}, soit ${formatPercentPoints(santePct, { decimals: 1 })}.`,
      foyerLine(retraitesMd),
    ],
    sources: [
      chip('dep_retraites_2024_md', { label: 'Insee, retraites' }),
      chip('dep_education_2024_md', { label: 'Insee, éducation' }),
      chip('dep_sante_2024_md', { label: 'Insee, santé' }),
      chip('dep_part_securite_pct', { label: 'Insee, calcul du site' }),
    ],
    more: DEPIN,
  };

  const niches: ChoiceQuestion = {
    id: 'niches',
    kind: 'choice',
    eyebrow: `PLF, niches et taux réduits, ${yearOf('niches_total_md') || yearBit}`,
    prompt: 'Niches fiscales et taux réduits de TVA réunis coûtent-ils plus cher que l’éducation ?',
    hint: 'La question porte sur les niches et les taux réduits de TVA réunis.',
    options: [
      { id: 'yes', label: 'Oui, davantage que l’éducation' },
      { id: 'no', label: 'Non, moins que l’éducation' },
    ],
    correctId: nichesMd > eduMd ? 'yes' : 'no',
    hitText: 'C’est le sens du total large.',
    missText: 'Le total large va dans l’autre sens.',
    answerLead: 'Le décompte',
    body: [
      `${formatInteger(num('niches_nombre'))} niches fiscales coûtent ${md(nichesSeulesMd)}. L’éducation fait ${md(eduMd)}.`,
      `${formatInteger(num('niches_total_nombre'))} en ajoutant les taux réduits de TVA, pour ${md(nichesMd)}.`,
      foyerLine(nichesMd),
    ],
    caveat: {
      tone: 'note',
      title: 'Deux périmètres',
      text: 'Les niches seules ont un coût. Niches et taux réduits de TVA réunis en ont un autre. Les deux figurent ici. Le nombre arrondi annoncé et le tableau du projet de loi détaillent chacun leur périmètre.',
    },
    sources: [
      chip('niches_nombre', { label: 'PLF, niches' }),
      chip('niches_cout_2024_md', { label: 'PLF, coût des niches' }),
      chip('niches_total_nombre', { label: 'Niches et taux réduits' }),
      chip('niches_total_md', { label: 'Coût du total large' }),
      chip('dep_education_2024_md', { label: 'Insee, éducation' }),
    ],
    more: { href: '/comprendre/niches/', label: 'Voir les niches, une par une' },
  };

  const jour = num('dep_par_foyer_jour_eur');
  const jourSite = perFoyerDay(totalMd);
  const parJour: ScaleQuestion = {
    id: 'jour',
    kind: 'scale',
    eyebrow: 'Dépense publique, par jour',
    prompt: 'Combien l’État dépense-t-il par foyer et par jour ?',
    hint: `On part de « ${cited('dep_par_foyer_manifeste_eur')} ».`,
    min: 0,
    max: JOUR_SCALE_MAX,
    step: 5,
    unit: '€',
    decimals: 0,
    truth: jour,
    truthLabel: formatEuro(jour, { decimals: 0 }),
    closeAbs: 15,
    marker: 'annonce',
    answerLead: 'Le chiffre',
    body: [
      `${formatEuro(num('dep_par_foyer_manifeste_eur'), { decimals: 0 })} divisés par les jours de l’année, cela fait ${formatEuro(jour, { decimals: 0 })} par jour.`,
      `Le même total Insee (${md(totalMd)}) divisé par ${FOYERS_LABEL} fait ${formatEuro(jourSite, { decimals: 0 })} par jour. ${FOYERS_NOTE}`,
    ],
    caveat: {
      tone: 'note',
      title: 'Deux façons de couper le même total',
      text: 'Le montant annuel annoncé ne dit pas quel foyer il divise. Le site divise le total Insee par le dénominateur des fiches, rappelé juste au-dessus. Les deux résultats ne mesurent pas la même chose.',
    },
    sources: [
      chip('dep_par_foyer_manifeste_eur', { label: 'Annonce' }),
      chip('dep_par_foyer_jour_eur', { label: 'Annonce, divisée par le site' }),
      chip('dep_total_2024_md', { label: 'Insee, total' }),
      chip('fiche_pop_foyers', { label: 'Fiches, dénominateur du site' }),
    ],
    more: { href: '/methode/', label: 'Voir les dénominateurs « par foyer »' },
  };

  const impots: ScaleQuestion = {
    id: 'impots',
    kind: 'scale',
    eyebrow: 'Décompte annoncé',
    prompt: 'Combien d’impôts différents existe-t-il ?',
    hint: 'Le décompte annoncé des impôts distincts.',
    min: 0,
    max: IMPOT_SCALE_MAX,
    step: 10,
    unit: 'count',
    noun: 'impôts',
    entryLabel: 'ou un nombre d’impôts',
    decimals: 0,
    truth: num('impots_nombre_manifeste'),
    truthLabel: `${formatInteger(num('impots_nombre_manifeste'))} impôts`,
    closeAbs: 40,
    marker: 'annonce',
    answerLead: 'Le décompte',
    body: [
      `${formatInteger(num('impots_nombre_manifeste'))} impôts.`,
      `À côté : « ${cited('impots_cibles_manifeste')} ». Et : « ${cited('impots_75pct_recettes_manifeste')} ».`,
    ],
    caveat: {
      tone: 'announced',
      title: 'Ordre de grandeur annoncé',
      text: 'Le nombre d’impôts et la part des quatre impôts viennent de l’annonce, en dehors des tableaux de la comptabilité nationale.',
    },
    sources: [
      chip('impots_nombre_manifeste', { label: 'Annonce' }),
      chip('impots_cibles_manifeste', { label: 'Annonce, quatre impôts' }),
      chip('impots_75pct_recettes_manifeste', { label: 'Annonce, part des recettes' }),
    ],
    more: { href: '/comprendre/le-plan/', label: 'Voir ce que le plan propose à la place' },
  };

  const cerfa: ScaleQuestion = {
    id: 'cerfa',
    kind: 'scale',
    eyebrow: 'Décompte annoncé',
    prompt: 'Combien de formulaires CERFA existe-t-il ?',
    hint: 'Ordre de grandeur annoncé.',
    min: 0,
    max: CERFA_SCALE_MAX,
    step: 50,
    unit: 'count',
    noun: 'formulaires',
    entryLabel: 'ou un nombre de formulaires',
    decimals: 0,
    truth: num('cerfa_nombre_manifeste'),
    truthLabel: `${formatInteger(num('cerfa_nombre_manifeste'))} formulaires`,
    closeAbs: 250,
    marker: 'annonce',
    answerLead: 'Le décompte',
    body: [`${formatInteger(num('cerfa_nombre_manifeste'))} formulaires, dans la même phrase que les impôts et les niches.`],
    caveat: {
      tone: 'announced',
      title: 'Annonce',
      text: 'Ordre de grandeur annoncé. La liste des formulaires n’accompagne pas le chiffre.',
    },
    sources: [chip('cerfa_nombre_manifeste', { label: 'Annonce' })],
    more: { href: '/comprendre/le-plan/', label: 'Voir le plan de simplification' },
  };

  const combos = num('charges_sociales_combinaisons_manifeste');
  const combinaisons: ChoiceQuestion = {
    id: 'combinaisons',
    kind: 'choice',
    eyebrow: 'Ordre de grandeur annoncé',
    prompt: 'Combien de combinaisons faut-il pour calculer un taux de charges sociales ?',
    hint: 'Image du maquis des cotisations.',
    options: [
      { id: 'hundreds', label: 'Quelques centaines' },
      { id: 'millions', label: 'Quelques millions' },
      { id: 'billion', label: 'Plus d’un milliard' },
    ],
    correctId: combos >= 1 ? 'billion' : combos >= 0.001 ? 'millions' : 'hundreds',
    hitText: 'C’est l’ordre de grandeur annoncé.',
    missText: 'L’ordre de grandeur est autre.',
    answerLead: 'Le chiffre',
    body: [
      `${formatNumber(combos, { decimals: 1 })} ${combos >= 2 ? 'milliards' : 'milliard'} de combinaisons, pour un seul taux de charges.`,
    ],
    caveat: {
      tone: 'announced',
      title: 'Ordre de grandeur annoncé',
      text: 'La phrase donne le milliard sans détailler le calcul. On la rapporte telle quelle.',
    },
    sources: [chip('charges_sociales_combinaisons_manifeste', { label: 'Annonce' })],
    more: { href: '/comprendre/le-plan/', label: 'Voir la simplification proposée' },
  };

  const motsM = num('droit_mots_2026') / 1_000_000;
  const mots: ScaleQuestion = {
    id: 'mots',
    kind: 'scale',
    eyebrow: `Volume du droit applicable, ${yearOf('droit_mots_2026')}`,
    prompt: 'Le droit applicable compte combien de millions de mots ?',
    hint: 'Textes législatifs et réglementaires en vigueur.',
    min: 0,
    max: MOTS_SCALE_MAX,
    step: 1,
    unit: 'count',
    noun: 'millions de mots',
    entryLabel: 'ou un nombre de millions',
    decimals: 1,
    truth: motsM,
    truthLabel: `${formatNumber(motsM, { decimals: 1 })} millions de mots`,
    closeAbs: 8,
    marker: 'calcul',
    answerLead: 'Le calcul',
    body: [
      `${formatInteger(num('droit_mots_2026'))} mots en ${yearOf('droit_mots_2026')}, contre ${formatInteger(num('droit_mots_2005'))} en ${yearOf('droit_mots_2005')} — ${formatNumber(num('droit_mots_multiple'), { decimals: 1 })} fois plus.`,
      `Le réglementaire (${formatInteger(num('droit_mots_reglementaire_2026'))} mots) pèse ${formatNumber(num('droit_mots_reglementaire_2026') / num('droit_mots_legislatif_2026'), { decimals: 1 })} fois le législatif (${formatInteger(num('droit_mots_legislatif_2026'))} mots).`,
      `Le chiffre annoncé arrondit à ${formatInteger(num('droit_mots_manifeste'))} mots, et le plan propose de diviser ce volume au moins par ${formatInteger(num('droit_mots_cible_diviseur'))}.`,
    ],
    sources: [
      chip('droit_mots_2026', { label: 'Volume calculé' }),
      chip('droit_mots_2005', { label: 'Volume en 2005' }),
      chip('droit_mots_reglementaire_2026', { label: 'Part réglementaire' }),
      chip('droit_mots_legislatif_2026', { label: 'Part législative' }),
      chip('droit_mots_manifeste', { label: 'Annonce, arrondi' }),
    ],
    more: { href: '/comprendre/le-plan/', label: 'Voir la réécriture des codes' },
  };

  const agences = num('agences_etat_avant');
  const dissoutes = num('agences_dissoutes_loi');
  const agencies: ScaleQuestion = {
    id: 'agences',
    kind: 'scale',
    eyebrow: 'Décompte annoncé',
    prompt: 'Combien d’agences nationales existe-t-il ?',
    hint: 'Opérateurs, autorités, commissions. Décompte annoncé.',
    min: 0,
    max: AGENCY_SCALE_MAX,
    step: 50,
    unit: 'count',
    noun: 'agences',
    entryLabel: 'ou un nombre d’agences',
    decimals: 0,
    truth: agences,
    truthLabel: `${formatInteger(agences)} agences`,
    closeAbs: 250,
    marker: 'annonce',
    answerLead: 'Le décompte',
    body: [
      `${formatInteger(agences)} agences nationales. Le tableau en laisse ${formatInteger(num('agences_etat_apres'))}.`,
      `${formatInteger(dissoutes)} personnes morales sont nommées dans l’amendement proposé. Les deux listes n’ont pas de table de correspondance.`,
      `${formatInteger(num('etat_ministeres_avant'))} ministères aujourd’hui, ${formatInteger(num('etat_ministeres_apres'))} dans le plan.`,
    ],
    caveat: {
      tone: 'note',
      title: 'Deux chiffres, deux périmètres',
      text: 'Le décompte des agences est une annonce. Le nombre de dissolutions est le texte d’un amendement rédigé, en attente de dépôt et de vote. Chaque chiffre garde son périmètre.',
    },
    sources: [
      chip('agences_etat_avant', { label: 'Chiffrage publié' }),
      chip('agences_etat_apres', { label: 'Chiffrage publié, après' }),
      chip('agences_dissoutes_loi', { label: 'Amendement proposé' }),
      chip('etat_ministeres_avant', { label: 'Annonce, ministères' }),
    ],
    more: { href: '/comprendre/agences/', label: 'Voir le sort des agences' },
  };

  const locaux: ScaleQuestion = {
    id: 'locaux',
    kind: 'scale',
    eyebrow: 'Organismes locaux',
    prompt: 'À côté des agences nationales, combien d’organismes locaux existe-t-il ?',
    hint: 'Organismes locaux (ODAL), en plus des agences nationales.',
    min: 0,
    max: LOCAL_SCALE_MAX,
    step: 500,
    unit: 'count',
    noun: 'organismes',
    entryLabel: 'ou un nombre d’organismes',
    decimals: 0,
    truth: num('agences_locales'),
    truthLabel: `${formatInteger(num('agences_locales'))} organismes`,
    closeAbs: 2_000,
    marker: 'annonce',
    answerLead: 'Le décompte',
    body: [
      `${formatInteger(num('agences_locales'))} organismes locaux, à côté des ${formatInteger(agences)} agences nationales.`,
      `Additionnés, cela fait ${formatInteger(num('agences_total_avec_locales'))}.`,
    ],
    caveat: {
      tone: 'note',
      title: 'Chiffre du chiffrage publié',
      text: 'Ce nombre vient du chiffrage publié. Le décompte des agences nationales est un autre chiffre.',
    },
    sources: [
      chip('agences_locales', { label: 'Chiffrage, organismes locaux' }),
      chip('agences_etat_avant', { label: 'Chiffrage, agences nationales' }),
      chip('agences_total_avec_locales', { label: 'Chiffrage, total' }),
    ],
    more: { href: '/comprendre/etat-partout/', label: 'Voir où l’État est présent' },
  };

  const stateK = num('fp_fpe_2023_k');
  const allK = num('fp_effectifs_2023_k');
  const agents: ChoiceQuestion = {
    id: 'agents',
    kind: 'choice',
    eyebrow: `DGAFP, effectifs au 31 décembre ${yearOf('fp_effectifs_2023_k')}`,
    prompt: 'Les agents de l’État sont-ils la majorité des agents des trois fonctions publiques ?',
    hint: 'État, territoriale, hospitalière. Personnes physiques.',
    options: [
      { id: 'yes', label: 'Oui, ils sont la majorité' },
      { id: 'no', label: 'Non, ils sont moins de la moitié' },
    ],
    correctId: stateK > allK / 2 ? 'yes' : 'no',
    hitText: 'C’est le sens du rapport.',
    missText: 'Le rapport dit l’autre chose.',
    answerLead: 'Le rapport',
    body: [
      `${heads('fp_fpe_2023_k')} à l’État, ${heads('fp_fpt_2023_k')} dans la territoriale, ${heads('fp_fph_2023_k')} à l’hôpital, sur ${heads('fp_effectifs_2023_k')}.`,
      `L’État fait ${formatPercentPoints((stateK / allK) * 100, { decimals: 0 })} du total. La territoriale et l’hôpital, réunis, font le reste.`,
      `Parmi l’ensemble, ${heads('fp_contractuels_2023_k')} sont contractuels.`,
    ],
    sources: [
      chip('fp_effectifs_2023_k', { label: 'DGAFP, total' }),
      chip('fp_fpe_2023_k', { label: 'DGAFP, État' }),
      chip('fp_fpt_2023_k', { label: 'DGAFP, territoriale' }),
      chip('fp_fph_2023_k', { label: 'DGAFP, hospitalière' }),
      chip('fp_contractuels_2023_k', { label: 'DGAFP, contractuels' }),
    ],
    more: { href: '/comprendre/etat-partout/', label: 'Voir les effectifs' },
  };

  const indemnite: ScaleQuestion = {
    id: 'indemnite',
    kind: 'scale',
    eyebrow: 'Amendement proposé',
    prompt:
      'Si un emploi public est supprimé, quelle part du traitement l’amendement maintient-il ?',
    hint: 'Part du traitement de base, dans l’amendement proposé.',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    decimals: 0,
    truth: num('indemnite_sortie_taux_pct'),
    truthLabel: formatPercentPoints(num('indemnite_sortie_taux_pct'), { decimals: 0 }),
    closeAbs: 5,
    marker: 'texte',
    answerLead: 'L’amendement',
    body: [
      `${formatPercentPoints(num('indemnite_sortie_taux_pct'), { decimals: 0 })} du traitement, jusqu’à ${formatInteger(num('indemnite_sortie_duree_max_ans'))} ans pour les agents qui ont le plus d’ancienneté.`,
      `Le même texte ferme ${formatInteger(num('emplois_etat_fermes_annee_pleine_loi'))} emplois d’État en année pleine.`,
      `Le chiffrage additionne ${formatInteger(num('postes_fermes_apuc_plus_apul'))} postes, dont ${formatInteger(num('postes_fermes_apul_classeur'))} dans les collectivités. Le chiffre annoncé arrondit à ${formatInteger(num('postes_publics_fermes_manifeste'))}. L’amendement compte, lui, les emplois d’État.`,
    ],
    caveat: {
      tone: 'note',
      title: 'Deux décomptes',
      text: 'L’indemnité et les emplois d’État fermés sont dans l’amendement proposé, encore à déposer. Les postes locaux sont une case du chiffrage.',
    },
    sources: [
      chip('indemnite_sortie_taux_pct', { label: 'Amendement proposé' }),
      chip('indemnite_sortie_duree_max_ans', { label: 'Amendement, durée maximale' }),
      chip('emplois_etat_fermes_annee_pleine_loi', { label: 'Amendement, emplois d’État' }),
      chip('postes_fermes_apul_classeur', { label: 'Chiffrage, collectivités' }),
      chip('postes_fermes_apuc_plus_apul', { label: 'Chiffrage, total' }),
      chip('postes_publics_fermes_manifeste', { label: 'Annonce' }),
    ],
    more: { href: '/comprendre/amendements/', label: 'Lire l’amendement' },
  };

  const ratioEuro = num('eu_revenu_median_ratio_ch_fr');
  const ratioSpa = num('eu_revenu_median_ratio_ch_fr_spa');
  const suisseId = ratioEuro >= 1.75 ? 'double' : ratioEuro >= 1.2 ? 'bit' : 'same';
  const suisse: ChoiceQuestion = {
    id: 'suisse',
    kind: 'choice',
    eyebrow: `Eurostat, euros courants, ${yearOf('eu_revenu_median_fr_eur')}`,
    prompt: 'En euros courants, le revenu médian suisse vaut à peu près quoi, face au français ?',
    hint: 'Revenu médian équivalent, en euros courants.',
    options: [
      { id: 'same', label: 'À peu près le même' },
      { id: 'bit', label: 'Environ un quart de plus' },
      { id: 'double', label: 'Environ le double' },
    ],
    correctId: suisseId,
    hitText: 'C’est le rapport en euros courants.',
    missText: 'En euros courants, le rapport est autre.',
    answerLead: 'La table',
    body: [
      `${formatEuro(num('eu_revenu_median_ch_mois_eur'), { decimals: 0 })} par mois en Suisse, ${formatEuro(num('eu_revenu_median_fr_mois_eur'), { decimals: 0 })} en France. Rapport : ${formatNumber(ratioEuro, { decimals: 1 })}.`,
      `En standards de pouvoir d’achat, le même rapport tombe à ${formatNumber(ratioSpa, { decimals: 2 })}. La comparaison annoncée est en euros courants (« ${cited('eu_revenu_median_fr_manifeste_mois')} », « ${cited('eu_revenu_median_ch_manifeste_mois')} »).`,
    ],
    caveat: {
      tone: 'note',
      title: 'Euros courants, puis pouvoir d’achat',
      text: 'En euros, la Suisse est autour du double. Une fois les prix retranchés, l’écart se resserre. La comparaison annoncée est en euros courants.',
    },
    sources: [
      chip('eu_revenu_median_ch_eur', { label: 'Eurostat, Suisse' }),
      chip('eu_revenu_median_fr_eur', { label: 'Eurostat, France' }),
      chip('eu_revenu_median_ratio_ch_fr', { label: 'Rapport en euros, calcul du site' }),
      chip('eu_revenu_median_ratio_ch_fr_spa', { label: 'Rapport en pouvoir d’achat' }),
      chip('eu_revenu_median_fr_manifeste_mois', { label: 'Annonce' }),
    ],
    more: { href: '/comprendre/europe/', label: 'Voir la France face à l’Europe' },
  };

  const hourTotal = num('va_heure_total_eur');
  const hourNet = num('va_heure_salaire_net_eur');
  const hourState = num('va_heure_etat_eur');
  const hourCapital = num('va_heure_capital_eur');
  const hour: ScaleQuestion = {
    id: 'heure',
    kind: 'scale',
    eyebrow: 'Partage annoncé d’une heure de travail',
    prompt: 'Sur la valeur d’une heure de travail, combien d’euros restent au salarié, en net ?',
    hint: `On part d’une heure qui crée ${formatEuro(hourTotal)} de valeur. Partage annoncé, en dehors des comptes de l’Insee.`,
    min: 0,
    max: hourTotal,
    step: 1,
    unit: '€',
    decimals: 0,
    truth: hourNet,
    truthLabel: formatEuro(hourNet),
    closeAbs: 4,
    marker: 'annonce',
    answerLead: 'Le chiffre',
    body: [
      `Sur ${formatEuro(hourTotal)}, ${formatEuro(hourNet)} reviennent au salarié, ${formatEuro(hourState)} aux prélèvements et ${formatEuro(hourCapital)} au capital.`,
    ],
    caveat: {
      tone: 'announced',
      title: 'Ordre de grandeur annoncé',
      text: 'L’onglet ne cite pas de source externe. Pour votre propre paie, c’est le simulateur qui calcule.',
    },
    sources: [
      chip('va_heure_total_eur', { label: 'Chiffrage publié' }),
      chip('va_heure_salaire_net_eur', { label: 'Chiffrage publié, salaire net' }),
      chip('va_heure_etat_eur', { label: 'Chiffrage publié, prélèvements' }),
      chip('va_heure_capital_eur', { label: 'Chiffrage publié, capital' }),
    ],
    more: { href: '/simulateur/', label: 'Calculer pour mon foyer' },
  };

  const kept = num('ir_retention_marginale_calc') * 100;
  const reste: ScaleQuestion = {
    id: 'reste',
    kind: 'scale',
    eyebrow: 'Taux unique de l’amendement',
    prompt:
      'Avec le taux unique écrit dans l’amendement, quelle part d’un euro de plus reste au foyer ?',
    hint: `L’amendement pose un impôt égal à ${formatPercentPoints(num('ir_taux_unique_pct'), { decimals: 0 })} du revenu.`,
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    decimals: 0,
    truth: kept,
    truthLabel: formatPercentPoints(kept, { decimals: 0 }),
    closeAbs: 4,
    marker: 'calcul',
    answerLead: 'Le calcul',
    body: [
      `${formatPercentPoints(num('ir_taux_unique_pct'), { decimals: 0 })} d’impôt, donc ${formatPercentPoints(kept, { decimals: 0 })} restent, quel que soit le revenu.`,
      `La fiche du travailleur le dit : « ${cited('ir_retention_marginale_fiche')} ». L’aide fondamentale, elle, est de ${formatEuro(num('afu_adulte_eur_mois'), { decimals: 0 })} par adulte et par mois, plus ${formatEuro(num('afu_enfant_eur_mois'), { decimals: 0 })} par enfant — à soustraire de cet impôt.`,
    ],
    caveat: {
      tone: 'note',
      title: 'Le taux écrit dans l’amendement',
      text: 'Le taux unique est dans un amendement proposé. Le simulateur part du barème en vigueur, puis applique ce texte à un foyer précis.',
    },
    sources: [
      chip('ir_taux_unique_pct', { label: 'Amendement proposé' }),
      chip('ir_retention_marginale_calc', { label: 'Calcul du site, un moins le taux' }),
      chip('ir_retention_marginale_fiche', { label: 'Fiche Travailleur' }),
      chip('afu_adulte_eur_mois', { label: 'Amendement, aide adulte' }),
      chip('afu_enfant_eur_mois', { label: 'Amendement, aide enfant' }),
    ],
    more: { href: '/simulateur/', label: 'Calculer pour mon foyer' },
  };

  const rank = num('eu_dep_rang_fr_2024');
  const nPays = europeData().rows.filter((r) => r.dep24 !== null).length;
  const rankLabel = rank === 1 ? '1er' : `${formatInteger(rank)}e`;
  const fr = num('eu_dep_pib_fr_2024_pct');
  const fi = num('eu_dep_pib_fi_2024_pct');
  const ea = num('eu_dep_pib_ea20_2024_pct');
  const europe: ChoiceQuestion = {
    id: 'europe',
    kind: 'choice',
    eyebrow: `Eurostat · part du PIB, ${yearBit}`,
    prompt:
      'La France est-elle le pays européen qui consacre la plus grande part de son PIB aux dépenses publiques ?',
    hint: 'Parmi les pays de la table Eurostat.',
    options: [
      { id: 'first', label: 'Oui, elle est première' },
      { id: 'second', label: 'Non, elle est deuxième' },
      { id: 'middle', label: 'Non, elle est dans le milieu du classement' },
    ],
    correctId: rank === 1 ? 'first' : rank === 2 ? 'second' : 'middle',
    hitText: 'C’est le rang de la table.',
    missText: 'La table donne un autre rang.',
    answerLead: 'La table',
    body: [
      `Dans la table Eurostat, la France est au ${rankLabel} rang sur ${formatInteger(nPays)} pays (rang calculé par le site) : ${formatPercentPoints(fr, { decimals: 1 })} du PIB, la Finlande ${formatPercentPoints(fi, { decimals: 1 })}, la zone euro ${formatPercentPoints(ea, { decimals: 1 })}.`,
      `Ailleurs, on lit : « ${cited('dep_par_foyer_manifeste_eur')} ». Cette phrase porte sur un montant par foyer. Ce montant utilise ${formatNumber(num('foyers_implicites_dep_m'), { decimals: 3 })} millions de foyers. Les montants par foyer des questions précédentes qui suivent les fiches utilisent ${FOYERS_LABEL}.`,
    ],
    caveat:
      rank > 1
        ? {
            tone: 'note',
            title: 'Un montant par foyer, un rang en part du PIB',
            text: 'Le « record » porte sur un montant par foyer. Dans la table des dépenses en part du PIB, un autre pays est devant.',
          }
        : undefined,
    sources: [
      chip('eu_dep_pib_fr_2024_pct', { label: 'Eurostat' }),
      chip('eu_dep_pib_fi_2024_pct', { label: 'Eurostat, Finlande' }),
      chip('eu_dep_rang_fr_2024', { label: 'Eurostat, calcul du site' }),
      chip('dep_par_foyer_manifeste_eur', { label: 'Annonce' }),
      chip('foyers_implicites_dep_m', { label: 'Dénominateur annoncé, calcul du site' }),
    ],
    more: { href: '/comprendre/europe/', label: 'Voir la France face à l’Europe' },
  };

  return [
    securite,
    dette,
    culture,
    chomage,
    retraites,
    niches,
    parJour,
    impots,
    cerfa,
    combinaisons,
    mots,
    agencies,
    locaux,
    agents,
    indemnite,
    suisse,
    hour,
    reste,
    europe,
  ];
}
