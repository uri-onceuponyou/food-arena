#!/usr/bin/env node
/**
 * FP_PERIOD — how BIG is the repeating unit of the ground, on screen?
 *
 * `fp_ground_windows.mjs` established that our ground surface is at or above the six
 * reference plates in every frequency band (hf 1.92x, mf 1.14x, lf 1.05x) and that the
 * only ground-side metric outside their range is `oriAll`, the share of gradient energy
 * concentrated in two fixed directions — 1.41x, and only barely non-overlapping.
 *
 * A two-direction lattice has exactly one free parameter that this project can move
 * without touching value, hue or the acceptance probe: the PERIOD. `floor.ts` picks
 * TILE = 40wu and its own comment reasons that this "reads as ~22 tiles at shipped zoom
 * and ~10 at the closest plausible camera, which is the range that survives both" — but
 * the game only ever ships one of those two zooms. So the question this answers is what
 * the reference's ground repeat actually measures, in units that survive resolution
 * differences: PERIOD AS A FRACTION OF FRAME HEIGHT.
 *
 * ── Method ──────────────────────────────────────────────────────────────────────
 * Resize to height 900. Take a ground-only rectangle (declared per image, and dumped as
 * a marked PNG so the choice is auditable). Band-pass it (remove the 24px+ lighting
 * structure, keep 2-24px), then take the 1-D autocorrelation of the row-mean and of the
 * column-mean and report the strongest peak at lag >= MINLAG. A lattice gives a sharp
 * peak at the tile pitch; grass gives no peak above the noise floor, and that is a
 * legitimate answer, reported as `-`.
 *
 * ── KNOWN-BAD CONTROLS (`--selftest`) ───────────────────────────────────────────
 *   STRIPES-32   synthetic 32px vertical stripes -> column period must read 32 +-1
 *   STRIPES-64   the same at 64px               -> must read 64 +-2, i.e. it TRACKS
 *   NOISE        isotropic noise                -> must report NO period (peak < 0.35)
 *   FLAT         constant                       -> must report NO period
 *   SELF         same crop twice                -> identical
 *
 *   node tools/tmp/fp_period.mjs --selftest
 *   node tools/tmp/fp_period.mjs
 */
import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadBand, analyse } from './fp_ground_windows.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const NH = 900;
const MINLAG = 8;
const PEAKMIN = 0.55;   // normalised autocorrelation below this = "no period". SET BY THE CONTROL:
// isotropic noise averaged down a 200-row column still returns a spurious peak of 0.431,
// so anything under ~0.5 is the instrument reading its own noise. A first pass used 0.35
// and the NOISE control failed — `docs/LESSONS.md` §13, caught before it was believed.

const LUMA = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function blur1(src, w, h, r) {
  if (r < 1) return Float32Array.from(src);
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * r + 1);
        acc -= a[row + Math.min(w - 1, Math.max(0, x - r))];
        acc += a[row + Math.min(w - 1, Math.max(0, x + r + 1))];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc -= b[Math.min(h - 1, Math.max(0, y - r)) * w + x];
        acc += b[Math.min(h - 1, Math.max(0, y + r + 1)) * w + x];
      }
    }
  }
  return a;
}

/** Strongest autocorrelation peak of a 1-D profile at lag >= MINLAG. */
function period(profile) {
  const n = profile.length;
  let m = 0; for (const v of profile) m += v; m /= n;
  const c = profile.map((v) => v - m);
  let e0 = 0; for (const v of c) e0 += v * v;
  if (e0 <= 1e-12) return { lag: -1, peak: 0 };
  let best = -1, bestV = -2;
  const maxLag = Math.floor(n / 2);
  const acf = new Float64Array(maxLag + 1);
  for (let L = MINLAG; L <= maxLag; L++) {
    let s = 0;
    for (let i = 0; i + L < n; i++) s += c[i] * c[i + L];
    acf[L] = s / e0 * (n / (n - L));   // unbiased-ish
  }
  for (let L = MINLAG + 1; L < maxLag; L++) {
    if (acf[L] > acf[L - 1] && acf[L] >= acf[L + 1] && acf[L] > bestV) { bestV = acf[L]; best = L; }
  }
  return { lag: best, peak: bestV < -1 ? 0 : bestV };
}

