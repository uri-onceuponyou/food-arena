#!/usr/bin/env node
/**
 * TG_TELE — the SUSTAIN meter for cast telegraphs.
 *
 * ## The question, and why `vfx_wcov.mjs` cannot answer it
 *
 * `vfx_wcov.mjs` walks a millisecond slice schedule and reports the **PEAK** slice. That
 * is the right statistic for every effect that existed when it was written, because they
 * all live 120-900 ms and a player either sees the peak or sees nothing.
 *
 * A CAST TELEGRAPH is the first effect here that has to be legible for its WHOLE
 * duration. Its entire authorised purpose is *"a telegraph you can dodge"* — a player
 * who cannot see it at 400 ms into an 1100 ms wind-up has no decision to make, however
 * bright it got at 90 ms. And a peak-only instrument is blind to exactly that:
 *
 *   > The standing finding this file exists under (`docs/LESSONS.md`, `pj_probe`): a
 *   > bespoke sculpt delivered **36 px against the generic path's 686** — one nineteenth
 *   > of the area — at a perfectly respectable 18.8 degrees of hue. **A telegraph can be
 *   > authored, correct, and effectively invisible.** A version of that failure with a
 *   > GOOD peak and a 150 ms decay would read as a pass on every tool in this repo.
 *
 * So this reports the **MINIMUM** slice across `[0, castMs]`, and the count of slices
 * under floor. Peak is printed too, purely so the gap between them is visible.
 *
 * ## The floor, and where it came from
 *
 *   >  >= 1,500 px at 800x450 readback, at EVERY 100 ms slice of the cast.
 *
 * Derived, not chosen: `game/vfx.ts` sets the one-shot cast floor at 300 px (the generic
 * flash delivers 735) and records ordinary composited melee at **5,447-11,648 px**. 1,500
 * is deliberately *below* what the shipped wedge already delivers at its peak, because
 * this is not a new art target — **the requirement that bites is SUSTAIN**, and nothing
 * measured it before.
 *
 * ## THE KNOWN-BAD, and it is the shipped code
 *
 * `game/vfx.ts:spawnMeleeArc` sets `maxLife = 0.3` and `updateEffects` fades every pooled
 * wedge on `startOpacity * (1 - t^1.8)`. Run that against an 1100 ms cast and the
 * telegraph is **gone for the last 800 ms** — 9 of the 12 slices at zero. Arm KB below
 * fires exactly that, through the shipped `__vfxSpawnTest('meleeArc')` path, and this
 * tool FAILS ITSELF if it does not report **>= 8 slices under floor** for it.
 *
 * That is the whole point: an instrument that has not been shown to FAIL on the bug it
 * guards against is not a guard (`docs/AGENT-BRIEF.md` §4.4), and here the bug is not a
 * caricature — it is what shipped, measured on the real path.
 *
 * ## The other arms
 *
 *   KB      known-bad, above. MUST report >= 8 slices under floor.
 *   GEN     the generic telegraph with NO bespoke hook (a synthetic melee weapon on a
 *           character that has no `telegraph()`), so the bespoke half's contribution is
 *           attributable rather than assumed.
 *   MEGA    `waterbottle.Mega` — generic footprint + the bespoke four-beat gesture.
 *   SLAM    `lollipop.Giant`'s 400 wu / 360 deg footprint at castMs 1500. Measured
 *           because `game/vfx.ts` already records that a 400 wu wedge is *twice the
 *           radius the camera guarantees is visible* and washes 73% of the frame. If the
 *           telegraph inherits that, it is a finding, not a pass.
 *   ABL     ABLATION. Every telegraph mesh forced to magenta with depth test off. The
 *           frame MUST move. *"It isn't there" means it IS there and is INVISIBLE* is
 *           true twenty times in this repo; a zero row is only trustworthy once an
 *           unmissable version of the same object has been shown to paint.
 *   PAIR    SELF-PAIR. The same case fired twice must agree. Two runs that disagree mean
 *           the readback is measuring something that is not the effect.
 *   CANCEL  the interrupt read: fire, run to 45% of the cast, cancel with reason 'stun',
 *           and require the frame to CHANGE and then fall to ~0. A cancel nobody can see
 *           is not counterplay — an applied stun is the only thing that cancels a cast,
 *           so its feedback is load-bearing.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/tg_tele.mjs --url '{URL}'
 *   ... --shots        also writes the judgement PNGs (READ THEM)
 *   ... --pitch 20     ⚠️ **DOES NOT WORK, AND IS LEFT HERE SAYING SO.**
 *
 * 🚨 `--pitch` sets `CameraRig.pitchDeg` and nothing else, and that is not enough.
 * `render/camera.ts` derives the camera's DISTANCE from its pitch and the fair-play
 * radius, so overwriting the angle alone drops the camera into the arena — the rendered
 * sheet at `--pitch 20` is a **flat yellow field**, i.e. the inside of a prop, and every
 * arm reads 0 px including the ablation. That is an instrument fault and it presents
 * exactly like the finding this tool exists to catch ("the telegraph is invisible"), so
 * the arm below names it explicitly instead of reporting a zero.
 *
 * Doing it properly means re-deriving the rig's framing, which lives in a file this
 * agent does not own. **So the two-camera rule is HALF SATISFIED here: everything below
 * is measured at the shipped match pitch of 58, and the shallow lobby-style read is
 * UNVERIFIED.** Stated, not papered over.
 *
 * ⚠️ Never point this at `:5173`. ⚠️ `--selftest` validates LOGIC, never where a tool is
 * POINTED — arms ABL and PAIR are here because of that.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve as pathResolve } from 'node:path';

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
const BASE = args.url ?? process.env.PREVIEW_BASE ?? null;
if (!BASE) { console.error('tg_tele: no --url and no PREVIEW_BASE. Refusing to guess (:5173 is banned).'); process.exit(2); }
/**
 * 🚨 ABSOLUTE, AND PRINTED. A relative `shots/` lands under whatever directory the
 * shell happened to be in — and this tool is normally launched through `sx_snap.mjs`
 * pointed at a DETACHED WORKTREE, so `cd`-ing there to run `tsc` first silently moved
 * every PNG to `/tmp/fa-<x>/shots/` while a stale sheet from the previous run sat in
 * the repo looking current. One round of judgement was very nearly spent on the
 * pre-fix images that way; the timestamps caught it, nothing else would have.
 */
