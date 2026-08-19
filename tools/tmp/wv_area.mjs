#!/usr/bin/env node
/**
 * WV_AREA — THE VISUAL AXIS OF THE WEAPON MATRIX: delivered pixel area for all 33
 * weapons, at BOTH cameras, with THE GENERIC PATH AS THE CONTROL.
 *
 * Uri, 2026-08-19: *"What about making sure all weapons are doing what they are
 * supposed to both visually and technically?"*
 *
 * ── THE FINDING THAT GOVERNS THIS FILE ──────────────────────────────────────────
 *
 * `tools/tmp/pj_probe.mjs` proved the tomato projectile was NOT a hue collision but an
 * AREA one: a bespoke sculpt delivered **36 px against the generic path's 686** — one
 * nineteenth of the area — at a perfectly respectable 18.8 degrees of hue. So
 *
 *     "is there a bespoke sculpt?"   and   "does it deliver pixels?"
 *
 * are DIFFERENT QUESTIONS, and only the second is the one Uri is asking. A weapon can
 * be authored, correct, and effectively invisible. `getWeaponVfx()` returning an object
 * is evidence of the first and NO evidence of the second.
 *
 * ── WHY THE CONTROL IS THE GENERIC PATH AND NOT A THRESHOLD ─────────────────────
 *
 * Every bespoke hook REPLACES (impact, projectile) or SUPERSEDES (cast) an effect that
 * already shipped and already worked. So the question "is this bespoke effect big
 * enough" has an exact, per-weapon, same-camera, same-lighting, same-post-chain answer
 * already sitting in the tree: **what the generic path would have drawn for this same
 * weapon**. A fixed pixel floor would have to be guessed; this one is measured, and it
 * moves with the camera and the arena instead of going stale. `pj_probe`'s 36-vs-686
 * is exactly this ratio, and it is why that number was legible as a defect at all.
 *
 * ── HOW THE CONTROL ARM IS PRODUCED (and why it is not a re-implementation) ─────
 *
 * NOT by re-deriving the generic recipe in the instrument — `docs/LESSONS.md` §5's
 * stale-copy trap, and an auditor that reimplements the thing it audits reproduces the
 * defect class it is auditing (`rules.ts`'s own `AbilityBlurb` header records exactly
 * that happening on the prose axis).
 *
 * Instead the SHIPPED fallback is provoked. `vfx/weapons/index.ts`'s REGISTRY holds
 * REFERENCES to each character file's exported `WeaponVfx` objects, and
 * `getWeaponVfx()` hands that same object back — verified in-run (`sameObject`). Every
 * call site in `game/vfx.ts` reads it as `getWeaponVfx(id, key)?.<hook>` and falls back
 * to the generic effect when the hook is absent. So deleting the hook OFF THE OBJECT
 * puts `game/vfx.ts` on the exact code path it takes for the five weapons that have no
 * bespoke entry at all, with the weapon's own colour/damage/range/cone unchanged.
 * The hooks are re-assigned immediately afterwards and the restore is ASSERTED, per
 * case, by reading the hook set back.
 *
 * ⚠️ `__vfxSpawnTest`'s `who`/`weaponKey` arguments cannot do this job. Dropping
 * `weaponKey` makes `qaWeapon` `undefined`, and `vfx.ts` then substitutes a synthetic
 * `'qa'` weapon with a different colour, range and cone — so the arm would differ from
 * the shipped one in four ways instead of one, and the difference could not be
 * attributed. The registry ablation changes exactly one thing.
 *
 * ── THE THREE BEATS A WEAPON DRAWS, AND WHO FIRES THEM ──────────────────────────
 *
 * Re-derived from `game/match.ts:handleEvents` rather than assumed:
 *
 *   CAST        `weapon-fired`  -> `vfx.spawnWeaponCast(...)`   ALL 33 weapons.
 *                               ONE call, deliberately: it arbitrates the muzzle
 *                               flash, the generic melee wedge and the giant-slam
 *                               shockwave, and a bespoke `cast()` changes that
 *                               arbitration (`vfx.ts:spawnWeaponCast`). Fired here
 *                               through `__vfxSpawnTest('weaponFired', ...)`, which
 *                               is that same method — so the SUM is measured, which
 *                               is the thing `docs/LESSONS.md` §7 says nobody watches.
 *   IMPACT      `hit-landed`    -> `vfx.spawnImpactBurst(...)`  ALL 33 weapons.
 *                               A bespoke `impact()` REPLACES the generic burst
 *                               outright (`vfx.ts` returns early), so this ratio is
 *                               the cleanest "what did the bespoke sculpt cost us".
 *   PROJECTILE  `sync()`        -> `syncPool(projectilePool, ...)`  23 ranged weapons.
 *                               Not fireable through `__vfxSpawnTest` at all — it is
 *                               sim-owned. Driven here by handing `__vfxLayer.sync()`
 *                               a synthetic `MatchState` carrying one projectile at a
 *                               chosen offset, which is what that QA handle exists
 *                               for (`vfx.ts`'s `__vfxLayer` declaration says so in
 *                               as many words) and what `vfx_ablate.mjs` /
 *                               `vfx_coverage.mjs` already do for splats and status.
 *
 * A fourth beat, TELEGRAPH (`cast-started`), is NOT measured here: `tools/tmp/tg_tele.mjs`
 * owns it and measures the MINIMUM 100 ms slice, which is the right statistic for a
 * sustained gesture and the wrong one for a burst. What this file does report about it
 * is a CODE fact that costs no renders and is not otherwise written down anywhere —
 * how many `telegraph()` hooks are authored versus how many weapons carry a `castMs`
 * that would ever fire one.
 *
 * ── TWO CAMERAS, AND WHAT IS COMPARABLE ACROSS THEM ─────────────────────────────
 *
 * CLAUDE.md #3: the lobby rig (`ui/screens/charStage.ts` pitch 20) is the better
 * DETECTOR; the match rig (`render/camera.ts` pitch 58) is where the game is played.
 * There is no lobby weapon effect, so `--pitch 20` is the match rig re-pitched and
 * pulled close (`frameMode:'ground'`, `viewWidthUnits` = `--detectWidth`), identical to
 * `pj_probe.mjs`'s detector and at its same default 150 wu so the two join.
 *
 * 🔴 **Pitch-20 AREAS ARE NOT SHIPPED SCALE and must never be quoted as such.** The
 * RATIO shipped/generic is a ratio of two measurements taken through the same camera
 * and IS comparable at both. `satPct` is printed for exactly this reason: at 150 wu a
 * `giantSlam`'s 20 m disc is wider than the frame, both arms clip, and the ratio goes
 * to 1.0 while meaning nothing. A saturated row is reported as saturated, not as a pass.
 *
 * ── RESOLUTION FLOOR (CLAUDE.md #10 — state it BEFORE acting on a change) ───────
 *
 * These effects are built from ROUND-ROBIN POOLS with randomised shard directions, so
 * two measurements of unchanged code did not agree: measured on this instrument's own
 * POINTING control, the two arms differed 15.4% while their within-arm spread was
 * 15.0% — the noise was the same size as the signal. `vfx_wcov.mjs` records the same
 * thing as "+/-10-20% at ~300 px" and grew a `--volley` mode to live with it.
 *
 * This file does not live with it. `Math.random` is replaced with a seeded LCG and the
 * two arms are given the SAME SEED, so `shipped[r] / generic[r]` is a PAIRED delta on
 * an identical draw — exact, not aggregate. Repeats sweep the SEED, so "how much does
 * the particular draw matter" is still measured and is reported separately instead of
 * contaminating every row. After seeding, POINTING drift went 15.4% -> 0.0%.
 *
 * 🔴 **THE FLOOR THAT GOVERNS A VERDICT IS THE NULL ARM, NOT A FORMULA.** A row whose
 * beat has no bespoke hook has NOTHING deleted on its generic arm — both arms are the
 * identical code path and its true ratio is 1.000 by construction. What those rows
 * report instead of 1.000 IS the floor, measured on the shipped tree every run.
 * `DECISIONS §62` is the precedent for building a floor from a null arm rather than
 * from a standard error, and CLAUDE.md #10's seat-fairness note is the warning against
 * reaching for the formula because it is the formula.
 *
 * ── CONTROLS (CLAUDE.md #6 — an instrument not shown to FAIL is not an instrument) ─
 *
 *   NULL         frozen frame vs itself                     -> must be 0 px, not "small"
 *   RNG          the seeded LCG reproduces AND varies        -> or every "paired"
 *                                                              number here is unpaired
 *   FORCED       a garish oversized impact                   -> must be >> 0
 *   MOVER        deleting a bespoke hook must MOVE the frame -> on an UNSATURATED
 *                weapon. 🚨 The first version of this control used `lollipop.Giant`'s
 *                cast and FAILED at 0.3%, and THE CONTROL WAS WRONG: both arms fill
 *                72.5% of the frame, so the move could not express itself. That is
 *                CLAUDE.md #6's "a known-bad planted where the bug CANNOT EXPRESS
 *                ITSELF", and it would have been reported as a broken instrument.
 *                Candidates over 40% of frame are now rejected, out loud.
 *   POINTING     ablate weapon A, measure weapon B           -> B must NOT move.
 *                🚨 `--selftest` validates a tool's LOGIC and never validates where the
 *                tool is POINTED (CLAUDE.md #6). This is the pointing check.
 *   SEEDPAIR     same weapon, same arm, same seed, twice     -> byte-identical series,
 *                and a DIFFERENT seed must differ (or the seed is reaching nothing)
 *   RESTORE      hook set read back after every single case  -> must equal the original
 *   PLANTED      a hook replaced with one that draws NOTHING -> must report ~0 px and
 *                flag RED. Planted on the weapon with the LARGEST shipped impact, so
 *                the bug can actually express itself.
 *   NULL ARM     every no-hook row's ratio                   -> 1.000 by construction;
 *                the deviation is the floor, and the set is checked NON-EMPTY first
 *   NON-VACUITY  every subset asserted over is checked NON-EMPTY first, because
 *                `[].every()` returns true.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wv -- \
 *     node tools/tmp/wv_area.mjs --url '{URL}' --pitch 58 --repeat 3
 *   node tools/tmp/wv_area.mjs --url $U --selftest          # controls only, no matrix
 *   node tools/tmp/wv_area.mjs --url $U --only hamburger --beats impact --shots
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
const OUT = String(args.out ?? 'shots/wv');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Per-channel 8-bit step that counts a pixel as "changed". The same value
 * `vfx_wcov`, `vfx_coverage`, `trail_probe` and `pj_probe` use, deliberately: areas
 * here have to be comparable to the records those tools left behind. */
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
/** Ground width the shallow DETECTOR camera frames, in world units. `pj_probe.mjs`'s
 * default, so the two lobby-analogue numbers join. Only read when pitch !== 58. */
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
const REPEAT = Number(args.repeat ?? 3);
const SHOTS = !!args.shots;
const SELFTEST_ONLY = !!args.selftest;
const ONLY = args.only ? String(args.only).split(',') : null;
const BEATS = String(args.beats ?? 'cast,impact,projectile').split(',');
/**
 * Millisecond slice schedule for the two TRANSIENT beats.
 *
 * ⚠️ Six slices, not `vfx_wcov`'s nine, and that is a priced trade rather than a
 * corner cut. One render+readback costs ~0.56 s under SwiftShader, and this run is
 * 33 weapons x 2 beats x 2 paths x N repeats — nine slices puts a single pitch over
 * an hour with four peers already on the GPU. The pilot measured both arms of
 * `hamburger.Tomato`'s impact on the nine-slice schedule and every effect in it lived
 * inside [16, 900] with its peak between 150 and 320 ms; this schedule brackets that
 * band. `peakAtMs` is reported per row so a peak sitting on the last slice — the
 * signature of a schedule that ends too early — is visible rather than silent.
 */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number)
  : [16, 80, 160, 260, 400, 620]);
