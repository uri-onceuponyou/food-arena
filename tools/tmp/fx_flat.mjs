#!/usr/bin/env node
/**
 * FX_FLAT — DOES A VFX READ AS A LIT VOLUME, OR AS A PASTED STICKER?
 *
 * ── The complaint, and why AREA is the wrong instrument for it ─────────────────
 *
 * Uri, from gameplay: *"projectiles and explosions still look very flat and not like
 * what they are supposed to."* Four blind critics independently: *"a flat,
 * uniformly-saturated blob with no internal gradient or shading, so it reads as a
 * pasted sticker rather than a lit in-world effect"*.
 *
 * `209e270` already measured area's rank correlation with legibility at **0.230**
 * against the weapon's own lightness at **-0.738**, and `wv_area`/`wi_guard` already
 * count PIXELS. Nothing here counts what is INSIDE those pixels. This does.
 *
 * ⚠️ **AND THE CRITIC'S OWN MECHANISM DOES NOT SURVIVE MEASUREMENT.** *"No internal
 * gradient or shading"* is false — interior luma sd is 20.22 and a third of the
 * interior sits in a smooth band. The structure is **PLATEAUS from overlapping lobes
 * at different opacities**, not an absence of variation. Symptom right, mechanism
 * wrong, and the mechanism is what gets fixed — so this file measures the difference
 * between a STEP and a RAMP rather than "is there variation".
 *
 * ── THE METRICS, and each one's units ─────────────────────────────────────────
 *
 * Every one is taken over the STRICT INTERIOR of a same-frame ABLATION mask (the
 * effect's real delivered footprint in this exact frame, never a box), eroded by
 * `--erode` px so the silhouette's own edge cannot masquerade as internal structure.
 *
 *   flatShare   share of interior px with |grad luma| < `--flatEps` (default 0.5).
 *               Luma is 0..255 (Rec.709), gradient by central differences, so the
 *               units are luma-per-pixel. This is the brief's own definition,
 *               reproduced rather than invented, so its number is comparable.
 *   meanGrad    mean |grad luma| over the interior. Same units.
 *   gradFine    mean |Laplacian(3x3) luma| over the interior — STEP energy.
 *   gradCoarse  mean |grad luma| of a box-blurred (radius `--blur`, default 3) luma
 *               over the interior — SMOOTH SHADING energy.
 *   stepRatio   gradFine / gradCoarse. **Dimensionless**, so it survives a change of
 *               camera, of framing and of the effect's colour. A pile of hard-edged
 *               translucent lobes reads HIGH; one mass with a core and a falloff
 *               reads LOW. This is the metric the corrected mechanism names.
 *   falloffR    Pearson r of interior luma against normalised radius from the mask's
 *               own centroid. A sticker reads ~0; a lit ball with a bright core and a
 *               falloff reads strongly NEGATIVE. **This is "has a core", stated as a
 *               number.**
 *   segRatio    meanGrad(interior) / meanGrad(boundary band) — `pl_stack.mjs`'s
 *               dimensionless segmentation statistic, reused verbatim in spirit: the
 *               contour a mass is SUPPOSED to have is the one around its outside.
 *
 * 🚨 **`flatShare` IS THE ONLY THRESHOLDED ONE AND IT IS HERE ONLY TO BE COMPARABLE
 * WITH THE BRIEF.** `CLAUDE.md` rule 6's worst case this session was two arms "false
 * BY CONSTRUCTION — a single threshold cut through one continuous population". Every
 * decision below is taken on `stepRatio` and `falloffR`, which have no cut in them.
 *
 * ── THE REFERENCE ARM: the lit geometry standing in the SAME frame ─────────────
 *
 * A flatness number alone means nothing (`AGENT-BRIEF §4.7` — a baseline is itself a
 * measurement). So every run also measures the FIGHTER BODIES in the identical frame,
 * by the identical code, on a mask built by the identical ablation (the character root
 * is hidden and the frame re-rendered). Those meshes are `toonMat`
 * `MeshStandardMaterial` with a Fresnel rim; the VFX layer is 100% unlit
 * `MeshBasicMaterial`/`SpriteMaterial`. The ratio between the two columns is the
 * claim, not either column alone.
 *
 * ── VALIDATION — what implementation would FAIL each arm (CLAUDE.md rule 6) ────
 *
 *   §A NON-EMPTY   mask / interior / boundary are each asserted above a floor BEFORE
 *                  any mean is taken. `[].every()` is true and a mean over an empty
 *                  set is NaN or 0 — both read as a pass. Fails if the effect never
 *                  fired, if the ablation found nothing, or if `--erode` ate the mask.
 *   §B DRIFT       the same measurement twice on one frozen frame must be **EXACTLY**
 *                  equal, on every column. Fails on camera shake (it re-randomises at
 *                  dt = 0), on a live clock, on a CSS keyframe under the canvas.
 *   §C FLATTEN     every VFX sprite texture is repainted as a HARD-EDGED UNIFORM DISC
 *                  — no falloff, no core, silhouette unchanged — in the shipped
 *                  materials, re-rendered through the shipped post chain, same frame.
 *                  `flatShare` must RISE and `|falloffR|` must FALL. Fails on a
 *                  saturated counter, on a mask that does not cover the effect, and on
 *                  a tool reading a stale texture upload.
 *   §D SHADE       the same textures repainted with a STRONG radial ramp — bright
 *                  core, smooth falloff, same silhouette. `flatShare` must FALL and
 *                  `falloffR` must go MORE NEGATIVE. §C and §D are a MOVES pair in
 *                  both directions, so a column that had quietly become a constant
 *                  fails at least one of them.
 *   §E RESTORE     the original texture pixels are put back and the frame must return
 *                  **BIT-IDENTICAL**. This is the SELF-PAIR: it is the one way this
 *                  file could report a confident wrong answer.
 *   §F SUBJECT     the effect's mask centroid must be INSIDE the frame and the mask
 *                  must overlap the fired position's projection. A tool that
 *                  photographed the sky and reported PASS is on record here.
 *
 * ── USE ───────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-fx1 -- \
 *     node tools/tmp/fx_flat.mjs --url '{URL}' --out shots/fx/head
 *   ... --pitch 20     the lobby-analogue detector (CLAUDE.md #3 — verify at BOTH)
 *   ... --selftest     runs §B..§F and exits non-zero if any arm fails
 *   ... --crops        also writes a 4x crop of every case, centred on its own mask
 *
 * ⚠️ Never `:5173`, never `with_snapshot` for a number you will quote — a detached
 * worktree of a commit (`AGENT-BRIEF §3`).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

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
if (!BASE) { console.error('fx_flat: --url or PREVIEW_BASE required (never the shared dev server)'); process.exit(2); }
const OUT = String(args.out ?? 'shots/fx');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
const ERODE = Number(args.erode ?? 3);
const BLUR = Number(args.blur ?? 3);
const FLAT_EPS = Number(args.flatEps ?? 0.5);
const SEED = Number(args.seed ?? 777);
const SLICE = Number(args.slice ?? 160);
const MIN_MASK = Number(args.minMask ?? 400);
const MIN_INTERIOR = Number(args.minInterior ?? 120);
const SELFTEST = !!args.selftest;
const CROPS = !!args.crops;
const ONLY = args.only ? String(args.only).split(',') : null;
const LABEL = String(args.label ?? 'run');

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : 'n/a');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : 'n/a');
const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : 'n/a');

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'fx-still';
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
    window.__rng = { seed(v) { st = ((v >>> 0) || 1); } };
  });
}

/* eslint-disable */
async function installHarness(page, w, h) {
  await page.evaluate(([WV, HV]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = WV; cv.height = HV;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    const still = () => {
      const r = stage.rig; if (!r) return;
      r.shakeAmount = 0;
      if (r.shakeOffset && r.shakeOffset.set) r.shakeOffset.set(0, 0, 0);
    };
    const grab = () => {
      still(); stage.render(0);
      c2.clearRect(0, 0, WV, HV); c2.drawImage(stage.canvas, 0, 0, WV, HV);
      return c2.getImageData(0, 0, WV, HV).data;
    };
    // ⚠️ THE FIRST VERSION LOOKED FOR A DESCENDANT NAMED `torso_mesh` AND FOUND ZERO
    // ROOTS — `rig.ts` only names one on the archetypes that build a torso mesh, so
    // the reference arm would have been measured over an EMPTY mask. It went RED
    // rather than quietly reporting a flat baseline, which is §A doing its job.
    // `match.ts:1018` adds one top-level `character:<id>` Group per fighter.
    const charRoots = () => stage.scene.children.filter((o) => o.name.startsWith('character:'));
    window.__fx = {
      w: WV, h: HV,
      grab: () => Array.from(grab()),
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      /**
       * 🚨 `clear()` ALONE IS NOT A RESET, AND THE HOLE IS INVISIBLE TO A PAIRED MASK.
       * A leftover sim-synced projectile sits in BOTH the base and the effect frame, so
       * it cancels — UNLESS `updateEffects` animates it between the two grabs, which
       * `trail()` does on every bespoke projectile. Measured: `impact.pizza.Tomato`
       * read **1308 px as the first case and 1573 px after ten others had run**, on a
       * frozen clock, at the same seed. Two runs that differ by their POSITION IN THE
       * RUN are not an A/B. An empty `sync()` retires the sim pools as well.
       */
      reset() {
        window.__vfxLayer.clear();
        const fi = window.__vfxDebugFighters;
        const mk = (role) => ({
          characterId: role === 'player' ? 'hamburger' : 'donut',
          x: fi[role].x, y: fi[role].y, hp: 100, maxHp: 100, alive: true,
          facing: { x: 1, y: 0 }, terrainSlowFactor: 1,
          status: { slowedUntil: 0, stunnedUntil: 0 },
        });
        window.__vfxLayer.sync({
          elapsed: 0, projectiles: [], splats: [], trailMarks: [],
          player: mk('player'), enemy: mk('enemy'),
        });
      },
      charRootCount: () => charRoots().length,
      setCharsVisible(v) {
        const roots = charRoots();
        for (const r of roots) r.visible = v;
        return roots.length;
      },
      setPitch(deg, widthUnits) {
        const rig = stage.rig; if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },
    };
  }, [w, h]);
}
/* eslint-enable */

