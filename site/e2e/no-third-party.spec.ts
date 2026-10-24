import { expect, test } from '@playwright/test';
import { builtPages } from './pages';

/**
 * docs/VISION.md §2.4 — « Client-side only. No tracker, no cookie, no third-party request. »
 * Visits every page (and runs the interactive styleguide), recording every request the browser makes.
 */
test('no request ever leaves the origin, and no cookie is set', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  const seen: string[] = [];

  page.on('request', (req) => {
    const url = req.url();
    seen.push(url);
    if (/^(data|blob|about):/i.test(url)) return;
    if (new URL(url).origin !== origin) foreign.push(`${req.method()} ${url}`);
  });

  for (const path of [...builtPages(), 'cette-page-n-existe-pas/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }

  // Exercise the interactive bits that lazy-load code (styleguide hydrates React + Plot).
  await page.goto('styleguide/');
  await page.getByRole('button', { name: 'Ajouter un enfant' }).click();
  await page.getByRole('tab', { name: 'Tableau' }).click();
  await page.waitForLoadState('networkidle');

  expect(seen.length).toBeGreaterThan(10); // sanity: we really observed traffic
  expect(foreign).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test('fonts are self-hosted (served from the origin)', async ({ page, baseURL }) => {
  const fonts: string[] = [];
  page.on('response', (res) => {
    if (/font\/woff2|\.woff2?(\?|$)/.test(res.headers()['content-type'] ?? res.url()))
      fonts.push(res.url());
  });
  await page.goto('');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) expect(f.startsWith(new URL(baseURL!).origin)).toBe(true);
});
