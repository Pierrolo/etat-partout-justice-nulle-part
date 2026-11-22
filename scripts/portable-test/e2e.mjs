#!/usr/bin/env node
/**
 * Playwright test of the PORTABLE copy (scripts/make-portable.mjs), served by ./server.mjs under a deep random prefix,
 * with no directory resolution and a strict CSP.
 *
 *   node scripts/portable-test/e2e.mjs [--portable <dir>] [--site <dir>] [--prefix /p/abc/] [--headed]
 *
 *   --portable  folder holding the launcher `index.html` (fragment) and `site/` (default: the scratchpad `portable/`)
 *   --site      serve this folder as `site/` instead (negative control: pass site/dist and watch the test fail)
 *
 * What it checks
 *   crawl      every page + every internal link (a, link, script, img, source, iframe, use, fetch/xhr/css resources of the
 *              Performance API): status < 400, no directory URL, nothing outside the prefix; every React island hydrates;
 *              fragment links point to an id that exists on the target page.
 *   global     0 responses >= 400, 0 console errors / uncaught exceptions, 0 CSP violations, 0 requests outside the prefix
 *              (browser side AND server side), 0 failed requests.
 *   interact   simulator (fill, result, copy link, reopen state, lazy sections, #h1 deep link), niches (search + niches.json),
 *              questionnaire, hub predict-then-reveal, glossary toggletips (Astro + React variants), theme toggle,
 *              methode TOC anchors, launcher (JS redirect + JS-off fallback link).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { CSP, startServer } from './server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));

/* ── args ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i === -1 ? d : argv[i + 1];
};
const portableDir = path.resolve(
  arg('--portable', '/tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/portable'),
);
const siteOverride = arg('--site') ? path.resolve(arg('--site')) : undefined;
const siteDirOnDisk = siteOverride ?? path.join(portableDir, 'site');

/* ── harness ──────────────────────────────────────────────────────────────────────────────────────────────────── */
const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}  (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: e });
    console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').slice(0, 6).join('\n        ')}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uniq = (a) => [...new Set(a)];

const server = await startServer({ portableDir, siteDir: siteOverride, prefix: arg('--prefix') });
const { origin, prefix, baseUrl, siteUrl } = server;
console.log(`serving ${siteDirOnDisk}\n  prefix   ${prefix}\n  launcher ${baseUrl}index.html\n  site     ${siteUrl}index.html\n  CSP      ${CSP}\n`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', colorScheme: 'light' });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });

/* ── global collectors: every phase, every page ───────────────────────────────────────────────────────────────── */
const ev = { requests: [], responses: [], failed: [], console: [], pageErrors: [], csp: [], warnings: 0 };
let phase = 'start';
context.on('request', (r) => ev.requests.push({ phase, url: r.url(), type: r.resourceType() }));
context.on('response', (r) => ev.responses.push({ phase, url: r.url(), status: r.status(), type: r.request().resourceType() }));
context.on('requestfailed', (r) => ev.failed.push({ phase, url: r.url(), why: r.failure()?.errorText }));
context.on('weberror', (e) => ev.pageErrors.push({ phase, text: String(e.error()?.stack ?? e.error()) }));
context.on('console', (m) => {
  if (m.type() === 'error') ev.console.push({ phase, text: m.text(), at: m.location().url });
  else if (m.type() === 'warning') ev.warnings++;
});
await context.exposeFunction('__reportCsp', (d) => ev.csp.push({ phase, ...d }));
await context.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => {
    // @ts-ignore
    window.__reportCsp({ blocked: e.blockedURI, directive: e.violatedDirective, doc: location.href, sample: e.sample });
  });
});

const isUnder = (u) => u.startsWith(baseUrl);
const location_origin = origin;
const isHttp = (u) => /^https?:/i.test(u);

/* ── helpers on pages ─────────────────────────────────────────────────────────────────────────────────────────── */
async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(50);
  }
  await page.waitForLoadState('networkidle');
  await sleep(250);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** All islands must lose their `ssr` attribute (Astro removes it once the island has hydrated). */
async function waitHydrated(page, label) {
  try {
    await page.waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0, null, {
      timeout: Number(process.env.E2E_HYDRATION_TIMEOUT ?? 20_000),
    });
  } catch {
    const left = await page.evaluate(() =>
      [...document.querySelectorAll('astro-island[ssr]')].map((i) => i.getAttribute('component-url')),
    );
    throw new Error(`${label}: ${left.length} island(s) never hydrated: ${left.join(', ')}`);
  }
}

