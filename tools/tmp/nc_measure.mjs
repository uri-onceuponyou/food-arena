#!/usr/bin/env node
/**
 * NC_MEASURE — the numbers `docs/NETCODE.md` decides the transport on.
 *
 * Every claim in that document that is a NUMBER comes out of this file. Nothing here is a
 * netcode opinion; it measures six properties of THIS sim and prints them:
 *
 *   1. INPUT      what one tick's `MatchInputs` costs on the wire, at N=2 and N=6.
 *   2. STATE      what a full `MatchState` snapshot costs, and what a per-tick delta costs.
 *   3. TICK COST  how long `stepMatch` takes, and therefore how many re-simulated ticks fit
 *                 in a frame — the rollback budget.
 *   4. DETERMINISM  what a lockstep design would have to pin, measured LIVE (a counter on
 *                 `Math.random` through a whole match) rather than grepped.
 *   5. stepAI     how much of the tick the AI is, because "a server running six bots" and
 *                 "a server running six humans" are different propositions.
 *   6. FIDELITY   whether `MatchState` survives a serialise/restore round trip AT ALL.
 *                 (It does not, and the reason is aliasing, not floats. See §6.)
 *
 * ── WHY IT DOES NOT BUILD A SECOND HARNESS ──────────────────────────────────
 *
 * The driver is IMPORTED from `tools/tmp/scripted_player.mjs` (`driver_guard.mjs`'s census
 * fails a fourteenth copy). ⚠️ AND ITS CENSUS IS A BARE SUBSTRING SWEEP over every `.mjs` in
 * `tools/`, so a file that merely NAMES the nav's latch field in prose is indicted as a copy
 * of the driver — this comment did exactly that and turned the gate red until the word was
 * removed. `driver_guard.mjs` handles the same problem for itself by registering itself as
 * `GUARD`; a file that cannot edit the registry has to avoid the token instead. The ring fixture is the
 * same shape as `conceal_lab.mjs:ringConfigs` — the arena declares two spawns and
 * `createMatch` refuses to invent a third (`DECISIONS §49d`), so a ring here is a
 * MEASUREMENT FIXTURE and explicitly not a spawn proposal.
 *
 * ⚠️ The scripted driver has a TWO-SEAT VIEW by design, so above N=2 it is a deterministic
 * STIMULUS. **Nothing in this file is a balance claim** — a 4-6 fighter balance number is a
 * different quantity and its instrument does not exist (`DECISIONS §49b`).
 *
 * ── WHAT `--selftest` VALIDATES, AND WHY EVERY ROW HAS A KNOWN-BAD ──────────
 *
 * `CLAUDE.md` #6: an instrument that has not been shown to FAIL on a bad input is not an
 * instrument. Each measurement here has a control that would move if it were broken:
 *
 *   the byte counter        a string of known length, and a `-Infinity` payload that
 *                           `JSON.stringify` silently turns into `null` (so the "JSON
 *                           bytes" number is measured with a replacer that does not lie)
 *   the delta counter       two states differing in exactly K known leaves -> K
 *   the timer               the same work done 8x must cost 4x..16x; a timer that returns a
 *                           constant fails both directions
 *   the rng counter         it must count a draw we make ourselves, and report zero for a
 *                           match — a counter that is simply broken reports zero too
 *   the alias checker       must PASS on a real state and FAIL on one whose aliases were
 *                           deliberately unpicked
 *   the stepAI probe        the patched source must actually differ from the original
 *
 *   node tools/tmp/nc_measure.mjs             # the full table (~40 s)
 *   node tools/tmp/nc_measure.mjs --selftest  # instrument validation only (~3 s)
 *   node tools/tmp/nc_measure.mjs --quick     # fewer matches, for a smoke run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createScriptedPlayer, rng, DRIVER_REV } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
  }),
);

const DT = Number(args.dt ?? 16.667);
const HZ = 1000 / DT;

// ─────────────────────────────────────────────────────────────────────────────
// The sim, and the tree control
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ THE CONTROL IS PER FILE, NOT PER DIRECTORY. `1b506d6` discarded two whole batteries to
 * learn that: `src/game/` is a directory this project SHARES between owners, so a hash over
 * the directory moves when a peer commits something unrelated and says nothing about the
 * seven files the numbers actually came from.
 */
const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];
const CONTROL_FILES = [...SIM_MODULES.map((f) => `src/game/${f}`), 'src/arena/types.ts'];

function controlHashes() {
  const out = {};
  for (const f of CONTROL_FILES) {
    out[f] = createHash('sha256').update(readFileSync(`${ROOT}/${f}`)).digest('hex').slice(0, 8);
  }
  return out;
}

function headHashes() {
  const out = {};
  for (const f of CONTROL_FILES) {
    const src = execFileSync('git', ['show', `HEAD:${f}`], { cwd: ROOT, encoding: 'utf8' });
    out[f] = createHash('sha256').update(Buffer.from(src)).digest('hex').slice(0, 8);
  }
  return out;
}

/** A sim copied to the OS temp dir with literal source edits applied. */
function patchedSimDir(tag, edits) {
  const root = join(tmpdir(), `fa-nc-${tag}`);
  const dir = join(root, 'game');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, 'arena'), { recursive: true });
  for (const f of SIM_MODULES) writeFileSync(join(dir, f), readFileSync(`${ROOT}/src/game/${f}`, 'utf8'));
  writeFileSync(join(root, 'arena', 'types.ts'), readFileSync(`${ROOT}/src/arena/types.ts`, 'utf8'));
  const applied = [];
  for (const [file, from, to] of edits) {
    const before = readFileSync(join(dir, file), 'utf8');
    const after = before.replace(from, to);
    applied.push(after !== before);
    writeFileSync(join(dir, file), after);
  }
  return { dir, applied };
}

async function loadSim(dir) {
  const sim = await import(`${dir}/sim.ts`);
  const rules = await import(`${dir}/rules.ts`);
  const ai = await import(`${dir}/ai.ts`);
  const state = await import(`${dir}/state.ts`);
  return { ...sim, RULES: rules, pressValue: ai.pressValue, ST: state, dir };
}

const LIVE = await loadSim(`${ROOT}/src/game`);
const { CHARACTER_IDS, MATCH_DURATION_MS, REACH } = LIVE.RULES;
const { MAX_FIGHTERS, MIN_FIGHTERS, nearestLivingOpponent } = LIVE.ST;

// ─────────────────────────────────────────────────────────────────────────────
// Arena — the shipped kitchen, with the derived ring (identical to roster_lab/conceal_lab)
// ─────────────────────────────────────────────────────────────────────────────

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const FOG_FIRST_CONTACT_MS = 6000;
function withDerivedRing(d) {
  const halfDiag = Math.hypot(d.width / 2, d.height / 2);
  return {
    ...d,
    concealment: d.concealment ?? [],
    maxSafeRadius: halfDiag * (MATCH_DURATION_MS / (MATCH_DURATION_MS - FOG_FIRST_CONTACT_MS)),
  };
}
const ARENA = existsSync(ARENA_PATH) ? withDerivedRing(JSON.parse(readFileSync(ARENA_PATH, 'utf8'))) : null;

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUMENTS — each one has a known-bad in `--selftest`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BYTES ON THE WIRE, WITHOUT THE LIE `JSON.stringify` TELLS.
 *
 * `MatchState` is full of `-Infinity` sentinels (`lastDamagedAt`, every `lastUsed` slot,
 * both status deadlines, `revealedUntil`). `JSON.stringify` flattens every one of them to
 * `null` — 4 bytes for a value that a serialiser which round-trips must spend more on, and
 * `1b506d6` records that comparing two states with `stringify` makes exactly those fields
 * compare EQUAL. So the replacer encodes them as strings, which is what any real JSON
 * transport has to do, and the count is honest.
 */
