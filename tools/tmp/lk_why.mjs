#!/usr/bin/env node
/**
 * LK_WHY — for every matchup that CONTAINS a wind-up but came out BIT-IDENTICAL across the
 * lockout arms, say why.
 *
 * ── WHY THIS IS NEEDED ──────────────────────────────────────────────────────
 *
 * `tools/tmp/csx_bitid.mjs`'s FEATURE arm asserts *"BIT-IDENTICAL must be 0, or the feature
 * never fired"*. That calibration is correct for the question it was built for — **cast
 * system vs no cast system**, where every matchup containing the weapon must move. It is
 * the right answer read wrong for `DECISIONS §78`, which changes what a caster may do
 * DURING a wind-up: a matchup where nobody ever opens one, or where the caster's other
 * slots are all on cooldown for the whole window, is **correctly** identical and is not
 * evidence that anything failed to stage.
 *
 * 🚨 **BUT "CORRECTLY IDENTICAL" IS ALSO EXACTLY WHAT A PATCH THAT DID NOT LAND LOOKS
 * LIKE** (`AGENT-BRIEF` §3), so the explanation has to be MEASURED rather than assumed.
 * This tool runs the BASELINE arm alone and counts, per matchup and seed:
 *
 *   castsOpened     `cast-started` events — 0 means there was nothing to change
 *   pressableTicks  ticks during a wind-up on which at least one OTHER slot was off
 *                   cooldown — 0 means the lockout had nothing to refuse
 *
 * A bit-identical cast matchup is explained iff one of those is 0. Any that is not is a
 * real finding and this exits 1.
 *
 *   node tools/tmp/lk_why.mjs --selftest
 *   node tools/tmp/lk_why.mjs --ref /tmp/fa-lk-base/src/game --sim /tmp/fa-lk-feat/src/game --seeds 8
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
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const REF_DIR = String(args.ref ?? SIM_DIR);

const A = { ...(await import(`${REF_DIR}/sim.ts`)), RULES: await import(`${REF_DIR}/rules.ts`) };
const B = { ...(await import(`${SIM_DIR}/sim.ts`)), RULES: await import(`${SIM_DIR}/rules.ts`) };
const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS } = B.RULES;

const CAST_CHARS = new Set(
  CHARACTER_IDS.filter((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0)),
);

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
const openingRadius = B.RULES.fogOpeningRadiusFor(Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2));
const arena = { ...ARENA_DATA, maxSafeRadius: openingRadius, build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICY = String(args.policy ?? 'smart2');
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...parseDriverFlags(args) });

/** The same serialisation `csx_bitid` uses, `cast` included — see its header. */
const fighterOf = (f) => [
  f.id, f.hp, f.maxHp, f.x, f.y, f.facing.x, f.facing.y, f.deaths, f.alive,
  f.trailDropTimer, f.lastDamagedAt, f.regenTimer, f.fogTimer,
  String(f.status.slowedUntil), String(f.status.stunnedUntil),
  f.lastUsed.join(','), f.concealed, f.revealedUntil, f.terrainSlowFactor,
  // eslint-disable-next-line eqeqeq
  f.cast == null ? 'idle' : `${f.cast.weaponIndex}@${f.cast.startedAt}->${f.cast.resolvesAt}`,
].join('|');
const stateOf = (s) => [
  s.phase, s.elapsed, s.timeRemaining, s.safeRadius, s.winnerId ?? 'none', s.nextId,
  s.fighters.map(fighterOf).join(';'),
  s.projectiles.map((p) => [p.id, p.ownerId, p.targetId, p.weapon.key, p.x, p.y, p.vx, p.vy, p.traveled, p.damage, p.arrived, p.peckTimer, p.hitsSoFar].join('|')).join(';'),
  s.trailMarks.map((m) => `${m.id},${m.ownerId},${m.x},${m.y},${m.expiresAt},${m.damagedMask}`).join(';'),
  s.splats.map((sp) => `${sp.id},${sp.x},${sp.y},${sp.expiresAt}`).join(';'),
].join('\n');
const eventsOf = (evs) => evs.map((e) => JSON.stringify(e)).join('\n');

/**
 * One matchup in lockstep, PLUS the two explanatory counters read off the baseline arm.
 *
 * `pressableTicks` asks the counterfactual the lockout used to answer: while a wind-up was
 * open, was there a press the OLD gate would have refused and the new one allows?
 *
 * ⚠️ **AND ITS FIRST DRAFT WAS WRONG IN A WAY THAT MANUFACTURED THREE FINDINGS.** It asked
 * only *"was some other slot off cooldown"*, which is a fact about the FIGHTER; the lockout
 * refused a **press**, which is a fact about the fighter AND its controller. On the human
 * seat the scripted driver holds `attack` false most ticks and often selects the cast slot
 * itself — a press both arms refuse — so three `waterbottle vs pizza` seeds came out
 * bit-identical, correctly, and were reported as 🚨 UNEXPLAINED. The seat is now read:
 *
 *   human seat   the ACTUAL input: `attack` set, on a castless slot that is off cooldown
 *   AI seat      the cooldown counterfactual, because `stepAI` chooses inside itself.
 *                It OVER-counts, which is the safe direction: it can only ever produce
 *                more "unexplained" rows, never fewer.
 */
