#!/usr/bin/env node
/**
 * DO THE SELF-HOSTED FONTS SURVIVE THE DEPLOY BASE? — the one sense `ab_basepath` lacks.
 *
 * ── Why a second tool, when `ab_basepath.mjs --selftest` already exists ───────
 * `ab_basepath` is the gate for this class and it is a good one. Read its three senses
 * against THIS change, though, and one of them has a hole:
 *
 *   LITERAL audit — scans `.js`, `.mjs` and `.css` files only. The `@font-face` block
 *                   lives in an INLINE `<style>` inside `index.html`, which is none of
 *                   those, so a de-based `url('/fonts/…')` is invisible to it.
 *   CRAWL         — matches `src=`/`href=` in the HTML, so it DOES see the two
 *                   `<link rel="preload">` tags. It does NOT parse CSS `url()`.
 *   LIVE page     — would see the 404, because the app renders Rubik on every screen.
 *
 * So one of three senses covers the `url()` and it is the slowest and least specific one.
 * More importantly: **`ab_basepath` has never been shown to FAIL on a wrong FONT path.**
 * A guard that has not failed on the bug it guards against is not a guard (CLAUDE.md #6),
 * and `ab_basepath.mjs` is not this pass's file to extend. This tool closes that exactly:
 * it takes a real built `dist/`, serves it behind a host that genuinely 404s outside its
 * base, and asserts on the FONTS specifically — with the de-based path re-injected as a
 * required failure.
 *
 * ── The two rows ─────────────────────────────────────────────────────────────
 *   GOOD  the dist as built            expect every woff2 200, fonts.size > 0, 0 4xx
 *   BAD   the same dist with the base  expect a 404 on the fonts — this is the
 *         stripped from every font path       `music.ts` `/audio/…` bug in a new file
 *
 * The BAD row is the point. Without it, GOOD passing proves only that the tool can load
 * a page.
 *
 * Usage:
 *   node tools/tmp/ft_basepath.mjs --dist <dir> --base /food-arena/
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import net from 'node:net';

const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const DIST = get('dist');
const BASE = get('base', '/food-arena/');
if (!DIST) throw new Error('need --dist <a built dist directory>');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain',
};
const ASSET_EXT = new Set(Object.keys(MIME).filter((e) => e !== '.html'));

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}

/**
 * A host as strict as GitHub Pages: anything outside `base` is a hard 404, an asset
 * extension that is not on disk is a hard 404 (NEVER an SPA fallback — a 200 whose body
 * is `index.html` is a masked 404), and only extensionless paths fall back to the shell.
 */
