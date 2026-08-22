#!/usr/bin/env node
/**
 * LC_PROBE — the three questions in Uri's item 4, turned into numbers.
 *
 *   > *"Everything is lit at uniform intensity with no sense of depth or weight. Add ambient
 *   > occlusion so objects darken where they meet the floor and where surfaces meet. Set up
 *   > warm/cool lighting contrast rather than a single flat light. Add a subtle vignette."*
 *
 * All three are ALREADY IN THE TREE, which is the finding this tool exists to make
 * checkable rather than assertable:
 *
 *   AO        `StageOptions.ao` builds an `SSAOEffect` — default false, and additionally
 *             gated on `tier.smaa`, which is true on `high` ONLY. Uri's iPhone 15 Pro
 *             resolves `low` (`detectTier`: touch + short edge <= 500), so the pass is
 *             unreachable on his device even with the flag flipped.
 *   WARM/COOL `lighting.ts` ships FIVE lights: a warm key (0xfff4de), a cool front fill
 *             (0xeef4ff), a cool rim (0xaddcff), a hemisphere with a cool sky and a warm
 *             ground, and a white ambient at 0.025.
 *   VIGNETTE  `buildPost` ships a `VignetteEffect { offset: 0.42, darkness: 0.20 }`.
 *
 * So the question is never "is it configured" — it is **"does the knob reach the frame"**,
 * which in this repo is a different question with a different answer at least twice over:
 * `key.shadow.radius` was inert for its entire life under `PCFSoftShadowMap` (`f77a9d7`),
 * and the SSAO pass ran in every render this project ever made contributing EXACTLY
 * 0.0000/255 because `worldProximityThreshold` rejected every tap (`stage.ts`).
 *
 * ── WHAT IT MEASURES ────────────────────────────────────────────────────────────────
 *
 *   radial      Mean luma binned by radius in **UV space** — `sqrt((u-.5)^2+(v-.5)^2)/0.7071`,
 *               not pixel space. That is the space the vignette shader itself works in, so
 *               the measured profile is directly comparable to the analytic one, and it is
 *               aspect-independent so a 16:9 frame and a 21:9 plate are on one axis.
 *   temp        Mean (R-B) in display-encoded 0-255, per luma decile. Warm/cool CONTRAST is
 *               a correlation, not a colour: a rig with a warm key and a cool fill puts the
 *               lit deciles warmer than the shaded ones. `tempSpread` = top decile minus
 *               bottom decile. One flat white light scores ~0 by construction.
 *   ablate      Every light and every post effect, removed one at a time by INTENSITY or by
 *               BLEND OPACITY, never by blend FUNCTION (`docs/LESSONS.md` §12: `SKIP` is 9
 *               and `0` is `ADD`, so the documented recipe once ADDED an effect and called
 *               it removed). Each ablation is RESTORED and the restore is asserted
 *               bit-identical to the baseline, so a knob that cannot be put back cannot
 *               silently contaminate the next row.
 *
 * ── THE INSTRUMENT VALIDATION, WHICH COMES FIRST (CLAUDE.md rule 6) ─────────────────
 *
 * The shipped vignette has a CLOSED FORM. `postprocessing` 6.39.4's default technique is
 *
 *     d = distance(uv, vec2(0.5));
 *     color *= smoothstep(0.8, offset * 0.799, d * (darkness + offset));
 *
 * and GLSL's `smoothstep` with `edge0 > edge1` runs DESCENDING, so at offset 0.42 /
 * darkness 0.20 the multiplier is exactly 1.0 everywhere inside UV radius 0.5412 and falls
 * to 0.8746 at the extreme corner. `--selftest` §V asserts the measured-ratio pipeline
 * reproduces that curve from a synthetic frame, and §V-bad asserts it FAILS on a frame
 * built with the WRONG offset — a check that cannot pass vacuously.
 *
 * Every filtered set is asserted NON-EMPTY before anything is asserted over it
 * (`[].every()` is `true`, and that class fired three times in one session here), and the
 * live capture asserts the SUBJECT IS IN FRAME rather than photographing the sky.
 *
 * ── USE ────────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/lc_probe.mjs --selftest                      # no browser, no server
 *   node tools/tmp/lc_probe.mjs --mode plate                    # reference/, no server
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-lc -- \
 *     node tools/tmp/lc_probe.mjs --mode frame --url '{URL}' --out tools/tmp/lc_out
 *   ... --mode cost      # draw calls / triangles, N fighters x tier x {ship,+AO,-vignette}
 *
 * ⚠️ `renderer.info` resets at the START of every `renderer.render()`, and a composer calls
 * that once per PASS — so anything read after a composed frame is the LAST pass, not the
 * frame. `autoReset` is set false here and the counters reset explicitly.
 * ⚠️ Camera shake re-randomises on every `render()` even at dt=0, so it is forced to zero
 * before anything is read; CSS animations run on the document timeline and are paused.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// PURE MATH — one source, run BOTH by `--selftest` and inside the page.
// `haloprobe.mjs`'s rule: a selftest proves nothing unless it exercises the code
// the live capture runs.
// ─────────────────────────────────────────────────────────────────────────────
const MATH_SRC = String.raw`
/** Rec.709 luma of display-encoded bytes, 0..1. */
function lcLuma(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

/**
 * Mean luma per UV-radius bin. Radius is normalised by the UV half-diagonal
 * (0.70710678), so bin edge 1.0 is the exact corner at ANY aspect ratio — which is the
 * space postprocessing's vignette shader works in.
 * 'flipY' is true for a gl.readPixels buffer (bottom-up) and false for a PNG.
 */
function lcRadial(px, W, H, bins, flipY) {
  const sum = new Float64Array(bins), n = new Float64Array(bins);
  const sumT = new Float64Array(bins);
  for (let y = 0; y < H; y++) {
    // ⚠️ The +0.5 pixel centre belongs on BOTH branches. Written without it on the flipped
    // one, this was off by half a pixel — a 0.5/H shift of the whole radius field, which is
    // invisible on a symmetric test image and biases every live (bottom-up) capture. Caught
    // by §R4b, whose whole job is to be the control for the flag §R4 exercises.
    const v = (flipY ? (H - 0.5 - y) : y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const u = (x + 0.5) / W;
      const d = Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5)) / 0.7071067811865476;
      let b = Math.floor(d * bins);
      if (b >= bins) b = bins - 1;
      sum[b] += lcLuma(px[i], px[i + 1], px[i + 2]);
      sumT[b] += px[i] - px[i + 2];
      n[b]++;
    }
  }
  const out = [];
  for (let b = 0; b < bins; b++) {
    out.push({ r: (b + 0.5) / bins, mean: n[b] ? sum[b] / n[b] : null, temp: n[b] ? sumT[b] / n[b] : null, n: n[b] });
  }
  return out;
}

/**
 * Mean (R-B) per luma decile. WARM/COOL CONTRAST is a correlation between value and
 * temperature, so this is the statistic and a single number cannot be.
 */
function lcTemp(px, W, H, q) {
  const N = W * H;
  const L = new Float64Array(N), T = new Float64Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    L[p] = lcLuma(px[i], px[i + 1], px[i + 2]);
    T[p] = px[i] - px[i + 2];
  }
  const idx = Array.from({ length: N }, (_, k) => k).sort((a, b) => L[a] - L[b]);
  const rows = [];
  for (let k = 0; k < q; k++) {
    const lo = Math.floor(k * N / q), hi = Math.floor((k + 1) * N / q);
    let sl = 0, st = 0;
    for (let j = lo; j < hi; j++) { sl += L[idx[j]]; st += T[idx[j]]; }
    const c = hi - lo;
    rows.push({ q: k, n: c, luma: c ? sl / c : null, temp: c ? st / c : null });
  }
  return rows;
}

