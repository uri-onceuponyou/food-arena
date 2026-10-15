#!/usr/bin/env node
/**
 * GX_RENDER_STATS — whole-frame (or band) colour statistics for a list of PNGs, so an arm's
 * effect on the frame can be stated as a number next to the PNG it came from.
 *
 *   node tools/tmp/gx_render_stats.mjs [--band y0,y1] a.png b.png ...
 *
 * Columns: mean Rec.709 luma (of sRGB-encoded values, the convention every colour figure in
 * this repo uses), p05/p50/p95 luma, mean HSV saturation, mean absolute chroma (max-min)/255,
 * share of pixels with luma >= 0.80 (`hi80`, the "the game draws no highlights" statistic),
 * share with all three channels >= 250 (`white`).
 * Known-bad self-check (`--selftest`): a flat grey must read sat 0 and chroma 0, a pure red
 * sat 1 and chroma 1 — the arithmetic is validated before any frame is read.
 */
import sharp from 'sharp';

const argv = process.argv.slice(2);
const bandArg = argv.indexOf('--band') >= 0 ? argv[argv.indexOf('--band') + 1] : null;
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--band');

function stats(data, channels, w, h, y0 = 0, y1 = 1) {
  const r0 = Math.round(y0 * h), r1 = Math.round(y1 * h);
  const L = []; let S = 0, C = 0, hi = 0, white = 0, n = 0;
  for (let y = r0; y < r1; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * channels;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    L.push(l); S += mx > 0 ? (mx - mn) / mx : 0; C += mx - mn;
    if (l >= 0.8) hi++;
    if (data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250) white++;
    n++;
  }
  L.sort((a, b) => a - b);
  const q = (p) => L[Math.min(L.length - 1, Math.floor(p * L.length))];
  const mean = L.reduce((a, b) => a + b, 0) / n;
  return { n, luma: mean, p05: q(0.05), p50: q(0.5), p95: q(0.95), sat: S / n, chroma: C / n, hi80: hi / n, white: white / n };
}

if (argv.includes('--selftest')) {
  const mk = (rgb) => { const d = new Uint8Array(16 * 16 * 3); for (let i = 0; i < d.length; i += 3) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; } return d; };
  const g = stats(mk([128, 128, 128]), 3, 16, 16); const r = stats(mk([255, 0, 0]), 3, 16, 16);
  const ok = g.sat === 0 && g.chroma === 0 && Math.abs(r.sat - 1) < 1e-9 && Math.abs(r.chroma - 1) < 1e-9 && r.hi80 === 0;
  console.log(`selftest grey sat ${g.sat} chroma ${g.chroma} · red sat ${r.sat} chroma ${r.chroma} hi80 ${r.hi80} -> ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}
if (!files.length) { console.error('no files'); process.exit(2); }
if (!files.length) process.exit(2);
const [y0, y1] = bandArg ? bandArg.split(',').map(Number) : [0, 1];
console.log(`${'file'.padEnd(34)} ${'luma'.padStart(6)} ${'p05'.padStart(6)} ${'p50'.padStart(6)} ${'p95'.padStart(6)} ${'sat'.padStart(6)} ${'chroma'.padStart(6)} ${'hi80%'.padStart(6)} ${'white%'.padStart(7)}`);
for (const f of files) {
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const s = stats(data, info.channels, info.width, info.height, y0, y1);
  const f4 = (v) => v.toFixed(4).padStart(6);
  console.log(`${f.split('/').slice(-1)[0].slice(0, 34).padEnd(34)} ${f4(s.luma)} ${f4(s.p05)} ${f4(s.p50)} ${f4(s.p95)} ${f4(s.sat)} ${f4(s.chroma)} ${(s.hi80 * 100).toFixed(2).padStart(6)} ${(s.white * 100).toFixed(3).padStart(7)}`);
}
