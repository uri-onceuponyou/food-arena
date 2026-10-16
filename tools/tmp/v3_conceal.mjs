#!/usr/bin/env node
/**
 * V3_CONCEAL — revamp bug sweep V3, "EFFECTS MUST NOT REVEAL A HIDDEN FIGHTER": its RED/GREEN
 * probe. Owner of the `v3_` names.
 *
 * Uri, `DECISIONS §29b`: *"plates and other kitchen objects you can hide under — FULLY HIDDEN."*
 * The model, the HP pill and the radar blip obey it (`match.ts`/`hud.ts`, `fighterVisibleTo`).
 * The question here is whether anything ELSE drawn or voiced ON a fighter gives its position away
 * when that fighter is hidden from the viewer — the status telegraphs (`game/vfx.ts`: stun stars,
 * the slow ring + tint + puddle splash, the ward band), the Blue Cheese cloud, V2's item states
 * (`vfx/items.ts`: Zs + milk pool, plunger, coil, ink cloud, shield caps, wind-up) and V2's item
 * cues (`audio/director.ts`).
 *
 * A live SIX-seat match on the shipped kitchen, bots frozen (`controller = 'human'`), the sim clock
 * crawling (`?simSpeed=0.001`, so a 150 s match and its closing fog cannot run out under a probe
 * that lasts minutes, and a status deadline written once stays live for the whole probe). The
 * hidden fighter stands in a REAL concealment region chosen from `arena.concealment` (never a
 * retyped coordinate — `CLAUDE.md`'s map-scale rule), with every other seat on legal open floor
 * derived from the same arena. Statuses are written straight onto the sim fields the presentation
 * reads; §R separately proves each scenario is REACHABLE through the sim's own functions.
 *
 * ── THE ARMS (each one per status) ──────────────────────────────────────────────────────────
 *   L.HIDDEN    local seat alive; the wearer concealed, 130 wu away (beyond the 84 wu reveal
 *               radius, inside the 199 wu fair-play window): NOTHING may be drawn for it.
 *   L.VISIBLE   control — the same wearer 130 wu away on open floor: it IS drawn.
 *   L.OWN       control — the LOCAL seat concealed, wearing it: its own effects ARE drawn.
 *   S.HIDDEN    local seat dead, the camera on a spectated subject; the wearer hidden from the
 *               SUBJECT (130 wu) but within the reveal radius of the CORPSE (80 wu): nothing
 *               drawn. This is the arm that tells "observer = subject" from "observer = corpse".
 *   S.VISIBLE   control — the wearer within the SUBJECT's reveal radius (70 wu) and beyond the
 *               corpse's (120 wu): drawn. Red under an observer-is-the-corpse known-bad.
 *   P.*         the same L arms in PIXELS for five statuses: the frame with the status minus the
 *               frame without it, in a window round the wearer (plus a NULL self-pair). Sheets
 *               are written to --out and must be LOOKED AT.
 *   A.*         the AUDIO half: every item cue for a source the ear cannot see is silent, the
 *               same five arms (the ear is the spectated subject once the local seat is dead,
 *               `MatchAudio.setListener`).
 *   R.*         reachability through the sim's own functions, and the Blue Cheese radius rule
 *               that makes gating its cloud safe (a fighter the cloud can HURT can always see it).
 *
 * Objects are measured as V2's `v2_items.mjs` does — visible renderables under the `vfx_layer`
 * group within 3 m of the wearer, as a uuid SET so something expiring cannot cancel something
 * appearing — PLUS the Blue Cheese instance buffer, because the cloud is ONE instanced mesh at the
 * origin for every wearer and a position filter cannot see it (found while writing this: the
 * V2-style set alone would have reported the cloud as never drawn, on every tree).
 *
 * ── HOW EACH ROW IS KNOWN TO BE ABLE TO FAIL ──────────────────────────────────────────────────
 * The BASE (`977c21e`) is the planted bug for every HIDDEN row. After the fix, `--plant <name>`
 * rewrites one SERVED module; the tool then passes only if every row the plant names went RED and
 * every other row stayed GREEN (a plant that matched nothing is VOID and exits 1):
 *   --plant ungate           vfx.ts: the seat gate answers `true`         → L/S .HIDDEN + P.HIDDEN.edge red
 *                            (centre pixel rows MAY go red: the table top occludes some effects there)
 *   --plant drop-observer    match.ts: `vfx.sync(state)` (no observer)    → S.HIDDEN red
 *   --plant corpse-observer  match.ts: observer = the local corpse        → S.HIDDEN + S.VISIBLE red
 *   --plant ungate-audio     director.ts: the ear gate answers `true`     → A.*HIDDEN red
 *
 * Every assertion over a filtered set asserts the set is NON-EMPTY first (CLAUDE.md rule 6).
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-wp-v3 -- node tools/tmp/v3_conceal.mjs --url '{URL}' --label fix
 *   ... --plant ungate --label k_ungate          (--no-pixels skips §P)
 *
 * Exit 0 iff every row passed (or, with --plant, iff the plant was caught). JSON + sheets land in
 * --out (default /tmp/v3_conceal_<label>), never the repo.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const A = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (!k.startsWith('--')) continue;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; }
}
const BASE = String(A.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE || /:5173(\/|$)/.test(BASE)) { console.error('v3_conceal: --url must be a SNAPSHOT (sx_snap), never :5173'); process.exit(2); }
const LABEL = String(A.label ?? 'run');
const OUT = String(A.out ?? `/tmp/v3_conceal_${LABEL}`);
const PLANT = A.plant ? String(A.plant) : null;
const PIXELS = !A['no-pixels'];
// `--only LPARS` runs just those sections (L live, P pixels, A audio, R reach, S spectator) — for
// iterating; a quotable run is always the whole probe.
const ONLY = A.only ? String(A.only) : 'LPARS';
const on = (sec) => ONLY.includes(sec);
mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';
// Boot positions only — every seat is re-placed from the live arena before anything is measured.
const SIX = 'hamburger@1530,1000;taco@1575,922;donut@1665,922;lollipop@1710,1000;egg@1665,1078;sushi@1575,1078';

// ⚠️ A plant rewrites the SERVED module, which Vite has already put through esbuild: types and
// non-null `!`s are gone. Every pattern is written against that output, not the .ts source.
// `red` rows MUST go red under the plant; `may` rows are allowed to. ⚠️ The CENTRE pixel rows are
// `may`, not `red`, and that is measured, not a loosening: under `ungate` the first run of this plant
// found six of them still at 0 px (stun, ward, clog, root, shield, windup) because the table top
// occludes those effects at its centre even when they are DRAWN — the base read 0 px there too. A
// row that cannot express the bug is not a known-bad (CLAUDE.md rule 6), and which effects poke out
// at the centre is a fact about the table's geometry, which another package owns. The object rows
// and the camera-facing EDGE express every one, so those are the ones a plant must turn.
const PLANTS = {
  ungate: { file: '**/src/game/vfx.ts*', from: /fighterVisibleTo\(state, eye, roster\[i\]\)/, to: 'true',
    red: [/^[LS]\.HIDDEN\./, /^P\.HIDDEN\.edge\./], may: [/^P\.HIDDEN\./] },
  'drop-observer': { file: '**/src/game/match.ts*', from: /this\.vfx\.sync\(this\.state, observer\)/, to: 'this.vfx.sync(this.state)',
    red: [/^S\.HIDDEN\./] },
  'corpse-observer': { file: '**/src/game/match.ts*', from: /this\.vfx\.sync\(this\.state, observer\)/, to: 'this.vfx.sync(this.state, localFighter(this.state))',
    red: [/^S\.HIDDEN\./, /^S\.VISIBLE\./] },
  'ungate-audio': { file: '**/src/audio/director.ts*', from: /return fighterVisibleTo\(state, ear, target\)/, to: 'return true',
    red: [/^A\.(HIDDEN|SPEC_HIDDEN)\./] },
};

