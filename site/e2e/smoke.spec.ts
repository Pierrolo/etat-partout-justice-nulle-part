import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { builtPages } from './pages';

const pages = builtPages();

test('the build contains the expected pages', () => {
  expect(pages).toEqual(
    expect.arrayContaining([
      '',
      'simulateur/',
      'comprendre/',
      'methode/',
      'a-propos/',
      'styleguide/',
    ]),
  );
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const path of pages) {
      test(`${path || 'home'}: loads, has structure, no serious a11y violation`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
        await expect(page.locator('main#main')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('a.skip-link')).toHaveCount(1);
        await expect(page.getByRole('contentinfo')).toContainText(
          'non affilié à l’association Résolution',
        );

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(
          blocking.map(
            (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
          ),
        ).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  });
}

test('404 page is served with status 404 and is accessible', async ({ page }) => {
  const response = await page.goto('cette-page-n-existe-pas/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('n’existe pas');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);
});

test('theme toggle switches the theme and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('');
  const toggle = page.getByRole('button', { name: 'Thème sombre' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('skip link moves focus to the main content', async ({ page }) => {
  await page.goto('');
  await page.keyboard.press('Tab');
  const skip = page.locator('a.skip-link');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test.describe('reflow at 320 px (WCAG 1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 700 } });
  for (const path of pages) {
    test(`${path || 'home'}: no horizontal page scroll`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});
