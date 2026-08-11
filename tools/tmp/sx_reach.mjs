#!/usr/bin/env node
/**
 * SX_REACH — THE SIBLINGS OF "BOTH SLOW PUDDLES ARE UNREACHABLE".
 *
 * Uri's two most valuable bug reports on this project were *"there are regions in the map that
 * are unreachable"* and *"i can't hide under concealments"*. `DECISIONS §60` then found, hours
 * before this run, that **0 of 7,845 cells inside either slow puddle is standable** on the ×4
 * map — a hazard no fighter can ever enter. `sp_place.mjs` prints that one and deliberately does
 * not assert it (a bug-pin that goes red when the bug is fixed is a trap).
 *
 * That is one instance of a CLASS: *a piece of authored content placed where a body cannot go.*
 * This file sweeps every member of the class the ×4 map has, on the same 1 wu lattice and with
 * the sim's own predicates, imported rather than redrawn:
 *
 *   1. **HAZARDS** — every `damage` and `slow` hazard: what share of its disc is standable?
 *      (The puddles are the known instance and are the positive control for the whole sweep.)
 *   2. **CONCEALMENT** — all 20 plates: what share of each is standable, and is any plate
 *      entirely buried? A plate you cannot stand in is a plate you cannot hide under, which is
 *      Uri's second report expressed as geometry.
 *   3. **THE FOG CANOPY** — 🚨 the new one. `fogRing.ts:207` sets `FIELD_OUTER_UNITS = 1500` and
 *      its own comment justifies it as *"the arena's half-diagonal is ~860, so this covers every
 *      corner"*. **860.2 is the 1400×1000 half-diagonal. The ×4 map's is 1720.5.** So at sudden
 *      death — the one radius the canopy exists for — the tint stops 220 wu short of the corners.
 *      This measures how much STANDABLE ground is outside the canopy, which is the only version
 *      of the question a player can be standing in.
 *   4. **ISLANDS** — standable cells not in the same flood component as the spawns. `ap_reach.mjs`
 *      owns this question at the face/pocket level; this is the coarse whole-map count, reported
 *      as a cross-check rather than as a replacement.
 *
 * ── 🚨 THE CONTROL ──────────────────────────────────────────────────────────
 *
 * The sweep's positive control is **the known defect itself**: the two slow puddles must come
 * back at 0.0% standable. An instrument that reports every hazard as reachable while `sp_place`
 * reports 0 of 7,845 is measuring something else. And the negative control is in the same table:
 * some region must come back NON-zero, or the predicate is simply returning "blocked" for
 * everything. Both are asserted, not eyeballed.
 *
 *   node tools/tmp/sx_reach.mjs --src <tree>/src --arena <tree>/tools/arena.gameplay.json
 */
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SRC = resolve(String(arg('--src', `${ROOT}/src`)));
const ARENA_PATH = resolve(String(arg('--arena', `${ROOT}/tools/arena.gameplay.json`)));
const STEP = Number(arg('--step', 1));

if (!existsSync(ARENA_PATH)) { console.error(`sx_reach: no arena dump at ${ARENA_PATH}`); process.exit(2); }
const arena = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));

const RULES = await import(`${SRC}/game/rules.ts`);
const { PLAYER_SIZE } = RULES;
const { isConcealed } = await import(`${SRC}/game/movement.ts`);

/** `FIELD_OUTER_UNITS`, READ OUT OF THE SOURCE rather than typed in — a literal here would be a
 *  second copy of exactly the constant this file exists to show has gone stale. */
const fogSrc = readFileSync(`${SRC}/arena/fogRing.ts`, 'utf8');
const FIELD_OUTER_UNITS = Number(/const FIELD_OUTER_UNITS = (\d+)/.exec(fogSrc)?.[1]);
if (!Number.isFinite(FIELD_OUTER_UNITS)) { console.error('sx_reach: could not read FIELD_OUTER_UNITS'); process.exit(2); }

const HALF = PLAYER_SIZE / 2;
/** `movement.ts:collidesWithCover`, one statement, same shape as `sp_place.mjs:blocked`. */
const blocked = (x, y) => {
  for (const o of arena.cover) {
    if (Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2) return true;
  }
  return false;
};
const inBounds = (x, y) => x >= HALF && x <= arena.width - HALF && y >= HALF && y <= arena.height - HALF;
/** A fighter's CENTRE may legally sit here. */
const standable = (x, y) => inBounds(x, y) && !blocked(x, y);

