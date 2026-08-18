#!/usr/bin/env node
/**
 * SPAWN PLACEMENT SEARCH — where do fighters 3..6 start?
 *
 * `ArenaDefinition` declared `playerSpawn` and `enemySpawn` only, and `sim.ts:defaultSpawn`
 * THREW for slot 2 and up rather than inventing a ring (`DECISIONS §49d`). This tool is the
 * search that produces the answer the sim was waiting for; `sp_gate.mjs` is the acceptance
 * test for what it produced. They are deliberately two files: a search that also grades
 * itself grades itself to the shape it found.
 *
 * ── WHY THREE PAIRS AND NOT SIX POINTS ──────────────────────────────────────
 * `kitchen.ts:6` — *"true 180° point symmetry around the centre so both spawns face an
 * identical, fair map"* — and `DECISIONS §48` puts that in the same category as
 * `tools/aspect.mjs`: a COMPETITIVE-FAIRNESS constraint, not a style one. Under a point
 * symmetry every spawn is paired with its 180° image, so **an odd count is impossible**: the
 * unpaired one would have to be its own image, i.e. sit exactly on the map centre, which is
 * inside the pot's 95 wu burn ring and inside the 248.25 wu endgame keep-out. The
 * concealment pass hit exactly this and landed 3 pairs for the same reason
 * (`kitchen.ts` §concealment: *"Five is IMPOSSIBLE here"*). So: **3 pairs, 6 seats.**
 *
 * ── 🔴 AND THE FAIRNESS THIS BUYS IS PAIRWISE, NOT GLOBAL. SAY IT OUT LOUD. ──
 * A C2-symmetric map admits exactly one exact statement: **seat 2k and seat 2k+1 see
 * congruent maps.** It cannot make pair A's seats congruent to pair B's, because that would
 * need the ARENA to be invariant under a 3-fold rotation and it is not (1400×1000, and the
 * props are placed in mirror pairs only). So the honest guarantee is:
 *
 *     seat0 ≡ seat1      seat2 ≡ seat3      seat4 ≡ seat5        (exact, by transform)
 *     pair A ≟ pair B    — NOT exact, and this tool MEASURES the residual
 *
 * That residual is the `classSpread` figure below: the largest disagreement between the
 * three pairs' sorted distance vectors to the other five seats. It is REPORTED, and it is
 * only a TIE-BREAK in the ranking — see the note above `results.sort`, where making it an
 * objective put three pairs in one bay at a minSep of 18.4 wu. It can never reach zero on
 * a C2 map anyway.
 *
 * ── THE HARD CONSTRAINTS, EVERY ONE FROM AN EXISTING GUARD ─────────────────
 *   legal      `movement.ts:collidesWithCover` — a 42 wu body, in bounds, off every CoverBox.
 *   runway     60 wu of clear travel in all four cardinals over a ±21 wu lateral band, and
 *              no cardinal run may STOP inside a damage hazard. This is
 *              `tools/tmp/spawn_runway.mjs`'s rule; the march here is ANALYTIC (nearest
 *              blocking face along the ray) because a 0.5 wu stepped march is ~25M box tests
 *              per candidate and this sweeps 327,561 of them at a 2 wu lattice.
 *              🚨 **THE ANALYTIC MARCH IS A PRE-FILTER, NOT THE ACCEPTANCE.** Every survivor
 *              is re-scored by the SHIPPED `spawn_runway.mjs --layout`, which is the tool
 *              that owns the rule (`sp_gate.mjs` §D runs it as a child process). `--selftest`
 *              §B pins the two against each other on 2,576 marches across the whole map, and
 *              the pre-filter carries a `RUNWAY_MARGIN` so a discretisation disagreement
 *              cannot promote a candidate.
 *   reach      same flood component as the shipped spawns at body 42 (`ap_reach.mjs`'s
 *              question 1). Geometry is untouched by this pass, so face gaps and phantom
 *              pockets cannot move — but a SPAWN in a pocket would be new, so it is checked.
 *   keepout    `max(MIN_SAFE_RADIUS, maxSafeRadius × (1 − CONCEAL_ENDGAME_PROGRESS))` =
 *              248.25 wu. Read from `rules.ts`, never typed in.
 *   conceal    `movement.ts:isConcealed` must be FALSE at the spawn — the sim's own
 *              predicate, imported, not redrawn. Starting the match already hidden is not a
 *              fairness defect on a symmetric map, but it is a design one: `stepAI` has no
 *              search behaviour, so a fighter that spawns concealed is invisible until it
 *              moves, and it would be 2 of the 6 seats and not the other 4.
 *              ⚠️ **THIS ONE IS A JUDGEMENT CALL WITH A PRICE TAG.** Dropping it extends the
 *              spawn bay east from x 195 to x 303 (concealment patch P1 covers x 195..325)
 *              and takes the best third-pair separation from **75.2 wu to 143.9** — clear of
 *              `REACH.rangedMax` (140), i.e. no weapon in the game would reach between two
 *              spawns. The cost is that pair C starts the match hidden. Reported to Uri.
 *   puddle     the body may not overlap a `slow` hazard. Same reasoning; this one IS a body
 *              test, because a `slow` hazard is a circle the fighter's box overlaps rather
 *              than a point predicate.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/sp_place.mjs --search --step 1 --min-sep 70   # the ranked triples
 *   node tools/tmp/sp_place.mjs --png shots/sp/admissible.png    # LOOK at it, do not read it
 *   node tools/tmp/sp_place.mjs --emit-layout <out> --spawns x,y;x,y
 *                                                    # a spawn_runway/ap_reach --layout fixture
 *   node tools/tmp/sp_place.mjs --selftest           # known-bad battery — OFFLINE, 0.14 s
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d); };
const has = (k) => argv.includes(`--${k}`);

// ── Constants, IMPORTED from rules.ts rather than typed in ──────────────────
//
// 🚨 **THESE WERE REGEXES OVER `rules.ts` SOURCE UNTIL 2026-08-18, AND §76 BROKE THEM —
// ONE OF THEM SILENTLY.** The old wording, kept because the rule it encoded is right and
// only the mechanism was wrong: *"Constants, read from rules.ts rather than typed in"*.
// Reading beats typing; **importing beats reading**, and here is the number that says so.
//
// `c5b9754` turned `export const MIN_SAFE_RADIUS = 140;` into
// `export const MIN_SAFE_RADIUS = tune('MIN_SAFE_RADIUS', 140, {…})`. The literal is still
// on the line, but it is no longer the first thing after the `=`, so
// `/export const MIN_SAFE_RADIUS = ([\d.]+)/` stopped matching and this file threw at import
// — taking `sp_gate`, `kx_seatfair` and `kx_fogcover` down with it, none of which scrape
// anything themselves.
//
// 🔴 **AND `PLAYER_SPEED` DID NOT THROW. IT KEPT WORKING, OFF A COMMENT.** §76 documented
// itself in `rules.ts`'s own header, and line 34 of that header reads, in prose:
//
//     * So nothing moved. `export const PLAYER_SPEED = 0.12` became
//
// The regex is unanchored, so it matched **line 34, a historical anecdote**, not line 633,
// the declaration. It returned 0.12 and was RIGHT — because the anecdote quotes the
// pre-§76 value. Set an override and this file would have gone on reporting the number the
// comment remembers while the sim ran on the tuned one, in green, forever. `MIN_RUNWAY_WU`
// below is `PLAYER_SPEED * 500`, so the whole runway minimum hung off that sentence.
//
// **A regex cannot be type-checked, cannot see a `tune()` wrapper, and cannot tell a
// declaration from a comment about one.** An import does all three. It is also how this file
// already loads `movement.ts` below, so nothing new is introduced.
const R = await import(`${ROOT}/src/game/rules.ts`);
export const PLAYER_SIZE = R.PLAYER_SIZE;
export const PLAYER_SPEED = R.PLAYER_SPEED;
const MIN_SAFE_RADIUS = R.MIN_SAFE_RADIUS;
const CONCEAL_ENDGAME_PROGRESS = R.CONCEAL_ENDGAME_PROGRESS;
for (const [k, v] of Object.entries({ PLAYER_SIZE, PLAYER_SPEED, MIN_SAFE_RADIUS, CONCEAL_ENDGAME_PROGRESS })) {
  // An import that resolves but exports nothing under that name yields `undefined`, which
  // arithmetics into `NaN` and prints as a plausible blank rather than as a failure.
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`sp_place: rules.ts exported no finite ${k} (got ${v})`);
}

/** `spawn_runway.mjs`'s own minimum: 0.5 s of held input. Derived the same way, from the same constant. */
export const MIN_RUNWAY_WU = Math.round(PLAYER_SPEED * 500);
/** The fighter's own half-width — the lateral band the runway must survive. */
const HALF = PLAYER_SIZE / 2;
/**
 * The analytic march can only disagree with the stepped one by less than one step, but a
 * pre-filter that promotes a candidate the acceptance test then rejects wastes a whole
 * measurement round. 4 wu is ~8 steps of slack and costs nothing: the survivors clear the
 * minimum by 20 wu and up.
 */
