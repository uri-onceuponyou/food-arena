#!/usr/bin/env node
/**
 * CV RENDER — candidate concealment patches, as REAL geometry, in the REAL match, at
 * SHIPPED framing.
 *
 * ── What question this answers ────────────────────────────────────────────────
 *
 * `docs/DECISIONS-FOR-URI.md` §29a asks Uri to accept a constraint stated as a number:
 * `stepAI` has no search behaviour, it can see 84 wu from where it last saw you, so a
 * concealment patch wider than ~168 wu has an interior no AI can ever reach. Nobody can
 * picture 168 wu. This renders it.
 *
 * ── Why the patches are real meshes and not a 2D composite ───────────────────
 *
 * A composited footprint is only as trustworthy as the world->pixel mapping the person
 * drawing it assumed, and `docs/LESSONS.md` §6 records two agents getting exactly that
 * class of arithmetic wrong on this camera (13% and 7% against a true ~10.5%). Meshes
 * placed at world coordinates are projected by the renderer itself, so the scale is
 * correct BY CONSTRUCTION and there is no arithmetic to get wrong. The one number this
 * tool computes by hand — the pixel position of a label — is checked against the
 * rendered geometry it labels.
 *
 * Three independent scale controls are printed every run:
 *   1. `camera.position.x === px * WORLD_SCALE` exactly (the rig looks at the player).
 *   2. The character's on-screen height, by hide/show ablation (`framing.mjs`'s method,
 *      clock frozen so nothing else moves between the two renders). Shipped framing is
 *      10.6-12.6% of frame height; an isolation view would read ~3.5x that.
 *   3. `__fairView()` — the visible ground window in world units, so "168 wu" can be
 *      quoted as a fraction of the frame.
 *
 * ── The composition, identical in every panel ────────────────────────────────
 *
 * The player stands at (420, 620) in the shipped kitchen, on the SOUTH edge of the
 * candidate patch, which extends north (away from the camera). Same character, same
 * camera, same ground, same lighting in all four panels — only the patch changes. The
 * green ground fill is the part of the patch an AI that walks in can eventually see
 * (within 84 wu of an edge); the RED core is the part it never can.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/cv_render.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('cv_render: --url or PREVIEW_BASE required'); process.exit(2); }
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const OUT = String(args.out ?? 'shots/conceal');

// ── The measured AI facts this whole image is about ──────────────────────────
const SIGHT_WU = 84;          // how far stepAI sees from where it last saw you
const LIMIT_WU = 2 * SIGHT_WU; // 168 — the widest patch with no unreachable interior

const PX = 420, PY = 620;      // player world position; the patch's south edge is PY

/** Patch square: south edge on the player, centred on the player's x. */
const patch = (size) => ({ x: PX, y: PY - size / 2, s: size });

const VARIANTS = [
  { id: 'a', size: 120, patches: [patch(120)] },
  { id: 'b', size: LIMIT_WU, patches: [patch(LIMIT_WU)] },
  { id: 'c', size: 300, patches: [patch(300)] },
  {
    id: 'd',
    size: null,
    patches: [
      patch(120),
      { x: 200, y: 480, s: 120 },
      { x: 350, y: 555, s: 130 },
      { x: 565, y: 470, s: 120 },
      { x: 645, y: 660, s: 110 },
    ],
  },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: LAUNCH });
