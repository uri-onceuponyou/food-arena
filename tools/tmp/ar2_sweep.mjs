#!/usr/bin/env node
/**
 * AR2_SWEEP — where does the SCORED frame sit in the distribution of every frame the
 * shipped camera can produce?
 *
 * ## The question
 *
 * Six blind critics called our arena *"a flat pink tiled plane ... no props or height
 * variation, reading as an empty test floor rather than a designed arena"*. `ar2_frame.mjs`
 * measured that the frame they were shown holds **2 of the arena's 111 cover boxes and 0 of
 * its 20 concealment patches**, while four other stations hold 4-10 and 1-3. This turns that
 * into a distribution rather than five anecdotes: slide the shipped camera's ground quad over
 * a lattice of legal player positions and count what each frame contains.
 *
 * ## Why this needs no browser, and why that is not a shortcut
 *
 * The ground quad was UNPROJECTED from the live camera by `ar2_frame.mjs` and is a **rigid
 * translate** — all five stations returned the same trapezoid to the digit
 * (`[-357.73,-275.34] [357.73,-275.34] [242.97,123.10] [-242.97,123.10]`, area 239,344.7 wu²,
 * cross-checked against `__fairView()`'s halfWidth 289.39 / near-far 199.22 and against
 * `arena-scan.mjs`'s own documented 289.4 / 199.2). The arena's 111 cover boxes and 20
 * concealment boxes are read from the same BROWSER DUMP, not from source. So the only thing
 * done offline is arithmetic on measured data — nothing here re-derives framing.
 *
 * ⚠️ **Both inputs come from `ar2_frame.json` and neither is retyped.** If that file is
 * missing or holds a different arena, this refuses rather than assuming.
 *
 * ## `--selftest`
 *
 * Every arm asserts its set is NON-EMPTY before quantifying (`[].every()` is `true`), and the
 * two detectors are shown to MOVE on a planted known-bad.
 *
 *   node tools/tmp/ar2_sweep.mjs --in tools/tmp/ar2_out/ar2_frame.json
 *   node tools/tmp/ar2_sweep.mjs --selftest
 */
import { readFileSync } from 'node:fs';
import { boxInQuad } from './ar2_frame.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const has = (k) => argv.includes('--' + k);

const IN = arg('in', 'tools/tmp/ar2_out/ar2_frame.json');
const STEP = Number(arg('step', 20));

function load() {
  const d = JSON.parse(readFileSync(IN, 'utf8'));
  if (!d.rows?.length) throw new Error(`${IN}: no rows`);
  const r0 = d.rows[0];
  const rel = r0.quad.map(([x, y]) => [x - r0.px, y - r0.py]);
  // The rigid-translate claim is ASSERTED, not assumed: every station must agree to 0.01 wu.
  for (const r of d.rows) {
    r.quad.forEach(([x, y], i) => {
      if (Math.abs((x - r.px) - rel[i][0]) > 0.01 || Math.abs((y - r.py) - rel[i][1]) > 0.01) {
        throw new Error(`${IN}: station ${r.id} quad is not a rigid translate — the offline sweep is invalid`);
      }
    });
  }
  return { d, r0, rel };
}

/** Is a point inside a convex quad? Winding test — all four cross products agree in sign. */
export function pointInQuad(px, py, q) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (c > 0) s++; else if (c < 0) s--;
  }
  return Math.abs(s) === 4;
}

/**
 * 🚨 THE STATISTIC THAT MATTERS, AND THE COUNT IS NOT IT.
 *
 * The first version of this file ranked anchors by HOW MANY boxes fall in frame and produced a
 * "median density" candidate at (1400,740) with 6 boxes. Rendered and read as a PNG
 * (`CLAUDE.md` #3), that frame is **emptier than the one it was meant to replace**: its six
 * boxes are five counters clipped at the frame edges plus one small sink, and the middle of the
 * screen is bare tile. Measured here it is **9.0% footprint against the scored frame's 9.9%** —
 * a count of 6 against a count of 2, and the WRONG DIRECTION on the thing anyone cares about.
 *
 * So the ranking statistic is the share of the visible ground covered by a cover or concealment
 * FOOTPRINT, rasterised on a lattice inside the unprojected quad. It is world-space, so it
 * ignores prop HEIGHT and perspective weighting and is NOT comparable to a screen-area figure
 * like `DECISIONS §18`'s "35-45% in the reference frames" — it is comparable ACROSS ANCHORS ON
 * THIS MAP, which is the only comparison being made.
 */
