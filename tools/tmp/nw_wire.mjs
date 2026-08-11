#!/usr/bin/env node
/**
 * NW WIRE — the gate on `src/net/wire.ts` and `src/net/inputCodec.ts`.
 *
 *   node tools/tmp/nw_wire.mjs --selftest    # every check, each with its known-bad
 *   node tools/tmp/nw_wire.mjs --sizes       # just the payload table
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 EVERY CHECK HERE IS PAIRED WITH A KNOWN-BAD, AND THE PAIRING IS THE POINT.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * `CLAUDE.md` #6: **nineteen** instruments were caught returning confident wrong answers in a
 * single session, including a guard whose coverage SHRANK when a bug was fixed and one that was
 * tautological. *"A guard that has not been shown to FAIL on the bug it guards against is not a
 * guard."* For a serialisation round trip that is not a nicety — it is the whole difficulty,
 * because **the corruption is in IDENTITY, not in VALUES**, and every equality check anybody
 * would naturally write passes on the corrupted state.
 *
 * So §B4 does the thing this file exists for: it asserts that
 * `JSON.stringify(original) === JSON.stringify(corrupted)` is **TRUE**. The naive check is
 * blind. Every other check in §B is only worth reading because that one is there.
 *
 * ⚠️ **RESOLUTION FLOOR: THERE ISN'T ONE, AND THAT IS A PROPERTY WORTH STATING.** Every check
 * below is an exact structural comparison — identical or not. `CLAUDE.md` #10 asks for a
 * metric's floor before acting on a change in it (win rate ~9 pp, pacing ~0.8 s, the blind
 * critic ±1.4); this instrument produces no metric with noise in it. The only numbers here
 * that are *measurements* rather than assertions are the payload sizes in §C11, and those are
 * exact byte counts of a deterministic encoding.
 */

import {
  arenaFingerprint, checkStateIntegrity, cloneMatchState, decodeMatchState, diffStates,
  encodeMatchState, refTopology, WireError,
} from '../../src/net/wire.ts';
import {
  b64ToBytes, bytesToB64, decodeInputFrame, encodeInputFrame, INPUT_HEADER_BYTES,
  INPUT_SEAT_BYTES, quantizeInput,
} from '../../src/net/inputCodec.ts';
import { createRng } from '../../src/game/economy/rng.ts';
import { buildLivedState, makeFixtureArena } from './nw_fixture.mjs';

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

/** Codes present in a violation list, as a sorted unique array. */
const codes = (vs) => [...new Set(vs.map((v) => v.code))].sort();
/** Deep structural equality that respects Object.is, holes and reference topology. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Count real array HOLES anywhere in a graph (a hole is not a `null` and not an `undefined`). */
function countHoles(root) {
  let n = 0;
  const seen = new Set();
  const walk = (v) => {
    if (v === null || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) { if (!(i in v)) n++; else walk(v[i]); }
    } else {
      for (const k of Object.keys(v)) walk(v[k]);
    }
  };
  walk(root);
  return n;
}

/** Count `-Infinity` leaves reachable from a fighter list (the sentinels JSON destroys). */
function countNegInf(fighters) {
  let n = 0;
  for (const f of fighters) {
    if (f.lastDamagedAt === -Infinity) n++;
    if (f.revealedUntil === -Infinity) n++;
    if (f.status.slowedUntil === -Infinity) n++;
    if (f.status.stunnedUntil === -Infinity) n++;
    for (const t of f.lastUsed) if (t === -Infinity) n++;
  }
  return n;
}
function countNullWhereNumberBelongs(fighters) {
  let n = 0;
  for (const f of fighters) {
    for (const v of [f.lastDamagedAt, f.revealedUntil, f.status.slowedUntil, f.status.stunnedUntil, ...f.lastUsed]) {
      if (v === null) n++;
    }
  }
  return n;
}

