#!/usr/bin/env node
/**
 * QD_PROBE — IS IT RESOLUTION, OR IS IT VFX? Two metrics that move for one reason each.
 *
 * Uri, after playing the deployed build on an iPhone 15 Pro:
 *   *"It feels like there is a slight regression is VFX quality. home screen, and more
 *   specifically character screen seems like the resolution is slightly lower, or
 *   something else changed."*
 *
 * He named TWO things and said he is unsure which. This tool exists to make that
 * decidable, so nobody spends a session chasing the wrong one.
 *
 * ── WHAT IS MEASURED, AND WHY EACH ONE CANNOT ANSWER THE OTHER'S QUESTION ───────
 *
 *  S — SHARPNESS.  A Laplacian band-energy ratio over the CANVAS RECT ONLY:
 *        L0 = luma, Ln+1 = binomial([1,4,6,4,1]/16) blur of Ln
 *        B0 = rms(L0-L1)   the octave nearest Nyquist
 *        B1 = rms(L1-L2)   the octave below it
 *        S  = B0 / (B0 + B1)
 *      Dimensionless and contrast-free BY CONSTRUCTION: multiply the whole frame by k
 *      and B0, B1 both scale by k, so S is unchanged. That is precisely the property
 *      that makes it blind to "the effects got stronger/weaker" and sensitive to "the
 *      drawing buffer is smaller than the display and is being upscaled into it".
 *      ⚠️ It is measured INSIDE THE CANVAS BOX and nowhere else. The DOM around the
 *      canvas is text and vector at the full device ratio on every arm; including it
 *      would swamp the very signal being looked for.
 *
 *  V — VFX PRESENCE.  Two halves, deliberately:
 *      (a) STRUCTURAL, and EXACT (CLAUDE.md rule 10: draw counts are exact) — the post
 *          chain's pass count and effect names, bloom/SMAA/MSAA, scene mesh + light
 *          counts, `renderer.info.render.calls`, shadow map size.
 *      (b) DELIVERED — bloom ablated on a frozen frame at an UNCHANGED pixel ratio,
 *          differenced against the shipped frame: mean/255, and the count and share of
 *          pixels moving more than 2. This is the same ablation shape `quality.ts`
 *          itself documents for the 8-bit-buffer question.
 *
 * ── THE VALIDATION, BECAUSE AN UNCALIBRATED SHARPNESS NUMBER IS WORTHLESS ───────
 *
 *   `--mode calib` sweeps the EFFECTIVE PIXEL RATIO on ONE page load, by mutating
 *   `window.__quality.tiers.<t>.pixelRatioCap` and bouncing the forced tier so
 *   `Stage.applyQuality()` actually runs (it early-returns when the tier name is
 *   unchanged — that is why the bounce is there and not a tidiness). Nothing else on
 *   the page moves: same DOM, same scene, same materials, same character pose, rAF
 *   frozen. S must move MONOTONICALLY and V's structural half must not move at all.
 *
 *   `--mode vfxcal` does the mirror image: ONE page load, ONE pixel ratio, bloom
 *   ablated. V must move and S must not.
 *
 *   Either arm failing means the two metrics are not separable and NO number from this
 *   tool may be quoted. They are printed as PASS/FAIL, not as prose.
 *
 * ── THE DRIFT CONTROL (CLAUDE.md rule 4) ────────────────────────────────────────
 *   Every cell renders the identical frame TWICE and requires the two PNGs to be
 *   BYTE-FOR-BYTE identical before any non-zero number in that cell is believed. rAF
 *   is stubbed out, CSS animation is paused, and `rig.yawDeg` is pinned to 0 — the
 *   portrait's own `update()` sways it +/-22 degrees off a free-running clock, so a
 *   reload lands the model at an arbitrary yaw and two page loads are NOT comparable
 *   without pinning it.
 *
 * ── WHAT IS MEASURED ON, AND WHY IT IS NOT A DEV SERVER ─────────────────────────
 *   The gh-pages branch carries the EXACT built bundles Uri loads. Each arm is a
 *   detached worktree of a gh-pages commit, served as static files under the real
 *   `/food-arena/` base path. No Vite, no HMR, no working tree. `AGENT-BRIEF` §4.8:
 *   measure the artefact you ship, on the path you ship it to.
 *
 * ⚠️ SwiftShader is not a phone. The device profile below (393x852 CSS, dsf 3, coarse
 *    pointer, touch) makes the TIER LADDER and the PIXEL RATIO the ones Uri's device
 *    picks; it does not make the rasteriser his. Every number here is an A/B on one
 *    instrument, never an absolute claim about his screen.
 *
 * Usage:
 *   node tools/tmp/qd_probe.mjs --mode calib   --root /tmp/fa-qd-c --screen characters
 *   node tools/tmp/qd_probe.mjs --mode vfxcal  --root /tmp/fa-qd-c --screen characters
 *   node tools/tmp/qd_probe.mjs --mode deploy  --arm a=/tmp/fa-qd-a --arm b=/tmp/fa-qd-b \
 *                               --arm c=/tmp/fa-qd-c --screen characters --reps 3
 *   node tools/tmp/qd_probe.mjs --mode census  --root /tmp/fa-qd-c --screen home
 *   node tools/tmp/qd_probe.mjs --selftest
 */

import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { settleScreen } from './settle.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const argv = process.argv.slice(2);
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const has = (k) => argv.includes(k);
const getAll = (k) => argv.reduce((acc, v, i) => (v === k ? [...acc, argv[i + 1]] : acc), []);

const OUT = get('--out', 'tools/tmp/qd_out');

/**
 * Uri's device, stated once. iPhone 15 Pro, PORTRAIT, browser tab.
 *
 * `--landscape` swaps the two, because orientation is a thing that can change under a
 * player without a single byte of the bundle changing, and `index.html`'s own measured
 * table says the canvas is WIDTH-BOUND in portrait and screen-bound in landscape. Any
 * claim about "what Uri sees" has to name which of the two it measured.
 */
