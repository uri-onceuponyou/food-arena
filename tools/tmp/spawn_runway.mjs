#!/usr/bin/env node
/**
 * SPAWN RUNWAY guard — the acceptance test for rule 3 in `src/arena/kitchen.ts`'s header:
 *
 *     "A SPAWN'S STRAIGHT-AHEAD RUN MUST NOT END IN FURNITURE OR IN A HAZARD."
 *
 * ── Why this exists, and why `arena_probe.mjs --route` was not enough ────────────
 * `--route` walks a single RAY out of the spawn point. On the 60c5b92 layout that ray
 * reported 700 / 84 / 318 wu and looked healthy. The shipped game reported something
 * else: `tools/tmp/input_accept.mjs` measured a player holding W travelling **6.0 wu**,
 * which is 0.14 of a body length and exactly ONE step (PLAYER_SPEED 0.12 wu/ms x the
 * loop's 50 ms dt clamp = 6 wu).
 *
 * Both numbers were correct. A ray is measure-zero and a fighter is not: the west
 * `prep_counter` at (265,330,160x55) inflates to a collision box of x 164..366,
 * y 281.5..378.5 against a 42 wu body, and the player spawn is (160,390) — **4.0 wu west
 * of one face and 11.5 wu south of the other.** Four wu of lateral drift — a tenth of a
 * body — swaps the north runway from 84 wu to 11.5 wu, and swaps the run TOWARD THE ENEMY
 * from 1219 wu to 4.0 wu. The ray never sees any of it.
 *
 * So this measures a CORRIDOR, not a ray: the runway is the WORST case over a lateral
 * band of +-`HALF_BODY` (21 wu, the fighter's own half-width) around the spawn. That is
 * the same quantity every collision test in the sim already uses, and it is what makes
 * the guard a statement about a body rather than about an idealised point.
 *
 * ── Cardinals only, deliberately ────────────────────────────────────────────────
 * `movement.ts:tryMove` resolves x and y INDEPENDENTLY, so a diagonal press that is
 * refused on one axis still travels on the other — a diagonal self-heals into a wall
 * slide. A cardinal has no second axis to fall back on, which is why a cardinal is the
 * only direction that can stop a fighter dead. Diagonals are printed as INFO.
 *
 * ── The minimum, and how it was chosen ──────────────────────────────────────────
 * `MIN_RUNWAY_WU` = 60 wu = 0.5 s of held input at `PLAYER_SPEED`, i.e. 1.43 body
 * lengths. It is bounded on both sides by measurement rather than picked:
 *   * below by `BODY_LENGTH` (42) — under one body length the fighter has not even
 *     vacated its own spawn footprint, and the 38 wu predecessor defect (0.9 body,
 *     0.32 s) was already judged serious enough to redesign a lane around;
 *   * above by what this arena can actually deliver — the binding case is the NW
 *     freezer's collision face 84 wu north of the player spawn, and no arrangement of
 *     the props around the spawn bay beats it without moving a spawn into the pot's
 *     lane. A gate set AT 84 would trip on any 1 wu change; 60 leaves 24 wu (0.57 body)
 *     of headroom, which is a gate rather than a tripwire.
 *
 * ── Two failure modes, both fatal ───────────────────────────────────────────────
 *   RUNWAY  the run is stopped short of `MIN_RUNWAY_WU` by a CoverBox or the wall.
 *   HAZARD  the run STOPS with the fighter's centre inside a damage hazard. That is the
 *           `60c5b92` pot trap: `POT.bodyRadius*2` blocks a centre at r=73 while
 *           `POT.dangerRadius` burns from r=95, so a run that ends against the pot is
 *           pinned inside the fire. Merely CROSSING a hazard while still moving is
 *           reported as INFO, not a failure — the caution ring is visible and the
 *           fighter walks out the far side.
 *
 * ── The layout is read TWICE and the two are compared ───────────────────────────
 * `tools/arena.gameplay.json` is a browser dump and can go stale; `src/arena/kitchen.ts`
 * is the source. This parses both and refuses to report a number if they disagree,
 * because a guard reading a stale world is the exact bug `input_accept`'s QA cases had.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────────
 *   node tools/tmp/spawn_runway.mjs                  # gate: source + dump, must agree
 *   node tools/tmp/spawn_runway.mjs --layout <json>  # score a candidate layout
 *   node tools/tmp/spawn_runway.mjs --band 30        # a wider corridor, for sensitivity
 *   node tools/tmp/spawn_runway.mjs --json           # machine-readable
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { PLAYER_SIZE, PLAYER_SPEED, BODY_LENGTH, MATCH_DURATION_MS, POT, PUDDLE_SLOW_FACTOR } = RULES;

const args = (() => {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[a.slice(2)] = true;
    else { out[a.slice(2)] = n; i++; }
  }
  return out;
})();

/** Half the fighter's own width — the lateral band the runway must survive. */
const HALF_BODY = PLAYER_SIZE / 2;
const BAND = Number(args.band ?? HALF_BODY);
/** 0.5 s of held input at PLAYER_SPEED. See the header. */
const MIN_RUNWAY_WU = Math.round(PLAYER_SPEED * 500);
/** Fine enough that a 4 wu clearance cannot hide between two samples. */
const LATERAL_STEP = 0.5;
const MARCH_STEP = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// Layout, read twice
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse every `addCover()` call site and both spawns straight out of `kitchen.ts`.
 * Same technique as `tools/tmp/arena_probe.mjs`'s extractor and validated the same way —
 * against the committed browser dump, box for box.
 */
