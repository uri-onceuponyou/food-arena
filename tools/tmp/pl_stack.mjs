#!/usr/bin/env node
/**
 * PL_STACK — SEGMENTATION CENSUS: how many CONTOURS does a pile of ground marks draw?
 *
 * ── The gap this fills, and it is named in the repo's own record ────────────────
 *
 * `docs/LESSONS.md` §6b (read backwards) closes with the sentence this file exists
 * because of:
 *
 *   "a whole-region area number cannot see SEGMENTATION, and no statistic here counts
 *    contours. When the defect was found by eye, the close-out is also by eye."
 *
 * That was true. `tr_area.mjs` measures AREA and OCCLUSION and `trail_probe.mjs`
 * measures VALUE / HUE / FLATNESS, and the Sticky Trail's standing complaint — five
 * critics across three sheets, in these words — is none of those:
 *
 *   "hard-edged OVERLAPPING CIRCULAR BOUNDARIES"        (2026-08-21, drift/base/cast)
 *   "flat, unshaded STACKED CIRCLES with hard edges"    (2026-08-18, new/cast/c1)
 *   "hard cartoon OUTLINES sprawls across the floor"    (2026-08-21, drift/cr1/cast)
 *
 * All three are one property: **the pile reads as N separate shapes rather than one.**
 * This counts it.
 *
 * ── THE METRIC ─────────────────────────────────────────────────────────────────
 *
 *   interiorEdge   mean Sobel magnitude of LUMA over the STRICT INTERIOR of the trail's
 *                  union mask — the union eroded by `--erode` px, minus the cast matte
 *                  dilated by `--castpad` px. Both masks are same-frame ABLATIONS
 *                  (`tr_area.mjs`'s definitions, verbatim), so the interior is the real
 *                  delivered footprint in this exact frame and not a box.
 *
 *   boundaryEdge   the same statistic on the union's own boundary band (union minus
 *                  eroded union). This is the contour a pile is SUPPOSED to have — one,
 *                  around the outside — so it is the natural denominator.
 *
 *   segRatio       interiorEdge / boundaryEdge. Dimensionless, so it survives a change
 *                  of camera, of framing and of the mark's colour. **One spill reads
 *                  LOW; twenty stacked lozenges read HIGH.**
 *
 * ⚠️ There is NO threshold anywhere in it. A threshold on gradient magnitude would be a
 * number nobody measured, and `CLAUDE.md` rule 6's worst case this session was two arms
 * "false BY CONSTRUCTION — a single threshold cut through one continuous population".
 * Mean magnitude over a declared mask is a continuous statistic with no cut in it.
 *
 * ── WHY EVERY ARM REPAINTS THE REAL TEXTURE INSTEAD OF THE CAPTURED PNG ─────────
 *
 * `mat.map.image` IS the `<canvas>` `buildGlazeMarkTexture` drew into, so a known-bad
 * can be painted into the SHIPPED material and re-rendered through the SHIPPED post
 * chain, in the SAME frozen frame, over the SAME pile. Stamping rings into a captured
 * PNG would validate a Sobel kernel; this validates the instrument where it is actually
 * pointed. `CLAUDE.md` rule 6: *"`--selftest` validates a tool's LOGIC. It never
 * validates where the tool is POINTED."*
 *
 * ── VALIDATION, and what implementation would FAIL each arm ─────────────────────
 *
 *   §A NON-EMPTY   union / interior / boundary masks are all asserted ABOVE a floor
 *                  BEFORE any mean is taken over them. `[].every()` returns true and a
 *                  mean over an empty set is NaN or 0 — either way it would read as a
 *                  pass. Fails if the drive produced no marks, if the ablation found
 *                  nothing, or if `--erode` ate the whole mask.
 *   §B DRIFT       the same measurement twice on one frozen frame must be EXACTLY equal.
 *                  Fails on camera shake (AGENT-BRIEF: shake re-randomises at dt = 0),
 *                  on a live clock, on CSS animating under the canvas.
 *   §C MOVES UP    a hard BRIGHT RING painted into every glaze texture at 0.62 r — an
 *                  interior contour by construction, drawn where no mark boundary is —
 *                  must raise `interiorEdge`. Fails on a saturated counter (§14's
 *                  region-differ read 3904 vs 3879 for "nothing" vs "everything"), on a
 *                  mask that does not actually cover the marks, and on a tool measuring
 *                  a stale texture upload.
 *   §D MOVES DOWN  every glaze texture repainted FLAT — one uniform body value, no rim,
 *                  no speckles, silhouette unchanged — must lower `interiorEdge`. This
 *                  is also the metric's REFERENCE FLOOR for this pile: whatever it
 *                  reads is the part of `interiorEdge` that is the floor, the debris and
 *                  the shadows showing through a mark that has no structure at all, and
 *                  the shipped number may only be compared against it, never against 0.
 *   §E RESTORE     after §C and §D the original texture pixels are put back and the
 *                  frame must return BIT-IDENTICAL to the shipped one. Fails if a
 *                  known-bad leaked into the reported number — which is the one way this
 *                  file could report a confident wrong answer.
 *
 * §C and §D are a MOVES pair in both directions, so a metric that had quietly become a
 * constant fails at least one of them. §E is the SELF-PAIR.
 *
 * ── USAGE ──────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean -- \
 *     node tools/tmp/pl_stack.mjs --url '{URL}' --out shots/pl/head
 *
 *   --marks N     stop the drive at exactly N live marks. ⚠️ TWO RUNS THAT STOP AT
 *                 DIFFERENT MARK COUNTS ARE NOT AN A/B (`tr_area.mjs` records the
 *                 before/after pair this cost). Always pass it for a quoted number.
 *   --enemy ID    default `donut` — two trails, the shipped worst case for this effect.
 *   --selftest    run the validation arms and exit; report no measurement.
 *   --shallow N   pitch for the DIAGNOSTIC second view, default 22. The lobby camera
 *                 (`charStage.ts`, `pitchDeg: 20`) has no match in it and therefore no
 *                 trail, so rule 3's "diagnose up close" is served by re-pitching the
 *                 MATCH rig (`CameraRig.pitchDeg`, default 58) after the measurement.
 *                 It writes `canvas-shallow.png` and reports NO number.
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
const OUT = String(args.out ?? 'shots/pl/stack');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Same `delta` as `tr_area.mjs` — the ablation masks must be the SAME population or no
 * number here is comparable to one there (`docs/LESSONS.md` §3). */
