#!/usr/bin/env node
/**
 * kneeprice.mjs — re-price `stage.ts`'s highlight shoulder against the ONE control
 * nobody measured: what the reference plates' own CHANNEL clipping actually is.
 *
 *   node tools/tmp/kneeprice.mjs --selftest                      # 21 assertions
 *   node tools/tmp/kneeprice.mjs --plates                        # offline, no browser
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/kneeprice.mjs --url {URL}
 *
 * ── THE ARGUMENT THIS SETTLES ───────────────────────────────────────────────────
 * `stage.ts:1275` rejects `highlightKnee 0.82 -> 0.92` because it "takes whole-frame
 * clipped-high from 0.06% to 2.50%, a 40x regression". The p6 probe called that
 * rejection wrong on the grounds that "2.50% is the MIDDLE of the reference band: the
 * reference playfield's own share above 0.94 is 0.11-5.87%, median 1.64%".
 *
 * ⚠️ THOSE TWO NUMBERS ARE NOT THE SAME QUANTITY EITHER, which is the thing this file
 * exists to make impossible to conflate again. Read `postablate.mjs:267-273`:
 *
 *     if (px[i] === 255 || px[i+1] === 255 || px[i+2] === 255) hi++;
 *
 * That is **ANY CHANNEL AT EXACTLY 255**, counted over the WHOLE `gl.readPixels`
 * canvas. p6's 0.11-5.87% band is **LUMA > 0.94** over a **playfield crop** of an sRGB
 * plate. A saturated hazard orange at (255, 80, 40) is 100% of the first and 0% of the
 * second — it sits at luma 0.42. So p6 replaced one cross-quantity comparison with
 * another one, in the other direction, and the rejection is still unadjudicated.
 *
 * The adjudicating measurement is the one neither side took: **the reference plates'
 * own any-channel-255 share, on the same crop, by the same code.** If the plates clip
 * channels freely, channel clipping is not a disqualifier and the knob is live. If they
 * do not, then 2.50% is a move AWAY from the reference and the original rejection
 * stands — on a corrected basis, but it stands.
 *
 * ⚠️ THE BIAS IN THAT CONTROL, STATED BEFORE THE RESULT. The plates are phone
 * screenshots, JPEG-compressed and upscaled 1.33-1.43x (LESSONS §3, p6). Both of those
 * destroy hard 255s — resampling averages a clipped pixel with its neighbours. So a LOW
 * reference channel-clip number is WEAK evidence (it could be the capture), while a HIGH
 * one is STRONG evidence (it survived a process that only removes them). Report both
 * >=255 and >=250 for exactly this reason: the 250 threshold is the one that survives a
 * resample.
 *
 * ⚠️ AND NO RESIZE. `p6_flat.loadFrame` resizes every frame to height 512 with lanczos3
 * before measuring — correct for its band metrics, fatal for this one, because a
 * resampling kernel turns a field of 255s into a field of 248-253s and can overshoot
 * past 255 at an edge. Everything here is measured at NATIVE resolution.
 */
import sharp from 'sharp';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PF = [0.05, 0.16, 0.95, 0.86];   // the crop p6 used on both sides
const PLATES = 'reference/images/curated/gameplay_topdown';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}

/**
 * Every quantity in the argument, on one buffer, so they can never drift apart again.
 * `data` is raw RGB at NATIVE resolution.
 */
export function clipStats(data, W, H) {
  const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const N = W * H;
  let ch255 = 0, ch250 = 0, all255 = 0, hi94 = 0, hi80 = 0, hi70 = 0;
  const perCh = [0, 0, 0];
  const L = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const l = luma(r, g, b); L[i] = l;
    if (l > 0.94) hi94++;
    if (l > 0.80) hi80++;
    if (l > 0.70) hi70++;
    const any255 = r === 255 || g === 255 || b === 255;
    if (any255) ch255++;
    if (r >= 250 || g >= 250 || b >= 250) ch250++;
    if (r === 255 && g === 255 && b === 255) all255++;
    if (r === 255) perCh[0]++;
    if (g === 255) perCh[1]++;
    if (b === 255) perCh[2]++;
  }
  L.sort();
  const q = (p) => L[Math.min(N - 1, Math.round((N - 1) * p))];
  const pct = (n) => +((100 * n) / N).toFixed(4);
  return {
    W, H, px: N,
    p50: +q(0.50).toFixed(4), p95: +q(0.95).toFixed(4), p99: +q(0.99).toFixed(4),
    // share of pixels, in PERCENT, so every row below is directly comparable to
    // stage.ts's "0.06% -> 2.50%".
    ch255: pct(ch255), ch250: pct(ch250), all255: pct(all255),
    chR: pct(perCh[0]), chG: pct(perCh[1]), chB: pct(perCh[2]),
    hi94: pct(hi94), hi80: pct(hi80), hi70: pct(hi70),
  };
}

