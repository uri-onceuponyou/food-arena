#!/usr/bin/env node
/**
 * SPECTATOR CAMERA — the proof that it cannot touch the simulation.
 *
 *   node tools/tmp/sv_bitid.mjs
 *
 * The sim is deterministic and seeded, and `CLAUDE.md` says that *"underwrites every
 * balance number in the project."* A camera is presentation. So the spectator subject
 * rule must be provably incapable of changing what `stepMatch` produces — **proved, not
 * asserted**, because the risk here is not hypothetical: `resolveViewSubject` is handed
 * `state.fighters` ITSELF, the live array of live `Fighter` objects, not a copy of it.
 * `readonly` in the TypeScript interface is erased at runtime and buys nothing.
 *
 * ── TWO INDEPENDENT PROOFS, BECAUSE THEY FAIL DIFFERENTLY ──────────────────────
 *
 *   A  EMPIRICAL — one seeded six-fighter match, run three times through the real
 *      `sim.ts`, hashing every tick.
 *        A1  plain: `stepMatch` and nothing else.
 *        A2  with the camera: every tick also runs the exact call `match.ts` makes —
 *            `resolveViewSubject({ seats: state.fighters, … })` on the live array, plus
 *            the killer attribution walked off the live event stream. The per-tick
 *            digest must be **bit-identical to A1**.
 *        A3  KNOWN-BAD: the same, with a callback that writes one field of one fighter
 *            (`hp -= 1e-9`). The digest must **DIFFER**. Without A3 "the hashes matched"
 *            would also be true of a comparison that cannot see anything at all — and a
 *            null result is a normal outcome here, which is what makes it dangerous.
 *      ⚠️ NON-VACUITY: the run is asserted to contain real deaths and real post-death
 *      ticks first. A match where nobody dies never reaches the spectator rule, so it
 *      would agree with everything.
 *
 *   B  STRUCTURAL — the import closure of `src/game/sim.ts`. Neither owned file may
 *      appear in it. This is the stronger statement (it holds for inputs A never tried)
 *      and the weaker evidence (it trusts a regex over `import` lines), which is why both
 *      arms are here.
 *        B-KB: the same walker, from `src/game/match.ts`, MUST reach `render/camera.ts`.
 *        A walker that finds nothing finds nothing everywhere.
 *
 * ⚠️ THIS RUNS AGAINST THE WORKING TREE, WHICH A PEER IS EDITING (`sim.ts`, `state.ts`).
 * That is fine and deliberate for arm A: **both arms of the comparison run in the same
 * process against the same files**, so a peer's half-saved edit moves both digests
 * identically and cannot manufacture or mask a difference. This is not an A/B against a
 * baseline; it is a self-pair, and a self-pair is immune to the tree it runs on.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { applyDamage } from '../../src/game/combat.ts';
import { resolveViewSubject } from '../../src/render/camera.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}${detail ? ` · ${detail}` : ''}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? ` · ${detail}` : ''}`); }
  return ok;
};
const section = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`);

// ─────────────────────────────────────────────────────────────────────────────
// ARM A — the empirical self-pair
// ─────────────────────────────────────────────────────────────────────────────
const N = 6;
const TICKS = 1200;      // 20 s at 60 Hz
const KILL_TICK = 90;    // 1.5 s in, so the corpse is carried for 1 110 ticks
const DT = 16.67;

// The same fixture shape `dd_bitid.mjs` uses — a bare `ArenaDefinition` with the real
// ×4 dimensions out of `arena/shared.ts`'s numbers, and six ring spawns.
const arena = {
  id: 'sv', displayName: 'sv', width: 2800, height: 2000,
  center: { x: 1400, y: 1000 }, maxSafeRadius: 900,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 2600, y: 1800 },
  cover: [], hazards: [], build() { return {}; },
};
const ringSpawn = (i) => ({
  x: arena.center.x + 500 * Math.cos((i / N) * Math.PI * 2),
  y: arena.center.y + 500 * Math.sin((i / N) * Math.PI * 2),
});

/** Everything a tick can legally change, in a stable order. */
function digestTick(state, events) {
  const f = state.fighters.map((x) => [
    x.id, x.x, x.y, x.hp, x.alive ? 1 : 0, x.facing.x, x.facing.y, x.deaths,
    x.cast === null ? 'n' : `${x.cast.weaponIndex}@${x.cast.resolvesAt}`,
    x.terrainSlowFactor, x.concealed ? 1 : 0, x.revealedUntil ?? null,
  ]);
  const p = state.projectiles.map((x) => [x.id, x.x, x.y, x.vx, x.vy, x.damage, x.ownerId]);
  const s = state.sightings.map((x) => [x.x, x.y, x.at]);
  return JSON.stringify([state.phase, state.elapsed, state.timeRemaining, state.safeRadius,
    state.winnerId ?? null, f, p, s, state.trailMarks.length, events]);
}

/**
 * `onTick` receives the LIVE state. Arm A2 passes the real camera call; A3 passes a
 * deliberate mutation. Everything else about the three runs is identical.
 */
