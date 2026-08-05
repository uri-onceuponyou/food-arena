#!/usr/bin/env node
/**
 * VALUE SCAN — "value separation" as a number, at both scales that matter.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * A full blind round landed with every objective metric improved (reachability 79.1%
 * -> 100%, buried limb groups 50 -> 26, envShareInCastBand 0.1906 -> 0.1244, meanSat
 * 0.324 -> 0.4272) and NOT ONE CRITIC SCORE MOVED. Two independent critics, in
 * different words, named the same cause: the cast has no internal VALUE ladder, and
 * the hero has no value separation from the ground it stands on. Un-burying limbs
 * succeeded geometrically and delivered nothing perceptually, because the freed limb
 * is the same value as the thing it was freed from.
 *
 * `docs/LESSONS.md` §3: a loop without a measurable acceptance test defined BEFORE
 * round 1 oscillates instead of converging. This is that acceptance test.
 *
 * ⚠️ And the obvious fix is FALSIFIED IN ADVANCE. A critic prescribed "drop the
 * floor's magenta ~30% in saturation — the floor is the most saturated element in
 * every arena frame". Measured: cast meanSatWithin 0.7652 vs environment 0.4246 — the
 * cast is 1.8x MORE saturated than the environment. That is `docs/LESSONS.md` §8
 * repeating for the fourth time. **The lever is VALUE, and secondarily hue placement.
 * Never saturation.** Nothing in this tool measures saturation as a target.
 *
 * ── What it measures ─────────────────────────────────────────────────────────
 *
 *  1. INTERNAL VALUE LADDER, per character and per part (`--mode chars`).
 *     How many distinct value steps a character presents and how far apart they are,
 *     on the character's OWN exact matte, plus the per-part table and the
 *     contact-gated part-vs-part deltas that answer "does the limb separate from the
 *     torso it is drawn against".
 *
 *  2. HERO-vs-GROUND at shipped framing, all 11 x the arena stations (`--mode dl`).
 *     On the exact matte, not on a salience-grid block. See the note in
 *     `valuelib.mjs`'s `vlFigureGround` for why that distinction is the whole point.
 *
 *  3. REFERENCE CALIBRATION (`--mode ref`). The same ladder metric over the curated
 *     reference plates, resampled to OUR fighter's on-screen pixel height, which is
 *     what makes any threshold defensible instead of invented.
 *
 *  4. `--selftest`: synthetic inputs whose answers are derived BY HAND.
 *     `docs/LESSONS.md` §13 — an instrument that reports a plausible wrong number is
 *     worse than none. Nothing here should be believed until this passes.
 *
 * ── The two-clear-colour matte ───────────────────────────────────────────────
 * Borrowed from `tools/arena-scan.mjs`'s `CAST_MATTE`, not re-invented: hide the
 * environment, render the cast alone on a black clear and on a white clear, and take
 * the pixels identical in both. Colour-independent by construction, which is the whole
 * point — a hide-and-diff loses a character whose colour matches its ground, i.e.
 * exactly the case being measured. Extended here in two ways:
 *   • full drawing-buffer resolution (arena-scan box-downsamples to its 320x180 metric
 *     grid, which is far too coarse for a per-part table)
 *   • PER PART, by FRONTMOST SURFACE: hide one joint group and take the pixels whose
 *     colour changes in the direct render. A first draft used "pixels that leave the
 *     matte" instead; rendered and looked at, that left a large unowned hole through
 *     the middle of every character and read five joints as exactly 0 px, because
 *     hiding a part BACKED by another part of the same character changes no coverage
 *     at all. Plausible, and completely wrong. Attribution coverage is now reported as
 *     `attributionPct` so the same class of error cannot hide again.
 *
 * MASKS come from the direct render (post chain bypassed) because bloom and SMAA are
 * not geometry. VALUES are read from the shipped post-processed frame, because that is
 * what the player sees. Measured: hiding the head changes 41,332 post-processed pixels
 * against a 26,173 px character — a matte taken from post-processed differences would
 * be 58% halo.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/valuescan.mjs --selftest                       # no browser, no server
 *   node tools/tmp/headserve.mjs -- node tools/tmp/valuescan.mjs --mode chars
 *   node tools/tmp/headserve.mjs -- node tools/tmp/valuescan.mjs --mode dl
 *   node tools/tmp/valuescan.mjs --mode ref                       # reads reference/, no server
 *
 * ⚠️ `reference/images/` is gitignored and must NEVER be committed, copied into `src/`
 * or published. `--mode ref` only ever READS a path.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { VL, VL_SRC } from './valuelib.mjs';

// ─────────────────────────────────────────────────────────────────────────────
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const MODE = get('--mode', 'chars');
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const OUT = get('--out', 'shots/vl');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
const LADDER_STATION = get('--station', 'pot_south');
const SS = Number(get('--ss', 2));
const YAWS = get('--yaws', '90,0,45,180').split(',').map(Number);  // 90 = the shipped spawn facing
const SIM_SPEED = get('--sim-speed', '0.02');
const REF_DIRS = get('--ref', 'reference/images/curated/fullbody_fair,reference/images/curated/character_fullbody').split(',');

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Stations: copied verbatim from `tools/arena-scan.mjs` so the two tools' rows line up. */
const MAX_SAFE_RADIUS = 850, GREASE = { x: 560, y: 900 }, WATER = { x: 840, y: 100 };
const STATIONS = [
  { id: 'spawn_west', x: 160, y: 500, fog: MAX_SAFE_RADIUS },
  { id: 'west_lane', x: 340, y: 500, fog: MAX_SAFE_RADIUS },
  { id: 'west_choke', x: 400, y: 500, fog: MAX_SAFE_RADIUS },
  { id: 'pot_south', x: 700, y: 640, fog: MAX_SAFE_RADIUS },
  { id: 'pot_diagonal', x: 570, y: 430, fog: MAX_SAFE_RADIUS },
  { id: 'hub_north', x: 700, y: 320, fog: MAX_SAFE_RADIUS },
  { id: 'freezer_nw', x: 430, y: 240, fog: MAX_SAFE_RADIUS },
  { id: 'pantry_ne', x: 1150, y: 330, fog: MAX_SAFE_RADIUS },
  { id: 'pantry_sw', x: 270, y: 665, fog: MAX_SAFE_RADIUS },
  { id: 'freezer_se', x: 1000, y: 700, fog: MAX_SAFE_RADIUS },
  { id: 'fryer_south', x: 560, y: 790, fog: MAX_SAFE_RADIUS },
  { id: 'edge_west', x: 70, y: 500, fog: MAX_SAFE_RADIUS },
  { id: 'grease_near', x: GREASE.x - 130, y: GREASE.y - 95, fog: MAX_SAFE_RADIUS },
  { id: 'grease_in', x: GREASE.x, y: GREASE.y, fog: MAX_SAFE_RADIUS },
  { id: 'water_near', x: WATER.x + 130, y: WATER.y + 95, fog: MAX_SAFE_RADIUS },
  { id: 'fog_boundary', x: 1090, y: 500, fog: 420 },
  { id: 'fog_inside', x: 1240, y: 500, fog: 420 },
  { id: 'fog_late', x: 700, y: 340, fog: 200 },
];

/** Joint groups, from `src/characters/rig.ts`. Same list `tools/tmp/limbcheck.mjs` uses. */
const JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR',
  'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
const MASS_PARTS = ['face', 'head', 'neck', 'torso', 'hips'];
const LIMB_PARTS = ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

