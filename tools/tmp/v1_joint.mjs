#!/usr/bin/env node
/**
 * V1_JOINT — is the ground a PAVED SURFACE or a drawn GRID?
 *
 * ## The claim this exists to re-derive
 *
 * A fresh critic, round 1 of item 1:
 *
 *   > *"The ground plane reads as a tiled GRID rather than a paved surface... joint-vs-face
 *   > luma contrast is 41.1 for us (ratio 1.39) against 12.0 for the reference (ratio 1.13)
 *   > — our grout is 3.4x the reference's joint contrast — and it sits on a regular
 *   > orthogonal grid of identical squares whose lines run unbroken to every frame edge,
 *   > where the reference is an irregular polygonal tessellation of varied cell size and
 *   > orientation... Cell SCALE is not the differentiator; shape regularity and joint
 *   > contrast are."*
 *
 * That is **two** falsifiable properties and no tool in this tree produced either number.
 * So this file produces both, from the same code, on both arms and on a reference plate:
 *
 *   deltaLuma / ratio    joint-vs-face luma contrast, 0-255. The critic's 41.1 / 1.39.
 *   maxLineCoverage      the longest STRAIGHT line, at any angle, that is joint the whole
 *                        way across the crop, as a fraction of the crop's width. This is
 *                        the literal operationalisation of *"lines run unbroken to every
 *                        frame edge"*: a perfect lattice scores ~1.0, an irregular
 *                        tessellation cannot, because no straight cut through a Voronoi
 *                        field stays on edges.
 *
 * ⚠️ **They are deliberately SEPARATE numbers and must never be merged.** A floor can have
 * a quiet joint on a perfect lattice (low delta, high coverage) or a loud joint on
 * irregular stones (high delta, low coverage). One number cannot say which was fixed, and
 * this round changes both — so a merged score would be unattributable.
 *
 * ## How joint pixels are found, and why there is no hand-set threshold
 *
 *   L        Rec.709 luma, 0-255.
 *   bg       L blurred at ~half a tile. The tile field carries a deliberate low-frequency
 *            lighting bake (`floor.ts`'s `litness`), so an ABSOLUTE luma cut would track
 *            the bake, not the joint. `bg` removes it.
 *   D        bg - L. Positive where a pixel is darker than its own neighbourhood.
 *   thr      **Otsu** over D. Parameter-free, and validated below against synthetic fields
 *            of KNOWN contrast rather than asserted.
 *   thin     a joint is a THIN structure. Pixels whose 21x21 neighbourhood is more than
 *            `--dense` mask are dropped, which is what keeps a stain, a mat or a cast
 *            shadow out of a "joint" measurement. Arm E is the known-bad for exactly this.
 *
 * 🚨 **A FLAT FIELD HAS NO JOINTS AND OTSU WILL STILL SPLIT IT.** Otsu always returns a
 * threshold; on a unimodal population it cuts the middle of one surface and reports a
 * confident contrast between two halves of the same thing. That is the `[].every()` shape
 * in continuous form, and it is the failure this instrument would otherwise have. So a
 * `structure` test runs FIRST — p99(D) must clear `--min-amp` — and every consumer of
 * `deltaLuma` must check it. Arm D is red the moment that guard goes decorative.
 *
 * ## Known-bads (`--selftest`), and what each one would catch
 *
 *   A  perfect grid, joint 45 luma below face   -> delta ~45, coverage ~1.0
 *   B  perfect grid, joint 12 luma below face   -> delta ~12, coverage ~1.0
 *        A vs B is the arm that proves the contrast number TRACKS contrast. Without it,
 *        any monotone function of "there is a grid here" would pass.
 *   C  irregular polygons, joint 45 below face  -> delta ~45, coverage LOW
 *        the arm that proves coverage measures REGULARITY and not joint strength. B vs C
 *        crosses the two properties, which is the only way to show they are independent.
 *   D  flat field, no joints at all             -> structure FALSE
 *   E  grid + a large dark blob (a stain)       -> delta ~ A's, blob <5% of the mask
 *        the arm that proves the thin filter is doing something. Delete it and the blob
 *        joins the joint class and drags the contrast number.
 *
 * ⚠️ `--selftest` validates this file's LOGIC. It says nothing about whether the PNG you
 * point it at is open ground. Point it at a crop you have LOOKED at.
 *
 * ## Use
 *
 *   node tools/tmp/v1_joint.mjs --selftest
 *   node tools/tmp/v1_joint.mjs --png tools/tmp/v1r2/pitch/before_p58_open_mid.png \
 *     --crop 200,150,1200,600 --tag before --out tools/tmp/v1r2/joint_before.json
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const BG_R = Number(arg('bg-radius', 56));
const DENSE = Number(arg('dense', 0.55));
const MIN_AMP = Number(arg('min-amp', 4));
const ANG = Number(arg('angle-range', 20));
const ANG_STEP = Number(arg('angle-step', 1));

// ─────────────────────────────────────────────────────────────────────────────
// pure image maths — no browser, no disk, so `--selftest` can drive all of it
// ─────────────────────────────────────────────────────────────────────────────

/** HSV saturation 0..1 and Rec.709 luma 0..255. */
export function sv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return { s: mx > 0 ? (mx - mn) / mx : 0, l: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}

