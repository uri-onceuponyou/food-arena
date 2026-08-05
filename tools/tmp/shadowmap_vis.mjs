#!/usr/bin/env node
/**
 * WHERE do the arena's shadows actually land? — two blind critics, independently, named
 * "props cast no shadow" as the arena's number-one defect, and one of them looked for a
 * specific counter's shadow at a wider crop and reported it absent. `arena_shadow_ab.mjs`
 * measured 5.4-11.3% of the frame changing when arena shadow-casting is ablated, which
 * says shadows EXIST but not WHERE. This paints the difference so the two claims can be
 * reconciled by looking instead of arguing (docs/LESSONS.md §1: assume it renders and is
 * invisible; §3: take the symptom, re-derive the cause).
 *
 * Output: the shadow-only map, red where the arena darkens the frame, over a dimmed
 * plate of the shipped frame so position is readable.
 */
import sharp from 'sharp';
const [, , basePng, offPng, outPng] = process.argv;
const A = await sharp(basePng).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const B = await sharp(offPng).removeAlpha().raw().toBuffer();
const { width, height } = A.info;
const out = Buffer.alloc(width * height * 3);
let px = 0, deep = 0;
for (let i = 0; i < A.data.length; i += 3) {
  const la = (0.2126 * A.data[i] + 0.7152 * A.data[i + 1] + 0.0722 * A.data[i + 2]) / 255;
  const lb = (0.2126 * B[i] + 0.7152 * B[i + 1] + 0.0722 * B[i + 2]) / 255;
  const d = lb - la;                       // positive = the arena's own shadow darkens here
  const g = Math.round(la * 90);            // dimmed plate for orientation
  if (d > 0.02) {
    const t = Math.min(1, d / 0.30);
    out[i] = Math.round(80 + 175 * t); out[i + 1] = Math.round(g * (1 - t)); out[i + 2] = Math.round(g * (1 - t));
    px++; if (d > 0.12) deep++;
  } else { out[i] = g; out[i + 1] = g; out[i + 2] = g; }
}
await sharp(out, { raw: { width, height, channels: 3 } }).png().toFile(outPng);
const n = width * height;
console.log(`${outPng}\n  shadowed ${(100 * px / n).toFixed(2)}% of frame · deep (dL>0.12) ${(100 * deep / n).toFixed(2)}%`);
