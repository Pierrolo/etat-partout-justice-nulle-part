/**
 * La transition 2027 → 2030 : frise à couloirs (écrans larges) et liste verticale (tous écrans).
 *
 * - Frise : un couloir par domaine, une pastille par date ; la taille de la pastille dit le nombre
 *   de mesures, le chiffre l'écrit. Les dates clés sont des drapeaux numérotés. Pas de marqueur
 *   « aujourd'hui » : le site est statique, ses dates sont celles du texte proposé.
 * - Liste : la même information, date par date, avec citation vérifiée et lien vers chaque amendement.
 *   C'est l'équivalent texte complet de la frise (et la seule vue sur téléphone).
 *
 * Clavier : pastilles et drapeaux sont des boutons (`aria-pressed`), la liste utilise des <details>.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevron, IconExternal } from '@/components/ui/icons';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/cn';
import { css } from '@/lib/chart-theme';
import {
  FRISE_END,
  FRISE_START,
  LANES,
  LANE_IDS,
  amendmentId,
  assignSubRows,
  frisePosition,
  groupByDate,
  jalonsInFrise,
  laneMarkers,
  markerDiameter,
  onSeries,
  type CalEvent,
  type DateGroup,
  type Jalon,
  type LaneId,
  type LaneMarker,
} from '@/lib/calendrier-model';
import { formatDateFr, formatDayMonthFr, precisionNote } from '@/lib/dates';
import { FilterChip } from './controls';
import '@/components/story/story.css';

export interface CalendrierExplorerProps {
  events: CalEvent[];
  jalons: Jalon[];
  /** Lien (avec base) vers /comprendre/amendements/. */
  amendementsHref: string;
}

const laneColor = (l: LaneId) => css.series[LANES[l].color] ?? css.other;
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
const mesures = (n: number) => `${formatInteger(n)} ${plural(n, 'mesure', 'mesures')}`;

/* ── Pièces communes ────────────────────────────────────────────────────── */

function LaneTag({ lane, className }: { lane: LaneId; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-ink-2', className)}>
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full forced-color-adjust-none"
        style={{ background: laneColor(lane) }}
      />
      {LANES[lane].short}
    </span>
  );
}

function AmendmentLinks({ event, href }: { event: CalEvent; href: string }) {
  const list = event.amendments;
  const links = (
    <>
      {list.map((a, i) => (
        <span key={amendmentId(a)}>
          {i > 0 && ', '}
          <a href={`${href}#${amendmentId(a)}`} className="whitespace-nowrap">
            {a.liasse} n° {a.number}
          </a>
        </span>
      ))}
    </>
  );
  if (list.length <= 3) {
    return (
      <span>
        {plural(list.length, 'Amendement', 'Amendements')}&#8239;: {links}
      </span>
    );
  }
  return (
    <details className="group/a inline-block align-top">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 font-semibold text-accent marker:content-none [&::-webkit-details-marker]:hidden hover:underline">
        {list.length} amendements
        <IconChevron size={14} className="transition-transform group-open/a:rotate-180" />
      </summary>
      <p className="mt-1 max-w-prose leading-relaxed">{links}</p>
    </details>
  );
}

