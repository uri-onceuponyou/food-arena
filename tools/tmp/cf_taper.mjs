#!/usr/bin/env node
/**
 * cf_taper — prove what `sushi.ts`'s `taperedLimb` cap fix DID and DID NOT change, by
 * generating the OLD and NEW lathe profiles side by side in Node, with no renderer.
 *
 * THROWAWAY, READ-ONLY. It changes nothing; it decides one question that a render
 * cannot answer cleanly, because the two arms differ in the very meshes under test:
 *
 *   Is the change a NO-OP on the two DEFAULT call sites (`forearm`, `shin`), as the
 *   comment in `sushi.ts` claims, or did the fix quietly move a joint nobody looked at?
 *
 * ── WHY IT IS NOT ENOUGH TO READ THE CODE ───────────────────────────────────
 * The old and new forms collapse to the same points **only when `rBot <= len * capBotFrac`**,
 * and whether that holds is arithmetic on numbers the RIG produces, not constants in the
 * file. `shin` clears it by 0.0005 m — 0.5 mm on a 0.23 m bone. A claim resting on a
 * half-millimetre is a claim that has to be computed, and `soup.ts`'s copy of this same
 * helper carries a comment whose own numbers had gone stale under it.
 *
 * ── KNOWN-BAD INPUT (CLAUDE.md #6) ──────────────────────────────────────────
 * `--selftest` runs four cases whose answers are derived BY HAND:
 *   1. a slot with `rBot < len*frac`         -> MUST report IDENTICAL (0 moved points)
 *   2. a slot with `rBot > len*frac`         -> MUST report a difference, and the OLD
 *                                               bottom radius MUST equal `len*frac`
 *   3. the exact boundary `rBot == len*frac` -> MUST report IDENTICAL
 *   4. a mutated NEW implementation that also drops `rBot` -> the differ MUST NOT call
 *      it identical to the fixed one. A differ that cannot fail is a comment.
 * A guard that has not been shown to FAIL on the bug it guards against is not a guard.
 *
 *   node tools/tmp/cf_taper.mjs [--selftest]
 */
const CAP = 5, TCAP = 4;

/** The profile as SHIPPED BEFORE this pass: `capBot` is both the cap height AND radius. */
function profileOld(len, rTop, rBot, capBotFrac) {
  const capBot = Math.min(rBot, len * capBotFrac);
  const capTopH = Math.min(rTop * 0.42, len * 0.16);
  const wallBotY = -(len - capBot);
  const wallTopY = -capTopH;
  const pts = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push([capBot * Math.cos(a), wallBotY - capBot * Math.sin(a)]);
  }
  pts.push([rTop, wallTopY]);
  for (let i = 1; i <= TCAP; i++) {
    const a = (i / TCAP) * Math.PI * 0.5;
    pts.push([rTop * Math.cos(a), wallTopY + capTopH * Math.sin(a)]);
  }
  return pts;
}

/** The profile AFTER: `rBot` horizontally, `capH` vertically (soup.ts's two-number cap). */
function profileNew(len, rTop, rBot, capBotFrac) {
  const capH = Math.min(rBot, len * capBotFrac);
  const capTopH = Math.min(rTop * 0.42, len * 0.16);
  const wallBotY = -(len - capH);
  const wallTopY = -capTopH;
  const pts = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push([rBot * Math.cos(a), wallBotY - capH * Math.sin(a)]);
  }
  pts.push([rTop, wallTopY]);
  for (let i = 1; i <= TCAP; i++) {
    const a = (i / TCAP) * Math.PI * 0.5;
    pts.push([rTop * Math.cos(a), wallTopY + capTopH * Math.sin(a)]);
  }
  return pts;
}

const diff = (A, B) => {
  let moved = 0, worst = 0;
  for (let i = 0; i < A.length; i++) {
    const d = Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]);
    if (d > 0) moved++;
    if (d > worst) worst = d;
  }
  return { moved, worst };
};

/** Widest ring the wall actually reaches at its BOTTOM end, in each form. */
const botR = { old: (len, rBot, f) => Math.min(rBot, len * f), new: (_len, rBot) => rBot };

