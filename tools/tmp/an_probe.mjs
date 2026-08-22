#!/usr/bin/env node
/**
 * AN_PROBE — what the SCULPT delivers, what the ANCHOR delivers, and how ALIKE the
 * 27 bespoke impacts read. The exploration instrument behind `an_guard.mjs`.
 *
 * ── WHY IT EXISTS: THE ONE NUMBER NOBODY HAD ────────────────────────────────────
 *
 * `a42224c` derived `IMPACT_ANCHOR_K = 0.50` from a two-sided bound — floor below,
 * "subordinate must stay a MINORITY" above — and measured the upper bound as
 * **anchor / GENERIC**. That is the burst the anchor replaced. What ships is
 * **anchor / COMPOSITE**, and those are different denominators: at `a494f98` the
 * generic ratio sits at 0.32-0.48 (green on every row of `wi_guard` arm C) while the
 * composite share runs to **0.88**. The rule was written about dominance of the hit;
 * the guard measured dominance of a burst that is not on screen.
 *
 * To fix that you need the quantity NEITHER tool measured: **what the bespoke sculpt
 * delivers ON ITS OWN, on this tree.** `209e270`'s per-weapon sculpt column is the
 * only prior record of it and it was captured through `__vfxSpawnTest`'s
 * zero-direction bug — the state `a42224c` §2 fixed, and which that commit itself
 * measured at *"eleven of twenty-seven differ by more than 5%, up to 34%"*. So the
 * SHORT16 list every derivation since has rested on describes frames the game does
 * not draw. This tool re-measures it with the shipped call.
 *
 * ── ARMS (each a separate fire of the same weapon on the same seed) ─────────────
 *
 *   shipped   registry and anchor untouched          -> the composite that ships
 *   sculpt    `impactAnchor` returns for 'subordinate'  -> the hand-authored hook ALONE
 *             (literally `a42224c`'s pre-fix control flow, re-installed in-page)
 *   anchor    `impact()` replaced by a hook that DRAWS NOTHING but IS CALLED
 *   generic   `impact()` deleted off the registry     -> the shipped generic fallback
 *   cand:<n>  `impactAnchor` swapped for candidate recipe <n>, hook untouched
 *   candA:<n> the same candidate with the hook no-op'd -> that candidate ALONE
 *
 * ── HOMOGENISATION IS NOT AN AREA QUESTION, SO THERE IS A SECOND METRIC ─────────
 *
 * `209e270` measured area's rank correlation with legibility at **0.230**. The
 * complaint this tool exists for is *"every weapon's impact reads more alike"*, which
 * area cannot express at all — 27 identical frames and 27 wildly different ones can
 * have the same mean area. So every arm also returns its PEAK-SLICE MASK, bit-packed
 * at the full 800x450 readback, and the tool reports the mean pairwise **IoU** across
 * the 27 weapons plus the mean colour of each weapon's changed region. A shared
 * anchor raises IoU by construction; that is the point.
 *
 * ⚠️ IoU is a proxy and it is NOT the verdict. Read the PNGs (`wi_shot.mjs`, both
 * pitches) — CLAUDE.md #3. IoU is here so a change in sameness can be stated as a
 * number with a known-bad behind it, not so it can replace looking.
 *
 * ── CONTROLS (CLAUDE.md #6) ─────────────────────────────────────────────────────
 *
 *   NULL       frozen frame vs itself x3            -> 0 px EXACTLY, not "small"
 *   RNG        seeded LCG reproducible, non-constant -> or every ratio is unpaired
 *   FORCED     a garish oversized generic impact     -> >> 0, or the counter is blind
 *   REACH      the planted no-op hook must be CALLED, and the suppressed anchor must
 *              have been ENTERED — a zero that was never reached describes nothing
 *   RESTORE    hook set + prototype read back after every arm
 *   SELF-PAIR  candidate `cur` re-implements the SHIPPED recipe from outside. Its
 *              `candA:cur` arm must equal the `anchor` arm **EXACTLY, to the pixel**.
 *              If it does not, every other candidate number is of a recipe this tool
 *              got wrong, and no amount of internal consistency would show it.
 *   NON-EMPTY  every set is asserted non-empty BEFORE anything is asserted over it
 *              (`[].every()` returns true — that vacuity has fired repeatedly here).
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-an-head -- \
 *     node tools/tmp/an_probe.mjs --url '{URL}' --pitch 58 --out tools/tmp/an_out/p58
 *   ... --cands cur,k035,mark100      candidate recipes to sweep
 *   ... --pairsculpt                  🚨 REQUIRED for any candidate comparison — holds
 *                                     the sculpt bit-identical across arms. Without it
 *                                     a candidate that only REMOVES elements can come
 *                                     out BIGGER, because the anchor's `Math.random()`
 *                                     draws shift the sculpt's own instance.
 *   ... --selfpair                    assert `candA:cur` == the tree's own anchor.
 *                                     Only valid on a tree that ships the `a42224c`
 *                                     recipe; on the tree that replaces it the two are
 *                                     SUPPOSED to differ. Printed either way.
 *   ... --multi lollipop.Giant        the 5-victim frame `3483d23` made reachable.
 *                                     Six seats via `?fighters=`, deliberately NOT on
 *                                     the arena centre — the centre prop swallows a
 *                                     ground-level effect and the FORCED control there
 *                                     read 0 px while the victims read 13,558.
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
if (!BASE) { console.error('an_probe: --url or PREVIEW_BASE required (never the shared dev server)'); process.exit(2); }
const OUT = String(args.out ?? 'tools/tmp/an_out/run');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** The per-channel step every area tool in this repo uses, so rows join to `wi_guard`. */
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
/** `wi_guard`'s schedule exactly — a `shipped` row here must equal a `shipped` row there. */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number) : [16, 80, 160, 260, 400]);
const SEED = Number(args.seed ?? 777);
const ARMS = String(args.arms ?? 'shipped,sculpt,anchor,generic').split(',').filter(Boolean);
const CANDS = args.cands ? String(args.cands).split(',').filter(Boolean) : [];
const ONLY = args.only ? String(args.only).split(',') : null;
const MULTI = args.multi ? String(args.multi) : null;
const MULTI_N = Number(args.multiN ?? 5);
const NO_MASKS = !!args.nomasks;
/**
 * 🚨 **WITHOUT THIS, A CANDIDATE ARM IS NOT PAIRED AT THE SCULPT.**
 * `spawnImpactBurst` runs the anchor BEFORE the bespoke hook, and every element of
 * `burst()` draws `Math.random()` — shard angles, speeds, offsets. A candidate that
 * spawns two fewer shards therefore leaves the seeded LCG in a DIFFERENT STATE when
 * the sculpt runs, so the sculpt itself comes out different. Measured on the first
 * sweep: `lollipop.Giant` moved 2900 -> 3041 px on a candidate that only REMOVED
 * elements, which is impossible for a strict subset and is the whole tell.
 * `wv_area.mjs` records that unchanged code measured twice spreads ~15% for exactly
 * this reason. `--pairsculpt` re-seeds immediately after the anchor draws, in EVERY
 * arm identically, so the sculpt is bit-identical across arms and the only thing that
 * varies is the anchor. It changes nothing about the shipped code path.
 */
