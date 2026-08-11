#!/usr/bin/env node
/**
 * pf_judder.mjs — IS A SCREEN CAPTURE STUTTERING, measured on the frames the
 * decoder actually presents, and VALIDATED against clips whose answer is known.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS RATHER THAN `vidjudder.mjs`
 * ═══════════════════════════════════════════════════════════════════════════
 * `tools/tmp/vidjudder.mjs` sets `video.currentTime = t` on a FIXED grid and
 * counts near-zero pixel deltas between consecutive samples. That has a failure
 * mode which produces exactly the answer it is looking for:
 *
 *   🚨 **A SEEK GRID FINER THAN THE SOURCE'S FRAME INTERVAL RETURNS THE SAME
 *   FRAME TWICE, AND THAT IS INDISTINGUISHABLE FROM A DROPPED FRAME.**
 *
 * Sampling a perfectly smooth 30 fps capture on a 60 Hz grid yields ~50 %
 * "repeats" from arithmetic alone. `vidjudder`'s own reported figures — 8 of 60
 * repeats at 30 Hz and 19 of 59 at 60 Hz — are consistent with that artefact
 * before they are consistent with anything about the game, because the tool takes
 * the rate as a CLI ARGUMENT and never measures it.
 *
 * ── WHAT THIS DOES INSTEAD ──────────────────────────────────────────────────
 * `HTMLVideoElement.requestVideoFrameCallback` fires once per PRESENTED frame and
 * hands over `metadata.mediaTime` — the source timestamp of that frame. So the
 * container's real frame times are MEASURED, never assumed, and every comparison
 * is between two frames the decoder genuinely produced. No seeking at all.
 *
 * A repeat is then decided on CONTENT, and the threshold is derived from the
 * clip's own delta distribution rather than typed in: the tool prints the full
 * histogram and the gap it split on, so the reader can see whether the population
 * was bimodal or whether the split was invented.
 *
 * ── WHAT IT CAN AND CANNOT TELL YOU ─────────────────────────────────────────
 *   CAN: the container's true frame rate; how many presented frames repeat their
 *        predecessor; the RUN-LENGTH distribution of those repeats; where in the
 *        clip the long runs are.
 *   CANNOT: the app's frame rate. A screen recorder samples the DISPLAY. A game
 *        running at exactly half the container rate produces runs of 2 forever and
 *        that is not a stutter — it is a steady 30 fps in a 60 fps container. Only
 *        runs LONGER than the steady-state run length are evidence of a hitch, and
 *        this tool reports the distribution precisely so that distinction is
 *        visible instead of being collapsed into one "repeat" count.
 *   CANNOT: attribute a hitch to a cause. GC, shader compile, texture upload and
 *        raw GPU load all look identical from here.
 *
 * ── VALIDATION (`--selftest`) — synthesised clips, known answers ────────────
 * `ffmpeg` is not installed on this machine, so the fixtures are built in the
 * browser: a canvas, `captureStream(0)` + `track.requestFrame()` for exact frame
 * control, and `MediaRecorder`. Three known inputs:
 *   1. KNOWN-GOOD  — every frame's content differs. The tool must report ZERO
 *                    repeats. A tool that flags compression noise as a repeat fails.
 *   2. KNOWN-BAD   — the SAME clip with N frames deliberately re-submitted without
 *                    redrawing. The tool must find those N and no others.
 *   3. OVERSAMPLE  — the known-GOOD clip analysed by the SEEK-GRID method at 2x its
 *                    own frame rate. This must report ~50 % "repeats" — i.e. the
 *                    artefact is reproduced ON DEMAND, which is what makes the
 *                    claim about `vidjudder` a measurement rather than an opinion.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/pf_judder.mjs <video>            # analyse a capture
 *   node tools/tmp/pf_judder.mjs <video> --from 6 --to 16
 *   node tools/tmp/pf_judder.mjs --selftest
 *
 * 🚨 The capture this was written for is Uri's own phone and lives under
 * `reference/`, which is gitignored and must never be committed, published or
 * DESCRIBED (CLAUDE.md, security). This tool emits frame indices, timestamps and
 * pixel-delta fractions only — numbers, which disclose nothing — and writes no
 * images at all.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

// ─────────────────────────────────────────────────────────────────────────────
// Page-side: walk every PRESENTED frame via requestVideoFrameCallback.
// Downscale to a fixed small raster so the per-frame comparison is cheap enough
// to keep up with playback — the comparison is a CHANGE detector, and a 320 px
// raster preserves any change big enough to be a new game frame.
// ─────────────────────────────────────────────────────────────────────────────
const WALK = async ({ b64, mime, from, to, rate }) => {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = 'data:' + mime + ';base64,' + b64;
  await new Promise((res, rej) => {
    v.onloadedmetadata = res;
    v.onerror = () => rej(new Error('decode failed: the codec is not decodable here'));
  });
  if (!('requestVideoFrameCallback' in v)) throw new Error('no requestVideoFrameCallback in this browser');
  const W = 320, H = Math.max(1, Math.round(320 * v.videoHeight / v.videoWidth));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });

  const rows = [];
  let prev = null, seen = new Set();
  let done;
  const finished = new Promise((r) => { done = r; });

  function onFrame(now, meta) {
    const t = meta.mediaTime;
    if (!seen.has(t) && (from == null || t >= from) && (to == null || t <= to)) {
      seen.add(t);
      ctx.drawImage(v, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      let changed = 0, sad = 0;
      if (prev) {
        for (let i = 0; i < d.length; i += 4) {
          const a = Math.abs(d[i] - prev[i]) + Math.abs(d[i+1] - prev[i+1]) + Math.abs(d[i+2] - prev[i+2]);
          sad += a;
          if (a > 24) changed++;
        }
      }
      rows.push({
        t: +t.toFixed(4),
        presented: meta.presentedFrames,
        changed: prev ? changed / (W * H) : null,
        sad: prev ? sad / (W * H) : null,
      });
      prev = d;
    }
    if (v.ended || (to != null && t > to)) { done(); return; }
    v.requestVideoFrameCallback(onFrame);
  }
  v.requestVideoFrameCallback(onFrame);
  v.playbackRate = rate;
  if (from != null) v.currentTime = from;
  await v.play();
  v.onended = () => done();
  await finished;
  try { v.pause(); } catch (e) {}
  return { rows, w: v.videoWidth, h: v.videoHeight, dur: v.duration };
};

/** The SEEK-GRID method `vidjudder.mjs` uses, kept verbatim in behaviour so the
 *  oversampling artefact can be demonstrated rather than argued. */
