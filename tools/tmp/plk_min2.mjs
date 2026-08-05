import { chromium } from 'playwright';
for (const headless of [true, false]) {
  const b = await chromium.launch({ headless });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://localhost:5173/?screen=home', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    const t = document.createElement('div');
    t.id = 'plktest';
    t.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;background:#f00;z-index:9999';
    document.body.appendChild(t);
    window.res = 'none';
    t.addEventListener('click', () => {
      try {
        const r = t.requestPointerLock();
        if (r && r.then) r.then(() => { window.res = 'ok'; }, (e) => { window.res = `rej:${e.name}:${e.message}`; });
        else window.res = 'no-promise';
      } catch (e) { window.res = `throw:${e.message}`; }
    });
  });
  await p.click('#plktest');
  await p.waitForTimeout(800);
  console.log('headless=' + headless, await p.evaluate(() => ({ res: window.res, el: document.pointerLockElement?.id ?? null, focused: document.hasFocus() })));
  await b.close();
}
