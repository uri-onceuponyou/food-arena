#!/usr/bin/env node
// bh_combat_aimframe — a HUMAN's projectile is steered and range-budgeted against the NEAREST
// opponent, not against what the human aimed at. Invisible at N=2 (the nearest IS the aimed-at
// one); expresses from N=3.
//
// combat.ts:deliverWeapon picks `target = nearestLivingOpponent(state, attacker)` for EVERY
// weapon and stamps it on each projectile (`spawnProjectile` → `targetId`, `tx/ty`). sim.ts's
// `stepProjectiles` then reads that target for two things its own comment calls "genuinely about
// *who this shot is chasing*" (grep `` `target` IS NOW THE AIM, NOT THE VICTIM ``):
//   (1) the homing steer, and
//   (2) the range budget, which refunds the TARGET's motion along the shot
//       (`rules.ts` AUTHORISED DEVIATION #12 — "range means a SEPARATION").
// For the AI the nearest opponent IS the aim (stepAI faces it). For a human it is not.
//
// Arms (all positions explicit; seat 1 = the nearest opponent "B", seat 2 = the aimed-at "C"):
//   H0 control   Egg fires Hatch! (homing) due EAST at C, nobody else near  -> C is hit
//   H1 subject   same shot, B stands 100 wu to the north-west, nearer than C -> who is hit?
//   R0 control   Hamburger fires Lettuce Fling (speed 160, range 140) EAST; C stands still 220 wu
//                away (beyond 140 + hit radius); B stands still 100 wu north   -> shot expires
//   R1 subject   same, but B RUNS EAST in parallel with the shot              -> does it reach C?
//
// Usage: node tools/tmp/bh_combat_aimframe.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));

function homing(withB) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'egg', x: 1000, y: 1000, facing: { x: 1, y: 0 } },
    withB ? { characterId: 'pizza', x: 930, y: 930 } : { characterId: 'pizza', x: 1900, y: 1900 },
    { characterId: 'soup', x: 1120, y: 1000 },
  ]);
  const wi = weaponIndex(S, 'egg', 'Hatch');
  const first = [];
  let pathMaxNorth = 0;
  for (let t = 0; t < 2000; t += DT) {
    const evs = S.sim.stepMatch(st, DT, [input({ aim: { x: 1, y: 0 }, weapon: wi, attack: t === 0 }), null, null]);
    for (const p of st.projectiles) pathMaxNorth = Math.max(pathMaxNorth, 1000 - p.y);
    for (const e of evs) if (e.type === 'hit-landed' && e.source.kind === 'weapon') first.push(e.targetId);
    if (first.length) break;
  }
  const dB = Math.hypot(st.fighters[1].x - 1000, st.fighters[1].y - 1000);
  return { firstHitSeat: first[0] ?? null, nearestSeat: dB < 120 ? 1 : 2, bDist: +dB.toFixed(1), pathMaxNorth: +pathMaxNorth.toFixed(1) };
}

function range(bRuns) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'hamburger', x: 1000, y: 1000, facing: { x: 1, y: 0 } },
    { characterId: 'sushi', x: 1000, y: 900 },          // B: nearest (100 wu), fast (speed stat 8)
    { characterId: 'soup', x: 1220, y: 1000 },          // C: aimed at, 220 wu
  ]);
  const wi = weaponIndex(S, 'hamburger', 'Lettuce');
  const w = S.rules.CHARACTERS.hamburger.weapons[wi];
  let maxTravel = 0, maxX = 0, hitSeat = null, ended = null;
  for (let t = 0; t < 3000; t += DT) {
    const evs = S.sim.stepMatch(st, DT, [
      input({ aim: { x: 1, y: 0 }, weapon: wi, attack: t === 0 }),
      bRuns ? input({ move: { x: 1, y: 0 } }) : null,
      null,
    ]);
    for (const p of st.projectiles) { maxTravel = Math.max(maxTravel, p.traveled); maxX = Math.max(maxX, p.x - 1000); }
    for (const e of evs) {
      if (e.type === 'hit-landed' && e.source.kind === 'weapon') hitSeat = e.targetId;
      if (e.type === 'projectile-destroyed') ended = e.reason;
    }
    if (ended) break;
  }
  return { cardRange: w.range, speed: w.speed, hitRadius: st.fighters[2].hitRadius, budgetSpent: +maxTravel.toFixed(1), groundCovered: +maxX.toFixed(1), hitSeat, end: ended };
}

const H0 = homing(false), H1 = homing(true);
const R0 = range(false), R1 = range(true);
console.log('HOMING (Egg Hatch!, aimed due east at seat 2 "C", 120 wu)');
console.log('  H0 control  no B near        :', JSON.stringify(H0));
console.log('  H1 subject  B 99 wu NW       :', JSON.stringify(H1));
console.log('RANGE BUDGET (Hamburger Lettuce Fling, aimed due east at seat 2 "C", 220 wu, standing still)');
console.log('  R0 control  B (nearest) still:', JSON.stringify(R0));
console.log('  R1 subject  B runs east      :', JSON.stringify(R1));
const nonVac = H0.firstHitSeat === 2 && R0.hitSeat === null && R0.end === 'expired';
console.log(`\nNON-VACUITY (controls behave as the card says): ${nonVac}`);
console.log(`SUBJECT homing: a shot aimed at C (${H1.nearestSeat === 1 ? 'B is nearest' : '??'}) first hits seat ${H1.firstHitSeat}`);
console.log(`SUBJECT range : ground covered ${R1.groundCovered} wu vs card range ${R1.cardRange} (+ hit radius ${R1.hitRadius}); hit seat ${R1.hitSeat}`);
const bug = H1.firstHitSeat === 1 || (R1.hitSeat === 2 && R1.groundCovered > R1.cardRange + R1.hitRadius);
console.log(bug ? 'VERDICT: BUG — the human\'s shot is steered/budgeted by the NEAREST opponent, not the one aimed at.' : 'VERDICT: shot follows the aim.');
process.exit(nonVac ? 0 : 2);
