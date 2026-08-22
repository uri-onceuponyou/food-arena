#!/usr/bin/env node
/**
 * UF_FOGDMG — WHERE DOES THE DAMAGE ACTUALLY START? Measured off the sim's own
 * applied HP, never off a re-statement of the predicate.
 *
 * Uri: *"It seems like something in the fog doesn't make sense. It starts decreasing
 * my HP before it reaches me."* `uf_fogedge.mjs` measured where the fog is DRAWN.
 * This measures where it BURNS, and the two together are the answer.
 *
 * ── Why not just read `dist > safeRadius` ─────────────────────────────────────
 * Because a re-implemented predicate that agrees with the code proves nothing. So the
 * only two things read here are:
 *
 *   HP           `window.__vfxDebugFighters.player.hp` — damage the sim APPLIED.
 *   safeRadius   read out of the SHIPPED MESH VERTICES. `buildAnnulus.setRadius`
 *                writes ring r's first vertex at x = radius in metres, so the canopy's
 *                ring 0 is `safeRadius + 12` and the ground band's ring 1 is
 *                `safeRadius - 1`. That is the sim's own number, arriving through the
 *                renderer, with no second statement of anything.
 *
 * ── The method, and the one quantisation it cannot remove ─────────────────────
 * Park the fighter at a KNOWN distance `d` from the fog centre, INSIDE the ring, and
 * let the ring close past it. `sim.ts:1004` accumulates `fogTimer` only while the
 * fighter is outside and fires at `FOG_TICK_MS` = 300 ms of SIM time, by which point
 * the schedule (`safeRadius = maxR * timeRemaining / MATCH_DURATION_MS`) has closed a
 * further `1985 * 300 / 45000` = **13.233 wu**. So
 *
 *     d_recovered = safeRadius(at the first HP drop) + 13.233
 *
 * and if the sim's boundary really is `dist > safeRadius`, `d_recovered` comes back
 * equal to the `d` we parked at. That is a measurement of the boundary, not an
 * assumption about it. `?simSpeed=0.05` makes the 200 ms polling interval worth 10 ms
 * of sim = 0.44 wu, which is the instrument's resolution floor.
 *
 * ── Controls ──────────────────────────────────────────────────────────────────
 *  NEGATIVE   a station 300 wu inside must take ZERO damage for the whole window.
 *  POSITIVE   a station 200 wu outside must be burning at the first poll.
 *  AMOUNT     every drop must be exactly FOG_DAMAGE = 15, and drops must be 300 ms of
 *             sim apart. A weapon hit is neither, so this separates fog from gunfire.
 *  DISTANCE   the enemy's distance is logged every poll; a close enemy invalidates the
 *             station rather than being averaged in.
 *  RADIUS     `?fogRadius=` <= 661.67 wu is snapped to sudden death by
 *             `match.ts:applyQaSetup`; the mesh readback proves which frame we are in.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean-072f245 -- \
 *     node tools/tmp/uf_fogdmg.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') === false ? all[i + 1] : true] : []).filter((x) => x.length));
const BASE = args.url ?? process.env.PREVIEW_BASE ?? null;
if (!BASE) { console.error('uf_fogdmg: need --url or PREVIEW_BASE'); process.exit(2); }
const OUT = resolve(args.out ?? 'shots/uf/fogdmg');
const W = Number(args.w ?? 1280), H = Number(args.h ?? 720);
const R = Number(args.fog ?? 900);
const SIM = Number(args.sim ?? 0.05);
const CX = 1400, CY = 1000;
const POLL_MS = 200;
const MAX_S = Number(args.maxs ?? 40);

/** `1985 * FOG_TICK_MS / MATCH_DURATION_MS` — how far the ring closes between a
 *  fighter crossing the line and its first fog tick. Read off `rules.ts`/`shared.ts`
 *  constants, and CHECKED below: the negative control at d = R - 300 never fires, and
 *  the positive control at d = R + 200 fires on the first tick, so the number is only
 *  ever used to convert an observed radius, never to decide whether damage happened. */
const CLOSE_PER_TICK = 1985 * 300 / 45000;

