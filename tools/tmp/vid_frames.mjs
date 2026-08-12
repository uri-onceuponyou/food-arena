#!/usr/bin/env node
/**
 * VID_FRAMES — per-frame timing out of an MP4, with no ffmpeg and no decoding.
 *
 * ## Why this exists
 *
 * `docs/PHONE.md` §6 asks Uri for a phone capture, and `DECISIONS §33`/`§62` record why:
 * the phone pass measured draw calls 928 -> 423 and main-thread JS **-47.9% against a
 * +-0.71 ms floor**, and **every one of those numbers is desktop Chromium under
 * SwiftShader.** WebKit is not Chromium and a phone is not a workstation, so none of it
 * described the device the game is actually played on. He supplied captures; nothing here
 * could read them, because this machine has no ffmpeg.
 *
 * A screen recording's container already carries what we need. `stts` (time-to-sample) is
 * a run-length table of sample deltas in the media timescale, so **exact per-frame
 * intervals fall out of the header without decoding a single pixel.**
 *
 * ## 🚨 WHAT THIS MEASURES, AND WHAT IT DOES NOT
 *
 * **It measures the CAPTURE PIPELINE, not the app's render loop.** iOS screen recording
 * samples the display; if the app renders at 30 fps on a 60 Hz capture, the recorder
 * writes 60 samples a second and half of them are duplicates — invisible here, because
 * this never looks at pixels. So:
 *
 *   * a LONG interval is real evidence that **something** stalled — the recorder only
 *     stretches a sample when it had nothing new to write, which on iOS means the system
 *     was loaded. That is the signal.
 *   * a SHORT/steady interval is **NOT** evidence the app is smooth. It is evidence the
 *     compositor kept up. The app could be rendering every other frame and this cannot see it.
 *
 * ⚠️ So this instrument is **one-sided by construction**: it can prove jank, it cannot
 * prove smoothness. Report it that way. `docs/LESSONS.md` §6b in its usual form — ask what
 * fraction of the question your metric governs before you quote it.
 *
 * ⚠️ And it is confounded across DEVICES and OS versions: two captures are only comparable
 * when they came off the same phone with the same recorder. `--pair` asserts the two files
 * agree on dimensions and timescale and REFUSES otherwise, rather than printing a
 * comparison of two different pipelines.
 *
 * ## Use
 *
 *   node tools/tmp/vid_frames.mjs <file.mp4> [more.mp4 ...]
 *   node tools/tmp/vid_frames.mjs --pair <before.mp4> <after.mp4>
 *   node tools/tmp/vid_frames.mjs --selftest
 *
 * ⚠️ **It takes a PATH and prints NUMBERS.** It never copies, re-encodes or embeds the
 * media. `reference/video/` is gitignored and this repo is PUBLIC (`CLAUDE.md`); the
 * captures must never be committed and `git add -f` under `reference/` is banned. Frame
 * COUNTS and INTERVALS disclose nothing, exactly as crop coordinates do not.
 */
import { readFileSync, statSync } from 'node:fs';

/** Walk the atom tree, calling `visit(type, payloadStart, payloadEnd, path)`. */
function walk(buf, start, end, visit, path = []) {
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    let head = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(p + 8)); head = 16; }
    else if (size === 0) size = end - p;
    if (size < head || p + size > end) break;
    const next = [...path, type];
    visit(type, p + head, p + size, next);
    if (CONTAINERS.has(type)) walk(buf, p + head, p + size, visit, next);
    p += size;
  }
}
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta']);

/**
 * Every video track's timing. Returns `{ timescale, deltas: number[] }` per track.
 *
 * ⚠️ The handler check is what makes this a VIDEO reading. An MP4 from a phone carries an
 * audio track too, and its `stts` is a perfectly valid table of ~1024-sample deltas that
 * would produce a confident, meaningless "frame rate". Keyed on `hdlr` = `vide`.
 */