async function harvest(page) {
  return page.evaluate(() => {
    const out = [];
    const abs = (v) => {
      try {
        return new URL(v, document.baseURI).href;
      } catch {
        return null;
      }
    };
    const add = (tag, raw, extra = {}) => {
      if (raw == null || raw === '') return;
      const url = abs(raw);
      if (url) out.push({ tag, raw, url, ...extra });
    };
    document.querySelectorAll('a[href]').forEach((el) =>
      add('a', el.getAttribute('href'), { text: (el.textContent || '').trim().slice(0, 50), visible: !!(el.offsetWidth || el.offsetHeight) }),
    );
    document.querySelectorAll('link[href]').forEach((el) => add(`link[${el.getAttribute('rel')}]`, el.getAttribute('href')));
    document.querySelectorAll('script[src]').forEach((el) => add('script', el.getAttribute('src')));
    document.querySelectorAll('img[src]').forEach((el) => add('img', el.getAttribute('src')));
    document.querySelectorAll('source[src], video[src], audio[src], iframe[src], embed[src]').forEach((el) => add(el.tagName.toLowerCase(), el.getAttribute('src')));
    document.querySelectorAll('[srcset]').forEach((el) =>
      el.getAttribute('srcset').split(',').forEach((c) => add('srcset', c.trim().split(/\s+/)[0])),
    );
    document.querySelectorAll('video[poster]').forEach((el) => add('poster', el.getAttribute('poster')));
    document.querySelectorAll('form[action]').forEach((el) => add('form', el.getAttribute('action')));
    document.querySelectorAll('use, image').forEach((el) => {
      const h = el.getAttribute('href') ?? el.getAttribute('xlink:href');
      if (h && !h.startsWith('#')) add(el.tagName.toLowerCase(), h);
    });
    document.querySelectorAll('astro-island').forEach((el) => {
      for (const a of ['component-url', 'renderer-url', 'before-hydration-url']) add(`island[${a}]`, el.getAttribute(a));
    });
    performance.getEntriesByType('resource').forEach((e) => out.push({ tag: `res:${e.initiatorType}`, raw: e.name, url: e.name }));
    return out;
  });
}

/* ── 0. server self-checks (the harness itself must be hostile) ───────────────────────────────────────────────── */
console.log('Harness self-check');
await step('server: directories are 404, no index resolution, nothing outside the prefix, CSP header on every answer', async () => {
  const get = async (u) => fetch(u, { redirect: 'manual' });
  for (const u of [`${siteUrl}`, `${siteUrl}comprendre/`, `${siteUrl}comprendre`, `${siteUrl}_astro/`, `${baseUrl}`, `${origin}/`, `${origin}/simulateur/`]) {
    assert.equal((await get(u)).status, 404, `${u} must be 404`);
  }
  const ok = await get(`${siteUrl}index.html`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-security-policy'), CSP);
  assert.match(ok.headers.get('content-type'), /text\/html/);
  const l = await get(`${baseUrl}index.html`);
  assert.equal(l.status, 200);
  assert.match(await l.text(), /^<!doctype html>/i);
  assert.equal((await get(`${siteUrl}data/niches.json`)).headers.get('content-type').split(';')[0], 'application/json');
});
server.log.length = 0; // the probes above are not part of the run

/* ── 1. launcher ───────────────────────────────────────────────────────────────────────────────────────────────── */
console.log('\nLauncher');
await step('launcher: static checks of the fragment (no html/head/body, title, colours, fallback link)', async () => {
  const frag = fs.readFileSync(path.join(portableDir, 'index.html'), 'utf8');
  assert.ok(!/<\/?(html|head|body)[\s>]/i.test(frag), 'fragment must not contain html/head/body tags');
  assert.match(frag, /<title>Et moi, dans tout ça \?<\/title>/);
  for (const c of ['#f3f1ea', '#121614', '#ff5a1f']) assert.ok(frag.toLowerCase().includes(c), `colour ${c}`);
  assert.match(frag, /prefers-color-scheme:\s*dark/);
  assert.match(frag, /body\s*\{[^}]*background:/);
  assert.match(frag, /Aperçu privé du site — ouverture…/);
  assert.match(frag, /location\.replace\('site\/index\.html'\)/);
  assert.match(frag, /<a href="site\/index\.html">/);
});
await step('launcher (JS on): /p/<id>/index.html redirects to site/index.html and the site boots', async () => {
  phase = 'launcher';
  const page = await context.newPage();
  await page.goto(`${baseUrl}index.html`);
  await page.waitForURL(`${siteUrl}index.html`, { timeout: 10_000 });
  await page.waitForLoadState('load');
  await waitHydrated(page, 'home');
  assert.equal(await page.evaluate(() => window.__EPJN_ROOT__), siteUrl);
  assert.match(await page.title(), /Et moi, dans tout ça/);
  await page.close();
});
await step('launcher (JS off): the fallback link is visible and leads to the site', async () => {
  phase = 'launcher-nojs';
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 640 } });
  ctx.on('response', (r) => ev.responses.push({ phase, url: r.url(), status: r.status(), type: r.request().resourceType() }));
  ctx.on('request', (r) => ev.requests.push({ phase, url: r.url(), type: r.resourceType() }));
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}index.html`);
  assert.match(await page.title(), /Et moi, dans tout ça/);
  assert.match(await page.locator('main').innerText(), /Aperçu privé du site — ouverture…/);
  const link = page.getByRole('link', { name: 'Ouvrir le site' });
  await link.waitFor({ state: 'visible' });
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  assert.ok(noScroll, 'no horizontal scroll at 360 px');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, 'rgb(243, 241, 234)'); // paper
  await link.click();
  await page.waitForURL(`${siteUrl}index.html`);
  assert.ok((await page.locator('h1').count()) > 0);
  await ctx.close();
});
await step('launcher (dark scheme): ink background', async () => {
  const ctx = await browser.newContext({ colorScheme: 'dark', javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}index.html`);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(18, 22, 20)');
  await ctx.close();
});

/* ── 2. crawl ──────────────────────────────────────────────────────────────────────────────────────────────────── */
console.log('\nCrawl');
const diskPages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
    else if (e.name.endsWith('.html')) diskPages.push(path.relative(siteDirOnDisk, path.join(dir, e.name)).split(path.sep).join('/'));
  }
})(siteDirOnDisk);
diskPages.sort();
const diskIslands = new Map(
  diskPages.map((p) => [p, (fs.readFileSync(path.join(siteDirOnDisk, p), 'utf8').match(/<astro-island /g) ?? []).length]),
);

