/**
 * Niches fiscales — modèle de données de l'explorateur (/comprendre/niches).
 *
 * Pur TypeScript, sans DOM : utilisé au build (page + point d'accès JSON) et dans le navigateur
 * (filtres, tri, pagination, état dans l'URL). Les montants restent en M€ ici ; l'affichage passe
 * par `format.ts`. Un coût manquant est `null` — jamais 0 (docs/VISION.md §2, DISCREPANCIES D20/D30).
 */

import { normalize, tokens } from './search';

/* ── Forme brute (niches.json) — uniquement ce dont on a besoin ─────────── */

export interface RawNiche {
  id: string;
  label_fr: string;
  category: string;
  tax: string;
  cost_2024_meur: number | null;
  cost_2025_meur: number | null;
  cost_2026_meur: number | null;
  cost_flags: Record<string, string> | null;
  beneficiaries: { count: number | null; count_flag: string | null; type: string | null };
  dates: { creation: number | null; fin_fait_generateur: number | string | null };
  legal_ref: { code: string | null; reference: string | null };
  household_common: boolean;
  household_common_reason: string | null;
  purpose_fr: string | null;
  reliability: string | null;
  resolution: { suppression_code: string | null; suppression_fr: string | null };
}

/* ── Catégories, impôts, effets du plan ─────────────────────────────────── */

