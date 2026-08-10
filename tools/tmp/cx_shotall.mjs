#!/usr/bin/env node
/**
 * cx_shotall — drive `cr2_shot.mjs` over a list of characters against ONE snapshot.
 *
 * THROWAWAY, read-only on src/. It adds no camera, no framing and no measurement of
 * its own: it is a `for` loop so that eleven lobby captures cost ONE snapshot boot
 * instead of eleven, and so both arms of a before/after are rendered by the SAME
 * tool at the SAME frozen pitch (cr2_shot hard-codes pitch 20 — see its header for
 * why that is not a flag).
 *
 *   PREVIEW_BASE=... node tools/tmp/cx_shotall.mjs --dir shots/cx/before --label BEFORE
 *   PREVIEW_BASE=... node tools/tmp/cx_shotall.mjs --ids egg,hamburger --dir shots/cx/after
 */
import { spawn } from 'node:child_process';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const ALL = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop', 'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];
const ids = get('--ids', ALL.join(',')).split(',').filter(Boolean);
const dir = get('--dir', 'shots/cx/out');
const label = get('--label', 'shot');

let bad = 0;
for (const id of ids) {
  const code = await new Promise((res) => {
    const p = spawn('node', ['tools/tmp/cr2_shot.mjs', '--id', id, '--out', `${dir}/${id}.png`, '--label', label],
      { stdio: 'inherit', env: { ...process.env, PREVIEW_BASE: BASE } });
    p.on('exit', (c) => res(c ?? 1));
  });
  if (code !== 0) { bad++; console.error(`!! ${id} exited ${code}`); }
}
console.log(`\ncx_shotall: ${ids.length - bad}/${ids.length} captured into ${dir}`);
process.exit(bad ? 1 : 0);
