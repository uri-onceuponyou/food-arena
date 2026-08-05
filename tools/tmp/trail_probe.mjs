#!/usr/bin/env node
/**
 * TRAIL PROBE — is our own ground VFX competing with the floor and eating the cast?
 *
 * Six of six blind critics on the cast element (and five of six on the arena) named
 * one mechanical defect in the same words:
 *
 *   "a weapon trail of FLAT HARD-EDGED CIRCLES at the SAME VALUE AND HUE AS THE FLOOR"
 *
 * That is three separate checkable properties and a mechanism, and no instrument in
 * this repo measured any of them. `arena-scan` has an `envShareInCastBand` rail
 * precisely because the ENVIRONMENT was competing with the cast's hue band — it has
 * never been pointed at our own VFX. `vfx_hue.mjs` scores TRANSIENT effects against
 * the cast; persistent ground marks are explicitly out of its scope (`vfx.ts`'s hue
 * contract rule 3 calls them "environment, not transients") and it never measures
 * them against the FLOOR at all.
 *
 * ── Every number here is a SAME-FRAME ABLATION ──────────────────────────────────
 *
 * The trail marks are hidden and re-shown inside one frozen frame, so the floor
 * underneath them is measured at exactly the pixels they cover, in the same lighting,
 * through the same post chain, on the same tick. There is no baseline to go stale and
 * no second render to disagree with the first — `docs/LESSONS.md` §5 ("a mask from one
 * render and a value from another is a lie wherever they disagree").
 *
 * What it reports, one number per critic phrase:
 *
 *   "same value as the floor"  |dL| between the mark's pixels and the floor pixels it
 *                              covers. `arena/shared.ts`'s own finding is that a warm
 *                              surface only competes when it shares the cast's VALUE
 *                              as well as its hue, so this is the load-bearing one.
 *   "same hue as the floor"    circular hue distance, saturation-weighted, same pixels.
 *   "flat"                     stdev of L across the mark's own pixels, against the
 *                              stdev of the floor it replaced. A mark with less
 *                              internal value structure than the floor it covers is
 *                              flat by measurement, not by opinion.
 *   "destroys the read"        the cast's figure/ground (edge L vs surround L) measured
 *                              TWICE in the same frame — with the trail visible and
 *                              with it hidden. This is the mechanism: the mark is a
 *                              ground decal BEHIND the fighter, so it cannot repaint
 *                              the cast; what it does is replace the local background
 *                              with one that shares the cast's value and hue.
 *
 * ⚠️ The floor moved (`ce49cd3` lifted the arena a full stop, and stains/kerbs/grime
 * were re-valued after). Every floor number here is measured TODAY, off the running
 * scene. Nothing is quoted from a record.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/trail_probe.mjs --url {URL}
 *   node tools/tmp/trail_probe.mjs --url $URL --selftest    # known-input controls only
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
const OUT = String(args.out ?? 'shots/trail');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
const DELTA = Number(args.delta ?? 6);
/** Seconds of real running before the clock is frozen. `TRAIL.dropIntervalMs` is 160
 * and `durationMs` 4500, so 1.6 s of movement leaves ~10 live marks with the fighter
 * standing on the freshest — which is the shipped situation for Donut every time it
 * moves, not a contrived one. */
const RUN_MS = Number(args.run ?? 7200);
/** Marks the run must produce before anything below is believed. `TRAIL.durationMs`
 * 4500 / `dropIntervalMs` 160 says a continuously-moving Donut carries up to 28; a
 * run that finds one or two has failed to move the fighter, not found a small trail. */
const MIN_MARKS = Number(args.minMarks ?? 3);

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
  });
}