const STATIONS = [];
for (const b of [{ id: 'N', deg: 270 }, { id: 'E', deg: 0 }, { id: 'S', deg: 90 }, { id: 'W', deg: 180 }]) {
  STATIONS.push({ ...b, tag: `${b.id}_in40`, d: R - 40, expect: 'burns after crossing' });
}
STATIONS.push({ id: 'N', deg: 270, tag: 'N_ctl_deepIn', d: R - 300, expect: 'NO damage (negative control)' });
STATIONS.push({ id: 'N', deg: 270, tag: 'N_ctl_out200', d: R + 200, expect: 'burning immediately (positive control)' });

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** ONE evaluate per poll, and it is the LAST thing done in the poll — `page.evaluate`
 *  grants transient user activation (AGENT-BRIEF §3), so it is kept to a single
 *  bookkeeping read that touches nothing the sim reacts to. */
const SAMPLE = () => {
  const w = window, st = w.__stage, S = 0.05, SEG = 128;
  const get = (n) => st?.scene.getObjectByName(n);
  const ringR = (m, ring) => (m ? m.geometry.attributes.position.getX(ring * SEG) / S : null);
  const canopy = get('fog_canopy__no_outline'), edge = get('fog_edge__no_outline');
  const f = w.__vfxDebugFighters ?? null;
  const me = f?.player ?? null, foe = f?.enemy ?? null;
  const zoneEl = [...document.querySelectorAll('*')].find((e) => e.textContent === '▲ OUTSIDE THE ZONE');
  const zoneVisible = zoneEl ? (() => { const c = getComputedStyle(zoneEl); return c.visibility !== 'hidden' && c.display !== 'none' && c.opacity !== '0'; })() : false;
  return {
    t: performance.now(),
    hp: me?.hp ?? null, alive: me?.alive ?? null,
    x: me?.x ?? null, y: me?.y ?? null,
    foeDist: me && foe ? Math.hypot(me.x - foe.x, me.y - foe.y) : null,
    safeFromCanopy: canopy ? ringR(canopy, 0) - 12 : null,
    safeFromEdge: edge ? ringR(edge, 1) + 1 : null,
    zoneVisible,
    phase: w.__matchDebug?.phase ?? null,
  };
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const out = { base: BASE, fogRadius: R, simSpeed: SIM, closePerTick: CLOSE_PER_TICK, stations: [] };
  try {
    for (const s of STATIONS) {
      const th = (s.deg * Math.PI) / 180;
      const px = Math.round(CX + Math.cos(th) * s.d), py = Math.round(CY + Math.sin(th) * s.d);
      const dTrue = Math.hypot(px - CX, py - CY);
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const warns = [];
      page.on('console', (m) => { const t = m.text(); if (/\[QA\]/.test(t)) warns.push(t.slice(0, 240)); });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=${R}&simSpeed=${SIM}&pointerLock=0`,
        { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });

      const samples = [];
      let firstDrop = null, shotTaken = false;
      const t0 = Date.now();
      while ((Date.now() - t0) / 1000 < MAX_S) {
        const smp = await page.evaluate(SAMPLE);
        samples.push(smp);
        if (samples.length >= 2) {
          const prev = samples[samples.length - 2];
          if (smp.hp !== null && prev.hp !== null && smp.hp < prev.hp && !firstDrop) {
            firstDrop = { at: samples.length - 1, from: prev.hp, to: smp.hp, drop: prev.hp - smp.hp, safe: smp.safeFromCanopy, prevSafe: prev.safeFromCanopy };
            // 🚨 THE PICTURE OF URI'S SENTENCE: the HUD is saying "OUTSIDE THE ZONE
            // -50 HP/s" on the very frame the sim first burned him. Taken with the HUD
            // VISIBLE and nothing frozen — this is the frame a player is looking at.
            await page.screenshot({ path: join(OUT, `burn_${s.tag}.png`) });
            shotTaken = true;
          }
        }
        if (smp.alive === false || smp.phase === 'ended') break;
        if (firstDrop && samples.length > firstDrop.at + 12) break;
        await page.waitForTimeout(POLL_MS);
      }
      if (!shotTaken) await page.screenshot({ path: join(OUT, `end_${s.tag}.png`) });
      await page.close();

      const drops = [];
      for (let i = 1; i < samples.length; i++) {
        if (samples[i].hp !== null && samples[i - 1].hp !== null && samples[i].hp < samples[i - 1].hp) {
          drops.push({ i, amount: samples[i - 1].hp - samples[i].hp, wallMs: samples[i].t - samples[i - 1].t, safe: samples[i].safeFromCanopy });
        }
      }
      const recovered = firstDrop ? firstDrop.safe + CLOSE_PER_TICK : null;
      const row = {
        ...s, px, py, dTrue, warns,
        meshRadiusAtStart: samples[0]?.safeFromCanopy ?? null,
        meshRadiusAgree: samples[0] ? Math.abs(samples[0].safeFromCanopy - samples[0].safeFromEdge) : null,
        foeDistMin: Math.min(...samples.map((x) => x.foeDist ?? Infinity)),
        zoneFirstVisibleAtSafe: (samples.find((x) => x.zoneVisible) ?? {}).safeFromCanopy ?? null,
        nSamples: samples.length, firstDrop, drops: drops.slice(0, 6),
        dRecovered: recovered, dError: recovered === null ? null : recovered - dTrue,
        samples,
      };
      out.stations.push(row);

      console.log(`\n── ${s.tag}  parked at (${px},${py})  d=${dTrue.toFixed(2)} wu  ·  ${s.expect}`);
      console.log(`   mesh radius at t0 ${row.meshRadiusAtStart?.toFixed(2)} (canopy vs edge disagree by ${row.meshRadiusAgree?.toFixed(3)})  · enemy never closer than ${row.foeDistMin === Infinity ? 'n/a' : row.foeDistMin.toFixed(0)} wu`);
      if (!firstDrop) console.log(`   NO HP DROP in ${((samples.length - 1) * POLL_MS / 1000).toFixed(1)} s of wall (${row.nSamples} polls). hp held at ${samples[0]?.hp}.`);
      else {
        console.log(`   first HP drop ${firstDrop.from} -> ${firstDrop.to} (-${firstDrop.drop})  at mesh safeRadius ${firstDrop.safe.toFixed(2)}`);
        console.log(`   d recovered from the sim's OWN applied damage: ${recovered.toFixed(2)} wu   vs parked ${dTrue.toFixed(2)}   ERROR ${(recovered - dTrue >= 0 ? '+' : '')}${(recovered - dTrue).toFixed(2)} wu`);
        console.log(`   drops: ${drops.slice(0, 5).map((d) => `-${d.amount}@r${d.safe.toFixed(0)}`).join(' ')}`);
      }
      console.log(`   HUD "OUTSIDE THE ZONE" first visible at mesh safeRadius ${row.zoneFirstVisibleAtSafe === null ? 'never' : row.zoneFirstVisibleAtSafe.toFixed(2)}`);
      if (warns.length) console.log(`   [QA] ${warns[0]}`);
    }
  } finally { await browser.close(); }
  await writeFile(join(OUT, 'fogdmg.json'), JSON.stringify(out, null, 2));

  console.log('\n──────── verdict ────────');
  const neg = out.stations.find((s) => s.tag === 'N_ctl_deepIn');
  const pos = out.stations.find((s) => s.tag === 'N_ctl_out200');
  console.log(neg && !neg.firstDrop ? '  ✓ negative control: 300 wu inside took no damage at all.' : `  ✗ negative control TOOK DAMAGE (${JSON.stringify(neg?.firstDrop)}) — the instrument cannot separate inside from outside.`);
  console.log(pos && pos.firstDrop ? `  ✓ positive control: 200 wu outside burned (-${pos.firstDrop.drop} HP).` : '  ✗ positive control did NOT burn — the instrument is blind.');
  const arms = out.stations.filter((s) => /_in40$/.test(s.tag) && s.firstDrop);
  for (const a of arms) console.log(`  ${a.tag}: damage boundary recovered at ${a.dRecovered.toFixed(2)} wu, parked at ${a.dTrue.toFixed(2)} — error ${(a.dError >= 0 ? '+' : '') + a.dError.toFixed(2)} wu`);
  const errs = arms.map((a) => a.dError);
  if (errs.length) console.log(`  spread across bearings: ${Math.min(...errs).toFixed(2)} .. ${Math.max(...errs).toFixed(2)} wu (poll floor ${(SIM * POLL_MS / 1000 * 1985 / 45).toFixed(2)} wu)`);
  const amts = out.stations.flatMap((s) => s.drops.map((d) => d.amount));
  console.log(`  every HP drop seen was: ${[...new Set(amts)].join(', ')} HP (FOG_DAMAGE is 15; a weapon hit is not)`);
  console.log(`\nwrote ${join(OUT, 'fogdmg.json')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
