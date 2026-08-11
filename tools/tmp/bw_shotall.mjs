#!/usr/bin/env node
/**
 * bw_shotall — drive `bw_shot.mjs` over the BROWS agent's two characters at BOTH shipped
 * cameras against ONE server boot.
 *
 * THROWAWAY, read-only on src/. It adds no camera and no measurement of its own. It
 * exists so that (a) four captures cost one boot instead of four, and (b) both arms of a
 * before/after are rendered by the SAME tool at the SAME pitch list — `bw_shot` takes a
 * `--pitch` flag, and this is where the discipline that stops an A/B comparing two
 * different cameras actually lives.
 *
 * The focus substrings are per character and live here, so a crop is always derived from
 * the geometry rather than typed as a rectangle that silently drifts between arms.
 *
 *   node tools/tmp/headserve.mjs --ref e876c3d \
 *     --overlay src/characters/lollipop.ts --overlay src/characters/waterbottle.ts \
 *     -- node tools/tmp/bw_shotall.mjs --dir shots/bw/before --label BEFORE
 */
import { spawn } from 'node:child_process';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const FOCUS = {
  lollipop: 'lollipop_sclera,lollipop_brow,lollipop_lid',
  waterbottle: 'waterbottle_sclera,waterbottle_brow',
};

const ids = get('--ids', 'lollipop,waterbottle').split(',').filter(Boolean);
const pitches = get('--pitches', '20,58').split(',').filter(Boolean);
const yaws = get('--yaws', '0').split(',').filter(Boolean);
const dir = get('--dir', 'shots/bw/out');
const label = get('--label', 'shot');
const zoom = get('--zoom', '6');

let bad = 0, n = 0;
for (const id of ids) {
  for (const p of pitches) {
    for (const y of yaws) {
      n++;
      const suffix = `p${p}${y === '0' ? '' : `_y${y}`}`;
      const args = ['tools/tmp/bw_shot.mjs', '--id', id, '--pitch', p, '--yaw', y,
        '--out', `${dir}/${id}_${suffix}.png`, '--label', label, '--zoom', zoom];
      if (FOCUS[id]) args.push('--focus', FOCUS[id]);
      const code = await new Promise((res) => {
        const c = spawn('node', args, { stdio: 'inherit', env: { ...process.env, PREVIEW_BASE: BASE } });
        c.on('exit', (x) => res(x ?? 1));
      });
      if (code !== 0) { bad++; console.error(`!! ${id} p${p} y${y} exited ${code}`); }
    }
  }
}
console.log(`\nbw_shotall: ${n - bad}/${n} captured into ${dir}`);
process.exit(bad ? 1 : 0);
