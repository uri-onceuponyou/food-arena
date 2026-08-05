#!/usr/bin/env node
/**
 * pp_pack — pair our part crops with the reference's, at matched scale, and run
 * the checks that decide whether the pair is worth handing to a critic.
 *
 * THROWAWAY, read-only. Writes only under `shots/perpart/`.
 *
 * ── WHAT "MATCHED" MEANS HERE, PRECISELY ────────────────────────────────────
 * Both sides are scaled so the PART's own box is `--h` px tall, then padded into
 * the same canvas filled with the same field. So the two panels agree on:
 *   · the field colour            (read from `ours.json`, never re-derived)
 *   · the part's height in pixels (the scale is derived, not eyeballed)
 *   · the margin around the part  (the same fraction on both sides, by
 *                                  construction — `pp_ref` expands its authored
 *                                  box by `pp_ours`'s own `pairMargin`)
 *   · the canvas size
 * and differ only in the art. That is the entire claim.
 *
 * ── THE CHECKS, AND THE KNOWN-BADS THAT PROVE THEY CAN FAIL ─────────────────
 * Every run builds its own broken inputs and asserts the checks refuse them. A
 * check that has never been shown to FAIL on the fault it guards is not a check;
 * nineteen instruments on this project were caught returning confident wrong
 * answers in a single session, including a `selfPair` assertion phrased so that NO
 * implementation could fail it.
 *
 *   FIELD MATCH   the two panels' background colour must agree. Known-bad: the
 *                 reference panel on its ORIGINAL plate background.
 *   SELF-PAIR     a panel against ITSELF must score exactly 0 on every panel
 *                 statistic — and the value 0 is asserted, not merely its
 *                 stability, because `metric(a) - metric(a)` is zero for any pure
 *                 function and proves nothing (docs/LESSONS.md §13).
 *   DEGRADATION   a deliberately degraded copy of a panel must move the
 *                 statistics in the direction degradation moves them. Known-bad
 *                 by construction: blur + desaturate + posterise.
 *   FRAMING MATCH the part must fill the same fraction of the crop on both sides.
 *
 * ⚠️ AND THE ONE NO NUMBER CAUGHT. All five checks passed on a run where FOUR
 * panels showed the wrong body part, because a fixed square canvas was clipping
 * wide crops (see `scalePanel`). Looking at the PNG is not a formality here; it is
 * the only check that has ever caught a fault of that class on this project.
 *
 * ⚠️ The panel statistics are DESCRIPTORS, not a quality score. They say how much
 * local contrast, chroma and edge energy a panel carries. They cannot tell you
 * whether a shape is well designed — that is what the blind critic is for, and
 * this tool's job is only to make sure the critic is shown two panels that differ
 * in the art and in nothing else.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import {
  loadRGBA, writeRGBA, padToCanvas, maskFromField, figureGround, panelStats, fieldStats, rgbDist,
} from './pp_lib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const OUT = get('--out', 'shots/perpart');
const OURS_JSON = get('--ours', `${OUT}/_raw/ours.json`);
const REF_JSON = get('--ref', `${OUT}/_raw/ref.json`);
const TARGET = Number(get('--h', 640));       // part height, in px, on both sides
const CANVAS = Number(get('--canvas', 1.45)); // canvas = TARGET * this, square

/**
 * Scale so the PART is `TARGET` px tall. The canvas is decided afterwards, from
 * BOTH sides at once.
 *
 * ⚠️ Round 1 padded into a fixed square of `TARGET * 1.45` and every numeric check
 * passed while FOUR panels showed the wrong body part. A wide-short part scales to
 * a very wide image — our feet crop is 888x193, so at the 4.13x needed to make the
 * feet 640 px tall it becomes 3667x797 — and centring that in a 928 px square
 * keeps the middle 928 px, which for a pair of splayed feet is the GAP BETWEEN
 * THEM. The `legs`, `arms` and `torso` panels were showing the apron.
 * Nothing in FIELD MATCH, FRAMING MATCH, SELF-PAIR, DEGRADATION or KNOWN-BAD
 * FIELD could see it; looking at the PNG is what saw it.
 */
