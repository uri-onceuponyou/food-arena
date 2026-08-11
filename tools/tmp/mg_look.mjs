#!/usr/bin/env node
/**
 * mg_look.mjs — IS THE BATCHED FRAME THE SAME FRAME, OR MERELY A PRESENT ONE?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY A DRIFT CONTROL AND NOT A TOLERANCE
 * ═══════════════════════════════════════════════════════════════════════════
 * Static batching claims ZERO look cost: the parts do not move relative to each
 * other, so the same triangles are submitted with the same materials and the pixels
 * should be identical. That claim is exactly the shape this project has been wrong
 * about eighteen times — "it isn't there" was really "it is there and invisible",
 * and the eighteenth rendered **plausibly and wrongly**, a restored WebGL context
 * 15.65 luma darker forever. So the question is not "did the arena render?" but
 * **"is it the SAME arena?"**, and a guessed tolerance cannot answer that.
 *
 * The answer here is a DRIFT CONTROL: the batched arm is captured TWICE, in two
 * independent page loads, through the identical machinery. Whatever that pair
 * differs by is the floor of this comparison — page-load nondeterminism, driver
 * state, everything. The batched-vs-unbatched difference is then quoted against
 * that floor rather than against a number someone chose.
 *
 * ── WHAT IS FROZEN, AND WHY EACH ONE ────────────────────────────────────────
 *   * The sim (`__matchDebug.paused`) — fighters must not have walked.
 *   * `shakeOffset` — camera shake used to re-randomise on every `render()` at
 *     dt = 0, and 344 of 344 frozen frames drifted (AGENT-BRIEF §3). Fixed in
 *     `camera.ts` since, zeroed here anyway: a probe that relies on someone else's
 *     fix is one refactor from measuring a moving camera again.
 *   * The animated set, for the DRIFT stations only — the boiling pot's steam and
 *     bubbles, the dust field, the hazard glow, the cast, the VFX. They are driven
 *     off wall-clock elapsed time, so two page loads sample them at different
 *     phases and the control would measure the steam rather than the patch. They
 *     are all present in the LOOK stations, which is where a human reads the frame.
 *   * The capture itself is `renderer.domElement.toDataURL()` immediately after an
 *     explicit `stage.render(0)`, NOT a page screenshot: CSS animations run on the
 *     document timeline and a page screenshot clipped to the canvas box lands a
 *     position:fixed HUD keyframe inside every PNG (AGENT-BRIEF §3).
 *
 * ── BOTH CAMERAS, BECAUSE THEY EXPOSE DIFFERENT DEFECTS ─────────────────────
 * `render/camera.ts` defaults the match to pitch 58 — steep, far, foreshortened.
 * `ui/screens/charStage.ts:451` is pitch 20, which is where Uri looks and where
 * every reject sheet came from. A change that only looks right at 58 is a cheat.
 * Each station is shot at both.
 *
 * ── VALIDATION (`--selftest`) ───────────────────────────────────────────────
 *   1. SELF-PAIR — the same arm captured twice must differ by ~0. A capture path
 *      with an unfrozen clock, a live shake or a CSS animation fails here, and this
 *      is the number every other result is quoted against.
 *   2. KNOWN-BAD MOVES — one prop nudged 0.5 m must produce a difference far above
 *      the drift control. A comparator too blunt to see a moved counter cannot
 *      certify that nothing moved.
 *   3. KNOWN-BAD DARKENS — a global 2/255 darkening must be caught. That is the
 *      eighteenth-failure shape: present, plausible, and uniformly wrong.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   MG_SCRATCH=<dir> node tools/tmp/mg_serve.mjs --start
 *   MG_SCRATCH=<dir> node tools/tmp/mg_look.mjs
 *   MG_SCRATCH=<dir> node tools/tmp/mg_look.mjs --selftest
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

const SCRATCH = process.env.MG_SCRATCH ?? join(tmpdir(), 'fa-mg');
const STATE = join(SCRATCH, 'mg-serve.json');
function baseUrl() {
  const u = arg('url', null);
  if (u) return u;
  if (!existsSync(STATE)) { console.error('mg_look: no mg_serve running.'); process.exit(2); }
  return JSON.parse(readFileSync(STATE, 'utf8')).url;
}
const OUT = arg('out', 'shots/mg');
const MATCH = '/?player=hamburger&enemy=donut';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/**
 * Stations, in ARENA world units. Chosen to cover four different prop families and
 * the map's two halves, not for prettiness: the merge is per-material and a station
 * that only sees steel would certify nothing about burlap.
 */