// ─────────────────────────────────────────────────────────────────────────────
// IN-PAGE CAPTURE
//
// One `page.evaluate`. Runs synchronously so no rAF frame of the app's own loop can
// interleave, and it restores every renderer setting it touches in a `finally`.
// ─────────────────────────────────────────────────────────────────────────────
const CAPTURE = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage on this page' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  if (!r || !scene || !cam) return { error: 'Stage missing renderer/scene/rig.camera' };
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  if (!Wp || !Hp) return { error: 'zero-size drawing buffer' };

  // ── cast roots ─────────────────────────────────────────────────────────────
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  if (!casts.length) return { error: 'no `character:*` node in the scene' };

  /** Top-level scene child that contains `o`. */
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };

  /** Read a sub-rect of the default framebuffer, flipped to TOP-DOWN image space. */
  const readRect = (x, yImg, w, h) => {
    const yGL = Hp - (yImg + h);
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(x, yGL, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) {
      out.set(buf.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
    }
    return out;
  };

  // ── the two-clear-colour matte, restricted to a rect ───────────────────────
  const savedBg = scene.background, savedShadow = r.shadowMap.enabled;
  const savedAutoClear = r.autoClear, savedAlpha = r.getClearAlpha();

  let hidden = [];
  const hideEnvironment = (keepTops) => {
    hidden = [];
    for (const kid of scene.children) {
      if (keepTops.has(kid)) continue;
      if (kid.visible) { hidden.push(kid); kid.visible = false; }
    }
  };
  const restoreEnvironment = () => { for (const k of hidden) k.visible = true; hidden = []; };

  /** One direct render (post chain bypassed, shadows off, black clear) over rect. */
  const directRect = (x, y, w, h) => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    return readRect(x, y, w, h);
  };

  /** Matte of whatever is currently visible, over rect. 1 = covered. */
  const matteRect = (x, y, w, h) => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    const A = readRect(x, y, w, h);
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
    const B = readRect(x, y, w, h);
    const m = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < A.length; i += 4, j++) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      m[j] = d < 32 ? 1 : 0;
    }
    return m;
  };

  const result = { buffer: [Wp, Hp] };
  try {
    // ── FACING ─────────────────────────────────────────────────────────────
    // MEASURED: at spawn `__matchDebug` reads facingX 1 / facingY 0 and every cast
    // root sits at `rotation.y = 90deg` — EXACT PROFILE to the camera. That is a real
    // shipped state (the facing a player sees before touching the mouse), but it means
    // the whole far side of the rig is self-occluded, which is why all six right-side
    // joints measure 0 delivered px. Reporting that as "the limbs are buried" without
    // saying "at this facing" would be `docs/LESSONS.md` §13 all over again.
    //
    // So facing becomes a parameter instead of a caveat. Nothing else in the frame
    // moves: the whole capture is one synchronous evaluate, so no rAF of the game's own
    // loop can re-sync the rotation from `MatchState` between setting it and reading
    // the pixels back.
    if (opts.yawDeg != null) {
      for (const c of casts) { c.rotation.y = (opts.yawDeg * Math.PI) / 180; c.updateMatrixWorld(true); }
      result.yawDeg = opts.yawDeg;
    } else {
      result.yawDeg = casts.length ? +((casts[0].rotation.y * 180) / Math.PI).toFixed(1) : null;
      result.yawIsNative = true;
    }
    // 1. THE SHIPPED FRAME, first, before any direct render clobbers it.
    stage.render(0); stage.render(0);
    const fullRGBA = readRect(0, 0, Wp, Hp);

    // 1b. THE SAME FRAME WITH THE POST CHAIN BYPASSED, and NOTHING ELSE changed —
    // scene background, fog, shadows and every object stay exactly as they are, only
    // the composer is skipped. Without this, "the cast has no dark end" cannot be told
    // apart from "bloom and the colour grade are lifting the dark end", and those two
    // have opposite fixes. An albedo pass aimed at a post-chain problem is precisely
    // the mistake `docs/LESSONS.md` §3 warns about: right symptom, wrong mechanism.
    r.setRenderTarget(null);
    r.render(scene, cam);
    const noPostRGBA = readRect(0, 0, Wp, Hp);

    // 2. per-cast matte at full res, to find the player and its bbox.
    const perCast = [];
    for (const c of casts) {
      hideEnvironment(new Set([topOf(c)]));
      // other cast roots inside the same top-level child must go too
      const others = [];
      for (const o of casts) {
        if (o === c) continue;
        if (topOf(o) === topOf(c) && o.visible) { others.push(o); o.visible = false; }
      }
      const m = matteRect(0, 0, Wp, Hp);
      for (const o of others) o.visible = true;
      restoreEnvironment();
      let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let j = 0; j < m.length; j++) {
        if (!m[j]) continue;
        n++; const x = j % Wp, y = (j / Wp) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      perCast.push({ name: c.name, px: n, bbox: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null, obj: c, mask: m });
    }
    result.casts = perCast.map((p) => ({ name: p.name, px: p.px, bbox: p.bbox }));

    // ── PICKING THE PLAYER ─────────────────────────────────────────────────
    // A first version picked the LARGEST on-screen cast root, on the reasoning that the
    // camera is player-centred so the enemy is normally off frame. It is off frame at 15
    // of 18 stations — and at `freezer_se`, `fog_boundary` and `fog_inside` it is not.
    // There it measured the ENEMY for 8 of 11 characters, which showed up as eight
    // IDENTICAL dL values of 0.0537 in a column that should have varied by 0.4. The
    // number was plausible; it was the wrong character.
    //
    // So: match by NAME, which `BaseCharacter` writes as `character:<id>`. When player
    // and enemy are the same id the names collide, and the fallback is geometric —
    // `__vfxDebugFighters` carries both fighters' world-unit positions, so the sign of
    // the projection onto the player-minus-enemy axis identifies the player without
    // needing the world-unit-to-scene scale at all.
    const onScreen = perCast.filter((p) => p.px > 0);
    let player = null;
    result.playerPick = 'none';
    if (opts.playerId) {
      const named = onScreen.filter((p) => p.name === `character:${opts.playerId}`);
      if (named.length === 1) { player = named[0]; result.playerPick = 'name'; }
      else if (named.length > 1) {
        const f = window.__vfxDebugFighters;
        if (f) {
          const ax = f.player.x - f.enemy.x, ay = f.player.y - f.enemy.y;
          const mx = named.reduce((s, p) => s + p.obj.position.x, 0) / named.length;
          const mz = named.reduce((s, p) => s + p.obj.position.z, 0) / named.length;
          let best = -Infinity;
          for (const p of named) {
            const d = (p.obj.position.x - mx) * ax + (p.obj.position.z - mz) * ay;
            if (d > best) { best = d; player = p; }
          }
          result.playerPick = 'geometry';
        }
      }
    }
    if (!player) {
      player = onScreen.sort((x, y) => y.px - x.px)[0];
      if (player) result.playerPick = result.playerPick === 'none' ? 'largest-area (FALLBACK)' : result.playerPick;
    }
    if (!player) return { error: 'the player character has ZERO on-screen pixels', casts: result.casts };
    result.player = player.name;
    result.otherCastPx = perCast.filter((p) => p !== player).reduce((s, p) => s + p.px, 0);

    // 3. crop rect: bbox padded enough to hold the figure/ground ring.
    const [bx, by, bw, bh] = player.bbox;
    const pad = Math.max(12, Math.round(opts.ringFrac * bh) + 6);
    const cx = Math.max(0, bx - pad), cy = Math.max(0, by - pad);
    const cw = Math.min(Wp - cx, bw + pad * 2), chh = Math.min(Hp - cy, bh + pad * 2);
    result.crop = [cx, cy, cw, chh];
    result.cropClamped = (bx - pad < 0) || (by - pad < 0) || (bx + bw + pad > Wp) || (by + bh + pad > Hp);

    // luma + mask over the crop, from the SHIPPED post-processed frame
    const luma = new Float32Array(cw * chh);
    const cropRGB = new Uint8Array(cw * chh * 3);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      const src = ((cy + y) * Wp + (cx + x)) * 4, dst = y * cw + x;
      const R = fullRGBA[src], G = fullRGBA[src + 1], B = fullRGBA[src + 2];
      cropRGB[dst * 3] = R; cropRGB[dst * 3 + 1] = G; cropRGB[dst * 3 + 2] = B;
      luma[dst] = window.VL.luma(R, G, B);
    }
    const maskCrop = new Uint8Array(cw * chh);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      maskCrop[y * cw + x] = player.mask[(cy + y) * Wp + (cx + x)];
    }

    // 4. the numbers
    const lumas = [], lumasNoPost = [];
    for (let j = 0; j < cw * chh; j++) {
      if (!maskCrop[j]) continue;
      lumas.push(luma[j]);
      const y = (j / cw) | 0, x = j % cw;
      const s2 = ((cy + y) * Wp + (cx + x)) * 4;
      lumasNoPost.push(window.VL.luma(noPostRGBA[s2], noPostRGBA[s2 + 1], noPostRGBA[s2 + 2]));
    }
    result.ladder = window.VL.ladder(lumas, {});
    result.ladderNoPost = window.VL.ladder(lumasNoPost, {});
    result.fg = window.VL.figureGround(luma, cw, chh, maskCrop, { ringFrac: opts.ringFrac, edgeR: opts.edgeR });
    result.charHeightPx = bh;
    result.charHeightPctOfFrame = +((bh / Hp) * 100).toFixed(2);

    // 5. PER PART — only when asked; it costs 2 direct renders per joint group.
    if (opts.parts) {
      hideEnvironment(new Set([topOf(player.obj)]));
      const otherCast = [];
      for (const o of casts) {
        if (o === player.obj) continue;
        if (o.visible) { otherCast.push(o); o.visible = false; }
      }
      // ── ownership = FRONTMOST SURFACE, not "load-bearing for coverage" ────────
      // First draft defined a part's pixels as those that LEAVE THE MATTE when the part
      // is hidden. Rendered and looked at (non-negotiable #3), that produced a part map
      // with a large unowned hole through the middle of every character and five joints
      // reading exactly 0 px — because hiding a part that is BACKED by another part of
      // the same character does not change coverage at all, so neither part claimed the
      // pixel. The number was plausible and completely wrong.
      //
      // The frontmost-surface test is the one that answers "what value does this part
      // present": a part owns a pixel when hiding it CHANGES THE COLOUR there. Coverage
      // change is a special case of colour change, so buried limbs still read 0. The
      // only miss is a part sitting exactly in front of an identically-shaded surface,
      // and in that case the attributed value is the same either way.
      const base = matteRect(cx, cy, cw, chh);
      const baseDirect = directRect(cx, cy, cw, chh);
      const allMeshes = [];
      player.obj.traverse((o) => { if (o.isMesh) allMeshes.push(o); });
      const allPrev = allMeshes.map((mm) => mm.visible);
      const groups = [];
      for (const name of opts.jointNames) {
        const j = player.obj.getObjectByName(name);
        if (!j) continue;
        const meshes = [];
        j.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
        if (!meshes.length) continue;
        // Hide DESCENDANT meshes only. Joint groups nest (torso contains shoulderL),
        // so hiding the group object would attribute a child's pixels to its parent.
        const own = meshes.filter((mm) => {
          let n = mm.parent;
          while (n && n !== player.obj) {
            if (n === j) return true;
            if (opts.jointNames.includes(n.name)) return false;  // belongs to a nearer joint
            n = n.parent;
          }
          return false;
        });
        if (!own.length) continue;
        const ownSet = new Set(own);

        // DELIVERED: pixels whose colour changes when this group is hidden, i.e. pixels
        // where this group is the frontmost surface. AND-ed with the matte so an edge
        // pixel that only changed because the background showed through is not counted
        // outside the character.
        const prev = own.map((mm) => mm.visible);
        own.forEach((mm) => { mm.visible = false; });
        const hidDirect = directRect(cx, cy, cw, chh);
        own.forEach((mm, i) => { mm.visible = prev[i]; });
        const owned = new Uint8Array(cw * chh);
        let n = 0;
        for (let k = 0; k < owned.length; k++) {
          if (!base[k]) continue;
          const i4 = k * 4;
          const d = Math.abs(baseDirect[i4] - hidDirect[i4]) +
                    Math.abs(baseDirect[i4 + 1] - hidDirect[i4 + 1]) +
                    Math.abs(baseDirect[i4 + 2] - hidDirect[i4 + 2]);
          if (d > 12) { owned[k] = 1; n++; }
        }

        // FOOTPRINT: the same group rendered ALONE. `delivered / footprint` is exactly
        // `tools/tmp/limbcheck.mjs`'s `ratio`, but measured in the LIVE MATCH at the
        // MATCH camera instead of in `preview.html` at its 22deg default. That is the
        // whole point: limbcheck's pitch is a harness choice, this one is the game.
        allMeshes.forEach((mm, i) => { mm.visible = ownSet.has(mm) && allPrev[i]; });
        const iso = matteRect(cx, cy, cw, chh);
        allMeshes.forEach((mm, i) => { mm.visible = allPrev[i]; });
        let foot = 0;
        for (let k = 0; k < iso.length; k++) if (iso[k]) foot++;

        groups.push({ name, mask: owned, px: n, foot, ratio: foot ? +(n / foot).toFixed(3) : null });
      }
      for (const o of otherCast) o.visible = true;
      restoreEnvironment();

      const names = groups.map((g) => g.name);
      const adj = window.VL.adjacency(groups.map((g) => g.mask), names, cw, chh, luma, opts.minContacts);
      result.parts = names.map((nm, i) => Object.assign(
        { part: nm, foot: groups[i].foot, delivered: groups[i].px, ratio: groups[i].ratio }, adj.stats[i]
      ));
      result.adjacent = adj.pairs;
      // A single owner id per pixel, so the part map can be rendered and LOOKED AT.
      const owner = new Int16Array(cw * chh).fill(-1);
      groups.forEach((g, i) => { for (let k = 0; k < g.mask.length; k++) if (g.mask[k]) owner[k] = i; });
      result.ownerNames = names;
      result.ownerStr = Array.from(owner, (v) => String.fromCharCode(65 + (v < 0 ? -1 + 62 : v))).join('');
      let mattePx = 0, ownedPx = 0;
      for (let k = 0; k < base.length; k++) { if (base[k]) { mattePx++; if (owner[k] >= 0) ownedPx++; } }
      // ATTRIBUTION COVERAGE. If this is not close to 1 the per-part table is not
      // describing the character — LOOK at `<id>.parts.png` before reading any row.
      result.baseMattePx = mattePx;
      result.attributedPx = ownedPx;
      result.attributionPct = +((ownedPx / Math.max(1, mattePx)) * 100).toFixed(1);
    }

    // 6. RGB + mask of the crop, for the overlay images and for the Node-side
    //    masked-downsample cross-check. Base64 so CDP does not choke on an array.
    // CHUNKED. `String.fromCharCode.apply(null, bigArray)` blows the call stack —
    // it spreads every byte as an argument, and a 200x340x3 crop is 200k of them.
    const b64 = (u8) => {
      let s = '';
      for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
      return btoa(s);
    };
    result.cropRGBb64 = b64(cropRGB);
    result.maskb64 = b64(maskCrop);

    // 7. arena-scan's grid dL, so this run can be checked against a RECORDED number.
    {
      const SW = 320, SH = 180;
      const small = new Uint8Array(SW * SH * 3);
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        // box-average, matching sharp's `fit:'fill'` closely enough for a cross-check
        const x0 = Math.floor((x / SW) * Wp), x1 = Math.max(x0 + 1, Math.floor(((x + 1) / SW) * Wp));
        const y0 = Math.floor((y / SH) * Hp), y1 = Math.max(y0 + 1, Math.floor(((y + 1) / SH) * Hp));
        let R = 0, G = 0, B = 0, c = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
          const i = (yy * Wp + xx) * 4; R += fullRGBA[i]; G += fullRGBA[i + 1]; B += fullRGBA[i + 2]; c++;
        }
        const k = (y * SW + x) * 3;
        small[k] = Math.round(R / c); small[k + 1] = Math.round(G / c); small[k + 2] = Math.round(B / c);
      }
      result.gridDL = window.VL.gridDL(small, SW, SH);
    }
  } finally {
    restoreEnvironment();
    scene.background = savedBg;
    r.shadowMap.enabled = savedShadow;
    r.autoClear = savedAutoClear;
    r.setClearColor(0x000000, savedAlpha);
    try { stage.render(0); } catch (e) { /* best effort */ }
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// Node-side helpers
// ─────────────────────────────────────────────────────────────────────────────
const b64ToBytes = (s) => Uint8Array.from(Buffer.from(s, 'base64'));

async function newPage(browser, W, H, dsf) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
  await page.addInitScript({ content: VL_SRC });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
  return page;
}

