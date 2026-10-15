#!/usr/bin/env node
/**
 * BH_INPUT_ITEMSIM — the SIM half of "the item press never reaches the sim" (review phase,
 * 2026-10-15). Pure Node against the real `src/game/sim.ts`; no browser, no RNG in the sim.
 *
 * Shows the break is exactly one hop: the sim ACCEPTS `MatchInput.useItem`, and the input
 * object `match.ts:buildInput()` builds at HEAD — `{ move, aim, selectedWeapon, attack }` —
 * cannot carry it. Arms:
 *   A  N=2  HEAD's input shape after a Q press (no `useItem` key)  -> lastUsed unchanged
 *   B  N=2  the same tick with `useItem: 0` added                   -> lastUsed stamped, event
 *   C  N=2  Disposal (minAlive 3) with `useItem: 0`                 -> refused (needs 3)
 *   D  N=6  Disposal with `useItem: 0`                              -> accepted
 * A and B differ ONLY in the one field; C and D differ only in the seat count, which is the
 * control that keeps D from passing vacuously at two seats.
 *
 *   node tools/tmp/bh_input_itemsim.mjs
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';

function makeArena(width = 2800, height = 2000) {
  return {
    id: 'bh-fixture', displayName: 'bh fixture', width, height,
    center: { x: width / 2, y: height / 2 }, maxSafeRadius: 1720,
    playerSpawn: { x: 400, y: 400 }, enemySpawn: { x: width - 400, y: height - 400 },
    cover: [], hazards: [], build() { return {}; },
  };
}
// Six seats on a wide ring, far apart, so nobody is in weapon range during the test ticks.
const RING = [[400, 400], [2400, 1600], [2400, 400], [400, 1600], [1400, 300], [1400, 1700]];
const IDS = ['hamburger', 'donut', 'taco', 'pizza', 'sushi', 'egg'];

function match(n, items) {
  const cfgs = IDS.slice(0, n).map((characterId, i) => ({
    characterId, spawn: { x: RING[i][0], y: RING[i][1] }, ...(i === 0 ? { items } : {}),
  }));
  const s = createMatch(makeArena(), cfgs);
  s.phase = 'playing';
  return s;
}
const me = (s) => s.fighters[0];
const HEAD_SHAPE = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: false };
let fails = 0;
function row(name, pass, detail) {
  if (!pass) fails++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}  — ${detail}`);
}
function tick(s, input, dt = 16) {
  // Warm one tick with NO press, so elapsed > 0 before the measured tick. (The first cut
  // warmed with the measured input itself, spent the item on the warm tick, and then read the
  // cooldown refusal on the measured one as "not accepted" — a probe measuring its own setup.)
  stepMatch(s, dt, HEAD_SHAPE);
  const before = me(s).item.lastUsed.slice();
  const ev = stepMatch(s, dt, input);
  const after = me(s).item.lastUsed.slice();
  const types = [...new Set(ev.filter((e) => e.fighterId === 0 || e.ownerId === 0 || e.casterId === 0).map((e) => e.type))];
  return { before, after, elapsed: s.elapsed, types, allTypes: [...new Set(ev.map((e) => e.type))] };
}

console.log('\nbh_input_itemsim — does the sim accept an item press, and does HEAD\'s input shape carry one?');
{
  const s = match(2, ['springform', 'warm_milk']);
  const r = tick(s, HEAD_SHAPE);
  row('A  N=2 HEAD input shape (Q pressed, but no useItem key exists) leaves item slot 0 unused',
    r.after[0] === r.before[0], `lastUsed[0] ${r.before[0]} -> ${r.after[0]}, events ${JSON.stringify(r.allTypes)}`);
}
{
  const s = match(2, ['springform', 'warm_milk']);
  const r = tick(s, { ...HEAD_SHAPE, useItem: 0 });
  row('B  N=2 the same input + useItem: 0 is ACCEPTED by the sim (lastUsed stamped)',
    r.after[0] !== r.before[0] && Number.isFinite(r.after[0]) && Math.abs(r.after[0] - r.elapsed) <= 16,
    `lastUsed[0] ${r.before[0]} -> ${r.after[0]} at elapsed ${r.elapsed}, events ${JSON.stringify(r.allTypes)}`);
}
{
  const s = match(2, ['disposal']);
  const r = tick(s, { ...HEAD_SHAPE, useItem: 0 });
  row('C  N=2 Disposal (minAlive 3) is REFUSED at two seats (control for D)',
    r.after[0] === r.before[0], `lastUsed[0] ${r.before[0]} -> ${r.after[0]}`);
}
{
  const s = match(6, ['disposal']);
  const r = tick(s, { ...HEAD_SHAPE, useItem: 0 });
  row('D  N=6 Disposal is ACCEPTED at six seats',
    r.after[0] !== r.before[0], `lastUsed[0] ${r.before[0]} -> ${r.after[0]}, events ${JSON.stringify(r.allTypes)}`);
}
console.log(`\n${fails === 0 ? 'all rows as expected' : `${fails} row(s) differ from expectation`}`);
process.exit(fails === 0 ? 0 : 1);
