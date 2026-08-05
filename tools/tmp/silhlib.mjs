/**
 * Silhouette metrics — shared by `limbmatch.mjs` (our render) and its reference mode
 * (Brawl Stars / Zooba plates), so the two sides are computed by the SAME code.
 *
 * ── Why these three numbers ──────────────────────────────────────────────────
 * The genre's own stated criterion is "readable as a black shape at thumbnail
 * size". That is a property of the MASK, which means — unlike every per-joint
 * metric this project has — it can be measured on a reference plate too, once the
 * plate is segmented. So these are the only character-geometry numbers here that
 * have a real external calibration rather than a chosen threshold.
 *
 *   hullDeficiency  1 - area / area(convex hull). A blob is ~0.02; a figure with
 *                   arms and legs clear of its mass is 0.20-0.35. This is the
 *                   single number that says "this outline has limbs in it".
 *   appendages      connected components of (mask - opening(mask, k)), k tied to
 *                   subject height, area >= minAreaFrac of the mask. Counts how
 *                   many DISTINCT things stick out — a shape can have high hull
 *                   deficiency from one big notch and still read as a blob.
 *   appendageShare  what fraction of the silhouette those appendages are.
 *
 * Both are AREA-based on purpose. A perimeter-based compactness was written first
 * and deleted: see `perimeter()` for why a crack-length perimeter reports a square
 * as rounder than a circle. Area ratios have no orientation bias at all.
 *
 * All of them are scale-free by construction (k and minArea are fractions of the
 * subject's own height/area), which is what lets a 1700px reference plate and a
 * 136px fighter be compared without measuring resolution instead of art.
 *
 * VALIDATED against shapes whose answers are derivable by hand — see `selftest()`
 * in `limbmatch.mjs`. `docs/LESSONS.md` §13: validate the instrument against a
 * known input before believing it on an unknown one.
 */

/** Bounding box + area of a 0/1 mask. */
export function bbox(mask, W, H) {
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
  for (let j = 0; j < W * H; j++) {
    if (!mask[j]) continue;
    n++;
    const x = j % W, y = (j / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return n ? { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n } : null;
}

/** 4-connected components. Returns {label:Int32Array, sizes:number[]}. -1 = background. */
export function components(mask, W, H) {
  const label = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const sizes = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let sp = 0, n = 0;
    stack[sp++] = s; label[s] = id;
    while (sp > 0) {
      const p = stack[--sp]; n++;
      const x = p % W, y = (p / W) | 0;
      if (x > 0 && mask[p - 1] && label[p - 1] < 0) { label[p - 1] = id; stack[sp++] = p - 1; }
      if (x < W - 1 && mask[p + 1] && label[p + 1] < 0) { label[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - W] && label[p - W] < 0) { label[p - W] = id; stack[sp++] = p - W; }
      if (y < H - 1 && mask[p + W] && label[p + W] < 0) { label[p + W] = id; stack[sp++] = p + W; }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

/**
 * Chamfer distance transform, in pixels, of the DISTANCE FROM THE COMPLEMENT.
 * Two-pass 3-4 chamfer scaled by 1/3 — within ~2% of true Euclidean, which is far
 * inside anything a morphological radius is sensitive to, and O(WH) rather than the
 * O(WH * k) a repeated BFS erosion costs.
 * Pixels outside the mask are 0.
 */
export function distanceInside(mask, W, H) {
  const INF = 1 << 28;
  const d = new Int32Array(W * H);
  for (let j = 0; j < W * H; j++) d[j] = mask[j] ? INF : 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      if (!d[j]) continue;
      let v = d[j];
      if (x > 0) v = Math.min(v, d[j - 1] + 3);
      if (y > 0) v = Math.min(v, d[j - W] + 3);
      if (x > 0 && y > 0) v = Math.min(v, d[j - W - 1] + 4);
      if (x < W - 1 && y > 0) v = Math.min(v, d[j - W + 1] + 4);
      d[j] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const j = y * W + x;
      if (!d[j]) continue;
      let v = d[j];
      if (x < W - 1) v = Math.min(v, d[j + 1] + 3);
      if (y < H - 1) v = Math.min(v, d[j + W] + 3);
      if (x < W - 1 && y < H - 1) v = Math.min(v, d[j + W + 1] + 4);
      if (x > 0 && y < H - 1) v = Math.min(v, d[j + W - 1] + 4);
      d[j] = v;
    }
  }
  const out = new Float32Array(W * H);
  for (let j = 0; j < W * H; j++) out[j] = d[j] >= INF ? Math.max(W, H) : d[j] / 3;
  return out;
}

/** Same transform on the complement — distance from the mask, for the dilation half. */
export function distanceOutside(mask, W, H) {
  const inv = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) inv[j] = mask[j] ? 0 : 1;
  return distanceInside(inv, W, H);
}

/** Morphological opening by a disc of radius k: erode then dilate. */
export function opening(mask, W, H, k) {
  const din = distanceInside(mask, W, H);
  const eroded = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) eroded[j] = din[j] > k ? 1 : 0;
  const dout = distanceOutside(eroded, W, H);
  const out = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) out[j] = dout[j] <= k ? 1 : 0;
  return out;
}

