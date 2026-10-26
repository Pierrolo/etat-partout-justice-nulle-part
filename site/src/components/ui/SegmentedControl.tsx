import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Question / group name, announced by screen readers (« Votre situation »). */
  legend: string;
  hideLegend?: boolean;
  options: SegmentedOption<T>[];
  /** `null` = unanswered: no option is checked (no hidden default answer). */
  value: T | null;
  onChange: (value: T) => void;
  name?: string;
  /** Plain-language help under the legend; wired with aria-describedby. */
  hint?: ReactNode;
  /** Options share the full width equally (good for 2–3 short choices on phones). */
  fullWidth?: boolean;
  /** `stack` = one option per line (long labels, 4+ choices, answers to read like a list). */
  layout?: 'wrap' | 'stack';
  /** Shown under the options (and announced with them) when the question must be answered. */
  error?: string;
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * Single-choice control built on native radio inputs: arrow keys, grouping and form semantics for
 * free. Options are separate bordered pills so long French labels can wrap on a 390 px screen.
 */
export function SegmentedControl<T extends string>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
  name,
  hint,
  fullWidth = false,
  layout = 'wrap',
  error,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const uid = useId();
  const group = name ?? `${uid}-seg`;
  const hintId = `${uid}-hint`;
  const errId = `${uid}-err`;
  const describedBy = cn(hint ? hintId : false, error ? errId : false) || undefined;
  return (
    <fieldset className={cn('min-w-0', className)} aria-describedby={describedBy}>
      <legend
        className={cn(
          'text-[0.9375rem] font-semibold text-ink',
          hideLegend ? 'sr-only' : hint ? 'mb-0.5' : 'mb-2',
        )}
      >
        {legend}
      </legend>
      {hint && (
        <p id={hintId} className="mb-2 text-sm text-ink-3">
          {hint}
        </p>
      )}
      <div
        className={cn(
          layout === 'stack' ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2',
          fullWidth && layout !== 'stack' && 'grid grid-flow-col auto-cols-fr',
        )}
      >
        {options.map((o) => (
          <label key={o.value} className={cn('relative block', o.disabled && 'opacity-50')}>
            <input
              type="radio"
              name={group}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex h-full cursor-pointer items-center rounded-md border-[1.5px] bg-field font-semibold text-ink transition-colors',
                error ? 'border-loss' : 'border-rule-strong',
                layout === 'stack' ? 'justify-start text-start' : 'justify-center text-center',
                'hover:border-ink peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent',
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                'peer-disabled:cursor-not-allowed',
                size === 'md' ? 'min-h-11 px-4 py-2 text-[0.9375rem]' : 'min-h-9 px-3 py-1 text-sm',
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errId} className="mt-2 text-sm text-loss">
          {error}
        </p>
      )}
    </fieldset>
  );
}
