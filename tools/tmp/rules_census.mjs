#!/usr/bin/env node
/**
 * RULES CENSUS — every tunable in `rules.ts` that carries a time unit or an implied
 * number-of-uses-per-match, measured against the REAL `src/game/sim.ts`.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * `MATCH_DURATION_MS` went 180 s -> 45 s. Every other constant in `rules.ts` was
 * tuned against the 180 s clock and none of them were swept. Two were already known
 * dead (`REGEN_DELAY_MS`, and `MIN_SAFE_RADIUS`/`resolveTimeout` being unreachable),
 * both found by accident. This is the systematic pass.
 *
 * ── Method ─────────────────────────────────────────────────────────────────
 * 110 matchups x N seeds x 3 policies through `stepMatch`, reading state and the
 * event stream every tick. Nothing here models the sim; it observes it.
 *
 * The scripted player is `tools/match-sim.mjs`'s, verbatim in shape, plus a SEEDED
 * jitter on reaction time and aim so seeds produce genuinely different matches
 * rather than N copies of one deterministic run. Seed 0 is jitter-free and
 * reproduces `match-sim.mjs` exactly, which is the instrument's own control.
 *
 * ⚠️ `match-sim.mjs` documents its scripted player as "the shape of a match, not a
 * skill benchmark" — perfect information, fixed reaction. So this measures WHAT THE
 * SCRIPT TRIGGERS. Where a mechanic is dead here but plausibly alive against a
 * kiting human, `--report` says so rather than calling it dead.
 *
 *   node tools/tmp/rules_census.mjs --seeds 30
 *   node tools/tmp/rules_census.mjs --seeds 30 --policies smart --json out.json
 *   node tools/tmp/rules_census.mjs --seeds 8 --arena tools/tmp/arena.frozen.json
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

/** Which sim to drive. Defaults to the working tree; `--sim <dir>` points at a staged
 *  copy so a constant sweep can run the same instrument against a patched `rules.ts`. */
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, MIN_SAFE_RADIUS,
  REGEN_DELAY_MS, REGEN_TICK_MS, REGEN_AMOUNT,
  SLOW_DURATION_MS, STUN_DURATION_MS, SPLAT_DURATION_MS, SPLAT_RADIUS,
  TRAIL, POT, PLAYER_SPEED, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, REACH,
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS, FOG_DAMAGE, FOG_TICK_MS,
} = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/tmp/arena.frozen.json`);
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
const SEEDS = Number(args.seeds ?? 12);
const POLICIES = String(args.policies ?? 'idle,smart,chase').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ─────────────────────────────────────────────────────────────────────────────
// seeded rng — mulberry32
// ─────────────────────────────────────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// the hand on the controls — match-sim.mjs's policies, plus seeded jitter
// ─────────────────────────────────────────────────────────────────────────────
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
// one instrumented match
// ─────────────────────────────────────────────────────────────────────────────
function runMatch(playerId, enemyId, policy, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = POLICY_FNS[policy](rnd);
  // Seed 0 is jitter-free: reproduces match-sim.mjs exactly.
  const reactBase = 150;
  const reactJit = seed === 0 ? 0 : 60;

  const pReach = maxNormalRange(playerId), eReach = maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let sinceDecision = Infinity;
  let nextReact = reactBase;

  const m = {
    playerId, enemyId, policy, seed,
    startedAt: null, endedAt: null, ending: null, winner: null,
    ticks: 0, playTicks: 0, engagedTicks: 0,
    // status
    stun: { player: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 }, enemy: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 } },
    slow: { player: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 }, enemy: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 } },
    // regen
    regen: {
      player: { eligibleTicks: 0, eligibleEngagedTicks: 0, healTicks: 0, hpHealed: 0, gaps: [], maxGapMs: 0 },
      enemy: { eligibleTicks: 0, eligibleEngagedTicks: 0, healTicks: 0, hpHealed: 0, gaps: [], maxGapMs: 0 },
    },
    selfHeal: { uses: 0, hp: 0 },
    // ground
    splats: { created: 0, maxAlive: 0, aliveTickSum: 0, everUsed: 0, victimTicks: 0 },
    trail: { created: 0, maxAlive: 0, hits: 0, damage: 0, everDamaged: 0 },
    terrainSlowTicks: { player: 0, enemy: 0 },
    // hazards
    fog: { hits: 0, damage: 0, firstMs: null, ticksOutside: { player: 0, enemy: 0 } },
    // Who killed whom. The FATAL hit's source, per role — the only number that
    // separates "the zone applies pressure" from "the zone decides the match".
    deathBySource: { player: null, enemy: null },
    fleeTicks: 0,
    hazard: { hits: 0, damage: 0, ticksInside: { player: 0, enemy: 0 } },
    // ring / clock
    minSafeRadius: Infinity, ringFlooredAt: null, clockLeftMs: null,
    // combat
    fires: { player: {}, enemy: {} },
    hitsByWeapon: { player: {}, enemy: {} },
    damageBySource: {},
    projLifetimes: [], projByReason: { 'hit-target': 0, 'hit-cover': 0, expired: 0 },
    peckHits: 0,
    meleeAttempts: 0,
    // cooldown pressure: ticks a weapon was READY (off cooldown) but unused
    readyTicks: { player: {}, enemy: {} },
    inRangeTicks: { player: {}, enemy: {} },
  };

  const lastDamageAt = { player: null, enemy: null };
  const lastSource = { player: null, enemy: null };
  const damagedOnce = { player: false, enemy: false };
  const stunEnd = { player: -1, enemy: -1 };
  const slowEnd = { player: -1, enemy: -1 };
  const stunRun = { player: 0, enemy: 0 };
  const slowRun = { player: 0, enemy: 0 };
  const projSpawn = new Map();
  const splatSeen = new Set();
  const splatUsed = new Set();
  const trailSeen = new Set();
  const trailDamagedIds = new Set();

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (sinceDecision >= nextReact) {
      input = decide(state);
      sinceDecision = 0;
      nextReact = reactBase + (rnd() * 2 - 1) * reactJit;
    }
    const wasPlaying = state.phase === 'playing';
    // Snapshot pre-tick status ends so an application is detectable.
    const pre = {
      player: { st: state.player.status.stunnedUntil, sl: state.player.status.slowedUntil },
      enemy: { st: state.enemy.status.stunnedUntil, sl: state.enemy.status.slowedUntil },
    };

    const evs = stepMatch(state, DT, input);
    m.ticks++;
    sinceDecision += DT;

    for (const ev of evs) {
      switch (ev.type) {
        case 'match-started': m.startedAt = state.elapsed; break;
        case 'match-ended':
          m.endedAt = state.elapsed; m.winner = ev.winner;
          m.ending = state.player.alive && state.enemy.alive ? 'timeout' : 'knockout';
          m.clockLeftMs = state.timeRemaining;
          break;
        case 'weapon-fired': {
          const bucket = m.fires[ev.fighterRole];
          bucket[ev.weaponKey] = (bucket[ev.weaponKey] ?? 0) + 1;
          break;
        }
        case 'hit-landed': {
          const k = ev.source.kind;
          m.damageBySource[k] = (m.damageBySource[k] ?? 0) + ev.amount;
          lastDamageAt[ev.targetRole] = state.elapsed;
          lastSource[ev.targetRole] = k;
          damagedOnce[ev.targetRole] = true;
          if (k === 'weapon') {
            const attacker = ev.targetRole === 'player' ? 'enemy' : 'player';
            const b = m.hitsByWeapon[attacker];
            b[ev.source.weaponKey] = (b[ev.source.weaponKey] ?? 0) + 1;
          } else if (k === 'fog') {
            m.fog.hits++; m.fog.damage += ev.amount;
            if (m.fog.firstMs === null) m.fog.firstMs = state.elapsed;
          } else if (k === 'hazard') {
            m.hazard.hits++; m.hazard.damage += ev.amount;
          } else if (k === 'trail') {
            m.trail.hits++; m.trail.damage += ev.amount;
          }
          break;
        }
        case 'heal': {
          // Regen heals are exactly REGEN_AMOUNT (or less, clamped). A `self` weapon
          // heals healAmount (25). Distinguish by whether the tick also fired a self
          // weapon for the same fighter.
          const selfFired = evs.some((x) => x.type === 'weapon-fired' && x.fighterRole === ev.fighterRole
            && CHARACTERS[state[ev.fighterRole].characterId].weapons.find((w) => w.key === x.weaponKey)?.type === 'self');
          if (selfFired) { m.selfHeal.uses++; m.selfHeal.hp += ev.amount; }
          else { m.regen[ev.fighterRole].healTicks++; m.regen[ev.fighterRole].hpHealed += ev.amount; }
          break;
        }
        case 'death': m.deathBySource[ev.fighterRole] = lastSource[ev.fighterRole]; break;
        case 'projectile-spawned': projSpawn.set(ev.id, state.elapsed); break;
        case 'projectile-destroyed': {
          const t0 = projSpawn.get(ev.id);
          if (t0 !== undefined) { m.projLifetimes.push(state.elapsed - t0); projSpawn.delete(ev.id); }
          m.projByReason[ev.reason]++;
          break;
        }
        case 'splat-created': m.splats.created++; break;
        case 'trail-mark-created': m.trail.created++; break;
        default: break;
      }
    }

    if (wasPlaying) {
      m.playTicks++;
      const p = state.player, e = state.enemy;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d <= engageRange) m.engagedTicks++;

      // status accounting
      for (const role of ['player', 'enemy']) {
        const f = state[role];
        if (f.status.stunnedUntil > pre[role].st) {
          m.stun[role].applications++;
          if (state.elapsed < pre[role].st) m.stun[role].reapply++;
          stunEnd[role] = f.status.stunnedUntil;
        }
        if (f.status.slowedUntil > pre[role].sl) {
          m.slow[role].applications++;
          if (state.elapsed < pre[role].sl) m.slow[role].reapply++;
          slowEnd[role] = f.status.slowedUntil;
        }
        if (state.elapsed < f.status.stunnedUntil) {
          m.stun[role].ticks++;
          stunRun[role] += DT;
          if (stunRun[role] > m.stun[role].longestMs) m.stun[role].longestMs = stunRun[role];
        } else stunRun[role] = 0;
        if (state.elapsed < f.status.slowedUntil) {
          m.slow[role].ticks++;
          slowRun[role] += DT;
          if (slowRun[role] > m.slow[role].longestMs) m.slow[role].longestMs = slowRun[role];
        } else slowRun[role] = 0;
        if ((f.terrainSlowFactor ?? 1) < 1) m.terrainSlowTicks[role]++;

        // regen eligibility, measured directly off the same predicate `sim.ts` uses
        if (state.elapsed - f.lastDamagedAt > REGEN_DELAY_MS && f.hp < f.maxHp && f.hp > 0) {
          m.regen[role].eligibleTicks++;
          // Regen that fires while the two fighters are still within reach of each other
          // is not a reward for DISENGAGING — it is a drip between volleys. Splitting the
          // two is what makes a candidate delay judgeable rather than merely smaller.
          if (dist(f.x, f.y, state[role === 'player' ? 'enemy' : 'player'].x, state[role === 'player' ? 'enemy' : 'player'].y) <= engageRange) {
            m.regen[role].eligibleEngagedTicks++;
          }
        }
        // out-of-combat gap AFTER the fighter has been damaged at all (regen requires
        // hp < maxHp, so the pre-first-damage stretch can never regen).
        if (damagedOnce[role] && f.hp < f.maxHp) {
          const gap = state.elapsed - f.lastDamagedAt;
          if (gap > m.regen[role].maxGapMs) m.regen[role].maxGapMs = gap;
        }
        const dc = dist(f.x, f.y, arena.center.x, arena.center.y);
        if (dc > state.safeRadius) m.fog.ticksOutside[role]++;
        if (role === 'enemy' && f.hp < f.maxHp * RULES.AI_FLEE_HP_FRACTION) m.fleeTicks++;
        if (HAZ && dist(f.x, f.y, HAZ.x, HAZ.y) < HAZ.radius) m.hazard.ticksInside[role]++;
      }

      // splat utilisation
      for (const s of state.splats) {
        splatSeen.add(s.id);
        let used = false;
        for (const role of ['player', 'enemy']) {
          const f = state[role];
          if (Math.hypot(f.x - s.x, f.y - s.y) < SPLAT_RADIUS) { used = true; m.splats.victimTicks++; }
        }
        if (used) splatUsed.add(s.id);
      }
      m.splats.maxAlive = Math.max(m.splats.maxAlive, state.splats.length);
      m.splats.aliveTickSum += state.splats.length;
      m.trail.maxAlive = Math.max(m.trail.maxAlive, state.trailMarks.length);
      for (const t of state.trailMarks) { trailSeen.add(t.id); if (t.damaged) trailDamagedIds.add(t.id); }

      // weapon readiness / in-range pressure
      for (const role of ['player', 'enemy']) {
        const f = state[role];
        const ws = CHARACTERS[f.characterId].weapons;
        const other = state[role === 'player' ? 'enemy' : 'player'];
        const dd = dist(f.x, f.y, other.x, other.y);
        ws.forEach((w, i) => {
          if (state.elapsed - f.lastUsed[i] >= w.cooldown) {
            m.readyTicks[role][w.key] = (m.readyTicks[role][w.key] ?? 0) + 1;
            if (dd <= (w.range ?? Infinity)) m.inRangeTicks[role][w.key] = (m.inRangeTicks[role][w.key] ?? 0) + 1;
          }
        });
      }

      if (state.safeRadius < m.minSafeRadius) m.minSafeRadius = state.safeRadius;
      if (m.ringFlooredAt === null && state.safeRadius <= MIN_SAFE_RADIUS + 1e-9) m.ringFlooredAt = state.elapsed;
    }
  }

  m.splats.everUsed = splatUsed.size;
  m.splats.total = splatSeen.size;
  m.trail.everDamaged = trailDamagedIds.size;
  m.trail.total = trailSeen.size;
  m.playMs = m.startedAt === null ? 0 : (m.endedAt ?? state.elapsed) - m.startedAt;
  m.engagedMs = m.engagedTicks * DT;
  if (m.ending === null) m.ending = 'UNRESOLVED';
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// sweep
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const byPolicy = {};
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
  byPolicy[policy] = rows;
}
const elapsedS = (Date.now() - t0) / 1000;

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** `Math.max(...xs)` blows the stack past ~100k elements — this instrument routinely
 *  collects that many projectile lifetimes. Reduce, never spread. */
const vmax = (xs) => xs.reduce((a, b) => (b > a ? b : a), -Infinity);
const vmin = (xs) => xs.reduce((a, b) => (b < a ? b : a), Infinity);
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const s = (ms) => `${(ms / 1000).toFixed(2)}s`;
function quant(xs, q) { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; }

console.log(`\n╔══ RULES CENSUS ══ ${nMatches} matches · ${SEEDS} seeds × 110 matchups × ${POLICIES.length} policies · ${elapsedS.toFixed(1)}s`);
console.log(`║ clock ${MATCH_DURATION_MS / 1000}s · arena ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius} · spawn gap ${Math.round(dist(arena.playerSpawn.x, arena.playerSpawn.y, arena.enemySpawn.x, arena.enemySpawn.y))}wu`);
console.log(`║ sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`╚══════════════════════════════════════════════════════════════════════════\n`);

