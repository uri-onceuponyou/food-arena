#!/usr/bin/env node
/**
 * THROWAWAY probe for `src/vfx/weapons/soup.ts`.
 *
 * `window.__vfxSpawnTest` only reaches the GENERIC burst (it calls
 * `spawnImpactBurst` with no `source`, so the bespoke registry is never consulted),
 * and driving a specific Soup hit through real gameplay is unreliable — the AI
 * kites. So this imports the soup module directly in the page, replicates
 * `VfxLayer.spawnTransientObject` exactly (add to the `vfx_layer` group; drive
 * `onUpdate(progress, elapsed)`; remove at end of life), and steps it on a CLOCK WE
 * OWN. Screenshot readback under SwiftShader is far slower than a sub-second effect,
 * so real-time capture would miss the frames that matter.
 *
 *   node tools/tmp/soupshot.mjs <outDir> <hook> [--scale N] [--garish] [--times a,b,c]
 *
 * hook: splash-impact | splash-cast | splash-flight | noodle-impact | noodle-cast
 *     | noodle-flight | dump-cast | dump-impact | dump-full | all
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = 'http://localhost:5173';

const argv = process.argv.slice(2);
const OUT = argv[0] ?? 'shots/soup/r0';
const HOOK = argv[1] ?? 'all';
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);
const SCALE = Number(flag('scale', 1));
const TIMES = String(flag('times', '0.02,0.08,0.16,0.30,0.50')).split(',').map(Number);
const W = 1300, H = 730;

const HOOKS = {
  'splash-impact': ['Splash', 'impact'],
  'splash-cast': ['Splash', 'cast'],
  'noodle-impact': ['Noodle', 'impact'],
  'noodle-cast': ['Noodle', 'cast'],
  'dump-cast': ['Dump', 'cast'],
  'dump-impact': ['Dump', 'impact'],
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });

    await page.goto(`${BASE}/?simSpeed=0.0001&player=soup&enemy=donut`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 40000 });
    await page.waitForFunction(() => !!window.__vfxDebugFighters?.player, null, { timeout: 40000 });
    await page.waitForTimeout(800);

    // Freeze the game loop (queue the pending rAF rather than dropping it — dropping
    // it permanently kills `match.ts`'s self-rescheduling loop).
    await page.evaluate(() => {
      if (!window.__origRAF) window.__origRAF = window.requestAnimationFrame.bind(window);
      window.__pendingRAF = null;
      window.requestAnimationFrame = (cb) => { window.__pendingRAF = cb; return 0; };
    });

    const fighters = await page.evaluate(() => window.__vfxDebugFighters);
    console.log('player', fighters.player.x.toFixed(0), fighters.player.y.toFixed(0),
      '| enemy', fighters.enemy.x.toFixed(0), fighters.enemy.y.toFixed(0));

    await page.evaluate(async ([scale, garish]) => {
      const mod = await import('/src/vfx/weapons/soup.ts');
      const stage = window.__stage;
      let layer = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
      const V3 = stage.scene.position.constructor;   // a THREE.Vector3 ctor, no bare import needed
      const items = [];
      let clock = 0;

      window.__soup = {
        layer,
        count: () => items.length,
        fire(weaponKey, hook, x, y, z, dx, dz, color, damage, range) {
          const ctx = {
            THREE: null,
            position: new V3(x, y, z),
            direction: new V3(dx, 0, dz),
            color, damage, characterId: 'soup',
            weapon: { key: weaponKey, name: weaponKey, type: 'ranged', range, damage, cooldown: 1, color, effect: null },
            spawnTransient: (obj, life, onUpdate) => {
              if (garish) obj.traverse((o) => { if (o.material && o.material.color) o.material.color.set('#FF00FF'); });
              if (scale !== 1) obj.userData.__probeScale = scale;
              layer.add(obj);
              items.push({ obj, life: Math.max(0.001, life), onUpdate, born: clock });
            },
          };
          const fn = mod.soupWeaponVfx[weaponKey]?.[hook];
          if (!fn) throw new Error(`no hook ${weaponKey}.${hook}`);
          fn(ctx);
          return items.length;
        },
        makeProjectile(weaponKey, x, y, z, dx, dz, color, damage) {
          const ctx = {
            THREE: null, position: new V3(x, y, z), direction: new V3(dx, 0, dz),
            color, damage, characterId: 'soup',
            weapon: { key: weaponKey, name: weaponKey, type: 'ranged', range: 100, damage, cooldown: 1, color, effect: null },
            spawnTransient: (obj, life, onUpdate) => { layer.add(obj); items.push({ obj, life: Math.max(0.001, life), onUpdate, born: clock }); },
          };
          const obj = mod.soupWeaponVfx[weaponKey].projectile(ctx);
          layer.add(obj);
          window.__soupProj = { obj, weaponKey, color, damage, ctxBase: ctx };
          return true;
        },
        stepProjectile(dt, x, y, z, dx, dz) {
          const p = window.__soupProj;
          if (!p) return;
          p.obj.position.set(x, y, z);
          p.obj.rotation.y = Math.atan2(dx, dz);
          const ctx = {
            ...p.ctxBase,
            position: new V3(x, y, z),
            direction: new V3(dx, 0, dz),
            object: p.obj,
            dt,
            spawnTransient: (obj, life, onUpdate) => { layer.add(obj); items.push({ obj, life: Math.max(0.001, life), onUpdate, born: clock }); },
          };
          mod.soupWeaponVfx[p.weaponKey].trail(ctx);
        },
        /** Advance the clock WITHOUT rendering — the size sweep needs ~50 steps and
         * a SwiftShader render each would take longer than the screenshot budget. */
        stepQuiet(t) {
          clock = t;
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            const e = t - it.born;
            if (e > it.life) { layer.remove(it.obj); items.splice(i, 1); continue; }
            it.onUpdate?.(e / it.life, e);
          }
        },
        step(t) {
          clock = t;
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            const e = t - it.born;
            if (e > it.life) { layer.remove(it.obj); items.splice(i, 1); continue; }
            it.onUpdate?.(e / it.life, e);
            if (it.obj.userData.__probeScale) it.obj.scale.multiplyScalar(it.obj.userData.__probeScale);
          }
          stage.render(0);
        },
        // Reset the CLOCK too. Without this the next effect is born at the previous
        // one's end time and then stepped to t=0, i.e. NEGATIVE elapsed — which sent
        // easing curves like `1 - (1-t)^2.6` to absurd values and produced a round of
        // bogus 100 m+ measurements and useless screenshots.
        clear() {
          for (const it of items) layer.remove(it.obj);
          items.length = 0;
          clock = 0;
          if (window.__soupProj) { layer.remove(window.__soupProj.obj); window.__soupProj = null; }
        },
        /** Measured world-space size of every object this probe put in the layer —
         * the number under review, not an impression of it. */
        sizes() {
          const rows = [];
          for (const it of items) {
            let maxW = 0; let what = '?';
            it.obj.updateMatrixWorld(true);
            it.obj.traverse((o) => {
              if (!o.isMesh) return;
              o.geometry.computeBoundingBox();
              const b = o.geometry.boundingBox;
              const s = o.getWorldScale(new V3());
              const m = Math.max((b.max.x - b.min.x) * s.x, (b.max.z - b.min.z) * s.z, (b.max.y - b.min.y) * s.y);
              if (m > maxW) { maxW = m; what = o.geometry.type + `[${(b.max.x - b.min.x).toFixed(2)}x${(b.max.y - b.min.y).toFixed(2)}x${(b.max.z - b.min.z).toFixed(2)}]s${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)}`; }
            });
            rows.push({ m: +maxW.toFixed(3), what });
          }
          rows.sort((a, b) => b.m - a.m);
          return rows.slice(0, 6).map((r) => `${r.m} ${r.what}`);
        },
      };
    }, [SCALE, has('garish')]);

    const f = await page.evaluate(() => window.__vfxDebugFighters);
    // The camera is centred on the PLAYER, and at spawn the AI enemy is 1080 wu away
    // — completely off screen. So the impact is fired ON the player: a fighter
    // standing inside its own hit is exactly the acceptance test ("is the character
    // still readable through the impact frame"), and it is the only placement that is
    // guaranteed at shipped framing without waiting on an AI that kites.
    const M = 0.05; // WORLD_SCALE
    const ex = f.enemy.x * M, ez = f.enemy.y * M;
    const pxm = f.player.x * M, pzm = f.player.y * M;
    let dx = ex - pxm, dz = ez - pzm;
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;

    const list = HOOK === 'all' ? Object.keys(HOOKS) : [HOOK];

    for (const name of list) {
      if (name === 'splash-flight' || name === 'noodle-flight') {
        const key = name.startsWith('splash') ? 'Splash' : 'Noodle';
        const color = key === 'Splash' ? '#E8792A' : '#FFE9A8';
        await page.evaluate(([k, x, y, z, ddx, ddz, c]) =>
          window.__soup.makeProjectile(k, x, y, z, ddx, ddz, c, 5),
        [key, pxm + dx * 1.2, 0.5, pzm + dz * 1.2, dx, dz, color]);
        for (let i = 0; i < TIMES.length; i++) {
          const t = TIMES[i];
          const dist = 1.2 + t * (key === 'Splash' ? 14 : 12.8);
          await page.evaluate(([tt, x, y, z, ddx, ddz]) => {
            window.__soup.stepProjectile(0.033, x, y, z, ddx, ddz);
            window.__soup.step(tt);
          }, [t, pxm + dx * dist, 0.5, pzm + dz * dist, dx, dz]);
          await page.screenshot({ path: `${OUT}/${name}_t${String(t).replace('.', '')}.png` });
        }
        await page.evaluate(() => window.__soup.clear());
        continue;
      }

      const [wk, hook] = HOOKS[name];
      const dmg = wk === 'Dump' ? 16 : wk === 'Noodle' ? 5 : 3;
      const color = wk === 'Noodle' ? '#FFE9A8' : '#E8792A';
      const range = wk === 'Dump' ? 84 : wk === 'Noodle' ? 128 : 98;
      // impact fires at the enemy (IMPACT_HEIGHT 1.15); cast at the attacker
      // (CAST_HEIGHT 1.25, offset 0.7 m along facing) — same as `game/vfx.ts`.
      const isImpact = hook === 'impact';
      void ex; void ez;
      const px = isImpact ? pxm : pxm + dx * 0.7;
      const pz = isImpact ? pzm : pzm + dz * 0.7;
      const py = isImpact ? 1.15 : 1.25;

      const fire = async () => {
        // Splash: three pellets land together — the real worst case for this weapon.
        const shots = (wk === 'Splash' && isImpact) ? [-1, 0, 1] : [0];
        for (const k of shots) {
          await page.evaluate(([w, h, x, y, z, ddx, ddz, c, d, r]) =>
            window.__soup.fire(w, h, x, y, z, ddx, ddz, c, d, r),
          [wk, hook, px + k * 0.35, py, pz + k * 0.3, dx, dz, color, dmg, range]);
        }
      };

      // PASS 1 — peak measured size across the whole lifetime (not just frame 0), the
      // number that has to be compared against the generic burst's 1.74 m typical /
      // 3.0 m cap. This consumes the effect, so pass 2 re-fires it.
      await fire();
      const peak = await page.evaluate(() => {
        let best = [];
        for (let t = 0; t <= 0.95; t += 0.02) {
          window.__soup.stepQuiet(t);
          const s = window.__soup.sizes();
          if (s.length && (!best.length || parseFloat(s[0]) > parseFloat(best[0]))) best = s;
        }
        return best;
      });
      console.log(`${name}: PEAK world size (m, CHARACTER_HEIGHT=2.10):\n    ${peak.join('\n    ')}`);
      await page.evaluate(() => window.__soup.clear());

      // PASS 2 — screenshots.
      await fire();
      for (const t of TIMES) {
        await page.evaluate((tt) => window.__soup.step(tt), t);
        await page.screenshot({ path: `${OUT}/${name}_t${String(t).replace('.', '')}.png` });
      }
      await page.evaluate(() => window.__soup.clear());
      await page.evaluate(() => window.__stage.render(0));
    }

    // A clean reference frame with no effect at all, for A/B on readability.
    await page.screenshot({ path: `${OUT}/_clean.png` });
    console.log('wrote', OUT);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