export const CATEGORY_IDS = [
  'menages',
  'entreprises',
  'tva',
  'epargne',
  'logement',
  'outre-mer',
  'autre',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** `index` = place dans la palette catégorielle (couleur = l'entité, jamais le rang). */
export const CATEGORY_META: Record<
  CategoryId,
  { label: string; raw: string; index: number | null }
> = {
  menages: { label: 'Ménages', raw: 'ménages', index: 0 },
  entreprises: { label: 'Entreprises', raw: 'entreprises', index: 1 },
  tva: { label: 'TVA', raw: 'TVA', index: 2 },
  epargne: { label: 'Épargne', raw: 'épargne', index: 3 },
  logement: { label: 'Logement', raw: 'logement', index: 4 },
  'outre-mer': { label: 'Outre-mer', raw: 'outre-mer', index: 5 },
  autre: { label: 'Autres', raw: 'autre', index: null },
};

const CATEGORY_BY_RAW = Object.fromEntries(
  CATEGORY_IDS.map((id) => [CATEGORY_META[id].raw, id]),
) as Record<string, CategoryId>;

export const TAX_IDS = [
  'ir',
  'ir-is',
  'is',
  'tva',
  'accises',
  'droits',
  'locaux',
  'autres-droits',
  'autres-directs',
] as const;
export type TaxId = (typeof TAX_IDS)[number];

export const TAX_META: Record<TaxId, { label: string; raw: string }> = {
  ir: { label: 'Impôt sur le revenu', raw: 'Impôt sur le revenu' },
  'ir-is': { label: 'IR et IS', raw: 'Impôt sur le revenu et impôt sur les sociétés' },
  is: { label: 'Impôt sur les sociétés', raw: 'Impôt sur les sociétés' },
  tva: { label: 'TVA', raw: 'Taxe sur la valeur ajoutée' },
  accises: { label: 'Accises sur l’énergie', raw: 'Accise sur les énergies' },
  droits: { label: 'Droits d’enregistrement', raw: 'Droits d’enregistrement et de timbre' },
  locaux: { label: 'Impôts locaux', raw: 'Impôts locaux' },
  'autres-droits': { label: 'Autres droits', raw: 'Autres droits' },
  'autres-directs': { label: 'Autres impôts directs', raw: 'Autres impôts directs' },
};

const TAX_BY_RAW = Object.fromEntries(TAX_IDS.map((id) => [TAX_META[id].raw, id])) as Record<
  string,
  TaxId
>;

/** Ce que le plan fait de la niche, d'après la colonne « Suppression » du chiffrage publié. */
export const PLAN_IDS = [
  'supprimee',
  'trois-ans',
  'aide-fondamentale',
  'outre-mer',
  'eteinte',
] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_META: Record<
  PlanId,
  { label: string; short: string; detail: string; raw: string | null }
> = {
  supprimee: {
    label: 'Supprimée',
    short: 'Supprimée',
    detail: 'Abrogée dès l’entrée en vigueur de l’amendement n° 1, aux dates qu’il fixe.',
    raw: 'Oui',
  },
  'trois-ans': {
    label: 'Supprimée en trois ans',
    short: 'En trois ans',
    detail: 'Réduite d’un tiers en 2027, de deux tiers en 2028, supprimée en 2029.',
    raw: 'En 3 ans',
  },
  'aide-fondamentale': {
    label: 'Intégrée à l’aide fondamentale',
    short: 'Aide fondamentale',
    detail:
      'Remplacée par l’aide fondamentale universelle (crédits d’impôt sur le revenu fusionnés).',
    raw: 'Fusion CI IR',
  },
  'outre-mer': {
    label: 'Refondue (outre-mer)',
    short: 'Outre-mer',
    detail:
      'Régime à part pour les collectivités d’outre-mer : refondu, non supprimé (« flux OM » dans le classeur).',
    raw: 'Flux OM',
  },
  eteinte: {
    label: 'Déjà éteinte',
    short: 'Déjà éteinte',
    detail: 'Le fait générateur est éteint fin 2025 ou avant : il n’y a rien à supprimer.',
    raw: null,
  },
};

/* ── Ligne compacte (ce qui part dans le navigateur) ────────────────────── */

export type CostFlag = 'epsilon' | 'nc' | 'aucun_effet';
export type CostYear = 2024 | 2025 | 2026;
export const COST_YEARS: readonly CostYear[] = [2024, 2025, 2026];

export interface NicheRow {
  id: string;
  label: string;
  cat: CategoryId;
  tax: TaxId;
  plan: PlanId;
  /** Coûts 2024 (réalisé), 2025 et 2026 (prévisions) en M€ ; `null` = non chiffré. */
  cost: [number | null, number | null, number | null];
  /** Motif d'un coût manquant, par année (même ordre que `cost`). */
  flag: [CostFlag | null, CostFlag | null, CostFlag | null];
  /** « CGI, art. 81-19° » ; `null` si la source n'en donne pas. */
  legal: string | null;
  /** Touche couramment les ménages (liste éditoriale + règle des 1 M de bénéficiaires). */
  menages: boolean;
  menagesWhy: string | null;
  reliability: string | null;
  /** « Ménages », « Entreprises »… et nombre de bénéficiaires (`null` si non déterminé). */
  who: string | null;
  whoCount: number | null;
  purpose: string | null;
  created: number | null;
  /** Année de fin du fait générateur, ou « Non borné ». */
  ends: number | string | null;
}

const CODE_ABBR: Record<string, string> = {
  'code général des impôts': 'CGI',
  'code des impositions sur les biens et services': 'CIBS',
  'code des douanes': 'Code des douanes',
  'Code général des collectivités territoriales': 'CGCT',
  BOFIP: 'BOFiP',
};

export function legalLabel(ref: RawNiche['legal_ref']): string | null {
  const reference = ref.reference?.trim() || null;
  const code = ref.code ? (CODE_ABBR[ref.code] ?? ref.code) : null;
  if (code && reference) {
    return code === 'BOFiP' ? `${code} ${reference}` : `${code}, art. ${reference}`;
  }
  return reference ?? code;
}

const FLAGS: Record<string, CostFlag> = {
  epsilon: 'epsilon',
  nc: 'nc',
  aucun_effet: 'aucun_effet',
};

function planOf(raw: RawNiche): PlanId {
  const code = raw.resolution.suppression_code;
  const hit = PLAN_IDS.find((id) => PLAN_META[id].raw === code);
  return hit ?? 'eteinte';
}

export function toRow(raw: RawNiche): NicheRow {
  const flags = raw.cost_flags ?? {};
  const flagFor = (y: CostYear): CostFlag | null => FLAGS[flags[String(y)] ?? ''] ?? null;
  const purpose = raw.purpose_fr?.replace(/^Finalité\s*:\s*/i, '').trim() || null;
  return {
    id: raw.id,
    label: raw.label_fr.trim(),
    cat: CATEGORY_BY_RAW[raw.category] ?? 'autre',
    tax: TAX_BY_RAW[raw.tax] ?? 'autres-droits',
    plan: planOf(raw),
    cost: [raw.cost_2024_meur, raw.cost_2025_meur, raw.cost_2026_meur],
    flag: [flagFor(2024), flagFor(2025), flagFor(2026)],
    legal: legalLabel(raw.legal_ref),
    menages: raw.household_common,
    menagesWhy: raw.household_common_reason,
    reliability: raw.reliability,
    who: raw.beneficiaries.type,
    whoCount: raw.beneficiaries.count,
    purpose,
    created: raw.dates.creation,
    ends: raw.dates.fin_fait_generateur,
  };
}

export const toRows = (raw: RawNiche[]): NicheRow[] => raw.map(toRow);

/* ── Quand ? (sans inventer de date par niche) ─────────────────────────── */

export interface WhenInfo {
  /** Texte court : « Dès 2027 (cas général) ». */
  text: string;
  /** Date (AAAA-MM-JJ) du groupe correspondant dans /comprendre/calendrier/, s'il y en a un. */
  anchor: string | null;
}

/** Réductions d'impôt pour dons (IR, IS, IFI) : l'avantage est réduit de moitié puis supprimé. */
const DONS_IDS = ['110201', '210309', '440201'];

/**
 * Date d'effet d'une niche, au niveau de précision que les sources permettent.
 * Les 359 niches « supprimées » n'ont pas de date publiée une à une : on donne le *cas général*
 * de l'amendement PLF-P1 n° 1 selon l'impôt (calendrier cal_005 et cal_040), et on renvoie au texte
 * pour le reste — jamais une date plus précise que la source.
 */
export function whenOf(row: Pick<NicheRow, 'plan' | 'tax' | 'cat' | 'id'>): WhenInfo {
  switch (row.plan) {
    case 'trois-ans':
      return {
        text: 'Un tiers en 2027, deux tiers en 2028, supprimée en 2029',
        anchor: '2027-01-01',
      };
    case 'aide-fondamentale':
      return {
        text: 'Avec l’aide fondamentale, à partir du 1er janvier 2028',
        anchor: '2028-01-01',
      };
    case 'outre-mer':
      return { text: 'Pas de date : régime refondu à part', anchor: null };
    case 'eteinte':
      return { text: 'Rien à supprimer', anchor: null };
    case 'supprimee':
      // Calendriers propres de l'amendement n° 1 (IV) : dons (cal_038, cal_064) et épargne (cal_039).
      if (DONS_IDS.includes(row.id)) {
        return { text: 'Moitié dès le 1er juillet 2027, plus rien en 2028', anchor: '2027-07-01' };
      }
      if (row.cat === 'epargne') {
        return {
          text: 'Plans et livrets ouverts ou alimentés dès le 1er juillet 2027',
          anchor: '2027-07-01',
        };
      }
      if (row.tax === 'tva' || row.tax === 'accises') {
        return { text: 'Dès le 1er juillet 2027 (cas général)', anchor: '2027-07-01' };
      }
      if (row.tax === 'ir' || row.tax === 'is' || row.tax === 'ir-is' || row.tax === 'droits') {
        return { text: 'Dès 2027 (cas général)', anchor: '2027-01-01' };
      }
      return { text: 'Date fixée par l’amendement n° 1', anchor: null };
  }
}

/* ── Coûts ──────────────────────────────────────────────────────────────── */

export const yearIndex = (y: CostYear): 0 | 1 | 2 => (y === 2024 ? 0 : y === 2025 ? 1 : 2);

export function costOf(row: NicheRow, year: CostYear): number | null {
  return row.cost[yearIndex(year)];
}

export function flagOf(row: NicheRow, year: CostYear): CostFlag | null {
  return row.flag[yearIndex(year)];
}

/** Libellé court d'un coût manquant (jamais « 0 »). */
export const FLAG_LABEL: Record<CostFlag, string> = {
  epsilon: 'moins de 0,5 M€, non calculé',
  nc: 'non calculé',
  aucun_effet: 'aucun effet budgétaire',
};

export interface Selection {
  count: number;
  /** Somme des coûts connus (M€). */
  total: number;
  /** Niches sans coût chiffré pour l'année. */
  unpriced: number;
}

export function summarize(rows: readonly NicheRow[], year: CostYear): Selection {
  let total = 0;
  let unpriced = 0;
  for (const r of rows) {
    const c = costOf(r, year);
    if (c === null) unpriced++;
    else total += c;
  }
  return { count: rows.length, total, unpriced };
}

/* ── Recherche insensible aux accents ───────────────────────────────────── */

export { normalize, tokens };

const haystackCache = new WeakMap<NicheRow, string>();

/** Texte indexé d'une niche (intitulé, référence, impôt, catégorie, finalité, identifiant). */
export function haystack(row: NicheRow): string {
  let h = haystackCache.get(row);
  if (h === undefined) {
    h = normalize(
      [
        row.label,
        row.legal ?? '',
        TAX_META[row.tax].label,
        CATEGORY_META[row.cat].label,
        PLAN_META[row.plan].label,
        row.purpose ?? '',
        row.id,
      ].join(' · '),
    );
    haystackCache.set(row, h);
  }
  return h;
}

/* ── État de l'explorateur (et son encodage dans l'URL) ─────────────────── */

export type SortKey = 'cout' | 'nom';
export type SortDir = 'asc' | 'desc';

export interface ExplorerState {
  q: string;
  cats: CategoryId[];
  taxes: TaxId[];
  plans: PlanId[];
  menages: boolean;
  year: CostYear;
  sort: SortKey;
  dir: SortDir;
  /** Page courante, à partir de 1. */
  page: number;
}

export const PAGE_SIZE = 25;

export const DEFAULT_STATE: ExplorerState = {
  q: '',
  cats: [],
  taxes: [],
  plans: [],
  menages: false,
  year: 2024,
  sort: 'cout',
  dir: 'desc',
  page: 1,
};

export function filterRows(rows: readonly NicheRow[], s: ExplorerState): NicheRow[] {
  const toks = tokens(s.q);
  return rows.filter((r) => {
    if (s.cats.length && !s.cats.includes(r.cat)) return false;
    if (s.taxes.length && !s.taxes.includes(r.tax)) return false;
    if (s.plans.length && !s.plans.includes(r.plan)) return false;
    if (s.menages && !r.menages) return false;
    if (toks.length) {
      const h = haystack(r);
      for (const t of toks) if (!h.includes(t)) return false;
    }
    return true;
  });
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Tri stable ; les coûts manquants passent toujours en dernier, quel que soit le sens. */
export function sortRows(rows: readonly NicheRow[], s: ExplorerState): NicheRow[] {
  const sign = s.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (s.sort === 'nom') return sign * collator.compare(a.label, b.label);
    const ca = costOf(a, s.year);
    const cb = costOf(b, s.year);
    if (ca === null && cb === null) return collator.compare(a.label, b.label);
    if (ca === null) return 1;
    if (cb === null) return -1;
    return ca === cb ? collator.compare(a.label, b.label) : sign * (ca - cb);
  });
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export const clampPage = (page: number, total: number, size = PAGE_SIZE) =>
  Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, size));

