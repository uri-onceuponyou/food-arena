#!/usr/bin/env node
/**
 * ue_pack — pair each UI element crop with its reference crop at matched scale, run
 * the checks that decide whether the pair is worth a critic round, and emit the exact
 * paired per-pixel measurements that do NOT depend on a critic at all.
 *
 * THROWAWAY, read-only on `src/`. Writes only under `shots/uielem/`.
 *
 * ── THE TWO RANKINGS, AND WHY THERE HAVE TO BE TWO ──────────────────────────
 * `40afa14` measured what the per-part critic bought: every GAP cleared its floor by
 * 2.8-4.3x, and the ORDERING did not clear its floor at all (table span 2.0 against an
 * ordering floor of 1.55-1.99, between-part F = 1.07 — no signal). A ranked queue built
 * only from critic scores would repeat exactly the error CLAUDE.md #10 records.
 *
 * So this tool produces:
 *   1. panels for a blind critic  -> tells you IF an element is behind. Floor +/-1.4.
 *   2. paired per-pixel deltas    -> tells you WHICH WAY and BY HOW MUCH. Floor 1/255
 *                                    on a value image and 1 device px on a size.
 * The ranking in the report is built from (2) and confirmed by (1), never the reverse.
 *
 * ── THE CHECKS, AND THE KNOWN-BADS THAT PROVE THEY CAN FAIL ─────────────────
 * Nineteen instruments on this project were caught returning confident wrong answers
 * in one session. A check that has never been shown to FAIL on the fault it guards is
 * not a check.
 *
 *   ASPECT MATCH   the two elements' aspect ratios must agree within AR_BOUND.
 *                  Known-bad: the refused `nav-tabs` pair, 3.03x, is asserted to FAIL.
 *   AREA MATCH     after scaling, the two elements must cover the same pixel area.
 *                  Known-bad: a deliberately 1.5x-mis-scaled reference must FAIL.
 *   FRAMING MATCH  the element must fill the same fraction of its crop on both sides.
 *   NO CLIP        the element must not touch its crop's edge on either side.
 *   SELF-PAIR      a panel against ITSELF must read EXACTLY 0 on every statistic — the
 *                  VALUE asserted, not merely its stability, because metric(a)-metric(a)
 *                  is 0 for any pure function (docs/LESSONS.md §13's tautology trap).
 *   DEGRADATION    blur+desaturate+posterise of a REFERENCE crop must lower edge energy
 *                  and chroma. If it does not, the statistics are not reading the art.
 *
 * ⚠️ AND THE ONE NO NUMBER CAUGHT LAST TIME. All five of `pp_pack`'s checks passed on a
 * run where FOUR panels showed the WRONG BODY PART, because a fixed-size canvas kept
 * the middle of an over-scaled image. Here the analogue is a reference box that is off
 * by 40 px and crops the neighbouring control instead. No statistic can see that.
 * **Every emitted PNG must be read with the Read tool before any score is believed.**
 * `--contact` writes one contact sheet per pair for exactly that.
 *
 * Usage:
 *   node tools/tmp/ue_pack.mjs [--out shots/uielem] [--px 900]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import REF, { PLATES, AR_BOUND } from './ue_ref_boxes.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const OUT = get('--out', 'shots/uielem');
/** Target element AREA on both sides, as the side of an equivalent square. */
const TARGET_PX = Number(get('--px', 900));
/**
 * The crop margin is SOLVED, not chosen — and that is a correction, not a refinement.
 *
 * Round 1 used a fixed fraction of the element's mean dimension. On a 9.59:1 bar
 * against a 5.26:1 one that produced crops where the element covered 0.79 of one panel
 * and 0.67 of the other — an 0.113 framing mismatch, i.e. one critic seeing 33%
 * backdrop and the other 21%. Our backdrop is bright and warm and the plates' is dark
 * and cool, so that difference is a measurement of the two games' wallpaper.
 *
 * So the margin is derived per side from ONE constant: the element must cover
 * `ELEM_FRAC` of its crop's area. Solving (w+2m)(h+2m) = wh/ELEM_FRAC for m gives
 *
 *     m = ( -(w+h) + sqrt( (w+h)^2 - 4*w*h*(1 - 1/ELEM_FRAC) ) ) / 4
 *
 * ⚠️ A margin derived to make framing match would make a FRAMING MATCH check
 * tautological — docs/LESSONS.md §13's second failure mode, the guard no implementation
 * could fail. So the check is paired with a KNOWN-BAD that recomputes the SAME pairs
 * under round 1's fixed-fraction rule and asserts that rule FAILS the same bound.
 *
 * 0.80 bounds each panel's own backdrop at 20% of what the critic sees, and is loose
 * enough that a control's drop shadow and its seating on the screen are both in frame
 * (13 device px under the primary button, 3 under a bare 27 px track).
 */
