#!/usr/bin/env node
/**
 * DP3_INK — the HARD NEAR-BLACK FRINGE on the character silhouette, and the SHAPE of
 * his ground contact. Item 4, round 3.
 *
 * ## The claim under test
 *
 * The round-3 critic, on `tools/tmp/dp2_A/after_hub_58.png`:
 *
 *   > *"The character's silhouette is contaminated by a hard near-black fringe and his
 *   > ground contact is a smeared multi-lobed pool rather than one anchored shadow ...
 *   > scanline y=495 crosses the bun at 165-196 luma and drops to 18 at x~840 ... y=530
 *   > reads 202 -> 45 -> 195, a 150-code black notch INSIDE the figure ... the darkest 2%
 *   > of pixels are 2.0x enriched inside a 130px disc on the hero versus 0.0x in an
 *   > equal-area control disc on bare floor ... ABSENT at pitch-20."*
 *
 * Acceptance, in the critic's own words, restated as something countable:
 *
 *   1. **no sub-25-luma sample on or inside the character silhouette against a
 *      165-215 body** -> `notches`, below. Target 0.
 *   2. **ONE soft contact ellipse under the feet instead of 3+ overlapping lobes** ->
 *      `lobes`, below. Target 1.
 *
 * ## 🚨 THE CRITIC'S OWN CONTROL IS VACUOUS AND THIS TOOL REPLACES IT
 *
 * *"2.0x enriched ... versus 0.0x in an equal-area control disc on BARE FLOOR."* Bare
 * floor has no object on it, so it has no contact shading, no ink line and no cast
 * shadow — **every** object in the frame beats that control, including the ones the
 * reference plates are full of. A disc that contains a subject cannot be compared with
 * one that contains nothing; the comparison it *wanted* is "our hero versus an object
 * whose grounding is not in question". So `discEnrich` reports THREE discs of identical
 * area: the hero, a **matched arena prop** (the standing component closest in pixel area
 * to the hero), and bare floor. The prop is the control that can fail.
 *
 * ## Definitions
 *
 *   maskHero    ablation coverage of `character:<player>`, built with the AO OFF and the
 *               hero's cast shadow + contact decal already hidden. `dp_polar`'s round-2
 *               finding, in one line: with the AO on, hiding the hero also removes the
 *               WREATH of darkened floor around him, and more than half the resulting
 *               "hero" mask was ground.
 *   ring(r)     floor pixels within r px of maskHero, excluding maskHero itself.
 *   notches     pixels with luma < `darkThr` lying inside `dilate(maskHero, 2)`, that have
 *               a pixel of luma in [bodyLo, bodyHi] within `bodyR` px. That is the
 *               critic's sentence: a black sample *against a bright body*, not a black
 *               sample somewhere in the frame.
 *   lobes       PEAKS BY PERSISTENCE in the CONTACT DARKENING FIELD — the field being
 *               luma(all layers off) - luma(shipped), on floor pixels only, windowed on
 *               the hero. A peak counts when its prominence over its own saddle is at
 *               least `promFrac` of the global peak. ⚠️ It counted CONNECTED COMPONENTS
 *               first and §C4 caught that returning **1** on a three-peaked field: three
 *               OVERLAPPING lobes share one connected support, which is the exact shape
 *               the critic described, so the first metric could not express the defect.
 *
 * ## Instrument validation (CLAUDE.md rule 6 — a guard not shown to FAIL is not a guard)
 *
 *   §A dilate against a closed form, both radii, plus a known-bad radius that must MISS.
 *   §B connected components: 1 blob is 1, three separated blobs are 3, a diagonal-only
 *      contact is 1 under 8-connectivity and 2 under 4 — asserted so the connectivity is
 *      a decision and not an accident.
 *   §C lobes: one Gaussian -> 1, three separated -> 3, three OVERLAPPING with ONE
 *      connected support -> 3 (the arm that matters, and the one that failed the first
 *      implementation), the same three blurred until they genuinely merge -> 1, and
 *      scale-freedom. Plus §C8-C10: the noise guard is TWO redundant mechanisms, so
 *      ablating either one alone leaves the arm green — only both off fragments the pool.
 *   §D notches: fires on a black line drawn through a bright body, and is SILENT on the
 *      same black line drawn on a dark background (so it is "against a body", not "dark").
 *      Plus the off-by-one arm: a notch one pixel further than `bodyR` from any body pixel
 *      must NOT count.
 *   §E THE VACUITY ARMS. `[].every()` is `true` and a mean over nothing is NaN.
 *      - an empty mask must make every consumer THROW rather than return a tidy zero;
 *      - `lobes` on an all-zero field must be 0 and must be REFUSED, not published;
 *      - `notches` with a body window that admits nothing must throw, because "no notches"
 *        and "no body to have a notch against" are the same number and different facts.
 *   §F the subject gate: a frame whose hero mask is under 200 px is not in shot and every
 *      row is refused. `AGENT-BRIEF` §6: an instrument once photographed the sky and
 *      reported PASS because it asserted the rig was reachable and never that the subject
 *      was in frame.
 *   §G the record of a metric BUILT, MEASURED AND WITHDRAWN. `ikEllipseFrac` passed its
 *      closed form (0.8621 against 1-exp(-2) = 0.8647) and then scored two far lobes
 *      HIGHER than one pool (0.9148), because a bimodal mass inflates the very second
 *      moment the ellipse is drawn from. Deleted, not caveated.
 *
 * ## Use
 *
 *   node tools/tmp/dp3_ink.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-dp3-base -- \
 *     node tools/tmp/dp3_ink.mjs --mode frame --url '{URL}' --label before --out tools/tmp/dp3_A
 *   ... --mode lobby                       # charStage, pitch 20 — the OTHER detector
 *   ... --mode sweep --floors 0,0.35,0.45,0.55,0.65   # live caoFloor sweep, one boot
 *
 * 🚨 IK_MATH IS A TEMPLATE LITERAL AND CONTAINS NO BACKTICKS. One in a comment terminates
 * the string; it happened while writing this file, exactly as `stage.ts` warns.
 *
 * ⚠️ Camera shake re-randomises on every `render()` even at dt = 0, and CSS animations run
 * on the document timeline rather than rAF. Both are stilled. The drift control is printed
 * FIRST and if it is not EXACTLY zero nothing below it is a measurement.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { DP_MATH } from './dp_dark.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// PURE MATH — ONE source, run BOTH node-side (selftest) and inside the page.
// ─────────────────────────────────────────────────────────────────────────────
const IK_MATH = String.raw`
/* ⚠️ THE LEADING COMMENT IS LOAD-BEARING: page.evaluate() treats a string that STARTS
   with 'function' as a function body to call, and throws SyntaxError: Unexpected token
   'function'. dp_polar's PL_MATH opens with a doc comment and has never hit this. */
function ikLumaOf(P, i) { return 0.2126 * P[i] + 0.7152 * P[i+1] + 0.0722 * P[i+2]; }

/** Rec.709 luma plane, 0-255, from an RGBA buffer. */
function ikLumaPlane(P, W, H) {
  var L = new Float32Array(W * H);
  for (var j = 0; j < W * H; j++) L[j] = ikLumaOf(P, j * 4);
  return L;
}

/** Pixels whose RGB changed by more than 'thr' in L1. Mask AND count. */
function ikDiff(A, B, W, H, thr) {
  var m = new Uint8Array(W * H), n = 0;
  for (var j = 0; j < W * H; j++) {
    var i = j * 4;
    var d = Math.abs(A[i] - B[i]) + Math.abs(A[i+1] - B[i+1]) + Math.abs(A[i+2] - B[i+2]);
    if (d > thr) { m[j] = 1; n++; }
  }
  return { m: m, n: n };
}

