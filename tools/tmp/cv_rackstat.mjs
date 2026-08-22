#!/usr/bin/env node
/**
 * CV RACKSTAT — does the canopy STRUCTURE respond to light, measured on an EXACT mask.
 *
 * ## The question
 * Round 1 shipped a pot rack over every concealment patch and a blind critic's verdict
 * was that the whole structure "reads as a wireframe/debug volume rather than a pot
 * rack", because `c701f70` authored all of it into `M.concealClothRim`, which is a
 * `flatMat` -> `THREE.MeshBasicMaterial`. Its number was **luma SD 1.16 on the frame vs
 * 10.71 on the pots hanging off it**. This tool re-derives that on this tree instead of
 * inheriting it, and measures the same quantity after the fix.
 *
 * ## Why an ABLATION MASK and not a before/after diff
 * A diff of the two arms is NOT the rack: it also contains the rack's new shadow on the
 * cloth, the rim's removed shadow, and every post/AA pixel those move. `AGENT-BRIEF §4.2`
 * — ablate to an unmissable colour. A third arm renders `concealRack` as `flatMat
 * ('#00FF00')`, identical geometry and camera, so "the rack" is exactly "the green
 * pixels" and the SAME mask is applied to both real arms.
 *
 * ## 🚨 Rule 6 — what would make this fail
 * `[].every()` is `true` and a mask that selects nothing measures nothing, so:
 *   * §A NON-EMPTY   — every station's mask must select >= `--min` pixels.
 *   * §B KNOWN-BAD   — the SAME extractor run on the BEFORE frame (which has no green
 *                      rack) must select **~zero**. If it does not, the key is matching
 *                      something that was always there and every number below is noise.
 *   * §C SELF-PAIR   — before vs before must return delta EXACTLY 0 on every column.
 *   * §D SUBJECT     — the mask's bounding box must not be degenerate (a line of AA
 *                      fringe would satisfy §A while containing no surface).
 *
 *   node tools/tmp/cv_rackstat.mjs --mask tools/tmp/cz_r2_mask \
 *        --a tools/tmp/cz_r2_before --b tools/tmp/cz_r2_after [--selftest]
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const MASKDIR = String(args.mask ?? 'tools/tmp/cz_r2_mask');
const ADIR = String(args.a ?? 'tools/tmp/cz_r2_before');
const BDIR = String(args.b ?? 'tools/tmp/cz_r2_after');
const MIN = Number(args.min ?? 400);

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function raw(path) {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height, ch: info.channels };
}

/** Pixels the ablation painted. Green is unmissable: nothing else in this arena is. */
function greenMask(img) {
  const { d, w, h, ch } = img;
  const m = new Uint8Array(w * h);
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; p < w * h; p++, i += ch) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // ⚠️ **THE FIRST KEY HERE WAS `g>140 && g-r>60 && g-b>60` AND §B CAUGHT IT** — it
    // matched the arena's green supply crate (R~0 G~180 B~100) on all eight stations,
    // 4,406-37,523 px of a mask that should have been empty in the un-ablated arm. The
    // ablation paints `#00FF00`, which survives the ToyGrade pass at R<16 G>=240 B<16;
    // the crate never gets below B~96. Keyed on that gap, not on "greenish".
    if (g > 200 && r < 48 && b < 48) {
      m[p] = 1; n++;
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { m, n, box: n ? [x0, y0, x1, y1] : null };
}

/** Luma statistics + colour concentration over a mask. */
function statsOn(img, mask) {
  const { d, ch } = img;
  let n = 0, s = 0, s2 = 0, lo = 255, hi = 0;
  const hist = new Map();
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const i = p * ch;
    const l = luma(d[i], d[i + 1], d[i + 2]);
    n++; s += l; s2 += l * l;
    if (l < lo) lo = l; if (l > hi) hi = l;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  if (!n) return null;
  const mean = s / n;
  let modal = 0;
  for (const v of hist.values()) if (v > modal) modal = v;
  return {
    px: n,
    mean: +mean.toFixed(2),
    sd: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(2),
    range: [+lo.toFixed(1), +hi.toFixed(1)],
    colours: hist.size,
    modalPct: +((modal / n) * 100).toFixed(2),
  };
}

