#!/usr/bin/env node
/**
 * ALBEDO PROBE — "which authored colour reaches which screen pixel, and at what luma".
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `valuescan --mode chars` says the cast has no dark rung (p05 0.304 vs a reference
 * 0.097) and gives a per-JOINT table. That is not actionable: `head` is 60-94% of every
 * character and is made of 20-60 meshes carrying a dozen different authored colours.
 * "Darken the head" is not an edit; "darken `SHELL` from #FFF8EA" is.
 *
 * `docs/LESSONS.md` §2 — probe before you loop. Before spending a single albedo edit
 * this answers three questions with numbers:
 *
 *   1. WHICH authored constant owns the pixels. Frontmost-surface ownership per MESH,
 *      from a single ID render (one draw, exact, no threshold) rather than the
 *      hide-and-diff valuescan uses per joint (2 draws per group).
 *   2. WHAT the transfer function is. Authored sRGB luma -> delivered screen luma,
 *      through lighting + tonemap + the post chain. An albedo pass aimed at a target
 *      screen value is guesswork without it. MEASURED, not assumed.
 *   3. HOW MUCH mass a candidate edit can move: `deliveredPx / characterPx`.
 *
 * ── The ID render ────────────────────────────────────────────────────────────
 * Every mesh of the player gets a temporary CLONE of its own material with the lit
 * term killed (`color` black, `map` null) and `emissive` set to a colour encoding its
 * index in base 6 across RGB at a stride of 51 (0/51/.../255), so a +-2 round-trip
 * through the renderer's sRGB conversion cannot alias two ids. 216 ids per character;
 * asserted, not assumed (`idsExceeded`).
 *
 * A clone rather than a mutation because MATERIALS ARE SHARED — `egg.ts`'s
 * `limbShellMat` dresses six meshes — so mutating in place cannot give per-mesh ids at
 * all. And a clone rather than a fresh `MeshBasicMaterial` because `THREE` is not on
 * `window`: `material.clone()` needs no module handle. Emissive rather than colour
 * because emissive is UNLIT and added after shading, so the byte written is the byte
 * asked for; `toneMapped = false` keeps the grade off it.
 *
 * Fog is disabled on the probe material (`fog: false`) or the id would drift with
 * distance. Transparent materials are rendered OPAQUE in the id pass and flagged
 * `wasTransparent`, because a blended surface has no single owner; treat those rows as
 * "this mesh is in front here", not "this mesh's colour is what you see".
 * `docs/LESSONS.md` §1's silent-occluder trap in reverse.
 *
 * LUMA is read from the SHIPPED post-processed frame — what the player sees — using
 * `VL.luma`, the identical formula `valuescan` and `arena-scan` use, so every number
 * here is directly comparable to the recorded figures.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/headserve.mjs --overlay src/characters -- \
 *     node tools/tmp/albedoprobe.mjs --out shots/vl/albedo
 *
 * `--overlay src/characters` is the right combination while four peers are mid-edit:
 * HEAD everywhere, working tree for the files under test (`docs/LESSONS.md` §5).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VL, VL_SRC } from './valuelib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const OUT = get('--out', 'shots/vl/albedo');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
const STATION = { x: Number(get('--px', 700)), y: Number(get('--py', 640)), fog: 850 };
const SIM_SPEED = get('--sim-speed', '0.02');
const TOPN = Number(get('--top', 14));

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR',
  'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

const CAPTURE = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  if (!r || !scene || !cam) return { error: 'Stage missing renderer/scene/rig.camera' };
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;

  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  if (!casts.length) return { error: 'no character:* node' };
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };

  const readRect = (x, yImg, w, h) => {
    const yGL = Hp - (yImg + h);
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(x, yGL, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) out.set(buf.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
    return out;
  };

  const savedBg = scene.background, savedShadow = r.shadowMap.enabled, savedAlpha = r.getClearAlpha();
  let hidden = [];
  const hideEnv = (keep) => {
    hidden = [];
    for (const kid of scene.children) { if (keep.has(kid)) continue; if (kid.visible) { hidden.push(kid); kid.visible = false; } }
  };
  const restoreEnv = () => { for (const k of hidden) k.visible = true; hidden = []; };

  const res = { buffer: [Wp, Hp] };
  const probeMats = [];
  const swapped = [];
  try {
    // 1. the shipped frame FIRST — nothing has been touched yet.
    stage.render(0); stage.render(0);
    const full = readRect(0, 0, Wp, Hp);

    // 2. player pick, by name (same contract as valuescan).
    let player = null;
    for (const c of casts) if (c.name === `character:${opts.playerId}`) { player = player ?? c; }
    if (!player) player = casts[0];
    res.player = player.name;

    // 3. collect meshes + their authored material description
    const meshes = [];
    player.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
    if (meshes.length > 216) res.idsExceeded = meshes.length;
    const jointOf = (m) => {
      let n = m.parent, best = null;
      while (n && n !== player) { if (opts.jointNames.includes(n.name) && !best) best = n.name; n = n.parent; }
      return best;
    };
    const pathOf = (m) => {
      const parts = []; let n = m;
      while (n && n !== player) { if (n.name) parts.unshift(n.name); n = n.parent; }
      return parts.join('/');
    };
    const hex = (c) => '#' + c.getHexString().toUpperCase();

    // 4. the ID render.
    hideEnv(new Set([topOf(player)]));
    const otherCast = [];
    for (const o of casts) { if (o !== player && o.visible) { otherCast.push(o); o.visible = false; } }

    // ── the id pass ──────────────────────────────────────────────────────────
    // Three things have to be true for a decoded byte to BE the id:
    //   • the lit term contributes nothing        -> every light's intensity to 0,
    //                                                material colour black, maps null
    //   • the rim Fresnel contributes nothing     -> onBeforeCompile replaced by a
    //                                                no-op and the program recompiled
    //   • no tonemap / no grade on the way out    -> toneMapped false, post chain
    //                                                bypassed (direct r.render)
    // None of the three is assumed: `idFidelityPct` below re-reads the bytes and
    // reports what fraction sit within +-12 of an exact level. `docs/LESSONS.md` §13.
    const OUTLINE_RE = /__outline$/;
    const litOff = [];
    scene.traverse((o) => {
      if (o.isLight && o.intensity > 0) { litOff.push([o, o.intensity]); o.intensity = 0; }
    });
    const savedEnv = scene.environment; scene.environment = null;

    // Outline hulls carry a bespoke ShaderMaterial with neither `color` nor
    // `emissive`, so they cannot be given an id. Hidden for the id pass and counted
    // separately rather than left in to collide with a real mesh's id — which is what
    // the first version of this probe did, and it silently merged EVERY outline in the
    // character into whichever mesh happened to sit at that index.
    const outlineHidden = [];
    const idMeshes = [];
    meshes.forEach((m) => {
      const src = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!src || (!src.color && !src.emissive) || OUTLINE_RE.test(m.name || '')) {
        outlineHidden.push(m); m.visible = false;
      } else idMeshes.push(m);
    });
    res.outlineMeshes = outlineHidden.length;
    if (idMeshes.length > 216) res.idsExceeded = idMeshes.length;

    const LV = [0, 51, 102, 153, 204, 255];
    idMeshes.forEach((m, i) => {
      const src = Array.isArray(m.material) ? m.material[0] : m.material;
      const r6 = i % 6, g6 = Math.floor(i / 6) % 6, b6 = Math.floor(i / 36) % 6;
      const idHex = (LV[r6] << 16) | (LV[g6] << 8) | LV[b6];
      const pm = src.clone();
      pm.fog = false; pm.transparent = false; pm.opacity = 1;
      pm.depthWrite = true; pm.depthTest = true; pm.toneMapped = false;
      pm.map = null; pm.aoMap = null; pm.alphaMap = null; pm.lightMap = null;
      pm.emissiveMap = null; pm.envMap = null; pm.metalness = 0;
      if (pm.clearcoat !== undefined) pm.clearcoat = 0;
      pm.onBeforeCompile = function () { /* strip the rim Fresnel */ };
      if (pm.emissive) {
        if (pm.color) pm.color.setHex(0x000000);
        pm.emissive.setHex(idHex);
        pm.emissiveIntensity = 1;
      } else if (pm.color) {
        pm.color.setHex(idHex);          // MeshBasicMaterial (`flatMat`) is already unlit
      }
      pm.needsUpdate = true;
      probeMats.push(pm);
      swapped.push([m, m.material]);
      m.material = pm;
    });
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null); r.setClearColor(0x000000, 1); r.clear(true, true, true);
    r.render(scene, cam);
    const idbuf = readRect(0, 0, Wp, Hp);
    // black clear vs white clear to separate "id 0" from "background"
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
    const idbufW = readRect(0, 0, Wp, Hp);

    for (const [m, mat] of swapped) m.material = mat;
    swapped.length = 0;
    for (const m of outlineHidden) m.visible = true;
    for (const [o, v] of litOff) o.intensity = v;
    scene.environment = savedEnv;
    for (const o of otherCast) o.visible = true;
    restoreEnv();

    // 5. decode
    res.outputColorSpace = r.outputColorSpace;
    res.toneMapping = r.toneMapping;
    const q = (v) => Math.max(0, Math.min(5, Math.round(v / 51)));
    const owners = new Int16Array(Wp * Hp).fill(-1);
    let charPx = 0, clean = 0, overflow = 0;
    for (let j = 0; j < Wp * Hp; j++) {
      const i4 = j * 4;
      const covered = Math.max(Math.abs(idbuf[i4] - idbufW[i4]), Math.abs(idbuf[i4 + 1] - idbufW[i4 + 1]),
        Math.abs(idbuf[i4 + 2] - idbufW[i4 + 2])) < 24;
      if (!covered) continue;
      charPx++;
      const dev = Math.max(Math.abs(idbuf[i4] - LV[q(idbuf[i4])]),
        Math.abs(idbuf[i4 + 1] - LV[q(idbuf[i4 + 1])]),
        Math.abs(idbuf[i4 + 2] - LV[q(idbuf[i4 + 2])]));
      if (dev <= 12) clean++;
      const id = q(idbuf[i4]) + q(idbuf[i4 + 1]) * 6 + q(idbuf[i4 + 2]) * 36;
      if (id >= idMeshes.length) { overflow++; continue; }
      owners[j] = id;
    }
    res.charPx = charPx;
    res.idFidelityPct = +((clean / Math.max(1, charPx)) * 100).toFixed(2);
    res.idOverflowPx = overflow;

    const lumasBy = idMeshes.map(() => []);
    for (let j = 0; j < Wp * Hp; j++) {
      const id = owners[j]; if (id < 0) continue;
      const i4 = j * 4;
      lumasBy[id].push(window.VL.luma(full[i4], full[i4 + 1], full[i4 + 2]));
    }

    const med = (arr) => { if (!arr.length) return null; const s = arr.slice().sort((x, y) => x - y); return s[(s.length / 2) | 0]; };
    res.meshes = idMeshes.map((m, i) => {
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      const L = lumasBy[i];
      const sorted = L.slice().sort((x, y) => x - y);
      return {
        i, path: pathOf(m), joint: jointOf(m),
        color: mat && mat.color ? hex(mat.color) : null,
        albedoLuma: mat && mat.color ? +(window.VL.luma(
          Math.round(mat.color.r * 255), Math.round(mat.color.g * 255), Math.round(mat.color.b * 255)).toFixed(4)) : null,
        emissive: mat && mat.emissive ? hex(mat.emissive) : null,
        emissiveIntensity: mat ? (mat.emissiveIntensity ?? null) : null,
        roughness: mat ? (mat.roughness ?? null) : null,
        metalness: mat ? (mat.metalness ?? null) : null,
        wasTransparent: !!(mat && mat.transparent),
        opacity: mat ? (mat.opacity ?? null) : null,
        type: mat ? mat.type : null,
        px: L.length,
        lumaMed: L.length ? +med(L).toFixed(4) : null,
        lumaP10: L.length ? +sorted[Math.floor(sorted.length * 0.10)].toFixed(4) : null,
        lumaP90: L.length ? +sorted[Math.floor(sorted.length * 0.90)].toFixed(4) : null,
      };
    });
  } catch (e) {
    res.error = String(e);
  } finally {
    for (const [m, mat] of swapped) m.material = mat;
    for (const pm of probeMats) pm.dispose();
    restoreEnv();
    scene.background = savedBg;
    r.shadowMap.enabled = savedShadow;
    r.setClearColor(0x000000, savedAlpha);
    try { stage.render(0); } catch (e) { /* best effort */ }
  }
  return res;
};

