#!/usr/bin/env node
/**
 * limbmatch — limb delivery and SILHOUETTE, measured in the LIVE MATCH.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `tools/tmp/limbcheck.mjs` is the acceptance test the last two character passes
 * were steered by, and it measures `preview.html`'s character default: pitch 22deg,
 * a 2.1m subject filling 0.66 of an 800px frame, facing the camera dead on.
 *
 * The game is none of those things. The match camera is pitch **58deg**; the
 * fighter is **~135px tall in a 900px frame**; and at the shipped spawn facing
 * (`sim.ts` gives the player `facing {x:1,y:0}`, and `match.ts` sets
 * `rotation.y = atan2(fx,fy)`, i.e. **90deg — exact profile to a yaw-0 camera**)
 * the entire far side of the rig is behind the food mass. Three harness choices,
 * all three wrong, all three in the direction that FLATTERS the model.
 *
 * `docs/LESSONS.md` §6 (judge at shipped framing) and §13 (the harness can invert
 * the thing you are measuring). This tool removes the harness: it drives the real
 * game, at the real camera, at the real scale, and hides the environment only for
 * the instant it takes to matte the fighter.
 *
 * ── What it measures ─────────────────────────────────────────────────────────
 * Per character x facing:
 *   foot / delivered / ratio  per joint group — identical definitions to limbcheck
 *                             (isolate for footprint, frontmost-surface diff for
 *                             delivered), so the numbers are directly comparable.
 *   buried                    limb groups delivering 0 px of a >=`--footMin` footprint
 *   wastedPct                 1 - sum(delivered)/sum(foot) over limb groups
 *   detachedPx                limb pixels in a silhouette component that does not
 *                             contain the food mass (the OPPOSITE failure; a fix
 *                             that shoves a limb clear has to fail here)
 *   hullDeficiency            the REFERENCE-COMPARABLE silhouette numbers.
 *   appendages / coreShare    `--mode ref` runs the identical code over the Brawl
 *                             Stars and Zooba plates, downsampled to our own
 *                             on-screen height, so these have an external
 *                             calibration rather than a chosen threshold.
 *
 * ── Modes ────────────────────────────────────────────────────────────────────
 *   --selftest        24 assertions on hand-derivable shapes. No browser.
 *   --mode ref        reference plates -> the silhouette bands we are aiming at.
 *   --mode chars      the cast, in the match, over `--yaws`.
 *   --mode control    THE INSTRUMENT VALIDATION. Renders one character three ways —
 *                     untouched, with handR translated INTO the food mass, and with
 *                     it flung clear of the body — and asserts the metric moves in
 *                     the known direction each time. An instrument that cannot tell
 *                     a buried limb from a detached one on an input whose answer is
 *                     known has no business ranking eleven characters.
 *
 * Usage (always under a frozen tree):
 *   node tools/tmp/headserve.mjs --overlay src/characters -- \
 *     node tools/tmp/limbmatch.mjs --mode chars --out shots/limbmatch/after
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { VL } from './valuelib.mjs';
import * as S from './silhlib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const MODE = get('--mode', 'chars');
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const OUT = get('--out', 'shots/limbmatch');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
/** 90 = the SHIPPED SPAWN FACING. 0 = facing camera (what limbcheck assumed). */
const YAWS = get('--yaws', '90,0,45,180').split(',').map(Number);
const STATION = get('--station', 'pot_south');
const SS = Number(get('--ss', 2));
const SIM_SPEED = get('--sim-speed', '0.02');
const FOOT_MIN = Number(get('--footMin', 0));   // 0 = derive from character height
const RATIO_MIN = Number(get('--ratioMin', 0.5));
const REF_DIRS = get('--ref', 'reference/images/curated/fullbody_fair,reference/images/curated/character_fullbody').split(',');
const TARGET_H = Number(get('--targetH', 136));
const RUN = has('--run');
const SHOTS = has('--shots');

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/**
 * ⚠️ OLD WORDING, AND IT WAS TRUE WHEN WRITTEN AND FALSE BY THE TIME IT MATTERED:
 *
 *   *"`tools/arena-scan.mjs`'s CORRECTED coordinates — not `valuescan`'s, which had
 *   copied five station names from before `60c5b92` and kept coordinates that land
 *   inside a `CoverBox`. `pot_south` (the default here) was never one of them."*
 *
 *   const MAX_SAFE_RADIUS = 850;
 *   spawn_west: { x: 160, y: 390 }, pot_south: { x: 700, y: 640 },
 *   hub_north:  { x: 700, y: 320 }, west_lane: { x: 340, y: 500 },
 *
 * 🚨 **A COMMENT THAT SAYS "CORRECTED" IS A CLAIM WITH A TIMESTAMP ON IT, AND THIS ONE
 * OUTLIVED ITS MAP.** Those were arena-scan's corrected **1×** coordinates; `6631446`
 * doubled the arena and this copy did not follow. On the shipped 2800×2000 map all four
 * sit in the NW quadrant and **`pot_south` — the default station, the one nearly every
 * limbmatch run has used — is inside a `prep_counter`**, with `west_lane` inside a
 * `freezer`. The irony is exact: this table was written to avoid inheriting `valuescan`'s
 * stale copy and became one, by the same mechanism, one map change later.
 *
 * ⚠️ OLD WORDING, KEPT FOR THE SAME REASON AS THE BLOCK ABOVE — it is the next turn of
 * the same wheel, and it took eight days:
 *
 *   *"`850` was the 1× `MAX_SAFE_RADIUS`; the shipped one is 1985."*
 *   `const MAX_SAFE_RADIUS = 1985;   // arena-scan.mjs:392, == the dump's maxSafeRadius`
 *
 * 🚨 **THE COMMENT THAT DIAGNOSED A STALE LITERAL WAS ITSELF A STALE LITERAL, AND ITS
 * PROVENANCE NOTE POINTED AT A SECOND COPY OF THE SAME STALE NUMBER.** `arena-scan.mjs:392`
 * said 1985 and the dump said 1985, so "== the dump's maxSafeRadius" was true and meant
 * nothing: three copies agreeing is not three confirmations. `6d5c4d6` decoupled the ring
 * from the clock and the shipped opening radius is now the arena's **half-diagonal**,
 * 1720.4650534085254 — `rules.ts:fogOpeningRadiusFor`, which is the identity function.
 *
 * Read from the dump rather than retyped, and the dump is now the derivation:
 * `arena-scan --selftest` §F asserts `dump.maxSafeRadius === hypot(width/2, height/2)`, so
 * a stale dump fails there instead of silently parking this file's ring inside the map.
 * Coordinates below are arena-scan's CURRENT table (whose `--selftest` §F pins them to
 * legal ground and to ≥4 stations per quadrant), and `tools/tmp/al_guard.mjs` fails on the
 * old ones.
 */
const ARENA_DUMP = JSON.parse(
  readFileSync(new URL('../arena.gameplay.json', import.meta.url), 'utf8'),
);
const MAX_SAFE_RADIUS = Math.hypot(ARENA_DUMP.width / 2, ARENA_DUMP.height / 2);
if (Math.abs(MAX_SAFE_RADIUS - ARENA_DUMP.maxSafeRadius) > 1e-9) {
  // NOT a warning. A ring parked inside the map fogs the corners of every frame this tool
  // measures a silhouette in, and it does it plausibly — the exact class this whole comment
  // block is about. Better to refuse to run than to produce a believable wrong hull.
  throw new Error(`limbmatch: tools/arena.gameplay.json maxSafeRadius ${ARENA_DUMP.maxSafeRadius} `
    + `!= hypot(${ARENA_DUMP.width}/2, ${ARENA_DUMP.height}/2) = ${MAX_SAFE_RADIUS}. `
    + 'The dump is stale — see rules.ts:fogOpeningRadiusFor.');
}
const STATIONS = {
  spawn_west: { x: 300, y: 810, fog: MAX_SAFE_RADIUS },
  pot_south: { x: 1400, y: 1200, fog: MAX_SAFE_RADIUS },
  hub_north: { x: 1400, y: 780, fog: MAX_SAFE_RADIUS },
  west_lane: { x: 600, y: 1000, fog: MAX_SAFE_RADIUS },
};

const JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR',
  'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
const MASS_PARTS = ['face', 'head', 'neck', 'torso', 'hips'];
const LIMB_PARTS = ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

// ─────────────────────────────────────────────────────────────────────────────
// IN-PAGE CAPTURE. One synchronous evaluate: no rAF of the game's own loop can
// re-sync `rotation.y` from MatchState between setting it and reading pixels back.
// ─────────────────────────────────────────────────────────────────────────────
export const CAPTURE = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage on this page' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  if (!r || !scene || !cam) return { error: 'Stage missing renderer/scene/rig.camera' };
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  if (!Wp || !Hp) return { error: 'zero-size drawing buffer' };

  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  if (!casts.length) return { error: 'no `character:*` node in the scene' };
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };

  const readRect = (x, yImg, w, h) => {
    const yGL = Hp - (yImg + h);
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(x, yGL, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) out.set(buf.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
    return out;
  };

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

  const directRect = (x, y, w, h) => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    return readRect(x, y, w, h);
  };
  /** Two-clear-colour matte. 1 = covered by something opaque. */
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
  const b64 = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  };

  const result = { buffer: [Wp, Hp] };
  const moved = [];
  try {
    // ── facing ──────────────────────────────────────────────────────────────
    result.nativeYawDeg = +((casts[0].rotation.y * 180) / Math.PI).toFixed(1);
    if (opts.yawDeg != null) {
      for (const c of casts) { c.rotation.y = (opts.yawDeg * Math.PI) / 180; c.updateMatrixWorld(true); }
    }
    result.yawDeg = opts.yawDeg == null ? result.nativeYawDeg : opts.yawDeg;

    // ── OPTIONAL SYNTHETIC CONTROL — a known input, applied BEFORE anything is
    //    measured, so the crop, the matte and every per-part render all see it.
    //    (First version applied it after the crop had been solved from the
    //    UNMOVED body, so a limb flung clear of the character landed outside the
    //    rect and measured a footprint of ZERO — the instrument reporting the
    //    limb as absent when it was the most visible thing on screen. Exactly the
    //    failure `docs/LESSONS.md` §1 describes, inside the validation harness
    //    itself, which is the reason the validation exists.)
    if (opts.control && opts.control !== 'none') {
      const target = casts.find((c) => c.name === `character:${opts.playerId}`) ?? casts[0];
      const j = target.getObjectByName(opts.controlJoint || 'handR');
      const head = target.getObjectByName('head');
      if (j && head) {
        moved.push({ obj: j, pos: j.position.clone() });
        if (opts.control === 'bury') {
          // put the joint at the food mass's own centre, expressed in its parent's frame
          const w = new THREE.Vector3();
          head.getWorldPosition(w);
          j.parent.worldToLocal(w);
          j.position.copy(w);
        } else if (opts.control === 'fling') {
          // straight out along WORLD +x, converted into the joint's parent frame, so
          // the offset is a real distance on screen rather than whatever the elbow's
          // local axes happen to point at after the stance rotations.
          const w = new THREE.Vector3();
          j.getWorldPosition(w);
          w.x += opts.flingM ?? 0.9;
          j.parent.worldToLocal(w);
          j.position.copy(w);
        }
        target.updateMatrixWorld(true);
      } else {
        result.controlError = `joint ${opts.controlJoint || 'handR'} or head not found`;
      }
      result.control = opts.control;
    }

    // ── pick the player (by NAME; geometry fallback) — valuescan's rule ──────
    const perCast = [];
    for (const c of casts) {
      hideEnvironment(new Set([topOf(c)]));
      const others = [];
      for (const o of casts) {
        if (o === c) continue;
        if (topOf(o) === topOf(c) && o.visible) { others.push(o); o.visible = false; }
      }
      const m = matteRect(0, 0, Wp, Hp);
      for (const o of others) o.visible = true;
      restoreEnvironment();
      let n = 0;
      for (let j = 0; j < m.length; j++) n += m[j];
      perCast.push({ name: c.name, px: n, obj: c, mask: m });
    }
    const onScreen = perCast.filter((p) => p.px > 0);
    let player = onScreen.find((p) => p.name === `character:${opts.playerId}`) ?? null;
    result.playerPick = player ? 'name' : 'largest-area (FALLBACK)';
    if (!player) player = onScreen.sort((x, y) => y.px - x.px)[0];
    if (!player) return { error: 'the player character has ZERO on-screen pixels' };
    result.player = player.name;

    // ── the SHIPPED frame, before any direct render clobbers it ──────────────
    stage.render(0); stage.render(0);
    const fullRGBA = readRect(0, 0, Wp, Hp);

    // ── OCCLUSION VALIDITY — `docs/LESSONS.md` §5 ───────────────────────────
    // The matte mask comes from an environment-HIDDEN render; `cropRGB` comes from
    // the SHIPPED frame. Wherever a prop occludes the fighter the two renders
    // disagree, and §5's rule is that a two-render metric is valid only where its
    // two renders agree — the failure it names cost `valuescan --mode dl` a
    // confident report of a PROP's luma as the character's. So measure the
    // disagreement rather than assume it away: hide the whole player in the shipped
    // composition and see which of its matte pixels actually changed.
    const hidPlayerRGBA = (() => {
      const vis = [];
      player.obj.traverse((o) => { if (o.isMesh && o.visible) { vis.push(o); o.visible = false; } });
      stage.render(0); stage.render(0);
      const buf = readRect(0, 0, Wp, Hp);
      for (const o of vis) o.visible = true;
      stage.render(0); stage.render(0);
      return buf;
    })();

    // crop
    let bx = 1e9, by = 1e9, bx1 = -1, by1 = -1;
    for (let j = 0; j < player.mask.length; j++) {
      if (!player.mask[j]) continue;
      const x = j % Wp, y = (j / Wp) | 0;
      if (x < bx) bx = x; if (x > bx1) bx1 = x;
      if (y < by) by = y; if (y > by1) by1 = y;
    }
    const pad = 10;
    const cx = Math.max(0, bx - pad), cy = Math.max(0, by - pad);
    const cw = Math.min(Wp - cx, bx1 - bx + 1 + pad * 2), chh = Math.min(Hp - cy, by1 - by + 1 + pad * 2);
    result.crop = [cx, cy, cw, chh];
    result.charHeightPx = by1 - by + 1;
    result.charHeightPctOfFrame = +(((by1 - by + 1) / Hp) * 100).toFixed(2);

    {
      const deliv = new Uint8Array(cw * chh);
      let matteN = 0, delivN = 0;
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
        const g = (cy + y) * Wp + (cx + x);
        if (!player.mask[g]) continue;
        matteN++;
        const i4 = g * 4;
        const d = Math.abs(fullRGBA[i4] - hidPlayerRGBA[i4]) +
                  Math.abs(fullRGBA[i4 + 1] - hidPlayerRGBA[i4 + 1]) +
                  Math.abs(fullRGBA[i4 + 2] - hidPlayerRGBA[i4 + 2]);
        if (d > 12) { deliv[y * cw + x] = 1; delivN++; }
      }
      result.shippedDeliveredPct = +((delivN / Math.max(1, matteN)) * 100).toFixed(2);
      result.charDeliveredb64 = b64(deliv);
    }

    hideEnvironment(new Set([topOf(player.obj)]));
    const otherCast = [];
    for (const o of casts) {
      if (o === player.obj) continue;
      if (o.visible) { otherCast.push(o); o.visible = false; }
    }

    const base = matteRect(cx, cy, cw, chh);
    const baseDirect = directRect(cx, cy, cw, chh);

    const allMeshes = [];
    player.obj.traverse((o) => { if (o.isMesh) allMeshes.push(o); });
    const allPrev = allMeshes.map((mm) => mm.visible);

    const groups = [];
    for (const name of opts.jointNames) {
      const jt = player.obj.getObjectByName(name);
      if (!jt) continue;
      const meshes = [];
      jt.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
      if (!meshes.length) continue;
      // descendants that belong to NO nearer joint (groups nest: torso contains shoulderL)
      const own = meshes.filter((mm) => {
        let n = mm.parent;
        while (n && n !== player.obj) {
          if (n === jt) return true;
          if (opts.jointNames.includes(n.name)) return false;
          n = n.parent;
        }
        return false;
      });
      if (!own.length) continue;
      const ownSet = new Set(own);

      // DELIVERED = pixels whose colour changes when this group is hidden.
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
      // FOOTPRINT = the same group rendered ALONE.
      allMeshes.forEach((mm, i) => { mm.visible = ownSet.has(mm) && allPrev[i]; });
      const iso = matteRect(cx, cy, cw, chh);
      allMeshes.forEach((mm, i) => { mm.visible = allPrev[i]; });
      let foot = 0;
      for (let k = 0; k < iso.length; k++) foot += iso[k];
      groups.push({ name, mask: owned, px: n, foot });
    }

    // the food mass alone — for `limbShare` and for naming the main component
    {
      const massSet = new Set();
      for (const nm of opts.massParts) {
        const jt = player.obj.getObjectByName(nm);
        if (!jt) continue;
        jt.traverse((o) => {
          if (!o.isMesh) return;
          let n2 = o.parent, own = false;
          while (n2 && n2 !== player.obj) {
            if (n2 === jt) { own = true; break; }
            if (opts.jointNames.includes(n2.name)) break;
            n2 = n2.parent;
          }
          if (own) massSet.add(o);
        });
      }
      allMeshes.forEach((mm, i) => { mm.visible = massSet.has(mm) && allPrev[i]; });
      const massIso = matteRect(cx, cy, cw, chh);
      allMeshes.forEach((mm, i) => { mm.visible = allPrev[i]; });
      result.massMaskb64 = b64(massIso);
    }

    for (const o of otherCast) o.visible = true;
    restoreEnvironment();

    // owner map (Uint8; 255 = unattributed) + the shipped-frame RGB crop
    const owner = new Uint8Array(cw * chh).fill(255);
    groups.forEach((g, i) => { for (let k = 0; k < g.mask.length; k++) if (g.mask[k]) owner[k] = i; });
    const cropRGB = new Uint8Array(cw * chh * 3);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      const src = ((cy + y) * Wp + (cx + x)) * 4, dst = (y * cw + x) * 3;
      cropRGB[dst] = fullRGBA[src]; cropRGB[dst + 1] = fullRGBA[src + 1]; cropRGB[dst + 2] = fullRGBA[src + 2];
    }
    result.parts = groups.map((g) => ({ part: g.name, foot: g.foot, delivered: g.px, ratio: g.foot ? +(g.px / g.foot).toFixed(3) : null }));
    result.ownerNames = groups.map((g) => g.name);
    result.ownerb64 = b64(owner);
    result.maskb64 = b64(base);
    result.cropRGBb64 = b64(cropRGB);
    let mattePx = 0, ownedPx = 0;
    for (let k = 0; k < base.length; k++) if (base[k]) { mattePx++; if (owner[k] !== 255) ownedPx++; }
    result.attributionPct = +((ownedPx / Math.max(1, mattePx)) * 100).toFixed(1);
  } finally {
    for (const m of moved) m.obj.position.copy(m.pos);
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
// STANCE SWEEP — price a pose change BEFORE writing it into `rig.ts`.
//
// `tools/tmp/simfix.mjs` does this for materials and the note in `docs/TOOLS.md`
// is the reason: a sweep run in-page against the shipped frame costs one boot and
// answers the question the edit was going to ask anyway. Every candidate is a set
// of DELTAS applied on top of whatever `restPose()` left, measured at the SHIPPED
// resolution (no supersample — the silhouette metrics are scale-free and 136px is
// the size the player sees), and the joint rotations are snapshotted and restored
// between candidates so they cannot accumulate.
// ─────────────────────────────────────────────────────────────────────────────
const SWEEP = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig.camera;
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  const target = casts.find((c) => c.name === `character:${opts.playerId}`) ?? casts[0];
  if (!target) return { error: 'no cast root' };
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };

  const readFull = () => {
    const buf = new Uint8Array(Wp * Hp * 4);
    gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(Wp * Hp * 4);
    for (let row = 0; row < Hp; row++) out.set(buf.subarray((Hp - 1 - row) * Wp * 4, (Hp - row) * Wp * 4), row * Wp * 4);
    return out;
  };
  const savedBg = scene.background, savedShadow = r.shadowMap.enabled, savedAlpha = r.getClearAlpha();
  let hidden = [];
  const hideEnvironment = (keep) => {
    hidden = [];
    for (const kid of scene.children) { if (kid !== keep && kid.visible) { hidden.push(kid); kid.visible = false; } }
  };
  const restoreEnvironment = () => { for (const k of hidden) k.visible = true; hidden = []; };
  const matte = () => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    const A = readFull();
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
    const B = readFull();
    const m = new Uint8Array(Wp * Hp);
    for (let i = 0, j = 0; i < A.length; i += 4, j++) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      m[j] = d < 32 ? 1 : 0;
    }
    return m;
  };
  const b64 = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  };

  const JN = ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR',
    'torso', 'hips', 'head', 'handL', 'handR'];
  const joints = {};
  for (const n of JN) joints[n] = target.getObjectByName(n);
  const saved = {};
  for (const n of JN) if (joints[n]) saved[n] = { rot: joints[n].rotation.clone(), pos: joints[n].position.clone(), scl: joints[n].scale.clone() };

  // Mass ownership must EXCLUDE nearer joints. `torso` contains shoulderL and
  // `hips` contains hipL, so a plain traverse makes "the food mass" the whole
  // character and `limbShare` comes back 0.0000 for every candidate — which it
  // did, on the first run of this sweep. Same rule as CAPTURE.
  const ALLJ = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
  const massSet = new Set();
  for (const nm of opts.massParts) {
    const jt = target.getObjectByName(nm);
    if (!jt) continue;
    jt.traverse((o) => {
      if (!o.isMesh) return;
      let n2 = o.parent;
      while (n2 && n2 !== target) {
        if (n2 === jt) { massSet.add(o); return; }
        if (ALLJ.includes(n2.name)) return;
        n2 = n2.parent;
      }
    });
  }
  const allMeshes = [];
  target.traverse((o) => { if (o.isMesh) allMeshes.push(o); });
  const allPrev = allMeshes.map((m) => m.visible);

  const results = [];
  try {
    target.rotation.y = (opts.yawDeg * Math.PI) / 180;
    hideEnvironment(topOf(target));
    for (const o of casts) if (o !== target) o.visible = false;

    for (const cand of opts.candidates) {
      for (const n of JN) if (joints[n]) {
        joints[n].rotation.copy(saved[n].rot);
        joints[n].position.copy(saved[n].pos);
        joints[n].scale.copy(saved[n].scl);
      }
      for (const [n, ax, v] of (cand.deltas || [])) { if (joints[n]) joints[n].rotation[ax] += v; }
      for (const [n, k] of (cand.scales || [])) { if (joints[n]) joints[n].scale.multiplyScalar(k); }
      for (const [n, ax, k] of (cand.posMul || [])) { if (joints[n]) joints[n].position[ax] *= k; }
      target.updateMatrixWorld(true);

      const full = matte();
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let j = 0; j < full.length; j++) {
        if (!full[j]) continue;
        const x = j % Wp, y = (j / Wp) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) { results.push({ name: cand.name, error: 'no pixels' }); continue; }
      const pad = 4;
      const cx = Math.max(0, x0 - pad), cy = Math.max(0, y0 - pad);
      const cw = Math.min(Wp - cx, x1 - x0 + 1 + pad * 2), ch = Math.min(Hp - cy, y1 - y0 + 1 + pad * 2);
      const crop = new Uint8Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop[y * cw + x] = full[(cy + y) * Wp + (cx + x)];

      allMeshes.forEach((m, i) => { m.visible = massSet.has(m) && allPrev[i]; });
      const massFull = matte();
      allMeshes.forEach((m, i) => { m.visible = allPrev[i]; });
      const massCrop = new Uint8Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) massCrop[y * cw + x] = massFull[(cy + y) * Wp + (cx + x)];

      let rgbb64 = null;
      if (opts.shots) {
        restoreEnvironment();
        for (const o of casts) if (o !== target) o.visible = true;
        scene.background = savedBg; r.shadowMap.enabled = savedShadow;
        stage.render(0); stage.render(0);
        const full4 = (() => {
          const buf = new Uint8Array(Wp * Hp * 4);
          gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          const o2 = new Uint8Array(Wp * Hp * 4);
          for (let row = 0; row < Hp; row++) o2.set(buf.subarray((Hp - 1 - row) * Wp * 4, (Hp - row) * Wp * 4), row * Wp * 4);
          return o2;
        })();
        const rgb = new Uint8Array(cw * ch * 3);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const s4 = ((cy + y) * Wp + (cx + x)) * 4, d3 = (y * cw + x) * 3;
          rgb[d3] = full4[s4]; rgb[d3 + 1] = full4[s4 + 1]; rgb[d3 + 2] = full4[s4 + 2];
        }
        rgbb64 = b64(rgb);
        hideEnvironment(topOf(target));
        for (const o of casts) if (o !== target) o.visible = false;
      }
      results.push({ name: cand.name, crop: [cx, cy, cw, ch], maskb64: b64(crop), massb64: b64(massCrop), rgbb64 });
    }
    // the shipped frame of the LAST candidate, for a look
    stage.render(0); stage.render(0);
  } finally {
    for (const n of JN) if (joints[n]) {
      joints[n].rotation.copy(saved[n].rot);
      joints[n].position.copy(saved[n].pos);
      joints[n].scale.copy(saved[n].scl);
    }
    for (const o of casts) o.visible = true;
    restoreEnvironment();
    scene.background = savedBg; r.shadowMap.enabled = savedShadow;
    r.setClearColor(0x000000, savedAlpha);
    try { stage.render(0); } catch (e) { /* best effort */ }
  }
  return { buffer: [Wp, Hp], results };
};

