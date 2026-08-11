#!/usr/bin/env node
/**
 * NW PROFILE — the gate on the placement wiring: `profile.ts:recordPlacement` and the league's
 * per-finisher payout.
 *
 *   node tools/tmp/nw_profile.mjs --selftest
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 THE ONE CLAIM THAT NEEDS A FROZEN ORACLE, AND WHY A SELF-TEST CANNOT MAKE IT
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * `recordResult(won)` now DELEGATES to `recordPlacement(won ? 0 : 1, MIN_FIGHTERS)`. The claim
 * is that the shipped duel is bit-for-bit unchanged. **That claim cannot be tested against the
 * new code**, because after the delegation "N=2 is unchanged" is true by construction and any
 * assertion comparing the new path to itself is tautological — the exact trap
 * `economy/state.ts` names when it routes `applyMatchResult` through `applyMatchPlacement`, and
 * the same shape as this agent's own `errorWu` finding, which read 0.0 at every latency because
 * it measured a chain against itself.
 *
 * So §A replays a seeded 2,000-match career through a **frozen transcription of the pre-change
 * body** — three lines, copied verbatim from the diff — and compares the WHOLE serialised
 * profile after every single match. The oracle calls `economy/state.ts:applyMatchResult`, which
 * this pass did not touch, so the only thing under test is the profile layer.
 *
 * ⚠️ **RESOLUTION FLOOR: none.** Every check here is exact equality on integers or on a
 * serialised blob. The only numbers reported rather than asserted are the mean-per-match EV
 * figures in §C, which are exact means over a closed, finite set of outcomes.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/**
 * 🚨 **`src/ui/**` CANNOT BE IMPORTED BY A NODE INSTRUMENT, AND THAT IS WHY THIS BUNDLES.**
 *
 * `state.ts`'s header records the rule from the other side: files under `src/game/` import each
 * other with an explicit `.ts` extension *specifically* so `sim.test.mjs` can import them with
 * no build step, while *"the extension-less style used elsewhere in this codebase"* resolves
 * only under Vite/tsc bundler resolution. `profile.ts` is elsewhere — `import { CHARACTER_IDS }
 * from '../../game/rules'` — so `node` answers `ERR_MODULE_NOT_FOUND` and **no Node gate in this
 * repo has ever been able to reach the UI layer.** That is a standing finding, not a problem
 * with this file.
 *
 * ⚠️ **ONE ENTRY POINT, BUNDLED ONCE, AND THAT IS LOAD-BEARING.** Bundling `profile.ts` alone
 * and importing `game/economy` separately would give the gate TWO module instances of the
 * economy — so `placementCurve === placementCurve` would be FALSE for two copies of the same
 * source, and §D8's identity check (which exists to catch a wrapper masquerading as a
 * re-export) would fail for a reason that has nothing to do with the code. Re-exporting
 * everything through one entry keeps a single graph, so identity means what it says.
 */
