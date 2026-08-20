#!/usr/bin/env node
/**
 * qv3_refute — an INDEPENDENT re-derivation of the resolution path, built to try to
 * BREAK angle B's claim rather than to confirm it.
 *
 * Angle B's cause: "tier `low`'s pixelRatioCap 1.25 governs the character screen on an
 * iPhone 15 Pro, so every menu and match frame is a 2.40x magnification of a smaller
 * render. LONG-STANDING, not a regression."
 *
 * Three questions decide whether that CAUSE explains what Uri reported, and this tool
 * asks all three off the SHIPPED BYTES rather than off source:
 *
 *   Q1 REPRODUCTION — is the ratio really ~0.416 at his device profile?
 *   Q2 DISCRIMINATION — Uri said "home screen, and MORE SPECIFICALLY character screen".
 *      A cause that lands identically on home, characters AND match cannot single one
 *      out. So home/characters/match are measured in the same run, same instrument.
 *   Q3 REGRESSION — Uri reported a CHANGE against his own earlier experience of the
 *      same URL. So the identical cell is run on the tree he liked (gh-pages 9cbc718,
 *      deploy of 8ca8f88) and the tree he is complaining about (gh-pages 5ecdc04).
 *      If the numbers are equal, the cause is a CONSTANT and a constant cannot be a
 *      change.
 *
 * ── WHY IT SERVES A COMMITTED TREE ───────────────────────────────────────────────
 * `CLAUDE.md` rule 2 / `AGENT-BRIEF.md` §3: `snapshot.mjs` freezes the WORKING tree, so
 * it stops peers editing during a run without removing what they already edited. Every
 * arm here is `git archive`d out of a gh-pages commit — the exact bytes the phone
 * downloaded — and served over http by a server that lives INSIDE this process (so
 * `CLAUDE.md` 8b's pattern-kill hazard cannot apply: nothing to kill, no PID to leak).
 * `git archive` is the right tool here precisely because nothing inside the export runs
 * `git` (rule 8's carve-out); it is wrong only as *a tree to run the gate battery in*.
 *
 * ── THE TWO THINGS THAT LICENCE A NUMBER (rules 4 and 6) ─────────────────────────
 *  1. DRIFT CONTROL. Every cell reads the live page TWICE with nothing changed between
 *     and requires the two reads to be EXACTLY equal on every numeric field. Rule 4's
 *     eighteenth case rendered plausibly and WRONGLY; a difference is only believable
 *     once identical input has been shown to produce zero.
 *  2. KNOWN-BAD ARM. `--knownbad` re-runs the same cell with `&tier=high` forced and
 *     ASSERTS the ratio MOVES (1.25 -> 2). An instrument that returns the same string
 *     whatever the tier is measuring a constant, not a tier.
 *     ⚠️ And the assertion set is checked NON-EMPTY first. `[].every()` is `true`, and
 *     that vacuity has fired at least seven times in this repo. Zero on-screen canvases
 *     is a FAILURE here, never a silent pass.
 *
 * ── WHAT THIS TOOL DOES NOT CLAIM ────────────────────────────────────────────────
 * SwiftShader is not an A17. Drawing-buffer integers, CSS box sizes and the tier that
 * detection picks are engine-independent and quotable. Frame time, perceived sharpness
 * and iOS memory behaviour are NOT measured and must not be inferred.
 *
 *   node tools/tmp/qv3_refute.mjs --tree <dir> --label live --routes home,characters,match
 *   node tools/tmp/qv3_refute.mjs --tree <dir> --label live --knownbad
 *   node tools/tmp/qv3_refute.mjs --tree <dir> --label live --select donut --shot <dir>
 *   node tools/tmp/qv3_refute.mjs --selftest
 *
 * Exit 1 on drift, on an empty assertion set, or on a failed known-bad.
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname, resolve } from 'node:path';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

/**
 * Uri's device. `isMobile`+`hasTouch` are NOT cosmetic: `quality.ts:detectTier` gates on
 * `matchMedia('(pointer: coarse)')`, and without them Chromium reports a desktop and
 * detection returns `high` — a tier his phone never selects.
 *
 * The viewport and `screen` are DIFFERENT numbers on this device and they feed different
 * things: the viewport decides how tall the portrait panel is laid out; `screen` is what
 * `qualitySignals` reads for `screenShortEdgeCssPx`, i.e. which TIER is chosen. Playwright's
 * own descriptor records 393x659 visible against a 393x852 panel.
 */
