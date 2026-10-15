#!/usr/bin/env node
/**
 * C1A_PROBE — graphics campaign work package C1a (the cast's palette, re-keyed for the 58°
 * camera), its own instrument. Owner of the `c1a_` prefix.
 *
 * Per CHARACTER, at BOTH shipped cameras, on frozen deterministic frames (rv_capture's
 * RV_INIT virtual clock + seeded PRNG, so the same scene at the same virtual time is the same
 * frame on any tree — the before/after are PAIRED):
 *
 *   match  58° (`camera.ts`, grep `opts.pitchDeg ?? 58`): each character as the local seat,
 *          alone in frame on one fixed clear spot (see `runMatch`), the sim held in its first
 *          12 ms (`simSpeed=0.01`) so no effect, flash or status repaints it.
 *          Every fighter is re-yawed page-side to four facings (its own +0/90/180/270), so a
 *          palette is judged on what the camera sees from every side, not on one spawn facing.
 *   lobby  20° (`charStage.ts`, grep `pitchDeg: 20`): the home screen with the profile's
 *          `selected` seeded — charStage's own Stage, light rig and set, as Uri sees it.
 *
 * Pixels counted for a fighter = its EXACT matte (two-clear-colour, everything else hidden)
 *   AND visible in the shipped scene (a flat-magenta override of every fighter, everything
 *   else as shipped: a prop, a ring or an effect drawn over the body drops those pixels)
 *   AND claimed by no other fighter's matte. Measured on the SHIPPED post-chain frame.
 *   The match contour is drawn OUTSIDE the silhouette (`contour.ts`), so it is not counted.
 *
 * Stats (gx_gap_lib's conventions, so numbers compare with docs/REVAMP.md §2.1):
 *   luma  Rec.709 on the sRGB-ENCODED value, 0..1     p50 = median, hi80 = share > 0.8
 *   hue   HSL hue of chromatic px (HSL s >= 0.15, arena-scan's GREY_GATE), weighted by OKLab C;
 *         `win` = the 30° window holding the most of that weight, `winShare` its share
 *   mats  every distinct material's share of the fighter's pixels (an ID render), with the
 *         material's authored hex — "the largest top-visible mass" is the first row at 58°.
 *
 * Controls (CLAUDE.md rule 6 — each is required to come out as constructed, or the run is void):
 *   NULL      the shipped frame rendered twice differs in 0 px
 *   RESTORE   the shipped frame after every pass equals the one before
 *   NONEMPTY  every fighter has >= 200 counted px at every yaw (else REFUSED, never averaged)
 *   IDCOVER   >= 80% of a fighter's counted px decode to one of its own material IDs (a broken
 *             decode reads ~0; MSAA blends IDs along INTERNAL part boundaries, so a many-part
 *             fighter legitimately loses ~10% — lollipop read 0.879 on the base tree)
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/c1a_probe.mjs --url '{URL}' \
 *       --out <dir> [--sets match,lobby] [--ids a,b] [--angle metal|swiftshader] [--remap trial.json]
 *   (--remap is a page-side palette TRIAL for design iteration; acceptance is measured on source)
 *   node tools/tmp/c1a_probe.mjs --compare <beforeDir> <afterDir> [--sheet <dir>]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RV_INIT } from './rv_capture.mjs';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const IDS = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop', 'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];
const SEED = 0x5eed2610;
const EPOCH = Date.UTC(2026, 9, 15, 12, 0, 0);
const YAWS = [0, 90, 180, 270];
/** `--remap <json>`: { "<id>": { "#oldhex": "#newhex" } } — lower-case hex, as the table prints. */
const REMAP = (() => { const i = process.argv.indexOf('--remap'); return i >= 0 ? JSON.parse(readFileSync(process.argv[i + 1], 'utf8')) : null; })();
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SIDE — one synchronous evaluate per frame, so the app's own loop cannot interleave
// ─────────────────────────────────────────────────────────────────────────────
const PASS = (cfg) => {
  const st = window.__stage;
  if (!st || st.disposed) return { error: 'no live Stage' };
  const r = st.renderer, scene = st.scene, cam = st.rig.camera, gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height, N = W * H;
  try { st.rig.shakeAmount = 0; st.rig.shakeOffset?.set?.(0, 0, 0); } catch { /* */ }
  const read = () => { const b = new Uint8Array(N * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const shipped = () => { r.shadowMap.needsUpdate = true; st.render(0); return read(); };
  const diff = (a, b) => { let n = 0; for (let j = 0; j < N; j++) { const i = j * 4; if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; } return n; };

  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  if (!casts.length) return { error: 'no character:* roots' };
  const castOf = new Map();
  casts.forEach((c, ci) => c.traverse((o) => castOf.set(o, ci)));
  const renderables = [];
  scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) renderables.push(o); });

  let Basic = null;
  scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (!Basic && m && m.isMeshBasicMaterial) Basic = m.constructor; });
  if (!Basic) return { error: 'no MeshBasicMaterial constructor to borrow' };

  // Stats helpers (luma on the sRGB-encoded value; OKLab C from linearised RGB).
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const okC = (R, G, B) => {
    const r_ = lin[R], g_ = lin[G], b_ = lin[B];
    const l = Math.cbrt(0.4122214708 * r_ + 0.5363325363 * g_ + 0.0514459929 * b_);
    const m = Math.cbrt(0.2119034982 * r_ + 0.6806995451 * g_ + 0.1073969566 * b_);
    const s = Math.cbrt(0.0883024619 * r_ + 0.2817188376 * g_ + 0.6299787005 * b_);
    const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return Math.hypot(a, bb);
  };
  const hueSat = (R, G, B) => {
    const r_ = R / 255, g_ = G / 255, b_ = B / 255;
    const mx = Math.max(r_, g_, b_), mn = Math.min(r_, g_, b_), d = mx - mn, l = (mx + mn) / 2;
    if (d < 1e-9) return [0, 0];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (mx === r_) h = ((g_ - b_) / d) % 6; else if (mx === g_) h = (b_ - r_) / d + 2; else h = (r_ - g_) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, Math.min(1, s)];
  };
  const newAcc = () => ({ px: 0, hi80: 0, lo30: 0, sumC: 0, lumaHist: new Array(1024).fill(0), hueHist: new Array(360).fill(0), chromaPx: 0 });
  const addPx = (acc, R, G, B) => {
    const L = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
    acc.px++; if (L > 0.8) acc.hi80++; if (L < 0.3) acc.lo30++;
    acc.lumaHist[Math.min(1023, Math.floor(L * 1024))]++;
    const C = okC(R, G, B); acc.sumC += C;
    const [h, s] = hueSat(R, G, B);
    if (s >= 0.15) { acc.chromaPx++; acc.hueHist[Math.min(359, Math.floor(h))] += C; }
  };

  // ── saved state ──
  const savedVis = renderables.map((o) => o.visible);
  const savedBg = scene.background, savedAuto = r.autoClear;
  // A THREE.Color constructor without importing three: borrow one off any material.
  let ColorCtor = null;
  scene.traverse((o) => { if (!ColorCtor && o.material && !Array.isArray(o.material) && o.material.color) ColorCtor = o.material.color.constructor; });
  if (!ColorCtor) return { error: 'no Color constructor to borrow' };
  const clearCol = r.getClearColor(new ColorCtor());
  const clearA = r.getClearAlpha();
  const yaw0 = casts.map((c) => c.rotation.y);
  const restoreAll = () => {
    renderables.forEach((o, i) => { o.visible = savedVis[i]; });
    scene.background = savedBg; r.autoClear = savedAuto; r.setClearColor(clearCol, clearA);
    casts.forEach((c, i) => { c.rotation.y = yaw0[i]; });
  };

  const direct = (hex) => {
    scene.background = null; r.autoClear = true; r.setRenderTarget(null);
    r.setClearColor(hex, 1); r.clear(true, true, true); r.render(scene, cam);
    return read();
  };
  const swapMaterials = (pick) => {
    const saved = [];
    for (const o of renderables) {
      if (!castOf.has(o) || !o.material) continue;
      saved.push([o, o.material]);
      o.material = Array.isArray(o.material) ? o.material.map((m) => pick(o, m)) : pick(o, o.material);
    }
    return () => { for (const [o, m] of saved) o.material = m; };
  };

  // --remap: a palette TRIAL, page-side, before any pass (so NULL/RESTORE run on it). Every
  // material on a fighter of that id whose colour IS the old hex takes the new one. The source
  // hex is kept in userData so the material table still names the constant it came from.
  let remapped = 0;
  for (const c of casts) {
    const map = cfg.remap?.[c.name.replace('character:', '')];
    if (!map) continue;
    c.traverse((o) => {
      for (const m of (o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [])) {
        if (!m || !m.color || m.userData.__c1aOrig) continue;
        const hex = '#' + m.color.getHexString();
        if (map[hex]) { m.userData.__c1aOrig = hex; m.color.set(map[hex]); m.needsUpdate = true; remapped++; }
      }
    });
  }
  const ref0 = shipped();
  const ref1 = shipped();
  const NULL = diff(ref0, ref1);

  // Material IDs, global across casts. 16-step grid per channel, decode with tolerance 5.
  const matIds = new Map(); const matInfo = [];
  for (const o of renderables) {
    if (!castOf.has(o) || !o.material) continue;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || matIds.has(m)) continue;
      const id = matInfo.length;
      matIds.set(m, id);
      matInfo.push({ cast: castOf.get(o), hex: m.userData?.__c1aOrig ?? (m.color ? '#' + m.color.getHexString() : null),
        now: m.color ? '#' + m.color.getHexString() : null, type: m.type,
        mesh: o.name || '', transparent: !!m.transparent, ink: !!m.isShaderMaterial, transmission: m.transmission ?? 0 });
    }
  }
  if (matInfo.length > 4095) return { error: 'too many materials for the ID grid' };
  const idColor = (id) => [16 * (id % 16) + 8, 16 * ((id >> 4) % 16) + 8, 16 * ((id >> 8) % 16) + 8];
  // Authored in the renderer's OUTPUT space, so a direct render writes the bytes back unchanged
  // whether the canvas is sRGB-encoded or linear (the post chain may own that conversion).
  const outCS = r.outputColorSpace;
  const idMats = matInfo.map((_, id) => { const [R, G, B] = idColor(id); const m = new Basic({ toneMapped: false, fog: false }); m.color.setRGB(R / 255, G / 255, B / 255, outCS); return m; });
  const magenta = new Basic({ toneMapped: false, fog: false }); magenta.color.setRGB(1, 0, 1, outCS);
  const decode = (R, G, B) => {
    const a = Math.round((R - 8) / 16), b = Math.round((G - 8) / 16), c = Math.round((B - 8) / 16);
    if (a < 0 || b < 0 || c < 0 || a > 15 || b > 15 || c > 15) return -1;
    if (Math.abs(R - (16 * a + 8)) > 5 || Math.abs(G - (16 * b + 8)) > 5 || Math.abs(B - (16 * c + 8)) > 5) return -1;
    const id = a + 16 * b + 256 * c;
    return id < matInfo.length ? id : -1;
  };

  const perYaw = [];
  const crops = [];
  let frameImg = null;
  let surround = null;
  try {
    for (const yaw of cfg.yaws) {
      casts.forEach((c, i) => { c.rotation.y = yaw0[i] + (yaw * Math.PI) / 180; });
      const S = shipped();
      // per-cast mattes: everything else hidden, two clear colours
      const owner = new Int16Array(N).fill(-1);
      for (let ci = 0; ci < casts.length; ci++) {
        renderables.forEach((o, i) => { o.visible = savedVis[i] && castOf.get(o) === ci; });
        const A = direct(0x000000), B = direct(0xffffff);
        for (let j = 0; j < N; j++) {
          const i = j * 4;
          const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
          if (d < 32) owner[j] = owner[j] === -1 ? ci : -2;
        }
      }
      renderables.forEach((o, i) => { o.visible = savedVis[i]; });
      scene.background = savedBg; r.autoClear = savedAuto; r.setClearColor(clearCol, clearA);
      // visibility: every fighter flat magenta, the rest as shipped (direct render, no post)
      let undo = swapMaterials(() => magenta);
      r.setRenderTarget(null); r.clear(true, true, true); r.render(scene, cam);
      const V = read();
      undo();
      // material IDs
      undo = swapMaterials((o, m) => idMats[matIds.get(m)]);
      r.setRenderTarget(null); r.clear(true, true, true); r.render(scene, cam);
      const I = read();
      undo();

      const accs = casts.map(() => newAcc());
      const matPx = casts.map(() => new Map());
      const occl = casts.map(() => 0), shared = casts.map(() => 0), idMiss = casts.map(() => 0);
      const bbox = casts.map(() => [1e9, 1e9, -1, -1]);
      let sharedTotal = 0;
      for (let j = 0; j < N; j++) {
        const ow = owner[j];
        if (ow === -1) continue;
        if (ow === -2) { sharedTotal++; continue; }
        const i = j * 4;
        if (Math.abs(V[i] - 255) > 6 || V[i + 1] > 6 || Math.abs(V[i + 2] - 255) > 6) { occl[ow]++; continue; }
        addPx(accs[ow], S[i], S[i + 1], S[i + 2]);
        const id = decode(I[i], I[i + 1], I[i + 2]);
        if (id < 0 || matInfo[id].cast !== ow) idMiss[ow]++;
        else { const e = matPx[ow].get(id) ?? [0, 0]; e[0]++; e[1] += (0.2126 * S[i] + 0.7152 * S[i + 1] + 0.0722 * S[i + 2]) / 255; matPx[ow].set(id, e); }
        const x = j % W, y = H - 1 - ((j / W) | 0);
        const bb = bbox[ow]; if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y;
      }
      void shared;
      perYaw.push({ yaw, sharedTotal, casts: casts.map((c, ci) => ({
        name: c.name, acc: accs[ci], occluded: occl[ci], idMiss: idMiss[ci], bbox: bbox[ci],
        mats: [...matPx[ci].entries()].map(([id, [px, sumL]]) => ({ id, px, sumL })),
      })) });

      if (yaw === cfg.yaws[0]) {
        // the shipped frame + per-fighter crops, top-down rows (readPixels is bottom-up)
        const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
        const ctx = c2.getContext('2d');
        const img = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) { const src = (H - 1 - y) * W * 4; img.data.set(S.subarray(src, src + W * 4), y * W * 4); }
        for (let j = 0; j < N; j++) img.data[j * 4 + 3] = 255;
        ctx.putImageData(img, 0, 0);
        frameImg = c2.toDataURL('image/png');
        casts.forEach((c, ci) => {
          const [x0, y0, x1, y1] = bbox[ci];
          if (x1 < 0) return;
          const w = x1 - x0 + 1, h = y1 - y0 + 1, pad = Math.round(Math.max(w, h) * 0.3);
          const L = Math.max(0, x0 - pad), T = Math.max(0, y0 - pad), cw = Math.min(W - L, w + 2 * pad), chh = Math.min(H - T, h + 2 * pad);
          const c3 = document.createElement('canvas'); c3.width = cw; c3.height = chh;
          c3.getContext('2d').drawImage(c2, L, T, cw, chh, 0, 0, cw, chh);
          crops.push({ name: c.name, data: c3.toDataURL('image/png') });
        });
        // the surround: ground near the fighters (not any matte), median luma + C-weighted hue
        const sAcc = newAcc();
        const near = new Uint8Array(N);
        casts.forEach((c, ci) => {
          const [x0, y0, x1, y1] = bbox[ci]; if (x1 < 0) return;
          const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.6);
          for (let y = Math.max(0, y0 - m); y <= Math.min(H - 1, y1 + m); y++) for (let x = Math.max(0, x0 - m); x <= Math.min(W - 1, x1 + m); x++) near[(H - 1 - y) * W + x] = 1;
        });
        for (let j = 0; j < N; j++) { if (!near[j] || owner[j] !== -1) continue; const i = j * 4; addPx(sAcc, S[i], S[i + 1], S[i + 2]); }
        surround = sAcc;
      }
    }
  } finally {
    restoreAll();
    idMats.forEach((m) => m.dispose()); magenta.dispose();
  }
  const after = shipped();
  const RESTORE = diff(ref0, after);
  return { W, H, NULL, RESTORE, remapped, matInfo, perYaw, frameImg, crops, surround, phase: window.__matchDebug?.phase ?? null };
};

