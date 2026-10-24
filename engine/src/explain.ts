/**
 * v1.1 « after user testing »: plain-language outputs of compare().
 * - `summary`: one sentence, top 3 gains and losses, the main driver, and what is certain;
 * - `baselineBenefitsExplained`: today's main benefits, with the rule that zeroed those at 0 €.
 * Reasons are derived from the same rule conditions as src/core.ts (and re-run the rule when the cause is
 * ambiguous, e.g. income vs rent for the housing aid), never guessed.
 */
import { apl } from './baseline/aides-logement.ts';
import { cmgActivityOk } from './core.ts';
import { eur0 } from './fmt.ts';
import { n } from './params/index.ts';
import type { Evaluated } from './simulate.ts';
import type {
  BenefitExplained,
  Component,
  ComponentId,
  Summary,
  SummaryLine,
  Tier,
  WaterfallStep,
} from './types.ts';

/** « of » form of each line (« la fin DU revenu de solidarité active »), acronyms expanded. */
const OF: Record<ComponentId, string> = {
  salaire_net: 'de votre salaire net',
  are: 'de votre allocation chômage',
  pension_nette: 'de votre pension de retraite nette',
  impot_revenu: 'de votre impôt sur le revenu',
  credits_impot: 'de vos crédits et réductions d’impôt (garde d’enfants, emploi à domicile, dons)',
  afu: 'de l’aide fondamentale universelle',
  rsa: 'du revenu de solidarité active (RSA)',
  prime_activite: 'de la prime d’activité',
  aides_logement: 'de l’aide personnalisée au logement (APL)',
  allocations_familiales: 'des allocations familiales',
  complement_familial: 'du complément familial',
  paje_base:
    'de l’allocation de base pour les moins de 3 ans (prestation d’accueil du jeune enfant, PAJE)',
  cmg: 'de l’aide pour faire garder votre enfant (complément de libre choix du mode de garde, CMG)',
  ars: 'de l’allocation de rentrée scolaire',
  asf: 'de l’allocation de soutien familial (versée aux parents seuls)',
  aeeh: 'de l’allocation d’éducation de l’enfant handicapé (AEEH)',
  aah: 'de l’allocation aux adultes handicapés (AAH)',
  aspa: 'du minimum vieillesse (allocation de solidarité aux personnes âgées, ASPA)',
  aides_caf_declarees: 'des aides de la caisse d’allocations familiales que vous avez déclarées',
  tva: 'des prix (taxe sur la valeur ajoutée, TVA, estimation)',
  cee: 'de vos factures d’énergie (fin des certificats d’économies d’énergie, estimation)',
};

