#!/usr/bin/env node
/**
 * WHY ARE THE THREE FOG STATIONS THE ONLY ONES THAT MOVE WHEN NOTHING IS TOUCHED?
 *
 * ── The finding this exists to explain ──────────────────────────────────────────
 * `tools/tmp/gl_occl_ab.mjs` REFUSED outright at `arena-scan`'s `fog_inside` station:
 * its SELF-PAIR control — two captures, nothing touched, `requestAnimationFrame`
 * already stubbed — differed by **110,963 .. 472,512 px of 1,440,000**, i.e. up to 33%
 * of the frame, against **0 px** at `pot_south` in the same run (recorded in 1a5b808).
 *
 * A station whose self-pair is a third of the frame cannot support ANY pixel claim: an
 * instrument that cannot tell "no change" from "cannot see change" makes every null
 * result on it worthless. Three of `arena-scan`'s eighteen stations are in that state.
 *
 * ── The hypothesis, and why "freeze rAF" was never going to be enough ───────────
 * `docs/LESSONS.md`'s standing warning is *"freezing the clock is not freezing the
 * loop"*. This is the NEXT one out: **freezing the loop is not freezing the PAGE.**
 *
 *   1. Playwright's `locator('canvas').screenshot()` is a PAGE screenshot clipped to the
 *      canvas box — `arena-scan.mjs` itself records that the DOM HUD lands in it and is
 *      13.4% of the frame. So anything the HUD paints over the canvas is in every
 *      "canvas" capture every WebGL probe here has ever taken.
 *   2. `src/ui/hud.ts` runs SEVEN `infinite` CSS animations, and the ones that arm in
 *      the death zone are the big ones: `hud-fogedge-breathe` (a screen-EDGE wash),
 *      `hud-zone-alarm`, `hud-safearrow-throb`, `hud-lowhp-pulse`.
 *   3. **CSS animations are driven by the document timeline, not by
 *      `window.requestAnimationFrame`.** Stubbing rAF stops the game and does not touch
 *      them. They keep running, on the compositor, at full rate, forever.
 *
 * That predicts exactly the observed signature: still at `pot_south` (nothing armed),
 * violently unstill at the fog stations (the whole alarm set armed), and a self-pair
 * that varies run to run because it samples a 0.6-1.2 s sine at an arbitrary phase.
 *
 * ── What this probe MEASURES rather than assumes ────────────────────────────────
 * Per station, one page load, in this order:
 *
 *   A  rAF frozen only          4 captures, adjacent diffs  <- reproduces the refusal
 *   B  rAF frozen + CSS stilled 4 captures, adjacent diffs  <- the fix, or not
 *   C  HUD hidden, rAF frozen   4 captures, adjacent diffs  <- ATTRIBUTION: if C is
 *                                  still while A is not, the mover is in the DOM and
 *                                  not in WebGL. If C still moves, it is the fog ring.
 *
 * plus page-side, never inferred:
 *   - `document.getAnimations()` — how many are RUNNING, and their keyframe names.
 *   - a rAF turn counter installed BEFORE the freeze, read after, to prove the freeze
 *     actually held (a "still" result from a probe whose freeze failed is a lie).
 *
 * ⚠️ CONTROLS, because this tool exists to police other tools' controls:
 *   - `pot_south` and `spawn_west` are carried as KNOWN-STILL stations. If they are not
 *     0 px in arm A, the harness is broken and no fog number below means anything.
 *   - The CSS still is APPLIED AND THEN VERIFIED by re-reading `getAnimations()`: a
 *     stylesheet that did not take is indistinguishable from a page that was already
 *     still, which is the tautological-guard trap.
 *   - Every diff writes its mask PNG. LOOK AT THEM — a diff concentrated in a ring
 *     around the frame edge is the fog vignette; one in the middle is not.
 *
 * Usage (pin the tree — see tools/tmp/headserve.mjs's header):
 *   node tools/tmp/headserve.mjs --ref <sha> -- node tools/tmp/sc_fogstill.mjs
 *   node tools/tmp/sc_fogstill.mjs --url <snapshot> --out shots/sc/fogstill
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') === false ? all[i + 1] : true] : []).filter((x) => x.length));

const BASE = args.url ?? process.env.PREVIEW_BASE ?? null;
if (!BASE) { console.error('sc_fogstill: need --url or PREVIEW_BASE (run under headserve.mjs).'); process.exit(2); }
const OUT = resolve(args.out ?? 'shots/sc/fogstill');
const W = Number(args.w ?? 1600), H = Number(args.h ?? 900);
const SHOTS = Number(args.shots ?? 4);
const GAP_MS = Number(args.gap ?? 220);
const SIM_SPEED = args['sim-speed'] ?? '0.02';
// ⚠️ WAS `const MAX_SAFE_RADIUS = 993;   // mirrors arena-scan.mjs`. **993 is the 1× map's
// value under the current 45 s clock** — `shared.ts` derives it as `860.23 / (1 − 6/45)`,
// and 860.23 is the 1400×1000 half-diagonal. The mirror stopped mirroring at `6631446`;
// arena-scan.mjs:392 has said 1985 since. Verified against `tools/arena.gameplay.json`.
const MAX_SAFE_RADIUS = 1985;  // mirrors arena-scan.mjs:392 and the dump's maxSafeRadius

/** The three fog stations, plus two `arena-scan` stations that are KNOWN STILL.
 *  Coordinates copied from `tools/arena-scan.mjs`'s STATIONS — same frames, so the
 *  numbers here are about the same samples the colour baseline is built from. */
