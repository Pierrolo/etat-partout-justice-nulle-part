import { Button } from '@/components/ui';
import { IconArrowDown, IconDown, IconUp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { Comparison, Period } from '@/lib/engine-types';
import { formatEuro } from '@/lib/format';
import {
  buildHeadline,
  directionOf,
  displayFigures,
  headlineLead,
  headlineSentence,
  periodLong,
} from '@/lib/sim/result';
import { ShareButton } from './ShareButton';

export interface HeadlineProps {
  /** `null` while the form holds invalid values. */
  comparison: Comparison | null;
  period: Period;
  /** Previous result is kept on screen, dimmed, while a new one is computed or inputs are invalid. */
  stale: boolean;
  invalid: boolean;
  variant: 'side' | 'hero';
  getUrl: () => string;
  onSeeDetail: () => void;
  onSeeHypotheses: () => void;
  onResetPeriod: () => void;
  hypothesesCount: number;
  className?: string;
}

const TONE = {
  gain: { text: 'text-gain', soft: 'bg-gain-soft', bar: 'bg-gain-mark' },
  loss: { text: 'text-loss', soft: 'bg-loss-soft', bar: 'bg-loss-mark' },
  flat: { text: 'text-ink', soft: 'bg-sunken', bar: 'bg-ink-3' },
} as const;

/**
 * THE sentence (docs/VISION.md §1). One live region announces the whole sentence politely when the
 * debounced result changes; the large visual figure is aria-hidden so nothing is read twice.
 * Sign, arrow icon, words and colour all carry the direction.
 */
export function Headline({
  comparison,
  period,
  stale,
  invalid,
  variant,
  getUrl,
  onSeeDetail,
  onSeeHypotheses,
  onResetPeriod,
  hypothesesCount,
  className,
}: HeadlineProps) {
  const hero = variant === 'hero';
  const h = comparison ? buildHeadline(comparison) : null;
  const fig = comparison ? displayFigures(comparison) : null;
  const tone = TONE[h?.direction ?? 'flat'];
  const Icon = h?.direction === 'loss' ? IconDown : IconUp;
  const max = fig ? Math.max(fig.baseline, fig.plan, 1) : 1;

  return (
    <div
      data-testid={`headline-${variant}`}
      className={cn(
        'card flex flex-col gap-4 transition-opacity duration-200',
        stale && 'opacity-60',
        className,
      )}
      aria-busy={stale || undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow eyebrow-accent">Votre résultat</h2>
        {period !== 'steady' && (
          <button
            type="button"
            onClick={onResetPeriod}
            className="rounded-sm text-xs font-semibold text-ink-2 underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            {periodLong(period)} · revenir au plan complet
          </button>
        )}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {comparison && h ? (
          <>
            <p className="sr-only" data-testid="headline-sentence">
              {headlineSentence(comparison, period)}
            </p>
            <div aria-hidden="true" className="space-y-2">
              <p className={cn('text-ink-2', hero ? 'text-lg sm:text-xl' : 'text-base')}>
                {headlineLead(period)}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {h.direction !== 'flat' && (
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      tone.soft,
                      tone.text,
                    )}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </span>
                )}
                <span
                  data-key-figure
                  className={cn(
                    'stat-number',
                    tone.text,
                    hero ? 'text-[length:var(--text-display)]' : 'text-[2.5rem]',
                  )}
                >
                  {h.direction === 'flat' ? '≈ 0 €' : h.amount.replace('/mois', '')}
                </span>
                <span className="font-serif text-lg text-ink-2 sm:text-xl">par mois</span>
                {h.direction !== 'flat' && (
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-sm font-bold',
                      tone.soft,
                      tone.text,
                    )}
                  >
                    {h.percent}
                  </span>
                )}
              </p>
              <p className="text-[0.9375rem] text-ink-2">
                {h.direction === 'flat'
                  ? 'Écart inférieur à 5 € par mois, dans un sens comme dans l’autre.'
                  : h.perDay}
                {h.direction !== 'flat' && (
                  <span className="text-ink-3"> · selon nos hypothèses</span>
                )}
              </p>
            </div>
          </>
        ) : (
          <p role="status" className="py-4 text-[0.9375rem] text-ink-2">
            {invalid
              ? 'Complétez les champs signalés en rouge pour voir votre résultat.'
              : 'Calcul en cours…'}
          </p>
        )}
      </div>

      {h && fig && (
        <dl className="space-y-2 text-sm" aria-label="Revenu disponible mensuel du ménage">
          {(
            [
              ['Aujourd’hui', fig.baseline, 'bg-ink-3'],
              ['Avec le plan', fig.plan, 'bg-accent'],
            ] as const
          ).map(([label, value, bg]) => (
            <div key={label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
              <dt className="text-ink-2">{label}</dt>
              <dd className="contents">
                <span aria-hidden="true" className="h-2.5 rounded-full bg-sunken">
                  <span
                    className={cn('block h-full rounded-full', bg)}
                    style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
                  />
                </span>
                <span className="num font-semibold text-ink">{formatEuro(value)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className="text-xs text-ink-3">
        Revenu disponible mensuel de votre ménage, en euros de 2026. Montants arrondis à 5 € près.{' '}
        <button
          type="button"
          onClick={onSeeHypotheses}
          className="rounded-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          {hypothesesCount} hypothèses actives
        </button>
      </p>

      <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <Button variant="primary" size="sm" onClick={onSeeDetail}>
          <IconArrowDown size={14} />
          Voir le détail
        </Button>
        <ShareButton getUrl={getUrl} size="sm" />
      </div>
    </div>
  );
}

export { directionOf };
