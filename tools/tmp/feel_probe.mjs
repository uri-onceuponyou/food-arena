#!/usr/bin/env node
/**
 * FEEL PROBE — what a hit actually DELIVERS, per channel, at shipped framing.
 *
 * The companion to `tools/tmp/feel_census.mjs`. That one is the DENOMINATOR (which
 * `GameEvent`s the sim emits, over 110 matches, in Node); this is the NUMERATOR (what
 * the renderer did about one, in the real game, measured in pixels and metres).
 *
 * ── Why it drives `window.__feelEvent` and not `window.__vfxSpawnTest` ──────────
 *
 * A hit is a MULTI-CHANNEL event: impact burst + camera kick + hit-stop + knockback +
 * damage number, all arbitrated inside `match.ts:handleEvents`. `__vfxSpawnTest` fires
 * exactly one VFX effect, so a probe built on it measures a composition it assembled
 * itself rather than the one the player sees. This project has already paid for that
 * distinction twice: Giant Lollipop was three separately-measured passes that together
 * repainted 85.3% of the player, and `spawnWeaponCast` exists because the arbitration
 * has to live somewhere that can see the sum (`docs/LESSONS.md` §7).
 *
 * `__feelEvent` takes a whole `GameEvent` and runs the SHIPPED handler. So this
 * measures the code that ships, not a copy of it.
 *
 * ── Why every number here is a COUNTER, never a frame time ──────────────────────
 *
 * This environment rasterises on SwiftShader (a CPU rasteriser). `docs/LESSONS.md` §10
 * records it flatly: frame time cannot be measured here and any fps figure is fiction.
 * Everything below is a property of the framebuffer or of the scene graph — changed
 * pixels, metres of camera translation, milliseconds of withheld sim time, event and
 * response counts — and is identical on any GPU.
 *
 * ── The three channels are measured SEPARATELY, on purpose ──────────────────────
 *
 * A camera kick translates the whole frame, so it changes ~100% of pixels and would
 * swamp any burst measurement taken in the same frame. So the pixel diff is taken with
 * the shake offset forced to zero, and the kick is measured analytically by projecting
 * one world point through the camera with and without the offset. Reported as two
 * numbers because they are two channels; summing them would be meaningless.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/feel_probe.mjs --url {URL}
 *   node tools/tmp/feel_probe.mjs --url $URL --selftest      # known-input validation
 *   node tools/tmp/feel_probe.mjs --url $URL --match         # live coverage audit only
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
const OUT = String(args.out ?? 'shots/feel');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Per-pixel change threshold on the largest channel, 0-255. 6 is ~2.4% and is the
 * same threshold `tools/tmp/vfx_coverage.mjs` validated against a frozen frame. */
const DELTA = Number(args.delta ?? 6);
/**
 * Frame numbers, after the event, at which the frame is measured. 60 fps frames, not
 * milliseconds, because the harness hand-cranks the real loop one frame at a time
 * (see `__feel.step`) — and because `match.ts:loop` clamps `getDelta()` at 50 ms, so
 * a "slice" larger than one frame would not be a slice the game can take.
 *
 * 1..27 covers the whole life of a hit: the impact burst is ~350 ms (21 frames), the
 * character hit flash is 260 ms (16 frames), and hit-stop plus its catch-up resolves
 * inside the first 6.
 */
const FRAMES = (args.frames ? String(args.frames).split(',').map(Number) : [1, 2, 3, 5, 8, 12, 18, 27]);
/**
 * The damage ladder. These are the census's own percentiles plus the authored
 * extremes, so every number below is a statement about damage the game actually
 * deals rather than about a range someone imagined:
 *   2  — the smallest authored damage in `rules.ts`
 *   4  — p25 of real `hit-landed` amounts (feel_census, 110 matches, band policy)
 *   6  — median
 *   9  — p75
 *   16 — p95
 *   18 — the largest authored damage in `rules.ts`
 */
const LADDER = (args.ladder ? String(args.ladder).split(',').map(Number) : [2, 4, 6, 9, 16, 18]);
/** Rungs that also get a judgement PNG. The whole point of this probe is that the
 * PNG gets LOOKED AT — judging a description instead of an image is this project's
 * most common failure — so it shoots the smallest, the median and the largest hit,
 * which is the comparison "one tone, monotonic" is a claim about. */
const SHOT = (args.shot ? String(args.shot).split(',').map(Number) : [2, 6, 18]);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);

async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });

  // A peer saving into this repo triggers a Vite full reload that wipes in-page state
  // mid-probe (docs/TOOLS.md). Stub the HMR client.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));

  // Virtual clock, exactly as `vfx_coverage.mjs` does it: `THREE.Clock` reads
  // `performance.now()`, so pausing it freezes the whole game loop's dt at 0 and
  // `advance(ms)` hand-cranks it in exact slices. A real sleep cannot do this — an
  // impact burst is sub-350 ms and SwiftShader readback is ~100 ms, so a probe that
  // sleeps measures whatever survived the shutter.
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    performance.now = () => (paused ? virt : realNow() - base);
    window.__clk = {
      pause() { if (!paused) { virt = realNow() - base; paused = true; } },
      resume() { if (paused) { base = realNow() - virt; paused = false; } },
      advance(ms) { virt += ms; },
    };
  });
}

/** The in-page harness. Kept in one `evaluate` so every helper closes over the same
 * canvas/baseline, and so the whole thing is greppable as one block. */
