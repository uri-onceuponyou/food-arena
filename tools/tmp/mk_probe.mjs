#!/usr/bin/env node
/**
 * MK_PROBE — MEDIKIT ACCOUNTING on real matches. What actually happens to the kits.
 *
 * ── The question no existing instrument answers ─────────────────────────────
 *
 * `roster_lab` / `roster_table` / `nf_ffa` all answer *"did the balance move"*, and they are
 * the right tools for that. None of them can answer the question that decides whether this
 * feature is a feature at all:
 *
 *   **DO THE KITS GET PICKED UP, AND BY WHOM?**
 *
 * That matters here more than it usually would, because `ai.ts` has shipped at least seven
 * instances of *a rule stated once in `rules.ts` and implemented for one seat only* — the
 * terrain slow (player 0.450000 / enemy 1.000000), the trail boost (1.35 / 1.00), the stun
 * that silenced only the bot, `self` weapons the AI could not select at all (0 fires across
 * 17,677 ticks). The last one of these to be found and fixed was worth a measured
 * **7.2 pp**. A consumable only the human collects is that shape again, and — unlike the
 * others — it would show up as the player being good at the game.
 *
 * ── 🚨 THE ONE CAVEAT, AND IT IS LARGE ENOUGH THAT THE TOOL PRINTS IT ───────
 *
 * **`tools/tmp/scripted_player.mjs` DOES NOT SEEK KITS**, and it must not be taught to: it
 * is the driver every published balance number in this repo is paired on, and changing it
 * bumps `DRIVER_REV` and invalidates all of them. So in the `--n 2` arm the HUMAN seat
 * collects a kit only by walking over one, while the bot seat is running the shipped
 * `ai.ts` and seeks them deliberately.
 *
 * → **The human column here is a LOWER BOUND and the bot column is the real thing.** A bot
 * share ABOVE the human share is therefore the expected, correct result, and it is the
 * result that says the AI understands kits. It is not evidence of a bot advantage in play.
 * Read `--arm no-ai-seek` beside it: that arm is what a bot that cannot see kits looks like,
 * and the difference between the two columns is the whole measurement.
 *
 * ── What is counted ─────────────────────────────────────────────────────────
 *
 *   dropped / taken / expired   the fate of every kit. `dropped == taken + expired + onFloor`
 *                               is asserted, so a leak cannot hide in a percentage.
 *   taken by controller         human seat vs AI seats.
 *   killer vs bystander         did the kit go to the fighter that made the kill, or to
 *                               somebody else? This is the SNOWBALL number: a mechanic that
 *                               only ever feeds the killer rewards winning a fight twice.
 *                               "Killer" is the `hit-landed` attacker on the fatal blow, so
 *                               a hazard/fog death has no killer and is excluded from the
 *                               split rather than counted as a bystander pickup.
 *   hp restored                 total and per match, against the pool it refilled.
 *   arm-over-arm                `--arm no-ai-seek` stages a sim whose bot cannot see kits.
 *
 *   node tools/tmp/mk_probe.mjs --n 6 --matches 60
 *   node tools/tmp/mk_probe.mjs --n 2 --seeds 8
 *   node tools/tmp/mk_probe.mjs --n 6 --matches 60 --arm no-ai-seek
 *   node tools/tmp/mk_probe.mjs --selftest
 */
