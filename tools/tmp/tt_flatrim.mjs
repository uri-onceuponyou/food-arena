#!/usr/bin/env node
/**
 * TT_FLATRIM — `toonMat({ flatShading: true })` must LINK and must DELIVER PIXELS.
 *
 * ── The defect this file exists for ─────────────────────────────────────────────
 * `applyRimLight` injects a Fresnel term that reads `vNormal`. three declares that
 * varying inside `#ifndef FLAT_SHADED` (`three/src/renderers/shaders/ShaderChunk/
 * normal_pars_fragment.glsl.js`), so with `flatShading: true` the fragment shader
 * references an undeclared identifier, the program never links, and **the mesh draws
 * nothing**:
 *
 *     THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false
 *     ERROR: 0:NNNN: 'vNormal' : undeclared identifier
 *
 * `src/arena/floor.ts`'s chip layer shipped that for three tuning rounds and nobody
 * saw it, because **the shadow-depth program carries no rim patch**: it linked fine and
 * kept drawing every chip's contact shadow, so the floor rendered a convincing field of
 * dark specks made entirely of the shadows of invisible geometry. `docs/LESSONS.md` §1,
 * twentieth instance.
 *
 * `ar_chipcheck.mjs` guards the CHIP LAYER — one caller, by mesh name. This file guards
 * the FACTORY, which is where the trap actually lives: `toonMat` accepts `flatShading`
 * and applies the rim by default, so the combination was reachable and silent for every
 * future caller. Nothing in `src/` passes `flatShading: true` today, which is exactly why
 * a regression here would be invisible again.
 *
 * ── The checks, and the input each was proven to REFUSE ─────────────────────────
 * Every positive check below is paired with a control that must fail the other way, so
 * the suite cannot pass by being blind (`CLAUDE.md` #6, `docs/LESSONS.md` §13).
 *
 *   HARNESS   the page's `three` is the SAME module instance `toon.ts` imported, and an
 *             empty frame really is empty. Without this, "0% coverage" could mean "two
 *             copies of three" or "the camera is pointing at nothing".
 *   SMOOTH    `toonMat({})` links and covers the frame — the baseline that says the rig
 *             renders at all.
 *   FLAT      `toonMat({ flatShading: true })` links, and covers the frame within a
 *             whisker of SMOOTH. **This is the assertion that fails on the bug.**
 *   FACETS    FLAT and SMOOTH are DIFFERENT images. Without this the whole suite would
 *             pass if someone "fixed" the bug by dropping `flatShading` on the floor —
 *             a tautology, since a smooth material was never broken.
 *   RIM-LIVE  driving FLAT's own `rimStrength` uniform 0 -> 3 MOVES the frame and lifts
 *             its edges. A fallback normal that resolved to zero would link, render, and
 *             be a rim in name only.
 *   ATTRIB    `toonMat({ flatShading: true, rim: false })` links. Isolates the failure to
 *             the rim patch rather than to `flatShading` or to this harness.
 *   KNOWN-BAD the PRE-FIX rim source (raw `normalize(vNormal)`, reproduced verbatim
 *             below) on a flat material must FAIL to link AND deliver ~zero pixels — and
 *             the same pre-fix source on a SMOOTH material must be fine. Two directions,
 *             so "any injected shader breaks" cannot masquerade as detection.
 *
 * Link failure is read from TWO independent instruments — three's console error text, and
 * `gl.getProgramParameter(LINK_STATUS)` asked of the renderer's own program list. They
 * must agree; a session on this project caught nineteen instruments returning confident
 * wrong answers, and console text is the more fragile of the two.
 *
 * Usage:
 *   node tools/tmp/tt_flatrim.mjs --url http://localhost:PORT
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/tt_flatrim.mjs --url {URL}
 *   ... --png shots/tt_flatrim            # also write the frames, to LOOK at them
 *
 * Exits non-zero on any failure.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const URL_BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5190')).replace(/\/$/, '');
const PNG_DIR = arg('png', null);

let pass = 0, fail = 0;
const ck = (n, ok, note = '') => {
  if (ok) { pass++; console.log(`  PASS  ${n}  ${note}`); }
  else { fail++; console.log(`  FAIL  ${n}  ${note}`); }
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => {
  const t = m.text();
  if (/VALIDATE_STATUS|Shader Error|not compiled|undeclared identifier|LINK_STATUS/i.test(t)) {
    consoleErrors.push(t.replace(/\s+/g, ' ').slice(0, 240));
  }
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e).slice(0, 200)));

// An EMPTY page served from the app's own origin. The module graph is then exactly
// `toon.ts` -> `quality.ts` -> `three` and nothing else: no Stage, no preview harness, no
// characters, no arena. Peers editing `src/game/**` or `src/arena/**` cannot reach this
// measurement, and it loads in well under a second.
await page.route('**/__tt_flatrim.html', (r) => r.fulfill({
  status: 200, contentType: 'text/html',
  body: '<!doctype html><meta charset="utf-8"><title>tt_flatrim</title><body style="margin:0;background:#000"></body>',
}));
await page.goto(`${URL_BASE}/__tt_flatrim.html`, { waitUntil: 'domcontentloaded', timeout: 90_000 });

