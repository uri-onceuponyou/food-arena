#!/usr/bin/env node
/**
 * AX_LAYOUT — synthesise an arena gameplay dump at a DIFFERENT SCALE, without a browser.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * §48 settles that the arena grows x4 in AREA (1400x1000 -> 2800x2000) and asks for the
 * 1v1 pacing cost to be MEASURED BEFORE the size ships. That is a Node-only question —
 * `tools/tmp/roster_lab.mjs --arena <path>` and `tools/match-sim.mjs --layout <path>` both
 * take an arena dump as data — but there is no dump at the new size, because a dump comes
 * from `tools/arena-dump.html` building the real `kitchen.ts` in a browser.
 *
 * Editing `shared.ts` first and dumping second would answer the question with the ANSWER
 * ALREADY SHIPPED, which is exactly the order §48 forbids. So this tool derives the
 * candidate dumps arithmetically from the shipped one.
 *
 * ── The arms, and why one is not enough ────────────────────────────────────
 *
 *   stretch   every coordinate x k, every prop SIZE unchanged. Four times the floor,
 *             the same 27 cover boxes. Cover DENSITY falls to 1/k^2 of today's.
 *   tile      the whole layout replicated into a k x k grid of quadrants. Cover density
 *             is held EXACTLY constant, so the only thing that changed is distance.
 *   hub       Uri's own rules: density held, ONE pot dead centre at shipped scale, true
 *             180-degree point symmetry. The only arm that is a shipping candidate.
 *
 * They bracket the real answer. `stretch` is what you get if the size ships and the
 * layout is not re-authored; `tile` is the mechanical density-preserving bound; `hub` is
 * the one that honours the design rules. A single arm would be reporting one layout
 * decision as if it were the size decision.
 *
 * ── ⚠️ CORRECTION TO `0a63d96`'s COMMIT MESSAGE, WHICH IS A PRIMARY SOURCE ──
 *
 * That message states, of the aggregate player win rate:
 *
 *     "Aggregate win rate moves 2-6 pp, INSIDE its ~9 pp floor — do not act on it."
 *
 * **That is true for `stretch` and `tile` and FALSE for `hub`, which is the arm that
 * matters.** Kept above verbatim rather than paraphrased, because the wrong sentence is
 * the one a future reader will find by grepping the log. Measured, same runs:
 *
 *     policy   arm        1x -> 2x            delta      vs the ~9 pp floor
 *     smart2   stretch    57.5% -> 55.3%     -2.2 pp     inside
 *     smart2   tile       57.5% -> 51.9%     -5.6 pp     inside
 *     smart2   hub        57.5% -> 44.1%    -13.4 pp     **OUTSIDE**
 *     chase    stretch    40.9% -> 41.7%     +0.8 pp     inside
 *     chase    tile       40.9% -> 42.2%     +1.2 pp     inside
 *     chase    hub        40.9% ->  1.7%    -39.2 pp     **OUTSIDE**
 *
 * So the size does NOT leave the aggregate alone on the layout Uri specified: it costs
 * the scripted player 13.4 pp, and the naive `chase` player is nearly wiped out (1.7%)
 * because the fog decides matches it never reaches an opponent in. The conclusion the
 * commit drew is unchanged — it is strengthened. The floor sentence was wrong.
 *
 * ⚠️ SIZES ARE NOT SCALED, IN EITHER ARM, AND THAT IS DELIBERATE. The characters do not
 * get bigger (`PLAYER_SIZE`), the weapons do not get longer (`REACH`), so a counter that
 * grows with the map would silently re-tune every cover interaction on top of the size
 * change and make the comparison uninterpretable. `--scale-sizes` exists ONLY so
 * `--selftest` can prove the default is doing something.
 *
 * ── Use ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/ax_layout.mjs --selftest
 *   node tools/tmp/ax_layout.mjs --mode stretch --k 2 --out shots/ax/arena_2x_stretch.json
 *   node tools/tmp/ax_layout.mjs --mode tile    --k 2 --out shots/ax/arena_2x_tile.json
 *   node tools/tmp/ax_layout.mjs --mode copy          --out shots/ax/arena_1x.json
 *
 * `--mode copy` is not a no-op convenience: every arm of every A/B in this pass reads a
 * PRIVATE copy, because `tools/arena.gameplay.json` is a shared file any peer may
 * `--refresh-arena` mid-sweep and a baseline that moves under you manufactures a delta.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

/** `arena/shared.ts` FOG_FIRST_CONTACT_S, and the same derivation as `MAX_SAFE_RADIUS`.
 *  Duplicated rather than imported because this file must run with no TS loader. The
 *  selftest asserts it against the shipped dump, so a drift here fails loudly. */
