#!/usr/bin/env node
/**
 * THROWAWAY probe for the "kill the cast decals + rotate the key azimuth" change.
 *
 * Everything here is measured on the LIVE game at shipped framing, player-centred,
 * with rAF frozen so every variant differs only by the mutation under test.
 *
 * Modes
 *   --mode ablate   hide each baked-decal family in turn, report mean/max/%changed
 *   --mode sweep    sweep the key light's AZIMUTH at fixed elevation + distance and
 *                   report the full acceptance battery for each
 *   --mode verify   run the acceptance battery once on the tree as it stands
 *
 * Acceptance battery (see the report for thresholds)
 *   L1 figure/ground     body mean vs floor annulus mean          >= 0.10
 *   L2 directional shad. darkest-1% centroid offset / R           >= 0.10, ratio <= 0.88
 *   L3 form ramp (hero)  p90-p10 over body pixels                 >= 0.28, clip < 1%
 *   L5 modelling         away/lit on a neutral matte sphere       <= 0.55  (lower better)
 *                        + p90-p10 across the barrel's curved skirt (higher better)
 *   L6 shadow merge      real-shadow-map mask on floor pixels: area %, connected
 *                        component count, largest-component share  (guard, not a target)
 *   L4 colour            whole-frame anyChan==0 / ==255 census
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const mode = get('--mode', 'verify');
const label = get('--label', mode);
const W = Number(get('--w', 1300)), H = Number(get('--h', 740));
const url = get('--url', 'http://localhost:5173/?player=hamburger&enemy=donut&simSpeed=12');
const grid = JSON.parse(get('--grid', 'null'));
const shotDir = get('--shots', `shots/rake/${label}`);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.error('!! PAGE RELOADED mid-probe'); });

// Five other agents are editing this repo live, and every save fires a Vite HMR update
// that full-reloads the app and wipes the probe's in-page state halfway through a
// sweep. Stub the HMR client out so the page loaded here is frozen for its lifetime.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200,
  contentType: 'text/javascript',
  body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
}));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__previewReady === true || window.__gameReady === true', null, { timeout: 60000 });
if (url.includes('/?')) {
  await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 90000 });
}
await page.waitForFunction('window.__stage && window.__stage.scene', null, { timeout: 60000 });
await page.waitForTimeout(500);
// Optional: walk the player somewhere prop-dense before freezing. "--walk KeyD:2500"
const walk = get('--walk', null);
if (walk) {
  for (const seg of walk.split(',')) {
    const [code, ms] = seg.split(':');
    await page.keyboard.down(code);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(code);
  }
  await page.waitForTimeout(700);
}
await page.evaluate(() => { window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(300);
await mkdir(shotDir, { recursive: true });

// ── The in-page toolkit, installed once ──────────────────────────────────────
// NOTE: deliberately NO `await import('three')` in here. Asking Vite for a dep URL can
// trigger a dep re-optimisation, which FULL-PAGE-RELOADS the app mid-evaluate and wipes
// `window.__stage` out from under the probe. Every class this needs is taken off a live
// object's constructor instead.
await page.evaluate(() => {
  const stage = window.__stage;
  const scene = stage.scene;
  const gl = stage.renderer.getContext();
  const cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const K = {};
  window.__K = K;
  K.stage = stage; K.scene = scene; K.W = W; K.H = H;
  // Class handles harvested off live objects, so no module import is needed.
  K.Vec3 = stage.rig.camera.position.constructor;
  let anyStd = null;
  scene.traverse((o) => { if (!anyStd && o.isMesh && o.material?.isMeshStandardMaterial) anyStd = o.material; });
  K.anyStd = anyStd;

  K.read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  K.lum = (p, i) => (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
  K.shot = () => { stage.render(1 / 60); stage.render(1 / 60); return K.read(); };

  // ── isolate-render a set of objects against black to get a screen mask ──────
  K.maskOf = (pred) => {
    const hidden = [];
    scene.traverse((o) => {
      if (o === scene) return;
      if (!o.visible) return;
      if (pred(o)) return;            // keep
      // hide only if no kept descendant
      let keep = false;
      o.traverse((c) => { if (pred(c)) keep = true; });
      if (!keep) { hidden.push(o); o.visible = false; }
    });
    const fog = scene.fog, bg = scene.background;
    scene.fog = null; scene.background = null;
    stage.renderer.setRenderTarget(null);
    stage.renderer.setClearColor(0x000000, 1);
    stage.renderer.clear();
    stage.renderer.render(scene, stage.rig.camera);
    const m = K.read();
    for (const o of hidden) o.visible = true;
    scene.fog = fog; scene.background = bg;
    const bits = new Uint8Array(W * H);
    for (let k = 0; k < W * H; k++) bits[k] = (m[k * 4] + m[k * 4 + 1] + m[k * 4 + 2] > 12) ? 1 : 0;
    return bits;
  };

  // Named-object lookups
  K.playerObj = scene.children.find((o) => o.name?.startsWith?.('character:'));
  K.floorNames = /^(floor|apron|tile|arena_floor)/i;

  // ── neutral-albedo probe: repaint the picked barrel's CURVED skirt+body in flat
  // 0.5 grey, so p90-p10 across its mask is pure lighting with zero texture/albedo
  // contribution. A cylinder is the right probe here anyway — it is the geometry the
  // arena actually has, and the thing the modelling claim is about.
  // A genuinely PLAIN standard material. `.clone()` of a scene material is not good
  // enough: `toonMat` installs an onBeforeCompile ramp, which quantises the shading
  // into bands and hides exactly the gradient this is trying to measure. Constructed
  // from the class instead, so no ramp hook is carried over.
  K.greyMat = () => new K.anyStd.constructor({ color: 0x808080, roughness: 0.6, metalness: 0 });

  K.neutralise = () => {
    K.saved = [];
    if (!K.barrel) return 0;
    const grey = K.greyMat();
    K.barrel.traverse((o) => {
      if (o.isMesh && /barrel_(skirt|body)/.test(o.name || '')) { K.saved.push([o, o.material]); o.material = grey; }
    });
    return K.saved.length;
  };
  K.restore = () => { for (const [o, m] of K.saved ?? []) o.material = m; K.saved = []; };

  // ── framing-INDEPENDENT modelling probe ────────────────────────────────────
  // A vertical cylinder in flat 0.5 grey, cloned off a real barrel skirt (so no THREE
  // import is needed) and parked dead centre of frame at the camera's look-at point.
  // p90-p10 across its mask is the terminator ramp with zero albedo contribution, and
  // it is measured at the same screen position for every azimuth, which the barrel
  // itself is not: "side-on" is relative to the view ray AT THE OBJECT, so a prop
  // sitting off to one side reads a different angle than one at the centre.
  K.addProbe = () => {
    if (!K.barrel) return null;
    let src = null;
    K.barrel.traverse((o) => { if (!src && o.isMesh && /barrel_skirt/.test(o.name || '')) src = o; });
    if (!src) return null;
    const p = src.clone();
    p.name = '__probe_cyl';
    p.material = K.greyMat();
    p.castShadow = true; p.receiveShadow = true;
    // TALL and NARROW on purpose. A squat cylinder viewed at this rig's 58 deg pitch is
    // mostly its own flat TOP face, whose normal points at the sky — so its shading is
    // sin(elevation) and does not move with azimuth at all. The first version of this
    // probe returned an identical ramp for every azimuth for exactly that reason. The
    // side wall is the only surface that carries the terminator, so it has to dominate
    // the pixel count.
    p.scale.set(1.0, 26, 1.0);
    p.rotation.set(0, 0, 0);
    const t = stage.rig.target;
    p.position.set(t.x, 1.6, t.z);
    scene.add(p);
    K.probe = p;
    return p;
  };
  K.removeProbe = () => { if (K.probe) { scene.remove(K.probe); K.probe = null; } };

  /** Save a bitmask as a data URL so the caller can eyeball it. */
  K.maskPng = (bits) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let k = 0; k < W * H; k++) {
      // gl readPixels is bottom-up; flip into image order
      const x = k % W, y = (k / W) | 0;
      const j = ((H - 1 - y) * W + x) * 4;
      const v = bits[k] ? 255 : 0;
      img.data[j] = v; img.data[j + 1] = v; img.data[j + 2] = v; img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  };

  // ── find the barrel nearest screen-centre with a decent on-screen footprint ──
  K.pickBarrel = () => {
    scene.updateMatrixWorld(true);
    const cams = stage.rig.camera;
    let best = null;
    scene.traverse((o) => {
      if (o.name !== 'cover:supply_barrel') return;
      const p = new K.Vec3().setFromMatrixPosition(o.matrixWorld).project(cams);
      const sx = (p.x * 0.5 + 0.5) * W, sy = (p.y * 0.5 + 0.5) * H;
      if (p.z > 1 || sx < 0 || sx > W || sy < 0 || sy > H) return;
      const d = Math.hypot(sx - W / 2, sy - H / 2);
      if (!best || d < best.d) best = { o, d, sx, sy };
    });
    K.barrel = best?.o ?? null;
    return best ? { name: best.o.name, sx: Math.round(best.sx), sy: Math.round(best.sy) } : null;
  };

  K.setKey = (azDeg, elevDeg, dist) => {
    const L = stage.lighting;
    const t = L.key.target.position;
    const az = azDeg * Math.PI / 180, e = elevDeg * Math.PI / 180;
    L.key.position.set(t.x + dist * Math.cos(e) * Math.cos(az), dist * Math.sin(e), t.z + dist * Math.cos(e) * Math.sin(az));
    L.key.target.updateMatrixWorld();
  };

  /** Morphological opening (erode then dilate), radius `r` px.
   *  The tile field self-shadows in its grout gaps, which puts a 1-2 px LATTICE into
   *  the shadow mask. Left in, that lattice wires every real shadow blob to every other
   *  one and the component count becomes a measure of grout, not of shadows merging. */
  K.open = (bits, r) => {
    const er = new Uint8Array(W * H), di = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let all = 1;
      for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r && all; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !bits[ny * W + nx]) all = 0;
      }
      er[y * W + x] = all;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!er[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) di[ny * W + nx] = 1;
      }
    }
    return di;
  };

  // ── connected components over a bitmask ────────────────────────────────────
  K.components = (bits, minPx) => {
    const seen = new Uint8Array(W * H);
    const sizes = [];
    const stack = new Int32Array(W * H);
    for (let s = 0; s < W * H; s++) {
      if (!bits[s] || seen[s]) continue;
      let sp = 0, n = 0;
      stack[sp++] = s; seen[s] = 1;
      while (sp > 0) {
        const c = stack[--sp]; n++;
        const cx = c % W, cy = (c / W) | 0;
        if (cx > 0 && bits[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack[sp++] = c - 1; }
        if (cx < W - 1 && bits[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack[sp++] = c + 1; }
        if (cy > 0 && bits[c - W] && !seen[c - W]) { seen[c - W] = 1; stack[sp++] = c - W; }
        if (cy < H - 1 && bits[c + W] && !seen[c + W]) { seen[c + W] = 1; stack[sp++] = c + W; }
      }
      sizes.push(n);
    }
    sizes.sort((x, y) => y - x);
    const big = sizes.filter((n) => n >= minPx);
    const total = big.reduce((x, y) => x + y, 0);
    return { count: big.length, total, largest: big[0] ?? 0, largestShare: total ? (big[0] ?? 0) / total : 0 };
  };
});

