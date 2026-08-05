#!/usr/bin/env node
/**
 * MOTION PROBE — the numeric half of motion review.
 *
 * The filmstrip shows a critic what the motion looks like. This measures it, so a
 * loop has an objective acceptance test instead of four fresh critics contradicting
 * each other (which is how the floor sat at 4/10 for four rounds).
 *
 * It samples joint positions in the character's OWN local frame via
 * `window.__preview.trace()` — camera, framing and the post chain are all out of
 * the equation, so these numbers are properties of the animation and nothing else.
 *
 * Usage:
 *   node tools/motion_probe.mjs --url http://localhost:5186
 *   node tools/motion_probe.mjs --chars hamburger,hotdog --anims run,attack --json out.json
 *
 * ── The measures, and why each one ───────────────────────────────────────────
 *
 *  strideSpan      max |footL.z - footR.z| over a run cycle, as a fraction of leg
 *                  length. A run whose feet never separate is a bobbing statue.
 *  bodyRise        peak-to-peak vertical travel of the body root, as a fraction of
 *                  character height. Weight lives here.
 *  squash          peak-to-peak range of body scale.y. Zero means no squash/stretch,
 *                  which is the single loudest "3D turntable, not animation" tell.
 *  armSwing        peak-to-peak Z travel of each hand, over arm length.
 *  anticipation    for one-shots: how far the acting hand travels AGAINST the strike
 *                  before it travels with it, in metres. Zero = the pose snaps.
 *  arcSagitta      hand-path deviation from the straight chord between its endpoints,
 *                  over the chord length. Limbs that travel in straight lines read
 *                  mechanical; real motion arcs.
 *  endSnap         largest single-sample joint jump at the moment a one-shot expires,
 *                  in metres. This is a POP: the character teleports back to rest.
 *  settleTail      total joint motion in the 25% of the window after the one-shot's
 *                  nominal end. Zero means motion stops dead with no follow-through.
 *  phaseSpread     for idle: how much the joint set differs in phase. One sine wave
 *                  driving every joint gives ~0; layered motion gives > 0.
 */

/**
 * capture-audit: css-immune — reads `window.__rigMetrics` and `window.__preview.trace()` — joint positions in WORLD
 * units, sampled from the rig on `preview.html`. No pixel and no rect is involved.
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Nominal one-shot durations, from BaseCharacter. */
const ONESHOT = { attack: 0.36, hit: 0.26, death: 0.75 };
const SPANS = {
  idle: [0, 3.1416], run: [0, 0.5984],
  attack: [0, 0.46], hit: [0, 0.36], death: [0, 1.0], victory: [0, 2.0],
};

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

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const range = (xs) => Math.max(...xs) - Math.min(...xs);

/**
 * How much a joint path ARCS rather than travelling in a straight line.
 *
 * 0 = a pure straight line (or a straight there-and-back). ~1 = a circle.
 *
 * Deliberately NOT sagitta-over-chord, which was the first attempt and is
 * ill-conditioned exactly where it matters: a run cycle and an attack both END
 * NEAR WHERE THEY STARTED, so the chord is ~0 and the ratio explodes (it returned
 * values of 80-100 on real data). Fit the path's own dominant axis by PCA instead
 * and report the spread perpendicular to it, which is well defined for closed
 * loops, open arcs and straight lines alike.
 */
function arcRatio(path) {
  const n = path.length;
  const cx = [0, 1, 2].map((k) => path.reduce((s, p) => s + p[k], 0) / n);
  const d = path.map((p) => [p[0] - cx[0], p[1] - cx[1], p[2] - cx[2]]);
  // 3x3 covariance, dominant eigenvector by power iteration.
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const v of d) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += v[i] * v[j];
  let u = [1, 1, 1];
  for (let it = 0; it < 64; it++) {
    const w = [0, 1, 2].map((i) => C[i][0] * u[0] + C[i][1] * u[1] + C[i][2] * u[2]);
    const L = len(w);
    if (L < 1e-12) break;
    u = w.map((x) => x / L);
  }
  let along = 0, perp = 0;
  for (const v of d) {
    const a = Math.abs(v[0] * u[0] + v[1] * u[1] + v[2] * u[2]);
    const p = len(sub(v, u.map((x) => x * (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]))));
    if (a > along) along = a;
    if (p > perp) perp = p;
  }
  return along < 1e-6 ? 0 : perp / along;
}

/** Total path length of a joint across the trace. */
function pathLength(path) {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += len(sub(path[i], path[i - 1]));
  return s;
}

