#!/usr/bin/env node
/**
 * ssj_plant — plants a k-rescale into a worktree's `rules.ts` so the REAL gate battery
 * can be run against it. This is the known-bad generator; it is not the migration.
 *
 * Two arms, and the difference between them is the whole design question:
 *   --policy old   maxHpFor = k * Math.round(base * h * l)   pools EXACTLY k x today's
 *   --policy new   maxHpFor = Math.round(base * k * h * l)   pools on the exact lattice
 *
 * ⚠️ IT MUST NOT SCALE: `stats: { damage, health, speed }` (the 0-10 card bars),
 * `range`, `cone`, `speed`, `spreadDeg`, `pellets`, `peckHits`, any cooldown, any
 * `*_MS`, or the `damage: number;` type declarations. Every one of those is asserted
 * unchanged below and the tool REFUSES to write if any moved.
 *
 *   node tools/tmp/ssj_plant.mjs --root /tmp/fa-k20 --k 20 --policy old
 *   node tools/tmp/ssj_plant.mjs --selftest
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();

const SCALAR_CONSTS = ['PLAYER_MAX_HP', 'ENEMY_MAX_HP', 'FOG_DAMAGE', 'REGEN_AMOUNT', 'DPS_PER_DAMAGE_POINT'];

export function transform(src, k, policy) {
  const lines = src.split('\n');
  const out = [];
  const touched = { consts: 0, weaponDamage: 0, comboDamage: 0, heal: 0, pot: 0, trail: 0, maxHpFor: 0 };
  const refused = [];

  for (let i = 0; i < lines.length; i++) {
    let L = lines[i];

    // ── named scalar constants ─────────────────────────────────────────────
    let didConst = false;
    for (const name of SCALAR_CONSTS) {
      const re = new RegExp(`^(export const ${name}(?::\\s*number)? = )([0-9.]+)(;.*)$`);
      const m = L.match(re);
      if (m) { L = `${m[1]}${Number(m[2]) * k}${m[3]}`; touched.consts++; didConst = true; }
    }
    if (didConst) { out.push(L); continue; }

    // ── the card bars must NEVER move ──────────────────────────────────────
    if (/stats:\s*\{\s*damage:/.test(L)) { out.push(L); continue; }
    // ── type declarations must NEVER move ──────────────────────────────────
    if (/damage:\s*number\s*;/.test(L)) { out.push(L); continue; }

    // ── POT.damage / TRAIL.damage: a bare `damage: N,` on its own line ─────
    const bare = L.match(/^(\s*damage: )([0-9]+)(,\s*)$/);
    if (bare) {
      L = `${bare[1]}${Number(bare[2]) * k}${bare[3]}`;
      if (i < 500) touched.pot++; else touched.trail++;
      out.push(L); continue;
    }

    // ── weapon rows and comboParts: inline `damage: N,` ────────────────────
    const before = L;
    L = L.replace(/(\bdamage: )([0-9]+)(,)/g, (_, a, n, c) => `${a}${Number(n) * k}${c}`);
    if (L !== before) {
      const n = (before.match(/\bdamage: [0-9]+,/g) || []).length;
      if (/comboParts|angle:/.test(before)) touched.comboDamage += n; else touched.weaponDamage += n;
    }
    const beforeHeal = L;
    L = L.replace(/(\bhealAmount: )([0-9]+)/g, (_, a, n) => `${a}${Number(n) * k}`);
    if (L !== beforeHeal) touched.heal++;

    // ── maxHpFor's rounding policy ─────────────────────────────────────────
    if (L.includes('return Math.round(roleBaseHp * healthMultiplier(id) * levelHealthMultiplier(level));')) {
      if (policy === 'old') {
        L = L.replace(
          'return Math.round(roleBaseHp * healthMultiplier(id) * levelHealthMultiplier(level));',
          `return ${k} * Math.round((roleBaseHp / ${k}) * healthMultiplier(id) * levelHealthMultiplier(level));`);
      }
      touched.maxHpFor++;
    }
    out.push(L);
  }

  // ── REFUSALS: assert the things that must not have moved ────────────────
  const res = out.join('\n');
  const countOf = (s, re) => (s.match(re) || []).length;
  for (const [label, re] of [
    ['cooldown', /cooldown: [0-9]+/g], ['cone', /cone: [0-9]+/g], ['pellets', /pellets: [0-9]+/g],
    ['spreadDeg', /spreadDeg: [0-9]+/g], ['peckHits', /peckHits: [0-9]+/g], ['stats bars', /stats: \{ damage: [0-9]+, health: [0-9]+, speed: [0-9]+ \}/g],
  ]) {
    const a = countOf(src, re), b = countOf(res, re);
    if (a !== b) refused.push(`${label}: ${a} -> ${b}`);
    // and the actual text of every stats: block must be byte-identical
  }
  const statsA = (src.match(/stats: \{ damage: [0-9]+, health: [0-9]+, speed: [0-9]+ \}/g) || []).join('|');
  const statsB = (res.match(/stats: \{ damage: [0-9]+, health: [0-9]+, speed: [0-9]+ \}/g) || []).join('|');
  if (statsA !== statsB) refused.push('CARD BARS MOVED');
  if (statsA.length === 0) refused.push('VACUOUS: no stats blocks found to compare');

  return { text: res, touched, refused };
}

function selftest() {
  const T = []; const ok = (n, c, note = '') => T.push({ n, c, note });
  const FIX = [
    'export const PLAYER_MAX_HP = 100;',
    'export const ENEMY_MAX_HP = 90;',
    'export const FOG_DAMAGE = 15;',
    'export const DPS_PER_DAMAGE_POINT = 3.5;',
    '  damage: 8,',
    '    stats: { damage: 10, health: 3, speed: 5 }, hasTrail: false,',
    "      { key: 'Smash', type: 'melee', range: REACH.meleeStrong, damage: 12, cooldown: 650, cone: 80 },",
    "      { key: 'Onion', type: 'self', damage: 0, cooldown: 6000, healAmount: 18 },",
    "      { key: 'Rice', type: 'ranged', damage: 2, cooldown: 700, pellets: 5, spreadDeg: 35 },",
    '          { color: \'#6B3E26\', damage: 14, angle: -10 },',
    '  damage: number;',
    '  return Math.round(roleBaseHp * healthMultiplier(id) * levelHealthMultiplier(level));',
  ].join('\n');

  const r = transform(FIX, 20, 'old');
  ok('no refusals on a clean transform', r.refused.length === 0, r.refused.join('; '));
  ok('PLAYER_MAX_HP scaled', r.text.includes('PLAYER_MAX_HP = 2000;'));
  ok('DPS_PER_DAMAGE_POINT scaled', r.text.includes('DPS_PER_DAMAGE_POINT = 70;'));
  ok('weapon damage scaled', r.text.includes('damage: 240, cooldown: 650'));
  ok('combo part scaled', r.text.includes('damage: 280, angle: -10'));
  ok('healAmount scaled', r.text.includes('healAmount: 360'));
  ok('POT bare damage scaled', r.text.includes('  damage: 160,'));
  // 🚨 THE FOUR THAT MUST NOT MOVE — each is a real bug this tool could ship.
  ok('CARD BAR damage:10 UNTOUCHED', r.text.includes('stats: { damage: 10, health: 3, speed: 5 }'));
  ok('type decl `damage: number;` UNTOUCHED', r.text.includes('  damage: number;'));
  ok('cooldown UNTOUCHED', r.text.includes('cooldown: 650') && r.text.includes('cooldown: 6000'));
  ok('pellets/spreadDeg UNTOUCHED', r.text.includes('pellets: 5, spreadDeg: 35'));
  ok('maxHpFor rewritten under policy=old', r.text.includes('20 * Math.round((roleBaseHp / 20)'));
  const rn = transform(FIX, 20, 'new');
  ok('maxHpFor UNCHANGED under policy=new', rn.text.includes('return Math.round(roleBaseHp * healthMultiplier'));

  // KNOWN-BAD: a transform that scales the card bar must be REFUSED. Prove the guard
  // fails rather than assuming it. (Without this the refusal check is a comment.)
  const sabotage = transform(FIX.replace('stats: { damage: 10', 'stats: { xdamage: 10'), 20, 'old');
  ok('KNOWN-BAD missing stats block -> VACUOUS refusal', sabotage.refused.some((s) => s.startsWith('VACUOUS')), sabotage.refused.join(';'));

  let pass = 0;
  for (const t of T) { if (t.c) pass++; console.log(`${t.c ? '  ok  ' : ' FAIL '} ${t.n}${t.note ? '   [' + t.note + ']' : ''}`); }
  console.log(`\n${pass}/${T.length}`);
  return pass === T.length ? 0 : 1;
}

if (IS_MAIN) {
  if (process.argv.includes('--selftest')) process.exit(selftest());
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
  const root = arg('--root'); const k = Number(arg('--k', '20')); const policy = arg('--policy', 'old');
  if (!root) { console.error('need --root'); process.exit(2); }
  const p = path.join(root, 'src/game/rules.ts');
  const r = transform(fs.readFileSync(p, 'utf8'), k, policy);
  if (r.refused.length) { console.error('REFUSED: ' + r.refused.join('; ')); process.exit(1); }
  fs.writeFileSync(p, r.text);
  console.log(`planted k=${k} policy=${policy} into ${p}`);
  console.log(JSON.stringify(r.touched));
}
