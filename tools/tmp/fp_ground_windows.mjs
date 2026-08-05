#!/usr/bin/env node
/**
 * FP_GROUND_WINDOWS — the same three frequency bands, measured on GROUND ONLY, with a
 * mask derived by identical code on our frames and on the reference plates.
 *
 * ── Why a second tool ───────────────────────────────────────────────────────────
 * `fp_ground.mjs` measures a central band of the whole frame and found three
 * non-overlapping gaps. But a whole-frame band contains characters and props, and the
 * reference plates are far denser in props than ours — so a "the frame lacks mid-scale
 * structure" reading could be entirely a PROPS finding wearing a floor costume.
 * `docs/LESSONS.md` §5 is explicit that a mask from one source and a value from another
 * is a lie wherever they disagree, so the mask here is computed the same way on both
 * sides and nothing is hand-picked.
 *
 * ── Method ──────────────────────────────────────────────────────────────────────
 *  1. Resize to height 900, crop the central band x[0.08,0.92] y[0.15,0.82] (same as
 *     `fp_ground.mjs`).
 *  2. Quantise to a 16^3 RGB lattice, take the K heaviest buckets, and grow each into a
 *     cluster centroid. These are "the ground colours" — on a top-down brawler plate the
 *     modal surface IS the ground (`tools/tmp/dominant_surface.mjs` established that).
 *  3. Ground mask = pixels within RGBDIST of any of the K centroids.
 *  4. Slide a WIN x WIN/1.5 window at stride WIN/3. Keep a window only if >= PURE of its
 *     pixels are ground. That excludes characters, props, VFX and HUD automatically.
 *  5. Per kept window: std of the 1-3px, 3-12px and 12-48px luma bands, plus the
 *     orientation concentration `oriTop2`. Report the MEDIAN window.
 *
 * The mask is written out as a marked PNG (`--sheet`) so the selection is auditable by
 * eye, which is the only way this file's own rule 3 (judge rendered pixels) is honoured.
 *
 * ⚠️ ACUITY BIAS runs AGAINST the reference on `hf` only: the plates arrive upscaled
 * 1.33-1.43x (`docs/LESSONS.md` §3). It does not touch `mf`/`lf`/`oriTop2`, whose
 * features are 3-48px and survive that resample.
 *
 * ── KNOWN-BAD CONTROLS (`--selftest`) ───────────────────────────────────────────
 *   FLAT      constant grey        -> 100% of windows kept, lf/mf/hf all ~0
 *   ISO       isotropic noise      -> windows kept, lf > 0, oriTop2 near 0.167
 *   CHECKER   40px checkerboard    -> oriTop2 high; and NO window is kept when the two
 *             checker shades are further apart than RGBDIST, which proves the purity
 *             filter actually rejects
 *   MASKED    a real plate with a synthetic magenta bar painted across it -> the bar's
 *             windows must be REJECTED, and the surviving numbers must match the
 *             unpainted plate to 3 dp. This is the one that proves the mask does work.
 *   SELF      same image twice -> identical
 *
 *   node tools/tmp/fp_ground_windows.mjs --selftest
 *   node tools/tmp/fp_ground_windows.mjs --ours shots/baseline/match_cand02.png --sheet shots/floor2/mask
 *
 * ── WHAT IT FOUND, HEAD 2026-08-06, 8 fresh action frames vs 6 plates ───────────
 *
 *   metric        reference band          ours                    verdict
 *   hf            0.00336 .. 0.01005      0.01283 .. 0.01572      ABOVE ref max (1.92x)
 *   mf            0.00930 .. 0.02414      0.01535 .. 0.01918      1.07x — at the median
 *   lf            0.01095 .. 0.03989      0.01749 .. 0.01957      1.01x — at the median
 *   oriTop2       0.307   .. 0.592        0.422   .. 0.557        0.99x — inside
 *   oriAll        0.229   .. 0.351        0.421   .. 0.547        1.55x — NON-OVERLAPPING
 *   groundFeat    0.136   .. 0.276        0.114   .. 0.147        0.65x — at/below the floor
 *
 * ⚠️ `hf` is the one number a resample can fake, and the fake runs OUR way: the plates
 * arrive upscaled 1.33-1.43x, delivering 0.42-0.48x our edge acuity, and 1/0.48 = 2.08.
 * So read `hf` as "at least at parity", never as "we have twice the detail". `mf` and
 * `lf` describe 3-48px features and survive that resample — and they land on the
 * reference MEDIAN. **"No surface detail" is falsified on the bands that can be
 * compared.** Adding a normalMap, grain or more mottle to this floor spends a pass on a
 * quantity that is already where the reference is.
 *
 * The ONE ground property outside the reference band is `oriAll` — how much of the
 * ground's gradient energy points in the same TWO directions everywhere in the frame.
 * Per cluster it is the TILE FIELD that carries it (0.518-0.554) and not the utility
 * mats (0.233-0.328). `fp_period.mjs` shows the same thing from the other side: our
 * tile field repeats at 100-107 x 80-86 px with autocorrelation 0.55-0.82, while five of
 * six plates have NO periodic ground repeat above the instrument's own noise floor.
 */
