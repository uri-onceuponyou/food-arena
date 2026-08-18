#!/usr/bin/env node
/**
 * dd_probe — DOES A DEAD HUMAN STILL ACT AT SIX SEATS?
 *
 * A throwaway repro for Uri's report ("I continued to move as dead, able to fire and move").
 * Run on the PRE-FIX tree it must print CORPSE ACTED; on the fixed tree, CORPSE INERT.
 * The point of the file is that it is run BOTH ways — a repro that was never seen to
 * reproduce is not a repro (CLAUDE.md rule 6).
 *
 * 🚨 **THIS READS LIVE SOURCE, SO IT EXPIRES THE MOMENT THE BUG DOES** (`5bfcafe`). Post-fix
 * it prints the PASS side, which is not a reproduction. To see the defect, run it inside a
 * detached worktree of a pre-fix commit with `node_modules` symlinked.
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { applyDamage } from '../../src/game/combat.ts';

const arena = {
  id: 'dd', displayName: 'dd', width: 2800, height: 2000,
  center: { x: 1400, y: 1000 }, maxSafeRadius: 900,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 2600, y: 1800 },
  cover: [], hazards: [], build() { return {}; },
};

const N = Number(process.argv[2] ?? 6);
const ringSpawn = (i) => ({
  x: arena.center.x + 700 * Math.cos((i / N) * Math.PI * 2),
  y: arena.center.y + 700 * Math.sin((i / N) * Math.PI * 2),
});
const cfgs = Array.from({ length: N }, (_, i) => ({ characterId: 'hamburger', spawn: ringSpawn(i) }));
const state = createMatch(arena, cfgs);
state.phase = 'playing';

const me = state.fighters[0];
console.log(`seats=${N} controller[0]=${me.controller}`);

// Kill slot 0 outright, through the one HP path the sim has.
applyDamage(state, me, 9999, null, { kind: 'hazard' }, []);

console.log(`after death: alive=${me.alive} hp=${me.hp} phase=${state.phase} cast=${me.cast === null ? 'null' : 'OPEN'}`);
console.log(`living seats: ${state.fighters.filter((f) => f.alive).length}/${N}`);

if (state.phase !== 'playing') {
  console.log('NOT REACHABLE AT THIS SEAT COUNT — the match ended on the death, so nothing below can fire.');
  process.exit(0);
}

const before = { x: me.x, y: me.y, fx: me.facing.x, fy: me.facing.y };
// A maximal press: run hard, aim somewhere new, hold the trigger.
const input = { move: { x: 1, y: 1 }, aim: { x: -1, y: 0 }, selectedWeapon: 0, attack: true };
const events = stepMatch(state, 16.67, input);

const mine = events.filter((e) => e.fighterId === 0 || e.attackerId === 0);
const moved = me.x !== before.x || me.y !== before.y;
const turned = me.facing.x !== before.fx || me.facing.y !== before.fy;
const fired = events.some((e) => e.type === 'weapon-fired' && e.fighterId === 0);

console.log(`moved=${moved} (${before.x.toFixed(2)},${before.y.toFixed(2)} -> ${me.x.toFixed(2)},${me.y.toFixed(2)})`);
console.log(`turned=${turned} (${before.fx.toFixed(3)},${before.fy.toFixed(3)} -> ${me.facing.x.toFixed(3)},${me.facing.y.toFixed(3)})`);
console.log(`fired=${fired}  events from slot 0: ${JSON.stringify(mine.map((e) => e.type))}`);
console.log(moved || turned || fired ? '>>> CORPSE ACTED' : '>>> CORPSE INERT');

// ── TERMINATOR 3, VERIFIED RATHER THAN ASSUMED ───────────────────────────────
// The guard about to be added sits BELOW `resolveDueCast`, which is only defensible if a
// corpse can never be holding a wind-up for it to resolve. `combat.ts`'s terminator 3
// claims exactly that. This arm kills a caster MID-CAST and reads the record back.
{
  const st = createMatch(arena, Array.from({ length: 6 }, (_, i) => (
    { characterId: 'waterbottle', spawn: ringSpawn(i) })));
  st.phase = 'playing';
  const caster = st.fighters[0];
  stepMatch(st, 16.67, { move: { x: 0, y: 0 }, selectedWeapon: 3, attack: true });
  const openedAt = caster.cast;
  applyDamage(st, caster, 9999, null, { kind: 'hazard' }, []);
  console.log(`\nterminator 3: cast opened=${openedAt !== null} -> after death cast=${caster.cast === null ? 'null' : 'STILL OPEN'} alive=${caster.alive} phase=${st.phase}`);
}
