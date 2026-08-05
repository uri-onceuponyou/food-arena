#!/usr/bin/env node
/**
 * Audit a blind critic packet for FAIRNESS, before anyone believes a score from it.
 *
 * `tools/review.mjs` builds A/B sheets and `tools/compare.mjs` composites them by
 * scaling every panel to the SAME HEIGHT (default 1000 px). That single decision is
 * the whole fairness question, because it preserves *fraction of frame* and destroys
 * *pixels on subject*: a reference plate cropped tight to one brawler arrives at the
 * critic drawn 4x larger than the same brawler in a wide gameplay frame, and a
 * 1176x750 marketing crop arrives UPSCALED 1.33x — soft — beside a native 1600x900
 * render that arrives upscaled 1.11x.
 *
 * Neither difference is visible in a filename, in `manifest.json`, or in the sheet's
 * own "A"/"B" labels. This measures them.
 *
 * Reported per panel, at the size the critic actually sees:
 *   scale      the resample factor compare.mjs applies (>1 = upscaled = softened)
 *   sharp      mean |Laplacian| on luma AFTER that resample — acuity as delivered
 *   detail     edge density — share of pixels carrying a Laplacian above 0.02 luma
 *   luma/sat   mean luma, mean HSV saturation
 *   bpp        source bytes per pixel — an encoding/compression asymmetry proxy
 *
 * And per sheet: panel width ratio, which is a BLINDNESS question. If our renders are
 * always 16:9 and the reference crops are always something else, panel shape is a
 * stable tell across a whole round even though the "A"/"B" labels are shuffled.
 *
 * Usage:
 *   node tools/tmp/packet_audit.mjs --packet shots/review/char-round2
 *   node tools/tmp/packet_audit.mjs --images a.png,b.png
 *   node tools/tmp/packet_audit.mjs --selftest
 */

import sharp from 'sharp';
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const SHEET_H = 1000; // compare.mjs default --height

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

/** Luma plane (Rec.709) at a given raw RGB buffer. */
function lumaPlane(data, w, h, ch) {
  const L = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += ch) {
    L[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
  }
  return L;
}

/**
 * Mean absolute 4-neighbour Laplacian, in luma units.
 *
 * Chosen over a variance-of-Laplacian because it is linear in edge contrast and so
 * does not let one specular highlight dominate the whole frame — the failure mode
 * that makes "sharpness" numbers disagree with the eye on high-key art.
 */
function laplacian(L, w, h) {
  let sum = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      sum += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

/**
 * Edge density: fraction of pixels carrying a Laplacian above `thr`.
 *
 * ⚠️ This started life as "fraction of pixels whose 3x3 luma RANGE exceeds a
 * threshold", and the selftest killed it: a blurred frame scored 0.356 against the
 * crisp original's 0.197, i.e. **blur made it look busier**, because blur spreads a
 * hard edge across ~8 px so more windows contain a gradient even though each is
 * weaker. A frame-complexity number that rewards blur would have inverted this whole
 * audit's conclusion about which panel is delivered softer. Thresholding the
 * Laplacian instead is monotone in edge contrast and ranks blur correctly.
 */
function edgeDensity(L, w, h, thr = 0.02) {
  let hit = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]) > thr) hit++;
      n++;
    }
  }
  return n ? hit / n : 0;
}

function satMean(data, w, h, ch) {
  let s = 0;
  for (let i = 0, p = 0; i < w * h; i++, p += ch) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    s += mx === 0 ? 0 : (mx - mn) / mx;
  }
  return s / (w * h);
}

