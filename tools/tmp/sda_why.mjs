#!/usr/bin/env node
/**
 * SDA_WHY — locate and NAME the first non-proportional quantity in a rescale.
 *
 * `sda_bitid` says WHERE the arms part. This says WHAT. It walks one matchup in
 * lockstep and, on the first tick where the quotient comparison fails, prints the
 * offending field, both raw values, the quotient and the residual — because "diverged
 * at tick 985" is a symptom and a rounding site is a cause.
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createScriptedPlayer, rng } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => { const o = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; } } return o; })();

const SIM_DIR = String(args.sim); const REF_DIR = String(args.ref); const K = Number(args.k ?? 16);
const A = { ...(await import(`${REF_DIR}/sim.ts`)), RULES: await import(`${REF_DIR}/rules.ts`), AI: await import(`${REF_DIR}/ai.ts`) };
const B = { ...(await import(`${SIM_DIR}/sim.ts`)), RULES: await import(`${SIM_DIR}/rules.ts`), AI: await import(`${SIM_DIR}/ai.ts`) };
const { CHARACTER_IDS, MATCH_DURATION_MS, PLAYER_MAX_HP, ENEMY_MAX_HP } = A.RULES;

// ── PART 1. THE STATIC TABLE: is every AUTHORED pool exactly k x? ───────────
// Non-vacuity first: 11 characters x 15 levels x 2 roles = 330 cells, and the count is
// asserted so an empty loop cannot report "all exact".
{
  let cells = 0, bad = [];
  for (const id of CHARACTER_IDS) {
    for (const [role, base] of [['player', PLAYER_MAX_HP], ['enemy', ENEMY_MAX_HP]]) {
      for (let L = 1; L <= A.RULES.LEVEL_MAX; L++) {
        const a = A.RULES.maxHpFor(id, base, L);
        const b = B.RULES.maxHpFor(id, base * K, L);
        cells++;
        if (b !== a * K) bad.push(`${id} ${role} L${L}: base ${a} -> scaled ${b} (k*base would be ${a * K}, residual ${(b / K - a).toFixed(4)} old HP)`);
      }
    }
  }
  console.log(`\n── maxHpFor: ${cells} cells (11 chars x 15 levels x 2 roles) ──`);
  if (cells !== CHARACTER_IDS.length * 2 * A.RULES.LEVEL_MAX) { console.log(`   FAIL vacuity: expected ${CHARACTER_IDS.length * 2 * A.RULES.LEVEL_MAX} cells`); process.exit(1); }
  console.log(`   exactly k x : ${cells - bad.length}/${cells}`);
  for (const b of bad.slice(0, 20)) console.log(`   OFF  ${b}`);
  if (bad.length > 20) console.log(`   … and ${bad.length - 20} more`);
}

// ── PART 2. THE LEVEL-1 DEFAULT, which is what every balance run uses ──────
{
  const bad = [];
  for (const id of CHARACTER_IDS) for (const base of [PLAYER_MAX_HP, ENEMY_MAX_HP]) {
    const a = A.RULES.maxHpFor(id, base, 1); const b = B.RULES.maxHpFor(id, base * K, 1);
    if (b !== a * K) bad.push(`${id}@${base}: ${a} vs ${b}`);
  }
  console.log(`\n── maxHpFor at LEVEL 1 only: ${bad.length === 0 ? 'ALL EXACT' : bad.join(' · ')} ──`);
}

// ── PART 3. THE LIVE HUNT ──────────────────────────────────────────────────
const ARENA_DATA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const derivedMaxSafe = Math.round(Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) / (1 - 6000 / MATCH_DURATION_MS));
const arena = { ...ARENA_DATA, maxSafeRadius: derivedMaxSafe, build: () => null, update: () => {} };
const mk = (S) => createScriptedPlayer({ CHARACTERS: S.RULES.CHARACTERS, REACH: S.RULES.REACH, arena, pressValue: S.AI.pressValue, selfHealHpFraction: S.RULES.AI_SELF_HEAL_HP_FRACTION });
const dA = mk(A);
const DT = 16.667, POLICY = 'smart2';

const P = String(args.p ?? 'sushi'), E = String(args.e ?? 'donut'), SEED = Number(args.seed ?? 0);
const rnd = rng(SEED * 7919 + P.length * 131 + E.length * 17 + POLICY.length);
const loop = dA.createDecisionLoop({ decide: dA.POLICY_FNS[POLICY](rnd), reactBase: 150, reactJit: SEED === 0 ? 0 : 60, rnd });
const sa = A.createMatch(arena, P, E), sb = B.createMatch(arena, P, E);

const snap = (s) => ({
  hp: s.fighters.map((f) => f.hp), maxHp: s.fighters.map((f) => f.maxHp),
  x: s.fighters.map((f) => f.x), y: s.fighters.map((f) => f.y),
  regen: s.fighters.map((f) => f.regenTimer), fog: s.fighters.map((f) => f.fogTimer),
  proj: s.projectiles.map((p) => `${p.id}:${p.damage}`),
});
let found = false;
for (let t = 0; t < 6000 && sa.phase !== 'ended' && !found; t++) {
  const input = loop.next(sa, DT);
  const ea = A.stepMatch(sa, DT, input); const eb = B.stepMatch(sb, DT, input);
  const a = snap(sa), b = snap(sb);
  const rows = [];
  for (const key of ['hp', 'maxHp', 'proj']) {
    const av = a[key], bv = b[key];
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      if (key === 'proj') { if (String(av[i]) !== String(bv[i]).replace(/:(\d+(?:\.\d+)?)$/, (_m, d) => `:${Number(d) / K}`)) rows.push(`${key}[${i}] base=${av[i]} scaled=${bv[i]}`); continue; }
      if (bv[i] / K !== av[i]) rows.push(`${key}[${i}] base=${av[i]} scaled=${bv[i]} quotient=${bv[i] / K} residual=${(bv[i] / K - av[i]).toPrecision(6)}`);
    }
  }
  for (const key of ['x', 'y', 'regen', 'fog']) for (let i = 0; i < a[key].length; i++) if (a[key][i] !== b[key][i]) rows.push(`NON-HP ${key}[${i}] base=${a[key][i]} scaled=${b[key][i]}`);
  const evA = ea.map((e) => JSON.stringify(e.type === 'hit-landed' || e.type === 'heal' ? { ...e, amount: e.amount } : e));
  const evB = eb.map((e) => JSON.stringify(e.type === 'hit-landed' || e.type === 'heal' ? { ...e, amount: e.amount / K } : e));
  if (evA.join('|') !== evB.join('|')) rows.push(`EVENTS  base=${evA.join(' ')}\n           scaled/k=${evB.join(' ')}`);
  if (rows.length) {
    console.log(`\n── FIRST DIVERGENCE  ${P} vs ${E} seed ${SEED}  tick ${t}  elapsed ${sa.elapsed.toFixed(0)}ms  phase ${sa.phase} ──`);
    for (const r of rows) console.log(`   ${r}`);
    found = true;
  }
}
if (!found) console.log(`\n── ${P} vs ${E} seed ${SEED}: NO divergence in ${sa.elapsed.toFixed(0)}ms ──`);
console.log();
