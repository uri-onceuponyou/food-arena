#!/usr/bin/env node
/**
 * UB2-ITEMUSE — DO THE BOTS ACTUALLY PRESS URI'S TEN ITEMS, AT SIX SEATS, AND HOW OFTEN?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND WHAT IT REFUSES TO BE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ai.ts`'s LOADOUT ITEMS block opens with a number — **7.2 percentage points**, the price
 * `f1e6c03` measured for one rule that reached the human and not the bot. Ten items is the
 * largest opportunity this codebase has ever had to repeat that at scale. The block was
 * written, and then **nothing ever ran it**: `ai.ts` cites `sim.test.mjs` §43 eight times
 * and §43 DID NOT EXIST (measured 2026-09-02: the file's last section is §41). A code path
 * nobody has counted is not a behaviour.
 *
 * 🚨 **AN ASSERTION THAT A CODE PATH EXISTS IS NOT EVIDENCE THE BOT USES THE ITEM.** This
 * tool counts EVENTS out of the shipped sim's own stream — `item-used`, `item-resolved`,
 * `item-hit`, `item-revived`, and `hit-landed` carrying a `DamageSource.itemId`. Counts are
 * EXACT: there is no RNG in the sim (`grep -rn 'Math.random' src/game/{sim,state,combat,ai,
 * movement}.ts` returns nothing), so a run repeated is a run reproduced and no resolution
 * floor applies to a count. `CLAUDE.md` rule 10's floors govern *aggregates*; this file
 * prints none.
 *
 * ── 🚨 THE ROW THAT MAKES A ZERO MEAN SOMETHING: `usableTicks` ──────────────
 *
 * A zero press count has two completely different causes and reporting them as one number
 * is how "the rig cannot see it" gets published as "the change did nothing" (`docs/ITEMS.md`
 * records the medikit track doing exactly that: *"0 of 110 moved, bit-identical"*, which was
 * really 882 kits dropped and 0 taken):
 *
 *   * **NEVER USABLE** — `combat.ts:itemUsable` refused every tick (phase, `minAlive`, the
 *     fighter asleep, cooldown). Nothing about the AI is implicated.
 *   * **USABLE AND NEVER WORTH IT** — `itemUsable` said yes and `ai.ts:itemWorthIt` said no,
 *     every single time. THAT is an AI finding.
 *
 * So every tick, for every fighter, for every equipped slot, this tool asks the sim's OWN
 * exported `itemUsable` — **the identical function `ai.ts:pickItem` calls**, imported, never
 * re-implemented — and counts the opportunities. `presses / usableTicks` is the bot's
 * acceptance rate and it is the diagnostic the whole file exists to print.
 *
 * ⚠️ **`itemWorthIt` IS DELIBERATELY NOT RE-IMPLEMENTED HERE.** It needs `target`,
 * `separation`, `visible`, `fleeing` and `castBudgetMs` — five quantities `stepAI` derives
 * from its perception model. A copy would test the copy (`sim.test.mjs` says this three
 * times about `pressValue`). The subtraction `usableTicks - presses` bounds the refusals
 * exactly without any of it.
 *
 * ── WHY SIX SEATS, NOT TWO ──────────────────────────────────────────────────
 *
 * `AGENT-BRIEF §4b`: six shipped defects were unreachable below three seats. For items it is
 * worse than a tendency — it is a SPEC. `ITEMS.disposal.minAlive === 3` (Uri: *"If there are
 * only two players left, it's not available"*) and Leftovers needs a killer who then dies
 * while the match continues. **A two-seat corpus is STRUCTURALLY BLIND to two of the ten**,
 * and this tool prints `--n` on every table so no reader can lose that.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DESIGN — enumerative, balanced, no roll
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ROSTERS`: the 11 rotations `[i, i+1 … i+n-1] mod 11` of `CHARACTER_IDS`. Every character
 * appears exactly `n` times and exactly once in every seat, so no character is confounded
 * with a spawn point. Deterministic and stated rather than sampled.
 *
 * Spawns are `nf_ffa`'s RING by default and for its reason: it is `2*pi/n`-symmetric by
 * construction, so it contributes no per-seat advantage. `--spawns arena` uses the shipped
 * six.
 *
 * Each arm equips **one item on every seat**. One item, because two would make every count a
 * joint measurement of a pair, and slot order would decide which of them ever fires
 * (`ai.ts:pickItem` returns the FIRST slot whose question says yes).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * KNOWN-BADS — `--selftest`. A guard not shown to FAIL is not a guard.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Five arms, and the first two are the ones that matter, because `--selftest` validates a
 * tool's LOGIC and never where it is POINTED (`valuescan` read a perfect selftest with 14 of
 * 18 stations in the wrong quadrant):
 *
 *   §A  POINTING — the empty loadout. Equip NOTHING and require every count to be 0 AND the
 *       non-vacuity row to REFUSE. A tool that reports presses with nothing equipped is
 *       counting somebody else's events.
 *   §B  POINTING — the positive control. `warm_milk` on every seat must press. If this reads
 *       0 the tool is aimed at nothing, and every other row in the file is worthless.
 *   §C  `--sabotage press` drops `item-used` from the counter. Every press must go to 0 and
 *       `usableTicks` must NOT — proving the two numbers come from different places and that
 *       the press count is read from the stream rather than inferred.
 *   §D  `--sabotage worth` refuses every AI press at the source (a wrapper that returns
 *       `null` from `pickItem` is not reachable from here, so this drops the presses of
 *       AI-controlled fighters only). Presses -> 0 with `usableTicks` unchanged is the exact
 *       signature of "usable and never worth it", so §D proves the tool can TELL THEM APART.
 *   §E  VACUITY — a filter that selects no fighter must be refused, not quantified over.
 *       `[].every()` is `true` and this repo shipped that three times in one session.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   node tools/tmp/ub2_itemuse.mjs --selftest
 *   node tools/tmp/ub2_itemuse.mjs --n 6                    # all ten items, six seats
 *   node tools/tmp/ub2_itemuse.mjs --n 2                    # the blind corpus, for contrast
 *   node tools/tmp/ub2_itemuse.mjs --n 6 --item warm_milk --verbose
 *   node tools/tmp/ub2_itemuse.mjs --n 6 --json /tmp/x.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/**
 * A tool that exports anything needs an IS_MAIN guard — `AGENT-BRIEF §3` records three here
 * whose CLI path ran on import, one of which would have killed every snapshot server on the
 * box. This file exports `runArm` so `--selftest` and a future pricing pass can share it.
 */
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const nx = process.argv[i + 1];
    if (nx === undefined || nx.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = nx; i++; }
  }
  return o;
})();

