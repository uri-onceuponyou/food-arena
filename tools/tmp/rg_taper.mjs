#!/usr/bin/env node
/**
 * 🧬 IS THE SHARED `taperedSegment` A NO-OP ON ALL SIX COPIES? — proved, not asserted.
 *
 * ── The finding this exists to make safe ─────────────────────────────────────
 * `taperedSegment` is copy-pasted into **six** character files, and `76369eb` recorded
 * what that costs: donut fixed its own copy and *"the fix never reached the other
 * five"*, which is why the bead necklace survived weeks — **the knowledge was written
 * down, correct, and in the repo while the FUNCTION was duplicated.**
 *
 * The six copies have diverged into exactly TWO bodies:
 *
 *   A "rise"      hamburger, burrito, taco
 *                 (len, rTop, rBot, radialSegments=12, rise=0)
 *                 capBot = min(rBot, len*0.42)
 *                 capTop = min(rTop, (len + rise)*0.30)      yTopCap = rise - capTop
 *   B "capFracs"  donut, egg, lollipop
 *                 (len, rTop, rBot, radialSegments=12, capTopFrac=0.30, capBotFrac=0.42)
 *                 capBot = min(rBot, len*capBotFrac)
 *                 capTop = min(rTop, len*capTopFrac)         yTopCap = -capTop
 *
 * Every other line — profile winding, `capSegs = 6`, `sideSteps = 4`, the lathe — is
 * character-for-character identical in all six.
 *
 * ── The claim ────────────────────────────────────────────────────────────────
 * The UNION is byte-identical to BOTH, on every call site that exists today:
 *
 *     capBot = min(rBot, len * capBotFrac)
 *     capTop = min(rTop, (len + rise) * capTopFrac)
 *     yTopCap = rise - capTop
 *
 * With `capTopFrac = 0.30, capBotFrac = 0.42` it reduces to A exactly.
 * With `rise = 0` it reduces to B exactly (`rise - capTop` = `-capTop`).
 * So consolidation is provably a NO-OP, and this tool is the proof: it builds all
 * three implementations over randomised inputs and compares every vertex.
 *
 * ⚠️ **It is a proof about GEOMETRY, not about MIGRATION.** Each file still has to be
 * edited to call the shared one, and a mistyped argument at a call site is a defect
 * this tool cannot see. `--selftest` therefore includes a known-bad that mutates one
 * argument and REQUIRES the comparison to fail; a comparator that passes everything
 * is a comment with a tick next to it (`AGENT-BRIEF` §4).
 *
 * Usage:
 *   node tools/tmp/rg_taper.mjs --selftest
 *   node tools/tmp/rg_taper.mjs              # the equivalence sweep
 */
import * as THREE from 'three';
import { flag, num } from './rg_lib.mjs';