const RUNWAY_MARGIN = 4;
/**
 * 🚨 **THE HAZARD-STOP TEST NEEDS A MARGIN AND THE FIRST DRAFT DID NOT HAVE ONE.**
 * `spawn_runway.mjs` fails a run that stops with the fighter's CENTRE inside a damage
 * hazard, and `sim.ts` deals the damage on the same centre test (`dist < hazard.radius`).
 * Both are exact — and exactness is the problem here. The best bay cell the first draft
 * offered was (88,418), whose east corridor at lateral +21 stops flush on the pot's west
 * face at **95.2 wu from the pot centre against a 95 wu burn ring**: it passes by 0.2 wu,
 * and one wu further south it is the `60c5b92` pin again. That is precisely the failure
 * `kitchen.ts` rule 3 records — *"four wu of lateral drift, a tenth of a body"* — reappearing
 * as a PASS instead of as a FAIL.
 *
 * So the stop must clear the ring by a HALF BODY (21 wu): the same length the corridor band
 * itself is built from, and the length that makes the answer "the fighter's whole body is
 * out of the fire", not "its centre pixel is". It costs 2.5 wu of spawn separation
 * (80.1 -> 77.6) and buys a 21 wu tolerance to any future prop nudge.
 */
const HAZARD_MARGIN = PLAYER_SIZE / 2;

// ── The layout ──────────────────────────────────────────────────────────────
function loadLayout() {
  return JSON.parse(readFileSync(String(arg('layout', `${ROOT}/tools/arena.gameplay.json`)), 'utf8'));
}

/** `movement.ts:collidesWithCover`, one place only — same rule and same shape as `ap_reach.mjs:blocked`. */
export function blocked(x, y, size, cover) {
  for (let i = 0; i < cover.length; i++) {
    const o = cover[i];
    if (Math.abs(x - o.x) < (size + o.w) / 2 && Math.abs(y - o.y) < (size + o.h) / 2) return true;
  }
  return false;
}

/**
 * ANALYTIC MARCH — how far a body of `size` travels from (sx,sy) along a cardinal before a
 * CoverBox or the arena bound refuses the step, and where it ends up.
 *
 * `tryMove` tests the DESTINATION and does not slide, so the stop is the nearest inflated
 * face ahead on the ray. The stepped march in `spawn_runway.mjs` lands on a 0.5 wu lattice
 * just short of that face; this returns the exact face, which is >= the stepped answer by
 * less than one step. Hence `RUNWAY_MARGIN`.
 */
