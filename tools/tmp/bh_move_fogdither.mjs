#!/usr/bin/env node
/**
 * BH_MOVE_FOGDITHER — how much fog does a fighter who DITHERS across the ring edge take?
 * Review-phase probe (2026-10-15). READ-ONLY; imports `--src-root` (default: the clean
 * worktree of HEAD). `sim.ts:applyWorldTick` resets `fogTimer` to 0 on every tick inside the
 * ring, so each excursion's first FOG_TICK_MS is free. Seat 0 (human) is parked on the N=2
 * floor ring (140 wu) at play-clock 121 s and steps OUT for `out` ms then IN for one tick,
 * repeatedly, for 10 s. CONTROL: the same fighter parked outside continuously.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const REPO = resolve(new URL('../..', import.meta.url).pathname);
const SRC_ROOT = existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO;
const { createMatch, stepMatch } = await import(`${SRC_ROOT}/src/game/sim.ts`);
const R = await import(`${SRC_ROOT}/src/game/rules.ts`);
const ARENA = { ...JSON.parse(readFileSync(`${SRC_ROOT}/tools/arena.gameplay.json`, 'utf8')), build: () => null, update: () => {} };
const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
const DT = 1000 / 60;
function run(outMs) {
  // Seat 0 due north of the pot centre, just inside the 140 floor; seat 1 far away.
  const c = ARENA.center;
  const st = createMatch(ARENA, [
    { characterId: 'hotdog', controller: 'human', maxHp: 1e7, spawn: { x: c.x, y: c.y - 139 } },
    { characterId: 'egg', controller: 'human', maxHp: 1e7, spawn: { x: c.x, y: c.y + 139 } },
  ]);
  let g = 0; while (st.phase !== 'playing' && g++ < 1e5) stepMatch(st, DT, [NEUTRAL, NEUTRAL]);
  while (R.MATCH_DURATION_MS - st.timeRemaining < 121_000) stepMatch(st, DT, [NEUTRAL, NEUTRAL]);
  const f = st.fighters[0];
  const hp0 = f.hp; let outside = 0, t = 0, phase = 0;
  const outward = { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false };
  const inward = { move: { x: 0, y: 1 }, selectedWeapon: 0, attack: false };
  while (t < 10_000) {
    const d = Math.hypot(f.x - c.x, f.y - c.y);
    let inp;
    if (outMs === Infinity) inp = d <= st.safeRadius + 3 ? outward : NEUTRAL;      // control: stay ~3 wu outside
    else if (d <= st.safeRadius) { inp = outward; phase = 0; }                     // inside: step out
    else { phase += DT; inp = phase >= outMs ? inward : NEUTRAL; }                 // outside: wait, then step in
    stepMatch(st, DT, [inp, NEUTRAL]);
    if (Math.hypot(f.x - c.x, f.y - c.y) > st.safeRadius) outside += DT;
    t += DT;
  }
  return { outMs, outsideShare: +(outside / t).toFixed(3), fogHpPerSecondOutside: +(((hp0 - f.hp) / outside) * 1000).toFixed(2) };
}
console.log(`src-root ${SRC_ROOT} · nominal fog ${(R.FOG_DAMAGE / R.FOG_TICK_MS) * 1000} HP/s outside`);
for (const o of [Infinity, 500, 280, 250, 200]) console.log(JSON.stringify(run(o)));