// ── THE METRIC CORE, in Node, over a Uint8 RGBA pair ──────────────────────────
function lumaOf(buf, w, h) {
  const L = new Float32Array(w * h);
  for (let i = 0, p = 0; i < buf.length; i += 4, p++) {
    L[p] = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
  }
  return L;
}
function maskOf(cur, base, w, h, delta) {
  const m = new Uint8Array(w * h);
  let n = 0;
  for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
    const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
    if (d >= delta) { m[p] = 1; n++; }
  }
  return { m, n };
}
function erode(m, w, h, r) {
  let cur = m;
  for (let it = 0; it < r; it++) {
    const nx = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (cur[p] && cur[p - 1] && cur[p + 1] && cur[p - w] && cur[p + w]) nx[p] = 1;
      }
    }
    cur = nx;
  }
  let n = 0;
  for (let i = 0; i < cur.length; i++) n += cur[i];
  return { m: cur, n };
}
function boxBlur(L, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0; let c = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += L[y * w + xx]; c++; } }
      tmp[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0; let c = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; c++; } }
      out[y * w + x] = s / c;
    }
  }
  return out;
}
function gradMag(L, w, h, p) {
  const gx = (L[p + 1] - L[p - 1]) * 0.5;
  const gy = (L[p + w] - L[p - w]) * 0.5;
  return Math.hypot(gx, gy);
}
function lap(L, w, h, p) {
  return Math.abs(4 * L[p] - L[p - 1] - L[p + 1] - L[p - w] - L[p + w]);
}

