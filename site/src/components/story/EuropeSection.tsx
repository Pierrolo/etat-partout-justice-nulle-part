import { useMemo, useState, type CSSProperties } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { Column } from '@/lib/csv';
import type { ChipProps } from '@/lib/facts';
import { formatEuro, formatNumber, MINUS, NBSP } from '@/lib/format';
import type { EuroAgg, EuroRow } from '@/lib/story-shared';
import './story.css';

type Metric = 'dep' | 'solde' | 'rev';
type IncomeUnit = 'eur' | 'spa';

interface Cfg {
  title: string;
  subtitle: string;
  domain: [number, number];
  ticks: number[];
  /** Value → label, exact (readout, highlighted dots). */
  fmt: (v: number) => string;
  /** Value → axis tick label. */
  tick: (v: number) => string;
}

const pctPts = (v: number, d = 1) => `${formatNumber(v, { decimals: d })}${NBSP}%`;
const signedPct = (v: number) => `${formatNumber(v, { decimals: 1, signed: true })}${NBSP}%`;

function config(metric: Metric, unit: IncomeUnit): Cfg {
  if (metric === 'dep')
    return {
      title: 'Dépenses publiques, en points de PIB (2024)',
      subtitle:
        'Toutes les administrations publiques, % du PIB, 30 pays classés du plus haut au plus bas.',
      domain: [20, 60],
      ticks: [20, 30, 40, 50, 60],
      fmt: (v) => pctPts(v),
      tick: (v) => `${v}${NBSP}%`,
    };
  if (metric === 'solde')
    return {
      title: 'Solde public, en points de PIB (2024)',
      subtitle: 'Excédent (positif) ou déficit (négatif) des administrations publiques, % du PIB.',
      domain: [-10, 14],
      ticks: [-10, -5, 0, 5, 10],
      fmt: (v) => signedPct(v),
      tick: (v) => (v === 0 ? '0' : `${v > 0 ? '+' : MINUS}${Math.abs(v)}`),
    };
  return unit === 'eur'
    ? {
        title: 'Revenu médian, en euros par an (2024)',
        subtitle:
          'Revenu disponible médian par équivalent adulte, euros courants : il ne tient pas compte des écarts de prix entre pays.',
        domain: [0, 55000],
        ticks: [0, 20000, 40000],
        fmt: (v) => formatEuro(v),
        tick: (v) => formatEuro(v),
      }
    : {
        title: 'Revenu médian, en pouvoir d’achat (SPA, 2024)',
        subtitle:
          'Même revenu en « standards de pouvoir d’achat » (SPA) : un euro fictif qui achète la même chose dans tous les pays.',
        domain: [0, 40000],
        ticks: [0, 10000, 20000, 30000, 40000],
        fmt: (v) => `${formatNumber(v)}${NBSP}SPA`,
        tick: (v) => formatNumber(v),
      };
}

const value = (r: EuroRow, metric: Metric, unit: IncomeUnit) =>
  metric === 'dep' ? r.dep24 : metric === 'solde' ? r.solde24 : unit === 'eur' ? r.med : r.spa;

const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

/** Left offset on the track: leaves 14 px at both ends so edge ticks and dots never clip. */
const pos = (t: number) => `calc(${(t * 100).toFixed(3)}% + ${(14 - 28 * t).toFixed(2)}px)`;

export interface EuropeSectionProps {
  rows: EuroRow[];
  ea20: EuroAgg;
  eu27: EuroAgg;
  sources: ChipProps[];
}

/**
 * « Et ailleurs en Europe ? » — one ranked dot plot at a time (dépenses · solde · revenu médian).
 * Emphasis form: France in the first categorical hue, the highlighted comparison (Finlande, Suisse)
 * ringed, every other country in the neutral grey; the euro-area average (EA20) is a hairline.
 * Rows are buttons: tap one to read its value and gap to France below the chart.
 */
