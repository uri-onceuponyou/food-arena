#!/usr/bin/env node
/**
 * ROSTER COMPARE — put N `roster_table.mjs` runs side by side, per character, and roll
 * the result up by RARITY.
 *
 * Two questions the single-run table cannot answer:
 *
 *  1. WHICH DIRECTION DID A CHARACTER MOVE, AND BECAUSE OF WHAT? Every run is the same
 *     110 matchups x the same seeds x the same arena, so a column-to-column delta is a
 *     PAIRED comparison, not two samples of a noisy mean. That is what separates
 *     "carried by the status lock" from "suppressed by it" — the two directions the
 *     brief asks about, and the ones an aggregate win rate structurally cannot show.
 *  2. DOES POWER TRACK RARITY? `rules.ts` sorts the roster Normal < Rare < Epic <
 *     Legendary < Neon < Cyber, and `economy/` gates unlocks on that order, so a player
 *     spends ~13 h of trophies to reach the rarest tier. If the rarest tier is the
 *     weakest, the progression is selling a downgrade. Nothing measured this before.
 *
 *   node tools/tmp/roster_compare.mjs --policy smart2 \
 *        --runs "pre-lock=/tmp/rb/prelock_smart2.json,shipped=/tmp/rb/before_smart2.json"
 */
import { readFileSync } from 'node:fs';
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

const R = await import(`${ROOT}/src/game/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, RARITY_ORDER } = R;

const POLICY = String(args.policy ?? 'smart2');
const RUNS = String(args.runs).split(',').map((s) => {
  const i = s.indexOf('=');
  return { label: s.slice(0, i), data: JSON.parse(readFileSync(s.slice(i + 1), 'utf8')) };
});
const FIELD = String(args.field ?? 'strength'); // strength | asPlayer | asAI

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
const get = (run, id) => run.data.policies[POLICY].perChar[id][FIELD];

console.log(`\n══ ROSTER COMPARE · policy ${POLICY} · field ${FIELD} · ${RUNS[0].data.policies[POLICY].n} matches per run ══`);
console.log(`  ${'character'.padEnd(12)}${'rarity'.padEnd(11)}${RUNS.map((r) => r.label.padStart(11)).join('')}${RUNS.length > 1 ? `${'Δ last-first'.padStart(13)}` : ''}`);

const rows = CHARACTER_IDS.map((id) => ({
  id, rarity: CHARACTERS[id].rarity,
  vals: RUNS.map((r) => get(r, id)),
}));
rows.sort((a, b) => b.vals[b.vals.length - 1] - a.vals[a.vals.length - 1]);
for (const r of rows) {
  const d = r.vals[r.vals.length - 1] - r.vals[0];
  console.log(`  ${r.id.padEnd(12)}${r.rarity.padEnd(11)}${r.vals.map((v) => pct(v).padStart(11)).join('')}${RUNS.length > 1 ? `${`${pp(d)}pp`.padStart(13)}` : ''}`);
}

for (const [i, run] of RUNS.entries()) {
  const vs = CHARACTER_IDS.map((id) => get(run, id));
  const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
  const sd = Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length);
  console.log(`  ${`[${run.label}]`.padEnd(23)} mean ${pct(mean)} · sd ${(sd * 100).toFixed(1)}pp · RANGE ${((Math.max(...vs) - Math.min(...vs)) * 100).toFixed(1)}pp · aggregate player win ${pct(run.data.policies[POLICY].playerWinRate)}`);
  if (i === 0 && RUNS.length > 1) console.log('');
}

// ── HOW MANY MATCHUPS ARE DECIDED BEFORE THEY START? ────────────────────────
//
// The headline roster metric, and the one an aggregate win rate hides completely. A
// matchup whose outcome is >=95% or <=5% across N seeds is not a fight; it is a coin
// that was already flipped at character select. `07a4e3a` called player-Pizza's 98.8%
// a defect by exactly this standard, so it is the standard the rest of the roster is
// held to here.
console.log(`\n  ── MATCHUPS DECIDED BEFORE THEY START (>=95% or <=5% over ${RUNS[0].data.seeds} seeds) ──`);
for (const run of RUNS) {
  const d = run.data.policies[POLICY];
  const es = Object.entries(d.matchupRates);
  const hi = es.filter(([, v]) => v >= 0.95).length;
  const lo = es.filter(([, v]) => v <= 0.05).length;
  const perChar = CHARACTER_IDS.map((id) => {
    const n = es.filter(([k, v]) => (k.startsWith(`${id}>`) && (v >= 0.95 || v <= 0.05))
      || (k.endsWith(`>${id}`) && (v >= 0.95 || v <= 0.05))).length;
    return { id, n };
  }).sort((a, b) => b.n - a.n);
  console.log(`     ${run.label.padEnd(12)} ${String(hi + lo).padStart(3)}/110 decided (${hi} at >=95%, ${lo} at <=5%)   worst: ${perChar.slice(0, 4).map((c) => `${c.id} ${c.n}/20`).join(' · ')}`);
}

// ── rarity roll-up, on the LAST run ─────────────────────────────────────────
const last = RUNS[RUNS.length - 1];
console.log(`\n  ── DOES POWER TRACK RARITY? (${last.label}) ────────────────────────────`);
console.log(`     ${'rarity'.padEnd(11)}${'n'.padStart(3)}${'mean'.padStart(9)}   members`);
for (const rar of RARITY_ORDER) {
  const ids = CHARACTER_IDS.filter((id) => CHARACTERS[id].rarity === rar);
  if (!ids.length) continue;
  const vs = ids.map((id) => get(last, id));
  const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
  console.log(`     ${rar.padEnd(11)}${String(ids.length).padStart(3)}${pct(mean).padStart(9)}   ${ids.map((id) => `${id} ${pct(get(last, id))}`).join(' · ')}`);
}

// ── does the DISPLAYED stat block predict anything? ─────────────────────────
// `CharacterDef.stats` is documented "display-only, not used in combat math" — so the
// card a player picks from is free to disagree with the character they get. Measure it.
console.log(`\n  ── DOES THE ROSTER CARD TELL THE TRUTH? (displayed stats vs measured ${FIELD}) ──`);
console.log(`     ${'character'.padEnd(12)}${'dmg'.padStart(5)}${'hp'.padStart(4)}${'spd'.padStart(5)}${'sum'.padStart(5)}${'measured'.padStart(10)}`);
const cards = CHARACTER_IDS.map((id) => {
  const s = CHARACTERS[id].stats;
  return { id, sum: s.damage + s.health + s.speed, s, v: get(last, id) };
}).sort((a, b) => b.sum - a.sum);
for (const c of cards) {
  console.log(`     ${c.id.padEnd(12)}${String(c.s.damage).padStart(5)}${String(c.s.health).padStart(4)}${String(c.s.speed).padStart(5)}${String(c.sum).padStart(5)}${pct(c.v).padStart(10)}`);
}
// Spearman rank correlation between the card's stat total and measured strength.
const rank = (xs) => { const s = [...xs].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v); const r = new Array(xs.length); s.forEach((e, k) => { r[e.i] = k + 1; }); return r; };
const rs = rank(cards.map((c) => c.sum)), rv = rank(cards.map((c) => c.v));
const n = rs.length;
const d2 = rs.reduce((a, _, i) => a + (rs[i] - rv[i]) ** 2, 0);
console.log(`     Spearman rho(card stat total, measured ${FIELD}) = ${(1 - (6 * d2) / (n * (n * n - 1))).toFixed(3)}`);
console.log('');
