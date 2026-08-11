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
 * ── VALIDATION (`CLAUDE.md` §6) ─────────────────────────────────────────────
 * `--selftest` is offline and drives the arithmetic against known inputs, including the
 * row that a "just check it is above 661.67" implementation cannot pass: 700 wu is ABOVE
 * the floor and still lands in sudden death inside a 2.5 s capture.
 *
 * The live run is its own known-bad: it prints the OLD station and the NEW one side by
 * side, and a migration that does not move `phase`/`safeRadius`/`zone` between the two
 * rows has not been shown to fix anything.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/lu2_qafog.mjs
 *   node tools/tmp/lu2_qafog.mjs --selftest
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');

/** The shipped schedule, from `rules.ts` / `shared.ts`, restated here as the model this
 *  file predicts with. Asserted against the live sim by every row of the live run. */
const MATCH_DURATION_MS = 45_000;
const SUDDEN_DEATH_REMAINING_MS = 15_000;
const MAX_SAFE_RADIUS = 1985;
const FLOOR = MAX_SAFE_RADIUS * (SUDDEN_DEATH_REMAINING_MS / MATCH_DURATION_MS); // 661.67

/** Milliseconds of SIM time a `?fogRadius=r` station has before sudden death fires.
 *  Negative or zero means the request snaps to the sudden-death frame immediately. */
export function headroomMs(r) {
  if (!(r > FLOOR)) return 0;
  return MATCH_DURATION_MS * (Math.min(r, MAX_SAFE_RADIUS) / MAX_SAFE_RADIUS) - SUDDEN_DEATH_REMAINING_MS;
}
/** Does a station survive `settleMs` of WALL clock at `simSpeed`? */
export function survives(r, settleMs, simSpeed = 1) {
  return headroomMs(r) > settleMs * simSpeed;
}

function selftest() {
  let pass = 0, fail = 0;
  const t = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };
  t('the floor is 661.67 wu on the shipped map', Math.abs(FLOOR - 661.666) < 0.01, String(FLOOR));
  t('a request AT the floor has no headroom at all', headroomMs(FLOOR) === 0, String(headroomMs(FLOOR)));
  t('a request BELOW the floor has no headroom (it snaps)', headroomMs(300) === 0, String(headroomMs(300)));
  // 🚨 THE ROW A "> 661.67 IS ENOUGH" IMPLEMENTATION CANNOT PASS.
  t('700 wu is ABOVE the floor and still only 869 ms of sim from the collapse',
    700 > FLOOR && Math.round(headroomMs(700)) === 869, String(headroomMs(700)));
  t('...so a 2.5 s capture at simSpeed 1 does NOT survive it', survives(700, 2500) === false);
  t('...and the SAME station at simSpeed 0.05 does', survives(700, 2500, 0.05) === true);
  t('1200 wu survives a 5 s capture at full speed on its radius alone',
    survives(1200, 5000) === true, String(headroomMs(1200)));
  t('the ceiling is clamped to maxSafeRadius, so a huge request is 30 s not more',
    Math.round(headroomMs(99_999)) === 30_000, String(headroomMs(99_999)));
  t('headroom is monotone in radius', headroomMs(800) > headroomMs(700));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

if (has('--selftest')) selftest();

/**
 * Each row is a station as it is written in a tool today (`old`) and as this pass
 * migrates it (`new`), with the settle that tool actually uses. Printed as a PAIR so
 * the migration has to be shown to move something.
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
console.log(`floor ${FLOOR.toFixed(2)} wu · sudden death at ${SUDDEN_DEATH_REMAINING_MS} ms remaining of ${MATCH_DURATION_MS}\n`);
for (const s of STATIONS) {
  for (const [tag, q] of [['OLD', s.old], ['NEW', s.neu]]) {
    const r = await read(browser, q, s.settle);
    const rr = Number(/fogRadius=(\d+)/.exec(q)?.[1] ?? NaN);
    const sp = Number(/simSpeed=([\d.]+)/.exec(q)?.[1] ?? 1);
    console.log(`  ${s.tool.padEnd(18)} ${tag}  ${q}`);
    console.log(`      predicted headroom ${Math.round(headroomMs(rr))} ms of sim vs ${Math.round(s.settle * sp)} ms spent`
      + `  →  ${survives(rr, s.settle, sp) ? 'survives' : 'SUDDEN DEATH'}`);
    console.log(`      measured  phase=${r.phase}  hp=${JSON.stringify(r.hp)}  zone="${r.zoneLabel} / ${r.zoneValue}"`
      + `  edgeBurn=${r.edgeOn}  fogVisible=${r.fogVisible}`);
    if (r.warns.length) console.log(`      [QA] ${r.warns[0]}`);
  }
  console.log('');
}
await browser.close();
