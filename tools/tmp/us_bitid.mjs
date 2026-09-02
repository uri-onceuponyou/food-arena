#!/usr/bin/env node
/**
 * US_BITID — does the loadout wiring move the SHIPPED DEFAULT?
 *
 *   node tools/tmp/us_bitid.mjs --selftest      # the differ's LOGIC, with known-bads
 *   node tools/tmp/us_bitid.mjs --both          # all four arms, one verdict
 *   node tools/tmp/us_bitid.mjs --n 2 --expect same
 *   node tools/tmp/us_bitid.mjs --n 6 --expect diverge
 *   node tools/tmp/us_bitid.mjs --census --n 6  # WHICH of the ten actually move the sim
 *
 * ⚠️ `--item blue_cheese` is a deliberately BAD example and is not written above for a
 * reason: it is equipped, it is a passive, and it does NOTHING. See `ITEM` below.
 *
 * ── 🚨 WHY THIS FILE EXISTS, AND IT IS NOT THE REASON YOU WOULD GUESS ───────
 *
 * Three source files — `sim.ts:FighterConfig.items`, `state.ts:ItemState` and
 * `movement.ts` — cite **`tools/tmp/is_bitid.mjs`**, in the present tense, as the thing
 * that PROVED an empty loadout is bit-identical to the sim before items existed.
 * `state.ts` is the most specific: *"proven by `tools/tmp/is_bitid.mjs` against a detached
 * worktree of the parent commit rather than asserted here."*
 *
 * **`tools/tmp/is_bitid.mjs` has never existed on any branch.** `git log --all --
 * tools/tmp/is_bitid.mjs` is empty, re-derived 2026-09-02. That is the third instance of
 * this exact failure in this feature's files — `lobby.ts` cited `il_seam.mjs`/`il_accept.mjs`
 * six times and `ul_accept.mjs` four more, none of which have ever existed — and it is the
 * failure `CLAUDE.md` opens with: **a claim reads as verified BECAUSE IT CARRIES A
 * CITATION.** This file does not restore that claim (it is about a commit boundary this
 * pass did not create). It measures the one the WIRING pass has to own.
 *
 * ── THE QUESTION ───────────────────────────────────────────────────────────
 *
 * `match.ts:newMatch` grew a branch. With **nothing equipped** it still takes the legacy
 * 4-argument `createMatch(arena, playerId, enemyId, levels)` — the call every one of this
 * repo's ~74 call sites and every two-seat balance number was measured through. With
 * something equipped it takes the fighter-LIST form, because the 4-argument overload has
 * nowhere to put a per-seat field.
 *
 * So there are two claims and they are different:
 *
 *   1. **The branch is inert.** The two construction forms are bit-identical when the
 *      loadout is empty. If that holds, the branch is a belt and not a behaviour change,
 *      and "the shipped default did not move" is true whichever side of it you land on.
 *   2. **The wiring can move the sim at all.** If it cannot, claim 1 is VACUOUS — an
 *      `items` field that never reached a fighter would produce a PERFECT null and read
 *      exactly like success. `AGENT-BRIEF §3` records this as the most dangerous result
 *      available here, because a null is a normal outcome and nobody re-checks it.
 *
 * Neither arm means anything alone, so `--both` runs the pair and prints one verdict.
 *
 * ── 🚨 THE DIFFER HAD TO GROW, AND THE INHERITED ONE WAS BLIND ─────────────
 *
 * `tun_bitid`/`csx_bitid`'s `fighterOf` is validated and is reused here field for field —
 * **except that it does not serialise `Fighter.item` at all.** It predates the item
 * system. Handed to this question unchanged it would have compared two matches that
 * differed in nothing but their loadouts and called them identical, and BOTH arms would
 * have been wrong in the same direction: the null arm would pass for free and the
 * positive arm would report "the wiring is dead". `itemOf` below is the fix, and
 * `--selftest`'s `equipped`-only known-bad is what proves it is not decoration.
 *
 * ⚠️ Fields are listed explicitly rather than `JSON.stringify`d, for `tun_bitid`'s
 * reason: `MatchState` does not survive a JSON round trip — `-Infinity` sentinels
 * flatten to `null`, so an arm that HAS a deadline and one that never set it would
 * compare equal. Every deadline goes through `String()`.
 *
 * ── SIX SEATS ──────────────────────────────────────────────────────────────
 *
 * `--n 6` is not garnish. Two of the ten items cannot express themselves at two seats at
 * all (`docs/ITEMS.md`: Disposal is gated on 3 alive by Uri's own rule; Leftovers needs a
 * killer who then dies mid-match), and the six-seat construction path in `match.ts` is a
 * DIFFERENT branch from the duel — it was the only one an earlier draft of this fix
 * covered. An `--n 2`-only result would describe half the wiring.
 *
 * ⚠️ The positive arm's default item is `blue_cheese` **because it is large and
 * unconditional** — a permanent aura ticking at melee reach, no press, no cooldown, no
 * minimum alive count. `docs/ITEMS.md`'s medikit lesson is the reason: *"before reporting
 * a null, prove the rig can see a change at all by planting one you know is large."* An
 * active item would need `FighterInput.useItem`, which **nothing in `src/` writes** — so a
 * positive arm built on one would be null for a reason that has nothing to do with this
 * wiring.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
const EXPECT = String(args.expect ?? 'same');
const SEEDS = Number(args.seeds ?? 2);
const SEATS = Number(args.n ?? 2);
const DT = Number(args.dt ?? 16.667);
const POLICY = String(args.policy ?? 'smart2');
/**
 * The positive arm's item.
 *
 * ⚠️ **THIS DEFAULTED TO `blue_cheese` AND THAT WAS WRONG, WHICH IS THE MOST USEFUL
 * THING THIS TOOL HAS FOUND.** Blue Cheese is the obvious choice — a permanent aura, no
 * press, no cooldown, `minAlive` 2 — and the positive arm read **NEVER DIVERGED over
 * 1,552 ticks**. It is equipped and it does nothing: `combat.ts`'s switch sends it to
 * *"`sim.ts:applyWorldTick`'s aura block"* and **there is no aura block**. `sim.ts`
 * imports `ITEM_AURA_TICK_MS`, `itemDamageSource` and `hasItem` and calls none of the
 * three; `tsconfig.json` sets `noUnusedLocals: false`, so three dead imports are not even
 * a warning. Reported, not fixed — `sim.ts` is not this pass's file.
 *
 * `tenderiser` is the replacement because it is genuinely wired (`combat.ts:applyDamage`'s
 * streak block) and needs no press. See `--census`, which measures this for all ten
 * instead of asking anyone to remember it.
 */
