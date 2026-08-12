#!/usr/bin/env node
/**
 * lu2_qafog.mjs — WHAT FRAME DOES A `?fogRadius=` STATION ACTUALLY GET?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `DECISIONS §58` shipped sudden death and recorded one migration: *"any station
 * requesting a fog radius below 661.67 wu now snaps to the sudden-death frame"*, with a
 * console warning, and the fix is *"one number: ask for > 661.67"*. Three stations in
 * this agent's file set were listed for it.
 *
 * 🚨 THAT MIGRATION IS NECESSARY AND IT IS NOT SUFFICIENT, AND THE SECOND HALF HAS NO
 *    WARNING AT ALL. `applyQaSetup` resolves a radius by REWINDING THE MATCH CLOCK:
 *
 *      timeRemaining = MATCH_DURATION_MS x (wantR / maxSafeRadius)
 *
 * and sudden death fires at `timeRemaining <= SUDDEN_DEATH_REMAINING_MS`. On the
 * 2800x2000 map that is 15 000 ms of a 45 000 ms match, so a station asking for 700 wu
 * — legally above the floor, no warning printed — starts the match **869 ms of SIM TIME
 * from the collapse**. Every station that then waits 2.5-5 s at `simSpeed` 1 photographs
 * SUDDEN DEATH: radius 0, the whole arena under the canopy, the HUD reading
 * "SUDDEN DEATH / MOST HP WINS", and quite possibly an ENDED match, because sudden
 * death does 50 HP/s to everyone.
 *
 * The reachable band is (661.67, 1985] wu, which maps to (15 000, 45 000] ms — so the
 * headroom a station buys is `45000 x r / 1985 - 15000` ms of sim, which is 869 ms at
 * 700 wu and 12 204 ms at 1200 wu. **The migration is therefore TWO numbers: a radius
 * above the floor, AND enough clock (a bigger radius, or `simSpeed`) to still be there
 * when the shutter opens.**
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚨 EVERYTHING ABOVE THIS LINE IS THE 45-SECOND CLOCK AND IS KEPT VERBATIM. IT WAS
 *    MEASURED, IT WAS RIGHT, AND `6d5c4d6` REVERSED IT — INCLUDING THE ROW THIS FILE
 *    WAS BUILT AROUND.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Uri's schedule DECOUPLED the ring from the clock: `FOG_HOLD_MS` (25 s) holds the ring at
 * the opening radius, `FOG_CLOSE_MS` (120 s) sweeps it to `minSafeRadiusFor(N)`, and
 * `SUDDEN_DEATH_MS` is `FOG_CLOSE_MS + 15 s` = 135 s of a 150 s match. Three consequences,
 * and the third is why this file still exists:
 *
 *   1. **The snap floor fell 661.67 → 172.05 wu.** `applyQaSetup`'s bound is
 *      `max(minSafeRadiusFor(N), maxR × SUDDEN_DEATH_REMAINING_MS / MATCH_DURATION_MS)`
 *      and both terms moved: maxR is now the half-diagonal (1720.465, not 1985) and the
 *      ratio is 15/150, not 15/45.
 *   2. **The headroom problem is retired.** 700 wu bought 869 ms of sim; it now buys
 *      **46 030 ms**. Every `simSpeed=0.05` this file recommended is now unnecessary —
 *      harmless, but no longer load-bearing, and a comment saying it is load-bearing when
 *      it is not is how the next agent picks the wrong thing to preserve.
 *   3. 🚨 **AND A NEW, WORSE ONE TOOK ITS PLACE: `?fogRadius=` IS NOW A REQUEST THE SIM
 *      DOES NOT HONOUR.** `applyQaSetup` resolves a radius by rewinding the clock —
 *      `timeRemaining = MATCH_DURATION_MS × wantR / maxR` — which is the exact inverse of
 *      the OLD ring formula `maxR × (1 − progress)`. That formula is gone. `sim.ts` now
 *      calls `rules.ts:fogRadiusAt`, which HOLDS for 25 s and then closes on a different
 *      slope, so the clock reading `applyQaSetup` computes lands the ring somewhere else
 *      entirely. It writes `state.safeRadius = wantR` and the very next tick overwrites it.
 *      Measured on the shipped constants at N=2:
 *
 *          asked  400 → the sim holds  221.09   (−178.91)
 *          asked  700 → the sim holds  656.23   (−43.77)
 *          asked  840 → the sim holds  859.29   (+19.29)
 *          asked 1200 → the sim holds 1381.46   (+181.46)
 *          asked 1600 → the sim holds 1720.47   (+120.47 — the FULL OPENING RING, i.e.
 *                                                a ring parked exactly on the four corners
 *                                                and effectively absent from any frame)
 *
 *      **No warning, no error, a plausible ring in every frame.** `hud_accept`'s *fight*
 *      station and `hudshot`'s two *mid* stations ask for 1600 and are photographing an
 *      unfogged arena while their notes say "mid-close ring". This is the same class as
 *      the snap it replaced — a silent substitution of one frame for another — with the
 *      important difference that it is **worse at the top of the band, where the old bug
 *      was harmless**, so "ask for more" (this file's own previous advice) makes it worse.
 *
 * **The fix is one line in `src/game/match.ts`, which this pass does not own:**
 *
 *      this.state.timeRemaining = MATCH_DURATION_MS
 *        - fogReachesRadiusAt(wantR, maxR, minSafeRadiusFor(this.state.fighters.length));
 *
 * `rules.ts:fogReachesRadiusAt` is the exported inverse of `fogRadiusAt` and it exists for
 * exactly this caller — its own doc comment names `applyQaSetup` as one of the two hand
 * inversions it was written to replace. Verified below: it delivers the requested radius to
 * within 1e-9 at every radius in the band, which is what proves the error above belongs to
 * `applyQaSetup` and not to this file's model of it.
 *
 * ── VALIDATION (`CLAUDE.md` §6) ─────────────────────────────────────────────
 * `--selftest` is offline and drives the arithmetic against known inputs. Its constants are
 * IMPORTED from `rules.ts` and derived from the arena dump — nothing here is retyped, which
 * is the whole reason the 45 s model above went stale in silence.
 * ⚠️ The old selftest's load-bearing row was *"700 wu is ABOVE the floor and still lands in
 * sudden death inside a 2.5 s capture"*. It is kept, ASSERTED IN THE OPPOSITE DIRECTION,
 * because a row that reverses is a stronger statement than a row that is deleted.
 *
 * The live run is its own known-bad: it prints the OLD station and the NEW one side by
 * side, and a migration that does not move `phase`/`safeRadius`/`zone` between the two
 * rows has not been shown to fix anything.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/lu2_qafog.mjs
 *   node tools/tmp/lu2_qafog.mjs --selftest
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');

/**
 * The shipped schedule. **IMPORTED, never retyped** — the block above is what retyping it
 * cost. ⚠️ OLD WORDING AND OLD VALUES, kept because they are the bug:
 *
 *   > *"The shipped schedule, from `rules.ts` / `shared.ts`, restated here as the model
 *   > this file predicts with."*
 *   > `const MATCH_DURATION_MS = 45_000;`
 *   > `const SUDDEN_DEATH_REMAINING_MS = 15_000;`
 *   > `const MAX_SAFE_RADIUS = 1985;`
 *
 * Two of those three were wrong within one commit of being written, and `lit_clockguard`
 * §A named this file as its own worked example of the class. The opening radius comes from
 * the arena dump's `width`/`height` because that is the map this tool's stations stand on;
 * `rules.ts:fogOpeningRadiusFor` is the identity function, so the half-diagonal IS the ring.
 */