export function marchTo(sx, sy, dx, dy, size, arena) {
  const half = size / 2;
  let best = dx > 0 ? arena.width - half - sx
    : dx < 0 ? sx - half
      : dy > 0 ? arena.height - half - sy
        : sy - half;
  let stop = 'WALL';
  for (const o of arena.cover) {
    if (dx !== 0) {
      if (Math.abs(sy - o.y) >= (size + o.h) / 2) continue;      // ray misses this box's band
      const face = dx > 0 ? (o.x - (size + o.w) / 2) - sx : sx - (o.x + (size + o.w) / 2);
      if (face >= 0 && face < best) { best = face; stop = o; }
    } else {
      if (Math.abs(sx - o.x) >= (size + o.w) / 2) continue;
      const face = dy > 0 ? (o.y - (size + o.h) / 2) - sy : sy - (o.y + (size + o.h) / 2);
      if (face >= 0 && face < best) { best = face; stop = o; }
    }
  }
  return { d: Math.max(0, best), at: { x: sx + dx * Math.max(0, best), y: sy + dy * Math.max(0, best) }, stop };
}

const CARDINALS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/**
 * The WORST runway over the ±band corridor, per cardinal, and whether any run in the
 * corridor stops inside a damage hazard.
 *
 * ⚠️ Every offset's stop is hazard-checked, not only the worst-distance one. That is
 * STRICTER than `spawn_runway.mjs`, which checks the worst offset and the centre ray. A
 * pre-filter may be stricter than the acceptance test; it may not be looser.
 */
export function corridor(spawn, arena, size = PLAYER_SIZE, band = HALF, step = 0.5) {
  const damage = arena.hazards.filter((h) => h.kind === 'damage');
  let worst = Infinity;
  let hazardStop = null;
  for (const [dx, dy] of CARDINALS) {
    for (let o = -band; o <= band + 1e-9; o += step) {
      const r = marchTo(spawn.x + (dx === 0 ? o : 0), spawn.y + (dy === 0 ? o : 0), dx, dy, size, arena);
      if (r.d < worst) worst = r.d;
      if (!hazardStop) {
        const hz = damage.find((h) => Math.hypot(r.at.x - h.x, r.at.y - h.y) <= h.radius + HAZARD_MARGIN);
        if (hz) hazardStop = { dir: [dx, dy], off: o, hz, clearance: Math.hypot(r.at.x - hz.x, r.at.y - hz.y) - hz.radius };
      }
    }
  }
  return { worst, hazardStop };
}

/** The endgame annulus, from `rules.ts` — the same expression `ap_reach --selftest` §G uses. */
export function keepoutRadius(arena) {
  return Math.max(MIN_SAFE_RADIUS, arena.maxSafeRadius * (1 - CONCEAL_ENDGAME_PROGRESS));
}

/**
 * ⚠️ **CONCEALMENT IS TESTED WITH THE SIM'S OWN PREDICATE, AND THE FIRST DRAFT'S WAS WRONG
 * IN THE EXPENSIVE DIRECTION.** `movement.ts:isConcealed` calls
 * `boxesOverlap(x, y, 0, 0, …)` — the fighter is a POINT, not a 42 wu box, so "does this
 * spawn start the match hidden?" is exactly "is its centre inside a region?". The draft here
 * required the whole BODY to clear the patch, which is 21 wu stricter on every side and cut
 * the west spawn bay from 212 wu wide to 84 — i.e. it deleted the only place a third pair
 * could have gone, for a rule the game does not have.
 */
const { isConcealed } = await import(`${ROOT}/src/game/movement.ts`);

/** Every hard constraint, in one place, returning the REASON it failed. */
export function violations(spawn, arena) {
  const out = [];
  const half = PLAYER_SIZE / 2;
  if (spawn.x < half || spawn.x > arena.width - half || spawn.y < half || spawn.y > arena.height - half) out.push('out-of-bounds');
  if (blocked(spawn.x, spawn.y, PLAYER_SIZE, arena.cover)) out.push('inside-cover');
  // ⚠️ RETURN EARLY ONLY FOR THE TWO THAT MAKE THE MARCH MEANINGLESS. The first draft
  // returned early for ALL of them, which silently made every sensitivity sweep wrong:
  // "how many cells fail ONLY on concealment" counted cells whose runway had never been
  // computed at all, and reported 8,430 where the honest answer is 1,688. A short-circuit
  // in a REASON list is not the same optimisation as a short-circuit in a boolean.
  if (out.length) return out;
  const r = Math.hypot(spawn.x - arena.center.x, spawn.y - arena.center.y);
  if (r < keepoutRadius(arena)) out.push(`inside-keepout(${r.toFixed(1)}<${keepoutRadius(arena).toFixed(2)})`);
  if (isConcealed(spawn.x, spawn.y, arena)) {
    const b = (arena.concealment ?? []).find((r) => Math.abs(spawn.x - r.x) < r.w / 2 && Math.abs(spawn.y - r.y) < r.h / 2);
    out.push(`in-concealment(${b?.kind}@${b?.x},${b?.y})`);
  }
  for (const h of arena.hazards) {
    if (h.kind !== 'slow') continue;
    if (Math.hypot(spawn.x - h.x, spawn.y - h.y) < h.radius + half) out.push(`in-slow-hazard(${h.x},${h.y})`);
  }
  const c = corridor(spawn, arena);
  if (c.worst < MIN_RUNWAY_WU + RUNWAY_MARGIN) out.push(`runway(${c.worst.toFixed(1)}<${MIN_RUNWAY_WU}+${RUNWAY_MARGIN})`);
  if (c.hazardStop) out.push(`run-stops-in-hazard(r=${c.hazardStop.hz.radius}, clearance ${c.hazardStop.clearance.toFixed(1)} < ${HAZARD_MARGIN})`);
  return out;
}