/** Separable box blur, 3 passes ~ Gaussian. Radius in px. */
export function blur(src, w, h, r) {
  if (r < 1) return Float32Array.from(src);
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  const cl = (v, m) => Math.min(m - 1, Math.max(0, v));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * w + cl(x, w)];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (2 * r + 1);
        acc += a[y * w + cl(x + r + 1, w)] - a[y * w + cl(x - r, w)];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += a[cl(y, h) * w + x];
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc / (2 * r + 1);
        acc += a[cl(y + r + 1, h) * w + x] - a[cl(y - r, h) * w + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/** Otsu's threshold over an arbitrary Float32Array, restricted to [lo,hi]. */
export function otsu(v, lo, hi, bins = 256) {
  const hist = new Float64Array(bins);
  const scale = bins / (hi - lo);
  let n = 0;
  for (let i = 0; i < v.length; i++) {
    const b = Math.floor((Math.min(hi, Math.max(lo, v[i])) - lo) * scale);
    hist[Math.min(bins - 1, b)]++; n++;
  }
  let sum = 0;
  for (let b = 0; b < bins; b++) sum += b * hist[b];
  let wB = 0, sumB = 0, best = -1, bestB = 0;
  for (let b = 0; b < bins; b++) {
    wB += hist[b];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += b * hist[b];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; bestB = b; }
  }
  return lo + (bestB + 0.5) / scale;
}

export function percentile(v, p) {
  const a = Float64Array.from(v); a.sort();
  return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
}

/** 4-neighbour dilation by one pixel. */
export function dilate(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i] ||
        (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) ||
        (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) out[i] = 1;
    }
  }
  return out;
}

/**
 * The longest STRAIGHT line, at any angle within `range`, that lies on the mask for its
 * whole traverse of the crop — as a fraction of the traverse.
 *
 * Both families (near-horizontal and near-vertical) are swept because a lattice has two,
 * and perspective gives each line its own angle, so a single fixed axis would miss the
 * one that is actually unbroken. Only lines that cross the ENTIRE crop are considered:
 * a short segment lying on one stone's edge is not what the critic described.
 */
export function maxLineCoverage(mask, w, h, { range = 20, step = 1 } = {}) {
  let best = { coverage: 0, deg: 0, axis: 'none', offset: 0 };
  const scan = (axis) => {
    const [len, cross] = axis === 'row' ? [w, h] : [h, w];
    for (let deg = -range; deg <= range + 1e-9; deg += step) {
      const t = Math.tan((deg * Math.PI) / 180);
      const drift = (len - 1) * t;
      const lo = Math.max(0, Math.ceil(-Math.min(0, drift)));
      const hi = Math.min(cross - 1, Math.floor(cross - 1 - Math.max(0, drift)));
      for (let o = lo; o <= hi; o++) {
        let hits = 0;
        if (axis === 'row') {
          for (let x = 0; x < len; x++) {
            const y = Math.round(o + x * t);
            if (mask[y * w + x]) hits++;
          }
        } else {
          for (let y = 0; y < len; y++) {
            const x = Math.round(o + y * t);
            if (mask[y * w + x]) hits++;
          }
        }
        const cov = hits / len;
        if (cov > best.coverage) best = { coverage: cov, deg: +deg.toFixed(2), axis, offset: o };
      }
    }
  };
  scan('row'); scan('col');
  return best;
}

