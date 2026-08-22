#!/usr/bin/env node
/**
 * fgc_sd — WHERE IS THE FIGHTER, AND WHAT DOES THE SCREEN SAY, ON THE TICK SUDDEN DEATH FIRES?
 *
 * HYPOTHESIS C for Uri's report *"something in the fog doesn't make sense. It starts
 * decreasing my HP before it reaches me."* At `SUDDEN_DEATH_MS` (30 s of a 45 s clock)
 * `sim.ts:534` replaces the scheduled ring — **661.67 wu on this map** — with
 * `SUDDEN_DEATH_RADIUS = 0` in ONE tick, and `applySuddenDeathFog` burns everyone at
 * `FOG_DAMAGE / FOG_TICK_MS` = 50 HP/s. A fighter standing well inside the ring loses HP
 * with the fog boundary hundreds of world units away. That is Uri's sentence with no
 * rendering defect involved, so it has to be separated from the rendering hypotheses
 * rather than assumed away.
 *
 * This tool answers three questions the existing instruments do not:
 *
 *   1. WHAT SHARE of 1v1 matches reach the trigger?  (`sd_lab --census` answers this; this
 *      tool reproduces it on a wider seed set so the rate carries an interval.)
 *   2. HOW FAR INSIDE THE RING is each fighter on the crossing tick — the "surprise
 *      distance" — and is the boundary even ON SCREEN at that moment?
 *   3. WHAT DOES THE HUD SAY one tick earlier? `ui/hud.ts:zoneInfo` inverts the LINEAR
 *      schedule and knows nothing about the collapse, so it prints a countdown to an
 *      arrival that is about to happen far sooner than it claims.
 *
 * ── HONEST LIMITS, STATED BEFORE THE NUMBERS ──────────────────────────────────
 *   * The scripted driver is not a human. It has perfect information and perfect aim, so
 *     it kills faster than a person does; the share of matches reaching 30 s is therefore
 *     a LOWER BOUND on the human rate, not an estimate of it. And the driver cannot be
 *     degraded into a proxy for a human — every way of slowing it down (`--react`) makes
 *     matches SHORTER, because a passive fighter is killed by the ordinary fog at its
 *     spawn (measured: `match-sim --policy idle` ends at 21.2-22.7 s, 0/110 reach 30 s).
 *   * The camera visibility test uses `tools/aspect.mjs`'s measured ground reach
 *     (199 wu near/far at 16:9 and 19.5:9, 231 wu at 4:3). It is a geometric test on the
 *     boundary's distance, not a render.
 *
 * ── RESOLUTION FLOORS ─────────────────────────────────────────────────────────
 *   * the trigger RATE is a binomial proportion over ~110 independent matchups (seeds and
 *     policies re-run the same matchups, so they are NOT independent samples); at p ~ 0.02
 *     the SE on 110 is ~1.4 pp, so **do not act on a difference smaller than ~3 pp**.
 *   * the surprise DISTANCE is exact per match (one deterministic sim), and the
 *     distribution is over however many matches reached the trigger — printed, so a
 *     small n is visible rather than hidden.
 *
 * Use:
 *   node tools/tmp/fgc_sd.mjs --selftest        # known-bad validation, no corpus
 *   node tools/tmp/fgc_sd.mjs                   # 8 seeds  (sd_lab's corpus, 880 matches)
 *   node tools/tmp/fgc_sd.mjs --seeds 32        # 3520 matches, a usable n at the trigger
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng, parseDriverFlags } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);

const sim = await import(`${ROOT}/src/game/sim.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const ai = await import(`${ROOT}/src/game/ai.ts`);
const {
  CHARACTER_IDS, MATCH_DURATION_MS, SUDDEN_DEATH_MS, SUDDEN_DEATH_REMAINING_MS,
  FOG_DAMAGE, FOG_TICK_MS, AI_SELF_HEAL_HP_FRACTION, ringFloorFor, suddenDeathActive,
} = RULES;

// ── the arena, DERIVED exactly as sd_lab / roster_lab derive it ───────────────
// `maxSafeRadius` is recomputed from the clock rather than read out of the cache, because
// the cache goes stale the moment `MATCH_DURATION_MS` moves.
const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.log(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
const FOG_FIRST_CONTACT_MS = 6000;
const ARENA = {
  ...ARENA_DATA,
  maxSafeRadius: Math.round(
    Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS),
  ),
  build: () => null,
  update: () => {},
};

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2').split(',');
const DRIVER_FLAGS = parseDriverFlags(args);

/** `render/camera.ts` guaranteed ground reach, as MEASURED by `tools/aspect.mjs`. */
const SEE_WU_16_9 = 199;
const SEE_WU_4_3 = 231;
/** `render/camera.ts:FAIR_PLAY.radiusUnits`, the constant `hud.ts:imminentMs` reads. */
const FAIR_RADIUS_UNITS = 199.2;

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok - ${name}`); }
  else { failures.push(`${name}${detail ? `  — ${detail}` : ''}`); console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

// ─────────────────────────────────────────────────────────────────────────────
// THE HUD, RE-DERIVED — and pinned to the shipped source so it cannot drift silently
// ─────────────────────────────────────────────────────────────────────────────
//
// `ui/hud.ts` is a browser module (DOM, `render/camera.ts`, three.js) and cannot be
// imported here, so the two readouts a player sees are restated. A restatement is a second
// source of truth, which is the thing this project has been burned by most — so the
// restatement is GUARDED: the exact shipped expressions must still be present in
// `src/ui/hud.ts`, or this tool refuses to print a HUD number. `--selftest` proves the
// guard FAILS on a string that is not there (a guard never shown to fail is not a guard).
const HUD_SRC = readFileSync(`${ROOT}/src/ui/hud.ts`, 'utf8');
const HUD_PINS = [
  // zoneInfo's countdown — the inversion of the LINEAR schedule
  'outside || holds || shrinkPerMs <= 0 ? null : (state.safeRadius - dist) / shrinkPerMs',
  // zoneInfo's `holds`
  'const holds = dist <= ringFloorFor(state.fighters.length, state.timeRemaining);',
  // the alarm threshold
  'return Math.min(12_000, FAIR_PLAY.radiusUnits / shrinkPerMs);',
  // the three strings the pill can show in the non-danger branch
  "zoneLabelEl.textContent = 'ZONE CLOSES';",
  "? `REACHES YOU ${formatTime(info.msUntilEdge)}`",
  "? 'FINAL RING'",
  // ⚠️ `Math.ceil`, NOT floor. The first draft of this tool used floor and every printed
  // pill string was ONE SECOND SHORT of what the game actually shows — i.e. it UNDER-stated
  // the size of the countdown's over-promise. Pinned so it cannot drift back.
  'const totalSec = Math.max(0, Math.ceil(ms / 1000));',
];
function hudPinsPresent(src = HUD_SRC) { return HUD_PINS.filter((p) => !src.includes(p)); }

const shrinkPerMs = ARENA.maxSafeRadius / MATCH_DURATION_MS;   // wu of radius per ms
const imminentMs = Math.min(12_000, FAIR_RADIUS_UNITS / shrinkPerMs);

/** `ui/hud.ts:formatTime` — m:ss, and it CEILS. Restated for the same reason as above. */
function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** What the zone pill reads for a fighter at `dist` from the centre, given the sim state. */
function pill(dist, safeRadius, timeRemaining, seats) {
  if (suddenDeathActive(timeRemaining)) return { label: 'SUDDEN DEATH', value: 'MOST HP WINS', msUntilEdge: null, imminent: false };
  const outside = dist > safeRadius;
  if (outside) return { label: '▲ OUTSIDE THE ZONE', value: `-${Math.round((FOG_DAMAGE / FOG_TICK_MS) * 1000)} HP/s`, msUntilEdge: null, imminent: false };
  const holds = dist <= ringFloorFor(seats, timeRemaining);
  const msUntilEdge = holds ? null : (safeRadius - dist) / shrinkPerMs;
  return {
    label: 'ZONE CLOSES',
    value: msUntilEdge !== null ? `REACHES YOU ${formatTime(msUntilEdge)}` : 'FINAL RING',
    msUntilEdge,
    imminent: msUntilEdge !== null && msUntilEdge < imminentMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The corpus — sd_lab's census loop, with the crossing tick instrumented
// ─────────────────────────────────────────────────────────────────────────────

const driverFor = (arena) => createScriptedPlayer({
  CHARACTERS: RULES.CHARACTERS,
  REACH: RULES.REACH,
  arena,
  pressValue: ai.pressValue,
  selfHealHpFraction: AI_SELF_HEAL_HP_FRACTION,
  ...DRIVER_FLAGS,
});

const MATCHUPS = (() => {
  const out = [];
  for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) out.push([a, b]);
  return out;
})();

/**
 * One match. Returns the state that goes INTO the crossing step — never the state after
 * it, which is post-fog and post-death (sd_lab's census documents that exact error costing
 * it 3.5 pp on the identical corpus).
 */
function runOne(p, e, policy, seed) {
  const rnd = rng(seed * 7919 + p.length * 131 + e.length * 17 + policy.length);
  const st = sim.createMatch(ARENA, p, e);
  const driver = driverFor(ARENA);
  const loop = driver.createDecisionLoop({ decide: driver.POLICY_FNS[policy](rnd), reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
  const cap = Math.ceil((MATCH_DURATION_MS * 1.6 + 20000) / DT);
  let atTrigger = null;
  let t = 0;
  let lastAlive = null;
  while (st.phase !== 'ended' && t < cap) {
    const before = {
      safeRadius: st.safeRadius,
      timeRemaining: st.timeRemaining,
      seats: st.fighters.length,
      f: st.fighters.map((f) => ({
        id: f.id, hp: f.hp, alive: f.alive,
        d: Math.hypot(f.x - ARENA.center.x, f.y - ARENA.center.y),
      })),
    };
    if (before.f.some((f) => f.alive)) lastAlive = before;
    sim.stepMatch(st, DT, loop.next(st, DT));
    t++;
    if (atTrigger === null && st.timeRemaining <= SUDDEN_DEATH_REMAINING_MS) atTrigger = before;
  }
  return {
    p, e, policy, seed,
    atTrigger,
    lastAlive,
    endPlayMs: MATCH_DURATION_MS - st.timeRemaining,
    ended: st.phase === 'ended',
  };
}

function quantiles(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (f) => s[Math.min(s.length - 1, Math.max(0, Math.floor(f * s.length)))];
  return { min: s[0], p25: q(0.25), med: q(0.5), p75: q(0.75), max: s[s.length - 1] };
}
const f1 = (v) => (v === undefined ? '—' : v.toFixed(1));

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : known inputs and known-BAD inputs
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  console.log('fgc_sd --selftest\n');
  console.log('A. THE ARITHMETIC, against hand-computed values');

  const R30 = ARENA.maxSafeRadius * (1 - SUDDEN_DEATH_MS / MATCH_DURATION_MS);
  ok('the scheduled ring at the 30 s trigger is 661.67 wu', Math.abs(R30 - 661.6667) < 0.01, `${R30.toFixed(4)}`);
  ok('the ring sweeps 44.11 wu/s', Math.abs(shrinkPerMs * 1000 - 44.111) < 0.01, `${(shrinkPerMs * 1000).toFixed(3)} wu/s`);
  ok('the fog burns 50 HP/s', (FOG_DAMAGE / FOG_TICK_MS) * 1000 === 50, `${(FOG_DAMAGE / FOG_TICK_MS) * 1000}`);
  ok('`imminentMs` on this map is 4515.9 ms, NOT the 12 s cap and NOT hud.ts\'s documented 9.0 s',
    Math.abs(imminentMs - 4515.87) < 0.1, `${imminentMs.toFixed(2)} ms`);
  ok('`suddenDeathActive` is FALSE one ms above the boundary and TRUE on it',
    !suddenDeathActive(SUDDEN_DEATH_REMAINING_MS + 1) && suddenDeathActive(SUDDEN_DEATH_REMAINING_MS));
  ok('`ringFloorFor(2, t)` is 140 before the collapse and 0 after — the `holds` cliff',
    ringFloorFor(2, SUDDEN_DEATH_REMAINING_MS + 1) === 140 && ringFloorFor(2, SUDDEN_DEATH_REMAINING_MS) === 0,
    `${ringFloorFor(2, SUDDEN_DEATH_REMAINING_MS + 1)} / ${ringFloorFor(2, SUDDEN_DEATH_REMAINING_MS)}`);

  // The pill, at three hand-checkable distances one tick BEFORE the collapse.
  const tr = SUDDEN_DEATH_REMAINING_MS + 1;
  const a = pill(140, R30, tr, 2);
  const b = pill(300, R30, tr, 2);
  const c = pill(600, R30, tr, 2);
  ok('at d=140 wu the pill reads FINAL RING — "the edge is never going to arrive"',
    a.value === 'FINAL RING', `${a.label} / ${a.value}`);
  ok('at d=300 wu the pill counts down 8199 ms -> "REACHES YOU 0:09" (hud.ts CEILS)',
    Math.abs(b.msUntilEdge - 8199.4) < 1 && b.value === 'REACHES YOU 0:09', `${b.msUntilEdge?.toFixed(1)} / ${b.value}`);
  ok('KNOWN-BAD: a FLOOR-based formatTime would print 0:08 — one second short of the shipped pill',
    `0:${String(Math.floor(b.msUntilEdge / 1000)).padStart(2, '0')}` === '0:08');
  ok('at d=300 wu the imminent ALARM is OFF (8199 > 4516)', b.imminent === false);
  ok('at d=600 wu the alarm is ON (1398 < 4516)', c.imminent === true, `${c.msUntilEdge?.toFixed(0)} ms`);
  const dAlarm = R30 - FAIR_RADIUS_UNITS;
  ok('the alarm cannot fire inside d = 462.47 wu — half the safe disc by area',
    Math.abs(dAlarm - 462.467) < 0.01 && pill(dAlarm - 1, R30, tr, 2).imminent === false, `${dAlarm.toFixed(3)} wu`);

  console.log('\nB. KNOWN-BAD INPUTS — every guard must FAIL on the thing it guards against');
  ok('the hud.ts pin set is non-empty (a guard over an empty list is `[].every()` = true)',
    HUD_PINS.length >= 6, `${HUD_PINS.length} pins`);
  ok('all pins are present in the SHIPPED hud.ts', hudPinsPresent().length === 0, hudPinsPresent().join(' | '));
  ok('KNOWN-BAD: the pin guard FAILS on a hud.ts with the countdown expression removed',
    hudPinsPresent(HUD_SRC.replace(HUD_PINS[0], 'null')).length === 1);
  ok('KNOWN-BAD: the pin guard FAILS on an EMPTY hud.ts (all six missing)',
    hudPinsPresent('').length === HUD_PINS.length);
  ok('KNOWN-BAD: a pill built on a ring that has NOT collapsed does not read SUDDEN DEATH',
    pill(300, R30, tr, 2).label === 'ZONE CLOSES' && pill(300, 0, SUDDEN_DEATH_REMAINING_MS, 2).label === 'SUDDEN DEATH');
  ok('KNOWN-BAD: a fighter OUTSIDE the ring gets the danger copy, not a countdown',
    pill(700, R30, tr, 2).msUntilEdge === null && pill(700, R30, tr, 2).label.includes('OUTSIDE'));

  // A real match, pinned: the crossing tick must carry the scheduled radius, not the
  // collapsed one, and must be exactly one tick above the boundary.
  const one = runOne('egg', 'pizza', 'smart2', 0);
  ok('the CONTROL match reaches the trigger at all (a distribution over an empty set is vacuous)',
    one.atTrigger !== null, `ended at ${(one.endPlayMs / 1000).toFixed(2)} s`);
  if (one.atTrigger) {
    ok('the sampled state is the one going INTO the crossing step — ring still scheduled, not 0',
      Math.abs(one.atTrigger.safeRadius - R30) < 1.0, `${one.atTrigger.safeRadius.toFixed(3)} vs ${R30.toFixed(3)}`);
    ok('…and its clock is strictly above the boundary (so it is PRE-collapse)',
      one.atTrigger.timeRemaining > SUDDEN_DEATH_REMAINING_MS
      && one.atTrigger.timeRemaining <= SUDDEN_DEATH_REMAINING_MS + DT,
      `${one.atTrigger.timeRemaining.toFixed(3)} ms`);
    ok('…and every fighter is INSIDE the ring on it (else this is not the surprise case)',
      one.atTrigger.f.every((f) => f.d <= one.atTrigger.safeRadius),
      one.atTrigger.f.map((f) => f.d.toFixed(1)).join(' / '));
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// the run
// ─────────────────────────────────────────────────────────────────────────────

const missing = hudPinsPresent();
if (missing.length) {
  console.log('REFUSING TO PRINT HUD NUMBERS — src/ui/hud.ts no longer contains:');
  for (const m of missing) console.log(`   ${m}`);
  process.exit(1);
}

const R30 = ARENA.maxSafeRadius * (1 - SUDDEN_DEATH_MS / MATCH_DURATION_MS);
console.log('fgc_sd — the sudden-death collapse, from the fighter\'s point of view\n');
console.log(`  arena ${ARENA.width}x${ARENA.height} centre (${ARENA.center.x},${ARENA.center.y}) maxSafeRadius ${ARENA.maxSafeRadius}`);
console.log(`  trigger ${SUDDEN_DEATH_MS / 1000} s of a ${MATCH_DURATION_MS / 1000} s clock · ring at the trigger ${R30.toFixed(2)} wu -> 0 in ONE tick`);
console.log(`  fog ${(FOG_DAMAGE / FOG_TICK_MS) * 1000} HP/s · camera shows ${SEE_WU_16_9} wu (16:9) / ${SEE_WU_4_3} wu (4:3) of ground in every direction`);
console.log(`  corpus ${MATCHUPS.length} matchups x ${SEEDS} seeds x ${POLICIES.length} policy = ${MATCHUPS.length * SEEDS * POLICIES.length} matches\n`);

const rows = [];
for (const policy of POLICIES) {
  for (let seed = 0; seed < SEEDS; seed++) {
    for (const [p, e] of MATCHUPS) rows.push(runOne(p, e, policy, seed));
  }
}

const reached = rows.filter((r) => r.atTrigger !== null);
// ⚠️ NON-EMPTY FIRST. Every statistic below is computed over a FILTERED set, and
// `[].every()` / an empty quantile list would report a clean pass on no data at all.
if (reached.length === 0) {
  console.log('  *** NO MATCH REACHED THE TRIGGER — every figure below would be vacuous. Stopping. ***');
  process.exit(1);
}

const rate = reached.length / rows.length;
const perMatchup = new Map();
for (const r of rows) {
  const k = `${r.p}>${r.e}`;
  const cur = perMatchup.get(k) ?? { n: 0, hit: 0 };
  cur.n++; if (r.atTrigger) cur.hit++;
  perMatchup.set(k, cur);
}
const matchupsEverReaching = [...perMatchup.values()].filter((v) => v.hit > 0).length;
// The independent unit is the MATCHUP (seeds re-run the same 110), so the interval is
// binomial on 110, not on `rows.length`. Stated rather than implied.
const seBase = MATCHUPS.length;
const se = Math.sqrt((rate * (1 - rate)) / seBase) * 100;

console.log('── 1. HOW OFTEN DOES A 1v1 REACH SUDDEN DEATH? ────────────────────────────');
console.log(`  reached the trigger    ${reached.length} / ${rows.length}  =  ${(rate * 100).toFixed(2)}%`);
console.log(`  distinct matchups that ever reached it: ${matchupsEverReaching} of ${MATCHUPS.length}`);
console.log(`  binomial SE on the ${seBase} INDEPENDENT matchups: +-${se.toFixed(2)} pp  =>  resolution floor ~${(2 * se).toFixed(1)} pp`);
console.log('  ⚠️ LOWER BOUND ONLY. The driver has perfect aim and kills faster than a human.');
console.log('     It cannot be degraded into a human proxy: slowing it down makes matches SHORTER,');
console.log('     because a passive fighter is killed by the ORDINARY fog at its spawn.\n');

const gaps = [];
const dists = [];
const offscreen16 = [];
const offscreen43 = [];
const pills = new Map();
const alarms = [];
const promisedMs = [];
const hps = [];
let localSeatSamples = 0;
for (const r of reached) {
  const st = r.atTrigger;
  for (const f of st.f) {
    if (!f.alive) continue;
    const gap = st.safeRadius - f.d;
    gaps.push(gap);
    dists.push(f.d);
    hps.push(f.hp);
    offscreen16.push(gap > SEE_WU_16_9);
    offscreen43.push(gap > SEE_WU_4_3);
    const pl = pill(f.d, st.safeRadius, st.timeRemaining, st.seats);
    pills.set(pl.value, (pills.get(pl.value) ?? 0) + 1);
    alarms.push(pl.imminent);
    if (pl.msUntilEdge !== null) promisedMs.push(pl.msUntilEdge);
    localSeatSamples++;
  }
}
const qg = quantiles(gaps);
const qd = quantiles(dists);

console.log('── 2. WHERE IS THE FIGHTER WHEN IT FIRES? ─────────────────────────────────');
console.log(`  n = ${localSeatSamples} living fighters across ${reached.length} matches (2 seats each)`);
console.log(`  distance from the arena CENTRE      min ${f1(qd.min)}  p25 ${f1(qd.p25)}  MED ${f1(qd.med)}  p75 ${f1(qd.p75)}  max ${f1(qd.max)} wu`);
console.log(`  SURPRISE DISTANCE (ring - fighter)  min ${f1(qg.min)}  p25 ${f1(qg.p25)}  MED ${f1(qg.med)}  p75 ${f1(qg.p75)}  max ${f1(qg.max)} wu`);
console.log(`  boundary OFF SCREEN at 16:9 (gap > ${SEE_WU_16_9} wu): ${offscreen16.filter(Boolean).length}/${offscreen16.length}`
  + `  ·  at 4:3 (> ${SEE_WU_4_3} wu): ${offscreen43.filter(Boolean).length}/${offscreen43.length}`);
console.log(`  time the fog would have needed to ARRIVE at the median fighter, had the ring kept closing:`
  + `  ${(qg.med / shrinkPerMs / 1000).toFixed(1)} s\n`);

console.log('── 3. WHAT DOES THE HUD SAY ONE TICK BEFORE? ──────────────────────────────');
for (const [v, n] of [...pills.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  "${v}"`);
}
// ⚠️ NON-EMPTY BEFORE THE QUANTILE. `quantiles([])` returns undefineds that print as "—"
// and read exactly like a measured result.
if (promisedMs.length === 0) { console.log('  *** no fighter got a countdown at all — the rest of this section is vacuous ***'); process.exit(1); }
const qp = quantiles(promisedMs);
const qh = quantiles(hps);
console.log(`  GRACE THE PILL PROMISED (ms)        min ${f1(qp.min)}  p25 ${f1(qp.p25)}  MED ${f1(qp.med)}  p75 ${f1(qp.p75)}  max ${f1(qp.max)}`);
console.log(`  GRACE ACTUALLY DELIVERED            0 ms in every one of the ${promisedMs.length} cases — the fog is on them on the SAME tick`);
console.log(`  imminent ALARM (pill pulsing) was ON for ${alarms.filter(Boolean).length}/${alarms.length}`);
console.log(`  HP at the trigger                   min ${f1(qh.min)}  p25 ${f1(qh.p25)}  MED ${f1(qh.med)}  p75 ${f1(qh.p75)}  max ${f1(qh.max)}`);
console.log(`  => the median fighter has ${(qh.med / ((FOG_DAMAGE / FOG_TICK_MS) * 1000)).toFixed(2)} s of life left at 50 HP/s`);
console.log(`  alarm threshold: msUntilEdge < ${imminentMs.toFixed(0)} ms, i.e. only when the boundary is`);
console.log(`  within ${FAIR_RADIUS_UNITS} wu — so it CANNOT fire for anyone inside ${(R30 - FAIR_RADIUS_UNITS).toFixed(2)} wu of the centre,`);
console.log(`  which is ${(((R30 - FAIR_RADIUS_UNITS) / R30) ** 2 * 100).toFixed(1)}% of the safe disc BY AREA.\n`);

console.log('── the sharpest cases ─────────────────────────────────────────────────────');
const sharpest = reached
  .flatMap((r) => r.atTrigger.f.filter((f) => f.alive).map((f) => ({ r, f, gap: r.atTrigger.safeRadius - f.d })))
  .sort((a, b) => b.gap - a.gap)
  .slice(0, 8);
for (const s of sharpest) {
  const pl = pill(s.f.d, s.r.atTrigger.safeRadius, s.r.atTrigger.timeRemaining, s.r.atTrigger.seats);
  console.log(`  ${(s.r.p + '>' + s.r.e).padEnd(24)} seed ${s.r.seed}  d ${s.f.d.toFixed(0).padStart(4)} wu  gap ${s.gap.toFixed(0).padStart(4)} wu`
    + `  hp ${String(s.f.hp).padStart(3)}  pill "${pl.value}"  -> 50 HP/s NOW`);
}
console.log('');