const ITEM = String(args.item ?? 'tenderiser');
/** Ticks before the positive arm gives up on a matchup. A permanent aura at melee reach
 *  needs the two to actually meet, and a few matchups never close the distance. */
const CAP_TICKS = Number(args.cap ?? 4000);

// ─────────────────────────────────────────────────────────────────────────────
// --both — the four arms, so no single one can be quoted alone
// ─────────────────────────────────────────────────────────────────────────────
if (import.meta.main && args.both) {
  const self = new URL(import.meta.url).pathname;
  const base = ['--seeds', String(SEEDS), '--policy', POLICY, '--item', ITEM];
  const run = (extra) => {
    try {
      execFileSync(process.execPath, [self, ...base, ...extra], { cwd: ROOT, stdio: 'inherit' });
      return true;
    } catch { return false; }
  };
  const arms = [
    ['NULL   n=2', ['--n', '2', '--expect', 'same']],
    ['NULL   n=6', ['--n', '6', '--expect', 'same']],
    [`LIVE   n=2 (${ITEM})`, ['--n', '2', '--expect', 'diverge']],
    [`LIVE   n=6 (${ITEM})`, ['--n', '6', '--expect', 'diverge']],
  ];
  const results = [];
  for (const [label, extra] of arms) {
    console.log(`\n═══ ARM ${results.length + 1}/4 — ${label} ═══`);
    results.push([label, run(extra)]);
  }
  const allOk = results.every(([, ok]) => ok);
  console.log('\n═══ VERDICT ═══');
  for (const [label, ok] of results) console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  console.log(`\n>> ${allOk
    ? 'PASS — an empty loadout is bit-identical on BOTH paths, and an equipped one moves the sim on both. Neither half means anything alone.'
    : 'FAIL — see the arm(s) marked FAIL above.'}\n`);
  process.exit(allOk ? 0 : 1);
}

const SIM = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS, ITEMS, ITEM_SLOTS } = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(2); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
// The opening ring from the SHIPPED derivation, never a copied formula — `tun_bitid`'s
// header records what a copied one cost.
const openingRadius = RULES.fogOpeningRadiusFor(Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2));
const arena = { ...ARENA_DATA, maxSafeRadius: openingRadius, build: () => null, update: () => {} };

const DRIVER_FLAGS = parseDriverFlags(args);
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...DRIVER_FLAGS });

