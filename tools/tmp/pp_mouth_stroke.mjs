#!/usr/bin/env node
// pp_mouth_stroke.mjs — scale-invariant stroke-weight instrument for the per-part `mouth` round.
//
// WHY: comparing "how thick is the mouth" across two panels cropped at different blow-ups is
// meaningless in pixels. The ratio  (stroke thickness) / (stroke horizontal extent)  is invariant
// to crop scale as long as the whole stroke is inside the frame, so that is what this measures.
//
// It also reports the luma of the stroke vs the luma of the surround it sits on, which is the
// LESSONS-13 figure/ground polarity check: a mouth must be DARKER than the face in BOTH panels or
// the two are not the same relationship and the round is not comparable.
//
// KNOWN-BAD VALIDATION (--selftest): the instrument must FAIL on
//   (a) a uniform field            -> must report NO stroke, not a confident number
//   (b) inverted polarity          -> must report NO dark stroke
//   (c) a synthetic stroke of known thickness/width -> must recover the ratio within 10%
import sharp from 'sharp';

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function otsu(vals) {
  const hist = new Array(256).fill(0);
  for (const v of vals) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = vals.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, thr = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  // NOTE: otsu's `thr` is the LAST index of the dark class, so callers must test `L <= thr`.
  // Testing `L < thr` put the whole synthetic stroke in the light class and the selftest caught it
  // (4 fails) before a single real number was believed.
  const mean = sum / total;
  let tv = 0;
  for (let i = 0; i < 256; i++) tv += hist[i] * (i - mean) * (i - mean);
  tv /= total;
  return { thr, sep: tv > 1e-9 ? (best / (total * total)) / tv : 0, std: Math.sqrt(tv) };
}

// region given as fractions [x0,x1,y0,y1] of the panel
async function measure(nameOrBuf, region, label) {
  let img = typeof nameOrBuf === 'string' ? sharp(nameOrBuf) : sharp(nameOrBuf);
  const meta = await img.metadata();
  const W = meta.width, H = meta.height;
  const rx0 = Math.round(region[0] * W), rx1 = Math.round(region[1] * W);
  const ry0 = Math.round(region[2] * H), ry1 = Math.round(region[3] * H);
  const rw = rx1 - rx0, rh = ry1 - ry0;
  const { data } = await sharp(typeof nameOrBuf === 'string' ? nameOrBuf : nameOrBuf)
    .extract({ left: rx0, top: ry0, width: rw, height: rh })
    .raw().toColourspace('srgb').removeAlpha().toBuffer({ resolveWithObject: true });

  const L = new Float64Array(rw * rh);
  // SECOND selftest failure: the histogram was built on ROUNDED luma but the class test compared the
  // RAW float, so a stroke at luma 40.36 fell outside a thr of 40 and the dark class came back EMPTY.
  // Quantise once, compare in the same space. (An instrument that measures in a different space from
  // the one it thresholded in is exactly the ID-buffer trap in another costume.)
  for (let i = 0, p = 0; i < L.length; i++, p += 3) L[i] = Math.round(luma(data[p], data[p + 1], data[p + 2]));

  const { thr, sep, std } = otsu(Array.from(L));
  // stroke = dark class; surround = light class
  let darkSum = 0, darkN = 0, lightSum = 0, lightN = 0;
  for (let i = 0; i < L.length; i++) {
    if (L[i] <= thr) { darkSum += L[i]; darkN++; } else { lightSum += L[i]; lightN++; }
  }
  const darkFrac = darkN / L.length;
  const strokeL = darkN ? darkSum / darkN : NaN;
  const surroundL = lightN ? lightSum / lightN : NaN;

  // per-column longest dark run
  const cols = [];
  for (let x = 0; x < rw; x++) {
    let best = 0, run = 0;
    for (let y = 0; y < rh; y++) {
      if (L[y * rw + x] <= thr) { run++; if (run > best) best = run; } else run = 0;
    }
    cols.push(best);
  }
  const occupied = cols.filter((c) => c > 0);
  const extent = occupied.length;                     // horizontal reach of the stroke, px
  const sorted = occupied.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  // GUARDS — the instrument must refuse rather than answer
  const problems = [];
  if (std < 3) problems.push(`UNIFORM FIELD (luma std ${std.toFixed(2)}) — nothing to separate`);
  if (sep < 0.35) problems.push(`NO BIMODAL SPLIT (otsu eta2 ${sep.toFixed(3)})`);
  if (darkFrac < 0.002) problems.push(`NO DARK CLASS (${(darkFrac * 100).toFixed(2)}% dark)`);
  if (darkFrac > 0.75) problems.push(`DARK CLASS IS THE GROUND (${(darkFrac * 100).toFixed(1)}%) — polarity inverted?`);
  if (extent < rw * 0.15) problems.push(`stroke reaches only ${(extent / rw * 100).toFixed(0)}% of region width`);

  const ratio = extent ? median / extent : NaN;
  return { label, W, H, region, thr, sep, std, darkFrac, strokeL, surroundL, median, extent, ratio, problems };
}

