#!/usr/bin/env node
/**
 * `pc_pal` — THE PALETTE CENSUS. Where the frame's saturation budget actually goes,
 * by ELEMENT CLASS and by AREA, and how that compares to the reference plates.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Uri, item 3:
 *
 *   > "Pink, cyan, purple, yellow-black hazard stripes, and orange all appear at
 *   >  similar high saturation and similar visual weight, so nothing leads and
 *   >  nothing recedes. Establish a restrained palette: a muted, desaturated base
 *   >  for floors and environment, with a small number of accent colors. Reserve
 *   >  high saturation almost entirely for the things that must be read instantly
 *   >  — characters, hazards, projectiles, and VFX. Everything else should step back."
 *
 * That is a claim about HIERARCHY, and hierarchy is a ratio: how much of the
 * frame's total chroma does a class spend, against how much of the frame it
 * occupies. A palette pass without that number is taste, and this project has
 * eight documented rounds of taste on the arena that moved nothing.
 *
 * `arena-scan.mjs` already prices the CUMULATIVE colour budget and splits it two
 * ways (ENVIRONMENT vs CAST) via an exact matte. This file does three things it
 * does not:
 *
 *   1. splits the SAME budget N ways — ground, apron, props, hazards, characters,
 *      projectiles, VFX, fog, contact shadows, backdrop, HUD — with occlusion
 *      resolved exactly, so every pixel belongs to exactly one class;
 *   2. reports, per class, the pair that answers Uri: AREA share and CHROMA share,
 *      and their ratio (`leverage`). leverage > 1 = louder than its footprint;
 *      leverage < 1 = it steps back. A frame where nothing leads has every class
 *      near 1.0;
 *   3. computes a CLASS-FREE concentration statistic — the Lorenz curve of
 *      saturation over area, its Gini, and the share of frame chroma carried by
 *      the loudest 5/10/20% of pixels — which runs identically on our frames and
 *      on a reference plate. A plate has no scene graph; this is the only form in
 *      which "how restrained is the base" is directly comparable across the two.
 *
 * ── SECURITY ─────────────────────────────────────────────────────────────────
 * `reference/` is gitignored and this repo is PUBLIC. `--conc` only ever READS a
 * path you hand it and prints NUMBERS. Numbers disclose nothing. Never let a
 * description of what a plate depicts reach a report or a commit message
 * (CLAUDE.md security constraints — breached once by prose, not by pixels).
 *
 * ── HOW THE CLASS MATTE WORKS, and why not hide-and-diff ─────────────────────
 * `arena-scan.mjs` records the reason a naive hide-and-diff is wrong: a dark
 * character over dark ground simply goes missing, which is exactly the
 * figure/ground case the instrument exists to measure. Its answer is the
 * two-clear trick — render the subject alone on black and on white; a pixel the
 * subject covers is IDENTICAL in both, a pixel it does not is 255 apart. That is
 * colour-independent.
 *
 * Generalising it to N classes needs one more thing: OCCLUSION. If a prop stands
 * in front of a character, those pixels are the prop's, not the character's.
 * Rendering the character alone would claim them.
 *
 * So, per class C, the scene renders WHOLE — every object still draws, still
 * depth-tests and still writes depth — but only class C is allowed to write
 * COLOUR. Everything else is a depth-only occluder. The two-clear trick then
 * reads exactly "C is the frontmost opaque fragment here".
 *
 * ⚠️ THE OBVIOUS IMPLEMENTATION IS WRONG AND IT IS WORTH SAYING WHY. Setting
 * `material.colorWrite` once per pass mis-attributes every SHARED material, and
 * `src/render/toon.ts` shares aggressively — `toonMat` hands the same instance to
 * a prop and a character. Verified against the INSTALLED three (r180,
 * `node_modules/three/build/three.cjs`), `renderObject` at :75608 calls
 * `object.onBeforeRender(...)` and then `renderBufferDirect` -> `setProgram` ->
 * `state.setMaterial(material)` at :74709, which is where
 * `colorBuffer.setMask(material.colorWrite)` happens. So the flag is read ONCE PER
 * DRAW, after `onBeforeRender`. Setting it from `onBeforeRender`, keyed on the
 * OBJECT, is therefore exact for shared materials. That is what this does.
 *
 * Consequences, stated rather than discovered later:
 *   • post chain BYPASSED (`renderer.render`, not `stage.render`) — bloom spills a
 *     halo into a coverage mask and SMAA feathers its edge. Same choice arena-scan
 *     made, same reason.
 *   • a TRANSPARENT material with `depthWrite:false` does not occlude, so an
 *     additive VFX sprite and the character behind it can BOTH claim a pixel. The
 *     tool reports `overlapPx` rather than hiding it; at `--sim-speed 0.02` there
 *     is essentially no VFX on screen anyway (arena-scan's KNOWN GAP, inherited).
 *   • the matte runs AFTER every screenshot, so it cannot perturb the pixels the
 *     colour numbers run on.
 *
 * ── METHODOLOGY — deliberately identical to `tools/tmp/chroma.mjs` ───────────
 * so every figure here compares directly to the recorded 0.145 / 0.343 / 0.493:
 *   HSL: l = (max+min)/2/255 ;  s = l > 0.5 ? d/(510-max-min) : d/(max+min)
 *   hue: the standard 6-sector form, in degrees
 *   the `s >= 0.15` gate is the "greys carry no hue opinion" gate
 * DIFFERENCE, on purpose: the class census runs at FULL canvas resolution, not
 * 320x180. A projectile is a few hundred pixels; a 320x180 grid rounds it away.
 * The concentration half runs at 320x180 to stay comparable with plates of
 * different sizes.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/pc_pal.mjs --url $URL --tree            # scene roots + classifier coverage
 *   node tools/tmp/pc_pal.mjs --url $URL --out shots/pc/m  # class census, MATCH camera
 *   node tools/tmp/pc_pal.mjs --url $URL --lobby --out shots/pc/l   # LOBBY camera
 *   node tools/tmp/pc_pal.mjs --url $URL --drift --out shots/pc/d   # rule-4 drift control
 *   node tools/tmp/pc_pal.mjs --conc <png|dir> [<png|dir>...]       # no browser
 *   node tools/tmp/pc_pal.mjs --selftest                            # no browser
 *
 * NEVER against :5173. Freeze a detached worktree of a commit and measure on that:
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-pc -- \
 *     node tools/tmp/pc_pal.mjs --out shots/pc/m --url '{URL}'
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readdir, stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────────────
const RAW = process.argv.slice(2);
const args = {};
const positional = [];
for (let i = 0; i < RAW.length; i++) {
  const a = RAW[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = RAW[i + 1] && !RAW[i + 1].startsWith('--') ? RAW[++i] : true;
    if (args[k] === undefined) args[k] = v;
    else args[k] = [].concat(args[k], v);
  } else positional.push(a);
}

const BASE = (args.url || process.env.PREVIEW_BASE || 'http://localhost:5187').replace(/\/$/, '');
const OUT = args.out || 'shots/pc/census';
const W = +(args.w ?? 1600);
const H = +(args.h ?? 900);
const PLAYER = args.player || 'hamburger';
const ENEMY = args.enemy || 'hotdog';
const SIM_SPEED = args['sim-speed'] ?? '0.02';
const SETTLE_MS = +(args.settle ?? 2600);
const STILL_SETTLE_MS = +(args['still-settle'] ?? 800);
const PX = args.px ?? 1400;
const PY = args.py ?? 1240;
const FOG = args.fog ?? 1400;

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** Vite HMR client stub — peers edit `src/` live and a save full-reloads mid-capture. */
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ─────────────────────────────────────────────────────────────────────────────
// THE CLASSIFIER
//
// Ordered. First match wins, so the SPECIFIC rules stand above the general ones —
// a projectile lives under `vfx_layer`, and a hazard's puddle lives under
// `arena:kitchen`, so ordering is the whole of the correctness argument here.
//
// Every pattern is matched against the object's ANCESTRY PATH: the '/'-joined
// `name` of every node from the scene root down to and including the object. An
// unnamed node contributes an empty segment, which is why `docs/AGENT-BRIEF.md`
// §3 says an unnamed mesh is invisible to every diagnostic in this repo.
//
// 🚨 There is deliberately NO catch-all. An object matching nothing lands in
// `unclassified` WITH ITS PATH, and the run reports it loudly. A catch-all bucket
// is how a class quietly acquires geometry nobody meant to put in it.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 🚨 A RULE MATCHES ON THE PATH **OR** ON THE MATERIAL NAME, and the second half is
 * not a convenience — it is required for correctness. Measured on `9ed8f63`: the
 * hazard ground decals carry the path `arena:kitchen//` — TWO EMPTY GROUP NAMES and
 * nothing else — and are identifiable *only* by `material.name` (`hazard:scorch`,
 * `hazard:glow`). A path-only classifier drops them into the base, which is the exact
 * direction that would have flattered this census: it moves a HAZARD's chroma into
 * the ENVIRONMENT's column and makes the hierarchy look worse than it is.
 */
export const CLASS_RULES = [
  // --- the things that must be read instantly (Uri's reserved set) ------------
  { cls: 'characters', why: 'BaseCharacter root / ChibiRig root', pat: ['(^|/)character:', '(^|/)rig_root(/|$)'], mat: [] },
  { cls: 'projectiles', why: 'live shots + their shells/haloes', pat: ['projectile:', 'projectile_shell:', 'projectile_halo:'], mat: [] },
  { cls: 'telegraph', why: 'ultimate cast telegraph', pat: ['castTelegraph'], mat: [] },
  { cls: 'hazards', why: 'pot, puddles, hazard ground decals', pat: ['pot_solid', '(^|/)puddle', 'hazard_ground'], mat: ['^hazard:', '^pot:', '^kpal:grease$', '^kpal:water$'] },
  { cls: 'fog', why: 'the closing death ring', pat: ['fog_boundary', 'fog_curtain', 'fog_edge'], mat: [] },
  { cls: 'vfx', why: 'everything else under the VFX layer', pat: ['(^|/)vfx_layer(/|$)'], mat: [] },
  // --- the base the accents are supposed to sit on ---------------------------
  { cls: 'shadows', why: 'contact shadow decals', pat: ['contact:shadows', 'contact:decal', 'contact_shadow'], mat: [] },
  { cls: 'props', why: 'collidable furniture, concealment, the lobby plinth', pat: ['arena_props', 'arena_concealment', '(^|/)cover:', '(^|/)conceal:', '(^|/)menu_plinth'], mat: [] },
  { cls: 'apron', why: 'cosmetic bleed outside the playfield', pat: ['arena_apron', '(^|/)apron_'], mat: [] },
  { cls: 'decor', why: 'non-collidable dressing: floor debris, chalkboard, pipes, signs', pat: ['debris_', 'chalkboard_', '(^|/)pipe_', '(^|/)sign_', 'top_rim'], mat: [] },
  { cls: 'ambient', why: 'dust motes', pat: [], mat: ['^kpal:dust$'] },
  { cls: 'ground', why: 'the playfield floor / the lobby floor', pat: ['(^|/)floor', 'ground_chip', 'floor_mat', '(^|/)menu_ground', '(^|/)menu_foot_decal'], mat: [] },
  { cls: 'backdrop', why: 'sky dome / the lobby wall', pat: ['(^|/)sky', '(^|/)dome', 'backdrop', '(^|/)menu_wall'], mat: [] },
];