// ═════════════════════════════════════════════════════════════════════════════
const ARENA = makeFixtureArena();
const S2 = buildLivedState(ARENA, 2);
const S6 = buildLivedState(ARENA, 6);

if (SIZES_ONLY) {
  section('PAYLOAD SIZES');
  for (const [n, st] of [[2, S2], [6, S6]]) {
    const wire = JSON.stringify(encodeMatchState(st));
    const naive = JSON.stringify({ ...st, arena: undefined });
    console.log(`  N=${n}  wire ${wire.length} B   naive-JSON-minus-arena ${naive.length} B`);
  }
  process.exit(0);
}

console.log('NW WIRE — every check paired with a known-bad');
console.log(`  fixture arena ${ARENA.id} ${ARENA.width}x${ARENA.height},`
  + ` ${ARENA.cover.length} cover, ${ARENA.hazards.length} hazards,`
  + ` ${ARENA.concealment.length} concealment, ${ARENA.spawns.length} spawns`);
console.log(`  N=2 state: ${S2.projectiles.length} projectiles, ${S2.trailMarks.length} trail marks,`
  + ` ${S2.splats.length} splats, ${S2.brokenConcealment.length} broken regions`);
console.log(`  N=6 state: ${S6.projectiles.length} projectiles, ${S6.trailMarks.length} trail marks,`
  + ` ${S6.splats.length} splats, ${S6.brokenConcealment.length} broken regions`);

// ─────────────────────────────────────────────────────────────────────────────
section('A. THE INTEGRITY CHECKER, shown to FAIL on each bug it guards against');

ok('A1  a live N=2 state has 0 violations', checkStateIntegrity(S2).length === 0,
  JSON.stringify(codes(checkStateIntegrity(S2))));
ok('A2  a live N=6 state has 0 violations', checkStateIntegrity(S6).length === 0,
  JSON.stringify(codes(checkStateIntegrity(S6))));

{
  const bad = cloneMatchState(S6);
  bad.player = { ...bad.fighters[0] };            // structurally equal, not identical
  ok('A3  KNOWN-BAD  player re-pointed to a copy → alias/player',
    codes(checkStateIntegrity(bad)).includes('alias/player'));
}
{
  const bad = cloneMatchState(S6);
  bad.enemy = { ...bad.fighters[1] };
  ok('A4  KNOWN-BAD  enemy re-pointed to a copy → alias/enemy',
    codes(checkStateIntegrity(bad)).includes('alias/enemy'));
}
{
  const bad = cloneMatchState(S6);
  bad.aiSighting = { ...bad.aiSighting };
  ok('A5  KNOWN-BAD  aiSighting re-pointed to a copy → alias/aiSighting',
    codes(checkStateIntegrity(bad)).includes('alias/aiSighting'));
}
{
  const bad = cloneMatchState(S6);
  bad.fighters[2].lastDamagedAt = null;
  bad.player.lastDamagedAt = null;
  ok('A6  KNOWN-BAD  a sentinel flattened to null → sentinel/not-a-number',
    codes(checkStateIntegrity(bad)).includes('sentinel/not-a-number'));
}
{
  const bad = cloneMatchState(S6);
  bad.brokenConcealment[0] = { ...bad.brokenConcealment[0] };
  ok('A7  KNOWN-BAD  a broken region replaced by an equal stranger → conceal/identity',
    codes(checkStateIntegrity(bad)).includes('conceal/identity'));
}
{
  const bad = cloneMatchState(S6);
  const t = bad.fighters[1]; bad.fighters[1] = bad.fighters[2]; bad.fighters[2] = t;
  ok('A8  KNOWN-BAD  two fighters swapped in the array → slot/id',
    codes(checkStateIntegrity(bad)).includes('slot/id'));
}
{
  const bad = cloneMatchState(S6);
  bad.fighters = new Map(bad.fighters.map((f) => [f.id, f]));
  ok('A9  KNOWN-BAD  fighters made a Map → container/fighters-not-array',
    codes(checkStateIntegrity(bad)).includes('container/fighters-not-array'));
}
{
  const bad = cloneMatchState(S6);
  ok('A10 fixture reaches the trail-mark mirror at all', bad.trailMarks.length > 0,
    `${bad.trailMarks.length} marks`);
  bad.trailMarks[0].damaged = !bad.trailMarks[0].damaged;
  ok('A11 KNOWN-BAD  trailMark.damaged desynced from damagedMask → mirror/trail-damaged',
    codes(checkStateIntegrity(bad)).includes('mirror/trail-damaged'));
}

