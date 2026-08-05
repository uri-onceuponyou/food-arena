import sharp from 'sharp';
for (const p of process.argv.slice(2)) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let rClip = 0, gClip = 0, bClip = 0, anyClip = 0;
  // lower-right quadrant too
  let qn = 0, qr = 0;
  const W = info.width, H = info.height;
  for (let i = 0; i < n; i++) {
    const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
    if (r >= 253) rClip++;
    if (g >= 253) gClip++;
    if (b >= 253) bClip++;
    if (r >= 253 || g >= 253 || b >= 253) anyClip++;
    const x = i % W, y = (i / W) | 0;
    if (x > W/2 && y > H/2) { qn++; if (r >= 253) qr++; }
  }
  console.log(p.padEnd(42), 'R>=253', (100*rClip/n).toFixed(2)+'%', ' G', (100*gClip/n).toFixed(2)+'%', ' B', (100*bClip/n).toFixed(2)+'%', ' LR-quad R', (100*qr/qn).toFixed(2)+'%');
}
