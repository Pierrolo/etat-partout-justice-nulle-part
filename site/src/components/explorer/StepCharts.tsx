/**
 * Petits multiples en escalier : une trajectoire datée par graphique (CSG/CRDS mois par mois,
 * aides au logement par tiers, TVA de l'alimentation, taxe sur les salaires…).
 *
 * Marques (skill dataviz) : ligne de 2 px à jonctions rondes, repères ≥ 8 px cerclés de la couleur
 * de la surface, grille en filets pleins. Un seul tracé par graphique, donc une seule couleur : celle
 * du plan (accent). Le palier de départ qui n'est écrit dans aucun amendement (D33) est en pointillé et
 * creux : jamais présenté comme un chiffre de la loi.
 *
 * Chaque valeur est écrite à côté de son repère ; la lecture détaillée (date, texte, source) suit
 * le repère choisi — souris, toucher ou flèches du clavier.
 */
import { scaleLinear, scaleUtc } from 'd3';
import { useId, useState, type KeyboardEvent } from 'react';
import { formatInteger, formatNumber, formatPercentPoints } from '@/lib/format';
import { formatDateFr, formatShortMonthFr } from '@/lib/dates';
import { stepPoints, type Panel } from '@/lib/calendrier-model';

const W = 360;
const H = 232;
const M = { l: 46, r: 16, t: 30, b: 32 };

function valueText(panel: Panel, v: number): string {
  switch (panel.kind) {
    case 'points':
      return `${formatNumber(v, { decimals: { min: 0, max: 1 } })} pt`;
    case 'taux':
    case 'part':
      return formatPercentPoints(v, { decimals: { min: 0, max: 1 } });
    case 'emplois':
      return formatInteger(v);
  }
}

function tickText(panel: Panel, v: number): string {
  switch (panel.kind) {
    case 'points':
      return formatNumber(v);
    case 'taux':
    case 'part':
      return formatPercentPoints(v);
    case 'emplois':
      return formatInteger(v);
  }
}

/** Repères de l'axe du temps : trimestres si la fenêtre tient en 13 mois, sinon années. */
function xTicks(panel: Panel): Array<{ date: string; label: string }> {
  const out: Array<{ date: string; label: string }> = [];
  const y0 = Number(panel.x0.slice(0, 4));
  const y1 = Number(panel.x1.slice(0, 4));
  const m0 = Number(panel.x0.slice(5, 7));
  const months = (y1 - y0) * 12 + (Number(panel.x1.slice(5, 7)) - m0);
  if (months <= 13) {
    for (let k = 0; k <= months; k += 3) {
      const m = m0 - 1 + k;
      const yy = y0 + Math.floor(m / 12);
      const mm = (m % 12) + 1;
      const date = `${yy}-${String(mm).padStart(2, '0')}-01`;
      out.push({
        date,
        label: mm === 1 ? `${formatShortMonthFr(date)} ${yy}` : formatShortMonthFr(date),
      });
    }
  } else {
    for (let yy = y0; yy <= y1; yy++) out.push({ date: `${yy}-01-01`, label: String(yy) });
  }
  return out;
}

/** Texte équivalent complet d'une trajectoire (lu par les lecteurs d'écran). */
export function describePanel(panel: Panel): string {
  const parts = stepPoints(panel)
    .filter((_, i, a) => i < a.length - 1)
    .map(
      (p) =>
        `${formatDateFr(p.date)} : ${valueText(panel, p.value)}${p.hypothesis ? ' (point de départ déduit, écrit dans aucun amendement)' : ''}`,
    );
  return `${panel.title}, ${panel.measure}. ${parts.join('\u202F; ')}.`;
}

