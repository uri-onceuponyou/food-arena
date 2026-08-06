// Contrast-stretched zoom around a point, so a SUBTLE ground darkening becomes
// visible to the eye. `--stretch` maps [p05,p95] of the crop's luma to [0,255]
// per channel about the crop mean, which exaggerates value structure without
// changing hue relationships.
import sharp from 'sharp';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const plate = arg('plate', 'bs_06');
const cx = +arg('cx', 0), cy = +arg('cy', 0), R = +arg('r', 110);
const gain = +arg('gain', 3);
const out = arg('out', '/tmp/zoom.png');
const f = plate.includes('/') ? plate : `reference/images/curated/gameplay_topdown/${plate}.png`;
const meta = await sharp(f).metadata();
const L = Math.max(0, Math.min(meta.width - 2 * R, Math.round(cx - R)));
const T = Math.max(0, Math.min(meta.height - 2 * R, Math.round(cy - R)));
const { data, info } = await sharp(f).extract({ left: L, top: T, width: 2 * R, height: 2 * R }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let m = [0, 0, 0];
for (let i = 0; i < data.length; i += 3) { m[0] += data[i]; m[1] += data[i + 1]; m[2] += data[i + 2]; }
const n = data.length / 3;
m = m.map((v) => v / n);
const outBuf = Buffer.alloc(data.length);
for (let i = 0; i < data.length; i += 3) {
  for (let c = 0; c < 3; c++) outBuf[i + c] = Math.max(0, Math.min(255, Math.round(m[c] + (data[i + c] - m[c]) * gain)));
}
await sharp(outBuf, { raw: { width: info.width, height: info.height, channels: 3 } })
  .resize(600, 600, { kernel: 'nearest' }).png().toFile(out);
console.log(`${out}  origin ${L},${T}  size ${2 * R}  mean ${m.map((v) => v.toFixed(1)).join(',')}  gain ${gain}`);
