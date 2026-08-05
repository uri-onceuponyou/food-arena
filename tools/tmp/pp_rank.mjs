#!/usr/bin/env node
/**
 * pp_rank — turn a per-part critic run into a RANKED work list, and state the
 * instrument's own resolution floor before anything in it is acted on.
 *
 * Reads `shots/perpart/manifest.json` (the exact, paired, per-pixel measurements)
 * and a scores JSON (the critic's per-part ours/ref pair), and emits:
 *
 *   1. the ranked table, worst gap first
 *   2. the FLOOR, and a per-row label saying whether that row's number clears it
 *   3. the same question asked of the ORDERING — which is a different quantity and
 *      has a LARGER floor, because a difference-of-differences stacks two of them
 *   4. the reference-side spread, against the recorded whole-character control
 *
 * ── WHY THE FLOOR IS COMPUTED AND NOT ASSUMED ───────────────────────────────
 * CLAUDE.md #10: "state a metric's RESOLUTION FLOOR before acting on a change in
 * it", and every floor this project knows was discovered AFTER someone had already
 * acted inside it. The per-part harness is a NEW instrument. Nobody has measured
 * its floor. This tool ESTIMATES it from the spread actually observed and is
 * explicit that an estimate is not a measurement — `--selftest` prints the run
 * that would turn it into one.
 *
 * ── THE KNOWN-BAD VALIDATION, WHICH IS THE ONLY REASON TO BELIEVE THE NUMBER ──
 * `--selftest` runs six checks. Two of them are the important ones, because they
 * are ANCHORS: this file's floor formula is fed the whole-character critic's own
 * RECORDED parameters and must reproduce that instrument's own RECORDED answers.
 *
 *   ANCHOR-1  sigma 0.50, one critic scoring both panels (n=1) -> must return 1.4
 *   ANCHOR-2  sigma 0.50, TWO independent critics             -> must return 1.0
 *
 * Both numbers are published in docs/LESSONS.md section 3 and tools/review.mjs, and
 * were measured from 16 fresh critics on one fixed image. A formula that cannot
 * reproduce a floor somebody else already measured has no business estimating a
 * floor nobody has. This is the "validate against a KNOWN input before believing it
 * on an unknown one" rule applied to arithmetic rather than to pixels.
 *
 * The other four are the sentinel kinds:
 *   MOVES      more noise must widen the floor
 *   HOLDS      zero spread must return a zero floor (and NOT a comfortable default)
 *   ORDERS     shuffling the input rows must not change the ranking
 *   SELF-PAIR  a score list against ITSELF must return gap 0 for every row -- and
 *              the VALUE 0 is asserted, not merely its stability, because
 *              metric(a)-metric(a) is zero for any pure function and proves
 *              nothing (docs/LESSONS.md section 13, the tautological-guard trap).
 *
 * Read-only. Writes nothing anywhere.
 *
 * Usage:
 *   node tools/tmp/pp_rank.mjs --selftest
 *   node tools/tmp/pp_rank.mjs --scores <path.json> [--manifest shots/perpart/manifest.json]
 */
import fs from 'node:fs';

// ── The floor formula ───────────────────────────────────────────────────────
// A score is one observation with standard deviation `sigma`. A round run as this
// project runs them is ONE critic scoring both panels, and that critic gave both
// panels the same number in 4 of 4 cases -- so two panels is n=1, not n=2.
// Comparing two such numbers is a difference of two independent observations, so
// its standard deviation is sigma*sqrt(2/nCritics), and the 95% bound is 1.96 of
// those.
const Z95 = 1.959964;
export function floorFor(sigma, nCritics = 1) {
  if (!(sigma >= 0)) throw new Error(`floorFor: sigma must be >= 0, got ${sigma}`);
  if (!(nCritics >= 1)) throw new Error(`floorFor: nCritics must be >= 1, got ${nCritics}`);
  return Z95 * sigma * Math.sqrt(2 / nCritics);
}

// The floor on an ORDERING is a different quantity and it is strictly larger: to
// say part A's gap exceeds part B's gap is a difference of two DIFFERENCES, which
// stacks two independent gaps. At correlation rho between the two panels a single
// critic scores, one gap has variance 2*sigma^2*(1-rho); a difference of two gaps
// has twice that again.
export function gapSd(sigma, rho = 0) { return Math.sqrt(2 * sigma * sigma * (1 - rho)); }
export function orderingFloor(sigma, rho = 0) { return Z95 * Math.SQRT2 * gapSd(sigma, rho); }