// ─────────────────────────────────────────────────────────────────────────────────
// Build the rig, in one evaluate, and return every measurement at once.
// ─────────────────────────────────────────────────────────────────────────────────
const R = await page.evaluate(async () => {
  const toon = await import('/src/render/toon.ts');

  // Resolve the SAME three module instance `toon.ts` imported. Vite rewrites its bare
  // `import * as THREE from 'three'` to an optimised-dep URL with a `?v=` hash; guessing
  // that URL (or importing `/node_modules/three/build/three.module.js`) yields a SECOND
  // copy of three, and a scene built from two copies is a measurement of nothing. So the
  // URL is read off the resource timeline — i.e. off what the browser actually fetched —
  // and then PROVEN identical by `instanceof` below.
  const urls = performance.getEntriesByType('resource').map((e) => e.name);
  const threeUrl = urls.find((u) => /\/deps\/three\.js/.test(u))
    ?? urls.find((u) => /three\.module\.js/.test(u))
    ?? urls.find((u) => /\/three(\.js)?\?/.test(u));
  if (!threeUrl) return { fatal: 'could not find three on the resource timeline', urls: urls.slice(0, 40) };
  const THREE = await import(threeUrl);

  const probeMat = toon.toonMat({ color: 0xffffff });
  const sameThree = probeMat instanceof THREE.MeshStandardMaterial;

  // ── The rig ────────────────────────────────────────────────────────────────────
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 1);
  const gl = renderer.getContext();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(1.2, 1.6, 1.0);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

  // A LOW-POLY SPHERE, and the reason is a trap this file walked into first.
  //
  // The obvious subject was `IcosahedronGeometry(r, 0)` — 20 big triangles, obviously
  // faceted. But `PolyhedronGeometry` calls `computeVertexNormals()` when `detail === 0`
  // (`three/src/geometries/PolyhedronGeometry.js:68`), i.e. it ALREADY has one normal per
  // face; `normalizeNormals()`, the spherical branch, only runs for `detail > 0`. So
  // `flatShading` on it is a no-op, `vNormal` is already the face normal, and the
  // FACETS check compared two identical images and could never have failed —
  // measured `share 0.00%, max 1/255`, which is float-LSB noise between two programs.
  // `SphereGeometry` is indexed with genuinely interpolated normals, so it is the only
  // one of the two that puts the `#ifdef FLAT_SHADED` branch under any load at all.
  const geo = new THREE.SphereGeometry(1.15, 14, 9);
  const mesh = new THREE.Mesh(geo, probeMat);
  scene.add(mesh);

  // three reports a failed link through `console.error`. Hooking it HERE rather than
  // reading Playwright's console stream is what makes per-case attribution possible: the
  // count can be sampled synchronously either side of a single render, so "which case
  // produced this error" is answered by construction instead of by timing.
  const errs = [];
  const origErr = console.error;
  console.error = (...a) => { errs.push(a.map(String).join(' ')); origErr.apply(console, a); };

  const buf = new Uint8Array(SIZE * SIZE * 4);
  /** Every frame's raw bytes, kept so pairs can be DIFFED rather than hash-compared. */
  const frames = {};
  /** Render, read the delivered pixels back off the drawing buffer, and describe them. */
  const shoot = (name) => {
    renderer.render(scene, camera);
    gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    if (name) frames[name] = buf.slice();
    let lit = 0, sum = 0, edge = 0;
    // `edge` = pixels in the outer half of the object's bounding disc; the rim lives
    // there, so a rim ablation has to move it far more than it moves the interior.
    const cx = SIZE / 2, cy = SIZE / 2;
    for (let i = 0, p = 0; i < buf.length; i += 4, p++) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      const on = r > 8 || g > 8 || b > 8;
      if (on) {
        lit++;
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const dx = (p % SIZE) - cx, dy = Math.floor(p / SIZE) - cy;
        if (dx * dx + dy * dy > 42 * 42) edge += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
    }
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < buf.length; i += 4) {
      hash = Math.imul(hash ^ buf[i], 16777619) >>> 0;
      hash = Math.imul(hash ^ buf[i + 1], 16777619) >>> 0;
      hash = Math.imul(hash ^ buf[i + 2], 16777619) >>> 0;
    }
    return {
      coverage: lit / (SIZE * SIZE),
      meanLuma: lit ? sum / lit : 0,
      edgeLuma: edge / (SIZE * SIZE),
      hash: hash.toString(16),
      png: canvas.toDataURL('image/png'),
    };
  };

  /**
   * Pixel difference between two named frames.
   *
   * A hash inequality says "these are not the same file"; it does not say whether that is
   * one pixel by 1/255 or the whole image. Every "these differ" claim below is therefore
   * made on `share` (fraction of pixels that moved by more than 1/255) and `mean` (mean
   * absolute channel difference over the whole frame), so an assertion cannot be satisfied
   * by noise.
   */
  const diff = (a, b) => {
    const A = frames[a], B = frames[b];
    if (!A || !B) return null;
    let moved = 0, sum = 0, max = 0;
    for (let i = 0; i < A.length; i += 4) {
      let d = 0;
      for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A[i + k] - B[i + k]));
      sum += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
      if (d > 1) moved++;
      if (d > max) max = d;
    }
    return { share: moved / (A.length / 4), mean: sum / (A.length / 4), max };
  };

  /**
   * How many NEW programs failed to LINK since the last call — asked of GL itself.
   *
   * ⚠️ `renderer.info.programs` is CUMULATIVE and a program's link status never changes,
   * so the raw count is monotonic: the first version of this tool reported `linkFails 1`
   * for every case after the broken one and made two healthy controls read as failures.
   * A per-case DELTA is the only form of this number that attributes anything.
   */
  const seenBad = new Set();
  const newLinkFails = () => {
    let bad = 0;
    for (const p of renderer.info.programs ?? []) {
      if (seenBad.has(p)) continue;
      if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) { seenBad.add(p); bad++; }
    }
    return bad;
  };

  /**
   * `applyRimLight` EXACTLY AS IT SHIPPED BEFORE THE FIX — the known-bad input.
   * Reproduced here rather than imported so this control keeps testing the historical
   * defect after `toon.ts` changes again. If this ever links under `flatShading`, three
   * has started declaring `vNormal` there and the fix in `toon.ts` is dead weight.
   */
  const preFixRim = (mat, color = '#bfe4ff', strength = 0.28) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.rimColor = { value: new THREE.Color(color) };
      shader.uniforms.rimStrength = { value: strength };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
           uniform vec3 rimColor;
           uniform float rimStrength;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
           float rimDot = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
           float rim = pow(rimDot, 2.6) * rimStrength;
           gl_FragColor.rgb += rimColor * rim;`);
    };
    mat.needsUpdate = true;
  };

  const out = { sameThree, threeUrl, cases: {}, png: {} };
  const run = (name, mat, visible = true) => {
    mesh.material = mat;
    mesh.visible = visible;
    const e0 = errs.length;
    const s = shoot(name);
    out.png[name] = s.png;
    delete s.png;
    out.cases[name] = {
      ...s,
      linkFails: newLinkFails(),
      shaderErr: errs.slice(e0).filter((t) => /Shader Error|VALIDATE_STATUS|undeclared identifier|not compiled/i.test(t))
        .map((t) => t.replace(/\s+/g, ' ').slice(0, 200)),
    };
    return out.cases[name];
  };

  // ── NULL: nothing drawn. The floor every "delivered pixels" claim is measured from.
  run('null', probeMat, false);

  // ── The three live cases. Magenta so any delivery is unmistakable.
  const C = 0xff00ff;
  run('smooth', toon.toonMat({ color: C, roughness: 0.5 }));
  const flatMat = toon.toonMat({ color: C, roughness: 0.5, flatShading: true });
  run('flat', flatMat);
  run('flat_norim', toon.toonMat({ color: C, roughness: 0.5, flatShading: true, rim: false }));

  // ── RIM-LIVE: drive the flat material's OWN uniform. `userData.rimUniforms` is the
  //    handle `applyRimLight` records at compile time; if it is absent the patch never
  //    ran, which is itself the answer.
  const u = flatMat.userData?.rimUniforms;
  out.flatRimHandle = !!u;
  if (u) {
    mesh.material = flatMat; mesh.visible = true;
    const was = u.rimStrength.value;
    u.rimStrength.value = 0;   const r0 = shoot('flat_rim0'); out.png.flat_rim0 = r0.png; delete r0.png;
    u.rimStrength.value = 3.0; const r3 = shoot('flat_rim3'); out.png.flat_rim3 = r3.png; delete r3.png;
    u.rimStrength.value = was;
    out.cases.flat_rim0 = r0;
    out.cases.flat_rim3 = r3;
  }

  // ── NEUTRAL: the fix must not move a pixel for any EXISTING caller ──────────────
  //
  // Nothing in `src/` passes `flatShading` (315 `toonMat` call sites, censused), so every
  // one of them takes the `#else` branch — which is `vNormal` verbatim, resolved by the
  // preprocessor. The claim is therefore that each shipped configuration renders
  // BYTE-IDENTICALLY to the pre-fix source, and it is asserted rather than argued: each
  // row builds the same surface twice, once with the live rim and once with the pre-fix
  // rim, in ONE process against ONE frame, so there is no cross-run drift to explain away.
  // The matrix spans the axes `applyRimLight` is actually reached on — glossy/metal,
  // DoubleSide, transparency, emissive, and `glossyMat`'s MeshPhysicalMaterial, which
  // compiles a different shader (`PHYSICAL`, clearcoat) around the same patch.
  const neutral = [
    ['neutral_default',  () => ({ color: C, roughness: 0.5 })],
    ['neutral_glossy',   () => ({ color: C, roughness: 0.12, metalness: 0.45 })],
    ['neutral_double',   () => ({ color: C, roughness: 0.5, doubleSide: true })],
    ['neutral_transp',   () => ({ color: C, roughness: 0.5, transparent: true, opacity: 0.6 })],
    ['neutral_emissive', () => ({ color: C, roughness: 0.5, emissive: 0x224466, emissiveIntensity: 1.5 })],
  ];
  out.neutral = [];
  for (const [name, opts] of neutral) {
    run(`${name}_live`, toon.toonMat({ ...opts() }));
    const pre = toon.toonMat({ ...opts(), rim: false });
    preFixRim(pre);
    run(`${name}_pre`, pre);
    out.neutral.push([name, diff(`${name}_live`, `${name}_pre`)]);
  }
  // `glossyMat` is rim-OPT-IN and returns a MeshPhysicalMaterial.
  run('neutral_physical_live', toon.glossyMat({ color: C, roughness: 0.18, rim: true }));
  const physPre = toon.glossyMat({ color: C, roughness: 0.18 });
  preFixRim(physPre);
  run('neutral_physical_pre', physPre);
  out.neutral.push(['neutral_physical', diff('neutral_physical_live', 'neutral_physical_pre')]);

  // ── KNOWN-BAD, last: a failed link is a real GL error and this ordering keeps it from
  //    colouring any measurement above it.
  const kbFlat = toon.toonMat({ color: C, roughness: 0.5, flatShading: true, rim: false });
  preFixRim(kbFlat);
  run('knownbad_flat', kbFlat);

  out.diffs = {
    facets:      diff('flat', 'smooth'),                    // flat shading must actually happen
    rimIsAdded:  diff('flat', 'flat_rim0'),                 // the rim is a real contribution
    rimOffIsOff: diff('flat_rim0', 'flat_norim'),           // driving it to 0 == never applying it
    rimDrive:    diff('flat_rim3', 'flat_rim0'),            // and it responds to its uniform
    faithful:    diff('neutral_default_pre', 'smooth'),     // the pre-fix source is reproduced exactly
  };
  out.cases.knownbad_smooth = out.cases.neutral_default_pre;
  return out;
});

