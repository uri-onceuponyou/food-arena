/**
 * rg2_mutants — THE KNOWN-BAD BATTERY FOR `DECISIONS §53b`, the endgame ring that scales
 * with fighter count.
 *
 * ⚠️ **A GUARD THAT HAS NOT BEEN SHOWN TO FAIL ON THE BUG IT GUARDS AGAINST IS NOT A
 * GUARD** (`CLAUDE.md` #6), and §53b is the worst possible case for that rule: **no corpus
 * reaches the endgame ring often, and nothing in `src/` seats more than two fighters.** So
 * every row of `sim.test.mjs` §29 passes identically against a sim which never changed —
 * every one of them describes geometry that only exists at five and six seats.
 *
 * Each claim is therefore re-asserted here against a DELIBERATELY WRONG sim: the six sim
 * modules copied out of the working tree with one literal source edit applied (the
 * `conceal_lab.mjs:patchedSimDir` idiom). Every mutation must be CAUGHT.
 *
 * 🚨 **THE ACCEPTANCE PREDICATE IS ANCHORED TO THE REACH LADDER, NOT TO THE MUTANT'S OWN
 * CONSTANT.** `trueStandoff` below is recomputed from `REACH.rangedMax` and the two hit
 * radii — which no mutant touches — so a mutant that redefines `ENDGAME_STANDOFF` is still
 * measured against 166 wu rather than against its own answer. A battery that read the
 * mutant's constant would grade every mutant against itself and pass all of them.
 *
 * ⚠️ Each edit is required to have actually MATCHED. A control built on a replacement that
 * silently matched nothing passes for the wrong reason, which is the single most common way
 * an instrument in this repo has lied — so `applied` is asserted per edit, per mutant.
 *
 * ⚠️ And §0 is the positive control: the LIVE sim must PASS every predicate. Without it a
 * predicate that always returned "caught" would report a clean sweep.
 *
 *   node tools/tmp/rg2_mutants.mjs
 *
 * Node-only. No browser, no snapshot, no GPU.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/** The same six modules `conceal_lab`, `match-sim`, `roster_lab` and `s49_mutants` use. */
