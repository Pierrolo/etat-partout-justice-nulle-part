import {
  useId,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { formatNumber, parseFrenchNumber } from '@/lib/format';

export interface NumberInputProps {
  label: ReactNode;
  /** Controlled value; `null` = empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Suffix shown inside the field: « € », « €/mois ». */
  unit?: string;
  hint?: ReactNode;
  /** External error message (e.g. from the engine); a built-in parse error is shown otherwise. */
  error?: string;
  min?: number;
  max?: number;
  /** Arrow-key increment. Default 10. */
  step?: number;
  /** Max fraction digits kept. Default 0 (whole euros); the simulator rounds to avoid false precision. */
  decimals?: number;
  id?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Classes of the bordered field only (e.g. `w-48`), so the label and hint keep the full width. */
  fieldClassName?: string;
}

const clamp = (n: number, min?: number, max?: number) =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/**
 * French money / quantity input. `type="text"` + `inputmode="decimal"` (never `type="number"`:
 * no spinners, no locale surprises, no scroll-wheel edits). Accepts « 1 234,5 », « 1234.5 », « 2 500 € ».
 * While focused you edit the raw text; on blur it is re-displayed as « 1 234,5 » with U+202F grouping.
 */
export function NumberInput({
  label,
  value,
  onChange,
  unit,
  hint,
  error,
  min,
  max,
  step = 10,
  decimals = 0,
  id,
  name,
  placeholder,
  required,
  disabled,
  className,
  fieldClassName,
}: NumberInputProps) {
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const hintId = `${inputId}-hint`;
  const errId = `${inputId}-err`;
  const [draft, setDraft] = useState<string | null>(null);

  const shown =
    draft !== null
      ? draft
      : value === null
        ? ''
        : formatNumber(value, { decimals: { min: 0, max: decimals } });

  const parsed = draft !== null && draft.trim() !== '' ? parseFrenchNumber(draft) : null;
  const parseError =
    draft !== null && draft.trim() !== '' && parsed === null
      ? 'Saisissez un nombre, par exemple 1 850 ou 1 850,50.'
      : undefined;
  const rangeError =
    parsed !== null && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max))
      ? min !== undefined && parsed < min
        ? `La valeur minimale est ${formatNumber(min, { decimals: { min: 0, max: decimals } })}.`
        : `La valeur maximale est ${formatNumber(max!, { decimals: { min: 0, max: decimals } })}.`
      : undefined;
  const message = error ?? parseError ?? rangeError;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDraft(text);
    if (text.trim() === '') return onChange(null);
    const n = parseFrenchNumber(text);
    if (n !== null) onChange(round(n, decimals));
  };

  // Keep the text exactly as displayed (grouping included) so the DOM value does not change under the
  // caret on focus, then select it: typing replaces the whole number, like a native field.
  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setDraft(shown);
    e.currentTarget.select();
  };

  const handleBlur = () => {
    if (draft !== null && draft.trim() !== '') {
      const n = parseFrenchNumber(draft);
      if (n !== null) onChange(clamp(round(n, decimals), min, max));
    }
    setDraft(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const base = (draft !== null ? parseFrenchNumber(draft) : value) ?? 0;
    const next = clamp(round(base + (e.key === 'ArrowUp' ? step : -step), decimals), min, max);
    setDraft(String(next).replace('.', ','));
    onChange(next);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[0.9375rem] font-semibold text-ink">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-loss">
              {' '}
              *
            </span>
            <span className="sr-only"> (obligatoire)</span>
          </>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-ink-3">
          {hint}
        </p>
      )}
      <div
        className={cn(
          'flex min-h-12 items-center rounded-md border-[1.5px] bg-surface px-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent',
          message ? 'border-loss' : 'border-rule-strong',
          disabled && 'opacity-60',
          fieldClassName,
        )}
      >
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          value={shown}
          aria-invalid={message ? true : undefined}
          aria-describedby={cn(hint ? hintId : false, message ? errId : false) || undefined}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="num w-full min-w-0 flex-1 bg-transparent py-2 text-lg font-medium text-ink outline-none placeholder:text-ink-3"
        />
        {unit && <span className="ms-2 shrink-0 text-[0.9375rem] text-ink-3">{unit}</span>}
      </div>
      <p id={errId} aria-live="polite" className={cn('text-sm text-loss', !message && 'hidden')}>
        {message}
      </p>
    </div>
  );
}
