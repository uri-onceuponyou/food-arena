#!/usr/bin/env node
/**
 * B2_LOGIC — the pure halves of two B2 fixes, pinned in Node with no browser:
 *
 *   §K  `input.ts:weaponSlotForKey` (F4) — the weapon digit is the CHARACTER first and the
 *       PHYSICAL CODE as the fallback, so an AZERTY number row picks weapons; modified
 *       presses (Ctrl / Meta / Alt) never fall back.
 *   §L  `InputController`'s attack edge latch (F2) — a press shorter than one frame is
 *       collected exactly once, a held press leaves no stale latch, and the mouse listens
 *       on the canvas's HOST (F5), where a letterbox bar's press lands.
 *
 * `src/game/input.ts` is bundled by esbuild with `../audio` stubbed (it is the only import
 * that drags in the engine), then driven through a minimal EventTarget "DOM": a `window`, a
 * `document`, a canvas and its host. Without touch points `touch.ts` installs its inert stub,
 * so the touch half of the latch is the browser's to prove (`b2_input.mjs` §F2).
 *
 * ── KNOWN-BAD ARMS (`--selftest`) ──────────────────────────────────────────
 * Each plant rewrites the bundled SOURCE of input.ts and must turn the named rows red; a
 * plant that does not match the source voids the run. This validates the test's logic, not
 * where it is pointed — the browser rows in `b2_input.mjs` do that.
 *   key-only      `weaponSlotForKey` without the code fallback (the 8586f00 rule)  → §K red
 *   no-mod-gate   the code fallback taken under Ctrl / Alt too                     → §K red
 *   clear-on-up   onMouseUp also clears the latch ("symmetry")                     → §L red
 *   canvas-only   the mouse listeners on the canvas, not its host (8586f00)        → §L red
 *
 *   node tools/tmp/b2_logic.mjs              # the shipped source: every row green, exit 0
 *   node tools/tmp/b2_logic.mjs --selftest   # + each plant must fail its rows, exit 0 iff so
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SELFTEST = process.argv.includes('--selftest');

const PLANTS = {
  'key-only': [/if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return null;\n\s*const m = /, 'return null;\n  const m = '],
  'no-mod-gate': [/if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return null;/, ''],
  'clear-on-up': [/if \(e\.button === 0\) this\.mouseDown = false;/, 'if (e.button === 0) { this.mouseDown = false; this.attackPress = false; }'],
  'canvas-only': [/this\.surface = canvas\.parentElement \?\? canvas;/, 'this.surface = canvas;'],
};

/** Bundle input.ts (optionally planted) and import it fresh. */
async function load(plant) {
  let hits = 0;
  const out = await build({
    entryPoints: [join(ROOT, 'src/game/input.ts')], bundle: true, format: 'esm', write: false,
    platform: 'neutral', logLevel: 'silent',
    plugins: [{
      name: 'b2',
      setup(b) {
        b.onResolve({ filter: /^\.\.\/audio$/ }, () => ({ path: 'audio-stub', namespace: 'b2' }));
        b.onLoad({ filter: /.*/, namespace: 'b2' }, () => ({ contents: 'export const audio = { toggleMuted() {} };', loader: 'js' }));
        if (plant) {
          b.onLoad({ filter: /src[\\/]game[\\/]input\.ts$/ }, async (a) => {
            const { readFileSync } = await import('node:fs');
            let src = readFileSync(a.path, 'utf8');
            const [from, to] = PLANTS[plant];
            if (from.test(src)) { src = src.replace(from, to); hits++; }
            return { contents: src, loader: 'ts' };
          });
        }
      },
    }],
  });
  const dir = mkdtempSync(join(tmpdir(), 'b2-logic-'));
  const file = join(dir, 'input.mjs');
  writeFileSync(file, out.outputFiles[0].text);
  const mod = await import(pathToFileURL(file).href);
  rmSync(dir, { recursive: true, force: true });
  if (plant && hits === 0) throw new Error(`plant ${plant} did not match input.ts — the run is void`);
  return mod;
}

/** The smallest "DOM" InputController needs. Installed once; each arm builds a fresh one. */
function installDom() {
  globalThis.window = Object.assign(new EventTarget(), { innerWidth: 800, innerHeight: 600 });
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  globalThis.location = { search: '' };
}
const ev = (type, props = {}) => Object.assign(new Event(type), props);

