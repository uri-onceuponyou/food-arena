#!/usr/bin/env node
/**
 * lq_shot — LOOK AT THE LIQUID. Soup's three weapon effects, rendered, at the match camera.
 *
 * `CLAUDE.md` rule 3: *"Judge rendered pixels. Read the PNG with the Read tool and actually
 * look at it. Judging a description instead of an image is this project's most common
 * failure."* Every number in this pass says the splash is now the same colour as the bowl.
 * None of them says it LOOKS right, and the two are different claims.
 *
 * ⚠️ **ONLY ONE CAMERA IS AVAILABLE FOR THIS SUBJECT, AND THAT IS A LIMIT, NOT A CHOICE.**
 * Rule 3 asks for both the lobby's pitch 20 (`charStage.ts:451`) and the match's 58
 * (`camera.ts:265`). `preview.html` documents a `piece=vfx` mode — and `preview.ts` answers
 * it with *"piece … not implemented yet"*, so there is no shallow rig for a weapon effect
 * anywhere in this repo. Weapon VFX exist only inside a live match, i.e. only at 58°. What
 * the 58° frame DOES contain is the soup fighter's own bowl alongside its splash, which is
 * the comparison that matters here; the bowl's own shallow-camera read is `c9a2ed0`'s and
 * is not changed by this pass.
 *
 * Fires through `window.__vfxSpawnTest` (`game/vfx.ts`), using `'weaponFired'` rather than
 * a hand-assembled composition, because that runs `spawnWeaponCast` — the exact thing
 * `match.ts` fires for one `weapon-fired` event. A probe that assembles its own composition
 * measures a picture no player ever sees.
 *
 * Usage:
 *   node tools/tmp/lq_shot.mjs --url <base> --root <tree> --tag before --out <dir>
 *
 * `--root` is the TREE being served, and the weapon colour is read out of its own
 * `rules.ts` rather than passed on the command line — a hand-typed colour here would be a
 * sixth copy of the constant this whole pass exists to collapse.
 */

import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const argv = process.argv;
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = (arg('--url', null) ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('lq_shot: no --url and no PREVIEW_BASE (:5173 is banned, rule 2)'); process.exit(2); }
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(arg('--root', resolve(HERE, '../..')));
const TAG = arg('--tag', 'shot');
const OUT = arg('--out', 'tools/tmp/lq_shots');
const W = Number(arg('--w', 1300));
const H = Number(arg('--h', 740));

const rules = await readFile(join(ROOT, 'src/game/rules.ts'), 'utf8');
const weaponColor = (key) => {
  const m = rules.match(new RegExp(`key:\\s*'${key}'[^\\n]*?color:\\s*'(#[0-9A-Fa-f]{6})'`));
  if (!m) throw new Error(`lq_shot: no colour for soup.${key} in ${ROOT}/src/game/rules.ts`);
  return m[1];
};
const SPLASH = weaponColor('Splash');
const DUMP = weaponColor('Dump');
console.log(`lq_shot[${TAG}] root=${ROOT}  Splash ${SPLASH}  Dump ${DUMP}`);

/**
 * Where the fighter stands, DERIVED from `tools/arena-scan.mjs`'s own station table.
 *
 * 🐞 THE FIRST RUN OF THIS TOOL PUT THE FIGHTER AT ARENA CENTRE, WHICH IS INSIDE THE
 * BOILING POT. The camera is player-centred, so the frame came back as one enormous orange
 * pot disc with the character buried behind it and the splash off the edge — and the orange
 * mass a reader would have judged was the ARENA's `PALETTE.broth`, not soup's liquid at all.
 * `arena-scan.mjs` carries the same warning in its own header (*"Centring on the pot once
 * filled the frame with the hazard and depressed several rounds of scores for reasons that
 * were purely framing"*) and its hub stations say, in a comment, *"Never centred on the
 * pot."* Default is now its `west_lane` station: *"primary combat lane"*, open floor.
 *
 * The coordinates are PARSED out of that table rather than retyped. `CLAUDE.md`: a stale
 * map literal is still a LEGAL coordinate — the 1× playfield is exactly the NW quadrant of
 * the ×4 one — so nothing downstream can catch one, and arena-scan's own history has these
 * four stations silently becoming "four MID-NORTH-WEST stations on a map four times the
 * size" while every guard stayed green.
 */
