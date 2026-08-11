#!/usr/bin/env node
/**
 * sc2_manifest — DOES THE HOME-SCREEN MANIFEST SURVIVE THE DEPLOY BASE, AND DID IT EVER
 * EXIST?
 *
 * ── Why a fourth base-path tool ─────────────────────────────────────────────
 * `ab_basepath` and `ft_basepath` between them already cover this class, and neither of
 * them covers THIS file. Read them against a manifest:
 *
 *   ab_basepath LITERAL audit — scans `.js`, `.mjs`, `.css` only. `manifest.webmanifest`
 *                 is none of those, so a `/icons/…` src inside it is invisible.
 *   ab_basepath CRAWL — extracts every `src`/`href` from the HTML, so it DOES fetch the
 *                 manifest document itself and would catch a de-based `<link>` href. It
 *                 does **not** parse JSON, so every URL *inside* the manifest is unseen.
 *   ab_basepath LIVE — requires zero 4xx. Chromium fetches a manifest lazily; nothing on
 *                 this page asks for it, so the request may never be made at all.
 *   ft_basepath — fonts, by construction.
 *
 * So the hole is exact and it is the whole payload: **the manifest's own URLs.** `public/`
 * is copied VERBATIM and Vite rewrites only what it PARSES; it parses an HTML `href` (its
 * `noInlineLinkRels` set names `manifest`, `icon` and `apple-touch-icon` explicitly) and
 * it does not parse this JSON. A `/icons/icon-192.png` src therefore resolves at base `/`
 * and 404s on `/food-arena/` and in the wrapper — `src/audio/music.ts`'s `'/audio/…'`
 * literal in a new extension, and that one survived 427 audio assertions.
 *
 * ── The resolution is done BY THE BROWSER, not by this file ─────────────────
 * Every URL here comes out of the page: `link[rel=manifest].href` is what Chromium
 * resolved, and each icon is `new URL(icon.src, manifestUrl)` evaluated in the document.
 * A regex in Node re-implementing URL resolution would be a second implementation to be
 * wrong in, and it is precisely the resolution step under test.
 *
 * ── The controls, because a guard that has not FAILED is not a guard ────────
 *   NO-MANIFEST   the tree at HEAD, which has no manifest and no Apple meta at all.
 *                 **This is the most important row in the file**: it proves the gate
 *                 would have failed on the state this pass found, rather than passing
 *                 vacuously on anything.
 *   ABS-ICON      the shipped dist with the manifest's icon srcs rewritten root-absolute.
 *   ABS-START     …and with `start_url` rewritten to `/`, which must resolve OUTSIDE
 *                 the served base.
 *   DEBASE-HREF   …and with the base stripped from the `<link rel=manifest>` href.
 * Each control is paired with the unmutated positive row above it.
 *
 * Usage:
 *   node tools/tmp/sc2_manifest.mjs              # the three bases + every control
 *   node tools/tmp/sc2_manifest.mjs --quick      # the wrapper base only (one build)
 *   node tools/tmp/sc2_manifest.mjs --keep       # leave the built trees on disk
 */
import { chromium } from 'playwright';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freeze, build, serve } from './sc2_lib.mjs';

const argv = process.argv.slice(2);
const QUICK = argv.includes('--quick');
const KEEP = argv.includes('--keep');

const LAUNCH = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl',
];

/**
 * The three bases. The wrapper base is deliberately two segments deep and named nothing
 * like the repo, so a build made for `/` or `/food-arena/` cannot pass here by accident.
 */
const CELLS = QUICK
  ? [{ name: 'WRAPPER', buildBase: './', serveBase: '/app/v1/wrap/' }]
  : [
    { name: 'ROOT', buildBase: '/', serveBase: '/' },
    { name: 'PAGES', buildBase: '/food-arena/', serveBase: '/food-arena/' },
    { name: 'WRAPPER', buildBase: './', serveBase: '/app/v1/wrap/' },
  ];

/**
 * Everything this tool asks, asked inside the page.
 *
 * Returns raw facts only — no verdicts — so that the same probe can be run against a
 * deliberately broken build and its output read as evidence of the break.
 */
