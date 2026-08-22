#!/usr/bin/env node
/**
 * V1_SCATTER — an OFFLINE replica of `buildGroundChips`'s placement loop, so the count
 * and the clustering can be tuned in milliseconds instead of one browser run per guess.
 *
 * ## 🚨 A SECOND IMPLEMENTATION IS A LIABILITY UNLESS IT IS PINNED TO THE FIRST
 *
 * This is exactly the shape of defect this repo keeps recording — a fixture that agrees
 * with the thing it models only until one of them moves. So the replica is not trusted
 * on its own: `--verify` re-runs it with the SHIPPED constants and requires it to
 * reproduce the instance counts measured in a real browser by `ar_chipcheck` /
 * `v1_counts` on the BEFORE tree:
 *
 *     ground_chip_pebble 3960 · ground_chip_shard 3225 · total 7185
 *
 * If that arm goes red, the replica has drifted from `floor.ts` and every number it
 * prints is void. It is red BY CONSTRUCTION the moment the placement loop changes shape
 * (a different number of `rand()` calls per cell shifts the whole stream), which is the
 * property that makes it a check rather than a comment.
 *
 * ⚠️ Whatever this prints, the number that goes in a commit message is the one measured
 * in the browser. This tool chooses constants; it does not report results.
 *
 *   node tools/tmp/v1_scatter.mjs --verify          # the replica against the real tree
 *   node tools/tmp/v1_scatter.mjs --mode after      # the proposed field
 */
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

// From src/arena/shared.ts, via tools/arena.gameplay.json so nothing is retyped.
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const A = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const ARENA_W = A.width, ARENA_H = A.height, CENTER = A.center;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** The shipped low-frequency field, verbatim. */
function densityBefore(wx, wy) {
  const a = Math.sin(wx * 0.01337 - 1.1) * Math.cos(wy * 0.00921 + 2.4);
  const b = Math.sin((wx * 0.8 - wy) * 0.0314 + 0.7);
  const c = Math.cos((wx + wy * 1.3) * 0.0661 - 2.2);
  return clamp((a * 0.55 + b * 0.32 + c * 0.2) * 1.35 * 0.5 + 0.5, 0, 1);
}

/** The proposed ZONE field — see the note in floor.ts. */
function zoneAfter(wx, wy, P) {
  const dPot = Math.hypot(wx - CENTER.x, wy - CENTER.y);
  const apron = 1 - clamp(Math.abs(dPot - P.APRON_R) / P.APRON_W, 0, 1);
  const dEdge = Math.min(wx, ARENA_W - wx, wy, ARENA_H - wy);
  const wall = 1 - clamp(dEdge / P.WALL_REACH, 0, 1);
  const cx = wx < ARENA_W / 2 ? 0 : ARENA_W, cy = wy < ARENA_H / 2 ? 0 : ARENA_H;
  const corner = 1 - clamp(Math.hypot(wx - cx, wy - cy) / P.CORNER_REACH, 0, 1);
  return clamp(Math.max(apron, wall, corner * corner), 0, 1);
}

function run(mode, P) {
  const CELL = P.CELL;
  const cols = Math.floor(ARENA_W / CELL), rows = Math.floor(ARENA_H / CELL);
  let seed = 91_711;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let pebbles = 0, shards = 0;
  const byZone = { apron: 0, wall: 0, corner: 0, open: 0 };
  const quad = { NW: 0, NE: 0, SW: 0, SE: 0 };
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const wx = (cx + 0.15 + rand() * 0.7) * CELL;
      const wy = (cy + 0.15 + rand() * 0.7) * CELL;
      const keep = rand();
      rand(); rand(); rand(); rand(); rand(); rand(); rand(); rand(); // r flat rot tiltX tiltZ sx sz ci
      const toShard = rand() < 0.45;
      if (wx < 14 || wx > ARENA_W - 14 || wy < 14 || wy > ARENA_H - 14) continue;
      if (Math.hypot(wx - CENTER.x, wy - CENTER.y) < 80) continue;
      let p;
      if (mode === 'before') p = P.P_MIN + (P.P_MAX - P.P_MIN) * densityBefore(wx, wy);
      else {
        const z = clamp(zoneAfter(wx, wy, P) * (P.MOD_BASE + P.MOD_GAIN * densityBefore(wx, wy)), 0, 1);
        p = P.P_OPEN + (P.P_ZONE - P.P_OPEN) * z;
      }
      if (keep > p) continue;
      if (toShard) shards++; else pebbles++;
      const dPot = Math.hypot(wx - CENTER.x, wy - CENTER.y);
      const dEdge = Math.min(wx, ARENA_W - wx, wy, ARENA_H - wy);
      const cxx = wx < ARENA_W / 2 ? 0 : ARENA_W, cyy = wy < ARENA_H / 2 ? 0 : ARENA_H;
      if (Math.hypot(wx - cxx, wy - cyy) < (P.CORNER_REACH ?? 0)) byZone.corner++;
      else if (dEdge < (P.WALL_REACH ?? 0)) byZone.wall++;
      else if (Math.abs(dPot - (P.APRON_R ?? 0)) < (P.APRON_W ?? 0)) byZone.apron++;
      else byZone.open++;
      quad[(wy < ARENA_H / 2 ? 'N' : 'S') + (wx < ARENA_W / 2 ? 'W' : 'E')]++;
    }
  }
  return { cols, rows, cells: cols * rows, pebbles, shards, total: pebbles + shards, byZone, quad };
}

