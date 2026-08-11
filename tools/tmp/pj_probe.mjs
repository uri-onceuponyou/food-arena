#!/usr/bin/env node
/**
 * PROJECTILE LEGIBILITY PROBE — "the tomato projectile is almost invisible."
 *
 * Uri, playing the shipped build: *"The tomato projectile is almost invisible. let's
 * rework all projectiles. they should be vivid and clear until they explode."*
 *
 * `b967242` measured the ground TRAIL as **0.7 degrees of hue from the floor it lay
 * on**, and the same file's prior — `vfx.ts:1345` a 0.5 m sphere in the weapon's own
 * colour, over a ROSE floor — says the projectile could be the same bug. It is not
 * the same bug (see the report), but the only way to know that was to measure it, and
 * nothing in this repo measured a projectile IN FLIGHT against what is behind it.
 *
 * What exists and why it is not this:
 *   `vfx_wcov.mjs`  fires each weapon's `impact`/`cast`/`projectile` hook through
 *                   `__vfxSpawnTest` and counts delivered pixels at the PEAK slice.
 *                   It measures a hook in isolation at t≈0, never a projectile that
 *                   is travelling, and it reports AREA only — a bright 400 px ball
 *                   and a floor-coloured 400 px ball score identically.
 *   `vfx_hue.mjs`   scores TRANSIENTS against the cast. Never against the floor, and
 *                   never for something with a flight.
 *   `trail_probe`   same-frame ablation, but of PERSISTENT GROUND MARKS.
 *
 * ── EVERY NUMBER HERE IS A SAME-FRAME ABLATION ─────────────────────────────────
 *
 * The live projectile meshes are hidden and re-shown inside ONE frozen frame, so the
 * background is read at exactly the pixels the projectile covers, in the same light,
 * through the same post chain, on the same tick. There is no baseline to go stale and
 * no second render to disagree with the first (`docs/LESSONS.md` §5).
 *
 * Reported per weapon, per sample along the flight:
 *
 *   area          delivered px, and % of a 1600x900 frame. "Almost invisible" has a
 *                 size component and it must be separated from a contrast component.
 *   |dL| vs BG    luma step between the projectile's pixels and the background those
 *                 pixels would have shown. This is the load-bearing one.
 *   dHue vs BG    saturation-weighted circular hue distance, same pixels.
 *   |dL| / dHue   the same two against the CAST, because `b967242`'s "fix by hue"
 *     vs CAST     attempt traded a floor collision for a cast collision — the cast
 *                 band and the floor band are only ~0.10 luma apart, so no single
 *                 value is far from both.
 *   contrast      max over the projectile's own pixels of |L − local background|.
 *   headroom      the WEAKEST of the flight samples. A projectile that is legible for
 *                 80% of its flight and vanishes for the last 20% has failed Uri's
 *                 "until they explode" clause, and an average would hide it.
 *
 * ── KNOWN-INPUT CONTROLS (§4 of the brief: an instrument not shown to FAIL is not
 *    an instrument) ────────────────────────────────────────────────────────────────
 *
 *   A  every projectile hidden          -> the ablation must find 0 px
 *   B  forced to #00C000                -> recovered hue must read back ~120
 *   C  FORCED TO THE BACKGROUND'S OWN   -> the tool must call it INVISIBLE. This is
 *      MEASURED COLOUR                     the known-bad the brief names explicitly.
 *   D  self-pair                        -> two measurements of one frozen frame must
 *                                          be identical to 0.0000, not merely close.
 *   E  save/restore integrity, per      -> projectile materials are MODULE-SCOPE
 *      MATERIAL uuid                       SINGLETONS shared by every instance of a
 *                                          weapon (`hamburger.ts:tomatoBodyMat`) and
 *                                          the generic path shares one per COLOUR out
 *                                          of `materialCache`. A per-MESH save reads
 *                                          back what the previous mesh's write already
 *                                          put there and the restore then writes the
 *                                          control colour into the shipped material
 *                                          permanently — verbatim the bug `f12c9de`
 *                                          found in the cast matte.
 *
 * ── TWO CAMERAS ────────────────────────────────────────────────────────────────
 * `--pitch 58` (default) is the shipped match camera — where this is played.
 * `--pitch 20` is the LOBBY-ANALOGUE DETECTOR. There is no lobby projectile, so this
 * is the match rig re-pitched to the lobby's 20 deg and pulled close
 * (`frameMode: 'ground'`, `viewWidthUnits` reduced). ⚠️ Its AREA numbers are NOT
 * shipped-scale and must never be quoted as such; its |dL| and dHue are ratios and
 * are directly comparable, and it answers the question 58 deg cannot: at a shallow
 * look the projectile is silhouetted against DISTANT floor and props, not against the
 * tile directly under it.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/pj_probe.mjs --url {URL}
 *   node tools/tmp/pj_probe.mjs --url $U --selftest              # controls only
 *   node tools/tmp/pj_probe.mjs --url $U --chars hamburger --shots
 *   node tools/tmp/pj_probe.mjs --url $U --pitch 20 --chars hamburger --shots
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
const OUT = String(args.out ?? 'shots/pj');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Per-channel 8-bit step that counts a pixel as "changed by the projectile". Same
 * value `trail_probe`/`vfx_wcov` use, so areas are comparable to their records. */
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
/** How close the shallow detector camera sits, in world units of visible width. Only
 * read when `--pitch` is not the shipped 58. */
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
const SHOTS = !!args.shots;
const SIM_SPEED = String(args.simSpeed ?? '0.35');
/** Real-time ms between flight samples. At simSpeed 0.35 a `SPEED.long` shot crosses
 * its whole range in ~1.6 s of wall clock, so ~9 samples land on it. */
const STEP_MS = Number(args.step ?? 170);
const MAX_SAMPLES = Number(args.maxSamples ?? 14);
/**
 * World units the shot must have travelled before a sample counts.
 *
 * ⚠️ WITHOUT THIS THE "WORST SAMPLE OF THE FLIGHT" WAS THE SPAWN FRAME. A projectile
 * is created at the shooter's own position and chest height, i.e. INSIDE the fighter's
 * silhouette, so its first frame delivers a handful of unoccluded pixels — Lettuce
 * read 680 px at the median and 151 px at its "worst", and the worst sample's distance
 * was 2.8 wu. That is not a legibility fact about the projectile; it is the shooter
 * standing in front of it, and reporting it as the weakest point of the flight would
 * have aimed this whole pass at a frame the player never has to read.
 */
const MIN_DIST = Number(args.minDist ?? 18);
/** Sample stride for the (expensive, 5-render) cast comparison. The cast's own colour
 * does not move during one flight, so measuring it on every sample buys nothing and
 * costs ~40% of the run. */
const CAST_EVERY = Number(args.castEvery ?? 4);
/**
 * World units of travel between samples.
 *
 * ⚠️ SAMPLING ON A CLOCK MEASURED THE FAST WEAPONS AND MISSED THE SLOW ONES. A fixed
 * 200 ms stride gave Tomato (`SPEED.closeFast`) its whole 20-95 wu flight in eight
 * samples and gave Lettuce (`SPEED.maxSlow`, `REACH.rangedMax`) **two samples, both
 * inside 25 wu** — so "the weakest point of the flight" was being read off the first
 * 12% of it for exactly the weapons whose far end is most in question. Sampling on
 * DISTANCE makes the schedule a property of the flight rather than of the sim speed,
 * and the numbers become comparable across weapons that differ 4x in speed.
 */
const DIST_STEP = Number(args.distStep ?? 12);
/** Wall-clock ceiling per weapon, seconds. A slow shot at `simSpeed 0.35` crossing
 * `REACH.rangedMax` is ~6 s of real time; this is the guard against a shot that
 * somehow never retires, not a normal exit. */
const FLIGHT_BUDGET_S = Number(args.budget ?? 70);

