#!/usr/bin/env node
/**
 * Scratch measurement tool for the lighting pass: mean saturation (HSV) and the
 * standard deviation of value (HSV) across an image. Used to sanity-check that
 * grade/light changes move toward the reference cluster instead of just "looking"
 * different. Not part of the app; safe to ignore/delete.
 *
 * Usage: node tools/_measure_light.mjs <img1> <img2> ...
 */
import sharp from 'sharp';

async function stats(path) {
  const img = sharp(path).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sSum = 0, vSum = 0, vals = [];
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max;
    const s = max === 0 ? 0 : (max - min) / max;
    sSum += s; vSum += v;
    vals.push(v);
  }
  const sMean = sSum / n;
  const vMean = vSum / n;
  let varSum = 0;
  for (const v of vals) varSum += (v - vMean) ** 2;
  const vStd = Math.sqrt(varSum / n);
  return { path, sMean, vMean, vStd };
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: node tools/_measure_light.mjs <img1> <img2> ...');
  process.exit(2);
}
for (const p of paths) {
  const r = await stats(p);
  console.log(`${r.path}  sat=${r.sMean.toFixed(3)}  val=${r.vMean.toFixed(3)}  valStd=${r.vStd.toFixed(3)}`);
}