import { readFileSync, existsSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

/**
 * THE ARMS. Each stages a full copy of `src/` with one asserted substitution — the same
 * discipline `wpx_knownbad`/`mk_knownbad` use, and for the same reason: an anchor that
 * silently stopped matching would stage the SHIPPED tree and the arm would report the
 * shipped numbers under a broken tree's name, which is the most expensive possible
 * outcome here because a null result is a normal one.
 */
const ARMS = {
  shipped: null,
  'no-ai-seek': {
    file: 'game/ai.ts',
    find: '    if (state.medikits.length === 0) return null;',
    repl: '    return null; // MK_PROBE ARM: the bot cannot see a kit',
  },
  'no-kits': {
    file: 'game/combat.ts',
    find: '  for (let i = 0; i < MEDIKIT.count; i++) {',
    repl: '  for (let i = 0; i < 0; i++) { // MK_PROBE ARM: nothing drops',
  },
};

function stageArm(name) {
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`mk_probe: no arm "${name}". Arms: ${Object.keys(ARMS).join(', ')}`);
  if (arm === null) return { dir: null, simDir: join(ROOT, 'src/game') };
  const dir = mkdtempSync(join(tmpdir(), `mkprobe-${name}-`));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  const path = join(dir, 'src', arm.file);
  const before = readFileSync(path, 'utf8');
  const hits = before.split(arm.find).length - 1;
  if (hits !== 1) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`mk_probe: arm "${name}" anchor matched ${hits} times in ${arm.file}, expected 1 — refusing to measure the shipped tree under a broken tree's name`);
  }
  writeFileSync(path, before.replace(arm.find, arm.repl));
  return { dir, simDir: join(dir, 'src/game') };
}

// ─────────────────────────────────────────────────────────────────────────────

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));

const ARM = String(args.arm ?? 'shipped');
const staged = stageArm(ARM);
const SIM_DIR = staged.simDir;
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, MEDIKIT, REACH, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY } = RULES;

// `arena.maxSafeRadius` is DERIVED from `MATCH_DURATION_MS` in `arena/shared.ts`, so a
// cached dump goes stale the moment the clock moves. Recomputed exactly as `roster_table`
// and `nf_ffa` recompute it — one formula, three callers.
const HALF_DIAG = Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2);
const FOG_FIRST_CONTACT_MS = 6000;
const arena = {
  ...ARENA_DATA,
  maxSafeRadius: Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
  build: () => null, update: () => {},
};

const DT = Number(args.dt ?? 16.667);
const N = Number(args.n ?? 6);
const MATCHES = Number(args.matches ?? 60);
const SEEDS = Number(args.seeds ?? 8);
const MAX_TICKS = Math.ceil((MATCH_DURATION_MS + 20_000) / DT);

const blank = () => ({
  matches: 0, deaths: 0, dropped: 0, taken: 0, expired: 0, onFloor: 0,
  takenBy: { human: 0, ai: 0 },
  takenByKiller: 0, takenByBystander: 0, takenAfterHazardDeath: 0,
  fallbacks: 0, coincident: 0,
  hpRestored: 0, poolSum: 0,
  survivorsSum: 0, wipes: 0, resolved: 0,
});

/**
 * Walk one finished match's event stream and account for every kit.
 *
 * ⚠️ THE KILLER IS THE ATTACKER ON THE `hit-landed` THAT PRECEDED THE `death`, not "whoever
 * was nearest". `DECISIONS §84` records that placement comes out of the DEATH EVENT STREAM
 * and not the final state, for the same reason: every dead fighter ends bit-identical, so
 * anything reconstructed from the end of a match is a guess.
 */
