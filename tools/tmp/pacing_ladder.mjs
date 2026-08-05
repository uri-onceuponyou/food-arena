#!/usr/bin/env node
/**
 * PACING LADDER — the SHAPE of a match, over the whole roster ladder, with the
 * win-rate consequence measured on the SAME runs.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Two agents measured the same problem from opposite ends and neither could act:
 * the HUD pass derived `COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS = 5700 ms`
 * of pre-match, and the audio pass measured a 6.55 s gap between the whistle and the
 * first combat sound. Nothing in this repo reported both, and nothing reported them
 * against a DENOMINATOR that includes the countdown — so "how much of the experience
 * is the fight" had never been printed.
 *
 * `tools/match-sim.mjs` prints `deadFrac` over the MATCH CLOCK only, and
 * `tools/tmp/rules_census.mjs` prints `engagedFrac` the same way. Both therefore
 * report the countdown as if it did not exist. `tools/tmp/roster_table.mjs` computes
 * `engagedTicks` and never surfaces it. This tool exists to state pacing over the
 * SESSION (countdown + play), and to split dead time into the two halves that have
 * different fixes:
 *
 *     dead BEFORE first contact   — the approach. Bought by spawn distance, speed,
 *                                   or a zone that closes sooner.
 *     dead AFTER first contact    — disengagement. Bought by AI flee rules, kiting,
 *                                   reach, cover. NOT bought by spawning closer.
 *
 * A change that shortens the approach and lengthens disengagement has moved a number
 * and not improved the game, and no instrument here could previously see that.
 *
 * ── Method ──────────────────────────────────────────────────────────────────
 *
 * 110 matchups x N seeds x P policies through the real `stepMatch`. The scripted
 * player, the seeded jitter and the reaction cadence are LIFTED VERBATIM from
 * `tools/tmp/roster_table.mjs` (which lifted them from `status_census.mjs`, which
 * lifted `smart2` from `arena_probe.mjs`), so a row here is the SAME match as a row
 * there and the two can be cross-checked. Seed 0 is jitter-free.
 *
 * `--sim <dir>` points at a `tools/tmp/stage_rules.mjs` copy, so a candidate constant
 * is measured without editing the shared tree (`docs/LESSONS.md` §5).
 * `--baseline <json>` prints PAIRED per-matchup deltas — same arena, same seeds, same
 * matchups — which is exact rather than two samples of a noisy mean.
 *
 *   node tools/tmp/pacing_ladder.mjs --selftest
 *   node tools/tmp/pacing_ladder.mjs --seeds 8 --json /tmp/pace.before.json
 *   node tools/tmp/pacing_ladder.mjs --seeds 8 --sim /tmp/cand/game --baseline /tmp/pace.before.json
 *
 * ⚠️ RESOLUTION FLOORS (docs/TOOLS.md, measured): aggregate win rate is unresolvable
 * below ~9 pp; pacing below ~0.8 s of contact time or ~4 pp of dead time. A PAIRED
 * per-matchup delta is not a sample and is exact. This tool prints both so the two are
 * never confused.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, PLAYER_MAX_HP, ENEMY_MAX_HP,
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS, PLAYER_SPEED,
} = RULES;

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
let HAZ = arena ? arena.hazards.find((h) => h.kind === 'damage') : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2,chase,kite,survive').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// seeded rng — mulberry32, identical to roster_table.mjs / status_census.mjs
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const maxNormalRange = (id) =>
  Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);

function preferredRange(id) {
  const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= REACH.rangedMax);
  if (!ws.length) return maxNormalRange(id);
  return ws.reduce((best, w) => ((w.damage ?? 0) > (best.damage ?? 0) ? w : best)).range ?? 0;
}

function axesToward(fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
  return { x: q(dx / m), y: q(dy / m) };
}

function bestWeapon(state, d) {
  const p = state.player;
  const ws = CHARACTERS[p.characterId].weapons;
  let best = null, bestDmg = -Infinity;
  ws.forEach((w, i) => {
    if (w.type === 'self') return;
    if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
    if (d > (w.range ?? Infinity)) return;
    if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; best = i; }
  });
  return best;
}

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
 * ⚠️ THE STUCK DETECTOR MUST NOT RUN DURING THE COUNTDOWN — and in this policy family
 * it does. Found by this file's own `--selftest`, and it matters here more than
 * anywhere else because THE COUNTDOWN IS THE THING UNDER TEST.
 *
 * `sim.ts:movePlayer` is only called while `phase === 'playing'`, so for the first
 * `COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS` ms of every match the player is
 * motionless BY CONSTRUCTION. The detector below sees "1.2 s of walking has covered
 * 0 wu", concludes it is jammed, flips `detourSign` and latches a 900 ms perpendicular
 * detour — repeatedly, once every ~1.2 s of countdown. Whatever is still latched when
 * the whistle blows is walked SIDEWAYS at the start of the match.
 *
 * `tools/match-sim.mjs` found and fixed exactly this on 2026-08-05 (its `makeNav` takes
 * `countdownStuckBug`). The fix was never carried across to `tools/tmp/arena_probe.mjs`,
 * and `status_census.mjs` / `roster_table.mjs` / `roster_sweep.mjs` /
 * `status_grace_sweep.mjs` each lifted the driver verbatim from there — so every
 * `smart2` / `chase` / `kite` figure produced by that family still carries it.
 * Measured here on the derivable arena: contact at 5850 ms against a derived 5283 ms,
 * i.e. **+567 ms of sideways walking**, the same figure `match-sim --selftest` reports
 * for its rev 1.
 *
 * WHY IT IS DISQUALIFYING FOR THIS TOOL SPECIFICALLY: the amount left latched at the
 * whistle is a function of `countdownMs mod ~1200`, so it CHANGES WHEN THE COUNTDOWN
 * CHANGES. Measuring a countdown edit with this driver would attribute an instrument
 * artefact to the game — `docs/LESSONS.md` §13, an instrument that lies plausibly.
 *
 * Default is FIXED. `--nav-countdown-bug` reproduces the historical driver so a figure
 * recorded by the tools above can still be compared against.
 */
