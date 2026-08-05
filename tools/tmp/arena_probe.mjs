#!/usr/bin/env node
/**
 * ARENA LAYOUT probe — the instrument for `docs/STATE.md` item 11 (pacing floor).
 *
 * Four questions, each an acceptance test rather than a vibe:
 *
 *   --truth      Connectivity. Floods a lattice of legal fighter-CENTRE positions from
 *                the enemy spawn and labels every connected component, so SEALED POCKETS
 *                (space nothing can ever enter) are named with their bbox and their share
 *                of legal standing space. Also prints the reachability CEILING for the
 *                28x20 grid `--reach` scores against.
 *   --reach      Grid reachability through the REAL `stepMatch`: a pinned immortal player
 *                on each cell, does the immortal AI ever get inside its own reach?
 *   --matchups   All 110 matchups, scripted player. Dead time, time to first contact
 *                (MATCH CLOCK, not elapsed — elapsed carries 5.7 s of countdown), win rate.
 *   --occl       Occlusion as a FUNCTION OF THE CLOSING RING, sampled on the ring radii the
 *                sim actually visits (maxSafeRadius -> MIN_SAFE_RADIUS), not on three
 *                hardcoded fractions of a stale 890. This is the "the endgame must OPEN,
 *                not close" test: the series must not rise as R falls.
 *   --spawnsweep Time-to-first-contact and dead time as a function of the spawn gap, so
 *                the gap is chosen by measurement instead of taste.
 *
 * ── Why it extracts the layout from source instead of only reading the cache ──────
 * `tools/arena.gameplay.json` can only be refreshed through a browser (kitchen.ts builds
 * Three.js eagerly), which is ~40 s of SwiftShader per iteration and needs a snapshot to
 * be uncontaminated. `--from-src` parses every `addCover()` call site out of
 * `src/arena/kitchen.ts` and evaluates its coordinate expressions against the same
 * constants the module imports, giving a layout in ~20 ms.
 *
 * That is a SECOND source of truth, which is exactly the thing this project keeps getting
 * burned by, so it is self-validating: `--verify` asserts the extraction reproduces the
 * committed browser dump box-for-box. Run it before trusting any `--from-src` number, and
 * re-run the real browser refresh at the end (`match-sim.mjs --refresh-arena`).
 *
 * `--layout <path>` reads any dumped arena JSON instead (default: tools/arena.gameplay.json).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createScriptedPlayer, parseDriverFlags, DRIVER_REV } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);

/**
 * Which sim to drive. This tool used to hardcode the WORKING TREE, which every peer
 * tool in this family had already stopped doing: it means a peer's half-saved
 * `src/game/ai.ts` lands inside a run and there is no way to hold the sim still across
 * a before/after (`docs/LESSONS.md` §5 — measurement contamination is a separate
 * problem from write conflicts). `--sim <dir>` points at a `stage_rules.mjs` copy or a
 * `git archive` of HEAD; `--arena <path>` pairs with it.
 *
 * The layout parser (`--from-src`) still reads `src/arena/` from the working tree,
 * because that is its SUBJECT. Stated here rather than left implicit: when part of a
 * tool reads the working tree and part reads a frozen copy, it has to say so.
 */
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, PLAYER_SIZE, MIN_SAFE_RADIUS,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, REACH, POT, PUDDLE_SLOW_FACTOR,
} = RULES;
const DT = Number(args.dt ?? 16.667);
const TAG = String(args.tag ?? 'run');
const POLICY = String(args.policy ?? 'smart');

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const secs = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)}s`);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// ─────────────────────────────────────────────────────────────────────────────
// Layout: from the browser dump, or extracted from source
// ─────────────────────────────────────────────────────────────────────────────

function extractFromSource() {
  const kitchen = readFileSync(`${ROOT}/src/arena/kitchen.ts`, 'utf8');
  const shared = readFileSync(`${ROOT}/src/arena/shared.ts`, 'utf8');
  const ARENA_W = Number(/export const ARENA_W = (\d+)/.exec(shared)[1]);
  const ARENA_H = Number(/export const ARENA_H = (\d+)/.exec(shared)[1]);
  const CENTER = { x: ARENA_W / 2, y: ARENA_H / 2 };
  const FOG_FIRST_CONTACT_S = Number(/export const FOG_FIRST_CONTACT_S = ([\d.]+)/.exec(shared)[1]);
  const MAX_SAFE_RADIUS = Math.round(
    Math.hypot(ARENA_W / 2, ARENA_H / 2) / (1 - (FOG_FIRST_CONTACT_S * 1000) / MATCH_DURATION_MS)
  );

  const scope = { ARENA_W, ARENA_H, CENTER, POT, Math };
  const ev = (expr) => {
    const fn = new Function(...Object.keys(scope), `"use strict"; return (${expr});`);
    return fn(...Object.values(scope));
  };
  // Local numeric consts declared inside `createKitchenArena` (e.g. HUB_ISLAND_W) —
  // picked up so a layout can name its own dimensions instead of repeating literals.
  for (const dm of kitchen.matchAll(/(?:^|[\s,])([A-Z][A-Z0-9_]*)\s*=\s*([-+*/(). \d]+?)\s*[,;]/gm)) {
    try { scope[dm[1]] = ev(dm[2]); } catch { /* not a pure numeric expression */ }
  }

  // Every `addCover(propsGroup, cover, M, { ... })` call site. The object literal always
  // carries x/y/w/h/kind on one line before `build:`, so a non-greedy grab up to `build:`
  // is unambiguous — and `--verify` proves it.
  const cover = [];
  const re = /addCover\(\s*propsGroup,\s*cover,\s*M,\s*\{([\s\S]*?)build:/g;
  let m;
  while ((m = re.exec(kitchen)) !== null) {
    const body = m[1];
    const get = (key) => {
      const mm = new RegExp(`\\b${key}:\\s*([^,\\n}]+)`).exec(body);
      return mm ? mm[1].trim() : null;
    };
    const kindRaw = get('kind');
    cover.push({
      x: ev(get('x')), y: ev(get('y')), w: ev(get('w')), h: ev(get('h')),
      kind: kindRaw.replace(/^['"]|['"]$/g, ''),
    });
  }

  const spawnRe = /const (playerSpawn|enemySpawn) = \{ x: ([^,]+), y: ([^}]+) \}/g;
  const spawns = {};
  while ((m = spawnRe.exec(kitchen)) !== null) spawns[m[1]] = { x: ev(m[2]), y: ev(m[3]) };

  const pud = /const puddle(South|North) = \{ x: ([^,]+), y: ([^,]+), radius: ([^}]+) \}/g;
  const hazards = [{ x: CENTER.x, y: CENTER.y, radius: POT.dangerRadius, kind: 'damage', damage: POT.damage, tickMs: POT.tickMs }];
  while ((m = pud.exec(kitchen)) !== null) {
    hazards.push({ x: ev(m[2]), y: ev(m[3]), radius: ev(m[4]), kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR });
  }

  return {
    id: 'kitchen', displayName: 'The Kitchen',
    width: ARENA_W, height: ARENA_H, center: CENTER, maxSafeRadius: MAX_SAFE_RADIUS,
    playerSpawn: spawns.playerSpawn, enemySpawn: spawns.enemySpawn,
    cover, hazards,
  };
}

const LAYOUT_PATH = String(args.layout ?? `${ROOT}/tools/arena.gameplay.json`);
const DATA = args['from-src'] || args.verify ? extractFromSource() : JSON.parse(readFileSync(LAYOUT_PATH, 'utf8'));

if (args.verify) {
  const dump = JSON.parse(readFileSync(LAYOUT_PATH, 'utf8'));
  const norm = (a) => JSON.stringify({
    w: a.width, h: a.height, c: a.center, msr: a.maxSafeRadius,
    ps: a.playerSpawn, es: a.enemySpawn,
    cover: [...a.cover].map((c) => `${c.kind}@${c.x},${c.y},${c.w}x${c.h}`).sort(),
    hz: [...a.hazards].map((h) => `${h.kind}@${h.x},${h.y},r${h.radius}`).sort(),
  });
  const ok = norm(DATA) === norm(dump);
  console.log(`\n== EXTRACTOR VERIFY vs ${LAYOUT_PATH.replace(ROOT + '/', '')}`);
  console.log(`   source extraction: ${DATA.cover.length} cover, ${DATA.hazards.length} hazards`);
  console.log(`   browser dump     : ${dump.cover.length} cover, ${dump.hazards.length} hazards`);
  console.log(`   ${ok ? 'MATCH — the extractor is a faithful second reader' : 'MISMATCH — do NOT trust --from-src'}\n`);
  if (!ok) {
    const A = new Set(DATA.cover.map((c) => `${c.kind}@${c.x},${c.y},${c.w}x${c.h}`));
    const B = new Set(dump.cover.map((c) => `${c.kind}@${c.x},${c.y},${c.w}x${c.h}`));
    for (const s of A) if (!B.has(s)) console.log(`     src only  ${s}`);
    for (const s of B) if (!A.has(s)) console.log(`     dump only ${s}`);
    process.exitCode = 1;
  }
}

const arena = { ...DATA, build: () => null, update: () => {} };
const HAZ_POT = arena.hazards.find((h) => h.kind === 'damage');

const maxNormalRange = (id) =>
  Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);

function blockedByCover(x, y, size, cover) {
  const h = size / 2;
  return cover.some((c) => Math.abs(x - c.x) < h + c.w / 2 && Math.abs(y - c.y) < h + c.h / 2);
}

const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

// ─────────────────────────────────────────────────────────────────────────────
// --truth : connectivity, sealed pockets, and the reachability CEILING
// ─────────────────────────────────────────────────────────────────────────────
function flood(L) {
  const cols = Math.floor(arena.width / L), rows = Math.floor(arena.height / L);
  const half = PLAYER_SIZE / 2;
  const legal = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const x = (gx + 0.5) * L, y = (gy + 0.5) * L;
    legal[gy * cols + gx] = (x >= half && x <= arena.width - half && y >= half && y <= arena.height - half
      && !blockedByCover(x, y, PLAYER_SIZE, arena.cover)) ? 1 : 0;
  }
  const q = new Int32Array(cols * rows);
  const label = new Int32Array(cols * rows).fill(-1);
  const comps = [];
  for (let s = 0; s < cols * rows; s++) {
    if (!legal[s] || label[s] >= 0) continue;
    const id = comps.length;
    let h = 0, t = 0; q[t++] = s; label[s] = id;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    while (h < t) {
      const c = q[h++], cx = c % cols, cy = (c - cx) / cols;
      const X = (cx + 0.5) * L, Y = (cy + 0.5) * L;
      if (X < minx) minx = X; if (X > maxx) maxx = X;
      if (Y < miny) miny = Y; if (Y > maxy) maxy = Y;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (!legal[ni] || label[ni] >= 0) continue;
        if (ox && oy && (!legal[cy * cols + nx] || !legal[ny * cols + cx])) continue;
        label[ni] = id; q[t++] = ni;
      }
    }
    comps.push({ id, size: t, bbox: [Math.round(minx), Math.round(miny), Math.round(maxx), Math.round(maxy)] });
  }
  comps.sort((a, b) => b.size - a.size);
  const nLegal = legal.reduce((a, b) => a + b, 0);
  const spawnComp = label[Math.min(rows - 1, Math.floor(arena.enemySpawn.y / L)) * cols + Math.min(cols - 1, Math.floor(arena.enemySpawn.x / L))];
  return { cols, rows, L, legal, label, comps, nLegal, spawnComp };
}

if (args.truth) {
  const enemyId = String(args.enemy ?? 'donut');
  const reach = maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER;
  const L = Number(args.lattice ?? 2);
  const f = flood(L);
  const GW = Number(args.gw ?? 28), GH = Number(args.gh ?? 20);
  const rad = Math.ceil(reach / L);
  let inPrinciple = 0, cells = 0;
  const sealedCells = [];
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = ((gx + 0.5) / GW) * arena.width, y = ((gy + 0.5) / GH) * arena.height;
    if (blockedByCover(x, y, PLAYER_SIZE, arena.cover)) continue;
    cells++;
    const bx = Math.floor(x / L), by = Math.floor(y / L);
    let best = Infinity;
    for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      const nx = bx + ox, ny = by + oy;
      if (nx < 0 || nx >= f.cols || ny < 0 || ny >= f.rows) continue;
      if (f.label[ny * f.cols + nx] !== f.spawnComp) continue;
      const d = Math.hypot((nx + 0.5) * L - x, (ny + 0.5) * L - y);
      if (d < best) best = d;
    }
    if (best <= reach) inPrinciple++;
    else sealedCells.push({ x: Math.round(x), y: Math.round(y), best: Number.isFinite(best) ? Math.round(best) : null });
  }

  console.log(`\n== CONNECTIVITY + CEILING [${TAG}] — ${L}wu lattice, reach ${Math.round(reach)}wu (${enemyId})`);
  console.log(`   WALKABLE FLOOR IS ${f.comps.length === 1 ? 'ONE PIECE' : `${f.comps.length} DISCONNECTED PIECES`}:`);
  for (const c of f.comps) {
    const tag = c.id === f.spawnComp ? '   <- the main floor'
      : `   <- SEALED: ${Math.round(c.bbox[2] - c.bbox[0])}x${Math.round(c.bbox[3] - c.bbox[1])}wu nothing can enter`;
    console.log(`     #${c.id}  ${String(c.size).padStart(7)} nodes (${(c.size / f.nLegal * 100).toFixed(2)}%)  x[${c.bbox[0]}..${c.bbox[2]}] y[${c.bbox[1]}..${c.bbox[3]}]${tag}`);
  }
  const sealedNodes = f.comps.filter((c) => c.id !== f.spawnComp).reduce((a, c) => a + c.size, 0);
  console.log(`   SEALED SPACE: ${sealedNodes} nodes = ${(sealedNodes / f.nLegal * 100).toFixed(2)}% of legal standing space`);
  console.log(`   CEILING: ${inPrinciple}/${cells} grid cells (${(inPrinciple / cells * 100).toFixed(1)}%) — a perfect pathfinder could do no better`);
  if (sealedCells.length) {
    console.log(`   grid cells with no legal route within reach (${sealedCells.length}):`);
    for (const s of sealedCells) console.log(`     (${String(s.x).padStart(4)},${String(s.y).padStart(4)})  nearest reachable ${s.best === null ? '>reach' : `${s.best}wu`}`);
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// --gaps : the tightest legal corridor, in nav cells
// ─────────────────────────────────────────────────────────────────────────────
// The nav grid is 10 wu (movement.ts). A corridor narrower than that is legal for a
// fighter but invisible to the flow field, which is the exact symptom the brief names:
// `--truth` says 100% and `--reach` does not.
if (args.gaps) {
  const L = 2;
  const f = flood(L);
  // Width of the legal channel measured along each axis, per legal node, then the
  // narrowest channel that is NOT against the arena wall.
  const narrow = [];
  for (let gy = 1; gy < f.rows - 1; gy++) {
    let runStart = -1;
    for (let gx = 0; gx <= f.cols; gx++) {
      const ok = gx < f.cols && f.legal[gy * f.cols + gx];
      if (ok && runStart < 0) runStart = gx;
      if (!ok && runStart >= 0) {
        const wu = (gx - runStart) * L;
        if (runStart > 0 && gx < f.cols) narrow.push({ axis: 'x', wu, at: [Math.round((runStart + (gx - runStart) / 2) * L), Math.round(gy * L)] });
        runStart = -1;
      }
    }
  }
  for (let gx = 1; gx < f.cols - 1; gx++) {
    let runStart = -1;
    for (let gy = 0; gy <= f.rows; gy++) {
      const ok = gy < f.rows && f.legal[gy * f.cols + gx];
      if (ok && runStart < 0) runStart = gy;
      if (!ok && runStart >= 0) {
        const wu = (gy - runStart) * L;
        if (runStart > 0 && gy < f.rows) narrow.push({ axis: 'y', wu, at: [Math.round(gx * L), Math.round((runStart + (gy - runStart) / 2) * L)] });
        runStart = -1;
      }
    }
  }
  narrow.sort((a, b) => a.wu - b.wu);
  console.log(`\n== TIGHTEST LEGAL CORRIDORS [${TAG}] — nav cell is 10wu; anything below that is legal but unroutable`);
  const seen = new Set();
  let shown = 0;
  for (const n of narrow) {
    const key = `${n.axis}:${Math.round(n.at[0] / 40)},${Math.round(n.at[1] / 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`   ${String(n.wu).padStart(4)}wu  ${n.axis}-channel near (${n.at[0]},${n.at[1]})`);
    if (++shown >= 12) break;
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// --route : the DETOUR FACTOR — what the walk actually costs
// ─────────────────────────────────────────────────────────────────────────────
//
// `1080 wu at 190 wu/s` is the number on record, and it is the number for a straight
// line. Nothing walks a straight line here. This measures the SHORTEST LEGAL ROUTE
// between the two spawns on a 2 wu lattice (8-connected, diagonals cost sqrt(2), and
// only where both orthogonal neighbours are legal — the same rule the nav grid uses),
// and the RUNWAY: how far a fighter holding one direction out of spawn gets before a
// CoverBox stops it dead. `tryMove` tests the destination and does not slide, so a
// runway shorter than a few body lengths means the first thing a new player does is
// walk into furniture.
if (args.route) {
  const L = 2;
  const f = flood(L);
  const idx = (x, y) => Math.min(f.rows - 1, Math.floor(y / L)) * f.cols + Math.min(f.cols - 1, Math.floor(x / L));
  const src = idx(arena.enemySpawn.x, arena.enemySpawn.y);
  const dst = idx(arena.playerSpawn.x, arena.playerSpawn.y);
  const D = new Float64Array(f.cols * f.rows).fill(Infinity);
  // Uniform-cost search with two edge weights only (1 and sqrt2) — a 2-bucket deque is
  // exact enough here and avoids a heap; verified against the straight-line lower bound.
  const heap = [[0, src]];
  D[src] = 0;
  while (heap.length) {
    heap.sort((a, b) => a[0] - b[0]);
    const [d, c] = heap.shift();
    if (d > D[c]) continue;
    if (c === dst) break;
    const cx = c % f.cols, cy = (c - cx) / f.cols;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || nx >= f.cols || ny < 0 || ny >= f.rows) continue;
      const ni = ny * f.cols + nx;
      if (!f.legal[ni]) continue;
      if (ox && oy && (!f.legal[cy * f.cols + nx] || !f.legal[ny * f.cols + cx])) continue;
      const w = (ox && oy ? Math.SQRT2 : 1) * L;
      if (d + w < D[ni]) { D[ni] = d + w; heap.push([d + w, ni]); }
    }
  }
  const straight = dist(arena.playerSpawn.x, arena.playerSpawn.y, arena.enemySpawn.x, arena.enemySpawn.y);
  const route = D[dst];
  const CLOSE = (RULES.PLAYER_SPEED + RULES.AI_CHASE_SPEED) * 1000;
  console.log(`\n== ROUTE + RUNWAY [${TAG}]`);
  console.log(`   spawn gap, straight line        ${straight.toFixed(0)}wu`);
  console.log(`   SHORTEST LEGAL ROUTE            ${Number.isFinite(route) ? route.toFixed(0) : 'UNREACHABLE'}wu   detour factor ${(route / straight).toFixed(2)}x`);
  console.log(`   closure at ${CLOSE.toFixed(0)}wu/s combined     straight ${((straight - 165) / CLOSE).toFixed(1)}s   ·   along the real route ${((route - 165) / CLOSE).toFixed(1)}s`);
  for (const [who, s, dir] of [['player', arena.playerSpawn, 1], ['enemy', arena.enemySpawn, -1]]) {
    for (const [name, vx, vy] of [['toward the enemy', dir, 0], ['north', 0, -1], ['south', 0, 1]]) {
      let t = 0;
      const step = 2;
      while (t < 700) {
        const nx = s.x + vx * (t + step), ny = s.y + vy * (t + step);
        if (nx < PLAYER_SIZE / 2 || nx > arena.width - PLAYER_SIZE / 2 || ny < PLAYER_SIZE / 2 || ny > arena.height - PLAYER_SIZE / 2) break;
        if (blockedByCover(nx, ny, PLAYER_SIZE, arena.cover)) break;
        t += step;
      }
      console.log(`   runway ${who.padEnd(6)} ${name.padEnd(17)} ${String(t).padStart(4)}wu ${t < 100 ? '  <- walks into furniture' : ''}`);
    }
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// --occl : occlusion AS A FUNCTION OF THE CLOSING RING
// ─────────────────────────────────────────────────────────────────────────────
if (args.occl) {
  const STEP_WU = 280 / 60;
  const ANGLES = 72;
  const GRID = Number(args.grid ?? 40);
  const rung = Number(args.rung ?? REACH.rangedMax);

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

  // The radii the ring actually visits: maxSafeRadius linearly down to MIN_SAFE_RADIUS.
  const R0 = arena.maxSafeRadius;
  const stops = [];
  for (let i = 0; i <= 8; i++) {
    const R = R0 + (MIN_SAFE_RADIUS - R0) * (i / 8);
    stops.push(R);
  }
  const rows = [];
  for (const R of stops) {
    let n = 0, blocked = 0, standable = 0;
    for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) {
      const x = ((gx + 0.5) / GRID) * arena.width, y = ((gy + 0.5) / GRID) * arena.height;
      if (dist(x, y, arena.center.x, arena.center.y) > R) continue;
      if (blockedByCover(x, y, PLAYER_SIZE, arena.cover)) continue;
      standable++;
      for (let a = 0; a < ANGLES; a++) {
        const ang = (a / ANGLES) * Math.PI * 2;
        const hit = blockedAt(x, y, ang, rung);
        n++; if (hit !== null) blocked++;
      }
    }
    const tPct = (R0 - R) / (R0 - MIN_SAFE_RADIUS);
    rows.push({ R: Math.round(R), t: tPct * (MATCH_DURATION_MS / 1000) * ((R0 - MIN_SAFE_RADIUS) / R0), occl: n ? blocked / n : null, standable });
  }
  const first = rows[0].occl, last = rows[rows.length - 1].occl;
  console.log(`\n== OCCLUSION vs RING [${TAG}] — rung ${rung}wu, ${arena.cover.length} boxes, ${(arena.cover.reduce((a, c) => a + c.w * c.h, 0) / (arena.width * arena.height) * 100).toFixed(1)}% of floor solid`);
  console.log(`   ${'R'.padStart(6)}  ${'t'.padStart(7)}  ${'standable'.padStart(10)}   occlusion`);
  for (const r of rows) {
    const bar = '#'.repeat(Math.round((r.occl ?? 0) * 60));
    console.log(`   ${String(r.R).padStart(6)}  ${secs(r.t * 1000).padStart(7)}  ${String(r.standable).padStart(10)}   ${(r.occl === null ? '—' : pct(r.occl)).padStart(7)} ${bar}`);
  }
  console.log(`\n   OPENING ${pct(first)}  ->  ENDGAME ${pct(last)}   delta ${((last - first) * 100).toFixed(1)}pp  ${last <= first ? 'PASS (the endgame OPENS)' : 'FAIL (the endgame CLOSES)'}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// scripted player — IMPORTED, not copied
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 163 lines used to sit here, described as "a reduced copy of match-sim.mjs's `smart`,
 * same decisions". It stopped being the same decisions on 2026-08-05, when
 * `match-sim.mjs` fixed a real defect this copy could not receive: the stuck detector
 * ran during the COUNTDOWN, when `sim.ts:movePlayer` is not called at all, so it read
 * "1.5 s of walking, 0 wu covered", latched a 900 ms perpendicular detour, and whatever
 * was still latched at the whistle was walked SIDEWAYS. +567 ms on the derivable arena.
 *
 * And this copy was the SOURCE for four more: `status_census.mjs` and `roster_table.mjs`
 * lifted it verbatim, and `roster_sweep.mjs` / `status_grace_sweep.mjs` shell out to
 * those. One stale driver, five instruments, and the numbers behind this project's
 * balance record.
 *
 * The driver is now stated ONCE, in `tools/tmp/scripted_player.mjs`.
 * `--nav-countdown-bug` and `--decide-during-countdown` reproduce the historical
 * behaviour exactly, so any figure this tool has printed is still re-derivable.
 * `node tools/tmp/driver_guard.mjs` asserts a sixth copy cannot appear.
 *
 * ⚠️ This tool drives the policies with NO seeded stream (fixed 150 ms reaction, no
 * jitter), which is why `POLICY_FNS[...]()` is called without an rnd. The nav's initial
 * `detourSign` is +1 in that case, exactly as it has always been here — preserving it
 * is what makes this file's before/after measure the countdown fix ALONE.
 */
const DRIVER_FLAGS = parseDriverFlags(args);
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, hazard: HAZ_POT, ...DRIVER_FLAGS });
const { POLICY_FNS, createDecisionLoop } = driver;

function runMatch(playerId, enemyId, policy = POLICY, overrideArena = arena) {
  const state = createMatch(overrideArena, playerId, enemyId);
  const decide = (POLICY_FNS[policy] ?? POLICY_FNS.smart)();
  // The reaction cadence AND its countdown guard live in `scripted_player.mjs`.
  // No jitter here: this tool has always used a flat 150 ms and no seeded stream.
  const loop = createDecisionLoop({ decide, reactBase: 150 });
  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let sinceSample = Infinity;
  const SAMPLE_MS = 100;
  const engageRange = Math.max(maxNormalRange(playerId) + HIT_RADIUS_VS_ENEMY, maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER);
  const eReach = maxNormalRange(enemyId);
  const playing = [];
  let contactElapsed = null, contactPlayMs = null, firstHit = null;
  let enemyTravel = 0, playerTravel = 0, ex0 = state.enemy.x, ey0 = state.enemy.y, px0 = state.player.x, py0 = state.player.y;
  const HARD_CAP = MATCH_DURATION_MS + 120_000;

  const dmg = {};
  const dmgToPlayer = {};
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    input = loop.next(state, DT);
    const evs = stepMatch(state, DT, input);
    for (const ev of evs) {
      if (ev.type !== 'hit-landed') continue;
      if (firstHit === null) firstHit = state.elapsed;
      dmg[ev.source.kind] = (dmg[ev.source.kind] ?? 0) + ev.amount;
      if (ev.targetRole === 'player') dmgToPlayer[ev.source.kind] = (dmgToPlayer[ev.source.kind] ?? 0) + ev.amount;
    }
    enemyTravel += Math.hypot(state.enemy.x - ex0, state.enemy.y - ey0);
    playerTravel += Math.hypot(state.player.x - px0, state.player.y - py0);
    ex0 = state.enemy.x; ey0 = state.enemy.y; px0 = state.player.x; py0 = state.player.y;
    sinceSample += DT;
    if (sinceSample >= SAMPLE_MS && state.phase === 'playing') {
      sinceSample = 0;
      const d = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y);
      const eng = d <= engageRange;
      playing.push({
        t: state.elapsed, play: MATCH_DURATION_MS - state.timeRemaining,
        ex: state.enemy.x, ey: state.enemy.y, d, eng,
        offFair: Math.abs(state.player.x - state.enemy.x) > 199.2 || Math.abs(state.player.y - state.enemy.y) > 199.2,
      });
      if (eng && contactElapsed === null) { contactElapsed = state.elapsed; contactPlayMs = MATCH_DURATION_MS - state.timeRemaining; }
    }
  }

  const win = Math.max(1, Math.round(3000 / SAMPLE_MS));
  let stalled = 0, longest = 0, run = 0;
  for (let i = win; i < playing.length; i++) {
    const w = playing.slice(i - win, i + 1);
    const xs = w.map((s) => s.ex), ys = w.map((s) => s.ey);
    const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (span < 15 && w[w.length - 1].d > eReach + HIT_RADIUS_VS_PLAYER) { stalled++; run += SAMPLE_MS; longest = Math.max(longest, run); }
    else run = 0;
  }

  return {
    player: playerId, enemy: enemyId,
    outcome: state.phase === 'ended' ? (state.winner === 'player' ? 'player' : 'enemy') : 'NO-END',
    playMs: MATCH_DURATION_MS - state.timeRemaining,
    contactElapsedMs: contactElapsed, contactPlayMs, firstHitMs: firstHit,
    deadFrac: playing.length ? playing.filter((s) => !s.eng).length / playing.length : 0,
    offFairFrac: playing.length ? playing.filter((s) => s.offFair).length / playing.length : 0,
    stallFrac: playing.length ? stalled / playing.length : 0,
    longestStallMs: longest, enemyTravel, playerTravel, dmg, dmgToPlayer,
  };
}

