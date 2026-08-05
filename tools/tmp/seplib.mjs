/**
 * seplib — INTERNAL SEPARATION, the quantity `silhlib.mjs` provably cannot see.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Two character passes hit their metric and lost score.
 *
 *   value ladder  p05 0.273 -> 0.157, 10 of 11 reach the reference dark end   3.6 -> 3.25
 *   silhouette    hullDef 0.1379 -> 0.2621 (the reference MEDIAN), app 0.5 -> 3.0   3.0 / 2.0
 *
 * Both rounds were valid (reference panels 8/9 and 7/9) and both metrics measured a
 * real deficit and closed it. Then two independent blind critics, on two different
 * characters, unprompted, named the same missing thing in mechanical terms:
 *
 *   egg      "no head/body separation ... a 4-6 px pinch at the neck"
 *   burrito  "head as a distinct sphere proud of a real shoulder line, with a hard
 *             dark occlusion notch under the chin"
 *
 * A pinch at the neck is an event on the OUTLINE, so one might expect hull deficiency
 * to see it. It does not, and the reason is arithmetic rather than incidental: hull
 * deficiency is `1 - area/hullArea`, and a narrow waist between two convex lobes
 * removes only the area of the two small triangular notches it opens. On a 136px
 * chibi a 6px-deep pinch on each side of a 60px-wide mass is ~0.4% of the hull. The
 * appendage count cannot see it either — the appendage operator is
 * `mask - opening(mask, k)`, and a NECK is a place where the opening REMOVES mass, so
 * a neck contributes to neither the numerator nor the count.
 *
 * The empirical proof is in the data the last pass left: **burrito has the best
 * measured outline in the cast (hullDef 0.3340) and scored the LOWEST (2.0)**. Outline
 * events and internal separation are close to orthogonal on this cast.
 *
 * ── The three numbers, and why each is REFERENCE-COMPUTABLE ──────────────────
 * The rule that made the silhouette finding trustworthy — and the reason the critic
 * and the instrument agreed — is that every number was a property of the MASK, so the
 * identical code runs on a Brawl Stars plate. These keep that rule. Two are mask-only;
 * the third is mask+luma, and a marketing plate has both.
 *
 *   neckPinch    The deepest horizontal narrowing between an upper lobe and a lower
 *                one, as a fraction of the NARROWER lobe. Exactly the critic's "4-6px
 *                pinch", expressed scale-free. A single convex blob scores exactly 0
 *                by construction (proved in the selftest); a snowman with a 8px neck
 *                between a 40px head and a 60px body scores 1 - 8/40 = 0.80.
 *   corePinch    The same number computed on `opening(mask, k)` — the mass with
 *                limb-calibre SPURS eroded away. Reported because the previous pass
 *                added 33 appendages and one of them landing beside the neck would
 *                widen the run there. ⚠️ It does NOT survive a wide bridge, and the
 *                selftest pins that rather than claiming otherwise: an opening is a
 *                2-D operator, so a short WIDE bar welded to a lobe above and a lobe
 *                below has a distance-from-background set by its WIDTH, and neither
 *                the erosion nor the eye calls that a neck.
 *   chinNotch    The deepest horizontal DARK band inside the mask, in luma. Rows are
 *                summarised by their median so a single dark decal cannot make one.
 *                This is the "hard occlusion notch under the chin" as a number, and it
 *                is the half of the finding that geometry alone cannot deliver: a neck
 *                that is unlit reads as one mass however well it is modelled.
 *
 * Plus `headBodyWidth` (upper lobe width / lower lobe width) because the egg critic
 * named a target for it — "shrink it to ~0.7-0.75 of the body's width" — and a metric
 * that moves a pinch by shrinking the head to nothing should have to show that.
 *
 * ── The bias that is PINNED rather than papered over ─────────────────────────
 * `neckPinch` on the raw mask is the headline because it is what the eye sees, and
 * that choice was made BEFORE any plate was measured. `corePinch` is computed on an
 * opening, which restores the eroded width, so it is NOT inflated the way an erosion
 * would be (an erosion by k shrinks every width by 2k and therefore raises every
 * width RATIO). Both sides — the plates and our render — are measured at the same
 * subject height, so k, the row windows and the minimum lobe area are the same
 * fraction of the same thing on both.
 *
 * VALIDATED against shapes whose answers are derivable by hand — `sepscan --selftest`.
 * `docs/LESSONS.md` §13: validate the instrument against a known input before
 * believing it on an unknown one. Fifteen instruments have been caught returning
 * confident wrong answers this session.
 */

