#!/usr/bin/env node
/**
 * make-portable.mjs — turn the built site into a PORTABLE copy: a folder that works
 *   - from any unknown sub-path (https://host/anything/deep/site/…),
 *   - on a static server that does NOT resolve directory URLs to index.html,
 *   - under a strict CSP (inline scripts allowed, no external host).
 *
 * Usage:  node scripts/make-portable.mjs [--out <dir>] [--dist <site/dist>] [--sentinel-dir <dir>] [--keep-build]
 *   --out          output folder (default: $PORTABLE_OUT or the scratchpad `portable/site/`). Wiped first.
 *   --dist         the regular production build (default site/dist). Never modified: it is only the REFERENCE the
 *                  portable copy is compared with (same pages, same static assets, same HTML modulo hashes).
 *   --sentinel-dir reuse an existing sentinel build instead of building (debugging).
 *   --keep-build   keep the temporary sentinel build (printed at the end).
 *
 * HOW IT WORKS
 *   1. Rebuilds the site ONCE with BASE_PATH=/__EPJN_BASE__/ into a temp outDir (`astro build --outDir`; site/dist is
 *      untouched). The base is then a unique sentinel: every URL the site derives from BASE_URL (withBase(),
 *      the markdown rehype plugin, the Vite preload helper, serialized island props…) carries it, and nothing else in the
 *      output looks like it, so rewriting is exact instead of heuristic. (A plain "/" build cannot be post-processed
 *      safely: in minified JS, "/" is just a string.) The build hashes differ from site/dist (they hash content that
 *      embeds the base), which is why the portable copy is derived from the sentinel build as a whole, not mixed with dist.
 *   2. HTML (tokenised, no <base>): every attribute that holds a URL is rewritten to a path RELATIVE TO THE FILE ITSELF:
 *        href, src, srcset/imagesrcset, poster, action, formaction, xlink:href, cite, … ; <meta content> (og/twitter/refresh);
 *        Astro's component-url / renderer-url / before-hydration-url (always `./` or `../` prefixed: they are fed to
 *        import(), where a bare `_astro/x.js` is a bare specifier and fails); every data-* (and any other attribute) that
 *        holds a path; style="…url()…"; the JSON `props` of <astro-island> (decoded, walked, re-encoded); inline <script>
 *        (JS and JSON types) and inline <style>.
 *      Directory URLs become explicit `…/index.html` (also directory URLs written without the trailing slash, such as the
 *      glossary's `/methode#calcul`, recognised from the list of built pages). `#fragment` and `?query` are kept, and
 *      fragment-only links (`#main`) are left alone, which is why no <base> is used.
 *   3. CSS: `url()` and `@import` become relative to the stylesheet.
 *   4. JS chunks: only two contain the sentinel (see the audit printed by the script):
 *        - the `withBase()` chunk (site.*.js): the literal "/__EPJN_BASE__/" becomes a runtime expression, and the
 *          function is wrapped by a tiny helper that maps directory URLs to index.html (all React-island links,
 *          Questionnaire, glossary links, share-to-simulator links, …);
 *        - the Vite dynamic-import preload helper (`return "/__EPJN_BASE__/"+path`): same root expression.
 *      Runtime root expression (an ABSOLUTE URL ending with "/"):
 *          (globalThis.__EPJN_ROOT__ || new URL("<chunk→root>", import.meta.url).href)
 *      where every HTML page sets, inline and before any module runs,
 *          window.__EPJN_ROOT__ = new URL("<page→root>", location.href).href
 *      The import.meta.url fallback means a chunk still works if it is ever loaded without that inline script.
 *   5. Self-checks: no sentinel left anywhere; no root-absolute URL left; every rewritten reference points to a file
 *      that exists in the output; modified chunks parse; page set and static assets match site/dist.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const posix = path.posix;
const SENT_NAME = '__EPJN_BASE__';
const SENT_BASE = `/${SENT_NAME}/`;
const DEFAULT_OUT =
  '/tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/portable/site';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(repoRoot, 'site');

/* ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const o = {
    out: process.env.PORTABLE_OUT || DEFAULT_OUT,
    dist: path.join(siteDir, 'dist'),
    sentinelDir: null,
    keepBuild: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--dist') o.dist = path.resolve(argv[++i]);
    else if (a === '--sentinel-dir') o.sentinelDir = path.resolve(argv[++i]);
    else if (a === '--keep-build') o.keepBuild = true;
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^[#/ *]+/gm, ''));
      process.exit(0);
    } else throw new Error(`unknown argument: ${a}`);
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));
const log = (...a) => console.log(...a);
const warnings = [];
const errors = [];
const warn = (m) => warnings.push(m);
const fail = (m) => errors.push(m);

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────── */
function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.txt', '.svg', '.xml', '.map', '.webmanifest']);
const isText = (rel) => TEXT_EXT.has(path.extname(rel).toLowerCase());

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(cp);
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
  });
}
const encodeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/* ── 1. the sentinel build ───────────────────────────────────────────────────────────────────────────────────── */
function buildSentinel() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'epjn-sentinel-'));
  const astroBin = path.join(
    path.dirname(createRequire(path.join(siteDir, 'package.json')).resolve('astro/package.json')),
    'bin',
    'astro.mjs',
  );
  log(`[1/5] sentinel build (BASE_PATH=${SENT_BASE}) → ${tmp}`);
  const env = { ...process.env, BASE_PATH: SENT_BASE, SITE_URL: '', ASTRO_TELEMETRY_DISABLED: '1' };
  const r = spawnSync(process.execPath, [astroBin, 'build', '--outDir', tmp], { cwd: siteDir, env, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(r.stdout + r.stderr);
    throw new Error('sentinel build failed');
  }
  return tmp;
}

