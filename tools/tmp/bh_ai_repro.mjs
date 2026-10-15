#!/usr/bin/env node
/**
 * BH_AI_REPRO — deterministic reproductions of the bot-AI defects found by `bh_ai_six.mjs`,
 * each run on the CLEAN TREE (a detached worktree of HEAD) and on a PATCHED COPY of it that
 * carries the minimal fix, so every scenario is shown able to tell the defect from its
 * absence (a probe that cannot fail proves nothing).
 *
 * Review-phase tool (2026-10-15). It edits NO tracked file: patched copies of `src/game/*.ts`
 * are written under `--scratch` (default: this session's scratchpad, outside the repo, so
 * `tsc` never sees them), and every patch is an exact-string replacement that is FATAL if its
 * anchor does not match exactly once.
 *
 *   node tools/tmp/bh_ai_repro.mjs                # all scenarios
 *   node tools/tmp/bh_ai_repro.mjs --only sd      # sd | stale | lock | deny
 *
 * Scenarios (smallest N at which each expresses is in the name):
 *   sd    N=2 and N=6 — sudden death: chase-branch bots stop pressing and walk into the pot.
 *   stale N=3       — a bot's belief about an opponent it never TARGETED is that opponent's
 *                     spawn point from t=0, however long it watched it walk in the open.
 *   lock  N=3       — a bot whose nearest opponent is hidden ignores a visible one shooting it.
 *   deny  N=2       — a hider at the far side of a SHIPPED 110/130 wu patch is never re-acquired.
 *   sdheal  N=2     — the heal is suppressed with the shot in sudden death (human control heals).
 *   sdduel  N=2     — equal pools on the trigger: does the defect flip the winner? (paired)
 *   endgame N=2,6   — target across the pot inside the final circle, before SD (a NEGATIVE result).
 *   sdwin   N=6     — OPT-IN (~30 min): equal pools at 134.5 s, a passive human's win share.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const args = (() => {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    out[k] = a[i + 1] !== undefined && !a[i + 1].startsWith('--') ? a[++i] : true;
  }
  return out;
})();

const HEAD_ROOT = String(args.head ?? '/private/tmp/fa-rv-head');
const SCRATCH = String(args.scratch ?? '/private/tmp/claude-501/-Users-uribishansky-claude-code-food-arena/368cb93b-f4f8-420f-a41d-77da26503dd1/scratchpad/bh_ai_trees');
const ONLY = args.only ? String(args.only).split(',') : null;
const DT = 16.667;
const RAW = JSON.parse(readFileSync(`${HEAD_ROOT}/tools/arena.gameplay.json`, 'utf8'));
const ARENA = { ...RAW, build: () => null, update: () => {} };

const SIM_FILES = ['sim.ts', 'ai.ts', 'combat.ts', 'movement.ts', 'state.ts', 'rules.ts', 'tuningRegistry.ts', 'tuningStore.ts'];

/** Copy HEAD's sim closure into `SCRATCH/name`, apply exact-once edits, return the game dir. */
function makeArm(name, edits) {
  const root = `${SCRATCH}/${name}`;
  mkdirSync(`${root}/src/game`, { recursive: true });
  mkdirSync(`${root}/src/arena`, { recursive: true });
  for (const f of SIM_FILES) copyFileSync(`${HEAD_ROOT}/src/game/${f}`, `${root}/src/game/${f}`);
  copyFileSync(`${HEAD_ROOT}/src/arena/types.ts`, `${root}/src/arena/types.ts`);
  for (const [file, from, to] of edits) {
    const p = `${root}/src/game/${file}`;
    const s = readFileSync(p, 'utf8');
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`makeArm(${name}): anchor matched ${n}x in ${file} — refusing to measure an edit that did not land`);
    writeFileSync(p, s.replace(from, to));
  }
  return `${root}/src/game`;
}

async function load(dir) {
  return {
    dir,
    ...(await import(`${dir}/sim.ts`)),
    R: await import(`${dir}/rules.ts`),
    S: await import(`${dir}/state.ts`),
    M: await import(`${dir}/movement.ts`),
    C: await import(`${dir}/combat.ts`),
  };
}

