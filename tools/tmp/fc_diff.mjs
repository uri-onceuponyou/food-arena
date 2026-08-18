#!/usr/bin/env node
/**
 * fc_diff — paint WHICH PIXELS one fog layer owns, so the number can be looked at.
 *
 * `|luma(A) − luma(B)|` per pixel, on a heat ramp over a dimmed copy of A, with the
 * TRUE DAMAGE LINE overdrawn in white. That last part is the whole point: the question
 * is never "does the canopy paint pixels" but "where does it paint them RELATIVE to the
 * line that burns you", and that line is invisible in both inputs.
 *
 * The line is not re-derived here. `fc_pix.mjs` persists, for every sampled ground
 * radius on every ray, the screen point it projected to; this walks each ray, finds the
 * bracket that straddles `safeRadius`, and interpolates. So the marker and the
 * measurement come from ONE projection, and a bug in it moves both together instead of
 * quietly moving one.
 *
 * Usage:
 *   node tools/tmp/fc_diff.mjs --dir shots/fc/r140 --station S__near --a shipped --b canopyOff
 *   node tools/tmp/fc_diff.mjs --dir shots/fc/r140 --station S__near --a canopyExact --b shipped
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const DIR = arg('dir', 'shots/fc/r140');
const STN = arg('station', 'S__near');
const A_NAME = arg('a', 'shipped');
const B_NAME = arg('b', 'canopyOff');
const OUT = arg('out', join(DIR, `${STN}__DIFF_${A_NAME}_vs_${B_NAME}.png`));

const rep = JSON.parse(readFileSync(join(DIR, 'fc_pix.json'), 'utf8'));
const st = rep.stations.find((s) => s.id === STN);
if (!st) { console.error(`no station ${STN} in ${DIR}/fc_pix.json`); process.exit(2); }

const load = async (name) => {
  const { data, info } = await sharp(join(DIR, `${STN}__${name}.png`)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const A = await load(A_NAME);
const B = await load(B_NAME);
if (A.w !== B.w || A.h !== B.h) { console.error('size mismatch'); process.exit(2); }

const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
const out = Buffer.alloc(A.w * A.h * 4, 255);
let painted = 0;
for (let i = 0; i < A.w * A.h; i++) {
  const j = i * 4;
  const d = Math.abs(L(A.data, j) - L(B.data, j));
  const base = 0.30;                       // dimmed context, so the heat reads IN PLACE
  let r = A.data[j] * base, g = A.data[j + 1] * base, b = A.data[j + 2] * base;
  if (d >= 2) {
    painted++;
    const t = Math.min(1, d / 60);
    r = 255 * Math.min(1, t * 2);
    g = 255 * (t < 0.5 ? 1 : 2 - 2 * t);
    b = 255 * Math.max(0, 1 - t * 2);
  }
  out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
}

// ── THE TRUE DAMAGE LINE, from fc_pix's own projection ──────────────────────
const R = st.safeRadiusWU;
const pts = [];
for (const ray of st.perRay) {
  const rows = ray.rows;
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k], b2 = rows[k + 1];
    if ((a.rho - R) * (b2.rho - R) > 0) continue;
    const f = (R - a.rho) / (b2.rho - a.rho);
    pts.push([a.sx + (b2.sx - a.sx) * f, a.sy + (b2.sy - a.sy) * f]);
  }
}
// 🚨 NON-EMPTY BEFORE DRAWING. An empty crossing set would silently produce an image
// with no line on it, which reads exactly like "the line is off screen" — a picture
// that is wrong in the one way this whole tool exists to prevent.
if (pts.length === 0) {
  console.error(`${STN}: NO ray brackets safeRadius = ${R} — refusing to emit an unmarked frame.`);
  process.exit(1);
}
const dot = (cx, cy, rad, col) => {
  for (let y = Math.max(0, Math.round(cy - rad)); y <= Math.min(A.h - 1, Math.round(cy + rad)); y++) {
    for (let x = Math.max(0, Math.round(cx - rad)); x <= Math.min(A.w - 1, Math.round(cx + rad)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const j = (y * A.w + x) * 4;
      out[j] = col[0]; out[j + 1] = col[1]; out[j + 2] = col[2]; out[j + 3] = 255;
    }
  }
};
pts.sort((p, q) => p[0] - q[0]);
for (const p of pts) dot(p[0], p[1], 6, [255, 255, 255]);
for (const p of pts) dot(p[0], p[1], 3, [10, 10, 10]);

await sharp(out, { raw: { width: A.w, height: A.h, channels: 4 } }).png().toFile(OUT);
console.log(`${STN}  ${A_NAME} vs ${B_NAME}: ${painted} px (${(100 * painted / (A.w * A.h)).toFixed(2)}% of frame)`
  + `  ·  ${pts.length} damage-line markers (white dots) at safeRadius ${R.toFixed(2)} wu  →  ${OUT}`);
