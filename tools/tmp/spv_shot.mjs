#!/usr/bin/env node
/**
 * THE SPECTATOR HUD, ON THE SCREEN URI WILL SEE — a real six-seat match, played through
 * the product path until the local seat dies, read and photographed in LANDSCAPE and in
 * PORTRAIT.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-spv -- \
 *     node tools/tmp/spv_shot.mjs --url '{URL}' --out tools/tmp/spv_out/after --tag after
 *
 * ⚠️ NEVER `:5173`, and for an A/B you will quote, never the working tree either.
 *
 * ── WHY THIS EXISTS BESIDE `spv_spec.mjs` ───────────────────────────────────────
 *
 * `spv_spec` drives the HUD directly on a fixture built to express each defect. That is
 * the only way to ask the radar question at all — it needs a fighter under a plate with
 * one observer inside `CONCEAL_REVEAL_RADIUS` and the other outside it, which a random
 * match produces when it feels like it. But a fixture proves the FUNCTION is right, and
 * "it isn't there" has meant "it is there and invisible" twenty times in this repo. This
 * file asks the shipped game, through `?seats=6`, with nothing stubbed.
 *
 * 🚨 **AND IT MUST BE SIX SEATS.** `sv_subject.mjs`'s own known-bad table measured THREE
 * OF FIVE wrong camera policies as completely invisible at two seats. The states this
 * file reads are not camera policies, but they share the property that made that table
 * matter: at two seats "the local player is dead" and "the match is over" are almost the
 * same sentence, so every row below would be measured on a result card.
 *
 * ── WHAT IT READS ───────────────────────────────────────────────────────────────
 *   1  BOOT + DIE — six plates, the local seat's HP watched down to 0, the match still
 *      PLAYING afterwards. Non-vacuity: without a corpse in a live match there is
 *      nothing here to be right or wrong about and every row below is a lie.
 *   2  THE THREE READOUTS — the weapon tray's classes, the zone pill's text, the
 *      spectate caption. Compared against the SAME reads taken while alive, so each row
 *      is a within-run PAIR and needs no cross-arm baseline: a class that is set in both
 *      states is not evidence of anything.
 *   3  DRIFT CONTROL — rAF held, the shake explicitly zeroed, two `stage.render(0)`
 *      calls inside ONE synchronous evaluate with `toDataURL()` between. Byte-identical,
 *      EXACTLY. Its own known-bad nudges the rig 1 m between renders and requires them
 *      to DIFFER. 🚨 The shake zeroing is not optional — `189d6ed` drifted on 344 of 344
 *      frozen frames because `CameraRig.update` re-randomised the offset at `dt = 0`.
 *   4  PNGs, for rule 3. Read with the Read tool and looked at, not scored.
 *
 * ── PORTRAIT ────────────────────────────────────────────────────────────────────
 * Run at 1280×720 and at 390×844. **Uri plays portrait**, `menu_accept_portrait` exists
 * because of that, and the previous pass listed portrait spectating as explicitly
 * unverified. The two layouts are not cosmetic variants of each other here: the weapon
 * tray is bottom-centre in portrait and moves to the bottom-right corner under
 * `html.fa-touch-capable` + `(orientation: landscape)`, and the spectate caption's
 * position is derived from the tray's.
 */

import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const OUT = resolve(flag('out') ?? 'tools/tmp/spv_out');
const TAG = flag('tag') ?? 'run';
/** See `PAGE_WATCH_LISTENER`. Declares which side of the routed `match.ts` hunk the tree
 *  under test is on, so arm 5 is an assertion in BOTH directions instead of a printout. */
const EXPECT_ROUTED = argv.includes('--expect-routed');

