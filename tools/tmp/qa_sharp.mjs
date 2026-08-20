#!/usr/bin/env node
/**
 * QA_SHARP — IS THE FRAME ACTUALLY SOFTER, OR DOES IT JUST LOOK DIFFERENT?
 *
 * Uri said *"the resolution is slightly lower, or something else changed"* and explicitly
 * told us he cannot tell which. "Different" and "softer" are different defects with
 * different fixes, and a pixel-diff percentage cannot separate them: replacing one
 * character and blurring the whole frame both read as a large percentage.
 *
 * This measures HIGH-FREQUENCY ENERGY — mean Sobel gradient magnitude on luma, plus the
 * share of pixels carrying a strong edge. Downscaling-then-upscaling a frame, which is
 * what a lower pixel ratio does, REMOVES high-frequency energy. So:
 *
 *   grad(after) < grad(before)      -> the frame really is softer
 *   grad(after) ~= grad(before)     -> it changed WITHOUT losing resolution
 *
 * ── WHY THERE IS A SCALE LADDER, AND WHY IT IS THE POINT ───────────────────────────
 * The metric is meaningless without a sense of what a REAL resolution drop is worth on
 * THIS content. So every run also prints the same frame resampled through 1.25 -> 1.0
 * and 1.25 -> 0.83 pixel ratios. That is the yardstick: if the measured before/after gap
 * is a tenth of the gap a genuine ratio drop produces, "the resolution is lower" is not
 * what happened, and saying so is worth more than another percentage.
 *
 * ── KNOWN-BAD (rule 6) ────────────────────────────────────────────────────────────
 * `--selftest` requires the metric to FALL on a deliberately blurred input and to FALL
 * on a deliberately downscaled-then-upscaled one. A sharpness metric that has not been
 * shown to drop on a blur is not a sharpness metric. It also asserts the metric is NOT
 * merely tracking brightness, by requiring it to hold still under a gain change.
 *
 *   node tools/tmp/qa_sharp.mjs <before.png> <after.png> [--label X]
 *   node tools/tmp/qa_sharp.mjs --selftest
 */
import sharp from 'sharp';

const argv = process.argv.slice(2);

/** Mean Sobel gradient magnitude over luma, and the strong-edge share. */
async function sharpness(src) {
  const { data, info } = await sharp(src).removeAlpha().greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0, strong = 0, n = 0, lum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = data[i - w - 1], t = data[i - w], tr = data[i - w + 1];
      const l = data[i - 1], r = data[i + 1];
      const bl = data[i + w - 1], b = data[i + w], br = data[i + w + 1];
      const gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      const g = Math.sqrt(gx * gx + gy * gy);
      sum += g; if (g > 40) strong++; n++; lum += data[i];
    }
  }
  return {
    w, h, meanGrad: +(sum / n).toFixed(4),
    strongEdgePct: +((strong / n) * 100).toFixed(4),
    meanLuma: +(lum / n).toFixed(3),
  };
}

/**
 * Resample through a lower effective pixel ratio, then back — what a DPR drop does.
 *
 * 🚨 THE TWO RESIZES MUST BE TWO PIPELINES. `sharp(x).resize(a).resize(b)` does NOT
 * downscale then upscale: sharp keeps only the LAST resize, so the whole call collapses
 * to an identity and this function returned its input unchanged. It read as "a pixel
 * ratio drop costs 0.00% of sharpness", i.e. the yardstick this file exists to provide
 * was silently a ruler with no markings. Caught by §C's known-bad arm, which is the only
 * thing in this file that could have caught it — the numbers alone looked plausible.
 */
async function throughRatio(src, from, to) {
  const meta = await sharp(src).metadata();
  const dw = Math.max(2, Math.round((meta.width * to) / from));
  const dh = Math.max(2, Math.round((meta.height * to) / from));
  const small = await sharp(src).resize(dw, dh, { kernel: 'lanczos3' }).png().toBuffer();
  return sharp(small).resize(meta.width, meta.height, { kernel: 'lanczos3' }).png().toBuffer();
}

