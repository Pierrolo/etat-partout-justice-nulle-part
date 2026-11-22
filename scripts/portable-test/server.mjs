#!/usr/bin/env node
/**
 * Tiny static server for testing the portable copy under hostile conditions:
 *   - everything lives under a deep random prefix:  /p/<id>/index.html (launcher) and /p/<id>/site/**  (the site);
 *   - NO directory resolution: a URL that ends with "/" or names a directory is a 404 (so is anything outside the prefix);
 *   - strict CSP on every response (inline scripts allowed, no external host).
 * Every request is logged (`server.log`) so the test can assert "0 requests outside the prefix, 0 responses >= 400".
 *
 * Library:  const s = await startServer({ portableDir, prefix?, siteDir?, port? })  → { origin, prefix, baseUrl, siteUrl, log, close }
 * CLI:      node server.mjs --portable <dir with index.html + site/> [--prefix /p/abc123/] [--port 8080]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/** The launcher is an HTML fragment: wrap it the way the publisher does (doctype + head + body). */
export function wrapFragment(fragment) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${fragment}</body></html>`;
}

export function randomPrefix() {
  return `/p/${crypto.randomBytes(4).toString('hex')}/`;
}

export async function startServer({ portableDir, siteDir, prefix = randomPrefix(), port = 0 } = {}) {
  if (!prefix.startsWith('/') || !prefix.endsWith('/')) throw new Error('prefix must start and end with "/"');
  const root = path.resolve(siteDir ?? path.join(portableDir, 'site'));
  const launcherFile = portableDir ? path.join(portableDir, 'index.html') : null;
  /** @type {{method:string,url:string,status:number,inPrefix:boolean}[]} */
  const log = [];

  const send = (res, status, headers, body) => {
    res.writeHead(status, {
      'content-security-policy': CSP,
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
      ...headers,
    });
    res.end(body);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const entry = { method: req.method ?? 'GET', url: req.url ?? '', status: 0, inPrefix: url.pathname.startsWith(prefix) };
    log.push(entry);
    const done = (status, headers = {}, body = '') => {
      entry.status = status;
      send(res, status, headers, req.method === 'HEAD' ? undefined : body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return done(405, { 'content-type': 'text/plain' }, 'method not allowed');
    if (!entry.inPrefix) return done(404, { 'content-type': 'text/plain' }, 'outside the prefix');

    let rest;
    try {
      rest = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
      return done(400, { 'content-type': 'text/plain' }, 'bad request');
    }
    // the launcher
    if (rest === 'index.html') {
      if (!launcherFile || !fs.existsSync(launcherFile)) return done(404, { 'content-type': 'text/plain' }, 'no launcher');
      return done(200, { 'content-type': MIME['.html'] }, wrapFragment(fs.readFileSync(launcherFile, 'utf8')));
    }
    // the site
    if (!rest.startsWith('site/')) return done(404, { 'content-type': 'text/plain' }, 'not found');
    const rel = rest.slice('site/'.length);
    const file = path.resolve(root, rel);
    if (rel === '' || rest.endsWith('/') || !(file === root || file.startsWith(root + path.sep))) {
      return done(404, { 'content-type': 'text/plain' }, 'directory listing / index resolution is disabled');
    }
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      return done(404, { 'content-type': 'text/plain' }, 'not found');
    }
    if (!st.isFile()) return done(404, { 'content-type': 'text/plain' }, 'directory: no index resolution');
    return done(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' }, fs.readFileSync(file));
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const { port: actual } = server.address();
  const origin = `http://127.0.0.1:${actual}`;
  return {
    origin,
    prefix,
    baseUrl: `${origin}${prefix}`,
    siteUrl: `${origin}${prefix}site/`,
    log,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n, d) => {
    const i = process.argv.indexOf(n);
    return i === -1 ? d : process.argv[i + 1];
  };
  const portableDir = path.resolve(arg('--portable', '.'));
  const s = await startServer({ portableDir, prefix: arg('--prefix', randomPrefix()), port: Number(arg('--port', 0)) });
  console.log(`serving ${portableDir}\n  launcher: ${s.baseUrl}index.html\n  site:     ${s.siteUrl}index.html\nCSP: ${CSP}`);
}