/**
 * @param {string} path ancestry path, '/'-joined names, root first
 * @param {string} matName material name(s), '+'-joined
 * @returns {string|null} class id, or null if nothing matched
 */
export function classifyPath(path, matName = '') {
  for (const r of CLASS_RULES) {
    for (const p of r.pat) if (new RegExp(p).test(path)) return r.cls;
    for (const m of r.mat || []) if (new RegExp(m).test(matName)) return r.cls;
  }
  return null;
}

/** Classes Uri names as "must be read instantly" — the reserved set. */
export const RESERVED = new Set(['characters', 'projectiles', 'telegraph', 'hazards', 'vfx']);
/** Classes that are the BASE — the thing that is supposed to step back. */
export const BASE_SET = new Set(['ground', 'apron', 'props', 'backdrop', 'shadows', 'decor', 'ambient']);

// ─────────────────────────────────────────────────────────────────────────────
// colour maths — `tools/tmp/chroma.mjs` verbatim, so figures are comparable
// ─────────────────────────────────────────────────────────────────────────────
const CHROMA_GATE = 0.15;
/** "Loud" = the accent budget. 0.60 on HSL saturation, 0.50 on absolute chroma. */
export const LOUD_GATE = 0.60;
export const LOUD_GATE_C = 0.50;
export const HUE_BINS = 12;

export function hsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2 / 255;
  const s = d === 0 ? 0 : (l > 0.5 ? d / (510 - max - min) : d / (max + min));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  // `sv` is HSV saturation, d/max — a DIFFERENT quantity from `s`. It is carried so
  // this file can price the gap against `tools/tmp/v1_sat.mjs`, which measures HSV
  // while `arena-scan` / `chroma.mjs` / every recorded figure here measures HSL.
  return { h, s, l, c: d / 255, v: max / 255, sv: max === 0 ? 0 : d / max };
}

/**
 * Per-class colour statistics over an explicit pixel index list.
 *
 * 🚨 RULE 6, THE VACUITY GUARD. `[].every()` is `true` and a mean over an empty
 * set is 0 or NaN — either reads as a real, quiet answer. This returns `null` for
 * an empty set and the caller must print `absent`, never a number.
 */
export function statsOver(data, ch, idx) {
  if (!idx || idx.length === 0) return null;
  let sS = 0, sC = 0, sL = 0, sV = 0, warm = 0, cool = 0, chromatic = 0;
  let loud = 0, loudC = 0;
  let sx = 0, sy = 0;
  const bins = new Array(HUE_BINS).fill(0);
  for (const i of idx) {
    const o = i * ch;
    const { h, s, l, c, v } = hsl(data[o], data[o + 1], data[o + 2]);
    sS += s; sC += c; sL += l; sV += v;
    if (s >= LOUD_GATE) loud++;
    if (c >= LOUD_GATE_C) loudC++;
    if (s >= CHROMA_GATE) {
      chromatic++;
      if (h < 60) warm += s; else cool += s;
      bins[Math.min(HUE_BINS - 1, Math.floor(h / (360 / HUE_BINS)))] += s;
      const rad = (h * Math.PI) / 180;
      sx += s * Math.cos(rad); sy += s * Math.sin(rad);
    }
  }
  const n = idx.length;
  const binTot = bins.reduce((a, b) => a + b, 0);
  let domHue = null, domBin = null, conc = null;
  if (binTot > 0) {
    domBin = bins.indexOf(Math.max(...bins));
    let mh = (Math.atan2(sy, sx) * 180) / Math.PI; if (mh < 0) mh += 360;
    domHue = mh;
    conc = Math.hypot(sx, sy) / binTot; // circular concentration R, 1 = one hue
  }
  return {
    px: n,
    loudPx: loud,
    loudPxC: loudC,
    meanSat: sS / n,
    meanChroma: sC / n,
    meanL: sL / n,
    meanV: sV / n,
    satSum: sS,                 // <- the quantity that is SHARED out across classes
    warmChromaSum: warm,
    coolChromaSum: cool,
    chromaticPct: (chromatic / n) * 100,
    hueMeanDeg: domHue,
    hueR: conc,
    domBinDeg: domBin === null ? null : domBin * (360 / HUE_BINS),
    bins,
  };
}

/**
 * HOW MANY HUES IS THE FRAME ACTUALLY USING, AND HOW MANY OF THEM ARE LOUD?
 *
 * This is the statistic Uri's sentence is really about. "Pink, cyan, purple,
 * yellow-black hazard stripes, and orange all appear at similar high saturation"
 * is not a claim that there is too MUCH saturation — it is a claim that too many
 * DIFFERENT hues are carrying it, so no single one reads as the accent.
 *
 * Measured two ways over the same frame:
 *   ALL  — every chromatic pixel (s >= 0.15), chroma-weighted into 12 x 30-deg bins
 *   LOUD — only pixels at or above `loudGate`, i.e. the frame's accent budget
 *
 * `effHues` is the exponential of the Shannon entropy of the bin distribution: the
 * number of hues the frame behaves as though it has. A frame using one hue reads
 * 1.0; a frame spreading evenly over all twelve reads 12.0. It is reported next to
 * `top1`/`top3` because entropy alone hides whether the mass is in ONE bin or two
 * adjacent ones, and adjacent bins are one hue family, not two.
 */
export function hueSpread(data, ch, n, loudGate = 0.60) {
  const binsAll = new Array(HUE_BINS).fill(0);
  const binsLoud = new Array(HUE_BINS).fill(0);
  let loudPx = 0, chromaticPx = 0;
  let sxA = 0, syA = 0, sxL = 0, syL = 0;
  for (let i = 0; i < n; i++) {
    const o = i * ch;
    const { h, s } = hsl(data[o], data[o + 1], data[o + 2]);
    if (s < CHROMA_GATE) continue;
    chromaticPx++;
    const b = Math.min(HUE_BINS - 1, Math.floor(h / (360 / HUE_BINS)));
    const rad = (h * Math.PI) / 180;
    binsAll[b] += s; sxA += s * Math.cos(rad); syA += s * Math.sin(rad);
    if (s >= loudGate) { loudPx++; binsLoud[b] += s; sxL += s * Math.cos(rad); syL += s * Math.sin(rad); }
  }
  const summarise = (bins, sx, sy) => {
    const tot = bins.reduce((a, b) => a + b, 0);
    if (tot <= 0) return null;                    // vacuity guard, not a 0
    const share = bins.map((v) => v / tot);
    const sorted = [...share].sort((a, b) => b - a);
    let H = 0;
    for (const p of share) if (p > 0) H -= p * Math.log(p);
    // adjacent-pair mass: the biggest TWO NEIGHBOURING bins, i.e. one hue family
    let best = 0, bestAt = 0;
    for (let i = 0; i < HUE_BINS; i++) {
      const v = share[i] + share[(i + 1) % HUE_BINS];
      if (v > best) { best = v; bestAt = i; }
    }
    return {
      effHues: Math.exp(H),
      top1: sorted[0], top3: sorted[0] + sorted[1] + sorted[2],
      family2: best, family2At: bestAt * (360 / HUE_BINS),
      R: Math.hypot(sx, sy) / tot,
      bins: share.map((v) => +v.toFixed(4)),
    };
  };
  return {
    loudGate,
    loudAreaPct: (loudPx / n) * 100,
    chromaticPct: (chromaticPx / n) * 100,
    all: summarise(binsAll, sxA, syA),
    loud: summarise(binsLoud, sxL, syL),
  };
}

/**
 * THE CLASS-FREE HALF — runs identically on our frames and on a reference plate.
 *
 * Sort every pixel by HSL saturation, descending, and walk the cumulative
 * saturation against the cumulative area. That curve IS Uri's sentence:
 *   • "a muted, desaturated base"  -> low median saturation, small area above 0.6
 *   • "a small number of accents"  -> a large share of total chroma in a small
 *                                     share of the area, i.e. a HIGH Gini
 *   • "nothing leads, nothing recedes" -> the curve near the diagonal, Gini near 0
 */