function jsonBytes(v) {
  return Buffer.byteLength(JSON.stringify(v, (_k, x) =>
    (typeof x === 'number' && !Number.isFinite(x) ? `#${x}` : x)), 'utf8');
}

/** The comparable half of a MatchState — `conceal_lab.mjs:comparable`, not a second list. */
function comparable(state) {
  const { arena: _arena, ...rest } = state;
  return rest;
}

/** Every leaf path in a value, so a delta can be counted rather than estimated. */
function leafPaths(v, path, out) {
  if (v === null || typeof v !== 'object') { out.push(path); return out; }
  if (Array.isArray(v)) { v.forEach((e, i) => leafPaths(e, `${path}[${i}]`, out)); return out; }
  for (const k of Object.keys(v)) {
    if (typeof v[k] === 'function') continue;
    leafPaths(v[k], `${path}.${k}`, out);
  }
  return out;
}

/** A flat `path -> leaf value` map, which is what a naive delta encoder diffs. */
function flatten(v) {
  const out = new Map();
  for (const p of leafPaths(v, '', [])) out.set(p, getPath(v, p));
  return out;
}
function getPath(root, path) {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
    .reduce((o, k) => (o === undefined || o === null ? o : o[k]), root);
}

/**
 * THE DELTA: which leaves changed between two consecutive states, and what the smallest
 * honest JSON encoding of that change costs.
 *
 * ⚠️ IT IS AN UPPER BOUND ON THE PAYLOAD AND A LOWER BOUND ON THE COST. `{path: value}`
 * spends the path string on every field; a real delta protocol spends a field INDEX (1-2
 * bytes) instead. Both numbers are printed, because the difference between them is exactly
 * the engineering a delta protocol IS.
 */
function deltaOf(prev, next) {
  const a = flatten(prev);
  const b = flatten(next);
  const changed = {};
  let n = 0, added = 0, removed = 0;
  for (const [k, v] of b) {
    if (!a.has(k)) { added++; changed[k] = v; n++; continue; }
    if (!Object.is(a.get(k), v)) { changed[k] = v; n++; }
  }
  for (const k of a.keys()) if (!b.has(k)) { removed++; changed[k] = null; n++; }
  return { n, added, removed, jsonBytes: jsonBytes(changed), fields: n };
}

/** Median / p99 of a numeric array, on a copy. */
function stats(xs) {
  const s = xs.slice().sort((p, q) => p - q);
  const at = (f) => s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1))))];
  return {
    n: s.length,
    min: s[0], max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
    p50: at(0.5), p95: at(0.95), p99: at(0.99),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The fixture — N fighters on a ring. NOT a spawn proposal (DECISIONS §49d).
// ─────────────────────────────────────────────────────────────────────────────

function ringConfigs(arena, n, rotation = 0, controller = null) {
  const cx = arena.center.x, cy = arena.center.y;
  const r = Math.hypot(arena.playerSpawn.x - cx, arena.playerSpawn.y - cy);
  const a0 = Math.atan2(arena.playerSpawn.y - cy, arena.playerSpawn.x - cx);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i * 2 * Math.PI) / n;
    const cfg = {
      characterId: CHARACTER_IDS[(i + rotation) % CHARACTER_IDS.length],
      spawn: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
    };
    if (controller) cfg.controller = controller;
    out.push(cfg);
  }
  return out;
}

/**
 * ONE SEAT'S VIEW OF THE MATCH, for the two-seat driver.
 *
 * The scripted player reads `state.player` and `state.enemy` and nothing else about the
 * roster, so a seat is driven by handing it a SHALLOW spread whose `player` is that seat's
 * real `Fighter` object and whose `enemy` is whatever `nearestLivingOpponent` returns —
 * the same function `ai.ts` and `combat.ts` both call, never a re-derivation. The spread is
 * allocation in the DRIVER, which is outside every timer in this file.
 */
function seatView(state, i) {
  const me = state.fighters[i];
  const foe = nearestLivingOpponent(state, me) ?? state.fighters[(i + 1) % state.fighters.length];
  return { ...state, player: me, enemy: foe };
}

/**
 * ONE DRIVER PER ARENA OBJECT, imported and never copied — `driver_guard.mjs`'s census
 * fails a fourteenth private copy of the scripted player, and this file carries none.
 */
const DRIVERS = new WeakMap();
function driverFor(arena) {
  let d = DRIVERS.get(arena);
  if (!d) {
    d = createScriptedPlayer({
      CHARACTERS: LIVE.RULES.CHARACTERS, REACH, arena,
      pressValue: LIVE.pressValue, selfHealHpFraction: LIVE.RULES.AI_SELF_HEAL_HP_FRACTION,
    });
    DRIVERS.set(arena, d);
  }
  return d;
}

const POLICY = String(args.policy ?? 'smart2');

/**
 * Run one match. `hooks.beforeStep(state, tick)` and `hooks.afterStep(state, evs, tick, ns)`
 * run outside every timer; `ns` is the nanoseconds `stepMatch` itself took.
 *
 * `humanSeats` selects the ARRAY form of `MatchInputs` (one input per slot). With the array
 * form every seat listed as `'human'` gets its own driver instance; the rest are AI and read
 * a hole, which `sim.ts` resolves to `NEUTRAL_INPUT`.
 */
function runMatch(sim, { configs, seed, hooks = {}, maxTicks = Infinity, arrayInputs = false }, arena = ARENA) {
  const state = sim.createMatch(arena, configs);
  const driver = driverFor(arena);
  const n = configs.length;
  const loops = [];
  for (let i = 0; i < n; i++) {
    const rnd = rng(seed * 7919 + i * 104729 + configs[i].characterId.length * 131 + POLICY.length);
    loops.push(driver.createDecisionLoop({
      decide: driver.POLICY_FNS[POLICY](rnd), reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd,
    }));
  }
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0, evTotal = 0, playTicks = 0, stepNs = 0n;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP && tick < maxTicks) {
    let input;
    if (arrayInputs) {
      input = state.fighters.map((f, i) => (f.controller === 'human' ? loops[i].next(seatView(state, i), DT) : null));
    } else {
      input = loops[0].next(seatView(state, 0), DT);
    }
    if (hooks.beforeStep) hooks.beforeStep(state, tick, input);
    const phaseBefore = state.phase;
    const t0 = process.hrtime.bigint();
    const evs = sim.stepMatch(state, DT, input);
    const ns = process.hrtime.bigint() - t0;
    /**
     * ⚠️ "DID THE FIGHTER LOOP RUN" IS NOT "WAS THE PHASE `playing` BEFORE THE STEP".
     * `stepCountdown` runs FIRST inside `stepMatch`, so on the whistle tick the phase is
     * still `countdown` on the way in and the fighter loop runs anyway — and that tick is
     * the single most expensive one in the match, because it is where the nav field is
     * first flooded. Booking it as a countdown tick made `stepAI`'s share come out at
     * 98.1% + 2.6% = 100.7%, i.e. NEGATIVE for everything else. A share above 100% is the
     * arithmetic telling you the denominator is the wrong set of ticks.
     */
    const ranLoop = phaseBefore === 'playing' || (phaseBefore === 'countdown' && state.phase !== 'countdown');
    tick++;
    evTotal += evs.length;
    if (ranLoop) { playTicks++; stepNs += ns; }
    if (hooks.afterStep) hooks.afterStep(state, evs, tick, Number(ns), input, ranLoop);
  }
  return { state, tick, events: evTotal, playTicks, stepNs: Number(stepNs) };
}

