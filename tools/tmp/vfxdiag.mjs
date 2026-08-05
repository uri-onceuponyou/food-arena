#!/usr/bin/env node
/**
 * THROWAWAY diagnostic for soup/pizza weapon VFX.
 *
 * Fires one hook into the live game's vfx layer on a clock we own, then dumps —
 * per spawned mesh — world position, world scale, material opacity/colour, and
 * projected screen position. This answers "is it rendering but invisible" with a
 * number instead of a guess.
 *
 *   node tools/tmp/vfxdiag.mjs --char soup --weapon Dump --hook impact --t 0.30
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = 'http://localhost:5173';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const a = parseArgs(process.argv);
const CHAR = a.char ?? 'soup';
const WEAPON = a.weapon ?? 'Dump';
const HOOK = a.hook ?? 'impact';
const TS = String(a.t ?? '0.02,0.10,0.30').split(',').map(Number);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1300, height: 730 } });
page.setDefaultTimeout(60000);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
}));
await page.goto(`${BASE}/?simSpeed=0.0001&player=${CHAR}&enemy=donut`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 40000 });
await page.waitForFunction(() => !!window.__vfxDebugFighters?.player, null, { timeout: 40000 });
await page.waitForTimeout(600);
// The pre-match countdown is a FULL-SCREEN DOM overlay ('.hud-countdown') that never
// clears at simSpeed=0.0001 — every probe shot in this project taken that way has a
// giant "5" composited over the player. Hide it for judgement frames.
if (a.hidecd) await page.addStyleTag({ content: '.hud-countdown{display:none !important}' });
await page.evaluate(() => {
  if (!window.__origRAF) window.__origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__pendingRAF = cb; return 0; };
});

const install = async ([char, weaponKey, hook, garish, offset, at, cam, warm]) => {
  const mod = await import(`/src/vfx/weapons/${char}.ts`);
  const rules = await import('/src/game/rules.ts');
  const map = mod[`${char}WeaponVfx`];
  const stage = window.__stage;
  let layer = null;
  stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
  const camera = stage.rig.camera;
  const V3 = stage.scene.position.constructor;
  const weapon = rules.CHARACTERS[char].weapons.find((w) => w.key === weaponKey);
  const f = window.__vfxDebugFighters.player;
  const M = 0.05;
  if (cam) { stage.rig.snapTo(cam[0], cam[1]); stage.rig.apply?.(); }
  const items = [];
  const ctx = {
    THREE: null,
    position: at
      ? new V3(at[0], hook === 'impact' ? 1.15 : 1.25, at[1])
      : new V3(f.x * M + offset, hook === 'impact' ? 1.15 : 1.25, f.y * M),
    direction: new V3(1, 0, 0),
    color: weapon.color, damage: weapon.damage, weapon, characterId: char,
    spawnTransient: (obj, life, onUpdate) => {
      if (garish) obj.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.material.color.set('#FF00FF');
        o.material.opacity = 1; o.material.transparent = false; o.material.depthTest = false;
        o.material.blending = 0; // NoBlending
        o.renderOrder = 999;
      });
      layer.add(obj);
      items.push({ obj, life: Math.max(0.001, life), onUpdate, garish });
    },
  };
  // `warm`: fire the hook N times and run each to completion FIRST. Pooled materials
  // are handed out round-robin, so this is what a real match looks like a second in —
  // and it is the only way to catch an effect that reads its start opacity off a
  // pooled material a previous user already faded to zero.
  for (let w = 0; w < warm; w++) {
    const spent = [];
    const warmCtx = Object.assign({}, ctx, {
      spawnTransient: (obj, life, onUpdate) => { spent.push({ obj, life: Math.max(0.001, life), onUpdate }); },
    });
    map[weaponKey][hook](warmCtx);
    for (let s = 0; s <= 20; s++) for (const it of spent) { const t = (s / 20) * it.life * 0.999; it.onUpdate?.(t / it.life, t); }
  }
  map[weaponKey][hook](ctx);

  window.__diag = {
    items, layer, camera, V3,
    step(t) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (t > it.life) { layer.remove(it.obj); items.splice(i, 1); continue; }
        it.onUpdate?.(t / it.life, t);
        if (it.garish) it.obj.traverse((o) => {
          if (!o.isMesh) return;
          o.material.opacity = 1; o.material.transparent = false; o.material.depthTest = false;
        });
      }
      window.__stage.render(0);
      const rows = [];
      for (const it of items) {
        it.obj.updateMatrixWorld(true);
        it.obj.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          const s = o.getWorldScale(new V3());
          const p = o.getWorldPosition(new V3());
          const proj = p.clone().project(camera);
          rows.push({
            geo: o.geometry.type,
            span: +Math.max((b.max.x - b.min.x) * s.x, (b.max.z - b.min.z) * s.z, (b.max.y - b.min.y) * s.y).toFixed(2),
            y: +p.y.toFixed(2),
            op: +(o.material.opacity ?? 1).toFixed(3),
            col: '#' + o.material.color.getHexString(),
            vis: o.visible,
            sx: Math.round((proj.x * 0.5 + 0.5) * 1300),
            sy: Math.round((-proj.y * 0.5 + 0.5) * 730),
          });
        });
      }
      return { live: items.length, rows };
    },
  };
  return items.length;
};

const pair = (s) => (s ? String(s).split(',').map(Number) : null);
const spawned = await page.evaluate(install, [CHAR, WEAPON, HOOK, !!a.garish, Number(a.offset ?? 0), pair(a.at), pair(a.cam), Number(a.warm ?? 0)]);
console.log(`${CHAR}.${WEAPON}.${HOOK}: spawned ${spawned} transients${a.garish ? ' (GARISH)' : ''}`);
const tag = a.garish ? 'garish' : 'plain';
for (const t of TS) {
  const fr = await page.evaluate((tt) => window.__diag.step(tt), t);
  await page.screenshot({ path: `${a.out ?? 'shots/vfxdiag'}/${CHAR}_${WEAPON}_${HOOK}_${tag}_t${String(t).replace('.', '')}.png` });
  console.log(`\n t=${t}  live=${fr.live}  meshes=${fr.rows.length}`);
  for (const r of fr.rows) {
    console.log(`   ${r.geo.padEnd(16)} span=${String(r.span).padStart(5)}m y=${String(r.y).padStart(5)} op=${String(r.op).padStart(5)} ${r.col} vis=${r.vis} screen=${r.sx},${r.sy}`);
  }
}
await browser.close();
