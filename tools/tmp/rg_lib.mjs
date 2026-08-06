#!/usr/bin/env node
/**
 * OFFLINE RIG HARNESS — builds the REAL cast in node, with no browser and no GPU.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Every existing character instrument in this repo (`limbcheck`, `limbmatch`,
 * `sepscan`, `charprobe`) boots Chromium under SwiftShader, waits ~40 s, and reads
 * `gl.readPixels()`. That is the right tool when the QUESTION IS ABOUT PIXELS. It is
 * the wrong tool for a question about GEOMETRY, and it has three costs that bit this
 * pass specifically:
 *
 *   1. It is contended. Six agents share one machine and SwiftShader is CPU-bound, so
 *      a sweep that should take a minute takes twenty.
 *   2. It measures ONE FRAME. `docs/LESSONS.md` and the briefs both record that no
 *      instrument here has ever measured a MOVING pose, which is exactly where the
 *      owner's "limbs intersecting and getting into one another" lives.
 *   3. A rendered frame cannot see interpenetration at all. Two capsules that pass
 *      through each other produce the same silhouette as two capsules that touch.
 *
 * `src/characters/*` is pure `three` scene-graph construction — procedural geometry,
 * no GLTF, no textures that need a GL context, no `AnimationMixer`. So the whole cast
 * builds in node in ~200 ms and `rig.animate()` can be stepped at any phase for free.
 * That makes a 300-sample animation sweep across eleven characters cheaper than ONE
 * SwiftShader screenshot.
 *
 * ⚠️ What this harness can and cannot answer:
 *   CAN  — where every joint and every vertex is, in world space, at any animation
 *          phase; whether two limb volumes overlap; how big anything is.
 *   CANNOT — colour, light, post-processing, or anything about the shipped image that
 *          is not pure geometry. For those, the GPU instruments remain correct and
 *          this one must not be substituted for them.
 *
 * Read `rg_solid.mjs` for the software rasteriser built on top of this, which closes
 * the remaining gap (delivered pixels) without a GPU either.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');

export const ALL_IDS = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop',
  'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];

/**
 * Which archetype each character picks, for grouping output. Read off the `bodyType`
 * call in each character file; kept here rather than imported because `bodies.ts`
 * does not publish it back and a character may override enough to sit between two.
 */
export const ARCHETYPE = {
  hamburger: 'stout', soup: 'stout', taco: 'stout',
  donut: 'stub', egg: 'stub', lollipop: 'stub', waterbottle: 'stub',
  pizza: 'standard', sushi: 'standard',
  burrito: 'lanky', hotdog: 'lanky',
};

/**
 * Bundle `src/characters/registry.ts` (and its whole import graph, including `three`)
 * into one node-runnable ESM.
 *
 * `three` is INLINED rather than left external. It has to be: the bundle lands in the
 * OS temp dir so nothing generated is ever left in the repo for `verify-head` to trip
 * over, and node resolves bare specifiers from the importing file's directory, so an
 * external `three` is unresolvable from there. The cost is a 1.1 MB bundle built in
 * ~40 ms, which is not a cost.
 */
let cachedBundle = null;
export function buildBundle({ force = false } = {}) {
  if (cachedBundle && !force) return cachedBundle;
  const dir = mkdtempSync(path.join(tmpdir(), 'rg-'));
  const entry = path.join(dir, 'entry.ts');
  writeFileSync(entry, [
    `export { createCharacter } from ${JSON.stringify(path.join(REPO, 'src/characters/registry'))};`,
    `export { ChibiRig, FOOT_WIDTH_RATIO } from ${JSON.stringify(path.join(REPO, 'src/characters/rig'))};`,
    `export { bodyType } from ${JSON.stringify(path.join(REPO, 'src/characters/bodies'))};`,
    `export { CHARACTER_HEIGHT } from ${JSON.stringify(path.join(REPO, 'src/units'))};`,
    `export * as THREE from 'three';`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(REPO, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}`);
  // ⚠️ `--alias:three` is load-bearing. The entry file lives in the OS temp dir and
  // esbuild resolves bare specifiers from the IMPORTER's directory, so `three` — which
  // this entry re-exports so callers get the SAME instance the rig uses, not a second
  // copy with its own `Vector3` — is unresolvable without it. The failure is
  // `Could not resolve "three"` and it reads like a missing dependency rather than a
  // path problem.
  try {
    execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
      `--alias:three=${path.join(REPO, 'node_modules/three')}`,
      `--outfile=${out}`, '--log-level=error'], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
  } catch {
    throw new Error('esbuild failed — see the error above');
  }
  cachedBundle = out;
  return out;
}

/**
 * Load the bundle. `--force` busts node's ESM cache with a query string, which is the
 * only way to re-import after an edit inside one process (used by the A/B mode).
 */
export async function loadCast({ force = false } = {}) {
  const out = buildBundle({ force });
  const url = 'file://' + out + (force ? `?v=${Date.now()}` : '');
  return import(url);
}

/**
 * ⚠️ Character constructors log warnings to stderr (`[appendages] no mass at ...`).
 * That is real information about the tree but it is 40 lines of noise per sweep, so
 * it is captured rather than suppressed — a tool that HIDES a warning is worse than
 * one that prints it.
 */
export function captureWarnings(fn) {
  const warns = [];
  const orig = console.warn;
  const origLog = console.log;
  console.warn = (...a) => warns.push(a.join(' '));
  console.log = (...a) => { const s = a.join(' '); if (s.startsWith('[')) warns.push(s); else origLog(...a); };
  try { return { value: fn(), warns }; } finally { console.warn = orig; console.log = origLog; }
}

/** Absolute-path writer that creates the directory. */
export function writeOut(p, data) {
  const abs = path.isAbsolute(p) ? p : path.join(REPO, p);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return abs;
}

export const argv = process.argv;
export const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
export const flag = (k) => argv.includes(k);
export const num = (k, d) => Number(arg(k, d));
export const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
