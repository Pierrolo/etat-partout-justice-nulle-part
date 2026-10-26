/**
 * Explorateur des 465 niches fiscales — tableau recherchable, filtrable, triable, paginé.
 *
 * Données : seules les 25 premières lignes (tri par défaut) sont rendues côté serveur, avec le
 * compte et les facettes ; les 465 lignes arrivent ensuite par `fetch` (JSON compact, mis en cache)
 * et l'îlot reprend la main. L'état (recherche, filtres, tri, page) vit dans le fragment d'URL :
 * partageable, jamais envoyé à un serveur.
 *
 * Accessibilité : vrai <table> (légende, <th scope>, `aria-sort`), filtres = boutons `aria-pressed`,
 * annonces par `role="status"`, cibles ≥ 40 px, aucune information réservée au survol.
 */
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Callout, SegmentedControl, Switch } from '@/components/ui';
import { IconChevron } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { toCsv, type Cell } from '@/lib/csv';
import { formatInteger, formatMdEuro, formatNumber, NBSP } from '@/lib/format';
import {
  CATEGORY_IDS,
  CATEGORY_META,
  COST_YEARS,
  DEFAULT_STATE,
  FLAG_LABEL,
  PAGE_SIZE,
  PLAN_IDS,
  PLAN_META,
  TAX_IDS,
  TAX_META,
  activeFilterCount,
  clampPage,
  costOf,
  filterRows,
  flagOf,
  isDefaultState,
  pageCount,
  parseState,
  serializeState,
  sortRows,
  summarize,
  whenOf,
  type CategoryId,
  type CostYear,
  type ExplorerState,
  type NicheRow,
  type PlanId,
  type Selection,
  type SortKey,
  type TaxId,
} from '@/lib/niches-model';
import { FilterChip, Pager, SearchBox } from './controls';
import { catColor } from './niche-colors';
import '@/components/story/story.css';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface NichesExplorerProps {
  /** Première page dans l'ordre par défaut : rendue sans JavaScript. */
  initialRows: NicheRow[];
  /** Résumé de l'état par défaut (465 niches, coût 2024). */
  initialSummary: Selection;
  /** Nombre de niches par catégorie / impôt / effet du plan, sur l'ensemble. */
  facets: {
    cats: Record<CategoryId, number>;
    taxes: Record<TaxId, number>;
    plans: Record<PlanId, number>;
    menages: number;
  };
  /** URL (avec base) du JSON compact des 465 lignes. */
  dataUrl: string;
  /** Liens sortants, déjà préfixés par la base du site. */
  links: { amendements: string; calendrier: string };
}

/* ── Formatage local (tout passe par format.ts) ─────────────────────────── */

const meur = (v: number) => `${formatNumber(v, { decimals: { min: 0, max: 1 } })}${NBSP}M€`;
const mdFromMeur = (v: number) => formatMdEuro(v / 1000);
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

const YEAR_LABEL: Record<CostYear, string> = {
  2024: '2024 · réalisé',
  2025: '2025 · prévision',
  2026: '2026 · prévision',
};

/* ── Icônes d'effet du plan (forme ≠ couleur) ───────────────────────────── */

function PlanIcon({ plan }: { plan: PlanId }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className: 'mt-[0.2em] shrink-0',
  };
  switch (plan) {
    case 'supprimee':
      return (
        <svg {...common}>
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      );
    case 'trois-ans':
      return (
        <svg {...common}>
          <path d="M2.5 3.5h3.5v3h3.5v3H13v3" />
        </svg>
      );
    case 'aide-fondamentale':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'outre-mer':
      return (
        <svg {...common}>
          <path d="M2.5 9c1.4-1.8 2.8-1.8 4.2 0s2.8 1.8 4.2 0M2.5 5.5c1.4-1.8 2.8-1.8 4.2 0s2.8 1.8 4.2 0" />
        </svg>
      );
    case 'eteinte':
      return (
        <svg {...common}>
          <path d="M3.5 8h9" />
        </svg>
      );
  }
}

/* ── Ligne du tableau ───────────────────────────────────────────────────── */

interface RowProps {
  row: NicheRow;
  year: CostYear;
  maxCost: number;
  links: NichesExplorerProps['links'];
}

