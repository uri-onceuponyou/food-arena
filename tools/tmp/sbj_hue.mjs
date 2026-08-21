#!/usr/bin/env node
/**
 * SBJ_HUE — IS THE FRAME A HUE SPIKE, AND IS THAT DIFFERENT FROM THE REFERENCE?
 *
 * ── The claim being tested ──────────────────────────────────────────────────────
 * A panel reported, on a frozen 2026-08-05 capture: *"94.34% of the frame's CHROMATIC
 * pixels sit in ONE 35-degree hue band (315-350); 72.01% in a single decade; circular
 * concentration R > 0.995 — this is not a wide distribution with a peak, it is a
 * spike."* The prescription attached to it was "spread the hues".
 *
 * 🚨 **A CONCENTRATION NUMBER WITH NO REFERENCE ARM IS NOT A DEFECT, IT IS A
 * DESCRIPTION.** The whole genre is hyper-saturated and key-lit; if the reference
 * plates measure the same way, the spike is what the look IS and "spread the hues"
 * would be moving away from the target, not toward it. `docs/LESSONS.md` §8's standing
 * scar is three critics unanimously prescribing a change the measurement forbade. So
 * this runs the identical statistic on OURS and on the six curated plates, and the
 * reference arm is not optional.
 *
 * ── 🚨 REFERENCE PLATES ARE THIRD-PARTY AND THIS REPO IS PUBLIC ─────────────────
 * Numbers only — hue angles, shares, concentrations. Never what a plate depicts.
 *
 * ── Definitions, chosen to be COMMENSURABLE with `tools/arena-scan.mjs` ─────────
 *   hue, sat   HSL, `arena-scan.mjs:rgbToHsl` restated
 *   achromatic HSL saturation < 0.15 — `arena-scan.mjs:GREY_GATE`, "greys carry no
 *              hue opinion". Quoting a different gate would make every share here
 *              incomparable with every share that tool has ever recorded.
 *   crop       `fp_ground_windows.loadBand` — resize to height 900, then the central
 *              band x∈[0.08,0.92], y∈[0.15,0.82]. IDENTICAL on both sides, and it
 *              removes most (not all) HUD on both. Our HUD furniture is dark violet,
 *              i.e. it sits INSIDE the very band under test, so leaving it in would
 *              inflate the number this file exists to check.
 *   win35      the largest share of CHROMATIC pixels inside any 35 deg circular
 *              window, found by sliding at 1 deg. Not "the top bin" — a fixed 30 deg
 *              binning can split a spike across two bins and read as spread.
 *   R          circular concentration |sum e^{i theta}| / N over chromatic pixels.
 *
 * ── KNOWN-BAD CONTROLS (`--selftest`), rule 6 ───────────────────────────────────
 *   SPIKE      a single-hue field           -> win35 = 1.000, R > 0.999
 *   WHEEL      hues uniform over 0..360     -> win35 ~ 35/360 = 0.097, and R equals
 *              the CLOSED FORM sin(D/2)/(D/2) for the arc the crop leaves (D=302.4 deg
 *              -> 0.1826), NOT ~0. A `< 0.02` threshold was written first and the tool
 *              failed it correctly.
 *   TWO        two spikes 180 deg apart     -> win35 ~ 0.50 and R < 0.05  (R alone
 *              CANNOT see this case — it reads as spread. Both numbers or neither.)
 *   GREY       a fully desaturated field    -> achromatic = 1.000 and the tool must
 *              REFUSE rather than divide by zero over an empty chromatic set
 *   SELF-PAIR  the same image twice         -> bit-identical
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readdir, mkdir } from 'node:fs/promises';
import { loadBand } from './fp_ground_windows.mjs';

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PLATES = join(ROOT, 'reference/images/curated/gameplay_topdown');
const OUT = join(ROOT, 'tools/tmp/sbj_out');
const GREY_GATE = 0.15;          // `arena-scan.mjs:GREY_GATE` — do not re-choose it here
const WIN = 35, DEC = 10;

/** `tools/arena-scan.mjs:rgbToHsl`, restated so both tools agree by construction. */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h, s, l };
}