/**
 * §A NON-EMPTY is enforced HERE, before any mean exists — a mean over an empty set is
 * NaN or 0 and both read as a pass.
 */
function metrics(cur, base, w, h, opts) {
  const { m: mask, n: maskN } = maskOf(cur, base, w, h, opts.delta);
  if (maskN < opts.minMask) return { vacuous: `mask ${maskN} px < floor ${opts.minMask}` , maskPx: maskN };
  const { m: inner, n: innerN } = erode(mask, w, h, opts.erode);
  if (innerN < opts.minInterior) return { vacuous: `interior ${innerN} px < floor ${opts.minInterior}`, maskPx: maskN, interiorPx: innerN };
  const boundN = maskN - innerN;
  if (boundN < 1) return { vacuous: `boundary band empty`, maskPx: maskN, interiorPx: innerN };

  const L = lumaOf(cur, w, h);
  const Lb = boxBlur(L, w, h, opts.blur);

  let cx = 0; let cy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { cx += x; cy += y; }
  cx /= maskN; cy /= maskN;

  let sumG = 0; let flatN = 0; let sumFine = 0; let sumCoarse = 0;
  let sumL = 0; let sumL2 = 0; let n = 0;
  let sumR = 0; let sumR2 = 0; let sumLR = 0;
  let maxR = 1e-6;
  const lums = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!inner[p]) continue;
      const r = Math.hypot(x - cx, y - cy);
      if (r > maxR) maxR = r;
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!inner[p]) continue;
      const g = gradMag(L, w, h, p);
      sumG += g;
      if (g < opts.flatEps) flatN++;
      sumFine += lap(L, w, h, p);
      sumCoarse += gradMag(Lb, w, h, p);
      const lv = L[p];
      lums.push(lv);
      sumL += lv; sumL2 += lv * lv;
      const r = Math.hypot(x - cx, y - cy) / maxR;
      sumR += r; sumR2 += r * r; sumLR += lv * r;
      n++;
    }
  }
  let sumGB = 0; let nb = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!mask[p] || inner[p]) continue;
      sumGB += gradMag(L, w, h, p); nb++;
    }
  }
  if (n < opts.minInterior) return { vacuous: `interior-in-bounds ${n} px < floor ${opts.minInterior}`, maskPx: maskN, interiorPx: innerN };
  if (nb < 1) return { vacuous: `boundary-in-bounds empty`, maskPx: maskN, interiorPx: innerN };

  const meanL = sumL / n;
  const sdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
  const meanR = sumR / n;
  const sdR = Math.sqrt(Math.max(0, sumR2 / n - meanR * meanR));
  const cov = sumLR / n - meanL * meanR;
  const falloffR = (sdL > 1e-9 && sdR > 1e-9) ? cov / (sdL * sdR) : NaN;
  lums.sort((a, b) => a - b);
  const q = (t) => lums[Math.min(lums.length - 1, Math.max(0, Math.round(t * (lums.length - 1))))];
  const p05 = q(0.05); const p50 = q(0.50); const p95 = q(0.95);
  const gradFine = sumFine / n;
  const gradCoarse = sumCoarse / n;
  return {
    maskPx: maskN, interiorPx: n, boundaryPx: nb,
    centroid: [Math.round(cx), Math.round(cy)],
    flatShare: flatN / n,
    meanGrad: sumG / n,
    gradFine, gradCoarse,
    stepRatio: gradCoarse > 1e-9 ? gradFine / gradCoarse : NaN,
    falloffR,
    segRatio: (sumGB / nb) > 1e-9 ? (sumG / n) / (sumGB / nb) : NaN,
    lumaSd: sdL,
    coreDrop: (p95 - p05) > 1e-9 ? (p95 - p50) / (p95 - p05) : NaN,
  };
}

