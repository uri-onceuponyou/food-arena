#!/usr/bin/env node
/**
 * WT_VOL — does the pool read as a VOLUME or as a DECAL? Four numbers, one fixed mask.
 *
 * ## Why a FIXED mask, and why it is taken from the BEFORE frame
 *
 * Every metric here is "inside the pool vs outside it", so it needs a pool mask. The
 * obvious mask is a hue classification of the frame being measured — and that is a
 * TRAP for this particular change: making the liquid more transparent moves rim pixels
 * toward the floor's magenta and drops them out of the water hue window, so the AFTER
 * arm would be measured over a SMALLER region than the BEFORE arm and every ratio
 * would move for a reason that has nothing to do with what the change did.
 *
 * So the mask is classified ONCE, on `--mask`, and applied to every frame. Both arms
 * are the same station, the same `?t=`, the same span and the same geometry — this
 * change touches shading and alpha only — so one mask is correct for both. `--mask` is
 * printed on every run and the frames are asserted to be the same size as it.
 *
 * ## The four numbers
 *
 *   T  SEAM TRANSMISSION. Mean local contrast (|luma - 9x9 box mean|) inside the
 *      eroded pool against the floor ring outside it. The floor's mortar seams are the
 *      bed; if the liquid is an opaque decal, the bed's detail does not survive under
 *      it and T collapses. Reported as a RATIO, because absolute contrast depends on
 *      what tiles happen to be under this pool.
 *   G  SHORE-TO-CENTRE GRADIENT. Every masked pixel gets rho = |p - centroid| divided
 *      by the distance from the centroid to the mask boundary ALONG THE SAME RAY, so
 *      rho is a shore coordinate in screen space and it works on a lobed outline. Ten
 *      bins, plus the centre-minus-shore luma delta. A pool with no depth read is flat
 *      in rho; a pool with one is monotone in it.
 *   W  RIM STROKE FORESHORTENING. Walk inward from the boundary until saturation drops
 *      below the midpoint between the rim's and the interior's, at boundary points
 *      whose inward normal is mostly VERTICAL on screen (the far/near shore, which a
 *      ground-plane camera compresses by sin(pitch)) and mostly HORIZONTAL (the sides,
 *      which it does not). A world-unit stroke has far/side ~ sin(pitch); a screen-unit
 *      one has far/side ~ 1.
 *   L  Pool mean luma against the surrounding floor's.
 *
 * ## Rule 6 — every filtered set is asserted NON-EMPTY before anything is divided by it
 *
 * `[].every()` is true, `0/0` is NaN, and both read as a pass. Every population here
 * (mask, eroded mask, outside ring, each rho bin, each of the two W families) throws
 * if it is empty rather than returning a number computed over nothing.
 *
 *   node tools/tmp/wt_vol.mjs --selftest
 *   node tools/tmp/wt_vol.mjs --mask before_water_p58.png \
 *        --kind water --frames before_water_p58.png,after_water_p58.png
 */
import sharp from 'sharp';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rgbToHsv } from './wt_shot.mjs';

const HUE = { water: [178, 224], grease: [22, 62] };
const SAT_FLOOR = 0.24, VAL_FLOOR = 0.14;