/**
 * ⚠️ RE-AIMED FOR THE ×4 MAP AND FOR SUDDEN DEATH, 2026-08-11. WAS:
 *   { id: 'pot_south',    x: 700,  y: 640, fog: MAX_SAFE_RADIUS, expect: 'still' },
 *   { id: 'spawn_west',   x: 160,  y: 390, fog: MAX_SAFE_RADIUS, expect: 'still' },
 *   { id: 'fog_boundary', x: 1090, y: 500, fog: 420, expect: 'fog' },
 *   { id: 'fog_inside',   x: 1240, y: 500, fog: 420, expect: 'fog' },
 *   { id: 'fog_late',     x: 700,  y: 340, fog: 200, expect: 'fog' },
 *
 * TWO independent invalidations, both silent:
 *   1. `6631446` doubled the map; every coordinate above is a 1× one, all five landed in
 *      the NW quadrant, and `pot_south` (700,640) is inside a `prep_counter`.
 *   2. `DECISIONS §2` abolishes the ring at 30 s, so `match.ts:applyQaSetup` SNAPS any
 *      `fogRadius` at or below **661.67 wu** to sudden death — a full-arena violet wash.
 *      The three `expect: 'fog'` rows asked for 420/420/200, so **all three were
 *      photographing the same sudden-death frame**, not three points on a ring. This
 *      file's whole subject is whether those frames are STILL; it was measuring a frame
 *      the schedule cannot produce.
 * Coordinates and radii below are `tools/arena-scan.mjs`'s current fog stations.
 */
const STATIONS = [
  { id: 'pot_south',    x: 1400, y: 1200, fog: MAX_SAFE_RADIUS, expect: 'still' },
  { id: 'spawn_west',   x: 300,  y: 810,  fog: MAX_SAFE_RADIUS, expect: 'still' },
  { id: 'fog_boundary', x: 2210, y: 1000, fog: 840, expect: 'fog' },
  { id: 'fog_inside',   x: 2360, y: 1000, fog: 840, expect: 'fog' },
  { id: 'fog_late',     x: 740,  y: 1000, fog: 700, expect: 'fog' },
];

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Installed BEFORE anything else runs, so the counter is honest about the whole page
 *  life rather than about the window after our first `evaluate` (which, per
 *  docs/AGENT-BRIEF.md §3, is itself an intervention). */
const RAF_COUNTER = () => {
  const w = /** @type {any} */ (window);
  w.__scRaf = 0;
  const real = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = (cb) => real((t) => { w.__scRaf++; return cb(t); });
};

/**
 * ── THE THREE-LINE FIX, EXPORTED SO IT CAN BE REUSED RATHER THAN RE-DERIVED ──────
 *
 * Stop the compositor-driven half of the page. **Any probe here that stubs
 * `requestAnimationFrame` and then compares two canvas captures needs this too**, or its
 * self-pair is measuring `src/ui/hud.ts`'s CSS keyframes. Measured 2026-08-11: with this
 * applied, all three fog stations go from 13,073 / 471,742 / 13,173 differing px to
 * **0 px**, while the frame is otherwise untouched.
 *
 *   import { PAGE_STILL_HUD } from './sc_fogstill.mjs';
 *   await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
 *   await page.evaluate(PAGE_STILL_HUD);          // <- and then verify, below
 *   const running = (await page.evaluate(() => document.getAnimations()
 *     .filter((a) => a.playState === 'running').length));   // must be 0
 *
 * ⚠️ VERIFY IT TOOK. A stylesheet that failed to apply is indistinguishable from a page
 * that was already still — the tautological-guard trap. Re-read `getAnimations()`.
 *
 * ⚠️ AND IT CHANGES THE PIXELS IT FREEZES. Seeking to `currentTime = 0` is deterministic
 * (which is the point) but it is a BIASED sample of a keyframe cycle, not the mean one.
 * That is right for a pixel-identity A/B, where every arm gets the same bias and it
 * cancels; it is wrong for a colour/appearance measurement, where a random phase is at
 * least unbiased. `arena-scan.mjs` therefore leaves it OFF by default and offers it as
 * `--still-hud` for the identity case only.
 *
 * Two mechanisms on purpose: the stylesheet catches animations that have not started yet
 * (a class added later), the Web Animations pass catches the ones already running.
 */
