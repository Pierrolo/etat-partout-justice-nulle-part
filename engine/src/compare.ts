/** compare(): baseline vs plan for one household, with waterfall, non-chiffré panels, hypotheses and caveats. */
import { isPaidCare } from './core.ts';
import { buildSummary, explainBaselineBenefits } from './explain.ts';
import { eur, r2 } from './fmt.ts';
import { PERIOD_LABEL } from './plan/periods.ts';
import { evaluate } from './simulate.ts';
import type {
  Comparison,
  Hypotheses,
  ComponentGroup,
  Household,
  SimulateOptions,
  WaterfallStep,
} from './types.ts';
import { unquantifiedFor } from './unquantified.ts';

const GROUP_ORDER: ComponentGroup[] = [
  'revenus',
  'prelevements',
  'prestations',
  'impots_indirects',
];

/** v1.1: deltaPct is null below this baseline disposable income (€/month). */
export const DELTA_PCT_MIN_BASELINE = 50;
/** v1.1: h1Alternative is returned when the two H1 readings differ by more than this (€/month). */
export const H1_ALTERNATIVE_THRESHOLD = 5;

function waterfallOf(e: ReturnType<typeof evaluate>): WaterfallStep[] {
  const { hyp, baseline } = e;
  const plan = e.plan!;
  const waterfall: WaterfallStep[] = [];
  for (const g of GROUP_ORDER) {
    for (const pc of plan.components) {
      if (pc.group !== g) continue;
      if (g === 'impots_indirects' && !hyp.includeTva) continue;
      const bc = baseline.components.find((c) => c.id === pc.id)!;
      const delta = r2(pc.amount - bc.amount);
      if (Math.abs(delta) < 0.005) continue;
      waterfall.push({
        id: pc.id,
        label: pc.label,
        delta,
        tier: pc.tier,
        sources: [
          ...pc.sources,
          ...bc.sources.filter((s) => !pc.sources.some((p) => p.label === s.label)),
        ],
        formulaBefore: bc.formula,
        formulaAfter: pc.formula,
      });
    }
  }
  return waterfall;
}