/** World-unit offsets from the caster a synthetic projectile is placed at.
 * ⚠️ `pj_probe.mjs` aims +X for all 23 weapons, so EVERY legibility number this
 * project owned before today describes ONE trajectory. Two offsets is not "all of
 * them", but it is the difference between a number that could be a trajectory
 * artefact and one that has been checked against a second. */
const PROJ_OFFSETS = (args.projOffsets ? String(args.projOffsets).split(',')
  : ['40,0', '0,40']).map((s) => s.split(',').map(Number));

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(xs, p) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/** Pause every CSS keyframe. Only matters for the `--shots` PNGs (the pixel counts
 * come off `stage.canvas` via `getImageData`, which the DOM cannot reach), but a
 * judgement PNG with a HUD keyframe frozen mid-animation is the same trap
 * `docs/AGENT-BRIEF.md` §3 records: `locator('canvas').screenshot()` is a PAGE
 * capture clipped to the canvas box. */
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'wv-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
    + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

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
    window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
    performance.now = () => (paused ? virt : realNow() - base);

    /**
     * ── SEEDED `Math.random`, AND WHY IT IS THE DIFFERENCE BETWEEN A NUMBER AND AN
     *    OPINION ─────────────────────────────────────────────────────────────────
     *
     * Every impact burst here is built from ROUND-ROBIN POOLS with randomised shard
     * directions and jitter, so two measurements of UNCHANGED code disagree.
     * Measured on this instrument before this block existed: the POINTING control's
     * two arms differed 15.4% while their own within-arm spread was 15.0% — i.e. the
     * noise was the same size as the effect the control was trying to see, and a
     * shipped/generic ratio anywhere in 0.85..1.18 would have been unreadable.
     * `vfx_wcov.mjs`'s header records the same thing as "+/-10-20% at ~300 px".
     *
     * A drop-in LCG makes each arm REPRODUCIBLE and, more importantly, makes the two
     * arms PAIRED: shipped rep `r` and generic rep `r` are seeded identically, so the
     * difference between them is the code path and not the draw. CLAUDE.md #10 says
     * this in as many words — *"a paired per-matchup delta on identical seeds is
     * EXACT, and it is a DIFFERENT QUANTITY from an aggregate"*.
     *
     * Repeats then sweep the SEED rather than re-rolling the same one, so
     * "how much does the particular draw matter" is still measured — it is just
     * reported as the across-seed spread instead of contaminating every row.
     *
     * ⚠️ This replaces `Math.random` for the WHOLE page, three.js included. That is
     * acceptable here and would not be in a gameplay probe: nothing in this file
     * measures the sim.
     */
    let st = 1;
    const realRandom = Math.random.bind(Math);
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = {
      seed(v) { st = ((v >>> 0) || 1); },
      restore() { Math.random = realRandom; },
      /** Known-input check: two draws from the same seed must be byte-identical. */
      selftest() {
        window.__rng.seed(7); const a = [Math.random(), Math.random(), Math.random()];
        window.__rng.seed(7); const b = [Math.random(), Math.random(), Math.random()];
        return a.every((v, i) => v === b[i]) && a[0] !== a[1];
      },
    };
  });
}