const SEEKGRID = async ({ b64, mime, t0, span, step }) => {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true;
  v.src = 'data:' + mime + ';base64,' + b64;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('decode')); });
  const W = 320, H = Math.max(1, Math.round(320 * v.videoHeight / v.videoWidth));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const grab = async (t) => {
    await new Promise((r) => { v.onseeked = r; v.currentTime = t; });
    ctx.drawImage(v, 0, 0, W, H);
    return ctx.getImageData(0, 0, W, H).data;
  };
  const out = [];
  let prev = await grab(t0);
  for (let t = t0 + step; t <= t0 + span; t += step) {
    const cur = await grab(t);
    let changed = 0;
    for (let i = 0; i < cur.length; i += 4) {
      if (Math.abs(cur[i]-prev[i]) + Math.abs(cur[i+1]-prev[i+1]) + Math.abs(cur[i+2]-prev[i+2]) > 24) changed++;
    }
    out.push({ t: +t.toFixed(3), changed: changed / (W * H) });
    prev = cur;
  }
  return out;
};

/**
 * Build a fixture clip. `dupAt` is a set of frame indices that are re-submitted
 * WITHOUT redrawing — a deliberately repeated frame, which is what a dropped app
 * frame looks like to a screen recorder.
 */
const MAKE = async ({ frames, dupAt }) => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 180;
  const ctx = c.getContext('2d');
  const stream = c.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  const dup = new Set(dupAt);
  let drawn = 0;
  for (let i = 0; i < frames; i++) {
    // ⚠️ A duplicate frame must be REDRAWN with identical pixels, not skipped.
    // Measured on this box: `captureStream(0)` + `requestFrame()` on a canvas that
    // was never touched pushes NOTHING into the track (27 frames from 30 requests
    // with 3 skips), so a "skip the draw" fixture silently produces a shorter clip
    // instead of a repeated frame — a known-bad that is not the bad you meant.
    // Redrawing the same pixels marks the canvas dirty and pushes all 30.
    if (!dup.has(i)) drawn++;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#fff';
    ctx.fillRect((drawn * 7) % 260, 20, 60, 140);
    track.requestFrame();
    await new Promise((r) => setTimeout(r, 33));
  }
  await new Promise((r) => setTimeout(r, 250));
  const blob = await new Promise((r) => { rec.onstop = () => r(new Blob(chunks, { type: 'video/webm' })); rec.stop(); });
  const buf = await blob.arrayBuffer();
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
};

