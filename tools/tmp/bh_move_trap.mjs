#!/usr/bin/env node
/**
 * BH_MOVE_TRAP — "dropped inside a prop and can never walk out": a census, a reachability
 * check for the one gameplay path that can put a fighter there, and an end-to-end repro.
 *
 * Review-phase probe (2026-10-15, bug hunt, movement/collision dimension). READ-ONLY on the
 * tree: it imports the sim from `--src-root` (default: the clean detached worktree of HEAD at
 * /private/tmp/fa-rv-head) and writes only under shots/rv/bugs/move/.
 *
 * THE CLAIM UNDER TEST
 *   `movement.ts:escapeCover` is the recovery that makes "a fighter inside cover" safe. It
 *   pushes along the axis of least penetration of the DEEPEST box, up to ESCAPE_PASSES = 4
 *   times. `placeFighterAt` (the Disposal item's positional write) relies on it:
 *   "DEPENETRATED ... Without this a victim dropped inside a prop is frozen permanently".
 *   Two geometries defeat a minimum-translation escape:
 *     (a) a SLIT narrower than a body between two boxes — out of A lands in B, out of B lands
 *         back in A, forever (a 2-cycle);
 *     (b) a box FLUSH against the arena wall — the push toward the wall is clamped to the
 *         wall and never leaves the box.
 *   The kitchen layout deliberately contains both: its own rule 4 allows face gaps <= 16 wu
 *   ("a slit"), and it puts supply barrels flush to the walls.
 *
 * WHAT IT MEASURES
 *   --census     every lattice point inside inflated cover: drop a fighter there through the
 *                REAL `placeFighterAt`, then try to walk out through the REAL `tryMove` for
 *                64 attempts in 8 directions. Still inside -> TRAPPED (permanent: every later
 *                attempt runs the same deterministic escape).
 *   --reach      for each trapped cluster, search for a legal (thrower, victim, destination)
 *                triple that makes `combat.ts`'s Disposal branch drop the victim there
 *                (dest + dropDistance * unit(victim - dest)).
 *   --e2e        build that triple as a real N=3 match through `createMatch`/`stepMatch`,
 *                press the item, then drive the victim (human seat, cycling all 8 directions;
 *                and separately as an AI seat) for 10 s and report whether it ever moves.
 *   --selftest   known-bad + control: a synthetic arena with a 10 wu slit and a wall-flush box
 *                MUST report traps; an isolated box MUST report zero. The e2e control (drop
 *                point on open floor) MUST show the victim moving.
 *
 * Use:  node tools/tmp/bh_move_trap.mjs --selftest
 *       node tools/tmp/bh_move_trap.mjs --census --reach --e2e [--step 2] [--arena <json>]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const STEP = Number(args.step ?? 2);

const MV = await import(`${SRC_ROOT}/src/game/movement.ts`);
const SIM = await import(`${SRC_ROOT}/src/game/sim.ts`);
const R = await import(`${SRC_ROOT}/src/game/rules.ts`);
const { placeFighterAt, tryMove } = MV;
const SIZE = R.PLAYER_SIZE;
const HALF = SIZE / 2;
const DROP = R.ITEM_TUNING.disposal.dropDistance;
const THROW_RANGE = R.GUARANTEED_VISIBLE_RADIUS;

function loadArena(path) {
  const d = JSON.parse(readFileSync(path, 'utf8'));
  return { ...d, build: () => null, update: () => {} };
}
const insideCover = (arena, x, y) => {
  for (const o of arena.cover) {
    if (Math.abs(x - o.x) < (SIZE + o.w) / 2 && Math.abs(y - o.y) < (SIZE + o.h) / 2) return o;
  }
  return null;
};
const legal = (arena, x, y) =>
  x >= HALF && x <= arena.width - HALF && y >= HALF && y <= arena.height - HALF && !insideCover(arena, x, y);

const mkFighter = (x, y) => ({ x, y, size: SIZE, push: { x: 0, y: 0, remaining: 0, speed: 0 } });
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

/** Drop at (x,y) through the real placeFighterAt, then try to walk out 64 times. */
function dropAndWalk(arena, x, y, attempts = 64, step = 4.5) {
  const f = mkFighter(x, y);
  placeFighterAt(f, x, y, arena);
  const afterPlace = { x: f.x, y: f.y, inside: !!insideCover(arena, f.x, f.y) };
  for (let k = 0; k < attempts; k++) {
    const [dx, dy] = DIRS[k % 8];
    tryMove(f, dx * step, dy * step, arena);
  }
  return { afterPlace, end: { x: f.x, y: f.y }, trapped: !!insideCover(arena, f.x, f.y) };
}

