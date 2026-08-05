#!/usr/bin/env node
/**
 * ROSTER LAB — per-character strength, the SETTLED-MATCHUP count, and the rarity
 * roll-up, on the FIXED driver.
 *
 * ── Why a new tool rather than `roster_table.mjs` ───────────────────────────
 *
 * It was born during the driver audit (`d9753ff`), because the roster tools were the
 * ones under audit and could not be edited. It lifted the driver from
 * `pacing_ladder.mjs` — correctly, with both countdown guards, and `driver_guard.mjs`
 * caught it on its first run anyway, which is the argument for that guard in one line.
 * It now IMPORTS `tools/tmp/scripted_player.mjs` like every other Node balance tool, so
 * there is one scripted player in this repo and not fourteen.
 *
 * The conversion was verified rather than assumed: every figure this tool had already
 * published came out BIT-IDENTICAL through the shared driver, and `--selftest` still
 * reproduces `pacing_ladder.mjs`'s independently published aggregate to the digit.
 *
 * What `roster_table.mjs` reports and this does not: the mechanism columns. What this
 * reports and it does not:
 *
 *   SETTLED MATCHUPS   how many of the 110 are decided before they start — one side
 *                      wins >= 95% or <= 5% across every seed. `DECISIONS §13(c)`
 *                      calls this "the finding I would act on if you only pick one";
 *                      it was 53 of 110 and no instrument here ever printed it.
 *   RARITY ROLL-UP     mean strength per rarity tier, and whether it is MONOTONIC in
 *                      `RARITY_ORDER`. The trophy road is built as a progression.
 *   THE HP/SPEED TABLE the per-character pools and speeds the sim is actually using,
 *                      printed in the header — because until 2026-08-05 every character
 *                      had identical HP and identical speed and the card said otherwise.
 *
 *   node tools/tmp/roster_lab.mjs --selftest
 *   node tools/tmp/roster_lab.mjs --seeds 8  --json /tmp/rl.before.json
 *   node tools/tmp/roster_lab.mjs --seeds 32 --sim /tmp/cand/game --baseline /tmp/rl.before.json
 *
 * ⚠️ RESOLUTION FLOORS (measured on this project): an AGGREGATE win rate is
 * unresolvable below ~9 pp. A PAIRED per-matchup delta on identical seeds is exact and
 * is a DIFFERENT QUANTITY. This tool prints both, labelled, and never adds them.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, RARITY_ORDER,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, PLAYER_MAX_HP, ENEMY_MAX_HP, PLAYER_SPEED,
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS,
} = RULES;

/**
 * Per-character HP/speed, read through the SAME accessors the sim uses when they exist
 * and falling back to the role constants when they do not — so this tool works
 * unchanged on both sides of the change that introduces them, and a "before" JSON stays
 * comparable to an "after" one.
 */
const hpOf = (id, role) =>
  typeof RULES.maxHpFor === 'function' ? RULES.maxHpFor(id, role) : (role === 'player' ? PLAYER_MAX_HP : ENEMY_MAX_HP);
const speedOf = (id) =>
  typeof RULES.playerSpeedFor === 'function' ? RULES.playerSpeedFor(id) : PLAYER_SPEED;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH) && !args.selftest) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
// `arena.maxSafeRadius` is DERIVED from MATCH_DURATION_MS in `arena/shared.ts`, so a
// cached dump goes stale the moment the clock moves. Recompute from the same formula.
const HALF_DIAG = ARENA_DATA ? Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) : 0;
const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S
const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));
let arena = ARENA_DATA ? {
  ...ARENA_DATA,
  maxSafeRadius: Number(args.maxsafe ?? derivedMaxSafe),
  build: () => null, update: () => {},
} : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2,chase').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ─────────────────────────────────────────────────────────────────────────────
// THE DRIVER — imported, never copied. `tools/tmp/scripted_player.mjs` is the one
// implementation; `driver_guard.mjs` fails if a private copy reappears here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The driver binds to ONE arena and ONE `rules.ts`, so it is built per-arena rather
 * than once at module load — `--selftest` swaps in a synthetic arena whose answers are
 * derivable, and a driver still bound to the shipped layout would quietly measure the
 * wrong cover.
 */
