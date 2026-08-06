#!/usr/bin/env node
/**
 * ch_pizza_shots — the capture this pass is judged on, at the view Uri judges.
 *
 * Sibling tools `ch_sushi_shots.mjs` / `ch_donut_shots.mjs` established the shape of
 * this and the reasoning is restated rather than re-derived:
 *
 *  1. `shoot.mjs --char` renders at the preview's default **22 deg**, which is NOT a
 *     shipped camera. The two shipped cameras are the match's **58 deg**
 *     (`preview.ts:170`) and character select's **20 deg** (`charStage.ts:451`).
 *     `fc4d9ad`: *"Uri is judging the character-select screen, which is a 20 deg
 *     camera ... nothing here has ever measured the lobby."*
 *  2. Every "0% of eye pixels above 0.85 luma" finding is a FACE measurement, and a
 *     900x1100 full-body frame puts a face at ~90 px across. So each lobby view also
 *     gets a head crop taken from the **same buffer** — provably the same pixels, and
 *     zero extra GPU while ten peers are rendering.
 *
 * ── What is PIZZA-specific, and why the crop is SOLVED rather than hardcoded ──
 * Donut hardcodes `0.14..0.42` of the FRAME height and sushi `0.06..0.36`. Neither
 * transfers, and a hardcoded band is fragile for a different reason that matters
 * here: **this pass changes the head's own geometry** (the cheese strands leave the
 * silhouette), so a band expressed in frame coordinates would measure a different
 * part of the character before and after and the delta would be an artefact.
 *
 * So the band is expressed in the CHARACTER MASK's own coordinates and solved per
 * frame: key the backdrop, take the mask bbox, and crop `0.16..0.38` of the mask's
 * height down from its TOP, centred on the x-centroid of the head rows rather than
 * on the body (at yaw 32 those differ by a visible margin).
 *
 * Why those two numbers, derived from the model rather than eyeballed
 * (`rig.ts` layout math, `standard` archetype, `pizza.ts` stance splay 0.44):
 *   headRadius R = 0.4209 m, head origin y = 1.6341, wedge tip y = 2.0475
 *   face features occupy head-local y = +0.02R .. -0.50R  ->  world 1.643 .. 1.424
 *   as a fraction down from the mask top (2.0475, feet at ~0):
 *       (2.0475 - 1.643) / 2.0475 = 0.198       (2.0475 - 1.424) / 2.0475 = 0.305
 * The 0.16..0.38 band brackets that with margin for the 20 deg pitch's foreshortening
 * and for the boots sitting a little below y=0.
 *
 * ⚠️ KNOWN-BAD-INPUT VALIDATION (CLAUDE.md non-negotiable #6). `--selftest` feeds
 * both `summarise()` and the crop solver synthetic fields whose answers are known BY
 * HAND, including the four ways these statistics can lie:
 *   · a crop that is all backdrop must report px 0, not a confident bright share
 *   · a GLINT-ONLY face (39 white px in 8000) must NOT read as a bright face — that
 *     is exactly what "0% above 0.85" looked like on HEAD
 *   · a white that renders at 0.84 must read 0 above 0.85, and `max` must still see it
 *   · an EMPTY frame must return NO crop, not a crop of the whole frame
 * A run that does not print `selftest: N passed` has not been validated on this tree.
 *
 * Usage:
 *   node tools/tmp/ch_pizza_shots.mjs --selftest
 *   node tools/tmp/headserve.mjs -- \
 *     node tools/tmp/ch_pizza_shots.mjs --out shots/ch/pizza/before
 *   node tools/tmp/headserve.mjs --overlay src/characters/pizza.ts -- \
 *     node tools/tmp/ch_pizza_shots.mjs --out shots/ch/pizza/after
 *   ... --views lobby_front,lobby_3q      # fewer page loads when the GPU is busy
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { captureSettled } from './settle.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const num = (k, d) => Number(get(k, d));

/** pitch 20 = character select (`charStage.ts:451`); pitch 58 = the match camera. */
const ALL_VIEWS = [
  { tag: 'lobby_front', yaw: 0, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: true },
  { tag: 'lobby_3q', yaw: 32, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: true },
  { tag: 'lobby_side', yaw: 90, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: false },
  { tag: 'match58_run', yaw: 210, pitch: 58, anim: 'run', t: 1.07, w: 900, h: 1100, crop: false },
];

