#!/usr/bin/env node
/**
 * dd_bitid — THE CONTROL FOR THE CORPSE GUARD.
 *
 * Adding `if (!fighter.alive) continue;` to the fighter loop must change EXACTLY ONE
 * thing: what a dead HUMAN seat does with live input. Everything else — every AI seat,
 * alive or dead, and a human seat that is pressing nothing — must come out bit-identical,
 * because `stepAI` already refuses on `self.hp <= 0` and `applyWorldTick` already returns
 * on `!fighter.alive`, so the guard skips two established no-ops on those paths.
 *
 * Three arms, all six seats, all with a real corpse in them:
 *
 *   A  every seat AI            MUST HOLD    (stepAI already refused)
 *   B  human slot 0, NEUTRAL    MUST HOLD    (nothing pressed, so nothing to refuse)
 *   C  human slot 0, LIVE       MUST MOVE    (this is the defect)
 *
 * A and B are the HOLDS, C is the MOVES. An arm that holds because it never had a corpse
 * in it holds vacuously, so every arm reports its own death count and post-death tick
 * count and the runner refuses a run where either is zero.
 *
 *   node tools/tmp/dd_bitid.mjs --out tools/tmp/dd_before.json
 *   node tools/tmp/dd_bitid.mjs --diff tools/tmp/dd_before.json
 *
 * 🚨 **THIS READS LIVE SOURCE, SO IT EXPIRES THE MOMENT THE BUG DOES** (`5bfcafe`). Post-fix
 * it prints the PASS side, which is not a reproduction. To see the defect, run it inside a
 * detached worktree of a pre-fix commit with `node_modules` symlinked.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { applyDamage } from '../../src/game/combat.ts';

const argv = process.argv.slice(2);
const outPath = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const diffPath = argv.includes('--diff') ? argv[argv.indexOf('--diff') + 1] : null;

const N = 6;
const TICKS = 900;          // 15 s at 60 Hz — well past the kill tick
const KILL_TICK = 60;       // 1 s in, so every arm carries a corpse for 840 ticks
const DT = 16.67;

const arena = {
  id: 'dd', displayName: 'dd', width: 2800, height: 2000,
  center: { x: 1400, y: 1000 }, maxSafeRadius: 900,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 2600, y: 1800 },
  cover: [], hazards: [], build() { return {}; },
};
const ringSpawn = (i) => ({
  x: arena.center.x + 700 * Math.cos((i / N) * Math.PI * 2),
  y: arena.center.y + 700 * Math.sin((i / N) * Math.PI * 2),
});

/** Everything a tick can legally change, in a stable order. */
function digestTick(state, events) {
  const f = state.fighters.map((x) => [
    x.id, x.x, x.y, x.hp, x.alive ? 1 : 0, x.facing.x, x.facing.y, x.deaths,
    x.cast === null ? 'n' : `${x.cast.weaponIndex}@${x.cast.resolvesAt}`,
    x.terrainSlowFactor, x.concealed ? 1 : 0,
  ]);
  const p = state.projectiles.map((x) => [x.id, x.x, x.y, x.vx, x.vy, x.damage, x.ownerId]);
  const s = state.sightings.map((x) => [x.x, x.y, x.at]);
  return JSON.stringify([state.phase, state.elapsed, state.timeRemaining, state.safeRadius,
    state.winnerId ?? null, f, p, s, state.trailMarks.length, events]);
}

function runArm(name, { controller, live }) {
  const state = createMatch(arena, Array.from({ length: N }, (_, i) => ({
    characterId: 'hamburger', spawn: ringSpawn(i), controller: i === 0 ? controller : 'ai',
  })));
  state.phase = 'playing';
  const h = createHash('sha256');
  let postDeathPlayingTicks = 0;
  let deaths = 0;
  for (let t = 0; t < TICKS; t++) {
    if (t === KILL_TICK) applyDamage(state, state.fighters[0], 9999, null, { kind: 'hazard' }, []);
    // A LIVE press: run hard, sweep the aim, hold the trigger. Deliberately constant —
    // the question is whether a corpse obeys it, not whether the script is clever.
    const input = live
      ? { move: { x: 1, y: 1 }, aim: { x: Math.cos(t / 30), y: Math.sin(t / 30) }, selectedWeapon: t % 4, attack: true }
      : { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    const events = stepMatch(state, DT, input);
    h.update(digestTick(state, events));
    if (t > KILL_TICK && state.phase === 'playing') postDeathPlayingTicks++;
  }
  deaths = state.fighters.filter((f) => !f.alive).length;
  return {
    name, sha: h.digest('hex'), deaths, postDeathPlayingTicks,
    slot0: { alive: state.fighters[0].alive, x: state.fighters[0].x, y: state.fighters[0].y },
    finalPhase: state.phase,
  };
}

const arms = [
  runArm('A  every seat AI (HOLD)', { controller: 'ai', live: false }),
  runArm('B  human slot 0, NEUTRAL input (HOLD)', { controller: 'human', live: false }),
  runArm('C  human slot 0, LIVE input (MOVE)', { controller: 'human', live: true }),
];

let bad = 0;
for (const a of arms) {
  console.log(`${a.name}\n    sha ${a.sha}\n    deaths ${a.deaths}/${N} · post-death playing ticks ${a.postDeathPlayingTicks} · slot0 alive=${a.slot0.alive} at ${a.slot0.x.toFixed(2)},${a.slot0.y.toFixed(2)} · final phase ${a.finalPhase}`);
  // NON-VACUITY FIRST. An arm with no corpse, or one whose match ended on the death,
  // holds for a reason that has nothing to do with the guard under test.
  if (a.deaths === 0) { console.log('    ✗ VACUOUS: no corpse in this arm'); bad++; }
  if (a.postDeathPlayingTicks === 0) { console.log('    ✗ VACUOUS: no playing tick after the death'); bad++; }
}

if (outPath) { writeFileSync(outPath, JSON.stringify(arms, null, 2)); console.log(`\nwrote ${outPath}`); }

if (diffPath) {
  const before = JSON.parse(readFileSync(diffPath, 'utf8'));
  console.log('\n── against the baseline ──');
  const want = ['HOLD', 'HOLD', 'MOVE'];
  arms.forEach((a, i) => {
    const same = before[i].sha === a.sha;
    const got = same ? 'HOLD' : 'MOVE';
    const verdict = got === want[i] ? 'PASS' : 'FAIL';
    if (verdict === 'FAIL') bad++;
    console.log(`  ${verdict}  ${a.name} — want ${want[i]}, got ${got}`);
    if (!same) console.log(`         slot0 ended ${before[i].slot0.x.toFixed(2)},${before[i].slot0.y.toFixed(2)} -> ${a.slot0.x.toFixed(2)},${a.slot0.y.toFixed(2)}`);
  });
}

console.log(bad === 0 ? '\nOK' : `\n${bad} FAULT(S)`);
process.exit(bad === 0 ? 0 : 1);
