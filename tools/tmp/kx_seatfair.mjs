#!/usr/bin/env node
/**
 * KX_SEATFAIR — WHICH GEOMETRIC QUANTITY DECIDES A SEAT'S PLACEMENT, AND A SEARCH FOR THE
 * SPAWN SET THAT EQUALISES IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. THE FINDING THIS TOOL EXISTS TO ACT ON
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `sx_census --n 6 --matches 600` measures mean placement per seat with the roster
 * shuffled every match, so character strength averages out and what survives is the SEAT.
 * On the spawns that shipped before this file existed it read (fair would be 3.50):
 *
 *     seat              0      1      2      3      4      5
 *     spawn radius   1116   1116    829    829   1355   1355
 *     mean placement 4.51   4.46   1.83   1.97   4.08   4.15     ± 0.038 .. 0.061
 *     1st places       16     19    273    238     29     25
 *
 * **2.680 places of spread, against a permuted-null floor of 0.315 — 8.5x, p = 0.0002.**
 * ✅ **LANDED. It is now 0.342** (`3.70 3.64 3.43 3.48 3.35 3.41`), 1.09x that floor, with no
 * individual seat distinguishable from 3.50 (worst |z| 2.54 vs a null 95th pct of 2.66).
 *
 * ⚠️ **THE OBVIOUS EXPLANATION IS FALSIFIED BY ITS OWN TABLE.** "Equalise the distance to
 * centre" predicts the ordering 2,3 (829) then 0,1 (1116) then 4,5 (1355). The measured
 * ordering is 2,3 then **4,5** then 0,1 — the middle radius is the WORST seat. Distance to
 * centre is not monotone in placement and cannot be the mechanism.
 *
 * ── THE QUANTITY THAT DOES PREDICT IT: **HOW MANY OPPONENTS TARGET YOU AT SPAWN** ──
 *
 * `ai.ts:stepAI` and `combat.ts:attemptAttack` both resolve their target through
 * `state.ts:nearestLivingOpponent`. At t = 0 that makes the six seats a DIGRAPH: one
 * out-edge per seat, pointing at its nearest opponent. The IN-degree — how many other
 * seats have you as their nearest — is what orders the table, on both arms measured:
 *
 *     in-degree      2      2      0      0      1      1        (pre-fix spawns)
 *     mean placement 4.51   4.46   1.83   1.97   4.08   4.15
 *
 *     in-degree      0      0      1      1      2      2        (`--arm rotate`, list
 *     mean placement 1.92   2.12   4.04   4.17   4.46   4.29      rotated by two)
 *
 *     in-degree      2      2      1      1      0      0        (`cand_eqd`, below)
 *     mean placement 4.83   4.57   3.96   4.04   1.78   1.80
 *
 * **in-degree 0 -> ~1.9 places · in-degree 1 -> ~4.0 · in-degree 2 -> ~4.5.** Rank
 * correlation is perfect on all three arms, and it explains the row `radius` cannot: seats
 * 0/1 are the WORST because they are the only ones two opponents both walk at.
 *
 * 🚨 **AND THE OTHER OBVIOUS FIX WAS BUILT AND MEASURED RATHER THAN ARGUED ABOUT.**
 * `cand_eqd` above is a legal seating with **all six nearest-opponent distances EXACTLY
 * equal at 814.0 wu** — `nearSpread` 0.0, and better `classSpread` (624 vs 1102) and
 * `radiusSpread` (500 vs 929) than the layout that shipped. It measured **3.05 places of
 * spread, WORSE than the map it was meant to fix**, and the seats that won were exactly the
 * two nobody targeted. **"Equalise the distance to the nearest opponent" is FALSIFIED**, and
 * `--gate imperfect` exists so that control can be rebuilt rather than taken on trust.
 *
 * The mechanism is visible in the same census: the favoured pair deals **58/64 damage
 * against ~130** and walks **1,797 wu against ~1,000**. **They win by not participating.**
 * `nearestLivingOpponent` pairs 0<->5 and 1<->4 off at 892 wu while seats 2 and 3 sit
 * 1,040 wu from anyone, so the mutual pairs grind each other down and the unpursued pair
 * strolls into the wreckage. After the fix every seat deals damage in **600 of 600**
 * matches (was 74.5% of matches with all six engaged) and the path-length spread collapses
 * from 907-1,797 wu to 1,245-1,408.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. SO WHAT MUST BE EQUAL — AND THE STRUCTURE THEOREM THAT ANSWERS IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **The decision: every seat must be the nearest opponent of EXACTLY ONE other seat.**
 * Six seats have six out-edges, so the in-degrees always sum to 6; "nobody has in-degree 0"
 * and "everybody has in-degree 1" are the same requirement. That is the quantity the table
 * above says decides the match, and it is a *discrete* property — halving a distance gap
 * does not half an in-degree, so smoothing the geometry is not a partial fix.
 *
 * ⚠️ **Six points in a rectangle cannot be mutually equidistant, so "equalise the spacing"
 * is not a well-posed target.** What CAN be stated exactly is the digraph. Three facts pin
 * its shape completely, and each is a proof rather than a preference:
 *
 *   (i)   **A nearest-neighbour digraph has no directed cycle longer than 2.** Following
 *         nearest-neighbour edges strictly decreases distance, so `a -> b -> c -> a` would
 *         need `d(a,b) > d(b,c) > d(c,a) > d(a,b)`. => every in-degree-1 assignment is a
 *         **perfect matching into MUTUAL pairs**. A "circle of death" is not available.
 *   (ii)  **`sp_gate` §A requires spawn `2k+1` to be the exact 180 deg image of spawn `2k`**
 *         (`DECISIONS §48` rule 3 — competitive fairness, the same category as
 *         `tools/aspect.mjs`). So the whole configuration is invariant under the point
 *         reflection sigma, and sigma must therefore map the matching to itself. An
 *         involution on three pairs has an odd orbit count, so **at least one pair is
 *         sigma-FIXED** — and since sigma has no fixed points off the map centre, a
 *         sigma-fixed pair is `{2k, 2k+1}` itself: a DIAMETRIC pair, duelling across the
 *         map. The other two pairs are each other's image.
 *   (iii) **The diametric pair must be the INNERMOST one.** Its separation is `2r`, and for
 *         that to be its own minimum every other seat must be more than `2r` away. Any seat
 *         at radius `R` is at most `r + R` away, so `r + R > 2r`, i.e. **`R > r` for all
 *         four other seats.**
 *
 * => **exactly one C2 pair duels itself across the middle, and it is the closest pair to
 * the centre; the other four seats cross-match.** That is not a layout that was liked; it
 * is the only shape the constraints admit, and this tool searches inside it.
 *
 * 🚨 **AND THE COST IS REAL AND IS STATED RATHER THAN HIDDEN.** (iii) means the three pairs
 * CANNOT all sit at one radius, so `sp_place:score`'s `radiusSpread` — "the fog closes on
 * the centre, so an unequal radius is an unequal countdown" — can no longer be driven to
 * zero. **Equal centrality and a fair targeting graph are mutually exclusive on a
 * C2-symmetric map.** This tool ranks candidates on the targeting graph and reports
 * `radiusSpread` alongside, and the *measurement* (`sx_census`) is what decides — because
 * an argument about which of two fairness terms matters more is exactly the thing 200
 * matches can answer and prose cannot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. WHAT IS REUSED RATHER THAN RESTATED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"A rule stated once in `rules.ts` and implemented differently elsewhere"* is the shape of
 * five separate AI defects in this repo and of both `bestWeapon` faults. So:
 *
 *   * **the target rule is the SHIPPED FUNCTION.** `state.ts:nearestLivingOpponent` is
 *     imported and called on a duck-typed `{ fighters }`, not re-implemented — including
 *     its `d < bestDist` tie rule, which keeps the LOWER slot. `--selftest` D asserts that
 *     tie behaviour through the imported function, so a future change to it fails here.
 *   * **every legality rule is `sp_place.mjs`'s.** `violations` (bounds, cover, keep-out,
 *     concealment, slow hazard, runway, hazard-stop), `floodComponent` (one nav component),
 *     `mirror`, `keepoutRadius`, `score` (`minSep`, `classSpread`) are imported. This file
 *     adds the targeting-graph terms and NOTHING else about what a legal spawn is.
 *   * **the placement measurement is `sx_census.mjs`.** This tool does not run matches. It
 *     writes a candidate arena dump (`--emit`) that `sx_census --arena <path>` consumes, so
 *     the before/after is the same instrument on the same corpus with only the six
 *     coordinates changed.
 *
 * ⚠️ Pair A (slots 0/1) is **PINNED** at the shipped `playerSpawn`/`enemySpawn`, matching
 * `sp_place:search`. `sp_gate` §C requires `spawns[0..1] === playerSpawn/enemySpawn`, and
 * those two coordinates are what every 1v1 number in the project was measured on — 110
 * matchups, the pacing ladder, `roster_table` — while a peer is rebalancing the roster on
 * them right now. Moving them would invalidate all of it for a fix that does not need it:
 * by (iii) pair A cannot be the diametric pair anyway (it is 2,232 wu across), so it was
 * always going to be a cross-matched pair, and cross-matching is decided by where B and C
 * go.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. USE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   node tools/tmp/kx_seatfair.mjs --graph                 # the digraph of the shipped six
 *   node tools/tmp/kx_seatfair.mjs --graph --spawns "x,y;…"
 *   node tools/tmp/kx_seatfair.mjs --search [--step 20] [--top 20]
 *   node tools/tmp/kx_seatfair.mjs --emit /tmp/a.json --spawns "x,y;x,y;…"
 *   node tools/tmp/kx_seatfair.mjs --selftest              # OFFLINE, no browser
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  violations, floodComponent, mirror, keepoutRadius, score, PLAYER_SIZE,
} from './sp_place.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d); };
const has = (k) => argv.includes(`--${k}`);

const DUMP = String(arg('layout', `${ROOT}/tools/arena.gameplay.json`));
const loadArena = () => JSON.parse(readFileSync(DUMP, 'utf8'));

// ── THE TARGET RULE, IMPORTED. Not a copy. ──────────────────────────────────
// `nearestLivingOpponent` reads exactly `state.fighters` and each fighter's
// `alive` / `hp` / `x` / `y`, so a duck-typed state is the REAL function under test rather
// than a re-drawing of it. `--selftest` D pins the tie behaviour through this same import,
// which is what makes that true statement checkable rather than a comment.
const { nearestLivingOpponent } = await import(`${ROOT}/src/game/state.ts`);

/**
 * The spawn-time targeting digraph.
 *
 * `target[i]` — the seat `i`'s AI walks at and shoots at on tick 1.
 * `inDeg[i]`  — how many seats target `i`. **This is the quantity the header measures as
 *               deciding placement.** Sums to N by construction, so `min(inDeg) === 1` and
 *               `max(inDeg) === 1` are the same statement as "a perfect matching".
 * `mutual[i]` — is seat `i`'s target's target seat `i`? A perfect matching means all six.
 * `nearest[i]`— the distance to that target. Equal across seats = every seat's opening
 *               engagement starts at the same range.
 */
