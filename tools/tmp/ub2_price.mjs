#!/usr/bin/env node
/**
 * UB2-PRICE — WHAT DOES EACH OF URI'S TEN ITEMS ACTUALLY BUY, AT SIX SEATS?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. IT DOES NOT MEASURE ANYTHING. IT DRIVES `nf_ffa` AND READS ITS ROWS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Placement at N=6 is `nf_ffa.mjs`'s quantity and its rules are not simple: elimination
 * order for the dead, **fractional ranking** for survivors the sim declines to order, a
 * separate branch for the TOTAL WIPE (a declared winner who is dead — 17% of a mirror
 * corpus), and a `sum(place) === N(N+1)/2` invariant. Re-implementing any of that here would
 * be *"a rule stated once and implemented twice"*, this repo's most expensive defect shape.
 *
 * So this file **forks `nf_ffa.mjs` unmodified**, once per arm, and reads `rows[].place` out
 * of its `--json`. It contributes exactly one thing `nf_ffa` cannot: the arms differ by a
 * LOADOUT, which `nf_ffa` has no flag for. That difference is injected by
 * `tools/tmp/ub2_patchsim.mjs` through `--sim` — the route `nf_ffa`'s own header prescribes
 * for an ablation — and **not** by editing `nf_ffa`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. THE DESIGN: MIRROR ROSTERS, ONE CARRIER SEAT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `--mirror` makes every roster six copies of ONE character, so **every fighter in a match
 * is identical**. Hand the loadout to exactly one seat and every difference from the control
 * is the item, with the character confound removed by construction rather than averaged out.
 * Eleven characters x `--phases` ring angles is the corpus; each character is its own cell.
 *
 * 🚨 **THE QUANTITY IS THE PAIRED PER-CONFIG DELTA, AND IT IS EXACT.** `nf_ffa`'s header:
 * *"a paired per-config delta on identical seeds is EXACT — A DIFFERENT QUANTITY"*. Both
 * arms run the identical design (same rosters, same seats, same phases) against a sim with
 * NO RNG, so a cell that moves, moved. **No resolution floor applies to it and none is
 * quoted.**
 *
 * ⚠️ **THE AGGREGATE IS A DIFFERENT NUMBER WITH A DIFFERENT AND MUCH WORSE FLOOR, AND IT IS
 * PRINTED SEPARATELY OR NOT AT ALL.** `nf_ffa`'s measured floor — **0.978 places** — is for
 * the FULL 462x6 mixed-roster design at one phase, **2,772 matches**. A mirror arm here is
 * `11 x phases` matches, two orders of magnitude smaller, so that number does not apply and
 * quoting it would be borrowing a floor from a corpus that was never run. Where an aggregate
 * is reported, `--phases >= 3` lets this file derive its OWN floor the way `nf_ffa --floor`
 * does — the spread of the same statistic across ring phases, a nuisance that provably
 * cannot change any fighter's strength — and it prints that number beside it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. 🚨 PROVE THE RIG CAN SEE A CHANGE BEFORE REPORTING A NULL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `docs/ITEMS.md`: the medikit track reported *"0 of 110 moved, bit-identical"*, which looked
 * like "the change did nothing" and was really "the rig cannot see it" — 882 kits dropped and
 * **0 taken**. An item that scores zero here must be distinguishable from an instrument that
 * scores everything zero.
 *
 * `--control` is that proof. It runs one extra arm in which the carrier seat's `maxHp` is
 * multiplied — a large, unambiguous, non-item advantage delivered on the SAME seat through
 * the same patch — and requires the paired delta to move. If the control is flat, every null
 * in the table is meaningless and this file says so instead of printing them.
 *
 * ⚠️ It is NOT `nf_ffa --boost`: that keys on CHARACTER, and in a mirror roster all six
 * fighters are the same character, so it moves everybody and produces no seat effect at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. WHAT THIS CANNOT SEE, DECLARED UP FRONT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   * **Squid Ink is structurally 0 and that is the truth about the item, not a rig limit.**
 *     `state.ts:ItemState.blotUntil` is a flag the sim never branches on — it is read by the
 *     VFX layer and by nothing else. Blotting a bot changes nothing; blotting a human changes
 *     everything. Its real cost is that it occupies one of two equip slots.
 *   * **Blue Cheese is 0 because its effect is MISSING**, not because it is weak. There is no
 *     aura block in `sim.ts` (`32438b4`, still open; `sim.test.mjs` §43(e) pins the absence).
 *   * Every number here is measured under the **shipped bot policy on every seat**. It is not
 *     comparable to a `roster_lab` figure, whose 110 cells are scripted-vs-bot, and this file
 *     never prints one beside the other.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 5. WHAT THIS TOOL HAS MEASURED — an OBSERVATION stamped with its SHA, not a floor
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `a0d9ed1`, 2026-09-02, `--phases 6`, mirror rosters, 66 matches per arm. Re-run it; do not
 * re-quote it. **Carrier seat 0 against five identical opponents carrying nothing:**
 *
 *     control  seat-0 mean place 3.773 · 1st-place 12.1%
 *     maxHp x4 (the rig's own positive control)   1.076 · 95.5% · 63/66 configs moved
 *     warm_milk 1.000 · 100.0% · 63/66      pompa 1.015 · 98.5% · 64/66
 *     tenderiser 1.076 · 97.0% · 64/66      shiitake 1.970 · 59.1% · 63/66
 *     disposal 1.591 · 40.9% · 61/66        liquorice 3.167 · 24.2% · 59/66
 *     leftovers 2.361 · 18.0% · 24/61       squid_ink & blue_cheese 3.773 · 12.1% · 0/66
 *     springform 4.515 · 9.1% · 58/66       — the only one that makes its owner WORSE
 *
 * ⚠️ **THE TOP OF THAT TABLE IS SATURATED AND THAT IS THE RESULT, NOT A CAVEAT.** Placement
 * bottoms out at 1.000, so Warm Milk, Pompa, Tenderiser and the 4x-HP control are
 * INDISTINGUISHABLE here — all four win essentially every match and there is nothing above
 * first place for the instrument to separate them with.
 *
 * ── AND THE SYMMETRIC ARM ANSWERS A QUESTION THAT WAS PARKED FOR URI ────────
 *
 * `UB2_ITEMS=warm_milk` with no `UB2_ITEM_SEAT` — EVERY seat carries it, 66/66 configs moved:
 *
 *     TOTAL WIPES (a declared winner who is dead)   control 12/66  ->  **0/66**
 *     deaths with no attributable hit (fog/hazard)  control    16  ->  **0**
 *     mean survivors at the whistle                 control  0.82  ->  1.00
 *
 * `docs/HANDOVER.md`'s ranked next work #2 is *"28 total wipes in 360 six-player matches,
 * where there were 0. Everyone dying is a reachable ending now. A design question, not a
 * bug."* **One item on every seat removes the ending entirely**, because the fights resolve
 * before the fog closes. Counts, so EXACT.
 *
 * ⚠️ **DO NOT READ THE SEAT SPREAD OFF THIS CORPUS.** Control 1.076 places, symmetric 0.303 —
 * which LOOKS like "items made the seats fairer", and 66 matches cannot support that claim:
 * `nf_ffa`'s published 0.315 seat-spread floor was measured on 11,088. The control's own
 * spread is already 3.4x that floor, which is the tell that the design is too small for a
 * seat-fairness statement. The paired COUNT is what this corpus can carry.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   node tools/tmp/ub2_price.mjs --selftest
 *   node tools/tmp/ub2_price.mjs --phases 6 --jobs 4 --control       # all ten, asymmetric
 *   node tools/tmp/ub2_price.mjs --phases 6 --jobs 4 --seat all      # everyone carries it
 *   node tools/tmp/ub2_price.mjs --phases 6 --items warm_milk,pompa  # a two-slot loadout
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const NF_FFA = join(ROOT, 'tools', 'tmp', 'nf_ffa.mjs');
const PATCHSIM = join(ROOT, 'tools', 'tmp', 'ub2_patchsim.mjs');

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

const { ITEMS, ITEM_SLOTS } = await import(`${ROOT}/src/game/rules.ts`);
const ITEM_IDS = Object.keys(ITEMS);

const WORK = String(args.work ?? join(tmpdir(), 'ub2_price'));
const SIMTREE = String(args.simtree ?? '/tmp/ub2sim');
const PHASES = Number(args.phases ?? 6);
const JOBS = Number(args.jobs ?? 4);
const N = Number(args.n ?? 6);

/**
 * Run one `nf_ffa` arm and return its parsed JSON.
 *
 * ⚠️ **`--sim` IS FORWARDED EXPLICITLY AND SO IS THE ENVIRONMENT.** `nf_ffa` forks worker
 * children with a fixed flag list and inherits `env`; its own header records that a dropped
 * `--sim` would have run the parent on the patch and every child on the working tree,
 * *"returning 'the change did nothing', which is a normal outcome for a balance ablation and
 * which nobody re-checks"*. Both are passed here for that reason.
 */
