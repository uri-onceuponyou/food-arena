#!/usr/bin/env node
/**
 * Which branch of `match-sim.mjs`'s `smart` policy is the scripted player actually in?
 *
 * Built to re-derive a claim rather than accept it (docs/LESSONS.md §3: take the symptom,
 * re-derive the cause). The claim is that `smart` tests line-of-sight BEFORE range, so on a
 * 27-CoverBox map the player never leaves the "flank a blocked shot" branch and every
 * "time to first contact" on record is the AI walking alone.
 *
 * This histograms the branch taken at every decision tick of a real match, and prints the
 * net displacement of the player over the match, so "it strafes into a wall and stands
 * there" is a measured statement rather than a reading of the source.
 *
 *   node tools/tmp/policy_trace.mjs                       # hamburger vs donut
 *   node tools/tmp/policy_trace.mjs --all                 # every matchup, aggregated
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY } = RULES;

const LAYOUT = process.argv.includes('--layout') ? process.argv[process.argv.indexOf('--layout') + 1] : `${ROOT}/tools/arena.gameplay.json`;
const ARENA = JSON.parse(readFileSync(LAYOUT, 'utf8'));
const arena = { ...ARENA, build: () => null, update: () => {} };
const POT = arena.hazards.find((h) => h.kind === 'damage');
const DT = 16.667;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const argv = process.argv.slice(2);
const ALL = argv.includes('--all');

const maxNormalRange = (id) =>
  Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);
function preferredRange(id) {
  const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= REACH.rangedMax);
  if (!ws.length) return maxNormalRange(id);
  return ws.reduce((b, w) => ((w.damage ?? 0) > (b.damage ?? 0) ? w : b)).range ?? 0;
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
function axesToward(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
  return { x: q(dx / m), y: q(dy / m) };
}

/** Same decision tree as match-sim's `smart`, but it also RETURNS the branch name. */
function decide(state, reordered) {
  const p = state.player, e = state.enemy;
  const d = dist(p.x, p.y, e.x, e.y);
  const band = preferredRange(p.characterId) * 0.85;
  const los = lineOfSight(p.x, p.y, e.x, e.y);
  const cx = arena.center.x, cy = arena.center.y;
  const dc = dist(p.x, p.y, cx, cy), R = state.safeRadius;
  if (dc > R - 30) return { branch: 'RING', los, d };
  if (POT && dist(p.x, p.y, POT.x, POT.y) < POT.radius + 15 && R > POT.radius + 40) return { branch: 'LEAVE-POT', los, d };
  if (reordered) {
    if (d > band) return { branch: 'CLOSE', los, d };
    if (!los) return { branch: 'STRAFE-noLOS', los, d };
  } else {
    if (!los) return { branch: 'STRAFE-noLOS', los, d };
    if (d > band) return { branch: 'CLOSE', los, d };
  }
  if (d < band * 0.5) return { branch: 'BACK-OFF', los, d };
  return { branch: 'STRAFE-inband', los, d };
}

