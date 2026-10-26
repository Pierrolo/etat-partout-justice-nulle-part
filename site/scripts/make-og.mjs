/**
 * Generates public/og-default.png (1200×630) — the social-share image — in the shipped look
 * (paper / ink / signal, Schibsted Grotesk) from the self-hosted fonts.
 * Run: pnpm --filter @epjn/site og   (needs Chromium, see playwright.config.ts)
 */
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = new URL('..', import.meta.url).pathname;
const fonts = join(root, 'node_modules/@fontsource/schibsted-grotesk/files');
const font = (weight) =>
  pathToFileURL(join(fonts, `schibsted-grotesk-latin-${weight}-normal.woff2`)).href;

// Colours of brand-ci.css: paper #f3f1ea, ink #121614, muted #5c635f, signal #ff5a1f.
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:G;src:url(${font(400)});font-weight:400}
@font-face{font-family:G;src:url(${font(600)});font-weight:600}
@font-face{font-family:G;src:url(${font(700)});font-weight:700}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f3f1ea;color:#121614;font-family:G,sans-serif;position:relative;overflow:hidden}
.bar{position:absolute;inset:0 auto 0 0;width:18px;background:#ff5a1f}
.wrap{position:absolute;inset:0;padding:64px 84px 56px 96px;display:flex;flex-direction:column;justify-content:space-between}
.brand{display:flex;align-items:center;gap:18px;font:600 34px/1 G,sans-serif;letter-spacing:-.015em}
h1{font:700 86px/0.98 G,sans-serif;letter-spacing:-.03em;max-width:980px}
p.sub{font:400 30px/1.35 G,sans-serif;color:#323935;margin-top:24px;max-width:900px}
.foot{font:400 23px/1.3 G,sans-serif;color:#5c635f}
</style>
<div class="bar"></div>
<div class="wrap">
  <div class="brand"><svg width="48" height="48" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12.75" fill="none" stroke="#121614" stroke-width="2.5"/><circle cx="16" cy="16" r="4.25" fill="#ff5a1f"/></svg>Et moi, dans tout ça ?</div>
  <div><h1>Ce que le plan changerait pour votre foyer.</h1>
  <p class="sub">Un simulateur et un tableau de bord pour comprendre le plan : chaque chiffre est relié à sa source.</p></div>
  <div class="foot">Outil indépendant de l’association Résolution et de l’État. Sans cookie, sans traceur.</div>
</div>`;

const dir = mkdtempSync(join(tmpdir(), 'epjn-og-'));
const file = join(dir, 'og.html');
writeFileSync(file, html);

const sandbox = '/opt/pw-browsers/chromium';
const executablePath = process.env.PW_CHROMIUM_PATH ?? (existsSync(sandbox) ? sandbox : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(file).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'public/og-default.png') });
await browser.close();
console.log('wrote public/og-default.png');