/** Largest share of `hist` (360 bins, already normalised) in any `deg`-wide circular window. */
function bestWindow(hist, deg) {
  let acc = 0;
  for (let i = 0; i < deg; i++) acc += hist[i];
  let best = acc, at = 0;
  for (let s = 1; s < 360; s++) {
    acc += hist[(s + deg - 1) % 360] - hist[(s - 1) % 360];
    if (acc > best) { best = acc; at = s; }
  }
  return { share: best, from: at, to: (at + deg) % 360 };
}

export function hueStats(rgb, w, h) {
  const hist = new Float64Array(360);
  let chromatic = 0, total = w * h, sx = 0, sy = 0;
  for (let i = 0; i < total; i++) {
    const { h: hh, s } = rgbToHsl(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    if (s < GREY_GATE) continue;
    chromatic++;
    const b = Math.min(359, Math.floor(hh));
    hist[b]++;
    const a = (hh * Math.PI) / 180;
    sx += Math.cos(a); sy += Math.sin(a);
  }
  // rule 6: a fully achromatic frame has an EMPTY chromatic set. Every share below
  // would be 0/0 and every `.every()` over it would be true. Refuse instead.
  if (chromatic === 0) return { refused: 'no chromatic pixels — an empty set is not a distribution', achroShare: 1, total };
  for (let i = 0; i < 360; i++) hist[i] /= chromatic;
  const w35 = bestWindow(hist, WIN), w10 = bestWindow(hist, DEC);
  const R = Math.hypot(sx, sy) / chromatic;
  return {
    total, chromatic, achroShare: 1 - chromatic / total,
    win35: w35.share, win35From: w35.from, win35To: w35.to,
    win10: w10.share, win10From: w10.from, win10To: w10.to,
    R,
    // the same window expressed against the WHOLE frame, which is the form the claim used
    win35OfFrame: w35.share * (chromatic / total),
  };
}

async function measure(path) {
  const { rgb, w, h, src } = await loadBand(path, false);
  return { path, src, ...hueStats(rgb, w, h) };
}

async function selftest() {
  const fails = [];
  const ok = (n, c, d) => { if (!c) fails.push(n); console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); };
  await mkdir(OUT, { recursive: true });
  const W = 600, H = 400;
  const build = (fn) => {
    const buf = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W + x) * 3;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
    return buf;
  };
  const hsv = (hDeg) => {                       // full-chroma, mid-value
    const c = 1, x = c * (1 - Math.abs(((hDeg / 60) % 2) - 1));
    const seg = Math.floor(hDeg / 60) % 6;
    const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
    return t.map((v) => Math.round(v * 220));
  };
  const write = async (name, buf) => {
    const p = join(OUT, `selftest_hue_${name}.png`);
    await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(p);
    return p;
  };
  const pSpike = await write('spike', build(() => hsv(330)));
  const pWheel = await write('wheel', build((x) => hsv((x / W) * 360)));
  const pTwo = await write('two', build((x) => hsv(x < W / 2 ? 20 : 200)));
  const pGrey = await write('grey', build(() => [128, 128, 128]));

  const s = await measure(pSpike), wl = await measure(pWheel), tw = await measure(pTwo), gr = await measure(pGrey);
  ok('SPIKE win35 = 1.000', !s.refused && s.win35 > 0.999, s.refused ?? `win35 ${s.win35.toFixed(4)} R ${s.R.toFixed(4)}`);
  ok('SPIKE R > 0.999', !s.refused && s.R > 0.999, s.refused ?? `R ${s.R.toFixed(5)}`);
  ok('WHEEL win35 ~ 0.097 (+-0.03)', !wl.refused && Math.abs(wl.win35 - 35 / 360) < 0.03, wl.refused ?? `win35 ${wl.win35.toFixed(4)}`);
  // ⚠️ NOT "R ~ 0". The band crop keeps x in [0.08,0.92], so a wheel painted across x
  // arrives as a UNIFORM ARC of 0.84*360 = 302.4 deg, not a full circle, and a uniform
  // arc has a CLOSED-FORM concentration R = sin(D/2)/(D/2). At D = 302.4 deg that is
  // 0.1834. The first version of this arm asserted R < 0.02, FAILED at 0.18256, and the
  // instrument was right: the threshold was a guess and the crop is real. Replaced with
  // the known ANSWER rather than a known-bad threshold — this arm now fails if the crop
  // geometry ever changes, which a `< 0.02` could never have detected.
  {
    const D = (0.92 - 0.08) * 2 * Math.PI;
    const expect = Math.sin(D / 2) / (D / 2);
    ok(`WHEEL R = sin(D/2)/(D/2) = ${expect.toFixed(4)} for the cropped arc (+-0.01)`,
      !wl.refused && Math.abs(wl.R - expect) < 0.01, wl.refused ?? `R ${wl.R.toFixed(5)}`);
  }
  ok('MOVES SPIKE win35 > WHEEL win35', !s.refused && !wl.refused && s.win35 > wl.win35 * 5, `${s.win35.toFixed(3)} vs ${wl.win35.toFixed(3)}`);
  ok('TWO win35 ~ 0.50 (two spikes, R blind to it)', !tw.refused && Math.abs(tw.win35 - 0.5) < 0.05 && tw.R < 0.05,
    tw.refused ?? `win35 ${tw.win35.toFixed(4)} R ${tw.R.toFixed(4)}`);
  ok('GREY refused, not divided by zero', !!gr.refused && gr.achroShare === 1, gr.refused ?? 'it returned numbers');
  const a = await measure(pSpike), b = await measure(pSpike);
  ok('SELF-PAIR identical', JSON.stringify(a) === JSON.stringify(b));
  console.log(`\n  sbj_hue selftest: ${8 - fails.length} pass, ${fails.length} fail`);
  return fails.length;
}