const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   - ${name}${detail ? `  (${detail})` : ''}`); }
  else { fail++; failures.push(`${name}${detail ? `  (${detail})` : ''}`); console.log(`  FAIL - ${name}${detail ? `  (${detail})` : ''}`); }
}

function patchedSimDir(tag, edits) {
  const root = join(tmpdir(), `fa-rg2-${tag}`);
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
  const combat = await import(`${dir}/combat.ts`);
  return { createMatch: sim.createMatch, stepMatch: sim.stepMatch, applyDamage: combat.applyDamage, attemptAttack: combat.attemptAttack, RULES: rules };
}

const NO_INPUT = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

const arenaOf = (width, maxSafeRadius) => ({
  id: 'rg2-fixture',
  displayName: 'RG2 Fixture',
  width,
  height: width,
  center: { x: width / 2, y: width / 2 },
  maxSafeRadius,
  playerSpawn: { x: 200, y: 200 },
  enemySpawn: { x: width - 200, y: width - 200 },
  cover: [],
  hazards: [],
  build: () => ({}),
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PREDICATES — one per claim `sim.test.mjs` §29 makes, evaluated against an
// arbitrary sim. Anchored to the reach ladder, never to `ENDGAME_STANDOFF` itself.
// ─────────────────────────────────────────────────────────────────────────────

/** 166 wu, from constants no mutant below touches. */
function trueStandoff(R) {
  return R.REACH.rangedMax + Math.max(R.HIT_RADIUS_VS_PLAYER, R.HIT_RADIUS_VS_ENEMY);
}

/** The gap between two of `n` fighters spread evenly on the mid-annulus circle. */
function chordAt(R, n) {
  return (R.POT.dangerRadius + R.minSafeRadiusFor(n)) * Math.sin(Math.PI / n);
}

/** §29(b): nobody on the final ring is inside anybody's reach, at any seat count. */
function spacingHolds(SIM) {
  const R = SIM.RULES;
  for (let n = 2; n <= 6; n++) if (chordAt(R, n) < trueStandoff(R) - 1e-9) return false;
  return true;
}

/** §29(b): where the spacing term binds, the ring is the SMALLEST radius that satisfies it. */
function ringIsTight(SIM) {
  const R = SIM.RULES;
  let bound = 0;
  for (let n = 2; n <= 6; n++) {
    if (R.minSafeRadiusFor(n) === R.MIN_SAFE_RADIUS) continue;
    bound++;
    if (Math.abs(chordAt(R, n) - trueStandoff(R)) > 1e-9) return false;
  }
  // A ring that never leaves the floor is "tight" vacuously — that is mutant A, and it is
  // caught by `spacingHolds`. This predicate only claims the binding rows are exact.
  return bound === 2;
}

/** §29(a): the duel is untouched. */
function duelUnmoved(SIM) {
  const R = SIM.RULES;
  return R.minSafeRadiusFor(2) === R.MIN_SAFE_RADIUS && R.minSafeRadiusFor(3) === R.MIN_SAFE_RADIUS
    && R.minSafeRadiusFor(4) === R.MIN_SAFE_RADIUS;
}

/** §29(c): the §11 pot rule, generalised to every seat count. */
function potRuleHolds(SIM) {
  const R = SIM.RULES;
  for (let n = 1; n <= 6; n++) if (R.minSafeRadiusFor(n) < R.POT.dangerRadius + R.PLAYER_SIZE / 2) return false;
  return true;
}

/** §29(e): the largest final ring still fits inside the concealment keep-out. */
function keepoutCovers(SIM) {
  const R = SIM.RULES;
  return R.concealmentKeepoutRadius(993) >= R.minSafeRadiusFor(6)
    && R.concealmentKeepoutRadius(1985) >= R.minSafeRadiusFor(6);
}

/** §29(d): a real six-fighter match bottoms out at the six-fighter floor. */
function liveFloorAtSix(SIM) {
  const arena = arenaOf(3000, 993);
  const spawn = (i) => ({
    x: arena.center.x + 900 * Math.cos((i / 6) * Math.PI * 2),
    y: arena.center.y + 900 * Math.sin((i / 6) * Math.PI * 2),
  });
  const st = SIM.createMatch(arena, Array.from({ length: 6 }, (_, i) => ({ characterId: 'hamburger', spawn: spawn(i) })));
  st.phase = 'playing';
  for (const f of st.fighters) { f.hp = f.maxHp = 1e9; }
  let min = Infinity;
  for (let i = 0; i < 600 && st.phase === 'playing'; i++) { SIM.stepMatch(st, 100, NO_INPUT); min = Math.min(min, st.safeRadius); }
  return min;
}

/**
 * §29(d): knocking three of six out must NOT reopen the close.
 *
 * ⚠️ 400 ticks, NOT 500, and the phase is RETURNED rather than assumed. The first draft ran
 * 50 s of a 45 s match: the whistle had blown, `stepMatch` skips the entire ring block once
 * `phase !== 'playing'`, and `safeRadius` was simply frozen — so mutant J read the same
 * 237.00 as the live sim and the predicate was vacuous. A guard that cannot fail is not one.
 */
function ringAfterDeaths(SIM) {
  const arena = arenaOf(3000, 993);
  const spawn = (i) => ({
    x: arena.center.x + 900 * Math.cos((i / 6) * Math.PI * 2),
    y: arena.center.y + 900 * Math.sin((i / 6) * Math.PI * 2),
  });
  const st = SIM.createMatch(arena, Array.from({ length: 6 }, (_, i) => ({ characterId: 'hamburger', spawn: spawn(i) })));
  st.phase = 'playing';
  for (const f of st.fighters) { f.hp = f.maxHp = 1e9; }
  for (let i = 0; i < 400 && st.phase === 'playing'; i++) SIM.stepMatch(st, 100, NO_INPUT);
  for (const id of [3, 4, 5]) SIM.applyDamage(st, st.fighters[id], 1e9, null, { kind: 'fog' }, []);
  SIM.stepMatch(st, 100, NO_INPUT);
  return { radius: st.safeRadius, playing: st.phase === 'playing', living: st.fighters.filter((f) => f.alive).length };
}

/**
 * §29(d): the longest plain ranged weapon, fired at a stationary neighbour `gap` wu away
 * in a `seats`-fighter match. Returns the damage dealt — the COMBAT CODE's answer, not a
 * model of it.
 */
function reaches(SIM, gap, seats, width = 4000) {
  const R = SIM.RULES;
  let best = null;
  for (const id of R.CHARACTER_IDS) {
    for (const w of R.CHARACTERS[id].weapons) {
      if (w.type !== 'ranged' || w.giantSlam || w.homing || w.pellets) continue;
      if (!best || w.range > best.w.range) best = { id, w, index: R.CHARACTERS[id].weapons.indexOf(w) };
    }
  }
  const a = arenaOf(width, 4000);
  const configs = [
    { characterId: best.id, spawn: { x: a.center.x, y: a.center.y } },
    { characterId: best.id, spawn: { x: a.center.x + gap, y: a.center.y } },
  ];
  for (let i = 2; i < seats; i++) {
    const ang = 1.2 + ((i - 2) / 4) * Math.PI * 2;
    configs.push({ characterId: best.id, spawn: { x: a.center.x + 900 * Math.cos(ang), y: a.center.y + 900 * Math.sin(ang) } });
  }
  const st = SIM.createMatch(a, configs);
  st.phase = 'playing';
  st.fighters[0].facing = { x: 1, y: 0 };
  for (const f of st.fighters) f.controller = 'human';
  const hp0 = st.fighters[1].hp;
  SIM.attemptAttack(st, st.fighters[0], best.index, []);
  for (let i = 0; i < 4000 && st.projectiles.length > 0; i++) SIM.stepMatch(st, 1, NO_INPUT);
  return hp0 - st.fighters[1].hp;
}

/** §29(d): nothing connects across the six-fighter chord, at any map position. */
function sixChordIsSafe(SIM) {
  const R = SIM.RULES;
  const gap = chordAt(R, 6);
  return [3000, 3200, 3400, 3600, 3800, 4000].every((w) => reaches(SIM, gap, 6, w) === 0);
}

const LIVE = await loadSim(`${ROOT}/src/game`);
const LR = LIVE.RULES;

console.log('\n══ rg2 MUTANTS ══  every §53b claim, re-asserted against a deliberately wrong sim');
console.log('   FLOOR: EXACT. Every mutation must be CAUGHT; a missed one is a §29 row that is not a guard.\n');

// ── 0. THE LIVE SIM IS THE POSITIVE CONTROL ─────────────────────────────────
console.log('0. the LIVE sim passes every predicate — otherwise all of section 1 is vacuous');
{
  ok('standoff derives to 166 from the untouched ladder', trueStandoff(LR) === 166, `${trueStandoff(LR)}`);
  ok('the duel and the four-player match are on the shipped 140', duelUnmoved(LIVE),
    `${LR.minSafeRadiusFor(2)} / ${LR.minSafeRadiusFor(3)} / ${LR.minSafeRadiusFor(4)}`);
  ok('nobody on the final ring is inside anybody\'s reach, N=2..6', spacingHolds(LIVE),
    [2, 3, 4, 5, 6].map((n) => `${n}:${chordAt(LR, n).toFixed(2)}`).join(' '));
  ok('the two binding rings are the SMALLEST that satisfy the rule', ringIsTight(LIVE),
    `N=5 ${LR.minSafeRadiusFor(5).toFixed(2)}  N=6 ${LR.minSafeRadiusFor(6).toFixed(2)}`);
  ok('the pot rule holds at every seat count', potRuleHolds(LIVE));
  ok('the concealment keep-out covers the largest ring on both arena sizes', keepoutCovers(LIVE),
    `${LR.concealmentKeepoutRadius(993).toFixed(2)} / ${LR.concealmentKeepoutRadius(1985).toFixed(2)} vs ${LR.minSafeRadiusFor(6)}`);
  const live6 = liveFloorAtSix(LIVE);
  ok('a real six-fighter match bottoms out at the six-fighter floor', Math.abs(live6 - LR.minSafeRadiusFor(6)) < 1e-9, `${live6}`);
  const held = ringAfterDeaths(LIVE);
  ok('three knockouts do not reopen the close — and the fixture is still PLAYING, so the row can fail',
    held.playing && held.living === 3 && Math.abs(held.radius - LR.minSafeRadiusFor(6)) < 1e-9,
    `phase playing=${held.playing}, living ${held.living}, R ${held.radius}`);
  ok('nothing connects across the six-fighter chord, at any map position', sixChordIsSafe(LIVE));
  // …and the experiment is not "nothing ever reaches": the OLD constant-floor chord does.
  ok('POSITIVE CONTROL: the same weapon DOES connect across the old constant-floor chord',
    reaches(LIVE, (LR.POT.dangerRadius + LR.MIN_SAFE_RADIUS) * Math.sin(Math.PI / 6), 6) > 0);
}

// ── THE MUTANTS ─────────────────────────────────────────────────────────────

const GUARD = '  if (!Number.isFinite(n) || n < 3) return MIN_SAFE_RADIUS;';
const BODY = '  return Math.max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF / Math.sin(Math.PI / n) - POT.dangerRadius);';
const STANDOFF = 'export const ENDGAME_STANDOFF = REACH.rangedMax + Math.max(HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY);';
const CALL = 'minSafeRadiusFor(state.fighters.length)';

const MUTANTS = [
  {
    tag: 'a',
    name: 'A. THE SHIPPED DEFECT — a radius that ignores N entirely',
    edits: [['rules.ts', BODY, '  return MIN_SAFE_RADIUS;']],
    caught: (SIM) => !spacingHolds(SIM),
    detail: (SIM) => [5, 6].map((n) => `N=${n} chord ${chordAt(SIM.RULES, n).toFixed(2)}`).join(', '),
    guards: '§29(b) "no fighter on the final ring is inside another\'s reach"',
  },
  {
    tag: 'b',
    name: 'B. a radius that ignores the POT — the mid-annulus term dropped',
    edits: [['rules.ts', BODY, '  return Math.max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF / Math.sin(Math.PI / n));']],
    caught: (SIM) => !ringIsTight(SIM) && !keepoutCovers(SIM),
    detail: (SIM) => `N=6 ring ${SIM.RULES.minSafeRadiusFor(6).toFixed(2)} chord ${chordAt(SIM.RULES, 6).toFixed(2)}, keepout 248.25`,
    guards: '§29(b) "the ring is the SMALLEST radius that satisfies it" + §29(e) the keep-out row',
  },
  {
    tag: 'c',
    name: 'C. off-by-one on the chord — sin(pi/(n-1)), the neighbour count miscounted',
    edits: [['rules.ts', BODY, '  return Math.max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF / Math.sin(Math.PI / (n - 1)) - POT.dangerRadius);']],
    caught: (SIM) => !spacingHolds(SIM),
    detail: (SIM) => [5, 6].map((n) => `N=${n} ring ${SIM.RULES.minSafeRadiusFor(n).toFixed(2)} chord ${chordAt(SIM.RULES, n).toFixed(2)}`).join(', '),
    guards: '§29(b)',
  },
  {
    tag: 'd',
    name: 'D. off-by-one the other way — sin(pi/(n+1)), a ring too big to be the answer',
    edits: [['rules.ts', BODY, '  return Math.max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF / Math.sin(Math.PI / (n + 1)) - POT.dangerRadius);']],
    caught: (SIM) => !ringIsTight(SIM),
    detail: (SIM) => [5, 6].map((n) => `N=${n} ring ${SIM.RULES.minSafeRadiusFor(n).toFixed(2)} chord ${chordAt(SIM.RULES, n).toFixed(2)}`).join(', '),
    guards: '§29(b) "the SMALLEST radius that satisfies it" — a one-sided test passes this',
  },
  {
    tag: 'e',
    name: 'E. the chord\'s factor of 2 applied twice — half a ring',
    edits: [['rules.ts', BODY, '  return Math.max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF / (2 * Math.sin(Math.PI / n)) - POT.dangerRadius);']],
    caught: (SIM) => !spacingHolds(SIM),
    detail: (SIM) => [5, 6].map((n) => `N=${n} chord ${chordAt(SIM.RULES, n).toFixed(2)}`).join(', '),
    guards: '§29(b)',
  },
  {
    tag: 'f',
    name: 'F. the hit radius dropped — the standoff is bare `REACH.rangedMax`',
    edits: [['rules.ts', STANDOFF, 'export const ENDGAME_STANDOFF = REACH.rangedMax;']],
    caught: (SIM) => !spacingHolds(SIM) && !sixChordIsSafe(SIM),
    detail: (SIM) => `N=6 chord ${chordAt(SIM.RULES, 6).toFixed(2)}, weapon dealt ${reaches(SIM, chordAt(SIM.RULES, 6), 6)}`,
    guards: '§29(b) + §29(d) "the longest weapon does NOT connect across the six-fighter chord"',
  },
  {
    tag: 'g',
    name: 'G. the SMALLER hit radius — `min` instead of `max`, the razor re-armed',
    edits: [['rules.ts', STANDOFF, 'export const ENDGAME_STANDOFF = REACH.rangedMax + Math.min(HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY);']],
    caught: (SIM) => !spacingHolds(SIM),
    detail: (SIM) => `standoff ${SIM.RULES.ENDGAME_STANDOFF}, N=6 chord ${chordAt(SIM.RULES, 6).toFixed(2)} vs true ${trueStandoff(SIM.RULES)}`,
    guards: '§29(b), which measures against the ladder rather than against ENDGAME_STANDOFF',
  },
  {
    tag: 'h',
    name: 'H. the POT FLOOR dropped — invisible at N=2, fatal at N=3',
    edits: [['rules.ts', BODY, '  return ENDGAME_STANDOFF / Math.sin(Math.PI / n) - POT.dangerRadius;']],
    caught: (SIM) => !potRuleHolds(SIM),
    detail: (SIM) => `N=3 ring ${SIM.RULES.minSafeRadiusFor(3).toFixed(2)} vs pot+half-body ${SIM.RULES.POT.dangerRadius + SIM.RULES.PLAYER_SIZE / 2}`,
    guards: '§29(c) "the §11 rule holds at EVERY seat count" — and §29(a) does NOT catch it',
  },
  {
    tag: 'i',
    name: 'I. the guard widened to `n < 6` — one seat count swallowed by the early return',
    edits: [['rules.ts', GUARD, '  if (!Number.isFinite(n) || n < 6) return MIN_SAFE_RADIUS;']],
    caught: (SIM) => !spacingHolds(SIM),
    detail: (SIM) => `N=5 ring ${SIM.RULES.minSafeRadiusFor(5).toFixed(2)} chord ${chordAt(SIM.RULES, 5).toFixed(2)}`,
    guards: '§29(b). ⚠️ Widening the guard to 4 or 5 instead is a provable NO-OP — the pot term binds there anyway — so 6 is the smallest widening that changes an answer at all',
  },
  {
    tag: 'j',
    name: 'J. the LIVING count instead of the seated one — a fog that reopens on a knockout',
    edits: [['sim.ts', CALL, 'minSafeRadiusFor(state.fighters.filter((f) => f.alive).length)']],
    caught: (SIM) => {
      const r = ringAfterDeaths(SIM);
      return r.playing && r.living === 3 && Math.abs(r.radius - SIM.RULES.minSafeRadiusFor(6)) > 1e-9;
    },
    detail: (SIM) => {
      const r = ringAfterDeaths(SIM);
      return `after three knockouts the ring reads ${r.radius.toFixed(2)}, want ${SIM.RULES.minSafeRadiusFor(6).toFixed(2)} (playing=${r.playing})`;
    },
    guards: '§29(d) "three of six knocked out does NOT reopen the close" — and `--bitid` at N=2 does NOT catch it',
  },
  {
    tag: 'k',
    name: 'K. `sim.ts` pins the seat count at 2 — the derivation lands and nothing reads it',
    edits: [['sim.ts', CALL, 'minSafeRadiusFor(2)']],
    caught: (SIM) => Math.abs(liveFloorAtSix(SIM) - SIM.RULES.minSafeRadiusFor(6)) > 1e-9,
    detail: (SIM) => `six-fighter match bottoms out at ${liveFloorAtSix(SIM)}, want ${SIM.RULES.minSafeRadiusFor(6)}`,
    guards: '§29(d) "a six-fighter match bottoms out at the six-fighter floor" — every geometry row still passes',
  },
];

console.log('\n1. every mutant is CAUGHT, and every edit is proven to have matched');
for (const m of MUTANTS) {
  const { dir, applied } = patchedSimDir(m.tag, m.edits);
  ok(`the patch for "${m.name}" actually landed (a no-op edit would fake this control)`,
    applied.every(Boolean), applied.map((a) => (a ? 'applied' : 'NO MATCH')).join(', '));
  if (!applied.every(Boolean)) continue;
  const SIM = await loadSim(dir);
  let detail = '';
  let caught = false;
  try { caught = m.caught(SIM); detail = m.detail(SIM); } catch (e) { detail = `threw: ${e.message}`; caught = true; }
  ok(`CAUGHT — ${m.name}`, caught, `${detail}; guards ${m.guards}`);
}

console.log(`\n   ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\n   FAILURES:');
  for (const f of failures) console.log(`     ${f}`);
  process.exit(1);
}
process.exit(0);
