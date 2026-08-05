#!/usr/bin/env node
/**
 * MOTION FILMSTRIP — render an animation as an evenly-sampled contact sheet.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Every character critique on this project has judged a STILL FRAME. The cast was
 * looped five times, plateaued at 4/10 and was parked, and one of the recurring
 * complaints was that the characters "read like a turntable render" — which is a
 * complaint about MOTION. Motion had never once been assessed, because there was
 * no way to look at it.
 *
 * A filmstrip is the isolation. Laid out left-to-right, one image shows timing,
 * arcs, weight, anticipation, overshoot and settle at the same time — all the
 * things a still cannot show and a video cannot be pasted into a critique.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   # one strip
 *   node tools/filmstrip.mjs --char donut --anim run --out shots/motion/donut_run.png
 *
 *   # every state for one character, one file each
 *   node tools/filmstrip.mjs --char donut --anims idle,run,attack,hit,death \
 *        --out-dir shots/motion/donut
 *
 *   # one state across characters — the archetype comparison, one row each
 *   node tools/filmstrip.mjs --chars waterbottle,hamburger,pizza,hotdog --anim run \
 *        --out shots/motion/archetypes_run.png
 *
 * Options:
 *   --char <id> | --chars a,b,c     subject(s). Multiple chars ⇒ one row per char.
 *   --anim <state> | --anims a,b    idle|run|attack|hit|death|victory
 *   --frames <n>                    samples across the span (default 12)
 *   --span <seconds>                override the natural span for the state
 *   --yaw <deg>                     camera orbit (default 32; use 90 for pure profile)
 *   --silhouette                    pure black on white — judge POSE, not shading
 *   --cw <px> --ch <px>             cell size (default 300x420)
 *   --url <base>                    dev server (default http://localhost:5173)
 *   --out <png> | --out-dir <dir>
 *   --keep-frames                   also leave the individual frames on disk
 *
 * ── The spans, and why they are what they are ────────────────────────────────
 * Cyclic states are sampled over exactly ONE cycle so the last frame should read
 * as the frame before the first — a strip that does not loop is a broken cycle.
 * One-shot states are sampled over their duration PLUS a tail, deliberately: the
 * tail is where a pose snap shows up. If the rig ends an attack somewhere other
 * than rest, the character teleports, and the only way to see that in a still
 * sequence is to sample past the end.
 */

import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { captureSettled } from './tmp/settle.mjs';

const BASE_DEFAULT = 'http://localhost:5173';

/** [start, end] seconds. Durations come from BaseCharacter's one-shot timers. */
export const ANIM_SPANS = {
  // sin(t * 2.0) → period 2π/2 = 3.1416s. One full breath.
  idle: [0, 3.1416],
  // rig.ts run phase is t * 10.5 → one stride cycle is 2π/10.5 = 0.5984s.
  run: [0, 0.5984],
  // attackDuration 0.36s + a 0.10s tail to expose the return-to-rest.
  attack: [0, 0.46],
  // hit window 0.26s + a 0.10s tail: this is where settle/overshoot lives.
  hit: [0, 0.36],
  // death easing runs over 0.75s; the tail shows whether anything settles after.
  death: [0, 1.0],
  victory: [0, 2.0],
};

const BG = { r: 20, g: 16, b: 28, alpha: 1 };
const GAP = 8;
const LABEL_H = 30;
const ROW_LABEL_W = 128;

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
];

/**
 * Five other agents edit this repo live and every save fires a Vite HMR update that
 * full-reloads the page — which would wipe the deterministic clock halfway through a
 * sweep. This page holds state across every frame, so the HMR client is stubbed out.
 */
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