/** url (no hash) → { ids:Set, links:[], islands:number, reactGloss:boolean } */
const pageData = new Map();
const allLinks = []; // {from, tag, raw, url, text}
const stripHash = (u) => u.split('#')[0];

async function crawlPage(url) {
  phase = `crawl ${url.slice(siteUrl.length)}`;
  const page = await context.newPage();
  const resp = await page.goto(url, { waitUntil: 'load' });
  assert.ok(resp && resp.status() < 400, `${url}: status ${resp?.status()}`);
  await scrollThrough(page);
  await waitHydrated(page, url);
  const rootOk = (await page.evaluate(() => window.__EPJN_ROOT__)) === siteUrl;
  const islands = await page.evaluate(() => document.querySelectorAll('astro-island').length);
  const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  const reactGloss = await page.evaluate(() => !!document.querySelector('.gloss-btn:not([data-term])'));
  const links = await harvest(page);
  const stillSsr = await page.evaluate(() => document.querySelectorAll('astro-island[ssr]').length);
  pageData.set(url, { ids: new Set(ids), islands, reactGloss, rootOk, stillSsr, title: await page.title() });
  for (const l of links) allLinks.push({ from: url, ...l });
  await page.close();
  return links;
}

const visited = new Set();
const queue = [`${siteUrl}index.html`];
const crawlErrors = [];
while (queue.length) {
  const url = queue.shift();
  if (visited.has(url)) continue;
  visited.add(url);
  try {
    const links = await crawlPage(url);
    for (const l of links) {
      if (l.tag !== 'a') continue;
      const u = stripHash(l.url);
      if (isUnder(u) && u.endsWith('.html') && !visited.has(u) && !queue.includes(u)) queue.push(u);
    }
  } catch (e) {
    crawlErrors.push(`${url.slice(siteUrl.length)}: ${e.message.split('\n')[0]}`);
  }
}
const reached = [...visited].map((u) => u.slice(siteUrl.length)).sort();
const orphans = diskPages.filter((p) => !visited.has(siteUrl + p));
for (const p of orphans) {
  try {
    visited.add(siteUrl + p);
    await crawlPage(siteUrl + p);
  } catch (e) {
    crawlErrors.push(`${p}: ${e.message.split('\n')[0]}`);
  }
}

await step(`crawl: every page of the folder was loaded (${diskPages.length} pages; ${reached.length} reached by links${orphans.length ? `, orphans visited directly: ${orphans.join(', ')}` : ''})`, async () => {
  assert.deepEqual(crawlErrors, [], crawlErrors.join('\n'));
  const missing = diskPages.filter((p) => !pageData.has(siteUrl + p));
  assert.deepEqual(missing, [], `pages not crawled: ${missing}`);
});

await step('crawl: every page sets __EPJN_ROOT__ to the site root and every React island hydrates', async () => {
  const bad = [];
  let islands = 0;
  for (const [url, d] of pageData) {
    const rel = url.slice(siteUrl.length);
    islands += d.islands;
    if (!d.rootOk) bad.push(`${rel}: __EPJN_ROOT__ wrong`);
    if (d.stillSsr) bad.push(`${rel}: ${d.stillSsr} island(s) still ssr`);
    if (d.islands !== diskIslands.get(rel)) bad.push(`${rel}: ${d.islands} islands in the DOM, ${diskIslands.get(rel)} in the file`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  console.log(`        ${islands} islands hydrated on ${pageData.size} pages`);
  assert.ok(islands > 0);
});

// every island's component/renderer module was really fetched with a 200
await step('crawl: every island module (component-url, renderer-url) answered 200', async () => {
  const modules = uniq(allLinks.filter((l) => l.tag.startsWith('island[')).map((l) => l.url));
  assert.ok(modules.length > 10, `only ${modules.length} island modules`);
  const bad = modules.filter((m) => !ev.responses.some((r) => r.url === m && r.status === 200));
  assert.deepEqual(bad, [], `never fetched with 200: ${bad}`);
  console.log(`        ${modules.length} distinct island modules`);
});

let internalUrls;
await step('crawl: every internal reference (a, link, script, img, source, srcset, use, fetch/css resources) resolves inside the prefix, with a real file name, status < 400', async () => {
  const bad = [];
  internalUrls = new Set();
  const external = new Set();
  for (const l of allLinks) {
    if (!isHttp(l.url)) continue;
    const u = new URL(l.url);
    if (u.origin !== origin) {
      if (l.tag === 'a') external.add(l.url);
      else bad.push(`${l.from.slice(siteUrl.length)} ${l.tag} → external resource ${l.url}`);
      continue;
    }
    if (!isUnder(l.url)) {
      bad.push(`${l.from.slice(siteUrl.length)} ${l.tag} "${l.raw}" → outside the prefix: ${u.pathname}`);
      continue;
    }
    if (u.pathname.endsWith('/') || !path.posix.basename(u.pathname).includes('.')) {
      bad.push(`${l.from.slice(siteUrl.length)} ${l.tag} "${l.raw}" → directory-style URL ${u.pathname}`);
      continue;
    }
    internalUrls.add(stripHash(l.url));
  }
  const statuses = new Map();
  for (const u of internalUrls) {
    const r = await fetch(u);
    statuses.set(u, r.status);
    if (r.status >= 400) bad.push(`${u.slice(siteUrl.length)} → ${r.status}`);
    await r.arrayBuffer();
  }
  console.log(`        ${allLinks.length} references harvested, ${internalUrls.size} distinct internal targets, ${external.size} external <a> (not fetched)`);
  assert.deepEqual(uniq(bad), [], uniq(bad).slice(0, 12).join('\n'));
  // external links must be real https URLs, never a leaked local path
  for (const e of external) assert.match(e, /^https?:\/\/[^/]+\.[a-z]{2,}/i, `weird external link ${e}`);
});

await step('crawl: fragment links land on an existing id of the right page (anchors, #h1, #registre, …)', async () => {
  const bad = [];
  let checked = 0;
  const seen = new Set();
  for (const l of allLinks) {
    if (l.tag !== 'a' || !isUnder(l.url) || !l.url.includes('#')) continue;
    const [target, frag] = [stripHash(l.url), decodeURIComponent(l.url.split('#').slice(1).join('#'))];
    if (frag === '' || /=/.test(frag) || /^v\d+\./.test(frag) || /^d-\d{4}-/.test(frag)) continue; // explorer/simulator state, calendar days
    const key = `${l.from}|${l.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    checked++;
    const d = pageData.get(target);
    if (!d) bad.push(`${l.from.slice(siteUrl.length)}: "${l.raw}" → ${target.slice(siteUrl.length)} was not crawled`);
    else if (!d.ids.has(frag)) bad.push(`${l.from.slice(siteUrl.length)}: "${l.raw}" → no #${frag} on ${target.slice(siteUrl.length)}`);
  }
  console.log(`        ${checked} fragment links checked (pure-state hashes skipped)`);
  assert.ok(checked > 20);
  assert.deepEqual(uniq(bad), [], uniq(bad).slice(0, 12).join('\n'));
});

/* ── 3. interactions ───────────────────────────────────────────────────────────────────────────────────────────── */
console.log('\nInteractions');

const field = (page, key) => page.locator(`[data-field="${key}"]`);
const radio = (scope, name) =>
  scope
    .getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name })
    .locator('xpath=ancestor::label[1]')
    .click();

