#!/usr/bin/env node
/**
 * NAVIGATION acceptance probe.
 *
 * Every number this task quotes comes from here, and every one of them is measured
 * against `tools/tmp/nav-arena.json` — MY OWN frozen dump of the arena, taken once at
 * the start of the run (see `nav_freeze_arena.mjs`). The shared `tools/arena.gameplay.json`
 * is contested: an arena peer is adding cover live and has already reverted
 * `maxSafeRadius` once. Reading the private copy is what makes before/after comparable.
 *
 * Four measurements, each an acceptance test rather than a vibe:
 *
 *   --reach     Grid reachability. A motionless, IMMORTAL player is parked on each cell
 *               of a 28x20 grid and a full match is run through the real `stepMatch`.
 *               Did the enemy ever get inside its own weapon reach? The enemy is
 *               immortal too — `match-sim.mjs --pathmap` only immortalises the player,
 *               so on the 45 s clock a cell far from centre can score "unreachable"
 *               because the AI drowned in fog, which measures the RING, not the pathing.
 *               Both variants are printed so the difference is visible.
 *
 *   --alcove    THE named failure, as a specific reproducible case rather than an
 *               average: the player standing on its own spawn (160,500), which sits in
 *               an alcove behind a barrel bridging two prep counters. Reports whether
 *               the AI arrives, when, its closest approach, and the route it took.
 *
 *   --matchups  All 110 matchups with the scripted `smart` player. Win rate,
 *               time-to-first-contact (both as ELAPSED — comparable to the 13.0 s on
 *               record — and as MATCH-CLOCK, which is the honest walking time, since
 *               elapsed carries 5.7 s of countdown), match length, AI stall fraction.
 *
 *   --cost      Hardware-independent cost of the navigation layer: flow-field rebuilds
 *               per match, cells visited, and steering work per tick. No timings —
 *               SwiftShader is a CPU rasteriser and this box cannot measure frame time
 *               (docs/LESSONS.md S10).
 *
 * `--tag <name>` labels the run so before/after JSON can be diffed.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ARENA_PATH = `${ROOT}/tools/tmp/nav-arena.json`;

/**
 * `--baseline` runs the identical measurement against `src/game/` AS COMMITTED AT HEAD,
 * extracted by `tools/tmp/nav_baseline_setup.mjs` — which writes into the OS temp dir, NOT
 * the repo, because `tsconfig.json` includes all of `tools/` and a scratch directory of
 * `.ts` files there turns `npx tsc --noEmit` red for every other agent at once.
 *
 * Run `node tools/tmp/nav_baseline_setup.mjs` once before using `--baseline`.
 */
const BASELINE_DIR = `${tmpdir()}/fa-nav-baseline`;
const SIM_DIR = args0('baseline') ? `${BASELINE_DIR}/game` : `${ROOT}/src/game`;
function args0(flag) { return process.argv.includes(`--${flag}`); }

const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, PLAYER_SIZE,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, REACH,
} = RULES;

let NAV = null;
try { NAV = await import(`${SIM_DIR}/movement.ts`); } catch { /* unreachable */ }

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
const DT = Number(args.dt ?? 16.667);
const TAG = `${args.tag ?? 'run'}${args.baseline ? ' (HEAD baseline)' : ''}`;
const POLICY = String(args.policy ?? 'smart');