const COLS = ['maskPx', 'flatShare', 'meanGrad', 'stepRatio', 'falloffR', 'segRatio', 'lumaSd', 'coreDrop'];
function row(label, m) {
  if (m.vacuous) return `${pad(label, 30)}  VACUOUS: ${m.vacuous}`;
  return `${pad(label, 30)}  ${rpad(m.maskPx, 7)}  ${rpad(pct(m.flatShare), 7)}  ${rpad(f2(m.meanGrad), 7)}`
    + `  ${rpad(f3(m.stepRatio), 7)}  ${rpad(f3(m.falloffR), 7)}  ${rpad(f3(m.segRatio), 7)}`
    + `  ${rpad(f2(m.lumaSd), 6)}  ${rpad(f3(m.coreDrop), 6)}`;
}
const HEAD = `${pad('case', 30)}  ${rpad('maskPx', 7)}  ${rpad('flat', 7)}  ${rpad('mGrad', 7)}`
  + `  ${rpad('step', 7)}  ${rpad('falloff', 7)}  ${rpad('seg', 7)}  ${rpad('sd', 6)}  ${rpad('core', 6)}`;

export { metrics, lumaOf, maskOf, erode };

// ── CASES ─────────────────────────────────────────────────────────────────────
/**
 * Two families, because Uri named two: **projectiles** and **explosions**. Weapons
 * chosen for what the critics were looking at — the RED damage VFX that resolved into
 * overlapping translucent primitives at 4x — plus one pale and one cool control so a
 * result cannot be a property of one hue.
 */
const CASES = [
  { id: 'impact.pizza.Tomato', kind: 'impact', cid: 'pizza', key: 'Tomato' },
  { id: 'impact.hamburger.Tomato', kind: 'impact', cid: 'hamburger', key: 'Tomato' },
  { id: 'impact.lollipop.Smash', kind: 'impact', cid: 'lollipop', key: 'Smash' },
  { id: 'impact.soup.Splash', kind: 'impact', cid: 'soup', key: 'Splash' },
  { id: 'impact.waterbottle.Glass', kind: 'impact', cid: 'waterbottle', key: 'Glass' },
  { id: 'impact.egg.Shards', kind: 'impact', cid: 'egg', key: 'Shards' },
  { id: 'proj.hamburger.Tomato', kind: 'proj', cid: 'hamburger', key: 'Tomato' },
  { id: 'proj.pizza.Tomato', kind: 'proj', cid: 'pizza', key: 'Tomato' },
  { id: 'proj.soup.Splash', kind: 'proj', cid: 'soup', key: 'Splash' },
  { id: 'proj.donut.Candy', kind: 'proj', cid: 'donut', key: 'Candy' },
  { id: 'proj.waterbottle.Cap', kind: 'proj', cid: 'waterbottle', key: 'Cap' },
];