/** Dilate by r 4-neighbour steps (so the result is a diamond of radius r). NEW mask. */
function ikDilate(m, W, H, r) {
  var cur = new Uint8Array(m), tmp = new Uint8Array(W * H);
  for (var it = 0; it < r; it++) {
    tmp.set(cur);
    for (var y = 0; y < H; y++) {
      var row = y * W;
      for (var x = 0; x < W; x++) {
        if (tmp[row + x]) continue;
        if ((x > 0 && tmp[row + x - 1]) || (x < W - 1 && tmp[row + x + 1])
          || (y > 0 && tmp[row - W + x]) || (y < H - 1 && tmp[row + W + x])) cur[row + x] = 1;
      }
    }
  }
  return cur;
}

function ikAndNot(a, b, W, H) {
  var m = new Uint8Array(W * H), n = 0;
  for (var j = 0; j < W * H; j++) if (a[j] && !b[j]) { m[j] = 1; n++; }
  return { m: m, n: n };
}
function ikAnd(a, b, W, H) {
  var m = new Uint8Array(W * H), n = 0;
  for (var j = 0; j < W * H; j++) if (a[j] && b[j]) { m[j] = 1; n++; }
  return { m: m, n: n };
}

/**
 * 8-connected components of a binary mask. Returns { n, labels, comps:[{area,cx,cy,
 * x0,y0,x1,y1}] }, largest first. 'conn' is 4 or 8 and is a PARAMETER because §B
 * asserts the difference rather than assuming it.
 */
function ikComponents(m, W, H, conn) {
  var labels = new Int32Array(W * H).fill(-1);
  var comps = [], stack = new Int32Array(W * H), id = 0;
  var dx8 = [1,-1,0,0,1,1,-1,-1], dy8 = [0,0,1,-1,1,-1,1,-1];
  var K = (conn === 4) ? 4 : 8;
  for (var s = 0; s < W * H; s++) {
    if (!m[s] || labels[s] >= 0) continue;
    var sp = 0; stack[sp++] = s; labels[s] = id;
    var area = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    while (sp > 0) {
      var p = stack[--sp];
      var px = p % W, py = (p - px) / W;
      area++; sx += px; sy += py;
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
      for (var k = 0; k < K; k++) {
        var nx = px + dx8[k], ny = py + dy8[k];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var q = ny * W + nx;
        if (!m[q] || labels[q] >= 0) continue;
        labels[q] = id; stack[sp++] = q;
      }
    }
    comps.push({ id: id, area: area, cx: sx / area, cy: sy / area, x0: x0, y0: y0, x1: x1, y1: y1 });
    id++;
  }
  comps.sort(function (a, b) { return b.area - a.area; });
  return { n: comps.length, labels: labels, comps: comps };
}

/**
 * THE FRINGE COUNT — the critic's sentence, made countable.
 *
 * A pixel counts when it is (a) dark, luma < darkThr, (b) inside dilate(subject, edgePx)
 * — i.e. on or just inside the silhouette — and (c) within bodyR px of a pixel whose luma
 * is in [bodyLo, bodyHi], the "165-215 body" the critic named.
 *
 * (c) is what makes this a FRINGE metric and not a "the frame contains dark pixels"
 * metric, and §D asserts both directions of it.
 */
function ikNotches(L, subject, W, H, o) {
  var band = ikDilate(subject, W, H, o.edgePx);
  var body = new Uint8Array(W * H), nBody = 0;
  for (var j = 0; j < W * H; j++) if (L[j] >= o.bodyLo && L[j] <= o.bodyHi) { body[j] = 1; nBody++; }
  var nearBody = ikDilate(body, W, H, o.bodyR);
  var n = 0, minL = 255, nBand = 0;
  var hits = new Uint8Array(W * H);
  for (var q = 0; q < W * H; q++) {
    if (!band[q]) continue;
    nBand++;
    if (L[q] < minL) minL = L[q];
    if (L[q] < o.darkThr && nearBody[q]) { n++; hits[q] = 1; }
  }
  return { n: n, nBand: nBand, nBody: nBody, minL: nBand ? minL : NaN, hits: hits, band: band };
}

/** Separable box blur, radius r, on a float field. Peak-finding on a raw AO field counts
 *  luma quantisation as topography; this is the pre-filter that stops it. */
function ikBlur(D, W, H, r) {
  if (r <= 0) return new Float32Array(D);
  var t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (var y = 0; y < H; y++) {
    var row = y * W, acc = 0, n = 0;
    for (var x = 0; x < W; x++) {
      if (x === 0) { for (var k = 0; k <= r && k < W; k++) { acc += D[row + k]; n++; } }
      else {
        var add = x + r, sub = x - r - 1;
        if (add < W) { acc += D[row + add]; n++; }
        if (sub >= 0) { acc -= D[row + sub]; n--; }
      }
      t[row + x] = acc / n;
    }
  }
  for (var x2 = 0; x2 < W; x2++) {
    var acc2 = 0, n2 = 0;
    for (var y2 = 0; y2 < H; y2++) {
      if (y2 === 0) { for (var k2 = 0; k2 <= r && k2 < H; k2++) { acc2 += t[k2 * W + x2]; n2++; } }
      else {
        var add2 = y2 + r, sub2 = y2 - r - 1;
        if (add2 < H) { acc2 += t[add2 * W + x2]; n2++; }
        if (sub2 >= 0) { acc2 -= t[sub2 * W + x2]; n2--; }
      }
      o[y2 * W + x2] = acc2 / n2;
    }
  }
  return o;
}

/**
 * THE CONTACT SHAPE — how many DISTINCT darkening lobes are under him.
 *
 * 🚨 THE FIRST VERSION OF THIS FUNCTION COUNTED CONNECTED COMPONENTS ABOVE
 * lobeFrac * peak, AND §C4 CAUGHT IT RETURNING 1 ON A THREE-PEAKED FIELD. Its old
 * wording is kept, per the house reversal rule: *"components are taken at lobeFrac of the
 * field's own peak, so the metric is scale-free."* Scale-free it was; a lobe counter it
 * was not. The critic's sentence is *"3+ OVERLAPPING lobes"*, and three overlapping
 * darkenings have ONE connected support at any threshold that keeps their saddle — so a
 * component count would have read 1 on the very frame under test and looked like a pass.
 * That is CLAUDE.md rule 6's vacuity class wearing a different hat: the assertion was
 * fine, the quantity could not express the defect.
 *
 * What it counts now is PEAKS BY PERSISTENCE. Pixels are walked in descending order with
 * a union-find; a pixel with no already-seen neighbour births a new peak, and when two
 * components meet at level v the weaker peak DIES with prominence peakValue - v. A lobe
 * is a peak whose prominence is at least promFrac of the global peak and whose own
 * value is at least lobeFrac of it. That is the standard topographic definition and it
 * separates overlapping lobes, which is the whole job.
 */