async function main() {
  if (has('selftest')) { process.exitCode = (await selftest()) ? 1 : 0; return; }
  const ours = String(arg('ours', join(ROOT, 'shots/q1/cap/match_donut_taco_05.png'))).split(',').filter(Boolean);
  const plates = existsSync(PLATES)
    ? (await readdir(PLATES)).filter((f) => f.endsWith('.png')).sort().map((f) => join(PLATES, f)) : [];
  if (!plates.length) throw new Error('no reference plates — a concentration number with no reference arm is a description, not a defect');

  const rows = [];
  for (const p of plates) rows.push({ side: 'REF', ...(await measure(p)) });
  for (const p of ours) rows.push({ side: 'OURS', ...(await measure(p)) });

  console.log('\n  side  image                              achro%   win35%  band       win10%  decade     R');
  for (const r of rows) {
    if (r.refused) { console.log(`  ${r.side.padEnd(5)} ${r.path.split('/').pop().padEnd(30)}  REFUSED: ${r.refused}`); continue; }
    console.log(`  ${r.side.padEnd(5)} ${r.path.split('/').pop().padEnd(30)} ${(r.achroShare * 100).toFixed(2).padStart(6)} `
      + `${(r.win35 * 100).toFixed(2).padStart(8)}  ${String(r.win35From).padStart(3)}-${String(r.win35To).padEnd(4)} `
      + `${(r.win10 * 100).toFixed(2).padStart(7)}  ${String(r.win10From).padStart(3)}-${String(r.win10To).padEnd(4)} ${r.R.toFixed(4).padStart(7)}`);
  }
  const refs = rows.filter((r) => r.side === 'REF' && !r.refused);
  const us = rows.filter((r) => r.side === 'OURS' && !r.refused);
  if (!refs.length || !us.length) throw new Error('a side is empty — refusing to compare');
  console.log('\n  ── comparison ──');
  for (const [k, label] of [['win35', 'share of chromatic px in the best 35 deg window'], ['win10', 'best decade'], ['R', 'circular concentration'], ['achroShare', 'achromatic share']]) {
    const rv = refs.map((r) => r[k]).sort((a, b) => a - b);
    const ov = us.map((r) => r[k]).sort((a, b) => a - b);
    const om = ov[ov.length >> 1];
    console.log(`  ${label.padEnd(48)} ref ${rv[0].toFixed(4)} .. ${rv[rv.length - 1].toFixed(4)}   ours ${ov[0].toFixed(4)} .. ${ov[ov.length - 1].toFixed(4)}   `
      + `${om >= rv[0] && om <= rv[rv.length - 1] ? 'INSIDE' : 'OUTSIDE'}`);
  }
}

if (IS_MAIN) await main();
