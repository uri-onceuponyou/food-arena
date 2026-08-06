#!/usr/bin/env node
/**
 * cam_ellipse — RECOVER A CAMERA'S PITCH FROM A CIRCLE THAT LIES ON THE GROUND.
 *
 * ─── 🚨 SCRUB RULE, inherited verbatim from `tools/tmp/pp_ref_parts.mjs` ─────────
 * This repo is PUBLIC and `CLAUDE.md`'s permanent security constraint says
 * `reference/images/` must never be committed OR PUBLISHED. A prose description
 * derived from viewing a plate is still derived from it.
 *
 *   DESCRIBE THE COMPOSITIONAL ROLE, NEVER THE THIRD-PARTY ARTWORK.
 *   "the circular ground marker under the left-hand figure" — yes.
 *   Naming what it depicts, whose it is, or what the scene shows — no.
 *
 * Crop COORDINATES and measured NUMBERS stay: they are numbers, they are needed for
 * reproducibility, and they disclose nothing.
 *
 * ─── WHY THIS MEASUREMENT AND NOT A CHARACTER MEASUREMENT ───────────────────────
 * A camera's pitch is not directly recoverable from a screenshot in general. But a
 * CIRCLE that lies in a horizontal plane is: it images as an ellipse whose
 *
 *     minorAxis / majorAxis = sin(pitch)
 *
 * exactly under an orthographic camera, and to within the perspective error measured
 * by `--selftest`/the calibration renders under a narrow-FOV perspective one. This is
 * the only statistic in this probe that is SEMANTIC-FREE — it needs no knowledge of
 * what the artwork depicts, no rig, and no 3D reasoning. It is therefore the primary
 * instrument, and every character-presentation number is secondary to it.
 *
 * Both sides supply such circles: ground status/selection rings under figures, and
 * the top face of any upright cylinder prop (a circle in a horizontal plane at
 * height h — the RATIO is independent of h under orthography).
 *
 * ─── HOW A REGION IS ISOLATED ───────────────────────────────────────────────────
 * Flood fill from a seed pixel, 4-connected, inside a caller-supplied box, with an
 * RGB tolerance. Nothing here is automatic: the seed and the box are read off a
 * zoomed crop by eye, exactly as `pp_ref_parts.mjs` reads its part boxes, and for the
 * same reason — there is no rig to interrogate on a screenshot. The tool's job is to
 * make that choice AUDITABLE, which is what `--out` is for: it writes the mask
 * boundary over the crop so the segmentation can be judged as pixels rather than
 * trusted as a number.
 *
 * ⚠️ THREE ESTIMATORS ARE REPORTED AND THEY MUST AGREE.
 *   bbox   — (maxY-minY+1)/(maxX-minX+1). Correct for a filled ellipse with a
 *            horizontal major axis; destroyed by occlusion.
 *   moment — sqrt of the ratio of the pixel-covariance eigenvalues.
 *            Orientation-independent, degrades gracefully under SYMMETRIC occlusion,
 *            and reports the major-axis TILT, which is the segmentation's own alarm:
 *            a ground circle under a camera with no roll must come back near 0 deg,
 *            and a large tilt means the fill leaked.
 *   conic  — a trimmed least-squares fit of a general conic to the mask BOUNDARY.
 *            **This is the one that matters on a real plate**, because every ground
 *            marker worth measuring on either side is partly covered by the figure
 *            standing on it, and an ASYMMETRIC occlusion biases both of the others.
 *            A conic fit only needs an ARC. The overlay draws the fitted ellipse back
 *            over the crop in cyan, so the fit is judged as pixels, not trusted.
 *
 * If the three disagree by more than a few degrees, the segmentation is wrong. That
 * disagreement is the instrument's built-in known-bad detector.
 *
 * ─── ANNULUS MODE — AND A PREDICTION THIS TOOL'S OWN SELFTEST FALSIFIED ──────────
 * Ground rings are usually ANNULI (a stroke, not a disc). The `--ring` flag was added
 * on the reasoning that the moment estimator of an annulus differs from that of a
 * disc: for a thin ring the covariance eigenvalues are a^2/2 and b^2/2 rather than
 * a^2/4 and b^2/4, so the semi-axis needs a sqrt(2) factor instead of a 2.
 *
 * **That is true of the AXES and irrelevant to the ANGLE.** The pitch comes from the
 * RATIO minor/major = sqrt(l2/l1), and the constant cancels exactly. The selftest
 * assertion written to prove the disc form FAILS on an annulus failed instead — 3 of
 * 3, at 20/40/58 deg, agreeing to 0.2 deg. The old assertion is kept below with this
 * reason (`CLAUDE.md`: change it and keep the old wording above it), because it
 * records a real property: **the angle is form-independent, so no ring/disc judgement
 * has to be made about a marker on a plate whose construction we cannot inspect.**
 * `--ring` therefore only affects the reported absolute axis lengths.
 *
 * USAGE
 *   node tools/tmp/cam_ellipse.mjs --selftest
 *   node tools/tmp/cam_ellipse.mjs --img <png> --box x0,y0,x1,y1 --seed x,y [--tol 40]
 *        [--ring] [--out shots/camangle/foo.png] [--label name]
 *   node tools/tmp/cam_ellipse.mjs --img <png> --box x0,y0,x1,y1 --zoom   # just look
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const nums = (s) => s.split(',').map(Number);

// ── image plumbing ───────────────────────────────────────────────────────────
async function loadRGBA(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
async function writeRGBA(path, img) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } })
    .png().toFile(path);
}

/**
 * 4-connected flood fill from `seed`, confined to `box`, accepting any pixel within
 * `tol` (sum of absolute RGB differences) of the SEED colour.
 *
 * Deliberately seed-relative and not gradient-following: these are flat-shaded
 * vector-ish renders on both sides, and a gradient-following fill leaks across the
 * soft terminator of a shaded prop. A leak is visible in `--out` and shows up as a
 * moment/bbox disagreement, so it cannot pass silently.
 */