// ── The two legacy bodies, transcribed verbatim from the six files ────────────
function legacyRise(len, rTop, rBot, radialSegments = 12, rise = 0) {
  const capSegs = 6;
  const capBot = Math.min(rBot, len * 0.42);
  const capTop = Math.min(rTop, (len + rise) * 0.30);
  const yBotCap = -len + capBot;
  const yTopCap = rise - capTop;
  return lathe(len, rTop, rBot, radialSegments, capSegs, capBot, capTop, yBotCap, yTopCap);
}
function legacyCapFracs(len, rTop, rBot, radialSegments = 12, capTopFrac = 0.30, capBotFrac = 0.42) {
  const capSegs = 6;
  const capBot = Math.min(rBot, len * capBotFrac);
  const capTop = Math.min(rTop, len * capTopFrac);
  const yBotCap = -len + capBot;
  const yTopCap = -capTop;
  return lathe(len, rTop, rBot, radialSegments, capSegs, capBot, capTop, yBotCap, yTopCap);
}
/** The UNION — the same arithmetic `rig.ts` now exports. */
function unified(len, rTop, rBot, radialSegments = 12, o = {}) {
  const rise = o.rise ?? 0;
  const capTopFrac = o.capTopFrac ?? 0.30;
  const capBotFrac = o.capBotFrac ?? 0.42;
  const capSegs = 6;
  const capBot = Math.min(rBot, len * capBotFrac);
  const capTop = Math.min(rTop, (len + rise) * capTopFrac);
  const yBotCap = -len + capBot;
  const yTopCap = rise - capTop;
  return lathe(len, rTop, rBot, radialSegments, capSegs, capBot, capTop, yBotCap, yTopCap);
}
/** The shared tail, identical in all six copies. */
function lathe(len, rTop, rBot, radialSegments, capSegs, capBot, capTop, yBotCap, yTopCap) {
  const pts = [new THREE.Vector2(0, -len)];
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len + capBot - Math.cos(a) * capBot));
  }
  const sideSteps = 4;
  for (let i = 1; i <= sideSteps; i++) {
    const t = i / sideSteps;
    pts.push(new THREE.Vector2(THREE.MathUtils.lerp(rBot, rTop, t), THREE.MathUtils.lerp(yBotCap, yTopCap, t)));
  }
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, yTopCap + Math.sin(a) * capTop));
  }
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/** Max absolute difference over every position component. `Infinity` on a shape mismatch. */
function maxDiff(a, b) {
  const pa = a.attributes.position.array, pb = b.attributes.position.array;
  if (pa.length !== pb.length) return Infinity;
  let m = 0;
  for (let i = 0; i < pa.length; i++) m = Math.max(m, Math.abs(pa[i] - pb[i]));
  return m;
}

// Deterministic LCG so a failure is reproducible without a seed file.
let seed = num('--seed', 20260811);
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/**
 * Real slot geometry, so the sweep covers the ratios this cast actually has rather
 * than only random ones. `76369eb` measured `len / (rTop + rBot)` at 0.64-0.89 on egg
 * and lollipop and >1 on burrito, and the clamp branch that fires differs across that
 * boundary — a sweep that never crosses it proves nothing about half the cast.
 */
const REAL = [
  ['taco upperArm', 0.1922, 0.1651, 0.1651], ['taco forearm', 0.1753, 0.1150, 0.1149],
  ['taco thigh', 0.2757, 0.1554, 0.1321], ['taco shin', 0.2256, 0.1049, 0.0909],
  ['burrito upperArm', 0.3216, 0.0881, 0.0800], ['burrito thigh', 0.3354, 0.0985, 0.0822],
  ['egg thigh', 0.2080, 0.1358, 0.1172], ['lollipop upperArm', 0.2090, 0.0818, 0.0753],
];

function sweep() {
  let pass = 0, fail = 0;
  const cases = [];
  for (const [name, len, rTop, rBot] of REAL) {
    cases.push({ name, len, rTop, rBot, rise: 0 });
    cases.push({ name: name + ' +rise', len, rTop, rBot, rise: len * 0.18 });
  }
  for (let i = 0; i < 400; i++) {
    cases.push({
      name: `rand#${i}`,
      len: 0.03 + rnd() * 0.6,
      rTop: 0.01 + rnd() * 0.35,
      rBot: 0.01 + rnd() * 0.35,
      rise: rnd() < 0.5 ? 0 : rnd() * 0.2,
      capTopFrac: rnd() < 0.5 ? 0.30 : 0.02 + rnd() * 0.45,
      capBotFrac: rnd() < 0.5 ? 0.42 : 0.02 + rnd() * 0.45,
    });
  }
  let worstA = 0, worstB = 0;
  for (const c of cases) {
    // FAMILY A: the union with the default cap fractions must equal `legacyRise`.
    const a1 = legacyRise(c.len, c.rTop, c.rBot, 12, c.rise);
    const a2 = unified(c.len, c.rTop, c.rBot, 12, { rise: c.rise });
    const da = maxDiff(a1, a2);
    worstA = Math.max(worstA, da);
    if (da === 0) pass++; else { fail++; console.log(`  FAIL A ${c.name} diff=${da}`); }
    // FAMILY B: the union with rise 0 must equal `legacyCapFracs`.
    const tf = c.capTopFrac ?? 0.30, bf = c.capBotFrac ?? 0.42;
    const b1 = legacyCapFracs(c.len, c.rTop, c.rBot, 12, tf, bf);
    const b2 = unified(c.len, c.rTop, c.rBot, 12, { capTopFrac: tf, capBotFrac: bf });
    const db = maxDiff(b1, b2);
    worstB = Math.max(worstB, db);
    if (db === 0) pass++; else { fail++; console.log(`  FAIL B ${c.name} diff=${db}`); }
  }
  return { pass, fail, cases: cases.length, worstA, worstB };
}