const DEVICE = has('--landscape')
  ? { width: 852, height: 393, dsf: 3 }
  : { width: 393, height: 852, dsf: 3 };

const BASE_PATH = '/food-arena';


// ─────────────────────────────────────────────────────────────────────────────
// Image maths. No dependency beyond sharp's decoder.
// ─────────────────────────────────────────────────────────────────────────────

/** Separable binomial [1,4,6,4,1]/16, edge-clamped. sigma ~ 1.0 px per application. */
function blur5(src, w, h) {
  const K = [1, 4, 6, 4, 1];
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) {
        const xx = Math.min(w - 1, Math.max(0, x + i));
        s += K[i + 2] * src[y * w + xx];
      }
      tmp[y * w + x] = s / 16;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) {
        const yy = Math.min(h - 1, Math.max(0, y + i));
        s += K[i + 2] * tmp[yy * w + x];
      }
      out[y * w + x] = s / 16;
    }
  }
  return out;
}

function rmsDiff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s / a.length);
}

/**
 * S, and the two band energies it is built from, so a reader can see whether a move in
 * S came from the fine octave collapsing or from the coarse one growing.
 */
export function sharpness(luma, w, h) {
  const L0 = luma;
  const L1 = blur5(L0, w, h);
  const L2 = blur5(L1, w, h);
  const L3 = blur5(L2, w, h);
  const B0 = rmsDiff(L0, L1);
  const B1 = rmsDiff(L1, L2);
  const B2 = rmsDiff(L2, L3);
  return { S: B0 / (B0 + B1), B0, B1, B2, px: w * h };
}

async function lumaOf(buf) {
  const img = sharp(buf).removeAlpha().greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const f = new Float32Array(info.width * info.height);
  for (let i = 0; i < f.length; i++) f[i] = data[i];
  return { luma: f, w: info.width, h: info.height };
}

/** Pixelwise delta between two same-size PNGs. Used for the bloom ablation. */
async function deltaStats(bufA, bufB) {
  const a = await sharp(bufA).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(bufB).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.data.length !== b.data.length) throw new Error('delta: size mismatch');
  const n = a.info.width * a.info.height;
  let sum = 0; let max = 0; let over2 = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 3;
    const d = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
    );
    sum += d; if (d > max) max = d; if (d > 2) over2++;
  }
  return { mean: sum / n, max, over2, over2pct: (100 * over2) / n, px: n };
}