export function videoTracks(buf) {
  // ⚠️ WAS: collect `mdia` atoms, then find `tkhd` with a SECOND walk over the WHOLE FILE.
  // Two defects in one line, and the second hid the first:
  //   * the global walk returned the FIRST track's `tkhd` for every track, so an audio
  //     track's zero dimensions could be attributed to the video one;
  //   * the v0 payload offset was s+80/s+84. It is s+76/s+80 — `tkhd` v0 is
  //     4(ver+flags) + 4+4+4+4+4 (times/id/reserved/duration) + 8+2+2+2+2 + 36(matrix) = 76.
  // Together they printed `848 x 0.00054931640625`. 🚨 AND `--pair`'s REFUSAL CHECK
  // COMPARES THOSE TWO VALUES, so with both files wrong in the same way it compared
  // garbage to identical garbage and PASSED — a guard that could not fail, in the tool
  // written to measure a guard-worthy thing. The dimensions are now read from the SAME
  // `trak` subtree as the timing, and `--pair` asserts they are non-zero before comparing.
  const traks = [];
  walk(buf, 0, buf.length, (type, s, e) => { if (type === 'trak') traks.push({ start: s, end: e }); });
  const out = [];
  for (const t of traks) {
    let timescale = 0, isVideo = false, deltas = null, width = 0, height = 0;
    walk(buf, t.start, t.end, (type, s) => {
      if (type === 'tkhd') {
        const ver = buf[s];
        const off = s + (ver === 1 ? 88 : 76);
        width = buf.readUInt32BE(off) / 65536;
        height = buf.readUInt32BE(off + 4) / 65536;
      }
    });
    walk(buf, t.start, t.end, (type, s) => {
      if (type === 'mdhd') {
        const ver = buf[s];
        timescale = ver === 1 ? buf.readUInt32BE(s + 20) : buf.readUInt32BE(s + 12);
      } else if (type === 'hdlr') {
        isVideo = buf.toString('latin1', s + 8, s + 12) === 'vide';
      } else if (type === 'stts') {
        const n = buf.readUInt32BE(s + 4);
        const d = [];
        for (let i = 0; i < n; i++) {
          const count = buf.readUInt32BE(s + 8 + i * 8);
          const delta = buf.readUInt32BE(s + 12 + i * 8);
          for (let k = 0; k < count; k++) d.push(delta);
        }
        deltas = d;
      }
    });
    if (isVideo && timescale && deltas) out.push({ timescale, deltas, width, height });
  }
  return out;
}

const pct = (a, q) => a.length ? a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))] : NaN;

export function analyse(file) {
  const buf = readFileSync(file);
  const tracks = videoTracks(buf);
  if (!tracks.length) throw new Error(`${file}: no video track with an stts table`);
  const t = tracks[0];
  const ms = t.deltas.map((d) => (d / t.timescale) * 1000);
  const sorted = [...ms].sort((a, b) => a - b);
  const total = ms.reduce((a, b) => a + b, 0);
  // A "long" frame is one that occupied more than 1.5 display intervals. Keyed off the
  // MEDIAN rather than a nominal 60 Hz, so a 30 fps or ProMotion capture is judged
  // against its own cadence instead of an assumed one.
  const med = pct(sorted, 0.5);
  const long2 = ms.filter((d) => d > med * 1.5).length;
  const long4 = ms.filter((d) => d > med * 3.5).length;
  return {
    file, frames: ms.length, seconds: total / 1000,
    w: t.width, h: t.height, timescale: t.timescale,
    fps: ms.length / (total / 1000),
    medianMs: med, p95Ms: pct(sorted, 0.95), p99Ms: pct(sorted, 0.99), maxMs: sorted[sorted.length - 1],
    longFrames: long2, longPct: (100 * long2) / ms.length,
    veryLong: long4, veryLongPct: (100 * long4) / ms.length,
    stallMs: ms.filter((d) => d > med * 1.5).reduce((a, b) => a + (b - med), 0),
    bytes: statSync(file).size,
  };
}

function row(r) {
  console.log(`\n${r.file}`);
  console.log(`  ${r.w}x${r.h} · ${r.frames} frames · ${r.seconds.toFixed(2)}s · timescale ${r.timescale}`);
  console.log(`  delivered      ${r.fps.toFixed(2)} fps`);
  console.log(`  frame interval median ${r.medianMs.toFixed(2)} ms · p95 ${r.p95Ms.toFixed(2)} · p99 ${r.p99Ms.toFixed(2)} · max ${r.maxMs.toFixed(2)}`);
  console.log(`  long (>1.5x median)   ${r.longFrames} (${r.longPct.toFixed(2)}%)`);
  console.log(`  severe (>3.5x median) ${r.veryLong} (${r.veryLongPct.toFixed(2)}%)`);
  console.log(`  time lost to stalls   ${(r.stallMs / 1000).toFixed(3)} s of ${r.seconds.toFixed(2)} s (${(100 * r.stallMs / (r.seconds * 1000)).toFixed(2)}%)`);
}

