#!/usr/bin/env node
/**
 * WV_PROJDBG — why do some projectile rows come out at EXACTLY 1.00?
 *
 * `wv_area.mjs --beats projectile` reported `taco.Double`, `pizza.Dough` and
 * `pizza.Tomato` at shipped == generic TO THE PIXEL (1214/1214, 1216/1216, 1215/1215)
 * while carrying a `projectile()` hook. Two measurements of two different sculpts do
 * not agree to the pixel; that is the signature of THE SAME OBJECT being drawn twice,
 * and a row that reads "1.00 — fine" while the bespoke path is not running at all is
 * the worst possible failure of a matrix whose whole job is to find effects that are
 * authored and not delivered.
 *
 * So this does not measure pixels. It asks the SCENE GRAPH what was actually built:
 * the object's name, its child count, its geometry types, and whether
 * `userData.weaponVfx` — which `vfx.ts` stamps ONLY inside the bespoke branch — is
 * present. That flag is the ground truth for "which branch ran", and no pixel count
 * can substitute for it.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wv -- node tools/tmp/wv_projdbg.mjs --url '{URL}'
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const log = (...a) => console.log(...a);

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
    page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
    }));
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__vfxDebugFighters, null, { timeout: 120000 });
    await page.waitForTimeout(1200);

    const out = await page.evaluate(async () => {
      const rules = await import('/src/game/rules.ts');
      const reg = await import('/src/vfx/weapons/index.ts');
      const L = window.__vfxLayer;
      const f = window.__vfxDebugFighters.player;
      const rows = [];
      for (const [id, c] of Object.entries(rules.CHARACTERS)) {
        for (const w of c.weapons) {
          if (w.type !== 'ranged') continue;
          const v = reg.getWeaponVfx(id, w.key);
          const hasHook = !!(v && typeof v.projectile === 'function');
          const mk = (cid, x, y) => ({
            characterId: cid, x, y, hp: 100, maxHp: 100, alive: true,
            facing: { x: 1, y: 0 }, terrainSlowFactor: 1, status: { slowedUntil: 0, stunnedUntil: 0 },
          });
          const player = mk(id, f.x, f.y);
          const enemy = mk('donut', f.x + 200, f.y);
          const st = (ps) => ({ elapsed: 1000, projectiles: ps, splats: [], trailMarks: [], player, enemy, fighters: [player, enemy] });
          L.sync(st([]));
          const p = {
            id: 991, ownerId: 0, targetId: 1, ownerRole: 'player', targetRole: 'enemy',
            weapon: w, x: f.x + 40, y: f.y, vx: (w.speed ?? 100), vy: 0,
            traveled: 40, damage: w.damage, color: w.color, emoji: w.emoji ?? '',
          };
          let err = null;
          try { L.sync(st([p])); } catch (e) { err = String(e && e.message ? e.message : e); }
          const info = [];
          L.group.traverse((o) => {
            if (!String(o.name).startsWith('projectile:')) return;
            const geos = new Set(); let meshes = 0; let sprites = 0;
            o.traverse((c) => { if (c.isMesh) { meshes++; if (c.geometry) geos.add(c.geometry.type); } if (c.isSprite) sprites++; });
            const bb = new (window.__stage.scene.constructor.prototype.constructor ? Object : Object)();
            void bb;
            info.push({
              name: o.name, type: o.type,
              // 🚨 THE GROUND TRUTH. `vfx.ts` stamps `userData.weaponVfx` ONLY inside
              // the bespoke branch of `syncPool`'s create callback, so this — not a
              // pixel count — says which branch ran.
              bespokeStamp: !!o.userData.weaponVfx,
              hasShellSpec: !!o.userData.shellSpec,
              shellScale: o.userData.shellSpec ? +Number(o.userData.shellSpec.scale).toFixed(3) : null,
              children: o.children.length, meshes, sprites, geos: [...geos].join('+'),
            });
          });
          rows.push({ id, key: w.key, hasHook, err, objs: info });
          L.sync(st([]));
          L.clear();
        }
      }
      return rows;
    });

    log(`${'weapon'.padEnd(22)} ${'hook'.padEnd(5)} ${'bespokeStamp'.padEnd(13)} ${'shellScale'.padStart(10)} ${'meshes'.padStart(7)} ${'sprites'.padStart(8)}  geometry`);
    log('─'.repeat(110));
    let mismatch = 0;
    for (const r of out) {
      const o = r.objs[0];
      if (!o) { log(`${`${r.id}.${r.key}`.padEnd(22)} ${String(r.hasHook).padEnd(5)}  ⚠️ NO PROJECTILE OBJECT IN THE POOL${r.err ? ` — threw: ${r.err}` : ''}`); mismatch++; continue; }
      const bad = r.hasHook !== o.bespokeStamp;
      if (bad) mismatch++;
      log(`${`${r.id}.${r.key}`.padEnd(22)} ${String(r.hasHook).padEnd(5)} ${String(o.bespokeStamp).padEnd(13)} ${String(o.shellScale).padStart(10)} ${String(o.meshes).padStart(7)} ${String(o.sprites).padStart(8)}  ${o.geos}${bad ? '   🔴 HOOK PRESENT BUT THE BESPOKE BRANCH DID NOT RUN' : ''}${r.err ? `  threw: ${r.err}` : ''}`);
    }
    log(`\n${mismatch} row(s) where "has a projectile() hook" and "the bespoke branch ran" DISAGREE.`);
    log(`(this is the check a pixel count cannot make: two sculpts can measure the same,`);
    log(` but only one branch can have stamped userData.weaponVfx)`);
    if (mismatch) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main();
