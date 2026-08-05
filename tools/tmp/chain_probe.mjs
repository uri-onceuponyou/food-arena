#!/usr/bin/env node
/** THROWAWAY: dump the composer's colour-space wiring and the generated EffectPass shader. */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto('http://localhost:5173/?player=hamburger&enemy=donut', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });

const info = await page.evaluate(() => {
  const s = window.__stage;
  const c = s.composer;
  const out = { passes: [], inputBufferColorSpace: c.inputBuffer?.texture?.colorSpace, frameBufferType: c.inputBuffer?.texture?.type };
  for (const p of c.passes) {
    const rec = { name: p.name, enabled: p.enabled, renderToScreen: p.renderToScreen };
    if (p.fullscreenMaterial) {
      rec.colorSpaceConversion = p.fullscreenMaterial.defines?.COLOR_SPACE_CONVERSION;
      rec.fragment = p.fullscreenMaterial.fragmentShader;
    }
    if (p.effects) rec.effects = p.effects.map((e) => ({ name: e.name, inputColorSpace: e.inputColorSpace, outputColorSpace: e.outputColorSpace }));
    out.passes.push(rec);
  }
  return out;
});
await mkdir('shots/light2', { recursive: true });
await writeFile('shots/light2/chain.json', JSON.stringify(info, null, 2));
console.log('inputBuffer colorSpace:', JSON.stringify(info.inputBufferColorSpace), 'type:', info.frameBufferType);
for (const p of info.passes) {
  console.log(`- ${p.name} enabled=${p.enabled} toScreen=${p.renderToScreen} csConv=${p.colorSpaceConversion}`,
    p.effects ? JSON.stringify(p.effects) : '');
}
const ep = info.passes.find((p) => p.name === 'EffectPass' && p.effects?.length > 1);
if (ep) {
  const frag = ep.fragment;
  const i = frag.indexOf('void main');
  console.log('\n--- EffectPass main() ---\n' + frag.slice(i, i + 2000));
}
await browser.close();
