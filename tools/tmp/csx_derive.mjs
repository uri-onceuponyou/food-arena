#!/usr/bin/env node
/**
 * csx_derive — RE-DERIVE the brief's arithmetic from `rules.ts` rather than believing it.
 *
 * Prints, in one place, every number the cast-system design leans on:
 *   * the per-character speed ladder (the brief quoted the CAPS, which are nobody's speed),
 *   * the escape window for each melee reach at each of those speeds,
 *   * the `Special:`-prefixed ability census,
 *   * the fog DPS and the real sudden-death burn-down band.
 *
 * Read-only. No `--selftest` because it computes rather than judges: every row is a
 * closed-form function of exported constants and is checked by being printed next to the
 * constant it came from.
 */
import {
  CHARACTERS, CHARACTER_IDS, REACH, PLAYER_SPEED, AI_CHASE_SPEED, AI_FLEE_SPEED,
  SLOW_MOVE_MULTIPLIER, AI_SLOW_MULTIPLIER, FOG_DAMAGE, FOG_TICK_MS, PLAYER_MAX_HP,
  speedFor, maxHpFor, LEVEL_MAX, LEVEL_MIN,
} from '../../src/game/rules.ts';

const f2 = (n) => n.toFixed(2);

console.log('REACH =', JSON.stringify(REACH));
console.log(`PLAYER_SPEED ${PLAYER_SPEED} wu/ms = ${PLAYER_SPEED * 1000} wu/s`);
console.log(`AI_CHASE_SPEED ${AI_CHASE_SPEED} wu/ms = ${AI_CHASE_SPEED * 1000} wu/s`);
console.log(`AI_FLEE_SPEED  ${AI_FLEE_SPEED} wu/ms = ${AI_FLEE_SPEED * 1000} wu/s`);

console.log('\n── per-character speed ladder (wu/s) ──');
const rows = [];
for (const id of CHARACTER_IDS) {
  const human = speedFor(id, PLAYER_SPEED) * 1000;
  const chase = speedFor(id, AI_CHASE_SPEED) * 1000;
  const flee = speedFor(id, AI_FLEE_SPEED) * 1000;
  rows.push({ id, human, chase, flee });
  console.log(`  ${id.padEnd(12)} human ${f2(human).padStart(7)}  chase ${f2(chase).padStart(6)}  flee ${f2(flee).padStart(6)}`);
}
const humans = rows.map((r) => r.human);
const chases = rows.map((r) => r.chase);
console.log(`  humans ${f2(Math.min(...humans))}–${f2(Math.max(...humans))}   chase ${f2(Math.min(...chases))}–${f2(Math.max(...chases))}`);

console.log('\n── escape window: ms to gain R wu, from separation 0, rooted caster ──');
for (const [name, R] of Object.entries(REACH)) {
  const line = [];
  for (const [label, v] of [
    ['fastest human', Math.max(...humans)],
    ['slowest human', Math.min(...humans)],
    ['slowest human SLOWED', Math.min(...humans) * SLOW_MOVE_MULTIPLIER],
    ['slowest AI chase', Math.min(...chases)],
    ['slowest AI SLOWED', Math.min(...chases) * AI_SLOW_MULTIPLIER],
  ]) line.push(`${label} ${f2((R / v) * 1000)}`);
  console.log(`  ${name.padEnd(14)} R=${String(R).padStart(4)}  ${line.join(' | ')}`);
}

console.log('\n── Special:-prefixed abilities ──');
let specials = 0;
for (const id of CHARACTER_IDS) {
  for (const a of CHARACTERS[id].abilities ?? []) {
    if (a.desc.startsWith('Special:')) { specials++; console.log(`  ${id}.${a.weapon}`); }
  }
}
console.log(`  total ${specials}`);

console.log('\n── fog ──');
const fogDps = (FOG_DAMAGE / FOG_TICK_MS) * 1000;
console.log(`  FOG_DAMAGE ${FOG_DAMAGE} / FOG_TICK_MS ${FOG_TICK_MS} = ${f2(fogDps)} HP/s`);
let lo = Infinity; let hi = -Infinity;
for (const id of CHARACTER_IDS) {
  for (const lvl of [LEVEL_MIN, LEVEL_MAX]) {
    const pool = maxHpFor(id, PLAYER_MAX_HP, lvl);
    lo = Math.min(lo, pool); hi = Math.max(hi, pool);
  }
}
console.log(`  player pools ${lo}–${hi} HP  →  burn ${f2(lo / fogDps)}–${f2(hi / fogDps)} s`);
console.log(`  PLAYER_MAX_HP/50 = ${f2(PLAYER_MAX_HP / 50)} s  (the brief's figure — nobody's pool)`);

console.log('\n── waterbottle.Mega record ──');
const wb = CHARACTERS.waterbottle;
console.log('  ', JSON.stringify(wb.weapons.find((w) => w.key === 'Mega')));
console.log('\n── status vocabulary census ──');
const vocab = new Map();
let nWeapons = 0;
for (const id of CHARACTER_IDS) for (const w of CHARACTERS[id].weapons) {
  nWeapons++;
  vocab.set(String(w.effect), (vocab.get(String(w.effect)) ?? 0) + 1);
}
console.log(`  ${nWeapons} weapons:`, [...vocab].map(([k, v]) => `${k}=${v}`).join(' '));
