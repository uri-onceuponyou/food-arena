#!/usr/bin/env node
/**
 * WI_DERIVE — what does a SUBORDINATE impact anchor deliver, as a function of its
 * scale factor `k`? Measured on the shipped `burst()`, not modelled.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────────
 *
 * `vfx.ts:castMuzzle` made the CAST anchor unconditional and derived its subordinate
 * factor with one line of arithmetic:
 *
 *     "A radial sprite's delivered area goes as the square of its scale, so against
 *      the primary flash's measured 735 px:  0.75x -> ~413 px"
 *
 * That derivation is correct **for a single radial sprite against a single measured
 * primary**, and it is not transferable to the impact beat, for three reasons that are
 * facts about `burst()` rather than opinions:
 *
 *   1. `burst()` is NOT one sprite. It is a star ground decal + a flash sprite + two
 *      rings + N streaks + N shards, and they scale differently:
 *        · the flash is `0.5*sf -> 1.15*sf`            — area goes as sf^2
 *        · the decal radius is `clamp(0.65*sf, 0.55, 1.5)` — CLAMPED at both ends, so
 *          for a chip hit it does not shrink with k at all
 *        · a ring is a RIM: its delivered area goes as its perimeter, i.e. as radius^1,
 *          and its radius is `0.6*sf + 0.35` — AFFINE, so halving sf does not halve it
 *        · streaks/shards are COUNTS, and area goes as count^1
 *      A single k^2 law is wrong in three of the five terms.
 *   2. There is no single "primary 735 px" to divide by. The generic impact burst is a
 *      function of `amount`, and the sixteen short weapons' generic arms span
 *      1042..5704 px (`209e270`). The floor has to hold for the SMALLEST of them.
 *   3. `castMuzzle`'s primary is one number that was already measured. The impact
 *      primary is 33 numbers that are already measured *per weapon* — so the honest
 *      move is to measure the anchor per weapon too and read off the minimum.
 *
 * So: no formula. Sweep k, fire the SHIPPED `burst()`, count pixels.
 *
 * ── HOW THE ANCHOR IS PROVOKED WITHOUT SHIPPING A QA KNOB ───────────────────────
 *
 * `burst` is a private method, which is a compile-time fact and not a runtime one, so
 * it is reachable on `Object.getPrototypeOf(window.__vfxLayer)`. This file WRAPS it for
 * the duration of one fire and multiplies exactly the two arguments the anchor will
 * multiply — `sizeFactor` and `shardCount` — leaving `origin`, `color` and `opts`
 * untouched. That means:
 *
 *   · the origin is the SHIPPED `groundPos(xWU,yWU)` result, not a re-derivation of it
 *     (re-deriving it is `docs/LESSONS.md` §5's stale-copy trap, and `wv_area.mjs`'s
 *      header refuses the same shortcut for the same reason);
 *   · every element of the burst is the shipped one;
 *   · k = 1 must reproduce the generic arm EXACTLY, which is a control this file runs.
 *
 * The bespoke `impact()` hook is deleted off the registry object for the duration
 * (exactly `wv_area.mjs`'s ablation, and the hook set is read back afterwards), because
 * a bespoke hook returns early and `burst()` is never reached at all.
 *
 * ── CONTROLS (CLAUDE.md #6 — an instrument not shown to FAIL is not an instrument) ─
 *
 *   NULL        frozen frame vs itself                -> must be 0 px, not "small"
 *   WRAP-REACH  the wrapper must actually be CALLED   -> a k-sweep on a `burst()` that
 *               was never entered would print a flat, plausible, meaningless column.
 *               Counted per fire and asserted > 0.
 *   SELF-PAIR   two UNWRAPPED fires, same seed, non-adjacent -> must be byte-identical,
 *               and this control has to pass BEFORE K1 means anything.
 *               🚨 The first version of this file compared the FIRST fire after boot
 *               against the second and called the 1-px difference a wrapper fault. It
 *               was not: `burrito.Swarm` reads 1359 px on the first fire of a session
 *               and 1360 px on every fire after it, wrapped or not. A control that
 *               cannot tell "the wrapper changed something" from "this was the first
 *               fire" is measuring the harness, so the first fire is now a discarded
 *               WARM-UP and the comparison arms are all post-warm-up.
 *   K1          k = 1 vs an unwrapped fire            -> must be byte-identical. If it
 *               is not, the wrapper changed something other than the two arguments.
 *   MONOTONE    area(k) must be non-decreasing in k on the median row -> or the sweep
 *               is measuring noise rather than scale.
 *   RESTORE     hook set + prototype read back after every fire
 *   NON-VACUITY every filtered set asserted over is checked NON-EMPTY first
 *               (`[].every()` is true — CLAUDE.md #6).
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wi -- \
 *     node tools/tmp/wi_derive.mjs --url '{URL}' --pitch 58
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

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
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('wi_derive: --url or PREVIEW_BASE required (never the shared dev server)'); process.exit(2); }
const OUT = String(args.out ?? 'shots/wi');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Same per-channel step `wv_area`, `vfx_wcov`, `pj_probe` and `vfx_coverage` use, so
 * every area here is comparable to the records those tools left behind. */
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
/** `wv_area`'s schedule, unchanged, so a k=1 row can be checked against its `genericPx`. */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number) : [16, 80, 160, 260, 400, 620]);
const KS = (args.ks ? String(args.ks).split(',').map(Number) : [0.30, 0.40, 0.50, 0.60, 0.75, 1.00]);
const SEED = Number(args.seed ?? 777);
/** The sixteen rows `209e270` found short on IMPACT — the set the anchor has to lift.
 * Kept as an explicit list rather than re-derived from a ratio threshold: the threshold
 * belongs to that commit's measurement, and re-deriving it here would make this file's
 * verdict depend on a second, unvalidated reproduction of it. */