// ─────────────────────────────────────────────────────────────────────────────
if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const all = {};
const fit = [];
try {
  for (const id of IDS) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    await page.addInitScript({ content: VL_SRC });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
    try {
      const url = `${BASE}/?player=${id}&enemy=donut&px=${STATION.x}&py=${STATION.y}&fogRadius=${STATION.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
      await page.waitForTimeout(900);
      const res = await page.evaluate(CAPTURE, { playerId: id, jointNames: JOINTS });
      if (res.error) { console.error(`✗ ${id}: ${res.error}`); all[id] = res; continue; }
      all[id] = res;
      const rows = res.meshes.filter((m) => m.px > 0).sort((x, y) => y.px - x.px);
      const tot = res.charPx || 1;
      console.log(`\n=== ${id}  charPx ${res.charPx}  idMeshes ${res.meshes.length} (${rows.length} on screen)  ` +
        `outline hulls hidden ${res.outlineMeshes}  idFidelity ${res.idFidelityPct}%  overflow ${res.idOverflowPx}px  ` +
        `[${res.outputColorSpace}, toneMapping ${res.toneMapping}]`);
      console.log('   px    %char  albedo    aL     screenL  p10..p90        joint      path');
      for (const m of rows.slice(0, TOPN)) {
        console.log(`${String(m.px).padStart(6)} ${((m.px / tot) * 100).toFixed(1).padStart(6)}%  ` +
          `${(m.color || '-').padEnd(8)} ${String(m.albedoLuma ?? '-').padEnd(6)} ` +
          `${String(m.lumaMed).padEnd(7)} ${String(m.lumaP10).padEnd(6)}..${String(m.lumaP90).padEnd(6)} ` +
          ` ${String(m.joint).padEnd(10)} ${m.path.slice(-52)}`);
      }
      const dark = (h) => !h || h === '#000000';
      for (const m of rows) if (m.albedoLuma != null && m.px >= 30 && !m.wasTransparent && dark(m.emissive)) {
        fit.push({ id, a: m.albedoLuma, s: m.lumaMed, px: m.px });
      }
    } catch (e) {
      console.error(`✗ ${id}: ${e}`);
      all[id] = { error: String(e) };
    } finally { await page.close(); }
  }
} finally { await browser.close(); }

await writeFile(join(OUT, 'albedo.json'), JSON.stringify(all, null, 2));

// ── the transfer function, binned ────────────────────────────────────────────
console.log('\n\nTRANSFER FUNCTION — authored albedo luma -> delivered screen luma');
console.log('(non-emissive, opaque, >=30px meshes; weighted by pixels)');
console.log(' albedoL bin   n   px total   screenL  (px-weighted mean)   min    max');
const bins = [];
for (let b = 0; b < 10; b++) bins.push(fit.filter((f) => f.a >= b / 10 && f.a < (b + 1) / 10));
for (let b = 0; b < 10; b++) {
  const g = bins[b]; if (!g.length) continue;
  const px = g.reduce((s, f) => s + f.px, 0);
  const mean = g.reduce((s, f) => s + f.s * f.px, 0) / px;
  console.log(`  ${(b / 10).toFixed(1)}-${((b + 1) / 10).toFixed(1)}   ${String(g.length).padStart(4)} ${String(px).padStart(9)}    ` +
    `${mean.toFixed(4)}                ${Math.min(...g.map((f) => f.s)).toFixed(3)}  ${Math.max(...g.map((f) => f.s)).toFixed(3)}`);
}
// least squares on the px-weighted points
{
  const W = fit.reduce((s, f) => s + f.px, 0);
  const mx = fit.reduce((s, f) => s + f.a * f.px, 0) / W, my = fit.reduce((s, f) => s + f.s * f.px, 0) / W;
  let sxx = 0, sxy = 0;
  for (const f of fit) { sxx += f.px * (f.a - mx) ** 2; sxy += f.px * (f.a - mx) * (f.s - my); }
  const slope = sxy / sxx, icept = my - slope * mx;
  console.log(`\n  px-weighted least squares:  screenL = ${slope.toFixed(4)} * albedoL + ${icept.toFixed(4)}   (n=${fit.length})`);
  console.log(`  => to land a part at screen luma 0.12 it needs albedo luma ${((0.12 - icept) / slope).toFixed(4)}`);
  console.log(`  => to land a part at screen luma 0.18 it needs albedo luma ${((0.18 - icept) / slope).toFixed(4)}`);
  console.log(`  => an albedo of luma 0.00 still delivers ${icept.toFixed(4)}`);
}
console.log(`\nwrote ${OUT}/albedo.json`);
