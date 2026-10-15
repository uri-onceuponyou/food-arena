#!/usr/bin/env node
/**
 * GX_RENDER_SHEET — crop the SAME region out of several frames, scale it (nearest), label it,
 * and tile it. For reading a single-variable A/B at 2-4x, where a whole-frame sheet hides it.
 *
 *   node tools/tmp/gx_render_sheet.mjs --crop x,y,w,h --scale 2 --cols 3 \
 *     --in "a.png=label a,b.png=label b" --out sheet.png
 *
 * Also prints, per input, the mean Rec.709 luma and mean HSV saturation of up to four named
 * sample boxes (`--boxes name:x,y,w,h;name:x,y,w,h`, frame coordinates) so a value step the eye
 * reads can be checked against a number — and the number can be checked against the eye.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [cx, cy, cw, ch] = String(arg('--crop', '0,0,400,300')).split(',').map(Number);
const SCALE = Number(arg('--scale', 2));
const COLS = Number(arg('--cols', 3));
const OUT = arg('--out', 'sheet.png');
const INS = String(arg('--in', '')).split(',').filter(Boolean).map((s) => { const i = s.indexOf('='); return i < 0 ? [s, s.split('/').pop()] : [s.slice(0, i), s.slice(i + 1)]; });
const BOXES = String(arg('--boxes', '')).split(';').filter(Boolean).map((s) => { const [n, r] = s.split(':'); return [n, r.split(',').map(Number)]; });
const LABEL_H = 34;

const lab = (w, t) => Buffer.from(`<svg width="${w}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#16101f"/><text x="8" y="24" font-family="Helvetica,Arial" font-size="20" font-weight="700" fill="#fff">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

async function boxStats(file, [x, y, w, h]) {
  const { data, info } = await sharp(file).extract({ left: x, top: y, width: w, height: h }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let L = 0, S = 0, n = 0, R = 0, G = 0, B = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    L += 0.2126 * r + 0.7152 * g + 0.0722 * b; S += mx > 0 ? (mx - mn) / mx : 0; R += r; G += g; B += b; n++;
  }
  return { luma: L / n, sat: S / n, rgb: [R / n, G / n, B / n].map((v) => Math.round(v * 255)) };
}

const tiles = [];
for (const [file, label] of INS) {
  let img = await sharp(file).extract({ left: cx, top: cy, width: cw, height: ch }).resize({ width: cw * SCALE, height: ch * SCALE, kernel: 'nearest' }).png().toBuffer();
  if (argv.includes('--draw') && BOXES.length) {
    // outline each sample box (frame coords -> crop coords), so a box can be SEEN to sit on the
    // surface it claims to measure — a box in the wrong place is the valuescan failure.
    const rects = BOXES.map(([n, [x, y, w, h]]) => `<rect x="${(x - cx) * SCALE}" y="${(y - cy) * SCALE}" width="${w * SCALE}" height="${h * SCALE}" fill="none" stroke="#00ff66" stroke-width="2"/><text x="${(x - cx) * SCALE + 3}" y="${(y - cy) * SCALE + 14}" font-size="13" fill="#00ff66" font-family="Helvetica">${n}</text>`).join('');
    img = await sharp(img).composite([{ input: Buffer.from(`<svg width="${cw * SCALE}" height="${ch * SCALE}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`), top: 0, left: 0 }]).png().toBuffer();
  }
  const W = cw * SCALE;
  const t = await sharp({ create: { width: W, height: ch * SCALE + LABEL_H, channels: 3, background: '#16101f' } })
    .composite([{ input: lab(W, label), top: 0, left: 0 }, { input: img, top: LABEL_H, left: 0 }]).png().toBuffer();
  tiles.push(t);
  if (BOXES.length) {
    const parts = [];
    for (const [n, b] of BOXES) { const s = await boxStats(file, b); parts.push(`${n} L${s.luma.toFixed(3)} S${s.sat.toFixed(3)} rgb(${s.rgb.join(',')})`); }
    console.log(`${label.padEnd(26)} ${parts.join('  |  ')}`);
  }
}
const TW = cw * SCALE, TH = ch * SCALE + LABEL_H, GAP = 8;
const rows = Math.ceil(tiles.length / COLS);
const sheet = sharp({ create: { width: COLS * TW + (COLS - 1) * GAP, height: rows * TH + (rows - 1) * GAP, channels: 3, background: '#000' } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * (TW + GAP), top: Math.floor(i / COLS) * (TH + GAP) })));
writeFileSync(OUT, await sheet.png().toBuffer());
console.log(`wrote ${OUT}`);
