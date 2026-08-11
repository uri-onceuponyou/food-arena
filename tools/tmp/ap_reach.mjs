#!/usr/bin/env node
/**
 * ARENA REACHABILITY — Uri, playing the shipped build, 2026-08-11:
 *
 *   > *"there are regions in the map that are unreachable due to obstacles."*
 *
 * This is the instrument for that sentence. It answers THREE different questions that all
 * sound like "can I get there", and the whole point of the tool is that they have
 * different answers on the shipped map:
 *
 *   1. **SEALED POCKET** — a connected component of sim-legal standing space that
 *      contains NEITHER spawn. Nothing in the game can ever enter it. `arena_probe
 *      --truth` already floods for this from the ENEMY spawn only; this floods from both
 *      and reports per-spawn, because a pocket reachable from one spawn and not the other
 *      is a fairness defect that a single-source flood reports as "ONE PIECE".
 *      → **Shipped kitchen: ZERO. Measured, not assumed.**
 *
 *   2. 🔴 **PHANTOM POCKET** — a maximal region of floor that the RENDERER SHOWS AS OPEN
 *      and the SIM TREATS AS BLOCKED, big enough to read as somewhere you should be able
 *      to stand. This is the shape of Uri's report that a legal-space flood structurally
 *      cannot see, and it exists because of a mismatch nobody had measured:
 *
 *          the character is drawn ~24-26 wu wide   (`shots/conceal/panels.json` charBox:
 *                                                   73 px against a 304.66 px / 100 wu
 *                                                   ruler at the same depth = 23.96 wu)
 *          the character COLLIDES as 42 wu         (`rules.ts:PLAYER_SIZE`)
 *
 *      so every prop and every wall carries an ~8 wu (0.40 m) invisible collar, and an
 *      AABB around a round prop adds up to 21.5 wu more on its diagonals. A "phantom
 *      pocket" is where those collars MEET and enclose visible floor.
 *
 *   3. **CLEARANCE** — space reachable only by threading a channel narrower than a body.
 *      Legal on a lattice, and effectively unreachable on a thumbstick. Reported as the
 *      area that drops out of the flood as the body is inflated.
 *
 * ── WHY THE VISUAL BODY IS A MEASUREMENT AND NOT A GUESS ─────────────────────
 * `--body-visual` defaults to 26 wu and every number that depends on it is printed with
 * it, so the figure can be re-derived when the cast changes. `tools/tmp/ap_view.mjs
 * --bodybox` measures it from the live scene graph (world-space XZ extent of the player
 * model) and prints the value to pass here. **26 is the conservative end** of the 23.96
 * px-derived figure — a WIDER assumed body makes the phantom band SMALLER, so the number
 * this tool reports is a floor, not a ceiling.
 *
 * ── THE COLLISION RULE IS THE SIM'S, NOT A DRAWING OF IT ─────────────────────
 * `blocked()` below is `movement.ts:collidesWithCover` written out — centre-plus-full-
 * extent AABB vs AABB, inflated by the fighter's own size — and `--selftest` §A pins it
 * against `movement.ts` itself by importing the real `tryMove` and walking a fighter into
 * a box. A flood that draws the cover instead of colliding with it is exactly the bug
 * being hunted, so the flood may not be the second drawing.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/ap_reach.mjs                       # shipped layout, all three questions
 *   node tools/tmp/ap_reach.mjs --png shots/ap/reach.png
 *   node tools/tmp/ap_reach.mjs --layout <dump.json>  # any dumped arena
 *   node tools/tmp/ap_reach.mjs --selftest            # the known-bad battery — OFFLINE
 *
 * `--layout` defaults to `tools/arena.gameplay.json`, the BROWSER dump — the arena the
 * game actually builds. `tools/tmp/arena_probe.mjs --from-src --verify` is what proves
 * that dump still equals `src/arena/kitchen.ts`; run it after any layout edit, and
 * refresh the dump with `node tools/match-sim.mjs --refresh-arena --url <snapshot>`.
 * This tool deliberately does NOT grow a second source parser: two readers of one file is
 * the trap `arena_probe`'s own header is about.
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d); };
const has = (k) => argv.includes(`--${k}`);

/** The sim's own fighter box. Read from `rules.ts` rather than typed in. */
const PLAYER_SIZE = Number(/export const PLAYER_SIZE = (\d+)/.exec(readFileSync(`${ROOT}/src/game/rules.ts`, 'utf8'))[1]);

const L = Number(arg('lattice', 2));
const BODY = Number(arg('body', PLAYER_SIZE));
const BODY_VISUAL = Number(arg('body-visual', 26));

// ─────────────────────────────────────────────────────────────────────────────
// The sim's collision rule, and the flood built on it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `movement.ts:collidesWithCover`, verbatim in structure. Kept as a plain loop for the
 * same reason the original is one, and — more importantly — kept as the ONLY place this
 * file decides whether a point is standable, so `--selftest` §A has one thing to pin.
 */
function blocked(x, y, size, cover) {
  for (let i = 0; i < cover.length; i++) {
    const o = cover[i];
    if (Math.abs(x - o.x) < (size + o.w) / 2 && Math.abs(y - o.y) < (size + o.h) / 2) return true;
  }
  return false;
}

/**
 * Flood the lattice of legal fighter CENTRES.
 *
 * 8-connected with the "both orthogonal neighbours must be legal" rule, which is what
 * `tryMove` actually delivers: it resolves x and y independently, so a diagonal step
 * through a corner that is blocked on both axes is refused on both axes.
 *
 * ⚠️ An `L`-spaced lattice can only over-report connectivity if a blocking interval fits
 * strictly BETWEEN two adjacent samples. Every CoverBox in this arena inflates to at
 * least 46 + 42 = 88 wu on both axes, so at L <= 44 that cannot happen. Stated because a
 * lattice flood that silently jumps a thin wall is the failure mode this tool exists to
 * avoid, and `--selftest` §D builds a wall thin enough to check the bound is real.
 */