/* ── 2. parity with site/dist ────────────────────────────────────────────────────────────────────────────────── */
function normaliseForParity(s) {
  return s
    .split(SENT_BASE)
    .join('/')
    .replace(/(_astro\/[A-Za-z0-9_.-]+?)\.[A-Za-z0-9_-]{8}\.(js|css|woff2)/g, '$1.$2')
    .replace(/\buid="[^"]*"/g, 'uid=""');
}
function checkParity(dist, sdir) {
  log(`[2/5] parity with the regular build ${path.relative(repoRoot, dist) || dist}`);
  if (!fs.existsSync(dist)) {
    warn(`reference build ${dist} not found (skipping parity check)`);
    return;
  }
  const a = walk(dist);
  const b = walk(sdir);
  const pagesA = a.filter((f) => f.endsWith('.html'));
  const pagesB = b.filter((f) => f.endsWith('.html'));
  const strip = (l) => l.filter((f) => !f.startsWith('_astro/'));
  if (JSON.stringify(pagesA) !== JSON.stringify(pagesB)) fail(`page set differs: dist=${pagesA.length} sentinel=${pagesB.length}`);
  if (JSON.stringify(strip(a)) !== JSON.stringify(strip(b))) fail('non-_astro file set differs from site/dist');
  const na = a.filter((f) => f.startsWith('_astro/')).length;
  const nb = b.filter((f) => f.startsWith('_astro/')).length;
  if (na !== nb) warn(`_astro file count differs: dist=${na} sentinel=${nb} (site/dist is probably stale: rebuild it)`);
  for (const f of strip(b)) {
    if (f.endsWith('.html')) {
      const x = normaliseForParity(fs.readFileSync(path.join(sdir, f), 'utf8'));
      const y = normaliseForParity(fs.readFileSync(path.join(dist, f), 'utf8'));
      if (x !== y) warn(`HTML differs from site/dist beyond hashes/uids: ${f} (site/dist stale or built with other env?)`);
    } else if (!fs.readFileSync(path.join(sdir, f)).equals(fs.readFileSync(path.join(dist, f)))) {
      warn(`static asset differs from site/dist: ${f}`);
    }
  }
  log(`      ${pagesB.length} pages, ${nb} _astro files, static assets compared`);
}

