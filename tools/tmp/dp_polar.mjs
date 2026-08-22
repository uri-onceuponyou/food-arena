#!/usr/bin/env node
/**
 * DP_POLAR — the HERO/GROUND VALUE POLARITY, and the ground's warm/cool split.
 *
 * Round 1 of item 4 (`d16fcec`) bought a dark tail with a post-chain AO and a re-priced
 * vignette, and explicitly spent NOTHING on the lighting rig. The round-2 critic named
 * two rig-shaped gaps, and this tool exists to measure both on one frame:
 *
 *   1. *"our subject is the darkest thing in his own frame; every reference hero is one of
 *      the brightest"* — hub hero V 0.496 against bare ground 0.759, i.e. **-0.263**,
 *      against **+0.117** across 8 subjects in 3 plates.
 *   2. *"the ground's warm/cool split is the WRONG SIGN at hub"* — lit (R-B) minus shaded
 *      (R-B) is **-7.8** at hub against **+18.2 / +31.2 / +45.5** on the plates.
 *
 * ── WHY ABLATION MASKS AND NOT A COLOUR KEY ─────────────────────────────────────────
 *
 * `docs/LESSONS.md` §5: *"a mask from one render and a value from another is a lie wherever
 * they disagree."* Every mask here is built by HIDING geometry and keeping the pixels that
 * CHANGE, in the same session, on the same frozen frame, from the same GL buffer as the
 * values. So a floor pixel behind a prop does not change and is correctly excluded, and a
 * hero pixel is a hero pixel because the hero is what drew it — not because it matched a
 * hue guess.
 *
 * Four renders per station, in this order, because each one is the previous one's control:
 *
 *   A   shipped
 *   A2  hero `castShadow = false`, hero contact decal hidden   -> hero coverage only
 *   B   A2 + hero meshes hidden                                -> maskHero = diff(A2, B)
 *   C   flat arena geometry hidden                             -> maskFlat = diff(A, C)
 *   D   key `castShadow = false`                               -> maskShadow = flat pixels
 *                                                                 that D makes BRIGHTER
 *
 * The hero's own shadow and its contact decal are off in A2/B for the reason
 * `contactshadow.mjs` states: otherwise the diff carries the shadow as if it were the
 * character, and the hero reads darker than it is — which is the very statistic under test.
 *
 * "Flat" is the arena's own split at bounding-box `y1 < 0.20 m`, the same one
 * `contactshadow.mjs` uses, so ground means ground and not "the top of a counter".
 *
 * ── DEFINITIONS, STATED BECAUSE THE HEADLINE IS A DIFFERENCE OF TWO OF THEM ──────────
 *
 *   heroV        median HSV V over maskHero
 *   groundV      median V over maskFlat                (all visible ground)
 *   groundLitV   median V over maskFlat \ maskShadow   ("bare ground", the critic's term)
 *   groundShdV   median V over maskFlat ∩ maskShadow
 *   dHeroGround  heroV - groundLitV                    <- HEADLINE 1. Target ~ +0.10.
 *   heroPct      where heroV sits in the WHOLE FRAME's own V distribution, 0-100
 *   tempSplit    mean(R-B) over lit ground minus mean(R-B) over shaded ground, display-
 *                encoded 0-255                          <- HEADLINE 2. Plates +18..+46.
 *
 * ⚠️ `tempSplit` is computed on DISPLAY-ENCODED bytes, because that is what the critic and
 * the plates are read in, and §G exists to say what that encoding does to it.
 *
 * 🚨 **THE FIRST VERSION OF §G ASSERTED THE OPPOSITE OF WHAT IS TRUE AND THE SELFTEST
 * CAUGHT IT.** It read *"a pure multiply of a warm patch can move tempSplit NEGATIVE with
 * no cool light anywhere in the scene"*, on the reasoning that sRGB is concave so a gap
 * compresses as it brightens. **It does not.** sRGB is very close to a power law, so a
 * NEUTRAL linear multiply by k scales both R and B by about k^(1/2.2) in display bytes and
 * therefore scales their DIFFERENCE by the same factor: `+11.0` on a mid warm albedo at
 * 1.6x, `+8.0` on a bright one at 1.35x. **Both positive.** The wrong claim is kept here
 * because it is the intuitive one and the next reader will have it too.
 *
 * What that leaves is a SHARPER reading, and it is the one this round acts on:
 *   * a POSITIVE tempSplit is NOT evidence of a warm key — a flat white key on a warm
 *     floor produces one by construction (§G1);
 *   * a NEGATIVE tempSplit cannot be produced by any neutral multiply at all, so it means
 *     one of exactly two things: the shaded ground is genuinely warmer in hue than the lit
 *     ground, or **the lit ground is CLIPPING its red channel** (§G3 reproduces that).
 * `clipR` / `clipAny` are reported on every mask for exactly that reason.
 *
 * ── INSTRUMENT VALIDATION (CLAUDE.md rule 6) ────────────────────────────────────────
 *
 *   §A maskDiff count against a closed form, plus a known-bad threshold that must MISS a
 *      change it is set above.
 *   §B maskStats median/mean against a closed form on a synthetic ramp.
 *   §C percentile-in-frame against a closed form, plus an off-by-a-bin known-bad.
 *   §D (R-B) sign and magnitude: warm patch positive, cool negative, grey ~0.
 *   §E THE VACUITY ARM. `[].every()` is `true` and a mean over nothing is NaN, so every
 *      filtered set is asserted NON-EMPTY *first*. An empty mask must make `maskStats`
 *      return `n === 0` and must make the reporting path THROW — proven by calling it.
 *   §F the subject gate must FAIL on a frame whose hero mask is empty. A probe that
 *      photographs the floor otherwise reports a perfectly healthy ground.
 *   §G what the display encoding does to `tempSplit`, sized rather than assumed — and the
 *      arm that FALSIFIED this file's first hypothesis about it. Plus `clipR`, which is
 *      the rail the corrected reading points at.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/dp_polar.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-dp2-before -- \
 *     node tools/tmp/dp_polar.mjs --mode frame --url '{URL}' --label before --out tools/tmp/dp2_A
 *   ... --mode sweep --rigs tools/tmp/dp2_rigs.json    # live rig rows, one boot, no rebuild
 *   ... --mode lobby                                   # the charStage camera, pitch 20
 *
 * ⚠️ Camera shake re-randomises on every `render()` even at dt=0 and CSS animations run on
 * the document timeline rather than rAF. Both are stilled; the drift control is printed
 * FIRST and if it is not EXACTLY zero nothing below it is a measurement.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DP_MATH } from './dp_dark.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// PURE MATH — ONE source, run BOTH node-side (selftest) and inside the page.
// ─────────────────────────────────────────────────────────────────────────────
const PL_MATH = String.raw`
/** Pixels whose RGB changed by more than 'thr' in L1. Returns the mask AND its count. */
function plDiff(A, B, W, H, thr) {
  var m = new Uint8Array(W * H), n = 0;
  for (var j = 0; j < W * H; j++) {
    var i = j * 4;
    var d = Math.abs(A[i] - B[i]) + Math.abs(A[i+1] - B[i+1]) + Math.abs(A[i+2] - B[i+2]);
    if (d > thr) { m[j] = 1; n++; }
  }
  return { m: m, n: n };
}

/** Pixels of 'inMask' where B is BRIGHTER than A by more than thr (Rec.709 luma, 0-255). */
function plBrighter(A, B, inMask, W, H, thr) {
  var m = new Uint8Array(W * H), n = 0;
  for (var j = 0; j < W * H; j++) {
    if (!inMask[j]) continue;
    var i = j * 4;
    var la = 0.2126*A[i] + 0.7152*A[i+1] + 0.0722*A[i+2];
    var lb = 0.2126*B[i] + 0.7152*B[i+1] + 0.0722*B[i+2];
    if (lb - la > thr) { m[j] = 1; n++; }
  }
  return { m: m, n: n };
}

function plAndNot(a, b, W, H) {
  var m = new Uint8Array(W * H), n = 0;
  for (var j = 0; j < W * H; j++) { if (a[j] && !b[j]) { m[j] = 1; n++; } }
  return { m: m, n: n };
}
function plAnd(a, b, W, H) {
  var m = new Uint8Array(W * H), n = 0;
  for (var j = 0; j < W * H; j++) { if (a[j] && b[j]) { m[j] = 1; n++; } }
  return { m: m, n: n };
}

/**
 * V / luma / saturation / (R-B) over a mask. 'mask' null means the whole buffer.
 * Returns n === 0 for an empty set rather than NaN — the CALLER must refuse it (§E).
 * The V histogram is 256 bins and EXACT, because V is a byte / 255.
 */