/** Every ranged weapon in the game, `characterId -> [weaponSlotIndex, key, colour]`.
 * Slot index is the 1-based digit key. Extracted from `src/game/rules.ts` at startup
 * rather than hardcoded — a peer is editing that file for DECISIONS §49 and a stale
 * copy of a weapon table is exactly how a probe measures a game that no longer
 * exists. Parsed, not imported: `rules.ts` is TypeScript and this is a .mjs. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const REPO = resolve(new URL('../..', import.meta.url).pathname);

async function rangedWeapons() {
  const src = await readFile(resolve(REPO, 'src/game/rules.ts'), 'utf8');
  const out = new Map();
  // Character blocks look like `  hamburger: {` ... `weapons: [` ... `]`.
  const charRe = /^ {2}(\w+): \{$/gm;
  const chars = [];
  let m;
  while ((m = charRe.exec(src))) chars.push({ id: m[1], at: m.index });
  for (let i = 0; i < chars.length; i++) {
    const body = src.slice(chars[i].at, i + 1 < chars.length ? chars[i + 1].at : src.length);
    const wStart = body.indexOf('weapons: [');
    if (wStart < 0) continue;
    const weapons = [];
    // Each weapon literal starts with `{ key: '...'` or `{\n ... key: '...'`.
    const keyRe = /key: '([^']+)',\s*name: '([^']+)',\s*type: '(\w+)'/g;
    const seg = body.slice(wStart);
    let k;
    while ((k = keyRe.exec(seg))) {
      // Colour is the first `color: '#...'` after this key, inside the same literal.
      const after = seg.slice(k.index, k.index + 700);
      const c = /color: '(#[0-9A-Fa-f]{6})'/.exec(after);
      weapons.push({ key: k[1], name: k[2], type: k[3], color: c ? c[1].toUpperCase() : null });
      if (weapons.length >= 4) break;
    }
    if (weapons.length) out.set(chars[i].id, weapons);
  }
  return out;
}

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });
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
     * 🚨 STOPPING THE CLOCK IS NOT STOPPING THE LOOP — `docs/AGENT-BRIEF.md` §3, and
     * this probe paid for it twice.
     *
     * With `performance.now` frozen the SIM does not advance (`THREE.Clock.getDelta()`
     * returns 0), but `requestAnimationFrame` keeps firing and `GameSession.frame()`
     * keeps running: `vfx.sync()`, `updateEffects()`, `updateContactShadows()`, the
     * shadow-map fingerprint and the whole post chain all execute again between any
     * two `page.evaluate` calls. That is enough to move pixels, and it is why the
     * self-pair drifted on 328 of 329 frozen frames after the camera shake had already
     * been ruled out and two warm-up renders had failed to help.
     *
     * This holds the rAF callbacks instead of dropping them, so the loop resumes
     * exactly where it was rather than dying — a dropped callback means the game loop
     * never restarts and every later sample measures a dead page.
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
  await page.evaluate(([rw, rh, delta]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const c2d = cv.getContext('2d', { willReadFrequently: true });

    /**
     * 🚨 A FROZEN CLOCK DOES NOT STILL THE CAMERA SHAKE. IT MAKES IT PERMANENT.
     *
     * `render/camera.ts:CameraRig.update(dt)`:
     *
     *     if (this.shakeAmount > 0.0001) {
     *       this.shakeAmount = Math.max(0, this.shakeAmount - this.shakeDecay * this.shakeAmount * dtSeconds);
     *       this.shakeOffset.set(random..a, random..a*0.4, random..a);
     *
     * The DECAY is multiplied by `dtSeconds`; the RE-RANDOMISATION is not. So at
     * `dt = 0` the amount never falls, the branch never exits, and **every single
     * `stage.render()` call moves the camera to a new random offset** — and
     * `Stage.render()` calls `rig.update()` before it draws, so this probe's own
     * `grab()` was re-rolling the camera between the two halves of its own ablation.
     *
     * Firing a weapon kicks the camera (`match.ts` -> `rig.shake`), so this is live on
     * exactly the frames this probe measures. It is what the self-pair caught: **344
     * of 344 frozen frames drifted**, up to 349 px of mask and 0.16 of luma, on both
     * arms. The mask was the difference between two frames taken from two different
     * cameras, which is `docs/LESSONS.md` §5's "a mask from one render and a value from
     * another is a lie wherever they disagree" — in the one place a same-frame ablation
     * was supposed to make that impossible.
     *
     * `feel_probe.mjs` already knew, in its own words: *"the pixel diff is taken with
     * the shake offset forced to zero"*. It never generalised, and nothing checked.
     * Zeroed here before every render. Reported for `render/camera.ts`'s owner —
     * `shakeAmount` should decay on a frame count or be cleared when `dt` is 0, so that
     * every OTHER rAF-frozen probe in this repo stops measuring a moving camera.
     */
    const stillCamera = () => {
      const rig = stage.rig;
      if (!rig) return;
      rig.shakeAmount = 0;
      if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
    };

    const grab = () => {
      stillCamera();
      stage.render(0);
      c2d.clearRect(0, 0, rw, rh);
      c2d.drawImage(stage.canvas, 0, 0, rw, rh);
      return c2d.getImageData(0, 0, rw, rh).data;
    };

    // Identical to `trail_probe.mjs`'s and `vfx_hue.mjs`'s, deliberately: the hue
    // contract's numbers in `game/vfx.ts` were produced by this formula and these
    // have to be comparable to them (`docs/LESSONS.md` §3 — never compare numbers
    // across instruments that define the quantity differently).
    const hsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d > 1e-6) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      const l = (mx + mn) / 2;
      const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return [h, s, l];
    };

    const stats = (img, idx) => {
      let sx = 0, sy = 0, ssum = 0, lsum = 0, l2 = 0;
      for (const p of idx) {
        const i = p * 4;
        const [h, s, l] = hsl(img[i], img[i + 1], img[i + 2]);
        const a = (h * Math.PI) / 180;
        sx += Math.cos(a) * s; sy += Math.sin(a) * s;
        ssum += s; lsum += l; l2 += l * l;
      }
      const n = idx.length || 1;
      let hm = (Math.atan2(sy, sx) * 180) / Math.PI; if (hm < 0) hm += 360;
      const mean = lsum / n;
      return {
        n: idx.length,
        hue: +hm.toFixed(1),
        sat: +(ssum / n).toFixed(3),
        luma: +mean.toFixed(4),
        lStdev: +Math.sqrt(Math.max(0, l2 / n - mean * mean)).toFixed(4),
      };
    };

    /**
     * THE LIVE PROJECTILES.
     *
     * `VfxLayer.projectilePool` is `private` in TypeScript, which is a COMPILE-TIME
     * annotation and nothing at runtime — the Map is right there on the instance.
     * Reading it is deliberate and is the only handle that works on BOTH arms of an
     * A/B: on HEAD these objects carry no `name` at all, so a name-based traversal
     * (the pattern `docs/AGENT-BRIEF.md` §3 asks for, and which the fix adds) would
     * silently find nothing on the "before" arm and report a projectile that
     * delivers zero pixels — a false confirmation of the very bug under test.
     */
    const projRoots = () => {
      const layer = window.__vfxLayer;
      if (!layer || !layer.projectilePool) return [];
      const out = [...layer.projectilePool.values()].filter((o) => o.visible);
      // ── AND anything in the VFX layer NAMED as part of a projectile ────────────
      //
      // The pool alone was the only handle that worked on HEAD, where these objects
      // carry no `name`. It stops being sufficient the moment the projectile grows
      // anything that is not IN the pool — which is exactly what the legibility shell
      // is (a separate pooled Group, because five weapon files overwrite the pooled
      // projectile's own scale and rotation every frame).
      //
      // 🚨 IF THIS WERE POOL-ONLY, THE "AFTER" ARM WOULD ABLATE THE SCULPT AND LEAVE
      // THE HALO STANDING, AND THE HALO'S OWN PIXELS WOULD BE COUNTED AS BACKGROUND —
      // a fix measured as having done nothing, which is the most dangerous result
      // available here because a null result is a normal outcome and nobody re-checks
      // it (`docs/AGENT-BRIEF.md` §3). Name-based collection is additive and both
      // arms run the same code: HEAD simply has no names to find.
      const seen = new Set(out);
      let layerRoot = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layerRoot = o; });
      if (layerRoot) {
        layerRoot.traverse((o) => {
          if (typeof o.name === 'string' && o.name.startsWith('projectile') && o.visible && !seen.has(o)) {
            // Only take ROOTS — a shell Group's halo/shadow children are named too and
            // would otherwise be hidden twice and counted once.
            if (!seen.has(o.parent) && (!o.parent || !String(o.parent.name || '').startsWith('projectile'))) {
              seen.add(o); out.push(o);
            }
          }
        });
      }
      return out;
    };
    /**
     * The transients a projectile sheds WHILE FLYING — Tomato's juice drips, Donut's
     * ring echoes, Burrito's shed toppings. They live in `VfxLayer.transientEffects`,
     * not in the projectile pool, so a pool-only ablation cannot see them.
     *
     * ⚠️ This is not a nicety. Uri's report is about what the projectile READS AS in
     * the air, and a fix that made the drips louder would be invisible to a pool-only
     * metric — `docs/AGENT-BRIEF.md` §4.6: "an acceptance test proves you moved the
     * thing you NAMED, not that it was the thing". Both numbers are reported; `proj`
     * is what this pass can change directly, `flight` is what the player sees.
     */
    const transientRoots = () => {
      const layer = window.__vfxLayer;
      if (!layer || !layer.transientEffects) return [];
      return layer.transientEffects.map((e) => e.object).filter((o) => o && o.visible);
    };
    /**
     * EVERY transient this layer can draw — the bespoke `spawnTransient` list AND the
     * three FIXED POOLS.
     *
     * 🚨 `transientEffects` ALONE MISSES THE ENTIRE GENERIC IMPACT BURST. `vfx.ts`
     * builds `particles` (sprites), `rings` and `wedges` as fixed pools in its
     * constructor and reuses them; only a bespoke weapon hook's `ctx.spawnTransient`
     * objects land in `transientEffects`. `b967242` measured the burst as ~90% RINGS,
     * so a burst measurement built on `transientEffects` would have reported roughly a
     * tenth of it for the ten weapons that take the generic path — and would have
     * reported it confidently.
     */
    const burstRoots = () => {
      const layer = window.__vfxLayer;
      if (!layer) return [];
      const out = [...transientRoots()];
      for (const key of ['particles', 'rings', 'wedges']) {
        for (const slot of layer[key] ?? []) {
          const o = slot.sprite ?? slot.mesh;
          if (o && o.visible) out.push(o);
        }
      }
      return out;
    };
    // ⚠️ `isSprite` AS WELL AS `isMesh`. `THREE.Sprite` is not a `Mesh`, and the
    // legibility halo is a sprite (billboarding for free, the same idiom the particle
    // pool in `vfx.ts` already uses). An `isMesh`-only walk would silently leave the
    // halo's material out of controls B and C — i.e. the known-bad inputs would be
    // applied to everything EXCEPT the thing under test, and would still pass.
    const meshesOf = (roots) => {
      const out = [];
      for (const root of roots) root.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible) out.push(o); });
      return out;
    };
    const projMeshes = () => meshesOf(projRoots());
    const castRoots = () => {
      const out = [];
      stage.scene.traverse((o) => {
        if (typeof o.name === 'string' && o.name.startsWith('character:') && o.visible) out.push(o);
      });
      return out;
    };

    const maskOf = (a, b) => {
      const idx = [];
      for (let i = 0, p = 0; i < a.length; i += 4, p++) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d >= delta) idx.push(p);
      }
      return idx;
    };
    const toSet = (idx) => { const s = new Uint8Array(rw * rh); for (const p of idx) s[p] = 1; return s; };
    const erode = (s) => {
      const o = new Uint8Array(s.length);
      for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
        const p = y * rw + x;
        if (!s[p]) continue;
        if (x > 0 && !s[p - 1]) continue;
        if (x < rw - 1 && !s[p + 1]) continue;
        if (y > 0 && !s[p - rw]) continue;
        if (y < rh - 1 && !s[p + rw]) continue;
        o[p] = 1;
      }
      return o;
    };

    /**
     * OKLab. Ten lines, and it is the difference between a metric that can express
     * "vivid and clear" and one that cannot.
     *
     * `|dL|` and `dHue` are reported separately because the hue contract in
     * `game/vfx.ts` and `b967242`'s trail numbers are stated in them and must stay
     * comparable. But they answer half the question each: a projectile can clear the
     * floor by 40 degrees of hue at matched luma and still be hard to find, and the
     * `dHue` of a NEAR-GREY pixel is numerically enormous and perceptually nothing.
     * OKLab is perceptually uniform enough that one Euclidean distance covers both,
     * and it does not need a saturation weighting bolted on to stop grey pixels
     * dominating a circular mean.
     */
    const oklab = (r, g, b) => {
      const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const R = lin(r), G = lin(g), B = lin(b);
      const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
      const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
      const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
      return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 0.2428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
      ];
    };

    /**
     * PER-PIXEL SEPARATION FROM THE LOCAL BACKGROUND.
     *
     * ⚠️ `|mean(projectile) − mean(background)|` CANCELS, and this project has already
     * paid for that once: `trail_probe`'s first version reported a plainly legible
     * character's separation as 0.0008 because a light half and a dark half averaged
     * to the ground between them. A projectile with a bright core and a dark rim is
     * exactly that shape. So this takes, per projectile pixel, the distance from the
     * MEAN OF THE BACKGROUND PIXELS WITHIN R — the background read from the ablated
     * frame, so a neighbouring projectile pixel can never enter its own surround.
     *
     * Reported as luma-only (`l*`, comparable to every |dL| already on record here)
     * and as OKLab `dE` (the one to act on). Mean and 90th percentile of each: an eye
     * finds a small object by its strongest step, not its average one.
     */
    const localDelta = (imgOn, imgOff, idx) => {
      const inSet = toSet(idx);
      const R = 5;
      const lVals = [], eVals = [];
      for (const p of idx) {
        const x = p % rw, y = (p / rw) | 0;
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= rh) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= rw) continue;
            const q = yy * rw + xx;
            if (inSet[q]) continue;          // the surround must be BACKGROUND ONLY
            const j = q * 4;
            sr += imgOff[j]; sg += imgOff[j + 1]; sb += imgOff[j + 2]; n++;
          }
        }
        if (!n) continue;
        const i = p * 4;
        const a = oklab(imgOn[i], imgOn[i + 1], imgOn[i + 2]);
        const b = oklab(sr / n, sg / n, sb / n);
        eVals.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
        lVals.push(Math.abs(hsl(imgOn[i], imgOn[i + 1], imgOn[i + 2])[2] - hsl(sr / n, sg / n, sb / n)[2]));
      }
      if (!eVals.length) return { mean: 0, p90: 0, deMean: 0, deP90: 0, deMed: 0 };
      const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
      const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      return {
        mean: +avg(lVals).toFixed(4), p90: +q(lVals, 0.9).toFixed(4),
        deMean: +avg(eVals).toFixed(4), deP90: +q(eVals, 0.9).toFixed(4), deMed: +q(eVals, 0.5).toFixed(4),
      };
    };

    /** Group live projectile meshes by MATERIAL — see `controlPaint`. */
    const matGroups = () => {
      const byMat = new Map();
      for (const o of projMeshes()) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          if (!byMat.has(m.uuid)) byMat.set(m.uuid, m);
        }
      }
      return [...byMat.values()];
    };

    /** Roots that are the legibility SHELL rather than the projectile sculpt. Empty on
     * any tree that predates the shell, which is what makes the controls below run
     * identically on both arms of the A/B. */
    const shellRoots = () => projRoots().filter((o) => String(o.name || '').startsWith('projectile_shell'));
    const sculptRoots = () => projRoots().filter((o) => !String(o.name || '').startsWith('projectile_shell'));
    /** Run `fn` with the shell hidden and restore it afterwards, whatever `fn` throws. */
    const withShellsHidden = (fn) => {
      const s = shellRoots();
      for (const o of s) o.visible = false;
      try { return fn(); } finally { for (const o of s) o.visible = true; }
    };

    const coreOf = (roots) => {
      if (!roots.length) return { n: 0, roots: 0 };
      const on = grab();
      for (const o of roots) o.visible = false;
      const off = grab();
      for (const o of roots) o.visible = true;
      const idx = maskOf(on, off);
      if (!idx.length) return { n: 0, roots: roots.length };
      const proj = stats(on, idx);
      const bg = stats(off, idx);
      const lc = localDelta(on, off, idx);
      return {
        n: idx.length,
        roots: roots.length,
        coverage: +(idx.length / (rw * rh)).toFixed(5),
        proj, bg,
        dL: +Math.abs(proj.luma - bg.luma).toFixed(4),
        dHue: +(() => { const d = Math.abs(proj.hue - bg.hue) % 360; return d > 180 ? 360 - d : d; })().toFixed(1),
        dSat: +(proj.sat - bg.sat).toFixed(3),
        contrastMean: lc.mean,
        contrastP90: lc.p90,
        deMean: lc.deMean, deP90: lc.deP90, deMed: lc.deMed,
      };
    };
    const core = (withTransients) =>
      coreOf(withTransients ? [...projRoots(), ...transientRoots()] : projRoots());

    window.__pj = {
      census() {
        const roots = projRoots();
        const f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
        return {
          roots: roots.length,
          meshes: projMeshes().length,
          transients: transientRoots().length,
          materials: matGroups().length,
          names: roots.map((o) => o.name || '(unnamed)'),
          // Distance from the shooter, in world units — the flight-progress axis.
          distUnits: roots.map((o) => {
            if (!f) return null;
            const dx = o.position.x / 0.05 - f.x, dz = o.position.z / 0.05 - f.y;
            return +Math.sqrt(dx * dx + dz * dz).toFixed(1);
          }),
          casts: castRoots().length,
        };
      },

      /** THE HEADLINE. Hide the projectiles, re-show them, compare over exactly the
       * pixels that moved. */
      measure() { return core(false); },
      /** The same, including everything the projectile is shedding as it flies. */
      measureFlight() { return core(true); },

      /** The projectile against the CAST, in the same frozen frame. `b967242`'s
       * rejected iteration traded a floor collision for a cast collision; a fix that
       * only reports the background it happens to be over has not checked that. */
      vsCast() {
        const casts = castRoots();
        const roots = projRoots();
        if (!casts.length || !roots.length) return null;
        const shipped = grab();
        for (const o of casts) o.visible = false;
        const noCast = grab();
        for (const o of casts) o.visible = true;
        let castSet = toSet(maskOf(shipped, noCast));
        for (let i = 0; i < 2; i++) castSet = erode(castSet);   // pure cast, no AA edge
        const castIdx = [];
        for (let p = 0; p < castSet.length; p++) if (castSet[p]) castIdx.push(p);
        if (castIdx.length < 100) return null;
        for (const o of roots) o.visible = false;
        const noProj = grab();
        for (const o of roots) o.visible = true;
        const projIdx = maskOf(shipped, noProj);
        if (!projIdx.length) return null;
        const cast = stats(shipped, castIdx);
        const proj = stats(shipped, projIdx);
        return {
          cast, proj,
          dL: +Math.abs(proj.luma - cast.luma).toFixed(4),
          dHue: +(() => { const d = Math.abs(proj.hue - cast.hue) % 360; return d > 180 ? 360 - d : d; })().toFixed(1),
        };
      },

      /** CONTROL A — every projectile hidden. The ablation must find nothing. */
      controlHidden() {
        const roots = projRoots();
        for (const o of roots) o.visible = false;
        const r = core(false);
        for (const o of roots) o.visible = true;
        return r;
      },

      /**
       * CONTROL B/C — force every projectile material to one colour and re-measure.
       *
       * ⚠️ SAVED AND RESTORED PER *MATERIAL*, NOT PER MESH. Bespoke projectiles share
       * module-scope singletons (`hamburger.ts:tomatoBodyMat` is one object for every
       * tomato ever fired) and the generic path shares one material per COLOUR out of
       * `materialCache`. A per-mesh save reads back what the previous mesh's write
       * already put there and the restore loop then writes the CONTROL colour into the
       * shipped material — permanently, in a pooled material the running game reuses
       * forever. Verbatim the bug `f12c9de` found in the cast matte.
       */
      /**
       * CONTROL C's OPERANDS — measured with the legibility SHELL HIDDEN.
       *
       * ⚠️ THE FIRST VERSION OF CONTROL C PASSED ON HEAD AND FAILED ON THE FIX, AND
       * THE FIX WAS RIGHT. "Force the projectile to the background's own colour and
       * require the tool to call it invisible" is an assertion about the INSTRUMENT,
       * and it stops being one the moment the object under test carries a texture
       * whose own value structure survives any colour you assign: the halo's map is a
       * multiplier running 1.00 (body) to 0.27 (rim), so a halo painted the exact
       * colour of the floor still draws a dark ring on it. dE fell 0.2506 -> 0.2109
       * and the control refused the run.
       *
       * That is a true fact about the halo — its legibility does not depend on its
       * colour, which is the property that makes it robust — and a useless control.
       * Running C on the SCULPT with the shell hidden asks the same question of the
       * same object on both arms, and a probe that had lost track of which pixels were
       * the projectile still could not reproduce "mean hue and luma land on the
       * background's".
       */
      shippedSculpt() { return withShellsHidden(() => coreOf(sculptRoots())); },
      controlSculptPaint(hex) {
        return withShellsHidden(() => {
          const mats = [];
          const seen = new Set();
          for (const o of meshesOf(sculptRoots())) {
            for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
              if (m && !seen.has(m.uuid)) { seen.add(m.uuid); mats.push(m); }
            }
          }
          const saved = mats.map((m) => ({ m, c: m.color ? m.color.clone() : null, e: m.emissive ? m.emissive.clone() : null, op: m.opacity, tr: m.transparent }));
          for (const s of saved) {
            if (s.c) s.m.color.set(hex);
            if (s.e) s.m.emissive.set('#000000');
            s.m.opacity = 1; s.m.transparent = false;
          }
          const r = coreOf(sculptRoots());
          for (const s of saved) {
            if (s.c) s.m.color.copy(s.c);
            if (s.e) s.m.emissive.copy(s.e);
            s.m.opacity = s.op; s.m.transparent = s.tr;
          }
          return r;
        });
      },
      /**
       * CONTROL F — is the SHELL actually inside the ablation?
       *
       * 🚨 THE SINGLE MOST DANGEROUS FAILURE AVAILABLE TO THIS PROBE is measuring the
       * "after" arm with the halo left standing: the halo's own pixels would be counted
       * as BACKGROUND, the sculpt would ablate against them, and the fix would read as
       * having done nothing — a null result, which is a normal outcome here and which
       * nobody re-checks. This asserts the difference directly. On a tree with no shell
       * it must be exactly 0; on a tree with one it must be large.
       */
      /** The impact burst's delivered pixels, in the SAME units as the flight numbers
       * — so "does the hit still read as a separate event from the flight" is a ratio
       * and not an opinion. See `burstRoots` for why it is not `transientEffects`. */
      measureBurst() { return coreOf(burstRoots()); },
      shellSeparable() {
        const all = coreOf(projRoots());
        const sculpt = withShellsHidden(() => coreOf(sculptRoots()));
        return { all: all.n, sculpt: sculpt.n, shells: shellRoots().length, delta: all.n - sculpt.n };
      },
      controlPaint(hex) {
        const mats = matGroups();
        const saved = mats.map((m) => ({
          m,
          c: m.color ? m.color.clone() : null,
          e: m.emissive ? m.emissive.clone() : null,
          op: m.opacity, tr: m.transparent,
        }));
        for (const s of saved) {
          if (s.c) s.m.color.set(hex);
          if (s.e) s.m.emissive.set('#000000');
          s.m.opacity = 1; s.m.transparent = false;
        }
        const r = core(false);
        for (const s of saved) {
          if (s.c) s.m.color.copy(s.c);
          if (s.e) s.m.emissive.copy(s.e);
          s.m.opacity = s.op; s.m.transparent = s.tr;
        }
        return r;
      },

      /** CONTROL E — material state is byte-identical after a paint round trip. */
      controlRestore() {
        const before = matGroups().map((m) => (m.color ? m.color.getHexString() : '-') + '/' + m.opacity + '/' + m.transparent);
        window.__pj.controlPaint('#00C000');
        const after = matGroups().map((m) => (m.color ? m.color.getHexString() : '-') + '/' + m.opacity + '/' + m.transparent);
        return { before, after, same: before.length === after.length && before.every((v, i) => v === after[i]) };
      },

      /** Re-pitch the shipped match rig. See the header: this is a DETECTOR view, not
       * shipped framing, and its AREA numbers are not comparable to pitch 58's. */
      setPitch(deg, widthUnits) {
        const rig = stage.rig;
        if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },

      /**
       * DRAW CALLS, TRIANGLES, PROGRAMS AND MATERIALS **WITH PROJECTILES LIVE**.
       *
       * 🚨 `tools/perf.mjs --mode counts --scene match-vfx` CANNOT PRICE THIS AND
       * RETURNED A PERFECT NULL. Its scene is `?player=lollipop&enemy=pizza`, and
       * Lollipop is the one character in the roster with **no ranged weapon at all**
       * (`rules.ts`: Smash and Giant, both melee) — while the AI opponent spawns 1080
       * wu away against weapons that reach at most 220. So both arms sampled a frame
       * containing ZERO projectiles and returned byte-identical 957 draws / 508,526
       * tris / 38 programs. That is a true and useless answer: it prices the change at
       * rest, which is where it costs nothing by construction.
       *
       * This reads three's own counters off the SAME frozen mid-flight frame every
       * other number here comes from, so the cost is measured where it is paid.
       */
      counts() {
        // ⚠️ `info.autoReset` is TRUE by default, and three resets the counters at the
        // START of every `renderer.render()`. The post chain is three passes, so a
        // naive read after `stage.render()` returns the counts of the LAST pass alone
        // (SMAA: 1 draw, 1 triangle) and looks like a scene with nothing in it. Turned
        // off, reset once, and read after the whole frame — which is the same thing
        // `tools/perf.mjs` does and the only way the number means "per frame".
        const r0 = stage.renderer;
        const prevAuto = r0.info.autoReset;
        r0.info.autoReset = false;
        r0.info.reset();
        stillCamera();
        stage.render(0);
        r0.info.autoReset = prevAuto;
        const info = stage.renderer.info;
        const mats = new Set();
        let layerObjs = 0;
        stage.scene.traverse((o) => {
          if (o.name === 'vfx_layer') o.traverse((c) => { if (c.isMesh || c.isSprite) layerObjs++; });
        });
        stage.scene.traverse((o) => {
          for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) mats.add(m.uuid);
        });
        return {
          calls: info.render.calls,
          triangles: info.render.triangles,
          programs: stage.renderer.info.programs ? stage.renderer.info.programs.length : null,
          materials: mats.size,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          vfxRenderables: layerObjs,
          liveProjectiles: projRoots().length,
        };
      },
      /**
       * IS `stage.render()` ITSELF DETERMINISTIC ON A FROZEN SCENE?
       *
       * Every `grab()` in this file assumes it is. The self-pair said otherwise on 328
       * of 329 frames, and two candidate causes were tested and cleared: the camera
       * shake (zeroed — `stillCamera`) and the rAF game loop (halted — `__raf.stop`).
       * This is the third: N renders of ONE untouched scene inside ONE `page.evaluate`,
       * with nothing at all running between them, diffed pairwise. If these differ,
       * the post chain carries frame-to-frame state and NO same-frame ablation in this
       * repo is exact — including `trail_probe`'s and `feel_probe`'s.
       */
      renderRepeat(n) {
        const frames = [];
        for (let i = 0; i < n; i++) frames.push(grab().slice());
        const out = [];
        for (let i = 1; i < frames.length; i++) {
          let diff = 0, worst = 0;
          for (let p = 0; p < frames[i].length; p += 4) {
            const d = Math.max(
              Math.abs(frames[i][p] - frames[i - 1][p]),
              Math.abs(frames[i][p + 1] - frames[i - 1][p + 1]),
              Math.abs(frames[i][p + 2] - frames[i - 1][p + 2]));
            if (d > 0) diff++;
            if (d > worst) worst = d;
          }
          out.push({ pair: `${i - 1}v${i}`, changed: diff, maxChannelDelta: worst });
        }
        // Also the 0-vs-2 pair, which is what a 2-cycle ping-pong buffer would make
        // ZERO while every consecutive pair is non-zero.
        if (frames.length > 2) {
          let diff = 0;
          for (let p = 0; p < frames[0].length; p += 4) {
            if (Math.max(Math.abs(frames[2][p] - frames[0][p]),
              Math.abs(frames[2][p + 1] - frames[0][p + 1]),
              Math.abs(frames[2][p + 2] - frames[0][p + 2])) > 0) diff++;
          }
          out.push({ pair: '0v2', changed: diff, maxChannelDelta: null });
        }
        return { total: rw * rh, pairs: out };
      },
      shot() { stage.render(0); },
    };
  }, [RW, RH, DELTA]);
}
/* eslint-enable */

