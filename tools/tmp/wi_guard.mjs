#!/usr/bin/env node
/**
 * WI_GUARD — the impact beat's anchor, guarded. FIVE assertions, each with a
 * known-bad that makes it go RED.
 *
 * ── WHAT IT GUARDS ──────────────────────────────────────────────────────────────
 *
 * `209e270` measured all 33 weapons x 3 beats x {shipped, generic control} and found
 * sixteen weapons short — **every one of them on the IMPACT beat**, because a bespoke
 * `impact()` hook took the branch in `vfx.ts:spawnImpactBurst` and RETURNED, leaving
 * nothing underneath it. `burrito.Swarm` delivered 139 px against its own generic
 * control's 1367. `vfx.ts:impactAnchor` fixes it the way `castMuzzle` fixed the same
 * bug on the cast beat: the shared beat is unconditional, spawned UNDER the bespoke
 * hook, subordinate by SIZE.
 *
 *   A. FLOOR      every weapon carrying a bespoke `impact()` must deliver >= 300 px.
 *                 That bar is `vfx.ts:castMuzzle`'s and is derived there — 282 px is
 *                 *"inside measurement noise of the floor"*, 18 px is *"a cast the
 *                 player cannot see fire"*. This is the assertion Uri's question is
 *                 actually about.
 *   B. ANCHOR     with the bespoke hook replaced by one that DRAWS NOTHING, the frame
 *                 must still change by >= 0.25 of what the generic burst delivers for
 *                 that same weapon. This is the one that catches a REGRESSION of the
 *                 early return: A can be satisfied by a fat sculpt, B cannot be
 *                 satisfied by anything except the anchor actually running.
 *                 0.25 is not a guess: `tools/tmp/wi_derive.mjs` measured the anchor at
 *                 0.323-0.423 of the generic burst at pitch 58 and 0.352-0.501 at
 *                 pitch 20, over all sixteen short rows.
 *   C. SUBORDINATE the same ratio must stay <= 0.60. `impactAnchor`'s derivation is
 *                 two-sided — the anchor is bounded BELOW by the 300 px floor and
 *                 ABOVE by "subordinate has to mean minority", and k = 0.60 already
 *                 puts 10 of 16 rows over half. Without C, the cheapest way to make A
 *                 and B green forever is to raise `IMPACT_ANCHOR_K` until the anchor
 *                 IS the hit, which is the defect the bespoke system exists to avoid.
 *                 See `ANCHOR_MAX_RATIO` for why the bar is 0.60 and not the 0.55 it
 *                 was first set to — a damage-0 weapon's ratio has a floor that no `k`
 *                 can move, because `burst()`'s own clamps bind in both arms.
 *
 *                 🚨 **C IS KEPT WORD FOR WORD AND IT WAS MEASURING THE WRONG THING.**
 *                 Its denominator is the GENERIC burst — the one the anchor replaced,
 *                 which is not on screen. `a42224c`'s rule is about dominance of the
 *                 hit that SHIPS. Those are different quantities and C cannot see the
 *                 difference: at `a494f98` C ran 0.32-0.50 against a 0.60 bar, green on
 *                 every row at both pitches, while the anchor covered up to **88% of
 *                 the composite** and 18 of 27 weapons had it as a MAJORITY. A guard
 *                 measuring a different quantity than the rule it is named after is
 *                 worse than no guard, because it certifies the thing it cannot see.
 *                 Kept, with its old wording, per house style — the way it went wrong
 *                 is the useful part, and it still guards the upper bound it names.
 *   E. DOMINANCE  **the assertion C was supposed to be.** With the anchor suppressed,
 *                 the bespoke sculpt alone delivers `sculptPx`; with the sculpt
 *                 suppressed, the anchor alone delivers `anchorPx`. On every weapon
 *                 whose sculpt clears the floor BY ITSELF, `anchorPx <= sculptPx` —
 *                 the hand-authored effect must be at least as much of the hit as the
 *                 shared one under it. Weapons whose sculpt is under the floor alone
 *                 are RESCUE rows, and for them the anchor being the majority is
 *                 forced rather than chosen. The union bound makes that exact: the
 *                 composite is at most `sculpt + anchor`, so under `anchor <= sculpt`
 *                 it is at most `2 * sculpt`. `burrito.Swarm`'s sculpt is **128 px**,
 *                 which caps its composite at 256 — **under the 300 px floor with the
 *                 overlap already counted as zero**, and the two are drawn on the same
 *                 point so the real overlap is large. Subordination and the floor are
 *                 mutually exclusive on that weapon; no `k`, no recipe and no adaptive
 *                 rule can have both. Rescue rows are NAMED in the output and their
 *                 COUNT is ratcheted, so the exemption cannot quietly grow to cover
 *                 the roster — which is the only way this arm could be defeated.
 *
 * ── THE KNOWN-BAD (CLAUDE.md #6: a guard not shown to FAIL is not a guard) ───────
 *
 * Two independent ones, because they fail for different reasons:
 *
 *   `--knownbad`  re-installs the two ORIGINAL defects IN-PAGE, on the fixed tree:
 *                   · `impactAnchor` returns early for `role === 'subordinate'`
 *                     — literally the pre-fix `return` after the bespoke branch
 *                   · `spawnImpactBurst` has `fromXWU`/`fromYWU` stripped off its
 *                     `source` argument — literally the pre-fix `__vfxSpawnTest`
 *                 A, B and D must go RED. Self-contained: no second checkout needed,
 *                 so the guard can demonstrate itself anywhere.
 *
 *   `--knownbad loud`  the OTHER direction, because arms have to be shown to fail
 *                 SEPARATELY. The bug above cannot make C red — C guards the upper
 *                 bound, and an arm with no known-bad of its own is a comment with a
 *                 tick next to it. This mode draws the subordinate anchor as the FULL
 *                 generic burst at `k = 0.75` — the exact mistake `impactAnchor`'s
 *                 header exists to prevent, which is copying `castMuzzle`'s factor
 *                 across. **C must go RED and A/B must stay GREEN**, which is also the
 *                 check that C is not just a restatement of B.
 *                 ⚠️ This line read *"scales the subordinate anchor's arguments by
 *                 1.5"* and that is how it was implemented; see `genericAt` for why a
 *                 known-bad expressed as a DELTA on the thing under test silently
 *                 follows it, and what `x 1.5` came to mean once the anchor stopped
 *                 being a scaled `burst()`.
 *
 *   `--knownbad share`  **the defect that shipped**, re-installed in-page: the
 *                 `a42224c` anchor recipe verbatim — full `burst()`, `k = 0.50`, the
 *                 decal at the generic recipe's own 0.55 lower clamp. **E must go RED
 *                 and A, B AND C must all stay GREEN.** That last clause is the whole
 *                 argument for E existing: this state ran green through C on every row
 *                 at both pitches for the life of the anchor, so an arm that cannot
 *                 stay green here would just be C again under a new letter. The
 *                 re-implementation is not eyeballed. `tools/tmp/an_probe.mjs`'s
 *                 SELF-PAIR fired it against the real shipped anchor on `4232ab7`,
 *                 whose `src/game/vfx.ts` is byte-identical to `a494f98`'s (nothing
 *                 touched that file between them), and got **27/27 EXACT**. And on
 *                 the five-victim frame it reproduces the real `a494f98` WORKTREE to
 *                 the pixel on all three columns (16178 / 14997 / 7230 at pitch 20).
 *
 *   a pre-fix WORKTREE, which is the real thing rather than a reproduction:
 *     git worktree add --detach /tmp/fa-wi <sha-before>
 *     ln -s "$PWD/node_modules" /tmp/fa-wi/node_modules   # omit either symlink and
 *     ln -s "$PWD/reference"    /tmp/fa-wi/reference      # gates die on a missing
 *                                                        # import, looking exactly broken
 *     node tools/tmp/sx_snap.mjs --root /tmp/fa-wi -- node tools/tmp/wi_guard.mjs --url '{URL}'
 *
 * ── D. THE QA HOOK'S DIRECTION ──────────────────────────────────────────────────
 *
 * `window.__vfxSpawnTest('impact', ...)` used to pass `{ weapon, characterId }` and
 * nothing else, so a bespoke hook received `ctx.direction === (0,0,0)` — a state
 * `match.ts` never produces for a weapon hit, and the state `vfx_wcov`, `vfx_ablate`,
 * `vfx_hue` and `vfx_coverage` all measured. Guarded by planting a recorder hook and
 * reading the vector back. Cheap: one fire, no pixels.
 *
 * ── CONTROLS ────────────────────────────────────────────────────────────────────
 *
 *   NULL         frozen frame vs itself                 -> 0 px, not "small"
 *   FORCED       a garish oversized generic impact       -> >> 0, or the counter is blind
 *   REACH        the planted no-op hook must be CALLED   -> otherwise arm B measures the
 *                REAL sculpt and passes for the wrong reason; and the suppressed anchor
 *                must have been ENTERED -> otherwise arm E's sculpt column is the
 *                COMPOSITE, which would make every dominance ratio look wonderful
 *   RESTORE      hook set read back after every case
 *   NON-VACUITY  every filtered set is checked NON-EMPTY before anything is asserted
 *                over it — `[].every()` returns true, and that vacuity has fired at
 *                least seven times in this repo, always because a fix emptied the set.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean -- node tools/tmp/wi_guard.mjs --url '{URL}'
 *   ... --pitch 20        the lobby-analogue detector (CLAUDE.md #3 — verify at BOTH)
 *   ... --knownbad        must exit 1  (A, B, D red)
 *   ... --knownbad loud   must exit 1  (C red, A/B green)
 *   ... --knownbad share  must exit 1  (E red, A/B/C green) — the defect that SHIPPED
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
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('wi_guard: --url or PREVIEW_BASE required (never the shared dev server)'); process.exit(2); }
const OUT = String(args.out ?? 'shots/wi');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
const KNOWNBAD = !!args.knownbad;
/** `--knownbad` -> 'missing' (the shipped bug); `--knownbad loud` -> the opposite one. */
const KB_KIND = typeof args.knownbad === 'string' ? args.knownbad : 'missing';
const SEED = Number(args.seed ?? 777);
const ONLY = args.only ? String(args.only).split(',') : null;
/**
 * `wv_area`'s schedule minus its last slice. Not a corner cut — measured: across all
 * 66 impact rows of `209e270`/`dce15bb`, at BOTH pitches, **zero** peaked at 620 ms
 * (58: 13@260 10@160 5@400 4@80 1@16; 20: 14@260 7@160 7@400 4@80 1@16). Dropping a
 * slice that never carried a peak buys 17% of a run that fires three arms per weapon.
 */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number) : [16, 80, 160, 260, 400]);