const results = {};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE-SIDE: build the mock. Everything below runs in the browser.
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_BUILD = async (spec) => {
  const S = 0.05;                       // WORLD_SCALE — src/units.ts
  const M = (n) => n * S;               // world units -> metres
  // The app's OWN three instance, found by its resource URL (Vite appends ?v=<hash>,
  // and a different query string is a different module instance in the browser).
  const url = performance.getEntriesByType('resource').map((e) => e.name)
    .find((n) => /deps\/three\.js/.test(n)) || '/node_modules/.vite/deps/three.js';
  const THREE = await import(url);
  const toon = await import('/src/render/toon.ts');
  const st = window.__stage;

  const mul = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // ── Shared materials. Kitchen, not foliage: glazed ceramic, steel, crate wood.
  // Cool-side hues on purpose — docs/LESSONS.md: the frame is under-chromatic and
  // the warm half of the wheel is reserved for the cast.
  const MAT = {
    plate:   toon.toonMat({ color: '#EDF3F7', roughness: 0.30 }),
    plateA:  toon.toonMat({ color: '#2FBFD0', roughness: 0.28 }),
    plateB:  toon.toonMat({ color: '#F2A03D', roughness: 0.30 }),
    steel:   toon.toonMat({ color: '#96C3E3', roughness: 0.34, metalness: 0.15 }),
    steelD:  toon.toonMat({ color: '#3E5A73', roughness: 0.45 }),
    wood:    toon.toonMat({ color: '#C2842C', roughness: 0.62 }),
    slat:    toon.toonMat({ color: '#4A4058', roughness: 0.70 }),
    lid:     toon.toonMat({ color: '#B9D4E8', roughness: 0.24, metalness: 0.2 }),
  };
  // Shared geometry — one cylinder / box / dome, scaled per instance.
  const GEO = {
    disc: new THREE.CylinderGeometry(1, 0.93, 1, 22),
    box:  new THREE.BoxGeometry(1, 1, 1),
    dome: new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
    knob: new THREE.SphereGeometry(1, 10, 8),
    ring: new THREE.TorusGeometry(1, 0.06, 8, 40),
  };
  const put = (geo, mat, sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  // ── One kitchen object. Footprint centred at the group origin, base at y = 0. ──
  function kitchenObject(rnd) {
    const g = new THREE.Group();
    const kind = rnd();
    if (kind < 0.5) {
      // STACK OF PLATES — the thing Uri named.
      const n = 10 + Math.floor(rnd() * 4);
      const r = M(10.5 + rnd() * 2.5);
      const t = M(3.2);
      // White glazed china, with two coloured plates banded into the SIDE of the
      // stack. The accent must never be the TOP plate: this camera looks almost
      // straight down, so whatever is on top is the whole read, and an accent there
      // turned every stack into a saturated disc instead of a stack of plates.
      for (let i = 0; i < n; i++) {
        const acc = (i === 3 ? MAT.plateA : (i === 7 ? MAT.plateB : MAT.plate));
        const rr = r * (i === n - 1 ? 1.04 : 1);
        g.add(put(GEO.disc, acc, rr, t * 0.92, rr, 0, t * i + t / 2, 0));
      }
      if (rnd() < 0.45) {
        // a pot lid resting on top
        const lr = r * 1.12;
        g.add(put(GEO.dome, MAT.lid, lr, lr * 0.55, lr, 0, t * n, 0));
        g.add(put(GEO.knob, MAT.steelD, M(2.2), M(2.2), M(2.2), 0, t * n + lr * 0.55, 0));
      }
    } else if (kind < 0.78) {
      // STACK OF TRAYS — steel gastronorm pans, jittered so the stack reads as a pile.
      const n = 9 + Math.floor(rnd() * 4);
      const t = M(3.4);
      const w = M(40 + rnd() * 8), d = M(26 + rnd() * 6);
      for (let i = 0; i < n; i++) {
        const m = put(GEO.box, i % 3 === 0 ? MAT.steelD : MAT.steel, w, t * 0.85, d, 0, t * i + t / 2, 0);
        m.rotation.y = (rnd() - 0.5) * 0.22;
        g.add(m);
      }
    } else {
      // UPTURNED CRATE with two slat bands.
      const w = M(30 + rnd() * 8), d = M(26 + rnd() * 8), h = M(34 + rnd() * 8);
      g.add(put(GEO.box, MAT.wood, w, h, d, 0, h / 2, 0));
      g.add(put(GEO.box, MAT.slat, w * 1.02, M(3), d * 1.02, 0, h * 0.28, 0));
      g.add(put(GEO.box, MAT.slat, w * 1.02, M(3), d * 1.02, 0, h * 0.74, 0));
      if (rnd() < 0.5) {
        // a couple of plates leaning on the crate
        const lr = M(11);
        const m = put(GEO.disc, MAT.plate, lr, M(3), lr, w * 0.4, h + M(2), 0);
        m.rotation.z = Math.PI / 2.2;
        g.add(m);
      }
    }
    g.rotation.y = rnd() * Math.PI * 2;
    return g;
  }

  // ── Ground decals: the FOOTPRINT (green = an AI that walks in can see it) and
  //    the DEAD CORE (red = more than 84 wu from every edge, so it never can).
  // `onTop` = drawn over the pile rather than under it. The first render put the
  // dead core UNDER the objects and it was invisible in exactly the panel it exists
  // for — 100 plate stacks stand on it. The boundary and the dead core are
  // ANNOTATION, not scenery, so they are allowed to sit on top; the plates and the
  // character are not.
  const decal = (color, opacity, onTop) => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    depthWrite: false, depthTest: !onTop, side: THREE.DoubleSide,
  });
  const plane = new THREE.PlaneGeometry(1, 1);
  function groundRect(cx, cy, w, h, y, mat) {
    const m = new THREE.Mesh(plane, mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(M(w), M(h), 1);
    m.position.set(M(cx), y, M(cy));
    m.renderOrder = mat.depthTest ? 6 : 999;
    return m;
  }
  function groundOutline(cx, cy, w, h, y, mat, tw) {
    const g = new THREE.Group();
    g.add(groundRect(cx, cy - h / 2, w, tw, y, mat));
    g.add(groundRect(cx, cy + h / 2, w, tw, y, mat));
    g.add(groundRect(cx - w / 2, cy, tw, h, y, mat));
    g.add(groundRect(cx + w / 2, cy, tw, h, y, mat));
    return g;
  }

  const root = new THREE.Group();
  root.name = 'cv_mock';
  const MAT_OK   = decal('#3BE08A', 0.20, false);
  const MAT_DEAD = decal('#FF2530', 0.42, true);
  const MAT_EDGE = decal('#FFFFFF', 0.92, true);
  const MAT_DEADEDGE = decal('#FF5560', 0.98, true);

  for (const p of spec.patches) {
    root.add(groundRect(p.x, p.y, p.s, p.s, 0.30, MAT_OK));
    root.add(groundOutline(p.x, p.y, p.s, p.s, 0.34, MAT_EDGE, 3.2));
    const core = p.s - 2 * spec.sight;
    if (core > 0) {
      root.add(groundRect(p.x, p.y, core, core, 0.36, MAT_DEAD));
      root.add(groundOutline(p.x, p.y, core, core, 0.38, MAT_DEADEDGE, 3.2));
    }
    // Objects on a jittered lattice, inset so nothing crosses the boundary.
    const inset = 15;
    const span = p.s - 2 * inset;
    const n = Math.max(2, Math.round(span / 30));
    const cell = span / n;
    const rnd = mul(Math.round(p.x * 131 + p.y * 17 + p.s));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const ox = -span / 2 + cell * (i + 0.5) + (rnd() - 0.5) * cell * 0.34;
        const oy = -span / 2 + cell * (j + 0.5) + (rnd() - 0.5) * cell * 0.34;
        const o = kitchenObject(rnd);
        o.position.set(M(p.x + ox), 0.02, M(p.y + oy));
        root.add(o);
      }
    }
  }
  st.scene.add(root);

  // ── Projection, done by the renderer's own camera. Returns pixel coords. ─────
  const cam = st.rig.camera;
  cam.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const proj = (wx, wy, my) => {
    v.set(M(wx), my || 0, M(wy)).project(cam);
    return [ (v.x * 0.5 + 0.5) * spec.W, (-v.y * 0.5 + 0.5) * spec.H ];
  };
  const rectPx = (p, s) => ([
    proj(p.x - s / 2, p.y - s / 2), proj(p.x + s / 2, p.y - s / 2),
    proj(p.x + s / 2, p.y + s / 2), proj(p.x - s / 2, p.y + s / 2),
  ]);
  return {
    objects: root.children.length,
    camX: cam.position.x, camZ: cam.position.z,
    fair: window.__fairView(),
    patches: spec.patches.map((p) => ({
      ...p, core: p.s - 2 * spec.sight,
      quad: rectPx(p, p.s),
      coreQuad: p.s - 2 * spec.sight > 0 ? rectPx(p, p.s - 2 * spec.sight) : null,
    })),
    player: { feet: proj(spec.px, spec.py), head: proj(spec.px, spec.py, 2.1) },
    // Two SHIPPED objects with known world footprints, projected. Overlaying these on
    // the frame is the check that the mapping used for labels is the renderer's.
    control: {
      boilingPot: rectPx({ x: 700, y: 500 }, 104),
      hazardRing: [proj(605, 500), proj(795, 500)],
      ruler100: [proj(spec.px - 50, spec.py + 55), proj(spec.px + 50, spec.py + 55)],
    },
  };
};