// ─────────────────────────────────────────────────────────────────────────────
// NODE SIDE
// ─────────────────────────────────────────────────────────────────────────────
function summarize(acc) {
  if (!acc || acc.px === 0) return null;
  const q = (p) => { const t = acc.px * p; let s = 0; for (let k = 0; k < 1024; k++) { s += acc.lumaHist[k]; if (s >= t) return (k + 0.5) / 1024; } return 1; };
  const tot = acc.hueHist.reduce((a, b) => a + b, 0);
  let best = -1, bestA = 0;
  for (let a = 0; a < 360; a++) { let s = 0; for (let k = 0; k < 30; k++) s += acc.hueHist[(a + k) % 360]; if (s > best) { best = s; bestA = a; } }
  let sx = 0, sy = 0;
  acc.hueHist.forEach((w, h) => { sx += w * Math.cos(((h + 0.5) * Math.PI) / 180); sy += w * Math.sin(((h + 0.5) * Math.PI) / 180); });
  return {
    px: acc.px, p50: +q(0.5).toFixed(3), p05: +q(0.05).toFixed(3), p95: +q(0.95).toFixed(3),
    hi80: +(acc.hi80 / acc.px).toFixed(3), lo30: +(acc.lo30 / acc.px).toFixed(3), C: +(acc.sumC / acc.px).toFixed(3),
    chroma: +(acc.chromaPx / acc.px).toFixed(3),
    win: tot > 0 ? [bestA, (bestA + 30) % 360] : null, winShare: tot > 0 ? +(best / tot).toFixed(3) : null,
    hueMean: tot > 0 ? +(((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360).toFixed(1) : null,
  };
}
function mergeAcc(a, b) {
  if (!a) return JSON.parse(JSON.stringify(b));
  a.px += b.px; a.hi80 += b.hi80; a.lo30 += b.lo30; a.sumC += b.sumC; a.chromaPx += b.chromaPx;
  for (let k = 0; k < 1024; k++) a.lumaHist[k] += b.lumaHist[k];
  for (let k = 0; k < 360; k++) a.hueHist[k] += b.hueHist[k];
  return a;
}

/** Fold one PASS result into per-character pooled accumulators + material tables. */
function fold(res, into, where) {
  const refused = [];
  for (const y of res.perYaw) {
    for (const c of y.casts) {
      const id = c.name.replace('character:', '');
      const e = (into[id] ??= { acc: null, mats: new Map(), px: 0, occluded: 0, idMiss: 0, yaws: [] });
      if (c.acc.px < 200) { refused.push(`${where} ${id} yaw ${y.yaw}: ${c.acc.px} px`); continue; }
      e.acc = mergeAcc(e.acc, c.acc);
      e.occluded += c.occluded; e.idMiss += c.idMiss;
      e.yaws.push({ where, yaw: y.yaw, ...summarize(c.acc) });
      for (const m of c.mats) {
        const info = res.matInfo[m.id];
        const key = `${info.hex}|${info.type}${info.ink ? '|ink' : ''}${info.transmission ? `|tx${info.transmission}` : ''}`;
        const cur = e.mats.get(key) ?? { hex: info.hex, now: info.now, type: info.type, ink: info.ink, transmission: info.transmission, mesh: info.mesh, px: 0, sumL: 0 };
        cur.px += m.px; cur.sumL += m.sumL; e.mats.set(key, cur);
      }
    }
  }
  return refused;
}

function finish(into) {
  const out = {};
  for (const [id, e] of Object.entries(into)) {
    if (!e.acc) { out[id] = { refused: true }; continue; }
    const s = summarize(e.acc);
    const matTot = [...e.mats.values()].reduce((a, m) => a + m.px, 0);
    const mats = [...e.mats.values()].sort((a, b) => b.px - a.px).slice(0, 12)
      .map((m) => ({ hex: m.hex, now: m.now !== m.hex ? m.now : undefined, type: m.type, ink: m.ink || undefined, tx: m.transmission || undefined, mesh: m.mesh,
        share: +(m.px / Math.max(1, matTot)).toFixed(3), L: +(m.sumL / Math.max(1, m.px)).toFixed(3) }));
    out[id] = { ...s, idCover: +(matTot / Math.max(1, e.acc.px)).toFixed(3), occludedPx: e.occluded, yaws: e.yaws, mats };
  }
  return out;
}

async function newPage(browser, W, H, storage) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  await page.addInitScript(RV_INIT, { protocol: 'c1a/1', seed: SEED, epoch: EPOCH, draw: true, storage });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.setDefaultTimeout(300_000);
  return { context, page, errors };
}
async function advance(page, toMs, each) {
  let now = 0;
  while (now < toMs) {
    const res = await page.evaluate(([k]) => window.__rv.frames(k, 16), [Math.min(8, Math.ceil((toMs - now) / 16))]);
    now = res.now;
    if (each) await page.evaluate(each);
  }
  return now;
}
const NO_SHAKE = () => {
  const st = window.__stage; if (!st || !st.rig || st.rig.__c1aNoShake) return;
  st.rig.shake = () => {}; st.rig.shakeAmount = 0; if (st.rig.shakeOffset?.set) st.rig.shakeOffset.set(0, 0, 0); st.rig.__c1aNoShake = true;
};
const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

async function runMatch(browser, OUT, ids, into, controls) {
  // WHERE: each character is the LOCAL seat (slot 0 — the camera's subject, driven by no AI),
  // alone in frame on one fixed spot, its two foes on the two arena spawns farthest from it.
  // The spot clears every cover/concealment box by >= 100 wu (180 wu on the camera's side, so
  // nothing tall stands in front), sits >= 450 wu from the pot and >= 250 wu from a slow puddle,
  // and is found by SEARCHING the tree's own `tools/arena.gameplay.json` nearest the centre —
  // derived, never a retyped map literal (CLAUDE.md, map scale). Same spot, same light, for all
  // eleven. WHEN: `simSpeed=0.01`, so 1.2 s of virtual time is 12 ms of sim.
  // History (each REFUSED by looking at the frame): f1_probe's S1/S2 rings at t=2400 — the bots
  // were fighting, shields/freezes/splashes repainted half the cast and two of six stood cut off
  // at the edge; a 3x2 grid put the front row off the bottom; a row of six at 80 wu held the sim
  // to 12 ms and the bots STILL swung on their first step — the hit flash read egg as 99% > 0.8.
  const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
  const boxes = [...(ARENA.cover ?? []), ...(ARENA.concealment ?? [])];
  const spotClear = (x, y) => boxes.every((b) => !(x > b.x - b.w / 2 - 100 && x < b.x + b.w / 2 + 100 && y > b.y - b.h / 2 - 180 && y < b.y + b.h / 2 + 100))
    && (ARENA.hazards ?? []).every((h) => Math.hypot(h.x - x, h.y - y) > (h.kind === 'damage' ? 450 : 250));
  let P = null;
  for (let x = 300; x <= ARENA.width - 300; x += 10) for (let y = 300; y <= ARENA.height - 300; y += 10) {
    if (!spotClear(x, y)) continue;
    const d = Math.hypot(x - ARENA.center.x, y - ARENA.center.y);
    if (!P || d < P.d) P = { x, y, d };
  }
  if (!P) throw new Error('no clear spot in this arena');
  // `?fighters=` honours 3+ entries only (two falls back to the default pair at the default
  // spawns — which is how the first run "measured" hamburger and donut somewhere else).
  const far = [...ARENA.spawns].sort((a, b) => Math.hypot(b.x - P.x, b.y - P.y) - Math.hypot(a.x - P.x, a.y - P.y)).slice(0, 2);
  console.log(`[c1a] spot ${P.x},${P.y} (${Math.round(P.d)} wu from the centre); foes at spawns ${far.map((f) => `${f.x},${f.y} (${Math.round(Math.hypot(f.x - P.x, f.y - P.y))} wu)`).join(' + ')}`);
  const T = Number(arg('--t', 1200));
  for (const id of ids) {
    const foes = IDS.filter((x) => x !== id).slice(0, 2);
    const { context, page, errors } = await newPage(browser, 1600, 900, {});
    const q = new URLSearchParams({ pointerLock: '0', fighters: [`${id}@${P.x},${P.y}`, ...foes.map((f, i) => `${f}@${far[i].x},${far[i].y}`)].join(';'), fogRadius: '1700', simSpeed: '0.01' });
    await page.goto(`${arg('--url-base')}/?${q}`, { waitUntil: 'networkidle', timeout: 300_000 });
    const now = await advance(page, T, NO_SHAKE);
    const res = await page.evaluate(PASS, { yaws: YAWS, remap: REMAP });
    if (res.error) throw new Error(`${id}: ${res.error}`);
    if (REMAP?.[id] && res.remapped === 0) throw new Error(`${id}: --remap named this fighter but changed no material`);
    // only the subject is measured; the far opponent is off-screen by construction
    const subject = `character:${id}`;
    const names = res.perYaw[0].casts.map((c) => c.name);
    for (const y of res.perYaw) y.casts = y.casts.filter((c) => c.name === subject);
    if (!res.perYaw.every((y) => y.casts.length === 1)) throw new Error(`${id}: subject root not found exactly once (scene has ${names.join(', ')})`);
    writeFileSync(join(OUT, `match_${id}_frame.png`), png(res.frameImg));
    for (const c of res.crops.filter((c) => c.name === subject)) {
      const buf = png(c.data); const m = await sharp(buf).metadata();
      await sharp(buf).resize(m.width * 4, m.height * 4, { kernel: 'nearest' }).png().toFile(join(OUT, `match_${id}.png`));
    }
    controls.push({ where: `match ${id}`, t: now, phase: res.phase, NULL: res.NULL, RESTORE: res.RESTORE, errors,
      surround: summarize(res.surround), refused: fold(res, into, 'match') });
    console.log(`[c1a] match ${id} t=${now} phase=${res.phase} NULL=${res.NULL} RESTORE=${res.RESTORE} errors=${errors.length}`);
    await context.close();
  }
}

async function runLobby(browser, OUT, ids, into, controls) {
  for (const id of ids) {
    const storage = { 'food-arena.profile.v1': JSON.stringify({ name: 'C1A', wins: 0, losses: 0, xp: 0, selected: id }) };
    const { context, page, errors } = await newPage(browser, 1600, 900, storage);
    await page.goto(`${arg('--url-base')}/?screen=home`, { waitUntil: 'networkidle', timeout: 300_000 });
    const now = await advance(page, Number(arg('--lobby-t', 4000)));
    const shown = await page.evaluate(() => window.__charStage?.()?.id ?? null);
    if (shown !== id) { controls.push({ where: `lobby ${id}`, refused: [`charStage shows ${shown}, not ${id}`] }); console.log(`[c1a] lobby ${id} REFUSED: shows ${shown}`); await context.close(); continue; }
    const res = await page.evaluate(PASS, { yaws: [0], remap: REMAP });
    if (res.error) throw new Error(`lobby ${id}: ${res.error}`);
    if (REMAP?.[id] && res.remapped === 0) throw new Error(`lobby ${id}: --remap named this fighter but changed no material`);
    await page.screenshot({ path: join(OUT, `lobby_${id}_page.png`) });
    for (const c of res.crops) writeFileSync(join(OUT, `lobby_${id}.png`), png(c.data));
    controls.push({ where: `lobby ${id}`, t: now, NULL: res.NULL, RESTORE: res.RESTORE, errors, surround: summarize(res.surround), refused: fold(res, into, 'lobby') });
    console.log(`[c1a] lobby ${id} t=${now} NULL=${res.NULL} RESTORE=${res.RESTORE} errors=${errors.length}`);
    await context.close();
  }
}

function table(r) {
  const rows = [];
  for (const id of IDS) {
    const m = r.match?.[id], l = r.lobby?.[id];
    const f = (s) => (!s || s.refused ? '   —   ' : `${s.p50.toFixed(3)} ${String(Math.round(s.hi80 * 100)).padStart(3)}% ${s.win ? String(s.win[0]).padStart(3) : '  -'}-${s.win ? String(s.win[1]).padStart(3) : '-'} ${s.winShare ?? '-'}`);
    rows.push(`${id.padEnd(12)} match ${f(m)} | lobby ${f(l)} | top@58 ${m?.mats?.[0]?.hex ?? '-'} ${m?.mats?.[0]?.share ?? ''}`);
  }
  return rows.join('\n');
}

async function compare(dirA, dirB, sheetDir) {
  const A = JSON.parse(readFileSync(join(dirA, 'c1a.json'), 'utf8'));
  const B = JSON.parse(readFileSync(join(dirB, 'c1a.json'), 'utf8'));
  const lines = ['id            cam    p50 before→after   hi80 before→after   win before→after (share)        hueMean'];
  for (const id of IDS) for (const cam of ['match', 'lobby']) {
    const a = A[cam]?.[id], b = B[cam]?.[id];
    if (!a || !b || a.refused || b.refused) { lines.push(`${id.padEnd(13)} ${cam.padEnd(6)} (missing)`); continue; }
    const band = b.p50 >= 0.45 && b.p50 <= 0.6 ? 'IN ' : 'OUT';
    const hi = b.hi80 <= 0.15 ? 'ok' : 'HI';
    lines.push(`${id.padEnd(13)} ${cam.padEnd(6)} ${a.p50.toFixed(3)}→${b.p50.toFixed(3)} ${band}  ${(a.hi80 * 100).toFixed(1).padStart(5)}%→${(b.hi80 * 100).toFixed(1).padStart(5)}% ${hi}   ${a.win?.join('-')} (${a.winShare})→${b.win?.join('-')} (${b.winShare})   ${a.hueMean}→${b.hueMean}  C ${a.C}→${b.C}`);
  }
  console.log(lines.join('\n'));
  if (!sheetDir) return;
  mkdirSync(sheetDir, { recursive: true });
  const H = 300;
  const tile = async (p, label) => {
    if (!existsSync(p)) return sharp({ create: { width: H, height: H, channels: 3, background: '#404040' } }).png().toBuffer();
    const t = await sharp(p).resize({ height: H, kernel: 'nearest' }).png().toBuffer();
    void label; return t;
  };
  for (const cam of ['match', 'lobby']) {
    const rows = [];
    for (const id of IDS) {
      const pick = (dir) => {
        if (cam === 'lobby') return join(dir, `lobby_${id}.png`);
        return join(dir, `match_${id}.png`);
      };
      const [ta, tb] = await Promise.all([tile(pick(dirA), 'before'), tile(pick(dirB), 'after')]);
      const ma = await sharp(ta).metadata(), mb = await sharp(tb).metadata();
      const w = ma.width + mb.width + 12;
      rows.push(await sharp({ create: { width: w, height: H, channels: 3, background: '#202020' } })
        .composite([{ input: ta, left: 0, top: 0 }, { input: tb, left: ma.width + 12, top: 0 }]).png().toBuffer());
    }
    // two columns of rows
    const metas = await Promise.all(rows.map((r) => sharp(r).metadata()));
    const colW = Math.max(...metas.map((m) => m.width));
    const half = Math.ceil(rows.length / 2);
    const comp = rows.map((r, i) => ({ input: r, left: i < half ? 0 : colW + 24, top: (i % half) * (H + 10) }));
    await sharp({ create: { width: 2 * colW + 24, height: half * (H + 10), channels: 3, background: '#101010' } })
      .composite(comp).png().toFile(join(sheetDir, `sheet_${cam}.png`));
    console.log('sheet ->', join(sheetDir, `sheet_${cam}.png`), `(rows: ${IDS.join(', ')}; each row before | after)`);
  }
}

async function main() {
  if (arg('--compare')) { const i = argv.indexOf('--compare'); await compare(argv[i + 1], argv[i + 2], arg('--sheet')); return; }
  const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
  if (!BASE || BASE.includes(':5173')) { console.error('c1a_probe: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }
  argv.push('--url-base', BASE);
  const OUT = resolve(String(arg('--out', 'shots/rv/c1a/run')));
  mkdirSync(OUT, { recursive: true });
  const SETS = String(arg('--sets', 'match,lobby')).split(',');
  const ids = arg('--ids') ? String(arg('--ids')).split(',') : IDS;
  const angle = arg('--angle', 'metal');
  const LAUNCH = angle === 'metal'
    ? { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--force-color-profile=srgb', '--disable-threaded-animation'] }
    : { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--disable-threaded-animation'] };
  const browser = await chromium.launch(LAUNCH);
  const result = { base: BASE, angle, at: new Date().toISOString(), controls: [] };
  try {
    const warm = await browser.newPage();
    await warm.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    await warm.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500)); await warm.close();
    if (SETS.includes('match')) { const into = {}; await runMatch(browser, OUT, ids, into, result.controls); result.match = finish(into); }
    if (SETS.includes('lobby')) { const into = {}; await runLobby(browser, OUT, ids, into, result.controls); result.lobby = finish(into); }
  } finally { await browser.close(); }
  const bad = result.controls.filter((c) => c.NULL !== 0 || c.RESTORE !== 0 || (c.refused && c.refused.length) || (c.errors && c.errors.length));
  const lowCover = Object.entries({ ...(result.match ?? {}) }).filter(([, s]) => s.idCover !== undefined && s.idCover < 0.8).map(([id, s]) => `${id} ${s.idCover}`);
  result.void = bad.length > 0 || lowCover.length > 0;
  writeFileSync(join(OUT, 'c1a.json'), JSON.stringify(result, null, 1));
  console.log(table(result));
  for (const c of result.controls) console.log(`[control] ${c.where}: NULL ${c.NULL} RESTORE ${c.RESTORE} refused ${JSON.stringify(c.refused ?? [])} errors ${c.errors?.length ?? 0} surround p50 ${c.surround?.p50} hue ${c.surround?.hueMean}`);
  if (lowCover.length) console.log(`[control] IDCOVER below 0.8: ${lowCover.join(', ')}`);
  console.log(result.void ? 'VOID — a control failed (see above)' : 'controls OK', '->', OUT);
  process.exit(result.void ? 1 : 0);
}

if (IS_MAIN) await main();