function plStats(rgba, mask, W, H) {
  var n = 0, vSum = 0, lSum = 0, sSum = 0, rbSum = 0, clipR = 0, clipAny = 0;
  var vH = new Float64Array(256);
  for (var j = 0; j < W * H; j++) {
    if (mask && !mask[j]) continue;
    var i = j * 4;
    var r = rgba[i], g = rgba[i+1], b = rgba[i+2];
    var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    vH[mx]++; n++;
    if (r >= 255) clipR++;
    if (mx >= 255) clipAny++;
    vSum += mx / 255;
    lSum += (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    sSum += mx === 0 ? 0 : (mx - mn) / mx;
    rbSum += r - b;
  }
  if (n === 0) return { n: 0 };
  var med = 0, acc = 0, half = n / 2;
  for (var k = 0; k < 256; k++) { acc += vH[k]; if (acc >= half) { med = k; break; } }
  return { n: n, vMean: vSum / n, vMed: med / 255, luma: lSum / n, sat: sSum / n,
           rb: rbSum / n, clipR: clipR / n, clipAny: clipAny / n,
           hist: Array.prototype.slice.call(vH) };
}

/**
 * Where value 'v' (0..1) sits in a 256-bin V histogram, as a percentile 0-100.
 * Counts the bins strictly BELOW v plus half of v's own bin — the midpoint rule, so a
 * flat distribution puts its own median at 50 rather than at 50 +- half a bin.
 */
function plPct(hist, v) {
  var total = 0; for (var k = 0; k < 256; k++) total += hist[k];
  if (total === 0) return null;
  var bin = Math.max(0, Math.min(255, Math.round(v * 255)));
  var below = 0; for (var k2 = 0; k2 < bin; k2++) below += hist[k2];
  return 100 * (below + 0.5 * hist[bin]) / total;
}
`;

const M = (0, eval)(`${PL_MATH}; ({ plDiff, plBrighter, plAndNot, plAnd, plStats, plPct })`);
const DM = (0, eval)(`${DP_MATH}; ({ dpBand, dpDiff })`);

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST
// ─────────────────────────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
function ok(name, cond, got) {
  if (cond) { PASS++; console.log(`  ok   ${name}`); }
  else { FAIL++; console.log(`  FAIL ${name}   got ${got}`); }
}
function frame(W, H, f) {
  const p = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = f(x, y); const i = (y * W + x) * 4;
    p[i] = r; p[i+1] = g; p[i+2] = b; p[i+3] = 255;
  }
  return p;
}

function selftest() {
  const W = 40, H = 20, N = W * H;

  // ── §A maskDiff: closed form, and a known-bad threshold that must MISS ──────
  const A = frame(W, H, () => [100, 100, 100]);
  const B = frame(W, H, (x, y) => (y < 5 ? [140, 100, 100] : [100, 100, 100]));   // 5 rows differ by 40
  const dA = M.plDiff(A, B, W, H, 8);
  ok('§A1 diff count = 5 rows', dA.n === 5 * W, dA.n);
  const B1 = frame(W, H, (x, y) => (y < 5 ? [101, 100, 100] : [100, 100, 100]));  // differ by 1
  ok('§A2 KNOWN-BAD thr 8 MISSES a 1-unit change', M.plDiff(A, B1, W, H, 8).n === 0, M.plDiff(A, B1, W, H, 8).n);
  ok('§A3 and thr 0 CATCHES it (so §A2 is a threshold, not a broken loop)',
    M.plDiff(A, B1, W, H, 0).n === 5 * W, M.plDiff(A, B1, W, H, 0).n);

  // ── §B stats: closed form on a two-value frame ─────────────────────────────
  // 3/4 of pixels at V=0.4 (102), 1/4 at V=0.8 (204). mean = 0.5, median = 0.4.
  const C = frame(W, H, (x) => (x < 30 ? [102, 102, 102] : [204, 204, 204]));
  const sC = M.plStats(C, null, W, H);
  ok('§B1 n = all pixels', sC.n === N, sC.n);
  ok('§B2 vMean = 0.500', Math.abs(sC.vMean - (0.75 * 102 + 0.25 * 204) / 255) < 1e-9, sC.vMean);
  ok('§B3 vMed = 102/255', Math.abs(sC.vMed - 102 / 255) < 1e-9, sC.vMed);
  ok('§B4 sat = 0 on grey', Math.abs(sC.sat) < 1e-12, sC.sat);
  const half = new Uint8Array(N); for (let j = 0; j < N; j++) half[j] = (j % W) < 30 ? 1 : 0;
  const sH = M.plStats(C, half, W, H);
  ok('§B5 masked vMean = 102/255 (mask actually applied)', Math.abs(sH.vMean - 102 / 255) < 1e-9, sH.vMean);

  // ── §C percentile: closed form + off-by-a-bin known-bad ────────────────────
  // In C, 75% of pixels sit in bin 102 and 25% in bin 204.
  ok('§C1 pct(0.4) = 37.5 (midpoint of the 75% bin)', Math.abs(M.plPct(sC.hist, 102 / 255) - 37.5) < 1e-9, M.plPct(sC.hist, 102 / 255));
  ok('§C2 pct(0.8) = 87.5', Math.abs(M.plPct(sC.hist, 204 / 255) - 87.5) < 1e-9, M.plPct(sC.hist, 204 / 255));
  ok('§C3 KNOWN-BAD one bin lower reads 75.0, not 87.5', Math.abs(M.plPct(sC.hist, 203 / 255) - 75) < 1e-9, M.plPct(sC.hist, 203 / 255));

  // ── §D (R-B) sign and magnitude ────────────────────────────────────────────
  const warm = M.plStats(frame(W, H, () => [200, 170, 140]), null, W, H);
  const cool = M.plStats(frame(W, H, () => [140, 170, 200]), null, W, H);
  const grey = M.plStats(frame(W, H, () => [170, 170, 170]), null, W, H);
  ok('§D1 warm rb = +60', Math.abs(warm.rb - 60) < 1e-9, warm.rb);
  ok('§D2 cool rb = -60', Math.abs(cool.rb + 60) < 1e-9, cool.rb);
  ok('§D3 grey rb = 0', Math.abs(grey.rb) < 1e-12, grey.rb);

  // ── §E THE VACUITY ARM ─────────────────────────────────────────────────────
  const empty = new Uint8Array(N);
  const sE = M.plStats(C, empty, W, H);
  ok('§E1 empty mask -> n === 0, not NaN', sE.n === 0 && sE.vMean === undefined, JSON.stringify(sE));
  let threw = false;
  try { requireMask('selftest-empty', sE); } catch { threw = true; }
  ok('§E2 the reporting path THROWS on it (a vacuous row cannot be published)', threw, threw);
  let threw2 = false;
  try { requireMask('selftest-full', sC); } catch { threw2 = true; }
  ok('§E3 and does NOT throw on a real set (so §E2 is a guard, not a broken function)', !threw2, threw2);
  ok('§E4 plPct on an all-zero histogram returns null, not 0', M.plPct(new Array(256).fill(0), 0.5) === null, M.plPct(new Array(256).fill(0), 0.5));

  // ── §F the subject gate must FAIL on an empty hero mask ────────────────────
  ok('§F1 subject gate REJECTS 0 hero pixels', subjectOk({ hero: { n: 0 }, flat: { n: 1000 } }) === false, true);
  ok('§F2 subject gate REJECTS a hero smaller than the floor of 200 px', subjectOk({ hero: { n: 199 }, flat: { n: 1000 } }) === false, true);
  ok('§F3 subject gate ACCEPTS a real pair (so §F1/§F2 are a gate, not a stub)', subjectOk({ hero: { n: 4000 }, flat: { n: 200000 } }) === true, true);
  ok('§F4 subject gate REJECTS an empty FLOOR too', subjectOk({ hero: { n: 4000 }, flat: { n: 0 } }) === false, true);

  // ── §G the sRGB compression artefact, SIZED ────────────────────────────────
  // One warm albedo, lit by a pure neutral multiply of 1.6x in LINEAR light. No cool
  // light exists anywhere in this arm, so a "warm/cool split" of zero would be the
  // honest answer and any deviation is the encoding.
  const toL = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const toS = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const shade = [0.42, 0.30, 0.22];
  const enc = (rgb, k) => rgb.map((c) => Math.round(255 * toS(Math.min(1, toL(c) * k))));
  const lit = enc(shade, 1.6), shd = enc(shade, 1.0);
  const gSplit = (lit[0] - lit[2]) - (shd[0] - shd[2]);
  const shade2 = [0.72, 0.60, 0.50];
  const lit2 = enc(shade2, 1.35), shd2 = enc(shade2, 1.0);
  const gSplit2 = (lit2[0] - lit2[2]) - (shd2[0] - shd2[2]);
  console.log(`       §G neutral x1.6 on a mid warm albedo: ${gSplit >= 0 ? '+' : ''}${gSplit.toFixed(1)}`
    + `   |  neutral x1.35 on a bright warm albedo: ${gSplit2 >= 0 ? '+' : ''}${gSplit2.toFixed(1)}`);
  // ⚠️ THIS ARM PREVIOUSLY ASSERTED `gSplit2 < 0` AND WAS FALSIFIED BY ITS OWN RUN.
  // Old wording, kept per house style: "§G2 and it is NEGATIVE up there — the sign alone
  // cannot prove a cool light". It is +8.0. The reasoning was that sRGB compresses a gap
  // as it brightens; sRGB is a power law, so it SCALES the gap instead.
  ok('§G1 a neutral multiply on a warm floor produces a POSITIVE tempSplit by construction',
    gSplit > 0.5 && gSplit2 > 0.5, `${gSplit.toFixed(1)} / ${gSplit2.toFixed(1)}`);
  // §G2/§G3 the ONLY way a neutral multiply reverses the sign is CLIPPING — and it takes
  // enough of it that R AND G are both pinned while B still has headroom. Swept rather
  // than asserted at one k, because the first draft picked 2.4x, which pins R and still
  // reads +9.0: a little clipping is not enough and saying so is the point of the sweep.
  const shd3 = enc(shade2, 1.0);
  const base3 = shd3[0] - shd3[2];
  let firstNeg = null;
  const sweep = [];
  for (const k of [1.6, 2.0, 2.4, 3.0, 3.5, 4.0, 5.0]) {
    const L = enc(shade2, k);
    const d = (L[0] - L[2]) - base3;
    sweep.push(`x${k}:${d >= 0 ? '+' : ''}${d}${L[0] >= 255 ? '*' : ''}`);
    if (firstNeg === null && d < 0) firstNeg = k;
  }
  console.log(`       §G clip sweep on a bright warm albedo (* = R pinned): ${sweep.join('  ')}`);
  ok('§G2 R pins before the sign turns (so clipping is necessary, not sufficient)', enc(shade2, 2.4)[0] >= 255, enc(shade2, 2.4)[0]);
  ok('§G3 and with ENOUGH of it tempSplit does go negative', firstNeg !== null, firstNeg);
  console.log(`       §G first neutral multiply with a NEGATIVE tempSplit: x${firstNeg}`);
  // §G4 clipR itself must be able to fire and must be able to read zero.
  const bright = M.plStats(frame(W, H, () => [255, 200, 120]), null, W, H);
  const dim = M.plStats(frame(W, H, () => [200, 170, 140]), null, W, H);
  ok('§G4 clipR = 1.0 on a pinned-red frame', Math.abs(bright.clipR - 1) < 1e-12, bright.clipR);
  ok('§G5 clipR = 0.0 on an unpinned one (so §G4 is a counter, not a constant)', dim.clipR === 0, dim.clipR);

  // ── §H plBrighter / set algebra ────────────────────────────────────────────
  const all = new Uint8Array(N).fill(1);
  const br = M.plBrighter(A, B, all, W, H, 4);     // B is brighter on the top 5 rows
  ok('§H1 plBrighter finds exactly the brighter rows', br.n === 5 * W, br.n);
  ok('§H2 plBrighter is DIRECTIONAL (A over B finds nothing)', M.plBrighter(B, A, all, W, H, 4).n === 0, M.plBrighter(B, A, all, W, H, 4).n);
  ok('§H3 andNot', M.plAndNot(all, br.m, W, H).n === N - 5 * W, M.plAndNot(all, br.m, W, H).n);
  ok('§H4 and', M.plAnd(all, br.m, W, H).n === 5 * W, M.plAnd(all, br.m, W, H).n);

  console.log(`\n  dp_polar --selftest: ${PASS} passed, ${FAIL} failed`);
  return FAIL === 0;
}

/** §E's guard. A mean over an empty set is NaN and NaN prints as a number in a table. */
function requireMask(name, s) {
  if (!s || !s.n) throw new Error(`${name}: EMPTY mask (n=${s ? s.n : 'null'}) — refusing to publish a statistic over nothing`);
  return s;
}
/** §F's gate. 200 px is ~0.014% of a 1600x900 frame — a hero that small is not in shot. */
function subjectOk(m) {
  return !!(m && m.hero && m.flat && m.hero.n >= 200 && m.flat.n >= 200);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE HARNESS
// ─────────────────────────────────────────────────────────────────────────────
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PAGE_SRC = `${PL_MATH}
${DP_MATH}
window.__pl = (() => {
  const st = window.__stage;
  if (!st) throw new Error('no Stage on this route');
  if (st.disposed) throw new Error('window.__stage is a DISPOSED Stage');
  const gl = st.renderer.getContext();
  const cv = st.renderer.domElement;
  const W = cv.width, H = cv.height;
  st.renderer.info.autoReset = false;
  const read = () => { const p = new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p); return p; };
  const shot = () => { st.renderer.info.reset(); st.render(1/60); return read(); };
  const counts = () => { st.renderer.info.reset(); st.render(1/60); const r = st.renderer.info.render;
    return { draws: r.calls, tris: r.triangles }; };

  // ── the geometry sets, taken from the scene rather than guessed ────────────
  const scene = st.scene;
  scene.updateMatrixWorld(true);
  const arena = scene.getObjectByName('arena:kitchen');
  if (!arena) throw new Error('no arena:kitchen in the scene');
  const V3 = st.rig.camera.position.constructor;
  const boxOf = (o) => {
    const g = o.geometry; if (!g) return null;
    if (o.isInstancedMesh) o.computeBoundingBox();
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox; if (!bb) return null;
    const e = o.matrixWorld.elements;
    let y0 = Infinity, y1 = -Infinity;
    for (let c = 0; c < 8; c++) {
      const vx = (c & 1) ? bb.max.x : bb.min.x, vy = (c & 2) ? bb.max.y : bb.min.y, vz = (c & 4) ? bb.max.z : bb.min.z;
      const wy = e[1]*vx + e[5]*vy + e[9]*vz + e[13];
      if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
    }
    return { y0: y0, y1: y1 };
  };
  const flat = [], stand = [];
  arena.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const b = boxOf(o); if (!b) return;
    (b.y1 < 0.20 ? flat : stand).push(o.uuid);
  });
  // The hero. Its contact DECAL lives under 'contact:shadows', a sibling group, so the
  // character subtree is coverage only — but the decal is hidden alongside it anyway,
  // because it is drawn UNDER the hero's own feet and would land in the ground mask.
  const heroName = 'character:' + (window.__plPlayer || 'hamburger');
  const heroRoot = scene.getObjectByName(heroName);
  if (!heroRoot) throw new Error('no ' + heroName + ' in the scene');
  const hero = [];
  heroRoot.traverse((o) => { if (o.isMesh) hero.push(o.uuid); });
  // 🚨 THE GROUP, NOT ITS CHILDREN — AND THE FIRST VERSION TOOK THE CHILDREN.
  // Stage.updateContactShadows() runs inside EVERY render() and sets
  // decal.visible = true on each CHILD, so hiding the meshes is undone before the
  // frame is drawn. The ablation then reports dMean 0.00 with dMax 0, which reads
  // exactly like "the contact decal draws nothing" — a vacuous arm that looks like a
  // finding. It touches the children only, so hiding the GROUP survives the render.
  // Asserted below rather than trusted: plDecalsHidden() re-reads the flag AFTER the
  // ablation render and the caller refuses the row if the scene put it back.
  const decals = [];
  const dg = scene.getObjectByName('contact:shadows');
  if (dg) { decals.push(dg.uuid); dg.traverse((o) => { if (o.isMesh) decals.push(o.uuid); }); }
  const decalGroup = dg || null;

  const setVis = (uuids, v) => { const s = new Set(uuids); let n = 0;
    scene.traverse((o) => { if (s.has(o.uuid)) { o.visible = v; n++; } }); st.markShadowsDirty(); return n; };
  const setCast = (uuids, on) => { const s = new Set(uuids); let n = 0;
    scene.traverse((o) => { if (!s.has(o.uuid)) return;
      if (o.__plCast === undefined) o.__plCast = o.castShadow;
      o.castShadow = on ? o.__plCast : false; n++; }); st.markShadowsDirty(); return n; };

  /** Did the ablation actually stick? Re-read AFTER a render, never before. */
  const decalsHidden = () => !!decalGroup && decalGroup.visible === false;
  return { st, W, H, read, shot, counts, flat, stand, hero, decals, decalsHidden, setVis, setCast,
    diff: dpDiff, band: dpBand,
    plDiff: plDiff, plBrighter: plBrighter, plAndNot: plAndNot, plAnd: plAnd,
    plStats: plStats, plPct: plPct };
})();
`;

/** Live rig override. Intensities and colours only — no position, so `focus()` (which is
 *  not even being called under a stubbed rAF) cannot undo it and no shadow re-render is
 *  needed. `__plShip` is captured once so a row can always return to shipped. */
const APPLY = `(cfg) => {
  const rig = window.__stage.lighting;
  const { key, fill, front, rim, ambient } = rig;
  if (!rig.__plShip) rig.__plShip = {
    keyInt: key.intensity, keyColor: key.color.getHex(),
    fillInt: fill.intensity, fillSky: fill.color.getHex(), fillGround: fill.groundColor.getHex(),
    frontInt: front.intensity, frontColor: front.color.getHex(),
    rimInt: rim.intensity, rimColor: rim.color.getHex(), ambInt: ambient.intensity,
  };
  const S = rig.__plShip;
  key.intensity   = cfg.keyInt   == null ? S.keyInt   : cfg.keyInt;
  key.color.setHex(cfg.keyColor  == null ? S.keyColor : cfg.keyColor);
  fill.intensity  = cfg.fillInt  == null ? S.fillInt  : cfg.fillInt;
  fill.color.setHex(cfg.fillSky  == null ? S.fillSky  : cfg.fillSky);
  fill.groundColor.setHex(cfg.fillGround == null ? S.fillGround : cfg.fillGround);
  front.intensity = cfg.frontInt == null ? S.frontInt : cfg.frontInt;
  front.color.setHex(cfg.frontColor == null ? S.frontColor : cfg.frontColor);
  rim.intensity   = cfg.rimInt   == null ? S.rimInt   : cfg.rimInt;
  rim.color.setHex(cfg.rimColor  == null ? S.rimColor : cfg.rimColor);
  ambient.intensity = cfg.ambInt == null ? S.ambInt   : cfg.ambInt;
  return { keyInt: key.intensity, fillInt: fill.intensity, frontInt: front.intensity,
           rimInt: rim.intensity, ambInt: ambient.intensity,
           keyColor: key.color.getHexString(), fillSky: fill.color.getHexString(),
           fillGround: fill.groundColor.getHexString(), frontColor: front.color.getHexString() };
}`;

/**
 * WHO IS DARKENING THE HERO — the AO's own contribution, split by mask.
 *
 * `d16fcec` shipped `ContactAOEffect` and its acceptance numbers are whole-frame. A
 * whole-frame mean cannot say whether the darkening landed on the CONTACT BAND (the ask)
 * or on the SUBJECT'S OWN SILHOUETTE (a defect that makes the hero darker still, which is
 * the very statistic the round-2 critic named). This splits it, on the same ablation
 * masks as `MEASURE`, and writes the delta so it can be LOOKED AT rather than described.
 */
const ABLATE = `(cfg) => {
  const p = window.__pl, W = p.W, H = p.H;
  const ao = window.__stage.contactAO;
  if (!ao) throw new Error('no contactAO on this Stage — the ablation would be vacuous');
  const ship = { intensity: ao.intensity, radius: ao.radius, bias: ao.bias, range: ao.range };
  if (cfg) { for (var kk in cfg) if (cfg[kk] != null) ao[kk] = cfg[kk]; }
  const A = p.shot();                      // AO as configured
  ao.intensity = 0;
  const B = p.shot();                      // AO ablated
  ao.intensity = cfg && cfg.intensity != null ? cfg.intensity : ship.intensity;
  const A2 = p.shot();                     // and back — must be bit-identical to A
  const restore = p.diff(A, A2);
  // 🚨 masks with the AO OFF — see MEASURE. With it on, hiding the hero also removes the
  // wreath of darkened floor around him and those floor pixels land in the HERO mask.
  ao.intensity = 0;
  const A0 = p.shot();
  p.setCast(p.hero, false); p.setVis(p.decals, false);
  const C = p.shot();
  p.setVis(p.hero, false);
  const D = p.shot();
  p.setVis(p.hero, true); p.setVis(p.decals, true); p.setCast(p.hero, true);
  const mHero = p.plDiff(C, D, W, H, 8);
  p.setVis(p.flat, false);
  const E = p.shot();
  p.setVis(p.flat, true);
  const mFlat = p.plDiff(A0, E, W, H, 8);
  ao.intensity = cfg && cfg.intensity != null ? cfg.intensity : ship.intensity;
  const A3 = p.shot();
  const restore2 = p.diff(A, A3);
  // per-mask darkening, in display codes 0-255 of Rec.709 luma
  const stat = (mask) => {
    var n = 0, sum = 0, hit = 0, mx = 0;
    for (var j = 0; j < W * H; j++) {
      if (mask && !mask[j]) continue;
      var i = j * 4;
      var la = 0.2126*A[i] + 0.7152*A[i+1] + 0.0722*A[i+2];
      var lb = 0.2126*B[i] + 0.7152*B[i+1] + 0.0722*B[i+2];
      var d = lb - la; n++; sum += d; if (d > 2) hit++; if (d > mx) mx = d;
    }
    return n ? { n: n, dMean: sum / n, share: hit / n, dMax: mx } : { n: 0 };
  };
  const other = new Uint8Array(W * H);
  for (var j2 = 0; j2 < W * H; j2++) other[j2] = (!mHero.m[j2] && !mFlat.m[j2]) ? 1 : 0;

  // ── CONTACT vs BLEED — the split a whole-ground mean cannot make ─────────────
  // Uri asked for darkening "where they meet the floor". A mean over the whole ground
  // scores a tight band at a prop's base and a wedge smeared across open floor ten
  // metres away identically. So the ground mask is split by SCREEN DISTANCE to the
  // nearest non-ground pixel: NEAR is the contact band (the ask), FAR is bleed (the
  // defect the range gate exists to stop). NEAR is built by dilating the non-ground
  // mask, which is derived with the AO OFF, so the band cannot move with the treatment.
  var BAND = 24;
  var near = new Uint8Array(W * H);
  for (var j3 = 0; j3 < W * H; j3++) near[j3] = mFlat.m[j3] ? 0 : 1;   // seed: non-ground
  var tmp = new Uint8Array(W * H);
  for (var it = 0; it < BAND; it++) {
    tmp.set(near);
    for (var y3 = 0; y3 < H; y3++) {
      var row = y3 * W;
      for (var x3 = 0; x3 < W; x3++) {
        if (tmp[row + x3]) continue;
        if ((x3 > 0 && tmp[row + x3 - 1]) || (x3 < W - 1 && tmp[row + x3 + 1])
          || (y3 > 0 && tmp[row - W + x3]) || (y3 < H - 1 && tmp[row + W + x3])) near[row + x3] = 1;
      }
    }
  }
  var mNear = new Uint8Array(W * H), mFar = new Uint8Array(W * H);
  var nNear = 0, nFar = 0;
  for (var j4 = 0; j4 < W * H; j4++) {
    if (!mFlat.m[j4]) continue;
    if (near[j4]) { mNear[j4] = 1; nNear++; } else { mFar[j4] = 1; nFar++; }
  }
  return { W: W, H: H, ship: ship, band: BAND,
    all: stat(null), hero: stat(mHero.m), flat: stat(mFlat.m), other: stat(other),
    contact: stat(mNear), bleed: stat(mFar),
    n: { hero: mHero.n, flat: mFlat.n, near: nNear, far: nFar },
    restore: restore, restore2: restore2,
    A: Array.from(A), B: Array.from(B) };
}`;

/**
 * WHAT MAKES THE BLOB — the three ground-darkening layers a fighter carries, separated.
 *
 * The round-2 critic's headline was *"our subject is the darkest thing in his own frame"*.
 * Measured with an AO-INDEPENDENT mask the SUBJECT is not dark at all (hub median V 0.871
 * against lit ground 0.773, and the 83.5th percentile of his own frame). What IS dark is
 * the RING OF GROUND he stands in, and three independent layers draw into it:
 *
 *   1. the contact DECAL      `contact:decal`, a multiply plane under each fighter
 *   2. the hero's CAST SHADOW from the key
 *   3. the contact AO         `ContactAOEffect`, added in `d16fcec`
 *
 * `stage.ts` already carries the scar this is the sequel to — *"a broad low-frequency
 * dimming of the whole floor ... the third soft darkening layer that a critic read as one
 * directionless blob and that scored this element 3/10"*. Three layers is what is there
 * again, and no acceptance number in `d16fcec` could see it: every one of them is a
 * whole-frame mean, and this ring is well under 1% of the frame.
 *
 * Five renders, one page load, single-variable. Each layer's contribution is (frame with
 * that layer OFF) minus the shipped frame, in Rec.709 luma codes 0-255, over the ring of
 * GROUND within `--ring` px of the hero's silhouette. The three are summed and compared
 * against the all-off arm, so the DOUBLE-COUNTING is reported rather than assumed.
 */
const BLOB = `(ringPx) => {
  const p = window.__pl, W = p.W, H = p.H;
  const st = window.__stage;
  const ao = st.contactAO;
  if (!ao) throw new Error('no contactAO — the ablation would be vacuous');
  const aoWas = ao.intensity;

  const A = p.shot();
  ao.intensity = 0;                    var B = p.shot(); ao.intensity = aoWas;
  p.setVis(p.decals, false);           var C = p.shot();
  var decalStuck = p.decalsHidden();   p.setVis(p.decals, true);
  p.setCast(p.hero, false);            var D = p.shot(); p.setCast(p.hero, true);
  ao.intensity = 0; p.setVis(p.decals, false); p.setCast(p.hero, false);
  var E = p.shot();
  ao.intensity = aoWas; p.setVis(p.decals, true); p.setCast(p.hero, true);
  const A2 = p.shot();
  const restore = p.diff(A, A2);

  ao.intensity = 0;
  const A0 = p.shot();
  p.setCast(p.hero, false); p.setVis(p.decals, false);
  const F = p.shot();
  p.setVis(p.hero, false);
  const G = p.shot();
  p.setVis(p.hero, true); p.setVis(p.decals, true); p.setCast(p.hero, true);
  const mHero = p.plDiff(F, G, W, H, 8);
  p.setVis(p.flat, false);
  const I = p.shot();
  p.setVis(p.flat, true);
  const mFlat = p.plDiff(A0, I, W, H, 8);
  ao.intensity = aoWas;
  const A3 = p.shot();
  const restore2 = p.diff(A, A3);

  var ring = new Uint8Array(W * H); ring.set(mHero.m);
  var tmp = new Uint8Array(W * H);
  for (var it = 0; it < ringPx; it++) {
    tmp.set(ring);
    for (var y = 0; y < H; y++) { var row = y * W;
      for (var x = 0; x < W; x++) { if (tmp[row + x]) continue;
        if ((x > 0 && tmp[row + x - 1]) || (x < W - 1 && tmp[row + x + 1])
          || (y > 0 && tmp[row - W + x]) || (y < H - 1 && tmp[row + W + x])) ring[row + x] = 1; } }
  }
  var mRing = new Uint8Array(W * H), nRing = 0;
  for (var j = 0; j < W * H; j++) { if (ring[j] && mFlat.m[j] && !mHero.m[j]) { mRing[j] = 1; nRing++; } }
  var mRest = new Uint8Array(W * H), nRest = 0;
  for (var j2 = 0; j2 < W * H; j2++) { if (mFlat.m[j2] && !mRing[j2] && !mHero.m[j2]) { mRest[j2] = 1; nRest++; } }

  const dstat = function (X) {
    var n = 0, sum = 0, hit = 0, mx = 0;
    for (var q = 0; q < W * H; q++) { if (!mRing[q]) continue;
      var i = q * 4;
      var la = 0.2126*A[i] + 0.7152*A[i+1] + 0.0722*A[i+2];
      var lx = 0.2126*X[i] + 0.7152*X[i+1] + 0.0722*X[i+2];
      var d = lx - la; n++; sum += d; if (d > 2) hit++; if (d > mx) mx = d; }
    return n ? { n: n, dMean: sum / n, share: hit / n, dMax: mx } : { n: 0 };
  };
  return { W: W, H: H, ringPx: ringPx, n: { hero: mHero.n, flat: mFlat.n, ring: nRing, rest: nRest },
    decalStuck: decalStuck, decalMeshes: p.decals.length,
    ao: dstat(B), decal: dstat(C), cast: dstat(D), allOff: dstat(E),
    ringV: p.plStats(A, mRing, W, H), restV: p.plStats(A, mRest, W, H), heroV: p.plStats(A, mHero.m, W, H),
    restore: restore, restore2: restore2 };
}`;

/**
 * The renders + the whole-frame statistics, in one page call.
 *
 * 🚨 **EVERY MASK IS BUILT WITH THE CONTACT AO TURNED OFF, AND THE FIRST VERSION OF THIS
 * FUNCTION DID NOT DO THAT.** It is the mask-moves-with-the-treatment defect, found by
 * an arithmetic that would not reconcile: an AO range sweep reported the hero's median V
 * moving 0.463 -> 0.859 while the same tool's own ablation said the AO removes a mean of
 * only 14.75 luma codes from him. Both cannot be true. The cause is that `maskHero` is
 * `diff(hero visible, hero hidden)` — and with a wide AO range, hiding the hero also
 * removes the WREATH OF DARKENED FLOOR around him, so those floor pixels changed too and
 * were counted as HERO. The mask was reading the treatment.
 *
 * `docs/LESSONS.md` §5 in its exact form — *"a mask from one render and a value from
 * another is a lie wherever they disagree"* — and the round-2 critic's own control
 * (*"mask derived from the BEFORE frame and applied to both arms"*) says the same thing.
 * With the AO off the masks are pure geometric coverage, identical in every arm, and the
 * VALUES are still read from the shipped frame with the AO on.
 */
const MEASURE = `(y0, y1) => {
  const p = window.__pl, W = p.W, H = p.H;
  const A = p.shot();
  const ao = window.__stage.contactAO;
  const aoWas = ao ? ao.intensity : 0;
  if (ao) ao.intensity = 0;
  const A0 = p.shot();
  // hero coverage: shadow OFF and decal hidden first, or the diff carries the shadow
  p.setCast(p.hero, false); p.setVis(p.decals, false);
  const A2 = p.shot();
  p.setVis(p.hero, false);
  const B = p.shot();
  p.setVis(p.hero, true); p.setVis(p.decals, true); p.setCast(p.hero, true);
  const maskHero = p.plDiff(A2, B, W, H, 8);
  // ground coverage
  p.setVis(p.flat, false);
  const C = p.shot();
  p.setVis(p.flat, true);
  const maskFlat = p.plDiff(A0, C, W, H, 8);
  // cast-shadow split of the ground: key shadow off makes shadowed floor BRIGHTER
  const k = p.st.lighting.key; const wasCast = k.castShadow;
  k.castShadow = false; p.st.markShadowsDirty();
  const D = p.shot();
  k.castShadow = wasCast; p.st.markShadowsDirty();
  const maskShadow = p.plBrighter(A0, D, maskFlat.m, W, H, 3);
  const maskLit = p.plAndNot(maskFlat.m, maskShadow.m, W, H);
  if (ao) ao.intensity = aoWas;

  // the CLOSING self-pair: after all that ablation the frame must return to A exactly.
  const A3 = p.shot();
  const restore = p.diff(A, A3);

  const frameS = p.plStats(A, null, W, H);
  return {
    W: W, H: H,
    hero:   p.plStats(A, maskHero.m, W, H),
    flat:   p.plStats(A, maskFlat.m, W, H),
    lit:    p.plStats(A, maskLit.m, W, H),
    shaded: p.plStats(A, maskShadow.m, W, H),
    frame:  frameS,
    band:   p.band(A, W, H, y0, y1, true),
    counts: p.counts(),
    n: { hero: maskHero.n, flat: maskFlat.n, lit: maskLit.n, shadow: maskShadow.n,
         heroMeshes: p.hero.length, flatMeshes: p.flat.length, decals: p.decals.length },
    restore: restore,
  };
}`;

async function newPage(browser, W, H) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  return page;
}

async function freeze(page) {
  await page.evaluate(() => {
    for (const an of document.getAnimations()) { try { an.pause(); an.currentTime = 0; } catch { /* ignore */ } }
    window.requestAnimationFrame = () => 0;
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const st = window.__stage;
    try { st.rig.shakeAmount = 0; st.rig.shakeOffset.set(0, 0, 0); st.rig.apply(); } catch { /* older rig */ }
  });
}

async function bootMatch(page, base, { px, py, fog, player, fighters }) {
  const q = new URLSearchParams();
  if (fighters) q.set('fighters', String(fighters));
  else { q.set('player', player); q.set('enemy', 'donut'); }
  q.set('px', String(px)); q.set('py', String(py));
  q.set('fogRadius', String(fog));
  q.set('simSpeed', '0.01');
  q.set('pointerLock', '0');
  await page.goto(`${base}/?${q.toString()}`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90_000 });
  await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'",
    null, { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(700);
  await freeze(page);
  await page.evaluate(`window.__plPlayer = ${JSON.stringify(player)};`);
  await page.evaluate(PAGE_SRC);
  await page.evaluate(`window.__plApply = ${APPLY}; window.__plMeasure = ${MEASURE}; window.__plAblate = ${ABLATE}; window.__plBlob = ${BLOB};`);
}

async function driftControl(page, label) {
  const d = await page.evaluate(() => {
    const A = window.__pl.shot(), B = window.__pl.shot();
    return window.__pl.diff(A, B);
  });
  const okd = d.mean === 0 && d.max === 0;
  console.log(`  drift [${label}] mean ${d.mean.toFixed(6)} max ${d.max} pct ${d.pct.toFixed(4)}%  `
    + (okd ? 'EXACTLY ZERO' : 'DRIFTS — nothing below is trustworthy'));
  return { ...d, ok: okd };
}

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const BASE = (get('--url', null) ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = get('--out', 'tools/tmp/dp2_out');
const LABEL = get('--label', 'run');
const MODE = get('--mode', 'frame');
const PLAYER = get('--player', 'hamburger');
const NFIGHT = Number(get('--fighters', 0));
const Y0 = 0.35, Y1 = 0.62;

async function stations() {
  const dump = JSON.parse(await readFile(new URL('../arena.gameplay.json', import.meta.url), 'utf8'));
  const fog = Math.ceil(dump.maxSafeRadius) + 1;
  const s = dump.spawns;
  if (!Array.isArray(s) || s.length < 5) throw new Error('arena dump has no spawn list — every station below would be a guess');
  return { fog, list: [
    { id: 'spawn_sw', x: s[0].x, y: s[0].y },
    { id: 'spawn_ne', x: s[2].x, y: s[2].y },
    { id: 'hub', x: s[4].x, y: s[4].y },
  ] };
}

function row(r) {
  const d = r.hero.vMed - r.lit.vMed;
  const shd = r.shaded && r.shaded.n ? r.shaded.vMed.toFixed(3) : ' n/a ';
  const tmp = r.tempSplit === null ? 'n/a' : `${r.tempSplit >= 0 ? '+' : ''}${r.tempSplit.toFixed(1)}`;
  return `hero ${r.hero.vMed.toFixed(3)} (pct ${String(r.heroPct.toFixed(1)).padStart(4)})  ground ${r.flat.vMed.toFixed(3)}`
    + `  lit ${r.lit.vMed.toFixed(3)}  shd ${shd}  frame ${r.frame.vMed.toFixed(3)}`
    + `  dHeroGround ${d >= 0 ? '+' : ''}${d.toFixed(3)}  temp ${tmp}`;
}

/**
 * ⚠️ `allowNoShadow` exists because the guard above FIRED on the first sweep, correctly:
 * an ablation row with `keyInt: 0` has no cast shadow, so the shaded set is EMPTY and
 * `tempSplit` is a difference against nothing. That is exactly `CLAUDE.md` rule 6's
 * vacuity class — a fix (here, an ablation) emptying the set an assertion runs over — so
 * the answer is NOT to widen the guard. The row is kept, `tempSplit` is reported as
 * `null` and prints as `n/a`, and the guard stays FATAL on any shipped frame, where a
 * missing cast shadow would mean the key had stopped casting.
 */
function derive(m, allowNoShadow) {
  requireMask('hero', m.hero); requireMask('flat', m.flat);
  requireMask('lit', m.lit); requireMask('frame', m.frame);
  if (!allowNoShadow) requireMask('shaded', m.shaded);
  const shaded = m.shaded && m.shaded.n ? m.shaded : null;
  return {
    ...m,
    heroPct: M.plPct(m.frame.hist, m.hero.vMed),
    dHeroFrame: m.hero.vMed - m.frame.vMed,
    dHeroGround: m.hero.vMed - m.lit.vMed,
    dHeroAllGround: m.hero.vMed - m.flat.vMed,
    tempSplit: shaded ? m.lit.rb - shaded.rb : null,
  };
}

/** Histograms are 256 numbers per mask and five masks per row — drop them from the JSON. */
function slim(m) {
  const o = { ...m };
  for (const k of ['hero', 'flat', 'lit', 'shaded', 'frame']) if (o[k]) o[k] = { ...o[k], hist: undefined };
  if (o.band) o.band = { ...o.band };
  return o;
}

async function modeFrame() {
  const { fog, list } = await stations();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    for (const st of list) {
      const page = await newPage(browser, 1600, 900);
      await bootMatch(page, BASE, { px: st.x, py: st.y, fog, player: PLAYER, fighters: NFIGHT || 0 });
      const drift = await driftControl(page, st.id);
      const raw = await page.evaluate(`window.__plMeasure(${Y0}, ${Y1})`);
      if (!subjectOk(raw)) {
        throw new Error(`${st.id}: SUBJECT NOT IN SHOT — hero ${raw.n.hero} px, floor ${raw.n.flat} px `
          + `(${raw.n.heroMeshes} hero meshes, ${raw.n.flatMeshes} flat meshes). Refusing to report a photograph of the floor.`);
      }
      if (!(raw.restore.mean === 0 && raw.restore.max === 0)) {
        throw new Error(`${st.id}: the ablation did NOT restore the frame (mean ${raw.restore.mean}, max ${raw.restore.max}) — every mask below was taken against a moving target`);
      }
      const r = derive(raw);
      await page.screenshot({ path: `${OUT}/${LABEL}_${st.id}_58.png` });
      console.log(`  ${st.id.padEnd(9)} ${row(r)}`);
      console.log(`  ${''.padEnd(9)} px hero ${r.n.hero} flat ${r.n.flat} lit ${r.n.lit} shadow ${r.n.shadow}`
        + `   rb lit ${r.lit.rb.toFixed(1)} shd ${r.shaded.rb.toFixed(1)}`
        + `   clipR lit ${(100 * r.lit.clipR).toFixed(2)}% hero ${(100 * r.hero.clipR).toFixed(2)}%`
        + `   vP10 ${r.band.vP10.toFixed(3)} <V.45 ${(100 * r.band.belowV45).toFixed(2)}%`
        + `   meanS ${r.band.meanSat.toFixed(3)} meanC ${r.band.meanChroma.toFixed(3)}  draws ${r.counts.draws}`);
      rows.push({ station: st.id, drift, ...slim(r) });
      await page.close();
    }
  } finally { await browser.close(); }
  if (!rows.length) throw new Error('no station produced a row — vacuous');
  await writeFile(`${OUT}/polar_${LABEL}.json`, JSON.stringify({ mode: 'frame', label: LABEL, base: BASE, player: PLAYER, rows }, null, 1));
  console.log(`wrote ${OUT}/polar_${LABEL}.json`);
  return rows;
}

async function modeSweep() {
  const rigsPath = get('--rigs', null);
  if (!rigsPath) throw new Error('--mode sweep needs --rigs <json>');
  const RIGS = JSON.parse(await readFile(rigsPath, 'utf8'));
  if (!Array.isArray(RIGS) || !RIGS.length) throw new Error(`${rigsPath}: empty rig list — vacuous`);
  const stationId = get('--station', 'hub');
  const { fog, list } = await stations();
  const st = list.find((s) => s.id === stationId);
  if (!st) throw new Error(`no station '${stationId}' in ${list.map((s) => s.id).join(',')}`);
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    const page = await newPage(browser, 1600, 900);
    await bootMatch(page, BASE, { px: st.x, py: st.y, fog, player: PLAYER, fighters: NFIGHT || 0 });
    const drift0 = await driftControl(page, `${stationId} open`);
    for (const cfg of RIGS) {
      const applied = await page.evaluate(`window.__plApply(${JSON.stringify(cfg)})`);
      const raw = await page.evaluate(`window.__plMeasure(${Y0}, ${Y1})`);
      if (!subjectOk(raw)) throw new Error(`${cfg.id}: SUBJECT NOT IN SHOT (hero ${raw.n.hero} px)`);
      if (!(raw.restore.mean === 0 && raw.restore.max === 0)) throw new Error(`${cfg.id}: ablation did not restore the frame`);
      const r = derive(raw, true);
      await page.screenshot({ path: `${OUT}/${LABEL}_${stationId}_${cfg.id}.png` });
      console.log(`  ${String(cfg.id).padEnd(16)} ${row(r)}`);
      console.log(`  ${''.padEnd(16)} vP10 ${r.band.vP10.toFixed(3)}  <V.45 ${(100 * r.band.belowV45).toFixed(2)}%`
        + `  meanS ${r.band.meanSat.toFixed(3)}  meanC ${r.band.meanChroma.toFixed(3)}  meanL ${r.band.meanLuma.toFixed(3)}`
        + `  clipR lit ${(100 * r.lit.clipR).toFixed(2)}%  rb lit ${r.lit.rb.toFixed(1)}`
        + `  shd ${r.shaded && r.shaded.n ? r.shaded.rb.toFixed(1) : 'n/a'}  shdPx ${r.n.shadow}`);
      rows.push({ ...cfg, applied, ...slim(r) });
    }
    // The CLOSING control: revert to shipped and require the very first row's frame back.
    await page.evaluate('window.__plApply({})');
    const driftZ = await driftControl(page, `${stationId} close`);
    rows.push({ id: '__close', drift: driftZ });
    if (!drift0.ok || !driftZ.ok) throw new Error('the sweep opened or closed on a drifting frame');
    await page.close();
  } finally { await browser.close(); }
  await writeFile(`${OUT}/sweep_${LABEL}_${stationId}.json`, JSON.stringify({ mode: 'sweep', station: stationId, base: BASE, rows }, null, 1));
  console.log(`wrote ${OUT}/sweep_${LABEL}_${stationId}.json`);
  return rows;
}

async function modeLobby() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let out = null;
  try {
    const page = await newPage(browser, 1300, 740);
    await page.goto(`${BASE}/?screen=characters`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForFunction("window.__screenReady === true && window.__screen === 'characters'", null, { timeout: 90_000 });
    await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      for (const an of document.getAnimations()) { try { an.pause(); an.currentTime = 0; } catch { /* ignore */ } }
      window.requestAnimationFrame = () => 0;
    });
    await page.waitForTimeout(250);
    // The lobby has no arena and no cast shadow to split, so this is the coverage half
    // only: hero vs everything else, on the charStage's own Stage.
    await page.evaluate(`${PL_MATH}