function ikLobes(D0, W, H, o) {
  var D = ikBlur(D0, W, H, o.blurPx | 0);
  var peak = 0, mass = 0;
  for (var j = 0; j < W * H; j++) { if (D[j] > peak) peak = D[j]; if (D0[j] > 0) mass += D0[j]; }
  if (!(peak > 0)) return { peak: peak, n: 0, comps: [], mass: mass, vacuous: true };

  var idx = [];
  for (var q = 0; q < W * H; q++) if (D[q] > 0) idx.push(q);
  idx.sort(function (p2, q2) { return D[q2] - D[p2]; });

  var parent = new Int32Array(W * H).fill(-1);
  var peakOf = new Int32Array(W * H).fill(-1);
  var prom = new Float64Array(W * H).fill(-1);
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  var dx8 = [1,-1,0,0,1,1,-1,-1], dy8 = [0,0,1,-1,1,-1,1,-1];

  for (var t2 = 0; t2 < idx.length; t2++) {
    var p = idx[t2], px = p % W, py = (p - px) / W;
    var roots = [];
    for (var k3 = 0; k3 < 8; k3++) {
      var nx = px + dx8[k3], ny = py + dy8[k3];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      var nq = ny * W + nx;
      if (parent[nq] < 0) continue;
      var r2 = find(nq);
      if (roots.indexOf(r2) < 0) roots.push(r2);
    }
    if (roots.length === 0) { parent[p] = p; peakOf[p] = p; continue; }
    var win = roots[0];
    for (var s3 = 1; s3 < roots.length; s3++) if (D[peakOf[roots[s3]]] > D[peakOf[win]]) win = roots[s3];
    parent[p] = win;
    for (var s4 = 0; s4 < roots.length; s4++) {
      var rr = roots[s4]; if (rr === win) continue;
      prom[peakOf[rr]] = D[peakOf[rr]] - D[p];        // the weaker peak dies here
      parent[rr] = win;
    }
  }
  // the surviving global peak never merges: its prominence is its full height
  for (var z = 0; z < W * H; z++) if (peakOf[z] === z && prom[z] < 0) prom[z] = D[z];

  var comps = [];
  for (var z2 = 0; z2 < W * H; z2++) {
    if (peakOf[z2] !== z2) continue;
    if (D[z2] < peak * o.lobeFrac) continue;
    if (prom[z2] < peak * o.promFrac) continue;
    comps.push({ x: z2 % W, y: (z2 - (z2 % W)) / W, v: D[z2], prom: prom[z2] });
  }
  comps.sort(function (u, v) { return v.prom - u.prom; });
  return { peak: peak, n: comps.length, comps: comps.slice(0, 8), mass: mass, vacuous: false };
}

/** Median / mean / min / percentile of luma over a mask. */
function ikStats(L, mask, W, H) {
  var n = 0, sum = 0, mn = 1e9, mx2 = -1e9;
  var hist = new Float64Array(1024);
  for (var j = 0; j < W * H; j++) {
    if (mask && !mask[j]) continue;
    var v = L[j]; n++; sum += v;
    if (v < mn) mn = v; if (v > mx2) mx2 = v;
    var b = Math.floor(v * 1023.999 / 255); if (b > 1023) b = 1023; if (b < 0) b = 0;
    hist[b]++;
  }
  if (n === 0) return { n: 0 };
  function pct(q) { var want = q * n, acc = 0;
    for (var k = 0; k < 1024; k++) { acc += hist[k]; if (acc >= want) return k * 255 / 1023; }
    return 255; }
  return { n: n, mean: sum / n, min: mn, max: mx2, p01: pct(0.01), p10: pct(0.10), p50: pct(0.50) };
}

