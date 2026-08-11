#!/usr/bin/env node
/**
 * NW DELTA — the gate on `src/net/delta.ts`.
 *
 *   node tools/tmp/nw_delta.mjs --selftest    # every check, each with its known-bad
 *   node tools/tmp/nw_delta.mjs --sizes       # just the bandwidth table
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 THE CONTROL RECONSTRUCTS AGAINST AN INDEPENDENTLY PRODUCED FULL SNAPSHOT.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * **A delta encoder that silently drops a field looks exactly like a delta encoder that
 * correctly skipped an unchanged one.** Both make a smaller delta; both round-trip perfectly
 * against themselves. So `patchWire(prev, diffWire(prev, next))` may never be compared to
 * anything the delta machinery produced. It is compared to `encodeMatchState(nextState)` —
 * made by the ENCODER, which knows nothing about diffing — and then decoded and compared back
 * to the `MatchState` itself.
 *
 * That is the same trap this agent's own `errorWu` metric fell into: it read exactly 0.0 at
 * every latency because it compared the client's prediction chain against itself. §D2 below is
 * the proof the control has teeth — a differ deliberately blinded to `hp` is caught on the
 * first tick a fighter takes damage, and its delta is SMALLER, which is what a working delta
 * also looks like.
 *
 * ⚠️ **RESOLUTION FLOOR: none on correctness** — every round-trip check is exact structural
 * equality. The bandwidth table in §S is exact byte counts of a deterministic encoding over a
 * whole match, reported as a distribution rather than a mean because the tail is the
 * interesting part (a projectile removed from the middle of an array rewrites its tail).
 */

import {
  DELTA_VERSION, DeltaError, deltaBytes, deltaOpCount, diffWire, patchWire, wirePathTable,
} from '../../src/net/delta.ts';
import {
  checkStateIntegrity, decodeMatchState, diffStates, encodeMatchState,
} from '../../src/net/wire.ts';
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { buildLivedState, buildSuddenDeathState, buildEndedState, fixtureConfigs, makeFixtureArena, stimulus } from './nw_fixture.mjs';

const args = new Set(process.argv.slice(2));
const SIZES_ONLY = args.has('--sizes');

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function pct(xs, q) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

const ARENA = makeFixtureArena();
const DT = 1000 / 60;

/**
 * Step a real match and, at every tick, diff → patch → compare against an INDEPENDENT full
 * encode, then decode and compare back to the state.
 */
function sweep(n, ticks, { seed = 909, humans = 1, differ = diffWire } = {}) {
  const state = createMatch(ARENA, fixtureConfigs(ARENA, n, { humans }));
  let prevWire = encodeMatchState(state);
  let prevTick = 0;
  const bytes = [];
  const ops = [];
  const fullBytes = [];
  let mismatches = 0;
  let firstMismatchTick = -1;
  let decodeMismatches = 0;
  let indexOps = 0;
  let literalOps = 0;

  for (let t = 1; t <= ticks; t++) {
    const inputs = [];
    for (let s = 0; s < n; s++) inputs.push(s < humans ? stimulus(seed, t, s) : null);
    stepMatch(state, DT, inputs);

    // THE INDEPENDENT SNAPSHOT. Produced by the encoder, never by the delta path.
    const nextWire = encodeMatchState(state);
    const delta = differ(prevWire, nextWire, prevTick, t);
    const patched = patchWire(prevWire, delta, prevTick);

    if (!same(patched, nextWire)) {
      mismatches++;
      if (firstMismatchTick < 0) firstMismatchTick = t;
    }
    // …and all the way back to a MatchState, which is what a client actually renders.
    const decoded = decodeMatchState(patched, ARENA);
    if (diffStates(state, decoded).length !== 0) decodeMismatches++;

    bytes.push(deltaBytes(delta));
    ops.push(deltaOpCount(delta));
    fullBytes.push(JSON.stringify(nextWire).length);
    indexOps += delta.i.length;
    literalOps += delta.p.length;

    prevWire = patched;   // ⚠️ CHAIN FROM THE PATCHED TREE, not from `nextWire` — see §C1
    prevTick = t;
    if (state.phase === 'ended') break;
  }
  return {
    state, bytes, ops, fullBytes, mismatches, firstMismatchTick, decodeMismatches,
    indexOps, literalOps, ticks: bytes.length,
  };
}