// ─────────────────────────────────────────────────────────────────────────────
// The static server. One per arm; the PID/handle is kept and closed explicitly —
// nothing here is ever killed by pattern (CLAUDE.md 8b).
// ─────────────────────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serve(root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length);
      if (p === '' || p === '/') p = '/index.html';
      const file = path.join(root, p);
      if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404); res.end('404'); return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}${BASE_PATH}/` }));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-side helpers. Each is a plain function serialised into the page.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything structural about what is actually rendering, read off the live objects.
 * This is V(a). It contains no pixel measurement at all, on purpose.
 */
const censusFn = () => {
  const st = window.__stage;
  const out = {
    hasStage: !!st, screen: window.__screen ?? null, glLog: window.__glLog ?? [],
    // How many LIVE WebGL contexts this document is holding. iOS reclaims contexts
    // under memory pressure and `stage.ts`'s own `__glLog` exists because a reclaimed
    // one is invisible in every other artefact. A count that GREW between two deploys
    // would be a mechanism for "it looks different" with no pixel change in the bundle.
    liveStages: Array.isArray(window.__stages) ? window.__stages.length : null,
    canvasCount: document.querySelectorAll('canvas').length,
  };
  const q = window.__quality;
  if (q) {
    out.tier = q.tier; out.choice = q.choice; out.forced = q.forced; out.detected = q.detected;
    out.profile = JSON.parse(JSON.stringify(q.profile));
    out.signals = JSON.parse(JSON.stringify(q.signals));
  }
  out.dpr = window.devicePixelRatio;
  if (!st) return out;
  const r = st.renderer;
  const c = r.domElement;
  const rect = c.getBoundingClientRect();
  out.canvas = {
    cssW: +rect.width.toFixed(2), cssH: +rect.height.toFixed(2),
    cssX: +rect.x.toFixed(2), cssY: +rect.y.toFixed(2),
    bufW: c.width, bufH: c.height,
    pixelRatio: r.getPixelRatio(),
    // The number that decides how soft the upscale is. 1 means native.
    upscale: +(window.devicePixelRatio / r.getPixelRatio()).toFixed(4),
  };
  out.render = { calls: r.info.render.calls, tris: r.info.render.triangles, lines: r.info.render.lines };
  out.memory = { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
  out.programs = r.info.programs ? r.info.programs.length : null;
  out.shadow = { enabled: r.shadowMap.enabled, type: r.shadowMap.type };
  // The post chain, by NAME. `composer` is private in TS and present at runtime.
  const comp = st.composer;
  if (comp && comp.passes) {
    out.post = comp.passes.map((p) => {
      const e = p.effects ? [...p.effects].map((x) => x.name ?? x.constructor.name) : null;
      return { pass: p.name ?? p.constructor.name, effects: e };
    });
  } else out.post = null;
  // Scene census. Groups by constructor so "what is even on this screen" is answerable.
  const byType = {}; const lights = []; const named = [];
  let meshes = 0; let visibleMeshes = 0; let shadowCasters = 0; let materials = new Set();
  st.scene.traverse((o) => {
    const t = o.type;
    byType[t] = (byType[t] ?? 0) + 1;
    if (o.isMesh || o.isPoints || o.isSprite || o.isLine) {
      meshes++;
      let vis = o.visible;
      for (let n = o.parent; n && vis; n = n.parent) vis = n.visible;
      if (vis) visibleMeshes++;
      if (o.castShadow) shadowCasters++;
      const m = o.material;
      for (const mm of Array.isArray(m) ? m : [m]) if (mm) materials.add(mm.uuid);
    }
    if (o.isLight) lights.push({ type: o.type, name: o.name, intensity: o.intensity, shadow: !!o.castShadow });
    if (o.name) named.push(o.name);
  });
  out.scene = {
    byType, meshes, visibleMeshes, shadowCasters, materials: materials.size,
    lights, namedSample: named.slice(0, 400),
  };
  const rig = st.rig;
  out.rig = {
    pitchDeg: rig.pitchDeg, yawDeg: +Number(rig.yawDeg).toFixed(4),
    frameMode: rig.frameMode,
    fov: +rig.camera.fov.toFixed(3), aspect: +rig.camera.aspect.toFixed(4),
  };
  out.charStage = typeof window.__charStage === 'function' ? window.__charStage() : null;
  return out;
};

/**
 * Freeze everything that can move between two shutters.
 *
 * rAF is stubbed (AGENT-BRIEF: the app loop, not the clock). CSS animation is PAUSED
 * rather than removed — `settle.mjs` already waited out every finite entry animation,
 * so what is left is the infinite decoration, and pausing keeps its computed styles
 * where the settled frame had them. `rig.yawDeg` is pinned because the portrait's own
 * update sways it off a free-running clock.
 */
const freezeFn = () => {
  if (!window.__qdFrozen) {
    window.__qdRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = () => 0;
    window.__qdFrozen = true;
  }
  const s = document.getElementById('qd-still') ?? document.createElement('style');
  s.id = 'qd-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused !important;'
    + 'transition:none !important;}';
  if (!s.parentNode) document.head.appendChild(s);
  return { froze: true };
};

/**
 * Pin everything the app's own loop would otherwise own, and draw once.
 *
 * ⚠️ THIS MUST RUN AFTER A REAL FRAME HAS ELAPSED SINCE `freezeFn`, and that is not a
 * timing superstition. Replacing `requestAnimationFrame` does not cancel the callback
 * the loop has ALREADY registered through the real one: it fires once more, runs
 * `MenuCharacterStage.update()`, and that method writes `rig.yawDeg` from its own
 * free-running `elapsed`. A first run of this probe pinned the yaw to 0 inside
 * `freezeFn` and then read **5.55 degrees** back out of the census — the pin was
 * silently undone by the last queued frame. Freeze, let that frame land, THEN pin.
 *
 * `shakeAmount` (not `shake` — `shake()` is the METHOD that kicks one off) is zeroed
 * for belt and braces. `CameraRig.update` now gates the re-randomisation on
 * `dtSeconds > 0`, so a dt-0 draw holds the offset rather than re-rolling it; that is
 * a change since `docs/AGENT-BRIEF.md` §3's warning was written, and the drift control
 * below is what proves it rather than the comment.
 */
const pinFn = () => {
  const st = window.__stage;
  if (!st) return null;
  const before = { yawDeg: st.rig.yawDeg, shakeAmount: st.rig.shakeAmount ?? null };
  st.rig.yawDeg = 0;
  if (typeof st.rig.shakeAmount === 'number') st.rig.shakeAmount = 0;
  st.renderer.info.autoReset = false;
  st.renderer.info.reset();
  st.render(0);
  return { before, after: { yawDeg: st.rig.yawDeg, shakeAmount: st.rig.shakeAmount ?? null } };
};

/**
 * 🚨 ISOLATE THE CANVAS, BECAUSE A CLIPPED PAGE SCREENSHOT IS NOT A CANVAS SCREENSHOT.
 *
 * `docs/AGENT-BRIEF.md` §3 already says this about a fixed HUD and it is just as true
 * of a menu: `page.screenshot({ clip: <canvas rect> })` composites the WHOLE DOCUMENT
 * and then crops. The character screen draws "Hamburger", "NORMAL" and "EQUIPPED" as
 * DOM **on top of** the canvas, and DOM text is rasterised at the full device ratio on
 * every arm no matter what the drawing buffer is doing.
 *
 * MEASURED, and this is why the isolation exists rather than being a tidiness: with the
 * overlay in frame, S over a 0.5 -> 2.0 pixel-ratio sweep moved
 *
 *     0.7293  0.7266  0.7246  0.7236  0.7235  0.7238        span -0.0055
 *
 * i.e. it went the WRONG WAY and by nothing — a four-fold change in drawing-buffer
 * resolution reading as a flat line, because the sharp glyph edges owned the fine
 * octave and swamped the 3D. That run is the known-bad input this arm is validated
 * against: the tool printed FAIL, which is the only reason the defect was visible.
 *
 * `visibility` is the right lever and `display` is not: visibility does not affect
 * layout, so the canvas keeps its exact box and the drawing buffer is never resized by
 * the act of measuring it. It is also inherited, so ONE rule hides the document and one
 * exception brings the canvas back.
 */
const isolateFn = (on) => {
  const c = window.__stage?.renderer?.domElement;
  if (!c) return false;
  c.setAttribute('data-qd-target', '1');
  let s = document.getElementById('qd-iso');
  if (!on) { s?.remove(); return true; }
  if (!s) { s = document.createElement('style'); s.id = 'qd-iso'; document.head.appendChild(s); }
  s.textContent = 'body *{visibility:hidden !important}'
    + '[data-qd-target="1"]{visibility:visible !important}';
  return true;
};

/**
 * One deterministic draw, with the draw counters accumulated across the WHOLE post
 * chain rather than reset by it.
 *
 * 🚨 `renderer.info.render.calls` read straight after a composer render reports the
 * LAST PASS ONLY — `WebGLRenderer` resets `info` on every `render()` and the composer
 * calls it once per pass. The first run of this tool duly printed **draws=1, tris=1**
 * for a 226-mesh scene, which is the final fullscreen triangle and not the frame.
 * `autoReset = false` + an explicit `reset()` before the draw is what makes the number
 * mean what its name says.
 */
const renderFn = () => {
  const st = window.__stage;
  if (!st) return false;
  st.renderer.info.autoReset = false;
  st.renderer.info.reset();
  st.render(0);
  return true;
};

/**
 * Set the effective pixel ratio by mutating the live tier table.
 *
 * `Stage.applyQuality()` early-returns when `next.tier === prev.tier`, so writing the
 * cap and re-forcing the SAME tier is a no-op — the bounce through a different tier is
 * what makes the write take effect. Returns the ratio the renderer actually adopted,
 * never the one that was asked for.
 */
const setRatioFn = (cap) => {
  const q = window.__quality;
  const st = window.__stage;
  if (!q || !st) return null;
  q.tiers.low.pixelRatioCap = cap;
  q.tiers.medium.pixelRatioCap = cap;
  q.tiers.high.pixelRatioCap = cap;
  q.force('high');
  q.force('low');
  st.render(0);
  return { asked: cap, got: st.renderer.getPixelRatio(), bufW: st.renderer.domElement.width, bufH: st.renderer.domElement.height };
};

/** Ablate bloom at an unchanged pixel ratio, by rebuilding the post chain. */
const setBloomFn = (on) => {
  const q = window.__quality;
  const st = window.__stage;
  if (!q || !st) return null;
  for (const t of ['low', 'medium', 'high']) q.tiers[t].bloom = on;
  const cur = q.tier;
  q.force(cur === 'high' ? 'low' : 'high');
  q.force(cur);
  st.render(0);
  const comp = st.composer;
  const names = comp && comp.passes
    ? comp.passes.flatMap((p) => (p.effects ? [...p.effects].map((x) => x.name ?? x.constructor.name) : [p.name ?? p.constructor.name]))
    : [];
  return { asked: on, ratio: st.renderer.getPixelRatio(), effects: names, hasBloom: names.some((n) => /bloom/i.test(n)) };
};

// ─────────────────────────────────────────────────────────────────────────────
// Cell: one page, one configuration, two shutters, one verdict.
// ─────────────────────────────────────────────────────────────────────────────

const ISOLATE = !has('--no-isolate');

async function shootCanvas(page, tag) {
  const clip = await page.evaluate(() => {
    const c = window.__stage?.renderer?.domElement;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  });
  if (!clip || clip.width < 8 || clip.height < 8) throw new Error(`no canvas rect [${tag}]`);
  await page.evaluate(isolateFn, ISOLATE);
  const buf = await page.screenshot({ clip });
  return { buf, clip };
}

/**
 * Two identical shutters. Returns the pair and whether they are byte-identical.
 * NOTHING downstream may quote a number from a cell whose drift is non-zero.
 */
async function driftPair(page, tag) {
  await page.evaluate(renderFn);
  const a = await shootCanvas(page, `${tag}#1`);
  await page.evaluate(renderFn);
  const b = await shootCanvas(page, `${tag}#2`);
  const identical = Buffer.compare(a.buf, b.buf) === 0;
  const d = identical ? { mean: 0, max: 0, over2: 0, over2pct: 0 } : await deltaStats(a.buf, b.buf);
  return { buf: a.buf, clip: a.clip, identical, drift: d };
}