export function targetGraph(spawns) {
  const fighters = spawns.map((p, i) => ({ x: p.x, y: p.y, alive: true, hp: 100, slot: i }));
  const state = { fighters };
  const target = fighters.map((f) => {
    const t = nearestLivingOpponent(state, f);
    return t ? t.slot : -1;
  });
  const inDeg = spawns.map(() => 0);
  for (const t of target) if (t >= 0) inDeg[t]++;
  const mutual = target.map((t, i) => t >= 0 && target[t] === i);
  const nearest = target.map((t, i) => (t >= 0 ? Math.hypot(spawns[t].x - spawns[i].x, spawns[t].y - spawns[i].y) : Infinity));
  const perfect = inDeg.every((d) => d === 1) && mutual.every(Boolean);
  const nearSpread = Math.max(...nearest) - Math.min(...nearest);
  return { target, inDeg, mutual, nearest, perfect, nearSpread };
}

/** Radii from the arena centre, and the max−min over the three C2 pair classes. */
function radii(spawns, arena) {
  const r = spawns.map((p) => Math.hypot(p.x - arena.center.x, p.y - arena.center.y));
  const cls = [];
  for (let i = 0; i < spawns.length; i += 2) cls.push(r[i]);
  return { r, cls, spread: Math.max(...cls) - Math.min(...cls) };
}

