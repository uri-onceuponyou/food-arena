#!/usr/bin/env node
/**
 * P3 PROBE — what does each candidate repair of `scripted_player.mjs:bestWeapon`
 * actually MEASURE? READ-ONLY: nothing under `src/` or `tools/*.mjs` is edited.
 *
 * `bestWeapon` carries two stale exclusions (`docs/LESSONS.md` §15):
 *   (a) `if (w.type === 'self') return;`  — the scripted player cannot press heal.
 *   (b) it ranks by the authored `damage` field, which is per-PELLET / per-PECK and
 *       literally 0 for a combo weapon (`ai.ts:pressValue` is the sim-validated key,
 *       `sim.test.mjs` §20(b), 183/183 cells exact).
 *
 * ── WHY THIS IS A WRAPPER AND NOT A COPY OF THE DRIVER ──────────────────────
 *
 * `driver_guard.mjs` exists to stop a 14th copy of the scripted player being born, so
 * this file imports `scripted_player.mjs` and overrides ONLY the two fields
 * `makeDecisionTree` derives from `bestWeapon` — `selectedWeapon` and `attack`. Inside
 * `smart2` the returned index feeds nothing else (`target` comes from ring / hazard /
 * `preferredRange` / line of sight), so a post-hoc override is EXACTLY equivalent to
 * changing `bestWeapon` in place. `attack` is reproduced verbatim:
 *     attack = idx !== null && (los || weapons[idx].type === 'melee')
 * and `lineOfSight` is the driver's own exported function, not a re-derivation.
 *
 * The wrapper draws NO seeded RNG, so every variant stays paired tick-for-tick with the
 * control (`docs/LESSONS.md` §5: a driver that draws differently re-seeds every match
 * and a paired before/after stops being paired).
 *
 * ── VALIDATED AGAINST A KNOWN INPUT BEFORE ANY NUMBER IS BELIEVED ───────────
 *
 * Variant `control` re-implements the SHIPPED `bestWeapon` exactly. It must reproduce
 * `roster_lab.mjs` / `burger_lab.mjs --roster` **110 of 110 cells bit-identical**, and
 * `--verify <roster_lab.json>` exits 1 if it does not. If the harness cannot reproduce
 * the thing it is perturbing, none of the perturbations mean anything.
 *
 *   node tools/tmp/p3_bestweapon.mjs --selftest
 *   node tools/tmp/p3_bestweapon.mjs --variant control --seeds 32 --verify /tmp/rl32.json
 *   node tools/tmp/p3_bestweapon.mjs --variant naive   --seeds 32 --json /tmp/v.json
 *
 * ⚠️ FLOORS. A paired per-matchup delta on identical seeds is EXACT. A role half or an
 * aggregate is not: ~9 pp. They are printed separately and never added.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng, parseDriverFlags } from './scripted_player.mjs';

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
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const AI = await import(`${SIM_DIR}/ai.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, RARITY_ORDER, AI_SELF_HEAL_HP_FRACTION } = RULES;
const { pressValue } = AI;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const A = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
const HALF = Math.hypot(A.width / 2, A.height / 2);
const arena = { ...A, maxSafeRadius: Math.round(HALF / (1 - 6000 / MATCH_DURATION_MS)), build: () => null, update: () => {} };

const DT = 16.667;
const SEEDS = Number(args.seeds ?? 32);
const POLICY = String(args.policy ?? 'smart2');
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...parseDriverFlags(args) });

// ─────────────────────────────────────────────────────────────────────────────
// The variants. Each returns the weapon index `bestWeapon` WOULD return.
// `rankOff` is the offensive key; `allowSelfOff` decides whether a `self` weapon is
// eligible for the offensive ranking at all; `healRule` is a separate, higher-priority
// branch modelled on `ai.ts:rankHeal`'s own three conditions.
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS = {
  /** THE SHIPPED FUNCTION, re-implemented. Must reproduce roster_lab exactly. */
  control:    { rankOff: (w) => w.damage ?? 0, allowSelfOff: false, healRule: false },
  /** The literal "delete one line" repair `docs/STATE.md` describes. */
  naive:      { rankOff: (w) => w.damage ?? 0, allowSelfOff: true,  healRule: false },
  /** Fault (b) alone: the sim-validated ranking key, self still excluded. */
  press:      { rankOff: (w, d) => pressValue(w, d), allowSelfOff: false, healRule: false },
  /** Both faults repaired the naive way. */
  naivepress: { rankOff: (w, d) => pressValue(w, d), allowSelfOff: true, healRule: false },
  /** Fault (a) repaired the way `ai.ts` repaired its own mirror image. */
  healrule:   { rankOff: (w) => w.damage ?? 0, allowSelfOff: false, healRule: true },
  /** The whole repair: sim-validated key + the AI's own heal rule. */
  full:       { rankOff: (w, d) => pressValue(w, d), allowSelfOff: false, healRule: true },
};

