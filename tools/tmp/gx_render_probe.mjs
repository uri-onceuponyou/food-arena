#!/usr/bin/env node
/**
 * GX_RENDER_PROBE — the render-pipeline audit's own instrument (2026-10-15 review campaign).
 *
 * READ-ONLY on the tree it measures: every mutation below is PAGE-SIDE, on one frozen frame,
 * and is reverted before the next arm. Nothing here edits a source file.
 *
 * Three modes:
 *
 *   --mode look    one frozen six-seat match frame (pot_south ring, the v2_band station), then
 *                  every --arms entry rendered on THAT frame and saved as a PNG. `shipped` is
 *                  rendered FIRST and LAST and the two must be bit-identical (self-pair), or
 *                  the run says so: an arm that failed to revert would otherwise contaminate
 *                  every row after it.
 *   --mode lobby   the same, on the home screen's character Stage (the pitch-20 lobby camera).
 *   --mode cost    GPU time per frame and per composer pass via EXT_disjoint_timer_query_webgl2
 *                  (needs --angle metal: SwiftShader has no timer query), plus draw calls and
 *                  triangles per pass from `renderer.info` with autoReset off. Controls:
 *                  `ctl:empty` (a query around nothing) must read ~0, `ctl:double` (two renders
 *                  inside one query) must read ~2x shipped — the instrument is validated
 *                  against a known answer before any arm is read.
 *
 * ⚠️ A Metal number is an APPLE M5 PRO number. Same tile-based architecture family as an
 * iPhone's A-series, so RATIOS between arms are meaningful; ABSOLUTE ms are 4-6x optimistic
 * for a phone on core count alone (tools/perf.mjs header). Quote them with that label.
 *
 * Arms (comma list, `name` or `name:param`):
 *   shipped              nothing
 *   noFront              lighting.front.intensity = 0 (environment AND characters)
 *   noPropRim            Fresnel rim strength 0 on every material NOT used by a character mesh
 *   envFront:<x>         front fill set to <x> for the ENVIRONMENT; characters get the missing
 *                        (2.2 - x) re-injected in their own shader (RE_Direct, diffuse + GGX),
 *                        i.e. the character render is UNCHANGED and only the arena loses fill.
 *                        This is the "split rig" mock-up. Always also applies noPropRim.
 *   charSpec[:s]         a view-anchored soft specular lobe on character materials only
 *                        (matcap-like "vinyl" highlight), strength s (default 0.55)
 *   split+spec:<x>       envFront:<x> + charSpec
 *   vsm / pcfsoft / basic   renderer.shadowMap.type 3 / 2 / 0 (recompiles every material)
 *   map:<n>              shadow map edge n
 *   shInt:<x>            key.shadow.intensity = x
 *   noCharInk            hide character `__outline` hulls
 *   solo                 hide every character but slot 0
 *   noPost               draw scene directly, no composer (cost mode)
 *   cached               do not force the shadow map to re-render (cost mode; all others force
 *                        it every frame, which is what a match with moving fighters does)
 *   bloom                build the post chain with bloom on the current tier (tier table edit +
 *                        a forced tier round-trip; reverted after)
 *   ssao                 postprocessing NormalPass + SSAOEffect inserted after the RenderPass
 *                        (the configuration stage.ts documents) — price only
 *   dpr:<x>              renderer pixel ratio x (cost mode)
 *   ctl:empty / ctl:double  instrument controls (cost mode)
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_render_probe.mjs --url '{URL}' --mode look --angle metal \
 *       --arms shipped,noFront,noPropRim,envFront:0.8 --out shots/rv/audit/render/look
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
if (!BASE) { console.error('gx_render_probe: --url (or PREVIEW_BASE) required — never :5173'); process.exit(2); }
const MODE = arg('--mode', 'look');
const OUT = resolve(ROOT, String(arg('--out', 'shots/rv/audit/render/run')));
const ANGLE = arg('--angle', 'metal');
const TIER = arg('--tier', 'high');
const W = Number(arg('--w', 1600));
const H = Number(arg('--h', 900));
const DPR = Number(arg('--dpr', 1));
const TOUCH = has('--touch');
const SEATS = Number(arg('--seats', 6));
const FRAMES = Number(arg('--frames', 24));
const ROSTER = String(arg('--roster', 'soup,sushi,taco,donut,egg,pizza')).split(',').filter(Boolean).slice(0, SEATS);
const RING_WU = Number(arg('--ring', 110));
const ARMS = String(arg('--arms', 'shipped')).split(',').filter(Boolean);
const LABEL = arg('--label', `${MODE}-${TIER}-${W}x${H}@${DPR}`);

const LAUNCH = ANGLE === 'metal'
  ? { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--force-color-profile=srgb'] }
  : { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] };

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
on:noop,off:noop,send:noop,invalidate:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// Station: derived from the arena json, never retyped (CLAUDE.md stale-literal class).
const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const CX = ARENA.center.x, CY = ARENA.center.y;
const POT = ARENA.hazards.find((h) => h.kind === 'damage' && h.x === CX && h.y === CY);
if (!POT || !Number.isFinite(POT.radius)) { console.error('gx_render_probe: no centre pot in arena.gameplay.json'); process.exit(2); }
const ST = { x: CX, y: CY + Math.round(POT.radius * 2.105) };   // pot_south, as v2_band

// ─────────────────────────────────────────────────────────────────────────────
// PAGE-SIDE CODE (installed with addInitScript, so every page carries one copy)
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_LIB = String.raw`
window.GXP = (() => {
  const S = () => window.__stage;
  const isChar = (o) => !!(o.name && o.name.indexOf('character:') === 0);
  const mats = (m) => (Array.isArray(m.material) ? m.material : [m.material]).filter(Boolean);
  const charRoots = () => { const r = []; S().scene.traverse((o) => { if (isChar(o)) r.push(o); }); return r; };
  const charMatSet = () => {
    const set = new Set();
    for (const root of charRoots()) root.traverse((o) => { if (o.isMesh) for (const mm of mats(o)) set.add(mm); });
    return set;
  };
  const allMats = () => {
    const set = new Set();
    S().scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) for (const mm of mats(o)) set.add(mm); });
    return set;
  };
  const recompileAll = () => { for (const m of allMats()) m.needsUpdate = true; S().renderer.shadowMap.needsUpdate = true; };

  // ── shader injection for character materials ──
  const U = {
    gxFillColor: { value: { x: 0, y: 0, z: 0 } },
    gxFillDir: { value: { x: 0, y: 0, z: 1 } },
    gxSpecDir: { value: { x: -0.35, y: 0.62, z: 0.70 } },
    gxSpec: { value: { x: 0.0, y: 0.0, z: 0.0, w: 0.0 } },
    gxSpecColor: { value: { x: 1.0, y: 0.97, z: 0.92 } },
  };
  const INJECT_DECL = '\nuniform vec3 gxFillColor; uniform vec3 gxFillDir; uniform vec3 gxSpecDir; uniform vec4 gxSpec; uniform vec3 gxSpecColor;\n';
  const INJECT_BODY = [
    '',
    '{',
    '  IncidentLight gxL; gxL.color = gxFillColor; gxL.direction = normalize( gxFillDir ); gxL.visible = true;',
    '  if ( dot( gxFillColor, vec3( 1.0 ) ) > 0.0 ) RE_Direct( gxL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
    '  if ( gxSpec.z > 0.0 ) {',
    '    vec3 gxH = normalize( normalize( gxSpecDir ) + geometryViewDir );',
    '    float gxS = smoothstep( gxSpec.x, gxSpec.y, saturate( dot( geometryNormal, gxH ) ) );',
    '    reflectedLight.directSpecular += gxS * gxSpec.z * gxSpecColor;',
    '  }',
    '}',
    '',
  ].join('\n');
  // One patch set at a time, chained onto whatever onBeforeCompile the material already has (the
  // Fresnel rim). flags.lit = the fill/spec terms on lit materials; flags.tag = write alpha 0.5 on
  // every OPAQUE character fragment, so a post pass can find character silhouettes with zero extra
  // draws (the composer buffers are RGBA HalfFloat and opaque draws do not blend alpha).
  let injected = [];
  const ALPHA_TAG = '\n gl_FragColor.a = 0.5;\n';
  const injectChars = (flags) => {
    if (injected.length) return injected.length;
    for (const m of charMatSet()) {
      if (m.isShaderMaterial) continue;
      const lit = !!flags.lit && !!m.isMeshStandardMaterial;
      const tag = !!flags.tag && !m.transparent;
      if (!lit && !tag) continue;
      const prev = m.onBeforeCompile;
      const hadOwnKey = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey');
      const prevKey = m.customProgramCacheKey;
      const key = 'gxinj|' + (lit ? 'L' : '') + (tag ? 'T' : '') + '|' + (prev ? prev.toString().length : 0) + '|' + (m.userData && m.userData.rim ? 'rim' : 'norim');
      m.onBeforeCompile = function (shader, renderer) {
        if (prev) prev.call(this, shader, renderer);
        if (lit) {
          Object.assign(shader.uniforms, U);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>' + INJECT_DECL)
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + INJECT_BODY);
        }
        if (tag) shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>' + ALPHA_TAG);
      };
      m.customProgramCacheKey = function () { return key; };
      m.needsUpdate = true;
      injected.push({ m, prev, hadOwnKey, prevKey });
    }
    return injected.length;
  };
  const uninjectChars = () => {
    for (const e of injected) {
      e.m.onBeforeCompile = e.prev;
      if (e.hadOwnKey) e.m.customProgramCacheKey = e.prevKey; else delete e.m.customProgramCacheKey;
      e.m.needsUpdate = true;
    }
    const n = injected.length; injected = []; return n;
  };

  // ── the screen-space silhouette contour (mock-up of replacing per-part ink hulls) ──
  let PPmod = null;
  const pp = async () => {
    if (PPmod) return PPmod;
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/postprocessing\.js/.test(n));
    if (!url) throw new Error('postprocessing module URL not found in resource timing');
    PPmod = await import(url); return PPmod;
  };
  const INK_GLSL = [
    'uniform float inkWidth;',
    'uniform vec3 inkColor;',
    'float gxCharAt(const in vec2 p) { return 1.0 - smoothstep(0.55, 0.95, texture2D(inputBuffer, p).a); }',
    'void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {',
    '  float selfChar = 1.0 - smoothstep(0.55, 0.95, inputColor.a);',
    '  float cover = 0.0;',
    '  for (int i = 0; i < 16; i++) {',
    '    float a = float(i) * 0.39269908;',
    '    vec2 d = vec2(cos(a), sin(a)) * texelSize;',
    '    cover = max(cover, gxCharAt(uv + d * inkWidth));',
    '    cover = max(cover, gxCharAt(uv + d * inkWidth * 0.5));',
    '  }',
    '  float edge = cover * (1.0 - selfChar);',
    '  outputColor = vec4(mix(inputColor.rgb, inkColor, edge), 1.0);',
    '}',
  ].join('\n');
  let inkPass = null;
  const addInk = async (width) => {
    const PP = await pp(); const st = S(); const comp = st.composer;
    const eff = new PP.Effect('GxInkEffect', INK_GLSL, {
      attributes: PP.EffectAttribute.CONVOLUTION, blendFunction: PP.BlendFunction.SRC,
      uniforms: new Map([['inkWidth', { value: width }], ['inkColor', { value: { x: 0.010, y: 0.007, z: 0.017 } }]]),
    });
    inkPass = new PP.EffectPass(st.rig.camera, eff);
    comp.addPass(inkPass, 1);
    return true;
  };
  // ── convex-edge (bevel) highlight: ContactAO's plane-invariant 1/z second difference, sign-flipped.
  // Concave (t > 0) is what ContactAO already darkens; convex (t < 0) is a crease a bevel would catch
  // light on. Gated to geometry standing > ~0.12 m above the floor (world y from depth), so the
  // floor's grout groove — whose tile lips are convex too — is not redrawn as a network of lines.
  const BEVEL_GLSL = [
    'uniform float cvRadius;',
    'uniform vec2 cvProj;',
    'uniform float cvStrength;',
    'uniform float cvRange;',
    'uniform mat4 cvCamWorld;',
    'uniform float cvLo;',
    'uniform float cvHi;',
    'float cvWorldY(const in vec2 p, const in float vz) {',
    '  vec2 ndc = p * 2.0 - 1.0;',
    '  vec3 vp = vec3(ndc.x * (-vz) / (2.0 * cvProj.x), ndc.y * (-vz) / (2.0 * cvProj.y), vz);',
    '  return (cvCamWorld * vec4(vp, 1.0)).y;',
    '}',
    'void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {',
    '  if (depth >= 0.999999) { outputColor = inputColor; return; }',
    '  float vz = getViewZ(depth);',
    '  float zc = -vz;',
    '  vec2 r = max(cvRadius * cvProj / zc, texelSize);',
    '  float invC = 1.0 / zc;',
    '  float k = (zc * zc) / cvRadius;',
    '  float cvx = 0.0; float valid = 0.0;',
    '  for (int i = 0; i < 4; i++) {',
    '    float ang = float(i) * 0.7853982;',
    '    vec2 d = vec2(cos(ang), sin(ang)) * r;',
    '    float za = max(-getViewZ(readDepth(uv + d)), 1e-4);',
    '    float zb = max(-getViewZ(readDepth(uv - d)), 1e-4);',
    '    float ok = step(max(abs(zc - za), abs(zc - zb)), cvRange);',
    '    float t = (1.0 / za - invC) * k + (1.0 / zb - invC) * k;',
    '    cvx += ok * smoothstep(cvLo, cvHi, -t);',
    '    valid += ok;',
    '  }',
    '  cvx /= max(valid, 1.0);',
    '  float h = smoothstep(0.12, 0.30, cvWorldY(uv, vz)) * smoothstep(0.55, 0.95, inputColor.a);',
    '  vec3 c = inputColor.rgb;',
    '  c += (vec3(1.0) - c) * cvx * cvStrength * h;',
    '  outputColor = vec4(c, inputColor.a);',
    '}',
  ].join('\n');
  let bevelPass = null;
  const addBevel = async (strength, lo = 0.2, hi = 0.9) => {
    const PP = await pp(); const st = S(); const comp = st.composer; const cam = st.rig.camera;
    const e = cam.projectionMatrix.elements;
    const eff = new PP.Effect('GxBevelEffect', BEVEL_GLSL, {
      attributes: PP.EffectAttribute.DEPTH, blendFunction: PP.BlendFunction.SRC,
      uniforms: new Map([
        ['cvRadius', { value: 0.035 }], ['cvProj', { value: { x: 0.5 * e[0], y: 0.5 * e[5] } }],
        ['cvStrength', { value: strength }], ['cvRange', { value: 0.035 * 6 }], ['cvCamWorld', { value: cam.matrixWorld }],
        ['cvLo', { value: lo }], ['cvHi', { value: hi }],
      ]),
    });
    bevelPass = new PP.EffectPass(cam, eff);
    comp.addPass(bevelPass, 1);
    return true;
  };
  const removeBevel = () => { if (!bevelPass) return false; S().composer.removePass(bevelPass); bevelPass.dispose(); bevelPass = null; return true; };

  // ── lobby presentation: depth of field focused on the character (distance taken from the live scene) ──
  let dofPass = null;
  const addDof = async (bokeh) => {
    const PP = await pp(); const st = S(); const comp = st.composer; const cam = st.rig.camera;
    const r = charRoots()[0]; if (!r) throw new Error('no character to focus on');
    r.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    const a = r.matrixWorld.elements, c = cam.matrixWorld.elements;
    const dist = Math.hypot(a[12] - c[12], a[13] + 1.0 - c[13], a[14] - c[14]);
    const eff = new PP.DepthOfFieldEffect(cam, { focusDistance: dist, focusRange: 2.2, bokehScale: bokeh, resolutionScale: 0.5 });
    dofPass = new PP.EffectPass(cam, eff);
    comp.addPass(dofPass, 1);
    return { focus: Number(dist.toFixed(2)) };
  };
  const removeDof = () => { if (!dofPass) return false; S().composer.removePass(dofPass); dofPass.dispose(); dofPass = null; return true; };

  const removeInk = () => { if (!inkPass) return false; S().composer.removePass(inkPass); inkPass.dispose(); inkPass = null; return true; };

  const viewDir = (wx, wy, wz) => {
    const cam = S().rig.camera; cam.updateMatrixWorld(true);
    const e = cam.matrixWorldInverse.elements;
    const x = e[0] * wx + e[4] * wy + e[8] * wz, y = e[1] * wx + e[5] * wy + e[9] * wz, z = e[2] * wx + e[6] * wy + e[10] * wz;
    const l = Math.hypot(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l };
  };

  // ── rim (Fresnel) on non-character materials ──
  let rimSaved = [];
  const propRimOff = () => {
    const chars = charMatSet(); let n = 0, shared = 0;
    for (const m of allMats()) {
      const u = m.userData && m.userData.rimUniforms;
      if (!u || !u.rimStrength) continue;
      if (chars.has(m)) { shared++; continue; }
      rimSaved.push({ u, v: u.rimStrength.value }); u.rimStrength.value = 0; n++;
    }
    return { n, charRims: shared };
  };
  const propRimRestore = () => { for (const e of rimSaved) e.u.rimStrength.value = e.v; const n = rimSaved.length; rimSaved = []; return n; };

  // ── the arms ──
  const base = {};
  const snapshot = () => {
    const st = S(), L = st.lighting;
    base.front = L.front.intensity;
    base.frontColor = { r: L.front.color.r, g: L.front.color.g, b: L.front.color.b };
    base.frontWorld = { x: L.front.position.x - L.front.target.position.x, y: L.front.position.y - L.front.target.position.y, z: L.front.position.z - L.front.target.position.z };
    base.shType = st.renderer.shadowMap.type;
    base.shInt = L.key.shadow.intensity;
    base.shRadius = L.key.shadow.radius;
    base.mapSize = L.key.shadow.mapSize.x;
    base.pr = st.renderer.getPixelRatio();
    return JSON.parse(JSON.stringify(base));
  };
  const hidden = [];
  const hide = (o) => { if (o.visible) { o.visible = false; hidden.push(o); } };
  const unhideAll = () => { while (hidden.length) hidden.pop().visible = true; };

  const apply = async (name, param) => {
    const st = S(), L = st.lighting;
    const info = {};
    switch (name) {
      case 'shipped': case 'cached': case 'noPost': case 'ctl:empty': case 'ctl:double': break;
      case 'noFront': L.front.intensity = 0; break;
      case 'noPropRim': Object.assign(info, propRimOff()); break;
      case 'envFront': case 'split+spec': case 'charSpec': case 'spec2': case 'combo': {
        const env = (name === 'charSpec' || name === 'spec2') ? base.front : Number(param ?? 0.8);
        if (name === 'envFront' || name === 'split+spec' || name === 'combo') { Object.assign(info, propRimOff()); L.front.intensity = env; }
        const add = Math.max(0, base.front - env);
        U.gxFillDir.value = viewDir(base.frontWorld.x, base.frontWorld.y, base.frontWorld.z);
        U.gxFillColor.value = { x: base.frontColor.r * add, y: base.frontColor.g * add, z: base.frontColor.b * add };
        if (name === 'charSpec' || name === 'split+spec') {
          // v1 lobe: half-vector 16 deg off the 58-deg camera's up-normal -> washes every flat up-facing surface
          U.gxSpecDir.value = { x: -0.35, y: 0.62, z: 0.70 };
          U.gxSpec.value = { x: 0.86, y: 0.985, z: Number(name === 'charSpec' ? (param ?? 0.55) : 0.55), w: 0 };
        } else if (name === 'spec2' || name === 'combo') {
          // v2 lobe: half-vector placed 30 deg off the up-normal and tightened, so a flat top stays out of it
          U.gxSpecDir.value = { x: -0.77, y: 0.43, z: 0.47 };
          U.gxSpec.value = { x: 0.955, y: 0.995, z: Number(name === 'spec2' ? (param ?? 0.45) : 0.45), w: 0 };
        } else {
          U.gxSpec.value = { x: 0, y: 0, z: 0, w: 0 };
        }
        info.injected = injectChars({ lit: true, tag: name === 'combo' });
        info.fillAdd = add;
        if (name === 'combo') {
          for (const r of charRoots()) r.traverse((o) => { if (o.isMesh && /__outline$/.test(o.name)) hide(o); });
          info.hidden = hidden.length;
          await addInk(2.5);
        }
        break;
      }
      case 'bevel': { info.bevel = await addBevel(Number(param ?? 0.45)); break; }
      // v2: characters excluded through the alpha tag, and a crease threshold high enough that a
      // low-poly facet (shallow angle) stays under it while a box edge (~90 deg) clears it
      case 'bevel2': { info.injected = injectChars({ lit: false, tag: true }); info.bevel = await addBevel(Number(param ?? 0.45), 0.7, 1.5); break; }
      case 'full': {
        // combo (split rig at env 0.8, spec v2, post silhouette) + bevel
        Object.assign(info, await apply('combo', 0.8));
        info.bevel = await addBevel(Number(param ?? 0.45), 0.7, 1.5);
        break;
      }
      case 'dof': { info.dof = await addDof(Number(param ?? 3)); break; }
      case 'inkPost': {
        for (const r of charRoots()) r.traverse((o) => { if (o.isMesh && /__outline$/.test(o.name)) hide(o); });
        info.hidden = hidden.length;
        info.injected = injectChars({ lit: false, tag: true });
        await addInk(Number(param ?? 2.5));
        break;
      }
      case 'vsm': st.renderer.shadowMap.type = 3; L.key.shadow.radius = 6; L.key.shadow.blurSamples = 12; recompileAll(); break;
      case 'pcfsoft': st.renderer.shadowMap.type = 2; recompileAll(); break;
      case 'basic': st.renderer.shadowMap.type = 0; recompileAll(); break;
      case 'map': L.setShadowMapSize(Number(param)); st.markShadowsDirty(); break;
      case 'shInt': L.key.shadow.intensity = Number(param); break;
      case 'noCharInk': for (const r of charRoots()) r.traverse((o) => { if (o.isMesh && /__outline$/.test(o.name)) hide(o); }); info.hidden = hidden.length; break;
      case 'solo': { const r = charRoots(); for (let i = 1; i < r.length; i++) hide(r[i]); info.hidden = hidden.length; break; }
      case 'dpr': st.renderer.setPixelRatio(Number(param)); st.resize(); break;
      default: throw new Error('unknown arm ' + name);
    }
    return info;
  };
  const revert = (name) => {
    const st = S(), L = st.lighting;
    L.front.intensity = base.front;
    propRimRestore();
    if (injected.length) uninjectChars();
    removeInk();
    removeBevel();
    removeDof();
    if (st.renderer.shadowMap.type !== base.shType) { st.renderer.shadowMap.type = base.shType; L.key.shadow.radius = base.shRadius; recompileAll(); }
    L.key.shadow.intensity = base.shInt;
    if (L.key.shadow.mapSize.x !== base.mapSize) { L.setShadowMapSize(base.mapSize); st.markShadowsDirty(); }
    unhideAll();
    if (st.renderer.getPixelRatio() !== base.pr) { st.renderer.setPixelRatio(base.pr); st.resize(); }
    return true;
  };

  const shot = () => {
    const st = S();
    st.renderer.shadowMap.needsUpdate = true;
    st.render(0);
    const cv = st.renderer.domElement;
    return { png: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
  };

  // ── GPU timing ──
  const timer = () => {
    const gl = S().renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    return { gl, ext };
  };
  const collect = async (gl, ext, qs) => {
    const out = new Array(qs.length).fill(null);
    const t0 = performance.now();
    let left = qs.length;
    while (left > 0 && performance.now() - t0 < 30000) {
      await new Promise((r) => setTimeout(r, 25));
      for (let i = 0; i < qs.length; i++) {
        if (out[i] !== null) continue;
        if (gl.getQueryParameter(qs[i], gl.QUERY_RESULT_AVAILABLE)) { out[i] = gl.getQueryParameter(qs[i], gl.QUERY_RESULT) / 1e6; left--; }
      }
    }
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    for (const q of qs) gl.deleteQuery(q);
    return { ms: out, disjoint };
  };
  const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

  // One frame of the shipped path, with or without the shadow map forced, or the scene drawn bare.
  const frame = (mode) => {
    const st = S();
    if (mode !== 'cached') st.renderer.shadowMap.needsUpdate = true;
    if (mode === 'noPost') { st.renderer.render(st.scene, st.rig.camera); return; }
    st.render(0);
  };

  // ⚠️ v1 of this timed ONE frame per query and FAILED its own control: ctl:double read
  // 1.25x and 3.8x of shipped where ~2x is the only right answer, and cached (strictly less
  // work) read SLOWER than shipped. A ~1-2 ms frame leaves an M5 Pro in a low clock state and
  // the per-frame number is mostly DVFS and neighbours. v2 times SUSTAINED BATCHES: a long
  // warm-up to ramp clocks, then reps queries each around batch back-to-back frames, and
  // reports per-frame = query / batch. The controls still decide whether any row is read.
  const timeFrames = async (mode, n, batchArg) => {
    const { gl, ext } = timer();
    if (!ext) return { err: 'no EXT_disjoint_timer_query_webgl2 (SwiftShader?) — run with --angle metal' };
    const st = S();
    const batch = batchArg || 12, reps = Math.max(5, Math.round(n / 4));
    const one = () => {
      if (mode === 'ctl:empty') return;
      if (mode === 'ctl:double') { frame('forced'); frame('forced'); return; }
      frame(mode);
    };
    // warm: programs compiled, targets allocated, clocks ramped
    for (let i = 0; i < 60; i++) one();
    gl.finish();
    const qs = [], cpu = [];
    for (let k = 0; k < reps; k++) {
      const q = gl.createQuery();
      const c0 = performance.now();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      for (let i = 0; i < batch; i++) one();
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      gl.finish();
      cpu.push((performance.now() - c0) / batch);
      qs.push(q);
    }
    const r0 = await collect(gl, ext, qs);
    const r = { ms: r0.ms.map((x) => (x == null ? null : x / batch)), disjoint: r0.disjoint };
    // counts for ONE frame, same path
    const info = st.renderer.info; const ar = info.autoReset; info.autoReset = false; info.reset();
    if (mode === 'ctl:double') { frame('forced'); frame('forced'); } else if (mode !== 'ctl:empty') frame(mode);
    const calls = info.render.calls, tris = info.render.triangles; info.autoReset = ar;
    return { buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], gpuMed: med(r.ms), gpuMin: Math.min(...r.ms.filter((x) => x != null)), gpuMax: Math.max(...r.ms.filter((x) => x != null)), n: r.ms.filter((x) => x != null).length, disjoint: r.disjoint, cpuMed: med(cpu), calls, tris, programs: st.renderer.info.programs ? st.renderer.info.programs.length : null };
  };

  // Per-pass: wrap each composer pass (and, separately, the shadow map) with its own query.
  // Queries cannot nest, so the shadow map is timed in a SEPARATE run with nothing else open.
  const timePasses = async (n) => {
    const { gl, ext } = timer();
    if (!ext) return { err: 'no timer query' };
    const st = S(); const comp = st.composer;
    if (!comp) return { err: 'no composer' };
    const passes = comp.passes;
    const names = passes.map((p, i) => (p.name || p.constructor.name || 'pass') + '#' + i + (p.enabled === false ? '(off)' : ''));
    const per = names.map(() => []);
    const calls = names.map(() => 0), tris = names.map(() => 0);
    const origs = passes.map((p) => p.render);
    const info = st.renderer.info;
    let recording = false; let cur = null;
    passes.forEach((p, i) => {
      p.render = function (...a) {
        let q = null;
        if (recording) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
        const c0 = info.render.calls, t0 = info.render.triangles;
        const ret = origs[i].apply(this, a);
        if (recording) { gl.endQuery(ext.TIME_ELAPSED_EXT); per[i].push(q); if (cur === 0) { calls[i] = info.render.calls - c0; tris[i] = info.render.triangles - t0; } }
        return ret;
      };
    });
    const ar = info.autoReset; info.autoReset = false;
    try {
      for (let i = 0; i < 3; i++) st.render(0);
      recording = true;
      for (let f = 0; f < n; f++) { cur = f; info.reset(); st.renderer.shadowMap.needsUpdate = false; st.render(0); gl.flush(); }
      recording = false;
    } finally {
      passes.forEach((p, i) => { p.render = origs[i]; });
      info.autoReset = ar;
    }
    const res = [];
    for (let i = 0; i < names.length; i++) {
      const r = await collect(gl, ext, per[i]);
      res.push({ pass: names[i], gpuMed: med(r.ms), n: r.ms.filter((x) => x != null).length, calls: calls[i], tris: tris[i] });
    }
    // the shadow map alone
    const sm = st.renderer.shadowMap; const origSm = sm.render; const sq = [];
    let sCalls = 0, sTris = 0, first = true;
    sm.render = function (...a) {
      const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      const c0 = info.render.calls, t0 = info.render.triangles;
      const ret = origSm.apply(this, a);
      gl.endQuery(ext.TIME_ELAPSED_EXT); sq.push(q);
      if (first) { sCalls = info.render.calls - c0; sTris = info.render.triangles - t0; first = false; }
      return ret;
    };
    // passes are NOT wrapped now, so nothing else holds a query open
    const ar2 = info.autoReset; info.autoReset = false;
    try { for (let f = 0; f < n; f++) { info.reset(); sm.needsUpdate = true; st.render(0); gl.flush(); } }
    finally { sm.render = origSm; info.autoReset = ar2; }
    const sr = await collect(gl, ext, sq);
    res.unshift({ pass: 'shadowMap (inside RenderPass)', gpuMed: med(sr.ms), n: sr.ms.filter((x) => x != null).length, calls: sCalls, tris: sTris });
    return { passes: res, buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
  };

  // SSAO price: NormalPass + SSAOEffect from the app's OWN postprocessing instance.
  let ssaoAdded = null;
  const addSSAO = async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/postprocessing\.js/.test(n));
    if (!url) return { err: 'postprocessing module URL not found in resource timing' };
    const PP = await import(url);
    const st = S(); const comp = st.composer;
    const normalPass = new PP.NormalPass(st.scene, st.rig.camera);
    const ssao = new PP.SSAOEffect(st.rig.camera, normalPass.texture, {
      blendFunction: PP.BlendFunction.MULTIPLY, distanceScaling: true, worldDistanceThreshold: 30, worldDistanceFalloff: 6,
      worldProximityThreshold: 3.0, worldProximityFalloff: 1.0, luminanceInfluence: 0.6, samples: 16, rings: 5,
      radius: 0.07, intensity: 2.4, bias: 0.20, resolutionScale: 0.85,
    });
    const fx = new PP.EffectPass(st.rig.camera, ssao);
    comp.addPass(normalPass, 1);
    comp.addPass(fx, 2);
    const gl = st.renderer.getContext();
    comp.setSize(gl.drawingBufferWidth / st.renderer.getPixelRatio(), gl.drawingBufferHeight / st.renderer.getPixelRatio());
    ssaoAdded = { normalPass, fx };
    return { ok: true, url };
  };
  const removeSSAO = () => {
    if (!ssaoAdded) return false;
    const comp = S().composer; comp.removePass(ssaoAdded.fx); comp.removePass(ssaoAdded.normalPass);
    ssaoAdded.fx.dispose(); ssaoAdded.normalPass.dispose(); ssaoAdded = null; return true;
  };

  const bloomOn = () => {
    const q = window.__quality; if (!q) return { err: 'no __quality' };
    // v1 round-tripped low->medium->low and REBUILT NOTHING: Stage.applyQuality only rebuilds when
    // a post flag differs between the two profiles, and with low.bloom already mutated to true the
    // two agree on every flag. Going through a tier whose SMAA flag differs forces both rebuilds.
    const t = q.tier; const other = t === 'high' ? 'low' : 'high';
    const was = q.tiers[t].bloom; q.tiers[t].bloom = true;
    q.force(other); q.force(t);
    const st = S(); const eff = st.composer ? st.composer.passes.map((p) => (p.effects ? p.effects.map((e) => e.name) : null)) : null;
    return { tier: window.__quality.tier, was, effects: eff };
  };
  const bloomRestore = (was) => {
    const q = window.__quality; const t = q.tier; const other = t === 'high' ? 'low' : 'high';
    q.tiers[t].bloom = was; q.force(other); q.force(t); return true;
  };

  const census = () => {
    const st = S(); const out = { chars: charRoots().length, charMats: 0, charStd: 0, rims: 0, propRims: 0, materials: 0, hulls: 0, charHulls: 0 };
    const cm = charMatSet(); out.charMats = cm.size; for (const m of cm) if (m.isMeshStandardMaterial) out.charStd++;
    for (const m of allMats()) { out.materials++; const u = m.userData && m.userData.rimUniforms; if (u && u.rimStrength) { out.rims++; if (!cm.has(m)) out.propRims++; } }
    st.scene.traverse((o) => { if (o.isMesh && /__outline$/.test(o.name)) out.hulls++; });
    for (const r of charRoots()) r.traverse((o) => { if (o.isMesh && /__outline$/.test(o.name)) out.charHulls++; });
    // per character: visible meshes, of which ink hulls, of which shadow casters, distinct materials
    out.perChar = charRoots().map((r) => {
      let meshes = 0, hulls = 0, casters = 0, transparent = 0; const ms = new Set();
      r.traverseVisible((o) => {
        if (!o.isMesh) return; meshes++;
        if (/__outline$/.test(o.name)) hulls++;
        if (o.castShadow) casters++;
        for (const mm of mats(o)) { ms.add(mm); if (mm.transparent) transparent++; }
      });
      return { name: r.name, meshes, hulls, casters, transparent, materials: ms.size };
    });
    const r = st.renderer;
    out.tier = window.__quality && window.__quality.tier;
    out.pixelRatio = r.getPixelRatio();
    out.buffer = [r.getContext().drawingBufferWidth, r.getContext().drawingBufferHeight];
    out.shadowType = r.shadowMap.type; out.shadowMap = st.lighting.key.shadow.mapSize.x; out.shadowRadius = st.lighting.key.shadow.radius;
    out.passes = st.composer ? st.composer.passes.map((p) => p.name || p.constructor.name) : null;
    out.effects = st.composer ? st.composer.passes.map((p) => (p.effects ? p.effects.map((e) => e.name) : null)) : null;
    out.gpu = (() => { try { const gl = r.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; } catch { return null; } })();
    return out;
  };

  return { S, snapshot, apply, revert, shot, timeFrames, timePasses, addSSAO, removeSSAO, bloomOn, bloomRestore, census, charRoots };
})();
`;

const STILL_HUD = () => {
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const s = getComputedStyle(el);
    if (s.animationName && s.animationName !== 'none') el.style.animation = 'none';
    if (s.transitionDuration && s.transitionDuration !== '0s') el.style.transition = 'none';
  }
};
const FREEZE = () => {
  const w = window;
  w.requestAnimationFrame = () => 0;
  const st = w.__stage;
  if (!st) return { err: 'no __stage' };
  try { st.rig.shakeAmount = 0; st.rig.shakeOffset.set(0, 0, 0); } catch { /* */ }
  return { ok: true, frames: w.__matchDebug ? w.__matchDebug.frames : null };
};
const FRAMES_NOW = () => (window.__matchDebug ? window.__matchDebug.frames : null);

