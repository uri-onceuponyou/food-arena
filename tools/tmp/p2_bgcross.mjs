#!/usr/bin/env node
/**
 * PROJECTILE × SURFACE — the same weapon, the same frozen frame, TWO backgrounds.
 *
 * ── WHY THIS EXISTS, AND WHY `pj_probe` COULD NOT ANSWER IT ────────────────────
 *
 * `tools/tmp/pj_probe.mjs` is a good instrument and this file reuses its ablation
 * math verbatim. But it fires every weapon in ONE direction — `at.x + 320` px, always
 * +X on screen — so all 23 weapons are measured over ONE trajectory, which on this
 * arena is rose tile and a teal mat. Its own registering commit says so, and the brief
 * that dispatched this pass repeats it: *"the flight was measured over rose tile and a
 * teal mat only — not every arena surface."*
 *
 * That stopped being a footnote on 2026-08-11, when `b9bc00e` gave the arena **six
 * concealment patches** (`arena/kitchen.ts`, `conceal:*`). Each is a 110–130 wu
 * (5.5–6.5 m) CREAM GROUND CLOTH — `shared.ts:concealCloth` **#E9DCC0**, crockery on it
 * at `concealPlate` **#F7F1E4**, rim `concealClothRim` #C29A5E. And SEVEN of the 23
 * ranged weapons are pale cream or pale gold:
 *
 *     pizza.Dough #FFE9A8   soup.Noodle #FFE9A8   egg.Hatch  #FFE9A8
 *     burrito.Disc #F4E9DA  egg.Shards  #F4E9DA   sushi.Rice #FFFFFF
 *     pizza.Cheese #FFD873
 *
 * `#FFE9A8` is hue 44.8 and `#E9DCC0` is hue 41.0 — **3.8 degrees apart**, and both sit
 * above 0.83 HSL lightness. That is the `b967242` mechanism (a trail 0.7 deg from the
 * floor it lay on) with a projectile in the trail's place, and NO instrument in this
 * repo could see it, because no measured flight has ever crossed one of these patches.
 *
 * ⚠️ It also matters that the shipped legibility halo cannot rescue them:
 * `game/vfx.ts:PROJECTILE_HALO_L` is 0.66 and is applied with `Math.max` — a **floor
 * with no ceiling**. A weapon already at 0.83 gets a halo of its own pale colour. The
 * treatment that saved the dark weapons is a no-op for exactly the weapons this file
 * is about.
 *
 * ── THE METHOD: MOVE THE SURFACE, NOT THE PROJECTILE ───────────────────────────
 *
 * One frozen mid-flight frame. The projectile is NOT touched — not moved, not
 * recoloured, not rescaled — so its pixels are the shipped ones under the shipped
 * lighting at the shipped screen position. Instead ONE `conceal:*` group is translated
 * so its centre lands under the projectile's own ground point, the frame is re-rendered,
 * and the SAME same-frame ablation runs again.
 *
 * Exactly one variable changes: what is behind the projectile.
 *
 * ⚠️ Moving the MESH cannot change the game. `movement.ts:isConcealed` tests the
 * `ConcealBox[]` DATA list built alongside the group, never the Object3D — and the sim
 * clock is frozen anyway. The group is restored before the clock resumes, and
 * `RESTORE` below asserts the restoration is bit-identical rather than assuming it.
 *
 * ── CONTROLS (an instrument not shown to FAIL on a known input is not an instrument)
 *
 *   N   sample size          >= 20 delivered px, or every column below is edge pixels.
 *   A   projectile hidden    -> the ablation must find 0 px, at BOTH stations.
 *   SWAP  🚨 THE LOAD-BEARING ONE. At the `cloth` station, with the projectile hidden,
 *         the background under the projectile's own mask must MEASURE as the cloth:
 *         hue within 12 deg of the cloth's own rendered hue and luma within 0.06. This
 *         is what makes "we measured it over cream" falsifiable. Without it a patch
 *         that silently failed to move would produce a full set of confident numbers
 *         identical to `home` — and "the two stations agree" is exactly what a real
 *         null result looks like.
 *   DIFF  the same claim from the other side: the background under the shot must no
 *         longer measure as the one it was at `home`. SWAP alone could be satisfied by
 *         a patch that moved to the wrong place over a surface that happens to match.
 *   RESTORE  after the patch is moved back, re-measuring `home` must be EXACTLY the
 *         first `home` measurement (n, dL, dE, hue). Proves the translation is lossless
 *         and that station order cannot contaminate a run.
 *   PAIR  two measurements of one frozen station must be identical to 0.000000, not
 *         merely close. `a1a85e5` made this achievable; before it, camera shake
 *         re-randomised on every `render()` at dt = 0.
 *   KB    known-bad: paint the SCULPT the cloth's own measured colour at the cloth
 *         station and require dE to collapse by >= 2x. Run with the halo hidden, for
 *         the reason `pj_probe`'s control C records: the halo's texture is a value
 *         MULTIPLIER, so a halo painted the background's colour still draws its rim.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/p2_bgcross.mjs --url {URL}
 *   node tools/tmp/p2_bgcross.mjs --url $U --chars pizza --weapon Dough --shots
 *   node tools/tmp/p2_bgcross.mjs --url $U --chars pizza --weapon Dough --selftest
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
const OUT = String(args.out ?? 'shots/p2/bgcross');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Same 6 as `pj_probe`/`trail_probe`/`vfx_wcov`, so areas stay comparable to theirs. */
const DELTA = Number(args.delta ?? 6);
const SIM_SPEED = String(args.simSpeed ?? '0.35');
/** Clear of the shooter's own silhouette at every framing here — `pj_probe`'s note. */
const MIN_DIST = Number(args.minDist ?? 26);
/**
 * The candidate CEILING for `game/vfx.ts:PROJECTILE_HALO_L`, measured but not applied —
 * see `haloClamp`. 0.68 is chosen to be the smallest value that is still >= the existing
 * 0.66 FLOOR, so the candidate provably cannot darken any weapon the floor currently
 * lifts: only weapons whose own lightness already exceeds 0.68 move at all.
 */