for (const variant of VARIANTS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => console.log(`PAGEERROR[${variant.id}]:`, String(e)));
  // Freeze `performance.now()` on demand — the character ablation needs two renders
  // that differ in exactly one thing (framing.mjs's note).
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    performance.now = () => (paused ? virt : realNow() - base);
    window.__clk = {
      pause() { if (!paused) { virt = realNow() - base; paused = true; } },
      resume() { if (paused) { base = realNow() - virt; paused = false; } },
    };
  });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));

  const url = `${BASE}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&px=${PX}&py=${PY}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240000 });

  // THE TRAP THE BRIEF NAMES: `?px=`/`?py=` do not validate against cover, and a fighter
  // parked inside a CoverBox refuses every move silently. `match.ts` publishes the check.
  // (`??` cannot express this: `null ?? fallback` is the fallback, and null is the PASS.)
  const spawn = await page.evaluate(() => (window.__matchDebug
    ? { has: true, v: window.__matchDebug.qaSpawnInsideCover } : { has: false }));
  if (!spawn.has) { console.error(`cv_render[${variant.id}]: no __matchDebug`); process.exit(1); }
  if (spawn.v !== null) { console.error(`cv_render[${variant.id}]: spawn is inside cover -> ${spawn.v}`); process.exit(1); }

  // Past the countdown: the "3 2 1" overlay is not the game.
  await page.waitForFunction('window.__matchDebug && window.__matchDebug.phase === "playing"', null, { timeout: 120000 });
  await page.waitForTimeout(1400);

  const info = await page.evaluate(PAGE_BUILD, {
    patches: variant.patches, sight: SIGHT_WU, px: PX, py: PY, W, H,
  });
  await page.waitForTimeout(1600);
  await page.evaluate(() => window.__clk.pause());
  await page.waitForTimeout(400);

  const buf = await page.screenshot({ timeout: 240000 });
  await writeFile(`${OUT}/panel_${variant.id}.png`, buf);

  // ── SCALE CONTROL 2, once: the character's own on-screen height by ablation ──
  let charBox = null;
  if (variant.id === 'a') {
    charBox = await page.evaluate(([w, h]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const grab = () => {
        stage.render(0);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(stage.canvas, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data;
      };
      let root = null;
      stage.scene.traverse((o) => { if (o.name === 'character:hamburger') root = o; });
      if (!root) return null;
      const sm = stage.renderer.shadowMap.enabled;
      stage.renderer.shadowMap.enabled = false;
      root.visible = false; const off = grab();
      root.visible = true; const on = grab();
      stage.renderer.shadowMap.enabled = sm;
      const rowsN = new Int32Array(h), colsN = new Int32Array(w);
      let n = 0;
      for (let i = 0, p = 0; i < on.length; i += 4, p++) {
        const d = Math.max(Math.abs(on[i] - off[i]), Math.abs(on[i + 1] - off[i + 1]), Math.abs(on[i + 2] - off[i + 2]));
        if (d < 10) continue;
        n++; rowsN[(p / w) | 0]++; colsN[p % w]++;
      }
      if (!n) return { px: 0 };
      const peakRow = Math.max(...rowsN), peakCol = Math.max(...colsN);
      const occR = Math.max(2, peakRow * 0.15), occC = Math.max(2, peakCol * 0.15);
      let miny = -1, maxy = -1, minx = -1, maxx = -1;
      for (let y = 0; y < h; y++) if (rowsN[y] >= occR) { if (miny < 0) miny = y; maxy = y; }
      for (let x = 0; x < w; x++) if (colsN[x] >= occC) { if (minx < 0) minx = x; maxx = x; }
      return {
        px: n, bbox: [minx, miny, maxx, maxy], w: maxx - minx + 1, h: maxy - miny + 1,
        heightPct: +(100 * (maxy - miny + 1) / h).toFixed(2),
        widthPct: +(100 * (maxx - minx + 1) / w).toFixed(2),
      };
    }, [W, H]);
  }

  results[variant.id] = { ...info, charBox, variant: { id: variant.id, size: variant.size } };
  console.log(`panel ${variant.id}: ${info.objects} nodes, cam.x=${info.camX.toFixed(4)} (expect ${(PX * 0.05).toFixed(4)})`
    + `${charBox ? `, character ${charBox.h}px = ${charBox.heightPct}% of frame` : ''}`);
  await page.close();
}

await browser.close();
await writeFile(`${OUT}/panels.json`, JSON.stringify({ W, H, PX, PY, SIGHT_WU, LIMIT_WU, results }, null, 2));

const f = results.a.fair;
console.log('\n══ SCALE CONTROLS ══');
console.log(`  1. camera.x        ${results.a.camX} vs px*WORLD_SCALE ${PX * 0.05}  ${Math.abs(results.a.camX - PX * 0.05) < 1e-9 ? 'EXACT' : 'MISMATCH'}`);
console.log(`  2. character       ${results.a.charBox?.h} px of ${H} = ${results.a.charBox?.heightPct}%  (shipped band 10.6-12.6%)`);
console.log(`  3. ground window   ${(f.halfWidthUnits * 2).toFixed(1)} wu wide x ${(f.nearUnits + f.farUnits).toFixed(1)} wu deep`);
console.log(`     -> 120 wu = ${(120 / (f.halfWidthUnits * 2) * 100).toFixed(1)}% of frame width; `
  + `168 = ${(168 / (f.halfWidthUnits * 2) * 100).toFixed(1)}%; 300 = ${(300 / (f.halfWidthUnits * 2) * 100).toFixed(1)}%`);
console.log(`     -> 300 wu is ${(300 / (f.nearUnits + f.farUnits) * 100).toFixed(1)}% of the visible DEPTH`);
console.log(`\nwrote ${OUT}/panel_{a,b,c,d}.png and ${OUT}/panels.json`);
