#!/usr/bin/env node
/**
 * `cloneToon()` — behavioural test, with the known-bad controls that make it a guard.
 *
 *   node tools/tmp/clonetoon_test.mjs        # 31 assertions
 *
 * ── WHY IT LOOKS LIKE THIS ──────────────────────────────────────────────────
 * `CLAUDE.md` non-negotiable #6: *a guard that has not been shown to FAIL on the bug it
 * guards against is not a guard.* The bug here is that `Material.clone()` does not copy
 * `onBeforeCompile`, so a cloned `toonMat` renders with no Fresnel rim while looking
 * entirely plausible. So this file asserts the **defect** first — a plain `.clone()`
 * MUST come back with no rim — and only then asserts that `cloneToon()` does not. If
 * someone ever "fixes" three so `clone()` carries the patch, control C1 fails loudly
 * rather than this suite silently vouching for nothing.
 *
 * Same shape for the second trap: `Material.copy()` deep-JSON-copies `userData`
 * (`three/src/materials/Material.js:974`), so a plain clone of an already-rendered
 * material carries a DEAD `rimUniforms` corpse — which `haloprobe.mjs`, `matvar.mjs`,
 * `rimcheck.mjs` and `p1_matresp.mjs` would all count as a live rim. C4 asserts the
 * corpse appears under a plain clone; T9 asserts `cloneToon` never produces one.
 *
 * `toon.ts` is bundled through esbuild rather than imported directly: Node's built-in
 * type-stripping cannot resolve this file's extensionless relative import of
 * `./quality`, and three is imported as a bare specifier.
 */

import * as esbuild from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import * as THREE from 'three';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The build lands INSIDE the repo, not in the OS temp dir: `three` is left external so
// the bundle and this file share one module graph, and a bundle sitting in /tmp cannot
// resolve a bare specifier against this project's `node_modules`.
const out = mkdtempSync(join(ROOT, 'tools', 'tmp', '.clonetoon-build-'));
const bundle = join(out, 'toon.mjs');
// `--entry <path>` bundles a MUTANT copy of toon.ts instead of the real one. That is
// how this suite was shown to fail on the bug it guards: three mutations (drop the
// re-apply, keep the dead handle, ignore `rim:false`) each break 3-8 assertions.
const entryArg = process.argv.indexOf('--entry');
await esbuild.build({
  entryPoints: [entryArg > 0 ? process.argv[entryArg + 1] : join(ROOT, 'src', 'render', 'toon.ts')],
  outfile: bundle,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  // three stays external so the bundle and this file share ONE three instance —
  // otherwise `instanceof` and the `isMeshStandardMaterial` flag would be comparing
  // two different module graphs and every type assertion below would be meaningless.
  external: ['three'],
  logLevel: 'silent',
});
writeFileSync(join(out, 'package.json'), '{"type":"module"}');
// ⚠️ `RIM_STRENGTH` IS IMPORTED, NOT RETYPED, AND THAT IS A FIX FOR A REAL FAILURE.
// Three assertions below (C3 / T4 / T15) hard-coded the literal `0.28`, which was the
// shipped default when they were written. `f77a9d7` moved the rim's peak to 1.40 (a
// narrower, brighter Fresnel — the term was measured as a whole-body WASH at 2.6/0.28)
// and all three went red on a change that was working exactly as designed. Old wording
// kept per CLAUDE.md's reversed-assertion rule:
//     `naive.userData.rim.strength === 0.28`
//     `s1.uniforms.rimStrength.value === 0.28`
// What those rows are FOR is "the value the source was built with is the value the
// clone ends up with" — a statement about propagation, not about any particular number.
// Binding to the exported constant says that and cannot go stale. The rows that DO care
// about a specific number are the override rows (T16/T17), which pass their own.
//
// ⚠️ ROUTED, NOT ADDED: the spec now also carries `power`, and `cloneToon` reads it to
// rebuild the term — so a spec that silently stopped carrying it would hand every clone
// the module default instead of the source's. Two rows (`rim.power === RIM_POWER` on the
// plain clone, `s1.uniforms.rimPower.value === RIM_POWER` on the cloneToon) cover that
// and were written and PASSED. They are not here because the count is pinned at **33**
// in `docs/TOOLS.md`'s gate table, `gatecount` compares the two, and that table is
// EXECUTABLE — `docs/AGENT-BRIEF.md` §1 puts it outside the additive release valve. Two
// assertions and one table cell, for whoever owns that file.
const { toonMat, glossyMat, flatMat, cloneToon, applyRimLight, RIM_STRENGTH } = await import(
  pathToFileURL(bundle).href
);
rmSync(out, { recursive: true, force: true });

