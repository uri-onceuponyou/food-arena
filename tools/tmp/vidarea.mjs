import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b64 = readFileSync(process.argv[2]).toString('base64');
const br = await chromium.launch(); const pg = await br.newPage();
await pg.setContent('<img id="i">');
const r = await pg.evaluate(async (d) => {
  const i = document.getElementById('i');
  i.src = 'data:image/png;base64,' + d;
  await i.decode();
  const c = document.createElement('canvas');
  c.width = i.naturalWidth; c.height = i.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(i, 0, 0);
  const p = x.getImageData(0, 0, c.width, c.height).data;
  const lum = (o) => 0.2126*p[o] + 0.7152*p[o+1] + 0.0722*p[o+2];
  // rows: how many are essentially black across their whole width (letterbox)
  let blackRows = 0, rowInk = [];
  for (let y = 0; y < c.height; y++) {
    let lit = 0;
    for (let xx = 0; xx < c.width; xx += 2) if (lum((y*c.width+xx)*4) > 18) lit++;
    rowInk.push(lit / (c.width/2));
    if (lit / (c.width/2) < 0.02) blackRows++;
  }
  // the capture is rotated: the phone's long axis is the image HEIGHT
  return { w: c.width, h: c.height, blackRows, rowInk: rowInk.map(v => +v.toFixed(3)) };
}, b64);
await br.close();
const { w, h, blackRows, rowInk } = r;
// find the largest contiguous run of "lit" rows = the live game+chrome band
let best = 0, cur = 0;
for (const v of rowInk) { if (v > 0.02) { cur++; best = Math.max(best, cur); } else cur = 0; }
console.log(`frame ${w}x${h}`);
console.log(`fully-black rows: ${blackRows} of ${h}  (${(blackRows/h*100).toFixed(1)}% letterbox/dead)`);
console.log(`largest lit band: ${best} rows (${(best/h*100).toFixed(1)}% of the long axis)`);