if (SIZES_ONLY) {
  section('BANDWIDTH');
  for (const [n, humans] of [[2, 1], [6, 6]]) {
    const r = sweep(n, 900, { humans });
    console.log(`  N=${n}  delta mean ${mean(r.bytes).toFixed(0)} B  p50 ${pct(r.bytes, 0.5)}`
      + `  p99 ${pct(r.bytes, 0.99)}  max ${Math.max(...r.bytes)}`
      + `  ·  full ${mean(r.fullBytes).toFixed(0)} B  ·  ${(mean(r.fullBytes) / mean(r.bytes)).toFixed(1)}x`);
  }
  process.exit(0);
}

console.log('NW DELTA — a diff of the WIRE TREE, checked against an independent full snapshot');

// ─────────────────────────────────────────────────────────────────────────────
section('C. CORRECTNESS — every tick of a real match');

for (const [n, humans, ticks] of [[2, 1, 900], [6, 6, 900]]) {
  const r = sweep(n, ticks, { humans });
  ok(`C1  N=${n}  ${r.ticks} ticks: patch(base, diff) equals the INDEPENDENT full snapshot,`
    + ' every tick', r.mismatches === 0 && r.ticks > 100,
    r.mismatches === 0 ? `${r.ticks} ticks` : `first mismatch at tick ${r.firstMismatchTick}`);
  ok(`C2  N=${n}  …and decoding it reproduces the MatchState exactly`,
    r.decodeMismatches === 0, `${r.decodeMismatches} of ${r.ticks}`);
  ok(`C3  N=${n}  …with the chain built from the PATCHED tree, so an error would ACCUMULATE`,
    r.mismatches === 0);
}
console.log('    ⚠️ C3 is the reason the sweep re-bases on `patched` rather than on `nextWire`:'
  + ' chaining from the freshly encoded tree would silently forgive a defect on every tick, and'
  + ' a client only ever has the patched one.');

// ─────────────────────────────────────────────────────────────────────────────
section('D. THE KNOWN-BADS — a smaller delta is what BOTH a working and a broken one look like');

{
  // 🚨 A DIFFER DELIBERATELY BLINDED TO `hp`. This is the defect the whole control exists for:
  // it produces a VALID, SMALLER delta that round-trips perfectly against itself.
  // ⚠️ IT COUNTS WHAT IT DROPPED, AND THAT COUNT IS ASSERTED.
  // The first version blinded `hp` over 400 ticks and reported "0 of 400 wrong" — not because
  // the control was weak but because **nothing had taken damage yet**. 400 ticks is 6.7 s, of
  // which ~3.7 s is countdown, and six fighters spawned 892 wu apart on a 2800x2000 map had not
  // met. A known-bad with nothing to go bad on is the tautological-guard failure `CLAUDE.md` #6
  // names, and it PASSES, which is worse than failing.
  let droppedOps = 0;
  const blindDiffer = (prev, next, b, t) => {
    const d = diffWire(prev, next, b, t);
    const table = wirePathTable(prev);
    const keep = (idx) => !/(^|\/)hp$/.test(table[idx]);
    const i = [];
    const v = [];
    for (let k = 0; k < d.i.length; k++) {
      if (keep(d.i[k])) { i.push(d.i[k]); v.push(d.v[k]); } else droppedOps++;
    }
    return { ...d, i, v };
  };
  const good = sweep(6, 1400, { humans: 6 });
  const blind = sweep(6, 1400, { humans: 6, differ: blindDiffer });
  ok('D1  CONTROL  the real differ is clean over the same ticks',
    good.mismatches === 0, `${good.ticks} ticks`);
  ok('D2a CONTROL ON THE KNOWN-BAD  the blinded differ actually had `hp` ops to drop',
    droppedOps > 0, `${droppedOps} hp ops suppressed`);
  ok('D2  🚨 KNOWN-BAD  a differ blinded to `hp` is CAUGHT by the independent full snapshot',
    blind.mismatches > 0, `first mismatch at tick ${blind.firstMismatchTick},`
    + ` ${blind.mismatches} of ${blind.ticks} ticks wrong`);
  ok('D3  🚨 …and its delta is SMALLER, which is exactly what a WORKING delta also looks like —'
    + ' size can never be the test',
    mean(blind.bytes) < mean(good.bytes),
    `blind ${mean(blind.bytes).toFixed(1)} B vs good ${mean(good.bytes).toFixed(1)} B`);
}