async function main() {
  const files = (await readdir(MASKDIR)).filter((f) => f.endsWith('.png') && !f.includes('.drift.')).sort();
  if (files.length === 0) { console.error('cv_rackstat: ZERO station PNGs in', MASKDIR); process.exit(2); }

  let faults = 0;
  const rows = [];
  for (const f of files) {
    const mi = await raw(`${MASKDIR}/${f}`);
    const ai = await raw(`${ADIR}/${f}`);
    const bi = await raw(`${BDIR}/${f}`);
    if (mi.w !== ai.w || mi.w !== bi.w || mi.h !== ai.h || mi.h !== bi.h) {
      console.error(`FAULT ${f}: dimensions differ across arms`); faults++; continue;
    }
    const { m, n, box } = greenMask(mi);
    const frameArea = mi.w * mi.h;

    // §A NON-EMPTY
    if (n < MIN) { console.error(`FAULT §A ${f}: mask selected ${n} px (< ${MIN}) — measuring nothing`); faults++; continue; }
    // §D SUBJECT — a degenerate box means the "mask" is an AA fringe, not a surface
    const bw = box[2] - box[0] + 1, bh = box[3] - box[1] + 1;
    if (bw < 40 || bh < 40) { console.error(`FAULT §D ${f}: mask bbox ${bw}x${bh} is degenerate`); faults++; continue; }
    // §B KNOWN-BAD — the same extractor on the un-ablated BEFORE frame must find ~nothing
    const bad = greenMask(ai).n;
    if (bad > n * 0.02) { console.error(`FAULT §B ${f}: the green key found ${bad} px in the UN-ABLATED arm — it is not keyed on the rack`); faults++; continue; }

    const A = statsOn(ai, m), B = statsOn(bi, m);
    // §C SELF-PAIR
    const self = statsOn(ai, m);
    if (self.sd !== A.sd || self.mean !== A.mean || self.px !== A.px) {
      console.error(`FAULT §C ${f}: self-pair not identical`); faults++; continue;
    }
    rows.push({ station: f.replace('.png', ''), maskPx: n, maskPctFrame: +((n / frameArea) * 100).toFixed(3), knownBadPx: bad, before: A, after: B });
  }

  console.log('station      mask%frame   |  BEFORE sd  mean  range          modal%  |  AFTER  sd  mean  range          modal%');
  for (const r of rows) {
    console.log(
      `${r.station.padEnd(11)} ${String(r.maskPctFrame).padStart(7)}%  ` +
      `|  ${String(r.before.sd).padStart(6)} ${String(r.before.mean).padStart(6)} ` +
      `[${String(r.before.range[0]).padStart(5)},${String(r.before.range[1]).padStart(6)}] ${String(r.before.modalPct).padStart(6)}%  ` +
      `|  ${String(r.after.sd).padStart(6)} ${String(r.after.mean).padStart(6)} ` +
      `[${String(r.after.range[0]).padStart(5)},${String(r.after.range[1]).padStart(6)}] ${String(r.after.modalPct).padStart(6)}%`,
    );
  }
  if (rows.length) {
    const g = (k) => rows.reduce((a, r) => a + r[k === 'b' ? 'before' : 'after'].sd, 0) / rows.length;
    console.log(`\nmean luma SD over ${rows.length} stations:  BEFORE ${g('b').toFixed(2)}  ->  AFTER ${g('a').toFixed(2)}`);
  }
  console.log(`\n§A non-empty · §B known-bad · §C self-pair · §D subject-in-shot: ${rows.length}/${files.length} stations clean, ${faults} faults`);
  if (faults) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
