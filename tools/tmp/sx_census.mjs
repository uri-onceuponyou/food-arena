#!/usr/bin/env node
/**
 * SX_CENSUS — the SIM half of the six-player end-to-end acceptance run.
 *
 * The renderer half is `sx_sixplay.mjs`. This one answers the questions that are numbers,
 * over a corpus, so the report can say "31 of 40" rather than "I watched one and it looked
 * fine". Every question here is a **seam between two subsystems that were each verified
 * alone** (`6631446` spawns · `4bb64e4` ring · `f87d407` sudden death · `721ce3c` payouts):
 *
 *   Q1  SPAWNS      — do the six declared spawns actually seat six fighters? Minimum
 *                     pairwise separation, and does every seat survive the opening?
 *   Q2  MOTION      — does every seat MOVE and does every seat FIGHT? A six-seat brawl in
 *                     which two seats never dealt or took damage is not a six-player match,
 *                     and no unit gate anywhere asks this.
 *   Q3  SUDDEN DEATH— does it fire, does `resolveTimeout` stay unreachable, and is the
 *                     winner the fighter with the most HP at the trigger?
 *   Q4  PLACEMENT   — the full 1..N finish order, which is what the payout curve is indexed
 *                     on. A curve that pays six seats is worth nothing if the sim only ever
 *                     produces two distinct places.
 *
 * ── 🚨 THE CONTROLS, AND WHY EACH ONE COULD HAVE FAILED ─────────────────────
 *
 * `docs/AGENT-BRIEF.md` §4.4 and three separate failures on 2026-08-11 (a control placed
 * where the bug could not express itself; three known-bads that each certified the check
 * they were meant to falsify; a suite reporting 227 passed through a rewrite it could not
 * see). **Ask of every control: could this scenario distinguish the two arms at all?**
 *
 *   `--arm immortal`   Every seat gets `maxHp: 1e7` through the PUBLIC `FighterConfig`
 *                      surface. Nobody can be knocked out and the fog's 15 HP/tick cannot
 *                      kill in 15 s either, so the match MUST run to `timeRemaining === 0`
 *                      and `resolveTimeout` MUST fire. If Q3's "no timeouts" row stays green
 *                      here, the row is measuring nothing. ⚠️ This is the same forced-immortal
 *                      idiom `DECISIONS §58` needed, and it is placed where the bug CAN
 *                      express itself — §58 records both of its first known-bads coming back
 *                      green because the fighters were at 300 wu, where the legacy ring
 *                      burned them anyway.
 *   `--arm minhp`      Q3's HP check is re-run against **argmin** instead of argmax. It must
 *                      go RED. If both directions pass, the corpus has no HP spread at the
 *                      trigger and the check is vacuous — so the spread distribution is
 *                      printed unconditionally, not just when it is convenient.
 *   `--arm stacked`    All six spawns collapsed onto one point ±20 wu. Q1's separation row
 *                      must go RED. Proves the separation row is reading the real spawns and
 *                      not a constant.
 *   `--arm frozen`     One seat is handed `spawn` inside a sealed cover box... NOT USED — see
 *                      the note at `ARMS`; there is no legal way to freeze one AI seat
 *                      through the public config surface, so Q2's per-seat motion row is
 *                      instead falsified by `--arm stacked`, where seats that start on top of
 *                      each other produce a measurably different motion profile.
 *
 * ── WHAT THIS DOES NOT CLAIM ────────────────────────────────────────────────
 *
 * Every seat is `controller: 'ai'` and no human input is supplied, exactly as `nf_ffa.mjs`
 * does and for the same measured reason: `scripted_player.mjs`'s six policies all open
 * `const p = state.player, e = state.enemy`, so it cannot drive seats 2–5 at all. So this
 * is the shipped bot policy at six seats. It is **not** comparable to any 110-cell 1v1
 * number, and this file never prints one next to the other.
 *
 * `--dt` is the sim tick. The shipped renderer does NOT sub-step — `match.ts:loop` calls
 * `stepMatch` once per frame with `min(realDelta, 1/20) * simSpeed` — so under SwiftShader
 * the browser arm runs at dt≈50 ms while this runs at 16.667. Stated because it means the
 * two arms are not expected to agree tick-for-tick, only in distribution.
 *
 *   node tools/tmp/sx_census.mjs --n 6 --matches 40
 *   node tools/tmp/sx_census.mjs --n 6 --matches 40 --arm immortal    # the timeout control
 *   node tools/tmp/sx_census.mjs --n 6 --matches 40 --arm minhp       # the polarity control
 *   node tools/tmp/sx_census.mjs --n 6 --matches 40 --arm stacked     # the spawn control
 *   node tools/tmp/sx_census.mjs --n 2 --matches 40                   # the duel control
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

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
const {
  CHARACTER_IDS, MATCH_DURATION_MS, LEVEL_MIN,
  SUDDEN_DEATH_REMAINING_MS, FOG_DAMAGE, REACH,
  minSafeRadiusFor, suddenDeathActive,
} = RULES;

const N = Number(args.n ?? 6);
const MATCHES = Number(args.matches ?? 40);
const DT = Number(args.dt ?? 16.667);
const ARM = String(args.arm ?? 'base');
const HARD_CAP = MATCH_DURATION_MS * 4;

// ── THE ARENA ───────────────────────────────────────────────────────────────
// The shipped dump, which carries the ×4 map's six declared spawns. `maxSafeRadius` is
// DERIVED in `arena/shared.ts`, so it is read from the dump rather than recomputed here —
// and the dump is checked against the sim's own arena size, because a stale 1400×1000 dump
// is exactly the failure `DECISIONS §60` found in four separate fixtures.
const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`sx_census: no arena dump at ${ARENA_PATH}`); process.exit(2); }
const ARENA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
if (!Array.isArray(ARENA.spawns) || ARENA.spawns.length < N) {
  console.error(`sx_census: arena declares ${ARENA.spawns?.length ?? 0} spawns; need ${N}.`);
  process.exit(2);
}

/** Seeded roster picker — deterministic per match index, and it never repeats a character
 *  inside one match (six of the same character measures the sim, not the game). */