if (process.argv.includes('--selftest')) {
  let pass = 0, fail = 0;
  const ck = (name, ok, extra = '') => { if (ok) { pass++; console.log(`  PASS ${name} ${extra}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

  // 1. rBot comfortably under len*frac -> identical.
  {
    const d = diff(profileOld(0.22, 0.11, 0.078, 0.45), profileNew(0.22, 0.11, 0.078, 0.45));
    ck('rBot < len*frac is a NO-OP', d.moved === 0 && d.worst === 0, `moved=${d.moved} worst=${d.worst}`);
  }
  // 2. rBot over len*frac -> must differ, and the OLD bottom radius must be the clamp.
  {
    const d = diff(profileOld(0.24, 0.126, 0.111, 0.10), profileNew(0.24, 0.126, 0.111, 0.10));
    const oldBot = botR.old(0.24, 0.111, 0.10);
    ck('rBot > len*frac MOVES points', d.moved > 0, `moved=${d.moved} worst=${d.worst.toFixed(4)}`);
    ck('OLD bottom radius == len*frac (rBot discarded)', Math.abs(oldBot - 0.024) < 1e-12, `oldBot=${oldBot}`);
  }
  // 3. exact boundary -> identical. A `<` vs `<=` slip would show up only here.
  {
    const len = 0.20, f = 0.45, rBot = len * f;
    const d = diff(profileOld(len, 0.10, rBot, f), profileNew(len, 0.10, rBot, f));
    ck('rBot == len*frac exactly is a NO-OP', d.moved === 0, `moved=${d.moved}`);
  }
  // 4. the differ must be able to FAIL: a "new" impl that also drops rBot is NOT identical
  //    to the real new one. Without this the whole tool could be `return {moved:0}`.
  {
    const good = profileNew(0.24, 0.126, 0.111, 0.10);
    const bad = profileOld(0.24, 0.126, 0.111, 0.10);   // stands in for a regressed rewrite
    const d = diff(good, bad);
    ck('differ CAN fail (regressed impl is not identical)', d.moved > 0, `moved=${d.moved}`);
  }
  console.log(`\ncf_taper --selftest: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

// ── The four SHIPPED sushi call sites, on the bone numbers `cb_rig.mjs` prints ──
// len / rigRadius come from `cb_rig.mjs` (sushi); the multipliers from `dressLimbs`.
const SLOTS = [
  { slot: 'upperArm', len: 0.2416, rig: 0.1428, fTop: 0.88, fBot: 0.78, frac: 0.10 },
  { slot: 'forearm', len: 0.2204, rig: 0.1314, fTop: 0.848, fBot: 0.60, frac: 0.45 },
  { slot: 'thigh', len: 0.2841, rig: 0.1344, fTop: 1.16, fBot: 1.00, frac: 0.10 },
  { slot: 'shin', len: 0.2325, rig: 0.1210, fTop: 1.111, fBot: 0.86, frac: 0.45 },
];

console.log('slot        len     rTop     rBot asked   botR OLD   botR NEW   moved  worst dy/dx');
let anyMoved = 0;
const wall = {};
for (const s of SLOTS) {
  const rTop = s.rig * s.fTop, rBot = s.rig * s.fBot;
  const A = profileOld(s.len, rTop, rBot, s.frac);
  const B = profileNew(s.len, rTop, rBot, s.frac);
  const d = diff(A, B);
  const bo = botR.old(s.len, rBot, s.frac), bn = botR.new(s.len, rBot, s.frac);
  wall[s.slot] = { rTop, botOld: bo, botNew: bn };
  if (d.moved) anyMoved++;
  console.log(`${s.slot.padEnd(10)} ${s.len.toFixed(4)}  ${rTop.toFixed(4)}   ${rBot.toFixed(4)}`
    + `      ${bo.toFixed(4)}     ${bn.toFixed(4)}   ${String(d.moved).padStart(4)}  ${d.worst.toFixed(4)}`
    + (d.moved === 0 ? '   <- BYTE-IDENTICAL' : ''));
}

console.log('\nJOINT CONTINUITY — the segment BELOW starts at its own rTop; the one ABOVE ends at botR.');
for (const [joint, upper, lower] of [['elbow', 'upperArm', 'forearm'], ['knee', 'thigh', 'shin']]) {
  const o = wall[upper].botOld, n = wall[upper].botNew, t = wall[lower].rTop;
  console.log(`  ${joint.padEnd(6)} above ends ${o.toFixed(4)} (old) / ${n.toFixed(4)} (new)`
    + `   below starts ${t.toFixed(4)}   step ${(t / o).toFixed(2)}x -> ${(t / n).toFixed(2)}x`);
}
console.log(`\n${anyMoved} of ${SLOTS.length} slots move; ${SLOTS.length - anyMoved} are byte-identical.`);
