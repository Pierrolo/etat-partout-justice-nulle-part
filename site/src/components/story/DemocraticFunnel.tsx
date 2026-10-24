import { useId } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import type { ChipProps } from '@/lib/facts';
import { formatNumber } from '@/lib/format';

interface Step {
  label: string;
  value: number;
  pctOfPrevious: number | null;
}

const CELL_W = 13;
const CELL_H = 17;

/** One 10 × 10 block of citizens: the first `value` in colour (the last one clipped if partial), the rest in grey. */
function Citizens({
  value,
  symbolId,
  clipId,
  label,
}: {
  value: number;
  symbolId: string;
  clipId: string;
  label: string;
}) {
  const full = Math.floor(value);
  const part = value - full;
  const cells = Array.from({ length: 100 }, (_, k) => ({
    x: (k % 10) * CELL_W,
    y: Math.floor(k / 10) * CELL_H,
    on: k < full,
    partial: k === full && part > 0.04,
  }));
  const p = cells.find((c) => c.partial);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${10 * CELL_W - 1} ${10 * CELL_H - 1}`}
      className="block w-full"
    >
      {p && (
        <clipPath id={clipId}>
          <rect x={p.x} y={p.y + CELL_H * (1 - part)} width={CELL_W} height={CELL_H * part} />
        </clipPath>
      )}
      {cells.map((c, k) => (
        <use
          key={k}
          href={`#${symbolId}`}
          x={c.x}
          y={c.y}
          fill={c.on ? 'var(--accent)' : 'var(--chart-axis)'}
          opacity={c.on ? 1 : 0.45}
        />
      ))}
      {p && (
        <use
          href={`#${symbolId}`}
          x={p.x}
          y={p.y}
          fill="var(--accent)"
          clipPath={`url(#${clipId})`}
        />
      )}
    </svg>
  );
}

/**
 * « 100 citoyens, 3,45 qui comptent » — an icon funnel: the same 100 citizens at every stage, the
 * ones still represented in colour. Each stage keeps 51 % of the previous one (a construction of
 * the book, not an observed statistic: said in the note).
 */
export function DemocraticFunnel({
  steps,
  rule,
  sources,
}: {
  steps: Step[];
  rule: string;
  sources: ChipProps[];
}) {
  const uid = useId().replace(/:/g, '');
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return (
    <ChartFrame
      tier="announced"
      title={`Sur ${formatNumber(first.value)} citoyens, ${formatNumber(last.value, { decimals: 2 })} pèsent sur la décision finale`}
      subtitle="Chaque étape de la chaîne démocratique garde 51 % de la précédente. Chaque silhouette = 1 citoyen sur 100 ; en couleur, ceux qui sont encore représentés."
      summary={`À chaque étape (${steps.map((s) => s.label.toLowerCase()).join(', ')}), seuls 51 % de l’étape précédente restent représentés : de ${formatNumber(first.value)} citoyens on passe à ${formatNumber(last.value, { decimals: 2 })} au dernier échelon.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'label', label: 'Étape' },
          {
            key: 'value',
            label: 'Pour 100 citoyens',
            numeric: true,
            format: (v) => formatNumber(Number(v), { decimals: 2 }),
          },
        ],
        rows: steps.map((s) => ({ label: s.label, value: s.value })),
        caption: 'Chaîne de représentation démocratique',
      }}
      csvFileName="chaine-democratique.csv"
      note={rule}
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <symbol
          id={`${uid}-person`}
          viewBox={`0 0 ${CELL_W} ${CELL_H}`}
          width={CELL_W - 1}
          height={CELL_H - 1}
        >
          <circle cx="5.5" cy="3.6" r="3.1" />
          <path d="M0.8 15c0-4.2 2-6.1 4.7-6.1s4.7 1.9 4.7 6.1z" />
        </symbol>
      </svg>
      <ol className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((s, i) => (
          <li key={s.label} className="min-w-0">
            <Citizens
              symbolId={`${uid}-person`}
              clipId={`${uid}-clip-${i}`}
              value={s.value}
              label={`${s.label} : ${formatNumber(s.value, { decimals: 2 })} citoyens représentés sur 100`}
            />
            <p className="mt-2 font-serif text-2xl font-medium leading-none text-ink">
              {formatNumber(s.value, { decimals: s.value < 10 ? 2 : s.value % 1 ? 1 : 0 })}
            </p>
            <p className="mt-1 text-[0.8125rem] font-semibold text-ink">{s.label}</p>
            {i > 0 && s.pctOfPrevious !== null && (
              <p className="text-xs text-ink-3">
                × {formatNumber(s.pctOfPrevious / 100, { decimals: 2 })}
              </p>
            )}
          </li>
        ))}
      </ol>
    </ChartFrame>
  );
}
