#!/usr/bin/env node
/**
 * `tools/tmp/chk.mjs`, but pointed at a SNAPSHOT instead of the shared dev server.
 *
 * `chk.mjs` hardcodes localhost:5173 (`tools/TOOLS.md` warns about the same hardcoding
 * in `aspect.mjs`). A snapshot is frozen at the instant it was taken, so a peer's
 * half-saved file is baked into it and every probe run against it dies with an
 * unrelated-looking timeout. This names the 500 in two seconds and prints its body.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/chk2.mjs {URL}
 */
import { chromium } from 'playwright';
const BASE = process.argv[2];
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
p.on('response', async (r) => { if (r.status() >= 400) { console.log(r.status(), r.url()); try { console.log((await r.text()).slice(0,600)); } catch {} } });
p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0,400)));
await p.goto(BASE + '/?screen=home', {waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await b.close();
