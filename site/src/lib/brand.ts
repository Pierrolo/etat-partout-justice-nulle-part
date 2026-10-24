/**
 * Brand selection at runtime. The brand is the `data-brand` attribute of <html>:
 *   1. build time   PUBLIC_BRAND=editorial|ci  → the default written into the HTML (BaseLayout.astro)
 *   2. before paint an inline <head> script overrides it with `?brand=…` in the URL, else with the
 *                    choice saved in localStorage (BaseLayout.astro, same pattern as the dark theme)
 *   3. at any time   the « Apparence » control (BrandSwitch.astro) changes the attribute
 * Components never read the brand: they read tokens. Only code that needs RESOLVED colours (continuous
 * chart interpolators, text-colour contrast helpers) calls `useBrand()` / `currentBrand()`.
 */
import { isBrand, type Brand } from './brands.ts';

export * from './brands.ts';

/** Build-time default (env `PUBLIC_BRAND`); anything but a known brand falls back to « editorial ». */
export const DEFAULT_BRAND: Brand = isBrand(import.meta.env.PUBLIC_BRAND)
  ? import.meta.env.PUBLIC_BRAND
  : 'editorial';

/** Brand currently applied to the page (browser only; the default on the server). */
export function currentBrand(): Brand {
  if (typeof document === 'undefined') return DEFAULT_BRAND;
  const b = document.documentElement.dataset.brand;
  return isBrand(b) ? b : DEFAULT_BRAND;
}