// ── The statistic, and its known-bad-input proof ─────────────────────────────

function summarise(lumas) {
  if (!lumas.length) return { px: 0 };
  const s = Float64Array.from(lumas).sort();
  const q = (p) => s[Math.min(s.length - 1, Math.round((s.length - 1) * p))];
  const above = (t) => s.reduce((n, v) => n + (v > t ? 1 : 0), 0) / s.length;
  // Distinct value plateaus: 20 bins, a bin counts if it holds >= 0.5% of the pixels.
  const bins = new Array(20).fill(0);
  for (const v of s) bins[Math.min(19, Math.floor(v * 20))]++;
  const steps = bins.filter((n) => n / s.length >= 0.005).length;
  return {
    px: s.length,
    p05: +q(0.05).toFixed(4), p50: +q(0.5).toFixed(4), p95: +q(0.95).toFixed(4),
    max: +s[s.length - 1].toFixed(4),
    above85: +above(0.85).toFixed(4), above94: +above(0.94).toFixed(4),
    steps,
  };
}

/**
 * Backdrop key. Luma-INDEPENDENT by construction: the reference is the mean colour of
 * the frame's top-left 8x8, which is empty backdrop at every view this tool takes, and
 * matching is per-channel within 14/255. Keying on brightness would make "share above
 * 0.85" a statement about the studio.
 */
function keyOf(data, info) {
  const ch = info.channels;
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const s = (y * info.width + x) * ch;
    br += data[s]; bg += data[s + 1]; bb += data[s + 2]; bn++;
  }
  return { r: br / bn, g: bg / bn, b: bb / bn };
}

const isBackdrop = (data, s, k) =>
  Math.abs(data[s] - k.r) < 14 && Math.abs(data[s + 1] - k.g) < 14 && Math.abs(data[s + 2] - k.b) < 14;

/**
 * Solve the head crop in the CHARACTER MASK's own coordinates.
 *
 * Returns `null` when there is no character — the known-bad case that must NOT
 * silently produce a crop of the whole frame (`docs/LESSONS.md` §13: an instrument
 * that fails quietly is worse than none).
 */
function solveHeadCrop(data, info, opts = {}) {
  const band0 = opts.band0 ?? 0.16, band1 = opts.band1 ?? 0.38, wf = opts.widthFrac ?? 0.62;
  const ch = info.channels;
  const k = keyOf(data, info);
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (isBackdrop(data, (y * info.width + x) * ch, k)) continue;
    n++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  // 0.05% of the frame is well below any real character and well above stray AA
  // fringing on an empty backdrop.
  if (n < info.width * info.height * 0.0005) return null;
  const H = maxY - minY + 1;
  const top = Math.round(minY + band0 * H);
  const bot = Math.round(minY + band1 * H);
  // The head's own x-centroid, not the body's: at yaw 32 they differ visibly, and a
  // body-centred crop clips one eye.
  const headRows1 = Math.round(minY + 0.42 * H);
  let sx = 0, sn = 0, hMin = info.width, hMax = -1;
  for (let y = minY; y <= headRows1; y++) for (let x = minX; x <= maxX; x++) {
    if (isBackdrop(data, (y * info.width + x) * ch, k)) continue;
    sx += x; sn++;
    if (x < hMin) hMin = x; if (x > hMax) hMax = x;
  }
  if (!sn) return null;
  const cx = sx / sn;
  const halfW = Math.max(6, Math.round(((hMax - hMin + 1) * 0.5) * wf));
  const left = Math.max(0, Math.round(cx) - halfW);
  const right = Math.min(info.width - 1, Math.round(cx) + halfW);
  return { left, top, width: right - left + 1, height: Math.max(1, bot - top + 1), maskH: H, maskPx: n };
}

/** The face-value histogram over a crop of the FULL frame buffer. */
function cropStats(data, info, box) {
  const ch = info.channels;
  const k = keyOf(data, info);
  const lumas = [];
  for (let y = box.top; y < box.top + box.height; y++) {
    for (let x = box.left; x < box.left + box.width; x++) {
      const s = (y * info.width + x) * ch;
      if (isBackdrop(data, s, k)) continue;
      lumas.push((0.2126 * data[s] + 0.7152 * data[s + 1] + 0.0722 * data[s + 2]) / 255);
    }
  }
  return summarise(lumas);
}

