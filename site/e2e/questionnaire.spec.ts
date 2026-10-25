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
  await expect(page.getByTestId('questionnaire').getByText(/Le calcul/)).toBeVisible();
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
  await expect(page.getByTestId('questionnaire-bilan').getByText(/proche(s)? de la référence/)).toBeVisible();
});

test('the answers are in the page without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('questionnaire/');
  const html = await page.content();
  expect(html).toContain('Réponse\u202f:');
  expect(html).toContain('Finlande');
  expect(html).not.toContain('Call Intelligence');
});
