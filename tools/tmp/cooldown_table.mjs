#!/usr/bin/env node
/**
 * COOLDOWN AUDIT — every weapon's cooldown expressed as USES PER MATCH and as a share
 * of the time a fight is actually happening, from `tools/tmp/census_base.json`.
 *
 * A cooldown in milliseconds is only meaningful against the length of the thing it is
 * being spent inside. The match went 180 s -> 45 s and the ENGAGEMENT inside it is
 * ~6 s, so an 8 s cooldown is not "an ultimate", it is "a button you press once, if".
 */
import { readFileSync } from 'node:fs';
const ROOT = '/Users/uribishansky/claude-code/food-arena';
const d = JSON.parse(readFileSync(`${ROOT}/tools/tmp/census_base.json`, 'utf8'));
const R = await import(`${ROOT}/src/game/rules.ts`);
const pols = ['smart', 'chase'];
const eng = Object.fromEntries(pols.map((p) => [p, d.policies[p].meanEngagedMs]));
const play = Object.fromEntries(pols.map((p) => [p, d.policies[p].meanPlayMs]));
console.log(`engaged: ${pols.map((p) => `${p} ${(eng[p] / 1000).toFixed(2)}s`).join('  ')}   play: ${pols.map((p) => `${p} ${(play[p] / 1000).toFixed(2)}s`).join('  ')}\n`);
console.log(`${'character'.padEnd(12)}${'weapon'.padEnd(10)}${'type'.padEnd(8)}${'cd(ms)'.padStart(7)}${'cd/eng'.padStart(8)}` +
  `${'smart f/m'.padStart(10)}${'chase f/m'.padStart(10)}${'smart h/m'.padStart(10)}   verdict`);
const rows = [];
for (const id of R.CHARACTER_IDS) {
  for (const w of R.CHARACTERS[id].weapons) {
    const get = (p, field) => (d.policies[p].weapons.find((x) => x.id === id && x.key === w.key) ?? {})[field] ?? 0;
    const fS = get('smart', 'fires'), fC = get('chase', 'fires'), hS = get('smart', 'hits');
    const cdEng = w.cooldown / eng.smart;
    let verdict = '';
    if (Math.max(fS, fC) < 0.5) verdict = 'DEAD — under half a use per match';
    else if (Math.max(fS, fC) < 1.2) verdict = 'once-a-match at best';
    else if (cdEng > 0.5) verdict = 'cooldown > half the fight';
    rows.push({ id, key: w.key, type: w.type, cd: w.cooldown, cdEng, fS, fC, hS, verdict });
  }
}
rows.sort((a, b) => b.cd - a.cd);
for (const r of rows) {
  console.log(`${r.id.padEnd(12)}${r.key.padEnd(10)}${r.type.padEnd(8)}${String(r.cd).padStart(7)}${(r.cdEng * 100).toFixed(0).padStart(7)}%` +
    `${r.fS.toFixed(2).padStart(10)}${r.fC.toFixed(2).padStart(10)}${r.hS.toFixed(2).padStart(10)}   ${r.verdict}`);
}
const at = (T) => rows.filter((r) => r.cd > T).map((r) => `${r.id}/${r.key}`);
console.log(`\nweapons whose cooldown exceeds the mean ENGAGEMENT (${(eng.smart / 1000).toFixed(2)}s): ${at(eng.smart).join(', ') || 'none'}`);
console.log(`weapons whose cooldown exceeds HALF the engagement: ${at(eng.smart / 2).length} of ${rows.length}`);
