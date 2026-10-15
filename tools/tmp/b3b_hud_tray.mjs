#!/usr/bin/env node
/**
 * b3b_hud_tray — U1's HUD half: the weapon tray says WHY a press is refused (`docs/REVAMP.md` §5,
 * package B3b, 2026-10-15). Owner of the `b3b_` prefix.
 *
 * F1 (`b0eaa81`) made the tray stop reading READY over a clogged (Pompa) or sleeping (Warm Milk)
 * fighter — it greys the tray off `state.ts:weaponsLocked`. That boolean cannot say WHICH lock,
 * so a clogged tray and a sleeping tray were the same grey: every press refused, no reason given.
 * B3b's `combat.ts:weaponRefusal` names the reason; this checks the tray SHOWS it.
 *
 * Drives the REAL `createHud` over a REAL six-seat `MatchState` through F1's harness page
 * (`tools/tmp/f1_hud_harness.html` — it only exposes modules, it copies no logic; used read-only).
 * Every arm is paired with a control that must come out the other way, and every filtered set is
 * asserted non-empty first (CLAUDE.md rule 6).
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/b3b_hud_tray.mjs --url '{URL}' [--shots <dir>]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const SHOTS = arg('--shots', null);
const LAUNCH = { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] };
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

let pass = 0; let fail = 0;
const row = (name, ok, detail) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}   ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };

async function open(browser, viewport, touch) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.setDefaultTimeout(180_000);
  await page.goto(`${BASE}/tools/tmp/f1_hud_harness.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__f1ready === true);
  await page.evaluate((touch) => {
    if (touch) document.documentElement.classList.add('fa-touch-capable', 'fa-touch');
    const { createHud, createMatch, createKitchenArena } = window.__f1;
    const arena = createKitchenArena();
    const ids = ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'];
    const state = createMatch(arena, ids.map((characterId, i) => ({ characterId, spawn: arena.spawns[i] })));
    state.phase = 'playing';
    state.elapsed = 20_000;
    const root = document.getElementById('hud');
    const hud = createHud(root, { onRestart() {}, onSelectWeapon() {}, onUseItem() {} });
    hud.setCharacters(ids);
    const me = state.fighters[0];
    for (let i = 0; i < me.lastUsed.length; i++) me.lastUsed[i] = -1e9;
    window.__t = { state, hud, root, frame: { selectedWeapon: 0, observerSlot: 0 } };
    window.__read = () => {
      const { state: s, hud: h, root: r, frame } = window.__t;
      h.update(s, frame);
      const tray = r.querySelector('.hud-weapons');
      const slots = [...r.querySelectorAll('.hud-weapon-slot')];
      const cap = r.querySelector('.hud-weapons-why');
      const vis = (el) => {
        if (!el) return { shown: false, opacity: 0 };
        const cs = getComputedStyle(el);
        let o = 1;
        for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
        const b = el.getBoundingClientRect();
        return { shown: cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0, opacity: +o.toFixed(3), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const tb = tray.getBoundingClientRect();
      const cb = cap?.getBoundingClientRect();
      return {
        n: slots.length,
        ready: slots.filter((x) => x.classList.contains('is-ready')).length,
        locked: tray.classList.contains('is-locked'),
        refusal: tray.dataset.refusal ?? null,
        text: (cap?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        cap: vis(cap),
        inside: cb ? (cb.left >= tb.left - 0.5 && cb.right <= tb.right + 0.5 && cb.top >= tb.top - 0.5 && cb.bottom <= tb.bottom + 0.5) : false,
      };
    };
  }, touch);
  return { context, page, errors };
}

async function main() {
  if (!BASE || BASE.includes(':5173')) { console.error('b3b_hud_tray: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const [label, viewport, touch] of [['desktop 1600x900', { width: 1600, height: 900 }, false], ['touch landscape 844x390', { width: 844, height: 390 }, true]]) {
      console.log(`── ${label}`);
      const { context, page, errors } = await open(browser, viewport, touch);
      try {
        const r = await page.evaluate(() => {
          const { state } = window.__t;
          const me = state.fighters[0];
          const out = {};
          out.free = window.__read();
          me.item.clogUntil = state.elapsed + 3000;
          out.clog = window.__read();
          me.item.clogUntil = -Infinity;
          me.item.sleepUntil = state.elapsed + 2400;
          out.sleep = window.__read();
          me.item.clogUntil = state.elapsed + 4000;              // both: sleep is the wider lock
          out.both = window.__read();
          me.item.sleepUntil = -Infinity; me.item.clogUntil = -Infinity;
          me.lastUsed[1] = state.elapsed - 1;                    // one slot cooling: a per-slot fact, not a tray lock
          out.cool = window.__read();
          me.lastUsed[1] = -1e9;
          out.back = window.__read();
          return out;
        });
        row('NON-VACUITY: the tray has slots, all READY and no reason shown when nothing refuses',
          r.free.n >= 1 && r.free.ready === r.free.n && !r.free.locked && !r.free.cap.shown && !r.free.refusal, r.free);
        row('F1 (kept): clogged → no slot reads ready, tray is-locked', r.clog.n >= 1 && r.clog.ready === 0 && r.clog.locked, `${r.clog.ready}/${r.clog.n}, locked ${r.clog.locked}`);
        row('F1 (kept): asleep → no slot reads ready, tray is-locked', r.sleep.n >= 1 && r.sleep.ready === 0 && r.sleep.locked, `${r.sleep.ready}/${r.sleep.n}, locked ${r.sleep.locked}`);
        row('🔴 clogged: the tray NAMES it — data-refusal "clogged", a visible caption reading CLOGGED',
          r.clog.refusal === 'clogged' && r.clog.cap.shown && /CLOGGED/.test(r.clog.text), r.clog);
        row('🔴 asleep: the tray NAMES it — data-refusal "asleep", a visible caption reading ASLEEP',
          r.sleep.refusal === 'asleep' && r.sleep.cap.shown && /ASLEEP/.test(r.sleep.text), r.sleep);
        row('🔴 …so the two locks no longer render the same — the caption differs', r.clog.text !== r.sleep.text && r.clog.text !== '' && r.sleep.text !== '', `"${r.clog.text}" vs "${r.sleep.text}"`);
        row('🔴 …and it says HOW LONG: the lock\'s own time left (3.0 s clog, 2.4 s sleep)', /3\.0/.test(r.clog.text) && /2\.4/.test(r.sleep.text), `"${r.clog.text}" / "${r.sleep.text}"`);
        row('both locks at once → ASLEEP (the wider lock, `weaponRefusal`\'s order)', r.both.refusal === 'asleep' && /ASLEEP/.test(r.both.text), r.both);
        row('the caption is at FULL strength (not inside the greyed fade) and inside the tray\'s own box',
          r.clog.cap.opacity >= 0.99 && r.clog.inside && r.sleep.inside, `opacity ${r.clog.cap.opacity}, inside ${r.clog.inside}/${r.sleep.inside}, ${r.clog.cap.w}x${r.clog.cap.h}`);
        row('CONTROL: a slot cooling down is a per-slot fact — no tray lock, no caption, three still ready',
          !r.cool.locked && !r.cool.cap.shown && r.cool.ready === r.cool.n - 1, r.cool);
        row('CONTROL: the lock lifts → caption gone, every slot ready again', !r.back.locked && !r.back.cap.shown && r.back.ready === r.back.n, r.back);
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          for (const [k, set] of [['clog', (s) => { s.fighters[0].item.clogUntil = s.elapsed + 3000; }], ['sleep', (s) => { s.fighters[0].item.sleepUntil = s.elapsed + 2400; }]]) {
            await page.evaluate((src) => { const { state } = window.__t; state.fighters[0].item.clogUntil = -Infinity; state.fighters[0].item.sleepUntil = -Infinity; (0, eval)(src)(state); window.__read(); }, `(${set.toString()})`);
            const box = await page.evaluate(() => { const b = document.querySelector('.hud-weapons').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
            const pad = 40;
            const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(viewport.width - Math.max(0, box.x - pad), box.width + pad * 2), height: Math.min(viewport.height - Math.max(0, box.y - pad), box.height + pad * 2) };
            const f = `${SHOTS}/tray_${touch ? 'touch' : 'desk'}_${k}.png`;
            await page.screenshot({ path: f, clip });
            console.log(`   shot ${f}`);
          }
        }
        // Corpse: a dead local seat's tray is INERT (F1) and must not grow a caption over it.
        const dead = await page.evaluate(() => {
          const { state } = window.__t;
          const me = state.fighters[0];
          me.item.clogUntil = state.elapsed + 3000;
          me.hp = 0; me.alive = false;
          return window.__read();
        });
        row('CONTROL: a corpse\'s tray stays inert — no caption even with a clog deadline still set', !dead.cap.shown && !dead.refusal, dead);
        row('page errors', errors.length === 0, errors.join(' | ') || 'none');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
await main();
