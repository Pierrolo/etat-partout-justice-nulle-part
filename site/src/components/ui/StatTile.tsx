import type { ReactNode } from 'react';
import type { Tier } from '@/lib/tiers';
import { cn } from '@/lib/cn';
import { SourceChip, type SourceChipProps } from './SourceChip';

export interface StatTileProps {
  /** What the number measures — sentence case, no trailing colon. */
  label: string;
  /** Preformatted number from `lib/format.ts` (« 1 672 », « +212 »). Never format inside the tile. */
  value: string;
  /** Unit shown next to the number (« Md€ », « €/mois », « % »). */
  unit?: string;
  /** Spoken form of the unit for screen readers (« milliards d’euros »). */
  unitLabel?: string;
  /** Human-scale reframing, ALWAYS paired with a big number: « = 148 € par foyer et par jour ». */
  reframe?: ReactNode;
  /** Where the figure comes from (every public number has a source). */
  source?: SourceChipProps;
  /** Colour of the number: neutral ink, the plan accent, or the gain / loss pole. */
  tone?: 'neutral' | 'accent' | 'gain' | 'loss';
  /** `announced` renders the tile hatched with a dashed border (« annoncé, sans texte de loi »). */
  tier?: Tier;
  size?: 'md' | 'lg';
  /** The ONE figure of the view that deserves the accent (painted in signal). */
  keyFigure?: boolean;
  /** Element used for the tile (use `li` inside a list). */
  as?: 'article' | 'div' | 'li';
  className?: string;
}

const TONE: Record<NonNullable<StatTileProps['tone']>, string> = {
  neutral: 'text-ink',
  accent: 'text-accent',
  gain: 'text-gain',
  loss: 'text-loss',
};

/** Number-first figure: label · big serif value + unit · reframing · source. */
export function StatTile({
  label,
  value,
  unit,
  unitLabel,
  reframe,
  source,
  tone = 'neutral',
  tier,
  size = 'md',
  keyFigure,
  as: Tag = 'article',
  className,
}: StatTileProps) {
  return (
    <Tag
      data-tier={tier}
      className={cn(
        'card flex h-full flex-col gap-3',
        tier === 'announced' &&
          'hatch border-dashed border-[1.5px] border-[var(--tier-announced-bd)]',
        className,
      )}
    >
      <p className="text-sm font-medium text-ink-2">{label}</p>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          data-key-figure={keyFigure || undefined}
          className={cn(
            'stat-number',
            TONE[tone],
            size === 'lg' ? 'text-[length:var(--text-display)]' : '',
          )}
        >
          {value}
        </span>
        {unit && (
          <>
            <span
              aria-hidden={unitLabel ? 'true' : undefined}
              className="font-serif text-xl font-medium text-ink-2 sm:text-2xl"
            >
              {unit}
            </span>
            {unitLabel && <span className="sr-only"> {unitLabel}</span>}
          </>
        )}
      </p>
      {reframe && <p className="text-base text-ink-2">{reframe}</p>}
      {source && (
        <div className="mt-auto pt-1">
          <SourceChip {...source} />
        </div>
      )}
    </Tag>
  );
}