async function installHarness(page) {
  await page.evaluate(([rw, rh, delta]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let base = null;
    const rig = stage.rig;

    /** Grab a frame with the camera shake suppressed, then put the shake back.
     *
     * `shakeOffset`/`shakeAmount` are TypeScript-private, which is a compile-time
     * fiction — at runtime they are ordinary fields. Suppressing is deliberate and is
     * the only honest way to separate the two channels: a shake translates the entire
     * frame, so a burst measured under one is measuring the camera.
     *
     * ⚠️ The SAVE/RESTORE is load-bearing and its absence was caught by this file's
     * own known-input validation on the first run: without it, `diff()` destroyed the
     * shake before `kickPx()` could read it and the probe reported "camera kick 0 px"
     * for the loudest hit in the game — a confident, entirely wrong answer about the
     * channel it exists to measure (`docs/LESSONS.md` §13). */
    const grab = () => {
      const a = rig.shakeAmount;
      const off = rig.shakeOffset.clone();
      rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
      stage.render(0);
      ctx.clearRect(0, 0, rw, rh);
      ctx.drawImage(stage.canvas, 0, 0, rw, rh);
      const data = ctx.getImageData(0, 0, rw, rh).data;
      rig.shakeAmount = a; rig.shakeOffset.copy(off); rig.apply();
      return data;
    };

    /** Screen-space box (in READBACK pixels) around a fighter, sized to the
     * character's real on-screen footprint. Used to split "the burst landed on the
     * victim" from "the burst landed on the floor next to it" — and to hold the
     * readability constraint that an ordinary hit must not repaint the thing it is
     * giving feedback about (`vfx.ts`'s hue-contract rule 2; Giant Lollipop at 85.3%
     * is the case that rule exists for). */
    const fighterBox = (role, grow = 1) => {
      const f = window.__vfxDebugFighters?.[role];
      if (!f) return null;
      const p = window.__vfxDebugScreen?.[role];
      if (!p) return null;
      const rect = stage.canvas.getBoundingClientRect();
      // The character is ~10.5% of frame height (measured off a rendered frame, not
      // by trigonometry — `docs/LESSONS.md` §6). Box a little wider than tall so a
      // side-facing pose is contained.
      const hPx = rect.height * 0.105;
      const cx = ((p.x - rect.left) / rect.width) * rw;
      const cy = ((p.y - rect.top) / rect.height) * rh;
      const halfH = (hPx / rect.height) * rh;
      const halfW = halfH * 0.75;
      // The projected point is the fighter's FEET (height 0), so the body is above it.
      const yc = cy - 0.9 * halfH;
      return {
        x0: Math.max(0, Math.round(cx - halfW * grow)), x1: Math.min(rw - 1, Math.round(cx + halfW * grow)),
        y0: Math.max(0, Math.round(yc - 1.1 * halfH * grow)), y1: Math.min(rh - 1, Math.round(yc + 1.1 * halfH * grow)),
      };
    };

    window.__feel = {
      fighterBox,
      setBase() { base = grab(); return base.length / 4; },
      /**
       * Changed pixels vs the baseline, in three nested scopes.
       *
       * ⚠️ WHOLE-FRAME is NOT the headline and must not be quoted as one. The sim
       * keeps running while this probe cranks frames, so the enemy walks in from
       * 1090 wu, the safe ring closes and the arena's ambient motion continues —
       * measured, that drift reached 5.4x the entire impact signal by the twelfth
       * case of a run, and it made the SAME event report 4,339 px in one part of this
       * file and 23,523 px in another. A whole-frame counter cannot tell an impact
       * from an opponent arriving.
       *
       * `region` is the answer: a box ~2.5x the character, centred on the impact. Big
       * enough to contain the whole burst (the largest measured is about one character
       * across) and small enough that nothing else in the arena is inside it. `box` is
       * the character's own footprint, which is what the readability constraint is
       * about — an effect that repaints the thing it is giving feedback about has
       * stopped being feedback (`vfx.ts`'s hue contract, rule 2).
       */
      diff(box, region) {
        const cur = grab();
        let n = 0, sum = 0, inBox = 0, boxTotal = 0, inRegion = 0, regionTotal = 0, regionSum = 0;
        // WHITEOUT counter. A changed-pixel count is STRUCTURALLY BLIND to the failure
        // the judgement PNGs actually showed: an additive white effect over a victim
        // that is already flashing white pushes pixels that were bright to clipping,
        // which destroys the character's readable form while changing very few pixel
        // VALUES. So count, separately, how much of the victim's own box is at or near
        // full white on all three channels. This is the number that says whether the
        // feedback is hiding the thing it is feeding back about.
        let clipBox = 0;
        for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
          const d = Math.max(
            Math.abs(cur[i] - base[i]),
            Math.abs(cur[i + 1] - base[i + 1]),
            Math.abs(cur[i + 2] - base[i + 2]),
          );
          const x = p % rw, y = (p / rw) | 0;
          const inB = box && x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
          const inR = region && x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
          if (inB) {
            boxTotal++;
            if (cur[i] >= 246 && cur[i + 1] >= 246 && cur[i + 2] >= 246) clipBox++;
          }
          if (inR) regionTotal++;
          if (d >= delta) {
            n++; sum += d;
            if (inB) inBox++;
            if (inR) { inRegion++; regionSum += d; }
          }
        }
        return {
          n, meanDelta: n ? +(sum / n).toFixed(1) : 0,
          inBox, boxTotal, boxShare: boxTotal ? +(inBox / boxTotal).toFixed(3) : 0,
          inRegion, regionTotal, regionMeanDelta: inRegion ? +(regionSum / inRegion).toFixed(1) : 0,
          clipBox, clipShare: boxTotal ? +(clipBox / boxTotal).toFixed(3) : 0,
        };
      },
      /**
       * The camera kick, in SCREEN PIXELS, computed rather than photographed.
       *
       * `camera.ts:apply()` adds `shakeOffset` to BOTH the eye and the look-at, so a
       * kick is a pure translation of the camera. Its on-screen size is therefore
       * exactly how far a fixed world point moves in NDC between offset-zero and
       * offset-at-amplitude — no readback, no threshold, no sampling luck. Reported at
       * the shake's own peak amplitude with the offset placed on its corner
       * (`+a, +0.4a, +a`, the largest vector `update()` can produce) so the number is
       * a bound, and labelled as one.
       */
      kickPx() {
        const a = rig.shakeAmount;
        if (!(a > 0)) return { amountM: 0, px: 0 };
        const rect = stage.canvas.getBoundingClientRect();
        const saved = rig.shakeOffset.clone();
        const probe = new (rig.camera.position.constructor)(rig.target.x, 0, rig.target.z);
        rig.shakeOffset.set(0, 0, 0); rig.apply();
        const p0 = probe.clone().project(rig.camera);
        rig.shakeOffset.set(a, a * 0.4, a); rig.apply();
        const p1 = probe.clone().project(rig.camera);
        rig.shakeOffset.copy(saved); rig.apply();
        const dx = (p1.x - p0.x) * 0.5 * rect.width;
        const dy = (p1.y - p0.y) * 0.5 * rect.height;
        return { amountM: +a.toFixed(4), px: +Math.hypot(dx, dy).toFixed(1) };
      },
      /** World units of fair-play radius a kick of `amountM` costs, worst case. */
      kickWu() { return +(rig.shakeAmount / 0.05).toFixed(2); },   // WORLD_SCALE = 0.05 m/wu

      /**
       * DELIVERED vs POSSIBLE pixels for the live burst — i.e. the occlusion ratio.
       *
       * `docs/LESSONS.md` §1 is seventeen cases of "it isn't there" meaning "it IS
       * there and is INVISIBLE", and case 8 is this exact shape: correctly-sized
       * geometry spawned inside the target, so the target ate the middle and the
       * effect rendered as disconnected shards. The only way to tell that apart from
       * "the effect is too small" is to render it again with depth testing off and
       * compare — which is what `tools/tmp/vfx_ablate.mjs` exists for, and what
       * `vfx.ts`'s own stun-star note quotes ("an ablation put the occlusion ratio at
       * 1.01x, i.e. nothing was hiding them").
       *
       * `filter`: 'all' | 'decal' (renderOrder 5 = the wedge pool, which is the impact
       * star ground mark) | 'nodecal'. SAVE/RESTORE is mandatory — these are POOLED
       * materials the shipped game reuses forever, and a `depthTest = false` left
       * behind would silently inflate every measurement after it.
       */
      occlusion(box, region, filter) {
        let layer = null;
        stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
        if (!layer) return null;
        const isDecal = (o) => o.isMesh && o.renderOrder === 5;
        const saved = [];
        layer.traverse((o) => {
          if ((!o.isSprite && !o.isMesh) || !o.visible) return;
          saved.push({ o, depthTest: o.material?.depthTest, renderOrder: o.renderOrder });
        });
        const keepOf = (o) => filter === 'all' || (filter === 'decal' ? isDecal(o) : !isDecal(o));
        for (const s of saved) s.o.visible = keepOf(s.o);
        const delivered = window.__feel.diff(box, region);
        for (const s of saved) {
          if (!s.o.visible || !s.o.material) continue;
          s.o.material.depthTest = false;
          s.o.renderOrder = 999;
        }
        const possible = window.__feel.diff(box, region);
        for (const s of saved) {
          s.o.visible = true;
          if (s.o.material) s.o.material.depthTest = s.depthTest;
          s.o.renderOrder = s.renderOrder;
        }
        return {
          delivered: delivered.inRegion, possible: possible.inRegion,
          ratio: delivered.inRegion > 0 ? +(possible.inRegion / delivered.inRegion).toFixed(2) : null,
        };
      },
      /**
       * The VFX LAYER'S OWN delivered footprint, by same-instant ablation.
       *
       * ⚠️ THIS EXISTS BECAUSE `diff()` IS STRUCTURALLY SATURATED FOR THIS QUESTION,
       * and the saturation is measurable rather than theoretical. `diff()` counts
       * pixels that differ from a PRE-EVENT baseline, and a `hit-landed` moves three
       * things inside the same box at the same time: the impact burst, the
       * character's white hit flash (`characters/types.ts:applyHitFlash`) and the
       * knockback that displaces the whole silhouette. A pixel the flash has already
       * changed cannot be changed a second time by the burst, so the burst's
       * contribution is only ever counted where it lands OUTSIDE the flash.
       *
       * The proof is in this file's own PART 3, on HEAD, and it is unambiguous:
       *
       *     fog    2 dmg (flash only, NO world VFX)   3904 px
       *     weapon 2 dmg (flash PLUS the whole burst) 3879 px
       *
       * Adding an entire impact burst moved the counter by −25 px, i.e. by less than
       * the 197 px idle noise floor. The same counter also made `occlusion()` report
       * ratios BELOW 1.00 (0.92-0.97), which is arithmetically impossible for a real
       * occlusion ratio and is the tell that it was saturating.
       *
       * So the burst is measured against ITSELF instead of against a stale baseline:
       * render the frame, hide the selected VFX objects, render again, and count the
       * pixels that moved between those two renders. Both captures are the same
       * instant of the same frozen frame, so the character flash, the knockback, the
       * fog ring's drift and every other sim motion are IDENTICAL in both and cancel
       * exactly. What is left is the VFX layer's delivered, occlusion-correct
       * footprint — the quantity "how big is this hit's effect" was always meant to
       * be.
       *
       * `filter`: 'all' | 'decal' (renderOrder 5, the impact star ground mark) |
       * 'rings' (6) | 'sprites' (10/11 — flash, streaks, shards). Per-element numbers
       * are MARGINAL contributions and do not sum to 'all' where elements overlap;
       * 'all' is the headline.
       *
       * SAVE/RESTORE is mandatory and is checked by a control (`vfxIsoRestoreOk`):
       * `vfx/weapons/*` hands out materials from module-level pools that outlive
       * `clear()`, and f12c9de records a restore bug in exactly this shape silently
       * inflating every later row of a probe in this family.
       */
      vfxIso(box, region, filter) {
        let layer = null;
        stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
        if (!layer) return null;
        const ro = (o) => o.renderOrder;
        const wanted = [];
        layer.traverse((o) => {
          if ((!o.isSprite && !o.isMesh) || !o.visible) return;
          if (filter === 'all'
            || (filter === 'decal' && ro(o) === 5)
            || (filter === 'rings' && ro(o) === 6)
            || (filter === 'sprites' && (ro(o) === 10 || ro(o) === 11))) wanted.push(o);
        });
        const a = grab();
        for (const o of wanted) o.visible = false;
        const b = grab();
        for (const o of wanted) o.visible = true;
        let region_ = 0, box_ = 0, boxTotal = 0, regionTotal = 0, sum = 0;
        for (let i = 0, p = 0; i < a.length; i += 4, p++) {
          const x = p % rw, y = (p / rw) | 0;
          const inB = box && x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
          const inR = region && x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
          if (inB) boxTotal++;
          if (inR) regionTotal++;
          if (!inR && !inB) continue;
          const d = Math.max(
            Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]),
          );
          if (d < delta) continue;
          if (inR) { region_++; sum += d; }
          if (inB) box_++;
        }
        return {
          region: region_, box: box_, regionTotal, boxTotal,
          boxShare: boxTotal ? +(box_ / boxTotal).toFixed(3) : 0,
          meanDelta: region_ ? +(sum / region_).toFixed(1) : 0,
          objects: wanted.length,
        };
      },
      /**
       * RULE 1 OF THE HUE CONTRACT, measured at the instant it is about — and it has
       * never been measurable before, because both of its operands move during a hit.
       *
       * `game/vfx.ts` requires a transient combat effect to clear "the cast's measured
       * luma (0.302) by >= 0.15 in HSL lightness, UPWARD". 0.302 is a figure from a
       * frame with NO hit in it. At the only instant the rule matters the victim is
       * also flashing white, so the rule was being checked against a cast luma that is
       * false exactly when it counts — which is why the predecessor pass tried to drop
       * the burst's white-mix, could not observe any difference, and reverted.
       *
       * Both operands are read here from ONE frame, mid-hit, by ablation: the burst
       * population is the pixels that move when the VFX layer is hidden, the cast
       * population is the pixels that move when the character models are hidden (then
       * eroded twice, so no antialiased boundary pixel counts as cast). The luma of the
       * cast is therefore the FLASHED cast, which is the surface the burst actually
       * lands on.
       */
      rule1() {
        let layer = null;
        stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
        const vfx = [];
        if (layer) layer.traverse((o) => { if ((o.isSprite || o.isMesh) && o.visible) vfx.push(o); });
        const casts = [];
        stage.scene.traverse((o) => { if (typeof o.name === 'string' && o.name.startsWith('character:') && o.visible) casts.push(o); });
        if (!vfx.length || !casts.length) return null;
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
          return [h, d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
        };
        const stats = (img, idx) => {
          let sx = 0, sy = 0, ss = 0, sl = 0;
          for (const p of idx) {
            const i = p * 4;
            const [h, s, l] = hsl(img[i], img[i + 1], img[i + 2]);
            const a = (h * Math.PI) / 180;
            sx += Math.cos(a) * s; sy += Math.sin(a) * s; ss += s; sl += l;
          }
          const n = idx.length || 1;
          let hm = (Math.atan2(sy, sx) * 180) / Math.PI; if (hm < 0) hm += 360;
          return { n: idx.length, hue: +hm.toFixed(1), sat: +(ss / n).toFixed(3), luma: +(sl / n).toFixed(4) };
        };
        const maskOf = (a, b) => {
          const out = [];
          for (let i = 0, p = 0; i < a.length; i += 4, p++) {
            const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
            if (d >= delta) out.push(p);
          }
          return out;
        };
        const shipped = grab();
        for (const o of vfx) o.visible = false;
        const noVfx = grab();
        for (const o of vfx) o.visible = true;
        const burstIdx = maskOf(shipped, noVfx);
        for (const o of casts) o.visible = false;
        const noCast = grab();
        for (const o of casts) o.visible = true;
        // Erode the cast mask twice so the population is pure cast, not boundary blend.
        const set = new Uint8Array(rw * rh);
        for (const p of maskOf(shipped, noCast)) set[p] = 1;
        for (let pass = 0; pass < 2; pass++) {
          const nxt = new Uint8Array(set.length);
          for (let y = 1; y < rh - 1; y++) {
            for (let x = 1; x < rw - 1; x++) {
              const p = y * rw + x;
              if (set[p] && set[p - 1] && set[p + 1] && set[p - rw] && set[p + rw]) nxt[p] = 1;
            }
          }
          set.set(nxt);
        }
        const castIdx = [];
        for (let p = 0; p < set.length; p++) if (set[p]) castIdx.push(p);
        if (!burstIdx.length || castIdx.length < 100) return null;
        const burst = stats(shipped, burstIdx);
        const cast = stats(shipped, castIdx);
        return { burst, cast, dL: +(burst.luma - cast.luma).toFixed(4) };
      },
      /** Count the currently-live VFX objects by class — a hardware-independent
       * complexity counter (peak concurrent particles / draws), so "more range" can
       * be shown not to have been bought with more objects. */
      vfxCensus() {
        let layer = null;
        stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
        if (!layer) return null;
        let decal = 0, rings = 0, sprites = 0, other = 0;
        layer.traverse((o) => {
          if ((!o.isSprite && !o.isMesh) || !o.visible) return;
          if (o.renderOrder === 5) decal++;
          else if (o.renderOrder === 6) rings++;
          else if (o.renderOrder === 10 || o.renderOrder === 11) sprites++;
          else other++;
        });
        return { decal, rings, sprites, other, total: decal + rings + sprites + other };
      },
      /**
       * Advance the WHOLE GAME by one 16.67 ms frame.
       *
       * ⚠️ This replaces an earlier version that advanced only `updateEffects` and
       * `rig.update`, and that version was WRONG in a way its own judgement PNGs
       * exposed: the character's hit flash lives on `BaseCharacter.hitT`, which is
       * advanced by the game loop's `model.update(dt)` and by nothing else. With the
       * loop frozen at dt 0, `play('hit')` pinned the victim at ~85% white EMISSIVE
       * for the rest of the probe run — so every subsequent baseline already
       * contained a whited-out character and the flash measured as 18 changed pixels,
       * i.e. as absent. That is `docs/LESSONS.md` §13 exactly: the harness inverted
       * the thing being measured.
       *
       * Cranking the real loop instead means hit-stop, the character flash, the VFX
       * pools and the camera all advance together, on the same clock, in the same
       * order the player gets them — which is the only way the SUM is measurable. dt
       * is one frame at 60 fps and must stay <= 50 ms, because `match.ts:loop` clamps
       * `getDelta()` there for simulation stability.
       */
      async step() {
        window.__clk.advance(1000 / 60);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
      /** Advance N frames. */
      async steps(n) { for (let i = 0; i < n; i++) await window.__feel.step(); },
      feel() { return JSON.parse(JSON.stringify(window.__feelDebug)); },
      counts() { return JSON.parse(JSON.stringify(window.__vfxQaCounts ?? {})); },
      /** Run every one-shot to death, then clear the pools. The frame advance is not
       * optional: the character hit flash (0.26 s) and the ward pop are owned by
       * `characters/types.ts` and `vfx.ts` respectively and neither is reachable from
       * `VfxLayer.clear()`. Without it a previous case's flash leaks into the next
       * case's baseline. */
      async reset() {
        await window.__feel.steps(24);        // 400 ms > flash 260 ms, > burst ~350 ms
        window.__vfxLayer.clear();
        rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
        await window.__feel.step();
      },
      fighters() { return JSON.parse(JSON.stringify(window.__vfxDebugFighters ?? {})); },
      /** Push the current scene to the REAL canvas so a `page.screenshot()` shows what
       * `diff()` just measured. `grab()` renders into an offscreen 2D canvas, so
       * without this a judgement PNG and its own number come from two different
       * frames — the exact "a mask from one render and a value from another" fault
       * `docs/LESSONS.md` §5 records. */
      stillFrame() { stage.render(0); },
    };
  }, [RW, RH, DELTA]);
}