export function concentration(data, ch, n, metric = 's') {
  const s = new Float64Array(n);
  let tot = 0;
  for (let i = 0; i < n; i++) {
    const o = i * ch;
    const px = hsl(data[o], data[o + 1], data[o + 2]);
    const v = metric === 'c' ? px.c : metric === 'v' ? px.sv : px.s;
    s[i] = v; tot += v;
  }
  const sorted = Float64Array.from(s).sort();          // ascending
  const pct = (q) => sorted[Math.min(n - 1, Math.max(0, Math.floor(q * n)))];
  // Gini over the ascending order: G = (2*sum(i*x_i)/(n*sum(x))) - (n+1)/n
  let wsum = 0;
  for (let i = 0; i < n; i++) wsum += (i + 1) * sorted[i];
  const gini = tot > 0 ? (2 * wsum) / (n * tot) - (n + 1) / n : 0;
  // share of TOTAL saturation carried by the loudest k% of pixels
  const topShare = (k) => {
    if (tot <= 0) return 0;
    const cut = Math.max(1, Math.round(n * k));
    let acc = 0;
    for (let i = n - 1; i >= n - cut; i--) acc += sorted[i];
    return acc / tot;
  };
  const areaAbove = (t) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (s[i] >= t) c++;
    return c / n;
  };
  return {
    px: n,
    metric,
    meanSat: tot / n,
    medianSat: pct(0.5),
    p90Sat: pct(0.9),
    p99Sat: pct(0.99),
    gini,
    top5: topShare(0.05),
    top10: topShare(0.10),
    top20: topShare(0.20),
    areaAbove50: areaAbove(0.50),
    areaAbove60: areaAbove(0.60),
    areaAbove70: areaAbove(0.70),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE-SIDE: the scene tree dump
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_TREE = () => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage on this page' };
  const scene = stage.scene;
  if (!scene) return { error: 'Stage has no scene' };
  const out = [];
  const visibleChain = (o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
  scene.traverse((o) => {
    if (!o.material || !o.geometry) return;
    const names = [];
    let p = o;
    while (p && p !== scene) { names.unshift(p.name || ''); p = p.parent; }
    const bb = (() => {
      try {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((v) => +v.toFixed(1));
      } catch { return null; }
    })();
    out.push({
      path: names.join('/'),
      vis: visibleChain(o),
      geo: o.geometry.type,
      bb,
      pos: [o.position.x, o.position.y, o.position.z].map((v) => +v.toFixed(1)),
      mat: Array.isArray(o.material) ? o.material.map((m) => m.name || m.type).join('+') : (o.material.name || o.material.type),
      transparent: Array.isArray(o.material) ? o.material.some((m) => m.transparent) : !!o.material.transparent,
      depthWrite: Array.isArray(o.material) ? o.material.every((m) => m.depthWrite) : !!o.material.depthWrite,
    });
  });
  return { roots: scene.children.map((c) => c.name || '(unnamed)'), meshes: out };
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE-SIDE: the N-class matte. Returns a base64 id-map, TOP-DOWN, full res.
//
// One pass per class. In each pass every object still draws and still depth-tests
// (so occlusion is exact); only the pass's own class writes colour. `colorWrite`
// is set from `onBeforeRender`, keyed on the OBJECT, because materials are shared.
// ─────────────────────────────────────────────────────────────────────────────
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

  // ── enumerate + classify ────────────────────────────────────────────────────
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
    // 🚨 NO SILENT DROP. An object matching nothing goes into the MEASURED bucket
    // `other`, never into a class and never off the books. A tool that quietly
    // discards what it cannot name reports a total that adds up and is wrong.
    const cls = classify(path, mn) ?? 'other';
    if (cls === 'other' && visibleChain(o)) unclassified.push(`${path}  [${mn}]`);
    items.push({ o, cls, vis: visibleChain(o) });
  });

  if (items.length === 0) return { error: 'no classified renderable in the scene' };

  const shot = () => { const p = new Uint8Array(Wp * Hp * 4); gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };

  // save renderer state
  const savedBg = scene.background;
  const savedShadow = r.shadowMap.enabled;
  const savedAutoClear = r.autoClear;
  const savedAlpha = r.getClearAlpha();
  const savedOBR = items.map((it) => it.o.onBeforeRender);
  const savedCW = new Map();
  for (const it of items) {
    const ms = Array.isArray(it.o.material) ? it.o.material : [it.o.material];
    for (const m of ms) if (!savedCW.has(m)) savedCW.set(m, m.colorWrite);
  }

  const perClass = {};
  const ID = new Uint8Array(Wp * Hp);          // 0 = nothing / background
  const idOf = {}; classes.forEach((c, i) => { idOf[c] = i + 1; });
  let overlapPx = 0;

  try {
    scene.background = null;
    r.shadowMap.enabled = false;
    r.autoClear = true;
    r.setRenderTarget(null);

    for (const cls of classes) {
      // key the colour mask on the OBJECT, not the material — toon.ts shares them.
      for (const it of items) {
        const want = it.cls === cls;
        it.o.onBeforeRender = function (rend, scn, camera, geom, mat) {
          if (!mat) return;
          if (Array.isArray(mat)) { for (const m of mat) m.colorWrite = want; return; }
          mat.colorWrite = want;
        };
      }
      // Post chain BYPASSED on purpose: bloom spills a halo into a coverage mask
      // and SMAA feathers its edge. Neither belongs in a geometric mask.
      r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
      const A = shot();
      r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
      const B = shot();

      let px = 0;
      const id = idOf[cls];
      for (let y = 0; y < Hp; y++) {
        const ty = Hp - 1 - y;                        // gl.readPixels is bottom-up
        for (let x = 0; x < Wp; x++) {
          const i = (y * Wp + x) * 4;
          const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
          if (d < 32) {
            px++;
            const k = ty * Wp + x;
            // 🚨 FIRST WRITER WINS, and the first version of this had it BACKWARDS.
            // Overlap is only possible between things that do not write depth — decals
            // and additive sprites. With last-writer-wins the GROUND (near the end of
            // the rule order) overwrote the contact shadows and the hazard decals lying
            // on it: `shadows` reported ABSENT on a frame containing 13 of them, and the
            // ground absorbed 43,029 px of other classes' colour. The rule order runs
            // front-to-back for exactly this reason, so keeping the first claimant is
            // the correct tie-break, not merely the opposite one.
            if (ID[k] !== 0) { overlapPx++; continue; }
            ID[k] = id;
          }
        }
      }
      perClass[cls] = px;
    }
  } finally {
    items.forEach((it, i) => { it.o.onBeforeRender = savedOBR[i]; });
    for (const [m, v] of savedCW) m.colorWrite = v;
    scene.background = savedBg;
    r.shadowMap.enabled = savedShadow;
    r.autoClear = savedAutoClear;
    r.setClearColor(0x000000, savedAlpha);
    try { stage.render(0); } catch (e) { /* restoring the visible frame is best-effort */ }
  }

  // base64 without blowing the stack on a 1.44M array
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < ID.length; i += CH) bin += String.fromCharCode.apply(null, ID.subarray(i, i + CH));

  const tally = {};
  for (const it of items) tally[it.cls] = (tally[it.cls] || 0) + (it.vis ? 1 : 0);

  return {
    buffer: [Wp, Hp],
    classes,
    perClass,
    overlapPx,
    objectsByClass: tally,
    unclassified: [...new Set(unclassified)],
    idB64: btoa(bin),
  };
};

/**
 * 🚨 THE MATCH AND THE LOBBY DIFFER STRUCTURALLY AND `arena-scan`'s VERSION OF THIS
 * CANNOT DO THE LOBBY. In the match the canvas is a SIBLING of `#screens`, so hiding
 * `#screens` leaves it. In the character-select screen the canvas is a DESCENDANT of
 * `#screens` (charStage mounts inside the screen container), so the same two lines
 * hide THE SUBJECT — measured: `locator.screenshot` then blocks for 90 s on
 * "element is not visible" and the run dies. It does not report a wrong number; it
 * hangs, which is the good failure, but only because Playwright refuses.
 *
 * `visibility` is inherited AND overridable on a descendant, so the fix is to hide
 * the container and re-assert the canvas. This returns the canvas's computed
 * visibility so the caller can prove the subject survived rather than assume it.
 */
/**
 * Put the RESERVED classes in frame. `arena-scan.mjs` records a KNOWN GAP — "this
 * cannot reliably put COMBAT VFX in frame ... it needs a driven-input probe of the
 * `tools/tmp/burstshot.mjs` family" — and at `--sim-speed 0.02` `vfx`, `projectiles`
 * and `telegraph` all report ABSENT, which is three of the five classes Uri's
 * sentence is about.
 *
 * ⚠️ `tools/tmp/burstshot.mjs` DOES NOT EXIST in this tree (checked 2026-08-22), so
 * the gap was never closed by the file that note points at. `src/game/vfx.ts` does
 * expose `window.__vfxSpawnTest(kind, xWU, yWU, amount, color, who, weaponKey,
 * castMs)` and `window.__vfxQaCounts`, which is enough.
 *
 * Returns the QA counters so the caller can prove the effects FIRED rather than
 * assume it — a probe that photographs an empty frame and reports 0% is the failure
 * mode this whole file is built against.
 */
const PAGE_SPAWN_VFX = (cfg) => {
  const { x, y, kinds } = cfg;
  if (typeof window.__vfxSpawnTest !== 'function') return { error: 'no window.__vfxSpawnTest on this page' };
  const before = JSON.parse(JSON.stringify(window.__vfxQaCounts ?? {}));
  for (const k of kinds) {
    try { window.__vfxSpawnTest(k.kind, x + (k.dx || 0), y + (k.dy || 0), k.amount ?? 40, k.color, k.who, k.weaponKey, k.castMs); }
    catch (e) { return { error: `${k.kind}: ${String(e)}` }; }
  }
  return { before, after: JSON.parse(JSON.stringify(window.__vfxQaCounts ?? {})) };
};

