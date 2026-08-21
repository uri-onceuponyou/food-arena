#!/usr/bin/env node
/**
 * SPECTATOR CAMERA — what the SHIPPED RENDER does when you die at six seats.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-sv -- \
 *     node tools/tmp/sv_shot.mjs --url '{URL}' --out tools/tmp/sv_out/after --tag after
 *
 * ⚠️ NEVER `:5173`, and for an A/B you will quote, NEVER the working tree either — a peer
 * is live in `src/game/*.ts` while this runs. Both arms are snapshots of DETACHED
 * WORKTREES of real commits (`CLAUDE.md` rule 2 / `docs/AGENT-BRIEF.md` §3).
 *
 * `sv_subject.mjs` proves the POLICY is right and `sv_bitid.mjs` proves it cannot reach
 * the sim. Neither of them renders a pixel, and "it isn't there" has meant "it is there
 * and invisible" twenty times in this repo. This is the arm that actually plays a
 * six-seat match, lets the local seat die, and asks the frame what happened.
 *
 * ── THE OBSERVABLE, AND THE ONE THIS FILE ASKED FOR FIRST AND GOT WRONG ────────
 *
 * `CameraRig.desired` is exactly what `follow()` was last handed — the SUBJECT'S ground
 * position in metres. Sampled at the frame the local seat dies (when it is by definition
 * the corpse) and again three seconds later:
 *
 *     unchanged, bit-zero  →  the camera is pinned to the corpse — the defect
 *     moved                →  the camera is following somebody else
 *
 * Read straight off the rig, so the quantity is EXACT and carries no resolution floor:
 * a pinned build calls `follow()` with a frozen argument every frame, so its delta is
 * zero rather than small. It is a PAIRED within-arm delta, so it needs no cross-arm
 * baseline and no matching RNG.
 *
 * ⚠️ THE FIRST VERSION ASSERTED *"the corpse is off screen"* AND WENT RED ON A WORKING
 * BUILD. `__vfxDebugScreen.slots[0]` was still non-null because the killer was 70 wu away,
 * so the hand-off was a GLIDE and the corpse stayed legitimately in frame. **"The camera
 * left the corpse" and "the corpse is off screen" are different statements and only the
 * first one is the defect.** Kept here because the failure looked exactly like a broken
 * fix, which is the expensive direction for a wrong assertion to fail in.
 *
 * The PNGs are for rule 3 — they are read and looked at, not scored.
 *
 * ── CAMERAS ────────────────────────────────────────────────────────────────────
 *
 * The MATCH rig only (`CameraRig`'s constructor, `pitchDeg ?? 58`). The lobby rig
 * (`charStage.ts`, `pitchDeg: 20`) is **structurally incapable of expressing this
 * defect** and that is a statement, not a shortcut: `charStage` is the character-select
 * screen. It has no `MatchState`, no second fighter, no death event and no `CameraRig`
 * following anything — there is nothing for a spectator camera to be wrong about. Rule 3
 * exists because a limb through a torso is a 3D fact wrong at every angle; "which fighter
 * is the camera following" is not a geometry question and has exactly one shipped camera.
 *
 * ── ARMS ───────────────────────────────────────────────────────────────────────
 *
 *   1  BOOT + DIE — `?seats=6` through the product path, and the local seat's HP pill
 *      watched down to 0. Non-vacuity: six plates must exist and the local seat must
 *      actually die, or every row below is about a match that never happened.
 *   2  AFTER THE DWELL — the observable above, plus `__matchDebug.viewSubject` /
 *      `viewReason` when the build publishes them (the BEFORE arm does not).
 *   3  DRIFT CONTROL — rAF held (not dropped), the shake explicitly zeroed, and
 *      `stage.render(0)` run twice inside ONE synchronous evaluate with `toDataURL()`
 *      between. The two must be **byte-identical, exactly**. Its own known-bad nudges the
 *      rig 1 m between renders and requires them to DIFFER — otherwise "they matched"
 *      would also be true of a comparison that cannot see anything.
 *      🚨 The shake zeroing is not optional: `189d6ed` drifted on 344 of 344 frozen
 *      frames because `CameraRig.update` re-randomised the offset at `dt = 0`. That is
 *      fixed in the integrator now, and this stills it anyway — a probe that depends on
 *      someone else's fix staying fixed is a probe that will lie one day.
 *   4  PNGs — alive / at death / after the hand-off, written for a human to read.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const OUT = resolve(flag('out') ?? 'tools/tmp/sv_out');
const TAG = flag('tag') ?? 'run';

if (!BASE || /:5173(\/|$)/.test(BASE)) {
  console.error('sv_shot: --url (or PREVIEW_BASE) is required and must be a SNAPSHOT, never :5173.');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}${detail ? ` · ${detail}` : ''}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? ` · ${detail}` : ''}`); }
  return ok;
};

/**
 * Reads the shipped HUD + projection surfaces. No mutation, so it cannot perturb what it
 * measures.
 *
 * 🚨 `rig.desired` IS THE HEADLINE, AND THE FIRST VERSION OF THIS FILE ASKED THE WRONG
 * QUESTION. It asserted *"the corpse is off screen"* and went RED on a build where the
 * fix was working perfectly: the killer was 70 wu away, so the hand-off was a GLIDE and
 * the corpse stayed legitimately in frame. "The camera left the corpse" and "the corpse
 * is off screen" are not the same statement, and only the first one is the defect.
 *
 * `rig.desired` is exactly what `follow()` was last called with — the SUBJECT'S ground
 * position in metres — so:
 *
 *     desired unchanged from the moment of death   ->  pinned to the corpse (the defect)
 *     desired moved                                ->  the camera is following someone else
 *
 * It is read straight off the rig, so the quantity is EXACT and needs no resolution floor:
 * on a pinned build `follow()` is called with a frozen argument every frame and the delta
 * is bit-zero, not small. The threshold below is `CHARACTER_RADIUS` out of `units.ts`
 * doubled — a character's own width — so "moved off the body" is literal rather than
 * tuned, and it is imported rather than typed.
 */
