#!/usr/bin/env node
/**
 * ca_neckprobe — WHY a joint group delivers zero pixels, and WHAT is in front of it.
 *
 * ── The finding this exists to close out ─────────────────────────────────────
 * `e6fed57` built a neck COLUMN and a dark COLLAR for every character with a torso.
 * At the shipped camera (58°) and the shipped facing (yaw 90) it delivers **0 px** on
 * burrito, sushi and soup against footprints of 565 / 939 / 2199 px.
 *
 * `docs/LESSONS.md` §1 for the nineteenth time — *"it isn't there" means it IS there
 * and is INVISIBLE* — plus §1's own case 17: **a fix for an invisibility bug must be
 * closed out by measuring DELIVERED pixels**, or it silently re-lands in the same class.
 *
 * ── Why `limbmatch` is not enough ────────────────────────────────────────────
 * `limbmatch --mode chars` already reports `foot` and `delivered` per joint, so it can
 * tell you the neck is buried. It cannot tell you WHAT BURIED IT: it keeps only the
 * pixel COUNT of each isolated footprint, never the MASK, and without the mask there is
 * nothing to intersect the owner map with. "The head, probably" is a guess, and on
 * burrito it is the WRONG guess — that character's `dressTorso` lathe runs up past the
 * neck joint (`burrito.ts`: `yTop = headBottomLocal + R * 0.12`), so the occluder is
 * the TORSO. A fix aimed at the head would have measured nothing and looked like the
 * neck was simply unfixable.
 *
 * This probe keeps the mask and intersects it, so the output names the occluder with a
 * pixel count. That turns "make the neck visible" from a taste question into an
 * arithmetic one.
 *
 * ── Shared code, deliberately ────────────────────────────────────────────────
 * The page boot, the launch flags, the station table and the joint list are IMPORTED
 * from `limbmatch.mjs` rather than copied. `docs/LESSONS.md` §5 records one stale COPY
 * of a driver contaminating ten instruments, and `sentinel --mode clone-census` fails a
 * pair over 0.9 similarity. The in-page capture here is a different measurement (one
 * part, masks kept, occluder attribution) and is not a copy of `limbmatch`'s.
 *
 * ── What it prints, per character × yaw ──────────────────────────────────────
 *   foot / delivered / ratio   the same definitions as `limbmatch` (isolate for the
 *                              footprint; frontmost-surface diff for delivered), on the
 *                              same `--ss`, so the numbers are directly comparable.
 *   occluded by                for every footprint pixel NOT delivered, which joint
 *                              group owns that pixel in the assembled character.
 *   offSil                     footprint pixels owned by NOBODY — the part projects
 *                              somewhere the assembled character does not cover at all
 *                              (behind it, or outside the matte). Reported separately;
 *                              folding it into an occluder would accuse an innocent joint.
 *   world Y / X                the part's and the head's world AABBs, because the fix is
 *                              nearly always "the mass hangs over it", which is a number.
 *
 * ⚠️ THE CAMERA IS THE POINT. `limbcheck` measures `preview.html`'s 22° with the subject
 * face-on; idle ranking survives the move to the match camera (ρ 0.927) and **run
 * ranking does not** (ρ 0.673). This drives the real game at the real camera and the
 * real spawn facing, exactly as `limbmatch` does.
 *
 * ── Validation ───────────────────────────────────────────────────────────────
 * `--mode control` is the known-bad input (`CLAUDE.md` rule 6). It renders one
 * character three ways — untouched, with the part translated INTO the food mass, and
 * with it lifted clear above everything — and asserts the metric moves in the known
 * direction each time, INCLUDING a degeneracy guard that the control moved the PART and
 * not the whole character (`sepscan --mode control` came back 5/9 because it had
 * silently changed its subject).
 *
 *   node tools/tmp/headserve.mjs --overlay src/characters -- \
 *     node tools/tmp/ca_neckprobe.mjs --ids burrito,sushi,soup --shots
 *   node tools/tmp/headserve.mjs -- node tools/tmp/ca_neckprobe.mjs --mode control --ids burrito
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { bootMatch, LAUNCH_ARGS, STATIONS, JOINTS } from './limbmatch.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const MODE = get('--mode', 'chars');
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const OUT = get('--out', 'shots/cast2/neck');
const IDS = get('--ids', 'taco,burrito,pizza,sushi,soup,hotdog').split(',');
/** 90 = THE SHIPPED SPAWN FACING (`sim.ts` gives facing {x:1,y:0}; `match.ts` → yaw 90). */
const YAWS = get('--yaws', '90').split(',').map(Number);
const PART = get('--part', 'neck');
const STATION = get('--station', 'pot_south');
const SHOTS = has('--shots');

