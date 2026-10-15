#!/usr/bin/env node
/**
 * BH_MOVE_TRAIL — does a Sticky Trail stop hurting the moment its Donut dies, while it is
 * still lying on the floor?
 *
 * Review-phase probe (2026-10-15). READ-ONLY: imports the sim from `--src-root` (default:
 * the clean detached worktree of HEAD at /private/tmp/fa-rv-head). Writes only under
 * shots/rv/bugs/move/.
 *
 * THE SUSPICION (six-seat class — it cannot express at two seats)
 *   `sim.ts:applyWorldTick(state, fighter)` damages victims standing on marks whose
 *   `ownerId === fighter.id`, i.e. a mark is only ever tested during its OWNER's world tick.
 *   The fighter loop `continue`s for a corpse, so once the Donut dies its marks are tested by
 *   nobody — yet `expireGroundEffects` keeps them for the rest of `TRAIL.durationMs` and
 *   `vfx.ts` syncs every entry of `state.trailMarks` with the same shimmering hazard look.
 *   At N=2 the Donut's death ends the match, so nobody can walk on them afterwards.
 *
 * SCENARIO (all three seats `human`, scripted input, shipped arena, an open lane found by
 * search): slot 1 Donut walks the lane for 1.5 s laying marks; slot 2 is a bystander that
 * keeps N=3 alive; slot 0 walks the same lane over the marks starting at t = 1.5 s.
 *   ARM alive  — the Donut lives:            trail hits on the walker MUST be > 0 (control).
 *   ARM dead   — the Donut is killed at 1.5 s through the real `combat.ts:applyDamage`
 *                (weapon source, attacker = slot 2): count trail hits on the walker, and the
 *                Donut's marks still in `state.trailMarks` (the list the renderer draws).
 *   ARM duel   — same as `dead` at N=2: the kill ends the match (phase must be 'ended'),
 *                which is why no two-seat instrument could see this.
 *
 * Use: node tools/tmp/bh_move_trail.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
mkdirSync(OUT_DIR, { recursive: true });

const { createMatch, stepMatch } = await import(`${SRC_ROOT}/src/game/sim.ts`);
const { applyDamage } = await import(`${SRC_ROOT}/src/game/combat.ts`);
const R = await import(`${SRC_ROOT}/src/game/rules.ts`);
const { PLAYER_SIZE, TRAIL } = R;
const ARENA = { ...JSON.parse(readFileSync(ARENA_PATH, 'utf8')), build: () => null, update: () => {} };
const HALF = PLAYER_SIZE / 2;
const legal = (x, y) => x >= HALF && x <= ARENA.width - HALF && y >= HALF && y <= ARENA.height - HALF
  && !ARENA.cover.some((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2);
const nearHazard = (x, y) => ARENA.hazards.some((h) => Math.hypot(x - h.x, y - h.y) < h.radius + 60);

// Find an open east-west lane: 600 wu of legal, hazard-free floor inside the opening ring.
function findLane() {
  for (let y = 300; y <= 1700; y += 10) {
    for (let x0 = 200; x0 <= 2000; x0 += 20) {
      let ok = true;
      for (let x = x0; x <= x0 + 600 && ok; x += 2) {
        for (const dy of [-30, 0, 30]) if (!legal(x, y + dy) || nearHazard(x, y + dy)) { ok = false; break; }
      }
      if (ok) return { x0, y };
    }
  }
  return null;
}

const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
const EAST = { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false };

function run(arm, lane) {
  const n = arm === 'duel' ? 2 : 3;
  const cfg = [
    { characterId: 'egg', controller: 'human', spawn: { x: lane.x0, y: lane.y } },          // walker
    { characterId: 'donut', controller: 'human', spawn: { x: lane.x0 + 60, y: lane.y } },    // trail layer
  ];
  if (n === 3) cfg.push({ characterId: 'sushi', controller: 'human', spawn: { x: lane.x0 + 300, y: lane.y + 400 > ARENA.height - 30 ? lane.y - 400 : lane.y + 400 } });
  const state = createMatch(ARENA, cfg);
  const N = () => new Array(n).fill(NEUTRAL);
  let g = 0;
  while (state.phase !== 'playing' && g++ < 100000) stepMatch(state, 1000 / 60, N());
  const W = state.fighters[0], D = state.fighters[1];
  // Phase 1: the Donut walks east for 1.5 s, the walker waits.
  let t = 0;
  while (t < 1500) { const inp = N(); inp[1] = EAST; stepMatch(state, 1000 / 60, inp); t += 1000 / 60; }
  const marksLaid = state.trailMarks.filter((m) => m.ownerId === 1).length;
  if (arm !== 'alive') {
    const evs = [];
    applyDamage(state, D, D.hp + 1, null, { kind: 'weapon', weaponKey: 'probe', weaponName: 'probe', attackerId: n === 3 ? 2 : 0 }, evs);
  }
  const phaseAfterKill = state.phase;
  // Phase 2: the walker walks east over the marks for 2.5 s; the Donut (if alive) stands still.
  let trailHits = 0, trailDmg = 0;
  let marksVisibleWhileWalking = 0;
  t = 0;
  while (t < 2500 && state.phase === 'playing') {
    const inp = N(); inp[0] = EAST;
    const evs = stepMatch(state, 1000 / 60, inp);
    for (const e of evs) if (e.type === 'hit-landed' && e.targetId === 0 && e.source.kind === 'trail') { trailHits++; trailDmg += e.amount; }
    // Marks of the Donut within TRAIL.radius of the walker this tick — what the player stands on.
    marksVisibleWhileWalking = Math.max(marksVisibleWhileWalking,
      state.trailMarks.filter((m) => m.ownerId === 1 && Math.hypot(W.x - m.x, W.y - m.y) < TRAIL.radius).length);
    t += 1000 / 60;
  }
  return {
    arm, n, donutAlive: D.alive, phaseAfterKill, marksLaid,
    donutMarksStillListed: state.trailMarks.filter((m) => m.ownerId === 1).length,
    maxMarksUnderWalker: marksVisibleWhileWalking, trailHits, trailDmg, walkerEndX: +W.x.toFixed(1),
  };
}

const lane = findLane();
if (!lane) { console.error('no open lane found'); process.exit(2); }
console.log(`src-root ${SRC_ROOT}\nlane: y=${lane.y}, x ${lane.x0}..${lane.x0 + 600}\n`);
const res = ['alive', 'dead', 'duel'].map((a) => run(a, lane));
for (const r of res) console.log(JSON.stringify(r));
const [alive, dead, duel] = res;
const verdict = alive.trailHits > 0 && dead.trailHits === 0 && dead.maxMarksUnderWalker > 0 && duel.phaseAfterKill === 'ended';
console.log(`\ncontrol (Donut alive) trail hits on the walker: ${alive.trailHits}  (${alive.trailDmg} HP)`);
console.log(`Donut dead at N=3: walker stood on up to ${dead.maxMarksUnderWalker} of its marks, ${dead.donutMarksStillListed} still listed (drawn) at the end, trail hits: ${dead.trailHits}`);
console.log(`N=2: the kill ends the match (phase ${duel.phaseAfterKill}) — unobservable at two seats`);
console.log(verdict ? '\nREPRODUCED: a dead Donut\'s trail stays on the floor and deals nothing (N>=3 only).' : '\nNOT REPRODUCED');
writeFileSync(`${OUT_DIR}/trail_after_death.json`, JSON.stringify({ srcRoot: SRC_ROOT, lane, res, verdict }, null, 2));