if (R.fatal) {
  console.log(`  FATAL ${R.fatal}\n${(R.urls ?? []).join('\n')}`);
  await browser.close();
  process.exit(2);
}

const c = R.cases;
const f = (n) => (n ?? 0).toFixed(4);
console.log(`\n  three: ${R.threeUrl}`);
console.log('  case              coverage  meanLuma  edgeLuma  newLinkFails  hash');
for (const [k, v] of Object.entries(c)) {
  console.log(`  ${k.padEnd(16)}  ${f(v.coverage)}    ${(v.meanLuma ?? 0).toFixed(1).padStart(5)}     ${f(v.edgeLuma)}      ${String(v.linkFails ?? '-').padStart(2)}          ${v.hash}`);
}
const D = R.diffs;
const dd = (k) => { const d = D[k]; return d ? `share ${(d.share * 100).toFixed(2)}%  mean ${d.mean.toFixed(3)}/255  max ${d.max}` : 'MISSING'; };
console.log('  pair                                       moved   mean      max');
for (const [k, d] of Object.entries(D)) {
  console.log(`  ${k.padEnd(40)}  ${d ? (d.share * 100).toFixed(2).padStart(6) : '     -'}%  ${d ? d.mean.toFixed(4).padStart(7) : '      -'}  ${d ? String(d.max).padStart(4) : '   -'}`);
}
console.log('');