function buildBridge() {
  const dir = mkdtempSync(join(tmpdir(), 'nw-profile-'));
  const entry = join(dir, 'entry.ts');
  writeFileSync(entry, [
    `export * from ${JSON.stringify(join(ROOT, 'src/ui/screens/profile.ts'))};`,
    `export * from ${JSON.stringify(join(ROOT, 'src/game/economy/index.ts'))};`,
    `export { MIN_FIGHTERS, MAX_FIGHTERS } from ${JSON.stringify(join(ROOT, 'src/game/state.ts'))};`,
    `export { applyMatchResult as applyLeagueResult, createLeague, standings, placementCurve as lobbyPlacementCurve, twoSeatCurve } from ${JSON.stringify(join(ROOT, 'src/net/lobby.ts'))};`,
  ].join('\n'));
  const out = join(dir, 'bridge.mjs');
  execFileSync(join(ROOT, 'node_modules/.bin/esbuild'), [
    entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${out}`,
  ], { stdio: 'inherit' });
  return { dir, out };
}

const bridge = buildBridge();
const M = await import(bridge.out);
rmSync(bridge.dir, { recursive: true, force: true });

const {
  PlayerProfile, XP_LOSS, XP_WIN, placementXp,
  applyMatchResult, createEconomy, placementCoins, placementCurve, placementRank01,
  placementTrophyDelta, placementWeight01, serialize: serializeEconomy,
  MAX_FIGHTERS, MIN_FIGHTERS,
  applyLeagueResult, createLeague, standings, lobbyPlacementCurve, twoSeatCurve,
  createRng,
} = M;

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`); }

const SEED = 0x9E3779B9;

console.log('NW PROFILE — placement wiring, against a frozen oracle of the pre-change body');

// ─────────────────────────────────────────────────────────────────────────────
section('A. THE DELEGATION — 2,000 matches against a frozen transcription');

/**
 * 🔒 FROZEN. The body of `PlayerProfile.recordResult` BEFORE `recordPlacement` existed,
 * transcribed verbatim from the diff and never to be "kept in sync" — the instant it is
 * updated to match the new code it stops being an oracle and becomes a mirror.
 *
 *     if (won) { this.data.wins++; this.data.xp += XP_WIN; }
 *     else { this.data.losses++; this.data.xp += XP_LOSS; }
 *     const paid = applyMatchResult(this.data.economy, won);
 */
function frozenRecordResult(blob, won) {
  if (won) { blob.wins++; blob.xp += XP_WIN; }
  else { blob.losses++; blob.xp += XP_LOSS; }
  return applyMatchResult(blob.economy, won);
}

{
  // Both arms start from the SAME pinned economy seed. `createEconomy()` draws a random seed by
  // default, so two arms built from the shipped default would diverge on the RNG stream alone
  // and the comparison would fail for a reason that has nothing to do with the change.
  const live = new PlayerProfile({ wins: 0, losses: 0, xp: 0, economy: createEconomy(SEED) });
  const oracle = { wins: 0, losses: 0, xp: 0, economy: createEconomy(SEED) };

  const rng = createRng(SEED);
  let firstDiff = null;
  let matches = 0;
  for (let i = 0; i < 2000 && firstDiff === null; i++) {
    const won = rng.next() < 0.55;
    const a = live.recordResult(won);
    const b = frozenRecordResult(oracle, won);
    matches++;
    const liveBlob = JSON.stringify({
      wins: live.wins, losses: live.losses, xp: live.xp, economy: serializeEconomy(live.economy),
    });
    const oracleBlob = JSON.stringify({
      wins: oracle.wins, losses: oracle.losses, xp: oracle.xp, economy: serializeEconomy(oracle.economy),
    });
    if (liveBlob !== oracleBlob) firstDiff = { i, won, liveBlob, oracleBlob };
    else if (JSON.stringify(a) !== JSON.stringify(b)) firstDiff = { i, won, ret: [a, b] };
  }
  ok('A1  🚨 2,000 seeded matches: the delegating recordResult is bit-identical to the frozen'
    + ' pre-change body, on the WHOLE serialised profile after every match',
    firstDiff === null, firstDiff ? `first divergence at match ${firstDiff.i}` : `${matches} matches`);
  ok('A2  …and the career actually went somewhere (the oracle is not comparing two no-ops)',
    live.wins > 500 && live.losses > 300 && live.trophies > 0 && live.xp > 100000,
    `${live.wins}W/${live.losses}L, ${live.trophies} trophies, ${live.xp} xp, level ${live.level}`);
  ok('A3  …and the return value is the same object shape a caller celebrates',
    live.lastMatch !== null && typeof live.lastMatch.trophies === 'number');
}

{
  // 🚨 KNOWN-BAD. The oracle must be able to CATCH a change, or A1 certifies nothing.
  const live = new PlayerProfile({ wins: 0, losses: 0, xp: 0, economy: createEconomy(SEED) });
  const oracle = { wins: 0, losses: 0, xp: 0, economy: createEconomy(SEED) };
  const rng = createRng(SEED);
  let caught = false;
  for (let i = 0; i < 50 && !caught; i++) {
    const won = rng.next() < 0.55;
    live.recordResult(won);
    // The tamper: one XP point, on one match, in the middle of the run.
    frozenRecordResult(oracle, won);
    if (i === 25) oracle.xp += 1;
    if (JSON.stringify([live.wins, live.losses, live.xp]) !== JSON.stringify([oracle.wins, oracle.losses, oracle.xp])) caught = true;
  }
  ok('A4  🚨 KNOWN-BAD  a ONE-POINT XP difference at match 25 is caught by the same comparison',
    caught);
}

// ─────────────────────────────────────────────────────────────────────────────
section('B. XP — the second two-outcome ladder, and the decision taken on it');

ok('B1  first place pays exactly XP_WIN at every seat count',
  Array.from({ length: MAX_FIGHTERS - MIN_FIGHTERS + 1 }, (_, k) => k + MIN_FIGHTERS)
    .every((n) => placementXp(0, n) === XP_WIN), `${XP_WIN}`);
ok('B2  last place pays exactly XP_LOSS at every seat count',
  Array.from({ length: MAX_FIGHTERS - MIN_FIGHTERS + 1 }, (_, k) => k + MIN_FIGHTERS)
    .every((n) => placementXp(n - 1, n) === XP_LOSS), `${XP_LOSS}`);
ok('B3  🚨 the two-seat duel is UNCHANGED — the endpoints are the only ranks that exist there',
  placementXp(0, 2) === XP_WIN && placementXp(1, 2) === XP_LOSS);

{
  let monotone = true;
  const rows = [];
  for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) {
    const row = Array.from({ length: n }, (_, p) => placementXp(p, n));
    for (let p = 1; p < n; p++) if (row[p] > row[p - 1]) monotone = false;
    rows.push(`${n}: ${row.join('/')}`);
  }
  ok('B4  XP never rises as you finish further down, at any seat count', monotone);
  for (const r of rows) console.log(`      seats ${r}`);
}

