#!/usr/bin/env node
/**
 * V2_ITEMS — graphics campaign V2 ("items you can SEE and HEAR"), its RED/GREEN probe. Owner of
 * the `v2_items` names (the older `v2_ablate`/`v2_band`/`v2_lobby`/`v2_shot` belong to a
 * different, earlier "item 2" render track — not this one).
 *
 * The question, per item EVENT: does anything in the shipped presentation ANSWER it? Every
 * active item is fired with the sim's OWN functions on the LIVE `MatchState` of a SIX-seat match
 * (`combat.attemptItem`, `resolveDueItemCast`, `applyDamage`), and every `item-*` event that comes
 * out is routed through the two shipped consumers — `GameSession.handleEvents` (via
 * `window.__feelEvent`, which IS it) and `MatchAudio.handleEvents` (the instance the loop drives,
 * captured off its own prototype) — one event at a time, measuring three observables per event:
 *
 *   vfx    `__feelDebug.responses.vfx` delta — match.ts's own count of "I drew something"
 *   objs   visible renderables under the `vfx_layer` group, after one pumped frame, minus before
 *          (an observable, so a counter bumped without drawing anything cannot pass it)
 *   plays  `AudioEngine.play` calls made by the director for that event (the kitchen bed's
 *          `key: 'ambience'` chunks are excluded — they are a clock, not an answer)
 *
 * and, per persistent STATE (sleep / clog / root / blot / shield / wind-up): visible renderables
 * WHILE it runs minus after it is cleared, with the bots frozen (`controller = 'human'`, so the sim
 * hands them neutral input) and the clock pumped by hand, so nothing else moves.
 *
 * Plus two single-purpose rows:
 *   INK    Squid Ink on the LOCAL seat must drive `vfx/ink.ts`'s channel (`readInk().amount > 0`
 *          while blotted, EXACTLY 0 after) — its header names `vfx.ts:sync` as the writer and
 *          nothing writes it on the base. The effect's own uniform (`stage.ink.amount`) is
 *          reported as INFO: that reader is in `render/stage.ts`, not this package's file.
 *   CHICK  Egg's Hatch! `trail()` handed `arrived: true` while the chick RIDES a fleeing victim
 *          (82–90 wu/s since B4) must pick the PECK; on the base it reads ground speed and picks
 *          the waddle. `arrived: false` at a standstill must still waddle (the known-bad).
 *
 * ── HOW EACH ROW IS KNOWN TO BE ABLE TO FAIL ─────────────────────────────────
 * The BASE run is the planted bug for every consumer row (zero consumers on `3ae6028`). After the
 * fix, `--plant <name>` rewrites one SERVED module to unhook one consumer and the named rows must
 * go red (a plant that matched nothing is VOID and exits 1):
 *   --plant unhook-hit      match.ts: the `item-hit` case never matches   → every `hit` vfx row red
 *   --plant unhook-audio    director.ts: the `item-used` case never matches → every `used` plays row red
 *   --plant ink-reader      stage.ts: inject the ROUTED per-frame reader  → INFO row becomes a check
 *
 * Every assertion over a filtered set asserts the set is NON-EMPTY first (CLAUDE.md rule 6).
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-wp-v2 -- node tools/tmp/v2_items.mjs --url '{URL}' --label fix
 *   ... --plant unhook-hit
 *
 * Exit 0 iff every row passed. JSON lands in --out (default /tmp/v2_items_<label>), never the repo.
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
if (!BASE || /:5173(\/|$)/.test(BASE)) { console.error('v2_items: --url must be a SNAPSHOT (sx_snap), never :5173'); process.exit(2); }
const LABEL = String(A.label ?? 'run');
const OUT = String(A.out ?? `/tmp/v2_items_${LABEL}`);
const PLANT = A.plant ? String(A.plant) : null;
mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';
// Six seats in open floor east of the pot (v1b_draws' layout). Positions are rearranged per case.
const SIX = 'hamburger@1530,1000;taco@1575,922;donut@1665,922;lollipop@1710,1000;egg@1665,1078;sushi@1575,1078';

// ⚠️ A plant rewrites the SERVED module, which Vite has already put through esbuild: types are
// gone, strings are double-quoted and unused imports are dropped. Every pattern below is written
// against that output, not against the .ts source.
const PLANTS = {
  'unhook-hit': { file: '**/src/game/match.ts*', from: /case ["']item-hit["']: \{/, to: 'case "item-hit-UNHOOKED": {' },
  'unhook-audio': { file: '**/src/audio/director.ts*', from: /case ["']item-used["']:/, to: 'case "item-used-UNHOOKED":' },
  'ink-reader': {
    file: '**/src/render/stage.ts*',
    // The ROUTED reader: one call immediately before the composer renders.
    from: /if \(this\.composer\) this\.composer\.render\(dtSeconds\);/,
    to: 'if (this.ink) __v2Ink.applyInkTo(this.ink, this.rig.camera.aspect, (this.__inkSeen ??= { revision: -1, aspect: -1 })); $&',
    prepend: 'import * as __v2Ink from "/src/vfx/ink.ts";\n',
  },
};

const rows = [];
const row = (sec, name, pass, detail) => {
  rows.push({ sec, name, pass, detail });
  const tag = pass === null ? 'INFO' : pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] §${sec} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 400)}`}`);
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
let plantHits = 0;
const results = { label: LABEL, plant: PLANT, cases: {} };
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
      if (P.from.test(body)) {
        body = body.replace(P.from, P.to);
        if (P.prepend) body = P.prepend + body;
        plantHits++;
      }
      await route.fulfill({ response: res, body });
    });
  }
  // A virtual clock (v1b_draws): the loop only advances when pumped, so nothing happens between
  // two measurements that the probe did not ask for.
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow(); let manual = false; let virt = 0; const q = [];
    window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  await page.goto(`${BASE}/?screen=match&pointerLock=0&fogRadius=1700&fighters=${encodeURIComponent(SIX)}`,
    { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000, polling: 200 });
  await page.evaluate(async () => {
    window.__clk.manual();
    const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
    layer.sync = (s) => { window.__st = s; return orig(s); };
    const st = window.__stage; window.__realRender = st.render.bind(st);
    st.render = (dt) => st.rig.update(dt);
    const dir = await import('/src/audio/director.ts');
    const p = dir.MatchAudio.prototype; const origH = p.handleEvents;
    p.handleEvents = function (...a) { window.__aud = this; return origH.apply(this, a); };
  });
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 600; i++) {
    const ph = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
    if (ph === 'playing') break;
  }
  const boot = await page.evaluate(() => {
    const st = window.__st; const aud = window.__aud;
    if (!st || !aud) return { ok: false, st: !!st, aud: !!aud };
    // Freeze every bot: a 'human' seat with no input is handed NEUTRAL input by the sim.
    for (let i = 1; i < st.fighters.length; i++) st.fighters[i].controller = 'human';
    // Count the director's plays. `engine` is MatchAudio's own private field.
    window.__plays = []; window.__playsOn = false;
    const eng = aud.engine; const origPlay = eng.play.bind(eng);
    eng.play = (sound, opts) => { if (window.__playsOn && opts?.key !== 'ambience') window.__plays.push({ key: opts?.key ?? null, pri: opts?.priority ?? null, gain: opts?.gain ?? null }); return origPlay(sound, opts); };
    // Visible renderables under the VFX layer (every ancestor visible, a non-zero opacity), as a
    // SET keyed by uuid, so "what appeared" is a set difference and an effect that EXPIRES in the
    // same window cannot cancel one that appeared (the first draft subtracted two counts and read
    // -23 on a frame where leftover shots from the opening died).
    window.__visSet = (near) => {
      const out = new Map();
      const wp = new (window.__stage.rig.camera.position.constructor)();
      const walk = (o, parentVis) => {
        const vis = parentVis && o.visible;
        if (!vis) return;
        if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && !(o.material && o.material.opacity === 0)
          && !(o.isInstancedMesh && o.count === 0)) {
          let ok = true;
          if (near) { o.getWorldPosition(wp); ok = Math.hypot(wp.x - near.x, wp.z - near.z) <= near.r; }
          if (ok) out.set(o.uuid, o.name || o.type);
        }
        for (const c of o.children) walk(c, vis);
      };
      window.__vfxLayer.group.updateMatrixWorld(true);
      walk(window.__vfxLayer.group, true);
      return out;
    };
    window.__newIn = (a, b) => [...b.keys()].filter((k) => !a.has(k)).map((k) => b.get(k));
    // QUIET FIRST: heal everyone and let whatever the opening frames fired die out, so the only
    // thing that can appear during a measurement is the thing being measured.
    for (const f of st.fighters) f.hp = f.maxHp;
    return { ok: true, phase: st.phase, seats: st.fighters.length, alive: st.fighters.filter((f) => f.alive).length };
  });
  const quiet = await page.evaluate(() => {
    window.__clk.pump(150, 33);
    const a = window.__visSet(); window.__clk.pump(10, 33); const b = window.__visSet();
    return { visible: b.size, appeared: window.__newIn(a, b).length, projectiles: window.__st.projectiles.length };
  });
  row('B', 'NON-VACUITY: the frozen six-seat scene is QUIET (nothing appears in 10 frames, no shots in flight)', quiet.appeared === 0 && quiet.projectiles === 0, quiet);
  row('B', 'NON-VACUITY: a live SIX-seat match, every seat alive, both consumers captured', boot.ok && boot.seats === 6 && boot.alive === 6 && boot.phase === 'playing', boot);
  if (!boot.ok) throw new Error('boot failed');

  // ── §E: every item event through both consumers, one at a time ─────────────────────────
  const CASES = [
    { item: 'springform', thrower: 0, victim: 1 },
    { item: 'warm_milk', thrower: 0, victim: 1 },
    { item: 'pompa', thrower: 0, victim: 2 },
    { item: 'squid_ink', thrower: 1, victim: 0 },
    { item: 'liquorice', thrower: 0, victim: 3 },
    { item: 'disposal', thrower: 0, victim: 4 },
    { item: 'shiitake', thrower: 0, victim: 0, resolve: true },
    { item: 'shiitake', thrower: 2, victim: 2, cancel: true },
    { item: 'tenderiser', thrower: 0, victim: 5, passive: true },
  ];
  for (const c of CASES) {
    const key = `${c.item}${c.cancel ? '_cancel' : ''}`;
    const r = await page.evaluate(async (c) => {
      const combat = await import('/src/game/combat.ts');
      const rules = await import('/src/game/rules.ts');
      const hud = await import('/src/ui/hud.ts');
      const st = window.__st; const aud = window.__aud; const feel = window.__feelDebug;
      const F = st.fighters;
      // Clear every item state from the previous case, then arrange: thrower at a fixed point,
      // victim 60 wu east, every other seat on a 170 wu ring — so the victim is the strict
      // nearest opponent and the rest are on screen.
      for (const f of F) {
        Object.assign(f.item, { sleepUntil: -Infinity, clogUntil: -Infinity, rootUntil: -Infinity, blotUntil: -Infinity, shieldUntil: -Infinity });
        f.itemCast = null; f.status.stunnedUntil = -Infinity;
        f.item.equipped = []; f.item.lastUsed = []; f.hp = f.maxHp;
      }
      const cx = 1580, cy = 1000;
      const others = F.map((_, i) => i).filter((i) => i !== c.thrower && i !== c.victim);
      F[c.thrower].x = cx; F[c.thrower].y = cy;
      if (c.victim !== c.thrower) { F[c.victim].x = cx + 60; F[c.victim].y = cy; }
      others.forEach((i, k) => { const a = Math.PI * 0.35 + (k / others.length) * Math.PI * 1.3; F[i].x = cx + Math.cos(a) * 170; F[i].y = cy + Math.sin(a) * 170; });
      F[c.thrower].facing = { x: 1, y: 0 };
      window.__clk.pump(45, 33);   // the previous case's one-shots expire
      const observer = F[0];
      const visible = F.map((f) => hud.fighterVisibleTo(st, observer, f));
      const t = F[c.thrower];
      t.item.equipped = [c.item]; t.item.lastUsed = [-Infinity];
      const per = [];
      // One event through BOTH consumers, measured synchronously (see `__visSet`).
      const route = (ev) => {
        const v0 = feel.responses.vfx; const s0 = window.__visSet();
        window.__plays = []; window.__playsOn = true;
        window.__feelEvent(ev);
        aud.handleEvents([ev], st);
        window.__playsOn = false;
        const s1 = window.__visSet();
        const born = window.__newIn(s0, s1);
        // Read BEFORE the pump: a pumped frame steps the sim, and a medikit heal or a regen
        // tick in it would be counted against this event (it was, on the base: +1 for two
        // items with no consumer at all).
        const vfx1 = feel.responses.vfx;
        window.__clk.pump(1, 33);
        const s2 = window.__visSet();
        per.push({ type: ev.type, itemId: ev.itemId, vfx: vfx1 - v0, objs: born.length,
          survive: [...s1.keys()].filter((k) => !s0.has(k) && s2.has(k)).length,
          names: [...new Set(born)].slice(0, 8), plays: window.__plays.length, pri: window.__plays.map((p) => p.pri) });
      };
      const evs = [];
      let pelletEv = null;
      if (c.passive) {
        // Tenderiser: two real weapon hits from its holder through `applyDamage`, in two VOLLEYS
        // (a later pellet of one volley is coalesced into the ring it already has — V1b's "one
        // set of hit marks per volley" — so it is measured on its own row below).
        const w = rules.CHARACTERS[t.characterId].weapons[0];
        const src = { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: t.id };
        // Volley 1 is routed IN ITS OWN TICK, as the loop would: routing both volleys after the
        // pump would hand them one `state.elapsed` and the second would (correctly) coalesce.
        const v1 = []; combat.applyDamage(st, F[c.victim], 1, null, src, v1);
        for (const ev of v1) if (ev.type.startsWith('item-')) route(ev);
        window.__clk.pump(12, 33);
        combat.applyDamage(st, F[c.victim], 1, null, src, evs);
        const extra = []; combat.applyDamage(st, F[c.victim], 1, null, src, extra);
        pelletEv = extra.find((e) => e.type === 'item-hit') ?? null;
      } else {
        combat.attemptItem(st, t, 0, evs);
        if (c.resolve && t.itemCast) { t.itemCast.resolvesAt = st.elapsed; combat.resolveDueItemCast(st, t, evs); }
        if (c.cancel && t.itemCast) {
          const w = rules.CHARACTERS[F[0].characterId].weapons[0];
          combat.applyDamage(st, t, 1, 'stun', { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: F[0].id }, evs);
        }
      }
      for (const ev of evs.filter((e) => e.type.startsWith('item-'))) route(ev);
      // The same-tick pellet: routed after the volley's first, it must draw NOTHING NEW.
      let pellet = null;
      if (pelletEv) {
        const s0 = window.__visSet(); window.__feelEvent(pelletEv); const s1 = window.__visSet();
        pellet = { stacks: pelletEv.stacks, born: window.__newIn(s0, s1).length };
      }
      // PERSISTENT: what is drawn NEAR the wearer while the state runs, minus what is drawn there
      // once it is cleared. 24 frames first, so the hit's own one-shots have expired.
      const v = F[c.victim];
      const near = () => ({ x: v.x * 0.05, z: v.y * 0.05, r: 3.5 });
      window.__clk.pump(24, 33);
      const during = window.__visSet(near());
      const st0 = { sleep: v.item.sleepUntil > st.elapsed, clog: v.item.clogUntil > st.elapsed, root: v.item.rootUntil > st.elapsed,
        blot: v.item.blotUntil > st.elapsed, shield: v.item.shieldUntil > st.elapsed, windup: t.itemCast !== null };
      Object.assign(v.item, { sleepUntil: -Infinity, clogUntil: -Infinity, rootUntil: -Infinity, blotUntil: -Infinity, shieldUntil: -Infinity });
      t.itemCast = null;
      window.__clk.pump(40, 33);
      const after = window.__visSet(near());
      const persistNames = [...during.keys()].filter((k) => !after.has(k)).map((k) => during.get(k));
      return { types: evs.map((e) => e.type), per, pellet, visible, states: st0, persist: persistNames.length, persistNames: [...new Set(persistNames)].slice(0, 8) };
    }, c);
    results.cases[key] = r;
    const items = r.per;
    row('E', `${key}: NON-VACUITY — the real sim emitted item events, thrower and victim visible to the local seat`,
      items.length > 0 && r.visible[c.thrower] && r.visible[c.victim], { types: r.types, visible: r.visible });
    for (const e of items) {
      const tag = `${key}: ${e.type}`;
      row('E', `${tag} — match.ts answers it (vfx response)`, e.vfx >= 1, e);
      row('E', `${tag} — something is DRAWN for it (renderables that appeared, and still there a frame later)`, e.objs >= 1 && e.survive >= 1, { objs: e.objs, survive: e.survive, names: e.names });
      row('E', `${tag} — the director voices it`, e.plays >= 1, { plays: e.plays, pri: e.pri });
    }
    if (r.pellet) row('E', `${key}: a second pellet of the SAME volley brightens the ring instead of stacking another`, r.pellet.born === 0 && r.pellet.stacks >= 2, r.pellet);
    const live = Object.entries(r.states).filter(([, on]) => on).map(([k]) => k);
    if (live.length) row('E', `${key}: the running state (${live.join('+')}) is drawn while it runs and gone when it ends`, r.persist >= 1, { persist: r.persist, names: r.persistNames });
  }

  // ── §P: SIX SEATS AT ONCE — every seat fires an item on the same tick, three rounds running ──
  {
    const r = await page.evaluate(async () => {
      const combat = await import('/src/game/combat.ts');
      const st = window.__st; const F = st.fighters; const layer = window.__vfxLayer;
      window.__clk.pump(45, 33);
      const kit = ['warm_milk', 'pompa', 'squid_ink', 'liquorice', 'disposal', 'springform'];
      if (!layer.itemStats) return { calls: 0, steals: null, beats: 0, hits: 0, noLayer: true };
      const s0 = { ...layer.itemStats };
      let hits = 0;
      // Two items per fighter on back-to-back ticks (both equip slots), then a third round one
      // minimum item cooldown later (SUPER_MIN_COOLDOWN_MS 2,500 ms = 76 frames): the fastest
      // cadence a six-seat match can produce. (The first version fired three per fighter 4
      // frames apart, which no loadout can reach.)
      const GAP = [2, 76, 4];
      for (let round = 0; round < 3; round++) {
        F.forEach((f, i) => {
          Object.assign(f.item, { sleepUntil: -Infinity, clogUntil: -Infinity, rootUntil: -Infinity, blotUntil: -Infinity, shieldUntil: -Infinity });
          f.itemCast = null; f.alive = true; f.hp = f.maxHp; f.status.stunnedUntil = -Infinity;
          const a = (i / F.length) * Math.PI * 2;
          f.x = 1580 + Math.cos(a) * 75; f.y = 1000 + Math.sin(a) * 75;
          f.facing = { x: -Math.cos(a), y: -Math.sin(a) };
        });
        const evs = [];
        F.forEach((f, i) => { f.item.equipped = [kit[(i + round) % kit.length]]; f.item.lastUsed = [-Infinity]; combat.attemptItem(st, f, 0, evs); });
        for (const ev of evs) if (ev.type.startsWith('item-')) { window.__feelEvent(ev); if (ev.type === 'item-hit') hits++; }
        window.__clk.pump(GAP[round], 33);
      }
      window.__clk.pump(45, 33);
      const s1 = { ...layer.itemStats };
      return { calls: s1.calls - s0.calls, steals: s1.steals - s0.steals, beats: s1.beats - s0.beats, hits };
    });
    row('P', 'NON-VACUITY: six seats x two items on back-to-back ticks, then again a cooldown later (the item pools were exercised)', r.calls > 0 && r.beats >= 18 && r.hits >= 6, r);
    row('P', 'SIX SEATS: zero item-pool steals (no effect cut short)', r.steals === 0, r);
    const kb = await page.evaluate(() => {
      window.__clk.pump(45, 33);
      const items = window.__vfxLayer.items; const pool = items?.glowRings;
      if (!pool) return { cap: null, busy: null, steals: null };   // a tree with no item layer
      const busy = pool.beats.filter((b) => b.active).length;
      const s0 = pool.steals; const cap = pool.cap;
      for (let i = 0; i < cap + 5; i++) items.glowRing(0, 1, 0, '#ffffff', 1, 2, 5, 1);
      const steals = pool.steals - s0;
      items.clear();
      return { cap, busy, steals };
    });
    row('P', 'KNOWN-BAD: forcing cap+5 rings back to back reports EXACTLY 5 steals (the counter can see one)', kb.busy === 0 && kb.steals === 5, kb);
  }

  // ── §R: Leftovers' revive — the visual beat exists (B1); the director must voice it too ──
  {
    const r = await page.evaluate(async () => {
      const combat = await import('/src/game/combat.ts');
      const rules = await import('/src/game/rules.ts');
      const st = window.__st; const aud = window.__aud; const F = st.fighters;
      for (const f of F) { f.item.equipped = []; f.item.lastUsed = []; }
      F[0].x = 1580; F[0].y = 1000; F[1].x = 1640; F[1].y = 1000; F[2].x = 1700; F[2].y = 1000;
      // Seed Leftovers on seat 0 the way createFighter does, then 1 kills 0 and 2 kills 1.
      F[0].item.equipped = ['leftovers']; F[0].item.lastUsed = [-Infinity]; F[0].item.revivesLeft = rules.ITEM_TUNING.leftovers.usesPerMatch;
      const evs = [];
      const src = (i) => { const w = rules.CHARACTERS[F[i].characterId].weapons[0]; return { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: F[i].id }; };
      combat.applyDamage(st, F[0], 9999, null, src(1), evs);
      for (const ev of evs) window.__feelEvent(ev);
      const evs2 = [];
      combat.applyDamage(st, F[1], 9999, null, src(2), evs2);
      const rev = evs2.find((e) => e.type === 'item-revived');
      let plays = null;
      if (rev) { window.__plays = []; window.__playsOn = true; aud.handleEvents([rev], st); window.__playsOn = false; plays = window.__plays.length; }
      return { revived: !!rev, alive0: F[0].alive, plays };
    });
    row('R', 'NON-VACUITY: the real kill chain fired Leftovers', r.revived && r.alive0, r);
    row('R', '`item-revived` is voiced by the director', (r.plays ?? 0) >= 1, r.plays);
  }

  // ── §I: the Squid Ink channel ────────────────────────────────────────────────────────
  {
    const r = await page.evaluate(async () => {
      const combat = await import('/src/game/combat.ts');
      const ink = await import('/src/vfx/ink.ts');
      const st = window.__st; const F = st.fighters;
      // Revive anyone the §R chain left down, so six are alive again.
      for (const f of F) { if (!f.alive) { f.alive = true; f.hp = f.maxHp; } f.item.equipped = []; f.item.lastUsed = []; f.item.blotUntil = -Infinity; }
      F[0].x = 1580; F[0].y = 1000; F[1].x = 1640; F[1].y = 1000;
      F[2].x = 1700; F[2].y = 1200; F[3].x = 1400; F[3].y = 1200; F[4].x = 1400; F[4].y = 800; F[5].x = 1760; F[5].y = 800;
      F[1].item.equipped = ['squid_ink']; F[1].item.lastUsed = [-Infinity];
      const evs = [];
      combat.attemptItem(st, F[1], 0, evs);
      for (const ev of evs) window.__feelEvent(ev);
      const hit = evs.some((e) => e.type === 'item-hit' && e.itemId === 'squid_ink' && e.targetId === F[0].id);
      window.__clk.pump(8, 33);
      // ONE REAL RENDER: the pump runs a stubbed `render`, and the reader (planted or routed) lives
      // inside the real one.
      window.__realRender(0);
      const during = { amount: ink.readInk().amount, effect: window.__stage.ink?.amount ?? null };
      F[0].item.blotUntil = st.elapsed; // expiry
      window.__clk.pump(2, 33);
      window.__realRender(0);
      const after = { amount: ink.readInk().amount, effect: window.__stage.ink?.amount ?? null };
      return { hit, blotted: true, during, after };
    });
    row('I', 'NON-VACUITY: the real Squid Ink press landed on the LOCAL seat', r.hit, r);
    row('I', 'the ink channel is WRITTEN while the local seat is blotted (readInk().amount > 0)', r.during.amount > 0, r.during);
    row('I', 'the ink channel is EXACTLY 0 once the blot expires', r.after.amount === 0, r.after);
    if (PLANT === 'ink-reader') {
      row('I', 'PLANTED READER: the post effect\'s own uniform follows the channel', r.during.effect > 0 && r.after.effect === 0, { during: r.during.effect, after: r.after.effect });
    } else {
      row('I', 'INFO: the post effect\'s uniform (stage.ts reader — ROUTED, not this package\'s file)', null, { during: r.during.effect, after: r.after.effect });
    }
  }

  // ── §C: the chick picks peck/waddle from the sim's `arrived`, not from its ground speed ──
  {
    const r = await page.evaluate(async () => {
      // A bare `import('three')` does not resolve from page context; borrow the class off a live one.
      const THREE = { Vector3: window.__stage.rig.camera.position.constructor };
      const reg = await import('/src/vfx/weapons/index.ts');
      const rules = await import('/src/game/rules.ts');
      const hook = reg.getWeaponVfx('egg', 'Hatch');
      const weapon = rules.CHARACTERS.egg.weapons.find((w) => w.key === 'Hatch');
      if (!hook?.projectile || !hook.trail || !weapon) return { ok: false };
      const run = (arrived, speedWuPerS) => {
        const ctx0 = { THREE, position: new THREE.Vector3(0, 0.5, 0), direction: new THREE.Vector3(1, 0, 0), color: '#ffffff', damage: weapon.damage, weapon, characterId: 'egg', spawnTransient: () => {} };
        const obj = hook.projectile(ctx0);
        const bob = obj.userData.__bob;
        let x = 0; let peckFrames = 0; const dt = 1 / 30; const N = 45;
        for (let i = 0; i < N; i++) {
          x += speedWuPerS * 0.05 * dt;
          hook.trail({ ...ctx0, position: new THREE.Vector3(x, 0.5, 0), object: obj, dt, arrived });
          // A peck lunges FORWARD (bob z > 0, pitch about x); a waddle rocks about z and never lunges.
          if (bob && (bob.position.z > 1e-4 || Math.abs(bob.rotation.x) > 1e-4)) peckFrames++;
        }
        return { peckFrames, frames: N, hasBob: !!bob };
      };
      return { ok: true, riding: run(true, 86), resting: run(false, 0), cruising: run(false, 160) };
    });
    row('C', 'NON-VACUITY: Egg\'s Hatch! hook has a projectile + trail and a peck rig', r.ok && r.riding?.hasBob, r);
    if (r.ok) {
      // The peck cycle lunges for ~45% of each beat and the waddle NEVER does, so "a quarter of
      // the frames lunge" separates them with margin on both sides (base: 0 of 45).
      row('C', 'an ARRIVED chick riding its victim at 86 wu/s PECKS (a quarter of frames or more lunge)', r.riding.peckFrames >= r.riding.frames * 0.25, r.riding);
      row('C', 'KNOWN-BAD: a chick still in flight at cruise speed waddles (no lunge)', r.cruising.peckFrames === 0, r.cruising);
    }
  }
  row('Z', 'no page errors', errors.length === 0, errors.slice(0, 5));
} catch (e) {
  row('Z', 'run completed', false, String(e).split('\n')[0]);
} finally {
  results.rows = rows;
  results.plantHits = plantHits;
  writeFileSync(`${OUT}/v2_items_${LABEL}.json`, JSON.stringify(results, null, 1));
  await browser.close();
}
const failed = rows.filter((r) => r.pass === false);
if (PLANT) console.log(`\nplant "${PLANT}" applied to ${plantHits} served module(s)${plantHits === 0 ? ' — VOID: the plant did not match, nothing below means anything' : ''}`);
console.log(`\n${rows.filter((r) => r.pass === true).length} passed, ${failed.length} failed (${LABEL}${PLANT ? `, plant ${PLANT}` : ''})`);
process.exit(failed.length === 0 && (!PLANT || plantHits > 0) ? 0 : 1);
