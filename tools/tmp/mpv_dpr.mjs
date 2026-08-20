#!/usr/bin/env node
/**
 * MPV_DPR — an INDEPENDENT re-derivation of the menu drawing-buffer numbers claimed by
 * the `dpr` job (2fc072c / b0400ef), written by the adversarial verifier so that no line
 * of `tools/tmp/mdpr_probe.mjs` is trusted.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/mpv_dpr.mjs --url '{URL}' --label before --json out.json
 *   node tools/tmp/mpv_dpr.mjs --selftest
 *
 * ── WHAT IS QUOTABLE ─────────────────────────────────────────────────────────
 * ✅ `canvas.width/height`, `getBoundingClientRect()`, `devicePixelRatio`, the tier and
 *    its caps, and `naturalWidth` of a roster tile. No rasteriser participates in any of
 *    them, so they are identical on an A17 and under SwiftShader.
 * ❌ Perceived sharpness, frame time, thermals, iOS memory pressure. Not printed here.
 *
 * ── WHAT THIS MEASURES THAT `mdpr_probe` DOES NOT ────────────────────────────
 *  * The ROSTER TILE. The `dpr` job declared `thumbs.ts` "DELIBERATELY NOT FIXED — not a
 *    phone softness source", on the arithmetic that a tile is "~85 CSS px ~ 255 device
 *    px, so 416 > 255 and the tile is DOWNSAMPLED". That is an arithmetic claim about the
 *    screen Uri named. It is measured here off the live layout instead of derived.
 *  * `computedPitch` — read off the live `CameraRig` where exposed, so the "both cameras"
 *    claim is not taken on the URL's word.
 *
 * ── GUARDS (CLAUDE.md rule 6) ────────────────────────────────────────────────
 *  1. NON-EMPTY FIRST. Every filtered set (`onScreen` canvases, roster tiles, live
 *     stages) is asserted non-empty BEFORE anything is asserted over it. `[].every()` is
 *     `true`.
 *  2. DRIFT CONTROL. Two reads of the same live page, nothing changed between; they must
 *     be EXACTLY equal. A cell with drift != 0 is INVALID and is never quoted.
 *  3. `--knownbad` forces `&tier=high`; the instrument must SEE it move something.
 *  4. `--floorguard` runs a touch phone at deviceScaleFactor 1 — below every cap — and
 *     requires the live renderer to report <= dpr.
 * `--selftest` validates this file's LOGIC only. It says nothing about where it points.
 */
