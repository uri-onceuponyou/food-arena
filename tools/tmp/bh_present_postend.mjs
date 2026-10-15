#!/usr/bin/env node
/**
 * BH_PRESENT_POSTEND — what happens UNDER THE RESULT CARD?
 *
 * REVIEW-PHASE PROBE (2026-10-15). Read-only on every tracked file.
 *
 * `match.ts:loop` keeps calling `stepMatch` on every frame after `phase === 'ended'` (nothing
 * gates it — the result card sits over a running loop until the player presses something).
 * `sim.ts:stepProjectiles` runs "regardless of match phase", and its comment promises the
 * prototype's behaviour of landing damage for ONE extra tick. `combat.ts:applyDamage` refuses
 * only a dead target, never an ended match. So every projectile in the air at the whistle keeps
 * flying, and keeps hitting, for as long as its range lasts — and `handleEvents` / the audio
 * director voice every one of those hits, and a `death`, on the result screen.
 *
 * This replays the shipped loop's shape: step at 60 fps until `'ended'`, then KEEP stepping for
 * `--tail` seconds exactly as the browser does, and count what the sim emits after the whistle.
 *
 * Arms:
 *   --n 2|6   --matches 200   --tail 5
 *   --arm noproj   KNOWN-BAD / control: projectiles are cleared at the whistle. Every post-end
 *                  hit and death must vanish, or they come from something other than shots
 *                  already in flight.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const SIM_DIR = String(flag('sim', `${ROOT}/src/game`));
const N = Number(flag('n', 2));
const MATCHES = Number(flag('matches', 200));
const TAIL_S = Number(flag('tail', 5));
const ARM = String(flag('arm', 'base'));
const DT = 1000 / 60;

const { createMatch, stepMatch } = await import(pathToFileURL(`${SIM_DIR}/sim.ts`).href);
const R = await import(pathToFileURL(`${SIM_DIR}/rules.ts`).href);
const ARENA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const ids = R.CHARACTER_IDS;

let ended = 0, withPostHit = 0, postHits = 0, postDeaths = 0, winnerKilled = 0, localWinnerKilled = 0, inFlightAtEnd = 0;
const examples = [];
for (let i = 0; i < MATCHES; i++) {
  // Every ordered pair at N=2 (11x10=110 cells) cycled; rotating windows at N=6.
  const roster = N === 2
    ? [ids[i % ids.length], ids[(i + 1 + Math.floor(i / ids.length)) % ids.length]]
    : Array.from({ length: N }, (_, k) => ids[(i + k * 3) % ids.length]);
  if (N === 2 && roster[0] === roster[1]) roster[1] = ids[(i + 2) % ids.length];
  const st = createMatch(ARENA, roster.map((c, s) => ({ characterId: c, controller: 'ai', spawn: ARENA.spawns[s], level: R.LEVEL_MIN })));
  const inputs = new Array(N).fill(null);
  while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS * 4) stepMatch(st, DT, inputs);
  if (st.phase !== 'ended') continue;
  ended++;
  inFlightAtEnd += st.projectiles.length;
  if (ARM === 'noproj') st.projectiles.length = 0;
  const winner = st.winnerId;
  let hitsHere = 0;
  for (let t = 0; t < TAIL_S * 1000; t += DT) {
    for (const ev of stepMatch(st, DT, inputs)) {
      if (ev.type === 'hit-landed') { postHits++; hitsHere++; }
      if (ev.type === 'death') {
        postDeaths++;
        if (ev.fighterId === winner) {
          winnerKilled++;
          if (winner === 0) localWinnerKilled++;
          if (examples.length < 5) examples.push(`match ${i} [${roster.join(',')}] winner slot ${winner} (${roster[winner]}) killed ${(t / 1000).toFixed(2)} s after the whistle`);
        }
      }
    }
  }
  if (hitsHere > 0) withPostHit++;
}
console.log(`\n══ BH_PRESENT_POSTEND  N=${N}  arm=${ARM}  matches=${MATCHES}  tail=${TAIL_S}s ══`);
console.log(`ended ${ended}   projectiles in flight at the whistle ${inFlightAtEnd}`);
console.log(`matches with >=1 hit AFTER the whistle: ${withPostHit}/${ended}   post-whistle hits ${postHits}   post-whistle deaths ${postDeaths}`);
console.log(`the DECLARED WINNER killed after the whistle: ${winnerKilled}/${ended}  (local seat = slot 0 was that winner: ${localWinnerKilled})`);
for (const e of examples) console.log('  e.g.', e);
if (ended === 0) { console.error('bh_present_postend: no match ended — vacuous'); process.exit(2); }
