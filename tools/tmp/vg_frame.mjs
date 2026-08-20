#!/usr/bin/env node
/**
 * VG_FRAME — A REAL SIX-FIGHTER MATCH FRAME, WITH THE EFFECTS ACTIVE, AT BOTH CAMERAS.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────────
 *
 * Uri, on an iPhone 15 Pro against the deployed build:
 *   *"It feels like there is a slight regression is VFX quality. home screen, and more
 *    specifically character screen seems like the resolution is slightly lower."*
 *
 * Eleven probes answered the second half — there is no resolution regression, the
 * `pixelRatioCap` triple is byte-identical across all five deployed bundles. **Not one
 * of them rendered a MATCH frame**, and "VFX" was the first word of the sentence. Under
 * a two-complaint reading this surface was 100% unexamined.
 *
 * What landed in the deploy window `8ca8f88 -> a494f98` that a match frame can see:
 *
 *   a42224c  `IMPACT_ANCHOR_K = 0.5` — an UNCONDITIONAL generic burst under EVERY
 *            bespoke `impact()` hook. By construction a NEW ELEMENT IN EVERY HIT.
 *   3483d23  a melee swing hits EVERY opponent in its arc — so one `lollipop.Giant`
 *            press now fires up to FIVE impacts, i.e. five anchors at once.
 *   5708407  soup VFX derived from `Weapon.color`; 9c23d56 moved that colour to #CC9F0D.
 *
 * `a42224c`'s own author wrote down the risk: *"`burrito.Swarm`'s anchor is a dark green
 * disc on a purple floor — 625 px that still reads quietly."* Nobody rendered it.
 *
 * ── WHAT THIS MEASURES, AND WHY IT IS NOT `wv_area.mjs` ────────────────────────
 *
 * `wv_area.mjs` (209e270/dce15bb) measures DELIVERED AREA per weapon per beat, one
 * effect at a time, on a 1v1 frame, and it is the right instrument for "did the bespoke
 * sculpt shrink". Its own report file states the limit in as many words:
 *
 *   🔴 *"Delivered area is a SCREEN, not a judgement. `p2_bgcross.mjs` measured
 *      legibility against the surfaces a weapon actually crosses and found area's rank
 *      correlation with it is 0.230 — the strongest predictor was the weapon's OWN
 *      LIGHTNESS at -0.738."*
 *
 * So AREA IS THE WRONG METRIC for "does this read well" and this file does not use it as
 * a verdict. It uses three that are about reading, all of them written down in
 * `src/game/vfx.ts` as rules before this session existed:
 *
 *   1. CAST REPAINT — hue-contract **rule 2**: *"An effect may not repaint more than
 *      ~1/3 of the cast's own pixels unless it is a death or an ultimate. Ordinary hits
 *      measure 0.5-29.4%; death 47.6% is earned."* An anchor added under every bespoke
 *      impact adds pixels on top of the victim, and 29.4% is already 88% of the way to
 *      the bar. **`a42224c`'s guard (`wi_guard.mjs`, arms FLOOR/ANCHOR/SUBORDINATE/
 *      DIRECTION) has no repaint arm, and neither does `wv_area`.** Nobody checked.
 *      The matte is the INTERSECTION one — `vfx_wcov.mjs`'s, not `vfx_hue.mjs`'s, whose
 *      own header says the hide-diff matte over-reads a floor wash by 73.2% vs 9.7%.
 *
 *   2. SUBSTRATE CONTRAST — hue-contract **rule 1**: an effect must clear what it sits
 *      on in LIGHTNESS. Measured here as the mean luma of the painted pixels AFTER minus
 *      the mean luma of THOSE SAME PIXELS in the baseline, i.e. the effect against the
 *      exact surface it landed on. This is `p2_bgcross`'s -0.738 predictor, computed on a
 *      real match frame instead of on a chosen station.
 *
 *   3. STRUCTURE DENSITY — mean |luma gradient| inside the painted region. A soft wash
 *      and a legible sculpt can deliver the SAME AREA; they cannot deliver the same
 *      internal edge energy. "Muddier" is a fall in structure at constant-or-larger area,
 *      which is exactly the shape an unconditional soft anchor under a sculpt would have.
 *
 * ── HOW THE TWO ARMS ARE MADE COMPARABLE (and what is NOT claimed) ────────────
 *
 * 🔴 `src/game/match.ts` IS BYTE-IDENTICAL ACROSS THE WINDOW (`git diff --stat
 * 8ca8f88 a494f98 -- src/game/match.ts` is empty). That is what makes `window.__feelEvent`
 * the right driver: it runs a synthetic `hit-landed` through the REAL `handleEvents`,
 * which resolves the attacker through `roster.ts:weaponAttackerOf` and passes
 * `fromXWU`/`fromYWU` UNCONDITIONALLY — **on both trees**. So the only thing that differs
 * between the arms on the way to `spawnImpactBurst` is `vfx.ts` itself.
 *
 * ⚠️ `window.__vfxSpawnTest` would NOT have been comparable: `a42224c` changed that hook
 * (it used to hand the bespoke sculpt `direction === (0,0,0)`, a state the shipped game
 * never produces), so an A/B through it conflates the QA-hook fix with the anchor and is
 * unfaithful on the BEFORE side. `--driver spawntest` exists to demonstrate exactly that
 * and is not the default.
 *
 * ⚠️ **THE SIM IS HELD STILL AND ONLY THE VFX LAYER IS CRANKED** (`__clk.advance` +
 * `vfxLayer.updateEffects`, `wv_area`'s arrangement, not `feel_probe`'s whole-loop crank).
 * That is deliberate and it has a cost, stated rather than hidden: the character's HIT
 * FLASH lives on `BaseCharacter.hitT` and is advanced by the game loop, so with the loop
 * frozen it pins. It pins IDENTICALLY ON BOTH ARMS and it is captured in the BASELINE of
 * both, so it cancels out of every paired number here — but it means no number in this
 * file is a claim about the flash. The reason to hold the sim is `3483d23` and `b2be2f7`:
 * those change SIM BEHAVIOUR inside the window, so a cranked loop would diverge the two
 * arms' world state and every pixel difference would be uninterpretable.
 *
 * 🚨 **SWIFTSHADER IS NOT A PHONE.** Buffer integers, CSS boxes, matte fractions and
 * paired pixel deltas are engine-independent. **No frame-time and no perceived-sharpness
 * number is obtainable here and none is printed.** `--profile phone` emulates 393x852 CSS
 * at deviceScaleFactor 3 (iPhone 15 Pro) so the app's own `pixelRatioCap` choice and the
 * resulting drawing buffer are exercised, and those integers ARE quotable.
 *
 * ── CONTROLS — an instrument not shown to FAIL on a known input is not an instrument ──
 *
 *   DRIFT      the same frozen frame grabbed twice must differ by **EXACTLY 0** px.
 *              🚨 Prior art `a1a85e5`: a frozen frame was NOT a frozen camera — at dt=0
 *              `CameraRig.update` re-randomised the shake on every `render()` and 344 of
 *              344 frozen frames drifted, up to 349 px. Its known-bad is `--knownbad
 *              shake`, which removes the explicit zeroing and must make DRIFT go RED.
 *   MOVER      a real impact must move the frame. Without it DRIFT's zero is satisfied by
 *              a probe that renders nothing at all, and every "no difference" below would
 *              be vacuous. **This is the non-emptiness assertion DRIFT needs.**
 *   MATTE+     hiding a fighter must repaint ~100% of that fighter's own matte.
 *   MATTE-     hiding a DIFFERENT fighter must repaint ~0% of it. Without this, a matte
 *              that silently covered the whole frame would score every effect at 100%.
 *   EVENTS     `__feelDebug.events['hit-landed:weapon']` must rise by exactly the number
 *              of events fired. A scene whose events never reached the handler produces a
 *              perfect, meaningless null on both arms — the most dangerous result here.
 *   NONEMPTY   every filtered set (matte, painted set, per-slice series) is asserted
 *              non-empty BEFORE anything is asserted over it. `[].every()` is `true`.
 *
 * ── USE ────────────────────────────────────────────────────────────────────────
 *
 *   git worktree add --detach /tmp/fa-vg-before 8ca8f88
 *   ln -s "$PWD/node_modules" /tmp/fa-vg-before/node_modules
 *   ln -s "$PWD/reference"    /tmp/fa-vg-before/reference
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-vg-before -- \
 *     node tools/tmp/vg_frame.mjs --url '{URL}' --label before --profile desktop --pitch 58
 *
 *   node tools/tmp/vg_frame.mjs --url $U --drift            # the drift control alone
 *   node tools/tmp/vg_frame.mjs --url $U --knownbad shake   # must go RED
 *
 * Output: `shots/vg/<label>.<profile>.p<pitch>.json` + judgement PNGs beside it.
 * `vg_ab.mjs` joins two of those JSONs; it renders nothing and invents no number.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

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
const LABEL = String(args.label ?? 'run');
const OUT = String(args.out ?? 'shots/vg');
const PROFILE = String(args.profile ?? 'desktop');
const PITCH = Number(args.pitch ?? 58);
/** Ground width for the pitch-20 DETECTOR. `wv_area` uses 150 wu for a single effect;
 *  a match frame has to hold a fighter AND the impact around it, so this is wider.
 *  🔴 pitch-20 areas are NOT shipped scale and are never quoted as such — only the
 *  paired before/after ratio at the SAME pitch is. */
const DETECT_WIDTH = Number(args.detectWidth ?? 300);
const DELTA = Number(args.delta ?? 6);
const DRIFT_ONLY = !!args.drift;
/** Throwaway grabs after any scene change. Its value is CHECKED against `settleProbe`
 *  every run rather than trusted — a warm-up count that is too small produces a plausible
 *  noise floor instead of an error. */
const WARM = Number(args.warm ?? 4);
/** Seed sweep. One seed gives an EXACT, reproducible arm; several give the within-arm
 *  spread that is the only defensible floor for a between-arm difference. */
const SEEDS = (args.seeds ? String(args.seeds).split(',').map(Number) : [1, 2, 3, 4]);
/** Judgement-PNG times. FIXED, not each arm's own peak — see the block that uses them. */
const SHOT_MS = (args.shotMs ? String(args.shotMs).split(',').map(Number) : [150, 320]);
const KNOWNBAD = args.knownbad ? String(args.knownbad) : null;
const DRIVER = String(args.driver ?? 'feelevent');
const SHOTS = !args['no-shots'];
const ONLY = args.only ? String(args.only).split(',') : null;

/** iPhone 15 Pro is 393x852 CSS at dPR 3. Desktop is the framing every other tool here
 *  measures at, so its numbers join theirs. */
const PROFILES = {
  phone: { w: 393, h: 852, dsf: 3, rw: 393, rh: 852 },
  desktop: { w: 1280, h: 720, dsf: 1, rw: 640, rh: 360 },
};
const P = PROFILES[PROFILE];
if (!P) { console.error(`unknown --profile ${PROFILE} (phone|desktop)`); process.exit(2); }

