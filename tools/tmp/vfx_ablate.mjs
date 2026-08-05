#!/usr/bin/env node
/**
 * IS IT OCCLUDED, OR IS IT JUST TOO SMALL? — the ablation that separates the two.
 *
 * `docs/LESSONS.md` §1 says assume rendering-but-invisible first and prove it with an
 * unmissable probe. But "unmissable" has two independent knobs and this project has
 * confused them before: the puddle splash was fixed once for DEPTH (spawned under an
 * opaque puddle disc) and then had to be fixed again for SCALE (0.03 m droplets =
 * about two pixels). A probe that turns both knobs at once cannot tell you which one
 * was the fault.
 *
 * So each effect is measured four ways against the same frozen baseline, at its own
 * peak millisecond:
 *
 *   shipped          exactly what the player sees
 *   +nodepth         depthTest disabled on everything the effect spawned
 *   +scale4          every sprite scaled 4x, depth untouched
 *   +both            the classic garish probe
 *
 * shipped -> +nodepth  measures OCCLUSION.
 * shipped -> +scale4   measures SUB-PERCEPTUAL SIZE.
 * Both modifications are applied AFTER `updateEffects()` and BEFORE the render, then
 * restored, so nothing leaks into the next measurement (the first version of the
 * coverage probe left `depthTest:false` on pooled materials and inflated every
 * subsequent number by 30-45%).
 *
 *   node tools/tmp/vfx_ablate.mjs --url <snapshot-url>
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

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
const OUT = args.out ?? 'shots/vfx/ablate';
const W = Number(args.w ?? 1600), H = Number(args.h ?? 900);
const RW = W / 2, RH = H / 2;

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
  // Park the game's own rAF loop. Pausing the clock makes every delta 0, so nothing
  // ANIMATES — but the loop still runs, and it still calls `vfx.sync(this.state)` with
  // the REAL state. For the status telegraphs that is fatal to a screenshot: the probe
  // drives `sync()` with a synthetic slowed/stunned state, renders, and then the game
  // loop re-syncs the real (un-slowed) state before Playwright's async screenshot
  // lands, so the PNG shows nothing while the in-page measurement — taken inside one
  // synchronous evaluate — correctly shows the effect. Two frames of the same instant
  // disagreeing is exactly the kind of instrument fault LESSONS §13 is about.
  await page.evaluate(() => {
    window.__parkedRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = () => 0;
  });
  await page.waitForTimeout(200);

  await page.evaluate(([rw, rh]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas'); cv.width = rw; cv.height = rh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let base = null;
    let layer = null;
    stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
    const grab = () => { stage.render(0); ctx.clearRect(0, 0, rw, rh); ctx.drawImage(stage.canvas, 0, 0, rw, rh); return ctx.getImageData(0, 0, rw, rh).data; };
    const count = (cur) => {
      let n = 0;
      for (let i = 0; i < cur.length; i += 4) {
        if (Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2])) >= 6) n++;
      }
      return n;
    };
    window.__ab = {
      setBase() { base = grab(); },
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
      /** Render one variant and restore every object it touched. */
      measure(nodepth, scaleMul) {
        const saved = [];
        if (nodepth || scaleMul !== 1) {
          layer.traverse((o) => {
            if ((!o.isSprite && !o.isMesh) || !o.visible) return;
            saved.push({ o, dt: o.material?.depthTest, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z, ro: o.renderOrder });
            if (nodepth && o.material) { o.material.depthTest = false; o.renderOrder = 999; }
            if (scaleMul !== 1) o.scale.set(o.scale.x * scaleMul, o.scale.y * scaleMul, o.scale.z * scaleMul);
          });
        }
        const n = count(grab());
        for (const s of saved) {
          if (s.o.material) s.o.material.depthTest = s.dt;
          s.o.scale.set(s.sx, s.sy, s.sz);
          s.o.renderOrder = s.ro;
        }
        return n;
      },
      shot() { return null; },
    };
  }, [RW, RH]);

  const cases = [
    ['heal', ['heal', 14, '#6FE0A8'], 16],
    ['puddleSplash', ['puddleSplash', 4, '#E8F8FF'], 16],
    ['cast flash', ['cast', 14, '#FFC93C'], 100],
    ['impact dmg6', ['impact', 6, '#FFC93C'], 220],
    ['impact dmg18', ['impact', 18, '#FFC93C'], 320],
    ['death', ['death', 14, '#E63946'], 450],
    ['meleeArc', ['meleeArc', 12, '#FFC93C', 'hamburger', 'Smash'], 16],
    ['stun stars', ['__stun'], 0],
    ['slow ring+tint', ['__slow'], 0],
    // combat.ts's status grace window: expired but not yet re-appliable. `__ward` is
    // the resting band (the STATE a player must be able to see before spending a
    // stun); `__wardpop` fires a real stun weapon into that window so the refusal
    // INSTANT can be told apart from a miss.
    ['ward (grace band)', ['__ward'], 0],
    ['ward pop (refused)', ['__wardpop'], 60],
  ];

  console.log(`\nreadback ${RW}x${RH}   (px counts at that resolution; x4 for 1600x900)\n`);
  console.log('effect            shipped   +nodepth   +scale4     +both     occlusion   size');
  console.log('─'.repeat(84));
  const rows = [];
  for (const [label, fire, peakMs] of cases) {
    const r = await page.evaluate(async ([fireSpec, ms]) => {
      window.__ab.reset(); window.__ab.setBase();
      const f = window.__vfxDebugFighters.player;
      if (fireSpec[0].startsWith('__')) {
        const rules = await import('/src/game/rules.ts');
        void rules;
        const mk = (role) => ({
          characterId: role === 'player' ? 'hamburger' : 'donut',
          x: f.x, y: window.__vfxDebugFighters[role].y, hp: 100, maxHp: 100, alive: true,
          facing: { x: 1, y: 0 }, terrainSlowFactor: 1, status: { slowedUntil: 0, stunnedUntil: 0 },
        });
        const st = { elapsed: 1000, projectiles: [], splats: [], trailMarks: [], player: mk('player'), enemy: mk('enemy') };
        st.player.x = f.x; st.player.y = f.y;
        if (fireSpec[0] === '__stun') st.player.status.stunnedUntil = 99999;
        else if (fireSpec[0] === '__slow') st.player.terrainSlowFactor = 0.5;
        else {
          // Stun expired 100 ms ago: inside STUN_GRACE_MS (500), so the sim would
          // refuse a re-application right now.
          st.player.status.stunnedUntil = st.elapsed - 100;
        }
        window.__vfxLayer.sync(st);
        if (fireSpec[0] === '__wardpop') {
          // waterbottle.Glass carries effect:'stun'. The hit lands and deals damage;
          // only the status is refused.
          window.__vfxSpawnTest('impact', f.x, f.y, 7, '#BFEFFF', 'waterbottle', 'Glass');
          if (ms > 0) window.__ab.step(ms);
          window.__vfxLayer.sync(st);
        }
      } else {
        const [kind, amount, color, who, wk] = fireSpec;
        window.__vfxSpawnTest(kind, f.x, f.y, amount, color, who, wk);
        if (ms > 0) window.__ab.step(ms);
      }
      const shipped = window.__ab.measure(false, 1);
      const nodepth = window.__ab.measure(true, 1);
      const scale4 = window.__ab.measure(false, 4);
      const both = window.__ab.measure(true, 4);
      // Leave the effect standing at its peak so the caller can shoot a judgement
      // frame of the SHIPPED look — `measure()` restores everything it touched, so
      // what is on screen now is exactly what a player sees.
      window.__ab.measure(false, 1);
      const scr = window.__vfxDebugScreen?.player ?? null;
      return { shipped, nodepth, scale4, both, scr };
    }, [fire, peakMs]);
    if (args.shots) {
      const cx = r.scr ? Math.round(r.scr.x) : W / 2;
      // `__vfxDebugScreen` projects the fighter's GROUND point, but several effects
      // here live well above it — the stun stars orbit at 1.04x character height. A
      // crop centred on the feet put them off the top edge and produced an empty PNG
      // for an effect the same run measured at 366 delivered pixels. Lift the crop by
      // most of a character height so head-height effects are actually in frame.
      const cy = (r.scr ? Math.round(r.scr.y) : H / 2) - 90;
      const S = Number(args.shot ?? 420);
      await page.screenshot({
        path: `${OUT}/${label.replace(/[^a-z0-9]+/gi, '_')}.png`,
        clip: {
          x: Math.max(0, Math.min(W - S, cx - S / 2)),
          y: Math.max(0, Math.min(H - S, cy - S / 2)),
          width: S, height: S,
        },
      });
    }
    await page.evaluate(() => window.__ab.reset());
    const occl = r.shipped > 0 ? (r.nodepth / r.shipped) : (r.nodepth > 0 ? Infinity : 1);
    const size = r.shipped > 0 ? (r.scale4 / r.shipped) : (r.scale4 > 0 ? Infinity : 1);
    console.log(`${label.padEnd(16)} ${String(r.shipped).padStart(7)} ${String(r.nodepth).padStart(10)} ${String(r.scale4).padStart(9)} ${String(r.both).padStart(9)}     ${occl.toFixed(2)}x     ${size.toFixed(1)}x`);
    rows.push({ label, ...r, occlusionRatio: +occl.toFixed(2), sizeRatio: +size.toFixed(1) });
  }
  await writeFile(`${OUT}/ablate.json`, JSON.stringify({ base: BASE, readback: [RW, RH], rows }, null, 1));
  console.log(`\nocclusion >1.3x  => the effect IS being buried (a depth/height problem)`);
  console.log(`size ratio near 16x (=4^2) => the effect is simply sub-perceptual, nothing is hiding it`);
  console.log(`wrote ${OUT}/ablate.json`);
} finally {
  await browser.close();
}
