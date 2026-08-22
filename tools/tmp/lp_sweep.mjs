#!/usr/bin/env node
/**
 * `lp_sweep` — THE LOBBY PALETTE LADDER. N candidate palettes, ONE page load.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `tools/tmp/pc_pal.mjs --lobby` is the instrument of record for "where does this
 * frame's saturation budget go, by element class". It is also ~110 s per answer,
 * because it is a whole browser boot per tree, and a palette pass needs to ask the
 * question of a dozen candidate colour sets before it edits a single constant.
 *
 * The geometry does not move between candidates. Only `material.color` does. So the
 * expensive half of `pc_pal` — the per-class matte, which is 14 render passes of the
 * two-clear trick — is INVARIANT across the whole ladder and can be computed once.
 * That is the whole idea: build the id map once, then each rung costs one screenshot.
 *
 * `src/ui/screens/charStage.ts`'s own header records the ancestor of this file:
 * `stage_fg.mjs --sweep` retinted `menu_wall`/`menu_ground` in-page across a ladder
 * "so eight albedo pairs cost one page load instead of eight", and the shipped
 * `1D5576 : 093F73` pair came out of it. This is that method, generalised to the
 * plinth and reporting `pc_pal`'s statistics instead of `stage_fg`'s single polarity
 * number.
 *
 * ── METHODOLOGY IS IMPORTED, NOT REIMPLEMENTED ───────────────────────────────
 * `hsl`, `statsOver`, `CLASS_RULES`, `RESERVED`, `BASE_SET`, `LOUD_GATE` all come
 * from `pc_pal.mjs` itself. That is not tidiness — it is what makes control K0 below
 * mean anything. If this file carried its own copy of the HSL formula, "the shipped
 * rung reproduces the census" would only be testing that I copied it correctly.
 *
 * ── 🚨 THE CONTROL BATTERY, and what each one is a known-bad FOR ─────────────
 * CLAUDE.md rule 6: an instrument that has not been shown to FAIL on the defect it
 * guards against is not a guard. Every rung below is scored; the run exits non-zero
 * if any control fails.
 *
 *   K0  IDENTITY — the `shipped` rung, with no override applied at all, must
 *       reproduce `pc_pal --lobby`'s per-class `meanS`/`meanC` on the same tree to
 *       within the cross-load floor. KNOWN-BAD FOR: this whole pipeline being
 *       wired to the wrong canvas, the wrong id map, or the wrong colour space.
 *       Supply the census with `--census <pc_pal census.json>`; without it K0 is
 *       reported as NOT RUN rather than passed, because a control you did not run
 *       is not a control that passed.
 *
 *   K1  THE RETINT REACHES — a rung that paints the wall and floor NEUTRAL GREY must
 *       take the backdrop below meanS 0.15 and drop the ground by at least 0.40.
 *       KNOWN-BAD FOR: `getObjectByName` silently returning nothing, a shared material
 *       instance, or a vertex-colour ramp overriding the albedo. Without it, a ladder
 *       of colours that never reached the GPU reads as "the palette makes no
 *       difference". ⚠️ The two thresholds differ because the two classes differ: the
 *       backdrop is ONE opaque mesh, the ground class also owns two CustomBlending
 *       multiply decals that no floor albedo can desaturate (it bottoms out at 0.308).
 *       Asserting < 0.15 on both was a FALSE FAILURE on a working tool.
 *
 *   K2  THE RETINT HAS THE RIGHT SIGN — a rung that paints the wall FULLY saturated
 *       must drive backdrop `meanS` above 0.95. K1 alone passes on a tool that
 *       clamps everything to grey.
 *
 *   K3  EVERY RUNG MOVED PIXELS — each rung's canvas must differ from `shipped`.
 *       CLAUDE.md rule 4: when something "isn't there", assume it is rendering and
 *       invisible. A rung whose colours were rejected renders a perfect, plausible,
 *       IDENTICAL frame and its row of numbers looks like a finding.
 *
 *   K4  RESTORE IS EXACT — re-applying the captured originals at the end must return
 *       a canvas BIT-IDENTICAL to the `shipped` rung. KNOWN-BAD FOR: accumulation
 *       (rung N reading rung N-1's leftovers) and for the frame having drifted for
 *       any reason at all during the ladder. If K4 is red, every row is suspect.
 *
 *   K5  NO VACUOUS MEAN — `[].every()` is `true` and `mean([])` is `NaN`. Every
 *       class's pixel list is asserted NON-EMPTY before any statistic is taken over
 *       it; `statsOver` returns `null` for an empty set and this file REFUSES rather
 *       than printing a zero.
 *
 *   K6  THE MASK STILL FITS — the id map is built ONCE, at the start. If the hero's
 *       idle pose advances even one frame mid-ladder, every rung after that point is
 *       indexed against a mask that no longer describes the picture, and the numbers
 *       stay perfectly plausible. So the matte is rebuilt at the END and required to
 *       be byte-identical to the one at the start.
 *
 *   K7  RUNGS ARE INDEPENDENT — a rung that does not name `menu_wall` must reproduce
 *       `shipped`'s backdrop statistics EXACTLY. KNOWN-BAD FOR: the ladder ACCUMULATING,
 *       which is what the first version of this file did. It skipped any target a rung
 *       did not name, so a plinth-only rung silently inherited the wall and floor of
 *       the rung five rows above it and reported them as the shipped room. 🚨 NEITHER
 *       K3 NOR K4 CAN SEE THIS — an accumulating ladder still moves pixels every rung
 *       and still restores exactly at the end. It was caught by reading the table.
 *       Every rung now resets every target to the captured original first.
 *
 * ⚠️ K6 IS THE ONE THAT COST THE MOST TO GET RIGHT, and the reason is measured:
 * `pc_pal --drift` reports EXACTLY ZERO px between two captures inside one page
 * load, and that is true and it is not the same claim. Across two page loads of one
 * unchanged tree this lobby lands the hero in one of two idle phases: `characters`
 * area% reads 15.64 or 16.66, a 1.02 pp swing with nothing changed. The drift
 * control does not bound that and was never asked to. Inside one load — which is
 * where this file lives — rAF is held, so the mask holds; K6 is what proves it did
 * rather than assuming it.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/lp_sweep.mjs --url $URL --out tools/tmp/lp_sw --census tools/tmp/lp_r0/census.json
 *   node tools/tmp/lp_sweep.mjs --url $URL --out DIR --ladder tools/tmp/lp_ladder.json
 *   node tools/tmp/lp_sweep.mjs --selftest        # no browser
 *
 * NEVER against :5173. Freeze a detached worktree and point at that:
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-lp -- \
 *     node tools/tmp/lp_sweep.mjs --out tools/tmp/lp_sw --url '{URL}'
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  CLASS_RULES, hsl, statsOver, RESERVED, BASE_SET, LOUD_GATE,
} from './pc_pal.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────────────
const RAW = process.argv.slice(2);
const args = {};
for (let i = 0; i < RAW.length; i++) {
  const a = RAW[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const nxt = RAW[i + 1];
  if (nxt === undefined || nxt.startsWith('--')) args[k] = true;
  else { args[k] = nxt; i++; }
}
const BASE = args.url ?? process.env.PREVIEW_BASE ?? null;
const OUT = String(args.out ?? 'tools/tmp/lp_sw');
const PLAYER = String(args.player ?? 'hamburger');
const W = +(args.w ?? 1600), H = +(args.h ?? 900);
const SETTLE_MS = +(args.settle ?? 2500);
const STILL_SETTLE_MS = +(args['still-settle'] ?? 800);
const LAUNCH_ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-lcd-text', '--force-device-scale-factor=1'];

/** Every mesh in the lobby set this file is allowed to repaint, in draw order. */
const TARGETS = [
  'menu_wall',
  'menu_ground',
  'menu_plinth_body',
  'menu_plinth_rim',
  'menu_plinth_rim_top',
  'menu_plinth_recess',
  'menu_plinth_top',
];