function report(arena, spawns, label) {
  const g = targetGraph(spawns);
  const s = score(spawns);
  const rad = radii(spawns, arena);
  const pad = (v, n = 10) => String(v).padStart(n);
  console.log(`\n== ${label}`);
  console.log(`   seat        ${spawns.map((_, i) => pad(i)).join('')}`);
  console.log(`   spawn       ${spawns.map((p) => pad(`${p.x},${p.y}`)).join('')}`);
  console.log(`   radius      ${rad.r.map((v) => pad(v.toFixed(0))).join('')}`);
  console.log(`   targets     ${g.target.map((v) => pad(v)).join('')}`);
  console.log(`   nearest wu  ${g.nearest.map((v) => pad(v.toFixed(0))).join('')}`);
  console.log(`   IN-DEGREE   ${g.inDeg.map((v) => pad(v)).join('')}`);
  console.log(`   mutual      ${g.mutual.map((v) => pad(v ? 'yes' : 'NO')).join('')}`);
  console.log(`   perfect matching: ${g.perfect ? 'YES — every seat is targeted by exactly one' : 'NO'}`
    + ` · nearest-distance spread ${g.nearSpread.toFixed(1)} wu`);
  console.log(`   minSep ${s.minSep.toFixed(1)} · classSpread ${s.classSpread === null ? 'n/a' : s.classSpread.toFixed(1)}`
    + ` · radiusSpread ${rad.spread.toFixed(1)} · keep-out ${keepoutRadius(arena).toFixed(2)}`);
  const bad = spawns.map((p, i) => [i, violations(p, arena)]).filter(([, v]) => v.length);
  console.log(`   legality (sp_place rules): ${bad.length === 0 ? 'all six clear' : bad.map(([i, v]) => `slot${i} ${v.join(',')}`).join(' | ')}`);
  return { g, s, rad, bad };
}