const HALO_L_MAX = Number(args.haloL ?? 0.68);
/** Hold the clamped halo on screen long enough to screenshot it — see `haloClamp`. */
const HOLD_CLAMP = !!args.holdClamp;
const SHOTS = !!args.shots;
const REPO = resolve(new URL('../..', import.meta.url).pathname);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);

/** `rules.ts` parsed, not imported — same reason `pj_probe` gives: it is TypeScript. */
const SELF = new URL(import.meta.url).pathname.split('/').pop();

async function rangedWeapons() {
  const src = await readFile(resolve(REPO, 'src/game/rules.ts'), 'utf8');
  const out = new Map();
  // 🚨 `defineCharacter(` IS NOT OPTIONAL SUGAR HERE — IT IS WHY THIS TOOL MEASURED
  // NOTHING FOR A WEEK. On 2026-08-12 (`9cb34ab`) the roster changed from `soup: {` to
  // `soup: defineCharacter({`. The old pattern `/^ {2}(\w+): \{$/gm` then matched SIX
  // blocks, none of them a character and none carrying `weapons: [`, so the table came
  // back EMPTY and every per-character loop below iterated zero times — silently, at
  // exit 0. Accept both spellings, because the next refactor will invent a third.
  const charRe = /^ {2}(\w+): (?:\w+\()?\{$/gm;
  const chars = [];
  let m;
  while ((m = charRe.exec(src))) chars.push({ id: m[1], at: m.index });
  for (let i = 0; i < chars.length; i++) {
    const body = src.slice(chars[i].at, i + 1 < chars.length ? chars[i + 1].at : src.length);
    const wStart = body.indexOf('weapons: [');
    if (wStart < 0) continue;
    const weapons = [];
    const keyRe = /key: '([^']+)',\s*name: '([^']+)',\s*type: '(\w+)'/g;
    const seg = body.slice(wStart);
    let k;
    while ((k = keyRe.exec(seg))) {
      const after = seg.slice(k.index, k.index + 700);
      const c = /color: '(#[0-9A-Fa-f]{6})'/.exec(after);
      weapons.push({ key: k[1], name: k[2], type: k[3], color: c ? c[1].toUpperCase() : null });
      if (weapons.length >= 4) break;
    }
    if (weapons.length) out.set(chars[i].id, weapons);
  }
  // ── 🚨 A PARSE THAT FINDS NOTHING MUST THROW, NOT RETURN EMPTY ────────────────
  // The comment at the top of this function guards against a STALE weapon table —
  // "exactly how a probe measures a game that no longer exists". It had no guard
  // against an ABSENT one, which is the same failure with none of the symptoms:
  // `for (const x of [])` runs zero times and `[].every()` returns TRUE, so an empty
  // table reads as a clean pass in every consumer. That is `CLAUDE.md` rule 6's
  // vacuity class, and it took out THREE tools at once (`pj_probe`, `p2_bgcross`,
  // `hl_sweep`) because they share this parser by copy.
  //
  // The cross-check is INDEPENDENT of the regex above on purpose: `weapons: [` is
  // counted straight out of the source, so a regex that silently stops matching
  // cannot also silently move the expectation. Assert NON-EMPTY first, then equal —
  // an equality check alone would pass 0 === 0 if the file were ever unreadable.
  const expected = (src.match(/weapons: \[/g) ?? []).length;
  if (out.size === 0) {
    throw new Error(
      `${SELF}: parsed ZERO characters out of src/game/rules.ts (expected ${expected}). ` +
      'The roster spelling has changed under this regex. Refusing to run: an empty table ' +
      'makes every check below pass vacuously. Fix `charRe`, do not delete this guard.');
  }
  if (out.size !== expected) {
    throw new Error(
      `${SELF}: parsed ${out.size} characters but rules.ts has ${expected} \`weapons: [\` ` +
      'blocks. A character is being silently dropped.');
  }
  return out;
}

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
    };
    // Freezing the CLOCK is not freezing the LOOP — `docs/AGENT-BRIEF.md` §3. Hold the
    // rAF callback rather than dropping it, so the loop can resume where it was.
    const rafReal = window.requestAnimationFrame.bind(window);
    let held = null;
    window.requestAnimationFrame = (cb) => {
      if (held !== null) { held = cb; return -1; }
      return rafReal(cb);
    };
    window.__raf = {
      stop() { if (held === null) held = false; },
      start() { const cb = held; held = null; if (typeof cb === 'function') rafReal(cb); },
    };
  });
}