const FONCT = 'Fonctionnaire (école, hôpital, mairie…)';
const PRIVE = 'Salarié du privé, non-cadre';
const PERSONAS = {
  nadia: {
    couple: 'En couple',
    married: 'Non',
    children: [12],
    adults: [
      { age: 41, status: PRIVE, salary: 1427 },
      { age: 43, status: PRIVE, salary: 1700 },
    ],
    housing: 'Locataire',
    rent: 480,
    zone: 'Zone 2',
  },
  camille: {
    couple: /^Seul/,
    adults: [{ age: 29, status: FONCT, salary: 2050 }],
    housing: 'Locataire',
    rent: 900,
    zone: 'Zone 1',
  },
};

/** Same flow as the site's own e2e (desktop layout: all questions on one screen). */
async function fillHousehold(page, p) {
  await radio(field(page, 'foyer.couple'), p.couple);
  if (p.married) await radio(field(page, 'foyer.married'), p.married);
  for (const age of p.children ?? []) {
    await page.getByRole('button', { name: /^Ajouter (un|un autre) enfant$/ }).click();
    await page.getByLabel(/^Âge de l.enfant \d/).last().fill(String(age));
  }
  for (const [i, a] of p.adults.entries()) {
    await page.locator(`#a${i}-age`).fill(String(a.age));
    await radio(field(page, `adult${i}.activity`), 'En emploi');
    await radio(field(page, `adult${i}.status`), a.status);
    await page.locator(`#a${i}-salary`).fill(String(a.salary));
  }
  await radio(field(page, 'housing.status'), p.housing);
  await page.locator('#rent').fill(String(p.rent));
  await radio(field(page, 'housing.zone'), p.zone);
}
const fillNadia = (page) => fillHousehold(page, PERSONAS.nadia);

/** Locator on the first visible <a> whose RESOLVED url contains `needle` (the href attribute may be relative or absolute). */
async function linkTo(page, needle) {
  const found = await page.evaluate((n) => {
    document.querySelectorAll('[data-pw-target]').forEach((e) => e.removeAttribute('data-pw-target'));
    const a = [...document.querySelectorAll('a[href]')].find((x) => x.href.includes(n) && (x.offsetWidth || x.offsetHeight));
    if (a) a.setAttribute('data-pw-target', '1');
    return !!a;
  }, needle);
  assert.ok(found, `no visible link to ${needle}`);
  return page.locator('[data-pw-target="1"]');
}

let simState; // {url, figure}
await step('simulator: fill one household, see a result, hash carries the state', async () => {
  phase = 'simulator';
  const page = await context.newPage();
  await page.goto(`${siteUrl}simulateur/index.html`);
  await waitHydrated(page, 'simulateur');
  await fillNadia(page);
  const figure = page.getByTestId('headline-figure');
  await figure.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => location.hash.startsWith('#v1.'));
  simState = { url: page.url(), figure: await figure.innerText() };
  assert.ok(simState.url.startsWith(`${siteUrl}simulateur/index.html#v1.`), simState.url);
  assert.match(simState.figure, /\d/);
  await page.close();
});

