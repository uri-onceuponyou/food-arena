#!/usr/bin/env node
/**
 * cst_interrupt — PRICING THE INTERRUPTION RULE ON REAL MATCHES. Offline, no browser.
 *
 * `CLAUDE.md` #5 constraint on the cast design: *"Interruption is a design decision with
 * a balance consequence — can damage cancel a cast? Pick one, justify it, PRICE IT."*
 *
 * Pricing it means one number: **what fraction of the casts a fighter could open would
 * survive to resolve, under each candidate rule?** That is not an opinion; it is a
 * counterfactual over the tick stream of matches the shipped driver actually plays.
 *
 * ── THE COUNTERFACTUAL, STATED EXACTLY ──────────────────────────────────────
 *
 * For every tick at which fighter F is alive, the match is `playing`, and F's ULTIMATE is
 * off cooldown (the realistic denominator — you cannot open a cast you cannot press), ask:
 *
 *     would F have been interrupted before `elapsed + T`?
 *
 * under three candidate rules:
 *
 *   A  NOTHING CANCELS         — always survives. The telegraph is a warning, not a window.
 *   B  ANY DAMAGE CANCELS      — weapon, trail, pot and fog all cancel.
 *   B' ANY WEAPON/TRAIL DAMAGE — a fighter's damage cancels; the arena's does not.
 *   C  ONLY A STUN CANCELS     — and only a stun that ACTUALLY LANDED (`STUN_GRACE_MS`
 *                                refuses one inside its own grace window, and a refused
 *                                stun must not count as an interrupt).
 *
 * ⚠️ **THE CAST IS NEVER ACTUALLY OPENED.** This is an observational counterfactual over
 * the UNMODIFIED sim — no cast exists yet, so nothing here changes a single tick. That is
 * deliberate and it is also the limitation, stated rather than hidden: a real cast ROOTS
 * its caster, so the caster it models is one that kept moving. The measured survival rate
 * is therefore an **UPPER BOUND** — a rooted caster is easier to hit, not harder. A rule
 * that already fails here fails harder in the real thing.
 *
 * Usage:
 *   node tools/tmp/cst_interrupt.mjs --selftest
 *   node tools/tmp/cst_interrupt.mjs [--seeds 8] [--T 300,500,700,900,1200,1500,2000]
 *
 * ⚠️ `--selftest` VALIDATES THE LOGIC, NOT WHERE IT IS POINTED (CLAUDE.md #6).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng, parseDriverFlags } from './scripted_player.mjs';

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

const SIM_DIR = `${ROOT}/src/game`;
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, STUN_GRACE_MS,
  fogOpeningRadiusFor,
} = await import(`${SIM_DIR}/rules.ts`);

const ARENA_PATH = `${ROOT}/tools/arena.gameplay.json`;
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
// ── 🚨 THE OPENING RADIUS IS `fogOpeningRadiusFor`, NOT roster_lab's FORMULA ──────
//
// A cached arena dump's `maxSafeRadius` goes stale the moment the clock moves, so every
// Node balance tool recomputes it. `roster_lab.mjs` (and, per `fs_sched_census`, 46 other
// sites) still recompute it as `Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS))` —
// the SUPERSEDED coupling `6d5c4d6` removed when `FOG_HOLD_MS` took over the job of
// placing first contact. Copying `roster_lab` here would have made this the 48th copy and
// would have measured a ring that opens at **1792** instead of the shipped **1720.47**.
// Measured both ways before choosing (see the commit message): the survival table is
// unchanged to 0.1 pp, so the ring size does not reach this statistic — but the number
// used is the derived one, because a tool that quotes a superseded constant is a tool
// nobody can trust the next time it DOES matter.
const HALF_DIAG = Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2);
const arena = {
  ...ARENA_DATA,
  maxSafeRadius: Number(args.maxsafe ?? fogOpeningRadiusFor(HALF_DIAG)),
  build: () => null, update: () => {},
};

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const TS = String(args.T ?? '300,500,700,900,1200,1500,2000').split(',').map(Number);

const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...parseDriverFlags(args) });

/**
 * THE ULTIMATE OF EACH CHARACTER, derived — never a hand-typed list of six names.
 * An ability whose blurb is prefixed `Special:`, or a weapon flagged `giantSlam`
 * (lollipop's, which the audit found is a sixth ultimate that carries no label).
 * Returns the weapon INDEX, because that is what `Fighter.lastUsed` is keyed on.
 */