/** Short names for the certainty sentence (no acronym). */
const SHORT: Record<ComponentId, string> = {
  salaire_net: 'salaire net',
  are: 'allocation chômage',
  pension_nette: 'pension',
  impot_revenu: 'impôt sur le revenu',
  credits_impot: 'crédits d’impôt',
  afu: 'aide universelle',
  rsa: 'revenu de solidarité active',
  prime_activite: 'prime d’activité',
  aides_logement: 'aide au logement',
  allocations_familiales: 'allocations familiales',
  complement_familial: 'complément familial',
  paje_base: 'allocation de base du jeune enfant',
  cmg: 'aide à la garde d’enfant',
  ars: 'allocation de rentrée scolaire',
  asf: 'allocation de soutien familial',
  aeeh: 'allocation pour enfant handicapé',
  aah: 'allocation aux adultes handicapés',
  aspa: 'minimum vieillesse',
  aides_caf_declarees: 'aides déclarées',
  tva: 'hausse des prix (TVA)',
  cee: 'factures d’énergie',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const r5 = (x: number) => {
  const r = Math.round(x / 5) * 5;
  return Object.is(r, -0) ? 0 : r;
};

/** Plain phrase (lower-case, in-sentence) for one waterfall step. */
function phrase(e: Evaluated, w: WaterfallStep): string {
  const plan = e.plan!.components.find((c) => c.id === w.id)!;
  const kids = e.nh.children.some((k) => k.age < n('plan.afu_child_max_age'));
  const flat = e.planCore!.tax.regime === 'flat';
  switch (w.id) {
    case 'afu':
      return `l’aide universelle de ${eur0(n('plan.afu_adult') / 12)} par adulte${kids ? ` et ${eur0(n('plan.afu_child') / 12)} par enfant` : ''} (aide fondamentale universelle, AFU)`;
    case 'salaire_net':
      return w.delta > 0
        ? 'la hausse de votre salaire net (fin de la CSG et de la CRDS, les prélèvements sociaux sur les salaires)'
        : 'la baisse de votre salaire net';
    case 'impot_revenu':
      return w.delta < 0
        ? `la hausse de votre impôt sur le revenu${flat ? ` (taux unique de 23 %${e.nh.children.length > 0 ? ', sans réduction pour les enfants' : ''})` : ''}`
        : 'la baisse de votre impôt sur le revenu';
    case 'tva':
      return w.delta < 0 ? `la hausse ${OF.tva}` : `la baisse ${OF.tva}`;
    case 'cee':
      return w.delta > 0 ? `la baisse ${OF.cee}` : `la hausse ${OF.cee}`;
    default:
      if (w.delta < 0)
        return `${Math.abs(plan.amount) < 0.005 ? 'la fin' : 'la baisse'} ${OF[w.id]}`;
      return `la hausse ${OF[w.id]}`;
  }
}

const TIER_TXT: Record<Tier, string> = {
  law: 'écrit dans les amendements proposés (pas encore votés)',
  announced: 'annoncé par les auteurs, sans texte de loi',
  hypothesis: 'estimé par le simulateur',
};

export function buildSummary(e: Evaluated, waterfall: WaterfallStep[], delta: number): Summary {
  const lines = (sign: 1 | -1): SummaryLine[] =>
    waterfall
      .filter((w) => sign * w.delta > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
      .map((w) => ({ label: cap(phrase(e, w)), amount: w.delta }));
  const gains = lines(1);
  const losses = lines(-1);

  // ---- sentence --------------------------------------------------------------------------------------------
  const lead =
    e.period === 'steady'
      ? 'Avec le plan complet appliqué à votre situation de 2026, votre ménage aurait'
      : `En ${e.period}, avec les mesures alors en vigueur, votre ménage aurait`;
  const d5 = r5(delta);
  const afterTva = r5(e.plan!.disposableAfterTva - e.baseline.disposableAfterTva);
  let sentence: string;
  if (d5 === 0)
    sentence = `${lead} à peu près le même revenu qu’aujourd’hui (moins de 5 € d’écart par mois).`;
  else sentence = `${lead} environ ${eur0(Math.abs(d5))} de ${d5 > 0 ? 'plus' : 'moins'} par mois.`;
  if (e.hyp.includeTva && afterTva !== d5)
    sentence += ` Après la hausse des prix estimée (taxe sur la valeur ajoutée), l’écart serait de ${afterTva > 0 ? '+' : afterTva < 0 ? '−' : ''}${eur0(Math.abs(afterTva))} par mois.`;

  // ---- why: main driver among the lines of the headline (TVA excluded) -------------------------------------
  const head = waterfall.filter((w) => w.id !== 'tva' && w.id !== 'cee');
  const pos = head.filter((w) => w.delta > 0).sort((a, b) => b.delta - a.delta);
  const neg = head.filter((w) => w.delta < 0).sort((a, b) => a.delta - b.delta);
  const sumPos = pos.reduce((s, w) => s + w.delta, 0);
  const sumNeg = -neg.reduce((s, w) => s + w.delta, 0);
  let why: string;
  if (head.length === 0) why = 'Le plan ne change aucune ligne de votre revenu.';
  else if (d5 === 0)
    why =
      pos[0] && neg[0]
        ? `Les gains et les pertes s’équilibrent à peu près : ${phrase(e, pos[0])} compense ${phrase(e, neg[0])}.`
        : 'Les changements sont trop petits pour compter.';
  else if (delta > 0)
    why = neg[0]
      ? `Votre gain vient surtout de ${phrase(e, pos[0]!)}, qui compense ${sumPos >= 1.5 * sumNeg ? 'largement ' : ''}${phrase(e, neg[0])}.`
      : `Votre gain vient de ${phrase(e, pos[0]!)}.`;
  else
    why = pos[0]
      ? `Votre perte vient surtout de ${phrase(e, neg[0]!)}, que ${phrase(e, pos[0])} ne compense pas.`
      : `Votre perte vient de ${phrase(e, neg[0]!)}.`;

  // ---- certainty -----------------------------------------------------------------------------------------
  const byTier = new Map<Tier, { names: string[]; amount: number }>();
  for (const w of waterfall) {
    const t = byTier.get(w.tier) ?? { names: [], amount: 0 };
    if (!t.names.includes(SHORT[w.id])) t.names.push(SHORT[w.id]);
    t.amount += Math.abs(w.delta);
    byTier.set(w.tier, t);
  }
  const parts = (['law', 'announced', 'hypothesis'] as Tier[])
    .filter((t) => byTier.has(t))
    .map((t) => {
      const x = byTier.get(t)!;
      return `${TIER_TXT[t]} : ${x.names.join(', ')} (${eur0(r5(x.amount))} par mois en jeu)`;
    });
  const certainty = parts.length
    ? `Aujourd’hui : la loi en vigueur. Avec le plan — ${parts.join(' ; ')}.`
    : 'Aujourd’hui : la loi en vigueur. Le plan ne change rien de chiffrable pour vous.';
  return { sentence, gains, losses, why, certainty };
}

// ------------------------------------------------------------------------------------------------ benefits
const BENEFITS: Array<{ id: ComponentId; label: string }> = [
  { id: 'aides_logement', label: 'Aide au logement (APL)' },
  { id: 'allocations_familiales', label: 'Allocations familiales' },
  { id: 'complement_familial', label: 'Complément familial' },
  { id: 'paje_base', label: 'Allocation de base du jeune enfant (PAJE)' },
  { id: 'cmg', label: 'Aide pour faire garder un enfant (complément de mode de garde, CMG)' },
  { id: 'ars', label: 'Allocation de rentrée scolaire' },
  { id: 'asf', label: 'Allocation de soutien familial' },
  { id: 'aeeh', label: 'Allocation d’éducation de l’enfant handicapé (AEEH)' },
  { id: 'prime_activite', label: 'Prime d’activité' },
  { id: 'rsa', label: 'Revenu de solidarité active (RSA)' },
  { id: 'aah', label: 'Allocation aux adultes handicapés (AAH)' },
  { id: 'aspa', label: 'Minimum vieillesse (ASPA)' },
];

export function explainBaselineBenefits(e: Evaluated): BenefitExplained[] {
  const { nh } = e;
  const f = e.baselineCore.flows;
  const comp = (id: ComponentId): Component => e.baseline.components.find((c) => c.id === id)!;
  const ages = nh.children.map((c) => c.age);
  const under20 = ages.filter((a) => a < n('benefits.family.af_max_child_age'));
  const nA = nh.adults.length;
  const isolated = nA === 1 && ages.length > 0;
  const ressources = `vos revenus (${eur0(f.rncHousehold)} par an)`;
  const anyEarnings = f.sal.some((s) => (s?.net ?? 0) > 0);
  const cafOverrideNoRight = nh.cafOverride !== null && comp('aides_caf_declarees').amount > 0;

  const reason = (id: ComponentId): string => {
    if (nh.nonRecours) return 'vous avez indiqué ne pas toucher ces aides';
    if (cafOverrideNoRight)
      return 'le simulateur ne vous trouve pas de droit ; le total que vous avez déclaré est compté à part';
    switch (id) {
      case 'aides_logement': {
        if (nh.housing.status !== 'locataire')
          return nh.housing.status === 'gratuit'
            ? 'réservée aux personnes qui paient un loyer (vous êtes hébergé·e gratuitement)'
            : 'réservée aux locataires dans le simulateur (vous êtes propriétaire ; l’aide à l’accession n’est pas modélisée)';
        if (nh.housing.rent <= 0) return 'loyer non renseigné';
        const kids21 = ages.filter((a) => a < 21).length;
        const withoutIncome = apl(nh.housing.zone, nA === 2, kids21, nh.housing.rent, 0).gross;
        return withoutIncome > 0
          ? `${ressources} dépassent le plafond pour votre loyer et votre zone`
          : 'votre loyer dépasse nettement le plafond de votre zone (l’aide diminue puis s’annule quand le loyer est trop élevé)';
      }
      case 'allocations_familiales':
        return 'versées à partir du 2e enfant de moins de 20 ans';
      case 'complement_familial':
        if (ages.filter((a) => a < 21).length < n('benefits.family.cf_min_children'))
          return 'réservé aux familles d’au moins 3 enfants';
        if (ages.some((a) => a < n('benefits.family.cf_min_child_age')))
          return 'versé seulement quand tous les enfants ont au moins 3 ans';
        return `${ressources} dépassent le plafond`;
      case 'paje_base':
        if (!ages.some((a) => a < 3)) return 'versée pour un enfant de moins de 3 ans';
        return `${ressources} dépassent le plafond`;
      case 'cmg':
        if (!ages.some((a) => a < n('x.cmg.max_child_age')))
          return 'versé pour faire garder un enfant de moins de 6 ans';
        if (nh.childcare === 'creche')
          return 'pas pour une crèche municipale ou associative : la caisse d’allocations familiales finance directement la crèche';
        if (nh.childcare !== 'assistante_maternelle' && nh.childcare !== 'micro_creche')
          return 'seulement si vous payez une assistante maternelle, une garde à domicile ou une micro-crèche';
        if (f.childcareCost <= 0) return 'frais de garde à 0 €';
        if (!cmgActivityOk(nh))
          return 'chaque parent doit travailler, être indemnisé par France Travail, étudier ou toucher l’allocation aux adultes handicapés';
        return `${ressources} sont trop élevés : la part laissée à votre charge couvre tout le coût de la garde`;
      case 'ars':
        if (!ages.some((a) => a >= 6 && a <= 18)) return 'versée pour un enfant de 6 à 18 ans';
        return `${ressources} dépassent le plafond`;
      case 'asf':
        if (!isolated) return 'réservée aux parents qui élèvent seuls leurs enfants';
        if (under20.length === 0) return 'versée pour un enfant de moins de 20 ans';
        if (nh.childSupport > 0)
          return `la pension alimentaire que vous recevez (${eur0(nh.childSupport)} par mois) atteint son montant`;
        return 'montant trop faible pour être versé';
      case 'aeeh':
        return 'versée pour un enfant handicapé reconnu par la maison départementale des personnes handicapées';
      case 'prime_activite': {
        if (!anyEarnings) return 'réservée aux personnes qui ont un salaire';
        const studentMin =
          n('x.pa.student_min_earnings_share_of_smic_net') *
          n('general.smic_monthly_net_indicative');
        const eligible = nh.adults.some(
          (a, i) =>
            (f.sal[i]?.net ?? 0) > 0 &&
            a.age >= n('x.pa.min_age') &&
            (a.activity !== 'etudiant' || (f.sal[i]?.net ?? 0) >= studentMin),
        );
        if (!eligible)
          return 'étudiant·e ou apprenti·e : versée seulement à partir de 78 % du SMIC net de salaire';
        return 'les revenus de votre foyer dépassent le niveau où elle s’arrête';
      }
      case 'rsa':
        if (nh.adults.every((a) => a.activity === 'etudiant'))
          return 'pas de RSA pour les étudiant·es';
        if (!nh.adults.some((a) => a.age >= n('benefits.rsa.min_age')) && ages.length === 0)
          return 'à partir de 25 ans (sauf si vous avez un enfant)';
        return 'vos ressources dépassent le montant du revenu de solidarité active';
      case 'aah': {
        const dis = nh.adults.filter((a) => a.disability !== 'none');
        if (dis.length === 0)
          return 'réservée aux personnes handicapées (taux d’incapacité d’au moins 50 %)';
        if (dis.every((a) => a.age < n('x.aah.min_age'))) return 'à partir de 20 ans';
        if (dis.every((a) => a.disability === 'aah_50_79' && a.age >= n('x.aah.age_limit_50_79')))
          return 'taux d’incapacité de 50 à 79 % : versée seulement jusqu’à l’âge de la retraite';
        return 'vos ressources dépassent le montant de l’allocation';
      }
      case 'aspa':
        if (!nh.adults.some((a) => a.age >= n('benefits.aspa.min_age')))
          return 'à partir de 65 ans';
        return 'vos ressources dépassent le minimum vieillesse';
      default:
        return '';
    }
  };

  return BENEFITS.map(({ id, label }) => {
    const amount = comp(id).amount;
    const out: BenefitExplained = { id, label, amount };
    if (Math.abs(amount) < 0.005) out.reason = reason(id);
    return out;
  });
}
