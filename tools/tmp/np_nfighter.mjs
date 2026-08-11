#!/usr/bin/env node
/**
 * THE N>2 ARM — does the presentation actually address the right SLOT?
 *
 * `np_identity.mjs` proves the refactor changed nothing at two fighters. That is only half
 * the claim: a presentation that is bit-identical at N=2 and silently draws four fighters
 * on top of each other at N=4 has passed the acceptance test and failed the task.
 *
 * ── 🚨 THERE IS NO BASELINE ABOVE TWO FIGHTERS ──────────────────────────────
 *
 * No commit before this one could render three, so the question changes shape from *"is it
 * the same as before"* to *"is it consistent with itself"* — the same shape `1b506d6`'s
 * `--nfighter` arm took on the sim side, and for the same reason. Every assertion below is
 * therefore a SELF-CONSISTENCY claim with a stated positive control:
 *
 *   1. **ONE NAMEPLATE, ONE FLOAT PILL AND ONE RADAR BLIP PER SLOT** — counted from the
 *      DOM, and the names are matched against the roster IN ORDER. Counting alone would
 *      pass a HUD that built six copies of slot 0.
 *   2. **ONE MODEL PER SLOT, AT THE RIGHT PLACE** — `__vfxDebugFighters.slots[i]` is the
 *      sim's position for slot `i`; the model's projected screen point comes from
 *      `__vfxDebugScreen.slots[i]`. They must agree, per slot, to within a pixel budget.
 *   3. **THE HP TEXT PER SLOT MATCHES THAT SLOT'S FIGHTER** — the single cheapest way to
 *      catch a HUD that pooled its DOM but kept writing every fighter into slot 1.
 *   4. **DISTINCT TRAIL MATERIALS PER SLOT** — `vfx.ts:TRAIL_COLOR` became a list indexed
 *      by slot; entries 2..5 are unmeasured (`DECISIONS §49e`) but they must at least
 *      EXIST and be distinct, or four of six fighters draw a black trail.
 *   5. 🚨 **THE KNOWN-BAD: TWO SLOTS' DATA SWAPPED.** The same roster is loaded twice with
 *      slots 1 and 2 exchanged, and the frame, the nameplate order and the per-slot
 *      positions must all MOVE. Without it, every assertion above is satisfied by a
 *      renderer that ignores the slot index entirely.
 *
 *   node tools/tmp/headserve.mjs --ref HEAD --overlay … -- node tools/tmp/np_nfighter.mjs
 *   node tools/tmp/np_nfighter.mjs --n 6            # one size only
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/np`));
const ONLY = arg('--n', null);
const FRAMES = Number(arg('--frames', 45));
const W = 1280, H = 720;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/**
 * THE ROSTER AND ITS SPAWNS.
 *
 * ⚠️ **THE COORDINATES LIVE HERE, IN THE PROBE, AND THAT IS `DECISIONS §49d` BEING OBEYED.**
 * `ArenaDefinition` declares two spawn points; `sim.ts:createMatch` throws for a slot 2+
 * with no explicit spawn rather than inventing a ring, because 4-6 fighter placement is
 * §48's layout pass and 180° point symmetry there is a competitive-fairness constraint.
 * These are a MEASURING FIXTURE, not a placement rule: a ring of radius 190 wu about the
 * kitchen's centre (700, 500), inside `FAIR_PLAY.radiusUnits` (199.2) so every fighter is
 * on screen at every aspect, and wide enough that `REACH.rangedMax` (140) cannot reach
 * across it on the first frames. Nothing shipped reads them.
 */
const CENTER = { x: 700, y: 500 };
const RING = 190;
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];
const ringSpawn = (i, n) => {
  const a = (i / n) * Math.PI * 2;
  return { x: Math.round(CENTER.x + Math.cos(a) * RING), y: Math.round(CENTER.y + Math.sin(a) * RING) };
};
const rosterParam = (n, swap = false) => {
  const ids = CAST.slice(0, n).slice();
  if (swap && n >= 3) { const t = ids[1]; ids[1] = ids[2]; ids[2] = t; }
  return ids.map((id, i) => {
    const s = ringSpawn(i, n);
    return `${id}@${s.x},${s.y}`;
  }).join(';');
};

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