const PAGE_HIDE_HUD = () => {
  const els = [...document.querySelectorAll('.hud-root, #screens')];
  for (const e of els) e.style.visibility = 'hidden';
  const c = document.querySelector('canvas');
  if (c) c.style.visibility = 'visible';
  return { hidden: els.length, canvasVisibility: c ? getComputedStyle(c).visibility : 'no-canvas' };
};
const PAGE_SHOW_HUD = () => {
  for (const e of document.querySelectorAll('.hud-root, #screens')) e.style.visibility = '';
  const c = document.querySelector('canvas'); if (c) c.style.visibility = '';
};
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'pc-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().length;
};
/** rAF held AND the camera shake zeroed — AGENT-BRIEF §3: a frozen frame is not a frozen camera. */
const PAGE_FREEZE = () => {
  window.requestAnimationFrame = () => 0;
  const st = window.__stage;
  if (st && st.rig) {
    for (const k of ['shake', 'shakeAmp', 'shakeMag', 'shakeTime', 'trauma']) if (k in st.rig) st.rig[k] = 0;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// node-side helpers
// ─────────────────────────────────────────────────────────────────────────────
async function rawOf(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, ch: info.channels, w: info.width, h: info.height };
}
async function rawSmall(png, w = 320, h = 180) {
  const { data, info } = await sharp(png).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, ch: info.channels, n: info.width * info.height };
}
const pct = (x, d = 2) => (x * 100).toFixed(d);
const f = (x, d = 3) => (x === null || x === undefined ? '  —  ' : x.toFixed(d));

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --conc  (no browser; works on our PNGs and on reference plates alike)
// ─────────────────────────────────────────────────────────────────────────────
async function modeConc(paths) {
  const files = [];
  for (const p of paths) {
    if (!existsSync(p)) { console.error(`pc_pal --conc: no such path ${p}`); return 2; }
    const st = await stat(p);
    if (st.isDirectory()) {
      for (const e of (await readdir(p)).sort()) {
        if (/\.(png|jpg|jpeg|webp)$/i.test(e) && !/\.(canvas|nohud|marked|matte|classmap)\./.test(e)) files.push(join(p, e));
      }
    } else files.push(p);
  }
  if (files.length === 0) { console.error('pc_pal --conc: NO images matched — refusing to print a mean over an empty set.'); return 2; }
  // 🚨 DEDUPE BY CONTENT. `reference/images/curated/gameplay_topdown/` is a BYTE-IDENTICAL
  // subset of `.../gameplay/` (verified by md5 on 2026-08-22), and `CLAUDE.md` names the
  // first while `docs/TOOLS.md` names the second — so passing both, which is the natural
  // thing to do, silently DOUBLE-WEIGHTS six plates in the mean. The unweighted mean over
  // plates is the whole methodology (`arena-scan`: "as the plates were"), so a duplicate
  // is not a cosmetic problem, it moves the target.
  {
    const seen = new Map(), kept = [];
    for (const fp of files) {
      const h = createHash('md5').update(await readFile(fp)).digest('hex');
      if (seen.has(h)) { console.log(`  · skipping duplicate content: ${fp}  (same bytes as ${seen.get(h)})`); continue; }
      seen.set(h, fp); kept.push(fp);
    }
    files.length = 0; files.push(...kept);
  }

  const METRIC = ['c', 'v', 's'].includes(args.metric) ? args.metric : (args.chroma ? 'c' : 's');
  const LOUD = +(args.loud ?? 0.60);
  const rows = [];
  for (const p of files) {
    const { data, ch, n } = await rawSmall(p);
    rows.push({ file: basename(p, extname(p)), ...concentration(data, ch, n, METRIC), hs: hueSpread(data, ch, n, LOUD) });
  }
  const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;

  console.log(`\npc_pal --conc · ${rows.length} image(s) · 320x180 · metric=${METRIC === 'c' ? 'ABSOLUTE CHROMA (max-min)/255' : METRIC === 'v' ? 'HSV SATURATION (max-min)/max — v1_sat.mjs\'s quantity' : 'HSL SATURATION (chroma.mjs)'}\n`);
  console.log('  SATURATION CONCENTRATION — how much of the frame is loud, and how concentrated the loudness is');
  console.log('  ' + 'image'.padEnd(22) + 'meanS  medS   p90S   p99S   gini   top5%  top10% top20% >0.50  >0.60  >0.70');
  const line = (label, r) => console.log('  ' + label.padEnd(22) +
    `${f(r.meanSat)}  ${f(r.medianSat)}  ${f(r.p90Sat)}  ${f(r.p99Sat)}  ${f(r.gini)}  ` +
    `${pct(r.top5, 1).padStart(5)}  ${pct(r.top10, 1).padStart(5)}  ${pct(r.top20, 1).padStart(5)}  ` +
    `${pct(r.areaAbove50, 1).padStart(5)}  ${pct(r.areaAbove60, 1).padStart(5)}  ${pct(r.areaAbove70, 1).padStart(5)}`);
  for (const r of rows) line(r.file.slice(0, 21), r);
  if (rows.length > 1) {
    console.log('  ' + '-'.repeat(96));
    line('MEAN', {
      meanSat: avg('meanSat'), medianSat: avg('medianSat'), p90Sat: avg('p90Sat'), p99Sat: avg('p99Sat'),
      gini: avg('gini'), top5: avg('top5'), top10: avg('top10'), top20: avg('top20'),
      areaAbove50: avg('areaAbove50'), areaAbove60: avg('areaAbove60'), areaAbove70: avg('areaAbove70'),
    });
  }
  // ── the hue half ──────────────────────────────────────────────────────────
  const usable = rows.filter((r) => r.hs.loud && r.hs.all);
  console.log(`\n  HUE SPREAD — how many hues carry the saturation. loud gate s >= ${LOUD}`);
  if (usable.length === 0) {
    console.log('    every image has ZERO loud chromatic pixels — refusing to print a mean over an empty set.');
  } else {
    if (usable.length !== rows.length) console.log(`    ⚠ ${rows.length - usable.length} image(s) had no loud chromatic mass and are EXCLUDED from the mean, not counted as 0.`);
    console.log('  ' + 'image'.padEnd(22) + 'loud%   ALL:effHues top1   top3   fam2   R      LOUD:effHues top1   top3   fam2   R');
    const hline = (label, r) => console.log('  ' + label.padEnd(22) +
      `${r.hs.loudAreaPct.toFixed(1).padStart(5)}   ` +
      `${f(r.hs.all.effHues, 2).padStart(9)} ${pct(r.hs.all.top1, 1).padStart(5)}  ${pct(r.hs.all.top3, 1).padStart(5)}  ${pct(r.hs.all.family2, 1).padStart(5)}  ${f(r.hs.all.R)}  ` +
      `${f(r.hs.loud.effHues, 2).padStart(10)} ${pct(r.hs.loud.top1, 1).padStart(5)}  ${pct(r.hs.loud.top3, 1).padStart(5)}  ${pct(r.hs.loud.family2, 1).padStart(5)}  ${f(r.hs.loud.R)}`);
    for (const r of usable) hline(r.file.slice(0, 21), r);
    if (usable.length > 1) {
      const m = (fn) => usable.reduce((a, r) => a + fn(r), 0) / usable.length;
      console.log('  ' + '-'.repeat(104));
      hline('MEAN', { hs: {
        loudAreaPct: m((r) => r.hs.loudAreaPct),
        all: { effHues: m((r) => r.hs.all.effHues), top1: m((r) => r.hs.all.top1), top3: m((r) => r.hs.all.top3), family2: m((r) => r.hs.all.family2), R: m((r) => r.hs.all.R) },
        loud: { effHues: m((r) => r.hs.loud.effHues), top1: m((r) => r.hs.loud.top1), top3: m((r) => r.hs.loud.top3), family2: m((r) => r.hs.loud.family2), R: m((r) => r.hs.loud.R) },
      } });
    }
  }
  console.log(`
  READ IT LIKE THIS
    gini / top-k    HIGH = saturation is RESERVED — a small area carries most of the chroma.
                    LOW  = it is spread evenly, which is Uri's "nothing leads and nothing recedes".
    medS            the BASE. A "muted, desaturated base for floors and environment" is a LOW median.
    >0.60           the share of frame that is loud. A restrained palette keeps this small.
    effHues         how many 30-deg hue bins the frame BEHAVES as though it uses (exp of entropy).
    fam2            the biggest two ADJACENT bins — one hue FAMILY, not two hues.
    LOUD:effHues    ** the direct form of "nothing leads": how many hues share the accent budget. **
`);
  if (args.json) await writeFile(String(args.json), JSON.stringify({ files, rows }, null, 2));
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: the class census
// ─────────────────────────────────────────────────────────────────────────────
function urlFor(lobby) {
  if (lobby) return `${BASE}/?screen=characters&player=${PLAYER}&pointerLock=0`;
  return `${BASE}/?player=${PLAYER}&enemy=${ENEMY}&px=${PX}&py=${PY}&fogRadius=${FOG}&simSpeed=${SIM_SPEED}&pointerLock=0`;
}

/** Fire the reserved-class effects and PROVE they fired. Returns null if not requested. */
async function spawnVfx(page, tag) {
  if (!args.vfx || tag === 'lobby') return null;
  const kinds = [
    { kind: 'weaponFired', dx: 0, dy: -40, who: PLAYER, amount: 40 },
    { kind: 'impact', dx: 40, dy: -70, amount: 46, color: '#FFC93C' },
    { kind: 'meleeArc', dx: -50, dy: -30, amount: 40 },
    { kind: 'castTelegraph', dx: -10, dy: -110, amount: 40, castMs: 4000 },
    { kind: 'heal', dx: 70, dy: 10, amount: 30 },
    { kind: 'giantSlam', dx: -90, dy: -90, amount: 40 },
  ];
  const res = await page.evaluate(PAGE_SPAWN_VFX, { x: +PX, y: +PY, kinds });
  if (res.error) { console.error(`  ✗ ${tag}: VFX spawn FAILED — ${res.error}`); return { error: res.error }; }
  const fired = Object.keys(res.after).filter((k) => (res.after[k] ?? 0) > (res.before[k] ?? 0));
  if (fired.length === 0) {
    console.error(`  ✗ ${tag}: __vfxSpawnTest ran and NO QA COUNTER MOVED. The frame would look empty and score 0% — refusing to call this a VFX frame.`);
    return { error: 'no counter moved' };
  }
  console.log(`  vfx fired: ${fired.map((k) => `${k}+${res.after[k] - (res.before[k] ?? 0)}`).join(' ')}`);
  await page.waitForTimeout(+(args['vfx-age'] ?? 220));   // let them build before the clock stops
  return { fired };
}

async function openPage(browser, lobby) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(urlFor(lobby), { waitUntil: 'networkidle', timeout: 90000 });
  if (lobby) {
    await page.waitForFunction("document.querySelector('canvas') && window.__stage && !window.__stage.disposed", null, { timeout: 90000 });
  } else {
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  }
  await page.waitForTimeout(SETTLE_MS);
  return { page, errors };
}

async function modeTree() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    for (const lobby of [false, true]) {
      const { page } = await openPage(browser, lobby);
      const t = await page.evaluate(PAGE_TREE);
      const tag = lobby ? 'LOBBY (charStage, pitch 20)' : 'MATCH (camera.ts, pitch 58)';
      console.log(`\n═══ ${tag} ═══  ${urlFor(lobby)}`);
      if (t.error) { console.log(`  ERROR: ${t.error}`); await page.close(); continue; }
      console.log(`  scene roots: ${t.roots.join(' · ')}`);
      const byClass = {};
      const unc = [];
      for (const m of t.meshes) {
        const c = classifyPath(m.path, String(m.mat));
        if (c === null) { if (m.vis) unc.push(m); continue; }
        (byClass[c] ||= []).push(m);
      }
      console.log(`  ${t.meshes.length} renderables · ${Object.keys(byClass).length} classes matched`);
      for (const [c, list] of Object.entries(byClass).sort((a, b) => b[1].length - a[1].length)) {
        const vis = list.filter((m) => m.vis).length;
        console.log(`    ${c.padEnd(12)} ${String(list.length).padStart(5)} meshes (${vis} visible)  e.g. ${list[0].path.slice(0, 78)}`);
      }
      if (unc.length) {
        console.log(`  🚨 UNCLASSIFIED AND VISIBLE: ${unc.length}`);
        const seen = new Set();
        for (const m of unc) {
          const k = `${m.path}|${m.mat}`;
          if (seen.has(k)) continue; seen.add(k); if (seen.size > 40) break;
          console.log(`      ${m.path.padEnd(42)} [${String(m.mat).padEnd(22)}] ${m.geo} bb=${m.bb} pos=${m.pos}`);
        }
      } else console.log('  ✓ every visible renderable is classified');
      await page.close();
    }
  } finally { await browser.close(); }
  return 0;
}

