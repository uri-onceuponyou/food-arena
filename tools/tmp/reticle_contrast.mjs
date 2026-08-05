#!/usr/bin/env node
/**
 * Objective acceptance test for the pointer-lock aim reticle.
 *
 * PROGRESS.md's standing lesson: an element with no measurable acceptance test
 * oscillates at its noise floor forever. "Reads well" is not a test. This is.
 *
 * Under pointer lock the OS cursor is hidden, so the reticle IS the cursor. The one
 * property that decides whether it survives is not size or colour — it is whether it
 * puts BOTH a near-black and a near-white pixel inside its own footprint, on every
 * background this arena can put behind it (cream tile, terracotta tile, dark plum
 * props, the violet fog wash, and above all its OWN saturated orange muzzle cone,
 * which it sits inside on literally every shot).
 *
 * So, inside the reticle's bounding box:
 *   darkFrac   fraction of pixels with luma < 55   -- the dark backer
 *   lightFrac  fraction of pixels with luma > 205  -- the bright fill
 *   spread     p97(luma) - p3(luma)                -- headline local contrast
 *
 * PASS = darkFrac >= 0.05 AND lightFrac >= 0.05 AND spread >= 150, on EVERY sample.
 * A crosshair that only clears one of those is the dark-on-dark failure this project
 * has now hit three separate times (PROGRESS.md, "the pattern that keeps costing time").
 *
 * Usage: node tools/tmp/reticle_contrast.mjs <dir-with-probe-frames> [--box 80]
 * Reads the sidecar `centres.json` the pointer-lock probe writes next to the frames.
 */

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const DIR = args[0] ?? 'shots/plock/r0';
const BOX = Number(args[args.indexOf('--box') + 1]) || 80;

const DARK = 55;
const LIGHT = 205;
const MIN_FRAC = 0.05;
const MIN_SPREAD = 150;

const centres = JSON.parse(await readFile(join(DIR, 'centres.json'), 'utf8'));

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const rows = [];
for (const { file, x, y } of centres) {
  const path = join(DIR, file);
  const img = sharp(path);
  const meta = await img.metadata();
  const half = Math.floor(BOX / 2);
  const left = Math.max(0, Math.min(meta.width - BOX, Math.round(x) - half));
  const top = Math.max(0, Math.min(meta.height - BOX, Math.round(y) - half));
  const { data, info } = await img
    .extract({ left, top, width: BOX, height: BOX })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const lumas = [];
  for (let i = 0; i < data.length; i += ch) {
    lumas.push(luma(data[i], data[i + 1], data[i + 2]));
  }
  lumas.sort((a, b) => a - b);
  const n = lumas.length;
  const pct = (p) => lumas[Math.max(0, Math.min(n - 1, Math.round((p / 100) * (n - 1))))];
  const darkFrac = lumas.filter((l) => l < DARK).length / n;
  const lightFrac = lumas.filter((l) => l > LIGHT).length / n;
  const spread = pct(97) - pct(3);
  const pass = darkFrac >= MIN_FRAC && lightFrac >= MIN_FRAC && spread >= MIN_SPREAD;
  rows.push({ file, darkFrac, lightFrac, spread, pass });
}

let failed = 0;
console.log(`\nreticle contrast — ${DIR}  (box ${BOX}px)`);
console.log('  sample                dark%   light%   spread   verdict');
for (const r of rows) {
  if (!r.pass) failed++;
  console.log(
    `  ${r.file.padEnd(20)} ${(r.darkFrac * 100).toFixed(1).padStart(5)}   ` +
      `${(r.lightFrac * 100).toFixed(1).padStart(5)}   ${r.spread.toFixed(0).padStart(6)}   ` +
      `${r.pass ? 'PASS' : 'FAIL'}`,
  );
}
const mean = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
console.log(
  `  ${'MEAN'.padEnd(20)} ${(mean('darkFrac') * 100).toFixed(1).padStart(5)}   ` +
    `${(mean('lightFrac') * 100).toFixed(1).padStart(5)}   ${mean('spread').toFixed(0).padStart(6)}`,
);
console.log(`\n${rows.length - failed}/${rows.length} samples pass ` +
  `(need dark>=${MIN_FRAC * 100}% AND light>=${MIN_FRAC * 100}% AND spread>=${MIN_SPREAD})\n`);
process.exit(failed ? 1 : 0);
