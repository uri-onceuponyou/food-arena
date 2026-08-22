#!/usr/bin/env node
/**
 * WT_PROBE — the claims the puddle shader makes about itself, asserted.
 *
 * `src/arena/hazards.ts` pins `customProgramCacheKey` to a CONSTANT so both pools
 * share one compiled program, and the comment there says the promise is kept "by
 * construction: both patches are pure module-level string transforms with no per-kind
 * branching — everything that differs between grease and water is a UNIFORM."
 *
 * 🚨 `CLAUDE.md` #6 / `docs/AGENT-BRIEF.md` §4.4: an exemption that is not asserted to
 * be doing something is indistinguishable from a comment. So the promise is checked:
 *
 *   §A  STATIC. The two patch functions take only `src` and mention no kind token, and
 *       `PUDDLE_PROGRAM_KEY` is a string literal. MOVES/HOLDS against a PLANTED source
 *       carrying a `#define` branch — the exact bug a pinned key hides — so the arm is
 *       shown to go red before it is believed green.
 *   §B  LIVE. Both pools are in the scene, both carry the patched material, exactly
 *       ONE program in `renderer.info.programs` has the pinned key, and the two
 *       materials' uniforms are DIFFERENT OBJECTS with DIFFERENT values. That last
 *       pair is the whole claim: shared program, per-material uniforms. If three ever
 *       stops giving `materialProperties.uniforms` per material, this goes red.
 *   §C  DRAW COUNT. The pool's mesh count is unchanged from the circle version — the
 *       geometry got 3x the vertices and the same four drawables. Asserted against the
 *       count, not against a memory of it.
 *
 * ⚠️ §B needs a browser; §A does not. `--selftest` runs §A alone, which is why the
 * planted known-bad lives there: `--selftest` validates LOGIC, never where a tool is
 * POINTED, and §A is the only arm whose logic can be wrong without a page.
 *
 *   node tools/tmp/wt_probe.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/wt_probe.mjs --url '{URL}'
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

/** Kind tokens that, if they appeared inside a patch function, would make the two
 * pools' shader SOURCE differ while the pinned cache key says it cannot. */
const KIND_TOKENS = ['isGrease', 'grease', 'water', '#define', 'defines'];

/**
 * §D — THE OUTLINE TABLE IN THE SOURCE, RE-DERIVED FROM THE SOURCE.
 *
 * `hazards.ts` publishes min r / max r / area / cv per kind in a comment and every one
 * of those is a COUNT, which in this repo goes stale at roughly coin-flip rate. This
 * re-runs `puddleProfile`'s exact arithmetic on the lobes and seeds parsed out of the
 * file and compares against the table parsed out of the same file, so the doc cannot
 * drift from the code without going red.
 */
export function profileStats(seed, lobes, segments) {
  let s = seed;
  const rand = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const phase = lobes.map(() => rand() * Math.PI * 2);
  const r = [];
  for (let i = 0; i < segments; i++) {
    const th = (i / segments) * Math.PI * 2;
    let v = 1;
    for (let k = 0; k < lobes.length; k++) v += lobes[k][1] * Math.sin(lobes[k][0] * th + phase[k]);
    r.push(v);
  }
  let sq = 0;
  for (const v of r) sq += v * v;
  const k = Math.sqrt(segments / sq);
  const p = r.map((v) => v * k);
  const mean = p.reduce((a, b) => a + b, 0) / p.length;
  let A = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    const t1 = (i / p.length) * Math.PI * 2, t2 = (j / p.length) * Math.PI * 2;
    A += p[i] * Math.cos(t1) * p[j] * Math.sin(t2) - p[j] * Math.cos(t2) * p[i] * Math.sin(t1);
  }
  A = Math.abs(A) / 2;
  const sd = Math.sqrt(p.reduce((a, b) => a + (b - mean) ** 2, 0) / p.length);
  return { min: Math.min(...p), max: Math.max(...p), area: A / Math.PI, cv: sd / mean };
}

