#!/usr/bin/env node
/**
 * ss_head — HOW MUCH RESOLUTION DOES THE NUMBER SYSTEM ACTUALLY HAVE?
 *
 * Uri's ask is not "bigger numbers", it is *"allow small increments in attributes due to
 * levelling up"*. That is a claim about RESOLUTION, and it is measurable. This tool answers
 * three questions with arithmetic instead of assertion:
 *
 *   1. What is the SMALLEST per-character difference a designer can author, in HP and in
 *      damage, and what fraction of a health bar is it?
 *   2. Across the 15-level ladder, how many DISTINCT numbers does a player actually SEE?
 *      The sim's level term is continuous, but `hud.ts` renders `Math.round(amount)` and
 *      `maxHpFor` rounds the pool — so the ladder is quantised at the point of display.
 *   3. What do (1) and (2) become at a given scale factor?
 *
 * ⚠️ The damage figures below are PER-PELLET where the weapon fans, because that is the
 * field a designer edits and the field `hud.ts` prints per impact. Per-press totals are in
 * `ss_enum.mjs`. Conflating them is the 50.6 pp mistake.
 *
 *   node tools/tmp/ss_head.mjs [--root <dir>] [--factor 10]
 *   node tools/tmp/ss_head.mjs --selftest
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const IS_MAIN = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

/**
 * Distinct values a rounded ladder produces. The sim multiplies by a continuous term; the
 * screen rounds. `distinctSteps` is what the PLAYER can perceive, `levels` is what they paid
 * for, and the gap between them is the whole of Uri's complaint.
 */
export function ladder(base, perLevel, levels, round = Math.round) {
  const vals = [];
  for (let L = 1; L <= levels; L++) vals.push(round(base * (1 + (L - 1) * perLevel)));
  const distinct = new Set(vals);
  let flatUpgrades = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] === vals[i - 1]) flatUpgrades++;
  return { vals, distinct: distinct.size, flatUpgrades, levels };
}

function pct(n) { return `${(n * 100).toFixed(1)}%`; }

