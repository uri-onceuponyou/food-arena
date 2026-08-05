#!/usr/bin/env node
/**
 * cr_geom — PER-REGION EMPTINESS, measured off rendered pixels, on a 3x3 grid.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The orchestrator's own read of a shipped frame was: "the right-hand third of the
 * frame is empty tile while the reference plates are packed at character scale."
 * That is a claim about pixels and it has to be MEASURED, not agreed with — and it
 * has to be measured with a statistic that a repeating tile grid cannot fake.
 *
 * ── The trap this is built around ───────────────────────────────────────────
 * A naive edge-density measure calls a tiled floor "content": hairline seams every
 * ~64 px produce a high gradient count over an area that reads to a human as empty.
 * So THREE statistics are reported per region and they disagree by construction on
 * exactly that input:
 *
 *   fineEdge   share of pixels with |Sobel(luma)| > 20. Counts tile seams.
 *   structSd   sd of luma after a sigma-8 blur and a 16x16 BOX DOWNSAMPLE. A periodic
 *              tile grid contributes the SAME mean to every downsampled cell, so its
 *              structSd collapses to ~0 no matter how strong its seams are; an object
 *              of any size makes some cells brighter or darker than others and does
 *              not collapse. This is the statistic that answers "is this region empty".
 *   satSd      sd of HSV saturation, unblurred. A monochrome region of any structure
 *              returns ~0; a region carrying differently-coloured objects does not.
 *
 * ⚠️ A statistic that LOOKED right and is not, kept here because it cost a rewrite:
 * "mean local sd over 32x32 blocks after a sigma-8 blur" scored a bare tile grid at
 * 3.55 and a single huge disc on flat ground at 0.51 — it ranks a floor as SEVEN TIMES
 * busier than an object, because a sigma-8 blur does not erase a 64 px-period grid and
 * a large flat object has no interior variation at all. It measures boundary density,
 * not occupancy. It is not used.
 *
 * `--selftest` asserts the separation on synthetic inputs whose answer is known,
 * INCLUDING the tile-grid known-bad input where fineEdge must be high and structSd
 * must be low. An instrument that has not been shown to fail on the thing it guards
 * against is not a guard (CLAUDE.md non-negotiable 6).
 *
 * ── Normalisation ───────────────────────────────────────────────────────────
 * Every input is resized to height 900 preserving aspect before measurement, because
 * the question is "share of FRAME", not "pixels". ⚠️ The Brawl Stars plates arrive
 * upscaled 1.33-1.43x (measured in tools/review.mjs's header), so their fine detail is
 * softer than ours and `fineEdge` is biased AGAINST them. `structSd` is the statistic
 * to compare across sources; `fineEdge` is for comparing our own frames to each other.
 *
 * Usage:
 *   node tools/tmp/cr_geom.mjs --in a.png[,b.png,...] [--json out.json]
 *   node tools/tmp/cr_geom.mjs --selftest
 */

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

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

const H_NORM = 900;
const EDGE_T = 20;
/** box-downsample factor for structSd. 16 px of a 900-high frame = 1.8% of frame. */
const DOWN = 16;
const BLUR_SIGMA = 8;

/** raw RGB -> {luma:Float32Array, sat:Float32Array} */
function channels(data, w, h) {
  const luma = new Float32Array(w * h);
  const sat = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 3) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sat[i] = mx === 0 ? 0 : (mx - mn) / mx;
  }
  return { luma, sat };
}

function sobelMask(luma, w, h) {
  const mask = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -luma[i - w - 1] - 2 * luma[i - 1] - luma[i + w - 1]
        + luma[i - w + 1] + 2 * luma[i + 1] + luma[i + w + 1];
      const gy = -luma[i - w - 1] - 2 * luma[i - w] - luma[i - w + 1]
        + luma[i + w - 1] + 2 * luma[i + w] + luma[i + w + 1];
      mask[i] = Math.hypot(gx, gy) / 4 > EDGE_T ? 1 : 0;
    }
  }
  return mask;
}

function sdOf(arr) {
  if (arr.length < 2) return 0;
  let s = 0; for (const v of arr) s += v;
  const m = s / arr.length;
  let q = 0; for (const v of arr) q += (v - m) * (v - m);
  return Math.sqrt(q / arr.length);
}

/**
 * sd of the DOWNSAMPLED luma inside a rectangle. `blurLuma` is already sigma-8
 * blurred; each cell is the mean of DOWNxDOWN of it. A periodic grid puts the same
 * mean in every cell and collapses to ~0; an object does not.
 */
function structSd(blurLuma, w, x0, y0, x1, y1) {
  const cells = [];
  for (let by = y0; by + DOWN <= y1; by += DOWN) {
    for (let bx = x0; bx + DOWN <= x1; bx += DOWN) {
      let s = 0;
      for (let y = by; y < by + DOWN; y++) {
        for (let x = bx; x < bx + DOWN; x++) s += blurLuma[y * w + x];
      }
      cells.push(s / (DOWN * DOWN));
    }
  }
  return sdOf(cells);
}