/** RULE 4 DRIFT CONTROL — the identical frame twice must be EXACTLY zero pixels apart. */
async function modeDrift() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let bad = 0;
  try {
    for (const lobby of [false, true]) {
      const { page } = await openPage(browser, lobby);
      await spawnVfx(page, lobby ? 'lobby' : 'match');
      await page.evaluate(PAGE_FREEZE);
      const left = await page.evaluate(PAGE_STILL_HUD);
      // ⚠️ 250 ms HERE WAS NOT ENOUGH AND THE FAILURE WAS SILENT-ISH: the lobby self-paired
      // at 8,818 px of 286,044 with a max delta of ONE — a whole-frame re-rasterisation, not
      // a moving object — because the pause style had not settled before the first shot. The
      // match camera read 0 px in the same run, so a single-camera control would have PASSED.
      await page.waitForTimeout(STILL_SETTLE_MS);
      const tag = lobby ? 'lobby' : 'match';
      const RECT = () => {
        const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
        const anims = document.getAnimations().map((x) => `${x.animationName ?? x.constructor?.name ?? '?'}:${x.playState}`);
        return { rect: [r.x, r.y, r.width, r.height], buf: [c.width, c.height], anims };
      };
      const a = join(OUT, `drift_${tag}_a.png`), b = join(OUT, `drift_${tag}_b.png`);
      const r1 = await page.evaluate(RECT);
      await page.locator('canvas').first().screenshot({ path: a, timeout: 90000 });
      await page.waitForTimeout(900);
      const r2 = await page.evaluate(RECT);
      await page.locator('canvas').first().screenshot({ path: b, timeout: 90000 });
      if (JSON.stringify(r1.rect) !== JSON.stringify(r2.rect)) {
        console.log(`    ⚠ ${tag}: the CANVAS BOX MOVED between shots ${JSON.stringify(r1.rect)} -> ${JSON.stringify(r2.rect)}`);
        console.log('      An element screenshot is a PAGE capture clipped to that box, so a sub-pixel');
        console.log('      move re-rasterises the whole frame. This is a page defect, not a renderer one.');
      }
      const running = r2.anims.filter((s) => s.endsWith(':running'));
      if (running.length) console.log(`    ⚠ ${tag}: ${running.length} animation(s) still RUNNING: ${[...new Set(running)].slice(0, 6).join(', ')}`);
      else if (r2.anims.length) console.log(`    ${tag}: ${r2.anims.length} animation(s) present, ALL paused (getAnimations() lists paused ones too — "left" is not "running")`);
      const [A, B] = await Promise.all([rawOf(a), rawOf(b)]);
      let px = 0, max = 0;
      if (A.w !== B.w || A.h !== B.h) { px = -1; } else {
        for (let i = 0; i < A.w * A.h; i++) {
          let d = 0;
          for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.data[i * A.ch + c] - B.data[i * B.ch + c]));
          if (d > 0) { px++; if (d > max) max = d; }
        }
      }
      const ok = px === 0;
      if (!ok) bad++;
      console.log(`  drift ${tag.padEnd(6)} rAF held, ${left} animation(s) left running · ${A.w}x${A.h} · ${px} px differ (max ${max})  ${ok ? '✓ EXACTLY ZERO' : '✗ NOT STILL'}`);
      await page.close();
    }
  } finally { await browser.close(); }
  if (bad) {
    console.error('\n🚨 A NON-ZERO SELF-PAIR MEANS EVERY NUMBER FROM THIS RIG IS QUOTED OVER MOVEMENT.');
    return 1;
  }
  console.log('\n  ✓ drift control clean at BOTH cameras — a census number from this rig describes one frame.');
  return 0;
}

