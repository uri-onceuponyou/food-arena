#!/usr/bin/env node
// bh_combat_disposereal — replays ONE real six-seat AI match (every seat carries Disposal; the
// bots press it through ai.ts) on the shipped kitchen spawns and logs each Disposal that leaves its
// victim overlapping cover, then how long that victim stays put while alive.
// Usage: node tools/tmp/bh_combat_disposereal.mjs [--roster a,b,c,d,e,f] [--root <tree>]
import { loadSim, kitchenArena, argv } from './bh_combat_lib.mjs';
const S = await loadSim(argv('root', undefined));
const arena = kitchenArena();
const roster = String(argv('roster', 'pizza,sushi,waterbottle,taco,burrito,lollipop')).split(',');
const st = S.sim.createMatch(arena, roster.map((c, i) => ({ characterId: c, controller: 'ai', spawn: { ...arena.spawns[i] }, items: ['disposal'] })));
const inCover = (f) => arena.cover.filter((o) => S.movement.boxesOverlap(f.x, f.y, f.size, f.size, o.x, o.y, o.w, o.h));
const traps = [];
const DT = 16.667;
while (st.phase !== 'ended' && st.elapsed < 260000) {
  const evs = S.sim.stepMatch(st, DT, new Array(6).fill(null));
  for (const e of evs) if (e.type === 'item-hit' && e.itemId === 'disposal') {
    const v = st.fighters[e.targetId];
    const boxes = inCover(v);
    if (boxes.length) traps.push({ t: Math.round(st.elapsed), thrower: e.ownerId, victim: v.id, char: v.characterId, at: [+v.x.toFixed(1), +v.y.toFixed(1)], from: [+e.fromX.toFixed(1), +e.fromY.toFixed(1)], boxes: boxes.map((o) => `${o.kind}@${o.x},${o.y} ${o.w}x${o.h}`), x0: v.x, y0: v.y, stillUntil: st.elapsed, moved: false, diedAt: null });
  }
  for (const tr of traps) {
    const v = st.fighters[tr.victim];
    if (tr.moved || tr.diedAt !== null) continue;
    if (!v.alive) { tr.diedAt = Math.round(st.elapsed); continue; }
    if (Math.hypot(v.x - tr.x0, v.y - tr.y0) > 0.5) tr.moved = true; else tr.stillUntil = st.elapsed;
  }
}
for (const tr of traps) console.log(JSON.stringify({ t: tr.t, thrower: tr.thrower, victim: `${tr.victim}:${tr.char}`, droppedAt: tr.at, cameFrom: tr.from, insideBoxes: tr.boxes, frozenForMs: Math.round(tr.stillUntil - tr.t), thenMoved: tr.moved, diedAt: tr.diedAt }));
console.log(`match ended at ${Math.round(st.elapsed)} ms, winner ${st.winnerId}`);