function run(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
  const sa = A.createMatch(arena, playerId, enemyId);
  const sb = B.createMatch(arena, playerId, enemyId);
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let diverged = false;
  let castsOpened = 0;
  let castTicks = 0;
  let pressableTicks = 0;
  while (sa.phase !== 'ended' && sa.elapsed < HARD_CAP) {
    const input = loop.next(sa, DT);
    // READ BEFORE THE STEP: the gate the lockout used to run saw this state, not the one
    // `stepMatch` leaves behind. Reading it afterwards would attribute the refusal to the
    // wrong tick and, on the tick a cast resolves, to a cast that no longer exists.
    for (const f of sa.fighters) {
      if (f.cast === null || !f.alive) continue;
      castTicks++;
      const ws = CHARACTERS[f.characterId].weapons;
      const ready = (i) => ws[i] && (ws[i].castMs ?? 0) === 0 && sa.elapsed - f.lastUsed[i] >= ws[i].cooldown;
      const refused = f.controller === 'human'
        ? Boolean(input?.attack) && input.selectedWeapon !== f.cast.weaponIndex && ready(input.selectedWeapon)
        : ws.some((w, i) => i !== f.cast.weaponIndex && ready(i));
      if (refused) pressableTicks++;
    }
    const ea = A.stepMatch(sa, DT, input);
    const eb = B.stepMatch(sb, DT, input);
    castsOpened += ea.filter((e) => e.type === 'cast-started').length;
    if (!diverged && (eventsOf(ea) !== eventsOf(eb) || stateOf(sa) !== stateOf(sb))) diverged = true;
    if (diverged) break;
  }
  return { diverged, castsOpened, castTicks, pressableTicks };
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log(`\n══ lk_why SELFTEST ══  ref ${REF_DIR}\n                       sim ${SIM_DIR}`);
  ok('the cast-character set is DERIVED and non-empty', CAST_CHARS.size > 0, `[${[...CAST_CHARS].join(', ')}]`);
  // KNOWN-BAD: the counters must be able to read NON-ZERO, or "explained by 0 casts" is a
  // sentence this tool would print for every matchup in the game forever.
  const anyCast = CHARACTER_IDS.filter((id) => !CAST_CHARS.has(id))
    .map((id) => run(id, [...CAST_CHARS][0], 0)).find((r) => r.castsOpened > 0);
  ok('KNOWN-BAD: at least one matchup opens a wind-up at all — the counter can read non-zero',
    anyCast !== undefined, anyCast ? `castsOpened ${anyCast.castsOpened}, castTicks ${anyCast.castTicks}, pressable ${anyCast.pressableTicks}` : 'none did');
  ok('…and a matchup with NO cast character opens none — the counter is not counting everything',
    (() => { const nc = CHARACTER_IDS.filter((id) => !CAST_CHARS.has(id)); return run(nc[0], nc[1], 0).castsOpened === 0; })());
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

const rows = [];
for (const p of CHARACTER_IDS) {
  for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    if (!CAST_CHARS.has(p) && !CAST_CHARS.has(e)) continue;
    for (let s = 0; s < SEEDS; s++) rows.push({ p, e, s, ...run(p, e, s) });
  }
}
const same = rows.filter((r) => !r.diverged);
const unexplained = same.filter((r) => r.castsOpened > 0 && r.pressableTicks > 0);

console.log(`\n══ LK_WHY ══  ${rows.length} cast matchups · policy ${POLICY} · ${SEEDS} seeds`);
console.log(`   ref ${REF_DIR}`);
console.log(`   sim ${SIM_DIR}\n`);
console.log(`   diverged                 ${rows.length - same.length}`);
console.log(`   BIT-IDENTICAL            ${same.length}`);
for (const r of same) {
  const why = r.castsOpened === 0 ? 'no wind-up was ever opened'
    : r.castTicks === 0 ? 'the wind-up never survived a tick boundary'
      : r.pressableTicks === 0 ? 'no press the OLD gate would have refused ever occurred'
        : '🚨 UNEXPLAINED';
  console.log(`     ${`${r.p} vs ${r.e}`.padEnd(28)} seed ${r.s}  casts ${String(r.castsOpened).padStart(2)} · castTicks ${String(r.castTicks).padStart(3)} · pressableTicks ${String(r.pressableTicks).padStart(3)}   ${why}`);
}
console.log(`\n   >> ${unexplained.length === 0
  ? 'PASS — every bit-identical cast matchup is explained by the sim, not by a patch that missed.'
  : `FAIL — ${unexplained.length} bit-identical matchups had a live wind-up AND a pressable slot.`}\n`);
process.exit(unexplained.length === 0 ? 0 : 1);