function floodFill(img, box, seed, tol) {
  const { data, width: W } = img;
  const [x0, y0, x1, y1] = box;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const mask = new Uint8Array(bw * bh);
  const si = (seed[1] * W + seed[0]) * 4;
  const sr = data[si], sg = data[si + 1], sb = data[si + 2];
  const stack = [[seed[0], seed[1]]];
  const idx = (x, y) => (y - y0) * bw + (x - x0);
  if (seed[0] < x0 || seed[0] > x1 || seed[1] < y0 || seed[1] > y1) throw new Error('seed outside box');
  mask[idx(seed[0], seed[1])] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const m = idx(nx, ny);
      if (mask[m]) continue;
      const i = (ny * W + nx) * 4;
      const d = Math.abs(data[i] - sr) + Math.abs(data[i + 1] - sg) + Math.abs(data[i + 2] - sb);
      if (d <= tol) { mask[m] = 1; stack.push([nx, ny]); }
    }
  }
  return { mask, bw, bh, x0, y0, seedRGB: [sr, sg, sb] };
}

/** Extents + second moments of a binary mask. */
export function maskStats(mask, bw, bh, ring = false) {
  let n = 0, sx = 0, sy = 0, minX = bw, maxX = -1, minY = bh, maxY = -1;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!mask[y * bw + x]) continue;
    n++; sx += x; sy += y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!n) return null;
  const cx = sx / n, cy = sy / n;
  let mxx = 0, myy = 0, mxy = 0;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!mask[y * bw + x]) continue;
    const dx = x - cx, dy = y - cy;
    mxx += dx * dx; myy += dy * dy; mxy += dx * dy;
  }
  mxx /= n; myy /= n; mxy /= n;
  // Eigen-decomposition of the 2x2 symmetric covariance.
  const tr = mxx + myy, det = mxx * myy - mxy * mxy;
  const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  // Filled ellipse: semi-axis = 2*sqrt(lambda). Thin annulus: semi-axis = sqrt(2*lambda).
  const k = ring ? Math.SQRT2 : 2;
  const a = k * Math.sqrt(l1), b = k * Math.sqrt(l2);
  // Orientation of the MAJOR axis, degrees from image-horizontal, +ve = counterclockwise
  // in image coordinates (y down), so a ground circle under an unrolled camera is ~0.
  const theta = 0.5 * Math.atan2(2 * mxy, mxx - myy) * 180 / Math.PI;
  return {
    n, cx, cy, bboxW: maxX - minX + 1, bboxH: maxY - minY + 1,
    minX, maxX, minY, maxY,
    momA: a, momB: b, tiltDeg: theta,
  };
}

const asinDeg = (r) => (r >= 1 ? 90 : r <= 0 ? 0 : Math.asin(r) * 180 / Math.PI);

// ── conic fit ────────────────────────────────────────────────────────────────
/** Jacobi eigen-decomposition of a symmetric n x n matrix. Returns {values, vectors}. */
function jacobiEigen(Ain, n, iters = 100) {
  const A = Ain.map((r) => r.slice());
  let V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < iters; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-18) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: A.map((r, i) => r[i]), vectors: V };
}

/**
 * Least-squares general conic through `pts`, with iterative trimming.
 *
 * ⚠️ The trimming is not a nicety. Every ground marker on a real plate is partly
 * covered by the figure standing on it, and the mask boundary therefore contains a
 * long arc of OCCLUSION boundary that does not lie on the conic. An untrimmed fit is
 * dragged by it. Three rounds dropping the worst 25% of |algebraic residual| removes
 * the occluder edge while keeping the marker's own arc, and the overlay proves it.
 *
 * Points are centred and scaled (Hartley normalisation) before fitting — without it
 * the design matrix is catastrophically ill-conditioned at plate coordinates.
 */
