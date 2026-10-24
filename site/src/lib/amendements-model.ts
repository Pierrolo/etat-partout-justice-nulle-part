/**
 * Les 81 amendements — modèle de l'explorateur (/comprendre/amendements).
 *
 * Ce sont des projets d'amendements rédigés par l'association Résolution (liasses du 19 octobre
 * 2026) : ni déposés, ni adoptés. « Proposé dans un amendement » (niveau `law`) veut dire « écrit dans le
 * texte de loi proposé » — jamais « en vigueur ». Pur TypeScript, sans DOM.
 */
import { formatDateFr } from './dates';
import { matchesAll, normalize, tokens } from './search';

export const LIASSE_IDS = ['PLF-P1', 'PLF-P2', 'PLFSS'] as const;
export type LiasseId = (typeof LIASSE_IDS)[number];

export interface RawAmendement {
  id: string;
  liasse: LiasseId;
  number: number;
  title_fr: string;
  article_fr: string;
  lot_fr: string | null;
  theme: string;
  resume_fr: string;
  objet_expose_fr: string;
  dates: Array<{ date: string; label_fr: string; precision: string }>;
  effective_from: string | null;
  effective_to: string | null;
  pdf_page: number;
  pdf_url: string;
}

export interface RawLiasse {
  id: LiasseId;
  label_fr: string;
  bill_fr: string;
  date_fr: string;
  n_amendements: number;
  n_pages: number;
  pdf_url: string;
  docx_url: string;
}

export interface RawTheme {
  id: string;
  label_fr: string;
  n: number;
}

export interface AmItem {
  id: string;
  liasse: LiasseId;
  number: number;
  title: string;
  /** Article du projet de loi visé (« Article additionnel après l'article 2 »). */
  article: string;
  theme: string;
  /** Résumé neutre en une phrase. */
  summary: string;
  from: string | null;
  to: string | null;
  dates: Array<{ date: string; label: string; precision: string }>;
  pdfUrl: string;
  pdfPage: number;
}

export interface LiasseInfo {
  id: LiasseId;
  label: string;
  bill: string;
  date: string;
  count: number;
  pages: number;
  pdfUrl: string;
  docxUrl: string;
}

export interface ThemeInfo {
  id: string;
  label: string;
  count: number;
}

export const toItems = (raw: RawAmendement[]): AmItem[] =>
  raw.map((a) => ({
    id: a.id,
    liasse: a.liasse,
    number: a.number,
    title: a.title_fr,
    article: a.article_fr,
    theme: a.theme,
    summary: a.resume_fr,
    from: a.effective_from,
    to: a.effective_to,
    dates: a.dates.map((d) => ({ date: d.date, label: d.label_fr, precision: d.precision })),
    pdfUrl: a.pdf_url,
    pdfPage: a.pdf_page,
  }));

export const toLiasses = (raw: RawLiasse[]): LiasseInfo[] =>
  raw.map((l) => ({
    id: l.id,
    label: l.label_fr,
    bill: l.bill_fr,
    date: l.date_fr,
    count: l.n_amendements,
    pages: l.n_pages,
    pdfUrl: l.pdf_url,
    docxUrl: l.docx_url,
  }));

export const toThemes = (raw: RawTheme[]): ThemeInfo[] =>
  raw.map((t) => ({ id: t.id, label: t.label_fr, count: t.n }));

/** « PLF 2027, première partie » → étiquette courte pour une pastille. */
export const LIASSE_SHORT: Record<LiasseId, string> = {
  'PLF-P1': 'PLF, 1re partie',
  'PLF-P2': 'PLF, 2de partie',
  PLFSS: 'PLFSS',
};

/** « PLF-P1 n° 28 » */
export const amendmentLabel = (a: Pick<AmItem, 'liasse' | 'number'>) =>
  `${a.liasse} n° ${a.number}`;

/** Ce que le texte dit de la date d'effet, sans rien ajouter. */
export function effectText(a: Pick<AmItem, 'from' | 'to'>): string {
  if (!a.from) return 'Aucune date écrite dans le texte.';
  if (!a.to || a.to === a.from) return `Prend effet le ${formatDateFr(a.from)}.`;
  return `Premier effet le ${formatDateFr(a.from)}, dernier le ${formatDateFr(a.to)}.`;
}

/* ── Recherche et filtres ───────────────────────────────────────────────── */

const haystackCache = new WeakMap<AmItem, string>();

export function haystack(a: AmItem, themeLabel: string): string {
  let h = haystackCache.get(a);
  if (h === undefined) {
    h = normalize(
      [`n° ${a.number}`, a.liasse, a.id, a.title, a.summary, a.article, themeLabel].join(' · '),
    );
    haystackCache.set(a, h);
  }
  return h;
}

export type GroupMode = 'liasse' | 'theme';

export interface AmState {
  q: string;
  liasses: LiasseId[];
  /** Identifiant de thème, ou « » pour tous. */
  theme: string;
  group: GroupMode;
}

export const DEFAULT_AM_STATE: AmState = { q: '', liasses: [], theme: '', group: 'liasse' };

export function filterItems(
  items: readonly AmItem[],
  s: AmState,
  themeLabel: (id: string) => string,
): AmItem[] {
  const toks = tokens(s.q);
  return items.filter((a) => {
    if (s.liasses.length && !s.liasses.includes(a.liasse)) return false;
    if (s.theme && a.theme !== s.theme) return false;
    return !toks.length || matchesAll(haystack(a, themeLabel(a.theme)), toks);
  });
}

export interface AmGroup {
  key: string;
  label: string;
  /** Détail secondaire (projet de loi, date des liasses). */
  detail?: string;
  items: AmItem[];
}

export function groupItems(
  items: readonly AmItem[],
  mode: GroupMode,
  liasses: readonly LiasseInfo[],
  themes: readonly ThemeInfo[],
): AmGroup[] {
  const sorted = [...items].sort(
    (a, b) => LIASSE_IDS.indexOf(a.liasse) - LIASSE_IDS.indexOf(b.liasse) || a.number - b.number,
  );
  if (mode === 'liasse') {
    return liasses
      .map((l) => ({
        key: l.id,
        label: l.label,
        detail: `${l.bill}, liasse du ${l.date}`,
        items: sorted.filter((a) => a.liasse === l.id),
      }))
      .filter((g) => g.items.length > 0);
  }
  return themes
    .map((t) => ({ key: t.id, label: t.label, items: sorted.filter((a) => a.theme === t.id) }))
    .filter((g) => g.items.length > 0);
}

/* ── État dans l'URL (fragment) ─────────────────────────────────────────── */

export function serializeAmState(s: AmState): string {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set('q', s.q.trim());
  if (s.liasses.length) p.set('liasse', s.liasses.join(','));
  if (s.theme) p.set('theme', s.theme);
  if (s.group !== 'liasse') p.set('par', s.group);
  return p.toString();
}

export function parseAmState(hash: string, themeIds: readonly string[]): AmState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const wanted = new Set((p.get('liasse') ?? '').split(',').map((v) => v.trim()));
  const theme = p.get('theme') ?? '';
  return {
    q: (p.get('q') ?? '').slice(0, 120),
    liasses: LIASSE_IDS.filter((l) => wanted.has(l)),
    theme: themeIds.includes(theme) ? theme : '',
    group: p.get('par') === 'theme' ? 'theme' : 'liasse',
  };
}