const PAIR_SCULPT = !!args.pairsculpt;

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

/**
 * CANDIDATE RECIPES — the shapes being priced, expressed as arguments to the SHIPPED
 * `burst()` rather than as a re-implementation of it (`wv_area.mjs`'s rule: an auditor
 * that reimplements what it audits measures its own copy).
 *
 * `cur` reproduces `vfx.ts:impactAnchor` as shipped and exists ONLY as the self-pair
 * control — it must come out bit-identical to the `anchor` arm.
 *
 *   k          multiplies `sizeFactor`, exactly as `IMPACT_ANCHOR_K` does
 *   shardK     multiplies the shard COUNT (shipped: the same k). `0` means none.
 *   skip*      passed straight through to `burst()`'s existing `opts`
 */
/**
 * 🚨 **`k` CANNOT SHRINK THE ANCHOR'S BIGGEST ELEMENT, AND THAT IS WHY LOWERING IT
 * DOES NOT WORK.** `burst()` sizes the star ground decal as
 * `clamp(0.65 * sizeFactor, 0.55, 1.5)`, and `impactAnchor` applies `k` inside
 * `sizeFactor`. At `k = 0.50` that inner term is `0.65 * (0.42 + 0.075*d) * 0.5`,
 * which reaches the 0.55 FLOOR only at `d >= 17` — so **26 of the 27 bespoke weapons
 * draw an identically-sized 0.55-radius star mark**, the same on a 2-damage chip as on
 * a 16-damage smash, and no value of `k` moves any of them. `decalMin` is the knob
 * that does, so the sweep carries it.
 */
