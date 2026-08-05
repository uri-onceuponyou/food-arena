#!/usr/bin/env node
/**
 * pp_ref — isolate the SAME named parts out of a reference plate.
 *
 * THROWAWAY, read-only. Writes only under `shots/perpart/`.
 *
 * ── THE ONE THING THAT DECIDES WHETHER THIS IS WORTH ANYTHING ───────────────
 * A crop that puts our part on a flat warm field and the reference part on its
 * own saturated blue gradient is a measurement of the BACKGROUND. So the
 * reference character is matted off its plate and composited onto the exact same
 * field `pp_ours.mjs` measured off the shipped render — the field colour is read
 * out of `ours.json`, never re-derived here, so the two sides cannot drift apart.
 *
 * ── THE MATTE, AND HOW IT IS CHECKED ────────────────────────────────────────
 * Flood fill inward from the plate's border in RGB, with a tolerance. That is a
 * guess until it is checked, so three checks run on every plate and are reported:
 *   HOLES     — background pixels enclosed by the subject and not reached by the
 *               fill. Counted, and filled only if they are small.
 *   BLEED     — subject pixels the fill ate. Detected by asking whether the
 *               matte's own bbox collapsed against the plate's known subject box.
 *   BORDER    — the fill must reach every edge pixel of the plate. If it does
 *               not, the tolerance is too tight and the panel would carry a frame
 *               of leftover background.
 * `--dump-matte` writes the binary matte so it can be LOOKED at, which is the
 * only check that catches a matte that is confidently wrong in the middle.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { loadRGBA, writeRGBA, cropRGBA, bboxOf, figureGround, panelStats, dilate } from './pp_lib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const PLATE = get('--plate', 'reference/images/curated/character_fullbody/bs_05.png');
const OUT = get('--out', 'shots/perpart');
const TAG = get('--tag', 'ref');
const OURS = get('--ours', 'shots/perpart/_raw/ours.json');
const TOL = Number(get('--tol', 46));
const DUMP = a.includes('--dump-matte');
/** Same margin `pp_ours.mjs` uses around a paired panel's part box. */
const MARGIN = Number(get('--pairMargin', 0.12));

/**
 * PART GEOMETRY on the plate, as fractions of the MATTED SUBJECT's bbox.
 * `[x0, y0, x1, y1]`, origin top-left of the subject box.
 *
 * Hand-authored by looking at the plate at full resolution — there is no rig to
 * read here, so this is the one place a human eye is load-bearing, and it is
 * kept as data so it can be re-read and argued with rather than buried in code.
 * `whole: true` means "the entire subject", `substrate: true` means the crop keeps
 * everything inside the silhouette (an inset part, matching `pp_ours`'s `inset`).
 */
const PARTS = (await import(`./${get('--parts', 'pp_ref_parts.mjs')}`)).default;

const ours = JSON.parse(await readFile(OURS, 'utf8'));
const FIELD = ours.field.measured;
console.log(`field taken from ${OURS}: rgb(${FIELD.r},${FIELD.g},${FIELD.b})`
  + ` — NOT re-derived here, so the two sides cannot drift apart`);

const img = await loadRGBA(PLATE);
const { width: W, height: H, data } = img;
console.log(`plate ${PLATE} ${W}x${H}`);