async function withPage(fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
      '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent('<body></body>');
  try { return await fn(page); } finally { await browser.close(); }
}

/**
 * Split the delta population into "repeat" and "moved".
 *
 * 🚨 THE FIRST VERSION OF THIS FUNCTION TOOK THE LARGEST GAP ANYWHERE IN THE
 * SORTED POPULATION AND GOT THE ANSWER EXACTLY BACKWARDS — on a fixture whose
 * frames ALL move by the same amount, the largest gap sits ABOVE the motion
 * cluster, so it classified 87 of 89 moving frames as repeats and reported a
 * known-GOOD clip as 97.8 % stuttering. It was caught by its own known-good
 * input on the first run, which is the entire argument for CLAUDE.md 6.
 *
 * The fix anchors the split at ZERO, which is what a repeated frame physically
 * is: a candidate threshold is only admissible if the cluster below it moves less
 * than a quarter of the clip's typical motion. If nothing is that still, the honest
 * answer is ZERO repeats — not "split it somewhere anyway".
 */
function splitRepeats(deltas) {
  const s = [...deltas].filter(Number.isFinite).sort((a, b) => a - b);
  if (s.length < 3) return { thr: -1, gap: 0, sep: 0, nBelow: 0, nAbove: s.length };
  const med = s[Math.floor(s.length / 2)];
  const ceiling = med * 0.25;          // a repeat moves <= 1/4 of typical motion
  let gap = 0, at = -1;
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1] > ceiling) break;     // past the admissible region
    const g = s[i] - s[i - 1];
    if (g > gap) { gap = g; at = i; }
  }
  if (at < 0 || s[0] > ceiling) {
    // Nothing is still enough to be a repeated frame.
    return { thr: -1, gap: 0, sep: 0, nBelow: 0, nAbove: s.length, med, ceiling };
  }
  const thr = (s[at] + s[at - 1]) / 2;
  const sep = gap / (s[s.length - 1] - s[0] || 1);
  return { thr, gap, sep, nBelow: at, nAbove: s.length - at, med, ceiling };
}

function runLengths(flags) {
  const runs = [];
  let cur = 0;
  for (const f of flags) { if (f) cur++; else { if (cur) runs.push(cur); cur = 0; } }
  if (cur) runs.push(cur);
  return runs;
}