const DELTA = Number(args.delta ?? 6);
const ERODE = Number(args.erode ?? 4);
const CASTPAD = Number(args.castpad ?? 4);
const ENEMY = String(args.enemy ?? 'donut');
const TARGET_MARKS = Number(args.marks ?? 0);
const DRIVE_CAP_MS = Number(args.drive ?? 90000);
/**
 * How long one direction is held, in ms of WALL CLOCK.
 *
 * ⚠️ NOT COSMETIC. `tr_area.mjs`'s 500 ms alternating drive walks a tight loop and
 * PILES the marks on top of the fighter: measured on the first valid run of this tool,
 * trail union **7,529 px** against a cast body of **10,535** — the fighter is bigger
 * than the pile, and after removing it the strict interior was **313 px**, one pixel
 * class away from §A's floor. The frames the critics actually scored show a trail
 * SPRAWLED along a path, so the fighter is walked in long straight legs here. Under
 * SwiftShader the sim runs at roughly a quarter of real time (`tr_area.mjs`), so a leg
 * has to be seconds of wall clock to be a metre of sim.
 */
const HOLD_MS = Number(args.hold ?? 4000);
/** Floors for §A. Deliberately generous: they exist to catch an EMPTY set, not to
 * express a judgement about how big a pile should be. */
const MIN_UNION = 800;
const MIN_INTERIOR = 300;
const MIN_BOUNDARY = 200;

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const pad = (v, n) => String(v).padEnd(n);
const pct = (v) => `${(v * 100).toFixed(2)}%`;

/**
 * VERBATIM `tools/tmp/tr_area.mjs`'s `boot`. The `@vite/client` stub and the
 * `performance.now` clock shim are both load-bearing and neither is obvious:
 * `window.__clk` does not exist in the app, it is INSTALLED here, and freezing the
 * clock is not freezing the rAF loop (AGENT-BRIEF §3).
 */