/**
 * THE ROSTER, chosen so every weapon a scene fires is OWNED by a seated fighter.
 * `handleEvents` resolves the attacker through `weaponAttackerOf(state, source, role)`
 * and then `CHARACTERS[attacker.characterId].weapons.find(key)` — a weapon key its
 * attacker does not own resolves to `undefined`, `impactSource` stays undefined, and the
 * hit silently takes the GENERIC path. That would look exactly like "the bespoke sculpt
 * delivers nothing" and would be entirely the probe's fault, so `--selfcheck`'s OWNERSHIP
 * row asserts every (attackerId, weaponKey) pair in every scene resolves to a real weapon
 * BEFORE any of them is fired.
 */
const ROSTER = ['lollipop', 'burrito', 'soup', 'pizza', 'egg', 'sushi'];
const SLOT = Object.fromEntries(ROSTER.map((id, i) => [id, i]));

/**
 * 🚨 THE AUTHORED SPAWNS PUT FIVE OF THE SIX FIGHTERS OFF SCREEN, AND THAT IS NOT A BUG.
 *
 * The first run of this file used `?fighters=<id>;<id>;…` with NO coordinates, which is
 * the shipping path (`sim.ts:defaultSpawn` -> `kitchen.ts`'s six authored spawns) and is
 * what `sx_sixplay.mjs` deliberately does. Measured: slots landed 133-2667 wu apart on a
 * 2800x2000 arena, the match rig frames ~360 wu, and **five of the six cast mattes came
 * back EMPTY**. The MATTE control caught it on the first run rather than the numbers
 * coming back quietly wrong — which is the whole reason it is there.
 *
 * So the frame this file measures is the ENDGAME, seated explicitly through the SAME QA
 * transport (`?fighters=<id>@<x>,<y>`, `match.ts:fightersFromQuery` — byte-identical
 * across this deploy window). That is not a convenience: **it is the only state in which
 * the thing under test can occur at all.** `3483d23` made a melee swing hit every
 * opponent in its arc and `lollipop.Giant` is `cone: 360` at `REACH.ultimateSlam`; five
 * victims inside one arc REQUIRES a cluster, and the shipped ring collapses to
 * `minSafeRadiusFor(6)` for exactly that reason. A five-anchor frame cannot be
 * photographed at spawn distance because it cannot HAPPEN at spawn distance.
 *
 * ⚠️ Coordinates are DERIVED from `arena/shared.ts` at runtime (`CENTER`, `ARENA_W/H`),
 * never retyped — CLAUDE.md's stale-literal rule, and the 1x playfield being exactly the
 * NW quadrant means a retyped fossil would stay a perfectly LEGAL point and no check
 * would see it. That costs one extra page load and it is worth it.
 */
const CLUSTER_R = Number(args.clusterRadius ?? 130);
const NO_CLUSTER = !!args['no-cluster'];

/** A `hit-landed` as the sim emits it. `targetRole` only has two values
 *  (`state.ts:FighterRole`), so slots 2..5 are addressed by `targetId` and
 *  `match.ts:slotOf(ev.targetId, ev.targetRole)` is what actually reads it. */
const hit = (targetSlot, attackerSlot, weaponKey, weaponName, amount, x, y, effect = 'none') => ({
  type: 'hit-landed',
  targetId: targetSlot,
  targetRole: targetSlot === 0 ? 'player' : 'enemy',
  amount,
  effect,
  source: { kind: 'weapon', weaponKey, weaponName, attackerId: attackerSlot },
  x, y,
});

/**
 * THE SCENES. Each is a set of events fired into ONE frozen frame, so the SUM is what is
 * measured — `docs/LESSONS.md` §7's "three passes each looked reasonable alone and
 * together repainted 85.3% of the player".
 *
 * `victims` names whose cast matte the repaint rule is judged against for that scene.
 */
const SCENES = {
  /** 🚨 THE COMPOUND CASE. `3483d23` made a melee swing hit EVERY opponent in its arc,
   *  and `lollipop.Giant` is `cone: 360`. One press, five impacts, five anchors. */
  giant5: {
    what: 'lollipop.Giant (18 dmg, cone 360, giantSlam) landing on ALL FIVE opponents at once',
    targets: [1, 2, 3, 4, 5],
    build: (f) => [1, 2, 3, 4, 5].map((s) => hit(s, SLOT.lollipop, 'Giant', 'Giant Lollipop', 18, f[s].x, f[s].y, 'stun')),
  },
  /** One impact per victim, five DIFFERENT bespoke hooks — the five rows `a42224c`'s own
   *  table lists as shortest. This is "every hit in the game now has a new element" at
   *  the density a real fight reaches. */
  bespoke5: {
    what: 'five different bespoke impacts at once: burrito.Swarm, soup.Splash, pizza.Tomato, egg.Shards, sushi.Rice',
    targets: [0, 3, 4, 5, 1],
    build: (f) => [
      hit(0, SLOT.burrito, 'Swarm', 'Topping Swarm', 4, f[0].x, f[0].y),
      hit(3, SLOT.soup, 'Splash', 'Soup Splash', 3, f[3].x, f[3].y),
      hit(4, SLOT.pizza, 'Tomato', 'Tomato Splat', 7, f[4].x, f[4].y),
      hit(5, SLOT.egg, 'Shards', 'Shell Shards', 4, f[5].x, f[5].y, 'slow'),
      hit(1, SLOT.sushi, 'Rice', 'Rice Spray', 2, f[1].x, f[1].y),
    ],
  },
  /** The row `a42224c`'s agent flagged in its own words and nobody rendered:
   *  *"a dark green disc on a purple floor — 625 px that still reads quietly."* */
  swarm1: {
    what: 'burrito.Swarm alone on the local seat — the anchor the author called "quiet"',
    targets: [0],
    build: (f) => [hit(0, SLOT.burrito, 'Swarm', 'Topping Swarm', 4, f[0].x, f[0].y)],
  },
  /** The colour move, isolated. `9c23d56` #E8792A -> #CC9F0D on Splash and Dump only. */
  soup2: {
    what: 'soup.Splash + soup.Dump — the two weapons whose Weapon.color moved to #CC9F0D',
    targets: [0, 1],
    build: (f) => [
      hit(0, SLOT.soup, 'Splash', 'Soup Splash', 3, f[0].x, f[0].y),
      hit(1, SLOT.soup, 'Dump', 'Soup Dump', 16, f[1].x, f[1].y, 'slow'),
    ],
  },
  /**
   * 🚨 THE CROSS-TREE NULL ARM — the one scene that MUST come back identical.
   *
   * A `hazard` hit carries NO weapon, so `match.ts` leaves `impactSource` undefined and
   * `spawnImpactBurst` takes `impactAnchor(..., 'primary')` with `k = 1`. That path is
   * **byte-identical across this window** and it can be shown rather than asserted, from
   * the executable diff:
   *
   *     -  const sizeFactor = clamp(0.42 + amount*0.075, 0.42, 2.0);
   *     +  const sizeFactor = clamp(0.42 + amount*0.075, 0.42, 2.0) * k;          // k=1
   *     -  this.burst(origin, color, sizeFactor, Math.round(clamp(1+amount*0.4, 2, 8)));
   *     +  const shards = Math.max(2, Math.round(clamp(1+amount*0.4, 2, 8) * k));  // k=1
   *
   * `clamp(..., 2, 8)` is already >= 2, so `Math.max(2, round(x))` is the identity and the
   * two expressions agree for every `amount`.
   *
   * Why it is worth a whole scene: without it, "every scene moved" is also what a
   * cross-tree A/B contaminated by something OTHER than the code change looks like — two
   * servers, two trees, two browser sessions. `AGENT-BRIEF` §3 records the mirror-image
   * failure (`rg_lib.loadCast` silently reading one tree for both arms, so both columns
   * come back identical and it reads as "the change did nothing"). This is the arm that
   * distinguishes "the anchor moved these frames" from "these two runs differ".
   * **It must land INSIDE FLOOR. If it does not, nothing else in this report is safe.**
   */
  nullarm: {
    what: 'a HAZARD hit — no weapon, so the generic path, which is byte-identical across the window. MUST be inside floor.',
    targets: [1],
    build: (f) => [{
      type: 'hit-landed', targetId: 1, targetRole: 'enemy', amount: 18, effect: 'none',
      source: { kind: 'hazard' }, x: f[1].x, y: f[1].y,
    }],
  },
  /** THE NEGATIVE CONTROL FOR THE SOUP QUESTION. `pizza.Tomato` and `egg.Shards` have
   *  nothing to do with soup; if THIS scene moves between the arms by more than the
   *  drift floor, "the soup colour moved only soup" is false. Without it, `soup2`
   *  moving proves nothing about attribution. */
  nosoup: {
    what: 'pizza.Tomato + egg.Shards — nothing soup touches. The attribution control.',
    targets: [4, 5],
    build: (f) => [
      hit(4, SLOT.pizza, 'Tomato', 'Tomato Splat', 7, f[4].x, f[4].y),
      hit(5, SLOT.egg, 'Shards', 'Shell Shards', 4, f[5].x, f[5].y, 'slow'),
    ],
  },
};

/** Front-loaded: every one-shot in `vfx.ts` lives 120-900 ms. Same schedule on both arms,
 *  so the comparison is paired slice-by-slice and does not depend on the two arms peaking
 *  in the same place. */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number)
  : [16, 60, 100, 150, 220, 320, 450, 650]);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);

async function boot(page) {
  page.setDefaultTimeout(180000);
  const errs = [];
  page.on('pageerror', (e) => { errs.push(String(e)); log('PAGEERROR:', String(e)); });
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });

  // A peer saving into the served tree triggers a Vite full reload that wipes in-page
  // state mid-probe. Stub the HMR client. (The tree here is a detached worktree, so this
  // is belt-and-braces rather than load-bearing — but a snapshot server is still a Vite.)
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));

  // Virtual clock. `THREE.Clock` reads `performance.now()`, so pausing it freezes the
  // whole loop's dt at 0 and `advance(ms)` hand-cranks it in exact slices. A real sleep
  // cannot do this: an impact burst is sub-900 ms and SwiftShader readback is ~100 ms, so
  // a probe that sleeps measures whatever survived the shutter.
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
     * 🚨 FREEZING THE CLOCK IS NOT FREEZING THE LOOP — and here that cost 788 px.
     *
     * `docs/AGENT-BRIEF.md` §3 says it in as many words and it still had to be
     * rediscovered by measurement. With the virtual clock paused, `match.ts:loop` keeps
     * being scheduled and keeps running at `dt = 0`; `THREE.Clock.getDelta()` returns 0
     * so nothing in the sim advances, but the loop still calls `stage.render(0)` and
     * still touches per-frame presentation state.
     *
     * The evidence that this — and not the camera shake — is the cause:
     *   · `driftProbe(6)`, six grabs inside ONE `page.evaluate` with no rAF turn in
     *     between, reported **0, 0, 0, 0, 0** px.
     *   · `setBase()` then `measure()`, the identical two grabs but as TWO evaluates
     *     with the loop free to run between them, reported **788 px**, bbox
     *     [66,89,262,359] of 640x360 — a LOCALISED region, not the whole-frame
     *     translation a shake produces (`a1a85e5`).
     * Two renders per grab did not close it, which is what ruled out a shadow-map
     * settle and pointed at the loop.
     *
     * So the rAF the game schedules is switched OFF for the measurement rather than the
     * difference being absorbed into a tolerance. `__vg.loopCost()` measures what one
     * loop turn at dt=0 is worth and prints it, so the thing being suppressed is a
     * reported number and not a silent one.
     */
    const rafReal = window.requestAnimationFrame.bind(window);
    let rafOn = true;
    window.requestAnimationFrame = (cb) => (rafOn ? rafReal(cb) : 0);
    window.__raf = {
      off() { rafOn = false; },
      on() { rafOn = true; },
      /** Let exactly one real rAF turn through, then shut it again. */
      once() {
        return new Promise((res) => {
          rafOn = true;
          rafReal(() => { rafReal(() => { rafOn = false; res(); }); });
        });
      },
    };
  });
  return errs;
}