// ─────────────────────────────────────────────────────────────────────────────
// The comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🚨 THE PART `tun_bitid`'s SERIALISER DOES NOT HAVE.
 *
 * Every field of `state.ts:ItemState`, because `createFighter` seeds all of them as real
 * own enumerable properties precisely so a divergence cannot hide in one that "does not
 * exist yet". A differ that skipped any of them would make the null arm cheaper and the
 * positive arm blinder, in the same direction, silently.
 */
const itemOf = (it, blind) => [
  // 🚨 `blind` BLANKS THE TWO FIELDS THAT DIFFER BY CONSTRUCTION, AND IT EXISTS BECAUSE
  // THE FIRST VERSION OF THIS TOOL SHIPPED A VACUOUS CONTROL.
  //
  // The positive arm equips an item, so `equipped` — and `lastUsed`, whose length is
  // derived from it — differ on TICK ONE, before the sim has done anything. The first
  // draft's control row read *"the SAME pair with blue_cheese equipped DIVERGES"* and it
  // passed **at tick 1 with an EMPTY event set**: it was reporting the EXISTENCE of the
  // loadout, not any behaviour of it, which is exactly the failure `csx_bitid`'s header
  // records (720 of 720 "divergences" on tick 1 over a field's existence).
  //
  // So the two directions get two differs, deliberately asymmetric:
  //   · the NULL arm uses the FULL differ — strictest, nothing excused;
  //   · the POSITIVE arm uses this one — a divergence then means the item CHANGED THE
  //     GAME, not that we successfully wrote it down.
  // `--selftest` §B4a/b/c pin both halves: the full differ must catch an `equipped`-only
  // poke, the blind one must NOT, and the blind one must still catch 1 HP.
  blind ? '(equipped:blinded)' : it.equipped.join(','),
  blind ? '(lastUsed:blinded)' : it.lastUsed.map(String).join(','),
  String(it.sleepUntil), String(it.clogUntil), String(it.rootUntil),
  String(it.blotUntil), String(it.shieldUntil),
  it.streakTarget, it.streakCount, String(it.streakAt),
  it.auraTimers.map(String).join(','),
  it.killerId,
  // 🚨 THE THIRD CONSTRUCTION-TIME FIELD, AND IT WAS MISSED ON THE FIRST PASS OF THE
  // BLINDING — the census caught it, which is the only reason it is here.
  //
  // `createFighter` seeds `revivesLeft` to `equipped.includes('leftovers') ? 1 : 0`, so an
  // arm carrying Leftovers differs on TICK ONE and the census duly reported Leftovers as
  // "MOVES @1" **in both columns** — a claim about the seed, not about anyone coming back
  // to life. Same shape as `equipped` and `lastUsed`, one field further in.
  //
  // ⚠️ Blinding it costs NOTHING behavioural, and that is checked rather than assumed: a
  // real revive is three writes in `combat.ts:reviveThoseKilledBy` — `revivesLeft--`,
  // `f.hp = ITEM_TUNING.leftovers.hp`, and an event — and the other two are fully visible
  // to this differ. `--selftest` B4d/B4e pin exactly that.
  blind ? '(revivesLeft:blinded)' : it.revivesLeft,
].join('/');

const fighterOf = (f, blind) => [
  f.id, f.hp, f.maxHp, f.x, f.y, f.facing.x, f.facing.y, f.deaths, f.alive,
  f.trailDropTimer, f.lastDamagedAt, f.regenTimer, f.fogTimer,
  String(f.status.slowedUntil), String(f.status.stunnedUntil),
  f.lastUsed.join(','), f.concealed, f.revealedUntil, f.terrainSlowFactor,
  // eslint-disable-next-line eqeqeq -- `== null` is deliberate: it covers `undefined` too.
  f.cast == null ? 'idle' : `${f.cast.weaponIndex}@${f.cast.startedAt}->${f.cast.resolvesAt}`,
  itemOf(f.item, blind),
  // eslint-disable-next-line eqeqeq
  f.itemCast == null ? 'idle' : `${f.itemCast.slot}@${f.itemCast.startedAt}->${f.itemCast.resolvesAt}`,
].join('|');

const projOf = (p) => [
  p.id, p.ownerId, p.targetId, p.weapon.key, p.x, p.y, p.vx, p.vy, p.traveled, p.damage,
  p.arrived, p.peckTimer, p.hitsSoFar,
].join('|');

