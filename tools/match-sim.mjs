#!/usr/bin/env node
/**
 * MATCH DRIVER — part 1 of 2: the pacing instrument.
 *
 * Drives COMPLETE matches through the real `src/game/sim.ts` against the real
 * arena layout, with a scripted player at the controls, and reports pacing rather
 * than a single frozen instant. This is the half of "play a whole match" that can
 * be answered with numbers: how long a fight lasts, how much of the 180 s is spent
 * walking, whether the retuned ranges leave a gap, what the closing fog actually
 * does to the last minute, and whether the AI produces a fight or a stall.
 *
 * ── Why Node and not the browser ───────────────────────────────────────────
 * The simulation is pure and Node imports `src/game/*.ts` directly (see
 * `sim.test.mjs`). Only the ARENA needs a browser, because `kitchen.ts` builds
 * Three.js geometry eagerly — so its gameplay half is dumped once by
 * `tools/arena-dump.html` into `tools/arena.gameplay.json` and reused. That makes a
 * full 180 s match cost ~20 ms instead of ~6 minutes of SwiftShader, so pacing can
 * be measured over hundreds of matches and all 11 characters instead of one run.
 *
 * The visual half — legibility, fog readability, whether you can find yourself —
 * cannot be answered here and is `tools/match-play.mjs`.
 *
 * ── Honest limits ──────────────────────────────────────────────────────────
 *   * The scripted player is not a human. It has perfect information, aims
 *     perfectly, and reacts on a fixed `--react` cadence. Treat its numbers as the
 *     SHAPE of the match (how long, how much walking, when the squeeze bites), not
 *     as a skill benchmark.
 *   * `--dt 16.67` models 60 fps. The shipped loop clamps dt at 50 ms, so a real
 *     low-fps client simulates the SAME match time in fewer, coarser steps; nothing
 *     here measures frame time and nothing here should be read as performance.
 *
 * ── Use ────────────────────────────────────────────────────────────────────
 *   URL=$(node tools/snapshot.mjs --json | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])")
 *   node tools/match-sim.mjs --refresh-arena --url $URL     # once, caches the arena
 *   node tools/match-sim.mjs                                 # default matchup
 *   node tools/match-sim.mjs --player sushi --enemy lollipop --policy smart
 *   node tools/match-sim.mjs --all-matchups                  # 11x11 sweep
 *   node tools/match-sim.mjs --trace shots/match/trace.json  # full sample trace
 *   node tools/match-sim.mjs --policy idle                   # what the AI does to a statue
 *   node tools/match-sim.mjs --selftest                      # known-input validation, no browser
 *   node tools/match-sim.mjs --sim-ref HEAD --all-matchups    # measure a FROZEN sim
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ARENA_CACHE = `${ROOT}/tools/arena.gameplay.json`;

/**
 * ── `--sim-ref <ref>`: measure a FROZEN sim ────────────────────────────────
 *
 * Every number this tool prints is a function of `src/game/**`, and this project runs
 * up to six agents at once — `rules.ts` and `combat.ts` are routinely half-edited by a
 * peer while a pacing sweep is running. `docs/LESSONS.md` §5 records the render-side
 * version of this ("measurement contamination is a separate problem from write
 * conflicts"); it applies just as hard to a pure-Node instrument, and there is no
 * `snapshot.mjs` for an `import`.
 *
 * So: `--sim-ref HEAD` copies the six sim modules out of git into the OS temp dir and
 * imports THOSE. `git stash` is forbidden here and a checkout would clobber five peers,
 * so extraction is the only safe freeze. Writing outside the repo is deliberate — a
 * scratch tree of `.ts` files under `tools/` is inside `tsconfig.json`'s include and
 * turns `npx tsc --noEmit` red for everyone at once (see `nav_baseline_setup.mjs`).
 *
 * Default (no flag) is the working tree, i.e. the historical behaviour.
 */