async function modeCensus() {
  await mkdir(OUT, { recursive: true });
  // `other` is LAST and is a real, measured class — see PAGE_CLASS_MATTE's no-silent-drop note.
  const classes = [...new Set(CLASS_RULES.map((r) => r.cls)), 'other'];
  const rules = CLASS_RULES.map((r) => ({ cls: r.cls, pat: r.pat, mat: r.mat || [] }));
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report = [];
  let faults = 0;

  try {
    const cams = args.lobby === true ? [true] : args.match === true ? [false] : [false, true];
    for (const lobby of cams) {
      const tag = lobby ? 'lobby' : 'match';
      const { page, errors } = await openPage(browser, lobby);
      const vfx = await spawnVfx(page, tag);
      if (vfx && vfx.error) faults++;
      await page.evaluate(PAGE_FREEZE);
      await page.evaluate(PAGE_STILL_HUD);
      await page.waitForTimeout(STILL_SETTLE_MS);   // same value the drift control validates

      const full = join(OUT, `${tag}.png`);
      const canvasPng = join(OUT, `${tag}.canvas.png`);
      await page.screenshot({ path: full, timeout: 90000 });
      await page.locator('canvas').first().screenshot({ path: canvasPng, timeout: 90000 });

      // HUD-free capture — the class split is meaningless with the DOM HUD in it.
      const before = await page.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [c.width, c.height, Math.round(r.width), Math.round(r.height)]; });
      const hid = await page.evaluate(PAGE_HIDE_HUD);
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [c.width, c.height, Math.round(r.width), Math.round(r.height)]; });
      let nohudPng = null;
      if (!hid.hidden) { faults++; console.error(`  ⚠ ${tag}: no .hud-root/#screens — the HUD selector is stale, no honest environment number.`); }
      else if (hid.canvasVisibility !== 'visible') { faults++; console.error(`  ⚠ ${tag}: hiding the HUD ALSO HID THE CANVAS (computed ${hid.canvasVisibility}). REFUSING.`); }
      else if (before.join() !== after.join()) { faults++; console.error(`  ⚠ ${tag}: hiding the HUD RESIZED the canvas ${before} -> ${after}.`); }
      else { nohudPng = join(OUT, `${tag}.nohud.png`); await page.locator('canvas').first().screenshot({ path: nohudPng, timeout: 30000 }); }
      // ── THE DOM/UI CLASS ───────────────────────────────────────────────────
      // The scene graph cannot see the UI, and on the character-select screen the
      // 3D canvas is 394x725 of a 1600x900 page — under a fifth of what Uri is
      // looking at. The roster grid he describes as "pink, cyan, purple ... at
      // similar high saturation" is CSS. So the UI is matted the only way it can
      // be: a full-page capture with the DOM hidden, diffed against one with it
      // shown. ⚠️ This matte IS colour-dependent — a UI pixel that happens to
      // equal the pixel behind it is missed — which is exactly the weakness the
      // scene matte avoids by the two-clear trick. It is an UNDER-count, never an
      // over-count, and it is stated rather than discovered.
      let uiStats = null, uiAreaPct = null, pageStats = null;
      if (nohudPng) {
        const fullNoHud = join(OUT, `${tag}.page_nohud.png`);
        await page.screenshot({ path: fullNoHud, timeout: 90000 });
        const [F, G] = await Promise.all([rawOf(full), rawOf(fullNoHud)]);
        if (F.w === G.w && F.h === G.h) {
          const NP = F.w * F.h, ui = [];
          for (let i = 0; i < NP; i++) {
            let d = 0;
            for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(F.data[i * F.ch + c] - G.data[i * G.ch + c]));
            if (d > 0) ui.push(i);
          }
          uiStats = statsOver(F.data, F.ch, ui);
          uiAreaPct = (ui.length / NP) * 100;
          pageStats = statsOver(F.data, F.ch, Array.from({ length: NP }, (_, i) => i));
        }
      }
      await page.evaluate(PAGE_SHOW_HUD);

      const matte = await page.evaluate(PAGE_CLASS_MATTE, { rules, classes });
      await page.close();
      if (matte.error) { faults++; console.error(`  ✗ ${tag}: class matte FAILED — ${matte.error}`); continue; }
      if (!nohudPng) { faults++; continue; }

      // ── RULE 6: assert the SUBJECT IS IN SHOT before believing any number ────
      // An instrument that photographed the sky and reported PASS asserted only
      // that its rig was reachable. These assert the frame contains the thing.
      const [Wp, Hp] = matte.buffer;
      // ⚠️ THE LOBBY CANVAS IS 394x726 IN CSS AND 394x725 IN ITS DRAWING BUFFER, so the
      // id map and the PNG are one ROW apart. Refusing outright (the first behaviour) is
      // right for a big mismatch and wrong for this one — it threw away the camera Uri
      // actually judges. A <=2px difference is resampled NEAREST, which introduces no
      // colour that was not already in the image; anything larger is still refused,
      // because at that point the two are not the same framing.
      let nohudFixed = nohudPng, resampled = null;
      {
        const probe = await sharp(nohudPng).metadata();
        if (probe.width !== Wp || probe.height !== Hp) {
          if (Math.abs(probe.width - Wp) > 2 || Math.abs(probe.height - Hp) > 2) {
            faults++;
            console.error(`  ✗ ${tag}: PNG ${probe.width}x${probe.height} vs drawing buffer ${Wp}x${Hp} — not the same framing. REFUSING.`);
            continue;
          }
          nohudFixed = join(OUT, `${tag}.nohud.fit.png`);
          await sharp(nohudPng).resize(Wp, Hp, { fit: 'fill', kernel: 'nearest' }).png().toFile(nohudFixed);
          resampled = `${probe.width}x${probe.height} -> ${Wp}x${Hp} nearest`;
        }
      }
      const raw = await rawOf(nohudFixed);
      const idBuf = Buffer.from(matte.idB64, 'base64');
      const N = Wp * Hp;

      const idxByClass = {};
      classes.forEach((c, i) => { idxByClass[c] = []; });
      let bg = 0;
      for (let i = 0; i < N; i++) {
        const v = idBuf[i];
        if (v === 0) { bg++; continue; }
        idxByClass[classes[v - 1]].push(i);
      }

      const castPx = idxByClass.characters.length;
      const castPct = (castPx / N) * 100;
      const subjectOk = castPx > 0;
      if (!subjectOk) {
        faults++;
        console.error(`  ✗ ${tag}: ZERO character pixels. The subject is not in shot; every class share below would be a real-looking lie. REFUSING.`);
        continue;
      }

      const frame = statsOver(raw.data, raw.ch, Array.from({ length: N }, (_, i) => i));
      const perClass = {};
      for (const c of classes) perClass[c] = statsOver(raw.data, raw.ch, idxByClass[c]);

      // whole-frame WITH the HUD, so the HUD's own budget can be priced
      const withHud = await rawOf(canvasPng);
      const hudFrame = statsOver(withHud.data, withHud.ch, Array.from({ length: withHud.w * withHud.h }, (_, i) => i));

      const small = await rawSmall(nohudFixed);
      const conc = concentration(small.data, 3, 320 * 180, 's');
      const concC = concentration(small.data, 3, 320 * 180, 'c');

      report.push({
        camera: tag, url: urlFor(lobby), viewport: [W, H], buffer: [Wp, Hp],
        errors: errors.slice(0, 8),
        matte: { overlapPx: matte.overlapPx, objectsByClass: matte.objectsByClass, unclassified: matte.unclassified },
        backgroundPx: bg, castCoveragePct: +castPct.toFixed(3), resampled,
        frame, hudFrame, perClass, conc, concC, ui: uiStats, uiAreaPct, page: pageStats, vfx,
      });

      // a look-at-it map, magenta per class (rule 3 — the PNG gets READ)
      // 🚨 ONE COLOUR PER CLASS, NO MODULO. The first version had 11 entries for 14
      // classes and wrapped, so `ground` (id 12) and `characters` (id 1) rendered
      // IDENTICALLY — the character vanished into the floor in the one image whose whole
      // job is to let a human check the matte. The data was right and the picture was a
      // lie, which is the exact failure CLAUDE.md rule 3 exists to catch. Assert the
      // length instead of trusting it.
      const PALETTE = [
        [255, 255, 255],  // characters  — white, the subject
        [ 60, 220, 255],  // projectiles
        [255, 210,  60],  // telegraph
        [255, 110,  30],  // hazards
        [170,  90, 255],  // fog
        [ 90, 255, 130],  // vfx
        [ 40,  40,  60],  // shadows
        [255, 105, 180],  // props
        [ 20, 110, 200],  // apron
        [140,  70,  30],  // decor
        [200, 200, 120],  // ambient
        [ 90,  20,  70],  // ground      — dark plum, far from white
        [ 30,  90,  80],  // backdrop
        [255,   0,   0],  // other       — RED, so an unattributed region is unmissable
      ];
      if (PALETTE.length < classes.length) throw new Error(`pc_pal: ${classes.length} classes but ${PALETTE.length} legend colours — the classmap would alias.`);
      const cm = Buffer.alloc(N * 3);
      for (let i = 0; i < N; i++) {
        const v = idBuf[i];
        if (v === 0) { cm[i * 3] = 18; cm[i * 3 + 1] = 18; cm[i * 3 + 2] = 22; continue; }
        const p = PALETTE[v - 1];
        cm[i * 3] = p[0]; cm[i * 3 + 1] = p[1]; cm[i * 3 + 2] = p[2];
      }
      await sharp(cm, { raw: { width: Wp, height: Hp, channels: 3 } }).png().toFile(join(OUT, `${tag}.classmap.png`));
      // and the same map at 55% over the real frame, so the matte can be checked
      // AGAINST the thing it claims to describe rather than on its own.
      const ov = Buffer.alloc(N * 3);
      for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) ov[i * 3 + c] = Math.round(0.55 * cm[i * 3 + c] + 0.45 * raw.data[i * raw.ch + c]);
      await sharp(ov, { raw: { width: Wp, height: Hp, channels: 3 } }).png().toFile(join(OUT, `${tag}.classover.png`));
      console.log(`  legend: ` + classes.map((c, i) => `${c}=rgb(${PALETTE[i].join(',')})`).join('  '));
    }
  } finally { await browser.close(); }

  if (report.length === 0) { console.error('\npc_pal: NO camera produced a census. Nothing to report.'); return 2; }

  // ── print ──────────────────────────────────────────────────────────────────
  for (const r of report) {
    const classes2 = Object.keys(r.perClass);
    console.log(`\n═══ ${r.camera.toUpperCase()} CAMERA ═══  ${r.buffer[0]}x${r.buffer[1]}  ·  cast coverage ${r.castCoveragePct}% of frame`);
    if (r.matte.unclassified.length) {
      console.log(`  🚨 ${r.matte.unclassified.length} UNCLASSIFIED VISIBLE PATH(S) — they are in NO class and NO total:`);
      r.matte.unclassified.slice(0, 12).forEach((p) => console.log(`      ${p}`));
    }
    if (r.matte.overlapPx) console.log(`  ⚠ ${r.matte.overlapPx} px claimed by more than one class (transparent / depthWrite:false). FIRST claimant kept — the rule order is front-to-back.`);
    const satTot = r.frame.satSum;
    console.log('');
    if (r.resampled) console.log(`  ⚠ the HUD-free PNG was resampled ${r.resampled} to index against the id map.`);
    console.log('  class         area%   chroma%   LEVERAGE   meanS   meanC   meanL   meanV   hue°   R      chromatic%');
    console.log('  ' + '-'.repeat(102));
    const rows = classes2.map((c) => {
      const s = r.perClass[c];
      if (!s) return { c, s: null };
      return { c, s, area: s.px / (r.buffer[0] * r.buffer[1]), chroma: s.satSum / satTot };
    }).sort((a, b) => (b.s ? b.area : -1) - (a.s ? a.area : -1));
    for (const row of rows) {
      if (!row.s) { console.log(`  ${row.c.padEnd(12)}  absent — not in frame (a mean over an empty set is refused, not printed as 0)`); continue; }
      const lev = row.area > 0 ? row.chroma / row.area : null;
      console.log(`  ${row.c.padEnd(12)}${pct(row.area).padStart(6)}  ${pct(row.chroma).padStart(7)}   ` +
        `${lev === null ? '  —  ' : lev.toFixed(2).padStart(6)}    ${f(row.s.meanSat)}  ${f(row.s.meanChroma)}  ${f(row.s.meanL)}  ${f(row.s.meanV)}  ` +
        `${row.s.hueMeanDeg === null ? ' — ' : row.s.hueMeanDeg.toFixed(0).padStart(4)}  ${f(row.s.hueR, 3)}  ${row.s.chromaticPct.toFixed(1).padStart(5)}`);
    }
    const bgArea = r.backgroundPx / (r.buffer[0] * r.buffer[1]);
    console.log(`  ${'(clear)'.padEnd(12)}${pct(bgArea).padStart(6)}        —        —      — no geometry drew here`);
    console.log('  ' + '-'.repeat(102));
    console.log(`  ${'FRAME'.padEnd(12)}${'100.00'.padStart(6)}  ${'100.00'.padStart(7)}     1.00    ${f(r.frame.meanSat)}  ${f(r.frame.meanChroma)}  ${f(r.frame.meanL)}  ${f(r.frame.meanV)}  ` +
      `${r.frame.hueMeanDeg === null ? ' — ' : r.frame.hueMeanDeg.toFixed(0).padStart(4)}  ${f(r.frame.hueR, 3)}  ${r.frame.chromaticPct.toFixed(1).padStart(5)}`);
    console.log(`  ${'+HUD'.padEnd(12)}   the same canvas WITH the DOM over it: meanS ${f(r.hudFrame.meanSat)} (canvas alone ${f(r.frame.meanSat)})`);
    if (r.ui) {
      console.log('');
      console.log(`  UI / DOM class — measured on the FULL ${W}x${H} PAGE, a different basis from the rows above`);
      console.log(`    ui        ${pct(r.uiAreaPct / 100).padStart(6)}% of the page   meanS ${f(r.ui.meanSat)}  meanC ${f(r.ui.meanChroma)}  meanL ${f(r.ui.meanL)}  ` +
        `hue ${r.ui.hueMeanDeg === null ? '—' : r.ui.hueMeanDeg.toFixed(0)}°  R ${f(r.ui.hueR, 3)}  chromatic ${r.ui.chromaticPct.toFixed(1)}%`);
      console.log(`    whole page                 meanS ${f(r.page.meanSat)}  meanC ${f(r.page.meanChroma)}  meanL ${f(r.page.meanL)}  ` +
        `hue ${r.page.hueMeanDeg === null ? '—' : r.page.hueMeanDeg.toFixed(0)}°  R ${f(r.page.hueR, 3)}`);
      console.log(`    ⚠ this matte is colour-dependent (diff of two page captures) and therefore UNDER-counts.`);
    }

    // the split that answers Uri
    const grp = (set) => {
      const idx = classes2.filter((c) => set.has(c)).flatMap(() => []);
      let area = 0, chroma = 0;
      for (const c of classes2) {
        if (!set.has(c)) continue;
        const s = r.perClass[c]; if (!s) continue;
        area += s.px / (r.buffer[0] * r.buffer[1]);
        chroma += s.satSum / satTot;
      }
      return { area, chroma, lev: area > 0 ? chroma / area : null };
    };
    const res = grp(RESERVED), base = grp(BASE_SET);
    // ── WHO OWNS THE LOUD PIXELS ────────────────────────────────────────────
    // The sharpest form of "reserve high saturation almost entirely for the things
    // that must be read instantly": of every pixel in the frame at or above the
    // accent gate, what share belongs to each class?
    const frameLoud = r.frame.loudPx, frameLoudC = r.frame.loudPxC;
    console.log('');
    if (frameLoud === 0) {
      console.log(`  LOUD-PIXEL OWNERSHIP: the frame has ZERO pixels at s >= ${LOUD_GATE} — nothing to share out. Refusing to print shares.`);
    } else {
      console.log(`  LOUD-PIXEL OWNERSHIP — of the ${pct(frameLoud / (r.buffer[0] * r.buffer[1]), 1)}% of frame at s >= ${LOUD_GATE}, who owns it?`);
      const lrows = classes2.map((c) => ({ c, s: r.perClass[c] })).filter((x) => x.s && x.s.loudPx > 0)
        .sort((a, b) => b.s.loudPx - a.s.loudPx);
      if (lrows.length === 0) console.log('    no class holds a loud pixel — the frame total and the class totals DISAGREE. Suspect the matte.');
      for (const x of lrows) {
        console.log(`    ${x.c.padEnd(12)} ${pct(x.s.loudPx / frameLoud, 1).padStart(5)}% of the loud pixels ` +
          `· ${pct(x.s.loudPx / x.s.px, 1).padStart(5)}% of its own area is loud ` +
          `· at chroma>=${LOUD_GATE_C}: ${pct(x.s.loudPxC / Math.max(1, frameLoudC), 1).padStart(5)}%`);
      }
      const share = (set) => classes2.filter((c) => set.has(c)).reduce((a, c) => a + (r.perClass[c] ? r.perClass[c].loudPx : 0), 0) / frameLoud;
      console.log(`    ─ RESERVED holds ${pct(share(RESERVED), 1)}% of the loud pixels · BASE holds ${pct(share(BASE_SET), 1)}%`);
    }
    console.log('');
    console.log('  URI\'S CLAIM — "reserve high saturation almost entirely for the things read instantly"');
    console.log(`    RESERVED set (${[...RESERVED].join(', ')})`);
    console.log(`      area ${pct(res.area)}%   chroma ${pct(res.chroma)}%   leverage ${res.lev === null ? '—' : res.lev.toFixed(2)}`);
    console.log(`    BASE set (${[...BASE_SET].join(', ')})`);
    console.log(`      area ${pct(base.area)}%   chroma ${pct(base.chroma)}%   leverage ${base.lev === null ? '—' : base.lev.toFixed(2)}`);
    console.log(`    -> the base carries ${pct(base.chroma)}% of the frame's saturation on ${pct(base.area)}% of its area.`);
    console.log('');
    console.log(`  CONCENTRATION (HUD-free, 320x180)`);
    console.log(`    HSL sat : gini ${f(r.conc.gini)}  med ${f(r.conc.medianSat)}  top10% carries ${pct(r.conc.top10, 1)}%  area>0.60 ${pct(r.conc.areaAbove60, 1)}%`);
    console.log(`    chroma  : gini ${f(r.concC.gini)}  med ${f(r.concC.medianSat)}  top10% carries ${pct(r.concC.top10, 1)}%  area>0.60 ${pct(r.concC.areaAbove60, 1)}%`);
  }

  const jsonPath = join(OUT, 'census.json');
  await writeFile(jsonPath, JSON.stringify({ base: BASE, sha: process.env.HEADSERVE_SHA ?? null, report }, null, 2));
  console.log(`\n  wrote ${jsonPath}`);
  console.log(`  🔴 OPEN ${join(OUT, '<camera>.classmap.png')} AND LOOK AT IT before believing any row above.`);
  if (faults) { console.error(`\n  ${faults} fault(s).`); return 1; }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --selftest — the known-bad battery. No browser.
