#!/usr/bin/env node
/**
 * fx_critcrop — crop a region out of a PNG and upscale it, for the critic's 4x read.
 *
 * The flat-VFX defect was FOUND at 4x (~15 individually-readable overlapping
 * translucent primitives) and is not visible at 1x, so a critic scoring a 1600x900
 * frame at 1x cannot see the thing it is scoring. This exists to make that read
 * reproducible rather than a screenshot someone eyeballed.
 *
 * It also prints, for the cropped region only, the same flatness statistics
 * `fx_flat.mjs` reports on a mask — so "it looks flat" is never left as prose:
 *   meanGrad   mean |gradient of luma| per pixel
 *   flatShare  share of pixels with |grad luma| < eps   (eps default 0.5)
 *   lumaSd     stdev of luma
 *   satMean    mean HSV saturation
 *
 * Usage:
 *   node tools/tmp/fx_critcrop.mjs --in <png> --x 600 --y 300 --w 400 --h 260 \
 *        --scale 4 --out <png>
 *   node tools/tmp/fx_critcrop.mjs --in <png> --stats-only --x .. --y .. --w .. --h ..
 *
 * --selftest validates the STATISTICS against two synthetic known-bads:
 *   a flat fill      -> flatShare 1.0, meanGrad 0
 *   a linear ramp    -> flatShare 0.0, meanGrad > 0
 * A tool that returns the same number for both is not measuring flatness.
 * (Per CLAUDE.md rule 6: --selftest validates LOGIC, never where the tool is POINTED.
 *  The crop rectangle is printed with every run so the aim is auditable.)
 */

import sharp from 'sharp';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** HSV saturation in 0..1. */
function sat(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/**
 * Flatness statistics over a raw RGBA buffer of w*h.
 * `eps` is the |grad luma| below which a pixel counts as dead flat (fx_flat's 0.5).
 */
function stats(buf, w, h, eps = 0.5) {
  const L = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    L[i] = luma(buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2]);
  }
  let gradSum = 0;
  let flat = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (L[i + 1] - L[i - 1]) / 2;
      const gy = (L[i + w] - L[i - w]) / 2;
      const g = Math.hypot(gx, gy);
      gradSum += g;
      if (g < eps) flat++;
      n++;
    }
  }
  let lSum = 0;
  let lSq = 0;
  let sSum = 0;
  for (let i = 0; i < w * h; i++) {
    lSum += L[i];
    lSq += L[i] * L[i];
    sSum += sat(buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2]);
  }
  const mean = lSum / (w * h);
  return {
    px: w * h,
    meanGrad: gradSum / Math.max(1, n),
    flatShare: flat / Math.max(1, n),
    lumaMean: mean,
    lumaSd: Math.sqrt(Math.max(0, lSq / (w * h) - mean * mean)),
    satMean: sSum / (w * h),
  };
}

if (args.selftest) {
  const W = 64;
  const H = 64;
  const mk = (fn) => {
    const b = Buffer.alloc(W * H * 4, 255);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = fn(x, y);
        const i = (y * W + x) * 4;
        b[i] = v; b[i + 1] = v; b[i + 2] = v; b[i + 3] = 255;
      }
    }
    return b;
  };
  const flatS = stats(mk(() => 128), W, H);
  const rampS = stats(mk((x) => Math.round((x / (W - 1)) * 255)), W, H);
  const checks = [
    ['a FLAT fill reads flatShare 1.0', Math.abs(flatS.flatShare - 1) < 1e-9, flatS.flatShare],
    ['a FLAT fill reads meanGrad 0', flatS.meanGrad < 1e-9, flatS.meanGrad],
    ['a RAMP reads flatShare 0.0', rampS.flatShare < 1e-9, rampS.flatShare],
    ['a RAMP reads meanGrad > 1', rampS.meanGrad > 1, rampS.meanGrad],
    ['the two are DISTINGUISHED (flat != ramp)', flatS.flatShare !== rampS.flatShare, 'ok'],
    ['sample sets are NON-EMPTY ([].every() is true)', flatS.px > 0 && rampS.px > 0, flatS.px],
  ];
  for (const [name, ok, detail] of checks) console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${name}  [${detail}]`);
  const allOk = checks.every(([, ok]) => ok);
  console.log(`\n${allOk ? '✅ PASS' : '🔴 FAIL'}  fx_critcrop selftest: ${checks.filter(([, o]) => o).length}/${checks.length}`);
  process.exit(allOk ? 0 : 1);
}

if (!args.in) { console.error('need --in <png>'); process.exit(2); }
const img = sharp(String(args.in));
const meta = await img.metadata();
const { data: full } = await sharp(String(args.in)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const X = Math.max(0, Math.round(Number(args.x ?? 0)));
const Y = Math.max(0, Math.round(Number(args.y ?? 0)));
const W = Math.min(meta.width - X, Math.round(Number(args.w ?? meta.width)));
const H = Math.min(meta.height - Y, Math.round(Number(args.h ?? meta.height)));
if (W <= 2 || H <= 2) { console.error(`crop is empty: ${W}x${H} at (${X},${Y}) in ${meta.width}x${meta.height}`); process.exit(3); }

const crop = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const s = ((Y + y) * meta.width + (X + x)) * 4;
    const d = (y * W + x) * 4;
    crop[d] = full[s];
    crop[d + 1] = full[s + 1];
    crop[d + 2] = full[s + 2];
    crop[d + 3] = 255;
  }
}

const st = stats(crop, W, H, Number(args.eps ?? 0.5));
console.log(`${args.in}  crop (${X},${Y}) ${W}x${H} of ${meta.width}x${meta.height}`);
console.log(`  meanGrad ${st.meanGrad.toFixed(3)}  flatShare ${st.flatShare.toFixed(4)}`
  + `  lumaMean ${st.lumaMean.toFixed(2)}  lumaSd ${st.lumaSd.toFixed(2)}  satMean ${st.satMean.toFixed(4)}`);
if (args.json) console.log(JSON.stringify({ in: args.in, x: X, y: Y, w: W, h: H, ...st }));

if (args['stats-only'] || !args.out) process.exit(0);

const S = Math.max(1, Math.round(Number(args.scale ?? 4)));
await sharp(crop, { raw: { width: W, height: H, channels: 4 } })
  .resize({ width: W * S, height: H * S, kernel: 'nearest' })
  .png()
  .toFile(String(args.out));
console.log(`  -> ${args.out}  ${W * S}x${H * S} (${S}x nearest)`);