function fitConic(pts, trimRounds = 3, keepFrac = 0.75) {
  let use = pts.slice();
  let best = null;
  for (let round = 0; round <= trimRounds; round++) {
    if (use.length < 12) break;
    let mx = 0, my = 0;
    for (const p of use) { mx += p[0]; my += p[1]; }
    mx /= use.length; my /= use.length;
    let sc = 0;
    for (const p of use) sc += Math.hypot(p[0] - mx, p[1] - my);
    sc = sc / use.length || 1;
    const S = Array.from({ length: 6 }, () => new Array(6).fill(0));
    const rowsOf = (p) => {
      const x = (p[0] - mx) / sc, y = (p[1] - my) / sc;
      return [x * x, x * y, y * y, x, y, 1];
    };
    for (const p of use) {
      const r = rowsOf(p);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) S[i][j] += r[i] * r[j];
    }
    const { values, vectors } = jacobiEigen(S, 6);
    let k = 0; for (let i = 1; i < 6; i++) if (values[i] < values[k]) k = i;
    const v = vectors.map((row) => row[k]);
    // Un-normalise: x = (X - mx)/sc  =>  substitute back into the conic.
    const [A, B, C, D, E, F] = v;
    const a = A / (sc * sc);
    const b = B / (sc * sc);
    const c = C / (sc * sc);
    const d = (-2 * A * mx - B * my) / (sc * sc) + D / sc;
    const e = (-2 * C * my - B * mx) / (sc * sc) + E / sc;
    const f = (A * mx * mx + B * mx * my + C * my * my) / (sc * sc) - (D * mx + E * my) / sc + F;
    best = { a, b, c, d, e, f, n: use.length };
    if (round === trimRounds) break;
    const res = use.map((p) => {
      const [x, y] = p;
      return { p, r: Math.abs(a * x * x + b * x * y + c * y * y + d * x + e * y + f) };
    }).sort((u, w) => u.r - w.r);
    use = res.slice(0, Math.max(12, Math.round(res.length * keepFrac))).map((o) => o.p);
  }
  if (!best) return null;
  const { a, b, c, d, e, f } = best;
  const disc = b * b - 4 * a * c;
  if (disc >= 0) return { ...best, isEllipse: false };
  // Centre.
  const cx = (2 * c * d - b * e) / disc * -1 / 1; // solve [2a b; b 2c][x;y] = [-d;-e]
  const det = 4 * a * c - b * b;
  const x0 = (b * e - 2 * c * d) / det;
  const y0 = (b * d - 2 * a * e) / det;
  void cx;
  const f0 = a * x0 * x0 + b * x0 * y0 + c * y0 * y0 + d * x0 + e * y0 + f;
  const { values: ev, vectors: evec } = jacobiEigen([[a, b / 2], [b / 2, c]], 2);
  const l1 = ev[0], l2 = ev[1];
  const ax1 = Math.sqrt(Math.abs(-f0 / l1)), ax2 = Math.sqrt(Math.abs(-f0 / l2));
  const major = Math.max(ax1, ax2), minor = Math.min(ax1, ax2);
  // Orientation of the MAJOR axis (the eigenvector with the smaller |lambda|).
  const majIdx = ax1 >= ax2 ? 0 : 1;
  const tilt = Math.atan2(evec[1][majIdx], evec[0][majIdx]) * 180 / Math.PI;
  return {
    ...best, isEllipse: true, x0, y0, major, minor,
    ratio: minor / major,
    tiltDeg: ((tilt + 90) % 180) - 90,
  };
}

/**
 * COLOUR-PREDICATE segmentation: select every pixel in the box within `tol` of ANY of
 * the listed colours, then keep the largest 8-connected component.
 *
 * ⚠️ Flood fill cannot reach a STRIPED target. The best ground circle our own build
 * offers is a hazard stripe ring — alternating bands — and a flood fill seeded on one
 * band stops at the next. That is not a defect of the target; a striped or dashed
 * ground marker is common on both sides. So the tool needs a mode whose connectivity
 * requirement is applied AFTER colour selection rather than during it.
 *
 * The cost is stated: a predicate is global inside the box, so it will also pick up
 * any unrelated pixel of that colour. That is what the largest-component step and the
 * `--out` overlay are for.
 */
function pickColours(img, box, colours, tol, pred = null, keepAll = false) {
  const { data, width: W } = img;
  const [x0, y0, x1, y1] = box;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const sel = new Uint8Array(bw * bh);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * W + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (pred) { if (pred(r, g, b)) sel[(y - y0) * bw + (x - x0)] = 1; continue; }
    for (const c of colours) {
      if (Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) <= tol) {
        sel[(y - y0) * bw + (x - x0)] = 1; break;
      }
    }
  }
  // Largest 8-connected component.
  const lab = new Int32Array(bw * bh).fill(-1);
  let best = -1, bestN = 0, next = 0;
  for (let s = 0; s < bw * bh; s++) {
    if (!sel[s] || lab[s] >= 0) continue;
    const id = next++;
    let n = 0;
    const st = [s];
    lab[s] = id;
    while (st.length) {
      const p = st.pop(); n++;
      const px = p % bw, py = (p / bw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx, qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= bw || qy >= bh) continue;
        const q = qy * bw + qx;
        if (!sel[q] || lab[q] >= 0) continue;
        lab[q] = id; st.push(q);
      }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  const mask = new Uint8Array(bw * bh);
  // ⚠️ `keepAll` is needed for a BROKEN or DASHED ring — a very common ground-marker
  // form on both sides. Its arcs are separate components, so the largest-component
  // step would fit ONE arc and report a wild tilt. With `keepAll` the arcs are kept
  // together and `outerPts` reduces them to the ring's outer edge in exactly the
  // directions where an arc exists, which is the partial-arc case the conic fit is
  // for. The cost: nothing else of that colour may be inside the box.
  for (let s = 0; s < bw * bh; s++) if (keepAll ? sel[s] : lab[s] === best) mask[s] = 1;
  return { mask, bw, bh, x0, y0, seedRGB: colours[0], components: next };
}

