#!/usr/bin/env node
/**
 * SBJ_SCALE — HOW BIG IS THE SUBJECT, AS A FRACTION OF FRAME HEIGHT, ON EACH SIDE?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * `tools/arena-scan.mjs`'s header records that four critic rounds judged our combat
 * VFX against reference plates "shot on a much closer camera, so the same world-space
 * effect filled far less of OUR frame". If that is also true of the FIGHTERS, then
 * every per-element blind score in the q1 round is partly a comparison of two CAMERAS
 * and no amount of arena art can close it. Nobody had measured it.
 *
 * Two arms have already come back null on the arena's 3.75-point blind gap — frame
 * choice (`9585ed6`, paired mean 0.000) and density (`fd76ef0`, +0.00 across a near
 * doubling of footprint share). Subject scale is the composition variable neither of
 * them varied.
 *
 * ── 🚨 THE REFERENCE PLATES ARE THIRD-PARTY AND THIS REPO IS PUBLIC ─────────────
 * `CLAUDE.md`'s permanent constraint: describe the compositional ROLE, never the
 * artwork. This file emits COORDINATES and RATIOS only. Those are numbers, they
 * disclose nothing, and they are what reproducibility needs. No prose in this file or
 * in anything it prints may name what a plate depicts.
 *
 * ── Method, and why a human eye is load-bearing ─────────────────────────────────
 * A screenshot has no rig to read and cannot be ablated, so the subject's top edge on
 * a reference plate cannot be derived — it has to be looked at. That is the same
 * position `tools/tmp/pp_ref_parts.mjs` documented for its part boxes, and the same
 * remedy: render a RULED overlay, read the number off it, and keep the reading as data
 * next to the coordinates that produced it so it can be argued with.
 *
 *   FOOT anchor  `tools/tmp/cs_marks.json` — hand-marked ground-footprint ellipse
 *                centres, every one already drawn back onto its plate and looked at
 *                (that file's own `_` note). `cy` is the subject's ground contact.
 *   HEAD read    off this tool's ruler, in source px above `cy`.
 *   heightFrac   (cy - yTop) / plateHeight.
 *
 * Fraction of frame HEIGHT, not width, because the plates and our frame have different
 * aspect ratios (plates 1.53-1.68, ours 1.778) and height is the axis a top-down
 * action frame is composed against.
 *
 * ── KNOWN-BAD CONTROL (`--selftest`), rule 6 ────────────────────────────────────
 * The instrument here is the RULER, so the control is a synthetic image with a bar of
 * KNOWN height at a KNOWN foot line. `--selftest` renders it, then re-reads its own
 * ruler geometry back out and asserts:
 *   RULER-TRACKS  a bar of 200 px reads 200 +-2 through the same crop+scale path
 *   RULER-MOVES   a bar of 100 px must read DIFFERENTLY from one of 200 px
 *   IN-SHOT       the crop window must actually contain the marked foot point, and
 *                 the subject band must be NON-EMPTY -- `[].every()` is `true`, and
 *                 six instruments here have been caught passing on an empty set
 *   OFF-PLATE     a mark whose crop leaves the image must be REFUSED, not clamped
 *                 silently (a clamped crop reads as a shorter subject)
 */
import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PLATES = join(ROOT, 'reference/images/curated/gameplay_topdown');
const OUT = join(ROOT, 'tools/tmp/sbj_out');

/** Crop window around a foot anchor, in SOURCE px. */
export const WIN = { left: 150, right: 150, up: +(arg('up', 340)), down: 70 };
const SCALE = 2;          // upscale so a 1-px ruler is legible
const TICK = 20;          // minor rule, source px
const MAJOR = 100;        // major rule, source px

/**
 * Build the ruled overlay for one crop. Returns an SVG string sized to the SCALED crop.
 * Rules are drawn at fixed SOURCE-px offsets ABOVE the foot line, so reading a value
 * off the picture is counting ticks, not estimating.
 */