/** mean |dRGB|, max, and % of pixels moving more than 2/255. */
function lcDiff(A, B) {
  let sum = 0, max = 0, changed = 0;
  const N = A.length / 4;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    sum += d; if (d > max) max = d; if (d > 2) changed++;
  }
  return { mean: sum / N, max, pct: 100 * changed / N };
}

/**
 * The shipped vignette's CLOSED FORM, for validation. postprocessing 6.39.4
 * VignetteTechnique.DEFAULT, and GLSL smoothstep(edge0, edge1, x) with edge0 > edge1
 * runs descending: t = clamp((x - edge0) / (edge1 - edge0), 0, 1); t*t*(3-2t).
 */
function lcVignetteAt(rNorm, offset, darkness) {
  const d = rNorm * 0.7071067811865476;
  const x = d * (darkness + offset);
  const e0 = 0.8, e1 = offset * 0.799;
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
`;
// eslint-disable-next-line no-new-func
const M = new Function(`${MATH_SRC}; return { lcLuma, lcRadial, lcTemp, lcDiff, lcVignetteAt };`)();

const RADIAL_BINS = 20;
const DECILES = 10;

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   - ${name}`); }
    else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
  };
  const mk = (W, H, fn) => {
    const px = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * W + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
    return px;
  };

  console.log('\n§R — the radial binner');
  {
    const W = 320, H = 180;
    const flat = mk(W, H, () => [128, 128, 128]);
    const rad = M.lcRadial(flat, W, H, RADIAL_BINS, false);
    ok('R1  every bin is NON-EMPTY on a 320x180 frame (an empty bin makes every arm below vacuous)',
      rad.every((b) => b.n > 0), rad.map((b) => b.n).join(','));
    const target = M.lcLuma(128, 128, 128);
    ok('R2  a flat frame reads the same luma in every bin',
      rad.every((b) => Math.abs(b.mean - target) < 1e-9));
    ok('R3  KNOWN-BAD  a frame darkened ONLY in the corners does NOT read flat',
      (() => {
        const g = mk(W, H, (x, y) => {
          const u = (x + 0.5) / W, v = (y + 0.5) / H;
          const d = Math.hypot(u - 0.5, v - 0.5) / 0.7071067811865476;
          const k = d > 0.8 ? 0.5 : 1;
          return [128 * k, 128 * k, 128 * k];
        });
        const r = M.lcRadial(g, W, H, RADIAL_BINS, false);
        return r[RADIAL_BINS - 1].mean < 0.75 * r[0].mean;
      })());
    // ── flipY, and what it is honestly worth here ──────────────────────────────
    // A `gl.readPixels` buffer is BOTTOM-UP and a PNG is top-down, so the flag exists and
    // is passed correctly. But BOTH statistics this tool computes are invariant under it —
    // `lcRadial` bins on radius from the centre, which is symmetric about v = 0.5, and
    // `lcTemp` sorts pixels and never looks at position at all. So the flag is a
    // DOCUMENTED NO-OP for everything measured today, and saying so is worth more than a
    // test that pretends otherwise. It is asserted rather than assumed, on a deliberately
    // ASYMMETRIC image, so that anyone who later adds a masked or per-region statistic
    // finds this arm going red instead of inheriting a flag they think already works.
    const topHalf = mk(W, H, (x, y) => (y < H / 2 ? [200, 200, 200] : [40, 40, 40]));
    const a = M.lcRadial(topHalf, W, H, 4, false), b = M.lcRadial(topHalf, W, H, 4, true);
    ok('R4  flipY is a no-op for lcRadial even on a vertically ASYMMETRIC frame — radius binning '
      + 'is symmetric about v=0.5. (Not a tautology: an off-by-half-pixel in ONE branch breaks it, '
      + 'and did.)',
      a.every((row, i) => Math.abs(row.mean - b[i].mean) < 1e-9),
      a.map((r, i) => (r.mean - b[i].mean).toExponential(2)).join(' '));
    ok('R4b KNOWN-BAD  a HALF-PIXEL shift of the v coordinate IS detected by that same comparison, '
      + 'so R4 is measuring something',
      (() => {
        const shifted = M.lcRadial(topHalf, W, H, 4, false).map((r) => r.mean);
        // reproduce the bug: v = (H-1-y)/H instead of (H-0.5-y)/H
        const sum = new Float64Array(4), n = new Float64Array(4);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const v = (H - 1 - y) / H, u = (x + 0.5) / W;
          const d = Math.hypot(u - 0.5, v - 0.5) / 0.7071067811865476;
          let bi = Math.floor(d * 4); if (bi >= 4) bi = 3;
          const i = (y * W + x) * 4;
          sum[bi] += M.lcLuma(topHalf[i], topHalf[i + 1], topHalf[i + 2]); n[bi]++;
        }
        return shifted.some((m, i) => Math.abs(m - sum[i] / n[i]) > 1e-9);
      })());
  }

  console.log('\n§V — the vignette closed form, and the measured-ratio pipeline that has to reproduce it');
  {
    const OFF = 0.42, DARK = 0.20;
    ok('V1  the shipped vignette is EXACTLY 1.0 at the centre',
      Math.abs(M.lcVignetteAt(0, OFF, DARK) - 1) < 1e-12);
    const corner = M.lcVignetteAt(1, OFF, DARK);
    ok('V2  and 0.8746 at the extreme corner (12.5% darkening, and no more)',
      Math.abs(corner - 0.874554) < 1e-4, `got ${corner.toFixed(6)}`);
    // Where it first bites: x > offset*0.799 => d > 0.33558/0.62 => rNorm > 0.76545
    const onset = 0.42 * 0.799 / (0.20 + 0.42) / 0.7071067811865476;
    ok('V3  it is IDENTITY inside UV radius 0.7654 — i.e. it only ever touches the corners',
      Math.abs(M.lcVignetteAt(onset - 1e-6, OFF, DARK) - 1) < 1e-9 && onset > 0.76 && onset < 0.77,
      `onset rNorm ${onset.toFixed(5)}`);
    // The pipeline: build a flat frame, apply the closed form, and recover the curve as a
    // per-bin RATIO — which is exactly what --mode frame does against the ablated arm.
    const W = 400, H = 240;
    const base = mk(W, H, () => [160, 160, 160]);
    const vig = mk(W, H, (x, y) => {
      const u = (x + 0.5) / W, v = (y + 0.5) / H;
      const d = Math.hypot(u - 0.5, v - 0.5) / 0.7071067811865476;
      const k = M.lcVignetteAt(d, OFF, DARK);
      return [160 * k, 160 * k, 160 * k];
    });
    const rb = M.lcRadial(base, W, H, RADIAL_BINS, false);
    const rv = M.lcRadial(vig, W, H, RADIAL_BINS, false);
    const ratio = rv.map((b, i) => b.mean / rb[i].mean);
    const predicted = rv.map((_, i) => M.lcVignetteAt((i + 0.5) / RADIAL_BINS, OFF, DARK));
    const err = ratio.map((r, i) => Math.abs(r - predicted[i]));
    ok('V4  the measured ratio reproduces the closed form to < 0.01 in every bin',
      err.every((e) => e < 0.01), `max err ${Math.max(...err).toFixed(5)}`);
    ok('V5  KNOWN-BAD  a frame built with offset 0.70 is REJECTED by the SAME comparison',
      (() => {
        const wrong = mk(W, H, (x, y) => {
          const u = (x + 0.5) / W, v = (y + 0.5) / H;
          const d = Math.hypot(u - 0.5, v - 0.5) / 0.7071067811865476;
          const k = M.lcVignetteAt(d, 0.70, DARK);
          return [160 * k, 160 * k, 160 * k];
        });
        const rw = M.lcRadial(wrong, W, H, RADIAL_BINS, false);
        return rw.some((b, i) => Math.abs(b.mean / rb[i].mean - predicted[i]) > 0.01);
      })());
  }

  console.log('\n§T — the warm/cool statistic');
  {
    const W = 240, H = 160;
    // One flat white light: value varies, temperature does not. tempSpread must be ~0.
    const grey = mk(W, H, (x) => { const l = 30 + Math.round(190 * x / W); return [l, l, l]; });
    const gt = M.lcTemp(grey, W, H, DECILES);
    ok('T1  every decile is NON-EMPTY', gt.every((r) => r.n > 0), gt.map((r) => r.n).join(','));
    ok('T2  deciles are ordered by luma (else "top decile" names nothing)',
      gt.every((r, i) => i === 0 || r.luma >= gt[i - 1].luma));
    const spreadGrey = gt[DECILES - 1].temp - gt[0].temp;
    ok('T3  a single WHITE light scores tempSpread ~0 — the null this whole metric exists against',
      Math.abs(spreadGrey) < 0.51, `got ${spreadGrey.toFixed(4)}`);
    // A warm key + cool shadow: lit pixels warm, dark pixels cool.
    const wc = mk(W, H, (x) => {
      const t = x / W;
      return t > 0.5 ? [220, 205, 175] : [60, 72, 96];
    });
    const wt = M.lcTemp(wc, W, H, DECILES);
    const spreadWC = wt[DECILES - 1].temp - wt[0].temp;
    ok('T4  a warm key over a cool shade scores strongly POSITIVE',
      spreadWC > 60, `got ${spreadWC.toFixed(2)}`);
    ok('T5  KNOWN-BAD  the SAME frame with the two temperatures swapped scores NEGATIVE '
      + '(so the sign is real and not an artefact of the ordering)',
      (() => {
        const sw = mk(W, H, (x) => {
          const t = x / W;
          return t > 0.5 ? [175, 205, 220] : [96, 72, 60];
        });
        const st = M.lcTemp(sw, W, H, DECILES);
        return (st[DECILES - 1].temp - st[0].temp) < -60;
      })());
  }

  console.log('\n§D — the differ');
  {
    const W = 64, H = 64;
    const a = mk(W, H, () => [100, 100, 100]);
    const b = mk(W, H, () => [100, 100, 100]);
    const d0 = M.lcDiff(a, b);
    ok('D1  identical buffers diff to EXACTLY zero (this is the drift control the capture runs)',
      d0.mean === 0 && d0.max === 0 && d0.pct === 0);
    const c = mk(W, H, (x, y) => (y < 1 ? [100, 100, 103] : [100, 100, 100]));
    const d1 = M.lcDiff(a, c);
    ok('D2  KNOWN-BAD  a ONE-ROW, 3/255 change is NOT reported as zero',
      d1.max === 3 && d1.pct > 0, JSON.stringify(d1));
  }

  console.log(`\n${fail ? '🔴 FAIL' : '✅ PASS'}  lc_probe selftest: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE-SIDE CAPTURE
// ─────────────────────────────────────────────────────────────────────────────
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

async function newPage(browser, W, H, mobile) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: mobile ? 2 : 1,
    hasTouch: !!mobile, isMobile: !!mobile,
  });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  return page;
}

/** Freeze everything that moves, then prove it is frozen. */
async function freeze(page) {
  await page.evaluate(() => {
    // CSS animations run on the document timeline, NOT rAF — freezing rAF does not still
    // them, and `locator('canvas').screenshot()` is a page capture clipped to the canvas.
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* ignore */ } }
    window.__lcRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const st = window.__stage;
    // Camera shake re-randomises on EVERY render() even at dt = 0.
    try { st.rig.shakeAmount = 0; st.rig.shakeOffset.set(0, 0, 0); st.rig.apply(); } catch { /* older rig */ }
  });
}

/** The in-page harness. Everything below runs with the tree's own objects in hand. */
const PAGE_SRC = `${MATH_SRC}
window.__lc = (() => {
  const st = window.__stage;
  if (!st) throw new Error('no Stage on this route');
  if (st.disposed) throw new Error('window.__stage is a DISPOSED Stage');
  const gl = st.renderer.getContext();
  const cv = st.renderer.domElement;
  const W = cv.width, H = cv.height;
  st.renderer.info.autoReset = false;
  const read = () => {
    const p = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p);
    return p;
  };
  const shot = () => { st.renderer.info.reset(); st.render(1 / 60); return read(); };
  const counts = () => {
    st.renderer.info.reset(); st.render(1 / 60);
    const r = st.renderer.info.render;
    return { draws: r.calls, tris: r.triangles, lines: r.lines, points: r.points,
             programs: st.renderer.info.programs ? st.renderer.info.programs.length : null,
             geometries: st.renderer.info.memory.geometries, textures: st.renderer.info.memory.textures };
  };
  const fx = () => (st.composer ? st.composer.passes.flatMap((p) => p.effects || []) : []);
  const find = (re) => fx().find((e) => re.test(e.name)) || null;
  return { st, W, H, read, shot, counts, fx, find, L: () => st.lighting };
})();
`;

async function bootMatch(page, base, { tier, fighters, px, py, fog, player = 'hamburger', enemy = 'donut' }) {
  const q = new URLSearchParams();
  if (fighters) q.set('fighters', fighters);
  else { q.set('player', player); q.set('enemy', enemy); }
  if (px !== undefined) { q.set('px', String(px)); q.set('py', String(py)); }
  q.set('fogRadius', String(fog));
  q.set('simSpeed', '0.01');
  q.set('pointerLock', '0');
  if (tier) q.set('tier', tier);
  const url = `${base}/?${q.toString()}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90_000 });
  await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'",
    null, { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(700);
  await freeze(page);
  await page.evaluate(PAGE_SRC);
  return url;
}