function sha(buf) { return createHash('sha1').update(buf).digest('hex').slice(0, 16); }

async function openMatch(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: TOUCH, isMobile: TOUCH });
  page.on('pageerror', (e) => console.log('  PAGEERROR:', String(e).slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  console.error:', m.text().slice(0, 240)); });
  await page.addInitScript(PAGE_LIB);
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  let q;
  if (SEATS >= 3) {
    const ring = ROSTER.map((cid, i) => {
      const ang = (i / ROSTER.length) * Math.PI * 2;
      return i === 0 ? `${cid}@${ST.x},${ST.y}` : `${cid}@${Math.round(ST.x + Math.cos(ang) * RING_WU)},${Math.round(ST.y + Math.sin(ang) * RING_WU)}`;
    }).join(';');
    q = new URLSearchParams({ fighters: ring, px: String(ST.x), py: String(ST.y), fogRadius: String(ARENA.maxSafeRadius), simSpeed: '0.02', pointerLock: '0', tier: TIER });
  } else {
    q = new URLSearchParams({ player: ROSTER[0] ?? 'donut', enemy: ROSTER[1] ?? 'taco', px: String(ST.x), py: String(ST.y), fogRadius: String(ARENA.maxSafeRadius), simSpeed: '0.02', pointerLock: '0', tier: TIER });
  }
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.waitForTimeout(2600);
  await page.evaluate(STILL_HUD);
  const fz = await page.evaluate(FREEZE);
  if (fz.err) throw new Error(fz.err);
  // drain: force composites until the loop's frame counter stops moving
  let f0 = await page.evaluate(FRAMES_NOW), stable = 0;
  for (let t = 0; t < 20 && stable < 3; t++) {
    await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });
    const f1 = await page.evaluate(FRAMES_NOW);
    if (f1 === f0) stable++; else { stable = 0; f0 = f1; }
  }
  return { page, held: stable >= 3, frames: f0 };
}

