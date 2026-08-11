#!/usr/bin/env node
/**
 * DOES THE GROUND GO DARK UNDER A *CHARACTER*? — ours against the six plates.
 *
 * `tools/tmp/contactshadow.mjs` and `tools/tmp/aoband.mjs` instrument the PROP
 * version of contact grounding, and `tools/tmp/refcontact.mjs` supplies its
 * reference target off two hand-marked barrels in `bs_04`. The CHARACTER version had
 * no reference target at all: `contactshadow`'s `heroShadeDL`/`heroCoreDL` measure
 * our own cast shadow by ablation and there is no number on the other side of the
 * comparison. Nine of fourteen arena critics said, unprompted, that "the characters
 * sit on it like decals rather than in a built environment ... no contact shading".
 *
 * ── TWO THINGS MAKE THIS HARD AND NEITHER IS OPTIONAL TO SOLVE ──────────────
 *
 * (1) Every brawler in every plate stands inside a saturated coloured TEAM/ENEMY
 *     INDICATOR ellipse — green or cyan for an ally, orange or pink for an enemy —
 *     roughly 3x the radius of its own footprint, and often a FILL rather than a
 *     ring. A "mean luma at the foot line, ours vs theirs" measures that decal, not
 *     a shadow. Verified by eye at 2.7x with a x3.5 contrast stretch
 *     (`tools/tmp/cs_zoom.mjs`): under `bs_06`'s ROSA and GRIFF there is an
 *     unmistakable dark blob at the feet AND a bright indicator around it, at
 *     overlapping radii.
 *
 * (2) There is NO CLEAN ANNULUS of open floor around a brawler in these plates.
 *     The first draft of this tool took "open floor" as the ring t in [3.6,5.2] and
 *     it returned NEGATIVE contact on four of seven marks — because that ring is
 *     full of crates, bushes, other brawlers and VFX. Its own contamination column
 *     said so (`farSpread` 0.10-0.59 where a clean floor reads under 0.05), which is
 *     why that column exists. The reading was discarded, not published.
 *
 * ── WHAT IT MEASURES INSTEAD ────────────────────────────────────────────────
 *   floorL   the MODAL luma of the floor around the mark. Two sources: a HAND-MARKED
 *            clean rect on the plate (reference side, verified in the overlay), or
 *            the annulus t in [2.6, 6.0] on the two measured flanks (our side). Which
 *            one is used was decided by the ablation, not by taste — see
 *            `tools/tmp/cs_floorab.mjs`. A mode, not a mean or a median: floor is the
 *            PLURALITY of a ground-level neighbourhood even with props, bushes and
 *            decals in it, and it is not necessarily the majority.
 *   NEAR     t in [1.10, 2.20] of the footprint ellipse — inside the indicator, where
 *            a contact shadow lives. Starts past 1.0 so the character's own boots are
 *            not counted as ground.
 *
 *   coreDL  = floorL - p10(NEAR)      how much darker the darkest ground at the feet
 *                                     is than the floor it stands on
 *   coreFrac = coreDL / floorL        THE COLUMN THAT COMPARES ACROSS SIDES. A shadow
 *                                     MULTIPLIES; the same shadow is 0.11 of luma on
 *                                     bs_06's 0.28 floor and 0.30 on our 0.75 tile.
 *
 * p10 is blind to a BRIGHT decal by construction (the selftest asserts a bright ring
 * in the near band moves coreDL by < 0.005, and that a MEAN-based version is fooled
 * by the same input).
 *
 * ── DIRECTIONAL OR CENTRED — the question the brief actually asks ────────────
 * NEAR is measured on TWO FLANKS, mirrored about the screen-vertical axis:
 *   shade   the sector the light throws the shadow into (down-left in every plate and
 *           in our rig — key azimuth -31 deg, `src/render/lighting.ts`)
 *   opp     that sector reflected across the vertical axis (down-right)
 * Both are DOWN-screen, so neither contains the character's own body (which projects
 * up-screen from its feet) or the HUD above its head. A purely directional cast
 * shadow darkens `shade` and leaves `opp` alone; a centred contact ellipse darkens
 * both equally.
 *
 *   centredFrac = oppCoreDL / shadeCoreDL      0 = pure cast, 1 = pure contact
 *
 * The aim is CHECKED rather than assumed: `tools/tmp/cs_shdir.mjs` diffs the shipped
 * and ablated frames and reports where the shadow's darkening MASS actually lies.
 * 149.4-154.5 deg against a sector aimed at 152.1, with 89.8-91.9% of the mass inside
 * the measured flank. My own eye read that same shadow as "about 176 deg, straight
 * left" off the rendered frame and was wrong by 24 deg.
 *
 * ── THE KNOWN-BAD INPUT ─────────────────────────────────────────────────────
 * Two of them, because the two sides admit different ones:
 *   REFERENCE  marks with `"kind": "null"` are patches of OPEN FLOOR WITH NO
 *              CHARACTER ON THEM, measured by the identical code path. On the two
 *              plates whose floor mode is uniform across the image (bs_04, bs_06)
 *              they return 0.0003 and 0.0019. On bs_01 and bs_05, whose floors are
 *              not uniform, they return 0.118 and 0.191 — so those plates' rows are
 *              NOT USABLE, and the control is what says so.
 *   OURS       every frame is rendered twice, shipped and with the cast's own
 *              `castShadow` off and nothing else moved. The ablated frame is what
 *              "no contact shadow at all" reads as. Paired on the same frame, the
 *              opposite flank's delta comes back 0.0000-0.0001, which is this
 *              instrument's resolution floor on our own material.
 *
 * ── WHAT IS EXCLUDED BY POLICY (docs/LESSONS.md §6b) ───────────────────────
 *   * the up-screen half of every ring — body, weapon, name plate, health bar
 *   * everything inside t = 1.10 — the character's own footprint
 *   * everything between t = 2.20 and t = 2.60 — a guard band between the shadow and
 *     the floor estimate
 *   * on the reference side, EVERY BRAWLER on bs_01/02/03/05 and every plate whose
 *     null sites fail. What is left is bs_06's props. See the report in
 *     `shots/contact/ref.json`.
 * `bandFrac` reports the share of the whole frame the NEAR band covers: 0.27-0.38%
 * per subject on a plate, 1.47% per character on our own 1600x900 frame, and the
 * shadow's own diff mask is 0.78% of our frame. That is small, it is stated rather
 * than buried, and §6b is the reason it is stated.
 *
 *   node tools/tmp/cs_charcontact.mjs --selftest
 *   node tools/tmp/cs_charcontact.mjs --ref
 *   node tools/tmp/cs_charcontact.mjs --ours --url $URL [--tag before]
 */
