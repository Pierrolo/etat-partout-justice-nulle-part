/**
 * The brand layer's vocabulary — pure data, safe to import from Node scripts, tests and the browser.
 *
 * One look is shipped: `data-brand="ci"` (Schibsted Grotesk, JetBrains Mono, paper / ink, one signal
 * accent), defined as overrides in brand-ci.css. `editorial` is the base token file those overrides
 * sit on. It is not a choice offered to visitors.
 */
export const BRANDS = ['editorial', 'ci'] as const;
export type Brand = (typeof BRANDS)[number];

export function isBrand(value: unknown): value is Brand {
  return typeof value === 'string' && (BRANDS as readonly string[]).includes(value);
}

/** Value of the `<meta name="theme-color">` tags per colour mode (= the page ground). */
export const BRAND_THEME_COLOR: Record<Brand, { light: string; dark: string }> = {
  editorial: { light: '#faf8f4', dark: '#14151a' },
  ci: { light: '#f3f1ea', dark: '#121614' },
};