// ── THE MINIMAL FIXES, AS PATCHES ────────────────────────────────────────────
const FIX_SD = [[
  'ai.ts',
  '  if (dc > EPS) {\n    const margin = state.safeRadius - dc; // > 0 inside the safe disc',
  '  if (dc > EPS && !suddenDeathActive(state.timeRemaining)) {\n    const margin = state.safeRadius - dc; // > 0 inside the safe disc',
]];
const FIX_STALE = [[
  'ai.ts',
  '  const sighting = state.sightings[sightingIndex(self.id, target.id, state.fighters.length)];\n  if (visible) {',
  '  for (const other of state.fighters) {\n'
  + '    if (other === self || other === target || !other.alive) continue;\n'
  + '    if (isVisibleFrom(self.x, self.y, other.x, other.y, state.arena, state, other)) {\n'
  + '      const c = state.sightings[sightingIndex(self.id, other.id, state.fighters.length)];\n'
  + '      c.x = other.x; c.y = other.y; c.at = now;\n'
  + '    }\n'
  + '  }\n'
  + '  const sighting = state.sightings[sightingIndex(self.id, target.id, state.fighters.length)];\n  if (visible) {',
]];
// Design-proposal arm only (see the report): prefer the nearest VISIBLE opponent.
const FIX_LOCK = [[
  'ai.ts',
  '  const target = nearestLivingOpponent(state, self);\n  if (self.hp <= 0 || target === null) return false;',
  '  let target = nearestLivingOpponent(state, self);\n'
  + '  if (target !== null && !isVisibleFrom(self.x, self.y, target.x, target.y, state.arena, state, target)) {\n'
  + '    let bestD = Infinity;\n'
  + '    for (const o of state.fighters) {\n'
  + '      if (o === self || !o.alive || o.hp <= 0) continue;\n'
  + '      if (!isVisibleFrom(self.x, self.y, o.x, o.y, state.arena, state, o)) continue;\n'
  + '      const d = Math.hypot(o.x - self.x, o.y - self.y);\n'
  + '      if (d < bestD) { bestD = d; target = o; }\n'
  + '    }\n'
  + '  }\n'
  + '  if (self.hp <= 0 || target === null) return false;',
]];

/** FATAL if a fixture point overlaps cover (a fighter parked inside a freezer measures nothing). */
function assertOpen(label, pts) {
  for (const [x, y] of pts) {
    const hit = RAW.cover.find((o) => Math.abs(x - o.x) < (42 + o.w) / 2 && Math.abs(y - o.y) < (42 + o.h) / 2);
    if (hit) throw new Error(`${label}: fixture point (${x},${y}) is inside cover ${hit.kind}@${hit.x},${hit.y}`);
  }
}

// The NARROW form: switch only when the nearest is hidden AND a visible opponent is inside this
// bot's own offensive reach (i.e. it could shoot it right now). Everything else is unchanged.
const FIX_LOCK2 = [[
  'ai.ts',
  '  const target = nearestLivingOpponent(state, self);\n  if (self.hp <= 0 || target === null) return false;',
  '  let target = nearestLivingOpponent(state, self);\n'
  + '  if (target !== null && !isVisibleFrom(self.x, self.y, target.x, target.y, state.arena, state, target)) {\n'
  + '    const reach = offensiveReach(self.characterId);\n'
  + '    let bestD = Infinity;\n'
  + '    let alt: Fighter | null = null;\n'
  + '    for (const o of state.fighters) {\n'
  + '      if (o === self || o === target || !o.alive || o.hp <= 0) continue;\n'
  + '      const d = Math.hypot(o.x - self.x, o.y - self.y);\n'
  + '      if (d > reach || d >= bestD) continue;\n'
  + '      if (!isVisibleFrom(self.x, self.y, o.x, o.y, state.arena, state, o)) continue;\n'
  + '      bestD = d; alt = o;\n'
  + '    }\n'
  + '    if (alt !== null) target = alt;\n'
  + '  }\n'
  + '  if (self.hp <= 0 || target === null) return false;',
]];

const pressesOf = (evs, id) => evs.filter((e) => (e.type === 'weapon-fired' || e.type === 'cast-started') && e.fighterId === id).length;