/* ── 3. URL rewriting ────────────────────────────────────────────────────────────────────────────────────────── */
/** Directories that hold a page: "comprendre/le-plan", … (the site root is "" and handled separately). */
let PAGE_DIRS = new Set();
/** References produced by the rewriting, to be checked against the output tree: {from, attr, target}. */
const refs = [];

const SENT_URL = new RegExp(`^/${SENT_NAME}(?:/([^?#]*))?([?#][\\s\\S]*)?$`);
const SENT_EMBEDDED = new RegExp(`/${SENT_NAME}(?:/[^\\s"'<>()\\\\\`,;]*)?`, 'g');

/** "comprendre/le-plan" | "comprendre/" | "" | "_astro/x.js"  →  the file that really exists. */
function resolveTarget(p) {
  if (p === '' || p === '/') return 'index.html';
  if (p.endsWith('/')) return `${p}index.html`;
  if (PAGE_DIRS.has(p)) return `${p}/index.html`;
  return p;
}

/** Rewrites ONE url that starts with the sentinel into a path relative to the directory `dir` of the file. */
function rewriteUrl(value, dir, from, attr) {
  const m = SENT_URL.exec(value);
  if (!m) {
    fail(`${from}: ${attr}="${value.slice(0, 80)}" contains the base sentinel in a shape I do not understand`);
    return value;
  }
  const target = resolveTarget(m[1] ?? '');
  refs.push({ from, attr, target });
  let rel = posix.relative(`/${dir}`, `/${target}`);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel + (m[2] ?? '');
}

/** Any string that merely CONTAINS sentinel URLs (props JSON text, data-*, inline text): rewrite each one in place. */
function rewriteEmbedded(str, dir, from, attr) {
  return str.replace(SENT_EMBEDDED, (u) => rewriteUrl(u, dir, from, attr));
}

function rewriteString(str, dir, from, attr) {
  if (!str.includes(SENT_NAME)) return str;
  return str.startsWith(`/${SENT_NAME}`) && SENT_URL.test(str)
    ? rewriteUrl(str, dir, from, attr)
    : rewriteEmbedded(str, dir, from, attr);
}

function rewriteJsonValue(v, dir, from, attr) {
  if (typeof v === 'string') return rewriteString(v, dir, from, attr);
  if (Array.isArray(v)) return v.map((x) => rewriteJsonValue(x, dir, from, attr));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewriteJsonValue(x, dir, from, attr)]));
  }
  return v;
}

function rewriteCss(css, dir, from) {
  const check = (v, kind) => {
    if (v.includes(SENT_NAME)) return rewriteString(v, dir, from, kind);
    if (/^\/(?!\/)/.test(v)) fail(`${from}: ${kind}("${v.slice(0, 80)}") is root-absolute but not under the base`);
    return v;
  };
  return css
    .replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s'"]+))\s*\)/gi, (full, a, b, c) => {
      const v = a ?? b ?? c;
      const nv = check(v, 'url()');
      if (nv === v) return full;
      const q = a !== undefined ? '"' : b !== undefined ? "'" : '';
      return `url(${q}${nv}${q})`;
    })
    .replace(/@import\s+(?:"([^"]*)"|'([^']*)')/g, (full, a, b) => {
      const v = a ?? b;
      const nv = check(v, '@import');
      return nv === v ? full : `@import ${a !== undefined ? '"' : "'"}${nv}${a !== undefined ? '"' : "'"}`;
    });
}

/* ── 4. JS ──────────────────────────────────────────────────────────────────────────────────────────────────── */
const jsReport = []; // {file, kind}

const rootExprForModule = (relToRoot) =>
  `(globalThis.__EPJN_ROOT__||new URL(${JSON.stringify(relToRoot)},import.meta.url).href)`;
const rootExprForInline = (relToRoot) =>
  `(window.__EPJN_ROOT__||new URL(${JSON.stringify(relToRoot)},location.href).href)`;

