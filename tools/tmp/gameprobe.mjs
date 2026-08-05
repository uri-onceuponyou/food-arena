#!/usr/bin/env node
/**
 * Live-game diagnostic: drives input, waits on a VFX condition, then reports
 * fighter positions vs the camera's guaranteed view window, and measures the
 * on-screen size of whatever the VFX layer currently has active.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
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
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const player = args.player ?? 'pizza';
const enemy = args.enemy ?? 'donut';
const weapon = String(args.weapon ?? 1);
const w = Number(args.w ?? 1300), h = Number(args.h ?? 730);
const waitFor = args.waitFor ?? 'impact';
const simSpeed = args.simSpeed ?? 1;

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await page.goto(`${BASE}/?simSpeed=${simSpeed}&player=${player}&enemy=${enemy}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });

    // Sample the geometry every frame from load, so we catch the WORST case, not
    // just the moment we happened to screenshot.
    await page.evaluate(() => {
      window.__probeLog = [];
      const tick = () => {
        const f = window.__vfxDebugFighters;
        const v = window.__fairView?.();
        if (f && v) window.__probeLog.push({ t: performance.now(), f: JSON.parse(JSON.stringify(f)), v: JSON.parse(JSON.stringify(v)) });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.keyboard.down(weapon); await page.keyboard.up(weapon);
    await page.mouse.move(w * 0.62, h * 0.42);
    await page.mouse.down();
    await page.keyboard.down('KeyD'); await page.keyboard.down('KeyW');
    await page.waitForFunction((key) => {
      const c = window.__vfxQaCounts; if (!c) return false;
      return key === 'any' ? (c.meleeArc + c.impact + c.cast) > 0 : (c[key] ?? 0) > 0;
    }, waitFor, { timeout: 90000, polling: 50 });
    await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
    await page.waitForTimeout(Number(args.settleMs ?? 400));

    const vfxDump = await page.evaluate(() => {
      const stage = window.__stage; if (!stage) return 'no __stage';
      stage.scene.updateMatrixWorld(true);
      const rows = [];
      const cam = stage.rig?.camera;
      stage.scene.traverse((o) => {
        if (!o.visible) return;
        const isSprite = o.isSprite, isMesh = o.isMesh;
        if (!isSprite && !isMesh) return;
        const nm = o.name || '(anon)';
        // Only VFX-ish: unnamed pooled objects, or things parented outside arena/characters
        let chain = []; let q = o.parent; while (q) { if (q.name) chain.push(q.name); q = q.parent; }
        if (chain.some((c) => /arena|cover|kitchen/.test(c))) return;
        const m = o.material;
        if (!m || (!m.transparent && !o.isSprite)) return;
        if ((m.opacity ?? 1) < 0.02) return;
        const wsc = new (o.scale.constructor)(); o.getWorldScale(wsc);
        rows.push({
          name: nm, type: o.type,
          world: [+o.matrixWorld.elements[12].toFixed(2), +o.matrixWorld.elements[13].toFixed(2), +o.matrixWorld.elements[14].toFixed(2)],
          worldScale: [+wsc.x.toFixed(2), +wsc.y.toFixed(2)],
          color: m.color ? '#' + m.color.getHexString() : null,
          opacity: +(m.opacity ?? 1).toFixed(2),
          blending: m.blending, depthWrite: m.depthWrite,
          geo: o.geometry?.type,
          parent: chain.join('<'),
        });
      });
      return rows;
    });
    console.log('=== ACTIVE VFX-ish OBJECTS ===');
    for (const r of vfxDump) {
      if (r.parent !== 'vfx_layer') continue;
      console.log(' ', String(r.type).padEnd(7), String(r.geo).padEnd(16), String(r.color || '').padEnd(9),
        'op=' + String(r.opacity).padEnd(5), 'wscale=' + r.worldScale.join('x'), 'blend=' + r.blending,
        'dw=' + r.depthWrite, 'pos=' + r.world.join(','));
    }
    console.log('  (vfx_layer objects:', vfxDump.filter((r) => r.parent === 'vfx_layer').length, ')');

    const report = await page.evaluate(() => {
      const log = window.__probeLog ?? [];
      const last = log[log.length - 1];
      // Guaranteed-visible geometry
      const v = window.__fairView?.();
      const f = window.__vfxDebugFighters;
      // How often was the enemy outside the visible ground window?
      let offscreen = 0, total = 0, worst = null;
      for (const s of log) {
        const p = s.f.player, e = s.f.enemy;
        if (!p || !e) continue;
        total++;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        const R = s.v.guaranteedRadiusUnits ?? s.v.halfWidthAtFairEdgeUnits ?? 0;
        if (d > R) { offscreen++; if (!worst || d > worst.d) worst = { d: +d.toFixed(1), R: +R.toFixed(1) }; }
      }
      return { fairView: v, fighters: f, samples: total, enemyBeyondGuaranteedRadius: offscreen, worst, qa: window.__vfxQaCounts };
    });
    console.log(JSON.stringify(report, null, 1));

    if (args.out) {
      await mkdir(args.out.replace(/\/[^/]+$/, ''), { recursive: true });
      await page.screenshot({ path: args.out });
      console.log('shot ->', args.out);
    }
    await page.mouse.up();
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
