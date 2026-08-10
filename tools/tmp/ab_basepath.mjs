#!/usr/bin/env node
/**
 * BASE PATH — does the SHIPPED bundle survive a base that is neither `/` nor `/food-arena/`?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `docs/AGENT-BRIEF.md` rule 8: **measure the artefact you SHIP, on the PATH you ship it
 * to.** This project has already paid for that once. `src/audio/music.ts` carried the
 * hand-written literal `'/audio/bounce-and-bash.mp3'`. Vite rewrites the asset URLs it
 * **resolves** at build time — module imports, and `/x` inside HTML and CSS — and it does
 * **not** rewrite string literals inside TypeScript, because it has no way to know one is
 * a URL. So under `DEPLOY_BASE=/food-arena/` every other asset shipped as
 * `/food-arena/assets/…` and the theme alone shipped as `/audio/…`: a 404 on GitHub
 * Pages, on every load, forever. **427 audio assertions survived it, because every one of
 * them pointed at a server rooted at `/`, where the bug does not exist.**
 *
 * Uri now wants the game as a mobile app. **A wrapper is a THIRD base.** It does not serve
 * from `/` and it does not serve from `/food-arena/` — it serves from a custom scheme, a
 * loopback origin, or a subdirectory nobody has picked yet. Every existing gate in this
 * repo runs at `/`; `aud_menu_silence.mjs --selftest` is the only one that has ever built
 * at a second base, and it only checks ONE asset (the theme) through ONE sense (audio RMS).
 *
 * So this gate builds at a base **chosen so that neither of the two shipped bases would
 * pass by accident**, serves the built `dist/` from exactly that prefix behind a server
 * that **404s everything outside it**, and requires every route and every asset to answer.
 *
 * ── Modelled on `tools/verify-head.mjs --serve`, deliberately not merged into it ──
 *
 * `verify-head.mjs` boots **`npx vite`** — the DEV server — against a `git archive` of
 * HEAD and fetches `/`, `/preview.html`, `/src/main.ts`. That is the right instrument for
 * its question ("does the committed tree resolve and serve?") and it is structurally
 * incapable of this one: the dev server has no `base` rewriting to get wrong, emits no
 * `dist/`, and serves `/src/main.ts` — a path that does not exist in any shipped artefact.
 * The freeze-HEAD-and-symlink-node_modules pattern, the free-port helper and the route
 * list are lifted from it; the subject is a **production build**, which is a different
 * artefact and needs a different tool.
 *
 * ── The three senses, because each one is blind to the others ───────────────
 *
 *  1. **LITERALS** — a static audit of every emitted chunk. Any `/assets/…` or `/audio/…`
 *     string literal that does not begin with the build's base is the music.ts bug again.
 *     This is the only sense that can see a URL the app never happens to request.
 *  2. **STATIC CRAWL** — fetch each HTML route, extract every `src`/`href`, resolve it
 *     against the document URL, fetch it, and require a 200 **whose body is not
 *     `index.html`**. That last clause is load-bearing: an SPA fallback that answers 200
 *     for a missing `.js` is exactly how a 404 hides, and `aud_menu_silence.mjs` records
 *     that the first version of its own server did precisely that and reported a green
 *     result on a bundle that provably contained the broken literal (instrument fault #20).
 *  3. **LIVE** — Playwright loads the route, supplies one real click (an autoplay policy
 *     is waiting for a trusted gesture, and the theme is fetched only after unlock), then
 *     requires: the named screen mounted, a canvas present, and **zero** responses ≥400,
 *     **zero** failed requests, **zero** page errors. This is the only sense that can see
 *     a URL built at runtime.
 *
 * A cell PASSES only if all three agree.
 *
 * ── The cells ───────────────────────────────────────────────────────────────
 *
 *   | cell        | build base            | served at             | expect |
 *   |-------------|-----------------------|-----------------------|--------|
 *   | PAGES       | `/food-arena/`        | `/food-arena/`        | PASS   | the live deploy — regression guard
 *   | WRAPPER     | `./`                  | `/app/v1/wrap/`       | PASS   | THE GATE — a third base
 *   | BAD-BASE    | `/`                   | `/app/v1/wrap/`       | FAIL   | known-bad control
 *   | BAD-LITERAL | `/food-arena/` + patch| `/food-arena/`        | FAIL   | known-bad control (--selftest)
 *
 * **BAD-BASE and BAD-LITERAL are not optional colour.** `CLAUDE.md` §6: a guard that has
 * not been shown to FAIL on the bug it guards against is not a guard, and nineteen
 * instruments on this project were caught returning confident wrong answers in one
 * session. BAD-BASE proves the server really does 404 outside its base — without it, a
 * host that answers anything would make every cell green and the gate would be a comment
 * with a tick next to it. BAD-LITERAL re-introduces the **historical music.ts literal
 * verbatim** into the frozen source and requires this tool to catch it.
 *
 * ── The `file://` row is INFORMATIONAL, and it is the headline finding ──────
 *
 * A wrapper that loads `index.html` off disk over `file://` **cannot run this bundle at
 * all**, and it is nothing to do with the base. Vite emits `<script type="module">`; a
 * module script is fetched with CORS, a `file://` document has an opaque origin, so
 * Chromium blocks it: `net::ERR_FAILED`, zero canvases, the boot curtain reads
 * *"Heating the kitchen…"* forever. Measured, with the base resolving perfectly
 * (`./assets/main-*.js` was the correct URL). It is therefore reported, not asserted —
 * asserting it would make this gate fail on the day a wrapper fixes it. `docs/APP.md`
 * carries the consequence: **the wrapper must supply a scheme, not a file path.**
 *
 * ── Use ─────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/ab_basepath.mjs                 # PAGES + WRAPPER + BAD-BASE
 *   node tools/tmp/ab_basepath.mjs --selftest      # + BAD-LITERAL + the file:// row
 *   node tools/tmp/ab_basepath.mjs --unlock        # does the FIRST tap unlock audio? (phone-shaped)
 *   node tools/tmp/ab_basepath.mjs --from worktree # build everyone's live edits instead
 *   node tools/tmp/ab_basepath.mjs --base /x/y/    # pick a different third base
 *
 * Default tree is `HEAD` — `aud_menu_silence.mjs` records why: a `vite build` compiles the
 * whole tree, so with six agents saving files a peer's half-typed line fails this gate on
 * a file its author never opened.
 */

