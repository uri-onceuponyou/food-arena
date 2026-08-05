#!/usr/bin/env node
/**
 * ROSTER VERDICT — re-derive `docs/DECISIONS-FOR-URI.md` §13's three figures from a
 * `roster_table.mjs` JSON, so "the number moved" is reproducible rather than asserted.
 *
 * §13 parks three findings and Uri is actively deciding on them:
 *
 *   (a) the rarity/strength roll-up — Normal 68.6, Rare 67.3, Legendary 68.4,
 *       Neon 34.8, Cyber 29.5, Epic 12.5 — "power runs BACKWARDS against rarity"
 *   (b) ρ = 0.327, Spearman, between the character card's stat total and measured
 *       strength — "the card is fiction"
 *   (c) 53 of 110 matchups decided before they start (one side ≥95% or ≤5%) —
 *       "the finding I would act on if you only pick one"
 *
 * None of those three is printed by any tool. All three were computed by hand off a
 * `roster_table.mjs` run and then written into a document, which is exactly the shape
 * that makes a figure un-recheckable — nobody can tell whether it still holds without
 * redoing the arithmetic and guessing at the definitions. So the arithmetic lives here.
 *
 * This file drives NOTHING. It reads a JSON and does statistics, which is why it is
 * safe for it to exist alongside `tools/tmp/roster_lab.mjs` (a peer's live tool that
 * computes (a) and (c) from its own matches): two independent implementations of a
 * definition are a cross-check, whereas two copies of a DRIVER are the bug this pass
 * was opened to fix.
 *
 *   node tools/tmp/roster_verdict.mjs /tmp/before.json
 *   node tools/tmp/roster_verdict.mjs /tmp/before.json /tmp/after.json   # side by side
 *   node tools/tmp/roster_verdict.mjs --policy chase a.json b.json
 *   node tools/tmp/roster_verdict.mjs --selftest
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flags = {};
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) { files.push(argv[i]); continue; }
  const k = argv[i].slice(2);
  const n = argv[i + 1];
  if (n === undefined || n.startsWith('--')) flags[k] = true; else { flags[k] = n; i++; }
}
const POLICY = String(flags.policy ?? 'smart2');

/** ≥95% or ≤5% across every seed. §13's own words: "decided before they start". */
const SETTLED_HI = 0.95, SETTLED_LO = 0.05;

