import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconAnnounced, IconDown, IconInfo, IconPlan, IconUp } from './icons';

export type CalloutTone = 'note' | 'plan' | 'gain' | 'loss' | 'announced';

const TONES: Record<CalloutTone, { box: string; icon: string; Icon: typeof IconInfo }> = {
  note: { box: 'border-s-4 bg-sunken border-ink-3', icon: 'text-ink-2', Icon: IconInfo },
  plan: { box: 'border-s-4 bg-accent-soft border-accent', icon: 'text-accent', Icon: IconPlan },
  gain: { box: 'border-s-4 bg-gain-soft border-gain', icon: 'text-gain', Icon: IconUp },
  loss: { box: 'border-s-4 bg-loss-soft border-loss', icon: 'text-loss', Icon: IconDown },
  /** « Hors revenu disponible »: promises without legal amounts. Hatched + dashed. */
  announced: {
    box: 'hatch bg-surface border-[1.5px] border-dashed border-[var(--tier-announced-bd)]',
    icon: 'text-ink-2',
    Icon: IconAnnounced,
  },
};

export interface CalloutProps {
  tone?: CalloutTone;
  /** Short bold lead-in. */
  title?: ReactNode;
  children: ReactNode;
  /** Override the default icon, or pass `null` to hide it. */
  icon?: ReactNode | null;
  className?: string;
}

/**
 * Boxed aside. Tone is carried by icon + border + wash, never by colour alone.
 * Use `loss` for honest « qui perd ? » statements — they deserve the same prominence as gains.
 */
export function Callout({ tone = 'note', title, children, icon, className }: CalloutProps) {
  const t = TONES[tone];
  const Icon = t.Icon;
  return (
    <div
      role="note"
      data-tone={tone}
      className={cn('flex gap-3 rounded-md p-4 text-ink sm:p-5', t.box, className)}
    >
      {icon !== null && (
        <span className={cn('mt-0.5 shrink-0', t.icon)}>{icon ?? <Icon size={20} />}</span>
      )}
      <div className="min-w-0 space-y-1.5 text-[0.9375rem] leading-relaxed">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div className="text-ink [&>p+p]:mt-2">{children}</div>
      </div>
    </div>
  );
}