async function scalePanel(pngPath, partBox) {
  const img = await loadRGBA(pngPath);
  const k = TARGET / partBox.h;
  const nw = Math.max(1, Math.round(img.width * k)), nh = Math.max(1, Math.round(img.height * k));
  const buf = await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } })
    .resize(nw, nh, { kernel: 'lanczos3', fit: 'fill' })
    .raw().toBuffer();
  return { scaled: { data: buf, width: nw, height: nh }, scale: +k.toFixed(4) };
}

function degrade(img) {
  // Deliberately worse, in the three ways a critic reads as "unfinished": soft,
  // flat and banded. Used ONLY as a known-bad input for the statistics.
  const { width: w, height: h } = img;
  const out = Buffer.from(img.data);
  const src = Buffer.from(img.data);
  const R = 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
      const i = (yy * w + xx) * 4;
      r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
    }
    const o = (y * w + x) * 4;
    let rr = r / n, gg = g / n, bb = b / n;
    const m = (rr + gg + bb) / 3;
    rr = m + (rr - m) * 0.45; gg = m + (gg - m) * 0.45; bb = m + (bb - m) * 0.45;   // desaturate
    const q = (v) => Math.round(Math.min(255, Math.max(0, v)) / 36) * 36;             // posterise
    out[o] = q(rr); out[o + 1] = q(gg); out[o + 2] = q(bb); out[o + 3] = 255;
  }
  return { data: out, width: w, height: h };
}

const ours = JSON.parse(await readFile(OURS_JSON, 'utf8'));
const ref = JSON.parse(await readFile(REF_JSON, 'utf8'));
const FIELD = ours.field.measured;
const refField = ref.field;
if (FIELD.r !== refField.r || FIELD.g !== refField.g || FIELD.b !== refField.b) {
  throw new Error(`field mismatch between the two sides: ours rgb(${FIELD.r},${FIELD.g},${FIELD.b}) vs ref rgb(${refField.r},${refField.g},${refField.b})`);
}

const figureH = (ours.parts.find((p) => p.part === 'figure-whole')?.paired?.partBox?.h) ?? null;
const refBy = new Map(ref.parts.map((p) => [p.part, p]));
const oursBy = new Map(ours.parts.map((p) => [p.part, p]));
const manifest = [];
const checks = [];

