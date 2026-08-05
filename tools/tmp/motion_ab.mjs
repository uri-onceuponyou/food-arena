/**
 * Blind A/B packet for motion review: two rigs, same character, same states,
 * same framing — interleaved per state so the comparison is direct.
 * The answer key goes to a separate file the critic never sees.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';

const STATES = ['idle', 'run', 'attack', 'hit', 'death'];
const dirA = process.argv[2], dirB = process.argv[3], out = process.argv[4], char = process.argv[5] ?? 'hamburger';
const BG = { r: 18, g: 14, b: 26, alpha: 1 };
const swap = randomInt(0, 2) === 0;           // which real side is slot A
const sides = swap ? [dirA, dirB] : [dirB, dirA];
const key = { A: swap ? dirA : dirB, B: swap ? dirB : dirA };

const txt = (w, h, s, size, op = 0.95) => Buffer.from(
  `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="12" y="${h * 0.74}"
   font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700" fill="#fff"
   opacity="${op}">${s}</text></svg>`);

// One sheet PER STATE. A single 5-state stack came out 2716x5130, which any
// reader downsamples into illegibility — and an unreadable packet measures the
// packet, not the work.
const HEAD = 46, SLOT = 36, GAP = 14;
await mkdir(out.replace(/\/[^/]+$/, ''), { recursive: true });
for (const st of STATES) {
  const rows = [];
  let W = 0;
  for (let i = 0; i < 2; i++) {
    const buf = await sharp(`${sides[i]}/${char}_${st}.png`).toBuffer();
    const m = await sharp(buf).metadata();
    rows.push({ buf, h: m.height, slot: 'AB'[i] });
    W = Math.max(W, m.width);
  }
  const comps = [];
  let y = 0;
  comps.push({ input: txt(W, HEAD, `${st.toUpperCase()} — same character, same camera, same frame times`, 28), left: 0, top: y });
  y += HEAD;
  for (const r of rows) {
    comps.push({ input: txt(W, SLOT, r.slot, 28), left: 0, top: y }); y += SLOT;
    comps.push({ input: r.buf, left: 0, top: y }); y += r.h + GAP;
  }
  const f = out.replace(/\.png$/, `_${st}.png`);
  await sharp({ create: { width: W, height: y, channels: 4, background: BG } })
    .composite(comps).png().toFile(f);
  console.log(`✓ ${f} (${W}x${y})`);
}
await writeFile(out.replace(/\.png$/, '.key.json'), JSON.stringify(key, null, 2));
console.log(`  key -> ${out.replace(/\.png$/, '.key.json')}`);