// ── HARNESS ────────────────────────────────────────────────────────────────────────
ck('HARNESS   page three IS the module toon.ts imported', R.sameThree === true,
  R.sameThree ? 'instanceof MeshStandardMaterial' : 'TWO COPIES OF THREE — every check below is meaningless');
ck('HARNESS   an empty frame is empty', c.null.coverage === 0, `coverage ${f(c.null.coverage)}`);

// ── SMOOTH: the baseline that says the rig renders at all ──────────────────────────
ck('SMOOTH    toonMat({}) covers the frame', c.smooth.coverage > 0.15, `coverage ${f(c.smooth.coverage)}`);

// ── FLAT: the assertion that FAILS on the bug ──────────────────────────────────────
ck('FLAT      toonMat({flatShading:true}) LINKS (GL LINK_STATUS)', c.flat.linkFails === 0,
  `${c.flat.linkFails} new program(s) failed to link`);
ck('FLAT      ... and three reported no shader error for it (second instrument)',
  c.flat.shaderErr.length === 0, c.flat.shaderErr[0] ?? 'console clean');
ck('FLAT      ... and DELIVERS PIXELS, not just a program',
  c.flat.coverage > 0.15 && c.flat.coverage > c.smooth.coverage * 0.8,
  `coverage ${f(c.flat.coverage)} vs smooth ${f(c.smooth.coverage)}`);