function account(events, state, acc) {
  const lastAttackerOf = new Map();     // slot -> slot that last damaged it with a weapon
  const kitSource = new Map();          // kit id -> the killer of the body it came from, or null
  const drops = [];                     // every drop, in order, so coincident PAIRS can be counted
  for (const e of events) {
    if (e.type === 'hit-landed' && e.source?.kind === 'weapon') lastAttackerOf.set(e.targetId, e.source.attackerId);
    else if (e.type === 'hit-landed') lastAttackerOf.set(e.targetId, null);
    else if (e.type === 'death') acc.deaths++;
    else if (e.type === 'medikit-dropped') {
      acc.dropped++;
      kitSource.set(e.id, lastAttackerOf.has(e.sourceId) ? lastAttackerOf.get(e.sourceId) : null);
      // THE COVER FALLBACK, COUNTED RATHER THAN ASSUMED. `combat.ts:dropMedikits` drops a
      // kit back onto the DEATH POINT when its bearing lands inside a cover box, so a kit
      // whose landing IS its origin is a fallback. This matters to the DESIGN and not only
      // to the code: the whole "two contestable pieces" argument rests on the pair landing
      // `2 x popDistance` apart, and every fallback collapses one of them onto the body.
      // The shipped arena carries 111 cover boxes, so it is a rate to know, not to guess.
      if (e.x === e.fromX && e.y === e.fromY) acc.fallbacks++;
      drops.push(e);
    } else if (e.type === 'medikit-taken') {
      acc.taken++;
      acc.hpRestored += e.amount;
      const f = state.fighters[e.fighterId];
      acc.takenBy[f.controller] = (acc.takenBy[f.controller] ?? 0) + 1;
      const killer = kitSource.get(e.id);
      if (killer === null || killer === undefined) acc.takenAfterHazardDeath++;
      else if (killer === e.fighterId) acc.takenByKiller++;
      else acc.takenByBystander++;
    }
  }
  // `expired` is DERIVED once at the end of a run, never accumulated here: a kit that is
  // still on the floor at the final tick is neither taken nor expired, and adding a
  // per-match difference of running totals would double-count every one of them.
  // A PAIR that lands on the SAME point is one stack, not two contestable pickups — the
  // cost the fallback trades for reachability. Counted per DEATH (consecutive pairs from
  // one source), not per kit.
  for (let i = 0; i + 1 < drops.length; i += 2) {
    const a = drops[i]; const b = drops[i + 1];
    if (a.sourceId === b.sourceId && a.x === b.x && a.y === b.y) acc.coincident++;
  }
  acc.onFloor += state.medikits.length;
}

function runMatch(configs) {
  const state = createMatch(arena, configs);
  const inputs = configs.map(() => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }));
  const events = [];
  let ticks = 0;
  while (state.phase !== 'ended' && ticks++ < MAX_TICKS) {
    for (const e of stepMatch(state, DT, inputs)) events.push(e);
  }
  return { state, events, ticks };
}

/** Cyclic roster selection — deterministic, and it visits every character evenly. */
function rosterFor(i, n) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(CHARACTER_IDS[(i * n + k) % CHARACTER_IDS.length]);
  return out;
}

function runFFA(n, matches) {
  const acc = blank();
  if (!Array.isArray(arena.spawns) || arena.spawns.length < n) {
    throw new Error(`mk_probe: the arena declares ${arena.spawns?.length ?? 0} spawns, need ${n}`);
  }
  for (let m = 0; m < matches; m++) {
    const ids = rosterFor(m, n);
    const configs = ids.map((characterId, id) => ({
      characterId, controller: 'ai',
      spawn: { x: arena.spawns[id].x, y: arena.spawns[id].y },
    }));
    const { state, events } = runMatch(configs);
    acc.matches++;
    if (state.phase === 'ended') acc.resolved++;
    const alive = state.fighters.filter((f) => f.alive).length;
    acc.survivorsSum += alive;
    if (alive === 0) acc.wipes++;
    acc.poolSum += state.fighters.reduce((s, f) => s + f.maxHp, 0);
    account(events, state, acc);
  }
  acc.expired = acc.dropped - acc.taken - acc.onFloor;
  return acc;
}

/**
 * The 1v1 arm: slot 0 is the SCRIPTED HUMAN, slot 1 is `ai.ts`. This is the arm that answers
 * "does the rule reach both seats", and its human column is a lower bound — see the header.
 */
