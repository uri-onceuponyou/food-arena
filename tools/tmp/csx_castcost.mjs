#!/usr/bin/env node
/**
 * CSX_CASTCOST — what does the wind-up actually COST, on real matches?
 *
 * `rules.ts:Weapon.castMs` turns one press into a commitment: `castMs` of rooting, a frozen
 * aim, and an outcome that can be dodged or interrupted. Every one of those is a nerf, and
 * `DECISIONS §68` had just tuned the roster spread to 9.8 pp — so "how big is the nerf" is a
 * number this pass owes, not an impression.
 *
 * It answers four questions the aggregate win rate cannot:
 *
 *   HOW OFTEN   casts opened per match — the spec's estimate was ~1.63 and estimates from
 *               press-OPPORTUNITY counts systematically overshoot, because an opportunity
 *               is not a press.
 *   WHAT HAPPENED TO THEM   resolved / cancelled by stun / cancelled by death / still open
 *               when the match ended. The last bucket is the deliberate do-nothing in
 *               `resolveDueCast`'s phase gate, and it should be small but non-zero.
 *   DID IT LAND   of the casts that RESOLVED, how many put damage on anybody. This is the
 *               counterplay number measured on play rather than on geometry: `sim.test.mjs`
 *               §33(d) proves a target that runs escapes, and this says how often one does.
 *   THE ROOT      total ms per match a fighter spent unable to move because of a cast.
 *
 * ⚠️ RESOLUTION: every figure here is an EXACT count over a fixed, deterministic corpus —
 * same seeds, same driver, no sampling. It is not a win rate and has no ±9 pp floor. What it
 * cannot tell you is whether the roster moved; that is `roster_lab`'s paired delta, and the
 * two must never be added.
 *
 *   node tools/tmp/csx_castcost.mjs --selftest
 *   node tools/tmp/csx_castcost.mjs --seeds 8
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
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

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS, fogOpeningRadiusFor } = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!ARENA_DATA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
// The SHIPPED opening-radius derivation, never the pre-`6d5c4d6` clock coupling — 47 live
// copies of that formula are still in the tree and it is off by up to 181 wu.
const arena = {
  ...ARENA_DATA,
  maxSafeRadius: fogOpeningRadiusFor(Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2)),
  build: () => null,
  update: () => {},
};

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICY = String(args.policy ?? 'smart2');
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...parseDriverFlags(args) });

/** Derived, never typed — see `csx_bitid.mjs` for why a literal roster list rots. */
const CAST_KEYS = new Set();
for (const id of CHARACTER_IDS) {
  for (const w of CHARACTERS[id].weapons) if ((w.castMs ?? 0) > 0) CAST_KEYS.add(`${id}.${w.key}`);
}

/**
 * One match, instrumented off the EVENT STREAM plus a per-tick read of `Fighter.cast`.
 *
 * ⚠️ THE ROOT IS COUNTED BY OBSERVING `cast !== null` ON EVERY TICK, not by adding up
 * `castMs`. Those are different numbers: a cast cancelled at 200 ms roots for 200 ms, not
 * 1100, and a cast still open at the whistle roots for however much of it the match had
 * left. Deriving it from the authored duration would report the root the design intends
 * rather than the root the sim delivers, which is the entire class of error this file's
 * `pressValue` history is about.
 */