function extractFromSource() {
  const kitchen = readFileSync(`${ROOT}/src/arena/kitchen.ts`, 'utf8');
  const shared = readFileSync(`${ROOT}/src/arena/shared.ts`, 'utf8');
  const ARENA_W = Number(/export const ARENA_W = (\d+)/.exec(shared)[1]);
  const ARENA_H = Number(/export const ARENA_H = (\d+)/.exec(shared)[1]);
  const CENTER = { x: ARENA_W / 2, y: ARENA_H / 2 };
  const FOG_FIRST_CONTACT_S = Number(/export const FOG_FIRST_CONTACT_S = ([\d.]+)/.exec(shared)[1]);
  const MAX_SAFE_RADIUS = Math.round(
    Math.hypot(ARENA_W / 2, ARENA_H / 2) / (1 - (FOG_FIRST_CONTACT_S * 1000) / MATCH_DURATION_MS)
  );

  const scope = { ARENA_W, ARENA_H, CENTER, POT, Math };
  const ev = (expr) => new Function(...Object.keys(scope), `"use strict"; return (${expr});`)(...Object.values(scope));
  for (const dm of kitchen.matchAll(/(?:^|[\s,])([A-Z][A-Z0-9_]*)\s*=\s*([-+*/(). \d]+?)\s*[,;]/gm)) {
    try { scope[dm[1]] = ev(dm[2]); } catch { /* not a pure numeric expression */ }
  }

  const cover = [];
  const re = /addCover\(\s*propsGroup,\s*cover,\s*M,\s*\{([\s\S]*?)build:/g;
  let m;
  while ((m = re.exec(kitchen)) !== null) {
    const body = m[1];
    const get = (key) => {
      const mm = new RegExp(`\\b${key}:\\s*([^,\\n}]+)`).exec(body);
      return mm ? mm[1].trim() : null;
    };
    cover.push({
      x: ev(get('x')), y: ev(get('y')), w: ev(get('w')), h: ev(get('h')),
      kind: get('kind').replace(/^['"]|['"]$/g, ''),
    });
  }

  const spawns = {};
  const spawnRe = /const (playerSpawn|enemySpawn) = \{ x: ([^,]+), y: ([^}]+) \}/g;
  while ((m = spawnRe.exec(kitchen)) !== null) spawns[m[1]] = { x: ev(m[2]), y: ev(m[3]) };

  const hazards = [{ x: CENTER.x, y: CENTER.y, radius: POT.dangerRadius, kind: 'damage', damage: POT.damage, tickMs: POT.tickMs }];
  const pud = /const puddle(South|North) = \{ x: ([^,]+), y: ([^,]+), radius: ([^}]+) \}/g;
  while ((m = pud.exec(kitchen)) !== null) {
    hazards.push({ x: ev(m[2]), y: ev(m[3]), radius: ev(m[4]), kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR });
  }

  return {
    id: 'kitchen', width: ARENA_W, height: ARENA_H, center: CENTER, maxSafeRadius: MAX_SAFE_RADIUS,
    playerSpawn: spawns.playerSpawn, enemySpawn: spawns.enemySpawn, cover, hazards,
  };
}

const norm = (a) => JSON.stringify({
  w: a.width, h: a.height, ps: a.playerSpawn, es: a.enemySpawn,
  cover: [...a.cover].map((c) => `${c.kind}@${c.x},${c.y},${c.w}x${c.h}`).sort(),
  hz: [...a.hazards].map((h) => `${h.kind}@${h.x},${h.y},r${h.radius}`).sort(),
});

const DUMP_PATH = `${ROOT}/tools/arena.gameplay.json`;
let arena;
let sourceChecked = false;
if (args.layout) {
  arena = JSON.parse(readFileSync(String(args.layout), 'utf8'));
} else {
  const src = extractFromSource();
  const dump = JSON.parse(readFileSync(DUMP_PATH, 'utf8'));
  if (norm(src) !== norm(dump)) {
    console.error('\nFAIL  layout  src-matches-dump   src/arena/kitchen.ts and tools/arena.gameplay.json DISAGREE.');
    console.error('      Refresh the dump (node tools/match-sim.mjs --refresh-arena) before trusting any number here.');
    const A = new Set(src.cover.map((c) => `${c.kind}@${c.x},${c.y},${c.w}x${c.h}`));
    const B = new Set(dump.cover.map((c) => `${c.kind}@${c.x},${c.y},${c.w}x${c.h}`));
    for (const s of A) if (!B.has(s)) console.error(`        src only  ${s}`);
    for (const s of B) if (!A.has(s)) console.error(`        dump only ${s}`);
    if (JSON.stringify(src.playerSpawn) !== JSON.stringify(dump.playerSpawn)) console.error(`        playerSpawn src ${JSON.stringify(src.playerSpawn)} dump ${JSON.stringify(dump.playerSpawn)}`);
    if (JSON.stringify(src.enemySpawn) !== JSON.stringify(dump.enemySpawn)) console.error(`        enemySpawn  src ${JSON.stringify(src.enemySpawn)} dump ${JSON.stringify(dump.enemySpawn)}`);
    process.exit(1);
  }
  arena = src;
  sourceChecked = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// The march
// ─────────────────────────────────────────────────────────────────────────────

const half = PLAYER_SIZE / 2;
const damageHazards = arena.hazards.filter((h) => h.kind === 'damage');

const boxAt = (x, y) =>
  arena.cover.find((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2);
const hazardAt = (x, y) => damageHazards.find((h) => Math.hypot(x - h.x, y - h.y) <= h.radius);

/**
 * Walk from (sx,sy) along (dx,dy) until a CoverBox or the arena bound refuses the step,
 * exactly as `tryMove` would (destination test, no slide). Returns how far the fighter
 * got, what stopped it, and whether it was left standing in a damage hazard.
 */
function march(sx, sy, dx, dy) {
  let d = 0;
  let crossedHazard = null;
  for (;;) {
    const nd = d + MARCH_STEP;
    const x = sx + dx * nd, y = sy + dy * nd;
    if (x < half || x > arena.width - half || y < half || y > arena.height - half) break;
    const box = boxAt(x, y);
    if (box) {
      const hz = hazardAt(sx + dx * d, sy + dy * d);
      return { d, stop: `${box.kind}(${box.x},${box.y},${box.w}x${box.h})`, stopKind: box.kind, hazardStop: hz ?? null, crossedHazard };
    }
    if (!crossedHazard) { const hz = hazardAt(x, y); if (hz) crossedHazard = hz; }
    d = nd;
    if (d > 4000) break;
  }
  const hz = hazardAt(sx + dx * d, sy + dy * d);
  return { d, stop: 'WALL', stopKind: 'wall', hazardStop: hz ?? null, crossedHazard };
}

const DIRS = [
  ['north', 0, -1], ['south', 0, +1], ['west', -1, 0], ['east', +1, 0],
];
const DIAGS = [
  ['north-east', +1, -1], ['north-west', -1, -1], ['south-east', +1, +1], ['south-west', -1, +1],
];

/** Worst case over the lateral band, and the offset where it happens. */
function corridor(spawn, dx, dy, band) {
  let worst = null;
  for (let o = -band; o <= band + 1e-9; o += LATERAL_STEP) {
    const ox = dx === 0 ? o : 0;
    const oy = dy === 0 ? o : 0;
    const r = march(spawn.x + ox, spawn.y + oy, dx, dy);
    if (!worst || r.d < worst.d) worst = { ...r, off: Number(o.toFixed(2)) };
  }
  return worst;
}

const SPAWNS = [['player', arena.playerSpawn], ['enemy', arena.enemySpawn]];
const rows = [];
let failures = 0;
const fail = (group, check, ok, detail) => { rows.push({ group, check, ok, detail }); if (!ok) failures++; };

for (const [who, sp] of SPAWNS) {
  for (const [name, dx, dy] of DIRS) {
    const ray = march(sp.x, sp.y, dx, dy);
    const band = corridor(sp, dx, dy, BAND);
    fail(who, `${name}-runway`, band.d >= MIN_RUNWAY_WU,
      `corridor min ${band.d.toFixed(1)} wu at lateral ${band.off >= 0 ? '+' : ''}${band.off} (want >=${MIN_RUNWAY_WU}) ` +
      `stops on ${band.stop} · centre ray ${ray.d.toFixed(1)} wu on ${ray.stop}`);
    fail(who, `${name}-stop-not-in-hazard`, band.hazardStop === null && ray.hazardStop === null,
      band.hazardStop || ray.hazardStop
        ? `run STOPS inside a damage hazard at r=${(band.hazardStop ?? ray.hazardStop).radius} — this is the 60c5b92 pot pin`
        : 'stops on open floor');
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const pad = (s, n) => String(s).padEnd(n);
const out = { minRunwayWu: MIN_RUNWAY_WU, band: BAND, sourceChecked, results: [] };

console.log('');
console.log(`== SPAWN RUNWAY  ·  corridor +-${BAND} wu (fighter half-width ${HALF_BODY})  ·  minimum ${MIN_RUNWAY_WU} wu ` +
  `(${(MIN_RUNWAY_WU / (PLAYER_SPEED * 1000)).toFixed(2)}s of held input, ${(MIN_RUNWAY_WU / BODY_LENGTH).toFixed(2)} body lengths)`);
console.log(`   layout: ${args.layout ? String(args.layout) : 'src/arena/kitchen.ts (verified box-for-box against tools/arena.gameplay.json)'}`);
console.log(`   player spawn ${JSON.stringify(arena.playerSpawn)}   enemy spawn ${JSON.stringify(arena.enemySpawn)}`);
console.log('');
for (const r of rows) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.group, 7)} ${pad(r.check, 28)} ${r.detail}`);
  out.results.push(r);
}

console.log('\n   INFO — diagonals (tryMove resolves per axis, so these self-heal into a wall slide):');
for (const [who, sp] of SPAWNS) {
  for (const [name, dx, dy] of DIAGS) {
    const n = Math.hypot(dx, dy);
    const r = march(sp.x, sp.y, dx / n, dy / n);
    console.log(`     ${pad(who, 7)} ${pad(name, 11)} ${r.d.toFixed(1).padStart(7)} wu  ${r.stop}`);
  }
}
console.log('\n   INFO — runs that CROSS a damage hazard while still moving (visible ring, not a pin):');
let crossings = 0;
for (const [who, sp] of SPAWNS) {
  for (const [name, dx, dy] of DIRS) {
    for (let o = -BAND; o <= BAND + 1e-9; o += LATERAL_STEP) {
      const r = march(sp.x + (dx === 0 ? o : 0), sp.y + (dy === 0 ? o : 0), dx, dy);
      if (r.crossedHazard) {
        console.log(`     ${pad(who, 7)} ${pad(name, 11)} first at lateral ${o >= 0 ? '+' : ''}${o.toFixed(1)} — hazard r=${r.crossedHazard.radius} at (${r.crossedHazard.x},${r.crossedHazard.y})`);
        crossings++;
        break;
      }
    }
  }
}
if (!crossings) console.log('     none');

console.log(`\n${rows.length - failures}/${rows.length} checks passed\n`);
if (args.json) console.log(JSON.stringify(out, null, 2));
process.exit(failures > 0 ? 1 : 0);
