#!/usr/bin/env node
/**
 * IS A STUN THE SAME THING ON BOTH SIDES?
 *
 * `rules.ts` states the rule in one line — `STUN_DURATION_MS = 2000; // stunned =
 * movement locked to 0`. This probe asks the only question that matters about a
 * one-line rule implemented twice: does it MEAN the same thing when it lands on the
 * player as when it lands on the AI?
 *
 * Method: freeze both fighters in place, in weapon range, with every cooldown ready.
 * Stun one side. Count the shots each side gets off over one full stun. Nothing here
 * is a model — both sides go through the real `stepMatch`, so the player half is
 * `sim.ts:movePlayer` + the unconditional `attemptAttack`, and the enemy half is
 * `ai.ts:stepAI`.
 *
 * The `--all` mode runs the same test for all 11 characters, because a rule that is
 * asymmetric costs different amounts to different kits and the roster table cannot
 * separate "this character is weak" from "this character is on the wrong side of an
 * asymmetric rule".
 *
 *   node tools/tmp/stun_symmetry.mjs
 *   node tools/tmp/stun_symmetry.mjs --all
 *   node tools/tmp/stun_symmetry.mjs --sim /tmp/staged/game   # against a counterfactual
 */
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const R = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, STUN_DURATION_MS } = R;

const DT = 16.667;

function arenaFixture() {
  return {
    id: 'stun-symmetry', displayName: 'Stun Symmetry',
    width: 2000, height: 2000, center: { x: 1000, y: 1000 },
    maxSafeRadius: 100000, // ring far away: this probe is about the stun, not the fog
    playerSpawn: { x: 960, y: 1000 }, enemySpawn: { x: 1020, y: 1000 },
    cover: [], hazards: [], build: () => ({}),
  };
}

/**
 * Run `ms` of match with both fighters PINNED at 60 wu separation (inside every
 * weapon's reach), immortal, and optionally stunned. Returns shots fired per side.
 */
function run(playerId, enemyId, { stun, ms = STUN_DURATION_MS }) {
  const state = createMatch(arenaFixture(), playerId, enemyId);
  state.phase = 'playing';
  const fires = { player: 0, enemy: 0 };
  const input = { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: true };
  for (let t = 0; t < ms; t += DT) {
    // Pin both, keep both immortal, and re-apply the stun every tick so the whole
    // window is inside it. Immortality is what stops the test measuring who kills whom.
    state.player.x = 970; state.player.y = 1000;
    state.enemy.x = 1030; state.enemy.y = 1000;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
    if (stun === 'player' || stun === 'both') state.player.status.stunnedUntil = state.elapsed + STUN_DURATION_MS;
    if (stun === 'enemy' || stun === 'both') state.enemy.status.stunnedUntil = state.elapsed + STUN_DURATION_MS;
    // Aim at the opponent so a coned melee is never rejected for FACING — this probe
    // is about the stun, and an unaimed swing would confound it.
    input.aim = { x: state.enemy.x - state.player.x, y: state.enemy.y - state.player.y };
    // Pick the player's highest-damage weapon in range, the same rule the AI uses,
    // so the two sides are driven by the same policy.
    const ws = CHARACTERS[playerId].weapons;
    let best = 0, bestDmg = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (state.elapsed - state.player.lastUsed[i] < w.cooldown) return;
      if (60 > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; best = i; }
    });
    input.selectedWeapon = best;
    const evs = stepMatch(state, DT, input);
    for (const ev of evs) if (ev.type === 'weapon-fired') fires[ev.fighterRole]++;
  }
  return fires;
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nSTUN SYMMETRY — shots fired during one full ${STUN_DURATION_MS}ms stun, both fighters pinned in range`);
console.log(`sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}\n`);

const ids = args.all ? CHARACTER_IDS : ['pizza'];
console.log(`${pad('character', 12)}${'freeStun'.padStart(9)}${'stunned'.padStart(9)}${'kept'.padStart(7)}   role`);
let asym = 0;
for (const id of ids) {
  // The character under test as the PLAYER, stunned. Opponent is a fixed control.
  const ctl = id === 'donut' ? 'taco' : 'donut';
  const pFree = run(id, ctl, { stun: null }).player;
  const pStun = run(id, ctl, { stun: 'player' }).player;
  // The same character as the AI, stunned.
  const eFree = run(ctl, id, { stun: null }).enemy;
  const eStun = run(ctl, id, { stun: 'enemy' }).enemy;
  console.log(`${pad(id, 12)}${String(pFree).padStart(9)}${String(pStun).padStart(9)}${`${pFree ? Math.round((pStun / pFree) * 100) : 0}%`.padStart(7)}   as PLAYER`);
  console.log(`${pad('', 12)}${String(eFree).padStart(9)}${String(eStun).padStart(9)}${`${eFree ? Math.round((eStun / eFree) * 100) : 0}%`.padStart(7)}   as AI`);
  if ((pStun > 0) !== (eStun > 0)) asym++;
}

console.log(`\nVERDICT: ${asym} of ${ids.length} characters keep firing through a stun in one role and are silenced in the other.`);
console.log(`  A stunned PLAYER keeps shooting — sim.ts calls attemptAttack unconditionally and only movePlayer reads stunnedUntil.`);
console.log(`  A stunned AI does not — ai.ts:stepAI gates chosenIndex on aiFrozen, so the stun silences it as well as rooting it.`);
console.log(`  rules.ts states the rule once: "stunned = movement locked to 0". One of the two implementations is wider than the rule.\n`);