import { readFile } from 'node:fs/promises';

const has = (k) => process.argv.includes('--' + k);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };

export const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export const NEAR = [1.10, 2.20];
/** Support for the floor-level estimate. Starts past NEAR with a guard band. */
export const FLOOR_BAND = [2.60, 6.00];
export const HALF_ANGLE = 50;
export const FLOOR_HALF_ANGLE = 60;

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))] : NaN);

/**
 * Modal luma, 128 bins over [0,1], smoothed over +/-1 bin so a bimodal-by-one-pixel
 * histogram cannot flip the answer. Returned as the bin centre.
 *
 * Chosen over a mean or a median because the support deliberately contains props,
 * bushes and decals: the floor is the PLURALITY of a ground-level neighbourhood,
 * not its average and not necessarily its majority.
 */
export function modeL(samples, bins = 128) {
  if (!samples.length) return NaN;
  const h = new Float64Array(bins);
  const idx = (v) => Math.min(bins - 1, Math.max(0, Math.floor(v * bins)));
  for (const v of samples) h[idx(v)]++;
  let best = 0, bestV = -1;
  for (let i = 0; i < bins; i++) {
    // The centre is weighted 2x, and that is not cosmetic: with a flat-field
    // histogram (one bin holds everything) an unweighted 3-tap smoother scores bins
    // i-1, i and i+1 IDENTICALLY, `s > bestV` keeps the first, and the returned mode
    // lands a whole bin low — worth -0.0067 of luma on every row, which is the same
    // order as the thing being measured. Caught by the flat-field case below.
    const s = (h[i - 1] ?? 0) + 2 * h[i] + (h[i + 1] ?? 0);
    if (s > bestV) { bestV = s; best = i; }
  }
  // Refined off the bin grid: the MEAN of the samples inside the peak's own +/-1
  // bins. A bin centre carries up to 1/(2*bins) = 0.004 of quantisation error, and
  // this metric's whole range is ~0.15.
  let sum = 0, n = 0;
  for (const v of samples) { const i = idx(v); if (i >= best - 1 && i <= best + 1) { sum += v; n++; } }
  return n ? sum / n : (best + 0.5) / bins;
}

/**
 * Luma samples in an elliptical annulus [t0,t1] restricted to a screen-direction
 * sector. `dirDeg` is in SCREEN degrees (+x right, +y DOWN). Returns them SORTED.
 *
 * The sector test uses the true pixel direction, not the ellipse-normalised one: a
 * sector is an angular region of the picture, and normalising it by (rx,ry) would
 * make "down-left" mean different things at different ellipse aspects.
 */
