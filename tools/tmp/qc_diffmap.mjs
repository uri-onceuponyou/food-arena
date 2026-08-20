#!/usr/bin/env node
/**
 * qc_diffmap — WHERE did two captures differ? A localiser, not a judge.
 *
 * `qc_ctx.mjs`'s drift control failed at 20.2% of the frame, and a percentage cannot
 * tell you whether that is the 3D panel, a CSS keyframe on the background, or the
 * whole page shifting by a pixel. This writes a red-on-grey overlay and a coarse
 * row/column profile so the answer is LOOKED AT (`CLAUDE.md` rule 3) rather than
 * inferred from a number.
 *
 *   node tools/tmp/qc_diffmap.mjs A.png B.png --out map.png
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const [A, B] = a.slice(2).filter((x) => x.endsWith('.png') && !a[a.indexOf(x) - 1]?.startsWith('--out'));
const OUT = get('--out', 'tools/tmp/qc_shots/diffmap.png');

const rd = async (p) => {
  const r = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: r.data, w: r.info.width, h: r.info.height };
};

const x = await rd(A);
const y = await rd(B);
if (x.w !== y.w || x.h !== y.h) { console.error(`size mismatch ${x.w}x${x.h} vs ${y.w}x${y.h}`); process.exit(2); }

const out = Buffer.alloc(x.w * x.h * 3);
const rows = new Float64Array(x.h);
const cols = new Float64Array(x.w);
let n = 0;
for (let i = 0; i < x.w * x.h; i++) {
  const o = i * 3;
  const dmax = Math.max(
    Math.abs(x.d[o] - y.d[o]), Math.abs(x.d[o + 1] - y.d[o + 1]), Math.abs(x.d[o + 2] - y.d[o + 2]),
  );
  const grey = Math.round((x.d[o] * 0.2126 + x.d[o + 1] * 0.7152 + x.d[o + 2] * 0.0722) * 0.35);
  if (dmax > 0) {
    n++;
    rows[(i / x.w) | 0]++;
    cols[i % x.w]++;
    out[o] = Math.min(255, 90 + dmax * 3); out[o + 1] = grey * 0.3; out[o + 2] = grey * 0.3;
  } else { out[o] = grey; out[o + 1] = grey; out[o + 2] = grey; }
}
await sharp(out, { raw: { width: x.w, height: x.h, channels: 3 } }).png().toFile(OUT);

// Coarse band profile — 32 bands each way, so a text report can say WHERE without a picture.
const band = (arr, k, total) => {
  const step = Math.ceil(arr.length / k);
  const o = [];
  for (let i = 0; i < arr.length; i += step) {
    let s = 0;
    for (let j = i; j < Math.min(arr.length, i + step); j++) s += arr[j];
    o.push({ from: i, to: Math.min(arr.length, i + step) - 1, px: s, pct: +((s / total) * 100).toFixed(2) });
  }
  return o;
};
console.log(`${A}\n${B}\n${n} px of ${x.w * x.h} differ (${((n / (x.w * x.h)) * 100).toFixed(4)}%)  -> ${OUT}`);
console.log('\nROW BANDS (y range : differing px : % of all differences)');
for (const b of band(rows, 24, n)) if (b.px) console.log(`  y ${String(b.from).padStart(4)}-${String(b.to).padStart(4)}  ${String(b.px).padStart(7)}  ${b.pct}%`);
console.log('\nCOL BANDS');
for (const b of band(cols, 16, n)) if (b.px) console.log(`  x ${String(b.from).padStart(4)}-${String(b.to).padStart(4)}  ${String(b.px).padStart(7)}  ${b.pct}%`);
