import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconCheck } from './icons';

export interface CheckboxProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Explanation under the label; wired with aria-describedby. */
  hint?: ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/**
 * Native checkbox with a 44 px target and a drawn box (check mark = shape, not just colour).
 * The whole label is clickable; the hint is read after the label by screen readers.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  disabled,
  name,
  className,
}: CheckboxProps) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  return (
    <label
      className={cn(
        'group flex min-h-11 cursor-pointer items-start gap-3 py-1',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? hintId : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-rule-strong bg-field text-on-accent transition-colors',
          'peer-checked:border-accent peer-checked:bg-accent',
          'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          '[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100',
        )}
      >
        <IconCheck size={16} strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="mt-0.5 block text-sm font-normal text-ink-3">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