import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync,
  symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import net from 'node:net';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);

/**
 * The third base.
 *
 * Deliberately **two segments deep and named nothing like the repo**, so that a build
 * made for `/` or for `/food-arena/` cannot pass here by coincidence — the failure mode
 * this whole tool exists to expose is a URL that happens to be right at one base.
 */
const THIRD_BASE = get('base', '/app/v1/wrap/');

/** Routes fetched at every base. `/preview.html` is the second Rollup input. */
const HTML_ROUTES = ['', 'preview.html'];
/** Screens the live pass mounts. Named, because `__screenReady` is not a paint. */
const LIVE_ROUTES = [
  { q: 'screen=home', screen: 'home' },
  { q: 'screen=match&player=hamburger&enemy=donut', screen: 'match' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
};
/** Extensions that must NEVER be answered by the SPA fallback. See `serve()`. */
const ASSET_EXT = new Set(Object.keys(MIME).filter((e) => e !== '.html'));

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
    s.on('error', rej);
  });
}

// ───────────────────────────── the strict host ───────────────────────────────
/**
 * Serve `dir` under `base`, and **404 everything else**.
 *
 * Two rules, both of which a lenient static server breaks and both of which cost this
 * project a green result on a broken bundle:
 *
 *  1. **Outside the base is a hard 404.** GitHub Pages serves a project site from
 *     `/<repo>/` and the apex holds nothing; a wrapper serving `/app/v1/wrap/` holds
 *     nothing above it either. A host that answers outside its base models neither.
 *  2. **The SPA fallback only covers extensionless paths.** `/assets/main-x.js` missing
 *     must be a 404, not a 200 of `index.html`. Vite's dev server returns 200 for
 *     anything (`docs/LESSONS.md` §12) and `playtest.mjs`'s server falls back
 *     unconditionally — correct for playing, fatal for measuring.
 */