function flood(arena, size, seeds) {
  const cols = Math.floor(arena.width / L), rows = Math.floor(arena.height / L);
  const half = size / 2;
  const legal = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = (gx + 0.5) * L, y = (gy + 0.5) * L;
      const inBounds = x >= half && x <= arena.width - half && y >= half && y <= arena.height - half;
      legal[gy * cols + gx] = inBounds && !blocked(x, y, size, arena.cover) ? 1 : 0;
    }
  }
  const label = new Int32Array(cols * rows).fill(-1);
  const q = new Int32Array(cols * rows);
  const comps = [];
  for (let s = 0; s < cols * rows; s++) {
    if (!legal[s] || label[s] >= 0) continue;
    const id = comps.length;
    let h = 0, t = 0; q[t++] = s; label[s] = id;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, sx = 0, sy = 0;
    while (h < t) {
      const c = q[h++], cx = c % cols, cy = (c - cx) / cols;
      const X = (cx + 0.5) * L, Y = (cy + 0.5) * L;
      sx += X; sy += Y;
      if (X < minx) minx = X; if (X > maxx) maxx = X;
      if (Y < miny) miny = Y; if (Y > maxy) maxy = Y;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = cx + ox, ny = cy + oy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (!legal[ni] || label[ni] >= 0) continue;
          if (ox && oy && (!legal[cy * cols + nx] || !legal[ny * cols + cx])) continue;
          label[ni] = id; q[t++] = ni;
        }
      }
    }
    comps.push({ id, nodes: t, areaWu: t * L * L, bbox: [minx, miny, maxx, maxy], centre: [sx / t, sy / t] });
  }
  const at = (p) => {
    const gx = Math.max(0, Math.min(cols - 1, Math.floor(p.x / L)));
    const gy = Math.max(0, Math.min(rows - 1, Math.floor(p.y / L)));
    return label[gy * cols + gx];
  };
  const nLegal = legal.reduce((a, b) => a + b, 0);
  const seedComps = seeds.map(at);
  return { cols, rows, legal, label, comps, nLegal, seedComps, size };
}

/**
 * Connected components of a boolean mask (4-connected, deliberately: a phantom pocket
 * joined to the outside world only through a corner is not somewhere a player walks).
 */
function components(mask, cols, rows) {
  const label = new Int32Array(cols * rows).fill(-1);
  const q = new Int32Array(cols * rows);
  const out = [];
  for (let s = 0; s < cols * rows; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = out.length;
    let h = 0, t = 0; q[t++] = s; label[s] = id;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, sx = 0, sy = 0;
    while (h < t) {
      const c = q[h++], cx = c % cols, cy = (c - cx) / cols;
      const X = (cx + 0.5) * L, Y = (cy + 0.5) * L;
      sx += X; sy += Y;
      if (X < minx) minx = X; if (X > maxx) maxx = X;
      if (Y < miny) miny = Y; if (Y > maxy) maxy = Y;
      const nb = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (!mask[ni] || label[ni] >= 0) continue;
        label[ni] = id; q[t++] = ni;
      }
    }
    out.push({ id, nodes: t, areaWu: t * L * L, bbox: [minx, miny, maxx, maxy], centre: [sx / t, sy / t] });
  }
  out.sort((a, b) => b.nodes - a.nodes);
  return out;
}

/**
 * THE THREE ANSWERS, for one arena.
 *
 * `sealed`   — legal components holding neither spawn.
 * `oneSided` — legal nodes reachable from exactly one spawn (0 on a symmetric map, and a
 *              fairness defect the moment it is not).
 * `band`     — floor a `BODY_VISUAL`-wide body could REACH FROM A SPAWN that a
 *              `BODY`-wide one cannot. Reachability on both sides, not mere legality:
 *              a room sealed to a 42 wu body and enterable by a 26 wu one belongs here.
 * `phantom`  — the band components that are POCKETS rather than collars.
 *
 * ── 🔴 THE COLLAR / POCKET SPLIT IS A DERIVED THRESHOLD, NOT A TASTE ONE ─────
 * Every prop carries a band of exactly `(BODY - BODY_VISUAL) / 2` wu — 8 wu today —
 * because that is how much wider the collision box is than the drawn character. So the
 * collar's depth is KNOWN, and it can never exceed it. A band component is a POCKET when
 * some cell in it is further than **one whole body (`BODY` wu)** from the nearest cell a
 * `BODY`-wide fighter can actually reach — five times the collar's own depth, and the
 * only length in the problem that is not invented here. Measured with a multi-source BFS
 * from the reachable set, so the threshold is a distance and not an area heuristic:
 * a long thin collar and a small square room have very different answers and an
 * area cutoff would confuse them.
 */