function analyse(trace, anim, metrics) {
  const S = trace.samples;
  const jn = Object.keys(S[0].joints);
  const track = (n) => S.map((s) => s.joints[n]);
  const ts = S.map((s) => s.t);
  const H = metrics.height;
  const out = {};

  const bodyY = track('rig_body').map((p) => p[1]);
  const hipsY = track('hips').map((p) => p[1]);
  out.bodyRise = +(range(bodyY.map((y, i) => y + hipsY[i] - hipsY[0])) / H).toFixed(4);
  out.rootRise = +(range(bodyY) / H).toFixed(4);
  out.squash = +range(S.map((s) => s.bodyScale[1])).toFixed(4);
  // Convention #1 is feet at y=0. Report how far the lowest point of the model
  // sinks below the floor at the worst frame of this animation.
  out.minY = +Math.min(...S.map((s) => s.minY ?? 0)).toFixed(4);

  if (metrics.legLength > 0) {
    const fL = track('footL'), fR = track('footR');
    const sep = fL.map((p, i) => Math.abs(p[2] - fR[i][2]));
    out.strideSpan = +(Math.max(...sep) / metrics.legLength).toFixed(3);
    out.footLift = +(Math.max(range(fL.map((p) => p[1])), range(fR.map((p) => p[1]))) / metrics.legLength).toFixed(3);

    // ── Is the vertical bob in the right place in the cycle? ──────────────────
    // A run (and a walk) is LOWEST when the legs are at full split — that is the
    // contact/compression pose — and HIGHEST when they pass. So sample the body
    // height at the frame of maximum foot separation and report where it sits in
    // the body's own range: 0 = correctly at the bottom, 1 = fully inverted.
    if (anim === 'run') {
      const bY = bodyY.map((y, i) => y + hipsY[i]);
      const at = bY[sep.indexOf(Math.max(...sep))];
      const lo = Math.min(...bY), hi = Math.max(...bY);
      out.bobAtSplit = hi - lo < 1e-6 ? 0 : +((at - lo) / (hi - lo)).toFixed(3);
    }
  }

  const armLen = metrics.armLength || 1;
  const hL = track('handL'), hR = track('handR');
  out.armSwing = +(Math.max(range(hL.map((p) => p[2])), range(hR.map((p) => p[2]))) / armLen).toFixed(3);
  out.handPathL = +(pathLength(hL) / armLen).toFixed(3);
  out.handPathR = +(pathLength(hR) / armLen).toFixed(3);
  out.arcR = +arcRatio(hR).toFixed(3);
  out.arcFootL = metrics.legLength > 0 ? +arcRatio(track("footL")).toFixed(3) : 0;

  // Total joint travel, normalised — the crudest "is anything happening" measure.
  out.totalTravel = +(jn.reduce((s, n) => s + pathLength(track(n)), 0) / (jn.length * H)).toFixed(4);

  // Largest single-frame jump across all joints, and where it happens. On a smooth
  // animation this is ~ the sampling step; a spike means a discontinuity.
  let maxJump = 0, jumpAt = 0;
  for (let i = 1; i < S.length; i++) {
    for (const n of jn) {
      const d = len(sub(S[i].joints[n], S[i - 1].joints[n]));
      if (d > maxJump) { maxJump = d; jumpAt = ts[i]; }
    }
  }
  out.maxFrameJump = +maxJump.toFixed(4);
  out.maxJumpAt = +jumpAt.toFixed(3);

  const dur = ONESHOT[anim];
  if (dur) {
    // ── Anticipation: does the acting hand move AGAINST the strike first? ──────
    // The rig's attack is right-handed, so the strike carries handR forward (+Z).
    const z = hR.map((p) => p[2]);
    const peakI = z.indexOf(Math.max(...z));
    const pre = z.slice(0, Math.max(1, peakI));
    out.anticipation = +(z[0] - Math.min(...pre)).toFixed(4);
    out.antiFrac = +(out.anticipation / Math.max(1e-6, Math.max(...z) - Math.min(...pre))).toFixed(3);

    // ── End snap: the discontinuity when the one-shot timer expires ────────────
    // Only the sample pair that actually STRADDLES the timer expiry. A wider
    // window was the first attempt and it was wrong: a correctly-settling action is
    // still decelerating either side of the boundary, so a +/-0.02 s window caught
    // legitimate motion (0.082 -> 0.041 -> 0.019 -> 0.008 -> 0.002 across the
    // crossing) and reported the largest of it as if it were a pop. The pop is the
    // step across the boundary itself and nothing else.
    let snap = 0;
    for (let i = 1; i < S.length; i++) {
      if (ts[i] <= dur || ts[i] > dur + 2 / 120) continue;
      for (const n of jn) {
        const d = len(sub(S[i].joints[n], S[i - 1].joints[n]));
        if (d > snap) snap = d;
      }
    }
    out.endSnap = +snap.toFixed(4);
    // A snap is a DISCONTINUITY, not merely motion. Compare the boundary jump to
    // the typical jump over the ten samples leading into it: a decelerating settle
    // scores near or below 1, a teleport scores many times that.
    const near = [];
    for (let i = 1; i < S.length; i++) {
      if (ts[i] > dur - 0.02 || ts[i] < dur - 0.12) continue;
      near.push(Math.max(...jn.map((n) => len(sub(S[i].joints[n], S[i - 1].joints[n])))));
    }
    near.sort((a, b) => a - b);
    const med = near.length ? near[Math.floor(near.length / 2)] : 0;
    out.snapRatio = med < 1e-6 ? 999 : +(snap / med).toFixed(2);

    // ── Follow-through: motion in the LAST QUARTER of the one-shot's own window.
    // Deliberately measured inside the window rather than after it. A one-shot that
    // needs to keep moving after its timer expires would need the rig to carry
    // state; the right place for recovery is the tail of the action itself, which
    // is also how shipped game animation is authored.
    const winTail = S.filter((s) => s.t > dur * 0.75 && s.t <= dur + 1e-6);
    if (winTail.length > 2) {
      const tl = jn.reduce((s, n) => s + pathLength(winTail.map((x) => x.joints[n])), 0);
      out.tailTravel = +(tl / (jn.length * H)).toFixed(5);
    }
    // Does the action overshoot PAST rest on the way back? Rest is where the pose
    // must be at a=1, so compare the post-peak minimum against the final sample.
    const inWin = S.filter((s) => s.t <= dur + 1e-6).map((s) => s.joints.handR[2]);
    if (inWin.length > 4) {
      const pk = inWin.indexOf(Math.max(...inWin));
      const post = inWin.slice(pk);
      out.overshoot = +Math.max(0, inWin[inWin.length - 1] - Math.min(...post)).toFixed(4);
    }
    // Residual motion after the timer expires — expected to be ~0; it is here only
    // so a nonzero value flags leaked state.
    const after = S.filter((s) => s.t > dur + 0.01);
    if (after.length > 2) {
      const tl = jn.reduce((s, n) => s + pathLength(after.map((x) => x.joints[n])), 0);
      out.postWindow = +(tl / (jn.length * H)).toFixed(5);
    }
  }

  if (anim === 'idle') {
    // Phase spread: normalise every joint's dominant 1-D signal to [-1,1] and see how
    // far apart their zero-crossings sit. All joints on ONE sine ⇒ ~0.
    const sigs = jn.map((n) => {
      const p = track(n);
      const dims = [0, 1, 2].map((k) => range(p.map((q) => q[k])));
      const k = dims.indexOf(Math.max(...dims));
      const v = p.map((q) => q[k]);
      const lo = Math.min(...v), hi = Math.max(...v);
      return hi - lo < 1e-5 ? null : v.map((x) => (2 * (x - lo)) / (hi - lo) - 1);
    }).filter(Boolean);
    const peakIdx = sigs.map((s) => s.indexOf(Math.max(...s)) / (s.length - 1));
    out.phaseSpread = sigs.length > 1
      ? +(Math.max(...peakIdx) - Math.min(...peakIdx)).toFixed(3) : 0;
    out.movingJoints = sigs.length;
    out.staticJoints = jn.length - sigs.length;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const ids = String(args.chars ?? args.char ?? 'waterbottle,hamburger,pizza,hotdog')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const anims = String(args.anims ?? args.anim ?? 'idle,run,attack,hit,death')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const samples = Number(args.samples ?? 61);

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 400, height: 500 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));

  const results = {};
  try {
    for (const id of ids) {
      await page.goto(`${base}/preview.html?piece=character&id=${id}&anim=idle&t=0&shot=1`,
        { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });
      const metrics = await page.evaluate(() => {
        const w = window;
        return w.__rigMetrics ?? null;
      });
      results[id] = { metrics, anims: {} };
      for (const anim of anims) {
        const [t0, t1] = SPANS[anim] ?? [0, 1];
        const trace = await page.evaluate(
          ([a, s, e, n]) => window.__preview.trace({ anim: a, t0: s, t1: e, samples: n }),
          [anim, t0, t1, samples]
        );
        results[id].anims[anim] = { trace, span: [t0, t1] };
      }
    }
  } finally {
    await page.close();
    await browser.close();
  }

  // Derive per-character lengths straight from the trace's own rest geometry, so
  // nothing here mirrors a rig constant that an archetype change could invalidate.
  const report = {};
  for (const [id, r] of Object.entries(results)) {
    const s0 = r.anims[anims[0]].trace.samples[0].joints;
    const m = {
      height: Math.max(...Object.values(s0).map((p) => p[1])) + 0.5,
      legLength: s0.hips[1] - Math.min(s0.footL[1], s0.footR[1]),
      armLength: len(sub(s0.shoulderR, s0.handR)),
    };
    report[id] = { legLength: +m.legLength.toFixed(3), armLength: +m.armLength.toFixed(3), anims: {} };
    for (const anim of anims) {
      report[id].anims[anim] = analyse(r.anims[anim].trace, anim, m);
    }
  }

  if (args.json) await writeFile(args.json, JSON.stringify({ report, raw: results }, null, 1));

  for (const anim of anims) {
    console.log(`\n═══ ${anim.toUpperCase()} ═══`);
    const keys = new Set();
    for (const id of ids) Object.keys(report[id].anims[anim]).forEach((k) => keys.add(k));
    const cols = [...keys];
    console.log(['char'.padEnd(13), ...cols.map((c) => c.padStart(13))].join(''));
    for (const id of ids) {
      const row = report[id].anims[anim];
      console.log([id.padEnd(13), ...cols.map((c) => String(row[c] ?? '·').padStart(13))].join(''));
    }
  }
  console.log('\nlegLength / armLength (m):');
  for (const id of ids) console.log(`  ${id.padEnd(13)} ${report[id].legLength}  ${report[id].armLength}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
