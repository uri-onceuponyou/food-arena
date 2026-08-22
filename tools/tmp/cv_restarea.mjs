#!/usr/bin/env node
/**
 * CV RESTAREA — "is there anywhere quiet for the eye?", as a number.
 *
 * ## The question
 * Round 2's blind critic scored ours 5 against a plate's 8 and named one mechanism:
 * *"our environment has no low-contrast rest area — there is nowhere quiet for the eye,
 * so nothing reads as subject vs. ground."* The measurement offered with it was **luma
 * standard deviation inside 54 px cells**, every frame first normalised to 1176 px wide,
 * summarised by the MEDIAN cell.
 *
 * That number was handed to me. `CLAUDE.md`: a count written from memory is wrong here at
 * roughly coin-flip rate, whoever it came from — so this file exists to RE-DERIVE it on
 * the same pixels and then to measure the same quantity after a change, in one session.
 *
 * ## Why the median cell and not the frame's SD
 * A whole-frame SD is dominated by the frame's biggest value STEP (floor vs prop), which
 * is composition and is not the complaint. The complaint is *local* busy-ness: how much
 * value churn sits inside a patch the size of a thumb. A per-cell SD measures exactly
 * that, and the MEDIAN cell answers "what is a typical piece of this frame like" rather
 * than "what is the worst piece like". Both are printed.
 *
 * ## 🚨 Rule 6 — what would make this instrument fail
 * `[].every()` returns `true`, and a statistic over an empty cell set is a confident
 * wrong answer. `--selftest` runs six arms and every one names an implementation that
 * would fail it:
 *
 *   §A NON-EMPTY   a region or mask that selects ZERO cells must EXIT NON-ZERO, never
 *                  return a number. (Fails a build that reports NaN or 0 as "quiet".)
 *   §B SELF-PAIR   the same file measured twice must agree to the last bit. (Fails any
 *                  hidden randomness in the resize or the cell grid.)
 *   §C ORDERS      flat < blurred-stripe < stripe, strictly. (Fails a statistic that is
 *                  insensitive to the axis, e.g. one computed on hue.)
 *   §D KNOWN-BAD   the ACTUAL defect: a slab carrying `makeBrushedMetalTexture`'s own
 *                  band law (grey 0.5..1.0, 9 cycles) must read strictly higher than the
 *                  same slab with the swing compressed. If this arm is flat, the tool
 *                  cannot see the thing this round changes and no number below means
 *                  anything.
 *   §E NORMALISED  the same content rendered at 1400 px and at 2100 px wide must land
 *                  within 1.5 SD of each other. (Fails a build that forgot the resize:
 *                  cell SD is a SPATIAL FREQUENCY statistic and is meaningless across
 *                  resolutions. This is why the critic normalised, and it is the arm
 *                  that catches me quietly dropping it.)
 *   §F NOT-ALIASING the supersample control the critic ran: 2x lanczos down then back up
 *                  must NOT collapse a real geometric/albedo stripe. Encoded so the
 *                  "it's just aliasing" hypothesis is refutable rather than asserted.
 *
 * ## What this tool CANNOT tell you
 * `docs/LESSONS.md` §6b: it says what is busy. It does NOT say that quieting it is what
 * the viewer reacts to. Median cell SD governs the WHOLE frame here (every cell, no
 * filtering), which is more than most metrics in this repo can claim — but a 4-point
 * critic gap has survived four closed hypotheses already.
 *
 *   node tools/tmp/cv_restarea.mjs --frames a.png,b.png [--json out.json]
 *   node tools/tmp/cv_restarea.mjs --frames a.png --mask ablation.png
 *   node tools/tmp/cv_restarea.mjs --selftest
 */
import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { basename } from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}

const NORM_W = Number(args.norm ?? 1176);   // the critic's normalisation, restated
const CELL = Number(args.cell ?? 54);       // the critic's cell, restated
const FLAT = Number(args.flat ?? 6);        // "near-flat" threshold, restated

const R709 = [0.2126, 0.7152, 0.0722];