function runArm(name, onTick) {
  const state = createMatch(arena, Array.from({ length: N }, (_, i) => ({
    characterId: 'hamburger', spawn: ringSpawn(i), controller: 'ai',
  })));
  state.phase = 'playing';
  const h = createHash('sha256');
  let deaths = 0;
  let postDeathPlayingTicks = 0;
  let cameraCalls = 0;
  let subjectMoves = 0;
  let lastSubject = 0;
  for (let t = 0; t < TICKS; t++) {
    if (t === KILL_TICK) applyDamage(state, state.fighters[0], 9999, null, { kind: 'hazard' }, []);
    const events = stepMatch(state, DT, { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false });
    if (onTick) {
      const s = onTick(state, events, lastSubject);
      cameraCalls++;
      if (typeof s === 'number') { if (s !== lastSubject) subjectMoves++; lastSubject = s; }
    }
    h.update(digestTick(state, events));
    if (t > KILL_TICK && state.phase === 'playing') postDeathPlayingTicks++;
  }
  deaths = state.fighters.filter((f) => !f.alive).length;
  return { name, sha: h.digest('hex'), deaths, postDeathPlayingTicks, cameraCalls, subjectMoves };
}

/** The exact shape of the call `match.ts:updateViewSubject` makes, on the live array. */
function cameraTick(state, events, current) {
  const killedBy = state.__svKilledBy ?? (state.__svKilledBy = []);
  const lastHitBy = [];
  for (const ev of events) {
    if (ev.type === 'hit-landed') {
      const slot = typeof ev.targetId === 'number' ? ev.targetId : (ev.targetRole === 'player' ? 0 : 1);
      lastHitBy[slot] = ev.source?.kind === 'weapon' ? ev.source.attackerId
        : ev.source?.kind === 'trail' ? ev.source.ownerId : undefined;
    } else if (ev.type === 'death') {
      const slot = typeof ev.fighterId === 'number' ? ev.fighterId : (ev.fighterRole === 'player' ? 0 : 1);
      killedBy[slot] = lastHitBy[slot] ?? null;
    }
  }
  return resolveViewSubject({
    seats: state.fighters,          // 🚨 THE LIVE ARRAY, exactly as `match.ts` passes it
    localSlot: 0,
    current,
    killedBy,
    cameraX: state.fighters[current]?.x ?? 0,
    cameraY: state.fighters[current]?.y ?? 0,
    cutBeyondUnits: 510.04,
  }).slot;
}

console.log('sv_bitid — the spectator camera cannot reach the simulation');
section('A  EMPIRICAL — one seeded six-fighter match, three runs, per-tick digest');

const A1 = runArm('A1 plain stepMatch', null);
const A2 = runArm('A2 + the real resolveViewSubject on the live state', cameraTick);
const A3 = runArm('A3 KNOWN-BAD: a callback that writes one field', (state, events, cur) => {
  const s = cameraTick(state, events, cur);
  state.fighters[0].hp -= 1e-9;   // the smallest lie a presentation layer could tell
  return s;
});

for (const a of [A1, A2, A3]) {
  console.log(`    ${a.name}\n      sha ${a.sha}\n      deaths ${a.deaths}/${N} · post-death playing ticks ${a.postDeathPlayingTicks} · camera calls ${a.cameraCalls} · subject moves ${a.subjectMoves}`);
}

// 🚨 NON-VACUITY BEFORE THE COMPARISON. A match with no corpse never reaches the rule.
check('A0a the run really kills the local seat and keeps playing afterwards',
  A2.deaths >= 1 && A2.postDeathPlayingTicks > 0,
  `${A2.deaths} dead, ${A2.postDeathPlayingTicks} playing ticks after the kill`);
check('A0b the camera rule was actually EXERCISED and actually MOVED the subject',
  A2.cameraCalls === TICKS && A2.subjectMoves > 0,
  `${A2.cameraCalls} calls, subject changed ${A2.subjectMoves} time(s)`);
check('A1==A2 the sim is BIT-IDENTICAL with the camera rule in and out',
  A1.sha === A2.sha, `${A1.sha.slice(0, 16)} vs ${A2.sha.slice(0, 16)}`);
check('A3 KNOWN-BAD: a 1e-9 write to one fighter DOES move the digest',
  A3.sha !== A1.sha, `${A3.sha.slice(0, 16)} vs ${A1.sha.slice(0, 16)} — the comparison has teeth`);

// ─────────────────────────────────────────────────────────────────────────────
// ARM B — the import closure
// ─────────────────────────────────────────────────────────────────────────────
section('B  STRUCTURAL — the import closure of src/game/sim.ts');

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null;              // bare package — not ours
  const base = pathResolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(cand) && !cand.endsWith('/')) {
      try { if (readFileSync(cand).length >= 0) return cand; } catch { /* dir */ }
    }
  }
  return null;
}

function closureFrom(entry) {
  const seen = new Set();
  const stack = [pathResolve(entry)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    let src;
    try { src = readFileSync(f, 'utf8'); } catch { continue; }
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(src)) !== null) {
      const spec = m[1] ?? m[2];
      if (!spec) continue;
      const r = resolveSpec(f, spec);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return seen;
}

const simClosure = closureFrom(join(REPO, 'src/game/sim.ts'));
const MATCH_TS = pathResolve(join(REPO, 'src/game/match.ts'));
const CAMERA_TS = pathResolve(join(REPO, 'src/render/camera.ts'));

check('B0 the walker actually walked (a closure of 1 file would prove nothing)',
  simClosure.size > 3, `${simClosure.size} files reachable from sim.ts`);
check('B1 src/game/match.ts is NOT in the sim\'s import closure', !simClosure.has(MATCH_TS));
check('B2 src/render/camera.ts is NOT in the sim\'s import closure', !simClosure.has(CAMERA_TS));

const matchClosure = closureFrom(MATCH_TS);
check('B-KB the SAME walker reaches camera.ts from match.ts — so it can find an edge',
  matchClosure.has(CAMERA_TS), `${matchClosure.size} files reachable from match.ts`);
check('B-KB2 …and reaches sim.ts from match.ts too',
  matchClosure.has(pathResolve(join(REPO, 'src/game/sim.ts'))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
