#!/usr/bin/env node
/**
 * PAD SWEEP — price the service-mat kerb/fill levels on the REAL composited frame
 * before a line of `floor.ts` is written.
 *
 * `floor.ts` builds the utility pads as two nested rounded boxes: a `*_trim` kerb at
 * `keyServiceMat(utilityMat) * 2.2` and a `floor_utility_pad`/`floor_service_zone`
 * fill at `keyServiceMat(utilityMat)`. This walks candidate multipliers on those two
 * materials live, re-renders the shipped frame per candidate and writes a PNG, so the
 * choice is made against `tools/tmp/edgeridge.mjs`'s numbers AND against the picture.
 *
 * `k=1,f=1` is the CONTROL and must reproduce the untouched frame — if it does not,
 * the probe is wrong and nothing downstream of it means anything (`docs/LESSONS.md`
 * §13).
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/padsweep.mjs --url {URL} \
 *     --station 430:420 --out shots/arena/sweep --pairs "1,1;0.6,1;0.45,0.9"
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5189');
const STATION = arg('station', '430:420');
const OUT = arg('out', 'shots/arena/sweep');
const PAIRS = arg('pairs', '1,1').split(';').map((s) => s.split(',').map(Number));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const [px, py] = STATION.split(':');
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=993&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(1500);

for (const [k, f] of PAIRS) {
  const info = await page.evaluate(([kerbMul, fillMul]) => {
    const stage = window.__stage;
    const scene = stage.scene;
    if (!window.__padsweepSaved) {
      const saved = [];
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const isKerb = /^(floor_utility_pad_trim|floor_service_zone_trim)$/.test(o.name);
        const isFill = /^(floor_utility_pad|floor_service_zone)$/.test(o.name);
        if (!isKerb && !isFill) return;
        const m = o.material;
        saved.push({ m, role: isKerb ? 'kerb' : 'fill', r: m.color.r, g: m.color.g, b: m.color.b });
      });
      window.__padsweepSaved = saved;
    }
    const saved = window.__padsweepSaved;
    let nk = 0, nf = 0;
    for (const s of saved) {
      const mul = s.role === 'kerb' ? kerbMul : fillMul;
      s.m.color.setRGB(s.r * mul, s.g * mul, s.b * mul);
      s.role === 'kerb' ? nk++ : nf++;
    }
    stage.render(0.0);
    return { kerbMeshes: nk, fillMeshes: nf };
  }, [k, f]);
  const name = `k${k}_f${f}`.replace(/\./g, 'p');
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1600, height: 900 } }); // capture-audit: allow SUBJECT is a hand-driven re-render of an already-settled page, not a screen navigation
  await writeFile(`${OUT}/${name}.png`, buf);
  console.log(`  ${name.padEnd(16)} kerb x${k} on ${info.kerbMeshes} meshes, fill x${f} on ${info.fillMeshes}  -> ${OUT}/${name}.png`);
}

await browser.close();