const FOG_FIRST_CONTACT_MS = 6000;

function derivedMaxSafe(width, height, matchDurationMs) {
  return Math.round(Math.hypot(width / 2, height / 2) / (1 - FOG_FIRST_CONTACT_MS / matchDurationMs));
}

/**
 * Scale a dump.
 *
 * @param {object} src        a parsed arena gameplay dump
 * @param {object} opts
 * @param {'copy'|'stretch'|'tile'} opts.mode
 * @param {number} opts.k     linear factor (area factor is k^2)
 * @param {number} opts.matchDurationMs
 * @param {boolean} [opts.scaleSizes]  scale prop w/h and hazard radii too (selftest only)
 * @param {boolean} [opts.onePot]      tile mode: keep exactly one `damage` hazard, centred
 */
export function scaleArena(src, opts) {
  const { mode, k, matchDurationMs, scaleSizes = false, onePot = false } = opts;
  const width = mode === 'copy' ? src.width : src.width * k;
  const height = mode === 'copy' ? src.height : src.height * k;
  const s = scaleSizes ? k : 1;

  const out = {
    id: src.id,
    displayName: src.displayName,
    width, height,
    center: { x: width / 2, y: height / 2 },
    maxSafeRadius: derivedMaxSafe(width, height, matchDurationMs),
    playerSpawn: null, enemySpawn: null,
    // 🚨 `spawns` AND `concealment` WERE MISSING FROM THIS OBJECT ENTIRELY until 2026-08-11,
    //    and the check below said `mode=copy is bit-identical to the shipped dump`. It was
    //    not: it compared against a HAND-LISTED SUBSET of the dump's keys, so the two fields
    //    it dropped were the two it did not list. **A synthesiser and its identity test
    //    written from the same mental model share the same blind spot** — the check's own
    //    comment says it exists because "a hand-written dump synthesiser drops a field", and
    //    it then failed to catch a hand-written dump synthesiser dropping two.
    //    The identity check now compares the FULL key set, so a third dropped field fails.
    //    ⚠️ Consequence worth naming: every arena this tool has ever built had NO
    //    concealment, so every pacing number measured on one describes a map with the
    //    concealment rules switched off. `mode: 'copy'` — the arm `as_cost` uses as its
    //    baseline — was affected too.
    spawns: [], concealment: [],
    cover: [], hazards: [],
  };
  /** Concealment regions map exactly like cover boxes: position transformed, size scaled by `s`. */
  const conceal = (src.concealment ?? []);
  const seats = (src.spawns ?? []);

  if (mode === 'copy') {
    out.playerSpawn = { ...src.playerSpawn };
    out.enemySpawn = { ...src.enemySpawn };
    out.cover = src.cover.map((c) => ({ ...c }));
    out.hazards = src.hazards.map((h) => ({ ...h }));
    out.spawns = seats.map((p) => ({ ...p }));
    out.concealment = conceal.map((b) => ({ ...b }));
    return out;
  }

  if (mode === 'stretch') {
    out.playerSpawn = { x: src.playerSpawn.x * k, y: src.playerSpawn.y * k };
    out.enemySpawn = { x: src.enemySpawn.x * k, y: src.enemySpawn.y * k };
    out.cover = src.cover.map((c) => ({ ...c, x: c.x * k, y: c.y * k, w: c.w * s, h: c.h * s }));
    out.hazards = src.hazards.map((h) => ({ ...h, x: h.x * k, y: h.y * k, radius: h.radius * s }));
    out.spawns = seats.map((p) => ({ ...p, x: p.x * k, y: p.y * k }));
    out.concealment = conceal.map((c) => ({ ...c, x: c.x * k, y: c.y * k, w: c.w * s, h: c.h * s }));
    return out;
  }

  if (mode === 'tile') {
    // k x k copies of the shipped layout, edge to edge. Odd tiles are MIRRORED so the
    // seam between two quadrants is not a wall of two identical prop rows — the shipped
    // layout is already 180-degree rotationally symmetric about its own centre, and a
    // naive translate-only tiling puts two spawn bays back to back.
    for (let ix = 0; ix < k; ix++) {
      for (let iy = 0; iy < k; iy++) {
        const flipX = ix % 2 === 1;
        const flipY = iy % 2 === 1;
        const mapX = (x) => ix * src.width + (flipX ? src.width - x : x);
        const mapY = (y) => iy * src.height + (flipY ? src.height - y : y);
        for (const c of src.cover) out.cover.push({ ...c, x: mapX(c.x), y: mapY(c.y), w: c.w, h: c.h });
        for (const h of src.hazards) out.hazards.push({ ...h, x: mapX(h.x), y: mapY(h.y) });
        // Concealment tiles with the cover it dresses — same mirror, same size.
        for (const c of conceal) out.concealment.push({ ...c, x: mapX(c.x), y: mapY(c.y), w: c.w, h: c.h });
      }
    }
    if (onePot) {
      const pots = out.hazards.filter((h) => h.kind === 'damage');
      out.hazards = out.hazards.filter((h) => h.kind !== 'damage');
      if (pots.length) out.hazards.push({ ...pots[0], x: out.center.x, y: out.center.y });
    }
    // Spawns: IDENTICAL to `stretch` (every coordinate x k), deliberately, and this is a
    // controlled-comparison decision rather than a level-design one.
    //
    // The obvious tiling choice — spawns at the same relative offset from opposite
    // CORNERS of the whole map — was written first and discarded after it was measured:
    // it puts them 2763.8 wu apart against stretch's 2204.4, so `tile` vs `stretch` would
    // have differed in BOTH cover density and spawn separation and neither could be
    // attributed. With this mapping the two 2x arms have the same spawn separation to the
    // wu, so `1x -> stretch` isolates SCALE and `stretch -> tile` isolates COVER DENSITY.
    out.playerSpawn = { x: src.playerSpawn.x * k, y: src.playerSpawn.y * k };
    out.enemySpawn = { x: src.enemySpawn.x * k, y: src.enemySpawn.y * k };
    out.spawns = seats.map((p) => ({ ...p, x: p.x * k, y: p.y * k }));
    // A spawn must not land inside a cover box (the fighter would start embedded).
    for (const spawn of [out.playerSpawn, out.enemySpawn]) {
      let guard = 0;
      while (out.cover.some((c) => Math.abs(spawn.x - c.x) < c.w / 2 + 20 && Math.abs(spawn.y - c.y) < c.h / 2 + 20) && guard++ < 200) {
        spawn.x += spawn.x < out.center.x ? 8 : -8;
      }
    }
    return out;
  }

  /**
   * `hub` — THE LAYOUT URI DESCRIBED, and the only arm that is a candidate for shipping.
   *
   *   > *"Obviously adding more obstacles, keeping the pot in the middle, things like that"*
   *
   * Three rules, and each one is an assertion in `--selftest` rather than a comment:
   *
   *   1. DENSITY IS HELD, so ~4x the area carries ~4x the props. `stretch` is the
   *      counter-example this arm exists to beat.
   *   2. THE HUB STAYS IN THE MIDDLE AT ITS CURRENT SCALE — one `boiling_pot`, one
   *      `fryer_counter`, one `sink_counter` and the four `stove_island`s that ring
   *      them, translated to the new centre and NOT resized, plus the one `damage`
   *      hazard. A hub that doubles is a different game object.
   *   3. TRUE 180-DEGREE POINT SYMMETRY about the map centre survives, because it is
   *      competitive fairness in the same category as `aspect.mjs` — both spawns must
   *      face an identical map.
   *
   * Construction: tile the NON-hub props k x k (that is what carries the density and the
   * symmetry), keep each quadrant's `stove_island`s as ordinary blocking counters so the
   * outer map has structure rather than only clutter, drop every quadrant's pot/fryer/sink,
   * and place ONE hub cluster at the true centre.
   *
   * ⚠️ THIS IS A MEASUREMENT FIXTURE, NOT A SHIPPABLE LAYOUT. It answers "what does the
   * pacing look like if the density and hub rules are honoured?" without pre-committing
   * `kitchen.ts` to a hand-authored placement. Rule 4 of the brief — genuine lanes and
   * rooms rather than a uniform sprinkle — is a design act this tool deliberately does NOT
   * simulate, so read this arm as the OPTIMISTIC bound on a density-preserving layout.
   */
  if (mode === 'hub') {
    const dc = (c) => Math.hypot(c.x - src.center.x, c.y - src.center.y);
    const isHub = (c) => HUB_KINDS.has(c.kind) && dc(c) <= HUB_RADIUS;
    const outer = src.cover.filter((c) => !isHub(c));
    const hub = src.cover.filter(isHub);

    for (let ix = 0; ix < k; ix++) {
      for (let iy = 0; iy < k; iy++) {
        const flipX = ix % 2 === 1;
        const flipY = iy % 2 === 1;
        const mapX = (x) => ix * src.width + (flipX ? src.width - x : x);
        const mapY = (y) => iy * src.height + (flipY ? src.height - y : y);
        for (const c of outer) out.cover.push({ ...c, x: mapX(c.x), y: mapY(c.y) });
        // Concealment is never a hub prop (the endgame keep-out forbids it), so it tiles whole.
        for (const c of conceal) out.concealment.push({ ...c, x: mapX(c.x), y: mapY(c.y) });
        // `stove_island` is the one hub kind that is also just a big blocking counter, so
        // the quadrant copies stay: they are the "new structure" the outer map needs, and
        // dropping them would put the density this arm exists to hold below `stretch`'s.
        for (const c of hub) {
          if (c.kind !== 'stove_island') continue;
          out.cover.push({ ...c, x: mapX(c.x), y: mapY(c.y) });
        }
        // Only the SLOW puddles tile. The damage hazard is the hub's and is placed once.
        for (const h of src.hazards) {
          if (h.kind === 'damage') continue;
          out.hazards.push({ ...h, x: mapX(h.x), y: mapY(h.y) });
        }
      }
    }

    // The hub, translated whole to the new centre. NOT resized — `w`/`h`/`radius` ride
    // through untouched, which is rule 2 stated as code.
    const ox = out.center.x - src.center.x;
    const oy = out.center.y - src.center.y;
    for (const c of hub) out.cover.push({ ...c, x: c.x + ox, y: c.y + oy });
    for (const h of src.hazards) {
      if (h.kind !== 'damage') continue;
      out.hazards.push({ ...h, x: h.x + ox, y: h.y + oy });
    }

    out.playerSpawn = { x: src.playerSpawn.x * k, y: src.playerSpawn.y * k };
    out.enemySpawn = { x: src.enemySpawn.x * k, y: src.enemySpawn.y * k };
    out.spawns = seats.map((p) => ({ ...p, x: p.x * k, y: p.y * k }));
    return out;
  }

  throw new Error(`unknown mode ${mode}`);
}