export function sector(rgb, W, H, e, t0, t1, dirDeg, halfAngle = HALF_ANGLE) {
  const out = [];
  const dx0 = Math.cos((dirDeg * Math.PI) / 180), dy0 = Math.sin((dirDeg * Math.PI) / 180);
  const cosLim = Math.cos((halfAngle * Math.PI) / 180);
  const RX = e.rx * t1 + 2, RY = e.ry * t1 + 2;
  const x0 = Math.max(0, Math.floor(e.cx - RX)), x1 = Math.min(W, Math.ceil(e.cx + RX));
  const y0 = Math.max(0, Math.floor(e.cy - RY)), y1 = Math.min(H, Math.ceil(e.cy + RY));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const ux = (x + 0.5 - e.cx) / e.rx, uy = (y + 0.5 - e.cy) / e.ry;
      const t = Math.hypot(ux, uy);
      if (t < t0 || t > t1) continue;
      const px = x + 0.5 - e.cx, py = y + 0.5 - e.cy;
      const l = Math.hypot(px, py) || 1;
      if ((px / l) * dx0 + (py / l) * dy0 < cosLim) continue;
      const i = (y * W + x) * 3;
      out.push(luma(rgb[i], rgb[i + 1], rgb[i + 2]));
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

/** Mirror a screen direction across the vertical axis: (dx,dy) -> (-dx,dy). */
export const mirrorDeg = (d) => ((180 - d) % 360 + 360) % 360;

/**
 * The whole measurement for one character. `shadowDeg` must point DOWN-screen
 * (sin > 0) — every plate and our own rig throw down-and-left, and the two-flank
 * decomposition is meaningless otherwise. Thrown rather than clamped: a mark with
 * the sign wrong is a mark that has not been looked at.
 */
export function measure(rgb, W, H, e, shadowDeg, opts = {}) {
  const near = opts.near ?? NEAR, fb = opts.floorBand ?? FLOOR_BAND;
  const ha = opts.halfAngle ?? HALF_ANGLE, fha = opts.floorHalfAngle ?? FLOOR_HALF_ANGLE;
  if (Math.sin((shadowDeg * Math.PI) / 180) <= 0) throw new Error(`shadowDeg ${shadowDeg} does not point down-screen`);
  const opp = mirrorDeg(shadowDeg);

  // The floor level. Two sources, and which one is used matters enormously:
  //
  //  * a HAND-MARKED clean rect on the same plate (`opts.floorRect`), verified in
  //    the overlay. This is what the reference and our own frames both use.
  //  * failing that, the local annulus FLOOR_BAND — which is what the first draft
  //    did, and it FAILED its own null-site control: on twelve patches of empty
  //    floor the identical code path returned anything from 0.000 to 0.326, because
  //    that annulus is full of crates, bushes, vents and other brawlers. A 0.326
  //    noise floor against a 0.2 signal is not an instrument. Kept as a fallback and
  //    as the reason the hand-marked rect exists.
  let floorAll;
  if (opts.floorRect) {
    const fr = opts.floorRect;
    floorAll = [];
    for (let y = Math.max(0, fr.cy - (fr.h >> 1)); y < Math.min(H, fr.cy + (fr.h >> 1)); y++) {
      for (let x = Math.max(0, fr.cx - (fr.w >> 1)); x < Math.min(W, fr.cx + (fr.w >> 1)); x++) {
        const i = (y * W + x) * 3;
        floorAll.push(luma(rgb[i], rgb[i + 1], rgb[i + 2]));
      }
    }
    floorAll.sort((a, b) => a - b);
  } else {
    floorAll = sector(rgb, W, H, e, fb[0], fb[1], shadowDeg, fha)
      .concat(sector(rgb, W, H, e, fb[0], fb[1], opp, fha)).sort((a, b) => a - b);
  }
  const floorL = modeL(floorAll);

  const r = {};
  for (const [name, dir] of [['shade', shadowDeg], ['opp', opp]]) {
    const n = sector(rgb, W, H, e, near[0], near[1], dir, ha);
    r[name] = {
      p10: +pct(n, 0.10).toFixed(4), p50: +pct(n, 0.50).toFixed(4), n: n.length,
      coreDL: floorL - pct(n, 0.10),
      medDL: floorL - pct(n, 0.50),
    };
  }
  const radial = [];
  for (let t = 0.9; t <= 6.0; t += 0.25) {
    const s = sector(rgb, W, H, e, t, t + 0.25, shadowDeg, ha);
    const o = sector(rgb, W, H, e, t, t + 0.25, opp, ha);
    radial.push({ t: +t.toFixed(2), shadeP10: +pct(s, 0.10).toFixed(4), shadeP50: +pct(s, 0.50).toFixed(4),
      oppP10: +pct(o, 0.10).toFixed(4), oppP50: +pct(o, 0.50).toFixed(4) });
  }
  const nearPx = r.shade.n + r.opp.n;
  return {
    floorL: +floorL.toFixed(4),
    // FRACTIONAL darkening, and this is the column to compare across sides. A shadow
    // MULTIPLIES the surface it falls on, so the same shadow reads 0.11 of luma on
    // bs_06's 0.28 maroon floor and 0.30 on our own 0.75 tile. An absolute dL is not
    // comparable between two games with different floors; a fraction is, and it is
    // also directly the opacity a contact decal would have to be authored at.
    shadeCoreFrac: +(r.shade.coreDL / floorL).toFixed(3),
    oppCoreFrac: +(r.opp.coreDL / floorL).toFixed(3),
    // How lumpy the floor sample is. A hand-marked clean rect reads under ~0.10;
    // the local annulus the first draft used reads 0.3-0.6 on these plates. Printed,
    // never silently corrected — the first draft was wrong precisely here.
    floorSpread: +(pct(floorAll, 0.90) - pct(floorAll, 0.10)).toFixed(4),
    floorPx: floorAll.length,
    shadeCoreDL: +r.shade.coreDL.toFixed(4), shadeMedDL: +r.shade.medDL.toFixed(4),
    oppCoreDL: +r.opp.coreDL.toFixed(4), oppMedDL: +r.opp.medDL.toFixed(4),
    // 0 = purely directional cast shadow, 1 = symmetric contact ellipse. null when
    // the denominator is inside its own noise: a ratio against nothing is not a
    // measurement.
    centredFrac: Math.abs(r.shade.coreDL) < 0.02 ? null : +(r.opp.coreDL / r.shade.coreDL).toFixed(3),
    shade: r.shade, opp: r.opp,
    nearPx, bandFrac: +((100 * nearPx) / (W * H)).toFixed(3),
    radial,
  };
}

// ── SELFTEST ─────────────────────────────────────────────────────────────────
// Every case is chosen so that a plausible WRONG implementation FAILS it.
if (has('selftest')) {
  let pass = 0, fail = 0;
  const ok = (nm, c, got) => { if (c) pass++; else { fail++; console.log(`  FAIL ${nm}  got ${got}`); } };
  const W = 400, H = 400;
  const E = { cx: 200, cy: 200, rx: 20, ry: 10 };
  const SHADOW = 150;               // down-left, as in every plate and our own rig
  const OPP = mirrorDeg(SHADOW);    // 30 -> down-right
  ok('mirror keeps it down-screen', Math.sin((OPP * Math.PI) / 180) > 0, OPP);
  ok('mirror flips the horizontal', Math.cos((OPP * Math.PI) / 180) > 0 && Math.cos((SHADOW * Math.PI) / 180) < 0, OPP);

  const blank = (v = 180) => Buffer.alloc(W * H * 3, v);
  const tOf = (x, y) => Math.hypot((x + 0.5 - E.cx) / E.rx, (y + 0.5 - E.cy) / E.ry);
  const dirOf = (x, y) => { const px = x + 0.5 - E.cx, py = y + 0.5 - E.cy; return (Math.atan2(py, px) * 180) / Math.PI; };
  const within = (a, b, w) => Math.abs(((a - b) % 360 + 540) % 360 - 180) <= w;
  const paint = (buf, fn) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = fn(x, y, tOf(x, y), dirOf(x, y)); if (v != null) buf.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3); } };
  const RAMP = (t, span) => Math.round(180 - 60 * Math.max(0, 1 - t / span));

  // 1 — a flat field has no contact shadow. An implementation that measures absolute
  //     darkness rather than a difference fails here. This is the synthetic NULL SITE.
  {
    const m = measure(blank(), W, H, E, SHADOW);
    ok('flat field: shadeCoreDL ~0', Math.abs(m.shadeCoreDL) < 0.005, m.shadeCoreDL);
    ok('flat field: oppCoreDL ~0', Math.abs(m.oppCoreDL) < 0.005, m.oppCoreDL);
    ok('flat field: centredFrac null', m.centredFrac === null, m.centredFrac);
    ok('flat field: floorSpread 0', Math.abs(m.floorSpread) < 1e-6, m.floorSpread);
    ok('flat field: both flanks sampled', m.shade.n > 200 && m.opp.n > 200, `${m.shade.n}/${m.opp.n}`);
    ok('flat field: flanks are symmetric in area', Math.abs(m.shade.n - m.opp.n) <= 2, `${m.shade.n}/${m.opp.n}`);
  }

  // 2 — a SYMMETRIC contact ellipse. Both flanks must see it and centredFrac -> 1.
  {
    const b = blank();
    paint(b, (x, y, t) => (t < 2.4 ? RAMP(t, 2.4) : null));
    const m = measure(b, W, H, E, SHADOW);
    ok('centred ellipse: shade sees it', m.shadeCoreDL > 0.05, m.shadeCoreDL);
    ok('centred ellipse: opp sees it', m.oppCoreDL > 0.05, m.oppCoreDL);
    ok('centred ellipse: centredFrac ~1', Math.abs(m.centredFrac - 1) < 0.10, m.centredFrac);
  }

  // 3 — a PURELY DIRECTIONAL half-shadow. This is the case the shipped rig is
  //     hypothesised to be in, and the one a single "mean darkening at the foot
  //     line" figure cannot tell apart from case 2.
  {
    const b = blank();
    paint(b, (x, y, t, d) => (t < 2.4 && within(d, SHADOW, 60) ? RAMP(t, 2.4) : null));
    const m = measure(b, W, H, E, SHADOW);
    ok('directional: shade sees it', m.shadeCoreDL > 0.05, m.shadeCoreDL);
    ok('directional: opp sees nothing', Math.abs(m.oppCoreDL) < 0.01, m.oppCoreDL);
    ok('directional: centredFrac ~0', Math.abs(m.centredFrac) < 0.05, m.centredFrac);
  }

  // 4 — THE POLICY CHECK. A BRIGHT team-indicator decal inside the near band must not
  //     register as anything. A mean-based instrument reads it as NEGATIVE contact
  //     ("the ground under them is brighter than open floor"), which is the exact
  //     confidently-wrong answer this tool exists to avoid.
  {
    const b = blank();
    paint(b, (x, y, t) => (t > 1.3 && t < 2.1 ? 245 : null));
    const m = measure(b, W, H, E, SHADOW);
    ok('bright indicator in NEAR: coreDL ~0', Math.abs(m.shadeCoreDL) < 0.005, m.shadeCoreDL);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const meanNear = mean(sector(b, W, H, E, NEAR[0], NEAR[1], SHADOW));
    ok('...and a MEAN-based version WOULD be fooled', m.floorL - meanNear < -0.05, (m.floorL - meanNear).toFixed(4));
  }

  // 5 — a bright indicator AND a real shadow together: the shadow must still read.
  {
    const b = blank();
    paint(b, (x, y, t) => (t > 1.3 && t < 2.1 ? 245 : null));
    paint(b, (x, y, t) => (t < 1.6 ? 120 : null));
    const m = measure(b, W, H, E, SHADOW);
    ok('shadow under a bright ring still reads', m.shadeCoreDL > 0.15, m.shadeCoreDL);
  }

  // 6 — a BRIGHT DECAL INSIDE THE FLOOR SUPPORT. The mode must stay on the floor;
  //     a mean or a median floor estimate drifts and every DL drifts with it.
  {
    const b = blank();
    paint(b, (x, y, t) => (t > 2.7 && t < 3.5 ? 250 : null));
    const m = measure(b, W, H, E, SHADOW);
    ok('bright decal in the floor support: floorL stays', Math.abs(m.floorL - luma(180, 180, 180)) < 0.01, m.floorL);
    ok('...and coreDL stays ~0', Math.abs(m.shadeCoreDL) < 0.005, m.shadeCoreDL);
    ok('...and floorSpread FLAGS the contamination', m.floorSpread > 0.15, m.floorSpread);
  }

  // 7 — a DARK-SEAMED FLOOR. Ours is a tiled checkerboard; a naive absolute darkness
  //     reads its grout as contact shadow. The pitch is 8 px so that 23% of pixels
  //     are grout and p10 lands ON the grout — at a sparser pitch p10 misses the
  //     seams entirely and the case proves nothing.
  {
    const b = blank();
    paint(b, (x, y) => ((x % 8 === 0 || y % 8 === 0) ? 90 : null));
    const m = measure(b, W, H, E, SHADOW);
    ok('dark-seamed floor: coreDL is the seam depth, not more', Math.abs(m.shadeCoreDL - (luma(180, 180, 180) - luma(90, 90, 90))) < 0.02, m.shadeCoreDL);
    ok('dark-seamed floor: BOTH flanks read the same', Math.abs(m.shadeCoreDL - m.oppCoreDL) < 0.02, `${m.shadeCoreDL}/${m.oppCoreDL}`);
    ok('dark-seamed floor: floorSpread flags it', m.floorSpread > 0.15, m.floorSpread);
  }

  // 8 — ellipse ASPECT. The same physical shadow on a rounder ellipse must give the
  //     same answer; an implementation that measures in pixels rather than in
  //     footprint radii fails this.
  {
    const E2 = { cx: 200, cy: 200, rx: 18, ry: 18 };
    const b = blank();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = Math.hypot((x + 0.5 - 200) / 18, (y + 0.5 - 200) / 18);
      if (t < 2.4) b.fill(RAMP(t, 2.4), (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
    const m = measure(b, W, H, E2, SHADOW);
    const c = blank(); paint(c, (x, y, t) => (t < 2.4 ? RAMP(t, 2.4) : null));
    const ref = measure(c, W, H, E, SHADOW);
    ok('aspect-invariant within 0.02', Math.abs(m.shadeCoreDL - ref.shadeCoreDL) < 0.02, `${m.shadeCoreDL} vs ${ref.shadeCoreDL}`);
  }

  // 9 — an UP-SCREEN shadow direction is refused rather than measured.
  {
    let threw = false;
    try { measure(blank(), W, H, E, -30); } catch { threw = true; }
    ok('up-screen shadowDeg is refused', threw, threw);
  }

  // 10 — the character's OWN BODY, painted up-screen where it really projects, must
  //      not reach either flank. This is what the down-screen policy buys.
  {
    const b = blank();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (y < 200 && y > 130 && Math.abs(x - 200) < 26) b.fill(20, (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
    const m = measure(b, W, H, E, SHADOW);
    ok('up-screen body does not leak into shade', Math.abs(m.shadeCoreDL) < 0.01, m.shadeCoreDL);
    ok('up-screen body does not leak into opp', Math.abs(m.oppCoreDL) < 0.01, m.oppCoreDL);
  }

  // 11 — sanity on the sampler and on the mode.
  {
    const b = blank();
    const s = sector(b, W, H, E, 1, 2, SHADOW);
    const all = sector(b, W, H, E, 1, 2, SHADOW, 180);
    ok('a 50 deg sector is smaller than the whole ring', s.length < all.length * 0.45, `${s.length}/${all.length}`);
    ok('sector returns sorted samples', s.every((v, i) => i === 0 || v >= s[i - 1]), 'unsorted');
    ok('mode finds the plurality, not the mean', Math.abs(modeL([0.1, 0.1, 0.1, 0.9, 0.9]) - 0.1) < 0.02, modeL([0.1, 0.1, 0.1, 0.9, 0.9]));
    ok('mode is NaN on nothing', Number.isNaN(modeL([])), modeL([]));
  }

  console.log(`\ncs_charcontact --selftest  ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

// ── HAND-MARKED REFERENCE FOOTPRINTS ─────────────────────────────────────────
// Read off the plates and DRAWN BACK ONTO THEM before use
// (`node tools/tmp/cs_mark.mjs` -> shots/contact/mk_*.png). refcontact.mjs's first
// set of marks was wrong — the ellipses sat at mid-body rather than at the foot —
// and only the overlay caught it. A mark that has not been drawn back onto the
// image is a guess with a decimal point.
//
// `shadowDeg` is where that brawler's own shadow falls, in screen degrees (+x right,
// +y down). Every prop and every brawler in all six plates agrees on down-and-left,
// which is itself the check that the marks describe the image rather than an
// expectation of it — and it is the direction our own key throws (azimuth -31 deg).
//
// `kind: "null"` rows are OPEN FLOOR WITH NOTHING ON IT. They are the known-bad
// input: the identical code path over nothing must return nothing.
export function printRows(rows, title) {
  console.log(`\n${title}`);
  console.log('plate  who            kind   shadeCore  oppCore  centred  shFrac  oppFrac   floorL  fSpread   band%');
  for (const r of rows) {
    console.log(
      `${(r.plate ?? 'ours').padEnd(6)} ${(r.name ?? '').padEnd(14)} ${(r.kind ?? 'char').padEnd(6)} ` +
      `${r.shadeCoreDL.toFixed(4).padStart(9)} ${r.oppCoreDL.toFixed(4).padStart(8)} ` +
      `${String(r.centredFrac).padStart(7)} ${String(r.shadeCoreFrac).padStart(7)} ${String(r.oppCoreFrac).padStart(7)} ` +
      `${r.floorL.toFixed(4).padStart(8)} ${r.floorSpread.toFixed(4).padStart(8)} ${String(r.bandFrac).padStart(7)}`
    );
  }
  const chars = rows.filter((r) => (r.kind ?? 'char') !== 'null');
  const nulls = rows.filter((r) => r.kind === 'null');
  const med = (a, k) => { const v = a.map((r) => r[k]).filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
  const absMax = (a, k) => (a.length ? Math.max(...a.map((r) => Math.abs(r[k]))) : NaN);
  if (chars.length) {
    console.log(`\n  CHARACTERS n=${chars.length}   median shadeCoreDL ${med(chars, 'shadeCoreDL').toFixed(4)}   oppCoreDL ${med(chars, 'oppCoreDL').toFixed(4)}   centredFrac ${String(med(chars, 'centredFrac'))}`);
    console.log(`               range shadeCoreDL ${Math.min(...chars.map((r) => r.shadeCoreDL)).toFixed(4)}..${Math.max(...chars.map((r) => r.shadeCoreDL)).toFixed(4)}`);
  }
  if (nulls.length) {
    console.log(`  NULL SITES n=${nulls.length}   |shadeCoreDL| max ${absMax(nulls, 'shadeCoreDL').toFixed(4)}   |oppCoreDL| max ${absMax(nulls, 'oppCoreDL').toFixed(4)}`);
    console.log(`  => RESOLUTION FLOOR of this instrument on this material: ${Math.max(absMax(nulls, 'shadeCoreDL'), absMax(nulls, 'oppCoreDL')).toFixed(4)}`);
  }
}

if (has('ref')) {
  const sharp = (await import('sharp')).default;
  const { writeFile, mkdir } = await import('node:fs/promises');
  const SPEC = JSON.parse(await readFile(new URL('./cs_marks.json', import.meta.url), 'utf8'));
  const rows = [];
  const cache = new Map();
  for (const m of SPEC.marks) {
    if (m.skip) continue;
    const f = `reference/images/curated/gameplay_topdown/${m.plate}.png`;
    if (!cache.has(f)) cache.set(f, await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
    const { data, info } = cache.get(f);
    const floorRect = SPEC.floorRects[m.plate];
    if (!floorRect) throw new Error(`no floorRect for ${m.plate} — a mark without a floor level is not a measurement`);
    rows.push({ ...m, ...measure(data, info.width, info.height, m, m.shadowDeg, { floorRect }), W: info.width, H: info.height });
  }
  printRows(rows, 'REFERENCE — gameplay_topdown plates');
  await mkdir('shots/contact', { recursive: true });
  await writeFile('shots/contact/ref.json', JSON.stringify(rows, null, 1));
  process.exit(0);
}

// ── OURS ─────────────────────────────────────────────────────────────────────
// The same `measure()`, on frames from a FROZEN SNAPSHOT. The only thing that
// differs from the reference path is how the footprint ellipse is obtained: there it
// is hand-marked and verified in an overlay, here the page projects a ground circle
// of `CHARACTER_RADIUS` around the character's own world position through the live
// camera. Both describe the same physical thing — the character's ground footprint —
// and every number downstream of it is computed by identical code.
//
// ── THE KNOWN-BAD INPUT, and it is an ABLATION rather than a guess ──────────
// Each frame is rendered TWICE: shipped, and with the cast's own `castShadow` off
// and nothing else moved. The ablated frame is what "no contact shadow at all" reads
// as through this instrument. `shadeCoreDL` must FALL when the shadow is removed; if
// it does not, the instrument is not measuring the shadow. The gap between the two is
// this metric's resolution on our own material, stated before anything is acted on.
if (has('ours')) {
  const { chromium } = await import('playwright');
  const sharp = (await import('sharp')).default;
  const { writeFile, mkdir } = await import('node:fs/promises');
  const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
  const TAG = arg('tag', 'run');
  const OUT = `shots/contact/${TAG}`;
  const PLAYER = arg('player', 'hamburger');
  const ENEMY = arg('enemy', 'donut');
  // ⚠️ RE-AIMED FOR THE ×4 MAP, 2026-08-11 (`6631446` took the arena 1400×1000 →
  // 2800×2000; these defaults did not follow). **`340:500` sat inside a `freezer`.**
  // Coordinates are `tools/arena-scan.mjs`'s current, --selftest-validated stations for
  // the same ids, and `fogRadius` is the shipped `maxSafeRadius` 1985 — the old 993 was
  // the 1× value, which puts a death-zone wall through the frame. `tools/tmp/al_guard.mjs`
  // fails on the old values.
  const STATIONS = arg('stations', '1140:940,2200:500,600:1000').split(',');
  const W = 1600, H = 900;
  await mkdir(OUT, { recursive: true });

  const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

  // Foot ellipses + the screen direction the key throws its shadow, straight off the
  // live scene. `CHARACTER_RADIUS` is 42 wu * 0.05 * 0.5 = 1.05 m (`src/units.ts`).
  const INFO = `(R) => {
    const st = window.__stage, cam = st.rig.camera, scene = st.scene;
    scene.updateMatrixWorld(true);
    const V = cam.position.constructor;
    const toScreen = (x, y, z) => { const v = new V(x, y, z); v.project(cam); return [(v.x * 0.5 + 0.5) * ${W}, (-v.y * 0.5 + 0.5) * ${H}]; };
    const key = st.lighting.key;
    const off = key.position.clone().sub(key.target.position);
    const az = Math.atan2(off.z, off.x);
    // ground shadow direction = -(light's horizontal direction)
    const gx = -Math.cos(az), gz = -Math.sin(az);
    const chars = [];
    const uu = [];
    scene.traverse((o) => { if (o.name && o.name.indexOf('character:') === 0) chars.push(o); });
    const out = [];
    for (const c of chars) {
      const p = new V(); c.getWorldPosition(p);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < 48; i++) {
        const th = (i / 48) * Math.PI * 2;
        const s = toScreen(p.x + R * Math.cos(th), 0, p.z + R * Math.sin(th));
        if (s[0] < x0) x0 = s[0]; if (s[0] > x1) x1 = s[0];
        if (s[1] < y0) y0 = s[1]; if (s[1] > y1) y1 = s[1];
      }
      const a = toScreen(p.x, 0, p.z), b = toScreen(p.x + 3 * gx, 0, p.z + 3 * gz);
      let deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      const meshes = []; c.traverse((o) => { if (o.isMesh) meshes.push(o.uuid); });
      out.push({ name: c.name.slice(10), wx: p.x, wz: p.z,
        cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2,
        shadowDeg: deg, meshes });
    }
    return { chars: out, keyAzDeg: (az * 180) / Math.PI };
  }`;
  const SETCAST = `(uuids, on) => {
    const st = window.__stage, set = new Set(uuids); let n = 0;
    st.scene.traverse((o) => { if (!set.has(o.uuid)) return; if (o.__csCast === undefined) o.__csCast = o.castShadow; o.castShadow = on ? o.__csCast : false; n++; });
    st.markShadowsDirty(); st.renderer.shadowMap.autoUpdate = true;
    return n;
  }`;
  // `Stage.updateContactShadows` re-shows the group every frame, so hiding it once is
  // overwritten before the next capture — the same trap `contactshadow.mjs` documents
  // for `lighting.focus()`. The GROUP's own `visible` is what the walk never touches.
  const SETDECAL = `(on) => {
    const g = window.__stage.scene.getObjectByName('contact:shadows');
    if (!g) return 0;
    if (!g.__csPatched) { g.__csPatched = true; Object.defineProperty(g, 'visible', { get() { return this.__csWant !== false; }, set(v) { if (this.__csForce === undefined) this.__csWant = v; }, configurable: true }); }
    g.__csForce = on ? undefined : false;
    g.__csWant = on;
    return g.children.length;
  }`;

  /**
   * The floor level for OUR frames. Hand-marking a rect on a frame that is
   * regenerated every run is not reproducible, so it is DERIVED: the lowest-spread
   * 120x50 window on a grid, at least `MIN_D` px from every character. Picked ONCE on
   * the shipped frame and reused for the ablated one, so the A/B differs by the
   * ablation and by nothing else.
   */
  // ── THE FLOOR LEVEL FOR OUR FRAMES, DECIDED BY THE ABLATION ──────────────
  // Two candidate sources were A/B'd against the known-bad input by
  // `tools/tmp/cs_floorab.mjs`: on the ABLATED frame the correct source must return
  // coreDL ~ 0, because there is no shadow in that frame to measure.
  //
  //   source                    ablated coreDL, three stations
  //   flattest 120x50 window     0.1711 / 0.4781 / 0.0002     <- REJECTED
  //   the annulus t 2.6-6.0      0.0264 / 0.0930 / 0.0092     <- shipped
  //
  // The window source loses because our floor is a two-tone checkerboard under a
  // vignette: a flat window lands on ONE tile colour at one radius and reports a
  // floor level 0.25 of luma away from the ground the character is actually standing
  // on. The annulus is centred on the character, so it straddles both tiles at the
  // right vignette radius, and its own mode is stable (0.441 / 0.456 / 0.394 against
  // the window's 0.585 / 0.841 / 0.385).
  //
  // The ablation DELTA is identical under both (0.1900 / 0.1604 / 0.1534) — a floor
  // level cancels in a difference. That is why the delta, not the absolute, is the
  // number this tool leads with.
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const rows = [];
  for (const st of STATIONS) {
    const [sx, sy] = st.split(':').map(Number);
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
    await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    await p.goto(`${BASE}/?player=${PLAYER}&enemy=${ENEMY}&px=${sx}&py=${sy}&fogRadius=1985&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
    await p.waitForTimeout(1800);
    const info = await p.evaluate(`(${INFO})(1.05)`);
    if (!info.chars.length) throw new Error('no character:* nodes in the scene — the frame has no subject and every number below would be about nothing');
    const canvas = p.locator('canvas');
    const raw = async () => sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer();

    const shipped = await raw();
    await sharp(await canvas.screenshot()).toFile(`${OUT}/${sx}_${sy}__shipped.png`);

    await p.evaluate(`window.__csCast = ${SETCAST}; window.__csDecal = ${SETDECAL};`);
    const all = info.chars.flatMap((c) => c.meshes);

    // (a) the DECAL alone, isolated: everything shipped except the contact group.
    const nDecal = await p.evaluate(() => window.__csDecal(false));
    await p.waitForTimeout(700);
    const noDecal = await raw();
    await sharp(await canvas.screenshot()).toFile(`${OUT}/${sx}_${sy}__nodecal.png`);

    // (b) NO CONTACT AT ALL — the cast shadow off as well. This is the known-bad.
    await p.evaluate(([u]) => window.__csCast(u, false), [all]);
    await p.waitForTimeout(900);
    const ablated = await raw();
    await sharp(await canvas.screenshot()).toFile(`${OUT}/${sx}_${sy}__ablated.png`);
    await p.evaluate(([u]) => window.__csCast(u, true), [all]);
    await p.evaluate(() => window.__csDecal(true));
    await p.waitForTimeout(400);
    if (nDecal === 0) console.log('  (no contact:shadows group in this build — nodecal == shipped by construction)');

    for (const c of info.chars) {
      const e = { cx: c.cx, cy: c.cy, rx: c.rx, ry: c.ry };
      // A character whose footprint is off the frame contributes NOTHING and used to
      // contribute a row of NaN that then poisoned every median in the summary.
      // The enemy spawns across the map at these stations and is genuinely absent.
      if (e.cx < -e.rx || e.cx > W + e.rx || e.cy < -e.ry || e.cy > H + e.ry) {
        console.log(`  ${c.name} is off-frame at this station (cx ${e.cx.toFixed(0)}) — skipped`);
        continue;
      }
      const shipM = measure(shipped, W, H, e, c.shadowDeg);
      const ablM = measure(ablated, W, H, e, c.shadowDeg);
      const ndM = measure(noDecal, W, H, e, c.shadowDeg);
      rows.push({ plate: `${sx}:${sy}`, name: c.name, kind: 'char', ...shipM,
        ablShadeCoreDL: ablM.shadeCoreDL, ablOppCoreDL: ablM.oppCoreDL,
        deltaShade: +(shipM.shadeCoreDL - ablM.shadeCoreDL).toFixed(4),
        deltaOpp: +(shipM.oppCoreDL - ablM.oppCoreDL).toFixed(4),
        // The ablation-corrected FRACTION — the shadow's own contribution as a share
        // of the floor it falls on. This is the column that compares to the plates.
        deltaShadeFrac: +((shipM.shadeCoreDL - ablM.shadeCoreDL) / shipM.floorL).toFixed(3),
        deltaOppFrac: +((shipM.oppCoreDL - ablM.oppCoreDL) / shipM.floorL).toFixed(3),
        // The DECAL's own contribution, isolated from the cast shadow. Zero by
        // construction on a build with no contact group.
        decalShadeFrac: +((shipM.shadeCoreDL - ndM.shadeCoreDL) / shipM.floorL).toFixed(3),
        decalOppFrac: +((shipM.oppCoreDL - ndM.oppCoreDL) / shipM.floorL).toFixed(3),
        ellipse: e, shadowDeg: +c.shadowDeg.toFixed(1) });
      // the ABLATED frame, measured as its own row: this is the known-bad input.
      rows.push({ plate: `${sx}:${sy}`, name: `${c.name}~ablated`, kind: 'null', ...ablM, ellipse: e, shadowDeg: +c.shadowDeg.toFixed(1) });
    }
    console.log(`  station ${st}: chars ${info.chars.map((c) => c.name).join('+')}  shadowDeg ${info.chars[0].shadowDeg.toFixed(1)}  keyAz ${info.keyAzDeg.toFixed(1)}`);
    await p.close();
  }
  await b.close();
  printRows(rows, `OURS — ${TAG}`);
  const chars = rows.filter((r) => r.kind === 'char');
  console.log('\n  ABLATION (the known-bad): shipped minus cast-shadow-off, same frame, same ellipse, same floor rect');
  console.log('  station    who               shipped   ablated    delta   TOTALshadeFrac  TOTALoppFrac   decalShadeFrac  decalOppFrac');
  for (const r of chars) console.log(`  ${r.plate.padEnd(10)} ${r.name.padEnd(16)} ${r.shadeCoreDL.toFixed(4).padStart(8)} ${r.ablShadeCoreDL.toFixed(4).padStart(9)} ${r.deltaShade.toFixed(4).padStart(8)} ${String(r.deltaShadeFrac).padStart(15)} ${String(r.deltaOppFrac).padStart(13)} ${String(r.decalShadeFrac).padStart(16)} ${String(r.decalOppFrac).padStart(13)}`);
  console.log('\n  REFERENCE BAND (bs_06 vent props, the only reference subjects with no UI decal over them):');
  console.log('    shade fraction 0.192 / 0.269 / 0.324      OPPOSITE fraction 0.198 / 0.061 / 0.087');
  const d = chars.map((r) => r.deltaShade);
  console.log(`\n  median delta ${d.slice().sort((a, c) => a - c)[Math.floor(d.length / 2)].toFixed(4)}   max ${Math.max(...d).toFixed(4)}`);
  await writeFile(`${OUT}/ours.json`, JSON.stringify(rows, null, 1));
  console.log(`\nwrote ${OUT}/ours.json`);
  process.exit(0);
}