/** Poll a page-side predicate. Returns the last value, whether or not it ever held. */
async function poll(page, fn, ms = 4000, every = 60) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    last = await page.evaluate(fn);
    if (last) return last;
    await page.waitForTimeout(every);
  }
  return last;
}

/**
 * Select a weapon slot and PROVE the sim took it.
 *
 * ⚠️ A single `keyboard.press` + fixed sleep silently failed on the first run: the
 * probe asked for slot 3, `MatchDebug.selectedWeapon` still said slot 2, and the row
 * was skipped. Under SwiftShader the loop runs at ~5-15 fps, so a 120 ms sleep is
 * sometimes zero frames — the classic "measuring your own setup" failure
 * (`docs/LESSONS.md` §10). Poll the SIM's own mirror instead.
 */
async function selectWeapon(page, slot) {
  for (let tries = 0; tries < 4; tries++) {
    await page.keyboard.press(String(slot));
    const ok = await poll(page, `window.__matchDebug && window.__matchDebug.selectedWeapon === ${slot - 1}`, 1500);
    if (ok) return true;
  }
  return false;
}

/**
 * Fire the selected weapon ONCE and walk the flight, freezing the clock at every
 * sample so the ablation and the PNG describe the same instant.
 *
 * ⚠️ The first version held the button for a fixed 60 ms and produced ZERO
 * projectiles on every weapon. `attackHeld` is polled once per rendered frame, and at
 * SwiftShader's frame rate 60 ms can span no frames at all. It now holds until the
 * SIM says it is firing (`__vfxQaCounts.cast`, a real `weapon-fired` event — not the
 * mouse handler and not a pixel, which is the same edge `input_accept.mjs` asserts
 * on) and releases the instant a projectile exists, so exactly one volley flies.
 */
