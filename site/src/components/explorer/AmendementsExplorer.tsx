/**
 * Les 81 amendements : liste recherchable, regroupée par liasse ou par thème.
 *
 * Rappel qui compte : ce sont des TEXTES PROPOSÉS (projets d'amendements rédigés et publiés par
 * Résolution), aucun n'est adopté ni en vigueur. Le niveau « Proposé dans un amendement » veut dire
 * « texte précis rédigé et publié, pas en vigueur ». Chaque carte a une ancre (`#PLF-P1-28`) : la
 * frise, le tableau des niches et les autres pages y renvoient.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SegmentedControl, TierBadge } from '@/components/ui';
import { IconChevron, IconExternal } from '@/components/ui/icons';
import {
  DEFAULT_AM_STATE,
  LIASSE_IDS,
  LIASSE_SHORT,
  effectText,
  filterItems,
  groupItems,
  parseAmState,
  serializeAmState,
  type AmItem,
  type AmState,
  type GroupMode,
  type LiasseId,
  type LiasseInfo,
  type ThemeInfo,
} from '@/lib/amendements-model';
import { formatDateFr, precisionNote } from '@/lib/dates';
import { formatInteger } from '@/lib/format';
import { FilterChip, SearchBox } from './controls';

export interface AmendementsExplorerProps {
  items: AmItem[];
  liasses: LiasseInfo[];
  themes: ThemeInfo[];
  /** Dates (AAAA-MM-JJ) qui ont un groupe dans /comprendre/calendrier/ : on y renvoie. */
  calendarDates: string[];
  calendrierHref: string;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
const count = (n: number) => `${formatInteger(n)} ${plural(n, 'amendement', 'amendements')}`;