if (!BASE || /:5173(\/|$)/.test(BASE)) {
  console.error('spv_shot: --url (or PREVIEW_BASE) is required and must be a SNAPSHOT, never :5173.');
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

/** Everything this file reads off the shipped HUD. No mutation, so it cannot perturb
 *  what it measures. */
const PAGE_READ = () => {
  const txt = (sel) => document.querySelector(sel)?.textContent ?? null;
  const hpOf = (key) => {
    const t = txt(`[data-el="${key}-hp"]`);
    if (!t) return null;
    const m = t.match(/(-?\d+)/);
    return m ? Number(m[1]) : null;
  };
  const keys = ['player', 'enemy', 'slot2', 'slot3', 'slot4', 'slot5'];
  const d = window.__matchDebug ?? {};
  const cap = document.querySelector('.hud-spectate');
  const tray = document.querySelector('.hud-weapons');
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    plates: document.querySelectorAll('.hud-healthbar').length,
    hp: keys.map(hpOf),
    phase: d.phase ?? null,
    viewSubject: d.viewSubject,
    viewReason: d.viewReason,
    gameover: !!document.querySelector('[data-el="gameover"]')?.classList.contains('is-on')
      || getComputedStyle(document.querySelector('[data-el="gameover"]') ?? document.body).display === 'flex',
    // ── the three readouts ──
    trayInert: tray ? tray.classList.contains('is-inert') : null,
    trayShown: tray ? getComputedStyle(tray).display !== 'none' : null,
    ready: document.querySelectorAll('.hud-weapon-slot.is-ready').length,
    selected: document.querySelectorAll('.hud-weapon-slot.is-selected').length,
    slots: document.querySelectorAll('.hud-weapon-slot').length,
    timers: Array.from(document.querySelectorAll('.hud-weapon-timer')).map((e) => e.textContent ?? ''),
    zoneValue: txt('[data-el="zone-value"]'),
    zoneLabel: txt('[data-el="zone-label"]'),
    capOn: cap ? cap.classList.contains('is-on') : null,
    capShown: cap ? getComputedStyle(cap).display !== 'none' : null,
    capText: cap ? cap.textContent : null,
    capBox: box(cap),
    trayBox: box(tray),
    radarBox: box(document.querySelector('.hud-radar')),
    topbarBox: box(document.querySelector('[data-el="topbar"]')),
    vw: window.innerWidth, vh: window.innerHeight,
  };
};

/** Hold rAF rather than drop it, so the loop resumes instead of dying — `sv_shot`'s
 *  recipe, re-derived here rather than imported (that file has no IS_MAIN guard and
 *  exports nothing, so importing it would run its CLI). */
const PAGE_INSTALL_RAF = () => {
  const rafReal = window.requestAnimationFrame.bind(window);
  let held = null;
  window.requestAnimationFrame = (cb) => {
    if (held !== null) { held = cb; return -1; }
    return rafReal(cb);
  };
  window.__spvRaf = {
    stop() { if (held === null) held = false; },
    start() { const cb = held; held = null; if (typeof cb === 'function') rafReal(cb); },
  };
};

/** ONE synchronous evaluate: still, render, read, render, read. Nothing runs between the
 *  two renders, which is the only way "identical" means anything. */
const PAGE_DRIFT = () => {
  const stage = window.__stage;
  if (!stage || !stage.rig || !stage.canvas) return { ok: false, why: 'no window.__stage' };
  const still = () => {
    const rig = stage.rig;
    rig.shakeAmount = 0;
    if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
  };
  const shot = () => { still(); stage.render(0); return stage.canvas.toDataURL(); };
  shot();                        // warm-up: the first render after a freeze is not the second
  const a = shot();
  const b = shot();
  stage.rig.target.x += 1;       // KNOWN-BAD, in the same evaluate so nothing else explains it
  const c = shot();
  stage.rig.target.x -= 1;
  return { ok: true, same: a === b, kbDiffers: c !== a, bytes: a.length, blank: a.length < 5000 };
};

/**
 * 🚨 THE ONE THING THAT HAS NO PIXELS: does anything actually MOVE THE EAR in the
 * shipped game?
 *
 * `spv_spec` §B proves `MatchAudio.setListener` does the right thing when it is called.
 * It cannot prove it is called — that is `match.ts`'s job and `match.ts` is not this
 * pass's file. `AudioEngine` publishes no listener readout, so the only observable is
 * the call itself. `setListener` is a prototype method (not a bound field), so wrapping
 * the prototype mid-match instruments the live director without touching construction
 * order, and the wrapper still calls through — this observes, it does not stub.
 *
 * ⚠️ **PAIRED WITH `--expect-routed`, WHICH IS WHAT MAKES IT AN ASSERTION AND NOT A
 * PRINTOUT.** Run against a tree without the routed hunk it must record ZERO calls;
 * against a tree with it, calls including a NON-LOCAL slot after death. Each arm is the
 * other's known-bad, and a single arm that accepted "either" would be exactly the
 * vacuous shape `CLAUDE.md` rule 6 is about.
 */
