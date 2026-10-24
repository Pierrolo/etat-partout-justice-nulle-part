/**
 * The brand layer's vocabulary — pure data, safe to import from Node scripts, tests and the browser.
 * (The runtime parts — build-time default, current brand, React hook — live in brand.ts.)
 *
 * A brand is a set of values for the SAME design tokens, selected by an attribute on <html>:
 *   data-brand="editorial"  « Éditorial »        Fraunces + Inter, violet accent        (tokens.css)
 *   data-brand="ci"         « Call Intelligence » Schibsted Grotesk + JetBrains Mono,   (brand-ci.css)
 *                                                 paper / ink / one signal accent
 */
export const BRANDS = ['editorial', 'ci'] as const;
export type Brand = (typeof BRANDS)[number];

export const BRAND_LABEL: Record<Brand, string> = {
  editorial: 'Éditorial',
  ci: 'Call Intelligence',
};

/** localStorage key (a per-viewer convenience, never a cookie), next to « epjn-theme ». */
export const BRAND_STORAGE_KEY = 'epjn-brand';
/** `?brand=ci` in the URL wins over the stored choice and over the build-time default. */
export const BRAND_QUERY_PARAM = 'brand';

export function isBrand(value: unknown): value is Brand {
  return typeof value === 'string' && (BRANDS as readonly string[]).includes(value);
}

/** Value of the `<meta name="theme-color">` tags per brand and colour mode (= the page ground). */
export const BRAND_THEME_COLOR: Record<Brand, { light: string; dark: string }> = {
  editorial: { light: '#faf8f4', dark: '#14151a' },
  ci: { light: '#f3f1ea', dark: '#121614' },
};