/** `vfx.ts:castMuzzle`'s floor, derived there. Not invented here. */
const FLOOR_PX = Number(args.floor ?? 300);
/**
 * Measured band for anchor/generic — `wi_derive.mjs` over the sixteen short rows:
 * 0.323-0.423 at pitch 58, 0.352-0.501 at pitch 20. The bars sit outside both.
 *
 * ⚠️ **0.60 AND NOT 0.55, AND THE ROW THAT MOVED IT IS A MECHANISM, NOT AN EXCEPTION.**
 * The bar was 0.55 — comfortably outside the sixteen-row band at both pitches — and
 * `taco.Double` went red on it at pitch 20 (0.572; 0.462 at pitch 58), with the next
 * highest row at 0.501. `taco.Double` is the roster's only **damage-0** weapon, and at
 * `amount = 0` three of `burst()`'s five elements are IDENTICAL in the two arms no
 * matter what `k` is, because the recipe's own clamps bind in both:
 *
 *     sizeFactor  clamp(0.42 + 0.075*0, 0.42, 2.0) = 0.42 — at its FLOOR
 *     decal       clamp(0.65*sf, 0.55, 1.5): generic 0.55, anchor 0.55  ← identical
 *     shards      clamp(1 + 0.4*0, 2, 8) = 2, and max(2, round(2*k)) = 2 ← identical
 *     ring        0.6*sf + 0.35: generic 0.602, anchor 0.476 — 79%, AFFINE not scaled
 *     flash       0.5*sf -> 1.15*sf — the only term that scales as k²
 *
 * So a/g has a hard floor near 0.57 for a chip-damage weapon and lowering `k` cannot
 * move it. Raising the bar is the honest response; exempting the row would have hidden
 * the one place the recipe's floors are visible. 0.60 still catches the failure C
 * exists for by a wide margin: the `--knownbad loud` band is 0.662-0.702 at pitch 58
 * and `wi_derive` measured k=0.75 at 0.621-0.753 at pitch 20.
 */
