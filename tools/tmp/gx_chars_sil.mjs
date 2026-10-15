#!/usr/bin/env node
/**
 * GX_CHARS_SIL — per-character silhouette area / bbox / fill from a roster silhouette
 * frame (`preview.html?piece=roster&silhouette=1`, black figures on white). Columns are
 * split at the gaps between figures (runs of empty columns), so no character order is
 * assumed beyond left-to-right = CHARACTER_IDS order. Shadows are excluded by the
 * threshold (figures are pure black; the soft contact shadow is grey).
 * Known-bad: an all-white frame must yield 0 components (refuses).
 */
import sharp from 'sharp';
const [, , file, thrArg] = process.argv;
const THR = Number(thrArg ?? 40);
const IDS = ['hamburger','donut','taco','burrito','egg','lollipop','pizza','sushi','soup','waterbottle','hotdog'];
const { data, info } = await sharp(file).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const colHas = new Array(W).fill(0);
for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (data[y * W + x] < THR) colHas[x]++;
const comps = []; let x = 0;
while (x < W) { if (!colHas[x]) { x++; continue; } let x0 = x; while (x < W && colHas[x]) x++; comps.push([x0, x - 1]); }
// merge components separated by < 6 px (one figure split by a thin gap)
const merged = [];
for (const c of comps) { const l = merged[merged.length - 1]; if (l && c[0] - l[1] < 6) l[1] = c[1]; else merged.push([...c]); }
if (!merged.length) { console.log('REFUSED: no figures'); process.exit(1); }
console.log(`${file}: ${merged.length} components (expect ${IDS.length})`);
const rows = merged.map((c, i) => {
  let area = 0, y0 = H, y1 = -1;
  for (let xx = c[0]; xx <= c[1]; xx++) for (let y = 0; y < H; y++) if (data[y * W + xx] < THR) { area++; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = c[1] - c[0] + 1, h = y1 - y0 + 1;
  return { id: IDS[i] ?? `#${i}`, area, w, h, fill: +(area / (w * h)).toFixed(3) };
});
const maxA = Math.max(...rows.map((r) => r.area));
for (const r of rows) console.log(`  ${r.id.padEnd(12)} area ${String(r.area).padStart(6)}  (${(r.area / maxA * 100).toFixed(0).padStart(3)}% of largest)  bbox ${r.w}x${r.h}  fill ${r.fill}`);
const areas = rows.map((r) => r.area).sort((a, b) => a - b);
console.log(`  max/min area ratio ${(areas[areas.length - 1] / areas[0]).toFixed(2)}`);
