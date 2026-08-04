/**
 * Absolute-chroma companion to arena-scan's hueHist.
 *
 * `hueHist` is NORMALISED (bin / total chroma), so quieting a COOL surface RAISES the
 * warm bin's share even though the frame genuinely got quieter. That is a real
 * measurement artifact and it bit round 1 of the saturation contract. This reads the
 * same canvas PNGs and reports the ABSOLUTE quantities: mean saturation over the
 * frame, and saturation-weighted chroma per pixel in each hue band.
 */
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dirs = process.argv.slice(2);
for (const dir of dirs) {
  const files = readdirSync(dir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f) && !/\.(marked|key)\./.test(f) && (process.env.ANYIMG ? !f.endsWith('.canvas.png') && !f.startsWith('sheet_') : f.endsWith('.canvas.png'))).sort();
  let agg = { n: 0, sat: 0, warm: 0, bin0: 0, bin1: 0, cool: 0, chroma: 0, luma: 0, hot: 0 };
  const rows = [];
  for (const f of files) {
    const { data, info } = await sharp(join(dir, f)).resize(320, 180, { fit: 'fill' })
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    let sat = 0, warm = 0, b0 = 0, b1 = 0, cool = 0, chroma = 0, luma = 0, hot = 0;
    for (let i = 0; i < n; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      const l = (mx + mn) / 2 / 255;
      const s = d === 0 ? 0 : (l > 0.5 ? d / (510 - mx - mn) : d / (mx + mn));
      sat += s; chroma += d / 255; luma += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (mx >= 250) hot++;
      if (s < 0.15) continue;
      let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = ((h * 60) % 360 + 360) % 360;
      if (h < 30) { warm += s; b0 += s; } else if (h < 60) { warm += s; b1 += s; } else cool += s;
    }
    rows.push({ f: f.replace('.canvas.png', ''), sat: sat / n, warm: warm / n, b0: b0 / n, b1: b1 / n, cool: cool / n, chroma: chroma / n, luma: luma / n, hot: hot / n });
    agg.n++; agg.sat += sat / n; agg.warm += warm / n; agg.bin0 += b0 / n; agg.bin1 += b1 / n;
    agg.cool += cool / n; agg.chroma += chroma / n; agg.luma += luma / n; agg.hot += hot / n;
  }
  console.log(`\n=== ${dir} (${agg.n} frames) ===`);
  console.log('station          meanSat  chroma  warmChroma(0-30/30-60)  coolChroma  meanLuma  px>=250');
  for (const r of rows) console.log(`${r.f.padEnd(16)} ${r.sat.toFixed(3)}   ${r.chroma.toFixed(3)}   ${r.b0.toFixed(3)} / ${r.b1.toFixed(3)}          ${r.cool.toFixed(3)}       ${r.luma.toFixed(3)}   ${(r.hot * 100).toFixed(2)}%`);
  const d = agg.n;
  console.log(`MEAN             ${(agg.sat / d).toFixed(3)}   ${(agg.chroma / d).toFixed(3)}   ${(agg.bin0 / d).toFixed(3)} / ${(agg.bin1 / d).toFixed(3)}          ${(agg.cool / d).toFixed(3)}       ${(agg.luma / d).toFixed(3)}   ${(agg.hot / d * 100).toFixed(2)}%`);
  console.log(`  absolute warm chroma (0-60 deg) = ${((agg.bin0 + agg.bin1) / d).toFixed(4)}   cool = ${(agg.cool / d).toFixed(4)}   warm/total = ${(((agg.bin0 + agg.bin1)) / (agg.bin0 + agg.bin1 + agg.cool)).toFixed(3)}`);
}
