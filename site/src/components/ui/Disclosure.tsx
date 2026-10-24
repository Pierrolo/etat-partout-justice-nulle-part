import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconChevron } from './icons';

export interface DisclosureProps {
  /** Always-visible label of the toggle. */
  summary: ReactNode;
  /** Small right-aligned hint (« formule », « 3 lignes »). */
  meta?: ReactNode;
  defaultOpen?: boolean;
  /** `card` = boxed, `plain` = hairline rows (stack several for a FAQ / « voir le calcul »). */
  variant?: 'card' | 'plain';
  children: ReactNode;
  className?: string;
}

/** Styled native <details>: keyboard + screen-reader support for free, works without JavaScript. */
export function Disclosure({
  summary,
  meta,
  defaultOpen,
  variant = 'plain',
  children,
  className,
}: DisclosureProps) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group',
        variant === 'card'
          ? 'rounded-lg border border-rule bg-surface'
          : 'border-b border-rule first:border-t',
        className,
      )}
    >
      <summary
        className={cn(
          'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[0.9375rem] font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden hover:text-accent',
          variant === 'card' ? 'px-4 py-3 sm:px-5' : 'py-3',
        )}
      >
        <span className="min-w-0">{summary}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-ink-3">
          {meta}
          <IconChevron
            size={18}
            className="transition-transform duration-150 group-open:rotate-180"
          />
        </span>
      </summary>
      <div
        className={cn(
          'text-[0.9375rem] text-ink-2',
          variant === 'card' ? 'px-4 pb-4 sm:px-5 sm:pb-5' : 'pb-4',
        )}
      >
        {children}
      </div>
    </details>
  );
}