{
  // 🚨 THE WRONG BASE, and it must be a SAME-SHAPE one to be the dangerous case.
  //
  // ⚠️ A base with different array lengths THROWS `unresolvable` on an index past the table.
  // That is a real outcome and it is the SAFE one; it is not the failure worth guarding
  // against. The dangerous case is a base of the same shape, a few ticks out of step, where
  // every index resolves and nothing anywhere complains.
  //
  // ⚠️ AND IT MUST BE SAMPLED INSIDE THE PLAYING PHASE. The first version took ticks 3, 4 and 6
  // — all inside the ~223-tick COUNTDOWN, where `stepMatch` runs no fighter loop and only the
  // clock fields move. Applying delta(3->4) to tick 6 therefore reproduced tick 4 EXACTLY and
  // the known-bad reported "no corruption". Same countdown trap that made two of
  // `nw_stack.mjs`'s known-bads pass falsely.
  const arena2 = makeFixtureArena();
  const live = createMatch(arena2, fixtureConfigs(arena2, 6, { humans: 6 }));
  const wires = new Map();
  const shape = new Map();
  for (let t = 0; t <= 1000; t++) {
    if (t > 0) {
      const inputs = [];
      for (let s2 = 0; s2 < 6; s2++) inputs.push(stimulus(31, t, s2));
      stepMatch(live, DT, inputs);
    }
    if (t >= 600) {
      const w = encodeMatchState(live);
      wires.set(t, w);
      shape.set(t, wirePathTable(w).join('\u0001'));
    }
  }
  ok('D3b CONTROL  the wrong-base sample is taken from the PLAYING phase, not the countdown',
    live.phase === 'playing', live.phase);

  // 🚨 SEARCH FOR A SAME-SHAPE PAIR RATHER THAN GUESSING ONE.
  // Ticks with different array lengths have different path tables, and `patchWire` then throws
  // `unresolvable` on an index past the end — which is the SAFE failure and is not the one worth
  // guarding against. The dangerous base is one whose table is IDENTICAL: every index resolves,
  // every value lands somewhere real, and nothing complains. Two arbitrary ticks were tried
  // first and threw; searching makes the demonstration deterministic instead of lucky.
  //
  // ⚠️ AND THE SEARCH REQUIRES THE CORRUPTION ITSELF, not just a matching shape. The first
  // version searched only for equal path tables and then asserted that the forged patch was no
  // real tick — which is true for most pairs and FALSE for some (during a stretch where little
  // moves, patching tick B with delta(A->A+1) can reproduce tick A+1 exactly). That made the
  // known-bad depend on which pair the search happened to hit first, and it went red the moment
  // a peer's in-flight `sim.ts` shifted the match. Folding the requirement into the search makes
  // the demonstration deterministic: it looks for a pair that actually demonstrates the hazard,
  // and says so plainly if the window contains none.
  const ticks = [...wires.keys()];
  let from = -1;
  let onto = -1;
  let wrong = null;
  outer:
  for (const a of ticks) {
    // ⚠️ ONLY `shape(a) === shape(b)` MATTERS, and requiring `shape(a) === shape(a+1)` too
    // found nothing: at six seats the projectile array changes length on most ticks, so
    // consecutive shapes rarely match. The delta's indices are drawn from A's table, so B only
    // has to share A's shape for every one of them to resolve — which is precisely the
    // dangerous configuration.
    if (!wires.has(a + 1)) continue;
    const cand = diffWire(wires.get(a), wires.get(a + 1), a, a + 1);
    for (const b of ticks) {
      if (b - a < 3 || shape.get(b) !== shape.get(a)) continue;
      const patched = patchWire(wires.get(b), { ...cand, b }, b);
      const txt = JSON.stringify(patched);
      if ([...wires.values()].every((w) => JSON.stringify(w) !== txt)) {
        from = a; onto = b; wrong = patched; break outer;
      }
    }
  }
  ok('D4a CONTROL  a same-shape pair that ACTUALLY corrupts exists to demonstrate with',
    from >= 0 && wrong !== null,
    from >= 0 ? `delta ${from}->${from + 1} applied onto ${onto}` : 'none found in the window');
  const delta = diffWire(wires.get(from), wires.get(from + 1), from, from + 1);

  let threw = null;
  try { patchWire(wires.get(onto), delta, onto); } catch (e) { threw = e; }
  ok('D4  🚨 a delta applied to the WRONG base is REFUSED on the base tick',
    threw instanceof DeltaError && threw.code === 'base-mismatch', threw ? threw.code : 'no throw');

  // Now bypass the check, exactly as a receiver without it would. `wrong` is the tree the
  // search already produced from this exact pair.
  const decoded = decodeMatchState(wrong, arena2);
  const differsFromAll = [...wires.values()].every((w) => JSON.stringify(w) !== JSON.stringify(wrong));
  ok('D5  🚨 KNOWN-BAD  with the check bypassed it produces a COMPLETE, VALID state that passes'
    + ' every integrity invariant — and is no tick of any match',
    checkStateIntegrity(decoded).length === 0 && differsFromAll,
    `${checkStateIntegrity(decoded).length} violations, matches none of ${wires.size} real ticks`);
  // ⚠️ **D5b USED TO CLAIM A DIFFERENT-SHAPE BASE IS ALWAYS CAUGHT STRUCTURALLY. IT IS NOT,
  // AND THE FIRST VERSION OF THIS ROW ASSERTED IT AND WENT RED.** A mismatched shape throws
  // only when an index falls past the end of the base's table or a path fails to resolve;
  // when the other tree happens to be large enough and the paths happen to exist, it patches
  // silently. So the split is MEASURED rather than asserted, and the conclusion is the
  // stronger one: **structural catching is a bonus, never the guard.** The base tick is.
  let structurallyCaught = 0;
  let silentlyPatched = 0;
  for (const t of ticks) {
    if (shape.get(t) === shape.get(from)) continue;
    try { patchWire(wires.get(t), { ...delta, b: t }, t); silentlyPatched++; }
    catch (e) { if (e instanceof DeltaError) structurallyCaught++; else throw e; }
  }
  ok('D5b the structural catch is a BONUS, not the guard — measured over every different-shape'
    + ' base in the window',
    structurallyCaught + silentlyPatched > 0,
    `${structurallyCaught} threw, ${silentlyPatched} patched SILENTLY`
    + ` (${(100 * silentlyPatched / Math.max(1, structurallyCaught + silentlyPatched)).toFixed(0)}%`
    + ' of wrong bases would have gone unnoticed without the tick check)');

  let versionThrew = null;
  try { patchWire(wires.get(from), { ...delta, z: DELTA_VERSION + 1 }, from); } catch (e) { versionThrew = e; }
  ok('D6  a delta from a future format version is refused too',
    versionThrew instanceof DeltaError && versionThrew.code === 'version');
}