// Optional: park the camera on a world position (world UNITS) instead of the player.
const look = get('--look', null);
if (look) {
  const [lx, ly] = look.split(',').map(Number);
  await page.evaluate(({ lx, ly }) => {
    const K = window.__K, stage = K.stage;
    stage.rig.snapTo(lx * 0.05, ly * 0.05);
    stage.lighting.focus(lx * 0.05, ly * 0.05);
    K.shot();
  }, { lx, ly });
}

const barrelInfo = await page.evaluate(() => window.__K.pickBarrel());
console.log('barrel picked:', JSON.stringify(barrelInfo));

// ── the acceptance battery, run against whatever state the page is in ────────
async function battery(tag) {
  return page.evaluate(({ tag }) => {
    const K = window.__K, W = K.W, H = K.H, stage = K.stage, scene = K.scene;

    function isDescendant(o, root) { let p = o; while (p) { if (p === root) return true; p = p.parent; } return false; }
    const bodyMask = K.maskOf((o) => o === K.playerObj || (o.isMesh && isDescendant(o, K.playerObj)));
    const barrelMask = K.barrel ? K.maskOf((o) => isDescendant(o, K.barrel) && o.isMesh
      && /barrel_(skirt|body)/.test(o.name)) : new Uint8Array(W * H);
    // Occupied = everything standing ON the ground. Defined by GROUP membership, not by
    // name matching: the floor is two unnamed InstancedMeshes, so a name-based "is this
    // ground?" test classified the entire floor as occupied and left only the grout gaps
    // as ground — which made the shadow-merge numbers a measure of grout, not shadow.
    const occRoots = [];
    const propsG = scene.getObjectByName('arena_props');
    if (propsG) occRoots.push(propsG);
    scene.traverse((o) => {
      if (/^character:/.test(o.name || '')) occRoots.push(o);
      if (/^(hazard|pot|puddle|boiling)/i.test(o.name || '')) occRoots.push(o);
    });
    const occMask = K.maskOf((o) => o.isMesh && occRoots.some((r) => isDescendant(o, r)));

    const frame = K.shot();
    const g = (i) => K.lum(frame, i);

    // ── L1 / L3 ─────────────────────────────────────────────────────────────
    let bN = 0, bS = 0, bx = 0, by = 0, clipped = 0;
    const bodyVals = [];
    for (let k = 0; k < W * H; k++) {
      if (!bodyMask[k]) continue;
      const i = k * 4, v = g(i);
      bN++; bS += v; bodyVals.push(v); bx += k % W; by += (k / W) | 0;
      if (frame[i] === 255 || frame[i + 1] === 255 || frame[i + 2] === 255
        || (frame[i] === 0 && frame[i + 1] === 0 && frame[i + 2] === 0)) clipped++;
    }
    bodyVals.sort((p, q) => p - q);
    const pct = (arr, q) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(q * arr.length))] : 0;
    const cx = bN ? bx / bN : W / 2, cy = bN ? by / bN : H / 2;
    let aN = 0, aS = 0;
    const R0 = 55, R1 = 140;
    for (let y = Math.max(0, cy - R1) | 0; y < Math.min(H, cy + R1); y++)
      for (let x = Math.max(0, cx - R1) | 0; x < Math.min(W, cx + R1); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 < R0 * R0 || d2 > R1 * R1) continue;
        const k = y * W + x;
        if (bodyMask[k]) continue;
        aN++; aS += g(k * 4);
      }

    // ── L2 directional shadow around the feet ───────────────────────────────
    // Feet are taken from the body MASK (its lowest row, centred), not from
    // `__vfxDebugScreen` — that handle is written by the game loop, which is frozen, so
    // it goes stale the moment the camera is parked anywhere but on the player.
    let fx0 = W, fx1 = 0, fyMin = H;
    for (let k = 0; k < W * H; k++) {
      if (!bodyMask[k]) continue;
      const x = k % W, y = (k / W) | 0;   // framebuffer y is bottom-up
      if (y < fyMin) { fyMin = y; fx0 = x; fx1 = x; }
      else if (y === fyMin) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; }
    }
    const feetX = Math.round((fx0 + fx1) / 2), feetY = fyMin;
    const RS = 130; const disc = [];
    for (let y = Math.max(0, feetY - RS); y < Math.min(H, feetY + RS); y++)
      for (let x = Math.max(0, feetX - RS); x < Math.min(W, feetX + RS); x++) {
        if ((x - feetX) ** 2 + (y - feetY) ** 2 > RS * RS) continue;
        const k = y * W + x;
        if (bodyMask[k]) continue;
        disc.push([g(k * 4), x, y]);
      }
    disc.sort((p, q) => p[0] - q[0]);
    const kDark = Math.max(1, Math.floor(disc.length * 0.01));
    let sx = 0, sy = 0, sv = 0;
    for (let k = 0; k < kDark; k++) { sx += disc[k][1]; sy += disc[k][2]; sv += disc[k][0]; }
    const discMean = disc.reduce((p, d) => p + d[0], 0) / Math.max(1, disc.length);

    const L = stage.lighting;

    // ── L5a barrel curved skirt+body, AS SHIPPED (real albedo + texture) ────
    const barVals = [];
    for (let k = 0; k < W * H; k++) if (barrelMask[k]) barVals.push(g(k * 4));
    barVals.sort((p, q) => p - q);

    // ── L5b same surface repainted flat 0.5 grey: pure lighting terminator ──
    const nCount = K.neutralise();
    const nFrame = K.shot();
    const nVals = [];
    for (let k = 0; k < W * H; k++) if (barrelMask[k]) nVals.push(K.lum(nFrame, k * 4));
    nVals.sort((p, q) => p - q);
    K.restore();
    K.shot();

    // ── L5c centred neutral cylinder: same screen position at every azimuth ──
    const probe = K.addProbe();
    const probeMask = probe ? K.maskOf((o) => o === probe) : new Uint8Array(W * H);
    const pFrame = K.shot();
    const pVals = [];
    for (let k = 0; k < W * H; k++) if (probeMask[k]) pVals.push(K.lum(pFrame, k * 4));
    pVals.sort((p, q) => p - q);
    K.removeProbe();
    K.shot();

    // ── L6 real-shadow-map mask on ground pixels ────────────────────────────
    const litFrame = (() => {
      const was = L.key.castShadow; L.key.castShadow = false;
      const f = K.shot(); L.key.castShadow = was; K.shot();
      return f;
    })();
    const raw = new Uint8Array(W * H);
    let groundN = 0, shadowDepthSum = 0, rawN = 0;
    for (let k = 0; k < W * H; k++) {
      if (occMask[k] || bodyMask[k]) continue;
      groundN++;
      const d = K.lum(litFrame, k * 4) - g(k * 4);
      if (d > 0.03) { raw[k] = 1; rawN++; shadowDepthSum += d; }
    }
    const shadowBits = K.open(raw, 2);
    let shadowN = 0;
    for (let k = 0; k < W * H; k++) if (shadowBits[k] && !occMask[k] && !bodyMask[k]) shadowN++; else shadowBits[k] = 0;
    const comp = K.components(shadowBits, 150);
    const shadowPng = K.maskPng(shadowBits);

    // ── L7 the PLAYER's own cast shadow, isolated by hiding the player ───────
    // The single clearest read on "is the light direction legible on the ground?".
    // Screen length matters more than world length here: this rig pitches 58 deg, so a
    // shadow thrown along world -Z is foreshortened to ~0.53x on screen while one along
    // world -X is seen at full length. Azimuth therefore changes how long a shadow
    // LOOKS even though elevation (which sets its true length) never moves.
    const wasVis = K.playerObj.visible;
    K.playerObj.visible = false;
    const noPlayer = K.shot();
    K.playerObj.visible = wasVis;
    K.shot();
    let psN = 0, pMax = 0, pSumX = 0, pSumY = 0;
    const psBits = new Uint8Array(W * H);
    for (let k = 0; k < W * H; k++) {
      if (bodyMask[k] || occMask[k]) continue;
      if (K.lum(noPlayer, k * 4) - g(k * 4) <= 0.03) continue;
      psBits[k] = 1;
    }
    const psOpen = K.open(psBits, 2);
    for (let k = 0; k < W * H; k++) {
      if (!psOpen[k] || bodyMask[k] || occMask[k]) continue;
      const x = k % W, y = (k / W) | 0;
      psN++; pSumX += x; pSumY += y;
      const d = Math.hypot(x - feetX, y - feetY);
      if (d > pMax) pMax = d;
    }

    // ── L4 whole-frame census ───────────────────────────────────────────────
    let zero = 0, full = 0, n = 0, satSum = 0, valSum = 0;
    for (let i = 0; i < frame.length; i += 4) {
      const r = frame[i], gg = frame[i + 1], b = frame[i + 2]; n++;
      if (r === 0 || gg === 0 || b === 0) zero++;
      if (r === 255 || gg === 255 || b === 255) full++;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      valSum += mx / 255; satSum += mx === 0 ? 0 : (mx - mn) / mx;
    }

    return {
      tag,
      keyPos: [+L.key.position.x.toFixed(2), +L.key.position.y.toFixed(2), +L.key.position.z.toFixed(2)],
      keyAzDeg: +(Math.atan2(L.key.position.z - L.key.target.position.z, L.key.position.x - L.key.target.position.x) * 180 / Math.PI).toFixed(2),
      bodyPx: bN, barrelPx: barVals.length, groundPx: groundN,
      L1: { body: bS / bN, floor: aS / aN, delta: Math.abs(bS / bN - aS / aN) },
      L2: { offsetFrac: Math.hypot(sx / kDark - feetX, sy / kDark - feetY) / RS,
            darkRatio: discMean ? (sv / kDark) / discMean : 1,
            dx: +(sx / kDark - feetX).toFixed(1), dy: +(sy / kDark - feetY).toFixed(1) },
      L3: { p10: pct(bodyVals, 0.10), p90: pct(bodyVals, 0.90),
            ramp: pct(bodyVals, 0.90) - pct(bodyVals, 0.10), clipPct: 100 * clipped / bN },
      L5: { neutralisedMeshes: nCount,
            barrelP10: pct(barVals, 0.10), barrelP90: pct(barVals, 0.90),
            barrelRamp: pct(barVals, 0.90) - pct(barVals, 0.10),
            greyP10: pct(nVals, 0.10), greyP50: pct(nVals, 0.50), greyP90: pct(nVals, 0.90),
            greyRamp: pct(nVals, 0.90) - pct(nVals, 0.10),
            greyRatio: pct(nVals, 0.90) > 0 ? pct(nVals, 0.10) / pct(nVals, 0.90) : 1,
            probePx: pVals.length,
            probeP10: pct(pVals, 0.10), probeP50: pct(pVals, 0.50), probeP90: pct(pVals, 0.90),
            probeRamp: pct(pVals, 0.90) - pct(pVals, 0.10),
            probeRatio: pct(pVals, 0.90) > 0 ? pct(pVals, 0.10) / pct(pVals, 0.90) : 1 },
      L6: { shadowPctOfGround: 100 * shadowN / Math.max(1, groundN),
            rawPctOfGround: 100 * rawN / Math.max(1, groundN),
            meanDepth: rawN ? shadowDepthSum / rawN : 0,
            comps: comp.count, largestPx: comp.largest, largestShare: comp.largestShare },
      L4: { zeroPct: 100 * zero / n, fullPct: 100 * full / n, meanSat: satSum / n, meanVal: valSum / n },
      L7: { castPx: psN, reachPx: pMax,
            cx: psN ? +(pSumX / psN - feetX).toFixed(1) : 0,
            cy: psN ? +(pSumY / psN - feetY).toFixed(1) : 0,
            feet: [feetX, feetY] },
      shadowPng,
    };
  }, { tag });
}