// ── THE SEARCH ──────────────────────────────────────────────────────────────
function search(arena, topN, step) {
  const A0 = arena.playerSpawn, A1 = arena.enemySpawn;
  const comp = floodComponent(arena, PLAYER_SIZE, A0);
  const half = [];
  const all = [];
  for (let y = 0; y <= arena.height; y += step) {
    for (let x = 0; x <= arena.width; x += step) {
      const p = { x, y };
      if (violations(p, arena).length) continue;
      if (!comp.at(p)) continue;
      all.push(p);
      if (y < arena.height / 2 || (y === arena.height / 2 && x < arena.width / 2)) half.push(p);
    }
  }
  // The same self-check `sp_place:search` makes, for the same reason: every hard constraint
  // is defined on a point-symmetric arena, so the SURVIVING SET must be point-symmetric. If
  // it is not, a constraint is reading something asymmetric and nothing below is trustworthy.
  const key = (p) => `${p.x},${p.y}`;
  const seen = new Set(all.map(key));

  // ── 🔴 `--halo` — THE BAY TEST, AND IT IS NOT COSMETIC ─────────────────────
  // `kitchen.ts`'s spawn block states the rule this enforces: *"each bay here is an AUTHORED
  // VOID rather than whatever gap the props happened to leave."* Legality is a point test, so
  // a cell can pass every rule while sitting on a knife edge — measured on the first candidate
  // this search returned: **a legal halo of 2 wu**, against 20–30 wu for all six shipped seats.
  // A seat like that is one prop nudge, one runway-margin change or one body-width sweep away
  // from becoming illegal, and nothing would say so until `sp_gate` went red long after the
  // reason was forgotten. `--halo N` requires every lattice cell within Chebyshev N wu of a
  // candidate to be legal too.
  const HALO = Number(arg('halo', 0));
  const haloOf = (p) => {
    for (let r = step; r <= 200; r += step) {
      for (let dx = -r; dx <= r; dx += step) {
        for (let dy = -r; dy <= r; dy += step) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!seen.has(key({ x: p.x + dx, y: p.y + dy }))) return r - step;
        }
      }
    }
    return 200;
  };
  const haloBefore = half.length;
  if (HALO > 0) {
    for (let i = half.length - 1; i >= 0; i--) if (haloOf(half[i]) < HALO) half.splice(i, 1);
  }
  const asym = all.filter((p) => !seen.has(key(mirror(p, arena))));
  if (asym.length) {
    console.error(`\n🚨 kx_seatfair: the CANDIDATE SET is not point-symmetric — ${asym.length} of ${all.length}. Do not trust anything below.`);
    process.exitCode = 1;
  }

  // ⚠️ `--gate imperfect` IS THE DISCRIMINATING CONTROL FOR THE WHOLE HYPOTHESIS, not a
  // debug switch. It returns candidates that are NOT a perfect matching but whose nearest
  // distances and radii sit in the same band as the chosen one. If seat fairness followed
  // the DISTANCES rather than the targeting graph, that arm would come out fair too — and
  // the whole file would be an elaborate way of equalising the wrong quantity. It is the
  // only arm here that can falsify the header.
  const GATE = String(arg('gate', 'perfect'));
  const MIN_SEP = Number(arg('min-sep', 0));
  const results = [];
  let perfectCount = 0;
  for (let i = 0; i < half.length; i++) {
    for (let j = i + 1; j < half.length; j++) {
      const B0 = half[i], C0 = half[j];
      const six = [A0, A1, B0, mirror(B0, arena), C0, mirror(C0, arena)];
      const g = targetGraph(six);
      if (g.perfect) perfectCount++;
      if (GATE === 'perfect' && !g.perfect) continue;
      if (GATE === 'imperfect' && g.perfect) continue;
      if (MIN_SEP && Math.min(...g.nearest) < MIN_SEP) continue;
      const s = score(six);
      if (s.minSep < MIN_SEP) continue;
      const rad = radii(six, arena);
      results.push({ six, ...g, minSep: s.minSep, classSpread: s.classSpread, radiusSpread: rad.spread, radii: rad.cls });
    }
  }

  // 🔴 THE SORT KEY IS THE TARGETING GRAPH, NOT A WEIGHTED SUM.
  // `sp_place:search` records what a scalarised objective did there — it put three pairs in
  // one bay because piling the seats together made the pair CLASSES congruent while `minSep`
  // collapsed to half a body. The same trap applies here in reverse, so the perfect-matching
  // filter is a HARD gate (it is the discrete quantity the census says decides the match),
  // `nearSpread` is the primary key (equal opening range), and separation and the residuals
  // break ties. Nothing here is added to anything else.
  //
  // ⚠️ `--sort radius` / `--sort class` re-key the SURVIVORS of the same hard gate. They are
  // there so the *measurement* can arbitrate between two fairness terms that (iii) proves
  // cannot both be satisfied — not so a nicer-looking number can be picked without running
  // the census.
  const SORT = String(arg('sort', 'near'));
  const keys = {
    near: (a, b) => (a.nearSpread - b.nearSpread) || (b.minSep - a.minSep) || (a.classSpread - b.classSpread) || (a.radiusSpread - b.radiusSpread),
    radius: (a, b) => (a.radiusSpread - b.radiusSpread) || (a.nearSpread - b.nearSpread) || (b.minSep - a.minSep),
    class: (a, b) => (a.classSpread - b.classSpread) || (a.nearSpread - b.nearSpread) || (b.minSep - a.minSep),
    sep: (a, b) => (b.minSep - a.minSep) || (a.nearSpread - b.nearSpread),
  };
  if (!keys[SORT]) { console.error(`kx_seatfair --sort: expected one of ${Object.keys(keys).join('/')}`); process.exit(2); }
  results.sort(keys[SORT]);

  console.log(`\n== KX_SEATFAIR SEARCH — ${arena.width}x${arena.height}, ${arena.cover.length} cover, ${(arena.concealment ?? []).length} concealment`);
  console.log(`   lattice ${step} wu · ${all.length} legal candidates (${haloBefore} in the half-plane) · point-symmetric: ${asym.length === 0 ? 'YES' : 'NO'}`);
  if (HALO > 0) console.log(`   --halo ${HALO} wu (the BAY test): ${haloBefore} → ${half.length} half-plane candidates survive`);
  console.log(`   pair A PINNED at (${A0.x},${A0.y})/(${A1.x},${A1.y}) — sp_gate §C, and every 1v1 number in the project`);
  console.log(`   GATE --gate ${GATE}: the spawn-time nearest-opponent digraph ${GATE === 'perfect' ? 'must be' : GATE === 'imperfect' ? 'must NOT be' : 'need not be'} a PERFECT MATCHING (in-degree 1 for all six)`);
  if (MIN_SEP) console.log(`   --min-sep ${MIN_SEP} wu on both the pairwise minimum and every seat's nearest-opponent distance`);
  console.log(`   sorted by --sort ${SORT}; the remaining terms break ties\n`);
  console.log(`   ${'pair B'.padEnd(12)} ${'pair C'.padEnd(12)} ${'nearSpr'.padStart(8)} ${'minSep'.padStart(8)} ${'classSpr'.padStart(9)} ${'radSpr'.padStart(8)} ${'radii A/B/C'.padStart(20)}  matching`);
  for (const r of results.slice(0, topN)) {
    const pairs = [];
    const done = new Set();
    for (let k = 0; k < 6; k++) { if (done.has(k)) continue; done.add(k); done.add(r.target[k]); pairs.push(`${k}-${r.target[k]}`); }
    console.log(`   ${`${r.six[2].x},${r.six[2].y}`.padEnd(12)} ${`${r.six[4].x},${r.six[4].y}`.padEnd(12)} `
      + `${r.nearSpread.toFixed(1).padStart(8)} ${r.minSep.toFixed(1).padStart(8)} ${r.classSpread.toFixed(1).padStart(9)} `
      + `${r.radiusSpread.toFixed(1).padStart(8)} ${r.radii.map((n) => n.toFixed(0)).join('/').padStart(20)}  ${pairs.join(' ')}`
      + `  halo ${haloOf(r.six[2])}/${haloOf(r.six[4])}`);
  }
  console.log(`\n   ${perfectCount} of ${(half.length * (half.length - 1)) / 2} legal (B,C) triples produce a PERFECT MATCHING.\n`);
  return results;
}