const rows = [];
const row = (tag, pass, detail) => {
  rows.push({ tag, pass, detail });
  const t = pass === null ? 'INFO' : pass ? 'PASS' : 'FAIL';
  console.log(`[${t}] ${tag}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 360)}`}`);
};

// The statuses, as the presentation reads them. `objs` = the renderables expected to appear;
// cheese is the instance buffer instead.
const STATUSES = ['stun', 'slow', 'puddle', 'ward', 'cheese', 'sleep', 'clog', 'root', 'blot', 'shield', 'windup'];
// Every status but `puddle` in pixels: its ON frame carries a freshly planted SPLAT, a world entity
// drawn for everyone by design, so a pixel diff cannot isolate the fighter's part of it. Its
// fighter-attached half is the object row (the splash) plus `slow` here (the same ring and tint).
const PIXEL_STATUSES = STATUSES.filter((s) => s !== 'puddle');

const browser = await chromium.launch({ args: LAUNCH_ARGS });
let plantHits = 0;
const results = { label: LABEL, plant: PLANT, layout: null, live: {}, spec: {}, pixels: {}, audio: {}, reach: {} };
let fatal = null;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(300_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  if (PLANT) {
    const P = PLANTS[PLANT];
    if (!P) { console.error(`unknown plant ${PLANT}`); process.exit(2); }
    await page.route(P.file, async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      if (P.from.test(body)) { body = body.replace(P.from, P.to); plantHits++; }
      await route.fulfill({ response: res, body });
    });
  }
  // A virtual clock (v2_items / v1b_draws): the loop only advances when pumped.
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow(); let manual = false; let virt = 0; const q = [];
    window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  await page.goto(`${BASE}/?screen=match&pointerLock=0&fogRadius=1700&simSpeed=0.001&fighters=${encodeURIComponent(SIX)}`,
    { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000, polling: 200 });
  await page.evaluate(async () => {
    window.__clk.manual();
    const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
    // ⚠️ EVERY argument passes through. V2's wrapper was `(s) => orig(s)`, which would silently
    // drop an observer argument and measure the fallback instead of the shipped call.
    layer.sync = (...a) => { window.__st = a[0]; window.__syncArgs = a.length; return orig(...a); };
    const st = window.__stage; window.__realRender = st.render.bind(st);
    st.render = (dt) => st.rig.update(dt);
    const dir = await import('/src/audio/director.ts');
    const p = dir.MatchAudio.prototype; const origH = p.handleEvents;
    p.handleEvents = function (...a) { window.__aud = this; return origH.apply(this, a); };
  });
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 600; i++) {
    const ph = await page.evaluate(() => { window.__clk.pump(3, 33); return window.__st?.phase ?? null; });
    if (ph === 'playing' && await page.evaluate(() => !!window.__aud)) break;
  }

  // ── the page-side kit ────────────────────────────────────────────────────────────────────
  const boot = await page.evaluate(async () => {
    const st = window.__st; const aud = window.__aud;
    if (!st || !aud) return { ok: false, st: !!st, aud: !!aud };
    const hud = await import('/src/ui/hud.ts');
    const rules = await import('/src/game/rules.ts');
    const movement = await import('/src/game/movement.ts');
    const combat = await import('/src/game/combat.ts');
    const F = st.fighters; const layer = window.__vfxLayer; const stage = window.__stage; const rig = stage.rig;
    for (let i = 1; i < F.length; i++) F[i].controller = 'human';
    const Vec = rig.camera.position.constructor;
    const K = {};
    window.__K = K;
    K.F = F; K.st = st; K.hud = hud; K.rules = rules; K.movement = movement; K.combat = combat;
    K.vis = (o, t) => hud.fighterVisibleTo(st, F[o], F[t]);
    K.modelShown = (s) => { const seats = stage.fighterSeats; return seats && seats[s] ? seats[s].root.visible : null; };
    K.snap = (x, y) => { rig.snapTo(x * 0.05, y * 0.05); stage.lighting.focus(x * 0.05, y * 0.05); rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); };
    K.pump = (n) => window.__clk.pump(n, 33);
    K.clear = () => {
      for (const f of F) {
        // 🚨 THE FIRST RUN'S EVERY "HIDDEN" ARM WAS NOT HIDDEN, and only the PRE rows said so: the
        // bots attack on the boot's first tick, `combat.ts` stamps `revealedUntil = now + 500 ms`,
        // and at `simSpeed=0.001` that window outlives the whole probe. Cleared, like every other
        // state the boot left behind.
        f.revealedUntil = -Infinity;
        f.status.stunnedUntil = -Infinity; f.status.slowedUntil = -Infinity;
        Object.assign(f.item, { sleepUntil: -Infinity, clogUntil: -Infinity, rootUntil: -Infinity, blotUntil: -Infinity, shieldUntil: -Infinity });
        f.item.equipped = []; f.item.lastUsed = []; f.itemCast = null;
        if (f.alive) f.hp = f.maxHp;
      }
      st.splats.length = 0;
      st.projectiles.length = 0;
    };
    let splatId = 900000;
    // Writes the sim fields the presentation reads. `now` is the crawling sim clock, so +60 s is
    // "for the whole probe".
    K.apply = (s, status) => {
      const f = F[s]; const now = st.elapsed; const LONG = 60_000;
      switch (status) {
        case 'stun': f.status.stunnedUntil = now + LONG; break;
        case 'slow': f.status.slowedUntil = now + LONG; break;
        case 'puddle': st.splats.push({ id: splatId++, ownerId: F[(s + 1) % F.length].id, x: f.x, y: f.y, expiresAt: now + LONG }); break;
        // GRACE: expired a moment ago, not yet re-applicable — `vfx.ts`'s `inStunGrace`.
        case 'ward': f.status.stunnedUntil = now - 0.01; break;
        case 'cheese': f.item.equipped = ['blue_cheese']; f.item.lastUsed = [-Infinity]; break;
        case 'sleep': f.item.sleepUntil = now + LONG; break;
        case 'clog': f.item.clogUntil = now + LONG; break;
        case 'root': f.item.rootUntil = now + LONG; break;
        case 'blot': f.item.blotUntil = now + LONG; break;
        case 'shield': f.item.shieldUntil = now + LONG; break;
        case 'windup': f.itemCast = { slot: 0, itemId: 'shiitake', startedAt: now, resolvesAt: now + LONG }; break;
        default: throw new Error(`status ${status}`);
      }
    };
    K.active = (s, status) => {
      const f = F[s]; const now = st.elapsed;
      switch (status) {
        case 'stun': return now < f.status.stunnedUntil;
        case 'slow': return now < f.status.slowedUntil;
        case 'puddle': return f.terrainSlowFactor < 1;
        case 'ward': return now >= f.status.stunnedUntil && now < combat.statusReadyAt(f, 'stun');
        case 'cheese': return f.item.equipped.includes('blue_cheese');
        case 'sleep': return now < f.item.sleepUntil;
        case 'clog': return now < f.item.clogUntil;
        case 'root': return now < f.item.rootUntil;
        case 'blot': return now < f.item.blotUntil;
        case 'shield': return now < f.item.shieldUntil;
        case 'windup': return f.itemCast !== null;
        default: return false;
      }
    };
    // Visible renderables under the VFX layer within `r` m of a WU point (every ancestor visible, a
    // non-zero opacity, a non-empty instanced draw) — a uuid SET — plus the cheese instances there.
    const wp = new Vec();
    K.near = (xWU, yWU, r = 3.0) => {
      const out = new Map();
      const cx = xWU * 0.05; const cz = yWU * 0.05;
      const walk = (o, parentVis) => {
        const vis = parentVis && o.visible;
        if (!vis) return;
        if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && !(o.material && o.material.opacity === 0)
          && !(o.isInstancedMesh && o.count === 0) && o.name !== 'vfx_blue_cheese') {
          o.getWorldPosition(wp);
          if (Math.hypot(wp.x - cx, wp.z - cz) <= r) out.set(o.uuid, o.name || o.type);
        }
        for (const c of o.children) walk(c, vis);
      };
      layer.group.updateMatrixWorld(true);
      walk(layer.group, true);
      // The cloud: one instanced mesh, positions in `aAura` (x, z, radius m, seed).
      let cheese = 0;
      const cm = layer.group.getObjectByName('vfx_blue_cheese');
      if (cm && cm.visible) {
        const n = cm.geometry.instanceCount; const arr = cm.geometry.attributes.aAura.array;
        for (let i = 0; i < n; i++) if (Math.hypot(arr[i * 4] - cx, arr[i * 4 + 1] - cz) <= r) cheese++;
      }
      return { objs: out, cheese };
    };
    // One status on one wearer: what is drawn near it with the status ON minus OFF.
    K.measure = (s, status) => {
      const f = F[s];
      const nudge = status === 'puddle';   // the splash is distance-accumulated: the wearer must WADE
      const x0 = f.x, y0 = f.y;
      const wade = (n) => { for (let i = 0; i < n; i++) { if (nudge) { f.x = x0 + ((i % 2) ? 9 : -9); f.y = y0; } K.pump(1); } f.x = x0; f.y = y0; };
      K.pump(4);
      const off = K.near(x0, y0);
      K.apply(s, status);
      wade(10);
      const active = K.active(s, status);
      const on = K.near(x0, y0);
      const born = [...on.objs.keys()].filter((k) => !off.objs.has(k)).map((k) => on.objs.get(k));
      K.unapplyAll();
      K.pump(4);
      return { born: born.length, names: [...new Set(born)].slice(0, 6), cheese: on.cheese - off.cheese, active };
    };
    K.unapplyAll = () => { K.clear(); };
    K.place = (s, x, y) => { F[s].x = x; F[s].y = y; };
    return { ok: true, phase: st.phase, seats: F.length, alive: F.filter((f) => f.alive).length,
      regions: (st.arena.concealment ?? []).length, syncArgs: window.__syncArgs, simSpeedOk: true,
      reveal: rules.CONCEAL_REVEAL_RADIUS, cheeseR: rules.ITEM_TUNING.blue_cheese.radius, playerSize: rules.PLAYER_SIZE };
  });
  row('B.boot', boot.ok && boot.seats === 6 && boot.alive === 6 && boot.phase === 'playing',
    { ...boot });
  if (!boot.ok) throw new Error('boot failed');
  row('B.regions', boot.regions > 0, { regions: boot.regions });
  row('B.observer-arg', null, { syncArgs: boot.syncArgs, note: 'args match.ts passes to vfx.sync (1 on the base, 2 once the observer is plumbed)' });

  // ── LAYOUT, derived from the live arena ─────────────────────────────────────────────────
  const layout = await page.evaluate(() => {
    const K = window.__K; const st = K.st; const a = st.arena;
    const cover = a.cover ?? []; const regions = a.concealment ?? []; const hz = a.hazards ?? [];
    const PS = K.rules.PLAYER_SIZE; const cx0 = a.center.x; const cy0 = a.center.y;
    const inRegion = (x, y, m = 0) => regions.some((b) => Math.abs(x - b.x) < b.w / 2 + m && Math.abs(y - b.y) < b.h / 2 + m);
    const free = (x, y) => x > 60 && x < a.width - 60 && y > 60 && y < a.height - 60
      && !cover.some((o) => Math.abs(x - o.x) < (PS + o.w) / 2 + 4 && Math.abs(y - o.y) < (PS + o.h) / 2 + 4)
      && !hz.some((h) => Math.hypot(x - h.x, y - h.y) < h.radius + PS)
      && Math.hypot(x - cx0, y - cy0) < st.safeRadius - 150;
    const open = (x, y) => free(x, y) && !inRegion(x, y, 6);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];
    const byCentre = [...regions].sort((p, q) => Math.hypot(p.x - cx0, p.y - cy0) - Math.hypot(q.x - cx0, q.y - cy0));
    for (const b of byCentre) {
      if (!free(b.x, b.y)) continue;
      if ((st.brokenConcealment ?? []).includes(b)) continue;   // a spent plate hides nobody
      for (const [ux, uy] of dirs) {
        const P = (d) => [Math.round(b.x + ux * d), Math.round(b.y + uy * d)];
        if (![70, 80, 120, 130].every((d) => open(...P(d)))) continue;
        const V = P(130);
        // T's VISIBLE spot: on open floor, 130 wu from the viewer, not toward the region. Angles
        // nearest the HORIZONTAL first — the frame's short axis is vertical, and the first run's
        // southward pick projected at y = 716 of 720.
        let tv = null;
        const angs = [];
        for (let k = 0; k <= 12; k++) { const e = (k * Math.PI) / 24; angs.push(e, -e, Math.PI + e, Math.PI - e); }
        for (const ang of angs) {
          if (tv) break;
          const x = Math.round(V[0] + Math.cos(ang) * 130); const y = Math.round(V[1] + Math.sin(ang) * 130);
          if (open(x, y) && Math.hypot(x - b.x, y - b.y) > 140) tv = [x, y];
        }
        if (!tv) continue;
        // The three bystanders: open floor, > 450 wu from the region and from each other's 150.
        const far = [];
        for (let gy = 100; gy < a.height - 100 && far.length < 3; gy += 50) {
          for (let gx = 100; gx < a.width - 100 && far.length < 3; gx += 50) {
            if (!open(gx, gy)) continue;
            if (Math.hypot(gx - b.x, gy - b.y) < 450) continue;
            if (far.some(([fx, fy]) => Math.hypot(gx - fx, gy - fy) < 150)) continue;
            far.push([gx, gy]);
          }
        }
        if (far.length < 3) continue;
        // A Disposal drop spot near the viewer, open floor (where the hidden victim is thrown TO).
        return { region: { x: b.x, y: b.y, w: b.w, h: b.h, kind: b.kind ?? null }, u: [ux, uy],
          C: [b.x, b.y], d70: P(70), d80: P(80), d120: P(120), d130: V, tVisible: tv, far, safeRadius: st.safeRadius };
      }
    }
    return null;
  });
  results.layout = layout;
  row('B.layout', layout !== null, layout ?? 'no concealment region with legal open floor round it');
  if (!layout) throw new Error('no layout');

  // Arrangements. Slot 0 = local, 1 = the spectated subject, 2 = the wearer (T), 3..5 bystanders
  // (3 doubles as the visible item thrower for the audio half).
  const T = 2;
  const arrange = async (spec) => page.evaluate(({ spec, L }) => {
    const K = window.__K; K.clear();
    const pos = { C: L.C, d70: L.d70, d80: L.d80, d120: L.d120, d130: L.d130, tVisible: L.tVisible };
    for (const [s, key] of Object.entries(spec)) {
      const p = pos[key] ?? key;
      K.place(Number(s), p[0], p[1]);
    }
    const used = new Set(Object.keys(spec).map(Number));
    let k = 0;
    for (let s = 0; s < K.F.length; s++) if (!used.has(s)) { const p = L.far[k++ % L.far.length]; K.place(s, p[0], p[1]); }
    return true;
  }, { spec, L: layout });
  const camOn = async (key) => page.evaluate(({ p }) => { window.__K.snap(p[0], p[1]); window.__K.pump(6); window.__K.snap(p[0], p[1]); }, { p: layout[key] });

  const measureArm = async (tagArm, wearer, status) => page.evaluate(({ wearer, status }) => window.__K.measure(wearer, status), { wearer, status });

  // ── §L: the local seat alive ───────────────────────────────────────────────────────────────
  for (const status of on('L') ? STATUSES : []) {
    // HIDDEN: viewer at d130, wearer at the region centre.
    await arrange({ 0: 'd130', [T]: 'C', 1: 'tVisible' });
    await camOn('d130');
    const preH = await page.evaluate((T) => ({ vis: window.__K.vis(0, T), model: window.__K.modelShown(T), hiddenSim: window.__K.movement.isHidden(window.__K.F[T].x, window.__K.F[T].y, window.__K.st.arena, window.__K.st, window.__K.F[T]) }), T);
    if (status === STATUSES[0]) {
      // `src/visibility.ts` (V3) holds the predicate; `ui/hud.ts` still holds a byte-identical copy
      // until its owner re-exports (routed). Both asked over every ORDERED pair of the six seats, in
      // an arrangement where some answers are FALSE — agreement over all-true pairs proves nothing.
      const agree = await page.evaluate(async () => {
        const K = window.__K; const mod = await import('/src/visibility.ts').catch(() => null);
        if (!mod) return { absent: true };
        let pairs = 0; let falses = 0; const off = [];
        for (let o = 0; o < K.F.length; o++) for (let t = 0; t < K.F.length; t++) {
          if (o === t) continue;
          const a = K.hud.fighterVisibleTo(K.st, K.F[o], K.F[t]); const b = mod.fighterVisibleTo(K.st, K.F[o], K.F[t]);
          pairs++; if (!a) falses++; if (a !== b) off.push([o, t, a, b]);
        }
        return { pairs, falses, disagree: off };
      });
      if (agree.absent) row('B.one-rule', null, 'src/visibility.ts absent on this tree (the base) — nothing to compare');
      else row('B.one-rule', agree.pairs === 30 && agree.falses > 0 && agree.disagree.length === 0, agree);
    }
    const h = await measureArm('L.HIDDEN', T, status);
    // VISIBLE: the same wearer on open floor, 130 wu from the viewer.
    await arrange({ 0: 'd130', [T]: 'tVisible', 1: 'd70' });
    await camOn('d130');
    const preV = await page.evaluate((T) => ({ vis: window.__K.vis(0, T), model: window.__K.modelShown(T) }), T);
    const v = await measureArm('L.VISIBLE', T, status);
    // OWN: the local seat concealed, wearing it.
    await arrange({ 0: 'C', [T]: 'tVisible', 1: 'd130' });
    await camOn('C');
    const preO = await page.evaluate(() => ({ hidden: window.__K.movement.isHidden(window.__K.F[0].x, window.__K.F[0].y, window.__K.st.arena, window.__K.st, window.__K.F[0]),
      fromSubject: window.__K.vis(1, 0) }));
    const o = await measureArm('L.OWN', 0, status);
    results.live[status] = { preH, h, preV, v, preO, o };
    const drew = (m) => m.born + m.cheese > 0;
    row(`L.PRE.${status}`, preH.vis === false && preH.model === false && preH.hiddenSim === true && preV.vis === true && preV.model === true
      && preO.hidden === true && preO.fromSubject === false && h.active && v.active && o.active,
    { hidden: preH, visible: preV, own: preO, active: [h.active, v.active, o.active] });
    row(`L.HIDDEN.${status}`, !drew(h), { born: h.born, cheese: h.cheese, names: h.names });
    row(`L.VISIBLE.${status}`, drew(v), { born: v.born, cheese: v.cheese, names: v.names });
    row(`L.OWN.${status}`, drew(o), { born: o.born, cheese: o.cheese, names: o.names });
  }

  // ── §P: pixels for the live arms ─────────────────────────────────────────────────────────
  // ⚠️ WHOLE-FRAME, AND AT TWO HIDING SPOTS. The first draft diffed a 240 px window at the region
  // CENTRE and read 0 px for stun / ward / cheese / sleep on the base while the objects were drawn:
  // the table top occludes them from the 58° camera there ("rendering and invisible"), and the
  // cloud's boundary band (84 wu out) lay outside the window. Concealment is CENTRE-in-box, so a
  // fighter is just as hidden standing at the cloth's camera-facing EDGE, where ground-level
  // effects stick out past it — that spot is the worst case and is measured too.
  if (PIXELS && on('P')) {
    const sheets = {};
    const edge = [layout.C[0], Math.round(layout.C[1] + layout.region.h / 2 - 8)];
    const ARMS = { HIDDEN: { 0: 'd130', [T]: 'C', 1: 'tVisible' }, EDGE: { 0: 'd130', [T]: edge, 1: 'tVisible' }, VISIBLE: { 0: 'd130', [T]: 'tVisible', 1: 'd70' } };
    for (const arm of Object.keys(ARMS)) {
      for (const status of PIXEL_STATUSES) {
        await arrange(ARMS[arm]);
        await camOn('d130');
        const r = await page.evaluate(({ T, status, cam }) => {
          const K = window.__K; const stage = window.__stage; const rig = stage.rig; const f = K.F[T];
          const cw = stage.canvas.width; const ch = stage.canvas.height;
          const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
          const ctx = c2.getContext('2d', { willReadFrequently: true });
          let calls = 0;
          const frame = () => {
            // The camera is RE-PINNED for every frame: the loop's follow lerp keeps converging
            // between pumps, and a sub-pixel drift is hundreds of pixels at a >= 2 threshold.
            K.snap(cam[0], cam[1]); if (rig.apply) rig.apply();
            rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
            stage.renderer.shadowMap.needsUpdate = true;
            stage.renderer.info.reset();
            const ar = stage.renderer.info.autoReset; stage.renderer.info.autoReset = false;
            window.__realRender(0);
            calls = stage.renderer.info.render.calls; stage.renderer.info.autoReset = ar;
            ctx.clearRect(0, 0, cw, ch); ctx.drawImage(stage.canvas, 0, 0);
            return ctx.getImageData(0, 0, cw, ch);
          };
          const Vec = rig.camera.position.constructor;
          const p = new Vec(f.x * 0.05, 0.8, f.y * 0.05).project(rig.camera);
          const sx = Math.round((p.x + 1) / 2 * cw); const sy = Math.round((1 - p.y) / 2 * ch);
          // >= 2 per channel, not the usual 6: the cheese haze is alpha <= ~0.13 BY DESIGN
          // (`blueCheese.ts`), so a coarse threshold would call a drawn cloud "nothing". Safe only
          // because the NULL self-pair must read exactly 0 at this same threshold.
          const diff = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) { if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) >= 2) n++; } return n; };
          // 🚨 THE NULL PAIR SPANS THE SAME PUMP AS OFF -> ON. The first draft rendered its two OFF
          // frames back to back, so anything that moves between pumps (the camera's follow lerp,
          // a real-time uniform) was invisible to the control and charged to the status — it read
          // 178-373 px for item states with ZERO new objects and an unchanged draw count.
          // ⚠️ AND THE LOOP RUNS ZERO-LENGTH FRAMES HERE (`pump(n, 0)`). With the null spanning the
          // gap it still read 46-701 px: something moves with the virtual clock between pumps (the
          // VISIBLE arm, with more animated fighters on screen, was the largest). A dt = 0 frame
          // still runs `vfx.sync` and the model hide — everything this measures — and advances
          // nothing that is driven by time.
          // Both NULL frames sit INSIDE the dt = 0 regime: an off1 taken straight after the 33 ms
          // settle frames straddled the switch and read 2-264 px on its own.
          const pump0 = (n) => window.__clk.pump(n, 0);
          K.pump(3);
          pump0(6);
          const off1 = frame();
          pump0(6);
          const off2 = frame(); const callsOff = calls;
          K.apply(T, status); pump0(6);
          const on = frame(); const callsOn = calls;
          K.clear(); K.pump(3);
          const W = 320; const x0 = Math.max(0, Math.min(cw - W, sx - W / 2)); const y0 = Math.max(0, Math.min(ch - W, sy - W / 2));
          const crop = (img) => { const c = document.createElement('canvas'); c.width = W; c.height = W; c.getContext('2d').putImageData(img, -x0, -y0); return c; };
          const sheet = document.createElement('canvas'); sheet.width = W * 2 + 6; sheet.height = W;
          const g = sheet.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, sheet.width, sheet.height);
          g.drawImage(crop(off2), 0, 0); g.drawImage(crop(on), W + 6, 0);
          const inFrame = sx >= 0 && sx < cw && sy >= 0 && sy < ch;
          return { nullPx: diff(off1, off2), px: diff(off2, on), screen: [sx, sy], inFrame, callsOff, callsOn, sheet: sheet.toDataURL('image/png') };
        }, { T, status, cam: layout.d130 });
        sheets[`${arm}_${status}`] = r.sheet;
        results.pixels[`${arm}.${status}`] = { nullPx: r.nullPx, px: r.px, screen: r.screen, inFrame: r.inFrame, callsOff: r.callsOff, callsOn: r.callsOn };
        row(`P.NULL.${arm}.${status}`, r.nullPx === 0 && r.inFrame, { nullPx: r.nullPx, screen: r.screen });
        if (arm === 'VISIBLE') row(`P.VISIBLE.${status}`, r.px > 50, { px: r.px, draws: [r.callsOff, r.callsOn] });
        else row(`P.HIDDEN.${arm === 'EDGE' ? 'edge.' : ''}${status}`, r.px === 0, { px: r.px, draws: [r.callsOff, r.callsOn] });
      }
    }
    // One sheet per arm: rows = statuses, OFF | ON.
    for (const arm of Object.keys(ARMS)) {
      const png = await page.evaluate(async ({ urls }) => {
        const imgs = await Promise.all(urls.map((u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = u; })));
        const W = imgs[0].width; const H = imgs[0].height;
        const c = document.createElement('canvas'); c.width = W; c.height = (H + 6) * imgs.length;
        const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
        imgs.forEach((im, i) => g.drawImage(im, 0, i * (H + 6)));
        return c.toDataURL('image/png');
      }, { urls: PIXEL_STATUSES.map((s) => sheets[`${arm}_${s}`]) });
      writeFileSync(`${OUT}/sheet_${arm}.png`, Buffer.from(png.split(',')[1], 'base64'));
    }
  }

  // ── §A (live arms): the audio half ────────────────────────────────────────────────────────
  // Every cue is placed (gain from distance), so all of these stand inside hearing range.
  const audioArm = async (tagArm, spec, cam, src, owner) => {
    await arrange(spec);
    await camOn(cam);
    return page.evaluate(({ src, owner }) => {
      const K = window.__K; const st = K.st; const F = K.F; const aud = window.__aud; const eng = aud.engine;
      if (!eng.__v3) { const orig = eng.play.bind(eng); eng.__v3 = true; eng.play = (fn, o) => { if (window.__v3On && o?.key !== 'ambience') window.__v3Plays.push(o?.key ?? null); return orig(fn, o); }; }
      const ev0 = (type, extra) => ({ type, fighterRole: F[src].role, fighterId: F[src].id, ...extra });
      const S = F[src]; const O = F[owner];
      const hitBase = (itemId, extra = {}) => ({ type: 'item-hit', itemId, ownerRole: O.role, ownerId: O.id, targetRole: S.role, targetId: S.id,
        durationMs: 2000, stacks: 0, fromX: S.x, fromY: S.y, x: S.x, y: S.y, ...extra });
      const out = {};
      const play = (name, ev, before) => {
        window.__v3Plays = []; window.__v3On = true;
        try { aud.handleEvents([ev], st); } finally { window.__v3On = false; }
        out[name] = window.__v3Plays.slice();
        if (before) before();
      };
      play('used_milk', ev0('item-used', { itemId: 'warm_milk', slot: 0, x: S.x, y: S.y, windupMs: 0 }));
      play('used_spring', ev0('item-used', { itemId: 'springform', slot: 0, x: S.x, y: S.y, windupMs: 0 }));
      play('used_shiitake', ev0('item-used', { itemId: 'shiitake', slot: 0, x: S.x, y: S.y, windupMs: 1200 }));
      play('resolved_shiitake', ev0('item-resolved', { itemId: 'shiitake', slot: 0, x: S.x, y: S.y }));
      play('cancelled_shiitake', ev0('item-cancelled', { itemId: 'shiitake', slot: 0, reason: 'stun' }));
      play('hit_milk', hitBase('warm_milk'));
      play('hit_pompa', hitBase('pompa'));
      play('hit_tender', hitBase('tenderiser', { stacks: 3 }));
      play('hit_shiitake', { ...hitBase('shiitake'), ownerRole: S.role, ownerId: S.id });
      return { plays: out, ear: aud.listenerSlot, vis: K.vis(aud.listenerSlot, src), srcHidden: K.movement.isHidden(S.x, S.y, st.arena, st, S) };
    }, { src, owner });
  };
  if (on('A')) {
    const H = await audioArm('A.HIDDEN', { 0: 'd130', [T]: 'C', 3: 'tVisible' }, 'd130', T, 3);
    const V = await audioArm('A.VISIBLE', { 0: 'd130', [T]: 'tVisible', 3: 'd120' }, 'd130', T, 3);
    const O = await audioArm('A.OWN', { 0: 'C', 3: 'd130' }, 'C', 0, 3);
    results.audio.live = { H, V, O };
    row('A.PRE.live', H.ear === 0 && H.vis === false && H.srcHidden === true && V.vis === true && O.srcHidden === true, { ear: H.ear, H: H.vis, V: V.vis, O: O.srcHidden });
    const names = Object.keys(V.plays);
    row('A.PRE.nonempty', names.length === 9 && names.every((n) => V.plays[n].length > 0), { visiblePlays: V.plays });
    for (const n of names) {
      row(`A.HIDDEN.${n}`, H.plays[n].length === 0, { plays: H.plays[n] });
      row(`A.VISIBLE.${n}`, V.plays[n].length > 0, { plays: V.plays[n] });
      row(`A.OWN.${n}`, O.plays[n].length > 0, { plays: O.plays[n] });
    }
    // DISPOSAL: the drain opens where the victim WAS (hidden) and spits them out where they WENT
    // (open floor by the viewer). The gurgle must go quiet, the spit must still play.
    const D = await page.evaluate(({ L, T }) => {
      const K = window.__K; const st = K.st; const F = K.F; const aud = window.__aud;
      K.clear();
      K.place(0, L.d130[0], L.d130[1]); K.place(3, L.tVisible[0], L.tVisible[1]);
      // The victim now stands at the drop spot; it came FROM the region centre.
      K.place(T, L.d120[0], L.d120[1]);
      K.pump(2);
      const S = F[T]; const O = F[3];
      const ev = { type: 'item-hit', itemId: 'disposal', ownerRole: O.role, ownerId: O.id, targetRole: S.role, targetId: S.id,
        durationMs: 0, stacks: 0, fromX: L.C[0], fromY: L.C[1], x: S.x, y: S.y };
      window.__v3Plays = []; window.__v3On = true;
      try { aud.handleEvents([ev], st); } finally { window.__v3On = false; }
      const fromHidden = K.movement.isHidden(L.C[0], L.C[1], st.arena, st, S);
      return { plays: window.__v3Plays.slice(), fromHidden, toVisible: K.vis(0, T) };
    }, { L: layout, T });
    results.audio.disposal = D;
    row('A.PRE.disposal', D.fromHidden === true && D.toVisible === true, D);
    row('A.HIDDEN.disposal_drain', !D.plays.includes('item:disposal:hit'), { plays: D.plays });
    row('A.VISIBLE.disposal_spit', D.plays.includes('item:disposal:hit:spit'), { plays: D.plays });
  }

  // ── §R: reachability through the sim's OWN functions, and the cloud's radius rule ──────────
  if (on('R')) {
    await arrange({ 0: 'd130', [T]: 'C', 3: 'tVisible' });
    await camOn('d130');
    const r = await page.evaluate((T) => {
      const K = window.__K; const st = K.st; const F = K.F; const combat = K.combat; const rules = K.rules;
      const t = F[T];
      // (a) a hidden fighter PRESSES an item and stays hidden (an item press does not spend cover).
      t.item.equipped = ['warm_milk']; t.item.lastUsed = [-Infinity];
      const ev1 = []; combat.attemptItem(st, t, 0, ev1);
      const pressed = ev1.some((e) => e.type === 'item-used');
      const stillHidden = !K.vis(0, T);
      // (b) a visible attacker's stun LANDS on a hidden fighter and leaves it hidden.
      const att = F[3]; const w = rules.CHARACTERS[att.characterId].weapons[0];
      const ev2 = []; combat.applyDamage(st, t, 1, 'stun', { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: att.id }, ev2);
      const stunned = st.elapsed < t.status.stunnedUntil;
      const hiddenAfterStun = !K.vis(0, T);
      K.clear();
      // (c) the cloud hurts at centre distance < radius, concealment reveals at <= REVEAL: every
      // fighter the cloud can hurt can see its wearer, so hiding the cloud never hides damage.
      const R = rules.ITEM_TUNING.blue_cheese.radius; const REV = rules.CONCEAL_REVEAL_RADIUS;
      return { pressed, stillHidden, stunned, hiddenAfterStun, events: [...ev1, ...ev2].map((e) => e.type), R, REV };
    }, T);
    results.reach = r;
    row('R.item-press-keeps-cover', r.pressed && r.stillHidden, r);
    row('R.stun-lands-on-hidden', r.stunned && r.hiddenAfterStun, r);
    row('R.cheese-radius<=reveal', r.R <= r.REV, { radius: r.R, reveal: r.REV });
  }

  // ── §S: the local seat DEAD, the camera (and the ear) on a spectated subject ─────────────────
  if (on('S')) {
    // Kill the local seat at d80 with the subject (slot 1) at d130 and the wearer at C: with no
    // death event routed there is no dwell and no killer chain, so `resolveViewSubject` takes rung 4
    // (nearest living to the camera): the subject is 50 wu away, the wearer 80. It then HOLDS.
    await arrange({ 0: 'd80', 1: 'd130', [T]: 'C' });
    await camOn('d80');
    const sub = await page.evaluate(() => {
      const K = window.__K; const f0 = K.F[0]; f0.hp = 0; f0.alive = false;
      for (let i = 0; i < 40 && window.__matchDebug.viewSubject !== 1; i++) K.pump(1);
      K.pump(4);
      return { subject: window.__matchDebug.viewSubject, reason: window.__matchDebug.viewReason, ear: window.__aud.listenerSlot };
    });
    row('S.PRE.subject', sub.subject === 1 && sub.ear === 1, sub);
    if (sub.subject === 1) {
      const specArrange = async (arm) => {
        await page.evaluate(({ arm, L, T }) => {
          const K = window.__K; K.clear();
          const P = (k) => L[k];
          const set = arm === 'HIDDEN' ? { 0: 'd80', 1: 'd130', [T]: 'C' } : { 0: 'd120', 1: 'd70', [T]: 'C' };
          for (const [s, k] of Object.entries(set)) K.place(Number(s), P(k)[0], P(k)[1]);
          let j = 0; for (let s = 2; s < K.F.length; s++) if (s !== T) { const p = L.far[j++]; K.place(s, p[0], p[1]); }
          K.F[0].hp = 0; K.F[0].alive = false;
        }, { arm, L: layout, T });
        await camOn(arm === 'HIDDEN' ? 'd130' : 'd70');
      };
      for (const status of STATUSES) {
        await specArrange('HIDDEN');
        const preH = await page.evaluate((T) => ({ subj: window.__matchDebug.viewSubject, fromSubject: window.__K.vis(1, T), fromCorpse: window.__K.vis(0, T), model: window.__K.modelShown(T) }), T);
        const h = await measureArm('S.HIDDEN', T, status);
        await specArrange('VISIBLE');
        const preV = await page.evaluate((T) => ({ subj: window.__matchDebug.viewSubject, fromSubject: window.__K.vis(1, T), fromCorpse: window.__K.vis(0, T), model: window.__K.modelShown(T) }), T);
        const v = await measureArm('S.VISIBLE', T, status);
        results.spec[status] = { preH, h, preV, v };
        const drew = (m) => m.born + m.cheese > 0;
        row(`S.PRE.${status}`, preH.subj === 1 && preH.fromSubject === false && preH.fromCorpse === true && preH.model === false
          && preV.subj === 1 && preV.fromSubject === true && preV.fromCorpse === false && preV.model === true && h.active && v.active,
        { hidden: preH, visible: preV });
        row(`S.HIDDEN.${status}`, !drew(h), { born: h.born, cheese: h.cheese, names: h.names });
        row(`S.VISIBLE.${status}`, drew(v), { born: v.born, cheese: v.cheese, names: v.names });
      }
      // The ear, spectating: the same nine cues from the wearer, hidden from / visible to the SUBJECT.
      const spAudio = async (arm) => {
        await specArrange(arm);
        return page.evaluate(({ T }) => {
          const K = window.__K; const st = K.st; const F = K.F; const aud = window.__aud;
          const S = F[T]; const O = F[1];
          const ev0 = (type, extra) => ({ type, fighterRole: S.role, fighterId: S.id, ...extra });
          const hit = (itemId, extra = {}) => ({ type: 'item-hit', itemId, ownerRole: O.role, ownerId: O.id, targetRole: S.role, targetId: S.id,
            durationMs: 2000, stacks: 0, fromX: S.x, fromY: S.y, x: S.x, y: S.y, ...extra });
          const evs = {
            used_milk: ev0('item-used', { itemId: 'warm_milk', slot: 0, x: S.x, y: S.y, windupMs: 0 }),
            resolved_shiitake: ev0('item-resolved', { itemId: 'shiitake', slot: 0, x: S.x, y: S.y }),
            hit_milk: hit('warm_milk'),
            hit_tender: hit('tenderiser', { stacks: 3 }),
          };
          const out = {};
          for (const [n, ev] of Object.entries(evs)) {
            window.__v3Plays = []; window.__v3On = true;
            try { aud.handleEvents([ev], st); } finally { window.__v3On = false; }
            out[n] = window.__v3Plays.slice();
          }
          return { plays: out, ear: aud.listenerSlot };
        }, { T });
      };
      const SH = await spAudio('HIDDEN');
      const SV = await spAudio('VISIBLE');
      results.audio.spec = { SH, SV };
      row('A.PRE.spec', SH.ear === 1 && SV.ear === 1 && Object.keys(SV.plays).every((n) => SV.plays[n].length > 0), { ear: [SH.ear, SV.ear], visible: SV.plays });
      for (const n of Object.keys(SH.plays)) {
        row(`A.SPEC_HIDDEN.${n}`, SH.plays[n].length === 0, { plays: SH.plays[n] });
        row(`A.SPEC_VISIBLE.${n}`, SV.plays[n].length > 0, { plays: SV.plays[n] });
      }
    }
  }
  row('B.page-errors', errors.length === 0, errors.slice(0, 4));
} catch (e) {
  fatal = String(e?.stack ?? e).slice(0, 800);
  console.error('FATAL', fatal);
} finally {
  await browser.close();
}

// ── VERDICT ─────────────────────────────────────────────────────────────────────────────────
const judged = rows.filter((r) => r.pass !== null);
const failed = judged.filter((r) => !r.pass);
let ok;
if (!PLANT) {
  ok = !fatal && judged.length > 0 && failed.length === 0;
  console.log(`\nv3_conceal ${LABEL}: ${judged.length - failed.length}/${judged.length} rows pass${fatal ? ' — FATAL' : ''}`);
  if (failed.length) console.log(`FAILED: ${failed.map((r) => r.tag).join(', ')}`);
} else {
  const red = PLANTS[PLANT].red; const may = PLANTS[PLANT].may ?? [];
  const expect = judged.filter((r) => red.some((re) => re.test(r.tag)));
  const caught = expect.filter((r) => !r.pass);
  const allowed = judged.filter((r) => !red.some((re) => re.test(r.tag)) && may.some((re) => re.test(r.tag)));
  const collateral = judged.filter((r) => !red.some((re) => re.test(r.tag)) && !may.some((re) => re.test(r.tag)) && !r.pass);
  ok = !fatal && plantHits > 0 && expect.length > 0 && caught.length === expect.length && collateral.length === 0;
  console.log(`\nv3_conceal --plant ${PLANT}: hits ${plantHits}; named rows ${caught.length}/${expect.length} RED; may-rows red ${allowed.filter((r) => !r.pass).length}/${allowed.length}; collateral reds ${collateral.length}`
    + ` → ${plantHits === 0 ? 'VOID (the plant matched nothing)' : ok ? 'PLANT CAUGHT' : 'PLANT MISSED'}`);
  const missed = expect.filter((r) => r.pass);
  if (missed.length) console.log(`still GREEN under the plant: ${missed.map((r) => r.tag).join(', ')}`);
  if (collateral.length) console.log(`collateral: ${collateral.map((r) => r.tag).join(', ')}`);
}
writeFileSync(`${OUT}/v3_conceal.json`, JSON.stringify({ ...results, rows, fatal, plantHits, ok }, null, 1));
console.log(`json: ${OUT}/v3_conceal.json`);
process.exitCode = ok ? 0 : 1;
