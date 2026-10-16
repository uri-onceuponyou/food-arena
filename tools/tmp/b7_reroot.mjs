#!/usr/bin/env node
/**
 * b7_reroot — the RE-ROOT branch of `movement.ts:navSteer`, A/B between two trees (`docs/REVAMP.md`
 * §5, B7 — AI-B5, 2026-10-16). Owner of the `b7_` prefix.
 *
 * AI-B5 gave every fighter its OWN flow field instead of one per arena. On a connected floor a
 * field is a pure function of its goal cell, so the change can only move WHEN a flood runs; the
 * 316 cells of `b5_digest` hold that over whole matches. The one place a field is NOT a pure
 * function of its goal is the re-root — a goal in another connected component, where the
 * stand-in goal is the reachable cell nearest the TARGET POINT of the query that built the
 * field. With one shared field a second bot's query re-flooded it against a fresher point; with
 * a field per bot it keeps the stand the bot first chose, as a lone bot always did. So the two
 * caches CAN pick different stands, and this measures whether they do.
 *
 * The fixture: a floor cut in two by a full-height wall with no gap; bots on the west half,
 * humans on the east, each bot nearest the human straight across it — so every chase is a
 * re-root. Variants: `still` (the humans stand, as in B5's fixture), `walk` (every human walks
 * a scripted loop, so the bots' goal cells change and the target point moves INSIDE a goal cell,
 * which is the case where the stands could differ), at three and six seats. Digest: sha1 over
 * every event of every tick AND every fighter's x/y on every tick. A fresh arena object per run,
 * so no run can inherit another run's field on either tree.
 *
 *   node tools/tmp/b7_reroot.mjs --a <tree> --b <tree>     # identical / MOVED per variant, exit 1 on MOVED
 *   node tools/tmp/b7_reroot.mjs --root <tree>             # one tree: digests + flood/re-root counts
 *   node tools/tmp/b7_reroot.mjs --kitchen <tree> [--matches 6]   # how often the SHIPPED kitchen re-roots
 *   node tools/tmp/b7_reroot.mjs --selftest
 *
 * ⚠️ NON-VACUITY: a fixture that never takes the re-root branch would read "identical" for free.
 * `navStats.reroots` (added with the fix) counts the branch; a tree without it prints `n/a`, and
 * `--a/--b` requires every variant to have re-rooted on whichever tree has the counter.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ARGS = process.argv.slice(2);
const arg = (k, d) => { const i = ARGS.indexOf(`--${k}`); return i < 0 ? d : ARGS[i + 1]; };
const REPO = resolve(new URL('../..', import.meta.url).pathname);
const DT = 1000 / 60;
const RUN_MS = 20_000;

const load = async (root) => {
  const g = `${resolve(root)}/src/game`;
  const [sim, movement, rules] = await Promise.all([import(`${g}/sim.ts`), import(`${g}/movement.ts`), import(`${g}/rules.ts`)]);
  return { sim, movement, rules };
};

/**
 * W 2000 x H 1200. `split`: a 40 wu wall down x = 1000 covering the full height (and past both
 * edges). `pocket`: a sealed 400 x 400 box (30 wu walls) around the centre — the humans are
 * INSIDE it. Behind a straight wall the nearest reachable cell is always in the target's own row,
 * so the stand is a function of the goal cell and the two caches cannot differ; a target near a
 * pocket's corner has TWO near-equal stands (across the west wall, across the north wall), and
 * which wins depends on where inside its cell the target stands — the case that can tell them apart.
 */
const arenaFor = (variant) => ({
  id: 'b7-split', displayName: 'b7 split', width: 2000, height: 1200, center: { x: 1000, y: 600 }, maxSafeRadius: 1e6,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 1800, y: 1000 },
  cover: variant === 'pocket'
    ? [{ x: 1000, y: 385, w: 430, h: 30 }, { x: 1000, y: 815, w: 430, h: 30 }, { x: 785, y: 600, w: 30, h: 430 }, { x: 1215, y: 600, w: 30, h: 430 }]
    : [{ x: 1000, y: 600, w: 40, h: 1400 }],
  hazards: [], build: () => null, update: () => {},
});