const SHORT16 = [
  'burrito.Swarm', 'soup.Splash', 'pizza.Tomato', 'pizza.Dough', 'waterbottle.Glass',
  'hamburger.Tomato', 'sushi.Rice', 'pizza.Cheese', 'egg.Tackle', 'lollipop.Smash',
  'egg.Shards', 'soup.Noodle', 'taco.Filling', 'egg.Hatch', 'soup.Dump', 'lollipop.Giant',
];
const ONLY = args.only ? String(args.only).split(',') : null;

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

/** Pause every CSS keyframe — `docs/AGENT-BRIEF.md` §3: CSS animations run on the
 * document timeline, so freezing rAF does not still them. */
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'wi-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
    + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

async function boot(page) {
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
    window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
    performance.now = () => (paused ? virt : realNow() - base);
    // Seeded LCG, same reason as `wv_area.mjs`: these bursts randomise shard directions,
    // so two measurements of unchanged code disagree by ~15%. Every k in the sweep is
    // fired on the SAME seed, which makes the k-column a paired series rather than an
    // aggregate (CLAUDE.md #10).
    let st = 1;
    const realRandom = Math.random.bind(Math);
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = {
      seed(v) { st = ((v >>> 0) || 1); },
      restore() { Math.random = realRandom; },
      selftest() {
        window.__rng.seed(7); const a = [Math.random(), Math.random(), Math.random()];
        window.__rng.seed(7); const b = [Math.random(), Math.random(), Math.random()];
        return a.every((v, i) => v === b[i]) && a[0] !== a[1];
      },
    };
  });
}

