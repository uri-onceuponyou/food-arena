#!/usr/bin/env node
/**
 * ss_enum — GROUND TRUTH for the HP/damage rescale design pass.
 *
 * Imports `src/game/rules.ts` directly (Node type-stripping, same as `sim.test.mjs`)
 * and prints every authored combat number. NOTHING here is retyped: every cell is read
 * off the imported constant, so this file cannot go stale the way a markdown table can.
 *
 * 🚨 The one thing this tool exists to make impossible to miss:
 *     `Weapon.damage` IS PER-PELLET AND PER-PECK, NOT PER-PRESS.
 * Both AI drivers ranked weapons by the authored field and it was worth 50.6 pp on
 * Hamburger (docs/STATE.md). Every damage column below is labelled with its unit.
 *
 * Read-only. Touches nothing.
 *
 *   node tools/tmp/ss_enum.mjs             # tables
 *   node tools/tmp/ss_enum.mjs --json      # machine-readable
 *   node tools/tmp/ss_enum.mjs --selftest  # known-bad validation of the per-press maths
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as R from '../../src/game/rules.ts';

const argv = process.argv.slice(2);
const WANT_JSON = argv.includes('--json');
const SELFTEST = argv.includes('--selftest');

// ⚠️ NOT `import.meta.url === 'file://' + process.argv[1]`. On macOS `/tmp` is a symlink to
// `/private/tmp`, so running this out of a worktree under /tmp makes `import.meta.url`
// resolve through the symlink while `argv[1]` does not — the guard reads false and the tool
// prints NOTHING while exiting 0. Caught by comparing two runs and getting an empty file.
// `realpathSync` on both sides is the version that survives a symlinked path.
const IS_MAIN = (() => {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch { return false; }
})();

// ── The per-press decomposition, stated once ────────────────────────────────
// This mirrors `rules.ts:kitDps` exactly, but keeps the three factors separate so the
// PER-PELLET vs PER-PRESS distinction is visible rather than collapsed into a product.
export function pressBreakdown(w) {
  const pellets = w.pellets ?? 1;
  const pecks = w.peckHits ?? 1;
  const combo = w.comboParts ? w.comboParts.reduce((s, p) => s + p.damage, 0) : null;
  const perPress = combo !== null ? combo : w.damage * pecks * pellets;
  return {
    authored: w.damage,          // ⚠️ per-PELLET, per-PECK. 0 for a combo weapon.
    pellets, pecks,
    comboSum: combo,
    perPress,                    // what one button press delivers if everything lands
    dps: (perPress / w.cooldown) * 1000,
  };
}

function weaponRows() {
  const rows = [];
  for (const id of R.CHARACTER_IDS) {
    for (const [i, w] of R.CHARACTERS[id].weapons.entries()) {
      const b = pressBreakdown(w);
      rows.push({
        char: id, slot: i, key: w.key, name: w.name, type: w.type,
        authoredDamage: w.damage,
        unit: w.comboParts ? 'combo (authored damage is 0; parts carry it)'
          : (b.pellets > 1 && b.pecks > 1) ? 'PER-PELLET x PER-PECK'
          : b.pellets > 1 ? 'PER-PELLET'
          : b.pecks > 1 ? 'PER-PECK'
          : 'per-press (1 pellet, 1 hit)',
        pellets: b.pellets, peckHits: b.pecks, peckInterval: w.peckInterval ?? null,
        comboParts: w.comboParts ? w.comboParts.map((p) => p.damage) : null,
        perPress: b.perPress,
        cooldownMs: w.cooldown,
        dps: b.dps,
        range: w.range ?? null,
        coneDeg: w.cone ?? null,
        projSpeed: w.speed ?? null,
        spreadDeg: w.spreadDeg ?? null,
        effect: w.effect,
        healAmount: w.healAmount ?? null,
        splatter: !!w.splatter, homing: !!w.homing, trailBoosted: !!w.trailBoosted,
        giantSlam: !!w.giantSlam,
      });
    }
  }
  return rows;
}

function charRows() {
  return R.CHARACTER_IDS.map((id) => {
    const c = R.CHARACTERS[id];
    return {
      id, name: c.name, rarity: c.rarity, hasTrail: c.hasTrail,
      statHealth: c.stats.health, statSpeed: c.stats.speed, statDamageAuthored: c.stats.damage,
      statDamageDerived: R.damageStatFor(id),
      healthMul: R.healthMultiplier(id),
      speedMul: R.speedMultiplier(id),
      hpPlayerL1: R.maxHpFor(id, R.PLAYER_MAX_HP, R.LEVEL_MIN),
      hpPlayerL15: R.maxHpFor(id, R.PLAYER_MAX_HP, R.LEVEL_MAX),
      hpEnemyL1: R.maxHpFor(id, R.ENEMY_MAX_HP, R.LEVEL_MIN),
      hpEnemyL15: R.maxHpFor(id, R.ENEMY_MAX_HP, R.LEVEL_MAX),
      speedPlayer: R.speedFor(id, R.PLAYER_SPEED),
      speedChase: R.speedFor(id, R.AI_CHASE_SPEED),
      speedFlee: R.speedFor(id, R.AI_FLEE_SPEED),
      kitDps: R.kitDps(id),
      powerIndex: R.powerIndex(id),
      weaponCount: c.weapons.length,
    };
  });
}

// ── Level-ladder resolution: how many DISTINCT integers does the pool take? ──
export function levelLadder(id, base, scale = 1) {
  const out = [];
  for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) {
    out.push(Math.round(base * scale * R.healthMultiplier(id) * R.levelHealthMultiplier(L)));
  }
  return out;
}

function fmt(n, d = 2) {
  if (n === null || n === undefined) return '-';
  if (typeof n !== 'number') return String(n);
  return Number.isInteger(n) ? String(n) : n.toFixed(d);
}

function table(rows, cols) {
  const head = cols.map((c) => c.h);
  const body = rows.map((r) => cols.map((c) => (c.f ? c.f(r) : fmt(r[c.k]))));
  const w = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells) => cells.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ');
  return [line(head), w.map((n) => '-'.repeat(n)).join('  '), ...body.map(line)].join('\n');
}

function selftest() {
  let pass = 0, fail = 0;
  const ck = (name, got, want) => {
    const ok = Math.abs(got - want) < 1e-9;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${got} want=${want}`);
    ok ? pass++ : fail++;
  };
  // KNOWN-BAD 1: the exact bug this file exists to prevent. If `perPress` ever collapses
  // to the authored field, a multi-pellet weapon reports its per-pellet number and this
  // assertion must go RED. Pick the shipped roster's widest pellet fan.
  const fans = weaponRows().filter((r) => r.pellets > 1);
  if (fans.length === 0) { console.log('FAIL  no multi-pellet weapon in roster — assertion would be VACUOUS'); fail++; }
  else {
    const f = fans[0];
    ck(`per-press != authored on ${f.char}/${f.key} (pellets=${f.pellets})`,
      f.perPress, f.authoredDamage * f.pellets * f.peckHits);
    const bad = f.authoredDamage; // the wrong answer a naive reader gets
    console.log(`      known-bad control: authored=${bad}, per-press=${f.perPress}, ratio=${(f.perPress / bad).toFixed(2)}x`);
    if (f.perPress === bad) { console.log('FAIL  known-bad and correct answers are EQUAL — control is vacuous'); fail++; }
    else pass++;
  }
  // KNOWN-BAD 2: combo weapons author 0 and must not report 0 per press.
  const combos = weaponRows().filter((r) => r.comboParts);
  if (combos.length === 0) { console.log('FAIL  no combo weapon — combo assertion VACUOUS'); fail++; }
  else for (const c of combos) ck(`combo ${c.char}/${c.key} perPress`, c.perPress, c.comboParts.reduce((a, b) => a + b, 0));
  // KNOWN-BAD 3: kitDps must equal the sum of non-self per-press DPS. If it drifts from
  // rules.ts's own function the table is lying about the card derivation.
  for (const id of R.CHARACTER_IDS) {
    const mine = R.CHARACTERS[id].weapons.filter((w) => w.type !== 'self')
      .reduce((s, w) => s + pressBreakdown(w).dps, 0);
    ck(`kitDps agrees for ${id}`, Math.round(mine * 1e6) / 1e6, Math.round(R.kitDps(id) * 1e6) / 1e6);
  }
  // KNOWN-BAD 4: level 1 must be exactly 1.0 on both ladders (the bit-identity claim).
  ck('levelHealthMultiplier(1)', R.levelHealthMultiplier(R.LEVEL_MIN), 1);
  ck('levelDamageMultiplier(1)', R.levelDamageMultiplier(R.LEVEL_MIN), 1);
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
}

function main() {
  if (SELFTEST) return selftest();
  const chars = charRows();
  const weps = weaponRows();
  if (WANT_JSON) {
    console.log(JSON.stringify({ chars, weapons: weps, constants: {
      PLAYER_MAX_HP: R.PLAYER_MAX_HP, ENEMY_MAX_HP: R.ENEMY_MAX_HP,
      PLAYER_SPEED: R.PLAYER_SPEED, AI_CHASE_SPEED: R.AI_CHASE_SPEED, AI_FLEE_SPEED: R.AI_FLEE_SPEED,
      FOG_DAMAGE: R.FOG_DAMAGE, FOG_TICK_MS: R.FOG_TICK_MS,
      POT: R.POT, TRAIL: R.TRAIL,
      REGEN_DELAY_MS: R.REGEN_DELAY_MS, REGEN_TICK_MS: R.REGEN_TICK_MS, REGEN_AMOUNT: R.REGEN_AMOUNT,
      LEVEL_MIN: R.LEVEL_MIN, LEVEL_MAX: R.LEVEL_MAX,
      LEVEL_HEALTH_PER_LEVEL: R.LEVEL_HEALTH_PER_LEVEL, LEVEL_DAMAGE_PER_LEVEL: R.LEVEL_DAMAGE_PER_LEVEL,
      HEALTH_BASELINE_STAT: R.HEALTH_BASELINE_STAT, HEALTH_PER_STAT: R.HEALTH_PER_STAT,
      SPEED_TOP_STAT: R.SPEED_TOP_STAT, SPEED_PER_STAT: R.SPEED_PER_STAT,
      DPS_PER_DAMAGE_POINT: R.DPS_PER_DAMAGE_POINT, STAT_MAX_DISPLAY: R.STAT_MAX_DISPLAY,
      AI_FLEE_HP_FRACTION: R.AI_FLEE_HP_FRACTION, AI_SELF_HEAL_HP_FRACTION: R.AI_SELF_HEAL_HP_FRACTION,
      MATCH_DURATION_MS: R.MATCH_DURATION_MS, SUDDEN_DEATH_MS: R.SUDDEN_DEATH_MS,
      HIT_RADIUS_VS_PLAYER: R.HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY: R.HIT_RADIUS_VS_ENEMY,
    } }, null, 2));
    return;
  }

  console.log('=== CHARACTERS (11) — HP, speed, card stats ===\n');
  console.log(table(chars, [
    { h: 'id', k: 'id' }, { h: 'rarity', k: 'rarity' },
    { h: 'hStat', k: 'statHealth' }, { h: 'sStat', k: 'statSpeed' },
    { h: 'dStat', f: (r) => `${r.statDamageAuthored}${r.statDamageAuthored === r.statDamageDerived ? '' : `!=${r.statDamageDerived}`}` },
    { h: 'hMul', f: (r) => r.healthMul.toFixed(2) },
    { h: 'HP@P/L1', k: 'hpPlayerL1' }, { h: 'HP@P/L15', k: 'hpPlayerL15' },
    { h: 'HP@E/L1', k: 'hpEnemyL1' }, { h: 'HP@E/L15', k: 'hpEnemyL15' },
    { h: 'sMul', f: (r) => r.speedMul.toFixed(2) },
    { h: 'wu/ms', f: (r) => r.speedPlayer.toFixed(4) },
    { h: 'wu/s', f: (r) => (r.speedPlayer * 1000).toFixed(1) },
    { h: 'kitDps', f: (r) => r.kitDps.toFixed(2) },
    { h: 'nW', k: 'weaponCount' },
  ]));

  console.log('\n\n=== WEAPONS — 🚨 `authored` IS PER-PELLET / PER-PECK, `perPress` IS WHAT A PRESS DEALS ===\n');
  console.log(table(weps, [
    { h: 'char', k: 'char' }, { h: 'key', k: 'key' }, { h: 'name', k: 'name' }, { h: 'type', k: 'type' },
    { h: 'authored', k: 'authoredDamage' },
    { h: 'pel', k: 'pellets' }, { h: 'peck', k: 'peckHits' },
    { h: 'combo', f: (r) => (r.comboParts ? r.comboParts.join('+') : '-') },
    { h: 'perPress', k: 'perPress' },
    { h: 'cd(ms)', k: 'cooldownMs' },
    { h: 'dps', f: (r) => r.dps.toFixed(2) },
    { h: 'range', k: 'range' }, { h: 'cone', k: 'coneDeg' }, { h: 'projSpd', k: 'projSpeed' },
    { h: 'effect', f: (r) => r.effect ?? '-' },
    { h: 'heal', k: 'healAmount' },
    { h: 'UNIT', k: 'unit' },
  ]));

  console.log('\n\n=== PER-PRESS SANITY: how many presses to kill? (level 1, no regen, no heal) ===\n');
  const worst = chars.reduce((a, b) => (a.hpPlayerL1 > b.hpPlayerL1 ? a : b));
  const best = chars.reduce((a, b) => (a.hpPlayerL1 < b.hpPlayerL1 ? a : b));
  console.log(`biggest pool: ${worst.id} ${worst.hpPlayerL1} HP (player role, L1)`);
  console.log(`smallest pool: ${best.id} ${best.hpPlayerL1} HP (player role, L1)`);
  const dmgs = weps.filter((w) => w.type !== 'self').map((w) => w.perPress).sort((a, b) => a - b);
  console.log(`per-press damage range across roster: ${dmgs[0]} .. ${dmgs[dmgs.length - 1]}`);
  console.log(`authored-field range (the WRONG number to rescale blindly): ${
    Math.min(...weps.filter((w) => w.type !== 'self').map((w) => w.authoredDamage))} .. ${
    Math.max(...weps.filter((w) => w.type !== 'self').map((w) => w.authoredDamage))}`);
}

if (IS_MAIN) main();