// ─────────────────────────────────────────────────────────────────────────────
// IN-PAGE CAPTURE. One synchronous evaluate, so no rAF of the game's own loop can
// re-sync `rotation.y` from MatchState between setting it and reading pixels back.
// ─────────────────────────────────────────────────────────────────────────────
const CAPTURE = (opts) => {
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

  let hidden = [];
  const hideEnvironment = (keep) => {
    hidden = [];
    for (const kid of scene.children) {
      if (keep.has(kid)) continue;
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
  /** Two-clear-colour matte — colour-independent by construction. 1 = opaque coverage. */
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

  const res = { buffer: [Wp, Hp] };
  const moved = [];
  try {
    const player = casts.find((c) => c.name === `character:${opts.playerId}`) ?? casts[0];
    res.player = player.name;
    res.playerPick = player.name === `character:${opts.playerId}` ? 'name' : 'largest (FALLBACK)';
    res.nativeYawDeg = +((player.rotation.y * 180) / Math.PI).toFixed(1);
    if (opts.yawDeg != null) {
      for (const c of casts) { c.rotation.y = (opts.yawDeg * Math.PI) / 180; c.updateMatrixWorld(true); }
    }
    res.yawDeg = opts.yawDeg == null ? res.nativeYawDeg : opts.yawDeg;

    // ── THE KNOWN-BAD INPUT, applied BEFORE anything is measured ─────────────
    // `bury` puts the part at the food mass's own centre (it must read ~0 delivered and
    // NAME an occluder); `lift` puts it 1.2 m above everything (it must deliver most of
    // its footprint and name none). Applied here rather than after the crop is solved:
    // `limbmatch` records that applying a control after the crop put a flung limb
    // OUTSIDE the measured rect and reported a footprint of ZERO — the validation
    // harness committing the exact fault it exists to validate against.
    if (opts.control && opts.control !== 'none') {
      const j = player.getObjectByName(opts.part);
      const head = player.getObjectByName('head');
      if (j && head) {
        // ⚠️ MOVE THE PART'S OWN MESHES, NOT THE JOINT. The first version moved the
        // joint, and `rig.ts` parents the head UNDER the neck (`neck.add(head)`), so
        // "lift the neck 1.2 m" lifted the food mass with it and the column stayed
        // exactly as buried as before: the control read `lift` ratio **0.006** with
        // occluder `{head: 626}` — a refusal that was entirely the harness's. That is
        // `docs/LESSONS.md` §13's shape (a control that describes a different
        // experiment) and the third time a control harness on this project has encoded
        // an assumption about its subject rather than a property of the transform.
        // Moving the meshes leaves the hierarchy alone, so the occluders stay put and
        // only the thing under test moves.
        const V3 = j.position.constructor;
        const w = new V3();
        const hw = new V3();
        // ⚠️ AND `bury` HAS TO SHRINK, NOT MERELY TRANSLATE — proved twice on this
        // harness itself. Putting taco's collar at the HEAD's centre made it deliver
        // MORE (782 -> 1449 px), because a taco shell is a folded OPEN form whose
        // centre is air. Moving the burial site to the torso changed the number by
        // EXACTLY NOTHING, because the collar's own radius (0.25 m) exceeds the torso's
        // half-width, so the ring pokes out all the way round wherever it is put.
        //
        // "Inside a closed convex mass" is the only condition under which zero delivery
        // is true BY CONSTRUCTION, so the part's meshes are scaled into the torso's own
        // bounding sphere as well as moved to its centre. The degeneracy guard above
        // still watches the whole-character footprint, and this moves it by the target's
        // own share (taco's neck is 2168 px of 24301, 9%) and no more.
        const own = [];
        j.traverse((o) => {
          if (!o.isMesh || !o.visible) return;
          let n = o.parent, mine = false;
          while (n && n !== player) {
            if (n === j) { mine = true; break; }
            if (opts.jointNames.includes(n.name)) break;
            n = n.parent;
          }
          if (mine) own.push(o);
        });
        const worldR = (o) => {
          if (!o.geometry) return 0;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          const s = o.geometry.boundingSphere;
          if (!s) return 0;
          const ws = new V3();
          o.getWorldScale(ws);
          return s.radius * Math.max(ws.x, Math.max(ws.y, ws.z));
        };
        // ⚠️ NOT `getObjectByName('torso_mesh')`. `rig.dressTorso()` DELETES that mesh
        // (`rig.ts:947-951`) whenever a character replaces the default barrel — which
        // taco, burrito, sushi and soup all do — so the lookup returned undefined, the
        // burial site silently fell back to the head, `shrink` stayed 1, and the run
        // was byte-for-byte the failure it was supposed to fix. A control that falls
        // back silently is the same fault as a mutation harness that SKIPS a missing
        // anchor instead of throwing. Take the biggest mesh the torso JOINT actually
        // owns instead, whatever it is called.
        const torsoJoint = player.getObjectByName('torso');
        let burialMesh = null, burialR = 0;
        if (torsoJoint) {
          torsoJoint.traverse((o) => {
            if (!o.isMesh || !o.visible) return;
            let n = o.parent, mine = false;
            while (n && n !== player) {
              if (n === torsoJoint) { mine = true; break; }
              if (opts.jointNames.includes(n.name)) break;
              n = n.parent;
            }
            if (!mine) return;
            const rr = worldR(o);
            if (rr > burialR) { burialR = rr; burialMesh = o; }
          });
        }
        const burialSite = burialMesh || head;
        burialSite.getWorldPosition(hw);
        let shrink = 1;
        if (opts.control === 'bury' && burialMesh) {
          const partR = own.reduce((mx, o) => Math.max(mx, worldR(o)), 0);
          if (burialR > 0 && partR > 0) shrink = Math.min(1, (0.30 * burialR) / partR);
        }
        res.buryShrink = +shrink.toFixed(4);
        res.burySite = burialMesh ? (burialMesh.name || '(unnamed torso mesh)') : 'head (NO TORSO MESH FOUND)';
        for (const m of own) {
          moved.push({ obj: m, pos: m.position.clone(), scale: m.scale.clone() });
          m.getWorldPosition(w);
          if (opts.control === 'bury') { w.copy(hw); m.scale.multiplyScalar(shrink); }
          else w.y += 1.2;
          m.parent.worldToLocal(w);
          m.position.copy(w);
        }
        res.controlMeshes = own.length;
        player.updateMatrixWorld(true);
      } else res.controlError = `part ${opts.part} or head not found`;
      res.control = opts.control;
    }

    hideEnvironment(new Set([topOf(player)]));
    const otherCast = [];
    for (const o of casts) { if (o !== player && o.visible) { otherCast.push(o); o.visible = false; } }

    // ── CROP FIRST. A full 3200x1800 readback is 23 MB and this probe takes ~40 of
    //    them per character; the crop is ~1 MB. The crop is solved from the WHOLE-BUFFER
    //    matte, which is the only render taken at full size.
    const full = matteRect(0, 0, Wp, Hp);
    let bx = 1e9, by = 1e9, bx1 = -1, by1 = -1;
    for (let j = 0; j < full.length; j++) {
      if (!full[j]) continue;
      const x = j % Wp, y = (j / Wp) | 0;
      if (x < bx) bx = x; if (x > bx1) bx1 = x;
      if (y < by) by = y; if (y > by1) by1 = y;
    }
    if (bx1 < 0) return { error: 'the player character has ZERO on-screen pixels' };
    const pad = 12;
    const cx = Math.max(0, bx - pad), cy = Math.max(0, by - pad);
    const cw = Math.min(Wp - cx, bx1 - bx + 1 + pad * 2), ch = Math.min(Hp - cy, by1 - by + 1 + pad * 2);
    res.crop = [cx, cy, cw, ch];
    res.charHeightPx = by1 - by + 1;

    const base = matteRect(cx, cy, cw, ch);
    const baseDirect = directRect(cx, cy, cw, ch);

    const allMeshes = [];
    player.traverse((o) => { if (o.isMesh) allMeshes.push(o); });
    const allPrev = allMeshes.map((m) => m.visible);

    // A mesh belongs to the NEAREST named joint above it, so `neck` owns the column and
    // the collar and NOT the head mass hanging off it. Same rule as `limbmatch` and
    // `valuescan`, so the part names mean the same thing in all three tables.
    const ownOf = (jt) => {
      const own = [];
      jt.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        let n = o.parent, mine = false;
        while (n && n !== player) {
          if (n === jt) { mine = true; break; }
          if (opts.jointNames.includes(n.name)) break;
          n = n.parent;
        }
        if (mine) own.push(o);
      });
      return own;
    };

    const groups = [];
    let target = null;
    for (const name of opts.jointNames) {
      const jt = player.getObjectByName(name);
      if (!jt) continue;
      const own = ownOf(jt);
      if (!own.length) continue;
      const ownSet = new Set(own);

      // DELIVERED = pixels whose colour changes when this group is hidden.
      const prev = own.map((m) => m.visible);
      own.forEach((m) => { m.visible = false; });
      const hid = directRect(cx, cy, cw, ch);
      own.forEach((m, i) => { m.visible = prev[i]; });
      const delivered = new Uint8Array(cw * ch);
      let dn = 0;
      for (let k = 0; k < delivered.length; k++) {
        if (!base[k]) continue;
        const i4 = k * 4;
        const d = Math.abs(baseDirect[i4] - hid[i4]) + Math.abs(baseDirect[i4 + 1] - hid[i4 + 1])
          + Math.abs(baseDirect[i4 + 2] - hid[i4 + 2]);
        if (d > 12) { delivered[k] = 1; dn++; }
      }

      // FOOTPRINT = the same group rendered ALONE. Only the TARGET keeps its mask —
      // that mask is the one thing `limbmatch` throws away and the only thing that can
      // be intersected with the owner map.
      allMeshes.forEach((m, i) => { m.visible = ownSet.has(m) && allPrev[i]; });
      const iso = matteRect(cx, cy, cw, ch);
      allMeshes.forEach((m, i) => { m.visible = allPrev[i]; });
      let fn = 0;
      for (let k = 0; k < iso.length; k++) fn += iso[k];

      const g = { name, delivered, dn, fn };
      if (name === opts.part) { g.iso = iso; target = g; }
      groups.push(g);
    }

    for (const o of otherCast) o.visible = true;
    restoreEnvironment();

    const owner = new Int16Array(cw * ch).fill(-1);
    groups.forEach((g, i) => { for (let k = 0; k < g.delivered.length; k++) if (g.delivered[k]) owner[k] = i; });

    res.parts = groups.map((g) => ({ part: g.name, foot: g.fn, delivered: g.dn, ratio: g.fn ? +(g.dn / g.fn).toFixed(3) : null }));
    if (!target) { res.missing = opts.part; return res; }

    // ── THE ANSWER: who owns the footprint pixels the part did not deliver ────
    const occl = {};
    let unowned = 0, own = 0;
    for (let k = 0; k < target.iso.length; k++) {
      if (!target.iso[k]) continue;
      if (target.delivered[k]) { own++; continue; }
      const o = owner[k];
      if (o < 0) { unowned++; continue; }
      occl[groups[o].name] = (occl[groups[o].name] || 0) + 1;
    }
    res.target = {
      part: opts.part, foot: target.fn, delivered: target.dn,
      ratio: target.fn ? +(target.dn / target.fn).toFixed(3) : null,
      footDelivered: own, occludedBy: occl, offSilhouette: unowned,
    };

    // ── GEOMETRY, because the fix is usually a number ────────────────────────
    // World AABB over a joint's OWN meshes, from each geometry's bounding box pushed
    // through `matrixWorld`. Built by hand because `THREE.Box3` is not reachable here.
    const V3c = player.position.constructor;
    const box = (nm) => {
      const jt = player.getObjectByName(nm);
      if (!jt) return null;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      let any = false;
      for (const m of ownOf(jt)) {
        const g = m.geometry;
        if (!g) continue;
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox;
        if (!bb) continue;
        m.updateWorldMatrix(true, false);
        for (let i = 0; i < 8; i++) {
          const p = new V3c(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z)
            .applyMatrix4(m.matrixWorld);
          const c = [p.x, p.y, p.z];
          for (let k = 0; k < 3; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; }
          any = true;
        }
      }
      if (!any) return null;
      return { x0: +lo[0].toFixed(4), x1: +hi[0].toFixed(4), y0: +lo[1].toFixed(4), y1: +hi[1].toFixed(4), z0: +lo[2].toFixed(4), z1: +hi[2].toFixed(4) };
    };
    res.world = { part: box(opts.part), head: box('head'), face: box('face'), torso: box('torso') };

    // ── HOW WIDE WOULD THE COLLAR HAVE TO BE TO BE SEEN AT ALL? ──────────────
    // This is the number that turns "make the neck reach the screen" from a taste
    // question into arithmetic, and it is not the naive one.
    //
    // The camera is pitched **58° below horizontal** (`render/camera.ts:265`), so a ray
    // leaving a point on the collar toward the camera rises 1 m for every
    // `1/tan(58°) = 0.625 m` it travels horizontally. A ring of radius `r` at height
    // `y0` is therefore hidden by ANY food-mass vertex above it whose own radius `R`
    // satisfies `R >= r + 0.625 * (y - y0)`. Being merely wider than the mass AT ITS
    // OWN HEIGHT is not enough — the overhang above it does the occluding.
    //
    //   requiredR = max over head vertices above the collar of  ( R - 0.625 * Δy )
    //
    // Taken over the RADIUS rather than along one azimuth, because the ring has to
    // clear from every facing the match can present. That makes it an upper bound, and
    // an upper bound is the right side to err on when the answer decides whether a
    // piece of geometry is dead.
    {
      const TAN58 = Math.tan((58 * Math.PI) / 180);
      const jt = player.getObjectByName(opts.part);
      const collar = jt && (jt.getObjectByName('neck_collar') || jt);
      const head = player.getObjectByName('head');
      const pb = res.world.part;
      if (collar && head && pb) {
        // The axis: the part joint's own world position, not the head's centre — a
        // character whose mass is offset from the spine (burrito's is, by 0.076 m)
        // would otherwise be measured against the wrong centre.
        const c = new V3c();
        jt.getWorldPosition(c);
        const y0 = pb.y1;                      // the TOP of the collar — the worst case
        let need = -Infinity, maxR = 0, n = 0;
        for (const m of ownOf(head)) {
          const g = m.geometry;
          const pos = g && g.attributes && g.attributes.position;
          if (!pos) continue;
          m.updateWorldMatrix(true, false);
          const stride = pos.count > 60000 ? 3 : 1;
          for (let i = 0; i < pos.count; i += stride) {
            const p = new V3c(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld);
            const R = Math.hypot(p.x - c.x, p.z - c.z);
            if (R > maxR) maxR = R;
            if (p.y <= y0) continue;
            const cand = R - (p.y - y0) / TAN58;
            if (cand > need) need = cand;
            n++;
          }
        }
        const curR = Math.max(Math.abs(pb.x1 - c.x), Math.abs(c.x - pb.x0));
        res.collarFit = {
          collarTopY: +y0.toFixed(4),
          currentR: +curR.toFixed(4),
          requiredR: need === -Infinity ? null : +need.toFixed(4),
          headMaxR: +maxR.toFixed(4),
          vertsAbove: n,
          factor: need === -Infinity || curR <= 0 ? null : +(need / curR).toFixed(2),
          // A collar that has to be most of the mass's own width is no longer a notch
          // under the chin; it IS the silhouette. Reported as a ratio so the judgement
          // is explicit rather than buried in a metre value.
          shareOfMass: need === -Infinity || maxR <= 0 ? null : +(need / maxR).toFixed(2),
        };
      }
    }

    if (opts.wantShots) {
      // The footprint painted over the SHIPPED frame: green = delivered, red = buried.
      // `docs/LESSONS.md` rule 3 — judge rendered pixels, and a count of zero is exactly
      // the kind of number that has to be looked at before it is believed.
      stage.render(0); stage.render(0);
      const shipped = readRect(cx, cy, cw, ch);
      const rgb = new Uint8Array(cw * ch * 3);
      for (let k = 0; k < cw * ch; k++) {
        rgb[k * 3] = shipped[k * 4]; rgb[k * 3 + 1] = shipped[k * 4 + 1]; rgb[k * 3 + 2] = shipped[k * 4 + 2];
        if (target.iso[k]) {
          const on = target.delivered[k];
          rgb[k * 3] = on ? 0 : 255; rgb[k * 3 + 1] = on ? 255 : 0; rgb[k * 3 + 2] = 0;
        }
      }
      res.overlayb64 = b64(rgb);
      res.overlayWH = [cw, ch];
    }
  } finally {
    // Restore the SCALE as well as the position — `bury` now changes both, and a
    // control that leaves the subject altered contaminates every later capture on the
    // same page. (This process opens a fresh page per capture, so it has never bitten;
    // it is restored anyway because the next caller may not.)
    for (const m of moved) { m.obj.position.copy(m.pos); if (m.scale) m.obj.scale.copy(m.scale); }
    restoreEnvironment();
  }
  return res;
};

