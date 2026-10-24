import { useState, type CSSProperties, type ReactNode } from 'react';
import { formatInteger, formatPercentPoints } from '@/lib/format';
import './story.css';

export interface UnitSegment {
  id: string;
  label: string;
  count: number;
  /** CSS colour of the squares (a `var(--series-n)` token). */
  color: string;
  /** Secondary line under the label (definition, composition). */
  detail?: ReactNode;
  /** Texture for « annoncé » segments: squares are drawn hatched. */
  hatched?: boolean;
}

/**
 * Unit chart: one square = one real unit (an agency, a tax, a niche…). Squares fill row by row,
 * segment after segment, so each segment is a contiguous block. The legend lines (buttons) carry
 * the count and the name — direct labelling — and isolate their block on hover, focus or tap.
 */
export function UnitGrid({
  segments,
  colsWide,
  colsNarrow,
  ariaLabel,
  className,
  legendColumns = 1,
}: {
  segments: UnitSegment[];
  colsWide: number;
  colsNarrow: number;
  ariaLabel: string;
  className?: string;
  legendColumns?: 1 | 2;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.count, 0);
  const activeIndex = active ? segments.findIndex((s) => s.id === active) : -1;
  const colors = Object.fromEntries(segments.map((s, i) => [`--c${i}`, s.color]));

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="unit-grid"
        data-active={activeIndex >= 0 ? activeIndex : undefined}
        style={{ '--cols-n': colsNarrow, '--cols-w': colsWide, ...colors } as CSSProperties}
        onMouseLeave={() => setActive(null)}
      >
        {segments.flatMap((s, si) =>
          Array.from({ length: s.count }, (_, k) => <i key={`${si}-${k}`} data-c={si} />),
        )}
      </div>
      <ul className={`mt-4 grid gap-x-6 gap-y-1 ${legendColumns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {segments.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={active === s.id}
              onClick={() => setActive(active === s.id ? null : s.id)}
              onMouseEnter={() => setActive(s.id)}
              onFocus={() => setActive(s.id)}
              onBlur={() => setActive(null)}
              className="flex w-full cursor-pointer items-start gap-3 rounded-md p-2 text-start hover:bg-sunken aria-pressed:bg-sunken"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 size-3.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: s.color }}
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="num font-serif text-xl font-medium text-ink">
                    {formatInteger(s.count)}
                  </span>
                  <span className="text-[0.9375rem] font-semibold text-ink">{s.label}</span>
                  <span className="text-xs text-ink-3">
                    {s.count / total < 0.01
                      ? '< 1 %'
                      : formatPercentPoints((s.count / total) * 100, { decimals: 0 })}
                  </span>
                </span>
                {s.detail && (
                  <span className="block text-[0.8125rem] leading-snug text-ink-3">{s.detail}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
