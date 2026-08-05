#!/usr/bin/env node
/**
 * WHAT DOES A DEPTH-WRITING SPLAT DESTROY? — an exact same-frame A/B.
 *
 * `render/toon.ts`'s `flatMat` exposes `transparent`/`opacity`/`doubleSide` and never
 * touches `depthWrite`, so three's default of `true` survives. `game/vfx.ts` built its
 * splat and both trail-mark materials through it, which made every splat and every
 * sticky-trail mark in the game a transparent plane that writes the depth buffer —
 * the silent-occluder trap `docs/LESSONS.md` §1 names, sitting inside the subsystem
 * that supplied most of that list.
 *
 * A material census cannot find it: `syncPool` only creates these meshes while the sim
 * holds live splats/trail marks, so a scene walk on a fresh match honestly reports
 * zero transparent-and-depth-writing objects in the VFX layer.
 *
 * So this drives them in through a synthetic `MatchState`, then flips `depthWrite`
 * back to `true` on those exact materials and re-renders the SAME frame. Every changed
 * pixel is a pixel the bug was deleting. Nothing else in the frame moves, the clock is
 * frozen, and both halves come from one page — there is no A/B to contaminate.
 *
 *   node tools/tmp/vfx_splatdepth.mjs --url <snapshot-url>
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = args.out ?? 'shots/vfx/splatdepth';
const W = 1600, H = 900, RW = 800, RH = 450;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false, virt = 0, base = realNow();
    window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
    performance.now = () => (paused ? virt : realNow() - base);
  });
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
  await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.hud-countdown{display:none !important}' });
  await page.evaluate(() => window.__clk.pause());
  await page.waitForTimeout(400);

  const r = await page.evaluate(([rw, rh]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas'); cv.width = rw; cv.height = rh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => { stage.render(0); ctx.clearRect(0, 0, rw, rh); ctx.drawImage(stage.canvas, 0, 0, rw, rh); return ctx.getImageData(0, 0, rw, rh).data; };
    const diff = (a, b) => {
      let n = 0, sum = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d >= 6) { n++; sum += d; }
      }
      return { n, meanDelta: n ? +(sum / n).toFixed(1) : 0 };
    };

    const f = window.__vfxDebugFighters;
    const mk = (role) => ({
      characterId: role === 'player' ? 'hamburger' : 'donut',
      x: f[role].x, y: f[role].y, hp: 100, maxHp: 100, alive: true,
      facing: { x: 1, y: 0 }, terrainSlowFactor: 1, status: { slowedUntil: 0, stunnedUntil: 0 },
    });
    const empty = { elapsed: 1000, projectiles: [], splats: [], trailMarks: [], player: mk('player'), enemy: mk('enemy') };

    // Clean frame first — the reference every count below is taken against.
    window.__vfxLayer.clear();
    window.__vfxLayer.sync(empty);
    const clean = Uint8ClampedArray.from(grab());

    // A realistic late-match litter of marks around the fighter: Donut's trail is
    // continuous and splats accumulate wherever projectiles die.
    const splats = [], trails = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      splats.push({ id: 100 + i, x: f.player.x + Math.cos(a) * 34, y: f.player.y + Math.sin(a) * 34 });
      trails.push({ id: 200 + i, x: f.player.x + Math.cos(a + 0.4) * 58, y: f.player.y + Math.sin(a + 0.4) * 58, ownerRole: 'player' });
    }
    const st = { ...empty, splats, trailMarks: trails };
    window.__vfxLayer.sync(st);
    const shipped = Uint8ClampedArray.from(grab());

    // Now flip depthWrite back ON for exactly the splat/trail meshes and re-render.
    let layer = null;
    stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
    const touched = [];
    layer.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.transparent) return;
      if (o.material.depthWrite !== false) return;
      // Only the pooled splat/trail materials — the particle/ring/wedge pools are
      // Sprites and MeshBasicMaterials that were always depthWrite:false by hand.
      if (o.geometry?.type !== 'CircleGeometry') return;
      touched.push(o.material);
    });
    const uniq = [...new Set(touched)];
    for (const m of uniq) m.depthWrite = true;
    const buggy = grab();
    for (const m of uniq) m.depthWrite = false;

    const marksDrawn = diff(clean, shipped);
    const damage = diff(shipped, buggy);
    window.__vfxLayer.clear();
    window.__vfxLayer.sync(empty);
    return {
      splatMeshes: splats.length, trailMeshes: trails.length, materialsFlipped: uniq.length,
      marksDrawn, damage,
    };
  }, [RW, RH]);

  console.log(`\n${r.splatMeshes} splats + ${r.trailMeshes} trail marks synced; ${r.materialsFlipped} pooled materials flipped\n`);
  console.log(`  marks deliver                 ${String(r.marksDrawn.n).padStart(6)} px  (meanΔ ${r.marksDrawn.meanDelta})`);
  console.log(`  pixels DESTROYED by depthWrite ${String(r.damage.n).padStart(6)} px  (meanΔ ${r.damage.meanDelta})`);
  const pct = r.marksDrawn.n ? (r.damage.n / r.marksDrawn.n * 100).toFixed(1) : '0';
  console.log(`\n  => the bug wiped ${pct}% as many pixels as the marks themselves draw.`);
  console.log('     Non-zero means transparent-and-depth-writing was really occluding; 0 would mean it never mattered.');
} finally {
  await browser.close();
}
