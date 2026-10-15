#!/usr/bin/env node
/**
 * b3b_seats — SEATS-1: at six seats a KNOCKED-OUT fighter keeps its seat ring
 * (`docs/REVAMP.md` §5, package B3b, 2026-10-15). Owner of the `b3b_` prefix.
 *
 * F1 (`9eeeb85`) put a seat ring under every fighter. `render/stage.ts:updateSeatRings` rings
 * the seats the GAME states through `setFighterSeats`, and until it does it INFERS them from the
 * scene — and inference cannot see death: at six seats a corpse stays drawn, so it kept its
 * ring (`seatRings.ts`: "a corpse is not a unit and gets no ring"). F1 routed the call to
 * `match.ts`'s owner; this checks it on the REAL game.
 *
 * Boots the real match at six seats on the arena's OWN spawns (`?fighters=` ids only, no
 * coordinates — the product path), captures the live `MatchState` the way `b2_input.mjs`
 * does (wrapping `VfxLayer.prototype.sync`), knocks one drawn opponent out through the sim's
 * own `applyDamage`, and reads `window.__stage.seatRings.shown` (seats alive AND drawn).
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/b3b_seats.mjs --url '{URL}' [--shot <png>]
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const SHOT = arg('--shot', null);
const LAUNCH = { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] };
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

let pass = 0; let fail = 0;
const row = (name, ok, detail) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}   ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const wait = (page, fn, a, ms = 180_000) => page.waitForFunction(fn, a, { timeout: ms, polling: 50 });

async function main() {
  if (!BASE || BASE.includes(':5173')) { console.error('b3b_seats: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }
  const browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  try {
    const ids = ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'];
    await page.goto(`${BASE}/?screen=match&fighters=${ids.join(';')}&pointerLock=0&fogRadius=50000`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await wait(page, () => window.__gameReady === true && !!window.__stage);
    await wait(page, () => window.__matchDebug?.phase === 'playing');
    await page.evaluate(async () => {
      const vfx = await import('/src/game/vfx.ts');
      const v = vfx.VfxLayer.prototype;
      if (!v.sync.__b3b) {
        const orig = v.sync;
        const f = function (...args) { window.__b3bState = args[0]; return orig.apply(this, args); };
        f.__b3b = true; v.sync = f;
      }
    });
    await wait(page, () => !!window.__b3bState && Array.isArray(window.__b3bState.fighters));
    const frames = async (n) => { const f0 = await page.evaluate(() => window.__matchDebug.frames); await wait(page, (a) => window.__matchDebug.frames - a.f0 >= a.n, { f0, n }); };
    await frames(3);
    // Every root and whether it is drawn (visible up the whole chain), in scene (= slot) order.
    const read = () => page.evaluate(() => {
      const st = window.__stage;
      const roots = [];
      const walk = (o) => { if (o.name.startsWith('character:')) { roots.push(o); return; } for (const c of o.children) walk(c); };
      for (const c of st.scene.children) walk(c);
      const drawn = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
      return {
        shown: st.seatRings ? (st.seatRings.group.visible ? st.seatRings.shown : 0) : null,
        roots: roots.length,
        drawn: roots.map(drawn),
        alive: window.__b3bState.fighters.map((f) => f.alive),
        phase: window.__matchDebug.phase,
      };
    });
    // --shot only: bring the victim and one LIVING opponent beside the local seat (offsets from
    // the live state, never map literals) so the frame can show a ringed fighter next to a
    // ringless corpse. The assertion run leaves everyone on the arena's own spawns.
    if (SHOT) {
      await page.evaluate(() => {
        const st = window.__b3bState; const me = st.fighters[0];
        st.fighters[1].x = me.x + 110; st.fighters[1].y = me.y + 30;
        st.fighters[2].x = me.x - 110; st.fighters[2].y = me.y + 30;
      });
      await frames(2);
    }
    const before = await read();
    const victim = before.drawn.findIndex((d, i) => i !== 0 && d && before.alive[i]);
    row('NON-VACUITY: six seats, six character roots, the rings are on, and an opponent is drawn and alive to knock out',
      before.alive.length === 6 && before.roots === 6 && before.shown !== null && before.shown >= 2 && victim > 0,
      { ...before, victim });
    await page.evaluate(async (v) => {
      const c = await import('/src/game/combat.ts');
      const st = window.__b3bState;
      c.applyDamage(st, st.fighters[v], st.fighters[v].maxHp * 10, null, { kind: 'hazard' }, []);
    }, victim);
    await frames(4);
    const after = await read();
    row('NON-VACUITY: the knockout took — that seat is dead, its corpse is STILL DRAWN, and the match goes on',
      after.alive[victim] === false && after.drawn[victim] === true && after.phase === 'playing',
      { victim, alive: after.alive[victim], drawn: after.drawn[victim], phase: after.phase });
    const livingDrawn = after.drawn.filter((d, i) => d && after.alive[i]).length;
    row('🔴 the knocked-out body has NO ring — one ring per LIVING drawn seat',
      after.shown === livingDrawn && after.shown === before.shown - 1,
      `rings ${before.shown} → ${after.shown}, living drawn seats ${livingDrawn} (pre-fix: the corpse kept its ring)`);
    if (SHOT) { await page.screenshot({ path: SHOT }); console.log(`   shot ${SHOT} (victim slot ${victim})`); }
    row('page errors', errors.length === 0, errors.join(' | ') || 'none');
  } catch (e) {
    row('run completed', false, String(e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
await main();
