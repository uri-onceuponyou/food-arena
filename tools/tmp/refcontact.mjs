#!/usr/bin/env node
/**
 * HOW DARK IS THE GROUND AT A PROP'S BASE, IN THE REFERENCE?
 *
 * `tools/tmp/aoband.mjs` produces `contactContrast` — open-floor luma minus
 * contact-band luma — for our own arena, from an ablation-built floor mask and an
 * exact homography. That number is meaningless without a target, and the target has to
 * come off the plates the arena is scored against.
 *
 * A reference plate has no scene graph, so the footprints are HAND-MARKED here: each
 * entry is a prop's base ellipse read off a zoomed crop, plus the direction its own
 * shadow falls (also read off the crop, and the fact that every prop in a plate agrees
 * on that direction is itself the check that the marks are real).
 *
 * Reported per prop:
 *   openL      mean luma of a clean floor disc, `openR` px away on the LIT side
 *   contactL   mean luma of the annulus 0..`band` px outside the base, SHADOW side
 *   contrast   openL - contactL         <- the same quantity `aoband` reports
 *   lit        openL - (same annulus on the LIT side)   <- how ASYMMETRIC it is
 *
 * The last column is the one that decides the shape of the fix: a symmetric AO ring
 * has lit == contrast, a real light-driven contact shadow has lit near zero.
 *
 *   node tools/tmp/refcontact.mjs
 *   node tools/tmp/refcontact.mjs --selftest
 */
import sharp from 'sharp';

const has = (k) => process.argv.includes('--' + k);
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Mean luma over pixels whose distance from an ELLIPSE (cx,cy,rx,ry) falls in
 * [r0, r1] normalised radii, restricted to a half-plane facing `dirDeg` (screen
 * degrees, +x right, +y down) within `halfAngle`. `dirDeg = null` means all round.
 */
export function annulus(buf, w, h, e, r0, r1, dirDeg, halfAngle = 70) {
  let n = 0, sum = 0;
  const dx0 = dirDeg == null ? 0 : Math.cos((dirDeg * Math.PI) / 180);
  const dy0 = dirDeg == null ? 0 : Math.sin((dirDeg * Math.PI) / 180);
  const cosLim = Math.cos((halfAngle * Math.PI) / 180);
  const R = Math.max(e.rx, e.ry) * r1 + 2;
  for (let y = Math.max(0, Math.floor(e.cy - R)); y < Math.min(h, Math.ceil(e.cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(e.cx - R)); x < Math.min(w, Math.ceil(e.cx + R)); x++) {
      const ux = (x - e.cx) / e.rx, uy = (y - e.cy) / e.ry;
      const t = Math.hypot(ux, uy);
      if (t < r0 || t > r1) continue;
      if (dirDeg != null) {
        const l = Math.hypot(x - e.cx, y - e.cy) || 1;
        if (((x - e.cx) / l) * dx0 + ((y - e.cy) / l) * dy0 < cosLim) continue;
      }
      const i = (y * w + x) * 3;
      sum += luma(buf[i], buf[i + 1], buf[i + 2]); n++;
    }
  }
  return { n, mean: n ? sum / n : 0 };
}

if (has('selftest')) {
  let pass = 0, fail = 0;
  const ok = (nm, c, g) => { if (c) pass++; else { fail++; console.log(`  FAIL ${nm} got ${g}`); } };
  const near = (a, b, t = 1e-4) => Math.abs(a - b) <= t;
  const w = 200, h = 200;
  const buf = Buffer.alloc(w * h * 3, 200);
  const e = { cx: 100, cy: 100, rx: 20, ry: 20 };
  // paint the LEFT half of the annulus 1.0..1.6 dark
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = Math.hypot((x - 100) / 20, (y - 100) / 20);
    if (t >= 1 && t <= 1.6 && x < 100) buf.fill(100, (y * w + x) * 3, (y * w + x) * 3 + 3);
  }
  const all = annulus(buf, w, h, e, 1, 1.6, null);
  const left = annulus(buf, w, h, e, 1, 1.6, 180, 70);
  const right = annulus(buf, w, h, e, 1, 1.6, 0, 70);
  ok('left sector finds the dark side', near(left.mean, luma(100, 100, 100)), left.mean);
  ok('right sector is untouched', near(right.mean, luma(200, 200, 200)), right.mean);
  ok('all-round sits between', all.mean > left.mean && all.mean < right.mean, all.mean);
  ok('sectors are smaller than all-round', left.n < all.n && right.n < all.n, `${left.n}/${right.n}/${all.n}`);
  const outside = annulus(buf, w, h, e, 2.2, 3.0, null);
  ok('outside the painted band is clean', near(outside.mean, luma(200, 200, 200)), outside.mean);
  console.log(`\nrefcontact --selftest  ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

// ── HAND-MARKED PROP BASES ───────────────────────────────────────────────────
// Read off 2x crops. `shadowDeg` is where that prop's OWN shadow falls, in screen
// degrees (+x right, +y down); every prop in a plate agrees on it, which is the check
// that these marks describe the image rather than my expectation of it.
// ⚠️ The FIRST set of marks was wrong and the overlay caught it: the ellipses sat at
// each barrel's mid-body rather than at its foot, and two of the four landed on the
// crate itself, which is why one prop came back with the ground at its base LIGHTER
// than open floor (-0.1333). Marks are only usable once they have been drawn back onto
// the plate and looked at (`/tmp/refmarks2.png` in that session).
const MARKS = [
  { plate: 'bs_04', name: 'barrel_left', cx: 476, cy: 737, rx: 36, ry: 13, shadowDeg: 180 },
  { plate: 'bs_04', name: 'barrel_right', cx: 762, cy: 737, rx: 36, ry: 13, shadowDeg: 180 },
];
const R_CONTACT = [1.0, 1.6];
const R_OPEN = [3.0, 3.8];

const rows = [];
for (const m of MARKS) {
  if (m.cx == null) continue;
  const file = `reference/images/curated/gameplay_topdown/${m.plate}.png`;
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const e = { cx: m.cx, cy: m.cy, rx: m.rx, ry: m.ry };
  const lit = (m.shadowDeg + 180) % 360;
  const contact = annulus(data, info.width, info.height, e, R_CONTACT[0], R_CONTACT[1], m.shadowDeg);
  const contactLit = annulus(data, info.width, info.height, e, R_CONTACT[0], R_CONTACT[1], lit);
  const open = annulus(data, info.width, info.height, e, R_OPEN[0], R_OPEN[1], lit);
  rows.push({ ...m, contactL: contact.mean, litL: contactLit.mean, openL: open.mean,
    contrast: open.mean - contact.mean, litContrast: open.mean - contactLit.mean });
}
console.log('plate  prop               openL   contactL  contrast   litL   litContrast');
for (const r of rows) {
  console.log(`${r.plate}  ${r.name.padEnd(16)} ${r.openL.toFixed(4)}   ${r.contactL.toFixed(4)}   ${r.contrast.toFixed(4)}  ${r.litL.toFixed(4)}   ${r.litContrast.toFixed(4)}`);
}
const mean = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
console.log(`\nmean contrast (shadow side) ${mean((r) => r.contrast).toFixed(4)}   mean contrast (lit side) ${mean((r) => r.litContrast).toFixed(4)}`);
