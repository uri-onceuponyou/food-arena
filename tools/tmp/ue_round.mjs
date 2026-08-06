#!/usr/bin/env node
/**
 * ue_round — assign A/B slots for one blind per-element round and write the key.
 *
 * Position bias was MEASURED at 0.00 on this project (our frame against itself tied
 * 6/6 and 5/5; forcing our panel into slot A then slot B gave identical means), so
 * randomising slots buys nothing statistical. It is done anyway for one reason: it
 * means the ORCHESTRATOR cannot read a verdict off the slot while collating, which is
 * the only way a blind round leaks on this project — the critic never sees the key.
 *
 * The rubric is `tools/review.rubric.txt` **byte-identical**, `--rubric canonical`.
 * It is not adapted for crops and must not be: the rubric alone is worth 2.0 points
 * and editing it starts a new series (the file says so itself). The precedent is
 * `40afa14`, where the same canonical rubric on twelve isolated BODY-PART crops still
 * put the reference side at 8.54 +/- 0.396 — inside the 7-9 validity band. If the
 * reference side lands outside 7-9 here, the round is discarded BEFORE anything is
 * acted on, which is the rule, not a fallback.
 *
 * Deterministic from `--seed` so a round can be reproduced exactly.
 *
 *   node tools/tmp/ue_round.mjs --seed 1 > shots/uielem/_round/plan.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const OUT = get('--out', 'shots/uielem');
const seed0 = Number(get('--seed', 1));

// xorshift32 — deterministic, and its seed is recorded in the plan.
let s = seed0 >>> 0 || 1;
const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };

const man = JSON.parse(readFileSync(`${OUT}/manifest.json`, 'utf8'));
const rubric = readFileSync('tools/review.rubric.txt', 'utf8');

const rounds = [];
for (const e of man.elements) {
  if (!e.valid || !e.pairable) continue;
  const oursIsA = rnd() < 0.5;
  rounds.push({
    id: e.element, kind: 'pair',
    A: oursIsA ? e.oursPng : e.refPng,
    B: oursIsA ? e.refPng : e.oursPng,
    key: { A: oursIsA ? 'OURS' : 'REF', B: oursIsA ? 'REF' : 'OURS' },
  });
}
// The two controls, in the identical format, so a round that fails them is discarded.
rounds.push({
  id: '_control_selfpair', kind: 'control-tie',
  A: `${OUT}/_control/selfpair/a.png`, B: `${OUT}/_control/selfpair/b.png`,
  key: { A: 'OURS', B: 'OURS (identical file)' }, expect: 'A and B must TIE — they are the same image',
});
rounds.push({
  id: '_control_degraded', kind: 'control-degraded',
  A: `${OUT}/_control/degraded/a.png`, B: `${OUT}/_control/degraded/b.png`,
  key: { A: 'REF clean', B: 'REF blurred+desaturated+posterised' }, expect: 'B must score materially LOWER than A',
});

mkdirSync(`${OUT}/_round`, { recursive: true });
writeFileSync(`${OUT}/_round/key.json`, JSON.stringify({ seed: seed0, rubricSha: rubric.length, rounds }, null, 2));
writeFileSync(`${OUT}/_round/RUBRIC.txt`, rubric);
for (const r of rounds) console.log(`${r.id}\t${r.A}\t${r.B}`);
console.error(`\nwrote ${OUT}/_round/key.json — ${rounds.length} rounds (${rounds.length - 2} pairs + 2 controls)`);