/* eslint-disable */
async function installHarness(page, rw, rh, delta) {
  await page.evaluate(([RWv, RHv, D]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = RWv; cv.height = RHv;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    let base = null;

    /**
     * 🚨 A FROZEN CLOCK DOES NOT STILL THE CAMERA SHAKE — IT MAKES IT PERMANENT.
     * `render/camera.ts:CameraRig.update()` multiplies the shake DECAY by `dtSeconds`
     * but not the RE-RANDOMISATION, so at dt=0 every `stage.render()` moves the camera
     * to a new random offset, and `Stage.render()` calls `rig.update()` before drawing.
     * Measured elsewhere in this repo: 344 of 344 frozen frames drifted, up to 349 px.
     * Zeroed before every single grab, not once at setup.
     */
    const still = () => {
      const r = stage.rig; if (!r) return;
      r.shakeAmount = 0;
      if (r.shakeOffset && r.shakeOffset.set) r.shakeOffset.set(0, 0, 0);
    };
    const grab = () => {
      still(); stage.render(0);
      c2.clearRect(0, 0, RWv, RHv); c2.drawImage(stage.canvas, 0, 0, RWv, RHv);
      return c2.getImageData(0, 0, RWv, RHv).data;
    };
    const changed = (cur) => {
      let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
      for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
        const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
        if (d >= D) {
          n++;
          const x = p % RWv, y = (p / RWv) | 0;
          if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
      }
      return { n, bbox: n ? [minx, miny, maxx, maxy] : null };
    };

    window.__wv = {
      total: RWv * RHv,
      setBase() { base = grab(); },
      count() { return changed(grab()).n; },
      countBox() { return changed(grab()); },
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
      shot() { still(); stage.render(0); },
      /** Re-pitch the shipped match rig into the lobby-analogue DETECTOR view. The
       * fields set are the rig's INPUTS, so any later `apply()`/`update()` honours
       * them — which matters because `Stage.render()` calls `rig.update()` itself. */
      setPitch(deg, widthUnits) {
        const rig = stage.rig; if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },
    };
  }, [rw, rh, delta]);
}
/* eslint-enable */

/**
 * ONE MEASUREMENT, on one arm.
 *
 * `mode` is `'shipped'` (registry untouched) or `'generic'` (this weapon's hooks
 * deleted off its registry object for the duration, then re-assigned). The hook set is
 * READ BACK after the restore and returned, so every single case carries its own proof
 * that the ablation did not leak — the check `vfx_wcov`'s 30-45% `depthTest:false`
 * leak needed and did not have.
 */
async function fireTransient(page, { id, key, beat, mode, slices, at, seed = 1, dirFrom = true }) {
  return page.evaluate(async ([w, sl]) => {
    const rules = await import('/src/game/rules.ts');
    const reg = await import('/src/vfx/weapons/index.ts');
    const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };
    const v = reg.getWeaponVfx(w.id, w.key);
    const before = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];
    // ⚠️ ONLY the hooks THIS beat reads. Deleting a weapon's whole entry would work
    // too, but then the arm differs from shipped in up to five ways and a row whose
    // beat has no hook would still have had SOMETHING removed — which is exactly the
    // row the NULL-ARM control needs to be a literal no-op.
    const kill = w.beat === 'impact' ? ['impact'] : ['cast'];
    const saved = {};
    if (w.mode === 'generic' && v) for (const k of kill) if (typeof v[k] === 'function') { saved[k] = v[k]; delete v[k]; }

    window.__wv.reset();
    // One idle frame between clear() and the baseline: `clear()` removes objects, and
    // the baseline must be of the frame AFTER they are gone, not the frame they were
    // removed in.
    window.__wv.step(0);
    window.__wv.setBase();
    // PAIRED: the same seed on both arms, so shipped-minus-generic is the code path.
    window.__rng.seed(w.seed);

    const L = window.__vfxLayer;
    if (w.beat === 'impact') {
      /**
       * 🚨 THE SHIPPED CALL, WITH THE ARGUMENT `__vfxSpawnTest` CANNOT PASS.
       *
       * `match.ts:handleEvents` fires
       *   `spawnImpactBurst(ev.x, ev.y, colorForDamageSource(...), ev.amount,
       *                     { weapon, characterId, fromXWU, fromYWU })`
       * and `fromXWU/fromYWU` is ALWAYS populated for `source.kind === 'weapon'` — it
       * is the attacker's position, and `spawnImpactBurst` turns it into
       * `ctx.direction`, the vector a bespoke `impact()` orients its spray along.
       *
       * `window.__vfxSpawnTest('impact', ...)` passes `{ weapon, characterId }` and
       * NOTHING ELSE, so `ctx.direction` comes out (0,0,0) — a state the shipped game
       * never produces for a weapon hit. Every per-weapon VFX measurement in this repo
       * goes through that hook. `--dirFrom 0` reproduces it on demand so the size of
       * the gap is a number rather than an argument.
       *
       * `colorForDamageSource` returns `weapon.color` for a weapon hit (match.ts:1219),
       * and `ev.amount` is `w.damage * damageMul`, which is `w.damage` at level 1.
       */
      const src = { weapon, characterId: w.id };
      if (w.dirFrom) { src.fromXWU = w.x - 60; src.fromYWU = w.y; }
      L.spawnImpactBurst(w.x, w.y, weapon.color, weapon.damage, src);
    } else {
      // `match.ts` fires exactly this, once, for `weapon-fired` — and it is ONE call
      // deliberately: `spawnWeaponCast` arbitrates the muzzle flash, the generic melee
      // wedge and the giant-slam shockwave, so this measures the SUM.
      // ⚠️ NOT in these numbers, and it is not this layer's to draw: `match.ts` also
      // runs `hud.flashScreen`, a camera kick and 120 ms of hit-stop for a giantSlam.
      L.spawnWeaponCast(w.x, w.y, { x: 1, y: 0 }, weapon, w.id);
    }

    const series = []; const boxes = [];
    let prev = 0;
    for (const t of sl) {
      window.__wv.step(t - prev); prev = t;
      const c = window.__wv.countBox();
      series.push(c.n); boxes.push(c.bbox);
    }
    window.__wv.reset();
    if (w.mode === 'generic' && v) Object.assign(v, saved);
    const after = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];
    return { series, boxes, before, after, restored: before.join(',') === after.join(',') };
  }, [{ id, key, beat, mode, x: at.x, y: at.y, seed, dirFrom }, slices]);
}

async function playerPos(page) {
  return page.evaluate(() => {
    const p = window.__vfxDebugFighters.player;
    const e = window.__vfxDebugFighters.enemy;
    return { x: p.x, y: p.y, ex: e.x, ey: e.y };
  });
}