// ── MATTE ────────────────────────────────────────────────────────────────────
//
// TWO MODES, and the default is the one that survived being LOOKED at.
//
// `flood` (kept for the record): breadth-first from the border with a local step
//   tolerance. Swept at tol 8 / 14 / 20 and none of them works on this plate — 8
//   and 14 leave 52% and 49% of the plate classed as subject (the faint star
//   motif is a step larger than the tolerance, so the fill stops at every star
//   and everything past it is "subject"), while 20 LEAKS THROUGH the character's
//   ink outline and eats the body. The printed numbers at tol 8 looked merely
//   "large"; the dumped matte is what showed it was wrong.
//
// `hsv` (default): the reference backdrop is one narrow, saturated cyan band —
//   measured off this plate's own border, hue 184..199, sat 0.86..0.93, value
//   0.92..1.00 — and nothing on the character is in it (its two largest masses
//   sit near hue ~90 and ~280). So classify by colour, then keep only the
//   BORDER-CONNECTED component of that class, which is what stops a cyan detail
//   somewhere inside the character from being punched out.
const MODE = get('--matte', 'hsv');
const HUE = get('--hue', '178,212').split(',').map(Number);
const SATMIN = Number(get('--satmin', 0.40));
const VALMIN = Number(get('--valmin', 0.62));
const ERODE = Number(get('--erode', 2));
const bg = new Uint8Array(W * H);          // 1 = background
const q = new Int32Array(W * H);
let head = 0, tail = 0;
const seedTol = TOL;
const push = (j) => { if (!bg[j]) { bg[j] = 1; q[tail++] = j; } };
// Seeds: every border pixel. Each carries its OWN reference colour, so a plate
// whose background is a gradient still fills — a single global reference colour
// is what makes a flood matte fail on exactly these plates.
const ref = new Int32Array(W * H).fill(-1);
for (let x = 0; x < W; x++) { push(x); ref[x] = x; push((H - 1) * W + x); ref[(H - 1) * W + x] = (H - 1) * W + x; }
for (let y = 0; y < H; y++) { push(y * W); ref[y * W] = y * W; push(y * W + W - 1); ref[y * W + W - 1] = y * W + W - 1; }
while (head < tail) {
  const p = q[head++];
  const rp = ref[p] * 4;
  const x = p % W, y = (p / W) | 0;
  const nb = [];
  if (x > 0) nb.push(p - 1);
  if (x < W - 1) nb.push(p + 1);
  if (y > 0) nb.push(p - W);
  if (y < H - 1) nb.push(p + W);
  // Propagate against the NEIGHBOUR's colour, not the border seed's.
  //
  // Round 1 compared every candidate against the colour of the border pixel the
  // fill started from. On these plates the backdrop is a strong radial gradient,
  // so the colour drifts far past any workable tolerance long before the fill
  // reaches the character: the matte kept 56% of the plate and its bbox was
  // 1093x1834 out of 1120x1870 — i.e. it had matted the BACKGROUND as subject.
  // Looking at the dumped matte is what caught it; the printed numbers alone
  // looked merely "large".
  //
  // A gradient is smooth step-to-step, and the character's ink outline is not, so
  // a small LOCAL step tolerance walks the gradient and stops at the silhouette.
  const pi = p * 4;
  for (const n of nb) {
    if (bg[n]) continue;
    const i = n * 4;
    const dLocal = Math.abs(data[i] - data[pi]) + Math.abs(data[i + 1] - data[pi + 1]) + Math.abs(data[i + 2] - data[pi + 2]);
    const dSeed = Math.abs(data[i] - data[rp]) + Math.abs(data[i + 1] - data[rp + 1]) + Math.abs(data[i + 2] - data[rp + 2]);
    if (dLocal <= seedTol || dSeed <= seedTol) { ref[n] = ref[p]; bg[n] = 1; q[tail++] = n; }
  }
}
if (MODE === 'hsv') {
  bg.fill(0);
  const hsv = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
    if (h < 0) h += 360;
    return [h, mx ? d / mx : 0, mx];
  };
  const cls = new Uint8Array(W * H);
  for (let j = 0, i = 0; j < W * H; j++, i += 4) {
    const [h, s, v] = hsv(data[i], data[i + 1], data[i + 2]);
    cls[j] = (h >= HUE[0] && h <= HUE[1] && s >= SATMIN && v >= VALMIN) ? 1 : 0;
  }
  // keep only the border-connected part of the class
  head = 0; tail = 0;
  const seen = new Uint8Array(W * H);
  const seed = (j) => { if (cls[j] && !seen[j]) { seen[j] = 1; bg[j] = 1; q[tail++] = j; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (head < tail) {
    const p = q[head++];
    const x = p % W, y = (p / W) | 0;
    if (x > 0) seed(p - 1);
    if (x < W - 1) seed(p + 1);
    if (y > 0) seed(p - W);
    if (y < H - 1) seed(p + W);
  }
}
let subj = new Uint8Array(W * H);
for (let j = 0; j < W * H; j++) subj[j] = bg[j] ? 0 : 1;
// Swallow the anti-aliased rim where the plate's own backdrop blends into the
// character: those pixels are neither pure backdrop nor pure character, so they
// fall outside the colour class and would survive as a thin cyan halo — the plate's
// background creeping into a panel whose whole point is that it does not.
// `ERODE` px on a ~1800 px subject is ~0.1% of its height.
if (ERODE > 0) {
  const inv = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) inv[j] = subj[j] ? 0 : 1;
  const grownBg = dilate(inv, W, H, ERODE);
  for (let j = 0; j < W * H; j++) if (grownBg[j]) subj[j] = 0;
}