function CostCell({ row, year, maxCost }: Pick<RowProps, 'row' | 'year' | 'maxCost'>) {
  const cost = costOf(row, year);
  if (cost === null) {
    const flag = flagOf(row, year);
    return (
      <>
        <p className="text-end font-semibold text-ink-2">non chiffré</p>
        {flag && <p className="mt-0.5 text-end text-xs text-ink-3">{FLAG_LABEL[flag]}</p>}
      </>
    );
  }
  const ratio = maxCost > 0 ? Math.min(1, cost / maxCost) : 0;
  return (
    <>
      <p className="num text-end font-semibold text-ink">{meur(cost)}</p>
      <div
        aria-hidden="true"
        className="mt-1.5 h-1.5 w-full rounded-full bg-sunken forced-color-adjust-none"
      >
        <div
          className="h-full rounded-e-[4px] forced-color-adjust-none"
          style={{
            width: `${(ratio * 100).toFixed(2)}%`,
            minWidth: cost > 0 ? 3 : 0,
            background: catColor(row.cat),
          }}
        />
      </div>
    </>
  );
}

function PlanCell({ row, links }: Pick<RowProps, 'row' | 'links'>) {
  const plan = PLAN_META[row.plan];
  const when = whenOf(row);
  const dead = row.plan === 'eteinte';
  return (
    <>
      <p className={cn('flex items-start gap-1.5 font-semibold', dead ? 'text-ink-2' : 'text-ink')}>
        <PlanIcon plan={row.plan} />
        <span>{plan.label}</span>
      </p>
      <p className="mt-1 text-sm text-ink-2">{when.text}</p>
      {!dead && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          <a href={`${links.amendements}#PLF-P1-1`}>Amendement n° 1</a>
          {when.anchor && <a href={`${links.calendrier}#d-${when.anchor}`}>Calendrier</a>}
        </p>
      )}
    </>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="font-semibold text-ink-2">{term}</dt>
      <dd className="min-w-0 text-ink-2 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const NicheLine = memo(function NicheLine({ row, year, maxCost, links }: RowProps) {
  const long = row.label.length > 150;
  return (
    <tr>
      <th scope="row" aria-labelledby={`niche-${row.id}-l`} className="!align-top !font-normal">
        <p
          id={`niche-${row.id}-l`}
          className={cn('font-medium leading-snug text-ink', long && 'line-clamp-3')}
        >
          {row.label}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full forced-color-adjust-none"
              style={{ background: catColor(row.cat) }}
            />
            {CATEGORY_META[row.cat].label}
          </span>
          <span aria-hidden="true">·</span>
          <span>{TAX_META[row.tax].label}</span>
          {row.menages && (
            <span className="rounded-sm border border-rule-strong px-1.5 py-0.5 text-xs font-semibold text-ink-2">
              Concerne souvent les ménages
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-ink-3">
          {row.legal ? <>Réf. : {row.legal}</> : <>Référence légale non précisée</>}
        </p>

        {/* Mobile : « ce que fait le plan » passe sous l'intitulé (la 3e colonne est masquée). */}
        <div className="mt-2.5 border-s-[3px] border-rule-strong ps-3 sm:hidden">
          <PlanCell row={row} links={links} />
        </div>

        <details className="group/d mt-1.5">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-accent marker:content-none [&::-webkit-details-marker]:hidden hover:underline">
            Détails
            <IconChevron size={14} className="transition-transform group-open/d:rotate-180" />
          </summary>
          <dl className="mt-1 space-y-1.5 text-sm">
            {long && <Detail term="Intitulé complet">{row.label}</Detail>}
            {row.purpose && <Detail term="Finalité">{row.purpose}</Detail>}
            <Detail term="Bénéficiaires">
              {row.who ?? 'Non précisés'}
              {row.whoCount !== null
                ? ` · ${formatInteger(row.whoCount)}`
                : ' · nombre non déterminé'}
            </Detail>
            <Detail term="Fiabilité du chiffrage">{row.reliability ?? 'Non indiquée'}</Detail>
            <Detail term="Historique">
              {row.created ? `Créée en ${row.created}` : 'Année de création inconnue'}
              {row.ends !== null &&
                ` · fait générateur : ${typeof row.ends === 'number' ? `jusqu’en ${row.ends}` : row.ends.toLowerCase()}`}
            </Detail>
            {row.menagesWhy && <Detail term="Pourquoi « ménages »">{row.menagesWhy}</Detail>}
            <Detail term="Identifiant">{row.id}</Detail>
          </dl>
        </details>
      </th>
      <td className="!align-top">
        <CostCell row={row} year={year} maxCost={maxCost} />
      </td>
      <td className="!align-top max-sm:hidden">
        <PlanCell row={row} links={links} />
      </td>
    </tr>
  );
});

/* ── En-tête triable ────────────────────────────────────────────────────── */

function SortHeader({
  label,
  sortKey,
  state,
  onSort,
  align = 'start',
  className,
}: {
  label: string;
  sortKey: SortKey;
  state: ExplorerState;
  onSort: (key: SortKey) => void;
  align?: 'start' | 'end';
  className?: string;
}) {
  const active = state.sort === sortKey;
  const aria = active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const arrow = active ? (state.dir === 'asc' ? '↑' : '↓') : '↕';
  const hint =
    sortKey === 'cout'
      ? active && state.dir === 'desc'
        ? 'du plus faible au plus élevé'
        : 'du plus élevé au plus faible'
      : active && state.dir === 'asc'
        ? 'de Z à A'
        : 'de A à Z';
  return (
    <th
      scope="col"
      aria-sort={aria}
      data-numeric={align === 'end' ? '' : undefined}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          '-mx-2 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md px-2 font-semibold hover:bg-rule/60 hover:text-ink',
        )}
      >
        <span>
          {label}
          <span className="sr-only"> — trier {hint}</span>
        </span>
        <span aria-hidden="true" className={cn('text-base leading-none', !active && 'text-ink-3')}>
          {arrow}
        </span>
      </button>
    </th>
  );
}