function textSvg(width, height, text, { size = 15, weight = 600, opacity = 0.9, anchor = 'middle' } = {}) {
  const x = anchor === 'middle' ? width / 2 : 10;
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <text x="${x}" y="${height * 0.72}" font-family="Helvetica,Arial,sans-serif"
             font-size="${size}" font-weight="${weight}" fill="#ffffff"
             text-anchor="${anchor}" opacity="${opacity}">${esc}</text>
     </svg>`
  );
}

/**
 * Find one full cycle of a looping animation, by asking the rig rather than
 * assuming a constant.
 *
 * The run cadence is no longer the same for every character — heavier archetypes
 * run slower — so a hardcoded stride period would show a LANKY character 1.4
 * cycles and a STUB one 0.7 of a cycle, and a strip that does not loop cleanly
 * reads as broken timing when the timing is fine. Trace the pose over a window
 * comfortably longer than any plausible cycle and find where it next returns to
 * where it started.
 */
async function detectCycle(page, anim, maxSpan = 1.3) {
  const tr = await page.evaluate(
    ([a, e]) => window.__preview.trace({ anim: a, t0: 0, t1: e, samples: 157 }),
    [anim, maxSpan]
  );
  const S = tr.samples;
  const names = Object.keys(S[0].joints);
  const dist = (i) => names.reduce((s, n) => {
    const a = S[i].joints[n], b = S[0].joints[n];
    return s + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }, 0);
  // Skip the first third: the pose is trivially near itself just after t=0.
  let best = -1, bestD = Infinity;
  for (let i = Math.floor(S.length * 0.33); i < S.length; i++) {
    const d = dist(i);
    if (d < bestD) { bestD = d; best = i; }
  }
  // How far the "closest return" still is, against the animation's own amplitude.
  const spread = Math.max(...S.map((_, i) => dist(i)));
  return { t: best > 0 ? S[best].t : maxSpan, loops: bestD < spread * 0.12 };
}

/** Capture one row of frames for (char, anim). Returns PNG buffers in time order. */
async function captureRow(page, base, { id, anim, frames, span, yaw, cw, ch, silhouette, autoCycle, fixedSpan }) {
  const url = `${base}/preview.html?piece=character&id=${id}&anim=${anim}&yaw=${yaw}&t=0&shot=1${silhouette ? '&silhouette=1' : ''}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });

  let [t0, t1] = span;
  // Only claim "one full cycle" when a cycle was actually DETECTED. `--span` means
  // the caller pinned a wall-clock window, and the one-shot states (attack/hit/
  // death) are not cycles at all — a header asserting that their first and last
  // frames should match would send a critic hunting a defect that cannot exist.
  let loops = false;
  if (!fixedSpan && autoCycle && (anim === 'run' || anim === 'idle')) {
    const c = await detectCycle(page, anim, anim === 'idle' ? 12 : 1.3);
    t1 = c.t;
    loops = c.loops;
  }

  const shots = [];
  for (let i = 0; i < frames; i++) {
    const t = t0 + ((t1 - t0) * i) / (frames - 1);
    // remount on the first sample: one-shots are armed at mount, so t=0 must be a
    // genuinely fresh model rather than wherever the page-load left the clock.
    await page.evaluate(
      ([tt, remount, an]) => window.__preview.frameAt(tt, { anim: an, remount }),
      [t, i === 0, anim]
    );
    // ── THE FADE GUARD IS A NO-OP HERE, AND THE FLAT-FRAME FLOOR IS NOT ─────────
    // This file shoots `preview.html`, which mounts NO menu shell: no `#boot` overlay
    // (that lives in `index.html` only), no `.fa-curtain`, no `.fa-stack`, no
    // `.fa-screen` and therefore no `fa-screen-in`. The `__screenReady` defect cannot
    // reach a page that has none of the machinery it is about, and `__previewReady`
    // here is the PREVIEW harness's own flag against a hand-cranked clock
    // (`window.__preview.frameAt`), not `shell.ts`'s. So `wait: false`: there is no
    // screen to settle, and pretending otherwise would be theatre.
    //
    // What CAN go wrong is the failure this repo keeps finding — a character that
    // built nothing, or a frame taken before the model swap landed, which renders as a
    // FLAT frame that a contact sheet makes look deliberate. That is exactly the class
    // `assertFrame` exists for, so the floor is left ENFORCED and it is the only part
    // of the guard doing work.
    const { buf } = await captureSettled(page, {
      label: `${id}/${anim} t=${t.toFixed(3)}`, tool: 'filmstrip', wait: false,
    });
    shots.push({ t, buf: await sharp(buf).resize(cw, ch, { fit: 'contain', background: BG }).png().toBuffer() });
  }
  shots.loops = loops;
  return shots;
}

