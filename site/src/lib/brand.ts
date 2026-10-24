/**
 * The look is fixed. BaseLayout writes `data-brand="ci"` on <html> and nothing overrides it:
 * no query parameter, no stored choice. Components read tokens. `currentBrand()` is for the few
 * callers that need a resolved colour rather than a custom property.
 */
import { isBrand, type Brand } from './brands.ts';

export * from './brands.ts';

export const DEFAULT_BRAND: Brand = 'ci';

/** Brand currently applied to the page (browser only; the fixed look on the server). */
export function currentBrand(): Brand {
  if (typeof document === 'undefined') return DEFAULT_BRAND;
  const b = document.documentElement.dataset.brand;
  return isBrand(b) ? b : DEFAULT_BRAND;
}