export function stats(xs) {
  const n = xs.length;
  if (n === 0) return { n: 0, mean: NaN, sd: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { n, mean, sd: 0 };
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(v), var: v };
}

export function rank(scores) {
  return scores
    .filter((s) => s.valid !== false)
    .map((s) => ({ part: s.part, ours: s.oursScore, ref: s.refScore, gap: s.refScore - s.oursScore }))
    // worst gap first; ties broken by the worse ours-score, then by name so the
    // order is TOTAL and ORDERS is a real check rather than a coin flip
    .sort((a, b) => b.gap - a.gap || a.ours - b.ours || a.part.localeCompare(b.part));
}

// ── selftest ────────────────────────────────────────────────────────────────
function selftest() {
  const rows = [];
  const ok = (name, pass, detail) => { rows.push({ name, pass, detail }); return pass; };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  // ANCHOR-1 -- the whole-character critic's own recorded floor.
  const a1 = floorFor(0.50, 1);
  ok('ANCHOR-1 recorded whole-character floor', near(a1, 1.4, 0.05),
    `sigma=0.50, n=1 critic -> ${a1.toFixed(3)} (recorded: 1.4)`);

  // ANCHOR-2 -- the same instrument's recorded floor with two independent critics.
  const a2 = floorFor(0.50, 2);
  ok('ANCHOR-2 recorded two-critic floor', near(a2, 1.0, 0.05),
    `sigma=0.50, n=2 critics -> ${a2.toFixed(3)} (recorded: ~1.0)`);

  // MOVES -- more noise must widen the floor, and by the right factor.
  const m = floorFor(1.0, 1) / floorFor(0.5, 1);
  ok('MOVES  doubling sigma doubles the floor', near(m, 2, 1e-9), `ratio ${m.toFixed(6)}`);

  // HOLDS -- a spread of exactly zero must return a floor of exactly zero. A guard
  // that returns a comfortable non-zero default on no-noise input is not a guard;
  // it would licence acting on any difference at all.
  ok('HOLDS  zero spread -> zero floor', floorFor(0, 1) === 0, `${floorFor(0, 1)}`);

  // ORDERS -- the ranking must not depend on input order.
  const base = [
    { part: 'a', oursScore: 3, refScore: 9 }, { part: 'b', oursScore: 5, refScore: 8 },
    { part: 'c', oursScore: 4, refScore: 8.5 }, { part: 'd', oursScore: 3.5, refScore: 8 },
  ];
  const r1 = rank(base).map((r) => r.part).join(',');
  const r2 = rank([...base].reverse()).map((r) => r.part).join(',');
  const r3 = rank([base[2], base[0], base[3], base[1]]).map((r) => r.part).join(',');
  ok('ORDERS shuffling input does not change the ranking', r1 === r2 && r1 === r3,
    `${r1} | ${r2} | ${r3}`);

  // SELF-PAIR -- a score list scored against ITSELF must return gap EXACTLY 0 on
  // every row. The VALUE is asserted, not merely its stability: metric(a)-metric(a)
  // is zero for any pure function, so "it did not move" proves determinism and
  // nothing else. Here the identity is known by construction, so 0 is checked.
  const sp = base.map((b) => ({ part: b.part, oursScore: b.refScore, refScore: b.refScore }));
  const spGaps = rank(sp).map((r) => r.gap);
  ok('SELF-PAIR identical panels -> gap exactly 0 on every row',
    spGaps.length === 4 && spGaps.every((g) => g === 0), `gaps [${spGaps.join(',')}]`);

  // KNOWN-BAD -- a formula that ignored its input would still pass ANCHOR-1 by
  // returning a constant 1.4. Prove it does not: a deliberately WRONG sigma must
  // produce a floor that FAILS the anchor.
  const kb = floorFor(0.20, 1);
  ok('KNOWN-BAD wrong sigma FAILS the anchor (not a constant)', !near(kb, 1.4, 0.05),
    `sigma=0.20 -> ${kb.toFixed(3)}, which is NOT 1.4 -- the formula reads its input`);

  const pass = rows.filter((r) => r.pass).length;
  for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  -- ${r.detail}`);
  console.log(`\nselftest ${pass}/${rows.length}`);
  if (pass !== rows.length) process.exitCode = 3;
  console.log(`
THE RUN THAT WOULD TURN THE ESTIMATE INTO A MEASUREMENT
  One part, byte-identical crops, N=8 fresh critics, rubric held byte-identical
  (tools/review.rubric.txt, --rubric canonical -- the rubric alone is worth 2.0
  points, so a drifting rubric would be measured as critic noise). Each critic
  scores BOTH panels. Report FOUR numbers, not one:
    sigma_ours, sigma_ref, rho(ours,ref) WITHIN a critic, and sigma_gap.
  rho has never been measured on this project and it is the whole question: at
  rho=0 a gap carries sigma*sqrt(2) and the per-part ORDERING is dead; at rho=0.8
  it carries sigma*0.63 and the ordering becomes usable.
  Include the controls in the same run or it is not an instrument: two critics get
  the SAME panel in both slots (must tie -- recorded 6/6 and 5/5), and one gets
  shots/perpart/_control/degraded/ against its clean original (must score
  materially lower -- recorded 4 against 8). If either control fails, discard sigma.`);
}

// ── report ──────────────────────────────────────────────────────────────────
function report(scoresPath, manifestPath) {
  const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
  const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const table = rank(scores);
  const refS = stats(table.map((r) => r.ref));
  const ourS = stats(table.map((r) => r.ours));
  const gapS = stats(table.map((r) => r.gap));

  // sigma estimate. The reference side is the better noise proxy: the reference is
  // uniformly finished across parts, so most of its spread should be instrument.
  // It is an UPPER bound on critic noise only if reference part quality really is
  // constant -- otherwise it is a MIXTURE of noise and real part variation, which
  // is stated rather than assumed away.
  const sigmaRef = refS.sd;
  // The recorded single-image study measured ours 0.50 against ref 0.39: our side
  // is 1.28x noisier. Carrying that ratio gives the conservative sigma.
  const sigmaOurs = sigmaRef * (0.50 / 0.39);

  const fOpt = floorFor(sigmaRef, 1);
  const fCons = floorFor(sigmaOurs, 1);
  const ordOpt = orderingFloor(sigmaRef, 0);
  const ordCons = orderingFloor(sigmaOurs, 0);

  const byPart = new Map(man.parts.map((p) => [p.part, p]));
  console.log(`character: ${man.character}   plate: ${man.refPlate}`);
  console.log(`camera: ${man.oursCamera.source} pitch ${man.oursCamera.pitchDeg}deg yaw ${man.oursCamera.yawDeg}deg\n`);
  console.log('rank part               ours  ref   gap   blowUp  delivered  clears floor?');
  table.forEach((r, i) => {
    const p = byPart.get(r.part);
    const bu = p?.shippedSize?.blowUpVsShipped;
    const dl = p?.delivered?.ratio;
    console.log(
      `${String(i + 1).padStart(4)} ${r.part.padEnd(18)} ${r.ours.toFixed(1).padStart(4)} ` +
      `${r.ref.toFixed(1).padStart(4)} ${r.gap.toFixed(1).padStart(5)} ` +
      `${(bu != null ? 'x' + bu : '-').padStart(7)} ${(dl != null ? dl.toFixed(3) : '-').padStart(10)}  ` +
      `${r.gap > fCons ? 'YES  ' + (r.gap / fCons).toFixed(1) + 'x' : 'NO -- NOT A RESULT'}`);
  });

  console.log(`\nours  ${ourS.mean.toFixed(2)} +/- ${ourS.sd.toFixed(2)}   (n=${ourS.n})`);
  console.log(`ref   ${refS.mean.toFixed(2)} +/- ${refS.sd.toFixed(2)}   (n=${refS.n})   whole-character control: 8.00 +/- 0.63`);
  console.log(`gap   ${gapS.mean.toFixed(2)} +/- ${gapS.sd.toFixed(2)}`);
  console.log(`\nFLOOR on one score, optimistic  (sigma=sigma_ref=${sigmaRef.toFixed(3)}):  +/-${fOpt.toFixed(2)}`);
  console.log(`FLOOR on one score, conservative (sigma=${sigmaOurs.toFixed(3)}, ours/ref noise ratio 1.28): +/-${fCons.toFixed(2)}`);
  console.log(`FLOOR on the ORDERING (a difference of two gaps), rho=0: +/-${ordOpt.toFixed(2)} .. +/-${ordCons.toFixed(2)}`);
  console.log(`observed gap spread: ${(Math.max(...table.map(r=>r.gap)) - Math.min(...table.map(r=>r.gap))).toFixed(1)} points total range`);

  // is there ANY between-part signal in the gaps beyond critic noise?
  for (const [label, s] of [['optimistic', sigmaRef], ['conservative', sigmaOurs]]) {
    const predVar = gapSd(s, 0) ** 2;
    const F = gapS.var / predVar;
    console.log(`between-part signal in the gaps (${label}): observed var ${gapS.var.toFixed(3)} / noise-only var ${predVar.toFixed(3)} = F ${F.toFixed(2)}`);
  }
  // isolation vs the whole-character control
  const F = (0.63 ** 2) / (sigmaRef ** 2);
  console.log(`\nDID ISOLATION TIGHTEN THE REFERENCE SIDE? F = 0.63^2 / ${sigmaRef.toFixed(3)}^2 = ${F.toFixed(2)}`);
  console.log(`  compare: the recorded 16-critic single-image study measured sigma_ref = 0.39.`);

  physTable(man);
}

/**
 * The SECOND ranking -- the one that is actually resolved.
 *
 * Every column here is a paired per-pixel measurement of two panels that sit on
 * the same matted field to within driftRGB 0.29, at matched part-height fraction.
 * That makes each row a PAIRED delta, and CLAUDE.md #10 is explicit that a paired
 * delta is a different quantity from an aggregate and must be reported separately:
 * its floor is the 8-bit quantisation of a value image, 1/255 = 0.0039, not the
 * critic's +/-1.4. Every deficit below is two to three orders of magnitude above
 * that floor.
 */
function physTable(man) {
  const parts = man.parts.filter((p) => p.valid && p.panel);
  const rows = parts.map((p) => {
    const fg = p.figureGround ?? {};
    return {
      part: p.part,
      fgDeficit: fg.ours && fg.ref ? fg.ref.contrast - fg.ours.contrast : null,
      lumaStdRatio: p.panel.ours.lumaStd / p.panel.ref.lumaStd,
      satDelta: p.panel.ours.satMean - p.panel.ref.satMean,
      edgeRatio: p.panel.ours.edgeDensity / p.panel.ref.edgeDensity,
      delivered: p.delivered?.ratio ?? null,
      blowUp: p.shippedSize?.blowUpVsShipped ?? null,
    };
  });
  console.log(`\n\n=== THE RANKING THAT IS RESOLVED: paired per-pixel deltas ===`);
  console.log(`floor on every column below = 1/255 = 0.0039 on a value image, NOT the critic's +/-1.4\n`);
  console.log('part               fgDeficit  lumaStd(o/r)  satMean(o-r)  edgeDens(o/r)  delivered  blowUp');
  for (const r of rows.sort((a, b) => (b.fgDeficit ?? -9) - (a.fgDeficit ?? -9))) {
    console.log(
      `${r.part.padEnd(18)} ${(r.fgDeficit == null ? 'n/a' : r.fgDeficit.toFixed(4)).padStart(9)} ` +
      `${r.lumaStdRatio.toFixed(3).padStart(13)} ${(r.satDelta >= 0 ? '+' : '') + r.satDelta.toFixed(3)} `.padStart(15) +
      `${r.edgeRatio.toFixed(3).padStart(14)} ${(r.delivered == null ? '-' : r.delivered.toFixed(3)).padStart(10)} ` +
      `${(r.blowUp == null ? '-' : 'x' + r.blowUp).padStart(7)}`);
  }
  const worstDeliver = rows.filter((r) => r.delivered != null && r.delivered < 0.75)
    .sort((a, b) => a.delivered - b.delivered);
  if (worstDeliver.length) {
    console.log(`\n!! DELIVERED-PIXEL WARNING (docs/LESSONS.md section 1 -- 18 cases of "it IS there and is INVISIBLE"):`);
    for (const r of worstDeliver) {
      console.log(`   ${r.part.padEnd(14)} delivered ${r.delivered.toFixed(3)} -- ${((1 - r.delivered) * 100).toFixed(1)}% of the isolated geometry never reaches the screen`);
    }
  }
}

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
if (argv.includes('--selftest')) selftest();
else if (arg('--scores')) report(arg('--scores'), arg('--manifest', 'shots/perpart/manifest.json'));
else { console.error('usage: pp_rank.mjs --selftest | --scores <path.json> [--manifest <path>]'); process.exitCode = 2; }