/**
 * Fill interior holes: flood the COMPLEMENT inward from the box border; anything the
 * flood never reaches is enclosed by the mask and is set.
 *
 * ⚠️ **This is belt-and-braces, and saying so is the point.** It was added believing
 * interior contours were dragging a real fit, and the selftest says otherwise: on an
 * off-centre interior hole the unfilled fit returns 44.86 against the filled fit's
 * 44.87, because off-centre points are precisely the ones `fitConic`'s trimming
 * already rejects. It stays because it costs nothing and closes the concentric case
 * the trimming genuinely cannot see — but **it is not what rescues a bad target.**
 *
 * What rescues a bad target is picking a different one. A SOFT-EDGED marker has no
 * boundary for a threshold to find: the first plate target tried here was a graded
 * ground glow, and the fill's edge moved with tolerance while the major-axis TILT sat
 * at -14 to -20 deg on a marker whose true tilt must be ~0. That tilt is the alarm.
 * Hard-edged, flat-filled, geometric targets only.
 */
function fillHoles(mask, bw, bh) {
  const outside = new Uint8Array(bw * bh);
  const stack = [];
  for (let x = 0; x < bw; x++) { stack.push([x, 0]); stack.push([x, bh - 1]); }
  for (let y = 0; y < bh; y++) { stack.push([0, y]); stack.push([bw - 1, y]); }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
    const i = y * bw + x;
    if (outside[i] || mask[i]) continue;
    outside[i] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const out = new Uint8Array(bw * bh);
  for (let i = 0; i < bw * bh; i++) out[i] = mask[i] || !outside[i] ? 1 : 0;
  return out;
}

/**
 * Boundary pixels of a binary mask, in BOX-local coordinates.
 *
 * `exclude` is a list of box-local rectangles whose boundary contribution is dropped.
 *
 * ⚠️ THE CASE THIS EXISTS FOR, and it is the same case on both sides. A ground marker
 * has something STANDING on it — a prop here, a figure on a plate — and the occluder's
 * own silhouette is a long, smooth, low-residual arc that `fitConic`'s trimming keeps.
 * At our 40 deg calibration render the pot hid the far third of the ring and the fit
 * came back 33.1 against a true 40.0, with bbox 36.4 and moment 29.0 — three estimators
 * spread over 7 degrees, which is the alarm rather than the answer. Excluding the
 * occluder's rectangle leaves a genuine PARTIAL ARC, which is precisely what a conic
 * fit is for and what `--selftest`'s "occluded ring" rows prove it handles.
 *
 * The exclusion is a stated, auditable input, not an automatic guess: it appears in
 * the JSON, and the overlay draws the fitted ellipse so the result can be judged as
 * pixels.
 */
function boundaryPts(mask, bw, bh, exclude = []) {
  const on = (x, y) => (x < 0 || y < 0 || x >= bw || y >= bh) ? 0 : mask[y * bw + x];
  const inEx = (x, y) => exclude.some((r) => x >= r[0] - 2 && x <= r[2] + 2 && y >= r[1] - 2 && y <= r[3] + 2);
  const pts = [];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!on(x, y)) continue;
    if (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
    // Boundary pixels that sit ON the crop edge are the BOX cutting the shape, not
    // the shape's own outline. They lie on a straight line and would drag the fit.
    if (x === 0 || y === 0 || x === bw - 1 || y === bh - 1) continue;
    if (inEx(x, y)) continue;
    pts.push([x, y]);
  }
  return pts;
}

/**
 * Keep only the OUTERMOST boundary point in each of `bins` angular directions about
 * the point set's centroid.
 *
 * ⚠️ Why this beats trimming alone. `fitConic` rejects points with large algebraic
 * residual, which handles an occluder's silhouette when that silhouette is far from
 * the conic. It does NOT handle an interior contour that is CLOSE to the conic — a
 * soft glow's inner edge, a cast shadow's boundary, the inner rim of an annulus — and
 * those are systematically biased INWARD, so keeping them shrinks the fit. On our own
 * 40 deg calibration render that shrinkage read 30.9 against a true 40.0 while the
 * three estimators disagreed by 7 degrees.
 *
 * A ground marker's outer silhouette is single-valued in angle about its centre, so
 * "farthest per direction" is exactly the right selector and it needs no threshold.
 * Directions with no surviving point (because the occluder's rectangle was excluded)
 * simply contribute nothing, which is the partial-arc case the selftest covers.
 */
function outerPts(pts, bins = 360) {
  if (!pts.length) return pts;
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  const best = new Array(bins).fill(null);
  const bestR = new Array(bins).fill(-1);
  for (const p of pts) {
    const dx = p[0] - cx, dy = p[1] - cy;
    const r = Math.hypot(dx, dy);
    let k = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * bins);
    if (k >= bins) k = bins - 1;
    if (r > bestR[k]) { bestR[k] = r; best[k] = p; }
  }
  return best.filter(Boolean);
}

// ── selftest ─────────────────────────────────────────────────────────────────
/**
 * Synthetic ellipses of KNOWN ratio, rasterised at plate-like sizes, plus the
 * deliberately-wrong cases that must FAIL. A guard that has not been shown to fail on
 * the bug it guards against is not a guard (`CLAUDE.md` #6).
 */
function rasterEllipse(w, h, a, b, ring, tiltDeg = 0) {
  const mask = new Uint8Array(w * h);
  const cx = w / 2, cy = h / 2;
  const t = tiltDeg * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy;
    const u = dx * ct + dy * st, v = -dx * st + dy * ct;
    const r = (u * u) / (a * a) + (v * v) / (b * b);
    if (ring ? (r <= 1 && r >= 0.90) : r <= 1) mask[y * w + x] = 1;
  }
  return mask;
}

