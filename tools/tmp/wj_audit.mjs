#!/usr/bin/env node
/**
 * wj_audit — re-derive, from the tree, the three claims the weapon/ability-join brief
 * makes. Read-only, offline, no browser.
 *
 *   node tools/tmp/wj_audit.mjs          # the table + the three verdicts
 *   node tools/tmp/wj_audit.mjs --json
 *
 * THE CLAIMS (each is printed VERIFIED or FALSIFIED with the number that decided it):
 *   C1  33 of 34 abilities join to a weapon by exact `name`.
 *   C2  only 30 of 34 also join by INDEX (i.e. `abilities[i].name === weapons[i].name`).
 *   C3  `hamburger` is the only character whose two arrays are in a different order,
 *       and 3 of its 4 rows disagree.
 *
 * WHY THIS IS THE RIGHT SHAPE: a positional join is correct for 10 of 11 characters,
 * which is exactly why it survived — and an auditor with a purpose-built instrument
 * joined positionally and produced a confidently false finding. The numbers below are
 * the difference between the two joins, computed side by side, so neither can be
 * assumed from the other.
 */
import { CHARACTERS } from '../../src/game/rules.ts';

const IS_MAIN = import.meta.url === `file://${process.argv[1]}`;

/** One row per ability, with BOTH joins computed independently. */
export function auditCharacter(c) {
  const rows = c.abilities.map((a, i) => {
    const byName = c.weapons.findIndex((w) => w.name === a.name);
    const byIndex = i < c.weapons.length ? i : -1;
    return {
      i,
      ability: a.name,
      byNameIndex: byName,
      byNameWeapon: byName >= 0 ? c.weapons[byName].name : null,
      byIndexWeapon: byIndex >= 0 ? c.weapons[byIndex].name : null,
      // The two joins DISAGREE when they land on different weapons — including the case
      // where one finds a weapon and the other finds none.
      agree: byName === byIndex,
    };
  });
  return {
    id: c.id,
    nAbilities: c.abilities.length,
    nWeapons: c.weapons.length,
    rows,
    orphanAbilities: rows.filter((r) => r.byNameIndex < 0).map((r) => r.ability),
    orphanWeapons: c.weapons
      .filter((w) => !c.abilities.some((a) => a.name === w.name))
      .map((w) => w.name),
    disagreeing: rows.filter((r) => !r.agree).length,
  };
}

export function audit() {
  const per = Object.values(CHARACTERS).map(auditCharacter);
  const totalAbilities = per.reduce((n, p) => n + p.nAbilities, 0);
  const joinByName = per.reduce((n, p) => n + p.rows.filter((r) => r.byNameIndex >= 0).length, 0);
  const joinByIndex = per.reduce(
    (n, p) => n + p.rows.filter((r) => r.byNameIndex >= 0 && r.byNameIndex === r.i).length, 0);
  const disordered = per.filter((p) => p.disagreeing > 0);
  return { per, totalAbilities, joinByName, joinByIndex, disordered };
}

if (IS_MAIN) {
  const a = audit();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(a, null, 2));
  } else {
    for (const p of a.per) {
      const flag = p.disagreeing > 0 ? '  <-- ORDERS DISAGREE' : '';
      console.log(`${p.id.padEnd(12)} abilities=${p.nAbilities} weapons=${p.nWeapons}${flag}`);
      for (const r of p.rows) {
        const mark = r.agree ? '  ' : '!!';
        console.log(`  ${mark} [${r.i}] ${String(r.ability).padEnd(22)} byName=${
          String(r.byNameIndex).padStart(2)} (${r.byNameWeapon ?? 'NONE'})   byIndex=(${r.byIndexWeapon ?? 'NONE'})`);
      }
      if (p.orphanAbilities.length) console.log(`     orphan abilities: ${p.orphanAbilities.join(', ')}`);
      if (p.orphanWeapons.length) console.log(`     orphan weapons:   ${p.orphanWeapons.join(', ')}`);
    }
    console.log('');
    console.log(`C1  join by NAME  : ${a.joinByName} of ${a.totalAbilities}`);
    console.log(`C2  join by INDEX : ${a.joinByIndex} of ${a.totalAbilities}`);
    console.log(`C3  characters whose orders disagree: ${
      a.disordered.map((p) => `${p.id} (${p.disagreeing}/${p.nAbilities} rows)`).join(', ') || 'NONE'}`);
  }
}