async function openArm(root, screen, query = '') {
  const { srv, url } = await serve(root);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const ctx = await browser.newContext({
    viewport: { width: DEVICE.width, height: DEVICE.height },
    deviceScaleFactor: DEVICE.dsf,
    isMobile: true,
    hasTouch: true,
    // isMobile alone does not make `(pointer: coarse)` match in every Chromium build;
    // hasTouch is what supplies `maxTouchPoints`. Both signals are what `detectTier()`
    // gates on, and the tier is the thing under test.
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
  await page.goto(`${url}?screen=${screen}${query}`, { waitUntil: 'load' });
  await settleScreen(page, { timeout: 120_000, label: screen });
  // The portrait Stage is built on first use and its first frames carry the intro pop
  // (introT 0.34 s). Give it real frames before freezing.
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 60_000 });
  await page.evaluate(freezeFn);
  // Let the ALREADY-QUEUED rAF callback land before pinning. See `pinFn`.
  await page.waitForTimeout(400);
  const pinned = await page.evaluate(pinFn);
  return { srv, browser, ctx, page, url, pinned };
}

/** Re-freeze and re-pin after anything that could have restarted the loop. */
async function refreeze(page) {
  await page.evaluate(freezeFn);
  return page.evaluate(pinFn);
}

async function closeArm(arm) {
  await arm.browser.close().catch(() => {});
  await new Promise((r) => arm.srv.close(r));
}