function arm(name, env) {
  const out = join(WORK, `${name}.json`);
  const argv = [NF_FFA, '--mirror', '--n', String(N), '--phases', String(PHASES),
    '--jobs', String(JOBS), '--sim', join(SIMTREE, 'src', 'game'), '--json', out];
  const t0 = Date.now();
  const log = execFileSync(process.execPath, argv, {
    env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  if (!existsSync(out)) throw new Error(`ub2_price: arm ${name} wrote no JSON`);
  const j = JSON.parse(readFileSync(out, 'utf8'));
  j.__wall = (Date.now() - t0) / 1000;
  j.__log = log;
  return j;
}

/**
 * PAIR TWO ARMS ON `nf_ffa`'s OWN CONFIG KEY.
 *
 * 🚨 The key is `n|phase|roster|rotation` — it names the DESIGN CELL, not the roster
 * contents. `nf_ffa`'s `--baseline` block checks `ids` as well, because *"if the character
 * list or the enumeration order moved between the two runs, the same key holds different
 * fighters and the 'paired' delta would be a comparison of two different matches wearing one
 * label"*. Same check here, and a mismatch is FATAL rather than dropped: both arms come from
 * one process seconds apart, so a mismatch means something is wrong with this tool.
 */
function pair(ctl, live, seat) {
  const byKey = new Map(ctl.rows.map((r) => [r.key, r]));
  let paired = 0, moved = 0, dropped = 0;
  let dCarrier = 0, dOthers = 0, nOthers = 0, maxAbsCarrier = 0;
  const perChar = new Map();
  const perPhase = new Map();
  for (const r of live.rows) {
    const b = byKey.get(r.key);
    if (!b) { dropped++; continue; }
    if (JSON.stringify(r.ids) !== JSON.stringify(b.ids)) {
      throw new Error(`ub2_price: key ${r.key} holds different rosters in the two arms — the design moved`);
    }
    if (r.fault || b.fault) { dropped++; continue; }
    paired++;
    if (JSON.stringify(r.place) !== JSON.stringify(b.place)) moved++;
    const carriers = seat === 'all' ? r.ids.map((_, i) => i) : [Number(seat)];
    for (let s = 0; s < r.place.length; s++) {
      const d = r.place[s] - b.place[s];
      if (carriers.includes(s)) {
        dCarrier += d; maxAbsCarrier = Math.max(maxAbsCarrier, Math.abs(d));
        const c = perChar.get(r.ids[s]) ?? { n: 0, d: 0 };
        c.n++; c.d += d; perChar.set(r.ids[s], c);
        const p = perPhase.get(r.key.split('|')[1]) ?? { n: 0, d: 0 };
        p.n++; p.d += d; perPhase.set(r.key.split('|')[1], p);
      } else { dOthers += d; nOthers++; }
    }
  }
  const nCarrier = seat === 'all' ? paired * N : paired;
  return {
    paired, moved, dropped,
    dCarrier: nCarrier ? dCarrier / nCarrier : 0,
    dOthers: nOthers ? dOthers / nOthers : 0,
    maxAbsCarrier,
    perChar, perPhase,
  };
}

/**
 * THIS ARM'S OWN FLOOR, DERIVED THE WAY `nf_ffa --floor` DERIVES ITS OWN.
 *
 * The ring phase is a nuisance that provably cannot change any fighter's strength (it moves
 * all N seats by one angle and preserves the ring's `2*pi/N` symmetry exactly), so the spread
 * of the carrier delta ACROSS phases is noise by construction. The range over `--phases`
 * replicates is the floor for the pooled mean.
 *
 * ⚠️ It needs `--phases >= 3` to mean anything and returns `null` below that rather than
 * printing a number it cannot support.
 */
function phaseFloor(p) {
  const means = [...p.perPhase.values()].filter((x) => x.n > 0).map((x) => x.d / x.n);
  if (means.length < 3) return null;
  return { range: Math.max(...means) - Math.min(...means), k: means.length, means };
}

const f3 = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);

/* ═══════════════════════════════════════════════════════════════════════════
   SELFTEST — and §A/§B are POINTING arms
   ═══════════════════════════════════════════════════════════════════════════ */

async function selftest() {
  let pass = 0, fail = 0; const bad = [];
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   - ${n}${d ? `  (${d})` : ''}`); } else { fail++; bad.push(n); console.log(`  FAIL - ${n}${d ? `  (${d})` : ''}`); } };
  console.log('\nUB2-PRICE --selftest');

  // §A the pairing arithmetic, on synthetic rows. Logic only — stated as such.
  {
    const mk = (place) => ({ key: '6|0|0|0', ids: ['a', 'a', 'a', 'a', 'a', 'a'], place, fault: null });
    const ctl = { rows: [mk([1, 2, 3, 4, 5, 6])] };
    const live = { rows: [mk([3, 2, 1, 4, 5, 6])] };
    const p = pair(ctl, live, 0);
    ok('§A NON-VACUITY: the synthetic pair actually paired a row',
      p.paired === 1 && p.dropped === 0, `paired ${p.paired}`);
    ok('§A the carrier delta is seat 0\'s and nobody else\'s', p.dCarrier === 2, `${p.dCarrier}`);
    ok('§A …and it is signed the way placement is — a BIGGER number is WORSE', p.dCarrier > 0);
    ok('§A a config whose placement vector is unchanged does NOT count as moved',
      pair({ rows: [mk([1, 2, 3, 4, 5, 6])] }, { rows: [mk([1, 2, 3, 4, 5, 6])] }, 0).moved === 0);
    let threw = false;
    try {
      pair({ rows: [{ key: '6|0|0|0', ids: ['a'], place: [1], fault: null }] },
        { rows: [{ key: '6|0|0|0', ids: ['b'], place: [1], fault: null }] }, 0);
    } catch { threw = true; }
    ok('§A 🔴 KNOWN-BAD: a key holding a DIFFERENT roster in the two arms is FATAL, not silently paired',
      threw);
  }

  // §B POINTING — the whole rig, end to end, on the smallest corpus that runs.
  // `--selftest` validates LOGIC and never where a tool is AIMED, so this arm actually
  // forks nf_ffa against the patched tree and requires the null and the positive to differ.
  {
    if (!existsSync(join(SIMTREE, 'src', 'game', 'sim.ts'))) {
      execFileSync(process.execPath, [PATCHSIM, '--out', SIMTREE], { encoding: 'utf8' });
    }
    mkdirSync(WORK, { recursive: true });
    const saveP = PHASES;
    const ctl = arm('self_ctl', {});
    const nul = arm('self_null', {});
    const pn = pair(ctl, nul, 0);
    ok('§B NON-VACUITY: the arms really ran a corpus',
      pn.paired > 0, `${pn.paired} paired configs, ${ctl.rows.length} rows/arm, ${ctl.__wall.toFixed(1)}s`);
    ok('§B 🔴 NULL ARM: two runs of the SAME configuration are BIT-IDENTICAL — the sim has no RNG, so any movement below is real',
      pn.moved === 0 && pn.dCarrier === 0, `${pn.moved} of ${pn.paired} moved`);

    const boost = arm('self_boost', { UB2_BOOST_HP: '4', UB2_BOOST_SEAT: '0' });
    const pb = pair(ctl, boost, 0);
    ok('§B 🔴 POSITIVE CONTROL: quadrupling the carrier seat\'s HP MOVES the rig. If this is flat every null in the table is meaningless',
      pb.moved > 0 && pb.dCarrier < 0,
      `${pb.moved} of ${pb.paired} configs moved, carrier Δplace ${f3(pb.dCarrier)} (negative = better)`);
    ok('§B …and the two arms are DISTINGUISHABLE, which is the property the whole file rests on',
      pb.moved !== pn.moved);
    void saveP;
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
  if (args.fresh && existsSync(WORK)) rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  execFileSync(process.execPath, [PATCHSIM, '--out', SIMTREE], { encoding: 'utf8' });

  const seat = String(args.seat ?? '0');
  const loadouts = args.items
    ? [String(args.items).split(',')]
    : ITEM_IDS.map((id) => [id]);
  for (const l of loadouts) {
    if (l.length > ITEM_SLOTS) throw new Error(`ub2_price: ${l.length} items but the game has ${ITEM_SLOTS} slots`);
    for (const id of l) if (!(id in ITEMS)) throw new Error(`ub2_price: unknown item "${id}"`);
  }

  console.log(`\n══ UB2-PRICE ══  N=${N} · mirror rosters · ${PHASES} ring phases · carrier seat ${seat}`);
  console.log(`   every arm is \`nf_ffa --mirror\` UNMODIFIED against ${join(SIMTREE, 'src', 'game')}`);
  console.log('   the quantity is the PAIRED per-config Δ placement — EXACT, no floor applies');
  console.log('   ⚠️ shipped bot policy on every seat. NOT comparable to a roster_lab figure.\n');

  const ctl = arm('ctl', {});
  console.log(`   control: ${ctl.rows.length} matches, ${ctl.__wall.toFixed(1)}s`);

  const results = [];
  if (args.control) {
    const b = arm('boost', { UB2_BOOST_HP: '4', UB2_BOOST_SEAT: seat === 'all' ? '0' : seat });
    results.push({ label: '[CONTROL maxHp x4]', kind: 'control', p: pair(ctl, b, seat === 'all' ? '0' : seat) });
  }
  for (const l of loadouts) {
    const env = { UB2_ITEMS: l.join(',') };
    if (seat !== 'all') env.UB2_ITEM_SEAT = seat;
    const a = arm(`item_${l.join('_')}`, env);
    results.push({ label: l.join('+'), kind: ITEMS[l[0]].kind, p: pair(ctl, a, seat) });
  }

  // 🚨 NON-VACUITY BEFORE THE TABLE. If nothing paired, every row below is 0/0.
  const empty = results.filter((r) => r.p.paired === 0);
  if (empty.length) {
    console.error(`ub2_price: ${empty.length} arm(s) paired ZERO configs — REFUSING to report`);
    process.exit(1);
  }

  // 🚨 AND THE CONTROL GATES THE TABLE, not the other way round.
  const ctlRow = results.find((r) => r.kind === 'control');
  if (ctlRow && ctlRow.p.moved === 0) {
    console.error('ub2_price: 🔴 THE POSITIVE CONTROL DID NOT MOVE. The rig cannot see a seat advantage;');
    console.error('           every null below would be a statement about this tool. REFUSING to report.');
    process.exit(1);
  }

  console.log('\n   loadout            kind        configs moved     Δ place (carrier)   max|Δ| one match   Δ place (others)');
  console.log('   ' + '─'.repeat(112));
  for (const r of results) {
    console.log(`   ${r.label.padEnd(19)}${r.kind.padEnd(12)}`
      + `${String(`${r.p.moved}/${r.p.paired}`).padStart(9)}         `
      + `${f3(r.p.dCarrier).padStart(9)}          ${r.p.maxAbsCarrier.toFixed(2).padStart(6)}           ${f3(r.p.dOthers).padStart(9)}`);
  }
  console.log('\n   Δ place is signed as placement is: NEGATIVE is BETTER (1st is 1, 6th is 6).');
  console.log('   "configs moved" is a COUNT and it is EXACT. "Δ place" is a mean over the same cells.');

  for (const r of results) {
    const fl = phaseFloor(r.p);
    if (fl) {
      const resolvable = Math.abs(r.p.dCarrier) > fl.range;
      console.log(`   ${r.label.padEnd(19)} Δ ${f3(r.p.dCarrier)} vs its OWN ${fl.k}-phase floor ${fl.range.toFixed(3)}`
        + `  →  ${resolvable ? 'RESOLVED' : 'inside the floor — do not act on it'}`);
    }
  }

  if (args.json) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(String(args.json), JSON.stringify(results.map((r) => ({
      label: r.label, kind: r.kind,
      paired: r.p.paired, moved: r.p.moved, dropped: r.p.dropped,
      dCarrier: r.p.dCarrier, dOthers: r.p.dOthers, maxAbsCarrier: r.p.maxAbsCarrier,
      perChar: Object.fromEntries([...r.p.perChar].map(([k, v]) => [k, v.d / v.n])),
      floor: phaseFloor(r.p)?.range ?? null,
    })), null, 1));
    console.log(`\n   wrote ${args.json}`);
  }
}
