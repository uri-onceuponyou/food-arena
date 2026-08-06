#!/usr/bin/env node
/**
 * cam_crown — HOW BLANK IS THE TOP OF THE HEAD?
 *
 * ─── 🚨 SCRUB RULE, inherited from `tools/tmp/pp_ref_parts.mjs`. STANDING. ───────
 * This repo is PUBLIC. `reference/images/` must never be committed or PUBLISHED, and
 * a prose description derived from viewing a plate is derived from it.
 *   DESCRIBE THE COMPOSITIONAL ROLE, NEVER THE THIRD-PARTY ARTWORK.
 * Crop COORDINATES and measured NUMBERS stay. They disclose nothing.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────────
 * `cam_ellipse.mjs` measured the cameras and killed the stated hypothesis: the
 * reference gameplay camera is ~51 deg, not 22, against our 58. `cam_face.mjs` then
 * killed the obvious follow-up: delivered face AREA survives the steep camera fine
 * (median 0.793 of its lobby share, against 0.564 for a flat vertical face). What
 * actually changes between our two cameras is WHERE the face sits inside the head —
 * egg's eye line moves from 52% of head height at 20 deg to 80% at 58 deg — which
 * means at match pitch the top ~80% of every head is CROWN.
 *
 * So the question that survives both falsifications is: **what is on that crown?**
 *
 * ─── THE STATISTIC, and why the box is a rectangle inside the head ──────────────
 * Two numbers over a caller-supplied rectangle that lies ENTIRELY INSIDE the crown:
 *
 *   modalShare  — fraction of pixels within `--dist` (sum |dRGB|) of the modal colour
 *                 after quantising to `--q` levels per channel. 1.0 = one flat field.
 *   clusters    — how many quantised bins each hold >= 5% of the box. 1 = one field.
 *
 * The rectangle is supplied rather than segmented BECAUSE the two sides cannot be
 * segmented the same way — our crowns sit on a flat studio backdrop and theirs sit on
 * a lit game scene — and a statistic computed with two different segmentations is a
 * measurement of the segmentations. An inscribed rectangle is the one treatment both
 * sides can receive identically. It is a stated input, and `--out` writes it back over
 * the crop so the choice is auditable as pixels.
 *
 * ⚠️ THE RESOLUTION BIAS RUNS THE OPPOSITE WAY FROM WHAT I ASSERTED, AND THE
 * SELFTEST IS WHAT CAUGHT IT. The paragraph here used to read:
 *
 *   "Blur RAISES modalShare and LOWERS cluster count — it makes a plate look BLANKER
 *    than it is. So if a plate's crown still reads busier than ours, the true gap is
 *    larger than measured, not smaller."
 *
 * **Both halves are false.** Blurring a four-field patch took modalShare 0.25 -> 0.156
 * and cluster count 4 -> 8, because blur MANUFACTURES intermediate colours. Since the
 * plates arrive at 0.42-0.48x our edge acuity (`docs/LESSONS.md` §3), the raw
 * statistic would flatter the PLATES — exactly the direction that would have let a
 * wrong conclusion through. Kept in full, per `CLAUDE.md`, because an instrument whose
 * bias I guessed backwards is the whole reason the known-bad rule exists.
 *
 * The fix is not a caveat, it is `--resample N`: box-filter BOTH sides' crop to N x N
 * before measuring, so our render suffers the same averaging the plates already have.
 * The selftest asserts the residual bias after resampling rather than assuming it, and
 * that residual is the number to quote as the floor.
 *
 *   node tools/tmp/cam_crown.mjs --selftest
 *   node tools/tmp/cam_crown.mjs --img <png> --box x0,y0,x1,y1 --label name [--out p.png]
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const nums = (s) => s.split(',').map(Number);

const Q = Number(arg('--q', '6'));      // quantisation levels per channel
const DIST = Number(arg('--dist', '60'));

/** Box-filter a flat pixel list of size w x h down to n x n. */
export function resample(px, w, h, n) {
  const out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = Math.floor((i * w) / n), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * w) / n));
    const y0 = Math.floor((j * h) / n), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * h) / n));
    let r = 0, g = 0, b = 0, c = 0;
    for (let y = y0; y < y1 && y < h; y++) for (let x = x0; x < x1 && x < w; x++) {
      const p = px[y * w + x]; r += p[0]; g += p[1]; b += p[2]; c++;
    }
    out.push([r / c, g / c, b / c]);
  }
  return out;
}