function ultimateIndexOf(id) {
  const def = CHARACTERS[id];
  for (const a of def.abilities) {
    if (a.desc.startsWith('Special:') && a.weapon) {
      const i = def.weapons.findIndex((w) => w.key === a.weapon);
      if (i >= 0) return i;
    }
  }
  const g = def.weapons.findIndex((w) => w.giantSlam);
  return g >= 0 ? g : null;
}

const ULT = Object.fromEntries(CHARACTER_IDS.map((id) => [id, ultimateIndexOf(id)]));

/**
 * One match, observed. Returns per-fighter event streams in MATCH-ELAPSED ms:
 *
 *   ready[]    ticks at which this fighter's ultimate was off cooldown (the denominator)
 *   dmgAny[]   every tick this fighter LOST hp, from any source
 *   dmgFight[] ... from a weapon or a trail only (an arena burn is not an attacker)
 *   stunned[]  every tick this fighter's `stunnedUntil` ADVANCED — i.e. a stun that the
 *              grace window actually let through. A REFUSED stun still emits
 *              `hit-landed` carrying `effect: 'stun'`, so reading the event would count
 *              interrupts that never happened.
 */
function runMatch(playerId, enemyId, policy, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const n = state.fighters.length;
  const out = Array.from({ length: n }, () => ({ ready: [], readyInRange: [], dmgAny: [], dmgFight: [], stunned: [] }));
  const prevStun = state.fighters.map((f) => f.status.stunnedUntil);

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const playingBefore = state.phase === 'playing';
    const evs = stepMatch(state, DT, loop.next(state, DT));
    const t = state.elapsed;

    for (const ev of evs) {
      if (ev.type !== 'hit-landed') continue;
      const s = out[ev.targetId];
      if (!s) continue;
      s.dmgAny.push(t);
      const k = ev.source?.kind;
      if (k === 'weapon' || k === 'trail') s.dmgFight.push(t);
    }
    for (let i = 0; i < n; i++) {
      const su = state.fighters[i].status.stunnedUntil;
      if (su > prevStun[i]) { out[i].stunned.push(t); prevStun[i] = su; }
    }
    // ── THE TWO DENOMINATORS, AND THE SECOND IS THE HONEST ONE ────────────────
    //
    // `ready` is "the ultimate is off cooldown". That is most of a match, including all
    // the time the two fighters are 800 wu apart and nobody is shooting anybody — which
    // is exactly the interval in which a cast trivially survives, and it is not an
    // interval in which anyone would press an ultimate. Reporting only `ready` reads
    // 95.7% survival at T=900 and is a confidently misleading answer.
    //
    // `readyInRange` adds the one condition that makes a press a real press: the
    // ultimate's own `range` reaches the nearest living opponent. That is `pickWeapon`'s
    // own third eligibility test (`adist > (w.range ?? Infinity)` -> skip), restated on
    // the same quantity, so the denominator is the set of ticks the shipped driver would
    // actually have considered the weapon in.
    if (playingBefore && state.phase === 'playing') {
      for (let i = 0; i < n; i++) {
        const f = state.fighters[i];
        if (!f.alive) continue;
        const ui = ULT[f.characterId];
        if (ui === null) continue;
        const w = CHARACTERS[f.characterId].weapons[ui];
        if (t - f.lastUsed[ui] < w.cooldown) continue;
        out[i].ready.push(t);
        let best = Infinity;
        for (let j = 0; j < n; j++) {
          if (j === i || !state.fighters[j].alive) continue;
          const d = Math.hypot(state.fighters[j].x - f.x, state.fighters[j].y - f.y);
          if (d < best) best = d;
        }
        if (best <= (w.range ?? Infinity)) out[i].readyInRange.push(t);
      }
    }
  }
  return out;
}

/** First entry of the sorted stream strictly after `t0` and at or before `t0 + T`. */
function interruptedWithin(stream, t0, T) {
  // Linear scan is fine: streams are short and this is called once per (tick, T).
  for (let i = 0; i < stream.length; i++) {
    const v = stream[i];
    if (v <= t0) continue;
    return v <= t0 + T;
  }
  return false;
}