async function serve(dir, base) {
  const port = await freePort();
  const b = base === '/' ? '/' : `/${base.replace(/^\/|\/$/g, '')}/`;
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (b !== '/') {
      if (p === b.slice(0, -1)) p = '/';
      else if (p.startsWith(b)) p = `/${p.slice(b.length)}`;
      else { res.writeHead(404, { 'content-type': 'text/plain' }); res.end(`outside base ${b}`); return; }
    }
    const rel = normalize(p).replace(/^(\.\.[/\\])+/, '');
    let file = join(dir, rel);
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { /* below */ }
    if (!existsSync(file)) {
      if (ASSET_EXT.has(extname(rel).toLowerCase())) {
        res.writeHead(404, { 'content-type': 'text/plain' }); res.end(`no such asset: ${rel}`); return;
      }
      file = join(dir, 'index.html');   // an app route, not a file
    }
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-length': body.length });
    res.end(body);
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${port}`, base: b, url: `http://127.0.0.1:${port}${b}`, close: () => new Promise((r) => server.close(r)) };
}

// ───────────────────────── sense 1: the literal audit ────────────────────────
function walkFiles(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walkFiles(p, out); else out.push(p);
  }
  return out;
}

/**
 * Every root-absolute asset literal in the emitted chunks must begin with the build base.
 *
 * ⚠️ Kept NARROW on purpose. A lint that cries wolf gets ignored, which is worse than no
 * lint (`docs/LESSONS.md` §9, twice). So it flags a `/…` literal only when it points at
 * something the build actually EMITS — a top-level directory of `dist/` (`assets`,
 * `audio`) — or ends in a known asset extension. `/food-arena/` itself is the base and is
 * allowed; a namespace like `http://www.w3.org/1999/xhtml` does not start with `/` and is
 * never seen. On the tree this was written against the finding set is **empty at all
 * three bases**, so any hit is news.
 */
