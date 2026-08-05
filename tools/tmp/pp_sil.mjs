#!/usr/bin/env node
// pp_sil.mjs — silhouette shape metrics for the per-part critic panels.
// MEASUREMENT ONLY. Touches no game code.
//
// Metrics, all computed on the FIGURE BBOX only (so panel padding cannot move them):
//   mirrorIoU  — IoU of the mask with its own horizontal mirror, maximised over the
//                mirror axis. 1.000 = perfectly bilaterally symmetric.
//   interiorNeg— fraction of bbox background pixels that are ENCLOSED horizontally
//                (figure to the left AND right on the same row). This is the
//                "negative space that bites into the mass" a silhouette needs.
//   fill       — mask area / bbox area. Low = airy/gestural, high = one solid blob.
//   widthProfile — mask width per decile of height, normalised by max width.
//
// ⚠️ NON-NEGOTIABLE: every metric below has a KNOWN-BAD input in --selftest that it
// must FAIL on. A guard not shown to fail on the bug it guards against is not a guard.
import sharp from 'sharp';

async function maskFromPng(path) {
  const { data, info } = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
  return maskFromRaw(data, info.width, info.height);
}

// MEASURED (histogram probe): figure = luma 0, page = 255, frame = 87. A <96
// threshold swallows the frame AND — because ours.png's right wing ABUTS the frame —
// the border flood-fill then ate the entire figure and reported a negative bbox.
// That is exactly the "confident wrong answer" this project keeps catching, so the
// threshold is now <48 (pure black only) and the frame is cropped by value, not by
// connectivity. stripBorder is retained for the synthetic selftest only.
function maskFromRaw(data, w, h) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = data[i] < 48 ? 1 : 0;
  return { m, w, h };
}

// Report how many rows/cols of the figure touch the innermost page column/row —
// i.e. whether the panel CLIPS the silhouette it claims to show whole.
function edgeContact({ m, w, h }, data) {
  const isPage = (x, y) => data[y * w + x] === 255;
  // find the white page rect
  let px0 = 0, px1 = w - 1, py0 = 0, py1 = h - 1;
  const midY = (h / 2) | 0, midX = (w / 2) | 0;
  while (px0 < w && !isPage(px0, midY) && !m[midY * w + px0]) px0++;
  while (px1 > 0 && !isPage(px1, midY) && !m[midY * w + px1]) px1--;
  while (py0 < h && !isPage(midX, py0) && !m[py0 * w + midX]) py0++;
  while (py1 > 0 && !isPage(midX, py1) && !m[py1 * w + midX]) py1--;
  let left = 0, right = 0, top = 0, bottom = 0;
  for (let y = py0; y <= py1; y++) { if (m[y * w + px0]) left++; if (m[y * w + px1]) right++; }
  for (let x = px0; x <= px1; x++) { if (m[py0 * w + x]) top++; if (m[py1 * w + x]) bottom++; }
  return { page: `${px1 - px0 + 1}x${py1 - py0 + 1}`, clipRows: { left, right, top, bottom } };
}

