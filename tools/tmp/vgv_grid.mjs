#!/usr/bin/env node
/**
 * VGV_GRID — WHERE do two frames differ, as a 32x18 ASCII map.
 *
 * Built for one question a cross-tree A/B cannot answer with a number: `vg_frame`'s
 * every metric is a WITHIN-ARM diff against that arm's own baseline, so a STATIC
 * difference between the two commits cancels out of all of them and is invisible.
 * Measured on `8ca8f88` vs `a494f98`, desktop p58: the two IDLE baselines already
 * differ by **7,492 px, max channel delta 215**, and none of it is VFX — it is
 * `hud.ts`'s nameplate level, the damage number, and soup's broth going gold.
 *
 *   node tools/tmp/vgv_grid.mjs <a.png> <b.png>
 */
import sharp from 'sharp';
const load = async (p) => { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const a = await load(process.argv[2]), b = await load(process.argv[3]);
if (a.w !== b.w || a.h !== b.h) { console.error('size mismatch'); process.exit(2); }
const GX = 32, GY = 18;
const g = Array.from({ length: GY }, () => new Array(GX).fill(0));
let tot = 0, maxd = 0;
for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
  const i = (y * a.w + x) * 4;
  const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
  if (d > 6) { g[Math.floor(y / a.h * GY)][Math.floor(x / a.w * GX)]++; tot++; if (d > maxd) maxd = d; }
}
console.log('total', tot, 'maxChannelDelta', maxd, `grid ${GX}x${GY} of ${a.w}x${a.h}`);
const ch = (n) => n === 0 ? '.' : n < 5 ? ':' : n < 20 ? 'o' : n < 60 ? 'O' : n < 150 ? '#' : '@';
g.forEach((row, i) => console.log(String(Math.round(i / GY * a.h)).padStart(4), row.map(ch).join('')));