const PROBE = `(async () => {
  const out = { link: null, manifest: null, json: null, icons: [], apple: null, metas: {}, err: null };
  try {
    const l = document.querySelector('link[rel~="manifest"]');
    out.link = l ? l.getAttribute('href') : null;
    out.manifest = l ? l.href : null;               // the BROWSER's resolution
    const a = document.querySelector('link[rel~="apple-touch-icon"]');
    out.apple = a ? { attr: a.getAttribute('href'), url: a.href } : null;
    for (const n of ['apple-mobile-web-app-capable', 'mobile-web-app-capable',
                     'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title',
                     'theme-color', 'viewport']) {
      const m = document.querySelector('meta[name="' + n + '"]');
      out.metas[n] = m ? m.getAttribute('content') : null;
    }
    if (out.manifest) {
      const r = await fetch(out.manifest);
      out.manifestStatus = r.status;
      out.manifestType = r.headers.get('content-type');
      const text = await r.text();
      try { out.json = JSON.parse(text); } catch (e) { out.jsonError = String(e.message); }
      if (out.json && Array.isArray(out.json.icons)) {
        for (const ic of out.json.icons) {
          const u = new URL(ic.src, out.manifest).href;   // the BROWSER's resolution
          let st = 0; let magic = '';
          try {
            const ir = await fetch(u);
            st = ir.status;
            const b = new Uint8Array(await ir.arrayBuffer());
            magic = String.fromCharCode(b[0], b[1], b[2], b[3]);
          } catch (e) { st = -1; magic = String(e.message); }
          out.icons.push({ src: ic.src, url: u, status: st, magic, purpose: ic.purpose, sizes: ic.sizes });
        }
      }
      if (out.json) {
        out.startUrl = new URL(out.json.start_url ?? './', out.manifest).href;
        out.scopeUrl = new URL(out.json.scope ?? './', out.manifest).href;
      }
    }
    if (out.apple) {
      const r = await fetch(out.apple.url);
      out.appleStatus = r.status;
      const b = new Uint8Array(await r.arrayBuffer());
      out.appleMagic = String.fromCharCode(b[0], b[1], b[2], b[3]);
    }
  } catch (e) { out.err = String(e && e.message); }
  return out;
})()`;

async function probe(dist, serveBase, label) {
  const host = await serve(dist, serveBase);
  const browser = await chromium.launch({ args: LAUNCH });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(host.origin, '')}`); });
  page.on('requestfailed', (r) => bad.push(`FAILED ${r.url().replace(host.origin, '')}`));
  page.on('pageerror', (e) => bad.push(`pageerror ${String(e).slice(0, 120)}`));
  let m = { err: 'page never loaded' };
  try {
    await page.goto(`${host.url}?screen=home&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    m = await page.evaluate(PROBE);
  } catch (e) { m = { err: String(e.message).split('\n')[0] }; }
  await browser.close();
  await host.close();
  return { label, base: host.base, bad, m };
}

// ── the mutations. Each one is a real bug this project has already shipped once. ──
function mutate(dist, kind, base) {
  const out = mkdtempSync(join(tmpdir(), `fa-sc2-${kind}-`));
  cpSync(dist, out, { recursive: true });
  const mf = join(out, 'manifest.webmanifest');
  const html = join(out, 'index.html');
  if (kind === 'ABS-ICON') {
    const j = JSON.parse(readFileSync(mf, 'utf8'));
    j.icons = j.icons.map((i) => ({ ...i, src: `/${i.src.replace(/^\.?\//, '')}` }));
    writeFileSync(mf, JSON.stringify(j, null, 2));
  } else if (kind === 'ABS-START') {
    const j = JSON.parse(readFileSync(mf, 'utf8'));
    j.start_url = '/';
    j.scope = '/';
    writeFileSync(mf, JSON.stringify(j, null, 2));
  } else if (kind === 'DEBASE-HREF') {
    // Force every manifest/icon href root-absolute, WHATEVER prefix Vite emitted — `./`
    // at the wrapper base, `/food-arena/` at Pages. Matching on the emitted prefix is
    // what a hand-written replacement gets wrong, and a control that silently no-ops is
    // the failure mode this whole file exists to refuse, so it throws instead.
    const before = readFileSync(html, 'utf8');
    const after = before.replace(/href="[^"]*?(manifest\.webmanifest|icons\/[A-Za-z0-9._-]+)"/g, 'href="/$1"');
    if (after === before) throw new Error(`DEBASE-HREF changed NOTHING in index.html (base ${base}) — this control would pass vacuously`);
    writeFileSync(html, after);
  }
  return out;
}