async function runDuel(seeds) {
  const { createScriptedPlayer, rng } = await import('./scripted_player.mjs');
  const HAZ = (arena.hazards ?? []).find((h) => h.kind === 'damage') ?? null;
  const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, hazard: HAZ });
  const { POLICY_FNS, maxNormalRange, createDecisionLoop } = driver;
  const acc = blank();
  for (const playerId of CHARACTER_IDS) {
    for (const enemyId of CHARACTER_IDS) {
      if (playerId === enemyId) continue;
      for (let seed = 0; seed < seeds; seed++) {
        const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + 6);
        const state = createMatch(arena, playerId, enemyId);
        const decide = POLICY_FNS.smart2(rnd);
        const loop = createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
        const pReach = maxNormalRange(playerId), eReach = maxNormalRange(enemyId);
        const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);
        const events = [];
        let ticks = 0;
        // `loop.next(state, dt)` — the decision loop carries the countdown guard itself and
        // must not be called any other way. `engageRange` is bound into `decide` by the
        // policy, exactly as `roster_lab` does it; a second cadence written out here is how
        // five instruments came to share one stale driver.
        void engageRange;
        while (state.phase !== 'ended' && ticks++ < MAX_TICKS) {
          for (const e of stepMatch(state, DT, loop.next(state, DT))) events.push(e);
        }
        acc.matches++;
        if (state.phase === 'ended') acc.resolved++;
        const alive = state.fighters.filter((f) => f.alive).length;
        acc.survivorsSum += alive;
        if (alive === 0) acc.wipes++;
        acc.poolSum += state.fighters.reduce((s, f) => s + f.maxHp, 0);
        account(events, state, acc);
      }
    }
  }
  acc.expired = acc.dropped - acc.taken - acc.onFloor;
  return acc;
}