/** Ranks with ties averaged — Spearman on 11 points with tied stat totals needs it. */
function ranks(a) {
  const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[s[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function spearman(x, y) {
  const rx = ranks(x), ry = ranks(y), n = x.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx === 0 || dy === 0 ? NaN : num / Math.sqrt(dx * dy);
}

if (flags.selftest) {
  let pass = 0; const fails = [];
  const ok = (n, c, d = '') => { if (c) pass++; else fails.push(`${n} ${d}`); };
  ok('spearman of a monotone pair is 1', Math.abs(spearman([1, 2, 3, 4], [10, 20, 30, 40]) - 1) < 1e-12);
  ok('spearman of a reversed pair is -1', Math.abs(spearman([1, 2, 3, 4], [40, 30, 20, 10]) + 1) < 1e-12);
  ok('ties average', JSON.stringify(ranks([5, 5, 1])) === JSON.stringify([2.5, 2.5, 1]));
  // A known-input check on the settled rule, since it is the figure Uri may act on.
  const rates = { 'a>b': 1, 'b>a': 0, 'c>d': 0.5, 'd>c': 0.95, 'e>f': 0.051 };
  const settled = Object.values(rates).filter((v) => v >= SETTLED_HI || v <= SETTLED_LO).length;
  ok('settled counts both ends and is inclusive at 0.95 / 0.05', settled === 3, `${settled}`);
  console.log(`\nroster_verdict selftest: ${pass} passed, ${fails.length} failed`);
  for (const f of fails) console.log(`  FAIL ${f}`);
  console.log('');
  process.exit(fails.length ? 1 : 0);
}

if (!files.length) { console.error('usage: roster_verdict.mjs [--policy smart2] <roster_table.json> [after.json]'); process.exit(1); }

const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { CHARACTERS, CHARACTER_IDS } = RULES;
const RARITY_ORDER = ['Normal', 'Rare', 'Legendary', 'Neon', 'Cyber', 'Epic'];

function verdict(path) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const P = j.policies?.[POLICY];
  if (!P) throw new Error(`${path} has no policy "${POLICY}" (has ${Object.keys(j.policies ?? {}).join(', ')})`);
  const ids = CHARACTER_IDS.filter((id) => P.perChar[id]);
  const strength = Object.fromEntries(ids.map((id) => [id, P.perChar[id].strength]));

  const byTier = {};
  for (const id of ids) (byTier[CHARACTERS[id].rarity] ??= []).push(strength[id]);
  const tier = Object.fromEntries(Object.entries(byTier)
    .map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));

  const statTotal = ids.map((id) => Object.values(CHARACTERS[id].stats).reduce((a, b) => a + b, 0));
  const rho = spearman(statTotal, ids.map((id) => strength[id]));

  const rates = Object.values(P.matchupRates);
  const settled = rates.filter((v) => v >= SETTLED_HI || v <= SETTLED_LO).length;

  const vals = ids.map((id) => strength[id]);
  return {
    path, driverRev: j.driverRev ?? '(unstamped — PRE-FIX)', seeds: j.seeds, sim: j.sim, n: P.n,
    aggWin: P.playerWinRate, strength, tier, rho, settled, nMatchups: rates.length,
    order: [...ids].sort((a, b) => strength[b] - strength[a]),
    range: Math.max(...vals) - Math.min(...vals),
  };
}

const runs = files.map(verdict);
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}pp`;

console.log(`\n══ DECISIONS §13, RE-DERIVED ══ policy ${POLICY}`);
for (const r of runs) console.log(`   ${r.path}\n     driver rev ${r.driverRev} · ${r.seeds} seeds · ${r.n} matches · sim ${r.sim}`);

console.log(`\n── §13(a) RARITY ROLL-UP — mean strength per tier ──`);
console.log(`   ${'tier'.padEnd(12)}${runs.map((r, i) => `run${i + 1}`.padStart(10)).join('')}${runs.length > 1 ? '     Δ' : ''}   §13 recorded`);
const RECORDED_TIER = { Normal: 0.686, Rare: 0.673, Legendary: 0.684, Neon: 0.348, Cyber: 0.295, Epic: 0.125 };
for (const t of RARITY_ORDER) {
  const cells = runs.map((r) => (r.tier[t] === undefined ? '—' : pct(r.tier[t])).padStart(10)).join('');
  const d = runs.length > 1 ? `  ${pp(runs[runs.length - 1].tier[t] - runs[0].tier[t]).padStart(7)}` : '';
  console.log(`   ${t.padEnd(12)}${cells}${d}   ${pct(RECORDED_TIER[t])}`);
}
{
  const last = runs[runs.length - 1];
  const seq = RARITY_ORDER.map((t) => last.tier[t]);
  const mono = seq.every((v, i) => i === 0 || v >= seq[i - 1]);
  console.log(`   monotonic in RARITY_ORDER (rarer = stronger)? ${mono ? 'YES' : 'NO — power still runs backwards'}`);
}

console.log(`\n── §13(b) ρ, card stat total vs measured strength (Spearman) ──`);
console.log(`   ${runs.map((r) => r.rho.toFixed(3)).join('   ->   ')}      §13 recorded 0.327`);

console.log(`\n── §13(c) SETTLED MATCHUPS — one side ≥95% or ≤5% ──`);
console.log(`   ${runs.map((r) => `${r.settled} of ${r.nMatchups}`).join('   ->   ')}      §13 recorded 53 of 110 (52 after the Lollipop fix)`);

console.log(`\n── strength order ──`);
for (const [i, r] of runs.entries()) {
  console.log(`   run${i + 1}  ${r.order.map((id) => `${id} ${(r.strength[id] * 100).toFixed(1)}`).join(' · ')}`);
  console.log(`         aggregate player win ${pct(r.aggWin)} · roster range ${(r.range * 100).toFixed(1)}pp`);
}
if (runs.length > 1) {
  const a = runs[0], b = runs[runs.length - 1];
  console.log(`\n── per-character strength delta ──`);
  const moved = a.order.map((id) => ({ id, d: b.strength[id] - a.strength[id] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  for (const m of moved) console.log(`   ${m.id.padEnd(12)} ${pct(a.strength[m.id]).padStart(7)} -> ${pct(b.strength[m.id]).padStart(7)}   ${pp(m.d).padStart(8)}`);
  console.log(`\n   ⚠️ the AGGREGATE win rate is unresolvable below ~9 pp; a PAIRED per-matchup`);
  console.log(`      delta on identical seeds is exact and is a different quantity. Do not add them.`);
}
console.log('');
