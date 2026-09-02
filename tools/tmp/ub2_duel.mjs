#!/usr/bin/env node
/**
 * UB2-DUEL — THE 110-CELL CORPUS, WITH A LOADOUT ON ONE SIDE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. 🚨 THE FINDING THAT DECIDED THIS FILE'S SHAPE, AND IT IS A LIMIT ON THE RIG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every published 1v1 balance number in this repo comes out of a 110-cell matchup grid
 * driven by `tools/tmp/scripted_player.mjs` on the PLAYER seat and `ai.ts:stepAI` on the
 * enemy seat. **That driver cannot press an item and there is no flag that makes it.**
 *
 * `createDecisionLoop`'s input object is, verbatim,
 * `{ move: {x, y}, selectedWeapon: 0, attack: false }` — three fields. `FighterInput.useItem`
 * is not one of them, and `grep -rn useItem tools/` returns nothing. So:
 *
 *   🔴 **THE 110-CELL CORPUS IS STRUCTURALLY BLIND TO A PLAYER-SIDE ITEM.** Not weak on it,
 *      not noisy about it — blind, in the same way it is blind to Disposal at two seats and
 *      was blind to medikits. An arm that equips the PLAYER and reports "0 of 110 moved,
 *      bit-identical" is measuring the driver, not the item.
 *
 * This file therefore does the thing `docs/ITEMS.md` demands instead of assuming: it runs
 * that arm anyway, **counts `item-used` events per seat**, and prints the count. A player
 * arm with a full loadout and ZERO presses is the blindness, demonstrated. The bot arm on
 * the same corpus presses hundreds of times, which is the positive control that stops the
 * zero being read as "the wiring is broken".
 *
 * ⚠️ **AND THAT IS ALSO THE SHIPPED GAME'S SHAPE, INVERTED.** `match.ts:newMatch` gives the
 * loadout to `LOCAL_SLOT` and `undefined` to every other seat, so in play the HUMAN has
 * items and the bots have none. The corpus can measure exactly the arm the product does not
 * ship and cannot measure the arm it does. Both halves are stated on every run.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. THE TWO QUANTITIES, AND THEY ARE NEVER ADDED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   AGGREGATE player win rate over 110 matchups x seeds x policies.
 *     Floor **~9 pp** (`CLAUDE.md` rule 10). Do not act on a smaller move.
 *   PAIRED per-matchup delta on identical seeds. **EXACT** — no floor applies. `roster_lab`'s
 *     aggregate once moved 0.8 pp, inside its floor, while **58 of 110 matchups moved, max
 *     34.4 pp**. Conflating them hides exactly that.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. WHAT IS IMPORTED AND WHAT IS COPIED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The driver is IMPORTED from `scripted_player.mjs` — `driver_guard.mjs` fails if a private
 * copy reappears, and it has caught two `bestWeapon` faults that were exactly that. The seed
 * formula is `pacing_ladder.mjs`'s and `roster_lab.mjs`'s, unchanged, so a row here is the
 * SAME MATCH as a row there for the same `(player, enemy, policy, seed)`. The arena's
 * `maxSafeRadius` is recomputed from `MATCH_DURATION_MS` rather than read from the dump,
 * because it is derived and a cached dump goes stale the moment the clock moves.
 *
 * ⚠️ **`createMatch`'s LIST FORM IS USED ON BOTH ARMS, INCLUDING THE CONTROL.** The 3-argument
 * overload has nowhere to put a per-seat loadout, so the item arm must take the list form —
 * and if the control took the other one, every delta would be confounded with the difference
 * between two overloads. `--selftest` §C asserts the two forms are bit-identical on an empty
 * loadout rather than trusting `match.ts`'s claim that they are.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. WHAT THIS TOOL HAS MEASURED — OBSERVATIONS stamped with a SHA. Re-run, do not re-quote.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `a0d9ed1`, 2026-09-02, `--seeds 4`, 880 matches per arm. Control 51.4% smart2 / 44.5%
 * chase. The loadout is on the BOT seat, which is the only side this rig can drive:
 *
 *     warm_milk 0.0/0.0 (121/220 cells, 1202 presses)   pompa 0.0/0.0 (121/220, 950)
 *     tenderiser 7.3/0.2 (119/220, passive)             shiitake 29.8/27.0 (79/220, 882)
 *     liquorice 46.1/42.5 (78/220, 2019)                springform 52.0/45.9 (50/220, 6156)
 *     squid_ink 51.4/44.5 (0/220, 1044 PRESSES)         blue_cheese 51.4/44.5 (0/220, 0)
 *     disposal 51.4/44.5 (0/220, 0 presses)             leftovers 51.4/44.5 (0/220, 0)
 *
 * 🚨 **THE FOUR ZEROS HAVE FOUR DIFFERENT CAUSES AND THE PRESS COLUMN IS WHAT SEPARATES
 * THEM.** Squid Ink presses 1,044 times and moves nothing — a TRUE zero, because the sim
 * never branches on `blotUntil`. Blue Cheese has no implementation. Disposal and Leftovers
 * never press at all: `minAlive: 3` and "a killer who then dies" are unreachable at two
 * seats, so those two zeros are the RIG. Without the press count all four look identical.
 *
 * ── THE OBVIOUS TUNING FIX, MEASURED AND REFUTED ───────────────────────────
 *
 * Every five-second status has `cooldownMs` EXACTLY EQUAL to its duration, so uptime is 100%
 * by construction. Lengthening it, Warm Milk on the bot seat, through
 * `ub2_patchsim`'s `UB2_CD` dial:
 *
 *     x1  0.0/0.0 (1202 presses)   x2  1.1/2.0 (881)   x3  1.1/2.0 (880)
 *     x4  1.1/2.0 (880)            x6  1.1/2.0 (880)   x10 1.1/2.0 (880)
 *
 * **A TENFOLD COOLDOWN RECOVERS 1-2 POINTS OF A 51-POINT HOLE, AND x2 THROUGH x10 ARE
 * IDENTICAL** — the press count saturates because beyond x2 the bot is limited by
 * OPPORTUNITY (line of sight and range), not by the cooldown. The lever is the EFFECT, not
 * the frequency. Five seconds of total action-lock loses a duel outright however rarely it
 * comes. Reported to Uri with the number; `DECISIONS §77` withholds permission to re-tune.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   node tools/tmp/ub2_duel.mjs --selftest
 *   node tools/tmp/ub2_duel.mjs --arm none   --seeds 4 --json /tmp/d_none.json
 *   node tools/tmp/ub2_duel.mjs --arm enemy  --seeds 4 --items warm_milk,pompa \
 *        --baseline /tmp/d_none.json
 *   node tools/tmp/ub2_duel.mjs --arm player --seeds 4 --items warm_milk,pompa \
 *        --baseline /tmp/d_none.json      # the BLIND arm — see §1
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

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
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, ITEMS, ITEM_SLOTS } = RULES;
const { createScriptedPlayer, parseDriverFlags, rng } =
  await import(`${ROOT}/tools/tmp/scripted_player.mjs`);

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 4);
const POLICIES = String(args.policies ?? 'smart2,chase').split(',');
const ARM = String(args.arm ?? 'none');
const LOADOUT = args.items ? String(args.items).split(',').filter(Boolean) : [];

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const FOG_FIRST_CONTACT_MS = 6000;
function loadArena() {
  if (!existsSync(ARENA_PATH)) return null;
  const d = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
  return {
    ...d,
    maxSafeRadius: Math.round(Math.hypot(d.width / 2, d.height / 2)
      / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
    build: () => null, update: () => {},
  };
}
const ARENA = loadArena();
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...parseDriverFlags(args) });

const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

/**
 * ONE MATCH. Seed formula unchanged from `roster_lab`/`pacing_ladder`, so a row here is the
 * same match as a row there. `loadout` is `{ player: [...], enemy: [...] }`.
 */