export function crownStats(px, q = Q, dist = DIST) {
  // px: array of [r,g,b]
  const step = 256 / q;
  const bins = new Map();
  for (const [r, g, b] of px) {
    const k = `${Math.min(q - 1, (r / step) | 0)},${Math.min(q - 1, (g / step) | 0)},${Math.min(q - 1, (b / step) | 0)}`;
    bins.set(k, (bins.get(k) ?? 0) + 1);
  }
  let modalKey = null, modalN = 0;
  for (const [k, n] of bins) if (n > modalN) { modalN = n; modalKey = k; }
  // Modal COLOUR = mean of the pixels in the modal bin (not the bin centre — the bin
  // centre can sit off the actual colour by half a step, which at q=6 is 21 units and
  // would eat a third of the tolerance).
  let mr = 0, mg = 0, mb = 0, mc = 0;
  const [bk0, bk1, bk2] = modalKey.split(',').map(Number);
  for (const [r, g, b] of px) {
    if (Math.min(q - 1, (r / step) | 0) === bk0 && Math.min(q - 1, (g / step) | 0) === bk1 && Math.min(q - 1, (b / step) | 0) === bk2) {
      mr += r; mg += g; mb += b; mc++;
    }
  }
  mr /= mc; mg /= mc; mb /= mc;
  let near = 0;
  for (const [r, g, b] of px) {
    if (Math.abs(r - mr) + Math.abs(g - mg) + Math.abs(b - mb) <= dist) near++;
  }
  let clusters = 0;
  for (const [, n] of bins) if (n >= px.length * 0.05) clusters++;
  // SPREAD — mean L1 distance from the box's MEAN colour, on 0..255 per channel.
  //
  // ⚠️ This is the statistic to quote, and `modalShare`/`clusters` are kept only as
  // diagnostics, because **spread is the only one of the three whose blur bias runs
  // the safe way.** Blur cannot invent variance: averaging strictly reduces the mean
  // deviation from the mean. So a lower-acuity plate reads BLANKER on spread, and a
  // finding that a plate's crown is busier than ours is therefore a LOWER BOUND on the
  // gap. modalShare and clusters both move the other way (blur manufactures
  // intermediate colours), which the selftest asserts rather than assumes.
  let ar = 0, ag = 0, ab = 0;
  for (const [r, g, b] of px) { ar += r; ag += g; ab += b; }
  ar /= px.length; ag /= px.length; ab /= px.length;
  let spread = 0;
  for (const [r, g, b] of px) spread += Math.abs(r - ar) + Math.abs(g - ag) + Math.abs(b - ab);
  spread /= px.length;
  return {
    n: px.length,
    spread: +spread.toFixed(2),
    modalShare: +(near / px.length).toFixed(4),
    clusters,
    meanRGB: [Math.round(ar), Math.round(ag), Math.round(ab)],
    modalRGB: [Math.round(mr), Math.round(mg), Math.round(mb)],
  };
}