/**
 * The central stove hub, identified by KIND plus distance from the shipped centre rather
 * than by a coordinate list, so it keeps naming the right props if `kitchen.ts` nudges
 * one. `--selftest` pins the membership (7 props, the farthest at 336 wu) so a rename in
 * `kitchen.ts` fails loudly instead of silently emptying the hub.
 */
const HUB_KINDS = new Set(['boiling_pot', 'stove_island', 'fryer_counter', 'sink_counter']);
const HUB_RADIUS = 400;

/**
 * Every prop's 180-degree partner about the map centre exists, to `tol` wu.
 *
 * ── IT IS A GEOMETRIC CHECK, NOT A NOMINAL ONE, AND THAT WAS MEASURED ───────
 *
 * The first version also required the partner to have the same `kind`, and it FAILED on
 * the shipped 1400x1000 map — which was the right way to find out what `kitchen.ts`'s
 * symmetry contract actually means. The two offenders are `fryer_counter` (700,830) and
 * `sink_counter` (700,170): mirrored positions, IDENTICAL 150x70 boxes, different
 * dressing. Both spawns face the same blocking volume in the same place; one of them
 * looks like a fryer and the other like a sink.
 *
 * That is fair, and it is deliberate — a map where every prop is its own mirror image
 * reads as a blockout. So the fairness assertion is on POSITION and SIZE, which is what a
 * fighter collides with and shoots at, and `kind` is left free. A check that fails on the
 * shipped map would have been re-derived into uselessness the first time someone ran it.
 */