async function statsFor(path, crop) {
  let img = sharp(path);
  const meta = await img.metadata();
  if (crop) {
    const [x0, y0, x1, y1] = crop;
    img = img.extract({
      left: Math.round(x0 * meta.width), top: Math.round(y0 * meta.height),
      width: Math.max(1, Math.round((x1 - x0) * meta.width)),
      height: Math.max(1, Math.round((y1 - y0) * meta.height)),
    });
  }
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return clipStats(data, info.width, info.height);
}

const HDR = 'src                              ch>=255  ch>=250  all255    hi94    hi80    hi70     p95';
const row = (name, s) =>
  `${name.padEnd(30)}${String(s.ch255).padStart(8)}${String(s.ch250).padStart(9)}` +
  `${String(s.all255).padStart(8)}${String(s.hi94).padStart(8)}${String(s.hi80).padStart(8)}` +
  `${String(s.hi70).padStart(8)}${String(s.p95).padStart(8)}`;

// ─────────────────────────────────────────────────────────── selftest
async function selftest() {
  let pass = 0; const fails = [];
  const ok = (n, c) => { if (c) pass++; else fails.push(n); };
  const synth = (W, H, fn) => {
    const d = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W + x) * 3;
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    return d;
  };

  const white = clipStats(synth(40, 40, () => [255, 255, 255]), 40, 40);
  ok('S1 white: every channel clipped', white.ch255 === 100 && white.all255 === 100);
  ok('S2 white: luma bands all full', white.hi94 === 100 && white.hi80 === 100 && white.p95 === 1);

  const grey = clipStats(synth(40, 40, () => [128, 128, 128]), 40, 40);
  ok('S3 mid grey clips nothing', grey.ch255 === 0 && grey.ch250 === 0 && grey.hi94 === 0);
  ok('S4 mid grey is not dark either', grey.hi70 === 0 && Math.abs(grey.p50 - 0.502) < 0.01);

  // ── THE KNOWN-BAD INPUT THIS WHOLE FILE TURNS ON ────────────────────────────
  // Saturated pure red is 100% channel-clipped and 0% luma-clipped. If one number
  // could stand in for the other, this fixture would be impossible.
  const red = clipStats(synth(40, 40, () => [255, 0, 0]), 40, 40);
  ok('S5 KNOWN-BAD: pure red is 100% channel-clipped', red.ch255 === 100 && red.chR === 100);
  ok('S6 KNOWN-BAD: …and 0% luma-clipped — the two are NOT the same quantity',
     red.hi94 === 0 && red.hi80 === 0 && red.hi70 === 0);
  ok('S7 KNOWN-BAD: …and 0% all-channel-white', red.all255 === 0);
  ok('S8 pure red sits at luma 0.2126, nowhere near the highlight band',
     Math.abs(red.p50 - 0.2126) < 0.001);

  // The mirror: a pale neutral that is luma-clipped WITHOUT any channel at 255.
  const pale = clipStats(synth(40, 40, () => [252, 251, 250]), 40, 40);
  ok('S9 KNOWN-BAD: near-white is 100% luma-clipped with ZERO channels at 255',
     pale.hi94 === 100 && pale.ch255 === 0);
  ok('S10 …but the >=250 threshold does catch it', pale.ch250 === 100);

  const half = clipStats(synth(40, 40, (x) => (x < 20 ? [255, 255, 255] : [0, 0, 0])), 40, 40);
  ok('S11 a 50/50 split reads 50%', half.ch255 === 50 && half.hi94 === 50);
  ok('S12 per-channel counts agree on a neutral', half.chR === 50 && half.chG === 50 && half.chB === 50);

  const oneCh = clipStats(synth(40, 40, () => [200, 255, 100]), 40, 40);
  ok('S13 per-channel isolates which channel pinned',
     oneCh.chR === 0 && oneCh.chG === 100 && oneCh.chB === 0 && oneCh.ch255 === 100);

  const just = clipStats(synth(40, 40, () => [254, 254, 254]), 40, 40);
  ok('S14 254 is NOT 255 — the threshold is exact', just.ch255 === 0 && just.ch250 === 100);
  ok('S15 …and 254 is still luma-clipped', just.hi94 === 100);

  // Crop plumbing, end to end through sharp: top half white, bottom half black.
  const tmp = join(process.env.TMPDIR || '/tmp', `kneeprice-selftest-${process.pid}.png`);
  await sharp(synth(64, 64, (_x, y) => (y < 32 ? [255, 255, 255] : [0, 0, 0])),
    { raw: { width: 64, height: 64, channels: 3 } }).png().toFile(tmp);
  const whole = await statsFor(tmp, null);
  const bottom = await statsFor(tmp, [0, 0.5, 1, 1]);
  const top = await statsFor(tmp, [0, 0, 1, 0.5]);
  ok('S16 uncropped reads 50%', whole.ch255 === 50);
  ok('S17 KNOWN-BAD: the crop actually crops — bottom half is 0%', bottom.ch255 === 0);
  ok('S18 …and the top half is 100%', top.ch255 === 100);
  ok('S19 crop geometry is right', bottom.px === 64 * 32 && whole.px === 64 * 64);

  // No resize: a 1-px checkerboard of white and black must stay at exactly 50%
  // channel-clipped. Under p6_flat's lanczos resize to height 512 it would not.
  const check = await (async () => {
    const p = join(process.env.TMPDIR || '/tmp', `kneeprice-check-${process.pid}.png`);
    await sharp(synth(200, 200, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])),
      { raw: { width: 200, height: 200, channels: 3 } }).png().toFile(p);
    return statsFor(p, null);
  })();
  ok('S20 KNOWN-BAD: a 1px checker survives at exactly 50% — nothing resamples',
     check.ch255 === 50 && check.px === 40000);
  ok('S21 …and its p95 is white, not a blurred mid grey', check.p95 === 1);

  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(`${fails.length ? 'FAIL' : 'PASS'}  kneeprice selftest: ${pass} passed, ${fails.length} failed`);
  return fails.length;
}