const SIM = `${ROOT}/src/game`;
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const { itemUsable } = await import(`${SIM}/combat.ts`);
const { CHARACTER_IDS, ITEMS, ITEM_SLOTS, MATCH_DURATION_MS } = await import(`${SIM}/rules.ts`);
const { MAX_FIGHTERS } = await import(`${SIM}/state.ts`);

const ITEM_IDS = Object.keys(ITEMS);
const DT = Number(args.dt ?? 16.667);

// ─────────────────────────────────────────────────────────────────────────────
// THE ARENA. `maxSafeRadius` is DERIVED from MATCH_DURATION_MS in `arena/shared.ts`, so a
// cached dump goes stale the moment the clock moves — recomputed here exactly as
// `nf_ffa.mjs`, `roster_lab.mjs` and `conceal_lab.mjs` all recompute it.
//
// ⚠️ DECLARED LIMIT, not discovered later: `tools/arena.gameplay.json` hardcodes the central
// hazard's `damage: 8` while the shipped game derives it from `POT.damage` (`kitchen.ts`).
// That is `docs/HANDOVER.md`'s recorded stale-but-legal trap. It affects how hard the pot
// bites; it does not decide whether an item is pressed, and both arms of any A/B run through
// the identical file, so it cancels. Named so nobody rediscovers it as a finding.
// ─────────────────────────────────────────────────────────────────────────────
const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const FOG_FIRST_CONTACT_MS = 6000;
function loadArena() {
  if (!existsSync(ARENA_PATH)) throw new Error(`ub2_itemuse: no arena at ${ARENA_PATH}`);
  const d = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
  const halfDiag = Math.hypot(d.width / 2, d.height / 2);
  return {
    ...d,
    maxSafeRadius: Math.round(halfDiag / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
    build: () => null,
    update: () => {},
  };
}

/** `nf_ffa`'s ring, same construction and for its reason: `2*pi/n`-symmetric by design. */
function spawnRing(arena, n, phase = 0) {
  const cx = arena.center.x, cy = arena.center.y;
  const r = Math.hypot(arena.playerSpawn.x - cx, arena.playerSpawn.y - cy);
  const a0 = Math.atan2(arena.playerSpawn.y - cy, arena.playerSpawn.x - cx);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + phase + (i * 2 * Math.PI) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

function spawnsFor(arena, n, phase) {
  if (String(args.spawns ?? 'ring') !== 'arena') return spawnRing(arena, n, phase);
  if (!Array.isArray(arena.spawns) || arena.spawns.length < n) {
    throw new Error(`ub2_itemuse --spawns arena: arena declares ${arena.spawns?.length ?? 0}, need ${n}`);
  }
  return arena.spawns.slice(0, n).map((s) => ({ x: s.x, y: s.y }));
}

/** The 11 rotations. Every character in every seat exactly once across the set. */
function rosters(n) {
  return CHARACTER_IDS.map((_, i) =>
    Array.from({ length: n }, (_, k) => CHARACTER_IDS[(i + k) % CHARACTER_IDS.length]));
}

const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

/**
 * ONE MATCH, INSTRUMENTED.
 *
 * `sabotage` is the known-bad injector and it is a parameter rather than an edit, so §C and
 * §D run against the SAME code path a real arm runs.
 *
 *   'press' — the `item-used` counter is blinded. Presses must fall to 0, `usableTicks` must
 *             not. Proves the two numbers have different sources.
 *   'worth' — every AI-controlled fighter's press is discarded from the count. Same
 *             signature the real "usable and never worth it" finding has.
 */
function runMatch(arena, configs, { sabotage = null } = {}) {
  const state = createMatch(arena, configs);
  const n = state.fighters.length;
  const inputs = new Array(n).fill(null);

  const c = {
    ticks: 0, playTicks: 0,
    equippedSlots: 0,
    usableTicks: 0,
    presses: 0, resolved: 0, hits: 0, revives: 0, cancelled: 0,
    itemDamage: 0,
    pressers: new Set(),
    perItem: new Map(),
    deaths: 0,
  };
  for (const f of state.fighters) c.equippedSlots += f.item.equipped.length;

  const bump = (id, k, v = 1) => {
    let r = c.perItem.get(id);
    if (r === undefined) {
      r = { usableTicks: 0, presses: 0, resolved: 0, hits: 0, revives: 0, cancelled: 0, itemDamage: 0, pressers: new Set() };
      c.perItem.set(id, r);
    }
    r[k] += v;
    return r;
  };

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    // OPPORTUNITY IS READ BEFORE THE TICK, which is where `ai.ts:pickItem` reads it. Asking
    // after `stepMatch` would count the state the press itself produced.
    if (state.phase === 'playing') {
      for (const f of state.fighters) {
        for (let slot = 0; slot < f.item.equipped.length; slot++) {
          if (itemUsable(state, f, slot)) {
            c.usableTicks++;
            bump(f.item.equipped[slot], 'usableTicks');
          }
        }
      }
    }
    const wasPlaying = state.phase === 'playing';
    const evs = stepMatch(state, DT, inputs);
    c.ticks++;
    if (wasPlaying) c.playTicks++;
    for (const ev of evs) {
      switch (ev.type) {
        case 'item-used': {
          if (sabotage === 'press') break;
          if (sabotage === 'worth' && state.fighters[ev.fighterId]?.controller === 'ai') break;
          c.presses++; c.pressers.add(ev.fighterId);
          const r = bump(ev.itemId, 'presses');
          r.pressers.add(ev.fighterId);
          break;
        }
        case 'item-resolved': c.resolved++; bump(ev.itemId, 'resolved'); break;
        case 'item-hit': c.hits++; bump(ev.itemId, 'hits'); break;
        case 'item-cancelled': c.cancelled++; bump(ev.itemId, 'cancelled'); break;
        case 'item-revived': c.revives++; bump('leftovers', 'revives'); break;
        case 'death': c.deaths++; break;
        case 'hit-landed': {
          const s = ev.source;
          // `combat.ts:itemDamageSource` sets `itemId` on a weapon-kind source for exactly
          // two things: Blue Cheese's cloud and Shiitake's reflection. Read the FIELD, never
          // the key — `state.ts` says the sim reads `itemId` at the three places it matters.
          if (s.kind === 'weapon' && s.itemId !== undefined) {
            c.itemDamage += ev.amount;
            bump(s.itemId, 'itemDamage', ev.amount);
          }
          break;
        }
        default: break;
      }
    }
  }
  return c;
}

/**
 * ONE ARM: an item (or none) equipped on every seat, over every roster.
 * Exported so `--selftest` and any pricing pass drive the identical path a report quotes.
 */
export function runArm({ itemId, n = 6, phases = 1, sabotage = null, spawnsMode = null } = {}) {
  const arena = loadArena();
  const out = {
    itemId, n, matches: 0,
    ticks: 0, playTicks: 0, equippedSlots: 0, seats: 0,
    usableTicks: 0, presses: 0, resolved: 0, hits: 0, revives: 0, cancelled: 0, itemDamage: 0,
    pressers: 0, deaths: 0,
    perItem: new Map(),
  };
  const pressersAll = new Set();
  for (let p = 0; p < phases; p++) {
    const phase = (p * 2 * Math.PI) / (phases * Math.max(1, n));
    const spawns = spawnsMode === 'arena' ? spawnsFor(arena, n, 0) : spawnRing(arena, n, phase);
    for (const roster of rosters(n)) {
      const configs = roster.map((characterId, seat) => ({
        characterId,
        controller: 'ai',
        spawn: spawns[seat],
        ...(itemId === null ? {} : { items: [itemId] }),
      }));
      const c = runMatch(arena, configs, { sabotage });
      out.matches++;
      out.seats += n;
      for (const k of ['ticks', 'playTicks', 'equippedSlots', 'usableTicks', 'presses',
        'resolved', 'hits', 'revives', 'cancelled', 'itemDamage', 'deaths']) out[k] += c[k];
      for (const id of c.pressers) pressersAll.add(`${out.matches}:${id}`);
      for (const [id, r] of c.perItem) {
        let g = out.perItem.get(id);
        if (g === undefined) { g = { usableTicks: 0, presses: 0, resolved: 0, hits: 0, revives: 0, cancelled: 0, itemDamage: 0 }; out.perItem.set(id, g); }
        for (const k of Object.keys(g)) g[k] += r[k];
      }
    }
  }
  out.pressers = pressersAll.size;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPORT
   ═══════════════════════════════════════════════════════════════════════════ */

function fmt(v, w) { return String(v).padStart(w); }

function report(rows, n, phases) {
  console.log(`\nUB2-ITEMUSE — do the bots press them? N=${n} · ${phases} phase(s) · dt ${DT}`);
  console.log(`  every seat controller 'ai' · one item equipped on EVERY seat · counts are EXACT (no RNG in the sim)\n`);
  console.log('  item          kind       equip  usableTk  press  presrs  resolv   hits  revive  itemDmg   accept');
  console.log('  ' + '─'.repeat(101));
  for (const r of rows) {
    const def = ITEMS[r.itemId];
    const acc = r.usableTicks > 0 ? (r.presses / r.usableTicks * 100).toFixed(2) + '%' : (def.kind === 'active' ? 'NEVER-USABLE' : 'n/a');
    console.log(`  ${r.itemId.padEnd(13)}${def.kind.padEnd(11)}${fmt(r.equippedSlots, 5)}${fmt(r.usableTicks, 10)}`
      + `${fmt(r.presses, 7)}${fmt(r.pressers, 8)}${fmt(r.resolved, 8)}${fmt(r.hits, 7)}${fmt(r.revives, 8)}`
      + `${fmt(r.itemDamage, 9)}${acc.padStart(9)}`);
  }
  console.log('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELFTEST
   ═══════════════════════════════════════════════════════════════════════════ */

async function selftest() {
  let pass = 0, fail = 0;
  const bad = [];
  const check = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok   - ${name}${detail ? `  (${detail})` : ''}`); }
    else { fail++; bad.push(name); console.log(`  FAIL - ${name}${detail ? `  (${detail})` : ''}`); }
  };

  console.log('\nUB2-ITEMUSE --selftest');
  console.log('  §A/§B are POINTING arms. `--selftest` validates LOGIC and never where a tool AIMS.\n');

  // ── §A POINTING: the empty loadout. ────────────────────────────────────────
  const empty = runArm({ itemId: null, n: 6 });
  check('§A NON-VACUITY: the empty arm really ran matches and ticks',
    empty.matches === 11 && empty.playTicks > 0, `${empty.matches} matches, ${empty.playTicks} playing ticks`);
  check('§A 🔴 POINTING: with NOTHING equipped there are no equipped slots to quantify over',
    empty.equippedSlots === 0, `${empty.equippedSlots} slots`);
  check('§A 🔴 POINTING: …and therefore ZERO opportunities and ZERO presses. A tool that counts here is aimed at somebody else\'s events',
    empty.usableTicks === 0 && empty.presses === 0 && empty.resolved === 0 && empty.hits === 0,
    `usable ${empty.usableTicks} press ${empty.presses} hits ${empty.hits}`);

  // ── §B POINTING: the positive control. ─────────────────────────────────────
  const milk = runArm({ itemId: 'warm_milk', n: 6 });
  check('§B NON-VACUITY: the positive arm equipped every seat',
    milk.equippedSlots === milk.seats && milk.seats === 66, `${milk.equippedSlots}/${milk.seats}`);
  check('§B 🔴 POSITIVE CONTROL: Warm Milk is USABLE — if this is 0 every row in this file is worthless',
    milk.usableTicks > 0, `${milk.usableTicks} usable fighter-ticks`);
  check('§B 🔴 POSITIVE CONTROL: and the BOTS PRESS IT. A code path is not a behaviour',
    milk.presses > 0 && milk.pressers > 0, `${milk.presses} presses by ${milk.pressers} distinct fighters`);
  check('§B a press that resolves without a wind-up emits no `item-resolved` — nine of ten items, per state.ts',
    milk.resolved === 0, `${milk.resolved} resolves`);

  // ── §C the press counter is READ, not inferred. ────────────────────────────
  const sabP = runArm({ itemId: 'warm_milk', n: 6, sabotage: 'press' });
  check('§C 🔴 KNOWN-BAD `--sabotage press`: blinding the `item-used` stream takes presses to ZERO',
    sabP.presses === 0, `${milk.presses} -> ${sabP.presses}`);
  check('§C 🔴 …and `usableTicks` DOES NOT MOVE — the two numbers have different sources, which is the whole diagnostic',
    sabP.usableTicks === milk.usableTicks, `${milk.usableTicks} vs ${sabP.usableTicks}`);

  // ── §D the tool can tell "never usable" from "never worth it". ─────────────
  const sabW = runArm({ itemId: 'warm_milk', n: 6, sabotage: 'worth' });
  check('§D 🔴 KNOWN-BAD `--sabotage worth`: refusing every AI press reproduces the "usable and never worth it" signature exactly',
    sabW.presses === 0 && sabW.usableTicks > 0,
    `press ${sabW.presses}, usable ${sabW.usableTicks}`);
  check('§D CONTROL: the live arm is DISTINGUISHABLE from that known-bad — it presses on the same opportunities',
    milk.presses > 0 && milk.usableTicks === sabW.usableTicks,
    `live ${milk.presses} presses on ${milk.usableTicks} opportunities`);

  // ── §E vacuity. ────────────────────────────────────────────────────────────
  {
    // `[].every()` is `true`. A filter over an arm that selected no fighter must REFUSE.
    const none = empty.perItem.size;
    check('§E 🔴 VACUITY: the empty arm\'s per-item table is EMPTY, so any `.every()` over it would be vacuously true — asserted, not assumed',
      none === 0, `${none} item rows`);
    check('§E …and the populated arm has exactly one item row to quantify over, so the same `.every()` is meaningful',
      milk.perItem.size === 1 && milk.perItem.has('warm_milk'), `[${[...milk.perItem.keys()].join(',')}]`);
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail) { console.log('  Failed:'); for (const f of bad) console.log(`    - ${f}`); }
  return fail;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════════ */

if (IS_MAIN && args.selftest) {
  process.exit((await selftest()) > 0 ? 1 : 0);
} else if (IS_MAIN) {
  const n = Number(args.n ?? MAX_FIGHTERS);
  const phases = Number(args.phases ?? 1);
  const only = args.item ? String(args.item).split(',') : ITEM_IDS;
  for (const id of only) if (!(id in ITEMS)) throw new Error(`ub2_itemuse: unknown item "${id}"`);
  const spawnsMode = args.spawns ? String(args.spawns) : null;

  const rows = [];
  for (const itemId of only) {
    const t0 = Date.now();
    const r = runArm({ itemId, n, phases, spawnsMode });
    rows.push(r);
    if (args.verbose) console.log(`  ${itemId}: ${r.matches} matches, ${r.playTicks} ticks, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  // 🚨 NON-VACUITY BEFORE ANY QUANTIFIER. Every arm must have equipped every seat, or a
  // "no item ever fired" verdict is a statement about the fixture and not about the AI.
  const expected = rows.length ? rows[0].seats : 0;
  const misseated = rows.filter((r) => r.equippedSlots !== r.seats || r.seats !== expected);
  if (rows.length === 0) { console.error('ub2_itemuse: no arms ran'); process.exit(1); }
  if (misseated.length) {
    console.error(`ub2_itemuse: ${misseated.length} arm(s) did not equip every seat — REFUSING to report`);
    for (const r of misseated) console.error(`  ${r.itemId}: ${r.equippedSlots}/${r.seats}`);
    process.exit(1);
  }

  report(rows, n, phases);

  const actives = rows.filter((r) => ITEMS[r.itemId].kind === 'active');
  const silent = actives.filter((r) => r.presses === 0);
  const blind = actives.filter((r) => r.usableTicks === 0);
  console.log(`  ${actives.length} active items · ${actives.length - silent.length} PRESSED · ${silent.length} silent`
    + `${silent.length ? ` [${silent.map((r) => r.itemId).join(', ')}]` : ''}`);
  if (blind.length) {
    console.log(`  🔴 ${blind.length} NEVER USABLE at N=${n} — a zero here is the RIG, not the AI: `
      + blind.map((r) => `${r.itemId} (minAlive ${ITEMS[r.itemId].minAlive})`).join(', '));
  }
  const refusing = actives.filter((r) => r.usableTicks > 0 && r.presses === 0);
  if (refusing.length) {
    console.log(`  🔴 ${refusing.length} USABLE AND NEVER PRESSED — that is an ai.ts:itemWorthIt finding: `
      + refusing.map((r) => `${r.itemId} (${r.usableTicks} opportunities)`).join(', '));
  }
  const passives = rows.filter((r) => ITEMS[r.itemId].kind !== 'active');
  for (const r of passives) {
    const evidence = r.hits + r.revives + r.itemDamage;
    console.log(`  ${r.itemId} (${ITEMS[r.itemId].kind}): ${evidence === 0 ? '🔴 NO OBSERVABLE EFFECT' : 'effect observed'}`
      + ` — hits ${r.hits}, revives ${r.revives}, damage ${r.itemDamage}`);
  }

  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify({
      n, phases, dt: DT, itemSlots: ITEM_SLOTS,
      rows: rows.map((r) => ({ ...r, perItem: Object.fromEntries(r.perItem) })),
    }, null, 1));
    console.log(`\n  wrote ${args.json}`);
  }
}
