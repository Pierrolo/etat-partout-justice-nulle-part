import { expect, test, type Page } from '@playwright/test';

/**
 * The brand layer: « Éditorial » (default) and « Call Intelligence » (`data-brand="ci"`).
 * Selection (URL, storage, control), no flash, self-hosted fonts loaded only for the brand in use,
 * and the signature rules of the brand. The a11y / contrast sweep of every page under both brands
 * lives in smoke.spec.ts.
 *
 * These tests assume the default build (`PUBLIC_BRAND` unset → « editorial »).
 */

const brand = (page: Page) => page.locator('html').getAttribute('data-brand');
const css = (page: Page, selector: string, prop: string, pseudo?: string) =>
  page.evaluate(
    ([s, p, ps]) => getComputedStyle(document.querySelector(s!)!, ps || null).getPropertyValue(p!),
    [selector, prop, pseudo ?? ''] as const,
  );
const SIGNAL = 'rgb(255, 90, 31)';

test.describe('selection', () => {
  test('the default brand is « editorial », written in the HTML itself', async ({ page }) => {
    await page.goto('');
    expect(await brand(page)).toBe('editorial');
    expect(await css(page, 'body', 'font-family')).toContain('Inter Variable');
  });

  test('?brand=ci wins, is remembered, and an unknown value is ignored', async ({ page }) => {
    await page.goto('?brand=ci');
    expect(await brand(page)).toBe('ci');
    // remembered: another page, no parameter
    await page.goto('methode/');
    expect(await brand(page)).toBe('ci');
    await page.reload();
    expect(await brand(page)).toBe('ci');
    // nonsense changes nothing
    await page.goto('?brand=neon');
    expect(await brand(page)).toBe('ci');
    // the URL beats the saved choice
    await page.goto('?brand=editorial');
    expect(await brand(page)).toBe('editorial');
    await page.goto('a-propos/');
    expect(await brand(page)).toBe('editorial');
  });

  test('the brand is applied before first paint (no flash)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('epjn-brand', 'ci'));
    // sample the attribute as early as a script can: at DOMContentLoaded it is already « ci »
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive')
          (window as unknown as { __brandAtInteractive: string }).__brandAtInteractive =
            document.documentElement.dataset.brand ?? '';
      });
    });
    await page.goto('');
    const seen = await page.evaluate(
      () => (window as unknown as { __brandAtInteractive: string }).__brandAtInteractive,
    );
    expect(seen).toBe('ci');
    expect(await css(page, 'html', 'background-color')).toBe('rgb(243, 241, 234)'); // paper
  });

  test('a blocked localStorage never breaks the page: the URL and the control still work', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('storage blocked');
        },
      });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('?brand=ci');
    expect(await brand(page)).toBe('ci');
    await page.getByRole('group', { name: 'Apparence' }).first().scrollIntoViewIfNeeded();
    await page.getByRole('radio', { name: 'Éditorial' }).first().check({ force: true });
    expect(await brand(page)).toBe('editorial');
    expect(errors).toEqual([]);
  });
});