import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const NH = 900;
const BX0 = 0.08, BX1 = 0.92, BY0 = 0.15, BY1 = 0.82;
const KCLUST = Number(arg('k', 3));   // number of ground colour clusters
const RGBDIST = Number(arg('dist', 46));
const WIN = Number(arg('win', 132));
const WINH = Math.round(WIN / 1.5);
const STRIDE = Math.round(WIN / 3);
const PURE = 0.92;

const LUMA = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function blur(src, w, h, r) {
  if (r < 1) return Float32Array.from(src);
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * r + 1);
        acc -= a[row + Math.min(w - 1, Math.max(0, x - r))];
        acc += a[row + Math.min(w - 1, Math.max(0, x + r + 1))];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc -= b[Math.min(h - 1, Math.max(0, y - r)) * w + x];
        acc += b[Math.min(h - 1, Math.max(0, y + r + 1)) * w + x];
      }
    }
  }
  return a;
}
const std = (a) => {
  let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; m /= a.length;
  let v = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - m; v += d * d; }
  return Math.sqrt(v / a.length);
};
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

/** Band stds + orientation concentration of one w x h luma tile. */
function tileMetrics(L, w, h) {
  const b3 = blur(L, w, h, 1), b12 = blur(L, w, h, 5), b48 = blur(L, w, h, 20);
  const hfA = new Float32Array(w * h), mfA = new Float32Array(w * h), lfA = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { hfA[i] = L[i] - b3[i]; mfA[i] = b3[i] - b12[i]; lfA[i] = b12[i] - b48[i]; }
  const BINS = 36, hist = new Float64Array(BINS); let gtot = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = (L[i + 1] - L[i - 1]) * 0.5, gy = (L[i + w] - L[i - w]) * 0.5;
    const m = Math.hypot(gx, gy);
    if (m < 0.004) continue;
    let a = Math.atan2(gy, gx); if (a < 0) a += Math.PI;
    hist[Math.min(BINS - 1, Math.floor((a / Math.PI) * BINS))] += m; gtot += m;
  }
  let oriTop2 = 0;
  if (gtot > 0) {
    const mass = (c) => hist[(c - 1 + BINS) % BINS] + hist[c] + hist[(c + 1) % BINS];
    let b1 = 0; for (let c = 1; c < BINS; c++) if (mass(c) > mass(b1)) b1 = c;
    let b2 = -1;
    for (let c = 0; c < BINS; c++) {
      const circ = Math.min(Math.abs(c - b1), BINS - Math.abs(c - b1));
      if (circ < 3) continue;
      if (b2 < 0 || mass(c) > mass(b2)) b2 = c;
    }
    oriTop2 = (mass(b1) + (b2 >= 0 ? mass(b2) : 0)) / gtot;
  }
  return { hf: std(hfA), mf: std(mfA), lf: std(lfA), oriTop2 };
}

