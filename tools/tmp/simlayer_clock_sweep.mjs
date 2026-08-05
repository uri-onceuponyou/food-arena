#!/usr/bin/env node
/**
 * CLOCK SWEEP — pick MATCH_DURATION_MS by measurement, without editing rules.ts.
 *
 *   node tools/tmp/simlayer_clock_sweep.mjs [--floor 140] [--policy smart]
 *
 * The trick: `stepMatch` derives the ring purely from `state.timeRemaining`
 *     safeRadius = arena.maxSafeRadius * timeRemaining / MATCH_DURATION_MS
 * so ANY closing schedule can be driven from outside by writing `timeRemaining`
 * before each tick. That means a candidate clock T (and its derived opening radius
 * R0, and an optional floor) can be evaluated against the REAL sim with the real
 * constant still at 180 s — no edit-measure-revert loop, no contamination window.
 *
 * The scripted player is match-sim.mjs's `smart` policy, verbatim, because it is the
 * only one that respects the closing ring — a policy that ignores the ring would
 * inflate every fog number this sweep exists to read.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const R = await import(`${ROOT}/src/game/rules.ts`);
const ARENA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const arena = { ...ARENA, build: () => null, update: () => {} };
const POT = arena.hazards.find((h) => h.kind === 'damage');

const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, all) =>
  a.startsWith('--') ? [[a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : []));

const DT = 16.667;
const HALF_DIAG = Math.hypot(arena.width / 2, arena.height / 2);
const FIRST_CONTACT_S = 6;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const IDS = R.CHARACTER_IDS;
const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

// ── match-sim.mjs `smart`, ported verbatim ───────────────────────────────────
const maxNormalRange = (id) =>
  Math.max(...R.CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= R.REACH.rangedMax).map((w) => w.range ?? 0), 0);
function preferredRange(id) {
  const ws = R.CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= R.REACH.rangedMax);
  if (!ws.length) return maxNormalRange(id);
  return ws.reduce((best, w) => ((w.damage ?? 0) > (best.damage ?? 0) ? w : best)).range ?? 0;
}
function axesToward(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
  return { x: q(dx / m), y: q(dy / m) };
}
function bestWeapon(state, d) {
  const p = state.player;
  let best = null, bestDmg = -Infinity;
  R.CHARACTERS[p.characterId].weapons.forEach((w, i) => {
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
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (arena.cover.some((o) => Math.abs(x - o.x) < (12 + o.w) / 2 && Math.abs(y - o.y) < (12 + o.h) / 2)) return false;
  }
  return true;
}
function makeNav() {
  const hist = [];
  let detourUntil = -1, detourSign = 1;
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
function smartPolicy() {
  const nav = makeNav();
  return (state) => {
    const p = state.player, e = state.enemy;
    const d = dist(p, e);
    const idx = bestWeapon(state, d);
    const band = preferredRange(p.characterId) * 0.85;
    const los = lineOfSight(p.x, p.y, e.x, e.y);
    const cx = arena.center.x, cy = arena.center.y;
    const dc = Math.hypot(p.x - cx, p.y - cy);
    const Rr = state.safeRadius;
    let target;
    if (dc > Rr - 30) {
      target = { x: cx, y: cy };
      if (POT && Rr < POT.radius + 20) {
        const ang = Math.atan2(p.y - cy, p.x - cx);
        const r = Math.max(0, Rr - 10);
        target = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
      }
    } else if (POT && Math.hypot(p.x - POT.x, p.y - POT.y) < POT.radius + 15 && Rr > POT.radius + 40) {
      const ang = Math.atan2(p.y - POT.y, p.x - POT.x);
      target = { x: POT.x + Math.cos(ang) * (POT.radius + 60), y: POT.y + Math.sin(ang) * (POT.radius + 60) };
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
      attack: idx !== null && (los || R.CHARACTERS[p.characterId].weapons[idx].type === 'melee'),
    };
  };
}

// ── one match under an EMULATED clock ────────────────────────────────────────
function runUnder(playerId, enemyId, { clockMs, floor }) {
  const R0 = HALF_DIAG / (1 - (FIRST_CONTACT_S * 1000) / clockMs);
  const st = createMatch(arena, playerId, enemyId);
  const decide = smartPolicy();
  let input = noInput, since = Infinity, playMs = 0;
  const dmg = {};
  let timedOut = false, killedInSqueeze = false;

  while (st.phase !== 'ended' && playMs < clockMs) {
    if (st.phase === 'playing') {
      // Drive the emulated schedule by writing the one field the ring is derived from.
      const nextPlay = playMs + DT;
      const wantR = Math.max(floor, R0 * (1 - nextPlay / clockMs));
      st.timeRemaining = (wantR / arena.maxSafeRadius) * R.MATCH_DURATION_MS + DT;
    }
    if (since >= 150) { input = decide(st); since = 0; }
    const evs = stepMatch(st, DT, input);
    since += DT;
    if (st.phase === 'playing' || st.phase === 'ended') playMs += DT;
    for (const ev of evs) {
      if (ev.type === 'hit-landed') dmg[ev.source.kind] = (dmg[ev.source.kind] ?? 0) + ev.amount;
      if (ev.type === 'death' && ev.fighterRole === 'player' && st.safeRadius <= (POT?.radius ?? 0) + 1) killedInSqueeze = true;
    }
  }

  let winner = st.winner;
  if (st.phase !== 'ended') {
    timedOut = true;
    const pf = st.player.hp / st.player.maxHp, ef = st.enemy.hp / st.enemy.maxHp;
    const pd = Math.hypot(st.player.x - arena.center.x, st.player.y - arena.center.y);
    const ed = Math.hypot(st.enemy.x - arena.center.x, st.enemy.y - arena.center.y);
    winner = pf > ef ? 'player' : ef > pf ? 'enemy' : pd <= ed ? 'player' : 'enemy';
  }
  const total = Object.values(dmg).reduce((a, b) => a + b, 0) || 1;
  return {
    winner, timedOut, killedInSqueeze, playMs,
    fogShare: (dmg.fog ?? 0) / total,
    hazardShare: (dmg.hazard ?? 0) / total,
    R0,
  };
}

// ── sweep ────────────────────────────────────────────────────────────────────
const FLOOR = Number(args.floor ?? 0);
const CANDIDATES = (args.clocks ? String(args.clocks).split(',').map(Number) : [25, 30, 35, 40, 45, 60, 90, 180]);

console.log(`\n══ CLOCK SWEEP ══  arena ${arena.width}x${arena.height}, half-diagonal ${HALF_DIAG.toFixed(1)}, ` +
  `first corner contact pinned at t=${FIRST_CONTACT_S}s, ring floor ${FLOOR}wu`);
console.log(`   ${'T'.padStart(5)} ${'R0'.padStart(6)} ${'sweep'.padStart(8)} ${'mean len'.padStart(9)} ` +
  `${'timeout%'.padStart(9)} ${'p.win%'.padStart(7)} ${'fog%'.padStart(6)} ${'pot%'.padStart(6)} ` +
  `${'R@median'.padStart(9)} ${'squeezeKill'.padStart(12)}`);

for (const Ts of CANDIDATES) {
  const clockMs = Ts * 1000;
  const rows = [];
  for (const p of IDS) for (const e of IDS) { if (p !== e) rows.push(runUnder(p, e, { clockMs, floor: FLOOR })); }
  const n = rows.length;
  const lens = rows.map((r) => r.playMs).sort((a, b) => a - b);
  const mean = lens.reduce((a, b) => a + b, 0) / n;
  const median = lens[Math.floor(n / 2)];
  const R0 = rows[0].R0;
  const rAtMedian = Math.max(FLOOR, R0 * (1 - median / clockMs));
  console.log(`   ${String(Ts + 's').padStart(5)} ${R0.toFixed(0).padStart(6)} ` +
    `${(R0 / Ts).toFixed(1).padStart(6)}w/s ` +
    `${(mean / 1000).toFixed(1).padStart(8)}s ` +
    `${((rows.filter((r) => r.timedOut).length / n) * 100).toFixed(1).padStart(8)}% ` +
    `${((rows.filter((r) => r.winner === 'player').length / n) * 100).toFixed(1).padStart(6)}% ` +
    `${((rows.reduce((a, r) => a + r.fogShare, 0) / n) * 100).toFixed(1).padStart(5)}% ` +
    `${((rows.reduce((a, r) => a + r.hazardShare, 0) / n) * 100).toFixed(1).padStart(5)}% ` +
    `${rAtMedian.toFixed(0).padStart(9)} ` +
    `${String(rows.filter((r) => r.killedInSqueeze).length).padStart(12)}`);
}
console.log(`\n   R@median = ring radius when the median match ends. Arena inscribed radius is ${arena.height / 2} ` +
  `(ring starts cutting the playfield), half-diagonal ${HALF_DIAG.toFixed(0)}, pot danger ring ${POT?.radius ?? '—'}.`);
console.log(`   squeezeKill = matches where the PLAYER died with the ring already inside the pot's danger ring, ` +
  `i.e. the "no safe ground, lowest HP pool loses" ending.\n`);