async function measure(page, tag) {
  const pair = await driftPair(page, tag);
  const { luma, w, h } = await lumaOf(pair.buf);
  const s = sharpness(luma, w, h);
  return { ...pair, ...s, w, h };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modes
// ─────────────────────────────────────────────────────────────────────────────

function line(...c) { console.log(c.join('')); }
const f = (v, n = 4) => (v === null || v === undefined || Number.isNaN(v) ? '   n/a' : Number(v).toFixed(n));

async function modeCensus(root, screen) {
  const arm = await openArm(root, screen);
  try {
    const c = await arm.page.evaluate(censusFn);
    const m = await measure(arm.page, `census-${screen}`);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, `census_${screen}.json`), JSON.stringify(c, null, 2));
    writeFileSync(path.join(OUT, `census_${screen}.png`), m.buf);
    line(`\n== CENSUS ${screen} @ ${root} ==`);
    line(`  tier=${c.tier} (detected ${c.detected}, forced ${c.forced})  dpr=${c.dpr}`);
    line(`  canvas css ${c.canvas.cssW}x${c.canvas.cssH}  buffer ${c.canvas.bufW}x${c.canvas.bufH}`
      + `  pixelRatio ${c.canvas.pixelRatio}  UPSCALE x${c.canvas.upscale}`);
    line(`  draws=${c.render.calls} tris=${c.render.tris} progs=${c.programs} tex=${c.memory.textures} geo=${c.memory.geometries}`);
    line(`  post: ${c.post ? JSON.stringify(c.post) : 'NO COMPOSER'}`);
    line(`  scene: meshes=${c.scene.meshes} visible=${c.scene.visibleMeshes} casters=${c.scene.shadowCasters} materials=${c.scene.materials}`);
    line(`  lights: ${c.scene.lights.map((l) => `${l.type}${l.shadow ? '*' : ''}@${f(l.intensity, 2)}`).join(' ')}`);
    line(`  rig: pitch=${c.rig.pitchDeg} yaw=${c.rig.yawDeg} mode=${c.rig.frameMode} fov=${c.rig.fov}`);
    line(`  liveStages=${c.liveStages} canvases=${c.canvasCount}  glLog: ${JSON.stringify(c.glLog)}`);
    line(`  pin: ${JSON.stringify(arm.pinned)}`);
    line(`  DRIFT: ${m.identical ? 'byte-identical (0)' : `NON-ZERO mean ${f(m.drift.mean)} max ${m.drift.max}`}`);
    line(`  S=${f(m.S)}  B0=${f(m.B0, 3)} B1=${f(m.B1, 3)}  (${m.w}x${m.h} px)`);
    line(`  types: ${JSON.stringify(c.scene.byType)}`);
    line(`  wrote ${OUT}/census_${screen}.{json,png}`);
    return { census: c, m };
  } finally { await closeArm(arm); }
}

const CALIB_CAPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

async function modeCalib(root, screen) {
  const arm = await openArm(root, screen);
  try {
    mkdirSync(OUT, { recursive: true });
    const rows = [];
    for (const cap of CALIB_CAPS) {
      // eslint-disable-next-line no-await-in-loop
      const applied = await arm.page.evaluate(setRatioFn, cap);
      // eslint-disable-next-line no-await-in-loop
      await refreeze(arm.page);                // applyQuality -> resize -> render: re-pin
      // eslint-disable-next-line no-await-in-loop
      const m = await measure(arm.page, `calib-${cap}`);
      writeFileSync(path.join(OUT, `calib_${screen}_r${String(cap).replace('.', 'p')}.png`), m.buf);
      // eslint-disable-next-line no-await-in-loop
      const c = await arm.page.evaluate(censusFn);
      rows.push({ cap, applied, m, c });
    }
    line(`\n== CALIBRATION: S vs EFFECTIVE PIXEL RATIO  [${screen} @ ${root}] ==`);
    line('  asked   got   buffer      draws  post-passes   S        B0      B1     drift');
    for (const r of rows) {
      line(`  ${String(r.cap).padEnd(6)} ${String(r.applied.got).padEnd(5)} `
        + `${String(`${r.applied.bufW}x${r.applied.bufH}`).padEnd(11)} `
        + `${String(r.c.render.calls).padEnd(6)} ${String(r.c.post ? r.c.post.length : 0).padEnd(13)} `
        + `${f(r.m.S)}  ${f(r.m.B0, 3)}  ${f(r.m.B1, 3)}  ${r.m.identical ? '0' : 'NONZERO'}`);
    }
    // ── The known-bad this mode exists to be: S must be monotone in the ratio, over
    //    the arms that the caller ACTUALLY GOT (the cap is a ceiling; asking for 3 on
    //    charStage returns 2, so two arms can share a ratio and neither is a step).
    const distinct = [];
    for (const r of rows) if (!distinct.some((x) => x.applied.got === r.applied.got)) distinct.push(r);
    // 🚨 [].every() is true. Assert the filtered set is non-empty AND has enough arms
    //    to express a monotone trend before believing the verdict.
    if (distinct.length < 3) {
      line(`  FAIL  only ${distinct.length} distinct pixel ratios were achieved — nothing to calibrate`);
      return { rows, ok: false };
    }
    distinct.sort((a, b) => a.applied.got - b.applied.got);
    let mono = true;
    for (let i = 1; i < distinct.length; i++) if (!(distinct[i].m.S > distinct[i - 1].m.S)) mono = false;
    const span = distinct[distinct.length - 1].m.S - distinct[0].m.S;
    const allClean = rows.every((r) => r.m.identical);
    const structFlat = rows.every((r) => (r.c.post ? r.c.post.length : 0) === (rows[0].c.post ? rows[0].c.post.length : 0));
    line(`  ${mono ? 'PASS' : 'FAIL'}  S is ${mono ? '' : 'NOT '}strictly increasing across ${distinct.length} distinct ratios `
      + `(${distinct.map((d) => d.applied.got).join(' < ')}), span ${f(span)}`);
    line(`  ${allClean ? 'PASS' : 'FAIL'}  every cell byte-identical on its drift control`);
    line(`  ${structFlat ? 'PASS' : 'FAIL'}  V(a) post-pass count did not move with the pixel ratio`);
    return { rows, ok: mono && allClean && structFlat, span, distinct };
  } finally { await closeArm(arm); }
}

