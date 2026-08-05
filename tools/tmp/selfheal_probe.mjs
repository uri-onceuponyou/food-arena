#!/usr/bin/env node
/**
 * SELF-WEAPON PROBE, second edition.
 *
 * `tools/tmp/selfweapon_probe.mjs` proved the AI never fires Hamburger's Onion Ring — but
 * it drives an IDLE player, so the enemy kills a motionless target without ever being
 * damaged, and a heal that correctly never triggers is indistinguishable from a heal that
 * cannot. That is exactly the "a metric can be perfectly TRUE and tell you nothing" trap
 * in docs/LESSONS.md §13, and re-running the old probe after the fix still prints 0.
 *
 * This one puts a real hand on the controls (the census `chase` policy), so the enemy
 * actually takes damage and the question becomes answerable: does it heal when hurt?
 *
 *   node tools/tmp/selfheal_probe.mjs                       # working tree
 *   node tools/tmp/selfheal_probe.mjs --sim /tmp/statusbase/game   # any staged sim
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]?.startsWith('--') === false ? arr[i + 1] : true]] : a), []));

const SIM = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const R = await import(`${SIM}/rules.ts`);
const A = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const HALF = Math.hypot(A.width / 2, A.height / 2);
const arena = {
  ...A,
  maxSafeRadius: Math.round(HALF / (1 - 6000 / R.MATCH_DURATION_MS)),
  build: () => null, update: () => {},
};
const DT = 16.667;

function chasePolicy() {
  let flip = 1, lastCheck = 0, lastPos = null;
  return (st) => {
    const p = st.player, e = st.enemy;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    let best = null, bestDmg = -Infinity;
    R.CHARACTERS[p.characterId].weapons.forEach((w, i) => {
      if (w.type === 'self') return;
      if (st.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; best = i; }
    });
    if (st.elapsed - lastCheck > 1200) {
      if (lastPos && Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 40) flip = -flip;
      lastPos = { x: p.x, y: p.y }; lastCheck = st.elapsed;
    }
    const ang = Math.atan2(e.y - p.y, e.x - p.x) + (flip < 0 ? Math.PI / 2 : 0);
    const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
    return { move: { x: q(Math.cos(ang)), y: q(Math.sin(ang)) }, aim: { x: e.x - p.x, y: e.y - p.y },
      selectedWeapon: best ?? 0, attack: best !== null };
  };
}

let fires = 0, healed = 0, matches = 0, wonWithHeal = 0, hpAtHeal = [];
for (const p of R.CHARACTER_IDS) {
  if (p === 'hamburger') continue;
  const st = createMatch(arena, p, 'hamburger');
  const act = chasePolicy();
  let since = Infinity, input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let sawHeal = false;
  matches++;
  while (st.phase !== 'ended' && st.elapsed < 90_000) {
    if (since >= 150) { input = act(st); since = 0; }
    const hpBefore = st.enemy.hp;
    const evs = stepMatch(st, DT, input);
    since += DT;
    for (const ev of evs) {
      if (ev.type === 'weapon-fired' && ev.fighterRole === 'enemy' && ev.weaponKey === 'Onion') {
        fires++; sawHeal = true; hpAtHeal.push(hpBefore);
      }
      if (ev.type === 'heal' && ev.fighterRole === 'enemy' && ev.amount > R.REGEN_AMOUNT) healed += ev.amount;
    }
  }
  if (sawHeal && st.winner === 'enemy') wonWithHeal++;
}
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`sim: ${SIM}`);
console.log(`AI_SELF_HEAL_HP_FRACTION = ${R.AI_SELF_HEAL_HP_FRACTION ?? '(absent — this sim has no rule)'}`);
console.log(`enemy Hamburger, ${matches} real matches against a chasing player:`);
console.log(`  Onion Ring fires            ${fires}   (${(fires / matches).toFixed(2)} per match)`);
console.log(`  HP restored                 ${healed}   (${(healed / matches).toFixed(1)} per match, ${((healed / matches) / R.ENEMY_MAX_HP * 100).toFixed(1)}% of the enemy pool)`);
console.log(`  HP when it chose to heal    mean ${mean(hpAtHeal).toFixed(1)} of ${R.ENEMY_MAX_HP}` +
  ` (threshold ${((R.AI_SELF_HEAL_HP_FRACTION ?? 0) * R.ENEMY_MAX_HP).toFixed(0)})`);
console.log(`  matches it healed AND won   ${wonWithHeal}/${matches}`);