export async function raster(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

export function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

/** Boolean mask of pixels inside `hue` at real saturation. */
export function classify(img, hue) {
  const { width: w, height: h, channels: ch } = img;
  const m = new Uint8Array(w * h);
  let n = 0;
  for (let i = 0, p = 0; p < w * h; p++, i += ch) {
    const { h: hh, s, v } = rgbToHsv(img.data[i], img.data[i + 1], img.data[i + 2]);
    if (s >= SAT_FLOOR && v >= VAL_FLOOR && hh >= hue[0] && hh <= hue[1]) { m[p] = 1; n++; }
  }
  return { m, n, w, h };
}

/** Largest 4-connected component — a hue window catches stray props elsewhere in the
 * frame (a teal pot, a warm crate) and a centroid taken over those is not the pool's. */
export function largestBlob(mask) {
  const { m, w, h } = mask;
  const lab = new Int32Array(w * h).fill(-1);
  let best = -1, bestN = 0, id = 0;
  const stack = [];
  for (let p = 0; p < w * h; p++) {
    if (!m[p] || lab[p] >= 0) continue;
    let n = 0; stack.length = 0; stack.push(p); lab[p] = id;
    while (stack.length) {
      const q = stack.pop(); n++;
      const x = q % w, y = (q / w) | 0;
      if (x > 0 && m[q - 1] && lab[q - 1] < 0) { lab[q - 1] = id; stack.push(q - 1); }
      if (x < w - 1 && m[q + 1] && lab[q + 1] < 0) { lab[q + 1] = id; stack.push(q + 1); }
      if (y > 0 && m[q - w] && lab[q - w] < 0) { lab[q - w] = id; stack.push(q - w); }
      if (y < h - 1 && m[q + w] && lab[q + w] < 0) { lab[q + w] = id; stack.push(q + w); }
    }
    if (n > bestN) { bestN = n; best = id; }
    id++;
  }
  if (bestN === 0) throw new Error('wt_vol: no pool blob in the mask frame — NON-EMPTY guard');
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (lab[p] === best) out[p] = 1;
  return { m: out, n: bestN, w, h };
}

/** Erode/dilate by `r` in the Chebyshev metric. */
export function morph(mask, r, dilate = false) {
  const { m, w, h } = mask;
  const out = new Uint8Array(w * h);
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let all = true, any = false;
    for (let dy = -r; dy <= r && (all || !any); dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      const v = (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : m[yy * w + xx];
      if (v) any = true; else all = false;
    }
    const keep = dilate ? any : all;
    if (keep) { out[y * w + x] = 1; n++; }
  }
  return { m: out, n, w, h };
}

/** Mean |luma - box mean| over a population — high-frequency detail, i.e. the bed. */
export function localContrast(img, pop, box = 4) {
  const { width: w, height: h, channels: ch } = img;
  const L = new Float32Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += ch) L[p] = luma(img.data[i], img.data[i + 1], img.data[i + 2]);
  let sum = 0, n = 0;
  for (let y = box; y < h - box; y++) for (let x = box; x < w - box; x++) {
    const p = y * w + x;
    if (!pop.m[p]) continue;
    let s = 0, c = 0;
    for (let dy = -box; dy <= box; dy++) for (let dx = -box; dx <= box; dx++) { s += L[(y + dy) * w + x + dx]; c++; }
    sum += Math.abs(L[p] - s / c); n++;
  }
  if (n === 0) throw new Error('wt_vol: localContrast population is EMPTY — NON-EMPTY guard');
  return { mean: sum / n, n };
}

export function meanLuma(img, pop) {
  const { width: w, height: h, channels: ch } = img;
  let s = 0, n = 0;
  for (let p = 0; p < w * h; p++) {
    if (!pop.m[p]) continue;
    const i = p * ch;
    s += luma(img.data[i], img.data[i + 1], img.data[i + 2]); n++;
  }
  if (n === 0) throw new Error('wt_vol: meanLuma population is EMPTY — NON-EMPTY guard');
  return { mean: s / n, n };
}

/** rho = |p-centroid| / |boundary along that ray - centroid|, per masked pixel. */
export function shoreField(mask) {
  const { m, w, h } = mask;
  let sx = 0, sy = 0, n = 0;
  for (let p = 0; p < w * h; p++) if (m[p]) { sx += p % w; sy += (p / w) | 0; n++; }
  if (n === 0) throw new Error('wt_vol: shoreField mask is EMPTY — NON-EMPTY guard');
  const cx = sx / n, cy = sy / n;
  // Boundary radius per angular bucket, taken as the FURTHEST masked pixel in the
  // bucket — a lobed shape has one boundary per ray and the outermost hit is it.
  const BUCKETS = 720;
  const rmax = new Float32Array(BUCKETS);
  for (let p = 0; p < w * h; p++) {
    if (!m[p]) continue;
    const dx = (p % w) - cx, dy = ((p / w) | 0) - cy;
    const a = Math.atan2(dy, dx);
    const b = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((a + Math.PI) / (2 * Math.PI)) * BUCKETS)));
    const r = Math.hypot(dx, dy);
    if (r > rmax[b]) rmax[b] = r;
  }
  const rho = new Float32Array(w * h).fill(-1);
  for (let p = 0; p < w * h; p++) {
    if (!m[p]) continue;
    const dx = (p % w) - cx, dy = ((p / w) | 0) - cy;
    const a = Math.atan2(dy, dx);
    const b = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((a + Math.PI) / (2 * Math.PI)) * BUCKETS)));
    rho[p] = rmax[b] > 1e-6 ? Math.min(1, Math.hypot(dx, dy) / rmax[b]) : 0;
  }
  return { rho, cx, cy, n };
}

