#!/usr/bin/env node
/**
 * N-PRESENTATION IDENTITY — did making the presentation N-capable change what a
 * two-fighter match LOOKS LIKE?
 *
 * `src/ui/hud.ts`, `src/game/match.ts`, `src/game/vfx.ts` and `src/audio/director.ts` all
 * assumed exactly two fighters: a static two-fighter DOM template, `playerModel` /
 * `enemyModel`, `Record<FighterRole, …>` everywhere, and four separate reconstructions of
 * "the other one" from `otherRole(ev.targetRole)`. Generalising them to `state.fighters`
 * is a REFACTOR, so the acceptance question is not "is it better" — it is **"is it the
 * same"**, and the only honest answer is pixels.
 *
 * ── WHAT IT MEASURES, AND WHY EACH ONE IS THERE ─────────────────────────────
 *
 *   1. **THE FRAME AT THE MATCH CAMERA (pitch 58)** — what ships.
 *   2. **THE FRAME AT THE LOBBY CAMERA (pitch 20)** — `CLAUDE.md` #3: there are two
 *      shipped pitches and they expose different defects. `charStage.ts:451` is 20 and it
 *      is where every one of Uri's reject sheets came from. A model attached to the wrong
 *      slot, or a status ring on the wrong fighter, is foreshortened away at 58 and
 *      obvious at 20. The rig's `pitchDeg`, `frameMode`, `subjectHeight`, `subjectFill`
 *      and `targetHeight` are all public fields and `apply()` is public, so this is the
 *      SAME match state re-photographed, not a second scene.
 *
 *      ⚠️ **CHANGING THE PITCH ALONE PRODUCES AN EMPTY FRAME, AND THE FIRST VERSION OF
 *      THIS FILE DID EXACTLY THAT.** A match rig is `frameMode: 'fair'`, whose distance
 *      is `distForWidth / max(0.35, sin(pitch))`; at 20 deg that clamp puts the camera far
 *      enough out that the Stage's `fog: { near: 40, far: 130 }` swallows the entire
 *      arena, and the "lobby" shot was the HUD over a flat gradient. It still hashed, it
 *      still moved under the known-bad, and it was measuring nothing about the cast — a
 *      textbook instrument returning a confident wrong answer (`CLAUDE.md` #6). The lobby
 *      arm therefore copies `charStage.ts`'s ACTUAL framing — `frameMode: 'subject'`,
 *      `subjectHeight: CHARACTER_HEIGHT`, `subjectFill: 0.60`, `targetHeight: 0.52 x
 *      CHARACTER_HEIGHT` — and disables the fog for the shot, which is what `charStage`
 *      itself does (`fog: null`, and its comment says why).
 *   3. **THE HUD DOM, SERIALISED** — the largest mechanical change in the task is pooling
 *      a static two-fighter template. A pixel hash would catch a moved nameplate; it
 *      would NOT catch a `data-el` name that changed, and ten instruments plus two
 *      shipped gates select those by name (`menu_accept_portrait` on
 *      `.hud-fighter--player`, `cw_conceal_view` on `[data-el="radar-enemy"]`). Both
 *      halves are compared.
 *   4. **THE SCENE GRAPH, AS A NAMED PRE-ORDER WALK** — child order is what three's
 *      transparent sort falls back on for ties, and `VfxLayer` moved from building two
 *      status telegraphs in its constructor to growing them per slot. A count would not
 *      see a reorder.
 *
 * ── 🚨 THREE SOURCES OF NOISE, ALL THREE MEASURED BEFORE THEY WERE REMOVED ──
 *
 * The first run of this battery FAILED ITS OWN SELF-PAIR — two runs of the SAME pristine
 * HEAD produced different pixels at both pitches and a `vfx_layer` holding 173 children in
 * one and 171 in the other. That is the drift control doing exactly its job, and it is why
 * a "no diff" from an instrument nobody has shown can produce a diff is worth nothing.
 * The three causes, each fixed at the root rather than tolerated:
 *
 *  1. **THE CLOCK STARTS PAUSED, AT ZERO.** `THREE.Clock` reads `performance.now()`.
 *     Pausing it AFTER `__gameReady` leaves an arbitrary number of real rAF frames — each
 *     with a real, contention-dependent dt — already stepped into the match, so the two
 *     arms were photographing two different instants. Paused from the init script, every
 *     millisecond the sim ever sees is one this file handed it.
 *  2. **`Math.random` IS SEEDED — ON TWO INDEPENDENT STREAMS, AND THE SPLIT IS THE
 *     WHOLE POINT.** `camera.ts:shake()` draws three, `vfx.ts` draws from 29 sites, and
 *     `arena/{ambient,floor,apron,textures}.ts` draw at build time — so a single landed
 *     hit, or simply loading the page twice, produces different pixels forever. A
 *     mulberry32 installed before any module loads makes the render a pure function of
 *     the seed.
 *
 *     🚨 **BUT 22,744 OF 23,060 DRAWS IN THIS FIXTURE ARE `THREE.MathUtils.generateUUID`**
 *     — measured by `np_rng.mjs`, which tallies draws by the source file on top of the
 *     stack. Three draws four per object, so the stream position after boot is a function
 *     of HOW MANY OBJECTS WERE CONSTRUCTED, and a UUID changes nothing anybody can see.
 *     On one shared stream, constructing two fewer throwaway models shifts every later
 *     draw and the frame differs for a reason that is not a rendering difference at all.
 *     That is not hypothetical: it is exactly what the first clean run of this battery
 *     reported (2,532 fewer draws, and a 0.57% pixel diff confined to the sprinkle
 *     scatter on three in-flight donut projectiles).
 *
 *     So `generateUUID`'s draws are routed to their OWN stream and the draws that reach a
 *     pixel keep theirs. ⚠️ This removes noise without removing signal: both streams are
 *     seeded identically in both arms, both counts are reported, and a refactor that
 *     changed the number or order of the draws that DO reach a pixel still diverges, and
 *     should. The discriminator is the literal frame name in `Error().stack`, which is
 *     why this costs a stack capture per draw and why the attribution tally lives in a
 *     separate probe.
 *  3. **THE SHAKE IS SUPPRESSED AT CAPTURE**, `feel_probe.mjs`'s `grab()` idiom —
 *     `shakeAmount`/`shakeOffset` zeroed, `apply()`, render, then restored. A kick
 *     translates the WHOLE frame, so an un-suppressed one swamps every other difference
 *     with the camera's own.
 *  4. **THE rAF LOOP IS KILLED BEFORE THE CAPTURE.** Freezing the CLOCK is not freezing
 *     the LOOP: `match.ts:loop` re-schedules itself on a real `requestAnimationFrame` and
 *     keeps running at dt 0, so the number of turns between an `evaluate` and the
 *     screenshot that follows it is wall-clock — i.e. contention — dependent. That is a
 *     second self-pair failure this battery caught after the first three were fixed: the
 *     lobby PNG moved between two runs of the SAME pristine HEAD, and `__feelDebug.frames`
 *     (a per-TURN counter, not a per-tick one) moved with it. Replacing
 *     `window.requestAnimationFrame` with a no-op after the cranks makes the last frame
 *     the one this file explicitly rendered, and nothing else.
 *     ⚠️ The real rAF is KEPT as `window.__rafReal` and every capture renders inside it:
 *     the drawing buffer is not preserved, so a render outside a frame callback is not
 *     guaranteed to be what gets composited into the screenshot.
 *
 * ── HOW TO RUN IT ───────────────────────────────────────────────────────────
 *
 *   # one arm, JSON to stdout. NOTE: no `--url {URL}` — that placeholder is
 *   # `with_snapshot.mjs`'s; `headserve` injects PREVIEW_BASE into the child's env.
 *   node tools/tmp/headserve.mjs -- node tools/tmp/np_identity.mjs --json
 *
 *   # the whole A/B, including the self-pair drift control and the known-bad
 *   node tools/tmp/np_ab.mjs
 *
 * ── THE KNOWN-BAD: `--swap` ────────────────────────────────────────────────
 *
 * `--swap` PERMUTES THE TWO SLOTS' CHARACTERS — `player=donut&enemy=hamburger` instead of
 * the other way round — and every number this file produces must MOVE. That is the
 * positive control, and it is deliberately driven through the shipped `?player=`/`?enemy=`
 * QA params rather than by reaching into the scene graph: a control that pokes the
 * renderer proves the renderer can be poked, while this one proves the whole pipeline —
 * `createMatch`'s slot order, `models[i]`, the HUD's slot blocks, the trail material
 * chosen per slot — is actually keyed on which fighter sits where. An instrument that
 * reports IDENTICAL under this is measuring nothing (`CLAUDE.md` #6, and the positive-
 * control half of `conceal_lab --ablate`).
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/np`));
const TAG = String(arg('--tag', 'arm'));
const W = Number(arg('--w', 1280));
const H = Number(arg('--h', 720));
/** How many 60 fps frames to hand-crank after the game reports ready. Enough for the
 *  camera follow lerp to settle and for the AI to have taken real decisions, few enough
 *  that neither fighter has died. */
