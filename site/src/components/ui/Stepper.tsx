import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatInteger } from '@/lib/format';
import { IconMinus, IconPlus } from './icons';

export interface StepperProps {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Singular / plural noun of the counted thing: « enfant » / « enfants ». */
  unit?: [singular: string, plural: string];
  hint?: ReactNode;
  className?: string;
}

/**
 * Numeric − / + counter (number of children, of adults…). Two 48 px buttons and a live-announced
 * value; the buttons are disabled at the bounds. For a free amount use NumberInput instead.
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  unit,
  hint,
  className,
}: StepperProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const noun = (n: number) => (unit ? (Math.abs(n) > 1 ? unit[1] : unit[0]) : '');
  const text = `${formatInteger(value)}${unit ? ` ${noun(value)}` : ''}`;
  const btn =
    'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-rule-strong bg-surface text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-rule-strong';
  return (
    <div role="group" aria-labelledby={labelId} className={cn('flex flex-col gap-1.5', className)}>
      <span id={labelId} className="text-[0.9375rem] font-semibold text-ink">
        {label}
      </span>
      {hint && <span className="text-sm text-ink-3">{hint}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btn}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={unit ? `Retirer un ${unit[0]}` : 'Diminuer'}
        >
          <IconMinus size={20} />
        </button>
        <output
          aria-live="polite"
          className="num min-w-[5.5rem] text-center font-serif text-2xl font-medium text-ink"
        >
          {text}
        </output>
        <button
          type="button"
          className={btn}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label={unit ? `Ajouter un ${unit[0]}` : 'Augmenter'}
        >
          <IconPlus size={20} />
        </button>
      </div>
    </div>
  );
}

export interface StepIndicatorProps {
  /** Labels of the steps, in order. */
  steps: string[];
  /** 0-based index of the current step. */
  current: number;
  className?: string;
}

/** « Étape 2 sur 5 — Activité »: compact progress for the mobile question flow. */
export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Progression" className={cn('space-y-2', className)}>
      <p className="text-sm font-semibold text-ink">
        <span className="text-ink-3">
          Étape {current + 1} sur {steps.length}
        </span>
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        {steps[current]}
      </p>
      <ol className="flex gap-1.5">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? 'step' : undefined}
            className={cn('h-1.5 flex-1 rounded-full', i <= current ? 'bg-accent' : 'bg-rule')}
          >
            <span className="sr-only">
              {s}
              {i < current ? ' (terminée)' : i === current ? ' (en cours)' : ''}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