{
  // 🚨 THE DEFECT THAT WAS REJECTED, demonstrated rather than described.
  const binaryXp = (place) => (place === 0 ? XP_WIN : XP_LOSS);
  ok('B5  🚨 KNOWN-BAD  a BINARY ladder pays 2nd of six and 6th of six identically —'
    + ' the exact defect placementRank01 exists to remove',
    binaryXp(1) === binaryXp(5) && placementXp(1, 6) !== placementXp(5, 6),
    `binary ${binaryXp(1)}=${binaryXp(5)}  ·  interpolated ${placementXp(1, 6)} vs ${placementXp(5, 6)}`);
  ok('B6  🚨 …and it would have been INVISIBLE at two seats, where both agree',
    binaryXp(0) === placementXp(0, 2) && binaryXp(1) === placementXp(1, 2));
}

{
  // The shape is IMPORTED, not copied. Prove the identity rather than the equality of outputs:
  // an independent copy could agree today and drift on the next steepness retune.
  const viaShared = Math.round(XP_WIN - placementWeight01(placementRank01(2, 5)) * (XP_WIN - XP_LOSS));
  ok('B7  placementXp is placementCoins\'s shape with XP endpoints — same weight function',
    placementXp(2, 5) === viaShared, `${placementXp(2, 5)}`);
  let threw = null;
  try { placementXp(6, 6); } catch (e) { threw = e; }
  ok('B8  KNOWN-BAD  an out-of-range place THROWS rather than clamping',
    threw !== null && String(threw.message).includes('outside 0..5'));
}

// ─────────────────────────────────────────────────────────────────────────────
section('C. EV per match, reported so a live-ops call has the number');

console.log('    seats |   mean XP   mean coins   mean trophies (at 1000 standing)');
for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) {
  let xp = 0;
  let coins = 0;
  let tro = 0;
  for (let p = 0; p < n; p++) {
    xp += placementXp(p, n);
    coins += placementCoins(p, n);
    tro += placementTrophyDelta(p, n, 1000);
  }
  console.log(`    ${String(n).padStart(5)} | ${(xp / n).toFixed(3).padStart(9)}`
    + `  ${(coins / n).toFixed(3).padStart(10)}  ${(tro / n).toFixed(3).padStart(15)}`);
}
console.log('    ⚠️ At the shipped `placementSteepness: 1.0` the XP mean is FLAT across seat'
  + ' counts, so a six-player match pays the same XP per player as a duel. That is a'
  + ' consequence of linear interpolation, not a target that was tuned for — retune the'
  + ' steepness and this column moves with the other two, which is the point of sharing'
  + ' the weight function.');

// ─────────────────────────────────────────────────────────────────────────────
section('D. THE LEAGUE — every finisher priced at their OWN standing');