/**
 * ⚠️ AN AGGREGATE `T` ANSWERS THE WRONG QUESTION AND IT TOOK A NULL RESULT TO SEE IT.
 * Depth-driven alpha makes the SHORE transmit more and the CENTRE transmit less, so a
 * single mean over the whole pool is a weighted average of two opposite moves — and
 * the weights are wherever the floor's seams happen to fall under this particular
 * pool. Measured on the round-2 pair, aggregate `T` went UP at pitch 58 and DOWN at
 * pitch 20 for exactly that reason: the seam that crosses the p20 pool runs through
 * its MIDDLE. The claim being made is that transmission TRACKS DEPTH, so the number
 * that tests it is a per-band profile, not a mean.
 */
export function bandStats(img, mask, field, bands = 5, box = 4) {
  const { width: w, height: h, channels: ch } = img;
  const L = new Float32Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += ch) L[p] = luma(img.data[i], img.data[i + 1], img.data[i + 2]);
  const cSum = new Float64Array(bands), cN = new Int32Array(bands);
  const sSum = new Float64Array(bands), sN = new Int32Array(bands);
  // ⚠️ A MEAN OF |luma - boxmean| IS NOT "DOES THE SEAM SURVIVE". Smooth shading
  // contributes to it, and at pitch 20 the pool is compressed hard enough that its OWN
  // features dominate: the centre band reads 9.17 there against 0.48 for the same pool
  // at pitch 58, a factor of 19 that has nothing to do with the floor under it. A
  // mortar seam is the TAIL of that distribution, not its middle, so the arm that
  // actually answers the question is a high quantile.
  const cAll = Array.from({ length: bands }, () => []);
  // ⚠️ AND AN ABSOLUTE DEVIATION IS NOT A CONTRAST. This change also DARKENS the pool
  // (mean luma 178.5 -> 168.3 at pitch 20), and every absolute |luma - boxmean| scales
  // with the level it sits on, so a 5.7% darker pool reports ~5.7% smaller deviations
  // for no change in how well the bed shows through. The band's own mean luma is
  // carried out so the profile can be read as a WEBER contrast.
  const lSum = new Float64Array(bands);
  for (let y = box; y < h - box; y++) for (let x = box; x < w - box; x++) {
    const p = y * w + x;
    if (!mask.m[p] || field.rho[p] < 0) continue;
    const b = Math.min(bands - 1, Math.floor(field.rho[p] * bands));
    let acc = 0, c = 0;
    for (let dy = -box; dy <= box; dy++) for (let dx = -box; dx <= box; dx++) { acc += L[(y + dy) * w + x + dx]; c++; }
    const dev = Math.abs(L[p] - acc / c);
    cSum[b] += dev; cN[b]++; cAll[b].push(dev); lSum[b] += L[p];
    const i = p * ch;
    sSum[b] += rgbToHsv(img.data[i], img.data[i + 1], img.data[i + 2]).s; sN[b]++;
  }
  for (let b = 0; b < bands; b++) if (cN[b] === 0 || sN[b] === 0) throw new Error(`wt_vol: band ${b} is EMPTY — NON-EMPTY guard`);
  const q = (a, f) => { const z = a.slice().sort((x, y) => x - y); return z[Math.min(z.length - 1, Math.floor(z.length * f))]; };
  return {
    contrast: Array.from({ length: bands }, (_, b) => +(cSum[b] / cN[b]).toFixed(3)),
    seamP95: Array.from({ length: bands }, (_, b) => +q(cAll[b], 0.95).toFixed(3)),
    seamP95Weber: Array.from({ length: bands }, (_, b) => +(q(cAll[b], 0.95) / (lSum[b] / cN[b])).toFixed(4)),
    bandLuma: Array.from({ length: bands }, (_, b) => +(lSum[b] / cN[b]).toFixed(2)),
    sat: Array.from({ length: bands }, (_, b) => +(sSum[b] / sN[b]).toFixed(4)),
    n: Array.from(cN),
  };
}

