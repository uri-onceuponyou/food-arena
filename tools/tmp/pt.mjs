import sharp from 'sharp';
const [,, file, ...pts] = process.argv;
const img = sharp(file);
const meta = await img.metadata();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
for (const p of pts) {
  const [fx, fy] = p.split(',').map(Number);
  const x = Math.round(meta.width * fx), y = Math.round(meta.height * fy);
  const i = (y * info.width + x) * info.channels;
  const r = data[i], g = data[i+1], b = data[i+2];
  console.log(`(${fx},${fy}) px(${x},${y}) rgb(${r},${g},${b}) L=${(0.2126*r+0.7152*g+0.0722*b).toFixed(0)}`);
}