const summary = { clockMs: MATCH_DURATION_MS, nMatches, policies: {} };

for (const policy of POLICIES) {
  const rows = byPolicy[policy];
  const n = rows.length;
  const play = rows.map((r) => r.playMs);
  const eng = rows.map((r) => r.engagedMs);
  const engFrac = mean(rows.map((r) => (r.playTicks ? r.engagedTicks / r.playTicks : 0)));
  const wins = rows.filter((r) => r.winner === 'player').length;
  const timeouts = rows.filter((r) => r.ending === 'timeout').length;
  const unresolved = rows.filter((r) => r.ending === 'UNRESOLVED').length;
  const floored = rows.filter((r) => r.ringFlooredAt !== null).length;

  console.log(`══════ POLICY ${policy.toUpperCase()} ── ${n} matches ══════`);
  console.log(`  PLAY length      mean ${s(mean(play))}  median ${s(quant(play, 0.5))}  p90 ${s(quant(play, 0.9))}  max ${s(vmax(play))}   (clock ${MATCH_DURATION_MS / 1000}s)`);
  console.log(`  ENGAGED          mean ${s(mean(eng))} = ${pct(engFrac)} of play   (dead time ${pct(1 - engFrac)})`);
  console.log(`  endings          knockout ${n - timeouts - unresolved}  TIMEOUT ${timeouts}  unresolved ${unresolved}   ·  player win ${pct(wins / n)}`);
  console.log(`  ring floor       reached in ${floored}/${n} (${pct(floored / n)})   min R seen ${vmin(rows.map((r) => r.minSafeRadius)).toFixed(0)}wu  (floor ${MIN_SAFE_RADIUS})`);

  // ── REGEN ──
  const regEl = rows.flatMap((r) => [r.regen.player.eligibleTicks, r.regen.enemy.eligibleTicks]);
  const regHeal = rows.flatMap((r) => [r.regen.player.healTicks, r.regen.enemy.healTicks]);
  const regHp = rows.flatMap((r) => [r.regen.player.hpHealed, r.regen.enemy.hpHealed]);
  const gaps = rows.flatMap((r) => [r.regen.player.maxGapMs, r.regen.enemy.maxGapMs]);
  console.log(`\n  ── REGEN_DELAY_MS = ${REGEN_DELAY_MS} ────────────────────────────────────`);
  console.log(`     regen ticks/match     ${mean(regHeal).toFixed(3)}   (per FIGHTER; ${regHeal.filter((x) => x > 0).length}/${regHeal.length} fighters ever regened)`);
  console.log(`     HP regained/match     ${mean(regHp).toFixed(2)} per fighter`);
  console.log(`     eligible ticks/match  ${mean(regEl).toFixed(2)} = ${s(mean(regEl) * DT)} of eligibility per fighter`);
  const regEng = rows.flatMap((r) => [r.regen.player.eligibleEngagedTicks, r.regen.enemy.eligibleEngagedTicks]);
  console.log(`     of that eligibility, ${pct(mean(regEng) / Math.max(1e-9, mean(regEl)))} happens while STILL WITHIN REACH of the opponent (a drip, not a reward for disengaging)`);
  console.log(`     longest out-of-combat gap once damaged: mean ${s(mean(gaps))}  p50 ${s(quant(gaps, 0.5))}  p90 ${s(quant(gaps, 0.9))}  max ${s(vmax(gaps))}`);
  const gapSweep = [1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000];
  console.log(`     fighters whose longest gap exceeds a candidate delay:`);
  console.log(`       ${gapSweep.map((g) => `${g / 1000}s`.padStart(6)).join('')}`);
  console.log(`       ${gapSweep.map((g) => pct(gaps.filter((x) => x > g).length / gaps.length).padStart(6)).join('')}`);

  // ── STATUS ──
  const stunTicks = rows.flatMap((r) => [r.stun.player.ticks, r.stun.enemy.ticks]);
  const stunApps = rows.flatMap((r) => [r.stun.player.applications, r.stun.enemy.applications]);
  const stunRe = rows.flatMap((r) => [r.stun.player.reapply, r.stun.enemy.reapply]);
  const slowTicks = rows.flatMap((r) => [r.slow.player.ticks, r.slow.enemy.ticks]);
  const slowApps = rows.flatMap((r) => [r.slow.player.applications, r.slow.enemy.applications]);
  const slowRe = rows.flatMap((r) => [r.slow.player.reapply, r.slow.enemy.reapply]);
  const stunLong = rows.flatMap((r) => [r.stun.player.longestMs, r.stun.enemy.longestMs]);
  const slowLong = rows.flatMap((r) => [r.slow.player.longestMs, r.slow.enemy.longestMs]);
  const engMs = mean(eng) || 1;
  console.log(`\n  ── STUN_DURATION_MS = ${STUN_DURATION_MS} · SLOW_DURATION_MS = ${SLOW_DURATION_MS} ─────────`);
  console.log(`     stun  applications/match ${mean(stunApps).toFixed(2)} per fighter  ·  ${s(mean(stunTicks) * DT)} locked = ${pct((mean(stunTicks) * DT) / mean(play))} of play, ${pct((mean(stunTicks) * DT) / engMs)} of ENGAGED time`);
  console.log(`           re-applied while already stunned: ${mean(stunRe).toFixed(2)}/match (${pct(mean(stunRe) / Math.max(1e-9, mean(stunApps)))} of applications = stun-LOCK)`);
  console.log(`           LONGEST unbroken movement lock: mean ${s(mean(stunLong))}  p90 ${s(quant(stunLong, 0.9))}  max ${s(vmax(stunLong))}   (one application = ${STUN_DURATION_MS}ms)`);
  console.log(`     slow  applications/match ${mean(slowApps).toFixed(2)} per fighter  ·  ${s(mean(slowTicks) * DT)} slowed = ${pct((mean(slowTicks) * DT) / mean(play))} of play, ${pct((mean(slowTicks) * DT) / engMs)} of ENGAGED time`);
  console.log(`           re-applied while already slowed: ${mean(slowRe).toFixed(2)}/match (${pct(mean(slowRe) / Math.max(1e-9, mean(slowApps)))})`);
  console.log(`           LONGEST unbroken slow: mean ${s(mean(slowLong))}  p90 ${s(quant(slowLong, 0.9))}  max ${s(vmax(slowLong))}   (one application = ${SLOW_DURATION_MS}ms)`);

  // ── GROUND EFFECTS ──
  const spCreated = rows.map((r) => r.splats.created);
  const spUsed = rows.map((r) => (r.splats.total ? r.splats.everUsed / r.splats.total : 0));
  const spWith = rows.filter((r) => r.splats.total > 0);
  const trCreated = rows.map((r) => r.trail.created);
  const trRows = rows.filter((r) => r.trail.created > 0);
  console.log(`\n  ── SPLAT_DURATION_MS = ${SPLAT_DURATION_MS} · TRAIL.durationMs = ${TRAIL.durationMs} ─────────`);
  console.log(`     splats created/match  ${mean(spCreated).toFixed(2)}   max alive ${vmax(rows.map((r) => r.splats.maxAlive))}   mean alive ${mean(rows.map((r) => (r.playTicks ? r.splats.aliveTickSum / r.playTicks : 0))).toFixed(2)}`);
  console.log(`     splats that ever slowed anyone: ${pct(mean(spWith.map((r) => r.splats.everUsed / r.splats.total)))}   (${spWith.length} matches had any)`);
  console.log(`     splat victim-ticks/match ${mean(rows.map((r) => r.splats.victimTicks)).toFixed(1)} = ${s(mean(rows.map((r) => r.splats.victimTicks)) * DT)} of fighter-time standing in one`);
  if (trRows.length) {
    console.log(`     trail marks/match     ${mean(trRows.map((r) => r.trail.created)).toFixed(1)}  max alive ${vmax(trRows.map((r) => r.trail.maxAlive))}  (cap = durationMs/dropIntervalMs = ${(TRAIL.durationMs / TRAIL.dropIntervalMs).toFixed(0)})`);
    console.log(`     trail marks that ever bit: ${pct(mean(trRows.map((r) => r.trail.everDamaged / Math.max(1, r.trail.total))))}   hits/match ${mean(trRows.map((r) => r.trail.hits)).toFixed(1)}  damage/match ${mean(trRows.map((r) => r.trail.damage)).toFixed(1)} HP`);
  }
  const terr = rows.flatMap((r) => [r.terrainSlowTicks.player, r.terrainSlowTicks.enemy]);
  console.log(`     terrain slow (puddle+splat) ${s(mean(terr) * DT)} per fighter = ${pct((mean(terr) * DT) / mean(play))} of play`);

  // ── ZONE ──
  const totalDmg = rows.reduce((a, r) => a + Object.values(r.damageBySource).reduce((x, y) => x + y, 0), 0);
  const fogDmg = rows.reduce((a, r) => a + (r.damageBySource.fog ?? 0), 0);
  const hazDmg = rows.reduce((a, r) => a + (r.damageBySource.hazard ?? 0), 0);
  const traDmg = rows.reduce((a, r) => a + (r.damageBySource.trail ?? 0), 0);
  const fogFirst = rows.filter((r) => r.fog.firstMs !== null).map((r) => r.fog.firstMs);
  console.log(`\n  ── FOG (${FOG_DAMAGE}/${FOG_TICK_MS}ms = ${((FOG_DAMAGE / FOG_TICK_MS) * 1000).toFixed(0)} HP/s) · POT (${POT.damage}/${POT.tickMs}ms = ${((POT.damage / POT.tickMs) * 1000).toFixed(0)} HP/s) ──`);
  console.log(`     damage share  fog ${pct(fogDmg / totalDmg)}  ·  hazard ${pct(hazDmg / totalDmg)}  ·  trail ${pct(traDmg / totalDmg)}  ·  weapon ${pct(1 - (fogDmg + hazDmg + traDmg) / totalDmg)}`);
  console.log(`     matches with ANY fog damage ${pct(fogFirst.length / n)}   first fog hit mean ${fogFirst.length ? s(mean(fogFirst)) : '—'}`);
  console.log(`     matches with ANY pot damage ${pct(rows.filter((r) => r.hazard.hits > 0).length / n)}`);
  const kill = (role, kind) => rows.filter((r) => r.deathBySource[role] === kind).length / n;
  console.log(`     WHO KILLED WHOM   player died to: weapon ${pct(kill('player', 'weapon'))} · FOG ${pct(kill('player', 'fog'))} · pot ${pct(kill('player', 'hazard'))} · trail ${pct(kill('player', 'trail'))}`);
  console.log(`                       enemy  died to: weapon ${pct(kill('enemy', 'weapon'))} · FOG ${pct(kill('enemy', 'fog'))} · pot ${pct(kill('enemy', 'hazard'))} · trail ${pct(kill('enemy', 'trail'))}`);
  console.log(`     time OUTSIDE the ring: player ${pct(mean(rows.map((r) => r.fog.ticksOutside.player / Math.max(1, r.playTicks))))} of play · enemy ${pct(mean(rows.map((r) => r.fog.ticksOutside.enemy / Math.max(1, r.playTicks))))}`);
  console.log(`     AI below AI_FLEE_HP_FRACTION (${RULES.AI_FLEE_HP_FRACTION}) for ${pct(mean(rows.map((r) => r.fleeTicks / Math.max(1, r.playTicks))))} of play — and ai.ts's flee vector has NO ring term`);

  // ── PROJECTILES ──
  const lifes = rows.flatMap((r) => r.projLifetimes);
  const reasons = rows.reduce((a, r) => { for (const k of Object.keys(r.projByReason)) a[k] = (a[k] ?? 0) + r.projByReason[k]; return a; }, {});
  const totR = Object.values(reasons).reduce((a, b) => a + b, 0) || 1;
  console.log(`\n  ── PROJECTILE FLIGHT (FLIGHT_MS bands 350/500/875/1750) ──────────────`);
  console.log(`     lifetime  mean ${mean(lifes).toFixed(0)}ms  p50 ${quant(lifes, 0.5).toFixed(0)}ms  p90 ${quant(lifes, 0.9).toFixed(0)}ms  max ${vmax(lifes).toFixed(0)}ms   (n=${lifes.length})`);
  console.log(`     fate      hit ${pct(reasons['hit-target'] / totR)} · cover ${pct(reasons['hit-cover'] / totR)} · fell short ${pct(reasons.expired / totR)}`);

  // Per-matchup player win rate, so any change can be shown NOT to be a balance change.
  const winByMatchup = {};
  for (const r of rows) {
    const k = `${r.playerId}>${r.enemyId}`;
    (winByMatchup[k] ??= { w: 0, n: 0 });
    winByMatchup[k].n++;
    if (r.winner === 'player') winByMatchup[k].w++;
  }
  const matchupRates = Object.fromEntries(Object.entries(winByMatchup).map(([k, v]) => [k, v.w / v.n]));

  summary.policies[policy] = {
    n, meanPlayMs: mean(play), medianPlayMs: quant(play, 0.5), maxPlayMs: vmax(play),
    matchupRates,
    meanEngagedMs: mean(eng), engagedFrac: engFrac, playerWinRate: wins / n,
    timeouts, unresolved, ringFloored: floored,
    regenTicksPerFighterMatch: mean(regHeal), regenHpPerFighterMatch: mean(regHp),
    regenAnyRate: regHeal.filter((x) => x > 0).length / regHeal.length,
    selfHealPerMatch: mean(rows.map((r) => r.selfHeal.uses)),
    trailMarksPerMatch: trRows.length ? mean(trRows.map((r) => r.trail.created)) : 0,
    trailBiteRate: trRows.length ? mean(trRows.map((r) => r.trail.everDamaged / Math.max(1, r.trail.total))) : 0,
    trailDamagePerMatch: trRows.length ? mean(trRows.map((r) => r.trail.damage)) : 0,
    terrainSlowMs: mean(terr) * DT,
    projFateShortfall: reasons.expired / totR, projFateCover: reasons['hit-cover'] / totR,
    maxOutOfCombatGapMs: { mean: mean(gaps), p50: quant(gaps, 0.5), p90: quant(gaps, 0.9), max: vmax(gaps) },
    stunApps: mean(stunApps), stunMs: mean(stunTicks) * DT, stunLockRate: mean(stunRe) / Math.max(1e-9, mean(stunApps)),
    stunLongestMean: mean(stunLong), stunLongestP90: quant(stunLong, 0.9), stunLongestMax: vmax(stunLong),
    slowLongestMean: mean(slowLong), slowLongestP90: quant(slowLong, 0.9), slowLongestMax: vmax(slowLong),
    stunEngagedShare: (mean(stunTicks) * DT) / Math.max(1e-9, mean(eng)),
    slowEngagedShare: (mean(slowTicks) * DT) / Math.max(1e-9, mean(eng)),
    regenEngagedShare: mean(regEng) / Math.max(1e-9, mean(regEl)),
    slowApps: mean(slowApps), slowMs: mean(slowTicks) * DT,
    splatsPerMatch: mean(spCreated), splatUseRate: mean(spWith.map((r) => r.splats.everUsed / r.splats.total)),
    fogShare: fogDmg / totalDmg, hazardShare: hazDmg / totalDmg, trailShare: traDmg / totalDmg,
    playerKilledByFog: rows.filter((r) => r.deathBySource.player === 'fog').length / n,
    enemyKilledByFog: rows.filter((r) => r.deathBySource.enemy === 'fog').length / n,
    playerOutsideRingFrac: mean(rows.map((r) => r.fog.ticksOutside.player / Math.max(1, r.playTicks))),
    enemyOutsideRingFrac: mean(rows.map((r) => r.fog.ticksOutside.enemy / Math.max(1, r.playTicks))),
    projLifeMean: mean(lifes),
  };

  // ── COOLDOWNS: the per-weapon table ──
  console.log(`\n  ── WEAPON COOLDOWNS — uses per match against ${s(mean(play))} play / ${s(mean(eng))} engaged ──`);
  console.log(`     ${'character'.padEnd(12)}${'weapon'.padEnd(10)}${'cd'.padStart(6)}${'fires/m'.padStart(9)}${'hits/m'.padStart(8)}${'cap@play'.padStart(10)}${'cap@eng'.padStart(9)}   ${'verdict'}`);
  const wrows = [];
  for (const id of CHARACTER_IDS) {
    const asP = rows.filter((r) => r.playerId === id);
    const asE = rows.filter((r) => r.enemyId === id);
    for (const w of CHARACTERS[id].weapons) {
      const firesP = mean(asP.map((r) => r.fires.player[w.key] ?? 0));
      const firesE = mean(asE.map((r) => r.fires.enemy[w.key] ?? 0));
      const hitsP = mean(asP.map((r) => r.hitsByWeapon.player[w.key] ?? 0));
      const hitsE = mean(asE.map((r) => r.hitsByWeapon.enemy[w.key] ?? 0));
      const fires = (firesP + firesE) / 2;
      const hits = (hitsP + hitsE) / 2;
      const capPlay = mean(play) / w.cooldown;
      const capEng = mean(eng) / w.cooldown;
      wrows.push({ id, key: w.key, cd: w.cooldown, fires, hits, firesP, firesE, hitsP, hitsE, capPlay, capEng, type: w.type, range: w.range ?? null });
    }
  }
  for (const r of wrows) {
    const verdict = r.fires < 0.5 ? 'RARE (<0.5 uses/match)' : r.fires < 1 ? 'sub-once' : '';
    console.log(`     ${r.id.padEnd(12)}${r.key.padEnd(10)}${String(r.cd).padStart(6)}${r.fires.toFixed(2).padStart(9)}${r.hits.toFixed(2).padStart(8)}${r.capPlay.toFixed(1).padStart(10)}${r.capEng.toFixed(1).padStart(9)}   ${verdict}`);
  }
  summary.policies[policy].weapons = wrows;
  console.log('');
}

// ── cross-policy roll-up on the two headline questions ──
console.log(`\n╔══ HEADLINES ══════════════════════════════════════════════════════════════`);
for (const policy of POLICIES) {
  const p = summary.policies[policy];
  console.log(`║ ${policy.padEnd(6)} play ${s(p.meanPlayMs).padStart(7)} · engaged ${s(p.meanEngagedMs).padStart(7)} (${pct(p.engagedFrac).padStart(6)}) · regen ${p.regenTicksPerFighterMatch.toFixed(3)}/fighter · timeouts ${String(p.timeouts).padStart(4)}/${p.n} · ringFloor ${String(p.ringFloored).padStart(4)}/${p.n} · fog ${pct(p.fogShare).padStart(6)}`);
}
console.log(`╚═══════════════════════════════════════════════════════════════════════════\n`);

if (args.json) { writeFileSync(String(args.json), JSON.stringify(summary, null, 2)); console.log(`wrote ${args.json}`); }