// ── Reachability: the flood, on the same lattice rule as ap_reach ───────────
const L = 2;
export function floodComponent(arena, size, seed) {
  const cols = Math.floor(arena.width / L), rows = Math.floor(arena.height / L);
  const half = size / 2;
  const legal = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = (gx + 0.5) * L, y = (gy + 0.5) * L;
      legal[gy * cols + gx] = x >= half && x <= arena.width - half && y >= half && y <= arena.height - half
        && !blocked(x, y, size, arena.cover) ? 1 : 0;
    }
  }
  const seen = new Uint8Array(cols * rows);
  const q = new Int32Array(cols * rows);
  const gx0 = Math.max(0, Math.min(cols - 1, Math.floor(seed.x / L)));
  const gy0 = Math.max(0, Math.min(rows - 1, Math.floor(seed.y / L)));
  let h = 0, t = 0;
  if (legal[gy0 * cols + gx0]) { q[t++] = gy0 * cols + gx0; seen[gy0 * cols + gx0] = 1; }
  while (h < t) {
    const c = q[h++], cx = c % cols, cy = (c - cx) / cols;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!legal[ni] || seen[ni]) continue;
      if (ox && oy && (!legal[cy * cols + nx] || !legal[ny * cols + cx])) continue;
      seen[ni] = 1; q[t++] = ni;
    }
  }
  return { cols, rows, legal, seen, at: (p) => seen[Math.max(0, Math.min(rows - 1, Math.floor(p.y / L))) * cols + Math.max(0, Math.min(cols - 1, Math.floor(p.x / L)))] === 1 };
}

// ── The search ──────────────────────────────────────────────────────────────

export const mirror = (p, arena) => ({ x: arena.width - p.x, y: arena.height - p.y });

/**
 * The objective. Two terms, both of them a fairness statement rather than a taste one:
 *
 *   minSep      the smallest distance between any two of the six seats. `MIN_SAFE_RADIUS`
 *               is 140 wu and does NOT scale with the arena (`DECISIONS §48`), so six
 *               bodies end the match inside a 140 wu disc no matter what — but the OPENING
 *               should not already be a scrum. Maximised.
 *   classSpread the residual inter-pair unfairness described in the header: the largest
 *               element-wise disagreement between any two pairs' sorted distance vectors to
 *               the other five seats, in wu. Minimised. It cannot reach 0 on a C2 map.
 *   radiusSpread max−min of the three pairs' distance from centre. The fog closes on the
 *               centre, so an unequal radius is an unequal countdown. Minimised.
 */
export function score(spawns) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let minSep = Infinity;
  for (let i = 0; i < spawns.length; i++) for (let j = i + 1; j < spawns.length; j++) minSep = Math.min(minSep, d(spawns[i], spawns[j]));
  const vec = spawns.map((_, i) => spawns.filter((__, j) => j !== i).map((o) => d(spawns[i], o)).sort((a, b) => a - b));
  // `classSpread` compares one seat per PAIR, so it is only defined on a complete set of
  // pairs. An odd or truncated list (an N=3 or N=5 seating) has no pairing to compare and
  // gets `null` rather than a number computed off the end of the array — which is what the
  // first draft did, and it threw instead of lying, which is the lucky half of that bug.
  let classSpread = null;
  if (spawns.length % 2 === 0) {
    const classes = [];
    for (let i = 0; i < spawns.length; i += 2) classes.push(vec[i]);
    classSpread = 0;
    for (let a = 0; a < classes.length; a++) for (let b = a + 1; b < classes.length; b++) {
      for (let k = 0; k < classes[a].length; k++) classSpread = Math.max(classSpread, Math.abs(classes[a][k] - classes[b][k]));
    }
  }
  return { minSep, classSpread, vec };
}

