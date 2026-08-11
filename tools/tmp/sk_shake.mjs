#!/usr/bin/env node
/**
 * SHAKE STILLNESS PROBE — "a frozen frame is not a frozen camera", closed.
 *
 * `render/camera.ts:CameraRig.update(dt)` multiplied the shake DECAY by `dtSeconds`
 * and the RE-RANDOMISATION by nothing. At `dt = 0` the amount never fell, the exit
 * test at the bottom of the branch was never reached, and **every `stage.render()`
 * call moved the camera to a new random offset** — `Stage.render()` calls
 * `rig.update()` before it draws. Measured on `189d6ed` by `pj_probe`'s own drift
 * control: **344 of 344 frozen frames drifted, up to 349 px of mask.**
 *
 * So **every rAF-frozen probe in this repo that renders twice with shake alive has
 * been diffing two different camera positions.** `feel_probe.mjs` zeroed the offset
 * around its own captures for exactly this reason (its comment says so) and never
 * generalised it; `pj_probe.mjs` re-derived the same workaround independently. Two
 * callers knew, nothing checked, and the rest of the repo did not.
 *
 * ── WHAT THIS FILE IS FOR, AND WHY IT IS NOT A SECOND `feel_probe` ─────────────
 *
 * `feel_probe` measures what a HIT DELIVERS — burst pixels, kick metres, hit-stop ms.
 * It is the gate that says the shipped feel did not move, and it is run as one, before
 * and after. This file measures the INTEGRATOR: given the same inputs, does
 * `CameraRig.update` produce the same trajectory it always did at `dt > 0`, and does
 * it hold still at `dt = 0`. Those are different questions and only the second one is
 * new.
 *
 * ── THE FOUR ARMS ──────────────────────────────────────────────────────────────
 *
 *   A  FROZEN BIT-IDENTITY, SHAKE ACTIVE — the acceptance test. Kick the camera
 *      through the shipped `rig.shake()`, advance ONE real frame so the offset is
 *      genuinely non-zero, freeze, then render N times at `dt = 0` and require every
 *      frame to be **bit-identical, 0 px, exactly**.
 *      ⚠️ Guarded against being VACUOUS: it asserts `shakeAmount > 0.0001` **and**
 *      `|shakeOffset| > 0` at the freeze point and FAILS if either is false. Without
 *      that, "the frames matched" would also be true of a rig with no shake at all —
 *      a tautological green (`docs/AGENT-BRIEF.md` §4.4: what implementation would
 *      fail this?).
 *
 *   B  KNOWN-BAD — the PRE-FIX `update()` body, verbatim, installed over the real one
 *      and driven through the real `Stage.render()`. Arm A's own comparison must
 *      report DRIFT here. An instrument not shown to fail on the bug it guards is not
 *      a guard, and this one can be shown to fail on the *actual historical code*
 *      rather than on a caricature of it.
 *
 *   C  POSITIVE CONTROL — at `dt > 0` the shake must still MOVE the camera. A fix that
 *      stilled it everywhere would trade a measurement bug for a feel regression and
 *      would sail through arm A. Measured twice, independently: the rig's own camera
 *      position in metres (exact, no readback) and the rendered mask in pixels.
 *
 *   D  TRAJECTORY IDENTITY — the proof that the SHIPPED FEEL IS UNCHANGED, and the
 *      strongest arm here because it does not go near a pixel. `Math.random` is
 *      replaced with a seeded PRNG, the NEW `update` is run for K frames at a fixed
 *      dt and its `(amount, offset)` trajectory recorded; the PRNG is re-seeded
 *      identically and the PRE-FIX body is run for the same K frames; the two
 *      trajectories must agree **exactly, 0 on every component, to the last bit**.
 *      Its own known-bad is a third run with the decay perturbed by 1e-9, which must
 *      be REFUSED — otherwise "they agreed" would only mean the comparison is blind.
 *
 *   E  HOLD AND EXIT — at `dt = 0` the amount and offset must be unchanged after N
 *      updates (hold, do not decay, do not re-roll); at `dt > 0` the shake must still
 *      reach exactly 0 and clear its offset (exit, do not linger). The second half is
 *      what stops "hold at dt=0" from being implemented as "never decay".
 *
 * ── WHY THERE IS NO CROSS-TREE A/B HERE ────────────────────────────────────────
 *
 * Both arms of every comparison run **in one page, on one frozen frame**. There is no
 * `--ref`, no second server and no second tree, so `rg_lib.loadCast`'s trap (a pinned
 * A/B that silently reads the working tree for both arms and returns byte-identical
 * numbers) cannot apply, and neither can a peer's half-saved file landing on one side
 * only. The pre-fix code is carried here as source, which is the only copy of it that
 * cannot go stale relative to the tree it is being compared against — because it is
 * being compared against the tree it is loaded into.
 *
 * ── CAPTURE ────────────────────────────────────────────────────────────────────
 *
 * Frames are read with `drawImage(stage.canvas)` + `getImageData`, i.e. **the WebGL
 * canvas only**. That is deliberate: `locator('canvas').screenshot()` is a page capture
 * clipped to the canvas box, so a `position: fixed` HUD keyframe lands inside it and
 * CSS runs on the document timeline rather than on rAF (`sc_fogstill.mjs`). Reading the
 * GL canvas directly makes this probe structurally immune to that, so it needs no
 * `PAGE_STILL_HUD` and no still-HUD flag — and a 0 px result here really is 0 px of
 * camera, not 0 px of luck.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/sk_shake.mjs --url {URL}
 *   node tools/tmp/sk_shake.mjs --url $U --selftest     # same arms; this IS the gate
 *   node tools/tmp/sk_shake.mjs --url $U --shots        # write the judgement PNGs
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = String(args.out ?? 'shots/sk');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Renders per frozen-stillness arm. 6 because the historical failure was 344/344 —
 * it does not need many samples, it needs more than one. */