async function fireCase(page, c, sliceMs, seed) {
  return page.evaluate(async ([w, slice, sd]) => {
    const rules = await import('/src/game/rules.ts');
    const weapon = rules.CHARACTERS[w.cid].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.cid}.${w.key}` };
    const fi = window.__vfxDebugFighters;
    const at = { x: fi.player.x, y: fi.player.y };
    window.__fx.reset();
    window.__fx.step(0);
    const base = window.__fx.grab();
    window.__rng.seed(sd);
    if (w.kind === 'impact') {
      window.__vfxLayer.spawnImpactBurst(at.x, at.y, weapon.color, weapon.damage,
        { weapon, characterId: w.cid, fromXWU: at.x - 60, fromYWU: at.y });
      window.__fx.step(slice);
    } else {
      const mk = (role, over) => ({
        characterId: role === 'player' ? w.cid : 'donut',
        x: fi[role].x, y: fi[role].y, hp: 100, maxHp: 100, alive: true,
        facing: { x: 1, y: 0 }, terrainSlowFactor: 1,
        status: { slowedUntil: 0, stunnedUntil: 0 },
        ...over,
      });
      const st = {
        elapsed: 1000, projectiles: [], splats: [], trailMarks: [],
        player: mk('player'), enemy: mk('enemy'),
      };
      st.projectiles = [{
        id: 1, x: at.x + 60, y: at.y, vx: 1, vy: 0,
        color: weapon.color, damage: weapon.damage, weapon, ownerRole: 'player', arrived: false,
      }];
      window.__vfxLayer.sync(st);
      st.elapsed = 1050;
      window.__vfxLayer.sync(st);
      window.__vfxLayer.updateEffects(0.05);
    }
    const cur = window.__fx.grab();
    window.__fx.reset();
    return { base, cur, at, color: weapon.color, damage: weapon.damage };
  }, [c, sliceMs, seed]);
}

// ── KNOWN-BADS §C / §D: repaint the SHIPPED sprite textures, in place ─────────
/**
 * `mat.map.image` is the `<canvas>` the builder drew into, so a known-bad is painted
 * into the SHIPPED material and re-rendered through the SHIPPED post chain, in the
 * SAME frame. Stamping into a captured PNG would validate a Sobel kernel; this
 * validates the instrument where it is actually POINTED (CLAUDE.md rule 6).
 */
async function repaintTextures(page, mode) {
  return page.evaluate((m) => {
    const layer = window.__vfxLayer;
    const seen = new Map();
    const collect = (o) => {
      if (!o) return;
      if (o.isTexture && o.image && o.image.getContext) seen.set(o.uuid, o);
    };
    // Every CanvasTexture this layer owns, reached off the instance rather than a
    // hard-coded list — a list would go stale the moment a texture is added.
    for (const k of Object.keys(layer)) {
      const v = layer[k];
      collect(v);
      if (Array.isArray(v)) for (const e of v) { collect(e); if (e && e.mat) collect(e.mat.map); }
    }
    window.__stage.scene.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const mt of mats) collect(mt.map);
    });
    const list = [...seen.values()];
    if (!list.length) return { ok: false, why: 'no CanvasTexture reachable — a repaint that paints nothing is a vacuous known-bad' };
    if (m === 'save') {
      window.__fxSaved = list.map((t) => {
        const cv = t.image; const cx = cv.getContext('2d');
        return { t, data: cx.getImageData(0, 0, cv.width, cv.height) };
      });
      return { ok: true, n: list.length };
    }
    if (m === 'restore') {
      if (!window.__fxSaved) return { ok: false, why: 'nothing saved' };
      for (const s of window.__fxSaved) {
        s.t.image.getContext('2d').putImageData(s.data, 0, 0);
        s.t.needsUpdate = true;
      }
      const n = window.__fxSaved.length;
      delete window.__fxSaved;
      return { ok: true, n };
    }
    for (const t of list) {
      const cv = t.image; const cx = cv.getContext('2d');
      const wq = cv.width; const hq = cv.height;
      const src = cx.getImageData(0, 0, wq, hq);
      const out = cx.createImageData(wq, hq);
      const cxr = wq / 2; const cyr = hq / 2; const maxr = Math.min(wq, hq) / 2;
      for (let y = 0; y < hq; y++) {
        for (let x = 0; x < wq; x++) {
          const p = (y * wq + x) * 4;
          const a0 = src.data[p + 3];
          if (a0 === 0) { out.data[p + 3] = 0; continue; }
          const r = Math.hypot(x - cxr, y - cyr) / maxr;
          if (m === 'flat') {
            // HARD-EDGED UNIFORM DISC: silhouette preserved (alpha only where the
            // original had alpha), body constant, no core, no falloff.
            out.data[p] = 255; out.data[p + 1] = 255; out.data[p + 2] = 255;
            out.data[p + 3] = 255;
          } else {
            // STRONG RADIAL RAMP: bright core, smooth falloff, same silhouette.
            const k = Math.max(0, 1 - r);
            const v = Math.round(255 * (0.10 + 0.90 * k * k));
            out.data[p] = v; out.data[p + 1] = v; out.data[p + 2] = v;
            out.data[p + 3] = Math.round(a0 * (0.15 + 0.85 * k));
          }
        }
      }
      cx.putImageData(out, 0, 0);
      t.needsUpdate = true;
    }
    return { ok: true, n: list.length };
  }, mode);
}

async function writeShot(buf, w, h, path) {
  await sharp(Buffer.from(buf), { raw: { width: w, height: h, channels: 4 } }).png().toFile(path);
}
async function writeCrop(buf, w, h, cx, cy, half, scale, path) {
  const left = Math.max(0, Math.min(w - 2 * half, cx - half));
  const top = Math.max(0, Math.min(h - 2 * half, cy - half));
  const side = Math.min(2 * half, w, h);
  await sharp(Buffer.from(buf), { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: side, height: side })
    .resize(side * scale, side * scale, { kernel: 'nearest' })
    .png().toFile(path);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let fail = 0;
  const bad = (m) => { fail++; log(`  🔴 ${m}`); };
  const results = {};
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
    await installHarness(page, W, H);
    if (PITCH !== 58) {
      const saved = await page.evaluate(([p, wq]) => window.__fx.setPitch(p, wq), [PITCH, DETECT_WIDTH]);
      log(`camera: re-pitched ${saved.pitch} -> ${PITCH} deg, frameMode ${saved.mode} -> ground, width ${saved.width} -> ${DETECT_WIDTH} wu`);
    }
    log(`\nfx_flat  label=${LABEL}  viewport ${W}x${H}  delta>=${DELTA}  pitch ${PITCH}  seed ${SEED}  slice ${SLICE}ms  erode ${ERODE}  blur ${BLUR}  flatEps ${FLAT_EPS}`);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);

    const opts = { delta: DELTA, erode: ERODE, blur: BLUR, flatEps: FLAT_EPS, minMask: MIN_MASK, minInterior: MIN_INTERIOR };

    /**
     * §G REACH — did the treatment under test actually touch anything?
     *
     * A peer found **three false zeros in one ablation** last session, one of them a
     * knob that was declared and never read because the blend function ignored it. A
     * treatment that silently reaches nothing is indistinguishable from a treatment
     * that did not help, and the second is a much more interesting result than the
     * first — so the census is read off the module and printed. It is ABSENT on any
     * tree that predates the shading, which is correct: this arm is a property of the
     * commit being measured, not a gate on it.
     */
    const reach = await page.evaluate(async () => {
      try {
        const m = await import('/src/game/vfx.ts');
        return m.FX_SHADE_STATS ? { ...m.FX_SHADE_STATS } : null;
      } catch (e) { return { err: String(e) }; }
    });
    log(`\nFX_SHADE_STATS (reach census, after boot): ${reach ? JSON.stringify(reach) : 'ABSENT — this tree predates the shading'}`);

    // ── THE REFERENCE ARM: the LIT geometry in the same frame ────────────────
    const nRoots = await page.evaluate(() => window.__fx.charRootCount());
    if (nRoots < 1) bad('§A no character root found — the reference arm would be measured over an empty mask');
    const figs = await page.evaluate(() => {
      window.__fx.reset(); window.__fx.step(0);
      const withChars = window.__fx.grab();
      window.__fx.setCharsVisible(false);
      const without = window.__fx.grab();
      window.__fx.setCharsVisible(true);
      const back = window.__fx.grab();
      let drift = 0;
      for (let i = 0; i < withChars.length; i++) if (withChars[i] !== back[i]) drift++;
      return { withChars, without, drift, roots: window.__fx.charRootCount() };
    });
    if (figs.drift !== 0) bad(`§E character-ablation RESTORE drifted on ${figs.drift} bytes — must be 0`);
    const figM = metrics(Uint8Array.from(figs.withChars), Uint8Array.from(figs.without), W, H, opts);
    log(`\nREFERENCE ARM — lit geometry (${figs.roots} character roots, toonMat MeshStandardMaterial + Fresnel rim)`);
    log(HEAD);
    log(row('figures (same frame)', figM));
    if (figM.vacuous) bad(`§A reference arm vacuous: ${figM.vacuous}`);
    results.figures = figM;
    if (CROPS && !figM.vacuous) {
      await writeShot(Uint8Array.from(figs.withChars), W, H, `${OUT}/${LABEL}.p${PITCH}.figures.png`);
    }

    // ── THE CASES ───────────────────────────────────────────────────────────
    log(`\nVFX — every material in src/game/vfx.ts and src/vfx/weapons/** is MeshBasicMaterial or SpriteMaterial (UNLIT)`);
    log(HEAD);
    const cases = CASES.filter((c) => !ONLY || ONLY.includes(c.id) || ONLY.includes(c.cid));
    for (const c of cases) {
      const r = await fireCase(page, c, SLICE, SEED);
      if (r.err) { bad(`${c.id}: ${r.err}`); continue; }
      const cur = Uint8Array.from(r.cur); const base = Uint8Array.from(r.base);
      const m = metrics(cur, base, W, H, opts);
      log(row(c.id, m));
      results[c.id] = m;
      if (m.vacuous) { bad(`§A ${c.id} vacuous: ${m.vacuous}`); continue; }
      // §F SUBJECT: the mask centroid must be in frame.
      const [mcx, mcy] = m.centroid;
      if (mcx < 0 || mcx >= W || mcy < 0 || mcy >= H) bad(`§F ${c.id} centroid ${mcx},${mcy} outside the frame`);
      if (CROPS) {
        await writeShot(cur, W, H, `${OUT}/${LABEL}.p${PITCH}.${c.id}.png`);
        await writeCrop(cur, W, H, mcx, mcy, 100, 4, `${OUT}/${LABEL}.p${PITCH}.${c.id}.4x.png`);
      }
    }

    // ── SELFTEST ────────────────────────────────────────────────────────────
    if (SELFTEST) {
      const probe = cases[0];
      log(`\n🧪 SELFTEST on ${probe.id}`);
      // §B DRIFT — the same measurement twice on one frozen frame, EXACTLY equal.
      const a1 = await fireCase(page, probe, SLICE, SEED);
      const a2 = await fireCase(page, probe, SLICE, SEED);
      const m1 = metrics(Uint8Array.from(a1.cur), Uint8Array.from(a1.base), W, H, opts);
      const m2 = metrics(Uint8Array.from(a2.cur), Uint8Array.from(a2.base), W, H, opts);
      const drifted = COLS.filter((k) => m1[k] !== m2[k]);
      log(`  §B DRIFT   ${drifted.length === 0 ? 'PASS — every column exactly equal' : `FAIL on ${drifted.join(',')}`}`);
      if (drifted.length) bad(`§B drift on ${drifted.join(',')}`);

      const sv = await repaintTextures(page, 'save');
      if (!sv.ok) bad(`§C/§D could not save textures: ${sv.why}`);
      log(`  saved ${sv.n} CanvasTextures reachable off the live layer + scene`);

      // §C FLATTEN
      await repaintTextures(page, 'flat');
      const fc = await fireCase(page, probe, SLICE, SEED);
      const mc = metrics(Uint8Array.from(fc.cur), Uint8Array.from(fc.base), W, H, opts);
      await repaintTextures(page, 'restore');
      await repaintTextures(page, 'save');
      // §D SHADE
      await repaintTextures(page, 'shade');
      const fd = await fireCase(page, probe, SLICE, SEED);
      const md = metrics(Uint8Array.from(fd.cur), Uint8Array.from(fd.base), W, H, opts);
      const rs = await repaintTextures(page, 'restore');
      log(HEAD);
      log(row('  shipped', m1));
      log(row('  §C flattened (known-bad)', mc));
      log(row('  §D shaded (known-bad)', md));
      const cUp = !mc.vacuous && mc.flatShare > m1.flatShare;
      const dDown = !md.vacuous && md.flatShare < m1.flatShare;
      /**
       * ⚠️ **THIS ARM WAS WRITTEN AS "§C MUST REDUCE |falloffR| BELOW THE SHIPPED
       * VALUE" AND IT WAS VACUOUS BY CONSTRUCTION.** Old wording kept per house style:
       * the shipped `falloffR` on the probe case is **0.030**, i.e. already at zero, so
       * "make it flatter than flat" has no room to move and the arm went red on a
       * healthy tree. That is `CLAUDE.md` rule 6's own class — an assertion whose
       * failure says nothing about the implementation.
       *
       * The non-vacuous form is an ORDERS assertion between the two known-bads, which
       * is what `sentinel.mjs` calls ORDERS: a hard uniform disc must read LESS
       * falling-off than a strong radial ramp, whatever the shipped tree reads. It has
       * a real failure mode — a `falloffR` that had quietly become a constant, or a
       * repaint that never reached the textures, fails it.
       */
      const cdOrder = !mc.vacuous && !md.vacuous && mc.falloffR > md.falloffR;
      log(`  §C FLATTEN flatShare ${pct(m1.flatShare)} -> ${pct(mc.flatShare)} ${cUp ? 'PASS (rose)' : 'FAIL (did not rise)'}`);
      log(`  §D SHADE   flatShare ${pct(m1.flatShare)} -> ${pct(md.flatShare)} ${dDown ? 'PASS (fell)' : 'FAIL (did not fall)'}`);
      log(`  §C/§D ORDERS falloffR flat ${f3(mc.falloffR)} > shaded ${f3(md.falloffR)} ${cdOrder ? 'PASS' : 'FAIL'}`);
      if (!cUp) bad('§C flatten did not raise flatShare');
      if (!dDown) bad('§D shade did not lower flatShare');
      if (!cdOrder) bad('§C/§D falloffR did not order flat > shaded');
      // §E RESTORE — bit-identical
      const e1 = await fireCase(page, probe, SLICE, SEED);
      const me = metrics(Uint8Array.from(e1.cur), Uint8Array.from(e1.base), W, H, opts);
      let bytes = 0;
      for (let i = 0; i < a1.cur.length; i++) if (a1.cur[i] !== e1.cur[i]) bytes++;
      log(`  §E RESTORE ${rs.n} textures put back; frame differs on ${bytes} bytes (want 0)`);
      if (bytes !== 0) bad(`§E restore leaked: ${bytes} bytes differ`);
      const eDrift = COLS.filter((k) => m1[k] !== me[k]);
      if (eDrift.length) bad(`§E restore column drift on ${eDrift.join(',')}`);
    }

    const reachEnd = await page.evaluate(async () => {
      try {
        const m = await import('/src/game/vfx.ts');
        return m.FX_SHADE_STATS ? { ...m.FX_SHADE_STATS } : null;
      } catch (e) { return { err: String(e) }; }
    });
    if (reachEnd && !reachEnd.err) {
      log(`FX_SHADE_STATS (after the run): ${JSON.stringify(reachEnd)}`);
      if (!(reachEnd.geometries > 0 && reachEnd.materials > 0)) {
        bad(`§G REACH: the shading reached ${reachEnd.geometries} geometries / ${reachEnd.materials} materials — a treatment that touches nothing looks exactly like one that did not help`);
      }
    }
    await writeFile(`${OUT}/${LABEL}.p${PITCH}.json`, JSON.stringify({
      base: BASE, label: LABEL, pitch: PITCH, viewport: [W, H],
      delta: DELTA, erode: ERODE, blur: BLUR, flatEps: FLAT_EPS, seed: SEED, slice: SLICE,
      reach, reachEnd, results,
    }, null, 1));
    log(`\nwrote ${OUT}/${LABEL}.p${PITCH}.json`);
  } finally {
    await browser.close();
  }
  if (fail) { log(`\n🔴 fx_flat: ${fail} fault(s)`); process.exit(1); }
  log(`\n✅ fx_flat: no faults`);
}

// AGENT-BRIEF §3: a tool that EXPORTS anything needs an IS_MAIN guard — three here
// did not, and importing one ran a live sweep.
const IS_MAIN = process.argv[1] && process.argv[1].endsWith('fx_flat.mjs');
if (IS_MAIN) await main();
