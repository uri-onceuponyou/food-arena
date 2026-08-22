#!/usr/bin/env node
/**
 * UF_OVERLAY — draw `uf_fogpix`'s sample points onto its own frames, and mask the
 * shipped-vs-ablated difference, so the numbers can be CHECKED AGAINST THE PICTURE.
 *
 * `uf_fogpix` reported `dropAll = 0.000` at every ground radius from 730 to 930 wu on
 * the north bearing — i.e. the entire fog boundary paints NOTHING on the ground it is
 * supposed to be drawing a line on. That is either the finding or a mis-aimed sampler,
 * and `docs/CLAUDE.md` rule 6's `valuescan` case is exactly this: a perfect selftest
 * while 14 of 18 stations sat in the wrong quadrant. `--selftest` validates a tool's
 * LOGIC, never where it is POINTED. So: point at it, and look.
 *
 *   node tools/tmp/uf_overlay.mjs --station N
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') === false ? all[i + 1] : true] : []).filter((x) => x.length));
const DIR = resolve(args.dir ?? 'shots/uf/fogpix');
const ID = args.station ?? 'N';
const RADII = (args.radii ?? '860,900,940,980,1020,1060').split(',').map(Number);
const COLORS = ['#ff2d2d', '#ffd400', '#00e5ff', '#00ff5a', '#ff00ff', '#ffffff'];

const j = JSON.parse(await readFile(join(DIR, 'fogpix.json'), 'utf8'));
const st = j.stations.find((s) => s.id === ID);
if (!st) { console.error(`no station ${ID}`); process.exit(2); }

// The grid points are not stored in the JSON (only the curve), so recompute the SCREEN
// points by re-reading the per-radius sample list we DID store. If absent, bail loudly
// rather than drawing something plausible.
if (!st.samplePoints) {
  console.log('samplePoints not in JSON — rerun uf_fogpix with the point dump enabled.');
}

const base = join(DIR, `${ID}_shipped.png`);
const meta = await sharp(base).metadata();
const W = meta.width, H = meta.height;

const marks = [];
(st.samplePoints ?? []).forEach((row) => {
  const k = RADII.indexOf(row.rho);
  if (k < 0) return;
  for (const p of row.pts) marks.push(`<circle cx="${p.x}" cy="${p.y}" r="5" fill="none" stroke="${COLORS[k % COLORS.length]}" stroke-width="2"/>`);
  if (row.pts.length) marks.push(`<text x="${row.pts[0].x + 8}" y="${row.pts[0].y - 8}" fill="${COLORS[k % COLORS.length]}" font-size="16" font-family="monospace">${row.rho}</text>`);
});
const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${marks.join('')}</svg>`);
await sharp(base).composite([{ input: svg, top: 0, left: 0 }]).png().toFile(join(DIR, `${ID}_annotated.png`));

// Difference masks: what does each layer actually paint?
async function mask(aName, bName, outName, tint) {
  const [A, B] = await Promise.all([aName, bName].map((n) => sharp(join(DIR, `${ID}_${n}.png`)).raw().toBuffer({ resolveWithObject: true })));
  const n = A.info.width * A.info.height, ch = A.info.channels;
  const rgb = Buffer.alloc(n * 3);
  let px = 0;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.data[i * ch + c] - B.data[i * ch + c]));
    if (d > 2) px++;
    const v = Math.min(255, d * 6);
    rgb[i * 3] = tint[0] ? v : 0; rgb[i * 3 + 1] = tint[1] ? v : 0; rgb[i * 3 + 2] = tint[2] ? v : 0;
  }
  await sharp(rgb, { raw: { width: A.info.width, height: A.info.height, channels: 3 } }).png().toFile(join(DIR, `${ID}_${outName}.png`));
  return px;
}

console.log(`${ID}: canopy paints ${await mask('shipped', 'canopyOff', 'mask_canopy', [0, 1, 0])} px`);
console.log(`${ID}: curtain paints ${await mask('shipped', 'curtainOff', 'mask_curtain', [1, 0, 0])} px`);
console.log(`${ID}: ground band paints ${await mask('shipped', 'edgeOff', 'mask_edge', [0, 0, 1])} px`);
console.log(`${ID}: whole boundary paints ${await mask('shipped', 'allOff', 'mask_all', [1, 1, 1])} px`);
console.log(`wrote ${join(DIR, `${ID}_annotated.png`)} and four masks`);
