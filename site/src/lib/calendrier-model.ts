/**
 * La transition 2027 → 2030 — modèle de la frise et des trajectoires (/comprendre/calendrier).
 *
 * Pur TypeScript. Les dates viennent exclusivement du texte des amendements proposés (calendrier.json,
 * chaque événement cite un extrait vérifié) : aucune date n'est calculée ici, aucune horloge n'est lue.
 */
import { timeOf } from './dates';

/* ── Couloirs (domaines) ────────────────────────────────────────────────── */

export const LANE_IDS = [
  'impots',
  'tva',
  'revenu',
  'epargne',
  'logement',
  'etat',
  'collectivites',
] as const;
export type LaneId = (typeof LANE_IDS)[number];

export interface LaneMeta {
  label: string;
  /** Pour les pastilles de filtre et les étiquettes serrées. */
  short: string;
  /** Place dans la palette catégorielle : la couleur suit le domaine, jamais son rang. */
  color: number;
}

export const LANES: Record<LaneId, LaneMeta> = {
  impots: { label: 'Impôts, niches et taxes', short: 'Impôts et niches', color: 0 },
  tva: { label: 'TVA, accises et consommation', short: 'TVA et consommation', color: 1 },
  revenu: { label: 'Salaire net, CSG et aides', short: 'Salaire net et aides', color: 2 },
  epargne: { label: 'Épargne, retraite et santé', short: 'Épargne, retraite, santé', color: 3 },
  logement: { label: 'Logement et énergie', short: 'Logement et énergie', color: 4 },
  etat: { label: 'L’État, ses agences et ses agents', short: 'État et agences', color: 5 },
  collectivites: { label: 'Collectivités locales', short: 'Collectivités', color: 6 },
};

/**
 * Texte sur une pastille de couleur : blanc ou presque noir selon la luminance du remplissage. Le choix
 * est un jeton de la marque (`--on-series-n`, vérifié ≥ 4,5 : 1 par contrast.test.ts) : il suit la marque
 * et le thème sans script.
 */
export function onSeries(index: number): string {
  return `var(--on-series-${index + 1})`;
}

/* ── Événements ─────────────────────────────────────────────────────────── */

export interface RawEvent {
  id: string;
  date: string;
  precision: string;
  domain: string;
  label_fr: string;
  subject_fr: string;
  amendments: Array<{ liasse: string; number: number }>;
  in_timeline_2027_2030: boolean;
  source: { ref: string; url: string; quote: string };
}

export interface RawJalon {
  date: string;
  title_fr: string;
  summary_fr: string;
  n_events: number;
  event_ids: string[];
}

export interface CalEvent {
  id: string;
  /** AAAA-MM-JJ */
  date: string;
  /** `jour` | `annee` | `approx` */
  precision: string;
  lane: LaneId;
  label: string;
  subject: string;
  amendments: Array<{ liasse: string; number: number }>;
  /** « Amendement PLF-P1 n° 5 » */
  ref: string;
  /** Lien vers la page du PDF. */
  url: string;
  /** Citation vérifiée mot pour mot dans le texte. */
  quote: string;
  /** Dans la fenêtre 2027–2030 de la frise. */
  inFrise: boolean;
}

export interface Jalon {
  date: string;
  title: string;
  summary: string;
  count: number;
}

/** TVA, accises, certificats d'économies d'énergie : amendements PLF-P1 n° 14, 16 et 21. */
const TVA_AMENDMENTS = new Set([14, 16, 21]);

export function laneOf(e: Pick<RawEvent, 'domain' | 'label_fr' | 'amendments'>): LaneId {
  switch (e.domain) {
    case 'impots_taxes':
      return /\bTVA\b|accise/i.test(e.label_fr) ||
        e.amendments.some((a) => a.liasse === 'PLF-P1' && TVA_AMENDMENTS.has(a.number))
        ? 'tva'
        : 'impots';
    case 'revenu_salaire_aides':
      return 'revenu';
    case 'epargne_retraite':
    case 'sante':
      return 'epargne';
    case 'logement_energie':
      return 'logement';
    case 'etat_agences_agents':
      return 'etat';
    case 'collectivites':
      return 'collectivites';
    default:
      throw new Error(`calendrier: domaine inconnu « ${e.domain} »`);
  }
}

export const amendmentId = (a: { liasse: string; number: number }) => `${a.liasse}-${a.number}`;

export function toEvents(raw: RawEvent[]): CalEvent[] {
  return raw.map((e) => ({
    id: e.id,
    date: e.date,
    precision: e.precision,
    lane: laneOf(e),
    label: e.label_fr,
    subject: e.subject_fr,
    amendments: e.amendments,
    ref: e.source.ref,
    url: e.source.url,
    quote: e.source.quote,
    inFrise: e.in_timeline_2027_2030,
  }));
}