// ── selftest ─────────────────────────────────────────────────────────────────

/** Build a raw RGB field: backdrop everywhere, `rect` filled with `fill`. */
function synth(w, h, rect, fill, bg = [30, 30, 30]) {
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { data[i * 3] = bg[0]; data[i * 3 + 1] = bg[1]; data[i * 3 + 2] = bg[2]; }
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const s = (y * w + x) * 3;
      data[s] = fill[0]; data[s + 1] = fill[1]; data[s + 2] = fill[2];
    }
  }
  return { data, info: { width: w, height: h, channels: 3 } };
}

function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want, tol = 0) => {
    const g = Array.isArray(got) ? got : [got], w = Array.isArray(want) ? want : [want];
    const ok = g.length === w.length && g.every((v, i) => Math.abs(v - w[i]) <= tol);
    console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `   got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    ok ? pass++ : fail++;
  };
  // A. the empty crop — the failure that would otherwise report a confident share.
  check('A1 empty field reports px 0', summarise([]).px, 0);
  check('A2 empty field reports NO above85 key', summarise([]).above85 === undefined ? 1 : 0, 1);
  // B. a two-value field: answers by hand.
  const B = summarise([...new Array(300).fill(0.20), ...new Array(700).fill(0.90)]);
  check('B1 two plateaus', B.steps, 2);
  check('B2 above85 is exactly 0.70', B.above85, 0.70, 1e-9);
  check('B3 p05 is the dark value', B.p05, 0.20, 1e-9);
  check('B4 p95 is the bright value', B.p95, 0.90, 1e-9);
  check('B5 max is the bright value', B.max, 0.90, 1e-9);
  // C. THE KNOWN-BAD INPUT for this pass's own claim. A face with a white GLINT but no
  //    sclera — 39 bright px in 8000 — must NOT read as a bright face. That is what
  //    "0% above 0.85" actually looked like on HEAD; the reference band is 0.31/0.34.
  const C = summarise([...new Array(7961).fill(0.62), ...new Array(39).fill(0.99)]);
  // 39/8000 = 0.004875, and `summarise` reports to 4 dp, so the expected value is the
  // ROUNDED 0.0049 — writing the unrounded number here is a real trap and it fired on
  // the first run of this tool.
  check('C1 a glint alone is 0.0049 above 0.85, not a bright face', C.above85, 0.0049, 1e-9);
  check('C2 and it does NOT count as a plateau (< 0.5% of px)', C.steps, 1);
  check('C3 exactly 0.5% DOES count as a plateau (>=, not >)',
    summarise([...new Array(7960).fill(0.62), ...new Array(40).fill(0.99)]).steps, 2);
  // D. the sub-threshold bright value — the trap where "white" renders at 0.84 and the
  //    metric would read 0 while the eye is plainly there. It MUST read 0.
  const D = summarise([...new Array(500).fill(0.60), ...new Array(500).fill(0.84)]);
  check('D1 0.84 is NOT above 0.85 (strict)', D.above85, 0, 1e-9);
  check('D2 but max sees it', D.max, 0.84, 1e-9);

  // E. THE CROP SOLVER, against inputs whose answers are arithmetic.
  //    A 100-wide x 200-tall subject at (x 50, y 40) in a 200x400 frame.
  const E = synth(200, 400, { x: 50, y: 40, w: 100, h: 200 }, [200, 180, 120]);
  const box = solveHeadCrop(E.data, E.info);
  check('E1 band top   = minY + 0.16*H', box.top, Math.round(40 + 0.16 * 200));
  check('E2 band height= 0.22*H (+1 incl.)', box.height, Math.round(40 + 0.38 * 200) - Math.round(40 + 0.16 * 200) + 1);
  check('E3 mask height is the subject height', box.maskH, 200);
  check('E4 crop is centred on the subject', Math.round(box.left + box.width / 2), 100, 1);
  check('E5 crop half-width is 0.62 of the head half-width', box.width, 2 * Math.round(50 * 0.62) + 1);
  // E6 is THE known-bad input for the solver: an EMPTY frame must return NO crop.
  //    A solver that "falls back to the whole frame" here would report a confident
  //    bright share measured on the studio backdrop.
  check('E6 an empty frame returns NO crop', solveHeadCrop(synth(200, 400, null, null).data, synth(200, 400, null, null).info) === null ? 1 : 0, 1);
  // E7 the crop must be OFF-CENTRE when the head is, which is the yaw-32 case the
  //    body-centred version got wrong. Head at x 20..80, body at x 50..150.
  const E7 = synth(200, 400, { x: 50, y: 40, w: 100, h: 200 }, [200, 180, 120]);
  for (let y = 40; y < 40 + 80; y++) for (let x = 20; x < 50; x++) {
    const s = (y * 200 + x) * 3; E7.data[s] = 200; E7.data[s + 1] = 180; E7.data[s + 2] = 120;
  }
  const b7 = solveHeadCrop(E7.data, E7.info);
  check('E7 head-row centroid pulls the crop left of the body centre', b7.left + b7.width / 2 < 100 ? 1 : 0, 1);

  // F. cropStats must exclude backdrop INSIDE the crop, not just outside it.
  const F = synth(40, 40, { x: 10, y: 10, w: 20, h: 20 }, [255, 255, 255]);
  const fs = cropStats(F.data, F.info, { left: 0, top: 0, width: 40, height: 40 });
  check('F1 only the subject is counted', fs.px, 400);
  check('F2 and it reads as white', fs.above94, 1, 1e-9);

  console.log(`\nselftest: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

if (a.includes('--selftest')) process.exit(selftest() ? 0 : 1);

const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/ch/pizza/now');
const ID = get('--id', 'pizza');
const WANT = get('--views', null);
const VIEWS = WANT ? ALL_VIEWS.filter((v) => WANT.split(',').includes(v.tag)) : ALL_VIEWS;
const BAND0 = num('--band0', 0.16);
const BAND1 = num('--band1', 0.38);

if (!selftest()) { console.error('\n✗ selftest failed — not capturing.'); process.exit(1); }

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];
for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`PAGEERROR ${v.tag}`, String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  const url = `${BASE}/preview.html?piece=character&id=${ID}&anim=${v.anim}&yaw=${v.yaw}`
    + `&t=${v.t}&pitch=${v.pitch}&shot=1`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
  await page.waitForTimeout(600);
  const path = `${OUT}/${v.tag}.png`;
  const { buf, stats } = await captureSettled(page, { path, label: v.tag, tool: 'ch_pizza_shots' });
  const row = { tag: v.tag, stdev: stats.stdev, mean: stats.mean };

  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (v.crop) {
    const box = solveHeadCrop(data, info, { band0: BAND0, band1: BAND1 });
    if (!box) {
      console.error(`✗ ${v.tag}: no character mask found — NOT reporting a face statistic.`);
    } else {
      const face = await sharp(buf).extract({ left: box.left, top: box.top, width: box.width, height: box.height })
        .resize({ width: box.width * 3, kernel: 'nearest' }).png().toBuffer();
      await writeFile(`${OUT}/${v.tag}.face.png`, face);
      row.box = box;
      row.face = cropStats(data, info, box);
    }
  }
  rows.push(row);
  await page.close();
}
await browser.close();

console.log(`\n# ${ID} @ ${BASE} -> ${OUT}   (head band ${BAND0}..${BAND1} of the MASK's own height)`);
console.log('view            stdev   facePx   p05     p50     p95     max    >0.85   >0.94  steps');
for (const r of rows) {
  const f = r.face;
  console.log(`${r.tag.padEnd(14)} ${String(r.stdev).padStart(6)}  `
    + (f ? `${String(f.px).padStart(6)}  ${f.p05.toFixed(4)}  ${f.p50.toFixed(4)}  ${f.p95.toFixed(4)}  ${f.max.toFixed(4)}  ${f.above85.toFixed(4)}  ${f.above94.toFixed(4)}   ${f.steps}` : '     —  (no face crop at this view)'));
}
console.log('\nreference band for a FACE crop (DECISIONS §42): >0.85 share is 0.311 / 0.341 on the two plates.');
console.log('⚠️ NOT like-for-like: the reference figure is a TIGHT face crop, this band also carries dough.');
console.log('   The paired before/after on this identical mask-relative band is the quantity to steer on.');
await writeFile(`${OUT}/facestats.json`, JSON.stringify(rows, null, 2));
