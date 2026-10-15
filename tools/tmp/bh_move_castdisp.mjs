#!/usr/bin/env node
/**
 * BH_MOVE_CASTDISP — can a Disposal relocation move a wind-up away from its telegraph?
 * Review-phase probe (2026-10-15). READ-ONLY; imports `--src-root` (default: the clean
 * worktree of HEAD). Writes only under shots/rv/bugs/move/.
 *
 * THE CLAIM UNDER TEST (movement.ts `stepPush` header, `state.ts:ActiveCast`):
 *   "a cast's origin and bearing are frozen BY CONSTRUCTION with no stored copy, because
 *   x/y are written only by tryMove and the two paths that reach it are both suppressed
 *   mid-cast — a telegraph drawn where the caster stands at the press cannot lie about
 *   where the effect lands." `stepPush` refuses a locked fighter for exactly this reason
 *   ("A CORRECTNESS REQUIREMENT, NOT A BALANCE CHOICE").
 *   `placeFighterAt` (Disposal) is a fourth writer of x/y and checks no lock.
 *
 * SCENARIO, N=3, all seats `human` with scripted input on open floor (found by search):
 *   slot 1 Water Bottle presses Mega Splash (castMs 1400, melee, range 84, cone 100) aimed
 *   east — `vfx.ts:spawnCastTelegraph` draws the footprint at its position on `cast-started`;
 *   slot 0 (thrower, Disposal equipped) stands 30 wu west of it;
 *   slot 2 (destination) stands 300 wu east — 3.6x outside the telegraphed reach.
 *   ARM throw   — one tick after the press, slot 0 presses Disposal on slot 1.
 *   ARM control — no throw.
 *   Reported: where the cast resolved, whether slot 2 was hit by Mega, and its distance from
 *   the telegraph origin.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; } }
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
mkdirSync(OUT_DIR, { recursive: true });
const { createMatch, stepMatch } = await import(`${SRC_ROOT}/src/game/sim.ts`);
const R = await import(`${SRC_ROOT}/src/game/rules.ts`);
const ARENA = { ...JSON.parse(readFileSync(ARENA_PATH, 'utf8')), build: () => null, update: () => {} };
const legal = (x, y) => x >= 21 && x <= ARENA.width - 21 && y >= 21 && y <= ARENA.height - 21
  && !ARENA.cover.some((o) => Math.abs(x - o.x) < (42 + o.w) / 2 && Math.abs(y - o.y) < (42 + o.h) / 2);
const MEGA = R.CHARACTERS.waterbottle.weapons.findIndex((w) => w.key === 'Mega');

function findLane() {
  for (let y = 300; y <= 1700; y += 10) for (let x0 = 200; x0 <= 2300; x0 += 20) {
    let ok = true;
    for (let x = x0 - 40; x <= x0 + 340 && ok; x += 2) for (const dy of [-40, 0, 40]) if (!legal(x, y + dy) || ARENA.hazards.some((h) => Math.hypot(x - h.x, y + dy - h.y) < h.radius + 50)) { ok = false; break; }
    if (ok) return { x: x0, y };
  }
  return null;
}
const lane = findLane();
const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

function run(throwIt) {
  const W = { x: lane.x + 30, y: lane.y };
  const st = createMatch(ARENA, [
    { characterId: 'sushi', controller: 'human', items: ['disposal'], spawn: { x: lane.x, y: lane.y }, maxHp: 1e6 },
    { characterId: 'waterbottle', controller: 'human', spawn: W, maxHp: 1e6 },
    { characterId: 'egg', controller: 'human', spawn: { x: W.x + 300, y: W.y }, maxHp: 1e6 },
  ]);
  let g = 0; while (st.phase !== 'playing' && g++ < 100000) stepMatch(st, 16.667, [NEUTRAL, NEUTRAL, NEUTRAL]);
  const caster = st.fighters[1], dest = st.fighters[2];
  const log = { throwIt };
  // Tick 1: the press. Aim east, at the destination.
  let evs = stepMatch(st, 16.667, [NEUTRAL, { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: MEGA, attack: true }, NEUTRAL]);
  const cs = evs.find((e) => e.type === 'cast-started' && e.fighterId === 1);
  log.castStarted = !!cs;
  log.telegraphOrigin = { x: caster.x, y: caster.y };   // what match.ts hands spawnCastTelegraph on this event
  log.destToTelegraph = +Math.hypot(dest.x - caster.x, dest.y - caster.y).toFixed(2);
  // Tick 2: the throw.
  evs = stepMatch(st, 16.667, [throwIt ? { ...NEUTRAL, useItem: 0 } : NEUTRAL, NEUTRAL, NEUTRAL]);
  const ih = evs.find((e) => e.type === 'item-hit' && e.itemId === 'disposal');
  log.thrown = !!ih;
  log.castStillOpen = caster.cast !== null;
  log.casterAfterThrow = { x: +caster.x.toFixed(2), y: +caster.y.toFixed(2) };
  // Run to the resolve and a little past it.
  let megaOnDest = 0, fired = null;
  for (let k = 0; k < 120; k++) {
    evs = stepMatch(st, 16.667, [NEUTRAL, NEUTRAL, NEUTRAL]);
    for (const e of evs) {
      if (e.type === 'weapon-fired' && e.fighterId === 1) fired = { t: st.elapsed, x: +caster.x.toFixed(2), y: +caster.y.toFixed(2) };
      if (e.type === 'hit-landed' && e.targetId === 2 && e.source.kind === 'weapon' && e.source.weaponKey === 'Mega') megaOnDest += e.amount;
    }
  }
  log.resolvedAt = fired;
  log.megaDamageOnDest = megaOnDest;
  log.destDistFromTelegraphOrigin = log.destToTelegraph;
  return log;
}
console.log(`src-root ${SRC_ROOT}  lane ${JSON.stringify(lane)}  Mega index ${MEGA}`);
const ctl = run(false), thr = run(true);
for (const r of [ctl, thr]) console.log(JSON.stringify(r));
const verdict = ctl.castStarted && ctl.megaDamageOnDest === 0 && thr.thrown && thr.castStillOpen && thr.megaDamageOnDest > 0;
console.log(verdict
  ? `\nREPRODUCED: the telegraph was drawn at (${thr.telegraphOrigin.x},${thr.telegraphOrigin.y}) with reach 84; the destination stood ${thr.destToTelegraph} wu away and took ${thr.megaDamageOnDest} Mega damage after the caster was relocated mid-wind-up. Control (no throw): ${ctl.megaDamageOnDest}.`
  : '\nNOT REPRODUCED — read the rows');
writeFileSync(`${OUT_DIR}/cast_disposal.json`, JSON.stringify({ srcRoot: SRC_ROOT, lane, control: ctl, thrown: thr, verdict }, null, 2));