export function footprint(px, py, rel, boxes, step = 6, centreHalf = [180, 110]) {
  const q = rel.map(([x, y]) => [x + px, y + py]);
  const near = boxes.filter((b) => boxInQuad(b, q));
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  let tot = 0, hit = 0, ctot = 0, chit = 0;
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
      if (!pointInQuad(x, y, q)) continue;
      tot++;
      const on = near.some((b) => Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2);
      if (on) hit++;
      if (Math.abs(x - px) < centreHalf[0] && Math.abs(y - py) < centreHalf[1]) { ctot++; if (on) chit++; }
    }
  }
  return { n: near.length, tot, share: tot ? hit / tot : 0, centre: ctot ? chit / ctot : 0 };
}

if (has('selftest')) {
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    ok ? pass++ : fail++;
  };
  console.log('\n§A — the input is real measured data, not a retyped constant');
  const { d, r0, rel } = load();
  check('the dump exists and carries stations', d.rows.length > 0, true);
  check('quad is a rigid translate across all stations (asserted in load())', rel.length, 4);
  check('the dumped arena is the ×4 map, not the retired 1× one', r0.arena.width > 1400 && r0.arena.height > 1000, true);

  console.log('\n§B — MOVES: the counter separates a dense neighbourhood from an empty one');
  const boxes = [
    { x: 1000, y: 1000, w: 100, h: 100 }, { x: 1050, y: 1010, w: 100, h: 100 },
    { x: 1100, y: 990, w: 100, h: 100 }, { x: 2600, y: 1800, w: 100, h: 100 },
  ];
  check('the planted set is NON-EMPTY', boxes.length > 0, true);
  const at = (px, py) => boxes.filter((b) => boxInQuad(b, rel.map(([x, y]) => [x + px, y + py]))).length;
  check('a frame over the cluster counts 3', at(1050, 1080), 3);
  check('KNOWN-BAD: a frame 1,000 wu away counts 0', at(150, 1080), 0);

  console.log('\n§C — the quad really is offset from its anchor (a symmetric quad would hide a yaw bug)');
  check('the quad extends further NORTH of the anchor than SOUTH (the 58° camera looks up-frame)',
    Math.abs(Math.min(...rel.map((p) => p[1]))) > Math.abs(Math.max(...rel.map((p) => p[1]))), true);

  console.log('\n§D — FOOTPRINT: the share metric MOVES, and it disagrees with the count on purpose');
  // One huge box vs three small ones: the COUNT says the three win 3-1, the SHARE says the
  // opposite. That disagreement is the whole reason this metric exists, so it is asserted.
  const big = [{ x: 1400, y: 1000, w: 400, h: 300 }];
  const many = [{ x: 1400, y: 940, w: 60, h: 60 }, { x: 1300, y: 1000, w: 60, h: 60 }, { x: 1500, y: 1000, w: 60, h: 60 }];
  check('both planted sets are NON-EMPTY', big.length > 0 && many.length > 0, true);
  const fBig = footprint(1400, 1000, rel, big), fMany = footprint(1400, 1000, rel, many);
  check('the COUNT prefers the three small boxes', fMany.n > fBig.n, true);
  check('the SHARE prefers the one large box (they disagree — that is the point)', fBig.share > fMany.share, true);
  check('KNOWN-BAD: an empty box list gives share EXACTLY 0, not a vacuous pass',
    footprint(1400, 1000, rel, []).share, 0);
  check('CONTROL: a box 5,000 wu away also gives 0', footprint(1400, 1000, rel, [{ x: 6400, y: 1000, w: 400, h: 300 }]).share, 0);
  check('the rasteriser sampled a NON-EMPTY set of ground cells (else every share is 0/0)', fBig.tot > 100, true);

  console.log(`\n${fail ? '🔴 FAIL' : '✅ PASS'}  ar2_sweep --selftest: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

const { d, r0, rel } = load();
const A = r0.arena;
// The box LISTS come from `ar2_boxes.json`, written by `ar2_frame.mjs` from the browser dump
// and asserted identical across every station there. `ar2_frame.json` carries only counts.
const BOXES = JSON.parse(readFileSync(arg('boxes', 'tools/tmp/ar2_out/ar2_boxes.json'), 'utf8'));
if (BOXES.width !== A.width || BOXES.height !== A.height) {
  console.error('ar2_sweep: the box dump and the station dump describe DIFFERENT arenas'); process.exit(1);
}
if (!BOXES.cover?.length) { console.error('ar2_sweep: the dumped cover list is EMPTY — every count below would be vacuous'); process.exit(1); }
if (!BOXES.concealment?.length) { console.error('ar2_sweep: the dumped concealment list is EMPTY — §29a is not placed on this tree'); process.exit(1); }

const quadAt = (px, py) => rel.map(([x, y]) => [x + px, y + py]);
const ALL_BOXES = [...BOXES.cover, ...BOXES.concealment];
const HALF = 21; // PLAYER_SIZE / 2 — an anchor inside a prop films a buried character.
const rows = [];
for (let py = 0; py <= A.height; py += STEP) {
  for (let px = 0; px <= A.width; px += STEP) {
    const q = quadAt(px, py);
    const c = BOXES.cover.filter((b) => boxInQuad(b, q)).length;
    const z = BOXES.concealment.filter((b) => boxInQuad(b, q)).length;
    const legal = px > 100 && py > 100 && px < A.width - 100 && py < A.height - 100
      && !BOXES.cover.some((b) => Math.abs(px - b.x) <= b.w / 2 + HALF && Math.abs(py - b.y) <= b.h / 2 + HALF);
    const f = footprint(px, py, rel, ALL_BOXES);
    rows.push({ px, py, c, z, legal, share: f.share, centre: f.centre, r: Math.hypot(px - A.center.x, py - A.center.y) });
  }
}
if (!rows.length) { console.error('ar2_sweep: the lattice is EMPTY'); process.exit(1); }

const pct = (arr, v) => (100 * arr.filter((a) => a < v).length) / arr.length;
const cs = rows.map((r) => r.c).sort((a, b) => a - b);
const zs = rows.map((r) => r.z).sort((a, b) => a - b);
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];

const anchor = d.rows.find((r) => r.id === 'q1_anchor');
console.log(`\n══ AR2 SWEEP ══  ${rows.length} anchors on a ${STEP} wu lattice · arena ${A.width}×${A.height}`);
console.log(`   frame = ${(r0.areaWu2).toFixed(0)} wu² = ${(100 * r0.areaWu2 / (A.width * A.height)).toFixed(2)}% of the map`);
console.log(`   arena declares ${BOXES.cover.length} cover boxes · ${BOXES.concealment.length} concealment patches\n`);
console.log(`   COVER boxes per frame     min ${cs[0]}  p10 ${q(cs, 0.1)}  MEDIAN ${q(cs, 0.5)}  p90 ${q(cs, 0.9)}  max ${cs[cs.length - 1]}  mean ${(cs.reduce((a, b) => a + b, 0) / cs.length).toFixed(2)}`);
console.log(`   CONCEAL patches per frame min ${zs[0]}  p10 ${q(zs, 0.1)}  MEDIAN ${q(zs, 0.5)}  p90 ${q(zs, 0.9)}  max ${zs[zs.length - 1]}  mean ${(zs.reduce((a, b) => a + b, 0) / zs.length).toFixed(2)}`);
console.log(`   frames with ZERO cover      ${(100 * cs.filter((v) => v === 0).length / cs.length).toFixed(1)}%`);
console.log(`   frames with ZERO conceal    ${(100 * zs.filter((v) => v === 0).length / zs.length).toFixed(1)}%`);

// ── FOOTPRINT SHARE — the statistic that matters. See `footprint()`'s header for why the
//    count above is NOT it, and for the candidate that the count picked and the pixels rejected.
const legalRows = rows.filter((r) => r.legal);
if (!legalRows.length) { console.error('ar2_sweep: the LEGAL anchor set is EMPTY — every share below would be vacuous'); process.exit(1); }
const ss = legalRows.map((r) => r.share).sort((a, b) => a - b);
console.log(`\n   FOOTPRINT share of visible ground (cover + concealment), ${legalRows.length} LEGAL anchors`);
console.log(`      p10 ${(100 * q(ss, 0.1)).toFixed(1)}%   MEDIAN ${(100 * q(ss, 0.5)).toFixed(1)}%   p90 ${(100 * q(ss, 0.9)).toFixed(1)}%   max ${(100 * ss[ss.length - 1]).toFixed(1)}%`);
console.log('      ⚠ world-space footprint, height-blind — NOT comparable to a screen-area figure.');

if (anchor) {
  const f = footprint(anchor.px, anchor.py, rel, ALL_BOXES);
  console.log(`\n   🔴 THE SCORED FRAME — q1 capture anchor (${anchor.px},${anchor.py}), from shots/q1/cap/capture-report.json`);
  console.log(`      cover     ${anchor.coverInFrame} boxes  → count percentile ${pct(cs, anchor.coverInFrame).toFixed(1)}`);
  console.log(`      conceal   ${anchor.concealInFrame} patches → count percentile ${pct(zs, anchor.concealInFrame).toFixed(1)}`);
  console.log(`      FOOTPRINT ${(100 * f.share).toFixed(1)}%      → share percentile ${pct(ss, f.share).toFixed(1)}   centre-of-frame ${(100 * f.centre).toFixed(1)}%`);
}

// The best anchor `q1_capture.mjs` would still accept — its §D requires the fight to land
// within 3× the pot's danger radius of the map centre. Reported so the owner of that file can
// judge the trade rather than be told a conclusion.
const POT_R = Number(arg('pot-radius', 95)), Q1_MAX_D = POT_R * 3;
const q1Legal = legalRows.filter((r) => r.r <= Q1_MAX_D).sort((a, b) => b.share - a.share);
const wide = legalRows.filter((r) => r.r <= 700).sort((a, b) => b.share - a.share);
if (!q1Legal.length || !wide.length) { console.error('ar2_sweep: an anchor candidate set is EMPTY'); process.exit(1); }
const show = (label, list) => {
  console.log(`\n   ${label}`);
  for (const o of list.slice(0, 4)) {
    console.log(`      (${String(o.px).padStart(4)},${String(o.py).padStart(4)})  d(pot) ${String(Math.round(o.r)).padStart(4)}  boxes ${o.c + o.z}  footprint ${(100 * o.share).toFixed(1)}%  centre ${(100 * o.centre).toFixed(1)}%  → pct ${pct(ss, o.share).toFixed(1)}`);
  }
};
show(`BEST anchors q1_capture §D would still accept (d ≤ 3×potR = ${Q1_MAX_D})`, q1Legal);
show('BEST anchors within 700 wu of the pot (§D would have to be relaxed)', wide);

// The hub: how much of the map is inside the concealment keep-out, and is it emptier?
const KEEPOUT = Math.max(140, A.maxSafeRadius * 0.25);
const inHub = rows.filter((r) => r.r <= KEEPOUT);
const outHub = rows.filter((r) => r.r > KEEPOUT);
if (!inHub.length || !outHub.length) { console.error('ar2_sweep: one side of the hub split is EMPTY'); process.exit(1); }
const mean = (a, k) => a.reduce((s, r) => s + r[k], 0) / a.length;
console.log(`\n   HUB SPLIT at concealmentKeepoutRadius = max(MIN_SAFE_RADIUS 140, maxSafeRadius ${A.maxSafeRadius.toFixed(2)} × 0.25) = ${KEEPOUT.toFixed(2)} wu`);
// Per-patch clearance on the box's NEAREST POINT — `movement.ts:concealmentInsideRadius` is a
// nearest-point test, because a band whose CENTRE is legal can still reach the hub.
{
  const near = BOXES.concealment.map((b) => {
    const dx = Math.max(0, Math.abs(b.x - A.center.x) - b.w / 2);
    const dy = Math.max(0, Math.abs(b.y - A.center.y) - b.h / 2);
    return { b, d: Math.hypot(dx, dy) };
  }).sort((p, q) => p.d - q.d);
  if (!near.length) { console.error('ar2_sweep: no concealment patches to clear-check'); process.exit(1); }
  const t = near[0];
  console.log(`      tightest patch: ${t.b.kind} at (${t.b.x},${t.b.y}) ${t.b.w}×${t.b.h} — nearest point ${t.d.toFixed(2)} wu, clears by ${(t.d - KEEPOUT).toFixed(2)} wu`);
  const bad = near.filter((p) => p.d < KEEPOUT);
  console.log(`      patches VIOLATING the keep-out: ${bad.length}` + (bad.length ? ` ← ${bad.map((p) => `(${p.b.x},${p.b.y})`).join(' ')}` : ''));
}
console.log(`      inside  (${inHub.length} anchors, ${(100 * inHub.length / rows.length).toFixed(1)}% of the lattice)  cover ${mean(inHub, 'c').toFixed(2)}  conceal ${mean(inHub, 'z').toFixed(2)}`);
console.log(`      outside (${outHub.length} anchors)                     cover ${mean(outHub, 'c').toFixed(2)}  conceal ${mean(outHub, 'z').toFixed(2)}`);

// The radial profile, because "the hub is empty" should be visible as a gradient.
console.log('\n   RADIAL PROFILE — mean boxes in frame by distance of the PLAYER from map centre');
for (let r0b = 0; r0b < 1400; r0b += 200) {
  const band = rows.filter((r) => r.r >= r0b && r.r < r0b + 200);
  if (!band.length) continue;
  const bc = mean(band, 'c'), bz = mean(band, 'z');
  console.log(`      ${String(r0b).padStart(4)}–${String(r0b + 200).padStart(4)} wu  n=${String(band.length).padStart(5)}  cover ${bc.toFixed(2).padStart(5)}  conceal ${bz.toFixed(2).padStart(5)}  ${'█'.repeat(Math.round(bc * 2))}`);
}
console.log('');