async function installHarness(page) {
  await page.evaluate(([rw, rh, delta]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const c2d = cv.getContext('2d', { willReadFrequently: true });

    const grab = () => {
      stage.render(0);
      c2d.clearRect(0, 0, rw, rh);
      c2d.drawImage(stage.canvas, 0, 0, rw, rh);
      return c2d.getImageData(0, 0, rw, rh).data;
    };
    // Identical to `tools/tmp/vfx_hue.mjs`'s, deliberately: the hue-contract numbers
    // in `game/vfx.ts` were produced by that formula and these have to be comparable
    // to them (`docs/LESSONS.md` §3 — never compare numbers across instruments that
    // define the quantity differently).
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
    /** Saturation-weighted circular hue mean + plain sat/L means + the L STDEV, over
     * an index set. The stdev is the "flat" column and is the reason this cannot just
     * call `vfx_hue`'s version. */
    const stats = (img, idx) => {
      let sx = 0, sy = 0, wsum = 0, ssum = 0, lsum = 0, l2 = 0;
      for (const p of idx) {
        const i = p * 4;
        const [h, s, l] = hsl(img[i], img[i + 1], img[i + 2]);
        const a = (h * Math.PI) / 180;
        sx += Math.cos(a) * s; sy += Math.sin(a) * s; wsum += s;
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

    /** Every mesh in the VFX layer that is a persistent GROUND mark, i.e. what the
     * critics called "the weapon trail". `syncPool` creates splats and trail marks
     * with the default renderOrder 0, which is what separates them from every
     * transient in the layer (3/4 status rings, 5 wedges, 6 rings, 10/11 sprites). */
    const groundMarks = () => {
      let layer = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
      const out = [];
      if (layer) layer.traverse((o) => { if (o.isMesh && o.visible && o.renderOrder === 0) out.push(o); });
      return out;
    };
    const castRoots = () => {
      const out = [];
      stage.scene.traverse((o) => { if (typeof o.name === 'string' && o.name.startsWith('character:') && o.visible) out.push(o); });
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
    /** One 4-neighbour dilation step. Used to build the thin bands the figure/ground
     * measurement reads — `docs/LESSONS.md` §13 records the shipped definition as
     * "edge 0.571 vs surround 0.301", i.e. a band just inside the silhouette against a
     * band just outside it, which is what a player's eye actually resolves. */
    const dilate = (s) => {
      const o = new Uint8Array(s.length);
      for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
          const p = y * rw + x;
          if (s[p] || (x > 0 && s[p - 1]) || (x < rw - 1 && s[p + 1])
            || (y > 0 && s[p - rw]) || (y < rh - 1 && s[p + rw])) o[p] = 1;
        }
      }
      return o;
    };
    const erode = (s) => {
      const o = new Uint8Array(s.length);
      for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
          const p = y * rw + x;
          if (!s[p]) continue;
          if (x > 0 && !s[p - 1]) continue;
          if (x < rw - 1 && !s[p + 1]) continue;
          if (y > 0 && !s[p - rw]) continue;
          if (y < rh - 1 && !s[p + rw]) continue;
          o[p] = 1;
        }
      }
      return o;
    };
    /**
     * Two thin bands either side of the cast's silhouette, with a GUARD RING skipped
     * on both sides.
     *
     * ⚠️ THE GUARD RING IS THE WHOLE POINT AND ITS ABSENCE MADE THIS INSTRUMENT LIE.
     * The first version took the edge band as the outermost k pixels of the cast mask
     * and the surround as the k pixels immediately outside it — i.e. exactly the
     * ANTIALIASED BOUNDARY, whose pixels are blends of cast and ground. So both bands
     * tracked whatever was on the ground, and a change that only altered the ground
     * moved the "cast edge" by 0.085-0.122 luma. Measured on a change that darkened the
     * ground, it reported the cast's own edge getting darker — a property of the mask,
     * not of the cast.
     *
     * Skipping k pixels on each side puts the edge band k..2k INSIDE the silhouette
     * (pure cast) and the surround band k..2k OUTSIDE it (pure ground), which is the
     * relationship `docs/LESSONS.md` §13 records as the shipped one ("edge 0.571 vs
     * surround 0.301"). Bloom still crosses the gap — that is real and belongs in the
     * measurement — but a blended boundary pixel no longer counts as both.
     */
    const bandsOf = (set, k) => {
      let e1 = set;
      for (let i = 0; i < k; i++) e1 = erode(e1);
      let e2 = e1;
      for (let i = 0; i < k; i++) e2 = erode(e2);
      let d1 = set;
      for (let i = 0; i < k; i++) d1 = dilate(d1);
      let d2 = d1;
      for (let i = 0; i < k; i++) d2 = dilate(d2);
      const edge = [], surround = [];
      for (let p = 0; p < set.length; p++) {
        if (e1[p] && !e2[p]) edge.push(p);
        else if (d2[p] && !d1[p]) surround.push(p);
      }
      return { edge, surround };
    };

    /**
     * Group the live ground marks by MATERIAL, not by mesh.
     *
     * ⚠️ Two reasons, and the second one is a bug this probe would otherwise have.
     *
     * 1. `game/vfx.ts` hands one shared material to every mesh of a kind — one
     *    `splatMat`, one `trailMats.player`, one `trailMats.enemy` — so grouping by
     *    material is exactly the population split the critics described ("the weapon
     *    TRAIL", not "the splats"), and it needs no change to the shipped source.
     * 2. The save/restore in `controlPaint` MUST be per material. With one material
     *    shared by N meshes, a per-mesh save reads back what the previous mesh's write
     *    already put there, and the restore loop then writes the CONTROL colour back
     *    over the real one — permanently, in a pooled material the shipped game reuses
     *    forever. That is verbatim the bug `f12c9de` found in the cast matte
     *    ("captures 2..n read back the magenta capture 1 wrote"). Deduping by
     *    `material.uuid` is what stops it.
     */
    const markGroups = () => {
      const byMat = new Map();
      for (const o of groundMarks()) {
        const m = o.material;
        if (!byMat.has(m.uuid)) byMat.set(m.uuid, { mat: m, hex: '#' + m.color.getHexString().toUpperCase(), meshes: [] });
        byMat.get(m.uuid).meshes.push(o);
      }
      return [...byMat.values()];
    };

    /**
     * LOCAL boundary contrast: the mean, over edge pixels, of |L(edge pixel) − mean L
     * of the surround pixels near it|.
     *
     * ⚠️ THE DIFFERENCE OF TWO MEANS IS THE WRONG STATISTIC HERE AND IT GAVE THIS
     * PROBE A WRONG ANSWER. `|mean(edge) − mean(surround)|` cancels: a figure with a
     * light half and a dark half sitting on a ground BETWEEN those two values averages
     * to the same number as the ground and reports separation 0.0008 — while the
     * rendered PNG shows a plainly legible character. That is `docs/LESSONS.md` §13's
     * "a metric can be perfectly TRUE and still tell you nothing", and non-negotiable
     * #3 (judge the pixels) is what caught it.
     *
     * Taking the mean of per-pixel ABSOLUTE differences against a LOCAL surround does
     * not cancel, and it is closer to what an eye does at a boundary — it asks "is
     * there a step here", pixel by pixel, rather than "are these two populations
     * centred in the same place". Both are reported; they answer different questions.
     */
    const localContrast = (img, edge, surround) => {
      const sSet = toSet(surround);
      const lOf = (p) => { const i = p * 4; return hsl(img[i], img[i + 1], img[i + 2])[2]; };
      const R = 6;
      let acc = 0, used = 0;
      for (const p of edge) {
        const x = p % rw, y = (p / rw) | 0;
        let sum = 0, n = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= rh) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= rw) continue;
            const q = yy * rw + xx;
            if (!sSet[q]) continue;
            sum += lOf(q); n++;
          }
        }
        if (!n) continue;
        acc += Math.abs(lOf(p) - sum / n);
        used++;
      }
      return used ? +(acc / used).toFixed(4) : 0;
    };

    window.__trail = {
      /** Live ground-mark meshes, and their world footprint — the complexity counter. */
      census() {
        const g = markGroups();
        return {
          marks: groundMarks().length, casts: castRoots().length,
          groups: g.map((x) => ({ hex: x.hex, opacity: x.mat.opacity, n: x.meshes.length })),
        };
      },
      /** `markVsFloor`, restricted to one material's meshes — so "the trail" and "the
       * splats" are never averaged into one meaningless number. */
      groupVsFloor(hex) {
        const g = markGroups().find((x) => x.hex === hex);
        if (!g) return { n: 0 };
        const others = groundMarks().filter((o) => !g.meshes.includes(o));
        for (const o of others) o.visible = false;
        const r = window.__trail.markVsFloor();
        for (const o of others) o.visible = true;
        return r;
      },
      /**
       * THE HEADLINE. Hide the ground marks, re-show them, and compare the two frames
       * over exactly the pixels that moved.
       *
       * `mark` is what the player sees; `floor` is what that same pixel would be if the
       * mark were not there. Their difference is what "reads as a mark" means, and
       * nothing else in this repo has ever computed it.
       */
      markVsFloor() {
        const marks = groundMarks();
        if (!marks.length) return { n: 0 };
        const withMark = grab();
        for (const o of marks) o.visible = false;
        const withoutMark = grab();
        for (const o of marks) o.visible = true;
        const idx = maskOf(withMark, withoutMark);
        if (!idx.length) return { n: 0 };
        const mark = stats(withMark, idx);
        const floor = stats(withoutMark, idx);
        return {
          n: idx.length,
          coverage: +(idx.length / (rw * rh)).toFixed(4),
          mark, floor,
          dL: +Math.abs(mark.luma - floor.luma).toFixed(4),
          dHue: +(() => { const d = Math.abs(mark.hue - floor.hue) % 360; return d > 180 ? 360 - d : d; })().toFixed(1),
          dSat: +(mark.sat - floor.sat).toFixed(3),
          flatness: +(mark.lStdev / Math.max(1e-6, floor.lStdev)).toFixed(3),
        };
      },
      /**
       * THE MECHANISM. The cast's figure/ground, measured twice in one frame: once as
       * shipped, once with the ground marks hidden.
       *
       * The mark is a ground decal at 0.31 m with depth testing ON, so the fighter
       * standing on it occludes it — it CANNOT repaint the cast. What it can do is
       * replace the fighter's local background with a surface at the cast's own value.
       * A drop from `noTrail` to `onTrail` is that, in numbers.
       */
      figureGround(k) {
        const casts = castRoots();
        if (!casts.length) return null;
        const marks = groundMarks();
        const shipped = grab();
        for (const o of casts) o.visible = false;
        const noCast = grab();
        for (const o of casts) o.visible = true;
        const castIdx = maskOf(shipped, noCast);
        if (castIdx.length < 200) return { n: castIdx.length, tooSmall: true };
        const { edge, surround } = bandsOf(toSet(castIdx), k);
        const onEdge = stats(shipped, edge);
        const onSur = stats(shipped, surround);
        // Same masks, trail hidden — so the ONLY thing that differs is the trail.
        for (const o of marks) o.visible = false;
        const noTrail = grab();
        for (const o of marks) o.visible = true;
        const offSur = stats(noTrail, surround);
        const offEdge = stats(noTrail, edge);
        return {
          castPx: castIdx.length, edgePx: edge.length, surroundPx: surround.length,
          onTrail: {
            edge: onEdge.luma, surround: onSur.luma, surHue: onSur.hue,
            dL: +Math.abs(onEdge.luma - onSur.luma).toFixed(4),
            localDL: localContrast(shipped, edge, surround),
          },
          noTrail: {
            edge: offEdge.luma, surround: offSur.luma, surHue: offSur.hue,
            dL: +Math.abs(offEdge.luma - offSur.luma).toFixed(4),
            localDL: localContrast(noTrail, edge, surround),
          },
        };
      },
      /**
       * The CAST's own population, read off the shipped frame over an ERODED cast
       * matte (pure cast pixels, no antialiased boundary).
       *
       * ⚠️ This is the comparison the critic phrase does not name and the pictures do.
       * "Same value and hue as the FLOOR" is checkable and half of it is false — the
       * old mark cleared the floor by 0.285 luma. What the judgement frame actually
       * shows is a pink disc under a PINK CHARACTER: the mark matching the CAST, which
       * is the relationship `vfx.ts`'s hue contract already governs for transients
       * (rule 1, ">= 0.15 from the cast's luma") and never extended to ground marks.
       * A rule that is checked against the wrong population is not a rule.
       */
      castVsMark() {
        const casts = castRoots();
        const marks = groundMarks();
        if (!casts.length || !marks.length) return null;
        const shipped = grab();
        for (const o of casts) o.visible = false;
        const noCast = grab();
        for (const o of casts) o.visible = true;
        let castSet = toSet(maskOf(shipped, noCast));
        for (let i = 0; i < 2; i++) castSet = erode(castSet);
        const castIdx = [];
        for (let p = 0; p < castSet.length; p++) if (castSet[p]) castIdx.push(p);
        if (castIdx.length < 100) return null;
        for (const o of marks) o.visible = false;
        const noMark = grab();
        for (const o of marks) o.visible = true;
        const markIdx = maskOf(shipped, noMark);
        if (!markIdx.length) return null;
        const cast = stats(shipped, castIdx);
        const mark = stats(shipped, markIdx);
        return {
          cast, mark,
          dL: +Math.abs(mark.luma - cast.luma).toFixed(4),
          dHue: +(() => { const d = Math.abs(mark.hue - cast.hue) % 360; return d > 180 ? 360 - d : d; })().toFixed(1),
        };
      },
      /** KNOWN-INPUT CONTROL. Force every ground mark to a colour this probe was not
       * told about and check the reported hue/luma comes back as that colour. An
       * instrument that cannot recover a known input must not be believed on an
       * unknown one (`docs/LESSONS.md` §13 — seventeen caught lying this session). */
      controlPaint(hex) {
        const groups = markGroups();   // per MATERIAL — see the note above
        const saved = groups.map((g) => ({ mat: g.mat, c: g.mat.color.clone(), op: g.mat.opacity }));
        for (const s of saved) { s.mat.color.set(hex); s.mat.opacity = 1; }
        const r = window.__trail.markVsFloor();
        for (const s of saved) { s.mat.color.copy(s.c); s.mat.opacity = s.op; }
        return r;
      },
      /** KNOWN-INPUT CONTROL. Every mark hidden — the ablation must find nothing. */
      controlHidden() {
        const marks = groundMarks();
        for (const o of marks) o.visible = false;
        const r = window.__trail.markVsFloor();
        for (const o of marks) o.visible = true;
        return r;
      },
      shot() { stage.render(0); },
    };
  }, [RW, RH, DELTA]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let failures = 0;
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);
    // Donut is the only character with `hasTrail`. It drops a mark every 160 ms WHILE
    // MOVING, so the probe has to actually move — a parked fighter lays nothing.
    await page.goto(`${BASE}/?player=donut&enemy=hamburger&simSpeed=1&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120000 });

    // Real key events, as `input_accept` validated — not a synthetic state poke.
    //
    // ⚠️ FOUR directions in sequence, not one. The first version held `d` for 1.8 s and
    // produced exactly ONE mark against the eleven `TRAIL.dropIntervalMs` predicts: the
    // fighter walks into cover and `tryMove` refuses every step, so `attemptedMove`
    // goes false and the drop timer resets — silently, with the key still held. A probe
    // that measures one mark when it asked for eleven is measuring its own setup
    // (`docs/LESSONS.md` §10). Cycling directions means a wall in one of them cannot
    // stop the run, and the curved path is also what a real Donut lays.
    const track = [];
    for (const k of ['d', 's', 'a', 'w', 'd', 's']) {
      await page.keyboard.down(k);
      await page.waitForTimeout(Math.round(RUN_MS / 6));
      await page.keyboard.up(k);
      track.push(await page.evaluate((key) => {
        const f = window.__vfxDebugFighters?.player;
        const d = window.__matchDebug;
        return { key, x: Math.round(f?.x ?? -1), y: Math.round(f?.y ?? -1), mx: d?.moveX, my: d?.moveY, phase: d?.phase };
      }, k));
    }
    log('  movement track: ' + track.map((t) => `${t.key}(${t.x},${t.y})`).join(' -> '));
    log('  last move vector ' + JSON.stringify(track[track.length - 1]));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await installHarness(page);

    const census = await page.evaluate(() => window.__trail.census());
    log(`\nlive ground marks: ${census.marks}   ·   cast roots in scene: ${census.casts}`);
    for (const g of census.groups) log(`    ${g.hex}  opacity ${g.opacity}  x${g.n}`);
    if (census.marks < MIN_MARKS) {
      log(`ONLY ${census.marks} GROUND MARKS (want >= ${MIN_MARKS}) — the probe did not move the fighter far enough.`);
      failures++;
    }

    // ── KNOWN-INPUT CONTROLS ───────────────────────────────────────────────────
    const hidden = await page.evaluate(() => window.__trail.controlHidden());
    const green = await page.evaluate(() => window.__trail.controlPaint('#00C000'));
    const shipped = await page.evaluate(() => window.__trail.markVsFloor());
    const restored = await page.evaluate(() => window.__trail.markVsFloor());
    log('\n══ INSTRUMENT VALIDATION (known inputs) ═══════════════════════════════════');
    log(`  A every mark hidden                 n=${pad(hidden.n, 8)}(want 0)`);
    log(`  B marks forced to #00C000 (hue 120) hue=${pad(green.mark ? green.mark.hue : '-', 8)}(want ~120)  |dL| ${green.dL ?? '-'}`);
    log(`  C shipped, measured twice           n=${pad(shipped.n, 8)}/ ${restored.n}  (want equal — restore integrity)`);
    const ok = hidden.n === 0 && green.mark && Math.abs(green.mark.hue - 120) < 12 && shipped.n > 200
      && Math.abs(shipped.n - restored.n) <= Math.max(20, shipped.n * 0.02);
    log(ok ? '  → INSTRUMENT VALID' : '  → INSTRUMENT INVALID — nothing below is trustworthy');
    if (!ok) failures++;
    if (args.selftest) { await browser.close(); process.exit(ok ? 0 : 1); }

    // ── THE MEASUREMENT ────────────────────────────────────────────────────────
    log('\n══ GROUND MARKS vs THE FLOOR THEY COVER (same frame, same pixels) ═════════');
    log(`  delivered ${shipped.n} px = ${(shipped.coverage * 100).toFixed(2)}% of the frame`);
    log(`${pad('', 12)}${pad('hue', 9)}${pad('sat', 9)}${pad('luma', 9)}L stdev`);
    log(`  ${pad('MARK', 10)}${pad(shipped.mark.hue, 9)}${pad(shipped.mark.sat, 9)}${pad(shipped.mark.luma, 9)}${shipped.mark.lStdev}`);
    log(`  ${pad('FLOOR', 10)}${pad(shipped.floor.hue, 9)}${pad(shipped.floor.sat, 9)}${pad(shipped.floor.luma, 9)}${shipped.floor.lStdev}`);
    log(`\n  |dL| vs floor      ${shipped.dL}      <- "same VALUE as the floor"`);
    log(`  hue distance       ${shipped.dHue}°     <- "same HUE as the floor"`);
    log(`  flatness           ${shipped.flatness}x     <- internal L structure vs the floor's ( <1 = FLATTER than the floor )`);

    // Per material — averaging a pink trail with a red-orange splat is how a
    // population number stops meaning anything (`docs/LESSONS.md` §5).
    const perGroup = [];
    log(`\n  by MATERIAL (the population the critics named is the TRAIL, not the splats):`);
    log(`  ${pad('material', 11)}${pad('n', 8)}${pad('mark L', 9)}${pad('floor L', 9)}${pad('|dL|', 8)}${pad('mark hue', 10)}${pad('floor hue', 11)}${pad('dHue', 7)}flatness`);
    for (const g of census.groups) {
      const r = await page.evaluate((h) => window.__trail.groupVsFloor(h), g.hex);
      perGroup.push({ hex: g.hex, ...r });
      if (!r.n) { log(`  ${pad(g.hex, 11)}(no delivered pixels)`); continue; }
      log(`  ${pad(g.hex, 11)}${pad(r.n, 8)}${pad(r.mark.luma, 9)}${pad(r.floor.luma, 9)}${pad(r.dL, 8)}${pad(r.mark.hue, 10)}${pad(r.floor.hue, 11)}${pad(r.dHue, 7)}${r.flatness}x`);
    }

    const cvm = await page.evaluate(() => window.__trail.castVsMark());
    if (cvm) {
      log('\n══ GROUND MARK vs THE CAST STANDING IN IT (same frame) ════════════════════');
      log(`  ${pad('CAST', 8)}hue ${pad(cvm.cast.hue, 8)}sat ${pad(cvm.cast.sat, 8)}L ${cvm.cast.luma}   (n=${cvm.cast.n})`);
      log(`  ${pad('MARK', 8)}hue ${pad(cvm.mark.hue, 8)}sat ${pad(cvm.mark.sat, 8)}L ${cvm.mark.luma}   (n=${cvm.mark.n})`);
      log(`  |dL| vs the cast   ${cvm.dL}      hue distance ${cvm.dHue}°`);
      log(`  (the hue contract asks transients for |dL| >= 0.15 from the cast; ground marks were never held to it)`);
    }

    const fg = await page.evaluate(() => window.__trail.figureGround(3));
    if (fg && !fg.tooSmall) {
      log('\n══ THE CAST\'S FIGURE/GROUND, WITH AND WITHOUT THE TRAIL (one frame) ═══════');
      log(`  cast matte ${fg.castPx} px · edge band ${fg.edgePx} · surround band ${fg.surroundPx}`);
      log(`${pad('', 14)}${pad('edge L', 10)}${pad('surround L', 12)}${pad('|dL| means', 12)}${pad('LOCAL |dL|', 12)}surround hue`);
      log(`  ${pad('as shipped', 12)}${pad(fg.onTrail.edge, 10)}${pad(fg.onTrail.surround, 12)}${pad(fg.onTrail.dL, 12)}${pad(fg.onTrail.localDL, 12)}${fg.onTrail.surHue}`);
      log(`  ${pad('trail hidden', 12)}${pad(fg.noTrail.edge, 10)}${pad(fg.noTrail.surround, 12)}${pad(fg.noTrail.dL, 12)}${pad(fg.noTrail.localDL, 12)}${fg.noTrail.surHue}`);
      const cost = +(fg.noTrail.dL - fg.onTrail.dL).toFixed(4);
      const costL = +(fg.noTrail.localDL - fg.onTrail.localDL).toFixed(4);
      log(`\n  cost by |dL| of MEANS    ${cost >= 0 ? '-' : '+'}${Math.abs(cost)}`
        + `   (${((cost / Math.max(1e-6, fg.noTrail.dL)) * 100).toFixed(1)}%)   <- cancels on a multi-valued figure, see localContrast`);
      log(`  cost by LOCAL |dL|       ${costL >= 0 ? '-' : '+'}${Math.abs(costL)}`
        + `   (${((costL / Math.max(1e-6, fg.noTrail.localDL)) * 100).toFixed(1)}%)   <- the one to act on`);
    } else {
      log('\n  figure/ground: cast matte too small to measure at this framing.');
    }

    await page.evaluate(() => window.__trail.shot());
    await page.screenshot({ path: `${OUT}/trail.png` });
    await writeFile(`${OUT}/trail.json`, JSON.stringify({ census, shipped, perGroup, cvm, fg, base: BASE }, null, 2));
    log(`\npng -> ${OUT}/trail.png   json -> ${OUT}/trail.json`);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
}

await main();