const R = await import(new URL('../../src/game/rules.ts', import.meta.url).pathname);
const {
  MATCH_DURATION_MS, SUDDEN_DEATH_REMAINING_MS,
  minSafeRadiusFor, fogRadiusAt, fogReachesRadiusAt,
} = R;
const ARENA_DUMP = JSON.parse(readFileSync(new URL('../arena.gameplay.json', import.meta.url), 'utf8'));
const MAX_SAFE_RADIUS = Math.hypot(ARENA_DUMP.width / 2, ARENA_DUMP.height / 2);
/** `?fogRadius=` stations are duels — one player, one AI — so the floor is N=2's. */
const SEATS = 2;
const RING_FLOOR = minSafeRadiusFor(SEATS);
/** `match.ts:applyQaSetup`'s `lowestScheduled`, re-derived rather than quoted. */
const FLOOR = Math.max(RING_FLOOR, MAX_SAFE_RADIUS * (SUDDEN_DEATH_REMAINING_MS / MATCH_DURATION_MS));

/** Milliseconds of SIM time a `?fogRadius=r` station has before sudden death fires.
 *  Negative or zero means the request snaps to the sudden-death frame immediately.
 *  ⚠️ This models `applyQaSetup` AS SHIPPED, including its stale linear inversion — the
 *  point of the file is the gap between that and the schedule, so modelling the correct
 *  thing here would hide it. `deliveredRadius` below is the other half. */
