#!/usr/bin/env node
/**
 * c2_sheet — labelled contact sheet of the SAME crop across N captures.
 *
 * THROWAWAY, READ-ONLY on src/. Owned by CAST-FINISH-2 (`c2_*`).
 *
 * `tools/tmp/_sheet.mjs` crops a FIXED fraction of the frame (30%/20% -> 40%/55%),
 * which is the torso band. This round is about BOOTS, BROWS and EARS, none of which
 * are in that band, so the crop is a parameter here — and it is the same rect for
 * every tile by construction, because a sheet whose tiles are framed differently is
 * not a comparison (`cf_shot`'s own note about mixing pitches).
 *
 *   node tools/tmp/c2_sheet.mjs --out sheet.png --rect x,y,w,h [--scale 2] \
 *     --cols 3 label=path label=path ...
 */
import sharp from 'sharp';

const a = process.argv.slice(2);
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const OUT = get('--out', null);
const RECT = get('--rect', null);
const SCALE = Number(get('--scale', '2'));
const COLS = Number(get('--cols', '0'));
const pairs = a.filter((s) => s.includes('=') && !s.startsWith('--'));
if (!OUT || !RECT || !pairs.length) {
  console.error('usage: c2_sheet --out <png> --rect x,y,w,h [--scale n] [--cols n] label=path ...');
  process.exit(2);
}
const [rx, ry, rw, rh] = RECT.split(',').map(Number);

const tiles = [];
for (const p of pairs) {
  const i = p.indexOf('=');
  const label = p.slice(0, i), file = p.slice(i + 1);
  const m = await sharp(file).metadata();
  // Clamp rather than throw: a capture at a different size should still land on the
  // sheet with a visible size difference, not abort the whole comparison.
  const left = Math.max(0, Math.min(rx, m.width - 1));
  const top = Math.max(0, Math.min(ry, m.height - 1));
  const width = Math.min(rw, m.width - left);
  const height = Math.min(rh, m.height - top);
  const crop = await sharp(file).extract({ left, top, width, height })
    .resize({ width: Math.round(width * SCALE), kernel: 'nearest' }).toBuffer();
  const cm = await sharp(crop).metadata();
  const bar = Buffer.from(
    `<svg width="${cm.width}" height="40"><rect width="100%" height="100%" fill="#12121c"/>`
    + `<text x="12" y="27" font-family="Helvetica,Arial" font-size="22" fill="#f2f2f8">${label}</text></svg>`);
  tiles.push(await sharp({ create: { width: cm.width, height: cm.height + 40, channels: 3, background: '#12121c' } })
    .composite([{ input: bar, left: 0, top: 0 }, { input: crop, left: 0, top: 40 }]).png().toBuffer());
}

const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
const cols = COLS > 0 ? COLS : tiles.length;
const rows = Math.ceil(tiles.length / cols);
const cw = Math.max(...metas.map((m) => m.width)) + 8;
const chh = Math.max(...metas.map((m) => m.height)) + 8;
const comp = tiles.map((t, i) => ({ input: t, left: 8 + (i % cols) * cw, top: 8 + Math.floor(i / cols) * chh }));
await sharp({ create: { width: 8 + cols * cw, height: 8 + rows * chh, channels: 3, background: '#0b0b12' } })
  .composite(comp).png().toFile(OUT);
console.log('wrote', OUT, `${8 + cols * cw}x${8 + rows * chh}`, `${tiles.length} tiles`);
