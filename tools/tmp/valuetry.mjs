#!/usr/bin/env node
/**
 * VALUE TRY — score a candidate PALETTE without editing a single source file.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * `docs/LESSONS.md` §2: probe before you loop. The value-ladder task is "give the cast
 * a dark rung", and the naive loop is edit-a-hex / rebuild / re-run `valuescan --mode
 * chars` (≈9 min for the cast). That is the shape of loop this project has repeatedly
 * paid 300k tokens for and got nothing from.
 *
 * `tools/tmp/albedoprobe.mjs` already measured the transfer function through lighting
 * and the post chain — `screenL ≈ 0.66·albedoL + 0.30`, i.e. **an albedo of luma 0
 * still lands at 0.30 on screen**, which is already above the ≤0.18 gate. So the
 * question "what albedo do I write" has no answer by arithmetic; it needs the renderer.
 *
 * This runs the renderer. It applies a candidate palette AT RUNTIME, by the same
 * semantics as editing the constant — **every material in the character whose colour
 * equals `from` becomes `to`** — and reports the exact `valuescan --mode gate` inputs
 * before and after, ON THE SAME PAGE LOAD. Same frame, same lighting, same post chain,
 * one variable.
 *
 * It also exposes the one non-albedo lever a character file legitimately owns:
 * `toonMat({ rimStrength })`. The rim is `gl_FragColor.rgb += rimColor * pow(1-NdotV,
 * 2.6) * strength` — ADDITIVE and independent of albedo, so on a near-black surface it
 * is the dominant term and it is a large part of why albedo alone cannot reach the dark
 * end. `rim` here recompiles the material with a new strength (or none).
 *
 * ⚠️ It does NOT and MUST NOT touch `src/render/lighting.ts` (a peer owns it, and a
 * measured sweep already showed retuning the rim LIGHT is worth ≤ +0.012 of
 * figure/ground before it inverts). This is the per-material Fresnel in `toon.ts`,
 * which every character file already passes per call site.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/headserve.mjs --overlay src/characters -- \
 *     node tools/tmp/valuetry.mjs --plan tools/tmp/valueplan.json
 *
 * plan format:
 *   { "egg": [ { "from": "#FFF8EA", "to": "#E8DCC6" },
 *              { "from": "#E4C2E8", "to": "#4A3358", "rim": 0.10 } ], ... }
 *
 * `--sweep <id> <fromHex> <h1,h2,...>` scores one constant at several values instead.
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { VL_SRC } from './valuelib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const PLAN = get('--plan', null);
const OUT = get('--out', 'shots/vl/try');
const DSF = Number(get('--dsf', 1));           // 1 = the resolution `--mode gate` reads
const SIM_SPEED = get('--sim-speed', '0.02');
const STATION = { x: Number(get('--px', 700)), y: Number(get('--py', 640)), fog: 850 };
const SWEEP = a.includes('--sweep') ? a.slice(a.indexOf('--sweep') + 1, a.indexOf('--sweep') + 4) : null;
const PARTS = a.includes('--parts');
/** Joint groups, from `src/characters/rig.ts` — the same list valuescan/limbcheck use. */
const JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR',
  'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** One measurement of the live player: ladder + figure/ground, on its own exact matte. */