/**
 * The census for one RGB buffer.
 *
 * Every filtered set is asserted NON-EMPTY before anything is computed over it —
 * `CLAUDE.md` rule 6, and the reason is that a mean over an empty set is `NaN` but a
 * *count* over one is `0`, which reads as a clean floor.
 */
export function census(px, w, h, opts = {}) {
  const n = w * h;
  if (n === 0) throw new Error('empty crop — nothing to census');
  const bgR = opts.bgRadius ?? BG_R;
  const dense = opts.dense ?? DENSE;
  const minAmp = opts.minAmp ?? MIN_AMP;

  const L = new Float32Array(n);
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = sv(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
    L[i] = c.l; S[i] = c.s;
  }
  const bg = blur(L, w, h, bgR);
  const D = new Float32Array(n);
  for (let i = 0; i < n; i++) D[i] = bg[i] - L[i];

  const amp = percentile(D, 0.99);
  const thr = otsu(D, -32, 96);
  // 🚨 THE FIRST VERSION OF THIS GUARD WAS `amp >= minAmp && thr > 0.5` AND IT FAILED THE
  // STRONGEST GRID IN THE SELFTEST — kept above with the reason, per `CLAUDE.md`. On a
  // clean lattice the two populations are separated by a genuinely EMPTY band (measured:
  // face mass in D = [-20,0], joint mass in [20,44], nothing between), and every cut
  // inside that band gives the identical partition, so Otsu returns the FIRST of them —
  // `thr = 0.25`. A threshold near zero is therefore the signature of a *perfectly*
  // separated field, i.e. the opposite of what the guard read it as. **The threshold's
  // VALUE says nothing about whether structure exists; the amplitude does.**
  const structure = amp >= minAmp;
  if (!structure) {
    return {
      n, w, h, structure: false,
      reason: `no joint structure: p99(local darkness) = ${amp.toFixed(2)} luma, below --min-amp ${minAmp}`,
      amp: +amp.toFixed(2), thr: +thr.toFixed(2),
    };
  }

  const raw = new Uint8Array(n);
  let rawPx = 0;
  for (let i = 0; i < n; i++) if (D[i] > thr) { raw[i] = 1; rawPx++; }
  if (rawPx === 0) {
    return { n, structure: false, reason: 'no pixel darker than the Otsu threshold', amp: +amp.toFixed(2), thr: +thr.toFixed(2) };
  }
  const density = blur(raw, w, h, 10);
  const mask = new Uint8Array(n);
  let jointPx = 0, blobPx = 0;
  for (let i = 0; i < n; i++) {
    if (!raw[i]) continue;
    if (density[i] > dense) { blobPx++; continue; }
    mask[i] = 1; jointPx++;
  }
  if (jointPx === 0) {
    return { n, structure: false, reason: 'every dark pixel was inside a blob — no thin joint structure', rawPx, blobPx };
  }
  const dil = dilate(mask, w, h);
  let jl = 0, fl = 0, fs = 0, facePx = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i]) { jl += L[i]; continue; }
    if (dil[i] || D[i] > thr) continue;
    fl += L[i]; fs += S[i]; facePx++;
  }
  if (facePx === 0) throw new Error('no FACE pixels — the crop is all joint, which is not a floor');

  const jointLuma = jl / jointPx, faceLuma = fl / facePx;
  const line = maxLineCoverage(dil, w, h, { range: opts.range ?? ANG, step: opts.angleStep ?? ANG_STEP });

  return {
    n, w, h,
    structure,
    amp: +amp.toFixed(2),
    thr: +thr.toFixed(2),
    jointPx, facePx, blobPx,
    jointShare: +(jointPx / n).toFixed(4),
    blobShareOfDark: +(blobPx / (jointPx + blobPx)).toFixed(4),
    jointLuma: +jointLuma.toFixed(2),
    faceLuma: +faceLuma.toFixed(2),
    deltaLuma: +(faceLuma - jointLuma).toFixed(2),
    ratio: +(faceLuma / Math.max(1e-6, jointLuma)).toFixed(4),
    faceSatMean: +(fs / facePx).toFixed(4),
    maxLineCoverage: +line.coverage.toFixed(4),
    lineAxis: line.axis,
    lineDeg: line.deg,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// synthetic fields — the known-bads
// ─────────────────────────────────────────────────────────────────────────────

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Perfect orthogonal grid: `cell` px squares, `jw` px joints, face `face`, joint `face-delta`. */
export function synthGrid(w, h, { cell = 130, jw = 6, face = 148, delta = 45, seed = 7 } = {}) {
  const px = new Uint8Array(w * h * 3);
  const rnd = mulberry(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onJoint = (x % cell) < jw || (y % cell) < jw;
      const v = (onJoint ? face - delta : face) + (rnd() - 0.5) * 3;
      const i = (y * w + x) * 3;
      px[i] = Math.max(0, Math.min(255, v * 1.10));
      px[i + 1] = Math.max(0, Math.min(255, v * 0.95));
      px[i + 2] = Math.max(0, Math.min(255, v * 1.0));
    }
  }
  return px;
}