function auditLiterals(dist, base) {
  const emitted = readdirSync(dist).filter((e) => statSync(join(dist, e)).isDirectory());
  const findings = [];
  const isAsset = (s) => ASSET_EXT.has(extname(s.split('?')[0]).toLowerCase());
  const owned = (s) => emitted.some((d) => s === `/${d}` || s.startsWith(`/${d}/`));
  for (const f of walkFiles(dist)) {
    if (!['.js', '.mjs', '.css'].includes(extname(f))) continue;
    const src = readFileSync(f, 'utf8');
    const seen = new Set();
    for (const m of src.matchAll(/(["'`])(\/[A-Za-z0-9_\-.~/]{2,}?)\1/g)) {
      const lit = m[2];
      if (seen.has(lit)) continue;
      seen.add(lit);
      if (!owned(lit) && !isAsset(lit)) continue;         // not an asset URL at all
      if (base !== '/' && lit.startsWith(base)) continue; // correctly based
      if (base === '/') continue;                          // at `/` every path is "right"
      findings.push(`${f.slice(dist.length + 1)}  →  ${lit}`);
    }
    for (const m of src.matchAll(/url\(\s*["']?(\/[^"')]+)/g)) {
      if (base !== '/' && !m[1].startsWith(base)) findings.push(`${f.slice(dist.length + 1)}  →  css url(${m[1]})`);
    }
  }
  return findings;
}

// ───────────────────────── sense 2: the static crawl ─────────────────────────
async function fetchText(url) {
  const r = await fetch(url, { redirect: 'manual' });
  return { status: r.status, type: r.headers.get('content-type') || '', body: await r.text() };
}

/**
 * Fetch every HTML route, then every `src`/`href` it names, resolved the way a browser
 * would — against the DOCUMENT url, which is what makes a `./assets/…` build work under
 * any prefix and a `/assets/…` build fail under all but one.
 */
async function crawl(baseUrl) {
  const problems = [];
  const fetched = [];
  for (const route of HTML_ROUTES) {
    const docUrl = new URL(route, baseUrl).href;
    const doc = await fetchText(docUrl);
    if (doc.status !== 200) { problems.push(`${doc.status} on route ${docUrl}`); continue; }
    if (!/<div id="game">|<div id="stage">/.test(doc.body)) problems.push(`route ${docUrl} answered 200 with a body that is not an app shell`);
    fetched.push(`${doc.status} ${route || '(index)'}`);

    const refs = [...doc.body.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const ref of refs) {
      if (/^(?:https?:)?\/\//i.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) continue;
      const abs = new URL(ref, docUrl).href;
      const r = await fetchText(abs);
      if (r.status !== 200) { problems.push(`${r.status} on ${ref}  (from ${route || 'index'})`); continue; }
      // An SPA fallback answering 200 with index.html is a 404 wearing a disguise.
      if (/<div id="boot">/.test(r.body) && !ref.endsWith('.html')) {
        problems.push(`200-but-index on ${ref} — the host fell back; this is a MASKED 404`);
        continue;
      }
      fetched.push(`${r.status} ${ref}`);
    }
  }
  return { problems, fetched };
}

// ───────────────────────────── sense 3: the live pass ────────────────────────
async function live(browser, baseUrl, { q, screen }) {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`http ${r.status()} ${r.url().slice(0, 120)}`); });
  page.on('requestfailed', (r) => {
    const u = r.url();
    // Google Fonts is an external CDN and its reachability is not what this gate measures.
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return;
    bad.push(`failed ${u.slice(0, 120)} — ${r.failure()?.errorText ?? '?'}`);
  });
  page.on('pageerror', (e) => bad.push(`pageerror ${String(e).slice(0, 140)}`));

  const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + q;
  let mounted = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    // One real, trusted gesture: the autoplay policy is waiting for it, and the theme
    // is only fetched after unlock — so without this click the 404 under test never fires.
    await page.mouse.click(450, 250);
    await page.waitForFunction((s) => window.__screen === s, screen, { timeout: 40_000 });
    mounted = screen;
  } catch { /* mounted stays null; the caller reports it */ }
  await page.waitForTimeout(1800);   // give the theme's request time to land
  const dom = await page.evaluate(() => ({
    screen: window.__screen ?? null,
    canvases: document.querySelectorAll('canvas').length,
    booted: document.getElementById('boot')?.classList.contains('hidden') ?? null,
    music: window.__audio?.music ?? null,
  })).catch(() => ({ screen: null, canvases: 0, booted: null, music: null }));
  await page.close();

  const problems = [...bad];
  if (dom.screen !== screen) problems.push(`screen never mounted (wanted '${screen}', got ${JSON.stringify(dom.screen)})`);
  if (dom.canvases < 1) problems.push('no canvas in the document — the renderer never started');
  if (dom.music && dom.music.error) problems.push(`music reports error: ${dom.music.error}`);
  return { problems, dom, url, mounted };
}

// ───────────────────────────── freeze + build ────────────────────────────────
const INCLUDE = ['src', 'public', 'index.html', 'preview.html', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json'];

function freeze(from) {
  const dir = mkdtempSync(join(tmpdir(), 'fa-abbase-'));
  if (from === 'head') {
    const a = spawnSync('sh', ['-c', `git -C ${JSON.stringify(ROOT)} archive HEAD | tar -x -C ${JSON.stringify(dir)}`], { encoding: 'utf8' });
    if (a.status !== 0) throw new Error(`git archive HEAD failed: ${a.stderr}`);
  } else {
    for (const e of INCLUDE) {
      const src = join(ROOT, e);
      if (existsSync(src)) cpSync(src, join(dir, e), { recursive: true });
    }
  }
  // The theme is the one asset that is NOT resolved by Vite — it lives in `public/` and
  // is the entire reason this class of bug exists here. A run against a tree without it
  // would be the same kind of lie this gate was built to catch.
  if (!existsSync(join(dir, 'public/audio/bounce-and-bash.mp3'))) {
    throw new Error('frozen tree has no theme at public/audio/bounce-and-bash.mp3 — this gate would be meaningless');
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return dir;
}

function build(srcDir, base, outName) {
  const r = spawnSync('npx', ['vite', 'build', '--outDir', outName, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: srcDir, env: { ...process.env, DEPLOY_BASE: base }, encoding: 'utf8',
  });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`vite build (base=${base}) failed`); }
  const out = join(srcDir, outName);
  if (!existsSync(join(out, 'index.html'))) throw new Error(`no index.html in ${out}`);
  return out;
}

/**
 * KNOWN-BAD INJECTION — the historical bug, verbatim.
 *
 * `src/audio/music.ts` builds its URL off `import.meta.env.BASE_URL`. This rewrites that
 * one expression back to the literal it used to be. Nothing else in the tree changes, so
 * the BAD-LITERAL cell differs from PAGES in exactly one token — which is the only way a
 * control means anything.
 */
function injectBadLiteral(srcDir) {
  const f = join(srcDir, 'src/audio/music.ts');
  const src = readFileSync(f, 'utf8');
  const NEEDLE = 'const TRACK_URL = `${BASE_URL.endsWith(\'/\') ? BASE_URL : `${BASE_URL}/`}audio/bounce-and-bash.mp3`;';
  if (!src.includes(NEEDLE)) {
    throw new Error(`ab_basepath: cannot inject the known-bad literal — music.ts no longer contains the expected TRACK_URL line.\n  This gate's control is now VOID; fix the needle before trusting any row.`);
  }
  writeFileSync(f, src.replace(NEEDLE, "const TRACK_URL = '/audio/bounce-and-bash.mp3';  // KNOWN-BAD INJECTION"));
}

// ─────────────────────────────── a whole cell ────────────────────────────────
async function cell(browser, { tag, label, dist, base, servedAt, expect }) {
  const s = await serve(dist, servedAt);
  const lits = auditLiterals(dist, base);
  const c = await crawl(s.url);
  const liveRuns = [];
  for (const r of LIVE_ROUTES) liveRuns.push(await live(browser, s.url, r));
  await s.close();

  const problems = [
    ...lits.map((x) => `LITERAL   ${x}`),
    ...c.problems.map((x) => `CRAWL     ${x}`),
    ...liveRuns.flatMap((r, i) => r.problems.map((x) => `LIVE[${LIVE_ROUTES[i].screen}] ${x}`)),
  ];
  const pass = problems.length === 0;

  console.log(`\n── ${tag.padEnd(11)} ${label}`);
  console.log(`   built base=${base}   served at ${s.url}`);
  console.log(`   literals: ${lits.length ? `${lits.length} FINDING(S)` : 'clean'}   crawl: ${c.fetched.length} fetched, ${c.problems.length} problem(s)`);
  for (let i = 0; i < liveRuns.length; i++) {
    const r = liveRuns[i];
    console.log(`   live ${LIVE_ROUTES[i].screen.padEnd(6)}: screen=${JSON.stringify(r.dom.screen)} canvases=${r.dom.canvases} boot-hidden=${r.dom.booted}${r.dom.music ? ` music.err=${r.dom.music.error ?? 'none'}` : ''}`);
  }
  for (const p of problems.slice(0, 12)) console.log(`   ✗ ${p}`);
  if (problems.length > 12) console.log(`   … and ${problems.length - 12} more`);
  console.log(`   ⇒ ${pass ? 'PASS' : 'FAIL'}   (expected ${expect ? 'PASS' : 'FAIL'})`);
  return { tag, label, pass, expect, problems };
}

// ─────────────────── informational: does file:// work at all? ────────────────
/**
 * NOT a pass/fail row. See the header: a `file://` document has an opaque origin, so a
 * `<script type="module">` is a blocked cross-origin fetch and the app never boots. This
 * is a property of the SCHEME, not of the base or of anything in `src/`. Reported so the
 * number is durable and so `docs/APP.md`'s claim is re-measurable, and deliberately not
 * asserted — the day a wrapper makes it work, this gate must not fail for it.
 */
async function fileScheme(browser, dist) {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  const events = [];
  page.on('requestfailed', (r) => events.push(`${r.failure()?.errorText ?? '?'} ${r.url().split('/').pop()}`));
  const url = `${pathToFileURL(join(dist, 'index.html')).href}?screen=home`;
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 }).catch(() => {});
  await page.mouse.click(450, 250);
  await page.waitForFunction(() => window.__screen, null, { timeout: 20_000 }).catch(() => {});
  const dom = await page.evaluate(() => ({
    screen: window.__screen ?? null,
    canvases: document.querySelectorAll('canvas').length,
    boot: document.getElementById('boot')?.textContent?.trim().slice(0, 40) ?? null,
    origin: location.origin,
    storage: (() => { try { localStorage.setItem('_ab', '1'); localStorage.removeItem('_ab'); return 'ok'; } catch (e) { return `THROWS ${String(e).slice(0, 50)}`; } })(),
  })).catch(() => null);
  await page.close();
  console.log(`\n── file://  (INFORMATIONAL — not a pass/fail row)`);
  console.log(`   ${url.slice(0, 100)}…`);
  console.log(`   screen=${JSON.stringify(dom?.screen)} canvases=${dom?.canvases} boot="${dom?.boot}" origin=${dom?.origin} localStorage=${dom?.storage}`);
  for (const e of [...new Set(events)].slice(0, 4)) console.log(`   request: ${e}`);
  console.log(`   ⇒ ${dom?.screen ? 'BOOTS' : 'BLOCKED — a module script cannot be fetched from an opaque file:// origin'}`);
  return { boots: !!dom?.screen };
}

// ───────────────── --unlock: does the FIRST tap unlock the audio? ────────────
/**
 * THE AUDIO UNLOCK, measured on a phone-shaped touch device at the WRAPPER base.
 *
 * A wrapper cannot autoplay. Mobile autoplay policy needs a trusted gesture before an
 * `AudioContext` will run and before an `<audio>` element will play, and the game's whole
 * menu soundtrack plus every UI click depends on that unlock happening. So: **does the
 * first tap do it, or does the player have to tap twice?**
 *
 * The cold-launch route is used, with **no query string at all** — `main.ts:bootRoute`
 * sends a bare path to the title card, and that is exactly what a wrapper opens. Probes
 * that boot `?screen=home` are measuring a path no player takes on launch.
 *
 * ⚠️ **`--autoplay-policy=user-gesture-required` is forced**, and the NO-TAP control is
 * what proves it took: a measurement of "audio works" on a browser that never blocked
 * anything is worth nothing.
 *
 * 🚨 ── INSTRUMENT FAULT, CAUGHT BY THIS TOOL'S OWN CONTROL. READ BEFORE EDITING ──
 *
 * The first version of this probe read the engine state with `page.evaluate()` before the
 * tap. **`page.evaluate()` GRANTS TRANSIENT USER ACTIVATION.** Playwright issues it over
 * CDP with `userGesture: true`, so `navigator.userActivation.isActive` flips `false ->
 * true` at the moment of the call and stays true for the whole activation window.
 * Proved on `about:blank` with a page-side `setInterval` sampler and a single
 * `page.evaluate(() => 1)` at t≈1000 ms:
 *
 *     804ms  isActive=false      1205ms isActive=true
 *     1003ms isActive=false      1405ms isActive=true   … true for the rest of the run
 *
 * `audio/engine.ts:unlock()` gates context creation on exactly that flag, and
 * `ui/screens/opening.ts` calls `unlock()` from the title card's 4.5 s auto-continue
 * `setTimeout`. So the probe's own bookkeeping call handed the app a gesture it never
 * received, and **the NO-TAP control came back with the theme playing at rms 0.022346** —
 * a confident, reproducible, completely fictitious "audio works without a tap".
 *
 * The fix is structural, not a tolerance: **every observation is sampled by page-side
 * code installed with `addInitScript`, and there is exactly ONE `page.evaluate()` per
 * cell, at the very end.** `addInitScript` is not a gesture; a `setInterval` running in
 * the page is not a gesture; `page.waitForTimeout` is a node-side sleep and touches the
 * page not at all. The verdict is computed from the SAMPLES, never from the terminal
 * read, so the terminal read's own activation cannot reach backwards into it.
 *
 * ⚠️ This generalises: **any probe in this repo that evaluates before the gesture it is
 * measuring is measuring a gesture it supplied itself.** `page.waitForFunction` does it
 * too — same CDP path.
 */
async function unlockProbe(dist) {
  const s = await serve(dist, THIRD_BASE);
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist',
      '--autoplay-policy=user-gesture-required',
    ],
  });
  const run = async ({ tap, label }) => {
    // 844x390 with touch: Uri's decided orientation (DECISIONS §14 — landscape), on the
    // device class the touch controls were built for.
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const media = [];
    page.on('response', (r) => { if (/\.mp3(\?|$)/.test(r.url())) media.push(`${r.status()} ${r.url().split('/').pop()}`); });

    // The sampler. Page-side, installed before any app code runs, and never spoken to
    // again until the single terminal read. See the header: this is the whole design.
    await page.addInitScript(() => {
      window.__ab = { s: [], tapAt: null };
      // Page-side timestamp of the real tap. Capture phase, registered before any app
      // code, so it cannot be swallowed by a handler that navigates. This is what lets
      // the verdict say "before the tap" without asking the CDP channel anything.
      window.addEventListener('pointerdown', () => { if (window.__ab.tapAt === null) window.__ab.tapAt = Math.round(performance.now()); }, true);
      setInterval(() => {
        const h = window.__audio;
        window.__ab.s.push({
          t: Math.round(performance.now()),
          eng: h?.stats?.().state ?? null,
          ctx: h?.engine?.context?.state ?? null,
          ua: navigator.userActivation ? navigator.userActivation.isActive : null,
          scr: window.__screen ?? null,
          mus: h?.music?.playing ?? null,
        });
      }, 200);
    });

    await page.goto(s.url, { waitUntil: 'load', timeout: 60_000 });   // BARE path — the cold launch
    // 1.2 s of settle, then (optionally) ONE real tap. No evaluate has happened yet, so
    // `navigator.userActivation.isActive` is still false and the app has had no gesture.
    await page.waitForTimeout(1200);
    if (tap) await page.touchscreen.tap(422, 195);
    // Past the title card's 4.5 s auto-continue, so the NO-TAP cell is observed on the
    // same route the ONE-TAP cell ends on and the two differ only by the tap.
    await page.waitForTimeout(6000);

    const read = await page.evaluate(() => new Promise((res) => {
      const h = window.__audio;
      const base = {
        samples: window.__ab.s,
        tapAt: window.__ab.tapAt,
        music: h?.music ?? null,
        clock: h?.engine?.context ? +h.engine.context.currentTime.toFixed(2) : null,
      };
      const ctx = h?.engine?.context;
      if (!ctx || !h.connectTap) return res({ ...base, rms: null });
      const sp = ctx.createScriptProcessor(2048, 2, 1);
      let sum = 0, n = 0, blocks = 0;
      const done = () => { try { sp.disconnect(); } catch { /* gone */ } res({ ...base, rms: +Math.sqrt(sum / Math.max(1, n)).toFixed(6) }); };
      sp.onaudioprocess = (e) => { const d = e.inputBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; n++; } if (++blocks >= 40) done(); };
      sp.connect(ctx.destination); h.connectTap(sp);
      setTimeout(done, 5000);
    })).catch(() => ({ samples: [], tapAt: null, music: null, clock: null, rms: null }));
    await page.close();

    const ss = read.samples;
    const tapAt = read.tapAt;
    const final = ss[ss.length - 1] ?? null;
    // ⚠️ The first sample lands LATE — around 3.5 s — and that is not a bug in the
    // sampler. Boot blocks the main thread solidly while the WebGL scene is built, and a
    // blocked thread coalesces every pending `setInterval` tick into one. So the samples
    // are reported at the times they actually exist rather than at the times a reader
    // might assume; anything else would be inventing a measurement.
    const first = ss[0] ?? null;
    const before = tapAt === null ? first : (ss.filter((x) => x.t <= tapAt).pop() ?? null);
    const after = tapAt === null ? null : (ss.find((x) => x.t > tapAt) ?? null);
    // In NO-TAP nothing may ever grant activation. In ONE-TAP, nothing before the tap may.
    const uaEverBeforeTap = ss.some((x) => x.ua === true && (tapAt === null || x.t < tapAt));
    console.log(`\n── ${label}`);
    console.log(`   tap          : ${tapAt === null ? 'none supplied' : `page-side pointerdown at t=${tapAt} ms`}`);
    console.log(`   before tap   : ${before ? `t=${before.t}ms engine=${before.eng} ctx=${before.ctx} screen=${JSON.stringify(before.scr)} userActivation=${before.ua}` : '(no sample — the main thread was blocked by boot)'}`);
    if (after) console.log(`   after tap    : t=${after.t}ms engine=${after.eng} ctx=${after.ctx} userActivation=${after.ua}`);
    console.log(`   settled      : t=${final?.t}ms engine=${final?.eng} ctx=${final?.ctx} screen=${JSON.stringify(final?.scr)} music.playing=${final?.mus} clock=${read.clock}s`);
    console.log(`   theme        : err=${read.music?.error ?? 'none'}   bus rms=${read.rms}`);
    for (const m of media) console.log(`   mp3 request  : ${m}`);
    if (uaEverBeforeTap) console.log('   ⚠️ userActivation was TRUE before the tap — something granted a gesture. Discard this cell.');
    if (tap && tapAt === null) console.log('   ⚠️ the tap never reached the page — this cell measured nothing.');
    return { final, rms: read.rms, music: read.music, uaEverBeforeTap, tapSeen: tapAt !== null };
  };

  console.log('\n══ AUDIO UNLOCK — one tap, on a 844x390 touch device, at the wrapper base');
  const noTap = await run({ tap: false, label: 'NO-TAP   control — the policy must BLOCK this, or the row below is meaningless' });
  const oneTap = await run({ tap: true, label: 'ONE-TAP  the question: does the FIRST tap unlock it?' });
  await browser.close();
  await s.close();

  // `SOUND_FLOOR` 1e-4, the same discrimination `aud_menu_silence.mjs` states and for the
  // same reason: silence on this bus is EXACTLY zero (no voice ran, no sample was written)
  // and the theme measures ~0.022, so 1e-4 sits ~220x below the signal and infinitely
  // above the noise. No tolerance is being guessed.
  const policyOn = !noTap.uaEverBeforeTap && noTap.final?.eng !== 'running' && !(noTap.rms > 1e-4);
  const unlocked = !oneTap.uaEverBeforeTap && oneTap.tapSeen && oneTap.final?.eng === 'running' && oneTap.rms > 1e-4;
  console.log('\n── verdict');
  console.log(`  ${policyOn ? ' ok  ' : 'FAIL '} NO-TAP   engine=${noTap.final?.eng} rms=${noTap.rms} — autoplay policy is ${policyOn ? 'ENFORCED' : 'NOT ENFORCED; DISCARD THE ROW BELOW'}`);
  console.log(`  ${unlocked ? ' ok  ' : 'FAIL '} ONE-TAP  engine=${oneTap.final?.eng} rms=${oneTap.rms} — the first tap ${unlocked ? 'DOES' : 'does NOT'} unlock audio`);
  return policyOn && unlocked ? 0 : 1;
}