function rosterFor(i) {
  const ids = CHARACTER_IDS.slice();
  let s = (i * 2654435761) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0; t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
  return ids.slice(0, N);
}

/**
 * Spawn set for an arm.
 *
 *   `stacked`  the KNOWN-BAD for Q1: six seats on one point. Nothing else changes.
 *   `rotate`   🚨 THE DISCRIMINATOR FOR THE SEAT-BIAS FINDING. The spawn LIST is rotated by
 *              two, so slot 0 starts where slot 2 used to and so on. Two hypotheses produce
 *              the same per-seat table and are completely different bugs:
 *                (a) SLOT-INDEX advantage — the fighter loop, tie-breaks, `nearestLivingOpponent`
 *                    ordering. Then the advantage stays on slots 2 and 3.
 *                (b) SPAWN-LOCATION advantage — geometry. Then it MOVES to slots 0 and 1.
 *              Nothing else here can tell them apart, and reporting the bias without telling
 *              them apart would route the fix to the wrong file.
 */
function spawnsFor(arm, i) {
  const shipped = ARENA.spawns.slice(0, N).map((p) => ({ x: p.x, y: p.y }));
  if (arm === 'rotate') return shipped.map((_, k) => shipped[(k + 2) % N]);
  if (arm !== 'stacked') return shipped;
  const c = ARENA.center;
  return Array.from({ length: N }, (_, k) => ({
    x: c.x + 600 + (k % 3) * 14, y: c.y + 600 + Math.floor(k / 3) * 14,
  }));
}