/**
 * The ladder.
 *
 * `shipped` MUST be first and MUST carry no overrides — K0/K3/K4 are all defined
 * against it. Everything after it is a candidate. `null` for a target means "leave
 * whatever the tree ships"; a hex string repaints it.
 *
 * The two `KB-` rungs are controls, not candidates, and they are reported separately
 * so nobody reads a deliberately-broken palette as a proposal.
 */
const DEFAULT_LADDER = [
  { id: 'shipped', kind: 'ref', colors: {} },
  { id: 'KB-grey', kind: 'control', colors: { menu_wall: '#6E6E6E', menu_ground: '#6E6E6E' } },
  { id: 'KB-maxsat', kind: 'control', colors: { menu_wall: '#0000FF' } },
];

// ─────────────────────────────────────────────────────────────────────────────
// in-page
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_FREEZE = () => {
  window.requestAnimationFrame = () => 0;
  const st = window.__stage;
  if (st && st.rig) {
    for (const k of ['shake', 'shakeAmp', 'shakeMag', 'shakeTime', 'trauma']) if (k in st.rig) st.rig[k] = 0;
  }
  return true;
};
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'lp-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().length;
};
/**
 * ⚠️ THE CANVAS IS A DESCENDANT OF `#screens` ON CHARACTER-SELECT, so the two-line
 * HUD hide every other tool in this repo uses (`display:none` on `.hud-root,#screens`)
 * takes the picture with it. `visibility` inherits AND can be overridden by a
 * descendant, which is why this sets it back to `visible` on the canvas explicitly.
 * Same shape as `pc_pal`'s; asserted below rather than trusted.
 */
const PAGE_HIDE_HUD = () => {
  const els = [...document.querySelectorAll('.hud-root, #screens')];
  for (const e of els) e.style.visibility = 'hidden';
  const c = document.querySelector('canvas');
  if (c) c.style.visibility = 'visible';
  return { hidden: els.length, canvasVisibility: c ? getComputedStyle(c).visibility : 'no-canvas' };
};

/**
 * Repaint by object name and PROVE each name resolved.
 *
 * Returns `missing` so the caller can refuse. A `getObjectByName` that finds nothing
 * returns `undefined` and this whole file would then measure the shipped frame N
 * times and report it as a ladder — the exact "rendering and invisible" failure in
 * the opposite direction.
 */
