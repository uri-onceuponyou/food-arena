#!/usr/bin/env node
/**
 * WTZ_SHOT — photograph the beat a weapon ACTUALLY draws, for the description audit.
 *
 * The audit question is "does the picture match the sentence on the card", and
 * `CLAUDE.md` rule 3 says judge rendered pixels, not a description of them — which is
 * exactly the failure the audit is about. So this fires `match.ts`'s real
 * `weapon-fired` set (`__vfxSpawnTest('weaponFired', …)` -> `spawnWeaponCast`, i.e.
 * cast flash + bespoke `cast()` + the generic melee wedge + any slam shockwave) and
 * the real `impact` set, freezes, and writes ONE png per beat.
 *
 * ⚠️ DELIBERATELY FEW FRAMES. Peers are capturing; this takes one browser, one page,
 * and 2 renders per beat.
 *
 * ⚠️ A ZERO-PIXEL ROW IS A RESULT, NOT A BUG IN THIS TOOL — so every beat is reported
 * with a same-frame ablation count (pixels that CHANGED against the pre-fire frame)
 * beside its png. `docs/AGENT-BRIEF.md` §4.2: "it isn't there" means it is there and
 * invisible, so a png I cannot see anything in must be separated from a beat that
 * drew nothing. The `--selftest` arm requires a known-empty beat to read 0 and a
 * known-loud one to read large, on the same page, before any row is believed.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean-072f245 -- \
 *     node tools/tmp/wtz_shot.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2), n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE;
const OUT = args.out ?? 'shots/wtz';
const W = Number(args.w ?? 1280), H = Number(args.h ?? 720);

/** char, weaponKey, beat, and the sentence on the card this frame has to answer. */
const BEATS = [
  ['waterbottle', 'Mega', 'weaponFired', 'launches himself up / cap becomes a second bottle / one giant bottle dumps water'],
  ['waterbottle', 'Mega', 'impact', 'dumps water on an enemy for huge damage'],
  ['waterbottle', 'Cap', 'weaponFired', 'fires his cap'],
  ['waterbottle', 'Spray', 'weaponFired', 'sprays water'],
  ['soup', 'Dump', 'weaponFired', 'tips himself over, pouring all his soup and noodles'],
  ['hotdog', 'Mustard', 'weaponFired', 'burns enemies from a distance'],
];

async function main() {
  if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));

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
      let paused = false, virt = 0; const base = realNow();
      window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
      performance.now = () => (paused ? virt : realNow() - base);
    });

    // A warm load first: a fresh snapshot's FIRST client eats a dep-optimisation
    // reload that presents as "execution context was destroyed" (AGENT-BRIEF §3).
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(800);

    await page.goto(`${BASE}/?player=waterbottle&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.hud-countdown{display:none !important} *{animation:none !important;transition:none !important}' });
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const stage = window.__stage;
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 180;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      let base = null;
      const grab = () => {
        stage.render(0);
        c2.clearRect(0, 0, 320, 180);
        c2.drawImage(stage.canvas, 0, 0, 320, 180);
        return c2.getImageData(0, 0, 320, 180).data;
      };
      window.__wtz = {
        clear() { window.__vfxLayer.clear(); window.__clk.advance(1200); window.__vfxLayer.updateEffects(1.2); },
        setBase() { base = grab(); },
        changed() {
          const cur = grab();
          let n = 0;
          for (let i = 0; i < cur.length; i += 4) {
            const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
            if (d >= 6) n++;
          }
          return n;
        },
        fire(kind, who, key) {
          const f = window.__vfxDebugFighters.player;
          window.__vfxSpawnTest(kind, f.x, f.y, 18, '#1E90D8', who, key);
        },
        step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
        draw() { stage.render(0); },
      };
    });

    // ── CONTROL, before any row is believed ───────────────────────────────────
    // A beat that fires nothing must read ~0 changed px, and a beat that fires the
    // loudest thing in the game must read large. Without this pair a 0 on a real
    // row cannot be told from a broken harness.
    await page.evaluate(() => { window.__wtz.clear(); window.__wtz.setBase(); });
    const nullPx = await page.evaluate(() => { window.__wtz.step(16); return window.__wtz.changed(); });
    await page.evaluate(() => { window.__wtz.clear(); window.__wtz.setBase(); window.__wtz.fire('weaponFired', 'lollipop', 'Giant'); });
    const loudPx = await page.evaluate(() => { window.__wtz.step(60); return window.__wtz.changed(); });
    console.log(`CONTROL  null beat ${nullPx} px · lollipop.Giant ${loudPx} px  (of 57600 sampled)`);
    if (!(nullPx < 200 && loudPx > 2000)) {
      console.log('🔴 INSTRUMENT INVALID — the ablation cannot tell an empty beat from a loud one. No row below is evidence.');
    }

    for (const [who, key, kind, claim] of BEATS) {
      await page.evaluate(() => { window.__wtz.clear(); window.__wtz.setBase(); });
      await page.evaluate(([k, w, y]) => window.__wtz.fire(k, w, y), [kind, who, key]);
      // 60 ms: past the 16 ms first frame, inside every cast/impact life here
      // (0.12-0.42 s), so a beat that exists is at or near its peak.
      const px = await page.evaluate(() => { window.__wtz.step(60); return window.__wtz.changed(); });
      await page.evaluate(() => window.__wtz.draw());
      const file = `${OUT}/${who}.${key}.${kind}.png`;
      await page.locator('canvas').screenshot({ path: file });
      console.log(`${who}.${key} ${kind.padEnd(12)} ${String(px).padStart(6)} px changed  -> ${file}\n    claim: "${claim}"`);
    }
  } finally {
    await browser.close();
  }
}
main();