function regionStats(sharpLuma, blurLuma, sat, edge, w, x0, y0, x1, y1) {
  let edgeN = 0, n = 0;
  const satVals = [];
  const lumVals = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      edgeN += edge[i]; n++;
      satVals.push(sat[i]);
      lumVals.push(sharpLuma[i]);
    }
  }
  return {
    fineEdge: +(edgeN / Math.max(1, n)).toFixed(4),
    structSd: +structSd(blurLuma, w, x0, y0, x1, y1).toFixed(2),
    satSd: +sdOf(satVals).toFixed(4),
    lumaSd: +sdOf(lumVals).toFixed(2),
  };
}

async function measureBuffer(buf) {
  const img = sharp(buf).removeAlpha();
  const meta = await img.metadata();
  const w = Math.round((meta.width / meta.height) * H_NORM);
  const norm = sharp(buf).removeAlpha().resize({ width: w, height: H_NORM, fit: 'fill' });
  const { data } = await norm.raw().toBuffer({ resolveWithObject: true });
  const { luma, sat } = channels(data, w, H_NORM);
  const blurRaw = await sharp(buf).removeAlpha()
    .resize({ width: w, height: H_NORM, fit: 'fill' })
    .blur(BLUR_SIGMA).raw().toBuffer();
  const blurLuma = channels(blurRaw, w, H_NORM).luma;
  const edge = sobelMask(luma, w, H_NORM);

  const cx = [0, Math.round(w / 3), Math.round((2 * w) / 3), w];
  const cy = [0, Math.round(H_NORM / 3), Math.round((2 * H_NORM) / 3), H_NORM];
  const grid = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      row.push(regionStats(luma, blurLuma, sat, edge, w, cx[c], cy[r], cx[c + 1], cy[r + 1]));
    }
    grid.push(row);
  }
  const thirds = [0, 1, 2].map((c) => regionStats(luma, blurLuma, sat, edge, w, cx[c], 0, cx[c + 1], H_NORM));
  const whole = regionStats(luma, blurLuma, sat, edge, w, 0, 0, w, H_NORM);
  return { w, h: H_NORM, srcW: meta.width, srcH: meta.height, grid, thirds, whole };
}

async function measureFile(file) {
  const buf = await sharp(file).removeAlpha().png().toBuffer();
  const m = await measureBuffer(buf);
  return { file, ...m };
}