/**
 * ⚠️ **THIS WAS 0.25 AND IT WAS A BAR ON A RECIPE, NOT ON A PROPERTY.** Old wording,
 * kept per house style because the way it goes stale is the useful part:
 *
 * > *"0.25 is not a guess: `wi_derive.mjs` measured the anchor at 0.323-0.423 of the
 * > generic burst at pitch 58 and 0.352-0.501 at pitch 20, over all sixteen short
 * > rows."*
 *
 * True, and it pinned B to the SHIPPED ANCHOR'S SIZE rather than to what B asserts,
 * which is *"an anchor is running under this hook at all"*. The moment the subordinate
 * anchor stopped being a scaled `burst()` — ground half only, `k = 0.25`, decal clamp
 * released — the measured band moved to **0.128-0.256 at pitch 58**, and B went red on
 * 26 of 27 rows while the anchor was running perfectly on every one of them. A bar
 * calibrated to a recipe fires on the next recipe.
 *
 * 0.10 is the same bar restated: the old one sat at 0.774 of its own measured minimum
 * (0.25 / 0.323); 0.774 of the new minimum (0.128) is 0.099. The bug B exists for —
 * `impactAnchor` returning before it draws — delivers **exactly 0**, so the distance to
 * the failure it guards is unchanged and only the distance to the healthy tree moved.
 */
const ANCHOR_MIN_RATIO = Number(args.anchorMin ?? 0.10);
const ANCHOR_MAX_RATIO = Number(args.anchorMax ?? 0.60);
/**
 * ── ARM E's TWO NUMBERS ─────────────────────────────────────────────────────────
 *
 * `DOMINANCE_MAX` is the bar on `anchorPx / sculptPx`, and **1.00 is not a tuned
 * threshold, it is the design rule written as an inequality**: *"the hand-authored
 * sculpt was to remain the dominant read."* Anything above 1 says the shared anchor
 * covers more of the frame than the weapon's own effect does. It is deliberately NOT
 * expressed against the composite: the anchor and the sculpt are drawn on the same
 * point, so `anchor / composite` is inflated by their OVERLAP and two effects of
 * equal footprint both score ~0.8 of a union they share. Measured on `a494f98`,
 * `pizza.Dough` reads 0.88 of its composite with a sculpt that is 0.57 of it — the two
 * fractions sum past 1 precisely because they overlap. `anchor <= sculpt` is a
 * comparison of two independently measured arms and has no such artefact.
 *
 * `RESCUE_MAX` ratchets how many weapons may take the exemption. It is a COUNT, not a
 * list, so a weapon can move in and out as the sculpts are authored, but the exemption
 * cannot grow — which is the only way arm E could be defeated without touching E.
 */
/**
 * 1.15, and the 0.15 is a MEASURED RESOLUTION FLOOR, not a tolerance for taste
 * (CLAUDE.md #10: state the floor before acting on a change in the metric).
 *
 * `anchorPx` and `sculptPx` are two single instances of two randomised effects. Fired
 * on four seeds at pitch 20 (`an_probe --seed 777/1234/20260820/55`, five weapons):
 *
 *     column   spread (max-min over the mean, worst weapon)
 *     anchor   **0.0%** — identical on every seed, on every weapon
 *     sculpt   **23.8%** (`burrito.Swarm` 173/179/140; `egg.Shards` 415/502/439;
 *              `pizza.Tomato` 388/393/471; `pizza.Cheese` 303/303/303)
 *
 * The anchor is seed-invariant because the recipe this guard now guards has no random
 * area-bearing element left — no shards, no streaks, and a star decal whose only
 * randomness is a rotation. **All of arm E's noise lives in the denominator**, and it
 * reaches a quarter of the value. A bar at exactly 1.00 would be reading a difference
 * the instrument cannot resolve, which is this repo's most-repeated mistake.
 *
 * 🚨 **BUT A ROW BETWEEN 1.00 AND 1.15 IS NOT A PASS, IT IS A STANDING ITEM.** Every
 * such row is printed BY NAME as `NEAR` on every run. Today there is exactly one:
 * `pizza.Cheese` at pitch 20, 312 px against 303 px — and that row's sculpt is
 * **seed-INVARIANT** (303 on all four seeds), so for it the 1.03 is real and not
 * noise. Its cause is out of this file: `pizza.Cheese`'s own hook delivers 584 px at
 * pitch 58 and 303 px at pitch 20, losing 48% at the lobby camera, which is the class
 * CLAUDE.md #3 says that camera exists to expose.
 */