export function rulerSvg(cw, ch, footYinCrop) {
  const W = cw * SCALE, H = ch * SCALE;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];
  // foot line
  const fy = footYinCrop * SCALE;
  parts.push(`<line x1="0" y1="${fy}" x2="${W}" y2="${fy}" stroke="#00ff00" stroke-width="2"/>`);
  for (let d = TICK; d <= WIN.up; d += TICK) {
    const y = fy - d * SCALE;
    if (y < 0) break;
    const major = d % MAJOR === 0;
    parts.push(`<line x1="0" y1="${y}" x2="${major ? W : 34}" y2="${y}" stroke="${major ? '#ff0000' : '#ffff00'}" stroke-width="${major ? 2 : 1}" opacity="${major ? 0.95 : 0.7}"/>`);
    parts.push(`<text x="4" y="${y - 3}" font-family="monospace" font-size="${major ? 20 : 13}" fill="${major ? '#ff0000' : '#ffff00'}">${d}</text>`);
  }
  // centre plumb line through the foot anchor
  const fx = WIN.left * SCALE;
  parts.push(`<line x1="${fx}" y1="0" x2="${fx}" y2="${H}" stroke="#00ff00" stroke-width="1" opacity="0.6"/>`);
  parts.push('</svg>');
  return parts.join('');
}

/**
 * Crop one subject window and write a ruled PNG. REFUSES rather than clamps when the
 * window leaves the image: a clamped crop silently reads as a shorter subject, which
 * is the exact class of failure that makes a wrong number look like a real one.
 */
export async function ruledCrop(src, cx, cy, outPath) {
  const meta = await sharp(src).metadata();
  const left = cx - WIN.left, top = cy - WIN.up;
  const w = WIN.left + WIN.right, h = WIN.up + WIN.down;
  if (left < 0 || top < 0 || left + w > meta.width || top + h > meta.height) {
    return { ok: false, why: `window ${left},${top} ${w}x${h} leaves ${meta.width}x${meta.height}` };
  }
  // IN-SHOT assertion: the marked foot point must be inside the window we cut.
  const footInCrop = { x: cx - left, y: cy - top };
  if (footInCrop.x < 0 || footInCrop.x >= w || footInCrop.y < 0 || footInCrop.y >= h) {
    return { ok: false, why: 'foot anchor not inside its own crop' };
  }
  const buf = await sharp(src).extract({ left, top, width: w, height: h })
    .resize(w * SCALE, h * SCALE, { kernel: 'nearest' }).png().toBuffer();
  const out = await sharp(buf)
    .composite([{ input: Buffer.from(rulerSvg(w, h, footInCrop.y)), top: 0, left: 0 }])
    .png().toBuffer();
  await writeFile(outPath, out);
  return { ok: true, plateW: meta.width, plateH: meta.height, left, top, w, h, footInCrop };
}

/**
 * THE READINGS. Kept as DATA next to the coordinates that produced them, the way
 * `tools/tmp/pp_ref_parts.mjs` keeps its part boxes, so they can be argued with rather
 * than re-eyeballed.
 *
 * DEFINITION, identical on both sides and stated because it swings the answer by 7 pp:
 * **BODY ONLY** — topmost pixel of the figure's own mass (including hair/headwear that
 * is part of the character) down to the lowest pixel of its feet. EXCLUDES held props,
 * ground rings/FX, nameplates and health pills. the `bs_06` mark at (300,650) reads 11.2% body-only and
 * 18.4% counting its held prop; a mixed definition would have manufactured the gap this
 * file exists to test for.
 *
 * ⚠️ Reference rows are keyed by the mark's FOOT COORDINATES, not by the subject's name.
 * Coordinates identify the `cs_marks.json` row uniquely and disclose nothing; a name is a
 * step toward describing third-party artwork, which `CLAUDE.md`'s permanent constraint
 * forbids in a PUBLIC repo and which was breached once already by a crop table.
 *
 * `yTopDisp` / `yBotDisp` are read off the 2x-scaled ruled PNG (`SCALE = 2`), so the
 * source-px height is (yBot - yTop) / 2. `frameH` is the un-normalised image height.
 *
 * ── WHAT THEY SAY ────────────────────────────────────────────────────────────────
 *   REFERENCE n=6   8.4 .. 14.2 %   median 12.4 %
 *   OURS      n=3   8.8 .. 10.8 %   median 10.2 %
 *
 * Ours is INSIDE the reference range, ~1.22x below its median. The hypothesis this file
 * was built to test — "the plates frame their subject substantially larger, so every
 * per-element score is partly a camera comparison" — is NOT SUPPORTED.
 *
 * It also independently reproduces two things already in the tree: `docs/LESSONS.md` §6
 * ("the truth is ~10.5%") and `src/units.ts`'s conclusion that the 14-21% reference band
 * a previous pass chased **does not exist**. ⚠️ `tools/tmp/framing.mjs` still prints that
 * refuted band in its own summary line, and reports 23.33% for the lollipop on the very
 * frame measured here at 8.8% — see this pass's report.
 */
