#!/usr/bin/env node
/**
 * ROSTER TABLE — per-CHARACTER win rate, in the player's hands and in the AI's, with
 * the per-matchup spread, against the real `src/game/sim.ts` and the shipped arena.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `07a4e3a` bounded an undodgeable status lock (4 of 5 stun weapons and 8 of 10 slow
 * weapons held their own status up forever). That bug was CARRYING characters, and
 * removing it re-sorted the roster: player-Pizza went 98.8% -> 63.1% on Cheese Blind
 * alone. Nobody re-measured the other ten. Every existing instrument reports the
 * AGGREGATE (`playerWinRate`) or a flat `matchupRates` map; none of them answers
 * "which character is broken, and in which direction".
 *
 * ── What it reports, and why each column ────────────────────────────────────
 *
 *   asPlayer   win rate over the 10 matchups where this character is the HUMAN's,
 *              i.e. driven by the scripted policy against a 150 HP AI.
 *   asAI       win rate over the 10 matchups where this character is the ENEMY,
 *              i.e. driven by `ai.ts` against a 100 HP scripted human. This is
 *              `1 - matchupRate[other>this]`, so the two columns are the SAME matches
 *              read from opposite ends and a character that is simply "good" moves
 *              both.
 *   strength   (asPlayer + asAI) / 2 — the role-symmetric index. The HP pools are
 *              asymmetric (100 vs 150) and so are the two drivers, so neither column
 *              alone separates "this character is strong" from "this ROLE is strong".
 *              A roster defect shows up as a character far from the roster mean on
 *              BOTH, or violently split between them (which is a driver defect, not a
 *              balance one — see `docs/LESSONS.md` §13).
 *   spread     min..max of the 10 per-matchup rates in that role. A character at 50%
 *              overall made of five 100%s and five 0%s is not balanced; it is two
 *              different characters.
 *
 * ⚠️ `hit/fire` is HIT EVENTS per PRESS, not accuracy: a 5-pellet weapon that lands two
 * pellets reads 2.0, and Donut's trail marks are counted as damage but not as hits. It
 * separates "fires a lot and misses" from "fires rarely"; it is not a hit rate.
 *
 * Mechanism columns (dmg/fires/hits/status applied) exist so an outlier can be
 * explained rather than merely named — the brief that commissioned this asks for the
 * mechanism, not the number.
 *
 * ── Method ──────────────────────────────────────────────────────────────────
 *
 * 110 matchups x N seeds x P policies through `stepMatch`. The scripted player and its
 * seeded jitter are LIFTED VERBATIM from `tools/tmp/status_census.mjs` (lines 123-378),
 * which lifted `smart2` from `tools/tmp/arena_probe.mjs`; seed 0 is jitter-free and
 * reproduces `tools/match-sim.mjs` exactly. Keeping the driver byte-identical is what
 * makes these numbers comparable to every figure in `07a4e3a`'s commit message.
 *
 * ⚠️ `match-sim.mjs` documents its scripted player as "the shape of a match, not a skill
 * benchmark": perfect information, fixed 150 ms reaction, and `bestWeapon` picks the
 * highest-DAMAGE weapon in range and therefore never picks a low-damage weapon for its
 * STATUS. So a character whose kit is control-first is systematically under-driven here.
 * That is a limit of the instrument, not a finding about the character — `--why <id>`
 * prints the per-weapon usage that lets you tell the two apart.
 *
 *   node tools/tmp/roster_table.mjs --seeds 16 --policies smart2,chase,kite,survive
 *   node tools/tmp/roster_table.mjs --seeds 16 --json /tmp/before.json
 *   node tools/tmp/roster_table.mjs --seeds 16 --sim /tmp/staged/game --baseline /tmp/before.json
 *   node tools/tmp/roster_table.mjs --selftest        # known-input validation, no arena
 *
 * `--baseline` prints a PAIRED comparison: same arena, same seeds, same matchups, so a
 * per-matchup delta is exact rather than two independent samples of a noisy mean.
 * `docs/LESSONS.md`: the aggregate win rate is unresolvable below ~9 pp, but a paired
 * per-matchup delta is not a sample at all.
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

/** Which sim to drive. `--sim <dir>` points at a `tools/tmp/stage_rules.mjs` copy so a
 *  candidate constant is measured without editing the shared tree. */
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, PLAYER_MAX_HP, ENEMY_MAX_HP,
} = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
// `arena.maxSafeRadius` is DERIVED from MATCH_DURATION_MS in `arena/shared.ts`, so a
// cached dump goes stale the moment the clock moves. Recompute from the same formula.
const HALF_DIAG = Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2);
const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S
const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));
const arena = {
  ...ARENA_DATA,
  maxSafeRadius: Number(args.maxsafe ?? derivedMaxSafe),
  build: () => null, update: () => {},
};
const HAZ = arena.hazards.find((h) => h.kind === 'damage');

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 16);
const POLICIES = String(args.policies ?? 'smart2,chase,kite,survive').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// seeded rng — mulberry32, identical to status_census.mjs
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

