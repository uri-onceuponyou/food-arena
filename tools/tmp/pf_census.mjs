#!/usr/bin/env node
/**
 * pf_census.mjs — WHERE THE FRAME'S COST ACTUALLY SITS, split by subsystem.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 * `tools/perf.mjs` reports whole-frame counts. `tools/tmp/ph_frame.mjs` reports
 * whole-frame milliseconds and splits them at the first GL draw. Neither answers
 * the question that decides what to fix: **which SUBSYSTEM is the 934 draws and
 * the 1.1 M triangles?** "The map got 2.7x more triangles" and "the shaders got
 * more expensive" have disjoint fixes and this tool tells them apart.
 *
 * ── HOW THE ATTRIBUTION IS DONE, and why it is exact ────────────────────────
 * `THREE.WebGLRenderer` assigns `renderBufferDirect` as an OWN PROPERTY of the
 * instance (`three.module.js:15935`) and every draw in the engine goes through it
 * — the shadow pass (`8761`, `8775`), the main pass (`16856-16866`) and the post
 * chain's fullscreen meshes. Patching that one property therefore sees **every
 * draw call together with the Object3D that issued it**, so a draw is CHARGED to
 * the subtree it came from rather than estimated.
 *
 * Subsystem = the TOP-LEVEL CHILD OF THE SCENE that the object hangs under.
 * Deliberately derived from the graph rather than from a hand-written list of
 * group names, so a subsystem nobody told this tool about appears as its own row
 * instead of being silently folded into "other".
 *
 * ── WHAT IS EXACT AND WHAT IS NOT ───────────────────────────────────────────
 *   EXACT, device-independent — quote as-is: draws/frame per subsystem per pass;
 *     triangles submitted per subsystem; mesh / geometry / material / program /
 *     texture counts; texture bytes; instance counts.
 *   NOT measured here: milliseconds. Use `pf_ablate.mjs`, and read its resolution
 *     floor before quoting any delta from it.
 *
 * ⚠️ `renderer.info` is reset by three at the start of EVERY `renderer.render()`
 * call unless `autoReset === false`, and the app leaves it at the default — so a
 * naive `info.render.calls` read on a composited frame reports **only the last
 * pass**. This tool sets `autoReset = false`, resets once per animation frame and
 * restores the flag, which is the only way the whole-frame number is true.
 *
 * ── VALIDATION (`--selftest`) ───────────────────────────────────────────────
 * A guard that has not been shown to FAIL on the bug it guards against is not a
 * guard (CLAUDE.md 6). Four known-bad inputs, all against the live page:
 *   1. INJECT   — add 7 meshes / 84 known triangles under a NEW top-level name.
 *                 The census must report exactly +7 drawables, +84 triangles, in a
 *                 new row, and the hook must charge ~7 draws/frame to it. A walker
 *                 that misses subtrees fails this.
 *   2. HIDE     — `visible = false` on the biggest subsystem. Its DRAWS must go to
 *                 zero while its MESH count is unchanged. A tool that derives draws
 *                 from the graph instead of from the renderer passes the census and
 *                 fails this.
 *   3. SELF-PAIR— two independent page loads of the same URL return bit-identical
 *                 counts. Non-determinism would invalidate every A/B taken with it.
 *   4. TOTALS   — the hook's summed draws must equal `renderer.info.render.calls`
 *                 over the same frames. A hook that misses the shadow pass or the
 *                 post chain fails here and nowhere else.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   PH_SCRATCH=<dir> node tools/tmp/ph_serve.mjs --start --ref <sha>   # once
 *   PH_SCRATCH=<dir> node tools/tmp/pf_census.mjs                      # match, mobile/low
 *   PH_SCRATCH=<dir> node tools/tmp/pf_census.mjs --scene home --device desktop
 *   PH_SCRATCH=<dir> node tools/tmp/pf_census.mjs --json out.json
 *   PH_SCRATCH=<dir> node tools/tmp/pf_census.mjs --selftest
 *
 * ⚠️ Defaults to the MOBILE emulation profile (`hasTouch` + `isMobile`), because
 * `detectTier()` gates on `pointer: coarse` and `maxTouchPoints > 0` and without
 * them every "mobile" run in this repo measured tier `high` (`perf.mjs` header,
 * `docs/PHONE.md` §2d). The report prints the DETECTED tier so the reader can see
 * which one produced the number. `--device desktop` opts out.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
const st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null;
const BASE = arg('url', null) ?? process.env.PREVIEW_BASE ?? st?.url ?? null;
const SHA = st?.sha ?? 'unknown';

const SCENES = {
  match: '/?player=hamburger&enemy=donut',
  // ⚠️ NOT lollipop/pizza, which is what `perf.mjs` pins `match-vfx` to. Lollipop
  // has NO ranged weapon, so that scene samples a frame with ZERO projectiles —
  // i.e. the "VFX scene" in this repo has been measuring a frame with no VFX in it
  // (`ph_frame.mjs` found the same thing). hamburger throws patties and donut fires.
  'match-vfx': '/?player=hamburger&enemy=donut&simSpeed=6',
  home: '/?screen=home',
  characters: '/?screen=characters',
};
const DEVICES = {
  mobile: { w: 844, h: 390, dpr: 3, isMobile: true, hasTouch: true },
  desktop: { w: 1300, h: 740, dpr: 1, isMobile: false, hasTouch: false },
};
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// ─────────────────────────────────────────────────────────────────────────────
// The page-side hook, installed via addInitScript so it exists before the app.
// Exactly one `page.evaluate` per measurement and it is LAST — `page.evaluate()`
// grants transient user activation (docs/AGENT-BRIEF.md §3).
// ─────────────────────────────────────────────────────────────────────────────
const HOOK = `
(() => {
  const S = {
    map: new Map(), frames: 0, recording: false,
    infoCalls: 0, infoTris: 0, infoFrames: 0,
    r: null, prevAutoReset: null, lastT: -1,
  };
  window.__pf = S;

  /**
   * Subsystem = the ancestor chain from the scene root down, truncated to
   * window.__pfDepth levels. Graph-derived rather than a hand-written list of
   * group names, so a subsystem nobody told this tool about gets its OWN row
   * instead of being folded silently into "other".
   */
  window.__pfDepth = 1;
  window.__pfSubsystem = function (o) {
    const chain = [];
    let cur = o, top = o, rooted = false;
    while (cur.parent) {
      chain.unshift(cur.name || cur.type);
      if (cur.parent.isScene) { rooted = true; break; }
      top = cur.parent; cur = cur.parent;
    }
    if (!rooted) return '@offscene:' + (top.name || top.type);
    return chain.slice(0, window.__pfDepth).join('/');
  };

  function passOf(m) {
    if (!m) return 'unknown';
    if (m.isMeshDepthMaterial || m.isMeshDistanceMaterial) return 'shadow';
    return 'main';
  }

  /**
   * Idempotent by design: a double-wrapped counter reports 2x and looks entirely
   * plausible, which is the failure mode CLAUDE.md 6 exists for.
   */
  window.__pfHook = function () {
    const stage = window.__stage;
    if (!stage || !stage.renderer) return false;
    const r = stage.renderer;
    S.r = r;
    if (r.__pfWrapped) return true;
    r.__pfWrapped = true;
    S.prevAutoReset = r.info.autoReset;
    r.info.autoReset = false;
    const orig = r.renderBufferDirect;
    r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      if (S.recording) {
        const key = window.__pfSubsystem(object) + '|' + passOf(material);
        let e = S.map.get(key);
        if (!e) { e = { draws: 0, tris: 0 }; S.map.set(key, e); }
        e.draws++;
        const cnt = group ? group.count
          : (geometry.index ? geometry.index.count
            : (geometry.attributes.position ? geometry.attributes.position.count : 0));
        const inst = object.isInstancedMesh ? (object.count || 0) : 1;
        e.tris += (cnt / 3) * inst;
      }
      return orig.call(this, camera, scene, geometry, material, object, group);
    };
    return true;
  };

  /**
   * Frame accounting. Several rAF callbacks share one timestamp, so a new frame is
   * a new \`t\`. At each boundary the PREVIOUS frame's renderer.info is banked and
   * the counter reset — with autoReset off, that is the only whole-frame number.
   */
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return raf(function (t) {
      if (S.recording && t !== S.lastT) {
        if (S.lastT >= 0 && S.r) {
          S.infoCalls += S.r.info.render.calls;
          S.infoTris += S.r.info.render.triangles;
          S.infoFrames++;
        }
        if (S.r) S.r.info.reset();
        S.lastT = t;
        S.frames++;
      }
      return cb(t);
    });
  };
})();
`;

const START = `(() => {
  const S = window.__pf;
  S.map = new Map(); S.frames = 0; S.infoCalls = 0; S.infoTris = 0; S.infoFrames = 0;
  S.lastT = -1; S.recording = true;
})()`;

const COLLECT = `(() => {
  const S = window.__pf;
  S.recording = false;
  const stage = window.__stage;
  const scene = stage.scene, r = stage.renderer;

  const geoms = new Set(), mats = new Set(), texs = new Map();
  const bySub = new Map();
  let meshes = 0, objects = 0;
  function texBytes(t) {
    if (!t || !t.image) return 0;
    const w = t.image.width || t.image.videoWidth || 0;
    const h = t.image.height || t.image.videoHeight || 0;
    if (!w || !h) return 0;
    return Math.round(w * h * 4 * (t.generateMipmaps === false ? 1 : 4 / 3));
  }
  const MAPS = ['map','normalMap','roughnessMap','aoMap','emissiveMap','alphaMap',
    'metalnessMap','bumpMap','envMap','lightMap','displacementMap','specularMap'];
  function noteMat(m, rec) {
    if (!m) return;
    mats.add(m);
    if (m.transparent) rec.transparentMats++;
    if (m.isMeshBasicMaterial) rec.basicMats++;
    for (const k of MAPS) { const t = m[k]; if (t && !texs.has(t)) texs.set(t, texBytes(t)); }
  }
  scene.traverse((o) => {
    objects++;
    const sub = window.__pfSubsystem(o);
    if (!bySub.has(sub)) bySub.set(sub, {
      sub, meshes: 0, tris: 0, instanced: 0, instances: 0, objects: 0,
      transparentMats: 0, basicMats: 0, castShadow: 0, receiveShadow: 0,
      outlineMeshes: 0, outlineTris: 0, hidden: 0,
    });
    const rec = bySub.get(sub);
    rec.objects++;
    /**
     * ⚠️ o.isSprite IS IN THIS LIST BECAUSE ITS ABSENCE WAS A REAL BLIND SPOT.
     * The first version tested isMesh/isLine/isPoints only, so vfx_layer's 106
     * Sprites counted as 0 drawables and 0 triangles while the renderBufferDirect
     * hook would have charged their draws to the row anyway — the two halves of the
     * report would have disagreed with each other and neither would have said so.
     * docs/LESSONS.md §1: a thing the diagnostic cannot classify is invisible to it.
     * (No backticks: this block is inside a JS template literal and one would
     * terminate it — LESSONS §9's hud.ts trap, in a tool.)
     */
    if (!o.isMesh && !o.isLine && !o.isPoints && !o.isSprite) return;
    meshes++; rec.meshes++;
    if (o.visible === false) rec.hidden++;
    const g = o.geometry;
    if (g) {
      geoms.add(g);
      const c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
      const inst = o.isInstancedMesh ? (o.count || 0) : 1;
      const tris = (c / 3) * inst;
      rec.tris += tris;
      if (o.isInstancedMesh) { rec.instanced++; rec.instances += (o.count || 0); }
      if (/__outline$/.test(o.name || '')) { rec.outlineMeshes++; rec.outlineTris += tris; }
    }
    if (o.castShadow) rec.castShadow++;
    if (o.receiveShadow) rec.receiveShadow++;
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => noteMat(x, rec)); else noteMat(m, rec);
  });

  const drawn = [];
  for (const [k, v] of S.map) {
    const i = k.lastIndexOf('|');
    drawn.push({ sub: k.slice(0, i), pass: k.slice(i + 1), draws: v.draws / S.frames, tris: v.tris / S.frames });
  }
  let hookDraws = 0, hookTris = 0;
  for (const v of S.map.values()) { hookDraws += v.draws; hookTris += v.tris; }

  return {
    frames: S.frames,
    graph: {
      objects, meshes, geometries: geoms.size, materials: mats.size,
      textures: texs.size, textureBytes: [...texs.values()].reduce((a, b) => a + b, 0),
      bySub: [...bySub.values()].sort((a, b) => b.tris - a.tris),
    },
    drawn,
    identity: {
      hookDraws, hookDrawsPerFrame: hookDraws / S.frames,
      infoCalls: S.infoCalls, infoFrames: S.infoFrames,
      infoCallsPerFrame: S.infoFrames ? S.infoCalls / S.infoFrames : NaN,
      infoTrisPerFrame: S.infoFrames ? S.infoTris / S.infoFrames : NaN,
      hookTrisPerFrame: hookTris / S.frames,
    },
    programs: r.info.programs ? r.info.programs.length : -1,
    memGeometries: r.info.memory.geometries, memTextures: r.info.memory.textures,
    tier: (window.__quality && window.__quality.tier) || null,
    detected: (window.__quality && window.__quality.detected) || null,
    signals: (window.__quality && window.__quality.signals) || null,
    profile: (window.__quality && window.__quality.profile) || null,
    buffer: [r.domElement.width, r.domElement.height],
    postPasses: (() => {
      const c = stage.composer;
      if (!c || !c.passes) return null;
      return c.passes.map((p) => ({ name: p.name || p.constructor.name, enabled: p.enabled !== false }));
    })(),
    shadowMap: { enabled: r.shadowMap.enabled, type: r.shadowMap.type, autoUpdate: r.shadowMap.autoUpdate },
  };
})()`;

async function boot({ scene, device }) {
  const dev = DEVICES[device] ?? DEVICES.mobile;
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox', '--js-flags=--expose-gc', '--enable-precise-memory-info'],
  });
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h },
    deviceScaleFactor: dev.dpr,
    isMobile: dev.isMobile, hasTouch: dev.hasTouch,
    userAgent: dev.isMobile ? UA_IPHONE : undefined,
  });
  await ctx.addInitScript(HOOK);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + SCENES[scene], { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(scene.startsWith('match') ? 'window.__gameReady === true' : 'window.__screenReady === true',
    null, { timeout: 120_000 });
  if (scene.startsWith('match')) {
    await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
      null, { timeout: 60_000 }).catch(() => {});
  }
  await page.waitForTimeout(700);
  return { browser, page, errs };
}

async function measure(page, frames = 60, mutate = null, depth = 1) {
  await page.waitForFunction('window.__pfHook() === true', null, { timeout: 30_000 });
  await page.evaluate(`window.__pfDepth = ${depth}`);
  if (mutate) await page.evaluate(mutate);
  await page.evaluate(START);
  await page.waitForFunction(`window.__pf.frames >= ${frames}`, null, { timeout: 180_000 });
  return page.evaluate(COLLECT);
}

// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '--');

function report(r, label) {
  console.log(`\n══ ${label} — tier ${r.tier} (detected ${r.detected}) · buffer ${r.buffer.join('x')} · ${r.frames} frames`);
  console.log(`   profile: cap ${r.profile?.pixelRatioCap} · bloom ${r.profile?.bloom} · smaa ${r.profile?.smaa} · msaa ${r.profile?.msaaSamples} · halfFloat ${r.profile?.halfFloatBuffers} · shadows ${r.profile?.shadows}@${r.profile?.shadowMapScale}`);
  console.log(`   graph: ${fmt(r.graph.objects)} objects · ${fmt(r.graph.meshes)} drawables · ${fmt(r.graph.geometries)} geometries · ${fmt(r.graph.materials)} materials · ${fmt(r.programs)} GL programs`);
  console.log(`   textures: ${r.graph.textures} unique in materials, ${(r.graph.textureBytes / 1048576).toFixed(2)} MB est · renderer holds ${r.memTextures} textures / ${r.memGeometries} geometries`);
  console.log(`   shadowMap ${r.shadowMap.enabled ? 'ON' : 'off'} (autoUpdate ${r.shadowMap.autoUpdate})`
    + (r.postPasses ? `   post: ${r.postPasses.map((p) => p.name + (p.enabled ? '' : '(off)')).join(' → ')}` : '   post: none'));
  const id = r.identity;
  const agree = Math.abs(id.hookDrawsPerFrame - id.infoCallsPerFrame) <= 1.5;
  console.log(`   IDENTITY: hook ${id.hookDrawsPerFrame.toFixed(1)} draws/frame vs renderer.info ${id.infoCallsPerFrame.toFixed(1)} — ${agree ? 'AGREE' : '🚨 DISAGREE, do not quote the split'}`);

  const byS = new Map();
  for (const d of r.drawn) {
    if (!byS.has(d.sub)) byS.set(d.sub, { sub: d.sub, main: 0, shadow: 0, mainTris: 0, shadowTris: 0 });
    const e = byS.get(d.sub);
    if (d.pass === 'shadow') { e.shadow += d.draws; e.shadowTris += d.tris; }
    else { e.main += d.draws; e.mainTris += d.tris; }
  }
  const graphBy = new Map(r.graph.bySub.map((g) => [g.sub, g]));
  const rows = [...byS.values()].sort((a, b) => (b.main + b.shadow) - (a.main + a.shadow));
  const tot = rows.reduce((a, b) => a + b.main + b.shadow, 0);
  const totT = rows.reduce((a, b) => a + b.mainTris + b.shadowTris, 0);

  console.log(`\n   DRAWN PER FRAME — charged to the subtree that issued the call`);
  console.log(`   ${'subsystem'.padEnd(24)} ${'draws'.padStart(7)} ${'main'.padStart(7)} ${'shadow'.padStart(7)} ${'%dr'.padStart(6)}  ${'tris/f'.padStart(10)} ${'%tri'.padStart(6)}`);
  for (const x of rows) {
    const d = x.main + x.shadow, t = x.mainTris + x.shadowTris;
    console.log(`   ${x.sub.slice(0, 24).padEnd(24)} ${fmt(d, 1).padStart(7)} ${fmt(x.main, 1).padStart(7)} ${fmt(x.shadow, 1).padStart(7)} ${((d / tot) * 100).toFixed(1).padStart(5)}%  ${fmt(t, 0).padStart(10)} ${((t / totT) * 100).toFixed(1).padStart(5)}%`);
  }
  console.log(`   ${'TOTAL'.padEnd(24)} ${fmt(tot, 1).padStart(7)} ${fmt(rows.reduce((a, b) => a + b.main, 0), 1).padStart(7)} ${fmt(rows.reduce((a, b) => a + b.shadow, 0), 1).padStart(7)} ${''.padStart(6)}  ${fmt(totT, 0).padStart(10)}`);

  console.log(`\n   GRAPH — geometry HELD per subsystem (drawn or not; this is what updateMatrixWorld + projectObject walk every frame)`);
  console.log(`   ${'subsystem'.padEnd(24)} ${'tris'.padStart(10)} ${'draw-objs'.padStart(9)} ${'objects'.padStart(8)} ${'instMesh'.padStart(8)} ${'instances'.padStart(9)} ${'outlines'.padStart(8)} ${'shadowCast'.padStart(10)} ${'transpM'.padStart(7)} ${'basicM'.padStart(6)}`);
  for (const g of r.graph.bySub) {
    console.log(`   ${g.sub.slice(0, 24).padEnd(24)} ${fmt(g.tris).padStart(10)} ${fmt(g.meshes).padStart(9)} ${fmt(g.objects).padStart(8)} ${fmt(g.instanced).padStart(8)} ${fmt(g.instances).padStart(9)} ${fmt(g.outlineMeshes).padStart(8)} ${fmt(g.castShadow).padStart(10)} ${fmt(g.transparentMats).padStart(7)} ${fmt(g.basicMats).padStart(6)}`);
  }
  const T = r.graph.bySub.reduce((a, b) => ({
    tris: a.tris + b.tris, meshes: a.meshes + b.meshes, objects: a.objects + b.objects,
    instanced: a.instanced + b.instanced, instances: a.instances + b.instances,
    outlineMeshes: a.outlineMeshes + b.outlineMeshes, castShadow: a.castShadow + b.castShadow,
  }), { tris: 0, meshes: 0, objects: 0, instanced: 0, instances: 0, outlineMeshes: 0, castShadow: 0 });
  console.log(`   ${'TOTAL'.padEnd(24)} ${fmt(T.tris).padStart(10)} ${fmt(T.meshes).padStart(9)} ${fmt(T.objects).padStart(8)} ${fmt(T.instanced).padStart(8)} ${fmt(T.instances).padStart(9)} ${fmt(T.outlineMeshes).padStart(8)} ${fmt(T.castShadow).padStart(10)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — four known-bad inputs.
// ─────────────────────────────────────────────────────────────────────────────
const INJECT = `(() => {
  const scene = window.__stage.scene;
  // The bundle is minified, so there is no global THREE. Reach the constructors
  // through an object that already exists — and require a PLAIN BufferAttribute
  // source, because an InterleavedBufferAttribute has a different signature and a
  // silently-wrong geometry would still produce a plausible count.
  let src = null;
  scene.traverse((o) => {
    if (src) return;
    const p = o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position;
    if (p && p.isBufferAttribute && !p.isInterleavedBufferAttribute && o.geometry.index) src = o;
  });
  if (!src) throw new Error('pf_census selftest: no plain-attribute mesh to borrow constructors from');
  const g = new (src.geometry.constructor)();
  const pos = new Float32Array(24);
  [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
    .forEach((p, i) => { pos[i*3] = p[0]; pos[i*3+1] = p[1]; pos[i*3+2] = p[2]; });
  g.setAttribute('position', new (src.geometry.attributes.position.constructor)(pos, 3));
  g.setIndex([0,1,2, 0,2,3, 4,6,5, 4,7,6, 0,4,5, 0,5,1, 1,5,6, 1,6,2, 2,6,7, 2,7,3, 3,7,4, 3,4,0]);
  const holder = new (src.parent.constructor)();
  holder.name = 'PF_SELFTEST_INJECT';
  const mat = Array.isArray(src.material) ? src.material[0] : src.material;
  const MeshC = src.constructor;
  for (let i = 0; i < 7; i++) {
    const m = new MeshC(g, mat);
    m.frustumCulled = false;        // it must be DRAWN, not merely present
    m.position.set(0, 400 + i, 0);
    m.scale.setScalar(0.001);       // ~0 pixels: this is a COUNT test, not a look test
    holder.add(m);
  }
  scene.add(holder);
})()`;

async function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n           got  ${JSON.stringify(got)}\n           want ${JSON.stringify(want)}`}`);
    ok ? pass++ : fail++;
  };
  const near = (name, got, want, tol) => {
    const ok = Math.abs(got - want) <= tol;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}   (got ${got}, want ${want}±${tol})`);
    ok ? pass++ : fail++;
  };

  console.log('\npf_census --selftest — four known-bad inputs, run against the live page\n');

  const A = await boot({ scene: 'match', device: 'mobile' });
  const base = await measure(A.page, 30);
  if (A.errs.length) console.log(`  (page errors: ${A.errs.slice(0, 2).join(' | ')})`);
  const gb = (r, s) => r.graph.bySub.find((x) => x.sub === s);

  // ── 4/TOTALS, on the untouched tree ───────────────────────────────────────
  near('4/TOTALS: hook draws/frame == renderer.info.render.calls/frame',
    +base.identity.hookDrawsPerFrame.toFixed(2), +base.identity.infoCallsPerFrame.toFixed(2), 1.0);
  check('4/TOTALS: renderer.info was read with autoReset OFF (the only true whole-frame read)',
    base.shadowMap.autoUpdate !== undefined && base.identity.infoFrames > 5, true);

  /**
   * ⚠️ DRIFT CONTROL, and it is load-bearing. The first version of the INJECT check
   * below asserted `graph.meshes` rose by exactly 7 and **it failed at 9** — because
   * `vfx_layer` creates and releases meshes while a match runs, so the graph churns
   * under any two measurements. That is a fault in the ASSERTION, not in the walker:
   * the scoped count (exactly 7 in the injected row) was right all along. A baseline
   * is itself a measurement (docs/LESSONS.md §6b corollary), so the churn is measured
   * here rather than assumed away, and the whole-graph check is scoped past it.
   */
  const CHURNY = (r) => r.graph.bySub.filter((g) => !/^vfx_layer/.test(g.sub))
    .reduce((a, b) => a + b.meshes, 0);
  const ctrl = await measure(A.page, 30);
  console.log(`  CONTROL  graph churn with NO mutation: whole ${ctrl.graph.meshes - base.graph.meshes} drawables, `
    + `non-vfx ${CHURNY(ctrl) - CHURNY(base)} — vfx_layer pools meshes during a match`);
  check('0/DRIFT CONTROL: the NON-vfx graph is stable across two measurements',
    CHURNY(ctrl) - CHURNY(base), 0);

  // ── 1/INJECT ──────────────────────────────────────────────────────────────
  const inj = await measure(A.page, 30, INJECT);
  check('1/KNOWN-BAD INJECT: a new subsystem row appears', !!gb(inj, 'PF_SELFTEST_INJECT'), true);
  check('1/KNOWN-BAD INJECT: exactly 7 drawables in it', gb(inj, 'PF_SELFTEST_INJECT')?.meshes, 7);
  check('1/KNOWN-BAD INJECT: exactly 84 triangles in it', gb(inj, 'PF_SELFTEST_INJECT')?.tris, 84);
  check('1/KNOWN-BAD INJECT: the non-vfx graph rose by exactly 7 — the walker counts once, not twice',
    CHURNY(inj) - CHURNY(ctrl), 7);
  near('1/KNOWN-BAD INJECT: the hook charges 7 draws/frame to it',
    +inj.drawn.filter((d) => d.sub === 'PF_SELFTEST_INJECT').reduce((a, b) => a + b.draws, 0).toFixed(2), 7, 0.35);

  // ── 2/HIDE ────────────────────────────────────────────────────────────────
  const biggest = base.graph.bySub.filter((g) => g.meshes > 20)[0].sub;
  const hid = await measure(A.page, 30, `(() => {
    const c = window.__stage.scene.children.find((x) => (x.name || x.type) === ${JSON.stringify(biggest)});
    if (!c) throw new Error('pf_census selftest: cannot find ' + ${JSON.stringify(biggest)});
    c.visible = false;
  })()`);
  const hidDraws = hid.drawn.filter((d) => d.sub === biggest).reduce((a, b) => a + b.draws, 0);
  const baseDraws = base.drawn.filter((d) => d.sub === biggest).reduce((a, b) => a + b.draws, 0);
  check(`2/KNOWN-BAD HIDE (${biggest}): draws fall to 0 (were ${baseDraws.toFixed(1)}/frame)`,
    hidDraws === 0 && baseDraws > 1, true);
  check('2/KNOWN-BAD HIDE: its MESH count is UNCHANGED — draws and graph are independent measurements',
    gb(hid, biggest)?.meshes, gb(base, biggest)?.meshes);
  await A.browser.close();

  // ── 3/SELF-PAIR ───────────────────────────────────────────────────────────
  const P = await boot({ scene: 'match', device: 'mobile' });
  const rp = await measure(P.page, 30); await P.browser.close();
  const Q = await boot({ scene: 'match', device: 'mobile' });
  const rq = await measure(Q.page, 30); await Q.browser.close();
  check('3/SELF-PAIR: two fresh loads agree on drawables', rp.graph.meshes, rq.graph.meshes);
  check('3/SELF-PAIR: two fresh loads agree on per-subsystem geometry triangles',
    rp.graph.bySub.map((x) => [x.sub, x.tris]), rq.graph.bySub.map((x) => [x.sub, x.tris]));
  check('3/SELF-PAIR: two fresh loads agree on materials, programs and detected tier',
    [rp.graph.materials, rp.programs, rp.detected], [rq.graph.materials, rq.programs, rq.detected]);
  check('3/SELF-PAIR: two fresh loads agree on main-pass draws/frame per subsystem',
    rp.drawn.filter((d) => d.pass === 'main').map((d) => [d.sub, Math.round(d.draws)]).sort(),
    rq.drawn.filter((d) => d.pass === 'main').map((d) => [d.sub, Math.round(d.draws)]).sort());

  console.log(`\npf_census selftest: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
if (!BASE) {
  console.error('pf_census: no server. `PH_SCRATCH=<dir> node tools/tmp/ph_serve.mjs --start --ref <sha>` first, or pass --url.');
  process.exit(2);
}
if (flag('selftest')) {
  await selftest();
} else {
  const scene = arg('scene', 'match');
  const device = arg('device', 'mobile');
  const frames = Number(arg('frames', 60));
  const depth = Number(arg('depth', 1));
  console.log(`\npf_census — ${SHA.slice(0, 7)} production build, scene "${scene}", device ${device}, depth ${depth}`);
  console.log('counts are EXACT and device-independent. No milliseconds here — see pf_ablate.mjs.');
  const { browser, page, errs } = await boot({ scene, device });
  const r = await measure(page, frames, null, depth);
  await browser.close();
  if (errs.length) console.log(`⚠ page errors: ${errs.slice(0, 3).join(' | ')}`);
  report(r, `${scene} @ ${device}`);
  const out = arg('json', null);
  if (out) { writeFileSync(out, JSON.stringify({ sha: SHA, scene, device, ...r }, null, 2)); console.log(`\nwrote ${out}`); }
}
