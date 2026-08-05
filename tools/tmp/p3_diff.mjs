#!/usr/bin/env node
/**
 * P3 PROBE — paired per-matchup diff between two `burger_lab --roster --json` dumps.
 *
 * READ-ONLY analysis. A paired per-matchup delta on identical seeds is EXACT; the
 * aggregate over 110 cells is NOT (floor ~9 pp). This prints them separately and
 * never adds them.
 *
 *   node tools/tmp/p3_diff.mjs <before.json> <after.json>
 *
 * KNOWN-BAD-INPUT CONTROL: `--selfpair <a.json>` diffs a file against ITSELF and must
 * report 0 moved cells / 0.00 pp everywhere. If that ever prints a non-zero the
 * comparator is broken, not the game.
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const selfIdx = argv.indexOf('--selfpair');
let A, B, label;
if (selfIdx >= 0) {
  A = B = JSON.parse(readFileSync(argv[selfIdx + 1], 'utf8'));
  label = 'SELF-PAIR CONTROL (must be all zero)';
} else {
  A = JSON.parse(readFileSync(argv[0], 'utf8'));
  B = JSON.parse(readFileSync(argv[1], 'utf8'));
  label = `${argv[0]}  ->  ${argv[1]}`;
}

const keys = Object.keys(A.cells);
const moved = keys.filter((k) => A.cells[k] !== B.cells[k]);
const deltas = moved.map((k) => ({ k, d: (B.cells[k] - A.cells[k]) * 100 }));
deltas.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));

console.log(`\n══ PAIRED PER-MATCHUP DIFF ══  ${label}`);
console.log(`   policy ${A.policy}/${B.policy}  seeds ${A.seeds}/${B.seeds}  playerHeals ${A.playerHeals} -> ${B.playerHeals}`);
console.log(`\n   EXACT (paired, identical seeds):  ${moved.length}/110 matchups moved`);
if (moved.length) {
  console.log(`   max |delta| ${Math.max(...deltas.map((x) => Math.abs(x.d))).toFixed(1)} pp`);
  for (const { k, d } of deltas) {
    console.log(`     ${k.padEnd(26)} ${(A.cells[k] * 100).toFixed(1).padStart(6)}% -> ${(B.cells[k] * 100).toFixed(1).padStart(6)}%   ${(d >= 0 ? '+' : '') + d.toFixed(1)} pp`);
  }
}

console.log(`\n   GUARDS                       before      after     delta`);
const row = (n, a, b, unit = '') => console.log(`     ${n.padEnd(22)} ${String(a).padStart(8)}${unit}  ${String(b).padStart(8)}${unit}  ${(b - a >= 0 ? '+' : '') + (b - a).toFixed(2)}${unit}`);
row('settled /110', A.settled, B.settled);
row('rarity tier spread', A.tierSpread.toFixed(2), B.tierSpread.toFixed(2), ' pp');
row('aggregate player win', (A.aggregate * 100).toFixed(1), (B.aggregate * 100).toFixed(1), ' %');

console.log(`\n   PER-CHARACTER  (asPlayer / asAI / strength, pp)   — role halves are`);
console.log(`   aggregates over 10 matchups x N seeds: NOT exact, NOT the paired quantity above.`);
console.log(`   ${'character'.padEnd(13)}${'asPlayer'.padStart(20)}${'asAI'.padStart(20)}${'strength'.padStart(20)}`);
for (const id of Object.keys(A.perChar)) {
  const a = A.perChar[id], b = B.perChar[id];
  const f = (x, y) => `${(x * 100).toFixed(1)}->${(y * 100).toFixed(1)} (${((y - x) * 100 >= 0 ? '+' : '') + ((y - x) * 100).toFixed(1)})`;
  console.log(`   ${id.padEnd(13)}${f(a.asPlayer, b.asPlayer).padStart(20)}${f(a.asAI, b.asAI).padStart(20)}${f(a.strength, b.strength).padStart(20)}`);
}

console.log(`\n   RARITY TIERS`);
for (const t of Object.keys(A.byRarity)) {
  console.log(`     ${t.padEnd(12)} ${(A.byRarity[t] * 100).toFixed(1)}% -> ${(B.byRarity[t] * 100).toFixed(1)}%`);
}
const spread = (o) => {
  const v = Object.values(o.byRarity).map((x) => x * 100);
  return { min: Math.min(...v), max: Math.max(...v) };
};
const sa = spread(A), sb = spread(B);
console.log(`     spread ${(sa.max - sa.min).toFixed(2)} pp -> ${(sb.max - sb.min).toFixed(2)} pp   (floor ~9 pp; Uri's guard 4.0 pp, DECISIONS 24b/26)`);
console.log('');