const PAGE_WATCH_LISTENER = async () => {
  const d = await import('/src/audio/director.ts');
  const orig = d.MatchAudio.prototype.setListener;
  window.__spvListener = { calls: [], patched: typeof orig === 'function' };
  if (typeof orig !== 'function') return window.__spvListener.patched;
  d.MatchAudio.prototype.setListener = function patched(slot) {
    window.__spvListener.calls.push(slot);
    return orig.call(this, slot);
  };
  return true;
};

const stillCss = (page) => page.addStyleTag({
  content: '*,*::before,*::after{animation:none!important;transition:none!important}',
}).catch(() => {});

const overlap = (a, b) => !!a && !!b
  && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

async function runOne(browser, label, ctxOpts) {
  console.log(`\n── ${label} ──────────────────────────────────────────────`);
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
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
  await page.addInitScript(PAGE_INSTALL_RAF);

  // `?seats=6` is the PRODUCT path (`brawl.ts:seatsFromParams`), not the `?fighters=` QA
  // transport — this is the build Uri played. `simSpeed` only compresses wall-clock.
  await page.goto(`${BASE}/?seats=6&simSpeed=6&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  await stillCss(page);

  const patched = await page.evaluate(PAGE_WATCH_LISTENER);

  const boot = await page.evaluate(PAGE_READ);
  check(`${label} 1a the match really has SIX seats`, boot.plates === 6, `${boot.plates} plates`);
  check(`${label} 1b the local seat starts alive`, (boot.hp[0] ?? 0) > 0, `player hp ${boot.hp[0]}`);
  await page.screenshot({ path: `${OUT}/${TAG}-${label}-1-alive.png` });

  // ── the ALIVE control, taken mid-fight. Every "dead" row below is paired against it,
  //    so a class or a string that is present in BOTH states proves nothing.
  let alive = boot;
  for (let i = 0; i < 40; i++) {
    const r = await page.evaluate(PAGE_READ);
    if (r.phase === 'playing' && (r.hp[0] ?? 0) > 0) { alive = r; break; }
    await page.waitForTimeout(120);
  }

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
  // 🚨 NON-VACUITY. Everything below is about a corpse in a live match.
  if (!check(`${label} 1c the local seat DIED while the match was still playing`,
    died && !atDeath?.gameover,
    died ? `after ${elapsed}s, phase ${atDeath?.phase}` : `no death in ${elapsed}s (gameover=${atDeath?.gameover})`)) {
    await page.screenshot({ path: `${OUT}/${TAG}-${label}-FAIL-nodeath.png` });
    await ctx.close();
    return { label, ok: false, boot, alive, atDeath, errors, patched };
  }
  await page.screenshot({ path: `${OUT}/${TAG}-${label}-2-death.png` });

  // ── past the dwell (SPECTATE_DWELL_MS = 1350 of match time) ──────────────────
  await page.waitForTimeout(3000);
  const after = await page.evaluate(PAGE_READ);
  await page.screenshot({ path: `${OUT}/${TAG}-${label}-3-spectating.png` });

  console.log(`    alive: tray inert=${alive.trayInert} ready=${alive.ready} sel=${alive.selected}`
    + ` zone="${alive.zoneValue}" cap=${alive.capOn}/"${alive.capText}"`);
  console.log(`    dead : tray inert=${after.trayInert} ready=${after.ready} sel=${after.selected}`
    + ` zone="${after.zoneValue}" cap=${after.capOn}/"${after.capText}"`);
  console.log(`    viewSubject=${after.viewSubject} reason=${after.viewReason} phase=${after.phase} hp=${JSON.stringify(after.hp)}`);

  check(`${label} 2a the match is STILL PLAYING three seconds after the local death`,
    after.phase === 'playing' && !after.gameover, `phase ${after.phase}`);
  check(`${label} 2b the weapon tray is INERT and claims nothing`,
    after.trayInert === true && after.ready === 0 && after.selected === 0
    && after.timers.every((t) => t === ''),
    `inert=${after.trayInert} ready=${after.ready} selected=${after.selected}`);
  check(`${label} 2c PAIRED CONTROL: the same tray was LIT while alive`,
    alive.trayInert === false && alive.ready > 0 && alive.slots === 4,
    `alive ready=${alive.ready}/${alive.slots} — so 2b is a change, not a constant`);
  check(`${label} 2d the zone pill no longer addresses the player`,
    !/YOU/i.test(after.zoneValue ?? '') && ['CLOSING', 'FINAL RING', 'MOST HP WINS'].includes(after.zoneValue ?? ''),
    `"${after.zoneLabel} / ${after.zoneValue}"`);
  check(`${label} 2e the SPECTATING caption is on screen and has words in it`,
    after.capOn === true && after.capShown === true && (after.capText ?? '').length > 3,
    `"${after.capText}"`);
  check(`${label} 2f PAIRED CONTROL: it had no box and no text while alive`,
    alive.capOn === false && alive.capShown === false && (alive.capText ?? '') === '',
    'so 2e is not green on an element that is always drawn');
  // The caption is the one element this pass ADDS, so it is the one that can collide.
  check(`${label} 2g …and it collides with nothing the HUD already owns`,
    !overlap(after.capBox, after.trayBox) && !overlap(after.capBox, after.radarBox)
    && !overlap(after.capBox, after.topbarBox),
    `cap ${JSON.stringify(after.capBox)} tray ${JSON.stringify(after.trayBox)} radar ${JSON.stringify(after.radarBox)}`);

  // ── the ear ─────────────────────────────────────────────────────────────────
  const ear = await page.evaluate(() => window.__spvListener ?? { calls: [], patched: false });
  const earSlots = Array.from(new Set(ear.calls));
  const earNonLocal = ear.calls.filter((s) => s !== 0).length;
  check(`${label} 5a the listener instrument was installed`, patched === true && ear.patched === true);
  if (EXPECT_ROUTED) {
    check(`${label} 5b THE EAR IS BEING MOVED — match.ts calls setListener, and past the local seat`,
      ear.calls.length > 0 && earNonLocal > 0 && earSlots.includes(after.viewSubject),
      `${ear.calls.length} calls, slots [${earSlots.join(',')}], ${earNonLocal} non-local, viewSubject ${after.viewSubject}`);
  } else {
    check(`${label} 5b KNOWN-BAD ARM: with the hunk unrouted NOTHING moves the ear — 0 calls`,
      ear.calls.length === 0,
      'this is the shipped state today; the paired --expect-routed run is the fix');
  }

  // ── the drift control ───────────────────────────────────────────────────────
  await page.evaluate(() => window.__spvRaf.stop());
  await page.waitForTimeout(80);
  const drift = await page.evaluate(PAGE_DRIFT);
  check(`${label} 3a the drift control could run at all`, drift.ok === true, drift.why ?? '');
  if (drift.ok) {
    check(`${label} 3b the buffer is not blank`, !drift.blank, `${drift.bytes} bytes`);
    check(`${label} 3c TWO IDENTICAL FRAMES DIFFER BY EXACTLY ZERO`, drift.same === true);
    check(`${label} 3d KNOWN-BAD: nudging the rig 1 m between renders DOES differ`,
      drift.kbDiffers === true, 'so 3c is a measurement, not a tautology');
  }
  await page.evaluate(() => window.__spvRaf.start());

  check(`${label} 4 no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
  return { label, ok: true, boot, alive, atDeath, after, drift, ear, errors };
}

async function main() {
  console.log(`spv_shot [${TAG}] — a six-seat match played to a local death, landscape and portrait`);
  console.log(`  base ${BASE}`);
  const browser = await chromium.launch();
  const rows = [];
  rows.push(await runOne(browser, 'landscape', { viewport: { width: 1280, height: 720 } }));
  // A real phone profile, not just a narrow viewport: `hasTouch` is what makes
  // `game/touch.ts` set `html.fa-touch-capable`, and three CSS rules that move the tray
  // and the radar are gated on it. A resized desktop would measure the desktop layout.
  rows.push(await runOne(browser, 'portrait', {
    ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  }));
  await browser.close();

  writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify({ tag: TAG, base: BASE, rows }, null, 2));
  console.log(`\n    wrote ${OUT}/${TAG}.json and ${rows.length * 3} PNGs`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
