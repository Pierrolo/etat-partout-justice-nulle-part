import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  /** Text announced/displayed for each state (not colour alone): default « Oui » / « Non ». */
  stateLabels?: [on: string, off: string];
  disabled?: boolean;
  className?: string;
}

/**
 * On/off switch (`role="switch"` on a native checkbox → Space toggles, state announced).
 * The state is written in words beside the track, so it never relies on position or colour alone.
 */
export function Switch({
  label,
  checked,
  onChange,
  hint,
  stateLabels = ['Oui', 'Non'],
  disabled,
  className,
}: SwitchProps) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-start justify-between gap-4 py-1',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="mt-0.5 block text-sm font-normal text-ink-3">
            {hint}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-0.5">
        <span
          className="min-w-[2.25rem] text-end text-sm font-semibold text-ink-2"
          aria-hidden="true"
        >
          {checked ? stateLabels[0] : stateLabels[1]}
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={hint ? hintId : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-block h-7 w-12 shrink-0 rounded-full border-[1.5px] transition-colors',
            checked ? 'border-accent bg-accent' : 'border-rule-strong bg-sunken',
            'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-5 rounded-full shadow-sm transition-[left] duration-150',
              checked ? 'left-[1.375rem] bg-on-accent' : 'left-0.5 bg-ink-3',
            )}
          />
        </span>
      </span>
    </label>
  );
}
