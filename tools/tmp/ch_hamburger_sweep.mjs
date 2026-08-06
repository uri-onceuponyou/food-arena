#!/usr/bin/env node
/**
 * ch_hamburger_sweep — sweep THIS character's stance/proportion knobs against the
 * interpenetration metric, offline, without editing the source once per candidate.
 *
 * OWNED BY THE HAMBURGER AGENT (`tools/tmp/ch_hamburger_*`). Read-only on `src/`.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * `341ce8f` routed two hamburger defects to this character file — `handL~upperArmL`
 * 0.515 (the mitt inside its own biceps) and `handR~thighR` 0.727/0.909 (the mitt
 * inside its own thigh) — and they pull in OPPOSITE directions: lengthening the arm
 * fixes the first and drives the hand further down into the second. That is
 * `docs/LESSONS.md` §7, local optima fighting each other, and it cannot be settled by
 * editing one constant at a time and eyeballing the result.
 *
 * The metric is `rg_interpen`'s `insideFrac`, reimplemented here over the SAME rig at
 * the SAME phases so a number is comparable. Quantisation 1/32 = 0.031: treat any
 * difference below that as zero.
 *
 * ⚠️ This builds a BARE `ChibiRig`, not the dressed character — so it prices the
 * SKELETON only. Food mass, mitts and the spatula are not in it. That is deliberate
 * (the pairs at issue are limb-vs-limb) and it is also the limitation: confirm the
 * chosen candidate on the real character with `rg_interpen --ids hamburger`.
 *
 *   node tools/tmp/ch_hamburger_sweep.mjs --selftest
 *   node tools/tmp/ch_hamburger_sweep.mjs
 */
import { loadCast, arg, flag, num } from './rg_lib.mjs';

const K = num('--k', 32);
const N = num('--n', 240);
const SPAN = num('--span', 30);

const { THREE, ChibiRig, bodyType, CHARACTER_HEIGHT } = await loadCast();
const H = CHARACTER_HEIGHT * 0.976;

/** The shipped hamburger stance, minus the knobs being swept. */
const STANCE = {
  shoulderL: -0.38, shoulderR: 0.20, elbowR: -0.22,
  twist: -0.12, headTilt: -0.07, headTurn: 0.20,
  hipSway: 0.06, lean: 0.06, splay: 0.34,
};