/** Irregular polygons: nearest-site (Voronoi) over a jittered grid; joint = near a border. */
export function synthVoronoi(w, h, { cell = 130, jw = 6, face = 148, delta = 45, seed = 11 } = {}) {
  const rnd = mulberry(seed);
  const cols = Math.ceil(w / cell) + 2, rows = Math.ceil(h / cell) + 2;
  const sx = new Float64Array(cols * rows), sy = new Float64Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      sx[j * cols + i] = (i - 1) * cell + cell / 2 + (rnd() - 0.5) * cell * 0.8;
      sy[j * cols + i] = (j - 1) * cell + cell / 2 + (rnd() - 0.5) * cell * 0.8;
    }
  }
  const px = new Uint8Array(w * h * 3);
  const noise = mulberry(seed + 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let d1 = Infinity, d2 = Infinity;
      const gi = Math.min(cols - 1, Math.max(0, Math.floor(x / cell) + 1));
      const gj = Math.min(rows - 1, Math.max(0, Math.floor(y / cell) + 1));
      for (let j = Math.max(0, gj - 2); j <= Math.min(rows - 1, gj + 2); j++) {
        for (let i = Math.max(0, gi - 2); i <= Math.min(cols - 1, gi + 2); i++) {
          const k = j * cols + i;
          const d = Math.hypot(x - sx[k], y - sy[k]);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      }
      const onJoint = d2 - d1 < jw;
      const v = (onJoint ? face - delta : face) + (noise() - 0.5) * 3;
      const i2 = (y * w + x) * 3;
      px[i2] = Math.max(0, Math.min(255, v * 1.10));
      px[i2 + 1] = Math.max(0, Math.min(255, v * 0.95));
      px[i2 + 2] = Math.max(0, Math.min(255, v * 1.0));
    }
  }
  return px;
}