// ─────────────────────────────────────────────────────────────────────────────
// The alias invariants — §6's subject
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHAT A RESTORED `MatchState` MUST STILL BE TRUE OF.
 *
 * These are not style checks. `state.player` IS `state.fighters[0]` — the SAME OBJECT, by
 * reference, and `state.ts` says out loud that making them getters instead would silently
 * break the bit-identity differ. `state.aiSighting` IS `sightings[1*n+0]`, and `stepAI`
 * mutates the cell expecting the alias to see it. `brokenConcealment` holds arena boxes BY
 * REFERENCE, and `movement.ts:isConcealed` tests them with reference identity.
 *
 * A transport that serialises state has to restore every one of these. `JSON.parse` does
 * not, and it fails SILENTLY: the restored state has two independent copies of every
 * fighter, so a write through `state.player` is invisible through `state.fighters[0]`.
 */
function aliasFaults(state) {
  const bad = [];
  if (!state.fighters) return ['no fighters array'];
  if (state.player !== state.fighters[0]) bad.push('player !== fighters[0]');
  if (state.enemy !== state.fighters[1]) bad.push('enemy !== fighters[1]');
  const n = state.fighters.length;
  if (state.sightings && state.aiSighting !== state.sightings[1 * n + 0]) bad.push('aiSighting !== sightings[n+0]');
  for (let i = 0; i < n; i++) if (state.fighters[i].id !== i) bad.push(`fighters[${i}].id !== ${i}`);
  return bad;
}

/**
 * THE stepAI TIMING PROBE'S ANCHORS.
 *
 * ⚠️ EVERY ANCHOR IS A LINE OF CODE, NEVER A COMMENT. `1b506d6` records a known-bad that
 * silently became a no-op because its second anchor quoted a comment — and comments are
 * rewritten exactly when the rule under them changes meaning, which is when a control
 * matters most. `--selftest` §F asserts the patch landed, in both directions.
 *
 * The inserted code is plain JS on purpose: Node strips types from `.ts` without checking
 * them, so a TS assertion in a probe would compile here and be a landmine if the file were
 * ever run through `tsc`. It never is — `patchedSimDir` writes OUTSIDE the repo, because a
 * scratch `.ts` under `tools/` is inside `tsconfig.json`'s include and turns `npx tsc
 * --noEmit` red for every agent at once.
 */
const AI_ANCHOR = '        moved = stepAI(state, fighter, dt, events);';
const AI_PATCH = '        { const __t = process.hrtime.bigint();'
  + ' moved = stepAI(state, fighter, dt, events);'
  + ' globalThis.__ncAiNs += Number(process.hrtime.bigint() - __t);'
  + ' globalThis.__ncAiCalls++; }';
const HUMAN_ANCHOR = `        applyAim(fighter, fi);
        if (fi.attack) attemptAttack(state, fighter, fi.selectedWeapon, events);
        moved = moveFighter(state, fighter, dt, fi);`;
const HUMAN_PATCH = `        { const __t2 = process.hrtime.bigint();
        applyAim(fighter, fi);
        if (fi.attack) attemptAttack(state, fighter, fi.selectedWeapon, events);
        moved = moveFighter(state, fighter, dt, fi);
        globalThis.__ncHumanNs += Number(process.hrtime.bigint() - __t2);
        globalThis.__ncHumanCalls++; }`;

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════

