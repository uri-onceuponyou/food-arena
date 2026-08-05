#!/usr/bin/env node
/**
 * PER-WEAPON VFX DELIVERY + ABLATION, in one pass.
 *
 * `tools/tmp/vfx_coverage.mjs` answered "how many pixels does each weapon deliver".
 * `tools/tmp/vfx_ablate.mjs` answered "is it buried or is it too small", but only for
 * the ten GENERIC effects. The gap between them is exactly where this round's work
 * is: 33 weapons x 2 paths, twelve of them under the generic path's own numbers, and
 * no way to tell a burial from a sub-perceptual size without opening thirteen files
 * and guessing. `docs/LESSONS.md` §1 says guessing is how you ship a BIGGER invisible
 * effect (three of the five bugs the audit fixed were burial; scaling them would have
 * made them worse).
 *
 * So this fuses the two. Per weapon, per path:
 *
 *   1. fire it, walk the millisecond slice schedule, find the PEAK slice
 *   2. re-fire, step to exactly that peak, and measure four ways:
 *        shipped / +nodepth / +scale4 / +both
 *   3. at the same instant, intersect the changed pixels with a CAST MATTE
 *      (the player model's own pixels, found by hiding it) so "repaints the
 *      fighter it is reporting on" is a number, not an opinion
 *
 *   occlusion = nodepth/shipped  > 1.3  => BURIED (a depth/height/anchor problem)
 *   size      = scale4/shipped   ~ 16   => SUB-PERCEPTUAL (nothing is hiding it)
 *
 * Both knobs are applied AFTER `updateEffects()` and restored before the next
 * measurement — the pooled materials here are the SHIPPED ones and a leaked
 * `depthTest:false` inflated every number in this probe family's first version by
 * 30-45% (LESSONS §13).
 *
 * ── COMPOSITE MODE (`--composite`) ────────────────────────────────────────────
 * `match.ts`'s `weapon-fired` handler does not fire one effect. For a melee weapon it
 * fires `spawnCastFlash` AND `spawnMeleeArc`; for a `giantSlam` weapon it fires those
 * two AND `spawnGiantSlamShockwave`. Every one of those three was authored and
 * measured alone. This mode fires the exact set `match.ts` would, in one frozen
 * frame, so the SUM is measured — which is the thing LESSONS §7 says nobody watches.
 *
 *   node tools/tmp/vfx_wcov.mjs --url <snapshot-url> [--only lollipop] [--shots]
 *   node tools/tmp/vfx_wcov.mjs --url <u> --composite
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
const OUT = args.out ?? 'shots/vfx/wcov';
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
const DELTA = Number(args.delta ?? 6);
/** Coarser than `vfx_coverage.mjs`'s twelve: this run does 4 extra renders at the
 * peak of every case, so the schedule pays for itself twice. Still front-loaded —
 * everything here lives 120-900 ms. */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number)
  : [16, 60, 100, 150, 220, 320, 450, 650, 900]);
const ONLY = args.only ? String(args.only).split(',') : null;
const PLAYER = args.player ?? 'hamburger';
const COMPOSITE = !!args.composite;
/** Fire the slam at a point `--dist` wu away instead of at the player, so the caster
 * is off frame — see the block in `main()` for why that case is load-bearing. */
const OFFSCREEN = !!args.offscreen;