await step('simulator: « Copier le lien » copies the page URL (inside the prefix) and it reopens the same state', async () => {
  phase = 'simulator-share';
  const page = await context.newPage();
  await page.goto(`${siteUrl}simulateur/index.html`);
  await waitHydrated(page, 'simulateur');
  await fillNadia(page);
  const figure = page.getByTestId('headline-figure');
  await figure.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => location.hash.startsWith('#v1.'));
  await page.locator('#rent').fill('520'); // edit right before copying: the link must carry the CURRENT state
  await page.getByRole('button', { name: /Copier le lien|Partager/ }).first().click();
  await page.getByText('Lien copié').first().waitFor({ state: 'visible', timeout: 5_000 });
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  await sleep(700); // the URL hash is written with a debounce; the copy itself must not wait for it
  assert.equal(copied, page.url(), 'copied link = current URL');
  assert.ok(copied.startsWith(`${siteUrl}simulateur/index.html#v1.`), `copied link: ${copied}`);
  assert.notEqual(copied, simState.url, 'the link reflects the edit (rent 520)');
  const edited = await figure.innerText();

  const fresh = await context.newPage();
  await fresh.goto(copied);
  await fresh.waitForLoadState('networkidle');
  await fresh.getByTestId('headline-hero').waitFor({ state: 'visible', timeout: 15_000 });
  await fresh.getByTestId('recap').waitFor();
  const recap = await fresh.getByTestId('recap').innerText();
  assert.match(recap, /En couple/);
  assert.match(recap, /520/);
  assert.equal(await fresh.getByTestId('headline-figure').innerText(), edited, 'same figure after reopening');
  assert.equal(await fresh.evaluate(() => document.documentElement.getAttribute('data-sim-hash')), null);
  await fresh.close();
  await page.close();
});

await step('simulator: lazy sections load (dynamic imports + preload helper), their links are relative-safe, #h1 deep link lands', async () => {
  phase = 'simulator-layer3';
  const page = await context.newPage();
  await page.goto(`${siteUrl}simulateur/index.html`);
  await waitHydrated(page, 'simulateur');
  await fillNadia(page);
  await page.getByTestId('headline-figure').waitFor({ state: 'visible', timeout: 15_000 });
  const nav = page.getByRole('navigation', { name: /Pour aller plus loin/ });
  const sections = [
    ['heure', 'Votre heure de travail'],
    ['courbe', 'Si je gagnais plus ?'],
    ['transition', /La transition/],
    ['proches', /foyers types proches/],
    ['tableau', /Le tableau avant/],
    ['hypotheses', 'Les hypothèses'],
    ['noncompte', /ne compte pas/],
    ['salaries', /Et pour mes salariés/],
  ];
  for (const [id, label] of sections) {
    await nav.getByRole('button', { name: label }).click();
    await page.waitForFunction(
      (x) => {
        const el = document.getElementById(`plus-${x}`);
        return !!el && el.innerText.length > 150 && !/Chargement…/.test(el.innerText);
      },
      id,
      { timeout: 15_000 },
    );
  }
  await page.getByTestId('hour-sentence').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('img', { name: /Courbes du revenu disponible/ }).waitFor({ state: 'visible', timeout: 10_000 });
  for (const id of ['2027', '2028', '2030', 'steady']) await page.getByTestId(`photo-${id}`).waitFor({ state: 'attached', timeout: 10_000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="nearby-case"]').length === 3, null, { timeout: 10_000 });
  await page.getByRole('switch', { name: /H2/ }).waitFor({ state: 'attached', timeout: 10_000 });
  await page.waitForLoadState('networkidle');

  const preloads = (await harvest(page)).filter((l) => /^link\[(modulepreload|preload|stylesheet)\]$/.test(l.tag));
  assert.ok(preloads.length > 0 && preloads.every((l) => !isHttp(l.url) || isUnder(l.url)), 'preload/stylesheet links stay under the prefix');
  assert.ok(preloads.some((l) => l.tag === 'link[modulepreload]'), 'Vite emitted modulepreload links for the lazy sections');

  // links created at runtime by the JS (withBase wrapper): all inside the prefix, explicit .html, resolvable
  const links = (await harvest(page)).filter((l) => l.tag === 'a' && isUnder(l.url));
  const runtime = links.filter((l) => /^https?:/.test(l.raw)); // absolute raw href = built by JS at runtime
  assert.ok(runtime.length >= 5, `expected several runtime-built links, got ${runtime.length}`);
  const bad = [];
  for (const l of links) {
    const u = new URL(l.url);
    if (u.pathname.endsWith('/') || !path.posix.basename(u.pathname).includes('.')) bad.push(`${l.raw} (${l.text})`);
    else if ((await fetch(stripHash(l.url))).status >= 400) bad.push(`${l.raw} → not 200`);
  }
  assert.deepEqual(uniq(bad), [], uniq(bad).join('\n'));
  for (const want of ['methode/index.html#h1', 'methode/index.html#registre', 'simulateur/cas-types/index.html', 'comprendre/calendrier/index.html']) {
    assert.ok(links.some((l) => l.url.includes(want)), `no runtime link to ${want}`);
  }
  console.log(`        ${links.length} internal links in the live simulator, ${runtime.length} built by JS`);

  // #h1 deep link from the simulator
  const h1 = await linkTo(page, 'methode/index.html#h1');
  await h1.scrollIntoViewIfNeeded();
  await h1.click();
  await page.waitForURL(`${siteUrl}methode/index.html#h1`);
  const row = page.locator('tr#h1');
  await row.waitFor({ state: 'attached' });
  await sleep(300);
  assert.match(await row.innerText(), /RSA/);
  const inView = await row.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  });
  assert.ok(inView, 'tr#h1 is in the viewport after the jump');
  await page.close();
});

