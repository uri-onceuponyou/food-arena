// bh_combat_lib — shared harness for the bh_combat_* REVIEW probes (combat-dimension bug hunt).
//
// READ-ONLY: imports the sim from a tree you name (default: the clean detached worktree of the
// commit under review) and never writes a tracked file. Every probe takes `--root <tree>` so the
// SAME probe can be pointed at a scratch copy with a planted known-bad — a probe that cannot be
// shown to see the defect class it claims to test proves nothing (CLAUDE.md rule 6).
//
// Exports:
//   loadSim(root)            -> { sim, rules, state, combat, movement, root }
//   fixtureArena(opts)       -> an empty ArenaDefinition (no cover, no hazards, huge fog radius)
//   kitchenArena(root)       -> the shipped kitchen, from tools/arena.gameplay.json (verified equal
//                               to a live createKitchenArena() on 1090046 — see REPORT.md)
//   seatMatch(S, arena, seats) -> MatchState in 'playing', every seat placed/facing as asked
//   input(o)                 -> a MatchInput
//   argv(name, dflt)         -> CLI flag reader
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const REPO = resolve(new URL('../..', import.meta.url).pathname);
export const DEFAULT_ROOT = '/private/tmp/fa-rv-head';

export function argv(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

export async function loadSim(root = DEFAULT_ROOT) {
  const g = `${root}/src/game`;
  const [sim, rules, state, combat, movement] = await Promise.all([
    import(`${g}/sim.ts`), import(`${g}/rules.ts`), import(`${g}/state.ts`),
    import(`${g}/combat.ts`), import(`${g}/movement.ts`),
  ]);
  return { sim, rules, state, combat, movement, root };
}

export function fixtureArena({ width = 2000, height = 2000, cover = [], hazards = [], maxSafeRadius = 1e6 } = {}) {
  return {
    id: 'bh-fixture', displayName: 'bh fixture', width, height,
    center: { x: width / 2, y: height / 2 }, maxSafeRadius,
    playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: width - 200, y: height - 200 },
    cover, hazards, build: () => null, update: () => {},
  };
}

export function kitchenArena() {
  const d = JSON.parse(readFileSync(`${REPO}/tools/arena.gameplay.json`, 'utf8'));
  return { ...d, build: () => null, update: () => {} };
}

/**
 * seats: [{ characterId, x, y, facing?:{x,y}, controller?, items?, level?, maxHp? }]
 * Every seat defaults to controller 'human' so a probe fully controls who acts (a missing
 * per-slot input is NEUTRAL, i.e. stands still and does nothing).
 */
export function seatMatch(S, arena, seats) {
  const configs = seats.map((s) => ({
    characterId: s.characterId,
    controller: s.controller ?? 'human',
    spawn: { x: s.x, y: s.y },
    facing: s.facing ?? { x: 1, y: 0 },
    level: s.level,
    items: s.items,
    maxHp: s.maxHp,
  }));
  const st = S.sim.createMatch(arena, configs);
  st.phase = 'playing';
  return st;
}

export function input({ move = { x: 0, y: 0 }, aim, weapon = 0, attack = false, useItem } = {}) {
  const o = { move, selectedWeapon: weapon, attack };
  if (aim) o.aim = aim;
  if (useItem !== undefined) o.useItem = useItem;
  return o;
}

export function weaponIndex(S, characterId, key) {
  const i = S.rules.CHARACTERS[characterId].weapons.findIndex((w) => w.key === key);
  if (i < 0) throw new Error(`no weapon ${characterId}.${key}`);
  return i;
}

export const DT = 16.667;