// ─────────────────────────────────────────────────────────── plates (offline)
async function plates(args) {
  const crop = args.whole ? null : PF;
  console.log(`crop: ${crop ? PF.join(',') : 'WHOLE FRAME'}   (native resolution, no resize)\n`);
  console.log(HDR);
  const out = { crop, ref: [], ours: [] };

  const refFiles = readdirSync(PLATES).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  for (const f of refFiles) {
    const s = await statsFor(join(PLATES, f), crop);
    out.ref.push({ name: f, ...s });
    console.log(row(`ref ${f}`, s));
  }
  const oursDir = String(args.ours ?? 'shots/p6/cap');
  let ourFiles = [];
  try { ourFiles = readdirSync(oursDir).filter((f) => /\.png$/i.test(f)).sort(); } catch { /* none */ }
  for (const f of ourFiles) {
    const s = await statsFor(join(oursDir, f), crop);
    out.ours.push({ name: f, ...s });
    console.log(row(`ours ${f}`, s));
  }

  const band = (rows, k) => rows.length
    ? `${Math.min(...rows.map((r) => r[k])).toFixed(4)} - ${Math.max(...rows.map((r) => r[k])).toFixed(4)}`
    : 'n/a';
  console.log('');
  for (const k of ['ch255', 'ch250', 'hi94', 'hi80', 'p95']) {
    console.log(`${k.padEnd(8)} reference ${band(out.ref, k).padEnd(22)} ours ${band(out.ours, k)}`);
  }
  if (args.out) {
    mkdirSync(String(args.out), { recursive: true });
    writeFileSync(join(String(args.out), 'plates.json'), JSON.stringify(out, null, 1));
  }
  return out;
}

// ─────────────────────────────────────────────────────────── live sweep
/**
 * One SYNCHRONOUS in-page pass, so the game's own rAF loop cannot interleave and the
 * content is identical across every config BY CONSTRUCTION — `stage.render(0)` composites
 * without stepping the sim (`postablate.mjs`'s technique). The drift control is therefore
 * expected to be EXACTLY zero rather than merely small; anything else is a clock-driven
 * shader and must be reported as the floor.
 *
 * ⚠️ `gl.readPixels` reads the CANVAS, not the page — the HUD is a DOM overlay
 * (`GameSessionOptions.hudRoot`), so it is absent from every number here. That is
 * deliberate and it is the same surface `postablate.mjs` measured, which is what makes
 * these numbers comparable to `stage.ts`'s recorded 0.06% / 2.50%.
 */
