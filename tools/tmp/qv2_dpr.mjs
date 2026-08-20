#!/usr/bin/env node
/**
 * qv2_dpr — INDEPENDENT re-derivation of the character screen's drawing-buffer size.
 *
 * Written to REFUTE, not to confirm, a peer's claim (angle A / `qb_dpr.mjs`):
 *
 *   "tier `low`, pixelRatio 1.25, cap 1.25, buffer 458x202 (characters) —
 *    IDENTICAL on both the emulated iPhone 15 Pro AND desktop"
 *
 * Two things about that sentence are testable and this tool tests them separately:
 *
 *  1. Is the 1.25 cap the SAME on the oldest and newest deployed gh-pages trees?
 *     (If yes it is a CONSTANT and cannot be the CHANGE Uri reported.)
 *  2. Does a REAL desktop profile really read the same tier/ratio/buffer?
 *     ⚠️ `qb_dpr.mjs` hardcodes `isMobile: true, hasTouch: true` on EVERY context
 *     (lines 286-287 and 490), so its "desktop" arm is still a touch device to
 *     `quality.ts:detectTier`, which gates on `matchMedia('(pointer: coarse)')` and
 *     `navigator.maxTouchPoints`. A "desktop" arm that cannot reach the `!touchPrimary`
 *     branch is not a desktop arm. This tool builds a genuine one.
 *
 * ── What makes a number here trustworthy ───────────────────────────────────────
 *  * DRIFT CONTROL (rule 4): the page is read back TWICE with nothing changed in
 *    between and the two reads must be EXACTLY equal on every numeric field. A cell
 *    with drift != 0 is reported as INVALID, never averaged.
 *  * NON-EMPTY FIRST (rule 6): the on-screen canvas set is asserted non-empty BEFORE
 *    anything is asserted over it. `[].every()` is `true`.
 *  * KNOWN-BAD (rule 6): `--knownbad` re-runs the identical cell with `&tier=high`,
 *    which MUST move the ratio 1.25 -> 2. An instrument that returns the same string
 *    on both tiers is measuring a constant and its "identical" results mean nothing.
 *  * The trees served are `git archive` exports of COMMITTED gh-pages SHAs — the exact
 *    bytes the phone downloaded. Nothing inside a built bundle runs `git`, which is
 *    the one case CLAUDE.md rule 8 still endorses `git archive` for.
 *
 * ── What this tool does NOT claim ──────────────────────────────────────────────
 * SwiftShader is not an A17. Drawing-buffer integers are engine-independent and
 * quotable; sharpness-as-perceived, frame time and iOS memory behaviour are not
 * measured here and must not be inferred.
 *
 *   node tools/tmp/qv2_dpr.mjs --tree <dir> --label new --profile phone
 *   node tools/tmp/qv2_dpr.mjs --tree <dir> --label new --profile desktop
 *   node tools/tmp/qv2_dpr.mjs --tree <dir> --label new --profile phone --knownbad
 *   node tools/tmp/qv2_dpr.mjs --selftest
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

const BASE_PATH = get('--basepath', '/food-arena/');
const ROUTES = get('--routes', 'home,characters').split(',').map((s) => s.trim());

/**
 * The two profiles. The ONLY difference that matters to `detectTier` is
 * `isMobile`/`hasTouch` (the `touchPrimary` gate) and the SCREEN short edge (<= 500).
 * Viewport 393x659 is Playwright's own `iPhone 15 Pro` visible viewport; `screen` is
 * the 393x852 panel, and `quality.ts` reads `window.screen`, not the viewport.
 */
