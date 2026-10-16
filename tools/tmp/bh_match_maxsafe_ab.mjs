#!/usr/bin/env node
// bh_match_maxsafe_ab — review-phase probe (2026-10-15). roster_lab / nf_ffa / conceal_lab derive
// maxSafeRadius = round(halfDiag / (1 - 6000/150000)) = 1792; the shipped arena uses
// fogOpeningRadiusFor(halfDiag) = 1720.465. Paired all-AI duels on identical rosters, both radii.
// Does the instruments' maxSafeRadius (1792, the retired division) describe the same matches as
// the shipped 1720.465 (fogOpeningRadiusFor = identity)? Paired, same rosters, same dt.
const SIM='/private/tmp/fa-rv-head/src/game';
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const { CHARACTER_IDS } = await import(`${SIM}/rules.ts`);
const fs = await import('node:fs');
const d = JSON.parse(fs.readFileSync('/private/tmp/fa-rv-head/tools/arena.gameplay.json','utf8'));
const halfDiag = Math.hypot(d.width/2, d.height/2);
// KNOWN-BAD arm of this A/B: the retired division, computed on purpose (fs_sched_census exempts it).
const instr = Math.round(halfDiag / (1 - 6000 / 150000));
console.log('dump/shipped maxSafeRadius', d.maxSafeRadius, 'instrument-derived', instr);
function run(maxSafe, p, e) {
  const arena = { ...d, maxSafeRadius: maxSafe, build: () => null, update: () => {} };
  const st = createMatch(arena, [{ characterId: p, controller: 'ai' }, { characterId: e, controller: 'ai' }]);
  let n = 0; while (st.phase !== 'ended' && st.elapsed < 260000) { stepMatch(st, 16.667, [null, null]); n++; }
  return `${st.winnerId}@${n}`;
}
let same = 0, diff = 0, flips = 0; const ex = [];
for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) { if (p === e) continue;
  const a = run(d.maxSafeRadius, p, e), b = run(instr, p, e);
  if (a === b) same++; else { diff++; if (a.split('@')[0] !== b.split('@')[0]) flips++; if (ex.length < 6) ex.push(`${p} vs ${e}: shipped ${a} | instrument ${b}`); } }
console.log(JSON.stringify({ same, diff, winnerFlips: flips }), '\n' + ex.join('\n'));