function runMatch(i, arm) {
  const ids = rosterFor(i);
  const spawns = spawnsFor(arm, i);
  const configs = ids.map((characterId, seat) => {
    const c = { characterId, controller: 'ai', spawn: spawns[seat], level: LEVEL_MIN };
    // The immortal arm goes through the PUBLIC `FighterConfig.maxHp` field — no patched sim,
    // no edited constant, nothing this tool could get wrong about which build it measured.
    if (arm === 'immortal') c.maxHp = 1e7;
    return c;
  });
  const state = createMatch(ARENA, configs);
  const n = state.fighters.length;
  const human = state.fighters.filter((f) => f.controller !== 'ai').map((f) => f.id);
  if (human.length) throw new Error(`sx_census: slot(s) ${human} are not 'ai'`);
  const inputs = new Array(n).fill(null);

  // Opening geometry, read off the CONSTRUCTED fighters rather than off the config — a
  // spawn the sim silently relocated (out of a cover box, say) would otherwise be invisible.
  const spawn0 = state.fighters.map((f) => ({ x: f.x, y: f.y }));
  let minSep = Infinity, minSepPair = null;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const d = Math.hypot(spawn0[a].x - spawn0[b].x, spawn0[a].y - spawn0[b].y);
    if (d < minSep) { minSep = d; minSepPair = [a, b]; }
  }

  const path = new Array(n).fill(0);
  const dealt = new Array(n).fill(0);
  const taken = new Array(n).fill(0);
  const fogTaken = new Array(n).fill(0);
  const deathOrder = [];
  let prev = spawn0.map((p) => ({ ...p }));
  let winnerId = null;
  let hpAtTrigger = null;          // HP of every fighter on the first sudden-death tick
  let aliveAtTrigger = null;
  let nonFogDamageAfterTrigger = 0;
  let sawTrigger = false;
  let ticks = 0;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const evs = stepMatch(state, DT, inputs);
    ticks++;
    const inSd = suddenDeathActive(state.timeRemaining) && state.phase !== 'countdown';
    if (inSd && !sawTrigger) {
      sawTrigger = true;
      hpAtTrigger = state.fighters.map((f) => (f.alive ? f.hp : -1));
      aliveAtTrigger = state.fighters.filter((f) => f.alive).length;
    }
    for (let k = 0; k < n; k++) {
      const f = state.fighters[k];
      path[k] += Math.hypot(f.x - prev[k].x, f.y - prev[k].y);
      prev[k] = { x: f.x, y: f.y };
    }
    for (const ev of evs) {
      if (ev.type === 'hit-landed') {
        taken[ev.targetId] += ev.amount;
        const s = ev.source;
        const att = s.kind === 'weapon' ? s.attackerId : s.kind === 'trail' ? s.ownerId : null;
        if (att !== null && att !== ev.targetId) dealt[att] += ev.amount;
        if (s.kind === 'fog') fogTaken[ev.targetId] += ev.amount;
        else if (sawTrigger && ev.amount > 0) nonFogDamageAfterTrigger += ev.amount;
      } else if (ev.type === 'death') deathOrder.push(ev.fighterId);
      else if (ev.type === 'match-ended') winnerId = ev.winnerId;
    }
  }

  // `timeRemaining > 0` at `ended` is a knockout; `=== 0` is the clock, i.e. `resolveTimeout`.
  const ending = state.phase !== 'ended' ? 'UNRESOLVED'
    : state.timeRemaining > 0 ? 'knockout' : 'timeout';

  // Placement: last death is 2nd, first death is Nth. The winner is 1st.
  const place = new Array(n).fill(0);
  place[winnerId ?? 0] = 1;
  let rank = n;
  for (const id of deathOrder) { if (id !== winnerId) { place[id] = rank; rank--; } }
  // Any seat still alive but not the winner (a simultaneous wipe) shares the leftover ranks.
  for (let k = 0; k < n; k++) if (place[k] === 0) place[k] = rank--;

  let hpWinnerOk = null, hpLoserOk = null, hpSpread = null;
  if (sawTrigger && aliveAtTrigger >= 2) {
    const live = hpAtTrigger.map((hp, id) => ({ hp, id })).filter((r) => r.hp >= 0);
    const best = live.reduce((a, b) => (b.hp > a.hp || (b.hp === a.hp && b.id < a.id) ? b : a));
    const worst = live.reduce((a, b) => (b.hp < a.hp || (b.hp === a.hp && b.id < a.id) ? b : a));
    hpSpread = best.hp - worst.hp;
    hpWinnerOk = winnerId === best.id;
    // ⚠️ THE POLARITY CONTROL IS `null` ON A TIE, AND THE FIRST VERSION WAS NOT.
    // Both reducers prefer the LOWER id on equal HP, so at `hpSpread === 0` they return the
    // SAME fighter and "the winner had the least HP" is true whenever "the winner had the
    // most HP" is. That is not a counter-example, it is the control having nothing to say —
    // and it showed up as exactly one red row in a 200-match corpus, which reads like a
    // finding. `AGENT-BRIEF` §4.4: could this scenario distinguish the two arms at all?
    hpLoserOk = hpSpread > 0 ? winnerId === worst.id : null;
  }

  return {
    i, ids, ending, winnerId, place, ticks,
    endMs: state.elapsed, timeRemaining: state.timeRemaining,
    minSep, minSepPair, path, dealt, taken, fogTaken,
    sawTrigger, aliveAtTrigger, hpAtTrigger, hpSpread, hpWinnerOk, hpLoserOk,
    nonFogDamageAfterTrigger,
    deaths: deathOrder.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
if (!IS_MAIN) { /* importable: no CLI side effects (AGENT-BRIEF §3) */ }
else {
  const t0 = Date.now();
  const rows = [];
  for (let i = 0; i < MATCHES; i++) rows.push(runMatch(i, ARM));

  const pct = (k, d = rows.length) => `${((100 * k) / d).toFixed(1)}%`;
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok   - ${name}${detail ? `   ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
  };

  console.log(`\nSX_CENSUS  n=${N}  matches=${MATCHES}  dt=${DT}  arm=${ARM}`);
  console.log(`arena ${ARENA.width}×${ARENA.height}  maxSafeRadius ${ARENA.maxSafeRadius}`
    + `  ringFloor(N=${N}) ${minSafeRadiusFor(N).toFixed(2)}  sudden death at ${((MATCH_DURATION_MS - SUDDEN_DEATH_REMAINING_MS) / 1000).toFixed(1)} s`);

  // ── Q1 SPAWNS ─────────────────────────────────────────────────────────────
  const minSeps = rows.map((r) => r.minSep);
  const worst = Math.min(...minSeps);
  console.log(`\nQ1 SPAWNS`);
  console.log(`   min pairwise separation: ${worst.toFixed(1)} wu (identical across matches: ${new Set(minSeps.map((x) => x.toFixed(3))).size === 1})`);
  console.log(`   REACH.rangedMax ${REACH.rangedMax} · meleeHeavy ${REACH.meleeHeavy}`);
  check('every pair of spawns is out of every weapon\'s reach',
    worst > REACH.rangedMax, `worst ${worst.toFixed(1)} wu vs rangedMax ${REACH.rangedMax}`);

  // ── Q2 MOTION AND CONTACT ─────────────────────────────────────────────────
  const seatMoved = Array.from({ length: N }, (_, k) => rows.filter((r) => r.path[k] > 100).length);
  const seatDealt = Array.from({ length: N }, (_, k) => rows.filter((r) => r.dealt[k] > 0).length);
  const seatTook = Array.from({ length: N }, (_, k) => rows.filter((r) => r.taken[k] - r.fogTaken[k] > 0).length);
  const allSixEngaged = rows.filter((r) => r.dealt.every((d) => d > 0)).length;
  const neverEngaged = rows.reduce((s, r) => s + r.dealt.filter((d) => d === 0).length, 0);
  console.log(`\nQ2 MOTION AND CONTACT   (per seat, over ${rows.length} matches)`);
  console.log(`   seat            ${Array.from({ length: N }, (_, k) => String(k).padStart(6)).join('')}`);
  console.log(`   moved >100 wu   ${seatMoved.map((v) => String(v).padStart(6)).join('')}`);
  console.log(`   dealt damage    ${seatDealt.map((v) => String(v).padStart(6)).join('')}`);
  console.log(`   took non-fog    ${seatTook.map((v) => String(v).padStart(6)).join('')}`);
  console.log(`   mean path (wu)  ${Array.from({ length: N }, (_, k) => Math.round(mean(rows.map((r) => r.path[k])))).map((v) => String(v).padStart(6)).join('')}`);
  console.log(`   matches where ALL ${N} seats dealt damage: ${allSixEngaged} (${pct(allSixEngaged)})`);
  console.log(`   seat-matches that never dealt any damage: ${neverEngaged} of ${rows.length * N} (${pct(neverEngaged, rows.length * N)})`);
  check('every seat moves in every match', seatMoved.every((v) => v === rows.length),
    seatMoved.map((v, k) => `slot${k}:${v}`).join(' '));

  // ── Q3 SUDDEN DEATH ───────────────────────────────────────────────────────
  const fired = rows.filter((r) => r.sawTrigger).length;
  const timeouts = rows.filter((r) => r.ending === 'timeout').length;
  const unresolved = rows.filter((r) => r.ending === 'UNRESOLVED').length;
  const decided = rows.filter((r) => r.hpWinnerOk !== null);
  const clean = decided.filter((r) => r.nonFogDamageAfterTrigger === 0);
  const spreads = decided.map((r) => r.hpSpread).filter((x) => x !== null);
  console.log(`\nQ3 SUDDEN DEATH`);
  console.log(`   matches reaching the 30 s trigger: ${fired} (${pct(fired)})`);
  console.log(`   endings: knockout ${rows.filter((r) => r.ending === 'knockout').length}`
    + ` · timeout ${timeouts} · UNRESOLVED ${unresolved}`);
  console.log(`   mean match length: ${(mean(rows.map((r) => r.endMs)) / 1000).toFixed(2)} s`);
  if (decided.length) {
    console.log(`   decided AT/AFTER the trigger with >=2 alive: ${decided.length}`);
    console.log(`   HP spread at trigger: min ${Math.min(...spreads)} · median ${spreads.slice().sort((a, b) => a - b)[spreads.length >> 1]} · max ${Math.max(...spreads)} (fog bucket = ${FOG_DAMAGE})`);
    console.log(`   winner == MOST hp at trigger: ${decided.filter((r) => r.hpWinnerOk).length}/${decided.length}`);
    console.log(`   winner == LEAST hp at trigger: ${decided.filter((r) => r.hpLoserOk === true).length}/${decided.filter((r) => r.hpLoserOk !== null).length}`
      + `   ← the polarity control (${decided.filter((r) => r.hpLoserOk === null).length} tied, so mute)`);
    console.log(`   of those with NO non-fog damage after the trigger (${clean.length}): most-hp wins ${clean.filter((r) => r.hpWinnerOk).length}/${clean.length}`);
  }
  check('resolveTimeout is unreachable (no match ends on the clock)', timeouts === 0,
    `${timeouts} of ${rows.length} ended at timeRemaining === 0`);
  check('no match is left UNRESOLVED', unresolved === 0, `${unresolved} of ${rows.length}`);
  if (clean.length) {
    check('the HP leader at the trigger wins, absent other damage',
      clean.every((r) => r.hpWinnerOk), `${clean.filter((r) => r.hpWinnerOk).length}/${clean.length}`);
    check('THE POLARITY CONTROL: the HP *loser* does NOT win',
      clean.filter((r) => r.hpLoserOk === true).length === 0 && spreads.filter((s) => s >= FOG_DAMAGE).length >= 10,
      `hpLoserOk ${clean.filter((r) => r.hpLoserOk === true).length} of ${clean.filter((r) => r.hpLoserOk !== null).length} untied;`
      + ` spreads >= ${FOG_DAMAGE}: ${spreads.filter((s) => s >= FOG_DAMAGE).length}/${spreads.length}`);
  }

  // ── Q4 PLACEMENT ──────────────────────────────────────────────────────────
  const placeHist = Array.from({ length: N }, (_, p) => rows.reduce((s, r) => s + r.place.filter((x) => x === p + 1).length, 0));
  console.log(`\nQ4 PLACEMENT   (the quantity the payout curve is indexed on)`);
  console.log(`   place           ${Array.from({ length: N }, (_, k) => String(k + 1).padStart(6)).join('')}`);
  console.log(`   count           ${placeHist.map((v) => String(v).padStart(6)).join('')}`);
  const distinct = placeHist.filter((v) => v > 0).length;
  check(`all ${N} finishing places actually occur`, distinct === N, `${distinct} distinct places seen`);

  // ── Q5 SEAT FAIRNESS ──────────────────────────────────────────────────────
  // The roster is SHUFFLED per match, so which character sits in which seat is randomised and
  // character strength averages out over the corpus. What survives is the SEAT effect.
  // Fair = (N+1)/2. The standard error is printed per seat rather than a floor being quoted:
  // this is a mean over matches, so its resolution is its own SE and nothing else.
  const seatMean = Array.from({ length: N }, (_, k) => mean(rows.map((r) => r.place[k])));
  const seatSe = Array.from({ length: N }, (_, k) => {
    const xs = rows.map((r) => r.place[k]); const m = mean(xs);
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)) / Math.sqrt(xs.length);
  });
  const radius = Array.from({ length: N }, (_, k) => {
    const s = spawnsFor(ARM, 0)[k];
    return Math.hypot(s.x - ARENA.center.x, s.y - ARENA.center.y);
  });
  const fair = (N + 1) / 2;
  console.log(`\nQ5 SEAT FAIRNESS   (fair mean placement = ${fair.toFixed(2)})`);
  console.log(`   seat            ${Array.from({ length: N }, (_, k) => String(k).padStart(8)).join('')}`);
  console.log(`   spawn radius    ${radius.map((v) => v.toFixed(0).padStart(8)).join('')}`);
  console.log(`   mean placement  ${seatMean.map((v) => v.toFixed(2).padStart(8)).join('')}`);
  console.log(`   ± standard err  ${seatSe.map((v) => v.toFixed(3).padStart(8)).join('')}`);
  console.log(`   1st-place count ${Array.from({ length: N }, (_, k) => String(rows.filter((r) => r.place[k] === 1).length).padStart(8)).join('')}`);
  console.log(`   damage dealt    ${Array.from({ length: N }, (_, k) => mean(rows.map((r) => r.dealt[k])).toFixed(0).padStart(8)).join('')}`);
  const spread = Math.max(...seatMean) - Math.min(...seatMean);
  const worstSe = Math.max(...seatSe);
  console.log(`   spread ${spread.toFixed(2)} places against a worst-seat SE of ${worstSe.toFixed(3)} — ${(spread / worstSe).toFixed(0)}×`);
  check('no seat is worth more than half a place of advantage', spread < 0.5,
    `spread ${spread.toFixed(2)} places, best seat ${seatMean.indexOf(Math.min(...seatMean))}, worst seat ${seatMean.indexOf(Math.max(...seatMean))}`);

  console.log(`\n${pass} passed, ${fail} failed   (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (args.json) writeFileSync(String(args.json), JSON.stringify({ n: N, arm: ARM, dt: DT, rows }, null, 1));
  process.exit(fail ? 1 : 0);
}