await step('simulator: a public servant sees the warning whose link lands on /comprendre/situations/#agent-public-indispensable', async () => {
  phase = 'simulator-fonctionnaire';
  const page = await context.newPage();
  await page.goto(`${siteUrl}simulateur/index.html`);
  await waitHydrated(page, 'simulateur');
  await fillHousehold(page, PERSONAS.camille);
  await page.getByTestId('headline-figure').waitFor({ state: 'visible', timeout: 15_000 });
  const warn = page.getByTestId('fonctionnaire-warning');
  await warn.waitFor({ state: 'visible', timeout: 10_000 });
  const a = warn.locator('a').first();
  const href = await a.evaluate((x) => x.href);
  assert.equal(href, `${siteUrl}comprendre/situations/index.html#agent-public-indispensable`);
  await a.click();
  await page.waitForURL(href);
  await page.waitForLoadState('networkidle');
  await sleep(300);
  const inView = await page.evaluate(() => {
    const el = document.getElementById('agent-public-indispensable');
    if (!el) return 'missing';
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight ? 'ok' : `off-screen (${Math.round(r.top)})`;
  });
  assert.equal(inView, 'ok');
  await page.close();
});

await step('simulator: « foyers types » page builds working links into the simulator (#v1 state)', async () => {
  phase = 'cas-types';
  const page = await context.newPage();
  await page.goto(`${siteUrl}simulateur/cas-types/index.html`);
  await waitHydrated(page, 'cas-types');
  await scrollThrough(page);
  const links = (await harvest(page)).filter((l) => l.tag === 'a' && l.url.includes('simulateur/index.html#v1.'));
  assert.ok(links.length > 3, `simulator deep links: ${links.length}`);
  const deep = await linkTo(page, 'simulateur/index.html#v1.');
  await deep.scrollIntoViewIfNeeded();
  await deep.click();
  await page.waitForURL(/simulateur\/index\.html#v1\./);
  await page.getByTestId('headline-figure').waitFor({ state: 'visible', timeout: 15_000 });
  await page.close();
});

await step('niches: search triggers the niches.json fetch, table and URL state update', async () => {
  phase = 'niches';
  const page = await context.newPage();
  const jsonResponse = page.waitForResponse((r) => r.url() === `${siteUrl}data/niches.json`, { timeout: 15_000 });
  await page.goto(`${siteUrl}comprendre/niches/index.html`);
  await waitHydrated(page, 'niches');
  const box = page.getByRole('searchbox', { name: 'Rechercher une niche' });
  await box.fill('CREDIT impot recherche');
  const r = await jsonResponse;
  assert.equal(r.status(), 200);
  assert.match(r.headers()['content-type'], /json/);
  const body = await r.json();
  assert.ok(Array.isArray(body.rows) && body.rows.length === 465, `niches.json rows: ${body.rows?.length}`);
  const rows = page.locator('[data-testid=niches-table] tbody tr');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=niches-table] tbody tr').length > 0);
  assert.match(await rows.first().innerText(), /Crédit d’impôt en faveur de la recherche/);
  await page.waitForFunction(() => location.hash.includes('q='));
  assert.ok(page.url().startsWith(`${siteUrl}comprendre/niches/index.html#`), page.url());
  await box.fill('');
  await page.getByTestId('niches-summary').filter({ hasText: '465 niches' }).waitFor({ timeout: 5_000 });
  // the visible "JSON" link of the page points at the same file and works
  // the plain « JSON » link is in a <noscript> (text when JS runs): resolve it against the page like a browser would
  const ns = await page.locator('noscript').evaluateAll((n) => n.map((x) => x.textContent).join('\n'));
  const m = /href="([^"]*niches\.json)"/.exec(ns);
  assert.ok(m, 'noscript JSON link');
  assert.equal(new URL(m[1], page.url()).href, `${siteUrl}data/niches.json`);
  await page.close();
});

