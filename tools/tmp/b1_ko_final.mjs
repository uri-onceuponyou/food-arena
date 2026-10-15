#!/usr/bin/env node
/**
 * b1_ko_final — the REAL-MATCH corpus behind META-02's early bank (2026-10-15).
 *
 * `match.ts:notifyLocalResult` banks a knocked-out local seat's place on the first frame it is
 * down with the match still playing. That is right only if `roster.ts:resolvePlaces` never
 * moves a knocked-out seat afterwards. `sim.test.mjs` §45 pins the rule on constructed
 * knockouts; this asks it of real all-AI matches (seat 0 standing in for the local seat),
 * with the window found exactly as the session finds it — `eliminated` appended per `death`
 * event in emission order, the place asked after the whole tick.
 *
 *   node tools/tmp/b1_ko_final.mjs [--matches 12] [--n 6,3]
 *
 * Per N it prints: windows (matches where seat 0 was down while still playing), and how many
 * of them gave the SAME place at the window as at the whistle. The known-bad arm ranks with
 * rung 3 inverted (the earliest knockout places best) and must DISAGREE on most windows — or
 * the agreement above is the comparator failing to look, not the rule holding. Exit 1 on any
 * disagreement in the real arm, or a known-bad that never disagrees, or no windows at all.
 *
 * ⚠️ N=2 IS VACUOUS BY CONSTRUCTION (a knockout ends a duel on the same tick) and is reported,
 * not asserted, if asked for.
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { CHARACTER_IDS, MATCH_DURATION_MS } from '../../src/game/rules.ts';
import { resolvePlaces } from '../../src/game/roster.ts';

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MATCHES = Number(flag('matches', 12));
const NS = String(flag('n', '6,3')).split(',').map(Number);

const arena = {
  id: 'b1-ko-final', displayName: 'b1', width: 2800, height: 2000, center: { x: 1400, y: 1000 }, maxSafeRadius: 1720,
  playerSpawn: { x: 500, y: 500 }, enemySpawn: { x: 2300, y: 1500 }, cover: [], hazards: [], build() { return {}; },
};
const SPAWNS = [[500, 500], [2300, 1500], [2300, 500], [500, 1500], [1400, 300], [1400, 1700]];
const inputOf = (st, elim) => ({
  seats: st.fighters.map((f, i) => ({ id: i, alive: f.alive, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, deaths: f.deaths })),
  center: arena.center, eliminated: elim.slice(), winnerId: st.winnerId ?? null,
});
const firstOutBest = (inp) => resolvePlaces({ ...inp, eliminated: inp.eliminated.slice().reverse() });

let faults = 0;
for (const n of NS) {
  let windows = 0; let agree = 0; let badDisagree = 0;
  const t0 = Date.now();
  for (let m = 0; m < MATCHES; m++) {
    const st = createMatch(arena, Array.from({ length: n }, (_, i) => ({
      characterId: CHARACTER_IDS[(m + i * 3) % CHARACTER_IDS.length], controller: 'ai', spawn: { x: SPAWNS[i][0], y: SPAWNS[i][1] },
    })));
    const elim = []; const inputs = new Array(n).fill(null);
    let early = null; let earlyBad = null;
    while (st.phase !== 'ended' && st.elapsed < MATCH_DURATION_MS * 2) {
      for (const ev of stepMatch(st, 16.667, inputs)) if (ev.type === 'death') elim.push(ev.fighterId);
      if (early === null && st.phase === 'playing' && !st.fighters[0].alive) {
        early = resolvePlaces(inputOf(st, elim)).indexOf(0);
        earlyBad = firstOutBest(inputOf(st, elim)).indexOf(0);
      }
    }
    if (early === null) continue;
    windows++;
    if (early === resolvePlaces(inputOf(st, elim)).indexOf(0)) agree++;
    if (earlyBad !== firstOutBest(inputOf(st, elim)).indexOf(0)) badDisagree++;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`N=${n}: ${MATCHES} matches (${secs} s) · windows ${windows} · place at window == place at whistle ${agree}/${windows} · known-bad disagrees ${badDisagree}/${windows}`);
  if (n >= 3) {
    if (windows === 0) { console.log('  FAIL no window — nothing was measured'); faults++; }
    if (agree !== windows) { console.log('  FAIL a knocked-out place MOVED after the knockout'); faults++; }
    if (windows > 0 && badDisagree === 0) { console.log('  FAIL the known-bad never disagreed — the comparator cannot see a moving place'); faults++; }
  } else {
    console.log('  (vacuous by construction at two seats — reported, not asserted)');
  }
}
console.log(faults === 0 ? '\nPASS' : `\n${faults} fault(s)`);
process.exit(faults === 0 ? 0 : 1);