export const toJalons = (raw: RawJalon[]): Jalon[] =>
  raw.map((j) => ({ date: j.date, title: j.title_fr, summary: j.summary_fr, count: j.n_events }));

/** Fenêtre de la frise : 1er janvier 2027 → 1er janvier 2031. */
export const FRISE_START = '2027-01-01';
export const FRISE_END = '2031-01-01';

/** Position (0 → 1) d'une date dans la fenêtre de la frise. */
export function frisePosition(date: string): number {
  const t0 = timeOf(FRISE_START);
  return (timeOf(date) - t0) / (timeOf(FRISE_END) - t0);
}

export interface DateGroup {
  date: string;
  events: CalEvent[];
  jalon: Jalon | undefined;
}

/** Événements regroupés par date, chronologiquement ; chaque groupe sait s'il porte une date clé. */
export function groupByDate(events: readonly CalEvent[], jalons: readonly Jalon[]): DateGroup[] {
  const map = new Map<string, CalEvent[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, events: list, jalon: jalons.find((j) => j.date === date) }));
}

export interface LaneMarker {
  date: string;
  lane: LaneId;
  events: CalEvent[];
}

/** Une pastille par (couloir, date). */
export function laneMarkers(events: readonly CalEvent[]): LaneMarker[] {
  const map = new Map<string, LaneMarker>();
  for (const e of events) {
    if (!e.inFrise) continue;
    const key = `${e.lane}|${e.date}`;
    const m = map.get(key) ?? { date: e.date, lane: e.lane, events: [] };
    m.events.push(e);
    map.set(key, m);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Diamètre visible d'une pastille (px) : 14 pour une mesure, jusqu'à 34 pour une grosse date. */
export const markerDiameter = (n: number): number =>
  n <= 1 ? 14 : Math.round(Math.min(34, 20 + Math.log2(n) * 3.4));

/**
 * Évite que deux pastilles d'un même couloir se recouvrent : chaque pastille prend la première
 * sous-ligne dont la dernière pastille est assez loin (`x` = centre, `d` = diamètre, en px).
 */
export function assignSubRows(items: ReadonlyArray<{ x: number; d: number }>, gap = 6): number[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a]!.x - items[b]!.x);
  const rows: Array<{ x: number; d: number }> = [];
  const out = new Array<number>(items.length).fill(0);
  for (const i of order) {
    const it = items[i]!;
    let r = rows.findIndex((last) => it.x - last.x >= (it.d + last.d) / 2 + gap);
    if (r < 0) {
      r = rows.length;
      rows.push(it);
    } else {
      rows[r] = it;
    }
    out[i] = r;
  }
  return out;
}

/** Les dates clés qui tombent dans la fenêtre de la frise. */
export const jalonsInFrise = (jalons: readonly Jalon[]) =>
  jalons.filter((j) => j.date >= FRISE_START && j.date < FRISE_END);

/* ── Trajectoires (paliers datés) ───────────────────────────────────────── */

export interface RawStep {
  from: string;
  to: string | null;
  label_fr: string;
  value?: number;
  total_pct?: number;
  csg_pct?: number;
  crds_pct?: number;
  hypothesis?: boolean;
  calc?: string;
  sources?: Array<{ liasse: string; number: number; page: number; quote: string; url: string }>;
}

export interface RawTrajectory {
  id: string;
  label_fr: string;
  note: string;
  tier: string;
  unit: string;
  steps: RawStep[];
}

export interface Step {
  from: string;
  to: string | null;
  value: number;
  label: string;
  /** Palier de départ déduit, non écrit dans la loi (D33). */
  hypothesis: boolean;
  sources: Array<{ liasse: string; number: number; page: number; url: string }>;
}

export interface Panel {
  id: string;
  title: string;
  /** Ce que mesure l'axe vertical. */
  measure: string;
  kind: 'points' | 'taux' | 'part' | 'emplois';
  yMax: number;
  yTicks: number[];
  /** Début et fin de l'axe du temps. */
  x0: string;
  x1: string;
  note: string;
  steps: Step[];
  /** Colonnes supplémentaires du tableau (CSG et CRDS séparées). */
  extra?: Array<{ from: string; csg: number; crds: number }>;
}

interface PanelConfig {
  title: string;
  measure: string;
  kind: Panel['kind'];
  yMax: number;
  yTicks: number[];
  x0: string;
  x1: string;
}

