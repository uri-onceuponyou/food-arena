#!/usr/bin/env node
/**
 * p6_flat.mjs — "flat and unlit" measured DIRECTLY, identically on our frame and on a
 * reference plate. READ-ONLY probe. Writes nothing except its own JSON/PNGs.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * 6/6 critics said "surfaces are flat and unlit, no material variation, no contact
 * shadow, no depth". `docs/LESSONS.md` §3: critics name SYMPTOMS accurately and
 * MECHANISMS badly. "Flat" is a claim about LOCAL VALUE VARIATION — a gradient claim —
 * and nobody on this project has ever measured a gradient on BOTH sides. Every existing
 * instrument measures either our side only (valuescan's ladder is on a character matte)
 * or colour only (arena-scan / chroma). So this measures the gradient claim itself.
 *
 * ── Normalisation, and why ──────────────────────────────────────────────────────
 * Both sides are resized to a common frame HEIGHT (default 512) before anything is
 * computed, so a window of N px is the same FRACTION OF FRAME on both sides. This is
 * load-bearing: reference plates are 1176x~740 and ours is 1600x900, and
 * `docs/LESSONS.md` §3 records that the plates arrive UPSCALED 1.33-1.43x, delivering
 * 0.42-0.48x our edge acuity. So any metric run at native resolution is biased AGAINST
 * the reference in the high band. Downsampling to a common height removes most of that,
 * and the bands are reported separately so the residual bias is visible rather than
 * folded into one number.
 *
 * ── The metrics ─────────────────────────────────────────────────────────────────
 * luma          gamma-space Rec.709 on sRGB 0..1 (perceptual-ish, and the same space
 *               every other value number on this project is quoted in)
 * p01/p05/p50/p95, range, sd, darkShare(<0.15), clipShare(>0.94)
 * band[k]       Laplacian-pyramid RMS: RMS(blur_s - blur_2s) for s = 2,4,8,16,32,64 px
 *               at the working height. s=8 at H=512 is a feature ~1/32 of frame height
 *               = OBJECT SCALE. This is "flat", binned by spatial frequency.
 * lrange(r)     mean of (localMax - localMin) over a square window of radius r
 * deadShare(r)  SHARE OF FRAME whose local range over r is < 0.10.
 *               0.10 is NOT invented: it is this project's own recorded lighting
 *               acceptance threshold (figure/ground >= 0.10; |dL| < 0.05 == "no value
 *               contrast at all"). A pixel in deadShare sits in a region that this
 *               project has already agreed presents no visible value step.
 * edge          Sobel |grad| per px: p90/p99, and density above 0.06/px
 * meanSat       HSV S, unweighted (same definition arena-scan/chroma use)
 * hueBins12     chroma-weighted hue histogram; hueFamilies = bins holding >= 8%
 *
 * ── Instrument validation (--selftest, and the --degrade path) ───────────────────
 * A metric that only scores our side is worthless, and a metric that has not been shown
 * to FAIL on a known-bad input is one of this project's nineteen. So:
 *   --selftest   synthetic frames with hand-derivable answers, including the two that
 *                matter: a FLAT frame must floor every gradient metric, and a frame with
 *                the SAME global histogram but no local structure must ALSO floor them
 *                (that is the whole point — global stats cannot see "flat").
 *   --degrade    writes two known-bad copies of a real plate:
 *                  .gflat  L' = mean + (L-mean)*0.5      (global contrast crush)
 *                  .lflat  L' = blur16 + (L-blur16)*0.25 (LOCAL flatten; the global
 *                          histogram barely moves, which is the discriminating case)
 *                Both must score BELOW the clean plate on the local metrics, and .lflat
 *                must move the local metrics MUCH more than the global ones.
 *
 * Usage:
 *   node tools/tmp/p6_flat.mjs --selftest
 *   node tools/tmp/p6_flat.mjs --degrade <png> --outdir shots/p6/deg
 *   node tools/tmp/p6_flat.mjs --imgs a.png,b.png --labels ours,ref --json shots/p6/m.json
 *   node tools/tmp/p6_flat.mjs --imgs a.png --crop 0,0,1,0.13     # x0,y0,x1,y1 fractions
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

// ───────────────────────────────────────────────────────────────── args
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const WORK_H = Number(args.height ?? 512);

// ───────────────────────────────────────────────────────────────── filters
/** Exact box blur of radius r via prefix sums, separable. Edge = clamp. */
function boxBlur1(src, W, H, r, horiz) {
  const dst = new Float32Array(W * H);
  if (r <= 0) { dst.set(src); return dst; }
  const n = horiz ? W : H, m = horiz ? H : W;
  const idx = horiz ? (i, j) => j * W + i : (i, j) => i * W + j;
  const pre = new Float64Array(n + 1);
  for (let j = 0; j < m; j++) {
    pre[0] = 0;
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + src[idx(i, j)];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - r), b = Math.min(n - 1, i + r);
      // clamp-extend: pixels off the left/right repeat the edge sample
      const inner = pre[b + 1] - pre[a];
      const leftPad = Math.max(0, r - i) * src[idx(0, j)];
      const rightPad = Math.max(0, i + r - (n - 1)) * src[idx(n - 1, j)];
      dst[idx(i, j)] = (inner + leftPad + rightPad) / (2 * r + 1);
    }
  }
  return dst;
}
/** 3 box passes ~= Gaussian of the given sigma (Kutskir's boxesForGauss). */
function gauss(src, W, H, sigma) {
  if (sigma <= 0) return Float32Array.from(src);
  const n = 3;
  const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  let cur = Float32Array.from(src);
  for (let i = 0; i < n; i++) {
    const w = i < m ? wl : wu;
    const r = Math.max(0, (w - 1) >> 1);
    cur = boxBlur1(cur, W, H, r, true);
    cur = boxBlur1(cur, W, H, r, false);
  }
  return cur;
}
/** Exact running min/max over a square window, monotonic deque, separable. */
function runMinMax1(src, W, H, r, horiz, isMax) {
  const dst = new Float32Array(W * H);
  const n = horiz ? W : H, m = horiz ? H : W;
  const idx = horiz ? (i, j) => j * W + i : (i, j) => i * W + j;
  const dq = new Int32Array(n + 1);
  for (let j = 0; j < m; j++) {
    let head = 0, tail = 0;
    const better = isMax ? (a, b) => a >= b : (a, b) => a <= b;
    for (let i = 0; i < n + r; i++) {
      if (i < n) {
        const v = src[idx(i, j)];
        while (tail > head && better(v, src[idx(dq[tail - 1], j)])) tail--;
        dq[tail++] = i;
      }
      const o = i - r;
      if (o >= 0) {
        while (dq[head] < o - r) head++;
        dst[idx(o, j)] = src[idx(dq[head], j)];
      }
    }
  }
  return dst;
}
function localMin(src, W, H, r) { return runMinMax1(runMinMax1(src, W, H, r, true, false), W, H, r, false, false); }
function localMax(src, W, H, r) { return runMinMax1(runMinMax1(src, W, H, r, true, true), W, H, r, false, true); }

