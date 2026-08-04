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
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ARENA_CACHE = `${ROOT}/tools/arena.gameplay.json`;

const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
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

if (!existsSync(ARENA_CACHE)) {
  console.error(`No arena cache. Run once with:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const ARENA_DATA = JSON.parse(readFileSync(ARENA_CACHE, 'utf8'));

/** The sim only ever calls `arena.build()`/`arena.update()` from the RENDERER, never
 *  from `stepMatch`, so a data-only arena is a complete input for the simulation. */
const arena = { ...ARENA_DATA, build: () => null, update: () => {} };

const POT = arena.hazards.find((h) => h.kind === 'damage');
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
function makeNav() {
  /** Positions over the last ~1.5 s. NET displacement, not per-tick movement, is the
   *  right stuck test: a fighter pinned on a corner still jitters, and a per-tick
   *  test reads that as walking. (This is the same mistake `movement.ts:moveToward`
   *  documents having made — worth knowing it bites the measuring instrument too.) */
  const hist = [];
  let detourUntil = -1;
  let detourSign = 1;

  return function walk(state, targetX, targetY) {
    const p = state.player;
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

const POLICIES = {
  /** Nothing at all. The control: what does the AI do to a target that never acts? */
  idle: () => () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }),

  /** Run at the enemy and hold fire. The naive human's first 30 seconds. */
  chase: () => {
    const nav = makeNav();
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
  },

  /**
   * Play it properly: hold the range band of the best available weapon, respect the
   * closing ring, and don't stand in the pot unless the ring leaves nowhere else.
   */
  smart: () => {
    const nav = makeNav();
    return (state) => {
      const p = state.player, e = state.enemy;
      const d = dist(p.x, p.y, e.x, e.y);
      const idx = bestWeapon(state, d);
      const band = preferredRange(p.characterId) * 0.85;
      const los = lineOfSight(p.x, p.y, e.x, e.y);

      const cx = arena.center.x, cy = arena.center.y;
      const dc = dist(p.x, p.y, cx, cy);
      const R = state.safeRadius;

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
      } else if (!los) {
        // In range but shooting a counter. A player flanks; they do not stand there
        // emptying cooldowns into furniture.
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
        target = { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
      } else if (d > band) {
        target = { x: e.x, y: e.y };                       // close
      } else if (d < band * 0.5) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);      // back off
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
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// one match
// ─────────────────────────────────────────────────────────────────────────────

function runMatch({ player, enemy, policy = POLICY, dt = DT, reactMs = REACT_MS, sampleMs = SAMPLE_MS, keepTrace = false }) {
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
    outcome: ended ? (state.winner === 'player' ? 'player' : 'enemy') : 'NO-END',
    endedByMs: Math.round(matchMs),
    playMs: Math.round(playMs),
    clockLeftMs: Math.round(state.timeRemaining),
    ticks,
    firstHitMs: firstHit === null ? null : Math.round(firstHit),
    timeToContactMs: timeToContactMs === null ? null : Math.round(timeToContactMs),
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
  console.log(`   first contact      ${secs(r.timeToContactMs)}  ·  first damage ${secs(r.firstHitMs)}  ·  then decided in ${secs(r.ttkMs)}`);
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
  const rings = [
    { name: 't=0s   R=890', R: arena.maxSafeRadius },
    { name: 't=90s  R=445', R: arena.maxSafeRadius * 0.5 },
    { name: 't=140s R=198', R: arena.maxSafeRadius * 0.22 },
  ];

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
console.log(`match length ${MATCH_DURATION_MS / 1000}s   dt=${DT.toFixed(2)}ms   react=${REACT_MS}ms   policy=${POLICY}`);

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
  console.log(`\n══ ${n} matchups, policy=${POLICY} ══`);
  console.log(`  player win rate     ${pct(playerWins / n)}   (never ended: ${noEnd})`);
  console.log(`  match length        mean ${secs(avg((r) => r.playMs))}   min ${secs(Math.min(...all.map((r) => r.playMs)))}   max ${secs(Math.max(...all.map((r) => r.playMs)))}`);
  console.log(`  used of the 180s    ${pct(avg((r) => r.playMs) / MATCH_DURATION_MS)}`);
  console.log(`  first CONTACT       mean ${secs(avg((r) => r.timeToContactMs ?? 0))}  (walking, nothing else happens)`);
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
