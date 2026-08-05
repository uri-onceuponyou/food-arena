/**
 * pp_lib — shared image plumbing for the PER-PART isolation programme.
 *
 * THROWAWAY, read-only on src/. Everything here is deliberately boring: the
 * interesting decisions live in `pp_ours.mjs` (how our parts are isolated) and
 * `pp_ref.mjs` (how a reference plate's parts are isolated), and this file only
 * exists so both sides do the SAME thing to the pixels. That is the whole point:
 * if the two sides are treated differently, the pair measures the harness.
 *
 * ── THE FIELD ────────────────────────────────────────────────────────────────
 * Both sides are composited onto ONE flat colour, `FIELD` below. It is
 * `src/preview.ts`'s shipped character backdrop `0x3d2b21`, which was itself
 * chosen by measuring the SHIPPED match's figure/ground (docs/LESSONS.md §13):
 * background luma 0.3301 against the match's 0.3250, contrast +0.2224 against
 * +0.216. The old `0x39b7e8` cyan inverted that sign, and every character packet
 * this project ever judged was scored against the wrong polarity.
 *
 * Choosing a flat field rather than "each side keeps its own backdrop" is not a
 * cosmetic call. A crop that puts our part on a dark warm field and the reference
 * part on its own saturated blue gradient is a measurement of the backdrop.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/** The shipped character backdrop, `src/preview.ts:134`. Both sides land on this. */
export const FIELD = { r: 0x3d, g: 0x2b, b: 0x21 };

/** ITU-R BT.709 relative luma on 0..1, from 8-bit sRGB. Same form `valuelib` uses. */
export const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function saturation(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/** {data,width,height} with 4 channels, from any PNG on disk. */
export async function loadRGBA(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function writeRGBA(path, img) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } })
    .png().toFile(path);
}

/** Vertical flip — `gl.readPixels` hands back a bottom-up buffer. */
export function flipY(img) {
  const { width: w, height: h, data } = img;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) data.copy(out, y * w * 4, (h - 1 - y) * w * 4, (h - y) * w * 4);
  return { data: out, width: w, height: h };
}

export function cropRGBA(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= img.height) continue;
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= img.width) continue;
      const s = (sy * img.width + sx) * 4, d = (y * w + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
    }
  }
  return { data: out, width: w, height: h };
}

/** Dilate a Uint8 mask by `r` (Chebyshev), separable. */
export function dilate(mask, w, h, r) {
  if (r <= 0) return mask;
  const a = new Uint8Array(w * h), b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w && mask[y * w + xx]) { v = 1; break; } }
    a[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h && a[yy * w + x]) { v = 1; break; } }
    b[y * w + x] = v;
  }
  return b;
}

/**
 * Replace every non-mask pixel with FIELD. Alpha goes to 255 everywhere, so the
 * emitted PNG has no transparency for a critic's viewer to render differently.
 */
export function compositeOnField(img, mask, field = FIELD) {
  const out = Buffer.from(img.data);
  for (let j = 0, i = 0; j < img.width * img.height; j++, i += 4) {
    if (!mask[j]) { out[i] = field.r; out[i + 1] = field.g; out[i + 2] = field.b; }
    out[i + 3] = 255;
  }
  return { data: out, width: img.width, height: img.height };
}

export function bboxOf(mask, w, h) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return n ? { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n } : null;
}

/**
 * FIGURE/GROUND, the polarity number this whole programme turns on.
 *
 * `edge` = mean luma of subject pixels within `band` px of the mask boundary.
 * `surround` = mean luma of NON-subject pixels within `band` px of it.
 * `contrast` = edge - surround. Positive means the figure is LIGHTER than what it
 * sits on, which is the sign the shipped match produces (+0.216 .. +0.27).
 *
 * Measured on the boundary rather than on whole-part medians on purpose:
 * `docs/TOOLS.md` records that `weakBoundaryPct`'s whole-part `dL` disagrees with
 * the boundary quantity on 30 of 90 live pairs, and no part of any character on
 * this cast is near-uniform enough for the two to coincide.
 */
export function figureGround(img, mask, band = 4) {
  const { width: w, height: h, data } = img;
  const grown = dilate(mask, w, h, band);
  const shrunk = (() => {
    const inv = new Uint8Array(w * h);
    for (let j = 0; j < w * h; j++) inv[j] = mask[j] ? 0 : 1;
    const g = dilate(inv, w, h, band);
    const s = new Uint8Array(w * h);
    for (let j = 0; j < w * h; j++) s[j] = mask[j] && !g[j] ? 1 : 0;
    return s;
  })();
  let eSum = 0, eN = 0, sSum = 0, sN = 0;
  for (let j = 0, i = 0; j < w * h; j++, i += 4) {
    const L = luma(data[i], data[i + 1], data[i + 2]);
    if (mask[j] && !shrunk[j]) { eSum += L; eN++; }          // subject side of the boundary
    else if (!mask[j] && grown[j]) { sSum += L; sN++; }      // ground side of the boundary
  }
  const edge = eN ? eSum / eN : 0, surround = sN ? sSum / sN : 0;
  return { edge: +edge.toFixed(4), surround: +surround.toFixed(4), contrast: +(edge - surround).toFixed(4), edgeN: eN, surroundN: sN };
}