for (const rp of ref.parts) {
  const part = rp.part;
  const op = oursBy.get(part);
  if (rp.valid === false) {
    manifest.push({ part, valid: false, why: rp.why, oursPng: null, refPng: null });
    continue;
  }
  if (!op || !op.valid || !op.paired) {
    manifest.push({ part, valid: false, why: `our side produced no paired panel for "${part}"`, oursPng: null, refPng: null });
    continue;
  }
  const dir = `${OUT}/${part}`;
  await mkdir(dir, { recursive: true });

  const oursScaled = await scalePanel(op.paired.png, op.paired.partBox);
  const refScaled = await scalePanel(rp.raw, rp.partBox);
  // ONE canvas, sized to hold whichever side is larger, applied to both. Neither
  // panel is ever cropped by the canvas, and the two are dimensionally identical
  // so a critic cannot tell them apart by shape of frame.
  const cw = Math.max(oursScaled.scaled.width, refScaled.scaled.width) + 24;
  const chh = Math.max(oursScaled.scaled.height, refScaled.scaled.height) + 24;
  const oursPanel = { padded: await padToCanvas(oursScaled.scaled, cw, chh, FIELD), scale: oursScaled.scale };
  const refPanel = { padded: await padToCanvas(refScaled.scaled, cw, chh, FIELD), scale: refScaled.scale };

  const oursPath = `${dir}/ours.png`, refPath = `${dir}/ref.png`;
  await writeRGBA(oursPath, oursPanel.padded);
  await writeRGBA(refPath, refPanel.padded);

  // A side-by-side, for a HUMAN to look at. Never handed to a blind critic — a
  // single sheet with both panels is how position bias gets in.
  const pw = oursPanel.padded.width, ph = oursPanel.padded.height;
  const sbs = Buffer.alloc(pw * 2 * ph * 4);
  for (let y = 0; y < ph; y++) {
    oursPanel.padded.data.copy(sbs, (y * pw * 2) * 4, y * pw * 4, (y + 1) * pw * 4);
    refPanel.padded.data.copy(sbs, (y * pw * 2 + pw) * 4, y * pw * 4, (y + 1) * pw * 4);
  }
  await writeRGBA(`${dir}/_sidebyside.png`, { data: sbs, width: pw * 2, height: ph });

  const om = maskFromField(oursPanel.padded, FIELD, 10);
  const rm = maskFromField(refPanel.padded, FIELD, 10);
  const oField = fieldStats(oursPanel.padded, om), rField = fieldStats(refPanel.padded, rm);
  const row = {
    part,
    valid: true,
    kind: op.kind,
    oursPng: oursPath,
    refPng: refPath,
    sideBySide: `${dir}/_sidebyside.png`,
    refSource: `${rp.plate} — box [${rp.partBox.x0},${rp.partBox.y0} ${rp.partBox.w}x${rp.partBox.h}] of a ${ref.matte.plate.W}x${ref.matte.plate.H} plate`,
    refNote: rp.note ?? null,
    scale: { ours: oursPanel.scale, ref: refPanel.scale, partHeightPx: TARGET, canvas: [cw, chh] },
    framing: {
      oursPartHeightFracOfCrop: op.paired.partHeightFracOfCrop,
      refPartHeightFracOfCrop: rp.partHeightFracOfCrop,
    },
    field: { ours: oField, ref: rField, driftRGB: oField && rField ? rgbDist(oField, rField) : null },
    figureGround: {
      ours: part === 'silhouette-whole' ? null : figureGround(oursPanel.padded, om, 4),
      ref: part === 'silhouette-whole' ? null : figureGround(refPanel.padded, rm, 4),
    },
    panel: { ours: panelStats(oursPanel.padded, om), ref: panelStats(refPanel.padded, rm) },
    delivered: { ratio: op.deliveredRatio, isolatedPx: op.isolatedPx, deliveredPx: op.deliveredPx },
    diagnosticIsolationPng: op.raw,
    // ── TRAP 3, made a number instead of a caveat ────────────────────────────
    // `docs/LESSONS.md` §6: isolation views sat at 265wu while the game showed
    // ~578wu and every arena loop was judged at ~3.5x the real zoom. This panel is
    // deliberately blown up, so the blow-up is stated rather than implied.
    // `partHeightFracOfFigure` is scale-free; `blowUpVsShipped` is how much bigger
    // this panel shows the part than the shipped 900x1400 character-detail render
    // does. A finding on a part with a large blow-up needs re-checking at size.
    shippedSize: {
      partHeightPxAtShippedRender: op.paired.partBox.h,
      figureHeightPxAtShippedRender: figureH,
      partHeightFracOfFigure: figureH ? +(op.paired.partBox.h / figureH).toFixed(4) : null,
      blowUpVsShipped: +(TARGET / op.paired.partBox.h).toFixed(2),
    },
    // How much of the panel is the part. `arms` and `legs` are splayed, so their
    // boxes are wide bands with the body filling the middle — the panel is honest
    // (the reference's box is the same band) but it is NOT a tight isolation, and
    // a low number here says so.
    partAreaFracOfCrop: op.paired.partAreaFracOfCrop,
  };
  manifest.push(row);
  console.log(`  ${part.padEnd(18)} ours x${oursPanel.scale} ref x${refPanel.scale}`
    + ` fieldDrift ${row.field.driftRGB}`
    + ` fgOurs ${row.figureGround.ours ? row.figureGround.ours.contrast : 'n/a'}`
    + ` fgRef ${row.figureGround.ref ? row.figureGround.ref.contrast : 'n/a'}`);
}

