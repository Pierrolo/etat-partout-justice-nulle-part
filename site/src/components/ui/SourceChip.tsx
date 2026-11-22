import type { ReactNode } from 'react';
import { TIER_META, type Tier } from '@/lib/tiers';
import { cn } from '@/lib/cn';
import { IconAnnounced, IconExternal, IconHypothesis, IconLaw } from './icons';
import { tierBadgeClasses } from './TierBadge';

const ICONS = { law: IconLaw, announced: IconAnnounced, hypothesis: IconHypothesis } as const;

export interface SourceChipProps {
  /** What the reader will find: « Amendement PLF-P1 n° 28 », « Insee, Budget de famille 2017 ». */
  label: ReactNode;
  /** Link to the source (Légifrance, CAF, Insee, workbook cell…). Omit when the source is internal. */
  href?: string;
  /** Epistemic tier of the figure this source backs. Shows the compact tier mark when provided. */
  tier?: Tier;
  /** Year or date of the data, shown after the label. */
  year?: string | number;
  className?: string;
}

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/**
 * « Source » pill: [tier mark | label ↗]. Meets the 24 px minimum target size (WCAG 2.5.8)
 * and is a real link when `href` is given. Tier is conveyed by icon + text + border style.
 */
export function SourceChip({ label, href, tier, year, className }: SourceChipProps) {
  const Icon = tier ? ICONS[tier] : null;
  const external = href ? isExternal(href) : false;
  const body = (
    <>
      {tier && Icon && (
        <span
          data-tier={tier}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 self-stretch border-e-[1.5px] px-2 text-[0.75rem] font-semibold',
            tierBadgeClasses[tier],
            // the left segment only keeps its own fill; the outer pill draws the border
            tier === 'law' ? 'border-e-[var(--tier-law-fg)]/30' : 'border-e-rule-strong',
          )}
        >
          <Icon size={12} className="shrink-0" />
          <span>{TIER_META[tier].short}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1">
        <span>
          {label}
          {year !== undefined && <span className="text-ink-3"> · {year}</span>}
        </span>
        {external && <IconExternal size={12} className="shrink-0 text-ink-3" />}
        {external && <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>}
      </span>
    </>
  );

  const shared = cn(
    'inline-flex min-h-7 items-stretch overflow-hidden rounded-full border border-rule-strong bg-surface text-[0.8125rem] leading-snug text-ink-2 align-middle',
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(shared, 'no-underline hover:border-ink hover:text-ink hover:no-underline')}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {body}
      </a>
    );
  }
  return <span className={shared}>{body}</span>;
}