if (args.selftest) {
  let pass = 0; const fails = [];
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fails.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`   FAIL  ${name}  ${detail}`); }
  };
  console.log('\n══ nc_measure --selftest ══  every instrument against a known input\n');

  // ── A. the byte counter ───────────────────────────────────────────────────
  ok('A1 jsonBytes counts a known payload', jsonBytes({ a: 1 }) === 7, `got ${jsonBytes({ a: 1 })}, want 7 for {"a":1}`);
  /**
   * BYTES, NOT CHARACTERS. `JSON.stringify('🍔').length` is 4 — two surrogate code units
   * plus two quotes — and the same string is 6 BYTES on a wire. Every event and every
   * weapon in this game carries an emoji, so a length-based counter under-reports exactly
   * the fields this sim has most of.
   */
  ok('A2 jsonBytes counts multibyte as UTF-8, not as chars',
    jsonBytes('🍔') === 6 && JSON.stringify('🍔').length === 4,
    `bytes ${jsonBytes('🍔')} (want 6), chars ${JSON.stringify('🍔').length} (the known-bad, 4)`);
  /**
   * THE KNOWN-BAD: a bare `JSON.stringify` reports 4 bytes for `-Infinity` because it emits
   * `null`. The whole reason `jsonBytes` takes a replacer is that this sim is FULL of those
   * sentinels, so the naive count is systematically short and silently lossy.
   */
  const sent = { lastDamagedAt: -Infinity };
  ok('A3 the naive counter under-reports a -Infinity sentinel (the known-bad)',
    Buffer.byteLength(JSON.stringify(sent)) < jsonBytes(sent),
    `naive ${Buffer.byteLength(JSON.stringify(sent))} < honest ${jsonBytes(sent)}`);
  ok('A4 and the naive one loses it entirely on a round trip',
    JSON.parse(JSON.stringify(sent)).lastDamagedAt === null);

  // ── B. the delta counter ──────────────────────────────────────────────────
  const b0 = { a: 1, b: { c: 2, d: [3, 4] }, e: 'x' };
  const b1 = { a: 1, b: { c: 9, d: [3, 7] }, e: 'x' };
  ok('B1 delta counts exactly the changed leaves', deltaOf(b0, b1).n === 2, `got ${deltaOf(b0, b1).n}, want 2`);
  ok('B2 delta of a state with itself is zero', deltaOf(b0, b0).n === 0);
  ok('B3 a grown array is counted as an addition', deltaOf(b0, { ...b0, b: { c: 2, d: [3, 4, 5] } }).added === 1);
  ok('B4 a shrunk array is counted as a removal', deltaOf(b0, { ...b0, b: { c: 2, d: [3] } }).removed === 1);
  /** KNOWN-BAD: `Object.is` and not `===`, so a 0/-0 flip is a real change and NaN/NaN is not. */
  ok('B5 delta sees -0 as a change (Object.is, not ===)', deltaOf({ z: 0 }, { z: -0 }).n === 1);
  ok('B6 delta does NOT report NaN -> NaN as a change', deltaOf({ z: NaN }, { z: NaN }).n === 0);

  // ── C. the timer ──────────────────────────────────────────────────────────
  const spin = (k) => { let s = 0; for (let i = 0; i < k * 200000; i++) s += Math.sqrt(i); return s; };
  const timeIt = (f) => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t); };
  spin(1); spin(1);                                              // warm
  const t1 = timeIt(() => spin(1));
  const t8 = timeIt(() => spin(8));
  ok('C1 the timer scales with the work (8x work costs 4x..16x)',
    t8 / t1 > 4 && t8 / t1 < 16, `ratio ${(t8 / t1).toFixed(2)}`);
  ok('C2 the timer is not returning a constant', t8 !== t1);

  // ── D. the rng counter, patched onto Math itself ──────────────────────────
  const realRandom = Math.random;
  let draws = 0;
  Math.random = () => { draws++; return realRandom(); };
  Math.random();
  ok('D1 the rng counter counts a draw we make ourselves (it is not simply broken)', draws === 1, `got ${draws}`);
  Math.random = realRandom;

  // ── E. the alias checker ──────────────────────────────────────────────────
  if (ARENA) {
    const st = LIVE.createMatch(ARENA, 'hamburger', 'pizza');
    ok('E1 alias check PASSES on a real state', aliasFaults(st).length === 0, aliasFaults(st).join('; '));
    const broken = { ...st, player: { ...st.fighters[0] } };
    ok('E2 alias check FAILS on a state whose player alias was unpicked (the known-bad)',
      aliasFaults(broken).length > 0);
    const jsonRT = JSON.parse(JSON.stringify(comparable(st)));
    ok('E3 alias check FAILS on a JSON round trip', aliasFaults(jsonRT).length > 0,
      `${aliasFaults(jsonRT).length} broken invariants`);
  } else ok('E  skipped — no arena cache', false, ARENA_PATH);

  // ── F. the stepAI probe actually patches ──────────────────────────────────
  const P = patchedSimDir('selftest-probe', [['sim.ts', AI_ANCHOR, AI_PATCH]]);
  ok('F1 the stepAI timing probe patches sim.ts (the anchor still exists)', P.applied[0],
    'the anchor is a line of CODE, never a comment — a comment is rewritten exactly when the rule under it moves');
  const NEG = patchedSimDir('selftest-neg', [['sim.ts', 'THIS_ANCHOR_DOES_NOT_EXIST_ANYWHERE', 'x']]);
  ok('F2 and it reports a MISS when the anchor is absent (the known-bad)', NEG.applied[0] === false);

  console.log(`\n   ${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log('\n   FAILURES:'); for (const f of fails) console.log(`     ${f}`); }
  process.exit(fails.length ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// THE MEASUREMENT
// ═════════════════════════════════════════════════════════════════════════════

if (!ARENA) { console.error(`nc_measure: no arena at ${ARENA_PATH}`); process.exit(1); }

const QUICK = !!args.quick;
const SEEDS = Number(args.seeds ?? (QUICK ? 2 : 8));
const before = controlHashes();
const head = headHashes();
const headMatches = CONTROL_FILES.every((f) => before[f] === head[f]);

console.log('\n═════════════════════════════════════════════════════════════════════════');
console.log('  NC_MEASURE — the transport decision, on measurements of THIS codebase');
console.log('═════════════════════════════════════════════════════════════════════════');
console.log(`  dt ${DT} ms  ->  ${HZ.toFixed(3)} ticks/s`);
console.log(`  arena ${ARENA.id} ${ARENA.width}x${ARENA.height}, ${ARENA.cover.length} cover, ${ARENA.hazards.length} hazards`);
console.log(`  seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}   driver rev ${DRIVER_REV}, policy ${POLICY}, seeds ${SEEDS}`);
console.log(`  node ${process.version} ${process.platform}/${process.arch}`);
console.log(`  sim files vs HEAD: ${headMatches ? 'IDENTICAL' : '⚠️ DIFFER — these numbers are NOT HEAD'}`);
for (const f of CONTROL_FILES) console.log(`    ${before[f]}  ${f}${before[f] === head[f] ? '' : `   (HEAD ${head[f]})`}`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. INPUT
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n───────────────────────────────────────────────────────────────────────');
console.log(' 1. INPUT — what one tick costs on the wire');
console.log('───────────────────────────────────────────────────────────────────────');

const inputCorpus = { one: [], byN: {} };
const inputDomain = { moveX: new Set(), moveY: new Set(), weapon: new Set(), attack: new Set(), aimPresent: 0, aimAbsent: 0 };

for (const n of [2, 6]) {
  const sizes = [];
  for (let s = 0; s < SEEDS; s++) {
    const configs = ringConfigs(ARENA, n, s % CHARACTER_IDS.length, 'human');
    runMatch(LIVE, {
      configs, seed: s, arrayInputs: true, maxTicks: QUICK ? 600 : 4000,
      hooks: {
        afterStep: (_st, _ev, _t, _ns, input) => {
          sizes.push(jsonBytes(input));
          for (const fi of input) {
            if (!fi) continue;
            if (n === 2) inputCorpus.one.push(jsonBytes(fi));
            inputDomain.moveX.add(fi.move.x); inputDomain.moveY.add(fi.move.y);
            inputDomain.weapon.add(fi.selectedWeapon); inputDomain.attack.add(fi.attack);
            if (fi.aim) inputDomain.aimPresent++; else inputDomain.aimAbsent++;
          }
        },
      },
    });
  }
  inputCorpus.byN[n] = stats(sizes);
}

const one = stats(inputCorpus.one);
console.log(`\n  corpus: ${inputCorpus.one.length.toLocaleString()} single-seat inputs, ${Object.values(inputCorpus.byN).reduce((a, b) => a + b.n, 0).toLocaleString()} whole-tick arrays`);
console.log(`  observed domains — move.x ${inputDomain.moveX.size} distinct, move.y ${inputDomain.moveY.size} distinct,`);
console.log(`                     selectedWeapon ${[...inputDomain.weapon].sort((a, b) => a - b).join('/')}, attack ${[...inputDomain.attack].join('/')},`);
console.log(`                     aim present on ${(100 * inputDomain.aimPresent / (inputDomain.aimPresent + inputDomain.aimAbsent)).toFixed(1)}% of inputs`);

/**
 * THE COMPACT ENCODING, AND THE ONE RULE THAT MAKES IT SAFE.
 *
 * `MatchInput` is `move: Vec2` (each axis independently in [-1,1], deliberately NOT
 * normalised), an OPTIONAL `aim: Vec2` (only its direction is read — `applyAim` normalises
 * internally), `selectedWeapon` (0..3; the roster's longest kit is 4 weapons) and `attack`.
 *
 *   move    2 x int8, 1/127 quantum                                    2 B
 *   aim     uint16 angle (2pi/65536 rad), 0xFFFF = "no aim this tick"  2 B
 *   weapon  2 bits   attack 1 bit   (one shared byte)                  1 B
 *   ────────────────────────────────────────────────────────────────────
 *                                                            5 B / seat / tick
 *
 * 🚨 THE QUANTISED VALUE MUST BE THE CANONICAL INPUT — the client feeds its OWN sim the
 * decoded value, never the raw one. Quantising on the way out and simulating on the way in
 * from the raw float is the classic lockstep desync, and it is invisible for minutes.
 */
const COMPACT_PER_SEAT = 5;
const HDR = 6;                       // uint32 tick + uint16 seat mask
console.log('\n  ENCODING                       N=2                 N=6');
const row = (label, f2, f6) => console.log(`  ${label.padEnd(28)} ${f2.padEnd(19)} ${f6}`);
row('JSON, whole tick (bytes)',
  `${inputCorpus.byN[2].mean.toFixed(1)} mean / ${inputCorpus.byN[2].max} max`,
  `${inputCorpus.byN[6].mean.toFixed(1)} mean / ${inputCorpus.byN[6].max} max`);
row('JSON, one seat (bytes)', `${one.mean.toFixed(1)} mean / ${one.max} max`, '(same field set)');
row('compact binary (bytes)', `${HDR + 2 * COMPACT_PER_SEAT}`, `${HDR + 6 * COMPACT_PER_SEAT}`);
console.log('');
const bw = (bytes) => `${(bytes * HZ / 1024).toFixed(2)} KiB/s`;
row('JSON @ 60 Hz, whole tick', bw(inputCorpus.byN[2].mean), bw(inputCorpus.byN[6].mean));
row('compact @ 60 Hz, one seat up', bw(HDR + COMPACT_PER_SEAT), bw(HDR + COMPACT_PER_SEAT));
row('compact @ 60 Hz, all seats down', bw(HDR + 2 * COMPACT_PER_SEAT), bw(HDR + 6 * COMPACT_PER_SEAT));

// ─────────────────────────────────────────────────────────────────────────────
// 2. STATE
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n───────────────────────────────────────────────────────────────────────');
console.log(' 2. STATE — what a full snapshot costs, and what a delta costs');
console.log('───────────────────────────────────────────────────────────────────────');

const stateRows = {};
for (const n of [2, 6]) {
  const full = [], dN = [], dBytes = [];
  let leafMax = 0, numericMax = 0, projMax = 0, trailMax = 0, splatMax = 0;
  for (let s = 0; s < SEEDS; s++) {
    const configs = ringConfigs(ARENA, n, s % CHARACTER_IDS.length);
    let prev = null;
    runMatch(LIVE, {
      configs, seed: s, maxTicks: QUICK ? 600 : 4000,
      hooks: {
        afterStep: (st) => {
          const c = comparable(st);
          full.push(jsonBytes(c));
          const paths = leafPaths(c, '', []);
          if (paths.length > leafMax) leafMax = paths.length;
          const nums = paths.filter((p) => typeof getPath(c, p) === 'number').length;
          if (nums > numericMax) numericMax = nums;
          projMax = Math.max(projMax, st.projectiles.length);
          trailMax = Math.max(trailMax, st.trailMarks.length);
          splatMax = Math.max(splatMax, st.splats.length);
          const snap = JSON.parse(JSON.stringify(c, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? `#${x}` : x)));
          if (prev) { const d = deltaOf(prev, snap); dN.push(d.n); dBytes.push(d.jsonBytes); }
          prev = snap;
        },
      },
    });
  }
  stateRows[n] = {
    full: stats(full), dN: stats(dN), dBytes: stats(dBytes),
    leafMax, numericMax, projMax, trailMax, splatMax,
  };
}