export async function loadBand(path, paint) {
  const meta = await sharp(path).metadata();
  const nw = Math.round((meta.width / meta.height) * NH);
  let pipe = sharp(path).resize(nw, NH, { fit: 'fill' }).removeAlpha();
  const { data, info } = await pipe.raw().toBuffer({ resolveWithObject: true });
  const x0 = Math.round(info.width * BX0), x1 = Math.round(info.width * BX1);
  const y0 = Math.round(info.height * BY0), y1 = Math.round(info.height * BY1);
  const w = x1 - x0, h = y1 - y0;
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y + y0) * info.width + (x + x0)) * 3, d = (y * w + x) * 3;
    rgb[d] = data[s]; rgb[d + 1] = data[s + 1]; rgb[d + 2] = data[s + 2];
  }
  if (paint) {
    // A synthetic magenta bar — the MASKED control. Deliberately only 6% of the band's
    // height: a 20% bar became the single HEAVIEST colour bucket and was adopted as a
    // ground cluster, so the control passed by admitting the very thing it was built to
    // reject. That is `docs/LESSONS.md` §13 exactly, caught here by the control itself.
    for (let y = Math.round(h * 0.47); y < Math.round(h * 0.53); y++)
      for (let x = 0; x < w; x++) { const d = (y * w + x) * 3; rgb[d] = 255; rgb[d + 1] = 0; rgb[d + 2] = 255; }
  }
  return { rgb, w, h, src: `${meta.width}x${meta.height}` };
}

/**
 * K heaviest 16^3 buckets, refined to centroids, non-overlapping in RGB — and then
 * filtered by SPATIAL SPREAD, which is the part that was not there first and that the
 * MASKED control caught.
 *
 * ⚠️ Bucket weight alone picks the flattest surface, not the biggest one. A synthetic
 * magenta bar over 6% of the band beat real grass into the top three, because a
 * perfectly uniform colour lands entirely in ONE 16^3 bucket while a real surface
 * spreads over dozens. The same failure mode on our own frames would adopt a large flat
 * PROP — e.g. the pale-blue counter slab eight critics called a placeholder — as
 * "ground", which would have quietly answered the wrong question.
 *
 * The fix is the property that actually distinguishes ground from everything else in a
 * top-down frame: ground is EVERYWHERE. A cluster is only ground if it reaches at least
 * CELL_MIN of the pixels in at least CELL_FRAC of an 8x6 grid over the band.
 */
const GX = 8, GY = 6, CELL_MIN = 0.05, ROW_FRAC = 0.5, COL_FRAC = 0.5;
function groundClusters(rgb, w, h, k) {
  const buckets = new Map();
  for (let i = 0; i < w * h; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let acc = buckets.get(key);
    if (!acc) buckets.set(key, (acc = [0, 0, 0, 0]));
    acc[0]++; acc[1] += r; acc[2] += g; acc[3] += b;
  }
  const sorted = [...buckets.values()].sort((a, b) => b[0] - a[0]);
  const cellW = w / GX, cellH = h / GY, cellN = (w * h) / (GX * GY);
  const spread = (cen) => {
    const cells = new Float64Array(GX * GY);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (Math.hypot(rgb[i * 3] - cen[0], rgb[i * 3 + 1] - cen[1], rgb[i * 3 + 2] - cen[2]) > RGBDIST) continue;
      cells[Math.min(GY - 1, (y / cellH) | 0) * GX + Math.min(GX - 1, (x / cellW) | 0)]++;
    }
    // Spread must hold on BOTH axes. A full-width bar covers every COLUMN and only two
    // rows; ground covers most of both. A one-axis test passed the magenta bar at 16 of
    // 48 cells and is exactly how this control failed its second time.
    let rows = 0, cols = 0;
    for (let gy = 0; gy < GY; gy++) { let ok = false; for (let gx = 0; gx < GX; gx++) if (cells[gy * GX + gx] / cellN >= CELL_MIN) ok = true; if (ok) rows++; }
    for (let gx = 0; gx < GX; gx++) { let ok = false; for (let gy = 0; gy < GY; gy++) if (cells[gy * GX + gx] / cellN >= CELL_MIN) ok = true; if (ok) cols++; }
    return { rows: rows / GY, cols: cols / GX };
  };
  const out = [];
  for (const [c, R, G, B] of sorted) {
    const cen = [R / c, G / c, B / c];
    if (out.some((o) => Math.hypot(o[0] - cen[0], o[1] - cen[1], o[2] - cen[2]) < RGBDIST * 0.7)) continue;
    const sp = spread(cen);
    if (sp.rows < ROW_FRAC || sp.cols < COL_FRAC) continue;
    out.push(cen);
    if (out.length >= k) break;
  }
  return out;
}