function makeNav(rnd, { countdownStuckBug = false } = {}) {
  const hist = [];
  let detourUntil = -1, detourSign = rnd() < 0.5 ? 1 : -1;
  return function walk(state, targetX, targetY) {
    const p = state.player;
    if (!countdownStuckBug && state.phase !== 'playing') {
      hist.length = 0; detourUntil = -1;
      return axesToward(p.x, p.y, targetX, targetY);
    }
    hist.push({ t: state.elapsed, x: p.x, y: p.y });
    while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();
    if (state.elapsed > detourUntil && hist.length > 4 && state.elapsed - hist[0].t > 1200) {
      if (Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 45) {
        detourSign = -detourSign; detourUntil = state.elapsed + 900; hist.length = 0;
      }
    }
    let tx = targetX, ty = targetY;
    if (state.elapsed < detourUntil) {
      const ang = Math.atan2(targetY - p.y, targetX - p.x) + detourSign * (Math.PI / 2);
      tx = p.x + Math.cos(ang) * 150; ty = p.y + Math.sin(ang) * 150;
    }
    return axesToward(p.x, p.y, tx, ty);
  };
}

/** `--nav-countdown-bug` reproduces the historical driver. See `makeNav`. */
const NAV_BUG = !!args['nav-countdown-bug'];
/** `--decide-during-countdown` reproduces the historical decision loop. See `runMatch`. */
const DECIDE_IN_COUNTDOWN = !!args['decide-during-countdown'];