async function flight(page, { samples = MAX_SAMPLES, stepMs = STEP_MS, shotTag = null } = {}) {
  // ⚠️ DRAIN FIRST. The first run measured LETTUCE and labelled it TOMATO: the
  // previous weapon's shot was still in the air when the next one fired, the pool
  // poll returned instantly on the stale projectile, and the ablation averaged two
  // weapons under one name. It was caught only because the recovered hue (108 deg off
  // the floor) was green and Tomato is red — i.e. by a number that could not be true,
  // not by a check. This is the check.
  await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size === 0', 12000, 120);
  const at = await page.evaluate(() => (window.__vfxDebugScreen && window.__vfxDebugScreen.player) || null);
  if (!at) return { samples: [], fired: false, why: 'no __vfxDebugScreen.player' };
  // Aim ACROSS the screen rather than up it: at pitch 58 a shot aimed at the top of
  // the frame recedes toward the horizon and its apparent size collapses for reasons
  // that have nothing to do with its colour. Sideways keeps the flight in the same
  // depth band, which is the band a player actually shoots in.
  await page.mouse.move(Math.round(at.x + Math.min(320, W * 0.2)), Math.round(at.y));
  const casts0 = await page.evaluate(() => (window.__vfxQaCounts && window.__vfxQaCounts.cast) || 0);
  await page.mouse.down();
  const held = await poll(page, 'window.__matchDebug && window.__matchDebug.attack === true', 4000);
  const spawned = await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size > 0', 6000);
  await page.mouse.up();
  const casts1 = await page.evaluate(() => (window.__vfxQaCounts && window.__vfxQaCounts.cast) || 0);
  if (!spawned) return { samples: [], fired: casts1 > casts0, why: `attack=${held} casts ${casts0}->${casts1}, pool never non-empty` };

  // Page-side "how far has it flown", evaluated between freezes. Cheap (no render),
  // so it can be polled at a fine cadence without costing SwiftShader anything.
  const DIST_EXPR = `(() => { const l = window.__vfxLayer, f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
    if (!l || !f || !l.projectilePool.size) return -1;
    const o = [...l.projectilePool.values()][0];
    return Math.hypot(o.position.x / 0.05 - f.x, o.position.z / 0.05 - f.y); })()`;

  const out = [];
  const t0 = Date.now();
  let nextAt = MIN_DIST;
  for (let i = 0; i < samples; i++) {
    // Advance to the next DISTANCE gate rather than the next clock tick — see
    // `DIST_STEP`. `d < 0` means the pool is empty, i.e. the shot is over.
    let d = await page.evaluate(DIST_EXPR);
    while (d >= 0 && d < nextAt && (Date.now() - t0) / 1000 < FLIGHT_BUDGET_S) {
      await page.waitForTimeout(stepMs);
      d = await page.evaluate(DIST_EXPR);
    }
    if (d < 0) break;                                     // flight over
    nextAt = d + DIST_STEP;

    await page.evaluate(() => { window.__clk.pause(); window.__raf.stop(); });
    await page.waitForTimeout(50);
    // ⚠️ WARM-UP RENDER. `docs/AGENT-BRIEF.md` §3's fresh-snapshot warm-up, one level
    // down: the FIRST `stage.render()` after the clock is paused is not the same as
    // the second. Without this the self-pair drifted on 328 of 329 frozen frames —
    // REPRODUCIBLY, to the fourth decimal, which is what ruled out the camera shake
    // and pointed at a settling effect rather than a random one. The pair is the
    // instrument's own drift control and it is not allowed to be "small"; it is
    // allowed to be zero.
    await page.evaluate(() => { window.__pj.shot(); window.__pj.shot(); });
    const census = await page.evaluate(() => window.__pj.census());
    const far = census.roots > 0 && (census.distUnits[0] ?? 0) >= MIN_DIST;
    if (far) {
      const m = await page.evaluate(() => window.__pj.measure());
      const m2 = await page.evaluate(() => window.__pj.measure());   // CONTROL D, self-pair
      const fa = await page.evaluate(() => window.__pj.measureFlight());
      const cast = out.length % CAST_EVERY === 0 ? await page.evaluate(() => window.__pj.vsCast()) : null;
      // ⚠️ `m2.n === 0` is REAL and is not a drift failure: the rAF loop keeps running
      // between two `page.evaluate` calls even with the clock paused, and a
      // `stepMatch(0)` still retires a projectile that has already passed its max
      // range. That is the DEATH FRAME. Treating it as a self-pair mismatch would
      // report a drift the instrument does not have; dropping the sample is correct,
      // because there is no projectile in it to measure.
      if (m.n > 0 && m2.n > 0) {
        out.push({ i, census, m, flight: fa, selfPair: { n: m2.n - m.n, dL: +(m2.dL - m.dL).toFixed(6), de: +(m2.deMed - m.deMed).toFixed(6), luma: +(m2.proj.luma - m.proj.luma).toFixed(6) }, cast });
        if (shotTag) {
          await page.evaluate(() => window.__pj.shot());
          // `.near` is the first live frame; `.far` is rewritten on EVERY live frame,
          // so the file left behind is the LAST one the projectile existed in — the
          // far end of its range, which is the half of "vivid and clear UNTIL they
          // explode" that an average over the flight would hide.
          await page.screenshot({ path: `${OUT}/${shotTag}.${out.length === 1 ? 'near' : 'far'}.png` });
        }
      }
    } else if (out.length) {
      await page.evaluate(() => { window.__raf.start(); window.__clk.resume(); });
      break;                                             // flight over
    }
    await page.evaluate(() => { window.__raf.start(); window.__clk.resume(); });
    if ((Date.now() - t0) / 1000 >= FLIGHT_BUDGET_S) break;
  }
  return { samples: out, fired: true, why: null };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const table = await rangedWeapons();
  const wantChars = args.chars ? String(args.chars).split(',') : [...table.keys()];
  const ONLYW = args.weapon ? String(args.weapon) : null;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let failures = 0;
  const results = [];
  try {
    for (const charId of wantChars) {
      const weapons = table.get(charId);
      if (!weapons) { log(`  (no weapon table for ${charId})`); continue; }
      const ranged = weapons.map((w, i) => ({ ...w, slot: i + 1 })).filter((w) => w.type === 'ranged' && (!ONLYW || w.key === ONLYW));
      if (!ranged.length) { log(`  ${charId}: no ranged weapon`); continue; }

      const page = await browser.newPage({ viewport: { width: W, height: H } });
      await boot(page);
      const enemy = charId === 'donut' ? 'hamburger' : 'donut';
      await page.goto(`${BASE}/?player=${charId}&enemy=${enemy}&simSpeed=${SIM_SPEED}&pointerLock=0&aimMode=free`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
      await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 180000 });
      await installHarness(page);
      if (PITCH !== 58) {
        await page.evaluate(([p, w]) => window.__pj.setPitch(p, w), [PITCH, DETECT_WIDTH]);
        await page.waitForTimeout(400);
      }

      for (const w of ranged) {
        if (!(await selectWeapon(page, w.slot))) {
          const sel = await page.evaluate(() => window.__matchDebug.selectedWeapon);
          log(`  ⚠️ ${charId}.${w.key}: asked for slot ${w.slot}, sim says ${sel + 1} — SKIPPED`);
          failures++;
          continue;
        }
        const fl = await flight(page, { shotTag: SHOTS ? `${charId}.${w.key}.p${PITCH}` : null });
        const live = fl.samples;
        if (!live.length) {
          log(`  ⚠️ ${charId}.${w.key}: no projectile pixels were ever delivered (${fl.why ?? 'flight produced no live sample'})`);
          failures++;
          results.push({ char: charId, weapon: w.key, name: w.name, color: w.color, pitch: PITCH, samples: [], live: 0 });
          continue;
        }
        // Weakest sample by peak local contrast — "until they explode" is a floor, not
        // an average. Ties broken by area, so a small weak sample beats a big weak one.
        const worst = live.reduce((a, b) => (b.m.deMed < a.m.deMed
          || (b.m.deMed === a.m.deMed && b.m.n < a.m.n) ? b : a));
        const rec = {
          char: charId, weapon: w.key, name: w.name, color: w.color, pitch: PITCH,
          live: live.length,
          samples: live.map((s) => ({
            dist: s.census.distUnits[0], n: s.m.n, dL: s.m.dL, dHue: s.m.dHue,
            contrastMean: s.m.contrastMean, contrastP90: s.m.contrastP90, deMed: s.m.deMed, deP90: s.m.deP90,
            projL: s.m.proj.luma, bgL: s.m.bg.luma, projHue: s.m.proj.hue, bgHue: s.m.bg.hue,
            projSat: s.m.proj.sat, bgSat: s.m.bg.sat,
            // Projectile PLUS whatever it is shedding in flight — see `transientRoots`.
            flightN: s.flight ? s.flight.n : null,
            flightDL: s.flight ? s.flight.dL : null,
            flightP90: s.flight ? s.flight.contrastP90 : null,
            transients: s.census.transients,
            castDL: s.cast ? s.cast.dL : null, castDHue: s.cast ? s.cast.dHue : null,
            selfPair: s.selfPair,
          })),
          // vs the CAST — the check `b967242`'s rejected iteration failed. Sampled every
          // `CAST_EVERY`th frame (5 renders each), so this is the flight's WORST of the
          // sampled ones, reported separately from the background numbers because it is
          // a different population measured on a different stride.
          vsCast: (() => {
            const cs = live.map((s) => s.cast).filter(Boolean);
            if (!cs.length) return null;
            const w = cs.reduce((a, b) => (b.dL < a.dL ? b : a));
            return { n: cs.length, worstDL: w.dL, dHueAtWorst: w.dHue, castL: w.cast.luma, projL: w.proj.luma };
          })(),
          worst: {
            dist: worst.census.distUnits[0], n: worst.m.n, dL: worst.m.dL, dHue: worst.m.dHue,
            contrastP90: worst.m.contrastP90, deMed: worst.m.deMed, deP90: worst.m.deP90,
            castDL: worst.cast ? worst.cast.dL : null, castDHue: worst.cast ? worst.cast.dHue : null,
          },
          median: {
            n: median(live.map((s) => s.m.n)),
            dL: median(live.map((s) => s.m.dL)),
            dHue: median(live.map((s) => s.m.dHue)),
            contrastP90: median(live.map((s) => s.m.contrastP90)), deMed: median(live.map((s) => s.m.deMed)), deP90: median(live.map((s) => s.m.deP90)),
            flightN: median(live.map((s) => (s.flight ? s.flight.n : 0))),
            flightP90: median(live.map((s) => (s.flight ? s.flight.contrastP90 : 0))),
          },
          drift: live.map((s) => s.selfPair),
        };
        results.push(rec);
        log(`  ${pad(charId + '.' + w.key, 22)}${pad(w.color ?? '-', 9)}n=${pad(live.length, 4)}`
          + `dist ${pad(live[0].census.distUnits[0] + '..' + live[live.length - 1].census.distUnits[0], 14)}`
          + `median px ${pad(rec.median.n, 7)}(+shed ${pad(rec.median.flightN, 7)}) |dL| ${pad(rec.median.dL, 8)}dHue ${pad(rec.median.dHue, 7)}dE ${pad(rec.median.deMed, 8)}`
          + `| WORST px ${pad(rec.worst.n, 6)}|dL| ${pad(rec.worst.dL, 8)}dE ${rec.worst.deMed}`);
      }

      // ── KNOWN-INPUT CONTROLS, once per character, on a live projectile ────────
      if (args.selftest || args.controls) {
        await selectWeapon(page, ranged[0].slot);
        // ⚠️ DRAIN — see `flight()`. Without it this block measured the PREVIOUS
        // weapon's shot, still in the air, and reported a green Lettuce under the
        // heading "hamburger.Tomato". Nothing failed; the numbers were simply about a
        // different object.
        await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size === 0', 15000, 120);
        const at = await page.evaluate(() => (window.__vfxDebugScreen && window.__vfxDebugScreen.player) || null);
        await page.mouse.move(Math.round(at.x + Math.min(320, W * 0.2)), Math.round(at.y));
        await page.mouse.down();
        await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size > 0', 6000);
        await page.mouse.up();
        // ⚠️ WAIT FOR IT TO CLEAR THE SHOOTER. Freezing 200 ms after spawn caught the
        // tomato still inside its own thrower's silhouette: 5 delivered pixels, and
        // control B then "recovered" hue 68 from a colour forced to 120 — the
        // instrument reading as broken when it was the SETUP that was broken
        // (`docs/LESSONS.md` §10, measuring your own harness). 25 wu is clear of a
        // `PLAYER_SIZE` fighter at every framing this probe uses.
        await poll(page, `(() => { const l = window.__vfxLayer, f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
          if (!l || !f || !l.projectilePool.size) return false;
          const o = [...l.projectilePool.values()][0];
          return Math.hypot(o.position.x / 0.05 - f.x, o.position.z / 0.05 - f.y) > 25; })()`, 8000, 40);
        await page.evaluate(() => window.__clk.pause());
        await page.waitForTimeout(60);
        const cen = await page.evaluate(() => window.__pj.census());
        const rep = await page.evaluate(() => window.__pj.renderRepeat(5));
        log(`\n  RENDER DETERMINISM on one frozen scene, 5 renders inside ONE evaluate,`
          + ` clock paused, rAF halted, shake zeroed — of ${rep.total} px:`);
        for (const p of rep.pairs) log(`      ${p.pair}  changed ${pad(p.changed, 10)}max channel delta ${p.maxChannelDelta ?? '-'}`);
        const counts = await page.evaluate(() => window.__pj.counts());
        log(`\n  PER-FRAME COUNTS, mid-flight, ${counts.liveProjectiles} live projectile root(s):`
          + ` draws ${counts.calls} · tris ${counts.triangles} · programs ${counts.programs}`
          + ` · materials ${counts.materials} · vfx renderables ${counts.vfxRenderables}`
          + ` · geometries ${counts.geometries} · textures ${counts.textures}`);
        const shipped = await page.evaluate(() => window.__pj.measure());
        const hidden = await page.evaluate(() => window.__pj.controlHidden());
        const green = await page.evaluate(() => window.__pj.controlPaint('#00C000'));
        // CONTROL C — the known-bad the brief names: paint the projectile the
        // BACKGROUND's own measured colour and require the tool to call it invisible.
        const sculpt = await page.evaluate(() => window.__pj.shippedSculpt());
        const sep = await page.evaluate(() => window.__pj.shellSeparable());
        const bgHex = sculpt.n ? await page.evaluate(() => {
          const r = window.__pj.shippedSculpt();
          const l = r.bg.luma, s = r.bg.sat, h = r.bg.hue;
          // HSL -> hex, so the control colour is derived from THIS FRAME's background,
          // never from a palette constant that the arena may have moved off.
          const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
          let r1 = 0, g1 = 0, b1 = 0;
          if (h < 60) { r1 = c; g1 = x; } else if (h < 120) { r1 = x; g1 = c; }
          else if (h < 180) { g1 = c; b1 = x; } else if (h < 240) { g1 = x; b1 = c; }
          else if (h < 300) { r1 = x; b1 = c; } else { r1 = c; b1 = x; }
          const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
          return '#' + to(r1) + to(g1) + to(b1);
        }) : null;
        const bgPaint = bgHex ? await page.evaluate((hx) => window.__pj.controlSculptPaint(hx), bgHex) : null;
        const restore = await page.evaluate(() => window.__pj.controlRestore());
        const pairA = await page.evaluate(() => window.__pj.measure());
        const pairB = await page.evaluate(() => window.__pj.measure());
        await page.evaluate(() => window.__clk.resume());

        log(`\n══ INSTRUMENT VALIDATION on ${charId}.${ranged[0].key} (known inputs) ═════════`);
        log(`  live projectiles ${cen.roots} · meshes ${cen.meshes} · materials ${cen.materials} · names ${JSON.stringify(cen.names)}`);
        log(`  A every projectile hidden             n=${pad(hidden.n, 8)}(want 0)`);
        log(`  B forced to #00C000 (hue 120)         hue=${pad(green.proj ? green.proj.hue : '-', 8)}(want ~120)  n=${green.n}`);
        log(`  C SCULPT forced to the BACKGROUND'S OWN ${pad(bgHex ?? '-', 9)}   (shell hidden on both sides)`);
        if (bgPaint) log(`      -> n ${pad(bgPaint.n, 8)}|dL| ${pad(bgPaint.dL, 8)}dHue ${pad(bgPaint.dHue, 7)}dE med ${pad(bgPaint.deMed, 8)}dE p90 ${bgPaint.deP90}`);
        log(`      sculpt as shipped   -> n ${pad(sculpt.n, 8)}|dL| ${pad(sculpt.dL, 8)}dHue ${pad(sculpt.dHue, 7)}dE med ${pad(sculpt.deMed, 8)}dE p90 ${sculpt.deP90}`);
        log(`      whole projectile    -> n ${pad(shipped.n, 8)}|dL| ${pad(shipped.dL, 8)}dHue ${pad(shipped.dHue, 7)}dE med ${pad(shipped.deMed, 8)}dE p90 ${shipped.deP90}`);
        log(`  D self-pair (drift control)           dn=${pairB.n - pairA.n}  dL diff=${(pairB.dL - pairA.dL).toFixed(6)}  dE diff=${(pairB.deMed - pairA.deMed).toFixed(6)}  (want 0 EXACTLY)`);
        log(`  E material save/restore integrity     ${restore.same ? 'IDENTICAL' : 'CORRUPTED: ' + JSON.stringify(restore)}`);

        // ⚠️ A CONTROL RUN ON 5 PIXELS PROVES NOTHING, AND IT LOOKED LIKE A FAILING
        // INSTRUMENT. Assert the sample size explicitly rather than letting a tiny
        // mask silently produce a "wrong" hue out of antialiased edge pixels.
        const okN = shipped.n >= 20;
        log(`  0 sample size                         n=${pad(shipped.n, 8)}(want >= 20 — below that every column below is edge pixels)`);
        const okA = hidden.n === 0;
        const okB = green.proj && Math.abs(green.proj.hue - 120) < 12 && green.n > 20;
        /**
         * ⚠️ CONTROL C's FIRST THRESHOLD WAS UNMEETABLE AND THAT WAS THE INSTRUMENT'S
         * FAULT, NOT THE FIX'S. It asked local LUMA contrast to fall to 0.6x when the
         * projectile was repainted the background's own colour. It cannot: the
         * background is a tiled, grimed, bloomed surface with real internal structure,
         * so a *perfectly* camouflaged object still shows per-pixel luma differences
         * against a local MEAN of that structure. The control was demanding that the
         * floor be flat.
         *
         * What the control is actually entitled to demand is that the SEPARATION
         * collapses: mean hue and mean luma land on the background's (that is what
         * "painted the background's colour" means, and it is falsifiable — a probe
         * reading the wrong pixels would not reproduce it), and the perceptual
         * distance drops by a large factor rather than to an impossible absolute.
         */
        const okC = bgPaint && sculpt.n > 20 && bgPaint.dL < 0.06 && bgPaint.dHue < 15
          && bgPaint.deMed < sculpt.deMed * 0.5;
        // CONTROL F — the shell is inside the ablation. 0 on a tree without one, large
        // on a tree with one; either way the probe has to KNOW which it is looking at.
        const expectShell = sep.shells > 0;
        const okF = expectShell ? sep.delta > 40 : sep.delta === 0;
        log(`  F shell is inside the ablation        shells=${pad(sep.shells, 4)}all=${pad(sep.all, 8)}sculpt-only=${pad(sep.sculpt, 8)}delta=${sep.delta}`
          + `   (want ${expectShell ? '> 40 — this tree HAS a shell' : '0 — this tree has no shell'})`);
        const okD = pairB.n === pairA.n && pairB.dL === pairA.dL && pairB.deMed === pairA.deMed;
        const okE = restore.same;
        const ok = okN && okA && okB && okC && okD && okE && okF;
        log(`  0 ${okN ? 'PASS' : 'FAIL'} · A ${okA ? 'PASS' : 'FAIL'} · B ${okB ? 'PASS' : 'FAIL'} · C ${okC ? 'PASS' : 'FAIL'} · D ${okD ? 'PASS' : 'FAIL'} · E ${okE ? 'PASS' : 'FAIL'} · F ${okF ? 'PASS' : 'FAIL'}`);
        log(ok ? '  → INSTRUMENT VALID' : '  → INSTRUMENT INVALID — nothing above is trustworthy');
        if (!ok) failures++;
        if (args.selftest) { await page.close(); await browser.close(); process.exit(ok ? 0 : 1); }
      }

      // ── "…UNTIL THEY EXPLODE": does the HIT still read as a separate event? ────
      //
      // The clause in Uri's report has two halves and this is the second one. A
      // projectile that is now 15x louder in flight could in principle arrive at a
      // burst that is no louder than it was, and the hit would stop being an event.
      //
      // Measured in the SAME units as the flight numbers, on ONE frozen frame each,
      // by the same ablation: fire, freeze mid-flight, count the flight's delivered
      // pixels; then drive a REAL `hit-landed` through `match.ts:handleEvents` via
      // `window.__feelEvent` (the shipped handler, not a copy — `feel_probe.mjs`'s
      // reasoning applies verbatim), let it reach its peak, and count the burst's.
      if (args.impact) {
        const w0 = ranged[0];
        await selectWeapon(page, w0.slot);
        await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size === 0', 15000, 120);
        const atI = await page.evaluate(() => (window.__vfxDebugScreen && window.__vfxDebugScreen.player) || null);
        await page.mouse.move(Math.round(atI.x + Math.min(320, W * 0.2)), Math.round(atI.y));
        await page.mouse.down();
        await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size > 0', 6000);
        await page.mouse.up();
        await poll(page, `(() => { const l = window.__vfxLayer, f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
          if (!l || !f || !l.projectilePool.size) return false;
          const o = [...l.projectilePool.values()][0];
          return Math.hypot(o.position.x / 0.05 - f.x, o.position.z / 0.05 - f.y) > 25; })()`, 8000, 40);
        await page.evaluate(() => window.__clk.pause());
        await page.waitForTimeout(60);
        const flightPx = await page.evaluate(() => window.__pj.measure());
        // The burst is fired at the PLAYER's own position — the same place the frozen
        // frame is centred, so both numbers are read in the same part of the frame.
        const dmg = await page.evaluate(() => {
          const f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
          return f ? { x: f.x, y: f.y } : null;
        });
        await page.evaluate(() => window.__clk.resume());
        await page.evaluate(([ev]) => window.__feelEvent(ev), [{
          type: 'hit-landed', targetRole: 'player', amount: Number(args.dmg ?? 8), effect: 'none',
          source: { kind: 'weapon', weaponKey: w0.key, weaponName: w0.name },
          x: dmg.x, y: dmg.y,
        }]);
        await page.waitForTimeout(Number(args.burstAt ?? 140));
        await page.evaluate(() => window.__clk.pause());
        await page.waitForTimeout(50);
        const burst = await page.evaluate(() => window.__pj.measureBurst());
        await page.evaluate(() => window.__clk.resume());
        log(`\n══ FLIGHT vs IMPACT, same units, ${charId}.${w0.key} at ${Number(args.dmg ?? 8)} damage ═══════`);
        log(`  projectile in flight   ${pad(flightPx.n, 8)}px   dE ${flightPx.deMed}`);
        log(`  impact burst           ${pad(burst.n, 8)}px   dE ${burst.deMed}   (${burst.roots} transient objects)`);
        log(`  burst / flight         ${(burst.n / Math.max(1, flightPx.n)).toFixed(2)}x`
          + `   — and the flight signature goes to ZERO at the same instant, because the`);
        log(`                                    projectile and its shell are both removed by \`syncPool\`.`);
      }

      await page.close();
    }

    await writeFile(`${OUT}/pj.pitch${PITCH}.json`, JSON.stringify({ base: BASE, pitch: PITCH, delta: DELTA, w: W, h: H, results }, null, 2));
    log(`\njson -> ${OUT}/pj.pitch${PITCH}.json`);
    summary(results);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return +(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2).toFixed(4);
}

