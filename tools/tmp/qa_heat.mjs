#!/usr/bin/env node
/**
 * QA_HEAT — WHERE did two frames differ, not just how much.
 *
 * A single "43.7% of pixels changed" cannot distinguish "one character was replaced"
 * from "the whole frame got softer", and those are different diagnoses with different
 * fixes. This paints the per-pixel delta so the answer is visible, and prints a coarse
 * grid of mean delta so it is also a number.
 *
 * 🚨 A heat map is only readable if the two inputs are a MATCHED PAIR from a run whose
 * DRIFT CONTROL passed. Feeding it two frames that differ by animation phase paints a
 * beautiful, entirely meaningless picture. `qa_ab.mjs` exits 1 when the self-pair is not
 * bit-identical precisely so that cannot happen silently.
 *
 *   node tools/tmp/qa_heat.mjs <a.png> <b.png> <out.png> [--grid 8]
 *   node tools/tmp/qa_heat.mjs --selftest
 */
import sharp from 'sharp';

const argv = process.argv.slice(2);

if (argv.includes('--selftest')) {
  let fails = 0;
  const ok = (c, m) => { console.log(`${c ? '  ok  ' : '  FAIL'} ${m}`); if (!c) fails++; };
  const mk = (r, g, b, w = 8, h = 8) => sharp({
    create: { width: w, height: h, channels: 3, background: { r, g, b } },
  }).png().toBuffer();
  const a = await mk(10, 10, 10);
  const b = await mk(10, 10, 10);
  const c = await mk(20, 10, 10);
  const same = await analyse(a, b, 2);
  const diff = await analyse(a, c, 2);
  ok(same.changed === 0, `A1 identical inputs -> 0 changed (got ${same.changed})`);
  ok(diff.changed === 64, `A2 KNOWN-BAD: a uniform 10-level shift changes ALL 64 px (got ${diff.changed})`);
  ok(Math.abs(diff.meanAll - 10 / 3) < 0.01, `A3 mean delta reads the real magnitude (${diff.meanAll})`);
  ok(diff.cells.length === 4 && diff.cells.every((x) => x > 0),
    'A4 the grid is non-empty AND every cell registers the change');
  // §B — a change confined to ONE quadrant must show in ONE cell, not smeared.
  const base = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png().toBuffer();
  const patched = await sharp(base)
    .composite([{ input: await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer(), left: 0, top: 0 }])
    .png().toBuffer();
  const q = await analyse(base, patched, 2);
  ok(q.cells[0] > 0 && q.cells[1] === 0 && q.cells[2] === 0 && q.cells[3] === 0,
    `B1 a one-quadrant change lands in exactly one cell (${q.cells.join(',')})`);
  console.log(fails ? `\nSELFTEST: ${fails} FAILED` : '\nSELFTEST: all passed');
  process.exit(fails ? 1 : 0);
}

async function analyse(aBuf, bBuf, grid) {
  const [ra, rb] = await Promise.all([
    sharp(aBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(bBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const { width: w, height: h } = ra.info;
  const A = ra.data, B = rb.data;
  const heat = Buffer.alloc(w * h * 3);
  const cells = new Array(grid * grid).fill(0);
  const counts = new Array(grid * grid).fill(0);
  let changed = 0, sum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const d = (Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2])) / 3;
      if (d > 0) changed++;
      sum += d;
      const gi = Math.min(grid - 1, Math.floor((y / h) * grid)) * grid
        + Math.min(grid - 1, Math.floor((x / w) * grid));
      cells[gi] += d; counts[gi]++;
      // magma-ish ramp so a 2-level dither and a 200-level swap are not the same colour
      const t = Math.min(1, d / 64);
      heat[o] = Math.round(255 * Math.min(1, t * 2));
      heat[o + 1] = Math.round(255 * Math.max(0, Math.min(1, t * 2 - 0.6)));
      heat[o + 2] = Math.round(60 * (1 - t) + 255 * Math.max(0, t * 2 - 1.4));
    }
  }
  return {
    w, h, changed, meanAll: +(sum / (w * h)).toFixed(4),
    cells: cells.map((v, i) => +(v / Math.max(1, counts[i])).toFixed(2)),
    grid, heat,
  };
}

const [aPath, bPath, outPath] = argv.filter((x) => !x.startsWith('--'));
const gi = argv.indexOf('--grid');
const GRID = gi >= 0 ? Number(argv[gi + 1]) : 8;
if (!aPath || !bPath || !outPath) { console.error('usage: qa_heat.mjs a.png b.png out.png [--grid 8]'); process.exit(2); }

const r = await analyse(aPath, bPath, GRID);
await sharp(r.heat, { raw: { width: r.w, height: r.h, channels: 3 } }).png().toFile(outPath);
console.log(`${aPath}\n${bPath}\n -> ${outPath}  ${r.w}x${r.h}  changed ${r.changed} (${((r.changed / (r.w * r.h)) * 100).toFixed(2)}%)  meanDelta(all px) ${r.meanAll}`);
console.log(`\nmean |delta| per ${GRID}x${GRID} cell (rows top->bottom):`);
for (let y = 0; y < GRID; y++) {
  console.log('  ' + r.cells.slice(y * GRID, y * GRID + GRID).map((v) => String(v).padStart(7)).join(''));
}
