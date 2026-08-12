#!/usr/bin/env node
/**
 * sf_hpprobe — WHEN DOES `hp` FIRST MOVE in the nw_delta corpus, and why did it stop?
 *
 * Scratch probe for the `nw_delta` D2a vacuity (`0 hp ops suppressed`). Reports, per tick,
 * the first tick any fighter's hp changes, split by CAUSE (fog vs weapon), so the fix is
 * chosen from a measurement rather than by lengthening the window until it goes green.
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { makeFixtureArena, fixtureConfigs, stimulus } from './nw_fixture.mjs';
import { FOG_HOLD_MS, FOG_CLOSE_MS, SUDDEN_DEATH_MS, MATCH_DURATION_MS, minSafeRadiusFor } from '../../src/game/rules.ts';

const ARENA = makeFixtureArena();
const DT = 1000 / 60;
const N = Number(process.argv[2] ?? 6);
const TICKS = Number(process.argv[3] ?? 12000);

const state = createMatch(ARENA, fixtureConfigs(ARENA, N, { humans: N }));
let prev = state.fighters.map((f) => f.hp);
let firstChange = -1;
let changes = 0;
let firstFog = -1;
const marks = [];
for (let t = 1; t <= TICKS; t++) {
  const inputs = [];
  for (let s = 0; s < N; s++) inputs.push(stimulus(909, t, s));
  const ev = stepMatch(state, DT, inputs);
  const now = state.fighters.map((f) => f.hp);
  const moved = now.some((h, i) => h !== prev[i]);
  if (moved) {
    changes++;
    if (firstChange < 0) {
      firstChange = t;
      marks.push(`first hp change tick ${t} (elapsed ${state.elapsed.toFixed(0)}ms, play ${(MATCH_DURATION_MS - state.timeRemaining).toFixed(0)}ms, safeR ${state.safeRadius.toFixed(1)})`);
    }
  }
  if (firstFog < 0 && ev.some((e) => e.type === 'fog-damage' || e.type === 'zone-damage')) firstFog = t;
  prev = now;
  if (state.phase === 'ended') { marks.push(`ENDED at tick ${t}`); break; }
}
console.log(`N=${N}  ticks run ${Math.min(TICKS, state.elapsed / DT).toFixed(0)}  phase ${state.phase}`);
console.log(`  FOG_HOLD_MS ${FOG_HOLD_MS} -> tick ${Math.round((FOG_HOLD_MS + 3717) / DT)} (play+countdown)`);
console.log(`  FOG_CLOSE_MS ${FOG_CLOSE_MS}  SUDDEN_DEATH_MS ${SUDDEN_DEATH_MS}  floor(${N}) ${minSafeRadiusFor(N).toFixed(2)}`);
console.log(`  ticks with an hp change: ${changes};  first ${firstChange}`);
console.log(`  final safeRadius ${state.safeRadius.toFixed(1)}  elapsed ${state.elapsed.toFixed(0)}ms`);
console.log(`  fighter dist from centre: ${state.fighters.map((f) => Math.hypot(f.x - ARENA.center.x, f.y - ARENA.center.y).toFixed(0)).join(', ')}`);
for (const m of marks) console.log(`  ${m}`);
