import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4321);
// Same BASE_PATH as the build under test ("/" locally, "/etat-partout-justice-nulle-part/" on Pages).
const base = (process.env.BASE_PATH ?? '/').replace(/^\/?/, '/').replace(/\/?$/, '/');
// Trailing slash matters: tests call page.goto('simulateur/') relative to this URL.
const baseURL = `http://127.0.0.1:${PORT}${base}`;

/**
 * Browser: CI installs Chromium with `playwright install`. In the sandbox a Chromium is pre-installed;
 * if Playwright cannot find its own revision, point PW_CHROMIUM_PATH (or this default) at it.
 */
const sandboxChromium = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (process.env.CI || process.env.PW_USE_BUNDLED
    ? undefined
    : existsSync(sandboxChromium)
      ? sandboxChromium
      : undefined);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  // Serves the production build (`pnpm build` first). Static: astro preview just serves dist/.
  webServer: {
    command: `pnpm exec astro preview --host 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
