/**
 * qv0_frame — REFUTATION probe for the "over-closed brow" cause.
 *
 * The peer claim (angle A) is that `062513c` explains Uri's *"resolution is slightly
 * lower ... home screen, and more specifically character screen"* because the hamburger's
 * brows closed onto the eye lashes.
 *
 * `062513c` ALSO moved geometry that sat at the TOP of the model (the brows were measured
 * at hFrac 0.99 of the crown, i.e. the apex) and swapped the pick's ball for a flag.
 * `charStage.ts` computes
 *
 *     subjectH = Box3().setFromObject(model.root).max.y - min.y
 *     rig.subjectFill = clamp(min(V_FILL, (H_FILL * aspect * h) / w), 0.2, V_FILL)
 *
 * so ANY change to the model's vertical extent RE-FRAMES THE WHOLE HERO in the panel.
 * A hero drawn smaller in the same canvas has genuinely fewer pixels across it — which is
 * a much more direct account of *"the resolution is slightly lower"* than two dark
 * features merging.
 *
 * This tool does not measure brows. It measures FRAMING and PIXEL BUDGET, at Uri's device
 * profile (393x852 CSS, deviceScaleFactor 3), on two statically served built bundles.
 *
 * DRIFT CONTROL (rule 4): the portrait yaws +/-22 degrees, so the tool samples info()
 * N times per station and reports the per-field min/max WITHIN an arm. A cross-arm delta
 * is only reported as real when it exceeds the within-arm spread of the same field.
 *
 * POINTING ARM (rule 6, "--selftest never validates where the tool is POINTED"): every
 * station must report a non-null model box and a non-empty sample set before any delta is
 * taken. ⚠️ There is NO subject-swap control in here: `charStage.ts` exposes `__charStage()`
 * as a READ hook only, so a page-side "show donut instead" cannot be driven, and a branch
 * that quietly no-ops would be indistinguishable from a control that ran and passed. The
 * swap control is the peer's (`aaf50e9`), not this tool's — do not quote this one for it.
 *
 * Usage:
 *   node tools/tmp/qv0_frame.mjs --before <distdir> --after <distdir> [--out <dir>]
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon',
};

function serve(root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      let p = path.join(root, decodeURIComponent(u.pathname));
      if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
      if (!fs.existsSync(p)) { res.writeHead(404); res.end('nope'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

// Uri's device, stated explicitly. SwiftShader is not a phone; this fixes the only two
// terms that govern the pixel budget (CSS box and deviceScaleFactor) so the A/B is on the
// same instrument and the ABSOLUTE numbers are labelled as emulated, never as his.
const DEVICE = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

const SAMPLES = 12;

async function station(page, base, screen) {
  await page.goto(`${base}/?screen=${screen}`, { waitUntil: 'load' });
  // Wait for a REAL portrait, not for a flag. `__screenReady` is not a paint, and
  // `__charStage()` returns null until a model is mounted.
  await page.waitForFunction(() => {
    const w = /** @type {any} */ (window);
    const i = typeof w.__charStage === 'function' ? w.__charStage() : null;
    return !!(i && i.crown && i.feet && i.subject && i.subject.h > 0);
  }, null, { timeout: 30000 });
  await page.waitForTimeout(1200); // let the entrance animation and the sway settle

  // NOTE, deliberately NOT implemented rather than implemented and inert: there is no
  // page-side setter for the portrait's character (`charStage.ts` exposes `__charStage()`
  // as a READ hook only), so a "swap to donut" subject control cannot be driven from here.
  // A branch that quietly no-ops is indistinguishable from a control that ran and passed —
  // the `gatecount: historical` lesson — so the swap is left to the peer tool that has it.
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    samples.push(await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      const info = w.__charStage();
      const cs = Array.from(document.querySelectorAll('canvas'));
      // The portrait canvas is the largest live WebGL canvas on a menu screen.
      let best = null;
      for (const c of cs) {
        const r = c.getBoundingClientRect();
        if (!best || r.width * r.height > best.cssW * best.cssH) {
          best = { cssW: r.width, cssH: r.height, bufW: c.width, bufH: c.height };
        }
      }
      return { info, canvas: best, dpr: window.devicePixelRatio };
    }));
    await page.waitForTimeout(70);
  }
  return samples;
}

