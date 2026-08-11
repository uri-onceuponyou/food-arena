#!/usr/bin/env node
/**
 * ph_gpu.mjs — WHICH RASTERISER DOES THIS HARNESS ACTUALLY GET?
 *
 * Every performance number this project owns carries the caveat "SwiftShader, a CPU
 * rasteriser, so frame time is a property of the harness". That caveat was written
 * once and never re-tested. It is worth re-testing for exactly one reason:
 *
 *   **This machine is an Apple M5 Pro.** Apple's desktop GPUs are the same
 *   tile-based deferred-rendering family as the A-series in an iPhone — same
 *   on-chip tile memory, same hidden-surface removal, same bandwidth-first cost
 *   model. A number measured on Metal here is not an iPhone number, but it is a
 *   number from the RIGHT ARCHITECTURE, which SwiftShader never is.
 *
 * So: probe every launch configuration and print what GL says it is. Nothing here
 * measures the game; this only answers "is a real GPU reachable from a probe?".
 *
 * node tools/tmp/ph_gpu.mjs
 */
import { chromium } from 'playwright';

const CONFIGS = [
  { name: 'headless-shell (what every tool here uses)', opts: { headless: true } },
  {
    name: 'headless + --use-angle=metal',
    opts: {
      headless: true,
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
    },
  },
  {
    name: 'channel:chromium (new headless) + metal',
    opts: {
      headless: true,
      channel: 'chromium',
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
    },
  },
  {
    name: 'channel:chromium HEADED + metal',
    opts: {
      headless: false,
      channel: 'chromium',
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist',
        '--window-position=4000,4000', '--window-size=500,300'],
    },
  },
];

for (const c of CONFIGS) {
  let b;
  try {
    b = await chromium.launch(c.opts);
  } catch (e) {
    console.log(`${c.name.padEnd(46)} LAUNCH FAIL  ${String(e).split('\n')[0]}`);
    continue;
  }
  const p = await b.newPage();
  const info = await p.evaluate(() => {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2') ?? cv.getContext('webgl');
    if (!gl) return { err: 'no webgl context at all' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      timerQuery: !!(gl.getExtension('EXT_disjoint_timer_query_webgl2')
        ?? gl.getExtension('EXT_disjoint_timer_query')),
    };
  });
  console.log(`${c.name.padEnd(46)} ${JSON.stringify(info)}`);
  await b.close();
}