/**
 * Convex hull area (Andrew monotone chain over per-row extreme points).
 *
 * A pixel (x,y) covers the unit square [x,x+1] x [y,y+1], so each row's extreme
 * pixels contribute FOUR corners, not two. Using only (a,y) and (b+1,y) loses one
 * pixel row and one pixel column off the hull — measured as 1170 against a
 * hand-derivable 1200 on a 30x40 rectangle, a 2.5% low bias that would have been
 * invisible on a character and is exactly the sort of thing the selftest exists for.
 */
export function hullArea(mask, W, H) {
  const pts = [];
  for (let y = 0; y < H; y++) {
    let a = -1, b = -1;
    for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) { pts.push([a, y], [a, y + 1], [b + 1, y], [b + 1, y + 1]); }
  }
  if (pts.length < 3) return 0;
  pts.sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let a2 = 0;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i], q = hull[(i + 1) % hull.length];
    a2 += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a2) / 2;
}

/**
 * CRACK LENGTH — the number of unit edges between a mask pixel and a non-mask one.
 *
 * ⚠️ This is NOT an isotropic perimeter and must never be used to compare two
 * shapes of different orientation. For a digitised disc of radius r it converges to
 * **8r**, not 2*pi*r — a 27% overestimate — while for an axis-aligned rectangle it
 * is exact. A "compactness = P^2/(4 pi A)" built on it therefore reports a square as
 * MORE compact than a circle, which is the opposite of the truth; that metric was
 * written, caught by the selftest below on a shape whose answer is known, and
 * deleted rather than fudged. Kept only as a raw diagnostic.
 */
export function perimeter(mask, W, H) {
  let p = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    if (!mask[j]) continue;
    if (x === 0 || !mask[j - 1]) p++;
    if (x === W - 1 || !mask[j + 1]) p++;
    if (y === 0 || !mask[j - W]) p++;
    if (y === H - 1 || !mask[j + W]) p++;
  }
  return p;
}

/**
 * The three reference-comparable numbers, plus the appendage map so it can be
 * rendered and LOOKED AT.
 *
 * `kFrac` is the opening radius as a fraction of the subject's bbox HEIGHT, and
 * `minAreaFrac` the smallest appendage worth counting as a fraction of mask area.
 * Both defaults were fixed BEFORE any character was measured, from the rig's own
 * proportions: a default forearm is `armRadius = 0.058H` thick, so an opening at
 * 0.045H removes anything of arm calibre and leaves the food mass, and 0.6% of a
 * ~10,000px silhouette is ~60px, about a hand.
 */
export function silhouette(mask, W, H, opts = {}) {
  const kFrac = opts.kFrac ?? 0.045;
  const minAreaFrac = opts.minAreaFrac ?? 0.006;
  const bb = bbox(mask, W, H);
  if (!bb) return null;
  const k = Math.max(1.0, kFrac * bb.h);
  const op = opening(mask, W, H, k);
  const app = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) app[j] = mask[j] && !op[j] ? 1 : 0;
  const { label, sizes } = components(app, W, H);
  const minArea = Math.max(4, minAreaFrac * bb.n);
  const keptIds = [];
  sizes.forEach((n, i) => { if (n >= minArea) keptIds.push(i); });
  const keep = new Set(keptIds);
  const appKept = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) if (app[j] && keep.has(label[j])) appKept[j] = 1;
  const hull = hullArea(mask, W, H);
  const per = perimeter(mask, W, H);
  const appPx = keptIds.reduce((s, i) => s + sizes[i], 0);
  return {
    areaPx: bb.n,
    heightPx: bb.h,
    widthPx: bb.w,
    hullAreaPx: Math.round(hull),
    hullDeficiency: hull > 0 ? +(1 - bb.n / hull).toFixed(4) : null,
    appendages: keptIds.length,
    appendagePx: appPx,
    appendageShare: +(appPx / bb.n).toFixed(4),
    appendageSizes: keptIds.map((i) => sizes[i]).sort((a, b) => b - a),
    coreShare: +(1 - appPx / bb.n).toFixed(4),
    crackPerimeterPx: per,
    openingRadiusPx: +k.toFixed(2),
    _appendageMask: appKept,
    _openingMask: op,
  };
}

/**
 * Nearest-neighbour mask downsample so a subject of any native size can be measured
 * at OUR shipped on-screen height. A mask is not an image — box-averaging it would
 * invent grey and then re-threshold it, which erodes thin limbs and would bias the
 * exact quantity being measured. Area-majority instead.
 */
export function resampleMaskToHeight(mask, W, H, targetH) {
  const bb = bbox(mask, W, H);
  if (!bb) return null;
  const s = targetH / bb.h;
  if (s >= 1) return { mask, W, H, scale: 1 };
  const dw = Math.max(1, Math.round(W * s)), dh = Math.max(1, Math.round(H * s));
  const out = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const x0 = Math.floor((x / dw) * W), x1 = Math.max(x0 + 1, Math.floor(((x + 1) / dw) * W));
    const y0 = Math.floor((y / dh) * H), y1 = Math.max(y0 + 1, Math.floor(((y + 1) / dh) * H));
    let on = 0, tot = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { tot++; if (mask[yy * W + xx]) on++; }
    out[y * dw + x] = on * 2 >= tot ? 1 : 0;
  }
  return { mask: out, W: dw, H: dh, scale: s };
}
