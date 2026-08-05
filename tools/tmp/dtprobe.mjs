#!/usr/bin/env node
/**
 * THROWAWAY probe for `src/vfx/weapons/donut.ts` and `taco.ts`.
 *
 * `window.__vfxSpawnTest` only reaches the GENERIC burst (it calls `spawnImpactBurst`
 * with no `source`, so the bespoke registry is never consulted), and driving a
 * specific hit through gameplay is unreliable — the AI kites. So this imports the
 * weapon module directly in the page, replicates `VfxLayer.spawnTransientObject`
 * exactly (add to the `vfx_layer` group; drive `onUpdate(progress, elapsed)`; remove
 * at end of life), and steps it on a CLOCK WE OWN.
 *
 *   node tools/tmp/dtprobe.mjs --char donut --weapon Candy --hook impact \
 *      --t 0.02,0.10,0.24 --out shots/x [--on enemy|player] [--garish] [--warm 3]
 *      [--scale N] [--flight] [--pellets 3]
 *
 * --on enemy  : fire ON THE ENEMY and snap the camera to it. The impact acceptance
 *               test is "is the fighter still readable through its own hit", and the
 *               enemy is the thing a real hit lands on. At spawn the AI is ~1080 wu
 *               away (off screen), hence the camera snap.
 * --flight    : projectile + trail, stepped along the real flight path.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

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
const CHAR = a.char ?? 'donut';
const ENEMY = a.enemy ?? 'hamburger';
const WEAPON = a.weapon ?? 'Candy';
const HOOK = a.hook ?? 'impact';
const ON = a.on ?? 'enemy';
const TS = String(a.t ?? '0.02,0.10,0.24').split(',').map(Number);
const OUT = a.out ?? 'shots/dt';
const W = 1300, H = 730;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(60000);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
// Stub Vite's HMR client: another agent's save triggers a full reload that wipes any
// in-page state this probe holds across steps.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
}));
await page.goto(`${BASE}/?simSpeed=0.0001&player=${CHAR}&enemy=${ENEMY}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 40000 });
await page.waitForFunction(() => !!window.__vfxDebugFighters?.player, null, { timeout: 40000 });
await page.waitForTimeout(700);
// The pre-match countdown is a full-screen DOM overlay that never advances at
// simSpeed~0 — every probe shot taken without this has a giant orange "5" over the
// subject, and one agent mis-read it as a character head.
await page.addStyleTag({ content: '.hud-countdown{display:none !important}' });
await page.evaluate(() => {
  if (!window.__origRAF) window.__origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__pendingRAF = cb; return 0; };
});

const setup = await page.evaluate(async ([char, weaponKey, hook, on, garish, warm, scale, flight, pellets, part]) => {
  const mod = await import(`/src/vfx/weapons/${char}.ts`);
  const rules = await import('/src/game/rules.ts');
  const map = mod[`${char}WeaponVfx`];
  const stage = window.__stage;
  let layer = null;
  stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
  const camera = stage.rig.camera;
  const V3 = stage.scene.position.constructor;
  const weapon = rules.CHARACTERS[char].weapons.find((w) => w.key === weaponKey);
  // Combo weapons (Taco's Double Toss) spawn one projectile per `comboParts` entry,
  // each carrying that part's own colour/damage under the parent weapon key. `--part`
  // reproduces that so the per-part branch is what actually gets exercised.
  const cp = part >= 0 && weapon.comboParts ? weapon.comboParts[part] : null;
  const WCOLOR = cp ? cp.color : weapon.color;
  const WDMG = cp ? cp.damage : weapon.damage;
  const M = 0.05;
  const f = window.__vfxDebugFighters;
  const tgt = on === 'enemy' ? f.enemy : f.player;
  const src = on === 'enemy' ? f.player : f.enemy;
  // Camera on the subject of the shot, at the shipped rig (no zoom cheat).
  stage.rig.snapTo(tgt.x * M, tgt.y * M);  // snapTo takes METRES, not world units
  const tx = tgt.x * M, tz = tgt.y * M;
  let dx = tx - src.x * M, dz = tz - src.y * M;
  const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;

  const items = [];
  let clock = 0;
  let lastDist = 0;
  const add = (obj, life, onUpdate) => {
    if (garish) obj.traverse((o) => {
      if (!o.isMesh && !o.isSprite) return;
      o.material = o.material.clone();
      o.material.color.set('#FF00FF');
      o.material.opacity = 1; o.material.transparent = false; o.material.depthTest = false;
      o.material.blending = 0; o.renderOrder = 999;
    });
    if (scale !== 1) obj.scale.multiplyScalar(scale);
    layer.add(obj);
    items.push({ obj, life: Math.max(0.001, life), onUpdate, born: clock, garish });
  };
  const mkCtx = (pos, dir, color, damage, extra = {}) => ({
    THREE: null,
    position: new V3(pos[0], pos[1], pos[2]),
    direction: new V3(dir[0], 0, dir[1]),
    color, damage, weapon, characterId: char,
    spawnTransient: add,
    ...extra,
  });

  // `warm`: fire the hook N times and run each to completion FIRST. Pooled materials
  // are handed out round-robin, so this is what a real match looks like a second in —
  // the only way to catch an effect that reads its start opacity off a pooled
  // material a previous user already faded to zero.
  for (let w = 0; w < warm; w++) {
    const spent = [];
    const ctx = mkCtx([tx, 1.15, tz], [dx, dz], WCOLOR, WDMG,
      { spawnTransient: (obj, life, onUpdate) => spent.push({ obj, life: Math.max(0.001, life), onUpdate }) });
    if (map[weaponKey][hook]) map[weaponKey][hook](ctx);
    for (let s = 0; s <= 20; s++) for (const it of spent) { const t = (s / 20) * it.life * 0.999; it.onUpdate?.(t / it.life, t); }
  }

  const projs = [];
  if (flight) {
    // Real flight geometry: fired from the SOURCE toward the subject, fanned by the
    // weapon's own `spreadDeg`, at `PROJECTILE_HEIGHT` (0.5 m).
    const n = pellets || weapon.pellets || 1;
    const spread = (weapon.spreadDeg ?? 0) * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i - (n - 1) / 2) * spread : 0;
      const c = Math.cos(off), s = Math.sin(off);
      const pdx = dx * c - dz * s, pdz = dx * s + dz * c;
      // Start 5 m short of the subject so the whole flight happens on screen — the
      // real shooter is ~54 m away at spawn and would be off frame for most of it.
      const start = [tx - pdx * 5, 0.5, tz - pdz * 5];
      const ctx = mkCtx(start, [pdx, pdz], WCOLOR, WDMG);
      const obj = map[weaponKey].projectile(ctx);
      layer.add(obj);
      projs.push({ obj, dx: pdx, dz: pdz, sx: start[0], sz: start[2] });
    }
  }

  window.__dt = {
    step(t, projDist) {
      const dt = Math.max(0, t - clock);
      // SUB-STEP the flight at 60 Hz. `trail()` sheds on a per-frame timer, so
      // calling it once per screenshot under-samples the trail by ~8x and makes a
      // weapon that drips look like a weapon that does not.
      const sub = Math.max(1, Math.round(dt / (1 / 60)));
      for (let k = 1; k <= sub; k++) {
        const f = k / sub;
        const d0 = lastDist + (projDist - lastDist) * f;
        for (const p of projs) {
          const px = p.sx + p.dx * d0, pz = p.sz + p.dz * d0;
          p.obj.position.set(px, 0.5, pz);
          p.obj.rotation.y = Math.atan2(p.dx, p.dz);
          const ctx = mkCtx([px, 0.5, pz], [p.dx, p.dz], WCOLOR, WDMG,
            { object: p.obj, dt: (dt || 0.033) / sub });
          map[weaponKey].trail?.(ctx);
        }
        // Age everything already spawned across the sub-steps too, so trail debris
        // dropped early in the interval has actually moved by the screenshot.
        const tt = clock + dt * f;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          const e = tt - it.born;
          if (e > it.life) { layer.remove(it.obj); items.splice(i, 1); continue; }
          it.onUpdate?.(e / it.life, e);
        }
      }
      lastDist = projDist;
      clock = t;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const e = t - it.born;
        if (e > it.life) { layer.remove(it.obj); items.splice(i, 1); continue; }
        it.onUpdate?.(e / it.life, e);
        if (it.garish) it.obj.traverse((o) => {
          if (!o.isMesh && !o.isSprite) return;
          o.material.opacity = 1; o.material.transparent = false; o.material.depthTest = false;
        });
      }
      stage.render(0);
      const rows = [];
      const dump = (obj, tag) => {
        obj.updateMatrixWorld(true);
        obj.traverse((o) => {
          if (!o.isMesh && !o.isSprite) return;
          const s = o.getWorldScale(new V3());
          const p = o.getWorldPosition(new V3());
          const proj = p.clone().project(camera);
          let span = 0;
          if (o.geometry) {
            o.geometry.computeBoundingBox();
            const b = o.geometry.boundingBox;
            span = Math.max((b.max.x - b.min.x) * s.x, (b.max.z - b.min.z) * s.z, (b.max.y - b.min.y) * s.y);
          } else span = Math.max(s.x, s.y);
          rows.push({
            tag, geo: o.geometry?.type ?? 'Sprite',
            span: +span.toFixed(2), y: +p.y.toFixed(2),
            op: +(o.material.opacity ?? 1).toFixed(3),
            col: '#' + (o.material.color?.getHexString?.() ?? '??????'),
            sx: Math.round((proj.x * 0.5 + 0.5) * 1300), sy: Math.round((-proj.y * 0.5 + 0.5) * 730),
          });
        });
      };
      for (const p of projs) dump(p.obj, 'PROJ');
      for (const it of items) dump(it.obj, 'fx');
      return { live: items.length, rows };
    },
    fire() {
      const ctx = mkCtx(
        // Matches `spawnCastFlash` exactly: 0.7 m IN FRONT of the attacker at
        // CAST_HEIGHT 1.25, not at its centre. Placing it at the centre buries the
        // whole cue inside the fighter's own mass.
        hook === 'cast' ? [src.x * M + dx * 0.7, 1.25, src.y * M + dz * 0.7] : [tx, 1.15, tz],
        [dx, dz], WCOLOR, WDMG,
      );
      map[weaponKey][hook](ctx);
      return items.length;
    },
    // Reset the CLOCK too: without it the next effect is born at the previous one's
    // end time and stepped to t=0, i.e. NEGATIVE elapsed, which sends easing curves
    // to absurd values.
    clear() { for (const it of items) layer.remove(it.obj); items.length = 0; clock = 0; lastDist = 0; },
  };
  if (hook === 'cast') stage.rig.snapTo(src.x * M, src.y * M);
  return { flight, tgt: [tgt.x, tgt.y], src: [src.x, src.y] };
}, [CHAR, WEAPON, HOOK, ON, !!a.garish, Number(a.warm ?? 0), Number(a.scale ?? 1), !!a.flight, Number(a.pellets ?? 0), Number(a.part ?? -1)]);

const tag = a.garish ? 'garish' : 'plain';
if (!setup.flight) {
  const n = await page.evaluate(() => window.__dt.fire());
  console.log(`${CHAR}.${WEAPON}.${HOOK}: spawned ${n} transients${a.garish ? ' (GARISH)' : ''}`);
}
for (const t of TS) {
  const dist = Number(a.dist ?? 6) * (t / Math.max(...TS));
  const fr = await page.evaluate(([tt, dd]) => window.__dt.step(tt, dd), [t, dist]);
  const name = `${CHAR}_${WEAPON}_${HOOK}${setup.flight ? '_flight' : ''}_${tag}_t${String(t).replace('.', '')}.png`;
  await page.screenshot({ path: `${OUT}/${name}` });
  console.log(`\n t=${t}  live=${fr.live}  meshes=${fr.rows.length}`);
  for (const r of fr.rows) {
    console.log(`   ${r.tag.padEnd(4)} ${r.geo.padEnd(16)} span=${String(r.span).padStart(5)}m y=${String(r.y).padStart(5)} op=${String(r.op).padStart(5)} ${r.col} screen=${r.sx},${r.sy}`);
  }
}
await browser.close();