const RENDERS = Number(args.renders ?? 6);
/** Frames of trajectory compared in arm D. 40 at 1/60 s is 0.67 s, which is longer
 * than the whole life of the default kick (0.18 m decaying at 4.5 reaches the 0.002 m
 * exit in ~0.55 s), so the comparison covers the decay AND the exit. */
const TRAJ_FRAMES = Number(args.trajFrames ?? 40);
/** The shipped default kick, `CameraRig.shake()`'s own defaults. Not a probe-chosen
 * amplitude — `match.ts:kick` clamps to `SHAKE_MAX_M` and the loudest real hit lands
 * near this. */
const SHAKE_M = Number(args.amount ?? 0.18);
const SHAKE_DECAY = Number(args.decay ?? 4.5);
const SHOTS = !!args.shots;

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);

let checks = 0;
let failures = 0;
function check(ok, label, detail) {
  checks++;
  if (!ok) failures++;
  log(`  ${ok ? 'ok  ' : 'FAIL'} ${pad(label, 46)} ${detail ?? ''}`);
}

async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });
  // Vite's HMR client is stubbed out: a snapshot has no dev server to talk to and the
  // real client's failed websocket retries fire timers forever, which is motion.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    performance.now = () => (paused ? virt : realNow() - base);
    window.__clk = {
      pause() { if (!paused) { virt = realNow() - base; paused = true; } },
      resume() { if (paused) { base = realNow() - virt; paused = false; } },
      advance(ms) { virt += ms; },
    };
    /**
     * 🚨 STOPPING THE CLOCK IS NOT STOPPING THE LOOP (`docs/AGENT-BRIEF.md` §3).
     * With `performance.now` frozen the sim does not advance, but rAF keeps firing and
     * `GameSession.frame()` keeps running the whole render path. Hold the callback
     * rather than dropping it, so the loop resumes where it was instead of dying.
     */
    const rafReal = window.requestAnimationFrame.bind(window);
    let held = null;
    window.requestAnimationFrame = (cb) => {
      if (held !== null) { held = cb; return -1; }
      return rafReal(cb);
    };
    window.__raf = {
      stop() { if (held === null) held = false; },
      start() { const cb = held; held = null; if (typeof cb === 'function') rafReal(cb); },
      stopped() { return held !== null; },
    };
  });
}