const STATIONS = [
  { id: 'hub', x: 1400, y: 1000 },      // the central stove hub + pot + service counters
  { id: 'nw', x: 380, y: 380 },         // the walk-in freezer stack
  { id: 'pantry', x: 2350, y: 500 },    // crates, sacks, herb boxes
  { id: 'south', x: 1830, y: 1450 },    // spice carts, barrels, the chalkboard
];
/**
 * Two views per station, because they expose different defects (CLAUDE.md 3).
 *  `p58`  the SHIPPED match rig — steep, far, foreshortened. What the game draws.
 *  `p22`  a close, shallow look at a FIXED 18 m, the framing `charStage.ts:451`'s
 *         pitch-20 lobby camera gives a character and where every one of Uri's
 *         reject sheets came from. Interpenetration, a detached ink line and a
 *         frozen part are all visible here and hidden at 58.
 */
const VIEWS = [
  { tag: 'p58', pitch: 58, mode: 'match', dist: 0 },
  { tag: 'p22', pitch: 22, mode: 'close', dist: 18 },
];

// 🚨 NO BACKTICKS BELOW — this is a JS template literal.
const HOOK = `
(() => {
  window.__mgStage = () => (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;

  /**
   * Hide everything whose appearance is a function of WALL-CLOCK TIME rather than
   * of the patch. Returns an undo. Used for the drift stations only.
   */
  window.__mgStill = function () {
    const st = window.__mgStage();
    const undo = [];
    const hide = (o) => { if (o.visible) { o.visible = false; undo.push(() => { o.visible = true; }); } };
    for (const c of st.scene.children) {
      if (c.name === 'arena:kitchen' || c.name === 'lighting') continue;
      hide(c);
    }
    st.scene.traverse((o) => {
      const n = o.name || '';
      if (/boiling_pot|hazard|dust|steam|flame|wisp|glow/i.test(n)) hide(o);
    });
    return () => { while (undo.length) undo.pop()(); };
  };
  window.__mgUndo = null;

  /**
   * Stop the app's own loop. 🚨 FREEZING THE SIM IS NOT FREEZING THE FRAME.
   * With the sim paused the app still runs a rAF turn per frame, and that turn calls
   * lighting.focus() on the player and stage.render(dt) on the rig — so between two
   * captures the KEY LIGHT and the damped camera both move, the shadow map re-renders
   * from a different frustum, and the two frames differ by a broad low-amplitude
   * haze. Measured on the first version of this tool: max 4/255 over 13.03% of the
   * frame, self-paired, which is bigger than most real regressions.
   */
  window.__mgFreeze = function () {
    if (window.__mgFrozen) return;
    window.__mgFrozen = true;
    window.requestAnimationFrame = function () { return 0; };
  };

  /**
   * Park the camera at an exact station and draw ONE frame, then read it back.
   *
   * mode 'match' — the SHIPPED rig, i.e. whatever CameraRig.computeDistance()
   *   solves for at that pitch. This is the frame the game draws.
   * mode 'close' — an explicit camera at a fixed distance and pitch, bypassing the
   *   rig's solve entirely.
   *
   * 🚨 'close' EXISTS BECAUSE THE FIRST VERSION'S SHALLOW STATION WAS VACUOUS.
   * It asked the shipped rig for pitch 20, and computeDistance() solves the
   * fair-play square at the CURRENT pitch — at 20 degrees that square subtends
   * almost nothing vertically, so the solve pushes the camera to the far distance
   * and the frame it returns is **flat sky with no arena in it at all**. All four
   * shallow stations then compared bit-identical, 0 pixels differing, and reported
   * PASS. A guard that passes because it is looking at nothing is the tautological
   * guard AGENT-BRIEF §4.4 warns about, and it passed twice before a PNG was read.
   */
  window.__mgShot = function (xwu, ywu, pitch, mode, distM) {
    const st = window.__mgStage();
    const rig = st.rig;
    if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
    // world units -> metres, the same conversion the arena places props with.
    const M = window.__mgWU;
    const x = xwu * M, z = ywu * M;
    // The shadow frustum is a function of where the light is FOCUSED, not of the
    // camera. match.ts re-focuses it on the player every frame; with the loop frozen
    // it has to be pinned here or the station's shadows come from wherever the light
    // happened to be when the freeze landed.
    st.lighting.focus(x, z);
    st.renderer.shadowMap.needsUpdate = true;
    if (mode === 'close') {
      const p = pitch * Math.PI / 180;
      const cam = rig.camera;
      cam.position.set(x, distM * Math.sin(p), z + distM * Math.cos(p));
      cam.lookAt(x, 1.0, z);
      cam.updateMatrixWorld(true);
      // NOT st.render(): that calls rig.update() -> apply(), which would overwrite
      // this camera with the rig's own solve on the way to the draw. The post chain
      // is null at the phone tier so nothing is skipped by going direct.
      st.renderer.render(st.scene, cam);
    } else {
      rig.pitchDeg = pitch;
      rig.yawDeg = 0;
      rig.snapTo(x, z);
      st.render(0);
    }
    return st.renderer.domElement.toDataURL('image/png');
  };
})()`;