/**
 * DRIFT CONTROL (CLAUDE.md rule 4). Two identical renders must be bit-identical, or
 * every ablation below is measuring the renderer's own noise floor.
 */
async function driftControl(page, label) {
  const d = await page.evaluate(() => {
    const A = window.__lc.shot();
    const B = window.__lc.shot();
    return lcDiff(A, B);
  });
  const okd = d.mean === 0 && d.max === 0;
  console.log(`  drift control [${label}] : mean ${d.mean.toFixed(6)}  max ${d.max}  pct ${d.pct.toFixed(4)}%`
    + `  ${okd ? '✅ EXACTLY ZERO' : '🔴 DRIFTS — nothing below is trustworthy'}`);
  return okd;
}

/** Is the subject actually in frame? A probe that photographs the sky reports PASS. */
async function subjectInFrame(page) {
  return page.evaluate(() => {
    const st = window.__lc.st;
    const THREEV = st.rig.camera;
    let found = null;
    st.scene.traverse((o) => {
      if (found) return;
      if (o.userData && o.userData.fighterSlot === 0) found = o;
      else if (!found && /^fighter/i.test(o.name || '')) found = o;
    });
    // Fall back to the contact decals: there is exactly one per living fighter, and they
    // sit at the fighter's feet, which is the point this whole probe is about.
    const decals = [];
    st.scene.traverse((o) => { if ((o.name || '') === 'contact:decal' && o.visible) decals.push(o); });
    const project = (obj) => {
      const v = obj.getWorldPosition(new (obj.position.constructor)());
      v.project(THREEV);
      return { x: (v.x * 0.5 + 0.5), y: (v.y * 0.5 + 0.5), z: v.z };
    };
    const pts = (found ? [found] : decals).map(project);
    return {
      names: decals.length, usedFallback: !found,
      pts, inFrame: pts.filter((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1 && p.z < 1).length,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MODES
// ─────────────────────────────────────────────────────────────────────────────
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const BASE = (get('--url', null) ?? process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = get('--out', 'tools/tmp/lc_out');
const MODE = get('--mode', 'frame');

// Stations: derived from the SHIPPED arena dump, never retyped. `tools/arena.gameplay.json`
// is regenerated from `src/arena/**`, and `al_guard` asserts it agrees with `shared.ts` on
// ARENA_W/H — so a coordinate taken from it cannot be a stale 1x literal.
async function stations() {
  const dump = JSON.parse(await readFile(new URL('../arena.gameplay.json', import.meta.url), 'utf8'));
  const fog = Math.ceil(dump.maxSafeRadius) + 1;   // fog fully open; NOT the retired 1985
  const spawns = dump.spawns;
  if (!Array.isArray(spawns) || spawns.length < 3) throw new Error('arena dump has no spawn list');
  return {
    fog,
    dump,
    list: [
      { id: 'spawn_sw', x: spawns[0].x, y: spawns[0].y },
      { id: 'spawn_ne', x: spawns[2].x, y: spawns[2].y },
      { id: 'hub', x: spawns[4].x, y: spawns[4].y },
    ],
  };
}

async function modeFrame() {
  const { fog, list } = await stations();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report = { mode: 'frame', base: BASE, fog, at: new Date().toISOString(), stations: [] };
  try {
    for (const st of list) {
      const page = await newPage(browser, 1300, 740, false);
      const url = await bootMatch(page, BASE, { px: st.x, py: st.y, fog });
      console.log(`\n━━━ ${st.id} (${st.x},${st.y}) ━━━ ${url}`);
      const drift = await driftControl(page, st.id);
      const subj = await subjectInFrame(page);
      console.log(`  subject: ${subj.inFrame} of ${subj.pts.length} anchor(s) in frame`
        + ` (contact decals in scene: ${subj.names}${subj.usedFallback ? ', decal fallback' : ''})`);
      if (subj.inFrame < 1) console.log('  🔴 NO SUBJECT IN FRAME — this station is photographing the sky');

      const res = await page.evaluate(({ bins, q }) => {
        const lc = window.__lc;
        const L = lc.L();
        const vign = lc.find(/Vignette/);
        const bloom = lc.find(/Bloom/);
        const ssao = lc.find(/SSAO/);
        const grade = lc.find(/Grade|HueSat|Brightness/);

        const A = lc.shot();
        const base = {
          radial: lcRadial(A, lc.W, lc.H, bins, true),
          temp: lcTemp(A, lc.W, lc.H, q),
          counts: lc.counts(),
        };

        const rows = [];
        // 🚨 KNOWN-BAD ROWS RUN LAST. The magenta arms touch a SHARED material and a
        // shader recompile; run in the middle they left the restored frame 1/255 from
        // baseline and every subsequent row inherited it (the vignette row moved
        // 0.2360 -> 0.2384 and reported a restore drift). A known-bad that contaminates
        // the measurements after it is not free.
        const deferred = [];
        const run = (name, apply, undo, extra) => {
          apply();
          const B = lc.shot();
          const d = lcDiff(A, B);
          const rad = lcRadial(B, lc.W, lc.H, bins, true);
          const tmp = lcTemp(B, lc.W, lc.H, q);
          undo();
          const R = lc.shot();
          const restore = lcDiff(A, R);
          rows.push({ name, ...d, radial: rad, temp: tmp,
            restoredExactly: restore.mean === 0 && restore.max === 0,
            restoreMax: restore.max, ...(extra || {}) });
        };

        // ── LIGHTS, by intensity. Each is asserted restorable. ──
        for (const [name, obj] of [['key', L.key], ['front', L.front], ['rim', L.rim],
          ['hemisphere fill', L.fill], ['ambient', L.ambient]]) {
          if (!obj) { rows.push({ name, missing: true }); continue; }
          const was = obj.intensity;
          run(name, () => { obj.intensity = 0; }, () => { obj.intensity = was; },
            { intensity: was, colour: '#' + obj.color.getHexString() });
        }
        // The hemisphere's two ends, reported because "warm/cool" is what they ARE.
        const hemi = L.fill ? { sky: '#' + L.fill.color.getHexString(), ground: '#' + L.fill.groundColor.getHexString() } : null;

        // ── THE CAST SHADOW, by shadow.intensity (three >= r165). NOT by
        //    `castShadow=false` or `shadowMap.enabled=false`: both need a material
        //    RECOMPILE, so a live frame keeps sampling the map already bound to it and
        //    reports 0.0000/255 — `quality.ts` records exactly that trap. ──
        if (L.key && L.key.shadow && typeof L.key.shadow.intensity === 'number') {
          const was = L.key.shadow.intensity;
          run('cast shadow (shadow.intensity 0)', () => { L.key.shadow.intensity = 0; },
            () => { L.key.shadow.intensity = was; }, { intensity: was });
        } else rows.push({ name: 'cast shadow (shadow.intensity 0)', missing: true });

        // ── shadow.radius — the knob that was INERT for its whole life under
        //    PCFSoftShadowMap. Does it reach the frame TODAY? ──
        if (L.key && L.key.shadow) {
          const was = L.key.shadow.radius;
          run(`shadow.radius ${was.toFixed(2)} -> 1`, () => { L.key.shadow.radius = 1; },
            () => { L.key.shadow.radius = was; }, { intensity: was });
          run(`shadow.radius ${was.toFixed(2)} -> 4`, () => { L.key.shadow.radius = 4; },
            () => { L.key.shadow.radius = was; }, { intensity: was });
        }

        // ── THE PER-FIGHTER CONTACT DECALS — the cheap AO that already ships ──────
        //
        // 🚨 `visible = false` IS NOT AN ABLATION HERE, AND IT RETURNS A CLEAN ZERO.
        // `Stage.render()` calls `updateContactShadows()` BEFORE it draws, and that
        // method sets `decal.visible = true` on every live fighter every frame. So
        // `apply(); shot()` puts the flag back before the draw and reports mean
        // 0.0000/255 over 0.00% of pixels — which reads exactly like "this layer is
        // invisible", the single most-repeated wrong conclusion in this repo. It was
        // measured that way first, and this comment is the record.
        //
        // The material is what survives a frame. The decal blends
        // `out = 0*src + dst*src`, so a WHITE source is an exact identity: dropping
        // `map` leaves `color` (white) and the multiply becomes a no-op that
        // `updateContactShadows` has no opinion about.
        const decals = [];
        lc.st.scene.traverse((o) => { if ((o.name || '') === 'contact:decal') decals.push(o); });
        const dmat = decals.length ? decals[0].material : null;
        if (dmat) {
          const wasMap = dmat.map;
          run(`contact decals (${decals.length}, map->null)`,
            () => { dmat.map = null; dmat.needsUpdate = true; },
            () => { dmat.map = wasMap; dmat.needsUpdate = true; }, { count: decals.length });
          // KNOWN-BAD (AGENT-BRIEF §4.2): make it unmissable and REQUIRE the frame to
          // move. A layer that does not move the frame when painted magenta at 3x is
          // not being drawn, and no "it is subtle" reading of the row above survives.
          const wasCol = dmat.color.getHex();
          const scales = decals.map((d) => d.scale.x);
          deferred.push(() => run('KNOWN-BAD decals magenta @3x (frame MUST move)',
            () => { dmat.color.setHex(0xff00ff); for (const d of decals) d.scale.set(d.scale.x * 3, 1, d.scale.z * 3); },
            () => { dmat.color.setHex(wasCol); decals.forEach((d, i) => d.scale.set(scales[i], 1, scales[i])); },
            { count: decals.length, knownBad: true }));
        } else rows.push({ name: 'contact decals', missing: true, count: 0 });

        // ── THE ARENA'S OWN BAKED CONTACT RINGS — static geometry, so `visible`
        //    DOES stick here. `stage.ts` records these at mean 2.25/255 over 8.5%. ──
        // ⚠️ MATCHED BY SUBSTRING, NOT EQUALITY. `addCover` renames its ring
        // `props:contact_shadow__no_outline:<id>`, so an exact-name filter collected 9
        // meshes and MISSED the two that were actually on screen — the `visible=false`
        // arm read 0.0000 while the magenta known-bad on the SHARED MATERIAL moved
        // 2.35% of pixels. The filtered set was the wrong set, not an empty one, which
        // is the harder half of the same failure.
        const rings = [];
        lc.st.scene.traverse((o) => { if (/contact_shadow__no_outline/.test(o.name || '')) rings.push(o); });
        // 🚨 IN FRAME? A zero from an ablation of geometry that is off camera is a
        // property of the STATION, not of the layer, and reads identically to
        // "this layer is invisible". Counted before it is asserted over.
        // ⚠️ *IT IS A LOWER BOUND. The test is "is any of the eight bbox corners inside
        // NDC", which is FALSE for any quad LARGER than the viewport — and a ground
        // decal under a big prop routinely is. Measured: this reported 0 of 11 rings in
        // frame while hiding them moved 1.96% of pixels. The ABLATION is the evidence
        // that something was on screen; this count is a hint and is labelled as one.
        const cam = lc.st.rig.camera;
        // ⚠️ THE ORIGIN IS NOT THE OBJECT. Testing `getWorldPosition` alone reported
        // `0 in frame` for a set whose geometry demonstrably reached the screen. The
        // eight bounding-box corners are the honest test.
        const V3 = lc.st.rig.camera.position.constructor;
        const inFrame = (o) => {
          if (!o.geometry) return false;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          o.updateWorldMatrix(true, false);
          for (let k = 0; k < 8; k++) {
            const v = new V3(
              k & 1 ? bb.max.x : bb.min.x,
              k & 2 ? bb.max.y : bb.min.y,
              k & 4 ? bb.max.z : bb.min.z);
            v.applyMatrix4(o.matrixWorld).project(cam);
            if (v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1) return true;
          }
          return false;
        };
        const ringsIn = rings.filter(inFrame);
        if (rings.length) {
          run(`arena baked rings (${rings.length}, ${ringsIn.length} corner-in-frame*)`,
            () => { for (const r of rings) r.visible = false; },
            () => { for (const r of rings) r.visible = true; }, { count: rings.length, inFrame: ringsIn.length });
          // KNOWN-BAD, on the SAME set: if painting them unmissable does not move the
          // frame either, the ablation above proved nothing about the layer.
          const ringMats = [...new Set(rings.map((r) => r.material))];
          const wasCols = ringMats.map((m) => (m.color ? m.color.getHex() : null));
          deferred.push(() => run(`KNOWN-BAD rings magenta (frame MUST move if any is drawn)`,
            () => { for (const m of ringMats) if (m.color) m.color.setHex(0xff00ff); },
            () => { ringMats.forEach((m, i) => { if (m.color && wasCols[i] !== null) m.color.setHex(wasCols[i]); }); },
            { count: rings.length, knownBad: true, materials: ringMats.length }));
        } else rows.push({ name: 'arena baked contact rings', missing: true, count: 0 });

        // Census of every name that could be a grounding layer, so a zero above can be
        // read against what actually exists rather than against an assumption.
        const census = {};
        lc.st.scene.traverse((o) => {
          if (!o.isMesh) return;
          const n = o.name || '(unnamed)';
          if (!/contact|shadow|decal|occl|\bao\b/i.test(n)) return;
          census[n] = census[n] || { total: 0, visible: 0, inFrame: 0 };
          census[n].total++;
          if (o.visible) census[n].visible++;
          if (inFrame(o)) census[n].inFrame++;
        });

        // ── POST EFFECTS, by BLEND OPACITY, never by blend FUNCTION (LESSONS §12). ──
        //
        // 🚨 AND AN OPACITY ABLATION IS ONLY VALID FOR A BLEND THAT CONSUMES OPACITY.
        // `BlendFunction.SRC` (30) is literally `return src;` in postprocessing 6.39.4
        // — the `opacity` argument is declared and never read. `ToyGradeEffect` and
        // `SMAAEffect` are both on SRC, so setting their opacity to 0 is a GUARANTEED
        // no-op that reports mean 0.0000 and reads as "this effect does nothing". The
        // grade is worth ~19/255 over 99.99% of the frame by `stage.ts`'s own
        // ablation. This is the same family as `SKIP is 9, 0 is ADD` (LESSONS §12) and
        // it is a SECOND way for the same recipe to lie.
        const OPACITY_BLIND = new Set([30]);   // SRC. Add any other that ignores opacity.
        for (const [name, e] of [['vignette', vign], ['bloom', bloom], ['ssao', ssao], ['grade', grade]]) {
          if (!e) { rows.push({ name, missing: true }); continue; }
          const bf = e.blendMode.blendFunction;
          if (OPACITY_BLIND.has(bf)) {
            rows.push({ name, notAblatable: `blendFunction ${bf} (SRC) ignores opacity — an opacity ablation here is a guaranteed false zero` });
            continue;
          }
          const was = e.blendMode.opacity.value;
          run(name, () => { e.blendMode.opacity.value = 0; },
            () => { e.blendMode.opacity.value = was; }, { opacity: was, blendFunction: bf });
        }

        for (const f of deferred) f();

        return {
          base, rows, hemi, census,
          renderTier: window.__renderTier,
          W: lc.W, H: lc.H,
          effects: lc.fx().map((e) => `${e.name}(blend ${e.blendMode.blendFunction}, opacity ${e.blendMode.opacity.value})`),
          passes: lc.st.composer ? lc.st.composer.passes.map((p) => p.constructor.name) : [],
          vignetteCfg: vign ? { offset: vign.uniforms.get('offset').value, darkness: vign.uniforms.get('darkness').value } : null,
          shadowMapType: lc.st.renderer.shadowMap.type,
          shadowRadius: lc.L().key ? lc.L().key.shadow.radius : null,
        };
      }, { bins: RADIAL_BINS, q: DECILES });

      // PNG for rule 3 — the numbers are not the judgement.
      await page.screenshot({ path: `${OUT}/${st.id}_58.png` });

      report.stations.push({ ...st, url, drift, subject: subj, ...res });
      printStation(st.id, res);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${OUT}/frame.json`, JSON.stringify(report, null, 1));
  console.log(`\nwrote ${OUT}/frame.json`);
  return report;
}

function printStation(id, res) {
  console.log(`  tier=${res.renderTier}  ${res.W}x${res.H}  shadowMap.type=${res.shadowMapType}  key.shadow.radius=${(res.shadowRadius ?? NaN).toFixed(3)}`);
  console.log(`  passes:  ${res.passes.join(' -> ')}`);
  console.log(`  effects: ${res.effects.join(' | ')}`);
  if (res.vignetteCfg) console.log(`  vignette cfg: offset ${res.vignetteCfg.offset}  darkness ${res.vignetteCfg.darkness}`);
  if (res.hemi) console.log(`  hemisphere: sky ${res.hemi.sky}  ground ${res.hemi.ground}`);
  if (res.census) {
    const ks = Object.keys(res.census).sort();
    console.log(`  grounding-layer census (name: total/visible/inFrame):`);
    if (!ks.length) console.log('    🔴 NOTHING MATCHED — every grounding row below would be vacuous');
    for (const k of ks) console.log(`    ${k.padEnd(34)} ${res.census[k].total}/${res.census[k].visible}/${res.census[k].inFrame}`);
  }
  const t = res.base.temp;
  console.log(`\n  WARM/COOL — mean (R-B) per luma decile, display-encoded 0-255:`);
  console.log('    ' + t.map((r) => `${r.luma.toFixed(2)}:${r.temp >= 0 ? '+' : ''}${r.temp.toFixed(1)}`).join('  '));
  console.log(`    tempSpread (top decile - bottom decile) = ${(t[t.length - 1].temp - t[0].temp).toFixed(2)}`);
  const rad = res.base.radial;
  console.log(`\n  RADIAL luma by UV radius (corner = 1.0):`);
  console.log('    ' + rad.filter((_, i) => i % 2 === 1).map((b) => `${b.r.toFixed(2)}:${b.mean.toFixed(3)}`).join('  '));
  console.log(`\n  ABLATIONS  (mean/255 · max · %px>2 · restored?)`);
  const vigBase = res.base.radial;
  for (const r of res.rows) {
    if (r.missing) { console.log(`    ${r.name.padEnd(30)} — ABSENT from this chain`); continue; }
    if (r.notAblatable) { console.log(`    ${r.name.padEnd(30)} — NOT ABLATABLE BY OPACITY: ${r.notAblatable}`); continue; }
    let extra = '';
    if (r.name === 'vignette') {
      // The DELIVERED profile: shipped / ablated, per radial bin. This is the number the
      // closed form is checked against.
      const ratio = vigBase.map((b, i) => b.mean / r.radial[i].mean);
      const pred = vigBase.map((_, i) => M.lcVignetteAt((i + 0.5) / RADIAL_BINS, 0.42, 0.20));
      const err = ratio.map((x, i) => Math.abs(x - pred[i]));
      extra = `\n      delivered ratio by radius: `
        + ratio.filter((_, i) => i % 2 === 1).map((x, i) => `${((i * 2 + 1.5) / RADIAL_BINS).toFixed(2)}:${x.toFixed(4)}`).join(' ')
        + `\n      closed form predicts:      `
        + pred.filter((_, i) => i % 2 === 1).map((x, i) => `${((i * 2 + 1.5) / RADIAL_BINS).toFixed(2)}:${x.toFixed(4)}`).join(' ')
        + `\n      max |measured - predicted| = ${Math.max(...err).toFixed(4)}`;
    }
    const tSelf = r.temp[r.temp.length - 1].temp - r.temp[0].temp;
    console.log(`    ${r.name.padEnd(30)} mean ${r.mean.toFixed(4)}  max ${String(r.max).padStart(3)}  ${r.pct.toFixed(2).padStart(6)}%px`
      + `  tempSpread->${tSelf.toFixed(1)}  ${r.restoredExactly ? 'restored ✅' : `🔴 RESTORE DRIFTED max ${r.restoreMax}`}${extra}`);
  }
}

// ── COST ────────────────────────────────────────────────────────────────────
async function modeCost() {
  const { fog, dump } = await stations();
  const CAST = ['hamburger', 'donut', 'hotdog', 'pizza', 'taco', 'sushi'];

  // 🚨 THE ARENA'S OWN SIX SPAWNS ARE THE WRONG ROSTER FOR A COST NUMBER, AND THE WRONG
  // ANSWER LOOKS RIGHT. They are spread over a 2800x2000 map, so at simSpeed 0.01 only
  // the player is ever inside the frustum and the other five are culled: measured
  // 2026-08-22, N=2 and N=3 on that roster came back at **313 draws / 466,520 triangles
  // BOTH** — byte-identical, which reads exactly like "fighters are free". They are not
  // free; they were off camera. A cost figure has to be the case that actually costs, so
  // the roster is a RING around the player, sized so every seat is in frame at once.
  //
  // Radius in wu. WORLD_SCALE is 0.05 m/wu and the match camera sees roughly +/-290 wu of
  // ground at 16:9, so 170 wu puts all six comfortably inside it. Points are rejected if
  // they land inside a CoverBox from the shipped dump (`sim.ts` refuses those), and the
  // ring is rotated until all five fit — derived, never a typed coordinate.
  const inCover = (x, y) => (dump.cover || []).some((b) =>
    Math.abs(x - b.x) <= b.w / 2 + 22 && Math.abs(y - b.y) <= b.h / 2 + 22);
  // Radius AND rotation are both searched: at a fixed 170 wu there is no clear 6-seat ring
  // anywhere around spawn 0 (this spawn has eight cover boxes within 400 wu), and a tool
  // that silently fell back to the spread roster would have produced the identical-count
  // artefact all over again. It throws instead.
  const ring = (n) => {
    const c = dump.spawns[0];
    for (let R = 100; R <= 280; R += 10) {
      for (let deg = 0; deg < 360; deg += 5) {
        const pts = [{ x: c.x, y: c.y }];
        let ok = true;
        for (let i = 1; i < n; i++) {
          const th = (deg + (i - 1) * 360 / (n - 1)) * Math.PI / 180;
          const x = Math.round(c.x + R * Math.cos(th)), y = Math.round(c.y + R * Math.sin(th));
          if (x < 60 || y < 60 || x > dump.width - 60 || y > dump.height - 60 || inCover(x, y)) { ok = false; break; }
          pts.push({ x, y });
        }
        if (ok) { ring.lastR = R; ring.lastDeg = deg; return pts; }
      }
    }
    throw new Error(`no clear ${n}-seat ring around the player spawn at any radius 100-280 wu`);
  };
  const roster = (n) => {
    const pts = ring(n);
    if (pts.length !== n) throw new Error(`ring returned ${pts.length} seats, wanted ${n}`);
    console.log(`  roster N=${n}: ring R=${ring.lastR} wu, rotation ${ring.lastDeg} deg, `
      + pts.map((q) => `${q.x},${q.y}`).join(' | '));
    return CAST.slice(0, n).map((id, i) => `${id}@${pts[i].x},${pts[i].y}`).join(';');
  };
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    for (const dev of [{ id: 'phone(low)', W: 844, H: 390, mobile: true, tier: null },
      { id: 'desktop(high)', W: 1300, H: 740, mobile: false, tier: null }]) {
      for (const n of [2, 3, 6]) {
        const page = await newPage(browser, dev.W, dev.H, dev.mobile);
        const opts = n === 2 ? { fog } : { fog, fighters: roster(n) };
        await bootMatch(page, BASE, opts);
        const drift = await driftControl(page, `${dev.id} N=${n}`);
        const r = await page.evaluate(() => {
          const lc = window.__lc;
          // 🚨 THE SHADOW PASS IS CONDITIONAL, AND THAT MAKES A NAIVE COUNT INCOMPARABLE
          // ACROSS ARMS. `Stage.scheduleShadowUpdate` re-renders the shadow map only when
          // a fingerprint of the frustum and every caster's matrix changes, so on a FROZEN
          // two-fighter frame nothing moves and `stage.render()` draws no shadow pass at
          // all — while a frame with fighters adjacent enough to be fighting does. Measured
          // first without this and N=2 read 313 draws against N=3's 665: a +352 step for
          // ONE fighter, which is arithmetically impossible (it exceeds the whole N=2
          // frame). Both arms are reported: `ship` is whatever that frame happened to do,
          // `shipShadow` forces the re-render so every row is the same quantity and is the
          // one a moving game frame actually pays.
          const ship = lc.counts();
          lc.st.renderer.shadowMap.needsUpdate = true;
          if (typeof lc.st.markShadowsDirty === 'function') lc.st.markShadowsDirty();
          const shipShadow = lc.counts();
          // Per-fighter mesh census, so a draw-call step can be checked against geometry
          // that actually exists rather than inferred from the step itself.
          let charRoots = 0, charMeshes = 0;
          lc.st.scene.traverse((o) => {
            if ((o.name || '').startsWith('character:')) charRoots++;
            if (o.isMesh && o.visible) charMeshes++;
          });
          const vign = lc.find(/Vignette/);
          const out = { tier: window.__renderTier, ship, shipShadow, charRoots, charMeshes, W: lc.W, H: lc.H,
            passes: lc.st.composer ? lc.st.composer.passes.map((p) => p.constructor.name) : [],
            effects: lc.fx().map((e) => e.name),
            fighters: (() => { let c = 0; lc.st.scene.traverse((o) => { if ((o.name || '') === 'contact:decal') c++; }); return c; })(),
          };
          // Vignette removal: it merges into an EffectPass that has to run anyway, so the
          // expected draw delta is ZERO and the whole cost is per-fragment ALU, which is
          // exactly what cannot be measured in this repo. Reported so the zero is on the
          // record rather than assumed.
          const dirty = () => { lc.st.renderer.shadowMap.needsUpdate = true;
            if (typeof lc.st.markShadowsDirty === 'function') lc.st.markShadowsDirty(); };
          if (vign) {
            const was = vign.blendMode.opacity.value;
            vign.blendMode.opacity.value = 0;
            dirty(); out.noVignette = lc.counts();
            vign.blendMode.opacity.value = was;
          }
          // AO: `useAO` is a runtime property (TS `private` is compile-time only) and the
          // chain gate additionally requires `tier.smaa`. Both are forced, the chain is
          // rebuilt, and the counts are read again. THE VIGNETTE/SMAA ARMS ARE HELD BY
          // MEASURING THE SMAA-FORCED ARM AS ITS OWN BASELINE, so the AO delta is AO.
          const tiers = window.__quality && window.__quality.tiers;
          const prof = tiers ? tiers[window.__renderTier] : null;
          if (prof && typeof lc.st.buildPost === 'function') {
            const wasSmaa = prof.smaa;
            prof.smaa = true;
            lc.st.useAO = false; lc.st.buildPost(false);
            dirty(); out.smaaBaseline = lc.counts();
            lc.st.useAO = true; lc.st.buildPost(false);
            dirty(); out.withAO = lc.counts();
            out.aoAttached = lc.fx().some((e) => /SSAO/.test(e.name));
            // put it back
            lc.st.useAO = false; prof.smaa = wasSmaa; lc.st.buildPost(false);
            dirty(); out.restored = lc.counts();
          }
          return out;
        });
        if (r.fighters !== n) console.log(`    🔴 ${r.fighters} contact decals for N=${n} — the roster did not seat`);
        rows.push({ device: dev.id, n, drift, ...r });
        const d = (x) => (x ? `${x.draws} draws / ${x.tris.toLocaleString()} tris` : '—');
        console.log(`\n  ${dev.id}  N=${n}  tier=${r.tier}  buffer ${r.W}x${r.H}  decals ${r.fighters}`);
        console.log(`    passes  ${r.passes.join(' -> ')}   effects ${r.effects.join(',')}`);
        console.log(`    character roots ${r.charRoots}   visible meshes in scene ${r.charMeshes}`);
        console.log(`    SHIPPED, no shadow re-render  ${d(r.ship)}   <- only what THAT frozen frame drew`);
        console.log(`    SHIPPED, shadow pass forced   ${d(r.shipShadow)}   <- the comparable quantity`);
        console.log(`    vignette ablated  ${d(r.noVignette)}`);
        if (r.smaaBaseline) {
          console.log(`    smaa forced, AO off ${d(r.smaaBaseline)}`);
          console.log(`    smaa forced, AO ON  ${d(r.withAO)}   attached=${r.aoAttached}`);
          const dd = r.withAO.draws - r.smaaBaseline.draws;
          void 0;
          const dt = r.withAO.tris - r.smaaBaseline.tris;
          console.log(`    => AO COSTS        +${dd} draws (+${(100 * dd / r.smaaBaseline.draws).toFixed(1)}%)`
            + `  +${dt.toLocaleString()} tris (+${(100 * dt / r.smaaBaseline.tris).toFixed(1)}%)`);
          console.log(`    => AO on the SHIPPED phone frame: ${r.shipShadow.draws} -> ${r.shipShadow.draws + dd} draws`);
          // Compared against `shipShadow`, not `ship`: both are forced-shadow frames, and
          // comparing a forced arm against an unforced baseline printed `false` on every
          // row of a run where the restore was in fact exact.
          console.log(`    restored to        ${d(r.restored)}   (== shipped-with-shadow? ${r.restored.draws === r.shipShadow.draws && r.restored.tris === r.shipShadow.tris})`);
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/cost.json`, JSON.stringify({ mode: 'cost', base: BASE, rows }, null, 1));
  console.log(`\nwrote ${OUT}/cost.json`);
  return rows;
}

// ── AO GATE — the negative arm ──────────────────────────────────────────────
/**
 * `buildPost` reads `if (this.useAO && !gradeOnly && tier.smaa)`, and `TIERS.low.smaa`
 * is false. So on a phone the `ao: true` flag is a NO-OP: the pass cannot attach at all.
 * That is a code read, and a code read is exactly what this project keeps being wrong
 * about — so it is measured, in BOTH directions, on the tier a phone resolves.
 */
async function modeAoGate() {
  const { fog } = await stations();
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await newPage(browser, 844, 390, true);
    await bootMatch(page, BASE, { fog });
    const r = await page.evaluate(() => {
      const lc = window.__lc;
      const tier = window.__renderTier;
      const prof = window.__quality && window.__quality.tiers ? window.__quality.tiers[tier] : null;
      const attached = () => lc.fx().some((e) => /SSAO/.test(e.name));
      const out = { tier, smaa: prof ? prof.smaa : null, bloom: prof ? prof.bloom : null };
      out.shippedAttached = attached();
      // NEGATIVE ARM: ask for AO on the tier a phone gets, change nothing else.
      lc.st.useAO = true; lc.st.buildPost(false);
      out.aoTrueOnPhoneTier = attached();
      // POSITIVE CONTROL: the ONLY other thing that changes is the smaa flag. If this
      // does not attach, the negative arm above proves nothing (it could be failing for
      // some unrelated reason and would look identical).
      if (prof) { prof.smaa = true; lc.st.buildPost(false); out.aoTrueWithSmaaForced = attached(); prof.smaa = false; }
      lc.st.useAO = false; lc.st.buildPost(false);
      out.restoredAttached = attached();
      return out;
    });
    console.log(`  tier resolved by a phone viewport : ${r.tier}   (tier.smaa ${r.smaa}, tier.bloom ${r.bloom})`);
    console.log(`  SSAO in the shipped chain         : ${r.shippedAttached}`);
    console.log(`  SSAO after ao:true on THIS tier    : ${r.aoTrueOnPhoneTier}  ${r.aoTrueOnPhoneTier ? '' : '<- the flag is a NO-OP on a phone'}`);
    console.log(`  POSITIVE CONTROL, smaa forced true : ${r.aoTrueWithSmaaForced}  ${r.aoTrueWithSmaaForced ? '<- so the negative arm above is real' : '🔴 control failed — the negative arm proves nothing'}`);
    console.log(`  restored                           : ${r.restoredAttached}`);
    if (!r.aoTrueWithSmaaForced) console.log('  🔴 VACUOUS: without the positive control attaching, "ao does nothing on a phone" is unproven.');
    await page.close();
    return r;
  } finally { await browser.close(); }
}

// ── LOBBY (charStage, pitch 20) ─────────────────────────────────────────────
async function modeLobby() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = {};
  try {
    const page = await newPage(browser, 1300, 740, false);
    await page.goto(`${BASE}/?screen=characters`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForFunction("window.__screenReady === true && window.__screen === 'characters'", null, { timeout: 90_000 });
    await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await freeze(page);
    await page.evaluate(`
      window.__lc = (() => {
        const st = window.__charStage && window.__charStage.stage ? window.__charStage.stage : window.__stage;
        if (!st) throw new Error('no char Stage');
        const gl = st.renderer.getContext(), cv = st.renderer.domElement;
        const W = cv.width, H = cv.height;
        st.renderer.info.autoReset = false;
        const read = () => { const p = new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p); return p; };
        const shot = () => { st.renderer.info.reset(); st.render(1/60); return read(); };
        const fx = () => (st.composer ? st.composer.passes.flatMap((p) => p.effects || []) : []);
        return { st, W, H, read, shot, fx, find: (re) => fx().find((e)=>re.test(e.name)) || null,
                 counts: () => { st.renderer.info.reset(); st.render(1/60); const r = st.renderer.info.render; return { draws: r.calls, tris: r.triangles }; },
                 L: () => st.lighting };
      })();
    `);
    await page.evaluate(MATH_SRC.replace(/^/, '') + '\nwindow.__lcM = { lcRadial, lcTemp, lcDiff, lcLuma };');
    const drift = await page.evaluate(() => {
      const A = window.__lc.shot(), B = window.__lc.shot();
      return window.__lcM.lcDiff(A, B);
    });
    console.log(`  drift control [lobby] : mean ${drift.mean.toFixed(6)} max ${drift.max} ${drift.mean === 0 && drift.max === 0 ? '✅ EXACTLY ZERO' : '🔴 DRIFTS'}`);
    const res = await page.evaluate(({ bins, q }) => {
      const lc = window.__lc, m = window.__lcM;
      const A = lc.shot();
      const vign = lc.find(/Vignette/);
      const rows = [];
      const run = (name, apply, undo) => {
        apply(); const B = lc.shot(); const d = m.lcDiff(A, B);
        const rad = m.lcRadial(B, lc.W, lc.H, bins, true);
        undo(); const R = lc.shot();
        const r2 = m.lcDiff(A, R);
        rows.push({ name, ...d, radial: rad, restoredExactly: r2.mean === 0 && r2.max === 0 });
      };
      const L = lc.L();
      if (L) for (const [n, o] of [['key', L.key], ['front', L.front], ['rim', L.rim], ['hemisphere fill', L.fill], ['ambient', L.ambient]]) {
        if (!o) { rows.push({ name: n, missing: true }); continue; }
        const w = o.intensity; run(n, () => { o.intensity = 0; }, () => { o.intensity = w; });
      }
      if (vign) { const w = vign.blendMode.opacity.value; run('vignette', () => { vign.blendMode.opacity.value = 0; }, () => { vign.blendMode.opacity.value = w; }); }
      else rows.push({ name: 'vignette', missing: true });
      return {
        W: lc.W, H: lc.H,
        radial: m.lcRadial(A, lc.W, lc.H, bins, true),
        temp: m.lcTemp(A, lc.W, lc.H, q),
        counts: lc.counts(),
        passes: lc.st.composer ? lc.st.composer.passes.map((p) => p.constructor.name) : [],
        effects: lc.fx().map((e) => e.name),
        rows,
      };
    }, { bins: RADIAL_BINS, q: DECILES });
    await page.screenshot({ path: `${OUT}/lobby_20.png` });
    out.lobby = { drift, ...res };
    console.log(`  lobby ${res.W}x${res.H}  passes ${res.passes.join(' -> ')}  effects ${res.effects.join(',')}`);
    console.log(`  tempSpread = ${(res.temp[res.temp.length - 1].temp - res.temp[0].temp).toFixed(2)}`);
    console.log('  radial: ' + res.radial.filter((_, i) => i % 2 === 1).map((b) => `${b.r.toFixed(2)}:${b.mean.toFixed(3)}`).join(' '));
    for (const r of res.rows) {
      if (r.missing) { console.log(`    ${r.name.padEnd(20)} — ABSENT`); continue; }
      console.log(`    ${r.name.padEnd(20)} mean ${r.mean.toFixed(4)} max ${String(r.max).padStart(3)} ${r.pct.toFixed(2)}%px  ${r.restoredExactly ? 'restored ✅' : '🔴 restore drifted'}`);
    }
    await page.close();
  } finally { await browser.close(); }
  await writeFile(`${OUT}/lobby.json`, JSON.stringify(out, null, 1));
  console.log(`wrote ${OUT}/lobby.json`);
  return out;
}

// ── REFERENCE PLATES — NUMBERS ONLY. This repo is PUBLIC and describing a plate
//    counts as publishing it. Filenames and pixel statistics only; never content.
async function modePlate() {
  const dir = fileURLToPath(new URL('../../reference/images/curated/gameplay_topdown/', import.meta.url));
  if (!existsSync(dir)) { console.log(`no plates at ${dir}`); return null; }
  const files = (await readdir(dir)).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort();
  if (!files.length) throw new Error('plate directory is EMPTY — every arm below would be vacuous');
  const rows = [];
  for (const f of files) {
    const img = sharp(`${dir}/${f}`).ensureAlpha();
    const meta = await img.metadata();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    if (info.channels !== 4) throw new Error(`${f}: ${info.channels} channels, expected RGBA`);
    void meta;
    const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
    const rad = M.lcRadial(px, W, H, RADIAL_BINS, false);
    if (!rad.every((b) => b.n > 0)) throw new Error(`${f}: an empty radial bin — the arm would be vacuous`);
    const temp = M.lcTemp(px, W, H, DECILES);
    const spread = temp[DECILES - 1].temp - temp[0].temp;
    // Corner falloff, normalised: the outermost bin against the innermost.
    const fall = rad[RADIAL_BINS - 1].mean / rad[0].mean;
    const fall80 = rad[Math.round(0.8 * RADIAL_BINS) - 1].mean / rad[0].mean;
    rows.push({ file: f, W, H, radial: rad, temp, tempSpread: spread, cornerRatio: fall, r80Ratio: fall80 });
    console.log(`  ${f.padEnd(14)} ${String(W).padStart(5)}x${String(H).padStart(4)}`
      + `  meanLuma ${(rad.reduce((s, b) => s + b.mean * b.n, 0) / rad.reduce((s, b) => s + b.n, 0)).toFixed(3)}`
      + `  tempSpread ${spread >= 0 ? '+' : ''}${spread.toFixed(1)}`
      + `  corner/centre ${fall.toFixed(3)}   r0.80/centre ${fall80.toFixed(3)}`);
  }
  if (!rows.length) throw new Error('no plate produced a row — vacuous');
  const med = (xs) => { const s = [...xs].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  console.log(`\n  PLATES, n=${rows.length}:  tempSpread median ${med(rows.map((r) => r.tempSpread)).toFixed(1)}`
    + `  [${Math.min(...rows.map((r) => r.tempSpread)).toFixed(1)} .. ${Math.max(...rows.map((r) => r.tempSpread)).toFixed(1)}]`);
  console.log(`                  corner/centre median ${med(rows.map((r) => r.cornerRatio)).toFixed(3)}`
    + `  [${Math.min(...rows.map((r) => r.cornerRatio)).toFixed(3)} .. ${Math.max(...rows.map((r) => r.cornerRatio)).toFixed(3)}]`);
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/plate.json`, JSON.stringify({ mode: 'plate', n: rows.length, rows }, null, 1));
  console.log(`wrote ${OUT}/plate.json`);
  return rows;
}

// 🚨 IS_MAIN. Three tools here ran a live sweep, or launched Chromium, merely on being
// imported — `PREVIEW_BASE` is set in every `with_snapshot` child, so a module-scope
// side effect is not hypothetical.
const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) {
  if (has('--selftest')) process.exitCode = selftest() ? 0 : 1;
  else if (MODE === 'plate') await modePlate();
  else if (MODE === 'cost') await modeCost();
  else if (MODE === 'lobby') await modeLobby();
  else if (MODE === 'aogate') await modeAoGate();
  else await modeFrame();
}

export { M, MATH_SRC, selftest };