async function main() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE ?? BASE_DEFAULT;
  const ids = String(args.chars ?? args.char ?? 'hamburger').split(',').map((s) => s.trim()).filter(Boolean);
  const anims = String(args.anims ?? args.anim ?? 'run').split(',').map((s) => s.trim()).filter(Boolean);
  const frames = Number(args.frames ?? 12);
  const yaw = Number(args.yaw ?? 32);
  const cw = Number(args.cw ?? 300);
  const ch = Number(args.ch ?? 420);
  const silhouette = !!args.silhouette;
  const keepFrames = !!args['keep-frames'];

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: cw * 2, height: ch * 2 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB })
  );
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });

  const written = [];
  try {
    // One sheet per anim. Rows are characters (usually one).
    for (const anim of anims) {
      const span = args.span ? [0, Number(args.span)] : (ANIM_SPANS[anim] ?? [0, 1]);
      const rows = [];
      for (const id of ids) {
        process.stdout.write(`  ${id} · ${anim} `);
        const shots = await captureRow(page, base, { id, anim, frames, span, yaw, cw, ch, silhouette, autoCycle: !args.span, fixedSpan: !!args.span });
        process.stdout.write(`${shots.length} frames over ${shots[shots.length - 1].t.toFixed(3)}s\n`);
        rows.push({ id, shots, cycle: shots[shots.length - 1].t, loops: shots.loops !== false });
        if (keepFrames) {
          const dir = join(args['out-dir'] ?? 'shots/motion', `${id}_${anim}_frames`);
          await mkdir(dir, { recursive: true });
          await Promise.all(shots.map((s, i) =>
            writeFile(join(dir, `${String(i).padStart(2, '0')}_t${s.t.toFixed(3)}.png`), s.buf)));
        }
      }

      const totalW = ROW_LABEL_W + frames * (cw + GAP) + GAP;
      const rowH = ch + LABEL_H;
      const totalH = LABEL_H + rows.length * (rowH + GAP) + GAP;
      const composites = [];

      composites.push({
        input: textSvg(totalW, LABEL_H,
          `${anim.toUpperCase()}  ·  ${frames} frames over ${rows[0].cycle.toFixed(3)}s  ·  yaw ${yaw}°${silhouette ? '  ·  SILHOUETTE' : ''}`
          + (rows[0].loops
              ? '   [one full cycle: frame 1 and the last frame are the same pose]'
              : '   [NOT A LOOP — a fixed time window. Frame 1 and the last frame are NOT meant to match]'),
          { size: 17, anchor: 'start' }),
        left: 0, top: 2,
      });

      rows.forEach((row, r) => {
        const top = LABEL_H + r * (rowH + GAP);
        composites.push({
          input: textSvg(ROW_LABEL_W, 26, `${row.id}  ${row.cycle.toFixed(2)}s`, { size: 14, anchor: 'start' }),
          left: 4, top: top + Math.round(ch / 2),
        });
        row.shots.forEach((s, i) => {
          const left = ROW_LABEL_W + i * (cw + GAP);
          composites.push({ input: s.buf, left, top });
          composites.push({
            input: textSvg(cw, LABEL_H - 6, `${i + 1}  t=${s.t.toFixed(3)}s`, { size: 14, opacity: 0.72 }),
            left, top: top + ch,
          });
        });
      });

      const outPath = args.out && anims.length === 1
        ? args.out
        : join(args['out-dir'] ?? 'shots/motion', `${ids.join('-')}_${anim}${silhouette ? '_sil' : ''}.png`);
      await mkdir(dirname(resolve(outPath)), { recursive: true });
      await sharp({ create: { width: totalW, height: totalH, channels: 4, background: BG } })
        .composite(composites).png().toFile(outPath);
      written.push(outPath);
      console.log(`✓ ${outPath}  (${totalW}x${totalH})`);
    }
  } finally {
    await page.close();
    await browser.close();
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