function bboxOf({ m, w, h }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Strip a solid frame/border ring touching the image edge (the grey page border),
// by flood-filling dark pixels connected to the image boundary and clearing them.
function stripBorder(mask) {
  const { m, w, h } = mask;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => { const i = y * w + x; if (!seen[i] && m[i]) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(); const x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = m[i] && !seen[i] ? 1 : 0;
  return { m: out, w, h };
}

function crop(mask, bb) {
  const { m, w } = mask;
  const out = new Uint8Array(bb.w * bb.h);
  for (let y = 0; y < bb.h; y++) for (let x = 0; x < bb.w; x++)
    out[y * bb.w + x] = m[(y + bb.y0) * w + (x + bb.x0)];
  return { m: out, w: bb.w, h: bb.h };
}

function mirrorIoU({ m, w, h }) {
  // maximise IoU over integer mirror axes (in half-pixel steps via 2*axis)
  let best = 0, bestAxis = 0;
  for (let a2 = w - 1; a2 <= 3 * (w - 1); a2++) { // axis*2 sweep across the shape
    let inter = 0, uni = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xm = a2 - x;
      const a = m[y * w + x];
      const b = (xm >= 0 && xm < w) ? m[y * w + xm] : 0;
      if (a && b) inter++;
      if (a || b) uni++;
    }
    const iou = uni ? inter / uni : 0;
    if (iou > best) { best = iou; bestAxis = a2 / 2; }
  }
  return { mirrorIoU: best, axis: bestAxis };
}

function interiorNeg({ m, w, h }) {
  let enclosed = 0, bg = 0;
  for (let y = 0; y < h; y++) {
    let first = -1, last = -1;
    for (let x = 0; x < w; x++) if (m[y * w + x]) { if (first < 0) first = x; last = x; }
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) { bg++; if (first >= 0 && x > first && x < last) enclosed++; }
    }
  }
  return bg ? enclosed / bg : 0;
}

function fill({ m, w, h }) {
  let a = 0; for (let i = 0; i < w * h; i++) a += m[i];
  return a / (w * h);
}

function widthProfile({ m, w, h }, bins = 10) {
  const out = [];
  for (let b = 0; b < bins; b++) {
    const y0 = Math.floor(b * h / bins), y1 = Math.floor((b + 1) * h / bins);
    let maxw = 0;
    for (let y = y0; y < y1; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < w; x++) if (m[y * w + x]) { if (first < 0) first = x; last = x; }
      if (first >= 0) maxw = Math.max(maxw, last - first + 1);
    }
    out.push(maxw / w);
  }
  return out;
}

function analyse(mask, label, opts = {}) {
  const stripped = opts.noStrip ? mask : stripBorder(mask);
  const bb = bboxOf(stripped);
  const c = crop(stripped, bb);
  const { mirrorIoU: mi, axis } = mirrorIoU(c);
  return {
    label, bbox: `${bb.w}x${bb.h}`,
    mirrorIoU: +mi.toFixed(3),
    axisOffsetFromCentre: +(axis - (bb.w - 1) / 2).toFixed(1),
    interiorNeg: +interiorNeg(c).toFixed(4),
    fill: +fill(c).toFixed(3),
    widthProfile: widthProfile(c).map(v => +v.toFixed(2)),
  };
}