/* eslint-disable */
async function installHarness(page) {
  await page.evaluate(([rw, rh, delta]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const c2d = cv.getContext('2d', { willReadFrequently: true });

    // A frozen frame is not a frozen camera unless the shake is explicitly zeroed
    // (`a1a85e5` fixed the re-randomisation at dt = 0; this is belt and braces, and it
    // is what lets `PAIR` demand 0.000000 instead of "small").
    const stillCamera = () => {
      const rig = stage.rig;
      if (!rig) return;
      rig.shakeAmount = 0;
      if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
    };
    const grab = () => {
      stillCamera();
      stage.render(0);
      c2d.clearRect(0, 0, rw, rh);
      c2d.drawImage(stage.canvas, 0, 0, rw, rh);
      return c2d.getImageData(0, 0, rw, rh).data;
    };

    // Identical to `pj_probe`'s / `trail_probe`'s / `vfx_hue`'s, deliberately: the hue
    // contract's numbers were produced by this formula and these must be comparable.
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
    const oklab = (r, g, b) => {
      const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const R = lin(r), G = lin(g), B = lin(b);
      const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
      const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
      const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
      return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 0.2428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
      ];
    };
    const stats = (img, idx) => {
      let sx = 0, sy = 0, ssum = 0, lsum = 0;
      for (const p of idx) {
        const i = p * 4;
        const [h, s, l] = hsl(img[i], img[i + 1], img[i + 2]);
        const a = (h * Math.PI) / 180;
        sx += Math.cos(a) * s; sy += Math.sin(a) * s;
        ssum += s; lsum += l;
      }
      const n = idx.length || 1;
      let hm = (Math.atan2(sy, sx) * 180) / Math.PI; if (hm < 0) hm += 360;
      return { n: idx.length, hue: +hm.toFixed(1), sat: +(ssum / n).toFixed(3), luma: +(lsum / n).toFixed(4) };
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

    // PER-PIXEL separation from the LOCAL background. `|mean − mean|` cancels on any
    // object with a bright core and a dark rim — which every projectile here now is,
    // because the shipped halo ends in a dark contour. `pj_probe` records the same.
    const localDelta = (imgOn, imgOff, idx) => {
      const inSet = toSet(idx);
      const R = 5;
      const lVals = [], eVals = [];
      for (const p of idx) {
        const x = p % rw, y = (p / rw) | 0;
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= rh) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= rw) continue;
            const q = yy * rw + xx;
            if (inSet[q]) continue;
            const j = q * 4;
            sr += imgOff[j]; sg += imgOff[j + 1]; sb += imgOff[j + 2]; n++;
          }
        }
        if (!n) continue;
        const i = p * 4;
        const a = oklab(imgOn[i], imgOn[i + 1], imgOn[i + 2]);
        const b = oklab(sr / n, sg / n, sb / n);
        eVals.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
        lVals.push(Math.abs(hsl(imgOn[i], imgOn[i + 1], imgOn[i + 2])[2] - hsl(sr / n, sg / n, sb / n)[2]));
      }
      if (!eVals.length) return { mean: 0, p90: 0, deMean: 0, deP90: 0, deMed: 0 };
      const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
      const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      return {
        mean: +avg(lVals).toFixed(4), p90: +q(lVals, 0.9).toFixed(4),
        deMean: +avg(eVals).toFixed(4), deP90: +q(eVals, 0.9).toFixed(4), deMed: +q(eVals, 0.5).toFixed(4),
      };
    };

    const projRoots = () => {
      const layer = window.__vfxLayer;
      if (!layer || !layer.projectilePool) return [];
      const out = [...layer.projectilePool.values()].filter((o) => o.visible);
      const seen = new Set(out);
      let layerRoot = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layerRoot = o; });
      if (layerRoot) {
        layerRoot.traverse((o) => {
          if (typeof o.name === 'string' && o.name.startsWith('projectile') && o.visible && !seen.has(o)) {
            if (!seen.has(o.parent) && (!o.parent || !String(o.parent.name || '').startsWith('projectile'))) {
              seen.add(o); out.push(o);
            }
          }
        });
      }
      return out;
    };
    const shellRoots = () => projRoots().filter((o) => String(o.name || '').startsWith('projectile_shell'));
    const sculptRoots = () => projRoots().filter((o) => !String(o.name || '').startsWith('projectile_shell'));
    const meshesOf = (roots) => {
      const out = [];
      // `isSprite` as well as `isMesh` — the halo is a THREE.Sprite, which is not a Mesh.
      for (const root of roots) root.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible) out.push(o); });
      return out;
    };

    const coreOf = (roots) => {
      if (!roots.length) return { n: 0 };
      const on = grab();
      for (const o of roots) o.visible = false;
      const off = grab();
      for (const o of roots) o.visible = true;
      const idx = maskOf(on, off);
      if (!idx.length) return { n: 0 };
      const proj = stats(on, idx);
      const bg = stats(off, idx);
      const lc = localDelta(on, off, idx);
      return {
        n: idx.length,
        proj, bg,
        dL: +Math.abs(proj.luma - bg.luma).toFixed(4),
        dHue: +(() => { const d = Math.abs(proj.hue - bg.hue) % 360; return d > 180 ? 360 - d : d; })().toFixed(1),
        deMean: lc.deMean, deP90: lc.deP90, deMed: lc.deMed,
        contrastP90: lc.p90,
      };
    };

    /** The concealment groups the arena builds — `kitchen.ts` names them `conceal:<kind>`. */
    const concealGroups = () => {
      const out = [];
      stage.scene.traverse((o) => { if (typeof o.name === 'string' && o.name.startsWith('conceal:')) out.push(o); });
      return out;
    };

    let moved = null;         // { obj, saved: {x,y,z} }
    let pendingHalo = null;   // saved halo materials while a clamped frame is held

    window.__p2 = {
      census() {
        const roots = projRoots();
        const f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
        return {
          roots: roots.length,
          names: roots.map((o) => o.name || '(unnamed)'),
          shells: shellRoots().length,
          conceal: concealGroups().map((o) => o.name),
          distUnits: roots.map((o) => {
            if (!f) return null;
            const dx = o.position.x / 0.05 - f.x, dz = o.position.z / 0.05 - f.y;
            return +Math.sqrt(dx * dx + dz * dz).toFixed(1);
          }),
        };
      },

      /**
       * Translate the NEAREST `conceal:*` group so its centre lands under the
       * projectile's own ground point.
       *
       * The projectile is untouched. Written through the parent's inverse so it is
       * correct whether or not `arena_concealment`'s ancestors carry an offset — the
       * group's own `position` is LOCAL, and assuming the parent is the identity is the
       * kind of thing that silently half-works.
       */
      moveClothUnderProjectile() {
        if (moved) return { ok: false, why: 'a group is already moved' };
        const roots = sculptRoots().length ? sculptRoots() : projRoots();
        if (!roots.length) return { ok: false, why: 'no live projectile' };
        const groups = concealGroups();
        if (!groups.length) return { ok: false, why: 'this arena declares no concealment' };
        const THREE_V = roots[0].getWorldPosition(new roots[0].position.constructor());
        // Nearest patch, to keep the shadow cascade and the light rig as close to
        // unchanged as this method allows.
        let best = null, bestD = Infinity;
        for (const g of groups) {
          const p = g.getWorldPosition(new g.position.constructor());
          const d = Math.hypot(p.x - THREE_V.x, p.z - THREE_V.z);
          if (d < bestD) { bestD = d; best = g; }
        }
        const before = best.getWorldPosition(new best.position.constructor());
        const target = { x: THREE_V.x, y: before.y, z: THREE_V.z };
        const saved = { x: best.position.x, y: best.position.y, z: best.position.z };
        // world -> parent-local
        const local = best.parent
          ? best.parent.worldToLocal(new best.position.constructor(target.x, target.y, target.z))
          : { x: target.x, y: target.y, z: target.z };
        best.position.set(local.x, local.y, local.z);
        best.updateMatrixWorld(true);
        moved = { obj: best, saved };
        return {
          ok: true, name: best.name, movedFrom: { x: +before.x.toFixed(3), z: +before.z.toFixed(3) },
          movedTo: { x: +target.x.toFixed(3), z: +target.z.toFixed(3) },
          distanceM: +bestD.toFixed(2),
        };
      },

      restoreCloth() {
        if (!moved) return { ok: false, why: 'nothing moved' };
        moved.obj.position.set(moved.saved.x, moved.saved.y, moved.saved.z);
        moved.obj.updateMatrixWorld(true);
        moved = null;
        return { ok: true };
      },

      /** THE HEADLINE — same-frame ablation of everything the projectile draws. */
      measure() { return coreOf(projRoots()); },
      /** CONTROL A. */
      controlHidden() {
        const roots = projRoots();
        for (const o of roots) o.visible = false;
        const r = coreOf(projRoots());
        for (const o of roots) o.visible = true;
        return r;
      },
      /**
       * CONTROL SWAP — what is ACTUALLY behind the projectile right now.
       *
       * Ablates the projectile and reports the stats of the background pixels under its
       * own mask. At the `cloth` station this must read as the cloth; at `home` it must
       * not. Without this a patch that failed to move produces a complete, confident,
       * wrong answer that looks exactly like "the surface made no difference".
       */
      backgroundUnder() {
        const roots = projRoots();
        if (!roots.length) return null;
        const on = grab();
        for (const o of roots) o.visible = false;
        const off = grab();
        const idx = maskOf(on, off);
        const s = idx.length ? stats(off, idx) : null;
        for (const o of roots) o.visible = true;
        return s;
      },
      /**
       * The cloth's OWN rendered colour, read from the pixels the moved group delivers.
       * Ablating the group itself is the only honest source: `#E9DCC0` is an authored
       * hex and the rendered pixel has been through the lights, the fog and the post
       * chain. `SWAP` compares against THIS, never against the constant.
       */
      clothColor() {
        if (!moved) return null;
        const on = grab();
        moved.obj.visible = false;
        const off = grab();
        moved.obj.visible = true;
        const idx = maskOf(on, off);
        if (idx.length < 200) return null;
        return { ...stats(on, idx), px: idx.length };
      },
      /** CONTROL KB — sculpt painted the background's own colour, halo hidden. */
      controlSculptPaint(hex) {
        const shells = shellRoots();
        for (const o of shells) o.visible = false;
        try {
          const mats = [];
          const seen = new Set();
          for (const o of meshesOf(sculptRoots())) {
            for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
              if (m && !seen.has(m.uuid)) { seen.add(m.uuid); mats.push(m); }
            }
          }
          // Saved per MATERIAL, never per mesh: bespoke projectiles share module-scope
          // singletons and the generic path shares one material per colour, so a
          // per-mesh restore writes the control colour into a pooled material forever.
          const saved = mats.map((m) => ({ m, c: m.color ? m.color.clone() : null, e: m.emissive ? m.emissive.clone() : null, op: m.opacity, tr: m.transparent }));
          const before = coreOf(sculptRoots());
          for (const s of saved) {
            if (s.c) s.m.color.set(hex);
            if (s.e) s.m.emissive.set('#000000');
            s.m.opacity = 1; s.m.transparent = false;
          }
          const after = coreOf(sculptRoots());
          for (const s of saved) {
            if (s.c) s.m.color.copy(s.c);
            if (s.e) s.m.emissive.copy(s.e);
            s.m.opacity = s.op; s.m.transparent = s.tr;
          }
          const check = mats.map((m) => (m.color ? m.color.getHexString() : '-') + '/' + m.opacity + '/' + m.transparent);
          return { before, after, restored: check };
        } finally {
          for (const o of shells) o.visible = true;
        }
      },
      /**
       * HOW MUCH OF THE PROJECTILE IS THE SCULPT AND HOW MUCH IS THE HALO.
       *
       * This is what decides WHICH FILE can fix a weapon. `deMed` is a MEDIAN over the
       * projectile's own pixels, so no change confined to the sculpt can move it unless
       * the sculpt is more than half of them. If the halo is ~40% of the delivered
       * pixels and is the weapon's own pale colour, then a sculpt edit in
       * `src/vfx/weapons/` is arithmetically incapable of moving the median on a pale
       * weapon — which is a claim about this pass's own file set, and it should be
       * measured rather than assumed in either direction.
       */
      split() {
        const shells = shellRoots();
        const all = coreOf(projRoots());
        for (const o of shells) o.visible = false;
        const sculpt = coreOf(sculptRoots());
        for (const o of shells) o.visible = true;
        return {
          all: all.n, sculpt: sculpt.n, halo: all.n - sculpt.n,
          haloShare: all.n ? +((all.n - sculpt.n) / all.n).toFixed(3) : null,
          sculptDeMed: sculpt.deMed, allDeMed: all.deMed,
        };
      },
      /**
       * PROSPECTIVE FIX, MEASURED WITHOUT EDITING THE FILE THAT OWNS IT.
       *
       * `game/vfx.ts:PROJECTILE_HALO_L` is 0.66 and is applied with `Math.max` — a
       * LIGHTNESS FLOOR WITH NO CEILING. Its own comment justifies 0.66 by clearance
       * from the cast (0.302) and from the arena floor as measured at the time
       * (0.4809), and explicitly declines to DARKEN a weapon that is already lighter,
       * naming `#FFFFFF`, `#F4E9DA` and `#FFF8EA`. That was right when the palest
       * surface in the arena was 0.48. `b9bc00e` then gave the arena six cream
       * concealment patches that render at 0.81 luma, and a floor-only rule leaves the
       * pale weapons' halos sitting ON that value.
       *
       * `game/vfx.ts` is not this pass's file, so this does not edit it. It applies the
       * candidate clamp to the LIVE halo materials for one measurement and restores
       * them, so the recommendation handed to that file's owner carries a number
       * instead of an argument.
       *
       * ⚠️ Saved and restored per MATERIAL uuid: `haloMats` is one material per weapon
       * COLOUR, shared by every pellet of a volley. A per-sprite save reads back what
       * the previous sprite's write already put there.
       * ⚠️ Read and written as sRGB hex, never through `THREE.Color.getHSL` — three
       * converts a hex to LINEAR sRGB on construction, and `haloColorFor` records at
       * length that mixing the two spaces is how a measured threshold quietly stops
       * being the thing that was measured.
       */
      haloClamp(lMax, hold) {
        const mats = [];
        const seen = new Set();
        for (const root of projRoots()) {
          root.traverse((o) => {
            if (!o.isSprite || !String(o.name || '').startsWith('projectile_halo')) return;
            const m = o.material;
            if (m && m.color && !seen.has(m.uuid)) { seen.add(m.uuid); mats.push(m); }
          });
        }
        if (!mats.length) return null;
        const saved = mats.map((m) => ({ m, hex: m.color.getHexString() }));
        const clamped = [];
        for (const s of saved) {
          const n = parseInt(s.hex, 16);
          const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
          let h = 0;
          if (d > 1e-6) {
            if (mx === r) h = ((g - b) / d) % 6;
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60; if (h < 0) h += 360;
          }
          const l0 = (mx + mn) / 2;
          const s0 = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
          const l = Math.min(l0, lMax);
          const c = (1 - Math.abs(2 * l - 1)) * s0;
          const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
          const o = l - c / 2;
          let rr = 0, gg = 0, bb = 0;
          if (h < 60) { rr = c; gg = x; } else if (h < 120) { rr = x; gg = c; }
          else if (h < 180) { gg = c; bb = x; } else if (h < 240) { gg = x; bb = c; }
          else if (h < 300) { rr = x; bb = c; } else { rr = c; bb = x; }
          const to = (v) => Math.round((v + o) * 255).toString(16).padStart(2, '0');
          const hex = '#' + to(rr) + to(gg) + to(bb);
          clamped.push({ from: '#' + s.hex, to: hex, l0: +l0.toFixed(4), l: +l.toFixed(4) });
          s.m.color.set(hex);
        }
        const after = coreOf(projRoots());
        /**
         * HOLD THE CLAMPED FRAME ON SCREEN SO IT CAN BE PHOTOGRAPHED.
         *
         * `docs/AGENT-BRIEF.md` §4.1 — judging a description instead of an image is
         * this project's most common failure, and a PROSPECTIVE fix reported only as a
         * number is precisely that. With `--holdClamp` the caller screenshots between
         * `haloClamp` and `haloRestore`; `HALO` still asserts the restore is exact, and
         * `pending` makes an un-restored state impossible to mistake for a clean one.
         */
        if (hold) { pendingHalo = saved; return { clamped, after, restoredSame: null, pending: true }; }
        for (const s of saved) s.m.color.set('#' + s.hex);
        const restored = mats.map((m) => m.color.getHexString());
        return { clamped, after, restoredSame: restored.every((v, i) => v === saved[i].hex) };
      },
      /** Undo a held `haloClamp`. Returns false if nothing was held — which is itself a
       * fault, because it means a screenshot was taken of a state nobody applied. */
      haloRestore() {
        if (!pendingHalo) return { ok: false, why: 'nothing held' };
        for (const s of pendingHalo) s.m.color.set('#' + s.hex);
        const same = pendingHalo.every((s) => s.m.color.getHexString() === s.hex);
        pendingHalo = null;
        return { ok: true, restoredSame: same };
      },
      shot() { stage.render(0); },
    };
  }, [RW, RH, DELTA]);
}
/* eslint-enable */