function run(pid, eid, reordered) {
  const state = createMatch(arena, pid, eid);
  const counts = {};
  let since = Infinity;
  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  const nav = (() => {
    const hist = []; let detourUntil = -1, detourSign = 1;
    return (st, tx, ty) => {
      const p = st.player;
      hist.push({ t: st.elapsed, x: p.x, y: p.y });
      while (hist.length && st.elapsed - hist[0].t > 1500) hist.shift();
      if (st.elapsed > detourUntil && hist.length > 4 && st.elapsed - hist[0].t > 1200) {
        const net = Math.hypot(p.x - hist[0].x, p.y - hist[0].y);
        if (net < 45) { detourSign = -detourSign; detourUntil = st.elapsed + 900; hist.length = 0; }
      }
      let ax = tx, ay = ty;
      if (st.elapsed < detourUntil) {
        const ang = Math.atan2(ty - p.y, tx - p.x) + detourSign * (Math.PI / 2);
        ax = p.x + Math.cos(ang) * 150; ay = p.y + Math.sin(ang) * 150;
      }
      return axesToward(p.x, p.y, ax, ay);
    };
  })();
  const startX = state.player.x, startY = state.player.y;
  let travel = 0, px = startX, py = startY;
  const eng = Math.max(maxNormalRange(pid) + HIT_RADIUS_VS_ENEMY, maxNormalRange(eid) + HIT_RADIUS_VS_PLAYER);
  let contact = null, enemyTravel = 0, ex = state.enemy.x, ey = state.enemy.y;
  while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS + 60_000) {
    if (since >= 150) {
      const r = decide(state, reordered);
      counts[r.branch] = (counts[r.branch] ?? 0) + 1;
      // Re-derive the target the same way the policy does, so the walk is faithful.
      const p = state.player, e = state.enemy;
      const band = preferredRange(p.characterId) * 0.85;
      let target;
      if (r.branch === 'RING') target = { x: arena.center.x, y: arena.center.y };
      else if (r.branch === 'LEAVE-POT') {
        const ang = Math.atan2(p.y - POT.y, p.x - POT.x);
        target = { x: POT.x + Math.cos(ang) * (POT.radius + 60), y: POT.y + Math.sin(ang) * (POT.radius + 60) };
      } else if (r.branch === 'STRAFE-noLOS') {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
        target = { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
      } else if (r.branch === 'CLOSE') target = { x: e.x, y: e.y };
      else if (r.branch === 'BACK-OFF') {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      } else {
        const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      }
      void band;
      input = { move: nav(state, target.x, target.y), aim: { x: e.x - p.x, y: e.y - p.y }, selectedWeapon: 0, attack: false };
      since = 0;
    }
    stepMatch(state, DT, input);
    travel += Math.hypot(state.player.x - px, state.player.y - py);
    enemyTravel += Math.hypot(state.enemy.x - ex, state.enemy.y - ey);
    px = state.player.x; py = state.player.y; ex = state.enemy.x; ey = state.enemy.y;
    since += DT;
    if (contact === null && dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= eng && state.phase === 'playing') {
      contact = MATCH_DURATION_MS - state.timeRemaining;
    }
  }
  return {
    counts, travel, enemyTravel, contact,
    netDisp: Math.hypot(state.player.x - startX, state.player.y - startY),
    endX: state.player.x, endY: state.player.y, startX, startY,
  };
}

const pairs = ALL ? CHARACTER_IDS.flatMap((p) => CHARACTER_IDS.filter((e) => e !== p).map((e) => [p, e])) : [['hamburger', 'donut']];
for (const reordered of [false, true]) {
  const agg = {};
  let travel = 0, enemyTravel = 0, net = 0, contact = 0, nContact = 0;
  for (const [p, e] of pairs) {
    const r = run(p, e, reordered);
    for (const [k, v] of Object.entries(r.counts)) agg[k] = (agg[k] ?? 0) + v;
    travel += r.travel; enemyTravel += r.enemyTravel; net += r.netDisp;
    if (r.contact !== null) { contact += r.contact; nContact++; }
    if (!ALL) console.log(`  ${p} vs ${e}: start (${r.startX.toFixed(0)},${r.startY.toFixed(0)}) -> end (${r.endX.toFixed(0)},${r.endY.toFixed(0)})`);
  }
  const tot = Object.values(agg).reduce((a, b) => a + b, 0);
  console.log(`\n== policy branch histogram — ${reordered ? 'RANGE-BEFORE-LOS (corrected)' : 'LOS-BEFORE-RANGE (as shipped)'} · ${pairs.length} matchup(s)`);
  for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${k.padEnd(14)} ${String(v).padStart(7)}  ${(v / tot * 100).toFixed(1)}%`);
  }
  console.log(`   player travel ${Math.round(travel / pairs.length)}wu · NET displacement ${Math.round(net / pairs.length)}wu · enemy travel ${Math.round(enemyTravel / pairs.length)}wu`);
  console.log(`   mean time to contact ${(contact / nContact / 1000).toFixed(1)}s (match clock), ${nContact}/${pairs.length} made contact`);
}