function report(label, a) {
  const pct = (x, d) => (d === 0 ? '  n/a' : `${((100 * x) / d).toFixed(1)}%`);
  console.log(`\n══ ${label} ══  ${a.matches} matches · arm ${ARM} · sim ${SIM_DIR === join(ROOT, 'src/game') ? 'working tree' : SIM_DIR}`);
  console.log(`  deaths                 ${a.deaths}  (${(a.deaths / a.matches).toFixed(2)} per match)`);
  console.log(`  kits dropped           ${a.dropped}  (expected ${a.deaths * MEDIKIT.count} = deaths x ${MEDIKIT.count})`);
  console.log(`  kits TAKEN             ${a.taken}  ${pct(a.taken, a.dropped)} of drops`);
  console.log(`  kits expired           ${a.expired}  ${pct(a.expired, a.dropped)}`);
  console.log(`  kits still on floor    ${a.onFloor}   (match ended under them)`);
  console.log(`  taken by HUMAN seat    ${a.takenBy.human ?? 0}`);
  console.log(`  taken by AI seats      ${a.takenBy.ai ?? 0}`);
  console.log(`  → to the KILLER        ${a.takenByKiller}  ${pct(a.takenByKiller, a.taken)} of pickups`);
  console.log(`  → to a BYSTANDER       ${a.takenByBystander}  ${pct(a.takenByBystander, a.taken)}`);
  console.log(`  → off a hazard/fog kill${String(a.takenAfterHazardDeath).padStart(4)}  ${pct(a.takenAfterHazardDeath, a.taken)}  (no killer to attribute to)`);
  console.log(`  cover fallbacks        ${a.fallbacks}  ${pct(a.fallbacks, a.dropped)} of drops landed back on the body`);
  console.log(`  coincident PAIRS       ${a.coincident}  ${pct(a.coincident, a.deaths)} of deaths left ONE stack, not two pickups`);
  console.log(`  HP restored            ${a.hpRestored.toFixed(1)}  = ${pct(a.hpRestored, a.poolSum)} of all HP seated`);
  console.log(`  mean survivors         ${(a.survivorsSum / a.matches).toFixed(3)}   wipes ${a.wipes}   resolved ${a.resolved}/${a.matches}`);
  // The accounting identity. A leak here means a kit was neither taken, nor expired, nor
  // left on the floor — i.e. the counters are lying, and every percentage above with it.
  const leak = a.dropped - (a.taken + a.expired + a.onFloor);
  console.log(`  accounting             ${leak === 0 ? 'BALANCED' : `LEAK ${leak}`}  (dropped = taken + expired + onFloor)`);
  return leak === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
  try {
    if (args.selftest) {
      let faults = 0;
      console.log('══ MK_PROBE SELFTEST ══');
      // 1. NON-EMPTY FIRST. A run that seated nothing would print a clean sheet of zeroes.
      const a = runFFA(6, 4);
      const okMatches = a.matches === 4 && a.deaths > 0 && a.dropped > 0;
      if (!okMatches) faults++;
      console.log(`  ${okMatches ? 'PASS' : 'FAULT'}  the fixture actually RAN and actually KILLED — ${a.matches} matches, ${a.deaths} deaths, ${a.dropped} kits`);
      // 2. Every death drops exactly `count`. If this ever disagrees the accounting below
      //    is measuring something other than the mechanic.
      const okDrops = a.dropped === a.deaths * MEDIKIT.count;
      if (!okDrops) faults++;
      console.log(`  ${okDrops ? 'PASS' : 'FAULT'}  drops == deaths x MEDIKIT.count (${a.dropped} vs ${a.deaths * MEDIKIT.count})`);
      // 3. The identity holds.
      const okBal = a.dropped === a.taken + a.expired + a.onFloor;
      if (!okBal) faults++;
      console.log(`  ${okBal ? 'PASS' : 'FAULT'}  accounting identity balances`);
      // 4. KNOWN-BAD ON THE STAGER. An anchor that no longer matches must THROW, not
      //    quietly measure the shipped tree — the failure that would make every arm
      //    comparison read "no difference".
      let threw = false;
      try { stageArm('__nonexistent__'); } catch { threw = true; }
      if (!threw) faults++;
      console.log(`  ${threw ? 'PASS' : 'FAULT'}  an unknown arm is REFUSED`);
      let threw2 = false;
      const save = ARMS['no-ai-seek'].find;
      ARMS['no-ai-seek'].find = 'text that appears nowhere in ai.ts at all';
      try { stageArm('no-ai-seek'); } catch { threw2 = true; }
      ARMS['no-ai-seek'].find = save;
      if (!threw2) faults++;
      console.log(`  ${threw2 ? 'PASS' : 'FAULT'}  a DRIFTED anchor is REFUSED rather than measuring the shipped tree`);
      // 5. …and the real anchors still match exactly once, right now.
      for (const name of Object.keys(ARMS)) {
        if (ARMS[name] === null) continue;
        let ok = true;
        try { const t = stageArm(name); if (t.dir) rmSync(t.dir, { recursive: true, force: true }); } catch { ok = false; }
        if (!ok) faults++;
        console.log(`  ${ok ? 'PASS' : 'FAULT'}  arm "${name}" stages cleanly`);
      }
      console.log(faults > 0 ? `\n  ${faults} FAULT(S)` : '\n  OK');
      process.exit(faults > 0 ? 1 : 0);
    }

    const acc = N === 2 ? await runDuel(SEEDS) : runFFA(N, MATCHES);
    const balanced = report(N === 2 ? `MK_PROBE  1v1 (scripted human vs ai.ts) x ${SEEDS} seeds` : `MK_PROBE  ${N}-SEAT FFA (all ai.ts)`, acc);
    if (N === 2) {
      console.log('\n  ⚠️  THE HUMAN COLUMN IS A LOWER BOUND: `scripted_player.mjs` does not seek kits and');
      console.log('      must not be taught to — it is the driver every published balance number here is');
      console.log('      paired on. Compare the AI column against `--arm no-ai-seek`, not against the human.');
    }
    if (args.json) writeFileSync(String(args.json), JSON.stringify(acc, null, 2));
    process.exit(balanced ? 0 : 1);
  } finally {
    if (staged.dir) rmSync(staged.dir, { recursive: true, force: true });
  }
}
