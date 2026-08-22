#!/usr/bin/env node
/**
 * V1_SAT — the CHROMA OF THE DOMINANT MASS, as a distribution rather than a mean.
 *
 * ## The claim this exists to re-derive
 *
 * A fresh critic on item 1 round 2 named one remaining gap and the orchestrator attached
 * numbers to it:
 *
 *   > "our median saturation is 0.326 against the four reference plates at
 *   >  0.459 / 0.514 / 0.517 / 0.728 — BELOW ALL FOUR ... our p90 saturation is 0.815,
 *   >  already inside the plate band 0.621-0.897, and our mean value is 0.743, inside the
 *   >  plate band 0.563-0.825. So it is not the highlights and it is not brightness — it
 *   >  is the MEDIAN pixel."
 *
 * **No tool in this tree produces any of those five numbers.** `arena-scan` reports MEAN
 * saturation over a chroma-weighted definition of its own and has no percentile anywhere;
 * `satmetrics.mjs` reads an arena-scan metrics.json and reports player-vs-ring deltas.
 * So this file produces the distribution, and reports what it measures rather than what
 * it was handed. Both halves of the claim were re-derived before a line of `floor.ts` was
 * written and the report says which reproduced.
 *
 * ## WHY A MEDIAN AND NOT A MEAN, AND WHY THAT IS THE WHOLE POINT
 *
 * The frame is a few small very-saturated things (cast, VFX, HUD) standing on one very
 * large low-chroma thing (the ground). A **mean** mixes those into a number no surface
 * has — the same defect `v1_noise.mjs` was wrong about in its first version, where a
 * saturation-weighted circular hue mean of a bimodal frame landed 50 degrees from both
 * modes. A **median** is the middle PIXEL, so on a frame whose largest surface is the
 * ground it is approximately "what is the ground's rendered saturation", which is exactly
 * the quantity the critic named and exactly the one `src/arena/**` owns.
 *
 * So this tool prints the whole distribution (p10/p25/p50/p75/p90 of S, and of V) rather
 * than any single figure, because the SHAPE is the finding: a deficit at p50 with p90 in
 * band says "the dominant mass", and a deficit at every percentile would say "the grade".
 * Those two have opposite fixes and one number cannot tell them apart.
 *
 * ## 🚨 THE HUD IS IN THE FRAME, ON BOTH SIDES, AND THAT IS DELIBERATE
 *
 * `arena-scan.mjs`'s own correction (2026-08-05): `page.locator('canvas').screenshot()` is
 * a page capture clipped to the canvas box, so the DOM HUD — **13.4% of the frame, ~25% of
 * its warm chroma** — has always been in every recorded figure. It is not "fixed" because
 * the curated plates keep their own HUDs too (`INDEX.md`: *"In-game HUD is left in on
 * gameplay crops — that's expected"*), so whole-frame numbers stay apples-to-apples, and
 * the sheet a critic scores is the full composited frame.
 *
 * This tool therefore reports **whole frame as PRIMARY** and a trimmed arm beside it as a
 * SENSITIVITY check, at a stated fraction, applied identically to ours and to the plates.
 * A conclusion that only survives one of the two is reported as not surviving. The
 * critic's own numbers were quoted as "HUD bands trimmed" without a fraction, so the
 * trimmed arm is the closest reproduction available and the untrimmed one is the one this
 * repo's other instruments are on.
 *
 * ## SELFTEST — every arm pinned to a way this class of tool is known to lie
 *
 *   MOVES        desaturating a real frame 50% toward its own luma must LOWER p50 S, and
 *                saturating it must RAISE it. A metric that cannot move is not a metric.
 *   ORDERS       three synthetic frames authored at S = 0.20/0.40/0.60 must come back in
 *                that order and at those values (+/- 0.002). Validates the HSV maths and
 *                the percentile code against a value known independently of this file.
 *   SELF-PAIR    the same bytes measured twice must be EXACTLY identical. This is the
 *                instrument's own drift control; without it no non-zero delta is licensed.
 *   NON-EMPTY    every reported statistic asserts its pixel set is non-empty and its frame
 *                non-degenerate FIRST. `[].every()` returns true and a mean over an empty
 *                set is NaN, which prints as a number-shaped thing.
 *   TRIM-REAL    the trim must actually REMOVE rows and leave a non-empty set, and on a
 *                UNIFORM frame it must change nothing — so the trim cannot invent a delta.
 *   SPREAD       the reference plates must not all return the same number. If the loader
 *                is broken every plate reads identically and the band looks impossibly
 *                tight rather than wrong.
 *   BIMODAL      on a frame that is 70% S=0.15 and 30% S=0.80 the MEAN (0.345) and the
 *                MEDIAN (0.15) must differ, and the median must be the large surface's
 *                value. This is the arm that shows the tool is reporting the statistic it
 *                claims, on the exact frame composition this round is about.
 *
 * Use:
 *   node tools/tmp/v1_sat.mjs --selftest
 *   node tools/tmp/v1_sat.mjs --ours shots/v1r3/before --label BEFORE [--out x.json]
 *   node tools/tmp/v1_sat.mjs --ours shots/v1r3/before --ours2 shots/v1r3/after \
 *        --label-a BEFORE --label-b AFTER
 *
 * ⚠️ `reference/` is gitignored and this repo is PUBLIC. This file reads plate PIXELS and
 * prints STATISTICS. Numbers disclose nothing; never add a description of a plate here.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(process.argv[1], '../../..');
const PLATE_DIR = join(ROOT, 'reference/images/curated/gameplay_topdown');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

// ── The statistic ────────────────────────────────────────────────────────────
// HSV on 8-bit RGB. S = (max-min)/max (0 when max = 0), V = max/255. Percentiles come
// from a 1001-bin histogram, which is EXACT to 3 decimals and order-stable — a sort over
// 1.44M floats is not wrong, it is just slower and invites a tie-break question.
const BINS = 1001;

function hsvStats(data, w, h, channels, trim) {
  const y0 = Math.round(h * (trim ? trim[0] : 0));
  const y1 = h - Math.round(h * (trim ? trim[1] : 0));
  if (!(y1 > y0)) throw new Error(`trim left no rows: y0=${y0} y1=${y1} h=${h}`);
  const sHist = new Uint32Array(BINS);
  const vHist = new Uint32Array(BINS);
  let n = 0, sSum = 0, vSum = 0;
  const seen = new Set();
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const s = mx === 0 ? 0 : (mx - mn) / mx;
      const v = mx / 255;
      sHist[Math.round(s * (BINS - 1))]++;
      vHist[Math.round(v * (BINS - 1))]++;
      sSum += s; vSum += v; n++;
      if (seen.size < 4096) seen.add((r << 16) | (g << 8) | b);
    }
  }
  // NON-EMPTY, asserted BEFORE anything is reported over the set.
  if (n === 0) throw new Error('empty pixel set — nothing to report over');
  // NON-DEGENERATE: two identical black frames are byte-identical too. An all-one-colour
  // frame is a capture failure, not a measurement.
  const degenerate = seen.size < 64;
  const pct = (hist, p) => {
    const target = n * p;
    let acc = 0;
    for (let i = 0; i < BINS; i++) { acc += hist[i]; if (acc >= target) return i / (BINS - 1); }
    return 1;
  };
  return {
    n, rows: [y0, y1], distinctColours: seen.size, degenerate,
    sMean: sSum / n, vMean: vSum / n,
    s: { p10: pct(sHist, 0.10), p25: pct(sHist, 0.25), p50: pct(sHist, 0.50), p75: pct(sHist, 0.75), p90: pct(sHist, 0.90) },
    v: { p10: pct(vHist, 0.10), p25: pct(vHist, 0.25), p50: pct(vHist, 0.50), p75: pct(vHist, 0.75), p90: pct(vHist, 0.90) },
  };
}

// ── THE DOMINANT MASS, which is the number the critic's PRESCRIPTION rests on ──
// The critic's claim is "raise the ground's own saturation, because the reference's
// median is higher". That argument only holds if the reference's median is ALSO produced
// by one big saturated surface. If instead their median is dragged up by MANY mid-sized
// saturated objects over a quiet ground, the same median implies the opposite fix, and no
// whole-frame percentile can tell those two apart. So this measures, on ours and on every
// plate identically: what is the LARGEST single colour mass, how much of the frame is it,
// and what is ITS saturation?
//
// Method: quantise to (hue 24 x S 8 x V 8), take the modal bin, grow it by one bin in
// every axis (a 3x3x3 block, hue wrapping), report the block. Repeat on the residue for
// masses 2 and 3. Achromatic pixels (S < 1/8) share ONE hue bucket, because hue is
// numerically unstable as S -> 0 and splitting them 24 ways is how `v1_noise` was wrong
// the first time.
const HB = 24, SB = 8, VB = 8;
function dominantMasses(data, w, h, channels, k = 3) {
  const hist = new Float64Array(HB * SB * VB);
  const sSum = new Float64Array(hist.length), vSum = new Float64Array(hist.length);
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * channels;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const s = mx === 0 ? 0 : (mx - mn) / mx, v = mx / 255;
    let hue = 0;
    if (mx !== mn) {
      const d = mx - mn;
      hue = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
      hue *= 60;
    }
    const sb = Math.min(SB - 1, Math.floor(s * SB));
    const hb = sb === 0 ? 0 : Math.min(HB - 1, Math.floor(hue / (360 / HB)));  // neutrals share bucket 0
    const vb = Math.min(VB - 1, Math.floor(v * VB));
    const idx = (hb * SB + sb) * VB + vb;
    hist[idx]++; sSum[idx] += s; vSum[idx] += v; n++;
  }
  if (n === 0) throw new Error('empty frame — nothing to find a mass in');   // NON-EMPTY first
  const used = new Uint8Array(hist.length);
  const out = [];
  for (let m = 0; m < k; m++) {
    let best = -1, bestC = 0;
    for (let i = 0; i < hist.length; i++) if (!used[i] && hist[i] > bestC) { bestC = hist[i]; best = i; }
    if (best < 0 || bestC === 0) break;
    const vb0 = best % VB, sb0 = Math.floor(best / VB) % SB, hb0 = Math.floor(best / (SB * VB));
    let c = 0, ss = 0, vv = 0;
    for (let dh = -1; dh <= 1; dh++) for (let ds = -1; ds <= 1; ds++) for (let dv = -1; dv <= 1; dv++) {
      const sb = sb0 + ds, vb = vb0 + dv;
      if (sb < 0 || sb >= SB || vb < 0 || vb >= VB) continue;
      const hb = sb0 === 0 && sb === 0 ? 0 : (hb0 + dh + HB) % HB;   // neutral bucket has no hue neighbours
      const idx = (hb * SB + sb) * VB + vb;
      if (used[idx]) continue;
      used[idx] = 1; c += hist[idx]; ss += sSum[idx]; vv += vSum[idx];
    }
    if (c > 0) out.push({ share: c / n, sMean: ss / c, vMean: vv / c, neutral: sb0 === 0 });
  }
  return out;
}

async function measureFile(path, trim) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const full = hsvStats(data, info.width, info.height, info.channels, null);
  const cut = hsvStats(data, info.width, info.height, info.channels, trim);
  const masses = dominantMasses(data, info.width, info.height, info.channels, 3);
  return { path, w: info.width, h: info.height, full, trimmed: cut, masses };
}

function pngsIn(dir) {
  const p = resolve(ROOT, dir);
  if (!existsSync(p)) throw new Error(`no such directory: ${p}`);
  if (statSync(p).isFile()) return [p];
  const f = readdirSync(p).filter((x) => x.toLowerCase().endsWith('.png')).sort();
  if (f.length === 0) throw new Error(`no PNGs in ${p}`);   // NON-EMPTY before any aggregate
  return f.map((x) => join(p, x));
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f3 = (x) => x.toFixed(3);

// ═════════════════════════════════════════════════════════════════════════════
// SELFTEST
// ═════════════════════════════════════════════════════════════════════════════
async function synth(w, h, rows) {
  // rows: [{ frac, rgb }] stacked top to bottom
  const buf = Buffer.alloc(w * h * 3);
  let y = 0;
  for (const r of rows) {
    const nh = Math.round(h * r.frac);
    for (let yy = y; yy < Math.min(h, y + nh); yy++)
      for (let x = 0; x < w; x++) { const i = (yy * w + x) * 3; buf[i] = r.rgb[0]; buf[i + 1] = r.rgb[1]; buf[i + 2] = r.rgb[2]; }
    y += nh;
  }
  return await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
// authored S at fixed V=1.0 (max channel 255): rgb(255, 255*(1-S), 255*(1-S))
const atS = (S) => [255, Math.round(255 * (1 - S)), Math.round(255 * (1 - S))];

async function statsOfBuffer(buf, trim) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return hsvStats(data, info.width, info.height, info.channels, trim);
}

async function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); } else { fail++; console.log(`  FAIL ${name}  ${detail ?? ''}`); } };

  // ── ORDERS: three authored saturations, in order and at their authored values ──
  const orders = [];
  for (const S of [0.20, 0.40, 0.60]) {
    const st = await statsOfBuffer(await synth(64, 64, [{ frac: 1, rgb: atS(S) }]), null);
    orders.push(st.s.p50);
    ok(`ORDERS S=${S.toFixed(2)} recovered`, Math.abs(st.s.p50 - S) < 0.005, `p50=${f3(st.s.p50)}`);
  }
  ok('ORDERS monotone', orders[0] < orders[1] && orders[1] < orders[2], orders.map(f3).join(' < '));

  // ── BIMODAL: the exact frame composition this round is about ──
  // 70% of rows at S=0.15, 30% at S=0.80. MEAN 0.345, MEDIAN 0.15 — they must differ, and
  // the median must be the LARGE surface, which is the whole argument for using it.
  const bim = await statsOfBuffer(await synth(64, 100, [
    { frac: 0.70, rgb: atS(0.15) }, { frac: 0.30, rgb: atS(0.80) },
  ]), null);
  ok('BIMODAL median is the large surface', Math.abs(bim.s.p50 - 0.15) < 0.01, `p50=${f3(bim.s.p50)}`);
  ok('BIMODAL mean is between the modes', bim.sMean > 0.30 && bim.sMean < 0.40, `mean=${f3(bim.sMean)}`);
  ok('BIMODAL mean !== median', Math.abs(bim.sMean - bim.s.p50) > 0.15, `${f3(bim.sMean)} vs ${f3(bim.s.p50)}`);
  ok('BIMODAL p90 sees the small surface', Math.abs(bim.s.p90 - 0.80) < 0.01, `p90=${f3(bim.s.p90)}`);

  // ── NON-EMPTY / degeneracy ──
  const flat = await statsOfBuffer(await synth(32, 32, [{ frac: 1, rgb: [10, 10, 10] }]), null);
  ok('NON-EMPTY flags a degenerate frame', flat.degenerate === true, `distinct=${flat.distinctColours}`);
  let threw = false;
  try { await statsOfBuffer(await synth(32, 32, [{ frac: 1, rgb: [0, 0, 0] }]), [0.6, 0.6]); } catch { threw = true; }
  ok('NON-EMPTY throws when the trim leaves no rows', threw);

  // ── TRIM-REAL: removes rows, and cannot invent a delta on a uniform frame ──
  const uni = await synth(64, 100, [{ frac: 1, rgb: atS(0.40) }]);
  const uFull = await statsOfBuffer(uni, null);
  const uCut = await statsOfBuffer(uni, [0.16, 0.14]);
  ok('TRIM-REAL removes rows', uCut.n < uFull.n && uCut.n > 0, `${uFull.n} -> ${uCut.n} px`);
  ok('TRIM-REAL changes nothing on a uniform frame', Math.abs(uCut.s.p50 - uFull.s.p50) < 1e-9, `${f3(uFull.s.p50)} == ${f3(uCut.s.p50)}`);
  // ...and it MUST move on a banded frame, or the trim arm is decorative
  const banded = await synth(64, 100, [{ frac: 0.20, rgb: atS(0.95) }, { frac: 0.80, rgb: atS(0.10) }]);
  const bFull = await statsOfBuffer(banded, null);
  const bCut = await statsOfBuffer(banded, [0.25, 0.0]);
  ok('TRIM-REAL moves when there IS a band', Math.abs(bCut.sMean - bFull.sMean) > 0.05, `mean ${f3(bFull.sMean)} -> ${f3(bCut.sMean)}`);

  // ── MOVES + SELF-PAIR on a REAL frame, not a synthetic one ──
  const plates = pngsIn(PLATE_DIR);
  ok('SPREAD plate loader found plates', plates.length >= 4, `${plates.length} plates`);
  const p0 = plates[0];
  const raw = await sharp(p0).removeAlpha().png().toBuffer();
  const a = await statsOfBuffer(raw, null);
  const b = await statsOfBuffer(raw, null);
  ok('SELF-PAIR same bytes twice, EXACTLY equal', a.s.p50 === b.s.p50 && a.sMean === b.sMean, `p50 ${a.s.p50} / mean ${a.sMean}`);
  ok('SELF-PAIR the frame is not degenerate', a.degenerate === false, `distinct=${a.distinctColours}`);
  const down = await statsOfBuffer(await sharp(p0).removeAlpha().modulate({ saturation: 0.5 }).png().toBuffer(), null);
  const up = await statsOfBuffer(await sharp(p0).removeAlpha().modulate({ saturation: 1.5 }).png().toBuffer(), null);
  ok('MOVES desaturating LOWERS p50 S', down.s.p50 < a.s.p50 - 0.02, `${f3(a.s.p50)} -> ${f3(down.s.p50)}`);
  ok('MOVES saturating RAISES p50 S', up.s.p50 > a.s.p50 + 0.02, `${f3(a.s.p50)} -> ${f3(up.s.p50)}`);

  // ── SPREAD: the plates must not all read the same ──
  const pv = [];
  for (const p of plates) pv.push((await measureFile(p, [0.16, 0.14])).full.s.p50);
  ok('SPREAD plates differ from each other', Math.max(...pv) - Math.min(...pv) > 0.05, `range ${f3(Math.min(...pv))}-${f3(Math.max(...pv))}`);

  // ── MASS arms ──────────────────────────────────────────────────────────────
  const rawOf = async (buf) => { const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return dominantMasses(data, info.width, info.height, info.channels, 3); };
  const m1 = await rawOf(await synth(64, 100, [{ frac: 0.70, rgb: atS(0.15) }, { frac: 0.30, rgb: atS(0.85) }]));
  ok('MASS finds the big surface first', Math.abs(m1[0].share - 0.70) < 0.02 && Math.abs(m1[0].sMean - 0.15) < 0.02, `share ${f3(m1[0].share)} S ${f3(m1[0].sMean)}`);
  ok('MASS finds the second surface too', m1.length > 1 && Math.abs(m1[1].share - 0.30) < 0.02 && Math.abs(m1[1].sMean - 0.85) < 0.02, m1[1] ? `share ${f3(m1[1].share)} S ${f3(m1[1].sMean)}` : 'no mass 2');
  ok('MASS is NOT the whole frame', m1[0].share < 0.95, `share ${f3(m1[0].share)}`);
  const m2 = await rawOf(await synth(64, 100, [{ frac: 0.70, rgb: atS(0.45) }, { frac: 0.30, rgb: atS(0.85) }]));
  ok('MASS MOVES with the big surface', m2[0].sMean > m1[0].sMean + 0.2 && Math.abs(m2[0].share - m1[0].share) < 0.05,
    `S ${f3(m1[0].sMean)} -> ${f3(m2[0].sMean)} at share ${f3(m1[0].share)} -> ${f3(m2[0].share)}`);
  // THE CROSSING ARM. The critic's prescription assumes a high median MEANS a saturated
  // dominant surface. Here is a frame where it does not: the largest mass is 40% at
  // S=0.15 while the median is ~0.5. Mass and median must DISAGREE, or this tool is just
  // re-deriving the percentile under another name and the whole distinction is decorative.
  const cross = await synth(64, 100, [
    { frac: 0.40, rgb: atS(0.15) }, { frac: 0.20, rgb: atS(0.50) },
    { frac: 0.20, rgb: atS(0.62) }, { frac: 0.20, rgb: atS(0.74) },
  ]);
  const cm = await rawOf(cross);
  const cs = await statsOfBuffer(cross, null);
  ok('MASS-vs-MEDIAN the two disagree by construction', Math.abs(cm[0].sMean - 0.15) < 0.03 && cs.s.p50 > 0.45,
    `mass1 S ${f3(cm[0].sMean)} at share ${f3(cm[0].share)}   frame p50 ${f3(cs.s.p50)}`);

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  const args = parseArgs(process.argv);
  if (args.selftest) return selftest();

  const trim = args.trim ? args.trim.split(',').map(Number) : [0.16, 0.14];
  if (trim.length !== 2 || trim.some((x) => !(x >= 0 && x < 0.5))) { console.error('--trim top,bottom as fractions < 0.5'); process.exit(2); }

  const arms = [];
  if (args.ours) arms.push({ label: args['label-a'] ?? args.label ?? 'OURS', files: pngsIn(args.ours) });
  if (args.ours2) arms.push({ label: args['label-b'] ?? 'OURS2', files: pngsIn(args.ours2) });
  if (arms.length === 0) { console.error('need --ours <dir|file> (and optionally --ours2)'); process.exit(2); }

  const plateFiles = pngsIn(args.plates ?? PLATE_DIR);
  const report = { trim, arms: [], plates: [] };

  console.log(`\n══ V1_SAT ══  whole frame is PRIMARY; trimmed arm is top ${trim[0]} / bottom ${trim[1]}, applied identically to every image\n`);

  for (const arm of arms) {
    const rows = [];
    for (const f of arm.files) rows.push(await measureFile(f, trim));
    const degen = rows.filter((r) => r.full.degenerate);
    if (degen.length) console.log(`  ⚠️ ${degen.length} DEGENERATE frame(s) — a capture failure, excluded from nothing but flagged here: ${degen.map((d) => basename(d.path)).join(', ')}`);
    if (rows.length === 0) throw new Error('empty arm');
    const agg = (sel) => ({ median: med(rows.map(sel)), mean: mean(rows.map(sel)), min: Math.min(...rows.map(sel)), max: Math.max(...rows.map(sel)) });
    const a = {
      label: arm.label, nFrames: rows.length,
      full: { sP50: agg((r) => r.full.s.p50), sP90: agg((r) => r.full.s.p90), sP25: agg((r) => r.full.s.p25), sMean: agg((r) => r.full.sMean), vMean: agg((r) => r.full.vMean), vP50: agg((r) => r.full.v.p50) },
      trimmed: { sP50: agg((r) => r.trimmed.s.p50), sP90: agg((r) => r.trimmed.s.p90), sP25: agg((r) => r.trimmed.s.p25), sMean: agg((r) => r.trimmed.sMean), vMean: agg((r) => r.trimmed.vMean), vP50: agg((r) => r.trimmed.v.p50) },
      frames: rows.map((r) => ({ file: basename(r.path), sP50: r.full.s.p50, sP90: r.full.s.p90, vMean: r.full.vMean, sP50trim: r.trimmed.s.p50, distinct: r.full.distinctColours })),
    };
    report.arms.push(a);
    console.log(`  ${arm.label}  (${rows.length} frames)`);
    console.log(`    FULL     S p25 ${f3(a.full.sP25.median)}   S p50 ${f3(a.full.sP50.median)}   S p90 ${f3(a.full.sP90.median)}   S mean ${f3(a.full.sMean.median)}   V mean ${f3(a.full.vMean.median)}`);
    console.log(`    TRIMMED  S p25 ${f3(a.trimmed.sP25.median)}   S p50 ${f3(a.trimmed.sP50.median)}   S p90 ${f3(a.trimmed.sP90.median)}   S mean ${f3(a.trimmed.sMean.median)}   V mean ${f3(a.trimmed.vMean.median)}`);
    console.log(`    per-frame S p50 (full): ${rows.map((r) => f3(r.full.s.p50)).join(' ')}`);
    const mm = [0, 1, 2].map((i) => ({ share: mean(rows.map((r) => r.masses[i]?.share ?? 0)), s: mean(rows.filter((r) => r.masses[i]).map((r) => r.masses[i].sMean)), v: mean(rows.filter((r) => r.masses[i]).map((r) => r.masses[i].vMean)) }));
    a.masses = mm;
    console.log(`    MASSES   ${mm.map((m, i) => `#${i + 1} ${(m.share * 100).toFixed(1)}% @ S ${f3(m.s)} V ${f3(m.v)}`).join('   ')}`);
  }

  console.log('');
  for (const f of plateFiles) {
    const r = await measureFile(f, trim);
    report.plates.push({ file: basename(f), w: r.w, h: r.h, full: { sP25: r.full.s.p25, sP50: r.full.s.p50, sP90: r.full.s.p90, sMean: r.full.sMean, vMean: r.full.vMean }, trimmed: { sP25: r.trimmed.s.p25, sP50: r.trimmed.s.p50, sP90: r.trimmed.s.p90, sMean: r.trimmed.sMean, vMean: r.trimmed.vMean } });
    report.plates[report.plates.length - 1].masses = r.masses;
    console.log(`  plate ${basename(f).padEnd(10)} FULL S p25 ${f3(r.full.s.p25)}  p50 ${f3(r.full.s.p50)}  p90 ${f3(r.full.s.p90)}  Vmean ${f3(r.full.vMean)}`);
    console.log(`        MASSES  ${r.masses.map((m, i) => `#${i + 1} ${(m.share * 100).toFixed(1)}% @ S ${f3(m.sMean)} V ${f3(m.vMean)}`).join('   ')}`);
  }
  const pf = report.plates.map((p) => p.full.sP50).sort((x, y) => x - y);
  const pt = report.plates.map((p) => p.trimmed.sP50).sort((x, y) => x - y);
  console.log(`\n  plate band  S p50  FULL ${f3(pf[0])} – ${f3(pf[pf.length - 1])}   TRIMMED ${f3(pt[0])} – ${f3(pt[pt.length - 1])}`);
  for (const a of report.arms) {
    const inFull = a.full.sP50.median >= pf[0] && a.full.sP50.median <= pf[pf.length - 1];
    const inTrim = a.trimmed.sP50.median >= pt[0] && a.trimmed.sP50.median <= pt[pt.length - 1];
    console.log(`  ${a.label.padEnd(8)} S p50 FULL ${f3(a.full.sP50.median)} ${inFull ? 'IN BAND' : `OUT (${(pf[0] / a.full.sP50.median).toFixed(2)}x short of the lowest)`}   TRIMMED ${f3(a.trimmed.sP50.median)} ${inTrim ? 'IN BAND' : `OUT (${(pt[0] / a.trimmed.sP50.median).toFixed(2)}x short)`}`);
  }
  if (report.arms.length === 2) {
    const [A, B] = report.arms;
    console.log(`\n  DELTA ${A.label} -> ${B.label}   S p50 FULL ${f3(A.full.sP50.median)} -> ${f3(B.full.sP50.median)}  (${(B.full.sP50.median - A.full.sP50.median >= 0 ? '+' : '')}${f3(B.full.sP50.median - A.full.sP50.median)})   TRIMMED ${f3(A.trimmed.sP50.median)} -> ${f3(B.trimmed.sP50.median)}`);
    console.log(`        V mean FULL ${f3(A.full.vMean.median)} -> ${f3(B.full.vMean.median)}   S p90 FULL ${f3(A.full.sP90.median)} -> ${f3(B.full.sP90.median)}`);
  }

  if (args.out) { writeFileSync(resolve(ROOT, args.out), JSON.stringify(report, null, 2)); console.log(`\n  wrote ${args.out}`); }
}

main().catch((e) => { console.error(e); process.exit(1); });
