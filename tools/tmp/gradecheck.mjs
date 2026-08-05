#!/usr/bin/env node
/**
 * "Which grade is the served tree ACTUALLY running?" — 20 lines, and it earned them.
 *
 * This exists because a floorprobe before/after came back BYTE-IDENTICAL at every one
 * of five stations. The tempting read was "floorprobe is insensitive to the grade".
 * The truth was that `git HEAD` had MOVED mid-session — a docs commit (`9854f2c`) had
 * swept six agents' uncommitted trees into it, including the very `stage.ts` change
 * under test — so `headserve.mjs` (HEAD) and `headserve.mjs --overlay stage.ts` were
 * serving the SAME FILE and the "before" was never a before at all.
 *
 * `docs/LESSONS.md` §13, in a new costume: the instrument was fine and the INPUT was
 * wrong, which reads exactly like an insensitive instrument. The defence is cheap —
 * before trusting any A/B, read the value you think you are varying off the live page.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/gradecheck.mjs
 *   node tools/tmp/headserve.mjs --ref 9854f2c^ -- node tools/tmp/gradecheck.mjs
 */
import { chromium } from 'playwright';
const BASE = process.env.PREVIEW_BASE;
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(`${BASE}/preview.html?piece=floor&tx=700&ty=640&t=0&shot=1`, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const s = window.__stage;
  if (!s) return { err: 'no __stage on preview page' };
  const passes = s.composer ? s.composer.passes : [];
  const fx = passes.flatMap(x => x.effects ?? []);
  const g = fx.find(e => /Grade/.test(e.name));
  return {
    hasComposer: !!s.composer,
    passes: passes.map(x => x.constructor.name),
    effects: fx.map(e => e.name),
    contrast: g ? g.uniforms.get('contrastAmount').value : null,
    usesComposerToRender: typeof s.render,
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