console.log('\n  FULL SNAPSHOT (`comparable(state)` — the shared `arena` and function keys excluded,');
console.log('                 which is `conceal_lab.mjs`\'s own exclusion list, not a new one)\n');
console.log('                              N=2                        N=6');
for (const [label, f] of [
  ['JSON bytes  mean', (r) => r.full.mean.toFixed(0)],
  ['            p50', (r) => String(r.full.p50)],
  ['            p99', (r) => String(r.full.p99)],
  ['            max', (r) => String(r.full.max)],
  ['leaf fields (max)', (r) => String(r.leafMax)],
  ['  of which numeric', (r) => String(r.numericMax)],
  ['float32 estimate (B)', (r) => String(r.numericMax * 4)],
  ['peak projectiles', (r) => String(r.projMax)],
  ['peak trail marks', (r) => String(r.trailMax)],
  ['peak splats', (r) => String(r.splatMax)],
]) console.log(`  ${label.padEnd(24)} ${f(stateRows[2]).padStart(10)}                 ${f(stateRows[6]).padStart(10)}`);

console.log('\n  PER-TICK DELTA (leaves whose value changed since the previous tick)\n');
console.log('                              N=2                        N=6');
for (const [label, f] of [
  ['changed leaves  mean', (r) => r.dN.mean.toFixed(1)],
  ['                p99', (r) => String(r.dN.p99)],
  ['                max', (r) => String(r.dN.max)],
  ['delta JSON B    mean', (r) => r.dBytes.mean.toFixed(0)],
  ['                p99', (r) => String(r.dBytes.p99)],
  ['                max', (r) => String(r.dBytes.max)],
]) console.log(`  ${label.padEnd(24)} ${f(stateRows[2]).padStart(10)}                 ${f(stateRows[6]).padStart(10)}`);

console.log('\n  BANDWIDTH per client, downstream, at 60 Hz');
for (const n of [2, 6]) {
  const r = stateRows[n];
  console.log(`    N=${n}  full every tick      ${(r.full.mean * HZ / 1024).toFixed(1)} KiB/s`
    + `      delta every tick  ${(r.dBytes.mean * HZ / 1024).toFixed(1)} KiB/s`);
  console.log(`          full @ 20 Hz        ${(r.full.mean * 20 / 1024).toFixed(1)} KiB/s`
    + `      delta @ 20 Hz     ${(r.dBytes.mean * 20 / 1024).toFixed(1)} KiB/s`);
}
console.log('\n  ⚠️ the delta figure is `{path: value}` — it spends the PATH STRING on every field.');
console.log('     A real delta protocol spends a field index (1-2 B). The gap between the two');
console.log('     numbers is exactly the engineering a delta protocol IS.');

// ─────────────────────────────────────────────────────────────────────────────
// 3. TICK COST
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n───────────────────────────────────────────────────────────────────────');
console.log(' 3. TICK COST — and therefore the rollback budget');
console.log('───────────────────────────────────────────────────────────────────────');

/** Warm V8 before any timing: a cold optimiser reports a tier-up, not a workload. */
for (let s = 0; s < 2; s++) runMatch(LIVE, { configs: ringConfigs(ARENA, 6, s), seed: 900 + s, maxTicks: 1500 });

const timings = {};
const ARMS = [
  ['N=2  1 human + 1 AI  (the shipped shape)', 2, null, false],
  ['N=2  both seats AI', 2, 'ai', false],
  ['N=2  both seats human', 2, 'human', true],
  ['N=6  all AI', 6, 'ai', false],
  ['N=6  all human', 6, 'human', true],
];
/**
 * ⚠️ THE STATS ARE OVER **PLAYING** TICKS ONLY, AND THE COUNTDOWN IS REPORTED SEPARATELY.
 *
 * `stepMatch` runs no fighter loop at all while `phase === 'countdown'` — 5.7 s of every
 * match, which at 60 Hz is ~342 ticks, and on a short match that is HALF the corpus. Mixing
 * them in makes the median a statement about the countdown and the mean a blend of two
 * different functions. A server sizes itself on the ticks that do work.
 */