async function shoot(browser, id, yaw, control) {
  const st = STATIONS[STATION];
  if (!st) throw new Error(`no station ${STATION}`);
  const page = await bootMatch(browser, id, st);
  try {
    return await page.evaluate(CAPTURE, { playerId: id, yawDeg: yaw, part: PART, jointNames: JOINTS, control, wantShots: SHOTS });
  } finally { await page.close().catch(() => {}); }
}

if (!BASE) {
  console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs or with_snapshot.mjs');
  process.exit(2);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
let bad = 0;
try {
  if (MODE === 'control') {
    const id = IDS[0];
    console.log(`\nca_neckprobe --mode control on ${id}, part '${PART}' — answers known by construction\n`);
    const N = await shoot(browser, id, YAWS[0], 'none');
    const B = await shoot(browser, id, YAWS[0], 'bury');
    const L = await shoot(browser, id, YAWS[0], 'lift');
    for (const [nm, r] of [['none', N], ['bury', B], ['lift', L]]) {
      if (r.error || !r.target) { console.log(`  ${nm}: ERROR ${r.error ?? `no '${PART}' group`}`); bad++; continue; }
      console.log(`  ${nm.padEnd(6)} foot ${String(r.target.foot).padStart(6)}  delivered ${String(r.target.delivered).padStart(6)}`
        + `  ratio ${String(r.target.ratio).padStart(6)}  occluders ${JSON.stringify(r.target.occludedBy)}  offSil ${r.target.offSilhouette}`
        + (nm === 'bury' ? `  site ${r.burySite} shrink ${r.buryShrink}` : ''));
    }
    if (!N.target || !B.target || !L.target) { console.log('\ncontrol ABORTED — a run produced no target group\n'); process.exit(1); }
    const checks = [];
    const ck = (name, cond, detail) => { checks.push({ name, cond, detail }); if (!cond) bad++; };
    const tot = (r) => r.parts.reduce((s, p) => s + p.foot, 0);
    // 1. DEGENERACY GUARD FIRST. `sepscan --mode control` came back 5/9 because the
    //    control had changed the SUBJECT (shrinking a STUB's head shrinks the whole
    //    character), so three "failures" were describing a different experiment.
    ck('the control moved the PART, not the character', Math.abs(tot(B) - tot(N)) < 0.35 * tot(N), `total footprint ${tot(N)} -> ${tot(B)}`);
    // ── AND THE SUBJECT GUARD. Running `bury` on a part that ALREADY delivers zero
    //    proves nothing: every assertion below passes for free and the harness reports
    //    a green control over an experiment it never performed. Burrito is exactly that
    //    subject (its neck is 0/564 untouched), which is why the control defaults to a
    //    character whose neck DOES reach the screen.
    ck('UNTOUCHED delivers pixels — otherwise nothing below is a test', N.target.delivered > 0,
      `untouched delivered ${N.target.delivered} of ${N.target.foot}`);
    ck('BURIED delivers ~nothing', B.target.delivered <= Math.max(4, 0.05 * Math.max(1, B.target.foot)), `${B.target.delivered} of ${B.target.foot}`);
    ck('BURIED still HAS a footprint (there, and invisible)', B.target.foot > 0, `foot ${B.target.foot}`);
    ck('BURIED names an occluder rather than nothing', Object.keys(B.target.occludedBy).length > 0, JSON.stringify(B.target.occludedBy));
    ck('LIFTED delivers most of its footprint', L.target.ratio != null && L.target.ratio > 0.7, `ratio ${L.target.ratio}`);
    ck('LIFTED names ~no occluder', Object.values(L.target.occludedBy).reduce((s, v) => s + v, 0) <= 0.05 * L.target.foot, JSON.stringify(L.target.occludedBy));
    ck('ORDER: buried ratio < lifted ratio', (B.target.ratio ?? 0) < (L.target.ratio ?? 0), `${B.target.ratio} < ${L.target.ratio}`);
    console.log('');
    for (const c of checks) console.log(`  ${c.cond ? '✓' : '✗'} ${c.name.padEnd(50)} ${c.detail}`);
    console.log(`\n${checks.filter((c) => c.cond).length}/${checks.length} control assertions passed\n`);
  } else {
    console.log(`\nca_neckprobe — part '${PART}', match camera, station ${STATION}, yaws ${YAWS.join(',')}\n`);
    const results = {};
    for (const id of IDS) {
      results[id] = {};
      for (const yaw of YAWS) {
        const r = await shoot(browser, id, yaw, 'none');
        results[id][yaw] = { target: r.target, world: r.world, parts: r.parts, error: r.error, charHeightPx: r.charHeightPx };
        if (r.error) { console.log(`${id.padEnd(12)} yaw ${String(yaw).padStart(3)}  ERROR ${r.error}`); bad++; continue; }
        if (!r.target) { console.log(`${id.padEnd(12)} yaw ${String(yaw).padStart(3)}  NO '${PART}' GROUP — this character does not build one`); continue; }
        const t = r.target;
        const occ = Object.entries(t.occludedBy).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
        console.log(`${id.padEnd(12)} yaw ${String(yaw).padStart(3)}  foot ${String(t.foot).padStart(5)}  delivered ${String(t.delivered).padStart(5)}`
          + `  ratio ${String(t.ratio).padStart(6)}  offSil ${String(t.offSilhouette).padStart(5)}  occluded by: ${occ}`);
        const w = r.world;
        if (w && w.part && w.head) {
          console.log(`${' '.repeat(12)}          world Y  ${PART} ${w.part.y0}..${w.part.y1}   head ${w.head.y0}..${w.head.y1}`
            + `   the head hangs ${(w.part.y1 - w.head.y0).toFixed(4)} m BELOW the ${PART}'s top`);
          console.log(`${' '.repeat(12)}          world X  ${PART} ${w.part.x0}..${w.part.x1}   head ${w.head.x0}..${w.head.x1}`
            + (w.torso ? `   torso ${w.torso.x0}..${w.torso.x1} / Y ${w.torso.y0}..${w.torso.y1}` : ''));
        }
        const cf = r.collarFit;
        if (cf) {
          console.log(`${' '.repeat(12)}          COLLAR FIT  current r ${cf.currentR}  REQUIRED r ${cf.requiredR}`
            + `  (x${cf.factor})  headMaxR ${cf.headMaxR}  requiredR is ${cf.shareOfMass} of the mass's own radius`);
        }
        if (SHOTS && r.overlayb64) {
          const [cw, ch] = r.overlayWH;
          await sharp(Buffer.from(r.overlayb64, 'base64'), { raw: { width: cw, height: ch, channels: 3 } })
            .png().toFile(join(OUT, `${id}_yaw${yaw}_${PART}.png`));
        }
      }
    }
    await writeFile(join(OUT, `${PART}.json`), JSON.stringify(results, null, 2));
    console.log(`\nwrote ${OUT}/${PART}.json`);
  }
} finally { await browser.close(); }
process.exit(bad ? 1 : 0);