function makeChooser(v) {
  return function choose(state, d) {
    const p = state.player;
    const ws = CHARACTERS[p.characterId].weapons;
    if (v.healRule) {
      const slot = ws.findIndex((w) => w.type === 'self');
      if (slot >= 0) {
        const w = ws[slot];
        const heal = w.healAmount ?? 0;
        if (heal > 0
          && state.elapsed - p.lastUsed[slot] >= w.cooldown
          && p.hp <= p.maxHp * AI_SELF_HEAL_HP_FRACTION
          && p.maxHp - p.hp >= heal) return slot;
      }
    }
    let best = null, bestScore = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self' && !v.allowSelfOff) return;
      if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      const s = v.rankOff(w, d);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
  };
}

/** `smart2` with `selectedWeapon` / `attack` re-derived. Nothing else is touched. */
function wrap(base, v) {
  const choose = makeChooser(v);
  return (state) => {
    const inp = base(state);
    const p = state.player, e = state.enemy;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    const idx = choose(state, d);
    const los = driver.lineOfSight(p.x, p.y, e.x, e.y);
    const ws = CHARACTERS[p.characterId].weapons;
    return {
      ...inp,
      selectedWeapon: idx ?? 0,
      attack: idx !== null && (los || ws[idx].type === 'melee'),
    };
  };
}

