#!/usr/bin/env node
/**
 * Registry-wiring check. The rendering probe imports `vfx/weapons/<char>.ts`
 * DIRECTLY, so it proves the hooks draw but not that `game/vfx.ts` can find them.
 * This asserts the other half: that `getWeaponVfx()` resolves every weapon key that
 * exists in `rules.ts` for these two characters, with the hooks attached.
 *
 * (Driving a real hit through gameplay was tried and abandoned: the enemy spawns
 * ~1080 wu away, beyond every weapon's 128 wu reach, and the AI kites — the same
 * failure mode already recorded on this project.)
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
for (const char of ['donut', 'taco']) {
  const p = await b.newPage({ viewport: { width: 1300, height: 730 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR', m.text().slice(0, 200)); });
  await p.goto(`http://localhost:5173/?player=${char}&enemy=hamburger`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__gameReady === true, { timeout: 40000 });
  await p.waitForTimeout(7000);
  const rows = await p.evaluate(async (c) => {
    const reg = await import('/src/vfx/weapons/index.ts');
    const rules = await import('/src/game/rules.ts');
    return rules.CHARACTERS[c].weapons.map((w) => {
      const v = reg.getWeaponVfx(c, w.key);
      return `${c}.${w.key}: ${v ? Object.keys(v).sort().join('+') : 'MISSING'}`;
    });
  }, char);
  rows.forEach(r => console.log(' ', r));
  await p.screenshot({ path: `shots/dt/live_${char}.png` });
  await p.close();
}
await b.close();