async function boot(url, suffix) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, userAgent: UA_IPHONE,
  });
  await ctx.addInitScript(HOOK);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(url + MATCH + suffix, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
    null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2200);
  // The wu->metre factor is derived FROM the running app rather than restated here:
  // a probe carrying its own copy of a scale constant is a probe that measures the
  // wrong place the day the constant moves.
  await page.evaluate(`(() => {
    if (window.__matchDebug) window.__matchDebug.paused = true;
    window.__mgFreeze();
    const st = window.__mgStage();
    let arena = null; st.scene.traverse((o) => { if (!arena && o.name === 'arena:kitchen') arena = o; });
    // groundPos maps (wu) -> metres by a single uniform scale; recover it from the pot,
    // which sits at the arena centre by construction.
    let pot = null; arena.traverse((o) => { if (!pot && o.name === 'cover:boiling_pot') pot = o; });
    window.__mgWU = pot ? pot.position.x / 1400 : 0.05;
  })()`);
  // ⚠️ THE FREEZE IS NOT INSTANT AND THAT COST TWO RUNS. Replacing `requestAnimationFrame`
  // stops the NEXT scheduling, not the callback already in flight — so one more app frame
  // lands after the evaluate returns, at a time that depends on where in the 60 Hz cycle
  // the CDP round trip finished. It re-focuses the key light on the player and re-renders
  // the shadow map, and if it lands BETWEEN two captures the pair differs by up to
  // 33/255 over 11.8% of the frame. Self-paired, intermittently, which is the worst kind.
  await page.waitForTimeout(600);
  return { browser, page, errs };
}

async function shoot(page, still) {
  if (still) await page.evaluate('window.__mgUndo = window.__mgStill()');
  const shots = {};
  for (const s of STATIONS) {
    for (const v of VIEWS) {
      const url = await page.evaluate(`window.__mgShot(${s.x}, ${s.y}, ${v.pitch}, '${v.mode}', ${v.dist})`);
      shots[`${s.id}_${v.tag}`] = Buffer.from(url.split(',')[1], 'base64');
    }
  }
  if (still) await page.evaluate('window.__mgUndo && window.__mgUndo()');
  return shots;
}