function extractSimAt(ref) {
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = join(tmpdir(), `fa-simref-${sha}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'game'), { recursive: true });
  mkdirSync(join(dir, 'arena'), { recursive: true });
  for (const f of ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts']) {
    writeFileSync(join(dir, 'game', f), execFileSync('git', ['show', `${ref}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
  }
  writeFileSync(join(dir, 'arena', 'types.ts'), execFileSync('git', ['show', `${ref}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
  return { dir: join(dir, 'game'), sha };
}

const SIM_REF = process.argv.includes('--sim-ref')
  ? String(process.argv[process.argv.indexOf('--sim-ref') + 1] ?? 'HEAD')
  : null;
const SIM = SIM_REF ? extractSimAt(SIM_REF) : { dir: `${ROOT}/src/game`, sha: 'working tree' };

const { createMatch, stepMatch } = await import(`${SIM.dir}/sim.ts`);
const RULES = await import(`${SIM.dir}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, PLAYER_SPEED,
  HIT_RADIUS_VS_ENEMY, HIT_RADIUS_VS_PLAYER, FOG_DAMAGE, FOG_TICK_MS,
} = RULES;

// ─────────────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────────────

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

const DT = Number(args.dt ?? 16.667);
const REACT_MS = Number(args.react ?? 150);
const SAMPLE_MS = Number(args.sample ?? 100);
const POLICY = String(args.policy ?? 'smart');
const RUNS = Number(args.runs ?? 1);

// ─────────────────────────────────────────────────────────────────────────────
// arena
// ─────────────────────────────────────────────────────────────────────────────

async function refreshArena(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
    await page.goto(`${url}/tools/arena-dump.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__arenaReady === true, null, { timeout: 90000 });
    const err = await page.evaluate(() => window.__arenaError ?? null);
    if (err) throw new Error(`arena build failed in page:\n${err}`);
    const dump = await page.evaluate(() => window.__arenaDump);
    mkdirSync(dirname(ARENA_CACHE), { recursive: true });
    writeFileSync(ARENA_CACHE, JSON.stringify(dump, null, 2));
    console.error(`arena cached -> ${ARENA_CACHE} (${dump.cover.length} cover, ${dump.hazards.length} hazards)`);
    return dump;
  } finally {
    await browser.close();
  }
}

if (args['refresh-arena']) {
  const url = args.url ?? process.env.PREVIEW_BASE;
  if (!url) { console.error('--refresh-arena needs --url <snapshot url>'); process.exit(1); }
  await refreshArena(String(url).replace(/\/$/, ''));
}

/** `--layout <path>` reads any dumped arena JSON instead of the shared cache. Needed to
 *  ask "how much of this number is the LAYOUT?" — see `tools/tmp/policy_sensitivity.mjs`,
 *  which is what re-tested the conclusions drawn from the broken policy. */
const LAYOUT_PATH = typeof args.layout === 'string' ? resolve(String(args.layout)) : ARENA_CACHE;

if (!existsSync(LAYOUT_PATH) && !args.selftest) {
  console.error(`No arena cache. Run once with:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const ARENA_DATA = existsSync(LAYOUT_PATH) ? JSON.parse(readFileSync(LAYOUT_PATH, 'utf8')) : null;

/** The sim only ever calls `arena.build()`/`arena.update()` from the RENDERER, never
 *  from `stepMatch`, so a data-only arena is a complete input for the simulation.
 *
 *  `let`, not `const`, for exactly one reason: `--selftest` swaps in a synthetic arena
 *  whose correct answer is derivable with a calculator. The policies close over this
 *  binding, so swapping it is what lets the SHIPPED policy code be the thing under test
 *  rather than a copy of it — `docs/LESSONS.md` §13's "validate the instrument against a
 *  known input" is worth nothing if the validated copy is not the one that runs. */
let arena = ARENA_DATA ? { ...ARENA_DATA, build: () => null, update: () => {} } : null;

let POT = arena ? arena.hazards.find((h) => h.kind === 'damage') : null;
const POT_DPS = POT ? (POT.damage / POT.tickMs) * 1000 : 0;
const FOG_DPS = (FOG_DAMAGE / FOG_TICK_MS) * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
/** Longest reach EXCLUDING the map-wide ultimate, which is not a positioning range. */
const maxNormalRange = (id) =>
  Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= RULES.REACH.rangedMax).map((w) => w.range ?? 0), 0);

/** The reach of the weapon a player actually wants to be using — the highest-damage
 *  one. This, not the longest reach, is the distance a real player fights at. */
function preferredRange(id) {
  const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= RULES.REACH.rangedMax);
  if (!ws.length) return maxNormalRange(id);
  return ws.reduce((best, w) => ((w.damage ?? 0) > (best.damage ?? 0) ? w : best)).range ?? 0;
}

function blockedByCover(x, y, size, cover) {
  const h = size / 2;
  return cover.some((c) =>
    Math.abs(x - c.x) < h + c.w / 2 && Math.abs(y - c.y) < h + c.h / 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// player policies — the "hands" on the controls
// ─────────────────────────────────────────────────────────────────────────────
//
// Each returns { move:{x,y}, aim:{x,y}, selectedWeapon, attack }. `move` axes are
// independently in [-1,1] exactly like WASD (sim.ts does NOT normalise them, so
// diagonals are faster — the scripted player inherits the same quirk a human does).

function axesToward(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const nx = dx / m;
  const ny = dy / m;
  // Quantise to the 8 directions a keyboard can actually express.
  const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
  return { x: q(nx), y: q(ny) };
}

function bestWeapon(state, d) {
  const p = state.player;
  const ws = CHARACTERS[p.characterId].weapons;
  let best = null;
  let bestDmg = -Infinity;
  ws.forEach((w, i) => {
    if (w.type === 'self') return;
    if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
    if (d > (w.range ?? Infinity)) return;
    const dmg = w.damage ?? 0;
    if (dmg > bestDmg) { bestDmg = dmg; best = i; }
  });
  return best;
}

/**
 * Walk toward a point the way a person does: straight at it, and when the wall says
 * no, sidestep and keep sidestepping until the wall is behind you.
 *
 * This exists because `sim.ts` gives the PLAYER raw per-axis `tryMove` — no
 * path-finding, no wall-rounding. The AI gets `moveToward`'s detour logic; a human
 * gets eyes. A scripted player with neither would just press into the first barrel
 * it meets (the supply barrel at (250,500) sits directly on the straight line from
 * the player spawn to the enemy spawn), and every pacing number would be measuring
 * that, not the game.
 */
function makeNav({ countdownStuckBug = false } = {}) {
  /** Positions over the last ~1.5 s. NET displacement, not per-tick movement, is the
   *  right stuck test: a fighter pinned on a corner still jitters, and a per-tick
   *  test reads that as walking. (This is the same mistake `movement.ts:moveToward`
   *  documents having made — worth knowing it bites the measuring instrument too.) */
  const hist = [];
  let detourUntil = -1;
  let detourSign = 1;

  return function walk(state, targetX, targetY) {
    const p = state.player;

    /**
     * ── FIXED 2026-08-05: the stuck detector used to run during the COUNTDOWN ──
     *
     * `sim.ts:movePlayer` is only called while `phase === 'playing'`, so for the first
     * ~5.7 s of every match the player is motionless BY CONSTRUCTION. The detector saw
     * "1.5 s of walking has covered 0 wu", concluded it was jammed, and fired — four
     * times before the whistle, in a measured trace — leaving the match to start with
     * up to 900 ms of the 150 wu perpendicular detour still latched.
     *
     * Cost: on the selftest arena, where the correct closure is exactly 5283 ms, the
     * player instead arrived at 5867 ms having drifted 58 wu sideways. Every
     * time-to-contact figure this tool has ever printed carried that 0-900 ms of
     * sideways walking, with the sign set by a coin-flip on countdown length — which is
     * part of why the same route length could score 8.8 s and 15.1 s.
     *
     * A stuck detector must only run while movement is possible. This is the same class
     * of fault as the `smart` ordering bug below: the code was right about WHAT to
     * detect and wrong about WHEN, and the number stayed plausible throughout.
     */
    if (!countdownStuckBug && state.phase !== 'playing') {
      hist.length = 0; detourUntil = -1;
      return axesToward(p.x, p.y, targetX, targetY);
    }

    hist.push({ t: state.elapsed, x: p.x, y: p.y });
    while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();

    if (state.elapsed > detourUntil && hist.length > 4 && state.elapsed - hist[0].t > 1200) {
      const net = Math.hypot(p.x - hist[0].x, p.y - hist[0].y);
      if (net < 45) {                     // ~1.5 s of walking should cover ~180 wu
        detourSign = -detourSign;
        detourUntil = state.elapsed + 900;
        hist.length = 0;
      }
    }

    let tx = targetX, ty = targetY;
    if (state.elapsed < detourUntil) {
      const ang = Math.atan2(targetY - p.y, targetX - p.x) + detourSign * (Math.PI / 2);
      tx = p.x + Math.cos(ang) * 150;
      ty = p.y + Math.sin(ang) * 150;
    }
    return axesToward(p.x, p.y, tx, ty);
  };
}

/** Is there a clear firing line? Same 12x12-vs-CoverBox test `stepProjectiles` runs. */
function lineOfSight(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / 4));
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    if (arena.cover.some((o) => Math.abs(x - o.x) < (12 + o.w) / 2 && Math.abs(y - o.y) < (12 + o.h) / 2)) return false;
  }
  return true;
}

/**
 * ═══ POLICY REVISION 2 — READ THIS BEFORE COMPARING ANY NUMBER ═══════════════
 *
 * **Every `policy=smart` figure recorded before 2026-08-05 is SUPERSEDED and must not
 * be compared with anything this file prints now.** The old behaviour is preserved
 * verbatim under `smart-losfirst` so any historical number can be reproduced, but it
 * is a broken instrument and it prints a warning when selected.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 * `smart` tested LINE OF SIGHT BEFORE RANGE. Its own comment says what the clause was
 * for — *"In range but shooting a counter. A player flanks; they do not stand there
 * emptying cooldowns into furniture."* — and the words "in range" were never enforced,
 * because the test ran ahead of the range test. Across 1080 wu of a map carrying 27
 * CoverBoxes something is nearly always in the line, so the branch fired at ANY
 * distance and the scripted player answered "I cannot shoot yet" with "then walk
 * sideways", forever.
 *
 * Measured on the committed layout (`tools/tmp/policy_trace.mjs --all`, 110 matchups,
 * 12,608 decision ticks):
 *
 *              branch          LOS-first (shipped)   range-first (this file)
 *              STRAFE-noLOS         45.1%                 0.02%
 *              CLOSE                30.2%                70.3%
 *
 * Nearly half of every decision the "player" made was a refusal to approach, so
 * `timeToContact` was not measuring a closure — it was measuring how long the refusal
 * happened to last. Against the straight-line floor `(spawnGap - engageRange) /
 * (PLAYER_SPEED + AI_CHASE_SPEED)`, rev 1 lands at **1.39x** and rev 2 at **1.08x**;
 * the corrected player closes at ~93% of the geometric best, which is what a
 * closure-time metric is supposed to look like.
 *
 * ── Two things on record that this does NOT support ─────────────────────────
 * 60c5b92's commit message says the figure is "AI route / AI_CHASE_SPEED, the enemy
 * walking alone at 70 wu/s; the combined 190 wu/s is 2.7x optimistic", and that the
 * player is in STRAFE-noLOS "for the ENTIRE match". Neither reproduces here.
 * Re-measured on the layouts as committed:
 *
 *              STRAFE-noLOS share    contact vs both-moving floor
 *   pre-60c5b92 layout    63.1%              (11.1 s vs 10.0 s corrected)
 *   committed layout      45.1%              1.39x  ->  1.08x corrected
 *
 * At 1.39x of the BOTH-moving floor, rev 1 is closing at ~137 wu/s, not 70 — the broken
 * player still drifts toward the enemy because the strafe direction rotates as the
 * bearing changes. So the defect is real and worth fixing, and the error it caused in
 * time-to-contact is **23-29%, not 170%**. Recorded verbatim because "take the symptom,
 * re-derive the cause" (`docs/LESSONS.md` §3) applies to magnitudes too, and a peer
 * planning around a 2.7x correction would over-correct by a factor of six.
 *
 * ── The fix, and why it is not "make the AI better" ─────────────────────────
 * ONE clause moved: the range test now runs in front of the LOS test, so the player
 * closes while it has no shot and only flanks once it is IN RANGE and blocked — which
 * is what the comment always claimed. Nothing else about the policy changed. The
 * header's framing stands: this is the SHAPE of a match, not a skill benchmark. But a
 * scripted player that strafes forever is not a conservative model of a human, it is a
 * broken one, and `docs/LESSONS.md` §13 is explicit that an instrument reporting a
 * plausible wrong number is worse than no instrument.
 *
 * ── Why `smart` was fixed in place rather than renamed ──────────────────────
 * `--policy` DEFAULTS to `smart`. Leaving the broken policy on the default means every
 * future run, by anyone who does not know this file, silently produces the wrong
 * number — which is exactly how the last five bad instruments survived. So the default
 * name carries the corrected behaviour, `POLICY_REV` is stamped into every report and
 * every JSON record so a stale figure can be identified mechanically, and the old
 * behaviour stays reachable by name for reproduction.
 *
 * ── A SECOND defect, found by the validation and not by reading the code ────
 * See `makeNav` above: the stuck detector also ran during the COUNTDOWN, when the player
 * cannot move at all, so every match began with up to 900 ms of latched sideways
 * walking. It is fixed in rev 2 as well, and `smart-navfix` isolates it — rev 1 misses
 * the derived closure by 567 ms on a CLEAR line, where the LOS clause cannot fire.
 *
 * Validated by `--selftest`: a synthetic arena on which the correct closure is 5283 ms
 * by arithmetic. Rev 2 reports 5350 ms (one sampler period late, which is the floor);
 * rev 1 reports 5850 ms with a clear line and 12050 ms with a blocked one.
 */
const POLICY_REV = 2;

function makeChase({ countdownStuckBug }) {
  const nav = makeNav({ countdownStuckBug });
  return (state) => {
    const p = state.player, e = state.enemy;
    const d = dist(p.x, p.y, e.x, e.y);
    const w = bestWeapon(state, d);
    return {
      move: nav(state, e.x, e.y),
      aim: { x: e.x - p.x, y: e.y - p.y },
      selectedWeapon: w ?? 0,
      attack: true,
    };
  };
}

/** The decision tree shared by `smart` (rev 2) and `smart-losfirst` (rev 1). */
function makeSmart({ losBeforeRange, countdownStuckBug }) {
  const nav = makeNav({ countdownStuckBug });
  return (state) => {
    const p = state.player, e = state.enemy;
    const d = dist(p.x, p.y, e.x, e.y);
    const idx = bestWeapon(state, d);
    const band = preferredRange(p.characterId) * 0.85;
    const los = lineOfSight(p.x, p.y, e.x, e.y);

    const cx = arena.center.x, cy = arena.center.y;
    const dc = dist(p.x, p.y, cx, cy);
    const R = state.safeRadius;

    /** In range but shooting a counter: flank, don't empty cooldowns into furniture. */
    const flank = () => {
      const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
      return { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
    };

    let target;
    // 1. Ring first: get inside, with margin, before anything else.
    if (dc > R - 30) {
      target = { x: cx, y: cy };
      // 2. …but if the safe disc has shrunk INSIDE the pot's danger ring there is
      //    nowhere safe left; sit on the least-bad radius (just inside the ring).
      if (POT && R < POT.radius + 20) {
        const ang = Math.atan2(p.y - cy, p.x - cx);
        const r = Math.max(0, R - 10);
        target = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
      }
    } else if (POT && dist(p.x, p.y, POT.x, POT.y) < POT.radius + 15 && R > POT.radius + 40) {
      // 3. Standing in the boiling pot with somewhere better to be: leave.
      const ang = Math.atan2(p.y - POT.y, p.x - POT.x);
      target = { x: POT.x + Math.cos(ang) * (POT.radius + 60), y: POT.y + Math.sin(ang) * (POT.radius + 60) };
    } else if (losBeforeRange && !los) {
      target = flank();                                   // ← REV 1's defect, kept verbatim
    } else if (d > band) {
      target = { x: e.x, y: e.y };                        // close
    } else if (!los) {
      target = flank();                                   // ← REV 2: in range AND blocked
    } else if (d < band * 0.5) {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);       // back off
      target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
    } else {
      const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;  // strafe
      target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
    }

    return {
      move: nav(state, target.x, target.y),
      aim: { x: e.x - p.x, y: e.y - p.y },
      selectedWeapon: idx ?? 0,
      // Don't spend cooldowns on shots that cannot reach OR cannot arrive — a
      // player watching a weapon slot grey out for nothing learns that in one match.
      attack: idx !== null && (los || CHARACTERS[p.characterId].weapons[idx].type === 'melee'),
    };
  };
}

const POLICIES = {
  /** Nothing at all. The control: what does the AI do to a target that never acts? */
  idle: () => () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }),

  /** Run at the enemy and hold fire. The naive human's first 30 seconds. */
  chase: () => makeChase({ countdownStuckBug: false }),

  /**
   * ABLATION. `chase` has no line-of-sight clause, so the policy reorder does not touch
   * it — but it shares `makeNav`, so the countdown-detour fix DOES. Every recorded
   * `chase` figure (60c5b92's "pot share 25%, naive win rate 39.1%", which is what chose
   * the 110 wu spawn offset) was taken with that detour live. This reproduces them.
   */
  'chase-navbug': () => makeChase({ countdownStuckBug: true }),

  /**
   * Play it properly: hold the range band of the best available weapon, respect the
   * closing ring, and don't stand in the pot unless the ring leaves nowhere else.
   * REV 2 — see the block comment above.
   */
  smart: () => makeSmart({ losBeforeRange: false, countdownStuckBug: false }),

  /**
   * REV 1, verbatim — BOTH defects, so this reproduces the instrument exactly as it was
   * when every recorded figure was taken. Here ONLY so a pre-2026-08-05 number can be
   * reproduced and shown to be what it is. Do not steer by it.
   */
  'smart-losfirst': () => makeSmart({ losBeforeRange: true, countdownStuckBug: true }),

  /**
   * ABLATION, not a policy anyone should steer by: rev 1's decision ordering with only
   * the countdown-detour fixed. Exists so the before/after table can attribute each
   * headline movement to one of the two defects instead of to "the fix" as a lump.
   */
  'smart-navfix': () => makeSmart({ losBeforeRange: true, countdownStuckBug: false }),
};

