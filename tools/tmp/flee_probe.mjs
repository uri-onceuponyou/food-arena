#!/usr/bin/env node
/**
 * THE FLEE BRANCH — does "flee and snipe" snipe?
 *
 * `ai.ts`'s own header says the AI will "chase the player, flee and snipe below a
 * flee-HP threshold". Below `AI_FLEE_HP_FRACTION` (0.28 — i.e. the last 42 of the
 * enemy's 150 HP, which is the endgame of every match it is losing) it takes the flee
 * branch. This probe asks the only two questions that branch has:
 *
 *   1. CAN IT CHOOSE A WEAPON AT ALL? `pickSniperWeapon` requires `type === 'ranged'`,
 *      and exactly one character in the roster has no ranged weapon (`sim.test.mjs`
 *      §19 asserts it). For that character the branch selects nothing, ever.
 *   2. WHERE DOES THE SHOT GO? The branch sets `enemy.facing` to point directly AWAY
 *      from the player and then calls `attemptAttack`, and `combat.ts` resolves BOTH
 *      the melee cone and the projectile heading off `attacker.facing`.
 *
 * Method: both fighters pinned at a fixed separation through the real `stepMatch`, the
 * enemy held just under the flee threshold, the player immortal and idle. Everything
 * that fires is `ai.ts` deciding for itself. Fires and delivered damage are read off
 * the event stream.
 *
 *   node tools/tmp/flee_probe.mjs
 *   node tools/tmp/flee_probe.mjs --d 110
 *   node tools/tmp/flee_probe.mjs --sim /tmp/staged/game
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
const { CHARACTERS, CHARACTER_IDS, AI_FLEE_HP_FRACTION } = R;

const DT = 16.667;
const WINDOW_MS = Number(args.ms ?? 8000);
const SEPARATIONS = args.d ? [Number(args.d)] : [60, 110, 135];

function fixture() {
  return {
    id: 'flee-probe', displayName: 'Flee Probe',
    width: 4000, height: 4000, center: { x: 2000, y: 2000 },
    maxSafeRadius: 1e6, // no ring: `dangerSteer` must stay inert or it, not the flee
    playerSpawn: { x: 2060, y: 2000 }, // branch, decides the tick
    enemySpawn: { x: 2000, y: 2000 },
    cover: [], hazards: [], build: () => ({}),
  };
}

/**
 * Hold the enemy in the flee branch for `WINDOW_MS` at separation `d` and report what
 * it managed to do. `fleeing` is re-asserted every tick by pinning its HP just under
 * the threshold — the probe is about the branch, not about who kills whom.
 */
function run(enemyId, playerId, d) {
  const state = createMatch(fixture(), playerId, enemyId);
  state.phase = 'playing';
  const ex = 2000, ey = 2000;
  const out = { fires: 0, hitsOnPlayer: 0, dmgOnPlayer: 0, byWeapon: {} };
  const input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  for (let t = 0; t < WINDOW_MS; t += DT) {
    state.enemy.x = ex; state.enemy.y = ey;
    state.player.x = ex + d; state.player.y = ey;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    // Just under the flee threshold, and never dead.
    state.enemy.hp = Math.max(1, state.enemy.maxHp * AI_FLEE_HP_FRACTION * 0.5);
    const evs = stepMatch(state, DT, input);
    for (const ev of evs) {
      if (ev.type === 'weapon-fired' && ev.fighterRole === 'enemy') {
        out.fires++;
        out.byWeapon[ev.weaponKey] = (out.byWeapon[ev.weaponKey] ?? 0) + 1;
      } else if (ev.type === 'hit-landed' && ev.targetRole === 'player' && (ev.source?.kind ?? '') === 'weapon') {
        out.hitsOnPlayer++;
        out.dmgOnPlayer += ev.amount;
      }
    }
  }
  return out;
}

const pad = (s, n) => String(s).padEnd(n);
const pct = (a, b) => `${b ? Math.round((a / b) * 100) : 0}%`;

console.log(`\nFLEE BRANCH — ${WINDOW_MS / 1000}s held below AI_FLEE_HP_FRACTION (${AI_FLEE_HP_FRACTION}), both fighters pinned`);
console.log(`sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}\n`);

/** Offensive weapons whose reach covers `d`. Zero of these is a RANGE fact, not a bug. */
const inRange = (id, d) => CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && d <= (w.range ?? Infinity)).length;

// ⚠️ `hit/fire` is HIT EVENTS per PRESS, not accuracy — a 4-pellet volley that lands all
// four reads 400%. Same caveat as `roster_table.mjs`'s column of the same name.
for (const d of SEPARATIONS) {
  console.log(`── separation ${d} wu ──────────────────────────────────────────────`);
  console.log(`  ${pad('character', 12)}${'reach'.padStart(6)}${'fires'.padStart(7)}${'hits'.padStart(7)}${'damage'.padStart(8)}${'hit/fire'.padStart(9)}   weapons used`);
  let silent = 0, wasted = 0, unarmed = 0;
  for (const id of CHARACTER_IDS) {
    const ctl = id === 'donut' ? 'taco' : 'donut';
    const r = run(id, ctl, d);
    const reach = inRange(id, d);
    const used = Object.entries(r.byWeapon).map(([k, v]) => `${k}x${v}`).join(' ') || '(none)';
    console.log(`  ${pad(id, 12)}${String(reach).padStart(6)}${String(r.fires).padStart(7)}${String(r.hitsOnPlayer).padStart(7)}${r.dmgOnPlayer.toFixed(0).padStart(8)}${pct(r.hitsOnPlayer, r.fires).padStart(9)}   ${used}`);
    if (reach === 0) unarmed++;
    else if (r.fires === 0) silent++;
    else if (r.dmgOnPlayer === 0) wasted++;
  }
  // Counted only over characters that HAVE something in range: "nothing reaches from
  // here" and "something reaches and the branch could not pick it" are different
  // findings, and a metric that adds them together reads as a defect forever.
  console.log(`  → ${unarmed}/11 have no weapon that reaches ${d} wu (a range fact)`);
  console.log(`  → of the other ${11 - unarmed}: ${silent} fire NOTHING · ${wasted} fire and deliver ZERO damage\n`);
}