const OUT = pathResolve(args.out ?? 'shots/vfx/tg');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);           // 800
const RH = Math.round(H / 2);           // 450
const DELTA = Number(args.delta ?? 6);  // same changed-pixel threshold as vfx_wcov
const FLOOR = Number(args.floor ?? 1500);
/**
 * The BESPOKE-ONLY floor, and it is deliberately the SAME number as the total floor.
 *
 * Not a second, softer target. The whole reason the bespoke hooks exist is that the
 * generic footprint alone plateaued in critique, and the whole reason this arm exists
 * is `pj_probe`'s finding that an authored sculpt can deliver **36 px against a
 * generic path's 686** and still be correct code at a respectable hue. A bespoke half
 * that cannot clear the same bar the generic half clears is decoration: the player is
 * reacting to the wedge, and the character-specific gesture is costing draw calls to
 * say nothing. Stated up front, before the numbers, exactly as CLAUDE.md rule 10 asks.
 *
 * ⚠️ It is NOT applied to rows with no bespoke hook (GEN) or to the payoff rows
 * (DUMP), and the verdict block asserts the set it runs over is non-empty first —
 * `[].every()` is `true`, and that vacuity fired three times in three files here.
 */
const BFLOOR = Number(args.bfloor ?? 1500);
const STEP = Number(args.step ?? 100);
const PLAYER = args.player ?? 'waterbottle';
const PITCH = args.pitch ? Number(args.pitch) : null;
const SHOTS = !!args.shots;

