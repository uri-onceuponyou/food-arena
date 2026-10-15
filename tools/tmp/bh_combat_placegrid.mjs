#!/usr/bin/env node
// bh_combat_placegrid — can Disposal's `placeFighterAt` leave a fighter INSIDE cover on the
// shipped kitchen? Sweeps a 5 wu grid of destinations, places a PLAYER_SIZE fighter there through
// the real primitive, and reports any spot still overlapping a cover box afterwards; then tries
// to walk out (tryMove runs escapeCover again) to see whether it is merely deferred or stuck.
// Usage: node tools/tmp/bh_combat_placegrid.mjs [--root <tree>] [--step 5]
import { loadSim, kitchenArena, argv } from './bh_combat_lib.mjs';
const S = await loadSim(argv('root', undefined));
const arena = kitchenArena();
const STEP = Number(argv('step', 5));
const size = S.rules.PLAYER_SIZE;
const overlaps = (f) => arena.cover.some((o) => S.movement.boxesOverlap(f.x, f.y, size, size, o.x, o.y, o.w, o.h));
let tried = 0, inside = 0, stuckAfterWalk = 0;
const examples = [];
for (let x = 0; x <= arena.width; x += STEP) for (let y = 0; y <= arena.height; y += STEP) {
  const f = { x: 0, y: 0, size, push: { x: 0, y: 0, remaining: 0, speed: 0 } };
  S.movement.placeFighterAt(f, x, y, arena);
  tried++;
  if (!overlaps(f)) continue;
  inside++;
  let freed = false;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const g = { ...f, push: { ...f.push } };
    for (let k = 0; k < 60; k++) S.movement.tryMove(g, dx * 1.5, dy * 1.5, arena);
    if (!overlaps(g)) { freed = true; break; }
  }
  if (!freed) { stuckAfterWalk++; if (examples.length < 5) examples.push([x, y, +f.x.toFixed(1), +f.y.toFixed(1)]); }
}
console.log(JSON.stringify({ tried, leftInsideCover: inside, stillStuckAfterWalking: stuckAfterWalk, examples }));
// ── breakdown: which boxes trap, and do they touch the arena edge? ──
{
  const byBox = new Map();
  for (let x = 0; x <= arena.width; x += STEP) for (let y = 0; y <= arena.height; y += STEP) {
    const f = { x: 0, y: 0, size, push: { x: 0, y: 0, remaining: 0, speed: 0 } };
    S.movement.placeFighterAt(f, x, y, arena);
    const hit = arena.cover.filter((o) => S.movement.boxesOverlap(f.x, f.y, size, size, o.x, o.y, o.w, o.h));
    if (!hit.length) continue;
    const key = hit.map((o) => `${o.kind}@${o.x},${o.y}`).join('+');
    const edge = hit.some((o) => o.x - o.w / 2 <= 0 || o.y - o.h / 2 <= 0 || o.x + o.w / 2 >= arena.width || o.y + o.h / 2 >= arena.height);
    const e = byBox.get(key) ?? { n: 0, edge, sample: [x, y, +f.x.toFixed(1), +f.y.toFixed(1)] };
    e.n++; byBox.set(key, e);
  }
  const rows = [...byBox.entries()].sort((a, b) => b[1].n - a[1].n);
  console.log('trap sites:', rows.length, 'edge-touching:', rows.filter(([, v]) => v.edge).length, 'interior:', rows.filter(([, v]) => !v.edge).length);
  for (const [k, v] of rows.slice(0, 12)) console.log(`  ${v.n} pts  edge=${v.edge}  ${k}  e.g. dest(${v.sample[0]},${v.sample[1]})->(${v.sample[2]},${v.sample[3]})`);
  const interior = rows.filter(([, v]) => !v.edge);
  for (const [k, v] of interior.slice(0, 8)) console.log(`  INTERIOR ${v.n} pts ${k} e.g. dest(${v.sample[0]},${v.sample[1]})->(${v.sample[2]},${v.sample[3]})`);
}
