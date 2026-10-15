#!/usr/bin/env node
// bh_combat_bluecheese — does Blue Cheese do anything? Card: "A permanent stink cloud that hurts
// anyone who stands too close." `ITEM_TUNING.blue_cheese` = { radius: 84, dps: 1 }.
// combat.ts routes it to "`sim.ts:applyWorldTick`'s aura block"; `sim.ts` imports
// `ITEM_AURA_TICK_MS`, `itemDamageSource` and `hasItem` and calls none of them (known since
// `32438b4`, still open at `1090046`).
//
// Method: slot 0 wears Blue Cheese and stands still; slot 1 stands 40 wu away (inside radius 84)
// for 10 s; slot 2 stands far away so nothing else happens. Count damage on slot 1 from ANY source.
// Usage: node tools/tmp/bh_combat_bluecheese.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, argv, DT } from './bh_combat_lib.mjs';
const S = await loadSim(argv('root', undefined));
const st = seatMatch(S, fixtureArena(), [
  { characterId: 'pizza', x: 1000, y: 1000, items: ['blue_cheese'] },
  { characterId: 'soup', x: 1040, y: 1000 },
  { characterId: 'egg', x: 1800, y: 1800 },
]);
let dmg = 0, events = 0;
for (let t = 0; t < 10000; t += DT) {
  for (const e of S.sim.stepMatch(st, DT, [null, null, null])) if (e.type === 'hit-landed' && e.targetId === 1) { dmg += e.amount; events++; }
}
const { radius, dps } = S.rules.ITEM_TUNING.blue_cheese;
console.log(JSON.stringify({ radius, dps, separation: 40, secondsInside: 10, expectedDamage: dps * 10, damageTaken: dmg, hitEvents: events }));
console.log(dmg > 0 ? 'VERDICT: the cloud hurts.' : 'VERDICT: BUG — Blue Cheese does nothing (0 damage in 10 s inside its radius).');