function playMatch(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
  const state = createMatch(arena, playerId, enemyId);

  const r = {
    opened: 0, resolved: 0, stunned: 0, died: 0, parked: 0,
    landed: 0, damage: 0, rootMs: 0, ticks: 0,
  };
  // A resolve is `weapon-fired` for a cast weapon; whether it LANDED is whether a
  // `hit-landed` from that same weapon appears in the same tick's events, which is exactly
  // how the sim orders them (`resolveWeapon` pushes the shot, then `deliverWeapon` the hit).
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const events = stepMatch(state, DT, loop.next(state, DT));
    r.ticks++;
    for (const f of state.fighters) if (f.cast !== null) r.rootMs += DT;
    let resolvedThisTick = null;
    for (const ev of events) {
      if (ev.type === 'cast-started') r.opened++;
      else if (ev.type === 'cast-cancelled') { if (ev.reason === 'stun') r.stunned++; else r.died++; }
      else if (ev.type === 'weapon-fired') {
        const f = state.fighters[ev.fighterId];
        if (CAST_KEYS.has(`${f.characterId}.${ev.weaponKey}`)) { r.resolved++; resolvedThisTick = ev.weaponKey; }
      }
    }
    if (resolvedThisTick !== null) {
      const hits = events.filter(
        (e) => e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === resolvedThisTick,
      );
      if (hits.length) { r.landed++; r.damage += hits.reduce((a, h) => a + h.amount, 0); }
    }
  }
  r.parked = state.fighters.filter((f) => f.cast !== null).length;
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => {
    if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); }
  };
  console.log(`\n══ csx_castcost SELFTEST ══  sim ${SIM_DIR}`);

  ok('the cast-weapon key set is DERIVED and non-empty — every count below filters on it',
    CAST_KEYS.size > 0, `[${[...CAST_KEYS].join(', ')}]`);

  // 🚨 A NON-VACUITY ROW BEFORE ANY RATIO. Every "of the casts that resolved…" figure is
  // 0/0 on a corpus where nobody casts, and 0/0 prints as a clean 0.0% that reads like a
  // finding. So the instrument is required to SEE casts on the matchup that has one.
  const wb = playMatch('waterbottle', 'donut', 0);
  ok('a matchup containing the cast character actually opens casts', wb.opened > 0, JSON.stringify(wb));
  ok('…and every opened cast is accounted for exactly once',
    wb.opened === wb.resolved + wb.stunned + wb.died + wb.parked,
    `opened ${wb.opened} = resolved ${wb.resolved} + stun ${wb.stunned} + death ${wb.died} + parked ${wb.parked}`);
  ok('…and the observed root is positive and never exceeds opened x castMs',
    wb.rootMs > 0 && wb.rootMs <= wb.opened * 1100 + DT * wb.opened,
    `rootMs ${wb.rootMs.toFixed(1)} over ${wb.opened} casts`);

  // KNOWN-BAD: a matchup with NO cast character must report a flat zero on every column.
  // Without this row an instrument that counted every `weapon-fired` would look identical.
  const none = playMatch('hamburger', 'donut', 0);
  ok('KNOWN-BAD: a matchup with no cast weapon reports zero on every cast column',
    none.opened === 0 && none.resolved === 0 && none.rootMs === 0 && none.parked === 0,
    JSON.stringify(none));
  ok('…and that control match was a real match, not an empty one',
    none.ticks > 100, `${none.ticks} ticks`);

  ok('deterministic: the same seed replays exactly',
    JSON.stringify(playMatch('waterbottle', 'donut', 3)) === JSON.stringify(playMatch('waterbottle', 'donut', 3)));

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the run
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main) {
  const t0 = Date.now();
  const rows = [];
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) rows.push({ ...playMatch(p, e, s), p, e });
    }
  }
  const withCast = rows.filter((r) => r.opened > 0);
  const add = (rs, k) => rs.reduce((a, r) => a + r[k], 0);
  const pct = (a, b) => (b === 0 ? 'n/a' : `${((a / b) * 100).toFixed(1)}%`);

  const opened = add(rows, 'opened');
  const resolved = add(rows, 'resolved');
  const landed = add(rows, 'landed');

  console.log(`\n══ CSX_CASTCOST ══  ${rows.length} matches · policy ${POLICY} · ${SEEDS} seeds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   cast weapons (derived): [${[...CAST_KEYS].join(', ')}]\n`);
  console.log(`   matches containing at least one cast   ${withCast.length}/${rows.length}`);
  console.log(`   casts OPENED                           ${opened}   (${(opened / Math.max(1, withCast.length)).toFixed(2)} per such match)`);
  console.log(`     -> RESOLVED                          ${resolved}  ${pct(resolved, opened)}`);
  console.log(`     -> cancelled by an APPLIED STUN      ${add(rows, 'stunned')}  ${pct(add(rows, 'stunned'), opened)}`);
  console.log(`     -> cancelled by DEATH                ${add(rows, 'died')}  ${pct(add(rows, 'died'), opened)}`);
  console.log(`     -> still open when the match ended   ${add(rows, 'parked')}  ${pct(add(rows, 'parked'), opened)}`);
  console.log(`\n   of the RESOLVED casts, LANDED damage   ${landed}  ${pct(landed, resolved)}   <-- the dodge, measured on play`);
  console.log(`   damage delivered by cast weapons        ${add(rows, 'damage')}`);
  console.log(`\n   ROOT (observed, not authored)`);
  console.log(`     total                                ${(add(rows, 'rootMs') / 1000).toFixed(1)} s over ${withCast.length} matches`);
  console.log(`     per match containing a cast          ${(add(rows, 'rootMs') / 1000 / Math.max(1, withCast.length)).toFixed(2)} s`);
  console.log(`     per cast opened                      ${(add(rows, 'rootMs') / Math.max(1, opened)).toFixed(0)} ms\n`);
}
