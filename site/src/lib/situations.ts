/**
 * « Ce que le plan prévoit pour… » : les 18 situations des fiches du livre (fiches.json), regroupées
 * comme dans le livre. Le texte des fiches est repris mot pour mot (niveau « Promis par les auteurs ») ;
 * le seul apport éditorial de cette page est la liste des amendements qui concernent chaque situation.
 *
 * Ancres : chaque situation a l’ancre `#<slug>` sur `/comprendre/situations/` (`#retraite`,
 * `#enseignant`, `#agent-public-indispensable`, `#entreprise`…). Le simulateur s’en sert pour renvoyer
 * un profil vers sa fiche : voir `situationHref()` et `SITUATION_FOR_PROFILE`.
 */
import data from '@/data/fiches.json';
import amendements from '@/data/amendements.json';
import { withBase } from '@/lib/site';

export interface SituationItem {
  headline: string;
  text: string;
}

export interface Situation {
  slug: string;
  title: string;
  tagline: string;
  /** « 68 M », « 580 000 postes publics » : la population de l’en-tête de la fiche (absente pour certaines). */
  population: string | null;
  gains: SituationItem[];
  pertes: SituationItem[];
  /** « Et comme chacun » : rappels de gains communs à plusieurs fiches. */
  commeChacun: string[];
  /** Comptes de l’en-tête de la fiche, quand ils ne correspondent pas aux éléments listés (D23). */
  headerMismatch?: { gains: number; pertes: number };
  url: string;
  pdfUrl: string;
  amendements: RelatedAmendement[];
}

export interface SituationGroup {
  label: string;
  description: string;
  situations: Situation[];
}

export interface RelatedAmendement {
  id: string;
  /** « Amendement PLF-P1 n° 28 » */
  label: string;
  title: string;
  /** PDF de la liasse, ouvert à la bonne page. */
  pdfUrl: string;
  /** Pourquoi il concerne cette situation, en une demi-phrase. */
  why: string;
}

/** Amendements liés à chaque fiche (éditorial : ce que la fiche promet ou retire, là où un texte existe). */
const RELATED: Record<string, Array<[id: string, why: string]>> = {
  citoyen: [
    ['PLF-P2-24', 'abaisse le plafond des emplois de l’État'],
    ['PLF-P2-25', 'ferme les agences facultatives'],
    ['PLF-P1-28', 'l’aide fondamentale mensuelle de chaque adulte'],
  ],
  contribuable: [
    ['PLF-P1-28', 'impôt unique à taux unique'],
    ['PLF-P1-1', 'supprime les niches fiscales'],
    ['PLF-P1-25', 'supprime des taxes affectées'],
  ],
  foyer: [
    ['PLF-P1-27', 'le compte d’épargne personnel'],
    ['PLF-P1-19', 'remplace les droits de mutation par un barème unique'],
    ['PLF-P1-1', 'les niches, dont l’emploi à domicile'],
  ],
  travailleur: [
    ['PLFSS-1', 'supprime la CSG et la CRDS sur les revenus d’activité'],
    ['PLF-P1-28', 'impôt à taux unique et aide fondamentale'],
    ['PLF-P1-27', 'le compte d’épargne personnel'],
  ],
  'personne-sans-emploi': [
    ['PLF-P2-23', 'supprime la contribution de l’assurance chômage à France Travail'],
    ['PLF-P1-27', 'le compte d’épargne personnel'],
    ['PLF-P2-31', 'fin des subventions sur dossier'],
  ],
  entreprise: [
    ['PLF-P1-23', 'impôt sur les sociétés à taux unique'],
    ['PLF-P1-25', 'supprime des impôts de production (taxes affectées)'],
    ['PLFSS-3', 'éteint la taxe sur les salaires'],
  ],
  'agent-public-indispensable': [
    ['PLF-P2-24', 'abaisse le plafond des emplois de l’État'],
    ['PLF-P2-26', 'organise la sortie des agents dont l’emploi est supprimé'],
  ],
  'agent-public-dont-le-poste-est-supprime': [
    ['PLF-P2-26', 'indemnité mensuelle pour les agents sortants'],
    ['PLF-P2-25', 'ferme les agences facultatives'],
    ['PLF-P2-24', 'abaisse le plafond des emplois de l’État'],
  ],
  enseignant: [
    ['PLF-P2-26', 'sortie des agents dont l’emploi est supprimé'],
    ['PLF-P2-15', 'retire des crédits de la mission « Enseignement scolaire »'],
  ],
  'jeune-adulte': [
    ['PLF-P1-28', 'l’aide fondamentale versée dès 18 ans'],
    ['PLFSS-7', 'abroge les prestations familiales à l’arrivée de l’aide'],
  ],
  famille: [
    ['PLFSS-7', 'abroge les prestations familiales'],
    ['PLF-P1-28', 'l’aide fondamentale versée pour chaque enfant'],
    ['PLF-P1-12', 'supprime le crédit d’impôt famille'],
  ],
  retraite: [
    ['PLFSS-5', 'retire la revalorisation automatique des pensions'],
    ['PLF-P1-28', 'l’aide fondamentale, avec un supplément pour les pensions liquidées avant 2028'],
    ['PLFSS-6', 'un régime socle unique de retraite'],
  ],
  locataire: [
    ['PLF-P2-32', 'éteint l’aide personnelle au logement'],
    ['PLF-P2-29', 'fin du financement du logement social neuf'],
    ['PLF-P1-19', 'ramène les droits de mutation (frais de notaire)'],
  ],
  patient: [['PLFSS-4', 'plafonne le reste à charge en santé']],
  'personne-handicapee': [
    ['PLF-P1-28', 'l’aide fondamentale et son supplément « invalidité »'],
    ['PLFSS-4', 'plafonne le reste à charge en santé'],
    ['PLF-P2-28', 'retire la revalorisation automatique de l’AAH'],
  ],
  consommateur: [
    ['PLF-P1-21', 'aligne les taux réduits de TVA sur le taux normal'],
    ['PLF-P1-16', 'supprime les certificats d’économies d’énergie'],
    ['PLF-P1-14', 'supprime des tarifs réduits d’accise sur l’énergie'],
  ],
  'beneficiaire-d-un-cheque-cible': [
    ['PLF-P2-34', 'supprime le chèque énergie'],
    ['PLF-P2-32', 'éteint l’aide personnelle au logement'],
    ['PLF-P1-28', 'l’aide fondamentale, en argent libre'],
  ],
  'entreprise-ou-association-subventionnee': [
    ['PLF-P2-31', 'fin des subventions et des crédits sur dossier'],
    ['PLF-P1-18', 'abroge des aides fiscales à l’investissement'],
    ['PLF-P1-23', 'impôt sur les sociétés à taux unique'],
  ],
};

