#!/usr/bin/env node
/**
 * FP_GROUND — WHAT IS ACTUALLY DIFFERENT ABOUT OUR GROUND PLANE?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * 9 of 14 arena critics named the floor unprompted, and they named THREE mechanisms
 * in one breath:
 *
 *   (a) "hard unmodulated tile lines"
 *   (b) "a hard, unblended straight seam between the two colours"
 *   (c) "no surface detail" / "the vast empty grid-tiled floor"
 *
 * `docs/LESSONS.md` §3 says critics name symptoms accurately and mechanisms badly, and
 * §6b says the last pass moved its acceptance test 4.7 floors and the score zero because
 * the test governed the minority of the frame. So before anything is changed, this asks
 * WHICH of (a)/(b)/(c) is actually anomalous against the six curated `gameplay_topdown`
 * plates — run with the SAME code, on the SAME normalisation, both sides.
 *
 * It is entirely possible that the answer is "none of them" and the floor is not the
 * lever. That is a complete answer and this tool is built to be able to return it.
 *
 * ── Normalisation, stated because it is the whole comparability argument ────────
 * Every image is resized to HEIGHT 900 preserving aspect, then cropped to the central
 * band x∈[0.08,0.92], y∈[0.15,0.82]. That band excludes the top HUD (both sides carry
 * one) and the bottom HUD/controls. It is NOT a ground mask — it contains characters and
 * props on both sides, deliberately, because the metrics below are about how much of the
 * frame is UNBROKEN and a ground mask would beg that question.
 *
 * ⚠️ ACUITY BIAS, and it runs AGAINST the reference: `docs/LESSONS.md` §3 records that
 * the plates arrive upscaled 1.33-1.43x, i.e. ~0.42-0.48x our edge acuity. So any
 * HIGH-frequency number is biased in OUR favour. If ours is lower than theirs anyway,
 * that is damning; if ours is higher, it proves nothing about (c).
 *
 * ── The four numbers ────────────────────────────────────────────────────────────
 *   emptyP90    (c). Distance, in px at height-900, from a pixel to the nearest
 *               feature (|L - blur12| > FTHRESH). p90 over the band. Big = long
 *               stretches of frame with nothing in them. This is "vast and empty"
 *               turned into a number, and it is CONSERVATIVE against our own case
 *               because our tile joints count as features.
 *   oriTop2     (a). Share of gradient magnitude lying within +-1 bin of the two
 *               strongest of 36 orientation bins over 180 deg. A perfectly isotropic
 *               field gives 6/36 = 0.167. A tile lattice gives two spikes.
 *   hf/mf/lf    (c). Std of L in three bands: 1-3px, 3-12px, 12-48px.
 *   flatShare   (c). Share of pixels whose local (12px) luma range is under 0.03 —
 *               "one flat fill" made measurable.
 *
 * ── KNOWN-BAD CONTROLS (`--selftest`), every one required to fail the right way ──
 *   CHECKER   perfect 40px checkerboard  -> oriTop2 must be HIGH (>0.5)
 *   ISO       band-limited isotropic noise -> oriTop2 must be near 0.167 (<0.30)
 *   FLAT      constant grey              -> emptyP90 must be MAXIMAL, hf ~ 0
 *   SELF      the same image twice       -> every number byte-identical
 *   ORDER     crops fed in reverse order -> identical per-image rows
 *   BLUR      an image blurred 2px       -> hf must DROP (proves hf sees acuity)
 *
 * Usage:
 *   node tools/tmp/fp_ground.mjs --selftest
 *   node tools/tmp/fp_ground.mjs --ours shots/baseline/match_cand02.png
 *   node tools/tmp/fp_ground.mjs --ours a.png,b.png --json out.json
 *
 * ── WHAT IT FOUND, HEAD 2026-08-06, 8 fresh action frames vs 6 plates ───────────
 *
 *   featShare   ref 24.58 .. 34.94%   ours 15.25 .. 20.69%   NON-OVERLAPPING
 *   lf          ref 0.0498 .. 0.0795  ours 0.0368 .. 0.0432  NON-OVERLAPPING
 *   mf          ref 0.0420 .. 0.0625  ours 0.0325 .. 0.0372  NON-OVERLAPPING
 *   oriTop2     ref 0.292  .. 0.357   ours 0.438  .. 0.571   NON-OVERLAPPING
 *   hf          ref 0.0199 .. 0.0355  ours 0.0275 .. 0.0331  inside
 *
 * ⚠️ Read this ONLY together with `fp_ground_windows.mjs`, which runs the same bands on
 * GROUND-ONLY pixels and finds our ground at or above the reference on every one of
 * them. The two together say the gap is NOT the ground surface: it is how much of the
 * frame has anything standing on it. `featShare` counts pixels whose local contrast
 * exceeds 0.035, which is object-scale, not texture-scale — so this is a props finding,
 * and props are not `floor.ts`'s.
 */