function print(m) {
  console.log(`\n[${m.label}] panel ${m.W}x${m.H}  region ${JSON.stringify(m.region)}`);
  console.log(`  otsu thr ${m.thr}  eta2 ${m.sep.toFixed(3)}  luma std ${m.std.toFixed(1)}  dark ${(m.darkFrac * 100).toFixed(1)}%`);
  console.log(`  stroke luma ${m.strokeL.toFixed(1)}   surround luma ${m.surroundL.toFixed(1)}   ` +
              `delta ${(m.strokeL - m.surroundL).toFixed(1)} (${m.strokeL < m.surroundL ? 'DARKER than surround' : 'LIGHTER than surround'})`);
  console.log(`  median stroke thickness ${m.median}px   horizontal extent ${m.extent}px`);
  console.log(`  >>> WEIGHT RATIO (thickness / extent) = ${m.ratio.toFixed(4)}`);
  if (m.problems.length) console.log(`  !! ${m.problems.join(' | ')}`);
}

async function synth({ w = 800, h = 400, strokeT = 0, strokeW = 0, bg = [220, 150, 90], fg = [40, 40, 45], invert = false }) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0, p = 0; i < w * h; i++, p += 3) { buf[p] = bg[0]; buf[p + 1] = bg[1]; buf[p + 2] = bg[2]; }
  if (strokeT > 0) {
    const x0 = Math.round((w - strokeW) / 2), y0 = Math.round(h / 2 - strokeT / 2);
    for (let y = y0; y < y0 + strokeT; y++) for (let x = x0; x < x0 + strokeW; x++) {
      const p = (y * w + x) * 3; buf[p] = fg[0]; buf[p + 1] = fg[1]; buf[p + 2] = fg[2];
    }
  }
  if (invert) for (let i = 0, p = 0; i < w * h; i++, p += 3) {
    buf[p] = 255 - buf[p]; buf[p + 1] = 255 - buf[p + 1]; buf[p + 2] = 255 - buf[p + 2];
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function selftest() {
  let pass = 0, fail = 0;
  const chk = (name, ok, detail) => { if (ok) { pass++; console.log(`  PASS  ${name}`); }
    else { fail++; console.log(`  FAIL  ${name}  ${detail}`); } };

  console.log('SELFTEST — instrument must FAIL on known-bad input');
  // 1. known-good: thickness 12 over extent 600 -> ratio 0.020
  const good = await measure(await synth({ strokeT: 12, strokeW: 600 }), [0, 1, 0, 1], 'synthetic 12/600');
  print(good);
  chk('recovers known ratio 0.0200 within 10%', Math.abs(good.ratio - 12 / 600) / (12 / 600) < 0.1, `got ${good.ratio.toFixed(4)}`);
  chk('known-good raises no problem', good.problems.length === 0, good.problems.join('|'));
  chk('known-good reads stroke DARKER than surround', good.strokeL < good.surroundL, '');

  // 2. known-bad: uniform field, no stroke at all -> must refuse
  const blank = await measure(await synth({ strokeT: 0 }), [0, 1, 0, 1], 'known-bad: uniform field');
  print(blank);
  chk('REFUSES a uniform field', blank.problems.length > 0, 'answered confidently on a blank image');

  // 3. known-bad: inverted polarity (light stroke on dark ground) -> must not report a dark stroke
  const inv = await measure(await synth({ strokeT: 12, strokeW: 600, invert: true }), [0, 1, 0, 1], 'known-bad: inverted polarity');
  print(inv);
  chk('flags inverted polarity (dark class is the ground)', inv.problems.length > 0 || inv.darkFrac > 0.75,
      `darkFrac ${inv.darkFrac.toFixed(3)} problems ${inv.problems.length}`);

  // 4. known-bad: same ratio at 3x scale must give the SAME answer (scale invariance)
  const big = await measure(await synth({ w: 2400, h: 1200, strokeT: 36, strokeW: 1800 }), [0, 1, 0, 1], 'scale x3 of case 1');
  print(big);
  chk('scale-invariant (x3 crop gives same ratio)', Math.abs(big.ratio - good.ratio) < 0.002, `${big.ratio.toFixed(4)} vs ${good.ratio.toFixed(4)}`);

  console.log(`\nSELFTEST ${pass} pass / ${fail} fail`);
  if (fail) process.exit(1);
}

const args = process.argv.slice(2);
if (args[0] === '--selftest') { await selftest(); }
else {
  const base = '/Users/uribishansky/claude-code/food-arena/shots/perpart/mouth';
  // OURS: whole mouth tube is inside the frame; excludes the grey letterbox border.
  const ours = await measure(`${base}/ours.png`, [0.03, 0.97, 0.03, 0.97], 'OURS  mouth');
  // REF: band under the nose and left of the eye — isolates the smile line only.
  const ref = await measure(`${base}/ref.png`, [0.24, 0.62, 0.44, 0.74], 'REF   mouth');
  print(ours); print(ref);
  console.log(`\nSTROKE-WEIGHT RATIO  ours ${ours.ratio.toFixed(4)}  vs  ref ${ref.ratio.toFixed(4)}  ` +
              `= ${(ours.ratio / ref.ratio).toFixed(1)}x heavier`);
  console.log(`FIGURE/GROUND POLARITY  ours ${(ours.strokeL - ours.surroundL).toFixed(1)}  ` +
              `ref ${(ref.strokeL - ref.surroundL).toFixed(1)}  ` +
              `-> ${(ours.strokeL < ours.surroundL) === (ref.strokeL < ref.surroundL) ? 'SAME polarity' : 'OPPOSITE polarity — round not comparable'}`);
}