export function stampBlob(px, w, h, cx, cy, r, delta) {
  for (let y = Math.max(0, cy - r); y < Math.min(h, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x < Math.min(w, cx + r); x++) {
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const i = (y * w + x) * 3;
      px[i] = Math.max(0, px[i] - delta);
      px[i + 1] = Math.max(0, px[i + 1] - delta);
      px[i + 2] = Math.max(0, px[i + 2] - delta);
    }
  }
  return px;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

function selftest() {
  const W = 900, H = 620;
  let pass = 0, fail = 0;
  const ck = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}  ${d}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };

  console.log('\n§A  perfect grid, joint 45 luma below the face');
  const a = census(synthGrid(W, H, { delta: 45 }), W, H);
  ck('A1 structure detected', a.structure === true, `amp ${a.amp}`);
  ck('A2 deltaLuma recovers 45 +/-7', Math.abs(a.deltaLuma - 45) <= 7, `${a.deltaLuma}`);
  ck('A3 a lattice line runs the whole crop', a.maxLineCoverage >= 0.95, `${a.maxLineCoverage} (${a.lineAxis} ${a.lineDeg} deg)`);

  console.log('\n§B  SAME grid, joint only 12 luma below the face');
  const b = census(synthGrid(W, H, { delta: 12 }), W, H);
  ck('B1 structure detected', b.structure === true, `amp ${b.amp}`);
  ck('B2 deltaLuma recovers 12 +/-5', Math.abs(b.deltaLuma - 12) <= 5, `${b.deltaLuma}`);
  ck('B3 contrast TRACKS contrast (B well below A)', b.deltaLuma < a.deltaLuma - 20, `${b.deltaLuma} vs ${a.deltaLuma}`);
  ck('B4 coverage is UNCHANGED by contrast — still a lattice', b.maxLineCoverage >= 0.95, `${b.maxLineCoverage}`);

  console.log('\n§C  irregular polygons, joint 45 below the face (crosses B)');
  const c = census(synthVoronoi(W, H, { delta: 45 }), W, H);
  ck('C1 structure detected', c.structure === true, `amp ${c.amp}`);
  ck('C2 deltaLuma still ~45 — the contrast arm is blind to shape', Math.abs(c.deltaLuma - 45) <= 10, `${c.deltaLuma}`);
  ck('C3 coverage COLLAPSES — the shape arm is not measuring contrast', c.maxLineCoverage < 0.60, `${c.maxLineCoverage}`);
  ck('C4 ...and it is well below the lattice at the SAME contrast', c.maxLineCoverage < a.maxLineCoverage - 0.30,
    `${c.maxLineCoverage} vs ${a.maxLineCoverage}`);

  console.log('\n§D  flat field — Otsu WILL split it, the structure guard must refuse');
  const flat = new Uint8Array(W * H * 3);
  const rnd = mulberry(3);
  for (let i = 0; i < W * H; i++) {
    const v = 148 + (rnd() - 0.5) * 2;
    flat[i * 3] = v * 1.1; flat[i * 3 + 1] = v * 0.95; flat[i * 3 + 2] = v;
  }
  const d = census(flat, W, H);
  ck('D1 structure REFUSED on a floor with no joints', d.structure === false, `amp ${d.amp}, thr ${d.thr}`);
  ck('D2 ...and it publishes NO contrast number to be quoted', d.deltaLuma === undefined, `${d.reason}`);
  ck('D3 ...for the right reason: amplitude, not the threshold value', /min-amp/.test(String(d.reason)), `${d.reason}`);

  console.log('\n§E  grid + a 90px dark blob (a stain) — the thin filter must exclude it');
  const eRaw = stampBlob(synthGrid(W, H, { delta: 45, seed: 21 }), W, H, 430, 300, 90, 40);
  const e = census(eRaw, W, H);
  const blobArea = Math.PI * 90 * 90;
  ck('E1 blob pixels were classed as BLOB, not joint', e.blobPx > blobArea * 0.6, `${e.blobPx} of ~${Math.round(blobArea)}`);
  ck('E2 deltaLuma survives the stain (within 8 of A)', Math.abs(e.deltaLuma - a.deltaLuma) <= 8, `${e.deltaLuma} vs ${a.deltaLuma}`);
  ck('E3 the joint mask is still mostly joint', e.blobShareOfDark < 0.40, `blob share of dark ${e.blobShareOfDark}`);

  console.log(`\n  ${pass} pass  ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

async function run() {
  const png = arg('png');
  if (!png) { console.error('usage: v1_joint.mjs --png <file> [--crop x,y,w,h] [--tag t] [--out f.json]  |  --selftest'); process.exit(2); }
  if (!existsSync(png)) { console.error(`v1_joint: no such file ${png}`); process.exit(2); }
  let img = sharp(png).removeAlpha();
  const crop = arg('crop');
  if (crop) {
    const [x, y, w, h] = crop.split(',').map(Number);
    img = img.extract({ left: x, top: y, width: w, height: h });
  }
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const r = census(data, info.width, info.height);
  const out = { tag: arg('tag', 'run'), png, crop: crop ?? null, ...r };
  console.log(JSON.stringify(out, null, 2));
  const dest = arg('out');
  if (dest) { mkdirSync(dirname(resolve(dest)), { recursive: true }); writeFileSync(resolve(dest), JSON.stringify(out, null, 2)); }
}

if (IS_MAIN) {
  if (has('selftest')) selftest();
  else await run();
}
