#!/usr/bin/env node
/**
 * ey_shotall — drive `ey_shot.mjs` over a list of characters AND a list of pitches
 * against ONE snapshot boot.
 *
 * THROWAWAY, read-only on src/. It adds no camera and no measurement of its own: it is
 * a nested `for` loop so that eight captures (4 characters x 2 shipped cameras) cost
 * ONE snapshot boot instead of eight, and — the reason it exists rather than being
 * inlined — so both arms of a before/after are rendered by the SAME tool at the SAME
 * pitch list. `cc_shot` takes a `--pitch` flag; this is where the discipline that stops
 * an A/B from comparing two different cameras actually lives.
 *
 *   PREVIEW_BASE=... node tools/tmp/ey_shotall.mjs --dir shots/ey/before --label BEFORE
 *   PREVIEW_BASE=... node tools/tmp/ey_shotall.mjs --ids pizza --pitches 20 --dir shots/ey/after
 */
import { spawn } from 'node:child_process';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const MINE = ['taco', 'donut', 'lollipop', 'waterbottle'];
const ids = get('--ids', MINE.join(',')).split(',').filter(Boolean);
const pitches = get('--pitches', '20,58').split(',').filter(Boolean);
const yaws = get('--yaws', '0').split(',').filter(Boolean);
const dir = get('--dir', 'shots/ey/out');
const label = get('--label', 'shot');

let bad = 0, n = 0;
for (const id of ids) {
  for (const p of pitches) {
    for (const y of yaws) {
      n++;
      const suffix = `p${p}${y === '0' ? '' : `_y${y}`}`;
      const code = await new Promise((res) => {
        const c = spawn('node', ['tools/tmp/ey_shot.mjs', '--id', id, '--pitch', p, '--yaw', y,
          '--out', `${dir}/${id}_${suffix}.png`, '--label', label],
          { stdio: 'inherit', env: { ...process.env, PREVIEW_BASE: BASE } });
        c.on('exit', (x) => res(x ?? 1));
      });
      if (code !== 0) { bad++; console.error(`!! ${id} p${p} y${y} exited ${code}`); }
    }
  }
}
console.log(`\ney_shotall: ${n - bad}/${n} captured into ${dir}`);
process.exit(bad ? 1 : 0);