// ── FACETS: refuses a "fix" that silently drops flatShading ────────────────────────
// Stated on the DIFF, not on the hash: a hash inequality is satisfied by one pixel moving
// by 1/255, and "flat shading is happening" is a claim about most of the object.
// ⚠️ And it carries `flat` COVERAGE, because on the pre-fix tree this check passed
// VACUOUSLY: a frame with nothing in it is very different from a frame with a sphere in
// it (measured share 62.12%, mean 75.8/255). "Different" only means "faceted" once
// something is known to be there.
ck('FACETS    flat renders, and is a substantially DIFFERENT image from smooth',
  !!D.facets && D.facets.share > 0.10 && D.facets.mean > 1.0 && c.flat.coverage > 0.15,
  `${dd('facets')}  (flat coverage ${f(c.flat.coverage)})`);

// ── RIM-LIVE: a fallback normal that resolves to zero would pass everything above ───
ck('RIM-LIVE  the flat material carries a live rim uniform handle', R.flatRimHandle === true,
  R.flatRimHandle ? 'userData.rimUniforms present' : 'applyRimLight never compiled on it');
if (c.flat_rim0 && c.flat_rim3) {
  ck('RIM-LIVE  rimStrength 0 -> 3 MOVES the frame',
    !!D.rimDrive && D.rimDrive.share > 0.10 && D.rimDrive.mean > 2.0, dd('rimDrive'));
  ck('RIM-LIVE  ... and the extra light lands on the EDGES',
    c.flat_rim3.edgeLuma > c.flat_rim0.edgeLuma * 1.05,
    `edgeLuma ${f(c.flat_rim0.edgeLuma)} -> ${f(c.flat_rim3.edgeLuma)}`);
  // The rim at its SHIPPED strength has to be worth something under FLAT_SHADED too — a
  // fallback normal that only registered when driven to 3.0 would be a rim in name only.
  ck('RIM-LIVE  ... and the shipped 0.28 is already a real contribution',
    !!D.rimIsAdded && D.rimIsAdded.share > 0.05, dd('rimIsAdded'));
  // NULL CONTROL. Driving the uniform to 0 must reproduce `rim: false` EXACTLY. If it
  // does not, the patch is changing something other than the rim — which is the whole
  // claim `applyRimLight` makes about itself, and it has never been tested until now.
  ck('RIM-LIVE  ... and rimStrength 0 is byte-identical to rim:false',
    !!D.rimOffIsOff && D.rimOffIsOff.share === 0 && D.rimOffIsOff.max === 0, dd('rimOffIsOff'));
} else {
  for (const n of ['MOVES the frame', 'lands on the EDGES', '0.28 is a real contribution', '0 == rim:false'])
    ck(`RIM-LIVE  ${n}`, false, 'no uniform handle to drive');
}

