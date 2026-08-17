/**
 * adm_unreachable — proves §76 constraint 5 on a REAL production build.
 *
 *   > *"It must be UNREACHABLE in the shipped player build. A live tuning panel is a cheat
 *   > surface and a support nightmare."*  — `DECISIONS-FOR-URI.md` §76
 *
 * ── WHAT IS ACTUALLY CLAIMED, AND WHAT IS NOT ───────────────────────────────────
 *
 * 🚨 **UNREACHABLE, NOT ABSENT.** The admin module is statically imported by `shell.ts`,
 * so its bytes ARE in the default bundle. Claiming otherwise would be a plausible,
 * unmeasured statement of exactly the kind this repo keeps paying for. What is proved here
 * is that **every path to the screen refuses** — and the paths include the one a cheat
 * would actually use, `window.__shell.navigate`, which `shell.ts` publishes in production.
 *
 * Making it absent needs the import to be dynamic and dead-code-eliminated, which needs a
 * `define` in `vite.config.ts` — outside the owning agent's file set. It is in the report.
 *
 * ── THE KNOWN-BAD ARM IS THE WHOLE DESIGN ───────────────────────────────────────
 *
 * `CLAUDE.md` #6: *"a guard that has not been shown to FAIL on the bug it guards against is
 * not a guard"*, and #6 again on vacuity: *"a known-bad planted where the bug CANNOT
 * express itself"*. A test that merely asserts "admin did not mount" passes trivially in a
 * build where the admin code does not exist, where the URL is wrong, where the server is
 * down, or where the page never booted. So this builds the tree TWICE:
 *
 *   ARM A   npx vite build                    admin must be UNREACHABLE on every path
 *   ARM B   VITE_FA_ADMIN=1 npx vite build    admin must be REACHABLE on every path
 *
 * Arm B is the control. If arm B fails to reach the panel, arm A's clean sheet means
 * nothing — the harness would be measuring its own inability to navigate — and this tool
 * says so and exits non-zero rather than reporting a pass.
 *
 * Both arms run against the SAME source tree, the same server implementation and the same
 * five navigation paths, so the only difference between them is one environment variable.
 *
 * Usage:  node tools/tmp/adm_unreachable.mjs [--keep]
 */

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const KEEP = process.argv.includes('--keep');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

/**
 * A static server over a built bundle.
 *
 * ⚠️ It 404s anything it does not hold rather than falling back to `index.html`. A
 * fallback server would serve the HTML for a missing chunk, the page would boot with a
 * broken module graph, `__screen` would stay undefined, and arm A would pass for the
 * wrong reason — the `ab_basepath` lesson, which needed a host strict enough for its
 * passing rows to mean anything.
 */
function serve(dir) {
  return new Promise((ready) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (p === '/' || p === '') p = '/index.html';
      const file = join(dir, p);
      if (!file.startsWith(dir) || !existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('404');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => ready({ server, port: server.address().port }));
  });
}

function build(outDir, env) {
  const r = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    console.error(`vite build failed (${JSON.stringify(env)}):\n${r.stdout}\n${r.stderr}`);
    process.exit(2);
  }
  return r.stdout;
}

/**
 * The five paths to the screen. Each returns the screen name the app ended up on.
 *
 * ⚠️ Every one waits on the screen NAME rather than on `window.__screenReady`, which
 * `AGENT-BRIEF.md` §3 records as NOT A PAINT (measured opacity 0.000 when it flips). Here
 * the name is also the actual verdict, so there is nothing else to wait for.
 */
const PATHS = [
  {
    name: 'URL ?screen=admin',
    async run(page, base) {
      await page.goto(`${base}/?screen=admin`, { waitUntil: 'load' });
      return settledScreen(page);
    },
  },
  {
    name: 'URL ?screen=admin&admin=selftest',
    async run(page, base) {
      await page.goto(`${base}/?screen=admin&admin=selftest`, { waitUntil: 'load' });
      return settledScreen(page);
    },
  },
  {
    name: 'window.__shell.navigate (the production QA global)',
    async run(page, base) {
      await page.goto(`${base}/?screen=home`, { waitUntil: 'load' });
      await page.waitForFunction('typeof window.__shell === "object"', null, { timeout: 20000 });
      await page.evaluate(() => window.__shell.navigate({ name: 'admin' }));
      return settledScreen(page);
    },
  },
  {
    name: 'popstate carrying {name:"admin"} in history.state',
    async run(page, base) {
      await page.goto(`${base}/?screen=home`, { waitUntil: 'load' });
      await page.waitForFunction('window.__screen === "home"', null, { timeout: 20000 });
      await page.evaluate(() => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: { fa: 1, route: { name: 'admin' } } }));
      });
      return settledScreen(page);
    },
  },
  {
    name: 'popstate with no state, ?screen=admin in the address bar',
    async run(page, base) {
      await page.goto(`${base}/?screen=home`, { waitUntil: 'load' });
      await page.waitForFunction('window.__screen === "home"', null, { timeout: 20000 });
      await page.evaluate(() => {
        history.replaceState(null, '', `${location.pathname}?screen=admin`);
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      });
      return settledScreen(page);
    },
  },
];