// ─────────────────────────────────── main ────────────────────────────────────
const from = get('from', 'head');
console.log(`BASE PATH — the shipped bundle at a THIRD base (${THIRD_BASE})`);
console.log(`  tree: ${from}${from === 'head' ? ` (${spawnSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim()})` : ' — working tree, includes every peer\'s live edits'}`);

// `--unlock` answers a different question (the audio gesture) on the same artefact, and
// needs its OWN browser because it forces `--autoplay-policy=user-gesture-required`.
if (has('unlock')) {
  const d = freeze(from);
  try {
    const code = await unlockProbe(build(d, './', 'dist-rel'));
    process.exit(code);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const dir = freeze(from);
let exitCode = 0;
const rows = [];
try {
  const distPages = build(dir, '/food-arena/', 'dist-pages');
  const distRel = build(dir, './', 'dist-rel');
  const distRoot = build(dir, '/', 'dist-root');

  rows.push(await cell(browser, { tag: 'PAGES', label: 'the live GitHub Pages deploy — must not regress', dist: distPages, base: '/food-arena/', servedAt: '/food-arena/', expect: true }));
  rows.push(await cell(browser, { tag: 'WRAPPER', label: `THE GATE — relative base under ${THIRD_BASE}`, dist: distRel, base: './', servedAt: THIRD_BASE, expect: true }));
  rows.push(await cell(browser, { tag: 'BAD-BASE', label: `control — a base=/ build under ${THIRD_BASE} MUST FAIL`, dist: distRoot, base: '/', servedAt: THIRD_BASE, expect: false }));

  if (has('selftest')) {
    await fileScheme(browser, distRel);
    // Patch, rebuild, and require the gate to catch the bug it was written for.
    injectBadLiteral(dir);
    const distBad = build(dir, '/food-arena/', 'dist-badlit');
    rows.push(await cell(browser, { tag: 'BAD-LITERAL', label: 'control — music.ts\'s historical `/audio/…` literal MUST FAIL', dist: distBad, base: '/food-arena/', servedAt: '/food-arena/', expect: false }));
  }

  console.log('\n── verdict');
  for (const r of rows) {
    const ok = r.pass === r.expect;
    if (!ok) exitCode = 1;
    console.log(`  ${ok ? ' ok  ' : 'FAIL '} ${r.tag.padEnd(12)} expected ${r.expect ? 'PASS' : 'FAIL'}, got ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  const controlsOk = rows.filter((r) => !r.expect).every((r) => r.pass === r.expect);
  if (!controlsOk) console.log('\n  THE INSTRUMENT IS NOT TRUSTWORTHY — a known-bad control PASSED. Do not act on the WRAPPER row.');
  else if (exitCode) console.log('\n  Controls are correct, so the failure above is REAL.');
  else console.log(`\n  ${rows.length}/${rows.length}. The bundle survives ${THIRD_BASE}; the Pages deploy is unchanged; both known-bad inputs were caught.`);
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(exitCode);
