#!/usr/bin/env node
/**
 * MDPR_PROBE — the MENU screens' drawing-buffer resolution, read off the live renderer.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/mdpr_probe.mjs --url '{URL}' --label before --json out.json
 *   node tools/tmp/mdpr_probe.mjs --selftest
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  THE QUESTION
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Uri, on an iPhone 15 Pro: *"home screen, and more specifically character screen seems
 * like the resolution is slightly lower"*. An 11-agent probe **refuted** that as a
 * regression — `pixelRatioCap: 2 / 1.5 / 1.25` is bit-identical in every deployed
 * bundle, including the one he praised — but it measured, and this tool re-derives, that
 * the menu portrait is drawn at a small fraction of the panel's device pixels and
 * upscaled to the glass. **A constant cannot regress; it can still be the largest defect
 * in the frame.** This tool measures the constant, and the change to it.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  WHAT MAKES A NUMBER HERE QUOTABLE — AND WHAT DOES NOT
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ✅ QUOTABLE. Drawing-buffer integers (`canvas.width/height`), CSS box sizes,
 *    `renderer.getPixelRatio()`, `window.devicePixelRatio`, the tier and its caps.
 *    Every one of these is decided by JavaScript and CSS. **They are the same number on
 *    an A17 as they are under SwiftShader**, because no rasteriser participates in
 *    computing them.
 *
 * ❌ NOT QUOTABLE, and this tool refuses to print them. Perceived sharpness, frame
 *    time, fps, thermal behaviour, iOS memory pressure. **SwiftShader is not an A17.**
 *    The ratio of pixels is engine-independent; what those pixels COST is not, and
 *    nothing here may be read as phone performance coverage.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  THE FOUR GUARDS (CLAUDE.md rules 4 and 6)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  1. **NON-EMPTY FIRST.** The on-screen canvas set is asserted non-empty BEFORE
 *     anything is asserted over it. `[].every()` returns `true`, and that vacuity has
 *     fired at least seven times in this repo — three of them in one day — always
 *     because something upstream emptied the filtered set. Zero on-screen canvases is a
 *     FAILURE here, never a quiet pass.
 *
 *  2. **DRIFT CONTROL.** Every cell is read back TWICE from the same live page with
 *     nothing changed in between, and the two reads must be EXACTLY equal on every
 *     numeric field. Rule 4's eighteenth "it isn't there" rendered *plausibly and
 *     wrongly*, so "is it the SAME?" is asked before any difference is believed. A cell
 *     with drift != 0 is reported INVALID and never averaged.
 *
 *  3. **KNOWN-BAD `--knownbad`: the instrument must SEE a change it is told to see.**
 *     Re-runs the identical cell with `&tier=high` forced. That must move the tier and
 *     the caps. An instrument that returns the same string on both tiers is measuring a
 *     constant and its "identical" verdicts mean nothing.
 *
 *     ⚠️ **AND THIS ARM GOT WEAKER THE DAY THE MENU CAP LANDED — SAY SO RATHER THAN
 *     LET THE NEXT AGENT DISCOVER IT.** Before the change, forcing `tier=high` moved
 *     the menu Stage's BUFFER (458x202 -> 734x238). After it, every tier's
 *     `menuPixelRatioCap` is 2 and `charStage` pins `maxPixelRatio: 2`, so the menu
 *     buffer is now **identical on `low` and `high`** — by design. The arm still reports
 *     VALID because `key()` also carries `tier` and `cap`, which do move. **Had `key()`
 *     tracked only buffers, this arm would have gone silently vacuous on the very change
 *     it was written to check.** The arm that still moves the menu buffer is
 *     `--floorguard`, and that is now the load-bearing one.
 *
 *  4. **KNOWN-BAD `--floorguard`: THE INVARIANT THIS CHANGE COULD BREAK.**
 *     `stage.ts:effectivePixelRatio` is `min` of everything, always — a caller cap and a
 *     tier cap are CEILINGS and never floors. Scoping the cap to the menu workload
 *     changes WHICH cap is in the `min`; if it ever introduces a `max`, a device the
 *     tier system just protected is handed a 4x pixel bill. A peer correctly refused a
 *     `minPixelRatio: 2` proposal for exactly this.
 *
 *     So this arm runs a phone profile at **deviceScaleFactor 1** — every cap above it —
 *     and REQUIRES the effective ratio to follow the device down to 1.00. A floor
 *     implementation returns 2 here and the arm goes red.
 *
 *     ⚠️ **This arm was validated against a real tree carrying the real defect**, not
 *     against a mock: a third detached worktree with `Math.min(...)` replaced by
 *     `Math.max(menuCap, Math.min(...))`. The RED command is recorded in this agent's
 *     report. `--selftest` below validates this file's LOGIC and says nothing about
 *     where it is POINTED — those are different claims and only one of them is cheap.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  THE PROFILES
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Uri's device is emulated explicitly rather than approximated: **393x852 CSS,
 * deviceScaleFactor 3**, `isMobile`, `hasTouch`. `quality.ts:detectTier` gates on
 * `matchMedia('(pointer: coarse)')` + `maxTouchPoints > 0` and then on
 * `min(screen.width, screen.height) <= 500` — so `screen` is pinned to the 393x852
 * PANEL in both orientations, which is what iOS reports and what the viewport is not.
 * A profile that omits `isMobile`/`hasTouch` cannot reach the touch branch at all;
 * `perf.mjs` shipped that bug for its whole life and every "mobile" number it printed
 * before 2026-08-11 was a `high` measurement wearing a phone's viewport.
 */
