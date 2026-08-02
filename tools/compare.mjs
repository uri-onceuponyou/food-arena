#!/usr/bin/env node
/**
 * Blind side-by-side compositor + contact sheets.
 *
 * The brief demands the critic make a BLIND call on which image looks better. So
 * this shuffles our render and the reference into slots A and B, writes the answer
 * key to a SEPARATE file, and labels the sheet with nothing but "A" and "B".
 *
 * A critic agent is given the sheet only. The orchestrator reads the key afterwards
 * to find out whether the critic picked us or the reference.
 *
 * Usage:
 *   node tools/compare.mjs --ours a.png --ref b.png --out cmp.png --key cmp.key.json
 *   node tools/compare.mjs --tile "a.png,b.png,c.png" --out sheet.png [--cols 3] [--labels "idle,run,attack"]
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { randomInt } from 'node:crypto';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const BG = { r: 22, g: 16, b: 31, alpha: 1 };
const GAP = 24;
const LABEL_H = 64;

function labelSvg(width, height, text) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <text x="${width / 2}" y="${height * 0.72}" font-family="Helvetica,Arial,sans-serif"
             font-size="${Math.round(height * 0.62)}" font-weight="700"
             fill="#ffffff" text-anchor="middle" opacity="0.92">${text}</text>
     </svg>`
  );
}

/** Scale every input to the same height so comparison is fair. */
async function normalise(paths, targetH) {
  return Promise.all(paths.map(async (p) => {
    const buf = await sharp(p).resize({ height: targetH, fit: 'contain', background: BG }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    return { buf, w: meta.width, h: meta.height, src: p };
  }));
}

async function blindPair(args) {
  const oursPath = resolve(args.ours);
  const refPath = resolve(args.ref);

  // Coin flip decides which side we occupy.
  const oursFirst = randomInt(0, 2) === 0;
  const ordered = oursFirst ? [oursPath, refPath] : [refPath, oursPath];

  const targetH = Number(args.height ?? 1000);
  const imgs = await normalise(ordered, targetH);

  const totalW = imgs.reduce((s, i) => s + i.w, 0) + GAP * (imgs.length + 1);
  const totalH = targetH + LABEL_H + GAP * 2;

  const composites = [];
  let x = GAP;
  const slots = ['A', 'B'];
  imgs.forEach((img, i) => {
    composites.push({ input: img.buf, left: x, top: GAP + LABEL_H });
    composites.push({
      input: labelSvg(img.w, LABEL_H, slots[i]),
      left: x,
      top: GAP,
    });
    x += img.w + GAP;
  });

  const outPath = args.out ?? 'shots/compare.png';
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await sharp({ create: { width: totalW, height: totalH, channels: 4, background: BG } })
    .composite(composites)
    .png()
    .toFile(outPath);

  const key = {
    A: oursFirst ? 'ours' : 'reference',
    B: oursFirst ? 'reference' : 'ours',
    oursPath: basename(oursPath),
    refPath: basename(refPath),
    sheet: outPath,
  };
  const keyPath = args.key ?? outPath.replace(/\.png$/, '.key.json');
  await writeFile(keyPath, JSON.stringify(key, null, 2));

  console.log(`✓ blind sheet: ${outPath}`);
  console.log(`  key (do NOT show the critic): ${keyPath}`);
}

async function tile(args) {
  const paths = String(args.tile).split(',').map((s) => s.trim()).filter(Boolean);
  const labels = args.labels ? String(args.labels).split(',').map((s) => s.trim()) : null;
  const cols = Number(args.cols ?? Math.min(paths.length, 3));
  const cellH = Number(args.height ?? 620);

  const imgs = await normalise(paths, cellH);
  const cellW = Math.max(...imgs.map((i) => i.w));
  const rows = Math.ceil(imgs.length / cols);
  const labelH = labels ? 44 : 0;

  const totalW = cols * cellW + GAP * (cols + 1);
  const totalH = rows * (cellH + labelH) + GAP * (rows + 1);

  const composites = [];
  imgs.forEach((img, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const left = GAP + c * (cellW + GAP) + Math.round((cellW - img.w) / 2);
    const top = GAP + r * (cellH + labelH + GAP);
    if (labels) {
      composites.push({ input: labelSvg(cellW, labelH, labels[i] ?? ''), left: GAP + c * (cellW + GAP), top });
    }
    composites.push({ input: img.buf, left, top: top + labelH });
  });

  const outPath = args.out ?? 'shots/sheet.png';
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await sharp({ create: { width: totalW, height: totalH, channels: 4, background: BG } })
    .composite(composites)
    .png()
    .toFile(outPath);
  console.log(`✓ contact sheet: ${outPath}`);
}

const args = parseArgs(process.argv);
if (args.tile) await tile(args);
else if (args.ours && args.ref) await blindPair(args);
else {
  console.error('Need --ours + --ref, or --tile. See header for usage.');
  process.exit(2);
}