import { bbox, components, opening } from './silhlib.mjs';

/** Rec.709 luma from 8-bit sRGB, 0..1. Same transfer `valuelib` uses. */
export function luma8(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Widest contiguous horizontal run of `mask` in each row, over the mask's bbox.
 *
 * The widest RUN rather than the row's full extent: at the shipped 58deg camera a
 * fighter's mitts hang at the sides at torso level, and a row's extent would include
 * them and report the arm span as the body's width. A run is a body part.
 * Returns `{ y0, h, w: Int32Array(h) }` in ABSOLUTE row coordinates via y0.
 */
export function runWidthProfile(mask, W, H) {
  const bb = bbox(mask, W, H);
  if (!bb) return null;
  const w = new Int32Array(bb.h);
  for (let y = bb.y0; y <= bb.y1; y++) {
    let best = 0, run = 0;
    for (let x = bb.x0; x <= bb.x1; x++) {
      if (mask[y * W + x]) { run++; if (run > best) best = run; } else run = 0;
    }
    w[y - bb.y0] = best;
  }
  return { y0: bb.y0, x0: bb.x0, h: bb.h, w, bb };
}

/**
 * THE PINCH. For every candidate split row, the narrowing at that row relative to the
 * narrower of the two lobes it separates:
 *
 *   pinch(y) = 1 - w(y) / min( max w above y , max w below y )
 *
 * and the answer is the maximum over the search band.
 *
 * `min(above, below)` and not `above` alone: a chibi's head is frequently WIDER than
 * its shoulders (that is the archetype), so dividing by the head would report a pinch
 * on a figure whose "neck" is simply its own shoulder width. Dividing by the narrower
 * lobe asks the only question that matters — is there a place narrower than BOTH of
 * the things it joins.
 *
 * A single convex lobe returns EXACTLY 0: above the widest row, `max above y` is
 * `w(y)` itself; below it, `max below y` is `w(y)` itself. Pinned in the selftest.
 *
 * Search band defaults: rows 0.10h..0.62h from the top. The upper bound is the point
 * of the whole metric — a narrowing at the ankles is not a neck. The lower bound
 * keeps the crown of a head out of it.
 */
export function pinch(mask, W, H, opts = {}) {
  const prof = runWidthProfile(mask, W, H);
  if (!prof) return null;
  const { w, h, y0 } = prof;
  const lo = Math.max(1, Math.round((opts.bandTop ?? 0.10) * h));
  const hi = Math.min(h - 2, Math.round((opts.bandBottom ?? 0.62) * h));
  // The lower lobe is searched only to `bodyBottom` so that the taper into the legs
  // is not mistaken for the body's width.
  const bodyBottom = Math.min(h - 1, Math.round((opts.bodyBottom ?? 0.85) * h));
  if (hi <= lo) return { pinch: 0, row01: null, neckW: null, upperW: null, lowerW: null };

  // prefix maxima above; suffix maxima below (bounded at bodyBottom)
  const maxAbove = new Int32Array(h);
  let m = 0;
  for (let i = 0; i < h; i++) { if (w[i] > m) m = w[i]; maxAbove[i] = m; }
  const maxBelow = new Int32Array(h);
  m = 0;
  for (let i = bodyBottom; i >= 0; i--) { if (w[i] > m) m = w[i]; maxBelow[i] = m; }

  // ── BOTH LOBES HAVE TO BE LOBES ────────────────────────────────────────────
  // Without this, a thin vertical PROP above the mass is a perfect neck: soup's
  // ladle handle scored **0.7097**, the best in the cast, for a stick poking out of
  // a pot lid, and egg — a featureless ball at the shipped facing — scored a pinch
  // under one of its own shell shards. Both were caught by rendering the overlay
  // and LOOKING at it, which is the only reason this line exists.
  //
  // The threshold is set BY the reference rather than chosen: across the five
  // measurable Brawl Stars plates the narrower lobe is 0.617-1.000 of the wider one
  // (bs_04 is the minimum), so 0.45 clears every plate with real margin while
  // rejecting a ladle at 0.33, a lollipop stick at 0.29 and a shell shard at 0.12.
  const lobeMinFrac = opts.lobeMinFrac ?? 0.45;
  let best = 0, bestY = null, bestW = null, bestUp = null, bestLo = null;
  for (let i = lo; i <= hi; i++) {
    const up = maxAbove[i], dn = maxBelow[i];
    const ref = Math.min(up, dn);
    if (ref <= 0) continue;
    if (ref < lobeMinFrac * Math.max(up, dn)) continue;
    const p = 1 - w[i] / ref;
    if (p > best) { best = p; bestY = i; bestW = w[i]; bestUp = up; bestLo = dn; }
  }
  return {
    pinch: +best.toFixed(4),
    row01: bestY == null ? null : +(bestY / h).toFixed(3),
    rowAbs: bestY == null ? null : y0 + bestY,
    neckW: bestW, upperW: bestUp, lowerW: bestLo,
    headBodyWidth: bestUp && bestLo ? +(bestUp / bestLo).toFixed(3) : null,
    _prof: prof,
  };
}

/**
 * Per-row median luma of the mask INTERIOR (mask minus its 1px rim), 0..1.
 * The rim is dropped because a matte edge is antialiased against the background and
 * would inject the backdrop's value into every row equally.
 * Rows with fewer than `minRow` interior pixels return NaN.
 */
export function rowMedianLuma(mask, luma, W, H, minRow = 4, valid = null) {
  const bb = bbox(mask, W, H);
  if (!bb) return null;
  const inner = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const j = y * W + x;
    if (!mask[j]) continue;
    if (valid && !valid[j]) continue;
    if (mask[j - 1] && mask[j + 1] && mask[j - W] && mask[j + W]) inner[j] = 1;
  }
  const out = new Float64Array(bb.h).fill(NaN);
  const buf = [];
  for (let y = bb.y0; y <= bb.y1; y++) {
    buf.length = 0;
    for (let x = bb.x0; x <= bb.x1; x++) { const j = y * W + x; if (inner[j]) buf.push(luma[j]); }
    if (buf.length < minRow) continue;
    buf.sort((a, b) => a - b);
    out[y - bb.y0] = buf[buf.length >> 1];
  }
  return { y0: bb.y0, h: bb.h, m: out };
}

