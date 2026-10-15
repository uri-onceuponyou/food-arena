#!/usr/bin/env node
// bh_combat_loopdt — real AI matches stepped with the dt the SHIPPED loop produces, counting
// projectiles that fly THROUGH a fighter's hit disc inside one step and keep going (a "tunnel":
// visibly passing through a body, no hit).
//
// The dt model is `match.ts:GameSession.loop`, transcribed (grep `Hit-stop dt accounting`):
//   raw = min(frame, 50 ms); if budget > 0: budget -= raw; step = raw * 0.05; banked += raw - step
//   elif banked > 0: catch = min(banked, raw * 3); banked -= catch; step = raw + catch
//   else step = raw
// and hit-stop is armed from the same events `handleEvents` arms it from: every WEAPON
// `hit-landed` -> clamp(10 + amount * 4.6, 16, 105); every `death` -> 90; a giant slam -> 120.
// (The `simSpeed` QA override is 1 in shipped play.)
//
// Usage: node tools/tmp/bh_combat_loopdt.mjs [--fps 60] [--n 6] [--matches 12] [--root <tree>]
import { loadSim, kitchenArena, argv } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const arena = kitchenArena();
const FPS = Number(argv('fps', 60));
const N = Number(argv('n', 6));
const MATCHES = Number(argv('matches', 12));
const RAW = Math.min(1000 / FPS, 50);
const ids = S.rules.CHARACTER_IDS;
const segDist = (ax, ay, bx, by, px, py) => {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2)) : 0;
  return Math.hypot(ax + t * vx - px, ay + t * vy - py);
};

let steps = 0, bigSteps = 0, simMs = 0, bigMs = 0, maxStep = 0, projSteps = 0, tunnels = 0, hits = 0;
for (let m = 0; m < MATCHES; m++) {
  const roster = Array.from({ length: N }, (_, i) => ids[(m * 5 + i * 3) % ids.length]);
  if (new Set(roster).size < N) { roster.splice(0, roster.length, ...ids.slice(m % 5, m % 5 + N)); }
  const st = S.sim.createMatch(arena, roster.map((c, i) => ({ characterId: c, controller: 'ai', spawn: N === 2 ? undefined : { ...arena.spawns[i] } })));
  let budget = 0, banked = 0;
  const inputs = new Array(N).fill(null);
  while (st.phase !== 'ended' && st.elapsed < 250000) {
    let step;
    if (budget > 0) { budget = Math.max(0, budget - RAW); step = RAW * 0.05; banked += RAW - step; }
    else if (banked > 0) { const c = Math.min(banked, RAW * 3); banked -= c; step = RAW + c; }
    else step = RAW;
    const prev = new Map(st.projectiles.filter((p) => !p.arrived).map((p) => [p.id, [p.x, p.y]]));
    const evs = S.sim.stepMatch(st, step, inputs);
    steps++; simMs += step; maxStep = Math.max(maxStep, step);
    if (step > 50) { bigSteps++; bigMs += step; }
    const hitThisStep = new Set();
    for (const e of evs) {
      if (e.type === 'hit-landed' && e.source.kind === 'weapon' && !e.source.itemId) { budget = Math.max(budget, Math.min(105, Math.max(16, 10 + e.amount * 4.6))); hits++; }
      if (e.type === 'death') budget = Math.max(budget, 90);
      if (e.type === 'weapon-fired' && S.rules.CHARACTERS[st.fighters[e.fighterId].characterId].weapons.find((w) => w.key === e.weaponKey)?.giantSlam) budget = Math.max(budget, 120);
    }
    for (const p of st.projectiles) {
      const a = prev.get(p.id);
      if (!a || p.arrived) continue;
      projSteps++;
      const owner = st.fighters[p.ownerId];
      for (const f of st.fighters) {
        if (f === owner || !f.alive || f.hp <= 0) continue;
        const r = f.hitRadius;
        if (Math.hypot(a[0] - f.x, a[1] - f.y) < r || Math.hypot(p.x - f.x, p.y - f.y) < r) continue;
        if (segDist(a[0], a[1], p.x, p.y, f.x, f.y) < r) { tunnels++; break; }
      }
    }
  }
}
console.log(JSON.stringify({
  fps: FPS, n: N, matches: MATCHES, simSteps: steps,
  stepsOver50ms: bigSteps, shareOfSimTimeInStepsOver50ms: +(bigMs / simMs).toFixed(4), maxStepMs: +maxStep.toFixed(1),
  weaponHits: hits, projectileSteps: projSteps, tunnelsThroughALivingBody: tunnels,
}));