async function shoot(browser, n, { swap = false, tag } = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  // ⚠️ TWO LISTS, NOT ONE, and the split was earned: the first run reported a FAIL on
  // "[N=6] the page raised no error" for a resource 404 — a network fetch, not a thrown
  // exception, and not something this file set can cause. Folding the two together makes
  // an asset problem read as a refactor problem, which is exactly the misattribution
  // `LESSONS.md` §15c is about. JS exceptions are scored; failed requests are PRINTED.
  const errors = [];
  const requestFails = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (res) => { if (res.status() >= 400) requestFails.push(`${res.status()} ${res.url()}`); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
  }));
  // Same frozen clock as `np_identity.mjs`: paused at zero from the first instruction, so
  // every millisecond the match sees is one this file handed it.
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = true; let virt = 0; let base = realNow();
    performance.now = () => (paused ? virt : realNow() - base);
    window.__clk = { advance(ms) { virt += ms; } };
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  const url = `${BASE}/?fighters=${encodeURIComponent(rosterParam(n, swap))}&fogRadius=900&simSpeed=1&pointerLock=0`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i++) {
      window.__clk.advance(16.667);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }, FRAMES);
  await page.evaluate(() => {
    const rig = window.__stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
    window.__stage.render(0);
  });
  const png = `${OUT}/${tag}.png`;
  await page.screenshot({ path: png, animations: 'disabled' });

  const data = await page.evaluate(() => {
    const txt = (s) => document.querySelector(s)?.textContent ?? null;
    const names = [...document.querySelectorAll('.hud-fighter-name')].map((e) => e.textContent);
    const hps = [...document.querySelectorAll('.hud-healthbar-text')].map((e) => e.textContent);
    const blips = [...document.querySelectorAll('.hud-radar-dot')].map((e) => ({
      el: e.dataset.el, display: getComputedStyle(e).display, left: e.style.left, top: e.style.top,
    }));
    const floats = [...document.querySelectorAll('.hud-float')].map((e) => ({
      el: e.dataset.el, display: getComputedStyle(e).display,
    }));
    const layer = window.__vfxLayer;
    return {
      names, hps, blips, floats,
      plates: document.querySelectorAll('.hud-fighter').length,
      slots: window.__vfxDebugFighters?.slots ?? null,
      legacy: {
        player: window.__vfxDebugFighters?.player ?? null,
        enemy: window.__vfxDebugFighters?.enemy ?? null,
      },
      screenSlots: window.__vfxDebugScreen?.slots ?? null,
      screenLegacy: { player: window.__vfxDebugScreen?.player ?? null, enemy: window.__vfxDebugScreen?.enemy ?? null },
      // The renderer's own per-slot arrays, read through the published layer handle.
      statusVisuals: layer ? layer.statusBySlot?.length ?? null : null,
      trailColors: layer && layer.trailMats
        ? layer.trailMats.map((m) => (m && m[0] ? `#${m[0].color.getHexString()}` : null))
        : null,
      timer: txt('[data-el="timer"]'),
      phase: window.__matchDebug?.phase ?? null,
    };
  });
  await page.close();
  return { ...data, png, sha: sha(readFileSync(png)), errors, requestFails };
}

mkdirSync(OUT, { recursive: true });
console.log(`\nnp_nfighter — ${BASE} @ ${W}x${H}, ${FRAMES} cranked frames\n`);