/**
 * THE OCCLUSION NOTCH. The deepest horizontal dark band in the upper body:
 *
 *   notch(y) = min( max m above within win , max m below within win ) - m(y)
 *
 * summarised per row by the MEDIAN, so a dark eye decal or a single dark stripe of
 * garment down one side cannot manufacture one — it takes a band across the figure.
 * `win` is a fraction of subject height so the number is scale-free.
 */
export function notch(mask, luma, W, H, opts = {}) {
  const rm = rowMedianLuma(mask, luma, W, H, opts.minRow ?? 4, opts.valid ?? null);
  if (!rm) return null;
  const { m, h, y0 } = rm;
  const win = Math.max(2, Math.round((opts.win ?? 0.22) * h));
  const lo = Math.max(1, Math.round((opts.bandTop ?? 0.10) * h));
  const hi = Math.min(h - 2, Math.round((opts.bandBottom ?? 0.62) * h));
  let best = 0, bestY = null, bestA = null, bestB = null;
  for (let i = lo; i <= hi; i++) {
    if (!Number.isFinite(m[i])) continue;
    let a = -1, b = -1;
    for (let k = Math.max(0, i - win); k < i; k++) if (Number.isFinite(m[k]) && m[k] > a) a = m[k];
    for (let k = i + 1; k <= Math.min(h - 1, i + win); k++) if (Number.isFinite(m[k]) && m[k] > b) b = m[k];
    if (a < 0 || b < 0) continue;
    const v = Math.min(a, b) - m[i];
    if (v > best) { best = v; bestY = i; bestA = a; bestB = b; }
  }
  return {
    notch: +best.toFixed(4),
    row01: bestY == null ? null : +(bestY / h).toFixed(3),
    rowAbs: bestY == null ? null : y0 + bestY,
    above: bestA == null ? null : +bestA.toFixed(4),
    below: bestB == null ? null : +bestB.toFixed(4),
    at: bestY == null ? null : +m[bestY].toFixed(4),
    _rows: rm,
  };
}