const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
const arena = { ...ARENA_DATA, build: () => null, update: () => {} };

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const secs = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)}s`);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

const maxNormalRange = (id) =>
  Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);

function blockedByCover(x, y, size, cover) {
  const h = size / 2;
  return cover.some((c) => Math.abs(x - c.x) < h + c.w / 2 && Math.abs(y - c.y) < h + c.h / 2);
}

const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

/**
 * Run one "can the AI get to this spot" trial. The player is a pinned statue; both
 * fighters are optionally immortal so the closing ring cannot decide the answer.
 * Returns { reached, tReachMs, bestDist, travel, endedBy }.
 */
function chaseTrial(x, y, enemyId, { immortalEnemy = true, budgetMs = MATCH_DURATION_MS + 6000 } = {}) {
  const st = createMatch(arena, 'hamburger', enemyId);
  const reach = maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER;
  st.player.x = x; st.player.y = y;
  st.player.hp = 1e9; st.player.maxHp = 1e9;
  if (immortalEnemy) { st.enemy.hp = 1e9; st.enemy.maxHp = 1e9; }
  let best = Infinity, tReach = null, travel = 0;
  let px = st.enemy.x, py = st.enemy.y;
  while (st.elapsed < budgetMs && st.phase !== 'ended') {
    st.player.x = x; st.player.y = y;
    stepMatch(st, DT, IDLE);
    travel += Math.hypot(st.enemy.x - px, st.enemy.y - py);
    px = st.enemy.x; py = st.enemy.y;
    const d = dist(st.enemy.x, st.enemy.y, x, y);
    if (d < best) best = d;
    if (d <= reach && tReach === null) tReach = st.elapsed;
  }
  return { reached: tReach !== null, tReachMs: tReach, bestDist: best, reach, travel, endedBy: st.elapsed };
}

// ─────────────────────────────────────────────────────────────────────────────
if (args.reach) {
  const enemyId = String(args.enemy ?? 'donut');
  const GW = Number(args.gw ?? 28), GH = Number(args.gh ?? 20);
  const immortalEnemy = args['mortal-enemy'] ? false : true;
  const rows = [];
  let reached = 0, cells = 0, blocked = 0;
  const times = [];
  const misses = [];

  for (let gy = 0; gy < GH; gy++) {
    let row = '';
    for (let gx = 0; gx < GW; gx++) {
      const x = ((gx + 0.5) / GW) * arena.width;
      const y = ((gy + 0.5) / GH) * arena.height;
      if (blockedByCover(x, y, PLAYER_SIZE, arena.cover)) { row += '#'; blocked++; continue; }
      cells++;
      const r = chaseTrial(x, y, enemyId, { immortalEnemy });
      if (r.reached) {
        reached++; times.push(r.tReachMs);
        row += r.tReachMs < 15000 ? '.' : r.tReachMs < 30000 ? ':' : '+';
      } else {
        row += r.bestDist < r.reach * 2 ? 'o' : 'X';
        misses.push({ x: Math.round(x), y: Math.round(y), best: Math.round(r.bestDist), kind: r.bestDist < r.reach * 2 ? 'o' : 'X' });
      }
    }
    rows.push(row);
  }

  console.log(`\n== REACHABILITY [${TAG}] enemy=${enemyId} reach=${Math.round(maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER)}wu  grid ${GW}x${GH}  clock ${MATCH_DURATION_MS / 1000}s  enemy immortal=${immortalEnemy}`);
  console.log(`   '.' <15s  ':' <30s  '+' <51s  'o' within 2x reach, never arrived  'X' never got close  '#' unstandable\n`);
  rows.forEach((r, i) => console.log(`   ${String(Math.round(((i + 0.5) / GH) * arena.height)).padStart(4)} |${r}|`));
  times.sort((a, b) => a - b);
  console.log(`\n   REACHED ${reached}/${cells} standable cells (${(reached / cells * 100).toFixed(1)}%)   never ${cells - reached} (${((cells - reached) / cells * 100).toFixed(1)}%)   unstandable ${blocked}`);
  if (times.length) console.log(`   time to reach: median ${secs(times[Math.floor(times.length / 2)])}  p90 ${secs(times[Math.floor(times.length * 0.9)])}  max ${secs(times[times.length - 1])}  mean ${secs(times.reduce((a, b) => a + b, 0) / times.length)}`);
  if (misses.length) {
    console.log(`\n   UNREACHED CELLS (${misses.length}):`);
    for (const m of misses) console.log(`     ${m.kind}  (${String(m.x).padStart(4)},${String(m.y).padStart(4)})  closest approach ${m.best}wu`);
  }
  const pSpawnCell = { x: arena.playerSpawn.x, y: arena.playerSpawn.y };
  console.log(`\n   player spawn (${pSpawnCell.x},${pSpawnCell.y}) · enemy spawn (${arena.enemySpawn.x},${arena.enemySpawn.y})\n`);
  if (args.out) {
    mkdirSync(dirname(String(args.out)), { recursive: true });
    writeFileSync(String(args.out), JSON.stringify({ tag: TAG, enemyId, GW, GH, reached, cells, blocked, rows, misses, times }, null, 2));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --truth : the CEILING. What is reachable at all, independent of any AI?
//
// Floods a 4 wu lattice of legal fighter-centre positions outward from the enemy spawn
// using the same collision test `tryMove` uses, then asks, for every cell of the --reach
// grid, whether ANY genuinely reachable point lies within weapon reach of it. That is the
// best score a perfect pathfinder could post, so it says which of the misses are pathing
// failures and which are geometry. "Reach 100%" is not automatically the right target.
// ─────────────────────────────────────────────────────────────────────────────
if (args.truth) {
  const enemyId = String(args.enemy ?? 'donut');
  const reach = maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER;
  const L = Number(args.lattice ?? 4);
  const cols = Math.floor(arena.width / L), rows = Math.floor(arena.height / L);
  const half = PLAYER_SIZE / 2;
  const legal = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const x = (gx + 0.5) * L, y = (gy + 0.5) * L;
    legal[gy * cols + gx] = (x >= half && x <= arena.width - half && y >= half && y <= arena.height - half
      && !blockedByCover(x, y, PLAYER_SIZE, arena.cover)) ? 1 : 0;
  }
  const seen = new Uint8Array(cols * rows);
  const q = new Int32Array(cols * rows);
  const sx = Math.min(cols - 1, Math.floor(arena.enemySpawn.x / L));
  const sy = Math.min(rows - 1, Math.floor(arena.enemySpawn.y / L));
  let head = 0, tail = 0;
  q[tail++] = sy * cols + sx; seen[sy * cols + sx] = 1;
  while (head < tail) {
    const c = q[head++], cx = c % cols, cy = (c - cx) / cols;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!legal[ni] || seen[ni]) continue;
      // Only orthogonally-decomposable diagonals, same rule the nav grid uses.
      if (ox && oy && (!legal[cy * cols + nx] || !legal[ny * cols + cx])) continue;
      seen[ni] = 1; q[tail++] = ni;
    }
  }
  const GW = Number(args.gw ?? 28), GH = Number(args.gh ?? 20);
  const rad = Math.ceil(reach / L);
  let inPrinciple = 0, cells = 0;
  const sealed = [];
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = ((gx + 0.5) / GW) * arena.width, y = ((gy + 0.5) / GH) * arena.height;
    if (blockedByCover(x, y, PLAYER_SIZE, arena.cover)) continue;
    cells++;
    const bx = Math.floor(x / L), by = Math.floor(y / L);
    let best = Infinity;
    for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      const nx = bx + ox, ny = by + oy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (!seen[ny * cols + nx]) continue;
      const d = Math.hypot((nx + 0.5) * L - x, (ny + 0.5) * L - y);
      if (d < best) best = d;
    }
    if (best <= reach) inPrinciple++;
    else sealed.push({ x: Math.round(x), y: Math.round(y), best: Number.isFinite(best) ? Math.round(best) : null });
  }
  // Label every connected region of legal standing space, not just the one the spawn is in.
  // "Is the floor one piece?" is an ARENA question that no pathfinder can answer for you,
  // and the answer here is no: the shipped kitchen has two sealed pockets that nothing —
  // AI or player — can ever enter. Worth printing every run, because a peer moving cover
  // can create or heal one without noticing.
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

  console.log(`\n== REACHABILITY CEILING [${TAG}] — ${L}wu lattice flood from the enemy spawn, reach ${Math.round(reach)}wu`);
  console.log(`   ${tail} of ${cols * rows} lattice nodes are reachable at all (${pct(tail / (cols * rows))} of the map, ${pct(tail / nLegal)} of legal standing space)`);
  console.log(`\n   WALKABLE FLOOR IS ${comps.length === 1 ? 'ONE PIECE' : `${comps.length} DISCONNECTED PIECES`}:`);
  for (const c of comps) {
    console.log(`     #${c.id}  ${String(c.size).padStart(6)} nodes (${(c.size / nLegal * 100).toFixed(2)}%)  x[${c.bbox[0]}..${c.bbox[2]}] y[${c.bbox[1]}..${c.bbox[3]}]${c.size === comps[0].size ? '   <- the main floor' : '   <- SEALED: nothing can enter or leave'}`);
  }
  console.log(`   CEILING: ${inPrinciple}/${cells} grid cells (${(inPrinciple / cells * 100).toFixed(1)}%) — a perfect pathfinder could do no better`);
  if (sealed.length) {
    console.log(`\n   GENUINELY UNREACHABLE (${sealed.length}) — no legal route brings any fighter within reach:`);
    for (const s of sealed) console.log(`     (${String(s.x).padStart(4)},${String(s.y).padStart(4)})  nearest reachable point ${s.best === null ? '>reach' : `${s.best}wu`}`);
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
if (args.alcove) {
  const enemies = args.enemy ? [String(args.enemy)] : CHARACTER_IDS;
  console.log(`\n== ALCOVE CASE [${TAG}] — player pinned on ITS OWN SPAWN (${arena.playerSpawn.x},${arena.playerSpawn.y}), immortal; enemy from (${arena.enemySpawn.x},${arena.enemySpawn.y})`);
  console.log(`   this is docs/STATE.md item 7's named failure: "gets within 2x reach, never arrives"\n`);
  console.log(`   ${'enemy'.padEnd(14)}${'reach'.padStart(7)}${'arrives'.padStart(10)}${'t'.padStart(9)}${'closest'.padStart(10)}${'travel'.padStart(9)}`);
  let arrived = 0;
  for (const e of enemies) {
    const r = chaseTrial(arena.playerSpawn.x, arena.playerSpawn.y, e, { immortalEnemy: true });
    if (r.reached) arrived++;
    console.log(`   ${e.padEnd(14)}${String(Math.round(r.reach)).padStart(7)}${(r.reached ? 'YES' : 'NO').padStart(10)}${secs(r.tReachMs).padStart(9)}${String(Math.round(r.bestDist)).padStart(10)}${String(Math.round(r.travel)).padStart(9)}`);
  }
  console.log(`\n   ARRIVES: ${arrived}/${enemies.length}\n`);

  // Route trace for one representative enemy.
  if (args.trace) {
    const e = String(args.enemy ?? 'donut');
    const st = createMatch(arena, 'hamburger', e);
    st.player.x = arena.playerSpawn.x; st.player.y = arena.playerSpawn.y;
    st.player.hp = 1e9; st.player.maxHp = 1e9;
    st.enemy.hp = 1e9; st.enemy.maxHp = 1e9;
    const pts = [];
    let last = -1e9;
    while (st.elapsed < MATCH_DURATION_MS + 6000 && st.phase !== 'ended') {
      st.player.x = arena.playerSpawn.x; st.player.y = arena.playerSpawn.y;
      stepMatch(st, DT, IDLE);
      if (st.elapsed - last >= 1000) {
        last = st.elapsed;
        pts.push({ t: Math.round(st.elapsed), x: Math.round(st.enemy.x), y: Math.round(st.enemy.y), d: Math.round(dist(st.enemy.x, st.enemy.y, arena.playerSpawn.x, arena.playerSpawn.y)) });
      }
    }
    console.log(`   ROUTE (${e}), one sample per second:`);
    for (const p of pts) console.log(`     t=${String(p.t / 1000).padStart(5)}s  (${String(p.x).padStart(4)},${String(p.y).padStart(4)})  d=${String(p.d).padStart(4)}wu`);
    console.log('');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scripted-player matchup sweep. Deliberately a REDUCED copy of match-sim.mjs's
// `smart` policy — same decisions, same 150 ms cadence — so the two agree, but
// reading MY frozen arena rather than the contested shared cache.
// ─────────────────────────────────────────────────────────────────────────────
const POT = arena.hazards.find((h) => h.kind === 'damage');

function axesToward(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
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
    const dmg = w.damage ?? 0;
    if (dmg > bestDmg) { bestDmg = dmg; best = i; }
  });
  return best;
}
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
function makeNav() {
  const hist = [];
  let detourUntil = -1, detourSign = 1;
  return function walk(state, tx, ty) {
    const p = state.player;
    hist.push({ t: state.elapsed, x: p.x, y: p.y });
    while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();
    if (state.elapsed > detourUntil && hist.length > 4 && state.elapsed - hist[0].t > 1200) {
      const net = Math.hypot(p.x - hist[0].x, p.y - hist[0].y);
      if (net < 45) { detourSign = -detourSign; detourUntil = state.elapsed + 900; hist.length = 0; }
    }
    let ax = tx, ay = ty;
    if (state.elapsed < detourUntil) {
      const ang = Math.atan2(ty - p.y, tx - p.x) + detourSign * (Math.PI / 2);
      ax = p.x + Math.cos(ang) * 150; ay = p.y + Math.sin(ang) * 150;
    }
    return axesToward(p.x, p.y, ax, ay);
  };
}
function smartPolicy() {
  const nav = makeNav();
  return (state) => {
    const p = state.player, e = state.enemy;
    const d = dist(p.x, p.y, e.x, e.y);
    const idx = bestWeapon(state, d);
    const band = preferredRange(p.characterId) * 0.85;
    const los = lineOfSight(p.x, p.y, e.x, e.y);
    const cx = arena.center.x, cy = arena.center.y;
    const dc = dist(p.x, p.y, cx, cy), R = state.safeRadius;
    let target;
    if (dc > R - 30) {
      target = { x: cx, y: cy };
      if (POT && R < POT.radius + 20) {
        const ang = Math.atan2(p.y - cy, p.x - cx), r = Math.max(0, R - 10);
        target = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
      }
    } else if (POT && dist(p.x, p.y, POT.x, POT.y) < POT.radius + 15 && R > POT.radius + 40) {
      const ang = Math.atan2(p.y - POT.y, p.x - POT.x);
      target = { x: POT.x + Math.cos(ang) * (POT.radius + 60), y: POT.y + Math.sin(ang) * (POT.radius + 60) };
    } else if (!los) {
      const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
      target = { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
    } else if (d > band) { target = { x: e.x, y: e.y }; }
    else if (d < band * 0.5) {
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
}

/** The player does nothing at all. The control: what can the AI do to a statue? */
function idlePolicy() {
  return () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false });
}
/** Run at the enemy and hold the trigger. The naive human's first thirty seconds. */
function chasePolicy() {
  const nav = makeNav();
  return (state) => {
    const p = state.player, e = state.enemy;
    const w = bestWeapon(state, dist(p.x, p.y, e.x, e.y));
    return { move: nav(state, e.x, e.y), aim: { x: e.x - p.x, y: e.y - p.y }, selectedWeapon: w ?? 0, attack: true };
  };
}
const POLICIES = { smart: smartPolicy, chase: chasePolicy, idle: idlePolicy };

function runMatch(playerId, enemyId) {
  const state = createMatch(arena, playerId, enemyId);
  const decide = (POLICIES[POLICY] ?? smartPolicy)();
  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let sinceDecision = Infinity, sinceSample = Infinity;
  const SAMPLE_MS = 100;
  const engageRange = Math.max(maxNormalRange(playerId) + HIT_RADIUS_VS_ENEMY, maxNormalRange(enemyId) + HIT_RADIUS_VS_PLAYER);
  const eReach = maxNormalRange(enemyId);
  const playing = [];
  let contactElapsed = null, contactPlayMs = null, firstHit = null;
  let enemyTravel = 0, ex0 = state.enemy.x, ey0 = state.enemy.y;
  const HARD_CAP = MATCH_DURATION_MS + 120_000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (sinceDecision >= 150) { input = decide(state); sinceDecision = 0; }
    const evs = stepMatch(state, DT, input);
    for (const ev of evs) if (ev.type === 'hit-landed' && firstHit === null) firstHit = state.elapsed;
    enemyTravel += Math.hypot(state.enemy.x - ex0, state.enemy.y - ey0);
    ex0 = state.enemy.x; ey0 = state.enemy.y;
    sinceDecision += DT; sinceSample += DT;
    if (sinceSample >= SAMPLE_MS && state.phase === 'playing') {
      sinceSample = 0;
      const d = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y);
      const eng = d <= engageRange;
      playing.push({ t: state.elapsed, play: MATCH_DURATION_MS - state.timeRemaining, ex: state.enemy.x, ey: state.enemy.y, d, eng });
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
    contactElapsedMs: contactElapsed, contactPlayMs,
    firstHitMs: firstHit,
    deadFrac: playing.length ? playing.filter((s) => !s.eng).length / playing.length : 0,
    stallFrac: playing.length ? stalled / playing.length : 0,
    longestStallMs: longest,
    enemyTravel,
    finalPlayerHp: state.player.hp, finalEnemyHp: state.enemy.hp,
  };
}

if (args.matchups) {
  const all = [];
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    all.push(runMatch(p, e));
  }
  const n = all.length;
  const avg = (f) => all.reduce((a, r) => a + f(r), 0) / n;
  const wins = all.filter((r) => r.outcome === 'player').length;
  const noEnd = all.filter((r) => r.outcome === 'NO-END').length;
  const noContact = all.filter((r) => r.contactElapsedMs === null).length;
  const withContact = all.filter((r) => r.contactElapsedMs !== null);
  const mean = (arr, f) => arr.reduce((a, r) => a + f(r), 0) / arr.length;
  console.log(`\n== MATCHUPS [${TAG}] — ${n} matchups, policy=${POLICY}, clock ${MATCH_DURATION_MS / 1000}s`);
  console.log(`   player win rate         ${pct(wins / n)}   (${wins}/${n}, never ended: ${noEnd})`);
  console.log(`   match length            mean ${secs(avg((r) => r.playMs))}  min ${secs(Math.min(...all.map((r) => r.playMs)))}  max ${secs(Math.max(...all.map((r) => r.playMs)))}`);
  console.log(`   TIME TO FIRST CONTACT   mean ${secs(mean(withContact, (r) => r.contactElapsedMs))} ELAPSED (incl. 5.7s countdown)`);
  console.log(`                           mean ${secs(mean(withContact, (r) => r.contactPlayMs))} MATCH CLOCK  = ${pct(mean(withContact, (r) => r.contactPlayMs) / avg((r) => r.playMs))} of the mean match`);
  console.log(`                           median ${secs([...withContact.map((r) => r.contactPlayMs)].sort((a, b) => a - b)[Math.floor(withContact.length / 2)])} match clock   ·  never made contact: ${noContact}`);
  console.log(`   first damage            mean ${secs(mean(all.filter((r) => r.firstHitMs !== null), (r) => r.firstHitMs))} elapsed`);
  console.log(`   DEAD TIME               ${pct(avg((r) => r.deadFrac))} of the match out of reach of each other`);
  console.log(`   AI STALLED              ${pct(avg((r) => r.stallFrac))}  ·  longest ${secs(Math.max(...all.map((r) => r.longestStallMs)))}  ·  ${all.filter((r) => r.longestStallMs > 3000).length}/${n} stalled >3s`);
  console.log(`   enemy travel            mean ${Math.round(avg((r) => r.enemyTravel))}wu`);
  const slowest = [...withContact].sort((a, b) => b.contactPlayMs - a.contactPlayMs).slice(0, 8);
  console.log(`\n   slowest 8 to contact (match clock):`);
  for (const r of slowest) console.log(`     ${secs(r.contactPlayMs).padStart(7)}  ${r.player} vs ${r.enemy}  -> ${r.outcome}`);
  if (args.out) {
    mkdirSync(dirname(String(args.out)), { recursive: true });
    writeFileSync(String(args.out), JSON.stringify({ tag: TAG, all }, null, 2));
    console.log(`\n   wrote ${args.out}`);
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// --flee : does global routing ever turn "run away" into "run at them"?
//
// The flee target is a SYNTHETIC point 400 wu directly behind the AI. A router that
// obeys it literally could legitimately choose a path that curls back past the player —
// the exact failure mode a local rule cannot produce, so it is new risk this layer
// introduces and has to be measured rather than assumed away.
// ─────────────────────────────────────────────────────────────────────────────
if (args.flee) {
  const FLEE_HP = RULES.AI_FLEE_HP_FRACTION;
  let fleeTicks = 0, closingTicks = 0, closedWu = 0, openedWu = 0;
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    const st = createMatch(arena, p, e);
    const decide = (POLICIES[POLICY] ?? smartPolicy)();
    let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    let since = Infinity;
    while (st.phase !== 'ended' && st.elapsed < MATCH_DURATION_MS + 10_000) {
      if (since >= 150) { input = decide(st); since = 0; }
      const wasFleeing = st.enemy.hp < st.enemy.maxHp * FLEE_HP && st.phase === 'playing';
      const d0 = dist(st.player.x, st.player.y, st.enemy.x, st.enemy.y);
      const ex0 = st.enemy.x, ey0 = st.enemy.y;
      stepMatch(st, DT, input); since += DT;
      if (!wasFleeing) continue;
      fleeTicks++;
      // Judge the ENEMY's own movement against the player's position at the start of the
      // tick, so the player walking toward a stationary AI is not scored as the AI closing.
      const before = Math.hypot(ex0 - st.player.x, ey0 - st.player.y);
      const after = Math.hypot(st.enemy.x - st.player.x, st.enemy.y - st.player.y);
      void d0;
      if (after < before - 1e-9) { closingTicks++; closedWu += before - after; } else openedWu += after - before;
    }
  }
  console.log(`\n== FLEE SANITY [${TAG}] — policy=${POLICY}, ${fleeTicks} ticks spent below ${pct(FLEE_HP)} HP`);
  console.log(`   ticks where the AI's own step moved it TOWARD the player   ${closingTicks} (${pct(closingTicks / Math.max(1, fleeTicks))})`);
  console.log(`   ground given up  ${closedWu.toFixed(0)}wu   ·   ground gained  ${openedWu.toFixed(0)}wu   ·   net ${(openedWu - closedWu).toFixed(0)}wu away\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
if (args.cost) {
  if (!NAV || !NAV.navStats) {
    console.log(`\n== COST [${TAG}] — no navigation layer in this tree (movement.ts exports no navStats). Nothing to price.\n`);
  } else {
    NAV.navStats.reset();
    let ticks = 0;
    for (const e of CHARACTER_IDS) {
      const st = createMatch(arena, 'hamburger', e);
      const decide = (POLICIES[POLICY] ?? smartPolicy)();
      let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
      let since = Infinity;
      while (st.phase !== 'ended' && st.elapsed < MATCH_DURATION_MS + 10_000) {
        if (since >= 150) { input = decide(st); since = 0; }
        stepMatch(st, DT, input); since += DT; ticks++;
      }
    }
    const s = NAV.navStats;
    console.log(`\n== COST [${TAG}] — ${CHARACTER_IDS.length} full matches, policy=${POLICY}, ${ticks} ticks total`);
    console.log(`   grid                     ${s.cols}x${s.rows} = ${s.cols * s.rows} cells @ ${s.cellSize}wu  (${s.passable} passable, ${pct(s.passable / (s.cols * s.rows))})`);
    console.log(`   grid builds              ${s.gridBuilds}  (once per arena object)`);
    console.log(`   FIELD REBUILDS           ${s.fieldBuilds}  = ${(s.fieldBuilds / ticks * 1000).toFixed(1)} per 1000 ticks  (${(s.fieldBuilds / (ticks * DT / 1000)).toFixed(2)}/s of sim time)`);
    console.log(`   cells visited in BFS     ${s.cellsVisited}  = ${(s.cellsVisited / ticks).toFixed(1)} per tick amortised`);
    console.log(`   steering queries         ${s.queries}  (${pct(s.queries / ticks)} of ticks — the AI only steers when it is not attacking)`);
    console.log(`   string-pull LOS checks   ${s.losChecks}  = ${(s.losChecks / Math.max(1, s.queries)).toFixed(2)} per steering query, ${(s.losChecks / ticks).toFixed(2)} per tick`);
    console.log(`   heap buffers             ${(s.cols * s.rows * 9 / 1024).toFixed(1)} KB of typed arrays, allocated once; a rebuild allocates nothing\n`);
  }
}

if (!args.reach && !args.alcove && !args.matchups && !args.cost) {
  console.log('nothing to do: pass --reach, --alcove, --matchups and/or --cost');
}