/** Luma plane at the normalised width. Deterministic: fixed kernel, fixed width. */
async function lumaPlane(src) {
  const img = sharp(src).removeAlpha().resize({ width: NORM_W, kernel: 'lanczos3' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const L = new Float64Array(w * h);
  for (let i = 0, p = 0; i < L.length; i++, p += c) {
    L[i] = R709[0] * data[p] + R709[1] * data[p + 1] + R709[2] * data[p + 2];
  }
  return { L, w, h };
}

/** Every FULL cell in the grid. Partial edge cells are dropped — a half cell has half
 *  the samples and a systematically different SD, which would make the statistic depend
 *  on the frame's aspect ratio rather than on its content. */
function cells({ L, w, h }) {
  const out = [];
  const nx = Math.floor(w / CELL), ny = Math.floor(h / CELL);
  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx < nx; cx++) {
      let s = 0, s2 = 0;
      const x0 = cx * CELL, y0 = cy * CELL;
      for (let y = y0; y < y0 + CELL; y++) {
        const row = y * w;
        for (let x = x0; x < x0 + CELL; x++) { const v = L[row + x]; s += v; s2 += v * v; }
      }
      const n = CELL * CELL;
      const mean = s / n;
      const varr = Math.max(0, s2 / n - mean * mean);
      out.push({ cx, cy, x0, y0, mean, sd: Math.sqrt(varr) });
    }
  }
  return { list: out, nx, ny };
}