const PAGE_READ = async () => {
  const units = await import('/src/units.ts');
  const rig = window.__stage?.rig;
  const toWU = (v) => (v ? { x: v.x / units.WORLD_SCALE, y: v.z / units.WORLD_SCALE } : null);
  const txt = (sel) => document.querySelector(sel)?.textContent ?? null;
  const hpOf = (key) => {
    const t = txt(`[data-el="${key}-hp"]`);
    if (!t) return null;
    const m = t.match(/(-?\d+)/);
    return m ? Number(m[1]) : null;
  };
  const keys = ['player', 'enemy', 'slot2', 'slot3', 'slot4', 'slot5'];
  const s = window.__vfxDebugScreen ?? {};
  const d = window.__matchDebug ?? {};
  return {
    plates: document.querySelectorAll('.hud-healthbar').length,
    hp: keys.map(hpOf),
    slots: (s.slots ?? []).map((p) => (p ? { x: Math.round(p.x), y: Math.round(p.y) } : null)),
    // WHAT `follow()` WAS LAST HANDED, and where the lerp has got to. Both in world units.
    desiredWU: toWU(rig?.desired),
    targetWU: toWU(rig?.target),
    bodyRadiusWU: (units.CHARACTER_RADIUS / units.WORLD_SCALE) * 2,
    phase: d.phase ?? null,
    frames: d.frames ?? 0,
    // Present only on the fixed build. `undefined` is a legitimate BEFORE-arm reading.
    viewSubject: d.viewSubject,
    viewReason: d.viewReason,
    gameover: !!document.querySelector('[data-el="gameover"]')?.classList.contains('is-on'),
  };
};

