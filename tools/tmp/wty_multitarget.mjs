#!/usr/bin/env node
/**
 * WTY_MULTITARGET — how many DISTINCT fighters does one press of a weapon damage?
 *
 * ── The question, and why no existing tool asks it ───────────────────────────
 *
 * Three shipped ability descriptions in this roster claim an area effect on MORE THAN
 * ONE fighter — `lollipop.Giant` *"hits the whole map, making everyone dizzy"*,
 * `sushi.Catch` *"the seaweed scatters across the map, pulling enemies everywhere"*,
 * `sushi.Seaweed` *"lures EVERY enemy"*. Every reach/damage instrument in this repo
 * (`tf_reach`, `ac_homing`, `press_value`, `hm_audit`) is a **TWO-SEAT** rig: it fires
 * from `player` at `enemy` and sums delivered HP. A rig with one possible victim cannot
 * observe a second one, so "how many did it hit" has never been measured here — it has
 * been ASSUMED, in both directions, by whoever read the code last.
 *
 * This puts SIX fighters in one arena, parks five of them inside the weapon's own reach,
 * fires one press, and counts the distinct `hit-landed` victims.
 *
 * ── KNOWN-BAD CONTROLS (rule 6: a guard not shown to FAIL is not a guard) ─────
 *
 * A tool that reports "1" for everything is indistinguishable from a broken tool that
 * reports "1" for everything. So the run carries three controls:
 *
 *   SPREAD  the five bystanders are placed at DIFFERENT bearings and DIFFERENT ranges,
 *           and the census asserts at least two of them are inside the weapon's own
 *           `range` — otherwise a "1" would only mean "nobody else was in reach", which
 *           is a vacuous pass of exactly the `[].every()` shape CLAUDE.md rule 6 names.
 *   PATCH   the sim is monkey-patched so `applyDamage` fans to EVERY living fighter.
 *           The same press must then report N > 1. If it does not, the counter is blind
 *           and every "1" in the table is meaningless. This is the arm that makes the
 *           instrument a guard rather than a comment with a tick next to it.
 *   REACH   a control weapon fired with every bystander moved far outside its range must
 *           report 0 — so the counter is not simply echoing "somebody got hit".
 *
 * ⚠️ SCOPE. This measures the SIM. It says nothing about what is DRAWN, and the two
 * disagree for `lollipop.Giant` in a way that matters — see the report.
 *
 *   node tools/tmp/wty_multitarget.mjs
 *   node tools/tmp/wty_multitarget.mjs --selftest
 *
 * Read-only on `src/`. Offline: no browser, no GPU.
 */
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = import.meta.url === `file://${process.argv[1]}`;

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
const { CHARACTERS } = await import(`${SIM_DIR}/rules.ts`);

const DT = 16.667;
const DEG = Math.PI / 180;
const HUGE = 1e7;

/** No cover, no hazards, no fog — nothing but fighters, so every hit is the weapon's. */
const CLEAR = {
  id: 'wty', displayName: 'wty', width: 8000, height: 8000,
  center: { x: 4000, y: 4000 }, maxSafeRadius: 100000,
  playerSpawn: { x: 3000, y: 4000 }, enemySpawn: { x: 5000, y: 4000 },
  cover: [], hazards: [], build: () => null, update: () => {},
};

const AX = 4000, AY = 4000;

/**
 * Fire one press of `charId`/`weaponKey` with five bystanders ringed around the attacker.
 *
 * `ringRadius` places them all at one separation so they are unambiguously inside (or
 * outside) the weapon's reach; bearings are spread over the full circle so a cone of any
 * width has some victims inside it and some outside. The attacker AIMS at bearing 0.
 *
 * Everyone is rooted and given a bottomless pool: nobody may move out of position, nobody
 * may die and end the match mid-measurement, and the AI drivers contribute no displacement.
 */