async function main() {
  if (argv.includes('--selftest')) return selftest();
  const root = fs.realpathSync(arg('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')));
  const R = await import(pathToFileURL(path.join(root, 'src/game/rules.ts')).href);
  const K = Number(arg('--factor', '10'));

  console.log(`root ${root}`);
  console.log(`PLAYER_MAX_HP ${R.PLAYER_MAX_HP} · LEVEL_MAX ${R.LEVEL_MAX} · +${pct(R.LEVEL_HEALTH_PER_LEVEL)}HP/+${pct(R.LEVEL_DAMAGE_PER_LEVEL)}dmg per level`);
  console.log(`HEALTH_PER_STAT ${R.HEALTH_PER_STAT} on an INTEGER 0..${R.STAT_MAX_DISPLAY} card · HEALTH_BASELINE_STAT ${R.HEALTH_BASELINE_STAT}\n`);

  // ── 1. THE PER-CHARACTER FLOOR ────────────────────────────────────────────
  // The designer's HP lever is `stats.health`, an INTEGER on a 0..10 card multiplied by
  // HEALTH_PER_STAT. So the smallest authorable HP difference is not 1 HP — it is one
  // CARD POINT, and that is a far coarser thing.
  const stepHp = R.PLAYER_MAX_HP * R.HEALTH_PER_STAT;
  const authored = R.CHARACTER_IDS.map((id) => R.CHARACTERS[id].stats.health);
  const usedPools = new Set(R.CHARACTER_IDS.map((id) => R.maxHpFor(id, R.PLAYER_MAX_HP, R.LEVEL_MIN)));
  console.log('── 1. SMALLEST AUTHORABLE PER-CHARACTER DIFFERENCE ──────────────────────');
  console.log(`  HP: one card point = ${stepHp} HP = ${pct(R.HEALTH_PER_STAT)} of the baseline pool.`);
  console.log(`      The whole 0..${R.STAT_MAX_DISPLAY} card offers ${R.STAT_MAX_DISPLAY + 1} pools; the roster authors ${
    Math.min(...authored)}..${Math.max(...authored)} = ${new Set(authored).size} distinct stats for ${R.CHARACTER_IDS.length} characters.`);
  console.log(`      DISTINCT L1 POOLS IN USE: ${usedPools.size} (${[...usedPools].sort((a, b) => a - b).join(', ')}) — ${
    R.CHARACTER_IDS.length - usedPools.size} character(s) share a pool with someone else.`);
  console.log(`      Measured worth of ONE point (rules.ts:HEALTH_PER_STAT): 13.5-27.9 pp of win rate.`);
  console.log(`      Aggregate win-rate resolution floor: ~9 pp. So the FINEST HP lever is 1.5x-3.1x the noise floor.`);

  const dmgs = [];
  for (const id of R.CHARACTER_IDS) for (const w of R.CHARACTERS[id].weapons) {
    if (w.type === 'self' || w.comboParts) continue;
    if (w.damage > 0) dmgs.push({ id, key: w.key, d: w.damage, pel: w.pellets ?? 1, peck: w.peckHits ?? 1 });
  }
  dmgs.sort((a, b) => a.d - b.d);
  console.log(`\n  DAMAGE: the lever is the authored integer, ${dmgs[0].d}..${dmgs[dmgs.length - 1].d} across the roster.`);
  console.log('      One point of it is worth, as a fraction of that weapon:');
  for (const w of [dmgs[0], dmgs[1], dmgs[Math.floor(dmgs.length / 2)], dmgs[dmgs.length - 1]]) {
    console.log(`        ${w.id}/${w.key} ${w.d} (x${w.pel} pellets, x${w.peck} pecks) -> +1 = ${pct(1 / w.d)} of the weapon`);
  }
  console.log(`      There is NO sub-integer damage lever: every authored value is an integer and`);
  console.log(`      \`combat.ts\` rounds only the trail boost, so a designer cannot say "5.5".`);

  // ── 2. WHAT THE LEVEL LADDER ACTUALLY SHOWS ───────────────────────────────
  console.log('\n── 2. THE 15-LEVEL LADDER, AS THE PLAYER SEES IT ────────────────────────');
  console.log('  HP pool (maxHpFor rounds):');
  let hpFlat = 0;
  for (const id of R.CHARACTER_IDS) {
    const vals = [];
    for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) vals.push(R.maxHpFor(id, R.PLAYER_MAX_HP, L));
    let flat = 0; for (let i = 1; i < vals.length; i++) if (vals[i] === vals[i - 1]) flat++;
    hpFlat += flat;
    const steps = vals.slice(1).map((v, i) => v - vals[i]);
    console.log(`    ${id.padEnd(12)} ${String(vals[0]).padStart(4)} -> ${String(vals[vals.length - 1]).padStart(4)}   `
      + `per-level step ${Math.min(...steps)}..${Math.max(...steps)} HP   distinct ${new Set(vals).size}/${R.LEVEL_MAX}   flat upgrades ${flat}`);
  }
  console.log(`    TOTAL LEVEL-UPS THAT DO NOT MOVE THE HP NUMBER: ${hpFlat} of ${R.CHARACTER_IDS.length * (R.LEVEL_MAX - 1)}`);

  console.log('\n  DAMAGE NUMBER, as `hud.ts:spawnDamageNumber` prints it (`Math.round(amount)`):');
  console.log('    ⚠️ the SIM is continuous here — `applyDamage` does NOT round `dealt`. What is');
  console.log('       quantised is the READOUT, which is the only thing a player has.');
  let dFlat = 0, dCells = 0, worst = null;
  const rows = [];
  for (const id of R.CHARACTER_IDS) for (const w of R.CHARACTERS[id].weapons) {
    if (w.type === 'self' || w.damage <= 0) continue;
    const l = ladder(w.damage, R.LEVEL_DAMAGE_PER_LEVEL, R.LEVEL_MAX);
    dFlat += l.flatUpgrades; dCells += R.LEVEL_MAX - 1;
    rows.push({ id, key: w.key, d: w.damage, ...l });
    if (!worst || l.distinct < worst.distinct) worst = { id, key: w.key, d: w.damage, ...l };
  }
  rows.sort((a, b) => a.distinct - b.distinct);
  for (const r of rows) {
    console.log(`    ${(r.id + '/' + r.key).padEnd(22)} authored ${String(r.d).padStart(2)}  `
      + `sees ${String(r.distinct).padStart(2)}/${R.LEVEL_MAX} distinct numbers  `
      + `${String(r.flatUpgrades).padStart(2)}/${R.LEVEL_MAX - 1} level-ups show NO change  [${r.vals.join(' ')}]`);
  }
  console.log(`\n    🚨 ACROSS THE WHOLE ROSTER: ${dFlat} of ${dCells} level-ups (${pct(dFlat / dCells)}) do not move`);
  console.log(`       the displayed damage number at all. Worst: ${worst.id}/${worst.key} — ${worst.distinct} distinct`);
  console.log(`       numbers across ${R.LEVEL_MAX} levels.`);

  // ── 3. AT A SCALE FACTOR ──────────────────────────────────────────────────
  console.log(`\n── 3. THE SAME TWO QUANTITIES AT x${K} ──────────────────────────────────────`);
  let dFlatK = 0;
  for (const id of R.CHARACTER_IDS) for (const w of R.CHARACTERS[id].weapons) {
    if (w.type === 'self' || w.damage <= 0) continue;
    dFlatK += ladder(w.damage * K, R.LEVEL_DAMAGE_PER_LEVEL, R.LEVEL_MAX).flatUpgrades;
  }
  console.log(`  displayed-damage level-ups that show NO change:  ${dFlat}/${dCells} (${pct(dFlat / dCells)})  ->  ${dFlatK}/${dCells} (${pct(dFlatK / dCells)})`);
  let hpFlatK = 0;
  for (const id of R.CHARACTER_IDS) {
    const vals = [];
    for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) vals.push(Math.round(R.PLAYER_MAX_HP * K * R.healthMultiplier(id) * R.levelHealthMultiplier(L)));
    for (let i = 1; i < vals.length; i++) if (vals[i] === vals[i - 1]) hpFlatK++;
  }
  // ⚠️ ITS OWN DENOMINATOR. This line printed `/${dCells}` (434 = 31 weapons x 14) for a
  // quantity counted over 11 CHARACTERS x 14 = 154. Same shape as every stale count in this
  // repo: a plausible number, wrong by a factor of 2.8, and nothing would have caught it.
  const hpCells = R.CHARACTER_IDS.length * (R.LEVEL_MAX - 1);
  console.log(`  HP level-ups that show NO change:                ${hpFlat}/${hpCells} -> ${hpFlatK}/${hpCells}`);
  console.log(`\n  ⚠️ AND THE THING x${K} DOES NOT FIX, STATED PLAINLY:`);
  console.log(`     The per-character HP lever is STILL one card point, because HEALTH_PER_STAT is a`);
  console.log(`     FRACTION (${R.HEALTH_PER_STAT}) of the pool and the card is STILL an integer 0..${R.STAT_MAX_DISPLAY}.`);
  console.log(`     x${K} moves that step from ${stepHp} HP to ${stepHp * K} HP — the SAME ${pct(R.HEALTH_PER_STAT)} of a bar,`);
  console.log(`     and the same 13.5-27.9 pp of win rate. A constant factor buys ZERO here.`);
  console.log(`     The per-character resolution lever is HEALTH_PER_STAT / STAT_MAX_DISPLAY, not the pool size.`);

  // ── 4. STRING WIDTHS ──────────────────────────────────────────────────────
  console.log(`\n── 4. HOW MANY CHARACTERS WIDER EVERY DISPLAYED FIELD GETS AT x${K} ─────────`);
  const maxPool = Math.max(...R.CHARACTER_IDS.map((id) => R.maxHpFor(id, R.PLAYER_MAX_HP, R.LEVEL_MAX)));
  const maxDmg = Math.max(...R.CHARACTER_IDS.flatMap((id) => R.CHARACTERS[id].weapons.map((w) => w.damage)));
  const fogDps = Math.round((R.FOG_DAMAGE / R.FOG_TICK_MS) * 1000);
  const widths = [
    ['hud.ts:359  HP bar text', `${maxPool} / ${maxPool}`, `${maxPool * K} / ${maxPool * K}`],
    ['hud.ts:1665 damage number', `-${maxDmg}`, `-${maxDmg * K}`],
    ['hud.ts:1664 heal number', `+${R.REGEN_AMOUNT}`, `+${R.REGEN_AMOUNT * K}`],
    ['hud.ts:1136 zone readout', `−${fogDps} HP/s`, `−${fogDps * K} HP/s`],
    ['characterSelect:85 heal fact', `+18 HP`, `+${18 * K} HP`],
    ['characterSelect:89 pellet fact', `2 × 5`, `${2 * K} × 5`],
    ['characterSelect:87 combo fact', `14 + 9`, `${14 * K} + ${9 * K}`],
    ['characterSelect:332 level HP', `${maxPool} HP`, `${maxPool * K} HP`],
  ];
  for (const [where, now, then] of widths) {
    console.log(`  ${where.padEnd(32)} "${now}" (${now.length}) -> "${then}" (${then.length})   +${then.length - now.length} chars`);
  }
}

function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); ok ? pass++ : fail++; };
  // KNOWN-BAD: a ladder on a LARGE base must show every step; on a tiny base it must not.
  const big = ladder(1000, 0.05, 15);
  const tiny = ladder(2, 0.05, 15);
  ck('a 1000-base ladder shows all 15 distinct', big.distinct === 15, `${big.distinct}`);
  ck('a 2-base ladder collapses', tiny.distinct < 15, `${tiny.distinct} distinct: ${tiny.vals.join(',')}`);
  ck('and the two DISAGREE — the control is not vacuous', big.distinct !== tiny.distinct);
  ck('flatUpgrades counts the collapses', tiny.flatUpgrades === 14 - (tiny.distinct - 1),
    `flat=${tiny.flatUpgrades} distinct=${tiny.distinct}`);
  ck('a ladder with perLevel 0 is TOTALLY flat (degenerate end of the range)',
    ladder(100, 0, 15).distinct === 1);
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
}

if (IS_MAIN) main();