export function EuropeSection({ rows, ea20, eu27, sources }: EuropeSectionProps) {
  const [metric, setMetric] = useState<Metric>('dep');
  const [unit, setUnit] = useState<IncomeUnit>('eur');
  const [sel, setSel] = useState<string>('FR');

  const cfg = config(metric, unit);
  const ranked = useMemo(
    () =>
      rows
        .map((r) => ({ r, v: value(r, metric, unit) }))
        .filter((x): x is { r: EuroRow; v: number } => x.v !== null)
        .sort((a, b) => b.v - a.v)
        .map((x, i) => ({ ...x, rank: i + 1 })),
    [rows, metric, unit],
  );
  const missing = rows.filter((r) => value(r, metric, unit) === null).map((r) => r.name);
  const ref =
    metric === 'dep'
      ? ea20.dep24
      : metric === 'solde'
        ? ea20.solde24
        : unit === 'eur'
          ? ea20.med
          : ea20.spa;
  const eu =
    metric === 'dep'
      ? eu27.dep24
      : metric === 'solde'
        ? eu27.solde24
        : unit === 'eur'
          ? eu27.med
          : eu27.spa;
  const france = ranked.find((x) => x.r.isFrance)!;
  const compareGeo = metric === 'rev' ? 'CH' : metric === 'dep' ? 'FI' : null;
  const [lo, hi] = cfg.domain;
  const t = (v: number) => (v - lo) / (hi - lo);

  const selected = ranked.find((x) => x.r.geo === sel) ?? france;
  const diffFr = selected.v - france.v;
  const unitWord = metric === 'rev' ? (unit === 'eur' ? '€' : 'SPA') : 'points de PIB';

  const leader = ranked[0]!;
  const ch = ranked.find((x) => x.r.geo === 'CH');
  const summary =
    metric === 'dep'
      ? `La France dépense ${cfg.fmt(france.v)} du PIB : ${ordinal(france.rank)} sur ${ranked.length}, derrière ${leader.r.name} (${cfg.fmt(leader.v)}) et ${formatNumber(france.v - ref, { decimals: 1 })} points au-dessus de la zone euro (${cfg.fmt(ref)}).`
      : metric === 'solde'
        ? `La France affiche un solde de ${cfg.fmt(france.v)} du PIB : ${ordinal(ranked.length - france.rank + 1)} plus mauvais solde sur ${ranked.length} pays, contre ${cfg.fmt(ref)} pour la zone euro.`
        : `Le revenu médian français est de ${cfg.fmt(france.v)} par an (${ordinal(france.rank)} sur ${ranked.length}), contre ${cfg.fmt(ref)} pour la zone euro.${
            ch
              ? ` La Suisse atteint ${cfg.fmt(ch.v)}, soit ${formatNumber(ch.v / france.v, { decimals: 1 })} fois la France ${unit === 'eur' ? 'en euros courants : basculez sur « SPA » pour voir l’écart une fois les prix pris en compte' : 'en pouvoir d’achat'}.`
              : ''
          }`;

  const cols: Column<EuroRow>[] = [
    { key: 'name', label: 'Pays' },
    {
      key: 'dep24',
      label: 'Dépenses 2024, % PIB',
      numeric: true,
      format: (v) => (v === null ? '—' : pctPts(Number(v))),
    },
    {
      key: 'dep25',
      label: 'Dépenses 2025, % PIB',
      numeric: true,
      format: (v) => (v === null ? '—' : pctPts(Number(v))),
    },
    {
      key: 'solde24',
      label: 'Solde 2024, % PIB',
      numeric: true,
      format: (v) => (v === null ? '—' : signedPct(Number(v))),
    },
    {
      key: 'solde25',
      label: 'Solde 2025, % PIB',
      numeric: true,
      format: (v) => (v === null ? '—' : signedPct(Number(v))),
    },
    {
      key: 'med',
      label: 'Revenu médian 2024, €',
      numeric: true,
      format: (v) => (v === null ? '—' : formatEuro(Number(v))),
    },
    {
      key: 'spa',
      label: 'Revenu médian 2024, SPA',
      numeric: true,
      format: (v) => (v === null ? '—' : formatNumber(Number(v))),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filter row: one above the chart it scopes. */}
      <div className="card flex flex-wrap items-end gap-x-6 gap-y-3 bg-sunken">
        <SegmentedControl<Metric>
          legend="Comparer…"
          size="sm"
          value={metric}
          onChange={(m) => {
            setMetric(m);
            setSel('FR');
          }}
          options={[
            { value: 'dep', label: 'Dépenses publiques' },
            { value: 'solde', label: 'Déficit' },
            { value: 'rev', label: 'Revenu médian' },
          ]}
        />
        {metric === 'rev' && (
          <SegmentedControl<IncomeUnit>
            legend="Unité du revenu"
            size="sm"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'eur', label: 'En euros' },
              { value: 'spa', label: 'En pouvoir d’achat (SPA)' },
            ]}
          />
        )}
      </div>

      <ChartFrame
        title={cfg.title}
        subtitle={cfg.subtitle}
        headingLevel={3}
        summary={summary}
        sources={sources.map((s) => ({ ...s }))}
        table={{
          columns: cols,
          rows: [...rows].sort((a, b) => (b.dep24 ?? -1) - (a.dep24 ?? -1)),
          caption: 'Comparaison européenne : dépenses, solde, revenu médian',
        }}
        csvFileName="comparaison-europeenne.csv"
        note={
          <>
            Zone euro = 20 pays (EA20). Union européenne (27) : {cfg.fmt(eu)}.
            {missing.length > 0 && <> Données non disponibles pour : {missing.join(', ')}.</>}
          </>
        }
      >
        <div
          className="select-none [--namew:6.25rem] sm:[--namew:9rem]"
          role="group"
          aria-label={cfg.title}
        >
          {/* top axis */}
          <div
            className="grid items-end gap-x-0"
            style={{ gridTemplateColumns: 'var(--namew) 1fr' }}
          >
            <span />
            <div className="relative h-6" aria-hidden="true">
              {cfg.ticks.map((tk) => (
                <span
                  key={tk}
                  className="num absolute bottom-0 -translate-x-1/2 text-xs text-ink-3"
                  style={{ left: pos(t(tk)) }}
                >
                  {cfg.tick(tk)}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* gridlines + reference, behind the rows */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{ left: 'var(--namew)' }}
            >
              {cfg.ticks.map((tk) => (
                <span
                  key={tk}
                  className="absolute inset-y-0 w-px"
                  style={{
                    left: pos(t(tk)),
                    background:
                      metric === 'solde' && tk === 0 ? 'var(--ink-3)' : 'var(--chart-grid)',
                  }}
                />
              ))}
              <span
                className="absolute inset-y-0 w-0.5 rounded-full"
                style={{ left: pos(t(ref)), background: 'var(--ink)', opacity: 0.8 }}
              />
            </div>

            <ul>
              {ranked.map(({ r, v, rank }) => {
                const isFr = r.isFrance;
                const isCmp = r.geo === compareGeo;
                const hl = isFr || isCmp;
                const x = t(v);
                const labelLeft = x > 0.62;
                const s = sel === r.geo;
                return (
                  <li key={r.geo}>
                    <button
                      type="button"
                      aria-pressed={s}
                      aria-label={`${r.name} ${cfg.fmt(v)}, ${ordinal(rank)} sur ${ranked.length}`}
                      onClick={() => setSel(r.geo)}
                      className="grid h-[1.625rem] w-full cursor-pointer items-center rounded-sm text-start hover:bg-sunken aria-pressed:bg-sunken sm:h-7"
                      style={{ gridTemplateColumns: 'var(--namew) 1fr' }}
                    >
                      <span
                        className={`truncate pe-2 text-[0.8125rem] sm:text-sm ${hl ? 'font-bold text-ink' : 'text-ink-2'}`}
                      >
                        {r.name}
                      </span>{' '}
                      <span className="relative block h-full">
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                          style={
                            {
                              left: pos(x),
                              width: hl ? 14 : 10,
                              height: hl ? 14 : 10,
                              background: isFr
                                ? 'var(--series-1)'
                                : isCmp
                                  ? 'var(--surface)'
                                  : 'var(--series-other)',
                              boxShadow: isCmp
                                ? 'inset 0 0 0 3px var(--ink), 0 0 0 2px var(--surface)'
                                : '0 0 0 2px var(--surface)',
                            } as CSSProperties
                          }
                        />
                        {hl && (
                          <span
                            aria-hidden="true"
                            className="num absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-surface px-1 text-[0.8125rem] font-bold text-ink"
                            style={
                              labelLeft
                                ? { right: `calc(100% - ${pos(x)} + 12px)`, textAlign: 'right' }
                                : { left: `calc(${pos(x)} + 12px)` }
                            }
                          >
                            {cfg.fmt(v)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* direct label of the reference + polarity legend for the balance */}
          <div
            className="mt-2 grid items-start"
            style={{ gridTemplateColumns: 'var(--namew) 1fr' }}
          >
            <span />
            <div className="relative h-9 text-xs text-ink-2" aria-hidden="true">
              <span
                className="absolute top-0 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap font-semibold text-ink"
                style={{ left: pos(Math.min(0.88, Math.max(0.12, t(ref)))) }}
              >
                <span className="inline-block h-3 w-0.5 rounded-full bg-ink" /> Zone euro :{' '}
                {cfg.fmt(ref)}
              </span>
              {metric === 'solde' && (
                <>
                  <span
                    className="absolute bottom-0 text-ink-3"
                    style={{ left: pos(t(0)), transform: 'translateX(calc(-100% - 6px))' }}
                  >
                    ← déficit
                  </span>
                  <span
                    className="absolute bottom-0 text-ink-3"
                    style={{ left: `calc(${pos(t(0))} + 6px)` }}
                  >
                    excédent →
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* readout: the selected country, in words */}
        <p
          aria-live="polite"
          className="mt-3 rounded-md bg-sunken p-3 text-[0.9375rem] text-ink-2 sm:p-4"
        >
          <span className="font-semibold text-ink">{selected.r.name}</span>&#8239;:{' '}
          {cfg.fmt(selected.v)}, {ordinal(selected.rank)} sur {ranked.length}.{' '}
          {selected.r.isFrance ? (
            <>Zone euro : {cfg.fmt(ref)}.</>
          ) : (
            <>
              {diffFr === 0
                ? 'Même valeur que la France.'
                : `${formatNumber(Math.abs(diffFr), { decimals: metric === 'rev' ? 0 : 1 })} ${unitWord} ${diffFr > 0 ? 'au-dessus' : 'en dessous'} de la France (${cfg.fmt(france.v)}).`}
            </>
          )}
        </p>
      </ChartFrame>
    </div>
  );
}