function runK(mod) {
  const f = mod.weaponSlotForKey;
  const table = [
    ['QWERTY "1"', { key: '1', code: 'Digit1' }, 0],
    ['QWERTY "4"', { key: '4', code: 'Digit4' }, 3],
    ['AZERTY "é" (Digit2)', { key: 'é', code: 'Digit2' }, 1],
    ['AZERTY "\\"" (Digit3)', { key: '"', code: 'Digit3' }, 2],
    ['AZERTY "&" (Digit1)', { key: '&', code: 'Digit1' }, 0],
    ['AZERTY Shift+é = "2"', { key: '2', code: 'Digit2', shiftKey: true }, 1],
    ['numpad, NumLock off ("End", Numpad1)', { key: 'End', code: 'Numpad1' }, 0],
    ['Ctrl+& is a shortcut (no fallback)', { key: '&', code: 'Digit1', ctrlKey: true }, null],
    ['AltGr+é is a composition (no fallback)', { key: '~', code: 'Digit2', ctrlKey: true, altKey: true }, null],
    ['Digit0 picks nothing', { key: 'à', code: 'Digit0' }, null],
    ['a letter picks nothing', { key: 'q', code: 'KeyQ' }, null],
  ];
  return table.map(([name, e, want]) => {
    const got = f({ ctrlKey: false, metaKey: false, altKey: false, ...e });
    return { sec: 'K', name, pass: got === want, detail: `got ${got}, want ${want}` };
  });
}

function runL(mod) {
  installDom();
  const host = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    parentElement: host, getBoundingClientRect: () => ({ left: 0, top: 75, width: 800, height: 450 }),
  });
  const c = new mod.InputController(canvas);
  const rows = [];
  const r = (name, pass, detail) => rows.push({ sec: 'L', name, pass, detail });
  // Sub-frame: down and up before any frame collects anything.
  host.dispatchEvent(ev('mousedown', { button: 0 }));
  window.dispatchEvent(ev('mouseup', { button: 0 }));
  const held0 = c.attackHeld, first = c.takeAttackPress(), second = c.takeAttackPress();
  r('a sub-frame press on the host is collected (level false, edge true)', !held0 && first, { held0, first });
  r('…exactly once', second === false, { second });
  // Held across frames: the edge is spent on the first frame; nothing is left after release.
  // One "frame" is `buildInput`'s real shape: TAKE the edge unconditionally, then combine.
  // ⚠️ The first cut wrote `c.attackHeld || c.takeAttackPress()` — the short-circuit
  // `match.ts` documents as the known-bad — and this row went red on the shipped source.
  const frame = () => { const pressed = c.takeAttackPress(); return c.attackHeld || pressed; };
  host.dispatchEvent(ev('mousedown', { button: 0 }));
  const f1 = frame(), f2 = frame();
  window.dispatchEvent(ev('mouseup', { button: 0 }));
  const f3edge = frame();
  r('a held press reads true on every held frame', f1 && f2, { f1, f2 });
  r('…and leaves no latch behind after the release', c.attackHeld === false && f3edge === false, { f3edge });
  host.dispatchEvent(ev('mousedown', { button: 2 }));
  r('a right-button press is not an attack', c.takeAttackPress() === false && c.attackHeld === false);
  window.dispatchEvent(ev('mouseup', { button: 2 }));
  host.dispatchEvent(ev('mousedown', { button: 0 }));
  window.dispatchEvent(ev('mouseup', { button: 0 }));
  c.reset();
  r('reset() drops a pending press', c.takeAttackPress() === false);
  host.dispatchEvent(ev('mousedown', { button: 0 }));
  window.dispatchEvent(ev('mouseup', { button: 0 }));
  window.dispatchEvent(ev('blur'));
  r('a window blur drops a pending press', c.takeAttackPress() === false);
  // The host is where a bar's press lands (F5); the cursor there aims with canvas-relative NDC.
  host.dispatchEvent(ev('mousemove', { clientX: 400, clientY: 560, movementX: 0, movementY: 0 }));
  const ndc = c.mouseNdc;
  r('a cursor in the bar BELOW the canvas reaches aim, NDC y < -1 (unclamped)', !!ndc && ndc.y < -1, { ndc });
  c.dispose();
  return rows;
}

async function suite(plant) {
  const mod = await load(plant);
  return [...runK(mod), ...runL(mod)];
}

let failures = 0;
const shipped = await suite(null);
for (const x of shipped) {
  if (!x.pass) failures++;
  console.log(`${x.pass ? 'PASS' : 'FAIL'}  §${x.sec} ${x.name}${x.pass ? '' : `  — ${JSON.stringify(x.detail)}`}`);
}
console.log(`\n${shipped.length - failures}/${shipped.length} rows passed on the shipped source`);

if (SELFTEST) {
  const want = { 'key-only': 'K', 'no-mod-gate': 'K', 'clear-on-up': 'L', 'canvas-only': 'L' };
  for (const [plant, sec] of Object.entries(want)) {
    const res = await suite(plant);
    const red = res.filter((x) => !x.pass);
    const ok = red.length > 0 && red.every((x) => x.sec === sec);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  selftest: plant ${plant} turns §${sec} red (${red.length}: ${red.map((x) => x.name).join(' | ')})`);
  }
}
process.exit(failures ? 1 : 0);