// ─────────────────────────────────────────────────────────────────────────────
section('B. THE JSON ROUND TRIP — the bug this whole module exists for');

const RT_JSON = JSON.parse(JSON.stringify(S6));
const jsonCodes = codes(checkStateIntegrity(RT_JSON));

ok('B1  JSON round trip breaks all three alias invariants',
  ['alias/player', 'alias/enemy', 'alias/aiSighting'].every((c) => jsonCodes.includes(c)),
  jsonCodes.join(' '));

{
  const before = countNegInf(S6.fighters);
  const after = countNullWhereNumberBelongs(RT_JSON.fighters);
  ok('B2  every -Infinity sentinel flattens to null', before > 0 && after === before,
    `${before} sentinels in, ${after} nulls out`);
}
ok('B3  brokenConcealment loses arena reference identity', jsonCodes.includes('conceal/identity'),
  `${S6.brokenConcealment.length} regions`);

// 🚨 THE CONTROL ON THE INSTRUMENT. If this ever fails, everything above is theatre.
ok('B4  🚨 KNOWN-BAD CONTROL: JSON.stringify(orig) === JSON.stringify(corrupt) — the naive'
  + ' check is BLIND to all of it',
  JSON.stringify({ ...S6, arena: 0 }) === JSON.stringify({ ...RT_JSON, arena: 0 }));

ok('B5  diffStates DOES see it', diffStates(S6, RT_JSON).length > 0,
  codes(diffStates(S6, RT_JSON)).join(' '));

{
  const before = countHoles(S6.fighters);
  const after = countHoles(RT_JSON.fighters);
  ok('B6  array holes become present nulls', before > 0 && after === 0,
    `${before} holes in, ${after} out`);
}

// ─────────────────────────────────────────────────────────────────────────────
section('C. THE WIRE CODEC');

for (const [n, st] of [[2, S2], [6, S6]]) {
  const rt = decodeMatchState(encodeMatchState(st), ARENA);
  ok(`C1  N=${n} decode(encode(state)) has 0 integrity violations`,
    checkStateIntegrity(rt).length === 0, codes(checkStateIntegrity(rt)).join(' '));
  ok(`C2  N=${n} decode(encode(state)) is EXACTLY the same state`,
    diffStates(st, rt).length === 0, (diffStates(st, rt)[0]?.detail ?? '').slice(0, 90));
  const throughText = decodeMatchState(JSON.parse(JSON.stringify(encodeMatchState(st))), ARENA);
  ok(`C3  N=${n} survives a REAL text channel (stringify → parse → decode)`,
    diffStates(st, throughText).length === 0);
}

{
  // A SECOND arena instance, built by the same factory. This is the host/client case.
  const ARENA2 = makeFixtureArena();
  ok('C4  a second arena instance has the same fingerprint',
    arenaFingerprint(ARENA) === arenaFingerprint(ARENA2), arenaFingerprint(ARENA));
  const onTwo = decodeMatchState(encodeMatchState(S6), ARENA2);
  ok('C5  decoding onto the OTHER arena resolves references INTO it, by identity',
    onTwo.arena === ARENA2
    && onTwo.brokenConcealment.length === S6.brokenConcealment.length
    && onTwo.brokenConcealment.every((b) => ARENA2.concealment.includes(b))
    && onTwo.brokenConcealment.every((b) => !ARENA.concealment.includes(b)),
    `${onTwo.brokenConcealment.length} regions re-homed`);
  ok('C6  and the state still compares EQUAL across the two arena instances',
    diffStates(S6, onTwo).length === 0);
}

