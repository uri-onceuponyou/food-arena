#!/usr/bin/env node
/**
 * up_herofill — what fraction of the CANVAS does the lobby hero actually occupy?
 *
 * Written to settle `menu_accept`'s `hero-fills-its-panel` floor, which asserted the
 * hero's projected WIDTH over its canvas at >= 0.42.
 *
 * ── WHY WIDTH WAS THE WRONG QUANTITY ────────────────────────────────────────
 * `charStage.applyFraming()` fits the subject to whichever axis BINDS and caps the
 * result at `V_FILL = 0.62` of frame HEIGHT. So for any panel wider than about 1:1 the
 * height binds, the visible world height is fixed, and the visible world WIDTH is that
 * height times the panel aspect. The identity is exact:
 *
 *     wFrac = hFrac * (subjectW / subjectH) / aspect
 *
 * i.e. widening the canvas divides the width fraction by the aspect change while the
 * picture of the hero does not change at all. The assertion is therefore a statement
 * about the PANEL'S SHAPE wearing the costume of a statement about the hero's size, and
 * it inverts the moment the panel becomes the screen — which is the composition the
 * reference plates use.
 *
 * This prints both quantities, on every viewport, so the claim is a table rather than
 * an argument. `--aspect-sweep` additionally re-measures ONE viewport at a range of
 * panel aspects, which is the direct demonstration: hFrac holds, wFrac slides.
 *
 *   node tools/tmp/up_herofill.mjs --url http://localhost:PORT
 *   node tools/tmp/up_herofill.mjs --url http://localhost:PORT --aspect-sweep
 */
import { chromium } from 'playwright';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] ?? '1';
}
const BASE = a.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const VIEWPORTS = [
  { name: 'desktop-16:9', width: 1600, height: 900 },
  { name: 'laptop-16:10', width: 1280, height: 800 },
  { name: 'tablet-4:3', width: 1024, height: 768 },
  { name: 'phone-19.5:9', width: 844, height: 390 },
  { name: 'ultrawide-21:9', width: 2560, height: 1080 },
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function readHero(page) {
  return page.evaluate(() => {
    const h = window.__charStage?.();
    if (!h || !h.feet) return null;
    return {
      id: h.id, aspect: h.aspect, fill: h.fill, subject: h.subject,
      hFrac: +Math.abs(h.feet.y - h.crown.y).toFixed(3),
      wFrac: +Math.abs(h.right.x - h.left.x).toFixed(3),
    };
  });
}

console.log(`\nup_herofill  ${BASE}\n`);
console.log('  viewport         screen    panelAspect  hFrac   wFrac   fill   subject(w x h)');

const rows = [];
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  for (const screen of ['opening', 'home']) {
    const hold = screen === 'opening' ? '&hold=120000' : '';
    await page.goto(`${BASE}/?screen=${screen}${hold}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
    await page.waitForTimeout(600);
    const h = await readHero(page);
    if (!h) { console.log(`  ${vp.name.padEnd(16)} ${screen.padEnd(9)} (no __charStage)`); continue; }
    rows.push({ vp: vp.name, screen, ...h });
    console.log(`  ${vp.name.padEnd(16)} ${screen.padEnd(9)} ${String(h.aspect).padEnd(12)} ${String(h.hFrac).padEnd(7)} ${String(h.wFrac).padEnd(7)} ${String(h.fill).padEnd(6)} ${h.subject.w} x ${h.subject.h}  (${h.id})`);
  }
  await page.close();
}

const hs = rows.map((r) => r.hFrac);
const ws = rows.map((r) => r.wFrac);
console.log(`\n  hFrac  min ${Math.min(...hs)}  max ${Math.max(...hs)}   spread ${(Math.max(...hs) - Math.min(...hs)).toFixed(3)}`);
console.log(`  wFrac  min ${Math.min(...ws)}  max ${Math.max(...ws)}   spread ${(Math.max(...ws) - Math.min(...ws)).toFixed(3)}`);

// ── The demonstration: hold the viewport, slide the PANEL's aspect ───────────
if (a['aspect-sweep']) {
  console.log('\n  aspect sweep — the SAME hero on the SAME viewport, panel widened by CSS only:');
  console.log('  panelWidth   panelAspect  hFrac   wFrac');
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
  await page.waitForTimeout(600);
  for (const w of ['40vw', '56vw', '70vw', '85vw', '100vw']) {
    await page.evaluate((width) => {
      const el = document.querySelector('.home-stage');
      if (el) el.style.width = width;
      window.dispatchEvent(new Event('resize'));
    }, w);
    await page.waitForTimeout(500);
    const h = await readHero(page);
    console.log(`  ${w.padEnd(12)} ${String(h.aspect).padEnd(12)} ${String(h.hFrac).padEnd(7)} ${h.wFrac}`);
  }
  await page.close();
}

/**
 * ── The floor has to hold for the WHOLE CAST, not for whoever is equipped ────
 *
 * The gate only ever sees the default fighter, so a floor tuned on that one is a floor
 * that can be broken by a profile change. `applyFraming()` is a closed form, so the
 * honest way to size the floor is to read each character's own measured bounding box
 * off the roster screen and evaluate the formula at the panel aspects home actually
 * uses (0.746 at 4:3 to 0.921 at 16:9, measured above):
 *
 *   h    = subjectH + PLINTH_H(0.24)
 *   w    = max(subjectW, PLINTH_BASE_W(2.48))
 *   fill = clamp(min(V_FILL 0.62, H_FILL 0.86 * aspect * h / w), 0.2, 0.62)
 *   hFrac = fill * subjectH / h
 *
 * A WIDE character is the case that binds: `w` grows, `fillFromWidth` falls below 0.62,
 * and the hero shrinks on both axes at once.
 */
if (a.roster) {
  console.log('\n  roster — every fighter, and the hFrac the formula gives at home\'s narrowest panel:');
  console.log('  character      subject(w x h)   hFrac@0.746  hFrac@0.921');
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`${BASE}/?screen=characters`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
  await page.waitForTimeout(600);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('[data-char]')].map((el) => el.dataset.char));
  const hFor = (sw, sh, aspect) => {
    const h = Math.max(0.5, sh) + 0.24;
    const w = Math.max(0.5, sw, 2.48);
    const fill = Math.min(0.62, Math.max(0.2, Math.min(0.62, (0.86 * aspect * h) / w)));
    return +(fill * sh / h).toFixed(3);
  };
  const worst = [];
  for (const id of ids) {
    await page.click(`[data-char="${id}"]`);
    await page.waitForTimeout(450);
    const h = await readHero(page);
    if (!h) continue;
    const a1 = hFor(h.subject.w, h.subject.h, 0.746);
    const a2 = hFor(h.subject.w, h.subject.h, 0.921);
    worst.push(a1, a2);
    console.log(`  ${id.padEnd(14)} ${String(h.subject.w).padEnd(5)} x ${String(h.subject.h).padEnd(7)} ${String(a1).padEnd(12)} ${a2}`);
  }
  console.log(`\n  worst hFrac over the whole cast x home's panel aspects: ${Math.min(...worst)}`);
  await page.close();
}

await browser.close();