function runMatch(arena, driver, playerId, enemyId, policy, seed, loadout) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  // ⚠️ THE LIST FORM ON BOTH ARMS — see the header. A control on the 3-argument overload
  // would confound every delta with the difference between two overloads.
  const state = createMatch(arena, [
    { characterId: playerId, ...(loadout.player.length ? { items: loadout.player } : {}) },
    { characterId: enemyId, ...(loadout.enemy.length ? { items: loadout.enemy } : {}) },
  ]);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  let winner = null, ending = null;
  const presses = [0, 0];
  const itemHits = [0, 0];
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    for (const ev of stepMatch(state, DT, loop.next(state, DT))) {
      if (ev.type === 'match-ended') winner = ev.winner;
      else if (ev.type === 'death') ending = 'knockout';
      else if (ev.type === 'item-used') presses[ev.fighterId]++;
      // 🚨 `ownerId`, NOT `fighterId`. `item-used` carries `fighterId`; `item-hit` carries
      // `ownerId`/`targetId` because it names TWO fighters. The first cut of this line read
      // `ev.fighterId` — `undefined` — so every hit landed in `itemHits[undefined]`, which
      // JavaScript creates without complaint and no array index ever reads. The counter
      // reported 0 hits against 266 presses and the row above still went green, because it
      // only asserted presses. §B now asserts BOTH, which is what would have caught it.
      else if (ev.type === 'item-hit') itemHits[ev.ownerId]++;
    }
  }
  if (ending === null) ending = winner ? 'timeout' : 'UNRESOLVED';
  return { winner, ending, presses, itemHits, equipped: state.fighters.map((f) => f.item.equipped.length) };
}