const MEASURE = (opts) => {
  const stage = window.__stage;
  const r = stage.renderer, scene = stage.scene, cam = stage.rig.camera;
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
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
  const hideEnv = (keep) => { hidden = []; for (const k of scene.children) { if (keep.has(k)) continue; if (k.visible) { hidden.push(k); k.visible = false; } } };
  const restoreEnv = () => { for (const k of hidden) k.visible = true; hidden = []; };
  try {
    let player = null;
    for (const c of casts) if (c.name === `character:${opts.playerId}` && !player) player = c;
    if (!player) return { error: 'player not found' };

    stage.render(0); stage.render(0);
    const full = readRect(0, 0, Wp, Hp);

    hideEnv(new Set([topOf(player)]));
    const others = [];
    for (const o of casts) { if (o !== player && o.visible) { others.push(o); o.visible = false; } }
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    const A = readRect(0, 0, Wp, Hp);
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
    const B = readRect(0, 0, Wp, Hp);
    for (const o of others) o.visible = true;
    restoreEnv();

    const mask = new Uint8Array(Wp * Hp);
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
    for (let j = 0; j < Wp * Hp; j++) {
      const i4 = j * 4;
      const d = Math.max(Math.abs(A[i4] - B[i4]), Math.abs(A[i4 + 1] - B[i4 + 1]), Math.abs(A[i4 + 2] - B[i4 + 2]));
      if (d >= 32) continue;
      mask[j] = 1; n++;
      const x = j % Wp, y = (j / Wp) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (!n) return { error: 'zero character pixels' };
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const pad = Math.max(12, Math.round(0.30 * bh) + 6);
    const cx = Math.max(0, x0 - pad), cy = Math.max(0, y0 - pad);
    const cw = Math.min(Wp - cx, bw + pad * 2), ch = Math.min(Hp - cy, bh + pad * 2);

    const luma = new Float32Array(cw * ch);
    const mc = new Uint8Array(cw * ch);
    const lumas = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const src = ((cy + y) * Wp + (cx + x)) * 4, dst = y * cw + x;
      luma[dst] = window.VL.luma(full[src], full[src + 1], full[src + 2]);
      mc[dst] = mask[(cy + y) * Wp + (cx + x)];
      if (mc[dst]) lumas.push(luma[dst]);
    }
    const ladder = window.VL.ladder(lumas, {});
    const fg = window.VL.figureGround(luma, cw, ch, mc, { ringFrac: 0.30, edgeR: opts.edgeR });
    const out = { ladder, fg, charPx: n, hPx: bh, crop: [cx, cy, cw, ch] };

    // ── PART BOUNDARIES ───────────────────────────────────────────────────
    // The gate's fifth criterion, and the one an albedo pass can get WRONG in a way
    // the ladder cannot see: darkening a whole limb chain at once raises `range` and
    // lowers `p05` while collapsing `shoulderL|elbowL` to nothing. Measured here on
    // the same frame so a candidate is never scored on three of the five numbers.
    //
    // Frontmost-surface attribution, identical in method to `valuescan.mjs --mode
    // chars` (a part owns a pixel when hiding it CHANGES THE COLOUR there, not when
    // it changes coverage — the coverage version reads a limb backed by a torso as
    // 0 px and is plausibly, completely wrong).
    if (opts.parts) {
      hideEnv(new Set([topOf(player)]));
      const others2 = [];
      for (const o of casts) { if (o !== player && o.visible) { others2.push(o); o.visible = false; } }
      const rectDirect = () => {
        scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
        r.setRenderTarget(null); r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
        return readRect(cx, cy, cw, ch);
      };
      const baseDirect = rectDirect();
      const allMeshes = [];
      player.traverse((o) => { if (o.isMesh) allMeshes.push(o); });
      const groups = [];
      for (const name of opts.jointNames) {
        const j = player.getObjectByName(name);
        if (!j) continue;
        const meshes = [];
        j.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
        const own = meshes.filter((mm) => {
          let nn = mm.parent;
          while (nn && nn !== player) {
            if (nn === j) return true;
            if (opts.jointNames.includes(nn.name)) return false;   // belongs to a nearer joint
            nn = nn.parent;
          }
          return false;
        });
        if (!own.length) continue;
        const prev = own.map((mm) => mm.visible);
        own.forEach((mm) => { mm.visible = false; });
        const hid = rectDirect();
        own.forEach((mm, i) => { mm.visible = prev[i]; });
        const owned = new Uint8Array(cw * ch);
        let np = 0;
        for (let k = 0; k < owned.length; k++) {
          if (!mc[k]) continue;
          const i4 = k * 4;
          const d = Math.abs(baseDirect[i4] - hid[i4]) + Math.abs(baseDirect[i4 + 1] - hid[i4 + 1]) + Math.abs(baseDirect[i4 + 2] - hid[i4 + 2]);
          if (d > 12) { owned[k] = 1; np++; }
        }
        groups.push({ name, mask: owned, px: np });
      }
      for (const o of others2) o.visible = true;
      restoreEnv();
      const names = groups.map((g) => g.name);
      const adj = window.VL.adjacency(groups.map((g) => g.mask), names, cw, ch, luma, opts.minContacts);
      const tot = adj.pairs.reduce((s, p) => s + p.contacts, 0);
      out.weakBoundaryPct = tot ? +((100 * adj.pairs.filter((p) => p.dL < 0.10).reduce((s, p) => s + p.contacts, 0)) / tot).toFixed(1) : 0;
      out.weakPairs = adj.pairs.filter((p) => p.dL < 0.10).sort((x, y) => y.contacts - x.contacts).slice(0, 8)
        .map((p) => `${p.a}|${p.b} ${p.dL.toFixed(3)} c${p.contacts}`);
      out.partP50 = names.map((nm, i) => `${nm}:${adj.stats[i].p50 == null ? '-' : adj.stats[i].p50.toFixed(2)}`);
    }
    return out;
  } finally {
    restoreEnv();
    scene.background = savedBg; r.shadowMap.enabled = savedShadow;
    r.setClearColor(0x000000, savedAlpha);
    try { stage.render(0); } catch (e) { /* best effort */ }
  }
};

