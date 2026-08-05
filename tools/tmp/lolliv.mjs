#!/usr/bin/env node
/**
 * Lollipop VFX verification probe (agent scratch tool).
 *
 * The point of this file is the OFF-SCREEN CASTER case. `player=donut&enemy=lollipop`
 * makes that case happen deterministically without any scripted aiming:
 *   - `ai.ts` picks the highest-damage weapon whose `range` covers the current
 *     distance. Lollipop: Smash dmg 11 range 70, Giant dmg 10 range 400.
 *   - Spawns are x=160 vs x=1240 → 1080 wu apart, so Smash is out of range and Giant
 *     is the only candidate; `lastUsed` starts at -Infinity so it is off cooldown.
 *   - The AI therefore chases to exactly 400 wu and fires Giant Lollipop on the first
 *     tick it is in range. 400 wu = 20 m; the widest guaranteed view half-extent is
 *     14.45 m at 16:9. The caster is off screen BY CONSTRUCTION.
 *
 * Timing: `performance.now` is replaced by a virtual clock (three's `Clock` reads it,
 * and every sim/VFX delta in `match.ts` derives from that clock). Pause it and the
 * whole frame is frozen for as long as a headless screenshot needs; `advance(ms)`
 * steps the effect by an exact number of milliseconds. That removes the "sub-300ms
 * effect already decayed before readback" failure completely.
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
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const mode = args.mode ?? 'incoming';
const outDir = args.outDir ?? `shots/vfx/lollipop/${mode}`;
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const frames = Number(args.frames ?? 14);
const stepMs = Number(args.stepMs ?? 45);
const preMs = Number(args.preMs ?? 0);
const hideHud = args.hideHud === true || args.hideHud === 'true';
const simSpeed = Number(args.simSpeed ?? 1);
const armDist = Number(args.armDist ?? 430);
const waitKey = args.waitFor ?? (mode === 'incoming' ? 'giantSlam' : 'cast');

async function main() {
  await mkdir(outDir, { recursive: true });
  const player = mode === 'incoming' ? (args.player ?? 'donut') : 'lollipop';
  const enemy = mode === 'incoming' ? 'lollipop' : (args.enemy ?? 'donut');

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE error:', m.text()); });
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('!! navigated'); });

    // Other agents are saving into this repo live; a Vite HMR full-reload mid-probe
    // wipes in-page state (PROGRESS.md: one agent lost three sweeps to exactly this).
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
    }));

    // Virtual clock — installed before any app code runs.
    await page.addInitScript(() => {
      const realNow = performance.now.bind(performance);
      let paused = false;
      let virt = 0;
      let base = realNow();
      const now = () => (paused ? virt : realNow() - base);
      window.__clk = {
        pause() { if (!paused) { virt = realNow() - base; paused = true; } },
        resume() { if (paused) { base = realNow() - virt; paused = false; } },
        advance(ms) { virt += ms; },
        now,
      };
      performance.now = now;
    });

    const url = `${BASE}/?player=${player}&enemy=${enemy}${simSpeed !== 1 ? `&simSpeed=${simSpeed}` : ''}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
    if (hideHud) await page.addStyleTag({ content: '#hud,.hud,[data-hud]{display:none!important}' });

    if (mode === 'incoming') {
      // The player does nothing at all. Software rendering runs at a few fps, so the
      // approach is bought with `?simSpeed=` instead of scripted walking — the AI
      // closes from its 1080 wu spawn separation and fires Giant the first tick it is
      // inside 400 wu, standing player, no scripted aiming anywhere.
      if (args.walk) {
        await page.keyboard.down('KeyD');
        await page.waitForFunction(() => {
          const f = window.__vfxDebugFighters;
          return !!f && Math.hypot(f.player.x - f.enemy.x, f.player.y - f.enemy.y) < 620;
        }, null, { timeout: 180000, polling: 25 });
        await page.keyboard.up('KeyD');
      }
    } else {
      await page.waitForFunction(
        () => document.querySelector('.hud-countdown')?.style.display === 'none',
        null, { timeout: 120000 },
      ).catch(() => {});
      await page.keyboard.press(String(args.weapon ?? '2'));
      await page.mouse.move(W * 0.62, H * 0.42);
      await page.waitForTimeout(500);
    }

    // Arm: get close to the trigger, then FREEZE and hand-crank from there. Polling
    // for the effect with the clock running is not good enough at `simSpeed > 1` —
    // one software-rendered frame can advance `50 ms * simSpeed` of effect time, so
    // "the frame the effect fired" can already be several hundred ms old. Freezing
    // first and stepping in `stepMs` slices makes f00 genuinely t≈0.
    if (mode === 'incoming') {
      await page.waitForFunction((d) => {
        const f = window.__vfxDebugFighters;
        return !!f && Math.hypot(f.player.x - f.enemy.x, f.player.y - f.enemy.y) < d;
      }, armDist, { timeout: 240000, polling: 8 });
    }
    await page.evaluate(() => window.__clk.pause());
    if (mode === 'self') await page.mouse.down();

    const baseline = await page.evaluate((k) => window.__vfxQaCounts?.[k] ?? 0, waitKey);
    let armSteps = 0;
    for (; armSteps < 400; armSteps++) {
      const fired = await page.evaluate(
        ([k, b]) => (window.__vfxQaCounts?.[k] ?? 0) > b, [waitKey, baseline]);
      if (fired) break;
      await page.evaluate((ms) => window.__clk.advance(ms), stepMs / simSpeed);
      await page.waitForTimeout(45);
    }
    if (mode === 'self') await page.mouse.up().catch(() => {});
    console.log('armSteps', armSteps);

    const at = await page.evaluate(() => {
      const f = window.__vfxDebugFighters;
      const s = window.__vfxDebugScreen;
      if (!f) return null;
      const d = Math.hypot(f.player.x - f.enemy.x, f.player.y - f.enemy.y);
      return {
        player: { x: Math.round(f.player.x), y: Math.round(f.player.y) },
        enemy: { x: Math.round(f.enemy.x), y: Math.round(f.enemy.y) },
        distanceWU: Math.round(d),
        screen: s,
      };
    });
    console.log('CAST AT', JSON.stringify(at));

    if (preMs > 0) {
      await page.evaluate((ms) => window.__clk.advance(ms), preMs);
      await page.waitForTimeout(60);
    }

    for (let i = 0; i < frames; i++) {
      if (i > 0) {
        // `rawDtSeconds = min(getDelta(), 1/20) * simSpeed`, so a virtual advance of
        // `stepMs / simSpeed` yields exactly `stepMs` of effect time (and stays under
        // the 50 ms clamp as long as stepMs/simSpeed <= 50).
        await page.evaluate((ms) => window.__clk.advance(ms), stepMs / simSpeed);
        // Let a couple of real rAF frames consume the advance and render it.
        await page.waitForTimeout(70);
      }
      await page.screenshot({ path: `${outDir}/f${String(i).padStart(2, '0')}.png`, timeout: 30000 });
    }

    const counts = await page.evaluate(() => ({
      qa: window.__vfxQaCounts ?? null,
      bespokeCast: window.__bespokeVfxDebugCast ?? 0,
      bespokeImpact: window.__bespokeVfxDebugImpact ?? 0,
    }));
    console.log(JSON.stringify({ mode, player, enemy, at, counts, stepMs, frames }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