export function readProfileConstants(src) {
  const seg = Number(src.match(/const PUDDLE_SEGMENTS = (\d+)/)?.[1] ?? NaN);
  const grab = (name) => {
    const m = src.match(new RegExp(`const ${name}: Lobes = \\[([^\\]]*\\][^;]*)`));
    if (!m) return null;
    const pairs = [...m[0].matchAll(/\[\s*(\d+)\s*,\s*([\d.]+)\s*\]/g)].map((x) => [Number(x[1]), Number(x[2])]);
    return pairs.length ? pairs : null;
  };
  const seeds = src.match(/puddleProfile\(isGrease \? (\d+) : (\d+),/);
  // The documented table: `//     water    0.803    1.143        0.9991              0.1025`
  const row = (kind) => {
    const m = src.match(new RegExp(`//\\s+${kind}\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`));
    return m ? { min: +m[1], max: +m[2], area: +m[3], cv: +m[4] } : null;
  };
  return {
    segments: seg,
    water: grab('WATER_LOBES'), grease: grab('GREASE_LOBES'),
    greaseSeed: seeds ? Number(seeds[1]) : null,
    waterSeed: seeds ? Number(seeds[2]) : null,
    doc: { water: row('water'), grease: row('grease') },
  };
}

export function auditPatches(src) {
  const out = { faults: [], checked: 0 };
  // FOUR patch functions, not two. The BODY pair landed in round 2 (depth-driven alpha
  // and albedo) under its own pinned key, and a pinned key is a PROMISE that the two
  // pools compile the same source — a promise nothing checked until it was listed here.
  for (const name of ['patchPuddleVertex', 'patchPuddleFragment', 'patchPuddleBodyVertex', 'patchPuddleBodyFragment']) {
    const at = src.indexOf(`function ${name}(`);
    if (at < 0) { out.faults.push(`${name}: not found`); continue; }
    // Body = from the opening brace to the matching close, by brace depth.
    const open = src.indexOf('{', at);
    let depth = 0, end = -1;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) { out.faults.push(`${name}: unbalanced braces`); continue; }
    const body = src.slice(open, end + 1);
    const sig = src.slice(at, open);
    out.checked++;
    // The signature may take exactly one parameter and it must be the source string.
    if (!/\(\s*src\s*:\s*string\s*\)/.test(sig)) out.faults.push(`${name}: signature is not (src: string) — it can branch on something`);
    // Strip comments before scanning: the prose here deliberately says "grease" and
    // "water" constantly, and a scanner that cannot tell prose from code would be a
    // guard nobody could keep green.
    const code = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const tok of KIND_TOKENS) {
      if (code.includes(tok)) out.faults.push(`${name}: mentions "${tok}" in CODE — the two pools' shader source can differ under one pinned key`);
    }
  }
  const key = src.match(/const PUDDLE_PROGRAM_KEY = '([^']+)'/);
  if (!key) out.faults.push('PUDDLE_PROGRAM_KEY: not a plain string literal');
  out.key = key ? key[1] : null;
  const bkey = src.match(/const PUDDLE_BODY_PROGRAM_KEY = '([^']+)'/);
  if (!bkey) out.faults.push('PUDDLE_BODY_PROGRAM_KEY: not a plain string literal');
  out.bodyKey = bkey ? bkey[1] : null;
  return out;
}

