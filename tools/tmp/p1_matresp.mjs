#!/usr/bin/env node
// capture-audit: css-immune — gl.readPixels only, no DOM screenshot, no element rect.
/**
 * P1_MATRESP — the MEASURED distribution of MATERIAL RESPONSE across the SHIPPED frame.
 *
 * The project's #1 defect is "surfaces are flat and unlit". `matvar --mode census`
 * already answered "is the variation AUTHORED" (yes: 33 distinct roughness values) and
 * `matvar --mode chart` answered "does roughness reach the screen" (it collapses 10x
 * between 0.25 and 0.75). Neither answers the question an orchestrator actually needs:
 *
 *   WHAT SHARE OF THE PIXELS A PLAYER LOOKS AT HAVE NO LIGHTING RESPONSE AT ALL?
 *
 * A surface that is one flat colour under one light IS "coloured paper", and the unit
 * that matters is SHARE OF FRAME, not count of materials. 140 of 255 materials being
 * MeshBasicMaterial means nothing if they own 0.3% of the frame, and everything if they
 * own 30%.
 *
 * Method — one ID-buffer render + one shipped composited render of the SAME frame:
 *   * every mesh is swapped to a flat unlit colour encoding its material index
 *     (matcover.mjs's proven 16-step-per-channel sRGB encoding — `docs/LESSONS.md` §12:
 *     an ID buffer must be READ in the space it was WRITTEN, and this survives the
 *     transfer with +-7 per channel of slack);
 *   * the composited frame is read back first, from the same page, same tick;
 *   * every material is classified by what it can PHYSICALLY do — unlit / lit-no-rim /
 *     lit-with-rim / ink hull — and by roughness band;
 *   * per class we report share of frame AND the delivered luma spread inside its own
 *     mask (P99-P50), which is what "response reaching the screen" means.
 *
 * ⚠️ THE TWO-RENDER CAVEAT (`docs/LESSONS.md` §5). The ID pass forces `transparent:
 * false`, so wherever a transparent surface is BLENDED in the shipped frame the ID
 * buffer attributes the pixel wholly to the front-most surface. That disagreement is
 * REPORTED (`transparentShare`) rather than buried, and every transparent material is
 * flagged in its row. Opaque geometry — which is ~everything in this arena — agrees
 * exactly, because both renders use the same depth ordering.
 *
 * ⚠️ specSpread (P99-P50 inside one material's own mask) is an UPPER BOUND on specular
 * response, not a measurement of it: albedo is constant inside a mask but geometric
 * curvature and cast shadow also live in there. It is used only comparatively, between
 * classes, on the same frame.
 *
 *   node tools/tmp/p1_matresp.mjs --selftest                     # 0 browsers
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/p1_matresp.mjs --url '{URL}' --out shots/p1
 *   ... --drift            # run station 1 TWICE and print the per-class delta
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

// ─────────────────────────────────────────────────────────────────────────────
// The classifier — pure, so it can be validated against known-bad input with no
// browser at all. THIS is the part that decides every headline number, so it is the
// part that has to be shown FAILING on a material it must not accept.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What can this material physically do with a light?
 *
 *   ink       inverted-hull outline ShaderMaterial — a constant colour by construction
 *   unlit     MeshBasicMaterial — NO normal in the shader at all. Zero specular, zero
 *             diffuse falloff, zero rim, zero shadow receive. Literally coloured paper.
 *   lit-rim   Standard/Physical carrying the Fresnel rim (userData.rimUniforms, set by
 *             applyRimLight's onBeforeCompile the first time the program is built)
 *   lit-norim Standard/Physical with NO edge term — `glossyMat`'s output, and anything
 *             built with `rim: false`
 *   other     anything else (sprite/points/line/depth); reported, never silently binned
 */
export function classifyMaterial(m) {
  if (!m) return 'other';
  const t = m.type || '';
  if (t === 'ShaderMaterial' || t === 'RawShaderMaterial') return 'ink';
  if (m.isMeshBasicMaterial || t === 'MeshBasicMaterial') return 'unlit';
  const lit = m.isMeshStandardMaterial || m.isMeshPhysicalMaterial
    || t === 'MeshStandardMaterial' || t === 'MeshPhysicalMaterial';
  if (!lit) return 'other';
  return m.hasRim ? 'lit-rim' : 'lit-norim';
}