export function StepPanel({ panel }: { panel: Panel }) {
  const uid = useId();
  const pts = stepPoints(panel);
  const real = pts.slice(0, -1); // le dernier point ne fait que prolonger la courbe
  const [active, setActive] = useState<number | null>(null);

  const x = scaleUtc()
    .domain([new Date(`${panel.x0}T00:00:00Z`), new Date(`${panel.x1}T00:00:00Z`)])
    .range([M.l, W - M.r]);
  const y = scaleLinear()
    .domain([0, panel.yMax])
    .range([H - M.b, M.t]);
  const px = (d: string) => x(new Date(`${d}T00:00:00Z`));

  const horizontals: Array<{ d: string; hyp: boolean }> = [];
  const verticals: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    horizontals.push({ d: `M${px(a.date)},${y(a.value)}H${px(b.date)}`, hyp: a.hypothesis });
    verticals.push(`M${px(b.date)},${y(a.value)}V${y(b.value)}`);
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = real.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a === null ? 0 : Math.min(n - 1, a + 1)));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a === null ? n - 1 : Math.max(0, a - 1)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  const shown = active ?? real.length - 1;
  const cur = real[shown] ?? null;
  const curStep = panel.steps.find(
    (s) => s.from === cur?.date || (s.from < panel.x0 && cur?.date === panel.x0),
  );
  const readoutId = `${uid}-readout`;

  return (
    <div className="min-w-0">
      <div className="lg:min-h-[4.6rem]">
        <h4 className="text-[0.9375rem] font-semibold leading-snug text-ink">{panel.title}</h4>
        <p className="text-sm text-ink-3">{panel.measure}</p>
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-label={`${panel.title} : ${real.length} paliers. Flèches gauche et droite pour les parcourir.`}
        aria-describedby={readoutId}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="mt-1 rounded-md"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={describePanel(panel)}
          className="block h-auto w-full"
          style={{ overflow: 'visible' }}
        >
          {/* grille et axes : filets pleins, discrets */}
          {panel.yTicks.map((t) => (
            <g key={t}>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}
                strokeWidth={1}
              />
              <text
                x={M.l - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11.5}
                fill="var(--ink-3)"
                className="num"
              >
                {tickText(panel, t)}
              </text>
            </g>
          ))}
          {xTicks(panel).map((t, i, a) => (
            <text
              key={t.date}
              x={px(t.date)}
              y={H - M.b + 18}
              textAnchor={i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}
              fontSize={11.5}
              fill="var(--ink-3)"
            >
              {t.label}
            </text>
          ))}

          {/* escalier */}
          {horizontals.map((h, i) => (
            <path
              key={`h${i}`}
              d={h.d}
              fill="none"
              stroke={h.hyp ? 'var(--ink-3)' : 'var(--accent)'}
              strokeWidth={h.hyp ? 1.75 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={h.hyp ? '1 5' : undefined}
            />
          ))}
          {verticals.map((d, i) => (
            <path
              key={`v${i}`}
              d={d}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}

          {/* repères et valeurs */}
          {real.map((p, i) => {
            const cx = px(p.date);
            const cy = y(p.value);
            const label = valueText(panel, p.value);
            const overflow = cx + 8 + label.length * 6.6 > W - M.r + 6;
            const on = active === i;
            return (
              <g
                key={p.date}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={cx} cy={cy} r={16} fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={on ? 6 : 4.5}
                  fill={p.hypothesis ? 'var(--surface)' : 'var(--accent)'}
                  stroke={p.hypothesis ? 'var(--ink-3)' : 'var(--surface)'}
                  strokeWidth={p.hypothesis ? 1.75 : 2}
                />
                {on && (
                  <circle cx={cx} cy={cy} r={9} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
                )}
                <text
                  x={cx + (overflow ? -8 : 8)}
                  y={cy - 8}
                  textAnchor={overflow ? 'end' : 'start'}
                  fontSize={12}
                  fontWeight={on ? 700 : 600}
                  fill="var(--ink)"
                  className="num"
                  paintOrder="stroke"
                  stroke="var(--surface)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p
        id={readoutId}
        aria-live="polite"
        className="mt-1 min-h-[3.25rem] text-sm leading-snug text-ink-2"
      >
        {cur && curStep ? (
          <>
            <strong className="font-semibold text-ink">
              {formatDateFr(cur.date < curStep.from ? curStep.from : cur.date)}&#8239;:{' '}
              {valueText(panel, cur.value)}.
            </strong>{' '}
            {curStep.label}
            {curStep.hypothesis && ' Point de départ déduit, non écrit dans l’amendement.'}
            {curStep.sources[0] && (
              <>
                {' '}
                <a href={curStep.sources[0].url} target="_blank" rel="noopener noreferrer">
                  {curStep.sources[0].liasse} n° {curStep.sources[0].number}, p.{' '}
                  {curStep.sources[0].page}
                </a>
              </>
            )}
          </>
        ) : null}
      </p>
    </div>
  );
}

export default function StepGrid({ panels, columns = 3 }: { panels: Panel[]; columns?: 2 | 3 }) {
  return (
    <div>
      <div
        className={`grid gap-x-6 gap-y-8 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}
      >
        {panels.map((p) => (
          <StepPanel key={p.id} panel={p} />
        ))}
      </div>
      {panels.some((p) => p.steps.some((s) => s.hypothesis)) && (
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
          <svg width="34" height="10" aria-hidden="true">
            <line
              x1="2"
              x2="32"
              y1="5"
              y2="5"
              stroke="var(--ink-3)"
              strokeWidth="1.75"
              strokeDasharray="1 5"
              strokeLinecap="round"
            />
          </svg>
          Pointillé, repère creux : situation actuelle rappelée pour la lecture, déduite et non
          écrite dans l’amendement.
        </p>
      )}
    </div>
  );
}