// ── --emit: a candidate arena dump for `sx_census --arena` ──────────────────
// ⚠️ It is written from the SHIPPED dump with only `spawns` / `playerSpawn` / `enemySpawn`
// replaced, so cover, hazards, concealment and `maxSafeRadius` are byte-identical between
// the arms and the A/B isolates the six coordinates. A candidate built from scratch would
// be a different arena wearing the same name.
function emit(arena, spawns, path) {
  const out = { ...arena, spawns: spawns.map((p) => ({ x: p.x, y: p.y })) };
  out.playerSpawn = { x: spawns[0].x, y: spawns[0].y };
  out.enemySpawn = { x: spawns[1].x, y: spawns[1].y };
  writeFileSync(path, JSON.stringify(out, null, 1));
  return path;
}

const parseSpawns = (raw) => String(raw).split(';').filter(Boolean).map((s) => { const [x, y] = s.split(',').map(Number); return { x, y }; });

// ── --stats: THE RESOLUTION FLOOR OF THE SPREAD, MEASURED ───────────────────
/**
 * `sx_census` prints `max(mean) − min(mean)` and a per-seat SE, and **the spread is not the
 * SE's own scale.** It is the RANGE of six correlated means, so even a perfectly fair layout
 * shows a positive spread, and comparing two layouts on it without knowing that number is the
 * exact failure `CLAUDE.md` rule 10 records: *"every known floor in this project was
 * discovered AFTER someone had already acted inside it."*
 *
 * 🚨 **AND IT BIT THIS PASS.** At 200 matches two candidates measured 0.40 and 0.70 and the
 * 0.70 looked like a clear loser; at 600 they read **0.39 and 0.34** and the ranking
 * REVERSED. The 0.30-place gap was inside the floor computed below.
 *
 * The null is **permuted, not assumed**: each match's own place vector is shuffled across the
 * six seats. That destroys any seat effect while preserving the place distribution exactly,
 * the per-match sum-to-N(N+1)/2 constraint exactly, and the negative correlation between seats
 * that makes an independent-SE calculation wrong. The floor is the null's 95th percentile.
 *
 *   node tools/tmp/kx_seatfair.mjs --stats <sx_census --json file> [--reps 4000]
 */
export function seatStats(rows, reps = 4000, seed = 12345) {
  const n = rows[0].place.length;
  const m = rows.length;
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const seatMean = Array.from({ length: n }, (_, k) => mean(rows.map((r) => r.place[k])));
  const seatSe = Array.from({ length: n }, (_, k) => {
    const xs = rows.map((r) => r.place[k]); const mu = seatMean[k];
    return Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1)) / Math.sqrt(m);
  });
  const spread = Math.max(...seatMean) - Math.min(...seatMean);
  const fair = (n + 1) / 2;
  const maxZ = Math.max(...seatMean.map((v, k) => Math.abs(v - fair) / seatSe[k]));

  // Deterministic PRNG — a floor that moves between runs is not a floor.
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0; t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const nullSpreads = [];
  const nullMaxZ = [];
  const acc = new Float64Array(n);
  const acc2 = new Float64Array(n);
  for (let r = 0; r < reps; r++) {
    acc.fill(0); acc2.fill(0);
    for (const row of rows) {
      const p = row.place.slice();
      for (let k = p.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [p[k], p[j]] = [p[j], p[k]]; }
      for (let k = 0; k < n; k++) { acc[k] += p[k]; acc2[k] += p[k] * p[k]; }
    }
    const mu = Array.from(acc, (v) => v / m);
    const se = Array.from({ length: n }, (_, k) => Math.sqrt(Math.max(0, (acc2[k] - m * mu[k] * mu[k]) / (m - 1)) / m));
    nullSpreads.push(Math.max(...mu) - Math.min(...mu));
    nullMaxZ.push(Math.max(...mu.map((v, k) => Math.abs(v - fair) / se[k])));
  }
  nullSpreads.sort((a, b) => a - b);
  nullMaxZ.sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  return {
    n, m, seatMean, seatSe, spread, fair, maxZ,
    floor95: q(nullSpreads, 0.95),
    nullMedian: q(nullSpreads, 0.5),
    pSpread: (nullSpreads.filter((v) => v >= spread).length + 1) / (reps + 1),
    maxZ95: q(nullMaxZ, 0.95),
    pMaxZ: (nullMaxZ.filter((v) => v >= maxZ).length + 1) / (reps + 1),
  };
}