/* eslint-disable */
async function installHarness(page, rw, rh, delta) {
  await page.evaluate(([RWv, RHv, D]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = RWv; cv.height = RHv;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    let base = null;
    // 🚨 A frozen clock does not still the camera shake, it makes it PERMANENT
    // (`docs/AGENT-BRIEF.md` §3). Zeroed before every grab, not once at setup.
    const still = () => {
      const r = stage.rig; if (!r) return;
      r.shakeAmount = 0;
      if (r.shakeOffset && r.shakeOffset.set) r.shakeOffset.set(0, 0, 0);
    };
    const grab = () => {
      still(); stage.render(0);
      c2.clearRect(0, 0, RWv, RHv); c2.drawImage(stage.canvas, 0, 0, RWv, RHv);
      return c2.getImageData(0, 0, RWv, RHv).data;
    };
    window.__wi = {
      total: RWv * RHv,
      setBase() { base = grab(); },
      count() {
        const cur = grab(); let n = 0;
        for (let i = 0; i < cur.length; i += 4) {
          const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
          if (d >= D) n++;
        }
        return n;
      },
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
      setPitch(deg, widthUnits) {
        const rig = stage.rig; if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },
    };
  }, [rw, rh, delta]);
}
/* eslint-enable */

/**
 * ONE FIRE of the generic burst with `sizeFactor` and `shardCount` scaled by `k`.
 *
 * `k === null` means "do not wrap at all" — the K1 control's reference arm, so that
 * "the wrapper is transparent at k=1" is measured against a fire that never saw it.
 */