async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log(`PAGEERROR: ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error') log(`CONSOLE error: ${m.text()}`); });
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
    };
  });
}

/**
 * The page-side harness. Every helper below `── verbatim` is copied from
 * `tools/tmp/tr_area.mjs` UNCHANGED and on purpose: this tool's masks must be the same
 * population as that tool's, or the two sets of numbers cannot be quoted together.
 */
async function installHarness(page) {
  await page.evaluate(([rw, rh, delta, erode, castpad]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const c2d = cv.getContext('2d', { willReadFrequently: true });

    // ── verbatim tr_area.mjs ────────────────────────────────────────────────
    const grab = () => {
      stage.render(0);
      c2d.clearRect(0, 0, rw, rh);
      c2d.drawImage(stage.canvas, 0, 0, rw, rh);
      return c2d.getImageData(0, 0, rw, rh).data;
    };
    const maskOf = (a, b) => {
      const s = new Uint8Array(rw * rh);
      let n = 0;
      for (let i = 0, p = 0; i < a.length; i += 4, p++) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d >= delta) { s[p] = 1; n++; }
      }
      return { s, n };
    };
    const layer = () => { let L = null; stage.scene.traverse((o) => { if (o.name === 'vfx_layer') L = o; }); return L; };
    const groundMarks = () => {
      const L = layer(); const out = [];
      if (L) L.traverse((o) => { if (o.isMesh && o.visible && o.renderOrder === 0) out.push(o); });
      return out;
    };
    const byGeo = () => {
      const m = new Map();
      for (const o of groundMarks()) {
        const k = o.geometry.uuid;
        if (!m.has(k)) m.set(k, { key: k, w: +o.geometry.parameters?.width?.toFixed?.(3), meshes: [] });
        m.get(k).meshes.push(o);
      }
      return [...m.values()].sort((a, b) => b.meshes.length - a.meshes.length);
    };
    const castRoots = () => { const out = []; stage.scene.traverse((o) => { if (typeof o.name === 'string' && o.name.startsWith('character:') && o.visible) out.push(o); }); return out; };
    const hideAll = (objs) => { const prev = objs.map((o) => o.visible); objs.forEach((o) => { o.visible = false; }); return () => objs.forEach((o, i) => { o.visible = prev[i]; }); };
    // ── end verbatim ────────────────────────────────────────────────────────

    /**
     * 🚨 THE CAST ABLATION IS *NOT* THE CAST SILHOUETTE, AND THE DIFFERENCE IS 2x.
     *
     * `maskOf(shipped, noCast)` is every pixel the character AFFECTS — its body, its
     * bloom **and its whole cast SHADOW**, which on this pile is thrown right across the
     * trail. Measured on the first run of this tool: cast ablation **12,115 px** against
     * a trail union of **6,686**, so subtracting it left an interior of **2 px** and §A
     * correctly refused. Excluding the shadow would also be wrong — the shadow is part of
     * what the pile looks like, it is common to both arms of any A/B, and it is a smooth
     * gradient that a Sobel mean barely notices.
     *
     * So the shadow is separated by a SECOND ablation rather than by a threshold on the
     * first: drop `castShadow` on the character's meshes, re-render, and the pixels that
     * move are the shadow. The body is what is left.
     */
    const castMeshes = () => { const out = []; for (const r of castRoots()) r.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
    const noShadow = (objs) => { const prev = objs.map((o) => o.castShadow); objs.forEach((o) => { o.castShadow = false; }); return () => objs.forEach((o, i) => { o.castShadow = prev[i]; }); };
    const andNot = (a, b) => { const s = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) s[i] = a[i] && !b[i] ? 1 : 0; return s; };

    const lumaOf = (img) => {
      const L = new Float32Array(rw * rh);
      for (let p = 0, i = 0; p < L.length; p++, i += 4) {
        L[p] = 0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2];
      }
      return L;
    };
    const erodeMask = (src, k) => {
      let cur = Uint8Array.from(src);
      for (let e = 0; e < k; e++) {
        const nx = new Uint8Array(cur.length);
        for (let y = 1; y < rh - 1; y++) for (let x = 1; x < rw - 1; x++) {
          const p = y * rw + x;
          if (cur[p] && cur[p - 1] && cur[p + 1] && cur[p - rw] && cur[p + rw]) nx[p] = 1;
        }
        cur = nx;
      }
      return cur;
    };
    const dilateMask = (src, k) => {
      let cur = Uint8Array.from(src);
      for (let e = 0; e < k; e++) {
        const nx = Uint8Array.from(cur);
        for (let y = 1; y < rh - 1; y++) for (let x = 1; x < rw - 1; x++) {
          const p = y * rw + x;
          if (cur[p] || cur[p - 1] || cur[p + 1] || cur[p - rw] || cur[p + rw]) nx[p] = 1;
        }
        cur = nx;
      }
      return cur;
    };
    /** Mean Sobel magnitude of luma over `set`. Continuous — no threshold. */
    const meanSobel = (L, set) => {
      let sum = 0, n = 0;
      for (let y = 1; y < rh - 1; y++) for (let x = 1; x < rw - 1; x++) {
        const p = y * rw + x;
        if (!set[p]) continue;
        const gx = (L[p - rw + 1] + 2 * L[p + 1] + L[p + rw + 1]) - (L[p - rw - 1] + 2 * L[p - 1] + L[p + rw - 1]);
        const gy = (L[p + rw - 1] + 2 * L[p + rw] + L[p + rw + 1]) - (L[p - rw - 1] + 2 * L[p - rw] + L[p - rw + 1]);
        sum += Math.hypot(gx, gy); n++;
      }
      return n ? { mean: sum / n, n } : { mean: null, n: 0 };
    };

    /** Every DISTINCT glaze CanvasTexture reachable from a ground mark, with its canvas. */
    const glazeTextures = () => {
      const seen = new Map();
      for (const o of groundMarks()) {
        const m = o.material;
        if (m?.map?.image?.getContext) seen.set(m.map.uuid, m.map);
      }
      return [...seen.values()];
    };

    window.__pl = {
      census() {
        const g = byGeo();
        return { marks: groundMarks().length, casts: castRoots().map((o) => o.name), textures: glazeTextures().length,
          geo: g.map((x) => ({ w: x.w, n: x.meshes.length })) };
      },
      /**
       * THE MEASUREMENT. One frozen frame, three renders: shipped, trail hidden, cast
       * hidden. Everything else — floor, props, debris, lighting, post chain — is
       * bit-identical across all three and cancels out of every mask.
       */
      measure() {
        const g = byGeo();
        const trail = g[0]?.meshes ?? [];
        const casts = castRoots();
        if (!trail.length) return { refuse: 'no trail meshes' };

        const shipped = grab();
        const rt = hideAll(trail);
        const noTrail = grab();
        rt();
        const union = maskOf(shipped, noTrail);

        // The cast's BODY, not everything it affects — see `noShadow` above.
        let castMask = new Uint8Array(rw * rh);
        let castAllPx = 0, shadowPx = 0;
        if (casts.length) {
          const rc = hideAll(casts);
          const noCast = grab();
          rc();
          const castAll = maskOf(shipped, noCast);
          castAllPx = castAll.n;
          const rs = noShadow(castMeshes());
          const noShad = grab();
          rs();
          const shadow = maskOf(shipped, noShad);
          shadowPx = shadow.n;
          castMask = andNot(castAll.s, shadow.s);
        }
        const castPad = dilateMask(castMask, castpad);

        const inner = erodeMask(union.s, erode);
        const interior = new Uint8Array(rw * rh);
        const boundary = new Uint8Array(rw * rh);
        let nInt = 0, nBnd = 0, nInner = 0, nIntNoCast = 0;
        for (let p = 0; p < union.s.length; p++) {
          if (!union.s[p]) continue;
          if (inner[p]) nInner++;
          if (inner[p] && !castPad[p]) nIntNoCast++;
          if (castPad[p]) continue;              // the fighter's own silhouette is not a mark contour
          if (inner[p]) { interior[p] = 1; nInt++; }
          else { boundary[p] = 1; nBnd++; }
        }
        let nCast = 0, nCastPad = 0;
        for (let p = 0; p < castMask.length; p++) { if (castMask[p]) nCast++; if (castPad[p]) nCastPad++; }
        const L = lumaOf(shipped);
        const iE = meanSobel(L, interior);
        const bE = meanSobel(L, boundary);
        return {
          unionPx: union.n, interiorPx: nInt, boundaryPx: nBnd,
          erodedPx: nInner, castPx: nCast, castPadPx: nCastPad, interiorNoCastPx: nIntNoCast,
          castAllPx, shadowPx,
          interiorEdge: iE.mean, boundaryEdge: bE.mean,
          interiorN: iE.n, boundaryN: bE.n,
        };
      },
      /** A cheap whole-canvas fingerprint, for §E bit-identity. */
      fingerprint() {
        const d = grab();
        let h = 2166136261 >>> 0;
        for (let i = 0; i < d.length; i += 4) {
          h ^= d[i]; h = Math.imul(h, 16777619) >>> 0;
          h ^= d[i + 1]; h = Math.imul(h, 16777619) >>> 0;
          h ^= d[i + 2]; h = Math.imul(h, 16777619) >>> 0;
        }
        return h;
      },
      /** Save every glaze texture's pixels so a known-bad can be undone exactly. */
      saveTextures() {
        window.__plSaved = glazeTextures().map((t) => {
          const cvs = t.image;
          const ctx = cvs.getContext('2d', { willReadFrequently: true });
          return { tex: t, w: cvs.width, h: cvs.height, data: ctx.getImageData(0, 0, cvs.width, cvs.height) };
        });
        return window.__plSaved.length;
      },
      restoreTextures() {
        for (const s of window.__plSaved ?? []) {
          s.tex.image.getContext('2d').putImageData(s.data, 0, 0);
          s.tex.needsUpdate = true;
        }
        return (window.__plSaved ?? []).length;
      },
      /**
       * §C KNOWN-BAD — a hard BRIGHT RING at 0.62 of the texture radius. It is an
       * interior contour BY CONSTRUCTION: it sits well inside the lobe silhouette, so
       * every pixel it adds is inside the union and none of it is a mark boundary.
       * A metric that cannot see this cannot see a ring stack either.
       */
      paintRings() {
        for (const t of glazeTextures()) {
          const cvs = t.image;
          const ctx = cvs.getContext('2d');
          const c = cvs.width / 2;
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';   // stays inside the existing alpha
          ctx.strokeStyle = 'rgb(255,255,255)';
          ctx.lineWidth = Math.max(2, cvs.width * 0.03);
          for (const r of [0.30, 0.44, 0.62]) {
            ctx.beginPath();
            ctx.arc(c, c, c * r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          t.needsUpdate = true;
        }
        return glazeTextures().length;
      },
      /**
       * §D KNOWN-BAD (and the metric's REFERENCE FLOOR) — every glaze texture repainted
       * to ONE uniform body value, silhouette and alpha untouched. Whatever
       * `interiorEdge` reads here is the floor/debris/shadow showing through a mark with
       * NO internal structure at all, on THIS pile. The shipped number is only
       * meaningful against it.
       */
      paintFlat() {
        for (const t of glazeTextures()) {
          const cvs = t.image;
          const ctx = cvs.getContext('2d', { willReadFrequently: true });
          const img = ctx.getImageData(0, 0, cvs.width, cvs.height);
          const d = img.data;
          // mean of the existing RGB over the covered pixels, so the flat arm keeps the
          // mark's overall value and changes only its VARIATION.
          let sum = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 8) { sum += d[i]; n++; } }
          const v = n ? Math.round(sum / n) : 76;
          for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 8) { d[i] = v; d[i + 1] = v; d[i + 2] = v; } }
          ctx.putImageData(img, 0, 0);
          t.needsUpdate = true;
        }
        return glazeTextures().length;
      },
      shot() { stage.render(0); },
      /**
       * ⚠️ A DIAGNOSTIC VIEW, NOT A SHIPPED ONE — and it is here because `CLAUDE.md`
       * rule 3 asks for two cameras and this effect only exists in one of them.
       *
       * The lobby camera (`ui/screens/charStage.ts`, `pitchDeg: 20`) renders the
       * character select screen, where there is no match and therefore no trail, so
       * there is no way to photograph a Sticky Trail at 20 degrees on a shipped screen.
       * What rule 3 actually asks for is *"diagnose UP CLOSE, then confirm at match
       * framing that it survived"* — a ground decal's segmentation is exactly the class
       * that foreshortening at 58 hides. So the MATCH rig is re-pitched in place.
       *
       * NO NUMBER IS EVER REPORTED FROM THIS VIEW. It changes the framing, so its
       * masks are a different population from every figure above; it exists to be
       * LOOKED AT.
       */
      shallow(deg) {
        const rig = stage.rig;
        if (!rig || typeof rig.pitchDeg !== 'number') return null;
        const was = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        const trail = byGeo()[0]?.meshes ?? [];
        if (!trail.length) return null;

        // 🚨 SETTING `pitchDeg` ALONE PRODUCED A PICTURE OF THE HORIZON, AND THE FIRST
        // VERSION OF THIS FUNCTION REPORTED IT AS A PASS.
        //
        // The match rig is in `frameMode: 'fair'`, which solves camera DISTANCE from the
        // pitch so a fixed ground rectangle stays covered — and that solve goes as
        // 1/sin(pitch), so 58 -> 22 pushed the camera far enough back that the arena
        // left the frame entirely and the shot was sky. `render/camera.ts` says this in
        // its own `frameMode` doc ("shrinks the model to a speck") and I re-derived it
        // the expensive way. The tool passed because it asserted the RIG WAS REACHABLE
        // and never that the SUBJECT WAS IN SHOT — `CLAUDE.md` rule 6's vacuity in my
        // own instrument, on the same day I wrote a §A guard against it.
        //
        // So: 'ground' framing, and the width is CHOSEN BY MEASUREMENT rather than
        // guessed — sweep, keep the framing that delivers the most trail pixels, and
        // return null (which the caller reports as a FAILURE) if none of them delivers
        // a usable subject.
        rig.frameMode = 'ground';
        rig.pitchDeg = deg;
        let bestW = null, bestN = 0;
        for (const w of [180, 260, 360, 500, 700]) {
          rig.viewWidthUnits = w;
          stage.render(0); stage.render(0);
          const on = grab();
          const restore = hideAll(trail);
          const off = grab();
          restore();
          const { n } = maskOf(on, off);
          if (n > bestN) { bestN = n; bestW = w; }
        }
        if (bestW === null || bestN < 400) {
          rig.pitchDeg = was.pitch; rig.frameMode = was.mode; rig.viewWidthUnits = was.width;
          stage.render(0);
          return { failed: true, bestN };
        }
        rig.viewWidthUnits = bestW;
        stage.render(0); stage.render(0);
        return { was, deg, viewWidthUnits: bestW, trailPx: bestN };
      },
      unshallow(r) {
        const rig = stage.rig;
        if (!rig || !r?.was) return;
        rig.pitchDeg = r.was.pitch; rig.frameMode = r.was.mode; rig.viewWidthUnits = r.was.width;
        stage.render(0);
      },
    };
  }, [RW, RH, DELTA, ERODE, CASTPAD]);
}

async function markCount(page) {
  return page.evaluate(() => {
    const stage = window.__stage;
    let L = null;
    stage.scene.traverse((o) => { if (o.name === 'vfx_layer') L = o; });
    let n = 0;
    if (L) L.traverse((o) => { if (o.isMesh && o.visible && o.renderOrder === 0) n++; });
    return n;
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let failures = 0;
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);
    const pitch = args.pitch ? `&pitch=${args.pitch}` : '';
    await page.goto(`${BASE}/?player=donut&enemy=${ENEMY}&simSpeed=1&pointerLock=0${pitch}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120000 });

    // Drive until the mark count stops rising — NOT for a fixed wall clock. Headless
    // under SwiftShader the sim runs at roughly a quarter of real time, so a clock-driven
    // drive measures the renderer's frame rate (`tr_area.mjs` records the nine-marks-vs-28
    // version of this mistake).
    const keys = ['d', 's', 'a', 'w'];
    let ki = 0, best = 0, flat = 0;
    const t0 = Date.now();
    const trace = [];
    while (Date.now() - t0 < DRIVE_CAP_MS) {
      const k = keys[ki++ % keys.length];
      await page.keyboard.down(k);
      await page.waitForTimeout(HOLD_MS);
      await page.keyboard.up(k);
      const n = await markCount(page);
      trace.push(n);
      if (n > best) { best = n; flat = 0; } else { flat++; }
      if (TARGET_MARKS && n >= TARGET_MARKS) break;
      if (!TARGET_MARKS && flat >= 6 && best >= 12) break;
    }
    if (TARGET_MARKS && best < TARGET_MARKS) {
      log(`  ⚠️ asked for ${TARGET_MARKS} marks, drive plateaued at ${best} — NOT comparable to a run that reached it.`);
      failures++;
    }
    log(`  mark-count trace: ${trace.join(' ')}`);
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await installHarness(page);

    const census = await page.evaluate(() => window.__pl.census());
    log(`\nlive ground marks: ${census.marks}   ·   casts: ${census.casts.join(', ')}   ·   glaze textures: ${census.textures}`);
    for (const g of census.geo) log(`    geometry width ${g.w} wu   x${g.n}`);

    /**
     * ⚠️ WARM-UP, DISCARDED — AND IT IS NOT SUPERSTITION, IT IS A MEASURED OFFSET.
     *
     * The FIRST `measure()` after `installHarness` disagreed with the second by
     * **0.159737** on one arm while the second and third agreed to the last decimal and
     * the canvas fingerprint was BIT-IDENTICAL across the whole run. So the frame is
     * reproducible and the first call is not: `measure()` toggles `castShadow` on the
     * cast meshes for its shadow ablation, and the first toggle is the one that leaves
     * three's shadow-map cache in the state every later call finds it in.
     *
     * Hiding it inside a tolerance would have been the wrong fix — §B is the arm that
     * catches camera shake at `dt = 0` (344 of 344 frozen frames drifted up to 349 px,
     * `a1a85e5`), and a tolerance wide enough to swallow this would swallow that. So the
     * warm-up is discarded, its value is PRINTED, and §B keeps demanding EXACT equality.
     */
    const warm = await page.evaluate(() => window.__pl.measure());
    const base = await page.evaluate(() => window.__pl.measure());
    if (base.refuse) { log(`REFUSED: ${base.refuse}`); await browser.close(); process.exit(2); }

    log('\n══ §A NON-EMPTY — asserted BEFORE any mean is taken over these sets ═══════');
    log(`  union mask      ${pad(base.unionPx, 10)}(floor ${MIN_UNION})`);
    log(`  …eroded ${ERODE}       ${pad(base.erodedPx, 10)}${pct(base.erodedPx / Math.max(1, base.unionPx))} of the union survives erosion`);
    log(`  cast ablation   ${pad(base.castAllPx, 10)}body + shadow + bloom  ·  shadow alone ${base.shadowPx}`);
  log(`  cast BODY       ${pad(base.castPx, 10)}dilated ${CASTPAD} -> ${base.castPadPx}   <- what is removed from the interior`);
    log(`  interior mask   ${pad(base.interiorPx, 10)}(floor ${MIN_INTERIOR})   <- eroded ${ERODE}, cast dilated ${CASTPAD} removed`);
    log(`  boundary band   ${pad(base.boundaryPx, 10)}(floor ${MIN_BOUNDARY})`);
    const nonEmpty = base.unionPx >= MIN_UNION && base.interiorPx >= MIN_INTERIOR && base.boundaryPx >= MIN_BOUNDARY;
    log(nonEmpty ? '  → §A PASS' : '  → §A FAIL — a mean over an empty set reads as a pass; nothing below is trustworthy');
    if (!nonEmpty) { failures++; await browser.close(); process.exit(2); }

    const rep = await page.evaluate(() => window.__pl.measure());
    const drift = Math.abs(rep.interiorEdge - base.interiorEdge);
    log('\n══ §B DRIFT — the same measurement twice on one frozen frame ══════════════');
    log(`  warm-up (discarded)  ${warm.interiorEdge.toFixed(6)}   offset from base ${Math.abs(warm.interiorEdge - base.interiorEdge).toFixed(6)}`);
    log(`  interiorEdge  ${base.interiorEdge.toFixed(6)}  /  ${rep.interiorEdge.toFixed(6)}   delta ${drift.toFixed(6)}`);
    log(drift === 0 ? '  → §B PASS (EXACT)' : '  → §B FAIL — the frame is moving under the probe (camera shake at dt=0? live clock? CSS?)');
    if (drift !== 0) failures++;

    const nSaved = await page.evaluate(() => window.__pl.saveTextures());
    const fpBefore = await page.evaluate(() => window.__pl.fingerprint());

    await page.evaluate(() => window.__pl.paintRings());
    const rings = await page.evaluate(() => window.__pl.measure());
    await page.evaluate(() => window.__pl.restoreTextures());

    await page.evaluate(() => window.__pl.paintFlat());
    const flatArm = await page.evaluate(() => window.__pl.measure());
    await page.evaluate(() => window.__pl.restoreTextures());

    const fpAfter = await page.evaluate(() => window.__pl.fingerprint());
    const post = await page.evaluate(() => window.__pl.measure());

    const upRatio = rings.interiorEdge / base.interiorEdge;
    const downRatio = flatArm.interiorEdge / base.interiorEdge;
    log(`\n══ §C MOVES UP — three hard BRIGHT RINGS painted inside every glaze texture ═`);
    log(`  saved ${nSaved} textures · interiorEdge ${base.interiorEdge.toFixed(3)} -> ${rings.interiorEdge.toFixed(3)}   ratio ${upRatio.toFixed(3)}x  (want >= 1.20x)`);
    log(upRatio >= 1.20 ? '  → §C PASS' : '  → §C FAIL — the counter is saturated, or the mask is not on the marks');
    if (!(upRatio >= 1.20)) failures++;

    log(`\n══ §D MOVES DOWN — every glaze texture repainted FLAT (one uniform value) ══`);
    log(`  interiorEdge ${base.interiorEdge.toFixed(3)} -> ${flatArm.interiorEdge.toFixed(3)}   ratio ${downRatio.toFixed(3)}x  (want <= 0.90x)`);
    log(`  ⚠️ ${flatArm.interiorEdge.toFixed(3)} is this pile's REFERENCE FLOOR — floor, debris and shadow`);
    log('     showing through a mark with NO internal structure. Compare the shipped number');
    log('     to THAT, never to zero.');
    log(downRatio <= 0.90 ? '  → §D PASS' : '  → §D FAIL — the metric cannot see the texture it is supposed to be measuring');
    if (!(downRatio <= 0.90)) failures++;

    log('\n══ §E RESTORE / SELF-PAIR — the known-bads must not have leaked ═══════════');
    log(`  canvas fingerprint ${fpBefore} -> ${fpAfter}   ${fpBefore === fpAfter ? 'IDENTICAL' : 'MOVED'}`);
    log(`  interiorEdge       ${base.interiorEdge.toFixed(6)} -> ${post.interiorEdge.toFixed(6)}`);
    const restored = fpBefore === fpAfter && post.interiorEdge === base.interiorEdge;
    log(restored ? '  → §E PASS' : '  → §E FAIL — a known-bad is still on screen; the reported number is contaminated');
    if (!restored) failures++;

    if (args.selftest) {
      log(`\n${failures ? '→ INSTRUMENT INVALID' : '→ INSTRUMENT VALID'}`);
      await browser.close();
      process.exit(failures ? 1 : 0);
    }

    log('\n══ SEGMENTATION — does the pile read as ONE shape or as N? ════════════════');
    log(`  interiorEdge   ${base.interiorEdge.toFixed(3)}   mean Sobel luma over ${base.interiorN} strictly-interior px`);
    log(`  boundaryEdge   ${base.boundaryEdge.toFixed(3)}   mean Sobel luma over ${base.boundaryN} union-boundary px`);
    log(`  segRatio       ${(base.interiorEdge / base.boundaryEdge).toFixed(4)}   <- THE NUMBER. one spill = LOW, N lozenges = HIGH`);
    log(`  flat floor     ${flatArm.interiorEdge.toFixed(3)}   (§D — the same pile with NO texture structure)`);
    log(`  structure      ${(base.interiorEdge - flatArm.interiorEdge).toFixed(3)}   <- interiorEdge ABOVE the floor: the part the TEXTURE draws`);

    await page.evaluate(() => window.__pl.shot());
    const el = await page.$('canvas');
    await el.screenshot({ path: `${OUT}/canvas.png` });
    // Rule 3's second camera. Diagnostic only — see `shallow()`.
    const sh = await page.evaluate((d) => window.__pl.shallow(d), Number(args.shallow ?? 22));
    if (sh && !sh.failed) {
      await el.screenshot({ path: `${OUT}/canvas-shallow.png` });
      await page.evaluate((r) => window.__pl.unshallow(r), sh);
      log(`  shallow view: pitch ${sh.was.pitch} -> ${sh.deg}, frameMode ${sh.was.mode} -> ground, viewWidth ${sh.viewWidthUnits} wu`);
      log(`               ${sh.trailPx} trail px IN SHOT (asserted > 400 — the first version photographed the SKY and passed)`);
      log(`               png ${OUT}/canvas-shallow.png   ⚠️ DIAGNOSTIC ONLY — no number is reported from it`);
    } else {
      log(`  ⚠️ SHALLOW VIEW FAILED — best framing delivered ${sh?.bestN ?? 0} trail px; rule 3's second camera was NOT rendered`);
      failures++;
    }
    await writeFile(`${OUT}/stack.json`, JSON.stringify({
      base: BASE, enemy: ENEMY, pitch: args.pitch ?? null, peakMarks: best, census,
      shipped: base, warmup: warm.interiorEdge, ringsArm: rings, flatArm, restoreOk: restored,
      segRatio: base.interiorEdge / base.boundaryEdge,
      structureAboveFlat: base.interiorEdge - flatArm.interiorEdge,
      erode: ERODE, castpad: CASTPAD, delta: DELTA,
    }, null, 2));
    await writeFile(`${OUT}/stack.log`, lines.join('\n'));
    log(`\npng -> ${OUT}/canvas.png   json -> ${OUT}/stack.json`);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
}

main();