// ── SELFTEST ────────────────────────────────────────────────────────────────
// Every row names the implementation that would FAIL it. A guard that has not been shown to
// fail on the bug it guards against is not a guard, and a guard can also be tautological.
async function selftest() {
  const arena = loadArena();
  let n = 0, bad = 0;
  const ok = (label, cond, evidence) => {
    n++; if (!cond) bad++;
    console.log(`  ${cond ? 'ok  ' : 'FAIL'} - ${label}${evidence ? `   ${evidence}` : ''}`);
  };

  console.log('\nKX_SEATFAIR --selftest');

  // §A THE KNOWN-BAD IS THE MAP AS IT SHIPPED BEFORE THIS PASS, written out rather than
  //    read from the dump. If `targetGraph` cannot call THAT seating unfair it cannot see
  //    the defect it exists to find and every search result is vacuous — and once the fix
  //    landed, reading the live dump would have turned this row into its own opposite.
  //    ⚠️ Its coordinates are frozen here on purpose: a known-bad that tracks the shipped
  //    file stops being a known-bad the moment the file is fixed.
  const OLD_SIX = [
    { x: 300, y: 810 }, { x: 2500, y: 1190 },
    { x: 1150, y: 210 }, { x: 1650, y: 1790 },
    { x: 2560, y: 300 }, { x: 240, y: 1700 },
  ];
  const gs = targetGraph(OLD_SIX);
  ok('KNOWN-BAD: the PRE-FIX six are NOT a perfect matching', gs.perfect === false,
    `inDeg ${gs.inDeg.join('')}`);
  ok('KNOWN-BAD: the pre-fix in-degrees are exactly [2,2,0,0,1,1]', gs.inDeg.join(',') === '2,2,0,0,1,1',
    `got [${gs.inDeg.join(',')}] — the profile that orders the 600-match census`);
  ok('KNOWN-BAD: two pre-fix seats were targeted by NOBODY', gs.inDeg.filter((d) => d === 0).length === 2,
    `seats ${gs.inDeg.map((d, i) => (d === 0 ? i : null)).filter((v) => v !== null).join(',')} — the pair that took 511 of 600 first places`);

  // §A2 AND THE SHIPPED MAP MUST NOW BE THE FIX. Paired with §A: one row cannot pass while
  //     the other does unless `targetGraph` really discriminates the two seatings.
  const shipped = arena.spawns.slice(0, 6);
  const gShip = targetGraph(shipped);
  ok('the SHIPPED six ARE a perfect matching', gShip.perfect === true,
    `inDeg ${gShip.inDeg.join('')} · pairs ${gShip.target.map((t, i) => `${i}→${t}`).join(' ')}`);
  ok('every shipped seat is legal and clears the endgame keep-out',
    shipped.every((p) => violations(p, arena).length === 0)
      && shipped.every((p) => Math.hypot(p.x - arena.center.x, p.y - arena.center.y) >= keepoutRadius(arena)),
    `innermost r = ${Math.min(...shipped.map((p) => Math.hypot(p.x - arena.center.x, p.y - arena.center.y))).toFixed(1)} vs keep-out ${keepoutRadius(arena).toFixed(2)}`);
  ok('the shipped diametric pair is the INNERMOST — header (iii), checked not asserted',
    (() => {
      const r = shipped.map((p) => Math.hypot(p.x - arena.center.x, p.y - arena.center.y));
      const diam = [0, 2, 4].find((k) => gShip.target[k] === k + 1);
      return diam !== undefined && r[diam] === Math.min(...r);
    })(),
    `radii ${shipped.map((p) => Math.hypot(p.x - arena.center.x, p.y - arena.center.y).toFixed(0)).join('/')}`);

  // §A3 🔴 A DECLARED DIVERGENCE, NOT A COMMENT. `tools/tmp/x4_layout.mjs` is the GENERATOR
  //     `kitchen.ts`'s own header points at ("the generator is the place to edit it"), and its
  //     `SPAWN_NORTH` table still holds the PRE-FIX pair B/C. It is not this pass's file, so it
  //     was reported rather than edited — and a report is not a guard. This row is: it goes RED
  //     the moment either side moves, including the dangerous direction, where somebody
  //     regenerates `kitchen.ts` from the stale generator and silently reverts the fix.
  //     ⚠️ WHEN `SPAWN_NORTH` IS UPDATED, DELETE THIS ROW — its failure message says so.
  const X4 = readFileSync(`${ROOT}/tools/tmp/x4_layout.mjs`, 'utf8');
  const x4North = [...X4.matchAll(/\{\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
  const x4Spawns = (() => {
    const blk = /export const SPAWN_NORTH = \[([\s\S]*?)\];/.exec(X4);
    return blk ? [...blk[1].matchAll(/x:\s*(\d+),\s*y:\s*(\d+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })) : [];
  })();
  void x4North;
  const northHalf = [shipped[0], shipped[2], shipped[4]];
  const agrees = x4Spawns.length === 3 && x4Spawns.every((p, i) => p.x === northHalf[i].x && p.y === northHalf[i].y);
  const isOldTable = x4Spawns.length === 3 && x4Spawns.every((p, i) => p.x === OLD_SIX[i * 2].x && p.y === OLD_SIX[i * 2].y);
  ok('ROUTED: x4_layout.mjs:SPAWN_NORTH is STALE, and stale in exactly the declared way',
    !agrees && isOldTable,
    agrees
      ? '✅ SPAWN_NORTH now AGREES with the shipped dump — the divergence is closed. DELETE THIS ROW.'
      : isOldTable
        ? `still [${x4Spawns.map((p) => `${p.x},${p.y}`).join(' ')}] vs shipped [${northHalf.map((p) => `${p.x},${p.y}`).join(' ')}]`
        : `🔴 SPAWN_NORTH is neither the old table NOR the shipped seats — somebody changed it to a THIRD thing: [${x4Spawns.map((p) => `${p.x},${p.y}`).join(' ')}]`);

  // §B A POSITIVE CONTROL. Without it, a `targetGraph` that returned `perfect: false`
  //    unconditionally would pass §A and silently reject every candidate in the search.
  //
  //    ⚠️ **THE FIRST FIXTURE HERE WAS WRONG AND THE ROW CAUGHT IT.** It was three visibly
  //    "tight, well-separated" pairs — `(300,300)/(500,300)`, their images, and
  //    `(1400,200)/(1400,1800)` — and it came back `inDeg [1,1,2,2,0,0]`, NOT perfect,
  //    because the diametric pair was 1,600 wu across while seat 4 sat 906 wu from seat 3.
  //    That is header (iii) biting: **the sigma-fixed pair must be the INNERMOST**, and eyeballing
  //    "these look paired up" does not check it. The fixture is now built to the theorem —
  //    diametric pair at r = 300, so 600 wu across, against a nearest rival at 985 — and the
  //    old one is kept as §C's known-bad instead of being deleted.
  const good = [
    { x: 300, y: 300 }, { x: 2500, y: 1700 },
    { x: 500, y: 300 }, { x: 2300, y: 1700 },
    { x: 1400, y: 700 }, { x: 1400, y: 1300 },
  ];
  const gg = targetGraph(good);
  ok('POSITIVE CONTROL: three tight mutual pairs ARE a perfect matching', gg.perfect === true,
    `inDeg ${gg.inDeg.join('')} targets ${gg.target.join('')}`);

  // §C THE STRUCTURE THEOREM, CHECKED RATHER THAN ASSERTED IN PROSE. Header (iii) says the
  //    sigma-fixed (diametric) pair must be the innermost. Two configurations that violate
  //    it must fail, and the second is §B's own rejected fixture — three pairs that LOOK
  //    matched, whose diametric pair is 1,600 wu across.
  const outerDiam = [
    { x: 300, y: 810 }, { x: 2500, y: 1190 },
    { x: 1300, y: 700 }, { x: 1500, y: 1300 },
    { x: 1250, y: 400 }, { x: 1550, y: 1600 },
  ];
  ok('a configuration with no innermost diametric pair is NOT perfect', targetGraph(outerDiam).perfect === false,
    `inDeg ${targetGraph(outerDiam).inDeg.join('')}`);
  const wideDiam = [
    { x: 300, y: 300 }, { x: 2500, y: 1700 },
    { x: 500, y: 300 }, { x: 2300, y: 1700 },
    { x: 1400, y: 1800 }, { x: 1400, y: 200 },
  ];
  ok('a diametric pair 1,600 wu across, with a rival at 906, is NOT perfect', targetGraph(wideDiam).perfect === false,
    `inDeg ${targetGraph(wideDiam).inDeg.join('')} — §B's rejected fixture`);

  // §D THE TIE RULE, THROUGH THE IMPORTED FUNCTION. `nearestLivingOpponent` scans in slot
  //    order with a STRICT `<`, so an exact tie keeps the LOWER slot. A copy of the rule
  //    that used `<=` would fail this and nothing else here would notice.
  const tie = [{ x: 1000, y: 1000 }, { x: 900, y: 1000 }, { x: 1100, y: 1000 }];
  const gt = targetGraph(tie);
  ok('the imported tie rule keeps the LOWER slot on an exact tie', gt.target[0] === 1,
    `seat 0 is equidistant from 1 and 2; target = ${gt.target[0]}`);

  // §E A DEAD SEAT IS NOT A TARGET — proves the import really is the sim's function and not
  //    a private hypot loop that ignores `alive`.
  const state = { fighters: [{ x: 0, y: 0, alive: true, hp: 100, slot: 0 }, { x: 10, y: 0, alive: false, hp: 0, slot: 1 }, { x: 100, y: 0, alive: true, hp: 100, slot: 2 }] };
  ok('the imported rule skips a DEAD nearer fighter', nearestLivingOpponent(state, state.fighters[0])?.slot === 2,
    'slot 1 is 10 wu away and dead; slot 2 is 100 wu away and alive');

  // §F PERMUTATION INVARIANCE. `sx_census --arm rotate` rotates the spawn LIST by two; the
  //    in-degree profile must rotate WITH it, because it is a property of the geometry. A
  //    `targetGraph` keyed on slot index rather than position would fail this — and that is
  //    precisely the hypothesis `--arm rotate` exists to discriminate. Run on the PRE-FIX
  //    seating, whose profile is not flat: rotating [1,1,1,1,1,1] would pass trivially.
  const rot = OLD_SIX.map((_, k) => OLD_SIX[(k + 2) % 6]);
  const gr = targetGraph(rot);
  const expect = gs.inDeg.map((_, k) => gs.inDeg[(k + 2) % 6]);
  ok('the in-degree profile FOLLOWS the spawn under a list rotation', gr.inDeg.join(',') === expect.join(','),
    `rotated [${gr.inDeg.join(',')}] vs expected [${expect.join(',')}]`);

  // §G LEGALITY IS `sp_place`'s, and it still bites. The arena centre is inside the endgame
  //    keep-out, so it must be refused. If this passes, `violations` is not wired up and the
  //    search would happily return illegal seats.
  ok('sp_place:violations still refuses the arena centre', violations(arena.center, arena).length > 0,
    violations(arena.center, arena).join(',') || '(none — the rule is NOT wired up)');
  ok('sp_place:violations clears all six SHIPPED seats', shipped.every((p) => violations(p, arena).length === 0),
    shipped.map((p, i) => `${i}:${violations(p, arena).join('|') || 'ok'}`).join(' '));

  // §H `--emit` must change ONLY the seats. A dump that silently re-derived cover or the
  //    ring would make every A/B a two-variable experiment.
  const tmp = `${ROOT}/tools/tmp/kx_emit_selftest.json`;
  emit(arena, good, tmp);
  const back = JSON.parse(readFileSync(tmp, 'utf8'));
  const stripSeats = (o) => JSON.stringify({ ...o, spawns: null, playerSpawn: null, enemySpawn: null });
  ok('--emit changes ONLY spawns/playerSpawn/enemySpawn', stripSeats(back) === stripSeats(arena),
    `cover ${back.cover.length} vs ${arena.cover.length}, maxSafeRadius ${back.maxSafeRadius} vs ${arena.maxSafeRadius}`);
  ok('--emit keeps spawns[0..1] identical to playerSpawn/enemySpawn (sp_gate §C)',
    back.spawns[0].x === back.playerSpawn.x && back.spawns[1].y === back.enemySpawn.y);
  writeFileSync(tmp, '');

  console.log(`\n${n - bad} passed, ${bad} failed\n`);
  return bad;
}

if (IS_MAIN) {
  if (has('selftest')) {
    process.exit((await selftest()) ? 1 : 0);
  } else if (has('graph')) {
    const arena = loadArena();
    const raw = arg('spawns', '');
    const pts = raw && raw !== true ? parseSpawns(raw) : arena.spawns.slice(0, 6);
    report(arena, pts, raw && raw !== true ? 'CANDIDATE' : `SHIPPED — ${DUMP}`);
  } else if (arg('emit')) {
    const arena = loadArena();
    const pts = parseSpawns(arg('spawns', ''));
    if (pts.length !== 6) { console.error('kx_seatfair --emit needs --spawns with six x,y pairs'); process.exit(2); }
    report(arena, pts, 'EMITTED');
    console.log(`\n   wrote ${emit(arena, pts, String(arg('emit')))}`);
  } else if (arg('stats')) {
    const j = JSON.parse(readFileSync(String(arg('stats')), 'utf8'));
    const st = seatStats(j.rows, Number(arg('reps', 4000)));
    const pad = (v, w = 8) => String(v).padStart(w);
    console.log(`\n== SEAT STATS — ${st.m} matches, N=${st.n}, fair = ${st.fair.toFixed(2)}   ${arg('stats')}`);
    console.log(`   seat        ${st.seatMean.map((_, i) => pad(i)).join('')}`);
    console.log(`   mean place  ${st.seatMean.map((v) => pad(v.toFixed(2))).join('')}`);
    console.log(`   ± SE        ${st.seatSe.map((v) => pad(v.toFixed(3))).join('')}`);
    console.log(`   SPREAD ${st.spread.toFixed(3)} places`);
    console.log(`   PERMUTED NULL (seat labels shuffled within each match, ${arg('reps', 4000)} reps):`);
    console.log(`     median spread ${st.nullMedian.toFixed(3)} · 95th pct ${st.floor95.toFixed(3)}  <- THE RESOLUTION FLOOR`);
    console.log(`     p(spread >= observed) = ${st.pSpread.toFixed(4)}`);
    console.log(`   worst seat |z| vs fair: ${st.maxZ.toFixed(2)} · null 95th pct ${st.maxZ95.toFixed(2)} · p = ${st.pMaxZ.toFixed(4)}`);
    console.log(`   => ${st.spread <= st.floor95 ? 'INSIDE the floor — indistinguishable from a fair seating' : 'OUTSIDE the floor — a real seat effect'}\n`);
  } else if (has('search')) {
    search(loadArena(), Number(arg('top', 20)), Number(arg('step', 20)));
  } else {
    console.log('usage: kx_seatfair.mjs --graph [--spawns x,y;…] | --search [--step WU] [--top N] | --emit <path> --spawns x,y;… | --selftest');
  }
}