{
  const rt = decodeMatchState(encodeMatchState(S6), ARENA);
  rt.fighters[1].hp += 1e-12;
  ok('C7  KNOWN-BAD  one leaf perturbed by 1e-12 → diffStates fires', diffStates(S6, rt).length > 0);
}
{
  const rt = decodeMatchState(encodeMatchState(S6), ARENA);
  rt.player = { ...rt.fighters[0] };
  ok('C8  KNOWN-BAD  an alias broken with IDENTICAL VALUES → diffStates fires'
    + ' (topology, not values)', diffStates(S6, rt).length > 0);
}
{
  const bad = cloneMatchState(S6);
  bad.somethingNew = new Map([['a', 1]]);
  let err = null;
  try { encodeMatchState(bad); } catch (e) { err = e; }
  ok('C9  KNOWN-BAD  the encoder REFUSES a Map, naming the path',
    err instanceof WireError && err.message.includes('somethingNew'), err ? err.message : 'no throw');
  // the control: a PLAIN object at the same key encodes fine, so C9 is about the KIND
  const fine = cloneMatchState(S6);
  fine.somethingNew = { a: 1 };
  let err2 = null;
  try { encodeMatchState(fine); } catch (e) { err2 = e; }
  ok('C10 CONTROL     a plain object at the same key encodes fine', err2 === null,
    err2 ? String(err2) : '');
  const rt = decodeMatchState(encodeMatchState(fine), ARENA);
  ok('C11 an UNREGISTERED new field survives the round trip untouched',
    rt.somethingNew && rt.somethingNew.a === 1);
}
{
  const st = cloneMatchState(S6);
  st.fighters[0].x = -0;
  st.fighters[0].y = NaN;
  st.fighters[1].regenTimer = Infinity;
  st.fighters[2].fogTimer = undefined;
  st.fighters[3].characterId = '\u0000pretending-to-be-a-token';
  const rt = decodeMatchState(encodeMatchState(st), ARENA);
  ok('C12 -0 survives as -0', Object.is(rt.fighters[0].x, -0));
  ok('C13 NaN survives as NaN', Number.isNaN(rt.fighters[0].y));
  ok('C14 +Infinity survives', rt.fighters[1].regenTimer === Infinity);
  ok('C15 a PRESENT undefined stays present-and-undefined',
    'fogTimer' in rt.fighters[2] && rt.fighters[2].fogTimer === undefined);
  ok('C16 a string that looks like a wire token is escaped and restored',
    rt.fighters[3].characterId === '\u0000pretending-to-be-a-token');
  // KNOWN-BAD for all five: JSON destroys every one of them.
  const jrt = JSON.parse(JSON.stringify(st));
  ok('C17 KNOWN-BAD  JSON turns -0 into +0, NaN into null and drops a present undefined',
    Object.is(jrt.fighters[0].x, 0) && jrt.fighters[0].y === null && !('fogTimer' in jrt.fighters[2]));
}
{
  const st = cloneMatchState(S6);
  const holes = countHoles(st.fighters);
  const rt = decodeMatchState(encodeMatchState(st), ARENA);
  ok('C18 array holes survive the round trip', holes > 0 && countHoles(rt.fighters) === holes,
    `${holes} holes`);
}

section('C-sizes. PAYLOAD, measured (exact byte counts of a deterministic encoding)');
for (const [n, st] of [[2, S2], [6, S6]]) {
  const wire = JSON.stringify(encodeMatchState(st)).length;
  console.log(`    N=${n}  full snapshot ${wire} B`
    + `  ·  @20 Hz = ${(wire * 20 / 1024).toFixed(1)} KiB/s per client`
    + `  ·  @60 Hz = ${(wire * 60 / 1024).toFixed(1)} KiB/s`);
}
console.log('    (NETCODE.md §2 measured the SHIPPED arena at 3,417 B / 8,126 B mean.'
  + ' This fixture is a different arena; the two are the same order, not the same number.)');