/** Mean colour of the non-subject pixels — the "what is the backdrop" check. */
export function fieldStats(img, mask) {
  const { width: w, height: h, data } = img;
  let r = 0, g = 0, b = 0, n = 0, l2 = 0, ls = 0;
  for (let j = 0, i = 0; j < w * h; j++, i += 4) {
    if (mask[j]) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2];
    const L = luma(data[i], data[i + 1], data[i + 2]); ls += L; l2 += L * L; n++;
  }
  if (!n) return null;
  const mean = ls / n;
  return { r: +(r / n).toFixed(2), g: +(g / n).toFixed(2), b: +(b / n).toFixed(2), n, lumaMean: +mean.toFixed(4), lumaStd: +Math.sqrt(Math.max(0, l2 / n - mean * mean)).toFixed(4) };
}

/** Plain RGB euclidean distance in 8-bit units. Blunt, but it is a BACKDROP check. */
export function rgbDist(a, b) {
  return +Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2).toFixed(2);
}

/** Descriptive panel statistics — NOT a quality score. See pp_pack.mjs's note. */
export function panelStats(img, mask) {
  const { width: w, height: h, data } = img;
  let n = 0, ls = 0, l2 = 0, ss = 0, lmin = 1, lmax = 0;
  for (let j = 0, i = 0; j < w * h; j++, i += 4) {
    if (!mask[j]) continue;
    const L = luma(data[i], data[i + 1], data[i + 2]);
    ls += L; l2 += L * L; ss += saturation(data[i], data[i + 1], data[i + 2]);
    if (L < lmin) lmin = L; if (L > lmax) lmax = L; n++;
  }
  if (!n) return null;
  // edge density: |gradient| over subject pixels, normalised by count
  let g = 0, gn = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const j = y * w + x; if (!mask[j]) continue;
    const i = j * 4;
    const L = luma(data[i], data[i + 1], data[i + 2]);
    const Lx = luma(data[i + 4], data[i + 5], data[i + 6]);
    const Ly = luma(data[i + w * 4], data[i + w * 4 + 1], data[i + w * 4 + 2]);
    g += Math.abs(L - Lx) + Math.abs(L - Ly); gn++;
  }
  const mean = ls / n;
  return {
    px: n,
    lumaMean: +mean.toFixed(4),
    lumaStd: +Math.sqrt(Math.max(0, l2 / n - mean * mean)).toFixed(4),
    lumaRange: +(lmax - lmin).toFixed(4),
    satMean: +(ss / n).toFixed(4),
    edgeDensity: gn ? +(g / gn).toFixed(5) : 0,
  };
}

/** Resize an RGBA image so its SUBJECT bbox height becomes `targetH`. */
export async function scaleToSubjectHeight(img, bbox, targetH, field = FIELD) {
  const k = targetH / bbox.h;
  const nw = Math.max(1, Math.round(img.width * k)), nh = Math.max(1, Math.round(img.height * k));
  const buf = await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } })
    .resize(nw, nh, { kernel: 'lanczos3', fit: 'fill', background: { ...field, alpha: 255 } })
    .raw().toBuffer();
  return { data: buf, width: nw, height: nh, scale: k };
}

/** Pad/centre an image into a fixed canvas filled with FIELD. */
export async function padToCanvas(img, W, H, field = FIELD) {
  const out = Buffer.alloc(W * H * 4);
  for (let j = 0, i = 0; j < W * H; j++, i += 4) { out[i] = field.r; out[i + 1] = field.g; out[i + 2] = field.b; out[i + 3] = 255; }
  const ox = Math.round((W - img.width) / 2), oy = Math.round((H - img.height) / 2);
  for (let y = 0; y < img.height; y++) {
    const dy = oy + y; if (dy < 0 || dy >= H) continue;
    for (let x = 0; x < img.width; x++) {
      const dx = ox + x; if (dx < 0 || dx >= W) continue;
      const s = (y * img.width + x) * 4, d = (dy * W + dx) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = 255;
    }
  }
  return { data: out, width: W, height: H };
}

/** Mask of "not FIELD" — recovers the subject mask from a composited panel. */
export function maskFromField(img, field = FIELD, tol = 6) {
  const m = new Uint8Array(img.width * img.height);
  for (let j = 0, i = 0; j < img.width * img.height; j++, i += 4) {
    const d = Math.abs(img.data[i] - field.r) + Math.abs(img.data[i + 1] - field.g) + Math.abs(img.data[i + 2] - field.b);
    m[j] = d > tol ? 1 : 0;
  }
  return m;
}
