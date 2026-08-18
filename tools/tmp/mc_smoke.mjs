#!/usr/bin/env node
/**
 * A 90-second look at every derived screen, so the `admin` decision is made on numbers.
 *
 * `menu_accept` is a 20-minute battery. Before spending that on a screen list that just
 * grew by two, this walks the SAME derived list at one landscape and one portrait
 * viewport and prints, per screen: what actually mounted, how many controls it draws,
 * how many are under the 44 px floor, the widest in-flow box against the frame, and
 * whether the page threw. That is enough to tell "this screen belongs in the battery"
 * from "this screen is exempt from the house style and needs its own row".
 *
 * Not a gate. No counts, no exit code contract beyond 0/1 on a crash.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/mc_smoke.mjs
 */
import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';
import { routeChecks } from './mc_routes.mjs';

const BASE = process.env.PREVIEW_BASE ?? (() => {
  console.error('mc_smoke: PREVIEW_BASE is required — never measure on :5173');
  process.exit(2);
})();
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const VIEWPORTS = [
  { name: 'landscape-1280x800', width: 1280, height: 800 },
  { name: 'portrait-390x844', width: 390, height: 844 },
];

const probe = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const frame = document.querySelector('.fa-root');
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const controls = [...(frame?.querySelectorAll('button:not([disabled]), .fa-menuitem:not([disabled])') ?? [])].filter(vis);
  const small = controls.map((el) => el.getBoundingClientRect())
    .filter((r) => r.width < 43.5 || r.height < 43.5).length;
  let widest = 0; let widestCls = '';
  const walk = (el, d) => {
    if (d > 9) return;
    const s = getComputedStyle(el);
    const pos = s.position;
    if (pos === 'static' || pos === 'relative' || pos === 'sticky') {
      const r = el.getBoundingClientRect();
      if (r.width - vw > widest) { widest = Math.round(r.width - vw); widestCls = (el.className || el.tagName).toString().split(' ')[0]; }
    }
    for (const c of el.children) walk(c, d + 1);
  };
  if (frame) walk(frame, 0);
  return {
    detail: controls.map((el) => {
      const r = el.getBoundingClientRect();
      return `${(el.className || el.tagName).toString().split(' ').slice(0, 2).join('.')}`
        + `[${(el.textContent ?? '').trim().slice(0, 10)}] ${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
    screen: window.__screen ?? '(none)',
    root: frame ? (frame.firstElementChild?.className ?? '?') : 'NO .fa-root',
    controls: controls.length,
    small,
    over: widest, overCls: widestCls,
    docScroll: `${de.scrollWidth}x${de.scrollHeight}`,
    client: `${de.clientWidth}x${de.clientHeight}`,
  };
};

const { screens, checks } = await routeChecks();
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.check.padEnd(42)} ${c.detail}`);
console.log('');

const browser = await chromium.launch({ args: LAUNCH_ARGS });
let bad = 0;
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)); });
  console.log(`── ${vp.name} ──`);
  for (const screen of screens) {
    const before = errs.length;
    const hold = screen === 'opening' ? '&hold=120000' : '';
    let d;
    try {
      await page.goto(`${BASE}/?screen=${screen}${hold}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
      await settleScreen(page, { label: screen, timeout: 60000 });
      d = await page.evaluate(probe);
    } catch (err) {
      console.log(`  ${screen.padEnd(12)} THREW ${String(err.message ?? err).split('\n')[0].slice(0, 90)}`);
      bad++;
      continue;
    }
    const mismatch = d.screen === screen ? '' : `  <<< MOUNTED "${d.screen}"`;
    if (mismatch) bad++;
    console.log(`  ${screen.padEnd(12)} root=${String(d.root).padEnd(14)} controls=${String(d.controls).padEnd(4)}`
      + ` under44=${String(d.small).padEnd(4)} widestOver=${String(d.over).padEnd(5)}${d.over ? `(.${d.overCls})` : ''}`
      + ` doc=${d.docScroll}/${d.client} errs=${errs.length - before}${mismatch}`);
    // `MC_DETAIL=<screen>` prints every control's class and rect — how the `admin`
    // include/exclude call was actually made rather than argued.
    if (process.env.MC_DETAIL === screen) for (const line of d.detail) console.log(`      ${line}`);
  }
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
