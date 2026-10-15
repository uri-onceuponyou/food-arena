#!/usr/bin/env node
/**
 * BH_MOVE_TICK — are the sim's periodic effects (pot burn, fog burn, regen, Sticky Trail
 * drops) delivered at their AUTHORED rate, whatever the client's frame timing?
 *
 * Review-phase probe (2026-10-15). READ-ONLY: imports the sim from `--src-root` (default:
 * the clean detached worktree of HEAD at /private/tmp/fa-rv-head). Writes only under
 * shots/rv/bugs/move/.
 *
 * THE SUSPICION
 *   `sim.ts:applyWorldTick` advances four accumulators by `dt` and, when one reaches its
 *   period, sets it back to ZERO (`fogTimer = 0`, `hazardTimers[idx] = 0`, `regenTimer = 0`,
 *   `trailDropTimer = 0`). The overshoot `timer - period` is thrown away, so the effective
 *   period is the authored one ROUNDED UP TO A FRAME BOUNDARY — a function of the dt
 *   sequence. The shipped loop (`match.ts` `loop`) feeds `stepMatch` a VARIABLE dt —
 *   `min(clock.getDelta(), 1/20)`, then hit-stop trickle (x0.05) and catch-up (up to x4)
 *   frames on top. Every balance number in the repo is measured at a constant 16.667 ms,
 *   where 250 and 300 happen to be (almost exact) multiples, i.e. the one cadence that
 *   hides it.
 *
 * WHAT IT DOES
 *   For each dt schedule, a real 2-fighter match through `createMatch`/`stepMatch`, both
 *   seats human with neutral input and `maxHp` 1e7 (nobody dies, nobody moves):
 *     POT   seat 0 parked in the burn band, 80 wu due east of the pot centre (box face is
 *           73 wu out, burn radius 95). 20 s of play. HP/s against POT.damage/POT.tickMs.
 *     FOG   both seats parked at their shipped spawns (1116 wu out, outside the 140 floor);
 *           HP lost between play-clock 121 s and 134 s (ring on its floor, before sudden
 *           death). HP/s against FOG_DAMAGE/FOG_TICK_MS.
 *     REGEN seat 0 starts at half HP, parked in open floor; HP/s over 20 s after the delay.
 *     TRAIL a Donut human walking a long straight lane; marks dropped per second.
 *   `--patched` re-runs against a SCRATCH COPY of src/game (under shots/rv/bugs/move/patched,
 *   gitignored, never the tree) in which the four resets carry the remainder
 *   (`timer -= period`). If the deviations vanish there, the reset is the cause.
 *
 * CONTROL: the const-60 Hz row must read nominal (it is the cadence every instrument uses).
 *
 * Use: node tools/tmp/bh_move_tick.mjs [--patched]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
mkdirSync(OUT_DIR, { recursive: true });

/** Stage a scratch copy of src/game with the four accumulator resets carrying the remainder. */
function stagePatched() {
  const dst = `${OUT_DIR}/patched/src/game`;
  mkdirSync(dst, { recursive: true });
  mkdirSync(`${OUT_DIR}/patched/src/arena`, { recursive: true });
  for (const f of readdirSync(`${SRC_ROOT}/src/game`)) if (f.endsWith('.ts')) copyFileSync(`${SRC_ROOT}/src/game/${f}`, `${dst}/${f}`);
  copyFileSync(`${SRC_ROOT}/src/arena/types.ts`, `${OUT_DIR}/patched/src/arena/types.ts`);
  let sim = readFileSync(`${dst}/sim.ts`, 'utf8');
  const edits = [
    ['fighter.trailDropTimer = 0;\n      const mark', 'fighter.trailDropTimer -= TRAIL.dropIntervalMs;\n      const mark'],
    ['fighter.hazardTimers[idx] = 0;\n        applyDamage', 'fighter.hazardTimers[idx] = t - (hazard.tickMs ?? Infinity);\n        applyDamage'],
    ['fighter.regenTimer = 0;\n      const before', 'fighter.regenTimer -= REGEN_TICK_MS;\n      const before'],
    ['fighter.fogTimer = 0;\n      applyDamage', 'fighter.fogTimer -= FOG_TICK_MS;\n      applyDamage'],
  ];
  for (const [a, b] of edits) {
    if (!sim.includes(a)) throw new Error(`patch anchor not found: ${a.slice(0, 50)}`);
    sim = sim.replace(a, b);
  }
  writeFileSync(`${dst}/sim.ts`, sim);
  return `${OUT_DIR}/patched`;
}

