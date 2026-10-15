#!/usr/bin/env node
/**
 * BH_MOVE_GEOM — static geometry audit of the shipped arena for the movement dimension.
 * Review-phase probe (2026-10-15). READ-ONLY: imports from `--src-root` (default: the clean
 * detached worktree of HEAD at /private/tmp/fa-rv-head). Writes only under shots/rv/bugs/move/.
 *
 *   SPAWNS     all six: legal for a 42 wu body, legal halo radius (2 wu lattice), pairwise
 *              separation, inside the opening ring, not concealed, clear of every hazard.
 *   CONNECT    2 wu lattice of legal fighter-CENTRE positions, 4-connected flood from slot 0's
 *              spawn: sealed pockets (components nothing can enter) and their area.
 *   NAVGRID    `movement.ts:navGrid`'s own arithmetic (cell doubles until <= 40,000 cells):
 *              cell size, passable count, 8-connected components with the corner rule, and
 *              every legal lattice point whose nearest passable cell (the 8-ring goal search
 *              navSteer does) is missing or sits outside the main component — i.e. a place a
 *              player can stand that the bots' flow field cannot route to.
 *   CONCEAL    per patch: share of its area where a fighter centre may stand; clearance to
 *              the endgame keep-out.
 *   PUDDLES    standable share of each slow disc.
 *   POT        standable share of the burn disc; burn-band depth on the axes/diagonals.
 *   RING       the final circle at N=2..6 contains no solid cover (rule 6).
 *
 * Known-bad arms (`--selftest`): a fixture arena with a sealed box-in pocket, a spawn inside
 * a box and a patch fully inside a box must each be flagged.
 *
 * Use: node tools/tmp/bh_move_geom.mjs [--selftest] [--arena <json>]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
mkdirSync(OUT_DIR, { recursive: true });
const R = await import(`${SRC_ROOT}/src/game/rules.ts`);
const MV = await import(`${SRC_ROOT}/src/game/movement.ts`);
const { PLAYER_SIZE, POT, minSafeRadiusFor, concealmentKeepoutRadius } = R;
const SIZE = PLAYER_SIZE, HALF = SIZE / 2;

function audit(A, { lattice = 2, quiet = false } = {}) {
  const log = (...s) => { if (!quiet) console.log(...s); };
  const inCover = (x, y) => A.cover.some((o) => Math.abs(x - o.x) < (SIZE + o.w) / 2 && Math.abs(y - o.y) < (SIZE + o.h) / 2);
  const legal = (x, y) => x >= HALF && x <= A.width - HALF && y >= HALF && y <= A.height - HALF && !inCover(x, y);
  const out = { faults: [] };

  // ── SPAWNS ────────────────────────────────────────────────────────────────
  const spawns = A.spawns ?? [A.playerSpawn, A.enemySpawn];
  out.spawns = spawns.map((s, k) => {
    let halo = 0;
    for (let r = lattice; r <= 60; r += lattice) {
      let ok = true;
      for (let dx = -r; dx <= r && ok; dx += lattice) for (let dy = -r; dy <= r && ok; dy += lattice) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!legal(s.x + dx, s.y + dy)) ok = false;
      }
      if (!ok) break; halo = r;
    }
    const minSep = Math.min(...spawns.map((o, j) => (j === k ? Infinity : Math.hypot(o.x - s.x, o.y - s.y))));
    const r = Math.hypot(s.x - A.center.x, s.y - A.center.y);
    const hz = A.hazards.filter((h) => Math.hypot(s.x - h.x, s.y - h.y) < h.radius + HALF).map((h) => h.kind);
    const conc = MV.isConcealed(s.x, s.y, A);
    const row = { slot: k, x: s.x, y: s.y, legal: legal(s.x, s.y), haloChebyshev: halo, minSep: +minSep.toFixed(1), r: +r.toFixed(1), insideOpening: r < A.maxSafeRadius, hazards: hz, concealed: conc };
    if (!row.legal) out.faults.push(`spawn ${k} inside cover`);
    if (hz.length) out.faults.push(`spawn ${k} touches hazard ${hz}`);
    if (conc) out.faults.push(`spawn ${k} concealed at t=0`);
    if (!row.insideOpening) out.faults.push(`spawn ${k} outside opening ring`);
    if (minSep < R.REACH.rangedMax + 26) out.faults.push(`spawn ${k} within reach of another seat (${minSep.toFixed(1)})`);
    return row;
  });
  log('SPAWNS');
  for (const s of out.spawns) log(`  ${JSON.stringify(s)}`);

  // ── CONNECTIVITY ──────────────────────────────────────────────────────────
  const L = lattice;
  const cols = Math.floor((A.width - SIZE) / L) + 1, rows = Math.floor((A.height - SIZE) / L) + 1;
  const X = (i) => HALF + i * L, Y = (j) => HALF + j * L;
  const ok = new Uint8Array(cols * rows);
  let nLegal = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (legal(X(i), Y(j))) { ok[j * cols + i] = 1; nLegal++; }
  const comp = new Int32Array(cols * rows).fill(-1);
  const sizes = [];
  const q = new Int32Array(cols * rows);
  for (let s0 = 0; s0 < ok.length; s0++) {
    if (!ok[s0] || comp[s0] >= 0) continue;
    const c = sizes.length; let h = 0, t = 0; q[t++] = s0; comp[s0] = c;
    while (h < t) {
      const p = q[h++]; const i = p % cols, j = (p - i) / cols;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const np = nj * cols + ni;
        if (ok[np] && comp[np] < 0) { comp[np] = c; q[t++] = np; }
      }
    }
    sizes.push(t);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const pockets = sizes.map((n, c) => ({ c, n })).filter((p) => p.c !== main).sort((a, b) => b.n - a.n);
  out.connect = { lattice: L, legalPoints: nLegal, components: sizes.length, mainShare: +(sizes[main] / nLegal).toFixed(5), pockets: pockets.slice(0, 20).map((p) => {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (let s = 0; s < comp.length; s++) if (comp[s] === p.c) { const i = s % cols, j = (s - i) / cols; mnx = Math.min(mnx, X(i)); mxx = Math.max(mxx, X(i)); mny = Math.min(mny, Y(j)); mxy = Math.max(mxy, Y(j)); }
    return { points: p.n, areaWu2: p.n * L * L, bbox: [mnx, mny, mxx, mxy] };
  }) };
  for (const k in out.spawns) {
    const s = out.spawns[k]; const i = Math.round((s.x - HALF) / L), j = Math.round((s.y - HALF) / L);
    if (comp[j * cols + i] !== main) out.faults.push(`spawn ${k} not in the main component`);
  }
  if (pockets.length) out.faults.push(`${pockets.length} sealed pocket(s), largest ${pockets[0].n * L * L} wu²`);
  log(`CONNECT  ${nLegal} legal lattice points, ${sizes.length} component(s), main ${(100 * sizes[main] / nLegal).toFixed(3)}%`);
  for (const p of out.connect.pockets) log(`  pocket ${JSON.stringify(p)}`);

  // ── NAV GRID (movement.ts arithmetic, re-implemented and stated) ─────────
  let cell = 10; while (Math.ceil(A.width / cell) * Math.ceil(A.height / cell) > 40_000) cell *= 2;
  const nc = Math.ceil(A.width / cell), nr = Math.ceil(A.height / cell);
  const pass = new Uint8Array(nc * nr);
  for (let gy = 0; gy < nr; gy++) for (let gx = 0; gx < nc; gx++) {
    const cx = (gx + 0.5) * cell, cy = (gy + 0.5) * cell;
    if (cx >= HALF && cx <= A.width - HALF && cy >= HALF && cy <= A.height - HALF && !inCover(cx, cy)) pass[gy * nc + gx] = 1;
  }
  const ncomp = new Int32Array(nc * nr).fill(-1); const nsizes = [];
  const nq = new Int32Array(nc * nr);
  for (let s0 = 0; s0 < pass.length; s0++) {
    if (!pass[s0] || ncomp[s0] >= 0) continue;
    const c = nsizes.length; let h = 0, t = 0; nq[t++] = s0; ncomp[s0] = c;
    while (h < t) {
      const p = nq[h++]; const cx = p % nc, cy = (p - cx) / nc;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue; const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= nc || ny >= nr) continue;
        const ni = ny * nc + nx;
        if (!pass[ni] || ncomp[ni] >= 0) continue;
        if (ox && oy && (!pass[cy * nc + nx] || !pass[ny * nc + cx])) continue;
        ncomp[ni] = c; nq[t++] = ni;
      }
    }
    nsizes.push(t);
  }
  const nmain = nsizes.indexOf(Math.max(...nsizes));
  // For every legal lattice point in the MAIN walkable component: the goal cell navSteer would
  // flood from (its own cell if passable, else the Chebyshev-nearest passable within 8 rings).
  const nearestPassable = (gx, gy, maxR) => {
    if (gx >= 0 && gx < nc && gy >= 0 && gy < nr && pass[gy * nc + gx]) return gy * nc + gx;
    for (let r = 1; r <= maxR; r++) for (let oy = -r; oy <= r; oy++) {
      const ny = gy + oy; if (ny < 0 || ny >= nr) continue;
      const edge = Math.abs(oy) === r;
      for (let ox = -r; ox <= r; ox += edge ? 1 : 2 * r) { const nx = gx + ox; if (nx < 0 || nx >= nc) continue; if (pass[ny * nc + nx]) return ny * nc + nx; }
    }
    return -1;
  };
  let unroutable = 0, farGoal = 0; const unroutablePts = [];
  let maxGoalGap = 0, maxGoalPt = null;
  for (let s = 0; s < ok.length; s++) {
    if (comp[s] !== main) continue;
    const i = s % cols, j = (s - i) / cols; const x = X(i), y = Y(j);
    const g = nearestPassable(Math.min(nc - 1, Math.floor(x / cell)), Math.min(nr - 1, Math.floor(y / cell)), 8);
    if (g < 0 || ncomp[g] !== nmain) { unroutable++; if (unroutablePts.length < 20) unroutablePts.push([x, y]); continue; }
    const gxC = ((g % nc) + 0.5) * cell, gyC = (Math.floor(g / nc) + 0.5) * cell;
    const gap = Math.hypot(gxC - x, gyC - y);
    if (gap > maxGoalGap) { maxGoalGap = gap; maxGoalPt = [x, y]; }
    if (gap > cell * 1.5) farGoal++;
  }
  out.nav = { cell, cols: nc, rows: nr, passable: pass.reduce((a, b) => a + b, 0), components: nsizes.length, mainSize: nsizes[nmain], unroutable, unroutablePts, farGoal, maxGoalGap: +maxGoalGap.toFixed(1), maxGoalPt };
  if (unroutable) out.faults.push(`${unroutable} legal points the flow field cannot route to`);
  log(`NAVGRID  cell ${cell} wu (${nc}x${nr}), ${out.nav.passable} passable, ${nsizes.length} component(s) [${nsizes.slice(0, 6).join(',')}]; legal points with no routable goal cell: ${unroutable}; goal cell >1.5 cells from the point: ${farGoal}; worst gap ${out.nav.maxGoalGap} wu at ${maxGoalPt}`);

  // ── CONCEALMENT ───────────────────────────────────────────────────────────
  const keep = concealmentKeepoutRadius(A.maxSafeRadius);
  out.conceal = (A.concealment ?? []).map((b) => {
    let n = 0, st = 0;
    for (let x = b.x - b.w / 2 + 1; x < b.x + b.w / 2; x += 2) for (let y = b.y - b.h / 2 + 1; y < b.y + b.h / 2; y += 2) { n++; if (legal(x, y) && comp[Math.round((y - HALF) / L) * cols + Math.round((x - HALF) / L)] === main) st++; }
    const dx = Math.max(0, Math.abs(A.center.x - b.x) - b.w / 2), dy = Math.max(0, Math.abs(A.center.y - b.y) - b.h / 2);
    const row = { kind: b.kind, x: b.x, y: b.y, w: b.w, h: b.h, standable: +(st / n).toFixed(4), nearest: +Math.hypot(dx, dy).toFixed(2), keepout: +keep.toFixed(2) };
    if (row.standable < 0.95) out.faults.push(`conceal ${b.kind}@${b.x},${b.y} only ${(100 * row.standable).toFixed(1)}% standable`);
    if (row.nearest < keep) out.faults.push(`conceal ${b.kind}@${b.x},${b.y} inside keep-out`);
    return row;
  });
  log(`CONCEAL  ${out.conceal.length} patches; min standable ${Math.min(...out.conceal.map((c) => c.standable)).toFixed(4)}; min clearance ${Math.min(...out.conceal.map((c) => c.nearest - c.keepout)).toFixed(2)} wu past the ${keep.toFixed(2)} keep-out`);

  // ── HAZARDS ───────────────────────────────────────────────────────────────
  out.hazards = A.hazards.map((h) => {
    let n = 0, st = 0;
    for (let x = h.x - h.radius; x <= h.x + h.radius; x += 2) for (let y = h.y - h.radius; y <= h.y + h.radius; y += 2) {
      if (Math.hypot(x - h.x, y - h.y) >= h.radius) continue; n++; if (legal(x, y)) st++;
    }
    return { kind: h.kind, x: h.x, y: h.y, r: h.radius, standable: +(st / n).toFixed(4) };
  });
  for (const h of out.hazards) if (h.kind === 'slow' && h.standable < 0.95) out.faults.push(`slow puddle @${h.x},${h.y} only ${(100 * h.standable).toFixed(1)}% standable`);
  log(`HAZARDS  ${out.hazards.map((h) => `${h.kind}@${h.x},${h.y} r${h.r}: ${(100 * h.standable).toFixed(1)}% standable`).join(' · ')}`);

  // ── FINAL RING (rule 6) ──────────────────────────────────────────────────
  out.ring = [];
  for (let n = 2; n <= 6; n++) {
    const fr = minSafeRadiusFor(n);
    const inside = A.cover.filter((o) => o.kind !== 'boiling_pot').filter((o) => {
      const dx = Math.max(0, Math.abs(A.center.x - o.x) - o.w / 2), dy = Math.max(0, Math.abs(A.center.y - o.y) - o.h / 2);
      return Math.hypot(dx, dy) < fr + HALF;
    });
    out.ring.push({ n, floor: +fr.toFixed(2), solidInside: inside.length });
    if (inside.length) out.faults.push(`N=${n} final ring ${fr.toFixed(1)} holds ${inside.length} solid box(es)`);
  }
  log(`RING     ${out.ring.map((r) => `N${r.n} ${r.floor}: ${r.solidInside}`).join(' · ')}`);
  log(`FAULTS   ${out.faults.length ? out.faults.join(' | ') : 'none'}`);
  return out;
}

function selftest() {
  const base = {
    id: 'fx', width: 1000, height: 800, center: { x: 500, y: 400 }, maxSafeRadius: 640,
    playerSpawn: { x: 100, y: 100 }, enemySpawn: { x: 900, y: 700 },
    hazards: [{ x: 500, y: 400, radius: 95, kind: 'damage', damage: 8, tickMs: 250 }],
    cover: [{ x: 500, y: 400, w: 104, h: 104, kind: 'boiling_pot' }],
    concealment: [],
  };
  let fails = 0;
  const expect = (name, A, needle) => {
    const r = audit(A, { quiet: true });
    const hit = r.faults.some((f) => f.includes(needle));
    console.log(`${hit ? 'PASS' : 'FAIL'}  ${name}: expects a fault containing "${needle}"  → ${r.faults.join(' | ') || 'none'}`);
    if (!hit) fails++;
  };
  const clean = audit(base, { quiet: true });
  console.log(`${clean.faults.length === 0 ? 'PASS' : 'FAIL'}  control: clean fixture reports no faults → ${clean.faults.join(' | ') || 'none'}`);
  if (clean.faults.length) fails++;
  // Known-bad 1: a sealed pocket — four boxes boxing in a 100x100 room.
  expect('sealed pocket', { ...base, cover: [...base.cover,
    { x: 200, y: 150, w: 200, h: 20, kind: 'n' }, { x: 200, y: 290, w: 200, h: 20, kind: 's' },
    { x: 110, y: 220, w: 20, h: 160, kind: 'w' }, { x: 290, y: 220, w: 20, h: 160, kind: 'e' }] }, 'sealed pocket');
  // Known-bad 2: a spawn inside a box.
  expect('spawn inside cover', { ...base, cover: [...base.cover, { x: 110, y: 110, w: 60, h: 60, kind: 'crate' }] }, 'spawn 0 inside cover');
  // Known-bad 3: a concealment patch entirely inside a box.
  expect('patch under a prop', { ...base, cover: [...base.cover, { x: 800, y: 200, w: 200, h: 200, kind: 'block' }], concealment: [{ x: 800, y: 200, w: 100, h: 100, kind: 'p' }] }, 'standable');
  // Known-bad 4: a solid box inside the N=6 final ring.
  expect('box in final ring', { ...base, cover: [...base.cover, { x: 700, y: 400, w: 40, h: 40, kind: 'x' }] }, 'final ring');
  console.log(fails ? `SELFTEST: ${fails} FAIL` : 'SELFTEST: every known-bad is flagged and the control is clean');
  return fails;
}

console.log(`src-root ${SRC_ROOT}\narena    ${ARENA_PATH}`);
if (args.selftest) process.exitCode = selftest() ? 1 : 0;
else {
  const A = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
  const r = audit(A);
  writeFileSync(`${OUT_DIR}/geom_audit${args.tag ? '_' + args.tag : ''}.json`, JSON.stringify(r, null, 2));
}