function analyse(arena) {
  const seeds = [arena.playerSpawn, arena.enemySpawn];
  const f = flood(arena, BODY, seeds);
  const [pC, eC] = f.seedComps;
  const sealed = f.comps.filter((c) => c.id !== pC && c.id !== eC).sort((a, b) => b.nodes - a.nodes);
  let oneSided = 0;
  if (pC !== eC) for (let i = 0; i < f.legal.length; i++) if (f.legal[i] && (f.label[i] === pC || f.label[i] === eC)) oneSided++;

  const v = flood(arena, BODY_VISUAL, seeds);
  const reachable = (g) => {
    const m = new Uint8Array(g.legal.length);
    for (let i = 0; i < g.legal.length; i++) if (g.legal[i] && (g.label[i] === g.seedComps[0] || g.label[i] === g.seedComps[1])) m[i] = 1;
    return m;
  };
  const r42 = reachable(f), r26 = reachable(v);
  const bandMask = new Uint8Array(f.legal.length);
  let band = 0;
  for (let i = 0; i < f.legal.length; i++) if (r26[i] && !r42[i]) { bandMask[i] = 1; band++; }
  const bandComps = components(bandMask, f.cols, f.rows);

  // Multi-source BFS: lattice distance from the set a real fighter can reach.
  const dist = new Int32Array(f.legal.length).fill(-1);
  const q = new Int32Array(f.legal.length);
  let h = 0, t = 0;
  for (let i = 0; i < r42.length; i++) if (r42[i]) { dist[i] = 0; q[t++] = i; }
  // 8-connected, i.e. a CHEBYSHEV distance. 4-connected would make the collar's depth at
  // a prop's convex corner the SUM of its two axes (16 wu, not 8) and the "a collar can
  // never be deeper than (BODY-BODY_VISUAL)/2" control would be false for a correct
  // probe. Caught by that control, which is what it is for.
  while (h < t) {
    const c = q[h++], cx = c % f.cols, cy = (c - cx) / f.cols;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || nx >= f.cols || ny < 0 || ny >= f.rows) continue;
      const ni = ny * f.cols + nx;
      if (dist[ni] >= 0) continue;
      dist[ni] = dist[c] + 1; q[t++] = ni;
    }
  }
  // ── ⚠️ THE COLLAR IS ONE CONNECTED COMPONENT AND IT SPANS THE WHOLE MAP ─────
  // Every prop's collar touches its neighbour's, and the 8 wu strip inside all four
  // arena walls joins the lot, so `bandComps` on the shipped kitchen is ONE region of
  // 102,448 wu² whose centroid is the map centre. Taking a max depth over that answers
  // nothing — it reports "the deepest point anywhere in the arena" and attributes it to
  // the middle of the map. The first draft did exactly that and called the whole collar a
  // phantom pocket. So the collar is ERODED AWAY FIRST: a cell survives only if it is
  // further from reachable space than a collar can possibly be, and the surviving cells
  // are re-componented. What is left is genuinely local.
  const collarBound = (BODY - BODY_VISUAL) / 2;
  const deepMask = new Uint8Array(f.legal.length);
  for (let i = 0; i < bandMask.length; i++) if (bandMask[i] && dist[i] * L > collarBound + L) deepMask[i] = 1;
  const deepComps = components(deepMask, f.cols, f.rows);
  const phantom = [];
  for (const c of deepComps) {
    const gx0 = Math.max(0, Math.floor(c.bbox[0] / L)), gx1 = Math.min(f.cols - 1, Math.ceil(c.bbox[2] / L));
    const gy0 = Math.max(0, Math.floor(c.bbox[1] / L)), gy1 = Math.min(f.rows - 1, Math.ceil(c.bbox[3] / L));
    let deepest = 0, at = null;
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const i = gy * f.cols + gx;
      if (deepMask[i] && dist[i] * L > deepest) { deepest = dist[i] * L; at = [(gx + 0.5) * L, (gy + 0.5) * L]; }
    }
    c.depthWu = deepest; c.deepestAt = at;
    if (deepest > BODY) phantom.push(c);
  }
  let collarDepth = 0;
  for (let i = 0; i < bandMask.length; i++) if (bandMask[i] && !deepMask[i] && dist[i] * L > collarDepth) collarDepth = dist[i] * L;
  return { f, v, sealed, oneSided, band, bandMask, bandComps, deepComps, phantom, collarDepth, collarBound, pC, eC };
}

/**
 * EVERY FACE-TO-FACE GAP, prop-to-prop and prop-to-wall — the ACTIONABLE form of the
 * phantom pocket, and the guard a layout edit is checked against.
 *
 * A phantom pocket is always produced by the same thing: two mesh faces that leave a gap
 * of more than `BODY_VISUAL` and less than `BODY`, over a run long enough to read as
 * floor. Anything at or below `BODY_VISUAL` is a slit — nothing can stand in it and
 * nothing looks like it could. Anything at or above `BODY` is a corridor. **In between is
 * the whole defect**, and it is a two-number test on the geometry rather than a flood, so
 * it names the two props to move instead of a centroid to hunt for.
 *
 * ⚠️ `minRun` exists because every pair of near-touching boxes produces a 2 wu tangential
 * sliver at its corner, which is not a gap anyone can see into. It defaults to
 * `BODY_VISUAL` — the run has to be at least as long as the character is wide before the
 * floor behind it reads as somewhere to go.
 */
function faceGaps(arena, lo = BODY_VISUAL, hi = BODY, minRun = BODY_VISUAL) {
  const out = [];
  const boxes = arena.cover.map((c, i) => ({ ...c, i }));
  const push = (kind, a, b, gap, run, at) => {
    if (gap > lo && gap < hi && run >= minRun) out.push({ kind, a, b, gap: +gap.toFixed(1), run: +run.toFixed(1), at });
  };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      const ovY = Math.min(A.y + A.h / 2, B.y + B.h / 2) - Math.max(A.y - A.h / 2, B.y - B.h / 2);
      const ovX = Math.min(A.x + A.w / 2, B.x + B.w / 2) - Math.max(A.x - A.w / 2, B.x - B.w / 2);
      if (ovY > 0) push('x', A, B, Math.abs(A.x - B.x) - (A.w + B.w) / 2, ovY,
        [(A.x + B.x) / 2, (Math.max(A.y - A.h / 2, B.y - B.h / 2) + Math.min(A.y + A.h / 2, B.y + B.h / 2)) / 2]);
      if (ovX > 0) push('y', A, B, Math.abs(A.y - B.y) - (A.h + B.h) / 2, ovX,
        [(Math.max(A.x - A.w / 2, B.x - B.w / 2) + Math.min(A.x + A.w / 2, B.x + B.w / 2)) / 2, (A.y + B.y) / 2]);
    }
    const A = boxes[i];
    const W = { kind: 'wall_w', x: 0, y: 0, w: 0, h: 0 };
    push('x', A, { kind: 'WALL west' }, A.x - A.w / 2, A.h, [A.x - A.w / 2, A.y]);
    push('x', A, { kind: 'WALL east' }, arena.width - (A.x + A.w / 2), A.h, [A.x + A.w / 2, A.y]);
    push('y', A, { kind: 'WALL north' }, A.y - A.h / 2, A.w, [A.x, A.y - A.h / 2]);
    push('y', A, { kind: 'WALL south' }, arena.height - (A.y + A.h / 2), A.w, [A.x, A.y + A.h / 2]);
    void W;
  }
  return out.sort((p, q) => p.gap - q.gap);
}

