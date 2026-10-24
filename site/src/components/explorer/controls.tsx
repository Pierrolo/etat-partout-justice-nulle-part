/**
 * Contrôles partagés des pages « Comprendre » interactives : champ de recherche, pastille de
 * filtre (bouton à bascule) et pagination. Tous au clavier, cibles ≥ 40 px, état dit en toutes
 * lettres ou par une forme (coche) — jamais par la couleur seule.
 */
import { useId, type ReactNode } from 'react';
import { IconCheck, IconClose } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import '@/components/story/story.css';

/* ── Recherche ──────────────────────────────────────────────────────────── */

export interface SearchBoxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Ce que la recherche couvre, lu après le libellé (« Intitulé, référence légale, impôt »). */
  hint?: string;
  className?: string;
}

export function SearchBox({
  label,
  value,
  onChange,
  placeholder,
  hint,
  className,
}: SearchBoxProps) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  return (
    <div role="search" className={cn('min-w-0', className)}>
      <label htmlFor={`${uid}-q`} className="mb-1.5 block text-[0.9375rem] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={`${uid}-q`}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="[&::-webkit-search-cancel-button]:hidden min-h-11 w-full rounded-md border-[1.5px] border-rule-strong bg-field py-2 pe-12 ps-3 text-[1rem] text-ink placeholder:text-ink-3 hover:border-ink focus-visible:border-accent"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Effacer la recherche"
            className="absolute end-0.5 top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <IconClose size={16} />
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ── Pastille de filtre ─────────────────────────────────────────────────── */

export interface FilterChipProps {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Pastille de couleur (identité d'une catégorie) : décorative, le texte porte le sens. */
  swatch?: string;
  /** Nombre d'éléments derrière la pastille, après le libellé. */
  count?: number | string;
  className?: string;
}

/**
 * Bouton à bascule (`aria-pressed`). Sélectionné = fond teinté + bordure pleine + coche.
 * Plusieurs pastilles d'un même groupe se combinent en OU ; les groupes entre eux, en ET.
 */
export function FilterChip({
  pressed,
  onToggle,
  children,
  swatch,
  count,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3.5 py-1.5 text-[0.9375rem] font-medium leading-snug transition-colors',
        pressed
          ? 'border-accent bg-accent-soft text-ink'
          : 'border-rule-strong bg-surface text-ink-2 hover:border-ink hover:text-ink',
        className,
      )}
    >
      {pressed ? (
        <IconCheck size={14} strokeWidth={2.25} className="shrink-0 text-accent" />
      ) : swatch ? (
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full forced-color-adjust-none"
          style={{ background: swatch }}
        />
      ) : null}
      <span>{children}</span>
      {count !== undefined && (
        <span className="num text-sm font-normal text-ink-3" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Pagination ─────────────────────────────────────────────────────────── */

export interface PagerProps {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** Nom de la liste paginée, pour le lecteur d'écran (« Niches fiscales »). */
  label: string;
  className?: string;
}

export function Pager({ page, pages, onPage, label, className }: PagerProps) {
  if (pages <= 1) return null;
  const btn =
    'btn btn-secondary btn-sm !min-h-11 min-w-11 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav
      aria-label={`Pagination — ${label}`}
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <span aria-hidden="true">←</span>
        <span className="max-sm:sr-only">Précédent</span>
      </button>
      <p className="num text-sm text-ink-2">
        Page <strong className="font-semibold text-ink">{page}</strong> sur {pages}
      </p>
      <button
        type="button"
        className={btn}
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        <span className="max-sm:sr-only">Suivant</span>
        <span aria-hidden="true">→</span>
      </button>
    </nav>
  );
}
