#!/usr/bin/env node
/**
 * VFX COVERAGE MAP — the visual equivalent of the audio audit's "which states have no
 * sound at all" table.
 *
 * For every `GameEvent` kind, every generic effect and every weapon's bespoke
 * `cast`/`impact` hook it answers three questions with numbers:
 *
 *   1. does it SPAWN?            (`window.__vfxQaCounts` before/after)
 *   2. does it reach the SCREEN? (changed pixels vs a frozen baseline frame)
 *   3. how long does it LIVE?    (last millisecond slice still delivering pixels)
 *
 * ── Why it is built the way it is ───────────────────────────────────────────────
 *
 * - **Virtual clock.** Effects here are sub-300 ms and a SwiftShader readback is slow
 *   enough to miss them entirely (`docs/TOOLS.md`, capture gotchas). `performance.now`
 *   is replaced before any app code runs; with it paused every sim/VFX delta in
 *   `match.ts` is exactly 0, so the frame is genuinely frozen and
 *   `__vfxLayer.updateEffects(dt)` can be hand-cranked in exact millisecond slices.
 *   Same technique as `tools/tmp/lolliv.mjs`.
 * - **Never driven through gameplay.** Fighters spawn 1080 wu apart and no weapon
 *   reaches past 140 wu; probes that wait for a real hit time out. Everything fires
 *   through `window.__vfxSpawnTest` / `window.__vfxLayer`.
 * - **Reads the WebGL canvas, not a Playwright screenshot.** `stage.ts` sets
 *   `preserveDrawingBuffer: true`, so `drawImage(canvas)` is exact and ~20x cheaper
 *   than a page screenshot. It also excludes the DOM HUD by construction, which
 *   `docs/TOOLS.md` records as having silently contaminated "canvas only" captures.
 * - **Instrument validated against known inputs before it is believed** (`LESSONS`
 *   §13): `--selftest` asserts baseline-vs-baseline is ~0 changed pixels and that a
 *   deliberately enormous forced flash reports a large count.
 *
 * Usage:
 *   node tools/tmp/vfx_coverage.mjs --url <snapshot-url> --out shots/vfx/coverage
 *   node tools/tmp/vfx_coverage.mjs --url <u> --mode generic|weapons|sim|all
 *   node tools/tmp/vfx_coverage.mjs --url <u> --warm 200      # pool-wrap mode
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

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
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = args.out ?? 'shots/vfx/coverage';
const MODE = args.mode ?? 'all';
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
/** Readback resolution. Half the render size: 4x less pixel work per sample and still
 * well inside the sensitivity needed (a thin 1600-wide streak is ~2 px wide here). */
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Per-pixel change threshold, 0-255 on the largest channel. 6 is ~2.4% and sits far
 * above the frozen frame's own noise floor (measured 0 changed pixels by --selftest). */
const DELTA = Number(args.delta ?? 6);
/** Millisecond slices. Front-loaded — most effects here live 160-350 ms. */
const SLICES = (args.slices
  ? String(args.slices).split(',').map(Number)
  : [16, 33, 60, 100, 150, 220, 320, 450, 650, 900, 1250, 1700]);
const WARM = Number(args.warm ?? 0);

