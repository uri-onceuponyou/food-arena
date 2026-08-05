import sharp from 'sharp';
const [,, file, xFrac, y0Frac, y1Frac] = process.argv;
const img = sharp(file);
const meta = await img.metadata();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const x = Math.round(meta.width * Number(xFrac));
const y0 = Math.round(meta.height * Number(y0Frac));
const y1 = Math.round(meta.height * Number(y1Frac));
console.log(`${file} ${meta.width}x${meta.height} col x=${x} rows ${y0}..${y1}`);
for (let y = y0; y <= y1; y += Math.max(1, Math.round((y1-y0)/40))) {
  const i = (y * info.width + x) * info.channels;
  const r = data[i], g = data[i+1], b = data[i+2];
  const lum = (0.2126*r + 0.7152*g + 0.0722*b).toFixed(0);
  console.log(`y=${y}  rgb(${r},${g},${b})  L=${lum}`);
}