import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const NH = 900;                 // normalisation height
const BX0 = 0.08, BX1 = 0.92;   // central band
const BY0 = 0.15, BY1 = 0.82;
const FTHRESH = 0.035;          // "there is something here" contrast threshold
const FLATWIN = 12;             // px, local-range window for flatShare
const FLATTHRESH = 0.03;

// ── image helpers ───────────────────────────────────────────────────────────────
const LUMA = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Separable box blur repeated 3x ~ Gaussian. radius in px. Float32 in/out. */
function blur(src, w, h, r) {
  if (r < 1) return Float32Array.from(src);
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
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

const std = (a) => {
  let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; m /= a.length;
  let v = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - m; v += d * d; }
  return Math.sqrt(v / a.length);
};
const pct = (a, p) => { const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

/** Exact Euclidean distance transform (Felzenszwalb), squared distances. */
function edt(mask, w, h) {
  const INF = 1e20;
  const f = new Float64Array(Math.max(w, h));
  const d = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : INF;
  const dt1d = (fIn, n, out) => {
    const v = new Int32Array(n), z = new Float64Array(n + 1);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((fIn[q] + q * q) - (fIn[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((fIn[q] + q * q) - (fIn[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      out[q] = (q - v[k]) * (q - v[k]) + fIn[v[k]];
    }
  };
  const col = new Float64Array(h), colOut = new Float64Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = d[y * w + x];
    dt1d(col, h, colOut);
    for (let y = 0; y < h; y++) d[y * w + x] = colOut[y];
  }
  const row = new Float64Array(w), rowOut = new Float64Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = d[y * w + x];
    dt1d(row, w, rowOut);
    for (let x = 0; x < w; x++) d[y * w + x] = Math.sqrt(rowOut[x]);
  }
  return d;
}

// ── the metric ──────────────────────────────────────────────────────────────────
/** @param L Float32Array luma 0..1, w x h. */
function metrics(L, w, h) {
  const b3 = blur(L, w, h, 1);
  const b12 = blur(L, w, h, 5);
  const b48 = blur(L, w, h, 20);
  const hfA = new Float32Array(w * h), mfA = new Float32Array(w * h), lfA = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { hfA[i] = L[i] - b3[i]; mfA[i] = b3[i] - b12[i]; lfA[i] = b12[i] - b48[i]; }

  // emptiness: distance to nearest mid/high-frequency feature
  const feat = new Uint8Array(w * h);
  let featN = 0;
  for (let i = 0; i < w * h; i++) { if (Math.abs(L[i] - b12[i]) > FTHRESH) { feat[i] = 1; featN++; } }
  let emptyP50 = 0, emptyP90 = 0, emptyMax = 0;
  if (featN === 0) { emptyP50 = emptyP90 = emptyMax = Math.hypot(w, h); }
  else {
    const D = edt(feat, w, h);
    emptyP50 = pct(D, 0.5); emptyP90 = pct(D, 0.9); emptyMax = pct(D, 0.999);
  }

  // orientation histogram of gradient magnitude, 36 bins over 180 deg
  const BINS = 36;
  const hist = new Float64Array(BINS);
  let gtot = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (L[i + 1] - L[i - 1]) * 0.5;
      const gy = (L[i + w] - L[i - w]) * 0.5;
      const m = Math.hypot(gx, gy);
      if (m < 0.004) continue;         // ignore flat noise; declared threshold
      let a = Math.atan2(gy, gx);       // -pi..pi
      if (a < 0) a += Math.PI;          // fold to 0..pi (orientation, not direction)
      const bIdx = Math.min(BINS - 1, Math.floor((a / Math.PI) * BINS));
      hist[bIdx] += m; gtot += m;
    }
  }
  let oriTop2 = 0;
  if (gtot > 0) {
    const mass = (c) => hist[(c - 1 + BINS) % BINS] + hist[c] + hist[(c + 1) % BINS];
    let b1 = 0; for (let c = 1; c < BINS; c++) if (mass(c) > mass(b1)) b1 = c;
    let b2 = -1;
    for (let c = 0; c < BINS; c++) {
      const circ = Math.min(Math.abs(c - b1), BINS - Math.abs(c - b1));
      if (circ < 3) continue;
      if (b2 < 0 || mass(c) > mass(b2)) b2 = c;
    }
    oriTop2 = (mass(b1) + (b2 >= 0 ? mass(b2) : 0)) / gtot;
  }

  // flatShare: local 12px luma range under threshold
  const bmin = blur(L, w, h, FLATWIN >> 1); // proxy centre
  let flatN = 0;
  const R = FLATWIN >> 1;
  for (let y = R; y < h - R; y += 2) {
    for (let x = R; x < w - R; x += 2) {
      let lo = 1, hi = 0;
      for (let dy = -R; dy <= R; dy += 3) for (let dx = -R; dx <= R; dx += 3) {
        const v = L[(y + dy) * w + (x + dx)];
        if (v < lo) lo = v; if (v > hi) hi = v;
      }
      if (hi - lo < FLATTHRESH) flatN++;
    }
  }
  const flatTot = Math.ceil((h - 2 * R) / 2) * Math.ceil((w - 2 * R) / 2);
  void bmin;

  return {
    emptyP50: +emptyP50.toFixed(2), emptyP90: +emptyP90.toFixed(2), emptyMax: +emptyMax.toFixed(2),
    featShare: +(featN / (w * h)).toFixed(4),
    oriTop2: +oriTop2.toFixed(4),
    hf: +std(hfA).toFixed(5), mf: +std(mfA).toFixed(5), lf: +std(lfA).toFixed(5),
    flatShare: +(flatN / flatTot).toFixed(4),
    w, h,
  };
}

async function loadBand(path) {
  const meta = await sharp(path).metadata();
  const nw = Math.round((meta.width / meta.height) * NH);
  const { data, info } = await sharp(path).resize(nw, NH, { fit: 'fill' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const x0 = Math.round(info.width * BX0), x1 = Math.round(info.width * BX1);
  const y0 = Math.round(info.height * BY0), y1 = Math.round(info.height * BY1);
  const w = x1 - x0, h = y1 - y0;
  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y + y0) * info.width + (x + x0)) * 3;
      L[y * w + x] = LUMA(data[s], data[s + 1], data[s + 2]);
    }
  }
  return { L, w, h, src: `${meta.width}x${meta.height}` };
}

