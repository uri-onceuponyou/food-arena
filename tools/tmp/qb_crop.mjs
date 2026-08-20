#!/usr/bin/env node
/**
 * qb_crop — stack the character screen's HERO PANEL from two arms into one sheet, at
 * the size Uri's panel actually shows it, so the softness can be judged by eye.
 *
 * `CLAUDE.md` non-negotiable 3: judge rendered pixels. The numbers in `qb_dpr.mjs` say
 * the buffer is 0.416x the panel's linear resolution; this is the picture of what that
 * costs. Crops are taken from the dSF-3 PAGE screenshots — the composited image, i.e.
 * exactly what the phone puts on glass — not from the drawing buffer, because the whole
 * defect is the STRETCH between the two.
 *
 * The crop box is stated in device pixels of a 1179x2556 capture and is the same for
 * every arm, so the two panels are the same region of the same layout. If a layout ever
 * moves this crop silently photographs the wrong thing (`CLAUDE.md` rule 6's
 * "a selftest never validates where the tool is POINTED"), so the box is asserted
 * against the capture's real dimensions before anything is written.
 *
 *   node tools/tmp/qb_crop.mjs --a <low.png> --b <high.png> --out sheet.png
 */
import sharp from 'sharp';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);

const a = get('--a'); const b = get('--b'); const out = get('--out', 'qb_sheet.png');
const labelA = get('--labelA', 'A'); const labelB = get('--labelB', 'B');
if (!a || !b) { console.error('need --a and --b'); process.exit(2); }

// The hero panel on the character screen, in device px of a 393x852@3 capture.
const BOX = { left: 30, top: 195, width: 1120, height: 500 };

async function crop(p) {
  const img = sharp(p);
  const meta = await img.metadata();
  // POINTED-AT ASSERTION, not a selftest: refuse if the capture is not the geometry
  // this box was measured on.
  if (meta.width !== 1179 || meta.height !== 2556) {
    throw new Error(`${p} is ${meta.width}x${meta.height}, expected 1179x2556 — the crop box would photograph the wrong region`);
  }
  if (BOX.left + BOX.width > meta.width || BOX.top + BOX.height > meta.height) {
    throw new Error(`crop box escapes ${p}`);
  }
  return img.extract(BOX).png().toBuffer();
}

const [ca, cb] = await Promise.all([crop(a), crop(b)]);
const GAP = 16;
await sharp({
  create: {
    width: BOX.width, height: BOX.height * 2 + GAP, channels: 3,
    background: { r: 20, g: 20, b: 24 },
  },
})
  .composite([
    { input: ca, top: 0, left: 0 },
    { input: cb, top: BOX.height + GAP, left: 0 },
  ])
  .png()
  .toFile(out);
console.log(`wrote ${out}  (top = ${labelA}, bottom = ${labelB}, crop ${JSON.stringify(BOX)})`);
