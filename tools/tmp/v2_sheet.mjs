#!/usr/bin/env node
/**
 * V2_SHEET — graphics campaign V2's LOOKING tool: one contact sheet of every item's effect,
 * rendered through the real Stage + post chain of a SIX-seat match, at the match camera (58°)
 * and — for every state a fighter WEARS — at the lobby's 20° (CLAUDE.md rule 3: the shallow
 * look is the better detector for something sitting on or through a body).
 *
 * Every effect is fired the way `v2_items.mjs` fires it: the sim's own functions on the live
 * state, the events routed through the shipped `GameSession.handleEvents`. Bots are frozen
 * (`controller = 'human'`), the clock is pumped by hand, camera shake is zeroed before each
 * render. Each cell is a crop around the subject, upscaled 2x so a 70-px fighter can be judged.
 *
 * `--plant ink-reader` injects the ROUTED `stage.ts` reader (see `vfx/ink.ts:applyInkTo`) so the
 * Squid Ink cell shows what the blots will look like once that line lands; without it the ink
 * cell shows the (correct, today) unblotted frame.
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-wp-v2 -- node tools/tmp/v2_sheet.mjs --url '{URL}' \
 *     --out <dir> [--plant ink-reader] [--tag name]
 * Controls: HOLDS — the first cell is rendered twice and must be byte-identical (a frozen frame
 * that is not frozen invalidates every comparison); NONEMPTY — each cell must differ from the same
 * framing rendered with the item layer hidden (the effect put pixels on screen).
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const A = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i]; if (!k.startsWith('--')) continue;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; }
}
const BASE = String(A.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE || /:5173(\/|$)/.test(BASE)) { console.error('v2_sheet: --url must be a SNAPSHOT'); process.exit(2); }
const OUT = String(A.out ?? '/tmp/v2_sheet');
const TAG = String(A.tag ?? 'sheet');
const PLANT = A.plant === 'ink-reader';
mkdirSync(OUT, { recursive: true });
const W = 1280, H = 720, CW = 300, CH = 220;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';
const SIX = 'hamburger@1530,1000;taco@1575,922;donut@1665,922;lollipop@1710,1000;egg@1665,1078;sushi@1575,1078';

// [label, item, thrower, victim, frames after the press, pitch, extra]
const CELLS = [
  ['springform press', 'springform', 0, 1, 3, 58],
  ['springform landing', 'springform', 0, 1, 12, 58],
  ['warm milk in flight', 'warm_milk', 0, 1, 3, 58],
  ['warm milk: asleep', 'warm_milk', 0, 1, 30, 58],
  ['asleep @20', 'warm_milk', 0, 1, 30, 20],
  ['pompa in flight', 'pompa', 0, 1, 3, 58],
  ['pompa: clogged', 'pompa', 0, 1, 30, 58],
  ['clogged @20', 'pompa', 0, 1, 30, 20],
  ['squid ink in flight', 'squid_ink', 0, 1, 3, 58],
  ['squid ink: cloud', 'squid_ink', 0, 1, 30, 58],
  ['liquorice whip', 'liquorice', 0, 1, 3, 58],
  ['liquorice: rooted', 'liquorice', 0, 1, 30, 58],
  ['rooted @20', 'liquorice', 0, 1, 30, 20],
  ['disposal: spit-out', 'disposal', 0, 1, 6, 58],
  ['disposal: drain (source)', 'disposal', 0, 1, 4, 58, { from: true }],
  ['shiitake wind-up', 'shiitake', 0, 0, 40, 58, { hold: true }],
  ['wind-up @20', 'shiitake', 0, 0, 40, 20, { hold: true }],
  ['shiitake: shield', 'shiitake', 0, 0, 10, 58, { resolve: true }],
  ['shield @20', 'shiitake', 0, 0, 10, 20, { resolve: true }],
  ['shiitake cancelled', 'shiitake', 0, 0, 4, 58, { cancel: true }],
  ['tenderiser x6', 'tenderiser', 0, 1, 2, 58, { stacks: 6 }],
  ['squid ink: own view', 'squid_ink', 1, 0, 14, 58, { full: true }],
  ['leftovers revive', 'leftovers', 0, 0, 8, 58],
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(300_000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
let plantHits = 0;
if (PLANT) {
  await page.route('**/src/render/stage.ts*', async (route) => {
    const res = await route.fetch(); let body = await res.text();
    const re = /if \(this\.composer\) this\.composer\.render\(dtSeconds\);/;
    if (re.test(body)) {
      body = 'import * as __v2Ink from "/src/vfx/ink.ts";\n' + body.replace(re,
        'if (this.ink) __v2Ink.applyInkTo(this.ink, this.rig.camera.aspect, (this.__inkSeen ??= { revision: -1, aspect: -1 })); $&');
      plantHits++;
    }
    await route.fulfill({ response: res, body });
  });
}
await page.addInitScript(() => {
  const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
  const base = realNow(); let manual = false; let virt = 0; const q = [];
  window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
    pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
  performance.now = () => (manual ? virt : realNow() - base);
  window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
});
await page.goto(`${BASE}/?screen=match&pointerLock=0&fogRadius=1700&fighters=${encodeURIComponent(SIX)}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000, polling: 200 });
await page.evaluate(() => {
  window.__clk.manual();
  const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
  layer.sync = (s) => { window.__st = s; return orig(s); };
  const st = window.__stage; window.__realRender = st.render.bind(st);
  st.render = (dt) => st.rig.update(dt);
});
await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
for (let i = 0; i < 600; i++) {
  const ph = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
  if (ph === 'playing') break;
}
await page.evaluate(() => {
  const st = window.__st;
  for (let i = 1; i < st.fighters.length; i++) st.fighters[i].controller = 'human';
  for (const f of st.fighters) f.hp = f.maxHp;
  window.__clk.pump(120, 33);
});

const shots = [];
for (const [label, item, thrower, victim, frames, pitch, extra = {}] of CELLS) {
  const r = await page.evaluate(async ({ item, thrower, victim, frames, pitch, extra }) => {
    const combat = await import('/src/game/combat.ts');
    const rules = await import('/src/game/rules.ts');
    const st = window.__st; const F = st.fighters; const stage = window.__stage;
    for (const f of F) {
      Object.assign(f.item, { sleepUntil: -Infinity, clogUntil: -Infinity, rootUntil: -Infinity, blotUntil: -Infinity, shieldUntil: -Infinity });
      f.itemCast = null; f.status.stunnedUntil = -Infinity; f.item.equipped = []; f.item.lastUsed = []; f.hp = f.maxHp; f.alive = true;
    }
    const cx = 1580, cy = 1000;
    const others = F.map((_, i) => i).filter((i) => i !== thrower && i !== victim);
    F[thrower].x = cx; F[thrower].y = cy;
    if (victim !== thrower) { F[victim].x = cx + 70; F[victim].y = cy - 10; }
    others.forEach((i, k) => { const a = Math.PI * 0.35 + (k / others.length) * Math.PI * 1.3; F[i].x = cx + Math.cos(a) * 190; F[i].y = cy + Math.sin(a) * 190; });
    F[thrower].facing = { x: 1, y: -0.14 };
    if (thrower !== 0) { F[0].x = cx + 70; F[0].y = cy - 10; }
    window.__clk.pump(60, 33);
    const t = F[thrower];
    const evs = [];
    if (item === 'tenderiser') {
      t.item.equipped = ['tenderiser']; t.item.lastUsed = [-Infinity];
      const w = rules.CHARACTERS[t.characterId].weapons[0];
      const src = { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: t.id };
      for (let i = 0; i < (extra.stacks ?? 1); i++) { const e2 = []; combat.applyDamage(st, F[victim], 1, null, src, e2); if (i === (extra.stacks ?? 1) - 1) evs.push(...e2); }
    } else if (item === 'leftovers') {
      F[0].item.equipped = ['leftovers']; F[0].item.lastUsed = [-Infinity]; F[0].item.revivesLeft = 1;
      const src = (i) => { const w = rules.CHARACTERS[F[i].characterId].weapons[0]; return { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: F[i].id }; };
      F[1].x = cx + 70; F[1].y = cy; F[2].x = cx + 140; F[2].y = cy;
      const e1 = []; combat.applyDamage(st, F[0], 9999, null, src(1), e1); for (const ev of e1) window.__feelEvent(ev);
      combat.applyDamage(st, F[1], 9999, null, src(2), evs);
    } else {
      t.item.equipped = [item]; t.item.lastUsed = [-Infinity];
      combat.attemptItem(st, t, 0, evs);
      if (extra.resolve && t.itemCast) { t.itemCast.resolvesAt = st.elapsed; combat.resolveDueItemCast(st, t, evs); }
      if (extra.cancel && t.itemCast) {
        window.__clk.pump(30, 33); // let it grow first
        const w = rules.CHARACTERS[F[3].characterId].weapons[0];
        combat.applyDamage(st, t, 1, 'stun', { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: F[3].id }, evs);
      }
    }
    for (const ev of evs) if (ev.type.startsWith('item-') || ev.type === 'death') window.__feelEvent(ev);
    if (item === 'leftovers') for (const ev of evs) if (ev.type === 'item-revived') { /* routed above */ }
    // Hold the sim still for a wind-up cell: pump the VFX clock but not the item's deadline.
    window.__clk.pump(frames, 33);
    if (extra.cancel) { F.forEach((f) => { f.status.stunnedUntil = -Infinity; }); }
    const rig = stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset?.set?.(0, 0, 0); rig.apply?.();
    // Self items (springform, shiitake, leftovers) are framed on the USER, thrown ones on the victim.
    const subj = extra.from ? { x: cx + 70, y: cy - 10 }   // where Disposal's victim WAS
      : (item === 'springform' || item === 'shiitake' || item === 'leftovers') ? F[thrower] : F[victim];
    const cam = rig.camera;
    // 58 = the match rig as shipped. 20 = the lobby's pitch (charStage `pitchDeg: 20`), as a
    // close manual camera on the subject: the rig's own 'fair' framing at 20° does not frame a
    // fighter at all (the first run of this tool photographed a counter top), so the camera is
    // placed by hand AFTER a real render has updated everything else, and the composer is run
    // directly so `rig.update` cannot put it back.
    const draw = () => {
      if (pitch === 58) { window.__realRender(0); return; }
      window.__realRender(0);
      const ph = pitch * Math.PI / 180; const d = 13; const tx = subj.x * 0.05; const tz = subj.y * 0.05;
      cam.position.set(tx, 1.0 + Math.sin(ph) * d, tz + Math.cos(ph) * d);
      cam.lookAt(tx, 1.0, tz); cam.updateMatrixWorld();
      if (stage.composer) stage.composer.render(0); else stage.renderer.render(stage.scene, cam);
    };
    const grab = () => { draw(); return stage.canvas.toDataURL('image/png'); };
    const items = window.__vfxLayer.items.group;
    const url = grab(); const url2 = grab();
    items.visible = false; const bare = grab(); items.visible = true;
    const V3 = cam.position.constructor;
    const p = new V3(subj.x * 0.05, 1.1, subj.y * 0.05).project(cam);
    window.__realRender(0);
    return { url, url2, bare, sx: (p.x * 0.5 + 0.5), sy: (-p.y * 0.5 + 0.5), types: evs.map((e) => e.type) };
  }, { item, thrower, victim, frames, pitch, extra });
  const buf = Buffer.from(r.url.split(',')[1], 'base64');
  const buf2 = Buffer.from(r.url2.split(',')[1], 'base64');
  const bare = Buffer.from(r.bare.split(',')[1], 'base64');
  const same = Buffer.compare(buf, buf2) === 0;
  const raw = await sharp(buf).raw().toBuffer(); const rawB = await sharp(bare).raw().toBuffer();
  let moved = 0; for (let i = 0; i < raw.length; i += 4) if (Math.abs(raw[i] - rawB[i]) + Math.abs(raw[i + 1] - rawB[i + 1]) + Math.abs(raw[i + 2] - rawB[i + 2]) > 12) moved++;
  const full = extra.full === true;
  // The 20-degree camera is close, so its window is 2x wider to hold the whole fighter.
  const z = pitch === 20 ? 2 : 1; const cw0 = CW * z; const ch0 = CH * z;
  const left = full ? 0 : Math.max(0, Math.min(W - cw0, Math.round(r.sx * W - cw0 / 2)));
  const top = full ? 0 : Math.max(0, Math.min(H - ch0, Math.round(r.sy * H - ch0 * 0.55)));
  const cell = full
    ? await sharp(buf).resize(CW * 2, Math.round(CW * 2 * H / W)).png().toBuffer()
    : await sharp(buf).extract({ left, top, width: cw0, height: ch0 }).resize(CW * 2, CH * 2, { kernel: z === 1 ? 'nearest' : 'lanczos3' }).png().toBuffer();
  writeFileSync(join(OUT, `${TAG}_${label.replace(/[^a-z0-9]+/gi, '_')}.png`), cell);
  shots.push({ label, cell, same, moved, types: r.types });
  console.log(`${label.padEnd(24)} holds=${same} movedPx=${moved} events=${r.types.join(',')}`);
}
await browser.close();
// Compose: 4 columns.
const COLS = 4; const cw = CW * 2; const ch = CH * 2; const lab = 30;
const rows = Math.ceil(shots.length / COLS);
const comps = [];
shots.forEach((s, i) => {
  const x = (i % COLS) * cw; const y = Math.floor(i / COLS) * (ch + lab);
  comps.push({ input: s.cell, left: x, top: y + lab });
  const svg = `<svg width="${cw}" height="${lab}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="21" font-size="18" font-family="sans-serif" fill="#fff">${s.label} ${s.moved < 50 ? '(NO PIXELS!)' : ''}</text></svg>`;
  comps.push({ input: Buffer.from(svg), left: x, top: y });
});
const sheet = join(OUT, `${TAG}.png`);
await sharp({ create: { width: COLS * cw, height: rows * (ch + lab), channels: 3, background: '#222' } }).composite(comps).png().toFile(sheet);
const bad = shots.filter((s) => s.moved < 50).map((s) => s.label);
console.log(`\nsheet -> ${sheet}\nHOLDS ${shots.every((s) => s.same) ? 'PASS' : 'FAIL'} · NONEMPTY ${bad.length ? `FAIL (${bad.join(', ')})` : 'PASS'}${PLANT ? ` · plant ink-reader hits ${plantHits}` : ''} · page errors ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 3));