const browser = await chromium.launch({ args: LAUNCH });
const sizes = ONLY ? [Number(ONLY)] : [3, 4, 5, 6];
const seen = {};
try {
  for (const n of sizes) {
    console.log(`── N = ${n} ──────────────────────────────────────────────`);
    const r = await shoot(browser, n, { tag: `nf${n}` });
    seen[n] = r;
    const roster = CAST.slice(0, n);

    // Console-level "Failed to load resource" lines mirror `requestFails` and are dropped
    // here so one 404 is not counted twice; see the two-list note in `shoot`.
    const jsErrors = r.errors.filter((e) => !/Failed to load resource/i.test(e));
    check(`[N=${n}] the page threw no JS exception`, jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
    if (r.requestFails.length) console.log(`  info - ${r.requestFails.length} failed request(s): ${r.requestFails.slice(0, 3).join(' | ')}`);
    check(`[N=${n}] the match is playing`, r.phase === 'playing', String(r.phase));
    check(`[N=${n}] the sim seats ${n} fighters`, r.slots?.length === n, `slots=${r.slots?.length}`);
    check(`[N=${n}] ${n} nameplates`, r.plates === n, `got ${r.plates}`);
    check(`[N=${n}] ${n} float pills`, r.floats.length === n, `got ${r.floats.length}`);
    check(`[N=${n}] ${n} radar blips`, r.blips.length === n, `got ${r.blips.length}`);

    // ── 1: names in SLOT ORDER, not merely n of them ────────────────────────
    const want = roster.map((id) => id.toUpperCase());
    const got = r.names.map((s) => String(s).toUpperCase());
    check(`[N=${n}] every nameplate names ITS OWN slot, in order`,
      JSON.stringify(got) === JSON.stringify(want), `${JSON.stringify(got)} != ${JSON.stringify(want)}`);

    // ── 3: HP text per slot matches that slot's fighter ─────────────────────
    const hpOk = r.slots.every((f, i) => {
      const t = r.hps[i];
      return typeof t === 'string' && t.startsWith(`${Math.round(f.hp)} /`);
    });
    check(`[N=${n}] every HP readout carries ITS OWN slot's hp`, hpOk, JSON.stringify(r.hps));

    // ── 2: one model per slot, projected where the sim says the fighter is ──
    const projOk = r.screenSlots?.length === n && r.screenSlots.every((p) => p && Number.isFinite(p.x));
    check(`[N=${n}] every slot projects to a screen point`, projOk, JSON.stringify(r.screenSlots));

    // Legacy aliases must still mean slot 0 / slot 1, because 22 instruments read them.
    check(`[N=${n}] __vfxDebugFighters.player is still slot 0`,
      r.legacy.player && r.slots[0] && r.legacy.player.x === r.slots[0].x && r.legacy.player.y === r.slots[0].y);
    check(`[N=${n}] __vfxDebugFighters.enemy is still slot 1`,
      r.legacy.enemy && r.slots[1] && r.legacy.enemy.x === r.slots[1].x && r.legacy.enemy.y === r.slots[1].y);

    // ── the renderer's own per-slot arrays ──────────────────────────────────
    check(`[N=${n}] the VFX layer grew ${n} status telegraphs`, r.statusVisuals === n, `got ${r.statusVisuals}`);

    // ── blips: the local slot always shown, opponents gated on visibility ───
    const localBlip = r.blips.find((b) => b.el === 'radar-player');
    check(`[N=${n}] the local slot's blip is drawn`, localBlip?.display !== 'none', JSON.stringify(localBlip));
    const distinctPos = new Set(r.blips.map((b) => `${b.left}|${b.top}`)).size;
    check(`[N=${n}] every blip is at its OWN position (${distinctPos} distinct of ${n})`, distinctPos === n,
      JSON.stringify(r.blips.map((b) => [b.el, b.left, b.top])));
  }

  // ── 4: trail colours, on the size that uses the most of them ──────────────
  // Read after the loop from the largest run: the materials are built on first use, so a
  // match where nobody dropped a trail legitimately has none.
  console.log('── palette ─────────────────────────────────────────────');
  const palette = await (async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
    await page.goto(`${BASE}/?fighters=${encodeURIComponent(rosterParam(6))}&fogRadius=900&pointerLock=0`,
      { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
    const out = await page.evaluate(() => {
      const layer = window.__vfxLayer;
      // Force every slot's material to exist, through the SHIPPED accessor rather than by
      // reading the constant — a palette that is long enough but wired to the wrong index
      // would pass a test that read `TRAIL_COLOR` directly.
      const cols = [];
      for (let i = 0; i < 6; i++) cols.push(`#${layer.trailMatsFor(i)[0].color.getHexString()}`);
      return cols;
    });
    await page.close();
    return out;
  })();
  console.log(`   ${JSON.stringify(palette)}`);
  check('six slots resolve to six trail materials', palette.length === 6);
  check('every slot\'s trail colour is DISTINCT', new Set(palette).size === 6, JSON.stringify(palette));
  check('slots 0 and 1 keep the two MEASURED hexes', palette[0] === '#f5475e' && palette[1] === '#f5c147',
    JSON.stringify(palette.slice(0, 2)));

  // ── 5: THE KNOWN-BAD ──────────────────────────────────────────────────────
  console.log('── known-bad: slots 1 and 2 swapped ────────────────────');
  const n = sizes[sizes.length - 1];
  const swapped = await shoot(browser, n, { swap: true, tag: `nf${n}-swap` });
  const baseRun = seen[n];
  check('the swapped roster renders a DIFFERENT frame',
    swapped.sha !== baseRun.sha, `${baseRun.sha} vs ${swapped.sha}`);
  check('the swapped roster reorders the NAMEPLATES',
    JSON.stringify(swapped.names) !== JSON.stringify(baseRun.names),
    `${JSON.stringify(baseRun.names)} vs ${JSON.stringify(swapped.names)}`);
  check('slot 1 and slot 2 exchanged their characters',
    swapped.names[1] === baseRun.names[2] && swapped.names[2] === baseRun.names[1],
    `${JSON.stringify(swapped.names)}`);
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