// ─────────────────────────────────────────────────────────────────────────────
// Node-side analysis
// ─────────────────────────────────────────────────────────────────────────────
const b64ToBytes = (s) => Uint8Array.from(Buffer.from(s, 'base64'));

function analyse(res, opts) {
  const [cx, cy, cw, ch] = res.crop;
  const mask = b64ToBytes(res.maskb64);
  const massMask = b64ToBytes(res.massMaskb64);
  const owner = b64ToBytes(res.ownerb64);
  const names = res.ownerNames;

  const sil = S.silhouette(mask, cw, ch, {});
  // limb share of the silhouette: pixels the food mass does NOT cover
  let outMass = 0, total = 0;
  for (let j = 0; j < mask.length; j++) { if (!mask[j]) continue; total++; if (!massMask[j]) outMass++; }

  // detachment: limb-owned pixels in a component that does not hold the food mass
  const { label, sizes } = S.components(mask, cw, ch);
  let mainId = -1, bestMass = -1;
  const massPerComp = new Map();
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j] || !massMask[j]) continue;
    const id = label[j];
    massPerComp.set(id, (massPerComp.get(id) ?? 0) + 1);
  }
  for (const [id, n] of massPerComp) if (n > bestMass) { bestMass = n; mainId = id; }
  const detached = {};
  let detachedPx = 0;
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j] || label[j] === mainId) continue;
    const o = owner[j];
    if (o === 255) continue;
    const nm = names[o];
    if (!LIMB_PARTS.includes(nm)) continue;
    detached[nm] = (detached[nm] ?? 0) + 1;
    detachedPx++;
  }
  const islands = sizes.filter((n) => n >= 8).length;
  // ISLAND SIZES, not just the count. `detachedPx` only counts pixels owned by a
  // LIMB joint, so a floating prop — a drip anchored into a torus's hole, a lid
  // anchored off the end of a bottle cap — reports `detachedPx 0` and is invisible
  // in the headline row. Five characters shipped exactly that in one round of this
  // pass. This is the number that catches it.
  const islandSizes = sizes.filter((n, i) => n >= 8 && i !== mainId).sort((a2, b2) => b2 - a2);

  // per-limb summary, gated on a footprint that scales with the fighter's own size
  const footMin = opts.footMin || Math.max(8, Math.round(0.0025 * (sil ? sil.areaPx : 1) * 4));
  const limbs = res.parts.filter((p) => LIMB_PARTS.includes(p.part));
  const gated = limbs.filter((p) => p.foot >= footMin);
  const buried = gated.filter((p) => p.delivered === 0);
  const fails = gated.filter((p) => (p.ratio ?? 0) < opts.ratioMin);
  let wasted = 0, tot = 0;
  for (const p of limbs) { tot += p.foot; wasted += p.foot * (1 - (p.ratio ?? 0)); }

  return {
    yawDeg: res.yawDeg,
    charHeightPx: res.charHeightPx,
    charHeightPctOfFrame: res.charHeightPctOfFrame,
    attributionPct: res.attributionPct,
    footMin,
    limbFootPx: tot,
    wastedPct: +((100 * wasted) / Math.max(1, tot)).toFixed(1),
    buried: buried.map((p) => p.part),
    fails: fails.map((p) => `${p.part}:${p.foot}/${p.ratio}`),
    detachedPx, detached, islands, islandSizes,
    limbShareOfSilhouette: +(outMass / Math.max(1, total)).toFixed(4),
    // `widthPx` is RECORDED, not used by any threshold. The reference plates run
    // 63-89 px wide at a 136 px height (0.46-0.65 W/H) and a stance change is the
    // one lever that can walk straight out of that band while every other number
    // improves, so the aspect has to be on the same row as the numbers it pays for.
    silhouette: sil && { hullDeficiency: sil.hullDeficiency, appendages: sil.appendages, appendageShare: sil.appendageShare, coreShare: sil.coreShare, appendageSizes: sil.appendageSizes.slice(0, 6), areaPx: sil.areaPx, heightPx: sil.heightPx, widthPx: sil.widthPx, aspectWH: +(sil.widthPx / sil.heightPx).toFixed(3), openingRadiusPx: sil.openingRadiusPx },
    parts: res.parts,
    _mask: mask, _cw: cw, _ch: ch, _sil: sil, _owner: owner, _names: names,
  };
}

