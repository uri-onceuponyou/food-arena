#!/usr/bin/env node
/**
 * DP_DARK — the DARK TAIL of the frame, ours against the six gameplay plates.
 *
 * Uri, item 4: *"Everything is lit at uniform intensity with no sense of depth or weight.
 * Add ambient occlusion so objects darken where they meet the floor and where surfaces
 * meet. Set up warm/cool lighting contrast rather than a single flat light. Add a subtle
 * vignette. Keep the toon/cel look."*
 *
 * `tools/tmp/lc_probe.mjs` already answered *"is any of it configured, and does it reach
 * the frame"* — all three do, and it published the ablation table. This tool answers the
 * only question that was left: **HOW FAR from the plates is our dark end, and did a change
 * close it without spending the chroma another track just bought.**
 *
 * ── WHAT IT MEASURES, AND WHY THESE AND NOT "CONTRAST" ──────────────────────────────
 *
 * The rival hypothesis *"the ground is flat in value"* was tested and is FALSE — low-
 * frequency V sd sits inside the plate band. The deficit is specifically the **dark TAIL**,
 * so the statistics are tail statistics and not spread statistics:
 *
 *   vP10 / vP05     percentiles of HSV **V** (the max channel), 0..1.
 *   belowV45        share of pixels with V < 0.45.
 *   lumaP10         the same tail read on Rec.709 luma, because the grade's shadow toe is
 *                   driven by LUMA and V and luma diverge on saturated colour — a
 *                   saturated dark red sits at luma 0.20 with V 0.47. Reporting only one
 *                   would make a toe look bigger or smaller than it is.
 *   meanSat/meanChroma/meanLuma   the GUARD RAILS, not the target. `CLAUDE.md` records
 *                   desaturating as falsified five times, and `4c35bac` had just taken
 *                   frame median S into a plate band we were below all six of. A dark-tail
 *                   change that pays for itself in chroma is a REGRESSION, and these are
 *                   the three numbers that can say so.
 *   tempSpread      mean (R-B) of the top luma decile minus the bottom, display-encoded
 *                   0-255. Warm/cool CONTRAST is a correlation between value and hue, not
 *                   a colour: one flat white light scores ~0 by construction. Same
 *                   definition as `lc_probe`'s so the two are comparable.
 *
 * ── THE BAND ────────────────────────────────────────────────────────────────────────
 *
 * `y ∈ [0.35, 0.62]`, full width — the HUD-free centre band `v2_band.mjs` established, so
 * ours and the plates are cropped by one rule. Our own read is off the **GL drawing
 * buffer**, which the DOM HUD never touches, so for us the crop is about matching the
 * plates rather than about hiding a HUD.
 *
 * 🚨 **THE GL BUFFER IS BOTTOM-UP AND A PNG IS TOP-DOWN, AND THIS BAND IS NOT SYMMETRIC
 * ABOUT 0.5.** [0.35, 0.62] read without a flip is [0.38, 0.65] of the screen — a 3%-of-
 * height shift, downward, on every live capture and on none of the plates. `--selftest` §D
 * asserts the flip CHANGES the answer on an asymmetric test frame (a flag that changes
 * nothing is a comment) and that each direction matches its own closed form.
 *
 * ── INSTRUMENT VALIDATION (CLAUDE.md rule 6) ────────────────────────────────────────
 *
 *   §A percentiles against a closed form on a synthetic ramp, AND a known-bad that puts
 *      the answer off by a bin.
 *   §B belowV45 against a frame built with EXACTLY 20% of its pixels below the threshold,
 *      plus the vacuous arm: an all-bright frame must read 0.0000 and NOT null.
 *   §C the window rows, and `y0 >= y1` must give n === 0 rather than a wrapped band.
 *   §D the flip (above).
 *   §E the GUARD RAIL must be able to FAIL: a deliberately desaturated copy of a frame has
 *      to read lower meanSat/meanChroma. A rail nobody has seen go red is not a rail.
 *   §F tempSpread must be ~0 on a frame lit by one flat grey and clearly positive on a
 *      frame whose bright pixels are warm — sign AND magnitude, not just non-null.
 *
 * Every filtered set is asserted NON-EMPTY before anything is asserted over it, and the
 * live capture asserts the SUBJECT IS IN FRAME (`[].every()` is `true`, and one instrument
 * here photographed the sky and reported PASS).
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/dp_dark.mjs --selftest                 # no browser, no server
 *   node tools/tmp/dp_dark.mjs --mode plates              # reference/, no server
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-dp-A -- \
 *     node tools/tmp/dp_dark.mjs --mode frame --url '{URL}' --label before --out tools/tmp/dp_A
 *   ... --mode lobby     # the charStage camera, pitch 20 — the OTHER detector
 *
 * ⚠️ Camera shake re-randomises on every `render()` even at dt=0; CSS animations run on the
 * document timeline, not rAF. Both are stilled before anything is read, and the drift
 * control is printed first — if it is not EXACTLY zero, nothing below it is a measurement.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// PURE MATH — ONE source, run BOTH node-side (plates, selftest) and inside the
// page (live frames). "The identical instrument" is then a fact about the source.
// ─────────────────────────────────────────────────────────────────────────────
const DP_MATH = String.raw`
/**
 * Tail + guard-rail statistics over a horizontal band of an RGBA buffer.
 *
 * y0/y1 are SCREEN-SPACE fractions, top-down. 'flipY' is true for a gl.readPixels
 * buffer (row 0 is the BOTTOM of the screen) and false for a decoded PNG.
 */