function search(arena, topN) {
  const MIN_SEP_CUT = Number(arg('min-sep', 0));
  const shipped = [arena.playerSpawn, arena.enemySpawn];
  const comp = floodComponent(arena, PLAYER_SIZE, shipped[0]);
  const keep = keepoutRadius(arena);
  const STEP = Number(arg('step', 10));

  // Candidates in the HALF-PLANE only; the other half is the transform's image, so a
  // candidate list built over the whole map would double-count every pair.
  const half = [];
  const all = [];
  for (let y = 0; y <= arena.height; y += STEP) {
    for (let x = 0; x <= arena.width; x += STEP) {
      const p = { x, y };
      if (violations(p, arena).length) continue;
      if (!comp.at(p)) continue;
      all.push(p);
      if (y < arena.height / 2 || (y === arena.height / 2 && x < arena.width / 2)) half.push(p);
    }
  }

  // ⚠️ SELF-CHECK, and it is not decoration: every hard constraint above is defined on a
  // point-symmetric arena, so the surviving candidate SET must itself be point-symmetric.
  // If it is not, one of the constraints is reading something asymmetric — which is exactly
  // the class of bug this whole pass exists to prevent.
  const key = (p) => `${p.x},${p.y}`;
  const seen = new Set(all.map(key));
  const asym = all.filter((p) => !seen.has(key(mirror(p, arena))));
  if (asym.length) {
    console.error(`\n🚨 sp_place: the CANDIDATE SET is not point-symmetric — ${asym.length} of ${all.length} have no mirror.`);
    console.error(`   e.g. ${asym.slice(0, 6).map(key).join(' ')}`);
    console.error('   A constraint is reading something asymmetric. Do not trust anything below.');
    process.exitCode = 1;
  }

  const A0 = shipped[0], A1 = shipped[1];
  const results = [];
  for (let i = 0; i < half.length; i++) {
    for (let j = i + 1; j < half.length; j++) {
      const B0 = half[i], C0 = half[j];
      const six = [A0, A1, B0, mirror(B0, arena), C0, mirror(C0, arena)];
      // ⚠️ THE FIRST DRAFT HARD-CODED THIS CUT AT 220 wu AND THE SEARCH PRINTED
      // "0 triples cleared every hard constraint" — which reads exactly like the
      // CONSTRAINTS being unsatisfiable rather than like the RANKING FILTER being set above
      // what the map can deliver. On this arena the ceiling is 77.6 wu, so 220 discarded
      // every valid answer silently. A cut that can hide the whole result set has to be a
      // flag with a printed value. It is also the cheap prune: `minSep` is 15 hypots and
      // `score`'s distance vectors are not, so it runs first.
      let minSep = Infinity;
      for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
        const d = Math.hypot(six[a].x - six[b].x, six[a].y - six[b].y);
        if (d < minSep) minSep = d;
      }
      if (minSep < MIN_SEP_CUT) continue;
      const s = score(six);
      const radii = [A0, B0, C0].map((p) => Math.hypot(p.x - arena.center.x, p.y - arena.center.y));
      const radiusSpread = Math.max(...radii) - Math.min(...radii);
      results.push({ six, minSep: s.minSep, classSpread: s.classSpread, radiusSpread, radii });
    }
  }
  // 🔴 **A WEIGHTED SUM WAS TRIED FIRST AND IT WAS PERVERSE.**
  // `rank = minSep − 0.75·classSpread − 0.5·radiusSpread` put THREE PAIRS IN ONE BAY at the
  // top of the table: piling every seat into the same 114 × 40 wu box makes the three pairs
  // nearly congruent, so `classSpread` collapses to ~13 wu and the sum wins — while `minSep`
  // is **18.4 wu**, i.e. half a body. The residual terms measure how EQUAL the seats are and
  // say nothing about whether the opening is playable, so trading real separation for a
  // smaller residual is exactly the wrong trade, and a scalarised objective cannot express
  // that. Separation is therefore the SORT KEY and the residuals are TIE-BREAKS only.
  results.sort((a, b) => (b.minSep - a.minSep) || (a.classSpread - b.classSpread) || (a.radiusSpread - b.radiusSpread));

  console.log(`\n== SPAWN PLACEMENT SEARCH — ${arena.width}x${arena.height}, ${arena.cover.length} cover boxes, ${(arena.concealment ?? []).length} concealment regions`);
  console.log(`   body ${PLAYER_SIZE} wu · runway >= ${MIN_RUNWAY_WU} wu (+${RUNWAY_MARGIN} pre-filter margin) over a ±${HALF} wu band · keep-out ${keep.toFixed(2)} wu`);
  console.log(`   lattice ${STEP} wu · ${all.length} legal candidates (${half.length} in the half-plane) · candidate set point-symmetric: ${asym.length === 0 ? 'YES' : 'NO'}`);
  console.log(`   ranking cut: minSep >= ${MIN_SEP_CUT} wu (--min-sep) · sorted by minSep, classSpread and radiusSpread break ties`);
  console.log(`   pair A is FIXED at the shipped spawns (${A0.x},${A0.y}) / (${A1.x},${A1.y}) — slots 0/1 must not move (bit-identity)\n`);
  console.log(`   ${'pair B'.padEnd(12)} ${'pair C'.padEnd(12)} ${'minSep'.padStart(7)} ${'classSpread'.padStart(11)} ${'radSpread'.padStart(9)} ${'radii A/B/C'.padStart(22)}`);
  for (const r of results.slice(0, topN)) {
    console.log(`   ${`${r.six[2].x},${r.six[2].y}`.padEnd(12)} ${`${r.six[4].x},${r.six[4].y}`.padEnd(12)} `
      + `${r.minSep.toFixed(1).padStart(7)} ${r.classSpread.toFixed(1).padStart(11)} ${r.radiusSpread.toFixed(1).padStart(9)} `
      + `${r.radii.map((n) => n.toFixed(0)).join(' / ').padStart(22)}`);
  }
  console.log(`\n   ${results.length} triples cleared every hard constraint.\n`);
  return results;
}

