// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { rehypeMethode } from './src/lib/rehype-methode.mjs';
import { typoJson } from './src/lib/vite-typo-json.mjs';

/**
 * BASE_PATH: sub-path the site is served from (GitHub Pages project site → "/etat-partout-justice-nulle-part/").
 * SITE_URL : absolute origin (no path), only used for canonical / Open Graph URLs, e.g. "https://user.github.io".
 */
function normaliseBase(raw = '/') {
  let b = raw.trim();
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  return b;
}

// https://astro.build/config
// NOTE(csp): Astro's `security.csp` was tried and rejected for now: Observable Plot injects <style> elements
// and style attributes at runtime, which a hashed style-src blocks. "No third-party request" is enforced by
// e2e/no-third-party.spec.ts instead.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: normaliseBase(process.env.BASE_PATH),
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  devToolbar: { enabled: false },
  // Sitemap only exists when SITE_URL is set (production). The styleguide is a noindex showcase: not listed.
  integrations: [react(), sitemap({ filter: (page) => !page.includes('/styleguide') })],
  // docs/METHODE.md is rendered by pages/methode.astro: anchors, typography, glossary, scrollable tables.
  markdown: {
    smartypants: false,
    rehypePlugins: [[rehypeMethode, { base: normaliseBase(process.env.BASE_PATH) }]],
  },
  vite: {
    // French typography for the JSON datasets at build time (the pipeline output stays verbatim).
    plugins: [typoJson(), tailwindcss()],
  },
});