async function serve(dir, base) {
  const port = await freePort();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (!p.startsWith(base)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('outside base'); return; }
    let rel = p.slice(base.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    rel = normalize(rel).replace(/^(\.\.[/\\])+/, '');
    let file = join(dir, rel);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (ASSET_EXT.has(extname(rel).toLowerCase())) {
        res.writeHead(404, { 'content-type': 'text/plain' }); res.end(`no such asset: ${rel}`); return;
      }
      file = join(dir, 'index.html');
    }
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-length': body.length });
    res.end(body);
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${port}${base}`, close: () => new Promise((r) => server.close(r)) };
}

/** One cell: load the page, watch every request, and ask the DOM what it actually has. */
async function measure(dir, base, label) {
  const host = await serve(dir, base);
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const fonts = [];
  const bad = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/\.woff2(\?|$)/.test(u)) fonts.push({ url: u.replace(host.url, ''), status: r.status() });
    if (r.status() >= 400) bad.push(`${r.status()} ${u.replace(host.url, '')}`);
  });
  page.on('requestfailed', (r) => bad.push(`FAILED ${r.url().replace(host.url, '')} (${r.failure()?.errorText})`));

  let dom = null;
  try {
    await page.goto(`${host.url}?screen=home&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 90_000 });
    await page.waitForTimeout(2500);
    dom = await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family}/${f.weight}`);
      // The RULER: a fixed string at a fixed size in Rubik 800, against the same string
      // in a family that does not exist. Equal means Rubik did NOT load — which is the
      // whole point, because a 404'd font renders as the platform sans and looks like a
      // design decision rather than a bug (CLAUDE.md #4).
      const w = (fam) => {
        const s = document.createElement('span');
        s.textContent = 'Handgloves 0123456789';
        s.style.cssText = `position:fixed;left:-9999px;white-space:nowrap;font:800 100px ${fam}`;
        document.body.appendChild(s);
        const x = s.getBoundingClientRect().width; s.remove(); return +x.toFixed(2);
      };
      return { size: document.fonts.size, loaded, rubik: w("'Rubik',sans-serif"), fallback: w("'__absent__',sans-serif") };
    });
  } catch (e) {
    bad.push(`page: ${String(e.message).split('\n')[0]}`);
  }
  await browser.close();
  await host.close();
  return { label, fonts, bad, dom };
}

/** The known-bad: strip the base from every font path, which is `music.ts`'s historical
 *  `/audio/…` literal wearing a different extension. Nothing else in the build changes. */
function debase(dir, base) {
  const out = mkdtempSync(join(tmpdir(), 'fa-ftbad-'));
  cpSync(dir, out, { recursive: true });
  const f = join(out, 'index.html');
  const before = readFileSync(f, 'utf8');
  const after = before.split(`${base}fonts/`).join('/fonts/');
  if (after === before) throw new Error(`known-bad injection changed NOTHING — no "${base}fonts/" in index.html, so this control would pass vacuously`);
  writeFileSync(f, after);
  return out;
}

console.log(`\nft_basepath — self-hosted fonts at base ${BASE}\n  dist: ${DIST}\n`);
const good = await measure(DIST, BASE, 'GOOD');
const badDir = debase(DIST, BASE);
const badRow = await measure(badDir, BASE, 'BAD (base stripped from every font path)');
rmSync(badDir, { recursive: true, force: true });

const rows = [good, badRow];
for (const r of rows) {
  console.log(`  ${r.label}`);
  console.log(`    woff2 requests : ${r.fonts.length ? r.fonts.map((f) => `${f.status} ${f.url}`).join(', ') : 'none'}`);
  console.log(`    4xx / failed   : ${r.bad.length ? r.bad.join(', ') : 'none'}`);
  console.log(`    document.fonts : size=${r.dom?.size} loaded=[${r.dom?.loaded.join(', ')}]`);
  console.log(`    ruler          : Rubik800=${r.dom?.rubik}  fallback=${r.dom?.fallback}  ${r.dom && r.dom.rubik !== r.dom.fallback ? 'REAL FACE' : 'FELL BACK'}`);
}

const checks = [
  ['GOOD: every woff2 answered 200', good.fonts.length > 0 && good.fonts.every((f) => f.status === 200), good.fonts.map((f) => f.status).join(',')],
  ['GOOD: no 4xx and no failed request anywhere on the page', good.bad.length === 0, good.bad.join(' | ') || 'clean'],
  ['GOOD: the real face is in use (ruler differs from the fallback)', !!good.dom && good.dom.rubik !== good.dom.fallback, `${good.dom?.rubik} vs ${good.dom?.fallback}`],
  ['BAD: the de-based path 404s — the guard FIRES', badRow.bad.some((b) => /^404/.test(b)), badRow.bad.join(' | ') || 'NOTHING FAILED — the control is vacuous'],
  ['BAD: and the page falls back to the platform sans', !!badRow.dom && badRow.dom.rubik === badRow.dom.fallback, `${badRow.dom?.rubik} vs ${badRow.dom?.fallback}`],
];
console.log('');
let fails = 0;
for (const [n, ok, d] of checks) { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}   (${d})`); }
console.log(`\n  ${checks.length - fails}/${checks.length}\n`);
process.exitCode = fails ? 1 : 0;