const log = (...a) => console.log(...a);

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
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

    await page.addInitScript(() => {
      const realNow = performance.now.bind(performance);
      let paused = false; let virt = 0; let base = realNow();
      window.__clk = {
        pause() { if (!paused) { virt = realNow() - base; paused = true; } },
        advance(ms) { virt += ms; },
      };
      performance.now = () => (paused ? virt : realNow() - base);
    });

    await page.goto(`${BASE}/?player=${PLAYER}&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: '.hud-countdown{display:none !important}' });
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    // Park the game's own rAF loop so a later `sync()` cannot overwrite the frozen
    // frame between the in-page measurement and Playwright's screenshot — the same
    // instrument fault `vfx_ablate.mjs` documents.
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);

    await page.evaluate(([rw, rh, delta, pid]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas');
      cv.width = rw; cv.height = rh;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      let base = null;
      let layer = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });

      const grab = () => {
        stage.render(0);
        c2.clearRect(0, 0, rw, rh);
        c2.drawImage(stage.canvas, 0, 0, rw, rh);
        return c2.getImageData(0, 0, rw, rh).data;
      };
      const changedIdx = (cur) => {
        const idx = [];
        for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
          const d = Math.max(
            Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
          if (d >= delta) idx.push(p);
        }
        return idx;
      };

      window.__wc = {
        setBase() { base = grab(); },
        count() { return changedIdx(grab()).length; },
        /** Changed count + how much of it lands on the CAST's own pixels. */
        countWithCast() {
          const idx = changedIdx(grab());
          let over = 0;
          for (const p of idx) if (window.__castSet.has(p)) over++;
          let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
          for (const p of idx) {
            const x = p % rw, y = (p / rw) | 0;
            if (x < minx) minx = x; if (x > maxx) maxx = x;
            if (y < miny) miny = y; if (y > maxy) maxy = y;
          }
          return { n: idx.length, over, bbox: idx.length ? [minx, miny, maxx, maxy] : null };
        },
        step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
        reset() { window.__vfxLayer.clear(); },
        /** One ablation variant, fully restored afterwards. */
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
          const n = changedIdx(grab()).length;
          for (const s of saved) {
            if (s.o.material) s.o.material.depthTest = s.dt;
            s.o.scale.set(s.sx, s.sy, s.sz);
            s.o.renderOrder = s.ro;
          }
          return n;
        },
      };

      // ── CAST MATTE, and why it is NOT the obvious "hide it and diff" ──────────
      //
      // `vfx_hue.mjs` builds the matte by hiding the character and taking every pixel
      // that changed. That set is the SILHOUETTE **plus its cast shadow** — hiding a
      // fighter also deletes the shadow it throws on the floor. For a small effect the
      // difference is noise; for a 20 m ground disc it is the whole answer, because a
      // floor-level wash tints the shadow and scores as "repainted the fighter" while
      // the fighter itself is untouched. Measured on the giant slam's 360-degree melee
      // wedge: 72.8% by the hide-diff matte, and the judgement PNG shows a completely
      // readable hamburger. An instrument that says "the character is gone" about a
      // frame where the character is plainly there is LESSONS §13.
      //
      // So the matte is the INTERSECTION of two tests:
      //   (a) the pixel changes when the character is hidden        — it owns it
      //   (b) the pixel turns magenta when every material under
      //       `character:<id>` is repainted flat magenta            — it DRAWS it
      // Shadow pixels pass (a) and fail (b): a shadow is depth-only, so it is
      // byte-identical in both magenta and normal renders. Neither test alone is
      // enough — (a) includes the shadow, and (b) alone over-counts, because the post
      // chain blooms a saturated magenta figure outward (measured: 9,337 magenta px
      // against a 5,255 px hide-diff, i.e. the "silhouette" came out 78% LARGER than
      // the character's whole footprint). Both mattes are reported; the intersection
      // is the one the 1/3 rule is judged on.
      const root = stage.scene.getObjectByName(`character:${pid}`);
      base = grab();
      root.visible = false;
      const hideSet = new Set(changedIdx(grab()));
      root.visible = true;

      // Dedupe by MATERIAL IDENTITY, not by mesh. A rig shares one material across
      // many meshes (every `toonMat` of the same colour is one instance), so a
      // per-mesh save/restore captures the same material several times — and the
      // second capture reads the value the FIRST swap already wrote. Restoring then
      // walks the list and writes magenta back over the original. That shipped for one
      // run: the judgement PNG came out with a magenta-bodied hamburger while the
      // measurement itself looked fine, which is exactly the LESSONS §13 failure
      // (an instrument that lies plausibly is worse than none).
      const seen = new Set();
      const swapped = [];
      root.traverse((o) => {
        if (!o.isMesh && !o.isSprite) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m || seen.has(m)) continue;
          seen.add(m);
          swapped.push({
            m, color: m.color?.getHex(), emissive: m.emissive?.getHex(),
            map: m.map, transparent: m.transparent, opacity: m.opacity,
          });
          m.color?.setHex(0xff00ff);
          m.emissive?.setHex(0x000000);
          m.map = null;
          m.transparent = false;
          m.opacity = 1;
          m.needsUpdate = true;
        }
      });
      const magentaImg = grab();
      for (const s of swapped) {
        if (s.color !== undefined) s.m.color.setHex(s.color);
        if (s.emissive !== undefined) s.m.emissive.setHex(s.emissive);
        s.m.map = s.map;
        s.m.transparent = s.transparent;
        s.m.opacity = s.opacity;
        s.m.needsUpdate = true;
      }
      const sil = new Set();
      let magentaN = 0;
      for (let i = 0, p = 0; i < magentaImg.length; i += 4, p++) {
        // Post chain shifts the exact value, so test the SHAPE of the colour
        // (red+blue high, green low) rather than an exact hex.
        if (magentaImg[i] > 110 && magentaImg[i + 2] > 110 && magentaImg[i + 1] < magentaImg[i] * 0.7) {
          magentaN++;
          if (hideSet.has(p)) sil.add(p);
        }
      }
      window.__castSet = sil;
      window.__castN = sil.size;
      window.__castHideN = hideSet.size;
      window.__castMagentaN = magentaN;
      base = grab();
    }, [RW, RH, DELTA, PLAYER]);

    // ── Instrument self-test (LESSONS §13) ─────────────────────────────────────
    const nullDiff = await page.evaluate(() => { window.__wc.setBase(); return window.__wc.count(); });
    const forced = await page.evaluate(() => {
      window.__wc.setBase();
      const f = window.__vfxDebugFighters.player;
      window.__vfxSpawnTest('impact', f.x, f.y, 30, '#FF00FF');
      const n = window.__wc.measure(true, 4);
      window.__wc.reset();
      return n;
    });
    const castN = await page.evaluate(() => window.__castN);
    const castHideN = await page.evaluate(() => window.__castHideN);
    const castMagentaN = await page.evaluate(() => window.__castMagentaN);
    log(`\n[selftest] frozen baseline vs itself: ${nullDiff} px (want ~0)`);
    log(`[selftest] forced garish impact:       ${forced} px (want >> 0)`);
    log(`[cast matte] drawn silhouette ${castN} px = ${(castN / (RW * RH) * 100).toFixed(2)}% of frame`);
    log(`             hide-diff (silhouette+shadow) ${castHideN} · magenta-only (silhouette+bloom) ${castMagentaN}`);
    if (castN < 500) { log('[selftest] FAIL — silhouette matte implausibly small'); process.exitCode = 1; }
    if (nullDiff > 40 || forced < 400) { log('[selftest] FAIL'); process.exitCode = 1; }

    const weapons = await page.evaluate(async () => {
      const rules = await import('/src/game/rules.ts');
      const reg = await import('/src/vfx/weapons/index.ts');
      const out = [];
      for (const [id, c] of Object.entries(rules.CHARACTERS)) {
        for (const w of c.weapons) {
          const v = reg.getWeaponVfx(id, w.key);
          out.push({
            id, key: w.key, type: w.type, color: w.color, damage: w.damage,
            range: w.range ?? 0, cone: w.cone ?? 0, giantSlam: !!w.giantSlam,
            hooks: v ? Object.keys(v).filter((k) => typeof v[k] === 'function') : [],
          });
        }
      }
      return out;
    });

    /**
     * One measured case. `fires` is a list of `__vfxSpawnTest` argument arrays — one
     * entry for an isolated hook, several for the composite `match.ts` fires.
     */
    const runCase = async (label, fires, opts = {}) => {
      await page.evaluate(() => { window.__wc.reset(); });
      await page.waitForTimeout(20);
      await page.evaluate(() => window.__wc.setBase());
      // Pass 1: find the peak slice.
      const series = await page.evaluate(async ([fs, slices]) => {
        for (const fa of fs) window.__vfxSpawnTest(...fa);
        const out = [];
        let prev = 0;
        for (const t of slices) { window.__wc.step(t - prev); prev = t; out.push(window.__wc.count()); }
        return out;
      }, [fires, SLICES]);
      let peakN = -1, peakMs = 0;
      for (let i = 0; i < series.length; i++) if (series[i] > peakN) { peakN = series[i]; peakMs = SLICES[i]; }
      const FLOOR = 50;
      let life = 0;
      for (let i = 0; i < series.length; i++) if (series[i] >= FLOOR) life = SLICES[i];

      // Pass 2: re-fire and ablate at exactly that peak.
      await page.evaluate(() => { window.__wc.reset(); });
      await page.waitForTimeout(20);
      await page.evaluate(() => window.__wc.setBase());
      const r = await page.evaluate(async ([fs, ms]) => {
        for (const fa of fs) window.__vfxSpawnTest(...fa);
        if (ms > 0) window.__wc.step(ms);
        const c = window.__wc.countWithCast();
        const shipped = c.n;
        const nodepth = window.__wc.measure(true, 1);
        const scale4 = window.__wc.measure(false, 4);
        // leave the SHIPPED look standing for the screenshot
        window.__wc.measure(false, 1);
        return { shipped, nodepth, scale4, over: c.over, bbox: c.bbox };
      }, [fires, peakMs]);

      if (opts.shot) {
        await page.screenshot({ path: `${OUT}/${label.replace(/[^a-z0-9.]+/gi, '_')}.png` });
      }
      await page.evaluate(() => { window.__wc.reset(); });

      const occl = r.shipped > 0 ? r.nodepth / r.shipped : (r.nodepth > 0 ? Infinity : 1);
      const size = r.shipped > 0 ? r.scale4 / r.shipped : (r.scale4 > 0 ? Infinity : 1);
      const castPct = castN ? (r.over / castN) * 100 : 0;
      const row = {
        label, peakPx: r.shipped, peakAtMs: peakMs, lifetimeMs: life,
        nodepthPx: r.nodepth, scale4Px: r.scale4,
        occlusionRatio: +occl.toFixed(2), sizeRatio: +size.toFixed(1),
        castCoveredPct: +castPct.toFixed(1), bbox: r.bbox, series,
      };
      log(`${label.padEnd(30)} ${String(r.shipped).padStart(7)} ${String(r.nodepth).padStart(8)} ${String(r.scale4).padStart(8)}   ${occl.toFixed(2).padStart(6)}x ${size.toFixed(1).padStart(6)}x   ${castPct.toFixed(1).padStart(5)}%  @${String(peakMs).padStart(4)}ms`);
      return row;
    };

    const results = [];
    log(`\nviewport ${W}x${H}  readback ${RW}x${RH}  delta>=${DELTA}  player=${PLAYER}`);
    log(`\n${'case'.padEnd(30)} ${'shipped'.padStart(7)} ${'nodepth'.padStart(8)} ${'scale4'.padStart(8)}   ${'occl'.padStart(7)} ${'size'.padStart(7)}   cast%   peak`);
    log('─'.repeat(104));

    const f = await page.evaluate(() => window.__vfxDebugFighters.player);

    if (OFFSCREEN) {
      // ── THE OFF-SCREEN TELL, and why it is measured HERE ──────────────────────
      //
      // `render/camera.ts` excludes `giantSlam` from the fair-play radius. Covering
      // it would demand ~918 wu instead of 199.2 and shrink every character to a
      // speck, and that exclusion is only legitimate because of one promise, written
      // at the head of `vfx/weapons/lollipop.ts`:
      //
      //      THE GIANT SLAM TELL MUST BE READABLE WITH THE CASTER OFF SCREEN.
      //
      // So any change to what a giant slam draws has to be checked against the case
      // where the caster is NOT in frame — a self-cast measurement says nothing about
      // it. `REACH.ultimateSlam` is 400 wu; the widest guaranteed view half-extent is
      // 289 wu to the side at 16:9, so firing the slam 400 wu from the player puts
      // the caster off frame BY CONSTRUCTION, with no scripted aiming and no waiting
      // on the AI (`tools/tmp/lolliv.mjs` does the same thing through real gameplay
      // and takes minutes; this is the same geometry in one frozen frame).
      //
      // BEFORE and AFTER are both fired here, on the SAME snapshot and the same
      // instrument: `LEGACY-3` reassembles the pre-arbitration stack by hand (bespoke
      // cast + generic 360-degree wedge + generic shockwave) and `FIRED` runs what
      // `spawnWeaponCast` now ships. The tell is what reaches the player, so the
      // number that matters is delivered pixels in a frame the caster is absent from.
      const gw = weapons.find((x) => x.giantSlam);
      const D = Number(args.dist ?? 400);
      const ox = f.x + D, oy = f.y;
      log(`\n[offscreen] slam epicentre at (${Math.round(ox)}, ${Math.round(oy)}) = ${D} wu from the player`);
      log(`[offscreen] guaranteed view half-extent is 289 wu to the side at 16:9, so the caster is off frame\n`);
      results.push(await runCase('OFFSCREEN.LEGACY-3', [
        ['cast', ox, oy, 10, gw.color, gw.id, gw.key],
        ['meleeArc', ox, oy, 10, gw.color, gw.id, gw.key],
        ['giantSlam', ox, oy, 10, gw.color, gw.id, gw.key],
      ], { shot: true }));
      results.push(await runCase('OFFSCREEN.FIRED', [
        ['weaponFired', ox, oy, 10, gw.color, gw.id, gw.key],
      ], { shot: true }));
      results.push(await runCase('OFFSCREEN.only-cast', [
        ['cast', ox, oy, 10, gw.color, gw.id, gw.key],
      ], { shot: true }));
    } else if (!COMPOSITE) {
      results.push(await runCase('GENERIC.cast', [['cast', f.x, f.y, 14, '#FFC93C']], { shot: !!args.shots }));
      results.push(await runCase('GENERIC.impact', [['impact', f.x, f.y, 12, '#FFC93C']], { shot: !!args.shots }));
      for (const w of weapons) {
        if (ONLY && !ONLY.includes(w.id)) continue;
        const dmg = Math.max(1, w.damage || 8);
        const tagC = w.hooks.includes('cast') ? '' : '[gen]';
        const tagI = w.hooks.includes('impact') ? '' : '[gen]';
        results.push(await runCase(`${w.id}.${w.key}.cast${tagC}`, [['cast', f.x, f.y, dmg, w.color, w.id, w.key]], { shot: !!args.shots }));
        results.push(await runCase(`${w.id}.${w.key}.impact${tagI}`, [['impact', f.x, f.y, dmg, w.color, w.id, w.key]], { shot: !!args.shots }));
      }
    } else {
      // Exactly what `match.ts`'s `weapon-fired` handler fires, per weapon — routed
      // through `vfx.ts`'s own `spawnWeaponCast` via `__vfxSpawnTest('weaponFired')`
      // rather than reassembled here, so the probe cannot drift out of step with the
      // game's composition. (It did, in this probe's first version: it fired the melee
      // wedge for `lollipop.Giant` after `spawnWeaponCast` had learned to skip it.)
      for (const w of weapons) {
        if (ONLY && !ONLY.includes(w.id)) continue;
        if (w.type !== 'melee' && !w.giantSlam) continue;
        const dmg = Math.max(1, w.damage || 8);
        results.push(await runCase(`${w.id}.${w.key}.FIRED`,
          [['weaponFired', f.x, f.y, dmg, w.color, w.id, w.key]], { shot: !!args.shots }));
      }
      // A ranged weapon fires the cast beat only — measured so the muzzle anchor's
      // contribution is visible on the path that has no wedge to hide behind.
      for (const w of weapons) {
        if (ONLY && !ONLY.includes(w.id)) continue;
        if (w.type === 'melee' || w.giantSlam) continue;
        const dmg = Math.max(1, w.damage || 8);
        results.push(await runCase(`${w.id}.${w.key}.FIRED`,
          [['weaponFired', f.x, f.y, dmg, w.color, w.id, w.key]], { shot: false }));
      }
      // And the pieces of the giantSlam stack, alone, for attribution.
      const gw = weapons.find((x) => x.giantSlam);
      if (gw && (!ONLY || ONLY.includes(gw.id))) {
        // The pre-arbitration stack, reassembled by hand: bespoke cast + generic
        // 360-degree wedge + generic shockwave, which is what `match.ts` fired for
        // this one weapon before `spawnWeaponCast` existed. Kept as the BEFORE number
        // so the fix is measured against the same instrument, not against the old
        // probe's different cast matte.
        results.push(await runCase(`${gw.id}.${gw.key}.LEGACY-3`, [
          ['cast', f.x, f.y, 10, gw.color, gw.id, gw.key],
          ['meleeArc', f.x, f.y, 10, gw.color, gw.id, gw.key],
          ['giantSlam', f.x, f.y, 10, gw.color, gw.id, gw.key],
        ], { shot: !!args.shots }));
        results.push(await runCase(`${gw.id}.${gw.key}.only-cast`, [['cast', f.x, f.y, 10, gw.color, gw.id, gw.key]], { shot: !!args.shots }));
        results.push(await runCase(`${gw.id}.${gw.key}.only-wedge`, [['meleeArc', f.x, f.y, 10, gw.color, gw.id, gw.key]], { shot: !!args.shots }));
        results.push(await runCase(`${gw.id}.${gw.key}.only-shock`, [['giantSlam', f.x, f.y, 10, gw.color, gw.id, gw.key]], { shot: !!args.shots }));
      }
    }

    await writeFile(`${OUT}/wcov.json`, JSON.stringify({
      base: BASE, viewport: [W, H], readback: [RW, RH], delta: DELTA, slices: SLICES,
      player: PLAYER, castMattePx: castN, castMatteHideDiffPx: castHideN, composite: COMPOSITE,
      selftest: { nullDiff, forced }, results,
    }, null, 1));

    const FLOOR = Number(args.floor ?? 300);
    const gaps = results.filter((r) => r.peakPx < FLOOR && !r.label.startsWith('GENERIC'));
    log(`\n${'═'.repeat(104)}`);
    log(`UNDER FLOOR (${FLOOR} px at ${RW}x${RH}):`);
    if (!gaps.length) log('  none');
    for (const g of gaps) {
      const cause = g.occlusionRatio >= 1.3 ? 'BURIED' : (g.sizeRatio >= 6 ? 'TOO SMALL' : 'neither — washed/absent');
      log(`  x ${g.label.padEnd(30)} ${String(g.peakPx).padStart(6)}px  occl ${g.occlusionRatio}x  size ${g.sizeRatio}x  => ${cause}`);
    }
    const overpaint = results.filter((r) => r.castCoveredPct > 33.3);
    log(`\nREPAINTS > 1/3 OF THE CAST:`);
    if (!overpaint.length) log('  none');
    for (const o of overpaint) log(`  ! ${o.label.padEnd(30)} ${o.castCoveredPct}% of cast, ${o.peakPx}px = ${(o.peakPx / (RW * RH) * 100).toFixed(1)}% of frame`);
    log(`\nwrote ${OUT}/wcov.json`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