await step('questionnaire: answer, reveal, next question', async () => {
  phase = 'questionnaire';
  const page = await context.newPage();
  await page.goto(`${siteUrl}questionnaire/index.html`);
  await waitHydrated(page, 'questionnaire');
  await page.getByRole('slider').fill('40');
  await page.getByText(/Votre estimation[\s\u202f]*:\s*40/).waitFor();
  await page.getByRole('button', { name: 'Révéler la réponse' }).click();
  const q = page.getByTestId('questionnaire');
  await q.getByText(/Le calcul[\s\u00a0\u202f]*:[\s\u00a0\u202f]*6,4/).waitFor({ timeout: 5_000 });
  await q.getByText(/fois plus/).first().waitFor();
  const hrefs = await q.locator('a[href]').evaluateAll((as) => as.map((a) => a.href));
  const internal = hrefs.filter((h) => new URL(h).origin === location_origin);
  for (const u of internal) assert.ok(isUnder(u) && /\.html(#.*)?$/.test(u), `questionnaire link ${u}`);
  console.log(`        ${internal.length} internal link(s) in the question card`);
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await q.getByRole('heading', { level: 2 }).waitFor();
  await page.close();
});

await step('hub: predict-then-reveal (type a number, reveal, restart)', async () => {
  phase = 'hub';
  const page = await context.newPage();
  await page.goto(`${siteUrl}comprendre/index.html`);
  await page.locator('astro-island[component-url*="PredictReveal"]').scrollIntoViewIfNeeded();
  await waitHydrated(page, 'hub');
  await page.getByLabel('ou tapez un nombre').fill('25');
  await page.getByRole('button', { name: 'Révéler la réponse' }).click();
  await page.getByText(/Vous avez dit 25\s%\.\sLa réalité\s:\s6,4\s%/).waitFor({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await page.getByText('pas encore choisie').waitFor();
  await page.close();
});

await step('glossary (Astro variant, methode): toggletip opens, shows « En savoir plus », Escape closes + refocuses, link lands', async () => {
  phase = 'glossary-astro';
  const page = await context.newPage();
  await page.goto(`${siteUrl}methode/index.html`);
  const withLink = page.locator('.gloss-btn[data-href]').first();
  await withLink.scrollIntoViewIfNeeded();
  assert.equal(await withLink.getAttribute('aria-expanded'), 'false');
  await withLink.click();
  assert.equal(await withLink.getAttribute('aria-expanded'), 'true');
  const bubble = page.locator('.gloss-bubble').first();
  await bubble.waitFor({ state: 'visible' });
  const link = bubble.getByRole('link', { name: 'En savoir plus' });
  const href = await link.evaluate((a) => a.href);
  assert.ok(isUnder(href) && /\.html(#.*)?$/.test(href), `bubble link ${href}`);
  await page.keyboard.press('Escape');
  assert.equal(await withLink.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('.gloss-bubble').count(), 0);
  assert.ok(await withLink.evaluate((b) => document.activeElement === b), 'focus returned to the term');
  // follow it
  await withLink.click();
  await bubble.getByRole('link', { name: 'En savoir plus' }).click();
  await page.waitForURL(href);
  assert.ok((await page.locator('h1').count()) > 0);
  await page.close();
});

await step('glossary (React variant): toggletip opens on a page where <Term> is an island', async () => {
  phase = 'glossary-react';
  const target = [...pageData].find(([, d]) => d.reactGloss);
  if (!target) {
    console.log('        (no page uses the React <Term> variant: skipped)');
    return;
  }
  const page = await context.newPage();
  await page.goto(target[0]);
  await waitHydrated(page, target[0]);
  const btn = page.locator('.gloss-btn:not([data-term])').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.locator('.gloss-bubble').first().waitFor({ state: 'visible' });
  const a = page.locator('.gloss-bubble a').first();
  if (await a.count()) {
    const href = await a.evaluate((x) => x.href);
    assert.ok(isUnder(href) && /\.html(#.*)?$/.test(href), `React Term link ${href}`);
    assert.equal((await fetch(stripHash(href))).status, 200);
  }
  await page.keyboard.press('Escape');
  await page.close();
});

await step('runtime helper: the withBase chunk maps directories to index.html and finds the root by itself (no __EPJN_ROOT__)', async () => {
  phase = 'withbase-unit';
  const chunk = uniq(ev.requests.map((r) => r.url)).find((u) => /\/_astro\/site\.[^/]+\.js$/.test(u));
  assert.ok(chunk, 'site chunk was loaded during the crawl');
  const page = await context.newPage();
  await page.goto(`${siteUrl}a-propos/index.html`);
  const out = await page.evaluate(async (url) => {
    delete window.__EPJN_ROOT__; // force the import.meta.url fallback
    const m = await import(`${url}?fresh=${Date.now()}`);
    const w = Object.values(m)[0];
    const cases = ['/', '/simulateur/', '/simulateur/cas-types/', '/methode/#h1', '/methode#calcul', '/comprendre/le-plan', '/comprendre/situations/#agent-public-indispensable', 'data/niches.json', 'favicon.svg', 'https://example.org/x/', '#frag', '//cdn.example/x/'];
    return Object.fromEntries(cases.map((c) => [c, w(c)]));
  }, chunk);
  const S = siteUrl;
  assert.deepEqual(out, {
    '/': `${S}index.html`,
    '/simulateur/': `${S}simulateur/index.html`,
    '/simulateur/cas-types/': `${S}simulateur/cas-types/index.html`,
    '/methode/#h1': `${S}methode/index.html#h1`,
    '/methode#calcul': `${S}methode/index.html#calcul`,
    '/comprendre/le-plan': `${S}comprendre/le-plan/index.html`,
    '/comprendre/situations/#agent-public-indispensable': `${S}comprendre/situations/index.html#agent-public-indispensable`,
    'data/niches.json': `${S}data/niches.json`,
    'favicon.svg': `${S}favicon.svg`,
    'https://example.org/x/': 'https://example.org/x/',
    '#frag': '#frag',
    '//cdn.example/x/': '//cdn.example/x/',
  });
  await page.close();
});

await step('theme toggle: dark on click, persisted across reload (localStorage), toggles back', async () => {
  phase = 'theme';
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`${siteUrl}index.html`);
  const toggle = page.getByRole('button', { name: 'Thème sombre' });
  await toggle.waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('[data-theme-toggle]')?.hasAttribute('data-ready'));
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  await toggle.click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.getByRole('button', { name: 'Thème sombre' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.close();
});

await step('methode: TOC anchors (#id) jump within the page, keep the page URL, land on the heading', async () => {
  phase = 'methode-toc';
  const page = await context.newPage();
  await page.goto(`${siteUrl}methode/index.html`);
  await page.waitForLoadState('networkidle');
  const toc = page.getByRole('navigation', { name: 'Sur cette page' });
  const anchors = await toc.locator('a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  assert.ok(anchors.length >= 4, `TOC entries: ${anchors.length}`);
  for (const h of anchors.slice(0, 6)) {
    await toc.locator(`a[href="${h}"]`).click();
    await page.waitForFunction((x) => location.hash === x, h);
    assert.equal(page.url(), `${siteUrl}methode/index.html${h}`);
    await sleep(150);
    const ok = await page.evaluate((x) => {
      const el = document.getElementById(x.slice(1));
      if (!el) return 'missing';
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight ? 'ok' : `off-screen (${Math.round(r.top)})`;
    }, h);
    assert.equal(ok, 'ok', `${h}: ${ok}`);
  }
  console.log(`        ${anchors.length} TOC anchors, ${Math.min(6, anchors.length)} clicked`);
  await page.close();
});

await step('fragment links across pages: /comprendre/situations/#agent-public-indispensable and the registre anchor land', async () => {
  phase = 'fragments';
  const page = await context.newPage();
  for (const [rel, id] of [
    ['comprendre/situations/index.html', 'agent-public-indispensable'],
    ['methode/index.html', 'registre'],
    ['methode/index.html', 'h5'],
    ['methode/index.html', 'calcul'],
  ]) {
    await page.goto(`${siteUrl}${rel}#${id}`);
    await page.waitForLoadState('networkidle');
    await sleep(250);
    const st = await page.evaluate((x) => {
      const el = document.getElementById(x);
      if (!el) return 'missing';
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight ? 'ok' : `off-screen (${Math.round(r.top)})`;
    }, id);
    assert.equal(st, 'ok', `${rel}#${id}: ${st}`);
  }
  await page.close();
});

/* ── 4. global assertions ──────────────────────────────────────────────────────────────────────────────────────── */
console.log('\nGlobal');
const brief = (a, f) => a.slice(0, 8).map(f).join('\n');
await step(`0 responses >= 400  (${ev.responses.length} responses seen)`, async () => {
  const bad = ev.responses.filter((r) => r.status >= 400);
  assert.equal(bad.length, 0, brief(bad, (r) => `[${r.phase}] ${r.status} ${r.url}`));
  assert.ok(ev.responses.length > 100);
});
await step('0 console errors, 0 uncaught exceptions', async () => {
  assert.equal(ev.console.length, 0, brief(ev.console, (c) => `[${c.phase}] ${c.text.slice(0, 200)}`));
  assert.equal(ev.pageErrors.length, 0, brief(ev.pageErrors, (c) => `[${c.phase}] ${c.text.slice(0, 200)}`));
});
await step('0 CSP violations', async () => {
  assert.equal(ev.csp.length, 0, brief(ev.csp, (c) => `[${c.phase}] ${c.directive} blocked ${c.blocked} on ${c.doc}`));
});
await step(`0 requests outside the prefix  (${ev.requests.filter((r) => isHttp(r.url)).length} http requests seen)`, async () => {
  const bad = ev.requests.filter((r) => isHttp(r.url) && !isUnder(r.url));
  assert.equal(bad.length, 0, brief(bad, (r) => `[${r.phase}] ${r.type} ${r.url}`));
  const srv = server.log.filter((e) => !e.inPrefix);
  assert.equal(srv.length, 0, `server saw ${srv.length} request(s) outside the prefix: ${srv.slice(0, 5).map((e) => e.url)}`);
});
await step('server log: no 4xx/5xx answered, no request without a file extension (no directory request)', async () => {
  const bad = server.log.filter((e) => e.status >= 400);
  assert.equal(bad.length, 0, brief(bad, (e) => `${e.status} ${e.method} ${e.url}`));
  const dirs = server.log.filter((e) => new URL(e.url, origin).pathname.endsWith('/'));
  assert.equal(dirs.length, 0, brief(dirs, (e) => e.url));
});
await step('0 failed requests (other than navigations/fetches aborted on purpose)', async () => {
  const bad = ev.failed.filter((f) => f.why !== 'net::ERR_ABORTED');
  assert.equal(bad.length, 0, brief(bad, (f) => `[${f.phase}] ${f.why} ${f.url}`));
});

const requested = new Set(server.log.filter((e) => e.status === 200).map((e) => decodeURIComponent(new URL(e.url, origin).pathname.slice(prefix.length + 'site/'.length))));
const onDisk = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
    else onDisk.push(path.relative(siteDirOnDisk, path.join(dir, e.name)).split(path.sep).join('/'));
  }
})(siteDirOnDisk);
const untouched = onDisk.filter((f) => !requested.has(f));

await browser.close();
await server.close();

/* ── summary ───────────────────────────────────────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
const totalIslands = [...pageData.values()].reduce((s, d) => s + d.islands, 0);
console.log(`
SUMMARY
  pages crawled        ${pageData.size} / ${diskPages.length} in the folder
  islands hydrated     ${totalIslands}
  references harvested ${allLinks.length}  (distinct internal targets: ${internalUrls?.size ?? '?'})
  http requests        ${ev.requests.filter((r) => isHttp(r.url)).length}, responses ${ev.responses.length}, console warnings ignored ${ev.warnings}
  files requested      ${onDisk.length - untouched.length} / ${onDisk.length} files of the folder${untouched.length ? `  (never requested: ${untouched.length}, e.g. ${untouched.slice(0, 4).join(', ')})` : ''}
  steps                ${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
console.log('\nALL PASSED');
