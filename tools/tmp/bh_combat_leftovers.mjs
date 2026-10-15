#!/usr/bin/env node
// bh_combat_leftovers — Leftovers' revive HP does not scale with level; the quantity it is
// derived from does.
//
// docs/ITEMS.md: "Leftovers returns you with `MEDIKIT.heal × MEDIKIT.count` — one corpse's worth
// of kits." combat.ts:reviveThoseKilledBy writes `f.hp = Math.min(f.maxHp, ITEM_TUNING.leftovers.hp)`
// — a flat 18. But a medikit heals `MEDIKIT.heal * levelHealthMultiplier(taker.level)`
// (sim.ts:stepMedikits) and the self-heal scales the same way (combat.ts:deliverWeapon, grep
// `THE HEAL SCALES WITH LEVEL`), whose comment states the invariant: "heal-as-a-FRACTION-OF-POOL
// held constant" is what keeps a mirrored level ladder flat, and calls a resource that does not
// scale "a rule stated once and implemented differently elsewhere".
//
// Method (N=4, real kills, no HP pokes): seat 1 (Leftovers) is killed by seat 0's swings; seat 2
// then kills seat 0; seat 1 revives. Run at L1 and L15 (all seats mirrored, as `match.ts` mirrors
// bot levels). Also: one medikit picked up by a hurt fighter at each level, for the comparison.
//
// Usage: node tools/tmp/bh_combat_leftovers.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const SMASH = weaponIndex(S, 'hamburger', 'Smash');

function revive(level) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'hamburger', x: 1000, y: 1000, facing: { x: 1, y: 0 }, level },
    { characterId: 'hamburger', x: 1040, y: 1000, items: ['leftovers'], level },
    { characterId: 'hamburger', x: 960, y: 1000, facing: { x: 1, y: 0 }, level },
    { characterId: 'hamburger', x: 1800, y: 1800, level },
  ]);
  const V = st.fighters[1];
  let revived = null;
  for (let t = 0; t < 30000 && !revived; t += DT) {
    const ins = [null, null, null, null];
    if (V.alive && !revived) ins[0] = input({ aim: { x: 1, y: 0 }, weapon: SMASH, attack: true });
    else ins[2] = input({ aim: { x: 1, y: 0 }, weapon: SMASH, attack: true });
    const evs = S.sim.stepMatch(st, DT, ins);
    for (const e of evs) if (e.type === 'item-revived') revived = { hp: e.hp, maxHp: V.maxHp };
  }
  return revived;
}

function kit(level) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'hamburger', x: 1000, y: 1000, level },
    { characterId: 'hamburger', x: 1500, y: 1500, level },
    { characterId: 'hamburger', x: 1800, y: 1800, level },
  ]);
  const F = st.fighters[0];
  F.hp = F.maxHp / 2;
  st.medikits.push({ id: 999, sourceId: 2, x: 1000, y: 1000, fromX: 1000, fromY: 1000, armsAt: 0, expiresAt: 1e9 });
  const before = F.hp;
  S.sim.stepMatch(st, DT, [null, null, null]);
  return { healed: +(F.hp - before).toFixed(2), maxHp: F.maxHp };
}

const { ITEM_TUNING, MEDIKIT } = S.rules;
console.log(`ITEM_TUNING.leftovers.hp=${ITEM_TUNING.leftovers.hp}  MEDIKIT.heal x count=${MEDIKIT.heal} x ${MEDIKIT.count}`);
for (const lv of [1, 15]) {
  const r = revive(lv), k = kit(lv);
  console.log(`L${lv}: revive hp ${r?.hp} of ${r?.maxHp} (${r ? (100 * r.hp / r.maxHp).toFixed(1) : '-'}% of pool)  |  one kit heals ${k.healed} -> a corpse's worth = ${(k.healed * MEDIKIT.count).toFixed(2)} (${(100 * k.healed * MEDIKIT.count / k.maxHp).toFixed(1)}% of pool)`);
}