export function rhoBins(img, mask, field, bins = 10) {
  const { width: w, height: h, channels: ch } = img;
  const s = new Float64Array(bins), c = new Int32Array(bins);
  for (let p = 0; p < w * h; p++) {
    if (!mask.m[p] || field.rho[p] < 0) continue;
    const b = Math.min(bins - 1, Math.floor(field.rho[p] * bins));
    const i = p * ch;
    s[b] += luma(img.data[i], img.data[i + 1], img.data[i + 2]); c[b]++;
  }
  for (let b = 0; b < bins; b++) if (c[b] === 0) throw new Error(`wt_vol: rho bin ${b} is EMPTY — NON-EMPTY guard`);
  return Array.from({ length: bins }, (_, b) => +(s[b] / c[b]).toFixed(2));
}

/**
 * Rim stroke width, split by whether the inward normal is vertical or horizontal on
 * screen. A ground-plane camera compresses the vertical family by sin(pitch).
 */
export function rimWidth(img, mask, field, hue) {
  const { m, w, h } = mask;
  const { width: iw, channels: ch } = img;
  const sat = (p) => { const i = p * ch; return rgbToHsv(img.data[i], img.data[i + 1], img.data[i + 2]).s; };
  // The two populations the threshold sits between: the outermost 4% of rho, and the
  // inner half. Asserted non-empty before a midpoint is taken between them.
  let rimS = 0, rimN = 0, inS = 0, inN = 0;
  for (let p = 0; p < w * h; p++) {
    if (!m[p] || field.rho[p] < 0) continue;
    if (field.rho[p] > 0.96) { rimS += sat(p); rimN++; }
    else if (field.rho[p] < 0.5) { inS += sat(p); inN++; }
  }
  if (rimN === 0 || inN === 0) throw new Error('wt_vol: rim/interior population EMPTY — NON-EMPTY guard');
  const satRim = rimS / rimN, satIn = inS / inN;
  const thr = (satRim + satIn) / 2;
  // 🚨 A RELATIVE THRESHOLD DEGENERATES WHEN THERE IS NOTHING TO SEPARATE. If the rim
  // and the interior sit at the same saturation, `thr` lands ON both of them and the
  // walk terminates on the first pixel of dither — reporting a 1 px stroke where the
  // honest answer is "this shape has no separable rim". Selftest §F plants exactly
  // that (a uniformly rim-coloured ellipse) and requires null.
  const separable = satRim - satIn >= 0.03;
  if (!separable) {
    return { vertMed: null, horizMed: null, ratio: null, separable, satRim: +satRim.toFixed(3),
      satIn: +satIn.toFixed(3), skipped: 0, nVert: 0, nHoriz: 0, vertResolved: 0, horizResolved: 0 };
  }
  // ⚠️ WALK ALONG THE BOUNDARY'S OWN INWARD NORMAL, NOT TOWARD THE CENTROID. The
  // first version of this walked toward the centroid and the two planted known-bads
  // came back 0.429 (world stroke) and 0.727 (screen stroke) — separated, but the
  // screen arm should be 1.0 and was not, because on a squashed ellipse a ray to the
  // centroid crosses the band at an angle and inflates the run by 1/cos(theta). A
  // Sobel normal off the mask removes that bias instead of thresholding around it.
  const blur = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let s2 = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s2 += m[(y + dy) * w + x + dx];
    blur[y * w + x] = s2 / 9;
  }
  const vert = [], horiz = [];
  let skipped = 0;
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const p = y * w + x;
    if (!m[p]) continue;
    if (m[p - 1] && m[p + 1] && m[p - w] && m[p + w]) continue;  // interior
    const gx = (blur[p + 1] - blur[p - 1]);
    const gy = (blur[p + w] - blur[p - w]);
    const glen = Math.hypot(gx, gy);
    if (glen < 1e-4) continue;
    const ux = gx / glen, uy = gy / glen;   // gradient points INTO the mask
    // A boundary pixel that is not itself rim-coloured is not a place a rim stroke can
    // be measured from — the pool's edge runs under a prop shadow and behind a shelf in
    // these frames. SKIPPED, and counted, rather than folded in as a zero-width sample.
    if (sat(p) < thr) { skipped++; continue; }
    let d = 0;
    for (let k = 1; k < 80; k++) {
      const xx = Math.round(x + ux * k), yy = Math.round(y + uy * k);
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
      const q = yy * w + xx;
      if (!m[q]) break;
      if (sat(q) < thr) { d = k; break; }
      d = k;
    }
    // 🚨 A SURVIVOR SET IS NOT A SAMPLE. The first version simply `continue`d on a walk
    // that never crossed the threshold, and at pitch 20 that silently DISCARDED most of
    // the horizontal family — the pool's left and right tips are thin enough that the
    // whole tip is rim, so the long runs dropped out and the median was taken over the
    // anomalously SHORT survivors: it reported horiz = 1 px where the world-space
    // prediction is 27. Unresolved walks are now COUNTED, and a family whose walks did
    // not mostly resolve reports `null` with its reason instead of a number.
    const fam = Math.abs(uy) > 0.90 ? vert : Math.abs(ux) > 0.90 ? horiz : null;
    if (!fam) continue;
    fam.push(d >= 79 ? null : d);
  }
  if (vert.length === 0 || horiz.length === 0) throw new Error('wt_vol: a rim-normal family is EMPTY — NON-EMPTY guard');
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[(b.length / 2) | 0]; };
  const settle = (a) => {
    const r = a.filter((v) => v !== null);
    return { med: r.length / a.length >= 0.6 ? med(r) : null, resolved: r.length, n: a.length };
  };
  void iw; void hue;
  const V = settle(vert), Hz = settle(horiz);
  const vm = separable ? V.med : null, hm = separable ? Hz.med : null;
  return {
    vertMed: vm, horizMed: hm,
    ratio: vm !== null && hm !== null ? +(vm / hm).toFixed(3) : null,
    separable, satRim: +satRim.toFixed(3), satIn: +satIn.toFixed(3), skipped,
    nVert: V.n, nHoriz: Hz.n, vertResolved: V.resolved, horizResolved: Hz.resolved,
  };
}

