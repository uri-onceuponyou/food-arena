#!/usr/bin/env node
/**
 * VGV_LOOK — the side-by-side CLAUDE.md #3 actually asks for, on a cross-tree A/B.
 *
 * 🚨 WHY A NAIVE `before.png` vs `after.png` DIFF IS THE WRONG CROP BOX HERE.
 * The two arms are two different commits, and the window changed `hud.ts`,
 * `hamburger.ts`, `soup.ts` and `rules.ts` as well as `vfx.ts`. Measured on this pair:
 * the two arms' IDLE baselines already differ by 7,492 px, spread over the whole frame.
 * So a cross-tree pixel diff bboxes to the entire canvas and shows nothing.
 *
 * `vg_frame`'s metric is a WITHIN-ARM diff against that arm's own baseline, so this
 * file crops the same way: bbox = (A_base vs A_scene) UNION (B_base vs B_scene), and
 * the two panels are the two scene frames inside that box. The effect fills the frame
 * and the static tree difference is not what sets the box.
 *
 * NON-EMPTINESS (CLAUDE.md #6): if either arm's own self-diff is empty the tool FAILS.
 * An empty self-diff means that arm rendered no effect at all, which is exactly the
 * "photographed nothing" failure `b7cf76f` found in its own judgement PNGs — and it
 * must not come back as a crop of the top-left corner.
 *
 *   node tools/tmp/vgv_look.mjs --abase <png> --a <png> --bbase <png> --b <png> --out <png>
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ABASE = arg('abase'), A = arg('a'), BBASE = arg('bbase'), B = arg('b');
const OUT = arg('out', '/tmp/vgv_look.png');
const DELTA = Number(arg('delta', 6));
const PAD = Number(arg('pad', 30));
if (!ABASE || !A || !BBASE || !B) { console.error('usage: --abase --a --bbase --b [--out]'); process.exit(2); }

const load = async (p) => { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const [ab, a, bb, b] = await Promise.all([load(ABASE), load(A), load(BBASE), load(B)]);
for (const [n, i] of [['A', a], ['Bbase', bb], ['B', b]]) {
  if (i.w !== ab.w || i.h !== ab.h) { console.error(`${n} size mismatch`); process.exit(2); }
}

const box = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
const counts = {};
for (const [tag, base, sc] of [['A', ab, a], ['B', bb, b]]) {
  let n = 0;
  for (let y = 0; y < base.h; y++) for (let x = 0; x < base.w; x++) {
    const i = (y * base.w + x) * 4;
    if (Math.abs(base.data[i] - sc.data[i]) > DELTA || Math.abs(base.data[i + 1] - sc.data[i + 1]) > DELTA
      || Math.abs(base.data[i + 2] - sc.data[i + 2]) > DELTA) {
      n++;
      if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y;
    }
  }
  counts[tag] = n;
  // Assert NON-EMPTY per arm, before any box is used. `[].every()` is `true`; an empty
  // self-diff here would silently hand back a legitimate-looking crop of nothing.
  if (n === 0) { console.error(`vgv_look: arm ${tag} self-diff is ZERO px — that arm photographed NOTHING. Refusing.`); process.exit(1); }
}
const x0 = Math.max(0, box.x0 - PAD), y0 = Math.max(0, box.y0 - PAD);
const x1 = Math.min(ab.w - 1, box.x1 + PAD), y1 = Math.min(ab.h - 1, box.y1 + PAD);
const w = x1 - x0 + 1, h = y1 - y0 + 1, GAP = 10, OW = w * 2 + GAP;
const buf = Buffer.alloc(OW * h * 4, 255);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const src = ((y + y0) * ab.w + (x + x0)) * 4;
  for (const [img, dx] of [[a, 0], [b, w + GAP]]) {
    const d = (y * OW + x + dx) * 4;
    buf[d] = img.data[src]; buf[d + 1] = img.data[src + 1]; buf[d + 2] = img.data[src + 2]; buf[d + 3] = 255;
  }
}
for (let y = 0; y < h; y++) for (let x = w; x < w + GAP; x++) {
  const d = (y * OW + x) * 4; buf[d] = 255; buf[d + 1] = 0; buf[d + 2] = 255; buf[d + 3] = 255;
}
await writeFile(OUT, await sharp(buf, { raw: { width: OW, height: h, channels: 4 } }).png().toBuffer());
console.log(`vgv_look: self-diff A ${counts.A} px · B ${counts.B} px · box ${x0},${y0}..${x1},${y1} (${w}x${h}) · LEFT=before RIGHT=after -> ${OUT}`);