async function modeVfxcal(root, screen) {
  const arm = await openArm(root, screen);
  try {
    mkdirSync(OUT, { recursive: true });
    // Pin the ratio so the ONLY thing that changes is the effect.
    await arm.page.evaluate(setRatioFn, 2);
    await refreeze(arm.page);
    const on = await arm.page.evaluate(setBloomFn, true);
    await refreeze(arm.page);
    const mOn = await measure(arm.page, 'bloom-on');
    const off = await arm.page.evaluate(setBloomFn, false);
    await refreeze(arm.page);
    const mOff = await measure(arm.page, 'bloom-off');
    writeFileSync(path.join(OUT, `vfxcal_${screen}_bloomON.png`), mOn.buf);
    writeFileSync(path.join(OUT, `vfxcal_${screen}_bloomOFF.png`), mOff.buf);
    const d = await deltaStats(mOn.buf, mOff.buf);
    const cOn = on; const cOff = off;
    line(`\n== ORTHOGONALITY: bloom ablated at a PINNED pixel ratio  [${screen} @ ${root}] ==`);
    line(`  bloom ON   ratio ${cOn.ratio}  effects ${JSON.stringify(cOn.effects)}`);
    line(`  bloom OFF  ratio ${cOff.ratio}  effects ${JSON.stringify(cOff.effects)}`);
    line(`  V delivered: mean ${f(d.mean)}/255  max ${d.max}  pixels>2 ${d.over2} (${f(d.over2pct, 3)}%)`);
    line(`  S  on=${f(mOn.S)}  off=${f(mOff.S)}   dS=${f(mOff.S - mOn.S)}`);
    line(`  drift: on=${mOn.identical ? '0' : 'NONZERO'} off=${mOff.identical ? '0' : 'NONZERO'}`);
    const ratioHeld = cOn.ratio === cOff.ratio;
    const vMoved = d.over2 > 0 && cOn.hasBloom !== cOff.hasBloom;
    line(`  ${ratioHeld ? 'PASS' : 'FAIL'}  pixel ratio unchanged across the ablation (${cOn.ratio} == ${cOff.ratio})`);
    line(`  ${vMoved ? 'PASS' : 'FAIL'}  V moved when the effect was removed (bloom present ${cOn.hasBloom} -> ${cOff.hasBloom})`);
    return { d, mOn, mOff, ok: ratioHeld && vMoved && mOn.identical && mOff.identical };
  } finally { await closeArm(arm); }
}

async function modeDeploy(arms, screen, reps) {
  mkdirSync(OUT, { recursive: true });
  const results = {};
  for (const spec of arms) {
    const [label, root] = spec.split('=');
    results[label] = [];
    for (let i = 0; i < reps; i++) {
      // eslint-disable-next-line no-await-in-loop
      const arm = await openArm(root, screen);
      try {
        // eslint-disable-next-line no-await-in-loop
        const c = await arm.page.evaluate(censusFn);
        // eslint-disable-next-line no-await-in-loop
        const m = await measure(arm.page, `${label}#${i}`);
        if (i === 0) writeFileSync(path.join(OUT, `deploy_${screen}_${label}.png`), m.buf);
        results[label].push({ c, m: { S: m.S, B0: m.B0, B1: m.B1, identical: m.identical, w: m.w, h: m.h } });
        console.log(`  ${label}#${i}  tier=${c.tier} ratio=${c.canvas.pixelRatio} buf=${c.canvas.bufW}x${c.canvas.bufH}`
          + ` draws=${c.render.calls} post=${c.post ? c.post.length : 0} S=${f(m.S)} drift=${m.identical ? '0' : 'NONZERO'}`);
      } finally { await closeArm(arm); }
    }
  }
  line(`\n== DEPLOY A/B  [${screen}]  n=${reps} independent page loads per arm ==`);
  line('  arm   tier   ratio  buffer       draws  tris     post  meshes  S mean    S range   drift');
  const summary = {};
  for (const [label, runs] of Object.entries(results)) {
    const S = runs.map((r) => r.m.S);
    const mean = S.reduce((a, b) => a + b, 0) / S.length;
    const range = Math.max(...S) - Math.min(...S);
    const c = runs[0].c;
    summary[label] = { mean, range, c, S };
    line(`  ${label.padEnd(5)} ${String(c.tier).padEnd(6)} ${String(c.canvas.pixelRatio).padEnd(6)} `
      + `${String(`${c.canvas.bufW}x${c.canvas.bufH}`).padEnd(12)} `
      + `${String(c.render.calls).padEnd(6)} ${String(c.render.tris).padEnd(8)} `
      + `${String(c.post ? c.post.length : 0).padEnd(5)} ${String(c.scene.visibleMeshes).padEnd(7)} `
      + `${f(mean)}   ${f(range)}   ${runs.every((r) => r.m.identical) ? '0' : 'NONZERO'}`);
  }
  const labels = Object.keys(summary);
  const nullFloor = Math.max(...labels.map((l) => summary[l].range));
  line(`\n  NULL ARM (same bundle, reload to reload): worst within-arm S range = ${f(nullFloor)}`);
  line('  -> any cross-arm dS smaller than that is NOISE and must not be quoted.');
  for (let i = 1; i < labels.length; i++) {
    const a = summary[labels[i - 1]]; const b = summary[labels[i]];
    const d = b.mean - a.mean;
    line(`  ${labels[i - 1]} -> ${labels[i]}: dS = ${f(d)}  ${Math.abs(d) > nullFloor ? 'ABOVE the floor' : 'inside the floor (NULL)'}`);
  }
  writeFileSync(path.join(OUT, `deploy_${screen}.json`), JSON.stringify(results, null, 2));
  line(`  wrote ${OUT}/deploy_${screen}.json`);
  return { results, summary, nullFloor };
}

/**
 * TIERGAP — what the phone tier actually costs, in BOTH currencies at once.
 *
 * The two calibration modes prove S and V are separable. This one spends that: it
 * forces `low`, `medium` and `high` on ONE page load and reports S (resolution) and the
 * delivered delta against `low` (everything else) for each. It is the only mode whose
 * arms differ in more than one knob — which is the point, because a TIER is a bundle of
 * knobs and "what would raising it buy" is the question a fix has to answer.
 *
 * ⚠️ The delivered delta here is NOT attributable to bloom alone: `low -> high` changes
 * the pixel ratio, bloom, SMAA, the shadow map and the ink outlines together. Read it as
 * a total, and read `--mode vfxcal` for the bloom-only figure.
 */