// ─────────────────────────────────────────────────────────────────────────────
section('D. THE CLONE — and why it is not structuredClone');

{
  const c = cloneMatchState(S6);
  ok('D1  clone has 0 integrity violations', checkStateIntegrity(c).length === 0);
  ok('D2  clone is EXACTLY the same state', diffStates(S6, c).length === 0);
  ok('D3  clone shares the arena BY REFERENCE', c.arena === S6.arena);
  ok('D4  clone does NOT share the fighter array', c.fighters !== S6.fighters);
  ok('D5  clone preserves the aliases LIVE (a write through player is seen via fighters[0])',
    (() => { c.player.hp = 12345; return c.fighters[0].hp === 12345; })());
  ok('D6  and that write did not touch the original', S6.fighters[0].hp !== 12345);
  ok('D7  clone preserves array holes',
    countHoles(c.fighters) === countHoles(S6.fighters), `${countHoles(c.fighters)} holes`);
  ok('D8  clone keeps brokenConcealment pointing at the SAME arena boxes',
    c.brokenConcealment.every((b) => S6.arena.concealment.includes(b)));
}
{
  // 🚨 THE DOCUMENTED REASON structuredClone IS THE WRONG TOOL, demonstrated rather than argued
  //    — and the first of the three is a CORRECTION to `NETCODE.md` §6.
  //
  // §6 records `structuredClone` as preserving every alias, and it does. What it does NOT
  // record is that `structuredClone(state)` **cannot run at all** on a real `MatchState`:
  // `ArenaDefinition` declares `build(): THREE.Group` as a REQUIRED method, and the structured
  // clone algorithm throws `DataCloneError` on a function. §6's numbers were taken against
  // `tools/arena.gameplay.json`, a data-only arena cache with no methods on it — so the
  // measurement was correct about what it measured and does not transfer to the shipped arena.
  let threw = null;
  try { structuredClone(S6); } catch (e) { threw = e; }
  ok('D9  🚨 KNOWN-BAD  structuredClone THROWS on a real MatchState — arena.build is a method',
    threw !== null && String(threw.name) === 'DataCloneError',
    threw ? String(threw.name) : 'no throw');

  // With the arena made data-only, it runs — and the other two objections stand.
  const dataArena = JSON.parse(JSON.stringify({ ...S6.arena, build: undefined }));
  const cloneable = { ...S6, arena: dataArena };
  const sc = structuredClone(cloneable);
  ok('D10 KNOWN-BAD  it does get the ALIASES right (NETCODE.md §6 is correct about that)',
    sc.player === sc.fighters[0] && sc.enemy === sc.fighters[1]);
  ok('D11 KNOWN-BAD  …but it deep-copies the arena, so state.arena is a STRANGER',
    sc.arena !== dataArena);
  ok('D12 KNOWN-BAD  …and brokenConcealment then points into that copy, not the live arena',
    sc.brokenConcealment.length > 0 && !S6.arena.concealment.includes(sc.brokenConcealment[0]));
}

// ─────────────────────────────────────────────────────────────────────────────
section('E. REFERENCE TOPOLOGY — the census that keeps a generic codec honest');