/** Share of the frame's darkest q fraction that lands inside a disc. */
function ikDiscEnrich(L, W, H, cx, cy, R, q) {
  var hist = new Float64Array(1024), N = W * H;
  for (var j = 0; j < N; j++) { var b = Math.floor(L[j] * 1023.999 / 255); if (b > 1023) b = 1023; if (b < 0) b = 0; hist[b]++; }
  var want = q * N, acc = 0, thrBin = 0;
  for (var k = 0; k < 1024; k++) { acc += hist[k]; if (acc >= want) { thrBin = k; break; } }
  var thr = thrBin * 255 / 1023;
  var inDisc = 0, darkIn = 0, darkAll = 0;
  var R2 = R * R;
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    var i = y * W + x, dark = L[i] <= thr;
    if (dark) darkAll++;
    var dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= R2) { inDisc++; if (dark) darkIn++; }
  }
  var expect = inDisc * (darkAll / N);
  return { thr: thr, inDisc: inDisc, darkIn: darkIn, darkAll: darkAll,
           enrich: expect > 0 ? darkIn / expect : NaN };
}
`;

// eslint-disable-next-line no-eval
const IK = (0, eval)(`${IK_MATH}; ({ ikLumaPlane, ikDiff, ikDilate, ikAndNot, ikAnd, ikComponents, ikNotches, ikLobes, ikBlur, ikStats, ikDiscEnrich })`);

// The acceptance thresholds, in ONE place, quoted from the critic.
const ACCEPT = { darkThr: 25, bodyLo: 165, bodyHi: 215, bodyR: 6, edgePx: 2,
                 lobeFrac: 0.35, promFrac: 0.10, blurPx: 3, ringPx: 8 };

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST
// ─────────────────────────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
function ok(name, cond, got) {
  if (cond) { PASS++; console.log(`  ✅ ${name}`); }
  else { FAIL++; console.log(`  🔴 ${name}${got !== undefined ? `  — ${got}` : ''}`); }
}
function throws(fn) { try { fn(); return false; } catch { return true; } }

function selftest() {
  console.log('── dp3_ink --selftest ──\n');
  const W = 120, H = 90, N = W * H;

  console.log('§A dilate against a closed form');
  {
    const m = new Uint8Array(N); m[45 * W + 60] = 1;
    const d1 = IK.ikDilate(m, W, H, 1);
    let n1 = 0; for (let j = 0; j < N; j++) n1 += d1[j];
    ok('§A1 one 4-step from a point is a 5-px diamond', n1 === 5, n1);
    const d3 = IK.ikDilate(m, W, H, 3);
    let n3 = 0; for (let j = 0; j < N; j++) n3 += d3[j];
    // diamond of radius r has 2r^2 + 2r + 1 pixels
    ok('§A2 three steps is 2r^2+2r+1 = 25', n3 === 25, n3);
    // KNOWN-BAD: r = 0 must not reach a neighbour. A dilate that always grows would pass §A1.
    const d0 = IK.ikDilate(m, W, H, 0);
    let n0 = 0; for (let j = 0; j < N; j++) n0 += d0[j];
    ok('§A3 KNOWN-BAD r=0 grows nothing', n0 === 1, n0);
  }

  console.log('\n§B connected components, and the connectivity is a DECISION');
  {
    const m = new Uint8Array(N);
    const box = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) m[y * W + x] = 1; };
    box(10, 10, 6, 6); box(40, 10, 6, 6); box(70, 10, 6, 6);
    const c = IK.ikComponents(m, W, H, 8);
    ok('§B1 three separated boxes are three components', c.n === 3, c.n);
    ok('§B2 areas are 36 each', c.comps.every((q) => q.area === 36), JSON.stringify(c.comps.map((q) => q.area)));
    const d = new Uint8Array(N); d[50 * W + 50] = 1; d[51 * W + 51] = 1;
    ok('§B3 a diagonal touch is ONE component under 8', IK.ikComponents(d, W, H, 8).n === 1, IK.ikComponents(d, W, H, 8).n);
    ok('§B4 ... and TWO under 4 (so §B3 is a choice, not luck)', IK.ikComponents(d, W, H, 4).n === 2, IK.ikComponents(d, W, H, 4).n);
    ok('§B5 an empty mask is zero components', IK.ikComponents(new Uint8Array(N), W, H, 8).n === 0);
  }

  console.log('\n§C lobes — and the arm that matters is the OVERLAPPING one');
  {
    const gauss = (D, cx, cy, s, a) => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy;
        D[y * W + x] += a * Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
      }
    };
    const one = new Float32Array(N); gauss(one, 60, 45, 8, 30);
    ok('§C1 one Gaussian is one lobe', IK.ikLobes(one, W, H, ACCEPT).n === 1, IK.ikLobes(one, W, H, ACCEPT).n);
    const three = new Float32Array(N); gauss(three, 25, 45, 8, 30); gauss(three, 60, 45, 8, 30); gauss(three, 95, 45, 8, 30);
    ok('§C2 three separated Gaussians are three lobes', IK.ikLobes(three, W, H, ACCEPT).n === 3, IK.ikLobes(three, W, H, ACCEPT).n);

    // 🚨 THE ARM THAT MATTERS, AND IT FAILED THE FIRST IMPLEMENTATION. sigma 7 at a
    // spacing of 20 gives three genuine local maxima (~30.5) over a saddle of ~21.6, so
    // the support above ANY threshold that keeps the saddle is ONE connected blob. A
    // component-counting lobe metric returns 1 here — and would have returned 1 on the
    // frame under test, which is exactly the shape the critic described.
    const over = new Float32Array(N); gauss(over, 40, 45, 7, 30); gauss(over, 60, 45, 7, 30); gauss(over, 80, 45, 7, 30);
    const supMask = Float32ToMask(over, IK.ikLobes(over, W, H, ACCEPT).peak * ACCEPT.lobeFrac);
    const supComps = IK.ikComponents(supMask, W, H, 8).n;
    ok('§C3 the overlapping field has ONE connected support at lobeFrac (so §C4 cannot be luck)', supComps === 1, supComps);
    ok('§C4 ... and lobes still separates it into 3', IK.ikLobes(over, W, H, ACCEPT).n === 3, IK.ikLobes(over, W, H, ACCEPT).n);

    // and a single WIDE pool that genuinely merges must read 1, or the metric would call
    // every change a win by fragmenting a smooth field.
    const merged = new Float32Array(N); gauss(merged, 45, 45, 22, 30); gauss(merged, 60, 45, 22, 30); gauss(merged, 75, 45, 22, 30);
    ok('§C5 the SAME three, blurred until they merge, read 1', IK.ikLobes(merged, W, H, ACCEPT).n === 1, IK.ikLobes(merged, W, H, ACCEPT).n);
    ok('§C6 lobes is SCALE-FREE: halving the whole field does not move it',
      IK.ikLobes(scale(over, 0.5), W, H, ACCEPT).n === IK.ikLobes(over, W, H, ACCEPT).n);
    // Quantisation noise on a SINGLE pool must not become topography.
    const noisy = new Float32Array(N); gauss(noisy, 60, 45, 14, 30);
    for (let j = 0; j < N; j++) noisy[j] = Math.round(noisy[j]);
    ok('§C7 an integer-quantised single pool is still 1 lobe', IK.ikLobes(noisy, W, H, ACCEPT).n === 1, IK.ikLobes(noisy, W, H, ACCEPT).n);
    // ⚠️ §C8 ORIGINALLY READ *"and it is the BLUR doing that (blurPx 0 fragments it)"*,
    // WAS THEN REWRITTEN TO BLAME THE PROMINENCE FILTER, AND **BOTH SINGLE-CAUSE CLAIMS
    // ARE FALSE.** Kept per the house reversal rule, because the shape of the mistake is
    // the point: there are TWO guards here and each is INDEPENDENTLY SUFFICIENT, so
    // ablating either one alone leaves the arm green and reads as "this guard does
    // nothing". A rounded Gaussian's iso-level plateaus birth extra maxima at prominence
    // exactly 0; the blur removes the plateaus, and promFrac * peak = 3.0 codes rejects
    // what survives. Only turning BOTH off fragments the pool — which is the arm that
    // ships, and the general lesson is that a one-at-a-time ablation cannot find a guard
    // that is redundant with another one.
    const noProm = { ...ACCEPT, promFrac: 0 };
    const raw = { ...ACCEPT, blurPx: 0 };
    const neither = { ...ACCEPT, blurPx: 0, promFrac: 0 };
    ok('§C8 KNOWN-BAD both guards off fragments the same pool', IK.ikLobes(noisy, W, H, neither).n > 1, IK.ikLobes(noisy, W, H, neither).n);
    ok('§C9 the blur ALONE is sufficient (promFrac 0 still reads 1)', IK.ikLobes(noisy, W, H, noProm).n === 1, IK.ikLobes(noisy, W, H, noProm).n);
    ok('§C10 the prominence filter ALONE is sufficient (blurPx 0 still reads 1)', IK.ikLobes(noisy, W, H, raw).n === 1, IK.ikLobes(noisy, W, H, raw).n);
  }

  console.log('\n§D notches — dark AGAINST A BODY, not merely dark');
  {
    const L = new Float32Array(N).fill(190);          // a bright body everywhere
    const subj = new Uint8Array(N).fill(1);
    for (let y = 20; y < 70; y++) L[y * W + 60] = 4;  // a black line through it
    const r = IK.ikNotches(L, subj, W, H, ACCEPT);
    ok('§D1 fires on a black line through a 190-luma body', r.n === 50, r.n);
    const L2 = new Float32Array(N).fill(60);          // same line, DARK background
    for (let y = 20; y < 70; y++) L2[y * W + 60] = 4;
    ok('§D2 SILENT on the same line over a 60-luma background', IK.ikNotches(L2, subj, W, H, ACCEPT).n === 0);
    // off-by-one: a body strip at exactly bodyR + 1 away must not qualify the notch.
    const L3 = new Float32Array(N).fill(60);
    for (let y = 20; y < 70; y++) { L3[y * W + 60] = 4; L3[y * W + 60 + ACCEPT.bodyR + 1] = 190; }
    ok('§D3 KNOWN-BAD a body bodyR+1 px away does NOT qualify it', IK.ikNotches(L3, subj, W, H, ACCEPT).n === 0,
      IK.ikNotches(L3, subj, W, H, ACCEPT).n);
    const L4 = new Float32Array(N).fill(60);
    for (let y = 20; y < 70; y++) { L4[y * W + 60] = 4; L4[y * W + 60 + ACCEPT.bodyR] = 190; }
    ok('§D4 ... and one at exactly bodyR DOES (so §D3 is a boundary, not a null)',
      IK.ikNotches(L4, subj, W, H, ACCEPT).n === 50, IK.ikNotches(L4, subj, W, H, ACCEPT).n);
    // and it must be confined to the SILHOUETTE band, not the whole frame.
    const subjSmall = new Uint8Array(N);
    for (let y = 40; y < 50; y++) for (let x = 55; x < 65; x++) subjSmall[y * W + x] = 1;
    const r5 = IK.ikNotches(L, subjSmall, W, H, ACCEPT);
    ok('§D5 confined to the subject band (10 of the 50 line px, +2 dilate)', r5.n === 14, r5.n);
  }

  console.log('\n§E THE VACUITY ARMS — [].every() is true and a mean over nothing is NaN');
  {
    ok('§E1 ikStats over an empty mask returns n=0, never a tidy zero',
      IK.ikStats(new Float32Array(N), new Uint8Array(N), W, H).n === 0);
    ok('§E2 requireNonEmpty THROWS on it', throws(() => requireNonEmpty('x', IK.ikStats(new Float32Array(N), new Uint8Array(N), W, H))));
    ok('§E3 requireNonEmpty passes a real one', !throws(() => requireNonEmpty('x', IK.ikStats(new Float32Array(N).fill(1), null, W, H))));
    const flat = IK.ikLobes(new Float32Array(N), W, H, ACCEPT);
    ok('§E4 lobes on an all-zero field is vacuous and SAYS SO', flat.vacuous === true && flat.n === 0, JSON.stringify(flat));
    ok('§E5 requireLobes THROWS on the vacuous field', throws(() => requireLobes('x', flat)));
    // "no notches" and "no body to have a notch against" are the same number, different facts.
    const dark = new Float32Array(N).fill(60);
    ok('§E6 notches with an EMPTY body population is refused, not reported as 0',
      throws(() => requireNotches('x', IK.ikNotches(dark, new Uint8Array(N).fill(1), W, H, ACCEPT))));
    ok('§E7 ... and with a real body population it is accepted',
      !throws(() => requireNotches('x', IK.ikNotches(new Float32Array(N).fill(190), new Uint8Array(N).fill(1), W, H, ACCEPT))));
  }

  console.log('\n§F the subject gate — an instrument once photographed the sky and passed');
  {
    ok('§F1 a 199-px hero is NOT in shot', subjectOk({ hero: 199, flat: 90000 }) === false);
    ok('§F2 a 20000-px hero is', subjectOk({ hero: 20000, flat: 90000 }) === true);
    ok('§F3 a hero with NO ground under him is refused too', subjectOk({ hero: 20000, flat: 12 }) === false);
  }

  console.log('\n§G the metric that was BUILT, MEASURED AND WITHDRAWN');
  {
    // ⚠️ `ikEllipseFrac` — mass inside the 2-sigma second-moment ellipse — was written as
    // a second shape rail on the reasoning that a single elliptical pool scores the 2D
    // Gaussian's 1-exp(-2) = 0.8647 and a multi-lobed smear scores lower. The closed-form
    // arm passed at 0.8621. **Its known-bad arm then scored HIGHER, not lower**: two far
    // point masses inflate the second moment along their own axis, the 2-sigma ellipse
    // grows to swallow both, and the statistic read 0.9148. It cannot distinguish "one
    // pool" from "two lobes in a line", which is the only distinction it existed to make.
    // The function is deleted rather than reported with a caveat — `CLAUDE.md` rule 6: a
    // number that fails its own known-bad is not evidence, and a caveat on a published
    // row is read by nobody. The wording is kept here so the next agent does not rebuild it.
    ok('§G1 ikEllipseFrac is GONE, not merely unused', typeof IK.ikEllipseFrac === 'undefined');
    // The rail that replaced it is §C's persistence count, and §C4/§C5 are its two sides.
    ok('§G2 the shape rail that ships is ikLobes', typeof IK.ikLobes === 'function');
  }

  console.log(`\n  dp3_ink --selftest: ${PASS} passed, ${FAIL} failed`);
  return FAIL === 0;
}

function Float32ToMask(D, thr) {
  const m = new Uint8Array(D.length);
  for (let j = 0; j < D.length; j++) if (D[j] > thr) m[j] = 1;
  return m;
}
function scale(D, k) { const o = new Float32Array(D.length); for (let j = 0; j < D.length; j++) o[j] = D[j] * k; return o; }

/** §E's guards. A statistic over nothing is not a statistic. */
function requireNonEmpty(name, s) {
  if (!s || !s.n) throw new Error(`${name}: EMPTY set (n=${s ? s.n : 'null'}) — refusing to publish a statistic over nothing`);
  return s;
}
function requireLobes(name, l) {
  if (!l || l.vacuous) throw new Error(`${name}: the darkening field has no positive peak — lobes would be a vacuous 0`);
  return l;
}
function requireNotches(name, r) {
  if (!r || !r.nBand) throw new Error(`${name}: the silhouette band is EMPTY`);
  if (!r.nBody) throw new Error(`${name}: NO pixel in the frame is in the body range [${ACCEPT.bodyLo},${ACCEPT.bodyHi}] — "0 notches" here means "nothing to have a notch against"`);
  return r;
}
/** §F. 200 px is ~0.014% of a 1600x900 frame — a hero that small is not in shot. */
function subjectOk(n) { return !!(n && n.hero >= 200 && n.flat >= 200); }

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

const PAGE_SRC = `${IK_MATH}
${DP_MATH}
window.__ik = (() => {
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

  const scene = st.scene;
  scene.updateMatrixWorld(true);
  const arena = scene.getObjectByName('arena:kitchen');
  if (!arena) throw new Error('no arena:kitchen in the scene');
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

  const heroName = 'character:' + (window.__ikPlayer || 'hamburger');
  const heroRoot = scene.getObjectByName(heroName);
  if (!heroRoot) throw new Error('no ' + heroName + ' in the scene');
  const hero = [], ink = [];
  heroRoot.traverse((o) => { if (o.isMesh) { hero.push(o.uuid); if (/__outline$/.test(o.name)) ink.push(o.uuid); } });

  // 🚨 THE GROUP, NOT ITS CHILDREN. Stage.updateContactShadows() runs inside EVERY
  // render() and sets decal.visible = true on each CHILD, so hiding the meshes is undone
  // before the frame is drawn and the ablation returns a clean 0.00 that reads exactly
  // like "the decal draws nothing" (dp_polar, round 2). decalsHidden() is re-read AFTER
  // the ablation render and the caller refuses the row if the scene put it back.
  const decals = [];
  const dg = scene.getObjectByName('contact:shadows');
  if (dg) { decals.push(dg.uuid); dg.traverse((o) => { if (o.isMesh) decals.push(o.uuid); }); }
  const decalGroup = dg || null;

  const setVis = (uuids, v) => { const s = new Set(uuids); let n = 0;
    scene.traverse((o) => { if (s.has(o.uuid)) { o.visible = v; n++; } }); st.markShadowsDirty(); return n; };
  const setCast = (uuids, on) => { const s = new Set(uuids); let n = 0;
    scene.traverse((o) => { if (!s.has(o.uuid)) return;
      if (o.__ikCast === undefined) o.__ikCast = o.castShadow;
      o.castShadow = on ? o.__ikCast : false; n++; }); st.markShadowsDirty(); return n; };
  const decalsHidden = () => !!decalGroup && decalGroup.visible === false;

  return { st, W, H, read, shot, counts, flat, stand, hero, ink, decals, decalsHidden, setVis, setCast,
    diff: dpDiff, band: dpBand,
    ikLumaPlane, ikDiff, ikDilate, ikAndNot, ikAnd, ikComponents, ikNotches, ikLobes,
    ikBlur, ikStats, ikDiscEnrich };
})();
`;

/**
 * THE MEASUREMENT. One page call, one frozen frame, seven renders, every mask built with
 * the AO OFF and every ablation closed by a bit-identical restore.
 */
const MEASURE = `(A_) => {
  const p = window.__ik, W = p.W, H = p.H, ACC = A_;
  const ao = window.__stage.contactAO;
  if (!ao) throw new Error('no contactAO on this Stage — every ablation below would be vacuous');
  const aoWas = ao.intensity;

  const A = p.shot();                                   // SHIPPED

  // ── single-variable ablations, each closed and restored ──────────────────
  ao.intensity = 0;                       const noAO   = p.shot(); ao.intensity = aoWas;
  p.setVis(p.decals, false);              const noDec  = p.shot();
  const decalStuck = p.decalsHidden();    p.setVis(p.decals, true);
  p.setCast(p.hero, false);               const noCast = p.shot(); p.setCast(p.hero, true);
  p.setVis(p.ink, false);                 const noInk  = p.shot(); p.setVis(p.ink, true);
  ao.intensity = 0; p.setVis(p.decals, false); p.setCast(p.hero, false);
  const allOff = p.shot();
  ao.intensity = aoWas; p.setVis(p.decals, true); p.setCast(p.hero, true);
  const A2 = p.shot();
  const restore = p.diff(A, A2);

  // ── masks, AO OFF (round-2's lesson: with it on, half the "hero" mask is ground) ──
  ao.intensity = 0;
  const A0 = p.shot();
  p.setCast(p.hero, false); p.setVis(p.decals, false);
  const F = p.shot();
  p.setVis(p.hero, false);
  const G = p.shot();
  p.setVis(p.hero, true); p.setVis(p.decals, true); p.setCast(p.hero, true);
  const mHero = p.ikDiff(F, G, W, H, 8);
  p.setVis(p.flat, false);
  const I = p.shot();
  p.setVis(p.flat, true);
  const mFlat = p.ikDiff(A0, I, W, H, 8);
  p.setVis(p.stand, false);
  const J = p.shot();
  p.setVis(p.stand, true);
  const mStand = p.ikDiff(A0, J, W, H, 8);
  ao.intensity = aoWas;
  const A3 = p.shot();
  const restore2 = p.diff(A, A3);

  const L    = p.ikLumaPlane(A, W, H);
  const Loff = p.ikLumaPlane(allOff, W, H);
  const Lno  = { ao: p.ikLumaPlane(noAO, W, H), dec: p.ikLumaPlane(noDec, W, H),
                 cast: p.ikLumaPlane(noCast, W, H), ink: p.ikLumaPlane(noInk, W, H) };

  // ── 1. THE FRINGE ────────────────────────────────────────────────────────
  const notch = p.ikNotches(L, mHero.m, W, H, ACC);
  const notchNoAO  = p.ikNotches(Lno.ao,   mHero.m, W, H, ACC);
  const notchNoInk = p.ikNotches(Lno.ink,  mHero.m, W, H, ACC);

  // the RING of floor just outside him, and open floor for reference
  const dil  = p.ikDilate(mHero.m, W, H, ACC.ringPx);
  const ringRaw = p.ikAndNot(dil, mHero.m, W, H);
  const ring = p.ikAnd(ringRaw.m, mFlat.m, W, H);
  const far  = p.ikDilate(mHero.m, W, H, 90);
  const openA = p.ikAndNot(mFlat.m, far, W, H);

  // ── 2. THE CONTACT SHAPE ─────────────────────────────────────────────────
  // darkening field = how much darker the shipped frame is than the all-layers-off arm,
  // on FLOOR pixels only (so the hero's own shading cannot enter it).
  const D = new Float32Array(W * H);
  for (var j = 0; j < W * H; j++) if (mFlat.m[j] && !mHero.m[j]) { var d = Loff[j] - L[j]; if (d > 0) D[j] = d; }
  // windowed on the hero so a prop's shadow across the frame is not counted as his lobe
  const win = p.ikDilate(mHero.m, W, H, 120);
  const Dw = new Float32Array(W * H);
  for (var j2 = 0; j2 < W * H; j2++) if (win[j2]) Dw[j2] = D[j2];
  const lobes = p.ikLobes(Dw, W, H, ACC);
  // per-layer lobe counts: which of the three darkenings is making the pool multi-lobed
  const fieldOf = (Lx) => { var Z = new Float32Array(W * H);
    for (var q4 = 0; q4 < W * H; q4++) if (win[q4] && mFlat.m[q4] && !mHero.m[q4]) {
      var vv = Lx[q4] - Loff[q4]; if (vv < 0) Z[q4] = -vv; }
    return Z; };
  // ⚠️ each of these is "the field WITHOUT one layer", so it is the shipped field minus
  // that layer's own contribution — the same single-variable ablation, re-thresholded.
  const lobesNo = { ao: p.ikLobes(fieldOf(Lno.ao), W, H, ACC).n,
                    decal: p.ikLobes(fieldOf(Lno.dec), W, H, ACC).n,
                    cast: p.ikLobes(fieldOf(Lno.cast), W, H, ACC).n };

  // per-layer darkening fields, same window, for attribution
  const layer = (Lx) => { var s = 0, n = 0, mx = 0;
    for (var q = 0; q < W * H; q++) { if (!win[q] || !mFlat.m[q] || mHero.m[q]) continue;
      var v = Lx[q] - L[q]; n++; s += v; if (v > mx) mx = v; }
    return n ? { n: n, dMean: s / n, dMax: mx } : { n: 0 }; };

  // ── 3. THE DISC CONTROLS — hero vs a MATCHED PROP vs bare floor ──────────
  const heroC = p.ikComponents(mHero.m, W, H, 8).comps[0];
  const standComps = p.ikComponents(mStand.m, W, H, 8).comps
    .filter((c) => c.area > 800 && c.cy > H * 0.25);
  var propC = null, best = 1e18;
  for (var s2 = 0; s2 < standComps.length; s2++) {
    var q2 = Math.abs(standComps[s2].area - (heroC ? heroC.area : 0));
    if (q2 < best) { best = q2; propC = standComps[s2]; }
  }
  // bare floor: the floor pixel farthest from anything that is not floor
  var bare = null, bestD = -1;
  const notFloor = new Uint8Array(W * H);
  for (var j3 = 0; j3 < W * H; j3++) if (!mFlat.m[j3]) notFloor[j3] = 1;
  const notFloorFar = p.ikDilate(notFloor, W, H, 130);
  for (var y3 = 0; y3 < H; y3++) for (var x3 = 0; x3 < W; x3++) {
    var i3 = y3 * W + x3;
    if (mFlat.m[i3] && !notFloorFar[i3]) { var dd = y3; if (dd > bestD) { bestD = dd; bare = { cx: x3, cy: y3 }; } }
  }

  const R = 130;
  const disc = (c) => c ? p.ikDiscEnrich(L, W, H, c.cx, c.cy, R, 0.02) : null;

  // ── THE FLOOR-SIDE RAIL. A sub-25-luma sample ON THE FLOOR beside him cannot be the
  //    character's own artwork, cannot be the ink line, and has no counterpart in the
  //    lobby (nothing darkens the podium there). It is the black wreath, and nothing else.
  var ringDark = 0, ringN = 0;
  for (var q5 = 0; q5 < W * H; q5++) if (ring.m[q5]) { ringN++; if (L[q5] < ACC.darkThr) ringDark++; }

  return {
    W: W, H: H, restore: restore, restore2: restore2, decalStuck: decalStuck,
    n: { hero: mHero.n, flat: mFlat.n, stand: mStand.n, ring: ring.n, open: openA.n,
         inkMeshes: p.ink.length, decalMeshes: p.decals.length, heroMeshes: p.hero.length },
    notch:      { n: notch.n, nBand: notch.nBand, nBody: notch.nBody, minL: notch.minL },
    notchNoAO:  { n: notchNoAO.n, nBand: notchNoAO.nBand, nBody: notchNoAO.nBody, minL: notchNoAO.minL },
    notchNoInk: { n: notchNoInk.n, nBand: notchNoInk.nBand, nBody: notchNoInk.nBody, minL: notchNoInk.minL },
    heroL: p.ikStats(L, mHero.m, W, H),
    ringL: p.ikStats(L, ring.m, W, H),
    openL: p.ikStats(L, openA.m, W, H),
    ringDark: { n: ringDark, of: ringN, pct: ringN ? 100 * ringDark / ringN : NaN },
    lobesNo: lobesNo,
    lobes: { n: lobes.n, peak: lobes.peak, mass: lobes.mass, vacuous: lobes.vacuous,
             at: lobes.comps.map((c) => [c.x, c.y]),
             v: lobes.comps.map((c) => Math.round(c.v * 10) / 10),
             prom: lobes.comps.map((c) => Math.round(c.prom * 10) / 10) },
    layers: { ao: layer(Lno.ao), decal: layer(Lno.dec), cast: layer(Lno.cast), ink: layer(Lno.ink), allOff: layer(Loff) },
    disc: { hero: disc(heroC), prop: disc(propC), bare: disc(bare),
            heroArea: heroC ? heroC.area : 0, propArea: propC ? propC.area : 0,
            propAt: propC ? [Math.round(propC.cx), Math.round(propC.cy)] : null,
            bareAt: bare ? [bare.cx, bare.cy] : null },
    band: p.band(A, W, H, 0.35, 0.62, true),
    frame: p.band(A, W, H, 0, 1, true),
    counts: p.counts(),
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
    // 🚨 #boot ("Heating the kitchen...") IS A CSS-ANIMATED CURTAIN, AND FREEZING THE
    // ANIMATIONS AT currentTime = 0 CAN PIN IT FULLY OPAQUE. gl.readPixels never sees it
    // — it reads the GL back buffer — so every NUMBER in a run is correct while every
    // page.screenshot() PNG is a purple card with a caption on it. That is the inverse of
    // AGENT-BRIEF §3's documented trap (a fixed HUD keyframe landing inside a
    // locator('canvas') capture) and it cost this round one sweep's worth of pictures.
    // Killed before the animations are paused, and asserted below rather than hoped for.
    const boot = document.getElementById('boot');
    if (boot) boot.remove();
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
  await page.evaluate(`window.__ikPlayer = ${JSON.stringify(player)};`);
  await page.evaluate(PAGE_SRC);
  await page.evaluate(`window.__ikMeasure = ${MEASURE};`);
  const curtain = await page.evaluate(() => !!document.getElementById('boot'));
  if (curtain) throw new Error('the #boot curtain is still in the DOM — every screenshot below would be a picture of it');
}

async function driftControl(page, label) {
  const d = await page.evaluate(() => {
    const A = window.__ik.shot(), B = window.__ik.shot();
    return window.__ik.diff(A, B);
  });
  const okd = d.mean === 0 && d.max === 0;
  console.log(`  drift [${label}] mean ${d.mean.toFixed(6)} max ${d.max} pct ${d.pct.toFixed(4)}%  `
    + (okd ? 'EXACTLY ZERO' : '🔴 DRIFTS — nothing below it is a measurement'));
  return { ...d, ok: okd };
}

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const BASE = (get('--url', null) ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = get('--out', 'tools/tmp/dp3_out');
const LABEL = get('--label', 'run');
const MODE = get('--mode', 'frame');
const PLAYER = get('--player', 'hamburger');

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

function report(id, r) {
  const f = (v, d = 2) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : String(v));
  console.log(`\n  ── ${id} ──`);
  console.log(`    masks   hero ${r.n.hero}  flat ${r.n.flat}  ring ${r.n.ring}  open ${r.n.open}  ink meshes ${r.n.inkMeshes}`);
  console.log(`    NOTCHES shipped ${r.notch.n}   (AO off ${r.notchNoAO.n} · ink off ${r.notchNoInk.n})   band ${r.notch.nBand}px  minLuma ${f(r.notch.minL, 1)}`);
  console.log(`    hero luma  min ${f(r.heroL.min, 1)}  p01 ${f(r.heroL.p01, 1)}  p50 ${f(r.heroL.p50, 1)}`);
  console.log(`    ring luma  min ${f(r.ringL.min, 1)}  p01 ${f(r.ringL.p01, 1)}  p50 ${f(r.ringL.p50, 1)}   open p50 ${f(r.openL.p50, 1)}`);
  console.log(`    RING <25 luma  ${r.ringDark.n} of ${r.ringDark.of} px (${f(r.ringDark.pct)}%)  — floor pixels, so neither the ink nor his own artwork`);
  console.log(`    LOBES   ${r.lobes.n}  peak ${f(r.lobes.peak, 1)} codes  at ${JSON.stringify(r.lobes.at)}  prom ${JSON.stringify(r.lobes.prom)}`);
  console.log(`      without one layer:  ao ${r.lobesNo.ao}  decal ${r.lobesNo.decal}  cast ${r.lobesNo.cast}`);
  const L = r.layers;
  console.log(`    layers (dMean codes REMOVED from the contact window)  ao ${f(L.ao.dMean)}  decal ${f(L.decal.dMean)}  cast ${f(L.cast.dMean)}  ink ${f(L.ink.dMean)}  allOff ${f(L.allOff.dMean)}`);
  const d = r.disc;
  console.log(`    darkest-2% enrichment in a 130px disc:  hero ${f(d.hero?.enrich)}  MATCHED PROP ${f(d.prop?.enrich)} @${JSON.stringify(d.propAt)} area ${d.propArea} (hero area ${d.heroArea})  bare floor ${f(d.bare?.enrich)} @${JSON.stringify(d.bareAt)}`);
  console.log(`    frame   vP10 ${f(r.frame.vP10, 3)}  <V.45 ${f(100 * r.frame.belowV45)}%  meanChroma ${f(r.frame.meanChroma, 4)}  draws ${r.counts.draws}`);
}

function guard(id, r) {
  if (!subjectOk(r.n)) throw new Error(`${id}: hero ${r.n.hero}px flat ${r.n.flat}px — the SUBJECT IS NOT IN SHOT, every row below would be about the sky`);
  if (r.decalStuck === false && r.n.decalMeshes > 0) throw new Error(`${id}: the decal ablation did NOT stick — the scene put it back before the frame drew`);
  requireNotches(`${id}.notch`, r.notch);
  requireLobes(`${id}.lobes`, r.lobes);
  requireNonEmpty(`${id}.ring`, r.ringL);
  if (!r.ringDark.of) throw new Error(`${id}: the ring is EMPTY — ringDark would be a vacuous 0`);
  requireNonEmpty(`${id}.open`, r.openL);
  if (r.restore.max !== 0 || r.restore2.max !== 0)
    throw new Error(`${id}: the ablations did not restore the frame (max ${r.restore.max}/${r.restore2.max}) — no row is single-variable`);
}

async function modeFrame() {
  await mkdir(OUT, { recursive: true });
  const { fog, list } = await stations();
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    const page = await newPage(browser, 1600, 900);
    // ⚠️ a fresh snapshot's FIRST client eats a dep-optimisation reload presenting as
    // "execution context was destroyed" — warm it with a cheap load first.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
    for (const st of list) {
      await bootMatch(page, BASE, { px: st.x, py: st.y, fog, player: PLAYER });
      const drift = await driftControl(page, st.id);
      const r = await page.evaluate(`window.__ikMeasure(${JSON.stringify(ACCEPT)})`);
      guard(st.id, r);
      report(st.id, r);
      await page.screenshot({ path: `${OUT}/${LABEL}_${st.id}_58.png` });
      rows.push({ station: st.id, drift, ...r });
    }
  } finally { await browser.close(); }
  if (!rows.length) throw new Error('no station produced a row — vacuous');
  await writeFile(`${OUT}/ink_${LABEL}.json`, JSON.stringify({ mode: 'frame', base: BASE, accept: ACCEPT, rows }, null, 1));
  console.log(`\nwrote ${OUT}/ink_${LABEL}.json`);
}