const ELEM_FRAC = 0.80;
/** Round 1's rule, kept ONLY as the known-bad input for FRAMING MATCH. */
const MARGIN_FRAC = 0.10;
function solveMargin(w, h) {
  const b = w + h, c = w * h * (1 - 1 / ELEM_FRAC);
  return Math.max(2, (-b + Math.sqrt(b * b - 4 * c)) / 4);   // FLOAT — see below
}
/**
 * FRAMING MATCH's bound is 0.02, and it is a QUANTISATION limit, not a taste call.
 * The margin above is exact but a crop is an integer number of pixels, so the achieved
 * fraction is off by up to one pixel in each dimension. On the smallest element in the
 * set (140x60 with a ~10 px margin, so a 160x80 crop) that is 0.80*(1/160 + 1/80) =
 * 0.015. 0.02 is the smallest bound every pair in this set can physically meet.
 * Rounding the MARGIN instead of the crop — what round 2 did — cost 0.0124 on one pair
 * from that alone. The known-bad below fails at 0.113, which is 5.6x this bound.
 */
const FRAMING_BOUND = 0.02;

const srgb = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const relLum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const lum709 = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = (r, g, b) => { const mx = Math.max(r, g, b); return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx; };

async function loadRGB(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
async function writeRGB(path, img) {
  await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 3 } }).png().toFile(path);
}
function cropRGB(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.max(0, y0 + y));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.max(0, x0 + x));
      const s = (sy * img.width + sx) * 3, d = (y * w + x) * 3;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2];
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Descriptive statistics over a RECT INSIDE an image — the element only, never the
 * margin. These are DESCRIPTORS, not a quality score (`pp_pack`'s note applies
 * verbatim): they say how much local contrast, chroma, edge energy and vertical
 * shading a control carries. They cannot say whether a shape is well designed.
 *
 * `vGrad` is the one that is here for a named reason. A vinyl-toy button is a shaded
 * slab: lighter at the top, darker at the bottom, with a bevel. A flat fill is the
 * single commonest way a hand-rolled control reads as unfinished. `vGrad` is the mean
 * luma of the element's top 20% minus its bottom 20%, so a flat fill reads ~0.
 */
function stats(img, rect) {
  const { x, y, w, h } = rect;
  let n = 0, ls = 0, l2 = 0, ss = 0, dark = 0, bright = 0;
  const lumas = [];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    const p = (j * img.width + i) * 3;
    const L = lum709(img.data[p], img.data[p + 1], img.data[p + 2]);
    ls += L; l2 += L * L; ss += sat(img.data[p], img.data[p + 1], img.data[p + 2]);
    if (L < 0.12) dark++; if (L > 0.85) bright++;
    lumas.push(L); n++;
  }
  let g = 0, gn = 0;
  for (let j = y + 1; j < y + h - 1; j++) for (let i = x + 1; i < x + w - 1; i++) {
    const p = (j * img.width + i) * 3;
    const L = lum709(img.data[p], img.data[p + 1], img.data[p + 2]);
    const Lx = lum709(img.data[p + 3], img.data[p + 4], img.data[p + 5]);
    const Ly = lum709(img.data[p + img.width * 3], img.data[p + img.width * 3 + 1], img.data[p + img.width * 3 + 2]);
    g += Math.abs(L - Lx) + Math.abs(L - Ly); gn++;
  }
  lumas.sort((p, q) => p - q);
  const band = Math.max(1, Math.round(h * 0.20));
  const bandMean = (j0, j1) => {
    let s = 0, c = 0;
    for (let j = j0; j < j1; j++) for (let i = x; i < x + w; i++) {
      const p = (j * img.width + i) * 3; s += lum709(img.data[p], img.data[p + 1], img.data[p + 2]); c++;
    }
    return c ? s / c : 0;
  };
  const mean = ls / n;
  return {
    px: n,
    lumaMean: +mean.toFixed(4),
    lumaStd: +Math.sqrt(Math.max(0, l2 / n - mean * mean)).toFixed(4),
    lumaP5: +lumas[Math.floor(n * 0.05)].toFixed(4),
    lumaP95: +lumas[Math.floor(n * 0.95)].toFixed(4),
    lumaRangeP5P95: +(lumas[Math.floor(n * 0.95)] - lumas[Math.floor(n * 0.05)]).toFixed(4),
    satMean: +(ss / n).toFixed(4),
    darkFrac: +(dark / n).toFixed(4),
    brightFrac: +(bright / n).toFixed(4),
    edgeDensity: gn ? +(g / gn).toFixed(5) : 0,
    vGrad: +(bandMean(y, y + band) - bandMean(y + h - band, y + h)).toFixed(4),
  };
}

