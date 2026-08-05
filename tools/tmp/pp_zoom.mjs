// pp_zoom.mjs — read-only crop+upscale of an existing per-part panel, for eyeball inspection.
// Writes ONLY into shots/perpart/**. Changes no game code.
// Usage: node tools/tmp/pp_zoom.mjs <in.png> <out.png> <left> <top> <w> <h> <scale>
import sharp from 'sharp';
const [, , inp, outp, l, t, w, h, s] = process.argv;
const src = sharp(inp);
const meta = await src.metadata();
const left = Math.max(0, Math.round(Number(l)));
const top = Math.max(0, Math.round(Number(t)));
const width = Math.min(Number(w), meta.width - left);
const height = Math.min(Number(h), meta.height - top);
await sharp(inp)
  .extract({ left, top, width, height })
  .resize({ width: Math.round(width * Number(s)), kernel: 'nearest' })
  .png()
  .toFile(outp);
console.log(`${inp} ${meta.width}x${meta.height} -> ${outp} crop[${left},${top} ${width}x${height}] x${s}`);
