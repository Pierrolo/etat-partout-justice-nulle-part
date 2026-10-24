import { area, curveStepAfter, scaleLinear } from 'd3';
import { useId, useMemo, useState } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ChipProps } from '@/lib/facts';
import { formatEuro, formatInteger } from '@/lib/format';
import type { LifeRow, LifeSeries, LifeSeriesId } from '@/lib/plan-data';
import { useWidth } from './useWidth';

/** Fixed slot per series (colour follows the entity). */
const COLOR: Record<LifeSeriesId, string> = {
  aide_fondamentale: 'var(--series-1)',
  aide_handicap: 'var(--series-3)',
  compte_education: 'var(--series-4)',
  part_contributive_retraite: 'var(--series-2)',
  rendement_patrimoine: 'var(--series-5)',
};
const SHORT: Record<LifeSeriesId, string> = {
  aide_fondamentale: 'Aide fondamentale',
  aide_handicap: 'Majoration handicap',
  compte_education: 'Compte éducation',
  part_contributive_retraite: 'Part contributive de retraite',
  rendement_patrimoine: 'Rendement du patrimoine',
};
const ORDER: LifeSeriesId[] = [
  'aide_fondamentale',
  'aide_handicap',
  'compte_education',
  'part_contributive_retraite',
  'rendement_patrimoine',
];

type Mode = 'valide' | 'handicap';

/**
 * What the plan would pay one person, year by year of life (age 0 → 85), € per year, stacked.
 * Solid fill = written in the law (aide fondamentale, majoration handicap); hatched fill = announced
 * by the authors, no legal text (compte éducation, retraite, patrimoine). The disability supplement
 * applies only to a person with a disability, so it is off by default. The two « épargne retraite »
 * series of the workbook are left out of the chart (their meaning is not documented) but kept in the table.
 */