const PROFILES = {
  phone: {
    viewport: { width: 393, height: 659 },
    screen: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
      + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  // A GENUINE desktop: no touch, no isMobile, DPR 1, a large screen.
  desktop: {
    viewport: { width: 1280, height: 800 },
    screen: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

const READY = {
  home: 'home',
  characters: 'characters',
};

const READBACK = () => {
  const rects = [];
  for (const c of Array.from(document.querySelectorAll('canvas'))) {
    const r = c.getBoundingClientRect();
    rects.push({
      cls: c.className || null,
      bufW: c.width,
      bufH: c.height,
      cssW: Math.round(r.width * 100) / 100,
      cssH: Math.round(r.height * 100) / 100,
      onScreen: r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
        && r.left < window.innerWidth && r.top < window.innerHeight,
      ratioW: r.width > 0 ? Math.round((c.width / r.width) * 10000) / 10000 : null,
    });
  }
  const q = window.__quality ?? {};
  const stages = (window.__stages ?? []).map((s) => {
    try {
      return {
        pixelRatio: s.renderer?.getPixelRatio?.() ?? null,
        w: s.canvas?.width ?? null,
        h: s.canvas?.height ?? null,
      };
    } catch { return null; }
  });
  return {
    screen: window.__screen ?? null,
    dpr: window.devicePixelRatio,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    screenW: window.screen?.width ?? null,
    screenH: window.screen?.height ?? null,
    coarse: typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches : null,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    tier: q.tier ?? window.__renderTier ?? null,
    detected: q.detected ?? null,
    forced: q.forced ?? null,
    cap: q.profile?.pixelRatioCap ?? null,
    bloom: q.profile?.bloom ?? null,
    smaa: q.profile?.smaa ?? null,
    canvases: rects,
    stages,
  };
};

function key(m) {
  return JSON.stringify({
    tier: m.tier, cap: m.cap, dpr: m.dpr,
    canvases: m.canvases.map((c) => [c.bufW, c.bufH, c.cssW, c.cssH, c.onScreen]),
    stages: m.stages,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validates the DIFFER and the NON-EMPTY guard. NOT where it points.
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  const mk = (bufW, cap) => ({
    tier: cap === 1.25 ? 'low' : 'high', cap, dpr: 3,
    canvases: [{ bufW, bufH: 202, cssW: 366.4, cssH: 161.6, onScreen: true }],
    stages: [{ pixelRatio: cap, w: bufW, h: 202 }],
  });
  const same = key(mk(458, 1.25)) === key(mk(458, 1.25));
  const diff = key(mk(458, 1.25)) !== key(mk(733, 2));
  // The vacuity arm: an EMPTY on-screen set must be a FAILURE, not a pass.
  const empty = [];
  const vacuousPass = empty.every((c) => c.bufW === 999999); // true — the bug
  const guarded = empty.length > 0 && empty.every((c) => c.bufW === 999999);
  const ok = same && diff && vacuousPass === true && guarded === false;
  console.log(`selftest: identical->0 drift ${same ? 'PASS' : 'FAIL'}`);
  console.log(`selftest: 1.25 vs 2 differs ${diff ? 'PASS' : 'FAIL'}`);
  console.log(`selftest: [].every() is ${vacuousPass} — guard rejects it: ${guarded === false ? 'PASS' : 'FAIL'}`);
  console.log(ok ? 'SELFTEST PASS' : 'SELFTEST FAIL');
  process.exit(ok ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
const TREE = get('--tree', null);
const LABEL = get('--label', 'tree');
const PROFILE = get('--profile', 'phone');
if (!TREE) { console.error('need --tree <dir>'); process.exit(2); }
if (!PROFILES[PROFILE]) { console.error(`unknown --profile ${PROFILE}`); process.exit(2); }

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serve(root) {
  return new Promise((res) => {
    const srv = createServer(async (req, rq) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length - 1);
      if (p === '/' || p === '') p = '/index.html';
      const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      try {
        const buf = await readFile(file);
        rq.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
        rq.end(buf);
      } catch {
        rq.writeHead(404).end('nf');
      }
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

async function cell(browser, baseUrl, route, extra) {
  const ctx = await browser.newContext(PROFILES[PROFILE]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = `${baseUrl}?screen=${route}${extra ? `&${extra}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    (want) => window.__screenReady === true && window.__screen === want,
    READY[route], { timeout: 120_000 },
  );
  // `__screenReady` IS NOT A PAINT, and the ResizeObserver fires after the mount.
  await page.waitForTimeout(1500);
  const a = await page.evaluate(READBACK);
  const b = await page.evaluate(READBACK);           // DRIFT CONTROL: must be exactly equal
  const drift = key(a) === key(b) ? 0 : 1;
  const on = a.canvases.filter((c) => c.onScreen);
  await ctx.close();
  return { url, m: a, drift, onScreenCount: on.length, on, errors };
}

const { srv, port } = await serve(TREE);
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ args: LAUNCH_ARGS });
let bad = 0;
const out = { label: LABEL, tree: TREE, profile: PROFILE, cells: [] };
try {
  for (const route of ROUTES) {
    const c = await cell(browser, baseUrl, route);
    // NON-EMPTY FIRST. Zero on-screen canvases makes every assertion below vacuous.
    if (c.onScreenCount === 0) { console.log(`  ${route}: NO ON-SCREEN CANVAS — VACUOUS, FAIL`); bad++; }
    if (c.drift !== 0) { console.log(`  ${route}: DRIFT != 0 — cell INVALID`); bad++; }
    const m = c.m;
    console.log(`[${LABEL}/${PROFILE}] ${route}: tier=${m.tier} detected=${m.detected} cap=${m.cap} `
      + `dpr=${m.dpr} coarse=${m.coarse} touchPts=${m.maxTouchPoints} screen=${m.screenW}x${m.screenH} `
      + `vp=${m.innerW}x${m.innerH} drift=${c.drift}`);
    for (const cv of c.on) {
      console.log(`     canvas buf=${cv.bufW}x${cv.bufH} css=${cv.cssW}x${cv.cssH} ratio=${cv.ratioW}`);
    }
    if (c.errors.length) console.log(`     pageerrors: ${c.errors.slice(0, 2).join(' | ')}`);
    out.cells.push({ route, ...c });

    if (has('--knownbad')) {
      const kb = await cell(browser, baseUrl, route, 'tier=high');
      const moved = key(kb.m) !== key(c.m);
      console.log(`     KNOWN-BAD tier=high: tier=${kb.m.tier} cap=${kb.m.cap} `
        + `buf=${kb.on.map((x) => `${x.bufW}x${x.bufH}`).join(',')} -> instrument `
        + `${moved ? 'SEES the change (valid)' : 'BLIND (INVALID)'}`);
      if (!moved) bad++;
      out.cells.push({ route: `${route}#knownbad`, ...kb });
    }
  }
} finally {
  await browser.close();
  srv.close();
}
if (get('--json', null)) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(get('--json'), JSON.stringify(out, null, 2));
}
process.exit(bad ? 1 : 0);