function EventCard({
  event,
  href,
  showLane = true,
  compact = false,
}: {
  event: CalEvent;
  href: string;
  showLane?: boolean;
  /** Version courte (volet de détail sous la frise) : intitulé et liens, sans citation. */
  compact?: boolean;
}) {
  const note = precisionNote(event.precision);
  if (compact) {
    return (
      <li
        className="rounded-md border border-rule bg-surface px-3.5 py-2.5"
        style={{ borderInlineStartWidth: 4, borderInlineStartColor: laneColor(event.lane) }}
      >
        <p className="font-medium leading-snug text-ink">{event.label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-ink-2">
          {showLane && <LaneTag lane={event.lane} />}
          <AmendmentLinks event={event} href={href} />
          {note && <span className="text-ink-3">Année sans jour précis</span>}
        </div>
      </li>
    );
  }
  return (
    <li
      className="rounded-md border border-rule bg-surface p-3.5 sm:p-4"
      style={{ borderInlineStartWidth: 4, borderInlineStartColor: laneColor(event.lane) }}
    >
      {showLane && <LaneTag lane={event.lane} className="mb-1" />}
      <p className="font-medium leading-snug text-ink">{event.label}</p>
      <p className="mt-1 text-sm text-ink-2">
        <span className="font-semibold">Dans l’amendement : </span>
        {event.subject}
      </p>
      {note && <p className="mt-1 text-sm text-ink-3">{note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <AmendmentLinks event={event} href={href} />
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap"
        >
          Voir le texte (PDF)
          <IconExternal size={12} />
          <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
        </a>
      </div>
      <details className="group/q mt-1">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-ink-2 marker:content-none [&::-webkit-details-marker]:hidden hover:text-ink">
          Citation du texte
          <IconChevron size={14} className="transition-transform group-open/q:rotate-180" />
        </summary>
        <blockquote className="mt-1 border-s-2 border-rule-strong ps-3 text-sm text-ink-2">
          «&#8239;{event.quote}&#8239;»
          <footer className="mt-1 text-xs text-ink-3">{event.ref}</footer>
        </blockquote>
      </details>
    </li>
  );
}

/* ── Frise à couloirs ───────────────────────────────────────────────────── */

interface FriseProps {
  markers: LaneMarker[];
  jalons: Jalon[];
  /** Numéro de chaque date clé (1 → 10) dans la liste complète. */
  jalonNumber: Map<string, number>;
  lanes: LaneId[];
  selected: { date: string; lane: LaneId | null } | null;
  onSelect: (date: string, lane: LaneId | null) => void;
}

const LABEL_W = 168;
const PAD_R = 14;
const YEAR_ROW = 26;
const FLAG_D = 26;

function Frise({ markers, jalons, jalonNumber, lanes, selected, onSelect }: FriseProps) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(200, width - LABEL_W - PAD_R);
  const xOf = (date: string) => LABEL_W + frisePosition(date) * plotW;

  const years = [2027, 2028, 2029, 2030];

  // Drapeaux des dates clés : deux rangées au plus si elles se touchent.
  const flags = jalonsInFrise(jalons);
  const flagRows = assignSubRows(
    flags.map((j) => ({ x: xOf(j.date), d: FLAG_D })),
    2,
  );
  const nFlagRows = Math.max(1, ...flagRows.map((r) => r + 1));
  const axisH = YEAR_ROW + nFlagRows * (FLAG_D + 4) + 6;

  // Couloirs et leurs sous-lignes.
  const laneLayout = lanes.map((lane) => {
    const mine = markers.filter((m) => m.lane === lane);
    const items = mine.map((m) => ({ x: xOf(m.date), d: markerDiameter(m.events.length) + 4 }));
    const rows = assignSubRows(items, 4);
    const nRows = Math.max(1, ...rows.map((r) => r + 1));
    return { lane, mine, rows, height: Math.max(56, nRows * 38 + 16), nRows };
  });
  let y = axisH;
  const placed = laneLayout.map((l) => {
    const top = y;
    y += l.height;
    return { ...l, top };
  });
  const totalH = y + 4;
  const total = markers
    .filter((m) => lanes.includes(m.lane))
    .reduce((n, m) => n + m.events.length, 0);

  return (
    <div
      ref={host}
      role="group"
      aria-label={`Frise 2027 à 2030 : ${lanes.length} couloirs, ${formatInteger(total)} mesures. Chaque pastille est un bouton : elle ouvre le détail de la date.`}
      className="relative select-none"
      style={{ height: totalH }}
    >
      {/* Bandes d'années */}
      {years.map((yr, i) => {
        const a = xOf(`${yr}-01-01`);
        const b = xOf(`${yr + 1}-01-01`);
        return (
          <div
            key={yr}
            aria-hidden="true"
            className={cn('absolute inset-y-0', i % 2 === 0 ? 'bg-sunken/70' : 'bg-transparent')}
            style={{ left: a, width: b - a }}
          >
            <span className="num absolute left-2 top-1 text-sm font-semibold text-ink-3">{yr}</span>
          </div>
        );
      })}

      {/* Lignes de date clé */}
      {flags.map((j) => (
        <div
          key={`line-${j.date}`}
          aria-hidden="true"
          className="absolute w-px bg-accent/35"
          style={{ left: xOf(j.date), top: YEAR_ROW, bottom: 0 }}
        />
      ))}

      {/* Couloirs */}
      {placed.map(({ lane, mine, rows, top, height }) => (
        <div
          key={lane}
          role="group"
          aria-label={`${LANES[lane].label} : ${mesures(mine.reduce((n, m) => n + m.events.length, 0))} sur ${formatInteger(mine.length)} dates`}
          className="absolute inset-x-0 border-t border-rule"
          style={{ top, height }}
        >
          <div
            className="absolute left-0 top-0 flex h-full items-center gap-2 pe-3 text-sm font-semibold leading-tight text-ink"
            style={{ width: LABEL_W }}
          >
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full forced-color-adjust-none"
              style={{ background: laneColor(lane) }}
            />
            <span>{LANES[lane].label}</span>
          </div>
          {mine.map((m, i) => {
            const n = m.events.length;
            const d = markerDiameter(n);
            const hit = Math.max(d, 28);
            const sub = rows[i] ?? 0;
            const isSel =
              selected?.date === m.date && (selected.lane === null || selected.lane === m.lane);
            const onlyThis = selected?.date === m.date && selected.lane === m.lane;
            return (
              <button
                key={m.date}
                type="button"
                aria-pressed={onlyThis}
                aria-label={`${formatDateFr(m.date)} — ${LANES[lane].label} : ${mesures(n)}`}
                onClick={() => onSelect(m.date, lane)}
                className="absolute flex cursor-pointer items-center justify-center rounded-full"
                style={{
                  width: hit,
                  height: hit,
                  left: xOf(m.date) - hit / 2,
                  top: 10 + sub * 38 + 14 - hit / 2,
                }}
              >
                <span
                  aria-hidden="true"
                  className="num flex items-center justify-center rounded-full forced-color-adjust-none text-[0.75rem] font-bold leading-none"
                  style={{
                    width: d,
                    height: d,
                    background: laneColor(lane),
                    color: onSeries(LANES[lane].color),
                    boxShadow: isSel
                      ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)'
                      : '0 0 0 2px var(--surface)',
                  }}
                >
                  {n > 1 ? n : ''}
                </span>
              </button>
            );
          })}
        </div>
      ))}

      {/* Drapeaux des dates clés (au-dessus des couloirs) */}
      {flags.map((j, i) => {
        const num = jalonNumber.get(j.date) ?? 0;
        const isSel = selected?.date === j.date && selected.lane === null;
        return (
          <button
            key={`flag-${j.date}`}
            type="button"
            aria-pressed={isSel}
            aria-label={`Date clé ${num} : ${formatDateFr(j.date)}, ${j.title}`}
            onClick={() => onSelect(j.date, null)}
            className="num absolute flex cursor-pointer items-center justify-center rounded-full forced-color-adjust-none bg-accent text-[0.8125rem] font-bold text-on-accent"
            style={{
              width: FLAG_D,
              height: FLAG_D,
              left: xOf(j.date) - FLAG_D / 2,
              top: YEAR_ROW + (flagRows[i] ?? 0) * (FLAG_D + 4),
              boxShadow: isSel
                ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)'
                : '0 0 0 2px var(--surface)',
            }}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
}

/* ── Détail d'une date (sous la frise) ──────────────────────────────────── */

function DetailPanel({
  selected,
  groups,
  lanes,
  jalonNumber,
  href,
  onOpenList,
}: {
  selected: { date: string; lane: LaneId | null };
  groups: DateGroup[];
  lanes: LaneId[];
  jalonNumber: Map<string, number>;
  href: string;
  onOpenList: (date: string) => void;
}) {
  const group = groups.find((g) => g.date === selected.date);
  const events = (group?.events ?? []).filter(
    (e) => lanes.includes(e.lane) && (selected.lane === null || e.lane === selected.lane),
  );
  const num = jalonNumber.get(selected.date);
  const LIMIT = 8;
  const shown = events.slice(0, LIMIT);
  return (
    <section
      aria-labelledby="cal-detail-t"
      className="rounded-lg border border-rule bg-surface p-4 sm:p-5"
    >
      <p role="status" className="sr-only">
        {formatDateFr(selected.date)}&#8239;: {mesures(events.length)}, détail affiché sous la
        frise.
      </p>
      <h3 id="cal-detail-t" className="font-serif text-xl font-medium text-ink">
        {formatDateFr(selected.date)}
        {selected.lane && <span className="text-ink-2"> · {LANES[selected.lane].label}</span>}
      </h3>
      <p className="mt-1 text-[0.9375rem] text-ink-2">
        {group?.jalon ? (
          <>
            <strong className="font-semibold text-ink">
              Date clé{num ? ` n° ${num}` : ''}&#8239;: {group.jalon.title}.
            </strong>{' '}
            {group.jalon.summary}
          </>
        ) : (
          'Jour du calendrier, en dehors des dates clés.'
        )}
      </p>
      <p className="mt-2 text-sm font-semibold text-ink">
        {events.length === 0 ? 'Aucune mesure dans les domaines affichés.' : mesures(events.length)}
      </p>
      <ul className="mt-2 space-y-2">
        {shown.map((e) => (
          <EventCard key={e.id} event={e} href={href} compact showLane={selected.lane === null} />
        ))}
      </ul>
      {events.length > LIMIT && (
        <p className="mt-3 text-sm">
          <a
            href={`#d-${selected.date}`}
            onClick={() => onOpenList(selected.date)}
            className="font-semibold"
          >
            Voir les {events.length - LIMIT} autres mesures de cette date dans la liste ↓
          </a>
        </p>
      )}
    </section>
  );
}

/* ── Composant principal ────────────────────────────────────────────────── */

export default function CalendrierExplorer({
  events,
  jalons,
  amendementsHref,
}: CalendrierExplorerProps) {
  const [on, setOn] = useState<LaneId[]>([]);
  const [selected, setSelected] = useState<{ date: string; lane: LaneId | null } | null>(() => {
    const first = jalonsInFrise(jalons)[0];
    return first ? { date: first.date, lane: null } : null;
  });
  const lanes = useMemo(
    () => (on.length ? LANE_IDS.filter((l) => on.includes(l)) : [...LANE_IDS]),
    [on],
  );

  const visible = useMemo(() => events.filter((e) => lanes.includes(e.lane)), [events, lanes]);
  const allGroups = useMemo(() => groupByDate(events, jalons), [events, jalons]);
  const groups = useMemo(() => groupByDate(visible, jalons), [visible, jalons]);
  const markers = useMemo(() => laneMarkers(visible), [visible]);
  const jalonNumber = useMemo(() => new Map(jalons.map((j, i) => [j.date, i + 1])), [jalons]);

  // Groupes ouverts : les petits par défaut ; un lien `#d-AAAA-MM-JJ` ouvre le sien.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(allGroups.filter((g) => g.events.length <= 6).map((g) => g.date)),
  );
  const openGroup = useCallback((date: string) => {
    setOpen((prev) => (prev.has(date) ? prev : new Set(prev).add(date)));
  }, []);

  useEffect(() => {
    const fromHash = () => {
      const m = /^#d-(\d{4}-\d{2}-\d{2})$/.exec(window.location.hash);
      if (!m?.[1]) return;
      openGroup(m[1]);
      window.setTimeout(
        () => document.getElementById(`d-${m[1]}`)?.scrollIntoView({ block: 'start' }),
        60,
      );
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [openGroup]);

  const toggleLane = (l: LaneId) =>
    setOn((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  const outside = events.filter((e) => !e.inFrise);
  const outsideBefore = outside.filter((e) => e.date < FRISE_START);
  const outsideAfter = outside.filter((e) => e.date >= FRISE_END);

  return (
    <div className="space-y-8">
      {/* Filtre : une rangée au-dessus de ce qu'il règle (frise, détail et liste) */}
      <fieldset className="min-w-0">
        <legend className="mb-2 text-[0.9375rem] font-semibold text-ink">
          Domaine <span className="font-normal text-ink-3">(plusieurs choix possibles)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {LANE_IDS.map((l) => (
            <FilterChip
              key={l}
              pressed={on.includes(l)}
              onToggle={() => toggleLane(l)}
              swatch={laneColor(l)}
              count={events.filter((e) => e.lane === l).length}
            >
              {LANES[l].short}
            </FilterChip>
          ))}
          {on.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOn([])}>
              Tous les domaines
            </button>
          )}
        </div>
        <p role="status" className="mt-2 text-sm text-ink-2">
          {mesures(visible.length)} affichées sur {formatInteger(events.length)}.
        </p>
      </fieldset>

      {/* Frise : écrans larges seulement ; la liste ci-dessous est l'équivalent texte */}
      <section aria-labelledby="cal-frise-t" className="hidden md:block">
        <h3 id="cal-frise-t" className="mb-1 font-serif text-xl font-medium text-ink">
          La frise, domaine par domaine
        </h3>
        <p className="mb-3 text-[0.9375rem] text-ink-2">
          Une pastille par date et par domaine ; son chiffre est le nombre de mesures. Les drapeaux
          violets sont les dates clés. Sélectionnez une pastille pour lire les mesures.{' '}
          <a href="#cal-liste-t">Passer la frise et aller à la liste ↓</a>
        </p>
        <div className="overflow-hidden rounded-lg border border-rule bg-surface">
          <Frise
            markers={markers}
            jalons={jalons}
            jalonNumber={jalonNumber}
            lanes={lanes}
            selected={selected}
            onSelect={(date, lane) => setSelected({ date, lane })}
          />
        </div>
        <p className="mt-2 text-sm text-ink-3">
          Fenêtre : 2027 à 2030.
          {outsideBefore.length > 0 &&
            ` Avant : ${mesures(outsideBefore.length)} au ${formatDayMonthFr(outsideBefore[0]!.date)} ${outsideBefore[0]!.date.slice(0, 4)}.`}
          {outsideAfter.length > 0 &&
            ` Après : ${mesures(outsideAfter.length)} (${outsideAfter.map((e) => e.date.slice(0, 4)).join(', ')}), dans la liste.`}
        </p>
        {selected && (
          <div className="mt-4">
            <DetailPanel
              selected={selected}
              groups={allGroups}
              lanes={lanes}
              jalonNumber={jalonNumber}
              href={amendementsHref}
              onOpenList={openGroup}
            />
          </div>
        )}
      </section>

      {/* Dates clés */}
      <section aria-labelledby="cal-cles-t">
        <h3 id="cal-cles-t" className="mb-3 font-serif text-xl font-medium text-ink">
          Les dates clés
        </h3>
        <ol className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {jalons.map((j, i) => {
            const n = allGroups.find((g) => g.date === j.date)?.events.length ?? j.count;
            return (
              <li key={j.date}>
                <a
                  href={`#d-${j.date}`}
                  onClick={() => {
                    openGroup(j.date);
                    setSelected({ date: j.date, lane: null });
                  }}
                  className="flex h-full min-h-14 items-start gap-3 rounded-md border border-rule bg-surface p-3 no-underline hover:border-ink hover:no-underline"
                >
                  <span
                    aria-hidden="true"
                    className="num mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold text-ink">
                      <span className="sr-only">Date clé {i + 1}&#8239;: </span>
                      {formatDateFr(j.date)}
                    </span>
                    <span className="block text-ink-2">{j.title}</span>
                    <span className="block text-ink-3">{mesures(n)}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Liste verticale : toutes les mesures, date par date */}
      <section aria-labelledby="cal-liste-t">
        <h3 id="cal-liste-t" className="mb-1 font-serif text-xl font-medium text-ink">
          Toutes les mesures, date par date
        </h3>
        <p className="mb-4 text-[0.9375rem] text-ink-2">
          Chaque mesure renvoie à son amendement et cite le texte. Les dates viennent exclusivement
          du texte proposé ; une date « 1er janvier » sans jour écrit est signalée.
        </p>
        {groups.length === 0 ? (
          <p className="card text-ink-2">Aucune mesure dans les domaines choisis.</p>
        ) : (
          <ol className="m-0 ms-2 list-none space-y-3 border-s-2 border-rule-strong p-0 ps-4 sm:ms-3 sm:ps-6">
            {groups.map((g) => (
              <li key={g.date} className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-[1.15rem] rounded-full bg-accent ring-4 ring-[var(--paper)]',
                    g.jalon
                      ? '-start-[1.5625rem] size-4 sm:-start-[2.0625rem]'
                      : '-start-[1.375rem] size-2.5 sm:-start-[1.875rem]',
                  )}
                />
                <details
                  id={`d-${g.date}`}
                  open={open.has(g.date)}
                  onToggle={(e) => {
                    const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                    setOpen((prev) => {
                      if (prev.has(g.date) === isOpen) return prev;
                      const next = new Set(prev);
                      if (isOpen) next.add(g.date);
                      else next.delete(g.date);
                      return next;
                    });
                  }}
                  className="group/g scroll-mt-20 rounded-lg border border-rule bg-sunken/50"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden hover:bg-sunken">
                    <span className="min-w-0">
                      <span className="block text-[1.0625rem] font-semibold text-ink">
                        {formatDateFr(g.date)}
                        {g.jalon && (
                          <span className="ms-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-on-accent">
                            Date clé {jalonNumber.get(g.date)}
                          </span>
                        )}
                      </span>
                      {g.jalon && <span className="block text-sm text-ink-2">{g.jalon.title}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-sm text-ink-3">
                      {mesures(g.events.length)}
                      <IconChevron
                        size={18}
                        className="transition-transform group-open/g:rotate-180"
                      />
                    </span>
                  </summary>
                  <ul className="m-0 list-none space-y-2 p-3 pt-1 sm:p-4 sm:pt-1">
                    {g.events.map((e) => (
                      <EventCard key={e.id} event={e} href={amendementsHref} />
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
