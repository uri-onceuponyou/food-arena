#!/usr/bin/env node
/**
 * ACCEPTANCE TEST for the arena apron.
 *
 * "Undressed background" = a frame pixel that is BOTH
 *   (a) locally FLAT — a 15x15 neighbourhood whose luma range is <= FLAT_RANGE, i.e.
 *       nothing is drawn there but a smooth fill, and
 *   (b) coloured like one of the two things that live off the playfield today:
 *       the scene clear colour (warm gold) or the bare `floor_base` skirt (dark brown).
 *
 * Both tests are needed. Flatness alone catches big flat prop faces and HUD chrome;
 * colour alone catches the playfield's own warm tile. Together they isolate exactly
 * the "huge flat empty band" the apron exists to remove.
 *
 * Usage: node tools/tmp/undressed.mjs <dir-or-png> [--mask <outdir>]
 */
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';

const FLAT_RANGE = 7;   // /255 luma peak-to-peak inside the window
const WIN = 15;

function classify(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  // scene clear colour 0xffcf8a and its vignetted/graded range
  const isBg = v >= 0.55 && h >= 14 && h <= 52 && s >= 0.22 && s <= 0.66;
  // bare `floor_base` skirt (#4E3B2C lit)
  const isSkirt = v >= 0.08 && v <= 0.55 && s >= 0.25 && s <= 0.85 && h >= 5 && h <= 40;
  // the same two, seen through the closing-fog canopy (violet at 0.72 alpha)
  const isFogVoid = h >= 245 && h <= 330 && s >= 0.28 && v <= 0.62;
  return isBg || isSkirt || isFogVoid;
}

async function measure(file, maskDir) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer();
  const luma = new Float32Array(width * height);
  const colourOk = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const r = raw[p], g = raw[p + 1], b = raw[p + 2];
    luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    colourOk[i] = classify(r, g, b) ? 1 : 0;
  }
  // sliding window min/max via two 1-D passes
  const half = (WIN - 1) / 2;
  const rowMin = new Float32Array(width * height);
  const rowMax = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let lo = Infinity, hi = -Infinity;
      for (let dx = -half; dx <= half; dx++) {
        const xx = Math.min(width - 1, Math.max(0, x + dx));
        const val = luma[y * width + xx];
        if (val < lo) lo = val;
        if (val > hi) hi = val;
      }
      rowMin[y * width + x] = lo;
      rowMax[y * width + x] = hi;
    }
  }
  const flat = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let lo = Infinity, hi = -Infinity;
      for (let dy = -half; dy <= half; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy));
        const a = rowMin[yy * width + x], b2 = rowMax[yy * width + x];
        if (a < lo) lo = a;
        if (b2 > hi) hi = b2;
      }
      flat[y * width + x] = hi - lo <= FLAT_RANGE ? 1 : 0;
    }
  }
  let n = 0;
  const mask = maskDir ? Buffer.alloc(width * height * 3) : null;
  for (let i = 0, p = 0; i < width * height; i++, p += 3) {
    const bad = flat[i] && colourOk[i];
    if (bad) n++;
    if (mask) {
      if (bad) { mask[p] = 255; mask[p + 1] = 0; mask[p + 2] = 255; }
      else { const l = luma[i] * 0.5; mask[p] = mask[p + 1] = mask[p + 2] = l; }
    }
  }
  if (mask) {
    await mkdir(maskDir, { recursive: true });
    await sharp(mask, { raw: { width, height, channels: 3 } })
      .png().toFile(join(maskDir, basename(file)));
  }
  return (100 * n) / (width * height);
}

const target = resolve(process.argv[2]);
const maskIdx = process.argv.indexOf('--mask');
const maskDir = maskIdx > 0 ? resolve(process.argv[maskIdx + 1]) : null;
const files = statSync(target).isDirectory()
  ? (await readdir(target)).filter((f) => f.endsWith('.png')).sort().map((f) => join(target, f))
  : [target];

let sum = 0, worst = 0, worstName = '';
for (const f of files) {
  const pct = await measure(f, maskDir);
  sum += pct;
  if (pct > worst) { worst = pct; worstName = basename(f); }
  console.log(`${basename(f).padEnd(26)} ${pct.toFixed(2).padStart(6)} %`);
}
console.log(`\nmean ${(sum / files.length).toFixed(2)} %   worst ${worst.toFixed(2)} % (${worstName})`);