//
// AGENT-BRIEF §4.4: a guard not shown to FAIL on the bug it guards is not a
// guard, and a guard can pass by having nothing left to check. Every section
// below plants the defect and requires the assertion to go red.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else { fail++; console.log(`  ✗ ${label}\n      got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`); }
    if (ok && process.env.PC_VERBOSE) console.log(`  ✓ ${label}`);
  };
  const near = (label, got, want, tol) => {
    const ok = Math.abs(got - want) <= tol;
    if (ok) pass++; else { fail++; console.log(`  ✗ ${label}\n      got ${got}  want ${want} ±${tol}`); }
  };

  console.log('pc_pal --selftest\n');

  // ── A. the colour maths, against hand-computable inputs ───────────────────
  console.log('A. HSL, chroma.mjs methodology');
  check('A1 pure red hue', Math.round(hsl(255, 0, 0).h), 0);
  check('A2 pure green hue', Math.round(hsl(0, 255, 0).h), 120);
  check('A3 pure blue hue', Math.round(hsl(0, 0, 255).h), 240);
  check('A4 mid grey is s=0', hsl(128, 128, 128).s, 0);
  check('A5 pure red is s=1', hsl(255, 0, 0).s, 1);
  near('A6 l>0.5 branch: (255,128,128) -> s', hsl(255, 128, 128).s, 1.0, 0.01);
  // HSL vs HSV: two different quantities, and this repo now contains a tool for each.
  near('A6a (255,128,128): HSL s = 1.000', hsl(255, 128, 128).s, 1.0, 0.005);
  near('A6b (255,128,128): HSV s = 0.498 — the SAME pixel, half the number', hsl(255, 128, 128).sv, 0.498, 0.005);
  check('A6c KNOWN-BAD: quoting one band against the other is a 2x error on this pixel',
    hsl(255, 128, 128).s / hsl(255, 128, 128).sv > 1.9, true);
  near('A6d CONTROL: at l = 0.5 exactly the two AGREE, so the gap is lightness-driven',
    hsl(255, 0, 0).s - hsl(255, 0, 0).sv, 0, 1e-9);
  near('A7 l<=0.5 branch: (128,0,0)  -> s', hsl(128, 0, 0).s, 1.0, 0.01);
  check('A8 KNOWN-BAD: the l>0.5 branch is REACHED (a single-branch impl would differ)',
    hsl(255, 200, 200).l > 0.5, true);

  // ── B. classifier — order is the correctness argument ─────────────────────
  console.log('B. classifier ordering and completeness');
  check('B1 a character root', classifyPath('character:hamburger/rig_root/torso_mesh'), 'characters');
  check('B2 a rig under no character root still classifies', classifyPath('/rig_root/head_mesh'), 'characters');
  check('B3 a projectile under vfx_layer is PROJECTILES, not VFX',
    classifyPath('vfx_layer/projectile:hamburger.patty'), 'projectiles');
  check('B4 a plain vfx child is VFX', classifyPath('vfx_layer/'), 'vfx');
  check('B5 a puddle under the kitchen is HAZARDS, not GROUND',
    classifyPath('arena:kitchen/puddle_grease_surface__no_outline'), 'hazards');
  check('B6 a prop is PROPS', classifyPath('arena:kitchen/arena_props/cover:crate'), 'props');
  check('B7 the apron is its own class, not ground', classifyPath('arena:kitchen/arena_apron/apron_kerb'), 'apron');
  check('B8 the floor is GROUND', classifyPath('arena:kitchen/floor_mat_crease__no_outline'), 'ground');
  check('B9 fog is its own class', classifyPath('fog_boundary/fog_curtain__no_outline'), 'fog');
  check('B10 contact shadows are their own class', classifyPath('contact:shadows/contact:decal'), 'shadows');
  check('B11 nothing matched returns NULL, never a catch-all bucket',
    classifyPath('some/unknown/thing'), null);
  // KNOWN-BAD: reverse the order and B3/B5 must break. Proves order is load-bearing
  // rather than incidental — the exact thing a "looks fine" reading would miss.
  {
    const reversed = [...CLASS_RULES].reverse();
    const classifyRev = (p) => { for (const r of reversed) for (const x of r.pat) if (new RegExp(x).test(p)) return r.cls; return null; };
    check('B12 KNOWN-BAD reversed order MIS-classifies the projectile', classifyRev('vfx_layer/projectile:x.y'), 'vfx');
    // ⚠️ The first form of B13 asserted a reversed `arena:kitchen/puddle_x` would read
    // GROUND. It read `hazards`, because NO ground pattern matches that path at all —
    // the arm was testing a collision that does not exist. The real ordering collision
    // is the pot, which lives under `arena_props` and must not be counted as furniture.
    check('B13 KNOWN-BAD reversed order counts the POT as furniture, not as a hazard',
      classifyRev('arena:kitchen/arena_props/pot_solid'), 'props');
  }
  // CONTROL for B12/B13: they must differ from the shipped answer, or the arm is vacuous.
  check('B14 CONTROL: the shipped order and the reversed order DISAGREE (the arm is not vacuous)',
    classifyPath('vfx_layer/projectile:x.y') !== 'vfx', true);
  check('B15 every rule has at least one pattern (a ruleless class matches nothing, silently)',
    CLASS_RULES.length > 0 && CLASS_RULES.every((r) => r.pat.length + (r.mat || []).length > 0), true);
  check('B16 KNOWN-BAD: the B15 form is VACUOUS on an empty rule list — assert non-empty FIRST',
    [].every((r) => r.pat.length > 0), true);   // documents that [].every() is TRUE
  check('B17 RESERVED and BASE_SET are disjoint', [...RESERVED].some((c) => BASE_SET.has(c)), false);
  check('B18 RESERVED and BASE_SET together cover every declared class except fog',
    [...new Set(CLASS_RULES.map((r) => r.cls))].filter((c) => !RESERVED.has(c) && !BASE_SET.has(c)), ['fog']);
  // ── the MATERIAL half. Measured on 9ed8f63 and it is not hypothetical: these
  //    two decals carry two empty group names as their whole path.
  check('B19 a hazard decal with an EMPTY path classifies off its MATERIAL',
    classifyPath('arena:kitchen//', 'hazard:scorch'), 'hazards');
  check('B20 the same for the glow decal', classifyPath('arena:kitchen//', 'hazard:glow'), 'hazards');
  check('B21 a grease puddle classifies as a hazard, not as ground',
    classifyPath('arena:kitchen///puddle', 'kpal:grease'), 'hazards');
  check('B22 KNOWN-BAD: PATH-ONLY classification loses the hazard decal entirely',
    (() => { for (const r of CLASS_RULES) for (const p of r.pat) if (new RegExp(p).test('arena:kitchen//')) return r.cls; return null; })(), null);
  check('B23 CONTROL: B22 and B19 DISAGREE, so the material half is load-bearing',
    classifyPath('arena:kitchen//', 'hazard:scorch') !== null, true);
  check('B24 floor debris is DECOR, not ground', classifyPath('arena:kitchen///debris_veg', 'kpal:debrisBerry'), 'decor');
  check('B25 the lobby wall is BACKDROP', classifyPath('menu_wall', 'MeshStandardMaterial'), 'backdrop');
  check('B26 the lobby floor is GROUND', classifyPath('menu_ground_decal', 'MeshBasicMaterial'), 'ground');
  check('B27 the lobby plinth is PROPS', classifyPath('menu_plinth_rim', 'MeshStandardMaterial'), 'props');
  check('B28 an UNNAMED lobby mesh is unreachable by name — it must return null, not a guess',
    classifyPath('', 'MeshStandardMaterial'), null);

  // ── C. statsOver — the vacuity guard ──────────────────────────────────────
  console.log('C. per-class statistics and the empty-set refusal');
  const mk = (px) => { const b = Buffer.alloc(px.length * 3); px.forEach((p, i) => { b[i * 3] = p[0]; b[i * 3 + 1] = p[1]; b[i * 3 + 2] = p[2]; }); return b; };
  const red = mk([[255, 0, 0], [255, 0, 0], [255, 0, 0], [255, 0, 0]]);
  check('C1 EMPTY SET returns null, not 0 — the [].every() class', statsOver(red, 3, []), null);
  check('C2 null input returns null', statsOver(red, 3, null), null);
  const s4 = statsOver(red, 3, [0, 1, 2, 3]);
  check('C3 four red pixels: px', s4.px, 4);
  check('C4 four red pixels: meanSat', s4.meanSat, 1);
  near('C5 four red pixels: hue mean', s4.hueMeanDeg, 0, 0.001);
  near('C6 four red pixels: circular R = 1 (one hue exactly)', s4.hueR, 1, 1e-9);
  // ⚠️ This arm first used red + BLUE and asserted R < 0.2. Two hues 120° apart give
  // R = 0.500 EXACTLY, so it failed — and it was the assertion that was wrong, not the
  // maths. Opposite means 180°: red 0° and cyan 180°, which cancel to R = 0.
  const mixed = mk([[255, 0, 0], [0, 255, 255]]);
  const s2 = statsOver(mixed, 3, [0, 1]);
  check('C7 KNOWN-BAD: two OPPOSITE hues (0° / 180°) must NOT read as concentrated', s2.hueR < 0.02, true);
  const bent = statsOver(mk([[255, 0, 0], [0, 0, 255]]), 3, [0, 1]);
  near('C7b CONTROL: two hues 120° apart read R = 0.5 exactly, so the arm has a scale', bent.hueR, 0.5, 1e-9);
  const greys = mk([[100, 100, 100], [140, 140, 140]]);
  const sg = statsOver(greys, 3, [0, 1]);
  check('C8 greys carry no hue opinion (hueMeanDeg null, not 0°)', sg.hueMeanDeg, null);
  check('C9 KNOWN-BAD: a 0° default would be indistinguishable from RED here', sg.hueMeanDeg === 0, false);
  check('C10 satSum is a SUM, so it can be shared out across classes', s4.satSum, 4);
  check('C11 four red pixels are all LOUD (s=1 >= 0.60)', s4.loudPx, 4);
  check('C12 two greys are NOT loud', sg.loudPx, 0);
  check('C13 KNOWN-BAD: a mid pixel at s=0.5 must NOT count as loud',
    statsOver(mk([[191, 64, 64]]), 3, [0]).loudPx, 0);
  check('C14 CONTROL: the same pixel pushed to s=0.8 DOES count — the gate has a scale',
    statsOver(mk([[230, 26, 26]]), 3, [0]).loudPx, 1);

  // ── D. concentration — the class-free half, and it must SEPARATE ──────────
  console.log('D. saturation concentration (the plate-comparable half)');
  const flat = Buffer.alloc(1000 * 3);
  for (let i = 0; i < 1000; i++) { flat[i * 3] = 200; flat[i * 3 + 1] = 100; flat[i * 3 + 2] = 100; }
  const cFlat = concentration(flat, 3, 1000);
  near('D1 a UNIFORM frame has gini ~ 0', cFlat.gini, 0, 0.001);
  // ── the SECOND metric. HSL saturation is not perceptual on dark pixels — a very dark
  //    but hue-bearing colour reads s ~ 1 — so a frame's meanSat can be high purely by
  //    being dark. Absolute chroma (max-min)/255 does not do that, and the two must be
  //    shown to DISAGREE on such a frame or carrying both is pointless.
  {
    const dark = Buffer.alloc(600 * 3);
    for (let i = 0; i < 600; i++) { dark[i * 3] = 30; dark[i * 3 + 1] = 0; dark[i * 3 + 2] = 12; }
    const ds = concentration(dark, 3, 600, 's'), dc = concentration(dark, 3, 600, 'c');
    near('D1a a DARK saturated frame reads meanSat 1.000 on HSL', ds.meanSat, 1.0, 0.001);
    near('D1b   the same frame reads meanChroma 0.118 — the two are NOT interchangeable', dc.meanSat, 30 / 255, 0.001);
    check('D1c KNOWN-BAD: quoting HSL sat as "colourfulness" here overstates it 8.5x',
      ds.meanSat / dc.meanSat > 8, true);
    check('D1d CONTROL: on a MID-lightness frame the two agree far more closely',
      Math.abs(concentration(flat, 3, 1000, 's').meanSat - concentration(flat, 3, 1000, 'c').meanSat) < 0.2, true);
  }
  near('D2 a UNIFORM frame: the top 10% carries ~10% of the chroma', cFlat.top10, 0.10, 0.005);
  const reserved = Buffer.alloc(1000 * 3);
  for (let i = 0; i < 1000; i++) {
    if (i < 950) { reserved[i * 3] = 128; reserved[i * 3 + 1] = 128; reserved[i * 3 + 2] = 128; }
    else { reserved[i * 3] = 255; reserved[i * 3 + 1] = 0; reserved[i * 3 + 2] = 0; }
  }
  const cRes = concentration(reserved, 3, 1000);
  near('D3 a RESERVED frame (95% grey, 5% saturated) has gini ~ 0.95', cRes.gini, 0.95, 0.02);
  near('D4 a RESERVED frame: the top 5% carries 100% of the chroma', cRes.top5, 1.0, 0.001);
  near('D5 a RESERVED frame has median saturation 0', cRes.medianSat, 0, 1e-9);
  check('D6 THE ARM IS NOT VACUOUS: the two frames SEPARATE by > 0.9 gini', cRes.gini - cFlat.gini > 0.9, true);
  check('D7 KNOWN-BAD: the SAME frame twice separates by 0 — a self-pair cannot validate this',
    Math.abs(concentration(flat, 3, 1000).gini - cFlat.gini) < 1e-12, true);
  check('D8 area above 0.60 is 5% on the reserved frame', +(cRes.areaAbove60 * 100).toFixed(1), 5.0);
  check('D9 area above 0.60 is 100% on the flat frame (s=0.5? assert what it IS)',
    cFlat.areaAbove60 === 0 || cFlat.areaAbove60 === 1, true);
  // an all-grey frame: total chroma is 0, and every share must be 0 rather than NaN
  const dead = Buffer.alloc(300 * 3).fill(90);
  const cDead = concentration(dead, 3, 300);
  check('D10 a CHROMA-FREE frame yields 0, never NaN', [cDead.gini, cDead.top10, cDead.meanSat], [0, 0, 0]);

  // ── D2. hueSpread — the statistic the recommendation actually turns on ────
  console.log('D2. hue spread');
  {
    const mkN = (list) => { const b = Buffer.alloc(list.length * 3); list.forEach((p, i) => { b[i * 3] = p[0]; b[i * 3 + 1] = p[1]; b[i * 3 + 2] = p[2]; }); return b; };
    // one hue, loud
    const one = mkN(Array.from({ length: 120 }, () => [255, 0, 0]));
    const h1 = hueSpread(one, 3, 120, 0.6);
    near('D2a ONE loud hue -> effHues 1.00', h1.loud.effHues, 1, 1e-9);
    near('D2b ONE loud hue -> top1 100%', h1.loud.top1, 1, 1e-9);
    near('D2c ONE loud hue -> R 1.00', h1.loud.R, 1, 1e-9);
    // six hues, equally loud, evenly spread round the wheel
    const six = mkN([[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255]]);
    const h6 = hueSpread(six, 3, 6, 0.6);
    near('D2d SIX evenly spread loud hues -> effHues 6.00', h6.loud.effHues, 6, 1e-9);
    near('D2e SIX evenly spread loud hues -> R 0.00 (they cancel)', h6.loud.R, 0, 1e-9);
    check('D2f THE ARM SEPARATES: one hue vs six differ by 5 effective hues',
      h6.loud.effHues - h1.loud.effHues > 4.9, true);
    // KNOWN-BAD: two ADJACENT bins are one hue family, and effHues alone calls that 2.
    // ⚠️ [255,60,0] is hue 14deg — the SAME bin as red, so the first version of this
    //    arm proved nothing. [255,190,0] is 44.7deg, bin 1, genuinely adjacent.
    const adj = mkN([[255, 0, 0], [255, 190, 0]]);
    const hA = hueSpread(adj, 3, 2, 0.6);
    check('D2g KNOWN-BAD: two ADJACENT bins read effHues 2 — entropy cannot see a family',
      hA.loud.effHues > 1.9, true);
    check('D2h ...which is why fam2 exists: it recovers them as ONE family at 100%',
      Math.abs(hA.loud.family2 - 1) < 1e-9, true);
    // vacuity: a grey frame has no loud chromatic mass and must return null
    const greyF = Buffer.alloc(50 * 3).fill(120);
    const hG = hueSpread(greyF, 3, 50, 0.6);
    check('D2i a CHROMA-FREE frame returns null for both arms, never 0', [hG.all, hG.loud], [null, null]);
    // a frame that is chromatic but never LOUD: `all` present, `loud` null
    // ⚠️ [150,120,120] reads s = 0.125 and is below the 0.15 chromatic gate entirely,
    //    so it tested the wrong thing. [160,110,110] is s = 0.208: chromatic, not loud.
    const dim = mkN(Array.from({ length: 40 }, () => [160, 110, 110]));
    const hD = hueSpread(dim, 3, 40, 0.6);
    check('D2j a chromatic-but-quiet frame has an ALL arm and a NULL loud arm',
      [hD.all !== null, hD.loud], [true, null]);
    check('D2k KNOWN-BAD: reporting that frame as loud-effHues 0 would rank it BEST',
      hD.loud === null, true);
  }

  // ── E. the leverage arithmetic, which is what the report quotes ───────────
  console.log('E. leverage — the number the recommendation rests on');
  {
    // a synthetic frame: base = 80% of area with meanSat 0.2; accent = 20% at 0.8
    const areaBase = 0.8, satBase = 0.2, areaAcc = 0.2, satAcc = 0.8;
    const tot = areaBase * satBase + areaAcc * satAcc;
    const levBase = (areaBase * satBase / tot) / areaBase;
    const levAcc = (areaAcc * satAcc / tot) / areaAcc;
    near('E1 leverage of the base < 1', levBase, 0.625, 0.001);
    near('E2 leverage of the accent > 1', levAcc, 2.5, 0.001);
    near('E3 area-weighted leverage sums to 1', areaBase * levBase + areaAcc * levAcc, 1, 1e-9);
    // KNOWN-BAD: when everything carries the SAME saturation, every leverage is 1 —
    // which is precisely Uri's "nothing leads and nothing recedes", so the metric
    // must produce exactly 1.00 there and not something merely close.
    const t2 = areaBase * 0.5 + areaAcc * 0.5;
    near('E4 KNOWN-BAD "nothing leads": equal saturation everywhere -> leverage exactly 1',
      (areaBase * 0.5 / t2) / areaBase, 1, 1e-12);
  }

  // ── F. the page-side matte contract, asserted structurally ────────────────
  console.log('F. matte contract');
  check('F1 class list is unique (a duplicate would silently overwrite an id)',
    [...new Set(CLASS_RULES.map((r) => r.cls))].length, CLASS_RULES.length);
  check('F2 class count fits a Uint8 id map with 0 reserved for background',
    CLASS_RULES.length < 255, true);
  check('F3 the matte keys colorWrite on the OBJECT (shared materials), not the material',
    /onBeforeRender\s*=\s*function/.test(String(PAGE_CLASS_MATTE)), true);
  check('F4 the matte BYPASSES the post chain (r.render, not stage.render)',
    /r\.render\(scene, cam\)/.test(String(PAGE_CLASS_MATTE)) && !/stage\.render\(0\)[\s\S]*r\.render/.test(String(PAGE_CLASS_MATTE)), true);
  check('F5 the matte RESTORES colorWrite in a finally', /finally\s*\{[\s\S]*savedCW/.test(String(PAGE_CLASS_MATTE)), true);
  check('F6 the freeze zeroes camera shake (a frozen frame is not a frozen camera)',
    /shake/.test(String(PAGE_FREEZE)), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// IS_MAIN guard — AGENT-BRIEF §3: three tools here ran live work on import.
// ─────────────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) {
  let code = 0;
  if (args.selftest) code = selftest();
  else if (args.conc) code = await modeConc([].concat(args.conc === true ? [] : args.conc, positional).filter((x) => typeof x === 'string'));
  else if (args.tree) code = await modeTree();
  else if (args.drift) code = await modeDrift();
  else code = await modeCensus();
  process.exit(code);
}