/** Which revision each policy name IS, so a stale record is identifiable mechanically. */
const POLICY_REV_OF = { smart: 2, 'smart-losfirst': 1, 'smart-navfix': 1.5, chase: 2, 'chase-navbug': 1, idle: 2 };

// ─────────────────────────────────────────────────────────────────────────────
// one match
// ─────────────────────────────────────────────────────────────────────────────

function runMatch({ player, enemy, policy = POLICY, dt = DT, reactMs = REACT_MS, sampleMs = SAMPLE_MS, keepTrace = false, beforeTick = null }) {
  const state = createMatch(arena, player, enemy);
  const makePolicy = POLICIES[policy];
  if (!makePolicy) throw new Error(`unknown policy "${policy}" (have: ${Object.keys(POLICIES).join(', ')})`);
  const decide = makePolicy();

  const samples = [];
  const events = [];
  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let sinceDecision = Infinity;
  let sinceSample = Infinity;

  const pReach = maxNormalRange(player);
  const eReach = maxNormalRange(enemy);
  /** "Someone could land a hit right now", the honest definition of engaged. */
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  let playerTravel = 0;
  let enemyTravel = 0;
  let ticks = 0;
  const HARD_CAP_MS = MATCH_DURATION_MS + 120_000; // detect "the clock ran out and nothing happened"

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP_MS) {
    // `--selftest` uses this to pin and immortalise the opponent, so a closure time can
    // be derived on paper. Null in every ordinary run; deliberately the ONLY seam, so
    // the policy and sampling code under test are byte-identical to the shipped path.
    if (beforeTick) beforeTick(state);
    if (sinceDecision >= reactMs) { input = decide(state, sinceDecision === Infinity ? dt : sinceDecision); sinceDecision = 0; }
    const px0 = state.player.x, py0 = state.player.y, ex0 = state.enemy.x, ey0 = state.enemy.y;

    const evs = stepMatch(state, dt, input);
    ticks++;
    for (const ev of evs) events.push({ t: state.elapsed, ...ev });

    playerTravel += Math.hypot(state.player.x - px0, state.player.y - py0);
    enemyTravel += Math.hypot(state.enemy.x - ex0, state.enemy.y - ey0);
    sinceDecision += dt;
    sinceSample += dt;

    if (sinceSample >= sampleMs) {
      sinceSample = 0;
      const p = state.player, e = state.enemy;
      const d = dist(p.x, p.y, e.x, e.y);
      samples.push({
        t: Math.round(state.elapsed),
        // The MATCH CLOCK, i.e. time since the whistle. `t` (elapsed) carries the
        // countdown as well, so the two differ by ~5.7 s and a figure quoted without
        // saying which is being used is unusable. Both are reported for that reason.
        play: Math.round(MATCH_DURATION_MS - state.timeRemaining),
        rem: Math.round(state.timeRemaining),
        phase: state.phase,
        R: +state.safeRadius.toFixed(1),
        px: +p.x.toFixed(1), py: +p.y.toFixed(1), php: p.hp,
        ex: +e.x.toFixed(1), ey: +e.y.toFixed(1), ehp: e.hp,
        d: +d.toFixed(1),
        pOut: dist(p.x, p.y, arena.center.x, arena.center.y) > state.safeRadius,
        eOut: dist(e.x, e.y, arena.center.x, arena.center.y) > state.safeRadius,
        pPot: POT ? dist(p.x, p.y, POT.x, POT.y) < POT.radius : false,
        ePot: POT ? dist(e.x, e.y, POT.x, POT.y) < POT.radius : false,
        proj: state.projectiles.length,
        eng: d <= engageRange,
        // Guaranteed-visible square, `render/camera.ts:FAIR_PLAY.radiusUnits` = 199.2wu
        // half-extent centred on the player. Outside it the opponent MAY be off screen
        // depending on aspect ratio — so this is "how often you cannot see who you are
        // fighting", the legibility question stated as geometry.
        offFair: Math.abs(p.x - e.x) > 199.2 || Math.abs(p.y - e.y) > 199.2,
      });
    }
  }

  // ── derive ────────────────────────────────────────────────────────────────
  const playing = samples.filter((s) => s.phase === 'playing');
  const frac = (pred) => (playing.length ? playing.filter(pred).length / playing.length : 0);

  const hits = events.filter((e) => e.type === 'hit-landed');
  const fires = events.filter((e) => e.type === 'weapon-fired');

  // ── Where shots go to die ────────────────────────────────────────────────
  // `sim.ts` tags every projectile removal with a reason. Aggregated, this answers
  // a question the range retune raised and nobody has measured: at reaches of
  // 98-140wu inside an arena carrying 26 cover boxes, how much of the player's
  // output is eaten by scenery, and how much simply falls short?
  const spawnOwner = new Map();
  for (const e of events) if (e.type === 'projectile-spawned') spawnOwner.set(e.id, e.ownerRole);
  const shotFate = { player: { 'hit-target': 0, 'hit-cover': 0, expired: 0 }, enemy: { 'hit-target': 0, 'hit-cover': 0, expired: 0 } };
  for (const e of events) {
    if (e.type !== 'projectile-destroyed') continue;
    const owner = spawnOwner.get(e.id);
    if (owner && shotFate[owner][e.reason] !== undefined) shotFate[owner][e.reason]++;
  }
  const firstHit = hits.length ? hits[0].t : null;
  const dmgBySource = {};
  for (const h of hits) {
    const k = h.source.kind;
    dmgBySource[k] = (dmgBySource[k] ?? 0) + h.amount;
  }
  const dmgToPlayerBySource = {};
  for (const h of hits.filter((h) => h.targetRole === 'player')) {
    const k = h.source.kind;
    dmgToPlayerBySource[k] = (dmgToPlayerBySource[k] ?? 0) + h.amount;
  }

  // Time from the whistle to the first moment either fighter could reach the other,
  // and time from the first damage to the decision. Those two numbers ARE the pacing:
  // one is how long you walk, the other is how long the game is a game.
  const firstContact = playing.find((s) => s.eng);
  const timeToContactMs = firstContact ? firstContact.t : null;
  const timeToContactPlayMs = firstContact ? firstContact.play : null;
  const ttkMs = firstHit !== null ? state.elapsed - firstHit : null;

  const ended = state.phase === 'ended';
  const matchMs = state.elapsed;
  const playMs = MATCH_DURATION_MS - state.timeRemaining;

  // ── AI stall detector ─────────────────────────────────────────────────────
  // "The enemy is out of its own reach of the player, so it should be closing —
  // and it has not moved 15wu in three seconds." That is a deadlock, not a tactic.
  // Named separately from `deadFrac` because the two have different owners:
  // dead time is pacing (rules/arena), a stall is a movement bug.
  const win = Math.max(1, Math.round(3000 / sampleMs));
  let stalledSamples = 0;
  let longestStallMs = 0;
  let runMs = 0;
  for (let i = win; i < playing.length; i++) {
    const w = playing.slice(i - win, i + 1);
    const xs = w.map((s) => s.ex), ys = w.map((s) => s.ey);
    const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const shouldBeClosing = w[w.length - 1].d > eReach + HIT_RADIUS_VS_PLAYER;
    if (span < 15 && shouldBeClosing) {
      stalledSamples++; runMs += sampleMs; longestStallMs = Math.max(longestStallMs, runMs);
    } else runMs = 0;
  }
  const aiStallFrac = playing.length ? stalledSamples / playing.length : 0;

  // The moment the safe disc becomes smaller than the pot's damage ring — after
  // this there is no square of ground that costs 0 HP/s.
  const squeezeAtMs = POT
    ? MATCH_DURATION_MS * (1 - POT.radius / arena.maxSafeRadius)
    : null;

  return {
    player, enemy, policy,
    /** Stamped into every record so a stale figure is identifiable mechanically, not
     *  by remembering which week it was taken in. See the POLICY REVISION block. */
    policyRev: POLICY_REV_OF[policy] ?? POLICY_REV,
    simRef: SIM.sha,
    outcome: ended ? (state.winner === 'player' ? 'player' : 'enemy') : 'NO-END',
    endedByMs: Math.round(matchMs),
    playMs: Math.round(playMs),
    clockLeftMs: Math.round(state.timeRemaining),
    ticks,
    firstHitMs: firstHit === null ? null : Math.round(firstHit),
    timeToContactMs: timeToContactMs === null ? null : Math.round(timeToContactMs),
    timeToContactPlayMs: timeToContactPlayMs === null ? null : Math.round(timeToContactPlayMs),
    ttkMs: ttkMs === null ? null : Math.round(ttkMs),
    fires: fires.length,
    hits: hits.length,
    firesPerMin: +(fires.length / (playMs / 60000)).toFixed(1),
    hitsPerMin: +(hits.length / (playMs / 60000)).toFixed(1),
    engagedFrac: +frac((s) => s.eng).toFixed(3),
    enemyOffFairFrac: +frac((s) => s.offFair).toFixed(3),
    deadFrac: +frac((s) => !s.eng).toFixed(3),
    playerOutFrac: +frac((s) => s.pOut).toFixed(3),
    enemyOutFrac: +frac((s) => s.eOut).toFixed(3),
    playerPotFrac: +frac((s) => s.pPot).toFixed(3),
    aiStallFrac: +aiStallFrac.toFixed(3),
    longestAiStallMs: Math.round(longestStallMs),
    playerTravelWU: Math.round(playerTravel),
    enemyTravelWU: Math.round(enemyTravel),
    /** How much of the player's traversal budget the match actually used. */
    travelAsSpawnGaps: +(playerTravel / dist(arena.playerSpawn.x, arena.playerSpawn.y, arena.enemySpawn.x, arena.enemySpawn.y)).toFixed(2),
    shotFate,
    dmgBySource,
    dmgToPlayerBySource,
    squeezeAtMs: squeezeAtMs === null ? null : Math.round(squeezeAtMs),
    finalPlayerHp: state.player.hp,
    finalEnemyHp: state.enemy.hp,
    engageRange: Math.round(engageRange),
    samples: keepTrace ? samples : undefined,
    events: keepTrace ? events.map((e) => ({ t: Math.round(e.t), type: e.type, ...('amount' in e ? { amount: e.amount, target: e.targetRole, src: e.source?.kind } : {}), ...('weaponKey' in e ? { weapon: e.weaponKey, who: e.fighterRole } : {}) })) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────

function pct(v) { return `${(v * 100).toFixed(1)}%`; }
function secs(ms) { return ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`; }

function printOne(r) {
  console.log(`\n── ${r.player} (player, ${RULES.PLAYER_MAX_HP}hp) vs ${r.enemy} (enemy, ${RULES.ENEMY_MAX_HP}hp) · policy=${r.policy}`);
  console.log(`   outcome            ${r.outcome === 'player' ? 'PLAYER WINS' : r.outcome === 'enemy' ? 'ENEMY WINS' : '*** NEVER ENDED ***'}  at ${secs(r.endedByMs)} elapsed (${secs(r.playMs)} of match clock used, ${secs(r.clockLeftMs)} left)`);
  console.log(`   first contact      ${secs(r.timeToContactPlayMs)} MATCH CLOCK (${secs(r.timeToContactMs)} elapsed, incl. countdown)  ·  first damage ${secs(r.firstHitMs)}  ·  then decided in ${secs(r.ttkMs)}`);
  console.log(`   engaged / dead     ${pct(r.engagedFrac)} within reach (${r.engageRange}wu)  ·  ${pct(r.deadFrac)} out of reach of each other`);
  console.log(`   enemy off-screen   ${pct(r.enemyOffFairFrac)} of the match outside the 199.2wu guaranteed-visible square`);
  console.log(`   AI stalled         ${pct(r.aiStallFrac)} of the match  (longest unbroken stall ${secs(r.longestAiStallMs)})`);
  console.log(`   player travel      ${r.playerTravelWU}wu = ${r.travelAsSpawnGaps}x the spawn gap   (enemy ${r.enemyTravelWU}wu)`);
  console.log(`   fire rate          ${r.firesPerMin}/min fired, ${r.hitsPerMin}/min landed`);
  const sf = r.shotFate.player, tot = sf['hit-target'] + sf['hit-cover'] + sf.expired;
  if (tot) console.log(`   player projectiles ${tot} total → ${pct(sf['hit-target'] / tot)} hit, ${pct(sf['hit-cover'] / tot)} ate COVER, ${pct(sf.expired / tot)} fell short`);
  const ef = r.shotFate.enemy, etot = ef['hit-target'] + ef['hit-cover'] + ef.expired;
  if (etot) console.log(`   enemy  projectiles ${etot} total → ${pct(ef['hit-target'] / etot)} hit, ${pct(ef['hit-cover'] / etot)} ate COVER, ${pct(ef.expired / etot)} fell short`);
  console.log(`   zone               player outside ${pct(r.playerOutFrac)} of the match, standing in the pot ${pct(r.playerPotFrac)}`);
  console.log(`   damage by source   ${JSON.stringify(r.dmgBySource)}`);
  console.log(`   damage TO PLAYER   ${JSON.stringify(r.dmgToPlayerBySource)}`);
  console.log(`   final HP           player ${r.finalPlayerHp}  enemy ${r.finalEnemyHp}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : validate the instrument against an input whose answer is known
// ─────────────────────────────────────────────────────────────────────────────
//
// `docs/LESSONS.md` §13, and this file is the sixth instrument in one session found
// returning a confident wrong number. A pacing figure taken on the shipped arena cannot
// be checked — nobody knows what the right answer is — so the check has to happen on an
// arena small enough to do with a calculator.
//
// THE KNOWN INPUT
//   arena     1400x1000, no hazards, fog parked at r=5000 so the ring never fires
//   player    hamburger at (200,500). `hasTrail: false`, so no trail speed boost can
//             perturb the arithmetic. Its speed is `speedFor('hamburger', PLAYER_SPEED)`
//             — DERIVED, not the constant: `rules.ts` AUTHORISED DEVIATION #10 made
//             `PLAYER_SPEED` the CAP rather than the speed, and every character now
//             scales it by its own `stats.speed`. See the note above `IDEAL_MS`.
//   enemy     lollipop, PINNED at (1000,500), immortal, and held on cooldown — a piece
//             of scenery. So time-to-contact is the player's closure ALONE and depends
//             on neither the AI's pathing nor its damage. (Holding the cooldowns is not
//             fussiness: Lollipop's ultimate is `range: 400, cone: 360, effect: 'stun'`,
//             and it froze the player for a full STUN_DURATION_MS mid-approach the first
//             time this test was run — a 2.6 s error in a 5.3 s answer. An unpinned
//             variable in a known-input test is how a known input stops being known.)
//   contact   engageRange = max(140 + 26, 70 + 25.2) = 166 wu
//
//   => the player must cover 800 - 166 = 634 wu, and
//      634 / 0.12 = 5283 ms of MATCH CLOCK. Nothing else can be the right answer.
//
// Two arenas, identical except for one 40x40 box at (900,500):
//   A  no cover               — line of sight is clear the whole way
//   B  one box beside the enemy — the projectile line (12 wu box, inflated to
//      x in 874..926) is blocked from every player position west of it, at EVERY
//      distance, so the `!los` clause is live for the entire approach.
//
// A discriminates nothing (both revisions must agree) and exists to prove the harness
// itself is sound. B is the discriminator: rev 2 must still reproduce 5283 ms, and rev 1
// must fail to arrive at all.
if (args.selftest) {
  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  const BLOCKED = { ...CLEAR, cover: [{ x: 900, y: 500, w: 40, h: 40, kind: 'selftest_block' }] };

  const PIN = { x: 1000, y: 500 };
  const pin = (state) => {
    state.enemy.x = PIN.x; state.enemy.y = PIN.y;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    // Every weapon permanently on cooldown: `attemptAttack` refuses when
    // `elapsed - lastUsed < cooldown`. Scenery cannot swing back.
    state.enemy.lastUsed.fill(state.elapsed);
  };

  const D0 = 800;
  const ENGAGE = Math.max(maxNormalRange('hamburger') + HIT_RADIUS_VS_ENEMY, maxNormalRange('lollipop') + HIT_RADIUS_VS_PLAYER);
  /**
   * ⚠️ RE-DERIVED, NOT WEAKENED (2026-08-05). This was `(D0 - ENGAGE) / PLAYER_SPEED`, and
   * that was exactly right while every character moved at `PLAYER_SPEED`. `rules.ts`
   * AUTHORISED DEVIATION #10 gave each character its own `stats.speed`, so `PLAYER_SPEED`
   * is now the speed CAP and the fixture's Hamburger walks at 0.91 of it — the derived
   * answer moved 5283 -> 5806 ms and four of these fifteen assertions went red against a
   * sim that is behaving correctly.
   *
   * The fix is to derive from the CHARACTER, which is what the surrounding prose always
   * claimed the number was ("the player's closure ALONE"). Confirmed the failure was the
   * assertion and not a regression: `--sim-ref 34278ae` passes 15/15 with this same
   * derivation, because there `speedFor` returns exactly `PLAYER_SPEED`.
   */
  const PLAYER_WU_PER_MS = RULES.speedFor ? RULES.speedFor('hamburger', PLAYER_SPEED) : PLAYER_SPEED;
  const IDEAL_MS = (D0 - ENGAGE) / PLAYER_WU_PER_MS;
  // One sampler period plus one tick: the sampler can only report contact at its own
  // grid, and movement is quantised to 0.12*dt = 2.0 wu per tick.
  const TOL = SAMPLE_MS + DT;

  let pass = 0, fail = 0;
  const check = (name, ok, detail) => {
    if (ok) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };

  const trial = (layout, policy) => {
    arena = layout;
    POT = null;
    return runMatch({ player: 'hamburger', enemy: 'lollipop', policy, beforeTick: pin, keepTrace: true });
  };
  /** How much of the 800 wu gap the player closed in its first `ms` of match clock.
   *  This is the OUTCOME question (`docs/LESSONS.md` §13: prefer the outcome metric to
   *  the symptom) — "does it approach?" rather than "is it standing still?". A policy
   *  that walks 360 wu perpendicular is not standing still and closes nothing. */
  const closedBy = (r, ms) => {
    const s0 = r.samples.find((s) => s.phase === 'playing');
    const s1 = [...r.samples].reverse().find((s) => s.phase === 'playing' && s.play <= ms);
    return s0 && s1 ? s0.d - s1.d : NaN;
  };

  console.log(`\n══ match-sim SELFTEST — known-input validation of the scripted player ══`);
  console.log(`   sim=${SIM.sha}   engageRange ${ENGAGE}wu   derived closure ${IDEAL_MS.toFixed(0)}ms of match clock   tolerance +${TOL.toFixed(0)}ms\n`);

  // 0. The premise: LOS is clear in A and blocked in B, from the spawn.
  arena = CLEAR;
  check('arena A: line of sight from the player spawn is CLEAR', lineOfSight(200, 500, 1000, 500) === true);
  arena = BLOCKED;
  check('arena B: line of sight from the player spawn is BLOCKED', lineOfSight(200, 500, 1000, 500) === false);
  check('arena B: still blocked from 20wu short of contact', lineOfSight(1000 - ENGAGE - 20, 500, 1000, 500) === false);
  check('arena B: the box is never in the WALKING path (fighter is clear at the contact point)',
    Math.abs((1000 - ENGAGE) - 900) >= (42 + 40) / 2,
    `player stops at x=${1000 - ENGAGE}, box clearance needs 41wu, has ${Math.abs((1000 - ENGAGE) - 900)}wu`);

  // 1. Clear line. The LOS clause CANNOT fire here, so this isolates the OTHER defect:
  //    rev 1's stuck-detector runs through the countdown, when the player is motionless
  //    by construction, and starts the match with a latched sideways detour.
  {
    const r2 = trial(CLEAR, 'smart');
    const t2 = r2.timeToContactPlayMs;
    check('A/clear · smart (rev 2) reaches contact at the derived time',
      t2 !== null && t2 >= Math.floor(IDEAL_MS) && t2 <= IDEAL_MS + TOL,
      `measured ${t2}ms vs derived ${IDEAL_MS.toFixed(0)}ms`);
    check('A/clear · smart stamps policyRev 2', r2.policyRev === 2, `got ${r2.policyRev}`);

    const r1 = trial(CLEAR, 'smart-losfirst');
    const t1 = r1.timeToContactPlayMs;
    check('A/clear · rev 1 is late EVEN WITH A CLEAR LINE — the countdown detour',
      t1 !== null && t1 > IDEAL_MS + TOL,
      `measured ${t1}ms vs derived ${IDEAL_MS.toFixed(0)}ms = +${(t1 - IDEAL_MS).toFixed(0)}ms of sideways walking`);
    check('A/clear · smart-losfirst stamps policyRev 1', r1.policyRev === 1, `got ${r1.policyRev}`);

    const rA = trial(CLEAR, 'smart-navfix');
    check('A/clear · the ablation isolates it: nav fix alone restores the derived time',
      rA.timeToContactPlayMs >= Math.floor(IDEAL_MS) && rA.timeToContactPlayMs <= IDEAL_MS + TOL,
      `measured ${rA.timeToContactPlayMs}ms`);
  }

  // 2. Blocked line — THE discriminator.
  {
    const r2 = trial(BLOCKED, 'smart');
    const t2 = r2.timeToContactPlayMs;
    check('B/blocked · smart (rev 2) still reaches contact at the derived time',
      t2 !== null && t2 >= Math.floor(IDEAL_MS) && t2 <= IDEAL_MS + TOL,
      `measured ${t2}ms vs derived ${IDEAL_MS.toFixed(0)}ms`);

    const r1 = trial(BLOCKED, 'smart-losfirst');
    const t1 = r1.timeToContactPlayMs;
    check('B/blocked · smart-losfirst (rev 1) does NOT reproduce the derived time',
      t1 === null || t1 > IDEAL_MS * 1.5,
      `measured ${t1 === null ? 'never made contact' : `${t1}ms = ${(t1 / IDEAL_MS).toFixed(2)}x the truth`}`);

    // The mechanism, not the symptom. In 3 s the player CAN close its own speed x 3000 ms
    // — derived per character for the same reason `IDEAL_MS` is; see the note there.
    const CAN_CLOSE = 3000 * PLAYER_WU_PER_MS;
    const c2 = closedBy(r2, 3000), c1 = closedBy(r1, 3000);
    check('B/blocked · rev 2 closes the gap at very nearly the player\'s own speed',
      c2 > CAN_CLOSE * 0.9, `closed ${c2.toFixed(0)}wu of a possible ${CAN_CLOSE.toFixed(0)}wu in 3s`);
    // ⚠️ RELATIVE TO REV 2, NOT TO AN ABSOLUTE FRACTION — and the reason is worth
    // knowing, because it is the same trap this whole selftest exists to catch.
    // Rev 1's defect includes the COUNTDOWN DETOUR (see `makeNav`), and how much of
    // that 900 ms detour is still latched at the whistle is a function of
    // `countdownMs mod ~1200`. So the residue moves when `COUNTDOWN_FROM` moves:
    // measured -102 wu at the old 5.7 s countdown and +69 wu at 3.7 s (DEVIATION #8
    // in `rules.ts`). The old bound `c1 < CAN_CLOSE * 0.05` was therefore calibrated
    // to one countdown length and failed on a change it has no business noticing.
    // What is actually invariant — and is the property under test — is that rev 1
    // does NOT approach while rev 2 does. Stated as a ratio, that holds at every
    // countdown length: -0.29x at 5.7 s, 0.20x at 3.7 s, against a bound of 0.33x.
    check('B/blocked · rev 1 closes ~nothing while 634wu out of range — it walks sideways',
      c1 < c2 / 3, `rev1 closed ${c1.toFixed(0)}wu vs rev2 ${c2.toFixed(0)}wu of a possible ${CAN_CLOSE.toFixed(0)}wu in 3s`);
    check('B/blocked · rev 1 is not merely stuck — it travels while closing nothing',
      r1.playerTravelWU > 500, `travelled ${r1.playerTravelWU}wu`);
  }

  // 3. The countdown is not silently counted as walking time.
  //    The bound used to be a literal `+ 4000`, which was the 5.7 s countdown written
  //    down as a number. `COUNTDOWN_FROM` moved to 3 (rules.ts DEVIATION #8) and this
  //    assertion failed on a change it exists to be indifferent to. Derived now, and
  //    tightened while it was being fixed: the gap is not merely "big", it is EXACTLY
  //    the countdown, to within the tick the sampler runs on.
  {
    const r = trial(CLEAR, 'smart');
    const COUNTDOWN_MS = RULES.COUNTDOWN_FROM * 1000 + RULES.COUNTDOWN_START_FLASH_MS;
    check('elapsed and match-clock contact differ by EXACTLY the countdown, and both are reported',
      Math.abs((r.timeToContactMs - r.timeToContactPlayMs) - COUNTDOWN_MS) <= 2 * DT,
      `elapsed ${r.timeToContactMs}ms - match clock ${r.timeToContactPlayMs}ms = ${r.timeToContactMs - r.timeToContactPlayMs}ms vs countdown ${COUNTDOWN_MS}ms`);
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --ranges : what the reach ladder is worth in TIME
// ─────────────────────────────────────────────────────────────────────────────
//
// `rules.ts` deliberately preserved projectile FLIGHT time through the range retune,
// on the grounds that time-to-target is what a player perceives. The same argument
// applies to the ladder itself and was not applied to it: what a longer weapon buys
// you is SECONDS OF FREE FIRE while the shorter one closes, and that quantity scales
// with reach, not with the ratio between reaches. This prints it.
if (args.ranges) {
  const PS = PLAYER_SPEED * 1000, AI = RULES.AI_CHASE_SPEED * 1000;
  const EVADE = RULES.HIT_RADIUS_VS_PLAYER / PLAYER_SPEED;   // camera.ts's own EVADE_WINDOW_MS
  const rungs = Object.entries(RULES.REACH).filter(([k]) => k !== 'ultimateSlam');
  const maxR = RULES.REACH.rangedMax;
  console.log(`\n══ WHAT THE REACH LADDER IS WORTH IN SECONDS ══`);
  console.log(`   player ${PS} wu/s · AI chase ${AI} wu/s · evade window ${EVADE.toFixed(0)} ms (camera.ts)\n`);
  console.log(`   holding rangedMax (${maxR}wu), free fire until the other weapon reaches you:`);
  for (const [k, v] of rungs) {
    if (v >= maxR) continue;
    const t = (maxR - v) / PS;
    console.log(`     vs ${k.padEnd(13)} ${String(v).padStart(4)}wu   gap ${String(maxR - v).padStart(3)}wu   ${t.toFixed(2)}s = ${(t * 1000 / EVADE).toFixed(1)} evade windows`);
  }
  const band = (maxR - RULES.REACH.rangedClose) / PS;
  console.log(`\n   the ENTIRE ranged band (${RULES.REACH.rangedClose} -> ${maxR}) is ${band.toFixed(2)}s of closing time = ${(band * 1000 / EVADE).toFixed(1)} evade windows.`);
  console.log(`   spawn gap ${Math.round(dist(arena.playerSpawn.x, arena.playerSpawn.y, arena.enemySpawn.x, arena.enemySpawn.y))}wu = ${(1080 / 398.4).toFixed(1)} guaranteed-visible screen widths, ${(1080 / maxR).toFixed(1)} max reaches.`);
  console.log(`   straight-line closure: ${(1080 / (PS + AI)).toFixed(1)}s both moving, ${(1080 / PS).toFixed(1)}s if the AI never moves.\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --pathmap : can the AI reach you, from where?
// ─────────────────────────────────────────────────────────────────────────────
//
// Runs the REAL sim with a motionless, unkillable player parked on each cell of a
// grid, for a full match, and asks one question: did the enemy ever get inside its
// own weapon range? Unkillable because otherwise the fog decides the answer and the
// map measures the ring instead of the pathing.
//
// Every cell is a full 180 s match through `stepMatch`, so this is not a model of
// the AI — it IS the AI.
if (args.pathmap) {
  const enemyId = String(args.enemy ?? 'donut');
  const GW = Number(args.gw ?? 28), GH = Number(args.gh ?? 20);
  const reach = maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER;
  const rows = [];
  let reached = 0, cells = 0, blocked = 0;
  const times = [];

  for (let gy = 0; gy < GH; gy++) {
    let row = '';
    for (let gx = 0; gx < GW; gx++) {
      const x = ((gx + 0.5) / GW) * arena.width;
      const y = ((gy + 0.5) / GH) * arena.height;
      if (blockedByCover(x, y, RULES.PLAYER_SIZE, arena.cover)) { row += '#'; blocked++; continue; }
      cells++;

      const st = createMatch(arena, 'hamburger', enemyId);
      st.player.x = x; st.player.y = y;
      st.player.hp = 1e9; st.player.maxHp = 1e9;   // isolate pathing from the fog
      const idleInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
      let best = Infinity, tReach = null;
      while (st.elapsed < MATCH_DURATION_MS + 6000 && st.phase !== 'ended') {
        st.player.x = x; st.player.y = y;            // pin: the player is a statue
        stepMatch(st, DT, idleInput);
        const d = dist(st.enemy.x, st.enemy.y, x, y);
        if (d < best) best = d;
        if (d <= reach && tReach === null) tReach = st.elapsed;
      }
      if (tReach !== null) { reached++; times.push(tReach); row += tReach < 15000 ? '.' : tReach < 40000 ? ':' : '+'; }
      else row += best < reach * 2 ? 'o' : 'X';
    }
    rows.push(row);
  }

  console.log(`\n══ AI PATHING MAP — enemy=${enemyId}, reach ${Math.round(reach)}wu, player motionless & unkillable ══`);
  console.log(`   '.' reached <15s   ':' <40s   '+' <180s   'o' got within 2x reach but never arrived   'X' NEVER GOT CLOSE   '#' unstandable\n`);
  rows.forEach((r, i) => console.log(`   ${String(Math.round(((i + 0.5) / GH) * arena.height)).padStart(4)} |${r}|`));
  console.log(`        ${' '.repeat(0)}  x=0 .. ${arena.width}`);
  times.sort((a, b) => a - b);
  console.log(`\n   reached ${reached}/${cells} standable cells (${(reached / cells * 100).toFixed(1)}%)   NEVER reached ${cells - reached} (${((cells - reached) / cells * 100).toFixed(1)}%)`);
  if (times.length) console.log(`   time to reach: median ${secs(times[Math.floor(times.length / 2)])}  p90 ${secs(times[Math.floor(times.length * 0.9)])}  max ${secs(times[times.length - 1])}`);
  console.log(`   player spawn (${arena.playerSpawn.x},${arena.playerSpawn.y}) is in this map; enemy starts at (${arena.enemySpawn.x},${arena.enemySpawn.y})\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --fog : the closing schedule, in landmarks rather than a formula
// ─────────────────────────────────────────────────────────────────────────────
//
// `safeRadius = maxSafeRadius * timeRemaining / MATCH_DURATION_MS` is a one-liner
// that tells you nothing about what the match FEELS like. What matters is when the
// edge crosses things a player can name: the corner they are standing in, their own
// spawn, the last patch of floor that costs nothing to stand on.
if (args.fog) {
  const maxR = arena.maxSafeRadius;
  const tAt = (R) => (1 - R / maxR) * MATCH_DURATION_MS;
  const half = RULES.PLAYER_SIZE / 2;
  const cx = arena.center.x, cy = arena.center.y;
  const corner = Math.hypot(cx - half, cy - half);           // furthest STANDABLE point
  const spawnR = dist(arena.playerSpawn.x, arena.playerSpawn.y, cx, cy);

  // Area of the safe disc actually inside the arena rectangle, by sampling.
  function safeAreaFrac(R) {
    let inside = 0, n = 0;
    for (let gx = 0; gx < 140; gx++) for (let gy = 0; gy < 100; gy++) {
      const x = (gx + 0.5) * (arena.width / 140), y = (gy + 0.5) * (arena.height / 100);
      n++; if (dist(x, y, cx, cy) <= R) inside++;
    }
    return inside / n;
  }

  const marks = [
    ['ring starts outside the map', maxR],
    ['reaches the furthest standable corner', corner],
    ['reaches the E/W wall midpoint', cx],
    ['reaches the two SPAWN POINTS', spawnR],
    ['reaches the N/S wall midpoint', cy],
    ['shrinks inside the central cover ring', 230],
    ['equals the boiling pot danger ring — NO SAFE GROUND LEFT', POT ? POT.radius : 0],
    ['equals the pot body', 52],
    ['zero', 0],
  ];
  console.log(`\n══ CLOSING FOG SCHEDULE ══  maxSafeRadius ${maxR}, ${FOG_DPS} HP/s outside, arena ${arena.width}x${arena.height}\n`);
  console.log(`   ${'t'.padStart(8)}  ${'R'.padStart(6)}  ${'safe area'.padStart(10)}   event`);
  for (const [label, R] of marks) {
    const t = tAt(R);
    console.log(`   ${secs(t).padStart(8)}  ${String(Math.round(R)).padStart(6)}  ${(safeAreaFrac(R) * 100).toFixed(1).padStart(9)}%   ${label}`);
  }
  console.log(`\n   edge sweep speed        ${(maxR / (MATCH_DURATION_MS / 1000)).toFixed(2)} wu/s  (player runs at ${(PLAYER_SPEED * 1000).toFixed(0)} wu/s, so outrunning it is never the problem)`);
  console.log(`   time to cross the safe disc at t=0   ${(2 * maxR / (PLAYER_SPEED * 1000)).toFixed(1)}s`);
  console.log(`   HUD warns 'is-imminent' 12s before the edge arrives = ${(12 * maxR / (MATCH_DURATION_MS / 1000)).toFixed(0)} wu of grace`);
  console.log(`   player at 100 HP survives ${(RULES.PLAYER_MAX_HP / FOG_DPS).toFixed(1)}s in the fog; enemy at 150 HP survives ${(RULES.ENEMY_MAX_HP / FOG_DPS).toFixed(1)}s\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --occlusion : can a shot even reach, from where people actually stand?
// ─────────────────────────────────────────────────────────────────────────────
//
// Runs the SAME test `sim.ts:stepProjectiles` runs — a 12x12 box against every
// CoverBox, marched in the same increments — from a grid of legal standing
// positions in every direction, at each rung of the `REACH` ladder. Independent of
// any AI or scripted player, so it separates "my bot stood badly" from "the arena
// eats shots".
if (args.occlusion) {
  const STEP_WU = 280 / 60;           // a fast projectile's per-frame advance at 60fps
  const ANGLES = 72;
  const GRID = 20;
  const rungs = Object.entries(RULES.REACH).filter(([k]) => k !== 'ultimateSlam');

  function blockedAt(x0, y0, ang, range) {
    let t = 0;
    const cx = Math.cos(ang), cy = Math.sin(ang);
    while (t < range) {
      t = Math.min(t + STEP_WU, range);
      const x = x0 + cx * t, y = y0 + cy * t;
      if (arena.cover.some((o) => Math.abs(x - o.x) < (12 + o.w) / 2 && Math.abs(y - o.y) < (12 + o.h) / 2)) return t;
    }
    return null;
  }

  // Weight positions by whether they are inside the safe ring at three moments of
  // the match, because "where people stand" is not uniform — the fog decides it.
  // ⚠️ THE RADII WERE ALWAYS DERIVED; THE LABELS WERE NOT, AND BOTH HALVES WENT STALE.
  //   WAS: 't=0s   R=890' / 't=90s  R=445' / 't=140s R=198'
  // `890` is the 1× map's `maxSafeRadius` (the shipped one is 1985, so every printed
  // radius was 2.2× the label) and `90 s`/`140 s` are points on the 180 s clock, which
  // has been **45 s** since 2026-08-05 — so two of the three rows were labelled with
  // moments that occur after the match has ended. A derived value under a literal label
  // is the worst of both: the number moves, the caption does not, and the caption is
  // what a reader quotes. Both are computed now, from the same two constants.
  const RING_FRACTIONS = [1, 0.5, 0.22];
  const rings = RING_FRACTIONS.map((f) => ({
    name: `t=${Math.round(MATCH_DURATION_MS / 1000 * (1 - f))}s R=${Math.round(arena.maxSafeRadius * f)}`,
    R: arena.maxSafeRadius * f,
  }));

  console.log(`\n══ COVER OCCLUSION — fraction of firing directions blocked before max reach ══`);
  console.log(`   ${arena.cover.length} cover boxes, ${(arena.cover.reduce((a, c) => a + c.w * c.h, 0) / (arena.width * arena.height) * 100).toFixed(1)}% of the floor is solid\n`);
  const head = rungs.map(([k, v]) => `${k}(${v})`.padStart(16)).join('');
  console.log(`   ${'region'.padEnd(16)}${head}`);
  for (const ring of rings) {
    const acc = rungs.map(() => ({ n: 0, blocked: 0 }));
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const x = ((gx + 0.5) / GRID) * arena.width;
        const y = ((gy + 0.5) / GRID) * arena.height;
        if (dist(x, y, arena.center.x, arena.center.y) > ring.R) continue;
        if (blockedByCover(x, y, RULES.PLAYER_SIZE, arena.cover)) continue;   // can't stand there
        for (let a = 0; a < ANGLES; a++) {
          const ang = (a / ANGLES) * Math.PI * 2;
          const hit = blockedAt(x, y, ang, rungs[rungs.length - 1][1]);
          rungs.forEach(([, range], ri) => {
            acc[ri].n++;
            if (hit !== null && hit <= range) acc[ri].blocked++;
          });
        }
      }
    }
    console.log(`   ${ring.name.padEnd(16)}${acc.map((a) => (a.n ? pctS(a.blocked / a.n) : '—').padStart(16)).join('')}`);
  }
  console.log('');
  process.exit(0);
}
function pctS(v) { return `${(v * 100).toFixed(1)}%`; }

const players = args['all-matchups'] ? CHARACTER_IDS : [String(args.player ?? 'hamburger')];
const enemies = args['all-matchups'] ? CHARACTER_IDS : [String(args.enemy ?? 'donut')];

console.log(`arena "${arena.displayName}" ${arena.width}x${arena.height}  centre (${arena.center.x},${arena.center.y})  maxSafeRadius ${arena.maxSafeRadius}`);
if (POT) console.log(`damage hazard at (${POT.x},${POT.y}) r=${POT.radius}  ${POT_DPS.toFixed(0)} HP/s   ·   fog ${FOG_DPS.toFixed(0)} HP/s`);
console.log(`match length ${MATCH_DURATION_MS / 1000}s   dt=${DT.toFixed(2)}ms   react=${REACT_MS}ms   policy=${POLICY} rev${POLICY_REV_OF[POLICY] ?? POLICY_REV}   sim=${SIM.sha}`);
if (POLICY === 'smart-losfirst') {
  console.log(`
*** POLICY REV 1 — KNOWN BROKEN. It tests line-of-sight before range, so the scripted
*** player refuses to approach for ~45% of its decisions and "time to first contact" is
*** the AI walking alone at AI_CHASE_SPEED, not a closure. Present only to reproduce
*** figures recorded before 2026-08-05. Do NOT steer by anything printed below.
`);
}

const all = [];
for (const p of players) {
  for (const e of enemies) {
    if (args['all-matchups'] && p === e) continue;
    for (let i = 0; i < RUNS; i++) {
      const r = runMatch({ player: p, enemy: e, keepTrace: !!args.trace && !args['all-matchups'] });
      all.push(r);
      if (!args['all-matchups']) printOne(r);
    }
  }
}

if (args['all-matchups']) {
  const n = all.length;
  const avg = (f) => all.reduce((a, r) => a + f(r), 0) / n;
  const playerWins = all.filter((r) => r.outcome === 'player').length;
  const noEnd = all.filter((r) => r.outcome === 'NO-END').length;
  console.log(`\n══ ${n} matchups, policy=${POLICY} rev${POLICY_REV_OF[POLICY] ?? POLICY_REV}, sim=${SIM.sha} ══`);
  console.log(`  player win rate     ${pct(playerWins / n)}   (never ended: ${noEnd})`);
  console.log(`  match length        mean ${secs(avg((r) => r.playMs))}   min ${secs(Math.min(...all.map((r) => r.playMs)))}   max ${secs(Math.max(...all.map((r) => r.playMs)))}`);
  console.log(`  used of the ${MATCH_DURATION_MS / 1000}s clock  ${pct(avg((r) => r.playMs) / MATCH_DURATION_MS)}`);
  console.log(`  first CONTACT       mean ${secs(avg((r) => r.timeToContactPlayMs ?? 0))} MATCH CLOCK  ·  ${secs(avg((r) => r.timeToContactMs ?? 0))} elapsed (incl. countdown)  (walking, nothing else happens)`);
  console.log(`  first damage        mean ${secs(avg((r) => r.firstHitMs ?? 0))}`);
  console.log(`  TIME TO KILL        mean ${secs(avg((r) => r.ttkMs ?? 0))}   min ${secs(Math.min(...all.map((r) => r.ttkMs ?? Infinity)))}   max ${secs(Math.max(...all.map((r) => r.ttkMs ?? 0)))}   <- first damage to decision`);
  console.log(`  DEAD TIME           ${pct(avg((r) => r.deadFrac))} of the match neither fighter can reach the other`);
  console.log(`  ENEMY OFF-SCREEN    ${pct(avg((r) => r.enemyOffFairFrac))} of the match outside the guaranteed-visible square`);
  console.log(`  AI STALLED          ${pct(avg((r) => r.aiStallFrac))} of the match  ·  longest stall seen ${secs(Math.max(...all.map((r) => r.longestAiStallMs)))}  ·  ${all.filter((r) => r.longestAiStallMs > 5000).length}/${n} matchups stalled >5s`);
  {
    const sum = (sel) => all.reduce((a, r) => a + sel(r), 0);
    const pt = sum((r) => r.shotFate.player['hit-target']) + sum((r) => r.shotFate.player['hit-cover']) + sum((r) => r.shotFate.player.expired);
    if (pt) console.log(`  player projectiles  ${pct(sum((r) => r.shotFate.player['hit-target']) / pt)} hit · ${pct(sum((r) => r.shotFate.player['hit-cover']) / pt)} ate COVER · ${pct(sum((r) => r.shotFate.player.expired) / pt)} fell short`);
    const et = sum((r) => r.shotFate.enemy['hit-target']) + sum((r) => r.shotFate.enemy['hit-cover']) + sum((r) => r.shotFate.enemy.expired);
    if (et) console.log(`  enemy  projectiles  ${pct(sum((r) => r.shotFate.enemy['hit-target']) / et)} hit · ${pct(sum((r) => r.shotFate.enemy['hit-cover']) / et)} ate COVER · ${pct(sum((r) => r.shotFate.enemy.expired) / et)} fell short`);
  }
  console.log(`  player travel       ${avg((r) => r.travelAsSpawnGaps).toFixed(2)}x the spawn gap`);
  console.log(`  fires/min           ${avg((r) => r.firesPerMin).toFixed(1)}   hits/min ${avg((r) => r.hitsPerMin).toFixed(1)}`);
  console.log(`  fog damage share    ${pct(all.reduce((a, r) => a + (r.dmgBySource.fog ?? 0), 0) / all.reduce((a, r) => a + Object.values(r.dmgBySource).reduce((x, y) => x + y, 0), 0))}`);
  console.log(`  hazard damage share ${pct(all.reduce((a, r) => a + (r.dmgBySource.hazard ?? 0), 0) / all.reduce((a, r) => a + Object.values(r.dmgBySource).reduce((x, y) => x + y, 0), 0))}`);

  const byLen = [...all].sort((a, b) => a.playMs - b.playMs);
  console.log(`\n  shortest 5:`);
  for (const r of byLen.slice(0, 5)) console.log(`    ${secs(r.playMs).padStart(7)}  ${r.player} vs ${r.enemy}  -> ${r.outcome}`);
  console.log(`  longest 5:`);
  for (const r of byLen.slice(-5)) console.log(`    ${secs(r.playMs).padStart(7)}  ${r.player} vs ${r.enemy}  -> ${r.outcome}`);

  if (args.out) {
    mkdirSync(dirname(String(args.out)), { recursive: true });
    writeFileSync(String(args.out), JSON.stringify(all, null, 2));
    console.log(`\n  wrote ${args.out}`);
  }
}

if (args.trace && !args['all-matchups']) {
  const p = String(args.trace);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(all[0], null, 2));
  console.log(`\ntrace -> ${p}  (${all[0].samples.length} samples, ${all[0].events.length} events)`);
}