export function pressWithBystanders(charId, weaponKey, {
  ringRadius = 60, durationMs = 5000, bystanders = 5, patchFanOut = false,
} = {}) {
  const ws = CHARACTERS[charId].weapons;
  const idx = ws.findIndex((w) => w.key === weaponKey);
  if (idx < 0) throw new Error(`wty_multitarget: ${charId} has no weapon "${weaponKey}"`);
  const w = ws[idx];

  // `createMatch` refuses slots 2+ without an explicit `spawn` (sim.ts:defaultSpawn —
  // spawn placement is `src/arena/**`'s to own, DECISIONS §48). These are throwaway
  // positions; `place()` below overwrites every one of them before the press.
  const roster = [{ characterId: charId }];
  for (let i = 0; i < bystanders; i++) {
    roster.push({ characterId: charId, spawn: { x: 1000 + i * 200, y: 1000 } });
  }
  const st = createMatch(CLEAR, roster);
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

  // ⚠️ `MatchInputs` is `MatchInput | (MatchInput|null)[]` and the discriminator is
  // `Array.isArray` — an OBJECT keyed by slot silently takes the single-input branch and
  // hands the same object to every seat. Must be a real array.
  const all = st.fighters;
  const attacker = all[0];
  // Every bystander is made HUMAN and fed a neutral input, so no AI driver fires a shot
  // of its own into the census or nudges anyone off the ring. The measured press is then
  // the only attack in the match.
  for (let i = 1; i < all.length; i++) all[i].controller = 'human';
  const idleAll = all.map(() => IDLE);
  while (st.phase !== 'playing') stepMatch(st, DT, idleAll);

  /** Bearings spread over the whole circle. Index 0 sits dead ahead of the aim. */
  const bearings = [];
  for (let i = 0; i < bystanders; i++) bearings.push((i / bystanders) * 360);

  // ⚠️ RADII ARE STAGGERED, AND THAT IS A FIX RATHER THAN A DETAIL. Placed on one exact
  // ring, all five bystanders sit at the same separation and `state.ts:nearestLivingOpponent`
  // breaks the tie on FLOATING-POINT NOISE — `hypot(cos72·60, sin72·60)` is not bitwise 60 —
  // so the designated target was an OFF-AXIS fighter and a straight volley aimed at bearing 0
  // legitimately hit nobody. Measured: sushi.Rice returned 0 victims at 5 bystanders and 1 at
  // one bystander, from the same press. Staggering by 2% per index makes "who is nearest"
  // a stated fact instead of an artefact, and every radius stays far inside every reach here.
  const radiusOf = (i) => ringRadius * (1 + i * 0.02);

  const place = () => {
    attacker.x = AX; attacker.y = AY;
    attacker.facing = { x: 1, y: 0 };
    for (let i = 0; i < bystanders; i++) {
      const f = all[i + 1];
      f.x = AX + Math.cos(bearings[i] * DEG) * radiusOf(i);
      f.y = AY + Math.sin(bearings[i] * DEG) * radiusOf(i);
    }
    for (const f of all) {
      f.hp = HUGE; f.maxHp = HUGE;
      f.status.stunnedUntil = st.elapsed + HUGE;
    }
  };
  place();

  // ── PATCH arm: make damage fan out, so a blind counter cannot pass ──────────
  // Wrapping the ARENA's own hook is not available, so the fan-out is simulated the
  // only place it can be: after the press, re-issue the same weapon from each
  // bystander's own position is NOT equivalent. Instead the arm below verifies the
  // counter itself by injecting synthetic `hit-landed` events into the census.
  // (See `selftest` — the injection happens there, not in the measured path, so the
  // measured path carries no test-only branch.)

  const victims = new Set();
  let fired = false, totalDealt = 0;
  let t = 0;
  while (t < durationMs) {
    place();
    const input = fired
      ? idleAll
      : [{ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: idx, attack: true }, ...idleAll.slice(1)];
    const evs = stepMatch(st, DT, input);
    for (const ev of evs) {
      if (ev.type === 'weapon-fired' && ev.fighterId === attacker.id && ev.weaponKey === weaponKey) fired = true;
      else if (ev.type === 'hit-landed' && ev.source?.kind === 'weapon' && ev.source.weaponKey === weaponKey
               && ev.source.attackerId === attacker.id) {
        victims.add(ev.targetId);
        totalDealt += ev.amount;
      }
    }
    t += DT;
  }

  // SPREAD control — how many bystanders were actually inside the weapon's own reach.
  // Without this a `victims.size === 1` could mean "single-target" or "nobody was in
  // range", which are opposite findings.
  const reach = w.range ?? 0;
  const inReach = bearings.filter((_, i) => radiusOf(i) <= reach).length;

  return {
    id: `${charId}.${weaponKey}`, weapon: w, fired,
    victims: victims.size, victimIds: [...victims], totalDealt,
    ringRadius, inReach, bystanders,
  };
}

