/**
 * WHICH MESHES WEAR A MATERIAL?
 *
 * `matcover` reports coverage per MATERIAL, and every material `buildMaterials` makes is
 * named `kpal:<key>` — but the arena also builds materials outside that factory, and those
 * show up as `(unnamed)`. One of them turned out to be 7.5% of the frame at hue 20 deg,
 * i.e. the third-largest surface in the game sitting inside the cast's own hue band, with
 * nothing in the report naming it.
 *
 * This walks the live scene once and prints, for every material (or only the ones whose
 * name matches `--filter`), the mesh names that use it and their ancestor chain — which is
 * enough to point at a source file in one read. No renders, so it costs one page load.
 *
 *   node tools/tmp/whomat.mjs --url http://localhost:5192 --station 570:430 --filter '(unnamed)'
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5192');
const STATION = arg('station', '570:430');
const FILTER = arg('filter', '');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const [px, py] = STATION.split(':');
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(1000);

const rows = await page.evaluate((FILTER) => {
  const byMat = new Map();
  window.__stage.scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    const name = m.name || '(unnamed)';
    if (FILTER && !name.includes(FILTER)) return;
    const key = name + '|' + (m.color ? '#' + m.color.getHexString().toUpperCase() : '-') + '|' + m.type;
    const chain = [];
    for (let p = o.parent; p && chain.length < 4; p = p.parent) if (p.name) chain.push(p.name);
    const e = byMat.get(key) ?? { key, n: 0, meshes: new Set(), chains: new Set(), hasMap: !!m.map, transparent: !!m.transparent };
    e.n++;
    e.meshes.add(o.name || '(anon)');
    e.chains.add(chain.join(' < '));
    byMat.set(key, e);
  });
  return [...byMat.values()].map((e) => ({ ...e, meshes: [...e.meshes].slice(0, 8), chains: [...e.chains].slice(0, 4) }))
    .sort((a, b) => b.n - a.n);
}, FILTER);

await browser.close();
for (const r of rows) {
  console.log(`\n${r.key}   x${r.n}  map=${r.hasMap} transparent=${r.transparent}`);
  console.log(`   meshes: ${r.meshes.join(', ')}`);
  for (const c of r.chains) console.log(`   under : ${c}`);
}