const PAGE_RETINT = (cfg) => {
  const st = window.__stage;
  if (!st || st.disposed) return { error: 'no live Stage' };
  const scene = st.scene;
  const missing = [];
  const applied = [];
  // Capture originals ONCE, keyed by name, so `--restore` is exact rather than a
  // second guess at what the tree ships.
  window.__lpOrig = window.__lpOrig || {};
  for (const name of cfg.targets) {
    const o = scene.getObjectByName(name);
    if (!o || !o.material) { missing.push(name); continue; }
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (!(name in window.__lpOrig)) window.__lpOrig[name] = ms.map((m) => '#' + m.color.getHexString());
    // 🚨 EVERY RUNG IS RESET TO THE SHIPPED COLOUR FIRST, and the first version of this
    // file did NOT do that — it skipped any target the rung did not name, which meant a
    // rung INHERITED whatever the previous rung had painted. The doc above said "leave
    // whatever the tree ships" and the code said "leave whatever the last rung set", and
    // the difference is invisible in a table of numbers: the plinth-only rungs came back
    // carrying the wall and floor of the deep-slate rung five rows above them, reported
    // as if they described the shipped room. NO CONTROL CAUGHT IT — K3 (every rung moved
    // pixels) and K4 (restore is exact) are both perfectly happy with an accumulating
    // ladder. It was caught by reading the rows and noticing a backdrop number that had
    // no business being there. `K7` below is the control that now exists for it.
    const want = cfg.colors[name] ?? window.__lpOrig[name][0];
    for (const m of ms) m.color.set(want);
    if (cfg.colors[name]) applied.push(`${name}=${want}`);
  }
  // 🚨 rAF IS HELD, SO NOTHING RE-RENDERS ON ITS OWN and the canvas keeps whatever
  // was last drawn into it. The first version of this file called `st.render()` with
  // no argument and then screenshotted; every one of 13 rungs came back BIT-IDENTICAL
  // at meanS 0.983, which is not a palette reading at all — it is the black/white
  // MATTE frame left in the buffer by the id-map pass, photographed 13 times. K3
  // caught it. `Stage.render` takes `dtSeconds`; 0 re-composites the frame without
  // advancing anything.
  if (typeof st.render !== 'function') return { error: 'Stage has no render(dt) — cannot force a repaint with rAF held' };
  st.render(0);
  return { missing, applied, known: Object.keys(window.__lpOrig) };
};

/** Lifted verbatim in contract from `pc_pal.mjs`'s `PAGE_CLASS_MATTE` — same two-clear
 *  trick, same per-OBJECT `onBeforeRender` keying (toon.ts shares material instances,
 *  so keying the colour mask on the material mis-attributes every shared one), same
 *  first-writer-wins tie-break, same post-chain bypass. */
const PAGE_CLASS_MATTE = (cfg) => {
  const { rules, classes } = cfg;
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage on this page' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  if (!r || !scene || !cam) return { error: 'Stage is missing renderer/scene/rig.camera' };
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  if (!Wp || !Hp) return { error: 'drawing buffer has zero size' };

  const compiled = rules.map((x) => ({ cls: x.cls, res: x.pat.map((p) => new RegExp(p)), mres: (x.mat || []).map((p) => new RegExp(p)) }));
  const classify = (path, matName) => {
    for (const c of compiled) {
      for (const re of c.res) if (re.test(path)) return c.cls;
      for (const re of c.mres) if (re.test(matName)) return c.cls;
    }
    return null;
  };
  const matNameOf = (o) => (Array.isArray(o.material)
    ? o.material.map((m) => m.name || m.type).join('+')
    : (o.material.name || o.material.type));

  const items = [];
  const unclassified = [];
  const visibleChain = (o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
  scene.traverse((o) => {
    if (!o.material || !o.geometry) return;
    const names = [];
    let p = o;
    while (p && p !== scene) { names.unshift(p.name || ''); p = p.parent; }
    const path = names.join('/');
    const mn = matNameOf(o);
    const cls = classify(path, mn) ?? 'other';
    if (cls === 'other' && visibleChain(o)) unclassified.push(`${path}  [${mn}]`);
    items.push({ o, cls, vis: visibleChain(o) });
  });
  if (items.length === 0) return { error: 'no classified renderable in the scene' };

  const shot = () => { const p = new Uint8Array(Wp * Hp * 4); gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  const savedBg = scene.background;
  const savedShadow = r.shadowMap.enabled;
  const savedAutoClear = r.autoClear;
  const savedOBR = items.map((it) => it.o.onBeforeRender);
  const savedCW = new Map();
  for (const it of items) {
    const ms = Array.isArray(it.o.material) ? it.o.material : [it.o.material];
    for (const m of ms) if (!savedCW.has(m)) savedCW.set(m, m.colorWrite);
  }

  const ID = new Uint8Array(Wp * Hp);
  const idOf = {}; classes.forEach((c, i) => { idOf[c] = i + 1; });
  const objectsByClass = {};
  let overlapPx = 0;

  try {
    scene.background = null;
    r.shadowMap.enabled = false;
    r.autoClear = true;
    r.setRenderTarget(null);
    for (const cls of classes) {
      objectsByClass[cls] = items.filter((it) => it.cls === cls && it.vis).length;
      for (const it of items) {
        const want = it.cls === cls;
        it.o.onBeforeRender = function (rend, scn, camera, geom, mat) {
          if (!mat) return;
          if (Array.isArray(mat)) { for (const m of mat) m.colorWrite = want; return; }
          mat.colorWrite = want;
        };
      }
      r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
      const A = shot();
      r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
      const B = shot();
      const id = idOf[cls];
      for (let y = 0; y < Hp; y++) {
        const ty = Hp - 1 - y;
        for (let x = 0; x < Wp; x++) {
          const i = (y * Wp + x) * 4;
          const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
          if (d < 32) {
            const k = ty * Wp + x;
            if (ID[k] === 0) ID[k] = id; else overlapPx++;
          }
        }
      }
    }
  } finally {
    items.forEach((it, i) => { it.o.onBeforeRender = savedOBR[i]; });
    for (const [m, v] of savedCW) m.colorWrite = v;
    scene.background = savedBg;
    r.shadowMap.enabled = savedShadow;
    r.autoClear = savedAutoClear;
  }
  let bin = '';
  for (let i = 0; i < ID.length; i += 4096) bin += String.fromCharCode.apply(null, ID.subarray(i, Math.min(i + 4096, ID.length)));
  return { buffer: [Wp, Hp], idB64: btoa(bin), overlapPx, unclassified, objectsByClass };
};

// ─────────────────────────────────────────────────────────────────────────────
// node-side
// ─────────────────────────────────────────────────────────────────────────────
const pct = (x, d = 2) => (x * 100).toFixed(d);
const f = (x, d = 3) => (x === null || x === undefined ? '  —  ' : x.toFixed(d));
const pad = (s, n) => String(s).padEnd(n);
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 12);

async function rawFit(png, Wp, Hp) {
  const probe = await sharp(png).metadata();
  let src = png;
  if (probe.width !== Wp || probe.height !== Hp) {
    // Same ±2 px tolerance and same NEAREST kernel `pc_pal` uses, and for the same
    // reason: this canvas is 394x726 in CSS and 394x725 in its drawing buffer, and
    // refusing outright throws away the only camera Uri judges. Anything larger is
    // still refused — at that point the two are not the same framing.
    if (Math.abs(probe.width - Wp) > 2 || Math.abs(probe.height - Hp) > 2) {
      throw new Error(`PNG ${probe.width}x${probe.height} vs buffer ${Wp}x${Hp} — not the same framing. REFUSING.`);
    }
    src = png.replace(/\.png$/, '.fit.png');
    await sharp(png).resize(Wp, Hp, { fit: 'fill', kernel: 'nearest' }).png().toFile(src);
  }
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, ch: info.channels, w: info.width, h: info.height };
}