// ── CHECKS ───────────────────────────────────────────────────────────────────
const valid = manifest.filter((m) => m.valid);
const fieldWorst = Math.max(...valid.map((m) => m.field.driftRGB ?? 0));
checks.push({ name: 'FIELD MATCH', value: fieldWorst, bound: 3, pass: fieldWorst <= 3,
  what: 'worst RGB distance between the two panels\' own backgrounds' });

const framingWorst = Math.max(...valid.map((m) => Math.abs(m.framing.oursPartHeightFracOfCrop - m.framing.refPartHeightFracOfCrop)));
checks.push({ name: 'FRAMING MATCH', value: +framingWorst.toFixed(3), bound: 0.10, pass: framingWorst <= 0.10,
  what: 'worst difference in how much of the crop the part fills' });

// SELF-PAIR with an asserted IDENTITY. `metric(a) - metric(a)` is zero for any
// pure function; what is asserted here is the VALUE, on a pair that is identical
// by construction, which is the form docs/LESSONS.md §13 had to be corrected to.
{
  const p = valid[0];
  const img = await loadRGBA(p.oursPng);
  const m = maskFromField(img, FIELD, 10);
  const s1 = panelStats(img, m), s2 = panelStats(img, m);
  const keys = ['lumaMean', 'lumaStd', 'lumaRange', 'satMean', 'edgeDensity'];
  const worst = Math.max(...keys.map((k) => Math.abs(s1[k] - s2[k])));
  checks.push({ name: 'SELF-PAIR', value: worst, bound: 0, pass: worst === 0,
    what: `a panel against itself must read EXACTLY 0 on every statistic (${p.part})` });
}

// DEGRADATION — the known-bad the statistics are validated against.
{
  const p = valid.find((v) => v.part === 'figure-whole') ?? valid[0];
  const img = await loadRGBA(p.refPng);
  const m = maskFromField(img, FIELD, 10);
  const clean = panelStats(img, m);
  const bad = degrade(img);
  await writeRGBA(`${OUT}/_raw/knownbad.degraded.${p.part}.png`, bad);
  const dirty = panelStats(bad, m);
  const moves = {
    edgeDensity: +(dirty.edgeDensity - clean.edgeDensity).toFixed(5),
    satMean: +(dirty.satMean - clean.satMean).toFixed(4),
    lumaStd: +(dirty.lumaStd - clean.lumaStd).toFixed(4),
  };
  const ok = moves.edgeDensity < 0 && moves.satMean < 0;
  checks.push({ name: 'DEGRADATION', value: moves, bound: 'edgeDensity<0 and satMean<0', pass: ok,
    what: `blur+desaturate+posterise of the REFERENCE panel (${p.part}) must lower edge energy and chroma`,
    clean, dirty, png: `${OUT}/_raw/knownbad.degraded.${p.part}.png` });
}