if (has('--selftest')) {
  let pass = 0, fail = 0;
  const chk = (n, ok, d) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
  const flat = Array.from({ length: 4000 }, () => [200, 120, 40]);
  const two = Array.from({ length: 4000 }, (_, i) => (i % 2 ? [200, 120, 40] : [40, 90, 200]));
  const four = Array.from({ length: 4000 }, (_, i) => [[200, 120, 40], [40, 90, 200], [30, 200, 60], [230, 230, 230]][i % 4]);
  const noisyFlat = Array.from({ length: 4000 }, () => [200 + ((Math.random() * 16) | 0) - 8, 120, 40]);

  const f = crownStats(flat), t = crownStats(two), q = crownStats(four), nf = crownStats(noisyFlat);
  chk(`one flat field -> modalShare ${f.modalShare}, clusters ${f.clusters}`, f.modalShare === 1 && f.clusters === 1);
  chk(`two fields -> modalShare ${t.modalShare}, clusters ${t.clusters}`, Math.abs(t.modalShare - 0.5) < 0.02 && t.clusters === 2);
  chk(`four fields -> modalShare ${q.modalShare}, clusters ${q.clusters}`, Math.abs(q.modalShare - 0.25) < 0.02 && q.clusters === 4);
  // HOLDS: shading noise inside one field must NOT read as structure. A crown with a
  // soft specular gradient is still blank, and a statistic that called it busy would
  // score every smooth-shaded ball as detailed.
  chk(`+/-8 shading noise on one field still reads flat (${nf.modalShare})`, nf.modalShare > 0.95 && nf.clusters <= 2);
  // ORDERS: more fields is always less modal.
  chk('modalShare orders flat > two > four', f.modalShare > t.modalShare && t.modalShare > q.modalShare);

  // ⚠️ THE DIRECTION OF THE RESOLUTION BIAS — asserted, not assumed. Blur a
  // four-field patch and it must read BLANKER, which is what makes the plate side
  // conservative.
  const W = 64, H = 64;
  const img = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    img.push([[200, 120, 40], [40, 90, 200], [30, 200, 60], [230, 230, 230]][((x / 8) | 0) % 4]);
  }
  const blurred = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, c = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const qx = x + dx, qy = y + dy;
      if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
      const p = img[qy * W + qx]; r += p[0]; g += p[1]; b += p[2]; c++;
    }
    blurred.push([r / c, g / c, b / c]);
  }
  const sharp1 = crownStats(img), soft = crownStats(blurred);
  // ⚠️ OLD ASSERTIONS, kept per CLAUDE.md. They read:
  //     "blur RAISES modalShare — plate side is conservative"
  //     "blur does not RAISE cluster count"
  // Both FAILED: 0.25 -> 0.156 and 4 -> 8. Blur manufactures intermediate colours, so
  // the LOWER-acuity side reads BUSIER. That is the direction that would have let a
  // wrong conclusion through, which is why the rows below assert the real direction
  // and then assert that `--resample` shrinks it.
  chk(`blur LOWERS modalShare (${sharp1.modalShare} -> ${soft.modalShare}) — the plate side reads BUSIER, not blanker`,
    soft.modalShare < sharp1.modalShare);
  chk(`blur RAISES cluster count (${sharp1.clusters} -> ${soft.clusters})`, soft.clusters > sharp1.clusters);
  // THE FIX, asserted rather than assumed: resampling both sides to a common small
  // grid must shrink the sharp/blurred gap to something quotable as a floor.
  const rsharp = crownStats(resample(img, W, H, 24));
  const rsoft = crownStats(resample(blurred, W, H, 24));
  const rawGap = Math.abs(sharp1.modalShare - soft.modalShare);
  const resGap = Math.abs(rsharp.modalShare - rsoft.modalShare);
  // ⚠️ OLD ASSERTION, kept per CLAUDE.md: "--resample 24 shrinks the acuity gap".
  // It FAILED — 0.094 -> 0.125, i.e. resampling made it slightly WORSE. Two fixes
  // guessed, two fixes falsified by the selftest, and that is what forced the real
  // answer below: **modalShare and clusters are not repairable for a cross-acuity
  // comparison and must not be quoted across sides.**
  chk(`--resample does NOT rescue modalShare (${rawGap.toFixed(3)} -> ${resGap.toFixed(3)}) — recorded, not fixed`, true);
  // THE STATISTIC THAT IS SAFE. Averaging cannot increase mean deviation from the
  // mean, so the low-acuity side reads BLANKER on `spread`. A cross-side finding that
  // the plate crown is busier than ours is then a LOWER BOUND.
  chk(`blur LOWERS spread (${sharp1.spread} -> ${soft.spread}) — the plate side is conservative on THIS statistic`,
    soft.spread < sharp1.spread);
  chk(`spread orders flat < two < four (${f.spread} < ${t.spread} < ${q.spread})`,
    f.spread < t.spread && t.spread < q.spread);
  chk(`spread ignores +/-8 shading noise (${nf.spread} vs flat ${f.spread}, both far below two-field ${t.spread})`,
    nf.spread < t.spread / 4);
  console.log(`\ncam_crown selftest: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
} else {
  const { data, info } = await sharp(arg('--img')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = nums(arg('--box'));
  const px = [];
  for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) {
    const i = (y * info.width + x) * 4;
    px.push([data[i], data[i + 1], data[i + 2]]);
  }
  const bw = box[2] - box[0] + 1, bh = box[3] - box[1] + 1;
  const N = arg('--resample') ? Number(arg('--resample')) : null;
  const use = N ? resample(px, bw, bh, N) : px;
  const s = crownStats(use);
  console.log(JSON.stringify({ img: arg('--img'), label: arg('--label', ''), box, srcPx: px.length, resample: N, ...s }));
  if (arg('--out')) {
    const zoom = Number(arg('--zoom-factor', '3'));
    const bw = box[2] - box[0] + 1, bh = box[3] - box[1] + 1;
    const W = bw * zoom, H = bh * zoom;
    const out = Buffer.alloc(W * H * 4, 255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const si = ((box[1] + ((y / zoom) | 0)) * info.width + box[0] + ((x / zoom) | 0)) * 4;
      const di = (y * W + x) * 4;
      out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = 255;
    }
    await mkdir(dirname(arg('--out')), { recursive: true });
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(arg('--out'));
  }
}
