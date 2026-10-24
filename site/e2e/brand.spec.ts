import { expect, test, type Page } from '@playwright/test';

/**
 * The only look: data-brand="ci" is in the HTML. A query or a stored choice cannot change it.
 * Fonts are self-hosted. The signature rules (signal, square corners, numbered sections, dark footer)
 * apply on a normal URL.
 */

const brand = (page: Page) => page.locator('html').getAttribute('data-brand');
const css = (page: Page, selector: string, prop: string, pseudo?: string) =>
  page.evaluate(
    ([s, p, ps]) => getComputedStyle(document.querySelector(s!)!, ps || null).getPropertyValue(p!),
    [selector, prop, pseudo ?? ''] as const,
  );
const SIGNAL = 'rgb(255, 90, 31)';

test.describe('the look is fixed', () => {
  test('the page is ci, in the HTML itself, in Schibsted Grotesk', async ({ page }) => {
    await page.goto('');
    expect(await brand(page)).toBe('ci');
    expect(await css(page, 'body', 'font-family')).toContain('Schibsted Grotesk');
    await expect(page.getByRole('group', { name: 'Apparence' })).toHaveCount(0);
    expect(await page.content()).not.toContain('Call Intelligence');
  });

  test('a stored or queried alternate look does not apply', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('epjn-brand', 'editorial'));
    await page.goto('?brand=editorial');
    expect(await brand(page)).toBe('ci');
    await page.goto('?brand=neon');
    expect(await brand(page)).toBe('ci');
    expect(await css(page, 'h1', 'font-family')).toContain('Schibsted Grotesk');
  });

  test('styleguide does not name an alternate look', async ({ page }) => {
    await page.goto('styleguide/');
    const html = await page.content();
    expect(html).not.toContain('Call Intelligence');
    expect(html).not.toContain('Éditorial');
    await expect(page.getByRole('group', { name: 'Apparence' })).toHaveCount(0);
  });
});

test.describe('fonts: self-hosted, only the families in use', () => {
  async function fontRequests(page: Page, url: string) {
    const fonts: string[] = [];
    page.on('response', (res) => {
      if (/\.woff2?(\?|$)/.test(res.url())) fonts.push(res.url());
    });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    return fonts;
  }

  test('downloads Schibsted Grotesk and JetBrains Mono, not Fraunces or Inter', async ({
    page,
    baseURL,
  }) => {
    const fonts = await fontRequests(page, '');
    for (const f of fonts) expect(f.startsWith(new URL(baseURL!).origin)).toBe(true);
    expect(fonts.some((f) => /schibsted-grotesk/i.test(f))).toBe(true);
    expect(fonts.some((f) => /jetbrains-mono/i.test(f))).toBe(true);
    expect(fonts.filter((f) => /fraunces|inter-latin/i.test(f))).toEqual([]);
  });

  test('renders the narrow no-break space (U+202F) of French numbers', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const probe = (font: string, text: string) => {
        const s = document.createElement('span');
        s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${font}`;
        s.textContent = text;
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return w;
      };
      const out: Record<string, number> = {};
      for (const [name, font] of [
        ['sans', '400 20px var(--ff-sans)'],
        ['mono', '500 20px var(--ff-mono)'],
      ] as const) {
        out[`${name}-plain`] = probe(font, '1234');
        out[`${name}-nnbsp`] = probe(font, '1 234');
        out[`${name}-space`] = probe(font, '1 234');
      }
      return out;
    });
    for (const k of ['sans', 'mono']) {
      expect(m[`${k}-nnbsp`]!).toBeGreaterThan(m[`${k}-plain`]!);
      expect(m[`${k}-nnbsp`]!).toBeLessThan(m[`${k}-space`]!);
    }
  });
});

test.describe('signature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.waitForLoadState('networkidle');
  });

  test('type: Schibsted Grotesk for text and titles, JetBrains Mono for labels', async ({
    page,
  }) => {
    expect(await css(page, 'body', 'font-family')).toContain('Schibsted Grotesk');
    expect(await css(page, 'h1', 'font-family')).toContain('Schibsted Grotesk');
    expect(await css(page, 'h1', 'font-weight')).toBe('700');
    expect(await css(page, '.eyebrow', 'font-family')).toContain('JetBrains Mono');
    expect(await css(page, '.eyebrow', 'text-transform')).toBe('uppercase');
  });

  test('shape: square by default, 4 px cards and buttons, no shadow, no gradient', async ({
    page,
  }) => {
    expect(await css(page, '.card', 'border-top-left-radius')).toBe('4px');
    expect(await css(page, '.btn', 'border-top-left-radius')).toBe('4px');
    expect(await css(page, '.btn-primary', 'box-shadow')).toBe('none');
    expect(await css(page, '.card', 'box-shadow')).toBe('none');
    expect(await css(page, '.btn-primary', 'background-image')).toBe('none');
  });

  test('the primary action is the signal, with ink text', async ({ page }) => {
    expect(await css(page, '.btn-primary', 'background-color')).toBe(SIGNAL);
    expect(await css(page, '.btn-primary', 'color')).toBe('rgb(18, 22, 20)');
  });

  test('sections are numbered with a mono label that stays out of the heading’s name', async ({
    page,
  }) => {
    const h2 = page.locator('main h2:not(.sr-only)').first();
    await expect(h2).toBeVisible();
    const before = await h2.evaluate((el) => {
      const cs = getComputedStyle(el, '::before');
      return { counter: cs.counterIncrement, display: cs.display, mono: cs.fontFamily };
    });
    expect(before.counter).toBe('ci-section 1');
    expect(before.display).toBe('block');
    expect(before.mono).toContain('JetBrains Mono');
    const name = (await h2.textContent())!.trim();
    await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
  });

  test('footer is the dark scene, in both colour schemes', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const bg = await css(page, '.brand-footer', 'background-color');
      expect(bg).toBe(scheme === 'light' ? 'rgb(18, 22, 20)' : 'rgb(38, 44, 41)');
      expect(await css(page, '.brand-footer p', 'color')).not.toBe('rgb(18, 22, 20)');
    }
  });

  test('the key figure of a view is the one signal-filled number (landing page)', async ({
    page,
  }) => {
    const fig = page.locator('[data-key-figure]:visible');
    await expect(fig).toHaveCount(1);
    expect(await fig.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(SIGNAL);
    expect(await fig.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(18, 22, 20)');
  });

  test('form steps read « 01 — VOTRE FOYER »', async ({ page }) => {
    await page.goto('simulateur/');
    await page.waitForLoadState('networkidle');
    const num = page.locator('[data-step="foyer"] .step-num');
    await expect(num).toBeVisible();
    expect(await num.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('"0"');
    expect(await css(page, '[data-step="foyer"] .step-title', 'text-transform')).toBe('uppercase');
  });

  test('« annoncé » is hatched in signal, at 45°, and still dashed (never colour alone)', async ({
    page,
  }) => {
    const tile = page.locator('[data-tier="announced"].hatch').first();
    await expect(tile).toBeVisible();
    const img = await tile.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(img).toContain('repeating-linear-gradient');
    expect(img).toContain('255, 90, 31');
    expect(await tile.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('dashed');
  });

  test('the dark theme keeps the look: ink ground, ink-soft cards, paper text', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await css(page, 'body', 'background-color')).toBe('rgb(18, 22, 20)');
    expect(await css(page, 'body', 'color')).toBe('rgb(243, 241, 234)');
    expect(await css(page, 'main .card', 'background-color')).toBe('rgb(38, 44, 41)');
  });
});