/** Verbatim from `tools/tmp/roster_table.mjs` apart from the `makeNav` guard. */
const POLICY_FNS = {
  idle: () => () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }),

  chase: (rnd) => {
    const nav = makeNav(rnd, { countdownStuckBug: NAV_BUG });
    return (state) => {
      const p = state.player, e = state.enemy;
      const d = dist(p.x, p.y, e.x, e.y);
      return {
        move: nav(state, e.x, e.y),
        aim: { x: e.x - p.x, y: e.y - p.y },
        selectedWeapon: bestWeapon(state, d) ?? 0,
        attack: true,
      };
    };
  },

  /** `smart` with range tested BEFORE line of sight. The corrected scripted player. */
  smart2: (rnd) => {
    const nav = makeNav(rnd, { countdownStuckBug: NAV_BUG });
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
      if (dc > R - 30) {
        target = { x: cx, y: cy };
        if (HAZ && R < HAZ.radius + 20) {
          const ang = Math.atan2(p.y - cy, p.x - cx);
          const r = Math.max(0, R - 10);
          target = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
        }
      } else if (HAZ && dist(p.x, p.y, HAZ.x, HAZ.y) < HAZ.radius + 15 && R > HAZ.radius + 40) {
        const ang = Math.atan2(p.y - HAZ.y, p.x - HAZ.x);
        target = { x: HAZ.x + Math.cos(ang) * (HAZ.radius + 60), y: HAZ.y + Math.sin(ang) * (HAZ.radius + 60) };
      } else if (d > band) {
        target = { x: e.x, y: e.y };
      } else if (!los) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
        target = { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
      } else if (d < band * 0.5) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      } else {
        const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      }
      return {
        move: nav(state, target.x, target.y),
        aim: { x: e.x - p.x, y: e.y - p.y },
        selectedWeapon: idx ?? 0,
        attack: idx !== null && (los || CHARACTERS[p.characterId].weapons[idx].type === 'melee'),
      };
    };
  },

  survive: (rnd) => {
    let jitter = rnd() * Math.PI * 2;
    return (state) => {
      const p = state.player, e = state.enemy;
      const cx = arena.center.x, cy = arena.center.y;
      const R = state.safeRadius;
      const potR = HAZ ? HAZ.radius : 0;
      let vx = 0, vy = 0;
      const de = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const wEnemy = Math.min(3, 260 / de);
      vx += ((p.x - e.x) / de) * wEnemy;
      vy += ((p.y - e.y) / de) * wEnemy;
      const dc = Math.hypot(p.x - cx, p.y - cy) || 1;
      const margin = R - dc;
      const wRing = margin < 140 ? 4 * (1 - Math.max(0, margin) / 140) : 0;
      vx += ((cx - p.x) / dc) * wRing;
      vy += ((cy - p.y) / dc) * wRing;
      if (HAZ) {
        const dp = Math.hypot(p.x - HAZ.x, p.y - HAZ.y) || 1;
        if (dp < potR + 45) { const w = 3; vx += ((p.x - HAZ.x) / dp) * w; vy += ((p.y - HAZ.y) / dp) * w; }
      }
      jitter += 0.03;
      vx += Math.cos(jitter) * 0.5; vy += Math.sin(jitter) * 0.5;
      const m = Math.max(Math.abs(vx), Math.abs(vy)) || 1;
      return {
        move: { x: Math.max(-1, Math.min(1, vx / m)), y: Math.max(-1, Math.min(1, vy / m)) },
        aim: { x: e.x - p.x, y: e.y - p.y },
        selectedWeapon: 0,
        attack: false,
      };
    };
  },

  kite: (rnd) => {
    const nav = makeNav(rnd, { countdownStuckBug: NAV_BUG });
    return (state) => {
      const p = state.player, e = state.enemy;
      const cx = arena.center.x, cy = arena.center.y;
      const R = state.safeRadius;
      const dc = dist(p.x, p.y, cx, cy);
      const away = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const wRing = dc > R - 90 ? 2.2 : 0.6;
      const fx = ((p.x - e.x) / away) * 1.4 + ((cx - p.x) / 600) * wRing;
      const fy = ((p.y - e.y) / away) * 1.4 + ((cy - p.y) / 430) * wRing;
      const selfSlot = CHARACTERS[p.characterId].weapons.findIndex((w) => w.type === 'self');
      const canSelf = selfSlot >= 0 && state.elapsed - p.lastUsed[selfSlot] >= CHARACTERS[p.characterId].weapons[selfSlot].cooldown;
      return {
        move: nav(state, p.x + fx * 200, p.y + fy * 200),
        aim: { x: e.x - p.x, y: e.y - p.y },
        selectedWeapon: canSelf ? selfSlot : 0,
        attack: canSelf,
      };
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// one match — pacing only
// ─────────────────────────────────────────────────────────────────────────────
function runMatch(playerId, enemyId, policy, seed, { beforeTick = null } = {}) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = POLICY_FNS[policy](rnd);
  const reactBase = 150;
  const reactJit = seed === 0 ? 0 : 60;

  const pReach = maxNormalRange(playerId), eReach = maxNormalRange(enemyId);
  /** "Someone could land a hit right now" — the same definition match-sim.mjs uses. */
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let sinceDecision = Infinity;
  let nextReact = reactBase;

  let countdownMs = null;          // elapsed when the whistle blows
  let playTicks = 0, engagedTicks = 0;
  let contactPlayMs = null;        // MATCH CLOCK at first moment either can reach
  let firstFirePlayMs = null;      // MATCH CLOCK at the first weapon fired
  let firstHitPlayMs = null;       // MATCH CLOCK at the first weapon/trail damage
  let deadRunMs = 0, longestDeadAfterContactMs = 0;
  let playerTravel = 0, travelToContact = 0;
  let winner = null, endedAt = null, ending = null;

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (beforeTick) beforeTick(state);
    /**
     * ⚠️ THE DRIVER MUST NOT DECIDE DURING THE COUNTDOWN — the second instrument fault
     * this file found, and it is subtler than the `makeNav` one because it produces no
     * wrong number, only a WRONG PAIRING.
     *
     * `sim.ts` ignores `input` entirely while `phase === 'countdown'`. But the decision
     * loop still ran: every ~150 ms it called `decide()` and drew a fresh `rnd()` for the
     * next reaction interval. A 5.7 s countdown therefore burns ~38 draws from the seeded
     * stream before the whistle and a 3.7 s countdown burns ~25 — so **changing the
     * countdown re-seeds every match in the ladder**, and a paired before/after stops
     * being paired.
     *
     * Measured: with the loop live, `COUNTDOWN_FROM` 5 -> 3 moved 38 of 110 matchups,
     * max |Δ| 50.0 pp, while the approach itself moved +0.01 s and travel-to-contact
     * moved 1 wu of 630. Every one of those 38 was the RNG stream, not the game. With
     * the loop held, the same edit moves 0 of 110 — which is the answer the arithmetic
     * demands, since nothing in `stepMatch` reads absolute `elapsed` (`lastUsed`,
     * `lastDamagedAt` and both status stamps all start at `-Infinity`; every timer is an
     * accumulator from 0).
     *
     * This is `docs/LESSONS.md` §13 in its purest form: the instrument was coupling the
     * independent variable to its own noise source, and the result looked like a balance
     * finding. `--decide-during-countdown` reproduces the old behaviour.
     */
    const canAct = DECIDE_IN_COUNTDOWN || state.phase === 'playing';
    if (canAct && sinceDecision >= nextReact) {
      input = decide(state);
      sinceDecision = 0;
      nextReact = reactBase + (rnd() * 2 - 1) * reactJit;
    }
    const px0 = state.player.x, py0 = state.player.y;
    const evs = stepMatch(state, DT, input);
    if (canAct) sinceDecision += DT;
    const step = Math.hypot(state.player.x - px0, state.player.y - py0);
    playerTravel += step;

    for (const ev of evs) {
      if (ev.type === 'match-started') countdownMs = state.elapsed;
      else if (ev.type === 'match-ended') { winner = ev.winner; endedAt = state.elapsed; }
      else if (ev.type === 'death') ending = 'knockout';
      else if (ev.type === 'weapon-fired' && firstFirePlayMs === null) {
        firstFirePlayMs = MATCH_DURATION_MS - state.timeRemaining;
      } else if (ev.type === 'hit-landed' && firstHitPlayMs === null) {
        const k = ev.source?.kind;
        if (k === 'weapon' || k === 'trail') firstHitPlayMs = MATCH_DURATION_MS - state.timeRemaining;
      }
    }

    if (state.phase === 'playing') {
      playTicks++;
      const playMsNow = MATCH_DURATION_MS - state.timeRemaining;
      const engaged = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= engageRange;
      if (engaged) {
        engagedTicks++;
        if (contactPlayMs === null) { contactPlayMs = playMsNow; travelToContact = playerTravel; }
        deadRunMs = 0;
      } else if (contactPlayMs !== null) {
        // A dead RUN only counts once contact has happened at least once: the approach
        // is a different quantity with a different fix, and lumping them hides which.
        deadRunMs += DT;
        if (deadRunMs > longestDeadAfterContactMs) longestDeadAfterContactMs = deadRunMs;
      }
    }
  }

  const playMs = countdownMs === null ? 0 : (endedAt ?? state.elapsed) - countdownMs;
  const engagedMs = engagedTicks * DT;
  if (ending === null) ending = winner ? 'timeout' : 'UNRESOLVED';

  return {
    playerId, enemyId, policy, seed, winner, ending,
    engageRange,
    countdownMs: countdownMs ?? 0,
    playMs,
    sessionMs: (countdownMs ?? 0) + playMs,
    contactPlayMs,                       // null = never made contact
    contactSessionMs: contactPlayMs === null ? null : (countdownMs ?? 0) + contactPlayMs,
    firstFirePlayMs, firstHitPlayMs,
    engagedMs,
    engagedFracPlay: playTicks ? engagedTicks / playTicks : 0,
    dutyCycle: (countdownMs ?? 0) + playMs > 0 ? engagedMs / ((countdownMs ?? 0) + playMs) : 0,
    deadBeforeContactMs: contactPlayMs === null ? playMs : contactPlayMs,
    deadAfterContactMs: contactPlayMs === null ? 0 : Math.max(0, playMs - contactPlayMs - engagedMs),
    longestDeadAfterContactMs,
    playerTravelWU: playerTravel,
    travelToContactWU: travelToContact,
    hpLeft: { player: state.player.hp, enemy: state.enemy.hp },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : validate the instrument against inputs whose answer is derivable
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };

  console.log(`\n══ pacing_ladder SELFTEST — known-input validation ══`);
  console.log(`   sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}   clock ${MATCH_DURATION_MS / 1000}s   countdown ${COUNTDOWN_FROM}x1000+${COUNTDOWN_START_FLASH_MS}\n`);

  // A synthetic arena whose answers are derivable with a calculator, exactly the shape
  // `match-sim.mjs --selftest` uses: player at (200,500), scenery enemy pinned at
  // (1000,500), no cover, fog parked out of reach.
  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  const savedArena = arena, savedHaz = HAZ;
  arena = CLEAR; HAZ = null;

  const pin = (state) => {
    state.enemy.x = 1000; state.enemy.y = 500;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.lastUsed.fill(state.elapsed);
  };

  const ENGAGE = Math.max(maxNormalRange('hamburger') + HIT_RADIUS_VS_ENEMY,
    maxNormalRange('lollipop') + HIT_RADIUS_VS_PLAYER);
  const IDEAL_CONTACT_MS = (800 - ENGAGE) / PLAYER_SPEED;
  const IDEAL_COUNTDOWN_MS = COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS;
  const TOL = 3 * DT;

  const r = runMatch('hamburger', 'lollipop', 'chase', 0, { beforeTick: pin });

  // 1. The countdown is EXACTLY the two constants, and is measured as elapsed-before-play.
  ok('countdown = COUNTDOWN_FROM x 1000 + COUNTDOWN_START_FLASH_MS',
    Math.abs(r.countdownMs - IDEAL_COUNTDOWN_MS) <= TOL,
    `measured ${r.countdownMs.toFixed(0)}ms vs derived ${IDEAL_COUNTDOWN_MS}ms`);

  // 2. Time to contact on the MATCH CLOCK is the derivable closure, not the countdown.
  ok('contact on the MATCH CLOCK is the derived closure',
    r.contactPlayMs !== null && r.contactPlayMs >= Math.floor(IDEAL_CONTACT_MS) && r.contactPlayMs <= IDEAL_CONTACT_MS + TOL,
    `measured ${r.contactPlayMs?.toFixed(0)}ms vs derived ${IDEAL_CONTACT_MS.toFixed(0)}ms`);

  // 3. …and the SESSION figure is exactly that plus the countdown. This is the number
  //    the two source agents could each only see half of.
  ok('contact on the SESSION clock = countdown + match-clock contact',
    Math.abs(r.contactSessionMs - (r.countdownMs + r.contactPlayMs)) < 1e-6,
    `${r.contactSessionMs.toFixed(0)} = ${r.countdownMs.toFixed(0)} + ${r.contactPlayMs.toFixed(0)}`);

  // 4. The three pieces of a match must partition it exactly.
  const partition = r.deadBeforeContactMs + r.engagedMs + r.deadAfterContactMs;
  ok('deadBefore + engaged + deadAfter == playMs (the parts partition the match)',
    Math.abs(partition - r.playMs) <= 2 * DT,
    `${partition.toFixed(0)}ms vs playMs ${r.playMs.toFixed(0)}ms`);

  // 5. The duty cycle's denominator INCLUDES the countdown — that is the whole point.
  ok('dutyCycle uses the SESSION as denominator, not the match clock',
    Math.abs(r.dutyCycle - r.engagedMs / r.sessionMs) < 1e-9 && r.dutyCycle < r.engagedFracPlay,
    `duty ${(r.dutyCycle * 100).toFixed(1)}% vs engagedFracPlay ${(r.engagedFracPlay * 100).toFixed(1)}%`);

  // 6. An IDLE player against a pinned scenery enemy never makes contact: dead time is
  //    the whole match, and the instrument must say so rather than report 0.
  const idle = runMatch('hamburger', 'lollipop', 'idle', 0, { beforeTick: pin });
  ok('a player that never approaches shows contact=null and 100% dead before contact',
    idle.contactPlayMs === null && Math.abs(idle.deadBeforeContactMs - idle.playMs) < 1e-6 && idle.engagedMs === 0,
    `contact ${idle.contactPlayMs} · dead ${idle.deadBeforeContactMs.toFixed(0)}/${idle.playMs.toFixed(0)}ms`);

  // 7. Seed 0 is jitter-free => bit-identical on a re-run (the determinism the whole
  //    balance record depends on).
  const a = runMatch('pizza', 'soup', 'smart2', 0, { beforeTick: pin });
  const b = runMatch('pizza', 'soup', 'smart2', 0, { beforeTick: pin });
  ok('seed 0 is deterministic', a.playMs === b.playMs && a.contactPlayMs === b.contactPlayMs && a.engagedMs === b.engagedMs);

  // 8. Contact is symmetric in the ENGAGE definition: starting the fighters already
  //    inside engageRange must report contact at t=0 and a 100% engaged fraction.
  const together = (state) => {
    state.enemy.x = state.player.x + 10; state.enemy.y = state.player.y;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.lastUsed.fill(state.elapsed);
    state.player.lastUsed.fill(state.elapsed);
  };
  const t = runMatch('hamburger', 'lollipop', 'idle', 0, { beforeTick: together });
  ok('fighters starting in contact report contact at t=0 and ~100% engaged',
    t.contactPlayMs !== null && t.contactPlayMs <= DT * 2 && t.engagedFracPlay > 0.999,
    `contact ${t.contactPlayMs?.toFixed(0)}ms · engaged ${(t.engagedFracPlay * 100).toFixed(1)}%`);

  // 9. THE DISCRIMINATOR (docs/LESSONS.md §13). The historical driver — the one every
  //    `smart2`/`chase`/`kite` figure on record was taken with — runs its stuck detector
  //    through the countdown and starts the match walking SIDEWAYS. On a clear line,
  //    where nothing else can delay the approach, it must miss the derived closure; the
  //    fixed driver must hit it. If this ever stops discriminating, the guard above has
  //    stopped doing anything and this tool is measuring the instrument again.
  const buggyNav = makeNav(rng(1), { countdownStuckBug: true });
  const fixedNav = makeNav(rng(1), { countdownStuckBug: false });
  const driveWith = (nav) => {
    const state = createMatch(arena, 'hamburger', 'lollipop');
    let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    let since = Infinity, contact = null;
    while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS + 20000 && contact === null) {
      pin(state);
      if (since >= 150) { input = { move: nav(state, state.enemy.x, state.enemy.y), aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: false }; since = 0; }
      stepMatch(state, DT, input);
      since += DT;
      if (state.phase === 'playing' && dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= ENGAGE) {
        contact = MATCH_DURATION_MS - state.timeRemaining;
      }
    }
    return contact;
  };
  const tBug = driveWith(buggyNav), tFix = driveWith(fixedNav);
  ok('the HISTORICAL driver is late on a CLEAR line — the countdown detour is real',
    tBug !== null && tBug > IDEAL_CONTACT_MS + TOL,
    `bug ${tBug?.toFixed(0)}ms vs derived ${IDEAL_CONTACT_MS.toFixed(0)}ms = +${(tBug - IDEAL_CONTACT_MS).toFixed(0)}ms of sideways walking`);
  ok('the FIXED driver reproduces the derived closure exactly',
    tFix !== null && tFix >= Math.floor(IDEAL_CONTACT_MS) && tFix <= IDEAL_CONTACT_MS + TOL,
    `fix ${tFix?.toFixed(0)}ms vs derived ${IDEAL_CONTACT_MS.toFixed(0)}ms`);

  arena = savedArena; HAZ = savedHaz;
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// sweep
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const summary = {
  seeds: SEEDS, dt: DT, sim: SIM_DIR, arena: ARENA_PATH,
  clockMs: MATCH_DURATION_MS, countdownMs: COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS,
  maxSafeRadius: arena.maxSafeRadius,
  policies: {},
};
let nMatches = 0;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

