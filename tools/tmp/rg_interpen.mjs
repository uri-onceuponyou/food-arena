#!/usr/bin/env node
/**
 * 🔬 INTERPENETRATION ACROSS AN ANIMATION CYCLE — the instrument this repo did not have.
 *
 * ── The finding it exists to measure ─────────────────────────────────────────
 * Uri, on the lobby render: *"all characters' movements (in menu) seems like sometimes
 * the limbs are intersecting and getting into one another. Physics lacks realistic."*
 *
 * **No existing instrument can see this.** `limbcheck`, `limbmatch` and `sepscan` all
 * render ONE frame and count PIXELS, and pixels cannot distinguish two capsules that
 * touch from two capsules that pass through each other — the silhouette is identical.
 * The word "sometimes" in the report is the other half: the defect is a function of
 * animation PHASE, and every instrument here samples t = 1.5 s.
 *
 * ── What it measures ─────────────────────────────────────────────────────────
 * The primary metric is `insideFrac`: **the fraction of a limb's CENTRELINE that lies
 * inside another body's volume**, sampled along the axis. It was chosen over the
 * obvious "surface penetration depth" for three reasons:
 *
 *   1. It needs no radius approximation for the moving limb, so it cannot be gamed by
 *      an argument about which radius to use.
 *   2. It is unambiguous. A limb's axis being inside another mass is not "close" or
 *      "touching" — it is the thing Uri described, in one number.
 *   3. It is monotone and bounded 0..1, so a fix is visible as a number falling
 *      rather than as a sign flip.
 *
 * `sep` (metres of clear air between the two SURFACES, negative when they overlap) is
 * reported alongside so an improvement is visible before `insideFrac` reaches 0 — the
 * exact failure mode `docs/LESSONS.md` §10 warns about, where a metric saturates and a
 * real change looks like no change.
 *
 * ── RESOLUTION FLOOR: this metric is EXACT, and that is a claim worth being precise about
 * There is no sampling noise in the pose — `rig.animate()` is deterministic and this
 * tool calls the SAME function the renderer calls, so a pose at t is bit-identical
 * between here and the game. The only discretisations are:
 *   · the animation is sampled at N phases (default 240 over 30 s), so a spike
 *     narrower than 0.125 s can be missed. Raise `--n` to close that; it is free.
 *   · `insideFrac` is quantised to 1/32 = 0.031 by the axis sampling (`--k`).
 * So: **treat any `insideFrac` difference below 0.031 as zero, and everything above it
 * as exact.** No statistical floor applies — this is not a measurement of a noisy
 * quantity, it is an evaluation of a closed-form pose.
 *
 * ── Volume models, and their honesty ─────────────────────────────────────────
 * · LIMBS are capsules taken from the rig's own `metrics`. Not an approximation of the
 *   mesh — it is literally the spec `dressLimbs()` hands every bespoke limb builder
 *   (`LimbSize { len, radius }`), so it stays correct for characters that replace the
 *   default meshes.
 * · TORSO, PELVIS, HEAD (the food mass) are axis-aligned ellipsoids fitted to the
 *   ACTUAL mesh vertices of that joint, in the joint's local frame. That tracks
 *   `dressTorso` bodies and per-character food geometry for free.
 *   ⚠️ An ellipsoid fitted to a bounding box is CIRCUMSCRIBED, so it over-reports for
 *   a concave mass (a donut's hole, a taco's shell). Reported per-pair, so a suspicious
 *   number can be attributed rather than averaged into a cast figure.
 *
 * ── Adjacency ────────────────────────────────────────────────────────────────
 * Pairs that SHOULD interpenetrate are excluded, not thresholded: a shoulder ball is
 * supposed to be inside the torso and a thigh top is supposed to be inside the pelvis
 * — that is what makes a limb read as ATTACHED rather than floating, which is the
 * other half of this same pass. The exclusion list is explicit and printed by
 * `--pairs`, because a silent exclusion list is how an instrument lies.
 *
 * ── Validate before believing (CLAUDE.md non-negotiable #6) ───────────────────
 *   node tools/tmp/rg_interpen.mjs --selftest
 * 18 assertions, every one of which drives a KNOWN-BAD input through the real
 * `ChibiRig` and requires the tool to FAIL on it. The headline case is the mechanism
 * `docs/LESSONS.md` §12 names: `shoulderL` is at x = -shoulderWidth, so a POSITIVE
 * z-rotation swings that arm ACROSS the body — the tool must report the forearm inside
 * the torso at `shoulderL = +1.2` and must report exactly zero at `shoulderL = -0.5`.
 *
 * Usage:
 *   node tools/tmp/rg_interpen.mjs                      # cast sweep, idle + run
 *   node tools/tmp/rg_interpen.mjs --selftest
 *   node tools/tmp/rg_interpen.mjs --ids hamburger --verbose
 *   node tools/tmp/rg_interpen.mjs --json shots/rg/interpen.json
 *   node tools/tmp/rg_interpen.mjs --pairs               # print the pair/adjacency table
 */