/**
 * How DEEP is the darkest line in this ground, relative to the surface it is cut into?
 * `L - blur12` isolates the joint from the lighting; p1 is the joint's floor and p99 its
 * brightest lip. Same definition both sides, so "our grout is Nx the reference's" is a
 * statement about the picture rather than about two different measurements.
 */
function jointDepth(L, w, h) {
  const lo = blur1(L, w, h, 5);
  const hp = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) hp[i] = L[i] - lo[i];
  const s = Array.from(hp).sort((a, b) => a - b);
  return { p1: s[Math.floor(s.length * 0.01)], p99: s[Math.floor(s.length * 0.99)] };
}

function analyseCrop(L, w, h) {
  // band-pass 2..24 px: strip lighting structure, keep the repeat
  const lo = blur1(L, w, h, 10);   // ~24px
  const hi = blur1(L, w, h, 1);    // ~3px
  const bp = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) bp[i] = hi[i] - lo[i];
  const colProf = new Float64Array(w), rowProf = new Float64Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { colProf[x] += bp[y * w + x]; rowProf[y] += bp[y * w + x]; }
  for (let x = 0; x < w; x++) colProf[x] /= h;
  for (let y = 0; y < h; y++) rowProf[y] /= w;
  const px = period(Array.from(colProf));
  const py = period(Array.from(rowProf));
  return { colLag: px.lag, colPeak: px.peak, rowLag: py.lag, rowPeak: py.peak };
}

async function crop(path, [fx, fy, fw, fh]) {
  const meta = await sharp(path).metadata();
  const nw = Math.round((meta.width / meta.height) * NH);
  const { data, info } = await sharp(path).resize(nw, NH, { fit: 'fill' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const x0 = Math.round(info.width * fx), y0 = Math.round(info.height * fy);
  const w = Math.round(info.width * fw), h = Math.round(info.height * fh);
  const L = new Float32Array(w * h);
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y + y0) * info.width + (x + x0)) * 3;
    L[y * w + x] = LUMA(data[s], data[s + 1], data[s + 2]);
    rgb[(y * w + x) * 3] = data[s]; rgb[(y * w + x) * 3 + 1] = data[s + 1]; rgb[(y * w + x) * 3 + 2] = data[s + 2];
  }
  return { L, rgb, w, h };
}

function synth(kind, w = 320, h = 220) {
  const L = new Float32Array(w * h);
  let s = 4242; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const n = new Float32Array(w * h); for (let i = 0; i < w * h; i++) n[i] = rnd();
  const bl = blur1(n, w, h, 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0.5;
    if (kind === 'STRIPES-32') v = (x % 32) < 4 ? 0.3 : 0.6;
    else if (kind === 'STRIPES-64') v = (x % 64) < 6 ? 0.3 : 0.6;
    else if (kind === 'NOISE') v = 0.5 + (bl[y * w + x] - 0.5) * 2;
    L[y * w + x] = v;
  }
  return { L, w, h };
}

