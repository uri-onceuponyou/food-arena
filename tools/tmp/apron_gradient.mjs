/**
 * FLAT-PLANE TRAP probe.
 *
 * `PROGRESS.md` trap: "Large flat single-quad mats have ONE normal — no lighting can
 * give them internal gradient." The old apron quad measured p90-p10 = 0.003 (normalised
 * luma) and read dead. This asks whether the CURRENT apron beats that.
 *
 * Two numbers, both taken only over the apron's own pixels (found by diffing against an
 * `?apron=0` render of the identical frame, same as cliff.mjs):
 *
 *   LOW BAND   p90-p10 across 24px block means, using only blocks that are almost
 *              entirely apron. This is the band that survives at shipped framing, and
 *              it is the one a flat quad physically cannot have.
 *   FULL       p90-p10 across every apron pixel, which includes standing geometry —
 *              reported for context, not as the test.
 *
 * Usage: node tools/tmp/apron_gradient.mjs <withDir> <apronOffDir>
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function load(f) {
  const im = sharp(f);
  const { width, height } = await im.metadata();
  const raw = await im.ensureAlpha().raw().toBuffer();
  return { width, height, raw };
}

const pct = (arr, q) => {
  if (!arr.length) return NaN;
  const a = Float64Array.from(arr).sort();
  return a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))];
};

const [, , withDir, noneDir] = process.argv;
const files = (await readdir(withDir)).filter((f) => f.endsWith('.png')).sort();
const BLK = 24;

console.log(
  `${'frame'.padEnd(20)} ${'apron px'.padStart(9)} ${'LOW p90-p10'.padStart(12)} ${'FULL p90-p10'.padStart(13)}`
);

for (const f of files) {
  const A = await load(join(withDir, f));
  const B = await load(join(noneDir, f));
  const { width, height } = A;
  const isApron = new Uint8Array(width * height);
  const luma = new Float64Array(width * height);
  const all = [];

  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const y = (i / width) | 0;
    const L = (0.2126 * A.raw[p] + 0.7152 * A.raw[p + 1] + 0.0722 * A.raw[p + 2]) / 255;
    luma[i] = L;
    if (y < height * 0.06 || y > height * 0.88) continue; // skip HUD bands
    const d =
      Math.abs(A.raw[p] - B.raw[p]) +
      Math.abs(A.raw[p + 1] - B.raw[p + 1]) +
      Math.abs(A.raw[p + 2] - B.raw[p + 2]);
    if (d > 18) {
      isApron[i] = 1;
      all.push(L);
    }
  }

  // Low band: block means over blocks that are >=90% apron.
  const blockMeans = [];
  for (let by = 0; by + BLK <= height; by += BLK) {
    for (let bx = 0; bx + BLK <= width; bx += BLK) {
      let n = 0;
      let s = 0;
      for (let y = by; y < by + BLK; y++) {
        for (let x = bx; x < bx + BLK; x++) {
          const i = y * width + x;
          if (isApron[i]) {
            n++;
            s += luma[i];
          }
        }
      }
      if (n >= BLK * BLK * 0.9) blockMeans.push(s / n);
    }
  }

  const low = pct(blockMeans, 0.9) - pct(blockMeans, 0.1);
  const full = pct(all, 0.9) - pct(all, 0.1);
  console.log(
    `${f.padEnd(20)} ${String(all.length).padStart(9)} ${low.toFixed(4).padStart(12)} ${full
      .toFixed(4)
      .padStart(13)}   (${blockMeans.length} blocks)`
  );
}