async function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };

  // 🚨 KNOWN-BAD FIRST. A comparator that cannot fail proves nothing. Each of these
  // perturbs ONE input and REQUIRES a non-zero difference.
  const L = 0.2757, RT = 0.1554, RB = 0.1321;
  ok('KNOWN-BAD: a 1 mm change in len is DETECTED',
    maxDiff(unified(L, RT, RB), unified(L + 0.001, RT, RB)) > 0);
  ok('KNOWN-BAD: swapping rTop and rBot is DETECTED',
    maxDiff(unified(L, RT, RB), unified(L, RB, RT)) > 0);
  ok('KNOWN-BAD: a nonzero rise is DETECTED against rise 0',
    maxDiff(unified(L, RT, RB, 12, { rise: 0.04 }), unified(L, RT, RB)) > 0);
  ok('KNOWN-BAD: capTopFrac 0.30 -> 0.05 is DETECTED (the interior-cap fix must be visible)',
    maxDiff(unified(L, RT, RB, 12, { capTopFrac: 0.05 }), unified(L, RT, RB)) > 0);
  ok('KNOWN-BAD: a different radialSegments is a SHAPE mismatch, not a silent 0',
    maxDiff(unified(L, RT, RB, 12), unified(L, RT, RB, 16)) === Infinity);
  ok('SELF-PAIR: the same inputs twice differ by exactly 0',
    maxDiff(unified(L, RT, RB, 12, { rise: 0.04 }), unified(L, RT, RB, 12, { rise: 0.04 })) === 0);

  // The two legacy bodies must DISAGREE with each other wherever rise != 0 — if they
  // agreed everywhere there would be nothing to unify and this whole tool would be
  // measuring one function against itself.
  ok('KNOWN-BAD: the two legacy bodies genuinely DIFFER when rise != 0',
    maxDiff(legacyRise(L, RT, RB, 12, 0.05), legacyCapFracs(L, RT, RB, 12, 0.30, 0.42)) > 0);
  ok('...and AGREE exactly when rise = 0 and the fractions are the defaults',
    maxDiff(legacyRise(L, RT, RB, 12, 0), legacyCapFracs(L, RT, RB, 12, 0.30, 0.42)) === 0);

  console.log(`\n  ${pass} pass, ${fail} fail`);
  return fail === 0;
}

if (flag('--selftest')) {
  console.log('rg_taper selftest — known-bad inputs first\n');
  process.exit((await selftest()) ? 0 : 1);
}

console.log('EQUIVALENCE: the unified `taperedSegment` against both legacy bodies\n');
const r = sweep();
console.log(`  ${r.cases} cases x 2 families = ${r.pass + r.fail} comparisons`);
console.log(`  worst |Δ| against the "rise" body      : ${r.worstA}`);
console.log(`  worst |Δ| against the "capFracs" body  : ${r.worstB}`);
console.log(`\n  ${r.pass} pass, ${r.fail} fail`);
process.exit(r.fail === 0 ? 0 : 1);