function runMatch(playerId, enemyId, seed, v) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const state = createMatch(arena, playerId, enemyId);
  const loop = driver.createDecisionLoop({
    decide: wrap(driver.POLICY_FNS[POLICY](rnd), v), reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd,
  });
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let winner = null;
  const presses = {};
  let healed = 0;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const before = state.player.hp;
    const evs = stepMatch(state, DT, loop.next(state, DT));
    let firedSelf = false;
    for (const ev of evs) {
      if (ev.type === 'match-ended') winner = ev.winner;
      else if (ev.type === 'weapon-fired' && ev.fighterRole === 'player') {
        presses[ev.weaponKey ?? '?'] = (presses[ev.weaponKey ?? '?'] ?? 0) + 1;
        const w = CHARACTERS[state.player.characterId].weapons.find((x) => x.key === ev.weaponKey);
        if (w && w.type === 'self') firedSelf = true;
      }
    }
    if (firedSelf) healed += Math.max(0, state.player.hp - before);
  }
  return { winner, presses, healed };
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : the harness must reproduce what it is perturbing, and each variant
//              must be shown to CHANGE the choice it claims to change.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log('\n══ p3_bestweapon SELFTEST ══');

  // A. The control chooser must agree with the DRIVER'S OWN bestWeapon, tick for tick,
  //    on a real match. This is the known-input check: a wrapper that cannot reproduce
  //    the function it replaces cannot measure a change to it.
  {
    const ctl = makeChooser(VARIANTS.control);
    let cmp = 0, diff = 0;
    const rnd = rng(3 * 7919 + 9 * 131 + 5 * 17 + POLICY.length);
    const state = createMatch(arena, 'hamburger', 'donut');
    const loop = driver.createDecisionLoop({ decide: driver.POLICY_FNS[POLICY](rnd), reactBase: 150, reactJit: 60, rnd });
    while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS) {
      if (state.phase === 'playing') {
        const d = Math.hypot(state.player.x - state.enemy.x, state.player.y - state.enemy.y);
        cmp++;
        if (driver.bestWeapon(state, d) !== ctl(state, d)) diff++;
      }
      stepMatch(state, DT, loop.next(state, DT));
    }
    ok('the control chooser equals the driver\'s own bestWeapon on every playing tick',
      cmp > 100 && diff === 0, `${cmp} ticks, ${diff} disagreements`);
  }

  // B. DETECTION — each variant must actually differ from the control somewhere, or the
  //    measurement below is comparing a thing with itself.
  {
    const ctl = makeChooser(VARIANTS.control);
    for (const name of ['naive', 'press', 'naivepress', 'healrule', 'full']) {
      const v = makeChooser(VARIANTS[name]);
      let diff = 0, ticks = 0;
      for (const [pc, ec] of [['hamburger', 'donut'], ['taco', 'donut'], ['burrito', 'donut']]) {
        const rnd = rng(1 * 7919 + pc.length * 131 + ec.length * 17 + POLICY.length);
        const state = createMatch(arena, pc, ec);
        const loop = driver.createDecisionLoop({ decide: driver.POLICY_FNS[POLICY](rnd), reactBase: 150, reactJit: 60, rnd });
        while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS) {
          if (state.phase === 'playing') {
            const d = Math.hypot(state.player.x - state.enemy.x, state.player.y - state.enemy.y);
            ticks++;
            if (ctl(state, d) !== v(state, d)) diff++;
          }
          stepMatch(state, DT, loop.next(state, DT));
        }
      }
      ok(`variant '${name}' really does pick differently from the control`, diff > 0, `${diff}/${ticks} ticks differ`);
    }
  }

  // C. The heal branch must be inert for a character with no `self` weapon.
  {
    const ctl = makeChooser(VARIANTS.control), h = makeChooser(VARIANTS.healrule);
    let diff = 0;
    const rnd = rng(2 * 7919 + 5 * 131 + 5 * 17 + POLICY.length);
    const state = createMatch(arena, 'donut', 'sushi');
    const loop = driver.createDecisionLoop({ decide: driver.POLICY_FNS[POLICY](rnd), reactBase: 150, reactJit: 60, rnd });
    while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS) {
      if (state.phase === 'playing') {
        const d = Math.hypot(state.player.x - state.enemy.x, state.player.y - state.enemy.y);
        if (ctl(state, d) !== h(state, d)) diff++;
      }
      stepMatch(state, DT, loop.next(state, DT));
    }
    ok('the heal branch is inert for a character with no `self` weapon', diff === 0, `${diff} ticks differ`);
  }

  // D. THE PRESS COUNTER ITSELF. It read 0 for every character on its first run — the
  //    event field is `fighterRole`, not `who`, and a silent 0 is indistinguishable from
  //    "the driver never pressed anything" (`docs/LESSONS.md` §13). So the counter is
  //    validated in both directions before any press figure below is quoted.
  {
    const c = runMatch('hamburger', 'donut', 1, VARIANTS.control);
    const h = runMatch('hamburger', 'donut', 1, VARIANTS.healrule);
    ok('the press counter sees the offensive presses at all (non-zero)',
      Object.values(c.presses).reduce((a, b) => a + b, 0) > 0, JSON.stringify(c.presses));
    ok('the control presses Onion Ring ZERO times, and heals 0 HP',
      (c.presses.Onion ?? 0) === 0 && c.healed === 0, `Onion=${c.presses.Onion ?? 0} heal=${c.healed}`);
    ok('the healrule variant DOES press Onion Ring and DOES restore HP',
      (h.presses.Onion ?? 0) > 0 && h.healed > 0, `Onion=${h.presses.Onion ?? 0} heal=${h.healed}`);
  }

  console.log(`\n   ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// roster run
// ─────────────────────────────────────────────────────────────────────────────
const NAME = String(args.variant ?? 'control');
const V = VARIANTS[NAME];
if (!V) { console.error(`unknown variant ${NAME}; have ${Object.keys(VARIANTS).join(', ')}`); process.exit(1); }

const cells = {};
const pressTotals = {};
const healTotals = {};
for (const p of CHARACTER_IDS) {
  for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    let w = 0;
    for (let s = 0; s < SEEDS; s++) {
      const r = runMatch(p, e, s, V);
      if (r.winner === 'player') w++;
      const t = (pressTotals[p] ??= {});
      for (const [k, n] of Object.entries(r.presses)) t[k] = (t[k] ?? 0) + n;
      healTotals[p] = (healTotals[p] ?? 0) + r.healed;
    }
    cells[`${p}>${e}`] = w / SEEDS;
  }
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const perChar = {};
for (const id of CHARACTER_IDS) {
  const asP = CHARACTER_IDS.filter((o) => o !== id).map((o) => cells[`${id}>${o}`]);
  const asA = CHARACTER_IDS.filter((o) => o !== id).map((o) => 1 - cells[`${o}>${id}`]);
  perChar[id] = { asPlayer: mean(asP), asAI: mean(asA), strength: (mean(asP) + mean(asA)) / 2 };
}
const all = Object.values(cells);
const settled = all.filter((r) => r >= 0.95 || r <= 0.05).length;
const aggregate = mean(all);
const byRarity = {};
for (const tier of RARITY_ORDER) {
  const ids = CHARACTER_IDS.filter((id) => CHARACTERS[id].rarity === tier);
  if (ids.length) byRarity[tier] = mean(ids.map((id) => perChar[id].strength));
}
const tv = Object.values(byRarity);
const tierSpread = (Math.max(...tv) - Math.min(...tv)) * 100;

if (args.verify) {
  const ref = JSON.parse(readFileSync(String(args.verify), 'utf8'));
  const refCells = ref.policies?.[POLICY]?.matchupRates ?? ref.cells;
  let bad = 0;
  for (const k of Object.keys(cells)) if (cells[k] !== refCells[k]) bad++;
  console.log(`\n   VERIFY vs reference: ${110 - bad}/110 cells bit-identical${bad ? `  ** ${bad} DIFFER **` : ''}`);
  if (bad) process.exit(1);
}

console.log(`\n══ p3_bestweapon ══ variant ${NAME}  ·  ${SEEDS} seeds x 110 matchups  ·  policy ${POLICY}`);
console.log(`   GUARDS   settled ${settled}/110   ·   rarity tier spread ${tierSpread.toFixed(2)} pp   ·   aggregate ${(aggregate * 100).toFixed(1)}%`);
console.log(`\n   ${'character'.padEnd(13)}${'asPlayer'.padStart(10)}${'asAI'.padStart(9)}${'strength'.padStart(10)}`);
for (const id of [...CHARACTER_IDS].sort((a, b) => perChar[b].strength - perChar[a].strength)) {
  const c = perChar[id];
  console.log(`   ${id.padEnd(13)}${(c.asPlayer * 100).toFixed(1).padStart(9)}%${(c.asAI * 100).toFixed(1).padStart(8)}%${(c.strength * 100).toFixed(1).padStart(9)}%`);
}
console.log(`\n   tiers  ${Object.entries(byRarity).map(([t, v]) => `${t} ${(v * 100).toFixed(1)}%`).join(' · ')}`);
console.log(`\n   player-side presses (totals over the whole run), and self-heal HP:`);
for (const id of CHARACTER_IDS) {
  const t = pressTotals[id] ?? {};
  console.log(`     ${id.padEnd(13)} ${Object.entries(t).map(([k, n]) => `${k}=${n}`).join(' ')}   heal HP ${healTotals[id] ?? 0}`);
}
console.log('');

if (args.json) {
  writeFileSync(String(args.json), JSON.stringify({
    mode: 'roster', variant: NAME, policy: POLICY, seeds: SEEDS, playerHeals: V.healRule || V.allowSelfOff,
    settled, tierSpread, aggregate, perChar, byRarity, cells, pressTotals, healTotals,
  }, null, 1));
  console.log(`   wrote ${args.json}\n`);
}