const NAVSTATS = (await import(`${ROOT}/src/game/movement.ts`)).navStats;
for (const [label, n, ctl, arrayInputs] of ARMS) {
  const per = [], cd = [];
  let ticks = 0, totalNs = 0;
  NAVSTATS.reset();
  for (let s = 0; s < SEEDS; s++) {
    const configs = ringConfigs(ARENA, n, s % CHARACTER_IDS.length, ctl);
    const r = runMatch(LIVE, {
      configs, seed: s, arrayInputs, maxTicks: QUICK ? 900 : 4000,
      hooks: { afterStep: (_st, _ev, _t, ns, _in, playing) => (playing ? per : cd).push(ns) },
    });
    ticks += r.tick; totalNs += r.stepNs;
  }
  const st = stats(per);
  const nav = { ...NAVSTATS };
  timings[label] = { st, ticks, playTicks: per.length, totalNs, nav };
  console.log(`\n  ${label}`);
  console.log(`    ${per.length.toLocaleString()} playing ticks of ${ticks.toLocaleString()}   `
    + `mean ${(st.mean / 1000).toFixed(2)} us   p50 ${(st.p50 / 1000).toFixed(2)}   `
    + `p95 ${(st.p95 / 1000).toFixed(2)}   p99 ${(st.p99 / 1000).toFixed(2)}   max ${(st.max / 1000).toFixed(1)} us`);
  console.log(`    countdown ticks (no fighter loop at all): mean ${(stats(cd).mean / 1000).toFixed(3)} us over ${cd.length.toLocaleString()}`);
  console.log(`    real-time budget: ${(100 * st.mean / (DT * 1e6)).toFixed(3)}% of one ${DT} ms tick`
    + `   ->  ${Math.floor(DT * 1e6 / st.mean).toLocaleString()} concurrent matches per core at 1x speed`);
  console.log(`    ticks re-simulable in one 16.667 ms frame: ${Math.floor(DT * 1e6 / st.mean).toLocaleString()} (mean)   `
    + `${Math.floor(DT * 1e6 / st.p99).toLocaleString()} (p99)`);
  console.log(`    nav: ${nav.gridBuilds} grid builds, ${nav.fieldBuilds.toLocaleString()} BFS field rebuilds `
    + `(${(nav.fieldBuilds / per.length).toFixed(2)}/playing tick), `
    + `${(nav.cellsVisited / per.length).toFixed(0)} BFS cells/playing tick, `
    + `${(nav.losChecks / per.length).toFixed(1)} LOS checks/tick`);
}

/**
 * ROLLBACK ALSO HAS TO SAVE AND RESTORE STATE, AND THAT COST IS NOT IN `stepMatch`.
 *
 * ⚠️ `structuredClone` deep-copies `state.arena` too — one shared `ArenaDefinition` object
 * is handed to every match in a process by design (`MatchState.brokenConcealment`'s doc says
 * why), so cloning it is both wasted work and a broken invariant. The realistic number is
 * the hand clone that keeps `arena` by reference and rebuilds the aliases.
 */
function cloneState(st) {
  const fighters = st.fighters.map((f) => ({
    ...f, facing: { ...f.facing }, status: { ...f.status },
    lastUsed: f.lastUsed.slice(), hazardTimers: f.hazardTimers.slice(),
  }));
  return {
    ...st,
    fighters,
    player: fighters[0],
    enemy: fighters[1],
    projectiles: st.projectiles.map((p) => ({ ...p })),
    splats: st.splats.map((p) => ({ ...p })),
    trailMarks: st.trailMarks.map((p) => ({ ...p })),
    sightings: st.sightings.map((s) => ({ ...s })),
    aiSighting: null,                                   // rebound below, by index
    brokenConcealment: st.brokenConcealment.slice(),    // arena boxes BY REFERENCE, deliberately
    arena: st.arena,                                    // shared, never copied
  };
}
function cloneStateFixed(st) {
  const c = cloneState(st);
  c.aiSighting = c.sightings[1 * c.fighters.length + 0];
  return c;
}