/** Give the curtain (140 ms) time to swap, then read the mounted screen's name. */
async function settledScreen(page) {
  await page.waitForFunction('typeof window.__screen === "string"', null, { timeout: 20000 });
  await page.waitForTimeout(500);
  return page.evaluate(() => ({
    screen: window.__screen,
    hasPanelDom: !!document.querySelector('[data-el="admin"]'),
    hasHandle: typeof window.__admin === 'object',
  }));
}

async function runArm(label, dir, expectReachable) {
  const { server, port } = await serve(dir);
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const rows = [];
  try {
    for (const path of PATHS) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
      let got;
      try {
        got = await path.run(page, base);
      } catch (err) {
        got = { screen: `<threw: ${String(err.message).slice(0, 80)}>`, hasPanelDom: false, hasHandle: false };
      }
      const reached = got.screen === 'admin' && got.hasPanelDom;
      rows.push({
        arm: label, path: path.name, screen: got.screen,
        dom: got.hasPanelDom, handle: got.hasHandle,
        ok: reached === expectReachable,
        errors: errors.slice(0, 1),
      });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────

const tmp = await mkdtemp(join(tmpdir(), 'fa-adm-'));
const dirA = join(tmp, 'default');
const dirB = join(tmp, 'admin');

console.log('building ARM A  (npx vite build)                  …');
build(dirA, { VITE_FA_ADMIN: '' });
console.log('building ARM B  (VITE_FA_ADMIN=1 npx vite build)  …');
build(dirB, { VITE_FA_ADMIN: '1' });

const rows = [
  ...await runArm('A default   ', dirA, false),
  ...await runArm('B admin=1   ', dirB, true),
];

const armA = rows.filter((r) => r.arm.startsWith('A'));
const armB = rows.filter((r) => r.arm.startsWith('B'));

console.log('');
for (const r of rows) {
  console.log(
    `${r.ok ? ' ok  ' : 'FAIL '} ${r.arm} ${r.path.padEnd(52)} `
    + `→ screen=${String(r.screen).padEnd(10)} dom=${r.dom ? 'yes' : 'no '} handle=${r.handle ? 'yes' : 'no '}`
    + (r.errors.length ? `  [${r.errors[0]}]` : ''),
  );
}

// 🚨 THE CONTROL, ASSERTED EXPLICITLY. Arm A proves nothing unless arm B proves the
// harness can reach a panel that IS there. `[].every()` is `true`, so the non-empty check
// comes first — CLAUDE.md #6.
const bReached = armB.filter((r) => r.screen === 'admin' && r.dom);
const controlOk = armB.length > 0 && bReached.length === armB.length;
const aBlocked = armA.filter((r) => r.screen !== 'admin' && !r.dom && !r.handle);
const gateOk = armA.length > 0 && aBlocked.length === armA.length;

console.log('');
console.log(`CONTROL  arm B reached the panel on ${bReached.length}/${armB.length} paths`
  + (controlOk ? '' : '   ← the harness cannot see a reachable panel; arm A means NOTHING'));
console.log(`GATE     arm A refused the panel on ${aBlocked.length}/${armA.length} paths`);
console.log('');
const fails = rows.filter((r) => !r.ok).length;
console.log(`adm_unreachable: ${rows.length - fails}/${rows.length} paths as expected`
  + (controlOk && gateOk ? '   — §76 constraint 5 HOLDS' : '   — FAULT'));

if (!KEEP) await rm(tmp, { recursive: true, force: true });
else console.log(`builds kept at ${tmp}`);

process.exit(fails === 0 && controlOk && gateOk ? 0 : 1);