/** overlay: shipped crop | matte | appendage map. LOOK AT THIS before believing a row. */
async function writeOverlay(res, an, dir, tag) {
  const [, , cw, ch] = res.crop;
  const rgb = b64ToBytes(res.cropRGBb64);
  const out = Buffer.alloc(cw * 3 * ch * 3);
  const put = (panel, x, y, r, g, b) => {
    const k = (y * cw * 3 + panel * cw + x) * 3;
    out[k] = r; out[k + 1] = g; out[k + 2] = b;
  };
  const PAL = [[255, 90, 90], [90, 200, 255], [255, 210, 80], [140, 255, 140], [255, 130, 255],
    [120, 160, 255], [255, 170, 90], [90, 255, 220], [220, 120, 255], [180, 255, 90],
    [255, 90, 160], [90, 130, 255], [230, 230, 120], [120, 230, 180], [200, 140, 100],
    [160, 160, 255], [255, 255, 255]];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const j = y * cw + x;
    put(0, x, y, rgb[j * 3], rgb[j * 3 + 1], rgb[j * 3 + 2]);
    const o = an._owner[j];
    if (an._mask[j]) {
      const c = o === 255 ? [70, 70, 70] : PAL[o % PAL.length];
      put(1, x, y, c[0], c[1], c[2]);
    } else put(1, x, y, 16, 12, 20);
    if (an._sil && an._sil._appendageMask[j]) put(2, x, y, 255, 60, 60);
    else if (an._mask[j]) put(2, x, y, 200, 200, 200);
    else put(2, x, y, 16, 12, 20);
  }
  await sharp(out, { raw: { width: cw * 3, height: ch, channels: 3 } })
    .resize(cw * 3 * 2, ch * 2, { kernel: 'nearest' }).png().toFile(join(dir, `${tag}.png`));
}