import { chromium } from 'playwright';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// `screen` is the PANEL (iOS reports it in both orientations); the viewport is not.
const PROFILES = {
  // Full-panel viewport — the 393x852 the brief names.
  'ph-852': {
    viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  // Playwright's own iPhone 15 Pro visible viewport (panel minus Safari chrome).
  'ph-659': {
    viewport: { width: 393, height: 659 }, screen: { width: 393, height: 852 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  'ph-land': {
    viewport: { width: 852, height: 393 }, screen: { width: 393, height: 852 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  // The floor guard's device: a touch phone whose DPR is BELOW every cap in the system.
  'ph-dpr1': {
    viewport: { width: 393, height: 659 }, screen: { width: 393, height: 852 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
  },
  tablet: {
    viewport: { width: 1024, height: 768 }, screen: { width: 768, height: 1024 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  },
  desktop: {
    viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 },
    deviceScaleFactor: 1, isMobile: false, hasTouch: false,
  },
  // ── THE TWO PROFILES THE `dpr` JOB'S THUMBS VERDICT NEEDS AND DID NOT RUN ────
  // Its commit message says the baked 416x496 roster tile "is a real defect on
  // desktop/tablet, where the tile clamps to 180 CSS px". `characterSelect.ts`'s grid is
  // `repeat(auto-fill, minmax(clamp(76px, 10vw, 180px), 1fr))`, so 180 CSS px is the
  // auto-fill MINIMUM's ceiling and the `1fr` can exceed it — which makes "is the tile
  // upscaled?" a question about the widest and the densest desktop, not the default one.
  // Both are measured rather than argued.
  'desktop-retina': {
    viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, isMobile: false, hasTouch: false,
  },
  'desktop-wide': {
    viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 },
    deviceScaleFactor: 2, isMobile: false, hasTouch: false,
  },
};

const MATCH_URL = 'player=hamburger&enemy=donut';

const READBACK = () => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const dpr = window.devicePixelRatio || 1;
  const canvases = Array.from(document.querySelectorAll('canvas')).map((c) => {
    const r = c.getBoundingClientRect();
    const devW = r2(r.width * dpr);
    const devH = r2(r.height * dpr);
    return {
      bufW: c.width, bufH: c.height,
      cssW: r2(r.width), cssH: r2(r.height), cssX: r2(r.left), cssY: r2(r.top),
      devW, devH,
      onScreen: r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
        && r.left < window.innerWidth && r.top < window.innerHeight,
      upscale: c.width > 0 ? Math.round((devW / c.width) * 10000) / 10000 : null,
      nativeFrac: devW > 0 && devH > 0
        ? Math.round(((c.width * c.height) / (devW * devH)) * 100000) / 100000 : null,
    };
  });
  // ROSTER TILES: every <img> whose src is a generated portrait data-URL, plus its
  // laid-out CSS box. `naturalWidth` is the baked PNG's own width.
  const tiles = Array.from(document.querySelectorAll('img'))
    .filter((im) => im.currentSrc && im.currentSrc.startsWith('data:'))
    .map((im) => {
      const r = im.getBoundingClientRect();
      return {
        natW: im.naturalWidth, natH: im.naturalHeight,
        cssW: r2(r.width), cssH: r2(r.height),
        devW: r2(r.width * dpr), devH: r2(r.height * dpr),
        // > 1 means the baked PNG is UPSCALED onto the glass (a softness source).
        upscale: im.naturalWidth > 0 ? Math.round((r.width * dpr / im.naturalWidth) * 10000) / 10000 : null,
      };
    });
  const q = window.__quality ?? {};
  const p = q.profile ?? {};
  const stages = (window.__stages ?? []).map((s) => {
    try {
      return {
        pixelRatio: s.renderer?.getPixelRatio?.() ?? null,
        w: s.canvas?.width ?? null, h: s.canvas?.height ?? null,
        offscreen: s.offscreen === true,
      };
    } catch { return null; }
  });
  return {
    screen: window.__screen ?? null,
    dpr, innerW: window.innerWidth, innerH: window.innerHeight,
    screenW: window.screen?.width ?? null, screenH: window.screen?.height ?? null,
    coarse: typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches : null,
    touchPts: navigator.maxTouchPoints ?? 0,
    tier: q.tier ?? window.__renderTier ?? null,
    cap: p.pixelRatioCap ?? null,
    // `undefined` before 2fc072c — printed as null, which is itself the before/after
    // signal and is asserted on rather than assumed.
    menuCap: p.menuPixelRatioCap ?? null,
    msaa: p.msaaSamples ?? null,
    smaa: p.smaa ?? null,
    canvases, tiles, stages,
  };
};

/**
 * The drift control, SPLIT INTO TWO INDEPENDENT KEYS — and the split is the finding that
 * forced it. The roster screen generates its eleven thumbnails on an idle callback, so a
 * whole-object key drifts on the `characters` route for as long as that batch is running,
 * on a field that has nothing to do with the drawing buffer. Folding both into one
 * boolean would either (a) invalidate the canvas cell for a reason that is not about the
 * canvas, or (b) — the way `mdpr_probe` does it, by not carrying tiles at all — hide that
 * the screen is still settling. Both quantities are asked separately instead.
 */
function keyCanvas(m) {
  return JSON.stringify({
    tier: m.tier, cap: m.cap, menuCap: m.menuCap, dpr: m.dpr,
    canvases: m.canvases.map((c) => [c.bufW, c.bufH, c.cssW, c.cssH, c.onScreen]),
    stages: m.stages,
  });
}
function keyTiles(m) {
  return JSON.stringify({ n: m.tiles.length, tiles: m.tiles.map((t) => [t.natW, t.natH, t.cssW, t.cssH]) });
}
/** Kept for the selftest's differ arms: the union of both keys. */
function key(m) { return `${keyCanvas(m)}|${keyTiles(m)}`; }

if (has('--selftest')) {
  const checks = [];
  const add = (n, ok) => checks.push({ n, ok });
  const mk = (bufW, cap, menuCap, tileCss) => ({
    tier: cap === 1.25 ? 'low' : 'high', cap, menuCap, dpr: 3,
    canvases: [{ bufW, bufH: 202, cssW: 366.4, cssH: 161.6, onScreen: true }],
    tiles: [{ natW: 416, natH: 496, cssW: tileCss, cssH: tileCss }],
    stages: [{ pixelRatio: cap, w: bufW, h: 202 }],
  });
  // §A the differ: identical in, EXACTLY zero drift out. Without this every
  // "bit-identical" verdict below is an instrument that cannot see anything.
  add('A identical -> 0 drift', key(mk(458, 1.25, null, 85)) === key(mk(458, 1.25, null, 85)));
  // §B it sees the change it exists to see.
  add('B 458@1.25 vs 734@2 differ', key(mk(458, 1.25, null, 85)) !== key(mk(734, 2, 2, 85)));
  // §C it sees a menuCap APPEAR even when no buffer has moved.
  add('C menuCap null vs 2 differ', key(mk(458, 1.25, null, 85)) !== key(mk(458, 1.25, 2, 85)));
  // §D it sees a ROSTER TILE move — the field mdpr_probe does not carry at all. Without
  // this arm the tile numbers below would be read off an instrument never shown to
  // respond to them.
  add('D tile css move is visible', key(mk(458, 1.25, null, 85)) !== key(mk(458, 1.25, null, 120)));
  // §E vacuity. `[].every()` is `true`; the non-empty guard must reject it.
  const empty = [];
  add('E [].every() true, guarded false',
    empty.every((x) => x.bufW === 999) === true
    && (empty.length > 0 && empty.every((x) => x.bufW === 999)) === false);
  // §F the floor predicate, against a correct and a floored implementation.
  const correct = (dpr, caller, tier) => Math.min(dpr, caller, tier);
  const floored = (dpr, caller, tier) => Math.max(tier, Math.min(dpr, caller));
  add('F1 correct follows dpr 1 down', correct(1, 2, 2) === 1);
  add('F2 floored returns 2 at dpr 1', floored(1, 2, 2) === 2);
  add('F3 predicate separates them', correct(1, 2, 2) !== floored(1, 2, 2));
  add('F4 and agrees at dpr 3 (no crying wolf)', correct(3, 2, 2) === floored(3, 2, 2));
  // §G the tile-upscale predicate: it must call 416-into-255 DOWNSAMPLED and
  // 416-into-600 UPSCALED, or the thumbs verdict is unfalsifiable either way.
  const up = (nat, cssPx, dpr) => (cssPx * dpr) / nat;
  add('G1 416 into 85css@3 is downsampled', up(416, 85, 3) < 1);
  add('G2 416 into 200css@3 is upsampled', up(416, 200, 3) > 1);
  for (const c of checks) console.log(`selftest: ${c.n} ${c.ok ? 'PASS' : 'FAIL'}`);
  const ok = checks.length > 0 && checks.every((c) => c.ok);
  console.log(ok ? 'SELFTEST PASS' : 'SELFTEST FAIL');
  process.exit(ok ? 0 : 1);
}

const URL_BASE = get('--url', process.env.PREVIEW_BASE ?? null);
const LABEL = get('--label', 'tree');
const ROUTES = get('--routes', 'home,characters').split(',').map((s) => s.trim());
const PROFILE_NAMES = get('--profiles', 'ph-852').split(',').map((s) => s.trim());
const SHOTS = get('--shots', null);
if (!URL_BASE) { console.error('need --url <base> (or PREVIEW_BASE)'); process.exit(2); }
for (const p of PROFILE_NAMES) {
  if (!PROFILES[p]) { console.error(`unknown profile ${p}`); process.exit(2); }
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

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
  if (isMatch) await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  else {
    await page.waitForFunction(
      (want) => window.__screenReady === true && window.__screen === want,
      route, { timeout: 180_000 },
    );
  }
  // `__screenReady` IS NOT A PAINT, and the Stage's ResizeObserver fires after mount,
  // so the first buffer read can be the pre-resize one. The roster ALSO generates its
  // eleven thumbnails on an idle callback and that batch outlives `__screenReady` by
  // seconds — measured here, not assumed: at a 4 s settle the tile count was still
  // climbing between two reads 
  // taken milliseconds apart. `__thumbsReady` is the app's own signal for it, so it is
  // waited on rather than guessed at, with a timeout that DEGRADES TO A REPORTED FLAG
  // instead of throwing (a route with no roster never sets it).
  await page.waitForTimeout(2500);
  let thumbsReady = null;
  try {
    await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 45_000 });
    thumbsReady = true;
  } catch { thumbsReady = false; }
  await page.waitForTimeout(1500);
  const a = await page.evaluate(READBACK);
  const b = await page.evaluate(READBACK);     // DRIFT CONTROL
  const drift = keyCanvas(a) === keyCanvas(b) ? 0 : 1;
  const tileDrift = keyTiles(a) === keyTiles(b) ? 0 : 1;
  const on = a.canvases.filter((c) => c.onScreen);
  if (SHOTS && on.length > 0) {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(SHOTS, { recursive: true });
    const r = on[0];
    const vp = PROFILES[profileName].viewport;
    const x = Math.max(0, r.cssX);
    const y = Math.max(0, r.cssY);
    // A PAGE screenshot CLIPPED to the canvas rect on purpose: the question is what
    // reaches the glass, i.e. the browser's own upscale of the buffer into its CSS box.
    await page.screenshot({
      path: `${SHOTS}/${LABEL}_${profileName}_${route}.png`,
      clip: {
        x, y,
        width: Math.max(1, Math.min(r.cssW, vp.width - x)),
        height: Math.max(1, Math.min(r.cssH, vp.height - y)),
      },
    });
  }
  await ctx.close();
  return { url, profile: profileName, route, m: a, drift, tileDrift, thumbsReady, on, errors };
}

function printCell(c) {
  const m = c.m;
  console.log(`[${LABEL}] ${c.profile}/${c.route}: tier=${m.tier} cap=${m.cap} menuCap=${m.menuCap} `
    + `msaa=${m.msaa} smaa=${m.smaa} dpr=${m.dpr} coarse=${m.coarse} touch=${m.touchPts} `
    + `screen=${m.screenW}x${m.screenH} vp=${m.innerW}x${m.innerH} `
    + `drift=${c.drift} tileDrift=${c.tileDrift} thumbsReady=${c.thumbsReady}`);
  for (const cv of c.on) {
    console.log(`     canvas buf=${cv.bufW}x${cv.bufH} css=${cv.cssW}x${cv.cssH} `
      + `devbox=${cv.devW}x${cv.devH} upscale=${cv.upscale}x native=${
        cv.nativeFrac === null ? 'n/a' : `${(cv.nativeFrac * 100).toFixed(1)}%`}`);
  }
  for (const s of c.m.stages) {
    if (s) console.log(`     stage ratio=${s.pixelRatio} buf=${s.w}x${s.h} offscreen=${s.offscreen}`);
  }
  if (c.m.tiles.length === 0) {
    console.log('     tiles: NONE FOUND — any tile verdict here would be VACUOUS');
  } else {
    const t = c.m.tiles;
    const ups = t.filter((x) => x.upscale !== null && x.upscale > 1);
    console.log(`     tiles n=${t.length} baked=${t[0].natW}x${t[0].natH} `
      + `css=${t[0].cssW}x${t[0].cssH} devbox=${t[0].devW}x${t[0].devH} `
      + `upscale=${t[0].upscale}x -> ${ups.length}/${t.length} UPSCALED`);
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
      if (c.on.length === 0) { console.log(`  ${profileName}/${route}: NO ON-SCREEN CANVAS — VACUOUS, FAIL`); bad++; }
      // CANVAS drift invalidates the cell. TILE drift does not — it is a different
      // quantity on a different clock — but it is never silent, because a still-climbing
      // tile set means any tile verdict read off this cell is provisional.
      if (c.drift !== 0) { console.log(`  ${profileName}/${route}: CANVAS DRIFT != 0 — cell INVALID`); bad++; }
      if (c.tileDrift !== 0) console.log(`  ${profileName}/${route}: tile set still settling — tile numbers PROVISIONAL`);
      printCell(c);
      out.cells.push(c);
      if (has('--knownbad')) {
        const kb = await cell(browser, profileName, route, 'tier=high');
        const moved = key(kb.m) !== key(c.m);
        console.log(`     KNOWN-BAD tier=high -> tier=${kb.m.tier} cap=${kb.m.cap} `
          + `buf=${kb.on.map((x) => `${x.bufW}x${x.bufH}`).join(',')} : instrument `
          + `${moved ? 'SEES it (VALID)' : 'BLIND (INVALID)'}`);
        if (!moved) bad++;
        out.cells.push({ ...kb, route: `${route}#knownbad` });
      }
    }
  }
  if (has('--floorguard')) {
    for (const route of ROUTES) {
      const c = await cell(browser, 'ph-dpr1', route);
      if (c.on.length === 0) { console.log(`  FLOORGUARD ${route}: NO ON-SCREEN CANVAS — VACUOUS, FAIL`); bad++; continue; }
      printCell(c);
      const live = c.m.stages.filter((s) => s && !s.offscreen && s.pixelRatio !== null);
      if (live.length === 0) { console.log(`  FLOORGUARD ${route}: NO LIVE STAGE — VACUOUS, FAIL`); bad++; continue; }
      const over = live.filter((s) => s.pixelRatio > c.m.dpr + 1e-9);
      console.log(`     FLOOR GUARD ${route}: dpr=${c.m.dpr} stages=[${live.map((s) => s.pixelRatio).join(',')}]`
        + ` -> ${over.length === 0 ? 'no floor (PASS)' : `FLOOR INTRODUCED on ${over.length} stage(s) (FAIL)`}`);
      if (over.length) bad++;
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