// ═════════════════════════════════════════════════════════════════════════════
// SD — sudden death silences every chase-branch bot and walks it into the pot
// ═════════════════════════════════════════════════════════════════════════════
function runSd(L, n, characterId) {
  // Every seat gets a pool nobody can drain in 150 s, so the whole match — including the
  // full 15 s sudden-death window — is observable and nobody's fleeing threshold is reached.
  // Six seats: all bots on the shipped spawns. Two seats: a motionless human (slot 0) parked
  // in the final circle's safe annulus, east of the pot, and a bot chasing it.
  const big = 1e5;
  assertOpen('sd', [[1520, 1000]]);
  const configs = n === 2
    ? [
      { characterId: 'hamburger', controller: 'human', maxHp: big, spawn: { x: 1520, y: 1000 } },
      { characterId, controller: 'ai', maxHp: big },
    ]
    : Array.from({ length: n }, (_, i) => ({ characterId: L.R.CHARACTER_IDS[(i + 3) % 11], controller: 'ai', maxHp: big, spawn: RAW.spawns[i] }));
  const st = L.createMatch(ARENA, configs);
  const inputs = new Array(n).fill(null);
  const pot = RAW.hazards.find((h) => h.kind === 'damage');
  const bucket = () => ({ ticks: 0, presses: 0, potDmg: 0, inBurn: 0, dC: 0 });
  const before = bucket(); // the 15 s before sudden death: [120 s, 135 s) of play
  const during = bucket(); // sudden death: [135 s, 150 s)
  let started = null;
  while (st.phase !== 'ended' && st.elapsed < 200000) {
    const evs = L.stepMatch(st, DT, inputs);
    if (st.phase !== 'playing' && !evs.some((e) => e.type === 'match-ended')) continue;
    if (started === null) started = st.elapsed;
    const play = L.R.MATCH_DURATION_MS - st.timeRemaining;
    const sd = L.R.suddenDeathActive(st.timeRemaining);
    const b = sd ? during : play >= 120000 ? before : null;
    if (!b) continue;
    for (const f of st.fighters) {
      if (f.controller !== 'ai' || !f.alive) continue;
      b.ticks++;
      b.presses += pressesOf(evs, f.id);
      const d = Math.hypot(f.x - pot.x, f.y - pot.y);
      b.dC += d;
      if (d < pot.radius) b.inBurn++;
    }
    for (const e of evs) if (e.type === 'hit-landed' && e.source.kind === 'hazard' && st.fighters[e.targetId].controller === 'ai') b.potDmg += e.amount;
  }
  const per = (b) => ({
    pressesPerBotSec: +(b.presses / (b.ticks * DT / 1000)).toFixed(3),
    potDmg: +b.potDmg.toFixed(1),
    inBurnPct: +((100 * b.inBurn) / Math.max(1, b.ticks)).toFixed(1),
    meanDistToPot: +(b.dC / Math.max(1, b.ticks)).toFixed(1),
  });
  return { before: per(before), during: per(during), endedBy: st.timeRemaining <= 0 ? 'timeout' : 'knockout' };
}

async function scenarioSd(head, fixed) {
  console.log('\n══ SD — sudden death: does a chase-branch bot keep fighting? ══');
  console.log('   (pools 1e5 HP so nobody dies or flees; windows are [120,135) s and [135,150) s of play)');
  for (const n of [2, 6]) {
    const chars = n === 2 ? head.R.CHARACTER_IDS : ['(six-seat roster)'];
    for (const c of chars) {
      const h = runSd(head, n, c);
      const f = runSd(fixed, n, c);
      console.log(`   N=${n} ${String(c).padEnd(18)} HEAD presses/bot-s ${String(h.before.pressesPerBotSec).padStart(6)} -> SD ${String(h.during.pressesPerBotSec).padStart(6)} · SD pot dmg ${String(h.during.potDmg).padStart(7)} · SD in-burn ${String(h.during.inBurnPct).padStart(5)}% · dist-to-pot ${h.before.meanDistToPot}->${h.during.meanDistToPot}`
        + `   ||  FIXED -> SD ${String(f.during.pressesPerBotSec).padStart(6)} · SD pot dmg ${String(f.during.potDmg).padStart(6)} · in-burn ${f.during.inBurnPct}%`);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STALE — the belief cell is refreshed only for the CURRENT target
// ═════════════════════════════════════════════════════════════════════════════
function runStale(L, { killB = true } = {}) {
  // Plate stack at (555,290), 130x130: x 490..620, y 225..355.
  // slot 0  C  human — walks NORTH from (555,560) into the plate, stops 30 wu inside (y=325).
  // slot 1  A  bot (burrito) at (820,560) — B is its nearest the whole time C walks.
  // slot 2  B  human statue at (820,480), 80 wu north of A, unkillable by A.
  assertOpen('stale', [[555, 560], [820, 560], [820, 480], [555, 400]]);
  const configs = [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 555, y: 560 } },
    { characterId: 'burrito', controller: 'ai', maxHp: 1e5, spawn: { x: 820, y: 560 } },
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 820, y: 480 } },
  ];
  const st = L.createMatch(ARENA, configs);
  const A = st.fighters[1], B = st.fighters[2], C = st.fighters[0];
  const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let lastVisAt = null, lastVisPos = null, killedAt = null;
  const log = [];
  let firstPressAtC = null;
  for (let k = 0; k < 4000 && st.phase !== 'ended'; k++) {
    const playing = st.phase === 'playing';
    const walking = playing && C.y > 325;
    const inputs = [walking ? { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false } : NEUTRAL, null, NEUTRAL];
    if (playing && L.M.isVisibleFrom(A.x, A.y, C.x, C.y, st.arena, st, C)) { lastVisAt = st.elapsed; lastVisPos = { x: C.x, y: C.y }; }
    if (killB && playing && killedAt === null && !walking && st.elapsed > 9000) {
      const ev = [];
      L.C.applyDamage(st, B, B.hp, null, { kind: 'fog' }, ev);
      killedAt = st.elapsed;
    }
    const evs = L.stepMatch(st, DT, inputs);
    if (killedAt !== null && firstPressAtC === null && pressesOf(evs, A.id) > 0) firstPressAtC = st.elapsed - killedAt;
    if (killedAt !== null && (k % 60 === 0)) {
      const cell = st.sightings[L.S.sightingIndex(A.id, C.id, 3)];
      log.push(`t+${((st.elapsed - killedAt) / 1000).toFixed(1)}s A=(${A.x.toFixed(0)},${A.y.toFixed(0)}) belief(A->C)=(${cell.x.toFixed(0)},${cell.y.toFixed(0)})@${cell.at.toFixed(0)} C=(${C.x.toFixed(0)},${C.y.toFixed(0)}) |A-C|=${Math.hypot(A.x - C.x, A.y - C.y).toFixed(0)}`);
    }
    if (killedAt !== null && st.elapsed - killedAt > 20000) break;
  }
  const cell = st.sightings[L.S.sightingIndex(A.id, C.id, 3)];
  return { lastVisAt, lastVisPos, cell: { ...cell }, firstPressAtC, finalSep: Math.hypot(A.x - C.x, A.y - C.y), log };
}

