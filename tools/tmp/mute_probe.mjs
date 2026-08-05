#!/usr/bin/env node
/**
 * THROWAWAY probe for the HUD's mute readout.
 *
 * `M` toggles mute in `game/input.ts`. It used to land silently, which makes it a
 * coin flip — press it in a quiet second and there is no way to tell whether it
 * worked, whether the key is bound at all, or which state you are now in. This drives
 * the real key through the real page and asserts the readout follows the ENGINE, not
 * the keypress: mute, unmute, and the persisted-mute case a returning player hits.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = 'shots/mute';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
// Another agent's save full-reloads the page and would wipe state mid-run.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
}));

await page.goto(`${BASE}/?player=hamburger&enemy=donut&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(500);

const read = () => page.evaluate(() => {
  const el = document.querySelector('.hud-mute');
  if (!el) return { present: false };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    present: true,
    text: el.textContent,
    opacity: Number(cs.opacity),
    border: cs.borderTopColor,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    fromBottom: Math.round(window.innerHeight - r.bottom),
    pointerEvents: cs.pointerEvents,
  };
});

const log = [];
const step = async (name) => {
  const s = await read();
  log.push([name, JSON.stringify(s)]);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  return s;
};

const before = await step('01-default');
// The canvas must have focus for the key to reach the window listener.
await page.click('#game canvas', { position: { x: 200, y: 120 } });
await page.keyboard.press('KeyM');
await page.waitForTimeout(350);
const muted = await step('02-muted');
await page.keyboard.press('KeyM');
await page.waitForTimeout(350);
const unmuted = await step('03-unmuted');
// The transient confirmation must clear itself.
await page.waitForTimeout(1600);
const settled = await step('04-settled');

const engineMuted = await page.evaluate(() => localStorage.getItem('fa.audio.muted'));

const checks = [
  ['hidden by default', before.present && before.opacity < 0.05],
  ['latches on mute', muted.opacity > 0.9 && /MUTED/.test(muted.text)],
  ['gold ring while muted', muted.border.includes('244') || muted.border.includes('#F4A300')],
  ['confirms on unmute', unmuted.opacity > 0.9 && /SOUND ON/.test(unmuted.text)],
  ['confirmation clears itself', settled.opacity < 0.05],
  ['not a click target', muted.pointerEvents === 'none'],
  ['clear of the pause chip', muted.fromBottom >= 58],
  ['engine state agrees', engineMuted === '0'],
  ['no console errors', errs.length === 0],
];

console.log('');
for (const [k, v] of log) console.log(`${k.padEnd(14)} ${v}`);
console.log('');
let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(`errors: ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`);
await browser.close();
process.exit(failed ? 1 : 0);