export function analyse(rgb, w, h, k = KCLUST) {
  const cen = groundClusters(rgb, w, h, k);
  const mask = new Uint8Array(w * h);
  let maskN = 0;
  for (let i = 0; i < w * h; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    for (const c of cen) {
      if (Math.hypot(r - c[0], g - c[1], b - c[2]) <= RGBDIST) { mask[i] = 1; maskN++; break; }
    }
  }
  // ── MORPHOLOGICAL CLOSE, and it is the reason the first version of this tool was
  // about to return a confident wrong answer ───────────────────────────────────────
  // Rendering the mask and LOOKING at it (`--sheet`) showed our tile JOINTS painted as
  // non-ground: the grout colour is far enough from the tile centroid to fall outside
  // RGBDIST, so the mask was deleting the exact feature the whole probe exists to
  // measure — while the reference's equivalent thin dark features (leaf gaps inside a
  // bush field) survived, because there the dark shade is itself one of the heaviest
  // buckets and became a cluster. An asymmetric mask is `docs/LESSONS.md` §5's "a mask
  // from one render and a value from another" in one image.
  //
  // A close (dilate then erode) by CLOSE_R fills any non-ground line thinner than
  // 2*CLOSE_R that is surrounded by ground, and leaves anything bigger — a character at
  // ~90px, a prop, a HUD pill — untouched. Symmetric by construction: the same
  // operation runs on both sides.
  {
    const CLOSE_R = 4;
    const dil = new Uint8Array(w * h), tmp = new Uint8Array(w * h);
    // dilate (separable max)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0; for (let k = -CLOSE_R; k <= CLOSE_R && !v; k++) v = mask[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = v;
    }
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      let v = 0; for (let k = -CLOSE_R; k <= CLOSE_R && !v; k++) v = tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      dil[y * w + x] = v;
    }
    // erode
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 1; for (let k = -CLOSE_R; k <= CLOSE_R && v; k++) v = dil[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = v;
    }
    maskN = 0;
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      let v = 1; for (let k = -CLOSE_R; k <= CLOSE_R && v; k++) v = tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      mask[y * w + x] = v; maskN += v;
    }
  }

  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = LUMA(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);

  const kept = [];
  const perWin = new Map();
  const hfs = [], mfs = [], lfs = [], oris = [];
  for (let wy = 0; wy + WINH <= h; wy += STRIDE) {
    for (let wx = 0; wx + WIN <= w; wx += STRIDE) {
      let g = 0;
      for (let y = 0; y < WINH; y++) for (let x = 0; x < WIN; x++) g += mask[(wy + y) * w + wx + x];
      if (g / (WIN * WINH) < PURE) continue;
      const tile = new Float32Array(WIN * WINH);
      for (let y = 0; y < WINH; y++) for (let x = 0; x < WIN; x++) tile[y * WIN + x] = L[(wy + y) * w + wx + x];
      const m = tileMetrics(tile, WIN, WINH);
      hfs.push(m.hf); mfs.push(m.mf); lfs.push(m.lf); oris.push(m.oriTop2);
      // which ground cluster does this window sit on? (modal cluster of its pixels)
      const votes = new Float64Array(cen.length);
      for (let y = 0; y < WINH; y += 2) for (let x = 0; x < WIN; x += 2) {
        const i = ((wy + y) * w + wx + x) * 3;
        let best = -1, bd = 1e9;
        for (let c = 0; c < cen.length; c++) {
          const d = Math.hypot(rgb[i] - cen[c][0], rgb[i + 1] - cen[c][1], rgb[i + 2] - cen[c][2]);
          if (d < bd) { bd = d; best = c; }
        }
        if (best >= 0) votes[best]++;
      }
      let ci = 0; for (let c = 1; c < cen.length; c++) if (votes[c] > votes[ci]) ci = c;
      m.cluster = ci;
      kept.push([wx, wy]);
      perWin.set(`${wx},${wy}`, m);
    }
  }
  // ── oriAll: the GLOBAL lattice number ─────────────────────────────────────────
  // The per-window `oriTop2` above is LOCAL: it asks whether a 132x88 patch of ground
  // has a dominant direction. That is not the greybox complaint. A reference plate's
  // ground is strongly oriented locally (a mown stripe, a bush edge) and those
  // orientations POINT DIFFERENT WAYS across the frame, so globally it is isotropic.
  // A tile lattice points the same two ways everywhere. So this runs the identical
  // histogram over every ground pixel in the frame at once, HUD, cast and props
  // excluded by the same mask.
  {
    const BINS = 36, hist = new Float64Array(BINS); let gtot = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i] || !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) continue;
      const gx = (L[i + 1] - L[i - 1]) * 0.5, gy = (L[i + w] - L[i - w]) * 0.5;
      const m = Math.hypot(gx, gy);
      if (m < 0.004) continue;
      let a = Math.atan2(gy, gx); if (a < 0) a += Math.PI;
      hist[Math.min(BINS - 1, Math.floor((a / Math.PI) * BINS))] += m; gtot += m;
    }
    if (gtot > 0) {
      const mass = (c) => hist[(c - 1 + BINS) % BINS] + hist[c] + hist[(c + 1) % BINS];
      let b1 = 0; for (let c = 1; c < BINS; c++) if (mass(c) > mass(b1)) b1 = c;
      let b2 = -1;
      for (let c = 0; c < BINS; c++) {
        const circ = Math.min(Math.abs(c - b1), BINS - Math.abs(c - b1));
        if (circ < 3) continue;
        if (b2 < 0 || mass(c) > mass(b2)) b2 = c;
      }
      var oriAll = (mass(b1) + (b2 >= 0 ? mass(b2) : 0)) / gtot;
      var oriPeaks = [b1 * 5, (b2 >= 0 ? b2 : -1) * 5];
    } else { var oriAll = 0; var oriPeaks = [-1, -1]; }
  }

  // featShare restricted to the ground mask: what share of GROUND carries object-scale
  // contrast (|L - blur12| > 0.035). This separates "the ground is smooth" (it is, on
  // both sides) from "there is nothing lying on the ground" (which is the actual gap).
  let gFeat = 0, gN = 0;
  {
    const b12 = blur(L, w, h, 5);
    for (let i = 0; i < w * h; i++) if (mask[i]) { gN++; if (Math.abs(L[i] - b12[i]) > 0.035) gFeat++; }
  }
  const groundFeat = gN ? gFeat / gN : 0;

  const byCluster = cen.map((c, ci) => {
    const ws = [...perWin.values()].filter((m) => m.cluster === ci);
    return { rgb: c.map((v) => Math.round(v)), n: ws.length,
      hf: med(ws.map((m) => m.hf)), mf: med(ws.map((m) => m.mf)),
      lf: med(ws.map((m) => m.lf)), oriTop2: med(ws.map((m) => m.oriTop2)) };
  });
  return {
    oriAll, oriPeaks, byCluster, groundFeat,
    maskShare: maskN / (w * h), windows: kept.length,
    hf: med(hfs), mf: med(mfs), lf: med(lfs), oriTop2: med(oris),
    centroids: cen.map((c) => c.map((v) => Math.round(v))), kept, perWin, w, h, mask,
  };
}

