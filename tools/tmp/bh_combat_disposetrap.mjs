#!/usr/bin/env node
// bh_combat_disposetrap — can DISPOSAL itself drop a victim into a spot `placeFighterAt` cannot
// depenetrate (a fighter frozen inside cover forever)?
//
// combat.ts:resolveItem 'disposal' places the victim at  dest + dropDistance * unit(victimOld - dest).
// For every 5 wu grid point P that `placeFighterAt` leaves inside cover AND that walking cannot
// free (bh_combat_placegrid), search for a LEGAL configuration that drops the victim exactly
// there: a standable dest D on the 84 wu circle around P, and a standable old victim position V
// further along the ray D->P. At N=3 the dest is the only non-thrower candidate, so it is the
// nearest by construction; the thrower just has to stand within ITEM_THROW_RANGE of V with V its
// nearest opponent. Then REPLAYS the best candidate through the real sim (createMatch at N=3,
// thrower presses Disposal) and checks the victim is frozen: it presses every direction for 3 s.
// Usage: node tools/tmp/bh_combat_disposetrap.mjs [--root <tree>] [--step 5]
import { loadSim, kitchenArena, argv, input, DT } from './bh_combat_lib.mjs';
const S = await loadSim(argv('root', undefined));
const arena = kitchenArena();
const STEP = Number(argv('step', 5));
const size = S.rules.PLAYER_SIZE;
const half = size / 2;
const D_DROP = S.rules.ITEM_TUNING.disposal.dropDistance;
const RANGE = S.rules.GUARANTEED_VISIBLE_RADIUS;
const inCover = (x, y) => arena.cover.some((o) => S.movement.boxesOverlap(x, y, size, size, o.x, o.y, o.w, o.h));
const legal = (x, y) => x >= half && y >= half && x <= arena.width - half && y <= arena.height - half && !inCover(x, y);
const stuckAfter = (x, y) => {
  const f = { x: 0, y: 0, size, push: { x: 0, y: 0, remaining: 0, speed: 0 } };
  S.movement.placeFighterAt(f, x, y, arena);
  if (!inCover(f.x, f.y)) return false;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const g = { ...f, push: { ...f.push } };
    for (let k = 0; k < 40; k++) S.movement.tryMove(g, dx * 1.5, dy * 1.5, arena);
    if (!inCover(g.x, g.y)) return false;
  }
  return true;
};
const found = [];
for (let px = 0; px <= arena.width; px += STEP) for (let py = 0; py <= arena.height; py += STEP) {
  if (!stuckAfter(px, py)) continue;
  for (let a = 0; a < 72; a++) {
    const ang = (a * Math.PI) / 36;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const Dx = px - dx * D_DROP, Dy = py - dy * D_DROP;   // dest so that P = D + 84*dir
    if (!legal(Dx, Dy)) continue;
    for (let t = 120; t <= 600; t += 20) {
      const Vx = Dx + dx * t, Vy = Dy + dy * t;
      if (!legal(Vx, Vy)) continue;
      // thrower: stand 100 wu from V on the side away from D, must be legal
      const Tx = Vx + dx * 100, Ty = Vy + dy * 100;
      if (!legal(Tx, Ty)) continue;
      found.push({ P: [px, py], D: [+Dx.toFixed(2), +Dy.toFixed(2)], V: [+Vx.toFixed(2), +Vy.toFixed(2)], T: [+Tx.toFixed(2), +Ty.toFixed(2)] });
      break;
    }
    if (found.length && found[found.length - 1].P[0] === px && found[found.length - 1].P[1] === py) break;
  }
}
console.log(`stuck drop points reachable by a legal 3-fighter Disposal: ${found.length}`);
for (const f of found.slice(0, 5)) console.log('  ', JSON.stringify(f));
// Replay through the REAL sim: 20 trap configurations (spread over the list, so not only the
// west-wall line) and 20 CONTROL configurations whose drop point is open floor.
function replay(T, V, D) {
  const st = S.sim.createMatch(arena, [
    { characterId: 'hamburger', controller: 'human', spawn: { x: T[0], y: T[1] }, facing: { x: 1, y: 0 }, items: ['disposal'] },
    { characterId: 'pizza', controller: 'human', spawn: { x: V[0], y: V[1] } },
    { characterId: 'soup', controller: 'human', spawn: { x: D[0], y: D[1] } },
  ]);
  st.phase = 'playing';
  const evs = S.sim.stepMatch(st, DT, [input({ useItem: 0 }), null, null]);
  const hit = evs.find((e) => e.type === 'item-hit' && e.itemId === 'disposal');
  const Vf = st.fighters[1];
  const at = [Vf.x, Vf.y];
  let moved = false;
  for (const mv of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
    for (let k = 0; k < 30; k++) S.sim.stepMatch(st, DT, [null, input({ move: { x: mv[0], y: mv[1] } }), null]);
    if (Math.hypot(Vf.x - at[0], Vf.y - at[1]) > 1) { moved = true; break; }
  }
  return { hit: !!hit, at, insideCover: inCover(at[0], at[1]), moved };
}
let frozen = 0, n = 0;
const stride = Math.max(1, Math.floor(found.length / 20));
for (let i = 0; i < found.length && n < 20; i += stride, n++) {
  const f = found[i];
  const r = replay(f.T, f.V, f.D);
  if (r.hit && !r.moved) frozen++;
  if (n < 3) console.log(`trap replay: D=${f.D} V=${f.V} -> victim at (${r.at[0].toFixed(1)},${r.at[1].toFixed(1)}) insideCover=${r.insideCover} canMove=${r.moved}`);
}
console.log(`TRAP arm: ${frozen} of ${n} replays leave the victim frozen inside cover`);
// CONTROL: random legal configurations whose drop point is open floor.
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let ctl = 0, ctlMoved = 0;
while (ctl < 20) {
  const Dx = half + rnd() * (arena.width - size), Dy = half + rnd() * (arena.height - size);
  const a = rnd() * 2 * Math.PI;
  const Px = Dx + Math.cos(a) * D_DROP, Py = Dy + Math.sin(a) * D_DROP;
  const Vx = Dx + Math.cos(a) * 300, Vy = Dy + Math.sin(a) * 300;
  const Tx = Vx + Math.cos(a) * 100, Ty = Vy + Math.sin(a) * 100;
  if (![[Dx, Dy], [Px, Py], [Vx, Vy], [Tx, Ty]].every(([x, y]) => legal(x, y))) continue;
  ctl++;
  const r = replay([Tx, Ty], [Vx, Vy], [Dx, Dy]);
  if (r.hit && r.moved) ctlMoved++;
}
console.log(`CONTROL arm: ${ctlMoved} of ${ctl} open-floor drops leave the victim able to move`);
