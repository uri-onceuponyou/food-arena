#!/usr/bin/env node
/**
 * BM_AB — the paired comparator for two `bm_lab` runs.
 *
 * ⚠️ **AGGREGATE AND PAIRED ARE DIFFERENT QUANTITIES AND THIS TOOL NEVER ADDS THEM.**
 * An aggregate win rate on this project is unresolvable below **~9 pp**; a paired per-cell
 * delta on identical seeds is **EXACT**. `roster_table`'s aggregate once moved 0.8 pp —
 * inside the floor — while **58 of 110 matchups moved, max 34.4 pp**. A flat aggregate is
 * NOT evidence a change did nothing, and this tool prints the paired half precisely so
 * that reading cannot be made.
 *
 * A "cell" is one `(policy, playerId, enemyId, seed)`, identical in both runs by
 * construction. A "matchup" is one `(policy, playerId, enemyId)` aggregated over seeds —
 * which is the unit `roster_table` reports its 110 in.
 *
 *   node tools/tmp/bm_ab.mjs before.json after.json
 *   node tools/tmp/bm_ab.mjs --selftest
 */

import { readFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { argv as procArgv } from 'node:process';

/**
 * 🚨 IS_MAIN GUARD. `compare` is exported so a second tool can reuse a validated
 * comparator instead of copying it — which is the right instinct and, without this line,
 * silently makes the whole CLI path run on import. `AGENT-BRIEF` §3 records three tools
 * here that shipped without it: importing `snapsweep.mjs` PRINTED A LIVE SWEEP, and
 * importing `da_census.mjs` fell through into `runCapture`. This file's own version was
 * milder — `import { compare }` printed `usage:` and called `process.exit(1)`, killing the
 * importer — but it is the same defect and it fired on the first import.
 */
const IS_MAIN = (() => {
  try { return realpathSync(new URL(import.meta.url).pathname) === realpathSync(procArgv[1] ?? ''); }
  catch { return false; }
})();

const argv = process.argv.slice(2);
const selftest = argv.includes('--selftest');
const files = argv.filter((a) => !a.startsWith('--'));

const pct = (n, d) => (d ? (100 * n) / d : 0);

/**
 * @param A before, @param B after — both `bm_lab` JSON payloads.
 * Returns the paired report. Throws on a non-empty-set violation rather than reporting
 * over nothing: `[].every()` is `true` and `mean([])` is 0, and this project has had that
 * exact vacuity fire three times in three files in one session.
 */
export function compare(A, B) {
  const ka = Object.keys(A.cells), kb = Object.keys(B.cells);
  if (!ka.length || !kb.length) throw new Error('compare: one side has NO cells — refusing to report over nothing');
  const shared = ka.filter((k) => k in B.cells);
  if (!shared.length) throw new Error('compare: the two runs share NO cell keys — they are not paired');
  const onlyA = ka.length - shared.length, onlyB = kb.length - shared.length;

  let winnerMoved = 0, endingMoved = 0, anyMoved = 0;
  let maxPlayDelta = 0, maxPlayCell = null;
  const perMatchup = new Map();
  for (const k of shared) {
    const a = A.cells[k], b = B.cells[k];
    const [policy, p, e] = k.split('|');
    const mk = `${policy}|${p}|${e}`;
    if (!perMatchup.has(mk)) perMatchup.set(mk, { nA: 0, wA: 0, nB: 0, wB: 0 });
    const m = perMatchup.get(mk);
    m.nA++; m.nB++;
    if (a.w === 'player') m.wA++;
    if (b.w === 'player') m.wB++;
    if (a.w !== b.w) winnerMoved++;
    if (a.end !== b.end) endingMoved++;
    /**
     * ⚠️ `playMs` IS COMPARED WITH A TOLERANCE, AND THE TOLERANCE IS NOT A GUESS.
     *
     * The first version of this file compared it exactly and reported **1760 of 1760
     * cells moved, 0.00% bit-identical** on a run where 2 winners and 14 causes actually
     * changed. The cause was the metric, not the game: both arms subtract from
     * `MATCH_DURATION_MS`, which is 45_000 on one and 150_000 on the other, so the same
     * instant lands ~1.5e-8 ms apart. `bm_lab` now pairs contact on an integer TICK
     * INDEX for that reason; `playMs` is still a float difference of two accumulated
     * `state.elapsed` readings, so it gets a tolerance of **1e-6 ms — nine orders of
     * magnitude below the 16.667 ms tick**, i.e. it cannot mask a real one-tick change.
     * The selftest asserts both directions of that.
     */
    const identical = a.w === b.w && a.end === b.end && Math.abs(a.playMs - b.playMs) <= 1e-6
      && a.contact === b.contact && a.fog === b.fog && a.wpn === b.wpn && a.regen === b.regen;
    if (!identical) anyMoved++;
    const d = Math.abs(b.playMs - a.playMs);
    if (d > maxPlayDelta) { maxPlayDelta = d; maxPlayCell = k; }
  }

  /**
   * ── PAIRED PACING, and why the aggregate means CANNOT be subtracted ────────
   *
   * `bm_lab`'s `meanContactS` averages only over matches that made contact. On the 45 s
   * arm under `smart`, **43 of 880 matches never made contact at all**; on the 150 s arm
   * their counterparts do. Subtracting the two published means therefore compares two
   * different populations and books a composition shift as a pacing change — the exact
   * shape of `AGENT-BRIEF` §4.7 ("a baseline is itself a measurement").
   *
   * So contact is reported three ways: the delta over cells that made contact in BOTH
   * arms (a true paired quantity, EXACT), and the two one-sided counts.
   */
  const bothContact = shared.filter((k) => A.cells[k].contact !== null && B.cells[k].contact !== null);
  if (!bothContact.length) throw new Error('compare: NO cell made contact in both arms — refusing to report a paired contact delta over nothing');
  const dtMs = 16.667;
  const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const pairedContactDeltaS = meanOf(bothContact.map((k) => (B.cells[k].contact - A.cells[k].contact) * dtMs)) / 1000;
  const contactLostOnly = shared.filter((k) => A.cells[k].contact !== null && B.cells[k].contact === null).length;
  const contactGainedOnly = shared.filter((k) => A.cells[k].contact === null && B.cells[k].contact !== null).length;
  const pairedLengthDeltaS = meanOf(shared.map((k) => B.cells[k].playMs - A.cells[k].playMs)) / 1000;
  const contactMoved = bothContact.filter((k) => A.cells[k].contact !== B.cells[k].contact).length;

  const matchups = [...perMatchup.entries()].map(([k, m]) => ({
    k, before: pct(m.wA, m.nA), after: pct(m.wB, m.nB), delta: pct(m.wB, m.nB) - pct(m.wA, m.nA),
  }));
  const moved = matchups.filter((m) => Math.abs(m.delta) > 1e-9);
  moved.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  return {
    cellsShared: shared.length, onlyA, onlyB,
    cellsIdenticalPct: pct(shared.length - anyMoved, shared.length),
    cellsMoved: anyMoved, winnerMoved, endingMoved,
    maxPlayDeltaMs: maxPlayDelta, maxPlayCell,
    bothContact: bothContact.length, contactMoved, contactLostOnly, contactGainedOnly,
    pairedContactDeltaS, pairedLengthDeltaS,
    matchupsTotal: matchups.length, matchupsMoved: moved.length,
    maxMatchupDeltaPp: moved.length ? Math.abs(moved[0].delta) : 0,
    top: moved.slice(0, 12),
    aggWinPctBefore: A.overall.playerWinPct, aggWinPctAfter: B.overall.playerWinPct,
  };
}

if (IS_MAIN && selftest) {
  let pass = 0, fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? '  ' + d : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? '  ' + d : ''}`); } };
  console.log('\n══ bm_ab SELFTEST ══');
  const cell = (w, end, playMs) => ({ w, end, playMs, contact: 1, fog: 0, wpn: 10, regen: 0, sd: 0 });
  const mk = (cells) => ({ overall: { playerWinPct: 0 }, cells });

  // 1. SELF-PAIR. A run against itself must move nothing. This is the row that fails if
  //    the comparator is keyed on anything that is not stable within a run.
  {
    const c = { 'smart2|a|b|0': cell('player', 'ko-weapon', 1000), 'smart2|a|b|1': cell('enemy', 'ko-fog', 2000) };
    const r = compare(mk(c), mk(JSON.parse(JSON.stringify(c))));
    ok('SELF-PAIR: a run against itself moves 0 cells and 0 matchups',
      r.cellsMoved === 0 && r.matchupsMoved === 0 && r.cellsIdenticalPct === 100);
  }
  // 2. KNOWN-BAD: it MOVES when something moves — and separately on each field, because a
  //    comparator blinded to one field passes every row that only that field changed.
  {
    const a = { 'p|x|y|0': cell('player', 'ko-weapon', 1000) };
    ok('KNOWN-BAD winner: a flipped winner is counted as a winner move AND a matchup move',
      (() => { const r = compare(mk(a), mk({ 'p|x|y|0': cell('enemy', 'ko-weapon', 1000) })); return r.winnerMoved === 1 && r.matchupsMoved === 1 && Math.abs(r.maxMatchupDeltaPp - 100) < 1e-9; })());
    ok('KNOWN-BAD ending: the SAME winner by a different CAUSE still counts as a cell move',
      (() => { const r = compare(mk(a), mk({ 'p|x|y|0': cell('player', 'ko-fog', 1000) })); return r.endingMoved === 1 && r.cellsMoved === 1 && r.winnerMoved === 0 && r.matchupsMoved === 0; })());
    ok('KNOWN-BAD duration: an identical outcome at a different LENGTH still counts as a cell move',
      (() => { const r = compare(mk(a), mk({ 'p|x|y|0': cell('player', 'ko-weapon', 9000) })); return r.cellsMoved === 1 && r.maxPlayDeltaMs === 8000 && r.winnerMoved === 0; })());
  }
  // 2b. THE TOLERANCE, BOTH WAYS. This pair is the regression test for the bug this
  //     comparator actually shipped once: float noise from `MATCH_DURATION_MS` differing
  //     between arms reported EVERY cell as moved. A tolerance that is too wide is the
  //     opposite failure, so the second row demands a real one-tick change still counts.
  {
    const a = { 'p|x|y|0': cell('player', 'ko-weapon', 21017.08700000046) };
    ok('float noise below 1e-6 ms is NOT a move (the 1760-of-1760 bug cannot come back)',
      (() => { const r = compare(mk(a), mk({ 'p|x|y|0': cell('player', 'ko-weapon', 21017.087000000472) })); return r.cellsMoved === 0; })());
    ok('…but a real ONE-TICK change IS a move (the tolerance does not mask the signal)',
      (() => { const r = compare(mk(a), mk({ 'p|x|y|0': cell('player', 'ko-weapon', 21017.08700000046 + 16.667) })); return r.cellsMoved === 1; })());
  }

  // 3. The vacuity guards. Both must THROW, not return a confident zero.
  {
    let t1 = false, t2 = false;
    try { compare(mk({}), mk({ 'p|x|y|0': cell('player', 'ko-weapon', 1) })); } catch { t1 = true; }
    try { compare(mk({ 'p|x|y|0': cell('player', 'ko-weapon', 1) }), mk({ 'q|x|y|0': cell('player', 'ko-weapon', 1) })); } catch { t2 = true; }
    ok('KNOWN-BAD: an EMPTY side throws rather than reporting "nothing moved"', t1);
    ok('KNOWN-BAD: two runs sharing NO cell keys throw rather than reporting "nothing moved"', t2);
  }
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

if (!IS_MAIN) { /* imported for `compare` only — the CLI path below must not run */ }
else {
if (files.length !== 2) { console.error('usage: bm_ab.mjs <before.json> <after.json>'); process.exit(1); }
const A = JSON.parse(readFileSync(files[0], 'utf8'));
const B = JSON.parse(readFileSync(files[1], 'utf8'));
const r = compare(A, B);

console.log(`\n══ bm_ab  PAIRED, identical seeds — EXACT ══`);
console.log(`   before  clock ${A.clockMs / 1000}s  SD ${A.suddenDeathMs / 1000}s  ring ${Number(A.openingRadius).toFixed(4)}  ${A.matches} matches  ${A.simDir}`);
console.log(`   after   clock ${B.clockMs / 1000}s  SD ${B.suddenDeathMs / 1000}s  ring ${Number(B.openingRadius).toFixed(4)}  ${B.matches} matches  ${B.simDir}`);
console.log(`\n   cells shared ${r.cellsShared} (only-before ${r.onlyA}, only-after ${r.onlyB})`);
console.log(`   cells BIT-IDENTICAL       ${r.cellsIdenticalPct.toFixed(2)}%   (${r.cellsShared - r.cellsMoved}/${r.cellsShared})`);
console.log(`   cells that MOVED at all   ${r.cellsMoved}`);
console.log(`     of which winner flipped ${r.winnerMoved}`);
console.log(`     of which cause changed  ${r.endingMoved}`);
console.log(`   max |Δ match length|      ${(r.maxPlayDeltaMs / 1000).toFixed(2)}s  @ ${r.maxPlayCell}`);
console.log(`\n   PAIRED PACING (same cells, EXACT — never subtract the two published means)`);
console.log(`     Δ match length          ${r.pairedLengthDeltaS >= 0 ? '+' : ''}${r.pairedLengthDeltaS.toFixed(2)}s   over all ${r.cellsShared} cells`);
console.log(`     Δ time to first contact ${r.pairedContactDeltaS >= 0 ? '+' : ''}${r.pairedContactDeltaS.toFixed(2)}s   over the ${r.bothContact} cells that made contact in BOTH arms`
  + `  (floor ~0.8s — ${Math.abs(r.pairedContactDeltaS) >= 0.8 ? 'CLEARS' : 'DOES NOT CLEAR'})`);
console.log(`     cells that made contact only BEFORE ${r.contactLostOnly} · only AFTER ${r.contactGainedOnly} · contact tick moved in ${r.contactMoved}/${r.bothContact}`);
console.log(`\n   MATCHUPS (policy x player x enemy, over seeds): ${r.matchupsMoved} of ${r.matchupsTotal} moved · max |Δ| ${r.maxMatchupDeltaPp.toFixed(1)} pp`);
for (const m of r.top) console.log(`     ${m.k.padEnd(30)} ${m.before.toFixed(1)}% -> ${m.after.toFixed(1)}%   Δ ${m.delta > 0 ? '+' : ''}${m.delta.toFixed(1)} pp`);
console.log(`\n   ⚠️ AGGREGATE, floor ~9 pp: player win ${r.aggWinPctBefore.toFixed(2)}% -> ${r.aggWinPctAfter.toFixed(2)}%`
  + `  (Δ ${(r.aggWinPctAfter - r.aggWinPctBefore).toFixed(2)} pp — ${Math.abs(r.aggWinPctAfter - r.aggWinPctBefore) >= 9 ? 'CLEARS' : 'DOES NOT CLEAR'} the floor)`);
}