const FRAMES = Number(arg('--frames', 60));
const SWAP = has('--swap');
const JSON_ONLY = has('--json');

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/**
 * The fixture, pinned rather than defaulted. Both fighters are placed by `?px=/?py=` so
 * the frame does not depend on the arena's spawn table, `?fogRadius=` skips the countdown
 * into `playing` (the phase that runs every code path this refactor touched), and
 * `pointerLock=0` keeps the aim reticle out of it — a reticle follows the OS cursor and
 * the cursor is not a property of the build.
 *
 * Hamburger vs Donut, deliberately: Donut is the only character that drops TRAIL MARKS,
 * which is the one pool whose material is now chosen per slot (`vfx.ts:trailMatsFor`).
 *
 * ── 🚨 THE 170 wu SEPARATION IS PINNED BETWEEN TWO NUMBERS, NOT PICKED ─────
 *
 * The kitchen's enemy spawn is (1240, 610) and the player is placed due WEST of it, the
 * same axis and for the same measured reason `cw_conceal_view.mjs` uses: the camera
 * pitches 58 deg, so the visible world reaches much further along +y than -y and only the
 * horizontal axis is symmetric about the player.
 *
 *   > `REACH.rangedMax` (140), the longest reach in the roster — so NEITHER FIGHTER CAN
 *     ATTACK inside the cranked window. That is not tidiness: `camera.ts:shake()` is
 *     driven by `Math.random()`, the only unseeded randomness anywhere on this path, and
 *     it fires on every hit. One landed blow and the two arms are photographing two
 *     different camera offsets, which presents as "the refactor changed the frame".
 *   < `FAIR_PLAY.radiusUnits` (199.2), the disc every supported device is guaranteed to
 *     show — so the opponent's MODEL is genuinely in frame at every aspect ratio, and the
 *     "is the right body in the right slot" question is actually being photographed.
 */