/* eslint-disable */
async function installHarness(page, rw, rh, delta, stillShake) {
  await page.evaluate(([RW, RH, D, STILL]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = RW; cv.height = RH;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    let base = null;

    /**
     * 🚨 A FROZEN CLOCK DOES NOT STILL THE CAMERA SHAKE — IT MAKES IT PERMANENT.
     * `render/camera.ts:CameraRig.update()` multiplied the shake DECAY by `dtSeconds`
     * and not the RE-RANDOMISATION; `Stage.render()` calls `rig.update()` before it
     * draws. `a1a85e5` fixed the integrator, and this zeroing is kept anyway and applied
     * before EVERY grab rather than once at setup, because a probe that depends on a
     * fix landing upstream is a probe that goes wrong silently when it is reverted.
     * `STILL=false` is the known-bad (`--knownbad shake`) and DRIFT must go RED under it.
     */
    const still = () => {
      if (!STILL) return;
      const r = stage.rig; if (!r) return;
      r.shakeAmount = 0;
      if (r.shakeOffset && r.shakeOffset.set) r.shakeOffset.set(0, 0, 0);
    };
    /**
     * 🚨 EVERY GRAB RENDERS TWICE AND READS THE SECOND, AND THAT IS NOT SUPERSTITION —
     *    IT IS THE FIX FOR A MEASURED 832 px FIRST-RENDER SETTLE.
     *
     * Measured on `a494f98`, desktop, six clustered fighters: `setBase()` then one
     * `measure()` — two renders of an ADMITTEDLY FROZEN frame — reported **832 px**,
     * while `driftProbe(6)` on the very next renders reported **0, 0, 0, 0, 0**. So the
     * frame is bit-stable render-to-render and the difference lives entirely in the
     * FIRST render after the scene graph changes: `Stage.render()` calls
     * `updateContactShadows()` and `scheduleShadowUpdate()` before it draws, and
     * `VfxLayer.clear()` removes objects, so render N refreshes the shadow map and
     * render N+1 is the first frame that shows it.
     *
     * ⚠️ Reported as a NUMBER rather than absorbed silently, because "warm it up" is the
     * standard way this class of thing gets hidden: an 832 px settle papered over with a
     * tolerance would have become an 832 px noise floor, and every scene delta below is
     * of that order. The DRIFT control still demands **EXACTLY 0** afterwards, and
     * `--knownbad shake` still goes red through the double render (the pre-`a1a85e5`
     * integrator re-randomises on EVERY `render()`, so rendering twice cannot hide it —
     * asserted, not assumed).
     */
    const grab = () => {
      still(); stage.render(0);
      still(); stage.render(0);
      c2.clearRect(0, 0, RW, RH);
      c2.drawImage(stage.canvas, 0, 0, RW, RH);
      return c2.getImageData(0, 0, RW, RH).data;
    };
    const lum = (a, i) => (0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]) / 255;

    /** Every pixel index whose max channel delta from `base` clears D. */
    const changedIdx = (cur) => {
      const idx = [];
      for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
        const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]),
          Math.abs(cur[i + 2] - base[i + 2]));
        if (d >= D) idx.push(p);
      }
      return idx;
    };

    /** HSL, in DISPLAY space. Deliberately not via `THREE.Color`, which holds LINEAR
     *  values — a hue read through it lands somewhere the eye does not expect. */
    const hsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      if (mx === mn) return [0, 0, l];
      const d = mx - mn;
      const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      let h;
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      return [h * 60, s, l];
    };

    window.__vg = {
      total: RW * RH,
      dims: [RW, RH],
      mattes: {},
      setBase() { base = grab(); },
      /** Buffer + CSS integers. Engine-independent and the only "resolution" numbers
       *  this file will ever print. */
      buffers() {
        const c = stage.canvas;
        return {
          drawingBuffer: [c.width, c.height],
          cssBox: [c.clientWidth, c.clientHeight],
          devicePixelRatio: window.devicePixelRatio,
          rendererPixelRatio: stage.renderer?.getPixelRatio?.() ?? null,
        };
      },
      /**
       * The measurement. Everything is computed over ONE painted set on ONE frame, so a
       * mask from one render and a value from another (LESSONS §5) is structurally
       * impossible here.
       */
      measure(victimKeys) {
        const cur = grab();
        const idx = changedIdx(cur);
        const n = idx.length;
        if (!n) {
          return { n: 0, pct: 0, empty: true, victims: {} };
        }
        let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
        let lumAfter = 0, lumBefore = 0, satSum = 0;
        let hx = 0, hy = 0;
        for (const p of idx) {
          const i = p * 4;
          const x = p % RW, y = (p / RW) | 0;
          if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
          lumAfter += lum(cur, i);
          lumBefore += lum(base, i);
          const [h, s] = hsl(cur[i], cur[i + 1], cur[i + 2]);
          satSum += s;
          const r = h * Math.PI / 180;
          hx += Math.cos(r); hy += Math.sin(r);
        }
        /**
         * STRUCTURE DENSITY — mean |luma gradient| over the painted pixels, in the AFTER
         * frame and in the BASELINE at the identical pixels. Area cannot tell a soft wash
         * from a legible sculpt; this can. Computed with a 4-neighbour forward difference
         * and skipped on the right/bottom edge rather than clamped, because a clamped
         * edge contributes a guaranteed zero and would dilute the mean by the perimeter.
         */
        const painted = new Set(idx);
        let gA = 0, gB = 0, gN = 0;
        for (const p of idx) {
          const x = p % RW, y = (p / RW) | 0;
          if (x + 1 >= RW || y + 1 >= RH) continue;
          const i = p * 4, ix = (p + 1) * 4, iy = (p + RW) * 4;
          gA += (Math.abs(lum(cur, i) - lum(cur, ix)) + Math.abs(lum(cur, i) - lum(cur, iy))) / 2;
          gB += (Math.abs(lum(base, i) - lum(base, ix)) + Math.abs(lum(base, i) - lum(base, iy))) / 2;
          gN++;
        }

        // ── CAST REPAINT, hue-contract rule 2 — the intersection matte only ──────
        const victims = {};
        for (const k of victimKeys) {
          const m = window.__vg.mattes[k];
          if (!m || !m.size) { victims[k] = { matteN: 0, hitN: 0, pct: null, empty: true }; continue; }
          let hitN = 0;
          for (const p of m) if (painted.has(p)) hitN++;
          victims[k] = { matteN: m.size, hitN, pct: +(100 * hitN / m.size).toFixed(2), empty: false };
        }

        return {
          n, pct: +(100 * n / (RW * RH)).toFixed(4), empty: false,
          bbox: [minx, miny, maxx, maxy],
          lumaAfter: +(lumAfter / n).toFixed(4),
          lumaBefore: +(lumBefore / n).toFixed(4),
          dLuma: +((lumAfter - lumBefore) / n).toFixed(4),
          sat: +(satSum / n).toFixed(4),
          hue: +(((Math.atan2(hy, hx) * 180 / Math.PI) + 360) % 360).toFixed(1),
          structAfter: gN ? +(gA / gN).toFixed(5) : null,
          structBefore: gN ? +(gB / gN).toFixed(5) : null,
          structN: gN,
          victims,
        };
      },
      /**
       * DRIFT DIAGNOSTIC — k successive renders of the frozen frame, each compared with
       * the first, with the bounding box of whatever moved. A bare count says "something
       * drifted"; the bbox says WHERE, which is the difference between finding the cause
       * and guessing at it. (`a1a85e5`'s shake drifted the WHOLE frame; a localised bbox
       * is a different animal and must not be treated as the same one.)
       */
      /**
       * SETTLE PROBE — how many grabs after a `VfxLayer.clear()` does the frame take to
       * stop changing? Reported as a series of CONSECUTIVE diffs, so the answer is a
       * measured integer rather than a guessed `warm(3)`.
       *
       * This exists because the first three hypotheses for the 773 px DRIFT were all
       * WRONG and each was cheap to believe: camera shake (ruled out — a shake is a
       * whole-frame translation and this bbox is a third of the frame), a one-render
       * shadow settle (ruled out — rendering twice per grab did not move it), and the
       * game loop still turning at dt=0 (ruled out — `LOOPCOST` measured **0 px** for a
       * real rAF turn). Guessing a warm-up count would have papered over whichever of
       * those it actually was.
       */
      settleProbe(k) {
        window.__vfxLayer.clear();
        const rows = [];
        let prev = grab();
        for (let j = 1; j < k; j++) {
          const cur = grab();
          let n = 0;
          for (let i = 0; i < cur.length; i += 4) {
            const d = Math.max(Math.abs(cur[i] - prev[i]), Math.abs(cur[i + 1] - prev[i + 1]),
              Math.abs(cur[i + 2] - prev[i + 2]));
            if (d >= D) n++;
          }
          rows.push({ grab: j, vsPrev: n });
          prev = cur;
        }
        return rows;
      },
      /**
       * SEEDED RNG — because these effects are built from ROUND-ROBIN POOLS WITH
       * RANDOMISED SHARD DIRECTIONS, and unseeded they cannot be compared at all.
       *
       * `wv_area.mjs` measured exactly this on its own POINTING control: two arms
       * differed **15.4%** while the within-arm spread was **15.0%** — *"the noise was
       * the same size as the signal"* — and `vfx_wcov.mjs` records the same thing as
       * "+/-10-20% at ~300 px". A cross-tree A/B of unseeded numbers would produce
       * confident differences that are entirely draw.
       *
       * ⚠️ **SEEDING DOES NOT MAKE THE TWO TREES DRAW THE SAME NUMBERS, AND SAYING IT
       * DOES WOULD BE THE LIE.** `a42224c` ADDS an anchor burst under every bespoke
       * impact, so the AFTER arm consumes draws the BEFORE arm never makes and the two
       * streams diverge from the first extra element. What seeding buys is that each arm
       * is EXACTLY reproducible, so the run-to-run component is removed and what is left
       * can be characterised: `--repeats` sweeps the seed and the WITHIN-ARM spread
       * across seeds is reported as the floor, which is the only honest bar for the
       * between-arm difference. `DECISIONS §62`'s precedent — build the floor from a null
       * arm, not from a formula.
       */
      seed(n) {
        let st = (n >>> 0) || 1;
        Math.random = () => {
          // 32-bit LCG (Numerical Recipes constants). Deliberately not crypto: it has to
          // be reproducible across two browsers, two trees and two runs.
          st = (Math.imul(1664525, st) + 1013904223) >>> 0;
          return st / 4294967296;
        };
      },
      /** N throwaway grabs, to get past whatever `settleProbe` measured. */
      warm(n) { for (let i = 0; i < n; i++) grab(); },
      /**
       * SHAKE AUDIT — does `CameraRig.update(0)` HOLD the shake, or re-randomise it?
       *
       * This is the direct test of whether `still()` is load-bearing in THIS tree, and it
       * is here because `--knownbad shake` failed to go red and the honest reading of
       * that is a FINDING, not a broken control: `a1a85e5` fixed the integrator
       * (`update()` multiplied the DECAY by `dtSeconds` and the RE-RANDOMISATION by
       * nothing), so at dt=0 the offset now holds and zeroing it changes no pixel.
       *
       * Rather than leave `still()` as an unfalsifiable comment with a tick next to it
       * (`AGENT-BRIEF` §4.4: what implementation would fail this?), this measures the
       * property the zeroing depends on. If the integrator ever regresses, `holds` goes
       * false HERE and `--knownbad shake` starts going red again on its own.
       */
      shakeAudit() {
        const rig = stage.rig;
        if (!rig || typeof rig.shake !== 'function') return { err: 'no rig.shake' };
        const savedA = rig.shakeAmount;
        const savedO = rig.shakeOffset ? rig.shakeOffset.clone() : null;
        rig.shake(0.4);
        rig.update(1 / 60);                       // one real frame, so the offset is real
        const amt0 = rig.shakeAmount;
        const o0 = rig.shakeOffset.clone();
        const nonZero = amt0 > 0.0001 && o0.length() > 0;
        let moved = 0;
        for (let i = 0; i < 8; i++) {
          rig.update(0);
          if (rig.shakeOffset.distanceTo(o0) > 1e-9 || Math.abs(rig.shakeAmount - amt0) > 1e-9) moved++;
        }
        rig.shakeAmount = savedA;
        if (savedO) rig.shakeOffset.copy(savedO);
        rig.apply();
        return {
          kickedAmount: +amt0.toFixed(6), kickedOffsetLen: +o0.length().toFixed(6),
          // NON-VACUITY: "it held" is also true of a rig with no shake at all.
          nonVacuous: nonZero,
          movedAtZeroDt: moved, holds: nonZero && moved === 0,
        };
      },
      driftProbe(k) {
        const first = grab();
        const rows = [];
        for (let j = 1; j < k; j++) {
          const cur = grab();
          let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
          for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
            const d = Math.max(Math.abs(cur[i] - first[i]), Math.abs(cur[i + 1] - first[i + 1]),
              Math.abs(cur[i + 2] - first[i + 2]));
            if (d >= D) {
              n++;
              const x = p % RW, y = (p / RW) | 0;
              if (x < minx) minx = x; if (x > maxx) maxx = x;
              if (y < miny) miny = y; if (y > maxy) maxy = y;
            }
          }
          rows.push({ j, n, bbox: n ? [minx, miny, maxx, maxy] : null });
        }
        return rows;
      },
      /**
       * POOL CENSUS — active slots against pool CAPACITY, which is where an unconditional
       * anchor could hurt in a way no pixel metric can see.
       *
       * `vfx.ts` allocates from fixed pools — `PARTICLE_POOL_SIZE = 96`,
       * `RING_POOL_SIZE = 16`, `WEDGE_POOL_SIZE = 10` — and **when a pool is full both
       * `allocParticle()` and `allocRing()` STEAL the slot with the highest `life/maxLife`
       * rather than refusing.** So saturation is not a dropped effect, it is a LIVE effect
       * cut short: something already on screen disappears mid-fade.
       *
       * Each `burst()` takes 1 flash + `max(4, round(shards*0.7))` streaks + `shards`
       * particles + **2 rings**. Before `a42224c` a bespoke impact took NONE of these (it
       * returned early); after, every bespoke impact adds a whole `burst()`. At the five
       * simultaneous impacts `3483d23` made reachable that is **10 of the 16 rings from a
       * single swing**, on top of whatever the sculpts and the cast beat are using.
       *
       * These are integers read off the live pools and are completely engine-independent —
       * SwiftShader cannot make them wrong. TypeScript `private` is a compile-time fiction;
       * at runtime `particles`/`rings`/`wedges` are ordinary fields.
       */
      census() {
        const L = window.__vfxLayer;
        if (!L) return null;
        const count = (arr) => (Array.isArray(arr) ? arr.filter((x) => x.active).length : null);
        return {
          particles: count(L.particles), particleCap: Array.isArray(L.particles) ? L.particles.length : null,
          rings: count(L.rings), ringCap: Array.isArray(L.rings) ? L.rings.length : null,
          wedges: count(L.wedges), wedgeCap: Array.isArray(L.wedges) ? L.wedges.length : null,
        };
      },
      /** Advance the VFX LAYER ONLY. The sim is deliberately held still — see the file
       *  header for why, and for what that excludes. */
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
      shot() { still(); stage.render(0); },
      fire(events) {
        const before = window.__feelDebug ? { ...window.__feelDebug.events } : null;
        for (const ev of events) window.__feelEvent(ev);
        const after = window.__feelDebug ? { ...window.__feelDebug.events } : null;
        return { before, after };
      },
      fireSpawnTest(specs) {
        const before = window.__feelDebug ? { ...window.__feelDebug.events } : null;
        for (const s of specs) window.__vfxSpawnTest('impact', s.x, s.y, s.amount, s.color, s.who, s.weaponKey);
        const after = window.__feelDebug ? { ...window.__feelDebug.events } : null;
        return { before, after };
      },
      /** Re-pitch the shipped match rig into the lobby-analogue DETECTOR view. The fields
       *  set are the rig's INPUTS, so a later `apply()`/`update()` honours them — which
       *  matters because `Stage.render()` calls `rig.update()` itself. */
      setPitch(deg, widthUnits) {
        const rig = stage.rig; if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return { was: saved, now: { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits } };
      },

      /**
       * THE CAST MATTE, and why it is the INTERSECTION and not "hide it and diff".
       *
       * Lifted from `vfx_wcov.mjs`, whose header records the measurement that forces it:
       * the hide-diff matte is silhouette PLUS the shadow the fighter throws, so a
       * floor-level wash tints the shadow and scores as "repainted the fighter" while the
       * fighter is plainly readable — 73.2% by hide-diff against 9.7% by intersection on
       * the same frame. And the magenta test ALONE over-counts, because the post chain
       * blooms a saturated magenta figure outward (9,337 magenta px against a 5,255 px
       * hide-diff, i.e. a "silhouette" 78% larger than the whole character).
       *
       *   (a) the pixel CHANGES when the character is hidden   — it OWNS it
       *   (b) the pixel turns MAGENTA when the character is repainted magenta — it DRAWS it
       *
       * ⚠️ MATERIALS ARE DEDUPED BY IDENTITY. `rig.ts` builds ONE `limbMat` and assigns
       * it to every limb, so a per-mesh save reads back a value the first swap already
       * wrote and the restore loop then writes magenta back over the colour it just
       * restored — leaving the character permanently magenta while the numbers still look
       * reasonable. `vfx_wcov` found this the hard way; it is fixed here from the start
       * and the restore is ASSERTED below rather than assumed.
       */
      buildMatte(charId) {
        const root = stage.scene.getObjectByName(`character:${charId}`);
        if (!root) return { err: `no character:${charId}` };
        const clean = grab();

        const wasVisible = root.visible;
        root.visible = false;
        const hidden = grab();
        root.visible = wasVisible;

        const hideSet = new Set();
        for (let i = 0, p = 0; i < clean.length; i += 4, p++) {
          const d = Math.max(Math.abs(clean[i] - hidden[i]), Math.abs(clean[i + 1] - hidden[i + 1]),
            Math.abs(clean[i + 2] - hidden[i + 2]));
          if (d >= D) hideSet.add(p);
        }

        const seen = new Set();
        const swapped = [];
        root.traverse((o) => {
          if (!o.isMesh && !o.isSprite) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m || seen.has(m)) continue;
            seen.add(m);
            swapped.push({ m, color: m.color?.getHex(), emissive: m.emissive?.getHex(), map: m.map, transparent: m.transparent, opacity: m.opacity });
            m.color?.setHex(0xff00ff);
            m.emissive?.setHex(0x000000);
            m.map = null; m.transparent = false; m.opacity = 1; m.needsUpdate = true;
          }
        });
        const magenta = grab();
        for (const s of swapped) {
          if (s.color !== undefined) s.m.color.setHex(s.color);
          if (s.emissive !== undefined) s.m.emissive.setHex(s.emissive);
          s.m.map = s.map; s.m.transparent = s.transparent; s.m.opacity = s.opacity;
          s.m.needsUpdate = true;
        }
        // RESTORE, asserted rather than trusted.
        const after = grab();
        let restoreDiff = 0;
        for (let i = 0; i < clean.length; i += 4) {
          const d = Math.max(Math.abs(clean[i] - after[i]), Math.abs(clean[i + 1] - after[i + 1]),
            Math.abs(clean[i + 2] - after[i + 2]));
          if (d >= D) restoreDiff++;
        }

        let magentaN = 0;
        const matte = new Set();
        for (let i = 0, p = 0; i < magenta.length; i += 4, p++) {
          // Test the SHAPE of the colour (red+blue high, green low), not an exact hex —
          // the post chain shifts the value.
          if (magenta[i] > 110 && magenta[i + 2] > 110 && magenta[i + 1] < magenta[i] * 0.7) {
            magentaN++;
            if (hideSet.has(p)) matte.add(p);
          }
        }
        window.__vg.mattes[charId] = matte;
        return {
          charId, hideN: hideSet.size, magentaN, matteN: matte.size,
          pctOfFrame: +(100 * matte.size / (RW * RH)).toFixed(3),
          restoreDiff, materials: swapped.length,
        };
      },
      /** MATTE+ / MATTE- : hide `hideId`, measure against `matteId`'s matte. */
      matteControl(hideId, matteId) {
        const root = stage.scene.getObjectByName(`character:${hideId}`);
        const m = window.__vg.mattes[matteId];
        if (!root || !m || !m.size) return null;
        base = grab();
        const wasVisible = root.visible;
        root.visible = false;
        const idx = changedIdx(grab());
        root.visible = wasVisible;
        const painted = new Set(idx);
        let hitN = 0;
        for (const p of m) if (painted.has(p)) hitN++;
        return { hideId, matteId, matteN: m.size, hitN, pct: +(100 * hitN / m.size).toFixed(2) };
      },
      /**
       * ⚠️ `VfxFighterSnapshot` is `{x,y,hp,alive,terrainSlowFactor}` and carries NO
       * character id — checked in `vfx.ts`, not assumed. So slot -> character comes from
       * the `?fighters=` order (`match.ts:fightersFromQuery`, which seats them in order)
       * and that assumption is NOT trusted: `seatMap()` below verifies it against an
       * independent source.
       */
      fighters(roster) {
        const f = window.__vfxDebugFighters;
        if (!f) return null;
        const slots = f.slots ?? [];
        return slots.map((s, i) => ({ i, id: roster[i] ?? null, x: s.x, y: s.y, hp: s.hp, alive: s.alive }));
      },
      /**
       * SEAT MAP — the control for "slot i is ROSTER[i]", which every scene's
       * `attackerId` depends on. Without it a rotated roster would fire `Giant` from a
       * fighter who does not own it, `impactSource` would stay undefined, the hit would
       * silently take the GENERIC path, and the run would look like a clean measurement
       * of a missing sculpt.
       *
       * Independent source: hide `character:<id>`, take the CENTROID of the pixels that
       * change, and compare it against `match.ts`'s own
       * `__vfxDebugScreen.slots[i]` — a projection computed by the game, not by this
       * probe. The assignment must be the identity permutation.
       *
       * ⚠️ `__vfxDebugScreen` is written in `update()`, which the paused clock has
       * stopped, so these are the values from the last live frame. Fighters move ~1 wu
       * per frame at spawn distance, so that is far inside the seat spacing this is
       * distinguishing (hundreds of wu). Stated because a stale-but-legal coordinate is
       * exactly the class this repo has been bitten by.
       */
      seatMap(roster) {
        const scr = window.__vfxDebugScreen?.slots;
        if (!scr || !scr.length) return { err: 'no __vfxDebugScreen.slots' };
        /**
         * 🚨 `projectPointToScreen` RETURNS PAGE-SPACE CSS COORDINATES; A CENTROID READ
         *    OFF THE READBACK IS CANVAS-LOCAL. ON A LETTERBOXED CANVAS THOSE DIFFER.
         *
         * This was wrong for a whole run and only the PHONE profile exposed it. The game
         * clamps the canvas aspect, so at 393x852 CSS the canvas is **393x295**, centred,
         * with ~278 px of letterbox above it. Scaling the readback centroid by
         * `clientHeight / RH` alone therefore produced coordinates ~277 px above the
         * projection's, every seat resolved to its nearest neighbour instead of itself,
         * and the control reported *"SEATMAP is not the identity permutation"* on a run
         * where all six seats were perfectly correct.
         *
         * The giveaway, and the reason this was caught rather than believed: the **X
         * coordinates matched to within 6 px on all six seats** (194.3 vs 196.5, 289.7 vs
         * 295.2, ...) while every Y was off by the same ~277. A constant offset on one
         * axis is a coordinate-space bug, not a mismapping — a real mismap would scramble
         * both axes. On desktop the canvas fills the viewport, the offset is 0, and the
         * bug is invisible.
         */
        const rect = stage.canvas.getBoundingClientRect();
        const cssW = rect.width || stage.canvas.clientWidth || RW;
        const cssH = rect.height || stage.canvas.clientHeight || RH;
        const offX = rect.left;
        const offY = rect.top;
        const clean = grab();
        const rows = [];
        for (const id of roster) {
          const root = stage.scene.getObjectByName(`character:${id}`);
          if (!root) { rows.push({ id, err: 'no root' }); continue; }
          const was = root.visible;
          root.visible = false;
          const hid = grab();
          root.visible = was;
          let sx = 0, sy = 0, n = 0;
          for (let i = 0, p = 0; i < clean.length; i += 4, p++) {
            const d = Math.max(Math.abs(clean[i] - hid[i]), Math.abs(clean[i + 1] - hid[i + 1]),
              Math.abs(clean[i + 2] - hid[i + 2]));
            if (d >= D) { sx += p % RW; sy += (p / RW) | 0; n++; }
          }
          if (!n) { rows.push({ id, err: 'hide-diff EMPTY — off screen?' }); continue; }
          // readback px -> CSS px, the space `projectPointToScreen` returns.
          const cx = offX + (sx / n) * (cssW / RW);
          const cy = offY + (sy / n) * (cssH / RH);
          let best = -1, bestD = Infinity;
          scr.forEach((s, i) => {
            if (!s) return;
            const dd = Math.hypot(s.x - cx, s.y - cy);
            if (dd < bestD) { bestD = dd; best = i; }
          });
          rows.push({ id, centroid: [+cx.toFixed(1), +cy.toFixed(1)], nearestSlot: best, dist: +bestD.toFixed(1), n });
        }
        return {
          rows,
          canvasRect: [+rect.left.toFixed(1), +rect.top.toFixed(1), +rect.width.toFixed(1), +rect.height.toFixed(1)],
          screenSlots: scr.map((s) => (s ? [+s.x.toFixed(1), +s.y.toFixed(1)] : null)),
        };
      },
      feelEvents() { return window.__feelDebug ? { ...window.__feelDebug.events } : null; },
    };
  }, [rw, rh, delta, stillShake]);
}
/* eslint-enable */