function spread(samples, get) {
  const vals = samples.map(get).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return null;
  return { n: vals.length, min: Math.min(...vals), max: Math.max(...vals), mean: vals.reduce((a, b) => a + b, 0) / vals.length };
}

const FIELDS = [
  ['subject.h', (s) => s.info.subject.h],
  ['subject.w', (s) => s.info.subject.w],
  ['fill', (s) => s.info.fill],
  ['aspect', (s) => s.info.aspect],
  ['crown.y', (s) => s.info.crown.y],
  ['feet.y', (s) => s.info.feet.y],
  ['left.x', (s) => s.info.left.x],
  ['right.x', (s) => s.info.right.x],
  ['canvas.bufW', (s) => s.canvas.bufW],
  ['canvas.bufH', (s) => s.canvas.bufH],
  ['canvas.cssW', (s) => s.canvas.cssW],
  ['dpr', (s) => s.dpr],
];

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const beforeRoot = path.resolve(arg('--before'));
  const afterRoot = path.resolve(arg('--after'));
  const outDir = path.resolve(arg('--out', '/tmp/qv0_out'));
  fs.mkdirSync(outDir, { recursive: true });

  const servers = [];
  const browser = await chromium.launch();
  const results = {};
  try {
    for (const [arm, root] of [['before', beforeRoot], ['after', afterRoot]]) {
      const s = await serve(root);
      servers.push(s.srv);
      console.log(`[qv0] ${arm} -> ${root} @ ${s.url} (pid ${process.pid})`);
      const ctx = await browser.newContext(DEVICE);
      const page = await ctx.newPage();
      results[arm] = {};
      for (const screen of ['home', 'characters']) {
        const samples = await station(page, s.url, screen);
        // POINTING / NON-EMPTY arm, asserted BEFORE any ratio is taken.
        if (samples.length === 0) throw new Error(`${arm}/${screen}: zero samples`);
        if (!samples.every((x) => x.info && x.info.crown && x.canvas)) {
          throw new Error(`${arm}/${screen}: a sample has no model box or no canvas — tool is not pointed at the portrait`);
        }
        results[arm][screen] = samples;
        const png = path.join(outDir, `${arm}_${screen}.png`);
        await page.locator('canvas').first().screenshot({ path: png });
        console.log(`[qv0]   ${screen}: id=${samples[0].info.id} png=${png}`);
      }
      await ctx.close();
    }
  } finally {
    for (const srv of servers) srv.close();
    await browser.close();
  }

  console.log('\n=== PER-FIELD: within-arm SPREAD (drift control) and cross-arm DELTA ===');
  for (const screen of ['home', 'characters']) {
    console.log(`\n--- ${screen} (393x852 CSS, dsf 3, emulated) ---`);
    console.log('field         before(min..max)          after(min..max)           delta(mean)   verdict');
    for (const [name, get] of FIELDS) {
      const b = spread(results.before[screen], get);
      const a = spread(results.after[screen], get);
      if (!b || !a) { console.log(`${name.padEnd(13)} UNAVAILABLE`); continue; }
      const d = a.mean - b.mean;
      const noise = Math.max(b.max - b.min, a.max - a.min);
      const verdict = Math.abs(d) > noise ? (noise === 0 ? 'MOVED (exact)' : 'MOVED') : 'inside within-arm spread';
      console.log(
        `${name.padEnd(13)} ${b.min.toFixed(4)}..${b.max.toFixed(4)}`.padEnd(14 + 20)
        + `  ${a.min.toFixed(4)}..${a.max.toFixed(4)}`.padEnd(22)
        + `  ${d >= 0 ? '+' : ''}${d.toFixed(4)}`.padEnd(14) + verdict,
      );
    }
  }

  fs.writeFileSync(path.join(outDir, 'qv0_frame.json'), JSON.stringify(results, null, 1));
  console.log(`\n[qv0] raw -> ${path.join(outDir, 'qv0_frame.json')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
