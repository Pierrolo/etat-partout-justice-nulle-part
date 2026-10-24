import type { Page } from '@playwright/test';

/** Scrolls the whole page so every `client:visible` island mounts, then waits for the network to settle. */
export async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(60);
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Opens every <details> so that its text counts as rendered text. */
export async function openAllDetails(page: Page): Promise<void> {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
}
