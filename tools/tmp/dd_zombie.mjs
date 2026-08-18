#!/usr/bin/env node
/**
 * dd_zombie — HOW FAR A PRE-FIX CORPSE COULD HEAL ITSELF.
 *
 * The finding `sim.test.mjs` §34(h) is built on, and it was NOT predicted: running §34(d)
 * against the pre-fix tree turned *"…and it is still dead, so nothing resurrected it"* red.
 * Hamburger's `Onion` is a `type: 'self'` weapon and `combat.ts:deliverWeapon` heals the
 * ATTACKER, so a corpse that could still attack could still heal ITSELF — reaching
 * `alive === false` with `hp > 0`, the one state `sim.ts:resolveTimeout`'s HP-fraction
 * ladder cannot survive (it sorts every fighter, alive or not, deliberately — see
 * `state.ts:lastFighterStanding`).
 *
 * 🚨 **THIS READS LIVE SOURCE, SO IT EXPIRES THE MOMENT THE BUG DOES** — the lesson
 * `5bfcafe` paid for on `tun_scrapes`. On the fixed tree it correctly prints a flat 0/70,
 * which is a PASS of the fix and NOT a reproduction. To see the defect again, run it inside
 * a detached worktree of a pre-fix commit:
 *
 *   git worktree add --detach /tmp/fa-prefix <sha-before-the-corpse-guard>
 *   ln -s "$PWD/node_modules" /tmp/fa-prefix/node_modules
 *   (cd /tmp/fa-prefix && node tools/tmp/dd_zombie.mjs)
 *
 * Measured that way at `eff6390`: peak **70/70 — a corpse at FULL HEALTH** over 1,800
 * ticks, and 36/70 over the 600-tick window §34(h) actually asserts on.
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { applyDamage } from '../../src/game/combat.ts';
import { CHARACTERS } from '../../src/game/rules.ts';

const N = 6;
const TICKS = Number(process.argv[2] ?? 1800);
const arena = {
  id: 'dd', displayName: 'dd', width: 2800, height: 2000, center: { x: 1400, y: 1000 },
  maxSafeRadius: 900, playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 2600, y: 1800 },
  cover: [], hazards: [], build() { return {}; },
};
const ring = (i) => ({
  x: arena.center.x + 700 * Math.cos((i / N) * Math.PI * 2),
  y: arena.center.y + 700 * Math.sin((i / N) * Math.PI * 2),
});

const st = createMatch(arena, Array.from({ length: N }, (_, i) => (
  { characterId: 'hamburger', spawn: ring(i), controller: i === 0 ? 'human' : 'ai' })));
st.phase = 'playing';
const me = st.fighters[0];
applyDamage(st, me, me.maxHp * 10, null, { kind: 'hazard' }, []);
console.log(`at death: alive=${me.alive} hp=${me.hp}/${me.maxHp}`);

const HEAL = CHARACTERS.hamburger.weapons.findIndex((w) => w.type === 'self');
if (HEAL === -1) { console.log('VACUOUS: this kit has no self-heal — nothing to measure'); process.exit(1); }

let peak = me.hp, heals = 0, playing = 0, firstHeal = -1;
for (let t = 0; t < TICKS; t++) {
  const evs = stepMatch(st, 16.67, { move: { x: 0, y: 0 }, selectedWeapon: HEAL, attack: true });
  if (st.phase === 'playing') playing++; else break;
  const h = evs.filter((e) => e.type === 'heal' && e.fighterId === 0);
  if (h.length && firstHeal < 0) firstHeal = t;
  heals += h.length;
  peak = Math.max(peak, me.hp);
}
console.log(`holding the self-heal (slot ${HEAL}) as a corpse over ${playing} playing ticks:`);
console.log(`  peak hp ${peak}/${me.maxHp} = ${(peak / me.maxHp * 100).toFixed(1)}% · ${heals} heal events · first at tick ${firstHeal}`);
console.log(peak > 0
  ? `>>> ZOMBIE: dead (alive=${me.alive}) and healed to ${peak} HP — resolveTimeout ranks on HP fraction`
  : '>>> INERT: the corpse never healed, so `alive === false` still implies `hp === 0`');
