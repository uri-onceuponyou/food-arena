#!/usr/bin/env node
/**
 * SBJ_BANDS — THE SAME BAND STATISTICS, ON THE PIXELS THAT ARE **NOT** GROUND.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * Two validated instruments, both run on the exact panel the q1 `new/arena` critics
 * scored (`shots/q1/cap/match_donut_taco_05.png`), disagree in a way that localises
 * the arena's blind-score gap:
 *
 *   `fp_ground.mjs`          WHOLE FRAME   ours mf 0.0390 lf 0.0424, both BELOW the
 *                                          reference band's floor (0.0420 / 0.0498)
 *   `fp_ground_windows.mjs`  GROUND ONLY   ours mf 0.02821 hf 0.01905, both ABOVE the
 *                                          reference band's ceiling (0.02414 / 0.01005)
 *
 * A frame whose GROUND carries more mid- and high-band detail than every plate, and
 * whose WHOLE FRAME carries less, has its deficit somewhere other than the ground.
 * That is an arithmetic inference from two tools. This makes it a MEASUREMENT: it runs
 * the identical band statistics over the COMPLEMENT of the same ground mask.
 *
 * It matters because the two obvious arena hypotheses are already null — frame choice
 * (`9585ed6`, paired mean 0.000) and density (`fd76ef0`, +0.00 across a near doubling
 * of footprint share) — and the third, "treat the ground surface", is refuted by
 * `fp_ground_windows` before it is attempted: our ground is already out of band on the
 * HIGH side, so texturing it further moves us AWAY from the reference.
 *
 * ⚠️ **WHAT THIS TOOL FOUND FIRST, AND THE CORRECTION THAT HALVED IT.** Kept in full
 * because the correction is the more useful half. On the SCORED PANEL alone (n=1) the
 * non-ground window arm reads mf **0.40x** and lf **0.25x** of the reference median —
 * which reads like a defect of the arena. Re-run against an 18-station `arena-scan`
 * sweep of the same commit it reads mf **0.80x** and lf **0.76x**, both INSIDE the
 * reference range, with the pixel arm at 0.65x / 0.73x outside it.
 *
 * **The map's typical frame is near the band; the SCORED panel is the outlier.** That is
 * `867d1c0`'s finding arriving down a different instrument — that panel is bottom-decile
 * for cover count (2 of 111) AND for the detail carried by what stands on the ground.
 * **Never quote this tool from one frame.** n=1 here is a frame, not an arena.
 *
 * ── 🚨 REFERENCE PLATES ARE THIRD-PARTY AND THIS REPO IS PUBLIC ─────────────────
 * Numbers only. Describe the compositional ROLE, never the artwork.
 *
 * ── Method ──────────────────────────────────────────────────────────────────────
 * `loadBand` and `analyse` are IMPORTED from `fp_ground_windows.mjs`, not copied — the
 * mask, the clustering, the morphological close and the normalisation are the same
 * code on both sides, which is the whole comparability argument. Only the window
 * SELECTION is inverted:
 *
 *   ground window      >= 92% of its pixels inside the ground mask   (the original)
 *   non-ground window  >= 92% of its pixels OUTSIDE it               (this file)
 *
 * ⚠️ `fp_ground_windows.mjs` reads `--k/--dist/--win` at MODULE SCOPE, so importing it
 * hands it THIS process's argv. None of those flag names are used here, deliberately —
 * `AGENT-BRIEF` §3 records a tool whose `--selftest` ran a different tool's selftest
 * for exactly that reason.
 *
 * ⚠️ The band crop is x∈[0.08,0.92], y∈[0.15,0.82], so most HUD is already outside it,
 * but not all — and the reference plates carry their own HUDs too (`INDEX.md`). The
 * crop is identical on both sides, so the residual is symmetric. Declared, not hidden.
 *
 * ── KNOWN-GOOD + KNOWN-BAD (`--selftest`), rule 6 ───────────────────────────────
 *   REPRODUCES   this file's band code must reproduce `fp_ground_windows`'s own GROUND
 *                medians on a real plate to 1e-9. A re-implementation that does not is
 *                a copied driver with a bug, and every non-ground number it prints
 *                would be void.  <- this is the arm that matters
 *   MOVES        a synthetic frame with a FLAT ground and a DETAILED non-ground band
 *                must report nonGround.mf > ground.mf, and the swap must reverse it
 *   NON-EMPTY    both window sets asserted non-empty BEFORE any median is taken.
 *                `[].every()` is `true` and `med([])` is `NaN`; six instruments on this
 *                project have been caught passing on a set a fix had emptied
 *   SELF-PAIR    the same image twice is bit-identical
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { loadBand, analyse } from './fp_ground_windows.mjs';

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PLATES = join(ROOT, 'reference/images/curated/gameplay_topdown');

// Must match `fp_ground_windows.mjs`'s defaults exactly — they are what the imported
// `analyse()` used to build the mask this file inverts.
const WIN = 132, WINH = Math.round(132 / 1.5), STRIDE = Math.round(132 / 3), PURE = 0.92;

const LUMA = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function blur(src, w, h, r) {
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
const mask0 = (m, i) => (m[i] ? 1 : 0);
const std = (a) => {
  let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; m /= a.length;
  let v = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - m; v += d * d; }
  return Math.sqrt(v / a.length);
};
const med = (a) => { if (!a.length) throw new Error('med([]) — an empty set is not a measurement'); const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

/** Band stds of one w x h luma tile. Same radii as `fp_ground_windows.tileMetrics`. */
export function bands(L, w, h) {
  const b3 = blur(L, w, h, 1), b12 = blur(L, w, h, 5), b48 = blur(L, w, h, 20);
  const hfA = new Float32Array(w * h), mfA = new Float32Array(w * h), lfA = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { hfA[i] = L[i] - b3[i]; mfA[i] = b3[i] - b12[i]; lfA[i] = b12[i] - b48[i]; }
  return { hf: std(hfA), mf: std(mfA), lf: std(lfA) };
}

