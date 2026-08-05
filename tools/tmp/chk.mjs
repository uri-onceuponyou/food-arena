#!/usr/bin/env node
/**
 * Is the dev server serving a clean tree right now?
 *
 * In a multi-agent session another agent's half-saved file makes Vite return 500 for
 * that module and every probe on the project fails to boot with an unrelated-looking
 * timeout. This prints the offending URL in two seconds so you stop debugging your
 * own change. Silence = clear.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
p.on('response', async (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0,400)));
await p.goto('http://localhost:5173/?simSpeed=0.0001&player=taco&enemy=hamburger', {waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await b.close();