// KNOWN-BAD FIELD — the reference panel on its ORIGINAL plate background. This is
// the failure this whole programme exists to avoid, and the FIELD MATCH check
// must refuse it.
{
  const plate = ref.plate;
  const p = valid.find((v) => v.part === 'hands') ?? valid[0];
  const rp = refBy.get(p.part);
  const raw = await loadRGBA(plate);
  const bx = rp.plateBox;
  const cropped = Buffer.alloc(bx.w * bx.h * 4);
  for (let y = 0; y < bx.h; y++) for (let x = 0; x < bx.w; x++) {
    const s = ((bx.y0 + y) * raw.width + (bx.x0 + x)) * 4, d = (y * bx.w + x) * 4;
    cropped[d] = raw.data[s]; cropped[d + 1] = raw.data[s + 1]; cropped[d + 2] = raw.data[s + 2]; cropped[d + 3] = 255;
  }
  const badPanel = { data: cropped, width: bx.w, height: bx.h };
  await writeRGBA(`${OUT}/_raw/knownbad.unmatted.${p.part}.png`, badPanel);
  // Measured on the crop's OUTER RING, not via `maskFromField`. On an unmatted
  // crop every pixel is "not our field", so `fieldStats` has no field pixels to
  // average and returns null — a check that answers `null` is not a check, it is
  // the tautology docs/LESSONS.md §13 warns about wearing a different hat. The
  // ring is a symmetric measure: on a matted panel it is the field by
  // construction, on an unmatted one it is the plate's own backdrop.
  const ring = (img, band = 6) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (x >= band && x < img.width - band && y >= band && y < img.height - band) continue;
      const i = (y * img.width + x) * 4;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
    return { r: r / n, g: g / n, b: b / n, n };
  };
  const badRing = ring(badPanel);
  const goodRing = ring(await loadRGBA(p.refPng));
  const drift = rgbDist(badRing, FIELD);
  const goodDrift = rgbDist(goodRing, FIELD);
  checks.push({
    name: 'KNOWN-BAD FIELD', value: { unmatted: drift, matted: goodDrift }, bound: 'unmatted > 3 AND matted <= 3',
    pass: drift > 3 && goodDrift <= 3,
    what: `the SAME reference crop (${p.part}) left on its own plate background: outer-ring colour sits ${drift} RGB from our field, against ${goodDrift} for the matted panel this tool actually emits`,
    png: `${OUT}/_raw/knownbad.unmatted.${p.part}.png`,
  });
}

// ── TWO CONTROL PAIRS, for the critic this tool cannot run ──────────────────
// The brief's own known-bad test is a CRITIC-level one: our part against our own
// part must tie, and a degraded reference against its clean original must score
// lower. `tools/review.mjs` builds packets for critic AGENTS, so those two
// numbers can only be produced by whoever dispatches the round. What this tool
// can do is BUILD the two pairs, in the identical format as every real pair, so
// the round can carry them as blind controls and the numbers exist.
//   `_control/selfpair`  — both panels are OUR figure-whole. Expected: a tie.
//                          Measured on a real round this is 6/6 and 5/5.
//   `_control/degraded`  — A is the clean REFERENCE panel, B is the same panel
//                          blurred, desaturated and posterised. Expected: B lower.
// If a round returns a non-tie on the first or a tie on the second, the round is
// discarded before anything is acted on, exactly as the +/-1.4 floor demands.
{
  const p = manifest.find((m) => m.valid && m.part === 'figure-whole');
  await mkdir(`${OUT}/_control/selfpair`, { recursive: true });
  await mkdir(`${OUT}/_control/degraded`, { recursive: true });
  const oursImg = await loadRGBA(p.oursPng);
  await writeRGBA(`${OUT}/_control/selfpair/a.png`, oursImg);
  await writeRGBA(`${OUT}/_control/selfpair/b.png`, oursImg);
  const refImg = await loadRGBA(p.refPng);
  await writeRGBA(`${OUT}/_control/degraded/a.png`, refImg);
  await writeRGBA(`${OUT}/_control/degraded/b.png`, degrade(refImg));
  console.log(`\ncontrol pairs written: ${OUT}/_control/selfpair (must TIE), ${OUT}/_control/degraded (b must score LOWER)`);
}

console.log('');
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(16)} ${JSON.stringify(c.value)}  (bound ${JSON.stringify(c.bound)})  — ${c.what}`);
}
const allPass = checks.every((c) => c.pass);
await mkdir(`${OUT}/_raw`, { recursive: true });
await writeFile(`${OUT}/manifest.json`, JSON.stringify({
  tool: 'pp_pack.mjs',
  character: ours.id,
  oursCamera: ours.camera,
  oursShippedPolarity: ours.shippedPolarity,
  field: FIELD,
  refPlate: ref.plate,
  targetPartHeightPx: TARGET,
  checks,
  parts: manifest,
}, null, 2));
console.log(`\nwrote ${OUT}/manifest.json — ${valid.length} valid pairs, ${manifest.length - valid.length} refused`);
if (!allPass) process.exit(4);