const ROSTER = SWAP ? 'player=donut&enemy=hamburger' : 'player=hamburger&enemy=donut';
const URL_PARAMS = `px=1070&py=610&fogRadius=900&simSpeed=1&${ROSTER}&pointerLock=0`;

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    // A peer saving into this repo triggers a Vite full reload that wipes in-page state
    // mid-probe. Stub the HMR client. (`headserve` serves a detached copy, so this is
    // belt-and-braces rather than the main defence.)
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
    }));

    // Installed BEFORE navigation, so the very first read any module makes is already
    // controlled. See the header: both the clock and the RNG.
    await page.addInitScript(() => {
      // ── 1. The clock, PAUSED AT ZERO from the first instruction ────────────
      const realNow = performance.now.bind(performance);
      let paused = true; let virt = 0; let base = realNow();
      performance.now = () => (paused ? virt : realNow() - base);
      window.__clk = {
        pause() { if (!paused) { virt = realNow() - base; paused = true; } },
        resume() { if (paused) { base = realNow() - virt; paused = false; } },
        advance(ms) { virt += ms; },
      };
      // ── 2. Two seeded streams. See the header for why there are two. ────────
      // mulberry32: 32-bit state, no dependencies, same sequence in both arms.
      const mulberry = (s0) => {
        let seed = s0 >>> 0;
        return () => {
          seed = (seed + 0x6d2b79f5) >>> 0;
          let t = seed;
          t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
          t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };
      const rndPixel = mulberry(0x9e3779b9);
      const rndUuid = mulberry(0x85ebca6b);
      // ⚠️ BOTH COUNTED, and the counters are not decoration. A seeded RNG turns "the
      // frame differs" into "the draw sequence differs", and that has two completely
      // different causes — a real visual change, or object churn upstream. Reporting the
      // two counts separately is what tells them apart without re-running `np_rng`.
      window.__rngCalls = 0;
      window.__rngUuidCalls = 0;
      Math.random = () => {
        // The literal frame name, because `generateUUID` is minified-but-named in the
        // Vite dep chunk (`at generateUUID (…/node_modules/.vite/deps/chunk-*.js)`).
        if ((new Error().stack ?? '').includes('generateUUID')) {
          window.__rngUuidCalls++;
          return rndUuid();
        }
        window.__rngCalls++;
        return rndPixel();
      };
    });

    await page.goto(`${BASE}/?${URL_PARAMS}`, { waitUntil: 'networkidle' });
    // ⚠️ `__gameReady` still fires with the clock frozen: `match.ts:loop` sets it at the
    // end of its first pass and rAF is real time, so the loop runs — it just steps the
    // sim by 0 ms per turn. Every millisecond the match sees comes from the cranks below.
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });

    // Hand-crank. `advance` then one rAF turn, so exactly one `loop()` runs per slice.
    await page.evaluate(async (frames) => {
      for (let i = 0; i < frames; i++) {
        window.__clk.advance(16.667);
        await new Promise((r) => requestAnimationFrame(() => r()));
      }
      // ── Kill the loop. See the header, cause 4. ──────────────────────────
      window.__rafReal = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = () => 0;
      // One more real turn so `match.ts:loop`'s pending re-schedule is consumed by the
      // no-op rather than sitting queued against the real one.
      await new Promise((r) => window.__rafReal(() => r()));
    }, FRAMES);

    // ── 1 + 2: the two shipped pitches, same state ─────────────────────────
    // The shake suppression is permanent for the rest of the run rather than saved and
    // restored: nothing is measured after this point, and `feel_probe.mjs` records that
    // forgetting the restore made it report "camera kick 0 px" for the loudest hit in the
    // game. Here the opposite risk applies — a restored kick between the two pitches would
    // translate the second frame and not the first.
    /** `mode` is 'match' (leave the rig alone) or 'lobby' (charStage's framing). */
    const settle = async (mode) => page.evaluate((m) => {
      const stage = window.__stage;
      const rig = stage.rig;
      rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
      if (m === 'lobby') {
        window.__npRig ??= {
          pitchDeg: rig.pitchDeg, frameMode: rig.frameMode, subjectHeight: rig.subjectHeight,
          subjectFill: rig.subjectFill, targetHeight: rig.targetHeight, fog: stage.scene.fog,
        };
        // CHARACTER_HEIGHT is 2.1 (`src/units.ts`). Hard-coded rather than imported
        // because this probe runs in the page, not in the module graph — and it is
        // asserted below by the frame simply not being empty.
        rig.pitchDeg = 20; rig.frameMode = 'subject';
        rig.subjectHeight = 2.1; rig.subjectFill = 0.60; rig.targetHeight = 2.1 * 0.52;
        stage.scene.fog = null;
      } else if (m === 'match' && window.__npRig) {
        Object.assign(rig, {
          pitchDeg: window.__npRig.pitchDeg, frameMode: window.__npRig.frameMode,
          subjectHeight: window.__npRig.subjectHeight, subjectFill: window.__npRig.subjectFill,
          targetHeight: window.__npRig.targetHeight,
        });
        stage.scene.fog = window.__npRig.fog;
      }
      rig.apply();
      // Rendered INSIDE a frame callback: `preserveDrawingBuffer` is false, so a render
      // outside one is not guaranteed to survive to the compositor.
      return new Promise((r) => window.__rafReal(() => { stage.render(0); r(undefined); }));
    }, mode);

    const matchPng = `${OUT}/${TAG}-p58.png`;
    await settle('match');
    await page.screenshot({ path: matchPng, animations: 'disabled' });

    // ⚠️ The rAF loop is still running (at dt 0 — the clock is frozen), and it calls
    // `stage.render` every turn. That is what keeps the lobby framing on screen between
    // this evaluate and the screenshot; it is also why the framing must be written onto
    // the RIG rather than applied to a one-off camera clone.
    const lobbyPng = `${OUT}/${TAG}-p20.png`;
    await settle('lobby');
    await page.screenshot({ path: lobbyPng, animations: 'disabled' });
    await settle('match');

    // ── 3 + 4: the DOM and the scene graph ─────────────────────────────────
    const structure = await page.evaluate(() => {
      /** The HUD's markup with every animation-driven inline style stripped. What is
       *  kept is exactly what an instrument selects on: tag, class list, `data-el`. */
      const skeleton = (el, depth = 0) => {
        const out = [];
        const walk = (n, d) => {
          if (n.nodeType !== 1) return;
          const cls = n.className && typeof n.className === 'string' ? n.className : '';
          out.push(`${' '.repeat(d)}${n.tagName.toLowerCase()}|${cls}|${n.dataset?.el ?? ''}`);
          for (const c of n.children) walk(c, d + 1);
        };
        walk(el, depth);
        return out.join('\n');
      };
      const hudRoot = document.querySelector('.hud-root');
      const sceneWalk = [];
      const visit = (o, d) => {
        sceneWalk.push(`${' '.repeat(d)}${o.type}|${o.name}|${o.children.length}|${o.visible ? 1 : 0}`);
        for (const c of o.children) visit(c, d + 1);
      };
      visit(window.__stage.scene, 0);
      // The three selector families two shipped gates key on, asserted here rather than
      // inferred from the skeleton, so a rename is a NAMED failure and not a diff to read.
      const sel = (s) => document.querySelectorAll(s).length;
      return {
        hud: hudRoot ? skeleton(hudRoot) : '(no hud)',
        scene: sceneWalk.join('\n'),
        selectors: {
          'hud-fighter--player': sel('.hud-fighter--player'),
          'hud-fighter--enemy': sel('.hud-fighter--enemy'),
          'hud-clock': sel('.hud-clock'),
          'hud-radar-dot--player': sel('.hud-radar-dot--player'),
          'hud-radar-dot--enemy': sel('.hud-radar-dot--enemy'),
          'data-el=player-name': sel('[data-el="player-name"]'),
          'data-el=enemy-name': sel('[data-el="enemy-name"]'),
          'data-el=player-hp': sel('[data-el="player-hp"]'),
          'data-el=enemy-hp': sel('[data-el="enemy-hp"]'),
          'data-el=radar-enemy': sel('[data-el="radar-enemy"]'),
          'data-el=float-enemy': sel('[data-el="float-enemy"]'),
          'data-el=float-player': sel('[data-el="float-player"]'),
          'hud-float': sel('.hud-float'),
        },
        // Everything the page publishes about who is where, so a mis-seated fighter is
        // caught numerically as well as photographically.
        fighters: window.__vfxDebugFighters ?? null,
        screen: window.__vfxDebugScreen ?? null,
        names: {
          player: document.querySelector('[data-el="player-name"]')?.textContent ?? null,
          enemy: document.querySelector('[data-el="enemy-name"]')?.textContent ?? null,
        },
        hp: {
          player: document.querySelector('[data-el="player-hp"]')?.textContent ?? null,
          enemy: document.querySelector('[data-el="enemy-hp"]')?.textContent ?? null,
        },
        elapsed: window.__matchDebug?.frames ?? null,
        phase: window.__matchDebug?.phase ?? null,
        // How many draws the whole page has taken, and what the event -> feel edge did
        // with this match's events. Both arms run the same seeded stream, so a moved
        // count localises a pixel diff to a CAUSE instead of leaving it as a hash.
        rng: window.__rngCalls ?? null,
        rngUuid: window.__rngUuidCalls ?? null,
        feel: window.__feelDebug
          ? { events: { ...window.__feelDebug.events }, responses: { ...window.__feelDebug.responses },
              frames: window.__feelDebug.frames }
          : null,
      };
    });

    const { readFileSync } = await import('node:fs');
    const report = {
      tag: TAG, base: BASE, viewport: { W, H }, frames: FRAMES, swap: SWAP,
      png: { p58: sha(readFileSync(matchPng)), p20: sha(readFileSync(lobbyPng)) },
      hudSha: sha(structure.hud),
      sceneSha: sha(structure.scene),
      selectors: structure.selectors,
      rng: structure.rng,
      rngUuid: structure.rngUuid,
      feel: structure.feel,
      names: structure.names,
      hp: structure.hp,
      phase: structure.phase,
      fighters: structure.fighters,
      screen: structure.screen,
      shots: { p58: matchPng, p20: lobbyPng },
    };
    writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(report, null, 2));
    writeFileSync(`${OUT}/${TAG}-hud.txt`, structure.hud);
    writeFileSync(`${OUT}/${TAG}-scene.txt`, structure.scene);

    if (JSON_ONLY) console.log(JSON.stringify(report));
    else {
      console.log(`\nnp_identity [${TAG}] — ${BASE} @ ${W}x${H}, ${FRAMES} cranked frames\n`);
      console.log(`  png  p58 ${report.png.p58}`);
      console.log(`  png  p20 ${report.png.p20}`);
      console.log(`  hud      ${report.hudSha}`);
      console.log(`  scene    ${report.sceneSha}`);
      console.log(`  names    ${JSON.stringify(report.names)}  hp ${JSON.stringify(report.hp)}`);
      console.log(`  phase    ${report.phase}   rng(pixel) ${report.rng}  rng(uuid) ${report.rngUuid}`);
      console.log(`  written  ${OUT}/${TAG}.json`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