const stateOf = (s, blind = false) => [
  s.phase, s.elapsed, s.timeRemaining, s.safeRadius, s.winnerId ?? 'none', s.nextId,
  s.fighters.map((f) => fighterOf(f, blind)).join(';'),
  s.projectiles.map(projOf).join(';'),
  s.trailMarks.map((m) => `${m.id},${m.ownerId},${m.x},${m.y},${m.expiresAt},${m.damagedMask}`).join(';'),
  s.splats.map((sp) => `${sp.id},${sp.x},${sp.y},${sp.expiresAt}`).join(';'),
  (s.medikits ?? []).map((k) => `${k.id},${k.sourceId},${k.x},${k.y},${k.armsAt}`).join(';'),
].join('\n');

const eventsOf = (evs) => evs.map((e) => JSON.stringify(e)).join('\n');

/**
 * The two arms' CONSTRUCTION, which is the whole subject of this tool.
 *
 * `baseline` is byte for byte the call `match.ts:newMatch` makes when nothing is equipped
 * — at two seats the legacy 4-argument overload, at 3..6 the roster list with no `items`
 * key at all. `armed` is the call it makes when something is. At `--expect same` the
 * loadout handed to `armed` is `[]`, which is the branch-is-inert question; at
 * `--expect diverge` it is a real item, which is the can-this-move-the-sim question.
 */
function buildPair(ids, loadout) {
  if (ids.length === 2) {
    const baseline = SIM.createMatch(arena, ids[0], ids[1]);
    const armed = SIM.createMatch(arena, [
      { characterId: ids[0], items: loadout },
      { characterId: ids[1] },
    ]);
    return [baseline, armed];
  }
  const baseline = SIM.createMatch(arena, ids.map((characterId) => ({ characterId })));
  const armed = SIM.createMatch(arena, ids.map((characterId, slot) => (
    slot === 0 ? { characterId, items: loadout } : { characterId }
  )));
  return [baseline, armed];
}

/**
 * One matchup, both arms, in lockstep.
 *
 * ⚠️ ONE input object, built from the BASELINE arm, is fed to both — so the arms cannot
 * diverge through the driver even in principle, and a divergence is always the sim's.
 */
function lockstep(ids, seed, loadout, blind = false) {
  const r = lockstepDual(ids, seed, loadout);
  const tick = blind ? r.expressedTick : r.reachedTick;
  return { diverged: tick !== null, tick, ticks: r.ticks, kinds: blind ? r.expressedKinds : r.reachedKinds };
}

/**
 * ONE PASS, TWO DIFFERS — and the split is what stopped this tool lowering a floor to fit
 * its own result.
 *
 * 🚨 **THE `--n 6 --expect diverge` ARM FAILED A 90% FLOOR AT 3/22, AND THE FLOOR WAS
 * WRONG, NOT THE WIRING.** The non-diverging rows all ended with the match OVER
 * (2,546 · 2,826 · 3,038 ticks against a 12,000 cap), not with the probe giving up:
 * `tenderiser` needs the LOCAL seat to land consecutive hits on one target inside
 * `decayMs`, and across a 2800x2000 arena with six fighters the local seat usually dies or
 * the clock runs out first. Raising the cap from 4,000 to 12,000 moved it 3/22 → 3/22.
 *
 * That is a fact about the ITEM at six seats. It is not evidence about whether the loadout
 * reached the sim, and conflating the two would have meant either a red row nobody could
 * act on or — worse — a floor quietly retuned until the number passed. So the arm reports
 * two quantities with two different floors:
 *
 *   · **REACHED** — the FULL differ. The `equipped` array is on the fighter. **EXACT: this
 *     must be 100%.** If `newMatch` dropped the loadout this is 0 and the arm is red.
 *   · **EXPRESSED** — the BLIND differ. The item changed the GAME. Floor is `> 0`, and the
 *     fraction is REPORTED as a property of item × seat × seat-count. At n=2 it is 100%;
 *     at n=6 it is 3/22 and that is the honest number.
 *
 * Both come out of ONE lockstep so the cost is one pass, and so the two can never be
 * measured on different runs of a driver.
 */
