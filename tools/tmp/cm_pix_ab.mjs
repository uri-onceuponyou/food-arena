#!/usr/bin/env node
/**
 * cm_pix_ab — the RENDERED half of the migration's byte-identity acceptance test.
 *
 * `cm_geom_ab.mjs` compares every float of every geometry, which is the stronger
 * test. This one answers the other question: does the SHIPPED path — real renderer,
 * real post chain, real materials — agree? A geometry proof that never reaches a
 * frame has been wrong before (`docs/LESSONS.md`: "it isn't there" meant "it IS there
 * and is INVISIBLE" twenty times).
 *
 * It compares the raw RGBA DRAWING BUFFERS written by `cm_shot.mjs`, not the PNGs: a
 * PNG carries an encoder, and two encoders agreeing is not two renders agreeing.
 *
 * ── CONTROLS (a comparator that cannot see a diff proves nothing) ────────────
 *   SELF-PAIR  `--self <dir>` compares a directory with itself. MUST be 0.000.
 *   POISON     `--poison` flips ONE byte of ONE frame in the B arm and REQUIRES the
 *              comparison to report exactly one differing pixel.
 * Both run automatically on every A/B.
 *
 * Usage:
 *   node tools/tmp/cm_pix_ab.mjs --before shots/cm/before --after shots/cm/after
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BEFORE = get('--before', null);
const AFTER = get('--after', null);
if (!BEFORE || !AFTER) { console.error('usage: --before <dir> --after <dir>'); process.exit(2); }

const names = readdirSync(BEFORE).filter((f) => f.endsWith('.raw')).sort();
if (!names.length) { console.error(`no .raw captures in ${BEFORE}`); process.exit(2); }

/** Returns {pixels, maxDelta, where} for two RGBA buffers of equal length. */
function diff(x, y) {
  if (x.length !== y.length) return { pixels: -1, maxDelta: Infinity, where: `length ${x.length} vs ${y.length}` };
  let pixels = 0, maxDelta = 0, where = '';
  for (let i = 0; i < x.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(x[i + c] - y[i + c]));
    if (d) {
      pixels++;
      if (d > maxDelta) { maxDelta = d; where = `byte ${i} Δ${d}`; }
    }
  }
  return { pixels, maxDelta, where };
}

function run(title, dirA, dirB, mutate) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
  let bad = 0, total = 0;
  for (const n of names) {
    const pa = path.join(dirA, n), pb = path.join(dirB, n);
    if (!existsSync(pb)) { console.log(`  MISSING   ${n} in ${dirB}`); bad++; continue; }
    const x = readFileSync(pa);
    const y = Buffer.from(readFileSync(pb));
    if (mutate) mutate(y, n);
    const d = diff(x, y);
    total += x.length / 4;
    const ok = d.pixels === 0;
    if (!ok) bad++;
    console.log(`  ${ok ? 'IDENTICAL' : '  DIFFERS '}  ${n.replace('.raw', '').padEnd(22)} ` +
      `px=${String(x.length / 4).padStart(8)}  diff=${String(d.pixels).padStart(8)}` +
      (ok ? '' : `  maxΔ=${d.maxDelta}  ${d.where}`));
  }
  console.log(`  ${bad === 0 ? '✅' : '🔴'} ${names.length - bad}/${names.length} frames identical  (${total.toLocaleString()} pixels compared)`);
  return bad;
}

// SELF-PAIR — the drift control.
if (run('SELF-PAIR CONTROL (before vs before) — must be 0', BEFORE, BEFORE, null)) {
  console.error('\n🔴 SELF-PAIR FAILED — every number below is void.');
  process.exit(1);
}

// POISON — one byte, one frame. Must show up as exactly one pixel.
{
  let done = false;
  const bad = run('POISON CONTROL (1 byte in one frame) — must show 1 pixel', BEFORE, BEFORE,
    (buf, n) => { if (!done && n === names[0]) { buf[0] = buf[0] ^ 1; done = true; } });
  if (bad !== 1) {
    console.error(`\n🔴 POISON CONTROL FAILED — expected exactly 1 frame to differ, got ${bad}.`);
    process.exit(1);
  }
  console.log('  ✅ the comparator sees a single flipped byte');
}

const fails = run('MIGRATION A/B (before vs after) — the acceptance test', BEFORE, AFTER, null);
console.log(fails === 0
  ? `\n✅ PASS — all ${names.length} rendered frames byte-identical across the migration.`
  : `\n🔴 FAIL — ${fails} frame(s) moved. Name the pixel and why, or revert.`);
process.exit(fails === 0 ? 0 : 1);