async function fireAnchor(page, { id, key, k, at, seed, slices }) {
  return page.evaluate(async ([w, sl]) => {
    const rules = await import('/src/game/rules.ts');
    const reg = await import('/src/vfx/weapons/index.ts');
    const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };

    const v = reg.getWeaponVfx(w.id, w.key);
    const before = v ? Object.keys(v).filter((kk) => typeof v[kk] === 'function').sort() : [];
    // Take the GENERIC path: a bespoke `impact()` returns early and `burst()` is never
    // entered, so with the hook in place the k-sweep would measure nothing at all.
    const savedHook = v && typeof v.impact === 'function' ? v.impact : null;
    if (savedHook) delete v.impact;

    const L = window.__vfxLayer;
    const proto = Object.getPrototypeOf(L);
    const realBurst = proto.burst;
    let wrapCalls = 0;
    let sawArgs = null;
    if (w.k !== null) {
      proto.burst = function (origin, color, sizeFactor, shardCount, opts) {
        wrapCalls++;
        sawArgs = { sizeFactor, shardCount };
        // EXACTLY the two arguments the shipped anchor will scale, and nothing else.
        return realBurst.call(this, origin, color, sizeFactor * w.k,
          Math.max(2, Math.round(shardCount * w.k)), opts);
      };
    }

    window.__wi.reset();
    window.__wi.step(0);
    window.__wi.setBase();
    window.__rng.seed(w.seed);
    // The shipped call `match.ts:handleEvents` makes, attacker position included.
    L.spawnImpactBurst(w.x, w.y, weapon.color, weapon.damage,
      { weapon, characterId: w.id, fromXWU: w.x - 60, fromYWU: w.y });

    const series = [];
    let prev = 0;
    for (const t of sl) { window.__wi.step(t - prev); prev = t; series.push(window.__wi.count()); }
    window.__wi.reset();

    proto.burst = realBurst;
    if (savedHook) v.impact = savedHook;
    const after = v ? Object.keys(v).filter((kk) => typeof v[kk] === 'function').sort() : [];
    return {
      series, wrapCalls, sawArgs, damage: weapon.damage,
      restored: before.join(',') === after.join(',') && proto.burst === realBurst,
    };
  }, [{ id, key, k, x: at.x, y: at.y, seed }, slices]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const t0 = Date.now();
  let fail = 0;
  const bad = (m) => { fail++; log(`  🔴 ${m}`); };

  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__vfxDebugFighters, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const running = await page.evaluate(PAGE_STILL_HUD);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);
    await installHarness(page, RW, RH, DELTA);
    if (PITCH !== 58) {
      const saved = await page.evaluate(([p, w]) => window.__wi.setPitch(p, w), [PITCH, DETECT_WIDTH]);
      log(`camera: re-pitched ${saved.pitch} -> ${PITCH} deg, frameMode ${saved.mode} -> ground, width ${saved.width} -> ${DETECT_WIDTH} wu`);
    }
    log(`viewport ${W}x${H}  readback ${RW}x${RH}  delta>=${DELTA}  pitch ${PITCH}  seed ${SEED}`);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);

    const at = await page.evaluate(() => {
      const p = window.__vfxDebugFighters.player;
      return { x: p.x, y: p.y };
    });

    // ══ CONTROLS ═══════════════════════════════════════════════════════════════
    log(`\n══ CONTROLS ═══════════════════════════════════════════════════════════`);
    const nulls = await page.evaluate(() => {
      window.__wi.setBase();
      return [window.__wi.count(), window.__wi.count(), window.__wi.count()];
    });
    log(`NULL      frozen frame vs itself x3: ${nulls.join(', ')} px  (want 0,0,0)`);
    if (nulls.some((n) => n !== 0)) bad(`NULL control non-zero (${nulls.join(',')})`);

    const rngOk = await page.evaluate(() => window.__rng.selftest());
    log(`RNG       seeded LCG reproducible and non-constant: ${rngOk}`);
    if (!rngOk) bad('RNG control failed — the k-column is unpaired');

    const targets = (ONLY ?? SHORT16).map((s) => {
      const [id, key] = s.split('.');
      return { id, key };
    });
    if (!targets.length) bad('target set is EMPTY — every assertion below would be vacuous');

    // WARM-UP, discarded: the first fire of a session reads 1 px low (see SELF-PAIR in
    // the header). Every arm compared below is a post-warm-up fire.
    const warm = await fireAnchor(page, { ...targets[0], k: null, at, seed: SEED, slices: SLICES });
    const k1ref = await fireAnchor(page, { ...targets[0], k: null, at, seed: SEED, slices: SLICES });
    const k1wrap = await fireAnchor(page, { ...targets[0], k: 1, at, seed: SEED, slices: SLICES });
    const k1ref2 = await fireAnchor(page, { ...targets[0], k: null, at, seed: SEED, slices: SLICES });
    const nm = `${targets[0].id}.${targets[0].key}`;
    const selfPair = JSON.stringify(k1ref.series) === JSON.stringify(k1ref2.series);
    log(`SELF-PAIR ${nm} unwrapped twice, straddling the wrapped fire:`);
    log(`          ${k1ref.series.join(',')}  vs  ${k1ref2.series.join(',')}   identical: ${selfPair}   (warm-up, discarded: ${warm.series.join(',')})`);
    if (!selfPair) bad('SELF-PAIR control failed — this harness is order-dependent, so K1 below cannot attribute a difference to the wrapper');
    const same = JSON.stringify(k1ref.series) === JSON.stringify(k1wrap.series);
    log(`K1        ${nm} unwrapped ${k1ref.series.join(',')}`);
    log(`          ${' '.repeat(nm.length)} wrapped k=1 ${k1wrap.series.join(',')}  identical: ${same}`);
    if (!same) bad('K1 control: the wrapper is not transparent at k=1, so every k below is confounded');
    if (!k1wrap.wrapCalls) bad('WRAP-REACH: the wrapper was never called — the whole sweep would be a flat column of the SHIPPED burst');
    if (warm.wrapCalls) bad('WRAP-REACH inverted: the k=null arm entered the wrapper, so the two arms are the same code path');
    if (!k1ref.restored || !k1wrap.restored || !k1ref2.restored) bad('RESTORE control failed');
    log(`WRAP      burst() entered ${k1wrap.wrapCalls}x per fire; shipped args seen: sizeFactor ${k1wrap.sawArgs?.sizeFactor}, shards ${k1wrap.sawArgs?.shardCount} (damage ${k1wrap.damage})`);

    // ══ THE SWEEP ══════════════════════════════════════════════════════════════
    log(`\n══ AREA(k) — SHIPPED burst(), sizeFactor and shardCount both x k ═══════`);
    log(`${pad('weapon', 22)}${rpad('dmg', 4)}${KS.map((k) => rpad(`k=${k.toFixed(2)}`, 9)).join('')}`);
    const rows = [];
    for (const t of targets) {
      const row = { id: t.id, key: t.key, areas: {}, damage: 0 };
      for (const k of KS) {
        const r = await fireAnchor(page, { ...t, k, at, seed: SEED, slices: SLICES });
        if (r.err) { bad(`${t.id}.${t.key}: ${r.err}`); continue; }
        if (!r.wrapCalls) bad(`${t.id}.${t.key} k=${k}: burst() was never entered — this row is not measuring the anchor`);
        if (!r.restored) bad(`${t.id}.${t.key} k=${k}: RESTORE failed`);
        row.areas[k] = Math.max(...r.series);
        row.damage = r.damage;
      }
      rows.push(row);
      log(`${pad(`${row.id}.${row.key}`, 22)}${rpad(row.damage, 4)}${KS.map((k) => rpad(row.areas[k] ?? '-', 9)).join('')}`);
    }

    // ══ THE VERDICT ════════════════════════════════════════════════════════════
    log(`\n══ THE FLOOR EACH k CLEARS ════════════════════════════════════════════`);
    log(`the 300 px bar is vfx.ts:castMuzzle's, derived there: 282 px is "inside`);
    log(`measurement noise of the floor" and an 18 px cast is "one the player cannot see fire".`);
    log(`${pad('k', 8)}${rpad('min px', 9)}${rpad('worst row', 22)}${rpad('median px', 11)}${rpad('rows >=300', 11)}`);
    const summary = [];
    for (const k of KS) {
      const vals = rows.map((r) => ({ v: r.areas[k], n: `${r.id}.${r.key}` })).filter((x) => Number.isFinite(x.v));
      if (!vals.length) { bad(`k=${k}: no measured rows — a "min" over an empty set is vacuous`); continue; }
      vals.sort((a, b) => a.v - b.v);
      const med = vals[vals.length >> 1].v;
      const over = vals.filter((x) => x.v >= 300).length;
      summary.push({ k, min: vals[0].v, worst: vals[0].n, median: med, over, n: vals.length });
      log(`${pad(k.toFixed(2), 8)}${rpad(vals[0].v, 9)}${rpad(vals[0].n, 22)}${rpad(med, 11)}${rpad(`${over}/${vals.length}`, 11)}`);
    }

    // MONOTONE: area(k) must rise with k on the median, or the sweep is reading noise.
    if (summary.length < 2) bad('MONOTONE control needs >= 2 k values');
    else {
      const meds = summary.map((s) => s.median);
      const rises = meds.every((v, i) => i === 0 || v >= meds[i - 1] * 0.98);
      log(`\nMONOTONE  median area across k: ${meds.join(' -> ')}  non-decreasing: ${rises}`);
      if (!rises) bad('MONOTONE control failed — area(k) is not rising with k, so this sweep is measuring noise');
    }

    // The answer, stated as the smallest k that clears the bar on EVERY row.
    const ok = summary.filter((s) => s.over === s.n);
    if (!ok.length) log(`\n⚠️ NO k in ${KS.join(',')} clears 300 px on every one of the ${rows.length} rows.`);
    else log(`\nSMALLEST k clearing 300 px on all ${rows.length} rows: ${ok[0].k.toFixed(2)}  (min ${ok[0].min} px on ${ok[0].worst})`);

    await writeFile(`${OUT}/wi_derive.p${PITCH}.json`, JSON.stringify({
      pitch: PITCH, seed: SEED, slices: SLICES, ks: KS, delta: DELTA,
      readback: [RW, RH], rows, summary,
    }, null, 1));
    log(`\nwrote ${OUT}/wi_derive.p${PITCH}.json`);
    log(`${fail ? `🔴 ${fail} CONTROL FAILURE(S)` : '✅ controls pass'}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    process.exitCode = fail ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
