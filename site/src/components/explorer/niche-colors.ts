import { css } from '@/lib/chart-theme';
import { CATEGORY_META, type CategoryId } from '@/lib/niches-model';

/**
 * Couleur d'une catégorie de niche : l'identité de l'entité, jamais son rang.
 * Les six premières catégories prennent les teintes 1 à 6 de la palette catégorielle (validée) ;
 * « Autres » prend le gris neutre « Autres » — jamais une teinte générée.
 */
export function catColor(cat: CategoryId): string {
  const i = CATEGORY_META[cat].index;
  return i === null ? css.other : (css.series[i] ?? css.other);
}