const log = (...a) => console.log(...a);
const fail = [];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
    page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });

    // Vite's HMR client would reload the page under the measurement.
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
    }));

    // Virtual clock, installed before any app code runs.
    await page.addInitScript(() => {
      const realNow = performance.now.bind(performance);
      let paused = false; let virt = 0; const base = realNow();
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
    // 🚨 CSS animations run on the DOCUMENT timeline, not rAF, so freezing rAF does not
    // still them — and a canvas screenshot is a page capture clipped to the canvas box.
    // Nothing here reads the HUD, but the PNGs do.
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none !important;transition:none !important}' });
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);

    if (PITCH !== null) {
      const got = await page.evaluate((p) => {
        const rig = window.__stage?.cameraRig ?? window.__stage?.rig ?? null;
        if (!rig || typeof rig.pitchDeg !== 'number') return null;
        rig.pitchDeg = p;
        return rig.pitchDeg;
      }, PITCH);
      log(got === null ? `pitch: NO RIG HANDLE — camera stayed at shipped 58` : `pitch: re-pitched to ${got}`);
    }

    // ── The page-side harness ────────────────────────────────────────────────────
    await page.evaluate(([rw, rh, delta]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas');
      cv.width = rw; cv.height = rh;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      let base = null;
      let layer = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layer = o; });

      const grab = () => {
        // 🚨 A frozen frame is not a frozen camera. The shake integrator holds at dt=0
        // since it was fixed, but a shake still ALIVE from an earlier hit would offset
        // every capture; zero it so base and slice describe one camera.
        const rig = stage.cameraRig ?? stage.rig;
        if (rig && rig.shakeOffset) { rig.shakeOffset.set(0, 0, 0); rig.shakeAmount = 0; }
        stage.render(0);
        c2.clearRect(0, 0, rw, rh);
        c2.drawImage(stage.canvas, 0, 0, rw, rh);
        return c2.getImageData(0, 0, rw, rh).data;
      };
      const changed = (cur) => {
        let n = 0;
        for (let i = 0; i < cur.length; i += 4) {
          const d = Math.max(
            Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
          if (d >= delta) n++;
        }
        return n;
      };

      window.__tg = {
        setBase() { base = grab(); },
        count() { return changed(grab()); },
        step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
        reset() { window.__vfxLayer.clear(); },
        cancel(reason) { window.__vfxLayer.cancelCastTelegraph(0, reason); },
        /** How many meshes named `castTelegraph*` / `mega*` / `tele*` are live in the
         * VFX layer. A pixel count of zero is ambiguous between "nothing spawned" and
         * "it spawned and is invisible"; this disambiguates without looking at a pixel.
         *
         * 🚨 `tele*` WAS ADDED WHEN THE OTHER FIVE ULTIMATES LANDED, AND FORGETTING IT
         * WOULD HAVE BEEN A SILENT VACUITY. `waterbottle.Mega`'s meshes are named
         * `mega*`; the five conversions after it use `tele<Character>*`. Without this
         * line every bespoke mesh they build would have counted as neither bucket,
         * `census.bespoke` would have read 0, `ablate()` would have found nothing to
         * swap — and the assertions below that FILTER on those numbers would each have
         * been asserting over an empty set, which `[].every()` reports as a pass.
         * Hence the non-empty guards in the verdict block. */
        census() {
          let telegraph = 0; let bespoke = 0; let unnamed = 0;
          layer.traverse((o) => {
            if (!o.isMesh) return;
            if (!o.name) { unnamed++; return; }
            if (o.name.startsWith('castTelegraph')) telegraph++;
            else if (o.name.startsWith('mega') || o.name.startsWith('tele')) bespoke++;
          });
          return { telegraph, bespoke, unnamed };
        },
        /**
         * DELIVERED PIXELS OF THE BESPOKE SCULPT ALONE.
         *
         * The standing finding this whole tool exists under is an AREA one, not a hue
         * one: a bespoke sculpt delivered **36 px against the generic path's 686** at a
         * perfectly respectable 18.8° of hue (`pj_probe`). The total slice cannot see
         * that, because `game/vfx.ts`'s generic footprint is underneath every one of
         * these rows and clears the floor by itself for a melee cast — so a bespoke
         * half worth 36 px and one worth 6,000 px produce nearly the same total.
         *
         * Hiding the generic layers and re-reading against the SAME base is the
         * attribution. It is measured at the same instant as the total it is compared
         * against; the ablation arm's own header records what happens when a probe
         * compares two different moments of a changing effect under one threshold.
         */
        bespokeOnly() {
          const hidden = [];
          layer.traverse((o) => {
            if (!o.isMesh || !o.visible) return;
            if (!o.name.startsWith('castTelegraph')) return;
            o.visible = false;
            hidden.push(o);
          });
          const px = changed(grab());
          for (const o of hidden) o.visible = true;
          return { px, hidden: hidden.length };
        },
        /**
         * THE HIDE TEST — the same question the ablation arm asks, asked the other way
         * round, and it is IMMUNE TO THE POST CHAIN in a way the ablation arm is not.
         *
         * Ablation asserts `magenta >= shipped`: force every named mesh to an
         * unmissable colour and it must paint at least as much. That is sound only if
         * repainting cannot LOSE pixels — and it can, because `render/stage.ts` runs a
         * bloom pass. A bright additive highlight spreads changed pixels well past its
         * own geometry; flat magenta at the same coverage does not. So a healthy effect
         * whose identity is carried by bright additive elements can ablate BELOW its
         * shipped reading with nothing wrong.
         *
         * Hiding cannot have that asymmetry. If every mesh that painted is addressed by
         * these names, hiding all of them must return the frame to the base — bloom and
         * all, because the source of the bloom is gone too. A non-zero remainder is
         * exactly the finding the ablation arm was reaching for: something is on screen
         * that these names do not address.
         */
        hideAll() {
          const hidden = [];
          layer.traverse((o) => {
            if (!o.isMesh || !o.visible) return;
            if (!(o.name.startsWith('castTelegraph') || o.name.startsWith('mega') || o.name.startsWith('tele'))) return;
            o.visible = false;
            hidden.push(o);
          });
          const px = changed(grab());
          for (const o of hidden) o.visible = true;
          return { px, hidden: hidden.length };
        },
        /** Ablate every telegraph/bespoke mesh to magenta with depth test off, count,
         * then restore. Materials are saved BY IDENTITY, not per mesh: `vfx/weapons/*`
         * hands out materials from round-robin pools, so one material can sit on
         * several meshes and a per-mesh save/restore leaks `depthTest:false` into a
         * module-level pool permanently — the exact fault `vfx_wcov`'s own header
         * records inflating this probe family by 30-45%. */
        ablate() {
          // ⚠️ MEASURED AT THIS INSTANT, AND COMPARED AGAINST THIS INSTANT. The first
          // version compared the ablated count against the case's PEAK slice — two
          // different moments of a changing effect, i.e. two incommensurable numbers
          // under one threshold, which is the instrument fault CLAUDE.md rule 6 names
          // explicitly. It fired a fault on a healthy effect.
          const before = changed(grab());
          const saved = [];
          const seen = new Set();
          layer.traverse((o) => {
            if (!o.isMesh || !o.visible) return;
            if (!(o.name.startsWith('castTelegraph') || o.name.startsWith('mega') || o.name.startsWith('tele'))) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              if (!m || seen.has(m)) continue;
              seen.add(m);
              saved.push({ m, dt: m.depthTest, hex: m.color.getHex(), op: m.opacity, bl: m.blending });
              m.depthTest = false; m.color.setHex(0xff00ff); m.opacity = 1; m.blending = 0;
            }
          });
          const n = changed(grab());
          for (const s of saved) { s.m.depthTest = s.dt; s.m.color.setHex(s.hex); s.m.opacity = s.op; s.m.blending = s.bl; }
          return { px: n, before, mats: saved.length };
        },
        /**
         * 🚨 THIS MUST RENDER. The first version returned `canvas.toDataURL()` straight
         * out, and `step()` only advances the clock and `updateEffects` — it never draws.
         * So every "judgement PNG" was whatever frame happened to be in the backbuffer,
         * which was the ABLATION frame from the measurement pass: five sheets of a
         * magenta wedge, on a run whose numbers were correct. Read the PNG and LOOK at
         * it is this project's most-broken rule, and this is why: the pixels were real,
         * they were just of something else.
         */
        shot() { grab(); return stage.canvas.toDataURL('image/png'); },
      };
    }, [RW, RH, DELTA]);

    const f = await page.evaluate(() => window.__vfxDebugFighters.player);
    log(`caster at (${f.x.toFixed(1)}, ${f.y.toFixed(1)})  readback ${RW}x${RH}  delta ${DELTA}  floor ${FLOOR}px  step ${STEP}ms`);
    log(`OUT ${OUT}\n`);

    /**
     * One measured case.
     *
     * `fire` is a `__vfxSpawnTest` argument array. Slices run `[0, STEP, ..., castMs]`
     * INCLUSIVE of both ends — the last slice is the resolve instant, which is precisely
     * where a wind-up must be at its most legible and where the known-bad is at zero.
     */
    async function runCase(label, fire, castMs, opts = {}) {
      await page.evaluate(() => { window.__tg.reset(); });
      await page.waitForTimeout(30);
      await page.evaluate(() => { window.__tg.setBase(); });

      const nSlices = Math.floor(castMs / STEP) + 1;
      const r = await page.evaluate(async ([fa, step, n]) => {
        window.__vfxSpawnTest(...fa);
        const series = [];
        const bespoke = [];
        // Slice 0 is measured with NO advance: the effect exists but no time has passed,
        // which is the frame a player sees first.
        series.push(window.__tg.count());
        bespoke.push(window.__tg.bespokeOnly().px);
        for (let i = 1; i < n; i++) {
          window.__tg.step(step);
          series.push(window.__tg.count());
          bespoke.push(window.__tg.bespokeOnly().px);
        }
        return { series, bespoke, census: window.__tg.census(), ablate: window.__tg.ablate(), hide: window.__tg.hideAll() };
      }, [fire, STEP, nSlices]);

      const series = r.series;
      const min = Math.min(...series);
      const peak = Math.max(...series);
      const under = series.filter((v) => v < FLOOR).length;
      const mean = Math.round(series.reduce((a, b) => a + b, 0) / series.length);
      const bMin = Math.min(...r.bespoke);
      const bPeak = Math.max(...r.bespoke);
      const bUnder = r.bespoke.filter((v) => v < BFLOOR).length;

      let shotFile = null;
      if (SHOTS && opts.shot) {
        // Re-fire and capture at named fractions of the cast rather than at the peak:
        // the sheet has to show the GESTURE, and a peak-only sheet is how a decaying
        // telegraph passes a human read too.
        await page.evaluate(() => { window.__tg.reset(); });
        const fracs = [0, 0.25, 0.5, 0.75, 1.0];
        shotFile = [];
        let prev = 0;
        await page.evaluate(([fa]) => { window.__vfxSpawnTest(...fa); }, [fire]);
        for (const fr of fracs) {
          const target = Math.round(castMs * fr);
          if (target > prev) { await page.evaluate((d) => window.__tg.step(d), target - prev); prev = target; }
          const url = await page.evaluate(() => window.__tg.shot());
          const name = `${OUT}/${label.replace(/[^\w.-]/g, '_')}_t${String(Math.round(fr * 100)).padStart(3, '0')}.png`;
          await writeFile(name, Buffer.from(url.split(',')[1], 'base64'));
          shotFile.push(name);
        }
      }

      log(`${label.padEnd(28)} min ${String(min).padStart(6)}  peak ${String(peak).padStart(6)}  mean ${String(mean).padStart(6)}  under ${String(under).padStart(2)}/${nSlices}  meshes tg${r.census.telegraph}/bs${r.census.bespoke}  ablate ${r.ablate.px}/${r.ablate.before}px (${r.ablate.mats} mats)  hide ${r.hide.px}px (${r.hide.hidden} meshes)`);
      log(`${' '.repeat(28)} series ${series.join(' ')}`);
      log(`${' '.repeat(28)} BESPOKE-ONLY min ${String(bMin).padStart(6)}  peak ${String(bPeak).padStart(6)}  under ${bUnder}/${nSlices}   ${r.bespoke.join(' ')}`);
      return {
        label, castMs, series, min, peak, mean, under, nSlices,
        bespoke: r.bespoke, bMin, bPeak, bUnder,
        census: r.census, ablate: r.ablate, hide: r.hide, shots: shotFile,
      };
    }

    const results = [];

    // ── KB: the shipped 0.3 s wedge on an 1100 ms cast ─────────────────────────────
    log('── KNOWN-BAD ──────────────────────────────────────────────────────────────');
    const kb = await runCase('KB.meleeArc@1100', ['meleeArc', f.x, f.y, 18, '#1E90D8', 'waterbottle', 'Mega'], 1100);
    results.push(kb);
    if (kb.under < 8) fail.push(`KB reported ${kb.under} slices under floor, expected >= 8. This tool is NOT measuring sustain.`);
    else log(`  ✓ known-bad reports ${kb.under}/12 slices under floor — the instrument sees decay.\n`);

    // ── The telegraph ─────────────────────────────────────────────────────────────
    log('── TELEGRAPH ──────────────────────────────────────────────────────────────');
    // GEN: a character with no bespoke `telegraph()` — `hamburger` has none — driven on a
    // synthetic melee weapon at Mega's own reach/cone, so the two rows differ ONLY by the
    // bespoke half and its contribution is attributable.
    results.push(await runCase('GEN.generic-only@1100', ['castTelegraph', f.x, f.y, 18, '#1E90D8', 'hamburger', undefined, 1100], 1100, { shot: true }));
    results.push(await runCase('MEGA.waterbottle@1100', ['castTelegraph', f.x, f.y, 18, '#1E90D8', 'waterbottle', 'Mega', 1100], 1100, { shot: true }));

    // ── The other five ultimates ──────────────────────────────────────────────────
    //
    // `castMs` is passed EXPLICITLY here and is not read out of `rules.ts`: a peer is
    // choosing the five real values in parallel, and a probe that silently inherits
    // whatever is half-saved in `rules.ts` would report a different duration every run
    // with nothing in the output saying so. 1100 is the value the two `meleeHeavy`
    // ultimates ship at, so every row below is directly comparable to MEGA's.
    //
    // ⚠️ Three of the five are RANGED, which exercises a branch of
    // `spawnCastTelegraph` its own comment calls *"measured but unexercised by the
    // roster"*: a ranged footprint is the spread LANE (`max(12, spreadDeg ?? 18)`),
    // not a cone. Taco has no `spreadDeg` at all, so it draws the narrowest footprint
    // in the roster and its bespoke half carries almost the whole read.
    results.push(await runCase('TACO.Double@1100', ['castTelegraph', f.x, f.y, 0, '#6B3E26', 'taco', 'Double', 1100], 1100, { shot: true }));
    results.push(await runCase('BURRITO.Swarm@1100', ['castTelegraph', f.x, f.y, 4, '#7CB518', 'burrito', 'Swarm', 1100], 1100, { shot: true }));
    results.push(await runCase('SUSHI.Catch@1100', ['castTelegraph', f.x, f.y, 9, '#FF8C42', 'sushi', 'Catch', 1100], 1100, { shot: true }));
    results.push(await runCase('SOUP.Dump@1100', ['castTelegraph', f.x, f.y, 16, '#E8792A', 'soup', 'Dump', 1100], 1100, { shot: true }));

    // ── SLAM: the REFUSAL arm, and it has a known-bad with a number ────────────────
    //
    // `lollipop.Giant` is `giantSlam`, `REACH.ultimateSlam` 400 wu, 360 deg. Before
    // `game/vfx.ts:spawnCastTelegraph` learned to stand down for a `giantSlam`, this row
    // measured **259,315 px — 64.0% of the frame — held for the full 1.5 s, 15 of its 16
    // slices above 259,000.** That is the same information-free wash `spawnWeaponCast`
    // already refuses for the 0.3 s melee wedge (recorded there at 262,797 px / 73.0%),
    // five times longer, and it has no edge on screen to dodge relative to.
    //
    // 🚨 ASSERTION REVERSED — OLD WORDING KEPT, WITH THE REASON.
    //
    //   WAS: "So this arm asserts the OPPOSITE of the two above: it must draw NOTHING.
    //   The sustain floor does not apply to a shape that is deliberately absent, and
    //   asserting it here would make the guard cry wolf on its own success."
    //     if (slam.peak > 0 || slam.census.telegraph > 0) fail.push(...)
    //
    // That was correct while `lollipop.Giant` had **no `telegraph()` hook**, which the
    // stand-down block in `game/vfx.ts` named in capitals as *"a gap someone must close
    // before any `giantSlam` ships a `castMs`"*. It is closed: `vfx/weapons/lollipop.ts`
    // now draws a bespoke wind-up, and this weapon's telegraph is ENTIRELY bespoke.
    //
    // So the assertion splits into the two claims that were being conflated:
    //
    //   * the GENERIC footprint still stands down — `census.telegraph` must stay 0, and
    //     that is the arm that guards the 259,315 px wash from coming back. Unchanged
    //     in force, and it is the half that was actually load-bearing.
    //   * the BESPOKE half must now clear the sustain floor like every other row,
    //     because with no generic footprint underneath it there is nothing else on
    //     screen. It is the only telegraph in the roster with no safety net.
    //
    // Left as its own block rather than folded into `measured` because the two halves
    // assert opposite things about the same row, which no generic loop can express.
    const slam = await runCase('SLAM.lollipop@1500', ['castTelegraph', f.x, f.y, 18, '#E63946', 'lollipop', 'Giant', 1500], 1500, { shot: true });
    slam.refusal = true;
    results.push(slam);
    if (slam.census.telegraph > 0) {
      fail.push(`SLAM: the GENERIC footprint painted ${slam.census.telegraph} meshes for a giantSlam. The stand-down is not firing — this is the 259,315 px wash coming back.`);
    } else {
      log(`  ✓ generic footprint stands down: 0 meshes, against a pre-guard 259,315 px (64.0% of frame) held for 1.5 s.`);
    }
    if (slam.census.bespoke === 0) {
      fail.push(`SLAM: 0 bespoke meshes. With the generic footprint standing down that is a weapon with NO telegraph at all, which is the gap game/vfx.ts routes.`);
    } else if (slam.under > 0) {
      fail.push(`SLAM: ${slam.under}/${slam.nSlices} slices under the ${FLOOR} px sustain floor (min ${slam.min}). This is the one telegraph with no generic footprint underneath it.`);
    } else {
      log(`  ✓ bespoke wind-up carries it alone: ${slam.census.bespoke} meshes, min ${slam.min} px across ${slam.nSlices} slices.\n`);
    }

    // ── RESOLVE: what `weapon-fired` draws now that it means "it landed" ──────────
    //
    // Measured, not assumed: the wind-up is only half the promise. `Mega`'s card verb is
    // *"dumps"*, and the dump is `cast()` — which the sim now emits at the RESOLVE. This
    // row is short-lived by design (it is a payoff, not a telegraph) so the sustain floor
    // does not apply; what it must not be is ABSENT, which is what it was before this
    // pass: `waterbottle.ts` had no `Mega` entry at all and the whole ultimate rendered
    // as the generic starburst plus the flat wedge.
    const dump = await runCase('DUMP.weaponFired', ['weaponFired', f.x, f.y, 18, '#1E90D8', 'waterbottle', 'Mega'], 500, { shot: true });
    dump.refusal = true;
    results.push(dump);
    if (dump.peak < 3000) fail.push(`DUMP: the resolve painted only ${dump.peak} px at peak — the payoff is invisible.`);
    else log(`  ✓ resolve peaks at ${dump.peak} px.\n`);

    // ── PAIR: the same case twice ─────────────────────────────────────────────────
    log('\n── SELF-PAIR ──────────────────────────────────────────────────────────────');
    const pairA = await runCase('PAIR.A', ['castTelegraph', f.x, f.y, 18, '#1E90D8', 'waterbottle', 'Mega', 1100], 1100);
    const pairB = await runCase('PAIR.B', ['castTelegraph', f.x, f.y, 18, '#1E90D8', 'waterbottle', 'Mega', 1100], 1100);
    results.push(pairA, pairB);
    const pairDrift = Math.max(...pairA.series.map((v, i) => Math.abs(v - pairB.series[i])));
    log(`  max |A-B| across slices = ${pairDrift} px`);
    if (pairDrift > 0) log(`  ⚠️ non-zero self-pair drift: the readback is not describing the effect alone.`);

    // ── CANCEL: the interrupt read ────────────────────────────────────────────────
    log('\n── CANCEL (applied stun) ──────────────────────────────────────────────────');
    await page.evaluate(() => { window.__tg.reset(); });
    await page.waitForTimeout(30);
    const cancel = await page.evaluate(async ([fx, fy]) => {
      window.__tg.setBase();
      window.__vfxSpawnTest('castTelegraph', fx, fy, 18, '#1E90D8', 'waterbottle', 'Mega', 1100);
      window.__tg.step(500);
      const atCancel = window.__tg.count();
      const censusBefore = window.__tg.census();
      window.__tg.cancel('stun');
      window.__tg.step(16);
      const justAfter = window.__tg.count();
      window.__tg.step(300);
      const settled = window.__tg.count();
      return { atCancel, justAfter, settled, censusBefore, censusAfter: window.__tg.census() };
    }, [f.x, f.y]);
    log(`  at cancel (t=500)  ${cancel.atCancel} px, meshes tg${cancel.censusBefore.telegraph}/bs${cancel.censusBefore.bespoke}`);
    log(`  +16 ms             ${cancel.justAfter} px`);
    log(`  +316 ms            ${cancel.settled} px, meshes tg${cancel.censusAfter.telegraph}/bs${cancel.censusAfter.bespoke}`);
    if (cancel.justAfter === cancel.atCancel) fail.push('CANCEL did not move the frame — the interrupt is invisible.');
    if (cancel.settled > FLOOR * 0.1) fail.push(`CANCEL left ${cancel.settled} px on screen after 316 ms — the telegraph outlived the cast.`);
    if (cancel.censusAfter.telegraph + cancel.censusAfter.bespoke > 0) fail.push(`CANCEL left ${cancel.censusAfter.telegraph + cancel.censusAfter.bespoke} meshes in the layer.`);

    // ── Verdict ───────────────────────────────────────────────────────────────────
    const measured = results.filter((r) => !r.label.startsWith('KB.') && !r.label.startsWith('PAIR.') && !r.refusal);
    // 🚨 NON-EMPTY FIRST. Every assertion below filters, and `[].every()` is `true` —
    // that exact vacuity fired three times in three files in one session here.
    if (!measured.length) fail.push('VACUOUS: no telegraph cases were measured at all.');

    log(`\n${'═'.repeat(96)}`);
    log(`SUSTAIN VERDICT (floor ${FLOOR} px at ${RW}x${RH}, every ${STEP} ms of the cast)`);
    for (const r of measured) {
      const ok = r.under === 0;
      log(`  ${ok ? '✓' : '✗'} ${r.label.padEnd(26)} min ${String(r.min).padStart(6)} px   ${r.under}/${r.nSlices} slices under floor`);
      if (!ok) fail.push(`${r.label}: ${r.under}/${r.nSlices} slices under the ${FLOOR} px sustain floor (min ${r.min}).`);
      if (r.census.telegraph === 0) fail.push(`${r.label}: NO mesh named castTelegraph* in the layer — nothing spawned.`);
      // 🚨 THE INSTRUMENT-FAULT ARM. Meshes present, materials found to ablate, and the
      // frame still did not move by one pixel: that is not an invisible effect, it is a
      // camera pointed somewhere else. Without this the `--pitch` failure above reads as
      // a devastating finding about the telegraph, which is the most expensive kind of
      // wrong answer an instrument can give.
      if (r.census.telegraph > 0 && r.ablate.mats > 0 && r.ablate.px === 0 && r.ablate.before === 0) {
        fail.push(`${r.label}: INSTRUMENT FAULT, not a finding — ${r.census.telegraph} telegraph meshes and ${r.ablate.mats} materials exist, and an unmissable magenta version of them still moved 0 px. The camera is not pointed at the subject (see --pitch in this file's header).`);
      }
      // 🚨 ASSERTION REVERSED — OLD WORDING KEPT, WITH THE REASON AND THE NUMBER.
      //
      //   WAS: "The ablation arm asks ONE question: is the object that painted
      //   `before` px the same object these names address? Force it to an unmissable
      //   colour with depth test off and it must paint AT LEAST as much. Less means
      //   the names and the pixels are not the same thing."
      //     if (r.ablate.px < r.ablate.before) fail.push('...not what is on screen')
      //
      // The question is right; `>=` is the wrong test for it, and the five ultimates
      // added after `Mega` are what exposed that. `TACO.Double` ablated to **6,272 px
      // where it had painted 12,285**, and `SUSHI.Catch` to **14,521 against 16,523**
      // — while `hideAll()` returned BOTH frames to **0 px from base**, i.e. every
      // painting mesh was addressed by these names after all. Both rows would have
      // been reported as "the named meshes are not what is on screen", which is a
      // devastating and false finding.
      //
      // The cause is the post chain, not the names: `render/stage.ts` blooms, a bright
      // additive highlight spreads changed pixels well past its own geometry, and flat
      // magenta at the same coverage does not. Taco's wind-up is carried by six
      // additive sparks and Sushi's by a pale rice cap; `Mega`'s is carried by large
      // flat translucent bodies, which is why it cleared `>=` (16,842 vs 16,420) and
      // hid the asymmetry for a whole pass.
      //
      // So the ablation number is still PRINTED and still guards the instrument-fault
      // case above (meshes exist, materials exist, magenta moves nothing => the camera
      // is pointed elsewhere). What it no longer does is assert an inequality that
      // bloom can break on a healthy effect. The naming claim is now carried by
      // `hideAll()`, which has no such asymmetry: hide every named mesh and the frame
      // must return to base, bloom included, because the source of the bloom goes with
      // it. That is a STRICTLY STRONGER test — it would catch an unnamed mesh the
      // ablation arm could only catch by arithmetic.
      if (r.hide.px > FLOOR * 0.02) {
        fail.push(`${r.label}: hiding every castTelegraph*/mega*/tele* mesh left ${r.hide.px} px of ${r.series[r.series.length - 1]} on screen — something is painting that these names do not address (an unnamed mesh, or a second program such as a shadow or decal).`);
      }
      if (r.hide.hidden === 0) {
        fail.push(`${r.label}: the hide test found ZERO meshes to hide — it is asserting over an empty set.`);
      }
      if (r.ablate.mats === 0) {
        fail.push(`${r.label}: ablation found ZERO materials to swap — it is asserting over an empty set.`);
      }
    }

    // ── The bespoke half, on its own ──────────────────────────────────────────────
    //
    // `GEN` is the control: it is driven on a character with no `telegraph()` hook, so
    // its bespoke-only reading must be ZERO. That is what makes every other row's
    // number attributable rather than assumed — and it is also the known-bad for this
    // arm, because a `bespokeOnly()` that hid nothing, or that hid everything, would
    // report a plausible number on every row including this one.
    const gen = results.find((r) => r.label.startsWith('GEN.'));
    if (!gen) fail.push('VACUOUS: no GEN control row — the bespoke-only readings are unattributable.');
    else if (gen.bPeak > 0 || gen.census.bespoke > 0) {
      fail.push(`BESPOKE CONTROL: GEN has no telegraph() hook yet reported ${gen.bPeak} px / ${gen.census.bespoke} meshes of "bespoke". bespokeOnly() is not hiding what it claims to hide.`);
    } else {
      log(`\n  ✓ bespoke control: GEN (no telegraph hook) reads 0 px, 0 meshes.`);
    }

    const bespokeRows = results.filter((r) => r.census.bespoke > 0 && !r.label.startsWith('PAIR.') && !r.label.startsWith('DUMP.'));
    // 🚨 NON-EMPTY FIRST — `[].every()` is `true`, and this filter is exactly the shape
    // that has silently emptied three times in this repo.
    if (!bespokeRows.length) fail.push('VACUOUS: not one row carried a bespoke telegraph mesh. Either no hook fired, or census() no longer recognises their names.');
    log(`\nBESPOKE-ONLY VERDICT (floor ${BFLOOR} px at ${RW}x${RH}, every ${STEP} ms — the sculpt alone, generic footprint hidden)`);
    for (const r of bespokeRows) {
      const ok = r.bUnder === 0;
      log(`  ${ok ? '✓' : '✗'} ${r.label.padEnd(26)} min ${String(r.bMin).padStart(6)} px   peak ${String(r.bPeak).padStart(6)}   ${r.bUnder}/${r.nSlices} slices under floor`);
      if (!ok) fail.push(`${r.label}: the BESPOKE half is under ${BFLOOR} px at ${r.bUnder}/${r.nSlices} slices (min ${r.bMin}). pj_probe's 36-px invisible sculpt is this exact number.`);
    }

    await writeFile(`${OUT}/tg_tele.json`, JSON.stringify({
      base: BASE, viewport: [W, H], readback: [RW, RH], delta: DELTA, floor: FLOOR, step: STEP,
      pitch: PITCH, player: PLAYER, results, cancel, pairDrift, fail,
    }, null, 1));
    log(`\nwrote ${OUT}/tg_tele.json`);

    if (fail.length) {
      log(`\n✗ ${fail.length} FAULT${fail.length > 1 ? 'S' : ''}`);
      for (const m of fail) log(`   - ${m}`);
      process.exitCode = 1;
    } else {
      log(`\n✓ PASS — every telegraph clears ${FLOOR} px at every slice, the known-bad does not, ablation moves the frame, and the cancel is visible.`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