/** Notch depth evaluated at ONE given absolute row — for "is the notch AT the neck?". */
export function notchAtRow(rm, rowAbs, opts = {}) {
  if (!rm || rowAbs == null) return null;
  const { m, h, y0 } = rm;
  const i = rowAbs - y0;
  if (i < 1 || i > h - 2 || !Number.isFinite(m[i])) return null;
  const win = Math.max(2, Math.round((opts.win ?? 0.22) * h));
  let a = -1, b = -1;
  for (let k = Math.max(0, i - win); k < i; k++) if (Number.isFinite(m[k]) && m[k] > a) a = m[k];
  for (let k = i + 1; k <= Math.min(h - 1, i + win); k++) if (Number.isFinite(m[k]) && m[k] > b) b = m[k];
  if (a < 0 || b < 0) return null;
  return +(Math.min(a, b) - m[i]).toFixed(4);
}

/**
 * HEAD-TO-BODY MASS, and the light end, at one horizontal cut.
 *
 * ── Why mass, when the outline is already at the reference median ────────────
 * A critic audit measured burrito at **head 46 px wide, body 15 px, figure 126 px
 * tall — a needle** — and observed that hull deficiency and the appendage count are
 * AREA-BLIND, so eleven of eleven clearing the silhouette floor could not have
 * changed that read. It withheld a reference number because its own segmentation
 * guard on the busy gameplay plates read 0.07-0.35 purity.
 *
 * The full-body plates in `fullbody_fair` do not have that problem — one character,
 * plain backdrop, and the segmentation has been rendered and LOOKED AT for all six.
 * So this supplies the number that was withheld, by the same rule that made the
 * silhouette band trustworthy: identical code, both sides.
 *
 * The cut is the `neckRow01` the pinch found, or the reference's own median row
 * (0.453) when a character has no measurable pinch at all — which several do, and
 * they are precisely the ones this number exists to describe.
 *
 * `clipShare` rides along because it needs exactly the same mask+luma pair: the
 * share of the character above luma `clipAt`. The audit measured **our egg at
 * 24.3% against Shelly 0.2% and Barley 0.0%**, with empty-floor controls at 0.0%,
 * i.e. it is the character and not the frame.
 */
export function massSplit(mask, luma, W, H, opts = {}) {
  const bb = bbox(mask, W, H);
  if (!bb) return null;
  const valid = opts.valid ?? null;
  const cut01 = opts.cut01 ?? 0.453;
  const cutY = bb.y0 + Math.round(cut01 * bb.h);
  let up = 0, dn = 0, upW = 0, dnW = 0, n = 0, clip = 0;
  const lum = [];
  for (let y = bb.y0; y <= bb.y1; y++) {
    let rowN = 0;
    for (let x = bb.x0; x <= bb.x1; x++) {
      const j = y * W + x;
      if (!mask[j]) continue;
      rowN++;
      if (y < cutY) up++; else dn++;
      if (luma && (!valid || valid[j])) { n++; lum.push(luma[j]); if (luma[j] > (opts.clipAt ?? 0.94)) clip++; }
    }
    if (y < cutY) { if (rowN > upW) upW = rowN; } else if (rowN > dnW) dnW = rowN;
  }
  lum.sort((a, b) => a - b);
  const q = (p) => (lum.length ? lum[Math.min(lum.length - 1, Math.floor(p * (lum.length - 1)))] : null);
  return {
    cut01: +cut01.toFixed(3),
    headAreaPx: up, bodyAreaPx: dn,
    /** > 1 means more of the character is ABOVE the cut than below it. */
    headBodyArea: dn > 0 ? +(up / dn).toFixed(3) : null,
    /** Widest ROW above the cut over widest row below it — the "needle" number. */
    headBodyRowWidth: dnW > 0 ? +(upW / dnW).toFixed(3) : null,
    clipShare: n ? +(clip / n).toFixed(4) : null,
    p95: q(0.95), p05: q(0.05),
  };
}