function loadoutFor(armName) {
  if (armName === 'none') return { player: [], enemy: [] };
  if (armName === 'player') return { player: LOADOUT, enemy: [] };
  if (armName === 'enemy') return { player: [], enemy: LOADOUT };
  if (armName === 'both') return { player: LOADOUT, enemy: LOADOUT };
  throw new Error(`ub2_duel: unknown --arm "${armName}" (none|player|enemy|both)`);
}

export function runCorpus({ arena = ARENA, armName = ARM, loadout = null, seeds = SEEDS, policies = POLICIES } = {}) {
  const driver = driverFor(arena);
  const lo = loadout ?? loadoutFor(armName);
  const rows = [];
  const tally = { presses: [0, 0], itemHits: [0, 0], equippedSeats: [0, 0], matches: 0 };
  for (const policy of policies) {
    for (const p of CHARACTER_IDS) {
      for (const e of CHARACTER_IDS) {
        if (p === e) continue;
        for (let s = 0; s < seeds; s++) {
          const r = runMatch(arena, driver, p, e, policy, s, lo);
          rows.push({ key: `${policy}|${p}|${e}|${s}`, p, e, policy, seed: s, winner: r.winner, ending: r.ending });
          tally.matches++;
          for (const i of [0, 1]) {
            tally.presses[i] += r.presses[i];
            tally.itemHits[i] += r.itemHits[i];
            tally.equippedSeats[i] += r.equipped[i] > 0 ? 1 : 0;
          }
        }
      }
    }
  }
  return { armName, loadout: lo, seeds, policies, rows, tally };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

function summarise(res) {
  const byPolicy = new Map();
  for (const r of res.rows) {
    const a = byPolicy.get(r.policy) ?? { n: 0, w: 0 };
    a.n++; if (r.winner === 'player') a.w++;
    byPolicy.set(r.policy, a);
  }
  return byPolicy;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELFTEST
   ═══════════════════════════════════════════════════════════════════════════ */

async function selftest() {
  let pass = 0, fail = 0; const bad = [];
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   - ${n}${d ? `  (${d})` : ''}`); } else { fail++; bad.push(n); console.log(`  FAIL - ${n}${d ? `  (${d})` : ''}`); } };
  console.log('\nUB2-DUEL --selftest');
  const driver = driverFor(ARENA);

  // §A the driver has no item field at all. This is the whole §1 claim, machine-checked
  // rather than asserted in prose, and it goes red the day somebody teaches it one — which
  // is exactly when this file's blindness caveat must be rewritten.
  {
    const loop = driver.createDecisionLoop({ decide: () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }) });
    const st = createMatch(ARENA, [{ characterId: 'hamburger' }, { characterId: 'donut' }]);
    st.phase = 'playing';
    const input = loop.next(st, 1000);
    ok('§A NON-VACUITY: the driver returned an input object at all',
      input !== null && typeof input === 'object', JSON.stringify(input));
    ok('§A 🔴 THE SHARED DRIVER HAS NO `useItem` FIELD — the 110-cell corpus is blind to a PLAYER-side item',
      !('useItem' in input), `fields: ${Object.keys(input).join(', ')}`);
    const drvSrc = readFileSync(`${ROOT}/tools/tmp/scripted_player.mjs`, 'utf8');
    ok('§A …and the string does not appear anywhere in `scripted_player.mjs` either',
      !drvSrc.includes('useItem'));
  }

  // §B POINTING — the corpus arms differ where they should and not where they should not.
  {
    const tiny = { seeds: 1, policies: ['smart2'] };
    const none = runCorpus({ armName: 'none', ...tiny });
    ok('§B NON-VACUITY: the control ran a full 110-cell corpus',
      none.rows.length === 110, `${none.rows.length} rows`);
    ok('§B the control equips NOTHING on either seat',
      none.tally.equippedSeats[0] === 0 && none.tally.equippedSeats[1] === 0,
      `${none.tally.equippedSeats.join('/')}`);
    ok('§B …and therefore presses nothing',
      none.tally.presses[0] === 0 && none.tally.presses[1] === 0);

    const enemy = runCorpus({ armName: 'enemy', loadout: { player: [], enemy: ['liquorice'] }, ...tiny });
    ok('§B NON-VACUITY: the enemy arm equipped seat 1 in every match',
      enemy.tally.equippedSeats[1] === 110 && enemy.tally.equippedSeats[0] === 0,
      `${enemy.tally.equippedSeats.join('/')}`);
    ok('§B 🔴 POSITIVE CONTROL: the BOT seat presses. The rig can see an item at two seats',
      enemy.tally.presses[1] > 0, `${enemy.tally.presses[1]} presses, ${enemy.tally.itemHits[1]} hits`);
    // 🔴 THIS ROW EXISTS BECAUSE IT CAUGHT A REAL FAULT IN THIS FILE. The hit counter read
    // `ev.fighterId` on an event that carries `ownerId`, so every hit went to
    // `itemHits[undefined]` and the arm reported 266 presses and 0 hits — green, because the
    // row above asserts presses alone. A press that lands must be COUNTED as landing.
    ok('§B 🔴 …and its presses LAND. A press counter that is green beside a dead hit counter is half an instrument',
      enemy.tally.itemHits[1] > 0, `${enemy.tally.itemHits[1]} hits from ${enemy.tally.presses[1]} presses`);

    const player = runCorpus({ armName: 'player', loadout: { player: ['liquorice'], enemy: [] }, ...tiny });
    ok('§B NON-VACUITY: the player arm really equipped seat 0 in every match — the loadout ARRIVED',
      player.tally.equippedSeats[0] === 110, `${player.tally.equippedSeats.join('/')}`);
    ok('§B 🔴 THE BLINDNESS, DEMONSTRATED: seat 0 carries a full loadout and presses ZERO times',
      player.tally.presses[0] === 0,
      `equipped in ${player.tally.equippedSeats[0]}/110 matches, ${player.tally.presses[0]} presses`);
    ok('§B …so a null from the PLAYER arm is the DRIVER, and a null from the ENEMY arm is the ITEM. Different claims',
      player.tally.presses[0] === 0 && enemy.tally.presses[1] > 0);
  }

  // §C the two `createMatch` overloads are bit-identical on an empty loadout. `match.ts`
  // claims this ("byte for byte the call this file has always made"); it is measured here
  // because the control arm's validity depends on it.
  {
    const a = createMatch(ARENA, 'hamburger', 'donut');
    const b = createMatch(ARENA, [{ characterId: 'hamburger' }, { characterId: 'donut' }]);
    const strip = (s) => JSON.stringify(s.fighters.map((f) => ({
      id: f.id, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, size: f.size,
      hitRadius: f.hitRadius, level: f.level, controller: f.controller,
      facing: f.facing, equipped: f.item.equipped,
    })));
    ok('§C 🔴 the 3-argument overload and the LIST form seat identical fighters — the control arm is not confounded by its own call shape',
      strip(a) === strip(b), strip(a) === strip(b) ? 'identical' : `${strip(a)}\n     vs ${strip(b)}`);
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail) for (const f of bad) console.log(`    - ${f}`);
  return fail;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════════ */

if (IS_MAIN && args.selftest) {
  process.exit((await selftest()) > 0 ? 1 : 0);
} else if (IS_MAIN) {
  if (!ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  if (LOADOUT.length > ITEM_SLOTS) {
    console.error(`ub2_duel: ${LOADOUT.length} items but the game has ${ITEM_SLOTS} slots`); process.exit(1);
  }
  for (const id of LOADOUT) if (!(id in ITEMS)) { console.error(`ub2_duel: unknown item "${id}"`); process.exit(1); }

  const t0 = Date.now();
  const res = runCorpus({});
  const s = summarise(res);

  console.log(`\n══ UB2-DUEL ══  arm ${ARM}  loadout [${LOADOUT.join(', ') || 'none'}]`);
  console.log(`   ${res.rows.length} matches · 110 matchups x ${SEEDS} seeds x ${POLICIES.length} policies · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   scripted player (${POLICIES.join('/')}) vs ai.ts:stepAI. NOT comparable to an nf_ffa figure.`);

  // 🚨 NON-VACUITY AND POINTING, BEFORE ANY NUMBER.
  const perMatch = res.rows.length;
  console.log(`\n   seats carrying a loadout   player ${res.tally.equippedSeats[0]}/${perMatch}   enemy ${res.tally.equippedSeats[1]}/${perMatch}`);
  console.log(`   item presses               player ${res.tally.presses[0]}          enemy ${res.tally.presses[1]}`);
  if (res.tally.equippedSeats[0] > 0 && res.tally.presses[0] === 0) {
    console.log('   🔴 THE PLAYER SEAT CARRIES A LOADOUT AND PRESSED NOTHING. `scripted_player.mjs` has no');
    console.log('      `useItem` field, so this arm measures the DRIVER and not the item. Any delta below');
    console.log('      is whatever a passive does, and any NULL below is the rig. See the header, §1.');
  }
  if (LOADOUT.length && res.tally.equippedSeats[0] === 0 && res.tally.equippedSeats[1] === 0) {
    console.error('ub2_duel: a loadout was requested and NO seat carries one — REFUSING to report');
    process.exit(1);
  }

  console.log('\n   ── AGGREGATE player win rate ── floor ~9 pp (CLAUDE.md rule 10) ──');
  for (const [policy, a] of s) console.log(`   ${policy.padEnd(10)} ${pct(a.w / a.n)}  (${a.w}/${a.n})`);

  if (args.baseline) {
    const base = JSON.parse(readFileSync(String(args.baseline), 'utf8'));
    const byKey = new Map(base.rows.map((r) => [r.key, r]));
    const cells = new Map();   // policy|p|e -> {n, dw}
    let paired = 0, flipped = 0;
    for (const r of res.rows) {
      const b = byKey.get(r.key);
      if (!b) continue;
      paired++;
      if (r.winner !== b.winner) flipped++;
      const k = `${r.policy}|${r.p}|${r.e}`;
      const c = cells.get(k) ?? { n: 0, a: 0, b: 0 };
      c.n++; c.a += r.winner === 'player' ? 1 : 0; c.b += b.winner === 'player' ? 1 : 0;
      cells.set(k, c);
    }
    const moved = [...cells.values()].filter((c) => c.a !== c.b);
    const deltas = [...cells.entries()].map(([k, c]) => ({ k, d: (c.a - c.b) / c.n }))
      .sort((x, y) => y.d - x.d);
    console.log('\n   ── PAIRED PER-MATCHUP DELTA (identical seeds) ──');
    console.log('   ⚠️ EXACT. A DIFFERENT QUANTITY from the aggregate above. Never added to it.');
    console.log(`   ${paired} matches paired · ${flipped} individual results flipped`);
    console.log(`   ${moved.length} of ${cells.size} matchup cells moved`);
    if (deltas.length) {
      console.log(`   biggest gain  ${deltas[0].k}  ${(deltas[0].d * 100).toFixed(1)} pp`);
      console.log(`   biggest loss  ${deltas[deltas.length - 1].k}  ${(deltas[deltas.length - 1].d * 100).toFixed(1)} pp`);
      const maxAbs = Math.max(...deltas.map((d) => Math.abs(d.d)));
      console.log(`   max |Δ| in one cell  ${(maxAbs * 100).toFixed(1)} pp`);
    }
  }

  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify({
      tool: 'ub2_duel', arm: ARM, loadout: LOADOUT, seeds: SEEDS, policies: POLICIES,
      tally: res.tally, rows: res.rows,
    }, null, 0));
    console.log(`\n   wrote ${args.json}`);
  }
}