import { loadCast, captureWarnings, writeOut, ALL_IDS, ARCHETYPE, arg, flag, num, list } from './rg_lib.mjs';

const K = num('--k', 32);           // axis samples per limb
const N = num('--n', 240);          // animation phases
const SPAN = num('--span', 30);     // seconds of animation swept
const ANIMS = list('--anims', 'idle,run');
const IDS = list('--ids', ALL_IDS.join(','));
const VERBOSE = flag('--verbose');
const ARM_OUT = num('--armOut', 0);
const ARM_FWD = num('--armFwd', 0);
const NO_CLEAR = flag('--noArmClear');

// ── Geometry ───────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));

/** Distance from point p to segment ab. */
function pointSegDist(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const d2 = dot(ab, ab);
  const t = d2 < 1e-12 ? 0 : Math.max(0, Math.min(1, dot(ap, ab) / d2));
  return len([ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t]);
}

/**
 * Signed "how deep is p inside body B", in a normalised sense:
 *   < 0 outside, 0 on the surface, > 0 inside; 1 = at the centre.
 * For a capsule this is `1 - d/r`; for an ellipsoid `1 - |p'|` in unit-sphere space.
 * The two are commensurate enough for a boolean inside-test, which is all it is used
 * for. Surface distance in METRES is computed separately by `surfaceSep`.
 */
function depthIn(p, B) {
  if (B.kind === 'capsule') {
    const d = pointSegDist(p, B.a, B.b);
    return 1 - d / B.r;
  }
  // Ellipsoid: p into local frame, then scale by radii.
  const q = sub(p, B.c);
  const l = [dot(q, B.ex), dot(q, B.ey), dot(q, B.ez)];
  const s = Math.sqrt((l[0] / B.rx) ** 2 + (l[1] / B.ry) ** 2 + (l[2] / B.rz) ** 2);
  return 1 - s;
}

/** Signed distance from p to body B's SURFACE, in metres. Negative = inside. */
function signedDist(p, B) {
  if (B.kind === 'capsule') return pointSegDist(p, B.a, B.b) - B.r;
  // Radial approximation for the ellipsoid: exact on the three principal axes and on
  // a sphere, and an over-estimate of |distance| elsewhere by at most the eccentricity.
  // Flagged `approx` wherever it is used, and never used for the headline metric.
  const q = sub(p, B.c);
  const l = [dot(q, B.ex), dot(q, B.ey), dot(q, B.ez)];
  const s = Math.sqrt((l[0] / B.rx) ** 2 + (l[1] / B.ry) ** 2 + (l[2] / B.rz) ** 2);
  if (s < 1e-9) return -Math.min(B.rx, B.ry, B.rz);
  return len(q) * (1 - 1 / s);
}

/**
 * Points ON body B's surface. Used only for `sep`; the headline metric uses the
 * SKELETON instead, which needs no surface sampling at all.
 */
function surfacePoints(B, rings = 9, around = 12) {
  const pts = [];
  if (B.kind === 'capsule') {
    const ax = sub(B.b, B.a);
    const L = len(ax);
    // Any orthonormal pair to the axis. A degenerate (sphere) capsule falls back to
    // world axes, which is correct because every direction is then equivalent.
    const n = L < 1e-9 ? [0, 1, 0] : ax.map((x) => x / L);
    let u = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    u = sub(u, n.map((x) => x * dot(u, n)));
    const ul = len(u); u = u.map((x) => x / ul);
    const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const c = [B.a[0] + ax[0] * t, B.a[1] + ax[1] * t, B.a[2] + ax[2] * t];
      for (let k = 0; k < around; k++) {
        const th = (k / around) * Math.PI * 2;
        pts.push([c[0] + (u[0] * Math.cos(th) + w[0] * Math.sin(th)) * B.r,
          c[1] + (u[1] * Math.cos(th) + w[1] * Math.sin(th)) * B.r,
          c[2] + (u[2] * Math.cos(th) + w[2] * Math.sin(th)) * B.r]);
      }
    }
    // The two end caps, which the rings above miss and which are exactly where a hand
    // or a foot makes contact.
    for (const [e, s] of [[B.a, -1], [B.b, 1]]) {
      pts.push([e[0] + n[0] * B.r * s, e[1] + n[1] * B.r * s, e[2] + n[2] * B.r * s]);
    }
    return pts;
  }
  const N_ = rings * around;
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N_; i++) {
    const y = 1 - (2 * i) / (N_ - 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GA * i;
    const lx = Math.cos(th) * r * B.rx, ly = y * B.ry, lz = Math.sin(th) * r * B.rz;
    pts.push([B.c[0] + B.ex[0] * lx + B.ey[0] * ly + B.ez[0] * lz,
      B.c[1] + B.ex[1] * lx + B.ey[1] * ly + B.ez[1] * lz,
      B.c[2] + B.ex[2] * lx + B.ey[2] * ly + B.ez[2] * lz]);
  }
  return pts;
}

