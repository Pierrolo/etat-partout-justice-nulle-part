import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The story pages (landing teaser, /comprendre hub, depenses, etat-partout, le-plan, europe, agences)
 * hydrate their charts lazily (`client:visible`), which smoke.spec.ts never triggers: this spec
 * scrolls every page so all islands mount, then checks for runtime errors and accessibility.
 */
const pages = [
  '',
  'comprendre/',
  'comprendre/depenses/',
  'comprendre/etat-partout/',
  'comprendre/le-plan/',
  'comprendre/europe/',
  'comprendre/agences/',
];

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(80);
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`story pages, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const path of pages) {
      test(`${path || 'home'}: every island hydrates, no error, no serious a11y violation`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(path);
        await scrollThrough(page);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(
          results.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
        ).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  });
}

test('predict then reveal works with a numeric field and no pointer', async ({ page }) => {
  await page.goto('comprendre/');
  await page.getByLabel('ou tapez un nombre').scrollIntoViewIfNeeded();
  const field = page.getByLabel('ou tapez un nombre');
  await field.fill('25');
  await page.getByRole('button', { name: 'Révéler la réponse' }).click();
  await expect(page.getByText('La réalité', { exact: false })).toContainText('6,4');
  await expect(page.getByText('Vous avez dit 25 %')).toBeVisible();
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.getByText('pas encore choisie')).toBeVisible();
});

test('the range input is keyboard-operable', async ({ page }) => {
  await page.goto('comprendre/');
  const range = page.getByRole('slider', { name: /Votre estimation/ });
  await range.scrollIntoViewIfNeeded();
  await range.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(range).toHaveAttribute('aria-valuetext', '1 pour cent');
});

test.describe('treemap (wide screens)', () => {
  test.skip(({ isMobile }) => isMobile, 'phones get the bar list, not the treemap');

  test('unit toggle, zoom in with the keyboard and back with Escape', async ({ page }) => {
    await page.goto('comprendre/depenses/');
    await scrollThrough(page);
    await page.getByLabel('Par foyer et par an').check({ force: true });
    await expect(page.locator('.tm-hd').first()).toContainText('€/an');
    await page.locator('.tm-hd').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Niveau affiché' })).toContainText(
      'Toutes les dépenses',
    );
    await expect(page.getByRole('button', { name: /Remonter/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Remonter/ })).toHaveCount(0);
  });
});

test('Sankey: the horizon toggle changes the figure and keeps a table alternative', async ({
  page,
}) => {
  await page.goto('comprendre/le-plan/');
  await scrollThrough(page);
  await page.locator('label', { hasText: 'Première année' }).click();
  await expect(page.getByRole('heading', { name: /Dès la première année/ })).toBeVisible();
  await page.getByText('Voir les données').first().click();
  await expect(page.getByRole('table').first()).toContainText('Salaire net');
});

test('the agency list filters, announces the count and ignores accents', async ({ page }) => {
  await page.goto('comprendre/agences/');
  await scrollThrough(page);
  await page.getByLabel('Nom ou mot-clé').fill('meteo');
  await expect(page.getByText('Météo-France')).toBeVisible();
  await expect(page.locator('p[aria-live="polite"]').first()).toContainText('résultat');
});

test('the story pages are complete without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('comprendre/');
  await expect(page.getByText('Réponse : la sécurité')).toBeVisible();
  await page.goto('comprendre/depenses/');
  await expect(page.locator('.tm')).toBeVisible();
  await expect(page.getByText('Lecture.').first()).toBeVisible();
  await ctx.close();
});