async function raw(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function diff(aBuf, bBuf, writeTo = null) {
  const a = await raw(aBuf), b = await raw(bBuf);
  if (a.w !== b.w || a.h !== b.h) return { mismatch: `size ${a.w}x${a.h} vs ${b.w}x${b.h}` };
  let sum = 0, max = 0, nz = 0, over2 = 0;
  const px = a.w * a.h;
  // A number cannot say WHERE the difference is, and where is the whole question:
  // a difference smeared over the props is a merge fault, one hugging a shadow edge
  // is a shadow-pass difference, one in a single corner is one prop.
  const heat = writeTo ? Buffer.alloc(px * 3) : null;
  for (let i = 0; i < px; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c]));
    sum += d;
    if (d > max) max = d;
    if (d > 0) nz++;
    if (d > 2) over2++;
    if (heat) { const v = Math.min(255, d * 12); heat[i * 3] = v; heat[i * 3 + 1] = v > 0 ? 40 : 0; heat[i * 3 + 2] = v > 0 ? 40 : 0; }
  }
  if (heat) await sharp(heat, { raw: { width: a.w, height: a.h, channels: 3 } }).png().toFile(writeTo);
  return { mean: sum / px, max, pctNonZero: (nz / px) * 100, pctOver2: (over2 / px) * 100, px };
}

async function main() {
  const url = baseUrl();
  mkdirSync(OUT, { recursive: true });

  console.log('\n══ mg_look — capturing three arms ══');
  const arms = {};
  for (const [name, suffix] of [['batched', ''], ['unbatched', '&merge=0'], ['batched2', '']]) {
    const { browser, page, errs } = await boot(url, suffix);
    const g = await page.evaluate(`(() => { const st = window.__mgStage(); let n = 0, m = 0;
      st.scene.traverse((o) => { n++; if (o.isMesh) m++; }); return { objects: n, meshes: m, wu: window.__mgWU }; })()`);
    arms[name] = { still: await shoot(page, true), look: await shoot(page, false), graph: g, errs };
    console.log(`   ${name.padEnd(10)} objects ${g.objects}  drawables ${g.meshes}  wu->m ${g.wu}${errs.length ? '  ⚠️ ' + errs[0] : ''}`);
    await browser.close();
  }

  for (const [arm, a] of Object.entries(arms)) {
    for (const [k, buf] of Object.entries(a.look)) writeFileSync(join(OUT, `look_${arm}_${k}.png`), buf);
    for (const [k, buf] of Object.entries(a.still)) writeFileSync(join(OUT, `still_${arm}_${k}.png`), buf);
  }

  console.log('\n── DRIFT CONTROL (batched vs batched, two independent page loads) ─────────');
  const control = {};
  for (const k of Object.keys(arms.batched.still)) {
    const d = await diff(arms.batched.still[k], arms.batched2.still[k], join(OUT, `diff_control_${k}.png`));
    control[k] = d;
    console.log(`   ${k.padEnd(12)} mean ${d.mean.toFixed(5)}/255   max ${String(d.max).padStart(3)}   ${d.pctNonZero.toFixed(4)}% of pixels differ   ${d.pctOver2.toFixed(4)}% by >2`);
  }

  console.log('\n── THE PATCH (batched vs unbatched, same bundle, ?merge=0) ────────────────');
  let worst = 0;
  for (const k of Object.keys(arms.batched.still)) {
    const d = await diff(arms.batched.still[k], arms.unbatched.still[k], join(OUT, `diff_patch_${k}.png`));
    const c = control[k];
    // The control is the floor of THIS comparison, so the verdict is stated against
    // it on both axes rather than against a chosen tolerance.
    const verdict = d.pctNonZero <= c.pctNonZero && d.max <= c.max ? 'INSIDE the drift control'
      : (d.pctNonZero <= c.pctNonZero * 1.5 && d.max <= Math.max(c.max, 4) ? 'at the control'
        : '🚨 ABOVE the control — read the diff PNG');
    worst = Math.max(worst, d.pctNonZero);
    console.log(`   ${k.padEnd(12)} mean ${d.mean.toFixed(5)}/255   max ${String(d.max).padStart(3)}   ${d.pctNonZero.toFixed(4)}% of pixels differ   ${d.pctOver2.toFixed(4)}% by >2   ${verdict}`);
  }
  console.log(`\n   PNGs in ${OUT}/ — look_* carry the pot, the cast and the VFX; still_* are the frozen pair the numbers came from.`);
}

