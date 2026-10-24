/**
 * Typed access to `src/data/facts.json` — the ONLY source of public numbers on the site.
 *
 *   import { num, fact, chip } from '@/lib/facts';
 *   formatMdEuro(num('dep_total_2024_md'))          // « 1 672 Md€ »
 *   <SourceChip {...chip('dep_total_2024_md')} />   // « Insee · donnée »
 *
 * Rules:
 *  - never type a figure in a page or component: read it here (or from a dataset next to it);
 *  - an unknown id fails the build (and the type-check), so a renamed fact cannot ship silently;
 *  - every fact keeps its `tier` (loi / annonce / donnee / calcul), source and conflicts.
 */
import raw from '@/data/facts.json';
import type { Tier } from '@/lib/tiers';

export type FactId = keyof typeof raw;
export type FactTier = 'loi' | 'annonce' | 'donnee' | 'calcul';

export interface FactSource {
  kind:
    | 'workbook'
    | 'amendment'
    | 'site'
    | 'insee'
    | 'eurostat'
    | 'dgafp'
    | 'legifrance'
    | 'reglementation'
    | 'calcul';
  ref: string;
  url: string | null;
  quote?: string;
  page?: string;
  inputs?: string[];
  also?: { kind: string; ref: string; url: string | null };
}

export interface FactConflict {
  group: string;
  with: string[];
  note: string;
}

export interface Fact {
  value: number | string;
  unit: string;
  year: number | null;
  label_fr: string;
  tier: FactTier;
  source: FactSource;
  note?: string;
  conflict?: boolean;
  conflicts?: FactConflict[];
}

const facts = raw as unknown as Record<string, Fact>;

/** The whole fact. Throws on an unknown id (never returns `undefined`). */
export function fact(id: FactId): Fact {
  const f = facts[id];
  if (!f) throw new Error(`facts.json: unknown fact "${id}"`);
  return f;
}

/** A numeric fact. Throws if the value is text. */
export function num(id: FactId): number {
  const v = fact(id).value;
  if (typeof v !== 'number') throw new Error(`facts.json: "${id}" is not numeric (${String(v)})`);
  return v;
}

/** Millions → units (« 30,959 » M de foyers → 30 959 000). */
export const millions = (id: FactId): number => num(id) * 1e6;
/** Md€ → euros. */
export const mdToEuro = (id: FactId): number => num(id) * 1e9;

/** Conflicts attached to a fact (empty array when none). */
export function conflicts(id: FactId): FactConflict[] {
  return fact(id).conflicts ?? [];
}

/* ── Provenance chips ──────────────────────────────────────────────────── */

const KIND_LABEL: Record<FactSource['kind'], string> = {
  workbook: 'Classeur des auteurs',
  amendment: 'Amendement',
  site: 'france-resolution.fr',
  insee: 'Insee',
  eurostat: 'Eurostat',
  dgafp: 'DGAFP',
  legifrance: 'Légifrance',
  reglementation: 'Légifrance, Code du travail',
  calcul: 'Calcul du site',
};

/**
 * Epistemic tier shown on a source chip. Third-party statistics (`donnee`) and our own arithmetic
 * (`calcul`) are not claims of the plan, so they carry no law / announced mark: the label says what they are.
 */
export function uiTier(t: FactTier): Tier | undefined {
  return t === 'loi' ? 'law' : t === 'annonce' ? 'announced' : undefined;
}

export interface ChipProps {
  label: string;
  href?: string;
  tier?: Tier;
  year?: string | number;
}

/**
 * « Synthèse Chiffres Résolution_0910.xlsx › Refonte fiscalité › C3 » → { sheet: « Refonte fiscalité », cell: « C3 » }.
 * Tous les liens « classeur des auteurs » pointent vers le même fichier : le texte visible doit dire où chercher.
 */
export function workbookPlace(ref: string | undefined): { sheet: string; cell?: string } | null {
  if (!ref) return null;
  const parts = ref.split('›').map((p) => p.trim());
  const i = parts.findIndex((p) => /\.xlsx$/i.test(p));
  const sheet = i >= 0 ? parts[i + 1] : undefined;
  if (!sheet) return null;
  return { sheet, cell: parts[i + 2] };
}

/** « Classeur des auteurs · Refonte fiscalité, C3 » : le libellé complète avec l’onglet et la cellule. */
function withPlace(label: string, ref: string | undefined): string {
  const place = workbookPlace(ref);
  if (!place) return label;
  const sheetShown = label.includes(place.sheet);
  const text = sheetShown
    ? (place.cell ?? '')
    : [place.sheet, place.cell].filter(Boolean).join(', ');
  return text ? `${label} · ${text}` : label;
}

/**
 * Props for `<SourceChip>` built from a fact: short label by source kind, link, tier, year.
 * Pass `label` to say it your own way (« Insee, comptes nationaux »). When the figure comes from the authors'
 * workbook, the label names the sheet and the cell (« Classeur des auteurs · Refonte fiscalité, C3 »).
 * `workbook: true` adds the same place for a third-party statistic that the workbook reproduces.
 */
export function chip(
  id: FactId,
  opts: { label?: string; year?: boolean; workbook?: boolean } = {},
): ChipProps {
  const f = fact(id);
  const base = opts.label ?? KIND_LABEL[f.source.kind];
  const derived = f.tier === 'calcul' && !opts.label ? ' (formule en note)' : '';
  let label = `${base}${derived}`;
  if (f.source.kind === 'workbook') label = withPlace(label, f.source.ref);
  else if (opts.workbook && f.source.also?.kind === 'workbook') {
    label = withPlace(`${label} (repris dans le classeur)`, f.source.also.ref);
  }
  return {
    label,
    href: f.source.url ?? undefined,
    tier: uiTier(f.tier),
    year: opts.year === false ? undefined : (f.year ?? undefined),
  };
}

/** Same, for a dataset-level `source` block (`{ kind, ref, url }`) with an explicit tier. */
export function datasetChip(
  source: { kind: string; url?: string | null; ref?: string },
  opts: { label?: string; tier?: FactTier; year?: number | string } = {},
): ChipProps {
  const kind = source.kind as FactSource['kind'];
  const base = opts.label ?? KIND_LABEL[kind] ?? source.kind;
  return {
    label: kind === 'workbook' ? withPlace(base, source.ref) : base,
    href: source.url ?? undefined,
    tier: opts.tier ? uiTier(opts.tier) : undefined,
    year: opts.year,
  };
}

/** Full, human-readable reference of a fact (for « Sources » tabs and tooltips). */
export function sourceLine(id: FactId): string {
  const f = fact(id);
  return `${KIND_LABEL[f.source.kind]} — ${f.source.ref}`;
}