// ───────────────────────────────────────────────────────────────── load
function srgbLuma(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

async function loadFrame(path, crop) {
  let img = sharp(path);
  const meta = await img.metadata();
  if (crop) {
    const [fx0, fy0, fx1, fy1] = crop;
    const left = Math.round(fx0 * meta.width), top = Math.round(fy0 * meta.height);
    const w = Math.max(1, Math.round((fx1 - fx0) * meta.width));
    const h = Math.max(1, Math.round((fy1 - fy0) * meta.height));
    img = img.extract({ left, top, width: w, height: h });
  }
  // Resize to a common frame HEIGHT so a window of N px is the same fraction of frame.
  const { data, info } = await img
    .resize({ height: WORK_H, fit: 'inside', kernel: 'lanczos3' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const L = new Float32Array(N);
  const S = new Float32Array(N);
  const C = new Float32Array(N);
  const Hue = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    L[i] = srgbLuma(r, g, b);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    C[i] = (mx - mn) / 255;
    S[i] = mx === 0 ? 0 : (mx - mn) / mx;
    let h = 0;
    if (mx !== mn) {
      const d = mx - mn;
      if (mx === r) h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    Hue[i] = (h + 360) % 360;
  }
  return { L, S, C, Hue, W, H, N, src: path, nativeW: meta.width, nativeH: meta.height };
}

// ───────────────────────────────────────────────────────────────── metrics
function quantile(sorted, q) {
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function rms(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }
function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }

/** Sobel gradient magnitude in luma-per-pixel at the working resolution. */
function sobelMag(L, W, H) {
  const out = new Float32Array(W * H);
  const at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      out[y * W + x] = Math.hypot(gx, gy) / 8;
    }
  }
  return out;
}

const DEAD_T = 0.10;   // this project's own "visible value step" threshold

export function measure(f) {
  const { L, S, C, Hue, W, H, N } = f;
  const sorted = Float32Array.from(L).sort();
  const p01 = quantile(sorted, 0.01), p05 = quantile(sorted, 0.05);
  const p50 = quantile(sorted, 0.50), p95 = quantile(sorted, 0.95), p99 = quantile(sorted, 0.99);
  const mu = mean(L);
  let v = 0; for (let i = 0; i < N; i++) v += (L[i] - mu) * (L[i] - mu);
  const sd = Math.sqrt(v / N);
  let dark = 0, clip = 0, hi70 = 0, hi80 = 0;
  for (let i = 0; i < N; i++) {
    if (L[i] < 0.15) dark++;
    if (L[i] > 0.94) clip++;
    if (L[i] > 0.70) hi70++;
    if (L[i] > 0.80) hi80++;
  }

  // Laplacian pyramid bands, sigma in px at the working height
  const sigmas = [2, 4, 8, 16, 32, 64];
  const blurs = sigmas.map((s) => gauss(L, W, H, s));
  const band = {};
  for (let k = 0; k < sigmas.length - 1; k++) {
    const d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = blurs[k][i] - blurs[k + 1][i];
    band[`s${sigmas[k]}`] = +rms(d).toFixed(5);
  }
  {
    const d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = L[i] - blurs[0][i];
    band.s1 = +rms(d).toFixed(5);
  }

  // local range + dead share, at object scale and at detail scale
  const lr = {};
  const dead = {};
  for (const r of [4, 8, 16]) {          // 0.8% / 1.6% / 3.1% of frame height
    const mn = localMin(L, W, H, r), mx = localMax(L, W, H, r);
    const rng = new Float32Array(N);
    let nd = 0;
    for (let i = 0; i < N; i++) { rng[i] = mx[i] - mn[i]; if (rng[i] < DEAD_T) nd++; }
    lr[`r${r}`] = +mean(rng).toFixed(4);
    dead[`r${r}`] = +(nd / N).toFixed(4);
  }

  // edges
  const g = sobelMag(L, W, H);
  const gs = Float32Array.from(g).sort();
  let e06 = 0; for (let i = 0; i < N; i++) if (g[i] > 0.06) e06++;

  // colour
  const meanSat = mean(S), meanChroma = mean(C);
  const hb = new Float64Array(12);
  let ctot = 0;
  for (let i = 0; i < N; i++) { const b = Math.min(11, Math.floor(Hue[i] / 30)); hb[b] += C[i]; ctot += C[i]; }
  const hueBins = Array.from(hb, (x) => +(ctot ? x / ctot : 0).toFixed(4));
  const hueFamilies = hueBins.filter((x) => x >= 0.08).length;

  return {
    W, H,
    mean: +mu.toFixed(4), sd: +sd.toFixed(4),
    p01: +p01.toFixed(4), p05: +p05.toFixed(4), p50: +p50.toFixed(4),
    p95: +p95.toFixed(4), p99: +p99.toFixed(4),
    range: +(p95 - p05).toFixed(4),
    darkShare: +(dark / N).toFixed(4), clipShare: +(clip / N).toFixed(4),
    hi70: +(hi70 / N).toFixed(4), hi80: +(hi80 / N).toFixed(4),
    band,
    lrange: lr, dead,
    edgeP90: +quantile(gs, 0.90).toFixed(4), edgeP99: +quantile(gs, 0.99).toFixed(4),
    edgeDensity06: +(e06 / N).toFixed(4),
    meanSat: +meanSat.toFixed(4), meanChroma: +meanChroma.toFixed(4),
    hueBins, hueFamilies,
  };
}

// ───────────────────────────────────────────────────────────────── degrade
async function degrade(path, outdir) {
  mkdirSync(outdir, { recursive: true });
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = srgbLuma(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  const mu = mean(L);
  const blur = gauss(L, W, H, Math.round(H / 32));   // ~3% of frame height

  const write = async (name, mapL) => {
    const out = Buffer.alloc(N * 3);
    for (let i = 0; i < N; i++) {
      const l0 = Math.max(1e-4, L[i]);
      const l1 = Math.max(0, Math.min(1, mapL(i, l0)));
      const k = l1 / l0;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, Math.min(255, Math.round(data[i * 3 + c] * k)));
    }
    const p = `${outdir}/${basename(path, '.png')}.${name}.png`;
    await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(p);
    return p;
  };
  const a = await write('gflat', (i, l) => mu + (l - mu) * 0.5);
  const b = await write('lflat', (i, l) => blur[i] + (l - blur[i]) * 0.25);
  return [a, b];
}

// ───────────────────────────────────────────────────────────────── selftest
function synth(W, H, fn) {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * W + x) * 3;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

async function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail ?? ''}`); }
  };
  const tmp = 'shots/p6/_selftest';
  mkdirSync(tmp, { recursive: true });
  const W = 800, H = 700;

  // 1. FLAT: a single value. Every gradient metric must floor; dead must be 1.0.
  const flat = `${tmp}/flat.png`;
  await sharp(await synth(W, H, () => [140, 100, 160]), {}).toFile(flat);
  const mFlat = measure(await loadFrame(flat));
  ok('flat: band s8 ~ 0', mFlat.band.s8 < 0.002, `s8=${mFlat.band.s8}`);
  ok('flat: dead r16 == 1.0', mFlat.dead.r16 > 0.999, `dead=${mFlat.dead.r16}`);
  ok('flat: lrange r16 ~ 0', mFlat.lrange.r16 < 0.005, `lr=${mFlat.lrange.r16}`);
  ok('flat: edgeDensity == 0', mFlat.edgeDensity06 < 0.001, `ed=${mFlat.edgeDensity06}`);

  // 2. SAME GLOBAL HISTOGRAM, NO LOCAL STRUCTURE.
  //    Two halves, one dark one light: identical global sd to a checker of the same two
  //    values, but the checker has local structure and the split does not. This is the
  //    discriminating case: global stats CANNOT tell them apart; the local metrics must.
  const A = 60, B = 200;
  const split = `${tmp}/split.png`, checker = `${tmp}/checker.png`;
  await sharp(await synth(W, H, (x) => (x < W / 2 ? [A, A, A] : [B, B, B]))).toFile(split);
  await sharp(await synth(W, H, (x, y) => (((x / 40 | 0) + (y / 40 | 0)) % 2 ? [A, A, A] : [B, B, B]))).toFile(checker);
  const mSplit = measure(await loadFrame(split));
  const mCheck = measure(await loadFrame(checker));
  ok('split vs checker: global sd within 5%',
    Math.abs(mSplit.sd - mCheck.sd) / mCheck.sd < 0.05, `${mSplit.sd} vs ${mCheck.sd}`);
  ok('split vs checker: dead r16 SEPARATES them',
    mSplit.dead.r16 - mCheck.dead.r16 > 0.90, `${mSplit.dead.r16} vs ${mCheck.dead.r16}`);
  ok('split vs checker: band s8 SEPARATES them',
    mCheck.band.s8 > 4 * mSplit.band.s8, `${mCheck.band.s8} vs ${mSplit.band.s8}`);

  // 3. BAND SELECTIVITY: a coarse checker must load a coarse band, a fine one a fine band.
  const fine = `${tmp}/fine.png`, coarse = `${tmp}/coarse.png`;
  await sharp(await synth(W, H, (x, y) => (((x / 8 | 0) + (y / 8 | 0)) % 2 ? [A, A, A] : [B, B, B]))).toFile(fine);
  await sharp(await synth(W, H, (x, y) => (((x / 96 | 0) + (y / 96 | 0)) % 2 ? [A, A, A] : [B, B, B]))).toFile(coarse);
  const mFine = measure(await loadFrame(fine)), mCoarse = measure(await loadFrame(coarse));
  ok('fine checker loads the FINE band', mFine.band.s1 > mFine.band.s16, `s1=${mFine.band.s1} s16=${mFine.band.s16}`);
  ok('coarse checker loads the COARSE band', mCoarse.band.s16 > mCoarse.band.s1, `s16=${mCoarse.band.s16} s1=${mCoarse.band.s1}`);

  // 4. DEAD SHARE responds to the SIZE of the flat region, not to its value.
  const mixed = `${tmp}/mixed.png`;
  await sharp(await synth(W, H, (x, y) => (x > W * 0.6 ? [130, 130, 130]
    : (((x / 20 | 0) + (y / 20 | 0)) % 2 ? [A, A, A] : [B, B, B])))).toFile(mixed);
  const mMixed = measure(await loadFrame(mixed));
  ok('dead r16 tracks the flat AREA (~0.40 expected)',
    mMixed.dead.r16 > 0.33 && mMixed.dead.r16 < 0.46, `dead=${mMixed.dead.r16}`);

  // 5. SATURATION is not confounded with value structure.
  const grayCk = `${tmp}/grayck.png`;
  await sharp(await synth(W, H, (x, y) => (((x / 40 | 0) + (y / 40 | 0)) % 2 ? [A, A, A] : [B, B, B]))).toFile(grayCk);
  const mGray = measure(await loadFrame(grayCk));
  ok('grey checker: meanSat == 0 while band s8 is loaded',
    mGray.meanSat < 0.01 && mGray.band.s8 > 0.01, `sat=${mGray.meanSat} s8=${mGray.band.s8}`);

  // 6. KNOWN-BAD ROUND TRIP on a REAL plate: the local-flatten degrade must crater the
  //    local metrics while barely moving the global ones, and the global-flatten must do
  //    the opposite. A metric that cannot tell these apart is measuring the wrong thing.
  const plate = 'reference/images/curated/gameplay_topdown/bs_04.png';
  const [gflat, lflat] = await degrade(plate, tmp);
  const mRef = measure(await loadFrame(plate));
  const mG = measure(await loadFrame(gflat));
  const mL = measure(await loadFrame(lflat));
  ok('degrade lflat: dead r16 RISES vs clean plate',
    mL.dead.r16 > mRef.dead.r16 + 0.10, `${mRef.dead.r16} -> ${mL.dead.r16}`);
  ok('degrade lflat: band s8 FALLS >= 40%',
    mL.band.s8 < mRef.band.s8 * 0.6, `${mRef.band.s8} -> ${mL.band.s8}`);
  ok('degrade lflat: global sd moves LESS than band s8 does (proportionally)',
    Math.abs(mL.sd - mRef.sd) / mRef.sd < Math.abs(mL.band.s8 - mRef.band.s8) / mRef.band.s8,
    `sd ${mRef.sd}->${mL.sd}  s8 ${mRef.band.s8}->${mL.band.s8}`);
  ok('degrade gflat: global sd FALLS ~50%',
    mG.sd < mRef.sd * 0.62 && mG.sd > mRef.sd * 0.38, `${mRef.sd} -> ${mG.sd}`);
  ok('degrade gflat: range FALLS', mG.range < mRef.range * 0.65, `${mRef.range} -> ${mG.range}`);

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
}

// ───────────────────────────────────────────────────────────────── main
async function main() {
  if (args.selftest) return selftest();
  if (args.degrade) {
    const out = await degrade(String(args.degrade), String(args.outdir ?? 'shots/p6/deg'));
    console.log(out.join('\n'));
    return;
  }
  const imgs = String(args.imgs ?? '').split(',').filter(Boolean);
  if (!imgs.length) { console.error('need --imgs a.png,b.png  (or --selftest / --degrade)'); process.exit(2); }
  const labels = String(args.labels ?? '').split(',').filter(Boolean);
  const crop = args.crop ? String(args.crop).split(',').map(Number) : null;
  const rows = [];
  for (let i = 0; i < imgs.length; i++) {
    const f = await loadFrame(imgs[i], crop);
    const m = measure(f);
    rows.push({ label: labels[i] ?? basename(imgs[i]), file: imgs[i], native: [f.nativeW, f.nativeH], ...m });
    console.log(`${(labels[i] ?? basename(imgs[i])).padEnd(28)} `
      + `p05=${m.p05.toFixed(3)} p50=${m.p50.toFixed(3)} p95=${m.p95.toFixed(3)} rng=${m.range.toFixed(3)} sd=${m.sd.toFixed(3)} `
      + `dark=${m.darkShare.toFixed(3)} | s1=${m.band.s1.toFixed(4)} s4=${m.band.s4.toFixed(4)} s8=${m.band.s8.toFixed(4)} s16=${m.band.s16.toFixed(4)} s32=${m.band.s32.toFixed(4)} `
      + `| lr16=${m.lrange.r16.toFixed(3)} dead16=${m.dead.r16.toFixed(3)} dead8=${m.dead.r8.toFixed(3)} `
      + `| sat=${m.meanSat.toFixed(3)} hues=${m.hueFamilies}`);
  }
  if (args.json) {
    mkdirSync(String(args.json).replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(String(args.json), JSON.stringify({ workHeight: WORK_H, crop, rows }, null, 2));
    console.log(`\n-> ${args.json}`);
  }
}
// Only run as a CLI. Importing this module must not run the CLI — p6_regions.mjs
// imports `measure`, and without this guard p6_flat's own main() re-ran on the
// importer's argv and printed a second, interleaved table. (An instrument that
// silently does someone else's work is how a number ends up attributed wrong.)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