function build({ shoulderW, stanceW, armF, elbowL }) {
  return new ChibiRig({
    palette: { limbRoughness: 0.85 },
    proportions: bodyType('stout', {
      height: H, headFraction: 0.68, neckFraction: 0,
      shoulderWidth: H * shoulderW, stanceWidth: H * stanceW, armFraction: armF,
    }),
    stance: { ...STANCE, elbowL },
  });
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.sqrt(dot(a, a));
function pointSegDist(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const d2 = dot(ab, ab);
  const t = d2 < 1e-12 ? 0 : Math.max(0, Math.min(1, dot(ap, ab) / d2));
  return norm([ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t]);
}

/** Fraction of segment A's centreline inside capsule B (axis b0..b1, radius r). */
function insideFrac(a0, a1, b0, b1, r) {
  let n = 0;
  for (let i = 0; i <= K; i++) {
    const t = i / K;
    const p = [a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t, a0[2] + (a1[2] - a0[2]) * t];
    if (pointSegDist(p, b0, b1) < r) n++;
  }
  return n / (K + 1);
}

const wp = (o) => { const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; };

/**
 * The four pairs `341ce8f` names on this character, plus their mirrors. Each is
 * "limb A's centreline inside limb B's capsule"; B's radius comes from the rig's own
 * `metrics`, i.e. the spec `dressLimbs()` hands the bespoke limb builders.
 */
function worstPairs(rig, anim) {
  const j = rig.joints, m = rig.metrics;
  const out = new Map();
  for (let i = 0; i < N; i++) {
    const t = (i / N) * SPAN;
    rig.animate({ elapsed: t, move01: anim === 'run' ? 1 : 0, attack01: -1, hit01: -1, dead01: -1 });
    j.root.updateWorldMatrix(true, true);
    const P = {
      handL: wp(j.handL), handR: wp(j.handR), elbowL: wp(j.elbowL), elbowR: wp(j.elbowR),
      shoulderL: wp(j.shoulderL), shoulderR: wp(j.shoulderR),
      hipL: wp(j.hipL), hipR: wp(j.hipR), kneeL: wp(j.kneeL), kneeR: wp(j.kneeR), footL: wp(j.footL), footR: wp(j.footR),
    };
    // ⚠️ A MITT IS A BALL, NOT THE FOREARM. Round 1 sampled the segment
    // `elbow -> hand` as "the hand", and every candidate scored a saturated 1.000 for
    // `handR~upperArmR` — because that segment SHARES ITS ENDPOINT with the upper arm
    // it is being tested against, so its first sample is inside by construction. The
    // MOVES control caught it (`1.000 -> 1.000` on a 0.09H shoulder change), which is
    // exactly the job of a control: `docs/LESSONS.md` §14, a metric measuring the right
    // thing and saturated. `rg_interpen` models the hand as `sphere(j.handX,
    // metrics.handRadius)` and this now matches it — the hand's own diameter along the
    // forearm axis, centred on the hand joint, so the half that folds back toward the
    // elbow is expressed and the elbow itself is not.
    const seg = (a, b, r) => {
      const d = sub(b, a), L = norm(d) || 1;
      const u = [d[0] / L, d[1] / L, d[2] / L];
      return [[b[0] - u[0] * r, b[1] - u[1] * r, b[2] - u[2] * r],
        [b[0] + u[0] * r, b[1] + u[1] * r, b[2] + u[2] * r]];
    };
    const hR = seg(P.elbowR, P.handR, m.handRadius);
    const hL = seg(P.elbowL, P.handL, m.handRadius);
    const pairs = [
      ['handR~thighR', hR, [P.hipR, P.kneeR], m.legRadius + m.handRadius],
      ['handL~thighL', hL, [P.hipL, P.kneeL], m.legRadius + m.handRadius],
      ['handR~shinR', hR, [P.kneeR, P.footR], m.legRadius * 0.9 + m.handRadius],
      ['handL~shinL', hL, [P.kneeL, P.footL], m.legRadius * 0.9 + m.handRadius],
      ['handR~upperArmR', hR, [P.shoulderR, P.elbowR], m.armRadius + m.handRadius],
      ['handL~upperArmL', hL, [P.shoulderL, P.elbowL], m.armRadius + m.handRadius],
    ];
    // ⚠️ Seeded to 0 rather than left absent. Round 1 only ever `set` on an
    // improvement, so a pair that is CLEAR at every phase returned `undefined` — and
    // `undefined` is not 0, it is "the tool has no opinion". The direction control
    // below (shoulderL = -1.3, which must read exactly clear) crashed on it, which is
    // the cheap version of `docs/LESSONS.md` §13: an absent answer that reads as a
    // pass everywhere it is compared with `<`.
    for (const [name, [a0, a1], [b0, b1], r] of pairs) {
      const f = insideFrac(a0, a1, b0, b1, r);
      out.set(name, Math.max(f, out.get(name) ?? 0));
    }
  }
  return out;
}

/**
 * ⚠️ RANKED ON THE LEG PAIRS ONLY, and the arm pair is reported BESIDE them, not
 * folded in. `handX~upperArmX` saturates in this model — the hand ball's own diameter
 * reaches back past the elbow whenever `handRadius` is within ~10% of `forearmLength`,
 * so it reads 0.82-0.91 for EVERY candidate in the sweep and a mean over both would be
 * ranking on a constant. `rg_interpen`'s richer volume model reads the same pair at
 * 0.30-0.52, so the absolute number here is an over-report; what it is good for is
 * that it moves with `armFraction`, which is the knob that owns it.
 * `docs/LESSONS.md` §14 — a saturated metric is not a wrong metric, it is a metric
 * that has stopped answering. Split it out rather than average it in.
 */
const LEG_PAIRS = /~(thigh|shin)/;
function score(cand) {
  const rig = build(cand);
  const rows = [];
  for (const anim of ['idle', 'run']) rows.push([anim, worstPairs(rig, anim)]);
  let worst = 0, arm = 0; const detail = [];
  for (const [anim, mm] of rows) {
    for (const [k, v] of mm) {
      if (LEG_PAIRS.test(k)) { if (v > worst) worst = v; if (v > 0.05) detail.push(`${anim}:${k}=${v.toFixed(3)}`); }
      else if (v > arm) arm = v;
    }
  }
  return { worst, arm, detail, armClearance: rig.armClearance, m: rig.metrics };
}

if (flag('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ok   ${l}${e ? '  ' + e : ''}`); } else { fail++; console.log(`  FAIL ${l}${e ? '  ' + e : ''}`); } };
  console.log('ch_hamburger_sweep selftest — known-bad inputs first\n');

  // KNOWN-BAD: `docs/LESSONS.md` §12 — `shoulderL` sits at x = -shoulderWidth, so a
  // POSITIVE z-rotation swings that arm ACROSS the body. The tool must FAIL there.
  const across = new ChibiRig({
    palette: { limbRoughness: 0.85 },
    proportions: bodyType('stout', { height: H, headFraction: 0.68, neckFraction: 0 }),
    stance: { ...STANCE, shoulderL: 1.3, elbowL: 0 },
  });
  const bad = worstPairs(across, 'idle').get('handL~thighL');
  ok('KNOWN-BAD: shoulderL = +1.3 swings the arm across and INTO the far leg — the tool must FAIL', bad > 0.2, `insideFrac=${bad.toFixed(3)}`);

  const good = new ChibiRig({
    palette: { limbRoughness: 0.85 },
    proportions: bodyType('stout', { height: H, headFraction: 0.68, neckFraction: 0 }),
    stance: { ...STANCE, shoulderL: -1.3, elbowL: 0 },
  });
  const g = worstPairs(good, 'idle').get('handL~thighL');
  ok('DIRECTION: the SAME magnitude with the opposite sign is clear — so it reads the sign, not the size', g === 0, `insideFrac=${g.toFixed(3)}`);

  // DRIFT CONTROL: the pose is closed-form, so two evaluations must be bit-identical.
  const a = score({ shoulderW: 0.33, stanceW: 0.27, armF: 0.225, elbowL: -0.58 });
  const b = score({ shoulderW: 0.33, stanceW: 0.27, armF: 0.225, elbowL: -0.58 });
  ok('DRIFT CONTROL: the same candidate scored twice is identical', a.worst === b.worst, `${a.worst.toFixed(4)} vs ${b.worst.toFixed(4)}`);

  // MOVES: widening the shoulder must CHANGE the answer, or the sweep is measuring nothing.
  const wide = score({ shoulderW: 0.42, stanceW: 0.20, armF: 0.225, elbowL: -0.58 });
  ok('MOVES: a 0.09H wider shoulder over a 0.07H narrower stance is visible', Math.abs(wide.worst - a.worst) > 0.031, `legs ${a.worst.toFixed(3)} -> ${wide.worst.toFixed(3)}`);
  // And the split itself is asserted, not assumed: the arm pair must be the one that
  // does NOT move with the shoulder, or splitting it out was the wrong call.
  ok('SPLIT: the arm pair is insensitive to the shoulder/stance change that moves the legs', Math.abs(wide.arm - a.arm) < 0.05, `arm ${a.arm.toFixed(3)} -> ${wide.arm.toFixed(3)}`);

  console.log(`\n  ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

const shoulders = String(arg('--shoulders', '0.30,0.33,0.36,0.39')).split(',').map(Number);
const stances = String(arg('--stances', '0.22,0.25,0.27,0.30')).split(',').map(Number);
const arms = String(arg('--arms', '0.175,0.20,0.225,0.25')).split(',').map(Number);
const elbowL = num('--elbowL', -0.58);

const results = [];
for (const sw of shoulders) for (const st of stances) for (const af of arms) {
  const r = score({ shoulderW: sw, stanceW: st, armF: af, elbowL });
  results.push({ sw, st, af, ...r });
}
results.sort((a, b) => a.worst - b.worst);
console.log(`\nhamburger stance sweep — worst insideFrac over idle+run, ${N} phases. Quantisation 0.031.`);
console.log(`  ${'shoulderW'.padStart(9)} ${'stanceW'.padStart(8)} ${'armF'.padStart(6)} ${'armClr'.padStart(7)} ${'legs'.padStart(6)} ${'arm'.padStart(6)}   offending`);
for (const r of results.slice(0, Number(arg('--top', 14)))) {
  console.log(`  ${r.sw.toFixed(3).padStart(9)} ${r.st.toFixed(3).padStart(8)} ${r.af.toFixed(3).padStart(6)} ${r.armClearance.toFixed(3).padStart(7)} ${r.worst.toFixed(3).padStart(6)} ${r.arm.toFixed(3).padStart(6)}   ${r.detail.join(' ')}`);
}
console.log('');
