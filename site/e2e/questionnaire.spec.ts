import { expect, test } from '@playwright/test';

// The questionnaire is a React island: wait for it to hydrate before interacting.
async function open(page: import('@playwright/test').Page) {
  await page.goto('questionnaire/');
  await page.waitForLoadState('networkidle');
}

test('a guess on the security share reveals the sourced figure', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('où va l’argent public');
  const slider = page.getByRole('slider');
  await slider.fill('40');
  await expect(page.getByText(/Votre estimation[\s\u202f]*:\s*40/)).toBeVisible();
  await page.getByRole('button', { name: 'Révéler la réponse' }).click();
  await expect(
    page.getByTestId('questionnaire').getByText(/Le calcul[\s\u00a0\u202f]*:[\s\u00a0\u202f]*6,4/),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('questionnaire')
      .getByText(/6,4\s*%/)
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('questionnaire')
      .getByText(/fois plus/)
      .first(),
  ).toBeVisible();
});

async function answerCurrent(page: import('@playwright/test').Page) {
  const slider = page.getByRole('slider');
  if (await slider.count()) {
    const step = Number(await slider.getAttribute('step')) || 1;
    const max = Number(await slider.getAttribute('max')) || 100;
    const min = Number(await slider.getAttribute('min')) || 0;
    const mid = min + Math.round((max - min) / 2 / step) * step;
    await slider.fill(String(Math.min(max, Math.max(min, mid))));
  }
  const radio = page.getByRole('radio').first();
  if ((await slider.count()) === 0 && (await radio.count())) await radio.check({ force: true });
  await page.getByRole('button', { name: 'Révéler la réponse' }).click();
}

/** Answer questions in order until the one with this id is on screen. */
async function goTo(page: import('@playwright/test').Page, id: string) {
  for (let i = 0; i < 24; i++) {
    if (await page.locator(`[data-testid="questionnaire"][data-question="${id}"]`).count()) return;
    await answerCurrent(page);
    await page.getByRole('button', { name: 'Question suivante' }).click();
  }
  throw new Error(`question ${id} not reached`);
}

test('the lede says what the page is, and that nothing is stored', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lede')).toContainText('Mesure, amendement ou annonce du plan');
  await expect(page.locator('.lede')).toContainText('Rien n’est enregistré');
});

test('a figure that only the plan gives is asked and answered as the plan’s, with the « Annoncé » treatment', async ({
  page,
}) => {
  await open(page);
  await goTo(page, 'impots');
  const q = page.getByTestId('questionnaire');
  await expect(q.getByRole('heading', { level: 2 })).toContainText(
    'Selon le décompte du plan, combien d’impôts différents existe-t-il',
  );
  await expect(q.locator('[data-tier="announced"]').first()).toBeVisible();
  await answerCurrent(page);
  await expect(q.getByText(/Le décompte du plan/).first()).toBeVisible();
  await expect(q.locator('p.hatch')).toContainText('438');
  // the 4 vs 5 impôts conflict is shown, with its source
  await expect(q).toContainText('Les sources ne nomment pas le cinquième');
  await expect(q).toContainText('Quatre impôts ou cinq');
  await expect(q.getByText('Lettres aux élus, cinq impôts')).toBeVisible();
});

test('the exit indemnity cites its own amendment (n° 26) and the closed jobs another (n° 24)', async ({
  page,
}) => {
  await open(page);
  await goTo(page, 'indemnite');
  await answerCurrent(page);
  const q = page.getByTestId('questionnaire');
  await expect(q).toContainText('Un autre amendement (PLF-P2 n° 24)');
  await expect(q).toContainText('PLF-P2 n° 26');
  await expect(q).toContainText('deux amendements');
  await expect(q).not.toContainText('Le même texte');
});

test('the 77 % answer says how it differs from the simulator’s default (H2)', async ({ page }) => {
  await open(page);
  await goTo(page, 'reste');
  await answerCurrent(page);
  const q = page.getByTestId('questionnaire');
  await expect(q).toContainText('hypothèse H2');
  await expect(q.getByRole('link', { name: /Hypothèse H2/ })).toHaveAttribute(
    'href',
    /methode\/#h2$/,
  );
});

test('« Modifier » puts the focus back on the field', async ({ page }) => {
  await open(page);
  await page.getByRole('slider').fill('40');
  await page.getByRole('button', { name: 'Révéler la réponse' }).click();
  await page.getByRole('button', { name: 'Modifier' }).click();
  await expect(page.getByRole('slider')).toBeFocused();
  await expect(page.getByRole('slider')).toBeEnabled();
});

test('the rank question shows the table, not a world record', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 24; i++) {
    if (await page.getByText('Oui, elle est première').count()) break;
    await answerCurrent(page);
    await page.getByRole('button', { name: 'Question suivante' }).click();
  }
  await page.getByText('Oui, elle est première').click();
  await page.getByRole('button', { name: 'Révéler la réponse' }).click();
  await expect(page.getByText('La table donne un autre rang.')).toBeVisible();
  await expect(
    page
      .getByTestId('questionnaire')
      .getByText(/Finlande/)
      .first(),
  ).toBeVisible();
});

test('the closing summary keeps the guesses', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 24; i++) {
    const next = page.getByRole('button', { name: 'Question suivante' });
    const bilan = page.getByRole('button', { name: 'Voir le bilan' });
    if (await page.getByRole('button', { name: 'Révéler la réponse' }).count()) {
      await answerCurrent(page);
    }
    if (await bilan.count()) {
      await bilan.click();
      break;
    }
    await next.click();
  }
  await expect(page.getByTestId('questionnaire-bilan')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Où vous en étiez' })).toBeVisible();
  const bilan = page.getByTestId('questionnaire-bilan');
  await expect(bilan.getByText(/proche(s)? de la référence/).first()).toBeVisible();
  // one stated rule, whose figure it is, and a source next to every figure
  await expect(bilan).toContainText('à 10 % près de la référence');
  await expect(bilan).toContainText('Chaque chiffre est relié à sa source ci-dessous');
  await expect(bilan).toContainText('Le chiffre du plan');
  expect(await bilan.innerText()).not.toMatch(/La table\s*:/);
  expect(await bilan.getByText('Sources', { exact: false }).count()).toBeGreaterThanOrEqual(19);
  await expect(bilan.locator('[data-tier="announced"]').first()).toBeVisible();
});

test('the answers are in the page without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('questionnaire/');
  const html = await page.content();
  expect(html).toContain('Réponse\u202f:');
  expect(html).toContain('Finlande');
  // every answer carries its sources, as links
  expect(html).toContain('Sources');
  expect(html).toContain('href="https://france-resolution.fr/');
  expect(html).toContain('Eurostat');
  expect(html).not.toContain('Call Intelligence');
});