/** The one number Uri's sentence reduces to, stated as a ratio so it cannot be
 *  gamed by moving everything at once: how much of the frame's chroma budget the
 *  RESERVED set carries per unit of the area it occupies. > 1 = the subject leads. */
function leverageOf(stats, frameSatSum, N) {
  if (!stats) return null;
  const areaFrac = stats.px / N;
  const chromaFrac = stats.satSum / frameSatSum;
  return { areaFrac, chromaFrac, leverage: chromaFrac / areaFrac };
}

async function measureFile(png, idBuf, classes, Wp, Hp) {
  const tag = png;
  const raw = await rawFit(png, Wp, Hp);
  const N = Wp * Hp;
  const idx = {}; for (const c of classes) idx[c] = [];
  let bg = 0;
  for (let i = 0; i < N; i++) {
    const v = idBuf[i];
    if (v === 0) { bg++; continue; }
    idx[classes[v - 1]].push(i);
  }
  // 🚨 K5. A mean over an empty set is NaN or 0 and both read as an answer.
  const present = classes.filter((c) => idx[c].length > 0);
  if (present.length === 0) throw new Error(`${tag}: every class is EMPTY — the id map does not describe this canvas. REFUSING.`);
  const frame = statsOver(raw.data, raw.ch, Array.from({ length: N }, (_, i) => i));
  const per = {};
  for (const c of classes) per[c] = statsOver(raw.data, raw.ch, idx[c]);
  const lev = {};
  for (const c of classes) lev[c] = leverageOf(per[c], frame.satSum, N);
  let reservedSat = 0, reservedPx = 0, baseSat = 0, basePx = 0;
  for (const c of classes) {
    if (!per[c]) continue;
    if (RESERVED.has(c)) { reservedSat += per[c].satSum; reservedPx += per[c].px; }
    else if (BASE_SET.has(c)) { baseSat += per[c].satSum; basePx += per[c].px; }
  }
  const loud = { total: frame.loudPx, byClass: {} };
  for (const c of classes) if (per[c]) loud.byClass[c] = per[c].loudPx;
  return {
    png, backgroundPx: bg, present,
    frame, per, lev, N,
    reserved: { areaFrac: reservedPx / N, chromaFrac: reservedSat / frame.satSum },
    base: { areaFrac: basePx / N, chromaFrac: baseSat / frame.satSum },
    loud,
  };
}