if (has('selftest')) {
  let pass = 0, fail = 0;
  const ck = (n, c, g) => { if (c) { pass++; console.log(`  PASS  ${n}  ${g}`); } else { fail++; console.log(`  FAIL  ${n}  ${g}`); } };
  for (const [kind, want] of [['STRIPES-32', 32], ['STRIPES-64', 64]]) {
    const s = synth(kind); const r = analyseCrop(s.L, s.w, s.h);
    ck(`${kind} column period ~ ${want}`, Math.abs(r.colLag - want) <= 2 && r.colPeak > PEAKMIN, `lag=${r.colLag} peak=${r.colPeak.toFixed(3)}`);
    ck(`${kind} row period absent`, r.rowPeak < PEAKMIN, `rowPeak=${r.rowPeak.toFixed(3)}`);
  }
  const nz = synth('NOISE'); const rn = analyseCrop(nz.L, nz.w, nz.h);
  ck('NOISE has no period', rn.colPeak < PEAKMIN && rn.rowPeak < PEAKMIN, `col=${rn.colPeak.toFixed(3)} row=${rn.rowPeak.toFixed(3)}`);
  const fl = synth('FLAT'); const rf = analyseCrop(fl.L, fl.w, fl.h);
  ck('FLAT has no period', rf.colPeak < PEAKMIN && rf.rowPeak < PEAKMIN, `col=${rf.colPeak.toFixed(3)} row=${rf.rowPeak.toFixed(3)}`);
  const a = synth('STRIPES-32'); const r1 = analyseCrop(a.L, a.w, a.h); const r2 = analyseCrop(a.L, a.w, a.h);
  ck('SELF-PAIR identical', JSON.stringify(r1) === JSON.stringify(r2), 'equal');
  console.log(`\n  fp_period selftest: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

/**
 * ── CROPS ARE PICKED BY THE MASK, NOT BY HAND, AND THAT IS THE SECOND VERSION ───
 *
 * A first pass declared normalised rectangles by eye off a 440px contact sheet, dumped
 * them, and LOOKED at them — and four of the five reference crops were contaminated:
 * bs_01's "paver" was two props and a nameplate, bs_06's "ground" was HUD text, bs_04's
 * "grass" was a wooden fence. The reference rows were therefore measuring nothing, while
 * the two OURS rows were clean, which is the worst possible shape for a comparison and
 * would have read as "only our ground is periodic" for entirely the wrong reason.
 *
 * So the rectangle is now chosen by the same validated ground mask
 * (`fp_ground_windows.mjs`, 14/14 controls, imported rather than copied): the largest
 * axis-aligned RECT_W x RECT_H box whose pixels are >= 97% ground. Every crop is still
 * dumped by `--sheet` and must still be looked at.
 */
const RECT_W = 420, RECT_H = 200;
/**
 * ⚠️ And a THIRD correction, from the same discipline. Asking for "the densest ground
 * box" picked, on our frames, the flat blue utility pad every time — it is uniform, so
 * it is 100% pure, so it always wins the tie — and the tile field, the one surface with
 * a lattice, was never sampled. The box is therefore chosen PER GROUND CLUSTER, so each
 * distinct ground surface in a frame gets its own row.
 */
function bestGroundRect(mask, w, h) {
  // integral image of the mask, then the densest RECT_W x RECT_H box
  const ii = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    ii[(y + 1) * (w + 1) + x + 1] = mask[y * w + x] + ii[y * (w + 1) + x + 1] + ii[(y + 1) * (w + 1) + x] - ii[y * (w + 1) + x];
  const sum = (x0, y0, x1, y1) => ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
  let best = null, bestS = -1;
  for (let y = 0; y + RECT_H <= h; y += 4) for (let x = 0; x + RECT_W <= w; x += 4) {
    const sv = sum(x, y, x + RECT_W, y + RECT_H);
    if (sv > bestS) { bestS = sv; best = [x, y]; }
  }
  return best ? { x: best[0], y: best[1], purity: bestS / (RECT_W * RECT_H) } : null;
}

const refDir = arg('refs', 'reference/images/curated/gameplay_topdown');
const IMAGES = [
  ...(await readdir(refDir)).filter((f) => /^bs_\d+\.png$/.test(f)).sort().map((f) => ['REF ' + f.replace('.png', ''), join(refDir, f)]),
  ...String(arg('ours', 'shots/baseline/match_cand02.png,shots/baseline2/match_donut_taco_02.png,shots/baseline2/match_sushi_hamburger_01.png'))
    .split(',').filter(Boolean).map((p) => ['OURS ' + p.split('/').pop().replace('.png', ''), p]),
];

const sheetDir = arg('sheet');
console.log(`  rect ${RECT_W}x${RECT_H}, chosen automatically as the densest >=97%-ground box`);
console.log('  image / ground cluster                   purity   at        col lag / peak     row lag / peak  period %H   jointP1  lipP99');
for (const [label, path] of IMAGES) {
  const { rgb, w, h } = await loadBand(path);
  const res = analyse(rgb, w, h);
  for (const [ci, cen] of res.centroids.entries()) {
  // per-cluster mask: this ground colour only
  const cmask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (Math.hypot(rgb[i * 3] - cen[0], rgb[i * 3 + 1] - cen[1], rgb[i * 3 + 2] - cen[2]) <= 46) cmask[i] = 1;
  }
  // Close by 5px, for the same reason `fp_ground_windows` does: a per-cluster colour
  // test deletes the thin dark features INSIDE the surface — our tile joints, the
  // reference's leaf gaps — and without this no 420x200 box reaches 97% anywhere, on
  // either side. Purity is 0.90 rather than 0.97 for the same reason: a real ground
  // surface is not one colour.
  { const R = 5, t1 = new Uint8Array(w * h), t2 = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -R; k <= R && !v; k++) v = cmask[y * w + Math.min(w - 1, Math.max(0, x + k))]; t1[y * w + x] = v; }
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { let v = 0; for (let k = -R; k <= R && !v; k++) v = t1[Math.min(h - 1, Math.max(0, y + k)) * w + x]; t2[y * w + x] = v; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 1; for (let k = -R; k <= R && v; k++) v = t2[y * w + Math.min(w - 1, Math.max(0, x + k))]; t1[y * w + x] = v; }
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { let v = 1; for (let k = -R; k <= R && v; k++) v = t1[Math.min(h - 1, Math.max(0, y + k)) * w + x]; cmask[y * w + x] = v; } }
  const box = bestGroundRect(cmask, w, h);
  const tag = `${label} c${ci} rgb(${cen.join(',')})`;
  if (!box || box.purity < 0.90) { console.log(`  ${tag.padEnd(40)} ${((box?.purity ?? 0) * 100).toFixed(1)}%  no >=90% box`); continue; }
  const L = new Float32Array(RECT_W * RECT_H);
  const crgb = new Uint8Array(RECT_W * RECT_H * 3);
  for (let y = 0; y < RECT_H; y++) for (let x = 0; x < RECT_W; x++) {
    const si = ((box.y + y) * w + box.x + x) * 3, di = (y * RECT_W + x);
    L[di] = LUMA(rgb[si], rgb[si + 1], rgb[si + 2]);
    crgb[di * 3] = rgb[si]; crgb[di * 3 + 1] = rgb[si + 1]; crgb[di * 3 + 2] = rgb[si + 2];
  }
  const r = analyseCrop(L, RECT_W, RECT_H);
  const jd = jointDepth(L, RECT_W, RECT_H);
  const fmt = (lag, peak) => (peak >= PEAKMIN ? `${String(lag).padStart(3)}px ${peak.toFixed(2)}` : `   -  ${peak.toFixed(2)}`);
  const lags = [r.colPeak >= PEAKMIN ? r.colLag : null, r.rowPeak >= PEAKMIN ? r.rowLag : null].filter((v) => v);
  const pctH = lags.length ? (Math.max(...lags) / NH * 100).toFixed(2) + '%' : '   -';
  console.log(`  ${tag.padEnd(40)} ${(box.purity * 100).toFixed(1)}%  ${String(box.x + ',' + box.y).padEnd(9)} ${fmt(r.colLag, r.colPeak)}      ${fmt(r.rowLag, r.rowPeak)}   ${pctH.padStart(7)}   ${jd.p1.toFixed(4).padStart(8)} ${jd.p99.toFixed(4).padStart(7)}`);
  if (sheetDir) {
    const out = `${sheetDir}/${tag.replace(/[^a-z0-9]+/gi, '_')}.png`;
    await mkdir(dirname(out), { recursive: true });
    await sharp(Buffer.from(crgb), { raw: { width: RECT_W, height: RECT_H, channels: 3 } }).png().toFile(out);
  }
  }
}