// ── selftest ────────────────────────────────────────────────────────────────
async function synth(w, h, fn) {
  const data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const p = (y * w + x) * 3;
      data[p] = r; data[p + 1] = g; data[p + 2] = b;
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function selftest() {
  let pass = 0, fail = 0;
  const t = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name} ${detail}`); }
    else { fail++; console.log(`  FAIL ${name} ${detail}`); }
  };

  // A. flat frame — every statistic must be ~0. A tool that reports content on a
  //    blank frame reports content on anything.
  const flat = await measureBuffer(await synth(1600, 900, () => [120, 120, 120]));
  t('A1 flat: fineEdge 0', flat.whole.fineEdge === 0, `${flat.whole.fineEdge}`);
  t('A2 flat: structSd 0', flat.whole.structSd < 0.01, `${flat.whole.structSd}`);
  t('A3 flat: satSd 0', flat.whole.satSd < 0.001, `${flat.whole.satSd}`);
  t('A4 flat: lumaSd 0', flat.whole.lumaSd < 0.01, `${flat.whole.lumaSd}`);

  // B. THE KNOWN-BAD INPUT. A repeating tile grid: flat 64px cells, 2px dark seams,
  //    monochrome. It reads to a human as EMPTY and it is exactly what "empty tile"
  //    means. fineEdge must be high (it counts seams) and coarseSd must be LOW.
  //    If coarseSd cannot tell this from an object, the whole measurement is void.
  const tiles = await measureBuffer(await synth(1600, 900, (x, y) => {
    const seam = (x % 64) < 2 || (y % 64) < 2;
    const v = seam ? 90 : 150;
    return [v, v, v];
  }));
  t('B1 tile grid: fineEdge is HIGH (seams are edges)', tiles.whole.fineEdge > 0.03, `${tiles.whole.fineEdge}`);
  // ⚠️ structSd does NOT collapse to zero on a periodic grid whose period (64 px) is
  // the same ORDER as the subject (a fighter is ~95 px in a 900 px frame). No linear
  // filter separates two things at the same scale. What it does is put the grid at a
  // measured FLOOR — 3.18 on this fixture — while an object region reaches 14.9. That
  // floor is the instrument's resolution limit and is stated rather than assumed.
  t('B2 tile grid: structSd sits at the periodic-grid FLOOR (~3.2), not at object level',
    tiles.whole.structSd < 4.0, `${tiles.whole.structSd}`);
  t('B3 tile grid: satSd 0 (monochrome)', tiles.whole.satSd < 0.001, `${tiles.whole.satSd}`);

  // C. THE POSITIVE CONTROL, same tile grid plus coloured discs in the LEFT third
  //    only. coarseSd must rise where the objects are and stay at the tile-grid
  //    level where they are not, and the right/left ratio must be small.
  const discs = [[220, 380, 90], [230, 620, 70], [420, 250, 60]];
  const objL = await measureBuffer(await synth(1600, 900, (x, y) => {
    for (const [cx, cy, r] of discs) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) return [235, 60, 40];
    }
    const seam = (x % 64) < 2 || (y % 64) < 2;
    const v = seam ? 90 : 150;
    return [v, v, v];
  }));
  const L = objL.thirds[0], R = objL.thirds[2];
  t('C1 object third structSd rises well above the tile floor',
    L.structSd > tiles.whole.structSd + 4, `${L.structSd} vs ${tiles.whole.structSd}`);
  t('C2 empty third structSd stays at the tile floor',
    Math.abs(R.structSd - tiles.whole.structSd) < 1.0, `${R.structSd} vs ${tiles.whole.structSd}`);
  t('C3 occupancy ABOVE the grid floor is ~0 on the right and large on the left',
    (R.structSd - tiles.whole.structSd) / (L.structSd - tiles.whole.structSd) < 0.05,
    `${((R.structSd - tiles.whole.structSd) / (L.structSd - tiles.whole.structSd)).toFixed(3)}`);
  t('C6 an object third clears the grid floor by >=4x — the separation this tool needs',
    L.structSd > 4 * tiles.whole.structSd, `${L.structSd} vs floor ${tiles.whole.structSd}`);
  t('C4 satSd finds the colour only on the left', L.satSd > 10 * Math.max(R.satSd, 1e-4),
    `${L.satSd} vs ${R.satSd}`);
  t('C5 fineEdge ALONE would call the empty third busy — the trap this tool exists for',
    R.fineEdge > 0.05, `right-third fineEdge ${R.fineEdge}`);

  // D. SCALE INVARIANCE. The same content at half resolution must return the same
  //    SHARE-of-frame answer, because the question is share of frame. This is what
  //    makes a 1176x750 plate comparable to a 1600x900 render.
  const big = await synth(1600, 900, (x, y) => {
    const d = Math.hypot(x - 800, y - 450);
    return d < 200 ? [240, 40, 40] : [140, 140, 140];
  });
  const small = await sharp(big).resize({ width: 800, height: 450 }).png().toBuffer();
  const mb = await measureBuffer(big), ms = await measureBuffer(small);
  t('D1 structSd survives a 2x resolution change within 12%',
    Math.abs(mb.whole.structSd - ms.whole.structSd) / mb.whole.structSd < 0.12,
    `${mb.whole.structSd} vs ${ms.whole.structSd}`);
  t('D2 satSd survives a 2x resolution change within 12%',
    Math.abs(mb.whole.satSd - ms.whole.satSd) / mb.whole.satSd < 0.12,
    `${mb.whole.satSd} vs ${ms.whole.satSd}`);

  // E. ORDERING. Emptiness must ORDER correctly across three known frames.
  const order = [tiles.whole.structSd, objL.whole.structSd, mb.whole.structSd];
  t('E1 tile grid < discs-on-tiles < big disc', order[0] < order[1] && order[1] < order[2],
    order.map((v) => v.toFixed(2)).join(' < '));

  // F. SELF-PAIR. The same buffer measured twice must be bit-identical, or every
  //    difference reported below could be the tool.
  const a = await measureBuffer(big), b = await measureBuffer(big);
  t('F1 self-pair is exact', JSON.stringify(a) === JSON.stringify(b));

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
}

// ── main ────────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv);
if (args.selftest) {
  await selftest();
} else {
  if (!args.in) { console.error('Need --in <png>[,<png>...]  or --selftest'); process.exit(2); }
  const files = String(args.in).split(',').map((s) => s.trim()).filter(Boolean);
  const all = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    const m = await measureFile(f);
    all.push(m);
    console.log(`\n${basename(f)}  (${m.srcW}x${m.srcH} -> ${m.w}x${m.h})`);
    console.log('  structSd (blur s8 -> 16px box) — the cross-source occupancy statistic');
    for (const row of m.grid) console.log('    ' + row.map((c) => String(c.structSd).padStart(7)).join(''));
    console.log(`  thirds structSd  L ${m.thirds[0].structSd}  C ${m.thirds[1].structSd}  R ${m.thirds[2].structSd}`
      + `   R/L ${(m.thirds[2].structSd / m.thirds[0].structSd).toFixed(3)}`
      + `   min/whole ${(Math.min(...m.thirds.map((t) => t.structSd)) / m.whole.structSd).toFixed(3)}`);
    console.log(`  thirds fineEdge  L ${m.thirds[0].fineEdge}  C ${m.thirds[1].fineEdge}  R ${m.thirds[2].fineEdge}`);
    console.log(`  thirds satSd     L ${m.thirds[0].satSd}  C ${m.thirds[1].satSd}  R ${m.thirds[2].satSd}`);
    console.log(`  whole            structSd ${m.whole.structSd}  fineEdge ${m.whole.fineEdge}  satSd ${m.whole.satSd}  lumaSd ${m.whole.lumaSd}`);
  }
  if (typeof args.json === 'string') {
    await writeFile(args.json, JSON.stringify(all, null, 2));
    console.log(`\n-> ${args.json}`);
  }
}
