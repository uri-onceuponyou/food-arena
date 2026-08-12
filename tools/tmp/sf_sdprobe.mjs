#!/usr/bin/env node
/** sf_sdprobe — how many ticks does `buildSuddenDeathState` actually need on this schedule? */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { makeFixtureArena, fixtureConfigs, stimulus } from './nw_fixture.mjs';
import { SUDDEN_DEATH_MS, MATCH_DURATION_MS } from '../../src/game/rules.ts';

const ARENA = makeFixtureArena();
const DT = 1000 / 60;
for (const n of [2, 6]) {
  const t0 = Date.now();
  const state = createMatch(ARENA, fixtureConfigs(ARENA, n, { humans: 1 }));
  let armedAt = -1;
  let countdownTicks = -1;
  for (let t = 0; t < 20000; t++) {
    const inputs = [];
    for (let s = 0; s < n; s++) inputs.push(s < 1 ? stimulus(4242, t, s) : null);
    stepMatch(state, DT, inputs);
    for (const f of state.fighters) { f.hp = f.maxHp; f.alive = true; }
    if (countdownTicks < 0 && state.phase === 'playing') countdownTicks = t;
    if (armedAt < 0 && state.phase === 'playing' && state.safeRadius === 0) { armedAt = t; break; }
    if (state.phase === 'ended') { console.log(`  N=${n} ENDED at tick ${t}`); break; }
  }
  console.log(`N=${n}: countdown ends tick ${countdownTicks} (${(countdownTicks * DT).toFixed(0)}ms), safeRadius 0 at tick ${armedAt}`
    + ` (elapsed ${state.elapsed.toFixed(0)}ms, play ${(MATCH_DURATION_MS - state.timeRemaining).toFixed(0)}ms vs SUDDEN_DEATH_MS ${SUDDEN_DEATH_MS})`
    + `  [${Date.now() - t0}ms]`);
}