export function pointSymmetryFaults(arena, tol = 1e-6) {
  const faults = [];
  for (const c of arena.cover) {
    const px = 2 * arena.center.x - c.x;
    const py = 2 * arena.center.y - c.y;
    const hit = arena.cover.some((o) =>
      Math.abs(o.x - px) <= tol && Math.abs(o.y - py) <= tol
      // A partner that is a different SIZE is not a partner: one spawn would face a
      // 230x190 freezer and the other a 60x50 barrel at the mirrored coordinate.
      && Math.abs(o.w - c.w) <= tol && Math.abs(o.h - c.h) <= tol);
    if (!hit) faults.push(`${c.kind} (${c.x},${c.y}) has no partner at (${px},${py})`);
  }
  return faults;
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest — every assertion here names an implementation that would FAIL it.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log('\n══ ax_layout SELFTEST ══');

  const shipped = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
  const RULES = await import(`${ROOT}/src/game/rules.ts`);
  const T = RULES.MATCH_DURATION_MS;

  // 1. The duplicated fog derivation must reproduce the SHIPPED dump's own number.
  //    Fails if `FOG_FIRST_CONTACT_S` or the formula in `arena/shared.ts` moves.
  ok('the duplicated fog derivation reproduces the shipped dump\'s maxSafeRadius',
    derivedMaxSafe(shipped.width, shipped.height, T) === shipped.maxSafeRadius,
    `derived ${derivedMaxSafe(shipped.width, shipped.height, T)} vs dumped ${shipped.maxSafeRadius}`);

  // 2. copy is BIT-IDENTICAL. Fails for any implementation that rounds, reorders or
  //    drops a field — which is the whole risk of a hand-written dump synthesiser.
  {
    const c = scaleArena(shipped, { mode: 'copy', k: 1, matchDurationMs: T });
    // ⚠️ REWRITTEN. Old check, kept because its failure is the lesson:
    //      ok('mode=copy is bit-identical to the shipped dump',
    //         JSON.stringify(c) === JSON.stringify({ id, displayName, width, height, center,
    //           maxSafeRadius, playerSpawn, enemySpawn, cover, hazards }));
    //    That compared `c` against a HAND-LISTED SUBSET of the dump's keys — so the two keys
    //    `scaleArena` dropped (`spawns`, `concealment`) were exactly the two the check did
    //    not list, and "bit-identical" was asserted against a copy of the same omission.
    //    It now compares the KEY SET first and then every key by value, so the next dropped
    //    field fails on the first line instead of being invisible to the second.
    const wantKeys = Object.keys(shipped).sort();
    const gotKeys = Object.keys(c).sort();
    ok('mode=copy carries EVERY key the shipped dump has (no field is silently dropped)',
      JSON.stringify(gotKeys) === JSON.stringify(wantKeys),
      gotKeys.join(',') === wantKeys.join(',') ? `${gotKeys.length} keys`
        : `missing [${wantKeys.filter((x) => !gotKeys.includes(x)).join(',')}] extra [${gotKeys.filter((x) => !wantKeys.includes(x)).join(',')}]`);
    const differing = wantKeys.filter((key) => JSON.stringify(c[key]) !== JSON.stringify(shipped[key]));
    ok('mode=copy is bit-identical to the shipped dump, key by key',
      differing.length === 0, differing.join(',') || `${wantKeys.length} keys equal`);
    // KNOWN-BAD, and it is the defect this row failed to catch for its whole life: an
    // output with one key removed must be REFUSED. A subset comparison passes it.
    {
      const dropped = { ...c }; delete dropped.concealment;
      ok('…and the KNOWN-BAD (a dump synthesiser that drops `concealment`) is refused',
        JSON.stringify(Object.keys(dropped).sort()) !== JSON.stringify(wantKeys),
        `${Object.keys(dropped).length} keys vs ${wantKeys.length}`);
    }
    ok('…and the concealment regions survive `copy` in full (they used to be dropped)',
      c.concealment.length === shipped.concealment.length && c.concealment.length > 0,
      `${c.concealment.length} of ${shipped.concealment.length}`);
    ok('…and so do the N-fighter spawns',
      c.spawns.length === shipped.spawns.length && c.spawns.length > 0,
      `${c.spawns.length} of ${shipped.spawns.length}`);
  }

  // 3. stretch k=1 is also identity. Fails for an off-by-one in the mapping.
  {
    const a = scaleArena(shipped, { mode: 'stretch', k: 1, matchDurationMs: T });
    const c = scaleArena(shipped, { mode: 'copy', k: 1, matchDurationMs: T });
    ok('mode=stretch k=1 is identity', JSON.stringify(a) === JSON.stringify(c));
  }

  // 4. stretch k=2 doubles EVERY distance and NO size. This is the assertion that
  //    fails if sizes are scaled by accident — the exact fault `--scale-sizes` models.
  {
    const a = scaleArena(shipped, { mode: 'stretch', k: 2, matchDurationMs: T });
    const dBefore = Math.hypot(shipped.playerSpawn.x - shipped.enemySpawn.x, shipped.playerSpawn.y - shipped.enemySpawn.y);
    const dAfter = Math.hypot(a.playerSpawn.x - a.enemySpawn.x, a.playerSpawn.y - a.enemySpawn.y);
    const sizesHeld = a.cover.every((c, i) => c.w === shipped.cover[i].w && c.h === shipped.cover[i].h)
      && a.hazards.every((h, i) => h.radius === shipped.hazards[i].radius);
    ok('stretch k=2: spawn separation doubles AND every prop size is unchanged',
      Math.abs(dAfter - 2 * dBefore) < 1e-9 && sizesHeld, `sep ${dBefore.toFixed(1)} -> ${dAfter.toFixed(1)}`);
    const bad = scaleArena(shipped, { mode: 'stretch', k: 2, matchDurationMs: T, scaleSizes: true });
    ok('…and the KNOWN-BAD input (--scale-sizes) is caught by that same test',
      bad.cover.some((c, i) => c.w !== shipped.cover[i].w));
  }

  // 5. tile k=2 holds cover DENSITY exactly and multiplies the COUNT by k^2. Fails for
  //    a tiling that drops the mirrored quadrants or double-counts the seam.
  {
    const a = scaleArena(shipped, { mode: 'tile', k: 2, matchDurationMs: T });
    const densBefore = shipped.cover.reduce((s, c) => s + c.w * c.h, 0) / (shipped.width * shipped.height);
    const densAfter = a.cover.reduce((s, c) => s + c.w * c.h, 0) / (a.width * a.height);
    ok('tile k=2: cover count x4 and areal density unchanged to 1e-12',
      a.cover.length === shipped.cover.length * 4 && Math.abs(densAfter - densBefore) < 1e-12,
      `${shipped.cover.length} -> ${a.cover.length}, density ${densBefore.toFixed(5)} -> ${densAfter.toFixed(5)}`);
    ok('…and stretch k=2 does the OPPOSITE — same count, a quarter of the density',
      (() => {
        const s2 = scaleArena(shipped, { mode: 'stretch', k: 2, matchDurationMs: T });
        const d2 = s2.cover.reduce((s, c) => s + c.w * c.h, 0) / (s2.width * s2.height);
        return s2.cover.length === shipped.cover.length && Math.abs(d2 - densBefore / 4) < 1e-12;
      })());
    // …and the two 2x arms must be CONFOUND-FREE: same map, same spawn separation, so
    // the only thing that differs between them is cover density. Fails for the
    // corner-anchored spawn mapping this tool shipped first (2763.8 vs 2204.4 wu).
    {
      const s2 = scaleArena(shipped, { mode: 'stretch', k: 2, matchDurationMs: T });
      const sepT = Math.hypot(a.playerSpawn.x - a.enemySpawn.x, a.playerSpawn.y - a.enemySpawn.y);
      const sepS = Math.hypot(s2.playerSpawn.x - s2.enemySpawn.x, s2.playerSpawn.y - s2.enemySpawn.y);
      ok('the two 2x arms have IDENTICAL spawn separation, so stretch->tile isolates density',
        Math.abs(sepT - sepS) < 1e-9 && a.width === s2.width && a.height === s2.height,
        `tile ${sepT.toFixed(1)} vs stretch ${sepS.toFixed(1)} wu`);
    }
  }

  // 6. Every prop, hazard and spawn is INSIDE the new bounds in both arms. A prop pushed
  //    outside the playfield is unreachable cover the sim still line-of-sights against.
  for (const mode of ['stretch', 'tile']) {
    const a = scaleArena(shipped, { mode, k: 2, matchDurationMs: T });
    const inside = (x, y) => x >= 0 && x <= a.width && y >= 0 && y <= a.height;
    ok(`${mode} k=2: every prop, hazard and spawn is inside the new bounds`,
      a.cover.every((c) => inside(c.x, c.y)) && a.hazards.every((h) => inside(h.x, h.y))
      && inside(a.playerSpawn.x, a.playerSpawn.y) && inside(a.enemySpawn.x, a.enemySpawn.y));
  }

  // 7. No spawn is embedded in cover, in either arm. The shipped dump satisfies this;
  //    a tiling that puts a quadrant's furniture on top of the map corner would not.
  for (const mode of ['copy', 'stretch', 'tile']) {
    const a = scaleArena(shipped, { mode, k: 2, matchDurationMs: T });
    const embedded = (p) => a.cover.some((c) => Math.abs(p.x - c.x) < c.w / 2 && Math.abs(p.y - c.y) < c.h / 2);
    ok(`${mode}: neither spawn is embedded in a cover box`,
      !embedded(a.playerSpawn) && !embedded(a.enemySpawn));
  }

  // 8. The fog schedule is SCALE-INVARIANT in relative terms and NOT in absolute ones.
  //    This is the §48 fog question answered arithmetically before any match is run: it
  //    fails if someone "fixes" the derivation by pinning maxSafeRadius to a literal.
  {
    const a = scaleArena(shipped, { mode: 'stretch', k: 2, matchDurationMs: T });
    const relBefore = shipped.maxSafeRadius / Math.hypot(shipped.width / 2, shipped.height / 2);
    const relAfter = a.maxSafeRadius / Math.hypot(a.width / 2, a.height / 2);
    ok('the derived ring opens at the SAME multiple of the half-diagonal at both sizes',
      Math.abs(relBefore - relAfter) < 1e-3, `${relBefore.toFixed(4)} vs ${relAfter.toFixed(4)}`);
    const sweepBefore = shipped.maxSafeRadius / (T / 1000);
    const sweepAfter = a.maxSafeRadius / (T / 1000);
    ok('…but its ABSOLUTE sweep speed doubles, which is the thing that has to be judged',
      Math.abs(sweepAfter / sweepBefore - 2) < 0.01, `${sweepBefore.toFixed(1)} -> ${sweepAfter.toFixed(1)} wu/s`);
  }

  // ── 9. THE `hub` ARM — Uri's three rules, each as an assertion ────────────
  {
    const a = scaleArena(shipped, { mode: 'hub', k: 2, matchDurationMs: T });

    // (a) Hub membership is what this tool thinks it is. Fails on a `kitchen.ts` rename
    //     — which would otherwise empty the hub and leave the arm silently pot-less.
    const hub = shipped.cover.filter((c) => HUB_KINDS.has(c.kind)
      && Math.hypot(c.x - shipped.center.x, c.y - shipped.center.y) <= HUB_RADIUS);
    ok('the hub is the 7 props kitchen.ts rings the pot with',
      hub.length === 7 && hub.filter((c) => c.kind === 'stove_island').length === 4
      && hub.some((c) => c.kind === 'boiling_pot'),
      `${hub.length} props: ${[...new Set(hub.map((c) => c.kind))].join(', ')}`);

    // (b) RULE 2 — one damage hazard, at the exact centre, at its shipped radius, and
    //     the pot's own cover box with it, unresized.
    const dmg = a.hazards.filter((h) => h.kind === 'damage');
    const pot = a.cover.filter((c) => c.kind === 'boiling_pot');
    const srcPot = shipped.cover.find((c) => c.kind === 'boiling_pot');
    ok('RULE 2: exactly ONE pot, dead centre, at its shipped radius and box size',
      dmg.length === 1 && dmg[0].x === a.center.x && dmg[0].y === a.center.y
      && dmg[0].radius === shipped.hazards.find((h) => h.kind === 'damage').radius
      && pot.length === 1 && pot[0].x === a.center.x && pot[0].y === a.center.y
      && pot[0].w === srcPot.w && pot[0].h === srcPot.h,
      `${dmg.length} damage hazard(s), ${pot.length} pot box(es) at (${pot[0]?.x},${pot[0]?.y}) w${pot[0]?.w}`);

    // (c) RULE 1 — density held. `stretch` is the counter-example, so assert BOTH ways
    //     or the test passes for a layout that merely has more props than nothing.
    const dens = (x) => x.cover.reduce((s, c) => s + c.w * c.h, 0) / (x.width * x.height);
    const st = scaleArena(shipped, { mode: 'stretch', k: 2, matchDurationMs: T });
    ok('RULE 1: cover density is within 15% of the shipped map — and stretch is not',
      Math.abs(dens(a) / dens(shipped) - 1) < 0.15 && dens(st) / dens(shipped) < 0.3,
      `hub ${(dens(a) * 100).toFixed(2)}% · shipped ${(dens(shipped) * 100).toFixed(2)}% · stretch ${(dens(st) * 100).toFixed(2)}%`);
    ok('…and it carries ~4x the props, not 4x the prop SIZE',
      a.cover.length >= 3 * shipped.cover.length
      && a.cover.every((c) => shipped.cover.some((s0) => s0.w === c.w && s0.h === c.h)),
      `${shipped.cover.length} -> ${a.cover.length} props, every size drawn from the shipped set`);

    // (d) RULE 3 — TRUE 180-degree point symmetry. This is the assertion the brief calls
    //     worth more than any single placement, so it is also shown to FAIL: nudging one
    //     prop by 1 wu must break it, or it is a comment with a tick next to it.
    ok('RULE 3: every prop has its 180-degree partner about the map centre',
      pointSymmetryFaults(a).length === 0, pointSymmetryFaults(a).slice(0, 2).join(' · '));
    {
      const broken = JSON.parse(JSON.stringify(a));
      broken.cover[0].x += 1;
      ok('…and the symmetry check FAILS on a 1 wu nudge to one prop (a guard not shown to fail is not a guard)',
        pointSymmetryFaults(broken).length > 0, `${pointSymmetryFaults(broken).length} faults`);
    }
    // …and the SHIPPED map passes it, which is what makes the check a fairness test of
    // the game rather than a property of this tool's own arithmetic.
    // ⚠️ The label was hardcoded `the SHIPPED 1400x1000 map` and went on saying so after
    //    `6631446` made the shipped map 2800x2000 — while the ASSERTION was always reading
    //    `shipped`, i.e. whatever the dump is. So the row was correct and its label was a
    //    lie, which is the harder defect to notice: nothing goes red. Read from the dump now.
    ok(`…and the SHIPPED ${shipped.width}x${shipped.height} map passes the same check unmodified`,
      pointSymmetryFaults(shipped).length === 0, pointSymmetryFaults(shipped).slice(0, 2).join(' · '));
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// run
// ─────────────────────────────────────────────────────────────────────────────
const IN = String(args.in ?? `${ROOT}/tools/arena.gameplay.json`);
const src = JSON.parse(readFileSync(IN, 'utf8'));
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const out = scaleArena(src, {
  mode: String(args.mode ?? 'copy'),
  k: Number(args.k ?? 1),
  matchDurationMs: RULES.MATCH_DURATION_MS,
  scaleSizes: !!args['scale-sizes'],
  onePot: !!args['one-pot'],
});

const dens = out.cover.reduce((s, c) => s + c.w * c.h, 0) / (out.width * out.height);
const sep = Math.hypot(out.playerSpawn.x - out.enemySpawn.x, out.playerSpawn.y - out.enemySpawn.y);
console.log(`${args.mode ?? 'copy'} k=${args.k ?? 1}: ${out.width}x${out.height} · cover ${out.cover.length} (density ${(dens * 100).toFixed(2)}%) · hazards ${out.hazards.length} · spawn sep ${sep.toFixed(1)} wu · maxSafeRadius ${out.maxSafeRadius}`);

if (args.out) {
  const p = resolve(String(args.out));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(out, null, 2));
  console.log(`wrote ${p}`);
}