const RECIPES = {
  cur: { k: 0.50, shardK: 0.50 },
  k040: { k: 0.40, shardK: 0.40 },
  k035: { k: 0.35, shardK: 0.35 },
  k025: { k: 0.25, shardK: 0.25 },
  // GROUND MARK ONLY: the weapon-coloured star decal + the two weapon-coloured rings.
  // Drops the additive white-mixed flash and BOTH gold layers (streaks + shards),
  // which are `burst()`'s own "distinct bright layer" and are the same colour and the
  // same shape vocabulary on all 27 weapons.
  mark100: { k: 1.00, shardK: 0, skipFlash: true, skipStreaks: true },
  mark075: { k: 0.75, shardK: 0, skipFlash: true, skipStreaks: true },
  mark050: { k: 0.50, shardK: 0, skipFlash: true, skipStreaks: true },
  // The same, with the decal floor released so `k` can actually reach it.
  mk50f25: { k: 0.50, shardK: 0, skipFlash: true, skipStreaks: true, decalMin: 0.25 },
  mk50f18: { k: 0.50, shardK: 0, skipFlash: true, skipStreaks: true, decalMin: 0.18 },
  mk65f25: { k: 0.65, shardK: 0, skipFlash: true, skipStreaks: true, decalMin: 0.25 },
  // Ground mark + the flash, still no gold, decal floor released.
  mkf50f25: { k: 0.50, shardK: 0, skipStreaks: true, decalMin: 0.25 },
  mkf65f25: { k: 0.65, shardK: 0, skipStreaks: true, decalMin: 0.25 },
  mkf50f18: { k: 0.50, shardK: 0, skipStreaks: true, decalMin: 0.18 },
  // `k` lowered AND the decal floor released, everything else kept — isolates the
  // floor release from the gold-layer removal.
  k50f25all: { k: 0.50, shardK: 0.50, decalMin: 0.25 },
  k35f18all: { k: 0.35, shardK: 0.35, decalMin: 0.18 },
  // ── THE SHORTLIST, after the first sweep ────────────────────────────────────
  // What that sweep showed: at k = 0.50 the anchor's delivered AREA is essentially
  // the two rings. Dropping the flash and BOTH gold layers moved `burrito.Swarm`'s
  // anchor 534 -> 533 px — one pixel — because those elements land inside the rings'
  // own footprint. So removing them is **free on the floor** and removes the only
  // layer that is the same COLOUR and the same SHAPE on all 27 weapons. `k` is then
  // the one lever that moves area, and it moves it through the ring radius
  // `0.6*sf*k + 0.35`, which is AFFINE — halving k takes the rim to 72% of its
  // radius, not 50%.
  mk25f12: { k: 0.25, shardK: 0, skipFlash: true, skipStreaks: true, decalMin: 0.12 },
  mk35f18: { k: 0.35, shardK: 0, skipFlash: true, skipStreaks: true, decalMin: 0.18 },
  mk45f22: { k: 0.45, shardK: 0, skipFlash: true, skipStreaks: true, decalMin: 0.22 },
  mkf35f18: { k: 0.35, shardK: 0, skipStreaks: true, decalMin: 0.18 },
};

