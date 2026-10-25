/**
 * Generates public/og-default.png (1200×630) — the social-share image — from the design tokens and
 * the self-hosted fonts. Run: pnpm --filter @epjn/site og   (needs Chromium, see playwright.config.ts)
 */
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = new URL('..', import.meta.url).pathname;
const fonts = join(root, 'node_modules/@fontsource-variable');
const fraunces = pathToFileURL(join(fonts, 'fraunces/files/fraunces-latin-opsz-normal.woff2')).href;
const inter = pathToFileURL(join(fonts, 'inter/files/inter-latin-wght-normal.woff2')).href;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:F;src:url(${fraunces});font-weight:100 900}
@font-face{font-family:I;src:url(${inter});font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#faf8f4;color:#15171c;font-family:I,sans-serif;position:relative;overflow:hidden}
.bar{position:absolute;inset:0 auto 0 0;width:18px;background:#602e9d}
.wrap{position:absolute;inset:0;padding:64px 84px 56px 96px;display:flex;flex-direction:column;justify-content:space-between}
.brand{display:flex;align-items:center;gap:18px;font:500 34px/1 F,serif;letter-spacing:-.01em}
h1{font:500 86px/1.02 F,serif;letter-spacing:-.03em;max-width:980px}
p.sub{font:400 30px/1.35 I,sans-serif;color:#434852;margin-top:24px;max-width:900px}
.foot{font-size:23px;color:#5c616c}
</style>
<div class="bar"></div>
<div class="wrap">
  <div class="brand"><svg width="48" height="48" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12.75" fill="none" stroke="#602e9d" stroke-width="2.5"/><circle cx="16" cy="16" r="4.25" fill="#602e9d"/></svg>Et moi, dans tout ça ?</div>
  <div><h1>Ce que le plan changerait pour votre foyer.</h1>
  <p class="sub">Simulateur et tableau de bord indépendants, pour comprendre le livre « État partout, justice nulle part ».</p></div>
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