/* ── Composant principal ────────────────────────────────────────────────── */

export default function NichesExplorer({
  initialRows,
  initialSummary,
  facets,
  dataUrl,
  links,
}: NichesExplorerProps) {
  const [all, setAll] = useState<NicheRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ui, setUi] = useState<ExplorerState>(DEFAULT_STATE);
  const [copied, setCopied] = useState<'ok' | 'ko' | null>(null);
  const [announce, setAnnounce] = useState('');
  const tableTop = useRef<HTMLDivElement>(null);
  const written = useRef<string | null>(null);

  /* Chargement des 465 lignes + lecture du fragment d'URL. */
  useEffect(() => {
    const initial = parseState(window.location.hash);
    written.current = serializeState(initial);
    setUi(initial);
    const onHash = () => {
      // Une ancre de page (#liste) ne doit pas effacer les filtres : seul un fragment de filtres compte.
      if (!window.location.hash.includes('=')) return;
      const next = parseState(window.location.hash);
      if (serializeState(next) !== written.current) {
        written.current = serializeState(next);
        setUi(next);
      }
    };
    window.addEventListener('hashchange', onHash);
    const ctl = new AbortController();
    fetch(dataUrl, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rows: NicheRow[] }) => setAll(d.rows))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setFailed(true);
      });
    return () => {
      ctl.abort();
      window.removeEventListener('hashchange', onHash);
    };
  }, [dataUrl]);

  /* État → fragment (sans empiler l'historique). */
  useEffect(() => {
    if (written.current === null) return; // lecture initiale pas encore faite
    const s = serializeState(ui);
    if (s === written.current) return;
    written.current = s;
    const url = `${window.location.pathname}${window.location.search}${s ? `#${s}` : ''}`;
    window.history.replaceState(null, '', url);
  }, [ui]);

  const patch = useCallback((p: Partial<ExplorerState>) => {
    setUi((prev) => ({ ...prev, page: 1, ...p }));
  }, []);

  const toggleIn = useCallback(
    <T extends string>(key: 'cats' | 'taxes' | 'plans', value: T, canonical: readonly T[]) => {
      setUi((prev) => {
        const cur = prev[key] as unknown as T[];
        const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
        return {
          ...prev,
          page: 1,
          [key]: canonical.filter((c) => next.includes(c)),
        };
      });
    },
    [],
  );

  const onSort = useCallback((key: SortKey) => {
    setUi((prev) =>
      prev.sort === key
        ? { ...prev, page: 1, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { ...prev, page: 1, sort: key, dir: key === 'nom' ? 'asc' : 'desc' },
    );
  }, []);

  /* Calcul de la sélection. */
  const dq = useDeferredValue(ui.q);
  const loading = all === null && !isDefaultState(ui);
  const source = all ?? initialRows;
  const filtered = useMemo(() => {
    if (all === null && !loading) return initialRows;
    if (all === null) return [] as NicheRow[];
    const s = { ...ui, q: dq };
    return sortRows(filterRows(all, s), s);
  }, [all, loading, initialRows, dq, ui]);

  const summary: Selection = useMemo(
    () => (all === null ? initialSummary : summarize(filtered, ui.year)),
    [all, filtered, ui.year, initialSummary],
  );
  const count = all === null ? initialSummary.count : filtered.length;
  const pages = pageCount(count);
  const page = clampPage(ui.page, count);
  const pageRows = useMemo(
    () =>
      all === null
        ? source.slice(0, PAGE_SIZE)
        : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [all, source, filtered, page],
  );
  const maxCost = useMemo(() => {
    let m = 0;
    for (const r of all ?? source) m = Math.max(m, costOf(r, ui.year) ?? 0);
    return m;
  }, [all, source, ui.year]);

  const nFilters = activeFilterCount(ui);
  const sortLabel =
    ui.sort === 'nom'
      ? `nom, de ${ui.dir === 'asc' ? 'A à Z' : 'Z à A'}`
      : `coût ${ui.year}, ${ui.dir === 'desc' ? 'du plus élevé au plus faible' : 'du plus faible au plus élevé'}`;

  const resultText = loading
    ? 'Chargement des niches…'
    : `${formatInteger(count)} ${plural(count, 'niche', 'niches')} · coût ${ui.year} : ${
        count - summary.unpriced > 0 ? mdFromMeur(summary.total) : 'aucun chiffré'
      }${summary.unpriced ? ` (hors ${formatInteger(summary.unpriced)} non ${plural(summary.unpriced, 'chiffrée', 'chiffrées')})` : ''}`;

  /* Annonce vocale, après la frappe. */
  useEffect(() => {
    if (loading) return;
    const t = window.setTimeout(
      () => setAnnounce(`${resultText}. Page ${page} sur ${pages}.`),
      500,
    );
    return () => window.clearTimeout(t);
  }, [resultText, page, pages, loading]);

  const goToPage = (p: number) => {
    setUi((prev) => ({ ...prev, page: p }));
    const el = tableTop.current;
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied('ok');
    } catch {
      setCopied('ko');
    }
    window.setTimeout(() => setCopied(null), 4000);
  };

  /** CSV de la sélection courante : valeurs brutes (M€), cellule vide quand le coût n'est pas chiffré. */
  const downloadCsv = () => {
    const rows: Array<Record<string, Cell>> = (all === null ? initialRows : filtered).map((r) => ({
      id: r.id,
      intitule: r.label,
      categorie: CATEGORY_META[r.cat].label,
      impot: TAX_META[r.tax].label,
      cout_2024_meur: r.cost[0],
      cout_2025_meur: r.cost[1],
      cout_2026_meur: r.cost[2],
      motif_2024_si_non_chiffre: r.flag[0] ? FLAG_LABEL[r.flag[0]] : '',
      reference_legale: r.legal ?? '',
      concerne_souvent_les_menages: r.menages ? 'oui' : 'non',
      effet_du_plan: PLAN_META[r.plan].label,
    }));
    const columns = Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key }));
    const csv = toCsv(columns, rows);
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'niches-fiscales-selection.csv';
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    setUi({ ...DEFAULT_STATE, year: ui.year, sort: ui.sort, dir: ui.dir });
  };

  const moreFilters = ui.taxes.length + ui.plans.length + (ui.year !== 2024 ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* ── Filtres : une seule rangée au-dessus de ce qu'ils règlent ── */}
      <div className="card space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <SearchBox
            label="Rechercher une niche"
            value={ui.q}
            onChange={(q) => patch({ q })}
            placeholder="garde d’enfants, dons, livret A, 163 quatervicies…"
            hint="Cherche dans l’intitulé, la référence légale, l’impôt et la finalité — sans tenir compte des accents."
          />
          <Switch
            label="Concerne souvent les ménages"
            checked={ui.menages}
            onChange={(menages) => patch({ menages })}
            hint={`${formatInteger(facets.menages)} niches que la plupart des foyers rencontrent : emploi à domicile, garde d’enfants, dons, livrets, TVA des travaux…`}
            stateLabels={['Oui', 'Non']}
          />
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-[0.9375rem] font-semibold text-ink">
            Catégorie <span className="font-normal text-ink-3">(plusieurs choix possibles)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_IDS.map((id) => (
              <FilterChip
                key={id}
                pressed={ui.cats.includes(id)}
                onToggle={() => toggleIn('cats', id, CATEGORY_IDS)}
                swatch={catColor(id)}
                count={facets.cats[id]}
              >
                {CATEGORY_META[id].label}
              </FilterChip>
            ))}
          </div>
        </fieldset>

        <details
          className="group/f rounded-md border border-rule bg-sunken/50"
          open={moreFilters > 0 || undefined}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-[0.9375rem] font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden hover:text-accent">
            <span>
              Plus de filtres
              <span className="font-normal text-ink-3">
                &#8239;: impôt, effet du plan, année du coût
                {moreFilters > 0 && ` · ${moreFilters} actif${moreFilters > 1 ? 's' : ''}`}
              </span>
            </span>
            <IconChevron
              size={18}
              className="shrink-0 transition-transform group-open/f:rotate-180"
            />
          </summary>
          <div className="space-y-5 px-4 pb-4 pt-2">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[0.9375rem] font-semibold text-ink">
                Impôt concerné
              </legend>
              <div className="flex flex-wrap gap-2">
                {TAX_IDS.map((id) => (
                  <FilterChip
                    key={id}
                    pressed={ui.taxes.includes(id)}
                    onToggle={() => toggleIn('taxes', id, TAX_IDS)}
                    count={facets.taxes[id]}
                  >
                    {TAX_META[id].label}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[0.9375rem] font-semibold text-ink">
                Ce que prévoit le plan
              </legend>
              <div className="flex flex-wrap gap-2">
                {PLAN_IDS.map((id) => (
                  <FilterChip
                    key={id}
                    pressed={ui.plans.includes(id)}
                    onToggle={() => toggleIn('plans', id, PLAN_IDS)}
                    count={facets.plans[id]}
                  >
                    {PLAN_META[id].label}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
            <SegmentedControl<`${CostYear}`>
              legend="Année du coût affiché et trié"
              size="sm"
              value={`${ui.year}`}
              onChange={(v) => patch({ year: Number(v) as CostYear })}
              options={COST_YEARS.map((y) => ({
                value: `${y}` as `${CostYear}`,
                label: YEAR_LABEL[y],
              }))}
            />
          </div>
        </details>
      </div>

      {/* ── Résultat ── */}
      <div ref={tableTop} className="scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="num text-[0.9375rem] text-ink" data-testid="niches-summary">
            <strong className="font-semibold">{resultText}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {nFilters > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                Réinitialiser les filtres
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyLink}>
              Copier le lien de cette sélection
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={downloadCsv}
              disabled={loading || count === 0}
            >
              Télécharger la sélection (CSV)
            </button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
        {copied && (
          <p role="status" className="mb-3 text-sm text-ink-2">
            {copied === 'ok'
              ? 'Lien copié : il rouvre cette recherche et ces filtres.'
              : 'Copie impossible ici : copiez l’adresse dans la barre du navigateur, elle contient déjà vos filtres.'}
          </p>
        )}

        {failed && all === null && (
          <Callout tone="loss" title="La liste complète n’a pas pu être chargée.">
            <p>
              Vérifiez votre connexion et rechargez la page. Les premières lignes restent affichées
              ci-dessous.
            </p>
          </Callout>
        )}

        {loading && !failed ? (
          <p role="status" aria-busy="true" className="card text-center text-ink-2">
            Chargement des {formatInteger(initialSummary.count)} niches…
          </p>
        ) : count === 0 ? (
          <Callout title="Aucune niche ne correspond à ces critères.">
            <p>
              Essayez un mot plus court, retirez un filtre, ou{' '}
              <button type="button" className="font-semibold text-accent underline" onClick={reset}>
                réinitialisez tout
              </button>
              .
            </p>
          </Callout>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-surface">
            <table className="data-table w-full table-fixed" data-testid="niches-table">
              <caption className="sr-only">
                Niches fiscales : {formatInteger(count)} {plural(count, 'résultat', 'résultats')},
                triés par {sortLabel}. Page {page} sur {pages}.
              </caption>
              <colgroup>
                <col />
                <col className="w-[6.5rem] sm:w-[9.5rem]" />
                <col className="w-[34%] max-sm:hidden" />
              </colgroup>
              <thead>
                <tr>
                  <SortHeader label="Niche" sortKey="nom" state={ui} onSort={onSort} />
                  <SortHeader
                    label={`Coût ${ui.year}`}
                    sortKey="cout"
                    state={ui}
                    onSort={onSort}
                    align="end"
                  />
                  <th scope="col" className="max-sm:hidden">
                    Ce que prévoit le plan
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <NicheLine
                    key={row.id}
                    row={row}
                    year={ui.year}
                    maxCost={maxCost}
                    links={links}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pager
          page={page}
          pages={pages}
          onPage={goToPage}
          label="Niches fiscales"
          className="mt-4"
        />
      </div>
    </div>
  );
}
