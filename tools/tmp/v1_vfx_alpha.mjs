#!/usr/bin/env node
/**
 * V1_VFX_ALPHA — does every TRANSLUCENT effect preserve the destination alpha?
 * (Graphics campaign V1. The census half of `src/render/roles.ts:preserveDestinationAlpha`.)
 *
 * R1's fighter contour (`src/render/contour.ts`) reads a tag that every opaque CHARACTER
 * fragment writes into destination alpha (0 in a match; the world is 1). A translucent effect
 * drawn over a fighter with three's Normal/Additive blend writes its own alpha into that
 * channel, so the fighter under a splash, a status glow or a swing reads as partly world and
 * the contour thins or vanishes there. `roles.ts` exports the remedy for the VFX owner; this
 * checks it is applied to EVERYTHING the VFX layer draws, not to the effects someone
 * remembered.
 *
 * Method: boot a match, fire EVERY `__vfxSpawnTest` kind and `weaponFired` + `impact` for
 * EVERY weapon of EVERY character (enumerated from the served `rules.ts`, not a typed list),
 * force the status visuals on, let the sim-owned pools sync, then walk `vfx_layer` and every
 * material on it. A material is a VIOLATION if it is `transparent` and its alpha factors are
 * not (ZERO, ONE) — i.e. its draw can change the tag.
 *
 * Asserted: the walked set is NON-EMPTY and contains translucent materials (else the census
 * measured nothing — `[].every()` is true); violations = 0. Known-bad: `d1b2621`, where no VFX
 * material called it.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/v1_vfx_alpha.mjs --url '{URL}'
 */
import { chromium } from 'playwright';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]; if (!a.startsWith('--')) continue;
  const nx = process.argv[i + 1]; if (nx === undefined || nx.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = nx; i++; }
}
const BASE = args.url ?? process.env.PREVIEW_BASE;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.goto(`${BASE}/?screen=match&pointerLock=0&fogRadius=1700&fighters=${encodeURIComponent('donut@1530,1000;taco@1575,922;hamburger@1665,922;lollipop@1710,1000;waterbottle@1665,1078;sushi@1575,1078')}&items=blue_cheese`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  const res = await page.evaluate(async () => {
    const { CHARACTERS } = await import('/src/game/rules.ts');
    const L = window.__vfxLayer; const fire = window.__vfxSpawnTest;
    const kinds = ['cast', 'meleeArc', 'impact', 'death', 'heal', 'giantSlam', 'puddleSplash', 'coverScuff', 'castTelegraph'];
    let fired = 0;
    for (const k of kinds) { try { fire(k, 1600, 1000, 12, '#E63946'); fired++; } catch (e) { /* counted below */ } }
    for (const [who, def] of Object.entries(CHARACTERS)) {
      for (const w of def.weapons) {
        try { fire('weaponFired', 1600, 1000, 10, w.color, who, w.key, 900); fired++; } catch (e) { /* skip */ }
        try { fire('impact', 1620, 1010, 10, w.color, who, w.key); fired++; } catch (e) { /* skip */ }
      }
    }
    // Status visuals + sim pools: force a slow and a stun and let a few frames sync.
    const orig = L.sync.bind(L);
    L.sync = (s) => { for (const f of s.fighters) { f.status.slowedUntil = s.elapsed + 1500; f.status.stunnedUntil = s.elapsed + 1500; } window.__st = s; return orig(s); };
    await new Promise((r) => setTimeout(r, 2500));
    L.updateEffects(0.016);
    const mats = new Map();
    L.group.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) if (!mats.has(m)) mats.set(m, o.name || o.type);
    });
    const all = [...mats.keys()];
    const translucent = all.filter((m) => m.transparent);
    const bad = translucent.filter((m) => !(m.blending === 5 /* CustomBlending */ && m.blendSrcAlpha === 200 /* ZeroFactor */ && m.blendDstAlpha === 201 /* OneFactor */));
    const byName = {};
    for (const m of bad) { const k = `${mats.get(m)}|${m.type}|blend${m.blending}`; byName[k] = (byName[k] ?? 0) + 1; }
    return { fired, objects: L.group.children.length, materials: all.length, translucent: translucent.length, violations: bad.length, examples: Object.entries(byName).slice(0, 12) };
  });
  console.log(JSON.stringify(res, null, 1));
  const check = (name, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${d ? `  (${d})` : ''}`); if (!ok) failed = true; };
  check('effects were fired (fixture)', res.fired > 40, String(res.fired));
  check('the census is NON-EMPTY: translucent VFX materials exist', res.translucent > 0, String(res.translucent));
  check('every translucent VFX material preserves destination alpha', res.violations === 0, `${res.violations} of ${res.translucent}`);
} finally { await browser.close(); }
process.exitCode = failed ? 1 : 0;