function census(arena, step = STEP) {
  const traps = [];
  let insideCount = 0;
  for (let y = HALF; y <= arena.height - HALF; y += step) {
    for (let x = HALF; x <= arena.width - HALF; x += step) {
      if (!insideCover(arena, x, y)) continue;
      insideCount++;
      const r = dropAndWalk(arena, x, y);
      if (r.trapped) traps.push({ x, y, end: r.end });
    }
  }
  // Cluster on the lattice (8-connected).
  const key = (x, y) => `${x},${y}`;
  const set = new Map(traps.map((t) => [key(t.x, t.y), t]));
  const seen = new Set();
  const clusters = [];
  for (const t of traps) {
    const k0 = key(t.x, t.y);
    if (seen.has(k0)) continue;
    const q = [t]; seen.add(k0);
    const pts = [];
    while (q.length) {
      const p = q.pop(); pts.push(p);
      for (const [dx, dy] of DIRS) {
        const k = key(p.x + dx * step, p.y + dy * step);
        if (set.has(k) && !seen.has(k)) { seen.add(k); q.push(set.get(k)); }
      }
    }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const cx = xs.reduce((a, b) => a + b, 0) / pts.length, cy = ys.reduce((a, b) => a + b, 0) / pts.length;
    // Representative: the point nearest the centroid.
    let rep = pts[0], bd = Infinity;
    for (const p of pts) { const d = Math.hypot(p.x - cx, p.y - cy); if (d < bd) { bd = d; rep = p; } }
    // Which boxes own it (the inflated boxes containing the representative).
    const owners = arena.cover.filter((o) => Math.abs(rep.x - o.x) < (SIZE + o.w) / 2 && Math.abs(rep.y - o.y) < (SIZE + o.h) / 2)
      .map((o) => `${o.kind}@${o.x},${o.y} ${o.w}x${o.h}`);
    // Neighbouring boxes within a body of the representative (the slit partner / wall).
    const near = arena.cover.filter((o) => {
      const dx = Math.max(0, Math.abs(rep.x - o.x) - o.w / 2), dy = Math.max(0, Math.abs(rep.y - o.y) - o.h / 2);
      return Math.hypot(dx, dy) < SIZE;
    }).map((o) => `${o.kind}@${o.x},${o.y} ${o.w}x${o.h}`);
    clusters.push({
      n: pts.length, areaWu2: pts.length * step * step,
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      rep: { x: rep.x, y: rep.y, end: rep.end }, owners, near,
    });
  }
  clusters.sort((a, b) => b.n - a.n);
  return { insideCount, trapCount: traps.length, clusters };
}

/**
 * Search for a legal (thrower T, victim V, destination D) triple that lands V at trap point P.
 * combat.ts: victim = nearestLivingOpponent(user) within THROW_RANGE; dest = nearest to the
 * victim excluding the user; landing = clamp(D + DROP * unit(V - D)).
 */
function findWitness(arena, P) {
  for (let deg = 0; deg < 360; deg += 3) {
    const ux = Math.cos((deg * Math.PI) / 180), uy = Math.sin((deg * Math.PI) / 180);
    const D = { x: P.x - DROP * ux, y: P.y - DROP * uy };
    if (!legal(arena, D.x, D.y)) continue;
    // The clamp in placeFighterAt can move the landing point; require the unclamped point to be in-bounds.
    if (P.x < HALF || P.x > arena.width - HALF || P.y < HALF || P.y > arena.height - HALF) continue;
    for (let r = 12; r <= 260; r += 2) {
      const V = { x: D.x + r * ux, y: D.y + r * uy };
      if (!legal(arena, V.x, V.y)) continue;
      // Thrower: legal, nearer to V than to D, inside throw range of V. Try a ring around V.
      for (let td = 4; td <= 60; td += 4) {
        for (let tdeg = 0; tdeg < 360; tdeg += 30) {
          const T = { x: V.x + td * Math.cos((tdeg * Math.PI) / 180), y: V.y + td * Math.sin((tdeg * Math.PI) / 180) };
          if (!legal(arena, T.x, T.y)) continue;
          const dTV = Math.hypot(T.x - V.x, T.y - V.y), dTD = Math.hypot(T.x - D.x, T.y - D.y);
          if (!(dTV < dTD) || dTV > THROW_RANGE) continue;
          return { T, V, D, bearingDeg: deg, r };
        }
      }
    }
  }
  return null;
}

