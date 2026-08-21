#!/usr/bin/env node
/**
 * SPECTATOR HUD + SPECTATOR EAR — the deterministic half.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-spv -- \
 *     node tools/tmp/spv_spec.mjs --url '{URL}'
 *   node tools/tmp/spv_spec.mjs --selftest          # §C only, no browser
 *
 * ⚠️ NEVER `:5173`, and for anything you will quote, never the working tree either —
 * four peers are live in `src/game/*.ts` and `src/vfx/**` while this runs
 * (`CLAUDE.md` rule 2 / `docs/AGENT-BRIEF.md` §3).
 *
 * ── WHY THIS EXISTS AND WHY IT IS NOT A SCREENSHOT ──────────────────────────────
 *
 * `30e3360` gave a dead player a camera that follows somebody still fighting, and
 * `tools/tmp/sv_shot.mjs` already photographs that. What it cannot photograph is the
 * half that commit could not reach, because it did not own the files:
 *
 *   * the RADAR still resolved concealment against `localFighter` while the 3D models
 *     and the floating pills resolved it against the view subject — **one rule, two
 *     implementations, disagreeing**, so a spectator could see a fighter in 3D that
 *     their own radar was hiding;
 *   * the HUD went on addressing a corpse in the second person — a lit weapon tray and
 *     `REACHES YOU 0:28` measured from a body that cannot move;
 *   * the EAR stayed on the corpse, so every voice panned around an empty patch of
 *     floor while the frame showed a firefight up to 2 000 wu away.
 *
 * Every one of those is invisible in an ordinary frame and **two of the three are
 * invisible in ANY frame** — the audio has no pixels, and the radar disagreement only
 * expresses itself when a fighter happens to be standing under a plate with one
 * observer inside `CONCEAL_REVEAL_RADIUS` and the other outside it. Waiting for a real
 * match to produce that arrangement is how an arm goes green by never being asked the
 * question (`CLAUDE.md` rule 6: `[].every()` returns `true`). So the fixtures here are
 * BUILT to express each defect, and every one of them asserts that it DOES before it
 * asserts anything about the fix.
 *
 * ── ARMS ────────────────────────────────────────────────────────────────────────
 *
 *   A  THE HUD, on a real six-seat `MatchState` from `createMatch`, driven through the
 *      real `createHud` in a real DOM. Not `hud_harness.html`: that harness is missing
 *      `index.html`'s `* { box-sizing: border-box }` and lays every plate out 12% wide,
 *      which is documented in `hud_accept.mjs`'s header as having produced a whole
 *      generation of wrong geometry. Nothing here measures geometry — it reads classes
 *      and text — but the harness is still the wrong document to read them from.
 *   B  THE EAR, on the real `MatchAudio` with a RECORDING engine, so the observable is
 *      exactly the `{pan, gain}` the audio engine is handed. `place()` is private and
 *      is never called directly; every number below is read off a dispatched
 *      `GameEvent`, which is what the game does.
 *   C  STRUCTURAL — the one identity claim with no observable. `match-end`'s `won`
 *      picks between two `SoundFn` closures and nothing downstream tells them apart, so
 *      it is asserted on the source with a planted known-bad instead of being left out.
 *      Runs with `--selftest` too, i.e. without a browser.
 *
 * ── THE KNOWN-BADS, one per claim ───────────────────────────────────────────────
 * Every green row below is paired with an input that makes it RED. Where a known-bad
 * would need code that does not exist, the SHIPPED API is used to build it: a director
 * constructed with `listenerId: k` is exactly the collapsed one-field spelling this
 * pass replaced, so it stands in for "the fix was never made" without patching a file.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const SELFTEST = argv.includes('--selftest');
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ok   - ${name}${detail ? ` · ${detail}` : ''}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? ` · ${detail}` : ''}`); }
  return !!ok;
}
const section = (t) => console.log(`\n${t}`);

// ═════════════════════════════════════════════════════════════════════════════
// PAGE-SIDE: arm A — the HUD
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Built as a source string and evaluated, rather than passed as a function, because it
 * needs top-level `await import()` of the app's own TypeScript through Vite — the same
 * mechanism `tools/audio-probe.mjs` uses.
 */
