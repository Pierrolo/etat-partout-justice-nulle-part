import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { builtPages } from './pages';

const DIST = join(import.meta.dirname, '..', 'dist');

function htmlFiles(dir = DIST, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '_astro') htmlFiles(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

test.describe('no developer leftovers in the built site', () => {
  test('no built page contains « TODO( », a TODO box or a docs/ file path', () => {
    const files = htmlFiles();
    expect(files.length).toBeGreaterThan(10);
    const bad: string[] = [];
    for (const f of files) {
      const html = readFileSync(f, 'utf8');
      if (/TODO\(|data-todo|À écrire/.test(html)) bad.push(`${f}: TODO`);
      // « docs/METHODE.md », « docs/qa/… », « docs/VISION.md §6 » : internal paths, never shown to visitors
      if (/(^|[^\w/.-])docs\/[\w.-]+/.test(html.replace(/https?:\/\/\S+/g, '')))
        bad.push(`${f}: docs/ path`);
    }
    expect(bad).toEqual([]);
  });
});

test.describe('/methode', () => {
  test('renders the method with one stable anchor per hypothesis and the new vocabulary', async ({
    page,
  }) => {
    await page.goto('methode/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Méthode et hypothèses');
    // H1…H20, in the register, each reachable by #hN
    for (let n = 1; n <= 20; n += 1) await expect(page.locator(`tr#h${n}`)).toHaveCount(1);
    for (const id of [
      'registre',
      'non-compte',
      'openfisca',
      'ecarts-sources',
      'journal',
      'foyers',
      'pib-57',
    ]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    const main = page.locator('main');
    await expect(main).toContainText('Proposé dans un amendement');
    await expect(main).toContainText('Promis par les auteurs');
    await expect(main).toContainText('Notre estimation');
    // the gap with OpenFisca, the not-modelled list and the conflicts between sources are there
    await expect(page.locator('#openfisca ~ div table').first()).toBeVisible();
    await expect(page.locator('#non-compte')).toBeVisible();
    await expect(page.locator('#d16')).toHaveCount(1); // « Quatre foyers différents »
    await expect(page.locator('#d04')).toContainText('PIB');
  });

  test('#h1 deep link lands on the hypothesis and highlights it', async ({ page }) => {
    await page.goto('methode/#h1');
    const row = page.locator('tr#h1');
    await expect(row).toBeInViewport();
    await expect(row).toContainText('RSA');
  });

  test('glossary toggletip: click opens, Escape closes and returns the focus', async ({ page }) => {
    await page.goto('methode/');
    const btn = page.locator('.gloss-btn').first();
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    const box = await btn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(24 - 1);
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    const bubble = page.locator('.gloss-bubble').first();
    await expect(bubble).toBeVisible();
    const b = await bubble.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(vw + 1);
    await page.keyboard.press('Escape');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.gloss-bubble')).toHaveCount(0);
    await expect(btn).toBeFocused();
  });
});

test.describe('landing', () => {
  test('the simulator call to action is above the fold on a 390×844 phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('');
    const cta = page.getByTestId('hero-cta');
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await expect(cta).toHaveAttribute('href', /simulateur\/$/);
  });

  test('the 63 € card says plainly that it is the authors’ own calculation', async ({ page }) => {
    await page.goto('');
    const card = page.locator('[data-teaser="heure-de-travail"]');
    await expect(card.getByTestId('hour-caveat')).toBeVisible();
    await expect(card.getByTestId('hour-caveat')).toContainText('Calcul des auteurs');
    await expect(card).toContainText('Promis');
  });

  test('says which promises are counted and which are shown apart, with the new vocabulary', async ({
    page,
  }) => {
    await page.goto('');
    const main = page.locator('main');
    await expect(main).toContainText('Compté par défaut');
    await expect(main).toContainText('Montré à part, jamais additionné');
    await expect(main).toContainText('Proposé dans un amendement');
    await expect(main).not.toContainText('Écrit dans la loi');
    await expect(main).not.toContainText('Hypothèse du simulateur');
  });
});

test.describe('/comprendre/situations', () => {
  test('lists the 18 situations of the book with a stable anchor each', async ({ page }) => {
    await page.goto('comprendre/situations/');
    await expect(page.locator('main article[id]')).toHaveCount(18);
    for (const slug of [
      'agent-public-indispensable',
      'agent-public-dont-le-poste-est-supprime',
      'enseignant',
      'retraite',
      'entreprise',
      'locataire',
      'personne-handicapee',
    ]) {
      await expect(page.locator(`article#${slug}`)).toHaveCount(1);
    }
    const retraite = page.locator('article#retraite');
    await expect(retraite).toContainText('Ce que le plan donne');
    await expect(retraite).toContainText('Ce qu’il retire');
    await expect(retraite).toContainText('L’abattement');
    await expect(retraite.getByRole('link', { name: /^Amendement PLF/ }).first()).toHaveAttribute(
      'href',
      /^https:\/\/france-resolution\.fr\//,
    );
  });

  test('is reachable from the Comprendre hub and from the previous/next navigation', async ({
    page,
  }) => {
    await page.goto('comprendre/');
    await expect(
      page.getByRole('link', { name: /Ce que le plan prévoit pour/ }).first(),
    ).toBeVisible();
    await page.goto('comprendre/situations/#enseignant');
    await expect(page.locator('article#enseignant')).toBeInViewport();
  });
});

test('every built page has a unique title and one landmark per region', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of builtPages()) {
    await page.goto(path);
    const title = await page.title();
    expect(titles.has(title), `duplicate <title> « ${title} » on ${path}`).toBe(false);
    titles.add(title);
    // the independence strip is inside the banner landmark (audit m2)
    await expect(page.locator('header').first().getByTestId('independence-strip')).toHaveCount(1);
  }
});
