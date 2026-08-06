#!/usr/bin/env node
/**
 * DRAW THE MARKS BACK ONTO THE PLATE AND LOOK AT THEM.
 *
 * `tools/tmp/refcontact.mjs` records why this exists: its FIRST set of hand marks
 * was wrong — the ellipses sat at each barrel's mid-body rather than at its foot,
 * two of four landed on the crate itself, and one prop came back with the ground at
 * its base LIGHTER than open floor. Only the overlay caught it. A mark that has not
 * been drawn back onto the image is not a measurement, it is a guess with a decimal
 * point.
 *
 * Rings drawn, matching `cs_charcontact.mjs`'s own bands exactly:
 *   red     t = 1.10   inner edge of NEAR — must sit just outside the feet
 *   cyan    t = 2.20   outer edge of NEAR — must stay INSIDE the team-indicator decal
 *   yellow  t = 2.60 and 6.00   the floor-level support — its MODE is the floor
 *   magenta the shadow direction, 60 px
 *   green   the two measured flanks at t = 1.65 (shade and its mirror), so the
 *           down-screen policy is visible rather than asserted
 *
 *   node tools/tmp/cs_mark.mjs [tools/tmp/cs_marks.json]
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { NEAR, FLOOR_BAND, HALF_ANGLE, FLOOR_HALF_ANGLE, mirrorDeg } from './cs_charcontact.mjs';

const SRC = process.argv[2] ?? 'tools/tmp/cs_marks.json';
const OUT = 'shots/contact';
await mkdir(OUT, { recursive: true });
const SPEC = JSON.parse(await readFile(SRC, 'utf8'));
const MARKS = SPEC.marks ?? SPEC;
const RECTS = SPEC.floorRects ?? {};

const byPlate = new Map();
for (const m of MARKS) { const a = byPlate.get(m.plate) ?? []; a.push(m); byPlate.set(m.plate, a); }

for (const [plate, ms] of byPlate) {
  const f = `reference/images/curated/gameplay_topdown/${plate}.png`;
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const put = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
  };
  for (const m of ms) {
    for (const [t, c] of [[NEAR[0], [255, 0, 0]], [NEAR[1], [0, 255, 255]], [FLOOR_BAND[0], [255, 255, 0]], [FLOOR_BAND[1], [255, 255, 0]]]) {
      for (let a = 0; a < 3000; a++) {
        const th = (a * Math.PI) / 1500;
        put(m.cx + m.rx * t * Math.cos(th), m.cy + m.ry * t * Math.sin(th), c);
      }
    }
    for (let r = 0; r < 70; r++) put(m.cx + r * Math.cos((m.shadowDeg * Math.PI) / 180), m.cy + r * Math.sin((m.shadowDeg * Math.PI) / 180), [255, 0, 255]);
    // the two flanks, as measured
    for (const dir of [m.shadowDeg, mirrorDeg(m.shadowDeg)]) {
      for (const s of [-1, 1]) {
        const th = ((dir + s * HALF_ANGLE) * Math.PI) / 180;
        for (let r = 0; r < 110; r++) put(m.cx + r * Math.cos(th), m.cy + r * Math.sin(th), [0, 255, 0]);
      }
    }
  }
  // the hand-marked floor rect this plate's rows take their floor LEVEL from
  const fr = RECTS[plate];
  if (fr) {
    for (let x = fr.cx - (fr.w >> 1); x <= fr.cx + (fr.w >> 1); x++) { put(x, fr.cy - (fr.h >> 1), [255, 255, 255]); put(x, fr.cy + (fr.h >> 1), [255, 255, 255]); }
    for (let y = fr.cy - (fr.h >> 1); y <= fr.cy + (fr.h >> 1); y++) { put(fr.cx - (fr.w >> 1), y, [255, 255, 255]); put(fr.cx + (fr.w >> 1), y, [255, 255, 255]); }
  }
  await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${OUT}/marks_${plate}.png`);
  for (const m of ms) {
    const R = Math.round(Math.max(m.rx, m.ry) * FLOOR_BAND[1] * 0.75) + 20;
    const L = Math.max(0, Math.min(W - 2 * R, Math.round(m.cx - R)));
    const T = Math.max(0, Math.min(H - 2 * R, Math.round(m.cy - R)));
    await sharp(data, { raw: { width: W, height: H, channels: 3 } })
      .extract({ left: L, top: T, width: Math.min(2 * R, W - L), height: Math.min(2 * R, H - T) })
      .resize(480, 480, { fit: 'fill', kernel: 'nearest' }).png().toFile(`${OUT}/mk_${m.plate}_${m.name}.png`);
  }
  console.log(`wrote ${OUT}/marks_${plate}.png  (${ms.length} marks)`);
}
