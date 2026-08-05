import sharp from 'sharp';
const [,, out, ...pairs] = process.argv;
// pairs: label=path ...
const tiles = [];
for (const p of pairs) {
  const [label, file] = p.split('=');
  const m = await sharp(file).metadata();
  const crop = await sharp(file).extract({
    left: Math.round(m.width * 0.30), top: Math.round(m.height * 0.20),
    width: Math.round(m.width * 0.40), height: Math.round(m.height * 0.55),
  }).resize({ width: 620 }).toBuffer();
  const cm = await sharp(crop).metadata();
  const bar = Buffer.from(
    `<svg width="${cm.width}" height="46"><rect width="100%" height="100%" fill="#12121c"/>` +
    `<text x="14" y="31" font-family="Helvetica,Arial" font-size="24" fill="#f2f2f8">${label}</text></svg>`);
  tiles.push(await sharp({ create: { width: cm.width, height: cm.height + 46, channels: 3, background: '#12121c' } })
    .composite([{ input: bar, left: 0, top: 0 }, { input: crop, left: 0, top: 46 }]).png().toBuffer());
}
const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
const W = metas.reduce((a, m) => a + m.width + 8, 8);
const H = Math.max(...metas.map((m) => m.height)) + 16;
let x = 8; const comp = [];
for (let i = 0; i < tiles.length; i++) { comp.push({ input: tiles[i], left: x, top: 8 }); x += metas[i].width + 8; }
await sharp({ create: { width: W, height: H, channels: 3, background: '#0b0b12' } }).composite(comp).png().toFile(out);
console.log('wrote', out, W + 'x' + H);
