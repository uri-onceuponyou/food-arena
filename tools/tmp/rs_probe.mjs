#!/usr/bin/env node
/**
 * RS_PROBE — where does a bespoke `impact()` sculpt's area actually GO?
 *
 * `wi_guard` arm E reports two RESCUE rows at pitch 58 — `burrito.Swarm` at 128 px of
 * sculpt and `soup.Splash` at 277 px, both under the 300 px floor `vfx.ts:castMuzzle`
 * derives. Arm E's own comment states the remedy: *"the honest fix for a rescue row is
 * a better sculpt, not a bigger anchor."* CLAUDE.md #5 says find out WHY before you
 * redraw anything — every plateau probed on this project has been a bug rather than a
 * taste gap, nine for nine, and `pj_probe` is the precedent: the tomato was not a hue
 * collision, it was an AREA one, and a hue rotation cannot fix an object that is not
 * there.
 *
 * ── WHAT IT MEASURES ────────────────────────────────────────────────────────────
 *
 * The sculpt is fired ALONE — `impactAnchor` suppressed for `role === 'subordinate'`,
 * which is `wi_guard`'s own sculpt arm, re-installed here the same way — and then:
 *
 *   ELEMENTS   a per-OBJECT decomposition, and it needs no access to the weapon file.
 *              `vfx.ts:spawnTransientObject` does `this.group.add(object)`, so the
 *              objects one `impact()` spawned are exactly the children `__vfxLayer.group`
 *              gained across the call. At the peak slice each one is shown ALONE and
 *              counted, which says which primitive is carrying the effect and which
 *              ones are worth nothing. The parts do NOT sum to the whole (they overlap
 *              and they occlude each other) — this is a decomposition, not a partition,
 *              and it is reported as such.
 *   OCCLUSION  the same frame with `depthTest = false` forced on every material in the
 *              layer, against the same frame with it left alone. `vfx.ts`'s stun-star
 *              note is the precedent and the caution: the stars measured an occlusion
 *              ratio of **1.01x**, i.e. nothing was hiding them, and the real defect
 *              was that they were additive over the brightest surface in the frame.
 *              A ratio near 1.0 REFUTES "it is buried behind the fighter".
 *   TIMELINE   a fine slice schedule, because `wi_guard` samples five points and an
 *              element with a 0.14 s life can peak between two of them.
 *   PIXELS     the peak frame, plus a magenta CHANGED-PIXEL mask over it, written as
 *              PNGs — CLAUDE.md #3: read them with the Read tool and look.
 *
 * ── CONTROLS (CLAUDE.md #4 and #6) ──────────────────────────────────────────────
 *
 *   NULL       the frozen frame against itself, three times -> must be EXACTLY 0.
 *              Not a tolerance: `a1a85e5` found 344 of 344 frozen frames drifting up
 *              to 349 px because camera shake re-randomises at dt = 0, so the shake is
 *              zeroed before every single grab.
 *   SELF-PAIR  the whole sculpt arm fired twice on the same seed -> must be EXACTLY
 *              equal. If it is not, every element number below is noise.
 *   REACH      `impactAnchor` must have been ENTERED with role 'subordinate' and
 *              returned early. A silent no-suppression reports the COMPOSITE as the
 *              sculpt, which is the failure `wi_guard`'s E REACH exists for.
 *   NON-EMPTY  the element set is asserted non-empty BEFORE anything is quantified
 *              over it — `[].every()` is `true` and `Math.max(...[])` is `-Infinity`.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-rs -- \
 *     node tools/tmp/rs_probe.mjs --url '{URL}' --pitch 58 \
 *       --weapons burrito.Swarm,soup.Splash,burrito.Roll --tag before
 *
 * `burrito.Roll` is not padding: it is the CONTROL. It is the same character, the same
 * debris helpers and the same file, and it clears the floor by 4x — so any explanation
 * of `burrito.Swarm` that would also apply to `burrito.Roll` is wrong.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
if (!BASE) { console.error('rs_probe: --url or PREVIEW_BASE required (never the shared dev server)'); process.exit(2); }
const OUT = String(arg('out', 'tools/tmp/rs_out'));
const TAG = String(arg('tag', 'run'));
const PITCH = Number(arg('pitch', 58));
const DETECT_WIDTH = Number(arg('detectWidth', 150));
const SEED = Number(arg('seed', 777));
const DELTA = Number(arg('delta', 6));
const WEAPONS = String(arg('weapons', 'burrito.Swarm,soup.Splash,burrito.Roll')).split(',');
const SHOTS = arg('shots', '1') !== '0';
/**
 * `--repeat N` fires the IDENTICAL arm N times on the IDENTICAL seed and reports the
 * spread of the peak. That is this instrument's RESOLUTION FLOOR (CLAUDE.md #10: state
 * it before acting on a change in the metric), and it had to be measured rather than
 * assumed, because the obvious assumption is wrong: seeding `Math.random` does NOT make
 * a weapon VFX firing reproducible. `soup.ts`'s `nextSplatGeo` and every `materialPool`
 * in these files are ROUND-ROBIN CURSORS at module scope, so arm 2 of a pair draws a
 * different splat geometry and different pooled material slots from arm 1 whatever the
 * seed is. `wi_guard`'s own header attributes a 23.8% sculpt spread to the SEED; part of
 * it is this, and it is invariant to seeding.
 */
