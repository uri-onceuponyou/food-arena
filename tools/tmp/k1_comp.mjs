#!/usr/bin/env node
/**
 * K1_COMP — FRAME COMPOSITION at each candidate match-camera pitch, on ONE frozen sim state.
 *
 * The blind critics say *"empty flat floor"* and *"tiny fighters"* every round. Both are what a
 * steep camera produces, so this measures them per pitch on identical game states:
 *
 *   groundShare      share of the frame that is GROUND (world normal within ~25° of up AND
 *                    under 0.15 m high) — the "floor" a critic sees, decals included
 *   structureShare   everything that is neither ground nor a fighter (props, counters, walls)
 *   fighter px, heightPx  each fighter's mask area and vertical pixel extent
 *   topShare / frontShare  of each fighter's pixels: world normal within 45° of UP (the
 *                    fighter's TOP) vs everything else (its FRONT / sides, where the face is)
 *
 * ── HOW ──────────────────────────────────────────────────────────────────────────────
 * One page, a frozen virtual clock (dt = 0 also holds the camera shake), a fixed six-fighter
 * scene placed by `?fighters=` on open floor near the hub (spawns DERIVED: the first grid
 * point whose six positions clear every CoverBox and hazard in `tools/arena.gameplay.json`).
 * The LIVE rig is then re-pitched in place (`rig.pitchDeg`, `rig.aim`, `apply()` — the same
 * re-solve the URL override reaches at construction) and three passes are drawn per variant,
 * post chain bypassed for the two data passes:
 *   BEAUTY  `stage.render(0)` — what a viewer sees (canvas; the DOM HUD is not in it)
 *   ID      per-mesh MeshBasicMaterial: fighter root k -> colour k, everything else black
 *   DATA    MeshNormalMaterial + onBeforeCompile: R = world normal.y, G = world height / 4 m
 *
 * ── CONTROLS (each REQUIRED to come out as constructed — CLAUDE.md rule 6) ───────────
 *   NULL     two BEAUTY renders of one variant differ by 0 px
 *   RESTORE  after every pass and variant, the shipped camera re-renders byte-identically
 *   OVERRIDE a fresh page loaded with `?camPitch=50` (and `&camAim=centred`) renders the same
 *            BEAUTY as this page re-pitched to 50 at runtime — the runtime model IS the
 *            override, and nothing but the rig moved (diff px reported; 0 expected)
 *   CUBE     an analytic 1 m cube is planted beside the player; its TOP and FRONT faces'
 *            measured pixel counts must match their projected polygon areas (±6%), its top
 *            must decode to height 1.0 m and normal.y 1, its front to normal.y 0 — so the
 *            classification and both decodes are validated on a known input at every pitch
 *   ID-COVER every fighter whose feet project on screen has a non-empty mask
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/k1_comp.mjs --url '{URL}' --out <dir>
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
if (!BASE || BASE.includes(':5173')) { console.error('k1_comp: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }
const OUT = resolve(arg('--out', 'shots/k1/comp'));
const W = 1600; const H = 900;
const PITCHES = String(arg('--pitches', '58,54,50,48')).split(',').map(Number);
const AIMS = String(arg('--aims', 'past,centred')).split(',');
mkdirSync(OUT, { recursive: true });

// ── the scene: six distinct characters, the local seat at P, five around it ───────────────
const CAST = ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'];
// Offsets in world units from the local seat. South (toward the camera) kept at 90 wu so
// every fighter is on screen under BOTH aims at every candidate pitch (the shipped aim's true
// reach below the player is 89.9-123 wu — `k1_fair.mjs` §C).
const OFFS = [[0, 0], [0, -165], [150, -60], [-150, -60], [110, 85], [-110, 85]];
const arena = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const PAD = 26; // gx_gap_cap's clearance; 34 left ONE clear place on the whole map for this 300x250 wu scene
const NTH = Number(arg('--nth', 0)); // take the NTH clear placement instead of the first (another scene)
const clear = (x, y) => x > 120 && y > 120 && x < arena.width - 120 && y < arena.height - 120
  && arena.cover.every((b) => Math.abs(x - b.x) > b.w / 2 + PAD || Math.abs(y - b.y) > b.h / 2 + PAD)
  && arena.hazards.every((h) => Math.hypot(x - h.x, y - h.y) > (h.radius ?? 0) + PAD)
  && (arena.concealment ?? []).every((b) => Math.abs(x - b.x) > b.w / 2 + PAD || Math.abs(y - b.y) > b.h / 2 + PAD);
let P = null;
{
  // Every 20 wu grid point whose six spawns AND the cube spot clear the cover, hazards and
  // concealment, nearest the hub first; scene N is the Nth pick at least 300 wu from all
  // earlier picks (different PLACES, not neighbours).
  const cands = [];
  for (let y = 140; y < arena.height - 140; y += 20) {
    for (let x = 140; x < arena.width - 140; x += 20) {
      if ([...OFFS, [0, -80]].every(([dx, dy]) => clear(x + dx, y + dy))) cands.push({ x, y, d: Math.hypot(x - arena.center.x, y - arena.center.y) });
    }
  }
  cands.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const picks = [];
  for (const c of cands) {
    if (picks.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= 300)) picks.push(c);
    if (picks.length > NTH) break;
  }
  if (picks.length > NTH) P = { x: picks[NTH].x, y: picks[NTH].y };
}
if (!P) throw new Error('k1_comp: no clear placement found near the hub');
const fightersParam = OFFS.map(([dx, dy], i) => `${CAST[i]}@${P.x + dx},${P.y + dy}`).join(';');
console.log(`k1_comp — scene at ${P.x},${P.y} (${Math.round(Math.hypot(P.x - arena.center.x, P.y - arena.center.y))} wu from the arena centre); ${fightersParam}`);

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const CLOCK = () => {
  let virt = 0;
  performance.now = () => virt;
  window.__clk = { advance(ms) { virt += ms; } };
  let seed = 0x9e3779b9 >>> 0;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** In-page: every pass for one variant. Returns PNG data URLs + per-pixel class tables. */