/** Share of a disc that is standable, swept on the lattice. */
function discShare(cx, cy, r) {
  let cells = 0, legal = 0;
  for (let y = cy - r; y <= cy + r; y += STEP) for (let x = cx - r; x <= cx + r; x += STEP) {
    if (Math.hypot(x - cx, y - cy) > r) continue;
    cells++;
    if (standable(x, y)) legal++;
  }
  return { cells, legal };
}

/** Share of an axis-aligned box that is standable. */
function boxShare(b) {
  let cells = 0, legal = 0;
  for (let y = b.y - b.h / 2; y <= b.y + b.h / 2; y += STEP) for (let x = b.x - b.w / 2; x <= b.x + b.w / 2; x += STEP) {
    cells++;
    if (standable(x, y)) legal++;
  }
  return { cells, legal };
}

if (IS_MAIN) {
  const t0 = Date.now();
  let pass = 0, fail = 0;
  const ok = (l, c, d = '') => { if (c) { pass++; console.log(`  ok   - ${l}${d ? `   ${d}` : ''}`); } else { fail++; console.log(`  FAIL - ${l}${d ? `\n         ${d}` : ''}`); } };

  console.log(`\nSX_REACH   arena ${arena.width}×${arena.height}  body ${PLAYER_SIZE} wu  lattice ${STEP} wu`);
  console.log(`           cover ${arena.cover.length} · hazards ${arena.hazards.length} · concealment ${arena.concealment?.length ?? 0}`);

  // ── 1. HAZARDS ────────────────────────────────────────────────────────────
  console.log(`\n1. HAZARDS — can a fighter ever be in one?`);
  const hz = [];
  for (const h of arena.hazards) {
    const s = discShare(h.x, h.y, h.radius);
    hz.push({ h, s });
    console.log(`   ${String(h.kind).padEnd(7)} @${String(h.x).padStart(5)},${String(h.y).padStart(5)} r${String(h.radius).padStart(4)}`
      + `   ${String(s.legal).padStart(7)} of ${String(s.cells).padStart(7)} cells standable  (${((100 * s.legal) / s.cells).toFixed(1)}%)`);
  }
  const slow = hz.filter((r) => r.h.kind === 'slow');
  ok('POSITIVE CONTROL: the two slow puddles come back 0.0% standable (DECISIONS §60)',
    slow.length === 2 && slow.every((r) => r.s.legal === 0),
    slow.map((r) => `@${r.h.x},${r.h.y} ${r.s.legal}/${r.s.cells}`).join(' · '));
  ok('NEGATIVE CONTROL: something in this table is non-zero',
    hz.some((r) => r.s.legal > 0), hz.map((r) => `${r.h.kind}:${r.s.legal}`).join(' '));

  // ── 2. CONCEALMENT ────────────────────────────────────────────────────────
  console.log(`\n2. CONCEALMENT — can a fighter stand inside each plate, and does the sim agree it is hidden there?`);
  const plates = arena.concealment ?? [];
  const cRows = [];
  for (const [i, b] of plates.entries()) {
    const s = boxShare(b);
    // The sim's own predicate at the box centre and at the standable centroid — `isConcealed`
    // is imported, never re-derived, so "the region exists" and "the region conceals" cannot
    // drift apart in this file.
    let sx = 0, sy = 0, k = 0;
    for (let y = b.y - b.h / 2; y <= b.y + b.h / 2; y += STEP) for (let x = b.x - b.w / 2; x <= b.x + b.w / 2; x += STEP) {
      if (standable(x, y)) { sx += x; sy += y; k++; }
    }
    const cen = k ? { x: sx / k, y: sy / k } : null;
    const hides = cen ? isConcealed(cen.x, cen.y, arena) : false;
    cRows.push({ i, b, s, cen, hides });
  }
  for (const r of cRows) {
    console.log(`   plate ${String(r.i).padStart(2)} @${String(r.b.x).padStart(5)},${String(r.b.y).padStart(5)}`
      + ` ${String(r.b.w).padStart(4)}×${String(r.b.h).padStart(4)}`
      + `   ${String(r.s.legal).padStart(6)} of ${String(r.s.cells).padStart(6)} standable (${((100 * r.s.legal) / r.s.cells).toFixed(1)}%)`
      + `   isConcealed@standable-centroid ${r.hides ? 'YES' : r.cen ? 'no' : '— (nowhere to stand)'}`);
  }
  const buried = cRows.filter((r) => r.s.legal === 0);
  const thin = cRows.filter((r) => r.s.legal > 0 && r.s.legal / r.s.cells < 0.25);
  console.log(`   → ${buried.length} of ${plates.length} plates have NO standable cell; ${thin.length} more are under 25% standable`);
  ok('every concealment plate has somewhere to stand in it', buried.length === 0,
    buried.map((r) => `plate ${r.i} @${r.b.x},${r.b.y}`).join(' · '));
  ok('every plate that CAN be stood in actually conceals there',
    cRows.filter((r) => r.cen).every((r) => r.hides),
    cRows.filter((r) => r.cen && !r.hides).map((r) => `plate ${r.i}`).join(' · '));

  // ── 3. THE FOG CANOPY ─────────────────────────────────────────────────────
  const cx = arena.center.x, cy = arena.center.y;
  const halfDiag = Math.hypot(arena.width / 2, arena.height / 2);
  let total = 0, outside = 0, maxD = 0;
  for (let y = HALF; y <= arena.height - HALF; y += 4) for (let x = HALF; x <= arena.width - HALF; x += 4) {
    if (!standable(x, y)) continue;
    total++;
    const d = Math.hypot(x - cx, y - cy);
    if (d > maxD) maxD = d;
    if (d > FIELD_OUTER_UNITS) outside++;
  }
  console.log(`\n3. THE SUDDEN-DEATH CANOPY — fogRing.ts FIELD_OUTER_UNITS = ${FIELD_OUTER_UNITS} wu`);
  console.log(`   arena half-diagonal ${halfDiag.toFixed(1)} wu · furthest STANDABLE cell from centre ${maxD.toFixed(1)} wu`);
  console.log(`   standable cells outside the canopy: ${outside} of ${total} (${((100 * outside) / total).toFixed(2)}%)`);
  ok('the canopy radius covers every standable cell', outside === 0,
    `${outside} standable cells (${((100 * outside) / total).toFixed(2)}%) sit beyond ${FIELD_OUTER_UNITS} wu; the furthest is ${maxD.toFixed(1)} wu`
    + `\n         fogRing.ts:207's own comment — "The arena's half-diagonal is ~860, so this covers every corner" — is the 1400×1000 number`);

  // ── 4. ISLANDS ────────────────────────────────────────────────────────────
  const CELL = 8;
  const W = Math.floor(arena.width / CELL), H = Math.floor(arena.height / CELL);
  const passable = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
    passable[j * W + i] = standable(x, y) ? 1 : 0;
  }
  const seen = new Uint8Array(W * H);
  const comps = [];
  for (let s = 0; s < passable.length; s++) {
    if (!passable[s] || seen[s]) continue;
    let size = 0; const stack = [s]; seen[s] = 1; const cells = [];
    while (stack.length) {
      const c = stack.pop(); size++; cells.push(c);
      const i = c % W, j = (c / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nc = nj * W + ni;
        if (passable[nc] && !seen[nc]) { seen[nc] = 1; stack.push(nc); }
      }
    }
    comps.push({ size, sample: cells[0] });
  }
  comps.sort((a, b) => b.size - a.size);
  const spawnComp = (p) => {
    const i = Math.min(W - 1, Math.max(0, Math.floor(p.x / CELL)));
    const j = Math.min(H - 1, Math.max(0, Math.floor(p.y / CELL)));
    return passable[j * W + i] ? 1 : 0;
  };
  console.log(`\n4. ISLANDS — flood components at a ${CELL} wu cell (coarse cross-check on ap_reach)`);
  console.log(`   ${comps.length} component(s); largest ${comps[0]?.size ?? 0} cells`
    + `${comps.length > 1 ? `, next ${comps.slice(1, 6).map((c) => c.size).join('/')}` : ''}`);
  console.log(`   all six spawns land on a passable cell: ${arena.spawns.every(spawnComp)}`);
  ok('the standable map is ONE connected component', comps.length === 1,
    `${comps.length} components; the ${comps.length - 1} island(s) hold ${comps.slice(1).reduce((s, c) => s + c.size, 0)} cells`);

  console.log(`\n${pass} passed, ${fail} failed   (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  process.exit(fail ? 1 : 0);
}