async function newPage(browser, W, H, dsf) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
  return page;
}

export async function bootMatch(browser, id, st, ss) {
  const page = await newPage(browser, 1600, 900, ss ?? SS);
  const url = `${BASE}/?player=${id}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180000 });
  await page.waitForTimeout(900);
  // THREE must be reachable inside CAPTURE for the `bury` control's world->local hop.
  await page.evaluate(() => {
    if (!window.THREE && window.__stage) {
      // Stage keeps a live scene; borrow the constructor chain off any Object3D.
      const proto = Object.getPrototypeOf(window.__stage.scene);
      window.THREE = { Vector3: window.__stage.rig.camera.position.constructor };
      void proto;
    }
  });
  return page;
}

// ─────────────────────────────────────────────────────────────────────────────
async function modeChars() {
  if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
  const st = STATIONS[STATION];
  if (!st) { console.error(`no station ${STATION}`); process.exit(2); }
  const dir = join(OUT, 'chars');
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = {};
  try {
    for (const id of IDS) {
      out[id] = {};
      let page = null;
      try {
        page = await bootMatch(browser, id, st);
        if (RUN) { await page.keyboard.down('w'); await page.waitForTimeout(400); }
        for (const yawDeg of YAWS) {
          const res = await page.evaluate(CAPTURE, {
            yawDeg, playerId: id, jointNames: JOINTS, massParts: MASS_PARTS, control: 'none',
          });
          if (res.error) { console.error(`✗ ${id} yaw${yawDeg}: ${res.error}`); out[id][yawDeg] = { error: res.error }; continue; }
          const an = analyse(res, { footMin: FOOT_MIN, ratioMin: RATIO_MIN });
          await writeOverlay(res, an, dir, `${id}.yaw${yawDeg}`);
          const { _mask, _owner, _sil, _cw, _ch, _names, ...clean } = an;
          out[id][yawDeg] = clean;
          const s = an.silhouette;
          console.log(`${id.padEnd(12)} yaw ${String(yawDeg).padStart(3)}  h ${String(an.charHeightPx).padStart(3)}px  ` +
            `wasted ${String(an.wastedPct).padStart(5)}%  buried ${String(an.buried.length).padStart(2)}/${an.parts.filter((p) => LIMB_PARTS.includes(p.part)).length}  ` +
            `detach ${String(an.detachedPx).padStart(4)}px  isl ${String(an.islands)}${an.islandSizes.length ? '(' + an.islandSizes.slice(0, 3).join(',') + ')' : ''}  ` +
            `hullDef ${String(s ? s.hullDeficiency : '—').padStart(6)}  ` +
            `app ${String(s ? s.appendages : '—').padStart(2)}  core ${String(s ? s.coreShare : "—").padStart(6)}  ` +
            `limbShare ${an.limbShareOfSilhouette}`);
        }
      } catch (e) {
        console.error(`✗ ${id}: ${e}`);
        out[id].error = String(e);
      } finally { if (page) await page.close(); }
    }
  } finally { await browser.close(); }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'chars.json'), JSON.stringify(out, null, 2));
  console.log(`\nwrote ${OUT}/chars.json and ${dir}/*.png`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE control — THE INSTRUMENT VALIDATION.
// ─────────────────────────────────────────────────────────────────────────────
async function modeControl() {
  if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
  const id = get('--id', 'burrito');
  const st = STATIONS[STATION];
  const dir = join(OUT, 'control');
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = {};
  try {
    const page = await bootMatch(browser, id, st);
    for (const control of ['none', 'bury', 'fling']) {
      const res = await page.evaluate(CAPTURE, {
        yawDeg: 0, playerId: id, jointNames: JOINTS, massParts: MASS_PARTS,
        control, controlJoint: 'handR', flingM: 0.9,
      });
      if (res.error) { console.error(`✗ ${control}: ${res.error}`); continue; }
      if (res.controlError) console.error(`  control warning: ${res.controlError}`);
      const an = analyse(res, { footMin: FOOT_MIN, ratioMin: RATIO_MIN });
      await writeOverlay(res, an, dir, `${id}.${control}`);
      const hand = an.parts.find((p) => p.part === 'handR');
      rows[control] = { handR: hand, detachedPx: an.detachedPx, islands: an.islands, silhouette: an.silhouette };
      console.log(`${control.padEnd(6)} handR foot ${String(hand.foot).padStart(5)} delivered ${String(hand.delivered).padStart(5)} ratio ${String(hand.ratio).padStart(5)}  ` +
        `detached ${String(an.detachedPx).padStart(4)}px  islands ${an.islands}  hullDef ${an.silhouette.hullDeficiency}  app ${an.silhouette.appendages}`);
    }
    await page.close();
  } finally { await browser.close(); }

  // ASSERTIONS — the answers are known before the run.
  let pass = 0, fail = 0;
  const check = (name, ok, detail) => { if (ok) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${detail}`); } };
  console.log('\nVALIDATION (known input -> known answer):');
  const N = rows.none, B = rows.bury, F = rows.fling;
  if (!N || !B || !F) { console.error('a control variant failed to render — cannot validate'); process.exit(1); }
  check('untouched handR delivers pixels', N.handR.delivered > 0, `delivered ${N.handR.delivered}`);
  check('buried handR delivers ~0', B.handR.delivered <= Math.max(4, 0.05 * N.handR.delivered), `delivered ${B.handR.delivered} vs baseline ${N.handR.delivered}`);
  check('buried handR still has a footprint', B.handR.foot > 0.5 * N.handR.foot, `foot ${B.handR.foot} vs ${N.handR.foot}`);
  check('burial does NOT register as detachment', B.detachedPx <= N.detachedPx, `${B.detachedPx} vs ${N.detachedPx}`);
  check('flung handR registers detached pixels', F.detachedPx > 100, `detachedPx ${F.detachedPx}`);
  check('flung handR delivers nearly all its footprint', F.handR.ratio > 0.85, `ratio ${F.handR.ratio}`);
  check('flinging raises appendage count or hull deficiency',
    F.silhouette.appendages > N.silhouette.appendages || F.silhouette.hullDeficiency > N.silhouette.hullDeficiency,
    `app ${N.silhouette.appendages}->${F.silhouette.appendages}, hullDef ${N.silhouette.hullDeficiency}->${F.silhouette.hullDeficiency}`);
  // ── This assertion USED to be "burying lowers hull deficiency", and it was wrong ──
  // It held only while the hand was a vertex of the character's own convex hull, so
  // that hiding it shrank the hull as fast as it shrank the area. The moment burrito
  // grew foil peels that reach further out than its mitt does, the hand stopped being
  // on the hull and the arithmetic inverted: hull deficiency is `1 - area/hull`, so
  // removing area that was INSIDE the hull must RAISE it. Measured 0.4102 -> 0.4235,
  // and the instrument was right both times — the assertion encoded an assumption
  // about the SUBJECT, not a property of burial.
  //
  // What burial actually guarantees, on any subject: the silhouette loses area, and
  // it cannot gain a protrusion. Both are checked instead.
  check('burying removes silhouette area', B.silhouette.areaPx < N.silhouette.areaPx,
    `areaPx ${N.silhouette.areaPx} -> ${B.silhouette.areaPx}`);
  check('burying cannot ADD an appendage', B.silhouette.appendages <= N.silhouette.appendages,
    `app ${N.silhouette.appendages} -> ${B.silhouette.appendages}`);
  await writeFile(join(OUT, 'control.json'), JSON.stringify(rows, null, 2));
  console.log(`\n${pass} pass, ${fail} fail · overlays in ${dir}/ — LOOK AT THEM`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE ref — the same silhouette code over the reference plates.
// ─────────────────────────────────────────────────────────────────────────────
async function modeRef() {
  const dir = join(OUT, 'ref');
  await mkdir(dir, { recursive: true });
  const rows = [];
  for (const rd of REF_DIRS) {
    if (!existsSync(rd)) { console.error(`skip ${rd} — not present (reference/ is gitignored)`); continue; }
    for (const f of readdirSync(rd).filter((x) => /\.(png|jpe?g)$/i.test(x)).sort()) {
      const { data, info } = await sharp(join(rd, f)).resize(700, null).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height;
      const seg = VL.segmentAuto(data, W, H, {});
      const big = VL.largestComponent(seg.mask, W, H).mask;
      const filled = VL.fillHoles(big, W, H);
      const rs = S.resampleMaskToHeight(filled, W, H, TARGET_H);
      if (!rs) { console.error(`✗ ${f}: nothing segmented`); continue; }
      const sil = S.silhouette(rs.mask, rs.W, rs.H, {});
      if (!sil) { console.error(`✗ ${f}: empty after resample`); continue; }
      rows.push({ dir: rd.split('/').pop(), file: f, tol: seg.tol, scale: +rs.scale.toFixed(3), ...sil, _appendageMask: undefined, _openingMask: undefined });
      console.log(`${(rd.split('/').pop() + '/' + f).padEnd(30)} h ${String(sil.heightPx).padStart(3)}px  hullDef ${sil.hullDeficiency.toFixed(4)}  app ${String(sil.appendages).padStart(2)} (${sil.appendageShare})  core ${sil.coreShare}`);
      // overlay so the segmentation can be LOOKED AT
      const ov = Buffer.alloc(rs.W * rs.H * 3);
      for (let j = 0; j < rs.W * rs.H; j++) {
        if (sil._appendageMask[j]) { ov[j * 3] = 255; ov[j * 3 + 1] = 60; ov[j * 3 + 2] = 60; }
        else if (rs.mask[j]) { ov[j * 3] = 210; ov[j * 3 + 1] = 210; ov[j * 3 + 2] = 210; }
        else { ov[j * 3] = 16; ov[j * 3 + 1] = 12; ov[j * 3 + 2] = 20; }
      }
      await sharp(ov, { raw: { width: rs.W, height: rs.H, channels: 3 } })
        .resize(rs.W * 3, rs.H * 3, { kernel: 'nearest' }).png().toFile(join(dir, `${rd.split('/').pop()}_${f.replace(/\.\w+$/, '')}.png`));
    }
  }
  const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null; };
  const hd = rows.map((r) => r.hullDeficiency), ap = rows.map((r) => r.appendages), cp = rows.map((r) => r.appendageShare);
  const summary = {
    n: rows.length, targetH: TARGET_H,
    hullDeficiency: { min: q(hd, 0), p25: q(hd, 0.25), median: q(hd, 0.5), max: q(hd, 1) },
    appendages: { min: q(ap, 0), p25: q(ap, 0.25), median: q(ap, 0.5), max: q(ap, 1) },
    appendageShare: { min: q(cp, 0), p25: q(cp, 0.25), median: q(cp, 0.5), max: q(cp, 1) },
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'ref.json'), JSON.stringify({ summary, rows }, null, 2));
  console.log(`\nREFERENCE BANDS over ${rows.length} plates at ${TARGET_H}px:`);
  console.log(`  hullDeficiency  min ${summary.hullDeficiency.min}  p25 ${summary.hullDeficiency.p25}  median ${summary.hullDeficiency.median}  max ${summary.hullDeficiency.max}`);
  console.log(`  appendages      min ${summary.appendages.min}  p25 ${summary.appendages.p25}  median ${summary.appendages.median}  max ${summary.appendages.max}`);
  console.log(`  appendageShare  min ${summary.appendageShare.min}  p25 ${summary.appendageShare.p25}  median ${summary.appendageShare.median}  max ${summary.appendageShare.max}`);
  console.log(`wrote ${OUT}/ref.json — LOOK AT ${dir}/*.png before believing any of it.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest — shapes whose answers are derivable by hand.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want, eps) => {
    const ok = typeof want === 'number' ? (got != null && Math.abs(got - want) <= (eps ?? 1e-9)) : JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else { fail++; console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  };
  const W = 200, H = 200;
  const blank = () => new Uint8Array(W * H);
  const disc = (cx, cy, r, m = blank()) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m[y * W + x] = 1;
    return m;
  };
  const rect = (x0, y0, w, h, m = blank()) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && x < W && y >= 0 && y < H) m[y * W + x] = 1;
    return m;
  };

  // bbox / components
  const r1 = rect(10, 20, 30, 40);
  const bb = S.bbox(r1, W, H);
  check('bbox.x0', bb.x0, 10); check('bbox.y0', bb.y0, 20);
  check('bbox.w', bb.w, 30); check('bbox.h', bb.h, 40); check('bbox.n', bb.n, 1200);
  const two = rect(120, 20, 10, 10, rect(10, 20, 10, 10));
  check('components count', S.components(two, W, H).sizes.length, 2);
  check('components sizes', S.components(two, W, H).sizes, [100, 100]);

  // distance transform: centre of a 41x41 square is 20 from the edge (+1 px convention)
  const sq = rect(80, 80, 41, 41);
  const din = S.distanceInside(sq, W, H);
  check('distanceInside centre', Math.round(din[100 * W + 100]), 21, 1);
  check('distanceInside outside', din[10 * W + 10], 0);

  // perimeter of a 30x40 rect = 2*(30+40)
  check('perimeter rect', S.perimeter(r1, W, H), 2 * (30 + 40));

  // hull area of a rect equals its area (the hull of a rectangle is the rectangle)
  check('hullArea rect', Math.round(S.hullArea(r1, W, H)), 1200, 1);
  // A DIGITAL disc's hull is pi(r+0.5)^2, NOT pi r^2 — the hull of a union of unit
  // squares circumscribes them. That is a real +1/(2r) bias on any smooth convex
  // shape and it is PINNED here rather than papered over, because both sides of the
  // comparison (our render and the reference plates) are measured at the same
  // subject height and therefore carry the same bias. At the 136px height used for
  // characters it is ~1.2% of hullDeficiency.
  const d30 = disc(100, 100, 30);
  const hd = S.hullArea(d30, W, H);
  check('hullArea disc ~ pi (r+0.5)^2', Math.abs(hd - Math.PI * 30.5 * 30.5) / (Math.PI * 930.25) < 0.02, true);

  // A DISC IS A BLOB: hull deficiency at the quantisation floor, no appendages.
  const sDisc = S.silhouette(d30, W, H, {});
  check('disc hullDeficiency = quantisation floor', Math.abs(sDisc.hullDeficiency - 0.0325) < 0.012, true);
  check('disc appendages', sDisc.appendages, 0);
  check('disc coreShare ~ 1', sDisc.coreShare > 0.97, true);

  // A BODY WITH FOUR LIMBS HAS FOUR APPENDAGES. Body: disc r=22 (inradius 22).
  // Limbs: 8px wide, 26px long — half-width 4, so an opening at k=9.6 erodes them
  // away and leaves the body. This is the exact discrimination the metric is for.
  const OPT = { kFrac: 0.10, minAreaFrac: 0.01 };
  const body = () => disc(100, 100, 22);
  const armN = (m) => rect(96, 52, 8, 26, m);
  const armS = (m) => rect(96, 122, 8, 26, m);
  const armE = (m) => rect(122, 96, 26, 8, m);
  const armW = (m) => rect(52, 96, 26, 8, m);
  const four = armW(armE(armS(armN(body()))));
  const sFour = S.silhouette(four, W, H, OPT);
  check('four-limb appendages', sFour.appendages, 4);
  check('four-limb hullDeficiency > disc', sFour.hullDeficiency > 0.20, true);
  check('four-limb coreShare < disc', sFour.coreShare < sDisc.coreShare, true);

  // ONE limb only -> one appendage, and a lower hull deficiency than four.
  const sOne = S.silhouette(armE(body()), W, H, OPT);
  check('single-limb appendages', sOne.appendages, 1);
  check('single-limb hullDef < four', sOne.hullDeficiency < sFour.hullDeficiency, true);

  // BURYING a limb (moving it inside the body) removes the appendage entirely.
  const sBuried = S.silhouette(body(), W, H, OPT);
  check('buried appendages', sBuried.appendages, 0);
  check('buried hullDef at the floor', sBuried.hullDeficiency < 0.05, true);

  // A DETACHED limb is a second component, and the metric must still see the limb.
  const det = rect(130, 96, 26, 8, body());
  const cc = S.components(det, W, H);
  check('detached components', cc.sizes.length, 2);
  check('detached limb still counted as an appendage', S.silhouette(det, W, H, OPT).appendages, 1);

  // resample: a 200px-tall shape asked for 100px comes back ~100 tall, area ~1/4
  const rs = S.resampleMaskToHeight(rect(50, 0, 100, 200), W, H, 100);
  const rbb = S.bbox(rs.mask, rs.W, rs.H);
  check('resample height', Math.abs(rbb.h - 100) <= 2, true);
  check('resample area quartered', Math.abs(rbb.n - 5000) / 5000 < 0.05, true);
  // and it must NOT invent grey: every value is 0 or 1
  check('resample is binary', rs.mask.every((v) => v === 0 || v === 1), true);

  console.log(`\nselftest: ${pass} pass, ${fail} fail`);
  return fail ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
async function modeStance() {
  if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
  const st = STATIONS[STATION];
  const dir = join(OUT, 'stance');
  await mkdir(dir, { recursive: true });
  const A = get('--armX', '0,0.25,0.40,0.55,0.70').split(',').map(Number);
  const HH = get('--hipX', '0,0.18,0.30').split(',').map(Number);
  const candidates = [];
  for (const ax of A) for (const hx of HH) {
    candidates.push({
      name: `a${ax}_h${hx}`, armX: ax, hipX: hx,
      deltas: [
        ['shoulderL', 'x', ax], ['shoulderR', 'x', -ax],
        ['hipL', 'x', hx], ['hipR', 'x', -hx],
        // ankle cancels 60% of the hip swing so the sole stays flat — the same
        // rule `rig.ts`'s run branch uses, and for the same reason (the default
        // foot is a long plank hanging below the ankle).
        ['footL', 'x', -hx * 0.6], ['footR', 'x', hx * 0.6],
      ],
    });
  }
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = {};
  try {
    for (const id of IDS) {
      let page = null;
      try {
        page = await bootMatch(browser, id, st, 1);
        out[id] = {};
        for (const yawDeg of YAWS) {
          const res = await page.evaluate(SWEEP, { playerId: id, yawDeg, massParts: MASS_PARTS, candidates, shots: SHOTS });
          if (res.error) { console.error(`✗ ${id} yaw${yawDeg}: ${res.error}`); continue; }
          if (SHOTS) await writeSheet(res.results, join(OUT, 'sheets'), `${id}.yaw${yawDeg}`);
          out[id][yawDeg] = res.results.map((r) => {
            if (r.error) return { name: r.name, error: r.error };
            const [, , cw, ch] = r.crop;
            const mask = b64ToBytes(r.maskb64), mm = b64ToBytes(r.massb64);
            const sil = S.silhouette(mask, cw, ch, {});
            let outMass = 0, tot = 0;
            for (let j = 0; j < mask.length; j++) { if (!mask[j]) continue; tot++; if (!mm[j]) outMass++; }
            const cc = S.components(mask, cw, ch);
            return {
              name: r.name,
              hullDeficiency: sil.hullDeficiency, appendages: sil.appendages,
              appendageShare: sil.appendageShare, heightPx: sil.heightPx, areaPx: sil.areaPx,
              islands: cc.sizes.filter((n) => n >= 8).length,
              limbShare: +(outMass / Math.max(1, tot)).toFixed(4),
            };
          });
          const line = out[id][yawDeg].map((r) => `${r.name} ${String(r.hullDeficiency).padStart(6)}/${r.appendages}`).join('  ');
          console.log(`${id.padEnd(12)} yaw ${String(yawDeg).padStart(3)}  ${line}`);
        }
      } catch (e) {
        console.error(`✗ ${id}: ${e}`);
      } finally { if (page) await page.close(); }
    }
  } finally { await browser.close(); }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'stance.json'), JSON.stringify({ candidates: candidates.map((c) => ({ name: c.name, armX: c.armX, hipX: c.hipX })), rows: out }, null, 2));
  console.log(`\nwrote ${OUT}/stance.json`);
}

/**
 * PROPORTION probe — is the silhouette failure a POSE problem or a SIZE problem?
 *
 * The stance sweep answered the first half: rotating the limbs fore/aft is worth
 * 0.00-0.01 of hull deficiency at the shipped facing (soup 0.106 -> 0.093, i.e.
 * WORSE). This sweeps the other hypothesis — that the food mass's projected radius
 * simply exceeds the limb envelope, so no pose can put a limb outside it — by
 * scaling the limb chains, the limb span and the mass itself, live, one axis at a
 * time. Nothing is written to `src/` until a lever is shown to move the number.
 */
async function writeSheet(results, dir, tag) {
  await mkdir(dir, { recursive: true });
  const ok = results.filter((r) => r.rgbb64);
  if (!ok.length) return;
  const H = Math.max(...ok.map((r) => r.crop[3]));
  const W = ok.reduce((s2, r) => s2 + r.crop[2] + 4, 0);
  const buf = Buffer.alloc(W * H * 3, 12);
  let ox = 0;
  for (const r of ok) {
    const [, , cw, ch] = r.crop;
    const rgb = b64ToBytes(r.rgbb64);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const s3 = (y * cw + x) * 3, d = ((y) * W + ox + x) * 3;
      buf[d] = rgb[s3]; buf[d + 1] = rgb[s3 + 1]; buf[d + 2] = rgb[s3 + 2];
    }
    ox += cw + 4;
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(dir, `${tag}.png`));
}

