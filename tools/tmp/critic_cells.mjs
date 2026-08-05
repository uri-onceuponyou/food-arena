#!/usr/bin/env node
/**
 * Build CONTROLLED A/B sheets for auditing the critic instrument itself.
 *
 * `tools/review.mjs` + `tools/compare.mjs` always coin-flip which slot we occupy, which
 * is right for a real round and useless for an audit: you cannot measure a position
 * bias with a randomiser in the way, and you cannot repeat a packet if the packet
 * changes every time you build it. This composites with the SAME geometry as
 * `compare.mjs` (BG, GAP, LABEL_H, scale-to-height-1000, lanczos) but takes the slot
 * assignment as an argument.
 *
 * The cells, and what each one can prove:
 *
 *   pairAB / pairBA  the same real packet with our panel forced into A, then into B.
 *                    Difference of means is the ORDER effect; pooled spread is the
 *                    critic's standard deviation on a fixed stimulus.
 *   self             our frame against ITSELF. Any non-zero |A-B| here is pure
 *                    instrument noise plus position bias, measured with the content
 *                    difference removed by construction.
 *   parity           two reference plates against each other. Known near-parity, and
 *                    it calibrates the ceiling — if two shipped Brawl Stars frames
 *                    score 8 and 4, the 7-9 validity band is not a property of the
 *                    reference, it is a property of the critic.
 *   degraded         a reference plate against a deliberately wrecked copy of itself
 *                    (blur + desaturate + JPEG q12). If the critic cannot rank this
 *                    the right way round, nothing it has ever said means anything.
 *
 * Usage:
 *   node tools/tmp/critic_cells.mjs --cell pairAB --a ours.png --b ref.png --out DIR
 *   node tools/tmp/critic_cells.mjs --degrade in.png --out out.png
 *   node tools/tmp/critic_cells.mjs --selftest
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';

// Verbatim from tools/compare.mjs — the sheet a critic sees must be geometrically
// identical to a real round's, or the audit measures the compositor instead.
const BG = { r: 22, g: 16, b: 31, alpha: 1 };
const GAP = 24;
const LABEL_H = 64;
const SHEET_H = 1000;

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

function labelSvg(width, height, text) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <text x="${width / 2}" y="${height * 0.72}" font-family="Helvetica,Arial,sans-serif"
             font-size="${Math.round(height * 0.62)}" font-weight="700"
             fill="#ffffff" text-anchor="middle" opacity="0.92">${text}</text>
     </svg>`
  );
}

/** Composite [slotA, slotB] with no coin flip. Returns the sheet path. */
async function sheet(slotA, slotB, outPath, targetH = SHEET_H) {
  const imgs = await Promise.all([slotA, slotB].map(async (p) => {
    const buf = await sharp(p).resize({ height: targetH, fit: 'contain', background: BG }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    return { buf, w: meta.width, h: meta.height, src: p };
  }));
  const totalW = imgs.reduce((s, i) => s + i.w, 0) + GAP * (imgs.length + 1);
  const totalH = targetH + LABEL_H + GAP * 2;
  const composites = [];
  let x = GAP;
  ['A', 'B'].forEach((slot, i) => {
    composites.push({ input: imgs[i].buf, left: x, top: GAP + LABEL_H });
    composites.push({ input: labelSvg(imgs[i].w, LABEL_H, slot), left: x, top: GAP });
    x += imgs[i].w + GAP;
  });
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await sharp({ create: { width: totalW, height: totalH, channels: 4, background: BG } })
    .composite(composites).png().toFile(outPath);
  return { outPath, totalW, totalH, widths: imgs.map((i) => i.w) };
}

/**
 * A known-bad image, by construction. Blur destroys acuity, desaturation destroys the
 * hyper-saturated look the whole art direction rests on, and a q12 JPEG round trip
 * adds visible blocking. Three independent axes so no single critic taste can rescue it.
 */
async function degrade(inPath, outPath) {
  const jpg = await sharp(inPath).blur(3.2).modulate({ saturation: 0.45 }).jpeg({ quality: 12 }).toBuffer();
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await sharp(jpg).png().toFile(outPath);
  return outPath;
}

async function selftest() {
  let pass = 0, fail = 0;
  const t = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n} ${d}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };
  const tmp = '/tmp/critic_cells_selftest';
  await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 220, g: 60, b: 30 } } }).png().toFile(`${tmp}_red.png`);
  await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 30, g: 60, b: 220 } } }).png().toFile(`${tmp}_blue.png`);

  const s1 = await sheet(`${tmp}_red.png`, `${tmp}_blue.png`, `${tmp}_s1.png`);
  const s2 = await sheet(`${tmp}_blue.png`, `${tmp}_red.png`, `${tmp}_s2.png`);
  t('sheet height = 1000 + label + 2 gaps', s1.totalH === SHEET_H + LABEL_H + GAP * 2, `${s1.totalH}`);
  t('order is DETERMINISTIC (two builds of the same order agree)',
    (await sheet(`${tmp}_red.png`, `${tmp}_blue.png`, `${tmp}_s1b.png`)).totalW === s1.totalW);

  // The slot really did swap: sample a pixel inside panel A of each sheet.
  const pxA1 = await sharp(`${tmp}_s1.png`).extract({ left: GAP + 50, top: GAP + LABEL_H + 50, width: 4, height: 4 }).raw().toBuffer();
  const pxA2 = await sharp(`${tmp}_s2.png`).extract({ left: GAP + 50, top: GAP + LABEL_H + 50, width: 4, height: 4 }).raw().toBuffer();
  t('panel A of pairAB is the FIRST argument', pxA1[0] > pxA1[2], `r${pxA1[0]} b${pxA1[2]}`);
  t('panel A of pairBA is the SECOND argument', pxA2[2] > pxA2[0], `r${pxA2[0]} b${pxA2[2]}`);

  // Two IDENTICAL inputs must produce two byte-identical panels — the `self` cell
  // depends on there being no per-panel processing difference at all.
  const sSelf = await sheet(`${tmp}_red.png`, `${tmp}_red.png`, `${tmp}_self.png`);
  const half = Math.floor(sSelf.widths[0]);
  const left = await sharp(`${tmp}_self.png`).extract({ left: GAP, top: GAP + LABEL_H, width: half, height: SHEET_H }).raw().toBuffer();
  const right = await sharp(`${tmp}_self.png`).extract({ left: GAP * 2 + half, top: GAP + LABEL_H, width: half, height: SHEET_H }).raw().toBuffer();
  t('self cell: the two panels are byte-identical', Buffer.compare(left, right) === 0);

  await degrade(`${tmp}_red.png`, `${tmp}_deg.png`);
  const meta = await sharp(`${tmp}_deg.png`).stats();
  t('degrade desaturates (red channel pulled toward grey)', meta.channels[0].mean < 220, `${meta.channels[0].mean.toFixed(1)}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

const args = parseArgs(process.argv);
if (args.selftest) await selftest();
else if (args.degrade) {
  console.log(await degrade(resolve(args.degrade), resolve(args.out)));
} else if (args.cell) {
  const a = resolve(args.a), b = resolve(args.b);
  const out = resolve(args.out);
  const [slotA, slotB] = args.cell === 'pairBA' ? [b, a] : [a, b];
  const r = await sheet(slotA, slotB, out, Number(args.height ?? SHEET_H));
  await writeFile(out.replace(/\.png$/, '.key.json'), JSON.stringify({
    cell: args.cell,
    A: basename(slotA), B: basename(slotB),
    aArg: basename(a), bArg: basename(b),
    panelWidths: r.widths,
  }, null, 2));
  console.log(`✓ ${args.cell}  A=${basename(slotA)}  B=${basename(slotB)}  ${out}`);
} else {
  console.error('Need --cell pairAB|pairBA --a X --b Y --out Z | --degrade in --out out | --selftest');
  process.exit(2);
}