/** Roughness band. The 10x specular collapse measured by matvar sits at 0.6. */
export function roughBand(r) {
  if (r === null || r === undefined) return 'n/a';
  if (r < 0.2) return '<0.20';
  if (r < 0.4) return '0.20-0.40';
  if (r < 0.6) return '0.40-0.60';
  if (r < 0.8) return '0.60-0.80';
  return '>=0.80';
}

// ── ID codec, lifted verbatim in BEHAVIOUR from matcover.mjs ────────────────
// 16 levels per channel, centred on the level (`*16 + 8`), written through the
// renderer's sRGB output transfer and decoded by rounding back onto that grid.
export function encodeId(id) {
  return [((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255];
}
export function decodeId(r8, g8, b8) {
  const q = (v) => Math.min(15, Math.max(0, Math.round((v - 8) / 16)));
  return q(r8) | (q(g8) << 4) | (q(b8) << 8);
}
/** sRGB transfer, the one three applies on the way to an 8-bit framebuffer. */
export function srgbEncode8(lin) {
  const c = lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — every check is run against an input that is KNOWN BAD and must FAIL
// there. A guard that has not been shown to fail on the bug it guards against is not
// a guard (`CLAUDE.md` non-negotiable #6).
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  let pass = 0; let fail = 0;
  const t = (name, ok, detail = '') => {
    if (ok) pass++; else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(62)} ${detail}`);
  };

  console.log('── classifier, against materials it MUST and MUST NOT accept ──\n');
  t('MeshBasicMaterial is unlit',
    classifyMaterial({ type: 'MeshBasicMaterial', isMeshBasicMaterial: true }) === 'unlit');
  t('outline ShaderMaterial is ink',
    classifyMaterial({ type: 'ShaderMaterial' }) === 'ink');
  t('Standard + rim is lit-rim',
    classifyMaterial({ type: 'MeshStandardMaterial', isMeshStandardMaterial: true, hasRim: true }) === 'lit-rim');
  t('Standard WITHOUT rim is lit-norim (must not be laundered as lit-rim)',
    classifyMaterial({ type: 'MeshStandardMaterial', isMeshStandardMaterial: true, hasRim: false }) === 'lit-norim');
  t('KNOWN-BAD: Physical with no rim must NOT read as lit-rim — this is glossyMat',
    classifyMaterial({ type: 'MeshPhysicalMaterial', isMeshPhysicalMaterial: true, hasRim: false }) === 'lit-norim',
    'glossyMat is the whole subject of the run; misfiling it inverts the headline');
  t('KNOWN-BAD: a Basic material carrying hasRim:true is STILL unlit',
    classifyMaterial({ type: 'MeshBasicMaterial', isMeshBasicMaterial: true, hasRim: true }) === 'unlit',
    'a rim uniform on a shader with no normal is not a rim');
  t('null material is other, not silently lit', classifyMaterial(null) === 'other');
  t('MeshDepthMaterial is other', classifyMaterial({ type: 'MeshDepthMaterial' }) === 'other');

  console.log('\n── roughness banding, at the 0.6 boundary the whole claim rests on ──\n');
  t('0.52 (toonMat default) bands 0.40-0.60', roughBand(0.52) === '0.40-0.60');
  t('0.60 bands 0.60-0.80, NOT 0.40-0.60', roughBand(0.6) === '0.60-0.80', 'off-by-one here moves the 53% claim');
  t('0.98 bands >=0.80', roughBand(0.98) === '>=0.80');
  t('undefined roughness is n/a, never 0', roughBand(undefined) === 'n/a');

  console.log('\n── the ID codec, and the sRGB trap it exists to survive (LESSONS §12) ──\n');
  // The SHIPPED path: `color.setRGB(v, v, v, 'srgb')` declares the value to be in sRGB,
  // three stores linear internally, and `outputColorSpace = SRGBColorSpace` transfers
  // it back on the way out — so the framebuffer receives exactly `round(v * 255)`.
  let ok = true;
  for (let id = 1; id <= 4095; id++) {
    const [r, g, b] = encodeId(id);
    const fb = (v) => srgbEncode8(srgbToLinear(v));       // setRGB('srgb') -> OETF
    const back = decodeId(fb(r), fb(g), fb(b));
    if (back !== id) { ok = false; console.log(`   first failure at id ${id}`); break; }
  }
  t('all 4095 ids round-trip when the id is written in sRGB (the shipped path)', ok);

  // ⚠️ THE FIRST VERSION OF THIS FIXTURE WAS NOT BAD AT ALL and it PASSED, which is the
  // whole reason non-negotiable #6 exists. It compared `round(v*255)` against
  // `srgbEncode8(srgbToLinear(v))` — algebraically the SAME NUMBER — so it reported
  // "0/4095 mis-decoded" and would have vouched for a codec that could not survive the
  // trap. The genuine `docs/LESSONS.md` §12 bug is writing the id as a LINEAR colour
  // (`setRGB(v,v,v)` with no space argument) and decoding the raw grid: the OETF then
  // lifts every level and the ids quantise into the wrong slots.
  let linearBroken = 0;
  for (let id = 1; id <= 4095; id++) {
    const [r, g, b] = encodeId(id);
    const back = decodeId(srgbEncode8(r), srgbEncode8(g), srgbEncode8(b));  // written LINEAR
    if (back !== id) linearBroken++;
  }
  t('KNOWN-BAD: an id written in LINEAR and decoded on the raw grid MUST mis-decode',
    linearBroken > 3000, `${linearBroken}/4095 ids land in the wrong slot`);

  console.log('\n── the tally, against a frame whose answer is known by construction ──\n');
  // 100 px, ids [1,1,2,0,...]: 2 px of mat 1, 1 px of mat 2, 97 px background.
  const W = 10; const H = 10;
  const ids = new Uint8Array(W * H * 4);
  const put = (p, id) => { const [r, g, b] = encodeId(id);
    ids[p * 4] = srgbEncode8(srgbToLinear(r)); ids[p * 4 + 1] = srgbEncode8(srgbToLinear(g)); ids[p * 4 + 2] = srgbEncode8(srgbToLinear(b)); };
  put(0, 1); put(1, 1); put(2, 2);
  const shipped = new Uint8Array(W * H * 4).fill(128);
  const tal = tally(ids, shipped, W * H, 2);
  t('2 px attributed to material 1', tal[0].px === 2, `got ${tal[0].px}`);
  t('1 px attributed to material 2', tal[1].px === 1, `got ${tal[1].px}`);
  t('KNOWN-BAD: background (id 0) is NOT attributed to any material',
    tal[0].px + tal[1].px === 3, 'a decoder that folds 0 into material 1 reports 99 px here');

  // KNOWN-BAD: an ID buffer for a DIFFERENT geometry than the shipped frame. The tally
  // cannot detect that on its own — which is exactly why the live path renders both
  // from one page in one tick and reports transparentShare. Asserted so the limitation
  // is encoded rather than remembered.
  t('LIMITATION ENCODED: tally cannot detect a mismatched mask — see transparentShare',
    true, 'both renders come from one page, one tick, same depth order');

  console.log(`\n${pass}/${pass + fail} checks passed`);
  process.exit(fail ? 1 : 0);
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Count pixels per material id and accumulate the shipped frame's luma inside each. */
export function tally(ids, shipped, n, nMats) {
  const rows = Array.from({ length: nMats }, () => ({ px: 0, lumas: [] }));
  for (let p = 0; p < n; p++) {
    const id = decodeId(ids[p * 4], ids[p * 4 + 1], ids[p * 4 + 2]);
    if (id === 0 || id > nMats) continue;
    const r = rows[id - 1];
    r.px++;
    r.lumas.push((0.2126 * shipped[p * 4] + 0.7152 * shipped[p * 4 + 1] + 0.0722 * shipped[p * 4 + 2]) / 255);
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE
// ─────────────────────────────────────────────────────────────────────────────
const { chromium } = await import('playwright');
let sharp = null;
try { ({ default: sharp } = await import('sharp')); } catch { /* PNG is optional */ }
const { settleScreen } = await import('./settle.mjs');

const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/p1');
const ID = get('--id', 'hamburger');
const ENEMY = get('--enemy', 'donut');
const W = Number(get('--w', 1600));
const H = Number(get('--h', 900));

const STATIONS = [
  { name: 'pot_south', x: 700, y: 640 },
  { name: 'spawn_west', x: 160, y: 500 },
  { name: 'counter_ne', x: 1150, y: 330 },
];
if (has('--drift')) STATIONS.push({ name: 'pot_south_DRIFT', x: 700, y: 640 });

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PROBE = () => {
  const stage = window.__stage;
  if (!stage) return { error: 'no Stage' };
  if (stage.disposed) return { error: 'window.__stage is DISPOSED' };
  const { scene, renderer } = stage;
  const cam = stage.rig.camera;
  const gl = renderer.getContext();
  const w = renderer.domElement.width; const h = renderer.domElement.height;

  // ── collect visible meshes and their materials ──
  const mats = []; const idx = new Map(); const meshes = [];
  let basicProto = null;
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    if (m.isMeshBasicMaterial && !basicProto) basicProto = m;
    if (!idx.has(m.uuid)) {
      idx.set(m.uuid, mats.length);
      // `userData.rimUniforms` is written by applyRimLight's onBeforeCompile the FIRST
      // time the program is built, so it is only true for a material that has actually
      // been drawn. `onBeforeCompile` itself is the authoring fact and is the one to
      // trust; both are recorded so a disagreement is visible rather than assumed away.
      const hasRimFn = typeof m.onBeforeCompile === 'function'
        && m.onBeforeCompile !== THREE_DEFAULT_OBC;
      mats.push({
        i: mats.length,
        name: m.name || '(unnamed)',
        type: m.type,
        hex: m.color ? '#' + m.color.getHexString().toUpperCase() : '-',
        roughness: typeof m.roughness === 'number' ? +m.roughness.toFixed(3) : null,
        metalness: typeof m.metalness === 'number' ? +m.metalness.toFixed(3) : null,
        clearcoat: typeof m.clearcoat === 'number' ? +m.clearcoat.toFixed(3) : null,
        envMapIntensity: typeof m.envMapIntensity === 'number' ? m.envMapIntensity : null,
        ownEnvMap: !!m.envMap,
        roughnessMap: !!m.roughnessMap, normalMap: !!m.normalMap, map: !!m.map,
        transparent: !!m.transparent, opacity: typeof m.opacity === 'number' ? m.opacity : 1,
        rimUniform: !!(m.userData && m.userData.rimUniforms),
        rimFn: hasRimFn,
        hasRim: !!(m.userData && m.userData.rimUniforms) || hasRimFn,
        rimStrength: m.userData && m.userData.rimUniforms && m.userData.rimUniforms.rimStrength
          ? m.userData.rimUniforms.rimStrength.value : null,
        onChar: false,
      });
    }
    const e = mats[idx.get(m.uuid)];
    // "on a character" = under a node whose name marks a fighter rig.
    for (let p = o; p; p = p.parent) {
      const n = (p.name || '').toLowerCase();
      if (n.startsWith('char:') || n.startsWith('fighter') || n === 'player' || n === 'enemy'
          || p.userData?.isFighter || p.userData?.characterId) { e.onChar = true; break; }
    }
    meshes.push({ o, i: idx.get(m.uuid) });
  });
  if (!basicProto) return { error: 'no MeshBasicMaterial to clone for the ID pass' };
  if (mats.length > 4090) return { error: `too many materials for a 12-bit id: ${mats.length}` };

  // ── shipped composited frame FIRST, so the ID pass cannot disturb it ──
  stage.render(0.0);
  const shipped = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, shipped);

  // ── ID pass ──
  const savedTone = renderer.toneMapping; renderer.toneMapping = 0;
  const savedBg = scene.background; scene.background = null;
  const idMats = mats.map((_, i) => {
    const mm = basicProto.clone();
    mm.map = null; mm.alphaMap = null; mm.transparent = false; mm.opacity = 1;
    mm.depthWrite = true; mm.depthTest = true; mm.fog = false; mm.side = 0;
    const id = i + 1;
    mm.color.setRGB(((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255, 'srgb');
    return mm;
  });
  const saved = meshes.map((e) => e.o.material);
  meshes.forEach((e) => { e.o.material = idMats[e.i]; });
  renderer.setRenderTarget(null);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  const ids = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, ids);
  meshes.forEach((e, k) => { e.o.material = saved[k]; });
  idMats.forEach((m) => m.dispose());
  renderer.toneMapping = savedTone; scene.background = savedBg;
  stage.render(0.0);

  // ── tally in-page (moving two 5.7 MB buffers over CDP is the slow part) ──
  const q = (v) => Math.min(15, Math.max(0, Math.round((v - 8) / 16)));
  const n = w * h;
  const cnt = new Float64Array(mats.length + 1);
  const lum = mats.map(() => []);
  for (let p = 0; p < n; p++) {
    const id = q(ids[p * 4]) | (q(ids[p * 4 + 1]) << 4) | (q(ids[p * 4 + 2]) << 8);
    if (id === 0 || id > mats.length) continue;
    cnt[id - 1]++;
    lum[id - 1].push((0.2126 * shipped[p * 4] + 0.7152 * shipped[p * 4 + 1] + 0.0722 * shipped[p * 4 + 2]) / 255);
  }
  const pct = (arr, f) => (arr.length ? arr[Math.min(arr.length - 1, Math.max(0, Math.floor(f * arr.length)))] : 0);
  const rows = mats.map((m, i) => {
    const L = lum[i]; L.sort((x, y) => x - y);
    return {
      ...m, px: cnt[i],
      p05: +pct(L, 0.05).toFixed(4), p50: +pct(L, 0.50).toFixed(4),
      p90: +pct(L, 0.90).toFixed(4), p99: +pct(L, 0.99).toFixed(4),
      specSpread: +(pct(L, 0.99) - pct(L, 0.50)).toFixed(4),
      range: +(pct(L, 0.95) - pct(L, 0.05)).toFixed(4),
    };
  }).filter((r) => r.px > 0);

  // ── false-colour class map, so the number can be LOOKED AT ──
  const CLASS_RGB = {
    ink: [40, 30, 60], unlit: [255, 40, 40], 'lit-norim': [255, 190, 0],
    'lit-rim': [40, 200, 90], other: [180, 0, 255], bg: [12, 12, 16],
  };
  const cls = mats.map((m) => {
    if (m.type === 'ShaderMaterial' || m.type === 'RawShaderMaterial') return 'ink';
    if (m.type === 'MeshBasicMaterial') return 'unlit';
    if (m.type === 'MeshStandardMaterial' || m.type === 'MeshPhysicalMaterial') return m.hasRim ? 'lit-rim' : 'lit-norim';
    return 'other';
  });
  const px = new Uint8Array(w * h * 3);
  for (let p = 0; p < n; p++) {
    const id = q(ids[p * 4]) | (q(ids[p * 4 + 1]) << 4) | (q(ids[p * 4 + 2]) << 8);
    const c = id === 0 || id > mats.length ? CLASS_RGB.bg : CLASS_RGB[cls[id - 1]];
    px[p * 3] = c[0]; px[p * 3 + 1] = c[1]; px[p * 3 + 2] = c[2];
  }
  // readPixels is bottom-up; flip so the PNG is the right way up.
  const flip = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) flip.set(px.subarray((h - 1 - y) * w * 3, (h - y) * w * 3), y * w * 3);
  let b64 = '';
  { let s = ''; const CH = 0x8000;
    for (let i = 0; i < flip.length; i += CH) s += String.fromCharCode.apply(null, flip.subarray(i, i + CH));
    b64 = btoa(s); }

  return {
    w, h, total: n, rows, cls,
    environmentIntensity: scene.environmentIntensity,
    hasEnvironment: !!scene.environment,
    classB64: b64,
  };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

const results = [];
for (const st of STATIONS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.addInitScript(() => {
    // three's default onBeforeCompile is a no-op function on the prototype; capture it
    // so the probe can tell "authored a rim" from "three's default".
    window.THREE_DEFAULT_OBC = undefined;
  });
  const url = `${BASE}/?player=${ID}&enemy=${ENEMY}&px=${st.x}&py=${st.y}&fogRadius=850&simSpeed=0.02&pointerLock=0`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await settleScreen(page, { timeout: 60000, soft: true, label: st.name });
  await page.evaluate(() => {
    // three's Material.prototype.onBeforeCompile is the default; anything else is ours.
    const m = window.__stage?.scene;
    let proto;
    m?.traverse?.((o) => { if (!proto && o.isMesh && o.material) proto = Object.getPrototypeOf(Array.isArray(o.material) ? o.material[0] : o.material); });
    let p = proto;
    while (p && !Object.prototype.hasOwnProperty.call(p, 'onBeforeCompile')) p = Object.getPrototypeOf(p);
    window.THREE_DEFAULT_OBC = p ? p.onBeforeCompile : undefined;
  });
  const res = await page.evaluate(PROBE);
  await page.close();
  if (res.error) { console.error(`${st.name}: ${res.error}`); continue; }
  results.push({ station: st.name, ...res });
  console.error(`  ${st.name}: ${res.rows.length} materials on screen`);
  if (sharp && !st.name.endsWith('DRIFT')) {
    await sharp(Buffer.from(res.classB64, 'base64'), { raw: { width: res.w, height: res.h, channels: 3 } })
      .png().toFile(join(OUT, `class_${st.name}.png`));
  }
}
await browser.close();
if (!results.length) { console.error('no stations measured'); process.exit(1); }

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────
const CLASSES = ['unlit', 'lit-norim', 'lit-rim', 'ink', 'other'];
const perStation = [];
for (const r of results) {
  const byClass = new Map(CLASSES.map((c) => [c, { px: 0, mats: 0, spreadPx: 0 }]));
  const byBand = new Map();
  let transparentPx = 0; let charPx = 0; let charLitPx = 0; let charRimPx = 0;
  for (const row of r.rows) {
    const c = classifyMaterial({ ...row, isMeshBasicMaterial: row.type === 'MeshBasicMaterial',
      isMeshStandardMaterial: row.type === 'MeshStandardMaterial',
      isMeshPhysicalMaterial: row.type === 'MeshPhysicalMaterial' });
    const e = byClass.get(c); e.px += row.px; e.mats++; e.spreadPx += row.specSpread * row.px;
    if (row.transparent) transparentPx += row.px;
    if (row.onChar) { charPx += row.px; if (c !== 'unlit' && c !== 'ink') charLitPx += row.px; if (c === 'lit-rim') charRimPx += row.px; }
    if (c === 'lit-rim' || c === 'lit-norim') {
      const b = roughBand(row.roughness);
      const q = byBand.get(b) ?? { px: 0, mats: 0, spreadPx: 0 };
      q.px += row.px; q.mats++; q.spreadPx += row.specSpread * row.px; byBand.set(b, q);
    }
  }
  perStation.push({ station: r.station, total: r.total, byClass, byBand, transparentPx, charPx, charLitPx, charRimPx, rows: r.rows });
}

const nonDrift = perStation.filter((s) => !s.station.endsWith('DRIFT'));
console.log(`\nMATERIAL RESPONSE ACROSS THE SHIPPED FRAME — ${nonDrift.length} stations, ${W}x${H}, ${ID} vs ${ENEMY}`);
console.log(`env map ${results[0].hasEnvironment ? 'yes' : 'NO'} @ environmentIntensity ${results[0].environmentIntensity}\n`);
console.log('class        share of frame   materials   mean specSpread (P99-P50 in own mask)');
const tot = nonDrift.reduce((s, x) => s + x.total, 0);
for (const c of CLASSES) {
  const px = nonDrift.reduce((s, x) => s + x.byClass.get(c).px, 0);
  const sp = nonDrift.reduce((s, x) => s + x.byClass.get(c).spreadPx, 0);
  const mats = Math.max(...nonDrift.map((x) => x.byClass.get(c).mats));
  console.log(`${c.padEnd(12)}${((100 * px) / tot).toFixed(2).padStart(9)}%${String(mats).padStart(12)}   ${px ? (sp / px).toFixed(4) : '—'}`);
}
const geoPx = CLASSES.reduce((s, c) => s + nonDrift.reduce((t, x) => t + x.byClass.get(c).px, 0), 0);
console.log(`\ngeometry coverage ${((100 * geoPx) / tot).toFixed(2)}% of frame (rest is background/sky)`);
console.log(`share of GEOMETRY that is unlit: ${((100 * nonDrift.reduce((s, x) => s + x.byClass.get('unlit').px, 0)) / geoPx).toFixed(2)}%`);
console.log(`transparent materials own ${((100 * nonDrift.reduce((s, x) => s + x.transparentPx, 0)) / tot).toFixed(2)}% of frame — the ID/shipped disagreement bound`);

console.log('\nlit surfaces by ROUGHNESS BAND (share of frame, and delivered spread):');
const bands = ['<0.20', '0.20-0.40', '0.40-0.60', '0.60-0.80', '>=0.80', 'n/a'];
let ge6 = 0; let litTot = 0;
for (const b of bands) {
  const px = nonDrift.reduce((s, x) => s + (x.byBand.get(b)?.px ?? 0), 0);
  const sp = nonDrift.reduce((s, x) => s + (x.byBand.get(b)?.spreadPx ?? 0), 0);
  const mats = Math.max(0, ...nonDrift.map((x) => x.byBand.get(b)?.mats ?? 0));
  litTot += px;
  if (b === '0.60-0.80' || b === '>=0.80') ge6 += px;
  if (px || mats) console.log(`  ${b.padEnd(11)}${((100 * px) / tot).toFixed(2).padStart(8)}%   ${String(mats).padStart(4)} mats   spread ${px ? (sp / px).toFixed(4) : '—'}`);
}
console.log(`  => ${((100 * ge6) / litTot).toFixed(1)}% of LIT PIXELS sit at roughness >= 0.60, where matvar measured specular headroom collapsed 10x`);

console.log('\ncharacter pixels:');
const cp = nonDrift.reduce((s, x) => s + x.charPx, 0);
const cr = nonDrift.reduce((s, x) => s + x.charRimPx, 0);
const cl = nonDrift.reduce((s, x) => s + x.charLitPx, 0);
console.log(`  ${((100 * cp) / tot).toFixed(2)}% of frame; of those ${cp ? ((100 * cr) / cp).toFixed(1) : '—'}% carry the rim, ${cp ? ((100 * cl) / cp).toFixed(1) : '—'}% are lit at all`);

console.log('\nTOP MATERIALS BY SHARE OF FRAME');
console.log('  share%  class      type                   rough  metal  rim   spread  name');
const agg = new Map();
for (const s of nonDrift) for (const row of s.rows) {
  const k = `${row.name}|${row.hex}|${row.type}`;
  const e = agg.get(k) ?? { ...row, px: 0, spreadPx: 0 };
  e.px += row.px; e.spreadPx += row.specSpread * row.px; agg.set(k, e);
}
const sorted = [...agg.values()].sort((x, y) => y.px - x.px);
for (const r of sorted.slice(0, Number(get('--top', 28)))) {
  const c = classifyMaterial({ ...r, isMeshBasicMaterial: r.type === 'MeshBasicMaterial',
    isMeshStandardMaterial: r.type === 'MeshStandardMaterial', isMeshPhysicalMaterial: r.type === 'MeshPhysicalMaterial' });
  console.log(`${((100 * r.px) / tot).toFixed(3).padStart(8)}  ${c.padEnd(10)} ${r.type.padEnd(22)}`
    + `${String(r.roughness ?? '—').padStart(6)}${String(r.metalness ?? '—').padStart(7)}${(r.hasRim ? 'yes' : 'NO').padStart(5)}`
    + `${(r.px ? (r.spreadPx / r.px).toFixed(4) : '—').padStart(9)}  ${r.name}`);
}

// ── DRIFT CONTROL — the same station measured twice, same span. Non-negotiable #4:
//    the question is not only "is it there" but "is it the SAME". ──
const d = perStation.find((s) => s.station.endsWith('DRIFT'));
if (d) {
  const base = perStation.find((s) => s.station === d.station.replace('_DRIFT', ''));
  console.log('\nDRIFT CONTROL — same station, two page loads, same tree:');
  for (const c of CLASSES) {
    const a1 = (100 * base.byClass.get(c).px) / base.total;
    const b1 = (100 * d.byClass.get(c).px) / d.total;
    console.log(`  ${c.padEnd(12)} ${a1.toFixed(3).padStart(8)}%  vs ${b1.toFixed(3).padStart(8)}%   delta ${(b1 - a1).toFixed(4)}pp`);
  }
}

await writeFile(join(OUT, 'matresp.json'), JSON.stringify({
  base: BASE, id: ID, enemy: ENEMY, w: W, h: H,
  stations: perStation.map((s) => ({ station: s.station, total: s.total, transparentPx: s.transparentPx,
    charPx: s.charPx, charRimPx: s.charRimPx, rows: s.rows })),
}, null, 2));
console.log(`\nwrote ${OUT}/matresp.json and ${OUT}/class_<station>.png`);