function AmCard({
  item,
  themeLabel,
  liasse,
  calendarDates,
  calendrierHref,
  showLiasse,
}: {
  item: AmItem;
  themeLabel: string;
  liasse: LiasseInfo | undefined;
  /** Rappelle la liasse sur la carte (utile quand la liste est regroupée par thème). */
  showLiasse: boolean;
  calendarDates: ReadonlySet<string>;
  calendrierHref: string;
}) {
  const multi = item.dates.length > 1;
  return (
    <article
      id={item.id}
      aria-labelledby={`${item.id}-t`}
      className="flex w-full scroll-mt-24 flex-col gap-3 rounded-lg border border-rule bg-surface p-4 target:border-accent target:shadow-[0_0_0_3px_var(--accent-soft)] sm:p-5"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="num inline-flex items-center rounded-sm bg-sunken px-2 py-1 text-sm font-bold text-ink">
          n° {item.number}
        </span>
        {showLiasse && <span className="text-sm text-ink-3">{liasse?.label ?? item.liasse}</span>}
      </header>
      <div className="space-y-1.5">
        <h4 id={`${item.id}-t`} className="text-[1.0625rem] font-semibold leading-snug text-ink">
          {item.title}
        </h4>
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">{item.summary}</p>
      </div>
      <p className="text-sm text-ink-2">
        <span className="font-semibold text-ink">Quand : </span>
        {effectText(item)}
      </p>
      {multi && (
        <details className="group/d -mt-1">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-accent marker:content-none [&::-webkit-details-marker]:hidden hover:underline">
            Les {item.dates.length} dates écrites dans le texte
            <IconChevron size={14} className="transition-transform group-open/d:rotate-180" />
          </summary>
          <ul className="mt-1 space-y-2 text-sm">
            {item.dates.map((d, i) => {
              const note = precisionNote(d.precision);
              return (
                <li key={i} className="border-s-2 border-rule-strong ps-3">
                  <span className="font-semibold text-ink">{formatDateFr(d.date)}</span>
                  <span className="text-ink-2"> — {d.label}</span>
                  {note && <span className="block text-ink-3">{note}</span>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-3 text-sm">
        <TierBadge tier="law" size="sm" />
        <a
          href={item.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1 font-medium"
        >
          Lire le texte (PDF, p. {item.pdfPage})
          <IconExternal size={12} />
          <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
        </a>
        {item.from && calendarDates.has(item.from) && (
          <a href={`${calendrierHref}#d-${item.from}`} className="inline-flex min-h-8 items-center">
            Voir au calendrier
          </a>
        )}
      </footer>
      {!showLiasse && <p className="-mt-1 text-xs text-ink-3">Thème : {themeLabel}</p>}
    </article>
  );
}

export default function AmendementsExplorer({
  items,
  liasses,
  themes,
  calendarDates,
  calendrierHref,
}: AmendementsExplorerProps) {
  const [ui, setUi] = useState<AmState>(DEFAULT_AM_STATE);
  const [announce, setAnnounce] = useState('');
  const written = useRef<string | null>(null);
  const themeIds = useMemo(() => themes.map((t) => t.id), [themes]);
  const themeLabel = useCallback(
    (id: string) => themes.find((t) => t.id === id)?.label ?? id,
    [themes],
  );
  const dates = useMemo(() => new Set(calendarDates), [calendarDates]);

  useEffect(() => {
    const initial = parseAmState(window.location.hash, themeIds);
    written.current = serializeAmState(initial);
    setUi(initial);
    const onHash = () => {
      const next = parseAmState(window.location.hash, themeIds);
      const s = serializeAmState(next);
      // Un lien d'ancre (#PLF-P1-28) ne change pas les filtres : on ne touche à rien.
      if (s !== written.current && s !== '') {
        written.current = s;
        setUi(next);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [themeIds]);

  useEffect(() => {
    if (written.current === null) return;
    const s = serializeAmState(ui);
    if (s === written.current) return;
    written.current = s;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${s ? `#${s}` : ''}`,
    );
  }, [ui]);

  const dq = useDeferredValue(ui.q);
  const filtered = useMemo(
    () => filterItems(items, { ...ui, q: dq }, themeLabel),
    [items, dq, ui, themeLabel],
  );
  const groups = useMemo(
    () => groupItems(filtered, ui.group, liasses, themes),
    [filtered, ui.group, liasses, themes],
  );
  const liasseOf = useMemo(() => new Map(liasses.map((l) => [l.id, l])), [liasses]);
  const nFilters = (ui.q.trim() ? 1 : 0) + ui.liasses.length + (ui.theme ? 1 : 0);

  useEffect(() => {
    const t = window.setTimeout(
      () =>
        setAnnounce(
          filtered.length === 0
            ? 'Aucun amendement ne correspond.'
            : `${count(filtered.length)} sur ${formatInteger(items.length)}.`,
        ),
      500,
    );
    return () => window.clearTimeout(t);
  }, [filtered.length, items.length]);

  const patch = (p: Partial<AmState>) => setUi((prev) => ({ ...prev, ...p }));
  const toggleLiasse = (id: LiasseId) =>
    setUi((prev) => ({
      ...prev,
      liasses: LIASSE_IDS.filter((l) =>
        l === id ? !prev.liasses.includes(l) : prev.liasses.includes(l),
      ),
    }));

  return (
    <div className="space-y-6">
      <div className="card space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <SearchBox
            label="Rechercher un amendement"
            value={ui.q}
            onChange={(q) => patch({ q })}
            placeholder="dons, TVA, titres-restaurant, n° 28…"
            hint="Cherche dans le titre, le résumé, le thème et le numéro — sans tenir compte des accents."
          />
          <div className="min-w-0">
            <label
              htmlFor="am-theme"
              className="mb-1.5 block text-[0.9375rem] font-semibold text-ink"
            >
              Thème
            </label>
            <select
              id="am-theme"
              value={ui.theme}
              onChange={(e) => patch({ theme: e.target.value })}
              className="min-h-11 w-full rounded-md border-[1.5px] border-rule-strong bg-field px-3 text-[1rem] text-ink hover:border-ink focus-visible:border-accent"
            >
              <option value="">Tous les thèmes ({themes.length})</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-[0.9375rem] font-semibold text-ink">
            Liasse <span className="font-normal text-ink-3">(plusieurs choix possibles)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {liasses.map((l) => (
              <FilterChip
                key={l.id}
                pressed={ui.liasses.includes(l.id)}
                onToggle={() => toggleLiasse(l.id)}
                count={l.count}
              >
                {l.label}
              </FilterChip>
            ))}
          </div>
        </fieldset>

        <SegmentedControl<GroupMode>
          legend="Regrouper par"
          size="sm"
          value={ui.group}
          onChange={(group) => patch({ group })}
          options={[
            { value: 'liasse', label: 'Liasse' },
            { value: 'theme', label: 'Thème' },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[0.9375rem] text-ink" data-testid="amendements-summary">
          <strong className="font-semibold">
            {count(filtered.length)}
            {filtered.length !== items.length && ` sur ${formatInteger(items.length)}`}
          </strong>
        </p>
        {nFilters > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setUi({ ...DEFAULT_AM_STATE, group: ui.group })}
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      {groups.length > 1 && (
        <nav aria-label="Aller à un groupe">
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm">
            {groups.map((g) => (
              <li key={g.key}>
                <a href={`#grp-${g.key}`} className="inline-flex min-h-8 items-center">
                  {ui.group === 'liasse' ? (LIASSE_SHORT[g.key as LiasseId] ?? g.label) : g.label}{' '}
                  <span className="num ms-1 text-ink-3">({g.items.length})</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {groups.length === 0 ? (
        <p className="card text-ink-2">
          Aucun amendement ne correspond. Essayez un mot plus court ou retirez un filtre.
        </p>
      ) : (
        groups.map((g) => {
          const liasse = ui.group === 'liasse' ? liasseOf.get(g.key as LiasseId) : undefined;
          return (
            <section
              key={g.key}
              id={`grp-${g.key}`}
              aria-labelledby={`grp-${g.key}-t`}
              className="scroll-mt-24 space-y-4"
            >
              <div className="border-b border-rule pb-3">
                <h3 id={`grp-${g.key}-t`} className="font-serif text-2xl font-medium text-ink">
                  {g.label}{' '}
                  <span className="num text-lg font-normal text-ink-3">
                    · {count(g.items.length)}
                  </span>
                </h3>
                {g.detail && <p className="mt-1 text-sm text-ink-2">{g.detail}</p>}
                {liasse && (
                  <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                    <a href={liasse.pdfUrl} target="_blank" rel="noopener noreferrer">
                      Liasse complète (PDF, {formatInteger(liasse.pages)} pages)
                      <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
                    </a>
                    <a href={liasse.docxUrl} target="_blank" rel="noopener noreferrer">
                      Format Word
                      <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
                    </a>
                  </p>
                )}
              </div>
              <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
                {g.items.map((a) => (
                  <li key={a.id} className="flex">
                    <AmCard
                      item={a}
                      themeLabel={themeLabel(a.theme)}
                      liasse={liasseOf.get(a.liasse)}
                      calendarDates={dates}
                      calendrierHref={calendrierHref}
                      showLiasse={ui.group === 'theme'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