// ─────────────────────────────── run ────────────────────────────────────────
console.log('\nsc2_manifest — the home-screen manifest, at three bases, with four controls\n');

const trees = [];
const checks = [];
const push = (n, ok, d) => checks.push([n, ok, d]);

// The tree under test: HEAD + this pass's owned files.
const tree = freeze();
trees.push(tree);

for (const cell of CELLS) {
  const dist = build(tree, cell.buildBase);
  const r = await probe(dist, cell.serveBase, cell.name);
  const m = r.m;
  const p = `${cell.name}`;
  console.log(`  ${p}  build base ${cell.buildBase}  served at ${r.base}`);
  console.log(`    <link rel=manifest>   attr=${JSON.stringify(m.link)}  ->  ${m.manifest ? m.manifest.replace(/^http:\/\/[^/]+/, '') : null}  (${m.manifestStatus})`);
  console.log(`    icons                 ${m.icons?.map((i) => `${i.status} ${i.src}`).join(' | ') || 'none'}`);
  console.log(`    apple-touch-icon      ${m.apple ? `${m.appleStatus} ${m.apple.attr}` : 'ABSENT'}`);
  console.log(`    start_url / scope     ${m.startUrl?.replace(/^http:\/\/[^/]+/, '')} / ${m.scopeUrl?.replace(/^http:\/\/[^/]+/, '')}`);
  console.log(`    apple-capable meta    ${JSON.stringify(m.metas?.['apple-mobile-web-app-capable'])}   status-bar ${JSON.stringify(m.metas?.['apple-mobile-web-app-status-bar-style'])}`);
  console.log(`    4xx / failed          ${r.bad.length ? r.bad.join(', ') : 'none'}`);

  push(`${p}: a <link rel=manifest> exists`, !!m.manifest, String(m.link));
  push(`${p}: the manifest answers 200`, m.manifestStatus === 200, String(m.manifestStatus));
  push(`${p}: it is valid JSON`, !!m.json, m.jsonError ?? 'parsed');
  push(`${p}: display is standalone (the tag that removes iOS browser chrome)`, m.json?.display === 'standalone', String(m.json?.display));
  push(`${p}: orientation is landscape (honoured on Android; inert on iOS by design)`, m.json?.orientation === 'landscape', String(m.json?.orientation));
  push(`${p}: >=1 icon of at least 192px, and every icon answers 200`,
    (m.icons?.length ?? 0) > 0 && m.icons.every((i) => i.status === 200)
      && m.icons.some((i) => Number(String(i.sizes).split('x')[0]) >= 192),
    m.icons?.map((i) => `${i.status}/${i.sizes}`).join(',') ?? 'none');
  push(`${p}: every icon body is really a PNG`, (m.icons?.length ?? 0) > 0 && m.icons.every((i) => i.magic.slice(1) === 'PNG'), m.icons?.map((i) => i.magic.slice(1)).join(',') ?? '');
  push(`${p}: a maskable icon exists (Android crops to its own shape)`, !!m.json?.icons?.some((i) => String(i.purpose).includes('maskable')), String(m.json?.icons?.map((i) => i.purpose)));
  push(`${p}: start_url resolves INSIDE the served base`, !!m.startUrl && new URL(m.startUrl).pathname.startsWith(r.base), String(m.startUrl && new URL(m.startUrl).pathname));
  push(`${p}: scope resolves INSIDE the served base`, !!m.scopeUrl && new URL(m.scopeUrl).pathname.startsWith(r.base), String(m.scopeUrl && new URL(m.scopeUrl).pathname));
  push(`${p}: apple-touch-icon present and 200 (else iOS uses a SCREENSHOT of the boot curtain)`, m.appleStatus === 200 && m.appleMagic?.slice(1) === 'PNG', `${m.appleStatus} ${m.appleMagic}`);
  push(`${p}: apple-mobile-web-app-capable = yes`, m.metas?.['apple-mobile-web-app-capable'] === 'yes', String(m.metas?.['apple-mobile-web-app-capable']));
  push(`${p}: status-bar style is black-translucent (this is what buys the notch band)`, m.metas?.['apple-mobile-web-app-status-bar-style'] === 'black-translucent', String(m.metas?.['apple-mobile-web-app-status-bar-style']));
  push(`${p}: no 4xx and no failed request on the page`, r.bad.length === 0, r.bad.join(' | ') || 'clean');
  console.log('');

  // The three mutation controls run on the PAGES base only — a base of `/` cannot
  // express the bug at all (every root-absolute path is correct there), which is exactly
  // why the historical music.ts 404 survived every gate this project had.
  if (cell.serveBase !== '/') {
    for (const kind of ['ABS-ICON', 'ABS-START', 'DEBASE-HREF']) {
      const dir = mutate(dist, kind, cell.buildBase === './' ? cell.serveBase : cell.buildBase);
      const c = await probe(dir, cell.serveBase, `${p}/${kind}`);
      const cm = c.m;
      if (!KEEP) rmSync(dir, { recursive: true, force: true });
      if (kind === 'ABS-ICON') {
        push(`KNOWN-BAD ${p}/ABS-ICON: a root-absolute icon src 404s`, (cm.icons?.length ?? 0) > 0 && cm.icons.some((i) => i.status === 404), cm.icons?.map((i) => `${i.status} ${i.src}`).join(',') ?? 'NO ICONS AT ALL — vacuous');
      } else if (kind === 'ABS-START') {
        push(`KNOWN-BAD ${p}/ABS-START: a root-absolute start_url lands OUTSIDE the base`, !!cm.startUrl && !new URL(cm.startUrl).pathname.startsWith(c.base), String(cm.startUrl && new URL(cm.startUrl).pathname));
      } else {
        push(`KNOWN-BAD ${p}/DEBASE-HREF: a de-based manifest href 404s`, cm.manifestStatus === 404 || cm.manifestStatus === undefined, `manifest status ${cm.manifestStatus}`);
        push(`KNOWN-BAD ${p}/DEBASE-HREF: and the apple-touch-icon 404s with it`, cm.appleStatus !== 200, `apple status ${cm.appleStatus}`);
      }
      console.log(`  KNOWN-BAD ${kind.padEnd(12)} manifest ${cm.manifestStatus ?? '—'}  icons ${cm.icons?.map((i) => i.status).join(',') || '—'}  start ${cm.startUrl ? new URL(cm.startUrl).pathname : '—'}`);
    }
    console.log('');
  }
  if (!KEEP) rmSync(dist, { recursive: true, force: true });
}