export function headroomMs(r) {
  if (!(r > FLOOR)) return 0;
  return MATCH_DURATION_MS * (Math.min(r, MAX_SAFE_RADIUS) / MAX_SAFE_RADIUS) - SUDDEN_DEATH_REMAINING_MS;
}
/** Does a station survive `settleMs` of WALL clock at `simSpeed`? */
export function survives(r, settleMs, simSpeed = 1) {
  return headroomMs(r) > settleMs * simSpeed;
}
/**
 * The radius the sim ACTUALLY holds for a station that asked for `r` — the number that
 * decides what is in the PNG. `applyQaSetup` sets `timeRemaining` from its own linear
 * inverse; `applyWorldTick` then overwrites `safeRadius` from `fogRadiusAt` on the next
 * tick, and the two no longer agree. Returns 0 for a request that snaps to sudden death.
 */
export function deliveredRadius(r) {
  if (!(r > FLOOR)) return 0;
  const wantR = Math.min(r, MAX_SAFE_RADIUS);
  const playMs = MATCH_DURATION_MS - MATCH_DURATION_MS * (wantR / MAX_SAFE_RADIUS);
  return fogRadiusAt(playMs, MAX_SAFE_RADIUS, RING_FLOOR);
}
/** What `applyQaSetup` would deliver if it used `rules.ts:fogReachesRadiusAt` — the fix. */
export function deliveredIfFixed(r) {
  const wantR = Math.min(Math.max(r, RING_FLOOR), MAX_SAFE_RADIUS);
  return fogRadiusAt(fogReachesRadiusAt(wantR, MAX_SAFE_RADIUS, RING_FLOOR), MAX_SAFE_RADIUS, RING_FLOOR);
}

function selftest() {
  let pass = 0, fail = 0;
  const t = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };
  // ── §0 the source of the constants is real, before anything is asserted over them ──
  t('the arena dump\'s maxSafeRadius IS the half-diagonal (a stale dump would make every row below meaningless)',
    Math.abs(ARENA_DUMP.maxSafeRadius - MAX_SAFE_RADIUS) < 1e-9,
    `${ARENA_DUMP.maxSafeRadius} vs ${MAX_SAFE_RADIUS}`);
  t('the clock and the sudden-death window came from rules.ts, not from this file',
    MATCH_DURATION_MS === R.MATCH_DURATION_MS && SUDDEN_DEATH_REMAINING_MS === R.MATCH_DURATION_MS - R.SUDDEN_DEATH_MS,
    `${MATCH_DURATION_MS} / ${SUDDEN_DEATH_REMAINING_MS}`);

  // ── §1 the snap bound ────────────────────────────────────────────────────────
  // ⚠️ OLD ROW, KEPT: 'the floor is 661.67 wu on the shipped map'. True on the 45 s clock
  //    and on a 1985 wu ring; both moved in `6d5c4d6`. The value is re-derived, not typed.
  t('the snap floor is 172.05 wu — 3.8x LOWER than the 661.67 this file was built around',
    Math.abs(FLOOR - 172.0465) < 0.001, String(FLOOR));
  t('a request AT the floor has no headroom at all', headroomMs(FLOOR) === 0, String(headroomMs(FLOOR)));
  t('a request BELOW the floor has no headroom (it snaps)', headroomMs(100) === 0, String(headroomMs(100)));
  // 🚨 THE REVERSED ROW. Old wording: '700 wu is ABOVE the floor and still only 869 ms of
  //    sim from the collapse' / '...so a 2.5 s capture at simSpeed 1 does NOT survive it'.
  //    Both were the point of the file. Asserted in the opposite direction rather than
  //    deleted, so the reversal itself is pinned and a schedule that undoes it goes red.
  t('REVERSED: 700 wu now buys 46 030 ms of sim, not 869 — the headroom problem is retired',
    Math.round(headroomMs(700)) === 46_030, String(headroomMs(700)));
  t('REVERSED: ...so a 2.5 s capture at simSpeed 1 DOES survive it now', survives(700, 2500) === true);
  t('300 wu — which used to snap outright — is a legal request that survives a 5 s capture',
    300 > FLOOR && survives(300, 5000) === true, String(headroomMs(300)));
  t('the ceiling is clamped to maxSafeRadius, so a huge request is 135 s not more',
    Math.round(headroomMs(99_999)) === MATCH_DURATION_MS - SUDDEN_DEATH_REMAINING_MS, String(headroomMs(99_999)));
  t('headroom is monotone in radius', headroomMs(800) > headroomMs(700));

  // ── §2 DELIVERY — the failure mode that replaced the snap ─────────────────────
  // Every row here is a number a station gets in its PNG while its own note claims another.
  t('DELIVERY: a station asking for 700 wu is shown 656.23',
    Math.abs(deliveredRadius(700) - 656.23) < 0.01, String(deliveredRadius(700)));
  t('DELIVERY: a station asking for 840 wu is shown 859.29 — the error CHANGES SIGN across the band',
    Math.abs(deliveredRadius(840) - 859.29) < 0.01, String(deliveredRadius(840)));
  t('DELIVERY: 1600 wu is shown the FULL OPENING RING (1720.47) — a frame with no ring wall in it',
    Math.abs(deliveredRadius(1600) - MAX_SAFE_RADIUS) < 1e-9, String(deliveredRadius(1600)));
  t('DELIVERY: the worst error in the band is 181.46 wu, at 1200',
    Math.abs(deliveredRadius(1200) - 1200 - 181.46) < 0.01, String(deliveredRadius(1200) - 1200));
  // KNOWN-BAD / CONTROL PAIR. The rows above are only evidence about `applyQaSetup` if the
  // same model, driven through the CORRECT inverse, delivers exactly what was asked. If
  // both were wrong the two would agree and every row above would be about this file.
  t('CONTROL: rules.ts:fogReachesRadiusAt delivers the requested radius EXACTLY at every radius in the band',
    [200, 400, 700, 840, 1200, 1600, 1700].every((r) => Math.abs(deliveredIfFixed(r) - r) < 1e-9),
    [200, 400, 700, 840, 1200, 1600, 1700].map((r) => (deliveredIfFixed(r) - r).toExponential(1)).join(' '));
  t('KNOWN-BAD: ...and the shipped inversion does NOT — the two disagree by up to 181 wu on the same inputs',
    [400, 700, 840, 1200, 1600].some((r) => Math.abs(deliveredRadius(r) - deliveredIfFixed(r)) > 1),
    [400, 700, 840, 1200, 1600].map((r) => (deliveredRadius(r) - r).toFixed(1)).join(' '));
  // KNOWN-BAD for the constants themselves: the pre-6d5c4d6 model, run on today's tree.
  t('KNOWN-BAD: the 45 s / 1985 wu model this file shipped with computes 869 ms for 700 wu, and this one does not',
    Math.round(45_000 * (700 / 1985) - 15_000) === 869 && Math.round(headroomMs(700)) !== 869);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

