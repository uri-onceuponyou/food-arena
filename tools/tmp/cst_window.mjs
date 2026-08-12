#!/usr/bin/env node
/**
 * cst_window — THE COUNTERPLAY WINDOW, COMPUTED. Offline, no browser, no snapshot.
 *
 * `docs/AGENT-BRIEF.md` §4.5 and CLAUDE.md #10: state a metric's floor before acting on
 * it. This tool exists because the cast-system design turns on ONE arithmetic question —
 * *"can the target actually leave the effect during the wind-up?"* — and that question has
 * a number, not an opinion. Everything printed here is derived from `src/game/rules.ts`
 * and `src/game/state.ts` at run time; nothing is retyped (CLAUDE.md: "Derive from
 * `shared.ts`. Never retype a coordinate." — same rule, different file).
 *
 * It also re-derives every falsifiable claim the dispatch brief made, because
 * "CONTRADICTING THE BRIEF IS THE JOB".
 *
 * Usage:  node tools/tmp/cst_window.mjs [--selftest]
 *
 * ⚠️ `--selftest` VALIDATES THIS TOOL'S LOGIC, NOT WHERE IT IS POINTED (CLAUDE.md #6).
 * The known-bad it plants is a caster speed EQUAL to the target's, which must drive the
 * escape window to exactly zero for every T; if the window stays positive the escape
 * model has stopped reading `casterSpeed` and the whole table is decoration.
 */

import {
  CHARACTERS, CHARACTER_IDS, REACH, PLAYER_SPEED, AI_CHASE_SPEED, AI_FLEE_SPEED,
  AI_SLOW_MULTIPLIER, SLOW_MOVE_MULTIPLIER, PLAYER_MAX_HP, ENEMY_MAX_HP,
  FOG_DAMAGE, FOG_TICK_MS, SUDDEN_DEATH_MS, SUDDEN_DEATH_GRACE_MS, FOG_CLOSE_MS,
  MATCH_DURATION_MS, STUN_DURATION_MS, SLOW_DURATION_MS, HIT_RADIUS_VS_PLAYER,
  speedFor, maxHpFor, speedMultiplier,
} from '../../src/game/rules.ts';

const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--selftest');

const f2 = (n) => n.toFixed(2);

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE SPEED TABLE — measured off the roster, not off PLAYER_SPEED alone.
// ─────────────────────────────────────────────────────────────────────────────
// `speedFor` scales the base by the card's `speed` stat, so "120 vs 70" is the CAP
// pair, not the roster pair. The binding numbers for a dodge are the SLOWEST target
// and the FASTEST caster.

const rows = CHARACTER_IDS.map((id) => {
  const c = CHARACTERS[id];
  return {
    id,
    speedStat: c.stats.speed,
    healthStat: c.stats.health,
    human: speedFor(id, PLAYER_SPEED) * 1000,          // wu/s
    aiChase: speedFor(id, AI_CHASE_SPEED) * 1000,
    aiFlee: speedFor(id, AI_FLEE_SPEED) * 1000,
    humanSlowed: speedFor(id, PLAYER_SPEED) * 1000 * SLOW_MOVE_MULTIPLIER,
    aiChaseSlowed: speedFor(id, AI_CHASE_SPEED) * 1000 * AI_SLOW_MULTIPLIER,
    hpPlayerSeat: maxHpFor(id, PLAYER_MAX_HP),
    hpEnemySeat: maxHpFor(id, ENEMY_MAX_HP),
  };
});

const slowestHuman = rows.reduce((a, b) => (b.human < a.human ? b : a));
const fastestHuman = rows.reduce((a, b) => (b.human > a.human ? b : a));
const fastestAiChase = rows.reduce((a, b) => (b.aiChase > a.aiChase ? b : a));
const slowestAiChase = rows.reduce((a, b) => (b.aiChase < a.aiChase ? b : a));

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE SIX ULTIMATES, READ OFF THE TREE.
// ─────────────────────────────────────────────────────────────────────────────
// The audit's "5 Special: + lollipop.Giant". Derived by scanning `abilities[]` for the
// literal prefix and by scanning `weapons[]` for `giantSlam`, so it cannot go stale
// against a hand-typed list of six names.