function lockstepDual(ids, seed, loadout) {
  const rnd = rng(seed * 7919 + ids.join('').length * 131 + POLICY.length);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const [sa, sb] = buildPair(ids, loadout);

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  let reachedTick = null; let reachedKinds = '';
  let expressedTick = null; let expressedKinds = '';
  while (sa.phase !== 'ended' && sa.elapsed < HARD_CAP && tick < CAP_TICKS) {
    const input = loop.next(sa, DT);
    const ea = SIM.stepMatch(sa, DT, input);
    const eb = SIM.stepMatch(sb, DT, input);
    tick++;
    const evDiff = eventsOf(ea) !== eventsOf(eb);
    const kinds = () => [...new Set([...ea, ...eb].map((e) => e.type))].join(',');
    const fullDiff = evDiff || stateOf(sa, false) !== stateOf(sb, false);
    // With an EMPTY loadout the blinded fields are equal by construction, so the two
    // differs are the same question and the second serialisation is pure cost.
    const blindDiff = loadout.length > 0
      ? (evDiff || stateOf(sa, true) !== stateOf(sb, true))
      : fullDiff;
    if (reachedTick === null && fullDiff) { reachedTick = tick; reachedKinds = kinds(); }
    if (expressedTick === null && blindDiff) { expressedTick = tick; expressedKinds = kinds(); }
    // The null arm has nothing more to learn once both are still null and the match ends;
    // the positive arm stops early only when BOTH have fired, so a late behavioural
    // divergence is never missed by an early structural one.
    if (reachedTick !== null && expressedTick !== null) break;
  }
  return { reachedTick, reachedKinds, expressedTick, expressedKinds, ticks: tick };
}

/** The matchup corpus. Two seats is every ordered pair; six seats is a rotation of the
 *  roster so every character appears in the local seat and the spawn order is the arena's
 *  own — `sim.ts:defaultSpawn` reads `arena.spawns[i]` and slot order IS placement. */
function corpus() {
  const rows = [];
  if (SEATS === 2) {
    for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) if (p !== e) rows.push([p, e]);
    return rows;
  }
  for (let i = 0; i < CHARACTER_IDS.length; i++) {
    rows.push(Array.from({ length: SEATS }, (_, k) => CHARACTER_IDS[(i + k) % CHARACTER_IDS.length]));
  }
  return rows;
}