// ── the row that matters most: the tree as it was before this pass ──────────
{
  const headTree = freeze([]);      // pure HEAD, no overlay
  trees.push(headTree);
  const dist = build(headTree, '/food-arena/');
  const r = await probe(dist, '/food-arena/', 'NO-MANIFEST');
  const m = r.m;
  console.log(`  NO-MANIFEST (pure HEAD, base /food-arena/)`);
  console.log(`    <link rel=manifest>   ${JSON.stringify(m.link)}`);
  console.log(`    apple-touch-icon      ${m.apple ? m.apple.attr : 'ABSENT'}`);
  console.log(`    apple-capable meta    ${JSON.stringify(m.metas?.['apple-mobile-web-app-capable'])}`);
  push('KNOWN-BAD NO-MANIFEST: HEAD really has no <link rel=manifest> — the gate would have FIRED on the state this pass found', !m.manifest, String(m.link));
  push('KNOWN-BAD NO-MANIFEST: …and no apple-mobile-web-app-capable either', m.metas?.['apple-mobile-web-app-capable'] === null, String(m.metas?.['apple-mobile-web-app-capable']));
  push('KNOWN-BAD NO-MANIFEST: …and no apple-touch-icon, so iOS uses a page screenshot', !m.apple, String(m.apple?.attr));
  push('POSITIVE CONTROL: HEAD still loads clean otherwise (the probe is not simply broken)', r.bad.length === 0, r.bad.join(' | ') || 'clean');
  if (!KEEP) rmSync(dist, { recursive: true, force: true });
  console.log('');
}

if (!KEEP) for (const t of trees) rmSync(t, { recursive: true, force: true });

let fails = 0;
for (const [n, ok, d] of checks) { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}   (${d})`); }
console.log(`\n  ${checks.length - fails}/${checks.length}\n`);
process.exitCode = fails ? 1 : 0;