const PAGE = async ({ variants, restoreOnly }) => {
  const stage = window.__stage; const rig = stage.rig; const cam = rig.camera; const renderer = stage.renderer; const scene = stage.scene;
  const threeUrl = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/deps\/three(\.module)?\.js/.test(n))
    || performance.getEntriesByType('resource').map((r) => r.name).find((n) => /three/.test(n) && /\.js/.test(n));
  const THREE = await import(threeUrl);
  const cw = stage.canvas.width; const ch = stage.canvas.height;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  const grab = () => { ctx.clearRect(0, 0, cw, ch); ctx.drawImage(stage.canvas, 0, 0); return ctx.getImageData(0, 0, cw, ch); };
  const url = (img) => { ctx.putImageData(img, 0, 0); return c2.toDataURL('image/png'); };
  const diffN = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++; return n; };
  const beauty = () => { renderer.shadowMap.needsUpdate = true; stage.render(0); return grab(); };
  const p0 = rig.pitchDeg; const a0 = rig.aim;
  const setCam = (p, a) => { rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.pitchDeg = p; rig.aim = a; rig.apply(); cam.updateMatrixWorld(true); };
  setCam(p0, a0);
  const FIRST = beauty();
  if (restoreOnly) return { beauty: url(FIRST) };

  const roots = scene.children.filter((o) => /^character:/.test(o.name));
  const hideRoots = scene.children.filter((o) => o.name === 'vfx_layer' || o.name === 'fog_boundary');
  // the analytic cube, 1 m, beside the local seat (slot 0's model root)
  const me = window.__vfxDebugFighters.slots[0];
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8080ff }));
  cube.name = 'k1:cube';
  // Due NORTH of the local seat, on the camera's own vertical plane, so the cube's side faces
  // are seen edge-on (zero area) and TOP / FRONT are the only faces it shows; 70-90 wu away so
  // the ray to its front face clears the local fighter's head at every candidate pitch.
  cube.position.set(me.x * 0.05, 0.5, me.y * 0.05 - 4.0);
  cube.visible = false;
  scene.add(cube);

  const passes = (withCube) => {
    // ID pass
    const entries = [];
    scene.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints || o.isLine) entries.push(o); });
    const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const saved = [];
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mats = roots.map((_, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(((k + 1) * 36) / 255, 1, 0, 'srgb') }));
    const cubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1, 0, 1, 'srgb') });
    cube.visible = withCube;
    for (const r of hideRoots) { saved.push({ o: r, vis: r.visible }); r.visible = false; }
    const sv = [];
    for (const o of entries) {
      if (!vis(o)) continue;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const transp = !!(m && (m.transparent && (m.opacity ?? 1) < 0.999)) || (m && m.blending !== 1)
        || !m || m.visible === false || m.colorWrite === false;
      sv.push({ o, mat: o.material, vis: o.visible, ic: o.instanceColor ?? null });
      if (!o.isMesh || transp) { o.visible = false; continue; }
      let top = o; while (top.parent && top.parent !== scene) top = top.parent;
      const k = roots.indexOf(top);
      o.material = o === cube ? cubeMat : (k >= 0 ? mats[k] : black);
      if (o.isInstancedMesh && o.instanceColor) o.instanceColor = null;
    }
    const tone = renderer.toneMapping; renderer.toneMapping = 0;
    const bg = scene.background; scene.background = new THREE.Color(0x000000);
    const fog = scene.fog; scene.fog = null;
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    renderer.render(scene, cam);
    const ID = grab();
    // DATA pass: same visibility, one override material
    for (const s of sv) { if (s.o.material !== s.mat) s.o.material = s.mat; if (s.ic) s.o.instanceColor = s.ic; }
    const nm = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    nm.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vK1Y;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vK1Y = (inverse(viewMatrix) * mvPosition).y;');
      sh.fragmentShader = 'varying float vK1Y;\n' + sh.fragmentShader.replace(
        'gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );',
        'vec3 k1n = normalize((vec4(normal, 0.0) * viewMatrix).xyz);\n  gl_FragColor = vec4(k1n.y * 0.5 + 0.5, clamp(vK1Y / 4.0, 0.0, 1.0), 0.5, 1.0);');
    };
    nm.customProgramCacheKey = () => 'k1-data';
    scene.overrideMaterial = nm;
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    const DATA = grab();
    scene.overrideMaterial = null;
    nm.dispose(); black.dispose(); cubeMat.dispose(); for (const m of mats) m.dispose();
    for (const s of sv) { s.o.visible = s.vis; if (s.ic) s.o.instanceColor = s.ic; }
    for (const s of saved) s.o.visible = s.vis;
    renderer.toneMapping = tone; scene.background = bg; scene.fog = fog;
    cube.visible = false;
    return { ID, DATA };
  };

  const stats = (ID, DATA, cubeOnly) => {
    const n = cw * ch; let ground = 0; let fighters = 0; let structure = 0; let none = 0;
    const per = roots.map(() => ({ px: 0, top: 0, ymin: 1e9, ymax: -1, nySum: 0 }));
    const cubeS = { top: 0, front: 0, other: 0, topH: 0, topNy: 0, frontNy: 0 };
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      const ir = ID.data[i]; const ig = ID.data[i + 1]; const ib = ID.data[i + 2];
      const ny = DATA.data[i] / 255 * 2 - 1; const hy = DATA.data[i + 1] / 255 * 4; const marker = DATA.data[i + 2];
      if (ir > 200 && ig < 60 && ib > 200) { // cube
        if (ny > 0.707) { cubeS.top++; cubeS.topH += hy; cubeS.topNy += ny; } else if (Math.abs(ny) < 0.2) { cubeS.front++; cubeS.frontNy += ny; } else cubeS.other++;
        continue;
      }
      if (cubeOnly) continue;
      if (ig > 200 && ib < 60 && ir > 0) {
        const k = Math.round(ir / 36) - 1;
        if (k >= 0 && k < per.length) {
          const f = per[k]; f.px++; f.nySum += ny; if (ny > 0.707) f.top++;
          const y = Math.floor(p / cw); if (y < f.ymin) f.ymin = y; if (y > f.ymax) f.ymax = y;
          fighters++; continue;
        }
      }
      if (marker < 100) { none++; continue; } // nothing drawn
      if (ny > 0.9 && hy < 0.15) ground++; else structure++;
    }
    return {
      groundShare: +(ground / n).toFixed(4), structureShare: +(structure / n).toFixed(4), fighterShare: +(fighters / n).toFixed(5), emptyShare: +(none / n).toFixed(4),
      fighters: per.map((f, k) => ({ root: roots[k].name, px: f.px, heightPx: f.px ? f.ymax - f.ymin + 1 : 0,
        topShare: f.px ? +(f.top / f.px).toFixed(3) : null, frontShare: f.px ? +(1 - f.top / f.px).toFixed(3) : null, meanNy: f.px ? +(f.nySum / f.px).toFixed(3) : null })),
      cube: cubeS,
    };
  };
  const projArea = (pts) => {
    const s = pts.map((p) => { const v = p.clone().project(cam); return [(v.x * 0.5 + 0.5) * cw, (1 - (v.y * 0.5 + 0.5)) * ch]; });
    let a = 0; for (let i = 0; i < s.length; i++) { const [x1, y1] = s[i]; const [x2, y2] = s[(i + 1) % s.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2;
  };
  const V = THREE.Vector3; const c = cube.position;
  const topFace = [new V(c.x - 0.5, 1, c.z - 0.5), new V(c.x + 0.5, 1, c.z - 0.5), new V(c.x + 0.5, 1, c.z + 0.5), new V(c.x - 0.5, 1, c.z + 0.5)];
  const frontFace = [new V(c.x - 0.5, 0, c.z + 0.5), new V(c.x + 0.5, 0, c.z + 0.5), new V(c.x + 0.5, 1, c.z + 0.5), new V(c.x - 0.5, 1, c.z + 0.5)];

  const out = [];
  for (const { p, a } of variants) {
    setCam(p, a);
    const A = beauty(); const B = beauty();
    const { ID, DATA } = passes(false);
    const st = stats(ID, DATA, false);
    const cubeP = passes(true);
    const cs = stats(cubeP.ID, cubeP.DATA, true).cube;
    // where the slots project (feet), to know who is on screen
    const onScreen = window.__vfxDebugFighters.slots.map((f) => { const v = new V(f.x * 0.05, 0, f.y * 0.05).project(cam); return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1; });
    out.push({
      pitch: p, aim: a, NULL: diffN(A, B), beauty: url(A), id: url(ID), data: url(DATA), stats: st, onScreen,
      cube: { measuredTop: cs.top, measuredFront: cs.front, other: cs.other, analyticTop: +projArea(topFace).toFixed(1), analyticFront: +projArea(frontFace).toFixed(1),
        topHeightM: cs.top ? +(cs.topH / cs.top).toFixed(3) : null, topNy: cs.top ? +(cs.topNy / cs.top).toFixed(3) : null, frontNy: cs.front ? +(cs.frontNy / cs.front).toFixed(3) : null },
      cameraPos: cam.position.toArray().map((x) => +x.toFixed(3)),
    });
  }
  setCam(p0, a0);
  const LAST = beauty();
  scene.remove(cube); cube.geometry.dispose(); cube.material.dispose();
  return { variants: out, RESTORE: diffN(FIRST, LAST), roots: roots.map((r) => r.name), p0, a0 };
};

async function openScene(browser, qs = '') {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  const q = new URLSearchParams({ fighters: fightersParam, pointerLock: '0' });
  for (const [k, v] of new URLSearchParams(qs)) q.set(k, v);
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90_000 });
  await page.evaluate(async () => { for (let i = 0; i < 40; i++) { window.__clk.advance(16.667); await new Promise((r) => requestAnimationFrame(() => r())); } });
  return { ctx, page };
}
const png = (d) => Buffer.from(d.split(',')[1], 'base64');