export const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'sc-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;' +
                  'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().length;
};

const ANIM_STATE = () => {
  const all = document.getAnimations();
  const running = all.filter((a) => a.playState === 'running');
  const name = (a) => (a.animationName ?? a.constructor?.name ?? '?');
  const tally = {};
  for (const a of running) tally[name(a)] = (tally[name(a)] ?? 0) + 1;
  return { total: all.length, running: running.length, tally };
};

async function diff(a, b, maskPath) {
  const [A, B] = await Promise.all([a, b].map((p) => sharp(p).raw().toBuffer({ resolveWithObject: true })));
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { px: -1, sum: 0, max: 0 };
  const ch = A.info.channels, n = A.info.width * A.info.height;
  let px = 0, sum = 0, max = 0;
  const mask = maskPath ? Buffer.alloc(n) : null;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.data[i * ch + c] - B.data[i * ch + c]));
    if (d > 0) { px++; sum += d; if (d > max) max = d; if (mask) mask[i] = Math.min(255, d * 8); }
  }
  if (mask) await sharp(mask, { raw: { width: A.info.width, height: A.info.height, channels: 1 } }).png().toFile(maskPath);
  return { px, sum, max };
}

const worst = (rows) => rows.reduce((m, r) => (r.px > m.px ? r : m), { px: 0, sum: 0, max: 0 });

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const report = [];
  console.log(`sc_fogstill · base ${BASE} · ${W}x${H} · ${SHOTS} captures/arm, ${GAP_MS}ms apart\n`);

  try {
    for (const s of STATIONS) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      await page.addInitScript(RAF_COUNTER);
      const url = `${BASE}/?player=hamburger&enemy=donut&px=${s.x}&py=${s.y}` +
                  `&fogRadius=${s.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
      await page.waitForTimeout(1500);

      const anims = await page.evaluate(ANIM_STATE);
      const canvas = page.locator('canvas').first();
      const burst = async (tag) => {
        const paths = [];
        for (let i = 0; i < SHOTS; i++) {
          const p = join(OUT, `${s.id}_${tag}_${i}.png`);
          await canvas.screenshot({ path: p, timeout: 90000 });
          paths.push(p);
          if (i < SHOTS - 1) await page.waitForTimeout(GAP_MS);
        }
        const rows = [];
        for (let i = 1; i < paths.length; i++) {
          rows.push(await diff(paths[0], paths[i], i === 1 ? join(OUT, `${s.id}_${tag}_mask.png`) : null));
        }
        return rows;
      };

      // ── ARM A: exactly what gl_occl_ab does. rAF stubbed, nothing else.
      const rafBefore = await page.evaluate(() => window.__scRaf);
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      await page.waitForTimeout(400);
      const rafAfterFreeze = await page.evaluate(() => window.__scRaf);
      const A = await burst('A_raf');
      const rafAfterA = await page.evaluate(() => window.__scRaf);

      // ── ARM B: + CSS stilled. Verified by re-reading getAnimations(), because a
      //    stylesheet that silently did not apply looks exactly like a still page.
      const nAnims = await page.evaluate(PAGE_STILL_HUD);
      await page.waitForTimeout(300);
      const animsAfter = await page.evaluate(ANIM_STATE);
      const B = await burst('B_css');

      // ── ARM C: attribution. HUD hidden (arena-scan's own selectors), CSS un-stilled
      //    again so this arm isolates WebGL rather than inheriting arm B's fix.
      await page.evaluate(() => {
        document.getElementById('sc-still')?.remove();
        for (const a of document.getAnimations()) { try { a.play(); } catch { /* finished */ } }
        for (const e of document.querySelectorAll('.hud-root, #screens')) e.style.visibility = 'hidden';
      });
      await page.waitForTimeout(400);
      const C = await burst('C_nohud');
      const rafEnd = await page.evaluate(() => window.__scRaf);
      await page.close();

      const row = {
        id: s.id, expect: s.expect,
        anims, animsAfterStill: animsAfter,
        rafTurns: { atFreeze: rafAfterFreeze - rafBefore, duringA: rafAfterA - rafAfterFreeze, total: rafEnd },
        A: worst(A), B: worst(B), C: worst(C), stillDeclared: nAnims,
      };
      report.push(row);
      const f = (d) => `${String(d.px).padStart(7)}px sum ${String(d.sum).padStart(9)} max ${String(d.max).padStart(3)}`;
      console.log(`${s.id.padEnd(13)} anims run=${String(row.anims.running).padStart(2)}/${String(row.anims.total).padStart(2)}  rAF after freeze +${row.rafTurns.duringA}`);
      console.log(`  A rAF frozen        ${f(row.A)}`);
      console.log(`  B + CSS stilled     ${f(row.B)}   (getAnimations running ${animsAfter.running})`);
      console.log(`  C HUD hidden        ${f(row.C)}`);
      if (Object.keys(row.anims.tally).length) console.log(`  running: ${Object.entries(row.anims.tally).map(([k, v]) => `${k}x${v}`).join(' ')}`);
      console.log('');
    }
  } finally {
    await browser.close();
  }

  await writeFile(join(OUT, 'fogstill.json'), JSON.stringify({ base: BASE, viewport: [W, H], shots: SHOTS, gapMs: GAP_MS, sha: process.env.HEADSERVE_SHA ?? null, report }, null, 2));

  // ── VERDICT. The control comes first: if the known-still stations are not still,
  //    the harness is broken and nothing about the fog stations may be quoted.
  console.log('── verdict ──');
  const ctl = report.filter((r) => r.expect === 'still');
  const ctlBad = ctl.filter((r) => r.A.px !== 0);
  if (ctlBad.length) {
    console.log(`  ✗ HARNESS BROKEN: ${ctlBad.map((r) => `${r.id} ${r.A.px}px`).join(', ')} moved in arm A.`);
    console.log('    These stations arm no HUD alarm and are 0px for every other probe here.');
    console.log('    Every fog number above is uninterpretable until this is 0. NOT reporting a cause.');
    process.exit(1);
  }
  console.log(`  ✓ control: ${ctl.map((r) => r.id).join(', ')} are 0 px under arm A — the harness can see "no change".`);
  // ⚠️ Reported per station and NOT collapsed to a tick. Measured 2026-08-11: every
  // station drained 0 turns except `fog_boundary`, which took exactly ONE during arm A.
  // That is a real leak — `window.requestAnimationFrame = () => 0` cannot stop a
  // callback some module captured by reference before the stub landed — and it is also
  // demonstrably not the cause of anything here, because arm C (HUD hidden, rAF stubbed
  // the same way) is 0 px at that station. Stating both beats hiding either: a probe
  // that prints ✓ for "close enough" is how a broken freeze survives.
  const leaky = report.filter((r) => r.rafTurns.duringA !== 0);
  if (!leaky.length) console.log('  ✓ the rAF freeze held on every station — 0 further turns during arm A.');
  else {
    console.log(`  ⚠ the rAF freeze LEAKED at ${leaky.map((r) => `${r.id} (+${r.rafTurns.duringA})`).join(', ')}.`);
    console.log('    A stubbed global cannot stop a callback captured by reference before the stub.');
    const contaminated = leaky.filter((r) => r.C.px !== 0);
    console.log(contaminated.length
      ? `    AND arm C is non-zero there (${contaminated.map((r) => `${r.id} ${r.C.px}px`).join(', ')}) — the leak MAY be delivering pixels. Do not attribute.`
      : '    Arm C (HUD hidden, same stub) is 0 px at every leaky station, so the leak delivered no pixels here.');
  }
  const fog = report.filter((r) => r.expect === 'fog');
  for (const r of fog) {
    const cssShare = r.A.px ? (1 - r.B.px / r.A.px) : 0;
    console.log(`  ${r.id}: rAF-frozen ${r.A.px}px -> CSS-stilled ${r.B.px}px (${(cssShare * 100).toFixed(1)}% of it was CSS)` +
      `, HUD-hidden ${r.C.px}px`);
  }
  const allCss = fog.every((r) => r.B.px === 0);
  console.log(allCss
    ? '\n  CAUSE: compositor-driven CSS animation in the DOM HUD, not WebGL. Stilling it makes\n'
      + '  every fog station bit-identical, so they can be made comparable rather than banned.'
    : '\n  ⚠ CSS stilling did NOT reach 0 on every fog station — a WebGL-side mover remains.\n'
      + '  Read arm C: if C is also non-zero the residue is in the scene (fogRing runs on\n'
      + '  `this.clock.elapsedTime`, a WALL clock, unlike everything else in match.ts).');
  console.log(`\nwrote ${join(OUT, 'fogstill.json')} + ${SHOTS * 3 * STATIONS.length} frames and their masks`);
  return 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