async function selftest() {
  const url = baseUrl();
  mkdirSync(OUT, { recursive: true });
  let pass = 0, fail = 0;
  const check = (n, ok, d) => { console.log(`   ${ok ? 'PASS' : '🚨 FAIL'}  ${n}${d ? '  — ' + d : ''}`); ok ? pass++ : fail++; };
  console.log('\n══ mg_look --selftest ══');

  const { browser, page } = await boot(url, '');
  try {
    await page.evaluate('window.__mgUndo = window.__mgStill()');
    const shot = async () => Buffer.from((await page.evaluate(`window.__mgShot(1400, 1000, 58, 'match', 0)`)).split(',')[1], 'base64');

    const a = await shot();
    const b = await shot();
    const self = await diff(a, b);
    check('1. SELF-PAIR: the same page, twice, is bit-identical',
      self.max === 0 && self.pctNonZero === 0, `max ${self.max}, ${self.pctNonZero.toFixed(5)}% differ`);

    // 2. KNOWN-BAD: move ONE prop half a metre.
    await page.evaluate(`(() => {
      const st = window.__mgStage();
      let hit = null;
      st.scene.traverse((o) => { if (!hit && o.isMesh && /props:/.test(o.name || '')) hit = o; });
      if (!hit) st.scene.traverse((o) => { if (!hit && o.isMesh && /cover:/.test((o.parent && o.parent.name) || '')) hit = o; });
      window.__mgMoved = hit; hit.position.x += 0.5; hit.updateMatrixWorld(true);
      st.renderer.shadowMap.needsUpdate = true;
    })()`);
    const moved = await shot();
    const dm = await diff(a, moved);
    check('2. KNOWN-BAD MOVES: one prop nudged 0.5 m is seen',
      dm.max > 8 && dm.pctNonZero > 0.05, `max ${dm.max}, ${dm.pctNonZero.toFixed(4)}% differ`);
    await page.evaluate('window.__mgMoved.position.x -= 0.5; window.__mgMoved.updateMatrixWorld(true); window.__mgStage().renderer.shadowMap.needsUpdate = true;');

    // 3. KNOWN-BAD: a small uniform darkening — present, plausible, wrong. That is the
    // eighteenth-failure shape: a restored context 15.65 luma darker, forever.
    // ⚠️ NOT `toneMappingExposure`, which the first version used: this project ships
    // `NoToneMapping` deliberately (filmic desaturates; removed after measurement), and
    // three ignores the exposure uniform entirely under it — so the known-bad was a
    // NO-OP and the test was failing honestly. The key light's intensity is the
    // smallest global lever that survives that.
    await page.evaluate(`(() => {
      const st = window.__mgStage();
      window.__mgKey = st.lighting.key.intensity;
      st.lighting.key.intensity = window.__mgKey * 0.98;
    })()`);
    const dark = await shot();
    const dd = await diff(a, dark);
    check('3. KNOWN-BAD DARKENS: a 2% key-light drop is seen',
      dd.max >= 1 && dd.pctNonZero > 1, `max ${dd.max}, ${dd.pctNonZero.toFixed(4)}% differ`);

    console.log(`\n   ${pass}/${pass + fail} selftests pass`);
    if (fail) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

const IS_MAIN = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (IS_MAIN) {
  (flag('selftest') ? selftest() : main()).catch((e) => { console.error(e); process.exit(1); });
}
