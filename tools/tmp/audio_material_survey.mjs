#!/usr/bin/env node
/**
 * MATERIAL SURVEY — which weapons have a voice of their own, and how much voice it is.
 *
 * Written for the next audio pass, not for this one. Uri's first ear-judgement of the
 * pillar was *"it still seems flat, one tone maybe two, monotonic — I would expect a
 * splash sound when I throw a tomato and it hits"*, and the two structural questions
 * that report raises are answerable mechanically:
 *
 *   1. **Which weapons fall through to the generic `impact()` / `castRanged()`?** Every
 *      one that does sounds like every other one that does. `--mode dispatch` already
 *      asserts that bespoke and generic DIVERGE, which proves the registry works and
 *      says nothing about how many weapons are in it.
 *   2. **How many layers does each bespoke voice actually have, and is any of them
 *      NOISE?** A splat is filtered noise with a fast transient and a wet tail. A voice
 *      built from oscillators alone structurally cannot be wet, however many partials
 *      it has — so "oscillators: 6, noise sources: 0" is a complete diagnosis without
 *      anyone listening to it.
 *
 * Counted by wrapping `ctx.create*` on a real `OfflineAudioContext` and running the real
 * hook through the real engine, so this is what the shipped code builds and not what its
 * source appears to say. The engine's own master chain is built first and subtracted, so
 * the per-voice numbers are the voice.
 *
 *   node tools/tmp/audio_material_survey.mjs
 *   node tools/tmp/audio_material_survey.mjs --base http://localhost:5173
 */

import { chromium } from 'playwright';

const args = process.argv;
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = get('--base', 'http://localhost:5173');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
// Peers are editing this repo live; a save fires an HMR reload that wipes in-page state.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
}));
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

const rows = await page.evaluate(async () => {
  const audio = await import('/src/audio/index.ts');
  const sounds = await import('/src/audio/sounds.ts');
  const weapons = await import('/src/audio/weapons/index.ts');
  const rules = await import('/src/game/rules.ts');

  const KINDS = ['createOscillator', 'createBufferSource', 'createBiquadFilter', 'createGain',
                 'createWaveShaper', 'createConvolver', 'createStereoPanner', 'createDelay'];

  /** Build one sound on a wrapped context and count what it made. */
  async function census(makeSound) {
    const sr = 44100;
    const ctx = new OfflineAudioContext(1, Math.ceil(sr * 1.2), sr);
    const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
    for (const k of KINDS) {
      const orig = ctx[k].bind(ctx);
      ctx[k] = (...a) => { counts[k]++; return orig(...a); };
    }
    // The engine builds the shared master chain in its constructor; whatever it makes
    // there is per-CONTEXT and must not be billed to the voice.
    const engine = new audio.AudioEngine({ context: ctx, persist: false });
    const overhead = { ...counts };
    engine.play(makeSound, { seed: 1234567 });
    const out = {};
    for (const k of KINDS) out[k] = counts[k] - overhead[k];
    return out;
  }

  const out = [];
  for (const [id, def] of Object.entries(rules.CHARACTERS)) {
    for (const w of def.weapons) {
      const sfx = weapons.getWeaponSfx(id, w.key);
      for (const hook of ['cast', 'impact']) {
        const bespoke = !!(sfx && sfx[hook]);
        let fn;
        if (bespoke) {
          fn = (s) => sfx[hook]({ ...s, color: w.color, damage: w.damage ?? 10, weapon: w, characterId: id });
        } else if (hook === 'cast') {
          // Exactly what `director.ts` -> `playCast` falls through to.
          fn = w.giantSlam ? sounds.castGiantSlam()
            : w.type === 'melee' ? sounds.castMelee(w.damage ?? 10, w.coneDeg ?? 60)
            : w.type === 'self' ? sounds.castSelf()
            : sounds.castRanged(w.damage ?? 10);
        } else {
          fn = sounds.impact(w.damage ?? 10);
        }
        const c = await census(fn);
        out.push({
          id, key: w.key, name: w.name, type: w.type, damage: w.damage ?? 0,
          giantSlam: !!w.giantSlam, hook, bespoke,
          osc: c.createOscillator, noise: c.createBufferSource,
          filt: c.createBiquadFilter, gain: c.createGain,
          shaper: c.createWaveShaper, conv: c.createConvolver,
        });
      }
    }
  }
  return out;
});

await browser.close();

const weaponsSeen = new Set(rows.map((r) => `${r.id}.${r.key}`));
const impacts = rows.filter((r) => r.hook === 'impact');
const casts = rows.filter((r) => r.hook === 'cast');
const genericImpacts = impacts.filter((r) => !r.bespoke);
const genericCasts = casts.filter((r) => !r.bespoke);

console.log(`${weaponsSeen.size} weapons across ${new Set(rows.map((r) => r.id)).size} characters\n`);
console.log('  character.weapon              type    dmg  hook    voice     osc  noise  filt  shaper');
console.log('  ' + '-'.repeat(86));
for (const r of rows) {
  console.log(
    `  ${(r.id + '.' + r.key).padEnd(28)} ${String(r.type).padEnd(7)} ${String(r.damage).padStart(3)}  ` +
    `${r.hook.padEnd(7)} ${(r.bespoke ? 'bespoke' : 'GENERIC').padEnd(9)} ` +
    `${String(r.osc).padStart(3)} ${String(r.noise).padStart(6)} ${String(r.filt).padStart(5)} ${String(r.shaper).padStart(7)}`,
  );
}

console.log('');
console.log(`IMPACTS: ${impacts.length - genericImpacts.length}/${impacts.length} bespoke, ` +
  `${genericImpacts.length} fall through to the ONE generic impact()`);
if (genericImpacts.length) {
  console.log(`  generic impacts: ${genericImpacts.map((r) => `${r.id}.${r.key}`).join(', ')}`);
}
console.log(`CASTS:   ${casts.length - genericCasts.length}/${casts.length} bespoke, ` +
  `${genericCasts.length} fall through to castRanged/castMelee/castSelf`);
if (genericCasts.length) {
  console.log(`  generic casts:   ${genericCasts.map((r) => `${r.id}.${r.key}`).join(', ')}`);
}

const noNoise = rows.filter((r) => r.bespoke && r.noise === 0);
const noOsc = rows.filter((r) => r.bespoke && r.osc === 0);
console.log('');
console.log(`BESPOKE VOICES WITH NO NOISE SOURCE AT ALL (${noNoise.length}) — a wet/gritty ` +
  `material is not reachable from oscillators alone:`);
for (const r of noNoise) console.log(`  ${r.id}.${r.key}.${r.hook}  osc=${r.osc} filt=${r.filt}`);
console.log('');
console.log(`BESPOKE VOICES THAT ARE PURE NOISE (${noOsc.length}) — no pitched component:`);
for (const r of noOsc) console.log(`  ${r.id}.${r.key}.${r.hook}  noise=${r.noise} filt=${r.filt}`);

const b = rows.filter((r) => r.bespoke);
const mean = (xs) => (xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length)).toFixed(1);
console.log('');
console.log(`layer means — bespoke: osc ${mean(b.map((r) => r.osc))}, noise ${mean(b.map((r) => r.noise))}, ` +
  `filt ${mean(b.map((r) => r.filt))}`);
const g = rows.filter((r) => !r.bespoke);
console.log(`              generic: osc ${mean(g.map((r) => r.osc))}, noise ${mean(g.map((r) => r.noise))}, ` +
  `filt ${mean(g.map((r) => r.filt))}`);