/** Runtime helper: directory URL (absolute, under the root) → explicit index.html. Self-contained, appended to a chunk. */
function dirHelper(rootExpr) {
  const pages = JSON.stringify([...PAGE_DIRS].sort());
  return (
    `;var __epjnPages=new Set(${pages});` +
    `function __epjnIdx(u){const r=${rootExpr};if(typeof u!=="string"||!u.startsWith(r))return u;` +
    `const m=/^([^?#]*)([?#][\\s\\S]*)?$/.exec(u.slice(r.length));let p=m[1];` +
    `if(p===""||p.endsWith("/"))p+="index.html";else if(__epjnPages.has(p))p+="/index.html";` +
    `return r+p+(m[2]||"")}\n`
  );
}

/**
 * Replaces the sentinel in JS code. `mode` is 'module' (chunk) or 'inline' (inline <script>).
 * Returns {code, changed}. Throws (via fail) on shapes it does not know, so a future build cannot silently break.
 */
function transformJs(code, { from, dir, mode }) {
  if (!code.includes(SENT_NAME)) return { code, changed: false };
  const relToRoot = posix.relative(`/${dir}`, '/') || '.';
  const rel = relToRoot.endsWith('/') ? relToRoot : `${relToRoot}/`;
  const rootExpr = mode === 'module' ? rootExprForModule(rel) : rootExprForInline(rel);
  let out = code;
  const notes = [];

  // (a) the BASE_URL literal itself:  "/__EPJN_BASE__/"
  out = out.replace(new RegExp(`(["'])/${SENT_NAME}/\\1`, 'g'), () => {
    notes.push('BASE_URL literal → runtime root');
    return rootExpr;
  });
  // (b) a literal with a path after it:  "/__EPJN_BASE__/data/x.json"
  out = out.replace(new RegExp(`(["'])/${SENT_NAME}/([^"'\\\\\\n]+)\\1`, 'g'), (_, __, p) => {
    const t = resolveTarget(p.split(/[?#]/)[0]);
    const suffix = (p.match(/[?#][\s\S]*$/) ?? [''])[0];
    notes.push(`literal "/…/${p}" → root + path`);
    return `${rootExpr}+${JSON.stringify(t + suffix)}`;
  });
  // (c) "/__EPJN_BASE__" without a trailing slash (a BASE_URL with its slash stripped)
  out = out.replace(new RegExp(`(["'])/${SENT_NAME}\\1`, 'g'), () => {
    notes.push('BASE_URL without slash → runtime root minus slash');
    return `${rootExpr}.replace(/\\/$/,"")`;
  });

  if (out.includes(SENT_NAME)) {
    const i = out.indexOf(SENT_NAME);
    fail(`${from}: sentinel left in an unknown JS shape: …${out.slice(Math.max(0, i - 60), i + 60)}…`);
    return { code: out, changed: true };
  }

  // withBase(): `function s(e){const t=<root>;return …}` (minified). Wrap it so directory URLs end with index.html.
  if (mode === 'module') {
    const fnRe = /function (\w+)\((\w+)\)\{const (\w+)=\(globalThis\.__EPJN_ROOT__/;
    const m = fnRe.exec(out);
    if (m) {
      const [whole, name, arg] = m;
      out = out.replace(whole, `function __epjnWithBase(${arg}){const ${m[3]}=(globalThis.__EPJN_ROOT__`);
      out += `${dirHelper(rootExpr)}function ${name}(...a){return __epjnIdx(__epjnWithBase(...a))}\n`;
      notes.push(`withBase() wrapped (directory → index.html; ${PAGE_DIRS.size} known page dirs)`);
    } else if (/\{return\(globalThis\.__EPJN_ROOT__[^}]*\+\w+\}/.test(out)) {
      notes.push('Vite preload helper (asset paths only, no directory)');
    } else {
      warn(`${from}: base literal replaced, but it is neither withBase() nor the Vite preload helper: directory links built there are NOT mapped to index.html`);
    }
  }
  jsReport.push({ file: from, notes });
  return { code: out, changed: true };
}

/** Informational audit: root-absolute site paths still sitting in JS string literals (they must flow through withBase). */
function auditJsLiterals(files) {
  const seg = 'simulateur|comprendre|methode|questionnaire|a-propos|styleguide|data|_astro|favicon\\.svg|og-default';
  const re = new RegExp(`(["'\`])(/(?:${seg})(?:[/#?][^"'\`]*)?)\\1`, 'g');
  const found = new Map();
  for (const [rel, code] of files) {
    for (const m of code.matchAll(re)) {
      const key = m[2];
      if (!found.has(key)) found.set(key, new Set());
      found.get(key).add(path.basename(rel).replace(/\.[A-Za-z0-9_-]{8}\.js$/, ''));
    }
  }
  return found;
}

/* ── 5. HTML ────────────────────────────────────────────────────────────────────────────────────────────────── */
const URL_ATTRS = new Set([
  'href', 'src', 'poster', 'action', 'formaction', 'xlink:href', 'cite', 'longdesc', 'manifest', 'ping', 'background',
  'data', 'icon', 'component-url', 'renderer-url', 'before-hydration-url',
]);
const SRCSET_ATTRS = new Set(['srcset', 'imagesrcset']);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
const JS_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript']);
const JSON_TYPES = new Set(['application/json', 'application/ld+json', 'importmap', 'speculationrules']);

const ATTR_RE = /([^\s"'<>/=]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))|([^\s"'<>/=]+)/g;

function rewriteAttrValue(tag, name, value, ctx) {
  const { dir, from } = ctx;
  const hasSent = value.includes(SENT_NAME);
  if (!hasSent) {
    if (URL_ATTRS.has(name) && /^\/(?!\/)/.test(value)) {
      fail(`${from}: <${tag} ${name}="${value.slice(0, 80)}"> is root-absolute but not under the base`);
    }
    return value;
  }
  if (name === 'props') {
    // <astro-island props="{&quot;k&quot;:[0,…]}">: decoded, walked as JSON, re-encoded
    try {
      return JSON.stringify(rewriteJsonValue(JSON.parse(value), dir, from, 'props'));
    } catch {
      return rewriteEmbedded(value, dir, from, 'props');
    }
  }
  if (name === 'style') return rewriteCss(value, dir, from);
  if (SRCSET_ATTRS.has(name)) {
    return value
      .split(',')
      .map((cand) => {
        const [u, ...desc] = cand.trim().split(/\s+/);
        return [rewriteString(u, dir, from, name), ...desc].join(' ');
      })
      .join(', ');
  }
  if (tag === 'meta' && name === 'content') {
    const r = /^(\s*\d+\s*;\s*url=)([\s\S]*)$/i.exec(value); // <meta http-equiv=refresh content="0;url=…">
    if (r) return r[1] + rewriteString(r[2], dir, from, 'meta refresh');
  }
  return rewriteString(value, dir, from, `${tag}[${name}]`);
}

function rewriteTagAttrs(tag, raw, ctx) {
  return raw.replace(ATTR_RE, (full, name, eq, dq, sq, uq, bare) => {
    if (bare !== undefined) return full;
    const value = dq ?? sq ?? uq;
    const decoded = decodeEntities(value);
    const next = rewriteAttrValue(tag, name.toLowerCase(), decoded, ctx);
    return next === decoded ? full : `${name}${eq}"${encodeAttr(next)}"`;
  });
}

function attrOf(raw, wanted) {
  for (const m of raw.matchAll(ATTR_RE)) {
    if (m[1]?.toLowerCase() === wanted) return decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return undefined;
}

function rewriteRawText(tag, rawAttrs, content, ctx) {
  const { dir, from } = ctx;
  if (!content.includes(SENT_NAME)) {
    if (tag === 'style') return rewriteCss(content, dir, from); // still catches root-absolute url() without the base
    return content;
  }
  if (tag === 'style') return rewriteCss(content, dir, from);
  if (tag === 'script') {
    const type = (attrOf(rawAttrs, 'type') ?? '').trim().toLowerCase();
    if (JS_TYPES.has(type)) {
      return transformJs(content, { from: `${from} <script>`, dir, mode: 'inline' }).code;
    }
    if (JSON_TYPES.has(type)) {
      try {
        return JSON.stringify(rewriteJsonValue(JSON.parse(content), dir, from, `script[${type}]`));
      } catch {
        return rewriteEmbedded(content, dir, from, `script[${type}]`);
      }
    }
  }
  return rewriteEmbedded(content, dir, from, tag);
}

function rewriteHtml(html, rel) {
  const dir = posix.dirname(rel) === '.' ? '' : posix.dirname(rel);
  const ctx = { dir, from: rel };
  let out = '';
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt + 4);
      const end = e === -1 ? n : e + 3;
      out += html.slice(lt, end);
      i = end;
      continue;
    }
    const next = html[lt + 1];
    if (next === '!' || next === '?' || next === '/') {
      const e = html.indexOf('>', lt);
      const end = e === -1 ? n : e + 1;
      out += html.slice(lt, end);
      i = end;
      continue;
    }
    const m = /^<([A-Za-z][A-Za-z0-9:-]*)/.exec(html.slice(lt, lt + 64));
    if (!m) {
      out += '<';
      i = lt + 1;
      continue;
    }
    let j = lt + m[0].length;
    let q = null;
    while (j < n) {
      const c = html[j];
      if (q) {
        if (c === q) q = null;
      } else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      j++;
    }
    const tag = m[1].toLowerCase();
    const rawAttrs = html.slice(lt + m[0].length, j);
    out += `<${m[1]}${rewriteTagAttrs(tag, rawAttrs, ctx)}>`;
    i = j + 1;
    if (RAW_TEXT.has(tag)) {
      const close = new RegExp(`</${tag}[\\s/>]`, 'i');
      const rest = html.slice(i);
      const k = rest.search(close);
      const end = k === -1 ? n : i + k;
      out += rewriteRawText(tag, rawAttrs, html.slice(i, end), ctx);
      i = end;
    }
  }

  // the page's own root, set inline before any module runs
  const relToRoot = posix.relative(`/${dir}`, '/') || '.';
  const rootScript = `<script>window.__EPJN_ROOT__=new URL(${JSON.stringify(relToRoot.endsWith('/') ? relToRoot : `${relToRoot}/`)},location.href).href</script>`;
  const meta = /<meta charset=[^>]*>/i.exec(out);
  if (meta) out = out.replace(meta[0], () => meta[0] + rootScript);
  else if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (h) => h + rootScript);
  else fail(`${rel}: no <head> to receive the __EPJN_ROOT__ script`);
  return out;
}

/* ── main ───────────────────────────────────────────────────────────────────────────────────────────────────── */
function main() {
  const t0 = Date.now();
  const sdir = opts.sentinelDir ?? buildSentinel();
  const built = !opts.sentinelDir;
  try {
    if (!fs.existsSync(path.join(sdir, 'index.html'))) throw new Error(`${sdir} is not a site build`);
    checkParity(opts.dist, sdir);

    const files = walk(sdir);
    PAGE_DIRS = new Set(files.filter((f) => f.endsWith('/index.html')).map((f) => f.slice(0, -'/index.html'.length)));
    log(`[3/5] rewriting ${files.length} files (${PAGE_DIRS.size} page directories + root)`);

    // safety: never write into the source tree or the regular build
    const out = path.resolve(opts.out);
    for (const protectedDir of [opts.dist, siteDir, repoRoot]) {
      const r = path.relative(path.resolve(protectedDir), out);
      if (r === '' || (!r.startsWith('..') && !path.isAbsolute(r))) {
        throw new Error(`refusing to write the portable copy into ${protectedDir} (${out})`);
      }
    }
    fs.rmSync(out, { recursive: true, force: true });

    const jsSources = [];
    for (const rel of files) {
      const src = path.join(sdir, rel);
      const dst = path.join(out, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const ext = path.extname(rel).toLowerCase();
      if (ext === '.html') {
        fs.writeFileSync(dst, rewriteHtml(fs.readFileSync(src, 'utf8'), rel));
      } else if (ext === '.css') {
        const dir = posix.dirname(rel) === '.' ? '' : posix.dirname(rel);
        fs.writeFileSync(dst, rewriteCss(fs.readFileSync(src, 'utf8'), dir, rel));
      } else if (ext === '.js' || ext === '.mjs') {
        const code = fs.readFileSync(src, 'utf8');
        jsSources.push([rel, code]);
        const dir = posix.dirname(rel) === '.' ? '' : posix.dirname(rel);
        fs.writeFileSync(dst, transformJs(code, { from: rel, dir, mode: 'module' }).code);
      } else if (isText(rel) && fs.readFileSync(src, 'utf8').includes(SENT_NAME)) {
        fail(`${rel}: text file contains the sentinel and I have no rewriter for its type`);
        fs.copyFileSync(src, dst);
      } else {
        fs.copyFileSync(src, dst);
      }
    }

    log('[4/5] self-checks');
    // (a) no sentinel, no root-absolute URL left
    const outFiles = walk(out);
    for (const rel of outFiles) {
      const buf = fs.readFileSync(path.join(out, rel));
      if (buf.includes(SENT_NAME)) fail(`${rel}: sentinel still present in the output`);
      if (rel.endsWith('.html')) {
        const html = buf.toString('utf8');
        const bad = html.match(/\s(?:href|src|action|poster|srcset|component-url|renderer-url|before-hydration-url|data-href)=["']\/(?!\/)[^"']*/g);
        if (bad) fail(`${rel}: root-absolute URL left: ${bad.slice(0, 3).join(' | ')}`);
        if (!html.includes('window.__EPJN_ROOT__')) fail(`${rel}: __EPJN_ROOT__ script missing`);
        if (/<base[\s>]/i.test(html)) fail(`${rel}: a <base> tag is present`);
      }
    }
    // (b) every rewritten reference exists
    const outSet = new Set(outFiles);
    const missing = new Map();
    for (const r of refs) {
      let t = r.target;
      try {
        t = decodeURIComponent(t);
      } catch {
        /* keep raw */
      }
      if (!outSet.has(t)) missing.set(`${r.from} → ${r.target}`, r.attr);
    }
    for (const [k, attr] of missing) fail(`dangling reference (${attr}): ${k}`);
    // (c) the modified chunks still parse
    for (const { file } of jsReport) {
      if (file.includes('<script>')) continue;
      const r = spawnSync(process.execPath, ['--input-type=module', '--check'], {
        input: fs.readFileSync(path.join(out, file)),
        encoding: 'utf8',
      });
      if (r.status !== 0) fail(`${file}: modified chunk does not parse: ${(r.stderr || '').split('\n').slice(0, 4).join(' ')}`);
    }

    // ── report ──
    log('[5/5] report');
    log('\nJS chunks that depended on the base:');
    for (const { file, notes } of jsReport) log(`  - ${file}: ${[...new Set(notes)].join('; ')}`);
    const literals = auditJsLiterals(jsSources);
    log(`\nRoot-absolute site paths that remain as string literals in the JS (${literals.size}); each reaches the DOM through withBase(), now runtime-root + index.html:`);
    for (const [lit, chunks] of [...literals].sort()) log(`  ${lit.padEnd(58)} ${[...chunks].sort().join(', ')}`);

    const total = outFiles.reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
    const nRefs = refs.length;
    log(`\nrewrote ${nRefs} URLs in ${outFiles.filter((f) => f.endsWith('.html')).length} HTML files and ${outFiles.filter((f) => f.endsWith('.css')).length} CSS file(s)`);
    log(`output: ${out}`);
    log(`files: ${outFiles.length}   size: ${(total / 1024 / 1024).toFixed(2)} MB (${total} bytes)   took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    for (const w of warnings) log(`WARNING: ${w}`);
    if (errors.length) {
      for (const e of errors) console.error(`ERROR: ${e}`);
      process.exitCode = 1;
    }
  } finally {
    if (built) {
      if (opts.keepBuild) log(`(kept sentinel build: ${sdir})`);
      else fs.rmSync(sdir, { recursive: true, force: true });
    }
  }
}

main();