const PAGE_HUD = async () => {
  const sim = await import('/src/game/sim.ts');
  const hudMod = await import('/src/ui/hud.ts');
  const rules = await import('/src/game/rules.ts');
  const roster = await import('/src/game/roster.ts');

  // ── THE FIXTURE ─────────────────────────────────────────────────────────────
  // A real `createMatch` state on a synthetic arena, so every field the HUD reads is
  // the shape the sim produces. The arena is the ×4 shipped geometry out of
  // `arena/shared.ts`'s numbers, plus ONE concealment box — the shipped kitchen has
  // fourteen, but a fixture that inherits them cannot say where its fighters are
  // standing relative to any of them.
  const CONCEAL = { x: 2400, y: 1700, w: 200, h: 200, kind: 'spv-fixture' };
  const arena = {
    id: 'spv', displayName: 'spv', width: 2800, height: 2000,
    center: { x: 1400, y: 1000 }, maxSafeRadius: 900,
    playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 2600, y: 1800 },
    cover: [], hazards: [], concealment: [CONCEAL], build() { return {}; },
  };
  const IDS = ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'];

  // slot 0  LOCAL, 600 wu from the arena centre: inside the ring and outside its floor,
  //         which is the only band in which the old copy produces "REACHES YOU".
  // slot 1  THE HIDDEN ONE, standing in the middle of the concealment box.
  // slot 2  THE SPECTATED ONE, 70 wu from slot 1 — inside CONCEAL_REVEAL_RADIUS (84).
  // 3,4,5   elsewhere, alive, so the roster is a real six.
  const P = [
    { x: 2000, y: 1000 }, { x: CONCEAL.x, y: CONCEAL.y }, { x: CONCEAL.x + 70, y: CONCEAL.y },
    { x: 400, y: 400 }, { x: 400, y: 1600 }, { x: 1400, y: 400 },
  ];
  // `spawn` per fighter, because `ArenaDefinition` declares two spawns and `createMatch`
  // refuses to invent the other four (`DECISIONS §48` — spawn placement is a fairness
  // constraint `src/arena/**` owns). Positions are then the fixture's, not the arena's.
  const state = sim.createMatch(arena, IDS.map((characterId, i) => ({ characterId, spawn: P[i] })));
  state.fighters.forEach((f, i) => { f.x = P[i].x; f.y = P[i].y; f.revealedUntil = -1; });
  state.phase = 'playing';
  state.elapsed = 10_000;
  state.safeRadius = 800;
  state.brokenConcealment = [];

  const seatFloor = rules.minSafeRadiusFor(state.fighters.length);
  const dist0 = Math.hypot(P[0].x - arena.center.x, P[0].y - arena.center.y);
  // Put the edge's arrival exactly 1 000 ms away, so `is-imminent` is unambiguously in
  // its alarm band (the lead is the time the edge takes to cross FAIR_PLAY.radiusUnits,
  // ~13 s on this schedule) without this file re-deriving the lead.
  const playMs = rules.fogReachesRadiusAt(dist0, arena.maxSafeRadius, seatFloor) - 1000;
  state.timeRemaining = rules.MATCH_DURATION_MS - playMs;

  // ── THE HUD ─────────────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'spv-host';
  document.body.appendChild(host);
  const hud = hudMod.createHud(host, { onRestart() {}, onSelectWeapon() {} });
  hud.setCharacters(IDS);

  const q = (sel) => host.querySelector(sel);
  const qa = (sel) => Array.from(host.querySelectorAll(sel));
  const shown = (el) => !!el && getComputedStyle(el).display !== 'none';
  const blipShown = (slot) => {
    const key = roster.slotKey(slot);
    const dot = q(`[data-el="radar-${key}"]`) ?? qa('.hud-radar-blip')[slot] ?? null;
    return dot ? getComputedStyle(dot).display !== 'none' : null;
  };

  /** One `hud.update` and everything this file reads back off the DOM. */
  const render = (frame, mutate) => {
    const undo = [];
    if (mutate) mutate(state, undo);
    hud.update(state, { selectedWeapon: 0, ...frame });
    const out = {
      blip1: blipShown(1),
      blip2: blipShown(2),
      trayInert: q('.hud-weapons')?.classList.contains('is-inert') ?? null,
      ready: qa('.hud-weapon-slot.is-ready').length,
      selected: qa('.hud-weapon-slot.is-selected').length,
      slots: qa('.hud-weapon-slot').length,
      timers: qa('.hud-weapon-timer').map((e) => e.textContent ?? ''),
      zoneValue: q('[data-el="zone-value"]')?.textContent ?? null,
      zoneLabel: q('[data-el="zone-label"]')?.textContent ?? null,
      imminent: q('[data-el="zone"]')?.classList.contains('is-imminent') ?? null,
      danger: q('[data-el="zone"]')?.classList.contains('is-danger') ?? null,
      capOn: q('.hud-spectate')?.classList.contains('is-on') ?? null,
      capShown: shown(q('.hud-spectate')),
      capText: q('.hud-spectate')?.textContent ?? null,
    };
    while (undo.length) undo.pop()();
    return out;
  };

  const kill0 = (s, undo) => { const was = s.fighters[0].alive; s.fighters[0].alive = false; undo.push(() => { s.fighters[0].alive = was; }); };
  const ended = (s, undo) => { const was = s.phase; s.phase = 'ended'; s.winnerId = 2; undo.push(() => { s.phase = was; }); };
  const atFloor = (s, undo) => { const was = s.safeRadius; s.safeRadius = seatFloor; undo.push(() => { s.safeRadius = was; }); };

  // The predicate, asked directly, at the two candidate observers. This is the
  // NON-VACUITY reading: if these two agree, the fixture cannot express the defect and
  // every DOM row below would be green for the wrong reason.
  const vis = (obs, tgt) => hudMod.fighterVisibleTo(state, state.fighters[obs], state.fighters[tgt]);

  const out = {
    revealRadius: rules.CONCEAL_REVEAL_RADIUS,
    d_local_to_hidden: Math.hypot(P[0].x - P[1].x, P[0].y - P[1].y),
    d_sub_to_hidden: Math.hypot(P[2].x - P[1].x, P[2].y - P[1].y),
    visFromLocal: vis(0, 1),
    visFromSubject: vis(2, 1),
    charName2: rules.CHARACTERS[IDS[2]].name,
    seatFloor,
    safeRadius: state.safeRadius,
    // dead + the subject supplied — what runs once `match.ts` is wired
    deadWithSubject: render({ observerSlot: 2 }, kill0),
    // dead + the socket EMPTY — what runs today, and the `?? LOCAL_SLOT` fallback
    deadNoSubject: render({}, kill0),
    // dead + an explicit null, which is a legal value of the field
    deadNullSubject: render({ observerSlot: null }, kill0),
    // dead + the subject pinned back to the local seat: the known-bad for the radar rows
    deadSubjectLocal: render({ observerSlot: 0 }, kill0),
    // dead + an out-of-range slot: must fall back, not throw
    deadSubjectOOR: render({ observerSlot: 99 }, kill0),
    // dead + the ring already at its floor
    deadAtFloor: render({ observerSlot: 2 }, (s, u) => { kill0(s, u); atFloor(s, u); }),
    // ALIVE — the control arm, and the known-bad for every "dead" row
    alive: render({ observerSlot: 0 }),
    // ended + dead: the result card owns the screen
    endedDead: render({ observerSlot: 2 }, (s, u) => { kill0(s, u); ended(s, u); }),
  };
  host.remove();
  return out;
};