/**
 * Ground and NON-ground window medians for one image, off ONE shared mask.
 * `want` is 'ground' (>= PURE inside) or 'nonground' (>= PURE outside).
 */
export function windowBands(rgb, w, h, mask) {
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = LUMA(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  const G = { hf: [], mf: [], lf: [] }, N = { hf: [], mf: [], lf: [] };
  for (let wy = 0; wy + WINH <= h; wy += STRIDE) {
    for (let wx = 0; wx + WIN <= w; wx += STRIDE) {
      let g = 0;
      for (let y = 0; y < WINH; y++) for (let x = 0; x < WIN; x++) g += mask[(wy + y) * w + wx + x];
      const frac = g / (WIN * WINH);
      const into = frac >= PURE ? G : (frac <= 1 - PURE ? N : null);
      if (!into) continue;
      const tile = new Float32Array(WIN * WINH);
      for (let y = 0; y < WINH; y++) for (let x = 0; x < WIN; x++) tile[y * WIN + x] = L[(wy + y) * w + wx + x];
      const m = bands(tile, WIN, WINH);
      into.hf.push(m.hf); into.mf.push(m.mf); into.lf.push(m.lf);
    }
  }
  return { G, N };
}

/**
 * PIXEL-WISE band std over the mask and its complement.
 *
 * Why this exists alongside `windowBands`: a 132x88 window that is >=92% NON-ground
 * simply does not occur on some plates (`bs_04` yields **0**), and a statistic that
 * silently has no sample on one arm is this project's most-repeated instrument
 * failure. This runs the band decomposition over the WHOLE crop once and then takes
 * the std over each pixel set, so n is every pixel rather than every pure window.
 *
 * ⚠️ Band pixels within ~20 px of a mask boundary mix both sides. That is exactly how
 * `fp_ground_windows`'s own `groundFeat` is computed, it is symmetric across the two
 * sides, and it is declared rather than hidden. The window arm is the pure-but-small-n
 * cross-check; when the two disagree, say so instead of picking one.
 */
export function pixelBands(rgb, w, h, mask) {
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = LUMA(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  const b3 = blur(L, w, h, 1), b12 = blur(L, w, h, 5), b48 = blur(L, w, h, 20);
  const pick = (want) => {
    const hfA = [], mfA = [], lfA = [];
    for (let i = 0; i < w * h; i++) {
      if ((mask[i] ? 1 : 0) !== want) continue;
      hfA.push(L[i] - b3[i]); mfA.push(b3[i] - b12[i]); lfA.push(b12[i] - b48[i]);
    }
    if (hfA.length === 0) return null;   // rule 6: never quantify over an empty set
    return { n: hfA.length, hf: std(Float32Array.from(hfA)), mf: std(Float32Array.from(mfA)), lf: std(Float32Array.from(lfA)) };
  };
  return { ground: pick(1), nonGround: pick(0) };
}

async function measure(path) {
  const { rgb, w, h, src } = await loadBand(path, false);
  const res = analyse(rgb, w, h);
  const { G, N } = windowBands(rgb, w, h, res.mask);
  // rule 6: assert BEFORE quantifying. An empty set makes every median NaN and every
  // `.every()` true, and that is how six instruments here reported a confident nothing.
  const out = { path, src, maskShare: res.maskShare, nG: G.hf.length, nN: N.hf.length };
  out.ground = G.hf.length ? { hf: med(G.hf), mf: med(G.mf), lf: med(G.lf) } : null;
  out.nonGround = N.hf.length ? { hf: med(N.hf), mf: med(N.mf), lf: med(N.lf) } : null;
  const px = pixelBands(rgb, w, h, res.mask);
  out.pxGround = px.ground; out.pxNonGround = px.nonGround;
  return out;
}

// ── selftest ────────────────────────────────────────────────────────────────────
async function selftest() {
  const fails = [];
  const ok = (n, c, d) => { if (!c) fails.push(n); console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); };

  // REPRODUCES — the arm that matters. `fp_ground_windows.mjs` prints its own ground
  // medians; this file must reproduce them from the same mask with its own band code.
  const plate = join(PLATES, 'bs_04.png');
  if (!existsSync(plate)) { ok('REPRODUCES (plate present)', false, 'no plate on disk'); }
  else {
    const { rgb, w, h } = await loadBand(plate, false);
    const res = analyse(rgb, w, h);
    const { G } = windowBands(rgb, w, h, res.mask);
    const mine = { hf: med(G.hf), mf: med(G.mf), lf: med(G.lf) };
    const theirs = { hf: res.hf, mf: res.mf, lf: res.lf };
    const d = Math.max(Math.abs(mine.hf - theirs.hf), Math.abs(mine.mf - theirs.mf), Math.abs(mine.lf - theirs.lf));
    ok('REPRODUCES fp_ground_windows ground medians to 1e-9', d < 1e-9,
      `max |d| ${d.toExponential(2)}  mine mf ${mine.mf.toFixed(5)} theirs ${theirs.mf.toFixed(5)}`);
    ok('REPRODUCES window count matches', G.hf.length === res.windows, `${G.hf.length} vs ${res.windows}`);
  }

  // MOVES — an ABLATION on REAL pixels, not a synthetic. A first version used a
  // synthetic frame with a flat ground and one coloured stripe, and it FAILED its own
  // NON-EMPTY arm: the stripe became one of the three heaviest colour buckets and was
  // adopted as a ground cluster, so there were zero non-ground windows. That is the
  // exact trap `fp_ground_windows.loadBand`'s own `paint` control documents. Kept as a
  // note because the fix — ablate real pixels through a mask computed ONCE from the
  // unmodified image — is the only construction that cannot be gamed that way.
  if (existsSync(plate)) {
    const { rgb, w, h } = await loadBand(plate, false);
    const res = analyse(rgb, w, h);                // the mask, from the UNMODIFIED image
    const base = pixelBands(rgb, w, h, res.mask);

    const blurSide = (want) => {                   // blur only pixels where mask===want
      const L = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) L[i] = LUMA(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
      const soft = blur(L, w, h, 6);
      const out = new Uint8Array(w * h * 3);
      for (let i = 0; i < w * h; i++) {
        const on = (mask0(res.mask, i) === want);
        const v = on ? Math.max(0, Math.min(255, Math.round(soft[i] * 255))) : null;
        if (v === null) { out[i * 3] = rgb[i * 3]; out[i * 3 + 1] = rgb[i * 3 + 1]; out[i * 3 + 2] = rgb[i * 3 + 2]; }
        else { out[i * 3] = v; out[i * 3 + 1] = v; out[i * 3 + 2] = v; }
      }
      return pixelBands(out, w, h, res.mask);      // SAME mask, deliberately
    };
    const nbBlur = blurSide(0);                    // non-ground softened
    const gBlur = blurSide(1);                     // ground softened

    ok('NON-EMPTY pixel arm, both sides present', !!base.ground && !!base.nonGround,
      base.ground && base.nonGround ? `nG ${base.ground.n} nN ${base.nonGround.n}` : 'a side was empty');
    ok('MOVES softening NON-GROUND drops nonGround.mf',
      base.nonGround && nbBlur.nonGround && nbBlur.nonGround.mf < base.nonGround.mf * 0.8,
      `${nbBlur.nonGround.mf.toFixed(5)} < ${(base.nonGround.mf * 0.8).toFixed(5)}`);
    ok('HOLDS softening NON-GROUND leaves ground.mf within 15%',
      base.ground && nbBlur.ground && Math.abs(nbBlur.ground.mf - base.ground.mf) / base.ground.mf < 0.15,
      `${nbBlur.ground.mf.toFixed(5)} vs ${base.ground.mf.toFixed(5)}`);
    ok('ORDERS softening GROUND drops ground.mf instead',
      base.ground && gBlur.ground && gBlur.ground.mf < base.ground.mf * 0.8,
      `${gBlur.ground.mf.toFixed(5)} < ${(base.ground.mf * 0.8).toFixed(5)}`);
  }

  // SELF-PAIR
  if (existsSync(plate)) {
    const a = await measure(plate), b = await measure(plate);
    ok('SELF-PAIR identical', JSON.stringify(a) === JSON.stringify(b));
  }

  console.log(`\n  sbj_bands selftest: ${7 - fails.length} pass, ${fails.length} fail`);
  return fails.length;
}

async function main() {
  if (has('selftest')) { process.exitCode = (await selftest()) ? 1 : 0; return; }
  const oursArg = arg('ours', join(ROOT, 'shots/q1/cap/match_donut_taco_05.png'));
  const ours = oursArg.split(',').filter(Boolean);
  const plates = existsSync(PLATES)
    ? (await readdir(PLATES)).filter((f) => f.endsWith('.png')).sort().map((f) => join(PLATES, f))
    : [];
  if (plates.length === 0) throw new Error('no reference plates — an empty reference set is not a comparison');

  const rows = [];
  for (const p of [...plates, ...ours]) rows.push({ ...(await measure(p)), side: plates.includes(p) ? 'REF' : 'OURS' });

  const f = (v) => (v == null ? '   —   ' : v.toFixed(5).padStart(8));
  console.log('\n  ── WINDOW arm (>=92% pure windows; small n, and bs_04 yields ZERO non-ground windows) ──');
  console.log('  side  image                            mask%   nG   nN   GROUND hf/mf/lf                NON-GROUND hf/mf/lf');
  for (const r of rows) {
    console.log(`  ${r.side.padEnd(5)} ${r.path.split('/').pop().padEnd(28)} ${(r.maskShare * 100).toFixed(1).padStart(5)} ${String(r.nG).padStart(4)} ${String(r.nN).padStart(4)}  `
      + `${f(r.ground?.hf)}${f(r.ground?.mf)}${f(r.ground?.lf)}   ${f(r.nonGround?.hf)}${f(r.nonGround?.mf)}${f(r.nonGround?.lf)}`);
  }
  console.log('\n  ── PIXEL arm (every pixel; the primary statistic) ──');
  console.log('  side  image                          nGroundPx  nNonGndPx   GROUND hf/mf/lf                NON-GROUND hf/mf/lf');
  for (const r of rows) {
    console.log(`  ${r.side.padEnd(5)} ${r.path.split('/').pop().padEnd(28)} ${String(r.pxGround?.n ?? 0).padStart(9)} ${String(r.pxNonGround?.n ?? 0).padStart(10)}  `
      + `${f(r.pxGround?.hf)}${f(r.pxGround?.mf)}${f(r.pxGround?.lf)}   ${f(r.pxNonGround?.hf)}${f(r.pxNonGround?.mf)}${f(r.pxNonGround?.lf)}`);
  }

  const band = (label, sel) => {
    const refs = rows.filter((r) => r.side === 'REF' && sel(r));
    const us = rows.filter((r) => r.side === 'OURS' && sel(r));
    if (!refs.length || !us.length) { console.log(`  ${label}: a side has no sample — REFUSING to compare (ref ${refs.length}, ours ${us.length})`); return; }
    console.log(`\n  ── ${label}  (ref n=${refs.length}, ours n=${us.length}) ──`);
    for (const k of ['hf', 'mf', 'lf']) {
      const rv = refs.map((r) => sel(r)[k]).sort((a, b) => a - b);
      const ov = us.map((r) => sel(r)[k]).sort((a, b) => a - b);
      const rmed = rv[rv.length >> 1], omed = ov[ov.length >> 1];
      const inside = omed >= rv[0] && omed <= rv[rv.length - 1];
      console.log(`  ${k.padEnd(3)} ref ${rv[0].toFixed(5)} .. ${rv[rv.length - 1].toFixed(5)} (median ${rmed.toFixed(5)})   `
        + `ours ${ov[0].toFixed(5)} .. ${ov[ov.length - 1].toFixed(5)}   ratio ${(omed / rmed).toFixed(2)}x   ${inside ? 'INSIDE' : 'OUTSIDE'}`);
    }
  };
  band('NON-GROUND, pixel arm', (r) => r.pxNonGround);
  band('GROUND, pixel arm', (r) => r.pxGround);
  band('NON-GROUND, window arm', (r) => r.nonGround);
}

if (IS_MAIN) await main();