const DOMINANCE_MAX = Number(args.dominanceMax ?? 1.15);
/**
 * The rescue ratchet. Measured 2 at pitch 58 (`burrito.Swarm` 128 px, `soup.Splash`
 * 277 px) and 1 at pitch 20 (`burrito.Swarm` 173 px) on BOTH the pre-fix `a494f98`
 * tree and the fixed one — the set is a property of the eleven weapon files, not of
 * the anchor, so it does not move when the anchor does.
 */
const RESCUE_MAX = Number(args.rescueMax ?? 2);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'wi-still';
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
    // Seeded LCG: these bursts randomise shard directions, so unchanged code measured
    // twice disagrees by ~15% (`wv_area.mjs`'s header). Every arm of a row is fired on
    // the same seed, which makes anchor/generic a PAIRED ratio (CLAUDE.md #10).
    let st = 1;
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = {
      seed(v) { st = ((v >>> 0) || 1); },
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
    // A frozen clock does not still the camera shake, it makes it PERMANENT
    // (`docs/AGENT-BRIEF.md` §3). Zeroed before every grab, not once at setup.
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
    window.__wi = {
      total: RWv * RHv,
      setBase() { base = grab(); },
      count() {
        const cur = grab(); let n = 0;
        for (let i = 0; i < cur.length; i += 4) {
          const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
          if (d >= D) n++;
        }
        return n;
      },
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
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
 * ── THE KNOWN-BAD, INSTALLED IN-PAGE ────────────────────────────────────────────
 *
 * Both defects, exactly as they were written, on the FIXED tree — so `--knownbad` is a
 * demonstration that these assertions can fail, not a second implementation of them.
 *
 *   1. `impactAnchor` returns before drawing anything when it is subordinate. That is
 *      the pre-fix control flow verbatim: the bespoke branch ran and returned, and no
 *      anchor was ever reached. Arms B and C go red.
 *   2. `spawnImpactBurst` has `fromXWU`/`fromYWU` deleted off its `source` argument
 *      before the real method sees them. That is the pre-fix `__vfxSpawnTest` verbatim:
 *      `ctx.direction` comes out (0,0,0). Arm D goes red.
 */
async function installKnownBad(page, kind) {
  return page.evaluate((k) => {
    const proto = Object.getPrototypeOf(window.__vfxLayer);
    if (typeof proto.impactAnchor !== 'function') {
      return { ok: false, why: 'impactAnchor is not on the prototype — nothing to regress' };
    }
    const realAnchor = proto.impactAnchor;

    /**
     * The generic recipe, written out once, so a known-bad can name a `k` instead of a
     * multiplier. `sizeFactor` and the shard count are `vfx.ts:impactAnchor`'s own two
     * expressions with `k` substituted; the decal clamp is `burst()`'s own 0.55.
     *
     * ⚠️ **THIS REPLACED A `burst()` WRAPPER THAT SCALED THE LIVE ANCHOR'S ARGUMENTS
     * BY 1.5**, whose comment read *"`IMPACT_ANCHOR_K = 0.75` reproduced from outside:
     * scale the two arguments the anchor scales by 0.75/0.50 = 1.5"*. Kept above the
     * correction per house style, because it stopped being true the moment the
     * subordinate anchor stopped being a scaled `burst()`: after `an_*`, the anchor
     * passes `shardCount = 0` and its own `skipFlash`/`skipStreaks`/`decalMinRadius`,
     * so `× 1.5` reproduced neither 0.75 nor anything else — `Math.max(2, round(0 *
     * 1.5))` would have ADDED two gold shards the shipped recipe does not draw, and
     * `sf * 1.5` would have meant `k = 0.525`. A known-bad expressed as a DELTA on the
     * thing under test silently follows it; one expressed as an absolute recipe does
     * not.
     */
    const genericAt = (self, o, c, amount, kk) => {
      const sf = Math.min(2.0, Math.max(0.42, 0.42 + amount * 0.075)) * kk;
      const shards = Math.max(2, Math.round(Math.min(8, Math.max(2, 1 + amount * 0.4)) * kk));
      return self.burst(o, c, sf, shards);
    };

    if (k === 'loud') {
      // `castMuzzle`'s 0.75 copied across, which is the exact mistake `impactAnchor`'s
      // header exists to prevent. `wi_derive` measured k = 0.75 at 0.602-0.701 of the
      // generic burst at pitch 58 and 0.621-0.753 at pitch 20 — over C's 0.60 bar on
      // every row, and comfortably inside A and B.
      proto.impactAnchor = function (origin, color, amount, role) {
        if (role !== 'subordinate') return realAnchor.call(this, origin, color, amount, role);
        return genericAt(this, origin, color, amount, 0.75);
      };
      return { ok: true, kind: k };
    }

    if (k === 'share') {
      // 🚨 THE DEFECT THAT SHIPPED, not a caricature of it: `a42224c`'s `impactAnchor`
      // verbatim — the whole generic `burst()` at k = 0.50, decal on the generic
      // recipe's own 0.55 lower clamp. `an_probe --cands cur`'s SELF-PAIR fired this
      // same expression against the real shipped anchor on the `a494f98` tree and got
      // the identical pixel count on every row, so this is a reproduction rather than
      // a second implementation.
      //
      // E must go RED and **A, B and C must all stay GREEN** — C ran green on this
      // exact state, at both pitches, for the whole life of the anchor.
      proto.impactAnchor = function (origin, color, amount, role) {
        if (role !== 'subordinate') return realAnchor.call(this, origin, color, amount, role);
        return genericAt(this, origin, color, amount, 0.50);
      };
      return { ok: true, kind: k };
    }

    proto.impactAnchor = function (origin, color, amount, role) {
      if (role === 'subordinate') return;          // ← the pre-fix early return
      return realAnchor.call(this, origin, color, amount, role);
    };
    const realImpact = proto.spawnImpactBurst;
    proto.spawnImpactBurst = function (x, y, color, amount, source) {
      const stripped = source ? { weapon: source.weapon, characterId: source.characterId } : source;
      return realImpact.call(this, x, y, color, amount, stripped);
    };
    return { ok: true, kind: k };
  }, kind);
}

/**
 * ONE ROW: FOUR arms of the same weapon on the same seed.
 *
 *   shipped  registry untouched                       -> the composite that ships
 *   anchor   `impact()` replaced by a hook that draws NOTHING, but IS CALLED
 *            -> whatever is left underneath it
 *   sculpt   `impactAnchor` returns for role 'subordinate' -> the hand-authored hook
 *            ALONE. Literally `a42224c`'s pre-fix control flow, re-installed in-page.
 *            **This arm is new and it is the one arm E needs**: without it there is no
 *            way to ask whether the shared anchor is bigger than the weapon's own
 *            effect, only whether it is bigger than a burst that is not on screen.
 *   generic  `impact()` deleted off the registry object -> the shipped fallback,
 *            provoked rather than re-implemented (`wv_area.mjs`'s ablation)
 *
 * The hook set AND the prototype are read back after every arm and returned, so each
 * row carries its own proof that the ablation did not leak.
 */
async function fireRow(page, { id, key, arm, at, seed, slices }) {
  return page.evaluate(async ([w, sl]) => {
    const rules = await import('/src/game/rules.ts');
    const reg = await import('/src/vfx/weapons/index.ts');
    const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };
    const v = reg.getWeaponVfx(w.id, w.key);
    const before = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];

    const real = v && typeof v.impact === 'function' ? v.impact : null;
    let noopCalls = 0;
    if (w.arm === 'generic' && real) delete v.impact;
    if (w.arm === 'anchor' && real) v.impact = () => { noopCalls++; };

    // The sculpt arm suppresses the ANCHOR instead of the hook. `realAnchor` is
    // captured HERE, not at setup, so under `--knownbad` this arm suppresses whatever
    // that mode installed rather than silently reverting it.
    const proto = Object.getPrototypeOf(window.__vfxLayer);
    const realAnchor = proto.impactAnchor;
    let suppressed = 0;
    if (w.arm === 'sculpt') {
      if (typeof realAnchor !== 'function') {
        return { err: 'impactAnchor is not on the prototype — the sculpt arm cannot suppress it, and a silent no-suppression would report the COMPOSITE as the sculpt' };
      }
      proto.impactAnchor = function (o, c, a, role) {
        if (role === 'subordinate') { suppressed++; return; }
        return realAnchor.call(this, o, c, a, role);
      };
    }

    window.__wi.reset();
    window.__wi.step(0);
    window.__wi.setBase();
    window.__rng.seed(w.seed);
    // The shipped call `match.ts:handleEvents` makes for a weapon hit, attacker
    // position included — NOT `__vfxSpawnTest`, which substitutes a synthetic weapon
    // when `weaponKey` is dropped and so would differ in four ways at once.
    window.__vfxLayer.spawnImpactBurst(w.x, w.y, weapon.color, weapon.damage,
      { weapon, characterId: w.id, fromXWU: w.x - 60, fromYWU: w.y });

    const series = [];
    let prev = 0;
    for (const t of sl) { window.__wi.step(t - prev); prev = t; series.push(window.__wi.count()); }
    window.__wi.reset();

    if (real) v.impact = real;
    proto.impactAnchor = realAnchor;
    const after = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];
    return {
      series, noopCalls, suppressed, damage: weapon.damage,
      restored: before.join(',') === after.join(',') && (!real || v.impact === real)
        && proto.impactAnchor === realAnchor,
    };
  }, [{ id, key, arm, x: at.x, y: at.y, seed }, slices]);
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
      const saved = await page.evaluate(([p, w]) => window.__wi.setPitch(p, w), [PITCH, DETECT_WIDTH]);
      log(`camera: re-pitched ${saved.pitch} -> ${PITCH} deg, frameMode ${saved.mode} -> ground, width ${saved.width} -> ${DETECT_WIDTH} wu`);
    }
    if (KNOWNBAD) {
      const kb = await installKnownBad(page, KB_KIND);
      const KB_WHAT = {
        loud: "the subordinate anchor re-drawn as the FULL generic burst at castMuzzle's 0.75",
        share: "a42224c's anchor verbatim — the full generic burst at k=0.50 on the generic 0.55 decal clamp",
      }[KB_KIND] ?? 'the pre-fix early return + the pre-fix QA hook';
      const KB_WANT = { loud: 'C only (A and B must stay GREEN, or C is just a restatement of B)',
        share: 'E only (A, B AND C must stay GREEN — C ran green on this exact state for the whole life of the anchor, which is why E exists)' }[KB_KIND] ?? 'A, B and D';
      log(`\n🧪 KNOWN-BAD MODE '${KB_KIND}': ${KB_WHAT} re-installed in-page (${kb.ok ? 'ok' : kb.why}).`);
      log(`   This run MUST go red. A green run here means the assertions below cannot see the bug.`);
      log(`   expected red: ${KB_WANT}`);
      if (!kb.ok) bad(`known-bad could not be installed: ${kb.why}`);
    }
    log(`\nviewport ${W}x${H}  readback ${RW}x${RH}  delta>=${DELTA}  pitch ${PITCH}  seed ${SEED}  slices ${SLICES.join(',')}`);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);

    const at = await page.evaluate(() => {
      const p = window.__vfxDebugFighters.player;
      return { x: p.x, y: p.y };
    });

    // ── The set under test, read off the registry ────────────────────────────────
    const roster = await page.evaluate(async () => {
      const rules = await import('/src/game/rules.ts');
      const reg = await import('/src/vfx/weapons/index.ts');
      const rows = [];
      for (const [id, c] of Object.entries(rules.CHARACTERS)) {
        for (const w of c.weapons) {
          const v = reg.getWeaponVfx(id, w.key);
          rows.push({
            id, key: w.key, damage: w.damage,
            hasImpact: !!(v && typeof v.impact === 'function'),
          });
        }
      }
      return rows;
    });
    const bespoke = roster.filter((w) => w.hasImpact && (!ONLY || ONLY.includes(`${w.id}.${w.key}`) || ONLY.includes(w.id)));
    log(`\nroster: ${roster.length} weapons, ${roster.filter((w) => w.hasImpact).length} carrying a bespoke impact() hook`);

    // ══ NON-VACUITY, FIRST ═════════════════════════════════════════════════════
    // `[].every()` returns true. Every set asserted over below is checked non-empty
    // BEFORE it is filtered or asserted over (CLAUDE.md #6).
    if (!roster.length) bad('roster is EMPTY — every assertion below would be vacuously green');
    if (!bespoke.length) bad('NO weapon carries a bespoke impact() hook — arms A/B/C would be vacuously green');

    // ══ CONTROLS ═══════════════════════════════════════════════════════════════
    log(`\n══ CONTROLS ═══════════════════════════════════════════════════════════`);
    const nulls = await page.evaluate(() => {
      window.__wi.setBase();
      return [window.__wi.count(), window.__wi.count(), window.__wi.count()];
    });
    log(`NULL      frozen frame vs itself x3: ${nulls.join(', ')} px  (want 0,0,0)`);
    if (nulls.some((n) => n !== 0)) bad(`NULL control non-zero (${nulls.join(',')}) — every area below is a difference of two different frames`);

    const rngOk = await page.evaluate(() => window.__rng.selftest());
    log(`RNG       seeded LCG reproducible and non-constant: ${rngOk}`);
    if (!rngOk) bad('RNG control failed — the anchor/generic ratios below are unpaired');

    const forced = await page.evaluate(async ([f]) => {
      window.__wi.reset(); window.__wi.step(0); window.__wi.setBase();
      window.__vfxSpawnTest('impact', f.x, f.y, 30, '#FF00FF');
      window.__wi.step(160);
      const n = window.__wi.count();
      window.__wi.reset();
      return n;
    }, [at]);
    log(`FORCED    garish 30-damage generic impact: ${forced} px  (want >> 0)`);
    if (forced < 400) bad(`FORCED control ${forced} px — this instrument cannot see a deliberately enormous effect`);

    // ══ D. THE QA HOOK'S ctx.direction ═════════════════════════════════════════
    // One fire, no pixels: plant a recorder as the bespoke hook and read the vector.
    const dirProbe = bespoke[0];
    let dir = null;
    if (!dirProbe) bad('D: no weapon with a bespoke impact() — the direction probe would be vacuous');
    else {
      dir = await page.evaluate(async ([w, f]) => {
        const reg = await import('/src/vfx/weapons/index.ts');
        const v = reg.getWeaponVfx(w.id, w.key);
        const real = v.impact;
        let calls = 0; let vec = null;
        v.impact = (ctx) => { calls++; vec = { x: ctx.direction.x, y: ctx.direction.y, z: ctx.direction.z }; };
        window.__vfxSpawnTest('impact', f.x, f.y, w.damage, '#FFC93C', w.id, w.key);
        v.impact = real;
        return { calls, vec, restored: v.impact === real };
      }, [dirProbe, at]);
      const len = dir.vec ? Math.hypot(dir.vec.x, dir.vec.y, dir.vec.z) : 0;
      log(`\n══ D. __vfxSpawnTest('impact') -> ctx.direction ════════════════════════`);
      log(`D         ${dirProbe.id}.${dirProbe.key}: hook called ${dir.calls}x, direction (${dir.vec ? [dir.vec.x, dir.vec.y, dir.vec.z].map((n) => n.toFixed(3)).join(', ') : 'never received'})  |d| = ${len.toFixed(3)}`);
      // REACH first: a zero |d| means nothing if the hook was never entered.
      if (!dir.calls) bad('D REACH: the planted recorder was never called — |d| below describes nothing');
      else if (len < 0.99) bad(`D: __vfxSpawnTest('impact') hands the bespoke hook |direction| = ${len.toFixed(3)} — the shipped game always supplies a unit vector (match.ts populates fromXWU/fromYWU unconditionally for a weapon hit), so every measurement through this hook is of a frame the game does not draw`);
      if (dir && !dir.restored) bad('D: the recorder did not restore the real hook');
    }

    // ══ A / B / C / E ══════════════════════════════════════════════════════════
    log(`\n══ A/B/C/E. per weapon: composite, anchor-only, sculpt-only, generic ══`);
    log(`${pad('weapon', 22)}${rpad('dmg', 4)}${rpad('shipped', 9)}${rpad('anchor', 8)}${rpad('sculpt', 8)}${rpad('generic', 9)}${rpad('a/g', 7)}${rpad('a/sc', 7)}  verdict`);
    const rows = [];
    for (const w of bespoke) {
      const shipped = await fireRow(page, { ...w, arm: 'shipped', at, seed: SEED, slices: SLICES });
      const anchor = await fireRow(page, { ...w, arm: 'anchor', at, seed: SEED, slices: SLICES });
      const sculpt = await fireRow(page, { ...w, arm: 'sculpt', at, seed: SEED, slices: SLICES });
      const generic = await fireRow(page, { ...w, arm: 'generic', at, seed: SEED, slices: SLICES });
      const anyErr = shipped.err ?? anchor.err ?? sculpt.err ?? generic.err;
      if (anyErr) { bad(`${w.id}.${w.key}: ${anyErr}`); continue; }
      if (!shipped.restored || !anchor.restored || !sculpt.restored || !generic.restored) bad(`${w.id}.${w.key}: RESTORE failed — a later row is measuring a leaked ablation`);
      // REACH, per arm and specific to what that arm ablates. A zero that was never
      // reached describes nothing, and both of these have a way of passing for the
      // wrong reason: arm B would measure the REAL sculpt, arm E would measure the
      // COMPOSITE and call it the sculpt.
      if (!anchor.noopCalls) bad(`${w.id}.${w.key}: REACH — the planted no-op hook was never called, so the anchor arm is not measuring the anchor`);
      if (!sculpt.suppressed) bad(`${w.id}.${w.key}: E REACH — impactAnchor was never entered with role 'subordinate', so NOTHING was suppressed and the sculpt column is the composite`);
      const s = Math.max(...shipped.series);
      const a = Math.max(...anchor.series);
      const sc = Math.max(...sculpt.series);
      const g = Math.max(...generic.series);
      const ratio = g ? a / g : 0;
      const dom = sc ? a / sc : Infinity;
      const notes = [];
      if (s < FLOOR_PX) { notes.push(`A: ${s} px < ${FLOOR_PX}`); bad(`A ${w.id}.${w.key}: composite ${s} px is under the ${FLOOR_PX} px floor (generic control ${g} px)`); }
      if (ratio < ANCHOR_MIN_RATIO) { notes.push(`B: a/g ${ratio.toFixed(3)} < ${ANCHOR_MIN_RATIO}`); bad(`B ${w.id}.${w.key}: with the hook drawing nothing the frame moved ${a} px against a ${g} px generic burst (${ratio.toFixed(3)}) — there is no anchor under this hook`); }
      if (ratio > ANCHOR_MAX_RATIO) { notes.push(`C: a/g ${ratio.toFixed(3)} > ${ANCHOR_MAX_RATIO}`); bad(`C ${w.id}.${w.key}: the anchor alone is ${ratio.toFixed(3)} of the generic burst — it has stopped being subordinate and the bespoke sculpt is a garnish on it`); }
      rows.push({
        id: w.id, key: w.key, damage: w.damage, shipped: s, anchor: a, sculpt: sc, generic: g,
        ratio: +ratio.toFixed(3), dominance: +dom.toFixed(3), share: +(s ? a / s : 0).toFixed(3), notes,
      });
      log(`${pad(`${w.id}.${w.key}`, 22)}${rpad(w.damage, 4)}${rpad(s, 9)}${rpad(a, 8)}${rpad(sc, 8)}${rpad(g, 9)}${rpad(ratio.toFixed(3), 7)}${rpad(dom.toFixed(2), 7)}  ${notes.length ? `🔴 ${notes.join('; ')}` : 'ok'}`);
    }

    // A last non-vacuity check on the MEASURED set, not the intended one: a run where
    // every row errored out would print no 🔴 above and would otherwise exit 0.
    if (!rows.length) bad('no row was measured — the table above is empty, so A/B/C/E asserted over nothing');
    else if (rows.length !== bespoke.length) bad(`${rows.length} rows measured of ${bespoke.length} intended — the missing ones were never asserted over`);

    // ══ E. DOMINANCE — the anchor against the SCULPT, not against the generic ══
    //
    // Split first, assert second, and check the set you are about to assert over is
    // NON-EMPTY before you assert over it: `[].every()` returns true, and the way this
    // arm goes vacuous is specific and reachable — if every sculpt fell under the
    // floor, `carries` would be empty and E would report a clean sweep while the
    // anchor was the whole hit on all 27 weapons.
    const rescue = rows.filter((r) => r.sculpt < FLOOR_PX);
    const carries = rows.filter((r) => r.sculpt >= FLOOR_PX);
    log(`\n══ E. DOMINANCE: anchor vs the weapon's OWN sculpt ════════════════════`);
    log(`${carries.length} weapon(s) whose sculpt clears the ${FLOOR_PX} px floor alone · ${rescue.length} RESCUE row(s) (sculpt under it, so the anchor MUST carry them)`);
    if (rows.length && !carries.length) {
      bad(`E: NOT ONE sculpt clears the ${FLOOR_PX} px floor on its own, so E's assertion set is EMPTY and would be vacuously green while the anchor is the entire hit on every weapon`);
    }
    for (const r of carries) {
      if (r.dominance > 1 && r.dominance <= DOMINANCE_MAX) {
        // Inside the floor, so not a failure — but named every run, because a row
        // sitting in the resolution gap is the row the next regression walks through.
        log(`  NEAR    ${pad(`${r.id}.${r.key}`, 20)} anchor ${rpad(r.anchor, 5)} px vs its own sculpt ${rpad(r.sculpt, 5)} px `
          + `(${r.dominance.toFixed(2)}x) — over 1.00, inside the ${DOMINANCE_MAX} resolution floor`);
      }
      if (r.dominance > DOMINANCE_MAX) {
        bad(`E ${r.id}.${r.key}: the anchor alone delivers ${r.anchor} px against this weapon's OWN sculpt at ${r.sculpt} px (${r.dominance.toFixed(2)}x) — the shared anchor is a bigger part of the hit than the hand-authored effect it sits under, and the composite share is ${(r.share * 100).toFixed(0)}%. Arm C reads ${r.ratio.toFixed(3)} on this row and cannot see it`);
      }
    }
    for (const r of rescue) {
      log(`  RESCUE  ${pad(`${r.id}.${r.key}`, 20)} sculpt ${rpad(r.sculpt, 5)} px alone (< ${FLOOR_PX}) · anchor ${rpad(r.anchor, 5)} px · composite ${rpad(r.shipped, 5)} px · share ${(r.share * 100).toFixed(0)}%`);
    }
    // REPORTED, NOT ASSERTED: anchor/composite is the number the defect was stated in,
    // so the guard prints it — but it is not the bar, because the anchor and the sculpt
    // are drawn on the same point and this ratio is inflated by their OVERLAP (two
    // effects of equal footprint both score ~0.8 of the union they share). The
    // assertion is `anchor <= sculpt` above, which compares two independently measured
    // arms and has no such artefact. Printing both is deliberate: a reader who quotes
    // the share is quoting the thing Uri's report is about, and a reader who wants the
    // rule gets the arm that encodes it.
    if (rows.length) {
      const shares = rows.map((r) => r.share).sort((a, b) => a - b);
      const maj = shares.filter((x) => x > 0.5).length;
      log(`anchor / COMPOSITE (reported, not asserted): ${shares[0].toFixed(3)}-${shares[shares.length - 1].toFixed(3)}`
        + ` median ${shares[Math.floor(shares.length / 2)].toFixed(3)} · majority on ${maj}/${rows.length}`);
    }
    if (rescue.length > RESCUE_MAX) {
      bad(`E RESCUE: ${rescue.length} weapons take the exemption and the ratchet is ${RESCUE_MAX}. The exemption is the only way past E, so it does not get to grow: either a sculpt regressed, or a weapon was added whose impact() cannot carry its own hit`);
    }

    await writeFile(`${OUT}/wi_guard.p${PITCH}${KNOWNBAD ? '.knownbad' : ''}.json`, JSON.stringify({
      pitch: PITCH, seed: SEED, slices: SLICES, delta: DELTA, knownbad: KNOWNBAD,
      floorPx: FLOOR_PX, anchorMinRatio: ANCHOR_MIN_RATIO, anchorMaxRatio: ANCHOR_MAX_RATIO,
      dominanceMax: DOMINANCE_MAX, rescueMax: RESCUE_MAX,
      rescue: rescue.map((r) => `${r.id}.${r.key}`), carries: carries.length,
      direction: dir, rows, failures: failMsg,
    }, null, 1));

    log(`\n${'─'.repeat(72)}`);
    if (KNOWNBAD) {
      // The known-bad run INVERTS the exit code: green here is the failure. And it is
      // not enough that SOMETHING went red — the arm the mode targets has to be the one
      // that went red, or a bug in an unrelated arm would certify this file forever.
      // `[ :]` and not `' '` — the D messages are written both ways ("D REACH:" and
      // "D: __vfxSpawnTest..."), and a classifier that missed one would have reported
      // the direction arm as unproven while it was going red on every run.
      const armCount = (a) => failMsg.filter((m) => new RegExp(`^${a}[ :]`).test(m)).length;
      const want = { loud: ['C'], share: ['E'] }[KB_KIND] ?? ['A', 'B', 'D'];
      // 🚨 `share` puts C in `quiet` ON PURPOSE and that is the point of the mode.
      // The state it re-installs is the one that SHIPPED, and arm C was green on it at
      // both pitches on every one of the 27 rows. If C cannot stay green here, E is
      // just C under another letter and neither of them is telling you anything new.
      const quiet = { loud: ['A', 'B'], share: ['A', 'B', 'C'] }[KB_KIND] ?? [];
      log(`arms red: A ${armCount('A')} · B ${armCount('B')} · C ${armCount('C')} · D ${armCount('D')} · E ${armCount('E')}`);
      const missing = want.filter((a) => armCount(a) === 0);
      const noisy = quiet.filter((a) => armCount(a) > 0);
      if (!fail) {
        log(`🔴 KNOWN-BAD PASSED. The defect was re-installed and every assertion stayed green,`);
        log(`   so this file is a comment with a tick next to it (CLAUDE.md #6).`);
        process.exitCode = 1;
      } else if (missing.length) {
        log(`🔴 KNOWN-BAD went red, but NOT on ${missing.join('/')} — the arm this mode targets did not fire,`);
        log(`   so it is still unproven and something else is carrying the red.`);
        process.exitCode = 1;
      } else if (noisy.length) {
        log(`🔴 KNOWN-BAD made ${noisy.join('/')} red too. This mode is supposed to leave them green;`);
        log(`   if they cannot stay green the targeted arm is not measuring anything of its own.`);
        process.exitCode = 1;
      } else {
        log(`✅ KNOWN-BAD '${KB_KIND}' went RED on ${want.join('/')} (${fail} assertion(s)) and left ${quiet.join('/') || 'nothing else'} green`);
        log(`   — these guards can see the bug they exist for.`);
        process.exitCode = 0;
      }
    } else {
      log(`${fail ? `🔴 wi_guard: ${fail} FAILURE(S)` : `✅ wi_guard: ${rows.length} bespoke impacts, all >= ${FLOOR_PX} px, anchor ${ANCHOR_MIN_RATIO}-${ANCHOR_MAX_RATIO} of generic, anchor <= sculpt on ${carries.length} of ${rows.length} (${rescue.length} rescue)`}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      process.exitCode = fail ? 1 : 0;
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
