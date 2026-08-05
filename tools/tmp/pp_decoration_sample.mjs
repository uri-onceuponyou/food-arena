#!/usr/bin/env node
// pp_decoration_sample.mjs — READ-ONLY pixel sampler for the per-part `decoration` round.
// Grounds a blind-critic claim in numbers instead of adjectives.
//
// NON-NEGOTIABLE (CLAUDE.md #6): validated against KNOWN-BAD inputs before it is believed.
//   --selftest builds synthetic plates where the right answer is known by construction and
//   asserts the sampler MOVES on the thing it claims to measure and HOLDS on flat input.
//   A sampler that cannot be shown to FAIL is not a sampler.
//
// Usage:
//   node tools/tmp/pp_decoration_sample.mjs --selftest
//   node tools/tmp/pp_decoration_sample.mjs
import sharp from 'sharp';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luma = (r, g, b) =>
  0.2126 * srgbToLin(r / 255) + 0.7152 * srgbToLin(g / 255) + 0.0722 * srgbToLin(b / 255);
const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: mx ? d / mx : 0, v: mx / 255 };
};

/** Mean + spread of a normalised-rect patch. All fractions of image w/h. */
async function patch(file, x0, y0, x1, y1) {
  const img = sharp(file);
  const { width: W, height: H } = await img.metadata();
  const left = Math.round(x0 * W), top = Math.round(y0 * H);
  const w = Math.max(1, Math.round((x1 - x0) * W)), h = Math.max(1, Math.round((y1 - y0) * H));
  const { data, info } = await sharp(file)
    .extract({ left, top, width: w, height: h })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sr = 0, sg = 0, sb = 0;
  const L = new Float64Array(n), S = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    sr += r; sg += g; sb += b;
    L[i] = luma(r, g, b);
    S[i] = hsv(r, g, b).s;
  }
  const mean = (a) => a.reduce((p, c) => p + c, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((p, c) => p + (c - m) ** 2, 0) / a.length); };
  const sorted = Float64Array.from(L).sort();
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  const rgb = [sr / n, sg / n, sb / n];
  return {
    rgb: rgb.map((v) => Math.round(v)),
    hex: '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''),
    hue: +hsv(rgb[0], rgb[1], rgb[2]).h.toFixed(1),
    sat: +hsv(rgb[0], rgb[1], rgb[2]).s.toFixed(3),
    lumaMean: +mean(L).toFixed(4),
    lumaSD: +sd(L).toFixed(4),
    lumaP5: +q(0.05).toFixed(4),
    lumaP95: +q(0.95).toFixed(4),
    satMean: +mean(S).toFixed(3),
    px: n,
  };
}

// ---------- selftest: KNOWN-BAD inputs ----------
async function selftest() {
  const dir = mkdtempSync(join(tmpdir(), 'ppdec-'));
  let pass = 0, fail = 0;
  const ck = (name, cond, got) => { if (cond) { pass++; console.log(`  ok   ${name}  ${got ?? ''}`); } else { fail++; console.log(`  FAIL ${name}  ${got ?? ''}`); } };

  // 1. FLAT plate — the sampler must HOLD (spread ~0). A sampler that invents variation is useless
  //    for the claim "the cream bib is one flat value".
  const flat = join(dir, 'flat.png');
  await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 240, g: 235, b: 220 } } }).png().toFile(flat);
  const pf = await patch(flat, 0.1, 0.1, 0.9, 0.9);
  ck('HOLDS on flat: lumaSD == 0', pf.lumaSD === 0, `lumaSD=${pf.lumaSD}`);
  ck('HOLDS on flat: rgb exact', pf.rgb.join(',') === '240,235,220', pf.hex);

  // 2. GRADIENT plate — the sampler must MOVE. Same mean luma as a flat plate would give,
  //    but real form shading. If lumaSD stayed 0 here the flat result above would be meaningless.
  const gw = 200, gh = 200, buf = Buffer.alloc(gw * gh * 3);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const v = Math.round(150 + (y / gh) * 100); const i = (y * gw + x) * 3;
    buf[i] = v; buf[i + 1] = v; buf[i + 2] = v;
  }
  const grad = join(dir, 'grad.png');
  await sharp(buf, { raw: { width: gw, height: gh, channels: 3 } }).png().toFile(grad);
  const pg = await patch(grad, 0.1, 0.1, 0.9, 0.9);
  ck('MOVES on gradient: lumaSD > 0.02', pg.lumaSD > 0.02, `lumaSD=${pg.lumaSD}`);
  ck('MOVES on gradient: P95-P5 > 0.15', pg.lumaP95 - pg.lumaP5 > 0.15, `range=${(pg.lumaP95 - pg.lumaP5).toFixed(3)}`);

  // 3. KNOWN-BAD: assert the sampler does NOT report the gradient as flat (the exact confusion
  //    that would make the whole finding fictional).
  ck('DISCRIMINATES flat vs gradient', pg.lumaSD > pf.lumaSD + 0.02, `${pf.lumaSD} vs ${pg.lumaSD}`);

  // 4. Hue/sat sanity on a saturated magenta — a known answer by construction.
  const mag = join(dir, 'mag.png');
  await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 214, g: 15, b: 140 } } }).png().toFile(mag);
  const pm = await patch(mag, 0, 0, 1, 1);
  ck('hue of #d60f8c in 310-340', pm.hue > 310 && pm.hue < 340, `hue=${pm.hue}`);
  ck('sat of #d60f8c > 0.9', pm.sat > 0.9, `sat=${pm.sat}`);

  // 5. ORDERS: a darker patch must report lower luma than a lighter one.
  const dark = join(dir, 'dark.png');
  await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 18, b: 16 } } }).png().toFile(dark);
  const pd = await patch(dark, 0, 0, 1, 1);
  ck('ORDERS: dark < cream', pd.lumaMean < pf.lumaMean, `${pd.lumaMean} < ${pf.lumaMean}`);

  // 6. SELF-PAIR: the same patch of the same file twice must be identical.
  const a = await patch(grad, 0.2, 0.2, 0.6, 0.6), b = await patch(grad, 0.2, 0.2, 0.6, 0.6);
  ck('SELF-PAIR identical', JSON.stringify(a) === JSON.stringify(b), '');

  console.log(`\nselftest: ${pass} pass, ${fail} fail`);
  if (fail) process.exit(1);
}