const DEVNAME = get('--device', 'iPhone 15 Pro');
const D = devices[DEVNAME];
if (!D) { console.error(`unknown --device ${DEVNAME}`); process.exit(2); }

const BASE_PATH = get('--basepath', '/food-arena/');
const SELECT = get('--select', null);
const SHOTDIR = get('--shot', null);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

async function serveTree(root) {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length - 1);
      if (p === '/' || p === '') p = '/index.html';
      const file = join(root, p);
      if (!resolve(file).startsWith(resolve(root))) { res.writeHead(403).end(); return; }
      const st = await stat(file).catch(() => null);
      if (!st?.isFile()) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(await readFile(file));
    } catch (e) { res.writeHead(500).end(String(e)); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${srv.address().port}${BASE_PATH}`,
    close: () => new Promise((r) => srv.close(r)),
  };
}

/**
 * Read the resolution path off the LIVE page.
 *
 * Enumerates every `<canvas>` in the DOM rather than trusting `window.__stage`, which has
 * a documented history of pointing at a DEAD Stage (a thumbnail generator's corpse once
 * got described as the trophy road). Whatever is on screen is in the DOM list.
 */
const READBACK = () => {
  const q = window.__quality ?? {};
  const canvases = [...document.querySelectorAll('canvas')].map((c, i) => {
    const r = c.getBoundingClientRect();
    const cssW = Math.round(r.width * 1000) / 1000;
    const cssH = Math.round(r.height * 1000) / 1000;
    return {
      i,
      parent: c.parentElement ? (c.parentElement.className || c.parentElement.tagName) : null,
      onScreen: r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
        && r.left < window.innerWidth && r.top < window.innerHeight,
      bufW: c.width, bufH: c.height, cssW, cssH,
      // Backing-store pixels per CSS pixel...
      ratio: cssW > 0 ? Math.round((c.width / cssW) * 10000) / 10000 : null,
      // ...and pixels per DEVICE pixel, which is the number Uri's eye is reacting to.
      vsDevice: cssW > 0 ? Math.round((c.width / (cssW * window.devicePixelRatio)) * 10000) / 10000 : null,
    };
  });
  return {
    screen: window.__screen ?? null,
    devicePixelRatio: window.devicePixelRatio,
    innerW: window.innerWidth, innerH: window.innerHeight,
    screenW: window.screen?.width ?? null, screenH: window.screen?.height ?? null,
    tier: q.tier ?? null, choice: q.choice ?? null, forced: q.forced ?? null,
    detected: q.detected ?? null, cap: q.profile?.pixelRatioCap ?? null,
    bloom: q.profile?.bloom ?? null, smaa: q.profile?.smaa ?? null,
    msaa: q.profile?.msaaSamples ?? null, propInk: q.profile?.propInk ?? null,
    shadowMapScale: q.profile?.shadowMapScale ?? null,
    signals: q.signals ?? null,
    stages: (window.__stages ?? []).map((s, i) => {
      try {
        return {
          i, offscreen: !!s.offscreen, disposed: !!s.disposed, lost: !!s.contextLost,
          pr: s.renderer ? s.renderer.getPixelRatio() : null,
          w: s.canvas?.width ?? null, h: s.canvas?.height ?? null,
          passes: s.composer?.passes?.length ?? null,
        };
      } catch (e) { return { i, error: String(e) }; }
    }),
    selected: (() => {
      try { return JSON.parse(localStorage.getItem('food-arena.profile.v1') || '{}').selected ?? null; }
      catch { return null; }
    })(),
    canvases,
  };
};

/** The fields that MUST be bit-identical between two reads of one unchanged page. */
const driftKey = (m) => JSON.stringify({
  tier: m.tier, cap: m.cap, dpr: m.devicePixelRatio, screen: m.screen,
  c: m.canvases.map((c) => [c.bufW, c.bufH, c.cssW, c.cssH, c.onScreen]),
  s: m.stages.map((s) => [s.pr, s.w, s.h, s.passes]),
});

const ROUTES = {
  home: { q: 'screen=home', ready: () => window.__screenReady === true && window.__screen === 'home' },
  characters: { q: 'screen=characters', ready: () => window.__screenReady === true && window.__screen === 'characters' },
  match: { q: 'player=hamburger&enemy=donut', ready: () => window.__gameReady === true },
};

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validates the DIFFER and the RATIO, never where the tool is pointed
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  const mk = (bufW, cssW, pr) => ({
    tier: 'low', cap: 1.25, devicePixelRatio: 3, screen: 'characters',
    canvases: [{ bufW, bufH: 202, cssW, cssH: 118.6, onScreen: true }],
    stages: [{ pr, w: bufW, h: 202, passes: 2 }],
  });
  const fail = [];
  // §A the differ MOVES on a real difference
  if (driftKey(mk(458, 367, 1.25)) === driftKey(mk(734, 367, 2))) fail.push('A: differ blind to a buffer change');
  // §B the differ HOLDS on identical input (a differ that always fires is not a differ)
  if (driftKey(mk(458, 367, 1.25)) !== driftKey(mk(458, 367, 1.25))) fail.push('B: differ fires on identical input');
  // §C the ratio arithmetic itself, against a hand-computed value
  const r = Math.round((458 / 367) * 10000) / 10000;
  if (Math.abs(r - 1.2480) > 0.001) fail.push(`C: ratio arithmetic ${r}`);
  // §D NON-EMPTY guard: an empty canvas list must NOT be reported as consistent.
  //    `[].every()` is true, so the emptiness has to be tested before the predicate.
  const empty = [];
  const vacuous = empty.length === 0;
  if (!vacuous) fail.push('D: emptiness test itself broken');
  if (empty.every(() => false) !== true) fail.push('D2: [].every() assumption wrong');
  // §E the known-bad comparator must REFUSE a pair that did not move
  const moved = (a, b) => a.stages[0].pr !== b.stages[0].pr;
  if (moved(mk(458, 367, 1.25), mk(458, 367, 1.25))) fail.push('E: known-bad passes a constant');
  if (!moved(mk(458, 367, 1.25), mk(734, 367, 2))) fail.push('E2: known-bad blind to a real move');
  if (fail.length) { console.error('SELFTEST FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('SELFTEST PASS (A differ-moves, B differ-holds, C ratio, D non-empty, E known-bad)');
  console.log('⚠️ This validated LOGIC. It did not validate that the tool is pointed at the right tree.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
const TREE = get('--tree', null);
const LABEL = get('--label', 'arm');
if (!TREE) { console.error('need --tree <dir>'); process.exit(2); }
const WANT = get('--routes', 'home,characters,match').split(',').map((s) => s.trim());
for (const r of WANT) if (!ROUTES[r]) { console.error(`unknown route ${r}`); process.exit(2); }

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

async function cell(browser, baseUrl, routeName, forceTier) {
  const ctx = await browser.newContext({
    ...D,
    // `...D` already carries viewport/screen/deviceScaleFactor/isMobile/hasTouch/UA.
    // Nothing is overridden — overriding one of them is exactly how a cell ends up
    // measuring a tier the phone never selects.
  });
  if (SELECT) {
    // Seeded BEFORE boot. `profile.ts:load()` validates every field with a fallback, so a
    // one-key blob is legal; `selected` is what the character screen puts on the podium.
    await ctx.addInitScript(([id]) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify({ selected: id })); } catch { /* private mode */ }
    }, [SELECT]);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const r = ROUTES[routeName];
  const url = `${baseUrl}?${r.q}${forceTier ? `&tier=${forceTier}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(r.ready, undefined, { timeout: 120_000 });
  // `__screenReady` IS NOT A PAINT (measured opacity 0.000 when it flips), so settle.
  await page.waitForTimeout(1500);

  const one = await page.evaluate(READBACK);
  const two = await page.evaluate(READBACK);        // the DRIFT CONTROL
  const drift = driftKey(one) === driftKey(two) ? 0 : 1;

  let shots = null;
  if (SHOTDIR) {
    await mkdir(SHOTDIR, { recursive: true });
    if (has('--still')) {
      /**
       * STILL THE FRAME, or a cross-tree pixel diff is measuring the clock.
       *
       * Two independent timelines have to stop, and stopping one is the classic
       * half-fix here:
       *   * `shell.ts:tick` derives `dt` from the rAF TIMESTAMP, so pinning that
       *     timestamp drives `dt` to 0 and the lobby's intro/idle stop advancing.
       *     The loop keeps turning, which is what we want — the renderer must still
       *     be able to redraw an identical frame.
       *   * CSS keyframes run on the DOCUMENT timeline, NOT rAF, and
       *     `locator('canvas').screenshot()` is a page capture clipped to the canvas
       *     box — so an unstilled keyframe lands inside a PNG that looks like "the
       *     canvas". Measured elsewhere in this repo at 471,742 px of self-pair.
       * It is applied AFTER the intro has been allowed to play out, not before, so the
       * pose being compared is the settled one rather than frame 0.
       */
      await page.waitForTimeout(2500);
      await page.evaluate(() => {
        const s = document.createElement('style');
        s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
        document.head.appendChild(s);
        const raf = window.requestAnimationFrame.bind(window);
        const PINNED = performance.now();
        window.requestAnimationFrame = (cb) => raf(() => cb(PINNED));
      });
      await page.waitForTimeout(600);
    }
    const md5 = (b) => createHash('md5').update(b).digest('hex');
    const el = page.locator('canvas').first();
    const a = await el.screenshot();
    const b = await el.screenshot();               // canvas self-pair, same page
    const name = `${LABEL}_${routeName}${SELECT ? '_' + SELECT : ''}`;
    await writeFile(join(SHOTDIR, `${name}.png`), a);
    shots = { file: `${name}.png`, md5a: md5(a), md5b: md5(b), selfPair: md5(a) === md5(b) ? 'IDENTICAL' : 'DIFFERS' };
  }

  await ctx.close();
  const on = one.canvases.filter((c) => c.onScreen);
  return { route: routeName, url, drift, forceTier: forceTier ?? null, m: one, on, errors, shots };
}

const srv = await serveTree(TREE);
const browser = await chromium.launch({ args: LAUNCH });
const out = { label: LABEL, tree: TREE, device: DEVNAME, cells: [] };
let bad = 0;
try {
  for (const rn of WANT) {
    const c = await cell(browser, srv.url, rn, null);
    // NON-EMPTY FIRST. Zero on-screen canvases would make every assertion below
    // vacuously true — `[].every()` is `true`.
    if (c.on.length === 0) { console.error(`FAIL ${rn}: NO on-screen canvas — assertion set empty, not a pass`); bad++; }
    if (c.drift) { console.error(`FAIL ${rn}: DRIFT on identical input`); bad++; }
    let kb = null;
    if (has('--knownbad')) {
      const k = await cell(browser, srv.url, rn, 'high');
      if (k.on.length === 0) { console.error(`FAIL ${rn} knownbad: empty set`); bad++; }
      const a = c.m.stages.find((s) => !s.offscreen && !s.disposed)?.pr ?? null;
      const b = k.m.stages.find((s) => !s.offscreen && !s.disposed)?.pr ?? null;
      const moved = a !== null && b !== null && a !== b;
      if (!moved) { console.error(`FAIL ${rn} knownbad: pixel ratio did NOT move (${a} -> ${b}) — instrument is reading a constant`); bad++; }
      kb = { tierA: c.m.tier, prA: a, tierB: k.m.tier, prB: b, moved, onB: k.on };
    }
    out.cells.push({ ...c, knownbad: kb });
    const s = c.m.stages.find((x) => !x.offscreen && !x.disposed);
    console.log(`[${LABEL}] ${rn}  tier=${c.m.tier} (choice=${c.m.choice} forced=${c.m.forced} detected=${c.m.detected}) cap=${c.m.cap} dpr=${c.m.devicePixelRatio} pr=${s?.pr}`);
    console.log(`         viewport ${c.m.innerW}x${c.m.innerH}  screen ${c.m.screenW}x${c.m.screenH}  selected=${c.m.selected}  drift=${c.drift}`);
    for (const cv of c.on) {
      console.log(`         canvas[${cv.i}] parent=${String(cv.parent).slice(0, 34)} buf ${cv.bufW}x${cv.bufH}  css ${cv.cssW}x${cv.cssH}  ratio ${cv.ratio}  vsDevice ${cv.vsDevice}`);
    }
    if (kb) console.log(`         KNOWN-BAD tier=high: pr ${kb.prA} -> ${kb.prB}  moved=${kb.moved}`);
    if (c.shots) console.log(`         shot ${c.shots.file} selfPair=${c.shots.selfPair} md5=${c.shots.md5a}`);
    if (c.errors.length) console.log(`         pageerrors: ${c.errors.length}`);
  }
} finally {
  await browser.close();
  await srv.close();
}
const dest = get('--json', null);
if (dest) await writeFile(dest, JSON.stringify(out, null, 2));
process.exit(bad ? 1 : 0);