/** Les « isActive » : sert au compteur de filtres et au bouton « Tout réinitialiser ». */
export function activeFilterCount(s: ExplorerState): number {
  return (
    (s.q.trim() ? 1 : 0) +
    (s.cats.length ? 1 : 0) +
    (s.taxes.length ? 1 : 0) +
    (s.plans.length ? 1 : 0) +
    (s.menages ? 1 : 0)
  );
}

function sameList<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function isDefaultState(s: ExplorerState): boolean {
  const d = DEFAULT_STATE;
  return (
    s.q === d.q &&
    sameList(s.cats, d.cats) &&
    sameList(s.taxes, d.taxes) &&
    sameList(s.plans, d.plans) &&
    s.menages === d.menages &&
    s.year === d.year &&
    s.sort === d.sort &&
    s.dir === d.dir &&
    s.page === d.page
  );
}

/**
 * État → fragment d'URL (`q=garde&cat=menages,epargne&m=1`), valeurs par défaut omises.
 * Le fragment (et non la requête) ne part jamais vers un serveur : même règle que le simulateur.
 */
export function serializeState(s: ExplorerState): string {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set('q', s.q.trim());
  if (s.cats.length) p.set('cat', s.cats.join(','));
  if (s.taxes.length) p.set('impot', s.taxes.join(','));
  if (s.plans.length) p.set('plan', s.plans.join(','));
  if (s.menages) p.set('menages', '1');
  if (s.year !== DEFAULT_STATE.year) p.set('annee', String(s.year));
  if (s.sort !== DEFAULT_STATE.sort) p.set('tri', s.sort);
  if (s.dir !== DEFAULT_STATE.dir) p.set('sens', s.dir);
  if (s.page > 1) p.set('page', String(s.page));
  return p.toString();
}

