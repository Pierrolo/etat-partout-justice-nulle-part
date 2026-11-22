/**
 * Build-time views of plan-flux.json and lifecycle.json for /comprendre/le-plan.
 * Uses `sankey` ONLY — never `sankey_classeur` (a second, differently-rounded Sankey: D08–D10).
 */
import lifecycle from '@/data/lifecycle.json';
import plan from '@/data/plan-flux.json';

export type FlowTier = 'law' | 'announced';

export interface SankeyNode {
  id: string;
  label: string;
  short: string;
  layer: 0 | 1 | 2;
  /** Md€ per year (cruising speed). */
  value: number;
  tier: FlowTier;
}
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  /** « written in the law » only for the CSG/CRDS restitution to net pay; everything else is the authors' estimate. */
  tier: FlowTier;
  cell: string;
  note?: string;
}

const SHORT: Record<string, string> = {
  structures: 'Structures facultatives',
  subventions: 'Subventions',
  niches: 'Niches fiscales et sociales',
  chomage: 'Assurance chômage',
  patrimoine: 'Patrimoine public',
  annee_1: 'Année 1',
  annee_pleine: 'En plus, année pleine',
  salaire_net: 'Salaire net',
  capitalisation: 'Épargne',
};
const SHORT_NARROW: Record<string, string> = {
  structures: 'Structures',
  subventions: 'Subventions',
  niches: 'Niches',
  chomage: 'Chômage',
  patrimoine: 'Patrimoine',
  annee_1: 'Année 1',
  annee_pleine: 'Année pleine',
  salaire_net: 'Salaire net',
  capitalisation: 'Épargne',
};
export const SANKEY_NARROW = SHORT_NARROW;

export function planSankey() {
  const s = plan.sankey;
  const nodes: SankeyNode[] = s.nodes.map((n) => ({
    id: n.id,
    label: n.label_fr,
    short: SHORT[n.id] ?? n.label_fr,
    layer: n.layer as 0 | 1 | 2,
    value: n.value_md,
    tier: n.id === 'salaire_net' ? 'law' : 'announced',
  }));
  const links: SankeyLink[] = s.links.map((l) => ({
    source: l.source,
    target: l.target,
    value: l.value_md,
    tier: l.target === 'salaire_net' ? 'law' : 'announced',
    cell: ('cell' in l && l.cell ? l.cell : 'ref' in l && l.ref ? l.ref : '') as string,
    ...('formula' in l && l.formula ? { note: l.formula as string } : {}),
  }));
  return {
    nodes,
    links,
    total: s.total_in_md,
    unit: s.unit,
    interpretation: s.interpretation,
    source: plan.meta.source,
    reconciliation: plan.reconciliation,
    year1: plan.year_split.annee_1_md,
    year1Flux: plan.year_split.autre_lecture_flux.annee_1_md,
  };
}

/* ── Cycle de vie ──────────────────────────────────────────────────────── */

export type LifeSeriesId =
  | 'aide_fondamentale'
  | 'aide_handicap'
  | 'compte_education'
  | 'part_contributive_retraite'
  | 'rendement_patrimoine';

export interface LifeSeries {
  id: LifeSeriesId;
  label: string;
  tier: FlowTier;
  note: string;
}
export type LifeRow = { age: number } & Record<LifeSeriesId, number> &
  Record<'epargne_retraite_serie_1' | 'epargne_retraite_serie_2', number | null>;

export function lifecycleData() {
  const ids: LifeSeriesId[] = [
    'aide_fondamentale',
    'aide_handicap',
    'compte_education',
    'part_contributive_retraite',
    'rendement_patrimoine',
  ];
  const series: LifeSeries[] = ids.map((id) => {
    const m = lifecycle.series.find((x) => x.id === id)!;
    return { id, label: m.label_fr, tier: m.tier === 'loi' ? 'law' : 'announced', note: m.note };
  });
  const rows = lifecycle.by_age.map((r) => ({
    age: r.age,
    aide_fondamentale: r.aide_fondamentale ?? 0,
    aide_handicap: r.aide_handicap ?? 0,
    compte_education: r.compte_education ?? 0,
    part_contributive_retraite: r.part_contributive_retraite ?? 0,
    rendement_patrimoine: r.rendement_patrimoine ?? 0,
    epargne_retraite_serie_1: r.epargne_retraite_serie_1 ?? null,
    epargne_retraite_serie_2: r.epargne_retraite_serie_2 ?? null,
  })) as LifeRow[];
  return {
    series,
    rows,
    notes: lifecycle.meta.notes as string[],
    source: lifecycle.meta.source,
    tierNote: lifecycle.meta.tier_note as string,
    ageMax: lifecycle.meta.ages[1] as number,
  };
}