const median = (a) => {
  if (a.length === 0) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (v) => (v === null ? null : Math.round(v * 10) / 10);

/**
 * The nine-box region grid. The critic quoted three boxes by eye ("left-lower box /
 * right box / top box"); those bounds are not recoverable from its prose, so this
 * defines its OWN grid and says so. Comparisons below are grid-to-grid, ours against
 * plates, never against the critic's three numbers.
 */
function regions({ list, nx, ny }) {
  const bx = (i) => (i < nx / 3 ? 0 : i < (2 * nx) / 3 ? 1 : 2);
  const by = (j) => (j < ny / 3 ? 0 : j < (2 * ny) / 3 ? 1 : 2);
  const grid = {};
  for (const c of list) {
    const k = `${['top', 'mid', 'low'][by(c.cy)]}_${['left', 'centre', 'right'][bx(c.cx)]}`;
    (grid[k] ??= []).push(c.sd);
  }
  const out = {};
  for (const [k, v] of Object.entries(grid)) {
    // §A: a region that selected nothing is a bug, not a quiet region.
    if (v.length === 0) { console.error(`cv_restarea: region ${k} selected ZERO cells`); process.exit(3); }
    out[k] = { n: v.length, median: r2(median(v)) };
  }
  return out;
}

async function measure(src, maskPath) {
  const plane = await lumaPlane(src);
  const C = cells(plane);
  if (C.list.length === 0) { console.error(`cv_restarea: ${src} produced ZERO full cells`); process.exit(3); }

  let list = C.list;
  let maskInfo = null;
  if (maskPath) {
    // Ablation mask: a cell belongs to the subject if >= half its pixels are the
    // unmissable green. `AGENT-BRIEF §4.2` — ablate, do not diff.
    const m = sharp(maskPath).removeAlpha().resize({ width: NORM_W, kernel: 'nearest' });
    const { data, info } = await m.raw().toBuffer({ resolveWithObject: true });
    const { width: mw, height: mh, channels: mc } = info;
    if (mw !== plane.w || mh !== plane.h) {
      console.error(`cv_restarea: mask ${mw}x${mh} != frame ${plane.w}x${plane.h}`); process.exit(3);
    }
    const keep = [];
    for (const c of C.list) {
      let hit = 0;
      for (let y = c.y0; y < c.y0 + CELL; y++) {
        for (let x = c.x0; x < c.x0 + CELL; x++) {
          const p = (y * mw + x) * mc;
          if (data[p + 1] > 160 && data[p] < 110 && data[p + 2] < 110) hit++;
        }
      }
      if (hit >= (CELL * CELL) / 2) keep.push(c);
    }
    // §A NON-EMPTY, the arm that matters most: a mask that selects nothing must not
    // silently report a beautiful zero.
    if (keep.length === 0) {
      console.error(`cv_restarea: mask ${maskPath} selected ZERO cells of ${C.list.length} — refusing to report`);
      process.exit(3);
    }
    maskInfo = { cellsKept: keep.length, ofCells: C.list.length, share: Math.round((keep.length / C.list.length) * 1000) / 10 };
    list = keep;
  }

  const sds = list.map((c) => c.sd);
  const flatShare = (sds.filter((s) => s < FLAT).length / sds.length) * 100;
  return {
    src, w: plane.w, h: plane.h, cells: list.length,
    medianSD: r2(median(sds)),
    meanSD: r2(sds.reduce((a, b) => a + b, 0) / sds.length),
    p10SD: r2([...sds].sort((a, b) => a - b)[Math.floor(sds.length * 0.1)]),
    p90SD: r2([...sds].sort((a, b) => a - b)[Math.floor(sds.length * 0.9)]),
    maxSD: r2(Math.max(...sds)),
    flatPct: Math.round(flatShare * 10) / 10,
    mask: maskInfo,
    regions: maskPath ? null : regions(C),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — six arms, each naming an implementation it would fail.
// ⚠️ `AGENT-BRIEF §4.4`: a selftest validates this tool's LOGIC and says nothing about
// where it is POINTED. The pointing control is the mask's §B known-bad, run live.
// ─────────────────────────────────────────────────────────────────────────────

function synth(w, h, fn) {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = Math.max(0, Math.min(255, Math.round(fn(x, y))));
    const p = (y * w + x) * 3; buf[p] = v; buf[p + 1] = v; buf[p + 2] = v;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

/** `makeBrushedMetalTexture`'s own band law, restated so §D tests the REAL defect.
 *  textures.ts: rows = 48, shade = 0.5 + 0.5 * (0.5 + 0.5 * sin(i/rows * 2π * 9)).
 *  `swing` = 1 reproduces it; `swing` = 0.25 is a compressed version of the same law. */
function brushedBand(i, rows, swing) {
  const base = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin((i / rows) * Math.PI * 2 * 9));  // 0.5..1.0
  const mid = 0.75;
  return mid + (base - mid) * swing;
}

async function selftest() {
  const fails = [];
  const ok = (name, cond, detail) => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
    if (!cond) fails.push(name);
  };
  const tmp = process.env.TMPDIR ?? '/tmp';
  const W = 1400, H = 900;
  const p = (n) => `${tmp}/cv_restarea_${n}.png`;

  await writeFile(p('flat'), await synth(W, H, () => 128));
  await writeFile(p('stripe'), await synth(W, H, (x, y) => (Math.floor(y / 4) % 2 ? 200 : 60)));
  const blur = await sharp(await synth(W, H, (x, y) => (Math.floor(y / 4) % 2 ? 200 : 60))).blur(6).png().toBuffer();
  await writeFile(p('blurstripe'), blur);

  const mFlat = await measure(p('flat'));
  const mStripe = await measure(p('stripe'));
  const mBlur = await measure(p('blurstripe'));

  // §A NON-EMPTY — a full cell grid exists at all, on every arm.
  ok('§A NON-EMPTY', mFlat.cells > 0 && mStripe.cells > 0 && mBlur.cells > 0,
    `cells ${mFlat.cells}/${mStripe.cells}/${mBlur.cells}`);

  // §B SELF-PAIR — identical input, identical output, to the digit.
  const again = await measure(p('stripe'));
  ok('§B SELF-PAIR', JSON.stringify(again) === JSON.stringify(mStripe),
    `medianSD ${mStripe.medianSD} twice`);

  // §C ORDERS — flat < blurred stripe < stripe, strictly. A statistic on hue would tie.
  ok('§C ORDERS', mFlat.medianSD < mBlur.medianSD && mBlur.medianSD < mStripe.medianSD,
    `${mFlat.medianSD} < ${mBlur.medianSD} < ${mStripe.medianSD}`);

  // §D KNOWN-BAD — the ACTUAL defect law, full swing vs compressed swing.
  const rows = 48, per = H / rows;
  await writeFile(p('brush1'), await synth(W, H, (x, y) => 235 * brushedBand(Math.floor(y / per), rows, 1)));
  await writeFile(p('brush025'), await synth(W, H, (x, y) => 235 * brushedBand(Math.floor(y / per), rows, 0.25)));
  const b1 = await measure(p('brush1')), b025 = await measure(p('brush025'));
  ok('§D KNOWN-BAD', b025.medianSD < b1.medianSD - 1,
    `brushed swing 1.00 -> ${b1.medianSD} ; swing 0.25 -> ${b025.medianSD}`);

  // §E NORMALISED — same content, two source resolutions, same answer. Catches a build
  // that dropped the resize: cell SD is a spatial-frequency statistic.
  const bigBuf = await sharp(p('stripe')).resize({ width: 2100, kernel: 'lanczos3' }).png().toBuffer();
  await writeFile(p('stripe_big'), bigBuf);
  const mBig = await measure(p('stripe_big'));
  ok('§E NORMALISED', Math.abs(mBig.medianSD - mStripe.medianSD) < 1.5,
    `1400px ${mStripe.medianSD} vs 2100px ${mBig.medianSD}`);

  // §F NOT-ALIASING — the critic's supersample control, encoded. A real stripe survives
  // a 2x down/up round trip; pure aliasing would not.
  const ssBuf = await sharp(p('brush1')).resize({ width: Math.round(W / 2), kernel: 'lanczos3' })
    .resize({ width: W, kernel: 'lanczos3' }).png().toBuffer();
  await writeFile(p('brush1_ss'), ssBuf);
  const mSS = await measure(p('brush1_ss'));
  ok('§F NOT-ALIASING', mSS.medianSD > b1.medianSD * 0.7,
    `brushed ${b1.medianSD} -> supersampled ${mSS.medianSD}`);

  // §A' the mask arm's non-empty guard actually EXITS. Run out-of-process so a
  // process.exit(3) is observable rather than fatal here.
  const { spawnSync } = await import('node:child_process');
  await writeFile(p('nomask'), await synth(W, H, () => 40));
  const r = spawnSync(process.execPath, [process.argv[1], '--frames', p('flat'), '--mask', p('nomask')],
    { encoding: 'utf8' });
  ok("§A' EMPTY-MASK EXITS", r.status === 3 && /ZERO cells/.test(r.stderr),
    `exit ${r.status}`);

  console.log(fails.length ? `\nSELFTEST FAIL: ${fails.join(', ')}` : '\nSELFTEST PASS — 7 arms');
  process.exit(fails.length ? 1 : 0);
}

async function expand(spec) {
  const out = [];
  for (const s of String(spec).split(',').filter(Boolean)) {
    if (statSync(s).isDirectory()) {
      for (const f of (await readdir(s)).sort()) if (f.endsWith('.png') && !f.includes('.drift.')) out.push(`${s}/${f}`);
    } else out.push(s);
  }
  return out;
}

if (args.selftest) { await selftest(); }

if (!args.frames) { console.error('cv_restarea: --frames required (file, dir, or comma list)'); process.exit(2); }
const files = await expand(args.frames);
if (files.length === 0) { console.error('cv_restarea: --frames expanded to ZERO files'); process.exit(3); }

const results = [];
for (const f of files) results.push(await measure(f, args.mask ? String(args.mask) : null));

console.log(`cell ${CELL}px · normalised to ${NORM_W}px wide · luma Rec.709 · flat = SD<${FLAT}`);
console.log('');
console.log('  frame                              cells  medianSD  meanSD  p10   p90    max   flat%');
for (const r of results) {
  console.log(`  ${basename(r.src).padEnd(34)} ${String(r.cells).padStart(5)}  ${String(r.medianSD).padStart(8)}  ${String(r.meanSD).padStart(6)}  ${String(r.p10SD).padStart(4)}  ${String(r.p90SD).padStart(5)}  ${String(r.maxSD).padStart(5)}  ${String(r.flatPct).padStart(5)}`);
  if (r.mask) console.log(`      mask kept ${r.mask.cellsKept}/${r.mask.ofCells} cells (${r.mask.share}%)`);
}
if (results[0]?.regions) {
  console.log('\n  region medians (this tool\'s own 3x3 grid — NOT the critic\'s three hand-drawn boxes)');
  const keys = ['top_left', 'top_centre', 'top_right', 'mid_left', 'mid_centre', 'mid_right', 'low_left', 'low_centre', 'low_right'];
  console.log(`  ${'frame'.padEnd(26)}${keys.map((k) => k.padStart(11)).join('')}`);
  for (const r of results) {
    console.log(`  ${basename(r.src).padEnd(26)}${keys.map((k) => String(r.regions[k]?.median ?? '-').padStart(11)).join('')}`);
  }
  console.log('  quietest region per frame:');
  for (const r of results) {
    const best = Object.entries(r.regions).sort((a, b) => a[1].median - b[1].median)[0];
    console.log(`    ${basename(r.src).padEnd(26)} ${best[0]} ${best[1].median}`);
  }
}

if (args.json) { await writeFile(String(args.json), JSON.stringify({ NORM_W, CELL, FLAT, results }, null, 1)); console.log(`\nwrote ${args.json}`); }
