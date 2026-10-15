#!/usr/bin/env node
/**
 * b4_trapgrid — can a relocation leave a fighter INSIDE cover on the shipped kitchen, and where
 * does the fallback put it? (`docs/REVAMP.md` §5 B4, BH-02, 2026-10-15). Owner of the `b4_` prefix.
 *
 * Three questions, each over the SHIPPED layout (`tools/arena.gameplay.json`, whose 117 cover
 * boxes and 20 concealment regions `arena_probe.mjs --verify` matched box-for-box against
 * `kitchen.ts` on `31ed880`):
 *
 *   1. TRAPS — every point of a `--step` lattice is handed to `movement.ts:placeFighterAt`
 *      exactly as Disposal hands it a destination; a landing that still overlaps cover AND cannot
 *      walk out (60 ticks of `tryMove` in each of 8 directions) is a trap. 10,757 on `31ed880`.
 *   2. HOW FAR — for every lattice point the depenetration had to move, the distance from the
 *      request to the landing (median / p90 / max), so "nearest standable" is a number.
 *   3. POCKETS — a 1 wu flood fill of every standable fighter-centre from spawn 0. A landing (or
 *      any standable cell) outside that component is ground nobody can walk out of — the next
 *      trap, one level up. The fallback is only safe on a layout with none.
 *
 *   node tools/tmp/b4_trapgrid.mjs [--root <tree>] [--step 5]
 *   node tools/tmp/b4_trapgrid.mjs --selftest     # each question shown to FAIL on a planted fixture
 *
 * ⚠️ `--root` picks the SIM; the layout always comes from this checkout's dump. Pure Node.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? dflt : process.argv[i + 1];
};

async function loadMovement(root) {
  const g = `${root}/src/game`;
  const [movement, rules] = await Promise.all([import(`${g}/movement.ts`), import(`${g}/rules.ts`)]);
  return { movement, rules };
}

const kitchen = () => ({ ...JSON.parse(readFileSync(`${REPO}/tools/arena.gameplay.json`, 'utf8')), build: () => null, update: () => {} });

function overlapsCover(arena, size, x, y) {
  for (const o of arena.cover) if (Math.abs(x - o.x) < (size + o.w) / 2 && Math.abs(y - o.y) < (size + o.h) / 2) return true;
  return false;
}

/** 1 wu standable mask + 4-connected component labels. Returns { label(x, y), sizes, main }. */
function components(arena, size, from) {
  const W = Math.floor(arena.width) + 1, H = Math.floor(arena.height) + 1, half = size / 2;
  const free = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x >= half && y >= half && x <= arena.width - half && y <= arena.height - half) free[y * W + x] = 1;
  for (const o of arena.cover) {
    const hw = (size + o.w) / 2, hh = (size + o.h) / 2;
    for (let y = Math.max(0, Math.floor(o.y - hh)); y <= Math.min(H - 1, Math.ceil(o.y + hh)); y++) {
      for (let x = Math.max(0, Math.floor(o.x - hw)); x <= Math.min(W - 1, Math.ceil(o.x + hw)); x++) {
        if (Math.abs(x - o.x) < hw && Math.abs(y - o.y) < hh) free[y * W + x] = 0;
      }
    }
  }
  const lab = new Int32Array(W * H).fill(-1);
  const sizes = [];
  const queue = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (!free[s] || lab[s] >= 0) continue;
    const id = sizes.length;
    let head = 0, tail = 0, n = 0;
    queue[tail++] = s; lab[s] = id;
    while (head < tail) {
      const c = queue[head++]; n++;
      const cx = c % W, cy = (c - cx) / W;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (free[k] && lab[k] < 0) { lab[k] = id; queue[tail++] = k; }
      }
    }
    sizes.push(n);
  }
  /** The component of the standable lattice cell(s) around (x, y): any of the four corners. */
  const label = (x, y) => {
    for (const [cx, cy] of [[Math.floor(x), Math.floor(y)], [Math.ceil(x), Math.floor(y)], [Math.floor(x), Math.ceil(y)], [Math.ceil(x), Math.ceil(y)]]) {
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const l = lab[cy * W + cx];
      if (l >= 0) return l;
    }
    return -1;
  };
  return { label, sizes, main: label(from.x, from.y) };
}