/** Hold rAF rather than drop it, so the loop resumes instead of dying. `pj_probe.mjs`'s
 * recipe, re-derived here rather than imported (that file exports nothing and has no
 * IS_MAIN guard — importing it would run its CLI). */
const PAGE_INSTALL_RAF = () => {
  const rafReal = window.requestAnimationFrame.bind(window);
  let held = null;
  window.requestAnimationFrame = (cb) => {
    if (held !== null) { held = cb; return -1; }
    return rafReal(cb);
  };
  window.__svRaf = {
    stop() { if (held === null) held = false; },
    start() { const cb = held; held = null; if (typeof cb === 'function') rafReal(cb); },
    stopped() { return held !== null; },
  };
};

/** ONE synchronous evaluate: still, render, read, render, read. Nothing runs between the
 * two renders, which is the only way "identical" means anything. */
const PAGE_DRIFT = () => {
  const stage = window.__stage;
  if (!stage || !stage.rig || !stage.canvas) return { ok: false, why: 'no window.__stage' };
  const still = () => {
    const rig = stage.rig;
    rig.shakeAmount = 0;
    if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
  };
  const shot = () => { still(); stage.render(0); return stage.canvas.toDataURL(); };
  shot();                       // warm-up: the first render after a freeze is not the second
  const a = shot();
  const b = shot();
  // KNOWN-BAD, in the same evaluate so nothing else can explain it: move the look-at by
  // one metre and render again. If this ALSO matches, the comparison is blind.
  stage.rig.target.x += 1;
  const c = shot();
  stage.rig.target.x -= 1;
  return {
    ok: true,
    same: a === b,
    kbDiffers: c !== a,
    bytes: a.length,
    blank: a.length < 5000,     // a black/empty buffer compresses to almost nothing
  };
};

const still = (page) => page.addStyleTag({
  content: '*,*::before,*::after{animation:none!important;transition:none!important}',
}).catch(() => {});

