#!/usr/bin/env node
/**
 * RB_CMP — the two quantities, side by side, NEVER added together.
 *
 * `roster_lab --baseline` prints the paired block only when it is given a baseline at run
 * time. This reads two of its JSON dumps after the fact, which is what a sweep needs: the
 * control is measured once and every candidate is paired against it without re-running it.
 *
 *   AGGREGATE player win rate   resolution floor ~9 pp on this project. CONTEXT ONLY.
 *   PAIRED per-matchup delta    identical seeds, identical matchups — EXACT for these
 *                               seeds, and a DIFFERENT QUANTITY from the aggregate.
 *   roster range / settled      what the pass is judged on.
 *
 * ⚠️ It REFUSES to compare two runs with different seed counts, arenas or clocks — a
 * "paired" delta across different seeds is not paired, and `roster_lab` only warns.
 *
 *   node tools/tmp/rb_cmp.mjs before.json after.json
 */
import { readFileSync } from 'node:fs';

const [beforeP, afterP] = process.argv.slice(2);
if (!afterP) { console.error('usage: rb_cmp.mjs <before.json> <after.json>'); process.exit(1); }
const B = JSON.parse(readFileSync(beforeP, 'utf8'));
const A = JSON.parse(readFileSync(afterP, 'utf8'));

for (const k of ['seeds', 'dt', 'clockMs', 'maxSafeRadius']) {
  if (B[k] !== A[k]) { console.error(`rb_cmp: ${k} differs (${B[k]} vs ${A[k]}) — the comparison would NOT be paired`); process.exit(2); }
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log(`\n╔══ RB_CMP ══ ${beforeP.split('/').pop()}  ->  ${afterP.split('/').pop()}   ${A.seeds} seeds`);
for (const pol of Object.keys(A.policies)) {
  const b = B.policies[pol], a = A.policies[pol];
  if (!b) continue;
  const ids = Object.keys(a.perChar);
  const sB = ids.map((i) => b.perChar[i].strength), sA = ids.map((i) => a.perChar[i].strength);
  const rangeB = Math.max(...sB) - Math.min(...sB), rangeA = Math.max(...sA) - Math.min(...sA);
  const ks = Object.keys(a.matchupRates);
  const d = ks.map((k) => a.matchupRates[k] - b.matchupRates[k]);
  const abs = d.map(Math.abs);
  const moved = abs.filter((x) => x > 1e-9).length;

  console.log(`\n══════ ${pol.toUpperCase()} ══════`);
  console.log(`  AGGREGATE player win  ${pct(b.playerWinRate)} -> ${pct(a.playerWinRate)}  (${pp(a.playerWinRate - b.playerWinRate)} pp)`);
  console.log(`     ⚠️ floor ~9 pp — CONTEXT, not a result.`);
  console.log(`  PAIRED per-matchup (same seeds, EXACT):  ${moved}/${ks.length} moved · max |Δ| ${pp(Math.max(...abs))} pp · mean |Δ| ${pp(mean(abs))} pp`);
  console.log(`  ROSTER RANGE   ${(rangeB * 100).toFixed(1)} pp -> ${(rangeA * 100).toFixed(1)} pp`);
  console.log(`  SETTLED        ${b.settled}/${b.total} -> ${a.settled}/${a.total}`);
  console.log(`  sd             ${(b.sd * 100).toFixed(1)} pp -> ${(a.sd * 100).toFixed(1)} pp`);
  console.log(`  RARITY monotonic ${b.monotonic ? 'YES' : 'NO'} -> ${a.monotonic ? 'YES' : 'NO'}`);
  console.log(`  first contact ${(b.meanContactSessionMs / 1000).toFixed(2)}s -> ${(a.meanContactSessionMs / 1000).toFixed(2)}s · play ${(b.meanPlayMs / 1000).toFixed(2)}s -> ${(a.meanPlayMs / 1000).toFixed(2)}s · duty ${pct(b.meanDutyCycle)} -> ${pct(a.meanDutyCycle)}`);
  console.log(`  ${'char'.padEnd(13)}${'before'.padStart(9)}${'after'.padStart(9)}${'Δ'.padStart(9)}`);
  for (const id of ids.sort((x, y) => a.perChar[y].strength - a.perChar[x].strength)) {
    console.log(`  ${id.padEnd(13)}${pct(b.perChar[id].strength).padStart(9)}${pct(a.perChar[id].strength).padStart(9)}${pp(a.perChar[id].strength - b.perChar[id].strength).padStart(9)}`);
  }
  const tiers = Object.keys(a.byRarity);
  console.log(`  TIERS  ${tiers.map((t) => `${t} ${pct(b.byRarity[t].strength)}->${pct(a.byRarity[t].strength)}`).join(' · ')}`);
  const tB = tiers.map((t) => b.byRarity[t].strength), tA = tiers.map((t) => a.byRarity[t].strength);
  console.log(`  TIER SPREAD  ${((Math.max(...tB) - Math.min(...tB)) * 100).toFixed(1)} pp -> ${((Math.max(...tA) - Math.min(...tA)) * 100).toFixed(1)} pp`);
}
console.log('');
