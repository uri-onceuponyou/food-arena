#!/usr/bin/env node
/**
 * BH_PRESENT_REVIVE — is a Leftovers revive REACHABLE in the shipped configuration, and how
 * long does the revived fighter then play?
 *
 * REVIEW-PHASE PROBE (2026-10-15). Read-only on every tracked file.
 *
 * The presentation defect this backs: `characters/types.ts:BaseCharacter.play('death')` sets
 * `deathT = 0`, nothing ever sets it back to -1, and `applyBaseMotion` topples the body
 * whenever `deathT >= 0`. `match.ts` handles no `item-revived` event. So a fighter the sim
 * stands back up is drawn as a corpse for the rest of the match. This probe answers only the
 * SIM half: does the shipped loadout path (`match.ts:newMatch` — items on `LOCAL_SLOT` ONLY,
 * bots `undefined`) ever produce `death(slot 0)` → `item-revived(slot 0)` while the match
 * goes on, and for how many seconds of play afterwards.
 *
 * Arms:
 *   --arm local    leftovers on slot 0 only — exactly `newMatch`'s shape (the shipped path)
 *   --arm none     KNOWN-BAD / control: no loadout at all — must report ZERO revives, or the
 *                  counter is reading something other than the item
 *   --n 6 --matches 60
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const SIM_DIR = String(flag('sim', `${ROOT}/src/game`));
const N = Number(flag('n', 6));
const MATCHES = Number(flag('matches', 60));
const ARM = String(flag('arm', 'local'));
const DT = 1000 / 60;

const { createMatch, stepMatch } = await import(pathToFileURL(`${SIM_DIR}/sim.ts`).href);
const R = await import(pathToFileURL(`${SIM_DIR}/rules.ts`).href);
const ARENA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));

const rosterFor = (i) => {
  const ids = R.CHARACTER_IDS.slice();
  let s = (i * 2654435761) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0; t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
  return ids.slice(0, N);
};

let revives = 0, matchesWithRevive = 0, aliveAfterMs = 0, deaths0 = 0, revivedThenWon = 0;
const samples = [];
for (let i = 0; i < MATCHES; i++) {
  const ids = rosterFor(i);
  const state = createMatch(ARENA, ids.map((characterId, slot) => ({
    characterId, controller: 'ai', spawn: ARENA.spawns[slot], level: R.LEVEL_MIN,
    items: slot === 0 && ARM === 'local' ? ['leftovers'] : undefined,
  })));
  const inputs = new Array(state.fighters.length).fill(null);
  let revivedAt = null;
  let sawRevive = false;
  while (state.phase !== 'ended' && state.elapsed < R.MATCH_DURATION_MS * 4) {
    const evs = stepMatch(state, DT, inputs);
    for (const ev of evs) {
      if (ev.type === 'death' && ev.fighterId === 0) {
        deaths0++;
        if (revivedAt !== null) { aliveAfterMs += state.elapsed - revivedAt; samples.push(state.elapsed - revivedAt); revivedAt = null; }
      }
      if (ev.type === 'item-revived' && ev.fighterId === 0) {
        revives++; sawRevive = true; revivedAt = state.elapsed;
      }
    }
  }
  if (revivedAt !== null) {
    aliveAfterMs += state.elapsed - revivedAt; samples.push(state.elapsed - revivedAt);
    if (state.winnerId === 0) revivedThenWon++;
  }
  if (sawRevive) matchesWithRevive++;
}
samples.sort((a, b) => a - b);
const med = samples.length ? samples[Math.floor(samples.length / 2)] : NaN;
console.log(`\n══ BH_PRESENT_REVIVE  N=${N}  arm=${ARM}  matches=${MATCHES} ══`);
console.log(`slot-0 deaths ${deaths0}   slot-0 revives ${revives}   matches with a revive ${matchesWithRevive}/${MATCHES}`);
console.log(`play after a revive (the time a LIVING fighter is drawn toppled): total ${(aliveAfterMs / 1000).toFixed(1)} s, median ${(med / 1000).toFixed(2)} s, max ${samples.length ? (samples[samples.length - 1] / 1000).toFixed(2) : 'n/a'} s`);
console.log(`revived local seat went on to WIN the match (as a toppled body): ${revivedThenWon}`);
if (ARM === 'local' && deaths0 === 0) { console.error('bh_present_revive: slot 0 never died — vacuous corpus'); process.exit(2); }