if (argv.includes('--selftest')) {
  let fails = 0;
  const ok = (c, m) => { console.log(`${c ? '  ok  ' : '  FAIL'} ${m}`); if (!c) fails++; };
  // A deterministic high-frequency test image: a checkerboard has maximal edge energy.
  const W = 128, H = 128;
  const raw = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw[y * W + x] = ((x >> 2) + (y >> 2)) % 2 ? 220 : 40;
  const base = await sharp(raw, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();

  const s0 = await sharpness(base);
  ok(s0.meanGrad > 0, `A1 metric is non-zero on an edgy image (${s0.meanGrad})`);
  ok(s0.strongEdgePct > 0, `A2 strong-edge share non-zero (${s0.strongEdgePct}%)`);

  // §B KNOWN-BAD: a blur MUST lower it.
  const blurred = await sharp(base).blur(1.5).png().toBuffer();
  const sb = await sharpness(blurred);
  ok(sb.meanGrad < s0.meanGrad * 0.9,
    `B1 KNOWN-BAD blur(1.5) DROPS meanGrad ${s0.meanGrad} -> ${sb.meanGrad}`);

  // §C KNOWN-BAD: a real pixel-ratio drop MUST lower it, and MONOTONICALLY.
  // Asserted as monotonicity rather than against a tuned threshold, because how much a
  // single resample costs depends entirely on the content's frequency — on this 4px
  // checkerboard 1.25->1.0 is only -0.65%, which would make any fixed bar arbitrary.
  // Monotone decrease across the ladder is a property of the METRIC, not of the fixture.
  const ladder = [];
  for (const to of [1.0, 0.83, 0.625, 0.4]) {
    ladder.push((await sharpness(await throughRatio(base, 1.25, to))).meanGrad);
  }
  ok(ladder.length === 4, 'C0 the ladder is NON-EMPTY before anything is asserted over it');
  ok(ladder[0] < s0.meanGrad, `C1 KNOWN-BAD 1.25->1.0 DROPS meanGrad ${s0.meanGrad} -> ${ladder[0]}`);
  ok(ladder.every((v, i) => i === 0 || v < ladder[i - 1]),
    `C2 KNOWN-BAD the drop is MONOTONE as the ratio falls: ${s0.meanGrad} -> ${ladder.join(' -> ')}`);
  ok(ladder[3] < s0.meanGrad * 0.6,
    `C3 KNOWN-BAD a severe ratio drop is unmistakable (${s0.meanGrad} -> ${ladder[3]})`);

  // §D the metric must NOT be a brightness meter in disguise.
  const brighter = await sharp(base).linear(1.0, 20).png().toBuffer();
  const sbr = await sharpness(brighter);
  ok(Math.abs(sbr.meanGrad - s0.meanGrad) < s0.meanGrad * 0.02,
    `D1 a +20 gain does NOT move meanGrad (${s0.meanGrad} -> ${sbr.meanGrad})`);
  ok(sbr.meanLuma > s0.meanLuma + 15, `D2 ...though it clearly moved the LUMA (${s0.meanLuma} -> ${sbr.meanLuma})`);

  // §E non-emptiness: the loop must actually have visited pixels.
  ok(s0.w > 2 && s0.h > 2, 'E1 image big enough that the interior loop is non-empty');
  console.log(fails ? `\nSELFTEST: ${fails} FAILED` : '\nSELFTEST: all passed');
  process.exit(fails ? 1 : 0);
}

const files = argv.filter((x) => !x.startsWith('--'));
if (files.length < 2) { console.error('usage: qa_sharp.mjs before.png after.png'); process.exit(2); }
const [bPath, aPath] = files;
const li = argv.indexOf('--label');
const LABEL = li >= 0 ? argv[li + 1] : '';

const B = await sharpness(bPath);
const A = await sharpness(aPath);
console.log(`\n${LABEL}  ${B.w}x${B.h}`);
console.log(`  BEFORE  meanGrad ${B.meanGrad}   strongEdge ${B.strongEdgePct}%   luma ${B.meanLuma}`);
console.log(`  AFTER   meanGrad ${A.meanGrad}   strongEdge ${A.strongEdgePct}%   luma ${A.meanLuma}`);
const d = ((A.meanGrad - B.meanGrad) / B.meanGrad) * 100;
console.log(`  DELTA   meanGrad ${d >= 0 ? '+' : ''}${d.toFixed(2)}%`);

console.log('\n  THE YARDSTICK — what a REAL pixel-ratio drop costs on this same frame:');
for (const [from, to] of [[1.25, 1.0], [1.25, 0.83], [1.25, 0.625]]) {
  const r = await sharpness(await throughRatio(bPath, from, to));
  const dr = ((r.meanGrad - B.meanGrad) / B.meanGrad) * 100;
  console.log(`    ${from} -> ${to}   meanGrad ${B.meanGrad} -> ${r.meanGrad}   (${dr.toFixed(2)}%)`);
}
