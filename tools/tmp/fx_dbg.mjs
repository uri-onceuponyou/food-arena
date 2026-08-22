#!/usr/bin/env node
/**
 * FX_DBG — dump every VISIBLE object in the VFX layer after firing one impact.
 *
 * Written for one question `fx_flat` could not answer: `impact.egg.Shards` washed the
 * top half of the frame white and the mask went **1,275 -> 18 px** (base and effect
 * frames both washed, so the diff vanished). A metric sheet says a case broke; it
 * cannot say WHICH object is doing it. This prints name, world scale, position,
 * material opacity and blending for everything drawn, sorted by on-screen area.
 *
 * Not a gate and not a control — a lamp. Kept because the next whole-frame wash will
 * be diagnosed the same way.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/fx_dbg.mjs --url '{URL}' --cid egg --key Shards
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '');
if (!BASE) { console.error('fx_dbg: --url or PREVIEW_BASE required'); process.exit(2); }
const CID = String(args.cid ?? 'egg');
const KEY = String(args.key ?? 'Shards');
const SLICE = Number(args.slice ?? 160);
const SEED = Number(args.seed ?? 777);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; const base = realNow();
    window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
    performance.now = () => (paused ? virt : realNow() - base);
    let st = 1;
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = { seed(v) { st = ((v >>> 0) || 1); } };
  });
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
  await page.waitForFunction(() => !!window.__vfxLayer && !!window.__vfxDebugFighters, null, { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__clk.pause());
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });

  const out = await page.evaluate(async ([cid, key, slice, seed]) => {
    const rules = await import('/src/game/rules.ts');
    const vfxMod = await import('/src/game/vfx.ts');
    const weapon = rules.CHARACTERS[cid].weapons.find((w) => w.key === key);
    if (!weapon) return { err: `no weapon ${cid}.${key}` };
    const layer = window.__vfxLayer;
    const fi = window.__vfxDebugFighters;
    // `fx_flat`'s EXACT sequence, not a paraphrase of it: an empty `sync()` (its own
    // header records that `clear()` alone is not a reset), a zero-length tick, then the
    // spawn, then the slice. A probe that reproduces a different sequence answers a
    // different question, which is how the first version of this file came back clean
    // on a case that was washing the frame in the real harness.
    const mk = (role) => ({
      characterId: role === 'player' ? 'hamburger' : 'donut',
      x: fi[role].x, y: fi[role].y, hp: 100, maxHp: 100, alive: true,
      facing: { x: 1, y: 0 }, terrainSlowFactor: 1,
      status: { slowedUntil: 0, stunnedUntil: 0 },
    });
    layer.clear();
    layer.sync({ elapsed: 0, projectiles: [], splats: [], trailMarks: [], player: mk('player'), enemy: mk('enemy') });
    layer.updateEffects(0);
    window.__rng.seed(seed);
    layer.spawnImpactBurst(fi.player.x, fi.player.y, weapon.color, weapon.damage,
      { weapon, characterId: cid, fromXWU: fi.player.x - 60, fromYWU: fi.player.y });
    layer.updateEffects(slice / 1000);
    window.__stage.render(0);
    const rows = [];
    const big = [];
    window.__stage.scene.traverse((o) => {
      if (!o.visible) return;
      if (!o.isMesh && !o.isSprite) return;
      const sc = Math.max(Math.abs(o.scale.x), Math.abs(o.scale.y), Math.abs(o.scale.z));
      if (!Number.isFinite(sc) || sc > 3) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        big.push({
          name: o.name || (o.isSprite ? '(sprite)' : '(mesh)'),
          parent: o.parent ? (o.parent.name || '(anon)') : null,
          scale: [o.scale.x, o.scale.y, o.scale.z],
          pos: [o.position.x, o.position.y, o.position.z].map((v) => Number(v.toFixed(2))),
          opacity: m ? m.opacity : null, blending: m ? m.blending : null,
        });
      }
    });
    // The layer group is reached off the scene by NAME — `vfx.ts` sets
    // `group.name = 'vfx_layer'` — because the field itself is private.
    const grp = window.__stage.scene.getObjectByName('vfx_layer');
    if (!grp) return { err: 'no vfx_layer group in the scene' };
    grp.traverse((o) => {
      if (!o.visible) return;
      const isMesh = !!o.isMesh; const isSprite = !!o.isSprite;
      if (!isMesh && !isSprite) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      rows.push({
        name: o.name || (isSprite ? '(sprite)' : '(mesh)'),
        kind: isSprite ? 'sprite' : 'mesh',
        scale: [o.scale.x, o.scale.y, o.scale.z].map((v) => Number(v.toFixed(3))),
        pos: [o.position.x, o.position.y, o.position.z].map((v) => Number(v.toFixed(2))),
        opacity: m ? Number((m.opacity ?? 1).toFixed(4)) : null,
        blending: m ? m.blending : null,
        transparent: m ? !!m.transparent : null,
      });
    });
    return {
      rows,
      big,
      union: vfxMod.FX_UNION_STATS ? { ...vfxMod.FX_UNION_STATS } : null,
    };
  }, [CID, KEY, SLICE, SEED]);

  if (out.err) { console.error('fx_dbg:', out.err); process.exit(1); }
  console.log(`\nFX_UNION_STATS: ${JSON.stringify(out.union)}`);
  console.log(`\nSCENE-WIDE objects with max|scale| > 3 or non-finite (${out.big.length}):`);
  for (const b of out.big) console.log('  ' + JSON.stringify(b));
  console.log(`\n${out.rows.length} VISIBLE objects in vfx_layer after ${CID}.${KEY} + ${SLICE}ms\n`);
  const byScale = [...out.rows].sort((a, b) => Math.max(...b.scale) - Math.max(...a.scale));
  for (const r of byScale.slice(0, 25)) {
    console.log(`${String(r.name).padEnd(20)} ${r.kind.padEnd(6)} scale ${JSON.stringify(r.scale).padEnd(28)} pos ${JSON.stringify(r.pos).padEnd(26)} op ${String(r.opacity).padEnd(8)} blend ${r.blending}`);
  }
} finally {
  await browser.close();
}