${DP_MATH}
window.__pl = (() => {
  const st = (window.__charStage && window.__charStage.stage) ? window.__charStage.stage : window.__stage;
  if (!st) throw new Error('no char Stage');
  const gl = st.renderer.getContext(), cv = st.renderer.domElement;
  const W = cv.width, H = cv.height;
  st.renderer.info.autoReset = false;
  const read = () => { const p = new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p); return p; };
  const shot = () => { st.renderer.info.reset(); st.render(1/60); return read(); };
  const counts = () => { st.renderer.info.reset(); st.render(1/60); const r = st.renderer.info.render; return { draws: r.calls, tris: r.triangles }; };
  const hero = [];
  st.scene.traverse((o) => { if (!o.isMesh) return; let n = o, l = ''; while (n) { if (n.name) l = n.name; n = n.parent; }
    if (l.indexOf('character:') === 0) hero.push(o.uuid); });
  const setVis = (uuids, v) => { const s = new Set(uuids); let n = 0;
    st.scene.traverse((o) => { if (s.has(o.uuid)) { o.visible = v; n++; } }); st.markShadowsDirty(); return n; };
  return { st, W, H, read, shot, counts, hero, setVis, diff: dpDiff, band: dpBand,
    plDiff: plDiff, plStats: plStats, plPct: plPct, plAndNot: plAndNot };
})();`);
    const drift = await driftControl(page, 'lobby');
    const raw = await page.evaluate(`(() => {
      const p = window.__pl, W = p.W, H = p.H;
      const A = p.shot();
      p.setVis(p.hero, false);
      const B = p.shot();
      p.setVis(p.hero, true);
      const mHero = p.plDiff(A, B, W, H, 8);
      const mRest = p.plAndNot(new Uint8Array(W*H).fill(1), mHero.m, W, H);
      const A3 = p.shot();
      return { W: W, H: H, hero: p.plStats(A, mHero.m, W, H), rest: p.plStats(A, mRest.m, W, H),
        frame: p.plStats(A, null, W, H), band: p.band(A, W, H, ${Y0}, ${Y1}, true),
        counts: p.counts(), n: { hero: mHero.n, heroMeshes: p.hero.length },
        restore: p.diff(A, A3) };
    })()`);
    requireMask('lobby hero', raw.hero); requireMask('lobby rest', raw.rest);
    if (raw.n.hero < 200) throw new Error(`lobby: hero is ${raw.n.hero} px — not in shot`);
    if (!(raw.restore.mean === 0 && raw.restore.max === 0)) throw new Error('lobby: ablation did not restore the frame');
    const heroPct = M.plPct(raw.frame.hist, raw.hero.vMed);
    await page.screenshot({ path: `${OUT}/${LABEL}_lobby_20.png` });
    console.log(`  lobby ${raw.W}x${raw.H}  hero ${raw.n.hero} px of ${raw.W * raw.H}`);
    console.log(`  hero V ${raw.hero.vMed.toFixed(3)} (pct ${heroPct.toFixed(1)})  rest ${raw.rest.vMed.toFixed(3)}`
      + `  frame ${raw.frame.vMed.toFixed(3)}  dHeroRest ${(raw.hero.vMed - raw.rest.vMed >= 0 ? '+' : '')}${(raw.hero.vMed - raw.rest.vMed).toFixed(3)}`);
    console.log(`  band vP10 ${raw.band.vP10.toFixed(3)}  <V.45 ${(100 * raw.band.belowV45).toFixed(2)}%`
      + `  meanS ${raw.band.meanSat.toFixed(3)}  meanC ${raw.band.meanChroma.toFixed(3)}  draws ${raw.counts.draws}`);
    out = { drift, heroPct, dHeroRest: raw.hero.vMed - raw.rest.vMed, ...slim(raw) };
    await page.close();
  } finally { await browser.close(); }
  await writeFile(`${OUT}/lobby_${LABEL}.json`, JSON.stringify({ mode: 'lobby', label: LABEL, ...out }, null, 1));
  console.log(`wrote ${OUT}/lobby_${LABEL}.json`);
  return out;
}

/**
 * `--mode ablate` — what the contact AO actually darkens, split by mask, plus the
 * amplified delta written as a PNG so rule 3 can be applied to it. `--ao k=v,k=v`
 * overrides the effect live (intensity / radius / bias / range), so a candidate setting
 * is one page load rather than a rebuild.
 */
async function modeAblate() {
  const { fog, list } = await stations();
  const stationId = get('--station', 'hub');
  const st = list.find((s) => s.id === stationId);
  if (!st) throw new Error(`no station '${stationId}'`);
  const cfg = {};
  for (const kv of (get('--ao', '') || '').split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    cfg[k] = Number(v);
    if (!Number.isFinite(cfg[k])) throw new Error(`--ao ${kv}: not a number`);
  }
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let out = null;
  try {
    const page = await newPage(browser, 1600, 900);
    await bootMatch(page, BASE, { px: st.x, py: st.y, fog, player: PLAYER, fighters: NFIGHT || 0 });
    const drift = await driftControl(page, stationId);
    // ── the range sweep, all rows inside ONE page load so no row can be content drift
    const sweep = (get('--ao-sweep', '') || '').split(',').filter(Boolean).map(Number);
    if (sweep.length) {
      const rows = [];
      for (const rr of sweep) {
        if (!Number.isFinite(rr)) throw new Error(`--ao-sweep: ${rr} is not a number`);
        const q = await page.evaluate(`window.__plAblate(${JSON.stringify({ ...cfg, range: rr })})`);
        requireMask('hero', q.hero); requireMask('flat', q.flat);
        if (!(q.restore.mean === 0 && q.restore.max === 0)) throw new Error(`range ${rr}: AO restore not bit-identical`);
        const m = await page.evaluate(`window.__plMeasure(${Y0}, ${Y1})`);
        const d = derive(m, true);
        const { W, H } = q;
        const px = Buffer.alloc(W * H * 3);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const src = ((H - 1 - y) * W + x) * 4, dst = (y * W + x) * 3;
          const la = 0.2126 * q.A[src] + 0.7152 * q.A[src + 1] + 0.0722 * q.A[src + 2];
          const lb = 0.2126 * q.B[src] + 0.7152 * q.B[src + 1] + 0.0722 * q.B[src + 2];
          const v = Math.max(0, Math.min(255, (lb - la) * 6));
          px[dst] = v; px[dst + 1] = v; px[dst + 2] = v;
        }
        const sh = (await import('sharp')).default;
        await sh(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${OUT}/${LABEL}_${stationId}_r${rr}_delta.png`);
        await page.screenshot({ path: `${OUT}/${LABEL}_${stationId}_r${rr}.png` });
        requireMask('contact', q.contact); requireMask('bleed', q.bleed);
        console.log(`  range ${String(rr).padEnd(6)} CONTACT ${q.contact.dMean.toFixed(3)} (${q.n.near} px)`
          + `   bleed ${q.bleed.dMean.toFixed(3)} (${q.n.far} px)   hero ${q.hero.dMean.toFixed(2)}`
          + `   frame ${q.all.dMean.toFixed(3)}`
          + `  | dHG ${d.dHeroGround >= 0 ? '+' : ''}${d.dHeroGround.toFixed(3)} heroV ${d.hero.vMed.toFixed(3)} litV ${d.lit.vMed.toFixed(3)}`
          + `  vP10 ${d.band.vP10.toFixed(3)} <V.45 ${(100 * d.band.belowV45).toFixed(2)}% meanC ${d.band.meanChroma.toFixed(3)}`);
        rows.push({ range: rr, hero: q.hero, flat: q.flat, all: q.all, other: q.other,
          contact: q.contact, bleed: q.bleed, nNear: q.n.near, nFar: q.n.far,
          heroV: d.hero.vMed, litV: d.lit.vMed, dHeroGround: d.dHeroGround, heroPct: d.heroPct,
          band: d.band, draws: d.counts.draws });
      }
      await page.close();
      await writeFile(`${OUT}/aosweep_${LABEL}_${stationId}.json`, JSON.stringify({ station: stationId, drift, rows }, null, 1));
      console.log(`wrote ${OUT}/aosweep_${LABEL}_${stationId}.json`);
      return rows;
    }
    const r = await page.evaluate(`window.__plAblate(${JSON.stringify(cfg)})`);
    requireMask('hero', r.hero); requireMask('flat', r.flat); requireMask('other', r.other);
    if (r.n.hero < 200) throw new Error(`${stationId}: hero is ${r.n.hero} px — not in shot`);
    if (!(r.restore.mean === 0 && r.restore.max === 0)) throw new Error('AO restore was not bit-identical');
    if (!(r.restore2.mean === 0 && r.restore2.max === 0)) throw new Error('mask ablation did not restore the frame');
    if (r.all.dMean <= 0) throw new Error(`the AO darkens NOTHING (dMean ${r.all.dMean}) — a vacuous ablation`);
    // ── the delta, amplified 6x and written top-down, so it can be LOOKED AT ──
    const { W, H } = r;
    const px = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const src = ((H - 1 - y) * W + x) * 4, dst = (y * W + x) * 3;
      const la = 0.2126 * r.A[src] + 0.7152 * r.A[src + 1] + 0.0722 * r.A[src + 2];
      const lb = 0.2126 * r.B[src] + 0.7152 * r.B[src + 1] + 0.0722 * r.B[src + 2];
      const d = Math.max(0, Math.min(255, (lb - la) * 6));
      px[dst] = d; px[dst + 1] = d; px[dst + 2] = d;
    }
    const sharp = (await import('sharp')).default;
    await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${OUT}/${LABEL}_${stationId}_aodelta.png`);
    await page.screenshot({ path: `${OUT}/${LABEL}_${stationId}_ao.png` });
    requireMask('contact', r.contact); requireMask('bleed', r.bleed);
    const f = (s2) => `dMean ${s2.dMean.toFixed(3)}  >2/255 ${(100 * s2.share).toFixed(2)}%  dMax ${s2.dMax.toFixed(1)}  (${s2.n} px)`;
    console.log(`  ao ${JSON.stringify({ ...r.ship, ...cfg })}`);
    console.log(`  whole frame  ${f(r.all)}`);
    console.log(`  HERO         ${f(r.hero)}`);
    console.log(`  ground       ${f(r.flat)}`);
    console.log(`   contact <=${r.band}px  ${f(r.contact)}`);
    console.log(`   bleed    >${r.band}px  ${f(r.bleed)}`);
    console.log(`  everything else ${f(r.other)}`);
    out = { station: stationId, drift, ship: r.ship, cfg, band: r.band, all: r.all, hero: r.hero,
      flat: r.flat, contact: r.contact, bleed: r.bleed, other: r.other, n: r.n };
    await page.close();
  } finally { await browser.close(); }
  await writeFile(`${OUT}/ablate_${LABEL}_${stationId}.json`, JSON.stringify(out, null, 1));
  console.log(`wrote ${OUT}/ablate_${LABEL}_${stationId}.json`);
  return out;
}

async function modeBlob() {
  const { fog, list } = await stations();
  const ring = Number(get('--ring', 70));
  if (!Number.isFinite(ring) || ring < 1) throw new Error('--ring must be a positive number of pixels');
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    for (const st of list) {
      const page = await newPage(browser, 1600, 900);
      await bootMatch(page, BASE, { px: st.x, py: st.y, fog, player: PLAYER, fighters: NFIGHT || 0 });
      const drift = await driftControl(page, st.id);
      const r = await page.evaluate(`window.__plBlob(${ring})`);
      requireMask('ring', r.ringV); requireMask('rest', r.restV); requireMask('hero', r.heroV);
      if (r.n.hero < 200) throw new Error(`${st.id}: hero ${r.n.hero} px — not in shot`);
      if (r.n.ring < 500) throw new Error(`${st.id}: ring is ${r.n.ring} px — too small to report over`);
      if (!(r.restore.mean === 0 && r.restore.max === 0)) throw new Error(`${st.id}: layer ablation did not restore`);
      if (!(r.restore2.mean === 0 && r.restore2.max === 0)) throw new Error(`${st.id}: mask ablation did not restore`);
      if (!(r.allOff.dMean > 0)) throw new Error(`${st.id}: turning ALL THREE off darkens nothing — vacuous`);
      // 🚨 the arm that was vacuous the first time round. Stage.updateContactShadows()
      // re-shows every decal CHILD inside render(), so an ablation aimed at the meshes
      // is undone before the frame is drawn and reports a clean 0.00.
      if (!r.decalStuck) {
        throw new Error(`${st.id}: the DECAL ablation did not stick — render() put it back `
          + `(${r.decalMeshes} nodes targeted). Any 0.00 below would be a vacuous arm, not a finding.`);
      }
      const sum = r.ao.dMean + r.decal.dMean + r.cast.dMean;
      const f = (x) => `${x.dMean.toFixed(2)} (>2 ${(100 * x.share).toFixed(0)}%, max ${x.dMax.toFixed(0)})`;
      console.log(`  ${st.id.padEnd(9)} ring ${r.n.ring} px @${ring}px   V: ring ${r.ringV.vMed.toFixed(3)}  rest-of-ground ${r.restV.vMed.toFixed(3)}  hero ${r.heroV.vMed.toFixed(3)}`);
      console.log(`  ${''.padEnd(9)} AO ${f(r.ao)}   decal ${f(r.decal)}   cast ${f(r.cast)}`
        + `   |  sum ${sum.toFixed(2)}  all-off ${r.allOff.dMean.toFixed(2)}  double-counted ${(sum - r.allOff.dMean).toFixed(2)}`);
      await page.screenshot({ path: `${OUT}/${LABEL}_${st.id}_blob.png` });
      rows.push({ station: st.id, ring, drift, ...r,
        ringV: { ...r.ringV, hist: undefined }, restV: { ...r.restV, hist: undefined }, heroV: { ...r.heroV, hist: undefined } });
      await page.close();
    }
  } finally { await browser.close(); }
  if (!rows.length) throw new Error('no station produced a row — vacuous');
  await writeFile(`${OUT}/blob_${LABEL}.json`, JSON.stringify({ mode: 'blob', label: LABEL, rows }, null, 1));
  console.log(`wrote ${OUT}/blob_${LABEL}.json`);
  return rows;
}

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) {
  if (has('--selftest')) process.exitCode = selftest() ? 0 : 1;
  else if (MODE === 'sweep') await modeSweep();
  else if (MODE === 'lobby') await modeLobby();
  else if (MODE === 'ablate') await modeAblate();
  else if (MODE === 'blob') await modeBlob();
  else await modeFrame();
}

export { M, PL_MATH, selftest, requireMask, subjectOk };