export async function report(maskPath, framePaths, kind) {
  const mimg = await raster(maskPath);
  const raw = classify(mimg, HUE[kind]);
  const blob = largestBlob(raw);
  const inner = morph(blob, 6, false);
  const outer = morph(blob, 10, true);
  const ring = { m: new Uint8Array(outer.m.length), n: 0, w: outer.w, h: outer.h };
  for (let p = 0; p < outer.m.length; p++) if (outer.m[p] && !blob.m[p]) { ring.m[p] = 1; ring.n++; }
  const wide = morph(blob, 26, true);
  for (let p = 0; p < wide.m.length; p++) if (wide.m[p] && !outer.m[p]) { ring.m[p] = 1; ring.n++; }
  if (inner.n === 0 || ring.n === 0) throw new Error('wt_vol: eroded mask or floor ring is EMPTY — NON-EMPTY guard');
  const field = shoreField(blob);
  const rows = [];
  for (const f of framePaths) {
    const img = await raster(f);
    if (img.width !== mimg.width || img.height !== mimg.height) throw new Error(`wt_vol: ${f} is not the mask's size`);
    const cIn = localContrast(img, inner);
    const cOut = localContrast(img, ring);
    const lIn = meanLuma(img, inner);
    const lOut = meanLuma(img, ring);
    const bins = rhoBins(img, blob, field);
    const rim = rimWidth(img, blob, field, HUE[kind]);
    const band = bandStats(img, blob, field);
    rows.push({
      frame: f,
      T_bandContrast: band.contrast,
      T_bandSeamP95: band.seamP95,
      T_bandSeamWeber: band.seamP95Weber,
      L_bandLuma: band.bandLuma,
      S_bandSat: band.sat,
      T_seamContrastIn: +cIn.mean.toFixed(3),
      T_seamContrastFloor: +cOut.mean.toFixed(3),
      T_ratio: +(cIn.mean / cOut.mean).toFixed(4),
      L_poolLuma: +lIn.mean.toFixed(2),
      L_floorLuma: +lOut.mean.toFixed(2),
      L_poolMinusFloor: +(lIn.mean - lOut.mean).toFixed(2),
      G_rhoBins: bins,
      G_centreMinusShore: +(bins[0] - bins[bins.length - 1]).toFixed(2),
      W_rim: rim,
      nInner: inner.n, nRing: ring.n, nMask: blob.n,
    });
  }
  return { mask: maskPath, kind, rows };
}

