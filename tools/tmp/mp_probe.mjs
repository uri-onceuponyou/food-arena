#!/usr/bin/env node
/**
 * MP_PROBE — what does a finished N-seat match actually LOOK like, in the final state and
 * in the event stream? "Probe before you loop" (`CLAUDE.md` #5).
 *
 * The payout join needs the local seat's PLACE. The working assumption it was briefed with
 * was that *"the rank has to come out of the sim's final state"*. This asks whether it can,
 * and the answer decided where `resolvePlaces` lives and what it reads.
 *
 *   node tools/tmp/mp_probe.mjs                      # 200 matches at N=6
 *   node tools/tmp/mp_probe.mjs --seats 4 --matches 50
 *
 * No browser and no renderer: `stepMatch` never calls `arena.build()`, so the committed
 * `tools/arena.gameplay.json` — the SHIPPED 2800x2000 kitchen with its six authored spawns —
 * is a complete input for the simulation. Same idiom as `tools/match-sim.mjs`.
 *
 * ⚠️ **THE `mp_` PREFIX IS NOT A STYLE CHOICE.** This file was first written as
 * `tools/tmp/pj_probe.mjs` and that name was already taken by a committed PROJECTILE
 * LEGIBILITY probe, which the write destroyed (recovered from git, no work lost). `tools/tmp`
 * is a flat shared namespace across every agent in this project and `??` in `git status` is
 * the only thing that distinguishes "mine" from "a peer's": **check `git ls-files` for the
 * prefix before claiming one.**
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const { CHARACTER_IDS } = await import(`${ROOT}/src/game/rules.ts`);

const RAW = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
export const ARENA = { ...RAW, build: () => null, update: () => {} };

const IDLE = { moveX: 0, moveY: 0, attack: false, facingX: 1, facingY: 0, selectedWeapon: 0 };

/**
 * Play one match to `phase === 'ended'` and return everything a placement resolver could
 * possibly key on.
 *
 * ⚠️ EVERY SEAT IS `'ai'`, INCLUDING SLOT 0. In the shipped game slot 0 is `'human'`, and a
 * Node harness supplies no input — so it would stand on its spawn and be shot first at every
 * seat count, making the death-order statistics below a property of the HARNESS rather than
 * of the game.
 */
export function playMatch({ seats = 6, seed = 0, dt = 16.667 } = {}) {
  const configs = [];
  for (let i = 0; i < seats; i++) {
    configs.push({
      characterId: CHARACTER_IDS[(seed * 7 + i * 3) % CHARACTER_IDS.length],
      controller: 'ai',
      spawn: ARENA.spawns[i],
    });
  }
  const state = createMatch(ARENA, configs);
  const deathOrder = [];
  let ticks = 0;
  let endedBy = 'unresolved';
  while (state.phase !== 'ended' && ticks < 20000) {
    const events = stepMatch(state, dt, configs.map(() => IDLE));
    for (const ev of events) {
      if (ev.type === 'death') deathOrder.push(ev.fighterId);
      if (ev.type === 'match-ended') {
        // A knockout ends the match from `combat.ts:applyDamage` after the (N-1)th death; a
        // timeout from `sim.ts:resolveTimeout`, which pushes no death on the same tick.
        endedBy = deathOrder.length === seats - 1 ? 'knockout' : 'timeout-or-wipe';
      }
    }
    ticks++;
  }
  return {
    state,
    deathOrder,
    endedBy,
    elapsed: state.elapsed,
    aliveAtEnd: state.fighters.filter((f) => f.alive && f.hp > 0).map((f) => f.id),
    hpAtEnd: state.fighters.map((f) => f.hp),
    deathsAtEnd: state.fighters.map((f) => f.deaths),
    winnerId: state.winnerId,
  };
}

if (IS_MAIN) {
  const arg = (k, d) => {
    const i = process.argv.indexOf(`--${k}`);
    return i >= 0 ? process.argv[i + 1] : d;
  };
  const seats = Number(arg('seats', 6));
  const matches = Number(arg('matches', 200));

  let knockouts = 0;
  let suddenDeath = 0;
  const aliveHist = new Map();
  const loserHpDistinct = [];
  const deathOrderIsSlotOrder = [];
  let unresolved = 0;

  for (let s = 0; s < matches; s++) {
    const r = playMatch({ seats, seed: s });
    if (r.state.phase !== 'ended') { unresolved++; continue; }
    if (r.endedBy === 'knockout') knockouts++;
    // Sudden death fires at SUDDEN_DEATH_REMAINING_MS = 15 000 left of a 45 s match.
    if (r.elapsed >= 30000) suddenDeath++;
    aliveHist.set(r.aliveAtEnd.length, (aliveHist.get(r.aliveAtEnd.length) ?? 0) + 1);

    const losers = r.state.fighters.filter((f) => f.id !== r.winnerId);
    // 🚨 THE NUMBER THE WHOLE DESIGN TURNS ON. If this is 1, every loser is bit-identical in
    // the final state and NO final-state resolver can rank them.
    loserHpDistinct.push(new Set(losers.map((f) => `${f.hp}/${f.deaths}`)).size);

    const rev = r.deathOrder.slice().reverse();
    deathOrderIsSlotOrder.push(
      JSON.stringify(rev) === JSON.stringify(losers.map((f) => f.id).sort((a, b) => a - b)) ? 1 : 0,
    );
  }

  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  console.log(`MP_PROBE  seats=${seats}  matches=${matches}`);
  console.log(`  unresolved (hit the 20k tick guard)        ${unresolved}`);
  console.log(`  ended by KNOCKOUT (seats-1 deaths)         ${knockouts}`);
  console.log(`  reached sudden death (elapsed >= 30 s)     ${suddenDeath}`);
  console.log(`  alive-at-end histogram                     ${JSON.stringify([...aliveHist].sort())}`);
  console.log(`  DISTINCT (hp,deaths) pairs among LOSERS    mean ${mean(loserHpDistinct).toFixed(3)}`
    + `  max ${Math.max(...loserHpDistinct)}   (1 = every loser is identical in the final state)`);
  console.log(`  reversed death order === slot order        ${(mean(deathOrderIsSlotOrder) * 100).toFixed(1)}%`);
}