const ROOT_FOR_SIM = args.patched ? stagePatched() : SRC_ROOT;
const { createMatch, stepMatch } = await import(`${ROOT_FOR_SIM}/src/game/sim.ts`);
const R = await import(`${ROOT_FOR_SIM}/src/game/rules.ts`);
const { POT, FOG_DAMAGE, FOG_TICK_MS, REGEN_AMOUNT, REGEN_TICK_MS, REGEN_DELAY_MS, TRAIL, MATCH_DURATION_MS } = R;
const ARENA = { ...JSON.parse(readFileSync(ARENA_PATH, 'utf8')), build: () => null, update: () => {} };

// ── dt schedules ────────────────────────────────────────────────────────────
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SCHEDULES = {
  'const 16.667 ms (Node instruments)': () => () => 16.667,
  'const 60 Hz (1000/60, browser ideal)': () => () => 1000 / 60,
  'const 30 Hz': () => () => 1000 / 30,
  'const 45 Hz': () => () => 1000 / 45,
  'const 90 Hz': () => () => 1000 / 90,
  'const 144 Hz': () => () => 1000 / 144,
  'const 24 Hz': () => () => 1000 / 24,
  // A browser at 60 Hz does not deliver 16.667 every frame; rAF deltas jitter by ~±1 ms.
  '60 Hz jitter ±1 ms': () => { const r = mulberry(7); return () => 1000 / 60 + (r() * 2 - 1); },
  // The shipped hit-stop: every 900 ms of raw time, a 60 ms freeze at x0.05, then catch-up
  // at up to 3x extra until the bank is repaid (match.ts HITSTOP_TRICKLE / CATCHUP_RATE).
  '60 Hz + hit-stop every 0.9 s': () => {
    let t = 0, budget = 0, bank = 0, nextHit = 900;
    return () => {
      const raw = 1000 / 60; t += raw;
      if (t >= nextHit) { budget = 60; nextHit += 900; }
      if (budget > 0) { budget = Math.max(0, budget - raw); const s = raw * 0.05; bank += raw - s; return s; }
      if (bank > 0) { const c = Math.min(bank, raw * 3); bank -= c; return raw + c; }
      return raw;
    };
  },
};

const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
function startPlaying(state, dtFn, inputs) {
  let g = 0;
  while (state.phase !== 'playing' && g++ < 100000) stepMatch(state, dtFn(), inputs);
}

function potRate(mk) {
  const dtFn = mk();
  const cx = ARENA.center.x, cy = ARENA.center.y;
  const state = createMatch(ARENA, [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e7, spawn: { x: cx + 80, y: cy } },
    { characterId: 'egg', controller: 'human', maxHp: 1e7, spawn: { x: 300, y: 300 } },
  ]);
  const inputs = [NEUTRAL, NEUTRAL];
  startPlaying(state, dtFn, inputs);
  const f = state.fighters[0];
  const hp0 = f.hp, t0 = state.elapsed;
  while (state.elapsed - t0 < 60_000) stepMatch(state, dtFn(), inputs);
  return ((hp0 - f.hp) / (state.elapsed - t0)) * 1000;
}

function fogRate(mk) {
  const dtFn = mk();
  const state = createMatch(ARENA, [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e7 },
    { characterId: 'egg', controller: 'human', maxHp: 1e7 },
  ]);
  const inputs = [NEUTRAL, NEUTRAL];
  startPlaying(state, dtFn, inputs);
  const play = () => MATCH_DURATION_MS - state.timeRemaining;
  while (play() < 70_000) stepMatch(state, dtFn(), inputs);
  const f = state.fighters[0];
  const hp0 = f.hp, t0 = play();
  while (play() < 134_000) stepMatch(state, dtFn(), inputs);
  return ((hp0 - f.hp) / (play() - t0)) * 1000;
}