interface RawFiche {
  slug: string;
  title_fr: string;
  tagline_fr: string;
  gains: Array<{ headline_fr: string; text_fr: string }>;
  pertes: Array<{ title_fr: string; text_fr: string }>;
  comme_chacun_fr: string[];
  header_population: { raw: string } | null;
  header_counts: { gains: number; pertes: number };
  header_vs_listed: { gains_match: boolean; pertes_match: boolean };
  url: string;
  pdf_url: string;
}

const byId = new Map(
  (
    amendements.amendements as Array<{
      id: string;
      liasse: string;
      number: number;
      title_fr: string;
      pdf_url: string;
    }>
  ).map((a) => [a.id, a]),
);

function related(slug: string): RelatedAmendement[] {
  const out: RelatedAmendement[] = [];
  for (const [id, why] of RELATED[slug] ?? []) {
    const a = byId.get(id);
    if (!a) continue; // un identifiant inconnu est signalé par le test unitaire
    out.push({
      id,
      label: `Amendement ${a.liasse} n° ${a.number}`,
      title: a.title_fr,
      pdfUrl: a.pdf_url,
      why,
    });
  }
  return out;
}

function toSituation(f: RawFiche): Situation {
  const mismatch = !f.header_vs_listed.gains_match || !f.header_vs_listed.pertes_match;
  return {
    slug: f.slug,
    title: f.title_fr,
    tagline: f.tagline_fr,
    population: f.header_population?.raw ?? null,
    gains: f.gains.map((g) => ({ headline: g.headline_fr, text: g.text_fr })),
    pertes: f.pertes.map((p) => ({ headline: p.title_fr, text: p.text_fr })),
    commeChacun: f.comme_chacun_fr,
    headerMismatch: mismatch ? f.header_counts : undefined,
    url: f.url,
    pdfUrl: f.pdf_url,
    amendements: related(f.slug),
  };
}

/** Les situations, dans l’ordre et avec les regroupements du livre. */
export function situationGroups(): SituationGroup[] {
  const fiches = new Map((data.fiches as unknown as RawFiche[]).map((f) => [f.slug, f]));
  return (
    data.meta.groups as Array<{ label_fr: string; description_fr: string; slugs: string[] }>
  ).map((g) => ({
    label: g.label_fr,
    description: g.description_fr,
    situations: g.slugs.map((s) => {
      const f = fiches.get(s);
      if (!f) throw new Error(`fiches.json: situation inconnue « ${s} »`);
      return toSituation(f);
    }),
  }));
}

export const SITUATION_SLUGS: string[] = (data.fiches as Array<{ slug: string }>).map(
  (f) => f.slug,
);

export function isSituationSlug(slug: string): boolean {
  return SITUATION_SLUGS.includes(slug);
}

/** Lien (base comprise) vers la fiche d’une situation : `/comprendre/situations/#retraite`. */
export function situationHref(slug: string): string {
  return withBase(`/comprendre/situations/#${slug}`);
}

/**
 * Quel profil du simulateur renvoie vers quelle fiche (pour l’agent du simulateur) :
 *   retraité·e → retraite · fonctionnaire → agent-public-indispensable (et, en second,
 *   agent-public-dont-le-poste-est-supprime, enseignant) · dirigeant·e, TNS → entreprise ·
 *   salarié·e → travailleur · sans emploi → personne-sans-emploi · étudiant·e / 18-24 ans → jeune-adulte ·
 *   enfants → famille · locataire → locataire · AAH ou AEEH → personne-handicapee ·
 *   parent isolé → famille · RSA / prime d’activité / APL → beneficiaire-d-un-cheque-cible.
 */
export const SITUATION_FOR_PROFILE = {
  retraite: 'retraite',
  fonctionnaire: 'agent-public-indispensable',
  fonctionnaireSupprime: 'agent-public-dont-le-poste-est-supprime',
  enseignant: 'enseignant',
  dirigeant: 'entreprise',
  tns: 'entreprise',
  salarie: 'travailleur',
  sansEmploi: 'personne-sans-emploi',
  etudiant: 'jeune-adulte',
  jeuneAdulte: 'jeune-adulte',
  enfants: 'famille',
  parentIsole: 'famille',
  locataire: 'locataire',
  handicap: 'personne-handicapee',
  aidesCaf: 'beneficiaire-d-un-cheque-cible',
  consommateur: 'consommateur',
  patient: 'patient',
} as const satisfies Record<string, string>;
