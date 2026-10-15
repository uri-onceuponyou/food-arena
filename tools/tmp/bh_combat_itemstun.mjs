#!/usr/bin/env node
// bh_combat_itemstun — an applied STUN does not cancel an ITEM wind-up (Shiitake Shield).
//
// state.ts:ItemCast — "What the separate record still shares …: the movement root and the frozen
// aim, and cancellation on the two terminators that kill a weapon cast (an applied stun, and
// death)." combat.ts:cancelItemCast takes `reason: 'stun' | 'death' | 'sleep'` and the
// `item-cancelled` event type carries 'stun'. But `applyDamage`'s stun block (TERMINATOR 2) only
// calls `cancelCast(target, 'stun', …)` for a WEAPON cast; `cancelItemCast(…, 'stun', …)` has no
// call site. ITEMS.shiitake.look: "The WIND-UP MUST BE VISIBLE TO OPPONENTS — that is what makes
// it counterable".
//
// Arms (duel; seat 0 = Burrito, whose Roll Stun melee applies a real 2000 ms stun):
//   W  control — seat 1 is a Water Bottle that opens Mega Splash (castMs 1400); stunned 500 ms in.
//   I  subject — seat 1 presses Shiitake (2500 ms wind-up); stunned 500 ms in.
//
// Usage: node tools/tmp/bh_combat_itemstun.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const ROLL = weaponIndex(S, 'burrito', 'Roll');
const MEGA = weaponIndex(S, 'waterbottle', 'Mega');

function run(kind) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'burrito', x: 1000, y: 1000, facing: { x: 1, y: 0 } },
    { characterId: 'waterbottle', x: 1040, y: 1000, facing: { x: 1, y: 0 }, items: kind === 'item' ? ['shiitake'] : undefined },
  ]);
  const V = st.fighters[1];
  const out = { stunApplied: false, cancelled: null, shieldRaisedAt: null, megaFired: false };
  for (let t = 0; t < 4000; t += DT) {
    const ins = [null, null];
    if (t === 0) ins[1] = kind === 'item' ? input({ useItem: 0 }) : input({ aim: { x: 1, y: 0 }, weapon: MEGA, attack: true });
    if (Math.abs(t - 500) < DT / 2) ins[0] = input({ aim: { x: 1, y: 0 }, weapon: ROLL, attack: true });
    const evs = S.sim.stepMatch(st, DT, ins);
    for (const e of evs) {
      if (e.type === 'hit-landed' && e.targetId === 1 && e.effect === 'stun' && st.elapsed < V.status.stunnedUntil) out.stunApplied = true;
      if (e.type === 'cast-cancelled' && e.fighterId === 1) out.cancelled = `cast-cancelled(${e.reason})`;
      if (e.type === 'item-cancelled' && e.fighterId === 1) out.cancelled = `item-cancelled(${e.reason})`;
      if (e.type === 'item-hit' && e.itemId === 'shiitake' && e.targetId === 1 && out.shieldRaisedAt === null) out.shieldRaisedAt = Math.round(t);
      if (e.type === 'weapon-fired' && e.fighterId === 1 && e.weaponKey === 'Mega') out.megaFired = true;
    }
  }
  return out;
}

const W = run('weapon'), I = run('item');
console.log('W control (weapon cast, stunned 500 ms in):', JSON.stringify(W));
console.log('I subject (Shiitake wind-up, stunned 500 ms in):', JSON.stringify(I));
const nonVac = W.stunApplied && W.cancelled === 'cast-cancelled(stun)' && !W.megaFired && I.stunApplied;
console.log(`NON-VACUITY: the stun really landed in both arms and kills a WEAPON cast: ${nonVac}`);
console.log(I.cancelled ? 'VERDICT: the stun cancels the item wind-up too.' : `VERDICT: BUG — the stunned fighter's Shiitake wind-up survived and the shield came up at ${I.shieldRaisedAt} ms.`);
process.exit(nonVac ? 0 : 2);