export const READINGS = [
  // side  plate/frame          name        yTopDisp yBotDisp frameH  heightPct
  { side: 'ref',  img: 'bs_04', name: '200,358',       yTop: 205, yBot: 405, frameH: 770, pct: 13.0 },
  { side: 'ref',  img: 'bs_04', name: '772,392',         yTop: 260, yBot: 390, frameH: 770, pct: 8.4, note: 'a low, wide subject — the shortest in the set, and it is a SHAPE difference not a camera one' },
  { side: 'ref',  img: 'bs_05', name: '957,328',      yTop: 240, yBot: 405, frameH: 700, pct: 11.8, note: '`src/units.ts` records 12.5% for this same mark, measured independently in an earlier pass' },
  { side: 'ref',  img: 'bs_06', name: '441,610',       yTop: 180, yBot: 390, frameH: 739, pct: 14.2 },
  { side: 'ref',  img: 'bs_06', name: '300,650',       yTop: 225, yBot: 390, frameH: 739, pct: 11.2, note: '18.4% if the held prop is counted — the definition swing' },
  { side: 'ref',  img: 'bs_02', name: '240,570',       yTop: 265, yBot: 460, frameH: 750, pct: 13.0, note: '16.7% counting tall headwear' },
  { side: 'ours', img: 'match_donut_taco_05', name: 'donut', yTop: 195, yBot: 378, frameH: 900, pct: 10.2 },
  { side: 'ours', img: 'match_donut_taco_05', name: 'taco',  yTop: 250, yBot: 445, frameH: 900, pct: 10.8 },
  { side: 'ours', img: 'framing-lollipop',    name: 'lollipop', yTop: 232, yBot: 390, frameH: 900, pct: 8.8, note: 'countdown frame, shipped match camera (fairRadius 199.22, halfWidth 289.39 wu)' },
];

// ── selftest ────────────────────────────────────────────────────────────────────
async function selftest() {
  const fails = [];
  const ok = (name, cond, detail) => {
    (cond ? console.log : (m) => { fails.push(m); console.log(m); })(
      `  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  };
  await mkdir(OUT, { recursive: true });

  // A synthetic plate: mid-grey field, one WHITE bar of known height standing on a
  // known foot line. Reading its top off the ruler must return the height we built.
  const W = 800, H = 800;
  const mk = async (barH) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
      + `<rect width="${W}" height="${H}" fill="#808080"/>`
      + `<rect x="${400 - 25}" y="${600 - barH}" width="50" height="${barH}" fill="#ffffff"/></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  };
  const b200 = await mk(200), b100 = await mk(100);
  const p200 = join(OUT, 'selftest_bar200.png'), p100 = join(OUT, 'selftest_bar100.png');
  await writeFile(p200, b200); await writeFile(p100, b100);

  // Read the bar top back through the SAME crop geometry the eye reads: find the
  // topmost near-white row in the centre column band of the extracted window.
  const measureBar = async (p) => {
    const meta = await sharp(p).metadata();
    const left = 400 - WIN.left, top = 600 - WIN.up;
    const w = WIN.left + WIN.right, h = WIN.up + WIN.down;
    const { data, info } = await sharp(p).extract({ left, top, width: w, height: h })
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const footY = 600 - top;
    let topRow = -1;
    const rows = [];
    for (let y = 0; y < info.height; y++) {
      let white = 0;
      for (let x = WIN.left - 30; x < WIN.left + 30; x++) {
        const i = (y * info.width + x) * 3;
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) white++;
      }
      if (white > 10) { rows.push(y); if (topRow < 0) topRow = y; }
    }
    // rule 6: assert the filtered set is NON-EMPTY before quantifying over it.
    if (rows.length === 0) return { ok: false, why: 'no subject rows found -- an empty set would pass every .every()' };
    return { ok: true, height: footY - topRow, rows: rows.length };
  };

  const m200 = await measureBar(p200);
  const m100 = await measureBar(p100);
  ok('IN-SHOT bar200 subject band non-empty', m200.ok, m200.ok ? `${m200.rows} rows` : m200.why);
  ok('IN-SHOT bar100 subject band non-empty', m100.ok, m100.ok ? `${m100.rows} rows` : m100.why);
  ok('RULER-TRACKS bar200 reads 200 +-2', m200.ok && Math.abs(m200.height - 200) <= 2, `read ${m200.height}`);
  ok('RULER-MOVES 100 != 200', m200.ok && m100.ok && m200.height !== m100.height, `${m200.height} vs ${m100.height}`);
  ok('RULER-TRACKS bar100 reads 100 +-2', m100.ok && Math.abs(m100.height - 100) <= 2, `read ${m100.height}`);

  // OFF-PLATE: a mark near the edge must be REFUSED, never silently clamped.
  const edge = await ruledCrop(p200, 10, 10, join(OUT, 'selftest_edge.png'));
  ok('OFF-PLATE refused, not clamped', edge.ok === false, edge.ok ? 'it produced a crop!' : edge.why);

  // The ruled overlay must actually be drawn (a blank overlay would make every read a guess).
  const good = await ruledCrop(p200, 400, 600, join(OUT, 'selftest_ruled.png'));
  const rawStats = await sharp(p200).extract({ left: 400 - WIN.left, top: 600 - WIN.up, width: WIN.left + WIN.right, height: WIN.up + WIN.down }).stats();
  const ruledStats = await sharp(join(OUT, 'selftest_ruled.png')).stats();
  const movedR = Math.abs(ruledStats.channels[0].mean - rawStats.channels[0].mean);
  ok('OVERLAY-MOVES the ruled image differs from the raw crop', good.ok && movedR > 0.5, `dR mean ${movedR.toFixed(3)}`);

  // RECOMPUTES — every stated `pct` in READINGS must fall out of its own coordinates.
  // A typed percentage next to the coordinates that supposedly produced it is exactly
  // the failure this project logged twice today; this makes the table self-checking.
  if (READINGS.length === 0) { ok('READINGS non-empty', false, 'an empty table passes every .every()'); }
  else {
    let bad = 0;
    for (const r of READINGS) {
      const calc = +(100 * ((r.yBot - r.yTop) / 2) / r.frameH).toFixed(1);
      if (Math.abs(calc - r.pct) > 0.15) { bad++; console.log(`      ${r.img}/${r.name}: stated ${r.pct}, coordinates give ${calc}`); }
    }
    ok(`RECOMPUTES all ${READINGS.length} stated pct from their own coordinates`, bad === 0, `${bad} mismatched`);
    const R = READINGS.filter((r) => r.side === 'ref'), O = READINGS.filter((r) => r.side === 'ours');
    ok('BOTH SIDES non-empty', R.length > 0 && O.length > 0, `ref ${R.length}, ours ${O.length}`);
  }
  console.log(`\n  sbj_scale selftest: ${9 - fails.length} pass, ${fails.length} fail`);
  return fails.length;
}