/**
 * ONE STATIC PROJECTILE, measured through the SHIPPED `sync()` path.
 *
 * The projectile visual is sim-owned: `__vfxSpawnTest` has no `'projectile'` kind, and
 * `pj_probe.mjs` therefore had to fly a real shot through real gameplay to reach it.
 * That is the right instrument for "is it legible for the WHOLE flight" and the wrong
 * one for "does the sculpt deliver area at all", which needs a controlled position, a
 * second trajectory, and a generic control arm on the same frame.
 *
 * `vfx.ts`'s own `__vfxLayer` declaration says this handle exists so a probe can
 * "drive `sync()` with a synthetic `MatchState` so the sim-owned pools (projectiles /
 * splats / trail marks) ... can be measured without waiting on real gameplay — fighters
 * spawn 1080wu apart and every weapon reaches at most 140wu, so probes that wait for a
 * real hit time out". `vfx_ablate.mjs` and `vfx_coverage.mjs` already do this for
 * splats and status telegraphs; this is the same move on the projectile pool.
 *
 * TWO syncs, not one: `syncPool` creates the object on the first and runs the per-frame
 * update — which is where a bespoke `trail()` hook spins, squashes and drips — on the
 * second. Measuring the spawn frame alone would score every `trail()` hook at zero.
 *
 * 🚨 **WHAT THIS ROW MEASURES IS THE HALO, NOT THE SCULPT, AND THAT IS NOT A FAULT —
 *    IT IS WHAT THE PLAYER SEES.** Six weapons came out at shipped == generic TO THE
 * PIXEL with `userData.weaponVfx` proving the bespoke branch had run
 * (`tools/tmp/wv_projdbg.mjs`, 0 of 23 disagreements). `tools/tmp/wv_projshot.mjs`
 * rendered both arms and the frames say why: `60e9942` rings every projectile —
 * generic and bespoke alike — with a halo sized off the object's own measured shell,
 * and where the sculpt fits inside a halo of the same radius the two arms have the
 * SAME SILHOUETTE and therefore the same delivered area, exactly.
 *
 * So read this column as **"how big does this projectile read"**, governed by the
 * shell radius, and not as "how much does the sculpt add". A ratio of 1.00 here means
 * *the halo is carrying the whole silhouette and the authored sculpt adds no area* —
 * true for `pizza.Dough`/`Tomato`/`Cheese`, `sushi.Seaweed`, `taco.Double`,
 * `hotdog.Mustard`. A ratio near 0.46 means the sculpt was small enough to hit
 * `PROJECTILE_MIN_R` (0.26 m against the generic sphere's 0.5 m) and the halo shrank
 * with it.
 */