const REPEAT = Number(arg('repeat', 0));
/** Force the judgement PNG to a given millisecond instead of the peak. The peak is the
 * right frame for a NUMBER and often the wrong one for a LOOK: `soup.Splash`'s sheet
 * lives 0.24 s and is over long before the 320 ms slice its droplet mark peaks at. */
const SHOT_AT = Number(arg('shotAt', 0));
const W = 1600, H = 900;
const RW = W / 2, RH = H / 2;
/** `wi_guard`'s five, plus the points between them. `spawnFoilPop`'s life is 0.14 s and
 * `spawnContactFlash`'s is 0.19 s: both are gone before slice 3 of the coarse schedule. */
const SLICES = [8, 16, 32, 48, 64, 80, 110, 140, 160, 200, 230, 260, 320, 400, 500];
const FLOOR_PX = 300;

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'rs-still';
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
    let st = 1;
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = {
      seed(v) { st = ((v >>> 0) || 1); },
      selftest() {
        window.__rng.seed(7); const a = [Math.random(), Math.random(), Math.random()];
        window.__rng.seed(7); const b = [Math.random(), Math.random(), Math.random()];
        return a.every((v, i) => v === b[i]) && a[0] !== a[1];
      },
    };
  });
}

/* eslint-disable */
async function installHarness(page, rw, rh, delta, fw, fh) {
  await page.evaluate(([RWv, RHv, D, FW, FH]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = RWv; cv.height = RHv;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    const full = document.createElement('canvas');
    full.width = FW; full.height = FH;
    const f2 = full.getContext('2d', { willReadFrequently: true });
    let base = null;
    // A frozen clock does not still the camera shake, it makes it PERMANENT
    // (`docs/AGENT-BRIEF.md` §3). Zeroed before EVERY grab, not once at setup.
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
    const diff = (cur) => {
      let n = 0; let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
        const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
        if (d >= D) {
          n++;
          const x = p % RWv, y = (p / RWv) | 0;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      return { n, bbox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
    };
    window.__rs = {
      total: RWv * RHv,
      setBase() { base = grab(); },
      count() { return diff(grab()).n; },
      measure() { return diff(grab()); },
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
      /** The full-resolution canvas, plus a magenta overlay of every changed pixel.
       * The overlay is computed at the READBACK resolution the counts use and then
       * scaled up, so what you look at is exactly what was counted. */
      shot(withMask) {
        still(); stage.render(0);
        f2.clearRect(0, 0, FW, FH); f2.drawImage(stage.canvas, 0, 0, FW, FH);
        if (withMask && base) {
          c2.clearRect(0, 0, RWv, RHv); c2.drawImage(stage.canvas, 0, 0, RWv, RHv);
          const cur = c2.getImageData(0, 0, RWv, RHv).data;
          const sx = FW / RWv, sy = FH / RHv;
          f2.fillStyle = 'rgba(255,0,255,0.85)';
          for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
            const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
            if (d >= D) f2.fillRect(((p % RWv) * sx) | 0, (((p / RWv) | 0) * sy) | 0, Math.ceil(sx), Math.ceil(sy));
          }
        }
        return full.toDataURL('image/png');
      },
      setPitch(deg, widthUnits) {
        const rig = stage.rig; if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },
    };
  }, [rw, rh, delta, fw, fh]);
}
/* eslint-enable */

/**
 * ONE FIRING of one weapon's `impact()` with the shared anchor suppressed.
 *
 * `mode`:
 *   'plain'     as it ships, minus the anchor
 *   'nodepth'   the same, with `depthTest = false` on every material under the layer,
 *               re-applied after every step (the objects are added over time)
 *   'elements'  the same as 'plain', but at the peak slice each spawned object is
 *               shown ALONE and counted
 */
async function fire(page, { id, key, at, seed, slices, mode, peakMs }) {
  return page.evaluate(async ([w, sl, md, pk]) => {
    const rules = await import('/src/game/rules.ts');
    const reg = await import('/src/vfx/weapons/index.ts');
    const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };
    const v = reg.getWeaponVfx(w.id, w.key);
    if (!v || typeof v.impact !== 'function') return { err: `${w.id}.${w.key} has no bespoke impact()` };

    // `wi_guard`'s sculpt arm, verbatim: suppress the ANCHOR, not the hook.
    const proto = Object.getPrototypeOf(window.__vfxLayer);
    const realAnchor = proto.impactAnchor;
    if (typeof realAnchor !== 'function') {
      return { err: 'impactAnchor is not on the prototype — a silent no-suppression would report the COMPOSITE as the sculpt' };
    }
    let suppressed = 0;
    proto.impactAnchor = function (o, c, a, role) {
      if (role === 'subordinate') { suppressed++; return; }
      return realAnchor.call(this, o, c, a, role);
    };

    const layer = window.__vfxLayer;
    const before = new Set(layer.group.children);

    const noDepth = () => {
      layer.group.traverse((o) => {
        const m = o.material;
        if (!m) return;
        for (const mm of Array.isArray(m) ? m : [m]) { mm.depthTest = false; mm.needsUpdate = true; }
      });
    };

    window.__rs.reset();
    window.__rs.step(0);
    window.__rs.setBase();
    window.__rng.seed(w.seed);
    window.__vfxLayer.spawnImpactBurst(w.x, w.y, weapon.color, weapon.damage,
      { weapon, characterId: w.id, fromXWU: w.x - 60, fromYWU: w.y });

    const series = [];
    const bboxes = [];
    let prev = 0;
    let elements = null;
    let spawnedAtPeak = 0;
    let shot = null; let mask = null;
    for (const t of sl) {
      window.__rs.step(t - prev); prev = t;
      if (md === 'nodepth') noDepth();
      const m = window.__rs.measure();
      series.push(m.n);
      bboxes.push(m.bbox);
      if (md === 'elements' && t === pk) {
        // The objects this one `impact()` call added, in spawn order.
        const spawned = layer.group.children.filter((o) => !before.has(o));
        const shown = spawned.map((o) => o.visible);
        elements = [];
        for (let i = 0; i < spawned.length; i++) {
          for (let j = 0; j < spawned.length; j++) spawned[j].visible = (j === i);
          const o = spawned[i];
          const mat = Array.isArray(o.material) ? o.material[0] : o.material;
          elements.push({
            i,
            type: o.type,
            geo: o.geometry ? (o.geometry.type + (o.geometry.parameters && o.geometry.parameters.radius !== undefined ? '' : '')) : (o.isSprite ? 'Sprite' : '-'),
            color: mat && mat.color ? `#${mat.color.getHexString()}` : '-',
            opacity: mat ? +Number(mat.opacity).toFixed(3) : null,
            scale: [o.scale.x, o.scale.y, o.scale.z].map((n) => +n.toFixed(3)),
            pos: [o.position.x, o.position.y, o.position.z].map((n) => +n.toFixed(2)),
            px: window.__rs.count(),
          });
        }
        for (let j = 0; j < spawned.length; j++) spawned[j].visible = shown[j];
        elements.spawnedCount = spawned.length;
      }
      if (md === 'shot' && t === pk) { shot = window.__rs.shot(false); mask = window.__rs.shot(true); }
      // ⚠️ COUNTED AT THE PEAK, NOT AT THE END. This read `layer.group.children` after
      // the LAST slice and reported 0 objects for every weapon whose effect is over by
      // 500 ms — which is most of them — so the non-vacuity check below fired on three
      // healthy rows. The set it is supposed to prove non-empty is the one the element
      // table quantifies over, and that set exists at the PEAK.
      if (t === pk || spawnedAtPeak === 0) {
        spawnedAtPeak = layer.group.children.filter((o) => !before.has(o)).length;
      }
    }
    window.__rs.reset();
    proto.impactAnchor = realAnchor;
    return {
      series, bboxes, suppressed, spawnedAtPeak, elements, shot, mask,
      damage: weapon.damage, color: weapon.color,
      restored: proto.impactAnchor === realAnchor,
    };
  }, [{ id: id, key, x: at.x, y: at.y, seed }, slices, mode, peakMs]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const t0 = Date.now();
  let fail = 0;
  const bad = (m) => { fail++; log(`  🔴 ${m}`); };
  const report = { tag: TAG, pitch: PITCH, seed: SEED, delta: DELTA, slices: SLICES, weapons: {} };

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
    await installHarness(page, RW, RH, DELTA, W, H);
    if (PITCH !== 58) {
      const saved = await page.evaluate(([p, w]) => window.__rs.setPitch(p, w), [PITCH, DETECT_WIDTH]);
      log(`camera: re-pitched ${saved.pitch} -> ${PITCH} deg, frameMode ${saved.mode} -> ground, width ${saved.width} -> ${DETECT_WIDTH} wu`);
    }
    log(`\nviewport ${W}x${H}  readback ${RW}x${RH}  delta>=${DELTA}  pitch ${PITCH}  seed ${SEED}  tag ${TAG}`);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);

    // ══ CONTROLS ═══════════════════════════════════════════════════════════════
    log(`\n══ CONTROLS ═══════════════════════════════════════════════════════════`);
    const nulls = await page.evaluate(() => {
      window.__rs.setBase();
      return [window.__rs.count(), window.__rs.count(), window.__rs.count()];
    });
    log(`NULL      frozen frame vs itself x3: ${nulls.join(', ')} px  (want 0,0,0 — EXACTLY)`);
    if (nulls.some((n) => n !== 0)) bad(`NULL control non-zero (${nulls.join(',')}) — every number below is a difference of two DIFFERENT frames`);
    const rngOk = await page.evaluate(() => window.__rng.selftest());
    log(`RNG       seeded LCG reproducible and non-constant: ${rngOk}`);
    if (!rngOk) bad('RNG control failed — the self-pair below cannot mean anything');

    const at = await page.evaluate(() => {
      const p = window.__vfxDebugFighters.player;
      return { x: p.x, y: p.y };
    });
    log(`fired at  player (${at.x.toFixed(1)}, ${at.y.toFixed(1)}) wu — the same point wi_guard uses`);

    for (const w of WEAPONS) {
      const [id, key] = w.split('.');
      log(`\n${'═'.repeat(74)}\n══ ${w}`);

      const a = await fire(page, { id, key, at, seed: SEED, slices: SLICES, mode: 'plain' });
      if (a.err) { bad(`${w}: ${a.err}`); continue; }
      const b = await fire(page, { id, key, at, seed: SEED, slices: SLICES, mode: 'plain' });
      if (b.err) { bad(`${w}: ${b.err}`); continue; }

      // REACH before anything is read off the numbers.
      if (!a.suppressed) bad(`${w}: REACH — impactAnchor was never entered with role 'subordinate', so NOTHING was suppressed and every number below is the COMPOSITE`);
      if (!a.restored) bad(`${w}: the anchor was not restored — the next weapon measures a leak`);
      if (!a.spawnedAtPeak) bad(`${w}: impact() had ZERO objects live at its peak slice — the element table below would be vacuously empty`);
      // SELF-PAIR: same arm, same seed, twice. Exact or the decomposition is noise.
      const paired = a.series.length === b.series.length && a.series.every((n, i) => n === b.series[i]);
      log(`SELF-PAIR same arm twice on seed ${SEED}: ${paired ? 'EXACT' : `DIFFERS — ${a.series.join(',')} vs ${b.series.join(',')}`}`);
      if (!paired) bad(`${w}: self-pair is not exact, so the element decomposition below is measuring noise`);

      if (REPEAT > 0) {
        const peaks = [Math.max(...a.series), Math.max(...b.series)];
        for (let r = 2; r < REPEAT; r++) {
          const rep = await fire(page, { id, key, at, seed: SEED, slices: SLICES, mode: 'plain' });
          if (rep.err) { bad(`${w}: repeat ${r}: ${rep.err}`); continue; }
          peaks.push(Math.max(...rep.series));
        }
        if (!peaks.length) bad(`${w}: the repeat set is EMPTY — no floor was measured`);
        else {
          const mn = Math.min(...peaks), mx = Math.max(...peaks);
          const mean = peaks.reduce((x, y) => x + y, 0) / peaks.length;
          log(`FLOOR     ${peaks.length} identical fires, same seed: ${peaks.join(', ')} px`
            + ` — spread ${mx - mn} px = ${(mean ? (mx - mn) / mean * 100 : 0).toFixed(1)}% of the mean`);
          report.floors = report.floors ?? {};
          report.floors[w] = { peaks, min: mn, max: mx, mean: +mean.toFixed(1), spreadPct: +(mean ? (mx - mn) / mean * 100 : 0).toFixed(1) };
        }
      }
      const peakIdx = a.series.indexOf(Math.max(...a.series));
      const peakMs = SLICES[peakIdx];
      const peak = a.series[peakIdx];
      log(`suppressed ${a.suppressed} anchor call(s) · ${a.spawnedAtPeak} object(s) live at peak · damage ${a.damage} · weapon colour ${a.color}`);
      log(`TIMELINE  ${SLICES.map((t, i) => `${t}:${a.series[i]}`).join('  ')}`);
      log(`PEAK      ${peak} px at ${peakMs} ms  ${peak < FLOOR_PX ? `🔻 UNDER the ${FLOOR_PX} px floor` : `— clears ${FLOOR_PX}`}`);
      const bb = a.bboxes[peakIdx];
      log(`BBOX      ${bb ? `${bb.w}x${bb.h} px at (${bb.x},${bb.y}) of ${RW}x${RH} — fill ${(peak / (bb.w * bb.h) * 100).toFixed(1)}% of its own box` : 'EMPTY'}`);

      // ── OCCLUSION ────────────────────────────────────────────────────────────
      const nd = await fire(page, { id, key, at, seed: SEED, slices: SLICES, mode: 'nodepth' });
      const ndPeak = nd.err ? 0 : Math.max(...nd.series);
      const ratio = peak ? ndPeak / peak : 0;
      log(`OCCLUSION depthTest off: ${ndPeak} px vs ${peak} px = ${ratio.toFixed(2)}x`
        + `  ${ratio < 1.15 ? '— NOT buried; the area simply is not there' : '— a real fraction is drawn behind the fighter'}`);

      // ── ELEMENTS ─────────────────────────────────────────────────────────────
      const el = await fire(page, { id, key, at, seed: SEED, slices: SLICES, mode: 'elements', peakMs });
      const els = el.err ? null : el.elements;
      if (!els || !els.length) {
        bad(`${w}: the per-element set is EMPTY at the peak slice — nothing was quantified over (this is the vacuity CLAUDE.md #6 names)`);
      } else {
        els.sort((p, q) => q.px - p.px);
        log(`ELEMENTS at ${peakMs} ms (each shown ALONE; they overlap, so these do NOT sum to the peak)`);
        log(`  ${pad('geometry', 22)}${rpad('px', 6)}  ${pad('colour', 9)}${rpad('opac', 6)}  scale (m)`);
        for (const e of els) {
          log(`  ${pad(e.type === 'Sprite' ? 'Sprite' : e.geo, 22)}${rpad(e.px, 6)}  ${pad(e.color, 9)}${rpad(e.opacity ?? '-', 6)}  ${e.scale.join(' x ')}`);
        }
        const sum = els.reduce((s, e) => s + e.px, 0);
        const big = els[0];
        log(`  sum of parts ${sum} px vs peak ${peak} px (overlap ${sum - peak >= 0 ? `+${sum - peak}` : sum - peak}) · largest single element ${big.px} px = ${(big.px / peak * 100).toFixed(0)}% of the peak`);
      }

      // ── PIXELS ───────────────────────────────────────────────────────────────
      if (SHOTS) {
        const shotMs = SHOT_AT && SLICES.includes(SHOT_AT) ? SHOT_AT : peakMs;
        if (SHOT_AT && shotMs !== SHOT_AT) bad(`--shotAt ${SHOT_AT} is not one of the slices (${SLICES.join(',')}) — the PNG would silently be the PEAK frame instead`);
        const sh = await fire(page, { id, key, at, seed: SEED, slices: SLICES, mode: 'shot', peakMs: shotMs });
        if (sh.shot) {
          const stem = `${OUT}/rs_${TAG}_p${PITCH}_${id}.${key}${SHOT_AT ? `.t${shotMs}` : ''}`;
          await writeFile(`${stem}.png`, Buffer.from(sh.shot.split(',')[1], 'base64'));
          await writeFile(`${stem}.mask.png`, Buffer.from(sh.mask.split(',')[1], 'base64'));
          log(`PNG       ${stem}.png  and  ${stem}.mask.png (changed pixels in magenta)`);
        }
      }

      report.weapons[w] = {
        damage: a.damage, color: a.color, peak, peakMs, series: a.series, bbox: bb,
        spawned: a.spawnedAtPeak, selfPaired: paired,
        occlusionRatio: +ratio.toFixed(3), nodepthPeak: ndPeak,
        elements: els ?? [],
      };
    }

    if (!Object.keys(report.weapons).length) bad('NO weapon was measured — this run asserted over nothing');
    await writeFile(`${OUT}/rs_probe.${TAG}.p${PITCH}.json`, JSON.stringify(report, null, 1));
    log(`\n${'─'.repeat(74)}`);
    log(`${fail ? `🔴 rs_probe: ${fail} control failure(s)` : `✅ rs_probe: controls green`}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    process.exitCode = fail ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