/** Apply a candidate palette to the live player. Returns what it actually touched. */
const APPLY = (opts) => {
  const scene = window.__stage.scene;
  let player = null;
  scene.traverse((o) => { if (!player && o.name === `character:${opts.playerId}`) player = o; });
  if (!player) return { error: 'player not found' };
  const norm = (h) => String(h).replace('#', '').toUpperCase();
  const seen = new Map();
  const touched = [];
  const pathOf = (m) => { const p = []; let n = m; while (n && n !== player) { if (n.name) p.unshift(n.name); n = n.parent; } return p.join('/'); };
  player.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const path = pathOf(o);
    for (const m of mats) {
      if (!m || !m.color || seen.has(m)) continue;
      const from = m.color.getHexString().toUpperCase();
      for (const rule of opts.rules) {
        if (norm(rule.from) !== from) continue;
        // `path` scopes a rule to ONE material that happens to share a hex with
        // others — e.g. hamburger's mitts and its crown are both `PALETTE.bun` but
        // are two distinct material objects. Materials are matched once, so a rule
        // reaches exactly the objects its first matching mesh carries.
        if (rule.path && !new RegExp(rule.path).test(path)) continue;
        seen.set(m, true);
        if (rule.to) m.color.setHex(parseInt(norm(rule.to), 16));
        if (rule.rim != null) {
          // Re-inject the SAME Fresnel `toon.ts` writes, at a new strength. Kept
          // byte-identical to the shipped shader so this measures strength, not a
          // second implementation of the effect.
          const s = rule.rim, col = rule.rimColor || '#bfe4ff';
          if (s <= 0) m.onBeforeCompile = function () { /* rim off */ };
          else {
            const rc = m.color.clone().setHex(parseInt(norm(col), 16));
            m.onBeforeCompile = function (shader) {
              shader.uniforms.rimColor = { value: rc };
              shader.uniforms.rimStrength = { value: s };
              shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;')
                .replace('#include <dithering_fragment>',
                  '#include <dithering_fragment>\nfloat rimDot = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);\nfloat rim = pow(rimDot, 2.6) * rimStrength;\ngl_FragColor.rgb += rimColor * rim;');
            };
          }
        }
        if (rule.roughness != null) m.roughness = rule.roughness;
        if (rule.metalness != null) m.metalness = rule.metalness;
        m.needsUpdate = true;
        touched.push({ from: '#' + from, to: rule.to || null, rim: rule.rim ?? null });
        break;
      }
    }
  });
  return { touched };
};

// ─────────────────────────────────────────────────────────────────────────────
if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
await mkdir(OUT, { recursive: true });

