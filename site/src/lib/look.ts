/**
 * The one look the site ships: `data-brand="ci"` on <html> (Schibsted Grotesk, JetBrains Mono, paper / ink,
 * one signal accent). It is written in the HTML by BaseLayout and defined as overrides in
 * styles/brand-ci.css on top of styles/tokens.css. There is no other look and no way to choose one: no
 * query parameter, no stored choice, no switch.
 *
 * Pure data, safe to import from Node scripts, tests and the browser.
 */

/** Value of the `<meta name="theme-color">` tags per colour mode (= the page ground, `--paper`). */
export const THEME_COLOR = { light: '#f3f1ea', dark: '#121614' } as const;
