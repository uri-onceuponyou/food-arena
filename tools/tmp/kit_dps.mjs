#!/usr/bin/env node
/**
 * KIT DPS — potential damage per second as a function of DISTANCE, computed with the
 * exact weapon-selection rule both drivers use.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * The roster table (`tools/tmp/roster_table.mjs`) says WHICH characters are outliers.
 * It cannot say WHY, because a match mixes kit, reach, pathing, hazards and luck. This
 * separates the one part of the answer that is pure arithmetic: given that both
 * `ai.ts:pickHighestDamageWeapon` and the scripted player's `bestWeapon` pick the
 * HIGHEST-DAMAGE weapon that is off cooldown AND in range, what output can a kit
 * sustain if it simply stands at distance d and presses the button?
 *
 * This is an UPPER BOUND and says so:
 *   * every shot is assumed to hit. Multi-pellet weapons are counted at FULL pellet
 *     count, which the sim never delivers at range (measured: Sushi's 5-pellet Rice
 *     Spray lands ~1.9). The `--pellets 1` mode gives the pessimistic bound; the truth
 *     is between them and the gap is itself a property of the kit.
 *   * it ignores flight time, cover, and the target moving out of range.
 *
 * What it is exact about is the SHAPE: which bands a kit can fight in at all, where its
 * output falls off a cliff, and whether the greedy rule leaves a weapon unreachable.
 * A weapon that is never the highest-damage option in any band it is in range for is
 * DEAD to both drivers, however good it looks in the table — that is a real property of
 * the roster, not an instrument artefact, because both drivers share the rule.
 *
 *   node tools/tmp/kit_dps.mjs
 *   node tools/tmp/kit_dps.mjs --pellets 1        # pessimistic bound
 *   node tools/tmp/kit_dps.mjs --sim /tmp/staged/game
 */
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const R = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH } = R;
const PELLET_MODE = String(args.pellets ?? 'all');

/** Damage one press of `w` can deliver, at the chosen pellet assumption. */
function damagePerFire(w) {
  if (w.comboParts) return w.comboParts.reduce((a, p) => a + p.damage, 0);
  const pellets = PELLET_MODE === '1' ? 1 : (w.pellets ?? 1);
  const pecks = w.peckHits ?? 1;
  return (w.damage ?? 0) * pellets * pecks;
}

const BANDS = [42, 58, 70, 84, 98, 116, 128, 140, 200, 400];
const T = 30_000, DT = 16.667;

/** Greedy rotation, identical rule to `ai.ts:pickHighestDamageWeapon` / the script's
 *  `bestWeapon`: highest `damage` among weapons that are ready and whose range >= d.
 *  Note it compares the AUTHORED `damage` field, NOT `damagePerFire` — so a 5-pellet
 *  weapon at damage 2 loses to a single shot at damage 3 even though it delivers 10.
 *  That is the shipped rule and it is the whole point of measuring it. */
function rotate(id, d) {
  const ws = CHARACTERS[id].weapons;
  const last = ws.map(() => -Infinity);
  let total = 0, presses = 0;
  for (let t = 0; t < T; t += DT) {
    let best = -1, bestDmg = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (t - last[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; best = i; }
    });
    if (best >= 0) { last[best] = t; total += damagePerFire(ws[best]); presses++; }
  }
  return { dps: (total / T) * 1000, presses };
}

console.log(`\nKIT DPS — potential HP/s by distance · pellets=${PELLET_MODE} · greedy highest-DAMAGE-in-range rule (both drivers)`);
console.log(`sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}\n`);
console.log(`${'character'.padEnd(12)}${'wpns'.padStart(5)}${'reach'.padStart(6)}${BANDS.map((b) => `${b}`.padStart(7)).join('')}${'peak'.padStart(8)}${'@140'.padStart(7)}`);
const rows = [];
for (const id of CHARACTER_IDS) {
  const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self');
  const reach = Math.max(...ws.map((w) => w.range ?? 0));
  const cells = BANDS.map((b) => rotate(id, b).dps);
  const peak = Math.max(...cells);
  rows.push({ id, n: ws.length, reach, cells, peak, at140: rotate(id, 140).dps });
}
rows.sort((a, b) => b.peak - a.peak);
for (const r of rows) {
  console.log(`${r.id.padEnd(12)}${String(r.n).padStart(5)}${String(r.reach).padStart(6)}` +
    `${r.cells.map((c) => c.toFixed(1).padStart(7)).join('')}${r.peak.toFixed(1).padStart(8)}${r.at140.toFixed(1).padStart(7)}`);
}

// ── weapons the greedy rule can never choose ────────────────────────────────
console.log(`\nWEAPONS UNREACHABLE BY THE GREEDY RULE (never the highest-damage ready option in any band they reach):`);
let dead = 0;
for (const id of CHARACTER_IDS) {
  const ws = CHARACTERS[id].weapons;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (w.type === 'self') continue;
    let used = false;
    for (const b of BANDS) {
      if (b > (w.range ?? Infinity)) continue;
      const last = ws.map(() => -Infinity);
      for (let t = 0; t < T; t += DT) {
        let best = -1, bestDmg = -Infinity;
        ws.forEach((x, j) => {
          if (x.type === 'self') return;
          if (t - last[j] < x.cooldown) return;
          if (b > (x.range ?? Infinity)) return;
          if ((x.damage ?? 0) > bestDmg) { bestDmg = x.damage ?? 0; best = j; }
        });
        if (best === i) { used = true; break; }
        if (best >= 0) last[best] = t;
      }
      if (used) break;
    }
    if (!used) { dead++; console.log(`   ${id.padEnd(12)} ${w.key.padEnd(10)} range ${String(w.range ?? '—').padStart(4)} dmg ${String(w.damage).padStart(3)} cd ${w.cooldown}`); }
  }
}
if (!dead) console.log('   none');

// ── the band structure: where does a kit have NOTHING? ──────────────────────
console.log(`\nBAND COVERAGE (distance at which the kit first has any weapon, and its DPS ratio close:far):`);
for (const r of rows) {
  const first = BANDS.find((b, i) => r.cells[i] > 0);
  const closest = r.cells[0], far = r.at140;
  console.log(`   ${r.id.padEnd(12)} usable from ${String(first ?? '—').padStart(4)}wu · melee-band ${closest.toFixed(1)} HP/s · at max reach ${far.toFixed(1)} HP/s · ratio ${far > 0 ? (closest / far).toFixed(2) : '∞'}`);
}
console.log('');