function selftest() {
  let pass = 0, fail = 0;
  const chk = (name, ok, detail) => {
    (ok ? pass++ : fail++);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  // 1) MOVES: a filled ellipse of known ratio recovers its pitch, across the range.
  //
  // ⚠️ OLD WORDING, kept because it records a real limit that was discovered by it
  // failing: this loop used to include 85 deg and assert the BBOX estimator to
  // <1.0 deg there too. It returned 82.61. That is not a bug — near 90 deg the ratio
  // is ~1 and d(angle)/d(ratio) diverges, so one pixel of rasterisation is worth
  // ~3 deg. **The bbox estimator is unusable above ~70 deg**, which is outside the
  // 20-58 band this probe operates in and is therefore recorded, not fixed.
  for (const deg of [10, 20, 22, 30, 40, 45, 58, 70]) {
    const ratio = Math.sin(deg * Math.PI / 180);
    const a = 120, b = a * ratio;
    const m = rasterEllipse(340, 340, a, b, false);
    const s = maskStats(m, 340, 340, false);
    const gotMom = asinDeg(s.momB / s.momA);
    const gotBox = asinDeg(s.bboxH / s.bboxW);
    const cf = fitConic(boundaryPts(m, 340, 340));
    chk(`filled ellipse @ ${deg}deg -> moment ${gotMom.toFixed(2)}`, Math.abs(gotMom - deg) < 1.0,
      `bbox ${gotBox.toFixed(2)}`);
    chk(`filled ellipse @ ${deg}deg -> bbox ${gotBox.toFixed(2)}`, Math.abs(gotBox - deg) < 1.0);
    chk(`filled ellipse @ ${deg}deg -> conic ${asinDeg(cf.ratio).toFixed(2)}`,
      cf.isEllipse && Math.abs(asinDeg(cf.ratio) - deg) < 1.0);
  }
  {
    const m = rasterEllipse(340, 340, 120, 120 * Math.sin(85 * Math.PI / 180), false);
    const s = maskStats(m, 340, 340, false);
    chk(`bbox is UNUSABLE at 85deg (${asinDeg(s.bboxH / s.bboxW).toFixed(2)}) — recorded, not fixed`,
      Math.abs(asinDeg(s.bboxH / s.bboxW) - 85) > 1.0);
  }

  // 2) The ANNULUS question — and the assertion that FAILED and was worth more than
  //    the ones that passed.
  //
  // ⚠️ OLD WORDING, kept verbatim per CLAUDE.md: this block used to assert
  //      "annulus @ Ndeg WITHOUT --ring is WRONG"
  //    on the reasoning that a thin ring's covariance eigenvalues are a^2/2 rather
  //    than a^2/4, so the disc form would mis-scale it. It failed 3 of 3 (20/40/58
  //    deg, agreeing to <=0.2 deg) because **the constant cancels in the RATIO**, and
  //    the ratio is the only thing the angle depends on. The corrected assertion is
  //    the OPPOSITE and is more valuable: the angle is form-independent, so nothing
  //    has to be assumed about how a marker on a third-party plate was constructed.
  for (const deg of [20, 40, 58]) {
    const ratio = Math.sin(deg * Math.PI / 180);
    const a = 120, b = a * ratio;
    const m = rasterEllipse(340, 340, a, b, true);
    const s = maskStats(m, 340, 340, true);
    const sDisc = maskStats(m, 340, 340, false);
    const gotRing = asinDeg(s.momB / s.momA);
    const gotDisc = asinDeg(sDisc.momB / sDisc.momA);
    chk(`annulus @ ${deg}deg with --ring -> ${gotRing.toFixed(2)}`, Math.abs(gotRing - deg) < 1.5);
    chk(`annulus @ ${deg}deg: ring/disc forms AGREE (${Math.abs(gotRing - gotDisc).toFixed(3)}deg) — the angle is form-independent`,
      Math.abs(gotRing - gotDisc) < 0.01);
    chk(`annulus @ ${deg}deg bbox is form-independent`, Math.abs(asinDeg(s.bboxH / s.bboxW) - deg) < 1.0);
  }

  // 2b) THE CASE THE INSTRUMENT EXISTS FOR: an ASYMMETRICALLY occluded ground marker.
  //     A figure standing on its own ring covers the far arc. bbox and moments are
  //     both biased by it; the trimmed conic fit is not. This is the row that decides
  //     which number to believe on a plate.
  for (const deg of [22, 40, 58]) {
    const r = Math.sin(deg * Math.PI / 180);
    const w = 400, h = 400;
    const m = rasterEllipse(w, h, 130, 130 * r, true);
    // Occlude a figure-shaped bite out of the upper-centre — the far arc plus a slab.
    for (let y = 0; y < h * 0.52; y++) for (let x = w * 0.30; x < w * 0.62; x++) m[y * w + (x | 0)] = 0;
    const s = maskStats(m, w, h, true);
    const cf = fitConic(boundaryPts(m, w, h));
    const gotMom = asinDeg(s.momB / s.momA);
    const gotConic = cf.isEllipse ? asinDeg(cf.ratio) : NaN;
    chk(`occluded ring @ ${deg}deg: conic ${gotConic.toFixed(2)}`, Math.abs(gotConic - deg) < 2.0);
    chk(`occluded ring @ ${deg}deg: moment ${gotMom.toFixed(2)} is BIASED — known-bad estimator here`,
      Math.abs(gotMom - deg) > 2.0);
  }

  // 2c) HOLE FILLING, and the known-bad it exists for. An annulus's INNER contour is
  //     concentric with and similar to its outer one, so its residuals under a fit to
  //     the outer conic are SMALL — the trimming in `fitConic` cannot reject it. Fill
  //     the hole and the fit is clean; leave it and the fit is dragged.
  for (const deg of [22, 45, 58]) {
    const r = Math.sin(deg * Math.PI / 180);
    const w = 360, h = 360;
    const m = rasterEllipse(w, h, 120, 120 * r, true); // an annulus: one big hole
    const filled = fillHoles(m, w, h);
    const cfFilled = fitConic(boundaryPts(filled, w, h));
    const cfRaw = fitConic(boundaryPts(m, w, h));
    chk(`hole-filled annulus @ ${deg}deg -> conic ${asinDeg(cfFilled.ratio).toFixed(2)}`,
      cfFilled.isEllipse && Math.abs(asinDeg(cfFilled.ratio) - deg) < 1.5);
    // Record what the raw fit does rather than asserting it must be wrong: on a
    // PERFECT concentric annulus the inner contour is similar, so the raw fit can be
    // right by symmetry. It is on a REAL target — where the inner structure is not
    // concentric — that it fails, which is the bs_04 case in the header note.
    chk(`raw (unfilled) annulus @ ${deg}deg conic = ${cfRaw && cfRaw.isEllipse ? asinDeg(cfRaw.ratio).toFixed(2) : 'n/a'} (recorded)`, true);
  }
  {
    // The REAL known-bad: an inner contour that is NOT concentric — a gradient core
    // pushed off-centre, which is what a shaded ground marker actually looks like.
    const deg = 45, r = Math.sin(deg * Math.PI / 180), w = 360, h = 360;
    const outer = rasterEllipse(w, h, 120, 120 * r, false);
    // punch an off-centre hole
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - (w / 2 - 25), dy = y - (h / 2 + 8);
      if ((dx * dx) / (70 * 70) + (dy * dy) / (30 * 30) <= 1) outer[y * w + x] = 0;
    }
    const cfRaw = fitConic(boundaryPts(outer, w, h));
    const cfFill = fitConic(boundaryPts(fillHoles(outer, w, h), w, h));
    chk(`off-centre hole: filled ${asinDeg(cfFill.ratio).toFixed(2)} is right`, Math.abs(asinDeg(cfFill.ratio) - deg) < 1.5);
    // ⚠️ OLD WORDING, kept per CLAUDE.md — this asserted the UNFILLED fit must be
    // WRONG by >2 deg. It returned 44.86 against the filled fit's 44.87. **The
    // trimming already rejects an off-centre interior contour**, because being
    // off-centre is exactly what gives those points large algebraic residuals. So
    // hole-filling is belt-and-braces here, not the load-bearing step I claimed, and
    // the second thing this probe's own selftest falsified about it. What the row
    // now records is the SIZE of the effect, which is the honest content.
    chk(`off-centre hole: unfilled ${cfRaw.isEllipse ? asinDeg(cfRaw.ratio).toFixed(2) : 'not-an-ellipse'} vs filled ${asinDeg(cfFill.ratio).toFixed(2)} — trimming already handles it (recorded)`, true);
  }

  // 3) KNOWN-BAD: a circle in the IMAGE plane (a HUD disc) is not a ground circle.
  //    It must read ~90deg, i.e. "the camera looks straight down", which is absurd for
  //    any plate here and is the signature of measuring the wrong kind of circle.
  {
    const m = rasterEllipse(340, 340, 110, 110, false);
    const s = maskStats(m, 340, 340, false);
    const got = asinDeg(s.momB / s.momA);
    chk(`screen-space circle reads ~90 (${got.toFixed(2)}) — known-bad input`, got > 87);
  }

  // 4) KNOWN-BAD: a TILTED ellipse (fill leaked into a neighbour, or the "circle" is
  //    not in the ground plane) must be caught by the tilt alarm, and its bbox and
  //    moment estimators must DISAGREE.
  {
    const deg = 30;
    const ratio = Math.sin(deg * Math.PI / 180);
    const m = rasterEllipse(400, 400, 130, 130 * ratio, false, 25);
    const s = maskStats(m, 400, 400, false);
    const gotMom = asinDeg(s.momB / s.momA);
    const gotBox = asinDeg(s.bboxH / s.bboxW);
    chk(`tilted ellipse trips the tilt alarm (${s.tiltDeg.toFixed(1)}deg)`, Math.abs(s.tiltDeg) > 8);
    chk(`tilted ellipse: bbox ${gotBox.toFixed(2)} disagrees with moment ${gotMom.toFixed(2)}`,
      Math.abs(gotBox - gotMom) > 3);
  }

  // 5) KNOWN-BAD: a SQUARE is not an ellipse. Its moment ratio is 1.0 like a circle,
  //    which is exactly why the tool must never be pointed at an arbitrary blob — this
  //    row exists to record that the moment ratio alone cannot tell circle from square,
  //    and that is what `--out` is for.
  {
    const m = new Uint8Array(200 * 200);
    for (let y = 60; y < 140; y++) for (let x = 60; x < 140; x++) m[y * 200 + x] = 1;
    const s = maskStats(m, 200, 200, false);
    chk('square also reads ~90 — moment ratio cannot prove circularity (read --out)',
      asinDeg(s.momB / s.momA) > 87);
  }

  // 6) HOLDS: the statistic is scale-invariant. Plates arrive upscaled 1.33-1.43x and
  //    that must not masquerade as angle (`docs/LESSONS.md` §3).
  {
    const deg = 22;
    const r = Math.sin(deg * Math.PI / 180);
    const small = maskStats(rasterEllipse(200, 200, 60, 60 * r, false), 200, 200, false);
    const big = maskStats(rasterEllipse(280, 280, 60 * 1.4, 60 * 1.4 * r, false), 280, 280, false);
    const d = Math.abs(asinDeg(small.momB / small.momA) - asinDeg(big.momB / big.momA));
    chk(`1.4x upscale moves the angle by ${d.toFixed(2)}deg (<0.5)`, d < 0.5);
  }

  // 7) HOLDS: half the ellipse occluded along its MINOR axis leaves the moment ratio
  //    intact (symmetric loss), while the BBOX collapses. This is the case that decides
  //    which estimator to believe on a partially hidden ground ring.
  {
    const deg = 30;
    const r = Math.sin(deg * Math.PI / 180);
    const w = 340, h = 340;
    const m = rasterEllipse(w, h, 120, 120 * r, false);
    for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) m[y * w + x] = 0; // cut left half
    const s = maskStats(m, w, h, false);
    chk(`half-occluded: bbox ${asinDeg(s.bboxH / s.bboxW).toFixed(1)} is WRONG`,
      Math.abs(asinDeg(s.bboxH / s.bboxW) - deg) > 5);
    chk(`half-occluded: tilt alarm stays quiet (${s.tiltDeg.toFixed(1)})`, Math.abs(s.tiltDeg) < 3);
  }

  console.log(`\ncam_ellipse selftest: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

// ── debug overlay ────────────────────────────────────────────────────────────
async function writeOverlay(outPath, img, box, mask, bw, bh, zoom, conic = null) {
  const [x0, y0, x1, y1] = box;
  const W = (x1 - x0 + 1) * zoom, H = (y1 - y0 + 1) * zoom;
  const out = Buffer.alloc(W * H * 4, 255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = x0 + Math.floor(x / zoom), sy = y0 + Math.floor(y / zoom);
    const si = (sy * img.width + sx) * 4, di = (y * W + x) * 4;
    out[di] = img.data[si]; out[di + 1] = img.data[si + 1]; out[di + 2] = img.data[si + 2]; out[di + 3] = 255;
  }
  // Mask BOUNDARY in magenta, so the fill is judged as pixels and not trusted.
  const on = (x, y) => (x < 0 || y < 0 || x >= bw || y >= bh) ? 0 : mask[y * bw + x];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!on(x, y)) continue;
    if (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
    for (let dy = 0; dy < zoom; dy++) for (let dx = 0; dx < zoom; dx++) {
      const px = x * zoom + dx, py = y * zoom + dy;
      if (px >= W || py >= H) continue;
      const di = (py * W + px) * 4;
      out[di] = 255; out[di + 1] = 0; out[di + 2] = 255;
    }
  }
  // 10-source-pixel grid in dim grey, so coordinates can be read straight off the crop.
  for (let gy = 0; gy < bh; gy += 10) for (let x = 0; x < W; x++) {
    const di = ((gy * zoom) * W + x) * 4; out[di] = 40; out[di + 1] = 40; out[di + 2] = 40;
  }
  for (let gx = 0; gx < bw; gx += 10) for (let y = 0; y < H; y++) {
    const di = (y * W + gx * zoom) * 4; out[di] = 40; out[di + 1] = 40; out[di + 2] = 40;
  }
  // The FITTED ellipse, in cyan, drawn back over the crop. This is the whole audit:
  // a number that claims a ground marker is 22 deg is worth nothing until the ellipse
  // it came from is seen to lie ON that marker (`CLAUDE.md` #3 — judge rendered pixels).
  if (conic && conic.isEllipse) {
    const { x0, y0, major, minor, tiltDeg } = conic;
    const t = tiltDeg * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
    for (let i = 0; i < 4000; i++) {
      const th = (i / 4000) * Math.PI * 2;
      const u = major * Math.cos(th), v = minor * Math.sin(th);
      const px = Math.round((x0 + u * ct - v * st) * zoom);
      const py = Math.round((y0 + u * st + v * ct) * zoom);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx, qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const di = (qy * W + qx) * 4;
        out[di] = 0; out[di + 1] = 255; out[di + 2] = 255;
      }
    }
  }
  await writeRGBA(outPath, { data: out, width: W, height: H });
}

// ── main ─────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  selftest();
} else {
  const imgPath = arg('--img');
  if (!imgPath) { console.error('need --img'); process.exit(2); }
  const img = await loadRGBA(imgPath);
  const box = arg('--box') ? nums(arg('--box')) : [0, 0, img.width - 1, img.height - 1];
  const zoom = Number(arg('--zoom-factor', '4'));

  if (has('--zoom')) {
    const outPath = arg('--out', 'shots/camangle/zoom.png');
    const bw = box[2] - box[0] + 1, bh = box[3] - box[1] + 1;
    await writeOverlay(outPath, img, box, new Uint8Array(bw * bh), bw, bh, zoom);
    console.log(`zoom -> ${outPath}  (${bw}x${bh} src, ${zoom}x)`);
  } else {
    // `--pick r,g,b[:r,g,b...]` switches to the colour-predicate mode; `--seed x,y`
    // stays the flood-fill mode. Exactly one of them is required.
    const picks = arg('--pick')
      ? arg('--pick').split(':').map((c) => nums(c))
      : null;
    /**
     * `--pred` — a colour PREDICATE rather than a colour list.
     *
     * ⚠️ This exists because a colour list is defeated by SHADING, and shading is not
     * an edge case: our own best ground circle is a striped ring with a prop's cast
     * shadow lying across a third of it, and the shadowed stripes are >60 units from
     * the lit ones. A list-based mask broke the ring into arcs and the largest
     * component was one arc — which the tool duly fitted, returning a 66 deg TILT on a
     * circle whose true tilt is 0. That tilt is why the answer was not believed.
     *
     * Supported: `r-b>N`, `b-r>N`, `luma>N`, `luma<N` (luma on 0..255), `sat>N` (0..1).
     * A hue-side predicate survives a shadow because a shadow scales all three
     * channels together and barely moves r-b relative to their magnitudes.
     */
    const predSrc = arg('--pred');
    const pred = (() => {
      if (!predSrc) return null;
      let m;
      if ((m = /^r-b>(-?[\d.]+)$/.exec(predSrc))) return (r, g, b) => r - b > +m[1];
      if ((m = /^b-r>(-?[\d.]+)$/.exec(predSrc))) return (r, g, b) => b - r > +m[1];
      if ((m = /^luma>([\d.]+)$/.exec(predSrc))) return (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b > +m[1];
      if ((m = /^luma<([\d.]+)$/.exec(predSrc))) return (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b < +m[1];
      if ((m = /^g-r>(-?[\d.]+)$/.exec(predSrc))) return (r, g, b) => g - r > +m[1];
      if ((m = /^g-b>(-?[\d.]+)$/.exec(predSrc))) return (r, g, b) => g - b > +m[1];
      if ((m = /^green>(-?[\d.]+)$/.exec(predSrc))) return (r, g, b) => g - r > +m[1] && g - b > +m[1];
      if ((m = /^sat>([\d.]+)$/.exec(predSrc))) return (r, g, b) => {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        return mx > 0 && (mx - mn) / mx > +m[1];
      };
      console.error(`unrecognised --pred "${predSrc}"`); process.exit(2);
    })();
    const seed = arg('--seed') ? nums(arg('--seed')) : null;
    if (!picks && !seed && !pred) { console.error('need --seed x,y or --pick r,g,b or --pred expr'); process.exit(2); }
    const ring = has('--ring');
    // `--exclude x0,y0,x1,y1[;...]` in IMAGE coordinates; converted to box-local.
    const excludes = (arg('--exclude') ?? '').split(';').filter(Boolean)
      .map((r) => nums(r)).map((r) => [r[0] - box[0], r[1] - box[1], r[2] - box[0], r[3] - box[1]]);
    const label = arg('--label', '');
    const rows = [];
    for (const tol of (arg('--tol') ? [Number(arg('--tol'))] : [30, 45, 60, 80])) {
      const { mask: raw, bw, bh, seedRGB } = (picks || pred)
        ? pickColours(img, box, picks ?? [[0, 0, 0]], tol, pred, has('--keep-all'))
        : floodFill(img, box, seed, tol);
      const mask = has('--no-fill-holes') ? raw : fillHoles(raw, bw, bh);
      const s = maskStats(mask, bw, bh, ring);
      if (!s) continue;
      const bpts = boundaryPts(mask, bw, bh, excludes);
      const cf = fitConic(has('--no-outer') ? bpts : outerPts(bpts));
      rows.push({
        tol, n: s.n, seedRGB,
        bboxW: s.bboxW, bboxH: s.bboxH,
        bboxDeg: +asinDeg(s.bboxH / s.bboxW).toFixed(2),
        momA: +s.momA.toFixed(2), momB: +s.momB.toFixed(2),
        momDeg: +asinDeg(s.momB / s.momA).toFixed(2),
        momTiltDeg: +s.tiltDeg.toFixed(2),
        conicDeg: cf && cf.isEllipse ? +asinDeg(cf.ratio).toFixed(2) : null,
        conicMajor: cf && cf.isEllipse ? +cf.major.toFixed(1) : null,
        conicTiltDeg: cf && cf.isEllipse ? +cf.tiltDeg.toFixed(2) : null,
        conicPts: cf ? cf.n : 0,
        touchesBox: s.minX === 0 || s.minY === 0 || s.maxX === bw - 1 || s.maxY === bh - 1,
      });
      if (arg('--out') && (arg('--tol') || tol === 45)) {
        await writeOverlay(arg('--out'), img, box, mask, bw, bh, zoom, cf);
      }
    }
    console.log(JSON.stringify({ img: imgPath, label, box, seed, ring, rows }, null, 1));
    if (arg('--json-out')) {
      await mkdir(dirname(arg('--json-out')), { recursive: true });
      await writeFile(arg('--json-out'), JSON.stringify({ img: imgPath, label, box, seed, ring, rows }, null, 1));
    }
  }
}