// ── selftest ────────────────────────────────────────────────────────────────────
function synth(kind, w = 900, h = 600) {
  const L = new Float32Array(w * h);
  let s = 12345;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0.5;
    if (kind === 'CHECKER') v = ((x / 40 | 0) + (y / 40 | 0)) % 2 ? 0.35 : 0.65;
    else if (kind === 'ISO') v = 0.5;
    else if (kind === 'FLAT') v = 0.5;
    L[y * w + x] = v;
  }
  if (kind === 'ISO') {
    // band-limited isotropic noise: white noise blurred to ~4px, gained up
    const n = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) n[i] = rnd();
    const bl = blur(n, w, h, 2);
    for (let i = 0; i < w * h; i++) L[i] = 0.5 + (bl[i] - 0.5) * 3.0;
  }
  return { L, w, h };
}

async function selftest() {
  let pass = 0, fail = 0;
  const ck = (name, cond, got) => { if (cond) { pass++; console.log(`  PASS  ${name}  ${got}`); } else { fail++; console.log(`  FAIL  ${name}  ${got}`); } };

  const chk = synth('CHECKER'); const mChk = metrics(chk.L, chk.w, chk.h);
  ck('CHECKER oriTop2 > 0.50', mChk.oriTop2 > 0.50, `oriTop2=${mChk.oriTop2}`);
  const iso = synth('ISO'); const mIso = metrics(iso.L, iso.w, iso.h);
  ck('ISO oriTop2 < 0.30 (isotropic ~0.167)', mIso.oriTop2 < 0.30, `oriTop2=${mIso.oriTop2}`);
  ck('CHECKER oriTop2 > ISO oriTop2', mChk.oriTop2 > mIso.oriTop2, `${mChk.oriTop2} > ${mIso.oriTop2}`);
  const flat = synth('FLAT'); const mFlat = metrics(flat.L, flat.w, flat.h);
  ck('FLAT emptyP90 maximal', mFlat.emptyP90 > 500, `emptyP90=${mFlat.emptyP90}`);
  ck('FLAT hf ~ 0', mFlat.hf < 1e-6, `hf=${mFlat.hf}`);
  ck('FLAT flatShare = 1', mFlat.flatShare > 0.999, `flatShare=${mFlat.flatShare}`);
  ck('CHECKER emptyP90 small', mChk.emptyP90 < 40, `emptyP90=${mChk.emptyP90}`);
  ck('ISO flatShare < CHECKER-free floor', mIso.flatShare < 0.5, `flatShare=${mIso.flatShare}`);

  // SELF-PAIR + ORDER, on a real image
  const probe = 'reference/images/curated/gameplay_topdown/bs_04.png';
  const a = await loadBand(probe); const m1 = metrics(a.L, a.w, a.h);
  const b = await loadBand(probe); const m2 = metrics(b.L, b.w, b.h);
  ck('SELF-PAIR identical', JSON.stringify(m1) === JSON.stringify(m2), 'json equal');

  // BLUR must drop hf — proves hf actually measures acuity
  const meta = await sharp(probe).metadata();
  const nw = Math.round((meta.width / meta.height) * NH);
  const { data, info } = await sharp(probe).resize(nw, NH, { fit: 'fill' }).blur(2).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const x0 = Math.round(info.width * BX0), x1 = Math.round(info.width * BX1);
  const y0 = Math.round(info.height * BY0), y1 = Math.round(info.height * BY1);
  const w = x1 - x0, h = y1 - y0; const Lb = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y + y0) * info.width + (x + x0)) * 3;
    Lb[y * w + x] = LUMA(data[s], data[s + 1], data[s + 2]);
  }
  const mb = metrics(Lb, w, h);
  ck('BLUR drops hf', mb.hf < m1.hf * 0.9, `${mb.hf} < ${m1.hf}`);
  ck('BLUR raises emptyP90', mb.emptyP90 >= m1.emptyP90, `${mb.emptyP90} >= ${m1.emptyP90}`);

  console.log(`\n  fp_ground selftest: ${pass} pass, ${fail} fail`);
  if (fail) process.exit(1);
}