// ── selftest: planted rasters, MOVES / HOLDS / NON-EMPTY ─────────────────────
async function selftest() {
  let fails = 0;
  const ok = (n, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${e}`); if (!c) fails++; };
  const W = 200, H = 200;
  // A magenta floor with dark seams every 20 px, and a disc of liquid over it at a
  // chosen alpha. `alpha = 1` is the DECAL known-bad; `alpha` low is the volume.
  const plant = (alpha, radius = 60) => {
    const d = Buffer.alloc(W * H * 4, 255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const seam = (x % 20 === 0) || (y % 20 === 0);
      let r = seam ? 40 : 190, g = seam ? 20 : 90, b = seam ? 60 : 140;
      if (Math.hypot(x - W / 2, y - H / 2) < radius) {
        r = Math.round(r * (1 - alpha) + 0x3f * alpha);
        g = Math.round(g * (1 - alpha) + 0x9f * alpha);
        b = Math.round(b * (1 - alpha) + 0xd8 * alpha);
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    return { data: d, width: W, height: H, channels: 4 };
  };
  const opaque = plant(1.0), sheer = plant(0.55);
  const maskFrom = (img) => largestBlob(classify(img, HUE.water));
  const bl = maskFrom(opaque);
  ok('A1 the planted disc classifies as one blob', bl.n > 9000 && bl.n < 13000, `n=${bl.n}`);
  const inner = morph(bl, 6, false);
  ok('A2 the eroded mask is NON-EMPTY', inner.n > 0, `n=${inner.n}`);
  const cOpaque = localContrast(opaque, inner).mean;
  const cSheer = localContrast(sheer, inner).mean;
  ok('B1 MOVES  a translucent liquid transmits MORE bed detail than an opaque one',
    cSheer > cOpaque * 1.5, `opaque=${cOpaque.toFixed(3)} sheer=${cSheer.toFixed(3)}`);
  ok('B2 HOLDS  the same frame measured twice is identical',
    localContrast(opaque, inner).mean === cOpaque, '');
  // rho field on a disc: rho should be ~ r/radius
  const f = shoreField(bl);
  ok('C1 the shore field centres on the disc', Math.abs(f.cx - 100) < 2 && Math.abs(f.cy - 100) < 2, `c=${f.cx.toFixed(1)},${f.cy.toFixed(1)}`);
  // A radial ramp must show up in the bins; a flat fill must not.
  const ramp = plant(1.0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - 100, y - 100);
    if (r < 60) { const i = (y * W + x) * 4; const k = 1 - r / 60; d3(ramp, i, k); }
  }
  function d3(img, i, k) { img.data[i] = Math.round(60 + 150 * k); img.data[i + 1] = Math.round(110 + 120 * k); img.data[i + 2] = Math.round(160 + 90 * k); }
  const flatBins = rhoBins(opaque, bl, f);
  const rampBins = rhoBins(ramp, bl, f);
  ok('C2 HOLDS  a flat fill has ~no shore-to-centre gradient', Math.abs(flatBins[0] - flatBins[9]) < 4, `${flatBins[0]} -> ${flatBins[9]}`);
  ok('C3 MOVES  a radial ramp does', rampBins[0] - rampBins[9] > 60, `${rampBins[0]} -> ${rampBins[9]}`);
  // NON-EMPTY guards actually fire
  const empty = { m: new Uint8Array(W * H), n: 0, w: W, h: H };
  ok('D1 localContrast throws on an EMPTY population', (() => { try { localContrast(opaque, empty); return false; } catch { return true; } })(), '');
  ok('D2 meanLuma throws on an EMPTY population', (() => { try { meanLuma(opaque, empty); return false; } catch { return true; } })(), '');
  ok('D3 largestBlob throws when nothing classifies', (() => {
    try { largestBlob(classify(plant(0.0, 0), HUE.water)); return false; } catch { return true; }
  })(), '');
  // W: an ELLIPSE squashed vertically is what a ground plane does. A constant-width
  // world stroke on it reads narrower on the vertical normals; a screen-width stroke
  // does not. Plant both and require the metric to tell them apart.
  // Two planted ellipses (a ground plane squashed by the camera). The rim of one is a
  // constant width in the UNSQUASHED (world) frame; the rim of the other is a constant
  // width in SCREEN pixels, built from a chamfer distance transform of the boundary so
  // "8 px on screen" means exactly that and not an algebraic approximation of it.
  const ell = (worldStroke) => {
    const d = Buffer.alloc(W * H * 4, 255);
    const A = 80, B = 30;
    const inside = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - 100) / A, ny = (y - 100) / B;
      if (Math.hypot(nx, ny) <= 1) inside[y * W + x] = 1;
    }
    // chamfer distance to the nearest OUTSIDE pixel, in screen px
    const dist = new Float32Array(W * H).fill(1e9);
    for (let p = 0; p < W * H; p++) if (!inside[p]) dist[p] = 0;
    for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      dist[p] = Math.min(dist[p], dist[p - W] + 1, dist[p - 1] + 1, dist[p - W - 1] + 1.414, dist[p - W + 1] + 1.414);
    }
    for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x >= 1; x--) {
      const p = y * W + x;
      dist[p] = Math.min(dist[p], dist[p + W] + 1, dist[p + 1] + 1, dist[p + W + 1] + 1.414, dist[p + W - 1] + 1.414);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, p = y * W + x;
      let r = 190, g = 90, b = 140;
      if (inside[p]) {
        const nx = (x - 100) / A, ny = (y - 100) / B, t = Math.hypot(nx, ny);
        const inRim = worldStroke ? (t > 1 - 8 / A) : (dist[p] <= 8);
        if (inRim) { r = 0x2a; g = 0x74; b = 0x9a; } else { r = 0x9a; g = 0xd0; b = 0xe4; }
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    return { data: d, width: W, height: H, channels: 4 };
  };
  const eW = ell(true), eS = ell(false);
  const mW = largestBlob(classify(eW, HUE.water)), fW = shoreField(mW);
  const mS = largestBlob(classify(eS, HUE.water)), fS = shoreField(mS);
  const rW = rimWidth(eW, mW, fW, HUE.water), rS = rimWidth(eS, mS, fS, HUE.water);
  ok('E1 MOVES  a WORLD-unit stroke on a squashed ellipse reads narrower on vertical normals',
    rW.ratio < 0.60, `vert=${rW.vertMed} horiz=${rW.horizMed} ratio=${rW.ratio}`);
  ok('E2 HOLDS  a SCREEN-unit stroke does not', rS.ratio > 0.85,
    `vert=${rS.vertMed} horiz=${rS.horizMed} ratio=${rS.ratio}`);
  ok('E2b ...and the two are separated by more than the metric\'s own spread',
    rS.ratio - rW.ratio > 0.30, `screen ${rS.ratio} - world ${rW.ratio}`);
  ok('E3 the two families are both NON-EMPTY', rW.nVert > 10 && rW.nHoriz > 10, `${rW.nVert}/${rW.nHoriz}`);
  // F: the unresolved-walk guard itself. A rim that never ends (the whole shape is rim)
  // must report null, not a median over whichever walks happened to terminate.
  const allRim = (() => {
    const d = Buffer.alloc(W * H * 4, 255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r = 190, g = 90, b = 140;
      if (Math.hypot((x - 100) / 80, (y - 100) / 30) <= 1) { r = 0x2a; g = 0x74; b = 0x9a; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    return { data: d, width: W, height: H, channels: 4 };
  })();
  const mA = largestBlob(classify(allRim, HUE.water)), fA = shoreField(mA);
  const rA = rimWidth(allRim, mA, fA, HUE.water);
  ok('F1 a shape that is rim ALL THE WAY IN reports null, not a survivor median',
    rA.vertMed === null || rA.horizMed === null, `vert=${rA.vertMed} horiz=${rA.horizMed}`);
  // §G  the per-band profile. Plant a pool whose alpha RAMPS with depth — sheer at the
  //      shore, opaque in the middle — and require the bed-detail profile to RISE from
  //      centre to shore. The HOLDS arm is a uniform-alpha pool, which must stay flat:
  //      without it, a metric that simply increases with rho for geometric reasons
  //      (more pixels, more edge) would pass the MOVES arm on its own.
  const plantRamp = (ramped) => {
    const d = Buffer.alloc(W * H * 4, 255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const seam = (x % 20 === 0) || (y % 20 === 0);
      let r = seam ? 40 : 190, g = seam ? 20 : 90, b = seam ? 60 : 140;
      const rr = Math.hypot(x - W / 2, y - H / 2) / 60;
      if (rr < 1) {
        const a = ramped ? 0.20 + 0.75 * (1 - rr * rr) : 0.80;
        r = Math.round(r * (1 - a) + 0x3f * a);
        g = Math.round(g * (1 - a) + 0x9f * a);
        b = Math.round(b * (1 - a) + 0xd8 * a);
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    return { data: d, width: W, height: H, channels: 4 };
  };
  const flatPool = plantRamp(false), rampPool = plantRamp(true);
  const mR = largestBlob(classify(flatPool, HUE.water)), fR = shoreField(mR);
  const bFlat = bandStats(flatPool, mR, fR);
  const bRamp = bandStats(rampPool, mR, fR);
  ok('G0 NON-EMPTY  every band carried pixels', bFlat.n.every((v) => v > 0), `n=[${bFlat.n.join(',')}]`);
  ok('G1 MOVES  a depth-ramped alpha transmits MORE bed detail toward the shore',
    bRamp.contrast[4] > bRamp.contrast[0] * 2, `[${bRamp.contrast.join(', ')}]`);
  ok('G2 HOLDS  a uniform alpha does not', bFlat.contrast[4] < bFlat.contrast[0] * 2,
    `[${bFlat.contrast.join(', ')}]`);
  ok('G1b MOVES  and the p95 seam-depth arm says the same thing',
    bRamp.seamP95[4] > bRamp.seamP95[0] * 2, `[${bRamp.seamP95.join(', ')}]`);
  ok('G2b HOLDS  the uniform-alpha pool is flat in p95 too',
    bFlat.seamP95[4] < bFlat.seamP95[0] * 2, `[${bFlat.seamP95.join(', ')}]`);
  ok('G3 bandStats throws on an EMPTY field', (() => {
    try { bandStats(flatPool, { m: new Uint8Array(W * H), n: 0, w: W, h: H }, fR); return false; } catch { return true; }
  })(), '');

  console.log(fails === 0 ? '\nwt_vol selftest: ALL PASS' : `\nwt_vol selftest: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

const isMain = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const argv = process.argv.slice(2);
  const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  if (argv.includes('--selftest')) await selftest();
  const mask = arg('mask');
  const frames = (arg('frames') ?? '').split(',').filter(Boolean);
  const kind = arg('kind', 'water');
  if (!mask || frames.length === 0) { console.error('wt_vol: need --mask <png> --frames a.png,b.png [--kind water|grease]'); process.exit(2); }
  const out = await report(mask, frames, kind);
  console.log(`wt_vol  kind=${kind}  mask=${mask}  (one mask for every frame, by design)`);
  for (const r of out.rows) {
    console.log(`\n  ${r.frame}`);
    console.log(`    T  seam contrast  pool ${r.T_seamContrastIn}  floor ${r.T_seamContrastFloor}   RATIO ${r.T_ratio}`);
    console.log(`    L  luma           pool ${r.L_poolLuma}  floor ${r.L_floorLuma}   pool-floor ${r.L_poolMinusFloor}`);
    console.log(`    G  rho bins       [${r.G_rhoBins.join(', ')}]   centre-shore ${r.G_centreMinusShore}`);
    console.log(`    T' bed detail by band, centre -> shore   [${r.T_bandContrast.join(', ')}]`);
    console.log(`    T95 SEAM depth p95 by band               [${r.T_bandSeamP95.join(', ')}]`);
    console.log(`    TW  SEAM p95 / band luma (Weber)         [${r.T_bandSeamWeber.join(', ')}]   band luma [${r.L_bandLuma.join(', ')}]`);
    console.log(`    S' saturation by band, centre -> shore   [${r.S_bandSat.join(', ')}]`);
    console.log(`    W  rim stroke px  vert ${r.W_rim.vertMed}  horiz ${r.W_rim.horizMed}   ratio ${r.W_rim.ratio}  (resolved ${r.W_rim.vertResolved}/${r.W_rim.nVert} vert, ${r.W_rim.horizResolved}/${r.W_rim.nHoriz} horiz; sat rim ${r.W_rim.satRim} vs interior ${r.W_rim.satIn}, separable=${r.W_rim.separable}; ${r.W_rim.skipped} boundary px skipped as not-rim)`);
  }
  console.log(`\n  populations: mask ${out.rows[0].nMask} px · eroded ${out.rows[0].nInner} px · floor ring ${out.rows[0].nRing} px`);
  const j = arg('json');
  if (j) { const { writeFile } = await import('node:fs/promises'); await writeFile(j, JSON.stringify(out, null, 2)); console.log(`  wrote ${j}`); }
}
