#!/usr/bin/env node
// bh_combat_deadtrail — a dead Donut's Sticky Trail stays on the floor (drawn by vfx.ts from
// `state.trailMarks` until `expiresAt`) but stops hurting anyone the instant Donut dies.
//
// The trail's damage is applied inside the OWNER's `sim.ts:applyWorldTick` ("opponent standing on
// one of THIS fighter's marks takes a one-time hit"), and the fighter loop `continue`s on
// `!fighter.alive` before reaching it (the corpse guard, `7a32f3d`). So the marks outlive their
// effect by up to `TRAIL.durationMs`. Projectiles of a dead fighter DO keep landing — the two
// "things a dead fighter left in the world" follow opposite rules. Invisible at N=2 (Donut's death
// ends the duel); expresses from N=3.
//
// Arms: ALIVE — Donut lays track, steps off, a walker crosses the fresh marks. DEAD — identical,
// but Donut is killed (real hits) before the walker crosses.
//
// Usage: node tools/tmp/bh_combat_deadtrail.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const SMASH = weaponIndex(S, 'hamburger', 'Smash');

function run(killDonut) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'donut', x: 600, y: 1000 },
    { characterId: 'hamburger', x: 600, y: 1300, facing: { x: 0, y: -1 } },   // killer
    { characterId: 'soup', x: 750, y: 700 },                                   // walker
  ]);
  const D = st.fighters[0], K = st.fighters[1], W = st.fighters[2];
  // Donut lays ~600 ms of track east.
  for (let t = 0; t < 600; t += DT) S.sim.stepMatch(st, DT, [input({ move: { x: 1, y: 0 } }), null, null]);
  // Donut steps south off its own track.
  for (let t = 0; t < 400; t += DT) S.sim.stepMatch(st, DT, [input({ move: { x: 0, y: 1 } }), null, null]);
  if (killDonut) {
    D.hp = 5;
    K.x = D.x; K.y = D.y + 40; K.facing = { x: 0, y: -1 };
    for (let t = 0; t < 300 && D.alive; t += DT) S.sim.stepMatch(st, DT, [null, input({ aim: { x: 0, y: -1 }, weapon: SMASH, attack: true }), null]);
  }
  const marks = st.trailMarks.filter((m) => m.ownerId === 0);
  const liveMarks = marks.filter((m) => st.elapsed < m.expiresAt).length;
  // Walker crosses the track north->south along x = middle of the track.
  const mid = marks[Math.floor(marks.length / 2)];
  W.x = mid.x; W.y = mid.y - 60;
  let trailHits = 0;
  for (let t = 0; t < 1200; t += DT) {
    const evs = S.sim.stepMatch(st, DT, [null, null, input({ move: { x: 0, y: 1 } })]);
    for (const e of evs) if (e.type === 'hit-landed' && e.targetId === 2 && e.source.kind === 'trail') trailHits++;
  }
  return { donutAlive: D.alive, marksOnFloorWhenWalkerStarts: liveMarks, trailHitsOnWalker: trailHits };
}

const alive = run(false), dead = run(true);
console.log('ALIVE owner:', JSON.stringify(alive));
console.log('DEAD  owner:', JSON.stringify(dead));
const nonVac = alive.trailHitsOnWalker > 0 && dead.marksOnFloorWhenWalkerStarts > 0 && !dead.donutAlive;
console.log(`NON-VACUITY (the crossing is damaging when Donut lives; marks are still on the floor when it is dead): ${nonVac}`);
console.log(dead.trailHitsOnWalker === 0 ? 'VERDICT: a dead owner\'s visible trail is harmless.' : 'VERDICT: the trail keeps biting after its owner dies.');
process.exit(nonVac ? 0 : 2);