function selftest() {
  let fails = 0;
  const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) fails++; };
  const src = readFileSync(`${process.cwd()}/src/arena/hazards.ts`, 'utf8');

  // NON-EMPTY FIRST. A regex that stops matching would otherwise audit nothing and
  // report clean — `[].every()` is true and so is "no faults over zero functions".
  const real = auditPatches(src);
  ok('A0 NON-EMPTY  all four patch functions were actually found', real.checked === 4, `checked=${real.checked}`);
  ok('A1 HOLDS      the shipped source has no kind branching', real.faults.length === 0, real.faults.join(' | '));
  ok('A2           both cache keys are literals', real.key !== null && real.bodyKey !== null, `surf=${real.key} body=${real.bodyKey}`);
  // MOVES on the BODY pair specifically — A3/A4 plant their bug in the surface pair, so
  // without this the two new rows could be listed and never actually exercised.
  const bad3 = src.replace(
    'function patchPuddleBodyFragment(src: string): string {',
    'function patchPuddleBodyFragment(src: string): string {\n  if (src.includes("x")) { const isGrease = 1; void isGrease; }'
  );
  const b3 = auditPatches(bad3);
  ok('A5 MOVES      a planted per-kind branch in the BODY patch is CAUGHT',
    b3.faults.some((f) => f.includes('patchPuddleBodyFragment')), b3.faults[0] ?? '(nothing)');

  // MOVES. Plant the exact bug: a per-kind `#define` inside the fragment patch.
  const bad = src.replace(
    'function patchPuddleFragment(src: string): string {',
    'function patchPuddleFragment(src: string): string {\n  if (src.includes("x")) { const defines = 1; void defines; }'
  );
  const b = auditPatches(bad);
  ok('A3 MOVES      a planted per-kind define is CAUGHT', b.faults.length > 0, b.faults[0] ?? '(nothing)');

  // MOVES, second shape: a second parameter is enough to branch on.
  const bad2 = src.replace('function patchPuddleVertex(src: string): string {', 'function patchPuddleVertex(src: string, isGrease: boolean): string {');
  const b2 = auditPatches(bad2);
  ok('A4 MOVES      a kind PARAMETER is caught', b2.faults.some((f) => f.includes('signature')), b2.faults[0] ?? '(nothing)');

  // §D — the published outline table against the arithmetic that produced it.
  const c = readProfileConstants(src);
  ok('D0 NON-EMPTY  lobes, seeds and the doc table were all parsed',
    c.segments === 96 && !!c.water && !!c.grease && c.waterSeed !== null && !!c.doc.water && !!c.doc.grease,
    `segments=${c.segments} water=${JSON.stringify(c.water)} grease=${JSON.stringify(c.grease)} seeds=${c.greaseSeed}/${c.waterSeed}`);
  if (c.water && c.grease && c.doc.water && c.doc.grease) {
    for (const [kind, lobes, seed] of [['water', c.water, c.waterSeed], ['grease', c.grease, c.greaseSeed]]) {
      const st = profileStats(seed, lobes, c.segments);
      const d = c.doc[kind];
      const near = (a, b, tol) => Math.abs(a - b) <= tol;
      ok(`D1 ${kind.padEnd(6)} the DOCUMENTED min/max/area/cv match the code`,
        near(st.min, d.min, 0.001) && near(st.max, d.max, 0.001) && near(st.area, d.area, 0.001) && near(st.cv, d.cv, 0.001),
        `code ${st.min.toFixed(4)}/${st.max.toFixed(4)}/${st.area.toFixed(4)}/${st.cv.toFixed(4)}  doc ${d.min}/${d.max}/${d.area}/${d.cv}`);
    }
    // MOVES: nudge one amplitude and the table must go red. Without this arm a regex
    // that stopped matching would pass D1 by comparing nothing to nothing.
    const bumped = c.water.map(([k, a], i) => (i === 0 ? [k, a + 0.05] : [k, a]));
    const st2 = profileStats(c.waterSeed, bumped, c.segments);
    ok('D2 MOVES     a changed amplitude moves the derived table',
      Math.abs(st2.cv - c.doc.water.cv) > 0.001, `cv ${st2.cv.toFixed(4)} vs doc ${c.doc.water.cv}`);
    // HOLDS: grease must stay the ROUNDER of the two, which is the substance read.
    const w = profileStats(c.waterSeed, c.water, c.segments);
    const g = profileStats(c.greaseSeed, c.grease, c.segments);
    ok('D3 HOLDS     grease is rounder than water', g.cv < w.cv, `grease cv ${g.cv.toFixed(4)} < water cv ${w.cv.toFixed(4)} (ratio ${(w.cv / g.cv).toFixed(2)}x)`);
    // HOLDS: the area constraint is the whole reason the hazard still reads its size.
    ok('D4 HOLDS     both outlines preserve the circle\'s area to 0.1%',
      Math.abs(w.area - 1) < 0.001 && Math.abs(g.area - 1) < 0.001, `water ${w.area.toFixed(4)} grease ${g.area.toFixed(4)}`);
  }

  console.log(fails === 0 ? '\nwt_probe selftest: ALL PASS' : `\nwt_probe selftest: ${fails} FAIL`);
  return fails;
}