function pickList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return [];
  const set = new Set(value.split(',').map((v) => v.trim()));
  return allowed.filter((a) => set.has(a)); // ordre canonique, valeurs inconnues ignorées
}

/** Fragment (avec ou sans « # ») → état, en ignorant tout ce qui n'est pas reconnu. */
export function parseState(hash: string): ExplorerState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const year = Number(p.get('annee'));
  const page = Number(p.get('page'));
  const sort = p.get('tri');
  const dir = p.get('sens');
  const sortKey: SortKey = sort === 'nom' ? 'nom' : 'cout';
  return {
    q: (p.get('q') ?? '').slice(0, 120),
    cats: pickList(p.get('cat'), CATEGORY_IDS),
    taxes: pickList(p.get('impot'), TAX_IDS),
    plans: pickList(p.get('plan'), PLAN_IDS),
    menages: p.get('menages') === '1',
    year: (COST_YEARS as readonly number[]).includes(year) ? (year as CostYear) : 2024,
    sort: sortKey,
    dir: dir === 'asc' || dir === 'desc' ? dir : sortKey === 'nom' ? 'asc' : 'desc',
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/* ── Agrégats pour les graphiques (calculés au build) ───────────────────── */

export interface Slice<K extends string = string> {
  key: K;
  label: string;
  count: number;
  /** Somme des coûts connus (M€). */
  total: number;
  unpriced: number;
}

export function groupBy<K extends string>(
  rows: readonly NicheRow[],
  year: CostYear,
  keyOf: (r: NicheRow) => K,
  labelOf: (k: K) => string,
): Slice<K>[] {
  const map = new Map<K, Slice<K>>();
  for (const r of rows) {
    const k = keyOf(r);
    const s = map.get(k) ?? { key: k, label: labelOf(k), count: 0, total: 0, unpriced: 0 };
    s.count++;
    const c = costOf(r, year);
    if (c === null) s.unpriced++;
    else s.total += c;
    map.set(k, s);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.count - a.count);
}

export const byCategory = (rows: readonly NicheRow[], year: CostYear = 2024) =>
  groupBy(
    rows,
    year,
    (r) => r.cat,
    (k) => CATEGORY_META[k].label,
  );

export const byTax = (rows: readonly NicheRow[], year: CostYear = 2024) =>
  groupBy(
    rows,
    year,
    (r) => r.tax,
    (k) => TAX_META[k].label,
  );

export const byPlan = (rows: readonly NicheRow[], year: CostYear = 2024) =>
  groupBy(
    rows,
    year,
    (r) => r.plan,
    (k) => PLAN_META[k].label,
  );

/** Les `n` niches les plus coûteuses pour l'année (coûts connus uniquement). */
export function topN(rows: readonly NicheRow[], year: CostYear, n: number): NicheRow[] {
  return sortRows(
    rows.filter((r) => costOf(r, year) !== null),
    { ...DEFAULT_STATE, year },
  ).slice(0, n);
}

/** Raccourcit un intitulé sans couper un mot en deux. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.(-]+$/, '')}…`;
}
