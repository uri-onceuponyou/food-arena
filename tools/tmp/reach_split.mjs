#!/usr/bin/env node
/**
 * REACHABILITY, SPLIT — "cannot route there" and "will not stand there" are two findings.
 *
 * ── The problem this exists to fix ──────────────────────────────────────────
 *
 * `arena_probe.mjs --reach` pins an immortal player on each cell of a grid and asks
 * whether the AI ever gets within weapon reach of it during one match. It reported
 * **352/352 = 100%** against a pre-`07a4e3a` sim and **306/352 = 86.9%** against
 * committed HEAD, and every miss is a corner or an outer strip.
 *
 * Read as it stands, that is a 13-point pathfinding regression. It is not one.
 * `07a4e3a` gave the AI a RING TERM, because measured, 100% of all fog damage and 94.8%
 * of all pot damage landed on the enemy — it had no ring awareness at all and walked
 * into the closing fog. The term pushes it back inside once it is within
 * `AI_RING_MARGIN` (140 wu) of the safe radius, so cells the fog has effectively already
 * claimed are cells the AI now DECLINES. The metric did not detect a new failure; the
 * behaviour it measures changed meaning underneath it, and it has no way to say so.
 *
 * `docs/LESSONS.md` §13: prefer a metric that asks about the OUTCOME. "Does the AI ever
 * arrive?" is an outcome metric — but "arrive somewhere the fog has already taken" is
 * not an outcome anybody wants, so the DENOMINATOR has to be stated. This probe states
 * it, and separates the misses into two populations that need opposite responses:
 *
 *   UNROUTED  the cell was legal ground, inside the AI's permitted zone for longer than
 *             it would take to walk there, and the AI still never arrived. A defect.
 *   EXPIRED   the ring reached the cell before the AI could have. Declining it is the
 *             behaviour `07a4e3a` was written to produce.
 *
 * The control is the decisive half: re-run against a staged sim with `AI_RING_MARGIN=0`
 * and, if the misses vanish, the routing was never in question.
 *
 *   node tools/tmp/reach_split.mjs
 *   node tools/tmp/stage_rules.mjs /tmp/noring AI_RING_MARGIN=0
 *   node tools/tmp/reach_split.mjs --sim /tmp/noring/game --tag no-ring
 *   node tools/tmp/reach_split.mjs --enemy lollipop
 */
import { readFileSync, existsSync } from 'node:fs';
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
const R = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, MATCH_DURATION_MS, REACH, HIT_RADIUS_VS_PLAYER, PLAYER_SIZE,
  AI_RING_MARGIN, AI_CHASE_SPEED,
} = R;

const ARENA_PATH = String(args.layout ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
// `maxSafeRadius` is DERIVED from the clock in `arena/shared.ts`; a cached dump goes
// stale the moment the clock moves, so recompute it from the same formula.
const HALF_DIAG = Math.hypot(DATA.width / 2, DATA.height / 2);
const FOG_FIRST_CONTACT_MS = 6000;
const arena = {
  ...DATA,
  maxSafeRadius: Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
  build: () => null, update: () => {},
};

const DT = Number(args.dt ?? 16.667);
const TAG = String(args.tag ?? (SIM_DIR === `${ROOT}/src/game` ? 'shipped' : SIM_DIR));
const ENEMY = String(args.enemy ?? 'donut');
const GW = Number(args.gw ?? 28), GH = Number(args.gh ?? 20);
const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const maxNormalRange = (id) =>
  Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);
const blocked = (x, y) => arena.cover.some((o) =>
  Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2);

const REACH_WU = maxNormalRange(ENEMY) + HIT_RADIUS_VS_PLAYER;
const cx = arena.center.x, cy = arena.center.y;

/**
 * One cell. Runs the real `stepMatch` with the player pinned and immortal, and records
 * two closest approaches — one unconditional, one restricted to the ticks when the cell
 * was inside the zone the AI is willing to stand in.
 */