if (has('--selftest')) selftest();

/**
 * Each row is a station as it is written in a tool today (`old`) and as this pass
 * migrates it (`new`), with the settle that tool actually uses. Printed as a PAIR so
 * the migration has to be shown to move something.
 *
 * 🚨 **THE `neu` COLUMN IS NOW ITSELF A KNOWN-BAD, AND IT IS DELIBERATELY NOT RE-MIGRATED.**
 * Every one of these URLs was chosen to clear the 661.67 snap and to buy sim clock; both
 * constraints are gone, and the radii that best satisfied them are the ones the broken
 * inversion now distorts MOST — `fogRadius=1600` is delivered as the full opening ring.
 * Re-tuning the numbers here would be the third migration of the same table in eight days
 * and would be obsoleted by the one-line `applyQaSetup` fix the header names. **The right
 * order is: fix `match.ts`, then re-read this table, then migrate the four tools once.**
 * Until then the report prints DELIVERED beside REQUESTED so the gap is unmissable.
 */
const STATIONS = [
  { tool: 'hud_fogedge', settle: 2500,
    old: 'fogRadius=300&px=1180&py=820',
    neu: 'fogRadius=700&px=2360&py=1640&simSpeed=0.05' },
  { tool: 'hud_accept fight', settle: 4000,
    old: 'fogRadius=700',
    neu: 'fogRadius=1600' },
  { tool: 'hud_accept danger', settle: 2500,
    old: 'fogRadius=300&px=1180&py=820',
    neu: 'fogRadius=700&px=2360&py=1640&simSpeed=0.05' },
  { tool: 'hudshot mid', settle: 5000,
    old: 'fogRadius=700',
    neu: 'fogRadius=1600' },
  // ⚠️ NOT A MIGRATION, A REPLACEMENT — see the station comment in `hudshot.mjs`. "late"
  // meant a nearly-closed ring and `DECISIONS §2` deleted that state entirely; 1200 wu
  // is the latest frame that still HAS a ring, with the player inside it, held there by
  // `simSpeed` so the two seconds it has left do not elapse inside the capture.
  { tool: 'hudshot late', settle: 5000,
    old: 'fogRadius=260',
    neu: 'fogRadius=1200&simSpeed=0.05' },
  // 🚨 SYNTHETIC, AND IT EXISTS BECAUSE THE FILE LOST ITS OWN SUBJECT ON 2026-08-12.
  // Every `old` row above requested 260-700 wu, which was BELOW the 661.67 snap bound and
  // is ABOVE the 172.05 one — so after `6d5c4d6` not a single station in this table snaps,
  // and the tool that exists to demonstrate the snap stopped demonstrating it. That is the
  // vacuity class in its purest form: nothing failed, the report just quietly became a
  // report about nothing. `lit_clockguard` §E caught it from the other side, as an
  // acknowledgement entry that no longer matched anything.
  // 100 wu is below the live bound and is meant to be: `old` is the snap, `neu` is the
  // smallest request that clears it by a comfortable margin. If a future schedule lifts the
  // bound past 300 again, `lit_clockguard` §C flags this row instead of it going silent.
  { tool: 'THE SNAP (synthetic)', settle: 2500,
    old: 'fogRadius=100',
    neu: 'fogRadius=300' },
  { tool: 'hudshot danger', settle: 3000,
    old: 'fogRadius=300&px=1180&py=820',
    neu: 'fogRadius=700&px=2360&py=1640&simSpeed=0.05' },
];