const specials = [];
for (const id of CHARACTER_IDS) {
  const def = CHARACTERS[id];
  for (const a of def.abilities) {
    if (!a.desc.startsWith('Special:')) continue;
    const w = def.weapons.find((x) => x.key === a.weapon);
    specials.push({ id, ability: a.name, key: a.weapon, w, label: 'Special:' });
  }
  for (const w of def.weapons) {
    if (!w.giantSlam) continue;
    if (specials.some((s) => s.id === id && s.key === w.key)) continue;
    const a = def.abilities.find((x) => x.weapon === w.key);
    specials.push({ id, ability: a ? a.name : '(none)', key: w.key, w, label: 'giantSlam (UNLABELLED)' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE ESCAPE MODEL.
// ─────────────────────────────────────────────────────────────────────────────
// A melee ultimate resolves at ONE instant against `dist <= w.range` measured from the
// CASTER (`combat.ts:attemptAttack` — melee takes no `hitRadius` term; only projectiles
// do). So the target escapes iff, at the resolve instant,
//
//     separation(0) + (targetSpeed - casterSpeed) * T  >  range
//
// where `casterSpeed` is 0 if the cast roots the caster and its normal speed if not.
// `needWu` is what the target must GAIN, i.e. the worst case is a target starting at
// separation 0 (the AI closes to literally 0 — `combat.ts` records 1,582 of 160,642
// ticks at exactly 0).
//
// ⚠️ This is the OPTIMAL-PLAY window: it assumes the target moves directly away from
// the resolve point for the whole cast. It is an UPPER BOUND on escapability, so a T
// that fails here fails for everyone.

function escapeWindow({ rangeWu, T_ms, targetSpeed, casterSpeed, startSep = 0 }) {
  const closingRate = targetSpeed - casterSpeed;       // wu/s, +ve = target gains ground
  const gained = (closingRate * T_ms) / 1000;
  const finalSep = startSep + gained;
  return {
    gainedWu: gained,
    finalSep,
    escapes: finalSep > rangeWu,
    // The T at which the target exactly reaches the edge from `startSep`.
    tToEscapeMs: closingRate > 0 ? ((rangeWu - startSep) / closingRate) * 1000 : Infinity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the known-bad. CLAUDE.md #6: a guard not shown to FAIL is not a guard.
// ─────────────────────────────────────────────────────────────────────────────
if (SELFTEST) {
  let ok = 0, bad = 0;
  const say = (name, pass, detail) => {
    (pass ? ok++ : bad++);
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  // ⚠️ NON-EMPTY FIRST. `[].every()` returns true and that trap fired three times in
  // three files in one session. Assert the set has members BEFORE asserting over it.
  say('the special set is NON-EMPTY (guards the vacuous pass)', specials.length > 0,
    `${specials.length} specials`);
  say('exactly six ultimates', specials.length === 6, specials.map((s) => `${s.id}.${s.key}`).join(' '));
  say('the speed table is NON-EMPTY', rows.length === 11, `${rows.length} characters`);

  // KNOWN-BAD 1: caster speed == target speed. A correct model returns a ZERO window at
  // every T. A model that has stopped reading `casterSpeed` returns a positive one.
  const kb1 = escapeWindow({ rangeWu: REACH.meleeHeavy, T_ms: 100000, targetSpeed: 120, casterSpeed: 120 });
  say('KNOWN-BAD caster==target gives ZERO gain even at T=100 s', kb1.gainedWu === 0 && !kb1.escapes,
    `gained ${f2(kb1.gainedWu)} wu, escapes=${kb1.escapes}`);

  // KNOWN-BAD 2: a caster FASTER than the target must give a NEGATIVE window — the
  // telegraph is unescapable by construction, which is the exact failure mode Uri's
  // "a telegraph you can dodge" forbids. A model that clamps at zero would hide it.
  const kb2 = escapeWindow({ rangeWu: REACH.meleeHeavy, T_ms: 1000, targetSpeed: 70, casterSpeed: 120 });
  say('KNOWN-BAD caster faster than target gives NEGATIVE gain', kb2.gainedWu < 0 && !kb2.escapes,
    `gained ${f2(kb2.gainedWu)} wu`);

  // KNOWN-BAD 3: T=0 (the SHIPPED wind-up) must never escape from separation 0.
  const kb3 = escapeWindow({ rangeWu: REACH.meleeHeavy, T_ms: 0, targetSpeed: 120, casterSpeed: 0 });
  say('KNOWN-BAD T=0 (today) escapes NOTHING', !kb3.escapes && kb3.gainedWu === 0);

  // POSITIVE CONTROL: the model must be able to say YES, or every FAIL above is vacuous.
  const pos = escapeWindow({ rangeWu: REACH.meleeHeavy, T_ms: 1000, targetSpeed: 120, casterSpeed: 0 });
  say('POSITIVE CONTROL rooted caster, 1000 ms, 120 wu/s target ESCAPES 84 wu', pos.escapes,
    `gained ${f2(pos.gainedWu)} wu`);

  console.log(`\n  ${ok} passed, ${bad} failed`);
  process.exit(bad === 0 ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log('── SPEEDS, wu/s, derived via speedFor() (NOT the PLAYER_SPEED cap alone) ──');
console.log('  id            spd  human  aiChase  aiFlee  humanSlow  aiChaseSlow');
for (const r of rows) {
  console.log(`  ${r.id.padEnd(12)} ${String(r.speedStat).padStart(3)} ${f2(r.human).padStart(6)} ${f2(r.aiChase).padStart(8)} ${f2(r.aiFlee).padStart(7)} ${f2(r.humanSlowed).padStart(10)} ${f2(r.aiChaseSlowed).padStart(12)}`);
}
console.log(`\n  CAP PAIR              human ${f2(PLAYER_SPEED * 1000)} vs aiChase ${f2(AI_CHASE_SPEED * 1000)}  = ${f2(PLAYER_SPEED / AI_CHASE_SPEED)}x`);
console.log(`  SLOWEST human         ${slowestHuman.id} ${f2(slowestHuman.human)}   FASTEST human ${fastestHuman.id} ${f2(fastestHuman.human)}`);
console.log(`  SLOWEST aiChase       ${slowestAiChase.id} ${f2(slowestAiChase.aiChase)}   FASTEST aiChase ${fastestAiChase.id} ${f2(fastestAiChase.aiChase)}`);
console.log(`  WORST CASE for a dodge: slowest human (${slowestHuman.id}, ${f2(slowestHuman.human)}) fleeing the fastest AI caster (${fastestAiChase.id}, ${f2(fastestAiChase.aiChase)})`);

console.log('\n── THE SIX ULTIMATES, read off CHARACTERS[] ──');
console.log('  character.key            type    range  dmg  cd(ms)  cone  effect   label');
for (const s of specials) {
  const w = s.w;
  console.log(`  ${(s.id + '.' + s.key).padEnd(22)} ${w.type.padEnd(7)} ${String(w.range ?? '-').padStart(5)} ${String(w.damage).padStart(4)} ${String(w.cooldown).padStart(7)} ${String(w.cone ?? '-').padStart(5)}  ${String(w.effect).padEnd(7)} ${s.label}`);
}

console.log('\n── ESCAPE WINDOW, melee ultimates, target starting at separation 0 ──');
console.log('   (escape = target must gain more than `range` wu before the cast resolves)');
const meleeUlts = specials.filter((s) => s.w.type === 'melee');
const Ts = [300, 500, 700, 900, 1200, 1500, 2000];
for (const s of meleeUlts) {
  const rangeWu = s.w.range ?? 0;
  console.log(`\n  ${s.id}.${s.key}  range ${rangeWu} wu, cone ${s.w.cone}`);
  console.log('    T(ms)  | ROOTED caster: gain(wu) esc? | MOBILE caster (aiChase): gain esc? | MOBILE vs human caster');
  for (const T of Ts) {
    // Arm A: the caster is rooted for the cast, target is a HUMAN at its own speed.
    const tgt = slowestHuman.human;      // worst case for the dodge
    const a = escapeWindow({ rangeWu, T_ms: T, targetSpeed: tgt, casterSpeed: 0 });
    // Arm B: the caster keeps chasing at AI chase speed while casting.
    const b = escapeWindow({ rangeWu, T_ms: T, targetSpeed: tgt, casterSpeed: fastestAiChase.aiChase });
    // Arm C: a HUMAN caster keeps chasing at human speed, target is an AI at chase speed.
    const c = escapeWindow({ rangeWu, T_ms: T, targetSpeed: slowestAiChase.aiChase, casterSpeed: fastestHuman.human });
    console.log(`    ${String(T).padStart(5)}  | ${f2(a.gainedWu).padStart(8)} ${a.escapes ? 'YES' : 'no '}        | ${f2(b.gainedWu).padStart(8)} ${b.escapes ? 'YES' : 'no '}                  | ${f2(c.gainedWu).padStart(8)} ${c.escapes ? 'YES' : 'no '}`);
  }
  const tRoot = escapeWindow({ rangeWu, T_ms: 0, targetSpeed: slowestHuman.human, casterSpeed: 0 }).tToEscapeMs;
  const tMob = escapeWindow({ rangeWu, T_ms: 0, targetSpeed: slowestHuman.human, casterSpeed: fastestAiChase.aiChase }).tToEscapeMs;
  const tFast = escapeWindow({ rangeWu, T_ms: 0, targetSpeed: fastestHuman.human, casterSpeed: 0 }).tToEscapeMs;
  console.log(`    MINIMUM T to clear ${rangeWu} wu from separation 0, ROOTED caster:  fastest human ${f2(tFast)} ms · slowest human ${f2(tRoot)} ms   (mobile caster: ${f2(tMob)} ms)`);
  // ── 🚨 A SLOWED TARGET CANNOT DODGE, AND `Mega` APPLIES `slow` ITSELF ──────
  //
  // Every duration this table recommends is computed on a target at FULL speed. A target
  // already carrying `slow` moves at `SLOW_MOVE_MULTIPLIER` (0.45) of it, and its escape
  // time scales by 1/0.45 = 2.22x. That is not a hypothetical: Water Bottle's own Water
  // Spray is authored `effect: 'slow'` and its card says *"slows enemies down a lot"*, so
  // Spray-then-Mega is a two-press combo that removes the counterplay this whole design
  // exists to create. Whether that is a COMBO (good) or a HOLE (bad) is Uri's call — but
  // it has to be a call, not an accident, so the number is printed.
  //
  // ⚠️ AND THE SLOW IS ASYMMETRIC: a slowed HUMAN keeps 0.45 (`SLOW_MOVE_MULTIPLIER`), a
  // slowed AI keeps 0.35 (`AI_SLOW_MULTIPLIER`) — two separately authored constants for
  // one word. So the same telegraph is 1.29x less escapable for a bot than for a human.
  const slowFast = escapeWindow({ rangeWu, T_ms: 0, targetSpeed: fastestHuman.humanSlowed, casterSpeed: 0 }).tToEscapeMs;
  const slowSlow = escapeWindow({ rangeWu, T_ms: 0, targetSpeed: slowestHuman.humanSlowed, casterSpeed: 0 }).tToEscapeMs;
  const slowAi = escapeWindow({ rangeWu, T_ms: 0, targetSpeed: slowestAiChase.aiChaseSlowed, casterSpeed: 0 }).tToEscapeMs;
  console.log(`    ... if the target is ALREADY SLOWED:  fastest human ${f2(slowFast)} ms · slowest human ${f2(slowSlow)} ms · slowest AI ${f2(slowAi)} ms`);
}

console.log('\n── SUDDEN DEATH: what a cast costs when the fog is burning ──');
const dps = (FOG_DAMAGE / FOG_TICK_MS) * 1000;
const pools = rows.flatMap((r) => [r.hpPlayerSeat, r.hpEnemySeat]);
const maxPool = Math.max(...pools);
const minPool = Math.min(...pools);
console.log(`  fog: ${FOG_DAMAGE} dmg / ${FOG_TICK_MS} ms = ${f2(dps)} HP/s`);
console.log(`  sudden death begins at play-ms ${SUDDEN_DEATH_MS} (FOG_CLOSE_MS ${FOG_CLOSE_MS} + grace ${SUDDEN_DEATH_GRACE_MS}); clock ends at ${MATCH_DURATION_MS}`);
console.log(`  biggest pool in the roster ${maxPool} HP -> dead in ${f2(maxPool / dps)} s  (${Math.ceil(maxPool / FOG_DAMAGE)} fog ticks)`);
console.log(`  smallest pool ${minPool} HP -> dead in ${f2(minPool / dps)} s`);
for (const T of [500, 900, 1500, 2000]) {
  console.log(`    a ${T} ms cast in sudden death costs ${f2((dps * T) / 1000)} HP = ${f2(((dps * T) / 1000) / maxPool * 100)}%–${f2(((dps * T) / 1000) / minPool * 100)}% of a pool`);
}

console.log('\n── THE STATUS VOCABULARY, read off the tree ──');
const effects = new Set();
for (const id of CHARACTER_IDS) for (const w of CHARACTERS[id].weapons) effects.add(String(w.effect));
console.log(`  distinct authored \`effect\` values: ${[...effects].sort().join(', ')}`);
const counts = { slow: 0, stun: 0, null: 0 };
for (const id of CHARACTER_IDS) for (const w of CHARACTERS[id].weapons) counts[String(w.effect)]++;
console.log(`  slow ${counts.slow} · stun ${counts.stun} · null ${counts.null}  (total ${counts.slow + counts.stun + counts.null} weapons)`);
console.log(`  STUN_DURATION_MS ${STUN_DURATION_MS} · SLOW_DURATION_MS ${SLOW_DURATION_MS} · SLOW_MOVE_MULTIPLIER ${SLOW_MOVE_MULTIPLIER} · AI_SLOW_MULTIPLIER ${AI_SLOW_MULTIPLIER}`);
console.log(`  HIT_RADIUS_VS_PLAYER ${HIT_RADIUS_VS_PLAYER}  (projectiles only; melee resolves on \`range\` alone)`);
console.log(`  speedMultiplier spread: ${f2(Math.min(...CHARACTER_IDS.map(speedMultiplier)))}..${f2(Math.max(...CHARACTER_IDS.map(speedMultiplier)))}`);
