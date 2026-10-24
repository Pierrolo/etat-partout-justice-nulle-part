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
  value: T;
  onChange: (value: T) => void;
  name?: string;
  /** Options share the full width equally (good for 2–3 short choices on phones). */
  fullWidth?: boolean;
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
  fullWidth = false,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const uid = useId();
  const group = name ?? `${uid}-seg`;
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend
        className={cn('mb-2 text-[0.9375rem] font-semibold text-ink', hideLegend && 'sr-only')}
      >
        {legend}
      </legend>
      <div className={cn('flex flex-wrap gap-2', fullWidth && 'grid grid-flow-col auto-cols-fr')}>
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
                'flex h-full cursor-pointer items-center justify-center rounded-md border-[1.5px] border-rule-strong bg-surface text-center font-semibold text-ink transition-colors',
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
    </fieldset>
  );
}
