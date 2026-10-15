#!/usr/bin/env node
// bh_combat_tunnel — does a projectile pass THROUGH a fighter without hitting it when the sim is
// stepped with the dt the shipped loop actually feeds it?
//
// sim.ts:projectileVictim tests the projectile's END position each step (point vs `hitRadius`),
// no swept segment. That is exact at the 16.67 ms every test uses. But `match.ts:GameSession.loop`
// clamps a frame to 50 ms and then, after every hit-stop (every weapon hit anywhere on the map
// triggers 16-105 ms of it), REPAYS banked time at up to `HITSTOP_CATCHUP_RATE` (3) extra frames per
// frame: `stepDtMs = rawDtMs + min(banked, rawDtMs * 3)` — so a step is up to 4x a frame:
// 66.7 ms at 60 fps, 200 ms at 20 fps.
//
// Sweep: a stationary target at distance d (70..110 wu, 0.5 wu grid, i.e. every start phase) and
// lateral offset h (0..25 wu, 1 wu grid), shooter fires one straight shot due east. A cell is a
// TUNNEL when the shot's straight path crosses the target's hit disc inside the weapon's range but
// no hit lands. Reported per dt.
//
// Usage: node tools/tmp/bh_combat_tunnel.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const SHOTS = [['lollipop', 'Stick'], ['hotdog', 'Mustard'], ['sushi', 'Rice']];
const DTS = [16.667, 33.333, 66.667, 100, 200];
const calls = { n: 0 };

function cell(char, key, d, h, dt) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: char, x: 1000, y: 1000, facing: { x: 1, y: 0 } },
    { characterId: 'pizza', x: 1000 + d, y: 1000 + h },
    { characterId: 'soup', x: 1900, y: 1900 },   // N=3 so a single death would not end the match
  ]);
  const wi = weaponIndex(S, char, key);
  let hit = false; calls.n++;
  for (let k = 0; k < 40 && !hit; k++) {
    const evs = S.sim.stepMatch(st, dt, [input({ aim: { x: 1, y: 0 }, weapon: wi, attack: k === 0 }), null, null]);
    for (const e of evs) if (e.type === 'hit-landed' && e.targetId === 1) hit = true;
    if (k > 0 && st.projectiles.length === 0) break;
  }
  return hit;
}

for (const [char, key] of SHOTS) {
  const w = S.rules.CHARACTERS[char].weapons[weaponIndex(S, char, key)];
  const r = S.rules.HIT_RADIUS_VS_PLAYER;
  const row = [];
  for (const dt of DTS) {
    let crossing = 0, tunnels = 0;
    for (let d = 70; d <= 110; d += 0.5) for (let h = 0; h < 25; h += 1) {
      // Geometric truth: the straight path y=0 crosses the disc iff |h| < r, entering at d - c.
      const c = Math.sqrt(r * r - h * h);
      // the disc must be entered at least one 60 fps step BEFORE the range runs out, so a cell
      // is never counted as a crossing on the range boundary's own quantisation
      if (d - c >= w.range - w.speed * 16.667 / 1000) continue;
      if (w.pellets && w.pellets > 1 && h > 0) {} // centre pellet is on axis; others fan away
      crossing++;
      if (!cell(char, key, d, h, dt)) tunnels++;
    }
    row.push(`dt ${dt.toFixed(1).padStart(5)} ms: step ${(w.speed * dt / 1000).toFixed(1).padStart(5)} wu -> ${tunnels}/${crossing} crossings MISSED (${(100 * tunnels / crossing).toFixed(1)}%)`);
  }
  console.log(`${char}.${key} speed ${w.speed} range ${w.range} hitRadius ${r}`);
  for (const l of row) console.log('   ' + l);
}

console.log(`cells simulated: ${calls.n}`);