function makeNav(rnd) {
  const hist = [];
  let detourUntil = -1, detourSign = rnd() < 0.5 ? 1 : -1;
  return function walk(state, targetX, targetY) {
    const p = state.player;
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

const POLICY_FNS = {
  idle: () => () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }),

  chase: (rnd) => {
    const nav = makeNav(rnd);
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

  smart: (rnd) => {
    const nav = makeNav(rnd);
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
      } else if (!los) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
        target = { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
      } else if (d > band) {
        target = { x: e.x, y: e.y };
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

  /**
   * SMART2 — `smart` with ONE clause reordered: range before line of sight.
   *
   * `smart` asks "can I see them?" before "am I close enough?", and across 1,100 wu of a
   * 27-box arena something is always in the line — so it takes the no-LOS branch, strafes
   * perpendicular into a prop and stands there for the whole match. Its "time to first
   * contact" is therefore not a closure time at all; it is the ENEMY's route length
   * divided by AI_CHASE_SPEED, with the player as scenery. Two layouts with identical
   * route length scored 8.8 s and 15.1 s purely on which prop stopped the strafe.
   *
   * Verbatim from `tools/tmp/arena_probe.mjs`, where the defect was found. Kept as a
   * SEPARATE policy rather than a fix to `smart`, so every number already on record
   * stays comparable.
   */
  smart2: (rnd) => {
    const nav = makeNav(rnd);
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
        target = { x: e.x, y: e.y };                       // CLOSE first — the reordered clause
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

  /**
   * SURVIVE — the ceiling on human passivity: circle inside the safe disc at max speed,
   * stay outside the pot, and never let the AI (70 wu/s chase against the player's 120)
   * close. It exists for ONE question — is the 45 s whistle reachable at all by a human,
   * or only by making both fighters immortal? `kite` answers "a player who merely runs
   * away dies to the fog"; this answers "and a player who runs away CORRECTLY?".
   */
  survive: (rnd) => {
    // ANALOG axes, not the 8-direction keyboard quantisation the other policies use:
    // the shipped twin sticks (`src/game/touch.ts`) are analog, so this is a real input
    // a real player can produce, not an oracle. No `nav` detour either — its stuck
    // detector fights a policy whose whole job is to keep moving.
    let jitter = rnd() * Math.PI * 2;
    return (state) => {
      const p = state.player, e = state.enemy;
      const cx = arena.center.x, cy = arena.center.y;
      const R = state.safeRadius;
      const potR = HAZ ? HAZ.radius : 0;
      let vx = 0, vy = 0;
      // 1. away from the enemy, hardest when close
      const de = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const wEnemy = Math.min(3, 260 / de);
      vx += ((p.x - e.x) / de) * wEnemy;
      vy += ((p.y - e.y) / de) * wEnemy;
      // 2. toward the ring centre, hardest near the edge
      const dc = Math.hypot(p.x - cx, p.y - cy) || 1;
      const margin = R - dc;
      const wRing = margin < 140 ? 4 * (1 - Math.max(0, margin) / 140) : 0;
      vx += ((cx - p.x) / dc) * wRing;
      vy += ((cy - p.y) / dc) * wRing;
      // 3. out of the pot
      if (HAZ) {
        const dp = Math.hypot(p.x - HAZ.x, p.y - HAZ.y) || 1;
        if (dp < potR + 45) { const w = 3; vx += ((p.x - HAZ.x) / dp) * w; vy += ((p.y - HAZ.y) / dp) * w; }
      }
      // 4. a tangential component so "away from the enemy" does not walk into a wall
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

  /**
   * KITE — the policy the others cannot express: never close, always retreat, use the
   * self-heal, and keep the ring at arm's length. It exists to answer "dead against the
   * script, or dead against a human?" for the regen / timeout / final-ring family. A
   * human who is losing plays roughly this.
   */
  kite: (rnd) => {
    const nav = makeNav(rnd);
    return (state) => {
      const p = state.player, e = state.enemy;
      const cx = arena.center.x, cy = arena.center.y;
      const R = state.safeRadius;
      const dc = dist(p.x, p.y, cx, cy);
      // Run from the enemy, biased back toward the ring centre so the fog does not do
      // the enemy's job for it.
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
// one match — lean. Only what a ROSTER question needs.
// ─────────────────────────────────────────────────────────────────────────────
function runMatch(playerId, enemyId, policy, seed) {
  // Identical seeding to status_census.mjs, so a row here and a row there are the
  // same match and can be cross-checked.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = POLICY_FNS[policy](rnd);
  const reactBase = 150;
  const reactJit = seed === 0 ? 0 : 60;

  const pReach = maxNormalRange(playerId), eReach = maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let sinceDecision = Infinity;
  let nextReact = reactBase;

  const m = {
    playerId, enemyId, policy, seed,
    winner: null, ending: null, startedAt: null, endedAt: null,
    playTicks: 0, engagedTicks: 0,
    firstBloodMs: null,
    hpLeft: { player: 0, enemy: 0 },
    // dealt = damage this role INFLICTED on the other (weapon sources only for `wpn`)
    dealt: { player: 0, enemy: 0 },
    dealtWeapon: { player: 0, enemy: 0 },
    fires: { player: 0, enemy: 0 },
    hits: { player: 0, enemy: 0 },
    zoneDamage: { player: 0, enemy: 0 },   // fog + pot TAKEN, credited to nobody
    firesByWeapon: { player: {}, enemy: {} },
    hitsByWeapon: { player: {}, enemy: {} },
    // status APPLIED BY this role to the other (an application that the grace rule
    // refused is not counted — that is the whole point of measuring it after 07a4e3a)
    stunApplied: { player: 0, enemy: 0 },
    slowApplied: { player: 0, enemy: 0 },
    stunTicks: { player: 0, enemy: 0 },   // ticks this role SPENT stunned
    slowTicks: { player: 0, enemy: 0 },
  };

  const other = (r) => (r === 'player' ? 'enemy' : 'player');
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (sinceDecision >= nextReact) {
      input = decide(state);
      sinceDecision = 0;
      nextReact = reactBase + (rnd() * 2 - 1) * reactJit;
    }
    const pre = {
      player: { st: state.player.status.stunnedUntil, sl: state.player.status.slowedUntil },
      enemy: { st: state.enemy.status.stunnedUntil, sl: state.enemy.status.slowedUntil },
    };
    const evs = stepMatch(state, DT, input);
    sinceDecision += DT;

    for (const ev of evs) {
      if (ev.type === 'match-started') m.startedAt = state.elapsed;
      else if (ev.type === 'match-ended') { m.winner = ev.winner; m.endedAt = state.elapsed; }
      else if (ev.type === 'weapon-fired') {
        m.fires[ev.fighterRole]++;
        const b = m.firesByWeapon[ev.fighterRole];
        b[ev.weaponKey] = (b[ev.weaponKey] ?? 0) + 1;
      } else if (ev.type === 'hit-landed') {
        // `source` is a DISCRIMINATED UNION (`{kind:'weapon'|'trail'|'hazard'|'fog'}`),
        // not a string. Comparing it to `'weapon'` is always false and silently reports
        // every weapon hit as zero — caught by the mechanism table printing 0.0 hits for
        // a character that plainly kills things. Read `.kind`.
        const src = ev.source?.kind ?? 'unknown';
        const dealer = src === 'trail' ? ev.source.ownerRole : other(ev.targetRole);
        // fog/hazard damage belongs to nobody: it is credited to the ZONE, not a fighter.
        if (src === 'weapon' || src === 'trail') {
          m.dealt[dealer] += ev.amount;
          if (src === 'weapon') {
            m.dealtWeapon[dealer] += ev.amount;
            m.hits[dealer]++;
            const b = m.hitsByWeapon[dealer];
            b[ev.source.weaponKey] = (b[ev.source.weaponKey] ?? 0) + 1;
          }
        } else {
          m.zoneDamage[ev.targetRole] += ev.amount;
        }
        if (m.firstBloodMs === null) m.firstBloodMs = state.elapsed;
      } else if (ev.type === 'death') {
        m.ending = 'knockout';
      }
    }

    // Status APPLICATIONS, read off the timestamps rather than the event, because
    // `hit-landed.effect` describes what the WEAPON does and says nothing about
    // whether the grace rule refused it (combat.ts:applyDamage).
    for (const role of ['player', 'enemy']) {
      const st = state[role].status;
      if (st.stunnedUntil > pre[role].st) m.stunApplied[other(role)]++;
      if (st.slowedUntil > pre[role].sl) m.slowApplied[other(role)]++;
      if (state.phase === 'playing') {
        if (state.elapsed < st.stunnedUntil) m.stunTicks[role]++;
        if (state.elapsed < st.slowedUntil) m.slowTicks[role]++;
      }
    }

    if (state.phase === 'playing') {
      m.playTicks++;
      if (dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= engageRange) m.engagedTicks++;
    }
  }

  m.hpLeft.player = state.player.hp;
  m.hpLeft.enemy = state.enemy.hp;
  m.playMs = m.startedAt === null ? 0 : (m.endedAt ?? state.elapsed) - m.startedAt;
  if (m.ending === null) m.ending = m.winner ? 'timeout' : 'UNRESOLVED';
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validate the instrument against a KNOWN input before believing it on an
// unknown one (docs/LESSONS.md §13). Three properties that must hold by construction.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => { if (cond) { pass++; } else { fail++; console.log(`  FAIL ${name} ${detail}`); } };

  // 1. asPlayer and asAI must be reads of the SAME matches from opposite ends: the
  //    roster mean of asPlayer and the roster mean of (1 - asAI) must be identical.
  const rows = [];
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) { if (p !== e) rows.push(runMatch(p, e, 'smart2', 0)); }
  const pw = rows.filter((r) => r.winner === 'player').length / rows.length;
  const ew = rows.filter((r) => r.winner === 'enemy').length / rows.length;
  ok('roles partition', Math.abs(pw + ew - 1) < 1e-9 || rows.some((r) => r.winner === null), `p=${pw} e=${ew}`);

  // 2. Seed 0 is jitter-free => bit-identical on a re-run.
  const a = runMatch('pizza', 'soup', 'smart2', 0), b = runMatch('pizza', 'soup', 'smart2', 0);
  ok('seed 0 deterministic', a.winner === b.winner && a.playMs === b.playMs && a.dealt.player === b.dealt.player);

  // 3. The idle-player control: `survive` never attacks, so it must deal ZERO weapon
  //    damage. If this ever prints non-zero the driver is not doing what it says.
  const s = runMatch('donut', 'egg', 'survive', 0);
  ok('survive fires nothing', s.fires.player === 0, `fires=${s.fires.player}`);

  // 4. Every fire is attributable to a weapon this character owns.
  const keys = new Set(CHARACTERS.pizza.weapons.map((w) => w.key));
  const pz = runMatch('pizza', 'taco', 'chase', 0);
  ok('fires attribute to owned weapons', Object.keys(pz.firesByWeapon.player).every((k) => keys.has(k)));

  console.log(`\nroster_table selftest: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// sweep
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const summary = { seeds: SEEDS, dt: DT, sim: SIM_DIR, arena: ARENA_PATH, policies: {} };
let nMatches = 0;

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

  // per-matchup player win rate
  const byMatchup = {};
  for (const r of rows) {
    const k = `${r.playerId}>${r.enemyId}`;
    (byMatchup[k] ??= { w: 0, n: 0 });
    byMatchup[k].n++;
    if (r.winner === 'player') byMatchup[k].w++;
  }
  const matchupRates = Object.fromEntries(Object.entries(byMatchup).map(([k, v]) => [k, v.w / v.n]));

  // per-character, per-role mechanism accumulators
  const blank = () => ({
    n: 0, wins: 0, dealt: 0, dealtWeapon: 0, taken: 0, zone: 0, fires: 0, hits: 0,
    stunApplied: 0, slowApplied: 0, stunTicks: 0, slowTicks: 0, hpLeft: 0, playMs: 0,
    firesByWeapon: {}, hitsByWeapon: {},
  });
  const chars = Object.fromEntries(CHARACTER_IDS.map((id) => [id, { asPlayer: blank(), asAI: blank() }]));
  for (const r of rows) {
    const P = chars[r.playerId].asPlayer, E = chars[r.enemyId].asAI;
    P.n++; E.n++;
    if (r.winner === 'player') P.wins++;
    if (r.winner === 'enemy') E.wins++;
    P.dealt += r.dealt.player; E.dealt += r.dealt.enemy;
    P.dealtWeapon += r.dealtWeapon.player; E.dealtWeapon += r.dealtWeapon.enemy;
    P.taken += r.dealt.enemy; E.taken += r.dealt.player;
    P.zone += r.zoneDamage.player; E.zone += r.zoneDamage.enemy;
    P.fires += r.fires.player; E.fires += r.fires.enemy;
    P.hits += r.hits.player; E.hits += r.hits.enemy;
    P.stunApplied += r.stunApplied.player; E.stunApplied += r.stunApplied.enemy;
    P.slowApplied += r.slowApplied.player; E.slowApplied += r.slowApplied.enemy;
    P.stunTicks += r.stunTicks.player; E.stunTicks += r.stunTicks.enemy;
    P.slowTicks += r.slowTicks.player; E.slowTicks += r.slowTicks.enemy;
    P.hpLeft += r.hpLeft.player; E.hpLeft += r.hpLeft.enemy;
    P.playMs += r.playMs; E.playMs += r.playMs;
    for (const [k, v] of Object.entries(r.firesByWeapon.player)) P.firesByWeapon[k] = (P.firesByWeapon[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.firesByWeapon.enemy)) E.firesByWeapon[k] = (E.firesByWeapon[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.hitsByWeapon.player)) P.hitsByWeapon[k] = (P.hitsByWeapon[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.hitsByWeapon.enemy)) E.hitsByWeapon[k] = (E.hitsByWeapon[k] ?? 0) + v;
  }

  // per-role spread across the 10 opponents
  const perChar = {};
  for (const id of CHARACTER_IDS) {
    const asP = CHARACTER_IDS.filter((o) => o !== id).map((o) => matchupRates[`${id}>${o}`]);
    const asA = CHARACTER_IDS.filter((o) => o !== id).map((o) => 1 - matchupRates[`${o}>${id}`]);
    const P = chars[id].asPlayer, E = chars[id].asAI;
    perChar[id] = {
      asPlayer: P.wins / P.n, asAI: E.wins / E.n,
      strength: (P.wins / P.n + E.wins / E.n) / 2,
      spreadPlayer: [Math.min(...asP), Math.max(...asP)],
      spreadAI: [Math.min(...asA), Math.max(...asA)],
      perEnemy: Object.fromEntries(CHARACTER_IDS.filter((o) => o !== id).map((o) => [o, matchupRates[`${id}>${o}`]])),
      perPlayer: Object.fromEntries(CHARACTER_IDS.filter((o) => o !== id).map((o) => [o, 1 - matchupRates[`${o}>${id}`]])),
      mech: {
        player: {
          dealt: P.dealt / P.n, dealtWeapon: P.dealtWeapon / P.n, taken: P.taken / P.n, zone: P.zone / P.n,
          fires: P.fires / P.n, hits: P.hits / P.n, hitRate: P.hits / Math.max(1, P.fires),
          stunApplied: P.stunApplied / P.n, slowApplied: P.slowApplied / P.n,
          stunnedMs: (P.stunTicks / P.n) * DT, slowedMs: (P.slowTicks / P.n) * DT,
          hpLeft: P.hpLeft / P.n, playMs: P.playMs / P.n,
          firesByWeapon: Object.fromEntries(Object.entries(P.firesByWeapon).map(([k, v]) => [k, v / P.n])),
          hitsByWeapon: Object.fromEntries(Object.entries(P.hitsByWeapon).map(([k, v]) => [k, v / P.n])),
        },
        ai: {
          dealt: E.dealt / E.n, dealtWeapon: E.dealtWeapon / E.n, taken: E.taken / E.n, zone: E.zone / E.n,
          fires: E.fires / E.n, hits: E.hits / E.n, hitRate: E.hits / Math.max(1, E.fires),
          stunApplied: E.stunApplied / E.n, slowApplied: E.slowApplied / E.n,
          stunnedMs: (E.stunTicks / E.n) * DT, slowedMs: (E.slowTicks / E.n) * DT,
          hpLeft: E.hpLeft / E.n, playMs: E.playMs / E.n,
          firesByWeapon: Object.fromEntries(Object.entries(E.firesByWeapon).map(([k, v]) => [k, v / E.n])),
          hitsByWeapon: Object.fromEntries(Object.entries(E.hitsByWeapon).map(([k, v]) => [k, v / E.n])),
        },
      },
    };
  }

  summary.policies[policy] = {
    n: rows.length,
    playerWinRate: rows.filter((r) => r.winner === 'player').length / rows.length,
    timeouts: rows.filter((r) => r.ending === 'timeout').length,
    unresolved: rows.filter((r) => r.ending === 'UNRESOLVED').length,
    meanPlayMs: rows.reduce((a, r) => a + r.playMs, 0) / rows.length,
    matchupRates, perChar,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
const elapsedS = (Date.now() - t0) / 1000;

console.log(`\n╔══ ROSTER TABLE ══ ${nMatches} matches · ${SEEDS} seeds × 110 matchups × ${POLICIES.length} policies · ${elapsedS.toFixed(1)}s`);
console.log(`║ sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`║ arena ${ARENA_PATH.replace(ROOT + '/', '')} ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius} · clock ${MATCH_DURATION_MS / 1000}s · HP ${PLAYER_MAX_HP}/${ENEMY_MAX_HP}`);
console.log(`╚══════════════════════════════════════════════════════════════════════════`);

const baseline = args.baseline ? JSON.parse(readFileSync(String(args.baseline), 'utf8')) : null;

for (const policy of POLICIES) {
  const P = summary.policies[policy];
  const B = baseline?.policies?.[policy] ?? null;
  console.log(`\n══════ POLICY ${policy.toUpperCase()} ── ${P.n} matches · aggregate player win ${pct(P.playerWinRate)}${B ? `  (was ${pct(B.playerWinRate)}, ${pp(P.playerWinRate - B.playerWinRate)}pp)` : ''} ══════`);
  console.log(`  ${'character'.padEnd(12)}${'asPlayer'.padStart(9)}${'spread'.padStart(14)}${'asAI'.padStart(8)}${'spread'.padStart(14)}${'strength'.padStart(10)}${B ? '   Δplayer   ΔasAI  Δstrength' : ''}`);
  const order = [...CHARACTER_IDS].sort((a, b) => P.perChar[b].strength - P.perChar[a].strength);
  for (const id of order) {
    const c = P.perChar[id];
    let d = '';
    if (B) {
      const b = B.perChar[id];
      d = `   ${pp(c.asPlayer - b.asPlayer).padStart(7)} ${pp(c.asAI - b.asAI).padStart(7)} ${pp(c.strength - b.strength).padStart(9)}`;
    }
    console.log(`  ${id.padEnd(12)}${pct(c.asPlayer).padStart(9)}${`${pct(c.spreadPlayer[0])}..${pct(c.spreadPlayer[1])}`.padStart(14)}` +
      `${pct(c.asAI).padStart(8)}${`${pct(c.spreadAI[0])}..${pct(c.spreadAI[1])}`.padStart(14)}${pct(c.strength).padStart(10)}${d}`);
  }
  const strengths = CHARACTER_IDS.map((id) => P.perChar[id].strength);
  const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  const sd = Math.sqrt(strengths.reduce((a, b) => a + (b - mean) ** 2, 0) / strengths.length);
  console.log(`  ${'—'.padEnd(12)} roster strength mean ${pct(mean)} · sd ${(sd * 100).toFixed(1)}pp · range ${pct(Math.min(...strengths))}..${pct(Math.max(...strengths))} = ${((Math.max(...strengths) - Math.min(...strengths)) * 100).toFixed(1)}pp`);

  if (args.mech) {
    console.log(`\n  ── MECHANISM (per match) ──────────────────────────────────────────────`);
    console.log(`  ${'character'.padEnd(12)}${'role'.padEnd(7)}${'dmg'.padStart(7)}${'wpnDmg'.padStart(8)}${'taken'.padStart(7)}${'zone'.padStart(6)}${'fires'.padStart(7)}${'hits'.padStart(7)}${'hit/fire'.padStart(9)}${'stunApp'.padStart(8)}${'slowApp'.padStart(8)}${'stunnedS'.padStart(9)}${'slowedS'.padStart(8)}${'play'.padStart(7)}`);
    for (const id of order) {
      for (const role of ['player', 'ai']) {
        const m = P.perChar[id].mech[role];
        console.log(`  ${(role === 'player' ? id : '').padEnd(12)}${role.padEnd(7)}${m.dealt.toFixed(1).padStart(7)}${m.dealtWeapon.toFixed(1).padStart(8)}${m.taken.toFixed(1).padStart(7)}${m.zone.toFixed(1).padStart(6)}` +
          `${m.fires.toFixed(1).padStart(7)}${m.hits.toFixed(1).padStart(7)}${m.hitRate.toFixed(2).padStart(9)}${m.stunApplied.toFixed(2).padStart(8)}${m.slowApplied.toFixed(2).padStart(8)}` +
          `${(m.stunnedMs / 1000).toFixed(2).padStart(9)}${(m.slowedMs / 1000).toFixed(2).padStart(8)}${(m.playMs / 1000).toFixed(1).padStart(7)}`);
      }
    }
  }

  if (args.why) {
    const id = String(args.why);
    const c = P.perChar[id];
    console.log(`\n  ── WHY ${id.toUpperCase()} ──────────────────────────────────────────────`);
    console.log(`     as PLAYER vs: ${CHARACTER_IDS.filter((o) => o !== id).map((o) => `${o} ${pct(c.perEnemy[o])}`).join(' · ')}`);
    console.log(`     as AI     vs: ${CHARACTER_IDS.filter((o) => o !== id).map((o) => `${o} ${pct(c.perPlayer[o])}`).join(' · ')}`);
    for (const role of ['player', 'ai']) {
      const m = c.mech[role];
      const ks = CHARACTERS[id].weapons.map((w) => w.key);
      console.log(`     ${role.padEnd(6)} weapon fires/match: ${ks.map((k) => `${k} ${(m.firesByWeapon[k] ?? 0).toFixed(2)}`).join(' · ')}`);
    }
  }

  if (B) {
    // PAIRED per-matchup deltas: same arena, same seeds, same matchups.
    const ks = Object.keys(P.matchupRates);
    const deltas = ks.map((k) => ({ k, d: P.matchupRates[k] - (B.matchupRates[k] ?? 0) }));
    const moved = deltas.filter((x) => Math.abs(x.d) > 1e-9);
    const maxD = moved.length ? Math.max(...moved.map((x) => Math.abs(x.d))) : 0;
    const meanD = deltas.reduce((a, x) => a + Math.abs(x.d), 0) / deltas.length;
    console.log(`\n  ── PAIRED per-matchup delta vs baseline ── ${moved.length}/${ks.length} matchups moved · max ${(maxD * 100).toFixed(1)}pp · mean |Δ| ${(meanD * 100).toFixed(2)}pp`);
    for (const x of moved.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, Number(args.top ?? 15))) {
      console.log(`     ${x.k.padEnd(26)} ${pct(B.matchupRates[x.k])} -> ${pct(P.matchupRates[x.k])}  ${pp(x.d).padStart(7)}pp`);
    }
  }
}

if (args.grid) {
  for (const policy of POLICIES) {
    const P = summary.policies[policy];
    console.log(`\n  ── GRID ${policy} · rows = PLAYER, cols = ENEMY, cell = player win rate ──`);
    console.log(`  ${''.padEnd(12)}${CHARACTER_IDS.map((e) => e.slice(0, 5).padStart(7)).join('')}`);
    for (const p of CHARACTER_IDS) {
      console.log(`  ${p.padEnd(12)}${CHARACTER_IDS.map((e) => (p === e ? '—' : `${(P.matchupRates[`${p}>${e}`] * 100).toFixed(0)}%`).padStart(7)).join('')}`);
    }
  }
}

if (args.json) { writeFileSync(String(args.json), JSON.stringify(summary, null, 2)); console.log(`\nwrote ${args.json}`); }
console.log('');