function analyse(rows, label) {
  const body = rows.slice(1);                       // row 0 has no predecessor
  const times = rows.map((r) => r.t);
  const dts = [];
  for (let i = 1; i < times.length; i++) dts.push(times[i] - times[i - 1]);
  const sdt = [...dts].sort((a, b) => a - b);
  const medDt = sdt[Math.floor(sdt.length / 2)];

  const deltas = body.map((r) => r.changed);
  const sp = splitRepeats(deltas);
  const flags = body.map((r) => sp.thr >= 0 && r.changed <= sp.thr);
  const nRep = flags.filter(Boolean).length;
  const runs = runLengths(flags);
  const hist = new Map();
  for (const r of runs) hist.set(r, (hist.get(r) ?? 0) + 1);

  console.log(`\n══ ${label}`);
  console.log(`   presented frames analysed: ${rows.length}   media-time span ${times[0].toFixed(3)}–${times[times.length - 1].toFixed(3)} s`);
  console.log(`   CONTAINER frame interval: median ${(medDt * 1000).toFixed(2)} ms → ${(1 / medDt).toFixed(2)} fps   (min ${(sdt[0] * 1000).toFixed(2)}, max ${(sdt[sdt.length - 1] * 1000).toFixed(2)} ms)`);
  console.log(`   MEASURED, not assumed — this is the number a seek-grid tool has to be told.`);
  const q = (p) => deltas.slice().sort((a, b) => a - b)[Math.floor(p * (deltas.length - 1))];
  console.log(`   changed-pixel fraction per presented frame: p05 ${(q(0.05) * 100).toFixed(3)}%  p50 ${(q(0.5) * 100).toFixed(3)}%  p95 ${(q(0.95) * 100).toFixed(3)}%`);
  if (sp.thr < 0) {
    console.log(`   NO repeat cluster: the stillest frame moves ${(deltas.slice().sort((a, b) => a - b)[0] * 100).toFixed(4)}%,`);
    console.log(`     above the ${(sp.ceiling * 100).toFixed(4)}% admissibility ceiling (a quarter of the ${(sp.med * 100).toFixed(3)}% median).`);
    console.log(`     ⇒ ZERO repeated frames. The tool refuses to split a population that has no still cluster in it.`);
  } else {
    console.log(`   derived repeat threshold ${(sp.thr * 100).toFixed(4)}% — largest gap BELOW the ${(sp.ceiling * 100).toFixed(4)}% ceiling,`);
    console.log(`     gap ${(sp.gap * 100).toFixed(4)} pp = ${(sp.sep * 100).toFixed(1)}% of the whole range (${sp.nBelow} below / ${sp.nAbove} above)`);
    if (sp.sep < 0.05) console.log(`     ⚠️ weakly separated — treat the count as indicative, not exact`);
  }
  console.log(`   repeated frames: ${nRep} of ${body.length} (${((nRep / body.length) * 100).toFixed(1)}%)`);
  console.log(`   repeat RUN LENGTHS: ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${v} run(s) of ${k}`).join(' · ') || 'none'}`);
  console.log(`     a game running at HALF the container rate gives runs of 1 forever and is NOT a stutter.`);
  console.log(`     only runs LONGER than the modal run length are hitches.`);
  const modal = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const hitches = runs.filter((r) => r > modal);
  console.log(`   modal run ${modal} → ${hitches.length} runs longer than modal`);
  const effective = medDt > 0 ? (1 / medDt) * (1 - nRep / body.length) : NaN;
  console.log(`   ⇒ distinct-content rate: ${effective.toFixed(2)} new frames/s of a ${(1 / medDt).toFixed(2)} fps container`);

  /**
   * ── THRESHOLD SENSITIVITY ─────────────────────────────────────────────────
   * The split above can be weakly separated on a real capture, where compression
   * noise fills the gap a synthetic fixture leaves empty. A count that survives
   * halving and doubling the threshold is robust ANYWAY; one that does not is a
   * threshold artefact and must be reported as such rather than as a number.
   */
  if (sp.thr >= 0) {
    const at = (t) => body.filter((r) => r.changed <= t).length;
    console.log(`   threshold sensitivity: x0.5 → ${at(sp.thr / 2)}   x1 → ${nRep}   x2 → ${at(sp.thr * 2)}   x4 → ${at(sp.thr * 4)} repeats`);
    const spread = (at(sp.thr * 2) - at(sp.thr / 2)) / Math.max(1, nRep);
    console.log(`     ⇒ ${(spread * 100).toFixed(1)}% of the count moves across a 4x threshold sweep — ${spread < 0.1 ? 'ROBUST' : 'threshold-sensitive, quote as approximate'}`);
  }

  /**
   * ── IS A LONG RUN A STALL, OR A STATIC SCREEN? ────────────────────────────
   * A menu, a results overlay or a title card is legitimately still, and looks
   * exactly like a freeze from pixel deltas alone. The discriminator is the motion
   * AROUND the run: a stall interrupts movement, a static screen is surrounded by
   * stillness. Reported as numbers only — no frame is written and nothing about
   * the CONTENT is described (CLAUDE.md, security).
   */
  const idx = [];
  { let i = 0; while (i < flags.length) { if (flags[i]) { let j = i; while (j < flags.length && flags[j]) j++; idx.push([i, j - i]); i = j; } else i++; } }
  const long = idx.filter(([, L]) => L >= Math.max(3, modal + 2)).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (long.length) {
    console.log(`\n   LONG RUNS — is it a stall or a still screen? (motion is the median changed-pixel % of the 10 frames either side)`);
    console.log(`   ${'at (s)'.padStart(8)} ${'frames'.padStart(6)} ${'ms held'.padStart(8)}   ${'motion before'.padStart(13)} ${'motion after'.padStart(12)}   verdict`);
    for (const [i, L] of long) {
      const before = body.slice(Math.max(0, i - 10), i).map((r) => r.changed).sort((a, b) => a - b);
      const after = body.slice(i + L, i + L + 10).map((r) => r.changed).sort((a, b) => a - b);
      const mb = before.length ? before[Math.floor(before.length / 2)] : NaN;
      const ma = after.length ? after[Math.floor(after.length / 2)] : NaN;
      // "Was the game moving either side of this run?" referenced to the CLIP's own
      // typical motion, not to the repeat threshold. An earlier version used
      // `thr * 20`, which on this capture put the bar at 18.3% — above the 95th
      // percentile of real motion — so genuine 8.8% movement was reported as a
      // still screen. A discriminator calibrated off the wrong quantity is
      // `docs/LESSONS.md` §15b's cross-quantity comparison in miniature.
      const moving = Math.max(mb || 0, ma || 0) > sp.med / 4;
      console.log(`   ${body[i].t.toFixed(3).padStart(8)} ${String(L).padStart(6)} ${(L * medDt * 1000).toFixed(0).padStart(8)}   ${(mb * 100).toFixed(3).padStart(12)}% ${(ma * 100).toFixed(3).padStart(11)}%   ${moving ? '🔴 STALL IN MOTION' : 'still either side — a static screen, not a hitch'}`);
    }
  }
  return { rows: rows.length, medDt, nRep, runs, hist: [...hist.entries()], thr: sp.thr, sep: sp.sep, modal, hitches, effective, long };
}

// ─────────────────────────────────────────────────────────────────────────────
async function selftest() {
  let pass = 0, fail = 0;
  const ok = (n, c, x = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? `   ${x}` : ''}`); c ? pass++ : fail++; };
  console.log('\npf_judder --selftest — three fixtures with KNOWN answers, synthesised in-browser (no ffmpeg on this box)\n');

  const FRAMES = 90;
  const DUPS = [20, 21, 40, 60, 61, 62];       // 6 injected repeats, one run of 3

  await withPage(async (page) => {
    const good = await page.evaluate(MAKE, { frames: FRAMES, dupAt: [] });
    const bad = await page.evaluate(MAKE, { frames: FRAMES, dupAt: DUPS });
    console.log(`  fixtures built: known-good ${(good.length * 0.75 / 1024).toFixed(0)} KB, known-bad ${(bad.length * 0.75 / 1024).toFixed(0)} KB\n`);

    const rg = await page.evaluate(WALK, { b64: good, mime: 'video/webm', from: null, to: null, rate: 1 });
    const ag = analyse(rg.rows, 'KNOWN-GOOD fixture — every frame content differs');
    ok('1/KNOWN-GOOD: zero repeated frames', ag.nRep === 0, `found ${ag.nRep}`);

    const rb = await page.evaluate(WALK, { b64: bad, mime: 'video/webm', from: null, to: null, rate: 1 });
    const ab = analyse(rb.rows, `KNOWN-BAD fixture — ${DUPS.length} frames deliberately re-submitted unchanged`);
    ok(`2/KNOWN-BAD: finds the ${DUPS.length} injected repeats`, ab.nRep === DUPS.length, `found ${ab.nRep}`);
    ok('2/KNOWN-BAD: recovers the injected RUN STRUCTURE (a 3-run, a 2-run and a 1-run)',
      JSON.stringify(ab.runs.slice().sort((a, b) => b - a)) === JSON.stringify([3, 2, 1]),
      `runs ${JSON.stringify(ab.runs)}`);
    ok('2/KNOWN-BAD: the two fixtures are DISTINGUISHABLE — the whole point',
      ag.nRep === 0 && ab.nRep > 0);

    // 3/OVERSAMPLE — reproduce the seek-grid artefact on the KNOWN-GOOD clip.
    const fps = 1 / ag.medDt;
    const t0 = 0.5, span = 1.5;
    const at1x = await page.evaluate(SEEKGRID, { b64: good, mime: 'video/webm', t0, span, step: 1 / fps });
    const at2x = await page.evaluate(SEEKGRID, { b64: good, mime: 'video/webm', t0, span, step: 1 / (2 * fps) });
    const rep = (a) => a.filter((r) => r.changed < 0.0005).length / a.length;
    console.log(`\n══ 3/OVERSAMPLE — the SEEK-GRID method (what vidjudder.mjs does) on the KNOWN-GOOD clip`);
    console.log(`   measured container rate ${fps.toFixed(2)} fps`);
    console.log(`   sampled at 1x its rate  (${(1000 / fps).toFixed(1)} ms grid): "repeats" ${(rep(at1x) * 100).toFixed(1)}% of ${at1x.length} steps`);
    console.log(`   sampled at 2x its rate  (${(500 / fps).toFixed(1)} ms grid): "repeats" ${(rep(at2x) * 100).toFixed(1)}% of ${at2x.length} steps`);
    console.log(`   The clip is IDENTICAL. Every one of those repeats is the SAMPLING, not the content.`);
    ok('3/OVERSAMPLE: a smooth clip sampled at 2x its rate manufactures ~50% "repeats"',
      rep(at2x) > 0.30, `${(rep(at2x) * 100).toFixed(1)}%`);
    ok('3/OVERSAMPLE: ...and at 1x its own rate it does not',
      rep(at1x) < 0.15, `${(rep(at1x) * 100).toFixed(1)}%`);
  });

  console.log(`\npf_judder selftest: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
if (flag('selftest')) {
  await selftest();
} else {
  const src = argv.find((a) => !a.startsWith('--'));
  if (!src || !existsSync(resolve(src))) {
    console.error('usage: node tools/tmp/pf_judder.mjs <video> [--from s] [--to s]   |   --selftest');
    process.exit(2);
  }
  const from = argv.includes('--from') ? Number(arg('from')) : null;
  const to = argv.includes('--to') ? Number(arg('to')) : null;
  const buf = readFileSync(resolve(src));
  const mime = /\.webm$/i.test(src) ? 'video/webm' : 'video/mp4';
  console.log(`\npf_judder — ${(buf.length / 1048576).toFixed(2)} MB, ${mime}`);
  console.log('🚨 numbers only. No frames are written and nothing about the CONTENT is reported (CLAUDE.md, security).');
  const r = await withPage((page) => page.evaluate(WALK, {
    b64: buf.toString('base64'), mime, from, to, rate: Number(arg('rate', 1)),
  }));
  console.log(`   source ${r.w}x${r.h}, duration ${r.dur.toFixed(2)} s`);
  analyse(r.rows, `capture${from != null ? ` [${from}–${to ?? 'end'} s]` : ''}`);
}
