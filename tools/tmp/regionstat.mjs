#!/usr/bin/env node
/**
 * THROWAWAY: HSV stats for a rectangular region of a PNG, plus a whole-frame
 * "how loud is this region compared to everything else" comparison. Used to settle
 * "the puddles are the most saturated objects on screen" with a number instead of an
 * impression.
 *
 * Usage: node tools/tmp/regionstat.mjs <img> [x,y,w,h] ...
 *        with no region, reports the whole frame.
 */
import sharp from 'sharp';

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const s = mx === 0 ? 0 : (mx - mn) / mx;
  return { s, v: mx / 255 };
}

async function main() {
  const path = process.argv[2];
  const regions = process.argv.slice(3);
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = (x, y) => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const report = (label, x0, y0, w, h) => {
    let n = 0, sSum = 0, vSum = 0, rSum = 0, gSum = 0, bSum = 0;
    let sMax = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const [r, g, b] = px(x, y);
        const { s, v } = hsv(r, g, b);
        sSum += s; vSum += v; rSum += r; gSum += g; bSum += b; n++;
        if (s > sMax) sMax = s;
      }
    }
    console.log(
      `${label.padEnd(22)} n=${String(n).padEnd(8)} rgb=(${(rSum / n).toFixed(0)},${(gSum / n).toFixed(0)},${(bSum / n).toFixed(0)})` +
      `  sat=${(sSum / n).toFixed(3)}  val=${(vSum / n).toFixed(3)}  satMax=${sMax.toFixed(3)}`
    );
  };
  console.log(`${path}  ${W}x${H}`);
  report('FRAME', 0, 0, W, H);
  for (const r of regions) {
    const [x, y, w, h] = r.split(',').map(Number);
    report(`[${r}]`, x, y, w, h);
  }
}
main();
