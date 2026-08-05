#!/usr/bin/env node
/**
 * THROWAWAY (pizza VFX loop): deterministic isolation harness for
 * `src/vfx/weapons/pizza.ts`.
 *
 * Driving a specific hit through real gameplay is unreliable, so this dynamically
 * imports the weapon module into the live game page (Vite serves + transforms it),
 * builds a `WeaponVfxCtx` by hand, and drives the hooks itself with its own
 * `spawnTransient` implementation. Nothing animates on its own => every frame is
 * frozen and reproducible.
 *
 * Also measures, off the scene graph and the real camera:
 *   - the projectile's PROJECTED SCREEN AREA at N points across its flight
 *     (the anti-edge-on test — a plate that tips edge-on collapses toward 0)
 *   - the world-space span of every impact element vs CHARACTER_HEIGHT
 *
 * node tools/tmp/pizza_probe.mjs --weapon Tomato --mode flight --out shots/pizza/r1
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
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const WEAPON = args.weapon ?? 'Tomato';
const MODE = args.mode ?? 'flight';       // flight | impact | cast
const OUT = args.out ?? 'shots/pizza/probe';
const BOOST = Number(args.boost ?? 1);    // garish-probe scale multiplier
const FRAMES = Number(args.frames ?? 6);
const W = Number(args.w ?? 1300), H = Number(args.h ?? 820);
const CROP = args.crop ? Number(args.crop) : 0;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
    await page.goto(`${BASE}/?simSpeed=0.0001&player=pizza&enemy=donut`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });

    // ── Install the harness ──────────────────────────────────────────────────
    // Re-installable on demand: writing PNGs under the project root makes Vite's
    // watcher reload the page mid-run, which wipes `window.__pz`. Every step below
    // calls `ensure()` first rather than assuming the harness survived.
    const installFn = async ([weaponKey, boost]) => {
      const mod = await import('/src/vfx/weapons/pizza.ts');
      const rules = await import('/src/game/rules.ts');
      const stage = window.__stage;
      const scene = stage.scene;
      const camera = stage.rig.camera;
      const V3 = scene.position.constructor;

      const weapon = rules.CHARACTERS.pizza.weapons.find((w) => w.key === weaponKey);
      const vfx = mod.pizzaWeaponVfx[weaponKey];

      const transients = [];
      const spawnTransient = (obj, life, onUpdate) => {
        if (boost !== 1) obj.scale.multiplyScalar(boost);
        scene.add(obj);
        transients.push({ obj, life, onUpdate, t: 0 });
      };

      const mkCtx = (pos, dir, extra) => Object.assign({
        THREE: null,
        position: new V3(pos[0], pos[1], pos[2]),
        direction: new V3(dir[0], 0, dir[1]),
        color: weapon.color,
        damage: weapon.damage,
        weapon,
        characterId: 'pizza',
        spawnTransient,
      }, extra ?? {});

      // Project a mesh's triangles to screen and sum their absolute areas => exact
      // projected silhouette area for a flat convex plate, in px^2.
      const projectedArea = (mesh) => {
        mesh.updateWorldMatrix(true, false);
        const g = mesh.geometry;
        const pos = g.attributes.position;
        const idx = g.index;
        const v = new V3();
        const pts = [];
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(camera);
          pts.push([(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight]);
        }
        let area = 0;
        const n = idx ? idx.count : pos.count;
        for (let i = 0; i < n; i += 3) {
          const a = pts[idx ? idx.getX(i) : i];
          const b = pts[idx ? idx.getX(i + 1) : i + 1];
          const c = pts[idx ? idx.getX(i + 2) : i + 2];
          area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
        }
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
        return { area, w: maxX - minX, h: maxY - minY };
      };

      window.__pz = { mod, rules, stage, scene, camera, V3, weapon, vfx, transients, spawnTransient, mkCtx, projectedArea, objects: [], boost };

      // Character on-screen height, for every ratio below.
      const f = window.__vfxDebugFighters.player;
      const wu = 0.05;
      const foot = new V3(f.x * wu, 0, f.y * wu).project(camera);
      const head = new V3(f.x * wu, 2.1, f.y * wu).project(camera);
      const charPx = Math.abs((foot.y - head.y) * 0.5 * window.innerHeight);
      return { weapon, charPx, playerWU: { x: f.x, y: f.y } };
    };

    const ensure = async () => {
      const alive = await page.evaluate(() => !!window.__pz);
      if (alive) return;
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
      await page.evaluate(installFn, [WEAPON, BOOST]);
    };

    const setup = await page.evaluate(installFn, [WEAPON, BOOST]);

    console.log('weapon:', JSON.stringify(setup.weapon));
    console.log(`character on-screen height: ${setup.charPx.toFixed(1)} px  (${(setup.charPx / H * 100).toFixed(1)}% of frame)`);

    // Freeze by CAPTURING the pending RAF callback rather than dropping it — dropping
    // it kills the render loop permanently and every later screenshot comes back as a
    // byte-identical stale frame (which is exactly what happened the first run).
    const freeze = () => page.evaluate(() => {
      if (!window.__origRAF) window.__origRAF = window.requestAnimationFrame.bind(window);
      window.__pendingRAF = null;
      window.requestAnimationFrame = (cb) => { window.__pendingRAF = cb; return 0; };
    });
    const unfreeze = () => page.evaluate(() => {
      window.requestAnimationFrame = window.__origRAF;
      if (window.__pendingRAF) { const cb = window.__pendingRAF; window.__pendingRAF = null; window.__origRAF(cb); }
    });

    if (MODE === 'flight') {
      // Fly the projectile past the player, sampling FRAMES points across its real
      // flight time, stepping `trail()` at 60 Hz in between exactly like sync() does.
      await ensure();
      const samples = await page.evaluate(async ([frames]) => {
        const P = window.__pz;
        const { V3, weapon, vfx, mkCtx, projectedArea, scene, camera } = P;
        const f = window.__vfxDebugFighters.player;
        const wu = 0.05;
        // Start left of the player, fly to the right, passing across the frame.
        const flightS = weapon.range / weapon.speed;
        const rangeM = weapon.range * wu;
        const sx = f.x * wu - rangeM * 0.5, sz = f.y * wu + 1.2;
        const dir = [1, 0];
        const ctx0 = mkCtx([sx, 0.5, sz], dir);
        const obj = vfx.projectile(ctx0);
        // Garish-probe scaling has to go on a PARENT, because `trail()` writes the
        // projectile's own `scale` (Cheese flaps with it).
        let root = obj;
        if (P.boost !== 1) { root = new obj.constructor(); root.add(obj); root.scale.setScalar(P.boost); }
        scene.add(root);
        P.objects.push(root);
        const speedM = weapon.speed * wu;

        const dt = 1 / 60;
        const out = [];
        const steps = Math.round(flightS / dt);
        const shotAt = new Set(Array.from({ length: frames }, (_, i) => Math.round((i + 0.5) / frames * steps)));
        for (let i = 0; i <= steps; i++) {
          const x = sx + speedM * dt * i;
          obj.position.set(x, 0.5, sz);
          obj.rotation.y = Math.atan2(dir[0], dir[1]);
          const ctx = mkCtx([x, 0.5, sz], dir, { object: obj, dt });
          vfx.trail?.(ctx);
          // advance our own transients so the sweep arcs behave as they would live
          for (let k = P.transients.length - 1; k >= 0; k--) {
            const tr = P.transients[k];
            tr.t += dt;
            if (tr.t >= tr.life) { scene.remove(tr.obj); P.transients.splice(k, 1); continue; }
            tr.onUpdate?.(tr.t / tr.life, tr.t);
          }
          if (shotAt.has(i)) {
            // face mesh = last child that is a Mesh with the plate geometry
            const face = obj.children[1];
            const m = projectedArea(face);
            const v = new V3().copy(obj.position).project(camera);
            out.push({
              step: i, tFrac: +(i / steps).toFixed(2), areaPx2: +m.area.toFixed(1),
              wPx: +m.w.toFixed(1), hPx: +m.h.toFixed(1),
              screen: { x: +((v.x * 0.5 + 0.5) * window.innerWidth).toFixed(0), y: +((-v.y * 0.5 + 0.5) * window.innerHeight).toFixed(0) },
              snapshot: true,
            });
          }
        }
        return out;
      }, [FRAMES]);

      // Re-run, stopping at each sample point, and screenshot.
      for (let i = 0; i < samples.length; i++) {
        await ensure();
        await page.evaluate(async ([target]) => {
          const P = window.__pz;
          const { V3, weapon, vfx, mkCtx, scene } = P;
          for (const o of P.objects) scene.remove(o);
          for (const t of P.transients) scene.remove(t.obj);
          P.objects.length = 0; P.transients.length = 0;
          const f = window.__vfxDebugFighters.player;
          const wu = 0.05;
          const flightS = weapon.range / weapon.speed;
          const rangeM = weapon.range * wu;
          const sx = f.x * wu - rangeM * 0.5, sz = f.y * wu + 1.2;
          const dir = [1, 0];
          const obj = vfx.projectile(mkCtx([sx, 0.5, sz], dir));
          let root = obj;
          if (P.boost !== 1) { root = new obj.constructor(); root.add(obj); root.scale.setScalar(P.boost); }
          scene.add(root); P.objects.push(root);
          const speedM = weapon.speed * wu;
          const dt = 1 / 60;
          for (let i = 0; i <= target; i++) {
            const x = sx + speedM * dt * i;
            obj.position.set(x, 0.5, sz);
            obj.rotation.y = Math.atan2(dir[0], dir[1]);
            vfx.trail?.(mkCtx([x, 0.5, sz], dir, { object: obj, dt }));
            for (let k = P.transients.length - 1; k >= 0; k--) {
              const tr = P.transients[k];
              tr.t += dt;
              if (tr.t >= tr.life) { scene.remove(tr.obj); P.transients.splice(k, 1); continue; }
              tr.onUpdate?.(tr.t / tr.life, tr.t);
            }
          }
          void V3;
        }, [samples[i].step]);
        await page.waitForTimeout(120);
        await freeze();
        const clip = CROP ? { x: Math.max(0, samples[i].screen.x - CROP / 2), y: Math.max(0, samples[i].screen.y - CROP / 2), width: CROP, height: CROP } : undefined;
        await page.screenshot({ path: `${OUT}/${WEAPON}_flight_${i}.png`, clip });
        await unfreeze();
      }

      const areas = samples.map((s) => s.areaPx2);
      const maxA = Math.max(...areas), minA = Math.min(...areas);
      console.log('flight samples:');
      for (const s of samples) console.log(`  t=${s.tFrac}  area=${s.areaPx2}px²  bbox=${s.wPx}x${s.hPx}px`);
      console.log(`AT-1  min/max projected area = ${(minA / maxA).toFixed(3)}  (need >= 0.60: never edge-on)`);
      console.log(`AT-1  max on-screen extent = ${Math.max(...samples.map((s) => Math.max(s.wPx, s.hPx))).toFixed(1)} px  vs character ${setup.charPx.toFixed(1)} px`);
    } else {
      // impact / cast: fire once at the player and step a few frames.
      const sizes = await page.evaluate(async ([mode]) => {
        const P = window.__pz;
        const { vfx, mkCtx, scene } = P;
        const f = window.__vfxDebugFighters.player;
        const wu = 0.05;
        const y = mode === 'impact' ? 1.15 : 1.25;
        const ctx = mkCtx([f.x * wu, y, f.y * wu], [1, 0]);
        vfx[mode]?.(ctx);
        void scene;
        return P.transients.length;
      }, [MODE]);
      console.log(`${MODE}: ${sizes} transients spawned`);

      const dt = 1 / 60;
      for (let i = 0; i < FRAMES; i++) {
        const measure = await page.evaluate(([dt, steps]) => {
          const P = window.__pz;
          const { scene, V3 } = P;
          for (let s = 0; s < steps; s++) {
            for (let k = P.transients.length - 1; k >= 0; k--) {
              const tr = P.transients[k];
              tr.t += dt;
              if (tr.t >= tr.life) { scene.remove(tr.obj); P.transients.splice(k, 1); continue; }
              tr.onUpdate?.(tr.t / tr.life, tr.t);
            }
          }
          // world-space span of every live element
          const rows = [];
          const box = new (scene.constructor.prototype.constructor === Object ? Object : Object)();
          void box; void V3;
          for (const tr of P.transients) {
            tr.obj.updateWorldMatrix(true, true);
            let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
            tr.obj.traverse((o) => {
              if (!o.isMesh) return;
              const g = o.geometry;
              const pos = g.attributes.position;
              const v = new (o.position.constructor)();
              for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
                minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
                minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
                minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
              }
            });
            rows.push({ span: +Math.max(maxX - minX, maxZ - minZ, maxY - minY).toFixed(2), t: +tr.t.toFixed(2) });
          }
          return rows;
        }, [dt, i === 0 ? 1 : 3]);
        await page.waitForTimeout(110);
        await freeze();
        await page.screenshot({ path: `${OUT}/${WEAPON}_${MODE}_${i}.png` });
        await unfreeze();
        const spans = measure.map((m) => m.span);
        console.log(`  frame ${i}: ${measure.length} live, max element span = ${spans.length ? Math.max(...spans).toFixed(2) : 0} m  (CHARACTER_HEIGHT = 2.10 m)`);
      }
    }
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