async function openLobby(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: TOUCH, isMobile: TOUCH });
  page.on('pageerror', (e) => console.log('  PAGEERROR:', String(e).slice(0, 240)));
  await page.addInitScript(PAGE_LIB);
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  const screen = arg('--screen', 'home');
  await page.goto(`${BASE}/?screen=${screen}&tier=${TIER}`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.waitForFunction(`window.__screenReady === true && window.__screen === '${screen}'`, null, { timeout: 240_000 });
  await page.waitForTimeout(4000);
  await page.evaluate(STILL_HUD);
  const fz = await page.evaluate(FREEZE);
  if (fz.err) throw new Error(fz.err);
  // flush the one rAF callback that was already scheduled before the stub went in
  for (let t = 0; t < 3; t++) await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });
  await page.waitForTimeout(300);
  return { page, held: true, frames: null };
}

function parseArm(a) { const i = a.indexOf(':'); return i < 0 ? [a, null] : [a.slice(0, i), a.slice(i + 1)]; }
// `ctl:empty` / `ctl:double` are names, not name:param
function armName(a) { return a.startsWith('ctl:') ? [a, null] : parseArm(a); }

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const report = { label: LABEL, mode: MODE, base: BASE, angle: ANGLE, tier: TIER, viewport: [W, H, DPR], touch: TOUCH, seats: SEATS, roster: ROSTER, station: ST, arms: [], faults: [] };
  try {
    const { page, held, frames } = MODE === 'lobby' ? await openLobby(browser) : await openMatch(browser);
    report.loopHeld = held; report.frames = frames;
    report.census = await page.evaluate(() => window.GXP.census());
    report.base = await page.evaluate(() => window.GXP.snapshot());
    console.log(`[gx_render] ${LABEL} · ${report.census.gpu} · tier ${report.census.tier} · buffer ${report.census.buffer.join('x')} @pr ${report.census.pixelRatio} · chars ${report.census.chars} · loop held ${held}`);
    console.log(`[gx_render] passes ${JSON.stringify(report.census.passes)} effects ${JSON.stringify(report.census.effects)}`);
    console.log(`[gx_render] perChar ${JSON.stringify(report.census.perChar)}`);
    console.log(`[gx_render] materials ${report.census.materials} · rims ${report.census.rims} (props ${report.census.propRims}) · hulls ${report.census.hulls} (char ${report.census.charHulls}) · shadow type ${report.census.shadowType} map ${report.census.shadowMap} r ${report.census.shadowRadius.toFixed(2)}`);
    if (MODE === 'look' || MODE === 'lobby') {
      const list = ARMS[0] === 'shipped' ? [...ARMS, 'shipped'] : ['shipped', ...ARMS, 'shipped'];
      const hashes = [];
      for (let k = 0; k < list.length; k++) {
        const a = list[k]; const [name, param] = armName(a);
        let info = {};
        try { info = await page.evaluate(([n, p]) => window.GXP.apply(n, p), [name, param]); }
        catch (e) { report.faults.push(`${a}: apply threw ${String(e).slice(0, 200)}`); continue; }
        // two renders: the first recompiles anything the arm invalidated
        await page.evaluate(() => { window.GXP.S().render(0); });
        const s = await page.evaluate(() => window.GXP.shot());
        const buf = Buffer.from(s.png.split(',')[1], 'base64');
        const file = join(OUT, `${String(k).padStart(2, '0')}_${a.replace(/[^a-z0-9.+]+/gi, '_')}.png`);
        writeFileSync(file, buf);
        const h = sha(buf); hashes.push([a, h]);
        report.arms.push({ arm: a, info, file, sha: h, w: s.w, h: s.h });
        console.log(`  ${a.padEnd(18)} ${h}  ${JSON.stringify(info)}  -> ${file}`);
        await page.evaluate((n) => window.GXP.revert(n), name);
      }
      const first = hashes[0]?.[1], last = hashes[hashes.length - 1]?.[1];
      report.selfPair = first === last;
      console.log(`[gx_render] self-pair shipped/shipped(again): ${first === last ? 'BIT-IDENTICAL' : `DIFFERENT (${first} vs ${last}) — an arm leaked`}`);
      if (first !== last) report.faults.push('self-pair differs: an arm did not revert cleanly');
    } else if (MODE === 'cost') {
      for (const a of ARMS) {
        const [name, param] = armName(a);
        let info = {}; let extra = null;
        try {
          if (name === 'ssao') { extra = await page.evaluate(() => window.GXP.addSSAO()); if (extra.err) throw new Error(extra.err); }
          else if (name === 'bloom') { extra = await page.evaluate(() => window.GXP.bloomOn()); if (extra.err) throw new Error(extra.err); }
          else info = await page.evaluate(([n, p]) => window.GXP.apply(n, p), [name, param]);
          const mode = name === 'cached' ? 'cached' : name === 'noPost' ? 'noPost' : name.startsWith('ctl:') ? name : 'forced';
          const t = await page.evaluate(([m, n, b]) => window.GXP.timeFrames(m, n, b), [mode, FRAMES, Number(arg('--batch', 12))]);
          let p = null;
          if (has('--passes') && !name.startsWith('ctl:') && name !== 'noPost') p = await page.evaluate((n) => window.GXP.timePasses(n), Math.max(8, Math.round(FRAMES / 2)));
          const row = { arm: a, info, extra, ...t, passes: p };
          report.arms.push(row);
          const f = (v, d = 3) => (v == null ? 'null' : Number(v).toFixed(d));
          console.log(`  ${a.padEnd(18)} GPU med ${f(t.gpuMed)} ms [${f(t.gpuMin)}–${f(t.gpuMax)}] n=${t.n}${t.disjoint ? ' DISJOINT' : ''} · wall/frame ${f(t.cpuMed, 2)} ms · draws ${t.calls} · tris ${t.tris} · progs ${t.programs} · buf ${t.buffer ? t.buffer.join('x') : '?'}${extra && extra.effects ? ' · fx ' + JSON.stringify(extra.effects) : ''}${t.err ? ' ERR ' + t.err : ''}`);
          // per-pass GPU ms FAILED validation in v1 (pass sums != frame totals; the shadow query read
          // 0.000 on one tier and 0.19 ms on another for the same 209-372 draws) — only the EXACT
          // per-pass draw/triangle counts are printed.
          if (p && p.passes) for (const pp of p.passes) console.log(`      ${pp.pass.padEnd(34)} draws ${pp.calls} · tris ${pp.tris}`);
        } catch (e) {
          report.faults.push(`${a}: ${String(e).slice(0, 240)}`);
          console.log(`  ${a}: FAULT ${String(e).slice(0, 240)}`);
        } finally {
          if (name === 'ssao') await page.evaluate(() => window.GXP.removeSSAO());
          else if (name === 'bloom' && extra && !extra.err) await page.evaluate((w) => window.GXP.bloomRestore(w), extra.was);
          else await page.evaluate((n) => window.GXP.revert(n), name);
        }
      }
    }
  } catch (e) {
    report.faults.push(String(e).slice(0, 400));
    console.log('[gx_render] FAULT', String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`[gx_render] wrote ${join(OUT, 'report.json')} · faults ${report.faults.length}`);
  if (report.faults.length) for (const f of report.faults) console.log('  FAULT:', f);
}

main().catch((e) => { console.error(e); process.exit(1); });