const PCT_X = { x0: '2027-01-01', x1: '2031-01-01' };
const PART: Omit<PanelConfig, 'title' | 'measure'> = {
  kind: 'part',
  yMax: 100,
  yTicks: [0, 50, 100],
  ...PCT_X,
};

export const PANEL_CONFIG: Record<string, PanelConfig> = {
  csg_crds_activite_2027: {
    title: 'CSG et CRDS sur les revenus d’activité',
    measure: 'points de rémunération',
    kind: 'points',
    yMax: 10,
    yTicks: [0, 5, 10],
    x0: '2027-01-01',
    x1: '2028-01-01',
  },
  tva_alimentation: {
    title: 'TVA sur l’alimentation',
    measure: 'taux, en %',
    kind: 'taux',
    yMax: 20,
    yTicks: [0, 10, 20],
    ...PCT_X,
  },
  emplois_etat_plafond: {
    title: 'Emplois de l’État supprimés',
    measure: 'emplois (équivalents temps plein)',
    kind: 'emplois',
    yMax: 70000,
    yTicks: [0, 35000, 70000],
    x0: '2027-01-01',
    x1: '2029-01-01',
  },
  apl_parc_conventionne: {
    title: 'Aide au logement, parc conventionné',
    measure: 'part du montant de décembre 2026, en %',
    ...PART,
  },
  taxe_sur_salaires: {
    title: 'Taxe sur les salaires',
    measure: 'part du montant actuel, en %',
    ...PART,
  },
  dons_reduction_impot: {
    title: 'Réduction d’impôt pour dons',
    measure: 'part du taux actuel, en %',
    ...PART,
  },
  niches_agri_services_garde: {
    title: 'Avantages agricoles, services à la personne, garde d’enfants',
    measure: 'part de l’avantage actuel, en %',
    ...PART,
  },
  exonerations_emploi_domicile: {
    title: 'Exonérations de cotisations pour l’emploi à domicile',
    measure: 'part de l’exonération actuelle, en %',
    ...PART,
  },
  dotation_forfaitaire_communes: {
    title: 'Dotation forfaitaire des communes',
    measure: 'part de la dotation 2026, en %',
    ...PART,
  },
};

export const PANEL_ORDER = {
  taux: ['csg_crds_activite_2027', 'tva_alimentation', 'emplois_etat_plafond'],
  part: [
    'apl_parc_conventionne',
    'taxe_sur_salaires',
    'dons_reduction_impot',
    'niches_agri_services_garde',
    'exonerations_emploi_domicile',
    'dotation_forfaitaire_communes',
  ],
} as const;

export function toPanel(raw: RawTrajectory): Panel {
  const cfg = PANEL_CONFIG[raw.id];
  if (!cfg) throw new Error(`calendrier: pas de configuration de graphique pour « ${raw.id} »`);
  const steps: Step[] = raw.steps.map((s) => {
    const value = s.total_pct ?? s.value;
    if (typeof value !== 'number') throw new Error(`calendrier: palier sans valeur (${raw.id})`);
    return {
      from: s.from,
      to: s.to,
      value,
      label: s.label_fr,
      hypothesis: s.hypothesis === true,
      sources: (s.sources ?? []).map(({ liasse, number, page, url }) => ({
        liasse,
        number,
        page,
        url,
      })),
    };
  });
  const extra = raw.steps.every((s) => typeof s.csg_pct === 'number')
    ? raw.steps.map((s) => ({ from: s.from, csg: s.csg_pct!, crds: s.crds_pct ?? 0 }))
    : undefined;
  return { id: raw.id, ...cfg, note: raw.note, steps, ...(extra ? { extra } : {}) };
}

/**
 * Points d'une courbe en escalier, bornée à la fenêtre [x0, x1] : un point par palier (au début du
 * palier) plus un point final à x1 qui prolonge la dernière valeur. Un palier antérieur à x0 est
 * ramené à x0 (la valeur qui s'applique au début de la fenêtre).
 */
export function stepPoints(
  panel: Pick<Panel, 'steps' | 'x0' | 'x1'>,
): Array<{ date: string; value: number; hypothesis: boolean; label: string }> {
  const pts: Array<{ date: string; value: number; hypothesis: boolean; label: string }> = [];
  for (const s of panel.steps) {
    const date = s.from < panel.x0 ? panel.x0 : s.from;
    if (date >= panel.x1) continue;
    const prev = pts[pts.length - 1];
    if (prev && prev.date === date) pts.pop();
    pts.push({ date, value: s.value, hypothesis: s.hypothesis, label: s.label });
  }
  const last = pts[pts.length - 1];
  if (last) pts.push({ date: panel.x1, value: last.value, hypothesis: false, label: last.label });
  return pts;
}