// ─────────────────────────────────────────────────────────────────────────────
// PNG — the mask, so the answer can be LOOKED at and not only read
// ─────────────────────────────────────────────────────────────────────────────
async function writePng(arena, a, path) {
  const sharp = (await import('sharp')).default;
  const SC = 1; // one image pixel per lattice cell
  const W = a.f.cols * SC, H = a.f.rows * SC;
  const buf = Buffer.alloc(W * H * 3);
  const put = (x, y, r, g, b) => { const i = (y * W + x) * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; };
  for (let gy = 0; gy < a.f.rows; gy++) {
    for (let gx = 0; gx < a.f.cols; gx++) {
      const i = gy * a.f.cols + gx;
      let c;
      if (a.f.legal[i]) c = a.f.label[i] === a.pC || a.f.label[i] === a.eC ? [30, 150, 90] : [230, 40, 40];
      else if (a.bandMask[i]) c = [250, 190, 60];
      else c = [40, 44, 55];
      put(gx, gy, c[0], c[1], c[2]);
    }
  }
  // Spawns, in white
  for (const s of [arena.playerSpawn, arena.enemySpawn]) {
    const sx = Math.round(s.x / L), sy = Math.round(s.y / L);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = sx + dx, y = sy + dy;
      if (x >= 0 && x < W && y >= 0 && y < H) put(x, y, 255, 255, 255);
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .resize({ width: W * 2, height: H * 2, kernel: 'nearest' })
    .png().toFile(path);
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the known-bad battery
//
// ⚠️ Every row here is paired: a layout the probe MUST fail on, and a control it MUST
// pass on. A probe that reported "pocket" for everything would pass half of these and is
// refused by the other half — which is the point of `docs/LESSONS.md` §13.
// ─────────────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

/** A bare box arena with the two spawns in opposite corners. */
function bare(cover = []) {
  return {
    width: 1400, height: 1000, center: { x: 700, y: 500 }, maxSafeRadius: 993,
    playerSpawn: { x: 160, y: 390 }, enemySpawn: { x: 1240, y: 610 },
    cover, hazards: [],
  };
}

/**
 * Four walls around the arena CENTRE, leaving a doorway of `gapWu` PHYSICAL wu in the
 * north wall. A fighter's centre needs `gapWu - BODY` of channel, so gap 120 is open, gap
 * 40 is sealed, and gap 30 is sealed but LOOKS open to a 26 wu body.
 *
 * ⚠️ It sits at the CENTRE and not near a wall, and that was a real selftest defect
 * rather than a preference: the first draft put the room at y=200 with its doorway facing
 * a north wall only 40 wu away, so the "open" control was sealed too — by the arena
 * bound, not by the doorway — and the probe was blamed for a broken fixture.
 */
function walledRoom(gapWu) {
  const cx = 700, cy = 500, r = 130, T = 60;
  const seg = (r * 2 - gapWu) / 2;
  return bare([
    { x: cx - (gapWu / 2 + seg / 2), y: cy - r, w: seg, h: T, kind: 'wall_n_l' },
    { x: cx + (gapWu / 2 + seg / 2), y: cy - r, w: seg, h: T, kind: 'wall_n_r' },
    { x: cx, y: cy + r, w: r * 2 + T, h: T, kind: 'wall_s' },
    { x: cx - r, y: cy, w: T, h: r * 2 + T, kind: 'wall_w' },
    { x: cx + r, y: cy, w: T, h: r * 2 + T, kind: 'wall_e' },
  ]);
}

async function selftest() {
  console.log(`\nap_reach --selftest   body ${BODY} wu (rules.ts:PLAYER_SIZE) · visual body ${BODY_VISUAL} wu · lattice ${L} wu\n`);

  // ── §A — the collision rule is the SIM's, pinned against movement.ts itself ──
  // Not a re-drawing: `tryMove` is imported and walked into a box, and `blocked()` must
  // agree with it cell for cell. The known-bad is a deliberately WRONG rule (half-extent
  // instead of full) which must disagree.
  console.log('§A — blocked() is movement.ts:collidesWithCover, not a second drawing of the cover');
  {
    // (i) THE PRIMITIVE. `collidesWithCover` is module-private, but it is `boxesOverlap`
    // inlined over the cover list and `boxesOverlap` IS exported — so this pins the
    // inequality itself against the sim's own copy rather than re-reading the comment
    // above it.
    const { boxesOverlap, tryMove } = await import(`${ROOT}/src/game/movement.ts`);
    const cover = [{ x: 700, y: 500, w: 200, h: 120, kind: 'box' }, { x: 300, y: 300, w: 55, h: 55, kind: 'small' }];
    let disagree = 0, n = 0;
    for (let x = 100; x <= 900; x += 3) for (let y = 100; y <= 700; y += 3) {
      const theirs = cover.some((o) => boxesOverlap(x, y, BODY, BODY, o.x, o.y, o.w, o.h));
      n++;
      if (theirs !== blocked(x, y, BODY, cover)) disagree++;
    }
    check(`blocked() == movement.ts:boxesOverlap on all ${n} probed cells`, disagree === 0, `${disagree} disagreements`);
    const wrong = (x, y, size, cv) => cv.some((o) => Math.abs(x - o.x) < (size + o.w) / 4 && Math.abs(y - o.y) < (size + o.h) / 4);
    let wrongDisagree = 0;
    for (let x = 100; x <= 900; x += 3) for (let y = 100; y <= 700; y += 3) {
      if (cover.some((o) => boxesOverlap(x, y, BODY, BODY, o.x, o.y, o.w, o.h)) !== wrong(x, y, BODY, cover)) wrongDisagree++;
    }
    check('KNOWN-BAD: a half-extent rule DISAGREES with boxesOverlap', wrongDisagree > 0,
      `${wrongDisagree} disagreements — a rule that could not disagree would prove nothing`);

    // (ii) END TO END. Walk a real `Fighter` east through the sim's own `tryMove` from a
    // start well clear of everything, and require it to stop exactly where `blocked()`
    // says the last legal centre is. This is the check that would catch `blocked()` being
    // right about geometry and wrong about what the MOVER does with it.
    const A = { ...bare(cover), build: () => null, update: () => {} };
    let stopMismatch = 0, walked = 0;
    for (let y = 440; y <= 560; y += 10) {
      const fighter = { x: 400, y, size: BODY };
      for (let s = 0; s < 400; s++) if (!tryMove(fighter, 1, 0, A)) break;
      let expect = 400;
      while (expect < 900 && !blocked(expect + 1, y, BODY, cover)) expect++;
      walked++;
      if (Math.abs(fighter.x - expect) > 1) stopMismatch++;
    }
    check(`a fighter walked east through tryMove stops where blocked() says, on all ${walked} rows`,
      stopMismatch === 0, `${stopMismatch} rows disagreed`);
  }

  // ── §B — a sealed pocket is FOUND, with the right area and centre ───────────
  console.log('\n§B — a walled-off room is reported, and an open one is not');
  {
    const sealedArena = walledRoom(40);            // 40 wu doorway: a 42 wu body cannot pass
    const a = analyse(sealedArena);
    check('KNOWN-BAD: a room with a 40 wu doorway is reported SEALED', a.sealed.length === 1,
      `got ${a.sealed.length} sealed components`);
    if (a.sealed.length === 1) {
      const p = a.sealed[0];
      // interior is 200x200 physical, minus the body's own half-width on each side => 158x158
      const expect = 158 * 158;
      check(`  its area is the interior minus the body collar (${Math.round(p.areaWu)} wu² vs ${expect} expected, ±12%)`,
        Math.abs(p.areaWu - expect) / expect < 0.12, `${Math.round(p.areaWu)} vs ${expect}`);
      check(`  its centre is the room's centre (${p.centre.map((n) => Math.round(n)).join(',')} vs 700,500)`,
        Math.hypot(p.centre[0] - 700, p.centre[1] - 500) < 12);
    }
    const openArena = walledRoom(120);             // 120 wu doorway: 78 wu of legal channel
    const b = analyse(openArena);
    check('CONTROL: the same room with a 120 wu doorway is NOT sealed', b.sealed.length === 0,
      `got ${b.sealed.length}`);
  }

  // ── §C — the PHANTOM pocket: visible floor, unreachable body ────────────────
  console.log('\n§C — a doorway wide enough to SEE through and too narrow to WALK through');
  {
    // 30 wu doorway: a 26 wu visual body fits, a 42 wu collision body does not. So the
    // room reads as enterable and is not — the exact defect Uri's sentence describes.
    const a = analyse(walledRoom(30));
    check('KNOWN-BAD: a 30 wu doorway yields a PHANTOM pocket (looks open, is not)',
      a.phantom.length >= 1, `phantom regions: ${a.phantom.length}`);
    check('  …and the same layout is also a hard SEALED pocket', a.sealed.length === 1, `sealed: ${a.sealed.length}`);
    check('  …and the pocket is deep, not a collar (> one body from anywhere standable)',
      (a.phantom[0]?.depthWu ?? 0) > BODY * 2, `depth ${a.phantom[0]?.depthWu ?? 0} wu`);
    // 120 wu: open to both bodies, so only the collar remains.
    const b = analyse(walledRoom(120));
    check('CONTROL: a 120 wu doorway yields NO phantom pocket', b.phantom.length === 0, `${b.phantom.length}`);
    check('CONTROL: …but its COLLAR band is still non-zero (the probe is not just returning 0)',
      b.band > 0, `${b.band} nodes`);
    check(`CONTROL: …and the collar is never deeper than (BODY-BODY_VISUAL)/2 + a lattice cell`,
      b.collarDepth <= (BODY - BODY_VISUAL) / 2 + L, `collar depth ${b.collarDepth} wu`);
  }

  // ── §D — the lattice cannot jump a wall ─────────────────────────────────────
  console.log('\n§D — the lattice cannot step over a thin wall');
  {
    // A wall 1 wu thick still inflates to BODY+1 = 43 wu of blocked centres, which is
    // 21 lattice cells at L=2. The flood must still separate the halves.
    const wall = bare([{ x: 700, y: 500, w: 1, h: 3000, kind: 'razor' }]);
    const a = analyse(wall);
    check('KNOWN-BAD: a 1 wu razor wall across the map separates the two spawns',
      a.pC !== a.eC, `player comp ${a.pC}, enemy comp ${a.eC}`);
    check('  …and every legal node is reported as reachable from exactly one spawn',
      a.oneSided > 0, `${a.oneSided}`);
  }

  // ── §E — the shipped arena, as the control ─────────────────────────────────
  //
  // ⚠️ EVERY ROW BELOW FAILED ON THE TREE THIS TOOL WAS WRITTEN AGAINST, which is why
  // they are here: 8 phantom pockets in 4 point-symmetric pairs, and 8 face gaps in the
  // 26..42 wu band that caused them. `kitchen.ts` rule 4 records the fix.
  console.log('\n§E — the shipped kitchen (the positive control this whole tool exists to report on)');
  {
    const arena = loadLayout();
    const a = analyse(arena);
    check('shipped: ZERO sealed pockets', a.sealed.length === 0, `${a.sealed.length}`);
    check('shipped: both spawns are in the SAME component', a.pC === a.eC, `${a.pC} vs ${a.eC}`);
    check('shipped: ZERO phantom pockets (was 8, in 4 point-symmetric pairs)', a.phantom.length === 0,
      `${a.phantom.length}: ${a.phantom.map((c) => `(${Math.round(c.centre[0])},${Math.round(c.centre[1])})`).join(' ')}`);
    const gaps = faceGaps(arena);
    check(`shipped: ZERO face gaps in the ${BODY_VISUAL}..${BODY} wu band (was 8)`, gaps.length === 0,
      gaps.map((g) => `${g.gap}wu ${g.a.kind}/${g.b.kind}`).join('; '));
    check('shipped: the collar band is measured and non-zero', a.band > 0, `${a.band} nodes`);
    check('shipped: no clearance up to +40 wu of body seals a pocket', [4, 8, 16, 24, 40].every((e) => {
      const g = flood(arena, BODY + e, [arena.playerSpawn, arena.enemySpawn]);
      return g.comps.filter((c) => c.id !== g.seedComps[0] && c.id !== g.seedComps[1]).length === 0;
    }), 'a pocket that only seals for a slightly bigger body is a pocket a nudged prop will seal');
  }

  // ── §F — 180° POINT SYMMETRY, on BOTH lists ────────────────────────────────
  //
  // `kitchen.ts:6`: *"laid out with true 180 degree point symmetry around the centre so
  // both spawns face an identical, fair map."* `DECISIONS §48` puts that in the same
  // category as `tools/aspect.mjs` — a COMPETITIVE-FAIRNESS constraint, not a style one —
  // and concealment is the newest and least-checked list on the arena.
  //
  // ⚠️ It runs on the BROWSER DUMP, not on the source. A source check would prove that
  // `x: ARENA_W - K` was typed correctly, which is the easy half; this proves the
  // geometry the game actually builds is symmetric, which is the half that matters.
  console.log('\n§F — 180° point symmetry of the shipped arena, both lists');
  {
    const arena = loadLayout();
    // ⚠️ **GEOMETRY ONLY, AND THAT DISTINCTION IS THE WHOLE POINT.** The first draft
    // matched on `kind` as well and failed on `fryer_counter@700,830` /
    // `sink_counter@700,170` — a pair that is EXACTLY point-symmetric in x, y, w and h
    // and deliberately different in art (one is a sink, one a fryer; `kitchen.ts` builds
    // them from the same call with a `variant`). Competitive fairness is about where the
    // collision boxes and the sightlines are, not about which prop art stands there, so a
    // checker that refuses the service line is refusing a design decision. Kind
    // mismatches are printed instead — they are a VFX/impact-sound asymmetry and worth
    // seeing, and they are not a fairness failure.
    const sym = (boxes, W, H) => {
      const key = (b) => `${b.w}x${b.h}`;
      const unmatched = [];
      const kindDiff = [];
      const pool = boxes.map((b) => ({ b, used: false }));
      for (const p of pool) {
        if (p.used) continue;
        const mx = W - p.b.x, my = H - p.b.y;
        if (Math.abs(p.b.x - mx) < 1e-6 && Math.abs(p.b.y - my) < 1e-6) { p.used = true; continue; } // self-symmetric (the pot)
        const m = pool.find((q) => !q.used && q !== p && key(q.b) === key(p.b)
          && Math.abs(q.b.x - mx) < 1e-6 && Math.abs(q.b.y - my) < 1e-6);
        if (!m) { unmatched.push(p.b); continue; }
        p.used = true; m.used = true;
        if (m.b.kind !== p.b.kind) kindDiff.push(`${p.b.kind}@${p.b.x},${p.b.y} <-> ${m.b.kind}@${m.b.x},${m.b.y}`);
      }
      return { unmatched, kindDiff };
    };
    const cov = sym(arena.cover, arena.width, arena.height);
    const con = sym(arena.concealment ?? [], arena.width, arena.height);
    check(`shipped: all ${arena.cover.length} COVER boxes are point-symmetric in x/y/w/h`, cov.unmatched.length === 0,
      cov.unmatched.map((b) => `${b.kind}@${b.x},${b.y}`).join(' '));
    check(`shipped: all ${(arena.concealment ?? []).length} CONCEALMENT boxes are point-symmetric in x/y/w/h`,
      con.unmatched.length === 0, con.unmatched.map((b) => `${b.kind}@${b.x},${b.y}`).join(' '));
    check('shipped: the arena declares concealment regions at all (Uri: "i can\'t hide")',
      (arena.concealment ?? []).length > 0, `${(arena.concealment ?? []).length}`);
    for (const d of [...cov.kindDiff, ...con.kindDiff]) console.log(`         note: mirrored pair with different art — ${d}`);

    // KNOWN-BAD. A symmetry checker that cannot fail is a comment with a tick next to it.
    const nudged = arena.concealment.map((b, i) => (i === 0 ? { ...b, x: b.x + 1 } : b));
    check('KNOWN-BAD: nudging ONE concealment box by 1 wu is caught',
      sym(nudged, arena.width, arena.height).unmatched.length > 0);
    const resized = arena.cover.map((b, i) => (i === 0 ? { ...b, w: b.w + 1 } : b));
    check('KNOWN-BAD: resizing ONE cover box by 1 wu is caught',
      sym(resized, arena.width, arena.height).unmatched.length > 0);
    check('KNOWN-BAD: deleting one half of a mirrored pair is caught',
      sym(arena.concealment.slice(1), arena.width, arena.height).unmatched.length > 0);
    check('KNOWN-BAD: a mirrored pair with different ART is REPORTED (and does not fail)',
      sym(arena.concealment.map((b, i) => (i === 1 ? { ...b, kind: 'other' } : b)), arena.width, arena.height).kindDiff.length > 0);
  }

  // ── §G — the AI's size ceiling and the endgame keepout, on the shipped regions ──
  //
  // `DECISIONS §29a`: `stepAI` has NO SEARCH BEHAVIOUR, so a region a player can cross
  // while staying inside is a permanent AI-denial zone. Both numbers come out of
  // `rules.ts` rather than being typed here, so a change to either constant moves this
  // gate rather than silently invalidating it.
  console.log('\n§G — every shipped region is inside the AI ceiling and outside the endgame keepout');
  {
    const arena = loadLayout();
    const rules = readFileSync(`${ROOT}/src/game/rules.ts`, 'utf8');
    const meleeHeavy = Number(/meleeHeavy:\s*([\d.]+)/.exec(rules)[1]);
    const endgameProgress = Number(/export const CONCEAL_ENDGAME_PROGRESS = ([\d.]+)/.exec(rules)[1]);
    const minSafe = Number(/export const MIN_SAFE_RADIUS = ([\d.]+)/.exec(rules)[1]);
    const ceiling = meleeHeavy * 2;
    const keepout = Math.max(minSafe, arena.maxSafeRadius * (1 - endgameProgress));
    const regions = arena.concealment ?? [];
    const tooBig = regions.filter((b) => Math.max(b.w, b.h) > ceiling);
    check(`every region is <= ${ceiling} wu across (CONCEAL_REVEAL_RADIUS x 2)`, tooBig.length === 0,
      tooBig.map((b) => `${b.kind} ${b.w}x${b.h}`).join(' '));
    const nearest = (b) => Math.hypot(
      Math.max(0, Math.abs(b.x - arena.center.x) - b.w / 2),
      Math.max(0, Math.abs(b.y - arena.center.y) - b.h / 2),
    );
    const inKeepout = regions.filter((b) => nearest(b) < keepout);
    check(`every region's NEAREST point is >= ${keepout.toFixed(2)} wu from centre`, inKeepout.length === 0,
      inKeepout.map((b) => `${b.kind}@${b.x},${b.y} nearest ${nearest(b).toFixed(1)}`).join(' '));
    const margins = regions.map(nearest).sort((a, b) => a - b);
    console.log(`         tightest region sits ${(margins[0] - keepout).toFixed(2)} wu outside the keepout`);

    // KNOWN-BAD, both ways.
    // ⚠️ Only w/h matter to the ceiling test, so its x/y are inert — moved to the x4 map
    //    anyway so nobody reads (260,375) as a live coordinate.
    check('KNOWN-BAD: a 300 wu region is refused by the ceiling',
      [{ x: 520, y: 750, w: 300, h: 300 }].filter((b) => Math.max(b.w, b.h) > ceiling).length === 1);
    check('KNOWN-BAD: a hub-placed region is refused by the keepout',
      nearest({ x: arena.center.x, y: arena.center.y, w: 120, h: 120 }) < keepout);
    // ⚠️ REBUILT for 6631446 (x4). Old fixture, kept because it is the one this check was
    //    written against: `{ x: 260, y: 500, w: 700, h: 120 }` on the 1400x1000 map, where
    //    keepout was 248.25 — centre 440 wu out (legal), nearest point 90 wu out (refused).
    //    On the x4 map the keepout is 496.25 and that same band's nearest point is **904 wu**
    //    from centre, so it is comfortably legal and the check asserted nothing at all. It
    //    did not fail quietly — it failed loudly, which is the only reason this is a fix
    //    and not an archaeology exercise.
    //    The x4 rebuild reproduces the ORIGINAL GEOMETRY rather than the original numbers:
    //    centre 700 wu out (>= 496.25, legal), near edge 350 wu out (< 496.25, refused).
    // 🚨 And the fixture now asserts BOTH halves. The old one only asserted `nearest <
    //    keepout`, which any band overlapping the hub satisfies — including one whose centre
    //    is also inside the keepout, i.e. one that a centre-only guard would ALSO refuse.
    //    That version could not have distinguished the two guards it exists to distinguish.
    {
      const band = { x: 700, y: 1000, w: 700, h: 120 };
      const bandCentre = Math.hypot(band.x - arena.center.x, band.y - arena.center.y);
      check('KNOWN-BAD: a BAND whose CENTRE is legal but whose near edge reaches the hub is refused',
        nearest(band) < keepout && bandCentre >= keepout,
        `nearest ${nearest(band).toFixed(1)} < ${keepout.toFixed(2)} <= centre ${bandCentre.toFixed(1)}`);
      check('  CONTROL: ...and a centre-only guard would have PASSED that same band',
        bandCentre >= keepout, 'which is the whole reason the guard reads the nearest point');
    }

    // Every region must be STANDABLE, or it is decoration you cannot get under.
    const f = flood(arena, BODY, [arena.playerSpawn, arena.enemySpawn]);
    for (const b of regions) {
      let inside = 0, standable = 0;
      for (let gy = 0; gy < f.rows; gy++) for (let gx = 0; gx < f.cols; gx++) {
        const x = (gx + 0.5) * L, y = (gy + 0.5) * L;
        if (Math.abs(x - b.x) >= b.w / 2 || Math.abs(y - b.y) >= b.h / 2) continue;
        inside++;
        if (f.legal[gy * f.cols + gx]) standable++;
      }
      check(`  ${b.kind}@${b.x},${b.y} is >= 95% standable (${(standable / inside * 100).toFixed(1)}%)`,
        standable / inside >= 0.95, `${standable}/${inside}`);
    }
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────

function loadLayout() {
  const path = String(arg('layout', `${ROOT}/tools/arena.gameplay.json`));
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (has('selftest')) {
  await selftest();
} else {
  const arena = loadLayout();
  const a = analyse(arena);
  const totalWu = arena.width * arena.height;
  console.log(`\n== ARENA REACHABILITY — ${arena.width}x${arena.height}, ${arena.cover.length} cover boxes`);
  console.log(`   body ${BODY} wu (rules.ts:PLAYER_SIZE) · drawn body ${BODY_VISUAL} wu · lattice ${L} wu\n`);

  console.log(`   1. SEALED POCKETS (nothing in the game can ever enter): ${a.sealed.length}`);
  for (const c of a.sealed) {
    console.log(`      ${Math.round(c.areaWu)} wu² (${(c.areaWu / totalWu * 100).toFixed(2)}% of the map) `
      + `centre (${Math.round(c.centre[0])},${Math.round(c.centre[1])}) `
      + `bbox x[${Math.round(c.bbox[0])}..${Math.round(c.bbox[2])}] y[${Math.round(c.bbox[1])}..${Math.round(c.bbox[3])}]`);
  }
  console.log(`      both spawns in the same component: ${a.pC === a.eC ? 'YES' : `NO — player #${a.pC}, enemy #${a.eC}`}`);
  console.log(`      legal standing space: ${Math.round(a.f.nLegal * L * L)} wu² = ${(a.f.nLegal * L * L / totalWu * 100).toFixed(1)}% of the map`);

  console.log(`\n   2. PHANTOM POCKETS (renderer shows open, sim blocks, deeper than a body): ${a.phantom.length}`);
  for (const c of a.phantom) {
    console.log(`      ${Math.round(c.areaWu)} wu² centre (${Math.round(c.centre[0])},${Math.round(c.centre[1])}) `
      + `deepest point (${c.deepestAt.map((n) => Math.round(n)).join(',')}) at ${c.depthWu} wu from anywhere standable `
      + `bbox x[${Math.round(c.bbox[0])}..${Math.round(c.bbox[2])}] y[${Math.round(c.bbox[1])}..${Math.round(c.bbox[3])}]`);
  }
  console.log(`      DEEP band regions (past the ${a.collarBound} wu collar) of any depth: ${a.deepComps.length}`);
  for (const c of a.deepComps.slice(0, 8)) {
    console.log(`        ${String(Math.round(c.areaWu)).padStart(6)} wu²  depth ${String(c.depthWu).padStart(3)} wu  centre (${Math.round(c.centre[0])},${Math.round(c.centre[1])})`);
  }
  console.log(`      COLLAR BAND (open to a ${BODY_VISUAL} wu body, blocked to a ${BODY} wu one):`);
  console.log(`        ${Math.round(a.band * L * L)} wu² = ${(a.band / a.v.nLegal * 100).toFixed(2)}% of the floor the drawn body would fit on`);
  console.log(`        = an invisible collar ${a.collarBound.toFixed(1)} wu (${(a.collarBound * 0.05).toFixed(2)} m) deep on every prop and every wall; measured max ${a.collarDepth} wu`);

  const gaps = faceGaps(arena);
  console.log(`\n   2b. THE CAUSE — face-to-face gaps wider than the DRAWN body (${BODY_VISUAL}) and`
    + ` narrower than the COLLIDING one (${BODY}): ${gaps.length}`);
  console.log(`       every one of these is floor you can see and can never stand on.`);
  for (const g of gaps) {
    console.log(`       ${g.gap.toFixed(1).padStart(5)} wu gap over ${String(Math.round(g.run)).padStart(4)} wu of run  `
      + `${g.a.kind}@${g.a.x},${g.a.y}  ${g.kind === 'x' ? '|' : '—'}  ${g.b.kind}${g.b.x !== undefined ? `@${g.b.x},${g.b.y}` : ''}`
      + `   at (${Math.round(g.at[0])},${Math.round(g.at[1])})`);
  }

  console.log(`\n   3. CLEARANCE — legal space lost as the body is inflated:`);
  const base = a.f.nLegal;
  for (const extra of [0, 4, 8, 16, 24, 40]) {
    const g = flood(arena, BODY + extra, [arena.playerSpawn, arena.enemySpawn]);
    const main = g.seedComps[0];
    const reach = g.comps.filter((c) => c.id === main || c.id === g.seedComps[1]).reduce((s, c) => s + c.nodes, 0);
    const sealedN = g.comps.filter((c) => c.id !== g.seedComps[0] && c.id !== g.seedComps[1]).length;
    console.log(`      +${String(extra).padStart(2)} wu  legal ${String(Math.round(g.nLegal * L * L)).padStart(7)} wu² `
      + `(${((g.nLegal / base) * 100).toFixed(1)}% of the ${BODY} wu figure)  reachable-from-a-spawn ${(reach / Math.max(1, g.nLegal) * 100).toFixed(1)}%  sealed pockets ${sealedN}`
      + `${g.seedComps[0] === g.seedComps[1] ? '' : '  ⚠️ SPAWNS SEPARATED'}`);
  }

  const png = arg('png', null);
  if (png) {
    const p = await writePng(arena, a, String(png));
    console.log(`\n   PNG: ${p}   green = reachable from a spawn · red = sealed · amber = the invisible collar · dark = solid`);
  }
  console.log('');
}