/** A real N=3 match: press Disposal, then drive the victim for `ms`. */
function e2e(arena, w, { victimController = 'human', ms = 10_000, dt = 1000 / 60 } = {}) {
  const configs = [
    { characterId: 'sushi', controller: 'human', items: ['disposal'], spawn: { ...w.T } },
    { characterId: 'hotdog', controller: victimController, spawn: { ...w.V } },
    // The destination stands still and harmless: a human seat given neutral input.
    { characterId: 'egg', controller: 'human', spawn: { ...w.D } },
  ];
  const state = SIM.createMatch(arena, configs);
  const neutral = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let guard = 0;
  while (state.phase !== 'playing' && guard++ < 100_000) SIM.stepMatch(state, dt, [neutral, neutral, neutral]);
  const V = state.fighters[1];
  const before = { x: V.x, y: V.y };
  const ev = SIM.stepMatch(state, dt, [{ ...neutral, useItem: 0 }, neutral, neutral]);
  const hit = ev.find((e) => e.type === 'item-hit' && e.itemId === 'disposal');
  const landed = { x: V.x, y: V.y, inside: !!insideCover(arena, V.x, V.y) };
  const ticks = Math.round(ms / dt);
  const seen = new Set();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let everFree = false;
  for (let i = 0; i < ticks && state.phase === 'playing'; i++) {
    const [dx, dy] = DIRS[Math.floor(i / 30) % 8]; // half a second per direction
    const vin = { move: { x: dx, y: dy }, selectedWeapon: 0, attack: false };
    SIM.stepMatch(state, dt, [neutral, vin, neutral]);
    seen.add(`${V.x.toFixed(3)},${V.y.toFixed(3)}`);
    minX = Math.min(minX, V.x); maxX = Math.max(maxX, V.x); minY = Math.min(minY, V.y); maxY = Math.max(maxY, V.y);
    if (!insideCover(arena, V.x, V.y)) everFree = true;
  }
  return {
    victimController, before, hit: hit ? { x: hit.x, y: hit.y } : null, landed,
    after10s: { x: V.x, y: V.y, inside: !!insideCover(arena, V.x, V.y), alive: V.alive, hp: V.hp },
    distinctPositions: seen.size, span: { x: +(maxX - minX).toFixed(3), y: +(maxY - minY).toFixed(3) }, everFree,
    phase: state.phase,
  };
}

// ── selftest ─────────────────────────────────────────────────────────────────
function synthetic(cover) {
  return {
    id: 'synthetic', width: 1000, height: 1000, center: { x: 500, y: 500 }, maxSafeRadius: 100_000,
    playerSpawn: { x: 100, y: 900 }, enemySpawn: { x: 900, y: 100 },
    spawns: [{ x: 100, y: 900 }, { x: 900, y: 100 }, { x: 900, y: 900 }],
    cover, hazards: [], build: () => null, update: () => {},
  };
}
function selftest() {
  let fails = 0;
  const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
  // KNOWN-BAD 1: a 10 wu slit between two 100x200 boxes (faces at x=450 and x=460).
  const slit = synthetic([{ x: 400, y: 500, w: 100, h: 200, kind: 'A' }, { x: 510, y: 500, w: 100, h: 200, kind: 'B' }]);
  const cs = census(slit, 2);
  check('known-bad SLIT reports traps', cs.trapCount > 0, `${cs.trapCount} trapped of ${cs.insideCount} inside points`);
  const mid = dropAndWalk(slit, 455, 500);
  check('known-bad SLIT: a drop in the slit centre is trapped', mid.trapped, `end ${mid.end.x.toFixed(2)},${mid.end.y.toFixed(2)}`);
  // KNOWN-BAD 2: a 60x50 barrel flush to the west wall.
  const wall = synthetic([{ x: 30, y: 500, w: 60, h: 50, kind: 'barrel' }]);
  const cw = census(wall, 2);
  check('known-bad WALL-FLUSH reports traps', cw.trapCount > 0, `${cw.trapCount} trapped of ${cw.insideCount}`);
  // CONTROL: one isolated box, nowhere near a wall or a neighbour -> every drop escapes.
  const iso = synthetic([{ x: 500, y: 500, w: 100, h: 200, kind: 'iso' }]);
  const ci = census(iso, 2);
  check('control ISOLATED box reports zero traps', ci.insideCount > 0 && ci.trapCount === 0, `${ci.trapCount} trapped of ${ci.insideCount} (non-empty: ${ci.insideCount > 0})`);
  // E2E known-bad and control on the synthetic slit.
  const wBad = { D: { x: 455, y: 650 }, V: { x: 455, y: 630 }, T: { x: 455, y: 610 } }; // landing y = 650-84 = 566 -> inside slit
  const eb = e2e(slit, wBad);
  check('e2e known-bad: victim lands inside and never gets free', eb.hit && eb.landed.inside && !eb.everFree, JSON.stringify({ landed: eb.landed, distinct: eb.distinctPositions, everFree: eb.everFree }));
  const wOk = { D: { x: 800, y: 800 }, V: { x: 800, y: 780 }, T: { x: 800, y: 760 } }; // open floor
  const eo = e2e(slit, wOk);
  check('e2e control: victim dropped on open floor moves', eo.hit && !eo.landed.inside && eo.everFree && eo.distinctPositions > 100, JSON.stringify({ landed: eo.landed, distinct: eo.distinctPositions }));
  console.log(fails === 0 ? '\nSELFTEST: all arms behave — the census can see both trap classes and does not false-positive' : `\nSELFTEST: ${fails} FAIL`);
  return fails;
}