async function modeProto() {
  if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
  const st = STATIONS[STATION];
  const SPEC = get('--spec', null);
  let candidates;
  if (SPEC === 'plant') {
    // ── SPLAY vs SPAN ────────────────────────────────────────────────────────
    // `--spec split` sweeps the hip JOINT's x offset, which moves the top of the
    // leg away from the mass it has to stay attached to — that is the knob whose
    // shoulder twin detaches four of five characters, and on donut and lollipop
    // it is the knob two previous rounds had to move the OTHER way to reattach a
    // leg. This sweeps the alternative: leave the hip pivot where it is and
    // rotate the whole leg outward about z, so only the FOOT travels. The ankle
    // cancels 60% of it for the same reason `rig.ts`'s run branch does — the
    // default foot is a plank hanging below the ankle and it has to stay flat.
    //
    // `hipL` sits at x = -stanceWidth, so a NEGATIVE z swings it outward
    // (`docs/LESSONS.md` §12, stated there for the shoulder twin).
    const splay = (s) => [['hipL', 'z', -s], ['hipR', 'z', s],
      ['kneeL', 'z', -s * 0.25], ['kneeR', 'z', s * 0.25],
      ['footL', 'z', s * 0.6], ['footR', 'z', -s * 0.6]];
    candidates = [{ name: 'base', deltas: [] }];
    for (const sp of [1.3, 1.5]) candidates.push({ name: `stance${sp}`, posMul: [['hipL', 'x', sp], ['hipR', 'x', sp]] });
    for (const s of [0.20, 0.35, 0.50]) candidates.push({ name: `splay${s}`, deltas: splay(s) });
    for (const [sp, s] of [[1.2, 0.25], [1.3, 0.35], [1.5, 0.35], [1.3, 0.50]]) {
      candidates.push({ name: `st${sp}_sp${s}`, posMul: [['hipL', 'x', sp], ['hipR', 'x', sp]], deltas: splay(s) });
    }
  } else if (SPEC === 'split') {
    candidates = [{ name: 'base', deltas: [] }];
    for (const sp of [1.3, 1.6, 1.9, 2.2]) candidates.push({ name: `stance${sp}`, posMul: [['hipL', 'x', sp], ['hipR', 'x', sp]] });
    for (const sp of [1.3, 1.6, 1.9]) candidates.push({ name: `shoulder${sp}`, posMul: [['shoulderL', 'x', sp], ['shoulderR', 'x', sp]] });
    for (const [st2, sh] of [[1.6, 1.3], [1.9, 1.3], [1.9, 1.5], [2.2, 1.5]]) {
      candidates.push({ name: `st${st2}_sh${sh}`, posMul: [['hipL', 'x', st2], ['hipR', 'x', st2], ['shoulderL', 'x', sh], ['shoulderR', 'x', sh]] });
    }
  } else {
    candidates = [{ name: 'base', deltas: [] }];
    for (const k of [1.2, 1.4, 1.6]) candidates.push({ name: `limb${k}`, scales: [['shoulderL', k], ['shoulderR', k], ['hipL', k], ['hipR', k]] });
    for (const sp of [1.4, 1.8, 2.2]) candidates.push({ name: `span${sp}`, posMul: [['shoulderL', 'x', sp], ['shoulderR', 'x', sp], ['hipL', 'x', sp], ['hipR', 'x', sp]] });
    for (const m of [0.92, 0.85, 0.75]) candidates.push({ name: `mass${m}`, scales: [['head', m]] });
    candidates.push({ name: 'limb1.4+span1.8', scales: [['shoulderL', 1.4], ['shoulderR', 1.4], ['hipL', 1.4], ['hipR', 1.4]],
      posMul: [['shoulderL', 'x', 1.8], ['shoulderR', 'x', 1.8], ['hipL', 'x', 1.8], ['hipR', 'x', 1.8]] });
    candidates.push({ name: 'limb1.4+span1.8+mass0.85', scales: [['shoulderL', 1.4], ['shoulderR', 1.4], ['hipL', 1.4], ['hipR', 1.4], ['head', 0.85]],
      posMul: [['shoulderL', 'x', 1.8], ['shoulderR', 'x', 1.8], ['hipL', 'x', 1.8], ['hipR', 'x', 1.8]] });
  }
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = {};
  try {
    for (const id of IDS) {
      let page = null;
      try {
        page = await bootMatch(browser, id, st, 1);
        out[id] = {};
        for (const yawDeg of YAWS) {
          const res = await page.evaluate(SWEEP, { playerId: id, yawDeg, massParts: MASS_PARTS, candidates, shots: SHOTS });
          if (res.error) { console.error(`✗ ${id} yaw${yawDeg}: ${res.error}`); continue; }
          if (SHOTS) await writeSheet(res.results, join(OUT, 'sheets'), `${id}.yaw${yawDeg}`);
          out[id][yawDeg] = res.results.map((r) => {
            if (r.error) return { name: r.name, error: r.error };
            const [, , cw, ch] = r.crop;
            const mask = b64ToBytes(r.maskb64), mm = b64ToBytes(r.massb64);
            const sil = S.silhouette(mask, cw, ch, {});
            let outMass = 0, tot = 0;
            for (let j = 0; j < mask.length; j++) { if (!mask[j]) continue; tot++; if (!mm[j]) outMass++; }
            const cc = S.components(mask, cw, ch);
            return { name: r.name, hullDeficiency: sil.hullDeficiency, appendages: sil.appendages,
              heightPx: sil.heightPx, widthPx: sil.widthPx, aspectWH: +(sil.widthPx / sil.heightPx).toFixed(3),
              islands: cc.sizes.filter((n) => n >= 8).length,
              limbShare: +(outMass / Math.max(1, tot)).toFixed(4) };
          });
          for (const r of out[id][yawDeg]) {
            console.log(`${id.padEnd(12)} yaw ${String(yawDeg).padStart(3)}  ${String(r.name).padEnd(24)} hullDef ${String(r.hullDeficiency).padStart(6)}  app ${String(r.appendages).padStart(2)}  islands ${r.islands}  limbShare ${r.limbShare}  h ${r.heightPx}  w/h ${r.aspectWH}`);
          }
        }
      } catch (e) { console.error(`✗ ${id}: ${e}`); } finally { if (page) await page.close(); }
    }
  } finally { await browser.close(); }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'proto.json'), JSON.stringify(out, null, 2));
  console.log(`\nwrote ${OUT}/proto.json`);
}

// ── Shared with `sepscan.mjs` ────────────────────────────────────────────────
// `docs/LESSONS.md` §5: ONE stale copy of `match-sim`'s driver contaminated ten
// instruments and the audit's own count was wrong by 2x. So the internal-separation
// probe IMPORTS this capture rather than copying it, and this dispatch is guarded so
// importing it does not run a mode.
export { LAUNCH_ARGS, STATIONS, JOINTS, MASS_PARTS, b64ToBytes };

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('limbmatch.mjs');
if (IS_MAIN) {
  if (has('--selftest')) process.exit(selftest());
  else if (MODE === 'proto') await modeProto();
  else if (MODE === 'stance') await modeStance();
  else if (MODE === 'chars') await modeChars();
  else if (MODE === 'ref') await modeRef();
  else if (MODE === 'control') await modeControl();
  else { console.error(`unknown --mode ${MODE}`); process.exit(2); }
}