/**
 * ⚠️ **A TICK IS NOT AN OPPORTUNITY, AND THE DIFFERENCE IS THE RESOLUTION FLOOR.**
 *
 * `CLAUDE.md` #10: *"a standard error is not always the right scale — ask what the
 * statistic IS first."* Adjacent ready-in-range ticks are the SAME press decision
 * observed 60 times a second: they share a position, a target and an incoming shot, so
 * a binomial SE over ticks understates the true uncertainty by roughly sqrt(run length).
 * `opportunities` collapses each contiguous run of ready-in-range ticks to its FIRST
 * tick — one press, one trial — and that count is the n every percentage below should
 * be read against.
 */
function opportunitiesOf(stream, dt) {
  const out = [];
  let prev = -Infinity;
  for (const t of stream) {
    if (t - prev > dt * 1.5) out.push(t);
    prev = t;
  }
  return out;
}

function survival(streams, T, key, dt) {
  let ready = 0, sAny = 0, sFight = 0, sStun = 0;
  let opps = 0, oAny = 0, oFight = 0, oStun = 0;
  for (const s of streams) {
    for (const t0 of s[key]) {
      ready++;
      if (!interruptedWithin(s.dmgAny, t0, T)) sAny++;
      if (!interruptedWithin(s.dmgFight, t0, T)) sFight++;
      if (!interruptedWithin(s.stunned, t0, T)) sStun++;
    }
    for (const t0 of opportunitiesOf(s[key], dt)) {
      opps++;
      if (!interruptedWithin(s.dmgAny, t0, T)) oAny++;
      if (!interruptedWithin(s.dmgFight, t0, T)) oFight++;
      if (!interruptedWithin(s.stunned, t0, T)) oStun++;
    }
  }
  return { ready, sAny, sFight, sStun, opps, oAny, oFight, oStun };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — known-bad inputs. A guard not shown to FAIL is not a guard.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let ok = 0, bad = 0;
  const say = (name, pass, detail) => { (pass ? ok++ : bad++); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

  // ⚠️ NON-EMPTY FIRST. `[].every()` is `true`; a filtered set asserted over without a
  // non-emptiness check is the vacuity that fired three times in three files in one session.
  const ults = CHARACTER_IDS.filter((id) => ULT[id] !== null);
  say('the ultimate set is NON-EMPTY', ults.length > 0, `${ults.length} of ${CHARACTER_IDS.length} characters have one`);
  say('exactly 6 characters carry an ultimate', ults.length === 6, ults.join(' '));

  // KNOWN-BAD 1: an EMPTY interrupt stream must never interrupt. If it does, the scan
  // has an off-by-one that would report rule B as impossible-to-survive.
  say('KNOWN-BAD empty stream never interrupts', !interruptedWithin([], 0, 100000));
  // KNOWN-BAD 2: an event EXACTLY at t0 is the tick the cast opens on, not an interrupt.
  say('KNOWN-BAD an event AT t0 does not interrupt', !interruptedWithin([500], 500, 1000));
  // KNOWN-BAD 3: an event exactly at the deadline DOES interrupt (closed upper bound).
  say('KNOWN-BAD an event at t0+T DOES interrupt', interruptedWithin([1500], 500, 1000));
  // KNOWN-BAD 4: an event one ms past the deadline does not.
  say('KNOWN-BAD an event at t0+T+1 does NOT interrupt', !interruptedWithin([1501], 500, 1000));
  // POSITIVE CONTROL — the predicate must be able to say YES, or every FAIL is vacuous.
  say('POSITIVE CONTROL an event inside the window interrupts', interruptedWithin([600], 500, 1000));

  // KNOWN-BAD 5: the stun stream must be built from `stunnedUntil` ADVANCING, not from
  // the event's authored `effect`. A refused stun (inside STUN_GRACE_MS) still emits
  // `hit-landed` with `effect: 'stun'`. Prove the two differ on a real match, or the
  // distinction this tool makes is decoration.
  const m = runMatch('pizza', 'burrito', 'smart2', 0);
  const anyReady = m.reduce((a, s) => a + s.ready.length, 0);
  say('a real match produces a NON-EMPTY ready set', anyReady > 0, `${anyReady} ready ticks`);
  const anyInRange = m.reduce((a, s) => a + s.readyInRange.length, 0);
  // ⚠️ NON-EMPTY FIRST, AGAIN, AND FOR THE SHARPER REASON: the in-range denominator is a
  // FILTERED set. If the range gate ever stopped matching anything, every survival figure
  // computed over it would read 0/0 and the table would print `n/a` rather than a wrong
  // number — but a subtler mis-aim would print a confident percentage over four ticks.
  say('the FILTERED in-range set is NON-EMPTY and strictly smaller', anyInRange > 0 && anyInRange < anyReady,
    `${anyInRange} in-range of ${anyReady} ready`);
  // KNOWN-BAD for the opportunity collapse: a run of CONSECUTIVE ticks is ONE press.
  say('KNOWN-BAD a consecutive run collapses to ONE opportunity',
    opportunitiesOf([100, 116.667, 133.334, 150.001], 16.667).length === 1);
  say('KNOWN-BAD a gap longer than a tick opens a SECOND opportunity',
    opportunitiesOf([100, 116.667, 900], 16.667).length === 2);
  say('KNOWN-BAD an empty stream yields zero opportunities (never 1)',
    opportunitiesOf([], 16.667).length === 0);
  const anyStun = m.reduce((a, s) => a + s.stunned.length, 0);
  say('a real match produces a NON-EMPTY applied-stun set', anyStun > 0, `${anyStun} applied stuns`);
  say(`STUN_GRACE_MS is live (${STUN_GRACE_MS} ms) so applied < emitted is possible`, STUN_GRACE_MS > 0);

  // DETERMINISM: the sim underwrites every balance number in the project. Two runs of
  // one seed must be bit-identical, or nothing below means anything.
  const m2 = runMatch('pizza', 'burrito', 'smart2', 0);
  say('DETERMINISM same seed reproduces the streams exactly',
    JSON.stringify(m) === JSON.stringify(m2));

  console.log(`\n  ${ok} passed, ${bad} failed`);
  process.exit(bad === 0 ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const all = [];
let matches = 0;
for (const p of CHARACTER_IDS) {
  for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    for (let s = 0; s < SEEDS; s++) {
      all.push(...runMatch(p, e, 'smart2', s));
      matches++;
    }
  }
}

console.log(`\n╔══ CAST INTERRUPTION, priced on ${matches} real matches (110 matchups x ${SEEDS} seeds, smart2, shipped arena) ══ ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`\n  Denominator: every tick a fighter is ALIVE, the match is PLAYING, and its ULTIMATE is off cooldown.`);
console.log(`  "survives" = the cast would have resolved without being cancelled under that rule.\n`);
for (const [key, label] of [['ready', 'DENOMINATOR 1: off cooldown (most of the match — nobody is in range)'],
                            ['readyInRange', 'DENOMINATOR 2: off cooldown AND the ultimate REACHES someone — the honest one']]) {
  console.log(`\n  ${label}`);
  console.log('   T(ms)   PRESSES(n)   ticks     A: nothing   B: ANY damage   B\': weapon/trail   C: applied STUN only   +/- (95% on n)');
  for (const T of TS) {
    const r = survival(all, T, key, DT);
    const pc = (x) => (r.opps ? `${((x / r.opps) * 100).toFixed(1)}%` : 'n/a');
    // 95% binomial half-width at the WORST-CASE p = 0.5, on the PRESS count — the honest n.
    const hw = r.opps ? (1.96 * Math.sqrt(0.25 / r.opps) * 100).toFixed(2) : 'n/a';
    console.log(`   ${String(T).padStart(5)}   ${String(r.opps).padStart(10)}   ${String(r.ready).padStart(7)}   ${'100.0%'.padStart(10)}   ${pc(r.oAny).padStart(13)}   ${pc(r.oFight).padStart(17)}   ${pc(r.oStun).padStart(20)}   ${String(hw).padStart(6)} pp`);
  }
}
console.log(`\n  ⚠️ UPPER BOUND. This models a caster that KEPT MOVING (no cast exists in the sim yet).`);
console.log(`     A real cast roots its caster, so the true survival rate is at or BELOW every figure above.`);