async function poll(page, fn, ms = 4000, every = 60) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    last = await page.evaluate(fn);
    if (last) return last;
    await page.waitForTimeout(every);
  }
  return last;
}

/** Select a weapon and PROVE the sim took it — a fixed sleep silently missed under
 * SwiftShader's 5-15 fps, which is `pj_probe`'s own recorded first failure. */
async function selectWeapon(page, slot) {
  for (let tries = 0; tries < 4; tries++) {
    await page.keyboard.press(String(slot));
    const ok = await poll(page, `window.__matchDebug && window.__matchDebug.selectedWeapon === ${slot - 1}`, 1500);
    if (ok) return true;
  }
  return false;
}

const DIST_EXPR = `(() => { const l = window.__vfxLayer, f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
  if (!l || !f || !l.projectilePool.size) return -1;
  const o = [...l.projectilePool.values()][0];
  return Math.hypot(o.position.x / 0.05 - f.x, o.position.z / 0.05 - f.y); })()`;

/** Fire once and freeze the first frame in which the shot has cleared the shooter. */
async function fireAndFreeze(page) {
  // DRAIN — without this the previous weapon's shot is still in the air and the pool
  // poll returns instantly on it, averaging two weapons under one name.
  await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size === 0', 15000, 120);
  const at = await page.evaluate(() => (window.__vfxDebugScreen && window.__vfxDebugScreen.player) || null);
  if (!at) return { ok: false, why: 'no __vfxDebugScreen.player' };
  await page.mouse.move(Math.round(at.x + Math.min(320, W * 0.2)), Math.round(at.y));
  await page.mouse.down();
  // Hold until the SIM says it is firing, not for a fixed ms — 60 ms can be zero frames.
  await poll(page, 'window.__matchDebug && window.__matchDebug.attack === true', 4000);
  const spawned = await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size > 0', 6000);
  await page.mouse.up();
  if (!spawned) return { ok: false, why: 'pool never non-empty' };
  const cleared = await poll(page, `(${DIST_EXPR}) > ${MIN_DIST}`, 9000, 40);
  if (!cleared) return { ok: false, why: `never cleared ${MIN_DIST} wu before expiring` };
  await page.evaluate(() => { window.__clk.pause(); window.__raf.stop(); });
  await page.waitForTimeout(60);
  // WARM-UP: the first render after the clock is paused is not the same as the second.
  await page.evaluate(() => { window.__p2.shot(); window.__p2.shot(); });
  return { ok: true };
}

