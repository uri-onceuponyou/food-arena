#!/usr/bin/env node
/**
 * GX_VFX_SHEET — tile `gx_vfx_cap.mjs --plan beats` renders into per-beat contact sheets.
 *
 * Rows are characters, columns are the weapon SLOTS (melee / short / long / super), and
 * every tile is a crop centred on the effect's own projected screen point (recorded by
 * the capture at fire time), so the effect sits in the middle of its tile at the match
 * camera's real scale. The empty-frame render is tiled first as the null control: if it
 * shows an effect, the crops are not of what they claim.
 *
 *   node tools/tmp/gx_vfx_sheet.mjs --dir shots/rv/audit/vfx/beats [--tw 300 --th 210]
 */
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const DIR = args.dir ?? 'shots/rv/audit/vfx/beats';
const TW = Number(args.tw ?? 300), TH = Number(args.th ?? 210);
const SCALE = Number(args.scale ?? 1);
const data = JSON.parse(readFileSync(`${DIR}/beats.json`, 'utf8')).result;
const SLOTS = ['melee', 'short', 'long', 'super'];
const CHARS = [...new Set(data.map((r) => r.who))];
const LABEL_W = 120, HEAD_H = 34, GAP = 6;
const BG = { r: 22, g: 16, b: 31, alpha: 1 };

const svgText = (w, h, text, size = 16, anchor = 'middle') => Buffer.from(
  `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="${anchor === 'middle' ? w / 2 : 6}" y="${h * 0.68}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700" fill="#ffffff" text-anchor="${anchor}">${text}</text></svg>`);

async function tile(file, sx, sy) {
  const img = sharp(file);
  const m = await img.metadata();
  // crop box centred a little ABOVE the ground point so the 1-2 m tall burst is framed
  const cw = Math.round(TW / SCALE), ch = Math.round(TH / SCALE);
  const left = Math.max(0, Math.min(m.width - cw, Math.round(sx - cw / 2)));
  const top = Math.max(0, Math.min(m.height - ch, Math.round(sy - ch * 0.62)));
  return img.extract({ left, top, width: cw, height: ch }).resize(TW, TH).png().toBuffer();
}

async function sheet(kind, ms) {
  const rows = CHARS.length;
  const W = LABEL_W + SLOTS.length * (TW + GAP) + GAP;
  const H = HEAD_H + rows * (TH + GAP) + GAP;
  const comps = [];
  SLOTS.forEach((s, i) => comps.push({ input: svgText(TW, HEAD_H, s.toUpperCase()), left: LABEL_W + GAP + i * (TW + GAP), top: 0 }));
  for (let r = 0; r < rows; r++) {
    const who = CHARS[r];
    comps.push({ input: svgText(LABEL_W, TH, who, 15, 'start'), left: 0, top: HEAD_H + r * (TH + GAP) });
    for (let c = 0; c < SLOTS.length; c++) {
      const row = data.find((d) => d.who === who && d.slot === SLOTS[c] && d.kind === kind && d.ms === ms);
      if (!row || !existsSync(`${DIR}/${row.name}.png`)) continue;
      const buf = await tile(`${DIR}/${row.name}.png`, row.sx * (row.cw / 1600), row.sy * (row.ch / 900));
      const left = LABEL_W + GAP + c * (TW + GAP), top = HEAD_H + r * (TH + GAP);
      comps.push({ input: buf, left, top });
      comps.push({ input: svgText(TW, 22, `${row.key}${row.type === 'self' ? ' (self)' : ''}`, 13, 'start'), left, top });
    }
  }
  const out = `${DIR}/sheet_${kind}_${ms}.png`;
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(comps).png().toFile(out);
  console.log('wrote', out);
}

const kinds = [...new Set(data.map((d) => d.kind))];
const mss = [...new Set(data.map((d) => d.ms))];
for (const k of kinds) for (const ms of mss) await sheet(k, ms);
// null control: the empty frame cropped where the impacts land
if (existsSync(`${DIR}/beat_empty.png`)) {
  const any = data.find((d) => d.kind === 'impact');
  if (any) {
    const buf = await tile(`${DIR}/beat_empty.png`, any.sx * (any.cw / 1600), any.sy * (any.ch / 900));
    await sharp(buf).toFile(`${DIR}/sheet_null_control.png`);
    console.log('wrote', `${DIR}/sheet_null_control.png`);
  }
}