// ── main ─────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
console.log(`src-root ${SRC_ROOT}\narena    ${ARENA_PATH}`);
if (args.selftest) process.exitCode = selftest() ? 1 : 0;

if (args.census || args.reach || args.e2e) {
  const arena = loadArena(ARENA_PATH);
  const t0 = Date.now();
  const cs = census(arena, STEP);
  console.log(`\n== CENSUS (lattice ${STEP} wu): ${cs.insideCount} points inside inflated cover, ${cs.trapCount} TRAPPED, ${cs.clusters.length} clusters  (${Date.now() - t0} ms)`);
  for (const c of cs.clusters.slice(0, 40)) {
    console.log(`  n=${String(c.n).padStart(4)}  ~${c.areaWu2} wu²  bbox ${c.bbox.join(',')}  rep ${c.rep.x},${c.rep.y}  owners [${c.owners.join(' | ')}]`);
  }
  const report = { srcRoot: SRC_ROOT, arena: ARENA_PATH, step: STEP, ...cs, witnesses: [], e2e: [] };
  if (args.reach || args.e2e) {
    let reachable = 0;
    for (const c of cs.clusters) {
      const w = findWitness(arena, c.rep);
      c.witness = w;
      if (w) reachable++;
    }
    console.log(`\n== DISPOSAL REACH: ${reachable} of ${cs.clusters.length} trap clusters have a legal thrower/victim/destination triple that lands the victim on the cluster's representative point`);
    for (const c of cs.clusters.slice(0, 40)) {
      const w = c.witness;
      console.log(`  rep ${c.rep.x},${c.rep.y}: ${w ? `D ${w.D.x.toFixed(1)},${w.D.y.toFixed(1)}  V ${w.V.x.toFixed(1)},${w.V.y.toFixed(1)}  T ${w.T.x.toFixed(1)},${w.T.y.toFixed(1)}` : 'no witness'}`);
    }
  }
  if (args.e2e) {
    const withW = cs.clusters.filter((c) => c.witness);
    if (withW.length === 0) console.log('\n== E2E: no witness to run (non-empty check failed)');
    const runs = withW.slice(0, Number(args['e2e-n'] ?? 6));
    console.log(`\n== E2E through createMatch/stepMatch, N=3, ${runs.length} clusters`);
    for (const c of runs) {
      for (const vc of ['human', 'ai']) {
        const r = e2e(arena, c.witness, { victimController: vc });
        report.e2e.push({ cluster: c.rep, witness: c.witness, ...r });
        console.log(`  rep ${c.rep.x},${c.rep.y}  victim=${vc.padEnd(5)}  hit=${!!r.hit}  landed ${r.landed.x.toFixed(2)},${r.landed.y.toFixed(2)} inside=${r.landed.inside}  10s later ${r.after10s.x.toFixed(2)},${r.after10s.y.toFixed(2)} inside=${r.after10s.inside}  distinct=${r.distinctPositions}  span=${r.span.x},${r.span.y}  everFree=${r.everFree}`);
      }
    }
  }
  const outPath = `${OUT_DIR}/trap_census.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${outPath}`);
}
