#!/usr/bin/env node
/**
 * Acceptance for the settings screen's GRAPHICS row.
 *
 * `docs/STATE.md` recorded "settings deliberately ships no graphics row rather than a
 * fake one" because the renderer exposed no tier. `src/render/quality.ts` now does, so
 * the row exists — and the whole reason it was withheld is that both blind menu critics
 * punished dead UI. A row that renders is therefore not the thing to assert. What is
 * asserted here is that it MOVES THE RENDERER, read back off `window.__quality` (the
 * module's own QA mirror) and off `localStorage`, never off the UI that drew it — the
 * same shape as `menu_accept`'s "the balance actually moves" and "the volume slider
 * moves the bus".
 *
 * Five properties:
 *   1. The row is the ladder. Four cells over QUALITY_CHOICES, `auto` marked, and the
 *      `auto` cell names the tier it resolved to on this device.
 *   2. A tap writes through. `qualityChoice`, `renderTier` and the storage key all move
 *      together, and the choice survives a reload.
 *   3. An EXTERNAL change repaints the row. `window.__quality.set()` is another surface;
 *      a screen that did not subscribe would sit there showing a stale radio.
 *   4. `?tier=` DISABLES it and says so. While a URL override is in force the control
 *      cannot do what it says, and a live-looking control that no-ops is the defect.
 *   5. A tier change applies to a LIVE Stage — measured on the match screen, on the
 *      drawing buffer and the shadow map, which are the two knobs that are supposed to
 *      be instant. The ink-outline caveat the row states in words is asserted too: it
 *      is the one knob that does NOT move on an already-built scene.
 *
 * Usage: node tools/tmp/with_snapshot.mjs -- node tools/tmp/quality_row.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const results = [];
let failures = 0;
const record = (group, check, ok, detail = '') => {
  results.push({ group, check, ok, detail });
  if (!ok) failures++;
};

const readRow = () => ({
  cells: [...document.querySelectorAll('[data-quality]')].map((b) => ({
    choice: b.dataset.quality,
    label: b.textContent.replace(/\s+/g, ' ').trim(),
    aria: b.getAttribute('aria-label'),
    on: b.getAttribute('aria-checked') === 'true',
    disabled: b.disabled,
    w: Math.round(b.getBoundingClientRect().width),
    h: Math.round(b.getBoundingClientRect().height),
  })),
  blurb: document.querySelector('[data-el="qualityblurb"]')?.textContent?.trim() ?? '',
  pinned: document.querySelector('[data-el="qualitypin"]')?.hidden === false
    ? document.querySelector('[data-el="qualitypin"]').textContent.replace(/\s+/g, ' ').trim()
    : null,
  q: window.__quality
    ? { tier: window.__quality.tier, choice: window.__quality.choice, forced: window.__quality.forced, detected: window.__quality.detected }
    : null,
  stored: localStorage.getItem('food-arena.quality.v1'),
});

async function run() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  let step = 'boot';
  try {
    await page.goto(`${BASE}/?screen=settings`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "settings"', null, { timeout: 45000 });

    step = 'the row is the ladder';
    const r0 = await page.evaluate(readRow);
    record('row', 'four-cells-over-QUALITY_CHOICES',
      r0.cells.map((c) => c.choice).join(',') === 'auto,high,medium,low',
      r0.cells.map((c) => `${c.choice}="${c.label}"`).join(' | '));
    record('row', 'default-is-auto-and-marked',
      r0.cells.filter((c) => c.on).length === 1 && r0.cells[0].on,
      `${r0.cells.filter((c) => c.on).length} marked, first=${r0.cells[0].on}`);
    record('row', 'auto-names-what-it-resolved-to',
      /^Auto \((High|Balanced|Battery saver)\)$/.test(r0.cells[0].aria ?? '')
      && r0.cells[0].label.includes(`(${r0.q.detected === 'high' ? 'High' : r0.q.detected === 'medium' ? 'Balanced' : 'Battery saver'})`),
      `aria="${r0.cells[0].aria}" text="${r0.cells[0].label}" detected=${r0.q.detected}`);
    record('row', 'blurb-is-the-live-profile', r0.blurb.length > 12 && /Auto picked/.test(r0.blurb), r0.blurb);
    record('row', 'not-pinned-by-default', r0.pinned === null, r0.pinned ?? '');
    record('row', 'cells-meet-the-44px-tap-floor',
      r0.cells.every((c) => c.w >= 44 && c.h >= 44),
      r0.cells.map((c) => `${c.w}x${c.h}`).join(' '));

    step = 'a tap writes through';
    await page.click('[data-quality="low"]');
    await page.waitForTimeout(80);
    const r1 = await page.evaluate(readRow);
    record('write', 'tap-moves-the-render-tier', r1.q.tier === 'low' && r1.q.choice === 'low',
      `tier=${r1.q.tier} choice=${r1.q.choice}`);
    record('write', 'tap-persists-to-storage', r1.stored === 'low', `stored="${r1.stored}"`);
    record('write', 'tap-moves-the-selection',
      r1.cells.filter((c) => c.on).length === 1 && r1.cells.find((c) => c.choice === 'low').on);
    record('write', 'blurb-follows-the-choice',
      r1.blurb.includes('phones') && !/Auto picked/.test(r1.blurb), r1.blurb);

    step = 'the choice survives a reload';
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction('window.__screen === "settings"', null, { timeout: 30000 });
    const r2 = await page.evaluate(readRow);
    record('write', 'choice-survives-a-reload',
      r2.q.tier === 'low' && r2.cells.find((c) => c.choice === 'low').on,
      `tier=${r2.q.tier}`);

    step = 'an external change repaints the row';
    // Another surface changing the tier under an open settings screen. Without an
    // `onQualityChange` subscription the radio would stay on `low` while the renderer
    // ran at `high` — a screen lying about the renderer, exactly as a stale mute
    // toggle lies about the mix.
    await page.evaluate(() => window.__quality.set('high'));
    await page.waitForTimeout(80);
    const r3 = await page.evaluate(readRow);
    record('external', 'external-set-updates-the-row',
      r3.cells.find((c) => c.choice === 'high').on && !r3.cells.find((c) => c.choice === 'low').on,
      `marked=${r3.cells.filter((c) => c.on).map((c) => c.choice).join(',')}`);

    step = 'back to auto, so nothing downstream inherits a forced tier';
    await page.click('[data-quality="auto"]');
    await page.waitForTimeout(60);
    const r4 = await page.evaluate(readRow);
    record('write', 'auto-is-reselectable', r4.stored === 'auto' && r4.q.choice === 'auto',
      `stored="${r4.stored}"`);

    step = 'reset does not clear the graphics preference';
    // Graphics is a DEVICE preference, like audio levels — not progress. The reset
    // path clears `food-arena.profile*` by prefix, and this asserts the quality key is
    // outside that prefix rather than trusting that it looks like it is.
    await page.click('[data-quality="medium"]');
    await page.waitForTimeout(60);
    const doomed = await page.evaluate(() => {
      // A profile key is planted first: with an empty store the prefix scan returns
      // [] and the assertion below would pass without ever exercising the reset rule.
      localStorage.setItem('food-arena.profile.v1', '{"planted":true}');
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      return keys.filter((k) => k && k.startsWith('food-arena.profile'));
    });
    const stillThere = await page.evaluate(() => localStorage.getItem('food-arena.quality.v1'));
    record('reset', 'quality-key-is-outside-the-profile-prefix',
      doomed.length > 0 && !doomed.includes('food-arena.quality.v1') && stillThere === 'medium',
      `reset would clear [${doomed.join(', ')}], quality="${stillThere}"`);

    step = 'a URL override disables the row';
    await page.goto(`${BASE}/?screen=settings&tier=high`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "settings"', null, { timeout: 45000 });
    const r5 = await page.evaluate(readRow);
    record('pinned', 'every-cell-is-disabled', r5.cells.every((c) => c.disabled),
      `${r5.cells.filter((c) => c.disabled).length}/4 disabled`);
    record('pinned', 'the-reason-is-stated-in-words',
      typeof r5.pinned === 'string' && /tier=/.test(r5.pinned) && /High/.test(r5.pinned),
      r5.pinned ?? 'NO NOTICE');
    record('pinned', 'the-stored-choice-is-still-shown',
      r5.cells.find((c) => c.choice === 'medium').on,
      `marked=${r5.cells.filter((c) => c.on).map((c) => c.choice).join(',')}`);
    record('pinned', 'forced-tier-is-what-the-renderer-runs',
      r5.q.forced === 'high' && r5.q.tier === 'high', `forced=${r5.q.forced} tier=${r5.q.tier}`);

    step = 'a disabled cell cannot write';
    const before = await page.evaluate(() => localStorage.getItem('food-arena.quality.v1'));
    await page.click('[data-quality="low"]', { force: true }).catch(() => {});
    await page.waitForTimeout(60);
    const after = await page.evaluate(() => localStorage.getItem('food-arena.quality.v1'));
    record('pinned', 'a-disabled-cell-writes-nothing', before === after, `${before} -> ${after}`);

    record('-', 'flow', true, 'ladder / write / reload / external / pinned');
  } catch (err) {
    record('-', 'flow', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
  }
  record('-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();

  // ── 5. It reaches a LIVE renderer ────────────────────────────────────────
  // The settings screen has no Stage of its own, so "applies immediately" has to be
  // measured where a Stage exists. Driven through `window.__quality.set`, which is the
  // exact call the row makes, on a match that is already running.
  {
    const p2 = await browser.newPage({ viewport: { width: 900, height: 600 } });
    let step2 = 'boot match';
    try {
      await p2.goto(`${BASE}/?screen=match&player=hamburger&enemy=donut&pointerLock=0`,
        { waitUntil: 'networkidle', timeout: 60000 });
      await p2.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
      await p2.waitForTimeout(400);

      step2 = 'sample';
      const sample = () => p2.evaluate(() => {
        const r = window.__stage?.renderer;
        // `toon.ts` names every ink hull `<source>__outline` (both the per-mesh form
        // at line 341 and the merged form at 539), so this counts the real thing
        // rather than a userData flag that does not exist. A count of 0 would make
        // the assertion below vacuously true, so the count itself is asserted.
        let ink = 0;
        window.__stage?.scene?.traverse?.((o) => { if (o.name?.endsWith('__outline')) ink++; });
        return {
          tier: window.__quality.tier,
          ratio: r ? r.getPixelRatio() : null,
          buffer: r ? `${r.domElement.width}x${r.domElement.height}` : null,
          shadow: r ? r.shadowMap.enabled : null,
          ink,
        };
      });
      await p2.evaluate(() => window.__quality.force('high'));
      await p2.waitForTimeout(500);
      const hi = await sample();
      await p2.evaluate(() => window.__quality.force('low'));
      await p2.waitForTimeout(500);
      const lo = await sample();
      await p2.evaluate(() => window.__quality.force(null));

      record('live', 'a-tier-change-reaches-a-running-match',
        hi.tier === 'high' && lo.tier === 'low', `${hi.tier} -> ${lo.tier}`);
      // At deviceScaleFactor 1 the caps (2 / 1.25) both clamp to 1, so the drawing
      // buffer is NOT expected to move here — that is a property of the harness, not
      // of the code, and `tools/tmp/dpr_probe.mjs` already covers it at DPR 2/3/4.
      // What IS asserted is that the change was applied without tearing the context
      // down: same canvas, still rendering, shadows still on (all three tiers).
      record('live', 'the-GL-context-survives-the-change',
        lo.buffer === hi.buffer && lo.shadow === true && hi.shadow === true,
        `buffer ${hi.buffer} -> ${lo.buffer}, shadows ${hi.shadow}/${lo.shadow}`);
      // A metric that is perfectly true and tells you nothing (docs/LESSONS.md §13):
      // "0 -> 0" would pass this forever whether or not the caveat is real. So the
      // scene is required to CONTAIN ink before the invariance means anything.
      record('live', 'the-scene-actually-has-ink-to-measure', hi.ink > 0,
        `${hi.ink} __outline meshes on high`);
      record('live', 'ink-outlines-do-NOT-change-on-a-built-scene', lo.ink === hi.ink && hi.ink > 0,
        `${hi.ink} -> ${lo.ink} ink hulls — this is exactly what the row says in words`);
    } catch (err) {
      record('live', 'a-tier-change-reaches-a-running-match', false,
        `failed at "${step2}": ${String(err).split('\n')[0]}`);
    }
    await p2.close();
  }

  await browser.close();

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.group, 9)} ${pad(r.check, 42)} ${r.detail}`);
  }
  console.log(`\n${results.length - failures}/${results.length} graphics-row checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