/* eslint-disable */
async function installHarness(page) {
  await page.evaluate(([rw, rh]) => {
    const stage = window.__stage;
    const rig = stage.rig;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const c2d = cv.getContext('2d', { willReadFrequently: true });

    /** Read the GL canvas — NOT the page. See the file header: a page capture clipped
     * to the canvas box carries the HUD's CSS keyframes, which run on the document
     * timeline and are not stilled by freezing rAF. */
    const grab = () => {
      stage.render(0);
      c2d.clearRect(0, 0, rw, rh);
      c2d.drawImage(stage.canvas, 0, 0, rw, rh);
      return c2d.getImageData(0, 0, rw, rh).data;
    };

    /** Changed pixels between two RGBA buffers, and the largest per-channel step.
     * `delta 0` on purpose: this arm's claim is BIT-IDENTITY, so any threshold at all
     * would be a place for a one-code camera drift to hide. */
    const diff = (a, b) => {
      let n = 0, maxD = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d > 0) { n++; if (d > maxD) maxD = d; }
      }
      return { n, maxD, total: a.length / 4 };
    };

    /**
     * 🚨 THE PRE-FIX `CameraRig.update` BODY, VERBATIM.
     *
     * Copied from `render/camera.ts` as it stood at `189d6ed` — the decay multiplied by
     * `dtSeconds`, the re-randomisation multiplied by nothing, and the exit test inside
     * the branch it can therefore never reach at `dt = 0`. Kept as source rather than
     * as a description so the known-bad arm runs the code that actually shipped.
     *
     * ⚠️ `target`/`desired`/`shakeOffset` are TypeScript-private, which is a
     * compile-time fiction — at runtime they are ordinary fields, and reaching them is
     * the only way to run the historical integrator against the live one.
     */
    const oldUpdate = function (dtSeconds) {
      const t = 1 - Math.pow(1 - this.followLerp, dtSeconds * 60);
      this.target.lerp(this.desired, t);
      if (this.shakeAmount > 0.0001) {
        this.shakeAmount = Math.max(0, this.shakeAmount - this.shakeDecay * this.shakeAmount * dtSeconds);
        const a = this.shakeAmount;
        this.shakeOffset.set(
          (Math.random() * 2 - 1) * a,
          (Math.random() * 2 - 1) * a * 0.4,
          (Math.random() * 2 - 1) * a,
        );
        if (this.shakeAmount < 0.002) {
          this.shakeAmount = 0;
          this.shakeOffset.set(0, 0, 0);
        }
      }
      this.apply();
    };

    /** A seeded PRNG (mulberry32) so arm D can hand the two integrators the SAME random
     * stream. Without this the trajectories differ for a reason that has nothing to do
     * with the change and the comparison is meaningless. */
    const seedRandom = (seed) => {
      let s = seed >>> 0;
      const realRandom = Math.random;
      Math.random = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return () => { Math.random = realRandom; };
    };

    const shakeState = () => ({
      amount: rig.shakeAmount,
      off: [rig.shakeOffset.x, rig.shakeOffset.y, rig.shakeOffset.z],
      offLen: Math.hypot(rig.shakeOffset.x, rig.shakeOffset.y, rig.shakeOffset.z),
      cam: [rig.camera.position.x, rig.camera.position.y, rig.camera.position.z],
    });

    window.__sk = {
      shakeState,
      /** Kick the camera through the SHIPPED public entry point, then advance one real
       * frame's worth of integration so the offset is genuinely non-zero. A kick alone
       * leaves `shakeOffset` at the origin, and an arm A that ran on a zero offset
       * would be measuring a still camera by accident. */
      arm(dt) {
        rig.shake(dt.amount, dt.decay);
        rig.update(1 / 60);
        return shakeState();
      },
      still() { rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply(); },

      /** Arm A / arm B. `useOld` installs the historical body first and restores it
       * after — the restore is not optional, everything downstream would inherit it. */
      frozenDrift(n, useOld) {
        const realUpdate = rig.update;
        if (useOld) rig.update = oldUpdate;
        try {
          const first = grab();
          let worst = { n: 0, maxD: 0, total: first.length / 4 };
          let worstAt = 0;
          for (let i = 1; i < n; i++) {
            const d = diff(first, grab());
            if (d.n > worst.n) { worst = d; worstAt = i; }
          }
          return { renders: n, drifted: worst.n, maxD: worst.maxD, total: worst.total, worstAt, state: shakeState() };
        } finally {
          if (useOld) rig.update = realUpdate;
        }
      },

      /** Arm C. Shake alive, integrate a REAL frame between renders, and require both
       * the camera and the pixels to move. Two independent witnesses on purpose: the
       * metres come from the rig with no readback at all, so a capture fault cannot
       * fake the positive control. */
      liveMotion(dt) {
        const before = grab();
        const c0 = rig.camera.position.clone();
        rig.update(dt);
        const after = grab();
        const c1 = rig.camera.position.clone();
        return { px: diff(before, after), moveM: c0.distanceTo(c1), state: shakeState() };
      },

      /**
       * Arm D. Run one integrator for `frames` at fixed `dt` from an identical start
       * and an identical random stream, and return the whole trajectory.
       * `which`: 'new' (the shipped `update`), 'old' (the pre-fix body), or
       * 'perturbed' (the pre-fix body with the decay nudged by 1e-9 — the known-bad
       * that proves the comparison can tell two trajectories apart at all).
       */
      trajectory(which, frames, dt, amount, decay, seed) {
        const restoreRandom = seedRandom(seed);
        const realUpdate = rig.update;
        const savedAmount = rig.shakeAmount;
        const savedOff = rig.shakeOffset.clone();
        try {
          if (which === 'old') rig.update = oldUpdate;
          if (which === 'perturbed') {
            rig.update = function (d) { return oldUpdate.call(this, d + 1e-9); };
          }
          rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
          rig.shake(amount, decay);
          const rows = [];
          for (let i = 0; i < frames; i++) {
            rig.update(dt);
            rows.push([rig.shakeAmount, rig.shakeOffset.x, rig.shakeOffset.y, rig.shakeOffset.z]);
          }
          return rows;
        } finally {
          rig.update = realUpdate;
          rig.shakeAmount = savedAmount;
          rig.shakeOffset.copy(savedOff);
          rig.apply();
          restoreRandom();
        }
      },

      /** Arm E. N updates at `dt`, reporting only the endpoints — "did it hold" and
       * "did it exit" are both statements about where it ended up. */
      integrate(n, dt, amount, decay) {
        rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
        rig.shake(amount, decay);
        rig.update(1 / 60);                    // establish a real non-zero offset
        const start = shakeState();
        for (let i = 0; i < n; i++) rig.update(dt);
        return { start, end: shakeState() };
      },

      /**
       * Arm F. THE SHIPPED PAUSE PATH — the half of this that is a PLAYER-VISIBLE bug
       * rather than a measurement one.
       *
       * `match.ts:1217`'s paused branch calls `stage.render(0)` on every rAF turn, and
       * its own comment states the intent:
       *
       *     "dt 0 so the camera's follow lerp and shake decay hold too — a drifting
       *      camera over a frozen world reads as a hitch, not as a pause."
       *
       * That intent was NOT implemented. Pre-fix, `dt = 0` re-rolled `shakeOffset` on
       * every one of those turns AND never decayed `shakeAmount`, so pausing inside a
       * shake gave a camera jittering at 60 Hz over a completely frozen world, at
       * FULL amplitude, for as long as the player stayed paused. The comment describes
       * the bug it was written to prevent.
       *
       * Driven through the REAL loop and the REAL pause button — no clock stub, no rAF
       * hold — because the claim is about what the player gets, and the paused branch
       * is only reachable from the running loop.
       */
      async pauseDrift(turns, useOld, amount, decay) {
        const realUpdate = rig.update;
        if (useOld) rig.update = oldUpdate;
        try {
          // Armed AFTER the pause, so the running loop cannot decay it first. `shake()`
          // alone leaves the offset at the origin, so one real-dt update seeds it —
          // which is exactly what the frame before a pause would have done.
          rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
          rig.shake(amount, decay);
          rig.update(1 / 60);
          const armedAmount = rig.shakeAmount;
          const pts = [];
          const frames0 = window.__matchDebug?.frames ?? 0;
          for (let i = 0; i < turns; i++) {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const p = rig.camera.position;
            pts.push([p.x, p.y, p.z]);
          }
          let maxD = 0;
          for (let i = 1; i < pts.length; i++) {
            maxD = Math.max(maxD, Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1], pts[i][2] - pts[0][2]));
          }
          return {
            turns, maxD, armedAmount, endAmount: rig.shakeAmount,
            // ⚠️ The loop must actually have RUN, or "the camera did not move" is a
            // statement about a dead page. `__matchDebug.frames` exists for this.
            loopFrames: (window.__matchDebug?.frames ?? 0) - frames0,
            paused: window.__matchDebug?.paused ?? null,
          };
        } finally {
          if (useOld) rig.update = realUpdate;
          rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
        }
      },

      /** Push the current scene to the REAL canvas so a `page.screenshot()` shows the
       * frame the numbers came from — `grab()` renders into an offscreen 2D canvas, so
       * without this the PNG and its number are two different frames. */
      stillFrame() { stage.render(0); },
    };
  }, [RW, RH]);
}
/* eslint-enable */