function probeCell(x, y) {
  const st = createMatch(arena, 'hamburger', ENEMY);
  st.player.x = x; st.player.y = y; st.player.hp = 1e9; st.player.maxHp = 1e9;
  st.enemy.hp = 1e9; st.enemy.maxHp = 1e9;
  const dc = dist(x, y, cx, cy);
  // How far the enemy must walk from its spawn, at best. A lower bound, so a cell ruled
  // EXPIRED by it is expired even for a perfect router.
  const travelMs = dist(arena.enemySpawn.x, arena.enemySpawn.y, x, y) / AI_CHASE_SPEED;
  let best = Infinity, bestPermitted = Infinity, tReach = null, permittedTicks = 0;
  while (st.elapsed < MATCH_DURATION_MS + 6000 && st.phase !== 'ended') {
    st.player.x = x; st.player.y = y;
    stepMatch(st, DT, IDLE);
    const d = dist(st.enemy.x, st.enemy.y, x, y);
    if (d < best) best = d;
    if (d <= REACH_WU && tReach === null) tReach = st.elapsed;
    // PERMITTED = the AI's own rule, read off the same two numbers `ai.ts:dangerSteer`
    // reads: the cell is far enough inside the safe radius that the ring term is inert.
    if (st.phase === 'playing' && dc <= st.safeRadius - AI_RING_MARGIN) {
      permittedTicks++;
      if (d < bestPermitted) bestPermitted = d;
    }
  }
  const permittedMs = permittedTicks * DT;
  return { x, y, dc, best, bestPermitted, tReach, permittedMs, travelMs };
}

const cells = [];
for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    const x = ((gx + 0.5) / GW) * arena.width, y = ((gy + 0.5) / GH) * arena.height;
    if (blocked(x, y)) continue;
    cells.push(probeCell(x, y));
  }
}

const reached = cells.filter((c) => c.tReach !== null);
const missed = cells.filter((c) => c.tReach === null);
// A miss is EXPIRED when the cell was not inside the permitted zone for as long as it
// would take to walk there — the ring got there first, and declining it is the point.
const expired = missed.filter((c) => c.permittedMs < c.travelMs);
const unrouted = missed.filter((c) => c.permittedMs >= c.travelMs);
// The honest denominator: cells the AI is allowed to occupy for long enough to arrive.
const eligible = cells.filter((c) => c.permittedMs >= c.travelMs);
const eligibleReached = eligible.filter((c) => c.tReach !== null);

const pct = (a, b) => `${b ? ((a / b) * 100).toFixed(1) : '—'}%`;
console.log(`\n╔══ REACHABILITY SPLIT [${TAG}] enemy=${ENEMY} · grid ${GW}x${GH} · reach ${REACH_WU.toFixed(0)}wu`);
console.log(`║ ${ARENA_PATH.replace(`${ROOT}/`, '')} ${arena.width}x${arena.height} · maxSafeRadius ${arena.maxSafeRadius} · clock ${MATCH_DURATION_MS / 1000}s · AI_RING_MARGIN ${AI_RING_MARGIN}`);
console.log(`╚═════════════════════════════════════════════════════════════════════════════`);
console.log(`\n  AS MEASURED TODAY   ${reached.length}/${cells.length} standable cells reached   ${pct(reached.length, cells.length)}`);
console.log(`  ON THE HONEST DENOMINATOR (cells legal for longer than the walk takes)`);
console.log(`                      ${eligibleReached.length}/${eligible.length}   ${pct(eligibleReached.length, eligible.length)}`);
console.log(`\n  of ${missed.length} misses: ${expired.length} EXPIRED (the ring claimed the cell first) · ${unrouted.length} UNROUTED (a defect)`);

if (unrouted.length) {
  // ⚠️ AN OVER-ESTIMATE, deliberately. `travelMs` is a straight line at full chase speed:
  // it ignores cover detours and it ignores that the chase branch fires OR moves, so a
  // cell listed here may simply have been tight rather than unroutable. Erring this way
  // is the right error — it can only ever over-report a defect, never hide one.
  console.log(`\n  ── UNROUTED — legal, permitted longer than a straight-line walk, never arrived ──`);
  for (const c of unrouted.sort((a, b) => b.best - a.best)) {
    console.log(`     (${String(Math.round(c.x)).padStart(4)},${String(Math.round(c.y)).padStart(4)})  closest ${Math.round(c.best).toString().padStart(4)}wu` +
      ` (${Math.round(c.bestPermitted)}wu while permitted)  permitted ${(c.permittedMs / 1000).toFixed(1)}s vs walk ${(c.travelMs / 1000).toFixed(1)}s`);
  }
}
if (expired.length) {
  console.log(`\n  ── EXPIRED — the ring reached the cell before the AI could have ──`);
  for (const c of expired.sort((a, b) => a.permittedMs - b.permittedMs)) {
    console.log(`     (${String(Math.round(c.x)).padStart(4)},${String(Math.round(c.y)).padStart(4)})  ${Math.round(c.dc).toString().padStart(4)}wu from centre` +
      `  permitted ${(c.permittedMs / 1000).toFixed(1)}s  walk ${(c.travelMs / 1000).toFixed(1)}s  closest ${Math.round(c.best)}wu`);
  }
}
console.log('');
