#!/usr/bin/env node
/**
 * RIMCHECK — does `toon.ts`'s Fresnel rim reach the screen at all?
 *
 * `haloprobe.mjs` set every `rimStrength` uniform in the live match to 0 and the frame
 * came back BYTE-IDENTICAL: dMean 0, dMax 0, 0.00% of pixels. That is either a dead
 * rim or a dead instrument, and `docs/LESSONS.md` §1's own remedy applies — replace the
 * thing with something UNMISSABLE and render.
 *
 * Four independent answers, so no single one has to be trusted:
 *   1. Is the chunk in the COMPILED program?   grep the linked fragment shader source.
 *   2. Is the uniform ACTIVE in the program?   `gl.getUniformLocation` on the real program.
 *   3. Does a garish value move pixels?        rimStrength 20, rimColor pure red.
 *   4. Does the material's own `onBeforeCompile` still fire? recompile and re-check.
 *
 *   node tools/tmp/headserve.mjs --overlay src/render -- node tools/tmp/rimcheck.mjs
 */
import { chromium } from 'playwright';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const ID = get('--id', 'hamburger');
if (!BASE) { console.error('PREVIEW_BASE unset — run under headserve.mjs'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('console', (m) => { if (/Shader Error|WebGLProgram|rim/i.test(m.text())) console.log('  PAGE:', m.text().slice(0, 240)); });
page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
await page.goto(`${BASE}/?player=${ID}&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
await page.waitForTimeout(900);

const out = await page.evaluate(() => {
  const stage = window.__stage;
  const r = stage.renderer, scene = stage.scene, cam = stage.rig.camera, gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height;
  const read = () => { const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const diff = (A, B) => {
    let s = 0, mx = 0, n = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      s += d; if (d > mx) mx = d; if (d > 0) n++;
    }
    return { mean: +(s / (A.length / 4)).toFixed(5), max: mx, pct: +((100 * n) / (A.length / 4)).toFixed(3) };
  };

  // Collect every material, with and without the QA hook, and say which are on a character.
  const mats = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let top = o; while (top.parent && top.parent !== scene) top = top.parent;
    const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of list) {
      if (!m) continue;
      const e = mats.get(m) ?? { m, meshes: 0, onChar: false, type: m.type, name: o.name };
      e.meshes++;
      if (/^character:/.test(top.name || '') || /^character:/.test(o.name || '')) e.onChar = true;
      mats.set(m, e);
    }
  });
  const all = [...mats.values()];
  const standard = all.filter((e) => e.m.isMeshStandardMaterial);
  const hooked = all.filter((e) => e.m.userData && e.m.userData.rimUniforms);
  const withOBC = all.filter((e) => typeof e.m.onBeforeCompile === 'function'
    && e.m.onBeforeCompile !== THREE_NOOP_PLACEHOLDER());
  function THREE_NOOP_PLACEHOLDER() { return null; }

  const summary = {
    materials: all.length,
    standardMaterials: standard.length,
    withOnBeforeCompile: withOBC.length,
    withRimHook: hooked.length,
    standardOnCharacter: standard.filter((e) => e.onChar).length,
    standardOnCharacterWithHook: standard.filter((e) => e.onChar && e.m.userData.rimUniforms).length,
    standardWithoutHook: standard.filter((e) => !(e.m.userData && e.m.userData.rimUniforms)).length,
  };

  // (1) + (2): the COMPILED program for one hooked character material.
  const target = (hooked.find((e) => e.onChar) ?? hooked[0]);
  const probe = { found: !!target, name: target ? target.name : null, type: target ? target.type : null };
  if (target) {
    const props = r.properties.get(target.m);
    const prog = props && props.currentProgram;
    probe.hasProgram = !!prog;
    if (prog) {
      const fs = prog.fragmentShader ?? null;
      // three keeps the SOURCE on the program object in dev builds; if not, read it off
      // the GL shader objects attached to the linked program.
      let src = typeof fs === 'string' ? fs : null;
      if (!src && prog.program) {
        const shaders = gl.getAttachedShaders(prog.program) || [];
        for (const sh of shaders) {
          const s = gl.getShaderSource(sh);
          if (s && /void main/.test(s) && /gl_FragColor|pc_fragColor/.test(s)) src = s;
        }
      }
      probe.gotSource = !!src;
      if (src) {
        probe.hasRimUniformDecl = /uniform\s+vec3\s+rimColor/.test(src);
        probe.hasRimMath = /rimStrength/.test(src) && /rimDot/.test(src);
        probe.hasDitheringMarker = /dithering/i.test(src);
      }
      if (prog.program) {
        probe.locRimStrength = String(gl.getUniformLocation(prog.program, 'rimStrength'));
        probe.locRimColor = String(gl.getUniformLocation(prog.program, 'rimColor'));
        probe.rimStrengthActive = gl.getUniformLocation(prog.program, 'rimStrength') !== null;
      }
      probe.uniformsIsSameObject = props.uniforms === target.m.userData.rimUniforms;
      probe.uniformsHasRim = !!(props.uniforms && props.uniforms.rimStrength);
    }
  }

  // (3) THE UNMISSABLE VERSION. Every rim uniform to 20, colour to pure red.
  const uni = hooked.map((e) => e.m.userData.rimUniforms);
  const before0 = uni.map((u) => u.rimStrength.value);
  const beforeC = uni.map((u) => u.rimColor.value.clone());
  stage.render(0); stage.render(0);
  const A = read();
  for (const u of uni) { u.rimStrength.value = 20; u.rimColor.value.setRGB(1, 0, 0); }
  stage.render(0); stage.render(0);
  const B = read();
  const garish = diff(A, B);
  // (3b) and the plain ablation, for the record.
  for (const u of uni) { u.rimStrength.value = 0; u.rimColor.value.copy(beforeC[0]); }
  stage.render(0); stage.render(0);
  const C = read();
  const off = diff(A, C);
  // restore
  uni.forEach((u, i) => { u.rimStrength.value = before0[i]; u.rimColor.value.copy(beforeC[i]); });
  stage.render(0); stage.render(0);

  // (4) Force a recompile with a NEW onBeforeCompile that writes an unmistakable
  //     constant, so "the uniform is dead" and "the chunk never landed" separate.
  let recompiled = null;
  if (target) {
    const m = target.m;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n gl_FragColor.rgb = vec3(1.0, 0.0, 1.0);');
    };
    m.needsUpdate = true;
    stage.render(0); stage.render(0);
    const D = read();
    recompiled = diff(A, D);
    m.onBeforeCompile = prev;
    m.needsUpdate = true;
    stage.render(0); stage.render(0);
  }

  return { summary, probe, garish, off, recompiled, rimStrengths: [...new Set(before0)] };
});
await browser.close();
console.log(JSON.stringify(out, null, 2));