function census(S, arena, step) {
  const size = S.rules.PLAYER_SIZE;
  const fresh = () => ({ x: 0, y: 0, size, push: { x: 0, y: 0, remaining: 0, speed: 0, anchor: -1 } });
  const comp = components(arena, size, arena.spawns?.[0] ?? arena.playerSpawn);
  let tried = 0, inside = 0, stuck = 0, moved = 0, offMain = 0;
  const dists = [];
  const examples = [];
  for (let x = 0; x <= arena.width; x += step) {
    for (let y = 0; y <= arena.height; y += step) {
      const f = fresh();
      S.movement.placeFighterAt(f, x, y, arena);
      tried++;
      const cx = Math.min(arena.width - size / 2, Math.max(size / 2, x));
      const cy = Math.min(arena.height - size / 2, Math.max(size / 2, y));
      const d = Math.hypot(f.x - cx, f.y - cy);
      if (d > 0) { moved++; dists.push(d); }
      if (overlapsCover(arena, size, f.x, f.y)) {
        inside++;
        let freed = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const g = { ...f, push: { ...f.push } };
          for (let k = 0; k < 60; k++) S.movement.tryMove(g, dx * 1.5, dy * 1.5, arena);
          if (!overlapsCover(arena, size, g.x, g.y)) { freed = true; break; }
        }
        if (!freed) { stuck++; if (examples.length < 4) examples.push(`(${x},${y})->(${f.x.toFixed(2)},${f.y.toFixed(2)})`); }
      } else if (comp.label(f.x, f.y) !== comp.main) {
        offMain++;
        if (examples.length < 8) examples.push(`POCKET (${x},${y})->(${f.x.toFixed(2)},${f.y.toFixed(2)})`);
      }
    }
  }
  dists.sort((a, b) => a - b);
  const q = (p) => (dists.length ? dists[Math.min(dists.length - 1, Math.floor(p * dists.length))] : 0);
  const pockets = comp.sizes.map((n, i) => ({ i, n })).filter((c) => c.i !== comp.main);
  return {
    tried, leftInsideCover: inside, stuck, moved, landedOffMainFloor: offMain,
    moveDist: { median: +q(0.5).toFixed(2), p90: +q(0.9).toFixed(2), max: +(dists[dists.length - 1] ?? 0).toFixed(2) },
    components: comp.sizes.length, mainCells: comp.sizes[comp.main], pocketCells: pockets.reduce((a, c) => a + c.n, 0),
    examples,
  };
}

if (IS_MAIN) {
  if (process.argv.includes('--selftest')) {
    // Each question shown to FAIL on input planted to fail it, against THIS tree's sim:
    //  * a 5 wu seam: on a tree without the fallback, `stuck` must be > 0 (the instrument SEES a
    //    trap); with it, 0 — so the run reports which tree it is looking at;
    //  * a sealed 4-box ring around an open square: `pocketCells` must be > 0 and a drop aimed
    //    into the hollow must be counted off the main floor;
    //  * an empty arena: zero of everything (no false positives).
    const S = await loadMovement(arg('root', REPO));
    const base = (cover) => ({ width: 600, height: 600, center: { x: 300, y: 300 }, maxSafeRadius: 1e6, spawns: [{ x: 40, y: 40 }], playerSpawn: { x: 40, y: 40 }, cover, hazards: [] });
    const seam = census(S, base([{ x: 300, y: 255, w: 170, h: 90 }, { x: 300, y: 350, w: 170, h: 90 }]), 5);
    const ring = census(S, base([{ x: 300, y: 200, w: 300, h: 40 }, { x: 300, y: 400, w: 300, h: 40 }, { x: 170, y: 300, w: 40, h: 240 }, { x: 430, y: 300, w: 40, h: 240 }]), 5);
    const empty = census(S, base([]), 5);
    const rows = [
      [seam.leftInsideCover > 0 || seam.moved > 0, `the seam is SEEN: ${seam.moved} drops moved, ${seam.leftInsideCover} left inside (${seam.stuck} stuck)`],
      [ring.pocketCells > 0 && ring.landedOffMainFloor > 0, `the sealed ring is a POCKET: ${ring.pocketCells} cells, ${ring.landedOffMainFloor} drops landed in it`],
      [empty.moved === 0 && empty.stuck === 0 && empty.landedOffMainFloor === 0 && empty.pocketCells === 0, 'an empty arena reports nothing'],
    ];
    for (const [ok, what] of rows) console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
    console.log(`      (this tree: the seam leaves ${seam.stuck} stuck — ${seam.stuck > 0 ? 'NO fallback' : 'the fallback is in'})`);
    process.exit(rows.every(([ok]) => ok) ? 0 : 1);
  }
  const root = arg('root', REPO);
  const S = await loadMovement(root);
  const arena = kitchen();
  const t0 = Date.now();
  const r = census(S, arena, Number(arg('step', 5)));
  console.log(JSON.stringify({ root, cover: arena.cover.length, ...r, ms: Date.now() - t0 }, null, 1));
}