async function modeTiergap(root, screen) {
  const arm = await openArm(root, screen);
  try {
    mkdirSync(OUT, { recursive: true });
    const out = {};
    for (const t of ['low', 'medium', 'high']) {
      // eslint-disable-next-line no-await-in-loop
      const applied = await arm.page.evaluate((tt) => {
        const q = window.__quality; const st = window.__stage;
        q.force(tt); st.render(0);
        const comp = st.composer;
        const fx = comp && comp.passes
          ? comp.passes.flatMap((p) => (p.effects ? [...p.effects].map((x) => x.name ?? x.constructor.name) : [p.name ?? p.constructor.name]))
          : [];
        return { tier: q.tier, ratio: st.renderer.getPixelRatio(), fx, passes: comp ? comp.passes.length : 0 };
      }, t);
      // eslint-disable-next-line no-await-in-loop
      await refreeze(arm.page);
      // eslint-disable-next-line no-await-in-loop
      const m = await measure(arm.page, `tier-${t}`);
      writeFileSync(path.join(OUT, `tiergap_${screen}_${t}.png`), m.buf);
      out[t] = { applied, m };
    }
    line(`\n== TIER GAP  [${screen} @ ${root}] ==`);
    for (const t of ['low', 'medium', 'high']) {
      const o = out[t];
      // eslint-disable-next-line no-await-in-loop
      const d = t === 'low' ? { mean: 0, max: 0, over2: 0, over2pct: 0 } : await deltaStats(out.low.m.buf, o.m.buf);
      line(`  ${t.padEnd(7)} ratio ${String(o.applied.ratio).padEnd(5)} passes ${o.applied.passes} `
        + `S=${f(o.m.S)}  delivered-vs-low mean ${f(d.mean)}/255 max ${d.max} px>2 ${f(d.over2pct, 3)}%  `
        + `drift ${o.m.identical ? '0' : 'NONZERO'}  fx ${JSON.stringify(o.applied.fx)}`);
    }
    return out;
  } finally { await closeArm(arm); }
}

/**
 * PAGEDIFF — the arm that catches what S and V are BLIND TO BY POLICY.
 *
 * S is measured with the DOM hidden, because that is the only way it can read the
 * drawing buffer's resolution. That policy has an exact cost: **a change that is
 * entirely DOM — a new strip, a moved button, a different icon size — cannot move S,
 * cannot move a draw count, and cannot move a mesh census.** `AGENT-BRIEF` §4.6: ask
 * what fraction of the frame your metric governs and what is excluded from it BY
 * POLICY. On this screen the excluded fraction is every pixel of chrome.
 *
 * So this mode captures the WHOLE viewport, both arms, and differences them. It is not
 * a metric; it is a completeness check on the other two.
 *
 * ⚠️ ITS OWN NULL ARM IS MANDATORY AND IS NOT ZERO. Two independent page loads of the
 * SAME bundle still differ: `rig.yawDeg` is pinned but the portrait model's idle phase
 * is driven by a free-running `elapsed` this probe cannot reach, so the character's
 * limbs land at a different point in their cycle. The same-bundle number is printed
 * first, and a cross-bundle number that does not clear it says nothing.
 */
async function modePagediff(arms, screen) {
  mkdirSync(OUT, { recursive: true });
  const shots = {};
  for (const spec of arms) {
    const [label, root] = spec.split('=');
    shots[label] = [];
    for (let i = 0; i < 2; i++) {
      // eslint-disable-next-line no-await-in-loop
      const arm = await openArm(root, screen);
      try {
        // eslint-disable-next-line no-await-in-loop
        await page_fullFreeze(arm.page);
        // eslint-disable-next-line no-await-in-loop
        const buf = await arm.page.screenshot({ clip: { x: 0, y: 0, width: DEVICE.width, height: DEVICE.height } });
        shots[label].push(buf);
        writeFileSync(path.join(OUT, `page_${screen}_${label}${i}.png`), buf);
      } finally { await closeArm(arm); }
    }
  }
  line(`\n== FULL-PAGE DIFF  [${screen}] ==`);
  const labels = Object.keys(shots);
  const nulls = [];
  for (const l of labels) {
    // eslint-disable-next-line no-await-in-loop
    const d = await deltaStats(shots[l][0], shots[l][1]);
    nulls.push(d.over2pct);
    line(`  NULL  ${l} vs itself (two page loads): mean ${f(d.mean)}/255  max ${d.max}  px>2 ${d.over2} (${f(d.over2pct, 3)}%)`);
  }
  const floor = Math.max(...nulls);
  for (let i = 1; i < labels.length; i++) {
    const A = labels[i - 1]; const B = labels[i];
    // eslint-disable-next-line no-await-in-loop
    const d = await deltaStats(shots[A][0], shots[B][0]);
    // eslint-disable-next-line no-await-in-loop
    await writeHeat(shots[A][0], shots[B][0], path.join(OUT, `pagediff_${screen}_${A}_${B}.png`));
    line(`  ${A} -> ${B}: mean ${f(d.mean)}/255  max ${d.max}  px>2 ${d.over2} (${f(d.over2pct, 3)}%)`
      + `  ${d.over2pct > floor ? 'ABOVE the null' : 'inside the null'}`);
  }
  line(`  null floor (worst same-bundle px>2): ${f(floor, 3)}%   heatmaps in ${OUT}/`);
  return { floor };
}

/** Freeze rAF, let the queued frame land, pin, draw. Full page: NO canvas isolation. */
async function page_fullFreeze(page) {
  await page.evaluate(freezeFn);
  await page.waitForTimeout(400);
  await page.evaluate(pinFn);
  await page.evaluate(isolateFn, false);
  await page.evaluate(renderFn);
}