async function run() {
  if (!BASE) { console.error('lp_sweep: --url or PREVIEW_BASE required'); return 2; }
  await mkdir(OUT, { recursive: true });
  const ladder = args.ladder
    ? JSON.parse(await readFile(String(args.ladder), 'utf8'))
    : DEFAULT_LADDER;
  if (!Array.isArray(ladder) || ladder.length === 0) { console.error('lp_sweep: empty ladder'); return 2; }
  if (ladder[0].id !== 'shipped' || Object.keys(ladder[0].colors ?? {}).length !== 0) {
    console.error('lp_sweep: rung 0 must be `shipped` with NO overrides — K0/K3/K4 are all defined against it.');
    return 2;
  }
  const classes = [...new Set(CLASS_RULES.map((r) => r.cls)), 'other'];
  const rules = CLASS_RULES.map((r) => ({ cls: r.cls, pat: r.pat, mat: r.mat || [] }));

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const faults = [];
  const controls = [];
  const K = (name, ok, detail) => { controls.push({ name, ok, detail }); if (!ok) faults.push(name); };
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const url = `${BASE}/?screen=characters&player=${PLAYER}&pointerLock=0`;
    console.log(`\n═══ lp_sweep · LOBBY (charStage, pitch 20) ═══  ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction("document.querySelector('canvas') && window.__stage && !window.__stage.disposed", null, { timeout: 90000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(PAGE_FREEZE);
    await page.evaluate(PAGE_STILL_HUD);
    const hid = await page.evaluate(PAGE_HIDE_HUD);
    if (!hid.hidden) { K('HUD-selector-live', false, 'no .hud-root/#screens matched — the selector is stale'); }
    else K('HUD-selector-live', true, `${hid.hidden} hidden`);
    K('canvas-survived-HUD-hide', hid.canvasVisibility === 'visible',
      `computed visibility ${hid.canvasVisibility} (the documented trap: the canvas is a DESCENDANT of #screens here)`);
    await page.waitForTimeout(STILL_SETTLE_MS);

    // ── 🚨 THE ORDER IS THE BUG I ALREADY MADE ONCE. ──────────────────────────
    // `pc_pal.mjs` states it in its header — *"the matte runs AFTER every screenshot,
    // so it cannot perturb the pixels the colour numbers run on"* — and I built the id
    // map FIRST anyway, because indexing needs it. The matte's last act is a two-clear
    // pass that leaves a black-and-white mask sitting in the drawing buffer, and with
    // rAF held nothing paints over it. So: every rung is PHOTOGRAPHED first, the id map
    // is built at the END, and the indexing happens offline against the saved PNGs.
    // The geometry never moves, so one id map is correct for all of them — which is the
    // premise of this whole file and is asserted, not assumed, by K4/K6 below.
    const shots = [];
    for (const rung of ladder) {
      const r = await page.evaluate(PAGE_RETINT, { targets: TARGETS, colors: rung.colors ?? {}, restore: false });
      if (r.error) { console.error(`  ✗ ${rung.id}: ${r.error}`); return 1; }
      const unresolved = Object.keys(rung.colors ?? {}).filter((n) => r.missing.includes(n));
      if (unresolved.length) K(`names-resolve:${rung.id}`, false, `getObjectByName found nothing for ${unresolved.join(', ')} — this rung silently measured the SHIPPED frame`);
      await page.waitForTimeout(120);
      const png = join(OUT, `${rung.id}.png`);
      await page.locator('canvas').first().screenshot({ path: png, timeout: 60000 });
      shots.push({ rung, png, bytes: sha(await readFile(png)) });
    }
    // restore, then photograph again — K4
    const rr = await page.evaluate(PAGE_RETINT, { targets: TARGETS, colors: {}, restore: true });
    if (rr.error) { console.error(`  ✗ restore: ${rr.error}`); return 1; }
    await page.waitForTimeout(120);
    const backPng = join(OUT, '_restored.png');
    await page.locator('canvas').first().screenshot({ path: backPng, timeout: 60000 });
    const backBytes = sha(await readFile(backPng));

    // ── NOW the matte, twice ─────────────────────────────────────────────────
    const matte0 = await page.evaluate(PAGE_CLASS_MATTE, { rules, classes });
    if (matte0.error) { console.error(`  ✗ matte failed — ${matte0.error}`); return 1; }
    const [Wp, Hp] = matte0.buffer;
    const idBuf = Buffer.from(matte0.idB64, 'base64');
    K('no-unclassified-visible', matte0.unclassified.length === 0,
      matte0.unclassified.length ? `${matte0.unclassified.length}: ${matte0.unclassified.join(' | ')}` : 'every visible renderable is in a class');
    console.log(`  matte ${Wp}x${Hp} · overlap ${matte0.overlapPx} px · classes present: ${classes.filter((c) => matte0.objectsByClass[c] > 0).join(', ')}`);
    const matte1 = await page.evaluate(PAGE_CLASS_MATTE, { rules, classes });
    const sameMask = !matte1.error && Buffer.from(matte1.idB64, 'base64').equals(idBuf);
    K('mask-still-fits', sameMask,
      sameMask ? 'id map byte-identical on a second build' : 'THE ID MAP MOVED — every rung is indexed against a mask that no longer describes its picture');

    // ── index the saved PNGs against that one id map ─────────────────────────
    const rows = [];
    for (const s of shots) {
      const m = await measureFile(s.png, idBuf, classes, Wp, Hp);
      m.tag = s.rung.id; m.bytes = s.bytes;
      m.kind = s.rung.kind ?? 'candidate';
      m.colors = s.rung.colors ?? {};
      rows.push(m);
    }
    const ref = rows[0];

    // ── K3: every rung moved pixels ──────────────────────────────────────────
    for (const m of rows.slice(1)) {
      K(`moved-pixels:${m.tag}`, m.bytes !== ref.bytes,
        m.bytes === ref.bytes ? 'BIT-IDENTICAL to `shipped` — the retint never reached the GPU' : `hash ${m.bytes} vs ref ${ref.bytes}`);
    }
    // ── K7: RUNGS ARE INDEPENDENT, NOT CUMULATIVE ────────────────────────────
    // The control that did not exist when the ladder silently accumulated.
    // `backdrop` is exactly one mesh — `menu_wall` — behind everything, receiving no
    // decal, in a rig with no bounce. So a rung that does NOT name `menu_wall` must
    // reproduce `shipped`'s backdrop statistics. If it does not, it inherited a wall.
    //
    // ⚠️ "EXACTLY, TO THE BIT" IS WRONG AND IT WAS THIS FILE'S FIRST ANSWER. At 1e-9
    // the plinth-only rungs went red on a ladder that was working: repainting the
    // PLINTH moves the backdrop by dS 4.1e-6 / dC 3.2e-5, because the colour numbers
    // are read off the POST-PROCESSED canvas and bloom spills across class boundaries.
    // (`pc_pal`'s matte bypasses post — the MASK is geometric — but the pixels the
    // statistics run on are the composited ones, so the classes are optically coupled
    // and "independent" is a claim about the SCENE, not about the frame.)
    // BOTH ARMS ARE MEASURED, on real ladders: bloom spill is 3.2e-5, and a genuinely
    // inherited wall — ladder 1, where `P1-cool` ran after `B5-deepslate` — moved it by
    // 0.609. Four orders of magnitude apart, so 0.01 separates them with enormous room
    // and is still 2x the 0.005 cross-load floor.
    //
    // ⚠️ `ground` deliberately CANNOT be used for this and that is not an oversight:
    // `menu_foot_decal` is classified GROUND and it is a multiply decal lying on the
    // PLINTH TOP, so repainting the plinth genuinely does move the ground's numbers.
    // Asserting independence on a class that is not independent would be a guard that
    // fires on correct behaviour.
    {
      const untouched = rows.slice(1).filter((m) => !('menu_wall' in m.colors));
      // 🚨 VACUITY: a ladder in which every rung repaints the wall would pass this
      // trivially. Assert the filtered set is NON-EMPTY before asserting over it.
      if (untouched.length === 0) {
        K('K7-rungs-are-independent', false,
          'NOT RUN — every rung in this ladder repaints menu_wall, so nothing tests inheritance. Add a plinth-only rung.');
      } else {
        const K7_TOL = 0.01;
        const drift = untouched.filter((m) => !m.per.backdrop || !ref.per.backdrop
          || Math.abs(m.per.backdrop.meanSat - ref.per.backdrop.meanSat) > K7_TOL
          || Math.abs(m.per.backdrop.meanChroma - ref.per.backdrop.meanChroma) > K7_TOL);
        K('K7-rungs-are-independent', drift.length === 0,
          drift.length === 0
            ? `${untouched.length} rung(s) leave menu_wall alone; worst backdrop drift ${Math.max(...untouched.map((m) => Math.abs(m.per.backdrop.meanSat - ref.per.backdrop.meanSat))).toExponential(1)} (bloom spill; an inherited wall measures ~0.6)`
            : `${drift.map((m) => `${m.tag} backdrop meanS ${f(m.per.backdrop?.meanSat)} != shipped ${f(ref.per.backdrop.meanSat)}`).join(' · ')} — the ladder INHERITED a previous rung's wall`);
      }
    }

    // K4. ⚠️ VACUOUS ON ITS OWN — when the first version of this file photographed the
    // same stale matte frame 13 times, this passed with flying colours because
    // everything was identical to everything. It is only evidence WITH K3 above, which
    // requires the rungs to differ from `shipped` in the first place.
    K('restore-is-bit-identical', backBytes === ref.bytes,
      backBytes === ref.bytes ? `${backBytes} (and K3 proves the ladder moved in between)` : `restored ${backBytes} != shipped ${ref.bytes} — the ladder ACCUMULATED or the frame drifted; every row above is suspect`);

    // ── K1/K2: the two known-bads ────────────────────────────────────────────
    const grey = rows.find((m) => m.tag === 'KB-grey');
    if (grey) {
      // ⚠️ THE THRESHOLD IS ASYMMETRIC AND THE ASYMMETRY IS MEASURED, NOT A FUDGE.
      // `backdrop` is one opaque mesh, so a grey albedo takes it to grey: it reads
      // 0.099 and a flat < 0.15 is the right assertion. `ground` is NOT one mesh —
      // the class also owns `menu_ground_decal` (a CustomBlending multiply in
      // [18,32,160], a deeply blue wash) and `menu_foot_decal` ([92,62,30], warm),
      // and no change to the FLOOR ALBEDO can desaturate a decal painted over it. It
      // bottoms out at 0.308. The first version of this control asserted < 0.15 on
      // both and went red on a tool that was working perfectly — a false failure, in
      // the direction that gets a good instrument thrown away. What proves the retint
      // reached the GPU is the SIZE of the drop, so that is what is asserted.
      const wOk = grey.per.backdrop && grey.per.backdrop.meanSat < 0.15;
      const drop = (ref.per.ground?.meanSat ?? 0) - (grey.per.ground?.meanSat ?? 0);
      const gOk = grey.per.ground && drop >= 0.40;
      K('KB-grey-collapses-saturation', !!(wOk && gOk),
        `backdrop meanS ${f(grey.per.backdrop?.meanSat)} (must be < 0.15) · ground meanS ${f(grey.per.ground?.meanSat)}, a drop of ${f(drop)} from shipped ${f(ref.per.ground?.meanSat)} (must be >= 0.400; the class carries two coloured multiply decals that a floor albedo cannot reach)`);
    } else K('KB-grey-collapses-saturation', false, 'the KB-grey control rung is not in the ladder');
    const maxs = rows.find((m) => m.tag === 'KB-maxsat');
    if (maxs) {
      K('KB-maxsat-raises-saturation', !!(maxs.per.backdrop && maxs.per.backdrop.meanSat > 0.95),
        `backdrop meanS ${f(maxs.per.backdrop?.meanSat)} (must be > 0.95)`);
    } else K('KB-maxsat-raises-saturation', false, 'the KB-maxsat control rung is not in the ladder');

    // ── K0: the identity check against pc_pal ────────────────────────────────
    if (args.census && existsSync(String(args.census))) {
      const cen = JSON.parse(await readFile(String(args.census), 'utf8'));
      const rep = (cen.report || []).find((x) => x.camera === 'lobby');
      if (!rep) K('K0-identity-vs-pc_pal', false, 'the census JSON has no lobby camera row');
      else {
        const TOL_S = 0.010, TOL_C = 0.010;   // 2x the measured cross-load floor (0.004 / 0.003)
        const bad = [];
        let checked = 0;
        for (const c of ['backdrop', 'ground', 'characters', 'props']) {
          const a = rep.perClass[c], b = ref.per[c];
          if (!a || !b) { bad.push(`${c}: absent on one side`); continue; }
          checked++;
          if (Math.abs(a.meanSat - b.meanSat) > TOL_S) bad.push(`${c} meanS ${f(a.meanSat)} vs ${f(b.meanSat)}`);
          if (Math.abs(a.meanChroma - b.meanChroma) > TOL_C) bad.push(`${c} meanC ${f(a.meanChroma)} vs ${f(b.meanChroma)}`);
        }
        // 🚨 VACUITY. `bad.length === 0` is trivially true if nothing was comparable.
        K('K0-identity-vs-pc_pal', checked === 4 && bad.length === 0,
          checked !== 4 ? `only ${checked}/4 classes were comparable — this control did not run` : (bad.length ? bad.join(' · ') : 'all 4 classes within 0.010 of the census'));
      }
    } else {
      K('K0-identity-vs-pc_pal', false, '--census not supplied: the identity control DID NOT RUN, and a control that did not run did not pass');
    }

    await page.close();

    // ── report ────────────────────────────────────────────────────────────────
    console.log(`\n  CONTROLS`);
    for (const c of controls) console.log(`    ${c.ok ? '✓' : '✗'} ${pad(c.name, 32)} ${c.detail}`);

    for (const m of rows) {
      const tagline = m.kind === 'control' ? '  [KNOWN-BAD CONTROL — not a proposal]' : '';
      console.log(`\n  ── ${m.tag} ${Object.entries(m.colors).map(([k, v]) => `${k.replace('menu_', '')}=${v}`).join(' ') || '(as shipped)'}${tagline}`);
      console.log(`     class        area%   chroma%   LEV    meanS   meanC   meanL   hue°   loud%`);
      for (const c of ['backdrop', 'ground', 'props', 'characters']) {
        const s = m.per[c], L = m.lev[c];
        if (!s) { console.log(`     ${pad(c, 12)} absent — refused, not printed as 0`); continue; }
        console.log(`     ${pad(c, 12)} ${pad(pct(L.areaFrac), 7)} ${pad(pct(L.chromaFrac), 9)} ${pad(L.leverage.toFixed(2), 6)} ${pad(f(s.meanSat), 7)} ${pad(f(s.meanChroma), 7)} ${pad(f(s.meanL), 7)} ${pad(s.hueMeanDeg === null ? '—' : s.hueMeanDeg.toFixed(0), 6)} ${pct(s.loudPx / s.px, 1)}`);
      }
      const subj = m.per.characters, plinth = m.per.props;
      const wins = subj && plinth
        ? `subject meanS ${f(subj.meanSat)} vs loudest base ${f(Math.max(...['backdrop', 'ground', 'props'].map((c) => m.per[c]?.meanSat ?? 0)))}`
        : 'n/a';
      console.log(`     FRAME meanS ${f(m.frame.meanSat)}  meanC ${f(m.frame.meanChroma)}  ·  frame >=${LOUD_GATE} : ${pct(m.frame.loudPx / m.N, 1)}%`);
      console.log(`     RESERVED lev ${(m.reserved.chromaFrac / m.reserved.areaFrac).toFixed(2)}  ·  BASE lev ${(m.base.chromaFrac / m.base.areaFrac).toFixed(2)}  ·  ${wins}`);
      if (subj && plinth) {
        const dh = Math.abs(((subj.hueMeanDeg - plinth.hueMeanDeg) + 540) % 360 - 180);
        console.log(`     SUBJECT vs PLINTH — chroma ${f(subj.meanChroma)} vs ${f(plinth.meanChroma)} (${subj.meanChroma > plinth.meanChroma ? 'subject leads ✓' : 'PLINTH LEADS ✗'}) · hue separation ${dh.toFixed(0)}°`);
      }
    }

    await writeFile(join(OUT, 'sweep.json'), JSON.stringify({ base: BASE, controls, rows }, null, 2));
    console.log(`\n  wrote ${join(OUT, 'sweep.json')}`);
    console.log(`  🔴 OPEN ${join(OUT, '<rung>.png')} AND LOOK AT IT before believing any row above.`);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 4).join(' | ')}`);
    if (faults.length) { console.error(`\n  ✗ ${faults.length} CONTROL(S) FAILED: ${faults.join(', ')} — the rows above are not evidence.`); return 1; }
    console.log(`\n  ✓ all ${controls.length} controls passed.`);
    return 0;
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : the LOGIC only. It says nothing about where the tool is POINTED —
// that is what K0/K1/K2/K6 above are for, and they need a browser.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0; const fail = [];
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else fail.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  };
  const approx = (name, got, want, tol) => {
    const ok = got !== null && Math.abs(got - want) <= tol;
    if (ok) pass++; else fail.push(`${name}: got ${got} want ${want}+/-${tol}`);
  };
  console.log('\nlp_sweep --selftest\n');

  console.log('A. the imported methodology is pc_pal\'s, not a copy');
  approx('A1 hsl of the shipped floor albedo #093F73 s', hsl(0x09, 0x3f, 0x73).s, 0.855, 0.002);
  approx('A2 hsl of the shipped floor albedo #093F73 l', hsl(0x09, 0x3f, 0x73).l, 0.243, 0.002);
  approx('A3 hsl of the shipped wall albedo #1D5576 h', hsl(0x1d, 0x55, 0x76).h, 202.25, 0.5);
  check('A4 pure grey has zero saturation', hsl(110, 110, 110).s, 0);
  check('A5 RESERVED carries the character class', RESERVED.has('characters'), true);
  check('A6 BASE carries the plinth (props) and the wall', BASE_SET.has('props') && BASE_SET.has('backdrop'), true);

  console.log('B. leverage — the number every recommendation rests on');
  {
    // A class on 25% of the frame carrying 50% of the chroma leads at 2.0.
    const lv = leverageOf({ px: 250, satSum: 50 }, 100, 1000);
    approx('B1 leverage = chromaShare / areaShare', lv.leverage, 2.0, 1e-9);
    approx('B2 ...and the two shares are reported separately', lv.areaFrac, 0.25, 1e-9);
    // 🚨 The vacuous case: `statsOver` returns null for an empty set, so leverage must
    // refuse rather than divide 0 by 0 and print NaN as though it were a measurement.
    check('B3 an ABSENT class returns null, never NaN', leverageOf(null, 100, 1000), null);
  }

  console.log('C. statsOver refuses an empty set (the vacuity guard, imported)');
  check('C1 mean over [] is null, not 0', statsOver(new Uint8Array(30), 3, []), null);
  {
    const d = new Uint8Array([255, 0, 0, 0, 0, 255]);
    const s = statsOver(d, 3, [0, 1]);
    check('C2 a two-pixel set is measured, not refused', s.px, 2);
    approx('C3 ...and both are fully saturated', s.meanSat, 1.0, 1e-9);
  }

  console.log('D. the ladder contract');
  check('D1 rung 0 is `shipped` and carries no overrides',
    DEFAULT_LADDER[0].id === 'shipped' && Object.keys(DEFAULT_LADDER[0].colors).length === 0, true);
  check('D2 both known-bad rungs are marked as CONTROLS, not candidates',
    DEFAULT_LADDER.filter((r) => r.id.startsWith('KB-')).every((r) => r.kind === 'control')
    && DEFAULT_LADDER.filter((r) => r.id.startsWith('KB-')).length === 2, true);
  check('D3 every target name matches pc_pal\'s lobby class rules',
    TARGETS.map((t) => {
      for (const r of CLASS_RULES) { for (const p of r.pat) if (new RegExp(p).test(t)) return r.cls; }
      return null;
    }),
    // ⚠️ `menu_plinth_top` is PROPS, not ground, and I expected ground when I wrote
    // this — the selftest caught it. `props` sits ABOVE `ground` in `CLASS_RULES` and
    // the classifier is first-match-wins, so a name containing both `plinth` and `top`
    // resolves as the plinth. That is right: the gold face is part of the podium, not
    // the floor. Written down because the ordering is the only thing that decides it.
    ['backdrop', 'ground', 'props', 'props', 'props', 'props', 'props']);

  console.log('E. 🚨 KNOWN-BAD: D3 must FAIL on the tree as it shipped before this pass');
  {
    // The two plinth meshes shipped ANONYMOUS. Classified by the empty string they
    // actually carried, they fall through every rule to `other` — which is exactly the
    // "UNCLASSIFIED AND VISIBLE" the census reported. If this arm ever goes green, the
    // classifier has started guessing and D3 above is no longer evidence of anything.
    const classifyOne = (t) => {
      for (const r of CLASS_RULES) { for (const p of r.pat) if (new RegExp(p).test(t)) return r.cls; }
      return null;
    };
    check('E1 the anonymous rim-top annulus classified as NOTHING', classifyOne(''), null);
    check('E2 ...and its named form is PROPS', classifyOne('menu_plinth_rim_top'), 'props');
    check('E3 a name that merely CONTAINS plinth mid-word still resolves', classifyOne('menu_plinth_recess'), 'props');
  }

  console.log('F. 🚨 KNOWN-BAD: the identity control must be able to go RED');
  {
    const TOL = 0.010;
    const bad = [];
    let checked = 0;
    const censusLike = { backdrop: { meanSat: 0.963, meanChroma: 0.462 } };
    const mineLike = { backdrop: { meanSat: 0.900, meanChroma: 0.462 } };   // 0.063 off — must be caught
    for (const c of ['backdrop']) {
      const a = censusLike[c], b = mineLike[c];
      checked++;
      if (Math.abs(a.meanSat - b.meanSat) > TOL) bad.push(c);
    }
    check('F1 a 0.063 disagreement with the census is CAUGHT', bad.length > 0, true);
    // ...and the vacuous form: nothing comparable must NOT read as agreement.
    let checked2 = 0; const bad2 = [];
    for (const c of ['props']) { const a = censusLike[c], b = mineLike[c]; if (!a || !b) continue; checked2++; }
    check('F2 nothing comparable is NOT_RUN, never PASS', checked2 === 1 && bad2.length === 0, false);
  }

  console.log(`\n${pass} passed, ${fail.length} failed`);
  for (const x of fail) console.log(`  ✗ ${x}`);
  return fail.length === 0 ? 0 : 1;
}

const code = args.selftest ? selftest() : await run();
process.exit(code);