function sweep(policy = POLICY, a = arena) {
  const all = [];
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    all.push(runMatch(p, e, policy, a));
  }
  const n = all.length;
  const avg = (f) => all.reduce((acc, r) => acc + f(r), 0) / n;
  const withContact = all.filter((r) => r.contactElapsedMs !== null);
  const meanOf = (arr, f) => (arr.length ? arr.reduce((acc, r) => acc + f(r), 0) / arr.length : NaN);
  return {
    n, all,
    winRate: all.filter((r) => r.outcome === 'player').length / n,
    noEnd: all.filter((r) => r.outcome === 'NO-END').length,
    matchMs: avg((r) => r.playMs),
    contactPlayMs: meanOf(withContact, (r) => r.contactPlayMs),
    contactElapsedMs: meanOf(withContact, (r) => r.contactElapsedMs),
    noContact: all.length - withContact.length,
    deadFrac: avg((r) => r.deadFrac),
    offFairFrac: avg((r) => r.offFairFrac),
    stallFrac: avg((r) => r.stallFrac),
    longestStallMs: Math.max(...all.map((r) => r.longestStallMs)),
    playerTravel: avg((r) => r.playerTravel),
    clockUsed: avg((r) => r.playMs) / MATCH_DURATION_MS,
    /** Where the HP goes. A layout that funnels both fighters onto the central hazard
     *  changes the damage mix without touching a single balance constant. */
    dmgShare: (() => {
      const tot = {}; let sum = 0;
      for (const r of all) for (const [k, v] of Object.entries(r.dmg)) { tot[k] = (tot[k] ?? 0) + v; sum += v; }
      const out = {};
      for (const [k, v] of Object.entries(tot)) out[k] = v / sum;
      return out;
    })(),
    potShareToPlayer: (() => {
      let haz = 0, sum = 0;
      for (const r of all) for (const [k, v] of Object.entries(r.dmgToPlayer)) { sum += v; if (k === 'hazard') haz += v; }
      return sum ? haz / sum : 0;
    })(),
  };
}

