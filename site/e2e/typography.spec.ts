import { expect, test } from '@playwright/test';
import { openAllDetails, scrollThrough } from './helpers';
import { builtPages } from './pages';

/**
 * French typography guard (audit M1): in the rendered text of every page there must be no regular space
 * before « ; : ! ? » or « » », none after « « », no « 10 000 » or « 12 % » split by a regular space.
 * Narrow no-break space (U+202F) before ; : ! ? and inside « », no-break space (U+00A0) before units.
 *
 * Pages still waiting for the codemod (owned by the simulator workstream: run
 * `node scripts/typo-fix.mjs --write` on their files, then empty this list) are checked for console
 * problems only.
 */
const PENDING_CODEMOD = new Set<string>([]);

/** Legitimate regular spaces: code samples and the design-system showcase. */
const IGNORE_SELECTOR = 'code, pre, kbd, samp, script, style, noscript, [data-typo-ignore]';

const BAD = [
  { name: 'espace avant ; : ! ? »', re: /[^\s  ] [;:!?»]/g },
  { name: 'espace après «', re: /« /g },
  {
    name: 'milliers coupés par une espace',
    re: /\d \d{3}(?!\d)(?= ?(€|%|Md€|M€|foyers|ménages|agences|niches|personnes|euros|mots|postes|emplois|organismes|heures))/g,
  },
  {
    name: 'nombre séparé de son unité par une espace ordinaire',
    re: /\d (€|%|Md€|M€)(?![\p{L}\d])/gu,
  },
];

test.describe('French typography on every page', () => {
  for (const path of builtPages()) {
    test(`${path || 'home'}: no regular space before ; : ! ? » or after «`, async ({ page }) => {
      test.skip(
        PENDING_CODEMOD.has(path) || path === 'styleguide/',
        'covered by the other workstream / showcase',
      );
      await page.goto(path);
      await scrollThrough(page);
      await openAllDetails(page);
      const text = await page.evaluate((ignore) => {
        // innerText needs layout: read it from the live body, minus the text of the ignored nodes
        const live = document.body.innerText;
        const ignored = [...document.body.querySelectorAll(ignore)].map(
          (n) => (n as HTMLElement).innerText ?? '',
        );
        let t = live;
        for (const i of ignored) if (i) t = t.split(i).join('');
        return t;
      }, IGNORE_SELECTOR);
      const problems: string[] = [];
      for (const { name, re } of BAD) {
        for (const m of text.matchAll(re)) {
          const at = m.index ?? 0;
          problems.push(
            `${name} : « …${text.slice(Math.max(0, at - 25), at + 25).replace(/\s+/g, ' ')}… »`,
          );
        }
      }
      expect(problems.slice(0, 15), `${problems.length} problème(s) de typographie`).toEqual([]);
    });
  }

  test('the brand and the page titles use a narrow no-break space before « ? »', async ({
    page,
  }) => {
    await page.goto('');
    expect(await page.title()).toContain('Et moi, dans tout ça ?');
    await expect(page.locator('header').first()).toContainText('ça ?');
  });
});

test.describe('console stays clean (fonts included)', () => {
  for (const path of builtPages()) {
    test(`${path || 'home'}: no console warning or error`, async ({ page }) => {
      const logs: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'warning' || m.type() === 'error')
          logs.push(`${m.type()}: ${m.text().slice(0, 160)}`);
      });
      page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
      await page.goto(path);
      await scrollThrough(page);
      await page.evaluate(() => document.fonts.ready);
      // The narrow-space font must load: `document.fonts` reports « error » for a font the browser rejects.
      const fontStates = await page.evaluate(() =>
        [...document.fonts].filter((f) => f.family.includes('Narrow Space')).map((f) => f.status),
      );
      expect(fontStates.filter((s) => s === 'error')).toEqual([]);
      expect(logs).toEqual([]);
    });
  }
});