const isMain = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  if (has('selftest')) process.exit(selftest());

  const BASE = (arg('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('wt_probe: need --url or PREVIEW_BASE'); process.exit(2); }
  let fails = selftest();

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  // ⚠️ `view=overview` is load-bearing, not a nicety. The default arena framing is
  // 578 wu of ground about the map centre and the pools sit 559 wu out, so BOTH are
  // frustum-culled — their material never compiles and §B1 reads "0 programs carry the
  // pinned key", which looks exactly like the pin not working. Found by running it.
  await page.goto(`${BASE}/preview.html?piece=arena&view=overview&chars=0&t=4`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });

  const live = await page.evaluate(() => {
    const s = window.__stage;
    const surfs = [];
    const pools = [];
    s.scene.traverse((o) => {
      if (/^puddle_(grease|water)_surface/.test(o.name)) surfs.push(o);
      if (o.name === 'puddle' || o.name === 'puddle_wet_rim' || /^puddle_/.test(o.name)) pools.push(o.name);
    });
    const progs = Array.from(s.renderer.info.programs ?? []).map((p) => p.cacheKey ?? '');
    return {
      surfCount: surfs.length,
      matNames: surfs.map((m) => m.material.name),
      sky: surfs.map((m) => {
        // Uniform values live on the material's compiled program properties; the
        // authored objects are the ones the closure wrote into `shader.uniforms`.
        const props = s.renderer.properties.get(m.material);
        const u = props && props.uniforms ? props.uniforms.uPSky : null;
        return u ? [+u.value.r.toFixed(5), +u.value.g.toFixed(5), +u.value.b.toFixed(5)] : null;
      }),
      sameUniformObject: (() => {
        if (surfs.length < 2) return null;
        const a = s.renderer.properties.get(surfs[0].material);
        const b = s.renderer.properties.get(surfs[1].material);
        return !!(a?.uniforms && b?.uniforms && a.uniforms.uPSky === b.uniforms.uPSky);
      })(),
      puddleProgs: progs.filter((k) => k.includes('fa_puddle_surface_v1')).length,
      bodyProgs: progs.filter((k) => k.includes('fa_puddle_body_v1')).length,
      bodyUniform: (() => {
        // The BODY discs, by name — `mesh()` names them `puddle`.
        const bodies = [];
        s.scene.traverse((o) => { if (o.name === 'puddle' && o.material) bodies.push(o); });
        return bodies.map((o) => {
          const props = s.renderer.properties.get(o.material);
          const u = props && props.uniforms ? props.uniforms.uBDepth : null;
          return u ? [+u.value.x.toFixed(4), +u.value.y.toFixed(4)] : null;
        });
      })(),
      totalProgs: progs.length,
      sampleKeys: progs.slice(0, 2).map((k) => String(k).slice(0, 120)),
      hasShoreAttr: surfs.map((m) => !!m.geometry.getAttribute('aShore')),
      vertsPerSurf: surfs.map((m) => m.geometry.getAttribute('position').count),
      poolMeshNames: pools,
    };
  });

  const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) fails++; };
  ok('B0 NON-EMPTY  both pools are in the scene', live.surfCount === 2, `found ${live.surfCount}: ${live.matNames.join(', ')}`);
  ok('B1           exactly ONE program carries the pinned key', live.puddleProgs === 1, `${live.puddleProgs} of ${live.totalProgs} programs | sample: ${JSON.stringify(live.sampleKeys)}`);
  ok('B2           the two materials hold DIFFERENT uniform objects', live.sameUniformObject === false, `shared=${live.sameUniformObject}`);
  ok('B3           ...with different values (grease is not water)',
    JSON.stringify(live.sky[0]) !== JSON.stringify(live.sky[1]), `uPSky ${JSON.stringify(live.sky)}`);
  ok('B4           both surfaces carry the aShore attribute', live.hasShoreAttr.every(Boolean) && live.hasShoreAttr.length === 2, JSON.stringify(live.hasShoreAttr));
  // 🚨 B5/B6 EXIST BECAUSE "IT IS THERE AND INVISIBLE" IS TRUE TWENTY TIMES IN THIS
  // REPO, and a shader that never LINKS is the sharpest version of it: the round-2
  // depth patch could have been dropped by `Material.clone()` and every render would
  // still have changed, because three other things moved in the same commit. These
  // read the compiled program list and the material's own uniform block.
  ok('B5           exactly ONE program carries the BODY key — the depth patch LINKED',
    live.bodyProgs === 1, `${live.bodyProgs} of ${live.totalProgs}`);
  ok('B6 NON-EMPTY  both bodies hold a uBDepth, and the two kinds DIFFER',
    live.bodyUniform.length === 2 && live.bodyUniform.every((v) => v !== null)
    && JSON.stringify(live.bodyUniform[0]) !== JSON.stringify(live.bodyUniform[1]),
    `uBDepth.xy ${JSON.stringify(live.bodyUniform)}`);
  ok('C1           97 vertices per surface (96 outline + centre)', live.vertsPerSurf.every((v) => v === 97), JSON.stringify(live.vertsPerSurf));
  console.log(`     pool drawables by name: ${live.poolMeshNames.join(', ')}`);

  await browser.close();
  console.log(fails === 0 ? '\nwt_probe: ALL PASS' : `\nwt_probe: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}