const BEFORE = { CELL: 19, P_MIN: 0.10, P_MAX: 0.85 };
/** These MIRROR `floor.ts`'s shipped constants. `--verify` cross-checks the mirror. */
const AFTER = {
  CELL: 19,
  P_OPEN: 0.010, P_ZONE: 0.95,
  APRON_R: 170, APRON_W: 110,
  WALL_REACH: 110,
  CORNER_REACH: 440,
  MOD_BASE: 0.45, MOD_GAIN: 1.0,
};

/**
 * The mirror is only a mirror if it is CHECKED. Read the live constants out of
 * `src/arena/floor.ts` and require them to equal the table above — otherwise this file
 * quietly becomes a description of a tree that no longer exists, which is the exact
 * defect its own header warns about.
 */
function mirrorCheck() {
  const src = readFileSync(join(ROOT, 'src/arena/floor.ts'), 'utf8');
  const num = (name) => {
    const m = src.match(new RegExp(`const ${name}\\s*=\\s*(-?[0-9.]+)\\s*;`));
    return m ? Number(m[1]) : null;
  };
  return [
    ['CHIP_CELL', num('CHIP_CELL'), AFTER.CELL],
    ['CHIP_P_OPEN', num('CHIP_P_OPEN'), AFTER.P_OPEN],
    ['CHIP_P_ZONE', num('CHIP_P_ZONE'), AFTER.P_ZONE],
    ['CHIP_APRON_R', num('CHIP_APRON_R'), AFTER.APRON_R],
    ['CHIP_APRON_W', num('CHIP_APRON_W'), AFTER.APRON_W],
    ['CHIP_WALL_REACH', num('CHIP_WALL_REACH'), AFTER.WALL_REACH],
    ['CHIP_CORNER_REACH', num('CHIP_CORNER_REACH'), AFTER.CORNER_REACH],
  ];
}

if (has('verify')) {
  const b = run('before', BEFORE);
  const want = { pebbles: 3960, shards: 3225, total: 7185 };
  let fail = 0;
  const ck = (n, ok, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}  ${d}`); if (!ok) fail++; };
  ck('the replica reproduces the BROWSER-measured pebble count', b.pebbles === want.pebbles, `${b.pebbles} vs ${want.pebbles}`);
  ck('the replica reproduces the BROWSER-measured shard count', b.shards === want.shards, `${b.shards} vs ${want.shards}`);
  ck('total', b.total === want.total, `${b.total} vs ${want.total}`);
  ck('grid is the ×4 grid, not the 73×52 the file comment used to claim',
    b.cols === 147 && b.rows === 105, `${b.cols}×${b.rows} = ${b.cells} cells`);
  for (const [name, live, mine] of mirrorCheck()) {
    ck(`mirror: ${name} matches src/arena/floor.ts`, live === mine, `live ${live} vs replica ${mine}`);
  }
  const a = run('after', AFTER);
  console.log(`\n  BEFORE  ${b.total}  peb ${b.pebbles} shard ${b.shards}  quad ${JSON.stringify(b.quad)}`);
  console.log(`  AFTER   ${a.total}  peb ${a.pebbles} shard ${a.shards}  zones ${JSON.stringify(a.byZone)}`);
  console.log(`  CUT     ${(100 * (1 - a.total / b.total)).toFixed(1)}%`);
  process.exit(fail === 0 ? 0 : 1);
}

const mode = arg('mode', 'after');
const P = mode === 'before' ? BEFORE : { ...AFTER };
for (const k of ['P_OPEN', 'P_ZONE', 'APRON_R', 'APRON_W', 'WALL_REACH', 'CORNER_REACH', 'MOD_BASE', 'MOD_GAIN', 'CELL']) {
  if (arg(k) !== null) P[k] = Number(arg(k));
}
const r = run(mode, P);
console.log(JSON.stringify({ mode, P, ...r }, null, 2));