async function modeLobby() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await newPage(browser, 1600, 900);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
    await page.goto(`${BASE}/?screen=select&char=${PLAYER}`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForFunction("document.body.dataset.screen === 'select' || document.querySelector('.char-stage')", null, { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(1400);
    await freeze(page);
    if (await page.evaluate(() => !!document.getElementById('boot')))
      throw new Error('the #boot curtain is still in the DOM — the lobby PNG would be a picture of it');
    const has3 = await page.evaluate('!!window.__stage');
    if (!has3) throw new Error('no window.__stage on the select screen — the lobby arm would be vacuous');
    await page.evaluate(`window.__ikPlayer = ${JSON.stringify(PLAYER)};`);
    await page.evaluate(PAGE_SRC.replace("getObjectByName('arena:kitchen')", "getObjectByName('arena:kitchen') || scene"));
    const drift = await driftControl(page, 'lobby');
    const r = await page.evaluate(() => {
      const p = window.__ik, W = p.W, H = p.H;
      const A = p.shot();
      const ao = window.__stage.contactAO;
      const aoWas = ao ? ao.intensity : 0;
      if (ao) ao.intensity = 0;
      const A0 = p.shot();
      p.setVis(p.hero, false);
      const B = p.shot();
      p.setVis(p.hero, true);
      const mHero = p.ikDiff(A0, B, W, H, 8);
      if (ao) ao.intensity = aoWas;
      const A2 = p.shot();
      const L = p.ikLumaPlane(A, W, H);
      const acc = { darkThr: 25, bodyLo: 165, bodyHi: 215, bodyR: 6, edgePx: 2, lobeFrac: 0.5, minArea: 40, ringPx: 8 };
      const notch = p.ikNotches(L, mHero.m, W, H, acc);
      return { W, H, restore: p.diff(A, A2), n: { hero: mHero.n, flat: 99999 },
        notch: { n: notch.n, nBand: notch.nBand, nBody: notch.nBody, minL: notch.minL },
        heroL: p.ikStats(L, mHero.m, W, H), counts: p.counts(),
        frame: p.band(A, W, H, 0, 1, true) };
    });
    if (!subjectOk(r.n)) throw new Error(`lobby: hero ${r.n.hero}px — NOT IN SHOT`);
    requireNotches('lobby.notch', r.notch);
    if (r.restore.max !== 0) throw new Error(`lobby: ablation did not restore (max ${r.restore.max})`);
    console.log(`\n  ── lobby (charStage, pitch 20) ──`);
    console.log(`    hero ${r.n.hero}px   NOTCHES ${r.notch.n}   band ${r.notch.nBand}px  minLuma ${r.notch.minL.toFixed(1)}`);
    console.log(`    hero luma min ${r.heroL.min.toFixed(1)}  p01 ${r.heroL.p01.toFixed(1)}  p50 ${r.heroL.p50.toFixed(1)}   draws ${r.counts.draws}`);
    await page.screenshot({ path: `${OUT}/${LABEL}_lobby_20.png` });
    await writeFile(`${OUT}/ink_lobby_${LABEL}.json`, JSON.stringify({ mode: 'lobby', base: BASE, drift, ...r }, null, 1));
    console.log(`wrote ${OUT}/ink_lobby_${LABEL}.json`);
  } finally { await browser.close(); }
}

/** Live `caoFloor` sweep on ONE frozen frame — no rebuild, so no row can be content drift. */
async function modeSweep() {
  await mkdir(OUT, { recursive: true });
  const floors = String(get('--floors', '0,0.35,0.45,0.55,0.65')).split(',').map(Number);
  const stationId = get('--station', 'hub');
  const { fog, list } = await stations();
  const st = list.find((s) => s.id === stationId);
  if (!st) throw new Error(`no station '${stationId}'`);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    const page = await newPage(browser, 1600, 900);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
    await bootMatch(page, BASE, { px: st.x, py: st.y, fog, player: PLAYER });
    const d0 = await driftControl(page, `${stationId} open`);
    const hasFloor = await page.evaluate('window.__stage.contactAO && window.__stage.contactAO.floor !== undefined');
    if (!hasFloor) throw new Error('this tree has no ContactAOEffect.floor — the sweep would be vacuous');
    // 🚨 THE IDENTITY ARM, AND IT HAS TO BE IN-PAGE. A cross-TREE PNG diff of the same
    // commit at floor 0 against the previous commit is NOT zero and cannot be: two page
    // loads of one tree differ in HUD state and in a speckle around the fighter (6,218 px
    // of 1,440,000 measured here), which is the same cross-load spread round 2 reported
    // as -2 draws between loads. So the single-variable proof is A-B-A on ONE frozen
    // frame: capture at floor 0, run every row, come back to floor 0, require the frame
    // to be BIT-IDENTICAL. Anything else and the rows below are two variables.
    await page.evaluate('window.__stage.contactAO.floor = 0;');
    const aba0 = await page.evaluate(() => { window.__ikABA = window.__ik.shot(); return window.__ikABA.length; });
    if (!aba0) throw new Error('the A-B-A reference frame is empty');
    for (const fl of floors) {
      await page.evaluate(`window.__stage.contactAO.floor = ${fl};`);
      const r = await page.evaluate(`window.__ikMeasure(${JSON.stringify(ACCEPT)})`);
      guard(`${stationId} floor=${fl}`, r);
      report(`${stationId} floor=${fl}`, r);
      await page.screenshot({ path: `${OUT}/${LABEL}_${stationId}_f${String(fl).replace('.', '')}.png` });
      rows.push({ floor: fl, ...r });
    }
    await page.evaluate('window.__stage.contactAO.floor = 0;');
    const aba = await page.evaluate(() => window.__ik.diff(window.__ikABA, window.__ik.shot()));
    const abaOk = aba.mean === 0 && aba.max === 0;
    console.log(`  A-B-A [floor 0 -> every row -> floor 0] mean ${aba.mean.toFixed(6)} max ${aba.max} pct ${aba.pct.toFixed(4)}%  `
      + (abaOk ? 'BIT-IDENTICAL — every row above differs by the uniform and nothing else' : '🔴 NOT IDENTICAL — the rows are not single-variable'));
    if (!abaOk) throw new Error('the A-B-A identity arm did not close — refusing to publish the sweep');
    const dZ = await driftControl(page, `${stationId} close`);
    rows.push({ driftOpen: d0, driftClose: dZ, aba });
  } finally { await browser.close(); }
  await writeFile(`${OUT}/sweep_${LABEL}_${stationId}.json`, JSON.stringify({ mode: 'sweep', station: stationId, base: BASE, rows }, null, 1));
  console.log(`\nwrote ${OUT}/sweep_${LABEL}_${stationId}.json`);
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('dp3_ink.mjs');
if (IS_MAIN) {
  if (has('--selftest')) { process.exitCode = selftest() ? 0 : 1; }
  else if (MODE === 'frame') await modeFrame();
  else if (MODE === 'lobby') await modeLobby();
  else if (MODE === 'sweep') await modeSweep();
  else { console.error(`unknown --mode ${MODE}`); process.exitCode = 2; }
}

export { IK, IK_MATH, ACCEPT, selftest };
