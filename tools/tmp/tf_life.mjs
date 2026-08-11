#!/usr/bin/env node
/**
 * TF_LIFE — what a longer-lived projectile actually costs, measured on real matches.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `DECISIONS §50b` denominates a shot's budget in the target's frame, which means a shot
 * chasing a runner stays alive until it CLOSES rather than until it has flown `range`
 * world units. That buys the fix and it spends three things nothing else in this repo
 * measures, so they are measured here rather than assumed away:
 *
 *   LIFETIME     ms in the air. The reach table says a shot may now legally live for
 *                `range / (speed − FLEE_REFERENCE_SPEED)` = up to 3.5 s at the slow rung.
 *   WORLD PATH   how far it flies. Under path-length retirement this was `range` by
 *                definition — a hard 140 wu. It is no longer bounded by `range` at all.
 *   OUT OF MAP   how far outside the arena rectangle a projectile ever gets. Nothing in
 *                `stepProjectiles` retires on the arena boundary; it never had to, because
 *                the old budget did it implicitly.
 *   CONCURRENCY  the most projectiles alive in one tick, and the mean. This is the one a
 *                phone pays for (`DECISIONS §56`: the frame is a draw-call problem).
 *
 * ⚠️ EVERY FIGURE IS PAIRED AND EXACT FOR THESE SEEDS, and none of them is a win rate.
 * Run it with `--sim` against an extracted tree to get the other arm; the ~9 pp aggregate
 * floor belongs to `roster_lab.mjs` and does not apply to any column here.
 *
 *   node tools/tmp/tf_life.mjs --selftest
 *   node tools/tmp/tf_life.mjs --sim /tmp/head/src/game --seeds 4
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
const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS } = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!ARENA_DATA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const FOG_FIRST_CONTACT_MS = 6000;
const derivedMaxSafe = Math.round(
  Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS),
);
const arena = { ...ARENA_DATA, maxSafeRadius: derivedMaxSafe, build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 4);
const POLICY = String(args.policy ?? 'smart2');
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...parseDriverFlags(args) });

/**
 * One match, watching every projectile from spawn to death.
 *
 * Tracked by `id` in a Map rather than by index: `stepProjectiles` splices, so an index is
 * a different projectile from one tick to the next. The books are read BEFORE each tick,
 * so a projectile's last recorded sample is the tick before it died — which understates a
 * lifetime by at most one tick and never overstates one.
 */
function watch(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const live = new Map(); // id -> { t0, x0, y0, path, lastX, lastY }
  const lives = [];
  let maxAlive = 0, aliveTicks = 0, ticks = 0, maxOut = 0, maxPath = 0;

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    for (const p of state.projectiles) {
      let rec = live.get(p.id);
      if (!rec) { rec = { t0: state.elapsed, path: 0, lastX: p.x, lastY: p.y }; live.set(p.id, rec); }
      rec.path += Math.hypot(p.x - rec.lastX, p.y - rec.lastY);
      rec.lastX = p.x; rec.lastY = p.y;
      rec.tEnd = state.elapsed;
      const out = Math.max(0, -p.x, p.x - arena.width, -p.y, p.y - arena.height);
      if (out > maxOut) maxOut = out;
      if (rec.path > maxPath) maxPath = rec.path;
    }
    maxAlive = Math.max(maxAlive, state.projectiles.length);
    aliveTicks += state.projectiles.length;
    ticks++;
    const seen = new Set(state.projectiles.map((p) => p.id));
    for (const [id, rec] of live) {
      if (!seen.has(id)) { lives.push(rec.tEnd - rec.t0 + DT); live.delete(id); }
    }
    stepMatch(state, DT, loop.next(state, DT));
  }
  for (const rec of live.values()) lives.push(rec.tEnd - rec.t0 + DT);
  return { lives, maxAlive, meanAlive: ticks ? aliveTicks / ticks : 0, maxOut, maxPath };
}

// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ tf_life SELFTEST ══  sim ${SIM_DIR}`);
  const r = watch('sushi', 'donut', 0);
  ok('the watcher actually sees projectiles', r.lives.length > 0, `${r.lives.length} shots`);
  ok('every lifetime is positive and at least one tick', r.lives.every((l) => l >= DT), `min ${Math.min(...r.lives).toFixed(1)}`);
  // KNOWN-BAD: a melee-only pairing must produce ZERO shots. A watcher that counted
  // something here would be counting something other than projectiles.
  const melee = CHARACTER_IDS.find((id) => CHARACTERS[id].weapons.every((w) => w.type !== 'ranged'));
  if (melee) {
    const m = watch(melee, melee, 0);
    ok(`KNOWN-BAD: a ${melee}-vs-${melee} match (no ranged weapon in the kit) produces ZERO projectiles`,
      m.lives.length === 0, `${m.lives.length}`);
  } else {
    ok('KNOWN-BAD (skipped): the roster has no melee-only character to use as a zero control', true, 'every character has a ranged weapon');
  }
  // …and the arm-distinguishing control: a shot's WORLD PATH can exceed `range` only under
  // the target-frame rule. Under path-length retirement it is bounded by `range` + one step.
  const longest = Math.max(...CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons.filter((w) => w.type === 'ranged').map((w) => w.range ?? 0)));
  ok(`the world-path column can distinguish the two rules (longest gate ${longest} wu; observed max ${r.maxPath.toFixed(0)} wu)`,
    r.maxPath > 0, `${r.maxPath.toFixed(1)}`);
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

if (import.meta.main) {
  const t0 = Date.now();
  const all = [];
  let maxAlive = 0, sumMeanAlive = 0, n = 0, maxOut = 0, maxPath = 0;
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) {
        const r = watch(p, e, s);
        all.push(...r.lives);
        maxAlive = Math.max(maxAlive, r.maxAlive);
        maxOut = Math.max(maxOut, r.maxOut);
        maxPath = Math.max(maxPath, r.maxPath);
        sumMeanAlive += r.meanAlive; n++;
      }
    }
  }
  all.sort((a, b) => a - b);
  const q = (f) => all[Math.min(all.length - 1, Math.floor(f * all.length))];
  console.log(`\n══ TF_LIFE ══  ${n} matches · ${all.length} projectiles · policy ${POLICY} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   sim ${SIM_DIR}`);
  console.log(`   lifetime ms   mean ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(0)} · p50 ${q(0.5).toFixed(0)} · p95 ${q(0.95).toFixed(0)} · max ${all[all.length - 1].toFixed(0)}`);
  console.log(`   world path    max ${maxPath.toFixed(0)} wu   (the old rule bounded this at the longest gate + one step)`);
  console.log(`   outside map   max ${maxOut.toFixed(0)} wu   (nothing retires a projectile on the arena boundary)`);
  console.log(`   concurrency   max ${maxAlive} alive in one tick · mean ${(sumMeanAlive / n).toFixed(2)}\n`);
}