let pass = 0;
const fails = [];
function ok(name, cond, detail = '') {
  // Thunks are caught, not propagated: a mutant `cloneToon` that returns an unpatched
  // material makes `compile()` return null and the next dereference throw, and a suite
  // that dies on assertion 7 reports nothing about assertions 8-31. It must FAIL, in
  // full, and say which rows.
  let v = cond;
  if (typeof cond === 'function') {
    try { v = cond(); } catch (e) { v = false; detail = detail || `threw: ${e.message}`; }
  }
  if (v) { pass++; return; }
  fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

/** Run a material's `onBeforeCompile` against a stand-in shader and report what it did. */
function compile(mat) {
  const shader = {
    uniforms: {},
    vertexShader: 'void main(){}',
    fragmentShader: '#include <common>\nvoid main(){\n#include <dithering_fragment>\n}',
  };
  if (mat.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) return null;
  mat.onBeforeCompile(shader, null);
  return shader;
}
const patched = (m) => m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile;

// ── KNOWN-BAD CONTROLS: the defect this helper exists for must be VISIBLE here ──
const src = toonMat({ color: '#c04030', roughness: 0.6 });
ok('C0 source carries the rim', patched(src));
const naive = src.clone();
ok('C1 plain .clone() DROPS onBeforeCompile — the bug', !patched(naive),
   'three.clone() now carries the patch; this whole helper may be redundant');
ok('C2 plain .clone() still yields a live-looking material', naive.isMeshStandardMaterial === true);
ok('C3 the rim SPEC survives a plain clone (it is JSON-safe userData)',
   naive.userData.rim && naive.userData.rim.strength === RIM_STRENGTH);
// The corpse: userData is deep-JSON-copied, so a rendered source poisons its clones.
const rendered = toonMat({ color: '#405060' });
const liveShader = compile(rendered);
ok('C4a source publishes rimUniforms at first compile', !!rendered.userData.rimUniforms);
const corpse = rendered.clone();
ok('C4b plain .clone() carries a DEAD rimUniforms corpse — the second bug',
   !!corpse.userData.rimUniforms && corpse.userData.rimUniforms !== liveShader.uniforms);

// ── T: cloneToon ───────────────────────────────────────────────────────────────
const c1 = cloneToon(src);
ok('T1 cloneToon re-applies the rim', patched(c1));
const s1 = compile(c1);
ok('T2 clone emits the Fresnel GLSL',
   () => s1.fragmentShader.includes('gl_FragColor.rgb += rimColor * rim'));
ok('T3 clone declares the uniforms it uses',
   () => s1.fragmentShader.includes('uniform float rimStrength') && s1.fragmentShader.includes('uniform vec3 rimColor'));
ok('T4 inherited strength is the source\'s', () => s1.uniforms.rimStrength.value === RIM_STRENGTH);
ok('T5 inherited colour round-trips exactly', () => s1.uniforms.rimColor.value.getHex() === 0xbfe4ff);
ok('T6 clone publishes its OWN rimUniforms handle', () => c1.userData.rimUniforms === s1.uniforms);
ok('T7 clone is a distinct material', c1 !== src && c1.uuid !== src.uuid);
ok('T8 clone carries the source colour', c1.color.getHex() === src.color.getHex() && c1.roughness === 0.6);
const c2 = cloneToon(rendered);
ok('T9 cloneToon NEVER hands on the dead handle', () => c2.userData.rimUniforms === undefined);
ok('T10 …and leaves the source\'s live handle intact',
   rendered.userData.rimUniforms === liveShader.uniforms);

// Declining, and never turning it on silently.
let noRim = null;
try { noRim = cloneToon(src, { rim: false }); } catch { /* T11 reports it */ }
ok('T11 rim:false declines the rim', () => noRim !== null && !patched(noRim));
ok('T12 rim:false also clears the spec, so a clone-of-a-clone stays off',
   () => noRim.userData.rim === undefined && !patched(cloneToon(noRim)));
const bare = toonMat({ color: '#ffffff', rim: false });   // apron.ts:830 does exactly this
ok('T13 a rim-less source records no spec', bare.userData.rim === undefined && !patched(bare));
ok('T14 cloneToon does NOT silently turn the rim on', () => !patched(cloneToon(bare)));
ok('T15 rim:true forces one on at the defaults', () => {
  const f = cloneToon(bare, { rim: true });
  const s = compile(f);
  return !!s && s.uniforms.rimStrength.value === RIM_STRENGTH;
});

// Overrides.
const s3 = compile(cloneToon(src, { rimStrength: 0.5, rimColor: '#ff0000' }));
ok('T16 rimStrength override', () => s3.uniforms.rimStrength.value === 0.5);
ok('T17 rimColor override', () => s3.uniforms.rimColor.value.getHex() === 0xff0000);
ok('T18 rimStrength 0 is honoured, not treated as absent', () => {
  const z = toonMat({ color: '#123456', rimStrength: 0 });
  return compile(cloneToon(z)).uniforms.rimStrength.value === 0;
});

// Zero new GL programs: three keys programs on `onBeforeCompile.toString()`.
ok('T19 clones share ONE program cache key with their source and each other',
   () => src.customProgramCacheKey() === c1.customProgramCacheKey() &&
   c1.customProgramCacheKey() === cloneToon(src, { rimStrength: 0.5 }).customProgramCacheKey() &&
   src.customProgramCacheKey().length > 0);
ok('T20 …and a rim-less material keys DIFFERENTLY, so the key is not a constant',
   bare.customProgramCacheKey() !== src.customProgramCacheKey());

// Textures: copied by REFERENCE, which is what avoids a second GPU upload.
const tex = new THREE.DataTexture(new Uint8Array([1, 2, 3, 4]), 1, 1);
const mapped = toonMat({ color: '#ffffff', map: tex });
ok('T21 the map is shared, not re-uploaded', () => cloneToon(mapped).map === tex);

// Non-standard materials pass straight through; asking for a rim on one is refused.
const basic = flatMat('#00ff00');
let cb = null;
try { cb = cloneToon(basic); } catch { /* T22 reports it */ }
ok('T22 a MeshBasicMaterial clones with no rim and no throw',
   () => cb.isMeshBasicMaterial === true && !patched(cb) && cb.color.getHex() === 0x00ff00);
ok('T23 asking for a rim on a normal-less material throws',
   () => { try { cloneToon(basic, { rim: true }); return false; } catch { return true; } });
// glossyMat's rim is opt-IN (toon.ts records the per-character clipShare run that
// decided that) — inherit must respect both settings.
ok('T24 glossyMat defaults to NO rim, and the clone inherits none',
   () => !patched(glossyMat({ color: '#ff00ff' })) && !patched(cloneToon(glossyMat({ color: '#ff00ff' }))));
ok('T24b glossyMat({ rim: true }) gets one, and the clone carries it', () => {
  const g = glossyMat({ color: '#ff00ff', rim: true, rimStrength: 0.2 });
  return patched(g) && compile(cloneToon(g)).uniforms.rimStrength.value === 0.2;
});
ok('T24c glossyMat({ rim: false }) is explicit and still off',
   () => !patched(glossyMat({ color: '#ff00ff', rim: false })));

// applyRimLight on a physical material is still supported (lead 3's one-liner).
const phys = glossyMat({ color: '#ff00ff' });
applyRimLight(phys, '#00ffff', 0.4);
ok('T25 applyRimLight records its spec on a physical material too',
   () => phys.userData.rim.color === 0x00ffff && phys.userData.rim.strength === 0.4 &&
   compile(cloneToon(phys)).uniforms.rimColor.value.getHex() === 0x00ffff);

for (const f of fails) console.log(`FAIL  ${f}`);
console.log(`${fails.length ? 'FAIL' : 'PASS'}  clonetoon_test: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