async function sheet(path, rgb, w, h, res, outPath) {
  const buf = Buffer.from(rgb);
  // darken non-mask, outline kept windows in green
  const o = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const f = res.mask[i] ? 1 : 0.32;
    o[i * 3] = Math.round(rgb[i * 3] * f);
    o[i * 3 + 1] = Math.round(rgb[i * 3 + 1] * f);
    o[i * 3 + 2] = Math.round(rgb[i * 3 + 2] * f);
  }
  for (const [wx, wy] of res.kept) {
    for (let x = 0; x < WIN; x++) for (const y of [0, WINH - 1]) {
      const i = ((wy + y) * w + wx + x) * 3; o[i] = 0; o[i + 1] = 255; o[i + 2] = 0;
    }
    for (let y = 0; y < WINH; y++) for (const x of [0, WIN - 1]) {
      const i = ((wy + y) * w + wx + x) * 3; o[i] = 0; o[i + 1] = 255; o[i + 2] = 0;
    }
  }
  void buf; void path;
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(o, { raw: { width: w, height: h, channels: 3 } }).png().toFile(outPath);
}

function synthRGB(kind, w = 800, h = 560) {
  const rgb = new Uint8Array(w * h * 3);
  let s = 777;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const n = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) n[i] = rnd();
  const bl = blur(n, w, h, 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = 128;
    if (kind === 'FLAT') v = 128;
    else if (kind === 'ISO') v = 128 + (bl[i] - 0.5) * 400;
    else if (kind === 'CHECKER') v = ((x / 40 | 0) + (y / 40 | 0)) % 2 ? 60 : 200;
    v = Math.max(0, Math.min(255, v));
    rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = v;
  }
  return { rgb, w, h };
}