/**
 * Clear air between the two SURFACES, in metres. Negative = overlapping.
 * Capsule/capsule is EXACT (closed-form segment distance). Anything involving an
 * ellipsoid samples A's surface against B's, so it is flagged `approx` in the output
 * and is never the metric a verdict rests on.
 */
function surfaceSep(A, B) {
  if (A.kind === 'capsule' && B.kind === 'capsule') {
    return { m: segSegDist(A.a, A.b, B.a, B.b) - A.r - B.r, approx: false };
  }
  let best = Infinity;
  for (const p of surfacePoints(A)) { const d = signedDist(p, B); if (d < best) best = d; }
  for (const p of surfacePoints(B)) { const d = signedDist(p, A); if (d < best) best = d; }
  return { m: best, approx: true };
}

/** Closest distance between segments — Ericson, Real-Time Collision Detection §5.1.9. */
function segSegDist(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  const EPS = 1e-12;
  if (a <= EPS && e <= EPS) return len(r);
  if (a <= EPS) { s = 0; t = Math.max(0, Math.min(1, f / e)); }
  else {
    const c = dot(d1, r);
    if (e <= EPS) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
    else {
      const b = dot(d1, d2), denom = a * e - b * b;
      s = denom !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
      else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return len(sub(c1, c2));
}

/**
 * Body A's SKELETON — the interior line the "centreline is inside" metric is measured
 * along. A capsule's is its axis. An ellipsoid's is its LONGEST principal axis, which
 * is the same idea: the line a designer would say the part runs along. A hand or a
 * foot is near-isotropic so the choice of axis barely moves the number, and a food
 * mass is scored in its own category anyway.
 */
function skeleton(A) {
  const pts = [];
  if (A.kind === 'capsule') {
    for (let i = 0; i <= K; i++) {
      const t = i / K;
      pts.push([A.a[0] + (A.b[0] - A.a[0]) * t, A.a[1] + (A.b[1] - A.a[1]) * t,
        A.a[2] + (A.b[2] - A.a[2]) * t]);
    }
    return pts;
  }
  const axes = [[A.ex, A.rx], [A.ey, A.ry], [A.ez, A.rz]];
  axes.sort((p, q) => q[1] - p[1]);
  const [u, r] = axes[0];
  for (let i = 0; i <= K; i++) {
    const t = (i / K) * 2 - 1;
    pts.push([A.c[0] + u[0] * r * t, A.c[1] + u[1] * r * t, A.c[2] + u[2] * r * t]);
  }
  return pts;
}

/** Fraction of body A's skeleton that is inside body B. */
function insideFrac(A, B) {
  const pts = skeleton(A);
  let n = 0;
  for (const p of pts) if (depthIn(p, B) > 0) n++;
  return n / pts.length;
}

// ── Building the body list from a live rig ────────────────────────────────────
function wpos(THREE, o) { const v = new THREE.Vector3(); v.setFromMatrixPosition(o.matrixWorld); return [v.x, v.y, v.z]; }

/**
 * Fit an axis-aligned (in the joint's own local frame) ellipsoid to every mesh
 * parented at or under `root`, EXCLUDING anything under a group named in `stopAt` —
 * which is how the torso does not swallow the arms hanging off it.
 */
function fitEllipsoid(THREE, root, stopAt, maxDist = Infinity) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  let count = 0, clipped = 0;
  const walk = (o) => {
    if (o !== root && stopAt.has(o.name)) return;
    if (o.isMesh && o.geometry?.attributes?.position) {
      const pos = o.geometry.attributes.position;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      // Sample rather than walk every vertex: a food mass can carry 20k of them and
      // an axis-aligned extent converges after a few hundred. Step chosen so no mesh
      // costs more than ~512 samples; the extremes of a procedural primitive are on
      // a coarse lattice so this is exact for everything in this cast.
      const step = Math.max(1, Math.floor(pos.count / 512));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        // ⚠️ THE HELD WEAPON IS PARENTED TO THE HAND JOINT, and the first version of
        // this fit swallowed it whole. Hamburger's spatula made its right hand a
        // **1.444 m** ellipsoid against a 0.195 m `handRadius`, and the tool then
        // reported `handR ~ upperArmR` at inside 1.000 / sep -0.5565 m — a completely
        // fabricated defect, on the character whose art rejects this pass exists to
        // fix. Soup's ladle and its four noodles did the same. `maxDist` is the fix,
        // and `clipped` is published so a truncation is never silent.
        if (v.length() > maxDist) { clipped++; continue; }
        for (let k = 0; k < 3; k++) {
          const x = v.getComponent(k);
          if (x < min[k]) min[k] = x;
          if (x > max[k]) max[k] = x;
        }
        count++;
      }
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  if (!count) return null;
  const c = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
    .applyMatrix4(root.matrixWorld);
  const e = new THREE.Matrix4().extractRotation(root.matrixWorld);
  const ax = (i) => { const u = new THREE.Vector3(); u.setComponent(i, 1); u.applyMatrix4(e).normalize(); return [u.x, u.y, u.z]; };
  const sc = new THREE.Vector3().setFromMatrixScale(root.matrixWorld);
  return {
    kind: 'ellipsoid', c: [c.x, c.y, c.z],
    ex: ax(0), ey: ax(1), ez: ax(2),
    rx: Math.max(1e-4, (max[0] - min[0]) / 2 * sc.x),
    ry: Math.max(1e-4, (max[1] - min[1]) / 2 * sc.y),
    rz: Math.max(1e-4, (max[2] - min[2]) / 2 * sc.z),
    clipped, sampled: count,
  };
}

const JOINT_NAMES = new Set(['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'torso', 'neck', 'head', 'face', 'hips']);

function bodies(THREE, rig) {
  const j = rig.joints, m = rig.metrics;
  j.root.updateWorldMatrix(true, true);
  const cap = (from, to, r) => ({ kind: 'capsule', a: wpos(THREE, from), b: wpos(THREE, to), r });
  const B = {};
  B.upperArmL = cap(j.shoulderL, j.elbowL, m.armRadius);
  B.upperArmR = cap(j.shoulderR, j.elbowR, m.armRadius);
  B.forearmL = cap(j.elbowL, j.handL, m.armRadius * 0.92);
  B.forearmR = cap(j.elbowR, j.handR, m.armRadius * 0.92);
  // ── HANDS ARE SPEC-DERIVED, NOT MESH-DERIVED, AND THE REASON IS A BUG THIS TOOL HAD ──
  // ⚠️ THE HELD WEAPON IS PARENTED TO THE HAND JOINT. The first version fitted the
  // hand to its meshes and swallowed the prop whole: hamburger's spatula made its
  // right hand a **1.444 m** ellipsoid against a 0.195 m `handRadius`, and the tool
  // then reported `handR ~ upperArmR` at inside 1.000 / sep **-0.5565 m** — a
  // completely fabricated defect, on the character whose art rejects this whole pass
  // exists to fix. Soup's ladle and its four noodles did the same at a smaller scale.
  //
  // A DISTANCE CAP DID NOT FIX IT and that failure is worth recording, because it is
  // the obvious fix: clipping vertices beyond 2.2x `handRadius` still left the
  // spatula's HANDLE inside the cap, so hamburger's right hand fitted 0.378 m against
  // its left at 0.209 m — 1.8x asymmetric, from a symmetric pair of mitts. There is no
  // naming convention for props to exclude either (`spatula_*`, `soup_ladle_*`,
  // `soup_noodle`, `soup_handle_cap` — four schemes on two characters).
  //
  // So the hand uses `metrics.handRadius`, which is not an approximation of the mesh:
  // it is the SPEC `dressLimbs()` hands every mitt builder (`{ len: handRadius * 2,
  // radius: handRadius }`). Prop-immune by construction. The mesh fit is still
  // computed and published as `handMeshFit` so a mitt that has drifted far from its
  // spec is visible rather than silently under-reported — `--selftest` asserts the
  // agreement across the whole cast.
  //
  // It is an ELLIPSOID rather than a degenerate capsule for a second reason found the
  // same way: a zero-length axis makes the skeleton K+1 copies of ONE POINT, so
  // `insideFrac` could only ever read 0.000 or 1.000. Six characters read exactly
  // 1.000 and the number carried no information about how buried the mitt was.
  const sphere = (o, r) => { const p = wpos(THREE, o); return {
    kind: 'ellipsoid', c: p, ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1], rx: r, ry: r, rz: r }; };
  B.handL = sphere(j.handL, m.handRadius);
  B.handR = sphere(j.handR, m.handRadius);
  B.handL.meshFit = fitEllipsoid(THREE, j.handL, JOINT_NAMES);
  B.handR.meshFit = fitEllipsoid(THREE, j.handR, JOINT_NAMES);
  B.thighL = cap(j.hipL, j.kneeL, m.legRadius);
  B.thighR = cap(j.hipR, j.kneeR, m.legRadius);
  B.shinL = cap(j.kneeL, j.footL, m.legRadius * 0.9);
  B.shinR = cap(j.kneeR, j.footR, m.legRadius * 0.9);
  // Feet are the rig's own wedge or a bespoke boot; either way they are a blob at the
  // ankle, so an ellipsoid fitted to the real mesh is both simpler and truer than a
  // capsule guessed off `FOOT_WIDTH_RATIO`.
  B.footL = fitEllipsoid(THREE, j.footL, JOINT_NAMES);
  B.footR = fitEllipsoid(THREE, j.footR, JOINT_NAMES);
  B.head = fitEllipsoid(THREE, j.head, JOINT_NAMES);
  B.torso = m.hasTorso || j.torso.children.some((c) => c.isMesh)
    ? fitEllipsoid(THREE, j.torso, JOINT_NAMES) : null;
  // The pelvis is a mesh on `hips`, alongside the hipL/hipR joint groups. `stopAt`
  // keeps the legs out of its extent.
  const pelvisMesh = j.hips.children.find((c) => c.isMesh && c.name === 'pelvis_mesh');
  B.pelvis = pelvisMesh ? fitEllipsoid(THREE, pelvisMesh, JOINT_NAMES) : null;
  for (const k of Object.keys(B)) if (!B[k]) delete B[k];
  return B;
}

/**
 * Pairs that are SUPPOSED to interpenetrate. Every one of these is a deliberate
 * attachment: a joint ball inside the mass it hangs off is what makes a limb read as
 * connected rather than floating, which is the other half of this same pass.
 */
const ADJACENT = new Set([
  'upperArmL|forearmL', 'upperArmR|forearmR', 'forearmL|handL', 'forearmR|handR',
  'thighL|shinL', 'thighR|shinR', 'shinL|footL', 'shinR|footR',
  // Attachment overlaps.
  'torso|upperArmL', 'torso|upperArmR', 'torso|head', 'torso|pelvis',
  'pelvis|thighL', 'pelvis|thighR', 'pelvis|head', 'pelvis|torso',
  'torso|thighL', 'torso|thighR',
].map((s) => s.split('|').sort().join('|')));

/**
 * The FOOD MASS is scored, but in its own category. A limb inside the food mass is a
 * real defect and it is the one `limbcheck` already measures in pixels; separating it
 * keeps this tool's headline number about the NEW finding (limb into limb, limb into
 * body) rather than restating a known one.
 */
const isMass = (a, b) => a === 'head' || b === 'head';

function pairs(B) {
  const ks = Object.keys(B).sort();
  const out = [];
  for (let i = 0; i < ks.length; i++) {
    for (let k = i + 1; k < ks.length; k++) {
      const key = [ks[i], ks[k]].sort().join('|');
      if (ADJACENT.has(key)) continue;
      out.push([ks[i], ks[k]]);
    }
  }
  return out;
}

/** Score one pose. Returns the worst pair per category plus every offending pair. */
function scorePose(B) {
  const hits = [];
  for (const [x, y] of pairs(B)) {
    const A = B[x], C = B[y];
    // Symmetric: the deeper of "A's axis in C" and "C's axis in A". A sphere-ish body
    // (hand, foot) has a degenerate axis, so taking only one direction would under-
    // report exactly the pair that matters most — the hamburger mitt over its own
    // thigh, where the MITT is the intruder and its axis is a point.
    const f = Math.max(insideFrac(A, C), insideFrac(C, A));
    const sep = surfaceSep(A, C);
    if (f > 0 || sep.m < 0) {
      hits.push({ a: x, b: y, inside: f, sep: sep.m, approx: sep.approx, mass: isMass(x, y) });
    }
  }
  hits.sort((p, q) => q.inside - p.inside || p.sep - q.sep);
  return hits;
}

// ── The sweep ─────────────────────────────────────────────────────────────────
async function sweep(mod) {
  const { createCharacter, THREE } = mod;
  const rows = [];
  const { warns } = captureWarnings(() => {
    for (const id of IDS) {
      const ch = createCharacter(id);
      const rig = ch.rig;
      if (!rig) { rows.push({ id, error: 'no rig' }); continue; }
      // ── `--armOut <rad>`: swing BOTH arms outward by the same angle ─────────────
      // A probe knob, not a fix. `docs/LESSONS.md` §12: `shoulderL` sits at
      // x = -shoulderWidth so a POSITIVE z swings it ACROSS the body, and `shoulderR`
      // is the mirror — hence the opposite signs. Applied to `rig.stance` AFTER
      // construction, which works because `restPose()` reads `this.stance` every frame,
      // so a candidate fix can be swept without editing `rig.ts` at all and without a
      // rebuild between candidates.
      if (ARM_OUT) { rig.stance.shoulderL -= ARM_OUT; rig.stance.shoulderR += ARM_OUT; }
      if (ARM_FWD) { rig.stance.armForward = (rig.stance.armForward ?? 0) + ARM_FWD; }
      // ── `--noArmClear`: the exact A/B for `ChibiRig.solveArmClearance()` ────────
      // `armClearance` is solved per character, so no single `--armOut` can cancel it
      // across the cast. Zeroing the field on the built rig reverts the pose to exactly
      // what it was before the solver existed, in the SAME process, on the SAME object,
      // with no rebuild in between — a drift control of 0.0000 by construction rather
      // than by assertion. That is the only honest way to price the change while peers
      // are mid-edit in the same tree.
      if (NO_CLEAR) rig.armClearance = 0;
      for (const anim of ANIMS) {
        let worstSelf = null, worstMass = null;
        const offenders = new Map();
        for (let i = 0; i < N; i++) {
          const t = (i / N) * SPAN;
          rig.animate({ elapsed: t, move01: anim === 'run' ? 1 : 0 });
          const B = bodies(THREE, rig);
          for (const h of scorePose(B)) {
            const key = `${h.a}|${h.b}`;
            const prev = offenders.get(key);
            if (!prev || h.inside > prev.inside || (h.inside === prev.inside && h.sep < prev.sep)) {
              offenders.set(key, { ...h, t });
            }
            if (h.mass) { if (!worstMass || h.inside > worstMass.inside) worstMass = { ...h, t }; }
            else if (!worstSelf || h.inside > worstSelf.inside) worstSelf = { ...h, t };
          }
        }
        rows.push({
          id, archetype: ARCHETYPE[id], anim,
          worstSelf, worstMass,
          offenders: [...offenders.values()].sort((p, q) => q.inside - p.inside || p.sep - q.sep),
        });
      }
    }
  });
  return { rows, warns };
}

// ── Selftest: every assertion drives a KNOWN-BAD input ─────────────────────────
async function selftest(mod) {
  const { ChibiRig, bodyType, THREE } = mod;
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };

  // ── Pure geometry, against hand-computed answers ────────────────────────────
  ok('pointSegDist: on the axis is 0', Math.abs(pointSegDist([0, 0.5, 0], [0, 0, 0], [0, 1, 0])) < 1e-9);
  ok('pointSegDist: past the end clamps to the cap',
    Math.abs(pointSegDist([0, 2, 0], [0, 0, 0], [0, 1, 0]) - 1) < 1e-9);
  ok('segSegDist: parallel unit apart', Math.abs(segSegDist([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]) - 1) < 1e-9);
  ok('segSegDist: crossing is 0', Math.abs(segSegDist([-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0])) < 1e-9);
  const cA = { kind: 'capsule', a: [0, 0, 0], b: [0, 1, 0], r: 0.1 };
  const cB = { kind: 'capsule', a: [0.5, 0, 0], b: [0.5, 1, 0], r: 0.1 };
  ok('capsule pair clear of each other reports 0 inside', insideFrac(cA, cB) === 0);
  ok('...and a POSITIVE surface separation', Math.abs(surfaceSep(cA, cB).m - 0.3) < 1e-9,
    `sep=${surfaceSep(cA, cB).m.toFixed(4)}`);
  const cC = { kind: 'capsule', a: [0.05, 0, 0], b: [0.05, 1, 0], r: 0.4 };
  ok('a capsule swallowed by a fatter one reports inside = 1', insideFrac(cA, cC) === 1);
  ok('...and a NEGATIVE surface separation', surfaceSep(cA, cC).m < 0);
  const el = { kind: 'ellipsoid', c: [0, 0, 0], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1], rx: 1, ry: 2, rz: 1 };
  ok('ellipsoid: inside along the LONG axis', depthIn([0, 1.5, 0], el) > 0);
  ok('ellipsoid: OUTSIDE at the same distance on a SHORT axis — an isotropic test would pass here and be wrong',
    depthIn([1.5, 0, 0], el) < 0);

  // ── The real rig, with the mechanism `docs/LESSONS.md` §12 names ────────────
  const mk = (stance) => new ChibiRig({
    palette: { limb: 0x888888, hand: 0xcccccc, foot: 0x222222 },
    proportions: bodyType('standard', {}),
    stance,
  });
  const at = (rig, stance) => { Object.assign(rig.stance, stance); rig.restPose(); return bodies(THREE, rig); };

  const rig = mk({});
  const Bref = at(rig, { shoulderL: -0.5, shoulderR: 0.5, elbowL: -0.2, elbowR: -0.2 });
  ok('KNOWN-GOOD: arms swung OUTBOARD put no forearm inside the torso',
    insideFrac(Bref.forearmL, Bref.torso) === 0 && insideFrac(Bref.forearmR, Bref.torso) === 0);
  ok('KNOWN-GOOD: ...and the two hands are clear of each other',
    surfaceSep(Bref.handL, Bref.handR).m > 0);

  // `shoulderL` at x = -shoulderWidth: a POSITIVE z swings it ACROSS the body.
  const Bbad = at(rig, { shoulderL: 1.2, shoulderR: 0.5, elbowL: -0.2, elbowR: -0.2 });
  ok('KNOWN-BAD: shoulderL = +1.2 drives the left forearm INTO the torso — the tool must FAIL here',
    insideFrac(Bbad.forearmL, Bbad.torso) > 0.25,
    `insideFrac=${insideFrac(Bbad.forearmL, Bbad.torso).toFixed(3)} (was ${insideFrac(Bref.forearmL, Bref.torso).toFixed(3)})`);
  ok('KNOWN-BAD: ...and the surface separation goes NEGATIVE',
    surfaceSep(Bbad.forearmL, Bbad.torso).m < 0,
    `sep=${surfaceSep(Bbad.forearmL, Bbad.torso).m.toFixed(4)}m`);
  ok('DIRECTION: the SAME magnitude with the opposite sign does NOT — so the tool is reading the sign, not the size',
    insideFrac(at(rig, { shoulderL: -1.2, shoulderR: 0.5 }).forearmL, Bref.torso) === 0);
  const Bcross = at(rig, { shoulderL: 1.5, shoulderR: -1.5, elbowL: -0.2, elbowR: -0.2 });
  ok('KNOWN-BAD: both arms crossed puts one forearm inside the OTHER',
    Math.max(insideFrac(Bcross.forearmL, Bcross.forearmR), insideFrac(Bcross.forearmR, Bcross.forearmL)) > 0,
    `insideFrac=${Math.max(insideFrac(Bcross.forearmL, Bcross.forearmR), insideFrac(Bcross.forearmR, Bcross.forearmL)).toFixed(3)}`);

  // SELF-PAIR (`sentinel.mjs`'s rule): a body against ITSELF is 100% inside, which is
  // exactly why self-pairs must never reach the report.
  ok('SELF-PAIR: a body against itself is fully inside — so it must be EXCLUDED, not thresholded',
    insideFrac(Bref.forearmL, Bref.forearmL) === 1);
  ok('SELF-PAIR: ...and no pair the tool reports is a self-pair',
    pairs(Bref).every(([a, b]) => a !== b));
  ok('ADJACENCY: the shoulder/torso attachment overlap is excluded by name, not by threshold',
    !pairs(Bref).some(([a, b]) => [a, b].sort().join('|') === 'torso|upperArmL'));
  ok('ADJACENCY: ...but forearm/torso is NOT excluded — the exclusion list cannot hide the defect',
    pairs(Bref).some(([a, b]) => [a, b].sort().join('|') === 'forearmL|torso'));

  // MOVES: a static tool would report the same number at every phase.
  const rig2 = mk({});
  const seen = new Set();
  for (let i = 0; i < 24; i++) {
    rig2.animate({ elapsed: i * 0.37, move01: 1 });
    seen.add(bodies(THREE, rig2).forearmL.a.map((x) => x.toFixed(4)).join(','));
  }
  ok('MOVES: the pose actually changes across the sweep (24 phases, distinct forearm positions)',
    seen.size === 24, `distinct=${seen.size}/24`);

  // ── The instrument bug this tool actually shipped, now a permanent assertion ────
  const { createCharacter } = mod;
  const live = captureWarnings(() => {
    const out = {};
    for (const id of ALL_IDS) {
      const c = createCharacter(id);
      c.rig.restPose();
      const B = bodies(THREE, c.rig);
      out[id] = { L: B.handL, R: B.handR, hr: c.rig.metrics.handRadius };
    }
    return out;
  }).value;
  // Hamburger holds a spatula and soup holds a ladle, both parented to `handR`. The
  // measurement must be BLIND to that.
  const armedOk = ['hamburger', 'soup'].every((id) => live[id].R.rx === live[id].L.rx);
  ok('PROP GUARD: a weapon-holding hand measures the SAME as its empty twin — the spatula and the ladle are invisible to the metric',
    armedOk, `hamburger R.rx=${live.hamburger.R.rx.toFixed(3)} L.rx=${live.hamburger.L.rx.toFixed(3)}`);
  // ...and the assertion is not vacuous: the MESH fit, which is what the tool used to
  // measure, is still wildly asymmetric on exactly those two characters.
  const spanOf = (e) => (e ? Math.max(e.rx, e.ry, e.rz) : 0);
  const skew = (id) => spanOf(live[id].R.meshFit) / Math.max(1e-6, spanOf(live[id].L.meshFit));
  ok('PROP GUARD: ...and it is NOT vacuous — the raw mesh fit those hands would have used is still 2x+ asymmetric',
    skew('hamburger') > 2 && skew('soup') > 1.4,
    `hamburger ${skew('hamburger').toFixed(2)}x  soup ${skew('soup').toFixed(2)}x`);
  // Cross-check the spec against reality on every EMPTY hand, where the mesh fit is
  // trustworthy. A mitt that has drifted far from `handRadius` would be under-reported
  // by a spec-derived body, and this is what makes that visible instead of silent.
  const drift = ALL_IDS.map((id) => ({ id, k: spanOf(live[id].L.meshFit) / live[id].hr }))
    .sort((a, b) => b.k - a.k);
  ok('SPEC vs MESH: every empty mitt in the cast is within 1.6x of the `handRadius` it was specced from',
    drift[0].k < 1.6, `worst ${drift[0].id} ${drift[0].k.toFixed(2)}x, best ${drift.at(-1).id} ${drift.at(-1).k.toFixed(2)}x`);

  console.log(`\n  ${pass} pass, ${fail} fail`);
  return fail === 0;
}

// ── main ──────────────────────────────────────────────────────────────────────
const mod = await loadCast();
if (flag('--selftest')) {
  console.log('rg_interpen selftest — every assertion drives a KNOWN-BAD input\n');
  process.exit((await selftest(mod)) ? 0 : 1);
}
if (flag('--pairs')) {
  const { createCharacter, THREE } = mod;
  const { value: B } = captureWarnings(() => { const c = createCharacter('hamburger'); c.rig.restPose(); return bodies(THREE, c.rig); });
  console.log('bodies:', Object.keys(B).join(' '));
  console.log(`\nEXCLUDED as deliberate attachment overlaps (${ADJACENT.size}):`);
  for (const k of [...ADJACENT].sort()) console.log('  ' + k);
  const ps = pairs(B);
  console.log(`\nSCORED pairs (${ps.length}), 'mass' = against the food item, reported separately:`);
  for (const [a, b] of ps) console.log(`  ${a} | ${b}${isMass(a, b) ? '   [mass]' : ''}`);
  process.exit(0);
}

const { rows, warns } = await sweep(mod);
const f3 = (x) => (x === null || x === undefined ? '  -  ' : x.toFixed(3));
const f4 = (x) => (x === null || x === undefined ? '   -   ' : (x >= 0 ? ' ' : '') + x.toFixed(4));

console.log(`interpenetration sweep — ${IDS.length} characters x ${ANIMS.length} anims x ${N} phases over ${SPAN}s`);
console.log(`insideFrac = fraction of a limb CENTRELINE inside another body. Quantisation 1/${K} = ${(1 / K).toFixed(3)}.\n`);
console.log('char         arch      anim   selfWorst              inside     sep(m)   massWorst              inside');
console.log('-'.repeat(112));
let castWorst = 0, nBad = 0;
for (const r of rows) {
  if (r.error) { console.log(`${r.id.padEnd(12)} ${r.error}`); continue; }
  const s = r.worstSelf, m = r.worstMass;
  console.log(
    `${r.id.padEnd(12)} ${String(r.archetype).padEnd(9)} ${r.anim.padEnd(6)} ` +
    `${(s ? `${s.a}~${s.b}` : '(none)').padEnd(22)} ${f3(s?.inside)}    ${f4(s?.sep)}   ` +
    `${(m ? `${m.a}~${m.b}` : '(none)').padEnd(22)} ${f3(m?.inside)}`
  );
  if (s) { castWorst = Math.max(castWorst, s.inside); if (s.inside > 0) nBad++; }
  if (VERBOSE) {
    for (const h of r.offenders.filter((h) => !h.mass && h.inside > 0)) {
      console.log(`      ${h.a} ~ ${h.b}  inside ${h.inside.toFixed(3)}  sep ${h.sep.toFixed(4)}m  at t=${h.t.toFixed(2)}s${h.approx ? '  (sep approx)' : ''}`);
    }
  }
}
console.log('-'.repeat(112));
console.log(`cast worst SELF interpenetration: ${castWorst.toFixed(3)} — ${nBad}/${rows.length} character-anims have any at all`);
if (warns.length) {
  const uniq = [...new Set(warns)];
  console.log(`\n${warns.length} constructor warnings (${uniq.length} distinct) — not suppressed:`);
  for (const w of uniq.slice(0, 8)) console.log('  ' + w);
  if (uniq.length > 8) console.log(`  ... and ${uniq.length - 8} more`);
}
const jsonOut = arg('--json', null);
if (jsonOut) console.log('\nwrote ' + writeOut(jsonOut, { generated: new Date().toISOString(), N, SPAN, K, rows }));
