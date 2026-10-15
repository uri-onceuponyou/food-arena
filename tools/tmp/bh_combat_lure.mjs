#!/usr/bin/env node
// bh_combat_lure — is a lured bystander ever dragged THROUGH the bait?
//
// combat.ts:applyHitDisplacement (grep `CLAMPED TO EACH OPPONENT'S OWN SEPARATION`) promises:
// "so nobody is dragged THROUGH the bait and out the far side … a second application would
// yank it back — an oscillation that reads on screen as the controls fighting the player."
// The clamp is applied PER APPLICATION, but `movement.ts:displaceFighter` ACCUMULATES
// `remaining = min(cap, remaining + distance)` with the NEWEST direction. A multi-pellet lure
// (Sushi's Big Catch: 3 homing pellets, lure 42 each) lands several applications inside the
// time one is spent, so the owed distance can exceed the separation it was clamped to.
//
// Setup (N=3; the lure moves "EVERY living opponent", which is only a third fighter at N>=3):
// Sushi (slot 0) fires Big Catch east at B (slot 1, 100 wu); bystander C (slot 2) stands
// `--gap` wu from B, perpendicular to the shot. Everyone else stands still. We track the
// signed offset of C from B along the B->C axis; if it goes NEGATIVE, C passed through B.
//
// Usage: node tools/tmp/bh_combat_lure.mjs [--gap 30] [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const GAPS = argv('gap', null) ? [Number(argv('gap'))] : [10, 20, 30, 41, 60];

function run(gap, key) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'sushi', x: 1000, y: 1000, facing: { x: 1, y: 0 } },
    { characterId: 'pizza', x: 1100, y: 1000 },
    { characterId: 'soup', x: 1100, y: 1000 + gap },
  ]);
  const wi = weaponIndex(S, 'sushi', key);
  const B = st.fighters[1], C = st.fighters[2];
  const ax = { x: 0, y: 1 };   // the initial B->C axis
  let minSigned = Infinity, lureHits = 0, hitsOnC = 0, pushRemainingMax = 0;
  const trace = [];
  const anchors = [];
  for (let t = 0; t < 2500; t += DT) {
    const evs = S.sim.stepMatch(st, DT, [input({ aim: { x: 1, y: 0 }, weapon: wi, attack: t === 0 }), null, null]);
    for (const e of evs) if (e.type === 'hit-landed' && e.source.kind === 'weapon') { lureHits++; if (e.targetId === 2) hitsOnC++; anchors.push(`hit seat ${e.targetId} @ (${e.x.toFixed(1)},${e.y.toFixed(1)}) t=${t.toFixed(0)}`); }
    pushRemainingMax = Math.max(pushRemainingMax, C.push.remaining);
    const signed = (C.x - B.x) * ax.x + (C.y - B.y) * ax.y;
    minSigned = Math.min(minSigned, signed);
    if (trace.length < 40 && (evs.length || C.push.remaining > 0)) trace.push(`${t.toFixed(0)}ms B=(${B.x.toFixed(1)},${B.y.toFixed(1)}) C=(${C.x.toFixed(1)},${C.y.toFixed(1)}) C-B=${signed.toFixed(1)} remC=${C.push.remaining.toFixed(1)} remB=${B.push.remaining.toFixed(1)}`);
  }
  return { gap, key, hits: lureHits, hitsOnC, pushRemainingMax: +pushRemainingMax.toFixed(2), minSigned: +minSigned.toFixed(2), final: +((C.x - B.x) * ax.x + (C.y - B.y) * ax.y).toFixed(2), trace, anchors, B: [B.x, B.y], C: [C.x, C.y] };
}

let through = 0;
for (const g of GAPS) {
  for (const key of ['Catch', 'Seaweed']) {
    const r = run(g, key);
    const passed = r.minSigned < 0;
    if (passed) through++;
    console.log(`${key.padEnd(7)} gap ${String(g).padStart(3)}: hits=${r.hits} (on C ${r.hitsOnC}) maxOwed=${r.pushRemainingMax} minOffset=${r.minSigned} final=${r.final} ${passed ? '<-- DRAGGED THROUGH THE BAIT' : ''}`);
    if (GAPS.length === 1) console.log('   anchors: ' + r.anchors.join(' | ') + '\n   ' + r.trace.join('\n   '));
  }
}
console.log(through ? `VERDICT: BUG — ${through} arm(s) drag a bystander through the bait.` : 'VERDICT: no bystander crosses the bait.');