/** `split`/`walk`: n/2 bots west of the wall, n/2 humans east, each pair facing across it 140 wu
 *  apart. `pocket`: the bots stand off three sides of the box, the humans inside it. */
const seats = (variant, n) => {
  const pairs = n / 2;
  const out = [];
  if (variant === 'pocket') {
    const bots = [[560, 520], [1440, 700], [920, 160]];
    const hums = [[880, 480], [1120, 720], [1000, 560]];
    for (let k = 0; k < pairs; k++) {
      out.push({ controller: 'ai', x: bots[k][0], y: bots[k][1] });
      out.push({ controller: 'human', x: hums[k][0], y: hums[k][1] });
    }
    return out;
  }
  for (let k = 0; k < pairs; k++) {
    const y = 1200 * (k + 0.5) / pairs;
    out.push({ controller: 'ai', x: 930, y });
    out.push({ controller: 'human', x: 1070, y });
  }
  return out;
};
/** Which side of the cut each seat must still be on at the end (the floor really is split). */
const onOwnSide = (variant, f, c) => (variant === 'pocket'
  ? (c === 'human') === (f.x > 800 && f.x < 1200 && f.y > 400 && f.y < 800)
  : (c === 'ai' ? f.x < 1000 : f.x > 1000));

/** A deterministic loop per human: each circles at its own rate, so it crosses goal cells AND
 *  wanders inside them. `null` (stand still) for the `still` variant. */
const humanMove = (variant, slot, t) => {
  if (variant === 'still') return { x: 0, y: 0 };
  const w = 0.0011 + 0.00037 * slot;
  return { x: Math.cos(t * w + slot), y: Math.sin(t * w * 1.3 + slot) };
};

export function runVariant(S, variant, n) {
  const arena = arenaFor(variant);
  const plan = seats(variant, n);
  const ids = S.rules.CHARACTER_IDS;
  const st = S.sim.createMatch(arena, plan.map((s, i) => ({
    characterId: ids[(i * 3) % ids.length], controller: s.controller, spawn: { x: s.x, y: s.y },
  })));
  st.phase = 'playing';
  const h = createHash('sha1');
  S.movement.navStats.reset();
  const steps = Math.round(RUN_MS / DT);
  for (let k = 0; k < steps; k++) {
    const inputs = plan.map((s, i) => (s.controller === 'human'
      ? { move: humanMove(variant, i, st.elapsed), selectedWeapon: 0, attack: false } : null));
    h.update(JSON.stringify(S.sim.stepMatch(st, DT, inputs)));
    h.update(JSON.stringify(st.fighters.map((f) => [f.x, f.y])));
  }
  const ns = S.movement.navStats;
  return {
    h: h.digest('hex').slice(0, 16), floods: ns.fieldBuilds, queries: ns.queries,
    reroots: typeof ns.reroots === 'number' ? ns.reroots : null,
    westOnly: st.fighters.every((f, i) => onOwnSide(variant, f, plan[i].controller)),
  };
}

const VARIANTS = [['still', 2], ['still', 6], ['walk', 2], ['walk', 6], ['pocket', 2], ['pocket', 6]];
const fmt = (r) => `${r.h} · floods ${r.floods} / queries ${r.queries} · re-roots ${r.reroots ?? 'n/a'}`;