/**
 * Interior edge density — the fraction of interior pixels carrying a luma step of at
 * least `t`. A diagnostic for "one undifferentiated mass", NOT a gate: a busy texture
 * raises it without adding any structure, which is exactly the confusion the pinch and
 * the notch avoid by being about ONE break rather than about business.
 */
export function interiorEdge(mask, luma, W, H, t = 0.10, valid = null) {
  const inner = new Uint8Array(W * H);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const j = y * W + x;
    if (!mask[j]) continue;
    if (valid && !valid[j]) continue;
    if (mask[j - 1] && mask[j + 1] && mask[j - W] && mask[j + W] &&
        mask[j - 2] && mask[j + 2] && mask[j - 2 * W] && mask[j + 2 * W]) inner[j] = 1;
  }
  let n = 0, hits = 0, sum = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const j = y * W + x;
    if (!inner[j]) continue;
    const gx = (luma[j + 1] - luma[j - 1]) * 0.5;
    const gy = (luma[j + W] - luma[j - W]) * 0.5;
    const g = Math.hypot(gx, gy);
    n++; sum += g;
    if (g >= t) hits++;
  }
  return { n, density: n ? +(hits / n).toFixed(4) : null, meanGrad: n ? +(sum / n).toFixed(4) : null };
}

/**
 * Nearest-cell resample of a mask AND an aligned luma plane to a common subject
 * height, using the identical cell grid `silhlib.resampleMaskToHeight` uses.
 *
 * The mask takes an area MAJORITY (a mask is not an image; box-averaging would invent
 * grey and re-thresholding it erodes thin limbs). The luma takes an area MEAN over the
 * cell's MASK pixels only — averaging in the background would drag every rim row
 * toward the backdrop and manufacture a notch out of nothing at the top and bottom of
 * the figure.
 *
 * ⚠️ The cell arithmetic here is a deliberate duplicate of silhlib's. The selftest
 * asserts the two produce IDENTICAL masks (`docs/LESSONS.md` §5: a copied driver is a
 * bug factory — this one is pinned by an assertion instead of by hope).
 */
export function resamplePair(mask, luma, W, H, targetH, valid = null) {
  const bb = bbox(mask, W, H);
  if (!bb) return null;
  const s = targetH / bb.h;
  if (s >= 1) return { mask, luma, valid, W, H, scale: 1 };
  const dw = Math.max(1, Math.round(W * s)), dh = Math.max(1, Math.round(H * s));
  const om = new Uint8Array(dw * dh);
  const ol = new Float32Array(dw * dh);
  const ov = valid ? new Uint8Array(dw * dh) : null;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const x0 = Math.floor((x / dw) * W), x1 = Math.max(x0 + 1, Math.floor(((x + 1) / dw) * W));
    const y0 = Math.floor((y / dh) * H), y1 = Math.max(y0 + 1, Math.floor(((y + 1) / dh) * H));
    let on = 0, tot = 0, acc = 0, va = 0, vt = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const j = yy * W + xx;
      tot++;
      if (mask[j]) {
        on++;
        // The luma mean is taken over VALID mask pixels only — an occluded pixel
        // carries the occluder's colour, and averaging it in is exactly the fault
        // `docs/LESSONS.md` §5 records for `valuescan --mode dl`.
        if (!valid || valid[j]) { acc += luma[j]; va++; }
        if (valid) vt++;
      }
    }
    const k = y * dw + x;
    om[k] = on * 2 >= tot ? 1 : 0;
    ol[k] = va ? acc / va : 0;
    if (ov) ov[k] = va * 2 >= vt && va > 0 ? 1 : 0;
  }
  return { mask: om, luma: ol, valid: ov, W: dw, H: dh, scale: s };
}