async function main() {
  console.log(`sv_shot [${TAG}] — a six-seat match, played until the local seat dies`);
  console.log(`  base ${BASE}`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // A peer's save must not reload the page mid-run; the snapshot freezes the tree and
  // this closes the HMR socket as well.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
      + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
      + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
      + 'export const ErrorOverlay=class{};export default {};',
  }));

  // `?seats=6` is the PRODUCT path (`brawl.ts:seatsFromParams`), not the `?fighters=` QA
  // transport — this is the build Uri played. `simSpeed` only compresses wall-clock.
  const url = `${BASE}/?seats=6&simSpeed=6&pointerLock=0`;
  await page.addInitScript(PAGE_INSTALL_RAF);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  await still(page);

  const boot = await page.evaluate(PAGE_READ);
  check('1a the match under test really has SIX seats', boot.plates === 6, `${boot.plates} plates`);
  check('1b the local seat starts alive', (boot.hp[0] ?? 0) > 0, `player hp ${boot.hp[0]}`);
  await page.screenshot({ path: `${OUT}/${TAG}-1-alive.png` });

  // ── wait for the local seat to die ──────────────────────────────────────────
  const t0 = Date.now();
  let died = false;
  let atDeath = null;
  while (Date.now() - t0 < 180_000) {
    const r = await page.evaluate(PAGE_READ);
    if (r.gameover) { atDeath = r; break; }
    if ((r.hp[0] ?? 1) <= 0) { died = true; atDeath = r; break; }
    await page.waitForTimeout(150);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  // 🚨 NON-VACUITY. Everything below is about a corpse; without one there is nothing to
  // measure and a green row would be a lie.
  if (!check('1c the local seat DIED while the match was still playing', died && !atDeath?.gameover,
    died ? `after ${elapsed}s, phase ${atDeath?.phase}` : `no death in ${elapsed}s (gameover=${atDeath?.gameover})`)) {
    await page.screenshot({ path: `${OUT}/${TAG}-FAIL-nodeath.png` });
    await browser.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(1);
  }
  await page.screenshot({ path: `${OUT}/${TAG}-2-death.png` });
  console.log(`    at death: slots=${JSON.stringify(atDeath.slots)} viewSubject=${atDeath.viewSubject} viewReason=${atDeath.viewReason}`);

  // ── past the dwell (1.35 s of match time; simSpeed 6 makes that ~225 ms of wall) ──
  await page.waitForTimeout(3000);
  const after = await page.evaluate(PAGE_READ);
  await page.screenshot({ path: `${OUT}/${TAG}-3-after.png` });

  const livingOnScreen = after.slots.filter((p, i) => i !== 0 && p).length;
  const stillPlaying = after.phase === 'playing' && !after.gameover;

  // THE HEADLINE. `desired` at the moment of death IS the corpse's ground position — the
  // camera was following the local seat right up to that frame. A paired, within-arm
  // delta on one run: no cross-arm baseline, no RNG to match, and exact by construction.
  const d0 = atDeath.desiredWU;
  const d1 = after.desiredWU;
  const moved = d0 && d1 ? Math.hypot(d1.x - d0.x, d1.y - d0.y) : null;
  const bodyWU = after.bodyRadiusWU ?? 21;

  console.log(`    3 s later: phase=${after.phase} slots=${JSON.stringify(after.slots)}`);
  console.log(`               viewSubject=${after.viewSubject} viewReason=${after.viewReason} hp=${JSON.stringify(after.hp)}`);
  console.log(`    follow target: at death (${d0?.x.toFixed(2)}, ${d0?.y.toFixed(2)}) -> now (${d1?.x.toFixed(2)}, ${d1?.y.toFixed(2)})`);
  console.log(`                   MOVED ${moved === null ? 'n/a' : moved.toFixed(2)} wu · body width ${bodyWU.toFixed(2)} wu`);

  check('2a the match is STILL PLAYING three seconds after the local death',
    stillPlaying, `phase ${after.phase}, gameover ${after.gameover}`);
  // Non-vacuity: a null read would make any comparison pass.
  check('2b0 the rig was readable in both samples', d0 !== null && d1 !== null);
  check('2b THE CAMERA HAS LEFT THE CORPSE — the follow target moved off the body',
    moved !== null && moved > bodyWU,
    `${moved === null ? 'n/a' : moved.toFixed(2)} wu vs a ${bodyWU.toFixed(2)} wu body — PINNED reads exactly 0.00`);
  check('2c …and it is watching somebody — at least one OTHER fighter is on screen',
    livingOnScreen > 0, `${livingOnScreen} non-local fighter(s) projected`);
  if (after.viewSubject !== undefined) {
    check('2d the published subject is not the local seat',
      after.viewSubject !== 0, `viewSubject=${after.viewSubject} reason=${after.viewReason}`);
  } else {
    console.log('  ·    2d MatchDebug.viewSubject is absent — this is the BEFORE build');
  }

  // ── arm 3: the drift control ────────────────────────────────────────────────
  await page.evaluate(() => window.__svRaf.stop());
  await page.waitForTimeout(80);
  const drift = await page.evaluate(PAGE_DRIFT);
  check('3a the drift control could run at all', drift.ok === true, drift.why ?? '');
  if (drift.ok) {
    check('3b the buffer is not blank (a black canvas matches itself trivially)',
      !drift.blank, `${drift.bytes} bytes of data URL`);
    check('3c TWO IDENTICAL FRAMES DIFFER BY EXACTLY ZERO', drift.same === true);
    check('3d KNOWN-BAD: nudging the rig 1 m between renders DOES differ',
      drift.kbDiffers === true, 'so 3c is a measurement, not a tautology');
  }
  await page.evaluate(() => window.__svRaf.start());

  check('4 no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify({
    tag: TAG, base: BASE, boot, atDeath, after, moved, drift, errors,
  }, null, 2));
  console.log(`    wrote ${OUT}/${TAG}.json and 3 PNGs`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