function row(r) {
  return `${String(r.tag).padEnd(14)} az${String(r.keyAzDeg).padStart(7)}  `
    + `L1 ${r.L1.delta.toFixed(3)}  L2 off ${r.L2.offsetFrac.toFixed(3)} rat ${r.L2.darkRatio.toFixed(3)}  `
    + `L3 ${r.L3.ramp.toFixed(3)}  | PROBE ramp ${r.L5.probeRamp.toFixed(3)} p10/p90 ${r.L5.probeRatio.toFixed(3)}  `
    + `GREY ${r.L5.greyRatio.toFixed(3)} BAR ${r.L5.barrelRamp.toFixed(3)}  | SHD ${r.L6.shadowPctOfGround.toFixed(2)}% comps ${String(r.L6.comps).padStart(3)} `
    + `lgst ${(100 * r.L6.largestShare).toFixed(1)}%  | HEROSHD ${String(r.L7.castPx).padStart(5)}px reach ${r.L7.reachPx.toFixed(0)} `
    + `| clip0 ${r.L4.zeroPct.toFixed(2)} clip255 ${r.L4.fullPct.toFixed(2)} sat ${r.L4.meanSat.toFixed(3)}`;
}

const results = [];

if (mode === 'ablate') {
  const fams = [
    ['cast decals', "/^cast_shadow/"],
    ['contact/AO', "/^contact_shadow/"],
    ['both', "/^(cast|contact)_shadow/"],
  ];
  const out = await page.evaluate(async (fams) => {
    const K = window.__K, W = K.W, H = K.H;
    const A = K.shot();
    const rows = [];
    for (const [name, re] of fams) {
      const rx = new RegExp(re.slice(1, re.lastIndexOf('/')));
      const hidden = [];
      K.scene.traverse((o) => { if (o.visible && rx.test(o.name || '')) { hidden.push(o); o.visible = false; } });
      const B = K.shot();
      let sum = 0, max = 0, changed = 0;
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        sum += d; if (d > max) max = d; if (d > 2) changed++;
      }
      for (const o of hidden) o.visible = true;
      K.shot();
      rows.push({ name, hiddenCount: hidden.length, mean: sum / (W * H), max, changedPct: 100 * changed / (W * H) });
    }
    return rows;
  }, fams);
  console.log('\n=== BAKED DECAL ABLATION, shipped framing ===');
  for (const r of out) console.log(`${r.name.padEnd(14)} n=${String(r.hiddenCount).padStart(3)}  mean ${r.mean.toFixed(3)}/255  max ${String(r.max).padStart(3)}  pixels>2 ${r.changedPct.toFixed(2)}%`);
  // save ablation renders for eyeballing
  for (const [name, re] of fams) {
    await page.evaluate(({ re }) => {
      const K = window.__K;
      const rx = new RegExp(re.slice(1, re.lastIndexOf('/')));
      window.__abHidden = [];
      K.scene.traverse((o) => { if (o.visible && rx.test(o.name || '')) { window.__abHidden.push(o); o.visible = false; } });
      K.shot();
    }, { re });
    await page.screenshot({ path: `${shotDir}/ablate_${name.replace(/[^a-z]/gi, '_')}.png` });
    await page.evaluate(() => { for (const o of window.__abHidden) o.visible = true; window.__K.shot(); });
  }
  await page.evaluate(() => window.__K.shot());
  await page.screenshot({ path: `${shotDir}/ablate_full.png` });
  console.log(`shots -> ${shotDir}/`);
} else if (mode === 'sweep') {
  const G = grid ?? [{ az: 38.08 }, { az: 30 }, { az: 22 }, { az: 14 }, { az: 6 }, { az: -4 }];
  console.log('\n=== KEY AZIMUTH SWEEP (elev 30, dist 19.65) ===');
  for (const gspec of G) {
    await page.evaluate(({ az, elev, dist }) => window.__K.setKey(az, elev ?? 30, dist ?? 19.645),
      { az: gspec.az, elev: gspec.elev, dist: gspec.dist });
    const r = await battery(`az${gspec.az}`);
    const tagf = String(gspec.az).replace('.', 'p').replace('-', 'm');
    await writeFile(`${shotDir}/shadowmask_${tagf}.png`, Buffer.from(r.shadowPng.split(',')[1], 'base64'));
    delete r.shadowPng;
    results.push(r);
    console.log(row(r));
    await page.evaluate(() => window.__K.shot());
    await page.screenshot({ path: `${shotDir}/az_${String(gspec.az).replace('.', 'p').replace('-', 'm')}.png` });
  }
  await writeFile(`${shotDir}/sweep.json`, JSON.stringify(results, null, 2));
  console.log(`shots + sweep.json -> ${shotDir}/`);
} else {
  const r = await battery(label);
  await writeFile(`${shotDir}/shadowmask.png`, Buffer.from(r.shadowPng.split(',')[1], 'base64'));
  delete r.shadowPng;
  results.push(r);
  console.log('\n=== ACCEPTANCE BATTERY ===');
  console.log(JSON.stringify(r, null, 2));
  console.log(row(r));
  await page.evaluate(() => window.__K.shot());
  await page.screenshot({ path: `${shotDir}/frame.png` });
  await writeFile(`${shotDir}/battery.json`, JSON.stringify(r, null, 2));
  console.log(`-> ${shotDir}/`);
}

await browser.close();