/** matte overlay + part map, so a human can LOOK at the mask before believing a number. */
async function writeOverlays(res, dir, tag) {
  const [, , cw, ch] = res.crop;
  const rgb = b64ToBytes(res.cropRGBb64);
  const mask = b64ToBytes(res.maskb64);
  await mkdir(dir, { recursive: true });
  const scale = Math.max(1, Math.round(520 / ch));

  const over = Buffer.alloc(cw * ch * 3);
  for (let j = 0; j < cw * ch; j++) {
    const r = rgb[j * 3], g = rgb[j * 3 + 1], b = rgb[j * 3 + 2];
    if (mask[j]) { over[j * 3] = Math.min(255, r * 0.45 + 255 * 0.55); over[j * 3 + 1] = g * 0.45; over[j * 3 + 2] = Math.min(255, b * 0.45 + 220 * 0.55); }
    else { over[j * 3] = r; over[j * 3 + 1] = g; over[j * 3 + 2] = b; }
  }
  await sharp(over, { raw: { width: cw, height: ch, channels: 3 } })
    .resize(cw * scale, ch * scale, { kernel: 'nearest' }).png().toFile(join(dir, `${tag}.matte.png`));

  // value-only view: the character's own luma, remapped to full black->white so a
  // flat blob is unmistakably flat and a real ladder is unmistakably a ladder.
  const val = Buffer.alloc(cw * ch * 3);
  for (let j = 0; j < cw * ch; j++) {
    const L = VL.luma(rgb[j * 3], rgb[j * 3 + 1], rgb[j * 3 + 2]);
    const v = Math.round(Math.max(0, Math.min(1, L)) * 255);
    if (mask[j]) { val[j * 3] = v; val[j * 3 + 1] = v; val[j * 3 + 2] = v; }
    else { val[j * 3] = 20; val[j * 3 + 1] = 0; val[j * 3 + 2] = 30; }
  }
  await sharp(val, { raw: { width: cw, height: ch, channels: 3 } })
    .resize(cw * scale, ch * scale, { kernel: 'nearest' }).png().toFile(join(dir, `${tag}.value.png`));

  if (res.ownerStr) {
    const PAL = [[255, 80, 80], [80, 255, 120], [90, 150, 255], [255, 220, 60], [255, 120, 255],
      [80, 230, 230], [255, 160, 40], [160, 100, 255], [120, 255, 60], [255, 60, 160],
      [60, 200, 160], [200, 200, 200], [140, 90, 40], [40, 90, 140], [240, 140, 140],
      [90, 240, 200], [200, 90, 240]];
    const pm = Buffer.alloc(cw * ch * 3);
    for (let j = 0; j < cw * ch; j++) {
      const code = res.ownerStr.charCodeAt(j) - 65;
      if (code === 61) { pm[j * 3] = 24; pm[j * 3 + 1] = 24; pm[j * 3 + 2] = 30; continue; }
      const c = PAL[code % PAL.length];
      pm[j * 3] = c[0]; pm[j * 3 + 1] = c[1]; pm[j * 3 + 2] = c[2];
    }
    await sharp(pm, { raw: { width: cw, height: ch, channels: 3 } })
      .resize(cw * scale, ch * scale, { kernel: 'nearest' }).png().toFile(join(dir, `${tag}.parts.png`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: chars — internal value ladder, per character and per part
// ─────────────────────────────────────────────────────────────────────────────
async function modeChars() {
  if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
  const st = STATIONS.find((s) => s.id === LADDER_STATION);
  if (!st) { console.error(`no station ${LADDER_STATION}`); process.exit(2); }
  const dir = join(OUT, 'chars');
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = {};
  try {
    for (const id of IDS) {
      out[id] = {};
      for (const [tag, dsf, parts] of [['shipped', 1, false], ['ss', SS, true]]) {
        const page = await newPage(browser, 1600, 900, dsf);
        try {
          const url = `${BASE}/?player=${id}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
          await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
          await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
          await page.waitForTimeout(900);
          // yaw 90 (the shipped spawn facing) plus any extra yaws asked for, on the
          // SAME page load — a second page would re-boot SwiftShader for nothing.
          const yaws = tag === 'ss' ? YAWS : [null];
          let res = null;
          for (const yawDeg of yaws) {
            const r = await page.evaluate(CAPTURE, {
              ringFrac: 0.30, edgeR: dsf === 1 ? 4 : 4 * dsf, parts, yawDeg, playerId: id,
              jointNames: JOINTS, minContacts: dsf === 1 ? 8 : 8 * dsf,
            });
            if (r.error) { console.error(`✗ ${id} ${tag} yaw${yawDeg}: ${r.error}`); continue; }
            const suffix = yawDeg == null ? '' : `.yaw${yawDeg}`;
            await writeOverlays(r, dir, `${id}.${tag}${suffix}`);
            const { cropRGBb64, maskb64, ownerStr, ...c } = r;
            if (yawDeg == null || yawDeg === yaws[0]) { res = r; out[id][tag] = c; }
            else (out[id].yaws ??= {})[yawDeg] = c;
            if (yawDeg != null && yawDeg !== yaws[0]) {
              const buried = c.parts.filter((p) => p.delivered === 0).length;
              console.log(`${' '.repeat(12)} yaw ${String(yawDeg).padStart(3)}: range ${c.ladder.range.toFixed(3)} steps@10 ${c.ladder.steps.j10}  buried joints ${buried}/${c.parts.length}  attrib ${c.attributionPct}%`);
            }
          }
          if (!res) { out[id][tag] = { error: 'every yaw failed' }; continue; }
          if (tag === 'shipped') {
            console.log(`${id.padEnd(12)} h ${String(res.charHeightPx).padStart(3)}px (${res.charHeightPctOfFrame}%)  ` +
              `range ${res.ladder.range.toFixed(3)}  steps@10 ${res.ladder.steps.j10}  ` +
              `p05/50/95 ${res.ladder.p05.toFixed(2)}/${res.ladder.p50.toFixed(2)}/${res.ladder.p95.toFixed(2)}  ` +
              `dL ${String(res.fg.dL).padStart(7)}  dLedge ${String(res.fg.dLedge).padStart(7)}  gridDL ${res.gridDL.deltaLuma}`);
          } else {
            const buried0 = res.parts.filter((p) => p.delivered === 0).length;
            const worst = (res.adjacent || []).slice(0, 3).map((p) => `${p.a}|${p.b} ${p.dL.toFixed(3)}`).join('  ');
            console.log(`${' '.repeat(12)} ss${SS}: range ${res.ladder.range.toFixed(3)} steps@10 ${res.ladder.steps.j10}  ` +
              `yaw ${res.yawDeg}: parts ${res.parts.length} buried ${buried0} attrib ${res.attributionPct}%  tightest contacts: ${worst}`);
          }
        } catch (e) {
          console.error(`✗ ${id} ${tag}: ${e}`);
          out[id][tag] = { error: String(e) };
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(OUT, 'chars.json'), JSON.stringify(out, null, 2));
  console.log(`\nwrote ${OUT}/chars.json and ${dir}/*.{matte,value,parts}.png`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: dl — hero-vs-ground, every character x every station
// ─────────────────────────────────────────────────────────────────────────────
async function modeDl() {
  if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
  const only = get('--only', null);
  const jobs = only ? STATIONS.filter((s) => only.split(',').includes(s.id)) : STATIONS;
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    for (const id of IDS) {
      for (const st of jobs) {
        const page = await newPage(browser, 1600, 900, 1);
        try {
          const url = `${BASE}/?player=${id}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
          await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
          await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
          await page.waitForTimeout(700);
          const res = await page.evaluate(CAPTURE, { ringFrac: 0.30, edgeR: 4, parts: false, jointNames: JOINTS, minContacts: 8, playerId: id });
          if (res.error) { rows.push({ id, station: st.id, error: res.error }); console.error(`✗ ${id}/${st.id}: ${res.error}`); continue; }
          rows.push({
            id, station: st.id,
            hPx: res.charHeightPx, figurePx: res.fg.figurePx, otherCastPx: res.otherCastPx,
            player: res.player, playerPick: res.playerPick,
            figureLuma: res.fg.figureLuma, groundLuma: res.fg.groundLuma,
            dL: res.fg.dL, dLmedian: res.fg.dLmedian, dLedge: res.fg.dLedge,
            gridDL: res.gridDL.deltaLuma, gridPlayerLuma: res.gridDL.playerLuma, gridRingLuma: res.gridDL.ringLuma,
            ladderRange: res.ladder.range, ladderSteps10: res.ladder.steps.j10, ladderP50: res.ladder.p50,
          });
          const r = rows[rows.length - 1];
          console.log(`${id.padEnd(12)} ${st.id.padEnd(13)} dL ${String(r.dL).padStart(7)}  |dL| ${Math.abs(r.dL).toFixed(3)}  ` +
            `dLedge ${String(r.dLedge).padStart(7)}  fig ${r.figureLuma} grd ${r.groundLuma}  gridDL ${String(r.gridDL).padStart(6)}`);
        } catch (e) {
          rows.push({ id, station: st.id, error: String(e) });
          console.error(`✗ ${id}/${st.id}: ${e}`);
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(OUT, 'dl.json'), JSON.stringify({ rows }, null, 2));
  console.log(`\nwrote ${OUT}/dl.json  (${rows.filter((r) => !r.error).length} ok, ${rows.filter((r) => r.error).length} failed)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: ref — the reference plates, on the same metric
// ─────────────────────────────────────────────────────────────────────────────
async function modeRef() {
  const targetH = Number(get('--targetH', 136));   // our fighter's measured on-screen height
  const dir = join(OUT, 'ref');
  await mkdir(dir, { recursive: true });
  const rows = [];
  for (const rd of REF_DIRS) {
    if (!existsSync(rd)) { console.error(`skip ${rd} — not present (reference/ is gitignored)`); continue; }
    const files = readdirSync(rd).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
    for (const f of files) {
      // Worked at a fixed 700px width: the plates run 940-1700px wide, the flood is
      // O(px), and the SHIPPED-SCALE ladder — the number that actually calibrates a
      // threshold — is a 5-8x further reduction from here regardless. Stated because a
      // resolution chosen for speed must never be quietly presented as "native".
      const WORK_W = Number(get('--workW', 700));
      const { data, info } = await sharp(join(rd, f)).resize(WORK_W, null).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height;
      const seg = VL.segmentAuto(data, W, H, {});
      const bb = VL.bbox(seg.mask, W, H);
      if (!bb) { rows.push({ dir: rd, file: f, error: 'segmentation found nothing' }); continue; }
      const coverage = +((bb.n / (W * H)) * 100).toFixed(2);

      // NATIVE-resolution ladder
      const luma = new Float32Array(W * H);
      for (let j = 0; j < W * H; j++) luma[j] = VL.luma(data[j * 3], data[j * 3 + 1], data[j * 3 + 2]);
      const nat = [];
      for (let j = 0; j < W * H; j++) if (seg.mask[j]) nat.push(luma[j]);
      const ladderNative = VL.ladder(nat, {});

      // SHIPPED-SCALE ladder: masked box-downsample so the subject is `targetH` px tall,
      // which is what OUR fighter measures on screen. Comparing a 1800px reference
      // character to a 136px fighter would measure resolution, not art.
      const scale = targetH / bb.h;
      const dw = Math.max(1, Math.round(W * scale)), dh = Math.max(1, Math.round(H * scale));
      const ds = VL.maskedDownsample(data, seg.mask, W, H, dw, dh);
      const dl = [];
      for (let j = 0; j < dw * dh; j++) if (ds.mask[j]) dl.push(VL.luma(ds.rgb[j * 3], ds.rgb[j * 3 + 1], ds.rgb[j * 3 + 2]));
      const ladderShipped = VL.ladder(dl, {});

      rows.push({
        dir: rd, file: f, size: [W, H], subjectBBox: [bb.x0, bb.y0, bb.w, bb.h],
        subjectPx: bb.n, coveragePct: coverage, components: seg.components, tol: seg.tol, areaCurve: seg.areas,
        native: ladderNative, shipped: ladderShipped, shippedH: Math.round(bb.h * scale),
      });
      console.log(`${(rd.split('/').pop() + '/' + f).padEnd(30)} subj ${bb.w}x${bb.h} (${coverage}% of plate, tol ${seg.tol})  ` +
        `native range ${ladderNative.range.toFixed(3)} steps@10 ${ladderNative.steps.j10}  |  ` +
        `@${targetH}px range ${ladderShipped.range.toFixed(3)} steps@10 ${ladderShipped.steps.j10} ` +
        `p05/50/95 ${ladderShipped.p05.toFixed(2)}/${ladderShipped.p50.toFixed(2)}/${ladderShipped.p95.toFixed(2)}`);

      // overlay so the segmentation can be LOOKED AT
      const ov = Buffer.alloc(W * H * 3);
      for (let j = 0; j < W * H; j++) {
        const r = data[j * 3], g = data[j * 3 + 1], b = data[j * 3 + 2];
        if (seg.mask[j]) { ov[j * 3] = Math.min(255, r * 0.4 + 255 * 0.6); ov[j * 3 + 1] = g * 0.4; ov[j * 3 + 2] = Math.min(255, b * 0.4 + 200 * 0.6); }
        else { ov[j * 3] = r * 0.75; ov[j * 3 + 1] = g * 0.75; ov[j * 3 + 2] = b * 0.75; }
      }
      await sharp(ov, { raw: { width: W, height: H, channels: 3 } })
        .resize(360, Math.round((360 * H) / W)).png().toFile(join(dir, `${rd.split('/').pop()}_${f.replace(/\.\w+$/, '')}.matte.png`));
      // and the value-only view at shipped scale
      const vv = Buffer.alloc(dw * dh * 3);
      for (let j = 0; j < dw * dh; j++) {
        if (!ds.mask[j]) { vv[j * 3] = 20; vv[j * 3 + 1] = 0; vv[j * 3 + 2] = 30; continue; }
        const v = Math.round(VL.luma(ds.rgb[j * 3], ds.rgb[j * 3 + 1], ds.rgb[j * 3 + 2]) * 255);
        vv[j * 3] = v; vv[j * 3 + 1] = v; vv[j * 3 + 2] = v;
      }
      await sharp(vv, { raw: { width: dw, height: dh, channels: 3 } })
        .resize(dw * 3, dh * 3, { kernel: 'nearest' }).png()
        .toFile(join(dir, `${rd.split('/').pop()}_${f.replace(/\.\w+$/, '')}.value.png`));
    }
  }
  await writeFile(join(OUT, 'ref.json'), JSON.stringify({ targetH, rows }, null, 2));
  const ok = rows.filter((r) => !r.error);
  const m = (f) => +(ok.reduce((s, r) => s + f(r), 0) / Math.max(1, ok.length)).toFixed(4);
  console.log(`\nMEAN over ${ok.length} plates:  native range ${m((r) => r.native.range)}  ` +
    `@${targetH}px range ${m((r) => r.shipped.range)}  steps@10 ${m((r) => r.shipped.steps.j10)}  ` +
    `steps@05 ${m((r) => r.shipped.steps.j5)}  steps@15 ${m((r) => r.shipped.steps.j15)}`);
  console.log(`wrote ${OUT}/ref.json and ${dir}/*.matte.png — LOOK AT THE MATTES before believing any of it.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --selftest — every quantity against a value derived BY HAND
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want, eps) => {
    const ok = typeof want === 'number' ? (got != null && Math.abs(got - want) <= (eps ?? 1e-6)) : JSON.stringify(got) === JSON.stringify(want);
    if (ok) { pass++; console.log(`  ✓ ${name.padEnd(60)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${name.padEnd(60)} got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`); }
  };
  const rep = (v, n) => new Array(n).fill(v);

  console.log('\nSELFTEST — synthetic inputs whose answers are derived by hand\n');

  console.log('A. THE LADDER responds to a ladder and not to anything else');
  // 1. FLAT: one value everywhere. A single mid-value blob must score ~0 and 1 step.
  let L = VL.ladder(rep(0.5, 1000), {});
  check('flat 0.5: range', L.range, 0);
  check('flat 0.5: steps@0.10', L.steps.j10, 1);
  check('flat 0.5: steps@0.05', L.steps.j5, 1);
  check('flat 0.5: p05==p50==p95', [L.p05, L.p50, L.p95], [0.5, 0.5, 0.5]);
  check('flat 0.5: sd', L.sd, 0);

  // 2. TWO-TONE 50/50 at 0.3 and 0.7. By hand: P05 = 0.3, P95 = 0.7, range 0.40; the
  //    20 quantile samples are ten 0.3s then ten 0.7s, one jump of 0.40 => 2 steps.
  L = VL.ladder([...rep(0.3, 500), ...rep(0.7, 500)], {});
  check('two-tone 0.3/0.7: range', L.range, 0.40, 1e-6);
  check('two-tone 0.3/0.7: steps@0.10', L.steps.j10, 2);
  check('two-tone 0.3/0.7: steps@0.15', L.steps.j15, 2);
  check('two-tone 0.3/0.7: step values', L.stepValues.j10, [0.3, 0.7]);

  // 3. THE REFERENCE SHAPE: near-black jacket -> mid skin -> near-white shirt, equal
  //    thirds. By hand: range = P95 - P05 = 0.95 - 0.05 = 0.90, three plateaus.
  L = VL.ladder([...rep(0.05, 333), ...rep(0.50, 333), ...rep(0.95, 334)], {});
  check('three-tone 0.05/0.50/0.95: range', L.range, 0.90, 1e-6);
  check('three-tone: steps@0.10', L.steps.j10, 3);
  check('three-tone: steps@0.15', L.steps.j15, 3);
  check('three-tone: step values', L.stepValues.j10, [0.05, 0.5, 0.95]);

  // 4. A BLOB WITH A SPECULAR PIP. 99% at 0.5, 1% at 1.0. The pip must NOT manufacture
  //    a ladder: it is under the 5%-per-sample mass gate and outside P95.
  L = VL.ladder([...rep(0.5, 990), ...rep(1.0, 10)], {});
  check('99% flat + 1% specular: range', L.range, 0, 1e-9);
  check('99% flat + 1% specular: steps@0.10', L.steps.j10, 1);
  check('99% flat + 1% specular: max still sees it', L.max, 1.0);

  // 5. BOUNDARY, from both sides. A 0.10 step is a step at J=0.10 (>=) and is not at 0.11.
  L = VL.ladder([...rep(0.45, 500), ...rep(0.55, 500)], { jnds: [0.10, 0.11] });
  check('exactly-0.10 step counts at J=0.10', L.steps.j10, 2);
  check('exactly-0.10 step does NOT count at J=0.11', L.steps.j11, 1);

  // 6. A SMOOTH RAMP 0..1 is not a plateau ladder but does carry value range; both are
  //    reported so a ramp can never be mistaken for a ladder by range alone.
  L = VL.ladder(Array.from({ length: 1000 }, (_, i) => i / 999), {});
  check('ramp 0..1: range ~0.90', L.range, 0.90, 0.005);
  check('ramp 0..1: steps@0.10 ~10', L.steps.j10, 10, 0.001);

  // 7. THE PROJECT'S OWN ANCHOR. waterbottle was authored at shell 0.893 / limb 0.625 /
  //    deep 0.481 / cap 0.407 / boot 0.268 — a span of 0.625 the legs pass calls
  //    "adequate". Equal area each: P05 lands in the boot band, P95 in the shell band.
  L = VL.ladder([...rep(0.893, 200), ...rep(0.625, 200), ...rep(0.481, 200), ...rep(0.407, 200), ...rep(0.268, 200)], {});
  check('waterbottle 5-band albedo: range', L.range, 0.625, 0.001);
  check('waterbottle 5-band albedo: steps@0.10', L.steps.j10, 4);
  check('waterbottle 5-band albedo: steps@0.05', L.steps.j5, 5);

  console.log('\nB. HERO vs GROUND on an exact matte');
  // An 8x8 light square at 0.7 centred in a 40x40 field at 0.3. dL must be +0.40
  // exactly; inverted, -0.40; identical, 0.
  const fg = (figL, grdL) => {
    const W = 40, H = 40;
    const mask = new Uint8Array(W * H), luma = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const inFig = x >= 16 && x < 24 && y >= 16 && y < 24;
      mask[y * W + x] = inFig ? 1 : 0;
      luma[y * W + x] = inFig ? figL : grdL;
    }
    return VL.figureGround(luma, W, H, mask, { ringFrac: 0.30, edgeR: 2 });
  };
  let F = fg(0.7, 0.3);
  check('figure 0.7 on ground 0.3: dL', F.dL, 0.40, 1e-4);
  check('figure 0.7 on ground 0.3: dLedge', F.dLedge, 0.40, 1e-4);
  check('figure 0.7 on ground 0.3: figurePx (8x8)', F.figurePx, 64);
  check('figure 0.7 on ground 0.3: bbox', F.bbox, [16, 16, 8, 8]);
  check('ring radius = round(0.30 * bboxH) floored at 4', F.ringR, 4);
  check('figure 0.3 on ground 0.7: dL is NEGATIVE', fg(0.3, 0.7).dL, -0.40, 1e-4);
  check('figure 0.5 on ground 0.5: dL is exactly 0', fg(0.5, 0.5).dL, 0, 1e-9);
  // The ring must EXCLUDE the figure, and be exactly the right SIZE — a ring computed
  // with the wrong connectivity or an off-by-one would still produce plausible dL.
  //
  // Derived, not guessed. The set within 4-connected (Manhattan) distance d of a w x h
  // rectangle is its Minkowski sum with a diamond of radius d:
  //     area = w*h + 2d(w + h) + 2d(d - 1)
  // Checked against two cases small enough to enumerate: a 1x1 pixel with d=1 gives
  // 1 + 4 + 0 = 5 (the pixel and its four neighbours) and with d=3 gives 1 + 12 + 12 =
  // 25, which is the diamond number 2d^2 + 2d + 1 = 25. For w=h=8, d=4:
  //     64 + 2*4*16 + 2*4*3 = 64 + 128 + 24 = 216, minus the 64-px figure = 152.
  //
  // (This assertion originally read 144 — my arithmetic, not the tool's. The tool was
  //  right. Recorded because "the instrument disagreed with me so the instrument is
  //  wrong" is the failure mode a selftest exists to prevent.)
  {
    const W = 40, H = 40;
    const mask = new Uint8Array(W * H);
    for (let y = 16; y < 24; y++) for (let x = 16; x < 24; x++) mask[y * W + x] = 1;
    const d = VL.distanceField(mask, W, H, 6);
    let overlap = 0, ring = 0;
    for (let j = 0; j < W * H; j++) { if (d[j] === 0 && !mask[j]) overlap++; if (!mask[j] && d[j] <= 4) ring++; }
    check('no non-figure pixel has distance 0', overlap, 0);
    check('4-connected ring at r=4 around 8x8 = 216 - 64', ring, 152);
    // and the formula itself, at a second size, so the ring cannot drift silently
    const mask2 = new Uint8Array(W * H);
    for (let y = 14; y < 26; y++) for (let x = 18; x < 22; x++) mask2[y * W + x] = 1;  // 4x12
    const d2 = VL.distanceField(mask2, W, H, 5);
    let ring2 = 0;
    for (let j = 0; j < W * H; j++) if (!mask2[j] && d2[j] <= 3) ring2++;
    check('4x12 rect, r=3: 48 + 2*3*16 + 2*3*2 = 156, minus 48', ring2, 108);
  }

  console.log('\nC. the grid dL this replaces — reproduced, so the two can be compared');
  // arena-scan's dL over a synthetic 320x180 frame: player block (cols 7-9, rows 4-5)
  // filled at luma 0.8, everything else 0.2. Player block mean 0.8, ring mean 0.2,
  // so deltaLuma must be exactly 0.6.
  {
    const W = 320, H = 180, d = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cx = Math.floor(x / 20), cy = Math.floor(y / 20);
      const inP = cx >= 7 && cx <= 9 && cy >= 4 && cy <= 5;
      const v = inP ? 214 : 60;    // luma(214,214,214)=0.839, luma(60,60,60)=0.235
      const k = (y * W + x) * 3; d[k] = v; d[k + 1] = v; d[k + 2] = v;
    }
    const g = VL.gridDL(d, W, H);
    check('gridDL playerLuma (flat 214)', g.playerLuma, 0.839, 0.001);
    check('gridDL ringLuma (flat 60)', g.ringLuma, 0.235, 0.001);
    check('gridDL delta', g.deltaLuma, 0.604, 0.002);
  }
  // AND the dilution this metric suffers, stated as a number: a 15x27 subject inside
  // the 60x40 player block is 405/2400 = 16.9% of it, so a real +0.40 hero/ground step
  // registers as ~+0.07 on the grid. That is why the matte form exists.
  {
    const W = 320, H = 180, d = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const inSub = x >= 152 && x < 167 && y >= 89 && y < 116;   // 15x27, inside the block
      const v = inSub ? 190 : 100;
      const k = (y * W + x) * 3; d[k] = v; d[k + 1] = v; d[k + 2] = v;
    }
    const g = VL.gridDL(d, W, H);
    const trueStep = VL.luma(190, 190, 190) - VL.luma(100, 100, 100);
    check('a real hero/ground step of this size', +trueStep.toFixed(3), 0.353, 0.002);
    check('...registers on the GRID as only', g.deltaLuma, 0.06, 0.012);
  }

  console.log('\nD. per-part attribution and the contact-gated delta');
  // Two touching 10x10 squares. Same value -> 0. 0.4 apart -> 0.4. Not touching -> the
  // pair is not reported at all, because "the hand matches the foot" is irrelevant.
  const pairTest = (lumaA, lumaB, gap) => {
    const W = 60, H = 30;
    const A = new Uint8Array(W * H), B = new Uint8Array(W * H), luma = new Float32Array(W * H).fill(0.5);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) { A[y * W + x] = 1; luma[y * W + x] = lumaA; }
    for (let y = 10; y < 20; y++) for (let x = 20 + gap; x < 30 + gap; x++) { B[y * W + x] = 1; luma[y * W + x] = lumaB; }
    return VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8);
  };
  check('touching parts, same value: dL 0', pairTest(0.5, 0.5, 0).pairs[0].dL, 0);
  check('touching parts, 0.4 apart: dL 0.4', pairTest(0.3, 0.7, 0).pairs[0].dL, 0.4, 1e-4);
  check('touching parts: contact count is the shared edge (10)', pairTest(0.3, 0.7, 0).pairs[0].contacts, 10);
  check('NON-touching parts are not reported', pairTest(0.3, 0.7, 5).pairs.length, 0);
  check('part median is taken over owned pixels only', pairTest(0.3, 0.7, 0).stats[0].p50, 0.3, 1e-4);

  console.log('\nE. shipped-framing invariance — the LESSONS §6 check');
  // A 2-tone subject at high resolution keeps its ladder when box-downsampled to 136px.
  // A 1px checkerboard of the same two values LOSES it entirely — which is the honest
  // answer, and the reason the reference is re-measured at our fighter's pixel height
  // instead of at its own.
  {
    const W = 400, H = 800;
    const rgbA = new Uint8Array(W * H * 3), rgbB = new Uint8Array(W * H * 3);
    const mask = new Uint8Array(W * H).fill(1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = y * W + x;
      const vA = y < H / 2 ? 26 : 230;                 // top half dark, bottom half light
      const vB = ((x + y) % 2) ? 26 : 230;             // 1px checker, same two values
      rgbA[j * 3] = vA; rgbA[j * 3 + 1] = vA; rgbA[j * 3 + 2] = vA;
      rgbB[j * 3] = vB; rgbB[j * 3 + 1] = vB; rgbB[j * 3 + 2] = vB;
    }
    const lad = (rgb) => {
      const ds = VL.maskedDownsample(rgb, mask, W, H, Math.round(400 * 136 / 800), 136);
      const out = [];
      for (let j = 0; j < ds.w * ds.h; j++) if (ds.mask[j]) out.push(VL.luma(ds.rgb[j * 3], ds.rgb[j * 3 + 1], ds.rgb[j * 3 + 2]));
      return VL.ladder(out, {});
    };
    const nativeRange = +(VL.luma(230, 230, 230) - VL.luma(26, 26, 26)).toFixed(4);
    check('two-tone native range', nativeRange, 0.800, 0.002);
    check('two-tone SURVIVES downsample to 136px', lad(rgbA).range, 0.800, 0.01);
    check('two-tone still 2 steps at 136px', lad(rgbA).steps.j10, 2);
    check('1px checker COLLAPSES to ~0 at 136px', lad(rgbB).range, 0, 0.02);
    check('1px checker is 1 step at 136px', lad(rgbB).steps.j10, 1);
    // masked downsample must not drag background in: outside the mask contributes nothing
    const mask2 = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 100; x < 300; x++) mask2[y * W + x] = 1;
    const rgbC = new Uint8Array(W * H * 3);
    for (let j = 0; j < W * H; j++) { const v = mask2[j] ? 200 : 0; rgbC[j * 3] = v; rgbC[j * 3 + 1] = v; rgbC[j * 3 + 2] = v; }
    const ds = VL.maskedDownsample(rgbC, mask2, W, H, 68, 136);
    let minV = 255;
    for (let j = 0; j < 68 * 136; j++) if (ds.mask[j]) minV = Math.min(minV, ds.rgb[j * 3]);
    check('masked downsample never averages in the background', minV, 200);
  }

  console.log('\nF. reference-plate segmentation, on a plate whose answer is known');
  {
    // A 200x300 "plate": a smooth blue gradient backdrop with a 60x180 subject on it.
    // Segmentation must return exactly 60*180 = 10800 px and nothing else.
    const W = 200, H = 300, rgb = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3;
      const inSubj = x >= 70 && x < 130 && y >= 60 && y < 240;
      if (inSubj) { rgb[j] = 240; rgb[j + 1] = 190; rgb[j + 2] = 60; }
      else { rgb[j] = 20 + Math.round((y / H) * 60); rgb[j + 1] = 60 + Math.round((y / H) * 60); rgb[j + 2] = 180; }
    }
    const seg = VL.segmentBorderFlood(rgb, W, H, 26);
    let n = 0; for (let j = 0; j < W * H; j++) n += seg.mask[j];
    check('flood-fill finds exactly the subject', n, 10800);
    const bb = VL.bbox(seg.mask, W, H);
    check('...and its bbox', [bb.x0, bb.y0, bb.w, bb.h], [70, 60, 60, 180]);
    // A HOLE inside the subject (an eye the same colour as the backdrop) must be kept,
    // because a hole is part of the character's own value distribution, not background.
    for (let y = 100; y < 120; y++) for (let x = 90; x < 110; x++) {
      const j = (y * W + x) * 3; rgb[j] = 20; rgb[j + 1] = 60; rgb[j + 2] = 180;
    }
    const seg2 = VL.segmentBorderFlood(rgb, W, H, 26);
    let n2 = 0; for (let j = 0; j < W * H; j++) n2 += seg2.mask[j];
    check('an enclosed hole is filled, not lost', n2, 10800);
  }

  console.log('\nG. luma is the recorded formula, not a re-derivation');
  check('luma(255,255,255)', +VL.luma(255, 255, 255).toFixed(6), 1);
  check('luma(0,0,0)', VL.luma(0, 0, 0), 0);
  check('luma(255,0,0) = 0.2126', +VL.luma(255, 0, 0).toFixed(4), 0.2126, 1e-4);
  check('luma(0,255,0) = 0.7152', +VL.luma(0, 255, 0).toFixed(4), 0.7152, 1e-4);
  check('luma(0,0,255) = 0.0722', +VL.luma(0, 0, 255).toFixed(4), 0.0722, 1e-4);

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: gate — THE ACCEPTANCE TEST, defined before round 1
//
// `docs/LESSONS.md` §3: "Without one, loops oscillate instead of converging." Every
// threshold below is a MEASURED PERCENTILE of the reference plates, not a chosen
// number, and the one exception says so out loud.
//
// Reference basis: 27 measurements over three independent crop sets
// (`fullbody_fair`, `character_fullbody`, `character`), each subject segmented, then
// masked-box-downsampled to 136 px tall — the height OUR fighter measures on screen at
// shipped 1600x900 framing. Comparing a 1,900 px marketing render to a 130 px fighter
// would have measured resolution, not art (`docs/LESSONS.md` §6).
//
//   quantity        reference (all 27)                  Brawl Stars only (n=18)
//   range           min .473  p25 .641  median .829     min .636  mean .830
//   steps @ 0.10    min 5     p25 6     median 7        median 7
//   p05             median .097  p75 .131  max .318     max .180  median .070
//   p95             median .896                         —
// ─────────────────────────────────────────────────────────────────────────────
const GATES = [
  { key: 'range', label: 'value range P95-P05', min: 0.636, target: 0.830,
    why: 'the WEAKEST of 18 Brawl Stars plates measures 0.636; their mean is 0.830' },
  { key: 'p05', label: 'dark anchor (P05)', max: 0.180, target: 0.100,
    why: 'every one of 18 Brawl Stars plates puts 5% of the character below 0.18; their median is 0.07' },
  { key: 'steps10', label: 'value steps >= 0.10 apart', min: 6, target: 7,
    why: 'reference p25 = 6, median = 7, min = 5' },
  // COUNT of failing stations, not the worst one. Gating on the minimum made 9 of 11
  // characters FAIL on a single station — `grease_in`, where the fighter stands on a
  // bright grease puddle — and a character gate that is really an arena fact would send
  // eleven agents to repaint eleven characters for one puddle. One allowed failure keeps
  // the gate sensitive to a character that is genuinely weak everywhere (hotdog: 3 of 18)
  // while attributing a shared hostile station to the station.
  { key: 'dlBelow10', label: 'stations with dL < 0.10 (of 18)', max: 1, target: 0,
    why: "this project's own recorded lighting standard: figure/ground >= 0.10, |dL| < 0.05 = none. NOT a reference figure — said out loud. One station is allowed because `grease_in` fails for 9 of 11 and is an ARENA fix." },
  { key: 'weakBoundaryPct', label: 'part boundary below 0.10 dL', max: 15, target: 5,
    why: 'CHOSEN, not measured — no reference equivalent exists because the plates cannot be part-segmented. Calibrated off the cast: soup already reads 5.1%.' },
];

async function modeGate() {
  const chars = JSON.parse(await readFile(join(OUT, 'chars.json'), 'utf8'));
  const dl = JSON.parse(await readFile(join(OUT, 'dl.json'), 'utf8')).rows;
  console.log('\nACCEPTANCE TEST — value separation\n');
  for (const g of GATES) {
    console.log(`  ${g.label.padEnd(34)} ${g.min != null ? '>= ' + g.min : '<= ' + g.max}  (target ${g.target})`);
    console.log(`  ${' '.repeat(34)} ${g.why}`);
  }
  console.log('\nchar          range   p05  steps  minDL  n<.10  weakB%  worstStn        verdict');
  let failing = 0;
  const out = [];
  for (const id of IDS) {
    const c = chars[id];
    if (!c || !c.shipped || c.shipped.error) { console.log(`${id.padEnd(13)} NO DATA`); failing++; continue; }
    const L = c.shipped.ladder;
    const my = dl.filter((r) => r.id === id && !r.error);
    const minDL = my.length ? Math.min(...my.map((r) => r.dL)) : null;
    const A = (c.ss && c.ss.adjacent) || [];
    const tot = A.reduce((s, p) => s + p.contacts, 0);
    const weakPct = tot ? (100 * A.filter((p) => p.dL < 0.10).reduce((s, p) => s + p.contacts, 0)) / tot : 0;
    const dlBelow10 = my.filter((r) => r.dL < 0.10).length;
    const worstStation = my.length ? my.reduce((a, b) => (a.dL <= b.dL ? a : b)).station : null;
    const v = { range: L.range, p05: L.p05, steps10: L.steps.j10, minDL, dlBelow10, weakBoundaryPct: +weakPct.toFixed(1) };
    const fails = GATES.filter((g) => {
      const x = v[g.key];
      if (x == null) return true;
      return g.min != null ? x < g.min : x > g.max;
    }).map((g) => g.key);
    if (fails.length) failing++;
    out.push({ id, ...v, worstStation, fails });
    console.log(`${id.padEnd(13)}${v.range.toFixed(3).padStart(6)}${v.p05.toFixed(3).padStart(6)}${String(v.steps10).padStart(7)}` +
      `${(minDL == null ? '  —' : minDL.toFixed(3)).padStart(7)}${String(dlBelow10).padStart(7)}` +
      `${v.weakBoundaryPct.toFixed(1).padStart(8)}  ${String(worstStation).padEnd(13)} ` +
      (fails.length ? `FAIL: ${fails.join(', ')}` : 'PASS'));
  }
  await writeFile(join(OUT, 'gate.json'), JSON.stringify({ gates: GATES, rows: out }, null, 2));
  console.log(`\n${IDS.length - failing}/${IDS.length} pass · wrote ${OUT}/gate.json`);
  return failing ? 1 : 0;
}

if (has('--selftest')) process.exit(selftest());
else if (MODE === 'chars') await modeChars();
else if (MODE === 'dl') await modeDl();
else if (MODE === 'ref') await modeRef();
else if (MODE === 'gate') process.exit(await modeGate());
else { console.error(`unknown --mode ${MODE}`); process.exit(2); }