const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

async function runWeapon(page, charId, w) {
  const fired = await fireAndFreeze(page);
  if (!fired.ok) return { char: charId, weapon: w.key, color: w.color, error: fired.why };

  const census = await page.evaluate(() => window.__p2.census());
  /**
   * 🚨 A DISCARDED FIRST MEASUREMENT, AND IT IS NOT SUPERSTITION.
   *
   * The first build of this tool froze the frame, rendered the two warm-up frames
   * `pj_probe` uses, and took `home` immediately. Its self-pair FAILED — two identical
   * `measure()` calls on one frozen scene disagreed — while `pj_probe`'s own self-pair
   * on the same tree is 0.000000. The difference is where in the sequence the pair is
   * taken: `pj_probe` measures its pair at the END of a controls block that has already
   * driven a dozen renders, and its flight-loop pair comes after a `census()` plus a
   * full `measure()`. Ours was the very first ablation after the freeze.
   *
   * So the residue is a SETTLING transient in the post chain, not randomness — and the
   * honest fix is to throw the settling frame away rather than to widen the tolerance.
   * `PAIR` still demands 0.000000 exactly; this is what makes that demand meetable.
   * The discarded value is kept in the JSON so the size of the transient is on record
   * instead of being hidden by the thing that fixes it.
   */
  const settle = await page.evaluate(() => { window.__p2.shot(); window.__p2.shot(); return window.__p2.measure(); });
  const home = await page.evaluate(() => window.__p2.measure());
  const homePair = await page.evaluate(() => window.__p2.measure());
  const homeBg = await page.evaluate(() => window.__p2.backgroundUnder());
  const hiddenHome = await page.evaluate(() => window.__p2.controlHidden());
  if (SHOTS) await page.screenshot({ path: `${OUT}/${charId}.${w.key}.home.png` });

  const mv = await page.evaluate(() => window.__p2.moveClothUnderProjectile());
  let cloth = null, clothBg = null, clothColor = null, hiddenCloth = null, kb = null, halo = null, split = null;
  if (mv.ok) {
    clothColor = await page.evaluate(() => window.__p2.clothColor());
    cloth = await page.evaluate(() => window.__p2.measure());
    split = await page.evaluate(() => window.__p2.split());
    halo = await page.evaluate(([l, h]) => window.__p2.haloClamp(l, h), [HALO_L_MAX, HOLD_CLAMP]);
    if (HOLD_CLAMP) {
      if (SHOTS) await page.screenshot({ path: `${OUT}/${charId}.${w.key}.cloth.haloL${HALO_L_MAX}.png` });
      const rest = await page.evaluate(() => window.__p2.haloRestore());
      halo.restoredSame = rest.ok && rest.restoredSame;
    }
    clothBg = await page.evaluate(() => window.__p2.backgroundUnder());
    hiddenCloth = await page.evaluate(() => window.__p2.controlHidden());
    if (SHOTS) await page.screenshot({ path: `${OUT}/${charId}.${w.key}.cloth.png` });
    if (clothBg) {
      // The known-bad colour comes from THIS FRAME's own background, never a constant.
      const hex = await page.evaluate(([l, s, h]) => {
        const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
        let r1 = 0, g1 = 0, b1 = 0;
        if (h < 60) { r1 = c; g1 = x; } else if (h < 120) { r1 = x; g1 = c; }
        else if (h < 180) { g1 = c; b1 = x; } else if (h < 240) { g1 = x; b1 = c; }
        else if (h < 300) { r1 = x; b1 = c; } else { r1 = c; b1 = x; }
        const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
        return '#' + to(r1) + to(g1) + to(b1);
      }, [clothBg.luma, clothBg.sat, clothBg.hue]);
      kb = { hex, ...(await page.evaluate((hx) => window.__p2.controlSculptPaint(hx), hex)) };
    }
  }
  await page.evaluate(() => window.__p2.restoreCloth());
  const homeAgain = await page.evaluate(() => window.__p2.measure());
  await page.evaluate(() => { window.__raf.start(); window.__clk.resume(); });

  const controls = {
    N: home.n >= 20,
    // ⚠️ A IS THE WEAKEST OF THE SIX AND IS LABELLED AS SUCH. `coreOf` short-circuits on
    // an empty root list, so "hidden -> 0 px" is close to tautological on its own; what
    // makes the PAIR meaningful is that N passed on the same frame, i.e. the probe did
    // have a handle on a projectile and then lost it on purpose. The load-bearing
    // controls are SWAP, DIFF, RESTORE and KB.
    A: hiddenHome.n === 0 && (!mv.ok || hiddenCloth.n === 0),
    SWAP: !!(mv.ok && clothBg && clothColor
      && hueDist(clothBg.hue, clothColor.hue) < 12 && Math.abs(clothBg.luma - clothColor.luma) < 0.06),
    // DIFF — SWAP from the other side. SWAP says the new background IS the cloth; DIFF
    // says it is NOT the old one. A patch that silently failed to move passes neither,
    // but a patch that moved to the wrong place could pass one alone.
    DIFF: !!(mv.ok && clothBg && homeBg
      && (hueDist(clothBg.hue, homeBg.hue) > 8 || Math.abs(clothBg.luma - homeBg.luma) > 0.05)),
    RESTORE: home.n >= 20 && homeAgain.n === home.n && homeAgain.deMed === home.deMed && homeAgain.dL === home.dL,
    PAIR: home.n >= 20 && homePair.n === home.n && homePair.deMed === home.deMed && homePair.dL === home.dL,
    /**
     * ⚠️ `after.n === 0` IS THE MAXIMAL PASS, NOT A FAIL, AND THE FIRST VERSION SCORED
     * IT AS A FAIL. `coreOf` short-circuits to `{ n: 0 }` with no `deMed` when the
     * ablation finds nothing, so a sculpt repainted the background's own colour that
     * then delivers ZERO pixels — total camouflage, the strongest possible confirmation
     * that the control did what it claims — produced `undefined < x*0.5` = false.
     * `soup.Noodle` and `soup.Splash` both did exactly that and were reported as
     * instrument failures. `docs/AGENT-BRIEF.md` §4.4: ask what implementation would
     * fail this. The answer must not be "the one that works perfectly".
     */
    KB: !!(kb && kb.before && kb.after && kb.before.n > 20
      && (kb.after.n === 0 || kb.after.deMed < kb.before.deMed * 0.5)),
    // The prospective halo clamp must leave the SHIPPED materials byte-identical. These
    // are module-scope singletons shared by every pellet of every volley of that colour
    // for the life of the page — a failed restore would silently repaint the game.
    HALO: !mv.ok || !halo || halo.restoredSame === true,
  };
  return {
    char: charId, weapon: w.key, name: w.name, color: w.color,
    dist: census.distUnits[0], shells: census.shells, concealCount: census.conceal.length,
    move: mv, clothColor,
    settleDrift: {
      dn: settle.n - home.n,
      dde: +((settle.deMed ?? 0) - (home.deMed ?? 0)).toFixed(6),
      ddL: +((settle.dL ?? 0) - (home.dL ?? 0)).toFixed(6),
    },
    pairDrift: {
      dn: homePair.n - home.n,
      dde: +((homePair.deMed ?? 0) - (home.deMed ?? 0)).toFixed(6),
      ddL: +((homePair.dL ?? 0) - (home.dL ?? 0)).toFixed(6),
    },
    restoreDrift: {
      dn: homeAgain.n - home.n,
      dde: +((homeAgain.deMed ?? 0) - (home.deMed ?? 0)).toFixed(6),
      ddL: +((homeAgain.dL ?? 0) - (home.dL ?? 0)).toFixed(6),
    },
    home: { n: home.n, deMed: home.deMed, deP90: home.deP90, dL: home.dL, dHue: home.dHue, bg: homeBg },
    cloth: cloth ? { n: cloth.n, deMed: cloth.deMed, deP90: cloth.deP90, dL: cloth.dL, dHue: cloth.dHue, bg: clothBg } : null,
    kb: kb ? { hex: kb.hex, beforeDe: kb.before.deMed, afterDe: kb.after.deMed } : null,
    haloClamp: halo ? {
      lMax: HALO_L_MAX, clamped: halo.clamped,
      n: halo.after.n, deMed: halo.after.deMed, deP90: halo.after.deP90,
      dL: halo.after.dL, dHue: halo.after.dHue, restoredSame: halo.restoredSame,
    } : null,
    controls,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const table = await rangedWeapons();
  const wantChars = args.chars ? String(args.chars).split(',') : [...table.keys()];
  const ONLYW = args.weapon ? String(args.weapon) : null;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const results = [];
  let failures = 0;
  try {
    for (const charId of wantChars) {
      const weapons = table.get(charId);
      if (!weapons) continue;
      const ranged = weapons.map((x, i) => ({ ...x, slot: i + 1 }))
        .filter((x) => x.type === 'ranged' && (!ONLYW || x.key === ONLYW));
      if (!ranged.length) { log(`  ${charId}: no ranged weapon`); continue; }

      const page = await browser.newPage({ viewport: { width: W, height: H } });
      /**
       * 🚨 ONE BAD PAGE BOOT MUST NOT COST THE WHOLE RUN'S JSON, AND THAT IS NOT
       * HYPOTHETICAL. `pj_probe` writes its JSON after the character loop; on this
       * machine, on this pass, its 11th page boot exceeded the 180 s
       * `waitForFunction` budget (two SwiftShader probes were sharing 18 cores), the
       * exception unwound past the `writeFile`, and **18 of 23 measured weapons were
       * lost** — recoverable only because each row had already been printed to a log.
       * Per-character isolation plus an incremental write after every character makes
       * the worst case "one character missing" instead of "everything missing".
       */
      try {
        await boot(page);
        const enemy = charId === 'donut' ? 'hamburger' : 'donut';
        await page.goto(`${BASE}/?player=${charId}&enemy=${enemy}&simSpeed=${SIM_SPEED}&pointerLock=0&aimMode=free`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
        await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 240000 });
        await installHarness(page);

        for (const w of ranged) {
          if (!(await selectWeapon(page, w.slot))) {
            log(`  ⚠️ ${charId}.${w.key}: weapon select refused — SKIPPED`);
            failures++;
            continue;
          }
          const r = await runWeapon(page, charId, w);
          results.push(r);
          if (r.error) { log(`  ⚠️ ${pad(charId + '.' + w.key, 22)}${r.error}`); failures++; continue; }
          const bad = Object.entries(r.controls).filter(([, v]) => !v).map(([k]) => k);
          if (bad.length) failures++;
          log(`  ${pad(charId + '.' + w.key, 22)}${pad(r.color ?? '-', 9)}`
            + `HOME px ${pad(r.home.n, 7)}dE ${pad(r.home.deMed, 8)}dHue ${pad(r.home.dHue, 7)}`
            + `| CLOTH px ${pad(r.cloth ? r.cloth.n : '-', 7)}dE ${pad(r.cloth ? r.cloth.deMed : '-', 8)}dHue ${pad(r.cloth ? r.cloth.dHue : '-', 7)}`
            + `| ratio ${pad(r.cloth ? (r.cloth.deMed / Math.max(1e-6, r.home.deMed)).toFixed(2) + 'x' : '-', 8)}`
            + `| haloL<=${HALO_L_MAX} dE ${pad(r.haloClamp ? r.haloClamp.deMed : '-', 8)}`
            + (bad.length ? `⚠️ CONTROLS FAILED: ${bad.join(',')}` : 'controls OK'));
        }
      } catch (e) {
        log(`  🚨 ${charId}: page failed — ${String(e).split('\n')[0]}`);
        results.push({ char: charId, weapon: null, error: `page: ${String(e).split('\n')[0]}` });
        failures++;
      } finally {
        await page.close().catch(() => {});
        // Written after EVERY character, not once at the end — see the block above.
        await writeFile(`${OUT}/bgcross.json`, JSON.stringify({ base: BASE, w: W, h: H, delta: DELTA, haloLMax: HALO_L_MAX, results }, null, 2));
      }
    }

    await writeFile(`${OUT}/bgcross.json`, JSON.stringify({ base: BASE, w: W, h: H, delta: DELTA, haloLMax: HALO_L_MAX, results }, null, 2));
    log(`\njson -> ${OUT}/bgcross.json`);
    summary(results);
  } finally {
    await browser.close();
  }
  if (args.selftest) {
    const r = results.find((x) => !x.error);
    if (!r) { log('\n  → INSTRUMENT INVALID — no weapon produced a measurement'); process.exit(1); }
    log(`\n══ INSTRUMENT VALIDATION on ${r.char}.${r.weapon} (known inputs) ═════════════`);
    log(`  live projectile roots ${r.move.ok ? 'yes' : 'no'} · shells ${r.shells} · conceal groups in scene ${r.concealCount}`);
    log(`  moved ${r.move.ok ? `${r.move.name} ${r.move.distanceM} m -> under the shot` : r.move.why}`);
    log(`  cloth's OWN rendered colour   hue ${r.clothColor?.hue} luma ${r.clothColor?.luma} sat ${r.clothColor?.sat} (${r.clothColor?.px} px)`);
    log(`  background under the shot     HOME  hue ${pad(r.home.bg?.hue, 8)}luma ${r.home.bg?.luma}`);
    log(`                                CLOTH hue ${pad(r.cloth?.bg?.hue, 8)}luma ${r.cloth?.bg?.luma}`);
    log(`  KB sculpt painted ${r.kb?.hex}     dE ${r.kb?.beforeDe} -> ${r.kb?.afterDe} (want < half)`);
    log(`  drift, in the tool's own units — the DISCARDED settling frame vs the pair it enables:`);
    log(`      settling frame (discarded)  dn ${pad(r.settleDrift.dn, 8)}dde ${pad(r.settleDrift.dde, 12)}ddL ${r.settleDrift.ddL}`);
    log(`      PAIR    (want 0 exactly)    dn ${pad(r.pairDrift.dn, 8)}dde ${pad(r.pairDrift.dde, 12)}ddL ${r.pairDrift.ddL}`);
    log(`      RESTORE (want 0 exactly)    dn ${pad(r.restoreDrift.dn, 8)}dde ${pad(r.restoreDrift.dde, 12)}ddL ${r.restoreDrift.ddL}`);
    const order = ['N', 'A', 'SWAP', 'DIFF', 'RESTORE', 'PAIR', 'KB', 'HALO'];
    log(`  ${order.map((k) => `${k} ${r.controls[k] ? 'PASS' : 'FAIL'}`).join(' · ')}`);
    const ok = order.every((k) => r.controls[k]);
    log(ok ? '  → INSTRUMENT VALID' : '  → INSTRUMENT INVALID — nothing above is trustworthy');
    process.exit(ok ? 0 : 1);
  }
  process.exit(failures ? 1 : 0);
}