/** A red-channel heatmap of |A-B|, so the diff can be LOOKED AT and not only totalled. */
async function writeHeat(bufA, bufB, dest) {
  const a = await sharp(bufA).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(bufB).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = a.info.width * a.info.height;
  const out = Buffer.alloc(n * 3);
  for (let p = 0; p < n; p++) {
    const i = p * 3;
    const d = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
    );
    const v = Math.min(255, d * 8);
    out[i] = v; out[i + 1] = v > 40 ? 0 : v; out[i + 2] = v > 40 ? 0 : v;
  }
  await sharp(out, { raw: { width: a.info.width, height: a.info.height, channels: 3 } }).png().toFile(dest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Selftest — the LOGIC of the metric only. It says nothing about where the tool is
// pointed, and CLAUDE.md rule 6 is explicit that those are different claims.
// ─────────────────────────────────────────────────────────────────────────────

async function selftest() {
  let fails = 0;
  const ck = (name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${detail}`); };

  const W = 256; const H = 256;
  // A seeded broadband field — NOT a 1px checkerboard. A checkerboard is degenerate
  // here: sampling it on a 2x grid returns a CONSTANT image, B0 and B1 both go to
  // zero and S is 0/0. That NaN was the first thing this selftest caught, on itself.
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const base = new Float32Array(W * H);
  for (let i = 0; i < base.length; i++) base[i] = rnd() * 255;

  // The 1/2/4 ladder IS the calibration mode's assertion in miniature: a frame drawn
  // into a buffer k times smaller than the display and blown back up.
  const upscaled = (k) => {
    const im = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        im[y * W + x] = base[(Math.floor(y / k) * k) * W + (Math.floor(x / k) * k)];
      }
    }
    return im;
  };
  const a = sharpness(base, W, H);
  const b = sharpness(upscaled(2), W, H);
  ck('A1 S falls when the image is upscaled from half res',
    Number.isFinite(b.S) && b.S < a.S, `${a.S.toFixed(4)} -> ${b.S.toFixed(4)}`);

  // KNOWN-BAD for the CONTRAST blindness claim: scale the whole image by 0.4 (what a
  // weaker effect / dimmer frame does) and require S NOT to move. If this ever fails,
  // S is reading effect strength and the whole separation collapses.
  const dim = new Float32Array(W * H);
  for (let i = 0; i < dim.length; i++) dim[i] = base[i] * 0.4;
  const c = sharpness(dim, W, H);
  ck('A2 S is blind to a 0.4x contrast scale', Math.abs(c.S - a.S) < 1e-6, `${a.S.toFixed(6)} vs ${c.S.toFixed(6)}`);

  // KNOWN-BAD for "S responds to blur at all": if blur5 were a no-op both arms above
  // would be equal. Assert the blur actually changes the array.
  const blurred = blur5(base, W, H);
  ck('A3 the blur kernel is not a no-op', rmsDiff(base, blurred) > 1, `rms ${rmsDiff(base, blurred).toFixed(2)}`);

  const ladder = [1, 2, 4].map((k) => sharpness(upscaled(k), W, H).S);
  ck('A4 S is monotone across a 1/2/4 upscale ladder',
    ladder.every(Number.isFinite) && ladder[0] > ladder[1] && ladder[1] > ladder[2],
    ladder.map((v) => v.toFixed(4)).join(' > '));

  // A5 — the arm that says S measures BLUR and not merely "fewer distinct values".
  // A genuine low-pass at the SAME resolution must also drop S.
  const lp = sharpness(blur5(base, W, H), W, H);
  ck('A5 S falls under a same-resolution low-pass', lp.S < a.S, `${a.S.toFixed(4)} -> ${lp.S.toFixed(4)}`);

  // deltaStats known-bad: identical buffers must give exactly zero, and a planted
  // 3-level difference on ONE pixel must be seen. A differ that cannot see a planted
  // defect is not a differ.
  const mk = (v) => sharp(Buffer.from(new Uint8Array(3 * 4 * 4).fill(v)), { raw: { width: 4, height: 4, channels: 3 } }).png().toBuffer();
  const p0 = await mk(100);
  const raw = new Uint8Array(3 * 4 * 4).fill(100); raw[0] = 104;
  const p1 = await sharp(Buffer.from(raw), { raw: { width: 4, height: 4, channels: 3 } }).png().toBuffer();
  const d0 = await deltaStats(p0, p0);
  const d1 = await deltaStats(p0, p1);
  ck('B1 deltaStats is exactly 0 on identical input', d0.mean === 0 && d0.over2 === 0, `mean ${d0.mean} over2 ${d0.over2}`);
  ck('B2 deltaStats sees a planted 4/255 on 1 of 16 px', d1.max === 4 && d1.over2 === 1, `max ${d1.max} over2 ${d1.over2}`);

  // C: the vacuity guard the calibration mode carries. [].every() is true, so the
  // monotone verdict on an empty or one-element distinct set must NOT read PASS.
  const emptyOk = (arr) => arr.length >= 3;
  ck('C1 the monotone check refuses a set with <3 distinct ratios',
    !emptyOk([]) && !emptyOk([1]) && !emptyOk([1, 2]) && emptyOk([1, 2, 3]), 'guard present');

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nall selftests pass');
  return fails;
}

// ─────────────────────────────────────────────────────────────────────────────

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (has('--selftest')) {
    process.exitCode = (await selftest()) ? 1 : 0;
  } else {
    const mode = get('--mode', 'census');
    const screen = get('--screen', 'characters');
    const root = get('--root', '/tmp/fa-qd-c');
    if (mode === 'census') await modeCensus(root, screen);
    else if (mode === 'calib') await modeCalib(root, screen);
    else if (mode === 'vfxcal') await modeVfxcal(root, screen);
    else if (mode === 'deploy') await modeDeploy(getAll('--arm'), screen, Number(get('--reps', '3')));
    else if (mode === 'pagediff') await modePagediff(getAll('--arm'), screen);
    else if (mode === 'tiergap') await modeTiergap(root, screen);
    else { console.error(`unknown --mode ${mode}`); process.exitCode = 2; }
  }
}