function dpBand(rgba, W, H, y0, y1, flipY) {
  if (!(y1 > y0)) return { n: 0, rows: [0, 0] };
  // Screen rows [r0, r1) -> buffer rows. On a flipped buffer the band mirrors about H/2.
  var s0 = Math.max(0, Math.round(y0 * H));
  var s1 = Math.min(H, Math.round(y1 * H));
  var r0 = flipY ? H - s1 : s0;
  var r1 = flipY ? H - s0 : s1;
  if (r1 <= r0) return { n: 0, rows: [r0, r1] };
  var n = 0, sSum = 0, cSum = 0, lSum = 0, l2Sum = 0, vSum = 0;
  var below45 = 0, below35 = 0;
  // 256-bin histograms are EXACT for V (V is a byte / 255), so vP10 has no interpolation
  // error at all. Luma is not a byte, so its histogram is 1024 bins and its percentile
  // carries at most 1/1024 of quantisation — stated rather than left implicit.
  var vH = new Float64Array(256), lH = new Float64Array(1024);
  // Per-pixel luma and R-B kept for the decile split (tempSpread needs a second pass).
  var lArr = new Float64Array((r1 - r0) * W), tArr = new Float64Array((r1 - r0) * W);
  for (var y = r0; y < r1; y++) {
    for (var x = 0; x < W; x++) {
      var i = (y * W + x) * 4;
      var r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      var V = mx / 255;
      var s = mx === 0 ? 0 : (mx - mn) / mx;
      var L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      vSum += V; sSum += s; cSum += (mx - mn) / 255; lSum += L; l2Sum += L * L;
      if (V < 0.45) below45++;
      if (V < 0.35) below35++;
      vH[mx]++;
      var lb = Math.floor(L * 1023.999); if (lb > 1023) lb = 1023; if (lb < 0) lb = 0;
      lH[lb]++;
      lArr[n] = L; tArr[n] = r - b;
      n++;
    }
  }
  if (n === 0) return { n: 0, rows: [r0, r1] };
  function pct(hist, bins, q) {
    var want = q * n, acc = 0;
    for (var k = 0; k < bins; k++) { acc += hist[k]; if (acc >= want) return k / (bins - 1); }
    return 1;
  }
  // tempSpread: sort by luma, take the mean (R-B) of the top and bottom deciles.
  var idx = new Int32Array(n); for (var j = 0; j < n; j++) idx[j] = j;
  var arr = Array.prototype.slice.call(idx);
  arr.sort(function (p, q2) { return lArr[p] - lArr[q2]; });
  var dec = Math.max(1, Math.floor(n / 10));
  var lo = 0, hi = 0;
  for (var k2 = 0; k2 < dec; k2++) { lo += tArr[arr[k2]]; hi += tArr[arr[n - 1 - k2]]; }
  return {
    n: n, rows: [r0, r1],
    vP05: pct(vH, 256, 0.05), vP10: pct(vH, 256, 0.10),
    vP25: pct(vH, 256, 0.25), vP50: pct(vH, 256, 0.50),
    lumaP05: pct(lH, 1024, 0.05), lumaP10: pct(lH, 1024, 0.10),
    belowV45: below45 / n, belowV35: below35 / n,
    meanV: vSum / n, meanSat: sSum / n, meanChroma: cSum / n, meanLuma: lSum / n,
    lumaSd: Math.sqrt(Math.max(l2Sum / n - (lSum / n) * (lSum / n), 0)),
    tempLo: lo / dec, tempHi: hi / dec, tempSpread: (hi - lo) / dec,
  };
}