// ── --emit-layout: a fixture for the tools that own the rules ───────────────
function emitLayout(arena, spawns, path) {
  // `spawn_runway.mjs --layout` and `ap_reach.mjs --layout` both read `playerSpawn` /
  // `enemySpawn`, so a 6-spawn set is scored as THREE fixtures, one per pair. That is not a
  // workaround: it is what keeps the rule in the tool that owns it instead of copied here.
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...arena, playerSpawn: spawns[0], enemySpawn: spawns[1] }, null, 2)}\n`);
  return path;
}

// ── THE PICTURE ─────────────────────────────────────────────────────────────
/**
 * One image pixel per 2 wu. Judging this from the numbers alone is exactly the failure this
 * project names most often, and the picture is what makes "there are only two places on the
 * whole map" believable rather than asserted.
 *
 *   dark slate  blocked to a 42 wu body (cover collar + the wall collar)
 *   grey        legal standing space
 *   dim red     legal, but REFUSED as a spawn (runway / keep-out / concealment / hazard)
 *   green       ADMISSIBLE spawn cell — every hard constraint clear
 *   yellow      the concealment regions
 *   orange ring the 248.25 wu endgame keep-out
 *   white       the six chosen spawns
 */
async function writePng(arena, chosen, path) {
  const sharp = (await import('sharp')).default;
  const S = 2;
  const W = Math.floor(arena.width / S), H = Math.floor(arena.height / S);
  const buf = Buffer.alloc(W * H * 3);
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
  const keep = keepoutRadius(arena);
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const x = (gx + 0.5) * S, y = (gy + 0.5) * S;
      const half = PLAYER_SIZE / 2;
      const inB = x >= half && x <= arena.width - half && y >= half && y <= arena.height - half;
      let c;
      if (!inB || blocked(x, y, PLAYER_SIZE, arena.cover)) c = [38, 42, 52];
      else c = violations({ x, y }, arena).length === 0 ? [40, 210, 90] : [120, 46, 46];
      if (isConcealed(x, y, arena) && c[1] < 200) c = [c[0] + 60, c[1] + 55, 30];
      const r = Math.hypot(x - arena.center.x, y - arena.center.y);
      if (Math.abs(r - keep) < S) c = [235, 150, 40];
      put(gx, gy, c);
    }
  }
  chosen.forEach((s, i) => {
    const sx = Math.round(s.x / S), sy = Math.round(s.y / S);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (Math.hypot(dx, dy) > 4) continue;
      put(sx + dx, sy + dy, Math.hypot(dx, dy) > 2.4 ? [0, 0, 0] : [255, 255, 255]);
    }
    void i;
  });
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .resize({ width: W * 2, height: H * 2, kernel: 'nearest' }).png().toFile(path);
  return path;
}

// ── SELFTEST ────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

async function selftest() {
  const arena = loadLayout();
  console.log(`\nsp_place --selftest   body ${PLAYER_SIZE} wu · runway ${MIN_RUNWAY_WU} wu · keep-out ${keepoutRadius(arena).toFixed(2)} wu\n`);

  // §A — the collision rule is the SIM's, not a second drawing of the cover.
  console.log('§A — blocked() is movement.ts:boxesOverlap');
  {
    const { boxesOverlap } = await import(`${ROOT}/src/game/movement.ts`);
    const cover = [{ x: 700, y: 500, w: 200, h: 120 }, { x: 300, y: 300, w: 55, h: 55 }];
    let n = 0, dis = 0;
    for (let x = 100; x <= 900; x += 3) for (let y = 100; y <= 700; y += 3) {
      n++;
      if (cover.some((o) => boxesOverlap(x, y, PLAYER_SIZE, PLAYER_SIZE, o.x, o.y, o.w, o.h)) !== blocked(x, y, PLAYER_SIZE, cover)) dis++;
    }
    check(`blocked() == boxesOverlap on all ${n} cells`, dis === 0, `${dis} disagreements`);
    const wrong = (x, y, cv) => cv.some((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 4 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 4);
    let wd = 0;
    for (let x = 100; x <= 900; x += 3) for (let y = 100; y <= 700; y += 3) {
      if (cover.some((o) => boxesOverlap(x, y, PLAYER_SIZE, PLAYER_SIZE, o.x, o.y, o.w, o.h)) !== wrong(x, y, cover)) wd++;
    }
    check('KNOWN-BAD: a half-extent rule disagrees with boxesOverlap', wd > 0, `${wd}`);
  }

  // §B — the ANALYTIC march equals the SHIPPED tool's stepped one.
  //
  // This is the row that makes the pre-filter admissible. `spawn_runway.mjs` owns the rule;
  // this file only owns a faster way to ask it, and a faster way that gave a different
  // answer would silently promote a candidate the gate then rejects — or, far worse, one it
  // accepts for the wrong reason.
  console.log('\n§B — the analytic march agrees with spawn_runway.mjs\'s stepped one');
  {
    const step = (sx, sy, dx, dy) => {                        // spawn_runway.mjs's march(), verbatim
      const half = PLAYER_SIZE / 2;
      let d = 0;
      for (;;) {
        const nd = d + 0.5;
        const x = sx + dx * nd, y = sy + dy * nd;
        if (x < half || x > arena.width - half || y < half || y > arena.height - half) break;
        if (arena.cover.find((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2)) return d;
        d = nd;
        if (d > 4000) break;
      }
      return d;
    };
    let worst = 0, n = 0;
    for (let x = 60; x <= arena.width - 60; x += 37) {
      for (let y = 60; y <= arena.height - 60; y += 29) {
        if (blocked(x, y, PLAYER_SIZE, arena.cover)) continue;
        for (const [dx, dy] of CARDINALS) {
          const a = marchTo(x, y, dx, dy, PLAYER_SIZE, arena).d;
          const b = step(x, y, dx, dy);
          worst = Math.max(worst, Math.abs(a - b)); n++;
        }
      }
    }
    check(`analytic == stepped within one 0.5 wu step on all ${n} marches (worst ${worst.toFixed(3)} wu)`, worst < 0.5 + 1e-9, `${worst}`);
    check('  …and the margin covers it', RUNWAY_MARGIN > worst, `margin ${RUNWAY_MARGIN} vs worst ${worst}`);
    // KNOWN-BAD: a march that ignores the body's own width agrees with nothing.
    const naive = (sx, sy, dx, dy) => marchTo(sx, sy, dx, dy, 0, arena).d;
    let nd = 0;
    for (let x = 60; x <= arena.width - 60; x += 37) for (let y = 60; y <= arena.height - 60; y += 29) {
      if (blocked(x, y, PLAYER_SIZE, arena.cover)) continue;
      for (const [dx, dy] of CARDINALS) if (Math.abs(naive(x, y, dx, dy) - step(x, y, dx, dy)) > 0.5) nd++;
    }
    check('KNOWN-BAD: a POINT march (body 0) disagrees with the stepped body march', nd > 0, `${nd}`);
  }

  // §C — the shipped spawns pass every constraint this tool applies.
  console.log('\n§C — the shipped spawns are a positive control for every constraint');
  {
    for (const [who, s] of [['player', arena.playerSpawn], ['enemy', arena.enemySpawn]]) {
      const v = violations(s, arena);
      check(`${who} spawn (${s.x},${s.y}) clears every hard constraint`, v.length === 0, v.join(' '));
    }
    // KNOWN-BAD, one per constraint, so none of them can be a comment with a tick next to it.
    // ── THE TWO ROWS THAT PROVE AN ODD SPAWN COUNT IS IMPOSSIBLE ──────────────
    // Under a 180° point symmetry an unpaired spawn must be its own mirror image, i.e. sit
    // EXACTLY on the arena centre. The centre is inside the boiling pot's CoverBox, and
    // everything within 248.25 wu of it is inside the endgame keep-out. So the refusal is
    // geometric, not stylistic, and it is checked at both radii.
    check('KNOWN-BAD: the map CENTRE — the only possible unpaired spawn — is inside the pot',
      violations({ ...arena.center }, arena).includes('inside-cover'), violations({ ...arena.center }, arena).join(' '));
    check('KNOWN-BAD: …and a legal cell 120 wu off it is still refused by the keep-out',
      violations({ x: arena.center.x, y: arena.center.y + 120 }, arena).some((v) => v.startsWith('inside-keepout')),
      violations({ x: arena.center.x, y: arena.center.y + 120 }, arena).join(' '));
    // ⚠️ ALL FOUR COORDINATES BELOW WERE REBUILT for `6631446` (1400x1000 -> 2800x2000).
    //    Old fixtures, kept because they are what these rows were proved on and because two
    //    of them are the reason this comment exists:
    //      freezer      (230, 190)   — the 1x freezer's own box
    //      west wall    (  5, 500)
    //      concealment  (260, 375)
    //      grease       (560, 900)
    //    🚨 THE INTERESTING PART IS WHICH ONES SURVIVED. `(5, 500)` still says out-of-bounds
    //    and `(230, 190)` still says inside-cover — the second **by luck**: an x4 freezer
    //    happens to sit at (300,300) and (230,190) clips its corner. Two rows went on
    //    passing while pointing at nothing anybody chose. The other two failed loudly, which
    //    is the only reason the pair above was ever looked at. **A green row is not evidence
    //    its fixture is still aimed at something.**
    //    Each replacement is now pinned to a NAMED feature of the shipped dump rather than
    //    to a coordinate that used to be one, so the next map change fails them all together.
    check('KNOWN-BAD: a spawn inside the freezer is refused (cover)',
      violations({ x: 300, y: 300 }, arena).includes('inside-cover'));
    check('KNOWN-BAD: a spawn 5 wu from the west wall is refused (out-of-bounds)',
      violations({ x: 5, y: arena.center.y }, arena).includes('out-of-bounds'));
    // `arena.concealment[0]` — asserted to BE a patch, so this cannot go stale silently.
    {
      const patch = arena.concealment[0];
      check(`KNOWN-BAD: a spawn on a concealment patch is refused (${patch.kind}@${patch.x},${patch.y})`,
        violations({ x: patch.x, y: patch.y }, arena).some((v) => v.startsWith('in-concealment')));
    }
    // 🚨 THE SLOW-HAZARD ROW CANNOT BE WRITTEN AS A COORDINATE ON THIS MAP AT ALL, and the
    //    reason is a finding rather than an inconvenience.
    //
    //    `violations()` returns EARLY on `inside-cover` (see its own comment: the two that
    //    make the march meaningless). So a spawn buried in a prop never reaches the
    //    slow-hazard branch. And on `ec4f5af` **both slow puddles are entirely buried**:
    //    swept at 1 wu with the sim's own predicate, **0 of 7,845 cells inside either 50 wu
    //    puddle disc is legal standing ground**, and over the full 71 wu slow FIELD
    //    (`radius + half a body`, the distance this very branch tests) exactly **1 of
    //    15,813** is. Three props bury each — a hub stove island plus two crates. The
    //    nearest legal reachable ground to a puddle centre is **75 wu**, i.e. outside the
    //    field. Two slow hazards that no fighter can enter are dead content; that is a
    //    `src/arena/kitchen.ts` defect and is reported, not worked around here.
    //
    //    Earlier fixtures, kept as the record of the coordinate chase this replaces:
    //      (560, 900)   — the 1x grease puddle. Not a puddle at any scale on the x4 map.
    //      (1860, 1220) — correct on `6631446`, buried by a crate `21fb6be` moved. It was
    //                     right for ONE COMMIT.
    //
    //    So the row is rebuilt to test the RULE instead of hunting a cell: inject a slow
    //    hazard onto ground that is known-clean — the shipped player spawn, which the
    //    positive control above has just proved clears every constraint — and require the
    //    branch to fire. That is map-independent by construction, and the un-injected arena
    //    is its own control, so the injection is provably what caused the refusal.
    {
      const clean = { ...arena.playerSpawn };
      const withPuddle = { ...arena, hazards: [...arena.hazards, { x: clean.x, y: clean.y, radius: 50, kind: 'slow', slowFactor: 0.45 }] };
      check('  CONTROL: the shipped player spawn has NO violations on the shipped arena',
        violations(clean, arena).length === 0, violations(clean, arena).join(' '));
      check('KNOWN-BAD: …and a slow puddle dropped on that exact spawn refuses it',
        violations(clean, withPuddle).some((v) => v.startsWith('in-slow-hazard')),
        violations(clean, withPuddle).join(' '));
      check('  CONTROL: …and the puddle is the ONLY reason it is refused',
        violations(clean, withPuddle).length === 1, violations(clean, withPuddle).join(' '));
      // …and the census that produced the finding above, printed rather than asserted.
      // ⚠️ NOT an assertion: a row that asserts a defect's PRESENCE goes red the day it is
      //    fixed (`as_cost`'s A1 is exactly that trap, live right now). Printed so it is
      //    visible on every run and cannot become a lie.
      for (const h of arena.hazards.filter((z) => z.kind === 'slow')) {
        let cells = 0, legal = 0;
        for (let x = Math.round(h.x - h.radius); x <= h.x + h.radius; x++) {
          for (let y = Math.round(h.y - h.radius); y <= h.y + h.radius; y++) {
            if (Math.hypot(x - h.x, y - h.y) > h.radius) continue;
            cells++;
            if (!blocked(x, y, PLAYER_SIZE, arena.cover)) legal++;
          }
        }
        console.log(`         slow puddle @${h.x},${h.y} r${h.radius}: ${legal} of ${cells} cells standable`
          + `${legal === 0 ? '   ← 🔴 NOBODY CAN EVER ENTER IT (kitchen.ts)' : ''}`);
      }
    }
    // The pot pin, restated as a test: a spawn on the centre line west of the pot has a
    // legal cell, a legal keep-out radius and an east runway — and that runway ENDS
    // flush against the pot's CoverBox, INSIDE its 95 wu burn ring. This is
    // `60c5b92` exactly, and it is the reason the shipped spawns are offset off the
    // centre line. (700,260) was tried first and is a WORSE fixture: it is inside the
    // keep-out too, so it would have "passed" this row for the wrong reason.
    //
    // 🚨 REBUILT for `6631446`. Old pin, kept because it is the `60c5b92` coordinate every
    //    packet quotes: `{ x: 280, y: 500 }` — 420 wu west of the 1x centre, keep-out 248.25,
    //    east runway 347 wu ending flush on the pot at r=73.
    //    On the x4 map (280,500) is **inside the north-west walk-in freezer** at (300,500),
    //    so it was refused `inside-cover` and the row failed loudly. It is worth being
    //    precise about why that is lucky: had the x4 layout left (280,500) on open floor, the
    //    row would have gone on passing with the runway rule never reached.
    //    (800,1000) reproduces the ORIGINAL GEOMETRY: on the centre line, 600 wu west of the
    //    x4 centre (>= the 496.25 keep-out), east runway ends flush on the pot at
    //    clearance -19.0 against a 21 wu margin. The CONTROL below is what makes it the
    //    right coordinate — it is refused for EXACTLY ONE reason, and that reason is the pin.
    const pin = { x: 800, y: 1000 };
    check('KNOWN-BAD: a centre-line spawn whose run ends flush on the pot is refused (the 60c5b92 pin)',
      violations(pin, arena).some((v) => v.startsWith('run-stops-in-hazard')), violations(pin, arena).join(' '));
    check('  CONTROL: …and it is NOT refused for any other reason (so the pin is what caught it)',
      violations(pin, arena).length === 1, violations(pin, arena).join(' '));
  }

  // §D — the objective can distinguish a good arrangement from a bad one.
  console.log('\n§D — score() is not tautological');
  {
    const c = arena.center;
    const tight = [{ x: c.x - 300, y: c.y }, { x: c.x + 300, y: c.y }, { x: c.x - 310, y: c.y + 10 }, { x: c.x + 310, y: c.y - 10 }, { x: c.x - 320, y: c.y + 20 }, { x: c.x + 320, y: c.y - 20 }];
    // Point-symmetric by construction, like every arrangement this tool can propose.
    const spread = [{ x: 160, y: 390 }, { x: 1240, y: 610 }, { x: 700, y: 120 }, { x: 700, y: 880 }, { x: 1240, y: 300 }, { x: 160, y: 700 }];
    check('KNOWN-BAD: six seats stacked on one line score a tiny minSep', score(tight).minSep < 30, `${score(tight).minSep}`);
    check('CONTROL: a spread arrangement scores a large one', score(spread).minSep > 300, `${score(spread).minSep}`);
    // classSpread is EXACTLY 0 only for an arrangement with 3-fold symmetry, which no
    // C2 map can deliver — so a regular hexagon is the control that proves the metric
    // reaches 0 at all, and the shipped-style arrangement is the one that must not.
    const hexR = 300;
    const hex = [];
    for (let k = 0; k < 6; k++) hex.push({ x: c.x + hexR * Math.cos((k * Math.PI) / 3), y: c.y + hexR * Math.sin((k * Math.PI) / 3) });
    check('CONTROL: a regular hexagon has classSpread 0 (the metric can reach 0)', score(hex).classSpread < 1e-6, `${score(hex).classSpread}`);
    check('KNOWN-BAD: an irregular arrangement does NOT', score(spread).classSpread > 1, `${score(spread).classSpread}`);
  }

  // §E — the mirror is an involution and it is the arena's own transform.
  console.log('\n§E — mirror() is the 180° point transform, and it is its own inverse');
  {
    const p = { x: 317, y: 211 };
    const m = mirror(p, arena);
    check('mirror is 180° about the arena centre', Math.abs((p.x + m.x) / 2 - arena.center.x) < 1e-9 && Math.abs((p.y + m.y) / 2 - arena.center.y) < 1e-9);
    check('mirror(mirror(p)) == p', JSON.stringify(mirror(m, arena)) === JSON.stringify(p));
    check('KNOWN-BAD: an AXIS mirror is NOT the point transform',
      Math.abs((p.x + (arena.width - p.x)) / 2 - arena.center.x) < 1e-9 && Math.abs((p.y + p.y) / 2 - arena.center.y) > 1);
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
}

// ── main ────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (has('selftest')) {
    await selftest();
  } else if (arg('emit-layout')) {
    const arena = loadLayout();
    const raw = String(arg('spawns', ''));
    const pts = raw ? raw.split(';').map((s) => { const [x, y] = s.split(',').map(Number); return { x, y }; }) : [arena.playerSpawn, arena.enemySpawn];
    console.log(emitLayout(arena, pts, String(arg('emit-layout'))));
  } else if (arg('png')) {
    const arena = loadLayout();
    const raw = String(arg('spawns', ''));
    const pts = raw ? raw.split(';').map((s) => { const [x, y] = s.split(',').map(Number); return { x, y }; })
      : (arena.spawns ?? [arena.playerSpawn, arena.enemySpawn]);
    console.log(await writePng(arena, pts, String(arg('png'))));
  } else if (has('search')) {
    search(loadLayout(), Number(arg('top', 20)));
  } else {
    console.log('usage: sp_place.mjs --search [--top N] [--step WU] | --png <path> [--spawns x,y;…] | --emit-layout <path> --spawns x,y;x,y | --selftest');
  }
}