async function main() {
  await mkdir(OUT, { recursive: true });
  const stamp = `${LABEL}.${PROFILE}.p${PITCH}${KNOWNBAD ? `.kb-${KNOWNBAD}` : ''}`;
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report = {
    label: LABEL, profile: PROFILE, pitch: PITCH, base: BASE, driver: DRIVER,
    knownbad: KNOWNBAD, roster: ROSTER, delta: DELTA, slices: SLICES,
    when: new Date().toISOString(), controls: {}, scenes: {}, faults: [],
  };
  const fault = (s) => { report.faults.push(s); log(`  🔴 ${s}`); };
  let exitCode = 0;

  try {
    const ctx = await browser.newContext({
      viewport: { width: P.w, height: P.h },
      deviceScaleFactor: P.dsf,
      isMobile: PROFILE === 'phone',
      hasTouch: PROFILE === 'phone',
    });
    const page = await ctx.newPage();
    await boot(page);

    // ── PHASE 1: derive the cluster from `arena/shared.ts`, never from a literal ──
    let spawnQuery = ROSTER.join(';');
    let cluster = null;
    if (!NO_CLUSTER) {
      /**
       * 🚨 THE CLUSTER IS ANCHORED TO AN AUTHORED SPAWN, NOT TO `CENTER`, AND THE FIRST
       *    VERSION WAS ANCHORED TO `CENTER` AND WAS WRONG — VISIBLY, IN THE PNG.
       *
       * `CENTER` (1400,1000) is where the KITCHEN POT stands. Ringing six fighters around
       * it put the pot in the middle of every frame, occluded three of them (pizza's cast
       * matte came back at **1 px**), and the SEATMAP control went red for three seats.
       * That was found by READING THE PNG (CLAUDE.md #3) after three numeric controls had
       * already flagged it — the numbers said "something is wrong", the image said what.
       *
       * An authored spawn is by construction a clear, legal standing position that the
       * arena's own layout pass placed, so it needs no judgement from this probe. Read off
       * `window.__matchArena.spawns` — the live `ArenaDefinition`, by reference — so it
       * cannot go stale against `kitchen.ts` the way a retyped coordinate would. On this
       * arena every stale coordinate is still a LEGAL coordinate (the 1x playfield is
       * exactly the NW quadrant), so a fossil here would never announce itself.
       */
      await page.goto(`${BASE}/?fighters=${ROSTER.join(';')}&simSpeed=1&pointerLock=0`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180000 });
      await page.waitForFunction(() => !!window.__matchArena, null, { timeout: 60000 });
      cluster = await page.evaluate(async ([n, r]) => {
        const shared = await import('/src/arena/shared.ts');
        const rules = await import('/src/game/rules.ts');
        const spawns = window.__matchArena?.spawns ?? null;
        const anchor = spawns && spawns[0] ? { x: spawns[0].x, y: spawns[0].y } : { x: shared.CENTER.x, y: shared.CENTER.y };
        // Slot 0 (the camera subject and the Giant caster) sits AT the anchor; the five
        // victims ring it at `r`. Every victim is then exactly `r` from the caster, so
        // "are all five inside REACH.ultimateSlam" is one comparison and not five.
        const pts = [{ x: Math.round(anchor.x), y: Math.round(anchor.y) }];
        for (let i = 0; i < n - 1; i++) {
          const a = (Math.PI * 2 * i) / (n - 1);
          pts.push({ x: Math.round(anchor.x + r * Math.cos(a)), y: Math.round(anchor.y + r * Math.sin(a)) });
        }
        return {
          anchor, anchorSource: spawns && spawns[0] ? 'arena.spawns[0]' : 'shared.CENTER (NO arena spawns!)',
          spawnCount: spawns ? spawns.length : 0,
          center: { x: shared.CENTER.x, y: shared.CENTER.y },
          arena: [shared.ARENA_W, shared.ARENA_H], radius: r, pts,
          minSafeRadius6: rules.minSafeRadiusFor ? rules.minSafeRadiusFor(6) : null,
          ultimateSlamReach: rules.REACH?.ultimateSlam ?? null,
        };
      }, [ROSTER.length, CLUSTER_R]);
      spawnQuery = ROSTER.map((id, i) => `${id}@${cluster.pts[i].x},${cluster.pts[i].y}`).join(';');
      report.cluster = cluster;
      if (cluster.ultimateSlamReach && cluster.radius > cluster.ultimateSlamReach) {
        fault(`cluster radius ${cluster.radius} wu > REACH.ultimateSlam ${cluster.ultimateSlamReach} — the 5-victim arc this file exists to photograph CANNOT occur at this spacing`);
      }
    }

    const url = `${BASE}/?fighters=${spawnQuery}&simSpeed=1&pointerLock=0`;
    log(`\n[vg_frame] ${stamp}`);
    log(`[vg_frame] ${url}`);
    log(`[vg_frame] viewport ${P.w}x${P.h} CSS @ dsf ${P.dsf} · readback ${P.rw}x${P.rh} · delta ${DELTA}`);
    if (cluster) {
      // ⚠️ This line used to say "around CENTER <center.x>,<center.y>" and kept saying it
      // after the anchor moved to `arena.spawns[0]` — a report that names the wrong
      // location while every number under it is of another. Corrected; the old wording is
      // recorded here because that is the exact shape of defect this file is looking for.
      log(`[vg_frame] cluster: r=${cluster.radius} wu around ${cluster.anchorSource} `
        + `(${cluster.anchor.x}, ${cluster.anchor.y}) · ${cluster.spawnCount} authored spawns `
        + `· arena ${cluster.arena.join('x')}, CENTER ${cluster.center.x},${cluster.center.y}`);
      log(`[vg_frame]   minSafeRadiusFor(6) = ${cluster.minSafeRadius6} wu · REACH.ultimateSlam = ${cluster.ultimateSlamReach} wu`
        + ` — the cluster is inside BOTH, which is what makes a 5-victim arc reachable at all`);
    }
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__feelEvent && !!window.__feelDebug,
      null, { timeout: 60000 });
    // The countdown must finish IN REAL TIME — a paused clock during `countdown` holds
    // the phase forever.
    await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 180000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    // The loop is stopped AFTER the clock is paused and after it has had 400 ms to settle
    // on the frozen clock, so what is frozen is a legitimately reached frame.
    await page.evaluate(() => window.__raf.off());
    await installHarness(page, P.rw, P.rh, DELTA, KNOWNBAD !== 'shake');

    // ── The only "resolution" numbers this file prints, and they are integers ────
    const buffers = await page.evaluate(() => window.__vg.buffers());
    report.buffers = buffers;
    log(`\n══ BUFFERS (engine-independent integers) ═══════════════════════════════════`);
    log(`  drawing buffer   ${buffers.drawingBuffer.join(' x ')}`);
    log(`  css box          ${buffers.cssBox.join(' x ')}`);
    log(`  devicePixelRatio ${buffers.devicePixelRatio}   renderer.getPixelRatio() ${buffers.rendererPixelRatio}`);

    if (PITCH !== 58) {
      const cam = await page.evaluate(([d, w]) => window.__vg.setPitch(d, w), [PITCH, DETECT_WIDTH]);
      report.camera = cam;
      log(`  camera re-pitched ${cam.was.pitch} -> ${cam.now.pitch} deg, frameMode ${cam.was.mode} -> ${cam.now.mode}, width ${cam.was.width} -> ${cam.now.width} wu`);
      log(`  🔴 pitch-${PITCH} AREAS ARE NOT SHIPPED SCALE. Only the paired before/after at this same pitch is quotable.`);
    }

    const fighters = await page.evaluate(([r]) => window.__vg.fighters(r), [ROSTER]);
    if (!fighters || fighters.length !== 6) {
      fault(`expected 6 fighters, got ${fighters ? fighters.length : 'null'} — every scene below would be aimed at nothing`);
      report.fighters = fighters;
      throw new Error('roster did not seat 6');
    }
    report.fighters = fighters;
    log(`\n══ SEATED ══════════════════════════════════════════════════════════════════`);
    for (const f of fighters) log(`  slot ${f.i}  ${pad(f.id, 12)} (${f.x.toFixed(0)}, ${f.y.toFixed(0)}) wu  hp ${f.hp}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTROLS — before any measurement is believed
    // ═══════════════════════════════════════════════════════════════════════════
    log(`\n══ CONTROLS ════════════════════════════════════════════════════════════════`);

    // SETTLE — measured, not guessed. See `settleProbe`'s header for the three wrong
    // hypotheses this replaced.
    const settle = KNOWNBAD === 'nowarm' ? [] : await page.evaluate(() => window.__vg.settleProbe(8));
    report.controls.settle = settle;
    const firstQuiet = settle.findIndex((r) => r.vsPrev === 0);
    if (KNOWNBAD === 'nowarm') log(`  SETTLE    SKIPPED — --knownbad nowarm removes the settle AND the warm-up`);
    else {
      log(`  SETTLE    consecutive diffs after clear() ............. ${settle.map((r) => r.vsPrev).join(', ')} px`);
      log(`            -> quiet from grab ${firstQuiet < 0 ? 'NEVER' : firstQuiet + 1}; WARM is ${WARM}`);
      if (firstQuiet < 0) fault('the frame NEVER settles — a stable baseline is not obtainable and nothing below is quotable');
      else if (firstQuiet + 1 > WARM) fault(`settle needs ${firstQuiet + 1} grabs but WARM is ${WARM} — raise --warm`);
    }

    // DRIFT — the same frozen frame, grabbed twice. EXACTLY 0.
    await page.evaluate(() => window.__vg.reset());
    if (KNOWNBAD !== 'nowarm') await page.evaluate(([w]) => window.__vg.warm(w), [WARM]);
    await page.evaluate(() => window.__vg.setBase());
    const drift = await page.evaluate(() => window.__vg.measure([]));
    const driftSeries = await page.evaluate(() => window.__vg.driftProbe(6));
    /**
     * 🚨 DRIFT-GAP — THE SAME CHECK ACROSS A REAL-TIME GAP AND AN EVALUATE BOUNDARY,
     *    BECAUSE THAT IS THE CONDITION THAT PRODUCED THE 773 px.
     *
     * `driftProbe` renders six times inside ONE `page.evaluate` and reported 0,0,0,0,0
     * while the very same two grabs, issued as two separate evaluates with a CDP round
     * trip between them, reported 773 px, bbox [66,89,262,359]. So an in-page drift
     * control is NOT sufficient here: **every scene measurement below crosses that
     * boundary**, once per slice, so the control has to cross it too or it is certifying
     * a condition the measurement never runs in.
     *
     * ⚠️ The mechanism was NOT identified. `LOOPCOST` proves it is not the rAF loop
     * (0 px through a real turn) and it is not the camera shake (a shake translates the
     * WHOLE frame; this bbox is a third of it). It is suppressed by `WARM` throwaway
     * grabs and it is REPORTED, not tolerated — but "I could not identify the cause" is
     * the honest state and it is written here rather than left out.
     */
    await page.evaluate(() => window.__vg.setBase());
    await page.waitForTimeout(700);
    const driftGap = await page.evaluate(() => window.__vg.measure([]));
    report.controls.drift = {
      n: drift.n, bbox: drift.bbox ?? null, series: driftSeries,
      gapN: driftGap.n, gapBbox: driftGap.bbox ?? null,
    };
    const driftOk = drift.n === 0 && driftSeries.every((r) => r.n === 0) && driftGap.n === 0;
    log(`  DRIFT     frozen frame vs itself ....................... ${rp(drift.n, 8)} px  (want EXACTLY 0)  ${drift.n === 0 ? 'ok' : '🔴'}`);
    log(`  DRIFT-GAP same, across 700 ms + an evaluate boundary .. ${rp(driftGap.n, 8)} px  (want EXACTLY 0)  ${driftGap.n === 0 ? 'ok' : '🔴'}`);
    if (!driftOk) {
      log(`            6-render series: ${driftSeries.map((r) => r.n).join(', ')} px`);
      for (const r of driftSeries) if (r.bbox) log(`              render ${r.j}: bbox ${r.bbox.join(',')} of ${P.rw}x${P.rh}`);
      if (driftGap.bbox) log(`            gap bbox ${driftGap.bbox.join(',')} of ${P.rw}x${P.rh}`);
    }
    if (!driftOk && KNOWNBAD !== 'shake') fault(`DRIFT is ${drift.n} px / gap ${driftGap.n} px, not 0 — no number below can be believed`);

    /**
     * LOOPCOST — what ONE game-loop turn at dt=0 is worth, reported rather than hidden.
     * This is the quantity that made DRIFT 788 px before the loop was stopped. It is not
     * a pass/fail row: it is the size of the thing being suppressed, and a reader is
     * entitled to know it is ~800 px and not ~8.
     */
    await page.evaluate(() => window.__vg.setBase());
    await page.evaluate(() => window.__raf.once());
    const loopCost = await page.evaluate(() => window.__vg.measure([]));
    await page.evaluate(() => window.__raf.off());
    report.controls.loopCost = { n: loopCost.n, bbox: loopCost.bbox ?? null };
    log(`  LOOPCOST  ONE rAF turn at dt=0 moves ................... ${rp(loopCost.n, 8)} px  `
      + `${loopCost.bbox ? `bbox ${loopCost.bbox.join(',')}` : ''}  (suppressed, not tolerated)`);

    // MOVER — DRIFT's zero is vacuous without it: a probe that renders nothing scores 0.
    const f0 = fighters[0];
    await page.evaluate(() => window.__vg.setBase());
    const moverFire = await page.evaluate(([evs]) => window.__vg.fire(evs),
      [[hit(0, SLOT.lollipop, 'Giant', 'Giant Lollipop', 18, f0.x, f0.y, 'stun')]]);
    await page.evaluate(() => window.__vg.step(150));
    const mover = await page.evaluate(() => window.__vg.measure([]));
    report.controls.mover = { n: mover.n, pct: mover.pct };
    const moverOk = mover.n > 200;
    log(`  MOVER     one real impact must move the frame ......... ${rp(mover.n, 8)} px  (want >> 0)      ${moverOk ? 'ok' : '🔴'}`);
    if (!moverOk) fault(`MOVER is ${mover.n} px — DRIFT's 0 is VACUOUS and every null below is meaningless`);

    // EVENTS — did the synthetic event actually reach `handleEvents`?
    const evDelta = (moverFire.after?.['hit-landed:weapon'] ?? 0) - (moverFire.before?.['hit-landed:weapon'] ?? 0);
    report.controls.eventsReached = evDelta;
    const evOk = evDelta === 1;
    log(`  EVENTS    hit-landed:weapon counter rose by ........... ${rp(evDelta, 8)}     (want exactly 1) ${evOk ? 'ok' : '🔴'}`);
    if (!evOk) fault(`__feelEvent did not reach handleEvents (delta ${evDelta}) — every scene is firing into nothing`);

    await page.evaluate(() => window.__vg.reset());
    await page.evaluate(() => window.__vg.step(1200));

    // MATTES + their two controls.
    log('');
    const matteRows = {};
    for (const id of ROSTER) {
      const m = await page.evaluate(([c]) => window.__vg.buildMatte(c), [id]);
      matteRows[id] = m;
      const ok = !m.err && m.matteN > 0 && m.restoreDiff === 0;
      log(`  MATTE     ${pad(id, 11)} intersection ${rp(m.matteN ?? 0, 6)} px (${rp((m.pctOfFrame ?? 0).toFixed(2), 5)}% of frame) `
        + `· hide-diff ${rp(m.hideN ?? 0, 6)} · magenta ${rp(m.magentaN ?? 0, 6)} · restore ${m.restoreDiff} ${ok ? '' : '🔴'}`);
      if (m.err) fault(`matte ${id}: ${m.err}`);
      else if (!m.matteN) fault(`matte ${id} is EMPTY — every repaint % against it would be null, and a filtered-empty set asserts TRUE`);
      else if (m.restoreDiff !== 0) fault(`matte ${id} left the frame ${m.restoreDiff} px different — the magenta swap LEAKED`);
    }
    report.controls.mattes = matteRows;

    const posCtl = await page.evaluate(() => window.__vg.matteControl('lollipop', 'lollipop'));
    const negCtl = await page.evaluate(() => window.__vg.matteControl('sushi', 'lollipop'));
    report.controls.mattePos = posCtl;
    report.controls.matteNeg = negCtl;
    const posOk = posCtl && posCtl.pct >= 90;
    const negOk = negCtl && negCtl.pct <= 5;
    log(`  MATTE+    hide lollipop -> % of ITS OWN matte ......... ${rp((posCtl?.pct ?? -1).toFixed(1), 8)}%   (want ~100)     ${posOk ? 'ok' : '🔴'}`);
    log(`  MATTE-    hide sushi    -> % of LOLLIPOP's matte ...... ${rp((negCtl?.pct ?? -1).toFixed(1), 8)}%   (want ~0)       ${negOk ? 'ok' : '🔴'}`);
    if (!posOk) fault(`MATTE+ ${posCtl?.pct}% — the matte does not contain the character it names`);
    if (!negOk) fault(`MATTE- ${negCtl?.pct}% — the matte leaks onto another fighter, so every repaint % is inflated`);

    // SEATMAP — is slot i really ROSTER[i]? Everything below depends on it.
    const seat = await page.evaluate(([r]) => window.__vg.seatMap(r), [ROSTER]);
    report.controls.seatMap = seat;
    /**
     * ⚠️ **TWO DIFFERENT FAILURES LIVE ON THIS ROW AND THE FIRST VERSION CONFLATED THEM,
     *    WHICH IS ITSELF THE BUG CLASS THIS FILE IS LOOKING FOR.**
     *
     * At `--pitch 20` the detector frames 300 wu, `burrito` falls outside it, its hide-diff
     * is empty and it cannot be LOCATED. The original code counted that as "not the identity
     * permutation" and printed *"every scene's attackerId names the wrong fighter, weapons
     * resolve to undefined, and every hit silently takes the GENERIC path"* — a claim that
     * was false in every particular, and it marked a whole camera NOT QUOTABLE on the
     * strength of it. The other five seats mapped correctly with 15-29 css px of error.
     *
     *   MISMAPPED   a seat that IS visible resolves to a DIFFERENT slot -> real, fatal.
     *   UNEVALUATED a seat is off-frame -> that seat's rule-2 rows are unjudgeable and
     *               nothing else is affected.
     *
     * And the non-emptiness guard the split makes necessary: if EVERY row is unevaluated,
     * "no seat is mismapped" is `[].every()` and is true of a probe pointed at nothing.
     */
    const seatRows = Array.isArray(seat.rows) ? seat.rows : [];
    const evaluated = seatRows.filter((r) => !r.err);
    const mismapped = evaluated.filter((r, ) => r.nearestSlot !== seatRows.indexOf(r));
    const unevaluated = seatRows.filter((r) => r.err);
    for (let i = 0; i < seatRows.length; i++) {
      const r = seatRows[i];
      const good = !r.err && r.nearestSlot === i;
      log(`  SEATMAP   ${pad(ROSTER[i], 11)} expected slot ${i} -> `
        + (r.err ? `UNEVALUATED (${r.err})` : `nearest ${r.nearestSlot} (${r.dist} css px)`)
        + ` ${good ? 'ok' : (r.err ? '— off frame' : '🔴 MISMAPPED')}`);
    }
    report.controls.seatMapVerdict = {
      evaluated: evaluated.length, mismapped: mismapped.length, unevaluated: unevaluated.map((r) => r.id),
    };
    if (seat.err) fault(`SEATMAP could not run: ${seat.err}`);
    // NON-EMPTY FIRST — `[].every()` is true, so "nothing is mismapped" over an empty
    // evaluated set is a vacuous green (CLAUDE.md #6).
    else if (!evaluated.length) fault('SEATMAP evaluated ZERO seats — "no seat is mismapped" is vacuously true and the seat assumption is unchecked');
    else if (mismapped.length) fault(`SEATMAP: ${mismapped.map((r) => r.id).join(', ')} resolve to the WRONG slot — those scenes' attackerId names the wrong fighter and the hit silently takes the GENERIC path`);
    else if (unevaluated.length) {
      log(`  SEATMAP   ${evaluated.length}/${seatRows.length} seats verified; ${unevaluated.map((r) => r.id).join(', ')} off frame at this framing`);
      log(`            -> NOT a fault. Those seats' rule-2 rows are UNJUDGEABLE and are reported as such; every other row stands.`);
    }

    // OWNERSHIP — every (attacker, weaponKey) pair must resolve to a real weapon, or the
    // hit silently takes the GENERIC path and looks exactly like a missing sculpt.
    const own = await page.evaluate(async ([pairs]) => {
      const rules = await import('/src/game/rules.ts');
      return pairs.map(([id, key]) => ({ id, key, ok: !!rules.CHARACTERS[id]?.weapons?.find((w) => w.key === key) }));
    }, [[['lollipop', 'Giant'], ['burrito', 'Swarm'], ['soup', 'Splash'], ['soup', 'Dump'],
      ['pizza', 'Tomato'], ['egg', 'Shards'], ['sushi', 'Rice']]]);
    report.controls.ownership = own;
    const ownBad = own.filter((o) => !o.ok);
    log(`  OWNERSHIP every (attacker, weaponKey) resolves ........ ${rp(`${own.length - ownBad.length}/${own.length}`, 8)}     (want all)      ${ownBad.length ? '🔴' : 'ok'}`);
    for (const o of ownBad) fault(`${o.id} does not own weapon '${o.key}' — that scene would silently measure the GENERIC path`);

    if (KNOWNBAD) {
      const audit = await page.evaluate(() => window.__vg.shakeAudit());
      report.controls.shakeAudit = audit;
      log(`\n══ KNOWN-BAD '${KNOWNBAD}' ══════════════════════════════════════════════════`);
      let ok;
      if (KNOWNBAD === 'nowarm') {
        // 🚨 THE REAL KNOWN-BAD FOR THIS CONTROL. It is not a caricature: it is the exact
        // instability this instrument had to defeat, measured in this tree at 773 px with
        // bbox [66,89,262,359], and it is reproduced by removing the two lines that
        // suppress it. DRIFT must go RED.
        log(`  the settle probe and the ${WARM} warm-up grabs are REMOVED. DRIFT must be NON-ZERO.`);
        log(`  DRIFT     = ${drift.n} px ${drift.bbox ? `bbox ${drift.bbox.join(',')}` : ''}`);
        log(`  DRIFT-GAP = ${driftGap.n} px ${driftGap.bbox ? `bbox ${driftGap.bbox.join(',')}` : ''}`);
        ok = drift.n > 0 || driftGap.n > 0;
        log(`  -> ${ok ? 'RED as required — the DRIFT control CAN fail' : '🔴 STILL GREEN: the DRIFT control is TAUTOLOGICAL and certifies nothing'}`);
      } else {
        /**
         * 🚨 THIS ARM DOES NOT GO RED, AND THAT IS THE RESULT — NOT A BROKEN CONTROL.
         *
         * Removing the explicit shake zeroing leaves DRIFT at 0 on this tree, because
         * `a1a85e5` fixed `CameraRig.update()` upstream: it used to multiply the shake
         * DECAY by `dtSeconds` and the RE-RANDOMISATION by nothing, so at dt=0 every
         * `render()` moved the camera (344 of 344 frozen frames drifted, up to 349 px).
         * With that fixed, `still()` is DEFENSIVE AND CURRENTLY INERT.
         *
         * Rather than report "known-bad failed" — which would read as a broken
         * instrument — the property the zeroing depends on is measured directly:
         * kick the rig, confirm the offset is genuinely non-zero (or "it held" is
         * vacuously true of a rig with no shake), then call `update(0)` eight times and
         * require the offset NOT to move. If the integrator ever regresses, `holds`
         * goes false here and this arm starts going red on its own.
         */
        log(`  the explicit shake zeroing is REMOVED.`);
        log(`  DRIFT = ${drift.n} px · DRIFT-GAP = ${driftGap.n} px`);
        log(`  rig audit: kicked amount ${audit.kickedAmount}, |offset| ${audit.kickedOffsetLen} `
          + `(non-vacuous: ${audit.nonVacuous}) · moved on ${audit.movedAtZeroDt}/8 update(0) calls · HOLDS ${audit.holds}`);
        ok = audit.nonVacuous && audit.holds && drift.n === 0;
        log(ok
          ? `  -> INERT, AND FOR THE RIGHT REASON: a1a85e5's integrator holds at dt=0, so zeroing changes no pixel.`
          : `  -> 🔴 the rig does NOT hold at dt=0 (or the kick was vacuous) — still() is load-bearing and DRIFT above is suspect`);
      }
      report.controls.knownbad = { mode: KNOWNBAD, drift: drift.n, driftGap: driftGap.n, verdict: ok };
      await writeFile(`${OUT}/${stamp}.json`, JSON.stringify(report, null, 2));
      process.exitCode = ok ? 0 : 1;
      return;
    }

    if (DRIFT_ONLY) {
      if (SHOTS) {
        await page.evaluate(() => window.__vg.shot());
        await page.screenshot({ path: `${OUT}/${stamp}.baseline.png` });
      }
      await writeFile(`${OUT}/${stamp}.json`, JSON.stringify(report, null, 2));
      log(`\n[vg_frame] drift-only run written to ${OUT}/${stamp}.json`);
      process.exitCode = report.faults.length ? 1 : 0;
      return;
    }
    if (report.faults.length) {
      log(`\n🔴 ${report.faults.length} control fault(s) — measuring anyway, but the numbers below are NOT quotable.`);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SCENES
    // ═══════════════════════════════════════════════════════════════════════════
    const byIdx = Object.fromEntries(fighters.map((f) => [f.i, f]));
    for (const [name, scene] of Object.entries(SCENES)) {
      if (ONLY && !ONLY.includes(name)) continue;
      const events = scene.build(byIdx);
      const victimIds = scene.targets.map((t) => byIdx[t].id);
      log(`\n══ SCENE ${name} ═══════════════════════════════════════════════════════`);
      log(`  ${scene.what}`);
      log(`  ${events.length} event(s) · victims ${victimIds.join(', ')}`);

      /** One seeded pass. Returns the slice series and the peak slice. */
      const runSeed = async (seedVal) => {
        await page.evaluate(() => window.__vg.reset());
        await page.evaluate(() => window.__vg.step(1200));   // run the previous scene to death
        await page.evaluate(() => window.__vg.reset());
        await page.evaluate(([w]) => window.__vg.warm(w), [WARM]);
        await page.evaluate(([sv]) => window.__vg.seed(sv), [seedVal]);
        await page.evaluate(() => window.__vg.step(16));
        await page.evaluate(() => window.__vg.setBase());

        const f = await page.evaluate(([evs]) => window.__vg.fire(evs), [events]);
        // ⚠️ The counter key is per SOURCE KIND (`feel_census`'s keying), so the null arm's
        // hazard hits land in `hit-landed:hazard` and counting only `:weapon` would report
        // 0/1 reached for a scene that fired perfectly — a fault message about the one
        // scene whose whole job is to come back clean.
        const kinds = [...new Set(events.map((e) => `hit-landed:${e.source.kind}`))];
        const reached = kinds.reduce((acc, k) => acc + ((f.after?.[k] ?? 0) - (f.before?.[k] ?? 0)), 0);

        const ser = [];
        let prevMs = 0;
        for (const ms of SLICES) {
          const stepMs = ms - prevMs; prevMs = ms;
          await page.evaluate(([d]) => window.__vg.step(d), [stepMs]);
          const m = await page.evaluate(([v]) => window.__vg.measure(v), [victimIds]);
          const c = await page.evaluate(() => window.__vg.census());
          ser.push({ ms, ...m, census: c });
        }
        return { seed: seedVal, reached, series: ser };
      };

      const passes = [];
      for (const sv of SEEDS) passes.push(await runSeed(sv));

      /**
       * 🚨 REPEAT — AND THE CLAIM THAT SEEDING MAKES THIS PAIRED IS FALSE HERE.
       *
       * The first version of this block asserted `wv_area.mjs`'s SEEDPAIR contract —
       * *"same weapon, same arm, same seed, twice -> byte-identical series"* — and it
       * **FAILED on the very first run**: same scene, same seed, twice, gave a different
       * slice series. Reported rather than tuned away, because the reason generalises:
       *
       *   `Math.random` is NOT the only state a VFX frame depends on. `vfx.ts` and
       *   `vfx/weapons/*` hand out meshes and materials from module-level ROUND-ROBIN
       *   POOLS (`materialPool()`), and **`VfxLayer.clear()` removes the objects without
       *   resetting the pool PHASE.** So pass 2 of an identical scene starts at a
       *   different point in every pool than pass 1, and seeding the PRNG cannot reach
       *   that.
       *
       * ⚠️ So `wv_area`'s *"after seeding, POINTING drift went 15.4% -> 0.0%"* does not
       * generalise to a multi-effect match frame, and a probe that assumed it would have
       * quoted a cross-tree delta as EXACT when it is not. **The floor here is built from
       * REPEATS**, which sweep seed AND pool phase together — `DECISIONS §62`'s rule that
       * a floor comes from a null arm rather than a formula.
       *
       * What the seed still buys, and is still asserted: it must CHANGE something. A seed
       * that reaches nothing is indistinguishable from a correct null result.
       */
      const p0 = passes[0];
      const sig = (pp) => pp.series.map((r) => r.n).join(',');
      const distinct = new Set(passes.map(sig)).size;
      const variesWithSeed = distinct > 1;
      report.scenes[name] = report.scenes[name] ?? {};
      report.scenes[name].repeatControl = { passes: passes.length, distinctSeries: distinct, variesWithSeed };
      log(`  REPEAT    ${passes.length} passes · ${distinct} distinct series`
        + ` · the seed/pool phase CHANGES the frame: ${variesWithSeed ? 'yes' : '🔴 NO — the sweep reaches nothing'}`);
      if (!variesWithSeed) fault(`scene ${name}: all ${passes.length} passes are byte-identical — the seed sweep reaches nothing, so the "floor" below is 0 by construction and is not a floor`);

      const got = p0.reached;
      if (got !== events.length) fault(`scene ${name}: ${got} of ${events.length} events reached handleEvents`);

      const series = p0.series;
      if (!series.length) { fault(`scene ${name}: EMPTY slice series`); continue; }
      const nonEmpty = series.filter((s) => !s.empty);
      if (!nonEmpty.length) {
        fault(`scene ${name}: every slice is EMPTY — the scene delivered NOTHING and any "no change" here is vacuous`);
        report.scenes[name] = { ...report.scenes[name], what: scene.what, events: events.length, eventsReached: got, passes, series, peak: null };
        continue;
      }
      const peak = nonEmpty.reduce((a, b) => (b.n > a.n ? b : a));

      // WITHIN-ARM SPREAD across seeds, at the peak slice index — the floor.
      const peakIdx = series.indexOf(peak);
      const acrossSeeds = passes.map((pp) => pp.series[peakIdx]).filter((r) => r && !r.empty);
      let spread = null;
      if (acrossSeeds.length >= 2) {
        const ns = acrossSeeds.map((r) => r.n);
        const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
        // Every metric this file will quote gets its own floor. Quoting a floor for the
        // AREA and then acting on a dLuma delta would be CLAUDE.md #10's exact failure:
        // a floor stated for one quantity and applied to another.
        const stat = (vals) => {
          const m = vals.reduce((a, b) => a + b, 0) / vals.length;
          return { vals, mean: +m.toFixed(5), range: +(Math.max(...vals) - Math.min(...vals)).toFixed(5) };
        };
        spread = {
          n: ns, mean: +mean.toFixed(1),
          range: Math.max(...ns) - Math.min(...ns),
          rangePctOfMean: +(100 * (Math.max(...ns) - Math.min(...ns)) / mean).toFixed(1),
          dLuma: stat(acrossSeeds.map((r) => r.dLuma)),
          structAfter: stat(acrossSeeds.map((r) => r.structAfter)),
          lumaAfter: stat(acrossSeeds.map((r) => r.lumaAfter)),
          hue: stat(acrossSeeds.map((r) => r.hue)),
          victimPct: Object.fromEntries(victimIds.map((v) => [v,
            stat(acrossSeeds.map((r) => r.victims[v]?.pct ?? 0))])),
        };
        log(`  FLOOR     painted at ${peak.ms} ms over ${SEEDS.length} passes: ${ns.join(', ')} px`
          + ` — mean ${spread.mean}, range ${spread.range} px = ${spread.rangePctOfMean}% of mean.`);
        log(`            dLuma ${spread.dLuma.mean} +/- ${spread.dLuma.range} · struct ${spread.structAfter.mean} +/- ${spread.structAfter.range}`
          + ` · hue ${spread.hue.mean} +/- ${spread.hue.range}`);
        log(`            🔴 THESE ARE THE RESOLUTION FLOORS FOR THIS SCENE. A between-tree difference smaller than one is NOT a finding.`);
      }

      log(`\n  ${pad('ms', 6)}${rp('painted', 9)}${rp('% frame', 9)}${rp('dLuma', 9)}${rp('struct', 9)}${rp('sub', 9)}  ${victimIds.map((v) => rp(v.slice(0, 6), 8)).join('')}`);
      for (const s of series) {
        if (s.empty) { log(`  ${pad(s.ms, 6)}${rp(0, 9)}`); continue; }
        log(`  ${pad(s.ms, 6)}${rp(s.n, 9)}${rp(s.pct.toFixed(3), 9)}${rp(s.dLuma.toFixed(4), 9)}`
          + `${rp(s.structAfter.toFixed(4), 9)}${rp(s.structBefore.toFixed(4), 9)}  `
          + victimIds.map((v) => rp(s.victims[v]?.pct === null ? '-' : `${s.victims[v]?.pct?.toFixed(1)}%`, 8)).join(''));
      }
      log(`  peak at ${peak.ms} ms: ${peak.n} px (${peak.pct}% of frame) · hue ${peak.hue} · sat ${peak.sat} · luma ${peak.lumaAfter} over substrate ${peak.lumaBefore}`);
      const maxC = series.reduce((acc, r) => {
        if (!r.census) return acc;
        return {
          particles: Math.max(acc.particles, r.census.particles ?? 0), particleCap: r.census.particleCap,
          rings: Math.max(acc.rings, r.census.rings ?? 0), ringCap: r.census.ringCap,
          wedges: Math.max(acc.wedges, r.census.wedges ?? 0), wedgeCap: r.census.wedgeCap,
        };
      }, { particles: 0, rings: 0, wedges: 0, particleCap: null, ringCap: null, wedgeCap: null });
      report.scenes[name].peakCensus = maxC;
      const sat = (n, cap) => (cap && n >= cap ? ' 🔴 SATURATED — allocation STEALS a live slot' : '');
      log(`  peak pool use: particles ${maxC.particles}/${maxC.particleCap}${sat(maxC.particles, maxC.particleCap)}`
        + ` · rings ${maxC.rings}/${maxC.ringCap}${sat(maxC.rings, maxC.ringCap)}`
        + ` · wedges ${maxC.wedges}/${maxC.wedgeCap}${sat(maxC.wedges, maxC.wedgeCap)}`);

      // hue-contract rule 2, judged at the peak.
      for (const v of victimIds) {
        const r = peak.victims[v];
        if (!r || r.empty) {
          // Not a fault when the seat is simply outside this framing — see the SEATMAP
          // note. It IS unjudgeable, and it is printed as unjudgeable rather than silently
          // dropped, because a missing row reads as a passing row.
          const offFrame = (report.controls.seatMapVerdict?.unevaluated ?? []).includes(v);
          if (offFrame) log(`    rule 2  ${pad(v, 11)} UNJUDGEABLE — off frame at this camera, matte is 0 px`);
          else fault(`scene ${name}: victim ${v} has an EMPTY matte at peak but IS on frame — rule 2 cannot be judged and the reason is unknown`);
          continue;
        }
        const ultimate = name === 'giant5';
        const bar = ultimate ? 100 : 33.3;
        const verdict = r.pct > bar ? '🔴 OVER' : 'ok';
        log(`    rule 2  ${pad(v, 11)} repaints ${rp(r.pct.toFixed(1), 6)}% of its own ${r.matteN} px matte  (bar ${bar}%${ultimate ? ', ULTIMATE — exempt' : ''})  ${verdict}`);
      }

      /**
       * 🚨 THE JUDGEMENT PNGs, AT FIXED TIMES — AND THE FIRST VERSION PHOTOGRAPHED
       *    NOTHING AT ALL.
       *
       * The shot used to be taken where this block sits, i.e. after the LAST slice
       * (650 ms), by which time every one-shot in `vfx.ts` is dead: the `giant5` PNG was
       * pixel-for-pixel the empty baseline and the `soup2` PNG showed two stray noodle
       * strands. Five judgement images of a VFX change with no VFX in them, and every
       * numeric row in the run was correct — which is exactly why CLAUDE.md #3 is a rule
       * about OPENING the image and not about producing it.
       *
       * Shot at FIXED times rather than at each arm's own peak, deliberately: the two arms
       * peak at different slices, so peak-vs-peak PNGs would be two different instants and
       * could not be laid side by side. 150 ms and 320 ms bracket every peak measured here.
       */
      if (SHOTS) {
        for (const shotMs of SHOT_MS) {
          await page.evaluate(() => window.__vg.reset());
          await page.evaluate(([w]) => window.__vg.warm(w), [WARM]);
          await page.evaluate(([sv]) => window.__vg.seed(sv), [SEEDS[0]]);
          await page.evaluate(() => window.__vg.step(16));
          await page.evaluate(([evs]) => window.__vg.fire(evs), [events]);
          await page.evaluate(([d]) => window.__vg.step(d), [shotMs]);
          await page.evaluate(() => window.__vg.shot());
          await page.screenshot({ path: `${OUT}/${stamp}.${name}.t${shotMs}.png` });
        }
        await page.evaluate(() => window.__vg.reset());
      }
      report.scenes[name] = {
        ...report.scenes[name],
        what: scene.what, events: events.length, eventsReached: got,
        victims: victimIds, series, peak, peakIdx, passes, spread,
      };
    }

    // A clean baseline frame, for the eye.
    if (SHOTS) {
      await page.evaluate(() => window.__vg.reset());
      await page.evaluate(() => window.__vg.step(1200));
      await page.evaluate(() => window.__vg.shot());
      await page.screenshot({ path: `${OUT}/${stamp}.baseline.png` });
    }

    await writeFile(`${OUT}/${stamp}.json`, JSON.stringify(report, null, 2));
    log(`\n[vg_frame] ${OUT}/${stamp}.json  (${report.faults.length} fault(s))`);
    if (report.faults.length) exitCode = 1;
  } finally {
    await browser.close();
  }
  process.exitCode = exitCode;
}

if (IS_MAIN) {
  await main();
}