// ---------------- SELFTEST: every metric must FAIL on a known-bad input ----------
function synth(w, h, draw) {
  const m = new Uint8Array(w * h);
  draw((x, y) => { if (x >= 0 && x < w && y >= 0 && y < h) m[y * w + x] = 1; });
  return { m, w, h };
}
function selftest() {
  let pass = 0, fail = 0;
  const ck = (name, cond, got) => { if (cond) { pass++; console.log(`  ok   ${name}  ${got}`); }
    else { fail++; console.log(`  FAIL ${name}  ${got}`); } };

  // 1. mirrorIoU: perfectly symmetric shape -> 1.000
  const sym = synth(101, 60, set => { for (let y = 10; y < 50; y++) { for (let x = 20; x < 40; x++) set(x, y); for (let x = 61; x < 81; x++) set(x, y); } });
  const symR = analyse(sym, 'sym');
  ck('mirrorIoU==1.000 on a symmetric pair', symR.mirrorIoU >= 0.99, `got ${symR.mirrorIoU}`);

  // 1b. KNOWN-BAD: delete the right lobe -> must COLLAPSE, not stay high
  const asym = synth(101, 60, set => { for (let y = 10; y < 50; y++) for (let x = 20; x < 40; x++) set(x, y); });
  const asymR = analyse(asym, 'asym');
  ck('mirrorIoU collapses on a one-lobe (known-bad) shape', asymR.mirrorIoU >= 0.99, `got ${asymR.mirrorIoU} (expect ~1.0 — a lone rect IS symmetric)`);

  // 1c. the real known-bad for asymmetry: an L, which no axis can mirror onto itself
  const L = synth(101, 60, set => { for (let y = 10; y < 50; y++) for (let x = 20; x < 40; x++) set(x, y); for (let y = 40; y < 50; y++) for (let x = 40; x < 90; x++) set(x, y); });
  const LR = analyse(L, 'L');
  ck('mirrorIoU FAILS (<0.75) on an L (known-bad asymmetric)', LR.mirrorIoU < 0.75, `got ${LR.mirrorIoU}`);

  // 2. interiorNeg: a solid rect has NO enclosed background -> 0.0000
  const solid = synth(60, 60, set => { for (let y = 10; y < 50; y++) for (let x = 10; x < 50; x++) set(x, y); });
  ck('interiorNeg==0 on a solid rect', analyse(solid, 's').interiorNeg === 0, `got ${analyse(solid, 's').interiorNeg}`);

  // 2b. KNOWN-BAD: punch a hole -> must become clearly > 0
  const holed = synth(60, 60, set => { for (let y = 10; y < 50; y++) for (let x = 10; x < 50; x++) if (!(x > 20 && x < 40 && y > 20 && y < 40)) set(x, y); });
  const hR = analyse(holed, 'h');
  ck('interiorNeg > 0.5 once a hole is punched (known-bad)', hR.interiorNeg > 0.5, `got ${hR.interiorNeg}`);

  // 3. fill: solid rect cropped to its bbox -> 1.000
  ck('fill==1.000 on a solid rect', analyse(solid, 's').fill >= 0.999, `got ${analyse(solid, 's').fill}`);
  // 3b. KNOWN-BAD: a thin cross fills its bbox poorly
  const cross = synth(60, 60, set => { for (let y = 10; y < 50; y++) for (let x = 28; x < 32; x++) set(x, y); for (let x = 10; x < 50; x++) for (let y = 28; y < 32; y++) set(x, y); });
  ck('fill FAILS (<0.25) on a thin cross (known-bad)', analyse(cross, 'c').fill < 0.25, `got ${analyse(cross, 'c').fill}`);

  // 4. stripBorder: a page border ring must be removed, leaving only the inner blob
  const framed = synth(80, 80, set => {
    for (let x = 0; x < 80; x++) for (let y = 0; y < 4; y++) { set(x, y); set(x, 79 - y); }
    for (let y = 0; y < 80; y++) for (let x = 0; x < 4; x++) { set(x, y); set(79 - x, y); }
    for (let y = 30; y < 50; y++) for (let x = 30; x < 50; x++) set(x, y);
  });
  const fr = analyse(framed, 'f');
  ck('stripBorder removes the page frame (bbox 20x20, not 80x80)', fr.bbox === '20x20', `got ${fr.bbox}`);
  // 4b. KNOWN-BAD: without stripping, the same input would report 80x80
  const noStrip = bboxOf(framed);
  ck('known-bad: unstripped frame WOULD have reported 80x80', noStrip.x1 - noStrip.x0 + 1 === 80, `got ${noStrip.x1 - noStrip.x0 + 1}`);

  console.log(`\nselftest: ${pass} pass, ${fail} fail`);
  return fail === 0;
}

const args = process.argv.slice(2);
if (args[0] === '--selftest') {
  process.exit(selftest() ? 0 : 1);
} else {
  const ok = selftest();
  if (!ok) { console.error('SELFTEST FAILED — not reporting measurements.'); process.exit(1); }
  console.log('');
  for (const p of args) {
    const { data, info } = await sharp(p).greyscale().raw().toBuffer({ resolveWithObject: true });
    const mask = maskFromRaw(data, info.width, info.height);
    const r = analyse(mask, p, { noStrip: true });          // <48 already excludes the 87 frame
    r.clip = edgeContact(mask, data);
    console.log(JSON.stringify(r, null, 2));
  }
}