function summary(results) {
  if (!results.length) return;
  log(`\n══ EVERY RANGED WEAPON, WEAKEST SAMPLE OF ITS FLIGHT (pitch ${PITCH}) ══════════`);
  log(`  sorted by dE — OKLab distance from the LOCAL BACKGROUND, median over the`);
  log(`  projectile's own pixels. Area and separation are reported apart because`);
  log(`  "almost invisible" can be either and the fix for each is different.\n`);
  log(`  ${pad('weapon', 22)}${pad('colour', 9)}${pad('px', 8)}${pad('dE med', 9)}${pad('dE p90', 9)}${pad('|dL| bg', 10)}${pad('dHue bg', 10)}${pad('|dL| cast', 11)}dHue cast`);
  const sorted = [...results].sort((a, b) => (a.worst?.deMed ?? 0) - (b.worst?.deMed ?? 0));
  for (const r of sorted) {
    if (!r.worst) { log(`  ${pad(r.char + '.' + r.weapon, 22)}${pad(r.color ?? '-', 9)}NO DELIVERED PIXELS`); continue; }
    log(`  ${pad(r.char + '.' + r.weapon, 22)}${pad(r.color ?? '-', 9)}${pad(r.worst.n, 8)}${pad(r.worst.deMed, 9)}${pad(r.worst.deP90, 9)}${pad(r.worst.dL, 10)}${pad(r.worst.dHue, 10)}${pad(r.vsCast ? r.vsCast.worstDL : '-', 11)}${r.vsCast ? r.vsCast.dHueAtWorst : '-'}`);
  }
  log(`\n══ THE SAME, AT THE MEDIAN OF THE FLIGHT ══════════════════════════════════════`);
  log(`  ${pad('weapon', 22)}${pad('px', 8)}${pad('+shed', 8)}${pad('dE med', 9)}${pad('|dL| bg', 10)}dHue bg`);
  for (const r of [...results].sort((a, b) => (a.median?.deMed ?? 0) - (b.median?.deMed ?? 0))) {
    if (!r.median) continue;
    log(`  ${pad(r.char + '.' + r.weapon, 22)}${pad(r.median.n, 8)}${pad(r.median.flightN, 8)}${pad(r.median.deMed, 9)}${pad(r.median.dL, 10)}${r.median.dHue}`);
  }
}

/**
 * ⚠️ IS_MAIN GUARD. `docs/AGENT-BRIEF.md` §3: three tools here made a function
 * importable and silently made the whole CLI path run on import — importing
 * `snapsweep.mjs` printed a live sweep, importing `da_census.mjs` launched Chromium.
 * This file exports nothing today, but it cost 120 s the first time a throwaway
 * `import('./tools/tmp/pj_probe.mjs')` in a shell one-liner booted a browser and had
 * to be killed. The guard is one line and the failure mode is a hung terminal.
 */
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) await main();