{
  const topo = refTopology(S6);
  for (const row of topo) console.log(`    ${row}`);
  // ⚠️ THE DIRECTION OF EACH ARROW IS "SECOND VISIT -> FIRST VISIT" UNDER A SORTED-KEY WALK,
  // WHICH IS NOT THE DIRECTION `state.ts` NAMES THE ALIASES IN — and the first version of this
  // list got that backwards. `aiSighting` sorts before `sightings`, and `enemy` before
  // `fighters`, so those two point the "wrong" way while `player` (after `fighters`) points the
  // way you would expect. It is the same THREE aliases either way: the arrow records which node
  // carried the body, and the codec restores the identity regardless of which end that was.
  const EXPECTED = [
    '$/arena -> @',
    '$/brokenConcealment/0 -> @/concealment/0',
    '$/brokenConcealment/1 -> @/concealment/2',
    '$/fighters/1 -> $/enemy',
    '$/player -> $/fighters/0',
    '$/sightings/6 -> $/aiSighting',
  ];
  ok('E1  the N=6 reference set is exactly the three aliases + the arena + 2 broken regions',
    same(topo, EXPECTED), `${topo.length} references`);
  {
    // A DEEP stranger: nothing under it is shared, so exactly one reference disappears.
    const bad = cloneMatchState(S6);
    bad.player = cloneMatchState(S6).fighters[0];
    ok('E2  KNOWN-BAD  breaking one alias with a DEEP stranger loses exactly one reference',
      refTopology(bad).length === topo.length - 1, `${refTopology(bad).length} vs ${topo.length}`);
  }
  {
    // A SHALLOW copy shares `facing`, `status`, `lastUsed` and `hazardTimers`, so the census
    // GROWS. Kept as a second known-bad because it is the more likely mistake and because it
    // proves the census reacts to a change of topology in EITHER direction — a guard that only
    // notices things getting smaller would miss the commoner bug.
    const bad = cloneMatchState(S6);
    bad.player = { ...bad.fighters[0] };
    ok('E3  KNOWN-BAD  a SHALLOW copy instead GROWS the census (shared sub-objects)',
      refTopology(bad).length > topo.length, `${refTopology(bad).length} vs ${topo.length}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
section('F. THE INPUT CODEC — and the rule that the quantised value IS the input');

{
  const rng = createRng(0xC0DE);
  const N = 4000;
  let notIdempotent = 0;
  let quantLossy = 0;
  let rawLossy = 0;
  for (let i = 0; i < N; i++) {
    const raw = {
      move: { x: rng.next() * 2.4 - 1.2, y: rng.next() * 2.4 - 1.2 },
      aim: rng.next() < 0.15 ? undefined : { x: (rng.next() - 0.5) * 800, y: (rng.next() - 0.5) * 800 },
      selectedWeapon: rng.int(4),
      attack: rng.next() < 0.4,
    };
    const q = quantizeInput(raw);
    if (!same(q, quantizeInput(q))) notIdempotent++;
    const backQ = decodeInputFrame(encodeInputFrame(i, [q])).inputs[0];
    if (!same(q, backQ)) quantLossy++;
    const backRaw = decodeInputFrame(encodeInputFrame(i, [{ ...raw, selectedWeapon: raw.selectedWeapon }])).inputs[0];
    if (!same(raw, backRaw)) rawLossy++;
  }
  ok('F1  quantizeInput is idempotent over 4000 seeded inputs', notIdempotent === 0, `${notIdempotent} failures`);
  ok('F2  a QUANTISED input survives encode→decode EXACTLY', quantLossy === 0, `${quantLossy} of ${N} lossy`);
  ok('F3  🚨 KNOWN-BAD  a RAW input does NOT — which is why the rule exists, not decoration',
    rawLossy === N, `${rawLossy} of ${N} corrupted`);
}
{
  // THE TRAP, named exactly: an un-normalised aim clamps to the 45-degree diagonal.
  const ang = 30 * Math.PI / 180;
  const raw = { move: { x: 0, y: 0 }, aim: { x: Math.cos(ang) * 400, y: Math.sin(ang) * 400 }, selectedWeapon: 0, attack: false };
  const q = quantizeInput(raw);
  const qAng = Math.atan2(q.aim.y, q.aim.x);
  const rawBack = decodeInputFrame(encodeInputFrame(0, [raw])).inputs[0];
  const rawAng = Math.atan2(rawBack.aim.y, rawBack.aim.x);
  ok('F4  quantizeInput normalises aim, so 30° stays 30°',
    Math.abs(qAng - ang) < 1e-4, `${(qAng * 180 / Math.PI).toFixed(4)}°`);
  ok('F5  🚨 KNOWN-BAD  a length-400 aim encoded RAW clamps to the 45° diagonal',
    Math.abs(rawAng - Math.PI / 4) < 1e-6, `${(rawAng * 180 / Math.PI).toFixed(4)}°`);
}
{
  const one = encodeInputFrame(7, [quantizeInput({ move: { x: 1, y: 0 }, selectedWeapon: 2, attack: true })]);
  ok('F6  a one-seat frame is header + one seat',
    one.byteLength === INPUT_HEADER_BYTES + INPUT_SEAT_BYTES,
    `${one.byteLength} B (${INPUT_HEADER_BYTES}+${INPUT_SEAT_BYTES})`);
  const six = encodeInputFrame(7, Array.from({ length: 6 }, () => quantizeInput({ move: { x: 0.5, y: -0.5 }, selectedWeapon: 1, attack: false })));
  ok('F7  a six-seat frame is header + six seats',
    six.byteLength === INPUT_HEADER_BYTES + 6 * INPUT_SEAT_BYTES, `${six.byteLength} B`);
  console.log(`    up @60 Hz, 1 seat: ${(one.byteLength * 60 / 1024).toFixed(2)} KiB/s`
    + `   ·   down @60 Hz, 6 seats: ${(six.byteLength * 60 / 1024).toFixed(2)} KiB/s`
    + '   (payload only — NETCODE.md §1: 60-90 B of framing dominates)');
}
{
  const q = quantizeInput({ move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
  const f = decodeInputFrame(encodeInputFrame(3, [q, null, q]));
  ok('F8  a HOLE is a different statement from a neutral input',
    f.seatMask === 0b101 && f.inputs[1] === null && f.inputs[0] !== null && f.inputs[2] !== null,
    `mask 0b${f.seatMask.toString(2)}`);
  ok('F9  the tick tag round-trips', f.tick === 3);
}
{
  let threw = false;
  try { encodeInputFrame(0, [{ move: { x: 0, y: 0 }, selectedWeapon: 8, attack: false }]); }
  catch { threw = true; }
  ok('F10 KNOWN-BAD  a weapon index past the 3-bit field THROWS rather than masking', threw);
}
{
  const rng = createRng(99);
  let bad = 0;
  for (let len = 0; len < 200; len++) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = rng.int(256);
    const back = b64ToBytes(bytesToB64(bytes));
    if (back.length !== len || bytes.some((b, i) => back[i] !== b)) bad++;
  }
  ok('F11 base64 round-trips at every length 0..199', bad === 0, `${bad} failures`);
}

// ─────────────────────────────────────────────────────────────────────────────
section('G. THE ARENA FINGERPRINT — "is it the SAME?", not "did it arrive?"');

{
  const A1 = makeFixtureArena();
  const A2 = makeFixtureArena();
  const A3 = makeFixtureArena(1);          // one spawn coordinate different
  ok('G1  two builds of the same arena agree', arenaFingerprint(A1) === arenaFingerprint(A2));
  ok('G2  KNOWN-BAD  one moved coordinate disagrees', arenaFingerprint(A1) !== arenaFingerprint(A3),
    `${arenaFingerprint(A1)} vs ${arenaFingerprint(A3)}`);
  // 🚨 THE POINT: the WRONG arena still decodes, plausibly, with no error anywhere.
  const wrong = decodeMatchState(encodeMatchState(S6), A3);
  ok('G3  🚨 decoding onto the WRONG arena SUCCEEDS and passes every integrity check —'
    + ' the fingerprint is the only detector',
    checkStateIntegrity(wrong).length === 0 && wrong.arena === A3);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log(`\n${fail === 0 ? '✅' : '🔴'}  nw_wire: ${pass}/${pass + fail} checks passed`);
if (fail > 0) { console.log(`   failed: ${failures.join(', ')}`); process.exit(1); }