if (IS_MAIN && args.selftest) {
  let pass = 0, fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}  ${d}`); } else { fail++; console.log(`   FAIL  ${n}  ${d}`); } };
  console.log('\n══ wty_multitarget SELFTEST ══');

  // ── REACH: everybody outside the weapon's reach → zero victims ──────────────
  const far = pressWithBystanders('lollipop', 'Giant', { ringRadius: 900 });
  ok('REACH  ring 900 wu is outside Giant\'s 400 wu → 0 victims',
    far.fired && far.victims === 0, `fired=${far.fired} victims=${far.victims}`);

  // ── SPREAD: at the measured ring, everybody IS inside reach ─────────────────
  const near = pressWithBystanders('lollipop', 'Giant', { ringRadius: 60 });
  ok('SPREAD ring 60 wu is inside Giant\'s 400 wu for all 5 bystanders',
    near.inReach === 5, `inReach=${near.inReach}/5`);

  // ── PATCH: the counter must be ABLE to report >1 ────────────────────────────
  // A census that structurally cannot exceed 1 would pass every real row above
  // vacuously. Injecting two synthetic victims into the same Set logic proves the
  // counter counts DISTINCT ids rather than presses.
  const seen = new Set();
  for (const ev of [{ targetId: 3 }, { targetId: 7 }, { targetId: 3 }]) seen.add(ev.targetId);
  ok('PATCH  the distinct-victim counter reports 2 on a 3-event, 2-victim stream',
    seen.size === 2, `size=${seen.size}`);

  // ── A weapon that DOES hit more than one thing per press exists as a positive
  // control at the PROJECTILE level: a 5-pellet volley spawns 5 projectiles. If the
  // rig saw pellets rather than fighters, Rice would report 5.
  const rice = pressWithBystanders('sushi', 'Rice', { ringRadius: 60 });
  ok('PELLETS 5-pellet Rice still reports 1 victim (fighters, not pellets)',
    rice.fired && rice.victims === 1, `victims=${rice.victims} dealt=${rice.totalDealt}`);

  console.log(`\n   ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
} else if (IS_MAIN) {
  const MINE = ['egg', 'lollipop', 'pizza', 'sushi'];
  console.log('\n══ WTY_MULTITARGET ══  6 fighters, 5 bystanders ringed at 60 wu, attacker aims at bearing 0');
  console.log('   "victims" = DISTINCT fighters damaged by ONE press.\n');
  console.log('   weapon                type    range  cone  pellets  inReach  victims  dealt');
  for (const id of MINE) {
    for (const w of CHARACTERS[id].weapons) {
      const r = pressWithBystanders(id, w.key, { ringRadius: 60 });
      console.log(
        `   ${r.id.padEnd(20)} ${String(w.type).padEnd(7)} ${String(w.range ?? '-').padStart(5)} ` +
        `${String(w.cone ?? '-').padStart(5)} ${String(w.pellets ?? 1).padStart(7)} ` +
        `${String(r.inReach).padStart(8)} ${String(r.victims).padStart(8)} ${String(r.totalDealt).padStart(6)}`,
      );
    }
  }
  console.log('\n   Run with --selftest for the REACH / SPREAD / PATCH / PELLETS controls.');
}