/** Bit-difference between two equal-length RGBA buffers. The drift control. */
function dpDiff(A, B) {
  if (A.length !== B.length) return { mean: NaN, max: 255, pct: 100 };
  var s = 0, mx = 0, np = 0, hit = 0;
  for (var i = 0; i < A.length; i += 4) {
    var d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    s += d; if (d > mx) mx = d; if (d > 0) hit++; np++;
  }
  return { mean: s / np, max: mx, pct: (100 * hit) / np };
}
`;
// eslint-disable-next-line no-eval
const M = (0, eval)(`${DP_MATH}; ({ dpBand, dpDiff })`);

const Y0 = 0.35, Y1 = 0.62;

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — validates the LOGIC. ⚠️ It says nothing about where the tool is POINTED;
// the live modes carry their own subject-in-frame and non-empty assertions.
// ─────────────────────────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
function ok(name, cond, got) {
  if (cond) { PASS++; console.log(`  ✅ ${name}`); }
  else { FAIL++; console.log(`  🔴 ${name}${got !== undefined ? `  — ${got}` : ''}`); }
}
/** Build an RGBA buffer from a per-pixel callback. */
function frame(W, H, f) {
  const p = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = f(x, y); const i = (y * W + x) * 4;
    p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2]; p[i + 3] = 255;
  }
  return p;
}

function selftest() {
  console.log('── dp_dark --selftest ──\n');

  console.log('§A percentiles against a closed form');
  // Band covers the whole image so the window cannot confound this arm.
  {
    // V takes each byte value 0..199 with equal weight -> exact deciles.
    // ⚠️ 200 wide and not 250, so the +10 shift below cannot reach 256. Written at 250
    // first: `Uint8Array` assignment truncates mod 256, so four columns wrapped to 0..3,
    // the histogram gained four dark bins and vP10 moved by 6 codes instead of 10. The
    // arm caught its own fixture rather than the code, which is what it is for.
    const W = 200, H = 100;
    const f = frame(W, H, (x) => [x, x, x]);
    const b = M.dpBand(f, W, H, 0, 1, false);
    ok('band non-empty before anything is asserted over it', b.n === W * H, `n=${b.n}`);
    // 10% of 20000 = 2000 -> byte 19 is where the cumulative count first reaches it.
    ok('vP10 of a 0..199 uniform ramp is 19/255', Math.abs(b.vP10 - 19 / 255) < 1e-12, `got ${b.vP10 * 255}`);
    ok('vP50 of the same ramp is 99/255', Math.abs(b.vP50 - 99 / 255) < 1e-12, `got ${b.vP50 * 255}`);
    // KNOWN-BAD: shift every pixel up by 10 codes and the answer MUST move by 10 codes.
    const g = frame(W, H, (x) => [x + 10, x + 10, x + 10]);
    const b2 = M.dpBand(g, W, H, 0, 1, false);
    ok('§A-bad a +10-code shift moves vP10 by exactly 10 codes',
      Math.abs(b2.vP10 - b.vP10 - 10 / 255) < 1e-12, `got ${((b2.vP10 - b.vP10) * 255).toFixed(2)}`);
  }

  console.log('\n§B belowV45 — the headline share, and its vacuous arm');
  {
    const W = 100, H = 100;
    // Exactly 20% of rows at V = 0.20, the rest at V = 0.90.
    const f = frame(W, H, (x, y) => (y < 20 ? [51, 51, 51] : [230, 230, 230]));
    const b = M.dpBand(f, W, H, 0, 1, false);
    ok('belowV45 reads EXACTLY 0.2000 on a frame built to be 20% dark',
      Math.abs(b.belowV45 - 0.2) < 1e-12, `got ${b.belowV45}`);
    // ⚠️ THE VACUOUS ARM. An all-bright frame must read 0, not null — `null` formats as a
    // blank and reads like a small number, which is how a dead metric survives a review.
    const bright = frame(W, H, () => [230, 230, 230]);
    const b2 = M.dpBand(bright, W, H, 0, 1, false);
    ok('§B-vac an all-bright frame reads 0.0000 and is a NUMBER, not null',
      b2.belowV45 === 0 && typeof b2.belowV45 === 'number', `got ${b2.belowV45}`);
    // And the threshold is where it says it is: 114/255 = 0.4471 < 0.45, 115/255 = 0.4510.
    const edge = frame(W, H, (x, y) => (y < 50 ? [114, 114, 114] : [115, 115, 115]));
    const b3 = M.dpBand(edge, W, H, 0, 1, false);
    ok('§B-edge the 0.45 threshold splits 114 from 115', Math.abs(b3.belowV45 - 0.5) < 1e-12, `got ${b3.belowV45}`);
  }

  console.log('\n§C the window, and the vacuity guard');
  {
    const W = 4, H = 900;
    const f = frame(W, H, () => [128, 128, 128]);
    const b = M.dpBand(f, W, H, 0.35, 0.62, false);
    ok('900 rows, [0.35,0.62] -> buffer rows [315,558]', b.rows[0] === 315 && b.rows[1] === 558, JSON.stringify(b.rows));
    ok('n === (558-315)*4', b.n === (558 - 315) * 4, `n=${b.n}`);
    const inv = M.dpBand(f, W, H, 0.62, 0.35, false);
    ok('§C-bad y0 > y1 gives n === 0 rather than a wrapped band', inv.n === 0, `n=${inv.n}`);
    const eq = M.dpBand(f, W, H, 0.5, 0.5, false);
    ok('§C-bad y0 === y1 gives n === 0', eq.n === 0, `n=${eq.n}`);
  }

  console.log('\n§D the flip — a flag that changes nothing is a comment');
  {
    // Top 40% of the SCREEN black, bottom 60% white. Read top-down, the [0.35,0.62] band
    // straddles the join; read as a bottom-up buffer it must land somewhere different.
    const W = 8, H = 1000;
    const f = frame(W, H, (x, y) => (y < 400 ? [0, 0, 0] : [255, 255, 255]));
    const top = M.dpBand(f, W, H, Y0, Y1, false);
    const flip = M.dpBand(f, W, H, Y0, Y1, true);
    ok('§D top-down band rows [350,620]', top.rows[0] === 350 && top.rows[1] === 620, JSON.stringify(top.rows));
    ok('§D flipped band rows [380,650] — mirrored about H/2', flip.rows[0] === 380 && flip.rows[1] === 650, JSON.stringify(flip.rows));
    // Closed form: top-down band [350,620) has 50 black rows of 270 -> 0.1852 below V45.
    ok('§D top-down belowV45 === 50/270', Math.abs(top.belowV45 - 50 / 270) < 1e-12, `got ${top.belowV45}`);
    // Flipped band [380,650) of the BUFFER: buffer row r is screen row H-1-r, so buffer
    // rows 380..599 are screen rows 400..619 (white) and 600..649 are screen 350..399
    // (black) -> 50 black of 270 as well. Equal by construction here, so this arm cannot
    // be the one that proves the flag does something — the ROWS above are.
    ok('§D-bad the two directions select DIFFERENT rows', top.rows[0] !== flip.rows[0], 'identical rows');
    // A second, asymmetric frame where the VALUES also differ, so the arm is not resting
    // on the row indices alone.
    const g = frame(W, H, (x, y) => (y < 500 ? [0, 0, 0] : [255, 255, 255]));
    const t2 = M.dpBand(g, W, H, Y0, Y1, false), f2 = M.dpBand(g, W, H, Y0, Y1, true);
    ok('§D-bad2 an asymmetric frame reads DIFFERENT belowV45 flipped vs not',
      Math.abs(t2.belowV45 - f2.belowV45) > 1e-6, `${t2.belowV45} vs ${f2.belowV45}`);
  }

  console.log('\n§E the GUARD RAILS must be able to go RED');
  {
    const W = 64, H = 64;
    const base = frame(W, H, (x, y) => [200, 80 + (y % 40), 40]);
    const b = M.dpBand(base, W, H, 0, 1, false);
    // Desaturate toward luma by 50% — the exact move `CLAUDE.md` says is falsified five
    // times. If the rails cannot see it, they are decoration.
    const desat = frame(W, H, (x, y) => {
      const r = 200, g = 80 + (y % 40), bl = 40;
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      return [Math.round(L + 0.5 * (r - L)), Math.round(L + 0.5 * (g - L)), Math.round(L + 0.5 * (bl - L))];
    });
    const d = M.dpBand(desat, W, H, 0, 1, false);
    ok('§E meanSat FALLS on a 50% desaturated copy', d.meanSat < b.meanSat - 0.05, `${b.meanSat.toFixed(4)} -> ${d.meanSat.toFixed(4)}`);
    ok('§E meanChroma FALLS on the same copy', d.meanChroma < b.meanChroma - 0.05, `${b.meanChroma.toFixed(4)} -> ${d.meanChroma.toFixed(4)}`);
    ok('§E meanLuma is ~unchanged (it was a chroma move, not a value move)',
      Math.abs(d.meanLuma - b.meanLuma) < 0.01, `${b.meanLuma.toFixed(4)} -> ${d.meanLuma.toFixed(4)}`);
  }

  console.log('\n§F tempSpread — sign AND magnitude');
  {
    const W = 64, H = 64;
    // One flat grey light: every pixel neutral, brightness varies. Spread must be ~0.
    const flat = frame(W, H, (x, y) => { const v = 40 + (y * 3); return [v, v, v]; });
    const bf = M.dpBand(flat, W, H, 0, 1, false);
    ok('a neutral value ramp scores tempSpread ~0', Math.abs(bf.tempSpread) < 1e-9, `got ${bf.tempSpread}`);
    // Warm key / cool shade: bright pixels warm (R>B), dark pixels cool (B>R).
    const warm = frame(W, H, (x, y) => (y < 32 ? [40, 45, 90] : [230, 200, 150]));
    const bw = M.dpBand(warm, W, H, 0, 1, false);
    ok('warm highlights over cool shade score STRONGLY POSITIVE',
      bw.tempSpread > 100, `got ${bw.tempSpread.toFixed(1)}`);
    // §F-bad: invert the CORRELATION — bright pixels cool, dark pixels warm — and the sign
    // must flip. A magnitude-only check would pass on a rig with the temperatures
    // backwards, which is exactly the defect being looked for.
    // ⚠️ The first version of this arm merely swapped which ROWS held which colour, and
    // read +130.0 — identical to the positive arm, because the warm colour is the brighter
    // one wherever you put it. tempSpread is a correlation between VALUE and hue and is
    // deliberately blind to position; the fixture has to change the value ordering.
    const cold = frame(W, H, (x, y) => (y < 32 ? [150, 200, 230] : [90, 45, 40]));
    const bc = M.dpBand(cold, W, H, 0, 1, false);
    ok('§F-bad a COOL-highlight / WARM-shade frame inverts the sign', bc.tempSpread < -100, `got ${bc.tempSpread.toFixed(1)}`);
  }

  console.log('\n§G the drift control itself');
  {
    const W = 16, H = 16;
    const a = frame(W, H, (x, y) => [x * 4, y * 4, 128]);
    const b = frame(W, H, (x, y) => [x * 4, y * 4, 128]);
    const same = M.dpDiff(a, b);
    ok('identical buffers diff to EXACTLY zero', same.mean === 0 && same.max === 0, JSON.stringify(same));
    const c = frame(W, H, (x, y) => [x * 4, y * 4, x === 0 && y === 0 ? 129 : 128]);
    const one = M.dpDiff(a, c);
    ok('§G-bad ONE pixel off by ONE code is detected', one.max === 1 && one.pct > 0, JSON.stringify(one));
  }

  console.log(`\n── ${PASS} passed, ${FAIL} failed ──`);
  return FAIL === 0;
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

const PAGE_SRC = `${DP_MATH}
window.__dp = (() => {
  const st = window.__stage;
  if (!st) throw new Error('no Stage on this route');
  if (st.disposed) throw new Error('window.__stage is a DISPOSED Stage');
  const gl = st.renderer.getContext();
  const cv = st.renderer.domElement;
  const W = cv.width, H = cv.height;
  st.renderer.info.autoReset = false;
  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  const shot = () => { st.renderer.info.reset(); st.render(1 / 60); return read(); };
  const counts = () => { st.renderer.info.reset(); st.render(1 / 60); const r = st.renderer.info.render;
    return { draws: r.calls, tris: r.triangles }; };
  const fx = () => (st.composer ? st.composer.passes.flatMap((p) => p.effects || []) : []);
  return { st, W, H, read, shot, counts, fx, band: dpBand, diff: dpDiff };
})();
`;

async function bootMatch(page, base, { tier, fighters, px, py, fog, player = 'hamburger', enemy = 'donut' }) {
  const q = new URLSearchParams();
  if (fighters) q.set('fighters', String(fighters));
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

/** Two identical renders must be bit-identical, or nothing below is a measurement. */
async function driftControl(page, label) {
  const d = await page.evaluate(() => {
    const A = window.__dp.shot(), B = window.__dp.shot();
    return window.__dp.diff(A, B);
  });
  const okd = d.mean === 0 && d.max === 0;
  console.log(`  drift [${label}] mean ${d.mean.toFixed(6)} max ${d.max} pct ${d.pct.toFixed(4)}%  `
    + (okd ? '✅ EXACTLY ZERO' : '🔴 DRIFTS — nothing below is trustworthy'));
  return { ...d, ok: okd };
}

/** A probe that photographs the sky reports PASS. Assert the subject is in shot. */
async function subjectInFrame(page) {
  return page.evaluate(() => {
    const st = window.__dp.st;
    const cam = st.rig.camera;
    const pts = [];
    st.scene.traverse((o) => {
      if ((o.name || '') === 'contact:decal' && o.visible) {
        const v = o.getWorldPosition(new o.position.constructor());
        v.project(cam);
        pts.push({ x: v.x * 0.5 + 0.5, y: v.y * 0.5 + 0.5, z: v.z });
      }
    });
    return { decals: pts.length, inFrame: pts.filter((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1 && p.z < 1).length };
  });
}

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const BASE = (get('--url', null) ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = get('--out', 'tools/tmp/dp_out');
const LABEL = get('--label', 'run');
const MODE = get('--mode', 'frame');
const NFIGHT = Number(get('--fighters', 0));

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

function fmt(b) {
  return `vP10 ${b.vP10.toFixed(3)}  <V.45 ${(100 * b.belowV45).toFixed(2)}%  vP05 ${b.vP05.toFixed(3)}`
    + `  lumaP10 ${b.lumaP10.toFixed(3)}  meanL ${b.meanLuma.toFixed(3)}`
    + `  meanS ${b.meanSat.toFixed(3)}  meanC ${b.meanChroma.toFixed(3)}  temp ${b.tempSpread >= 0 ? '+' : ''}${b.tempSpread.toFixed(1)}`;
}

async function modeFrame() {
  const { fog, list } = await stations();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    for (const st of list) {
      const page = await newPage(browser, 1600, 900, false);
      await bootMatch(page, BASE, { fighters: NFIGHT || undefined, px: st.x, py: st.y, fog });
      const drift = await driftControl(page, st.id);
      const sub = await subjectInFrame(page);
      if (sub.inFrame < 1) throw new Error(`${st.id}: NO subject in frame (${sub.decals} decals, ${sub.inFrame} on screen) — refusing to report a photograph of the floor as a measurement`);
      const r = await page.evaluate(({ y0, y1 }) => {
        const dp = window.__dp;
        const A = dp.shot();
        const band = dp.band(A, dp.W, dp.H, y0, y1, true);
        const full = dp.band(A, dp.W, dp.H, 0, 1, true);
        return { W: dp.W, H: dp.H, band, full, counts: dp.counts(),
          effects: dp.fx().map((e) => e.name) };
      }, { y0: Y0, y1: Y1 });
      if (!r.band || r.band.n === 0) throw new Error(`${st.id}: EMPTY band — vacuous`);
      await page.screenshot({ path: `${OUT}/${LABEL}_${st.id}_58.png` });
      rows.push({ station: st.id, drift, subject: sub, ...r });
      console.log(`  ${st.id.padEnd(9)} band ${fmt(r.band)}`);
      console.log(`  ${''.padEnd(9)} full ${fmt(r.full)}   draws ${r.counts.draws}  fx ${r.effects.join(',')}`);
      await page.close();
    }
  } finally { await browser.close(); }
  if (!rows.length) throw new Error('no station produced a row — vacuous');
  await writeFile(`${OUT}/frame_${LABEL}.json`, JSON.stringify({ mode: 'frame', label: LABEL, base: BASE, y0: Y0, y1: Y1, rows }, null, 1));
  console.log(`wrote ${OUT}/frame_${LABEL}.json`);
  return rows;
}

async function modeLobby() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let out = null;
  try {
    const page = await newPage(browser, 1300, 740, false);
    await page.goto(`${BASE}/?screen=characters`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForFunction("window.__screenReady === true && window.__screen === 'characters'", null, { timeout: 90_000 });
    await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      for (const an of document.getAnimations()) { try { an.pause(); an.currentTime = 0; } catch { /* ignore */ } }
      window.requestAnimationFrame = () => 0;
    });
    await page.waitForTimeout(250);
    await page.evaluate(`${DP_MATH}
      window.__dp = (() => {
        const st = (window.__charStage && window.__charStage.stage) ? window.__charStage.stage : window.__stage;
        if (!st) throw new Error('no char Stage');
        const gl = st.renderer.getContext(), cv = st.renderer.domElement;
        const W = cv.width, H = cv.height;
        st.renderer.info.autoReset = false;
        const read = () => { const p = new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p); return p; };
        const shot = () => { st.renderer.info.reset(); st.render(1/60); return read(); };
        const fx = () => (st.composer ? st.composer.passes.flatMap((p) => p.effects || []) : []);
        return { st, W, H, read, shot, fx, band: dpBand, diff: dpDiff,
          counts: () => { st.renderer.info.reset(); st.render(1/60); const r = st.renderer.info.render; return { draws: r.calls, tris: r.triangles }; } };
      })();`);
    const drift = await driftControl(page, 'lobby');
    // The subject here is the character on the turntable. Assert it is on screen —
    // a lobby capture of an empty plinth would report a perfectly good dark tail.
    const sub = await page.evaluate(() => {
      const st = window.__dp.st;
      let hit = 0, seen = 0;
      st.scene.traverse((o) => {
        if (!/^character/i.test(o.name || '')) return;
        seen++;
        const v = o.getWorldPosition(new o.position.constructor());
        v.project(st.rig ? st.rig.camera : st.camera);
        if (v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1) hit++;
      });
      return { seen, hit };
    });
    if (sub.seen === 0 || sub.hit === 0) throw new Error(`lobby: no character node in frame (seen ${sub.seen}, in frame ${sub.hit})`);
    const r = await page.evaluate(({ y0, y1 }) => {
      const dp = window.__dp; const A = dp.shot();
      return { W: dp.W, H: dp.H, band: dp.band(A, dp.W, dp.H, y0, y1, true),
        full: dp.band(A, dp.W, dp.H, 0, 1, true), counts: dp.counts(), effects: dp.fx().map((e) => e.name) };
    }, { y0: Y0, y1: Y1 });
    if (!r.band || r.band.n === 0) throw new Error('lobby: EMPTY band — vacuous');
    await page.screenshot({ path: `${OUT}/${LABEL}_lobby_20.png` });
    console.log(`  lobby ${r.W}x${r.H}  chars in frame ${sub.hit}/${sub.seen}`);
    console.log(`  band ${fmt(r.band)}`);
    console.log(`  full ${fmt(r.full)}   draws ${r.counts.draws}  fx ${r.effects.join(',')}`);
    out = { drift, subject: sub, ...r };
    await page.close();
  } finally { await browser.close(); }
  await writeFile(`${OUT}/lobby_${LABEL}.json`, JSON.stringify({ mode: 'lobby', label: LABEL, ...out }, null, 1));
  console.log(`wrote ${OUT}/lobby_${LABEL}.json`);
  return out;
}

// ── REFERENCE PLATES — NUMBERS ONLY. This repo is PUBLIC and describing a plate counts
//    as publishing it. Filenames and pixel statistics; never content.
async function modePlates() {
  const dir = fileURLToPath(new URL('../../reference/images/curated/gameplay_topdown/', import.meta.url));
  if (!existsSync(dir)) throw new Error(`no plate directory at ${dir} — every arm below would be vacuous`);
  const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  if (!files.length) throw new Error('plate directory is EMPTY — vacuous');
  const rows = [];
  for (const f of files) {
    const { data, info } = await sharp(`${dir}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new Error(`${f}: ${info.channels} channels, expected RGBA`);
    const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
    const band = M.dpBand(px, info.width, info.height, Y0, Y1, false);
    if (!band || band.n === 0) throw new Error(`${f}: EMPTY band`);
    rows.push({ file: f, W: info.width, H: info.height, band });
    console.log(`  ${f.padEnd(10)} ${String(info.width).padStart(5)}x${String(info.height).padStart(4)}  ${fmt(band)}`);
  }
  if (!rows.length) throw new Error('no plate produced a row — vacuous');
  const col = (k) => rows.map((r) => r.band[k]);
  const rng = (k, d = 3) => `${Math.min(...col(k)).toFixed(d)} .. ${Math.max(...col(k)).toFixed(d)}`;
  console.log(`\n  PLATES n=${rows.length}   vP10 [${rng('vP10')}]   belowV45 [${rng('belowV45', 4)}]`
    + `   lumaP10 [${rng('lumaP10')}]   meanLuma [${rng('meanLuma')}]   tempSpread [${rng('tempSpread', 1)}]`);
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/plates.json`, JSON.stringify({ mode: 'plates', n: rows.length, y0: Y0, y1: Y1, rows }, null, 1));
  console.log(`wrote ${OUT}/plates.json`);
  return rows;
}

// 🚨 IS_MAIN. Three tools here launched Chromium merely on being imported — `PREVIEW_BASE`
// is set in every `sx_snap`/`with_snapshot` child, so a module-scope side effect is not
// hypothetical.
const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) {
  if (has('--selftest')) process.exitCode = selftest() ? 0 : 1;
  else if (MODE === 'plates') await modePlates();
  else if (MODE === 'lobby') await modeLobby();
  else await modeFrame();
}

export { M, DP_MATH, selftest };