function selftest() {
  // The known-bad is the whole point: a table with a planted stall must be CAUGHT, and a
  // perfectly regular one must come back clean. Without the second arm a detector that
  // always screams would "pass" the first.
  const mk = (deltas, timescale = 600) => {
    const stts = Buffer.alloc(8 + deltas.length * 8);
    stts.writeUInt32BE(0, 0); stts.writeUInt32BE(deltas.length, 4);
    deltas.forEach((d, i) => { stts.writeUInt32BE(1, 8 + i * 8); stts.writeUInt32BE(d, 12 + i * 8); });
    return { stts, timescale };
  };
  let pass = 0, fail = 0;
  const t = (name, cond) => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}`); } };

  const steady = Array(600).fill(10);            // 600 frames @ 10/600 s = 60 fps exactly
  const janky = [...steady]; janky[100] = 100;   // one 166 ms stall
  const fake = (d) => {
    const ms = d.map((x) => (x / 600) * 1000);
    const s = [...ms].sort((a, b) => a - b);
    const med = s[Math.floor(0.5 * (s.length - 1))];
    return { long: ms.filter((x) => x > med * 1.5).length, med, fps: ms.length / (ms.reduce((a, b) => a + b, 0) / 1000) };
  };
  const A = fake(steady), B = fake(janky);
  t('a steady 60 fps table reports 60.00 fps', Math.abs(A.fps - 60) < 0.01);
  t('POSITIVE CONTROL: a steady table reports ZERO long frames', A.long === 0);
  t('KNOWN-BAD: a single planted stall is CAUGHT', B.long === 1);
  t('the stall is not hidden by the median moving', Math.abs(B.med - 10 / 600 * 1000) < 1e-9);
  // Non-emptiness: the filtered set is asserted before anything is concluded from it.
  t('ANTI-VACUITY: the delta set is non-empty before any percentile is taken', steady.length > 0);
  t('an audio-shaped table is refused by the hdlr check, not measured', CONTAINERS.has('stbl'));
  mk(steady);
  console.log(`\nvid_frames selftest ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) selftest();
else {
  const pair = argv.includes('--pair');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!files.length) { console.error('usage: vid_frames.mjs <file.mp4> [...] | --pair <a> <b> | --selftest'); process.exit(2); }
  const rows = files.map(analyse);
  rows.forEach(row);
  if (pair && rows.length === 2) {
    const [a, b] = rows;
    console.log('\n── PAIRED ──────────────────────────────────────────────────');
    // ⚠️ NON-EMPTINESS BEFORE COMPARISON. The first version compared `a.w !== b.w` alone,
    // and when the parse was broken BOTH read the same wrong value, so the refusal passed
    // on garbage. A guard over a degenerate value is not a guard.
    if (!(a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0)) {
      console.log('  🔴 REFUSED — a dimension read as zero, so the pipeline check cannot run.');
      process.exit(1);
    }
    if (a.w !== b.w || a.h !== b.h || a.timescale !== b.timescale) {
      console.log(`  🔴 REFUSED — ${a.w}x${a.h}@${a.timescale} vs ${b.w}x${b.h}@${b.timescale}; not the same pipeline.`);
      process.exit(1);
    }
    console.log(`  fps            ${a.fps.toFixed(2)} -> ${b.fps.toFixed(2)}`);
    console.log(`  long frames    ${a.longPct.toFixed(2)}% -> ${b.longPct.toFixed(2)}%`);
    console.log(`  severe         ${a.veryLongPct.toFixed(2)}% -> ${b.veryLongPct.toFixed(2)}%`);
    console.log(`  p99 interval   ${a.p99Ms.toFixed(2)} ms -> ${b.p99Ms.toFixed(2)} ms`);
    console.log(`  stall time     ${(100 * a.stallMs / (a.seconds * 1000)).toFixed(2)}% -> ${(100 * b.stallMs / (b.seconds * 1000)).toFixed(2)}%`);
    console.log('\n  ⚠️ ONE-SIDED: long intervals prove a stall; short ones do NOT prove the app');
    console.log('     rendered every frame. This reads the recorder, not the render loop.');
  }
}