function summary(results) {
  const live = results.filter((r) => !r.error && r.cloth);
  if (!live.length) return;
  log(`\n══ EVERY RANGED WEAPON, ROSE TILE vs THE NEW CONCEALMENT CLOTH ════════════════`);
  log(`  dE is OKLab distance from the LOCAL background, median over the projectile's`);
  log(`  own pixels, same frozen frame, same shot. Worst (lowest dE on cloth) first.\n`);
  log(`  ${pad('weapon', 22)}${pad('colour', 9)}${pad('HOME dE', 10)}${pad('CLOTH dE', 10)}${pad('ratio', 9)}${pad('CLOTH dHue', 12)}${pad('px', 8)}haloL<=${HALO_L_MAX}`);
  for (const r of [...live].sort((a, b) => a.cloth.deMed - b.cloth.deMed)) {
    log(`  ${pad(r.char + '.' + r.weapon, 22)}${pad(r.color ?? '-', 9)}${pad(r.home.deMed, 10)}${pad(r.cloth.deMed, 10)}`
      + `${pad((r.cloth.deMed / Math.max(1e-6, r.home.deMed)).toFixed(2) + 'x', 9)}${pad(r.cloth.dHue, 12)}${pad(r.cloth.n, 8)}`
      + `${r.haloClamp ? `${r.haloClamp.deMed} (${(r.haloClamp.deMed / Math.max(1e-6, r.cloth.deMed)).toFixed(2)}x)` : '-'}`);
  }
  log(`\n  The last column is a PROSPECTIVE fix measured on the live halo materials and`);
  log(`  restored — \`game/vfx.ts:PROJECTILE_HALO_L\` turned from a FLOOR into a CLAMP.`);
  log(`  Nothing in \`src/\` was edited to produce it. See \`haloClamp\` for why 0.68.`);
}

/** IS_MAIN guard — `docs/AGENT-BRIEF.md` §3: three tools here made the CLI path run on
 * import, one of which launched Chromium and one of which killed every snapshot server
 * on the box. This file exports nothing today; the guard is one line. */
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) await main();