const log = (...a) => console.log(...a);

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
    page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });

    // A peer saving into this repo triggers a Vite full reload that wipes in-page
    // state mid-probe. Stub the HMR client (docs/TOOLS.md).
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
      let paused = false; let virt = 0; let base = realNow();
      const now = () => (paused ? virt : realNow() - base);
      window.__clk = {
        pause() { if (!paused) { virt = realNow() - base; paused = true; } },
        resume() { if (paused) { base = realNow() - virt; paused = false; } },
        advance(ms) { virt += ms; },
      };
      performance.now = now;
    });

    // simSpeed tiny: the sim must not advance under the measurement (no real hits, no
    // fog ticks, no ring closing). The countdown overlay never clears at this speed —
    // it is DOM, so it cannot reach the canvas readback, but hide it anyway so the
    // judgement PNGs are clean.
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: '.hud-countdown{display:none !important}' });
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);

    // ── In-page measurement harness ────────────────────────────────────────────
    await page.evaluate(([rw, rh, delta]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas');
      cv.width = rw; cv.height = rh;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      let base = null;

      const grab = () => {
        stage.render(0);
        ctx.clearRect(0, 0, rw, rh);
        ctx.drawImage(stage.canvas, 0, 0, rw, rh);
        return ctx.getImageData(0, 0, rw, rh).data;
      };

      window.__cov = {
        setBase() { base = grab(); return base.length; },
        /** Changed-pixel count plus the bbox of the change, so an effect that lands
         * somewhere unexpected (behind a prop, off camera) is visible in the numbers
         * rather than only in a PNG nobody opens. */
        diff() {
          const cur = grab();
          let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, sum = 0;
          for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
            const d = Math.max(
              Math.abs(cur[i] - base[i]),
              Math.abs(cur[i + 1] - base[i + 1]),
              Math.abs(cur[i + 2] - base[i + 2]),
            );
            if (d >= delta) {
              n++; sum += d;
              const x = p % rw, y = (p / rw) | 0;
              if (x < minx) minx = x; if (x > maxx) maxx = x;
              if (y < miny) miny = y; if (y > maxy) maxy = y;
            }
          }
          return { n, meanDelta: n ? +(sum / n).toFixed(1) : 0, bbox: n ? [minx, miny, maxx, maxy] : null };
        },
        step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
        counts() { return JSON.parse(JSON.stringify(window.__vfxQaCounts ?? {})); },
        reset() { window.__vfxLayer.clear(); },
        /** Live opacity/visibility census of every object under `vfx_layer`, so
         * "spawned but invisible" and "never spawned" are never confused. */
        census() {
          let layer = null;
          stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
          if (!layer) return null;
          let visible = 0, hidden = 0, zeroOpacity = 0, total = 0;
          layer.traverse((o) => {
            if (!o.isMesh && !o.isSprite) return;
            total++;
            if (!o.visible) { hidden++; return; }
            const m = o.material;
            const op = Array.isArray(m) ? m[0]?.opacity : m?.opacity;
            if (m && m.transparent && (op ?? 1) <= 0.004) { zeroOpacity++; return; }
            visible++;
          });
          return { total, visible, hidden, zeroOpacity };
        },
      };
    }, [RW, RH, DELTA]);

    // ── Instrument self-test (LESSONS §13: validate against a KNOWN input) ──────
    await page.evaluate(() => window.__cov.setBase());
    const nullDiff = await page.evaluate(() => window.__cov.diff());
    const forced = await page.evaluate(() => {
      // A deliberately unmissable input: a huge opaque magenta sprite dead centre of
      // the player, depth-test off. If the counter cannot see THIS it cannot see
      // anything, and every zero below would be an instrument fault, not a finding.
      const stage = window.__stage;
      const f = window.__vfxDebugFighters.player;
      // Fire a real impact through the shipped path, then force everything it made
      // to full opacity / no depth test — an unmissable input built out of the
      // layer's own pool, so no three import is needed here.
      window.__vfxSpawnTest('impact', f.x, f.y, 30, '#FF00FF');
      let layer = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });
      // Save/restore is not optional here. These are POOLED materials the shipped
      // game reuses forever; `clear()` resets `active`/`visible` and nothing else,
      // so a `depthTest = false` written here would silently persist into every
      // measurement that follows and inflate it. That is exactly the
      // "the harness inverts the thing you are measuring" failure of LESSONS §13,
      // and it was live in this probe's first run.
      const saved = [];
      layer.traverse((o) => {
        if (!o.isSprite && !o.isMesh) return;
        if (!o.visible) return;
        saved.push({ o, depthTest: o.material?.depthTest, renderOrder: o.renderOrder });
        if (o.material) { o.material.opacity = 1; o.material.depthTest = false; o.material.color?.set('#FF00FF'); }
        o.renderOrder = 999;
      });
      const d = window.__cov.diff();
      for (const s of saved) {
        if (s.o.material) s.o.material.depthTest = s.depthTest;
        s.o.renderOrder = s.renderOrder;
      }
      return d;
    });
    await page.evaluate(() => window.__cov.reset());
    log(`\n[selftest] frozen baseline vs itself: ${nullDiff.n} changed px (want ~0)`);
    log(`[selftest] forced garish impact:       ${forced.n} changed px (want >> 0)`);
    if (args.selftest) {
      const ok = nullDiff.n <= 40 && forced.n > 400;
      log(ok ? '[selftest] PASS' : '[selftest] FAIL');
      await browser.close();
      process.exit(ok ? 0 : 1);
    }

    // ── The measurement ────────────────────────────────────────────────────────
    /**
     * One case = fire, then walk the slice schedule recording changed pixels.
     * Everything is re-baselined per case because a previous case can leave a
     * long-lived mark (the impact star decal outlives its flash by design).
     */
    const runCase = async (label, fireArgs, opts = {}) => {
      await page.evaluate(() => window.__cov.reset());
      await page.waitForTimeout(30);
      // Warm the pools first when asked: fire N complete effects and run each to
      // death, so the next spawn is handed a slot whose material a previous
      // occupant already faded to zero. This is the ONLY way to catch the
      // "never read initial state off a pooled material" defect (LESSONS §12) —
      // it is invisible in the first second of any probe.
      if (opts.warm) {
        await page.evaluate(([fa, n]) => {
          for (let i = 0; i < n; i++) {
            window.__vfxSpawnTest(...fa);
            for (let s = 0; s < 30; s++) window.__vfxLayer.updateEffects(0.06);
          }
        }, [fireArgs, opts.warm]);
      }
      await page.evaluate(() => window.__cov.setBase());
      const before = await page.evaluate(() => window.__cov.counts());
      await page.evaluate((fa) => window.__vfxSpawnTest(...fa), fireArgs);
      const after = await page.evaluate(() => window.__cov.counts());
      const spawnedKinds = Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0));
      const census = await page.evaluate(() => window.__cov.census());

      const series = [];
      let prev = 0;
      for (const t of SLICES) {
        await page.evaluate((ms) => window.__cov.step(ms), t - prev);
        prev = t;
        const d = await page.evaluate(() => window.__cov.diff());
        series.push({ t, ...d });
      }
      let peak = { n: -1, t: 0 };
      for (const s of series) if (s.n > peak.n) peak = s;
      // Lifetime = last slice still above the visibility floor.
      const FLOOR = 50;
      let life = 0;
      for (const s of series) if (s.n >= FLOOR) life = s.t;
      const row = {
        label, spawnedKinds, census,
        peakPx: peak.n, peakAtMs: peak.t, lifetimeMs: life,
        meanDelta: peak.meanDelta, bbox: peak.bbox,
        series: series.map((s) => s.n),
      };
      log(`${label.padEnd(34)} spawn=${(spawnedKinds.join('+') || 'NONE').padEnd(14)} peak=${String(peak.n).padStart(6)}px @${String(peak.t).padStart(4)}ms  life=${String(life).padStart(4)}ms  meanΔ=${String(peak.meanDelta).padStart(5)}`);
      return row;
    };

    const results = [];
    const f = await page.evaluate(() => window.__vfxDebugFighters.player);
    log(`\nplayer at (${Math.round(f.x)}, ${Math.round(f.y)})  viewport ${W}x${H}  readback ${RW}x${RH}  delta>=${DELTA}\n`);
    log('── GENERIC EFFECTS ' + '─'.repeat(60));

    if (MODE === 'all' || MODE === 'generic') {
      results.push(await runCase('generic.cast', ['cast', f.x, f.y, 14, '#FFC93C']));
      results.push(await runCase('generic.impact(dmg 6)', ['impact', f.x, f.y, 6, '#FFC93C']));
      results.push(await runCase('generic.impact(dmg 18)', ['impact', f.x, f.y, 18, '#FFC93C']));
      results.push(await runCase('generic.death', ['death', f.x, f.y, 14, '#E63946']));
      results.push(await runCase('generic.heal', ['heal', f.x, f.y, 14, '#6FE0A8']));
      results.push(await runCase('generic.meleeArc', ['meleeArc', f.x, f.y, 12, '#FFC93C', 'hamburger', 'Smash']));
      results.push(await runCase('generic.giantSlam', ['giantSlam', f.x, f.y, 10, '#E63946', 'lollipop', 'Giant']));
      results.push(await runCase('generic.puddleSplash', ['puddleSplash', f.x, f.y]));
      log('\n── POOL-WRAP SAFETY (fire 200 full effects first, then measure) ' + '─'.repeat(15));
      results.push(await runCase('POOLWARM.cast x200', ['cast', f.x, f.y, 14, '#FFC93C'], { warm: 200 }));
      results.push(await runCase('POOLWARM.impact x200', ['impact', f.x, f.y, 18, '#FFC93C'], { warm: 200 }));
      results.push(await runCase('POOLWARM.heal x200', ['heal', f.x, f.y, 14, '#6FE0A8'], { warm: 200 }));
      results.push(await runCase('POOLWARM.puddleSplash x200', ['puddleSplash', f.x, f.y], { warm: 200 }));
      results.push(await runCase('POOLWARM.meleeArc x200', ['meleeArc', f.x, f.y, 12, '#FFC93C', 'hamburger', 'Smash'], { warm: 200 }));
      results.push(await runCase('POOLWARM.death x200', ['death', f.x, f.y, 14, '#E63946'], { warm: 200 }));
    }

    if (MODE === 'all' || MODE === 'weapons') {
      log('\n── PER-WEAPON BESPOKE HOOKS ' + '─'.repeat(52));
      const weapons = await page.evaluate(async () => {
        const rules = await import('/src/game/rules.ts');
        const reg = await import('/src/vfx/weapons/index.ts');
        const out = [];
        for (const [id, c] of Object.entries(rules.CHARACTERS)) {
          for (const w of c.weapons) {
            const v = reg.getWeaponVfx(id, w.key);
            out.push({
              id, key: w.key, type: w.type, color: w.color, damage: w.damage,
              hooks: v ? Object.keys(v).filter((k) => typeof v[k] === 'function') : [],
            });
          }
        }
        return out;
      });
      await writeFile(`${OUT}/weapons.json`, JSON.stringify(weapons, null, 1));
      for (const w of weapons) {
        const dmg = Math.max(1, w.damage || 8);
        if (w.hooks.includes('cast') || MODE === 'all') {
          results.push(await runCase(`${w.id}.${w.key}.cast${w.hooks.includes('cast') ? '' : '[gen]'}`,
            ['cast', f.x, f.y, dmg, w.color, w.id, w.key]));
        }
        results.push(await runCase(`${w.id}.${w.key}.impact${w.hooks.includes('impact') ? '' : '[gen]'}`,
          ['impact', f.x, f.y, dmg, w.color, w.id, w.key]));
      }
    }

    if (MODE === 'all' || MODE === 'sim') {
      log('\n── SIM-OWNED POOLS + STATUS TELEGRAPHS (driven through sync()) ' + '─'.repeat(16));
      const simCases = [
        // Projectiles are measured at an OFFSET from the player and for BOTH paths.
        // The first version of this probe fired one at the fighter's exact position
        // with a weapon that happens to own a bespoke `projectile()` hook, measured
        // 0 px, and would have reported a false gap: `PROJECTILE_HEIGHT` is 0.5 m
        // against a 2.1 m character, so a projectile spawned on the fighter is
        // inside the fighter. Suspect the probe's setup before the game
        // (docs/LESSONS.md §10).
        ['sim.projectile.generic(soup.Splash)', 'proj:soup:Splash:60'],
        ['sim.projectile.generic(waterbottle.Cap)', 'proj:waterbottle:Cap:60'],
        ['sim.projectile.bespoke(hamburger.Tomato)', 'proj:hamburger:Tomato:60'],
        ['sim.projectile.bespoke(donut.Candy)', 'proj:donut:Candy:60'],
        ['sim.projectile.bespoke(sushi.Rice)', 'proj:sushi:Rice:60'],
        ['sim.projectile.bespoke(egg.Hatch)', 'proj:egg:Hatch:60'],
        ['sim.projectile.onFighter(soup.Splash)', 'proj:soup:Splash:0'],
        ['sim.splat', 'splat'],
        ['sim.trailMark(player)', 'trailPlayer'],
        ['sim.trailMark(enemy)', 'trailEnemy'],
        ['sim.slow(ring+tint)', 'slow'],
        ['sim.stun(stars)', 'stun'],
      ];
      for (const [label, kind] of simCases) {
        await page.evaluate(() => window.__cov.reset());
        await page.evaluate(() => window.__cov.setBase());
        const d = await page.evaluate(async (k) => {
          const rules = await import('/src/game/rules.ts');
          const fi = window.__vfxDebugFighters;
          const mk = (role, over) => ({
            characterId: role === 'player' ? 'hamburger' : 'donut',
            x: fi[role].x, y: fi[role].y, hp: 100, maxHp: 100, alive: true,
            facing: { x: 1, y: 0 }, terrainSlowFactor: 1,
            status: { slowedUntil: 0, stunnedUntil: 0 },
            ...over,
          });
          const st = {
            elapsed: 1000, projectiles: [], splats: [], trailMarks: [],
            player: mk('player'), enemy: mk('enemy'),
          };
          if (k.startsWith('proj:')) {
            const [, cid, wkey, offs] = k.split(':');
            st.player.characterId = cid;
            const w = rules.CHARACTERS[cid].weapons.find((x) => x.key === wkey);
            st.projectiles = [{
              id: 1, x: fi.player.x + Number(offs), y: fi.player.y, vx: 1, vy: 0,
              color: w.color, damage: w.damage, weapon: w, ownerRole: 'player', arrived: false,
            }];
            // Bespoke projectiles are built once by `projectile()` and then animated
            // by `trail()` on every later sync; one sync alone can leave a hook that
            // does its opacity/scale work in `trail()` looking dead. Sync twice.
            window.__vfxLayer.sync(st);
            st.elapsed = 1050;
            window.__vfxLayer.sync(st);
            window.__vfxLayer.updateEffects(0.05);
            return window.__cov.diff();
          }
          if (k === 'splat') st.splats = [{ id: 1, x: fi.player.x, y: fi.player.y }];
          if (k === 'trailPlayer') st.trailMarks = [{ id: 1, x: fi.player.x, y: fi.player.y, ownerRole: 'player' }];
          if (k === 'trailEnemy') st.trailMarks = [{ id: 1, x: fi.player.x, y: fi.player.y, ownerRole: 'enemy' }];
          if (k === 'slow') st.player.terrainSlowFactor = 0.5;
          if (k === 'stun') st.player.status.stunnedUntil = 99999;
          window.__vfxLayer.sync(st);
          return window.__cov.diff();
        }, kind);
        log(`${label.padEnd(34)} peak=${String(d.n).padStart(6)}px  meanΔ=${String(d.meanDelta).padStart(5)}  bbox=${JSON.stringify(d.bbox)}`);
        results.push({ label, peakPx: d.n, meanDelta: d.meanDelta, bbox: d.bbox, lifetimeMs: 'persistent' });
      }
      await page.evaluate(() => window.__cov.reset());
    }

    await writeFile(`${OUT}/coverage.json`, JSON.stringify({
      base: BASE, viewport: [W, H], readback: [RW, RH], delta: DELTA, slices: SLICES,
      selftest: { nullDiff: nullDiff.n, forced: forced.n }, results,
    }, null, 1));

    // ── The named gaps ─────────────────────────────────────────────────────────
    const FLOOR = 50;
    const gaps = results.filter((r) => (r.peakPx ?? 0) < FLOOR);
    log(`\n${'═'.repeat(80)}`);
    log(`ZERO/NEAR-ZERO DELIVERY (< ${FLOOR} px at ${RW}x${RH}):`);
    if (!gaps.length) log('  none — every case measured above the floor');
    for (const g of gaps) log(`  ✗ ${g.label}  peak=${g.peakPx}px  spawned=${(g.spawnedKinds ?? []).join('+') || 'n/a'}  census=${JSON.stringify(g.census)}`);
    log(`\nwrote ${OUT}/coverage.json`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
