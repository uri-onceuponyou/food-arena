#!/usr/bin/env node
/**
 * qv3_diff — a mean/max/changed-px differ with the NULL stated first.
 *
 * Two reloads of the SAME tree are not bit-identical here (the frame is stilled at a
 * pinned rAF timestamp, but which phase the pin lands on varies), so a raw cross-tree
 * delta is uninterpretable on its own. This prints the NULL (same tree, reload r1 vs
 * r2) alongside the SIGNAL (tree A vs tree B) so a difference can be read against the
 * floor it has to clear rather than against a guessed tolerance — CLAUDE.md rule 10.
 *
 *   node tools/tmp/qv3_diff.mjs --dir <shots> --a prev --b live --route characters --subj hamburger
 *   node tools/tmp/qv3_diff.mjs --selftest
 */
import sharp from 'sharp';
import { join } from 'node:path';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

async function raw(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

/** mean/max absolute RGB delta and the fraction of pixels that moved at all. */
function compare(x, y) {
  if (x.w !== y.w || x.h !== y.h) return { sizeMismatch: `${x.w}x${x.h} vs ${y.w}x${y.h}` };
  const n = x.w * x.h;
  let sum = 0, max = 0, moved = 0;
  for (let i = 0; i < n; i++) {
    const o = i * x.ch;
    const d = Math.abs(x.data[o] - y.data[o]) + Math.abs(x.data[o + 1] - y.data[o + 1]) + Math.abs(x.data[o + 2] - y.data[o + 2]);
    const m = d / 3;
    sum += m; if (m > max) max = m; if (d > 0) moved++;
  }
  return { px: n, mean: Math.round((sum / n) * 10000) / 10000, max: Math.round(max * 100) / 100, movedPct: Math.round((moved / n) * 10000) / 100 };
}

if (has('--selftest')) {
  // §A the differ must MOVE on a real difference and HOLD on identical input, and it
  //    must do both on a NON-EMPTY buffer — a zero-pixel image would make every mean
  //    vacuously 0 (`[].every()` is `true`; a sum over nothing is 0, which reads as
  //    "identical" and is the same trap wearing arithmetic's clothes).
  const mk = (v) => ({ data: Buffer.from([v, v, v, 255, v, v, v, 255]), w: 2, h: 1, ch: 4 });
  const fail = [];
  const same = compare(mk(10), mk(10));
  if (same.px === 0) fail.push('A0: empty buffer — every metric vacuous');
  if (same.mean !== 0 || same.movedPct !== 0) fail.push(`A: differ fires on identical input ${JSON.stringify(same)}`);
  const diff = compare(mk(10), mk(20));
  if (diff.mean !== 10 || diff.max !== 10 || diff.movedPct !== 100) fail.push(`B: differ wrong on a known 10/255 step ${JSON.stringify(diff)}`);
  const one = compare({ data: Buffer.from([10, 10, 10, 255, 10, 10, 10, 255]), w: 2, h: 1, ch: 4 },
    { data: Buffer.from([10, 10, 10, 255, 40, 10, 10, 255]), w: 2, h: 1, ch: 4 });
  if (one.movedPct !== 50 || one.max !== 10) fail.push(`C: single-channel single-pixel case ${JSON.stringify(one)}`);
  if (!compare(mk(10), { ...mk(10), w: 3 }).sizeMismatch) fail.push('D: size mismatch not caught');
  if (fail.length) { console.error('SELFTEST FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('SELFTEST PASS (A0 non-empty, A holds, B moves by a known step, C per-pixel, D size guard)');
  process.exit(0);
}

const dir = get('--dir', null);
const a = get('--a', 'prev');
const b = get('--b', 'live');
const route = get('--route', 'characters');
const subj = get('--subj', 'hamburger');
if (!dir) { console.error('need --dir'); process.exit(2); }
const f = (label, rep) => join(dir, `${label}_${rep}_${route}_${subj}.png`);

const [a1, a2, b1, b2] = await Promise.all([raw(f(a, 'r1')), raw(f(a, 'r2')), raw(f(b, 'r1')), raw(f(b, 'r2'))]);
const nullA = compare(a1, a2);
const nullB = compare(b1, b2);
const sig11 = compare(a1, b1);
const sig22 = compare(a2, b2);
console.log(`subject=${subj} route=${route}  ${a1.w}x${a1.h} px`);
console.log(`  NULL   ${a}  r1 vs r2 : ${JSON.stringify(nullA)}`);
console.log(`  NULL   ${b}  r1 vs r2 : ${JSON.stringify(nullB)}`);
console.log(`  SIGNAL ${a} vs ${b} r1 : ${JSON.stringify(sig11)}`);
console.log(`  SIGNAL ${a} vs ${b} r2 : ${JSON.stringify(sig22)}`);
const floor = Math.max(nullA.mean, nullB.mean);
const sig = Math.min(sig11.mean, sig22.mean);
console.log(`  floor(mean) ${floor}   signal(mean, worst-case=min) ${sig}   ratio ${floor > 0 ? Math.round((sig / floor) * 100) / 100 : 'inf'}`);
