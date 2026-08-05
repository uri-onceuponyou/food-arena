#!/usr/bin/env node
/** Per-matchup win-rate delta between two census JSONs — the balance guard. */
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2);
const A = JSON.parse(readFileSync(a, 'utf8'));
const B = JSON.parse(readFileSync(b, 'utf8'));
const pct = (x) => `${(x * 100).toFixed(2)}%`;
console.log(`${'policy'.padEnd(10)}${'win BEFORE'.padStart(11)}${'win AFTER'.padStart(11)}${'Δ overall'.padStart(11)}` +
  `${'Δ matchup max'.padStart(15)}${'Δ mean'.padStart(9)}${'matchups moved'.padStart(16)}${'regen/f before→after'.padStart(22)}`);
for (const p of Object.keys(A.policies)) {
  if (!B.policies[p]) continue;
  const x = A.policies[p], y = B.policies[p];
  const keys = Object.keys(x.matchupRates);
  const d = keys.map((k) => (y.matchupRates[k] ?? 0) - x.matchupRates[k]);
  const moved = d.filter((v) => Math.abs(v) > 1e-9).length;
  const maxD = d.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
  const meanAbs = d.reduce((s, v) => s + Math.abs(v), 0) / d.length;
  console.log(`${p.padEnd(10)}${pct(x.playerWinRate).padStart(11)}${pct(y.playerWinRate).padStart(11)}` +
    `${((y.playerWinRate - x.playerWinRate) * 100).toFixed(2).padStart(9)}pp` +
    `${(maxD * 100).toFixed(1).padStart(13)}pp${(meanAbs * 100).toFixed(3).padStart(7)}pp` +
    `${`${moved}/${keys.length}`.padStart(16)}` +
    `${`${x.regenTicksPerFighterMatch.toFixed(3)} → ${y.regenTicksPerFighterMatch.toFixed(3)}`.padStart(22)}`);
}
console.log(`\nmean play length  ${Object.keys(A.policies).map((p) => `${p} ${(A.policies[p].meanPlayMs / 1000).toFixed(2)}→${(B.policies[p].meanPlayMs / 1000).toFixed(2)}s`).join('  ')}`);
console.log(`fighters that regen  ${Object.keys(A.policies).map((p) => `${p} ${(A.policies[p].regenAnyRate * 100).toFixed(1)}%→${(B.policies[p].regenAnyRate * 100).toFixed(1)}%`).join('  ')}`);