export function compare(h: Household, opts: SimulateOptions = {}): Comparison {
  const e = evaluate(h, opts, true);
  const { nh, hyp, baseline } = e;
  const plan = e.plan!;
  const waterfall = waterfallOf(e);
  const delta = r2(plan.disposable - baseline.disposable);
  const f = e.baselineCore.flows;
  const today = {
    rsa: f.rsa,
    apl: f.aplGross,
    are: f.are.reduce((s, r) => s + (r?.net ?? 0), 0),
    lowIncome: e.basket.nv < 13_460, // ≈ 1st decile of niveau de vie (INSEE 2023): chèque énergie territory
    anyBenefit: f.rsa + f.pa + f.aplGross + f.af + f.aah.reduce((s, x) => s + x, 0) + f.aspa > 0,
  };

  // ---- hypotheses register (VISION §6) -------------------------------------------------------------------
  const activeHypotheses: Comparison['activeHypotheses'] = [
    {
      id: 'period',
      label: 'Période',
      value: PERIOD_LABEL[String(e.period)] ?? String(e.period),
      tier: 'hypothesis',
    },
    {
      id: 'H1',
      label: 'RSA, prime d’activité, AAH, ASPA',
      value:
        hyp.H1_benefits === 'replaced'
          ? 'remplacés par l’AFU'
          : 'maintenus en différentiel (AFU comptée comme ressource, imposables à 23 %)',
      tier: hyp.H1_benefits === 'replaced' ? 'announced' : 'hypothesis',
    },
    {
      id: 'H2',
      label: 'Déduction de 10 % pour frais professionnels',
      value: hyp.H2_fraisPro10
        ? 'maintenue (0,793 € gardé par euro)'
        : 'supprimée (lecture du plan : 0,77 €)',
      tier: 'hypothesis',
    },
    {
      id: 'H5',
      label: 'Répercussion de la TVA et de la fin des CEE sur les prix',
      value: `${hyp.H5_tvaPassThrough * 100} %`,
      tier: 'hypothesis',
    },
    {
      id: 'includeTva',
      label: 'Lignes TVA affichées',
      value: hyp.includeTva ? 'oui' : 'non',
      tier: 'hypothesis',
    },
    {
      id: 'H3',
      label: 'Revenu imposable du plan',
      value: 'salaire net (sans CSG/CRDS) ; pensions après CSG déductible, sans abattement de 10 %',
      tier: 'law',
    },
    {
      id: 'H4',
      label: 'Baisse de CSG',
      value: '100 % au salarié (incidence légale de court terme), salaire brut inchangé',
      tier: 'announced',
    },
    {
      id: 'H12',
      label: 'AFU',
      value: '6 600 € nominaux appliqués aux revenus 2026 (non indexée)',
      tier: 'law',
    },
    {
      id: 'H14',
      label: 'Non-recours aujourd’hui',
      value: nh.nonRecours ? 'aides déclarées non perçues' : 'aides perçues si éligible',
      tier: 'hypothesis',
    },
  ];
  if (nh.adults.length === 2)
    activeHypotheses.push({
      id: 'H11',
      label: 'Couple',
      value: nh.married
        ? 'marié·e/pacsé·e : une déclaration commune aujourd’hui'
        : 'non marié·e : deux foyers fiscaux aujourd’hui, enfants rattachés à l’adulte 1 ; un seul ménage pour la CAF',
      tier: 'law',
    });
  if (nh.children.some((k) => k.age >= 18))
    activeHypotheses.push({
      id: 'H13',
      label: 'Jeunes de 18 à 24 ans',
      value:
        'AFU adulte (550 €/mois) : le rattachement au foyer des parents (art. 196 B) étant abrogé en 2028, la personne majeure reçoit sa propre aide',
      tier: 'law',
    });
  if (nh.adults.some((a) => a.activity === 'chomage'))
    activeHypotheses.push({
      id: 'H6',
      label: 'Chômage',
      value: 'montant mensuel de l’ARE inchangé ; fin d’indemnisation au 7e mois montrée à part',
      tier: 'announced',
    });
  if (nh.children.some((k) => k.aeeh))
    activeHypotheses.push({
      id: 'H15',
      label: 'Enfant AEEH',
      value: nh.children.some((k) => k.aeeh && k.cmiInvalidite)
        ? 'titulaire de la CMI « invalidité » déclarée (+6 600 €/an d’AFU ; ½ part aujourd’hui)'
        : 'sans CMI « invalidité » déclarée (l’AEEH peut être versée dès 50 % d’incapacité ; avec la CMI, taux ≥ 80 %, le plan ajouterait 6 600 €/an)',
      tier: 'hypothesis',
    });
  if (nh.housing.status === 'locataire' && e.period !== 'steady')
    activeHypotheses.push({
      id: 'H17',
      label: 'APL pendant la transition',
      value:
        'calendrier du parc conventionné : −1/3 (07/2027), −2/3 (07/2028), 0 (07/2029) ; dans le parc privé l’aide s’arrête au terme du bail (au plus tard le 1er janvier 2030) — même moyenne pour un bail de 3 ans dont l’échéance est inconnue',
      tier: 'hypothesis',
    });
  if (e.period === 2027 && nh.adults.some((a) => a.salary))
    activeHypotheses.push({
      id: 'H18',
      label: 'Baisse de la CSG en 2027',
      value: 'part déductible = min(taux, 6,8 points) (art. 154 quinquies CGI, non modifié)',
      tier: 'law',
    });
  if (nh.adults.length === 1 && nh.children.some((k) => k.age < 20))
    activeHypotheses.push({
      id: 'H19',
      label: 'Pension alimentaire reçue',
      value:
        nh.childSupport > 0
          ? `${eur(nh.childSupport)} par mois déclarés : l’allocation de soutien familial est réduite d’autant (nulle au-delà de son montant)`
          : 'non déclarée : supposée non versée, l’allocation de soutien familial est donc versée en entier (à corriger si vous recevez une pension)',
      tier: 'hypothesis',
    });
  if (isPaidCare(nh.childcare) && nh.children.some((k) => k.age < 6))
    activeHypotheses.push({
      id: 'H20',
      label: 'Frais de garde des enfants de moins de 6 ans',
      value: nh.childcareCostProvided
        ? `${eur(nh.childcareCostMonthly)} par mois déclarés, inchangés avec le plan`
        : `non renseignés : ${eur(e.baselineCore.flows.childcareCost)} par mois supposés (${nh.childcare === 'assistante_maternelle' ? 'temps plein, 180 h au tarif médian de 4,85 €/h' : nh.childcare === 'micro_creche' ? 'temps plein, 180 h à 9 €/h' : 'temps plein, 180 h au barème des crèches selon vos revenus'})`,
      tier: 'hypothesis',
    });
  if (nh.adults.some((a) => a.activity === 'retraite'))
    activeHypotheses.push({
      id: 'H16',
      label: 'Taux de CSG des pensions',
      value:
        'RFR N-2 : inchangé en 2027 ; en 2028, RFR 2026 sans l’abattement de 10 % ; ensuite revenu imposable du plan avec 1 part par adulte + ½ par enfant (art. 194 abrogé, art. L136-8 CSS non modifié)',
      tier: 'hypothesis',
    });

  // ---- not modelled (household-relevant) -----------------------------------------------------------------
  const nm: string[] = [
    'Revenus du patrimoine et de l’épargne (intérêts, dividendes, loyers perçus, plus-values) et leur fiscalité.',
    'Taxe foncière (aujourd’hui comme dans le plan, H8), taxe d’habitation sur résidence secondaire.',
    'Mutuelle et prévoyance (parts salariale et patronale), avantages en nature, primes exceptionnelles, 13e mois.',
    'Compte d’épargne personnel, patrimoine « rendu », compte éducation : montrés à part, jamais additionnés.',
    'Effets macroéconomiques (salaires, emploi, prix hors TVA et CEE) et autres taxes indirectes (carburants, tabac, alcool).',
    'DOM, Alsace-Moselle, indépendants et micro-entrepreneurs (pas encore).',
  ];
  if (nh.adults.some((a) => a.salary?.status === 'fonctionnaire'))
    nm.push(
      'Fonction publique : cotisations approchées (primes supposées = 20 % du brut ; cotisation employeur retraite CNRACL 37,65 % appliquée à tous — pour l’État, la contribution au CAS Pensions est d’environ 78 % : le coût employeur des fonctionnaires d’État est sous-estimé, sans effet sur le revenu disponible) ; indemnité compensatrice de CSG, GIPA et supplément familial de traitement non modélisés.',
    );
  if (nh.adults.some((a) => a.salary?.status === 'dirigeant_assimile'))
    nm.push(
      'Dirigeant·e assimilé·e salarié·e : rémunération traitée comme un salaire de cadre sans assurance chômage ni réduction générale ; dividendes, prévoyance et mutuelle non modélisés.',
    );
  if (nh.adults.some((a) => a.salary?.status === 'cadre'))
    nm.push(
      'Cadres : prévoyance obligatoire (1,50 % employeur) non modélisée ; seule l’APEC distingue le calcul du non-cadre.',
    );
  if (nh.adults.some((a) => a.activity === 'chomage'))
    nm.push(
      'Chômage : durée des droits, contribution retraite complémentaire (3 % du salaire de référence), ASS et allocations de solidarité non modélisées.',
    );
  if (nh.adults.some((a) => a.activity === 'etudiant'))
    nm.push(
      'Étudiant·es : bourses sur critères sociaux, aides du CROUS et APL « étudiant » (plancher de ressources) non modélisées.',
    );
  if (nh.children.some((k) => k.age < 6))
    nm.push(
      'Petite enfance : prime à la naissance, PreParE, garde à domicile, part « cotisations » du complément de mode de garde, complément transitoire de la réforme de 2025, majorations (horaires atypiques, AAH, AEEH) et prix des crèches après la fin de leur financement par les CAF non modélisés.',
    );
  if (nh.children.some((k) => k.aeeh))
    nm.push(
      'Handicap de l’enfant : compléments d’AEEH, PCH et majoration parent isolé non modélisés.',
    );
  if (nh.adults.some((a) => a.disability !== 'none'))
    nm.push(
      'AAH : couple, ESAT, condition de restriction substantielle (taux 50–79 %), PCH et majoration pour la vie autonome non modélisés ; la CMI invalidité est supposée pour un taux ≥ 80 % (½ part et abattement de l’art. 157 bis aujourd’hui ; réduction d’impôt complémentaire de l’art. 197 non modélisée).',
    );
  if (nh.housing.status === 'locataire')
    nm.push(
      'Logement : barème APL du secteur privé appliqué à tous (HLM/conventionné, réduction de loyer de solidarité, colocation, foyers non distingués).',
    );
  if (nh.housing.status === 'proprietaire_credit')
    nm.push('Accession à la propriété : APL accession et prêt à taux zéro non modélisés.');
  if (nh.adults.some((a) => a.activity === 'retraite'))
    nm.push(
      'Retraites : contribution maladie de 1 % sur les complémentaires, lissage des seuils de CSG, pensions de réversion et minimum contributif non modélisés.',
    );
  if (nh.adults.some((a) => a.age >= 65))
    nm.push('ASPA : récupération sur succession et cumul avec l’AAH simplifiés.');
  if (nh.adults.length === 1 && nh.children.length > 0)
    nm.push(
      nh.childSupport > 0
        ? 'Parent isolé : pension alimentaire déduite de l’ASF et comptée dans les ressources du RSA et de la prime d’activité, mais non ajoutée au revenu disponible (identique dans les deux scénarios ; imposition non modélisée) ; garde alternée non modélisée (H10).'
        : 'Parent isolé : pension alimentaire supposée non versée (ASF perçue, H19) ; garde alternée non modélisée (H10).',
    );
  if (nh.adults.length === 2 && !nh.married)
    nm.push(
      'Couple non marié : enfants rattachés fiscalement à l’adulte 1 (choix le plus simple, pas forcément le plus avantageux).',
    );
  if (today.rsa > 0 || f.pa > 0)
    nm.push(
      'RSA et prime d’activité : calcul en régime permanent (pas de décalage trimestriel), sans patrimoine ni droits connexes.',
    );

  // ---- warnings ------------------------------------------------------------------------------------------
  const warnings = [...nh.warnings];
  if (nh.nonRecours && nh.cafOverride !== null)
    warnings.push('Total CAF déclaré ignoré car vous avez indiqué ne pas toucher ces aides.');
  if (e.period !== 'steady')
    warnings.push(
      'Transition : montants mensuels moyens de l’année, en euros 2026, revenus supposés constants.',
    );
  if (nh.adults.some((a) => a.pension && a.pension.startYear >= 2028))
    warnings.push('Pension liquidée en 2028 ou après : pas de majoration de 3 300 €/an de l’AFU.');
  if (Math.abs(delta) >= 0.005 && baseline.disposable <= DELTA_PCT_MIN_BASELINE)
    warnings.push(
      `Revenu disponible actuel inférieur à ${DELTA_PCT_MIN_BASELINE} € par mois : variation en % non calculée.`,
    );
  if (isPaidCare(nh.childcare) && !nh.childcareCostProvided && nh.children.some((k) => k.age < 6))
    warnings.push(
      `Frais de garde non renseignés : ${eur(e.baselineCore.flows.childcareCost)} par mois supposés (${nh.childcare === 'assistante_maternelle' ? 'assistante maternelle à temps plein, 180 h au tarif médian de 4,85 €/h' : nh.childcare === 'micro_creche' ? 'micro-crèche à temps plein, 180 h à 9 €/h' : 'crèche à temps plein, 180 h au barème national selon vos revenus'}). Indiquez votre coût réel pour un calcul juste du complément de mode de garde et du crédit d’impôt.`,
    );

  // ---- v1.1: the other reading of H1 -------------------------------------------------------------------
  let h1Alternative: Comparison['h1Alternative'];
  {
    const other: Hypotheses['H1_benefits'] =
      hyp.H1_benefits === 'replaced' ? 'differential' : 'replaced';
    const alt = evaluate(h, { ...opts, hypotheses: { ...hyp, H1_benefits: other } }, true);
    const altDelta = r2(alt.plan!.disposable - alt.baseline.disposable);
    if (Math.abs(altDelta - delta) > H1_ALTERNATIVE_THRESHOLD)
      h1Alternative = {
        hypothesis: other,
        delta: altDelta,
        deltaAfterTva: r2(alt.plan!.disposableAfterTva - alt.baseline.disposableAfterTva),
      };
  }

  const unq = unquantifiedFor({ nh, today });
  const out: Comparison = {
    baseline,
    plan,
    delta,
    deltaPct: baseline.disposable > DELTA_PCT_MIN_BASELINE ? delta / baseline.disposable : null,
    deltaAfterTva: r2(plan.disposableAfterTva - baseline.disposableAfterTva),
    waterfall,
    unquantified: unq,
    notModelled: nm,
    activeHypotheses,
    warnings,
    summary: buildSummary(e, waterfall, delta),
    baselineBenefitsExplained: explainBaselineBenefits(e),
  };
  if (h1Alternative) out.h1Alternative = h1Alternative;
  if (nh.unsupported.length > 0) out.unsupported = [...nh.unsupported];
  return out;
}