function regenRate(mk) {
  const dtFn = mk();
  const state = createMatch(ARENA, [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e7 },
    { characterId: 'egg', controller: 'human', maxHp: 1e7 },
  ]);
  const inputs = [NEUTRAL, NEUTRAL];
  startPlaying(state, dtFn, inputs);
  const f = state.fighters[0];
  f.hp = f.maxHp / 2; // far from full, so the clamp never binds
  while (state.elapsed - f.lastDamagedAt <= REGEN_DELAY_MS + 50) stepMatch(state, dtFn(), inputs);
  const hp0 = f.hp, t0 = state.elapsed;
  while (state.elapsed - t0 < 60_000) stepMatch(state, dtFn(), inputs);
  return ((f.hp - hp0) / (state.elapsed - t0)) * 1000;
}

function trailRate(mk) {
  const dtFn = mk();
  // Donut walks east along y = 1000 - 330 ... choose a long open lane: the north lane y=~560?
  // Count marks created over 60 s of HOLDING a direction. Once the Donut reaches the freezer
  // it presses into it; `moveFighter` still reports an attempted move, so marks keep dropping
  // (the trail is keyed on input, not on displacement) and the window is not cut short.
  const state = createMatch(ARENA, [
    { characterId: 'donut', controller: 'human', maxHp: 1e7, spawn: { x: 300, y: 810 } },
    { characterId: 'egg', controller: 'human', maxHp: 1e7, spawn: { x: 2500, y: 1190 } },
  ]);
  startPlaying(state, dtFn, [NEUTRAL, NEUTRAL]);
  const walk = { move: { x: 0, y: 1 }, selectedWeapon: 0, attack: false };
  let marks = 0;
  const t0 = state.elapsed;
  while (state.elapsed - t0 < 60_000) {
    const ev = stepMatch(state, dtFn(), [walk, NEUTRAL]);
    for (const e of ev) if (e.type === 'trail-mark-created' && e.ownerId === 0) marks++;
  }
  return (marks / (state.elapsed - t0)) * 1000;
}

const nominal = {
  pot: (POT.damage / POT.tickMs) * 1000,
  fog: (FOG_DAMAGE / FOG_TICK_MS) * 1000,
  regen: (REGEN_AMOUNT / REGEN_TICK_MS) * 1000,
  trail: 1000 / TRAIL.dropIntervalMs,
};
console.log(`sim from ${ROOT_FOR_SIM}${args.patched ? '   (PATCHED scratch copy: resets carry the remainder)' : ''}`);
console.log(`nominal: pot ${nominal.pot.toFixed(2)} HP/s · fog ${nominal.fog.toFixed(2)} HP/s · regen ${nominal.regen.toFixed(2)} HP/s · trail ${nominal.trail.toFixed(3)} marks/s\n`);
const rows = [];
// Window floors: ±1 tick over the window — pot 8 HP/60 s, fog 15 HP/64 s, regen 2 HP/60 s, trail 1 mark/60 s.
const pct = (v, n) => `${v.toFixed(2).padStart(6)} (${(((v - n) / n) * 100).toFixed(1).padStart(5)}%)`;
console.log('schedule                          pot HP/s          fog HP/s          regen HP/s        trail marks/s');
for (const [name, mk] of Object.entries(SCHEDULES)) {
  const r = { name, pot: potRate(mk), fog: fogRate(mk), regen: regenRate(mk), trail: trailRate(mk) };
  rows.push(r);
  console.log(`${name.padEnd(33)} ${pct(r.pot, nominal.pot)}   ${pct(r.fog, nominal.fog)}   ${pct(r.regen, nominal.regen)}   ${pct(r.trail, nominal.trail)}`);
}
const out = `${OUT_DIR}/tick_rates${args.patched ? '_patched' : ''}.json`;
writeFileSync(out, JSON.stringify({ simRoot: ROOT_FOR_SIM, patched: !!args.patched, nominal, rows }, null, 2));
console.log(`\nwrote ${out}`);