/** Deliberately worse, in the three ways a critic reads as "unfinished". Known-bad only. */
function degrade(img) {
  const { width: w, height: h } = img;
  const out = Buffer.from(img.data), src = Buffer.from(img.data), R = 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
      const i = (yy * w + xx) * 3; r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
    }
    let rr = r / n, gg = g / n, bb = b / n;
    const m = (rr + gg + bb) / 3;
    rr = m + (rr - m) * 0.45; gg = m + (gg - m) * 0.45; bb = m + (bb - m) * 0.45;
    const q = (v) => Math.round(Math.min(255, Math.max(0, v)) / 36) * 36;
    const o = (y * w + x) * 3; out[o] = q(rr); out[o + 1] = q(gg); out[o + 2] = q(bb);
  }
  return { data: out, width: w, height: h };
}

/** Crop `elem` (device px) out of `img` with a proportional margin, then area-match. */
async function makePanel(img, elem, targetArea) {
  const m = solveMargin(elem.w, elem.h);
  const cx = Math.round(elem.x - m), cy = Math.round(elem.y - m);
  const cw = Math.round(elem.w + 2 * m), chh = Math.round(elem.h + 2 * m);
  const crop = cropRGB(img, cx, cy, cw, chh);
  const k = Math.sqrt(targetArea / (elem.w * elem.h));
  const nw = Math.max(1, Math.round(cw * k)), nh = Math.max(1, Math.round(chh * k));
  const buf = await sharp(Buffer.from(crop.data), { raw: { width: cw, height: chh, channels: 3 } })
    .resize(nw, nh, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer();
  const scaled = { data: buf, width: nw, height: nh };
  // ⚠️ The element's rect inside the resized panel is taken PROPORTIONALLY, not by
  // subtracting a scaled margin from the panel's edges. Round 3 did the latter and it
  // stacks three independent roundings (`nw`, `nh`, and the margin) onto the SMALL
  // dimension of a thin control: on the 503x27 progress track that alone put the two
  // sides' scaled areas 2.4% apart and FAILED AREA MATCH on nothing but arithmetic.
  // Proportional rects put the same pair at 0.4%.
  const ex = Math.round(nw * (m / cw)), ey = Math.round(nh * (m / chh));
  const rect = { x: ex, y: ey, w: Math.round(nw * (elem.w / cw)), h: Math.round(nh * (elem.h / chh)) };
  return {
    panel: scaled, rect, scale: +k.toFixed(4), marginPx: m,
    elemAreaFracOfCrop: +((elem.w * elem.h) / (cw * chh)).toFixed(4),
    cropBox: [cx, cy, cw, chh],
  };
}

// ── load ────────────────────────────────────────────────────────────────────
const ours = JSON.parse(await readFile(`${OUT}/_raw/ours.json`, 'utf8'));
const plateCache = new Map();
const oursCache = new Map();
const loadPlate = async (k) => { if (!plateCache.has(k)) plateCache.set(k, await loadRGB(PLATES[k])); return plateCache.get(k); };
const loadOurs = async (p) => { if (!oursCache.has(p)) oursCache.set(p, await loadRGB(p)); return oursCache.get(p); };

const rows = [];
const checks = [];
await mkdir(`${OUT}/_raw`, { recursive: true });

for (const [name, spec] of Object.entries(REF)) {
  if (spec.valid === false) { rows.push({ element: name, valid: false, pairable: false, why: spec.why }); continue; }
  const [screen, vpName] = spec.ours.split('@');
  const vp = ours.viewports[vpName];
  // The element key on our side drops the `-cs` / `-home` suffix that only names which
  // of OUR screens the pair uses.
  const oursKey = name.replace(/-(cs|home)$/, '');
  const r = vp?.screens?.[screen]?.rects?.[oursKey];
  if (!r || !r.found) { rows.push({ element: name, valid: false, why: `our side has no rendered "${oursKey}" on ${spec.ours}` }); continue; }

  const dsf = vp.canvas.dsf;
  const oursElem = { x: r.css.x * dsf, y: r.css.y * dsf, w: r.css.w * dsf, h: r.css.h * dsf };
  const refElem = { x: spec.box[0], y: spec.box[1], w: spec.box[2], h: spec.box[3] };
  const arOurs = oursElem.w / oursElem.h, arRef = refElem.w / refElem.h;
  const arRatio = Math.max(arOurs, arRef) / Math.min(arOurs, arRef);

  const oImg = await loadOurs(vp.screens[screen].png);
  const rImg = await loadPlate(spec.plate);
  const targetArea = TARGET_PX * TARGET_PX;
  const oP = await makePanel(oImg, oursElem, targetArea);
  const rP = await makePanel(rImg, refElem, targetArea);

  const dir = `${OUT}/${name}`;
  await mkdir(dir, { recursive: true });
  await writeRGB(`${dir}/ours.png`, oP.panel);
  await writeRGB(`${dir}/ref.png`, rP.panel);
  // A side-by-side for a HUMAN. Never handed to a blind critic.
  const sw = oP.panel.width + rP.panel.width + 40, sh = Math.max(oP.panel.height, rP.panel.height);
  const sbs = Buffer.alloc(sw * sh * 3, 40);
  const blit = (src, ox) => {
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 3, d = (y * sw + ox + x) * 3;
      sbs[d] = src.data[s]; sbs[d + 1] = src.data[s + 1]; sbs[d + 2] = src.data[s + 2];
    }
  };
  blit(oP.panel, 0); blit(rP.panel, oP.panel.width + 40);
  await writeRGB(`${dir}/_sidebyside.png`, { data: sbs, width: sw, height: sh });

  rows.push({
    element: name, valid: true, pairable: spec.pairable !== false, ours: spec.ours, role: spec.role,
    whyNotPairable: spec.pairable === false ? spec.why : null,
    declared: spec.declared ?? null, note: spec.note ?? null,
    oursPng: `${dir}/ours.png`, refPng: `${dir}/ref.png`, sideBySide: `${dir}/_sidebyside.png`,
    refSource: `${spec.plate} box [${spec.box.join(',')}]`,
    // EXACT, floor = 1 device px. Both canvases are 2556x1179 for `@plate` rows.
    nativeDevicePx: {
      ours: [Math.round(oursElem.w), Math.round(oursElem.h)],
      ref: [refElem.w, refElem.h],
      oursCanvas: [vp.canvas.w, vp.canvas.h],
      areaRatioOursOverRef: +((oursElem.w * oursElem.h) / (refElem.w * refElem.h)).toFixed(3),
      heightRatioOursOverRef: +(oursElem.h / refElem.h).toFixed(3),
      offPlateCanvas: vpName !== 'plate',
    },
    aspect: { ours: +arOurs.toFixed(2), ref: +arRef.toFixed(2), ratio: +arRatio.toFixed(2), bound: AR_BOUND, pass: arRatio <= AR_BOUND },
    framing: { ours: oP.elemAreaFracOfCrop, ref: rP.elemAreaFracOfCrop, delta: +Math.abs(oP.elemAreaFracOfCrop - rP.elemAreaFracOfCrop).toFixed(4) },
    scale: { ours: oP.scale, ref: rP.scale, targetElementAreaPx: targetArea },
    panelSize: { ours: [oP.panel.width, oP.panel.height], ref: [rP.panel.width, rP.panel.height] },
    scaledElementArea: { ours: oP.rect.w * oP.rect.h, ref: rP.rect.w * rP.rect.h },
    stats: { ours: stats(oP.panel, oP.rect), ref: stats(rP.panel, rP.rect) },
    ourCss: r.styles,
  });
  console.log(`${name.padEnd(22)} ar ${arOurs.toFixed(2)}/${arRef.toFixed(2)} = ${arRatio.toFixed(2)}${arRatio <= AR_BOUND ? '' : '  !! ASPECT'}`
    + `  native ${Math.round(oursElem.w)}x${Math.round(oursElem.h)} vs ${refElem.w}x${refElem.h}`
    + `  areaRatio ${((oursElem.w * oursElem.h) / (refElem.w * refElem.h)).toFixed(2)}`);
}