// ── main ────────────────────────────────────────────────────────────────────────
if (has('selftest')) { await selftest(); process.exit(0); }

const refDir = arg('refs', 'reference/images/curated/gameplay_topdown');
const refs = (await readdir(refDir)).filter((f) => /^bs_\d+\.png$/.test(f)).sort().map((f) => join(refDir, f));
const ours = String(arg('ours', '')).split(',').filter(Boolean);

const rows = [];
console.log('  image                                 src        emptyP50 emptyP90  feat%   oriTop2      hf      mf      lf  flat%');
for (const [tag, list] of [['REF', refs], ['OURS', ours]]) {
  for (const p of list) {
    const { L, w, h, src } = await loadBand(p);
    const m = metrics(L, w, h);
    rows.push({ tag, path: p, ...m });
    console.log(
      `  ${(tag + ' ' + p.split('/').pop()).padEnd(36)} ${src.padEnd(10)} ` +
      `${String(m.emptyP50).padStart(8)} ${String(m.emptyP90).padStart(8)} ` +
      `${(m.featShare * 100).toFixed(2).padStart(6)} ${String(m.oriTop2).padStart(8)} ` +
      `${m.hf.toFixed(5).padStart(7)} ${m.mf.toFixed(5).padStart(7)} ${m.lf.toFixed(5).padStart(7)} ` +
      `${(m.flatShare * 100).toFixed(1).padStart(6)}`
    );
  }
}
const band = (key) => {
  const r = rows.filter((x) => x.tag === 'REF').map((x) => x[key]);
  const o = rows.filter((x) => x.tag === 'OURS').map((x) => x[key]);
  if (!o.length) return;
  const f = (v) => (typeof v === 'number' ? v.toFixed(v < 1 ? 4 : 2) : v);
  console.log(`  ${key.padEnd(10)} ref ${f(Math.min(...r))} .. ${f(Math.max(...r))} (median ${f(r.slice().sort((a, b) => a - b)[r.length >> 1])})   ours ${f(Math.min(...o))} .. ${f(Math.max(...o))}`);
};
console.log('\n  ── band comparison ──');
for (const k of ['emptyP50', 'emptyP90', 'featShare', 'oriTop2', 'hf', 'mf', 'lf', 'flatShare']) band(k);

const outJson = arg('json');
if (outJson) { await writeFile(outJson, JSON.stringify(rows, null, 2)); console.log(`\n  wrote ${outJson}`); }