/** Everything about one panel, measured BOTH natively and as the critic sees it. */
async function measure(path) {
  const meta = await sharp(path).metadata();
  const bytes = (await stat(path)).size;
  const scale = SHEET_H / meta.height;

  // As delivered to the critic: exactly compare.mjs's resample.
  const { data, info } = await sharp(path)
    .resize({ height: SHEET_H, fit: 'contain', background: { r: 22, g: 16, b: 31, alpha: 1 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const L = lumaPlane(data, info.width, info.height, info.channels);

  return {
    file: basename(path),
    path,
    w: meta.width,
    h: meta.height,
    aspect: +(meta.width / meta.height).toFixed(3),
    bpp: +(bytes / (meta.width * meta.height)).toFixed(3),
    scale: +scale.toFixed(3),
    sheetW: info.width,
    sharp: +laplacian(L, info.width, info.height).toFixed(5),
    detail: +edgeDensity(L, info.width, info.height).toFixed(4),
    luma: +(L.reduce((a, b) => a + b, 0) / L.length).toFixed(4),
    sat: +satMean(data, info.width, info.height, info.channels).toFixed(4),
  };
}

/**
 * Share of frame occupied by a subject inside a hand-set bounding box.
 *
 * Two numbers come out and they are NOT the same question:
 *   heightPct   bbox height as a share of frame height — what every "how big is a
 *               brawler" argument on this project has actually been arguing about
 *   areaPct     PIXELS ON SUBJECT as a share of the frame — what a silhouette
 *               actually delivers to the eye
 *
 * They diverge exactly when a character is a NEEDLE: a tall thin figure matches a
 * chunky one on height while carrying a fraction of its area. Two independent blind
 * critics measured our character at "~12% of frame height, comparable to a Brawl
 * Stars brawler" and still called it unreadable, naming mass rather than scale — so
 * height alone cannot be the number this project steers by.
 *
 * Segmentation is background-distance inside the box: the modal colour of the box's
 * border ring is taken as background, and anything farther than `thr` in RGB is
 * subject. That is only honest on a locally uniform background, which is why the
 * caller must pass a matching EMPTY control box — if the control returns more than a
 * few percent, the segmentation is wrong and the subject number must be discarded.
 */
function subjectMass(data, w, h, ch, inner, thr = 46) {
  // ⚠️ The first version of this estimated the background from the ring of the box
  // ITSELF, and the known-answer fixture killed it: a box drawn tight on the subject
  // has a border made ENTIRELY of subject, so the modal "background" came back as the
  // subject's own colour and the metric returned 0% for a shape that fills the box.
  // That is the exact failure this instrument exists to catch in other people's
  // measurements. The background must be sampled from OUTSIDE the box.
  const ring = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const insideInner = x >= inner.x && x < inner.x + inner.w && y >= inner.y && y < inner.y + inner.h;
      if (!insideInner) ring.push([y, x]);
    }
  }
  const bins = new Map();
  for (const [y, x] of ring) {
    const p = (y * w + x) * ch;
    const k = `${data[p] >> 4},${data[p + 1] >> 4},${data[p + 2] >> 4}`;
    const e = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += data[p]; e.g += data[p + 1]; e.b += data[p + 2];
    bins.set(k, e);
  }
  let best = null;
  for (const e of bins.values()) if (!best || e.n > best.n) best = e;
  const bg = [best.r / best.n, best.g / best.n, best.b / best.n];
  // If the surround is not dominated by one colour the estimate is meaningless and
  // the caller must not use the number. Reported, never silently swallowed.
  const ringPurity = best.n / ring.length;
  let hit = 0;
  for (let y = inner.y; y < inner.y + inner.h; y++) {
    for (let x = inner.x; x < inner.x + inner.w; x++) {
      const p = (y * w + x) * ch;
      if (Math.hypot(data[p] - bg[0], data[p + 1] - bg[1], data[p + 2] - bg[2]) > thr) hit++;
    }
  }
  return { subjectPx: hit, boxPx: inner.w * inner.h, fill: hit / (inner.w * inner.h),
           bg: bg.map((v) => Math.round(v)), ringPurity };
}

async function massAt(file, box) {
  const meta = await sharp(file).metadata();
  const pad = Math.max(8, Math.round(0.18 * Math.max(box.width, box.height)));
  const left = Math.max(0, box.left - pad);
  const top = Math.max(0, box.top - pad);
  const width = Math.min(meta.width - left, box.width + (box.left - left) + pad);
  const height = Math.min(meta.height - top, box.height + (box.top - top) + pad);
  const { data, info } = await sharp(file).extract({ left, top, width, height })
    .raw().toBuffer({ resolveWithObject: true });
  const inner = { x: box.left - left, y: box.top - top, w: box.width, h: box.height };
  const m = subjectMass(data, info.width, info.height, info.channels, inner);
  return {
    file: basename(file), frame: `${meta.width}x${meta.height}`,
    box: `${box.width}x${box.height}`,
    heightPct: +((box.height / meta.height) * 100).toFixed(2),
    fill: +m.fill.toFixed(3),
    areaPct: +((m.subjectPx / (meta.width * meta.height)) * 100).toFixed(3),
    bg: m.bg.join(','),
    ringPurity: +m.ringPurity.toFixed(2),
  };
}

function row(m, tag) {
  return `${tag.padEnd(11)} ${String(m.w).padStart(5)}x${String(m.h).padEnd(5)} ar ${m.aspect.toFixed(3)}`
    + `  scale ${m.scale.toFixed(3).padStart(6)}  sheetW ${String(m.sheetW).padStart(4)}`
    + `  sharp ${m.sharp.toFixed(5)}  detail ${m.detail.toFixed(4)}`
    + `  luma ${m.luma.toFixed(4)}  sat ${m.sat.toFixed(4)}  bpp ${m.bpp.toFixed(2)}  ${m.file}`;
}

async function auditPacket(dir) {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  console.log(`\n══ ${dir}`);
  console.log(`   ours: ${manifest.ours}   category: ${manifest.category}`);
  const ours = await measure(resolve(manifest.ours));

  const keys = (await readdir(dir)).filter((f) => /\.key\.json$/.test(f)).sort();
  const rows = [];
  for (const kf of keys) {
    const key = JSON.parse(await readFile(join(dir, kf), 'utf8'));
    const refPath = resolve(`reference/images/curated/${manifest.category}/${key.refPath}`);
    if (!existsSync(refPath)) { console.log(`   !! missing ref ${refPath}`); continue; }
    const ref = await measure(refPath);
    const oursSlot = key.A === 'ours' ? 'A' : 'B';
    console.log(`\n   ${kf}  ours is panel ${oursSlot}`);
    console.log(`     ${row(ours, 'OURS')}`);
    console.log(`     ${row(ref, 'REF')}`);
    console.log(`     ratios: sharp ${(ref.sharp / ours.sharp).toFixed(2)}x ref/ours`
      + `  detail ${(ref.detail / ours.detail).toFixed(2)}x`
      + `  panelW ${(ref.sheetW / ours.sheetW).toFixed(2)}x`);
    rows.push({ key: kf, oursSlot, ref: key.refPath, ours, refM: ref });
  }
  return rows;
}

// ── selftest: the instrument must rank a KNOWN degradation the right way round ──
async function selftest() {
  let pass = 0, fail = 0;
  const t = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name} ${detail}`); }
    else { fail++; console.log(`  FAIL ${name} ${detail}`); }
  };
  const tmp = '/tmp/packet_audit_selftest';
  await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 30, g: 40, b: 60 } } })
    .composite([{
      input: Buffer.from(
        `<svg width="800" height="800">${Array.from({ length: 40 }, (_, i) =>
          `<rect x="${i * 20}" y="0" width="10" height="800" fill="rgb(230,90,40)"/>`).join('')}</svg>`
      ),
      top: 0, left: 0,
    }])
    .png().toFile(`${tmp}_a.png`);
  await sharp(`${tmp}_a.png`).blur(4).png().toFile(`${tmp}_blur.png`);
  // Two resizes in ONE sharp pipeline is a no-op — the second silently replaces the
  // first, so the "low-res" fixture came out byte-identical to the crisp one and the
  // selftest reported the METRIC as broken. Round-trip through a real intermediate.
  await sharp(`${tmp}_a.png`).resize(200, 200).png().toFile(`${tmp}_small.png`);
  await sharp(`${tmp}_small.png`).resize(800, 800).png().toFile(`${tmp}_lowres.png`);
  await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 30, g: 40, b: 60 } } })
    .png().toFile(`${tmp}_flat.png`);

  const a = await measure(`${tmp}_a.png`);
  const b = await measure(`${tmp}_blur.png`);
  const lo = await measure(`${tmp}_lowres.png`);
  const flat = await measure(`${tmp}_flat.png`);

  t('sharp ranks blur BELOW crisp', b.sharp < a.sharp, `${b.sharp} < ${a.sharp}`);
  t('sharp ranks lowres BELOW crisp', lo.sharp < a.sharp, `${lo.sharp} < ${a.sharp}`);
  t('sharp is ~0 on a flat frame', flat.sharp < 1e-4, `${flat.sharp}`);
  t('edge density ranks blur BELOW crisp', b.detail < a.detail, `${b.detail} < ${a.detail}`);
  t('edge density ranks lowres BELOW crisp', lo.detail < a.detail, `${lo.detail} < ${a.detail}`);
  t('edge density is 0 on a flat frame', flat.detail === 0, `${flat.detail}`);
  t('sat is 0 on a grey-blue flat frame > 0', flat.sat > 0, `${flat.sat}`);
  t('scale is 1000/h', a.scale === 1.25, `${a.scale}`);
  t('luma of flat frame matches Rec.709', Math.abs(flat.luma - (0.2126 * 30 + 0.7152 * 40 + 0.0722 * 60) / 255) < 1e-3,
    `${flat.luma}`);

  // ── subjectMass, against a fixture whose answer is known by construction ──
  // A 1000x1000 frame on a flat green ground with ONE 100x300 black bar. A box drawn
  // tight around the bar must return 3.0% of frame area; an empty box the same size
  // must return ~0. Two shapes with the SAME height and different widths must return
  // the same heightPct and different areaPct — the whole point of the metric.
  await sharp({ create: { width: 1000, height: 1000, channels: 3, background: { r: 40, g: 130, b: 60 } } })
    .composite([{ input: Buffer.from(
      '<svg width="1000" height="1000">'
      + '<rect x="100" y="200" width="100" height="300" fill="#101014"/>'   // needle
      + '<rect x="500" y="200" width="300" height="300" fill="#101014"/>'   // block
      + '</svg>'), top: 0, left: 0 }])
    .png().toFile(`${tmp}_mass.png`);
  const needle = await massAt(`${tmp}_mass.png`, { left: 100, top: 200, width: 100, height: 300 });
  const block = await massAt(`${tmp}_mass.png`, { left: 500, top: 200, width: 300, height: 300 });
  const empty = await massAt(`${tmp}_mass.png`, { left: 100, top: 600, width: 100, height: 300 });
  t('needle area = 3.0% of frame', Math.abs(needle.areaPct - 3.0) < 0.05, `${needle.areaPct}`);
  t('block area = 9.0% of frame', Math.abs(block.areaPct - 9.0) < 0.05, `${block.areaPct}`);
  t('empty control returns ~0', empty.areaPct < 0.05, `${empty.areaPct}`);
  t('ring purity is high on a uniform surround', needle.ringPurity > 0.9, `${needle.ringPurity}`);
  t('needle and block agree on HEIGHT', needle.heightPct === block.heightPct, `${needle.heightPct} vs ${block.heightPct}`);
  t('needle and block DISAGREE on AREA by 3x', Math.abs(block.areaPct / needle.areaPct - 3) < 0.05,
    `${(block.areaPct / needle.areaPct).toFixed(2)}x`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

const args = parseArgs(process.argv);
if (args.selftest) await selftest();
else if (args.packet) await auditPacket(resolve(args.packet));
else if (args.mass) {
  // --mass f.png --box x,y,w,h  (repeatable via comma-separated --box list is not
  // supported on purpose: one box, one answer, so a wrong box is visible.)
  const [left, top, width, height] = String(args.box).split(',').map(Number);
  const m = await massAt(resolve(args.mass), { left, top, width, height });
  console.log(JSON.stringify(m));
} else if (args.images) {
  for (const p of String(args.images).split(',')) console.log(row(await measure(resolve(p.trim())), ''));
} else {
  console.error('Need --packet <dir> | --images a.png,b.png | --selftest');
  process.exit(2);
}
