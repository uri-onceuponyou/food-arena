#!/usr/bin/env node
// bh_combat_trailmelee — does Donut's `trailBoosted` MELEE (Ring Spin) get the trail boost?
//
// rules.ts:Weapon.trailBoosted — "Damage is multiplied when standing on own trail (Donut)."
// Donut's kit authors it on TWO weapons, `Ring` (melee) and `Candy` (ranged). combat.ts
// applies the boost only on the ranged path (grep `const boosted = !!w.trailBoosted`).
//
// Method: Donut walks east through the REAL sim for 400 ms (so its own Sticky Trail marks are
// dropped by `applyWorldTick`, nothing planted), stops, and the probe asserts
// `combat.isOnOwnTrail(state, donut)` is TRUE. It then fires Ring at a target 40 wu ahead
// (inside range 70, cone 160) and, in a twin match, Candy at a target 60 wu ahead, and
// records the `hit-landed` amounts. Arm OFF: identical setup with Donut not on its trail.
//
// Usage: node tools/tmp/bh_combat_trailmelee.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const { TRAIL } = S.rules;

function run(onTrail, key, targetDx) {
  const arena = fixtureArena();
  const st = seatMatch(S, arena, [
    { characterId: 'donut', x: 600, y: 1000 },
    { characterId: 'pizza', x: 2000, y: 1500 },   // parked far away while Donut lays track
  ]);
  const donut = st.fighters[0], target = st.fighters[1];
  if (onTrail) {
    for (let t = 0; t < 400; t += DT) S.sim.stepMatch(st, DT, [input({ move: { x: 1, y: 0 }, aim: { x: 1, y: 0 } }), null]);
  }
  // Stand still for one tick so this tick's move cannot drop/consume anything else.
  S.sim.stepMatch(st, DT, [input({ aim: { x: 1, y: 0 } }), null]);
  const on = S.combat.isOnOwnTrail(st, donut);
  target.x = donut.x + targetDx; target.y = donut.y;
  const wi = weaponIndex(S, 'donut', key);
  const hits = [];
  for (let t = 0; t < 1500 && hits.length < 6; t += DT) {
    const evs = S.sim.stepMatch(st, DT, [input({ aim: { x: 1, y: 0 }, weapon: wi, attack: t === 0 }), null]);
    for (const e of evs) if (e.type === 'hit-landed' && e.targetId === 1 && e.source.kind === 'weapon') hits.push(+e.amount.toFixed(3));
  }
  return { onTrail: on, marks: st.trailMarks.filter((m) => m.ownerId === 0).length, hits };
}

const W = (k) => S.rules.CHARACTERS.donut.weapons.find((w) => w.key === k);
const ring = W('Ring'), candy = W('Candy');
console.log(`Ring  : type=${ring.type} damage=${ring.damage} trailBoosted=${ring.trailBoosted}`);
console.log(`Candy : type=${candy.type} damage=${candy.damage} pellets=${candy.pellets} trailBoosted=${candy.trailBoosted}`);
console.log(`TRAIL.damageBoost=${TRAIL.damageBoost}  -> boosted Ring would be ${Math.round(ring.damage * TRAIL.damageBoost)}, boosted Candy pellet ${Math.round(candy.damage * TRAIL.damageBoost)}`);
const rows = [
  ['Ring  OFF trail', run(false, 'Ring', 40)],
  ['Ring  ON  trail', run(true, 'Ring', 40)],
  ['Candy OFF trail', run(false, 'Candy', 60)],
  ['Candy ON  trail', run(true, 'Candy', 60)],
];
for (const [name, r] of rows) console.log(`${name}: isOnOwnTrail=${r.onTrail} ownMarks=${r.marks} hits=${JSON.stringify(r.hits)}`);
const ringOn = rows[1][1], candyOn = rows[3][1], candyOff = rows[2][1];
const nonVacuous = ringOn.onTrail && candyOn.onTrail && !rows[0][1].onTrail && !candyOff.onTrail;
const candyBoosted = candyOn.hits[0] > candyOff.hits[0];
const ringBoosted = ringOn.hits[0] > rows[0][1].hits[0];
console.log(`\nNON-VACUITY (on-trail arms really on trail, off arms really off): ${nonVacuous}`);
console.log(`CONTROL  Candy (ranged) boosted on trail: ${candyBoosted}`);
console.log(`SUBJECT  Ring  (melee)  boosted on trail: ${ringBoosted}`);
console.log(ringBoosted ? 'VERDICT: Ring Spin receives the trail boost.' : 'VERDICT: BUG — Ring Spin is declared trailBoosted but deals unboosted damage on Donut\'s own trail.');
process.exit(nonVacuous && candyBoosted ? 0 : 2);