/** CSS keyframes run on the document timeline; freezing rAF does not still them. */
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'an-still';
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
async function installHarness(page, rw, rh, delta, recipes) {
  await page.evaluate(([RWv, RHv, D, REC]) => {
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
    const b64 = (bytes) => {
      let s = '';
      for (let i = 0; i < bytes.length; i += 4096) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
      }
      return btoa(s);
    };
    window.__an = {
      total: RWv * RHv,
      recipes: REC,
      setBase() { base = grab(); },
      /** Changed-pixel count AND, optionally, the packed mask + mean colour of the
       * changed region. One readback serves both, so the mask costs no extra render. */
      measure(withMask) {
        const cur = grab();
        const n = RWv * RHv;
        const bits = withMask ? new Uint8Array(Math.ceil(n / 8)) : null;
        let cnt = 0, sr = 0, sg = 0, sb = 0;
        for (let p = 0, i = 0; p < n; p++, i += 4) {
          const d = Math.max(
            Math.abs(cur[i] - base[i]),
            Math.abs(cur[i + 1] - base[i + 1]),
            Math.abs(cur[i + 2] - base[i + 2]),
          );
          if (d >= D) {
            cnt++; sr += cur[i]; sg += cur[i + 1]; sb += cur[i + 2];
            if (bits) bits[p >> 3] |= (1 << (p & 7));
          }
        }
        return {
          px: cnt,
          rgb: cnt ? [Math.round(sr / cnt), Math.round(sg / cnt), Math.round(sb / cnt)] : null,
          mask: bits ? b64(bits) : null,
        };
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
  }, [rw, rh, delta, recipes]);
}
/* eslint-enable */

/**
 * ONE ARM. Every mutation is installed on the PROTOTYPE, fired once, and read back —
 * `restored` carries the proof rather than the assumption.
 *
 * `arm`:
 *   'shipped' | 'sculpt' | 'anchor' | 'generic' | 'cand:<name>' | 'candA:<name>'
 */
/* eslint-disable */
async function fireRow(page, { id, key, arm, at, seed, slices, withMask, multi, pair }) {
  return page.evaluate(async ([w, sl, wantMask, multiPts]) => {
    const rules = await import('/src/game/rules.ts');
    const reg = await import('/src/vfx/weapons/index.ts');
    const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };
    const v = reg.getWeaponVfx(w.id, w.key);
    const before = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];

    const layer = window.__vfxLayer;
    const proto = Object.getPrototypeOf(layer);
    if (typeof proto.impactAnchor !== 'function') return { err: 'impactAnchor is not on the prototype' };
    if (typeof proto.burst !== 'function') return { err: 'burst is not on the prototype' };
    if (typeof proto.spawnTransientObject !== 'function') return { err: 'spawnTransientObject is not on the prototype' };
    if (typeof proto.spawnImpactStarDecal !== 'function') return { err: 'spawnImpactStarDecal is not on the prototype — the decalMin candidates would silently draw NO decal at all' };

    const realAnchor = proto.impactAnchor;
    const realTransient = proto.spawnTransientObject;
    const realImpact = v && typeof v.impact === 'function' ? v.impact : null;
    const armKind = w.arm.split(':')[0];
    const recipeName = w.arm.split(':')[1] ?? null;

    let noopCalls = 0;         // the planted DRAWS-NOTHING hook was entered
    let anchorCalls = 0;       // impactAnchor was entered at all
    let subordinateCalls = 0;  // ...with role === 'subordinate'
    let transientCount = 0;    // Object3Ds the bespoke hook handed to spawnTransient
    let sculptProxy = 0;       // sum of r^2 over those objects' bounding spheres
    let reseeds = 0;

    // ── SCULPT PAIRING ──────────────────────────────────────────────────────────
    // Re-seed after the anchor draws so the bespoke hook starts from the same LCG
    // state in every arm. Wrapped around whatever `impactAnchor` each arm installs,
    // below, and applied to ALL arms or not at all.
    const seedAfter = (fn) => (w.pair
      ? function (...a) { const r = fn.apply(this, a); if (a[3] === 'subordinate') { window.__rng.seed(w.seed); reseeds++; } return r; }
      : fn);

    // ── the ablations ───────────────────────────────────────────────────────────
    if ((armKind === 'anchor' || armKind === 'candA') && realImpact) v.impact = () => { noopCalls++; };
    if (armKind === 'generic' && realImpact) delete v.impact;

    if (armKind === 'sculpt') {
      // `a42224c`'s pre-fix control flow, verbatim: the bespoke branch ran and the
      // anchor was never reached.
      proto.impactAnchor = seedAfter(function (o, c, a, role) {
        anchorCalls++;
        if (role === 'subordinate') { subordinateCalls++; return; }
        return realAnchor.call(this, o, c, a, role);
      });
    } else if (armKind === 'cand' || armKind === 'candA') {
      const R = window.__an.recipes[recipeName];
      if (!R) return { err: `no recipe ${recipeName}` };
      proto.impactAnchor = seedAfter(function (o, c, amount, role) {
        anchorCalls++;
        if (role !== 'subordinate') return realAnchor.call(this, o, c, amount, role);
        subordinateCalls++;
        // The SHIPPED formulas, with k applied exactly where `impactAnchor` applies it.
        const sf = Math.min(2.0, Math.max(0.42, 0.42 + amount * 0.075)) * R.k;
        const baseShards = Math.min(8, Math.max(2, 1 + amount * 0.4));
        const shards = R.shardK === 0 ? 0 : Math.max(2, Math.round(baseShards * R.shardK));
        const opts = {};
        if (R.skipFlash) opts.skipFlash = true;
        if (R.skipRing) opts.skipRing = true;
        if (R.skipStreaks) opts.skipStreaks = true;
        if (R.skipDecal) opts.skipDecal = true;
        // A DECAL FLOOR OVERRIDE has to be drawn outside `burst()`, because the
        // shipped `burst()` hard-codes `clamp(0.65*sf, 0.55, 1.5)` and ignores any
        // opt it does not know. Same call, same formula, same life expression — only
        // the lower clamp differs, so the candidate is still the SHIPPED decal.
        if (R.decalMin !== undefined) {
          opts.skipDecal = true;
          const rad = Math.min(1.5, Math.max(R.decalMin, 0.65 * sf));
          this.spawnImpactStarDecal(o, c, rad, 0.55 + sf * 0.08);
        }
        return this.burst(o, c, sf, shards, opts);
      });
    } else {
      proto.impactAnchor = seedAfter(function (o, c, a, role) {
        anchorCalls++;
        if (role === 'subordinate') subordinateCalls++;
        return realAnchor.call(this, o, c, a, role);
      });
    }

    /**
     * The two in-frame signals `vfx.ts` could size an ADAPTIVE anchor from, recorded
     * so the idea can be priced rather than asserted:
     *   transientCount  how many Object3Ds the hook handed to `spawnTransient`
     *   sculptProxy     sum of r^2 over those objects' bounding spheres, in the
     *                   object's own scale at SPAWN — which is the only moment
     *                   `spawnImpactBurst` could read it, and is BEFORE any
     *                   `onUpdate` has run.
     */
    proto.spawnTransientObject = function (obj, life, onUpdate, owner) {
      transientCount++;
      try {
        obj.traverse((n) => {
          const g = n.geometry;
          if (!g) return;
          if (!g.boundingSphere) g.computeBoundingSphere();
          const bs = g.boundingSphere;
          if (!bs) return;
          const s = Math.max(Math.abs(n.scale.x), Math.abs(n.scale.y), Math.abs(n.scale.z))
            * Math.max(Math.abs(obj.scale.x), Math.abs(obj.scale.y), Math.abs(obj.scale.z));
          const r = bs.radius * s;
          sculptProxy += r * r;
        });
      } catch { /* a hook may hand over something exotic; the proxy is best-effort */ }
      return realTransient.call(this, obj, life, onUpdate, owner);
    };

    window.__an.reset();
    window.__an.step(0);
    window.__an.setBase();
    window.__rng.seed(w.seed);
    // The shipped call `match.ts:handleEvents` makes for a weapon hit, attacker
    // position included — NOT `__vfxSpawnTest`, whose zero-direction state is the one
    // `a42224c` §2 fixed.
    const pts = multiPts && multiPts.length ? multiPts : [{ x: w.x, y: w.y }];
    for (const p of pts) {
      layer.spawnImpactBurst(p.x, p.y, weapon.color, weapon.damage,
        { weapon, characterId: w.id, fromXWU: p.x - 60, fromYWU: p.y });
    }

    const series = [];
    let peak = { px: -1, rgb: null, mask: null };
    let peakAt = -1;
    let prev = 0;
    for (const t of sl) {
      window.__an.step(t - prev); prev = t;
      const m = window.__an.measure(wantMask);
      series.push(m.px);
      if (m.px > peak.px) { peak = m; peakAt = t; }
    }
    window.__an.reset();

    // ── restore, and read it back ───────────────────────────────────────────────
    proto.impactAnchor = realAnchor;
    proto.spawnTransientObject = realTransient;
    if (realImpact) v.impact = realImpact;
    const after = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];

    return {
      series, peakPx: peak.px, peakAt, rgb: peak.rgb, mask: peak.mask,
      noopCalls, anchorCalls, subordinateCalls, transientCount, reseeds,
      sculptProxy: +sculptProxy.toFixed(4),
      damage: weapon.damage, fires: pts.length,
      restored: before.join(',') === after.join(',')
        && (!realImpact || v.impact === realImpact)
        && proto.impactAnchor === realAnchor
        && proto.spawnTransientObject === realTransient,
    };
  }, [{ id, key, arm, x: at.x, y: at.y, seed, pair: !!pair }, slices, !!withMask, multi ?? null]);
}
/* eslint-enable */