// ---------- live ----------
const OURS = 'shots/perpart/decoration/ours.png';
const REF = 'shots/perpart/decoration/ref.png';

const REGIONS = {
  ours: {
    'bib cream — upper band':      [0.42, 0.42, 0.58, 0.50],
    'bib cream — lower band':      [0.42, 0.72, 0.58, 0.78],
    'bib cream — left of pocket':  [0.24, 0.55, 0.32, 0.68],
    'black wedge on bib':          [0.245, 0.51, 0.30, 0.55],
    'red pocket capsule':          [0.44, 0.575, 0.55, 0.615],
    'red hem stripe':              [0.45, 0.795, 0.55, 0.825],
    'red hem — left end':          [0.28, 0.755, 0.33, 0.775],
    // TRAP 1 (LESSONS §13): the preview harness once used a saturated CYAN backdrop, which
    // inverted figure/ground — the character measured DARKER than its surround (-0.40) while
    // the shipped match reads LIGHTER (+0.27). Confirm the polarity of THIS crop before
    // believing any value judgement made on it.
    'backdrop (polarity check)':   [0.01, 0.02, 0.04, 0.20],
    'surround torso (immediate)':  [0.62, 0.20, 0.68, 0.28],
  },
  ref: {
    'collar cream — lit top':      [0.44, 0.26, 0.56, 0.31],
    'collar cream — underside':    [0.44, 0.41, 0.56, 0.45],
    'collar cream — left lobe':    [0.22, 0.20, 0.30, 0.28],
    'candy stud core':            [0.475, 0.375, 0.505, 0.405],
    'bodice magenta':             [0.52, 0.68, 0.62, 0.74],
    'bodice core shadow':         [0.445, 0.80, 0.475, 0.86],
    'stud rim (warm halo)':       [0.463, 0.345, 0.478, 0.360],
    'gold ribbon':                [0.275, 0.52, 0.31, 0.60],
  },
};

async function live() {
  for (const [side, file] of [['OURS', OURS], ['REF', REF]]) {
    const meta = await sharp(file).metadata();
    console.log(`\n=== ${side}  (${meta.width}x${meta.height}) ===`);
    for (const [name, r] of Object.entries(REGIONS[side.toLowerCase()])) {
      const p = await patch(file, ...r);
      console.log(
        `  ${name.padEnd(28)} ${p.hex}  luma=${p.lumaMean.toFixed(3)}  sd=${p.lumaSD.toFixed(3)}` +
        `  hue=${String(p.hue).padStart(5)}  sat=${p.sat.toFixed(2)}`,
      );
    }
    // Whole-panel flatness of the dominant cream field.
    const big = side === 'OURS'
      ? await patch(file, 0.22, 0.42, 0.80, 0.78)   // the whole apron bib
      : await patch(file, 0.18, 0.16, 0.80, 0.46);  // the whole candy collar
    console.log(`  --> dominant cream field: luma=${big.lumaMean.toFixed(3)} sd=${big.lumaSD.toFixed(3)} ` +
      `P5=${big.lumaP5.toFixed(3)} P95=${big.lumaP95.toFixed(3)} range=${(big.lumaP95 - big.lumaP5).toFixed(3)} ` +
      `satMean=${big.satMean.toFixed(3)}`);
  }
}

if (process.argv.includes('--selftest')) await selftest();
else await live();