// HOLES — background enclosed by the subject. Small ones are matte noise inside
// the character (a dark eye pupil the fill could never reach); large ones would
// mean a genuine see-through gap and are reported, not silently filled.
const holes = (() => {
  const seen = new Uint8Array(W * H);
  const comps = [];
  const st = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (subj[s] || bg[s] || seen[s]) continue;
    let sp = 0; st[sp++] = s; seen[s] = 1; const cells = [];
    while (sp) {
      const p = st[--sp]; cells.push(p);
      const x = p % W, y = (p / W) | 0;
      const nb = [];
      if (x > 0) nb.push(p - 1); if (x < W - 1) nb.push(p + 1);
      if (y > 0) nb.push(p - W); if (y < H - 1) nb.push(p + W);
      for (const n of nb) if (!seen[n] && !subj[n] && !bg[n]) { seen[n] = 1; st[sp++] = n; }
    }
    comps.push(cells);
  }
  return comps;
})();
// Everything not reached by the border fill IS subject as far as `subj` goes
// already; `holes` above is therefore empty by construction and exists as an
// assertion, not a step: if it ever fires, the fill semantics changed.
const border = (() => {
  let bad = 0;
  for (let x = 0; x < W; x++) { if (!bg[x]) bad++; if (!bg[(H - 1) * W + x]) bad++; }
  for (let y = 0; y < H; y++) { if (!bg[y * W]) bad++; if (!bg[y * W + W - 1]) bad++; }
  return bad;
})();
const sbox = bboxOf(subj, W, H);
const subjPx = subj.reduce((s, v) => s + v, 0);
console.log(`matte: subject ${subjPx} px (${(100 * subjPx / (W * H)).toFixed(1)}% of plate),`
  + ` bbox ${sbox.w}x${sbox.h} at (${sbox.x0},${sbox.y0}), unfilled border px ${border}, enclosed comps ${holes.length}`);
if (border > 0) console.log(`  WARNING: ${border} border pixels were NOT background — tolerance too tight, the panel would carry a frame`);
if (subjPx / (W * H) > 0.85) console.log('  WARNING: the matte kept >85% of the plate — the fill almost certainly failed');
if (subjPx / (W * H) < 0.02) console.log('  WARNING: the matte kept <2% of the plate — the fill ate the subject');

if (DUMP) {
  const m = Buffer.alloc(W * H * 4);
  for (let j = 0, i = 0; j < W * H; j++, i += 4) {
    const v = subj[j] ? 255 : 0;
    m[i] = v; m[i + 1] = v; m[i + 2] = v; m[i + 3] = 255;
  }
  await writeRGBA(`${OUT}/_raw/${TAG}.matte.png`, { data: m, width: W, height: H });
  console.log(`  wrote ${OUT}/_raw/${TAG}.matte.png — LOOK at it`);
}

// Composite the whole plate onto the field once; every crop comes out of this.
const flat = Buffer.from(data);
// Erode the subject by 0 and instead feather nothing: the plates carry their own
// dark ink outline, and eroding would remove exactly that. Background pixels are
// replaced outright; the 1 px anti-aliased rim between them keeps a trace of the
// plate's own backdrop, which is measured below rather than assumed away.
for (let j = 0, i = 0; j < W * H; j++, i += 4) {
  if (!subj[j]) { flat[i] = FIELD.r; flat[i + 1] = FIELD.g; flat[i + 2] = FIELD.b; }
  flat[i + 3] = 255;
}
const flatImg = { data: flat, width: W, height: H };