/** Build the `hit-landed` event the shipped handler would receive. */
const WEAPON = String(args.weapon ?? 'Smash');
/**
 * ⚠️ WHICH WEAPON IS NOT A DETAIL. `spawnImpactBurst` looks up `getWeaponVfx()` and, if
 * that weapon has a bespoke `impact()` hook, the ENTIRE generic burst — flash, star
 * ground mark, both rings, streaks, shards — is replaced and never runs. Hamburger's
 * `Tomato` has one; `Smash` and `Lettuce` do not. A ladder run on `Tomato` therefore
 * measures one bespoke splash and says nothing about the path most weapons take, which
 * is exactly the mistake this file's first run made.
 */
function hitEvent(amount, x, y, kind = 'weapon', weaponKey = WEAPON, weaponName = weaponKey) {
  return {
    type: 'hit-landed',
    targetRole: 'player',
    amount,
    effect: 'none',
    source: kind === 'weapon' ? { kind: 'weapon', weaponKey, weaponName }
      : kind === 'trail' ? { kind: 'trail', ownerRole: 'enemy' }
        : { kind },
    x, y,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let failures = 0;
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);

    // ═══════════════════════════════════════════════════════════════════════════
    // PART 1 — the live coverage audit
    // ═══════════════════════════════════════════════════════════════════════════
    // A REAL match at high sim speed, so the census's event mix actually occurs, then
    // `__feelDebug` read once at the end. This is the half that answers "is there an
    // event with no visual response at all", which is the shape the audio pillar's
    // worst bug had (`match-ended` and the FINAL RING: no sound, ever).
    if (!args.frozen) {
      await page.goto(`${BASE}/?player=donut&enemy=hamburger&simSpeed=6&pointerLock=0`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
      await page.waitForFunction(() => !!window.__feelDebug, null, { timeout: 30000 });
      await page.waitForFunction(() => window.__matchDebug?.phase === 'ended', null, { timeout: 180000 })
        .catch(() => log('  (match did not reach "ended" in time — reporting what it had)'));
      const live = await page.evaluate(() => JSON.parse(JSON.stringify(window.__feelDebug)));
      log('\n══ PART 1 — LIVE COVERAGE AUDIT (one real match, simSpeed 6) ══════════════');
      log(`${pad('event', 34)}${pad('arrived', 10)}response`);
      log('-'.repeat(74));
      for (const [k, v] of Object.entries(live.events).sort((a, b) => b[1] - a[1])) {
        log(`${pad(k, 34)}${pad(v, 10)}${v === 0 ? '(not emitted this match)' : ''}`);
      }
      log(`\nresponses fired: ${JSON.stringify(live.responses)}`);
      log(`frames ${live.frames} · frozen ${live.frozenFrames} (${(100 * live.frozenFrames / Math.max(1, live.frames)).toFixed(1)}%)`
        + ` · repaying ${live.repayingFrames} (${(100 * live.repayingFrames / Math.max(1, live.frames)).toFixed(1)}%)`);
      log(`peak hit amount ${live.peakHitAmount} · peak shake ${live.peakShakeM.toFixed(3)} m`);
      await writeFile(`${OUT}/live-coverage.json`, JSON.stringify(live, null, 2));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PART 2 — the hand-cranked ladder
    // ═══════════════════════════════════════════════════════════════════════════
    // simSpeed 1 and the virtual clock PAUSED: the game advances only when this probe
    // says so, one 60 fps frame at a time, through the real loop. See `__feel.step`
    // for why cranking the real loop (rather than `updateEffects` alone) is the only
    // arrangement in which the character's hit flash, hit-stop and the VFX pools are
    // on the same clock — the earlier arrangement pinned the flash at maximum forever
    // and measured it as absent.
    /**
     * Boot a fresh match and freeze it on frame zero of `playing`.
     *
     * Called again between PART 2 and PART 3 rather than reusing one page. Every
     * cranked frame advances the SIM as well as the presentation, so a long run walks
     * the enemy in from 1090 wu and closes the safe ring; a fresh boot bounds total
     * drift per part instead of letting it accumulate across the whole probe. This is
     * the fix for the run in which the identical event measured 4,339 px in PART 2 and
     * 23,523 px in PART 3.
     */
    const freshMatch = async () => {
      await page.goto(`${BASE}/?player=donut&enemy=hamburger&simSpeed=1&pointerLock=0`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
      await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__feelEvent, null, { timeout: 60000 });
      // Wait for the countdown to finish IN REAL TIME before freezing — a paused clock
      // during `countdown` would hold the phase forever.
      await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120000 });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__clk.pause());
      await page.waitForTimeout(400);
      await installHarness(page);
    };
    await freshMatch();

    const fighters = await page.evaluate(() => window.__feel.fighters());
    const P = fighters.player;
    log(`\nplayer at (${P.x.toFixed(0)}, ${P.y.toFixed(0)}) wu · hp ${P.hp} · enemy `
      + `${Math.hypot(fighters.enemy.x - P.x, fighters.enemy.y - P.y).toFixed(0)} wu away`);

    // ── Instrument validation against KNOWN inputs (LESSONS §13) ────────────────
    // Believing a counter on an unknown input without first showing it answers a
    // known one correctly is how this session found ELEVEN instruments returning
    // confident wrong answers — two of them inside the very tool an agent was using
    // to judge its own work. This probe has now contributed two of its own.
    await page.evaluate(() => window.__feel.reset());
    const box = await page.evaluate(() => window.__feel.fighterBox('player'));
    const region = await page.evaluate(() => window.__feel.fighterBox('player', 2.5));
    const D = (b, r) => page.evaluate(([bb, rr]) => window.__feel.diff(bb, rr), [b, r]);
    await page.evaluate(() => window.__feel.setBase());
    // KNOWN INPUT A: the frozen scene against itself, and then one frame of it. The
    // second is the real noise floor — idle breathing, the fog ring's drift and the
    // arena's own ambient motion all still run.
    const nullDiff = await D(box, region);
    await page.evaluate(() => window.__feel.step());
    const idleDiff = await D(box, region);
    // KNOWN INPUT B: an event with, by design, NO world-space response at all.
    await page.evaluate(() => window.__feel.setBase());
    await page.evaluate(() => window.__feelEvent({ type: 'countdown-tick', value: 3 }));
    await page.evaluate(() => window.__feel.step());
    const inertDiff = await D(box, region);
    // KNOWN INPUT C: the largest hit in the game. If this does NOT move the counter,
    // every zero below is an instrument fault, not a finding.
    await page.evaluate(() => window.__feel.reset());
    await page.evaluate(() => window.__feel.setBase());
    await page.evaluate(([ev]) => window.__feelEvent(ev), [hitEvent(18, P.x, P.y)]);
    const loudKick = await page.evaluate(() => window.__feel.kickPx());
    await page.evaluate(() => window.__feel.steps(2));
    const loudDiff = await D(box, region);
    await page.evaluate(() => window.__feel.reset());

    log('\n══ INSTRUMENT VALIDATION (known inputs) ═══════════════════════════════════');
    log(`  region is ${region.x1 - region.x0}x${region.y1 - region.y0} readback px of ${RW}x${RH}`
      + ` (${(100 * loudDiff.regionTotal / (RW * RH)).toFixed(1)}% of frame); character box ${box.x1 - box.x0}x${box.y1 - box.y0}`);
    log(`${pad('', 36)}${pad('in-region', 12)}whole frame`);
    log(`  frozen frame vs itself           ${pad(nullDiff.inRegion, 12)}${nullDiff.n}   (want ~0)`);
    log(`  one idle frame — the NOISE FLOOR ${pad(idleDiff.inRegion, 12)}${idleDiff.n}   (want small in-region)`);
    log(`  countdown-tick (no world VFX)    ${pad(inertDiff.inRegion, 12)}${inertDiff.n}   (want ~noise)`);
    log(`  hit-landed, 18 dmg (the loudest) ${pad(loudDiff.inRegion, 12)}${loudDiff.n}   (want >> noise)`);
    log(`  camera kick from that hit        ${pad(loudKick.px + ' px', 12)}(want > 0)`);
    let instrumentOk = nullDiff.inRegion <= 40 && loudDiff.inRegion > Math.max(400, idleDiff.inRegion * 4) && loudKick.px > 0;
    log(instrumentOk ? '  → diff() VALID' : '  → diff() INVALID — every number below is untrustworthy');

    // ── VFX ISOLATION: four known-input controls before believing `vfxIso` ───────
    // The ablation counter has one failure mode that would be invisible in its own
    // output — leaving an object hidden, which reads as "the effect got smaller".
    // Control D is the direct test for it and it is the one f12c9de's restore bug
    // would have failed.
    const iso = (b, r, f) => page.evaluate(([bb, rr, ff]) => window.__feel.vfxIso(bb, rr, ff), [b, r, f]);
    await page.evaluate(() => window.__feel.reset());
    await page.evaluate(() => window.__feel.setBase());
    // A: an EMPTY vfx layer must ablate to nothing.
    const isoEmpty = await iso(box, region, 'all');
    // B: a fog hit fires the character flash and NO world VFX at all. This is the
    //    control that separates "the burst" from "the flash", and it is the one that
    //    exposes `diff()`'s saturation — `diff` reads thousands here, `vfxIso` must
    //    read ~0.
    await page.evaluate(([ev]) => window.__feelEvent(ev), [hitEvent(18, P.x, P.y, 'fog')]);
    await page.evaluate(() => window.__feel.steps(2));
    const fogDiff = await D(box, region);
    const isoFog = await iso(box, region, 'all');
    // C: the loudest weapon hit must ablate to a large positive number.
    await page.evaluate(() => window.__feel.reset());
    await page.evaluate(() => window.__feel.setBase());
    await page.evaluate(([ev]) => window.__feelEvent(ev), [hitEvent(18, P.x, P.y)]);
    await page.evaluate(() => window.__feel.steps(2));
    // D: RESTORE INTEGRITY. `diff` on both sides of a `vfxIso` must be identical —
    //    anything else means an object or a material was left modified.
    const beforeIso = await D(box, region);
    const isoLoud = await iso(box, region, 'all');
    const afterIso = await D(box, region);
    await page.evaluate(() => window.__feel.reset());

    log('\n══ INSTRUMENT VALIDATION — VFX ISOLATION (same-instant ablation) ══════════');
    log(`  A empty layer, nothing spawned        vfxIso ${pad(isoEmpty.region, 8)}(want ~0)`);
    log(`  B fog 18 dmg — FLASH, no world VFX    vfxIso ${pad(isoFog.region, 8)}(want ~0)   ·  diff() says ${fogDiff.inRegion}`);
    log(`  C weapon 18 dmg — the loudest burst   vfxIso ${pad(isoLoud.region, 8)}(want >> 0) ·  diff() says ${beforeIso.inRegion}`);
    log(`  D restore integrity, diff before/after       ${pad(beforeIso.inRegion + '/' + afterIso.inRegion, 8)}(want equal)`);
    const isoOk = isoEmpty.region <= 40 && isoFog.region <= 60 && isoLoud.region > 400
      && Math.abs(beforeIso.inRegion - afterIso.inRegion) <= Math.max(60, idleDiff.inRegion);
    log(isoOk ? '  → vfxIso VALID' : '  → vfxIso INVALID — the burst columns below are untrustworthy');
    log(`\n  ⚠️ B vs C is the saturation `
      + `— diff() reads ${fogDiff.inRegion} px for a hit with NO burst at all.`);
    if (!instrumentOk || !isoOk) failures++;
    instrumentOk = instrumentOk && isoOk;
    if (args.selftest) { await browser.close(); process.exit(instrumentOk ? 0 : 1); }

    // ── The ladder ─────────────────────────────────────────────────────────────
    log('\n══ PART 2 — IMPACT DELIVERY vs DAMAGE (hand-cranked, shipped handler) ═════');
    log('  BURST px / BURST victim% come from `vfxIso` (the layer ablated against itself).');
    log('  peak px / on-victim are the OLD saturated counter, kept only so the git log compares.');
    log(`${pad('dmg', 6)}${pad('BURST px', 10)}${pad('BURSTΔ', 8)}${pad('BURST vic%', 12)}${pad('decal', 8)}${pad('rings', 8)}${pad('sprites', 9)}${pad('objs', 6)}`
      + `${pad('| peak px', 11)}${pad('on-victim', 11)}${pad('WHITEOUT', 10)}${pad('kick px', 9)}${pad('hitstop', 9)}burst px at frame ${FRAMES.join('/')}`);
    log('-'.repeat(180));
    const ladder = [];
    for (const dmg of LADDER) {
      await page.evaluate(() => window.__feel.reset());
      await page.evaluate(() => window.__feel.setBase());
      const before = await page.evaluate(() => window.__feel.feel());
      await page.evaluate(([ev]) => window.__feelEvent(ev), [hitEvent(dmg, P.x, P.y)]);
      const after = await page.evaluate(() => window.__feel.feel());
      const kick = await page.evaluate(() => window.__feel.kickPx());
      const kickWu = await page.evaluate(() => window.__feel.kickWu());
      const series = [];
      const isoSeries = [];
      let peak = { inRegion: -1 };
      let peakClip = 0;
      let f = 0;
      // The burst's own peak, its frame, and the element split TAKEN AT THAT FRAME.
      // A fixed frame is wrong here: measured on HEAD, a 2-damage chip peaks at frame
      // 5 and an 18-damage smash at frame 18, because the shards are still inside the
      // epicentre early and only reach their own footprint later. Sampling both at one
      // frame would compare a chip at its peak with a smash before it has spread.
      let isoPeak = { region: -1 }; let isoPeakFrame = 0;
      let split = null; let census = null; let rule1 = null;
      for (const target of FRAMES) {
        await page.evaluate((n) => window.__feel.steps(n), target - f);
        f = target;
        const d = await D(box, region);
        series.push(d.inRegion);
        if (d.inRegion > peak.inRegion) peak = d;
        if (d.clipShare > peakClip) peakClip = d.clipShare;
        const isoAll = await page.evaluate(([b, r]) => window.__feel.vfxIso(b, r, 'all'), [box, region]);
        isoSeries.push(isoAll.region);
        // Rule 1 is a statement about the INSTANT of impact, so it is read at frame 2
        // (burst fully spawned, character flash still near peak) rather than at the
        // burst's own pixel peak, which can be 200-300 ms later.
        if (target === 2) rule1 = await page.evaluate(() => window.__feel.rule1());
        if (isoAll.region > isoPeak.region) {
          isoPeak = isoAll; isoPeakFrame = target;
          split = {
            decal: (await page.evaluate(([b, r]) => window.__feel.vfxIso(b, r, 'decal'), [box, region])).region,
            rings: (await page.evaluate(([b, r]) => window.__feel.vfxIso(b, r, 'rings'), [box, region])).region,
            sprites: (await page.evaluate(([b, r]) => window.__feel.vfxIso(b, r, 'sprites'), [box, region])).region,
          };
          census = await page.evaluate(() => window.__feel.vfxCensus());
        }
        if (SHOT.includes(dmg) && (target === 2 || target === 5)) {
          await page.evaluate(() => window.__feel.stillFrame());
          await page.screenshot({ path: `${OUT}/hit-${String(dmg).padStart(2, '0')}dmg-f${target}.png` });
        }
      }
      const row = {
        dmg, peak: peak.inRegion, regionTotal: peak.regionTotal, meanDelta: peak.regionMeanDelta,
        boxShare: peak.boxShare, clipShare: peakClip, wholeFrame: peak.n,
        burstPx: isoPeak.region, burstBoxShare: isoPeak.boxShare, burstMeanDelta: isoPeak.meanDelta,
        burstPeakFrame: isoPeakFrame, split, census, rule1,
        kickPx: kick.px, kickM: kick.amountM, kickWu,
        hitStopMs: +(after.lastHitStopMs).toFixed(1),
        responses: Object.fromEntries(Object.entries(after.responses).map(([k, v]) => [k, v - before.responses[k]])),
        series, isoSeries,
      };
      ladder.push(row);
      log(`${pad(dmg, 6)}${pad(isoPeak.region, 10)}${pad(isoPeak.meanDelta, 8)}${pad((isoPeak.boxShare * 100).toFixed(1) + '%', 12)}`
        + `${pad(split.decal, 8)}${pad(split.rings, 8)}${pad(split.sprites, 9)}${pad(census.total, 6)}`
        + `${pad('| ' + peak.inRegion, 11)}${pad((peak.boxShare * 100).toFixed(1) + '%', 11)}${pad((peakClip * 100).toFixed(1) + '%', 10)}`
        + `${pad(kick.px, 9)}${pad(row.hitStopMs.toFixed(0) + 'ms', 9)}${isoSeries.join(' / ')}`);
    }

    // ── Dynamic range: the direct measurement of "one tone, monotonic" ──────────
    const lo = ladder[0], hi = ladder[ladder.length - 1];
    const ratio = (a, b) => (a > 0 ? +(b / a).toFixed(2) : Infinity);
    log(`\n  DAMAGE INPUT RANGE        ${lo.dmg} -> ${hi.dmg}  =  ${ratio(lo.dmg, hi.dmg)}x`);
    log(`  delivered, BURST px       ${pad(lo.burstPx + ' -> ' + hi.burstPx, 22)}${ratio(lo.burstPx, hi.burstPx)}x   <- the isolated channel`);
    log(`  delivered, peak px        ${pad(lo.peak + ' -> ' + hi.peak, 22)}${ratio(lo.peak, hi.peak)}x   (old saturated counter)`);
    log(`  delivered, camera kick    ${pad(lo.kickPx + ' -> ' + hi.kickPx + ' px', 22)}${ratio(lo.kickPx, hi.kickPx)}x`);
    log(`  delivered, hit-stop       ${pad(lo.hitStopMs.toFixed(0) + ' -> ' + hi.hitStopMs.toFixed(0) + ' ms', 22)}${ratio(lo.hitStopMs, hi.hitStopMs)}x`);
    log(`\n  VICTIM'S OWN BOX repainted BY THE BURST   ${(lo.burstBoxShare * 100).toFixed(1)}% at ${lo.dmg} dmg`
      + `  ->  ${(hi.burstBoxShare * 100).toFixed(1)}% at ${hi.dmg} dmg`);
    const med = ladder.find((r) => r.dmg === 6);
    if (med) log(`  ... and ${(med.burstBoxShare * 100).toFixed(1)}% at the census MEDIAN damage of 6`);

    // ── The hue contract's rule 1, measured mid-hit on both operands ────────────
    log('\n══ HUE CONTRACT RULE 1, AT THE INSTANT OF IMPACT ═════════════════════════');
    log('  "a transient must clear the CAST\'s luma by >= 0.15 UPWARD" — both operands');
    log('  ablated out of the SAME frame at frame 2, so the cast luma is the FLASHED cast.');
    log(`${pad('dmg', 6)}${pad('burst L', 10)}${pad('burst hue', 11)}${pad('cast L', 10)}${pad('cast hue', 10)}${pad('dL', 9)}verdict`);
    for (const r of ladder) {
      if (!r.rule1) { log(`${pad(r.dmg, 6)}(not measurable)`); continue; }
      const v = r.rule1.dL >= 0.15 ? 'PASS' : r.rule1.dL <= -0.15 ? 'PASS (downward)' : 'FAIL';
      log(`${pad(r.dmg, 6)}${pad(r.rule1.burst.luma, 10)}${pad(r.rule1.burst.hue, 11)}${pad(r.rule1.cast.luma, 10)}${pad(r.rule1.cast.hue, 10)}${pad(r.rule1.dL, 9)}${v}`);
    }

    // A fresh match before PART 3 — see `freshMatch`. Every measurement below is then
    // taken within ~3 s of sim time of a known-good starting state.
    await freshMatch();
    const P3 = (await page.evaluate(() => window.__feel.fighters())).player;
    const box3 = await page.evaluate(() => window.__feel.fighterBox('player'));
    const region3 = await page.evaluate(() => window.__feel.fighterBox('player', 2.5));
    const D3 = (b, r) => page.evaluate(([bb, rr]) => window.__feel.diff(bb, rr), [b, r]);

    // ── PART 3: the four damage sources, which take four different branches ─────
    // `fog` is the useful control and not merely a case: `handleEvents` calls
    // `model.play('hit')` for EVERY `hit-landed` and only then branches, so a fog hit
    // is the character's own hit flash with every other channel switched off. Running
    // it at both ends of the damage ladder is the direct measurement of whether the
    // loudest channel in the whole system scales with the hit at all.
    log('\n══ PART 3 — CHANNEL ISOLATION BY DAMAGE SOURCE ═══════════════════════════');
    log(`${pad('source', 14)}${pad('dmg', 6)}${pad('BURST px', 10)}${pad('BURST vic%', 12)}${pad('peak px', 10)}${pad('on-victim', 11)}${pad('WHITEOUT', 10)}${pad('kick px', 10)}${pad('hitstop', 9)}responses`);
    log('-'.repeat(132));
    const sources = [];
    for (const [kind, dmg] of [['weapon', 2], ['weapon', 18], ['trail', 8], ['hazard', 8], ['fog', 2], ['fog', 18]]) {
      await page.evaluate(() => window.__feel.reset());
      await page.evaluate(() => window.__feel.setBase());
      const before = await page.evaluate(() => window.__feel.feel());
      await page.evaluate(([ev]) => window.__feelEvent(ev), [hitEvent(dmg, P3.x, P3.y, kind)]);
      const after = await page.evaluate(() => window.__feel.feel());
      const kick = await page.evaluate(() => window.__feel.kickPx());
      let peak = { inRegion: -1, boxShare: 0 };
      let peakClip = 0;
      let f = 0;
      let isoPeak = { region: -1, boxShare: 0 };
      for (const target of FRAMES) {
        await page.evaluate((n) => window.__feel.steps(n), target - f);
        f = target;
        const d = await D3(box3, region3);
        if (d.inRegion > peak.inRegion) peak = d;
        if (d.clipShare > peakClip) peakClip = d.clipShare;
        const isoAll = await page.evaluate(([b, r]) => window.__feel.vfxIso(b, r, 'all'), [box3, region3]);
        if (isoAll.region > isoPeak.region) isoPeak = isoAll;
        if (target === 2 && kind === 'fog') {
          await page.evaluate(() => window.__feel.stillFrame());
          await page.screenshot({ path: `${OUT}/flash-only-${String(dmg).padStart(2, '0')}dmg.png` });
        }
      }
      const hs = after.responses.hitStop === before.responses.hitStop ? 0 : after.lastHitStopMs;
      const resp = Object.fromEntries(Object.entries(after.responses)
        .map(([k, v]) => [k, v - before.responses[k]]).filter(([, v]) => v > 0));
      sources.push({ kind, dmg, peak: peak.inRegion, boxShare: peak.boxShare, clipShare: peakClip,
        burstPx: isoPeak.region, burstBoxShare: isoPeak.boxShare, kickPx: kick.px, hitStopMs: hs, resp });
      log(`${pad(kind === 'fog' ? 'fog (FLASH ONLY)' : kind, 16)}${pad(dmg, 6)}${pad(isoPeak.region, 10)}${pad((isoPeak.boxShare * 100).toFixed(1) + '%', 12)}`
        + `${pad(peak.inRegion, 10)}${pad((peak.boxShare * 100).toFixed(1) + '%', 11)}${pad((peakClip * 100).toFixed(1) + '%', 10)}${pad(kick.px, 10)}`
        + `${pad(hs.toFixed(0) + 'ms', 9)}${JSON.stringify(resp)}`);
    }
    const fogLo = sources.find((s) => s.kind === 'fog' && s.dmg === 2);
    const fogHi = sources.find((s) => s.kind === 'fog' && s.dmg === 18);
    if (fogLo && fogHi) {
      log(`\n  delivered, character FLASH ${pad(fogLo.peak + ' -> ' + fogHi.peak + ' px', 22)}`
        + `${fogLo.peak > 0 ? +(fogHi.peak / fogLo.peak).toFixed(2) : '-'}x   (across a 9x damage range)`);
    }

    await writeFile(`${OUT}/ladder.json`, JSON.stringify({ ladder, sources, base: BASE, frames: FRAMES }, null, 2));
    log(`\njson -> ${OUT}/ladder.json`);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
}

await main();
