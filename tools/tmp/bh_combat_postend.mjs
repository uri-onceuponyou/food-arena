#!/usr/bin/env node
// bh_combat_postend — projectiles keep resolving damage for as long as they fly AFTER
// `match-ended`, because the shipped loop keeps stepping the sim under the result card.
//
// sim.ts (grep `Projectiles update every tick regardless of match phase`) says projectiles
// "can still land damage for ONE EXTRA TICK after a match technically ends". That is true of a
// caller that stops stepping. `match.ts:GameSession.loop` never stops: it calls `stepMatch` on
// every animation frame, in every phase, while the result card is up — so an in-flight shot (or a
// pecking Hatch! chick) lands on the declared WINNER up to its full flight time later, and can
// kill it. `match.ts`'s `death` handler then plays the winner's death animation, burst, shake and
// hit-stop on the victory screen (grep `this.models[slot]?.play('death')`).
//
// Deterministic duel (the shipped default seat count): slot 1 throws Lettuce Fling (speed 160) at
// slot 0 and is killed by slot 0's Patty Smash before the shot lands. We then keep stepping as
// `GameSession.loop` does and log every event after `match-ended`.
//
// Usage: node tools/tmp/bh_combat_postend.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const SMASH = weaponIndex(S, 'hamburger', 'Smash');
const LETTUCE = weaponIndex(S, 'hamburger', 'Lettuce');

const st = seatMatch(S, fixtureArena(), [
  { characterId: 'hamburger', x: 1000, y: 1000, facing: { x: 1, y: 0 } },
  { characterId: 'hamburger', x: 1110, y: 1000, facing: { x: -1, y: 0 } },
]);
const A = st.fighters[0], B = st.fighters[1];
A.hp = 5; B.hp = 10;
const log = [];
let endedTick = null, tick = 0;
for (let t = 0; t < 4000; t += DT, tick++) {
  const ins = [null, null];
  if (tick === 0) ins[1] = input({ aim: { x: -1, y: 0 }, weapon: LETTUCE, attack: true });
  if (tick === 1) { B.x = 1060; }   // B steps into A's swing range (positions are legal; no cover)
  if (tick === 1) ins[0] = input({ aim: { x: 1, y: 0 }, weapon: SMASH, attack: true });
  const evs = S.sim.stepMatch(st, DT, ins);
  for (const e of evs) {
    if (e.type === 'match-ended') endedTick = tick;
    if (['hit-landed', 'death', 'match-ended'].includes(e.type)) {
      log.push(`t=${Math.round(t)}ms tick ${tick}${endedTick !== null && tick > endedTick ? ' [AFTER END]' : ''}: ${e.type}${e.targetId !== undefined ? ` target=${e.targetId} amount=${e.amount}` : ''}${e.fighterId !== undefined ? ` fighter=${e.fighterId}` : ''}${e.winnerId !== undefined ? ` winner=${e.winnerId}` : ''}`);
    }
  }
}
console.log(log.join('\n'));
const winner = st.fighters[st.winnerId];
console.log(`\nphase=${st.phase} winnerId=${st.winnerId} winner.alive=${winner.alive} winner.hp=${winner.hp}`);
const after = log.filter((l) => l.includes('[AFTER END]'));
console.log(after.length ? `VERDICT: BUG — ${after.length} damage/death event(s) after match-ended; declared winner alive: ${winner.alive}` : 'VERDICT: nothing resolves after the match ends.');