export function Lifecycle({
  series,
  rows,
  sources,
}: {
  series: LifeSeries[];
  rows: LifeRow[];
  sources: ChipProps[];
}) {
  const uid = useId().replace(/:/g, '');
  const [ref, width] = useWidth<HTMLDivElement>(760);
  const [mode, setMode] = useState<Mode>('valide');
  const [age, setAge] = useState(20);

  const narrow = width < 520;
  const margin = { t: 16, r: narrow ? 10 : 16, b: 30, l: narrow ? 46 : 54 };
  const height = narrow ? 300 : 360;
  const ids = ORDER.filter((id) => mode === 'handicap' || id !== 'aide_handicap');
  const tierOf = (id: LifeSeriesId) => series.find((s) => s.id === id)!.tier;

  const maxAge = rows[rows.length - 1]!.age;
  const adultAge = rows.find(
    (r) => r.aide_fondamentale === Math.max(...rows.map((q) => q.aide_fondamentale)),
  )!.age;
  const retireAge = rows.find((r) => r.part_contributive_retraite > 0)!.age;
  const sum = (r: LifeRow) =>
    r.aide_fondamentale +
    r.compte_education +
    r.part_contributive_retraite +
    r.rendement_patrimoine;
  const birth = rows[0]!;
  const adult = rows.find((r) => r.age === adultAge)!;
  const retired = rows.find((r) => r.age === retireAge)!;
  const x = scaleLinear()
    .domain([0, maxAge + 1])
    .range([margin.l, width - margin.r]);
  const totals = rows.map((r) => ids.reduce((a, id) => a + r[id], 0));
  const top = Math.max(...totals);
  const yMax = Math.ceil(top / 5000) * 5000;
  const y = scaleLinear()
    .domain([0, yMax])
    .range([height - margin.b, margin.t]);

  const stacks = useMemo(() => {
    const out = new Map<LifeSeriesId, Array<{ age: number; y0: number; y1: number }>>();
    const base = rows.map(() => 0);
    for (const id of ids) {
      out.set(
        id,
        rows.map((r, i) => {
          const y0 = base[i]!;
          base[i] = y0 + r[id];
          return { age: r.age, y0, y1: base[i]! };
        }),
      );
    }
    return out;
  }, [rows, ids.join()]);

  const areaGen = area<{ age: number; y0: number; y1: number }>()
    .curve(curveStepAfter)
    .x((d) => x(d.age))
    .y0((d) => y(d.y0))
    .y1((d) => y(d.y1));

  const cur = rows.find((r) => r.age === age) ?? rows[0]!;
  const curTotal = ids.reduce((a, id) => a + cur[id], 0);
  const parts = ids.filter((id) => cur[id] > 0);
  const announcedOnly = parts
    .filter((id) => tierOf(id) === 'announced')
    .reduce((a, id) => a + cur[id], 0);

  const tableRows = rows.map((r) => ({
    age: r.age,
    ...Object.fromEntries(ORDER.map((id) => [id, r[id]])),
    ep1: r.epargne_retraite_serie_1,
    ep2: r.epargne_retraite_serie_2,
  }));
  const fmtE = (v: unknown) => (v === null || v === undefined ? '—' : formatEuro(Number(v)));

  return (
    <div className="space-y-4">
      <div className="card bg-sunken">
        <SegmentedControl<Mode>
          legend="Pour quelle personne ?"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'valide', label: 'Sans handicap' },
            { value: 'handicap', label: 'Avec la majoration handicap' },
          ]}
        />
      </div>

      <ChartFrame
        headingLevel={2}
        title="Ce que le plan verserait à une personne, de 0 à 85 ans"
        subtitle="Euros par an et par personne, empilés par dispositif. Plein = écrit dans la loi ; hachuré = annoncé par les auteurs, sans texte de loi."
        summary={`Une personne sans handicap recevrait ${formatEuro(sum(birth))} par an à la naissance, dont ${formatEuro(birth.aide_fondamentale)} écrits dans la loi (l’aide fondamentale de l’enfant) ; dès ${adultAge} ans, ${formatEuro(sum(adult))} par an, dont ${formatEuro(adult.aide_fondamentale)} dans la loi ; dès ${retireAge} ans, ${formatEuro(sum(retired))} par an, avec une part contributive de retraite annoncée. Tout ce qui est hachuré repose sur des promesses non chiffrées dans les textes.`}
        sources={sources.map((s) => ({ ...s }))}
        table={{
          columns: [
            { key: 'age', label: 'Âge' },
            ...ORDER.map((id) => ({
              key: id,
              label: `${SHORT[id]} (€/an)`,
              numeric: true,
              format: fmtE,
            })),
            {
              key: 'ep1',
              label: 'Épargne retraite, série 1 (sens non documenté)',
              numeric: true,
              format: fmtE,
            },
            {
              key: 'ep2',
              label: 'Épargne retraite, série 2 (sens non documenté)',
              numeric: true,
              format: fmtE,
            },
          ] as never,
          rows: tableRows as never,
          caption: 'Montants annuels par âge et par dispositif',
        }}
        csvFileName="plan-cycle-de-vie.csv"
        note={`Les deux séries « épargne retraite personnelle » du classeur (${formatEuro(retired.epargne_retraite_serie_1 ?? 0)} et ${formatEuro(retired.epargne_retraite_serie_2 ?? 0)} par an dès ${retireAge} ans) ne sont pas tracées : leur sens, stock ou flux, n’est pas documenté. Elles figurent dans le tableau. L’aide fondamentale de l’enfant cesse l’année de ses ${adultAge} ans ; le compte éducation court un an de plus.`}
      >
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-2" aria-label="Légende">
          {ids.map((id) => {
            const t = tierOf(id);
            return (
              <li key={id} className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
                <svg width="22" height="14" aria-hidden="true" className="shrink-0">
                  <rect
                    width="22"
                    height="14"
                    rx="2"
                    fill={t === 'law' ? COLOR[id] : `url(#${uid}-h-${id})`}
                    stroke={COLOR[id]}
                    strokeWidth={t === 'law' ? 0 : 1.2}
                  />
                </svg>
                <span>
                  <span className="font-semibold text-ink">{SHORT[id]}</span>{' '}
                  <span className="text-ink-3">· {t === 'law' ? 'loi' : 'annoncé'}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div ref={ref}>
          <svg
            role="img"
            aria-label="Aires empilées : montants annuels versés selon l’âge, de 0 à 85 ans"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto max-w-full touch-pan-y overflow-visible"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setAge(Math.min(maxAge, Math.max(0, Math.floor(x.invert(e.clientX - r.left)))));
            }}
            onPointerDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setAge(Math.min(maxAge, Math.max(0, Math.floor(x.invert(e.clientX - r.left)))));
            }}
          >
            <defs>
              {ORDER.map((id) => (
                <pattern
                  key={id}
                  id={`${uid}-h-${id}`}
                  width="7"
                  height="7"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="7" height="7" fill={COLOR[id]} fillOpacity="0.16" />
                  <rect width="2" height="7" fill={COLOR[id]} fillOpacity="0.9" />
                </pattern>
              ))}
            </defs>
            {/* grid */}
            {Array.from({ length: yMax / 5000 + 1 }, (_, i) => i * 5000).map((t) => (
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
                  {formatInteger(t)}
                </text>
              </g>
            ))}
            {[0, adultAge, 40, retireAge, maxAge].map((t) => (
              <text
                key={t}
                x={x(t)}
                y={height - 8}
                textAnchor="middle"
                fontSize="12"
                fill="var(--ink-3)"
              >
                {t}
                {t === maxAge ? ' ans' : ''}
              </text>
            ))}
            {/* areas */}
            {ids.map((id) => {
              const t = tierOf(id);
              return (
                <path
                  key={id}
                  d={areaGen(stacks.get(id)!) ?? ''}
                  fill={t === 'law' ? COLOR[id] : `url(#${uid}-h-${id})`}
                  fillOpacity={t === 'law' ? 0.92 : 1}
                  stroke={COLOR[id]}
                  strokeWidth={t === 'law' ? 0 : 1.25}
                  strokeLinejoin="round"
                />
              );
            })}
            {/* cursor */}
            <line
              x1={x(cur.age + 0.5)}
              x2={x(cur.age + 0.5)}
              y1={margin.t}
              y2={height - margin.b}
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
            <circle
              cx={x(cur.age + 0.5)}
              cy={y(curTotal)}
              r={4.5}
              fill="var(--ink)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </svg>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_minmax(12rem,16rem)] sm:items-start">
          <div
            aria-live="polite"
            className="rounded-md bg-sunken p-3 text-[0.9375rem] text-ink-2 sm:p-4"
          >
            <p className="font-semibold text-ink">
              À {age} {age > 1 ? 'ans' : 'an'} : {formatEuro(curTotal)} par an
            </p>
            <p className="mt-0.5">
              {parts.map((id, i) => (
                <span key={id}>
                  {SHORT[id]} {formatEuro(cur[id])}{' '}
                  <span className="text-ink-3">({tierOf(id) === 'law' ? 'loi' : 'annoncé'})</span>
                  {i < parts.length - 1 ? ' + ' : '.'}
                </span>
              ))}
            </p>
            {announcedOnly > 0 && (
              <p className="mt-1 text-sm text-ink-3">
                Dont {formatEuro(announcedOnly)} annoncés, sans texte de loi.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-age`} className="text-sm font-semibold text-ink">
              Âge affiché : {age} ans
            </label>
            <input
              id={`${uid}-age`}
              type="range"
              min={0}
              max={maxAge}
              step={1}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              aria-valuetext={`${age} ans : ${formatEuro(curTotal)} par an`}
              className="h-11 w-full accent-[var(--accent)]"
            />
          </div>
        </div>
      </ChartFrame>
    </div>
  );
}