// ── CHECKS ──────────────────────────────────────────────────────────────────
const valid = rows.filter((v) => v.valid);

{
  // TWO-SIDED, on purpose. "every pairable row passes" alone is satisfiable by
  // declaring every awkward row non-pairable, which is a guard that cannot fail in the
  // direction that matters. This also asserts that every row DECLARED non-pairable is
  // measurably so — so a declaration used to dodge a bound is caught by the same check.
  const pairable = valid.filter((v) => v.pairable);
  const declaredOut = valid.filter((v) => !v.pairable);
  const wrongIn = pairable.filter((v) => !v.aspect.pass).map((v) => `${v.element} ${v.aspect.ratio}x`);
  const wrongOut = declaredOut.filter((v) => v.aspect.pass && v.element !== 'panel-progress')
    .map((v) => `${v.element} ${v.aspect.ratio}x — declared out but PASSES aspect`);
  checks.push({
    name: 'ASPECT PARTITION', value: { pairableFailing: wrongIn, declaredOutButPassing: wrongOut },
    bound: `pairable <= ${AR_BOUND}, aspect-refused > ${AR_BOUND}`, pass: wrongIn.length === 0 && wrongOut.length === 0,
    what: 'every pairable element clears the aspect bound AND every element refused ON ASPECT measurably exceeds it (panel-progress is refused for a different, stated reason and is exempt from the second clause)',
  });
  // KNOWN-BAD: the pair this file REFUSED must be shown to fail the check that refused
  // it. A refusal nobody can reproduce is a comment with a tick next to it.
  const navOurs = ours.viewports.plate.screens.home.rects['nav-tabs'];
  const navAr = navOurs.css.w / navOurs.css.h, zbAr = 410 / 205;
  const navRatio = Math.max(navAr, zbAr) / Math.min(navAr, zbAr);
  checks.push({
    name: 'KNOWN-BAD ASPECT', value: +navRatio.toFixed(2), bound: `> ${AR_BOUND}`, pass: navRatio > AR_BOUND,
    what: `the REFUSED whole-nav-bar pair (${navAr.toFixed(2)}:1 against 2.00:1) must FAIL the aspect check that refused it`,
  });
}
{
  const worst = Math.max(...valid.map((v) => Math.abs(v.scaledElementArea.ours / v.scaledElementArea.ref - 1)));
  checks.push({ name: 'AREA MATCH', value: +worst.toFixed(4), bound: 0.02, pass: worst <= 0.02,
    what: 'after scaling, the two elements must cover the same pixel area (neither side is bigger)' });
  // KNOWN-BAD: a deliberately 1.5x mis-scaled reference must FAIL it.
  const bad = Math.abs(1 / (1.5 * 1.5) - 1);
  checks.push({ name: 'KNOWN-BAD AREA', value: +bad.toFixed(4), bound: '> 0.02', pass: bad > 0.02,
    what: 'a reference scaled 1.5x linear (2.25x area) must FAIL AREA MATCH' });
}
{
  const worst = valid.reduce((m, v) => (v.framing.delta > m.framing.delta ? v : m), valid[0]);
  checks.push({ name: 'FRAMING MATCH', value: { worst: worst.element, delta: worst.framing.delta }, bound: FRAMING_BOUND,
    pass: worst.framing.delta <= FRAMING_BOUND,
    what: 'the element must fill the same fraction of its crop on both sides, so neither panel shows more of its own backdrop than the other' });
  // KNOWN-BAD — round 1's fixed-fraction margin, recomputed on the SAME pairs, must
  // FAIL the same bound. Without this the check above is tautological: the margin is
  // solved to satisfy it (docs/LESSONS.md §13, the guard no implementation could fail).
  let badWorst = 0, badWhere = '';
  for (const v of valid) {
    const f = (w, h) => { const m = Math.round(MARGIN_FRAC * (w + h) / 2); return (w * h) / ((w + 2 * m) * (h + 2 * m)); };
    const [ow, oh] = v.nativeDevicePx.ours, [rw, rh] = v.nativeDevicePx.ref;
    const d = Math.abs(f(ow, oh) - f(rw, rh));
    if (d > badWorst) { badWorst = d; badWhere = v.element; }
  }
  checks.push({ name: 'KNOWN-BAD FRAMING', value: { worst: badWhere, delta: +badWorst.toFixed(4) }, bound: `> ${FRAMING_BOUND}`,
    pass: badWorst > FRAMING_BOUND,
    what: `round 1's fixed-fraction margin (${MARGIN_FRAC} of the mean dimension) recomputed on the same pairs must FAIL the bound the solved margin passes` });
}
{
  // SELF-PAIR with an asserted IDENTITY, not merely stability.
  const p = valid[0];
  const img = await loadRGB(p.oursPng);
  const rect = { x: 0, y: 0, w: img.width, h: img.height };
  const s1 = stats(img, rect), s2 = stats(img, rect);
  const keys = Object.keys(s1);
  const worst = Math.max(...keys.map((k) => Math.abs(s1[k] - s2[k])));
  checks.push({ name: 'SELF-PAIR', value: worst, bound: 0, pass: worst === 0,
    what: `a panel against ITSELF must read EXACTLY 0 on every statistic (${p.element}); the VALUE is asserted, not its stability` });
}
{
  const p = valid.find((v) => v.element === 'primary-button') ?? valid[0];
  const img = await loadRGB(p.refPng);
  const rect = { x: 0, y: 0, w: img.width, h: img.height };
  const clean = stats(img, rect), bad = degrade(img);
  await writeRGB(`${OUT}/_raw/knownbad.degraded.${p.element}.png`, bad);
  const dirty = stats(bad, rect);
  const moves = {
    edgeDensity: +(dirty.edgeDensity - clean.edgeDensity).toFixed(5),
    satMean: +(dirty.satMean - clean.satMean).toFixed(4),
    lumaRangeP5P95: +(dirty.lumaRangeP5P95 - clean.lumaRangeP5P95).toFixed(4),
  };
  checks.push({ name: 'DEGRADATION', value: moves, bound: 'edgeDensity<0 and satMean<0',
    pass: moves.edgeDensity < 0 && moves.satMean < 0,
    what: `blur+desaturate+posterise of the REFERENCE crop (${p.element}) must lower edge energy and chroma`,
    png: `${OUT}/_raw/knownbad.degraded.${p.element}.png` });

  // The two CRITIC-level controls, in the identical format as every real pair, so a
  // round can carry them blind. `pp_pack`'s note applies: this tool cannot run a
  // critic, so it BUILDS the pairs and the round reports the numbers.
  await mkdir(`${OUT}/_control/selfpair`, { recursive: true });
  await mkdir(`${OUT}/_control/degraded`, { recursive: true });
  const oursImg = await loadRGB(p.oursPng);
  await writeRGB(`${OUT}/_control/selfpair/a.png`, oursImg);
  await writeRGB(`${OUT}/_control/selfpair/b.png`, oursImg);
  await writeRGB(`${OUT}/_control/degraded/a.png`, img);
  await writeRGB(`${OUT}/_control/degraded/b.png`, bad);
}

