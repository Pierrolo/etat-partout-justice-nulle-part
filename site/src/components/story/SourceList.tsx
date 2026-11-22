import type { ReactNode } from 'react';
import { SourceChip } from '@/components/ui/SourceChip';
import type { ChipProps } from '@/lib/facts';

export interface SourceItem {
  chip: ChipProps;
  /** What this source backs, and anything the reader should know (definition, denominator, caveat). */
  text: ReactNode;
}

/** « Sources » tab: each source with its chip (tier + link) and what it backs; then known gaps. */
export function SourceList({
  items,
  gapsTitle = 'Écarts et limites connus',
  gaps,
}: {
  items: SourceItem[];
  gapsTitle?: string;
  gaps?: ReactNode[];
}) {
  return (
    <div className="space-y-5 text-[0.9375rem] text-ink-2">
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
            <span className="shrink-0 sm:w-64">
              <SourceChip {...it.chip} />
            </span>
            <span className="min-w-0">{it.text}</span>
          </li>
        ))}
      </ul>
      {gaps && gaps.length > 0 && (
        <div>
          <p className="font-semibold text-ink">{gapsTitle}</p>
          <ul className="mt-1.5 list-disc space-y-1.5 ps-5 marker:text-ink-3">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
