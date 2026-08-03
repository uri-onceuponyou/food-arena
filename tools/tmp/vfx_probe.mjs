import { chromium } from 'playwright';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1300, height: 820 } });
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));

  await page.goto('http://localhost:5173/?simSpeed=1&player=lollipop&enemy=hamburger', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'shots/vfx/r1/probe_start.png' });

  // dump global state shape
  const keys = await page.evaluate(() => Object.keys(window).filter(k => k.startsWith('__')));
  console.log('window __ keys:', keys);

  await browser.close();
}
main();