// ═════════════════════════════════════════════════════════════════════════════
// --census — WHICH OF THE TEN ACTUALLY MOVE THE SIM, AND FROM WHICH SEAT
// ═════════════════════════════════════════════════════════════════════════════
//
// 🚨 THIS IS THE ARM THAT ANSWERS URI'S QUESTION, and it exists because the tool's own
// default was wrong. "Ten items are fully implemented in the sim" is in every brief; it is
// TRUE of the registry and of `combat.ts`'s switch, and it is not a statement about
// whether anything reaches a fighter. So this stops asking and measures:
//
//   · equip on SLOT 0 — the local human seat. Nothing in `src/` writes
//     `FighterInput.useItem`, so only the press-free items can fire here. This column is
//     "what does the loadout buy the player TODAY".
//   · equip on SLOT 1 — a bot seat. `ai.ts:stepAI` calls `combat.ts:attemptItem` directly,
//     so the seven actives are reachable. This column is "what does the sim implement".
//
// A row that is dead in BOTH columns is not a missing button; it is a missing effect.
// The differ is the BLIND one — an item that is merely written into `equipped` is not
// counted as moving anything.
if (import.meta.main && args.census) {
  const ids = Object.keys(ITEMS);
  if (ids.length === 0) { console.error('us_bitid --census: EMPTY registry'); process.exit(2); }
  const MATCHUPS = SEATS === 2
    ? corpus().slice(0, Number(args.matchups ?? 12))
    : corpus().slice(0, Number(args.matchups ?? 6));

  /** Equip `id` on `slot` and report the first matchup/seed whose sim MOVED. */
  const probe = (id, slot) => {
    for (const cs of MATCHUPS) {
      for (let s = 0; s < SEEDS; s++) {
        const rnd = rng(s * 7919 + cs.join('').length * 131 + POLICY.length);
        const decide = driver.POLICY_FNS[POLICY](rnd);
        const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: s === 0 ? 0 : 60, rnd });
        const base = cs.map((characterId) => ({ characterId }));
        const armed = cs.map((characterId, k) => (k === slot ? { characterId, items: [id] } : { characterId }));
        const sa = SIM.createMatch(arena, base);
        const sb = SIM.createMatch(arena, armed);
        const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
        let tick = 0;
        while (sa.phase !== 'ended' && sa.elapsed < HARD_CAP && tick < CAP_TICKS) {
          const input = loop.next(sa, DT);
          const ea = SIM.stepMatch(sa, DT, input);
          const eb = SIM.stepMatch(sb, DT, input);
          tick++;
          if (eventsOf(ea) !== eventsOf(eb) || stateOf(sa, true) !== stateOf(sb, true)) {
            return { moved: true, where: `${cs.join('/')} s${s} @${tick}` };
          }
        }
      }
    }
    return { moved: false, where: '' };
  };

  console.log(`\n══ US_BITID --census ══  n=${SEATS} · ${MATCHUPS.length} matchups × ${SEEDS} seeds · policy ${POLICY}`);
  console.log('   "moves the sim" = the BLIND differ diverges, i.e. the item changed the game rather than');
  console.log('   merely being written into `Fighter.item.equipped`.\n');
  console.log('   item          kind       slot 0 (HUMAN, no button)   slot 1 (BOT, presses via ai.ts)');
  console.log('   ' + '─'.repeat(94));
  const dead = [];
  for (const id of ids) {
    const k = ITEMS[id].kind;
    const a = probe(id, 0);
    const b = probe(id, 1);
    if (!a.moved && !b.moved) dead.push(id);
    console.log(`   ${id.padEnd(13)} ${k.padEnd(10)} ${(a.moved ? `MOVES  ${a.where}` : '—').padEnd(27)} ${b.moved ? `MOVES  ${b.where}` : '—'}`);
  }
  console.log(`\n   dead in BOTH columns: ${dead.length ? dead.join(', ') : 'none'}`);
  console.log('   ⚠️ A "—" on slot 0 for an ACTIVE is expected today: nothing writes `FighterInput.useItem`.');
  console.log('   ⚠️ A "—" in BOTH columns is a MISSING EFFECT, not a missing button.\n');
  // Reports; never gates. The census is a description of the tree, and a threshold here
  // would turn a finding into a red row somebody switches off.
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — a comparator that cannot report a difference is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ us_bitid SELFTEST ══  sim ${SIM_DIR}`);

  /** Run two matches of the SAME construction in lockstep, optionally poking arm 2. */
  const pair = (mutate, { ids = ['sushi', 'donut'], blind = false } = {}) => {
    const rnd = rng(7919 + ids.join('').length * 131 + POLICY.length);
    const decide = driver.POLICY_FNS[POLICY](rnd);
    const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: 60, rnd });
    const s1 = SIM.createMatch(arena, ids[0], ids[1]);
    const s2 = SIM.createMatch(arena, ids[0], ids[1]);
    for (let i = 0; i < 600 && s1.phase !== 'ended'; i++) {
      if (mutate) mutate(i, s2);
      const input = loop.next(s1, DT);
      const e1 = SIM.stepMatch(s1, DT, input);
      const e2 = SIM.stepMatch(s2, DT, input);
      if (eventsOf(e1) !== eventsOf(e2) || stateOf(s1, blind) !== stateOf(s2, blind)) return i;
    }
    return null;
  };

  // ── §A NON-VACUITY. Nothing below is interpretable if the corpus or the registry is
  //    empty — `[].every()` is `true` and every "no matchup diverged" row would be free.
  ok('A1. the two-seat corpus is NON-EMPTY before anything is quantified over it',
    CHARACTER_IDS.length > 1 && CHARACTER_IDS.length * (CHARACTER_IDS.length - 1) > 0,
    `${CHARACTER_IDS.length} characters -> ${CHARACTER_IDS.length * (CHARACTER_IDS.length - 1)} ordered pairs`);
  ok('A2. the registry can supply the positive arm\'s item, and it needs NO PRESS'
    + ' — nothing in src/ writes `FighterInput.useItem`, so an active would be null for the wrong reason',
    ITEM in ITEMS && ITEMS[ITEM].kind !== 'active',
    `${ITEM}: ${ITEM in ITEMS ? ITEMS[ITEM].kind : 'MISSING'}`);
  ok('A3. …and it is usable at two seats, or the n=2 positive arm would be null BY RULE',
    (ITEMS[ITEM]?.minAlive ?? 2) <= 2, `minAlive ${ITEMS[ITEM]?.minAlive}`);
  ok('A4. the arena declares enough spawns for the six-seat arm',
    Array.isArray(arena.spawns) && arena.spawns.length >= 6, `${arena.spawns?.length} spawns`);

  // ── §B the differ. Every arm plants a known-bad and requires it to be CAUGHT ON THE
  //    TICK IT WAS PLANTED — a differ that reports the right answer one tick late is
  //    reporting the consequence, not the difference.
  ok('B1. SELF-PAIR: the same construction against itself never diverges', pair(null) === null,
    `first divergence ${pair(null)}`);
  ok('B2. KNOWN-BAD: a 1 HP poke on tick 200 is caught on that tick',
    pair((i, s) => { if (i === 200) s.fighters[1].hp -= 1; }) === 200);
  ok('B3. KNOWN-BAD: a sub-pixel POSITION nudge on tick 120 is caught',
    pair((i, s) => { if (i === 120) s.fighters[0].x += 1e-9; }) === 120);

  // 🚨 THE ROW THIS TOOL EXISTS FOR. `tun_bitid`/`csx_bitid`'s inherited `fighterOf` does
  // NOT serialise `Fighter.item`, so a differ copied verbatim would call two matches with
  // DIFFERENT LOADOUTS identical — and both of this tool's arms would then be wrong in the
  // same direction, quietly. Each field gets its own arm because "I added the object" is
  // not "I added the field that moves".
  ok('B4a. 🚨 KNOWN-BAD: the FULL differ catches an `item.equipped` difference ALONE'
    + ' (the inherited `tun_bitid` differ was BLIND to it)',
    pair((i, s) => { if (i === 100) s.fighters[0].item.equipped = ['tenderiser']; }) === 100);
  // The two halves of the blinding, in opposite directions. Either one alone is a
  // constant with a tick next to it: a differ blinded to everything would pass B4b and a
  // differ blinded to nothing would pass B4c.
  ok('B4b. 🚨 …and the BLIND differ does NOT — that is what makes the positive arm a claim about BEHAVIOUR',
    pair((i, s) => { if (i === 100) s.fighters[0].item.equipped = ['tenderiser']; }, { blind: true }) === null);
  ok('B4c. 🚨 …while the BLIND differ still catches 1 HP, so it is not blind to everything',
    pair((i, s) => { if (i === 200) s.fighters[1].hp -= 1; }, { blind: true }) === 200);
  ok('B4d. 🚨 …and the BLIND differ ignores a `revivesLeft`-only poke — `createFighter` SEEDS that field'
    + ' from `equipped`, so counting it made the census report Leftovers as "moves" on tick 1',
    pair((i, s) => { if (i === 100) s.fighters[0].item.revivesLeft = 1; }, { blind: true }) === null);
  ok('B4e. 🚨 …while the HP RESTORE a real revive performs is still caught, so nothing behavioural was lost',
    pair((i, s) => { if (i === 150) s.fighters[1].hp += 5; }, { blind: true }) === 150);
  ok('B5. KNOWN-BAD: an `item` DEADLINE alone is caught, and -Infinity survives serialisation',
    pair((i, s) => { if (i === 90) s.fighters[0].item.shieldUntil = 1234; }) === 90);
  ok('B6. KNOWN-BAD: an `item.streakCount` alone is caught',
    pair((i, s) => { if (i === 80) s.fighters[1].item.streakCount = 3; }) === 80);
  ok('B7. KNOWN-BAD: `revivesLeft` alone is caught — Leftovers is a counter, not a deadline',
    pair((i, s) => { if (i === 70) s.fighters[0].item.revivesLeft = 1; }) === 70);

  // ── §C the CONSTRUCTION claim, on one matchup, both directions.
  const oneEmpty = lockstep(['sushi', 'donut'], 0, []);
  const oneArmedRaw = lockstep(['sushi', 'donut'], 0, [ITEM]);
  const oneArmed = lockstep(['sushi', 'donut'], 0, [ITEM], true);
  ok('C1. an EMPTY loadout: the legacy overload and the list form are bit-identical, on the FULL differ',
    oneEmpty.diverged === false, `${oneEmpty.ticks} ticks compared`);
  ok(`C2. 🚨 CONTROL: with \`${ITEM}\` equipped the BLIND differ diverges — the item changed the GAME,`
    + ' not merely the array. Without this row, C1 is vacuous.',
    oneArmed.diverged === true,
    oneArmed.diverged ? `tick ${oneArmed.tick} (${oneArmed.kinds || 'state only'})` : 'NEVER DIVERGED');
  // 🚨 THE ROW THAT RECORDS WHY THE BLIND DIFFER EXISTS. The full differ fires on tick 1
  // with an EMPTY event set — that is the `equipped` array, and the first draft of this
  // tool published it as the behavioural control.
  ok('C3. …and the FULL differ fires FAR earlier, which is the vacuity the blinding removes',
    oneArmedRaw.diverged === true && oneArmed.tick > oneArmedRaw.tick,
    `full differ tick ${oneArmedRaw.tick} (${oneArmedRaw.kinds || 'no events'}) vs blind tick ${oneArmed.tick}`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed  (LOGIC + construction. `
    + 'It does NOT validate where this tool is pointed — §A does that, and it is why §A reads the real arena and the real registry.)\n');
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the run
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main) {
  if (SEATS < 2 || SEATS > 6) { console.error(`us_bitid: --n ${SEATS} is outside the sim's 2..6 seats`); process.exit(2); }
  if (EXPECT === 'diverge' && !(ITEM in ITEMS)) {
    console.error(`us_bitid: --item ${ITEM} is not in the registry; the positive arm would be null for the wrong reason`);
    process.exit(2);
  }
  const loadout = EXPECT === 'diverge' ? [ITEM] : [];
  if (loadout.length > ITEM_SLOTS) { console.error('us_bitid: loadout over ITEM_SLOTS'); process.exit(2); }

  const rows = [];
  const t0 = Date.now();
  const cases = corpus();
  // 🚨 NON-VACUITY, ON THE RUN AND NOT ONLY IN `--selftest`. A corpus that came back empty
  // would print "0 diverged" and exit 0 — the shape `CLAUDE.md` rule 6 records firing three
  // times in three files in one session.
  if (cases.length === 0) { console.error('us_bitid: EMPTY corpus — refusing to report a null over nothing'); process.exit(2); }
  for (const ids of cases) {
    for (let s = 0; s < SEEDS; s++) rows.push({ ...lockstepDual(ids, s, loadout), ids, s });
  }
  const reached = rows.filter((r) => r.reachedTick !== null);
  const expressed = rows.filter((r) => r.expressedTick !== null);
  const ticks = rows.reduce((a, r) => a + r.ticks, 0);

  console.log(`\n══ US_BITID ══  n=${SEATS} · ${rows.length} matches · policy ${POLICY} · ${SEEDS} seeds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   sim      ${SIM_DIR}`);
  console.log(`   arena    ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius.toFixed(2)}`);
  console.log(`   loadout  [${loadout.join(', ') || '(empty)'}]  vs  the call newMatch makes with nothing equipped`);
  console.log(`   expect   ${EXPECT.toUpperCase()}\n`);
  console.log(`   matches            ${rows.length}`);
  console.log(`   ticks compared     ${ticks.toLocaleString()}`);

  let verdict;
  if (EXPECT === 'same') {
    console.log(`   DIVERGED           ${reached.length}`);
    for (const r of reached.slice(0, 6)) {
      console.log(`     ${r.ids.join(' vs ')} seed ${r.s} @ tick ${r.reachedTick} (${r.reachedKinds})`);
    }
    verdict = reached.length === 0;
    console.log(`\n   >> ${verdict
      ? 'PASS — an empty loadout is BIT-IDENTICAL to the call newMatch has always made. Floor: EXACT (a state differ, no noise in it).'
      : 'FAIL — the empty-loadout path is NOT inert. See the rows above.'}\n`);
  } else {
    // ⚠️ TWO QUANTITIES, TWO FLOORS — see `lockstepDual`. Conflating them is what made an
    // earlier version of this arm report the WIRING as broken when what it had measured
    // was `tenderiser` failing to get a streak in a six-seat match.
    console.log(`   REACHED the sim    ${reached.length}/${rows.length}   (FULL differ — the array is on the fighter; floor EXACT 100%)`);
    console.log(`   EXPRESSED itself   ${expressed.length}/${rows.length}   (BLIND differ — the item changed the game; floor > 0, and the`);
    console.log('                                    fraction is a property of item x seat x seat-count, NOT of the wiring)');
    for (const r of expressed.slice(0, 4)) {
      console.log(`     moved: ${r.ids.join('/')} seed ${r.s} @ tick ${r.expressedTick} (${r.expressedKinds})`);
    }
    for (const r of rows.filter((x) => x.expressedTick === null).slice(0, 4)) {
      console.log(`     inert: ${r.ids.join('/')} seed ${r.s} — ${r.ticks} ticks, the item never got to act`);
    }
    verdict = reached.length === rows.length && expressed.length > 0;
    console.log(`\n   >> ${verdict
      ? `PASS — the loadout REACHED the sim in ${reached.length}/${rows.length} and EXPRESSED itself in ${expressed.length}. The null arm is therefore informative.`
      : (reached.length !== rows.length
        ? `FAIL — the loadout reached only ${reached.length}/${rows.length} fighters. THIS IS THE WIRING.`
        : `FAIL — it reached every fighter and moved NOTHING in ${rows.length} matches. Either the effect is unimplemented (see --census) or the differ is blind.`)}\n`);
  }
  process.exit(verdict ? 0 : 1);
}