/** id -> list of candidate rule-sets. A sweep is just N single-rule candidates. */
let plans = {};
if (SWEEP) {
  const [id, from, list] = SWEEP;
  plans[id] = list.split(',').map((to) => ({ label: to, rules: [{ from, to }] }));
} else if (PLAN) {
  const raw = JSON.parse(await readFile(PLAN, 'utf8'));
  for (const [id, v] of Object.entries(raw)) {
    plans[id] = Array.isArray(v) && v.length && v[0].rules ? v : [{ label: 'candidate', rules: v }];
  }
} else { console.error('need --plan <file> or --sweep <id> <fromHex> <hexlist>'); process.exit(2); }

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const results = {};
try {
  for (const [id, cands] of Object.entries(plans)) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: DSF });
    await page.addInitScript({ content: VL_SRC });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
    try {
      const url = `${BASE}/?player=${id}&enemy=donut&px=${STATION.x}&py=${STATION.y}&fogRadius=${STATION.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
      await page.waitForTimeout(900);
      const edgeR = DSF === 1 ? 4 : 4 * DSF;
      const mopts = { playerId: id, edgeR, parts: PARTS, jointNames: JOINTS, minContacts: DSF === 1 ? 8 : 8 * DSF };
      const before = await page.evaluate(MEASURE, mopts);
      if (before.error) { console.error(`✗ ${id}: ${before.error}`); continue; }
      console.log(`\n=== ${id}   h ${before.hPx}px  charPx ${before.charPx}`);
      console.log(`  BASE      range ${before.ladder.range.toFixed(3)}  p05 ${before.ladder.p05.toFixed(3)}  ` +
        `p50 ${before.ladder.p50.toFixed(3)}  p95 ${before.ladder.p95.toFixed(3)}  steps ${before.ladder.steps.j10}  fgdL ${before.fg.dL}` +
        (PARTS ? `  weakB ${before.weakBoundaryPct}%` : ''));
      if (PARTS) { console.log(`            weak: ${before.weakPairs.join('  ')}`); console.log(`            p50:  ${before.partP50.join(' ')}`); }
      results[id] = { before, cands: [] };
      for (const c of cands) {
        // Each candidate needs a clean page: APPLY mutates shared materials in place.
        await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
        await page.waitForTimeout(700);
        const ap = await page.evaluate(APPLY, { playerId: id, rules: c.rules });
        if (ap.error) { console.error(`  ✗ ${c.label}: ${ap.error}`); continue; }
        const after = await page.evaluate(MEASURE, mopts);
        if (after.error) { console.error(`  ✗ ${c.label}: ${after.error}`); continue; }
        const d = (x, y) => (y - x >= 0 ? '+' : '') + (y - x).toFixed(3);
        console.log(`  ${String(c.label).padEnd(28)} range ${after.ladder.range.toFixed(3)} (${d(before.ladder.range, after.ladder.range)})  ` +
          `p05 ${after.ladder.p05.toFixed(3)} (${d(before.ladder.p05, after.ladder.p05)})  ` +
          `p95 ${after.ladder.p95.toFixed(3)}  steps ${after.ladder.steps.j10}  ` +
          `fgdL ${after.fg.dL} (${d(before.fg.dL, after.fg.dL)})  touched ${ap.touched.length}` +
          (PARTS ? `  weakB ${after.weakBoundaryPct}%${after.weakBoundaryPct <= 15 ? ' ✓' : ' ✗'}` : '') +
          (ap.touched.length === 0 ? '   ⚠ NOTHING MATCHED' : ''));
        if (PARTS) { console.log(`    weak: ${after.weakPairs.join('  ')}`); console.log(`    p50:  ${after.partP50.join(' ')}`); }
        results[id].cands.push({ label: c.label, rules: c.rules, touched: ap.touched.length, ladder: after.ladder, fg: after.fg });
      }
    } catch (e) { console.error(`✗ ${id}: ${e}`); } finally { await page.close(); }
  }
} finally { await browser.close(); }
await writeFile(join(OUT, 'try.json'), JSON.stringify(results, null, 2));
console.log(`\nwrote ${OUT}/try.json`);