{
  // 🚨 THE PATH TABLE MUST NOT DEPEND ON INSERTION ORDER.
  // A patched tree has keys appended in delta order, not sorted order. If the table were built
  // by insertion order the two ends would disagree the first time a delta added a key, and
  // every later index would address the wrong field.
  const base = { b: 1, d: 2 };
  const patched = { ...base };
  patched.c = 3;                      // appended: insertion order is b, d, c
  const fresh = { b: 1, c: 3, d: 2 }; // sorted order: b, c, d
  ok('D7  🚨 the path table is a function of SHAPE, not of insertion order',
    same(wirePathTable(patched), wirePathTable(fresh)),
    wirePathTable(patched).join(' '));
  const insertionOrder = ['', 'b', 'd', 'c'];
  ok('D8  🚨 KNOWN-BAD  an insertion-order table WOULD have disagreed — the two differ',
    !same(insertionOrder, wirePathTable(fresh)),
    `${insertionOrder.join(' ')}  vs  ${wirePathTable(fresh).join(' ')}`);
}

{
  const w = encodeMatchState(buildLivedState(ARENA, 6));
  const d = diffWire(w, w, 5, 6);
  ok('D9  identical trees produce an EMPTY delta', deltaOpCount(d) === 0, `${deltaBytes(d)} B`);
  ok('D10 …which still patches to the same tree', same(patchWire(w, d, 5), w));
}

// ─────────────────────────────────────────────────────────────────────────────
section('E. THE SHAPES A MID-MATCH SWEEP MIGHT NOT REACH');

{
  // Arrays that GROW and SHRINK, keys that appear and vanish, and the sentinel/hole tokens
  // riding inside delta values.
  const s0 = buildLivedState(ARENA, 6);
  // ⚠️ A REAL CHANGE ON BOTH SIDES. The first version set `lastDamagedAt = -Infinity` on a
  // fighter that was ALREADY at -Infinity, so the sentinel never entered a delta and §E2
  // reported zero set-by-index ops while still passing §E1.
  s0.fighters[2].lastDamagedAt = 1234.5;
  const w0 = encodeMatchState(s0);
  const s1 = buildLivedState(ARENA, 6);
  s1.projectiles = s1.projectiles.slice(0, 1);         // shrink
  s1.splats.push({ ...s1.splats[0], id: 99999 });      // grow
  s1.fighters[2].lastDamagedAt = -Infinity;            // a SENTINEL travelling inside a delta
  s1.fighters[3].hazardTimers[5] = 1;                  // new holes at 4
  delete s1.fighters[4].revealedUntil;                 // key removed
  s1.fighters[4].somethingNew = { a: -0 };             // key added, carrying -0
  const w1 = encodeMatchState(s1);
  const d = diffWire(w0, w1, 1, 2);
  const patched = patchWire(w0, d, 1);
  ok('E1  grow, shrink, key added, key removed, sentinel, -0 and a new hole all round-trip',
    same(patched, w1), `${deltaOpCount(d)} ops, ${deltaBytes(d)} B`);
  ok('E2  …and the delta really exercised all four op kinds',
    d.i.length > 0 && d.p.length > 0 && d.d.length > 0 && d.n.length > 0,
    `set-by-index ${d.i.length}, set-by-path ${d.p.length}, delete ${d.d.length}, length ${d.n.length}`);
  const dec = decodeMatchState(patched, ARENA);
  ok('E3  …and the decoded state keeps -0 as -0 through the DELTA path',
    Object.is(dec.fighters[4].somethingNew.a, -0));
}