test.describe('« Apparence » control', () => {
  test('is a labelled radio group in the footer, switches live and survives a reload', async ({
    page,
  }) => {
    await page.goto('');
    const group = page.getByRole('contentinfo').getByRole('group', { name: 'Apparence' });
    await expect(group).toBeVisible();
    const editorial = group.getByRole('radio', { name: 'Éditorial' });
    const ci = group.getByRole('radio', { name: 'Call Intelligence' });
    await expect(editorial).toBeChecked();
    await expect(ci).not.toBeChecked();

    await ci.check({ force: true }); // the real input is visually hidden: its label is what people click
    expect(await brand(page)).toBe('ci');
    await expect(ci).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('epjn-brand'))).toBe('ci');
    await page.reload();
    expect(await brand(page)).toBe('ci');
    await expect(ci).toBeChecked();
  });

  test('is usable with the keyboard (arrow keys inside the group)', async ({ page }) => {
    await page.goto('');
    const group = page.getByRole('contentinfo').getByRole('group', { name: 'Apparence' });
    const editorial = group.getByRole('radio', { name: 'Éditorial' });
    await editorial.focus();
    await page.keyboard.press('ArrowRight');
    expect(await brand(page)).toBe('ci');
    await page.keyboard.press('ArrowLeft');
    expect(await brand(page)).toBe('editorial');
  });

  test('also lives on /styleguide, and the two controls stay in step', async ({ page }) => {
    await page.goto('styleguide/');
    const groups = page.getByRole('group', { name: 'Apparence' });
    await expect(groups).toHaveCount(2); // the guide's own + the footer's
    await groups.first().getByRole('radio', { name: 'Call Intelligence' }).check({ force: true });
    expect(await brand(page)).toBe('ci');
    await expect(groups.last().getByRole('radio', { name: 'Call Intelligence' })).toBeChecked();
  });

  test('keeps a ?brand= in the address bar consistent with the choice', async ({ page }) => {
    await page.goto('?brand=ci');
    await page
      .getByRole('contentinfo')
      .getByRole('radio', { name: 'Éditorial' })
      .check({ force: true });
    expect(new URL(page.url()).searchParams.get('brand')).toBe('editorial');
  });
});

test.describe('fonts: self-hosted, loaded only for the brand in use', () => {
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

  test('« Éditorial » never downloads the Call Intelligence fonts', async ({ page, baseURL }) => {
    const fonts = await fontRequests(page, '?brand=editorial');
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) expect(f.startsWith(new URL(baseURL!).origin)).toBe(true);
    expect(fonts.filter((f) => /schibsted|jetbrains/i.test(f))).toEqual([]);
  });

  test('« Call Intelligence » downloads Schibsted Grotesk + JetBrains Mono, and not Fraunces / Inter', async ({
    page,
    baseURL,
  }) => {
    const fonts = await fontRequests(page, '?brand=ci');
    for (const f of fonts) expect(f.startsWith(new URL(baseURL!).origin)).toBe(true);
    expect(fonts.some((f) => /schibsted-grotesk/i.test(f))).toBe(true);
    expect(fonts.some((f) => /jetbrains-mono/i.test(f))).toBe(true);
    expect(fonts.filter((f) => /fraunces|inter-latin/i.test(f))).toEqual([]);
  });

  test('« Call Intelligence » renders the narrow no-break space (U+202F) of French numbers', async ({
    page,
  }) => {
    await page.goto('?brand=ci');
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
      expect(m[`${k}-nnbsp`]!).toBeGreaterThan(m[`${k}-plain`]!); // the glyph exists and has a width…
      expect(m[`${k}-nnbsp`]!).toBeLessThan(m[`${k}-space`]!); // …narrower than a regular space
    }
  });
});

test.describe('« Call Intelligence » signature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('?brand=ci');
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
    await page.goto('simulateur/?brand=ci');
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

  test('the dark theme keeps the brand: ink ground, ink-soft cards, paper text', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await css(page, 'body', 'background-color')).toBe('rgb(18, 22, 20)');
    expect(await css(page, 'body', 'color')).toBe('rgb(243, 241, 234)');
    expect(await css(page, 'main .card', 'background-color')).toBe('rgb(38, 44, 41)');
  });

  test('« Éditorial » is untouched by all of this', async ({ page }) => {
    await page.goto('?brand=editorial');
    expect(await css(page, '.btn-primary', 'background-color')).not.toBe(SIGNAL);
    expect(await css(page, '.card', 'border-top-left-radius')).toBe('14px');
    expect(await css(page, 'h1', 'font-family')).toContain('Fraunces');
    const content = await page
      .locator('main h2:not(.sr-only)')
      .first()
      .evaluate((el) => getComputedStyle(el, '::before').content);
    expect(content).toBe('none');
  });
});
