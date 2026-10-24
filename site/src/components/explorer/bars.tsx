/**
 * Barres horizontales en HTML — le graphique par défaut des pages « Comprendre » :
 * classement (top 20), répartition (catégories, impôts), comparaison de totaux.
 *
 * Pourquoi du HTML plutôt qu'un SVG : le texte reste du vrai texte (lisible, sélectionnable,
 * zoomable à 200 %), la mise en page se replie sans calcul à 320 px, le rendu est statique
 * (zéro JavaScript) et chaque valeur est écrite au bout de sa barre — rien n'est réservé au survol.
 *
 * Spécification des marques (skill dataviz) : barre ≤ 24 px, extrémité arrondie à 4 px et pied
 * carré, un seul axe, valeur au bout de la barre, couleur portée par la marque (jamais par le texte).
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface BarSegment {
  value: number;
  /** Couleur CSS (`var(--series-1)`…). */
  color: string;
  /** Hachuré + contour pointillé : valeur « annoncée », sans texte de loi. */
  hatched?: boolean;
  /** Nom du segment pour le lecteur d'écran (« dont TVA des administrations : 11,9 Md€ »). */
  srLabel?: string;
}

export interface BarItem {
  id: string;
  label: ReactNode;
  /** Ligne discrète sous l'intitulé. */
  sub?: ReactNode;
  /** Un ou plusieurs segments empilés (même axe, même unité). */
  segments: BarSegment[];
  /** Valeur écrite au bout de la barre, déjà formatée par `format.ts`. */
  valueText: string;
  /** Pastille de couleur devant l'intitulé (identité d'une catégorie). */
  swatch?: string;
}

export interface BarRowsProps {
  items: BarItem[];
  /** Valeur qui occupe toute la largeur utile ; par défaut, le plus grand total. */
  max?: number;
  /** Largeur réservée à la valeur, au bout de la barre. */
  valueWidth?: string;
  /** Largeur de la colonne d'intitulés à partir de `sm` (les intitulés passent au-dessus en dessous). */
  labelWidth?: string;
  /** Nom de la liste pour les lecteurs d'écran. */
  label: string;
  /** Épaisseur de la barre en px (≤ 24). */
  thickness?: number;
  className?: string;
}

const total = (it: BarItem) => it.segments.reduce((n, s) => n + Math.max(0, s.value), 0);

export function BarRows({
  items,
  max,
  valueWidth = '6.5rem',
  labelWidth = 'minmax(0, 17rem)',
  label,
  thickness = 14,
  className,
}: BarRowsProps) {
  const scale = max ?? Math.max(1, ...items.map(total));
  const gap = 2; // espace de 2 px, couleur de la surface, entre segments contigus
  return (
    <ol
      aria-label={label}
      className={cn('m-0 list-none space-y-2.5 p-0 sm:space-y-1.5', className)}
      style={{ '--bar-value-w': valueWidth, '--bar-label-w': labelWidth } as CSSProperties}
    >
      {items.map((it) => {
        const t = total(it);
        const ratio = Math.min(1, t / scale);
        return (
          <li
            key={it.id}
            className="grid gap-x-3 gap-y-1 rounded-md px-1 py-1 hover:bg-sunken/70 sm:grid-cols-[var(--bar-label-w)_minmax(0,1fr)] sm:items-center"
          >
            <div className="flex min-w-0 items-start gap-2 text-[0.9375rem] leading-snug text-ink">
              {it.swatch && (
                <span
                  aria-hidden="true"
                  className="mt-[0.4em] size-2.5 shrink-0 rounded-full forced-color-adjust-none"
                  style={{ background: it.swatch }}
                />
              )}
              <div className="min-w-0">
                <span className="line-clamp-3 [overflow-wrap:anywhere]">{it.label}</span>
                {it.sub && <div className="mt-0.5 text-xs text-ink-3">{it.sub}</div>}
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2" style={{ minHeight: thickness }}>
              <div
                aria-hidden="true"
                className="flex shrink-0"
                style={{
                  width: `calc((100% - var(--bar-value-w)) * ${ratio.toFixed(5)})`,
                  minWidth: t > 0 ? 3 : 0,
                  height: thickness,
                  gap,
                }}
              >
                {it.segments.map((s, i) => {
                  const last = i === it.segments.length - 1;
                  return (
                    <span
                      key={i}
                      className="block h-full forced-color-adjust-none"
                      style={{
                        flex: `${Math.max(0, s.value)} 1 0`,
                        background: s.hatched
                          ? `repeating-linear-gradient(135deg, ${s.color} 0 1.5px, color-mix(in oklab, ${s.color} 14%, var(--surface)) 1.5px 6px)`
                          : s.color,
                        outline: s.hatched ? `1.5px dashed ${s.color}` : undefined,
                        outlineOffset: s.hatched ? -1.5 : undefined,
                        borderRadius: last ? '0 4px 4px 0' : 0,
                      }}
                    />
                  );
                })}
              </div>
              <span className="num shrink-0 text-[0.9375rem] font-semibold text-ink">
                {it.valueText}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Légende d'un graphique à plusieurs séries : pastille de la marque + libellé en encre neutre. */
export function BarLegend({
  items,
  className,
  label = 'Légende',
}: {
  items: Array<{ label: ReactNode; color: string; hatched?: boolean }>;
  className?: string;
  label?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'm-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-sm text-ink-2',
        className,
      )}
    >
      {items.map((it, i) => (
        <li key={i} className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-5 rounded-[3px] forced-color-adjust-none"
            style={{
              background: it.hatched
                ? `repeating-linear-gradient(135deg, ${it.color} 0 1.5px, color-mix(in oklab, ${it.color} 14%, var(--surface)) 1.5px 5px)`
                : it.color,
              outline: it.hatched ? `1.5px dashed ${it.color}` : undefined,
              outlineOffset: it.hatched ? -1.5 : undefined,
            }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