async function scenarioStale(head, fixed) {
  console.log('\n══ STALE — N=3: what does a bot believe about an opponent it watched but never targeted? ══');
  for (const [name, L] of [['HEAD', head], ['FIXED', fixed]]) {
    const r = runStale(L);
    console.log(`   ${name.padEnd(5)} A last SAW C at t=${r.lastVisAt?.toFixed(0)} ms at (${r.lastVisPos?.x.toFixed(0)},${r.lastVisPos?.y.toFixed(0)}) · A's belief cell (A->C) = (${r.cell.x.toFixed(0)},${r.cell.y.toFixed(0)}) stamped at=${r.cell.at.toFixed(0)} ms`);
    console.log(`         after B dies: A's first press ${r.firstPressAtC === null ? 'NEVER (20 s)' : `at +${(r.firstPressAtC / 1000).toFixed(2)} s`} · |A-C| after 20 s = ${r.finalSep.toFixed(0)} wu`);
    for (const l of r.log.filter((_, i) => i % 3 === 0).slice(0, 6)) console.log(`           ${l}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// LOCK — nearest-by-truth target is hidden; a visible opponent in reach shoots the bot
// ═════════════════════════════════════════════════════════════════════════════
function runLock(L, { withC = true } = {}) {
  // Plate stack at (555,290), 130x130: x 490..620, y 225..355.
  // slot 0  C  human — walks north from (555,515) into the plate and stops at y=245, i.e.
  //            110 wu past the south edge it entered through: beyond the 84 wu reveal.
  // slot 1  A  bot (burrito, reach 140) at (555,675) — chases C (its nearest), stops at C's
  //            last-seen point on the south edge, and from there cannot see C (DENY, below).
  // slot 2  B  human shooter (hamburger, Lettuce r140) — waits at (900,600) until 12 s of
  //            play, walks to (555,481) (≈125 wu south of A's stop: FARTHER than C, inside
  //            both fighters' reach) and fires at A for 10 s.
  // Control: C never enters (parked at (2300,1500)), so B is A's nearest opponent.
  assertOpen('lock', [[555, 515], [555, 675], [900, 600], [555, 600], [555, 481], [2300, 1500]]);
  const configs = [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: withC ? { x: 555, y: 515 } : { x: 2300, y: 1500 } },
    { characterId: 'burrito', controller: 'ai', maxHp: 400, spawn: { x: 555, y: 675 } },
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 900, y: 600 } },
  ];
  const st = L.createMatch(ARENA, configs);
  const A = st.fighters[1], B = st.fighters[2], C = st.fighters[0];
  const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  const lettuce = L.R.CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Lettuce');
  if (lettuce < 0) throw new Error('lock: no Lettuce on hamburger');
  let aPress = 0, aHit = 0, bPress = 0, windowTicks = 0, aStand = null, shootFrom = null;
  for (let k = 0; k < 4000 && st.phase !== 'ended'; k++) {
    const playing = st.phase === 'playing';
    const playMs = playing ? L.R.MATCH_DURATION_MS - st.timeRemaining : 0;
    const cWalk = withC && playing && C.y > 245;
    let bIn = NEUTRAL;
    if (playing && playMs > 12000) {
      if (B.x > 556) bIn = { move: { x: -1, y: 0 }, selectedWeapon: 0, attack: false };
      else if (B.y > 482) bIn = { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false };
      else {
        if (shootFrom === null) shootFrom = st.elapsed;
        bIn = { move: { x: 0, y: 0 }, aim: { x: A.x - B.x, y: A.y - B.y }, selectedWeapon: lettuce, attack: true };
      }
    }
    const evs = L.stepMatch(st, DT, [cWalk ? { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false } : NEUTRAL, null, bIn]);
    if (shootFrom !== null && A.alive) {
      windowTicks++;
      if (aStand === null) aStand = { x: A.x, y: A.y };
      aPress += pressesOf(evs, A.id);
      bPress += pressesOf(evs, B.id);
      for (const e of evs) if (e.type === 'hit-landed' && e.targetId === A.id && e.source.kind === 'weapon' && e.source.attackerId === B.id) aHit += e.amount;
    }
    if (shootFrom !== null && st.elapsed - shootFrom > 10000) break;
  }
  return { windowS: windowTicks * DT / 1000, aPress, bPress, aDmgFromB: aHit, aHp: A.hp, aMax: A.maxHp, aStand, sepAC: Math.hypot(A.x - C.x, A.y - C.y), sepAB: Math.hypot(A.x - B.x, A.y - B.y), cVisible: L.M.isVisibleFrom(A.x, A.y, C.x, C.y, st.arena, st, C) };
}

async function scenarioLock(head, fixed) {
  console.log('\n══ LOCK — N=3: a hidden nearest opponent vs a visible one shooting the bot ══');
  const narrow = await load(makeArm('fix_lock2', FIX_LOCK2));
  const rows = [['HEAD, C hidden', head, true], ['HEAD, no C (control)', head, false], ['DESIGN ARM (prefer visible)', fixed, true], ['NARROW (visible + in reach)', narrow, true]];
  for (const [name, L, withC] of rows) {
    const r = runLock(L, { withC });
    console.log(`   ${name.padEnd(28)} ${r.windowS.toFixed(1)} s window: A presses ${String(r.aPress).padStart(3)} · B presses ${String(r.bPress).padStart(3)} · A took ${r.aDmgFromB.toFixed(0).padStart(4)} from B · A hp ${r.aHp.toFixed(0)}/${r.aMax} · A at (${r.aStand?.x.toFixed(0)},${r.aStand?.y.toFixed(0)}) · |A-C| ${r.sepAC.toFixed(0)} (C visible ${r.cVisible}) · |A-B| ${r.sepAB.toFixed(0)}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DENY — a hider at the FAR side of a shipped patch is never re-acquired
// ═════════════════════════════════════════════════════════════════════════════
function runDeny(L, { box, stopDepth }) {
  // slot 0  C  human — spawns 160 wu south of the box's south edge, walks north into it and
  //            stops `stopDepth` wu past the edge it entered through.
  // slot 1  A  bot (burrito) — spawns 320 wu south of the edge and chases C the whole way.
  const south = box.y + box.h / 2;
  assertOpen(`deny ${box.kind}`, [[box.x, south + 160], [box.x, south + 320]]);
  const configs = [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: box.x, y: south + 160 } },
    { characterId: 'burrito', controller: 'ai', maxHp: 1e5, spawn: { x: box.x, y: south + 320 } },
  ];
  const st = L.createMatch(ARENA, configs);
  const C = st.fighters[0], A = st.fighters[1];
  const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let hiddenAt = null, pressesAfter = 0, lastPressAfter = null, aMovedAfter = 0, prevA = null;
  for (let k = 0; k < 3000 && st.phase !== 'ended'; k++) {
    const playing = st.phase === 'playing';
    const walking = playing && C.y > south - stopDepth;
    const evs = L.stepMatch(st, DT, [walking ? { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false } : NEUTRAL, null]);
    if (playing && !walking && hiddenAt === null) hiddenAt = st.elapsed;
    if (hiddenAt !== null && st.elapsed - hiddenAt > 3000) { // give A 3 s to arrive first
      const p = pressesOf(evs, A.id);
      pressesAfter += p;
      if (p) lastPressAfter = st.elapsed - hiddenAt;
      if (prevA) aMovedAfter += Math.hypot(A.x - prevA.x, A.y - prevA.y);
      prevA = { x: A.x, y: A.y };
    }
    if (hiddenAt !== null && st.elapsed - hiddenAt > 23000) break;
  }
  return {
    pressesAfter, aMovedAfter, sep: Math.hypot(A.x - C.x, A.y - C.y),
    visible: L.M.isVisibleFrom(A.x, A.y, C.x, C.y, st.arena, st, C),
    a: { x: A.x, y: A.y }, c: { x: C.x, y: C.y },
  };
}

async function scenarioDeny(head) {
  console.log('\n══ DENY — N=2: shipped patch sizes vs the 84 wu reveal (DECISIONS §29.1 says <=168 wu is safe) ══');
  const boxes = RAW.concealment;
  const plate = boxes.find((b) => b.x === 555 && b.y === 290);   // 130 x 130
  const tray = boxes.find((b) => b.x === 2650 && b.y === 380);   // 110 x 110, clear southern approach
  for (const [label, box] of [['plate 130', plate], ['tray 110', tray]]) {
    for (const depth of [40, box.h - 20]) {
      const r = runDeny(head, { box, stopDepth: depth });
      console.log(`   ${label} hider ${String(depth).padStart(3)} wu past the entry edge: A presses in the 20 s after arriving ${String(r.pressesAfter).padStart(3)} · A walked ${r.aMovedAfter.toFixed(0).padStart(4)} wu · final |A-C| ${r.sep.toFixed(0)} · C visible to A: ${r.visible}`);
    }
  }
}

const head = await load(`${HEAD_ROOT}/src/game`);
// `sdwin` is ~30 min (264 full six-seat matches), so it runs only when named.
const want = (k) => (ONLY === null ? k !== 'sdwin' : ONLY.includes(k));
if (want('sd')) await scenarioSd(head, await load(makeArm('fix_sd', FIX_SD)));
if (want('stale')) await scenarioStale(head, await load(makeArm('fix_stale', FIX_STALE)));
if (want('lock')) await scenarioLock(head, await load(makeArm('fix_lock', FIX_LOCK)));
if (want('deny')) await scenarioDeny(head);

// ═════════════════════════════════════════════════════════════════════════════
// SDWIN — does the sudden-death defect change WHO WINS? N=6, equal HP at the trigger.
// ═════════════════════════════════════════════════════════════════════════════
function runSdWin(L, roster, humanSeat, hpAtTrigger) {
  // Every seat plays with an undrainable pool until 134.5 s of play (so positions are the
  // real endgame ones the bots chose), then every pool is reset to the SAME value and the
  // match runs to its end. The human seat never moves and never presses: a PASSIVE player.
  // HP is the only thing reset; it is the instrument idiom `sim.test.mjs` §30 uses.
  const configs = roster.map((c, i) => ({ characterId: c, controller: i === humanSeat ? 'human' : 'ai', maxHp: 1e5, spawn: RAW.spawns[i] }));
  const st = L.createMatch(ARENA, configs);
  const inputs = new Array(roster.length).fill(null);
  let reset = false;
  const deaths = [];
  let potDmgBots = 0, botPressesSd = 0;
  while (st.phase !== 'ended' && st.elapsed < 200000) {
    const play = L.R.MATCH_DURATION_MS - st.timeRemaining;
    if (!reset && st.phase === 'playing' && play >= 134500) {
      for (const f of st.fighters) { f.maxHp = hpAtTrigger; f.hp = hpAtTrigger; }
      reset = true;
    }
    const evs = L.stepMatch(st, DT, inputs);
    if (!reset) continue;
    for (const e of evs) {
      if (e.type === 'death') deaths.push(e.fighterId);
      if (e.type === 'hit-landed' && e.source.kind === 'hazard' && e.targetId !== humanSeat) potDmgBots += e.amount;
      if ((e.type === 'weapon-fired' || e.type === 'cast-started') && e.fighterId !== humanSeat && L.R.suddenDeathActive(st.timeRemaining)) botPressesSd++;
    }
  }
  return { winnerId: st.winnerId, humanWon: st.winnerId === humanSeat, deaths, potDmgBots, botPressesSd };
}

async function scenarioSdWin(head, fixed) {
  console.log('\n══ SDWIN — N=6, every pool reset to the same value at 134.5 s; slot `h` is a PASSIVE human (never moves, never presses) ══');
  const ids = head.R.CHARACTER_IDS;
  for (const hp of [100, 200]) {
    const tally = { HEAD: { won: 0, n: 0, pot: 0, presses: 0 }, FIXED: { won: 0, n: 0, pot: 0, presses: 0 } };
    for (let ri = 0; ri < ids.length; ri++) {
      const roster = Array.from({ length: 6 }, (_, j) => ids[(ri + j) % ids.length]);
      for (let h = 0; h < 6; h++) {
        for (const [name, L] of [['HEAD', head], ['FIXED', fixed]]) {
          const r = runSdWin(L, roster, h, hp);
          tally[name].n++;
          if (r.humanWon) tally[name].won++;
          tally[name].pot += r.potDmgBots;
          tally[name].presses += r.botPressesSd;
        }
      }
    }
    for (const name of ['HEAD', 'FIXED']) {
      const t = tally[name];
      console.log(`   hp ${hp}  ${name.padEnd(5)} passive human WINS ${t.won}/${t.n} (${(100 * t.won / t.n).toFixed(1)}%; fair share 16.7%) · bot pot dmg ${t.pot.toFixed(0)} · bot presses in SD ${t.presses}`);
    }
  }
}
if (want('sdwin')) await scenarioSdWin(head, await load(makeArm('fix_sd', FIX_SD)));

// ═════════════════════════════════════════════════════════════════════════════
// ENDGAME — the final circle vs the pot's AI margin, BEFORE sudden death.
// ═════════════════════════════════════════════════════════════════════════════
function runEndgame(L, characterId, n) {
  // A motionless human parked WEST of the pot inside every seat count's final circle
  // (r=120 from centre), the bot spawned EAST of it at r=120, so the target is ACROSS the
  // pot. Extra seats (n>2) are motionless humans parked far out in the open, so they only
  // change `minSafeRadiusFor(n)` — the floor — and are never the bot's nearest.
  assertOpen('endgame', [[1280, 1000], [1520, 1000], [2300, 1500], [2000, 1600], [2400, 1300], [2600, 600]]);
  const far = [[2300, 1500], [2000, 1600], [2400, 1300], [2600, 600]];
  const configs = [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 1280, y: 1000 } },
    { characterId, controller: 'ai', maxHp: 1e5, spawn: { x: 1520, y: 1000 } },
    ...Array.from({ length: n - 2 }, (_, i) => ({ characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: far[i][0], y: far[i][1] } })),
  ];
  const st = L.createMatch(ARENA, configs);
  const inputs = new Array(n).fill(null);
  const pot = RAW.hazards.find((h) => h.kind === 'damage');
  const W = { early: [30000, 100000], late: [120000, 135000] };
  const acc = Object.fromEntries(Object.keys(W).map((k) => [k, { ticks: 0, presses: 0, pot: 0, inBurn: 0, tgtIs0: 0 }]));
  while (st.phase !== 'ended' && st.elapsed < 200000) {
    const evs = L.stepMatch(st, DT, inputs);
    if (st.phase !== 'playing') continue;
    const play = L.R.MATCH_DURATION_MS - st.timeRemaining;
    const bot = st.fighters[1];
    for (const [k, [a, b]] of Object.entries(W)) {
      if (play < a || play >= b) continue;
      const w = acc[k];
      w.ticks++;
      w.presses += pressesOf(evs, 1);
      if (Math.hypot(bot.x - pot.x, bot.y - pot.y) < pot.radius) w.inBurn++;
      if (L.S.nearestLivingOpponent(st, bot)?.id === 0) w.tgtIs0++;
      for (const e of evs) if (e.type === 'hit-landed' && e.targetId === 1 && e.source.kind === 'hazard') w.pot += e.amount;
    }
  }
  const f = (w) => `presses/s ${(w.presses / (w.ticks * DT / 1000)).toFixed(2).padStart(5)} · in-burn ${((100 * w.inBurn) / w.ticks).toFixed(0).padStart(3)}% · pot dmg ${w.pot.toFixed(0).padStart(4)} · target=parked ${((100 * w.tgtIs0) / w.ticks).toFixed(0)}%`;
  return { early: f(acc.early), late: f(acc.late), floor: L.R.minSafeRadiusFor(n) };
}

