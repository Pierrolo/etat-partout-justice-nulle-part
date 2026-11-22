import { TIER_META, TIERS, type Tier } from '@/lib/tiers';
import { cn } from '@/lib/cn';
import { IconAnnounced, IconHypothesis, IconLaw } from './icons';

const ICONS = { law: IconLaw, announced: IconAnnounced, hypothesis: IconHypothesis } as const;

/**
 * Visual grammar of the three tiers — never colour alone: shape of the border, fill and icon differ.
 *   law         « Proposé dans un amendement »  solid ink fill, solid border, page icon
 *   announced   « Annoncé »      hatched fill, dashed border, dashed-circle icon
 *   hypothesis  « Notre estimation »            sunken fill, dotted border, « ≈ » icon
 * Words come from `TIER_META` (lib/tiers.ts).
 */
export const tierBadgeClasses: Record<Tier, string> = {
  law: 'bg-[var(--tier-law-bg)] text-[var(--tier-law-fg)] border-[var(--tier-law-bg)] border-solid',
  announced: 'hatch-fine bg-surface text-ink-2 border-[var(--tier-announced-bd)] border-dashed',
  hypothesis: 'bg-sunken text-ink-2 border-[var(--tier-hypothesis-bd)] border-dotted',
};

export interface TierBadgeProps {
  tier: Tier;
  /** `short` uses the compact label (« Amendement proposé », « Annoncé », « Estimation »). */
  short?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function TierBadge({ tier, short = false, size = 'md', className }: TierBadgeProps) {
  const meta = TIER_META[tier];
  const Icon = ICONS[tier];
  return (
    <span
      data-tier={tier}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--r-tag)] border-[1.5px] font-semibold leading-none whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-1 text-[0.75rem]' : 'px-2 py-1.5 text-xs',
        tierBadgeClasses[tier],
        className,
      )}
    >
      <Icon size={size === 'sm' ? 13 : 14} />
      <span>{short ? meta.short : meta.label}</span>
    </span>
  );
}

/** The three badges with their one-sentence definition — for /methode, legends and the styleguide. */
export function TierLegend({
  className,
  columns = 3,
}: {
  className?: string;
  /** 3 side by side from `sm` (default) or a single column (narrow containers / prose). */
  columns?: 1 | 3;
}) {
  return (
    <dl className={cn('grid gap-3', columns === 3 && 'sm:grid-cols-3', className)}>
      {TIERS.map((tier) => (
        <div key={tier} className="card p-4 flex flex-col items-start gap-2">
          <dt>
            <TierBadge tier={tier} />
          </dt>
          <dd className="text-sm text-ink-2">{TIER_META[tier].description}</dd>
        </div>
      ))}
    </dl>
  );
}