async function liveSweep(a) {
  const { chromium } = await import('playwright');
  const OUT = String(a.out ?? 'shots/knee');
  mkdirSync(OUT, { recursive: true });
  const W = 1600, H = 900;
  const KNEES = [null, 0.86, 0.88, 0.90, 0.92, 1.00, null];   // first and last = drift control
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
  const BASE = String(a.url).replace(/\/$/, '');
  await page.goto(`${BASE}/?player=hamburger&enemy=sushi&pointerLock=0&px=860&py=500`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-el="countdown"]');
    return !c || c.style.display === 'none';
  }, null, { timeout: 120_000 });
  await page.waitForTimeout(Number(a.settle ?? 9000));

  const res = await page.evaluate(({ src, knees, pf }) => {
    // The SAME function the reference plates were measured with, shipped into the page
    // as source. Two copies of this arithmetic is exactly how the quantity being argued
    // about got confused in the first place.
    const clipStats = eval(`(${src})`);
    const stage = window.__stage;
    if (!stage || stage.disposed) return { error: 'no live Stage' };
    const g = stage.grade;
    if (!g) return { error: 'no grade in the chain' };
    const r = stage.renderer, gl = r.getContext();
    const Wp = r.domElement.width, Hp = r.domElement.height;
    const shipped = g.highlightKnee;

    const readRGB = () => {
      const buf = new Uint8Array(Wp * Hp * 4);
      gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const out = new Uint8Array(Wp * Hp * 3);      // flip Y, drop alpha
      for (let y = 0; y < Hp; y++) {
        const s = (Hp - 1 - y) * Wp * 4, d = y * Wp * 3;
        for (let x = 0; x < Wp; x++) {
          out[d + x * 3] = buf[s + x * 4];
          out[d + x * 3 + 1] = buf[s + x * 4 + 1];
          out[d + x * 3 + 2] = buf[s + x * 4 + 2];
        }
      }
      return out;
    };
    const crop = (rgb, [x0, y0, x1, y1]) => {
      const cx = Math.round(x0 * Wp), cy = Math.round(y0 * Hp);
      const cw = Math.round((x1 - x0) * Wp), ch = Math.round((y1 - y0) * Hp);
      const out = new Uint8Array(cw * ch * 3);
      for (let y = 0; y < ch; y++) {
        out.set(rgb.subarray(((cy + y) * Wp + cx) * 3, ((cy + y) * Wp + cx + cw) * 3), y * cw * 3);
      }
      return { data: out, W: cw, H: ch };
    };

    const rows = [];
    const shots = {};
    for (let i = 0; i < knees.length; i++) {
      const k = knees[i];
      g.highlightKnee = k === null ? shipped : k;
      stage.render(0); stage.render(0);
      const rgb = readRGB();
      const c = crop(rgb, pf);
      const name = k === null ? (i === 0 ? 'shipped' : 'shipped2') : `knee${k.toFixed(2)}`;
      rows.push({ name, knee: g.highlightKnee, whole: clipStats(rgb, Wp, Hp), pf: clipStats(c.data, c.W, c.H) });
      if (name === 'shipped' || name === 'knee0.92' || name === 'knee1.00') {
        try { shots[name] = r.domElement.toDataURL('image/png'); } catch { /* no preserveDrawingBuffer */ }
      }
    }
    g.highlightKnee = shipped;
    stage.render(0);
    return { shipped, Wp, Hp, rows, shots, tier: window.__quality?.tier ?? null };
  }, { src: clipStats.toString(), knees: KNEES, pf: PF });

  if (res.error) { console.log(`ERROR: ${res.error}`); await browser.close(); process.exit(1); }
  console.log(`canvas ${res.Wp}x${res.Hp}  shipped knee ${res.shipped}  tier ${res.tier}`);
  for (const [name, d] of Object.entries(res.shots ?? {})) {
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(String(d).split(',')[1], 'base64'));
  }
  for (const scope of ['whole', 'pf']) {
    console.log(`\n── ${scope === 'whole' ? 'WHOLE CANVAS (no DOM HUD)' : `PLAYFIELD CROP ${PF.join(',')}`} ──`);
    console.log(HDR);
    for (const r of res.rows) console.log(row(r.name, r[scope]));
  }
  const a0 = res.rows[0], a1 = res.rows[res.rows.length - 1];
  console.log('\nDRIFT CONTROL (shipped vs shipped2, same frozen frame):');
  for (const k of ['ch255', 'ch250', 'hi94', 'hi80', 'hi70', 'p95']) {
    console.log(`  ${k.padEnd(7)} whole ${(a1.whole[k] - a0.whole[k]).toFixed(4)}   pf ${(a1.pf[k] - a0.pf[k]).toFixed(4)}`);
  }
  writeFileSync(join(OUT, 'live.json'), JSON.stringify(res.rows, null, 1));
  await browser.close();
}

// ─────────────────────────────────────────────────────────── main
const args = parseArgs(process.argv);
if (args.selftest) process.exit((await selftest()) ? 1 : 0);
else if (args.plates) await plates(args);
else if (args.url) await liveSweep(args);
else {
  console.log('usage: --selftest | --plates [--whole] [--ours <dir>] | --url <snapshot>');
  process.exit(2);
}