const results = [];
for (const [part, spec] of Object.entries(PARTS)) {
  if (spec.valid === false) { results.push({ part, valid: false, why: spec.why }); continue; }
  let px0, py0, px1, py1;
  if (spec.whole) { px0 = sbox.x0; py0 = sbox.y0; px1 = sbox.x1; py1 = sbox.y1; }
  else {
    const [fx0, fy0, fx1, fy1] = spec.box;
    px0 = Math.round(sbox.x0 + fx0 * sbox.w); py0 = Math.round(sbox.y0 + fy0 * sbox.h);
    px1 = Math.round(sbox.x0 + fx1 * sbox.w); py1 = Math.round(sbox.y0 + fy1 * sbox.h);
  }
  // The authored box IS the part box; the emitted crop adds the SAME margin
  // `pp_ours.mjs` adds around its delivered bbox, so `partHeightFracOfCrop`
  // matches by construction on both sides and the packer is not silently scaling
  // one side's subject to 0.8 of the other's.
  const mx = Math.round((px1 - px0 + 1) * MARGIN), my = Math.round((py1 - py0 + 1) * MARGIN);
  // NOT clamped to the plate. The subject fills 1091x1748 of a 1120x1870 plate,
  // so a clamped margin gave `figure-whole` a part/crop ratio of 0.935 against our
  // 0.808 — a 16% scale mismatch inside a pair whose whole claim is matched scale.
  // Anything off the plate becomes FIELD, which is what it would have been anyway.
  const x0 = px0 - mx, y0 = py0 - my, x1 = px1 + mx, y1 = py1 + my;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  let crop = { data: Buffer.alloc(cw * ch * 4), width: cw, height: ch };
  for (let j = 0, i = 0; j < cw * ch; j++, i += 4) {
    crop.data[i] = FIELD.r; crop.data[i + 1] = FIELD.g; crop.data[i + 2] = FIELD.b; crop.data[i + 3] = 255;
  }
  for (let y = 0; y < ch; y++) {
    const sy = y0 + y; if (sy < 0 || sy >= H) continue;
    for (let x = 0; x < cw; x++) {
      const sx = x0 + x; if (sx < 0 || sx >= W) continue;
      const s = (sy * W + sx) * 4, d = (y * cw + x) * 4;
      crop.data[d] = flatImg.data[s]; crop.data[d + 1] = flatImg.data[s + 1]; crop.data[d + 2] = flatImg.data[s + 2];
    }
  }
  const cropSubj = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sy = y0 + y, sx = x0 + x;
    cropSubj[y * cw + x] = (sy >= 0 && sy < H && sx >= 0 && sx < W) ? subj[sy * W + sx] : 0;
  }
  if (spec.binary) {
    for (let j = 0, i = 0; j < cw * ch; j++, i += 4) {
      const v = cropSubj[j] ? 0 : 255;
      crop.data[i] = v; crop.data[i + 1] = v; crop.data[i + 2] = v; crop.data[i + 3] = 255;
    }
  }
  const box = bboxOf(cropSubj, cw, ch);
  const fg = spec.binary ? null : figureGround(crop, cropSubj, 4);
  const ps = panelStats(crop, cropSubj);
  await writeRGBA(`${OUT}/_raw/${TAG}.${part}.png`, crop);
  results.push({
    part, valid: true, kind: spec.kind ?? (spec.substrate ? 'inset' : 'standalone'),
    raw: `${OUT}/_raw/${TAG}.${part}.png`,
    plate: PLATE, plateBox: { x0, y0, w: cw, h: ch },
    partBox: { x0: px0, y0: py0, w: px1 - px0 + 1, h: py1 - py0 + 1 },
    partHeightFracOfCrop: +((py1 - py0 + 1) / ch).toFixed(3),
    subjectBox: box, figureGround: fg, panel: ps,
    note: spec.note ?? null,
  });
  console.log(`  ${part.padEnd(18)} ${(spec.kind ?? 'standalone').padEnd(10)} crop=${cw}x${ch}`
    + ` subj=${box ? box.w + 'x' + box.h : 'NONE'}`
    + ` fg=${fg ? (fg.contrast >= 0 ? '+' : '') + fg.contrast.toFixed(3) : '  n/a '}`);
}

await mkdir(`${OUT}/_raw`, { recursive: true });
await writeFile(`${OUT}/_raw/${TAG}.json`, JSON.stringify({
  tool: 'pp_ref.mjs', plate: PLATE, tag: TAG, field: FIELD, tolerance: TOL,
  matte: { subjectPx: subjPx, plate: { W, H }, subjectBox: sbox, unfilledBorderPx: border, enclosedComponents: holes.length },
  parts: results,
}, null, 2));
console.log(`wrote ${OUT}/_raw/${TAG}.json`);