if (args.matchups) {
  const s = sweep();
  console.log(`\n== MATCHUPS [${TAG}] — ${s.n} matchups, policy=${POLICY}, clock ${MATCH_DURATION_MS / 1000}s`);
  console.log(`   player win rate         ${pct(s.winRate)}   (never ended: ${s.noEnd})`);
  console.log(`   match length            mean ${secs(s.matchMs)}  = ${pct(s.clockUsed)} of the clock`);
  console.log(`   TIME TO FIRST CONTACT   ${secs(s.contactPlayMs)} MATCH CLOCK (${pct(s.contactPlayMs / s.matchMs)} of the mean match)  ·  ${secs(s.contactElapsedMs)} elapsed`);
  console.log(`   DEAD TIME               ${pct(s.deadFrac)} out of reach of each other`);
  console.log(`   ENEMY OFF-SCREEN        ${pct(s.offFairFrac)} outside the 199.2wu guaranteed-visible square`);
  console.log(`   AI STALLED              ${pct(s.stallFrac)}  ·  longest ${secs(s.longestStallMs)}`);
  console.log(`   player travel           ${Math.round(s.playerTravel)}wu\n`);
  if (args.out) {
    mkdirSync(dirname(String(args.out)), { recursive: true });
    writeFileSync(String(args.out), JSON.stringify({ tag: TAG, policy: POLICY, ...s }, null, 2));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --spawnsweep : choose the gap by measurement
// ─────────────────────────────────────────────────────────────────────────────
if (args.spawnsweep) {
  const xs = String(args.xs ?? '160,220,280,340,400,460,520').split(',').map(Number);
  console.log(`\n== SPAWN SWEEP [${TAG}] — policy=${POLICY}, clock ${MATCH_DURATION_MS / 1000}s, 110 matchups per row`);
  console.log(`   spawns held at y=${arena.playerSpawn.y} and point-symmetric, so only the GAP varies.`);
  console.log(`   theoretical floor = (gap - engageRange) / (PLAYER_SPEED + AI_CHASE_SPEED) = (gap-165)/190 wu/s\n`);
  console.log(`   ${'x'.padStart(5)}${'gap'.padStart(7)}${'floor'.padStart(8)}${'contact'.padStart(9)}${'x floor'.padStart(9)}${'dead'.padStart(8)}${'match'.padStart(8)}${'clock%'.padStart(8)}${'win%'.padStart(7)}${'offFair'.padStart(9)}   legal`);
  for (const x of xs) {
    const sy = arena.playerSpawn.y;
    const a = {
      ...arena,
      playerSpawn: { x, y: sy },
      enemySpawn: { x: arena.width - x, y: arena.height - sy },
    };
    const legal = !blockedByCover(x, sy, PLAYER_SIZE, arena.cover);
    const gap = arena.width - 2 * x;
    const floorS = (gap - 165) / 190;
    const s = sweep(POLICY, a);
    console.log(`   ${String(x).padStart(5)}${String(gap).padStart(7)}${(`${floorS.toFixed(1)}s`).padStart(8)}${secs(s.contactPlayMs).padStart(9)}${(`${(s.contactPlayMs / 1000 / floorS).toFixed(1)}x`).padStart(9)}${pct(s.deadFrac).padStart(8)}${secs(s.matchMs).padStart(8)}${pct(s.clockUsed).padStart(8)}${pct(s.winRate).padStart(7)}${pct(s.offFairFrac).padStart(9)}   ${legal ? 'ok' : 'INSIDE COVER'}`);
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// --reach : grid reachability through the real stepMatch
// ─────────────────────────────────────────────────────────────────────────────
if (args.reach) {
  const enemyId = String(args.enemy ?? 'donut');
  const GW = Number(args.gw ?? 28), GH = Number(args.gh ?? 20);
  const rows = [];
  let reached = 0, cells = 0, blocked = 0;
  const times = [], misses = [];
  for (let gy = 0; gy < GH; gy++) {
    let row = '';
    for (let gx = 0; gx < GW; gx++) {
      const x = ((gx + 0.5) / GW) * arena.width, y = ((gy + 0.5) / GH) * arena.height;
      if (blockedByCover(x, y, PLAYER_SIZE, arena.cover)) { row += '#'; blocked++; continue; }
      cells++;
      const st = createMatch(arena, 'hamburger', enemyId);
      const reach = maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER;
      st.player.x = x; st.player.y = y; st.player.hp = 1e9; st.player.maxHp = 1e9;
      st.enemy.hp = 1e9; st.enemy.maxHp = 1e9;
      let best = Infinity, tReach = null;
      while (st.elapsed < MATCH_DURATION_MS + 6000 && st.phase !== 'ended') {
        st.player.x = x; st.player.y = y;
        stepMatch(st, DT, IDLE);
        const d = dist(st.enemy.x, st.enemy.y, x, y);
        if (d < best) best = d;
        if (d <= reach && tReach === null) tReach = st.elapsed;
      }
      if (tReach !== null) { reached++; times.push(tReach); row += tReach < 10000 ? '.' : tReach < 20000 ? ':' : '+'; }
      else { row += best < reach * 2 ? 'o' : 'X'; misses.push({ x: Math.round(x), y: Math.round(y), best: Math.round(best) }); }
    }
    rows.push(row);
  }
  console.log(`\n== REACHABILITY [${TAG}] enemy=${enemyId}  grid ${GW}x${GH}  clock ${MATCH_DURATION_MS / 1000}s`);
  console.log(`   '.' <10s  ':' <20s  '+' slower  'o' close but never arrived  'X' never got close  '#' unstandable\n`);
  rows.forEach((r, i) => console.log(`   ${String(Math.round(((i + 0.5) / GH) * arena.height)).padStart(4)} |${r}|`));
  times.sort((a, b) => a - b);
  console.log(`\n   REACHED ${reached}/${cells} standable cells (${(reached / cells * 100).toFixed(1)}%)   unstandable ${blocked}`);
  if (times.length) console.log(`   time to reach: median ${secs(times[Math.floor(times.length / 2)])}  p90 ${secs(times[Math.floor(times.length * 0.9)])}  max ${secs(times[times.length - 1])}`);
  for (const m of misses) console.log(`     MISS (${m.x},${m.y}) closest ${m.best}wu`);
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// --audit : the three geometry defects that are invisible in a screenshot
// ─────────────────────────────────────────────────────────────────────────────
//
//  1. MESH CLIP — two CoverBoxes overlapping. Their visuals intersect; nothing in the
//     sim complains, and at gameplay framing a 2 wu clip is unnoticeable until it isn't.
//  2. SLIVER — a legal channel narrower than the 10 wu nav cell. Legal for a fighter
//     (its centre fits) but invisible to the flow field, which is exactly the state
//     where `--truth` says 100% and `--reach` does not.
//  3. PINCH — a channel between 10 and 45 wu: routable, but only just.
//
// Sealed pockets are NOT here; they are `--truth`'s job, because only a flood can find
// them. This is the pre-flight check, `--truth` is the proof.
if (args.audit) {
  const clips = [];
  for (let i = 0; i < arena.cover.length; i++) for (let j = i + 1; j < arena.cover.length; j++) {
    const a = arena.cover[i], b = arena.cover[j];
    const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
    const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
    if (ox > 0 && oy > 0) clips.push({ a, b, ox: ox.toFixed(1), oy: oy.toFixed(1) });
  }
  const L = 2;
  const f = flood(L);
  // A channel is only real if it persists: require the same run to exist across at least
  // MIN_LEN wu of the perpendicular axis, which is what rejects the 2 wu tangential
  // slivers every pair of near-touching boxes produces at its corner.
  const MIN_LEN = 20;
  const found = [];
  for (const axis of ['x', 'y']) {
    const outerN = axis === 'x' ? f.rows : f.cols;
    const innerN = axis === 'x' ? f.cols : f.rows;
    const get = axis === 'x' ? (o, i) => f.legal[o * f.cols + i] : (o, i) => f.legal[i * f.cols + o];
    const runsPerOuter = [];
    for (let o = 0; o < outerN; o++) {
      const runs = [];
      let start = -1;
      for (let i = 0; i <= innerN; i++) {
        const ok = i < innerN && get(o, i);
        if (ok && start < 0) start = i;
        if (!ok && start >= 0) { if (start > 0 && i < innerN) runs.push([start, i]); start = -1; }
      }
      runsPerOuter.push(runs);
    }
    for (let o = 0; o < outerN; o++) {
      for (const [s, e] of runsPerOuter[o]) {
        const width = (e - s) * L;
        if (width >= 46) continue;
        let len = 1;
        for (let k = o + 1; k < outerN; k++) {
          if (!runsPerOuter[k].some(([s2, e2]) => Math.abs(s2 - s) <= 2 && Math.abs(e2 - e) <= 2)) break;
          len++;
        }
        if (len * L < MIN_LEN) continue;
        // only report the first outer index of a persistent channel
        if (o > 0 && runsPerOuter[o - 1].some(([s2, e2]) => Math.abs(s2 - s) <= 2 && Math.abs(e2 - e) <= 2)) continue;
        const at = axis === 'x'
          ? { x: Math.round((s + (e - s) / 2) * L), y: Math.round(o * L) }
          : { x: Math.round(o * L), y: Math.round((s + (e - s) / 2) * L) };
        found.push({ axis, width, len: len * L, at });
      }
    }
  }
  found.sort((a, b) => a.width - b.width);
  console.log(`\n== GEOMETRY AUDIT [${TAG}]`);
  console.log(`   MESH CLIPS (CoverBoxes whose visuals intersect): ${clips.length}`);
  for (const c of clips) console.log(`     ${c.a.kind}@${c.a.x},${c.a.y}  x  ${c.b.kind}@${c.b.x},${c.b.y}   overlap ${c.ox} x ${c.oy} wu`);
  const slivers = found.filter((x) => x.width < 10);
  const pinches = found.filter((x) => x.width >= 10 && x.width < 46);
  console.log(`   SLIVERS below the 10wu nav cell (legal but unroutable): ${slivers.length}`);
  for (const s of slivers) console.log(`     ${String(s.width).padStart(3)}wu wide, ${String(s.len).padStart(4)}wu long, ${s.axis}-channel at (${s.at.x},${s.at.y})`);
  console.log(`   PINCHES 10..45wu (routable, but tight): ${pinches.length}`);
  for (const s of pinches.slice(0, 14)) console.log(`     ${String(s.width).padStart(3)}wu wide, ${String(s.len).padStart(4)}wu long, ${s.axis}-channel at (${s.at.x},${s.at.y})`);
  console.log('');
  if (clips.length || slivers.length) process.exitCode = 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// --map : the layout as characters, plus the radial density profile
// ─────────────────────────────────────────────────────────────────────────────
//
// The acceptance test "occlusion must not RISE as the ring closes" is really a
// statement about radial density: cover has to get SPARSER toward the centre, or a
// shrinking sample of the map necessarily gets denser. The profile below is that
// statement as a number, which is far more actionable than the occlusion series alone.
if (args.map) {
  const CW = 90, CH = 34;
  const rows = [];
  for (let r = 0; r < CH; r++) {
    let line = '';
    for (let c = 0; c < CW; c++) {
      const x = ((c + 0.5) / CW) * arena.width, y = ((r + 0.5) / CH) * arena.height;
      const inBox = arena.cover.find((o) => Math.abs(x - o.x) <= o.w / 2 && Math.abs(y - o.y) <= o.h / 2);
      const dc = dist(x, y, arena.center.x, arena.center.y);
      if (inBox) line += inBox.kind === 'boiling_pot' ? '@' : '#';
      else if (dist(x, y, arena.playerSpawn.x, arena.playerSpawn.y) < 30) line += 'P';
      else if (dist(x, y, arena.enemySpawn.x, arena.enemySpawn.y) < 30) line += 'E';
      else if (Math.abs(dc - MIN_SAFE_RADIUS) < 12) line += 'o';
      else if (Math.abs(dc - 300) < 10) line += '.';
      else if (Math.abs(dc - 500) < 10) line += ',';
      else line += ' ';
    }
    rows.push(line);
  }
  console.log(`\n== LAYOUT [${TAG}]  '#' cover  '@' pot  'o' MIN_SAFE_RADIUS ${MIN_SAFE_RADIUS}  '.' r=300  ',' r=500`);
  for (const r of rows) console.log(`   |${r}|`);

  const BANDS = [0, 150, 250, 350, 450, 550, 650, 750, 900];
  console.log(`\n   RADIAL COVER DENSITY (must INCREASE outward, or the closing ring densifies):`);
  const N = 900;
  const acc = BANDS.slice(0, -1).map(() => ({ n: 0, solid: 0 }));
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = ((i + 0.5) / N) * arena.width, y = ((j + 0.5) / N) * arena.height;
    const dc = dist(x, y, arena.center.x, arena.center.y);
    const b = BANDS.findIndex((v, k) => k < BANDS.length - 1 && dc >= v && dc < BANDS[k + 1]);
    if (b < 0) continue;
    acc[b].n++;
    if (arena.cover.some((o) => Math.abs(x - o.x) <= o.w / 2 && Math.abs(y - o.y) <= o.h / 2)) acc[b].solid++;
  }
  for (let b = 0; b < acc.length; b++) {
    const f = acc[b].n ? acc[b].solid / acc[b].n : 0;
    console.log(`     r ${String(BANDS[b]).padStart(3)}..${String(BANDS[b + 1]).padStart(3)}   ${(f * 100).toFixed(1).padStart(5)}% solid  ${'#'.repeat(Math.round(f * 120))}`);
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// --score : one compact line per candidate layout, for sweeping geometry ideas
// ─────────────────────────────────────────────────────────────────────────────
if (args.score) {
  const L = 2;
  const f = flood(L);
  const sealedNodes = f.comps.filter((c) => c.id !== f.spawnComp).reduce((a, c) => a + c.size, 0);
  const sealedPct = sealedNodes / f.nLegal * 100;

  // tightest legal corridor, ignoring anything against an arena wall
  let minGap = Infinity, minAt = null;
  for (const [outerN, innerN, get] of [
    [f.rows, f.cols, (a, b) => f.legal[a * f.cols + b]],
    [f.cols, f.rows, (a, b) => f.legal[b * f.cols + a]],
  ]) {
    for (let o = 1; o < outerN - 1; o++) {
      let run = -1;
      for (let i = 0; i <= innerN; i++) {
        const ok = i < innerN && get(o, i);
        if (ok && run < 0) run = i;
        if (!ok && run >= 0) {
          if (run > 0 && i < innerN) {
            const g = (i - run) * L;
            if (g < minGap) { minGap = g; minAt = [o * L, Math.round((run + (i - run) / 2) * L)]; }
          }
          run = -1;
        }
      }
    }
  }

  // occlusion series
  const STEP_WU = 280 / 60, ANGLES = 72, GRID = 40, rung = REACH.rangedMax;
  const R0 = arena.maxSafeRadius;
  const series = [];
  for (let i = 0; i <= 8; i++) {
    const R = R0 + (MIN_SAFE_RADIUS - R0) * (i / 8);
    let n = 0, blocked = 0;
    for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) {
      const x = ((gx + 0.5) / GRID) * arena.width, y = ((gy + 0.5) / GRID) * arena.height;
      if (dist(x, y, arena.center.x, arena.center.y) > R) continue;
      if (blockedByCover(x, y, PLAYER_SIZE, arena.cover)) continue;
      for (let a = 0; a < ANGLES; a++) {
        const ang = (a / ANGLES) * Math.PI * 2;
        let t = 0, hit = false;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        while (t < rung) {
          t = Math.min(t + STEP_WU, rung);
          const X = x + cx * t, Y = y + cy * t;
          if (arena.cover.some((o) => Math.abs(X - o.x) < (12 + o.w) / 2 && Math.abs(Y - o.y) < (12 + o.h) / 2)) { hit = true; break; }
        }
        n++; if (hit) blocked++;
      }
    }
    series.push(n ? blocked / n : null);
  }
  const peak = Math.max(...series.filter((v) => v !== null));
  const solid = arena.cover.reduce((a, c) => a + c.w * c.h, 0) / (arena.width * arena.height) * 100;

  const s = sweep(POLICY);
  console.log([
    `[${TAG}]`,
    `boxes ${String(arena.cover.length).padStart(2)}`,
    `solid ${solid.toFixed(1).padStart(4)}%`,
    `sealed ${sealedPct.toFixed(2).padStart(5)}%`,
    `minGap ${String(minGap).padStart(3)}wu`,
    `occl ${(series[0] * 100).toFixed(1).padStart(4)}->${(series[8] * 100).toFixed(1).padStart(4)}%`,
    `peak ${(peak * 100).toFixed(1).padStart(4)}%`,
    `${peak <= series[0] + 1e-9 ? 'MONO' : 'RISE'}`,
    `contact ${secs(s.contactPlayMs).padStart(5)}`,
    `dead ${pct(s.deadFrac).padStart(5)}`,
    `match ${secs(s.matchMs).padStart(5)}`,
    `win ${pct(s.winRate).padStart(5)}`,
    `offFair ${pct(s.offFairFrac).padStart(5)}`,
    `dmg ${Object.entries(s.dmgShare).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${(v * 100).toFixed(0)}`).join('/')}`,
  ].join('  '));
  if (args.verbose) console.log(`     occl series ${series.map((v) => (v * 100).toFixed(0)).join(' ')}  minGap at ${minAt}  sealed pieces ${f.comps.length - 1}`);
}

if (!args.truth && !args.reach && !args.matchups && !args.occl && !args.spawnsweep && !args.verify && !args.gaps && !args.route && !args.score && !args.map && !args.audit) {
  console.log('nothing to do: --verify --truth --gaps --reach --matchups --occl --spawnsweep');
}