/**
 * The whole packet, from a mask + aligned luma at a common subject height.
 * `kFrac` matches `silhlib.silhouette`'s default so `corePinch` is measured on exactly
 * the core that metric calls "not an appendage".
 */
export function separation(mask, luma, W, H, opts = {}) {
  const bb = bbox(mask, W, H);
  if (!bb) return null;
  const kFrac = opts.kFrac ?? 0.045;
  const k = Math.max(1.0, kFrac * bb.h);
  const core = opening(mask, W, H, k);
  const cc = components(core, W, H);
  const minLobe = Math.max(8, 0.02 * bb.n);
  const coreParts = cc.sizes.filter((n) => n >= minLobe).length;
  const mc = components(mask, W, H);
  const maskParts = mc.sizes.filter((n) => n >= 0.05 * bb.n).length;

  const raw = pinch(mask, W, H, opts);
  const cor = pinch(core, W, H, opts);
  const nt = luma ? notch(mask, luma, W, H, opts) : null;
  const ie = luma ? interiorEdge(mask, luma, W, H, opts.edgeT ?? 0.10, opts.valid ?? null) : null;
  // Cut at the character's own neck where it has one, and at the REFERENCE's median
  // neck row (0.453 over six plates, range 0.375-0.522) where it does not — because
  // "has no measurable neck" must still produce a mass number, and falling back to
  // the subject's own geometry would make the cut mean something different per row.
  const ms = massSplit(mask, luma, W, H, { ...opts, cut01: raw && raw.row01 != null ? raw.row01 : 0.453 });

  return {
    heightPx: bb.h, widthPx: bb.w, areaPx: bb.n,
    openingRadiusPx: +k.toFixed(2),
    neckPinch: raw ? raw.pinch : null,
    neckRow01: raw ? raw.row01 : null,
    neckWidthPx: raw ? raw.neckW : null,
    headBodyWidth: raw ? raw.headBodyWidth : null,
    corePinch: cor ? cor.pinch : null,
    coreRow01: cor ? cor.row01 : null,
    coreParts,
    maskParts,
    /**
     * A pinch is a NARROWING between two joined lobes. If the widest run at the
     * winning row is ZERO the lobes are not joined at all, and the number is a hole
     * in the mask rather than a neck — that is not a hypothetical: a reference plate
     * whose helmet segments away from its body came back at neckPinch **1.0000**, a
     * perfect score, from a gap. `docs/LESSONS.md` §5's prescription is to report
     * such a sample as INVALID rather than as a number, because a number is
     * indistinguishable from a good one.
     *
     * On our own render this can never fire silently: 0 detached limb px is a hard
     * gate, so a false here is a real regression and is worth failing on.
     */
    severed: !!(raw && raw.rowAbs != null && raw.neckW === 0),
    pinchValid: !raw ? false : raw.rowAbs == null ? true : raw.neckW > 0,
    chinNotch: nt ? nt.notch : null,
    notchRow01: nt ? nt.row01 : null,
    notchAtNeck: nt && raw ? notchAtRow(nt._rows, raw.rowAbs, opts) : null,
    interiorEdgeDensity: ie ? ie.density : null,
    interiorMeanGrad: ie ? ie.meanGrad : null,
    cut01: ms.cut01,
    headBodyArea: ms.headBodyArea,
    headBodyRowWidth: ms.headBodyRowWidth,
    clipShare: ms.clipShare,
    p95: ms.p95 == null ? null : +ms.p95.toFixed(4),
    p05: ms.p05 == null ? null : +ms.p05.toFixed(4),
    _core: core, _raw: raw, _cor: cor, _notch: nt,
  };
}