/** Bit-packed masks -> intersection-over-union. */
function iou(a, b) {
  const A = Buffer.from(a, 'base64');
  const B = Buffer.from(b, 'base64');
  const n = Math.min(A.length, B.length);
  let inter = 0; let uni = 0;
  for (let i = 0; i < n; i++) {
    const x = A[i]; const y = B[i];
    let iAnd = x & y; let iOr = x | y;
    while (iAnd) { inter += iAnd & 1; iAnd >>= 1; }
    while (iOr) { uni += iOr & 1; iOr >>= 1; }
  }
  return uni ? inter / uni : 0;
}

/** Mean pairwise IoU over a set of masks — the "how alike do these read" number. */
function meanPairIoU(masks) {
  let s = 0; let n = 0;
  for (let i = 0; i < masks.length; i++) {
    for (let j = i + 1; j < masks.length; j++) { s += iou(masks[i], masks[j]); n++; }
  }
  return n ? s / n : null;
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
    const url = MULTI
      // ⚠️ NOT the arena centre. The first attempt put the swinger on 1400,1000 and the
      // FORCED control there measured **0 px** while the victim ring 140 wu away
      // measured 13,558 — the arena's centre prop swallows a ground-level effect whole.
      // A control that reads 0 because it is INSIDE A POT is `docs/LESSONS.md`'s
      // mis-aimed-station class, and it is only visible because the control was there.
      ? `${BASE}/?fighters=lollipop@800,700;donut@800,560;taco@940,700;egg@660,700;sushi@800,840;pizza@900,600&simSpeed=0.0001&pointerLock=0`
      : `${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__vfxDebugFighters, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const running = await page.evaluate(PAGE_STILL_HUD);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);
    await installHarness(page, RW, RH, DELTA, RECIPES);
    if (PITCH !== 58) {
      const saved = await page.evaluate(([p, w]) => window.__an.setPitch(p, w), [PITCH, DETECT_WIDTH]);
      log(`camera: re-pitched ${saved.pitch} -> ${PITCH} deg, frameMode ${saved.mode} -> ground, width ${saved.width} -> ${DETECT_WIDTH} wu`);
    }
    log(`\nviewport ${W}x${H}  readback ${RW}x${RH}  delta>=${DELTA}  pitch ${PITCH}  seed ${SEED}  slices ${SLICES.join(',')}`);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);

    const fighters = await page.evaluate(() => {
      const f = window.__vfxDebugFighters;
      return { player: { x: f.player.x, y: f.player.y }, slots: (f.slots ?? []).map((s) => ({ x: s.x, y: s.y })) };
    });
    const at = fighters.player;
    log(`fighters: ${fighters.slots.length} seat(s); hit point ${at.x.toFixed(0)},${at.y.toFixed(0)}`);

    // ── the multi-victim frame (`3483d23`) ──────────────────────────────────────
    let multiPts = null;
    if (MULTI) {
      // Seats 1..N are the victims; seat 0 is the swinger. `3483d23` makes ONE press
      // emit one `hit-landed` per opponent in the arc, so `match.ts` calls
      // `spawnImpactBurst` once per victim IN THE SAME FRAME.
      multiPts = fighters.slots.slice(1, 1 + MULTI_N);
      if (multiPts.length < MULTI_N) {
        bad(`--multi wanted ${MULTI_N} victims and the session produced ${multiPts.length} — the multi frame below is NOT the frame 3483d23 makes reachable`);
      }
      log(`multi: ${multiPts.length} victim(s) at ${multiPts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' · ')}`);
    }

    // ── the set under test ──────────────────────────────────────────────────────
    const roster = await page.evaluate(async () => {
      const rules = await import('/src/game/rules.ts');
      const reg = await import('/src/vfx/weapons/index.ts');
      const rows = [];
      for (const [id, c] of Object.entries(rules.CHARACTERS)) {
        for (const w of c.weapons) {
          const v = reg.getWeaponVfx(id, w.key);
          rows.push({ id, key: w.key, damage: w.damage, hasImpact: !!(v && typeof v.impact === 'function') });
        }
      }
      return rows;
    });
    const bespoke = roster.filter((w) => w.hasImpact && (!ONLY || ONLY.includes(`${w.id}.${w.key}`) || ONLY.includes(w.id)));
    log(`roster: ${roster.length} weapons, ${roster.filter((w) => w.hasImpact).length} carrying a bespoke impact() hook`);

    // ══ NON-VACUITY, BEFORE ANYTHING IS ASSERTED OVER A FILTERED SET ══════════
    if (!roster.length) bad('roster is EMPTY — every number below would be vacuous');
    if (!bespoke.length) bad('NO weapon carries a bespoke impact() hook — every arm below would be vacuous');
    const allArms = [...ARMS, ...CANDS.flatMap((c) => [`cand:${c}`, `candA:${c}`])];
    if (!allArms.length) bad('no arms requested — --arms and --cands are both empty');
    for (const c of CANDS) if (!RECIPES[c]) bad(`unknown recipe '${c}' — known: ${Object.keys(RECIPES).join(',')}`);

    // ══ CONTROLS ══════════════════════════════════════════════════════════════
    log(`\n══ CONTROLS ═══════════════════════════════════════════════════════════`);
    const nulls = await page.evaluate(() => {
      window.__an.setBase();
      return [window.__an.measure(false).px, window.__an.measure(false).px, window.__an.measure(false).px];
    });
    log(`NULL      frozen frame vs itself x3: ${nulls.join(', ')} px  (want 0,0,0)`);
    if (nulls.some((n) => n !== 0)) bad(`NULL control non-zero (${nulls.join(',')}) — every area below is a difference of two DIFFERENT frames, not a measurement of an effect`);

    const rngOk = await page.evaluate(() => window.__rng.selftest());
    log(`RNG       seeded LCG reproducible and non-constant: ${rngOk}`);
    if (!rngOk) bad('RNG control failed — every ratio below is unpaired');

    // FORCED fires where the ROWS fire, not where seat 0 happens to stand — see the
    // multi URL above for what the difference cost.
    const forcedAt = multiPts && multiPts.length ? multiPts[0] : at;
    const forced = await page.evaluate(async ([f]) => {
      window.__an.reset(); window.__an.step(0); window.__an.setBase();
      window.__vfxSpawnTest('impact', f.x, f.y, 30, '#FF00FF');
      window.__an.step(160);
      const n = window.__an.measure(false).px;
      window.__an.reset();
      return n;
    }, [forcedAt]);
    log(`FORCED    garish 30-damage generic impact at ${forcedAt.x.toFixed(0)},${forcedAt.y.toFixed(0)}: ${forced} px  (want >> 0)`);
    if (forced < 400) bad(`FORCED control ${forced} px — this instrument cannot see a deliberately enormous effect`);

    // ══ THE TABLE ═════════════════════════════════════════════════════════════
    log(`\n══ per weapon x arm ═══════════════════════════════════════════════════`);
    const head = [pad('weapon', 20), rpad('dmg', 4), rpad('trans', 6), ...allArms.map((a) => rpad(a.replace('cand:', 'C:').replace('candA:', 'A:'), 11))];
    log(head.join(''));
    const rows = [];
    for (const w of bespoke) {
      const cells = {};
      const masks = {};
      let transientCount = null;
      let sculptProxy = null;
      let rowErr = null;
      for (const arm of allArms) {
        const r = await fireRow(page, {
          ...w, arm, at, seed: SEED, slices: SLICES, withMask: !NO_MASKS, multi: multiPts, pair: PAIR_SCULPT,
        });
        if (r.err) { rowErr = r.err; break; }
        if (!r.restored) bad(`${w.id}.${w.key} [${arm}]: RESTORE failed — every later arm is measuring a leaked ablation`);
        // REACH, per arm and specific to what that arm ablates.
        const kind = arm.split(':')[0];
        if ((kind === 'anchor' || kind === 'candA') && !r.noopCalls) {
          bad(`${w.id}.${w.key} [${arm}]: REACH — the planted no-op hook was never called, so this arm is measuring the REAL sculpt`);
        }
        if (kind === 'sculpt' && !r.subordinateCalls) {
          bad(`${w.id}.${w.key} [${arm}]: REACH — impactAnchor was never entered with role 'subordinate', so nothing was suppressed and this arm is the composite`);
        }
        if ((kind === 'cand' || kind === 'candA') && !r.subordinateCalls) {
          bad(`${w.id}.${w.key} [${arm}]: REACH — the candidate recipe was never entered, so this column describes the SHIPPED anchor`);
        }
        cells[arm] = r.peakPx;
        if (r.mask) masks[arm] = r.mask;
        if (kind === 'shipped') { transientCount = r.transientCount; sculptProxy = r.sculptProxy; }
        // ⚠️ NOT `!r.reseeds` alone. The `generic` arm has NO bespoke hook, so its
        // anchor runs as 'primary' and legitimately never re-seeds — asserting over
        // it made every generic row red on the first paired run. Excluding it by KIND
        // rather than by `subordinateCalls` keeps the assertion non-vacuous: both
        // counters increment on the same event, so `subordinateCalls && !reseeds`
        // could never be true and would have been a comment with a tick next to it.
        if (PAIR_SCULPT && kind !== 'generic' && !r.reseeds) {
          bad(`${w.id}.${w.key} [${arm}]: --pairsculpt asked for a re-seed and NONE happened — this arm's sculpt is NOT paired with the others`);
        }
        if (multiPts && r.fires !== multiPts.length) bad(`${w.id}.${w.key} [${arm}]: fired ${r.fires} impacts, wanted ${multiPts.length}`);
      }
      if (rowErr) { bad(`${w.id}.${w.key}: ${rowErr}`); continue; }
      rows.push({ id: w.id, key: w.key, damage: w.damage, transientCount, sculptProxy, px: cells, masks });
      log([pad(`${w.id}.${w.key}`, 20), rpad(w.damage, 4), rpad(transientCount ?? '-', 6),
        ...allArms.map((a) => rpad(cells[a] ?? '-', 11))].join(''));
    }

    // A non-vacuity check on the MEASURED set, not the intended one.
    if (!rows.length) bad('no row was measured — every summary below would be over an empty set');
    else if (rows.length !== bespoke.length) bad(`${rows.length} rows measured of ${bespoke.length} intended`);

    // ══ SELF-PAIR: the candidate machinery re-implements the SHIPPED recipe ════
    // If `candA:cur` is not EXACTLY the `anchor` arm, this tool's candidate columns
    // describe recipes it got wrong, and nothing else here could reveal that.
    // 🚨 **SELF-PAIR IS ONLY A CONTROL ON A TREE THAT SHIPS THE `cur` RECIPE.**
    // It asserts that this tool's re-implementation of `a42224c`'s anchor matches the
    // anchor the tree actually draws. On the tree AFTER that anchor is replaced the two
    // are SUPPOSED to differ — running it there turned a passing control into a
    // guaranteed red and stamped a valid table `not quotable`. So it is opt-in: pass
    // `--selfpair` on `a494f98` (or any tree at `a42224c`), where it read 27/27 EXACT.
    // Off, the comparison is still PRINTED, because a silent control is no control.
    if (CANDS.includes('cur') && ARMS.includes('anchor')) {
      const pairs = rows.filter((r) => r.px.anchor !== undefined && r.px['candA:cur'] !== undefined);
      if (!pairs.length) bad('SELF-PAIR: no row carries both `anchor` and `candA:cur` — the control would be vacuous');
      else {
        const off = pairs.filter((r) => r.px.anchor !== r.px['candA:cur']);
        log(`\nSELF-PAIR  candA:cur vs anchor: ${pairs.length - off.length}/${pairs.length} EXACT`
          + `${args.selfpair ? '  (ASSERTED — this tree must ship the a42224c recipe)' : '  (printed only; pass --selfpair on a pre-fix tree to assert it)'}`);
        if (off.length && args.selfpair) {
          bad(`SELF-PAIR: ${off.length} row(s) where the re-implemented shipped recipe differs from the shipped anchor `
            + `(${off.slice(0, 4).map((r) => `${r.id}.${r.key} ${r.px.anchor} vs ${r.px['candA:cur']}`).join('; ')}) — every candidate column is of a recipe this tool got wrong`);
        }
      }
    } else if (CANDS.length) {
      log(`\nSELF-PAIR  NOT RUN — needs both --arms ...,anchor and --cands cur,... . Candidate columns below are UNVALIDATED.`);
    }

    // ══ SHARES + SAMENESS ═════════════════════════════════════════════════════
    const share = (r, num, den) => (r.px[den] ? r.px[num] / r.px[den] : null);
    const summarize = (label, anchorArm, compositeArm) => {
      const set = rows.filter((r) => r.px[anchorArm] !== undefined && r.px[compositeArm] !== undefined);
      if (!set.length) { log(`${label}: no rows — NOT REPORTED rather than reported as 0`); return null; }
      const shares = set.map((r) => share(r, anchorArm, compositeArm)).filter((x) => x !== null);
      if (!shares.length) { log(`${label}: every denominator was 0 — NOT REPORTED`); return null; }
      const majority = shares.filter((x) => x > 0.5).length;
      const comps = set.map((r) => r.px[compositeArm]);
      const masks = set.map((r) => r.masks[compositeArm]).filter(Boolean);
      const mIoU = masks.length >= 2 ? meanPairIoU(masks) : null;
      const out = {
        label, n: set.length,
        minComposite: Math.min(...comps),
        minCompositeRow: set[comps.indexOf(Math.min(...comps))] && `${set[comps.indexOf(Math.min(...comps))].id}.${set[comps.indexOf(Math.min(...comps))].key}`,
        shareMin: Math.min(...shares), shareMax: Math.max(...shares),
        shareMed: shares.slice().sort((a, b) => a - b)[Math.floor(shares.length / 2)],
        majority, meanIoU: mIoU,
      };
      log(`${pad(label, 26)} n=${out.n}  minComposite ${rpad(out.minComposite, 5)} (${out.minCompositeRow})  `
        + `anchor/composite ${out.shareMin.toFixed(3)}-${out.shareMax.toFixed(3)} med ${out.shareMed.toFixed(3)}  `
        + `majority ${out.majority}/${out.n}  meanIoU ${mIoU === null ? 'n/a' : mIoU.toFixed(4)}`);
      return out;
    };
    log(`\n══ SHARES (anchor / COMPOSITE — the denominator the design rule names) ═`);
    const summaries = [];
    if (ARMS.includes('anchor') && ARMS.includes('shipped')) summaries.push(summarize('SHIPPED (k=0.50)', 'anchor', 'shipped'));
    for (const c of CANDS) summaries.push(summarize(`cand ${c}`, `candA:${c}`, `cand:${c}`));

    // Sculpt-alone is the quantity the whole design turns on, so it gets its own block.
    if (ARMS.includes('sculpt')) {
      const set = rows.filter((r) => r.px.sculpt !== undefined);
      if (!set.length) log(`\nSCULPT-ALONE: no rows — NOT REPORTED`);
      else {
        const under = set.filter((r) => r.px.sculpt < 300);
        const masks = set.map((r) => r.masks.sculpt).filter(Boolean);
        log(`\n══ SCULPT ALONE (the pre-anchor composite, measured with the SHIPPED call) ═`);
        log(`${under.length} of ${set.length} bespoke sculpts deliver under 300 px on their own:`);
        for (const r of set.slice().sort((a, b) => a.px.sculpt - b.px.sculpt)) {
          log(`  ${pad(`${r.id}.${r.key}`, 20)} ${rpad(r.px.sculpt, 6)} px${r.px.sculpt < 300 ? '   ← UNDER THE FLOOR ALONE' : ''}`);
        }
        if (masks.length >= 2) log(`  sculpt-only meanIoU across ${masks.length} weapons: ${meanPairIoU(masks).toFixed(4)}  (the sameness floor with NO shared anchor)`);
      }
    }

    await writeFile(`${OUT}/an_probe.p${PITCH}${MULTI ? '.multi' : ''}.json`, JSON.stringify({
      pitch: PITCH, seed: SEED, slices: SLICES, delta: DELTA, arms: allArms, recipes: RECIPES,
      multi: multiPts, summaries,
      pairSculpt: PAIR_SCULPT,
      rows: rows.map((r) => ({ id: r.id, key: r.key, damage: r.damage, transientCount: r.transientCount, sculptProxy: r.sculptProxy, px: r.px })),
      failures: failMsg,
    }, null, 1));
    if (!NO_MASKS) {
      await writeFile(`${OUT}/an_masks.p${PITCH}${MULTI ? '.multi' : ''}.json`, JSON.stringify({
        pitch: PITCH, w: RW, h: RH,
        rows: rows.map((r) => ({ id: r.id, key: r.key, masks: r.masks })),
      }));
    }

    log(`\n${'─'.repeat(72)}`);
    log(`${fail ? `🔴 an_probe: ${fail} CONTROL/REACH FAILURE(S) — the table above is not quotable` : `✅ an_probe: ${rows.length} weapons x ${allArms.length} arms, every control green`}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    process.exitCode = fail ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