async function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, c, g) => { if (c) { pass++; console.log(`  PASS  ${n}  ${g}`); } else { fail++; console.log(`  FAIL  ${n}  ${g}`); } };

  const flat = synthRGB('FLAT'); const rF = analyse(flat.rgb, flat.w, flat.h);
  ck('FLAT keeps all windows', rF.maskShare > 0.999 && rF.windows > 20, `mask=${rF.maskShare.toFixed(3)} n=${rF.windows}`);
  ck('FLAT lf ~ 0', rF.lf < 1e-6, `lf=${rF.lf}`);
  const iso = synthRGB('ISO'); const rI = analyse(iso.rgb, iso.w, iso.h);
  ck('ISO keeps windows', rI.windows > 10, `n=${rI.windows}`);
  ck('ISO lf > 0', rI.lf > 0.005, `lf=${rI.lf.toFixed(5)}`);
  ck('ISO oriTop2 isotropic (<0.30)', rI.oriTop2 < 0.30, `ori=${rI.oriTop2.toFixed(4)}`);
  ck('ISO oriAll isotropic (<0.25)', rI.oriAll < 0.25, `oriAll=${rI.oriAll.toFixed(4)}`);
  const chk = synthRGB('CHECKER');
  // k=1: only the heavier checker shade is "ground", so every window straddles a
  // rejected shade and the purity filter must throw all of them. At k=3 (the shipped
  // default) BOTH shades are legitimately ground clusters and every window is kept —
  // that is correct behaviour, and asserting otherwise is how this control first failed.
  const rC1 = analyse(chk.rgb, chk.w, chk.h, 1);
  ck('CHECKER k=1 purity filter REJECTS every window', rC1.windows === 0, `n=${rC1.windows}`);
  const rC3 = analyse(chk.rgb, chk.w, chk.h, 3);
  ck('CHECKER k=3 keeps windows and reads as a grid', rC3.windows > 0 && rC3.oriTop2 > 0.5, `n=${rC3.windows} ori=${(rC3.oriTop2 || 0).toFixed(3)}`);
  ck('CHECKER oriAll high and peaks 90 deg apart', rC3.oriAll > 0.9 && Math.abs(Math.abs(rC3.oriPeaks[0] - rC3.oriPeaks[1]) - 90) <= 10, `oriAll=${rC3.oriAll.toFixed(3)} peaks=${rC3.oriPeaks}`);

  const probe = 'reference/images/curated/gameplay_topdown/bs_04.png';
  const a = await loadBand(probe); const r1 = analyse(a.rgb, a.w, a.h);
  const b = await loadBand(probe); const r2 = analyse(b.rgb, b.w, b.h);
  ck('SELF-PAIR identical', r1.hf === r2.hf && r1.lf === r2.lf && r1.windows === r2.windows, `n=${r1.windows}`);

  const p = await loadBand(probe, true); const rp = analyse(p.rgb, p.w, p.h);
  ck('MASKED bar not adopted as a ground cluster',
    !rp.centroids.some((c) => c[0] > 200 && c[1] < 60 && c[2] > 200), JSON.stringify(rp.centroids));
  ck('MASKED bar rejected (fewer windows)', rp.windows < r1.windows, `${rp.windows} < ${r1.windows}`);
  // The right claim is not that the MEDIAN is unchanged — painting over the frame
  // legitimately removes windows and so moves the median. It is that every window kept
  // by BOTH runs measures bit-identically, i.e. the paint changed only membership.
  let shared = 0, drift = 0;
  for (const [k2, v] of rp.perWin) {
    const u = r1.perWin.get(k2); if (!u) continue;
    shared++; if (u.hf !== v.hf || u.mf !== v.mf || u.lf !== v.lf || u.oriTop2 !== v.oriTop2) drift++;
  }
  ck('MASKED shared windows bit-identical', shared > 40 && drift === 0, `shared=${shared} drift=${drift}`);
  ck('real plate keeps a usable number of windows', r1.windows >= 5, `n=${r1.windows}`);

  console.log(`\n  fp_ground_windows selftest: ${pass} pass, ${fail} fail`);
  if (fail) process.exit(1);
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
// Guarded so `loadBand`/`analyse` can be imported by another probe instead of copied
// into it. `docs/LESSONS.md` §5 records one stale COPY of a driver contaminating ten
// instruments; a second copy of this mask would be the same mistake.
const IS_MAIN = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (IS_MAIN) {
if (has('selftest')) { await selftest(); process.exit(0); }

const refDir = arg('refs', 'reference/images/curated/gameplay_topdown');
const refs = (await readdir(refDir)).filter((f) => /^bs_\d+\.png$/.test(f)).sort().map((f) => join(refDir, f));
const ours = String(arg('ours', '')).split(',').filter(Boolean);
const sheetDir = arg('sheet');

const rows = [];
console.log(`  win=${WIN}x${WINH} stride=${STRIDE} k=${KCLUST} dist=${RGBDIST} pure=${PURE}`);
console.log('  image                              mask%   n      hf      mf      lf  oriTop2  oriAll  peaks  gFeat%  centroids');
for (const [tag, list] of [['REF', refs], ['OURS', ours]]) {
  for (const p of list) {
    const { rgb, w, h } = await loadBand(p);
    const r = analyse(rgb, w, h);
    rows.push({ tag, path: p, maskShare: r.maskShare, windows: r.windows, hf: r.hf, mf: r.mf, lf: r.lf, oriTop2: r.oriTop2, oriAll: r.oriAll, oriPeaks: r.oriPeaks, groundFeat: r.groundFeat, centroids: r.centroids });
    console.log(
      `  ${(tag + ' ' + p.split('/').pop()).padEnd(32)} ${(r.maskShare * 100).toFixed(1).padStart(5)} ${String(r.windows).padStart(3)} ` +
      `${(r.hf || 0).toFixed(5).padStart(7)} ${(r.mf || 0).toFixed(5).padStart(7)} ${(r.lf || 0).toFixed(5).padStart(7)} ` +
      `${(r.oriTop2 || 0).toFixed(4).padStart(8)} ${(r.oriAll || 0).toFixed(4).padStart(7)} ${String(r.oriPeaks.join('/')).padStart(7)} ${(r.groundFeat * 100).toFixed(2).padStart(6)}  ${r.centroids.map((c) => c.join(',')).join(' | ')}`
    );
    if (has('percluster')) for (const c of r.byCluster) {
      if (!c.n) { console.log(`        cluster rgb(${c.rgb.join(',')})  n=0`); continue; }
      console.log(`        cluster rgb(${String(c.rgb.join(',')).padEnd(11)}) n=${String(c.n).padStart(3)}  hf ${c.hf.toFixed(5)}  mf ${c.mf.toFixed(5)}  lf ${c.lf.toFixed(5)}  ori ${c.oriTop2.toFixed(4)}`);
    }
    if (sheetDir) await sheet(p, rgb, w, h, r, join(sheetDir, `${tag}_${p.split('/').pop()}`));
  }
}
console.log('\n  ── band comparison (median window) ──');
for (const k of ['hf', 'mf', 'lf', 'oriTop2', 'oriAll', 'groundFeat']) {
  const r = rows.filter((x) => x.tag === 'REF' && x.windows > 0).map((x) => x[k]).sort((a, b) => a - b);
  const o = rows.filter((x) => x.tag === 'OURS' && x.windows > 0).map((x) => x[k]).sort((a, b) => a - b);
  if (!o.length || !r.length) continue;
  const f = (v) => v.toFixed(5);
  console.log(`  ${k.padEnd(8)} ref ${f(r[0])} .. ${f(r[r.length - 1])} (median ${f(r[r.length >> 1])})   ours ${f(o[0])} .. ${f(o[o.length - 1])} (median ${f(o[o.length >> 1])})   ratio ${(o[o.length >> 1] / r[r.length >> 1]).toFixed(2)}x`);
}
const outJson = arg('json');
if (outJson) { await writeFile(outJson, JSON.stringify(rows, null, 2)); console.log(`\n  wrote ${outJson}`); }

}