/** Largest absolute component difference between two trajectories. Exact, not a
 * tolerance: the claim is bit-identity of the shipped integrator, and a tolerance is
 * where a real drift would hide. */
function trajMaxDelta(a, b) {
  if (a.length !== b.length) return { d: Infinity, at: -1, note: `length ${a.length} vs ${b.length}` };
  let d = 0, at = -1;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < 4; j++) {
      const x = Math.abs(a[i][j] - b[i][j]);
      if (x > d) { d = x; at = i; }
    }
  }
  return { d, at, note: '' };
}

async function main() {
  if (SHOTS) await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);
    // A ranged matchup at a slow sim speed: the point is a live, fully-populated match
    // frame (VFX pools warm, shadows built), not a quiet one.
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.35&pointerLock=0&aimMode=free`,
      { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 180000 });
    await installHarness(page);

    // Freeze: hold rAF, then pause the clock. Order matters — pausing first leaves one
    // more loop turn in flight.
    await page.evaluate(() => { window.__raf.stop(); window.__clk.pause(); });
    await page.evaluate(() => window.__sk.stillFrame());

    log('\n══ ARM A — FROZEN BIT-IDENTITY WITH SHAKE ACTIVE ═══════════════════════════');
    const armed = await page.evaluate(([a, d]) => window.__sk.arm({ amount: a, decay: d }), [SHAKE_M, SHAKE_DECAY]);
    log(`  armed: shakeAmount ${armed.amount.toFixed(4)} m · |offset| ${armed.offLen.toFixed(4)} m`
      + ` · offset (${armed.off.map((v) => v.toFixed(4)).join(', ')})`);
    // ⚠️ THE VACUITY GUARD. "The frames matched" is also true of a rig with no shake,
    // so the arm asserts the shake is LIVE before it asserts the frames are identical.
    check(armed.amount > 0.0001, 'shake is ACTIVE at the freeze point', `amount ${armed.amount.toFixed(4)} > 0.0001`);
    check(armed.offLen > 0, 'offset is NON-ZERO at the freeze point', `|offset| ${armed.offLen.toFixed(4)} m`);

    const A = await page.evaluate(([n]) => window.__sk.frozenDrift(n, false), [RENDERS]);
    log(`  ${A.renders} renders at dt=0 · worst drift ${A.drifted} px of ${A.total} (maxΔ ${A.maxD})`);
    check(A.drifted === 0 && A.maxD === 0, 'frozen frames are BIT-IDENTICAL', `${A.drifted} px, maxΔ ${A.maxD}`);
    check(A.state.amount > 0.0001, 'shake still ACTIVE after the renders', `amount ${A.state.amount.toFixed(4)}`);

    if (SHOTS) {
      await page.evaluate(() => window.__sk.stillFrame());
      await page.locator('canvas').screenshot({ path: `${OUT}/frozen-shake-active.png` });
      await writeFile(`${OUT}/frozen-shake-active.png.capture.json`, JSON.stringify({
        tool: 'tools/tmp/sk_shake.mjs', arm: 'A', base: BASE, w: W, h: H,
        note: 'one frozen frame with shake ACTIVE; arm A asserts N renders of this are bit-identical',
      }, null, 2));
    }

    log('\n══ ARM B — KNOWN-BAD: THE PRE-FIX `update()` BODY MUST DRIFT ═══════════════');
    const B = await page.evaluate(([n]) => window.__sk.frozenDrift(n, true), [RENDERS]);
    log(`  ${B.renders} renders at dt=0 through the HISTORICAL body · worst drift ${B.drifted} px of ${B.total}`
      + ` (maxΔ ${B.maxD}, worst at render ${B.worstAt})`);
    // ⚠️ An instrument that cannot fail is not an instrument. This is the arm that says
    // arm A's 0 px means something.
    check(B.drifted > 0, 'the historical body DRIFTS (arm A can fail)', `${B.drifted} px`);
    check(B.drifted > A.drifted, 'and drifts strictly more than the fix', `${B.drifted} vs ${A.drifted}`);

    log('\n══ ARM C — POSITIVE CONTROL: SHAKE STILL MOVES AT dt > 0 ═══════════════════');
    await page.evaluate(() => window.__sk.still());
    await page.evaluate(([a, d]) => window.__sk.arm({ amount: a, decay: d }), [SHAKE_M, SHAKE_DECAY]);
    const C = await page.evaluate(([dt]) => window.__sk.liveMotion(dt), [1 / 60]);
    log(`  one 1/60 s update · camera moved ${C.moveM.toFixed(5)} m · ${C.px.n} px of ${C.px.total} changed (maxΔ ${C.px.maxD})`);
    check(C.moveM > 1e-4, 'camera POSITION moves at dt > 0', `${C.moveM.toFixed(5)} m`);
    check(C.px.n > 0, 'and the rendered frame moves with it', `${C.px.n} px`);

    log('\n══ ARM D — TRAJECTORY IDENTITY: THE SHIPPED FEEL IS UNCHANGED ══════════════');
    const SEED = 0x5EED1234;
    const tNew = await page.evaluate(([f, dt, a, d, s]) => window.__sk.trajectory('new', f, dt, a, d, s),
      [TRAJ_FRAMES, 1 / 60, SHAKE_M, SHAKE_DECAY, SEED]);
    const tOld = await page.evaluate(([f, dt, a, d, s]) => window.__sk.trajectory('old', f, dt, a, d, s),
      [TRAJ_FRAMES, 1 / 60, SHAKE_M, SHAKE_DECAY, SEED]);
    const tBad = await page.evaluate(([f, dt, a, d, s]) => window.__sk.trajectory('perturbed', f, dt, a, d, s),
      [TRAJ_FRAMES, 1 / 60, SHAKE_M, SHAKE_DECAY, SEED]);
    const same = trajMaxDelta(tNew, tOld);
    const bad = trajMaxDelta(tNew, tBad);
    log(`  ${TRAJ_FRAMES} frames at 1/60 s, seeded PRNG, identical start`);
    log(`    new vs PRE-FIX        max |Δ| ${same.d} ${same.note}`);
    log(`    new vs PERTURBED      max |Δ| ${bad.d.toExponential(3)} (at frame ${bad.at})`);
    check(same.d === 0, 'shipped trajectory is EXACTLY the pre-fix one', `max |Δ| ${same.d}`);
    check(bad.d > 0, 'the comparison can tell trajectories apart', `perturbed max |Δ| ${bad.d.toExponential(3)}`);

    log('\n══ ARM E — HOLD AT dt = 0, EXIT AT dt > 0 ═════════════════════════════════');
    const hold = await page.evaluate(([n, a, d]) => window.__sk.integrate(n, 0, a, d), [30, SHAKE_M, SHAKE_DECAY]);
    const dAmt = Math.abs(hold.end.amount - hold.start.amount);
    const dOff = Math.max(...hold.end.off.map((v, i) => Math.abs(v - hold.start.off[i])));
    log(`  30 updates at dt=0 · Δamount ${dAmt} · max Δoffset ${dOff} · |offset| ${hold.end.offLen.toFixed(4)} m`);
    check(dAmt === 0 && dOff === 0, 'dt = 0 HOLDS amount and offset exactly', `Δ ${dAmt} / ${dOff}`);
    check(hold.end.offLen > 0, 'and holds a REAL offset, not a zeroed one', `|offset| ${hold.end.offLen.toFixed(4)} m`);

    // 60 frames at 1/60 s is 1.0 s — the 0.18 m kick decaying at 4.5 crosses the
    // 0.002 m exit at ~0.55 s, so a shake still alive here is a shake that never ends.
    const exit = await page.evaluate(([n, a, d]) => window.__sk.integrate(n, 1 / 60, a, d), [60, SHAKE_M, SHAKE_DECAY]);
    log(`  60 updates at 1/60 s · amount ${exit.end.amount} · |offset| ${exit.end.offLen}`);
    check(exit.end.amount === 0, 'dt > 0 still decays to EXACTLY zero', `amount ${exit.end.amount}`);
    check(exit.end.offLen === 0, 'and clears the offset on exit', `|offset| ${exit.end.offLen}`);

    log('\n══ ARM F — THE SHIPPED PAUSE PATH (a player-visible defect, not a probe one) ═');
    // Unfreeze completely: this arm is about the REAL loop, and the paused branch is
    // only reachable from it.
    await page.evaluate(() => { window.__sk.still(); window.__clk.resume(); window.__raf.start(); });
    await page.waitForTimeout(300);
    // The REAL pause chip, clicked. `matchScreen.ts:140` is the only shipped entry to
    // `session.pause()` besides Escape, and `MatchDebug` deliberately exposes no pause
    // method — so a probe that "paused" some other way would be pausing something else.
    await page.locator('[data-el="pause"]').click();
    await page.waitForFunction(() => window.__matchDebug?.paused === true, null, { timeout: 10000 });
    const F = await page.evaluate(([n, a, d]) => window.__sk.pauseDrift(n, false, a, d), [20, SHAKE_M, SHAKE_DECAY]);
    log(`  PAUSED, shake armed at ${F.armedAmount.toFixed(4)} m · ${F.turns} rAF turns · loop ran ${F.loopFrames} frames`);
    log(`    camera moved ${F.maxD.toFixed(6)} m · shakeAmount ${F.armedAmount.toFixed(4)} -> ${F.endAmount.toFixed(4)}`);
    // ⚠️ The liveness guard. "The camera did not move" is also true of a dead page, and
    // `match.ts` publishes `frames` from INSIDE the paused branch for exactly this.
    check(F.loopFrames > 0, 'the paused loop is ALIVE', `${F.loopFrames} frames`);
    check(F.paused === true, 'and the match really is paused', `paused=${F.paused}`);
    check(F.maxD === 0, 'camera is STILL while paused', `${F.maxD.toFixed(6)} m`);

    const Fbad = await page.evaluate(([n, a, d]) => window.__sk.pauseDrift(n, true, a, d), [20, SHAKE_M, SHAKE_DECAY]);
    log(`  same, through the PRE-FIX body · camera moved ${Fbad.maxD.toFixed(6)} m`
      + ` · shakeAmount ${Fbad.armedAmount.toFixed(4)} -> ${Fbad.endAmount.toFixed(4)} after ${Fbad.loopFrames} paused frames`);
    check(Fbad.maxD > 1e-4, 'KNOWN-BAD: the pre-fix body jitters while paused', `${Fbad.maxD.toFixed(6)} m`);
    // ⚠️ And it is PERMANENT, which is the part that makes it a defect rather than a
    // blemish: the decay is `shakeDecay * amount * dt`, so at dt = 0 the amplitude
    // never falls and the jitter lasts exactly as long as the pause does.
    check(Fbad.endAmount === Fbad.armedAmount, 'KNOWN-BAD: …and never decays (permanent)',
      `${Fbad.armedAmount.toFixed(4)} -> ${Fbad.endAmount.toFixed(4)}`);

    // ⚠️ NEITHER BUTTON CAN BE CLICKED HERE, AND BOTH FAILURES ARE THE SAME LESSON.
    //   · the pause CHIP is covered — pausing opens `[data-el="sheet"].match-sheet.is-open`,
    //     which `intercepts pointer events`;
    //   · the sheet's own RESUME button is never `stable` — `matchScreen.ts:262` gives the
    //     sheet `animation: fa-sheet-in 0.2s`, and Playwright's actionability check samples
    //     the bounding box across rAF turns.
    // Both hung for the full 180 s timeout and then THREW, which turned a 21-check green
    // run into `exit 1` twice. `Escape` is a shipped entry to the same toggle
    // (`matchScreen.ts:147`, `PAUSE_KEY`) and needs no actionability at all.
    //
    // ⚠️ And it is ASSERTED, not wrapped in a silent try — a cleanup step that can fail
    // quietly is how a probe leaves the app in a state the next arm misreads. A throw here
    // would skip the summary; a failed `check` prints it and still exits 1.
    let unpaused = false;
    try {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__matchDebug?.paused === false, null, { timeout: 10000 });
      unpaused = true;
    } catch { /* reported by the check below, never swallowed */ }
    check(unpaused, 'unpaused again through the shipped toggle', `paused=${await page.evaluate(() => window.__matchDebug?.paused)}`);
    await page.close();
  } finally {
    await browser.close();
  }

  log(`\n${failures ? 'FAIL' : 'PASS'} — ${checks - failures}/${checks} checks`);
  return failures;
}

// ⚠️ `process.exit()` inside a `try` SKIPS the `finally` (`docs/AGENT-BRIEF.md` §3), so
// the browser is closed by `main`'s own `finally` and the exit happens out here.
const rc = await main();
process.exit(rc ? 1 : 0);