// ── ATTRIB: the failure is the RIM's, not flatShading's and not this harness's ──────
ck('ATTRIB    toonMat({flatShading:true, rim:false}) links and renders',
  c.flat_norim.linkFails === 0 && c.flat_norim.coverage > 0.15,
  `linkFails ${c.flat_norim.linkFails}, coverage ${f(c.flat_norim.coverage)}`);

// ── NEUTRAL: byte-identical to the pre-fix source for every EXISTING caller ────────
// ⚠️ Identity alone is a TAUTOLOGY here: two frames that both drew nothing are also
// identical, which is precisely the failure mode this whole file exists for. So each row
// also has to have delivered pixels before its zero means anything.
for (const [name, d] of R.neutral) {
  const cov = c[`${name}_live`]?.coverage ?? 0;
  ck(`NEUTRAL   ${name.replace('neutral_', '').padEnd(9)} renders, and is BYTE-IDENTICAL to the pre-fix rim`,
    !!d && d.share === 0 && d.max === 0 && cov > 0.15,
    d ? `coverage ${f(cov)}  share ${(d.share * 100).toFixed(2)}%  max ${d.max}` : 'MISSING');
}

// ── KNOWN-BAD: the guard must be shown to FAIL on the bug it guards against ────────
ck('KNOWN-BAD pre-fix rim on a SMOOTH material is fine (positive control)',
  c.knownbad_smooth.linkFails === 0 && c.knownbad_smooth.coverage > 0.15,
  `linkFails ${c.knownbad_smooth.linkFails}, coverage ${f(c.knownbad_smooth.coverage)}`);
// FAITHFULNESS. The known-bad input is only worth anything if it really is the code that
// shipped, and the cheapest proof of that is that it paints the SAME PIXELS as the live
// `toonMat` rim wherever the live one still works. This is also the tightest available
// statement of the fix's pixel-neutrality: the `#ifdef FLAT_SHADED` branch must resolve,
// on the non-flat path, to exactly the pre-fix `normalize(vNormal)`.
ck('KNOWN-BAD ... and is BYTE-IDENTICAL to the shipped rim on that material',
  !!D.faithful && D.faithful.share === 0 && D.faithful.max === 0,
  `${dd('faithful')}  (${c.knownbad_smooth.hash} vs shipped ${c.smooth.hash})`);
ck('KNOWN-BAD pre-fix rim + flatShading FAILS to link, and GL says so',
  c.knownbad_flat.linkFails > 0, `${c.knownbad_flat.linkFails} new program(s) failed to link`);
ck('KNOWN-BAD ... and three named `vNormal` on the console (second instrument)',
  c.knownbad_flat.shaderErr.some((e) => /vNormal/i.test(e)),
  c.knownbad_flat.shaderErr[0] ?? 'NOTHING REPORTED — the console instrument is BLIND');
ck('KNOWN-BAD ... and the mesh DRAWS NOTHING — the invisibility the fix is for',
  c.knownbad_flat.coverage < 0.01, `coverage ${f(c.knownbad_flat.coverage)}`);

// Playwright's own console stream, kept as a THIRD, independent view of the same events —
// it is not asserted on (the in-page hook attributes per case and this cannot), but a
// disagreement between "N shader errors seen from Node" and the per-case totals above
// means one of the two instruments is dropping messages, which is worth seeing.
const perCase = Object.values(c).reduce((n, v) => n + (v.shaderErr?.length ?? 0), 0);
console.log(`\n  console (node side): ${consoleErrors.length} shader message(s); in-page, per case: ${perCase}`);

if (PNG_DIR) {
  mkdirSync(PNG_DIR, { recursive: true });
  for (const [k, dataUrl] of Object.entries(R.png)) {
    const p = `${PNG_DIR}/${k}.png`;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
  }
  console.log(`\n  wrote ${Object.keys(R.png).length} frames to ${PNG_DIR}/`);
}

await browser.close();
console.log(`\n  tt_flatrim: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
