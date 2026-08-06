#!/usr/bin/env node
/**
 * Draw the page-derived foot ellipse, the measured flanks and the floor rect onto
 * one of our own captured frames. Same discipline as `cs_mark.mjs` applies to the
 * side that is NOT hand-marked: an ellipse that has not been looked at is a guess,
 * whether a human placed it or a projection did.
 *
 *   node tools/tmp/cs_oursmark.mjs shots/contact/before/ours.json <index>
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { NEAR, FLOOR_BAND, HALF_ANGLE, mirrorDeg } from './cs_charcontact.mjs';

const rows = JSON.parse(await readFile(process.argv[2], 'utf8')).filter((r) => r.kind === 'char' && r.nearPx > 0);
const dir = process.argv[2].replace(/\/[^/]+$/, '');
for (const r of rows) {
  const f = `${dir}/${r.plate.replace(':', '_')}__shipped.png`;
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; };
  const e = r.ellipse;
  for (const [t, c] of [[NEAR[0], [255, 0, 0]], [NEAR[1], [0, 255, 255]], [FLOOR_BAND[0], [255, 255, 0]]]) {
    for (let a = 0; a < 4000; a++) { const th = (a * Math.PI) / 2000; put(e.cx + e.rx * t * Math.cos(th), e.cy + e.ry * t * Math.sin(th), c); }
  }
  for (const d of [r.shadowDeg, mirrorDeg(r.shadowDeg)]) {
    for (const s of [-1, 1]) { const th = ((d + s * HALF_ANGLE) * Math.PI) / 180; for (let q = 0; q < 200; q++) put(e.cx + q * Math.cos(th), e.cy + q * Math.sin(th), [0, 255, 0]); }
  }
  for (let q = 0; q < 160; q++) put(e.cx + q * Math.cos((r.shadowDeg * Math.PI) / 180), e.cy + q * Math.sin((r.shadowDeg * Math.PI) / 180), [255, 0, 255]);
  const fr = r.floorRect;
  for (let x = fr.cx - (fr.w >> 1); x <= fr.cx + (fr.w >> 1); x++) { put(x, fr.cy - (fr.h >> 1), [255, 255, 255]); put(x, fr.cy + (fr.h >> 1), [255, 255, 255]); }
  for (let y = fr.cy - (fr.h >> 1); y <= fr.cy + (fr.h >> 1); y++) { put(fr.cx - (fr.w >> 1), y, [255, 255, 255]); put(fr.cx + (fr.w >> 1), y, [255, 255, 255]); }
  const out = `${dir}/mk_${r.plate.replace(':', '_')}_${r.name}.png`;
  await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
  const R = Math.round(Math.max(e.rx, e.ry) * 3.2);
  await sharp(data, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left: Math.max(0, Math.min(W - 2 * R, Math.round(e.cx - R))), top: Math.max(0, Math.min(H - 2 * R, Math.round(e.cy - R))), width: 2 * R, height: 2 * R })
    .resize(560, 560, { kernel: 'nearest' }).png().toFile(out.replace('.png', '_zoom.png'));
  console.log('wrote', out);
}