/** How often the SHIPPED kitchen takes the re-root branch: whole all-bot six-seat matches. */
export function kitchenReroots(S, matches) {
  const dump = JSON.parse(readFileSync(`${REPO}/tools/arena.gameplay.json`, 'utf8'));
  const ids = S.rules.CHARACTER_IDS;
  let reroots = 0, queries = 0, floods = 0;
  for (let m = 0; m < matches; m++) {
    const arena = { ...dump, build: () => null, update: () => {} };
    const st = S.sim.createMatch(arena, Array.from({ length: 6 }, (_, i) => ({
      characterId: ids[(m + i) % ids.length], controller: 'ai', spawn: dump.spawns[i],
    })));
    S.movement.navStats.reset();
    const none = new Array(6).fill(null);
    while (st.phase !== 'ended' && st.elapsed < 200_000) S.sim.stepMatch(st, 16.667, none);
    reroots += S.movement.navStats.reroots ?? NaN;
    queries += S.movement.navStats.queries;
    floods += S.movement.navStats.fieldBuilds;
  }
  return { matches, reroots, queries, floods };
}

const IS_MAIN = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (ARGS.includes('--selftest')) {
    // The comparison is an instrument: the same tree twice must read identical (determinism), a
    // perturbed run must read DIFFERENT (it can report a move), and the fixture must RE-ROOT on a
    // tree that counts it — otherwise "identical" is free.
    const S = await load(REPO);
    const a = runVariant(S, 'walk', 6);
    const b = runVariant(S, 'walk', 6);
    const still = runVariant(S, 'still', 6);
    const rows = [
      [a.h === b.h, `the same variant twice digests identically (${a.h})`],
      [a.h !== still.h, `a different input digests DIFFERENTLY (walk ${a.h} vs still ${still.h})`],
      [typeof a.reroots === 'number' && a.reroots > 0 && still.reroots > 0, `the fixture takes the re-root branch (walk ${a.reroots}, still ${still.reroots} of ${a.queries} / ${still.queries} queries)`],
      [a.westOnly && still.westOnly, 'nobody crossed the wall — the floor really is split'],
    ];
    for (const [ok, msg] of rows) console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
    // A COUNT LINE (T1b, 2026-10-16): gatecount registers this selftest against it.
    console.log(`\nb7_reroot --selftest: ${rows.filter(([ok]) => ok).length} passed, ${rows.filter(([ok]) => !ok).length} failed`);
    process.exit(rows.every(([ok]) => ok) ? 0 : 1);
  }
  if (ARGS.includes('--kitchen')) {
    const S = await load(arg('kitchen'));
    const r = kitchenReroots(S, Number(arg('matches', 6)));
    console.log(`shipped kitchen, ${r.matches} all-bot six-seat matches: ${r.reroots} re-roots in ${r.queries} nav queries (${r.floods} floods)`);
    process.exit(0);
  }
  if (ARGS.includes('--a')) {
    const A = await load(arg('a')), B = await load(arg('b'));
    let moved = 0, vacuous = 0;
    for (const [v, n] of VARIANTS) {
      const ra = runVariant(A, v, n), rb = runVariant(B, v, n);
      const counted = [ra.reroots, rb.reroots].filter((x) => typeof x === 'number');
      if (counted.length === 0 || counted.some((x) => x === 0) || !ra.westOnly || !rb.westOnly) vacuous++;
      if (ra.h !== rb.h) moved++;
      console.log(`${v.padEnd(5)} N=${n}  ${ra.h === rb.h ? 'IDENTICAL' : 'MOVED    '}  a ${fmt(ra)}\n                    b ${fmt(rb)}`);
    }
    if (vacuous) { console.log(`VACUOUS: ${vacuous} variant(s) never re-rooted (or crossed the wall) on a tree that counts it`); process.exit(2); }
    process.exit(moved ? 1 : 0);
  }
  const root = arg('root', null);
  if (!root) { console.error('b7_reroot: --a/--b, --root, --kitchen or --selftest (see the header)'); process.exit(2); }
  const S = await load(root);
  for (const [v, n] of VARIANTS) console.log(`${v.padEnd(5)} N=${n}  ${fmt(runVariant(S, v, n))}`);
}