async function fireProjectile(page, { id, key, mode, offX, offY, at, seed = 1 }) {
  return page.evaluate(async ([w, f]) => {
    const rules = await import('/src/game/rules.ts');
    const reg = await import('/src/vfx/weapons/index.ts');
    // 🚨 THE REAL, FROZEN `Weapon` OBJECT, not a reconstruction of one. A bespoke
    // `projectile()` hook receives `ctx.weapon` and is free to read `splatter`,
    // `homing`, `effect`, `pelletColors`, `peckHits`, ... — a hand-built lookalike
    // carrying only the fields THIS file happens to know about would silently take a
    // different branch inside the very hook it is measuring.
    const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };
    const v = reg.getWeaponVfx(w.id, w.key);
    const before = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];
    // `projectile` alone is enough to take the generic branch, and `trail()` follows it
    // automatically: `syncPool` stashes the matched entry on `obj.userData.weaponVfx`
    // ONLY inside the bespoke branch, and the per-frame update reads `trail` off that
    // stash — so with `projectile` gone, `trail` is unreachable by construction.
    const saved = {};
    if (w.mode === 'generic' && v) for (const k of ['projectile']) if (typeof v[k] === 'function') { saved[k] = v[k]; delete v[k]; }

    const mk = (cid, x, y) => ({
      characterId: cid, x, y, hp: 100, maxHp: 100, alive: true,
      facing: { x: 1, y: 0 }, terrainSlowFactor: 1, status: { slowedUntil: 0, stunnedUntil: 0 },
    });
    const player = mk(w.id, f.x, f.y);
    const enemy = mk('donut', f.ex, f.ey);
    const mkState = (projectiles) => ({
      elapsed: 1000, projectiles, splats: [], trailMarks: [],
      player, enemy, fighters: [player, enemy],
    });

    // Baseline with the pool EMPTY, taken through the same sync path so the two
    // frames differ only by the projectile.
    window.__vfxLayer.sync(mkState([]));
    window.__wv.setBase();

    const dirLen = Math.hypot(w.offX, w.offY) || 1;
    const p = {
      id: 991, ownerId: 0, targetId: 1, ownerRole: 'player', targetRole: 'enemy',
      weapon, x: f.x + w.offX, y: f.y + w.offY,
      vx: (w.offX / dirLen) * (weapon.speed ?? 100), vy: (w.offY / dirLen) * (weapon.speed ?? 100),
      traveled: dirLen, damage: weapon.damage, color: weapon.color, emoji: weapon.emoji ?? '',
    };
    const st = mkState([p]);
    window.__rng.seed(w.seed);
    window.__vfxLayer.sync(st);          // create
    window.__clk.advance(16);
    st.elapsed += 16;
    window.__vfxLayer.sync(st);          // per-frame update -> `trail()` runs
    window.__vfxLayer.updateEffects(0.016);
    const c = window.__wv.countBox();
    // What the pool actually built, by NAME — `vfx.ts` names every projectile
    // `projectile:<char>.<key>`, so "did my synthetic state reach the pool at all"
    // is answerable without trusting the pixel count.
    let named = 0;
    window.__vfxLayer.group.traverse((o) => { if (String(o.name).startsWith('projectile:')) named++; });

    window.__vfxLayer.sync(mkState([]));
    window.__vfxLayer.clear();
    if (w.mode === 'generic' && v) Object.assign(v, saved);
    const after = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];
    return { n: c.n, bbox: c.bbox, named, before, after, restored: before.join(',') === after.join(',') };
  }, [{ id, key, mode, offX, offY, seed }, at]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const t0 = Date.now();
  let fail = 0;
  const failMsg = [];
  const bad = (m) => { failMsg.push(m); fail++; log(`  🔴 ${m}`); };

  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__vfxDebugFighters, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const running = await page.evaluate(PAGE_STILL_HUD);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);
    await installHarness(page, RW, RH, DELTA);
    if (PITCH !== 58) {
      const saved = await page.evaluate(([p, w]) => window.__wv.setPitch(p, w), [PITCH, DETECT_WIDTH]);
      log(`camera: re-pitched ${saved.pitch} -> ${PITCH} deg, frameMode ${saved.mode} -> ground, width ${saved.width} -> ${DETECT_WIDTH} wu`);
    }
    log(`viewport ${W}x${H}  readback ${RW}x${RH} (${RW * RH} px)  delta>=${DELTA}  pitch ${PITCH}  repeat ${REPEAT}`);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);

    // ── THE ROSTER, joined page-side ─────────────────────────────────────────────
    const roster = await page.evaluate(async () => {
      const rules = await import('/src/game/rules.ts');
      const reg = await import('/src/vfx/weapons/index.ts');
      const rows = []; let blurbs = 0; let linked = 0;
      for (const [id, c] of Object.entries(rules.CHARACTERS)) {
        blurbs += c.abilities.length;
        linked += c.abilities.filter((a) => a.weapon !== null).length;
        for (const w of c.weapons) {
          const v = reg.getWeaponVfx(id, w.key);
          rows.push({
            id, key: w.key, name: w.name, type: w.type, color: w.color,
            damage: w.damage, range: w.range ?? 0, cone: w.cone ?? 0,
            speed: w.speed ?? 0, emoji: w.emoji ?? '', pellets: w.pellets ?? 0,
            giantSlam: !!w.giantSlam, castMs: w.castMs ?? 0,
            hooks: v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [],
            hasEntry: !!v,
          });
        }
      }
      return { rows, blurbs, linked, chars: Object.keys(rules.CHARACTERS).length };
    });
    const all = roster.rows;
    log(`\nroster: ${all.length} weapons across ${roster.chars} characters — `
      + `${all.filter((w) => w.type === 'ranged').length} ranged / ${all.filter((w) => w.type === 'melee').length} melee / ${all.filter((w) => w.type === 'self').length} self`);
    log(`        ${roster.blurbs} ability blurbs, ${roster.linked} carrying a weapon: link, ${roster.blurbs - roster.linked} passive`);
    log(`        ${all.filter((w) => w.hasEntry).length} weapons have a bespoke registry entry; ${all.filter((w) => !w.hasEntry).length} are wholly on the generic path`);
    const hookCensus = {};
    for (const w of all) for (const h of w.hooks) hookCensus[h] = (hookCensus[h] ?? 0) + 1;
    log(`        hooks authored: ${JSON.stringify(hookCensus)}`);
    const teleAuthored = all.filter((w) => w.hooks.includes('telegraph'));
    const teleLive = all.filter((w) => w.castMs > 0);
    log(`        telegraph() authored on ${teleAuthored.length} (${teleAuthored.map((w) => `${w.id}.${w.key}`).join(', ')})`);
    log(`        castMs>0 on ${teleLive.length} (${teleLive.map((w) => `${w.id}.${w.key}=${w.castMs}`).join(', ') || 'NONE'}) — a telegraph() on a weapon with castMs 0 is NEVER FIRED`);

    // NON-VACUITY. `[].every()` is true; a filtered set asserted over must be checked
    // non-empty FIRST (CLAUDE.md #6, three occurrences in one session).
    if (all.length !== 33) bad(`roster is ${all.length} weapons, expected 33 — every count below describes a different game`);
    if (!all.filter((w) => w.hasEntry).length) bad('no weapon has a bespoke entry — the whole ablation arm would be vacuous');

    // ══ CONTROLS ═══════════════════════════════════════════════════════════════
    log(`\n══ CONTROLS ═══════════════════════════════════════════════════════════`);
    const at = await playerPos(page);

    // NULL: a frozen frame against itself.
    const nulls = await page.evaluate(() => {
      window.__wv.setBase();
      return [window.__wv.count(), window.__wv.count(), window.__wv.count()];
    });
    log(`NULL      frozen frame vs itself x3: ${nulls.join(', ')} px  (want 0,0,0 — not "small")`);
    if (nulls.some((n) => n !== 0)) bad(`NULL control non-zero (${nulls.join(',')}) — every area below is a difference of two different frames`);

    // RNG: the seeded LCG must be reproducible AND must actually vary.
    const rngOk = await page.evaluate(() => window.__rng.selftest());
    log(`RNG       seeded LCG reproducible and non-constant: ${rngOk}`);
    if (!rngOk) bad('RNG control failed — every "paired" number below is unpaired');

    // FORCED: a garish oversized impact must be enormous.
    const forced = await page.evaluate(async ([f]) => {
      window.__wv.reset(); window.__wv.step(0); window.__wv.setBase();
      window.__vfxSpawnTest('impact', f.x, f.y, 30, '#FF00FF');
      window.__wv.step(160);
      const n = window.__wv.count();
      window.__wv.reset();
      return n;
    }, [at]);
    log(`FORCED    garish 30-damage generic impact: ${forced} px  (want >> 0)`);
    if (forced < 400) bad(`FORCED control ${forced} px — the instrument cannot see a deliberately enormous effect`);

    /**
     * MOVER: deleting a bespoke hook must CHANGE THE FRAME.
     *
     * 🚨 THE FIRST VERSION OF THIS CONTROL WAS `lollipop.Giant`'s CAST AND IT FAILED,
     * AND IT WAS THE CONTROL THAT WAS WRONG. Measured: shipped 260,955 px, ablated
     * 260,211 px — a 0.3% move that reads exactly like "the ablation never reached
     * `game/vfx.ts`". It is the opposite: BOTH ARMS SATURATE. 260,955 of 360,000 is
     * 72.5% of the frame, and `vfx.ts:spawnWeaponCast`'s own header records the two
     * arms as 267,217 px (bespoke) and 262,797 px (the generic 360-degree wedge) on
     * this same 800x450 readback. Two effects that each fill three quarters of the
     * screen cannot differ by much no matter how different they are.
     *
     * That is CLAUDE.md #6's third vacuity shape verbatim — *"a known-bad planted
     * where the bug CANNOT EXPRESS ITSELF"* — and it would have been reported as a
     * broken instrument. So the mover is now chosen where the bug CAN express itself:
     * a weapon whose shipped effect is nowhere near the frame, with an explicit
     * saturation reject. `hamburger.Tomato`'s impact is the named default because the
     * pilot measured it at 1,321 px shipped against 4,527 px generic (0.29x) — a
     * three-fold move with 99% of the frame still free to move into.
     */
    const SAT_REJECT = 0.4;
    let mover = null; let moverS = 0; let moverG = 0; let moverWhy = '';
    const moverOrder = [
      all.find((w) => w.id === 'hamburger' && w.key === 'Tomato' && w.hooks.includes('impact')),
      ...all.filter((w) => w.hooks.includes('impact')),
    ].filter(Boolean);
    for (const cand of moverOrder) {
      const s = await fireTransient(page, { ...cand, beat: 'impact', mode: 'shipped', slices: SLICES, at });
      const g = await fireTransient(page, { ...cand, beat: 'impact', mode: 'generic', slices: SLICES, at });
      const sp = Math.max(...s.series); const gp = Math.max(...g.series);
      if (!s.restored || !g.restored) bad(`MOVER candidate ${cand.id}.${cand.key}: hook set did not restore`);
      if (Math.max(sp, gp) / (RW * RH) > SAT_REJECT) {
        log(`MOVER     rejected ${cand.id}.${cand.key} — ${(Math.max(sp, gp) / (RW * RH) * 100).toFixed(0)}% of frame, SATURATED, the move cannot express itself`);
        continue;
      }
      mover = cand; moverS = sp; moverG = gp;
      moverWhy = `${(Math.max(sp, gp) / (RW * RH) * 100).toFixed(1)}% of frame — room to move`;
      break;
    }
    if (!mover) bad('MOVER control has no unsaturated candidate carrying an impact() hook');
    if (mover) {
      const rel = moverS ? Math.abs(moverS - moverG) / moverS : 0;
      log(`MOVER     ${mover.id}.${mover.key} impact  shipped ${moverS} px  ablated ${moverG} px  (|d| ${(rel * 100).toFixed(1)}%; ${moverWhy})`);
      if (rel < 0.20) bad(`MOVER control moved only ${(rel * 100).toFixed(1)}% on an unsaturated weapon — the ablation may not be reaching game/vfx.ts`);
    }

    // POINTING: ablate weapon A, measure weapon B. B must not move.
    //   🚨 `--selftest` validates a tool's LOGIC. It never validates where the tool is
    //   POINTED (CLAUDE.md #6 — `valuescan` read a perfect selftest with 14 of 18
    //   stations in the wrong quadrant). This is that check.
    const probe = all.find((w) => w.hooks.includes('impact') && (!mover || `${w.id}.${w.key}` !== `${mover.id}.${mover.key}`));
    let pointOk = null;
    if (!probe) bad('POINTING control has no candidate — no second weapon carries an impact() hook');
    if (probe && mover) {
      const peakOf = async (seed) => {
        const r = await fireTransient(page, { ...probe, beat: 'impact', mode: 'shipped', slices: SLICES, at, seed });
        return Math.max(...r.series);
      };
      const bench = [];
      for (let i = 0; i < 3; i++) bench.push(await peakOf(101 + i));
      const withOther = await page.evaluate(async ([mw, pw, sl, f]) => {
        const rules = await import('/src/game/rules.ts');
        const reg = await import('/src/vfx/weapons/index.ts');
        const v = reg.getWeaponVfx(mw.id, mw.key);
        const saved = {};
        for (const k of Object.keys(v)) if (typeof v[k] === 'function') { saved[k] = v[k]; delete v[k]; }
        const out = [];
        for (let i = 0; i < 3; i++) {
          window.__wv.reset(); window.__wv.step(0); window.__wv.setBase();
          window.__rng.seed(101 + i);
          window.__vfxLayer.spawnImpactBurst(f.x, f.y, pw.color, pw.damage, { weapon: rules.CHARACTERS[pw.id].weapons.find((x) => x.key === pw.key), characterId: pw.id, fromXWU: f.x - 60, fromYWU: f.y });
          let prev = 0; let peak = 0;
          for (const t of sl) { window.__wv.step(t - prev); prev = t; peak = Math.max(peak, window.__wv.count()); }
          window.__wv.reset();
          out.push(peak);
        }
        Object.assign(v, saved);
        return out;
      }, [mover, probe, SLICES, at]);
      const a = median(bench); const b = median(withOther);
      const drift = a ? Math.abs(a - b) / a : 0;
      /**
       * ⚠️ THE DRIFT IS JUDGED AGAINST THIS PAIR'S OWN WITHIN-ARM SPREAD, not against
       * a guessed tolerance. These effects come out of round-robin pools with
       * randomised shard directions, so three measurements of UNCHANGED code already
       * disagree; a fixed "must be under 5%" would fail on noise and a fixed "must be
       * under 30%" would pass a real leak. Both arms are measured three times here for
       * exactly that reason, and the tolerance is what the instrument itself produced.
       */
      const spreadOf = (xs) => (median(xs) ? (Math.max(...xs) - Math.min(...xs)) / median(xs) : 0);
      const within = Math.max(spreadOf(bench), spreadOf(withOther));
      pointOk = { drift: +drift.toFixed(3), within: +within.toFixed(3), bench, withOther };
      log(`POINTING  ${probe.id}.${probe.key} impact, with ${mover.id}.${mover.key} ABLATED: ${a} -> ${b} px`);
      log(`          drift ${(drift * 100).toFixed(1)}%  vs this pair's own within-arm spread ${(within * 100).toFixed(1)}%  (want drift <= spread)`);
      if (drift > within + 0.05) bad(`POINTING control: ablating ${mover.id}.${mover.key} moved ${probe.id}.${probe.key} by ${(drift * 100).toFixed(1)}%, beyond its own ${(within * 100).toFixed(1)}% noise — the ablation is not weapon-local`);
    }

    /**
     * SEEDPAIR: the same weapon, the same arm, the same seed, twice.
     *
     * This is the drift control the whole matrix rests on. Before the seeded RNG this
     * pair spread 15% and there was no way to tell a real 1.15x ratio from a re-roll.
     * It must now be EXACTLY equal — CLAUDE.md #4's *"the question is no longer only
     * 'is it there?' but 'is it the SAME?', answered with a drift control rather than
     * a guessed tolerance"*. Zero, not "small".
     */
    let seedPair = null;
    if (mover) {
      const a = await fireTransient(page, { ...mover, beat: 'impact', mode: 'shipped', slices: SLICES, at, seed: 4242 });
      const b = await fireTransient(page, { ...mover, beat: 'impact', mode: 'shipped', slices: SLICES, at, seed: 4242 });
      const c = await fireTransient(page, { ...mover, beat: 'impact', mode: 'shipped', slices: SLICES, at, seed: 9999 });
      seedPair = { same: a.series, again: b.series, otherSeed: c.series };
      const identical = JSON.stringify(a.series) === JSON.stringify(b.series);
      const varies = JSON.stringify(a.series) !== JSON.stringify(c.series);
      log(`SEEDPAIR  ${mover.id}.${mover.key} impact, seed 4242 twice: ${a.series.join(',')}`);
      log(`                                              and again: ${b.series.join(',')}   identical=${identical}`);
      log(`          seed 9999 (must DIFFER, or the seed is doing nothing): ${c.series.join(',')}   varies=${varies}`);
      if (!identical) bad('SEEDPAIR: two identically-seeded runs of the same arm disagree — the arms are not paired and no ratio here is exact');
      if (!varies) bad('SEEDPAIR: changing the seed changed nothing — the seed is not reaching the effect, so the across-seed spread below is vacuous');
    }

    /**
     * ── DIRECTION: the argument every previous per-weapon VFX measurement here
     *    could not pass, and the reason this file stopped using `__vfxSpawnTest` ──
     *
     * `match.ts` always hands `spawnImpactBurst` the ATTACKER'S POSITION for a weapon
     * hit (`fromXWU`/`fromYWU`, populated unconditionally inside
     * `if (ev.source.kind === 'weapon')`), and `vfx.ts` turns it into `ctx.direction`
     * — the vector a bespoke `impact()` orients its spray, cone or splash along.
     *
     * `window.__vfxSpawnTest('impact', ...)` passes `{ weapon, characterId }` and
     * nothing else, so `ctx.direction` is (0,0,0) — A STATE THE SHIPPED GAME NEVER
     * PRODUCES FOR A WEAPON HIT. `vfx_wcov.mjs`, `vfx_ablate.mjs`, `vfx_hue.mjs` and
     * `vfx_coverage.mjs` all fire through that hook.
     *
     * This is not asserted, it is MEASURED: both directions, same seed, on every
     * weapon with a bespoke impact, and the count that differs beyond the null-arm
     * floor is reported. A zero here would mean the gap is harmless and this note is
     * only a caution; a non-zero means those tools measured a frame the game does not
     * draw, for those weapons.
     */
    const dirRows = [];
    for (const w of all.filter((x) => x.hooks.includes('impact'))) {
      const withDir = await fireTransient(page, { ...w, beat: 'impact', mode: 'shipped', slices: SLICES, at, seed: 777, dirFrom: true });
      const noDir = await fireTransient(page, { ...w, beat: 'impact', mode: 'shipped', slices: SLICES, at, seed: 777, dirFrom: false });
      const a = Math.max(...withDir.series); const b = Math.max(...noDir.series);
      dirRows.push({ id: w.id, key: w.key, withDir: a, noDir: b, rel: a ? +((b - a) / a).toFixed(3) : 0 });
    }
    if (!dirRows.length) bad('DIRECTION control is EMPTY — no weapon carries an impact() hook, so the claim below would be vacuous');
    else {
      const moved = dirRows.filter((r) => Math.abs(r.rel) > 0.05);
      log(`DIRECTION ${dirRows.length} bespoke impacts fired both with the attacker position match.ts supplies and with`);
      log(`          the (0,0) direction __vfxSpawnTest produces: ${moved.length} differ by >5%`);
      if (moved.length) {
        log(`          ${moved.sort((x, y) => Math.abs(y.rel) - Math.abs(x.rel)).slice(0, 8).map((r) => `${r.id}.${r.key} ${r.withDir}->${r.noDir} (${(r.rel * 100).toFixed(0)}%)`).join('  ·  ')}`);
      }
    }

    // PLANTED KNOWN-BAD: a hook that draws NOTHING, on a weapon whose shipped impact
    // is LARGE, so the bug can actually express itself.
    const plantCandidates = [];
    for (const w of all.filter((x) => x.hooks.includes('impact')).slice(0, 6)) {
      const r = await fireTransient(page, { ...w, beat: 'impact', mode: 'shipped', slices: SLICES, at });
      plantCandidates.push({ w, peak: Math.max(...r.series) });
    }
    plantCandidates.sort((a, b) => b.peak - a.peak);
    if (!plantCandidates.length) bad('PLANTED control has no candidate');
    let planted = null;
    if (plantCandidates.length) {
      const host = plantCandidates[0];
      planted = await page.evaluate(async ([hw, sl, f]) => {
        const rules = await import('/src/game/rules.ts');
        const reg = await import('/src/vfx/weapons/index.ts');
        const v = reg.getWeaponVfx(hw.id, hw.key);
        const real = v.impact;
        v.impact = () => { /* authored, registered, reached — and draws NOTHING */ };
        window.__wv.reset(); window.__wv.step(0); window.__wv.setBase();
        window.__rng.seed(101);
        window.__vfxLayer.spawnImpactBurst(f.x, f.y, hw.color, hw.damage, { weapon: rules.CHARACTERS[hw.id].weapons.find((x) => x.key === hw.key), characterId: hw.id, fromXWU: f.x - 60, fromYWU: f.y });
        let prev = 0; let peak = 0;
        for (const t of sl) { window.__wv.step(t - prev); prev = t; peak = Math.max(peak, window.__wv.count()); }
        window.__wv.reset();
        v.impact = real;
        return { peak, restored: v.impact === real };
      }, [host.w, SLICES, at]);
      log(`PLANTED   ${host.w.id}.${host.w.key} impact replaced with a hook that draws nothing:`);
      log(`          real ${host.peak} px -> planted ${planted.peak} px  (want ~0; the residue is the status-refusal flag, which runs BEFORE the bespoke branch)`);
      if (planted.peak >= host.peak * 0.5) bad(`PLANTED known-bad still reported ${planted.peak} px against a real ${host.peak} — this instrument cannot see an empty hook, which is the exact defect it exists for`);
      if (!planted.restored) bad('PLANTED control did not restore the real hook');
    }

    if (SELFTEST_ONLY) {
      log(`\n${fail ? `🔴 ${fail} CONTROL FAILURE(S)` : '✅ controls pass'}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      process.exitCode = fail ? 1 : 0;
      return;
    }

    // ══ THE MATRIX ═════════════════════════════════════════════════════════════
    const want = ONLY ? all.filter((w) => ONLY.includes(w.id) || ONLY.includes(`${w.id}.${w.key}`)) : all;
    if (!want.length) { bad(`--only matched nothing`); return; }
    const results = [];
    const spreads = [];
    const ratioSpreads = [];

    for (const beat of BEATS) {
      const isProj = beat === 'projectile';
      const pool = isProj ? want.filter((w) => w.type === 'ranged') : want;
      if (!pool.length) { log(`\n(beat ${beat}: no weapons)`); continue; }
      log(`\n══ BEAT: ${beat.toUpperCase()}  (${pool.length} weapons, pitch ${PITCH}) ══════════════`);
      log(`${pad('weapon', 26)} ${rpad('hook', 5)} ${rpad('shipped', 8)} ${rpad('generic', 8)} ${rpad('ratio', 7)} ${rpad('sat%', 6)} ${rpad('peak', 6)}  spread`);
      log('─'.repeat(96));

      for (const w of pool) {
        const hookName = isProj ? 'projectile' : (beat === 'cast' ? 'cast' : 'impact');
        const hasHook = w.hooks.includes(hookName)
          // A bespoke cast() also changes spawnWeaponCast's ARBITRATION for a
          // giantSlam, so the cast row is meaningful for those even without the hook.
          || (beat === 'cast' && w.hooks.includes('cast'));
        const arms = {};
        for (const mode of ['shipped', 'generic']) {
          const reps = [];
          let box = null; let peakAt = null; let restored = true; let named = null;
          for (let r = 0; r < REPEAT; r++) {
            if (isProj) {
              // Both offsets, MAXed: a projectile that is legible on one trajectory
              // and not the other is a legibility failure, and the max is the
              // charitable read — the number to beat, not to hide behind.
              let best = -1;
              for (const [ox, oy] of PROJ_OFFSETS) {
                const rr = await fireProjectile(page, { id: w.id, key: w.key, mode, offX: ox, offY: oy, at, seed: 101 + r });
                if (!rr.restored) restored = false;
                named = rr.named;
                if (rr.n > best) { best = rr.n; box = rr.bbox; }
              }
              reps.push(best);
            } else {
              const rr = await fireTransient(page, {
                id: w.id, key: w.key, beat, mode, slices: SLICES, at, seed: 101 + r,
              });
              if (!rr.restored) restored = false;
              let pk = -1, pi = 0;
              rr.series.forEach((n, i) => { if (n > pk) { pk = n; pi = i; } });
              reps.push(pk); box = rr.boxes[pi]; peakAt = SLICES[pi];
            }
          }
          const med = median(reps);
          const spread = med ? (Math.max(...reps) - Math.min(...reps)) / med : 0;
          if (REPEAT > 1 && med > 0) spreads.push(spread);
          arms[mode] = { reps, med, spread, box, peakAt, restored, named };
          if (!restored) bad(`${w.id}.${w.key} ${beat} ${mode}: hook set did NOT restore — every later row is suspect`);
        }
        const s = arms.shipped, g = arms.generic;
        /**
         * PER-SEED RATIOS, then the median of those — NOT the ratio of the two
         * medians. The seeded RNG makes shipped rep `r` and generic rep `r` the SAME
         * DRAW, so `shipped[r]/generic[r]` is a PAIRED delta and is exact; a ratio of
         * two medians throws that pairing away and is an aggregate. CLAUDE.md #10:
         * *"a paired per-matchup delta on identical seeds is EXACT — it is a DIFFERENT
         * QUANTITY from an aggregate and must be reported separately"*. `ratioSpread`
         * is the honest floor for THIS column: how much the ratio moves when only the
         * draw changes.
         */
        const ratioReps = s.reps.map((v, i) => {
          const gg = g.reps[i];
          return gg ? v / gg : (v ? Infinity : 1);
        }).filter((v) => Number.isFinite(v));
        const ratio = ratioReps.length ? median(ratioReps)
          : (g.med ? s.med / g.med : (s.med ? Infinity : 1));
        const ratioSpread = ratioReps.length > 1 && median(ratioReps)
          ? (Math.max(...ratioReps) - Math.min(...ratioReps)) / median(ratioReps) : 0;
        const satS = (s.med / (RW * RH)) * 100;
        const satG = (g.med / (RW * RH)) * 100;
        const sat = Math.max(satS, satG);
        results.push({
          id: w.id, key: w.key, name: w.name, type: w.type, beat, pitch: PITCH,
          hasHook, hooks: w.hooks, damage: w.damage, color: w.color, giantSlam: w.giantSlam,
          shippedPx: s.med, genericPx: g.med, ratio: +ratio.toFixed(3),
          ratioReps: ratioReps.map((v) => +v.toFixed(3)), ratioSpread: +ratioSpread.toFixed(3),
          shippedReps: s.reps, genericReps: g.reps,
          spreadShipped: +s.spread.toFixed(3), spreadGeneric: +g.spread.toFixed(3),
          satPct: +sat.toFixed(1), peakAtMs: s.peakAt, bboxShipped: s.box, bboxGeneric: g.box,
          namedInPool: s.named,
        });
        if (ratioReps.length > 1) ratioSpreads.push(ratioSpread);
        const mark = !hasHook ? ' —' : (ratio < 0.5 ? ' 🔴' : (ratio < 0.8 ? ' 🟠' : ''));
        log(`${pad(`${w.id}.${w.key}`, 26)} ${rpad(hasHook ? 'yes' : 'no', 5)} ${rpad(s.med, 8)} ${rpad(g.med, 8)} ${rpad(ratio === Infinity ? 'inf' : ratio.toFixed(2), 7)} ${rpad(sat.toFixed(1), 6)} ${rpad(s.peakAt ?? '-', 6)}  ${(Math.max(s.spread, g.spread) * 100).toFixed(0)}%${mark}`);

        if (SHOTS) {
          await page.evaluate(async ([ww, ms, bt, f]) => {
            const rules = await import('/src/game/rules.ts');
            const weapon = rules.CHARACTERS[ww.id].weapons.find((x) => x.key === ww.key);
            window.__wv.reset(); window.__wv.step(0);
            window.__rng.seed(101);
            if (bt === 'impact') window.__vfxLayer.spawnImpactBurst(f.x, f.y, weapon.color, weapon.damage, { weapon, characterId: ww.id, fromXWU: f.x - 60, fromYWU: f.y });
            else window.__vfxLayer.spawnWeaponCast(f.x, f.y, { x: 1, y: 0 }, weapon, ww.id);
            if (ms > 0) window.__wv.step(ms);
            window.__wv.shot();
          }, [w, s.peakAt ?? 160, beat, at]);
          await page.screenshot({ path: `${OUT}/${beat}.p${PITCH}.${w.id}.${w.key}.png` });
          await page.evaluate(() => window.__wv.reset());
        }
      }
    }

    // ── THE FLOOR, measured on this run rather than inherited ────────────────────
    // ⚠️ TWO DIFFERENT FLOORS, and conflating them is the mistake CLAUDE.md #10 warns
    // about. `spreads` is how much ONE ARM's absolute px moves when the draw changes —
    // the floor for the `shipped`/`generic` COLUMNS. `ratioSpreads` is how much the
    // PAIRED ratio moves — the floor for the `ratio` column, and it is much tighter
    // because the draw cancels. Judge a row on the second.
    const floor90 = spreads.length ? pct(spreads, 90) : null;
    const rFloor90 = ratioSpreads.length ? pct(ratioSpreads, 90) : null;
    const json0 = {};
    log(`\n══ RESOLUTION FLOOR ═══════════════════════════════════════════════════`);
    if (floor90 === null) log(`(--repeat ${REPEAT}: no repeats, so no floor was measured — do not act on any ratio from this run)`);
    else {
      log(`ABSOLUTE px, one arm, across ${REPEAT} seeds — (max-min)/median over ${spreads.length} arms:`);
      log(`   median ${(median(spreads) * 100).toFixed(1)}%   p90 ${(floor90 * 100).toFixed(1)}%   max ${(Math.max(...spreads) * 100).toFixed(1)}%`);
      log(`PAIRED RATIO, same seed both arms — (max-min)/median over ${ratioSpreads.length} rows:`);
      log(`   median ${(median(ratioSpreads) * 100).toFixed(1)}%   p90 ${(rFloor90 * 100).toFixed(1)}%   max ${(Math.max(...ratioSpreads) * 100).toFixed(1)}%`);
      log(`  (the two are different quantities: the draw cancels in the ratio and does not in the columns)`);
    }

    /**
     * ── THE NULL ARM, and it is the floor that actually governs a verdict ─────────
     *
     * A row whose beat has NO bespoke hook has NOTHING DELETED on the generic arm —
     * both arms are the identical code path, so its true ratio is 1.000 by
     * construction. Whatever those rows report instead of 1.000 IS this instrument's
     * floor, measured on the shipped tree, with no assumption and no tolerance
     * guessed. `DECISIONS §62` is the precedent: a floor built from a null arm rather
     * than from a formula.
     *
     * ⚠️ NON-VACUITY: this is a FILTERED set and `[].every()` returns true, so the set
     * is asserted non-empty before anything is concluded from it (CLAUDE.md #6 — that
     * shape fired three times in three files in one session).
     *
     * It is also the sharper floor. The p90 over ALL rows is contaminated by real
     * signal: one weapon whose bespoke burst is genuinely draw-dependent drags it to
     * 23.5% and would hide every defect between 1.0x and 1.24x.
     */
    const nullArm = results.filter((r) => !r.hasHook);
    if (!nullArm.length) {
      bad('NULL ARM is EMPTY — no row had a beat without a bespoke hook, so the floor below would be vacuous');
    } else {
      const dev = nullArm.map((r) => Math.abs(r.ratio - 1));
      log(`\nNULL ARM (${nullArm.length} rows with no hook for their beat — both arms are the same code path, true ratio 1.000):`);
      log(`   |ratio - 1|: median ${(median(dev) * 100).toFixed(2)}%   p90 ${(pct(dev, 90) * 100).toFixed(2)}%   max ${(Math.max(...dev) * 100).toFixed(2)}%`);
      log(`   worst: ${nullArm.map((r, i) => [r, dev[i]]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, d]) => `${r.id}.${r.key}/${r.beat} ${(d * 100).toFixed(2)}%`).join(', ')}`);
      const nf = Math.max(0.02, pct(dev, 90));
      log(`→ 🔴 FLOOR ON THE RATIO COLUMN: ${(1 - nf).toFixed(3)}..${(1 + nf).toFixed(3)}. A row inside that band is INDISTINGUISHABLE from "no bespoke effect at all".`);
      if (Math.max(...dev) > 0.25) bad(`NULL ARM max deviation ${(Math.max(...dev) * 100).toFixed(0)}% — a row that CANNOT differ differs by a quarter; the instrument is not measuring what it claims`);
      json0.nullArm = { n: nullArm.length, medianDev: median(dev), p90Dev: pct(dev, 90), maxDev: Math.max(...dev), floor: nf };
    }

    const json = {
      ...json0,
      base: BASE, pitch: PITCH, detectWidth: PITCH === 58 ? null : DETECT_WIDTH,
      w: W, h: H, readback: [RW, RH], delta: DELTA, repeat: REPEAT, slices: SLICES,
      projOffsets: PROJ_OFFSETS, floorP90: floor90, floorMedian: spreads.length ? median(spreads) : null,
      ratioFloorP90: rFloor90, ratioFloorMedian: ratioSpreads.length ? median(ratioSpreads) : null,
      controls: { nulls, rngOk, forced, mover: mover ? `${mover.id}.${mover.key}` : null, moverShipped: moverS, moverGeneric: moverG, pointing: pointOk, seedPair, direction: dirRows, planted },
      roster: { weapons: all.length, blurbs: roster.blurbs, chars: roster.chars, hookCensus },
      rows: all, results,
    };
    await writeFile(`${OUT}/wv_area.p${PITCH}.json`, JSON.stringify(json, null, 2));
    log(`\njson -> ${OUT}/wv_area.p${PITCH}.json   ·   ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
    if (fail) { log(`\n🔴 ${fail} CONTROL FAILURE(S): ${failMsg.join(' | ')}`); process.exitCode = 1; }
  } finally {
    await browser.close();
  }
}
main();