for (const policy of POLICIES) {
  const rows = [];
  for (let s = 0; s < SEEDS; s++) {
    for (const p of CHARACTER_IDS) {
      for (const e of CHARACTER_IDS) {
        if (p === e) continue;
        rows.push(runMatch(p, e, policy, s));
        nMatches++;
      }
    }
  }

  const byMatchup = {};
  for (const r of rows) {
    const k = `${r.playerId}>${r.enemyId}`;
    (byMatchup[k] ??= { w: 0, n: 0, contact: [], duty: [], session: [] });
    byMatchup[k].n++;
    if (r.winner === 'player') byMatchup[k].w++;
    if (r.contactSessionMs !== null) byMatchup[k].contact.push(r.contactSessionMs);
    byMatchup[k].duty.push(r.dutyCycle);
    byMatchup[k].session.push(r.sessionMs);
  }
  const matchupRates = Object.fromEntries(Object.entries(byMatchup).map(([k, v]) => [k, v.w / v.n]));
  const matchupContact = Object.fromEntries(Object.entries(byMatchup).map(([k, v]) => [k, mean(v.contact)]));
  const matchupDuty = Object.fromEntries(Object.entries(byMatchup).map(([k, v]) => [k, mean(v.duty)]));

  const withContact = rows.filter((r) => r.contactPlayMs !== null);
  const plays = rows.map((r) => r.playMs).sort((a, b) => a - b);
  const q = (f) => plays[Math.min(plays.length - 1, Math.floor(plays.length * f))];
  /**
   * WHEN THE RING FIRST TOUCHES GROUND SOMEBODY COULD BE STANDING ON, and what share of
   * matches are still running then. `safeRadius = max(MIN, maxSafeRadius * (1 - progress))`
   * starts OUTSIDE the arena (993 vs a 860 half-diagonal), so for the opening seconds the
   * zone is not on the map at all. Two landmarks, both derived from the shipped schedule:
   * the SPAWN radius (the ring reaches where the fighters started) and the INSCRIBED
   * radius (the ring stops clipping corners and starts cutting the playfield).
   */
  const tAtR = (R) => (1 - R / arena.maxSafeRadius) * MATCH_DURATION_MS;
  const spawnR = Math.hypot(arena.playerSpawn.x - arena.center.x, arena.playerSpawn.y - arena.center.y);
  const inscribedR = Math.min(arena.width, arena.height) / 2;
  const ringAtSpawnMs = tAtR(spawnR), ringAtInscribedMs = tAtR(inscribedR);
  summary.policies[policy] = {
    n: rows.length,
    playerWinRate: rows.filter((r) => r.winner === 'player').length / rows.length,
    timeouts: rows.filter((r) => r.ending === 'timeout').length,
    unresolved: rows.filter((r) => r.ending === 'UNRESOLVED').length,
    neverContacted: rows.length - withContact.length,

    meanCountdownMs: mean(rows.map((r) => r.countdownMs)),
    meanPlayMs: mean(rows.map((r) => r.playMs)),
    meanSessionMs: mean(rows.map((r) => r.sessionMs)),

    meanContactPlayMs: mean(withContact.map((r) => r.contactPlayMs)),
    meanContactSessionMs: mean(withContact.map((r) => r.contactSessionMs)),
    medianContactSessionMs: median(withContact.map((r) => r.contactSessionMs)),
    meanFirstFirePlayMs: mean(rows.filter((r) => r.firstFirePlayMs !== null).map((r) => r.firstFirePlayMs)),
    meanFirstHitPlayMs: mean(rows.filter((r) => r.firstHitPlayMs !== null).map((r) => r.firstHitPlayMs)),

    meanEngagedMs: mean(rows.map((r) => r.engagedMs)),
    meanEngagedFracPlay: mean(rows.map((r) => r.engagedFracPlay)),
    meanDutyCycle: mean(rows.map((r) => r.dutyCycle)),

    meanDeadBeforeMs: mean(rows.map((r) => r.deadBeforeContactMs)),
    meanDeadAfterMs: mean(rows.map((r) => r.deadAfterContactMs)),
    meanLongestDeadAfterMs: mean(rows.map((r) => r.longestDeadAfterContactMs)),
    deadFracSession: mean(rows.map((r) => 1 - r.dutyCycle)),

    p50PlayMs: q(0.5), p90PlayMs: q(0.9), maxPlayMs: plays[plays.length - 1],
    ringAtSpawnMs, ringAtInscribedMs,
    shareAliveAtRingSpawn: rows.filter((r) => r.playMs >= ringAtSpawnMs).length / rows.length,
    shareAliveAtRingInscribed: rows.filter((r) => r.playMs >= ringAtInscribedMs).length / rows.length,
    meanTravelToContactWU: mean(withContact.map((r) => r.travelToContactWU)),
    meanTravelWU: mean(rows.map((r) => r.playerTravelWU)),

    matchupRates, matchupContact, matchupDuty,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
const s = (ms) => `${(ms / 1000).toFixed(2)}s`;
const ds = (ms) => `${ms >= 0 ? '+' : ''}${(ms / 1000).toFixed(2)}s`;

console.log(`\n╔══ PACING LADDER ══ ${nMatches} matches · ${SEEDS} seeds × 110 matchups × ${POLICIES.length} policies · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`║ sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`║ arena ${ARENA_PATH.replace(ROOT + '/', '')} ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius} · clock ${MATCH_DURATION_MS / 1000}s · countdown ${(summary.countdownMs / 1000).toFixed(2)}s · HP ${PLAYER_MAX_HP}/${ENEMY_MAX_HP}`);
console.log(`╚══════════════════════════════════════════════════════════════════════════`);

const baseline = args.baseline ? JSON.parse(readFileSync(String(args.baseline), 'utf8')) : null;
if (baseline) {
  console.log(`  baseline: clock ${baseline.clockMs / 1000}s · countdown ${(baseline.countdownMs / 1000).toFixed(2)}s · maxSafeRadius ${baseline.maxSafeRadius} · seeds ${baseline.seeds}`);
  if (baseline.seeds !== SEEDS) console.log(`  ⚠️  SEED COUNT DIFFERS (${baseline.seeds} vs ${SEEDS}) — the paired comparison is NOT paired. Re-run.`);
}

for (const policy of POLICIES) {
  const P = summary.policies[policy];
  const B = baseline?.policies?.[policy] ?? null;
  const d = (f) => (B ? ` (${ds(f(P) - f(B))})` : '');
  const dp = (f) => (B ? ` (${pp(f(P) - f(B))}pp)` : '');

  console.log(`\n══════ POLICY ${policy.toUpperCase()} ── ${P.n} matches ══════`);
  console.log(`  THE SHAPE OF A MATCH, from pressing PLAY:`);
  console.log(`    countdown           ${s(P.meanCountdownMs).padStart(7)}${d((x) => x.meanCountdownMs)}   nothing happens, by construction`);
  console.log(`    then walking        ${s(P.meanContactPlayMs).padStart(7)}${d((x) => x.meanContactPlayMs)}   match clock, to first moment either can reach`);
  console.log(`    => FIRST CONTACT AT ${s(P.meanContactSessionMs).padStart(7)}${d((x) => x.meanContactSessionMs)}   of the session   (median ${s(P.medianContactSessionMs)})`);
  console.log(`    first shot fired    ${s(P.meanFirstFirePlayMs).padStart(7)}${d((x) => x.meanFirstFirePlayMs)}   ·  first damage ${s(P.meanFirstHitPlayMs)}${d((x) => x.meanFirstHitPlayMs)}  (match clock)`);
  console.log(`    play length         ${s(P.meanPlayMs).padStart(7)}${d((x) => x.meanPlayMs)}   ·  SESSION ${s(P.meanSessionMs)}${d((x) => x.meanSessionMs)}`);
  console.log(`  WHERE THE TIME GOES:`);
  console.log(`    engaged (in reach)  ${s(P.meanEngagedMs).padStart(7)}${d((x) => x.meanEngagedMs)}   = ${pct(P.meanEngagedFracPlay)} of play, ${pct(P.meanDutyCycle)} of SESSION${dp((x) => x.meanDutyCycle)}  <- DUTY CYCLE`);
  console.log(`    dead BEFORE contact ${s(P.meanDeadBeforeMs).padStart(7)}${d((x) => x.meanDeadBeforeMs)}   the approach`);
  console.log(`    dead AFTER contact  ${s(P.meanDeadAfterMs).padStart(7)}${d((x) => x.meanDeadAfterMs)}   disengagement (longest single gap ${s(P.meanLongestDeadAfterMs)})`);
  console.log(`    never made contact  ${String(P.neverContacted).padStart(4)}/${P.n}`);
  console.log(`    travel to contact   ${P.meanTravelToContactWU.toFixed(0).padStart(5)}wu   of ${P.meanTravelWU.toFixed(0)}wu total`);
  console.log(`  DOES THE ZONE EVER FORCE ANYTHING?  play p50 ${s(P.p50PlayMs)} · p90 ${s(P.p90PlayMs)} · max ${s(P.maxPlayMs)}`);
  console.log(`    ring reaches the SPAWN radius at ${s(P.ringAtSpawnMs)} of the match clock — ${pct(P.shareAliveAtRingSpawn)} of matches are still running`);
  console.log(`    ring reaches the INSCRIBED radius at ${s(P.ringAtInscribedMs)} — ${pct(P.shareAliveAtRingInscribed)} still running`);
  console.log(`  BALANCE (declared on the same runs):`);
  console.log(`    player win rate     ${pct(P.playerWinRate)}${B ? `   was ${pct(B.playerWinRate)}, ${pp(P.playerWinRate - B.playerWinRate)}pp` : ''}   ·  timeouts ${P.timeouts}/${P.n}  ·  unresolved ${P.unresolved}`);

  if (B) {
    const ks = Object.keys(P.matchupRates);
    const dw = ks.map((k) => (P.matchupRates[k] ?? 0) - (B.matchupRates[k] ?? 0));
    const absw = dw.map(Math.abs);
    const moved = absw.filter((x) => x > 1e-9).length;
    const dc = ks.map((k) => (P.matchupContact[k] ?? 0) - (B.matchupContact[k] ?? 0));
    console.log(`  PAIRED per-matchup deltas (same seeds, same matchups — exact, not a sample):`);
    console.log(`    win rate   max |Δ| ${pp(Math.max(...absw))}pp · mean |Δ| ${pp(absw.reduce((a, b) => a + b, 0) / absw.length)}pp · ${moved}/${ks.length} matchups moved at all`);
    console.log(`    contact    max |Δ| ${ds(Math.max(...dc.map(Math.abs)))} · mean Δ ${ds(dc.reduce((a, b) => a + b, 0) / dc.length)}`);
    if (moved === 0) console.log(`    ** every one of the ${ks.length} matchups is BIT-IDENTICAL — this change cannot have moved balance. **`);
  }
}

console.log('');
if (args.json) { writeFileSync(String(args.json), JSON.stringify(summary, null, 2)); console.log(`wrote ${args.json}\n`); }