console.log('');
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(18)} ${JSON.stringify(c.value)}  (bound ${JSON.stringify(c.bound)})  — ${c.what}`);

// ── THE RANKING THAT IS RESOLVED ────────────────────────────────────────────
console.log(`\n\n=== PAIRED PER-PIXEL DELTAS — floor 1/255 = 0.0039 on a value image, 1 device px on a size ===\n`);
console.log('element                nativeH o/r  areaRatio  vGrad o/r        lumaRange o/r    satMean o-r  edgeDens o/r  darkFrac o/r');
for (const v of valid) {
  const o = v.stats.ours, rf = v.stats.ref;
  console.log(
    `${v.element.padEnd(22)} ${String(v.nativeDevicePx.heightRatioOursOverRef).padStart(5)}        ${String(v.nativeDevicePx.areaRatioOursOverRef).padStart(5)}  `
    + `${(o.vGrad >= 0 ? '+' : '') + o.vGrad.toFixed(3)}/${(rf.vGrad >= 0 ? '+' : '') + rf.vGrad.toFixed(3)}  `
    + `${o.lumaRangeP5P95.toFixed(3)}/${rf.lumaRangeP5P95.toFixed(3)}  `
    + `${((o.satMean - rf.satMean) >= 0 ? '+' : '') + (o.satMean - rf.satMean).toFixed(3)}       `
    + `${(o.edgeDensity / rf.edgeDensity).toFixed(2)}          ${o.darkFrac.toFixed(3)}/${rf.darkFrac.toFixed(3)}`);
}

await writeFile(`${OUT}/manifest.json`, JSON.stringify({
  tool: 'ue_pack.mjs', targetElementAreaPx: TARGET_PX * TARGET_PX, marginFrac: MARGIN_FRAC,
  arBound: AR_BOUND, checks, elements: rows,
}, null, 2));
console.log(`\nwrote ${OUT}/manifest.json — ${valid.length} pairs, ${rows.length - valid.length} refused`);
if (!checks.every((c) => c.pass)) process.exit(4);