const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...DRIVER_FLAGS });
let driver = arena ? driverFor(arena) : null;

// ─────────────────────────────────────────────────────────────────────────────
// one match
// ─────────────────────────────────────────────────────────────────────────────
function runMatch(playerId, enemyId, policy, seed, { beforeTick = null } = {}) {
  // Seed formula is `pacing_ladder.mjs`'s, unchanged — that is what makes a row here
  // the SAME match as a row there, which is what --selftest checks.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[policy](rnd);
  // Seed 0 is jitter-free, which is what makes it bit-reproducible across tools.
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const pReach = driver.maxNormalRange(playerId), eReach = driver.maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  let countdownMs = null, playTicks = 0, engagedTicks = 0, contactPlayMs = null;
  let winner = null, endedAt = null, ending = null;
  const dealt = { player: 0, enemy: 0 };
  const zone = { player: 0, enemy: 0 };
  let killedBy = null;

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (beforeTick) beforeTick(state);
    // The decision loop carries the countdown guard itself — it must not draw from the
    // seeded stream before the whistle, or the countdown length re-seeds every match.
    const evs = stepMatch(state, DT, loop.next(state, DT));

    for (const ev of evs) {
      if (ev.type === 'match-started') countdownMs = state.elapsed;
      else if (ev.type === 'match-ended') { winner = ev.winner; endedAt = state.elapsed; }
      else if (ev.type === 'death') ending = 'knockout';
      else if (ev.type === 'hit-landed') {
        const k = ev.source?.kind;
        // "dealt BY the other side" — a hit on the player is damage the enemy dealt.
        const by = ev.targetRole === 'player' ? 'enemy' : 'player';
        if (k === 'weapon' || k === 'trail') dealt[by] += ev.amount;
        else zone[ev.targetRole] += ev.amount;
        if (k === 'fog' || k === 'hazard') killedBy = state[ev.targetRole].hp === 0 ? 'zone' : killedBy;
      }
    }

    if (state.phase === 'playing') {
      playTicks++;
      const engaged = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= engageRange;
      if (engaged) {
        engagedTicks++;
        if (contactPlayMs === null) contactPlayMs = MATCH_DURATION_MS - state.timeRemaining;
      }
    }
  }

  const playMs = countdownMs === null ? 0 : (endedAt ?? state.elapsed) - countdownMs;
  if (ending === null) ending = winner ? 'timeout' : 'UNRESOLVED';

  return {
    playerId, enemyId, policy, seed, winner, ending, killedBy,
    countdownMs: countdownMs ?? 0, playMs,
    sessionMs: (countdownMs ?? 0) + playMs,
    contactPlayMs,
    contactSessionMs: contactPlayMs === null ? null : (countdownMs ?? 0) + contactPlayMs,
    engagedMs: engagedTicks * DT,
    dutyCycle: (countdownMs ?? 0) + playMs > 0 ? (engagedTicks * DT) / ((countdownMs ?? 0) + playMs) : 0,
    dealt, zone,
    hpLeft: { player: state.player.hp, enemy: state.enemy.hp },
    maxHp: { player: state.player.maxHp, enemy: state.enemy.maxHp },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : validate the instrument against inputs whose answer is derivable,
//              and against a figure another tool already published.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ roster_lab SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  // ── A. Derivable answers on a synthetic arena ──────────────────────────────
  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  // Re-bind the driver to the synthetic arena: it captures cover and hazards at
  // construction, so a driver left bound to the shipped layout would line-of-sight
  // against boxes that are not in the arena under test.
  const savedArena = arena, savedDriver = driver;
  arena = CLEAR; driver = driverFor(CLEAR);

  // 1. A player that never acts, against an AI that can kill it, never wins.
  {
    const r = runMatch('hamburger', 'hamburger', 'idle', 0);
    ok('an idle player never wins (the outcome plumbing is not inverted)',
      r.winner === 'enemy', `winner=${r.winner} after ${(r.playMs / 1000).toFixed(1)}s`);
  }
  // 2. …and the mirror: an enemy pinned at 1 HP is killed, so `winner: player` is reachable.
  {
    const r = runMatch('hamburger', 'donut', 'chase', 0, {
      beforeTick: (s) => { if (s.phase === 'playing') { s.enemy.hp = Math.min(s.enemy.hp, 1); s.player.hp = s.player.maxHp; } },
    });
    ok('an enemy pinned at 1 HP loses — both outcomes are reachable',
      r.winner === 'player', `winner=${r.winner}`);
  }
  // 3. Determinism: seed 0 is jitter-free, so two runs must be bit-identical.
  {
    const a = runMatch('pizza', 'soup', 'smart2', 0);
    const b = runMatch('pizza', 'soup', 'smart2', 0);
    ok('seed 0 is deterministic (bit-identical re-run)',
      a.playMs === b.playMs && a.winner === b.winner && a.dealt.player === b.dealt.player);
  }
  // 4. The HP the sim gives each fighter is the HP this tool says it does. This is the
  //    check that stops a per-character pool being introduced and the instrument still
  //    reporting the role constant — the exact shape of `docs/LESSONS.md` §13.
  {
    const bad = [];
    for (const id of CHARACTER_IDS) {
      const r = runMatch(id, id, 'idle', 0);
      if (r.maxHp.player !== hpOf(id, 'player')) bad.push(`${id} player ${r.maxHp.player} vs ${hpOf(id, 'player')}`);
      if (r.maxHp.enemy !== hpOf(id, 'enemy')) bad.push(`${id} enemy ${r.maxHp.enemy} vs ${hpOf(id, 'enemy')}`);
    }
    ok('the pool the SIM gives each fighter is the pool this tool reports',
      bad.length === 0, bad.slice(0, 4).join(' · '));
  }
  // 5. Settled/strength/aggregate arithmetic, on a hand-built rate table with a known
  //    answer — so the summary maths is tested without a single match being run.
  {
    const fake = {};
    for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) fake[`${a}>${b}`] = 0.5;
    fake[`hamburger>donut`] = 1; fake[`donut>hamburger`] = 0;   // 2 settled
    fake[`taco>soup`] = 0.96; fake[`soup>taco`] = 0.04;         // 2 more
    const s = summarise(fake);
    ok('settled counts exactly the >=95% / <=5% cells, and only those',
      s.settled === 4 && s.total === 110, `got ${s.settled}/${s.total}`);
    // hamburger beats donut 100% as player and donut never beats it, so hamburger is
    // (0.5*9 + 1)/10 = 0.55 in both roles and donut is 0.45 in both. Derivable by hand.
    ok('strength is (asPlayer + asAI)/2 and reads the table from both ends',
      Math.abs(s.perChar.hamburger.strength - 0.55) < 1e-12 && Math.abs(s.perChar.donut.strength - 0.45) < 1e-12,
      `hamburger ${s.perChar.hamburger.strength} donut ${s.perChar.donut.strength}`);
    const flat = {};
    for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) flat[`${a}>${b}`] = 0.5;
    const f = summarise(flat);
    ok('a perfectly flat table is sd 0.0pp, settled 0, and monotonic by definition',
      Math.abs(f.sd) < 1e-12 && f.settled === 0 && f.monotonic, `sd ${f.sd} settled ${f.settled}`);
  }

  arena = savedArena; driver = savedDriver;

  // ── B. THE CROSS-CHECK: reproduce a figure another tool already published ───
  //
  // `099119a` recorded, on the SHIPPED arena at 8 seeds with the fixed driver:
  // **smart2 27.2%, chase 18.8%**. Two independent tools, one shared driver, the same
  // seeds — so these must come out identical TO THE DIGIT, and if they do not, this
  // instrument is measuring something other than the game.
  //
  // ⚠️ MEASURED AGAINST A PINNED SIM, NOT THE WORKING TREE. The first version of this
  // check ran on the working tree and passed — until this pass changed `ai.ts` and
  // `ENEMY_MAX_HP`, at which point it read 54.1% and "failed". It was right to fail and
  // the check was wrong: a cross-check against a PUBLISHED number has to hold the sim at
  // the commit that published it, or it silently turns into a regression test on the
  // game and starts firing at every legitimate balance change. `docs/LESSONS.md` §5 —
  // freeze what you are comparing against. Extraction rather than checkout, because a
  // checkout would clobber every peer (and `git stash` is forbidden here).
  if (arena && !args['skip-crosscheck']) {
    const REF = '099119a';
    let dir = null;
    try {
      const sha = execFileSync('git', ['rev-parse', '--short', REF], { cwd: ROOT, encoding: 'utf8' }).trim();
      dir = join(tmpdir(), `fa-rosterlab-ref-${sha}`);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(join(dir, 'game'), { recursive: true });
      mkdirSync(join(dir, 'arena'), { recursive: true });
      for (const f of ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts']) {
        writeFileSync(join(dir, 'game', f), execFileSync('git', ['show', `${REF}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
      }
      writeFileSync(join(dir, 'arena', 'types.ts'), execFileSync('git', ['show', `${REF}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
    } catch (e) {
      dir = null;
      ok(`cross-check: could be pinned to ${REF}`, false, String(e).split('\n')[0]);
    }
    if (dir) {
      // Re-run THIS FILE against the extracted sim, so the cross-check exercises exactly
      // the code path a real measurement takes rather than a second copy of it.
      const out = execFileSync(process.execPath,
        [new URL(import.meta.url).pathname, '--seeds', '8', '--policies', 'smart2,chase', '--sim', join(dir, 'game')],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const grab = (name) => {
        const m = out.match(new RegExp(`POLICY ${name}[^\n]*aggregate player win (\\d+\\.\\d)%`));
        return m ? m[1] : null;
      };
      ok(`reproduces pacing_ladder.mjs @${REF} @8 seeds, smart2 27.2% (same driver, same seeds)`,
        grab('SMART2') === '27.2', `got ${grab('SMART2')}%`);
      ok('…and chase 18.8%', grab('CHASE') === '18.8', `got ${grab('CHASE')}%`);
    }
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// summary maths — pure, so --selftest can drive it with a hand-built table
// ─────────────────────────────────────────────────────────────────────────────
function summarise(matchupRates) {
  const perChar = {};
  for (const id of CHARACTER_IDS) {
    const asP = CHARACTER_IDS.filter((o) => o !== id).map((o) => matchupRates[`${id}>${o}`]);
    const asA = CHARACTER_IDS.filter((o) => o !== id).map((o) => 1 - matchupRates[`${o}>${id}`]);
    perChar[id] = {
      asPlayer: mean(asP), asAI: mean(asA), strength: (mean(asP) + mean(asA)) / 2,
      spreadPlayer: [Math.min(...asP), Math.max(...asP)],
      spreadAI: [Math.min(...asA), Math.max(...asA)],
      perEnemy: Object.fromEntries(CHARACTER_IDS.filter((o) => o !== id).map((o) => [o, matchupRates[`${id}>${o}`]])),
    };
  }
  const strengths = CHARACTER_IDS.map((id) => perChar[id].strength);
  const m = mean(strengths);
  const sd = Math.sqrt(mean(strengths.map((s) => (s - m) ** 2)));
  const cells = Object.values(matchupRates);
  const settled = cells.filter((r) => r >= 0.95 || r <= 0.05).length;

  const byRarity = {};
  for (const tier of RARITY_ORDER) {
    const ids = CHARACTER_IDS.filter((id) => CHARACTERS[id].rarity === tier);
    if (ids.length) byRarity[tier] = { n: ids.length, strength: mean(ids.map((id) => perChar[id].strength)), ids };
  }
  const tiers = RARITY_ORDER.filter((t) => byRarity[t]);
  let monotonic = true;
  for (let i = 1; i < tiers.length; i++) if (byRarity[tiers[i]].strength < byRarity[tiers[i - 1]].strength) monotonic = false;

  return { perChar, strengthMean: m, sd, settled, total: cells.length, byRarity, monotonic };
}

// ─────────────────────────────────────────────────────────────────────────────
// run
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const summary = {
  seeds: SEEDS, dt: DT, clockMs: MATCH_DURATION_MS,
  countdownMs: COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS,
  maxSafeRadius: arena.maxSafeRadius, simDir: SIM_DIR,
  roster: Object.fromEntries(CHARACTER_IDS.map((id) => [id, {
    rarity: CHARACTERS[id].rarity,
    hpPlayer: hpOf(id, 'player'), hpEnemy: hpOf(id, 'enemy'), speed: speedOf(id),
    stats: CHARACTERS[id].stats,
  }])),
  policies: {},
};
let nMatches = 0;

for (const policy of POLICIES) {
  const byMatchup = {};
  const rows = [];
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) {
        const r = runMatch(p, e, policy, s);
        rows.push(r); nMatches++;
        const k = `${p}>${e}`;
        (byMatchup[k] ??= { w: 0, n: 0 });
        byMatchup[k].n++;
        if (r.winner === 'player') byMatchup[k].w++;
      }
    }
  }
  const matchupRates = Object.fromEntries(Object.entries(byMatchup).map(([k, v]) => [k, v.w / v.n]));
  const s = summarise(matchupRates);
  const withContact = rows.filter((r) => r.contactPlayMs !== null);
  summary.policies[policy] = {
    n: rows.length,
    playerWinRate: rows.filter((r) => r.winner === 'player').length / rows.length,
    timeouts: rows.filter((r) => r.ending === 'timeout').length,
    unresolved: rows.filter((r) => r.ending === 'UNRESOLVED').length,
    meanPlayMs: mean(rows.map((r) => r.playMs)),
    meanSessionMs: mean(rows.map((r) => r.sessionMs)),
    meanContactSessionMs: mean(withContact.map((r) => r.contactSessionMs)),
    meanContactPlayMs: mean(withContact.map((r) => r.contactPlayMs)),
    neverContacted: rows.length - withContact.length,
    meanDutyCycle: mean(rows.map((r) => r.dutyCycle)),
    meanDealtPlayer: mean(rows.map((r) => r.dealt.player)),
    meanDealtEnemy: mean(rows.map((r) => r.dealt.enemy)),
    meanZonePlayer: mean(rows.map((r) => r.zone.player)),
    meanZoneEnemy: mean(rows.map((r) => r.zone.enemy)),
    matchupRates, ...s,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
const s3 = (ms) => `${(ms / 1000).toFixed(2)}s`;

console.log(`\n╔══ ROSTER LAB ══ ${nMatches} matches · ${SEEDS} seeds × 110 matchups × ${POLICIES.length} policies · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`║ sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`║ arena ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius} · clock ${MATCH_DURATION_MS / 1000}s · countdown ${(summary.countdownMs / 1000).toFixed(2)}s`);
console.log(`║ POOLS/SPEEDS the sim is using:`);
for (const id of CHARACTER_IDS) {
  const r = summary.roster[id];
  console.log(`║   ${id.padEnd(12)} ${r.rarity.padEnd(10)} hp ${String(r.hpPlayer).padStart(4)}/${String(r.hpEnemy).padStart(4)} (player/enemy) · speed ${r.speed.toFixed(4)} wu/ms · card d${r.stats.damage} h${r.stats.health} s${r.stats.speed}`);
}
console.log(`╚══════════════════════════════════════════════════════════════════════════`);

const baseline = args.baseline ? JSON.parse(readFileSync(String(args.baseline), 'utf8')) : null;
if (baseline && baseline.seeds !== SEEDS) {
  console.log(`  ⚠️  SEED COUNT DIFFERS (${baseline.seeds} vs ${SEEDS}) — the paired comparison is NOT paired. Re-run.`);
}

for (const policy of POLICIES) {
  const P = summary.policies[policy];
  const B = baseline?.policies?.[policy] ?? null;
  console.log(`\n══════ POLICY ${policy.toUpperCase()} ── ${P.n} matches · aggregate player win ${pct(P.playerWinRate)}${B ? `  (was ${pct(B.playerWinRate)}, ${pp(P.playerWinRate - B.playerWinRate)}pp)` : ''} ══════`);
  console.log(`  >> SETTLED MATCHUPS ${P.settled}/${P.total}${B ? `   was ${B.settled}/${B.total}  (${P.settled - B.settled >= 0 ? '+' : ''}${P.settled - B.settled})` : ''}   (one side wins >=95% or <=5% across all ${SEEDS} seeds)`);
  console.log(`  ${'character'.padEnd(12)}${'rarity'.padStart(11)}${'asPlayer'.padStart(10)}${'spread'.padStart(15)}${'asAI'.padStart(9)}${'spread'.padStart(15)}${'strength'.padStart(10)}${B ? '  Δstrength' : ''}`);
  const order = [...CHARACTER_IDS].sort((a, b) => P.perChar[b].strength - P.perChar[a].strength);
  for (const id of order) {
    const c = P.perChar[id];
    const d = B ? `  ${pp(c.strength - B.perChar[id].strength).padStart(9)}` : '';
    console.log(`  ${id.padEnd(12)}${CHARACTERS[id].rarity.padStart(11)}${pct(c.asPlayer).padStart(10)}${`${pct(c.spreadPlayer[0])}..${pct(c.spreadPlayer[1])}`.padStart(15)}` +
      `${pct(c.asAI).padStart(9)}${`${pct(c.spreadAI[0])}..${pct(c.spreadAI[1])}`.padStart(15)}${pct(c.strength).padStart(10)}${d}`);
  }
  const strengths = CHARACTER_IDS.map((id) => P.perChar[id].strength);
  console.log(`  ${'—'.padEnd(12)} roster strength mean ${pct(P.strengthMean)} · sd ${(P.sd * 100).toFixed(1)}pp${B ? ` (was ${(B.sd * 100).toFixed(1)}pp)` : ''} · range ${pct(Math.min(...strengths))}..${pct(Math.max(...strengths))} = ${((Math.max(...strengths) - Math.min(...strengths)) * 100).toFixed(1)}pp`);

  console.log(`  RARITY ROLL-UP (RARITY_ORDER, lowest -> highest) — MONOTONIC: ${P.monotonic ? 'YES' : 'NO'}`);
  console.log(`    ${RARITY_ORDER.filter((t) => P.byRarity[t]).map((t) => `${t} ${pct(P.byRarity[t].strength)}`).join('  ·  ')}`);

  console.log(`  PACING / SECOND-ORDER (declared on the same runs):`);
  console.log(`    first contact ${s3(P.meanContactSessionMs)} of session (${s3(P.meanContactPlayMs)} match clock) · play ${s3(P.meanPlayMs)} · session ${s3(P.meanSessionMs)} · duty ${pct(P.meanDutyCycle)}`);
  console.log(`    weapon+trail damage/match  player ${P.meanDealtPlayer.toFixed(1)} · enemy ${P.meanDealtEnemy.toFixed(1)}   ·  zone damage  player ${P.meanZonePlayer.toFixed(1)} · enemy ${P.meanZoneEnemy.toFixed(1)}`);
  console.log(`    timeouts ${P.timeouts}/${P.n} · unresolved ${P.unresolved} · never contacted ${P.neverContacted}`);

  if (B) {
    const ks = Object.keys(P.matchupRates);
    const dw = ks.map((k) => (P.matchupRates[k] ?? 0) - (B.matchupRates[k] ?? 0));
    const absw = dw.map(Math.abs);
    const moved = absw.filter((x) => x > 1e-9).length;
    console.log(`  PAIRED per-matchup deltas (same seeds, same matchups — EXACT, a different quantity from the aggregate):`);
    console.log(`    max |Δ| ${pp(Math.max(...absw))}pp · mean |Δ| ${pp(mean(absw))}pp · ${moved}/${ks.length} matchups moved at all`);
    if (moved === 0) console.log(`    ** every one of the ${ks.length} matchups is BIT-IDENTICAL. **`);
  }
}

console.log('');
if (args.json) { writeFileSync(String(args.json), JSON.stringify(summary, null, 2)); console.log(`wrote ${args.json}\n`); }
