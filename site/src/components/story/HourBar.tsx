import { cn } from '@/lib/cn';
import { chip, num } from '@/lib/facts';
import { formatEuro, formatPercentPoints } from '@/lib/format';
import { SourceChip } from '@/components/ui/SourceChip';
import './story.css';

/**
 * « Votre heure de travail » — the signature visual (docs/VISION.md §1): the value created by one
 * hour of work, split between the State, capital and the worker's net pay. Generic (average
 * worker) version, 100 % static: no JavaScript, numbers from facts.json (GraphVA).
 *
 * Form: one stacked bar, a faint tick every euro so that "63 €" reads as 63 units, a 2 px surface
 * gap between segments, values and names written under the bar (never colour alone, never hover).
 */

type Part = {
  id: 'etat' | 'capital' | 'salaire';
  euros: number;
  pct: number;
  /** CSS colour of the mark (categorical slots 1, 4, 3: validated adjacent and all-pairs in light mode). */
  color: string;
  short: string;
  text: string;
};

function parts(): Part[] {
  return [
    {
      id: 'etat',
      euros: num('va_heure_etat_eur'),
      pct: num('va_heure_etat_pct'),
      color: 'var(--series-1)',
      short: 'État',
      text: 'prélevés par l’État',
    },
    {
      id: 'capital',
      euros: num('va_heure_capital_eur'),
      pct: num('va_heure_capital_pct'),
      color: 'var(--series-4)',
      short: 'Capital',
      text: 'pour rémunérer le capital',
    },
    {
      id: 'salaire',
      euros: num('va_heure_salaire_net_eur'),
      pct: num('va_heure_salaire_net_pct'),
      color: 'var(--series-3)',
      short: 'Salaire net',
      text: 'reviennent au salarié',
    },
  ];
}

export interface HourBarProps {
  /** Visible heading level inside the figure (default: none, caller provides context). */
  className?: string;
  /** Show the headline sentence above the bar (default true). */
  headline?: boolean;
  /** Bar thickness. */
  size?: 'md' | 'lg';
}

export function HourBar({ className, headline = true, size = 'md' }: HourBarProps) {
  const p = parts();
  const total = num('va_heure_total_eur');
  const sentence = `Sur une heure de travail, ${formatEuro(total)} de valeur ajoutée : ${p
    .map((x) => `${formatEuro(x.euros)} ${x.text}`)
    .join(', ')}.`;

  return (
    <figure className={cn('space-y-5', className)} aria-label={sentence}>
      {headline && (
        <p className="font-serif text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl">
          Sur une heure de travail, <span className="whitespace-nowrap">{formatEuro(total)}</span>{' '}
          de valeur ajoutée.
        </p>
      )}

      {/* The bar: aria-hidden, the legend below carries the same numbers as text. */}
      <div aria-hidden="true" className="flex gap-0.5">
        {p.map((x, i) => (
          <div
            key={x.id}
            className={cn(
              size === 'lg' ? 'h-14' : 'h-11',
              i === 0 && 'rounded-s-[4px]',
              i === p.length - 1 && 'rounded-e-[4px]',
            )}
            style={{
              flex: `${x.euros} 1 0`,
              backgroundColor: x.color,
              // one faint tick per euro
              backgroundImage: `linear-gradient(90deg, transparent calc(100% - 1px), var(--surface) 0)`,
              backgroundSize: `calc(100% / ${x.euros}) 100%`,
              backgroundRepeat: 'repeat-x',
              opacity: 1,
            }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-3 gap-x-3 gap-y-1">
        {p.map((x) => (
          <li key={x.id} className="min-w-0">
            <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-2">
              <span
                aria-hidden="true"
                className="inline-block size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: x.color }}
              />
              {x.short}
            </p>
            <p className="font-serif text-2xl font-medium leading-tight tracking-tight text-ink sm:text-3xl">
              {formatEuro(x.euros)}
            </p>
            <p className="text-[0.8125rem] leading-snug text-ink-3">
              <span className="sr-only">{x.text}, </span>
              {formatPercentPoints(x.pct, { decimals: x.pct % 1 === 0 ? 0 : 1 })} du total
            </p>
          </li>
        ))}
      </ul>

      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-3">
        <span className="font-semibold">Source&nbsp;:</span>
        <SourceChip
          {...chip('va_heure_total_eur', { label: 'Chiffrage publié, onglet GraphVA' })}
        />
      </figcaption>
    </figure>
  );
}