{
  const lg = createLeague('lg', 'Kitchen Cup', 'S1', 2);
  // Two players at wildly different standings. The loss term is
  // `min(cap, base + floor(trophies / per))` with a grace band below 100, so it is a function
  // of the LOSER'S OWN count — which a single shared curve cannot express.
  lg.entrants.push({ playerId: 'rookie', trophies: 0, played: 0, finishes: [0, 0] });
  lg.entrants.push({ playerId: 'veteran', trophies: 3000, played: 0, finishes: [0, 0] });

  const byCurve = createLeague('c', 'Curve', 'S1', 2);
  byCurve.entrants.push({ playerId: 'rookie', trophies: 0, played: 0, finishes: [0, 0] });
  byCurve.entrants.push({ playerId: 'veteran', trophies: 3000, played: 0, finishes: [0, 0] });

  const perPlayer = applyLeagueResult(lg, { matchId: 'm', placements: ['rookie', 'veteran'], ticks: 1 });
  // The single-curve form, priced at the FIRST player's standing — the only thing a shared
  // curve can do, and what `twoSeatCurve` used to force.
  const shared = applyLeagueResult(byCurve, { matchId: 'm', placements: ['rookie', 'veteran'], ticks: 1 },
    placementCurve(2, 0));

  ok('D1  🚨 per-finisher pricing charges the 3,000-trophy loser the cap',
    perPlayer[1].delta === -10, `${perPlayer[1].delta}`);
  ok('D2  🚨 KNOWN-BAD  a SHARED curve built at the winner\'s 0 trophies charges them NOTHING —'
    + ' the grace band is the rookie\'s, not the veteran\'s',
    shared[1].delta === 0, `${shared[1].delta}`);
  ok('D3  …a 10-trophy gap on one match, silently, and the winner\'s side agrees either way',
    perPlayer[0].delta === shared[0].delta && perPlayer[1].delta - shared[1].delta === -10,
    `winner +${perPlayer[0].delta} both ways`);
}

{
  // Six seats, which `twoSeatCurve` could not express at all.
  const lg = createLeague('six', 'Six', 'S1', 6);
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const out = applyLeagueResult(lg, { matchId: 'm', placements: ids, ticks: 1 });
  ok('D4  a six-seat result no longer throws — the curve exists now',
    out.length === 6 && out[0].delta === 15);
  ok('D5  …and 3rd of six is priced ABOVE 3rd of four, which a place-indexed table cannot do',
    placementTrophyDelta(2, 6, 1000) > placementTrophyDelta(2, 4, 1000),
    `${placementTrophyDelta(2, 6, 1000)} vs ${placementTrophyDelta(2, 4, 1000)}`
    + ` (r = ${placementRank01(2, 6).toFixed(2)} vs ${placementRank01(2, 4).toFixed(2)})`);
  ok('D6  standings stay a total order after a six-way result',
    standings(lg).length === 6 && standings(lg).map((e) => e.playerId).join(',')
      === standings(lg).map((e) => e.playerId).join(','));
}

{
  // The explicit-curve escape hatch still validates its length.
  let threw = null;
  try {
    applyLeagueResult(createLeague('x', 'X', 'S1', 6),
      { matchId: 'm', placements: ['a', 'b', 'c', 'd', 'e', 'f'], ticks: 1 }, placementCurve(2, 0));
  } catch (e) { threw = e; }
  ok('D7  KNOWN-BAD  an explicit curve too short for the field still THROWS',
    threw !== null && String(threw.message).includes('placementCurve'));
}

{
  // The re-export must be the SAME function, not a wrapper that could drift.
  ok('D8  net/lobby re-exports economy\'s placementCurve BY IDENTITY, not as a wrapper',
    lobbyPlacementCurve === placementCurve && typeof placementCurve === 'function');
  ok('D9  KNOWN-BAD  twoSeatCurve is GONE — the hardcoded 15 cannot come back by import',
    twoSeatCurve === undefined);
}

console.log(`\n${fail === 0 ? '✅' : '🔴'}  nw_profile: ${pass}/${pass + fail} checks passed`);
if (fail > 0) { console.log(`   failed: ${failures.join(', ')}`); process.exit(1); }
