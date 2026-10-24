import { line, scaleLinear } from 'd3';
import { useId, useState } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import type { ChipProps } from '@/lib/facts';
import { formatInteger, formatNumber, formatPercentPoints } from '@/lib/format';
import type { LawYear } from '@/lib/etat-shared';
import { useWidth } from './useWidth';

const M = (v: number) => `${formatNumber(v / 1e6, { decimals: 1 })} M`;

interface Break {
  year: number;
  changePct: number;
  series: string;
}

/**
 * Words of French law 2005 → 2026: total, regulatory and legislative texts. The two series breaks
 * (2010, 2012) are drawn as a shaded band and named — never smoothed. Pointer or the year slider
 * moves the readout; end-of-line labels carry the identity (direct labels).
 */
export function WordsOfLaw({
  years,
  breaks,
  breakNote,
  growthPct,
  sources,
}: {
  years: LawYear[];
  breaks: Break[];
  breakNote: string;
  growthPct: number;
  sources: ChipProps[];
}) {
  const uid = useId();
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const first = years[0]!;
  const last = years[years.length - 1]!;
  const [yr, setYr] = useState(last.year);
  const cur = years.find((y) => y.year === yr) ?? last;

  const narrow = width < 520;
  const margin = { t: 28, r: narrow ? 86 : 120, b: 28, l: 38 };
  const height = narrow ? 300 : 360;
  const x = scaleLinear()
    .domain([first.year, last.year])
    .range([margin.l, width - margin.r]);
  const y = scaleLinear()
    .domain([0, 50e6])
    .range([height - margin.b, margin.t]);
  const mk = (k: 'total' | 'reglementaire' | 'legislatif') =>
    line<LawYear>()
      .x((d) => x(d.year))
      .y((d) => y(d[k]))(years) ?? '';

  const bandFrom = Math.min(...breaks.map((b) => b.year));
  const bandTo = Math.max(...breaks.map((b) => b.year));
  const series = [
    { key: 'total' as const, label: 'Total', color: 'var(--ink)', w: 2.5 },
    { key: 'reglementaire' as const, label: 'Règlements', color: 'var(--series-2)', w: 2 },
    { key: 'legislatif' as const, label: 'Lois', color: 'var(--series-1)', w: 2 },
  ];
  const yearTicks = years
    .filter((d) => d.year % 5 === 0 || d.year === last.year)
    .map((d) => d.year)
    .filter((t) => t === last.year || last.year - t >= 3);
  const atBreak = breaks.filter((b) => b.year === cur.year);

  const onMove = (clientX: number, rect: DOMRect) => {
    const v = x.invert(clientX - rect.left);
    const nearest = years.reduce((a, b) => (Math.abs(b.year - v) < Math.abs(a.year - v) ? b : a));
    setYr(nearest.year);
  };

  return (
    <ChartFrame
      title={`${M(last.total)} de mots de droit en ${last.year}, contre ${M(first.total)} en ${first.year}`}
      subtitle="Millions de mots du droit applicable (textes législatifs et réglementaires de Légifrance), 2005–2026."
      summary={`Le volume de droit applicable a augmenté de ${formatPercentPoints(growthPct, { decimals: 0 })} en vingt et un ans, de ${M(first.total)} à ${M(last.total)} de mots. Les lois seules sont passées de ${M(first.legislatif)} à ${M(last.legislatif)}. La série des règlements présente deux ruptures (2010 et 2012) dont la cause n’est pas documentée : lisez la tendance, pas ces deux années.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'year', label: 'Année' },
          {
            key: 'legislatif',
            label: 'Lois (mots)',
            numeric: true,
            format: (v) => formatInteger(Number(v)),
          },
          {
            key: 'reglementaire',
            label: 'Règlements (mots)',
            numeric: true,
            format: (v) => formatInteger(Number(v)),
          },
          {
            key: 'total',
            label: 'Total (mots)',
            numeric: true,
            format: (v) => formatInteger(Number(v)),
          },
        ],
        rows: years.map((y) => ({ ...y })),
        caption: 'Mots du droit applicable par année',
      }}
      csvFileName="mots-de-loi-2005-2026.csv"
      note={`Ruptures de série : ${breakNote.replace(/ ; à signaler.*$/, '.')}`}
    >
      <div ref={ref} className="select-none">
        <svg
          role="img"
          aria-label={`Courbes du nombre de mots de droit de ${first.year} à ${last.year}`}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full touch-pan-y overflow-visible"
          onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        >
          {/* grid + y axis */}
          {[0, 10e6, 20e6, 30e6, 40e6, 50e6].map((t) => (
            <g key={t}>
              <line
                x1={margin.l}
                x2={width - margin.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--chart-grid)"
              />
              <text
                x={margin.l - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize="12"
                fill="var(--ink-3)"
              >
                {formatNumber(t / 1e6)}
                {t === 50e6 ? ' M' : ''}
              </text>
            </g>
          ))}
          {/* series-break band */}
          <rect
            x={x(bandFrom)}
            y={margin.t}
            width={x(bandTo) - x(bandFrom)}
            height={height - margin.b - margin.t}
            fill="var(--ink)"
            opacity={0.07}
          />
          <text
            x={x((bandFrom + bandTo) / 2)}
            y={margin.t - 10}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--ink-2)"
          >
            ruptures de série
          </text>
          {/* x axis */}
          {yearTicks.map((t) => (
            <text
              key={t}
              x={x(t)}
              y={height - 8}
              textAnchor="middle"
              fontSize="12"
              fill="var(--ink-3)"
            >
              {t}
            </text>
          ))}
          {/* lines */}
          {series.map((s) => (
            <path
              key={s.key}
              d={mk(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.w}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* crosshair */}
          <line
            x1={x(cur.year)}
            x2={x(cur.year)}
            y1={margin.t}
            y2={height - margin.b}
            stroke="var(--ink-3)"
          />
          {series.map((s) => (
            <circle
              key={s.key}
              cx={x(cur.year)}
              cy={y(cur[s.key])}
              r={4.5}
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
          {/* direct labels at the end of each line */}
          {series.map((s) => (
            <g key={s.key}>
              <text
                x={x(last.year) + 8}
                y={y(last[s.key])}
                dy="-0.1em"
                fontSize="13"
                fontWeight="700"
                fill="var(--ink)"
              >
                {s.label}
              </text>
              <text
                x={x(last.year) + 8}
                y={y(last[s.key])}
                dy="1.2em"
                fontSize="12"
                fill="var(--ink-2)"
              >
                {M(last[s.key])}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <p aria-live="polite" className="rounded-md bg-sunken p-3 text-[0.9375rem] text-ink-2">
          <span className="font-semibold text-ink">{cur.year}</span> : {M(cur.total)} au total —
          règlements {M(cur.reglementaire)}, lois {M(cur.legislatif)}.
          {atBreak.length > 0 && (
            <span className="font-medium text-ink">
              {' '}
              Rupture de série (
              {formatNumber(atBreak[0]!.changePct, {
                decimals: 1,
                signed: true,
              })}{' '}
              % sur les règlements non codifiés).
            </span>
          )}
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-yr`} className="text-sm font-semibold text-ink">
            Année affichée : {cur.year}
          </label>
          <input
            id={`${uid}-yr`}
            type="range"
            min={first.year}
            max={last.year}
            step={1}
            value={cur.year}
            onChange={(e) => setYr(Number(e.target.value))}
            aria-valuetext={`${cur.year} : ${M(cur.total)} de mots`}
            className="h-11 w-full min-w-48 accent-[var(--accent)]"
          />
        </div>
      </div>
    </ChartFrame>
  );
}