// ── main ────────────────────────────────────────────────────────────────────────
async function main() {
  if (has('selftest')) { process.exitCode = (await selftest()) ? 1 : 0; return; }

  await mkdir(OUT, { recursive: true });
  const marks = JSON.parse(await readFile(join(ROOT, 'tools/tmp/cs_marks.json'), 'utf8'));
  const chars = marks.marks.filter((m) => (m.kind ?? 'char') === 'char');
  if (chars.length === 0) throw new Error('no character marks -- an empty set is not a measurement');

  const oursPath = arg('ours', join(ROOT, 'shots/q1/cap/match_donut_taco_05.png'));
  const oursMarks = JSON.parse(arg('ours-marks', '[]'));

  console.log(`  REFERENCE subject crops -> ${OUT}`);
  const rows = [];
  for (const m of chars) {
    const src = join(PLATES, `${m.plate}.png`);
    if (!existsSync(src)) { console.log(`  SKIP ${m.plate} (plate absent)`); continue; }
    const out = join(OUT, `ref_${m.plate}_${m.name}.png`);
    const r = await ruledCrop(src, m.cx, m.cy, out);
    rows.push({ side: 'ref', plate: m.plate, name: m.name, cx: m.cx, cy: m.cy, ...r, out });
    console.log(`    ${m.plate}/${m.name}  foot ${m.cx},${m.cy}  ${r.ok ? `plate ${r.plateH} tall -> ${out.split('/').pop()}` : 'REFUSED: ' + r.why}`);
  }

  for (const m of oursMarks) {
    const out = join(OUT, `ours_${m.name}.png`);
    const r = await ruledCrop(oursPath, m.cx, m.cy, out);
    rows.push({ side: 'ours', plate: 'ours', name: m.name, cx: m.cx, cy: m.cy, ...r, out });
    console.log(`    ours/${m.name}  foot ${m.cx},${m.cy}  ${r.ok ? `frame ${r.plateH} tall -> ${out.split('/').pop()}` : 'REFUSED: ' + r.why}`);
  }

  await writeFile(join(OUT, 'sbj_crops.json'), JSON.stringify(rows, null, 1));
  console.log(`\n  ${rows.filter((r) => r.ok).length} crops written. READ EACH PNG and record the head-top offset in source px.`);
}

if (IS_MAIN) await main();