// ═════════════════════════════════════════════════════════════════════════════
// PAGE-SIDE: arm B — the ear
// ═════════════════════════════════════════════════════════════════════════════

const PAGE_AUDIO = async () => {
  const sim = await import('/src/game/sim.ts');
  const director = await import('/src/audio/director.ts');
  const prox = await import('/src/proximity.ts');

  const arena = {
    id: 'spv', displayName: 'spv', width: 2800, height: 2000,
    center: { x: 1400, y: 1000 }, maxSafeRadius: 900,
    playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 2600, y: 1800 },
    cover: [], hazards: [], build() { return {}; },
  };
  const IDS = ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'];
  // Ring spawns, for the same reason as arm A: `createMatch` refuses to invent slots 2+.
  const spawnOf = (i) => ({
    x: arena.center.x + 500 * Math.cos((i / IDS.length) * Math.PI * 2),
    y: arena.center.y + 500 * Math.sin((i / IDS.length) * Math.PI * 2),
  });
  const state = sim.createMatch(arena, IDS.map((characterId, i) => ({ characterId, spawn: spawnOf(i) })));
  state.phase = 'playing';
  state.elapsed = 10_000;

  const LOCAL = 0;
  const FAR = 2;
  // The local seat and the fighter the camera hands you are 1 200 wu apart — beyond
  // `SFX_FADE_WU` (900), so the curve reads exactly 0 from one and exactly 1 from the
  // other. Chosen so the two arms cannot be told apart by a rounding argument.
  state.fighters[LOCAL].x = 400; state.fighters[LOCAL].y = 1000;
  state.fighters[FAR].x = 1600; state.fighters[FAR].y = 1000;

  /**
   * A RECORDING ENGINE. `MatchAudio` only ever calls `engine.play(sound, opts)`, so this
   * is the whole surface — and `opts` is the observable: it is literally what the audio
   * engine is handed, not an internal this file reached into. (`place()` is private; it
   * is never called here.)
   */
  const mkEngine = () => { const rec = []; return { rec, play(_s, o) { rec.push(o ?? {}); return true; } }; };

  /** Dispatch one event through the REAL director and return the recorded options. */
  const dispatch = (md, eng, ev) => { eng.rec.length = 0; md.handleEvents([ev], state); return eng.rec.slice(); };
  // `amount` above REGEN_AMOUNT so the heal throttle can never swallow it, and `heal`
  // is chosen because it is the one event whose ONLY gain input is `place()`.
  const healAt = (slot) => ({ type: 'heal', fighterRole: slot === 0 ? 'player' : 'enemy', fighterId: slot, amount: 25 });
  const deathOf = (slot) => ({ type: 'death', fighterRole: slot === 0 ? 'player' : 'enemy', fighterId: slot });
  const hitOn = (slot) => ({
    type: 'hit-landed', targetRole: slot === 0 ? 'player' : 'enemy', targetId: slot,
    amount: 5, effect: null,
    // `DamageSource`'s weapon arm, exactly: kind / weaponKey / weaponName / attackerId.
    source: { kind: 'weapon', weaponKey: 'Smash', weaponName: 'Patty Smash', attackerId: 1 },
    x: state.fighters[slot].x, y: state.fighters[slot].y,
  });
  /**
   * ⚠️ BY KEY, NEVER BY POSITION. `handleEvents` also runs the ambience bed and the
   * ring-floor latch, and both can add a voice to the same batch — `rec[0]` would
   * silently become the kitchen bed on the first dispatch and every gain below would be
   * about the wrong sound. The `death` voice is the one row with a `pan` and no `key`
   * (`ringFloor` / `matchEnd` / `countdownTick` carry neither).
   */
  const gainOf = (rows, key) => {
    const r = key ? rows.find((o) => o.key === key) : rows.find((o) => !o.key && o.pan !== undefined);
    return r ? r.gain : undefined;
  };

  // ── the shipped director, ear where it starts ────────────────────────────────
  const eng = mkEngine();
  const md = new director.MatchAudio(eng);
  // PRIME. The ambience bed fires on the first playing tick (`nextAmbienceAt` starts at
  // -Infinity) and the ring-floor latch resolves on the first `watchZone`; both are
  // once-per-match and neither is what this arm measures. Discarded deliberately rather
  // than filtered out twice.
  const primed = dispatch(md, eng, healAt(LOCAL));

  const beforeFar = dispatch(md, eng, healAt(FAR));
  const beforeLocal = dispatch(md, eng, healAt(LOCAL));
  md.setListener(FAR);
  const afterFar = dispatch(md, eng, healAt(FAR));
  const afterLocal = dispatch(md, eng, healAt(LOCAL));

  // ── B3: walk a voice out from the listener and compare to the SHIPPED curve ──
  const STATIONS = [0, 100, 200, 300, 470, 600, 750, 900, 1200];
  const sweep = (listener) => {
    md.setListener(listener);
    const me = state.fighters[listener];
    const probe = state.fighters[4];
    const sx = probe.x; const sy = probe.y;
    const rows = STATIONS.map((d) => {
      probe.x = me.x; probe.y = me.y + d;             // pan 0 by construction, dist === d
      const g = gainOf(dispatch(md, eng, healAt(4)), 'heal');
      return { d, got: g, want: prox.proximityGain(d, prox.SFX_FULL_WU, prox.SFX_FADE_WU) };
    });
    probe.x = sx; probe.y = sy;
    return rows;
  };
  const sweepLocal = sweep(LOCAL);
  const sweepFar = sweep(FAR);

  // ── B4/B5: identity did not travel with the ear ──────────────────────────────
  md.setListener(FAR);
  // A THIRD party, parked exactly 470 wu from the ear — the camera's worst-case ground
  // reach, one of `proximity.ts`'s three named landmarks, where the curve reads 0.668.
  // It has to be a third fighter: a death ON the listener is at distance 0 and reads
  // 1.000 legitimately, which is indistinguishable from the identity override.
  const THIRD = 4;
  const D3 = 470;
  state.fighters[THIRD].x = state.fighters[FAR].x;
  state.fighters[THIRD].y = state.fighters[FAR].y + D3;
  const deathLocal = dispatch(md, eng, deathOf(LOCAL));
  const deathFar = dispatch(md, eng, deathOf(FAR));
  const deathThird = dispatch(md, eng, deathOf(THIRD));
  const hitFar = dispatch(md, eng, hitOn(FAR));
  const hitLocal = dispatch(md, eng, hitOn(LOCAL));

  // KNOWN-BAD FOR THE `gain: undefined` DEFECT, demonstrated rather than asserted about.
  // The old line was `gain: <cond> ? 1 : undefined` after `...at`; this is that expression
  // with the condition false, and it shows the spread being overwritten. `engine.ts`
  // resolves the result with `opts.gain ?? 1`, i.e. FULL LEVEL.
  const spreadDemo = { ...{ pan: 0, gain: 0.394 }, gain: undefined };

  // ── B6: reset() brings the ear home ──────────────────────────────────────────
  md.reset();
  const afterResetLocal = dispatch(md, eng, healAt(LOCAL));
  const afterResetFar = dispatch(md, eng, healAt(FAR));

  // ── THE KNOWN-BAD: the collapsed one-field spelling, built from the SHIPPED API.
  // `listenerId: FAR` sets ear AND identity to the same slot, which is exactly what the
  // class did before this pass split them. Every identity row above must flip here.
  const kbEng = mkEngine();
  const kbMd = new director.MatchAudio(kbEng, { listenerId: FAR });
  const kbDeathFar = dispatch(kbMd, kbEng, deathOf(FAR));
  const kbDeathLocal = dispatch(kbMd, kbEng, deathOf(LOCAL));
  const kbHitFar = dispatch(kbMd, kbEng, hitOn(FAR));

  const dFar = Math.hypot(state.fighters[FAR].x - state.fighters[LOCAL].x,
    state.fighters[FAR].y - state.fighters[LOCAL].y);

  return {
    fadeWU: prox.SFX_FADE_WU, fullWU: prox.SFX_FULL_WU, dFar,
    gainAtFar: prox.proximityGain(dFar, prox.SFX_FULL_WU, prox.SFX_FADE_WU),
    beforeFar: gainOf(beforeFar, 'heal'), beforeLocal: gainOf(beforeLocal, 'heal'),
    afterFar: gainOf(afterFar, 'heal'), afterLocal: gainOf(afterLocal, 'heal'),
    nBefore: beforeFar.length, nPrimed: primed.length,
    primedKeys: primed.map((o) => o.key ?? '(none)').join(','),
    sweepLocal, sweepFar,
    deathLocalGain: gainOf(deathLocal), deathFarGain: gainOf(deathFar),
    deathThirdGain: gainOf(deathThird), d3: D3,
    wantThird: prox.proximityGain(D3, prox.SFX_FULL_WU, prox.SFX_FADE_WU),
    spreadDemoGain: spreadDemo.gain, spreadDemoHasKey: 'gain' in spreadDemo,
    spreadDemoResolved: spreadDemo.gain ?? 1,
    hurtOnFar: hitFar.some((o) => o.key === 'hurt'),
    hurtOnLocal: hitLocal.some((o) => o.key === 'hurt'),
    resetLocal: gainOf(afterResetLocal, 'heal'), resetFar: gainOf(afterResetFar, 'heal'),
    kbDeathFarGain: gainOf(kbDeathFar), kbDeathLocalGain: gainOf(kbDeathLocal),
    kbHurtOnFar: kbHitFar.some((o) => o.key === 'hurt'),
    panFarFromLocal: (beforeFar[0] ?? {}).pan, panLocalFromFar: (afterLocal[0] ?? {}).pan,
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// ARM C — structural, and why one claim has to be
// ═════════════════════════════════════════════════════════════════════════════

/**
 * `handleEvents`' `match-end` case decides between `S.matchEnd(true)` and
 * `S.matchEnd(false)`. Both are freshly-allocated closures handed straight to
 * `engine.play`, and the recorded options are IDENTICAL either way — no key, no gain, no
 * pan, only `priority`. So there is no observable, and the honest options were to leave
 * the claim unasserted or to assert it on the source. It is asserted on the source, with
 * a planted known-bad, and this comment is here so nobody mistakes it for the strong
 * kind of arm: it proves the line says `localSlot`, not that saying `localSlot` produces
 * the right sting.
 */
/**
 * 🚨 COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT HYGIENE — IT IS THE FIRST BUG THIS ARM
 * HAD. This repo's house rule is that a reversed line is KEPT ABOVE ITS REPLACEMENT with
 * the reason, so `director.ts` now carries the literal text
 * `const won = … === this.listenerSlot;` in a comment three lines above the code that
 * says `localSlot`. A regex over the raw file finds the COMMENT first and reports the
 * pre-fix spelling on a correctly fixed file — a false RED, which is the cheap direction,
 * but the same mechanism reports a false GREEN the moment a comment quotes the fixed
 * line above broken code. `C0b` asserts the stripper actually removed that quote.
 */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function armC() {
  section('C  STRUCTURAL — the identity claim with no observable');
  const raw = readFileSync(join(REPO, 'src/audio/director.ts'), 'utf8');
  const src = stripComments(raw);

  // The four sites, and which field each must read. Anchored on the EXPRESSION, not on a
  // line number: line numbers in this file have moved every session.
  const WON = /const won = slotOf\(ev\.winnerId, ev\.winner\) === this\.(\w+);/;
  const DEATH = /gain: slotOf\(ev\.fighterId, ev\.fighterRole\) === this\.(\w+) \? 1 : at\.gain,/;
  const HURT = /if \(targetSlot === this\.(\w+)\) \{/;
  const PLACE = /const me = fightersOf\(state\)\[this\.(\w+)\] \?\? state\.player;/;

  const read = (re, s = src) => { const m = re.exec(s); return m ? m[1] : null; };

  // NON-VACUITY FIRST: a regex that matches nothing would make every row below pass by
  // comparing null to null.
  const found = [['won', WON], ['death', DEATH], ['hurt', HURT], ['place', PLACE]]
    .map(([n, re]) => [n, read(re)]);
  check('C0 all four call sites were located in the source',
    found.every(([, v]) => v !== null), found.map(([n, v]) => `${n}=${v}`).join(' '));
  // NON-VACUITY OF THE STRIPPER, in both directions: the pre-fix spelling must be present
  // in the raw file (or this guard is protecting against nothing and would keep passing if
  // the stripper broke) and absent after stripping.
  const quoted = /const won = slotOf\(ev\.winnerId, ev\.winner\) === this\.listenerSlot;/;
  check('C0b the kept-above-the-fix quote of the OLD line is in the file and is stripped',
    quoted.test(raw) && !quoted.test(src),
    'raw contains it, stripped source does not — without this C1 reads the comment');

  check('C1 match-end "won" reads the IDENTITY field', read(WON) === 'localSlot');
  check('C2 the own-death full-gain override reads the IDENTITY field', read(DEATH) === 'localSlot');
  check('C3 the "you are being hit" layer reads the IDENTITY field', read(HURT) === 'localSlot');
  check('C4 place() — the ONLY spatial site — reads the LISTENER field', read(PLACE) === 'listenerSlot');

  // KNOWN-BAD: the pre-split spelling. Each arm must go RED on it, or it is a comment
  // with a tick next to it.
  const kb = src.replace(WON, 'const won = slotOf(ev.winnerId, ev.winner) === this.listenerSlot;');
  check('C5 KNOWN-BAD: the pre-split spelling on the match-end line IS detected',
    kb !== src && read(WON, kb) === 'listenerSlot', 'so C1 is a measurement, not a tautology');
  const kb2 = src.replace(PLACE, 'const me = fightersOf(state)[this.localSlot] ?? state.player;');
  check('C6 KNOWN-BAD: an ear pinned to the identity field IS detected',
    kb2 !== src && read(PLACE, kb2) === 'localSlot', 'so C4 is a measurement');

  // The field declarations themselves: one mutable ear, one readonly identity. A second
  // writer to `localSlot` would defeat every row above without touching any of them.
  const decls = src.match(/^\s*private (readonly )?(listenerSlot|localSlot): number;$/gm) ?? [];
  check('C7 exactly two fields are declared, and only the EAR is mutable',
    decls.length === 2
    && decls.some((d) => /private listenerSlot: number;/.test(d))
    && decls.some((d) => /private readonly localSlot: number;/.test(d)),
    decls.map((d) => d.trim()).join(' | '));
  const writers = (src.match(/this\.listenerSlot\s*=/g) ?? []).length;
  check('C8 the ear has exactly three writers — constructor, setListener, reset',
    writers === 3, `${writers} assignments`);
  check('C9 nothing assigns to the identity field outside the constructor',
    (src.match(/this\.localSlot\s*=/g) ?? []).length === 1);
}

// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('spv_spec — the spectator HUD and the spectator ear, on forced fixtures');
  if (SELFTEST) {
    armC();
    console.log(`\nspv_spec --selftest: ${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  }
  if (!BASE || /:5173(\/|$)/.test(BASE)) {
    console.error('spv_spec: --url (or PREVIEW_BASE) is required and must be a SNAPSHOT, never :5173.');
    process.exit(2);
  }
  console.log(`  base ${BASE}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // A peer's save must not reload the page mid-run.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
      + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
      + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
      + 'export const ErrorOverlay=class{};export default {};',
  }));
  // Warm the dep optimiser first: a fresh snapshot's FIRST client eats a reload that
  // presents as `execution context was destroyed` (AGENT-BRIEF §3).
  await page.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // ── A ────────────────────────────────────────────────────────────────────────
  section('A  THE HUD — a six-seat state, one concealment box, the real createHud');
  const A = await page.evaluate(PAGE_HUD);
  console.log(`    CONCEAL_REVEAL_RADIUS ${A.revealRadius} wu · corpse→hidden ${A.d_local_to_hidden.toFixed(2)} wu`
    + ` · subject→hidden ${A.d_sub_to_hidden.toFixed(2)} wu`);
  console.log(`    zone: dead "${A.deadWithSubject.zoneValue}" · alive "${A.alive.zoneValue}"`
    + ` · dead@floor "${A.deadAtFloor.zoneValue}"`);
  console.log(`    caption: subject "${A.deadWithSubject.capText}" · no-subject "${A.deadNoSubject.capText}"`
    + ` · alive "${A.alive.capText}"`);

  // 🚨 NON-VACUITY, BEFORE ANYTHING ELSE. If the two candidate observers agree about the
  // hidden fighter, this fixture cannot express the defect and every radar row below
  // would be green for a reason that has nothing to do with the fix.
  const expressible = check('A0 THE DEFECT IS EXPRESSIBLE IN THIS FIXTURE — the two observers DISAGREE',
    A.visFromLocal === false && A.visFromSubject === true,
    `visible from the corpse ${A.visFromLocal}, from the subject ${A.visFromSubject}`);
  check('A0b …and the fixture really seats a full weapon tray',
    A.alive.slots === 4, `${A.alive.slots} slots`);

  if (expressible) {
    check('A1 with the subject supplied, the radar SHOWS the fighter the camera is watching hide-mate',
      A.deadWithSubject.blip1 === true, `blip(slot 1) shown=${A.deadWithSubject.blip1}`);
    check('A2 KNOWN-BAD: the subject pinned back to the local seat HIDES it again',
      A.deadSubjectLocal.blip1 === false, 'so A1 is caused by the observer and nothing else');
    check('A3 the EMPTY socket falls back to LOCAL_SLOT — unchanged from before this change',
      A.deadNoSubject.blip1 === false && A.deadNullSubject.blip1 === false,
      'omitted and explicit-null agree; this is what runs until match.ts supplies the slot');
    check('A4 an OUT-OF-RANGE slot falls back instead of throwing',
      A.deadSubjectOOR.blip1 === false, 'observerSlot=99');
  }

  check('A5 the tray goes INERT for a dead local seat',
    A.deadWithSubject.trayInert === true && A.deadWithSubject.ready === 0
    && A.deadWithSubject.selected === 0 && A.deadWithSubject.timers.every((t) => t === ''),
    `inert=${A.deadWithSubject.trayInert} ready=${A.deadWithSubject.ready} selected=${A.deadWithSubject.selected}`);
  check('A6 KNOWN-BAD: the SAME fixture with the local seat alive lights the tray',
    A.alive.trayInert === false && A.alive.ready > 0 && A.alive.selected === 1,
    `inert=${A.alive.trayInert} ready=${A.alive.ready} selected=${A.alive.selected}`);

  check('A7 the zone pill stops addressing a person once you are dead',
    !/YOU/i.test(A.deadWithSubject.zoneValue ?? '') && A.deadWithSubject.zoneValue === 'CLOSING',
    `"${A.deadWithSubject.zoneValue}"`);
  check('A8 KNOWN-BAD: the SAME position and clock, alive, DOES say REACHES YOU',
    /^REACHES YOU \d/.test(A.alive.zoneValue ?? ''),
    `"${A.alive.zoneValue}" — so A7 is not green because the string is unreachable`);
  check('A9 …and the ring-only FINAL RING branch is reachable while dead',
    A.deadAtFloor.zoneValue === 'FINAL RING', `safeRadius==floor ${A.seatFloor.toFixed(2)}`);
  check('A10 the imminent alarm is OFF while dead and ON alive at the same spot',
    A.deadWithSubject.imminent === false && A.alive.imminent === true,
    `dead=${A.deadWithSubject.imminent} alive=${A.alive.imminent}`);

  check('A11 the caption NAMES the fighter being watched',
    A.deadWithSubject.capOn === true && A.deadWithSubject.capShown === true
    && new RegExp(`spectating ${A.charName2}`, 'i').test(A.deadWithSubject.capText ?? ''),
    `"${A.deadWithSubject.capText}" (slot 2 is ${A.charName2})`);
  check('A12 with the socket empty it claims only what the HUD can see',
    /^eliminated$/i.test(A.deadNoSubject.capText ?? ''), `"${A.deadNoSubject.capText}"`);
  check('A13 KNOWN-BAD: alive, the caption has no box and no text',
    A.alive.capOn === false && A.alive.capShown === false && A.alive.capText === '',
    'so A11/A12 are not green on an element that is always on');
  check('A14 …and it is gone once the result card owns the screen',
    A.endedDead.capOn === false && A.endedDead.capShown === false);

  // ── B ────────────────────────────────────────────────────────────────────────
  section('B  THE EAR — the real director, a recording engine, the shipped curve');
  const B = await page.evaluate(PAGE_AUDIO);
  console.log(`    local↔subject ${B.dFar.toFixed(2)} wu · SFX_FULL ${B.fullWU} · SFX_FADE ${B.fadeWU}`
    + ` · the curve there reads ${B.gainAtFar.toFixed(3)}`);
  console.log(`    heal on the SUBJECT:  ear at the corpse ${B.beforeFar}  →  ear on the subject ${B.afterFar}`);
  console.log(`    heal at the CORPSE:   ear at the corpse ${B.beforeLocal}  →  ear on the subject ${B.afterLocal}`);

  check('B0 the dispatch produced a placed voice, with numbers on it',
    B.nBefore === 1 && typeof B.beforeFar === 'number' && typeof B.panFarFromLocal === 'number',
    `${B.nBefore} voice(s) after priming; the prime itself carried ${B.nPrimed} [${B.primedKeys}]`);
  check('B1 THE DEFECT: with the ear on the corpse, the fight on screen is SILENT',
    B.beforeFar === 0 && B.beforeLocal === 1,
    `${B.dFar.toFixed(0)} wu is beyond SFX_FADE_WU ${B.fadeWU}, so the curve is exactly 0`);
  check('B2 …and setListener puts the ear where the camera is',
    B.afterFar === 1 && B.afterLocal === 0, 'the corpse is now the distant thing, which it is');
  check('B3 the pan follows too, and it REVERSES',
    B.panFarFromLocal > 0 && B.panLocalFromFar < 0,
    `${B.panFarFromLocal.toFixed(3)} → ${B.panLocalFromFar.toFixed(3)}`);

  const sweepOk = (rows) => rows.every((r) => typeof r.got === 'number' && Math.abs(r.got - r.want) < 1e-12);
  const distinct = (rows) => new Set(rows.map((r) => r.got)).size;
  check('B4a NON-VACUITY: the sweep is not one flat value',
    distinct(B.sweepLocal) >= 4 && distinct(B.sweepFar) >= 4,
    `${distinct(B.sweepLocal)} / ${distinct(B.sweepFar)} distinct gains over ${B.sweepLocal.length} stations`);
  check('B4 THE FALLOFF IS MEASURED FROM THE LISTENER — exact against the shipped curve, at BOTH ears',
    sweepOk(B.sweepLocal) && sweepOk(B.sweepFar),
    B.sweepFar.map((r) => `${r.d}:${r.got.toFixed(3)}`).join(' '));

  check('B5 your OWN death is still full level after the ear moves',
    B.deathLocalGain === 1, `gain ${B.deathLocalGain} at ${B.dFar.toFixed(0)} wu from the ear`);
  check('B5b …and a death ON the ear reads 1 too, because it is at distance 0 — not the override',
    B.deathFarGain === 1, 'stated so it is not mistaken for the identity rule firing');
  check('B6 A THIRD PARTY\'S DEATH TAKES THE FALLOFF — the pre-existing `gain: undefined` defect',
    typeof B.deathThirdGain === 'number' && Math.abs(B.deathThirdGain - B.wantThird) < 1e-12
    && B.deathThirdGain > 0 && B.deathThirdGain < 1,
    `${B.d3} wu → ${B.deathThirdGain?.toFixed(3)} (curve says ${B.wantThird.toFixed(3)})`);
  check('B6b KNOWN-BAD: the OLD expression, run here — an explicit `gain: undefined` OVERWRITES the spread',
    B.spreadDemoHasKey === true && B.spreadDemoGain === undefined && B.spreadDemoResolved === 1,
    'and engine.ts:playInner reads `opts.gain ?? 1`, so every remote death played at 1.000');
  check('B7 KNOWN-BAD: the collapsed one-field spelling makes YOUR OWN death silent',
    B.kbDeathLocalGain === 0 && B.kbDeathFarGain === 1,
    'listenerId:FAR — exactly what one field meant; B5 flips from 1 to 0 on it');
  check('B8 the "you are being hit" layer stays on the local seat',
    B.hurtOnLocal === true && B.hurtOnFar === false);
  check('B9 KNOWN-BAD: the collapsed spelling moves it to the spectated fighter',
    B.kbHurtOnFar === true, 'so B8 is a measurement');
  check('B10 reset() brings the ear home for match two',
    B.resetLocal === 1 && B.resetFar === 0, `local ${B.resetLocal} / far ${B.resetFar}`);

  check('B11 no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();

  // ── C ────────────────────────────────────────────────────────────────────────
  armC();

  console.log(`\nspv_spec: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