async function scenarioEndgame(head) {
  console.log('\n══ ENDGAME — target parked ACROSS the pot, inside the final circle; windows [30,100) s and [120,135) s ══');
  for (const n of [2, 6]) {
    for (const c of ['hamburger', 'taco', 'sushi', 'soup', 'pizza', 'lollipop']) {
      const r = runEndgame(head, c, n);
      console.log(`   N=${n} floor ${r.floor.toFixed(0)} ${c.padEnd(10)} EARLY ${r.early}   ||   LATE ${r.late}`);
    }
  }
}
if (want('endgame')) await scenarioEndgame(head);

// ═════════════════════════════════════════════════════════════════════════════
// SDHEAL — the heal is suppressed with the shot: can a bot heal in sudden death?
// ═════════════════════════════════════════════════════════════════════════════
function runSdHeal(L, botController) {
  // Slot 1 is a Hamburger (the roster's only `self` heal), alone and out of everyone's reach:
  // the other seat is parked at the far corner, so nothing is shot by anyone. At 134.5 s of
  // play... WAS 134.5 s, AND THAT FIXTURE COULD NOT DISCRIMINATE: every arm healed at once,
  // BEFORE the trigger, and sat on the 6 s cooldown through the window (and the 'heal' events
  // it counted were mostly out-of-combat REGEN). Now: on the FIRST sudden-death tick slot 1's
  // pool is set to 40% of 200 HP — below `AI_SELF_HEAL_HP_FRACTION`, missing far more than one
  // heal — and the heal's cooldown is cleared. Count PRESSES of the heal weapon only.
  // `botController: 'human'` is the CONTROL: the same seat pressing the heal by hand.
  assertOpen('sdheal', [[1520, 1000], [2600, 600]]);
  const st = L.createMatch(ARENA, [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 2600, y: 600 } },
    { characterId: 'hamburger', controller: botController, maxHp: 1e5, spawn: { x: 1520, y: 1000 } },
  ]);
  const healIdx = L.R.CHARACTERS.hamburger.weapons.findIndex((w) => w.type === 'self');
  const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let set = false;
  const heals = { pre: 0, sd: 0 };
  while (st.phase !== 'ended' && st.elapsed < 200000) {
    const play = L.R.MATCH_DURATION_MS - st.timeRemaining;
    if (!set && st.phase === 'playing' && L.R.suddenDeathActive(st.timeRemaining - DT)) {
      const f = st.fighters[1];
      f.maxHp = 200; f.hp = 80; f.lastUsed[healIdx] = -Infinity;
      set = true;
    }
    const pressHeal = botController === 'human' && set ? { move: { x: 0, y: 0 }, selectedWeapon: healIdx, attack: true } : NEUTRAL;
    const evs = L.stepMatch(st, DT, [NEUTRAL, botController === 'human' ? pressHeal : null]);
    if (!set) continue;
    const healKey = L.R.CHARACTERS.hamburger.weapons[healIdx].key;
    for (const e of evs) if (e.type === 'weapon-fired' && e.fighterId === 1 && e.weaponKey === healKey) heals[L.R.suddenDeathActive(st.timeRemaining) ? 'sd' : 'pre']++;
    if (!st.fighters[1].alive) break;
  }
  return heals;
}
async function scenarioSdHeal(head, fixed) {
  console.log('\n══ SDHEAL — N=2: a Hamburger dropped to 40% HP with its heal ready, ON the sudden-death trigger ══');
  for (const [name, L, ctl] of [['HEAD bot', head, 'ai'], ['FIXED bot', fixed, 'ai'], ['HEAD human (control)', head, 'human']]) {
    const h = runSdHeal(L, ctl);
    console.log(`   ${name.padEnd(22)} heal PRESSES before the trigger ${h.pre} · heal PRESSES during SD ${h.sd}`);
  }
}
if (want('sdheal')) await scenarioSdHeal(head, await load(makeArm('fix_sd', FIX_SD)));