import { chromium } from 'playwright';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

// ─────────────────────────────────────────────────────────────────────────────
// Profiles. `screen` is the PANEL, never the viewport — `quality.ts` reads
// `window.screen` and iOS reports the panel in both orientations.
// ─────────────────────────────────────────────────────────────────────────────
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const PROFILES = {
  // Uri's device, portrait. 659 is Playwright's own iPhone 15 Pro visible viewport
  // (852 minus Safari's chrome); the PANEL stays 393x852.
  'phone-portrait': {
    viewport: { width: 393, height: 659 },
    screen: { width: 393, height: 852 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  // ⚠️ THE SAME DEVICE, FULL-PANEL VIEWPORT — and it is a DIFFERENT MEASUREMENT.
  // The brief this agent was given quoted the character portrait at `458x202` into a
  // `1101x487` device box. The WIDTHS reproduce exactly at either viewport; the
  // HEIGHTS do not, because the panel's height is laid out against the VIEWPORT and
  // 393x659 (Playwright's own iPhone 15 Pro descriptor, i.e. 852 minus Safari's
  // chrome) is 193 CSS px shorter than the 393x852 panel. Both arms are run and both
  // are reported, because "which viewport is the phone" is a real ambiguity and
  // quoting one height as if it were the device's would be a fabricated number.
  // The RATIOS — 0.416x linear, 17.3% of native — are identical in both, and they are
  // the quantity the argument rests on.
  'phone-portrait-full': {
    viewport: { width: 393, height: 852 },
    screen: { width: 393, height: 852 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  // Same device rotated. Same panel, so the same tier — this is the orientation arm.
  'phone-landscape': {
    viewport: { width: 852, height: 393 },
    screen: { width: 393, height: 852 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  // THE FLOOR GUARD's device: a touch phone whose DPR is BELOW every cap.
  'phone-dpr1': {
    viewport: { width: 393, height: 659 },
    screen: { width: 393, height: 852 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  // A TABLET. `detectTier` resolves `medium` here (touch-primary, short edge 768 > 500),
  // and `medium`'s MATCH cap is 1.5 against a menu cap of 2 — so this is the one device
  // class other than the phone where `budget: 'menu'` changes anything, and it is
  // measured rather than derived from the arithmetic.
  tablet: {
    viewport: { width: 1024, height: 768 },
    screen: { width: 768, height: 1024 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  },
  // A genuine desktop: no touch, no isMobile, DPR 1. Must resolve `high`.
  desktop: {
    viewport: { width: 1280, height: 800 },
    screen: { width: 1920, height: 1080 },
    deviceScaleFactor: 1, isMobile: false, hasTouch: false,
  },
};

const READY = { home: 'home', characters: 'characters' };

/**
 * ── THE MATCH ARM IS THE CONTROL, AND IT IS THE OTHER CAMERA ────────────────
 * `charStage.ts` is `pitchDeg: 20` (CLAUDE.md rule 3's lobby detector, where Uri
 * looks); `camera.ts`'s `CameraRig` constructor is `opts.pitchDeg ?? 58` (the match).
 * ⚠️ CLAUDE.md cited `camera.ts:265` for this for a session and `:265` is inside
 * `fairSolveAt`, a distance helper — corrected in `67d58d8`. Cite the SYMBOL.
 *
 * `budget` defaults to `'match'`, so `match.ts`'s Stage is untouched by construction.
 * "By construction" is not a measurement, so it is measured: the match arm must come
 * back BIT-IDENTICAL on buffer size and pixel ratio. If it moves, the change leaked.
 */
const MATCH_URL = 'player=hamburger&enemy=donut';
const MATCH_READY = 'window.__gameReady === true';

/** Read off the LIVE renderer and the LIVE canvas. Nothing here is computed from source. */
const READBACK = () => {
  const rects = [];
  for (const c of Array.from(document.querySelectorAll('canvas'))) {
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const devW = Math.round(r.width * dpr * 100) / 100;
    const devH = Math.round(r.height * dpr * 100) / 100;
    rects.push({
      cls: c.className || null,
      bufW: c.width,
      bufH: c.height,
      cssW: Math.round(r.width * 100) / 100,
      cssH: Math.round(r.height * 100) / 100,
      cssX: Math.round(r.left * 100) / 100,
      cssY: Math.round(r.top * 100) / 100,
      // The DEVICE-pixel box the browser will scale this buffer into.
      devW, devH,
      onScreen: r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
        && r.left < window.innerWidth && r.top < window.innerHeight,
      // Linear scale of buffer to glass. 1.0 = native. > 1 = upscaled.
      upscale: devW > 0 ? Math.round((devW / c.width) * 10000) / 10000 : null,
      // Fraction of the device pixels that are actually drawn.
      nativeFrac: devW > 0 && devH > 0
        ? Math.round(((c.width * c.height) / (devW * devH)) * 100000) / 100000 : null,
    });
  }
  const q = window.__quality ?? {};
  const stages = (window.__stages ?? []).map((s) => {
    try {
      return {
        pixelRatio: s.renderer?.getPixelRatio?.() ?? null,
        w: s.canvas?.width ?? null,
        h: s.canvas?.height ?? null,
        offscreen: s.offscreen === true,
      };
    } catch { return null; }
  });
  const p = q.profile ?? {};
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
    cap: p.pixelRatioCap ?? null,
    // `undefined` until this change lands — printed as null, which is itself the
    // before/after signal and is asserted on rather than assumed.
    menuCap: p.menuPixelRatioCap ?? null,
    bloom: p.bloom ?? null,
    smaa: p.smaa ?? null,
    canvases: rects,
    stages,
  };
};

/** Everything the drift control compares. Numeric identity, not approximate. */
function key(m) {
  return JSON.stringify({
    tier: m.tier, cap: m.cap, menuCap: m.menuCap, dpr: m.dpr,
    canvases: m.canvases.map((c) => [c.bufW, c.bufH, c.cssW, c.cssH, c.onScreen]),
    stages: m.stages,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validates THIS FILE'S LOGIC. It says NOTHING about where the tool
// is pointed (CLAUDE.md rule 6: `valuescan` read a perfect selftest with 14 of
// its 18 stations in the wrong quadrant).
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  const mk = (bufW, cap, menuCap) => ({
    tier: cap === 1.25 ? 'low' : 'high', cap, menuCap, dpr: 3,
    canvases: [{ bufW, bufH: 202, cssW: 366.4, cssH: 161.6, onScreen: true }],
    stages: [{ pixelRatio: cap, w: bufW, h: 202 }],
  });
  const checks = [];
  const add = (name, ok) => { checks.push({ name, ok }); };

  // §A the differ: identical in, zero drift out.
  add('A identical -> 0 drift', key(mk(458, 1.25, null)) === key(mk(458, 1.25, null)));
  // §B the differ SEES the change it exists to see.
  add('B 1.25 vs 2 differs', key(mk(458, 1.25, null)) !== key(mk(733, 2, 2)));
  // §C the differ sees a menuCap appearing even when the buffer has not moved yet.
  add('C menuCap null vs 2 differs', key(mk(458, 1.25, null)) !== key(mk(458, 1.25, 2)));

  // §D the vacuity arm. `[].every()` is `true`; the guard must reject it.
  const empty = [];
  const vacuous = empty.every((c) => c.bufW === 999999);   // true — THE BUG
  const guarded = empty.length > 0 && empty.every((c) => c.bufW === 999999);
  add('D [].every() is true and the non-empty guard rejects it',
    vacuous === true && guarded === false);

  // §E THE FLOOR PREDICATE, against both a correct and a floored implementation.
  //    This is the arithmetic the browser arm asserts; proving it here does NOT
  //    prove the browser arm is pointed at a real Stage — only the third worktree
  //    carrying the real `Math.max` defect proves that.
  const correct = (dpr, callerCap, menuCap) => Math.min(dpr, callerCap, menuCap);
  const floored = (dpr, callerCap, menuCap) => Math.max(menuCap, Math.min(dpr, callerCap));
  add('E1 correct impl follows dpr 1 down to 1', correct(1, 2, 2) === 1);
  add('E2 floored impl returns 2 at dpr 1 — the defect the arm must catch',
    floored(1, 2, 2) === 2);
  add('E3 the floor predicate SEPARATES them', correct(1, 2, 2) !== floored(1, 2, 2));
  // ...and it must not fire on the ordinary case, or it is a guard that cries wolf.
  add('E4 predicate agrees with itself at dpr 3', correct(3, 2, 2) === floored(3, 2, 2));

  for (const c of checks) console.log(`selftest: ${c.name} ${c.ok ? 'PASS' : 'FAIL'}`);
  const ok = checks.every((c) => c.ok) && checks.length > 0;   // non-empty, then every
  console.log(ok ? 'SELFTEST PASS' : 'SELFTEST FAIL');
  process.exit(ok ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
const URL_BASE = get('--url', process.env.PREVIEW_BASE ?? null);
const LABEL = get('--label', 'tree');
const ROUTES = get('--routes', 'home,characters').split(',').map((s) => s.trim());
const PROFILE_NAMES = get('--profiles', 'phone-portrait,phone-landscape').split(',').map((s) => s.trim());
if (!URL_BASE) { console.error('need --url <base> (or PREVIEW_BASE)'); process.exit(2); }
for (const p of PROFILE_NAMES) {
  if (!PROFILES[p]) { console.error(`unknown profile ${p}`); process.exit(2); }
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const SHOTS = get('--shots', null);

async function cell(browser, profileName, route, extra) {
  const ctx = await browser.newContext(PROFILES[profileName]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const sep = URL_BASE.includes('?') ? '&' : '?';
  const isMatch = route === 'match';
  const url = isMatch
    ? `${URL_BASE}${sep}${MATCH_URL}${extra ? `&${extra}` : ''}`
    : `${URL_BASE}${sep}screen=${route}${extra ? `&${extra}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (isMatch) {
    await page.waitForFunction(MATCH_READY, null, { timeout: 180_000 });
  } else {
    await page.waitForFunction(
      (want) => window.__screenReady === true && window.__screen === want,
      READY[route], { timeout: 180_000 },
    );
  }
  // `__screenReady` IS NOT A PAINT (AGENT-BRIEF §3, measured opacity 0.000 when it
  // flips) and the Stage's ResizeObserver fires after the mount, so the first buffer
  // size read can be the pre-resize one.
  await page.waitForTimeout(2000);
  const a = await page.evaluate(READBACK);
  const b = await page.evaluate(READBACK);            // DRIFT CONTROL
  const drift = key(a) === key(b) ? 0 : 1;
  const on = a.canvases.filter((c) => c.onScreen);
  if (SHOTS && on.length > 0) {
    // ⚠️ A PAGE SCREENSHOT CLIPPED TO THE CANVAS RECT, ON PURPOSE — not
    // `locator('canvas').screenshot()` as a way of "getting the canvas". The question
    // here is *what reaches the glass*, i.e. the browser's own upscale of the drawing
    // buffer into its CSS box at deviceScaleFactor 3. A canvas-only capture would
    // answer a different question. (AGENT-BRIEF §3 warns that this capture also
    // includes any `position: fixed` overlay in the box; on these routes that is the
    // menu chrome, which is part of what Uri is looking at.)
    const { mkdir } = await import('node:fs/promises');
    await mkdir(SHOTS, { recursive: true });
    const r = on[0];
    const vp = PROFILES[profileName].viewport;
    const x = Math.max(0, r.cssX);
    const y = Math.max(0, r.cssY);
    await page.screenshot({
      path: `${SHOTS}/${LABEL}_${profileName}_${route}${extra ? '_kb' : ''}.png`,
      clip: {
        x, y,
        width: Math.max(1, Math.min(r.cssW, vp.width - x)),
        height: Math.max(1, Math.min(r.cssH, vp.height - y)),
      },
    });
  }
  await ctx.close();
  return { url, profile: profileName, route, m: a, drift, onScreenCount: on.length, on, errors };
}

function printCell(c) {
  const m = c.m;
  console.log(`[${LABEL}] ${c.profile}/${c.route}: tier=${m.tier} detected=${m.detected} `
    + `forced=${m.forced} cap=${m.cap} menuCap=${m.menuCap} dpr=${m.dpr} `
    + `coarse=${m.coarse} touch=${m.maxTouchPoints} screen=${m.screenW}x${m.screenH} `
    + `vp=${m.innerW}x${m.innerH} drift=${c.drift}`);
  for (const cv of c.on) {
    console.log(`     canvas buf=${cv.bufW}x${cv.bufH} css=${cv.cssW}x${cv.cssH} `
      + `devbox=${cv.devW}x${cv.devH} upscale=${cv.upscale}x native=${
        cv.nativeFrac === null ? 'n/a' : `${(cv.nativeFrac * 100).toFixed(1)}%`}`);
  }
  for (const s of c.m.stages) {
    if (s) console.log(`     stage pixelRatio=${s.pixelRatio} buf=${s.w}x${s.h} offscreen=${s.offscreen}`);
  }
  if (c.errors.length) console.log(`     pageerrors: ${c.errors.slice(0, 2).join(' | ')}`);
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
let bad = 0;
const out = { label: LABEL, url: URL_BASE, cells: [] };
try {
  for (const profileName of PROFILE_NAMES) {
    for (const route of ROUTES) {
      const c = await cell(browser, profileName, route);
      // ── NON-EMPTY FIRST. Every assertion below is vacuous without this. ──
      if (c.onScreenCount === 0) {
        console.log(`  ${profileName}/${route}: NO ON-SCREEN CANVAS — VACUOUS, FAIL`);
        bad++;
      }
      if (c.drift !== 0) console.log(`  ${profileName}/${route}: DRIFT != 0 — cell INVALID`), bad++;
      printCell(c);
      out.cells.push(c);

      if (has('--knownbad')) {
        const kb = await cell(browser, profileName, route, 'tier=high');
        const moved = key(kb.m) !== key(c.m);
        console.log(`     KNOWN-BAD tier=high -> tier=${kb.m.tier} cap=${kb.m.cap} `
          + `buf=${kb.on.map((x) => `${x.bufW}x${x.bufH}`).join(',')} : instrument `
          + `${moved ? 'SEES the change (VALID)' : 'BLIND (INVALID)'}`);
        if (!moved) bad++;
        out.cells.push({ ...kb, route: `${route}#knownbad` });
      }
    }
  }

  // ── THE FLOOR GUARD ────────────────────────────────────────────────────────
  // A phone at deviceScaleFactor 1 sits BELOW every cap in the system. The
  // effective ratio must follow it down to 1.00. A `max` anywhere in
  // `effectivePixelRatio` returns 2 here.
  if (has('--floorguard')) {
    for (const route of ROUTES) {
      const c = await cell(browser, 'phone-dpr1', route);
      if (c.onScreenCount === 0) {
        console.log(`  FLOORGUARD ${route}: NO ON-SCREEN CANVAS — VACUOUS, FAIL`);
        bad++;
        continue;
      }
      printCell(c);
      const live = c.m.stages.filter((s) => s && !s.offscreen && s.pixelRatio !== null);
      if (live.length === 0) {
        console.log(`  FLOORGUARD ${route}: NO LIVE STAGE — VACUOUS, FAIL`);
        bad++;
        continue;
      }
      const over = live.filter((s) => s.pixelRatio > c.m.dpr + 1e-9);
      const ok = over.length === 0;
      console.log(`     FLOOR GUARD ${route}: dpr=${c.m.dpr} stages=[${
        live.map((s) => s.pixelRatio).join(',')}] -> ${
        ok ? 'no floor (PASS)' : `FLOOR INTRODUCED on ${over.length} stage(s) (FAIL)`}`);
      if (!ok) bad++;
      out.cells.push({ ...c, route: `${route}#floorguard` });
    }
  }
} finally {
  await browser.close();
}

const jsonPath = get('--json', null);
if (jsonPath) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(jsonPath, JSON.stringify(out, null, 2));
  console.log(`wrote ${jsonPath}`);
}
console.log(bad ? `FAULTS: ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