{
  // 🚨 THE STATE SPACE THAT ONLY SHIPPED ON 2026-08-11 (`f87d407`).
  // `buildLivedState` stops at 6.7 s; sudden death arms at 30 s of playing. Before this arm
  // existed the codec had never been asked about `safeRadius === 0`, corpses, or a set winner.
  for (const [label, build] of [['suddenDeath', buildSuddenDeathState], ['ended', buildEndedState]]) {
    for (const n of [2, 6]) {
      const a = build(ARENA, n);
      const b = build(ARENA, n, { seed: 5150 });
      const wa = encodeMatchState(a);
      const wb = encodeMatchState(b);
      const patched = patchWire(wa, diffWire(wa, wb, 1, 2), 1);
      ok(`E4  ${label} N=${n}: a delta between two ${label} states round-trips exactly`,
        same(patched, wb) && diffStates(b, decodeMatchState(patched, ARENA)).length === 0,
        `safeRadius ${a.safeRadius.toFixed(1)}, alive ${a.fighters.filter((f) => f.alive).length}/${n},`
        + ` winnerId ${String(a.winnerId)}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
section('S. BANDWIDTH — measured over a whole match, reported as a distribution');

console.log('    N | ticks |  delta mean   p50    p99    max |  full mean |  saving');
const sizeRows = [];
for (const [n, humans] of [[2, 1], [6, 6]]) {
  const r = sweep(n, 900, { humans });
  sizeRows.push({ n, r });
  console.log(`    ${n} | ${String(r.ticks).padStart(5)} | ${mean(r.bytes).toFixed(0).padStart(11)}`
    + ` ${String(pct(r.bytes, 0.5)).padStart(5)} ${String(pct(r.bytes, 0.99)).padStart(6)}`
    + ` ${String(Math.max(...r.bytes)).padStart(6)} | ${mean(r.fullBytes).toFixed(0).padStart(10)}`
    + ` | ${(mean(r.fullBytes) / mean(r.bytes)).toFixed(1)}x`);
}
{
  const six = sizeRows.find((x) => x.n === 6).r;
  console.log(`    ops/tick at N=6: mean ${mean(six.ops).toFixed(1)}, p99 ${pct(six.ops, 0.99)}`
    + `  (NETCODE.md §2 measured 35.9 mean / 161 p99 changed leaves on the shipped arena)`);
  console.log(`    of ${six.indexOps + six.literalOps} set ops,`
    + ` ${(100 * six.indexOps / (six.indexOps + six.literalOps)).toFixed(1)}% addressed by INDEX`
    + ' into the base-derived table; the rest carried a literal path because the position did'
    + ' not exist in the base.');
  const perClient20 = mean(six.bytes) * 20 / 1024;
  const fullPerClient20 = mean(six.fullBytes) * 20 / 1024;
  console.log(`    six clients @20 Hz: ${(fullPerClient20 * 6).toFixed(1)} KiB/s full`
    + ` -> ${(perClient20 * 6).toFixed(1)} KiB/s delta`
    + `  (${fullPerClient20.toFixed(1)} -> ${perClient20.toFixed(1)} KiB/s per client)`);
  ok('S1  the delta is materially smaller than the full snapshot at N=6',
    mean(six.fullBytes) / mean(six.bytes) > 5,
    `${(mean(six.fullBytes) / mean(six.bytes)).toFixed(1)}x`);
}
console.log('    ⚠️ JSON, not binary. NETCODE.md §2 measured a BINARY delta at ~220 B by spending'
  + ' a uint16 field id and a float32 per leaf; this spends ~10 characters per float because it'
  + ' is text. The remaining gap is an encoding layer UNDER this one, not a better diff.');

console.log(`\n${fail === 0 ? '✅' : '🔴'}  nw_delta: ${pass}/${pass + fail} checks passed`);
if (fail > 0) { console.log(`   failed: ${failures.join(', ')}`); process.exit(1); }