async function read(browser, q, settle) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const warns = [];
  page.on('console', (m) => { if (m.text().startsWith('[QA]')) warns.push(m.text().slice(0, 120)); });
  await page.goto(`${BASE}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&${q}`,
    { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.waitForTimeout(settle);
  const out = await page.evaluate(() => {
    const d = window.__matchDebug;
    const f = window.__vfxDebugFighters;
    return {
      phase: d?.phase ?? null,
      hp: f?.slots ? f.slots.map((s) => Math.max(0, Math.round(s.hp))) : null,
      zoneLabel: document.querySelector('[data-el="zone-label"]')?.textContent ?? null,
      zoneValue: document.querySelector('[data-el="zone-value"]')?.textContent ?? null,
      edgeOn: !!document.querySelector('.hud-fogedge')?.classList.contains('is-on'),
      // The one number that says which frame this is. `__matchDebug` does not publish
      // it, so it is read off the boundary's own curtain scale — the same handle
      // `mg_fog` uses — rather than inferred from the HUD text.
      fogVisible: (() => {
        const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
        let fog = null; st?.scene.traverse((o) => { if (!fog && o.name === 'fog_boundary') fog = o; });
        return fog ? fog.visible : null;
      })(),
    };
  });
  await page.close();
  return { ...out, warns };
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
console.log(`\nlu2_qafog — ${BASE}`);
console.log(`floor ${FLOOR.toFixed(2)} wu · sudden death at ${SUDDEN_DEATH_REMAINING_MS} ms remaining of ${MATCH_DURATION_MS}`);
console.log(`opening ring ${MAX_SAFE_RADIUS.toFixed(4)} wu · ring floor (N=${SEATS}) ${RING_FLOOR} wu`);
console.log('⚠️ DELIVERED is what the SIM HOLDS one tick after applyQaSetup writes REQUESTED — they no longer agree.\n');
for (const s of STATIONS) {
  for (const [tag, q] of [['OLD', s.old], ['NEW', s.neu]]) {
    const r = await read(browser, q, s.settle);
    const rr = Number(/fogRadius=(\d+)/.exec(q)?.[1] ?? NaN);
    const sp = Number(/simSpeed=([\d.]+)/.exec(q)?.[1] ?? 1);
    const got = deliveredRadius(rr);
    console.log(`  ${s.tool.padEnd(18)} ${tag}  ${q}`);
    console.log(`      predicted headroom ${Math.round(headroomMs(rr))} ms of sim vs ${Math.round(s.settle * sp)} ms spent`
      + `  →  ${survives(rr, s.settle, sp) ? 'survives' : 'SUDDEN DEATH'}`);
    console.log(`      requested ${rr} wu  →  DELIVERED ${got.toFixed(2)} wu  (${got - rr >= 0 ? '+' : ''}${(got - rr).toFixed(2)})`
      + `${Math.abs(got - MAX_SAFE_RADIUS) < 1e-9 ? '  ← the FULL OPENING RING: no ring wall in frame' : ''}`
      + `   ·  correct inversion would give ${deliveredIfFixed(rr).toFixed(2)}`);
    console.log(`      measured  phase=${r.phase}  hp=${JSON.stringify(r.hp)}  zone="${r.zoneLabel} / ${r.zoneValue}"`
      + `  edgeBurn=${r.edgeOn}  fogVisible=${r.fogVisible}`);
    if (r.warns.length) console.log(`      [QA] ${r.warns[0]}`);
  }
  console.log('');
}
await browser.close();
