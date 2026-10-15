#!/usr/bin/env node
/**
 * A2B_DISTRICT — the hub district (graphics campaign A2b, `docs/REVAMP.md` §5 A2, wave 4) as
 * DATA, checked before it is written into `src/arena/kitchen.ts` and checked again on the
 * browser dump after it is. Owner: work package A2b. Prefix `a2b_` (on 2026-10-15 neither
 * `git ls-files tools/tmp` nor `ls tools/tmp` held one).
 *
 * ── Why a separate tool and not `x4_layout.mjs` ────────────────────────────────────────
 * `kitchen.ts`'s header calls `x4_layout.mjs` "the generator", and it is the right idea: hold
 * the design as data, mirror it by TRANSFORM, check it, then emit literal call sites. But
 * `x4_layout` checks ITS OWN `NORTH` table, not the shipped arena — and that table has already
 * drifted from `kitchen.ts` (its `PUDDLE_SOUTH` is (1830,1250); the shipped south puddle is
 * (1950,1100)). Editing it is outside this package's file set. So this file IMPORTS every check
 * `x4_layout` and `sp_place` export and points them at:
 *
 *   * the CANDIDATE: the base dump (pinned to git, never read off disk — a baseline that lives
 *     at a mutable path is not one) plus `DISTRICT`, mirrored; and
 *   * the SHIPPED dump (`--shipped`), which must EQUAL that candidate box for box, so a
 *     hand-typed coordinate in `kitchen.ts` that disagrees with this table is a fault.
 *
 * ── What it checks (each one is shown to FAIL on its own bug by --selftest) ─────────────
 *   symmetry · overlap (mesh clip) · gaps (16 < gap < 82 illegal) · diagonal notches · rule 6
 *   (nothing solid inside the N=6 final ring + a body) · deep band regions at body-visual
 *   18/22/26 · concealment (cap, keep-out, >= 95% standable, UNCHANGED from base) · nav (one
 *   component at the 20 wu cell, every spawn in it) · spawns (every `sp_place` rule, UNCHANGED
 *   from base) · puddles (every cell of each slow disc standable) · base superset (no base box
 *   moved or lost) · stations (the w3 canonical trace seats and `rv_capture`'s 1v1 anchor stay
 *   legal) · the closing-ring occlusion series must END at or below where it STARTS
 *   (`arena_probe --occl`'s rule, re-implemented with its constants) · density reported.
 *
 *   node tools/tmp/a2b_district.mjs                 # candidate: every check, exit 1 on a fault
 *   node tools/tmp/a2b_district.mjs --emit          # the kitchen.ts call sites for DISTRICT
 *   node tools/tmp/a2b_district.mjs --json <path>   # the candidate as an arena dump
 *   node tools/tmp/a2b_district.mjs --shipped [p]   # the shipped dump: every check + == candidate
 *   node tools/tmp/a2b_district.mjs --selftest      # the known-bad battery
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const X4 = await import(`${ROOT}/tools/tmp/x4_layout.mjs`);
const SP = await import(`${ROOT}/tools/tmp/sp_place.mjs`);
const { PLAYER_SIZE } = X4;
const HALF = PLAYER_SIZE / 2;

/** The tree this package started from. Its dump is the baseline; read out of git. */
export const BASE_SHA = 'f9bed66';
export function baseArena() {
  return JSON.parse(execFileSync('git', ['show', `${BASE_SHA}:tools/arena.gameplay.json`], { cwd: ROOT, encoding: 'utf8' }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// THE DISTRICT — the design half only; every row's 180-degree partner is generated.
// `[x, y, w, h, kind, build]`, `build` the literal argument expression kitchen.ts passes.
//
//   * THE PASS (the landmark): a double-sided service counter on the E-W axis under a heat-lamp
//     gantry. It splits the 390 wu cardinal lane between the NE and SE islands into two
//     167.5 wu streets, the way the sink and fryer counters already split the N/S lanes into
//     two 160 wu streets — so all four approaches to the plaza now read alike. Its inner end
//     is 290 wu from the pot (rule 6 needs 279), its outer corner 71.1 wu from the south
//     puddle's centre (the disc is r 50: every cell stays standable).
//   * THE NE RUN: a counter butted onto the NE island's outer end, so the island becomes one
//     295 wu wall along the north side of the east lane; 85 wu short of the cook line (a
//     corridor, not a slit).
//   * THE NW RETURN: a counter butted onto the NW island's inner end, running north — the island
//     and it are an L that frames the north-west street to the sink counter. 80 wu, not the 115
//     first drawn: `al_guard` §C found `np_dbg.mjs`'s boot station (1120,610) inside the longer
//     one, and a station a fighter cannot stand on is a broken tool, not a style choice.
// ─────────────────────────────────────────────────────────────────────────────────────────
export const DISTRICT = [
  [1785, 1000, 190, 55, 'pass_counter', 'buildPassCounter(M, w, d)'],
  [1867.5, 760, 125, 55, 'prep_counter', 'buildPrepCounter(M, w, d, { rollingPin: true })'],
  [1137.5, 675, 55, 80, 'counter_run', 'buildCounterRun(M, w, d)'],
];

/** The w3 canonical shutter seats (rv_capture traces) and the 1v1 driver's anchor. A district
 * that swallows one of them moves the scored frames for a reason that is not the district. */
export const STATIONS = [
  { id: 'rv anchor (1v1)', x: 1560, y: 1000 },
  { id: 'w3 arena slot0', x: 1732, y: 1155 }, { id: 'w3 arena slot1', x: 1840, y: 1148 },
  { id: 'w3 arena6 slot0', x: 1174, y: 916 }, { id: 'w3 arena6 slot4', x: 1343, y: 879 },
  { id: 'w3 arena6 slot5', x: 1264, y: 969 },
];

export function districtBoxes(rows = DISTRICT, W = 2800, H = 2000) {
  const out = [];
  for (const [x, y, w, h, kind, build] of rows) {
    out.push({ x, y, w, h, kind, build });
    out.push({ x: W - x, y: H - y, w, h, kind, build, yawDeg: 180 });
  }
  return out;
}

export function candidate(base = baseArena(), rows = DISTRICT) {
  const d = districtBoxes(rows, base.width, base.height).map(({ build: _b, yawDeg: _y, ...c }) => c);
  return { ...base, cover: [...base.cover, ...d] };
}

// ── checks this file owns (the rest are imported) ─────────────────────────────────────────
const boxDist = (px, py, c, pad = 0) => Math.hypot(
  Math.max(0, Math.abs(px - c.x) - c.w / 2 - pad), Math.max(0, Math.abs(py - c.y) - c.h / 2 - pad));
const blockedAt = (x, y, arena) => arena.cover.some((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2);

/** Every cell of every slow disc must be standable: no cover's collision collar may touch it. */
export function puddleFaults(arena) {
  const slow = arena.hazards.filter((h) => h.kind === 'slow');
  if (!slow.length) return ['no slow hazard found — the check would be vacuous'];
  const out = [];
  for (const h of slow) for (const c of arena.cover) {
    const d = boxDist(h.x, h.y, c, HALF);
    if (d < h.radius) out.push(`${c.kind}@${c.x},${c.y}: its collar reaches ${(h.radius - d).toFixed(1)} wu into the slow disc at (${h.x},${h.y})`);
  }
  return out;
}

const key = (c) => `${c.kind}@${c.x},${c.y},${c.w}x${c.h}`;
/** Nothing the base had may move or vanish: cover, concealment, spawns, hazards. */
export function baseFaults(arena, base) {
  const out = [];
  const have = new Set(arena.cover.map(key));
  for (const c of base.cover) if (!have.has(key(c))) out.push(`base cover LOST or MOVED: ${key(c)}`);
  const cj = (a) => JSON.stringify((a ?? []).map(key).sort());
  if (cj(arena.concealment) !== cj(base.concealment)) out.push('concealment differs from base');
  if (JSON.stringify(arena.spawns) !== JSON.stringify(base.spawns)) out.push('spawns differ from base');
  const hj = (a) => JSON.stringify(a.map((h) => `${h.kind}@${h.x},${h.y},r${h.radius}`).sort());
  if (hj(arena.hazards) !== hj(base.hazards)) out.push('hazards differ from base');
  return out;
}

export function stationFaults(arena, stations = STATIONS) {
  return stations.filter((s) => blockedAt(s.x, s.y, arena)).map((s) => `${s.id} (${s.x},${s.y}) is inside a cover collar`);
}

/** `arena_probe --occl`, same constants: 40x40 grid, 72 rays, 140 wu rung, 12 wu ray box,
 * the ring from maxSafeRadius to MIN_SAFE_RADIUS in 8 steps. Returns the series. */
export function occlusionSeries(arena, minSafe = 140, rung = 140) {
  const STEP = 280 / 60, ANG = 72, GRID = 40, R0 = arena.maxSafeRadius;
  const hit = (x0, y0, a) => {
    const cx = Math.cos(a), cy = Math.sin(a);
    for (let t = 0; t < rung;) {
      t = Math.min(t + STEP, rung);
      const x = x0 + cx * t, y = y0 + cy * t;
      if (arena.cover.some((o) => Math.abs(x - o.x) < (12 + o.w) / 2 && Math.abs(y - o.y) < (12 + o.h) / 2)) return true;
    }
    return false;
  };
  const rows = [];
  for (let i = 0; i <= 8; i++) {
    const R = R0 + (minSafe - R0) * (i / 8);
    let n = 0, b = 0;
    for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) {
      const x = ((gx + 0.5) / GRID) * arena.width, y = ((gy + 0.5) / GRID) * arena.height;
      if (Math.hypot(x - arena.center.x, y - arena.center.y) > R || blockedAt(x, y, arena)) continue;
      for (let a = 0; a < ANG; a++) { n++; if (hit(x, y, (a / ANG) * Math.PI * 2)) b++; }
    }
    rows.push({ R: Math.round(R), occl: n ? b / n : null });
  }
  return rows;
}

export function allFaults(arena, base, { deep = true } = {}) {
  const f = {};
  f.symmetry = X4.symmetryFaults(arena);
  f.overlap = X4.overlapFaults(arena);
  f.gaps = X4.gapFaults(arena).map((g) => `${g.gap} wu over ${g.run} — ${g.a.kind}@${g.a.x},${g.a.y} / ${g.b.kind}${g.b.x !== undefined ? `@${g.b.x},${g.b.y}` : ''}`);
  f.notches = X4.notchFaults(arena);
  f.ring6 = X4.ringFaults(arena);
  if (deep) for (const v of [18, 22, 26]) f[`deep${v}`] = X4.deepRegions(arena, v).map((c) => `(${c.x},${c.y}) depth ${c.depth}`);
  f.conceal = X4.concealFaults(arena);
  const nav = X4.navReport(arena);
  f.nav = nav.oneComponent ? [] : [`spawns in ${new Set(nav.spawnComps).size} components (${nav.comps} total)`];
  f.spawns = arena.spawns.flatMap((s, i) => SP.violations(s, arena).map((v) => `slot ${i} (${s.x},${s.y}): ${v}`));
  f.puddles = puddleFaults(arena);
  f.base = baseFaults(arena, base);
  f.stations = stationFaults(arena);
  const occ = occlusionSeries(arena);
  f.occlusion = occ[8].occl <= occ[0].occl ? [] : [`the endgame CLOSES: ${(occ[0].occl * 100).toFixed(1)}% -> ${(occ[8].occl * 100).toFixed(1)}%`];
  return { faults: f, nav, occ };
}

function report(arena, base, label) {
  if (!arena.cover.length || !base.cover.length) throw new Error('a2b_district: an EMPTY cover list — refusing to certify nothing');
  const { faults, nav, occ } = allFaults(arena, base);
  const area = (a) => a.cover.reduce((s, c) => s + c.w * c.h, 0) / (a.width * a.height);
  const added = arena.cover.length - base.cover.length;
  console.log(`\n== A2B DISTRICT — ${label}`);
  console.log(`   cover ${base.cover.length} -> ${arena.cover.length} (+${added}) · solid floor ${(area(base) * 100).toFixed(2)}% -> ${(area(arena) * 100).toFixed(2)}%`);
  console.log(`   nav cell ${nav.cell} · ${nav.open} passable · ${nav.comps} component(s) · spawns in ${new Set(nav.spawnComps).size}`);
  const bocc = occlusionSeries(base);
  console.log(`   occlusion vs ring  R:    ${occ.map((r) => String(r.R).padStart(5)).join(' ')}`);
  console.log(`                      base: ${bocc.map((r) => (r.occl * 100).toFixed(1).padStart(5)).join(' ')}`);
  console.log(`                      this: ${occ.map((r) => (r.occl * 100).toFixed(1).padStart(5)).join(' ')}`);
  let bad = 0;
  for (const [k, v] of Object.entries(faults)) {
    if (!v.length) { console.log(`   ok   ${k}`); continue; }
    bad += v.length;
    console.log(`   FAIL ${k}: ${v.length}`);
    for (const s of v.slice(0, 6)) console.log(`          ${s}`);
  }
  console.log(`\n   ${bad ? `🔴 ${bad} FAULTS` : '✅ every check passed'}\n`);
  return bad;
}

// ── emit: kitchen.ts's literal call sites (arena_probe's extractor reads literals only) ──
function emit() {
  const L = [];
  for (const [x, y, w, h, kind, build] of DISTRICT) {
    const mx = Number.isInteger(x) ? `ARENA_W - ${x}` : `ARENA_W - ${x}`;
    L.push(`  addCover(propsGroup, cover, M, {\n    x: ${x}, y: ${y}, w: ${w}, h: ${h}, kind: '${kind}',\n    build: (w, d) => ${build},\n  });`);
    L.push(`  addCover(propsGroup, cover, M, {\n    x: ${mx}, y: ARENA_H - ${y}, w: ${w}, h: ${h}, kind: '${kind}', yawDeg: 180,\n    build: (w, d) => ${build},\n  });`);
  }
  return L.join('\n');
}

// ── selftest: every check must FAIL on its own bug ────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${detail}`}`); };
  const base = baseArena();
  check('base dump is the 2800x2000 map with its six spawns', base.width === 2800 && base.height === 2000 && base.spawns.length === 6);
  check('base cover list is non-empty (every assertion below runs over it)', base.cover.length > 100, `${base.cover.length}`);
  check('the DISTRICT is non-empty', DISTRICT.length > 0);
  const cand = candidate(base);
  check('candidate = base + 2 x DISTRICT boxes', cand.cover.length === base.cover.length + 2 * DISTRICT.length);
  const good = allFaults(cand, base, { deep: false }).faults;
  const nGood = Object.values(good).reduce((s, v) => s + v.length, 0);
  check('the shipped design passes every (non-deep) check', nGood === 0, JSON.stringify(Object.fromEntries(Object.entries(good).filter(([, v]) => v.length))));
  // each known-bad must make ITS check fire
  const mut = (fn) => { const a = JSON.parse(JSON.stringify(cand)); fn(a); return allFaults(a, base, { deep: false }).faults; };
  const dIdx = base.cover.length; // first district box
  check('KNOWN-BAD symmetry: a district box nudged 1 wu', mut((a) => { a.cover[dIdx].x += 1; }).symmetry.length > 0);
  check('KNOWN-BAD rule 6: a box at r 200', mut((a) => { a.cover.push({ x: 1600, y: 1000, w: 40, h: 40, kind: 'kb' }, { x: 1200, y: 1000, w: 40, h: 40, kind: 'kb' }); }).ring6.length > 0);
  check('KNOWN-BAD gaps: a 40 wu face gap', mut((a) => { a.cover.push({ x: 1785, y: 1000 - 27.5 - 40 - 10, w: 60, h: 20, kind: 'kb' }); }).gaps.length > 0);
  check('KNOWN-BAD puddle: a box on the south puddle collar', mut((a) => { a.cover.push({ x: 1950, y: 1180, w: 40, h: 40, kind: 'kb' }); }).puddles.length > 0);
  check('KNOWN-BAD spawns: a box 34 wu down slot 4\'s runway (the rule is 45 + 4)', mut((a) => { a.cover.push({ x: 1590, y: 575, w: 40, h: 20, kind: 'kb' }); }).spawns.length > 0);
  check('KNOWN-BAD conceal: a box over a patch', mut((a) => { a.cover.push({ x: 1215, y: 420, w: 30, h: 30, kind: 'kb' }); }).conceal.length > 0);
  check('KNOWN-BAD base: a base box removed', mut((a) => { a.cover.splice(3, 1); }).base.length > 0);
  check('KNOWN-BAD base: a concealment patch moved', mut((a) => { a.concealment[0].x += 5; }).base.length > 0);
  check('KNOWN-BAD stations: a box on the rv anchor', mut((a) => { a.cover.push({ x: 1560, y: 1000, w: 20, h: 20, kind: 'kb' }); }).stations.length > 0);
  check('KNOWN-BAD overlap: a box inside another', mut((a) => { a.cover.push({ x: 1785, y: 1000, w: 20, h: 20, kind: 'kb' }); }).overlap.length > 0);
  check('KNOWN-BAD nav: slot 4 sealed in a box ring', mut((a) => {
    for (const [x, y, w, h] of [[1590, 430, 200, 20], [1590, 590, 200, 20], [1500, 510, 20, 140], [1680, 510, 20, 140]]) a.cover.push({ x, y, w, h, kind: 'kb' });
  }).nav.length > 0);
  // occlusion: a wall of boxes ringing the plaza at r ~150 must make the endgame CLOSE
  check('KNOWN-BAD occlusion: furniture packed round the pot', mut((a) => {
    for (let k = 0; k < 16; k++) { const t = (k / 16) * Math.PI * 2; a.cover.push({ x: 1400 + Math.cos(t) * 160, y: 1000 + Math.sin(t) * 160, w: 30, h: 30, kind: 'kb' }); }
  }).occlusion.length > 0);
  // shipped-equality: the --shipped comparison must see a dropped district box
  const short = JSON.parse(JSON.stringify(cand)); short.cover.pop();
  check('KNOWN-BAD shipped: a dump missing one district box does not equal the candidate', !sameCover(short, cand));
  check('the candidate equals itself (the comparison can say yes)', sameCover(cand, JSON.parse(JSON.stringify(cand))));
  console.log(`\na2b_district selftest: ${fail ? 'FAIL' : 'PASS'} — ${pass} passed, ${fail} failed`);
  return fail;
}

function sameCover(a, b) {
  const s = (x) => JSON.stringify(x.cover.map(key).sort());
  return s(a) === s(b);
}

// ── main ─────────────────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const val = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
  if (argv.includes('--selftest')) {
    process.exitCode = selftest() ? 1 : 0;
  } else if (argv.includes('--emit')) {
    console.log(emit());
  } else if (argv.includes('--json')) {
    writeFileSync(resolve(val('--json')), `${JSON.stringify(candidate(), null, 2)}\n`);
  } else if (argv.includes('--shipped')) {
    const base = baseArena();
    const p = resolve(val('--shipped') ?? `${ROOT}/tools/arena.gameplay.json`);
    const shipped = JSON.parse(readFileSync(p, 'utf8'));
    const same = sameCover(shipped, candidate(base));
    console.log(`\n   shipped dump ${p.replace(ROOT + '/', '')} ${same ? 'EQUALS' : 'DIFFERS FROM'} base ${BASE_SHA} + DISTRICT (box for box)`);
    const bad = report(shipped, base, `SHIPPED ${p.replace(ROOT + '/', '')}`) + (same ? 0 : 1);
    process.exitCode = bad ? 1 : 0;
  } else {
    process.exitCode = report(candidate(), baseArena(), `CANDIDATE base ${BASE_SHA} + DISTRICT`) ? 1 : 0;
  }
}