console.log('\n  SNAPSHOT COST (rollback has to save and restore, and it is not in `stepMatch`)');
for (const n of [2, 6]) {
  const configs = ringConfigs(ARENA, n, 0);
  const r = runMatch(LIVE, { configs, seed: 3, maxTicks: 1800 });
  const st = r.state;
  const bench = (f, iters) => {
    for (let i = 0; i < 200; i++) f(st);
    const t = process.hrtime.bigint();
    for (let i = 0; i < iters; i++) f(st);
    return Number(process.hrtime.bigint() - t) / iters;
  };
  const hand = bench(cloneStateFixed, 20000);
  const sc = bench(structuredClone, 3000);
  const js = bench((s) => JSON.parse(JSON.stringify(comparable(s))), 3000);
  console.log(`    N=${n}  hand clone (arena by ref)  ${(hand / 1000).toFixed(3)} us`
    + `   structuredClone (clones arena) ${(sc / 1000).toFixed(2)} us`
    + `   JSON round trip ${(js / 1000).toFixed(2)} us`);
  const armLabel = n === 2 ? 'N=2  1 human + 1 AI  (the shipped shape)' : 'N=6  all AI';
  const step = timings[armLabel].st.mean;
  console.log(`          hand clone is ${(100 * hand / step).toFixed(1)}% of one tick's step cost`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DETERMINISM
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n───────────────────────────────────────────────────────────────────────');
console.log(' 4. DETERMINISM — what a lockstep design would have to pin');
console.log('───────────────────────────────────────────────────────────────────────');

/**
 * MEASURED LIVE, NOT GREPPED. `rules.ts` carries the claim as a comment —
 * *"`grep -rn 'Math.random' src/game/{sim,state,combat,ai,movement}.ts` returns NOTHING"* —
 * and a comment stating a grep result is a grep result from whenever it was written. This
 * counts the draws a whole corpus of real matches actually makes.
 */
const realRandom = Math.random;
let simDraws = 0;
Math.random = () => { simDraws++; return realRandom(); };
let drawTicks = 0;
for (const n of [2, 6]) {
  for (let s = 0; s < SEEDS; s++) {
    const r = runMatch(LIVE, { configs: ringConfigs(ARENA, n, s % CHARACTER_IDS.length), seed: s, maxTicks: QUICK ? 600 : 4000 });
    drawTicks += r.tick;
  }
}
Math.random = realRandom;
console.log(`\n  Math.random draws inside the sim: ${simDraws} over ${drawTicks.toLocaleString()} real ticks`);
console.log('    (the counter is validated in --selftest §D1 — it counts a draw we make ourselves,');
console.log('     so a zero here is a measurement and not a broken probe)');

const SRC = Object.fromEntries(SIM_MODULES.map((f) => [f, readFileSync(`${ROOT}/src/game/${f}`, 'utf8')]));
const codeOnly = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
  .replace(/(^|[^:])\/\/.*$/gm, '$1');   // line comments
const census = (re) => SIM_MODULES.map((f) => [f, (codeOnly(SRC[f]).match(re) ?? []).length]);
const total = (re) => census(re).reduce((a, [, c]) => a + c, 0);

console.log('\n  STATIC CENSUS of the six sim modules, comments stripped');
const censusRows = [
  ['Math.random', /Math\.random/g],
  ['Date.now / performance.now', /Date\.now|performance\.now|new Date\(/g],
  ['Math.hypot  (impl-approximated)', /Math\.hypot/g],
  ['Math.sin/cos/tan', /Math\.(sin|cos|tan)\(/g],
  ['Math.atan2/asin/acos', /Math\.(atan2|asin|acos)\(/g],
  ['Math.pow / **  (impl-approximated)', /Math\.pow|\*\*/g],
  ['Math.sqrt  (IEEE-exact)', /Math\.sqrt/g],
  ['new Map / new Set', /new (Map|Set)\(/g],
  ['for..in  (key-order dependent)', /for\s*\([^)]*\sin\s/g],
  ['Object.keys / Object.entries', /Object\.(keys|entries|values)\(/g],
  ['.sort(', /\.sort\(/g],
];
for (const [label, re] of censusRows) {
  const per = census(re).filter(([, c]) => c > 0).map(([f, c]) => `${f.replace('.ts', '')}:${c}`).join(' ');
  console.log(`    ${label.padEnd(36)} ${String(total(re)).padStart(3)}   ${per}`);
}
console.log('\n  ⚠️ `Math.hypot` and the trig functions are IMPLEMENTATION-APPROXIMATED in ECMAScript:');
console.log('     the spec does not pin their last bits, so two ENGINES may disagree. Every client');
console.log('     in a lockstep design that spans browsers has to produce the same bits from them.');
console.log('     `Math.sqrt`, +, -, *, / are IEEE-754 exact and are not a hazard.');

// ─────────────────────────────────────────────────────────────────────────────
// 5. stepAI's SHARE
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n───────────────────────────────────────────────────────────────────────');
console.log(' 5. stepAI\'s SHARE — six bots and six humans are different servers');
console.log('───────────────────────────────────────────────────────────────────────');

const PROBE = patchedSimDir('ai-probe', [
  ['sim.ts', AI_ANCHOR, AI_PATCH],
  ['sim.ts', HUMAN_ANCHOR, HUMAN_PATCH],
]);
if (!PROBE.applied[0] || !PROBE.applied[1]) {
  console.log(`\n  ⚠️ THE PROBE DID NOT PATCH (stepAI ${PROBE.applied[0]}, human ${PROBE.applied[1]}).`);
  console.log('     Reporting nothing rather than a number from an unpatched sim.');
} else {
  const PSIM = await loadSim(PROBE.dir);
  /** The probe's own cost: two `hrtime.bigint()` calls per branch. Measured, then declared. */
  const OV_N = 200000;
  let ovt = process.hrtime.bigint();
  for (let i = 0; i < OV_N; i++) { const a = process.hrtime.bigint(); const b = process.hrtime.bigint(); if (b < a) throw new Error('clock'); }
  const overheadNs = Number(process.hrtime.bigint() - ovt) / OV_N;

  for (const [label, n, ctl, arrayInputs] of [
    ['N=2  1 human + 1 AI', 2, null, false],
    ['N=6  all AI', 6, 'ai', false],
    ['N=6  all human', 6, 'human', true],
  ]) {
    globalThis.__ncAiNs = 0; globalThis.__ncAiCalls = 0;
    globalThis.__ncHumanNs = 0; globalThis.__ncHumanCalls = 0;
    let ticks = 0, stepNs = 0;
    for (let s = 0; s < SEEDS; s++) {
      const r = runMatch(PSIM, {
        configs: ringConfigs(ARENA, n, s % CHARACTER_IDS.length, ctl), seed: s, arrayInputs,
        maxTicks: QUICK ? 900 : 4000,
      });
      ticks += r.tick; stepNs += r.stepNs;
    }
    const aiNs = globalThis.__ncAiNs, aiCalls = globalThis.__ncAiCalls;
    const huNs = globalThis.__ncHumanNs, huCalls = globalThis.__ncHumanCalls;
    const probeNs = (aiCalls + huCalls) * overheadNs;
    console.log(`\n  ${label}   ${ticks.toLocaleString()} ticks, ${(stepNs / 1e6).toFixed(0)} ms in stepMatch`);
    if (aiCalls) {
      console.log(`    stepAI            ${aiCalls.toLocaleString().padStart(10)} calls   `
        + `${(aiNs / aiCalls / 1000).toFixed(3)} us/call   ${(100 * aiNs / stepNs).toFixed(1)}% of stepMatch`);
    }
    if (huCalls) {
      console.log(`    human branch      ${huCalls.toLocaleString().padStart(10)} calls   `
        + `${(huNs / huCalls / 1000).toFixed(3)} us/call   ${(100 * huNs / stepNs).toFixed(1)}% of stepMatch`);
    }
    console.log(`    everything else   (projectiles, world tick, ground effects, countdown)   `
      + `${(100 * (stepNs - aiNs - huNs) / stepNs).toFixed(1)}%`);
    console.log(`    ⚠️ probe overhead ${overheadNs.toFixed(0)} ns/call x ${(aiCalls + huCalls).toLocaleString()} `
      + `= ${(100 * probeNs / stepNs).toFixed(2)}% of the total, INCLUDED in the shares above`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5b. WHERE stepAI's TIME ACTUALLY GOES — and what §48's x4 arena does to it
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n───────────────────────────────────────────────────────────────────────');
console.log(' 5b. THE NAV FLOW FIELD — where stepAI\'s time goes, and what §48 does to it');
console.log('───────────────────────────────────────────────────────────────────────');

console.log(`\n  grid ${NAVSTATS.cols}x${NAVSTATS.rows} = ${(NAVSTATS.cols * NAVSTATS.rows).toLocaleString()} cells `
  + `@ ${NAVSTATS.cellSize} wu  (${NAVSTATS.passable.toLocaleString()} passable)`);
console.log('  per arm (from the runs in §3 above):\n');
console.log('    arm                                        BFS rebuilds/tick   BFS cells/tick   grid builds');
for (const [label] of ARMS) {
  const t = timings[label];
  if (!t.nav) continue;
  console.log(`    ${label.padEnd(42)} ${(t.nav.fieldBuilds / t.playTicks).toFixed(2).padStart(11)}   `
    + `${(t.nav.cellsVisited / t.playTicks).toFixed(0).padStart(14)}   ${String(t.nav.gridBuilds).padStart(11)}`);
}

/**
 * 🚨 `NAV_MAX_CELLS` IS 40,000 AND `DECISIONS §48` MAKES THE ARENA 2800x2000.
 *
 * `movement.ts:navGrid` doubles the cell size until the grid fits under the cap:
 * 2800x2000 at `NAV_CELL` 10 is 280x200 = 56,000 cells, which is OVER — so the cell
 * becomes 20 and the grid is 140x100 again. The BFS therefore does NOT get four times
 * more expensive on the bigger arena; the RESOLUTION HALVES INSTEAD, silently.
 *
 * That matters because `NAV_CELL`'s own doc block says the 10 is DERIVED: the shipped
 * kitchen's tightest legal gap leaves an 11 wu band of legal centre positions, and it
 * records that **cell 20 did not resolve it and cost 7 of 358 cells**. So on the x4 arena
 * the pathfinder silently loses corridors unless `NAV_MAX_CELLS` moves with it.
 *
 * ⚠️ This is measured on a BARE arena of the target size — no cover, no props, no spawn
 * placement. It is grid ARITHMETIC and carries NO layout claim: `DECISIONS §48`/`§49d`
 * own where anything goes.
 */
{
  const bare = (w, h) => ({
    id: 'nc-bare', displayName: 'nc-bare', width: w, height: h,
    center: { x: w / 2, y: h / 2 }, maxSafeRadius: Math.hypot(w / 2, h / 2),
    playerSpawn: { x: w * 0.15, y: h / 2 }, enemySpawn: { x: w * 0.85, y: h / 2 },
    cover: [], hazards: [], concealment: [],
  });
  console.log('\n  THE x4 ARENA (DECISIONS §48: 1400x1000 -> 2800x2000), on a BARE arena of each size');
  console.log('  — grid arithmetic only. No cover, no props, no spawn placement, no layout claim.\n');
  console.log('    arena          grid            cells    cell size   BFS cells/playing tick');
  for (const [w, h] of [[1400, 1000], [2800, 2000]]) {
    const a = bare(w, h);
    NAVSTATS.reset();
    const r = runMatch(LIVE, { configs: [{ characterId: 'hamburger' }, { characterId: 'pizza' }], seed: 11, maxTicks: 900 }, a);
    const cells = NAVSTATS.cols * NAVSTATS.rows;
    console.log(`    ${String(w) + 'x' + String(h)}`.padEnd(18)
      + `${NAVSTATS.cols}x${NAVSTATS.rows}`.padEnd(16)
      + `${cells.toLocaleString()}`.padStart(8)
      + `${String(NAVSTATS.cellSize) + ' wu'}`.padStart(13)
      + `${(NAVSTATS.cellsVisited / Math.max(1, r.playTicks)).toFixed(0)}`.padStart(25));
  }
  console.log('\n    ⚠️ `NAV_CELL`\'s own doc records that cell 20 FAILED to resolve the shipped kitchen\'s');
  console.log('       tightest legal gap (11 wu of legal centre positions) and cost 7 of 358 cells.');
  console.log('       Routed to the §48 arena pass — `movement.ts` is not this file set\'s.');
  console.log('       (the cells/tick column is a BARE arena with one AI: a stimulus, not a workload.');
  console.log('        The decidable numbers in this block are the GRID and the CELL SIZE.)');

  /**
   * 🚨 A DIRECT COST ON `DECISIONS §49c`, WHICH ASKS WHICH **SIZE** DIAL SEAT 2+ GETS.
   *
   * `movement.ts:navGrid` caches ONE passability grid per ARENA OBJECT (a `WeakMap`) and
   * validates the hit with `cached.size === size`. Today `PLAYER_SIZE === ENEMY_SIZE === 42`
   * so every fighter asks for the same grid and it is built once per arena, ever. Give seat
   * 0 a different body and consecutive AI seats alternate the requested size — every
   * alternation MISSES the cache and rebuilds the whole grid, which is
   * `cols x rows` cells each running `collidesWithCover` over the arena's cover list.
   *
   * Measured rather than argued, because "unread state cannot change behaviour" is exactly
   * the kind of code-reading claim `CLAUDE.md` #6 says not to trust.
   */
  console.log('\n  THE SIZE DIAL AND THE NAV CACHE — a measured cost on §49c\n');
  for (const [label, sizes] of [['same size (today: PLAYER_SIZE === ENEMY_SIZE === 42)', [42, 42]],
    ['seat 0 given a different body (42 vs 40)', [42, 40]]]) {
    const a = withDerivedRing(JSON.parse(readFileSync(ARENA_PATH, 'utf8')));   // a FRESH arena object per arm
    NAVSTATS.reset();
    const cfg = ringConfigs(a, 2, 0, 'ai');
    cfg[0].size = sizes[0]; cfg[1].size = sizes[1];
    const r = runMatch(LIVE, { configs: cfg, seed: 4, maxTicks: 900 }, a);
    console.log(`    ${label.padEnd(52)} ${NAVSTATS.gridBuilds.toLocaleString().padStart(7)} grid rebuilds `
      + `over ${r.playTicks.toLocaleString()} playing ticks`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SERIALISE / RESTORE FIDELITY
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n───────────────────────────────────────────────────────────────────────');
console.log(' 6. FIDELITY — does `MatchState` survive a round trip at all?');
console.log('───────────────────────────────────────────────────────────────────────');

{
  const st = runMatch(LIVE, { configs: ringConfigs(ARENA, 6, 0), seed: 5, maxTicks: 1800 }).state;
  st.brokenConcealment.push(ARENA.cover[0]);          // stand in for a destroyed region

  const checks = [];
  const jsonRT = JSON.parse(JSON.stringify(comparable(st)));
  checks.push(['JSON.parse(JSON.stringify(...))', aliasFaults(jsonRT)]);
  const sc = structuredClone(comparable(st));
  checks.push(['structuredClone', aliasFaults(sc)]);
  checks.push(['hand clone (cloneStateFixed)', aliasFaults(cloneStateFixed(st))]);

  console.log('\n  ALIAS INVARIANTS AFTER A ROUND TRIP');
  for (const [name, faults] of checks) {
    console.log(`    ${name.padEnd(34)} ${faults.length === 0 ? 'ALL HOLD' : `${faults.length} BROKEN: ${faults.join(', ')}`}`);
  }

  // ── the -Infinity sentinels ──────────────────────────────────────────────
  const sentinelPaths = leafPaths(comparable(st), '', []).filter((p) => getPath(comparable(st), p) === -Infinity);
  const naive = JSON.parse(JSON.stringify(comparable(st)));
  const lost = sentinelPaths.filter((p) => getPath(naive, p) === null);
  console.log(`\n  -Infinity SENTINELS  ${sentinelPaths.length} present in one N=6 state;`
    + ` a naive JSON round trip loses ${lost.length} of them (they become \`null\`)`);
  console.log('     `1b506d6` records the same trap on the other side: two states differing ONLY');
  console.log('     in those fields compare EQUAL under `JSON.stringify`.');

  // ── reference identity into the arena ────────────────────────────────────
  const scRef = structuredClone({ b: st.brokenConcealment, a: st.arena });
  const refOkSC = scRef.b[0] === scRef.a.cover[0];
  const handRefOk = cloneStateFixed(st).brokenConcealment[0] === st.arena.cover[0];
  console.log(`\n  brokenConcealment HOLDS ARENA BOXES BY REFERENCE (movement.ts:isConcealed tests identity)`);
  console.log(`     structuredClone of {state, arena} together keeps the pairing: ${refOkSC}`);
  console.log(`     hand clone keeps the pairing with the SHARED arena:           ${handRefOk}`);
  console.log(`     JSON round trip keeps it:                                    false (there are no references in JSON)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// The tree control, again
// ─────────────────────────────────────────────────────────────────────────────

const after = controlHashes();
const moved = CONTROL_FILES.filter((f) => before[f] !== after[f]);
console.log('\n───────────────────────────────────────────────────────────────────────');
if (moved.length) {
  console.log(` 🚨 THE TREE MOVED UNDER THIS RUN — ${moved.join(', ')}. DISCARD THESE NUMBERS.`);
  process.exitCode = 1;
} else {
  console.log(' tree control: all 7 sim files identical before and after. Numbers are on one tree.');
}
console.log('───────────────────────────────────────────────────────────────────────\n');