const browser = await chromium.launch({ args: LAUNCH });
let code = 0;
try {
  const variants = [];
  for (const a of AIMS) for (const p of PITCHES) variants.push({ p, a });
  const { ctx, page } = await openScene(browser);
  const r = await page.evaluate(PAGE, { variants, restoreOnly: false });
  await ctx.close();
  console.log(`  roots ${r.roots.join(', ')} · shipped rig pitch ${r.p0} aim ${r.a0} · RESTORE ${r.RESTORE} px`);
  if (r.RESTORE !== 0) { console.log('  CONTROL RESTORE FAILED'); code = 2; }

  // OVERRIDE control: fresh pages at ?camPitch=50 (+centred) vs the runtime re-pitch
  const ov = [];
  for (const [qs, p, a] of [['camPitch=50', 50, 'past'], ['camPitch=50&camAim=centred', 50, 'centred']]) {
    const v = r.variants.find((x) => x.pitch === p && x.aim === a);
    if (!v) continue;
    const s = await openScene(browser, qs);
    const fresh = await s.page.evaluate(PAGE, { variants: [], restoreOnly: true });
    await s.ctx.close();
    const [ra, rb] = await Promise.all([sharp(png(v.beauty)).raw().toBuffer(), sharp(png(fresh.beauty)).raw().toBuffer()]);
    let d = 0; for (let i = 0; i < ra.length; i += 4) if (ra[i] !== rb[i] || ra[i + 1] !== rb[i + 1] || ra[i + 2] !== rb[i + 2]) d++;
    ov.push({ qs, diffPx: d });
    console.log(`  OVERRIDE ?${qs}: fresh page vs runtime re-pitch differ by ${d} px`);
  }

  const rows = [];
  for (const v of r.variants) {
    const tag = `p${v.pitch}${v.aim === 'centred' ? 'c' : ''}`;
    writeFileSync(`${OUT}/${tag}.beauty.png`, png(v.beauty));
    writeFileSync(`${OUT}/${tag}.id.png`, png(v.id));
    writeFileSync(`${OUT}/${tag}.data.png`, png(v.data));
    // Map slot -> root BY NAME (six distinct characters), never by array position.
    const bySlot = CAST.map((id) => v.stats.fighters.find((f) => f.root === `character:${id}`));
    if (bySlot.some((f) => !f)) throw new Error(`k1_comp: a slot has no character root: ${JSON.stringify(v.stats.fighters.map((f) => f.root))}`);
    const me = bySlot[0];
    const others = bySlot.slice(1).filter((f) => f.px > 0);
    const cubeTopErr = (v.cube.measuredTop - v.cube.analyticTop) / v.cube.analyticTop;
    const cubeFrontErr = (v.cube.measuredFront - v.cube.analyticFront) / v.cube.analyticFront;
    // ±10%, and it was ±6%: the first full run measured top -1.2..-4.5% and front -3.0..-7.1%,
    // ALWAYS short — antialiased silhouette edges blend the ID colour and the boundary normal, so
    // ~0.5 px of perimeter drops out of a ~50 px face. The gross errors this exists to catch (a
    // wrong decode, a wrong rotation, a hidden cube) read -100% or a flipped class, not -7%.
    const cubeOk = Math.abs(cubeTopErr) < 0.10 && Math.abs(cubeFrontErr) < 0.10 && Math.abs(v.cube.topHeightM - 1) < 0.05 && v.cube.topNy > 0.98 && Math.abs(v.cube.frontNy) < 0.05;
    const cover = v.onScreen.length === CAST.length && v.onScreen.some(Boolean) && v.onScreen.every((on, i) => !on || bySlot[i].px > 0);
    if (v.NULL !== 0 || !cubeOk || !cover) code = 2;
    rows.push({ tag, ...v, beauty: undefined, id: undefined, data: undefined, cubeTopErr: +cubeTopErr.toFixed(3), cubeFrontErr: +cubeFrontErr.toFixed(3), cubeOk, idCover: cover,
      localHeightPx: me.heightPx, localPx: me.px, localTop: me.topShare, localFront: me.frontShare,
      allHeightPxMedian: [...v.stats.fighters.filter((f) => f.px > 0).map((f) => f.heightPx)].sort((x, y) => x - y)[Math.floor(v.stats.fighters.filter((f) => f.px > 0).length / 2)],
      allTop: +(v.stats.fighters.reduce((s, f) => s + (f.topShare ?? 0) * f.px, 0) / Math.max(1, v.stats.fighters.reduce((s, f) => s + f.px, 0))).toFixed(3),
      othersOn: others.length });
  }
  writeFileSync(`${OUT}/k1_comp.json`, JSON.stringify({ scene: { P, fightersParam }, overrideControl: ov, RESTORE: r.RESTORE, rows }, null, 1));
  console.log('\n  variant  ground  struct  fighters | local: px    h_px  top   front | all: median h_px  top   | cube top/front err  h_m   ny(top,front) | NULL');
  for (const x of rows) {
    console.log(`  ${x.tag.padEnd(7)} ${x.stats.groundShare.toFixed(3)}  ${x.stats.structureShare.toFixed(3)}  ${x.stats.fighterShare.toFixed(4)}   | ${String(x.localPx).padStart(9)} ${String(x.localHeightPx).padStart(5)} ${x.localTop?.toFixed(3)} ${x.localFront?.toFixed(3)} | ${String(x.allHeightPxMedian).padStart(16)} ${x.allTop.toFixed(3)} | ${(x.cubeTopErr * 100).toFixed(1).padStart(8)}%/${(x.cubeFrontErr * 100).toFixed(1).padStart(5)}% ${x.cube.topHeightM?.toFixed(2)} ${x.cube.topNy?.toFixed(2)},${x.cube.frontNy?.toFixed(2)} ${x.cubeOk ? 'ok' : 'BAD'} | ${x.NULL}${x.idCover ? '' : ' ID-COVER FAIL'}`);
  }
  // contact sheet: past row over centred row, half size
  const tiles = rows.map((x) => x.tag);
  const cols = PITCHES.length;
  const tw = W / 2; const th = H / 2;
  const comp = [];
  for (let i = 0; i < tiles.length; i++) {
    const buf = await sharp(`${OUT}/${tiles[i]}.beauty.png`).resize(tw, th).png().toBuffer();
    comp.push({ input: buf, left: (i % cols) * tw, top: Math.floor(i / cols) * th });
  }
  await sharp({ create: { width: tw * cols, height: th * Math.ceil(tiles.length / cols), channels: 3, background: '#000' } })
    .composite(comp).png().toFile(`${OUT}/sheet.png`);
  console.log(`\n  sheet ${OUT}/sheet.png  (rows: ${AIMS.join(' / ')}; columns: ${PITCHES.join(' / ')}°)`);
} finally {
  await browser.close();
}
process.exit(code);