const scan = await readFile(join(ROOT, 'tools/arena-scan.mjs'), 'utf8');
const station = (id) => {
  const m = scan.match(new RegExp(`\\{\\s*id:\\s*'${id}',\\s*x:\\s*(-?[0-9.]+),\\s*y:\\s*(-?[0-9.]+)`));
  if (!m) throw new Error(`lq_shot: station '${id}' not found in ${ROOT}/tools/arena-scan.mjs`);
  return { x: Number(m[1]), y: Number(m[2]) };
};
/** Fog opened past the map's own half-diagonal, DERIVED, so nothing is culled by it. */
const sharedSrc = await readFile(join(ROOT, 'src/arena/shared.ts'), 'utf8');
const sconst = (n) => Number(sharedSrc.match(new RegExp(`export const ${n}\\s*=\\s*(-?[0-9.]+)`))[1]);
const FOG = Math.ceil(Math.hypot(sconst('ARENA_W') / 2, sconst('ARENA_H') / 2));
const ST = station(arg('--station', 'west_lane'));
const CX = Number(arg('--px', ST.x));
const CY = Number(arg('--py', ST.y));
console.log(`lq_shot[${TAG}] station ${arg('--station', 'west_lane')} at ${CX},${CY}`);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
await mkdir(OUT, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    let virt = 0;
    performance.now = () => virt;
    window.__lqclk = { advance(ms) { virt += ms; } };
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,'
      + 'prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;'
      + 'export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  // `px`/`py` put the soup fighter dead centre so the bowl and the effect share one frame.
  await page.goto(`${BASE}/?player=soup&enemy=donut&px=${CX}&py=${CY}&fogRadius=${FOG}&pointerLock=0`,
    { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
  await page.evaluate(async () => {
    for (let i = 0; i < 90; i++) {
      window.__lqclk.advance(16.667);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    const rig = window.__stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
  });

  const shot = async (name) => {
    const p = `${OUT}/${TAG}__${name}.png`;
    await page.locator('canvas').first().screenshot({ path: p, animations: 'disabled' });
    return p;
  };

  const cases = [
    { name: 'splash_cast', fire: ['weaponFired', CX, CY, 3, SPLASH, 'soup', 'Splash'], advanceMs: 100 },
    { name: 'splash_impact', fire: ['impact', CX + 60, CY - 40, 3, SPLASH, 'soup', 'Splash'], advanceMs: 120 },
    { name: 'dump_telegraph', fire: ['castTelegraph', CX, CY, 16, DUMP, 'soup', 'Dump', 1100], advanceMs: 550 },
    { name: 'dump_arc', fire: ['meleeArc', CX, CY, 16, DUMP, 'soup', 'Dump'], advanceMs: 120 },
  ];
  for (const c of cases) {
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(async ([fire, ms]) => {
      window.__vfxSpawnTest(...fire);
      const steps = Math.max(1, Math.round(ms / 16.667));
      for (let i = 0; i < steps; i++) {
        window.__lqclk.advance(16.667);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => requestAnimationFrame(() => r()));
      }
      const rig = window.__stage.rig;
      rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
      window.__stage.render(0);
    }, [c.fire, c.advanceMs]);
    // eslint-disable-next-line no-await-in-loop
    console.log(`  ${await shot(c.name)}`);
  }
  if (errs.length) console.log(`  ⚠️ page errors: ${errs.join(' | ')}`);
  await page.close();
} finally { await browser.close(); }