// ═════════════════════════════════════════════════════════════════════════════
// SDDUEL — N=2, both pools equal ON the trigger: who wins sudden death, HEAD vs FIXED?
// ═════════════════════════════════════════════════════════════════════════════
function runSdDuel(L, characterId, hp) {
  // The SD scenario's duel (passive human parked in the final circle's safe annulus east of
  // the pot, the bot fighting it all match on undrainable pools), then on the FIRST
  // sudden-death tick BOTH pools are set to the same `hp`. The human never presses, so in a
  // fair fight the bot should win; "the one who has more HP wins" is the rule being resolved.
  const st = L.createMatch(ARENA, [
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 1520, y: 1000 } },
    { characterId, controller: 'ai', maxHp: 1e5 },
  ]);
  let set = false;
  let botPot = 0, botPresses = 0;
  while (st.phase !== 'ended' && st.elapsed < 200000) {
    if (!set && st.phase === 'playing' && L.R.suddenDeathActive(st.timeRemaining - DT)) {
      for (const f of st.fighters) { f.maxHp = hp; f.hp = hp; }
      set = true;
    }
    const evs = L.stepMatch(st, DT, [null, null]);
    if (!set) continue;
    for (const e of evs) {
      if (e.type === 'hit-landed' && e.targetId === 1 && e.source.kind === 'hazard') botPot += e.amount;
      if ((e.type === 'weapon-fired' || e.type === 'cast-started') && e.fighterId === 1) botPresses++;
    }
  }
  return { winner: st.winnerId === 0 ? 'HUMAN' : st.winnerId === 1 ? 'bot' : String(st.winnerId), botPot, botPresses };
}
async function scenarioSdDuel(head, fixed) {
  console.log('\n══ SDDUEL — N=2, equal pools set ON the sudden-death trigger; the human never presses ══');
  for (const hp of [100, 200]) {
    let hh = 0, fh = 0;
    const cells = [];
    for (const c of head.R.CHARACTER_IDS) {
      const a = runSdDuel(head, c, hp);
      const b = runSdDuel(fixed, c, hp);
      if (a.winner === 'HUMAN') hh++;
      if (b.winner === 'HUMAN') fh++;
      cells.push(`${c}:${a.winner}/${b.winner}`);
    }
    console.log(`   hp ${hp}: the PASSIVE human wins HEAD ${hh}/11 · FIXED ${fh}/11   [char: HEAD/FIXED] ${cells.join(' ')}`);
  }
}
if (want('sdduel')) await scenarioSdDuel(head, await load(makeArm('fix_sd', FIX_SD)));
