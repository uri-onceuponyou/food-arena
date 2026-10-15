#!/usr/bin/env node
/**
 * RV_CAPTURE — the graphics campaign's CANONICAL FRAME SET, as one re-runnable command.
 * Protocol `rv/1`. Owner of the `rv_` prefix; scratch output lives under `shots/rv/`.
 * The full protocol, its measured noise and every caveat: `shots/rv/r0/PROTOCOL.md`.
 *
 *   node tools/tmp/sx_snap.mjs --root <detached worktree> -- \
 *     node tools/tmp/rv_capture.mjs --url '{URL}' --tree <same worktree> --out <dir>
 *
 * Writes, each with a `.capture.json` sidecar that `tools/review.mjs` vouches for:
 *
 *   arena.png         1600x900  1v1 ACTION frame at the shipped match camera. q1_capture's
 *                               matchup (donut v taco), anchor, band and leash, frame chosen
 *                               by a deterministic SIM-side rule.
 *   arena6.png        1600x900  SIX-seat action frame: >=3 living fighters in the safe frame
 *                               and a fresh hit. Reached by the SHIPPED route: home -> the
 *                               mode block -> lobby -> "6" -> Start.
 *   cast.png          720x405   `q1_crops.mjs`'s cast crop of arena.png (subprocess).
 *   home.png          1600x900  home, q1_capture's SEEDED_PROFILE (a played account).
 *   select.png        1600x900  character select, same profile, all portraits painted.
 *   home_phone.png    2556x1179 the same two screens at the menu PLATES' own geometry
 *   select_phone.png  2556x1179 (852x393 CSS @ DPR 3, `shots/baseline3`'s precedent).
 *
 * plus `capture-report.json` and `trace_<match>.json` (every control step of each match).
 *
 * ── DETERMINISM: the page runs on a VIRTUAL CLOCK (RV_INIT) ────────────────────────
 *   * `performance.now`, `Date`, `setTimeout/Interval`, `requestAnimationFrame` and
 *     `requestIdleCallback` are replaced before any page script runs. Time moves only in
 *     16 ms frames; a frame runs due timers in (time, id) order, then the rAF queue.
 *   * CSS: CDP `Animation.setPlaybackRate(0)` freezes the DOCUMENT timeline (CSS runs on it,
 *     not on rAF — AGENT-BRIEF §3) and each frame advances every running animation's
 *     `currentTime` by exactly dt. Probed: the freeze holds across navigation, transitions
 *     included, and the writes hold. Unlike `PAGE_STILL_HUD`'s seek-to-zero, every keyframe
 *     sits at the phase virtual time says — what a 60 fps player sees.
 *   * `Math.random` is a seeded PRNG (the sim has none; VFX, shake and the lobby roll do).
 *   * CAMERA SHAKE is suppressed on the match rig for the whole capture match (count
 *     recorded). Zeroing it only at the shutter would leave the DOM pills and damage numbers
 *     placed by the shaken camera, a few px off the bodies.
 *   * GPU DRAW is STUBBED on every on-screen Stage except for PREROLL_FRAMES before the
 *     shutter (the post chain has no temporal pass; shadows are change-driven). The stub keeps
 *     the CPU half of three's render — scene + camera world matrices — because skipping that
 *     freezes `camera.matrixWorldInverse` and breaks every projection and the aim raycast.
 *     Validated: an every-frame-rendered home and a 2-frame-rendered home are 0 px apart.
 *   * Input is sent between frames and flushed with one REAL animation frame
 *     (`__rv.realFrame`), so rAF-aligned mouse events land before the next virtual frame.
 *
 * The match frame is chosen from SIM state (positions, HP, alive), never from a VFX counter,
 * so a graphics-only change should select the SAME tick on the next tree. ⚠️ Not guaranteed:
 * the driver aims through the camera (screen point -> raycast), so a camera change can perturb
 * aim by float error, and a different hit is a different match. The report prints the tick.
 *
 * ── DRIVERS (rv/1) ───────────────────────────────────────────────────────────────
 *   * Weapon: the slot whose reach covers the distance (`weaponFor`, REACH read from the
 *     tree). q1 held slot 1, which `8a51df9` made MELEE for every character — on HEAD q1's
 *     loop deals 0 damage and dies (`shots/rv/common` shows taco at 86/86 for that reason).
 *   * 1v1: q1's leash/band/strafe (`driveQ1`).
 *   * 6-seat: walk (BFS over the tree's own cover list) to the nearest bot duel, else the
 *     centre feature; fight the nearest opponent once there (`sixTarget`).
 *
 * ── THE GUARDS (each refuses; none warns; a refused frame is written as REFUSED_*) ──
 *   paint bracket (`settle.mjs:paintStateFn` before AND after), frame floor, the virtual
 *   clock did not move across the shutter, the draw was live, no GL loss, HUD
 *   (`hs_hudguard.mjs:judgeHud`, seats 2 / 6), menu screen NAME, hint settled (home),
 *   every portrait painted AND decoded + `__thumbsReady` (select), no page error, no error
 *   swallowed by the virtual clock.
 *
 * Usage:
 *   node tools/tmp/rv_capture.mjs --selftest                      # offline, no browser
 *   node tools/tmp/rv_capture.mjs --compare <dirA> <dirB> [--json f]  # per-frame pixel diff
 *   capture flags: --only home,select,home_phone,select_phone,arena,arena6
 *                  --debug-at <ms,ms>  extra unguarded frames (PERTURBS the match: non-canonical)
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, renameSync, rmSync } from 'node:fs';
import { resolve, join, dirname, basename, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE PROTOCOL — every number a re-capture must hold fixed
// ═════════════════════════════════════════════════════════════════════════════

export const PROTOCOL = 'rv/1';
export const P = Object.freeze({
  W: 1600,
  H: 900,
  DSF: 1,
  /** Virtual frame. 62.5 fps; an integer so `now` stays exact in floating point. */
  FRAME_MS: 16,
  /** A driver decision every 4 frames = 64 ms of virtual time (q1 slept 70 ms of real time). */
  CTRL_FRAMES: 4,
  SEED: 0x5eed2610,
  /** Virtual wall clock origin (Date.now() = EPOCH + virtual ms). */
  EPOCH: Date.UTC(2026, 9, 15, 12, 0, 0),
  /** Menus are photographed at this virtual time after navigation starts. */
  MENU_CAPTURE_MS: 7008,
  /** q1's band, unchanged. */
  D_MIN: 45,
  D_MAX: 140,
  /** A "fresh hit": some on-screen fighter lost HP within this much virtual time (3 control steps). */
  HIT_WINDOW_MS: 192,
  /** 1v1: the fight must be established — this long after first contact (d <= D_MAX). */
  AFTER_CONTACT_MS: 1200,
  /** 6-seat: fighters on screen at once. */
  MIN_ON_SCREEN_6: 3,
  /**
   * Where a fighter's FEET must project for it to count as "in the frame". Not q1's 40 px
   * margin: a fighter is ~110 px tall with its HP pill ~40 px above that at this camera, and
   * the top HUD band (nameplates, clock, zone pill) runs to y~120 while the weapon bar starts
   * at y~820. Measured on the first rv six-seat capture, where two of three "on-screen"
   * fighters stood at y 0-60 — under the zone pill and off the top edge, counted by the rule
   * and invisible to a viewer.
   */
  SAFE: { x0: 100, x1: 1500, y0: 190, y1: 790 },
  /** Frames RENDERED before the shutter (all earlier frames run with the GPU draw stubbed). */
  PREROLL_FRAMES: 2,
  /** Match budgets, virtual. */
  BUDGET_1V1_MS: 110_000,
  BUDGET_6_MS: 110_000,
  /** q1's leash: the drive loop walks back to the anchor beyond this. */
  LEASH: 240,
  MATCHUP: { player: 'donut', enemy: 'taco' },
  /**
   * The menu plates (`menus_home`, `menus_select`) are 2556x1179 phone-landscape screenshots,
   * and review.mjs's CATEGORY_NOTES says our side "must be shot at the same aspect". The last
   * round that used those plates (`shots/baseline3`, capture-report viewport [852,393]) shot
   * 852x393 CSS px at DPR 3 = exactly 2556x1179. `home_phone` / `select_phone` reproduce that.
   * ⚠️ Not a phone EMULATION: no touch, no `isMobile`, so `quality.ts:detectTier` says `high`;
   * a real phone at this size auto-selects `low` (coarse pointer + short edge <= 500).
   */
  PHONE: { W: 852, H: 393, DSF: 3 },
  SEATS6: 6,
});

const FRAME_ORDER = ['home', 'select', 'home_phone', 'select_phone', 'arena', 'cast', 'arena6'];

// ═════════════════════════════════════════════════════════════════════════════
// INPUTS READ FROM OTHER TOOLS — parsed, never retyped
// ═════════════════════════════════════════════════════════════════════════════

/**
 * q1_capture.mjs's SEEDED_PROFILE, parsed out of its source. It has no exports and runs its
 * capture at import, so it cannot be imported; a COPY would be a second source of truth for
 * "the populated profile every round is shot with". Throws if the literal moved.
 */
export function q1SeededProfile(root = REPO) {
  const src = readFileSync(join(root, 'tools/tmp/q1_capture.mjs'), 'utf8');
  const m = /const\s+SEEDED_PROFILE\s*=\s*(\{[\s\S]*?\n\});/.exec(src);
  if (!m) throw new Error('rv_capture: SEEDED_PROFILE not found in tools/tmp/q1_capture.mjs');
  // eslint-disable-next-line no-new-func
  const obj = new Function(`return (${m[1].replace(/;$/, '')});`)();
  if (!obj || typeof obj !== 'object' || !obj.economy) throw new Error('rv_capture: SEEDED_PROFILE parsed to something without an economy');
  return obj;
}

/** q1_capture's ANCHOR_K default (1.684), parsed for the same reason. */
export function q1AnchorK(root = REPO) {
  const src = readFileSync(join(root, 'tools/tmp/q1_capture.mjs'), 'utf8');
  const m = /const\s+ANCHOR_K\s*=\s*Number\(args\.anchorK\s*\?\?\s*([0-9.]+)\)/.exec(src);
  if (!m) throw new Error('rv_capture: ANCHOR_K not found in tools/tmp/q1_capture.mjs');
  return Number(m[1]);
}

/** The arena, from the tree being captured (so the anchor follows the map). */
export function arenaOf(treeRoot) {
  const p = join(treeRoot, 'tools/arena.gameplay.json');
  const a = JSON.parse(readFileSync(p, 'utf8'));
  if (!Array.isArray(a.cover) || a.cover.length === 0) throw new Error(`rv_capture: ${p} has no cover — a filter over [] passes`);
  const pot = (a.hazards ?? []).find((h) => h.kind === 'damage' && h.x === a.center.x && h.y === a.center.y);
  if (!pot) throw new Error(`rv_capture: ${p} has no central damage hazard`);
  return { ...a, pot, path: p };
}

/** q1_capture.mjs:derivedAnchor(), same formula, same inputs. */
export function anchorOf(arena, k) {
  return { x: Math.round(arena.center.x + arena.pot.radius * k), y: Math.round(arena.center.y) };
}

/**
 * `REACH` out of the tree's own `src/game/rules.ts`. Needed because `8a51df9` (2026-08-24,
 * "11 characters x 4 slots (melee/short/long/Super)") put a MELEE weapon in slot 1 for every
 * character, and q1's drive loop holds slot 1 while kiting at 45-140 wu: measured on HEAD,
 * donut swung Ring Spin (70 wu) at a taco 60-130 wu away for 3.0 s of contact, dealt 0 damage
 * and died. `shots/rv/common/match_donut_taco_*.png` (taco 86/86) show the same thing.
 */
export function reachOf(treeRoot) {
  const src = readFileSync(join(treeRoot, 'src/game/rules.ts'), 'utf8');
  const block = /export const REACH = \{([\s\S]*?)\n\};/.exec(src);
  if (!block) throw new Error('rv_capture: REACH not found in src/game/rules.ts');
  const val = (k) => {
    const m = new RegExp(`\\b${k}:\\s*([0-9.]+)`).exec(block[1]);
    if (!m) throw new Error(`rv_capture: REACH.${k} not found`);
    return Number(m[1]);
  };
  return { meleeQuick: val('meleeQuick'), rangedClose: val('rangedClose') };
}

/**
 * THE WEAPON POLICY (rv/1): the slot whose reach covers the current distance, judged on the
 * SHORTEST reach any weapon of that slot has — melee (slot 1) inside `meleeQuick`, short
 * (slot 2) inside `rangedClose`, long (slot 3) beyond. The Super is never pressed. Zero-based.
 */
export function weaponFor(d, reach, margin = 4) {
  if (d <= reach.meleeQuick - margin) return 0;
  if (d <= reach.rangedClose - margin) return 1;
  return 2;
}

// ═════════════════════════════════════════════════════════════════════════════
// PATHING (6-seat only) — the shipped route spawns the local seat at spawns[0], which is
// ~1,300 wu and several props from the action. q1's straight-line `toward()` cannot get
// there. A BFS over the arena's own cover list (from the TREE under test) can.
// ═════════════════════════════════════════════════════════════════════════════

const NAV_CELL = 20;      // movement.ts:navGrid's cell
const FIGHTER_HALF = 21;  // PLAYER_SIZE / 2, as q1_capture

export function buildNav(arena) {
  const cols = Math.ceil(arena.width / NAV_CELL);
  const rows = Math.ceil(arena.height / NAV_CELL);
  const block = new Uint8Array(cols * rows);
  const pad = FIGHTER_HALF + 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * NAV_CELL + NAV_CELL / 2;
      const y = r * NAV_CELL + NAV_CELL / 2;
      let b = x < pad || y < pad || x > arena.width - pad || y > arena.height - pad;
      for (const cb of arena.cover) {
        if (b) break;
        if (Math.abs(x - cb.x) <= cb.w / 2 + pad && Math.abs(y - cb.y) <= cb.h / 2 + pad) b = true;
      }
      for (const h of arena.hazards ?? []) {
        if (b) break;
        if (h.kind === 'damage' && Math.hypot(x - h.x, y - h.y) <= h.radius + pad) b = true;
      }
      block[r * cols + c] = b ? 1 : 0;
    }
  }
  return { cols, rows, block };
}

/** Next waypoint on a BFS path from (sx,sy) to (tx,ty); null if none. Deterministic tie order. */
export function navNext(nav, sx, sy, tx, ty, lookahead = 4) {
  const { cols, rows, block } = nav;
  const cell = (x, y) => [Math.min(cols - 1, Math.max(0, Math.floor(x / NAV_CELL))), Math.min(rows - 1, Math.max(0, Math.floor(y / NAV_CELL)))];
  const [sc, sr] = cell(sx, sy);
  let [tc, tr] = cell(tx, ty);
  // A blocked target cell (anchor inside a margin) snaps to the nearest open one.
  if (block[tr * cols + tc]) {
    let best = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (block[r * cols + c]) continue;
      const d = (c - tc) ** 2 + (r - tr) ** 2;
      if (!best || d < best.d) best = { c, r, d };
    }
    if (!best) return null;
    tc = best.c; tr = best.r;
  }
  const prev = new Int32Array(cols * rows).fill(-1);
  const start = sr * cols + sc;
  const goal = tr * cols + tc;
  const q = [goal];
  prev[goal] = goal;
  // BFS FROM THE GOAL, so prev[] points one step toward it from any cell.
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (cur === start) break;
    const cc = cur % cols; const cr = (cur - cc) / cols;
    for (const [dc, dr] of D) {
      const nc = cc + dc; const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const n = nr * cols + nc;
      if (prev[n] !== -1) continue;
      // The start may sit in a padded cell (spawned against a prop); let it out.
      if (block[n] && n !== start) continue;
      if (dc && dr && (block[cr * cols + nc] || block[nr * cols + cc])) continue; // no corner cutting
      prev[n] = cur;
      q.push(n);
    }
  }
  if (prev[start] === -1) return null;
  let at = start;
  for (let k = 0; k < lookahead && at !== goal; k++) at = prev[at];
  const c = at % cols; const r = (at - c) / cols;
  return { x: c * NAV_CELL + NAV_CELL / 2, y: r * NAV_CELL + NAV_CELL / 2, arrived: start === goal };
}

// ═════════════════════════════════════════════════════════════════════════════
// THE SELECTION RULES — pure functions over a history of SIM reads, so --selftest can
// show each one firing on a known-bad without a browser.
// ═════════════════════════════════════════════════════════════════════════════

export const onScreen = (s, f = P.SAFE) => !!s && s.x >= f.x0 && s.x <= f.x1 && s.y >= f.y0 && s.y <= f.y1;

/**
 * True if `slot` lost HP in a read interval that ENDS inside the last `windowMs` of virtual
 * time (hist[last] is the current read). Time-based, not count-based, so the 1-frame
 * pre-roll reads and the 4-frame control reads mean the same thing.
 */
export function hitRecently(hist, slot, windowMs = P.HIT_WINDOW_MS) {
  const n = hist.length;
  if (n < 2) return false;
  const tNow = hist[n - 1].now;
  for (let i = n - 1; i >= 1; i--) {
    if (tNow - hist[i].now >= windowMs) break;
    const a = hist[i - 1].slots?.[slot]; const b = hist[i].slots?.[slot];
    if (a && b && b.hp < a.hp - 1e-9) return true;
  }
  return false;
}

/**
 * 1v1. Returns `{ eligible, why[] , score }`. `contactAt` is the virtual ms the pair first
 * came within D_MAX (null until then).
 */
export function judge1v1(hist, contactAt, startHp = null) {
  const r = hist[hist.length - 1];
  const why = [];
  const p = r.slots?.[0]; const e = r.slots?.[1];
  if (!p || !e) return { eligible: false, why: ['no fighters'], score: 0 };
  // An EXCHANGE, not a beating: both HP bars must have moved, or the frame shows one
  // fighter shooting a statue — which is what q1's stale weapon slot produced on HEAD.
  if (startHp && !(p.hp < startHp[0] - 1e-9 && e.hp < startHp[1] - 1e-9)) why.push('not both fighters hurt yet');
  if (r.phase !== 'playing') why.push(`phase ${r.phase}`);
  if (!p.alive || !e.alive) why.push('a fighter is dead');
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d < P.D_MIN || d > P.D_MAX) why.push(`d=${d.toFixed(0)} outside ${P.D_MIN}-${P.D_MAX}`);
  if (!onScreen(r.screen?.[0]) || !onScreen(r.screen?.[1])) why.push('a fighter is off screen');
  const fresh = hitRecently(hist, 0) || hitRecently(hist, 1);
  if (!fresh) why.push('no fresh hit');
  if (contactAt === null || r.now - contactAt < P.AFTER_CONTACT_MS) why.push('fight not established');
  if (r.viewSubject !== 0) why.push(`camera on slot ${r.viewSubject}`);
  const score = (p.alive && e.alive ? 4 : 0) + (d >= P.D_MIN && d <= P.D_MAX ? 2 : 0) + (fresh ? 2 : 0)
    + (onScreen(r.screen?.[0]) && onScreen(r.screen?.[1]) ? 1 : 0);
  return { eligible: why.length === 0, why, score, d };
}

/** 6-seat. */
export function judge6(hist) {
  const r = hist[hist.length - 1];
  const why = [];
  const slots = r.slots ?? [];
  if (slots.length !== P.SEATS6) why.push(`${slots.length} seats, want ${P.SEATS6}`);
  if (r.phase !== 'playing') why.push(`phase ${r.phase}`);
  if (!slots[0]?.alive) why.push('local seat dead');
  if (r.viewSubject !== 0) why.push(`camera on slot ${r.viewSubject}`);
  const shown = slots.map((f, i) => i).filter((i) => slots[i]?.alive && onScreen(r.screen?.[i]));
  if (shown.length < P.MIN_ON_SCREEN_6) why.push(`${shown.length} living fighters on screen`);
  const fresh = shown.some((i) => hitRecently(hist, i));
  if (!fresh) why.push('no fresh hit on screen');
  const score = shown.length * 10 + (fresh ? 5 : 0) + (slots[0]?.alive ? 1 : 0);
  return { eligible: why.length === 0, why, score, shown };
}

// ═════════════════════════════════════════════════════════════════════════════
// THE PAGE-SIDE VIRTUAL CLOCK — serialised by Playwright, so it closes over nothing.
// ═════════════════════════════════════════════════════════════════════════════

export function RV_INIT(cfg) {
  if (window.__rv) return;
  try {
    for (const [k, v] of Object.entries(cfg.storage ?? {})) localStorage.setItem(k, v);
  } catch { /* private mode */ }

  // ── seeded Math.random (the lq_shot PRNG) ──
  let s = cfg.seed >>> 0;
  let draws = 0;
  Math.random = function random() {
    draws++;
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const real = {
    raf: window.requestAnimationFrame.bind(window),
    now: performance.now.bind(performance),
  };
  let now = 0;
  let inTick = false;
  const errors = [];
  const note = (where, e) => { errors.push(`${where}: ${String((e && e.stack) || e).slice(0, 600)}`); };

  // ── Date ──
  const RealDate = Date;
  function VDate(...a) {
    if (!new.target) return new RealDate(cfg.epoch + now).toString();
    return a.length ? new RealDate(...a) : new RealDate(cfg.epoch + now);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = () => cfg.epoch + now;
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  window.Date = VDate;

  // ── performance.now ──
  performance.now = () => now;

  // ── timers ──
  const timers = new Map();
  let tid = 1;
  const add = (fn, ms, args, every) => {
    let d = Number(ms);
    if (!Number.isFinite(d) || d < 0) d = 0;
    // A zero-delay timer queued from inside a tick runs on the NEXT frame, not in a loop
    // inside this one (a self-rescheduling setTimeout(0) would otherwise never return).
    if (d === 0 && inTick) d = 1;
    const id = tid++;
    timers.set(id, { id, at: now + d, fn, args, every });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, 0);
  window.setInterval = (fn, ms, ...args) => {
    let d = Number(ms);
    if (!Number.isFinite(d) || d < 1) d = 1;
    return add(fn, d, args, d);
  };
  window.clearTimeout = (id) => { timers.delete(id); };
  window.clearInterval = (id) => { timers.delete(id); };
  window.requestIdleCallback = (cb) => add(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1, [], 0);
  window.cancelIdleCallback = (id) => { timers.delete(id); };

  // ── rAF ──
  const rafs = new Map();
  let rid = 1;
  window.requestAnimationFrame = (cb) => { const id = rid++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };

  // ── DRAW CONTROL. Only the PHOTOGRAPHED frame needs GPU work: the post chain has no
  // temporal pass (RenderPass, SSAO, bloom, grade, contact AO, vignette, ink, SMAA — all
  // per-frame) and shadows are change-driven (`scheduleShadowUpdate`'s fingerprint). So on
  // every ON-SCREEN Stage the renderer's and composer's `render` are swapped for a CPU stub
  // that does exactly what three's render does to persistent CPU state — update the scene's
  // and the camera's world matrices — and nothing else. NOT `contextLost = true`: that
  // early-return also skips the matrix update, which freezes `camera.matrixWorldInverse` and
  // silently breaks every projection (HUD pills, damage numbers, the aim raycast).
  // Offscreen Stages (the roster thumbnail generator) are never touched.
  let draw = cfg.draw !== false;
  let stubbedRenders = 0;
  const ORIG = '__rvOrigRender';
  const applyDraw = () => {
    const st = window.__stages;
    if (!Array.isArray(st)) return;
    for (const s of st) {
      if (!s || s.disposed || s.offscreen) continue;
      const r = s.renderer; const c = s.composer;
      if (!draw) {
        if (s[ORIG]) continue;
        s[ORIG] = {
          r: r ? { own: Object.prototype.hasOwnProperty.call(r, 'render'), fn: r.render } : null,
          c: c ? { own: Object.prototype.hasOwnProperty.call(c, 'render'), fn: c.render } : null,
        };
        const cpu = (scene, camera) => {
          stubbedRenders++;
          if (scene && scene.matrixWorldAutoUpdate !== false && scene.updateMatrixWorld) scene.updateMatrixWorld();
          if (camera && camera.parent === null && camera.matrixWorldAutoUpdate !== false && camera.updateMatrixWorld) camera.updateMatrixWorld();
        };
        if (r) r.render = cpu;
        if (c) c.render = () => cpu(s.scene, s.rig && s.rig.camera);
      } else if (s[ORIG]) {
        const o = s[ORIG];
        if (r && o.r) { if (o.r.own) r.render = o.r.fn; else delete r.render; }
        if (c && o.c) { if (o.c.own) c.render = o.c.fn; else delete c.render; }
        s[ORIG] = null;
      }
    }
  };

  // ── CSS: the document timeline is frozen by CDP; advance every running animation. ──
  let cssAdvanced = 0;
  const advanceCss = (dt) => {
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      try { a.currentTime = (Number(a.currentTime) || 0) + dt; cssAdvanced++; } catch (e) { note('css', e); }
    }
  };

  async function frame(dt) {
    now += dt;
    advanceCss(dt);
    inTick = true;
    try {
      for (let guard = 0; guard < 5000; guard++) {
        let next = null;
        for (const t of timers.values()) {
          if (t.at <= now && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
        }
        if (!next) break;
        if (next.every) next.at += next.every; else timers.delete(next.id);
        applyDraw();
        try {
          if (typeof next.fn === 'function') next.fn(...(next.args ?? []));
          else (0, eval)(String(next.fn));
        } catch (e) { note('timer', e); }
        await null;
      }
      const ids = [...rafs.keys()];
      for (const id of ids) {
        const cb = rafs.get(id);
        if (!cb) continue;
        rafs.delete(id);
        applyDraw();
        try { cb(now); } catch (e) { note('raf', e); }
        await null;
      }
    } finally {
      inTick = false;
    }
  }

  window.__rv = {
    protocol: cfg.protocol,
    now: () => now,
    draws: () => draws,
    errors,
    shakeSuppressed: 0,
    cssAdvanced: () => cssAdvanced,
    stubbedRenders: () => stubbedRenders,
    drawing: () => draw,
    setDraw(on) { draw = !!on; applyDraw(); return draw; },
    pending: () => ({ timers: timers.size, rafs: rafs.size }),
    async frames(n, dt) {
      for (let i = 0; i < n; i++) await frame(dt);
      return { now, errors: errors.length, draws, ...this.pending() };
    },
    realFrame: () => new Promise((r) => real.raf(() => r(true))),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// NODE-SIDE RUNTIME
// ═════════════════════════════════════════════════════════════════════════════

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  // 🚨 LOAD-BEARING. Probed: with the document timeline frozen by CDP, a COMPOSITED
  // (transform/opacity) CSS animation renders a DIFFERENT phase from its own `currentTime`
  // and computed style — the compositor keeps whatever phase it was handed. A 3 s rise set
  // to t=1000 screenshots differently from the same rise `pause()`d at t=1000, while both
  // report the identical `matrix(1.333,0,0,1.333,0,-66.67)`. On the match HUD that is the
  // damage numbers (`hud-dmg-rise`): two otherwise-identical captures differed by 834 px in
  // one 44x36 box. This flag runs every animation on the main thread, so the pixels follow
  // the virtual clock.
  '--disable-threaded-animation',
];

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function newRv(browser, { profile, geometry = { W: P.W, H: P.H, DSF: P.DSF } }) {
  const context = await browser.newContext({ viewport: { width: geometry.W, height: geometry.H }, deviceScaleFactor: geometry.DSF });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  await page.addInitScript(RV_INIT, {
    protocol: PROTOCOL,
    seed: P.SEED,
    epoch: P.EPOCH,
    draw: false,
    storage: profile ? { 'food-arena.profile.v1': JSON.stringify(profile) } : {},
  });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  let inflight = 0;
  page.on('request', () => { inflight++; });
  page.on('requestfinished', () => { inflight--; });
  page.on('requestfailed', () => { inflight--; });
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(String(e).slice(0, 400)); console.log(`   PAGEERROR: ${String(e).slice(0, 200)}`); });
  page.setDefaultTimeout(180_000);
  const rt = {
    context, page, cdp, now: 0, pageErrors, rvErrors: 0, geometry,
    inflight: () => inflight,
    async quiesce(timeout = 60_000) {
      const t0 = Date.now();
      while (inflight > 0 && Date.now() - t0 < timeout) await sleep(20);
    },
    /** Advance n virtual frames in one round trip. */
    async frames(n, { quiet = true } = {}) {
      if (quiet) await this.quiesce();
      const res = await page.evaluate(([k, dt]) => window.__rv.frames(k, dt), [n, P.FRAME_MS]);
      this.now = res.now;
      if (res.errors > this.rvErrors) {
        const errs = await page.evaluate((from) => window.__rv.errors.slice(from), this.rvErrors);
        for (const e of errs) console.log(`   RV-SWALLOWED: ${e.slice(0, 300)}`);
        this.rvErrors = res.errors;
      }
      return res;
    },
    /** Run to an ABSOLUTE virtual time. `gapMs` real sleep between batches lets real-time
     *  machinery (ResizeObserver, image decode, fonts) land before the next frame. */
    async runTo(t, { batch = 8, gapMs = 0 } = {}) {
      while (this.now < t) {
        const n = Math.max(1, Math.min(batch, Math.ceil((t - this.now) / P.FRAME_MS)));
        await this.frames(n);
        if (gapMs) await sleep(gapMs);
      }
    },
    async close() { await context.close(); },
  };
  return rt;
}

/** Fonts are real-time; wait for them in REAL time before virtual time starts mattering. */
async function fontsLoaded(rt) {
  return rt.page.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
}

/**
 * Serve-side fingerprint: sha256 over every file under the snapshot's src/ + index.html,
 * path-sorted. `SNAPSHOT_DIR` is what sx_snap / with_snapshot inject. This is the exact bytes
 * Vite served, which a SHA cannot promise when a worktree is dirty.
 */
function servedFingerprint(dir) {
  if (!dir || !existsSync(dir)) return null;
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p); else files.push(p);
    }
  };
  if (existsSync(join(dir, 'src'))) walk(join(dir, 'src'));
  if (existsSync(join(dir, 'public'))) walk(join(dir, 'public'));
  for (const f of ['index.html']) if (existsSync(join(dir, f))) files.push(join(dir, f));
  const h = createHash('sha256');
  for (const f of files) { h.update(relative(dir, f)); h.update('\0'); h.update(readFileSync(f)); h.update('\0'); }
  return { dir, files: files.length, sha256: h.digest('hex') };
}

function treeProvenance(tree) {
  if (!tree) return { root: null, head: null, dirty: null, note: 'no --tree given: the SHA of what was served is UNKNOWN' };
  try {
    const head = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD']).toString().trim();
    const status = execFileSync('git', ['-C', tree, 'status', '--porcelain', '--untracked-files=no']).toString().trim();
    return { root: tree, head, dirty: status.length > 0, dirtyFiles: status ? status.split('\n').length : 0 };
  } catch (e) {
    return { root: tree, head: null, dirty: null, note: `git failed: ${String(e).slice(0, 160)}` };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// THE SHUTTER
// ═════════════════════════════════════════════════════════════════════════════

async function shoot(rt, ctx, { name, label, guards, extra }) {
  const { paintStateFn, frameStats, FRAME_FLOOR } = ctx.settle;
  const path = join(ctx.out, `${name}.png`);
  const before = await rt.page.evaluate(paintStateFn);
  const g = guards ? await guards(rt) : { ok: true, checks: [] };
  const buf = await rt.page.screenshot({ type: 'png', timeout: 180_000 });
  const after = await rt.page.evaluate(paintStateFn);
  const stats = await frameStats(buf);
  const vNowAfter = await rt.page.evaluate(() => window.__rv.now());
  const problems = [];
  if (!before.ok) problems.push(`NOT PAINTED before: ${before.why.join('; ')}`);
  if (!after.ok) problems.push(`NOT PAINTED after: ${after.why.join('; ')}`);
  if (stats.stdev < FRAME_FLOOR) problems.push(`FLAT frame: stdev ${stats.stdev} < ${FRAME_FLOOR}`);
  if (vNowAfter !== rt.now) problems.push(`virtual clock MOVED across the shutter (${rt.now} -> ${vNowAfter})`);
  if (!g.ok) problems.push(...g.checks.filter((c) => !c.ok).map((c) => `guard ${c.name}: ${c.detail}`));
  if (rt.pageErrors.length) problems.push(`${rt.pageErrors.length} uncaught page error(s): ${rt.pageErrors[0]}`);
  if (rt.rvErrors) problems.push(`${rt.rvErrors} error(s) swallowed by the virtual clock`);

  const rvState = await rt.page.evaluate(() => ({
    now: window.__rv.now(), draws: window.__rv.draws(), shakeSuppressed: window.__rv.shakeSuppressed,
    cssAdvanced: window.__rv.cssAdvanced(), stubbedRenders: window.__rv.stubbedRenders(), drawing: window.__rv.drawing(),
    pending: window.__rv.pending(), url: location.pathname + location.search,
    screen: window.__screen ?? null,
    glLost: (window.__glLog ?? []).filter((e) => e.type !== 'restored').length,
  }));
  if (!rvState.drawing) problems.push('the GPU draw was still STUBBED at the shutter');
  if (rvState.glLost) problems.push(`${rvState.glLost} WebGL context loss/creation error(s) in __glLog`);
  const sidecar = {
    // ── the settle.mjs:captureSettled schema, so tools/review.mjs vouches for it ──
    tool: 'rv_capture',
    label,
    takenAt: new Date().toISOString(),
    painted: before.ok && after.ok,
    enforced: true,
    stats,
    before: { ok: before.ok, why: before.why, effectiveOpacity: before.effectiveOpacity, screen: before.screenName },
    after: { ok: after.ok, why: after.why, effectiveOpacity: after.effectiveOpacity, screen: after.screenName },
    // ── rv/1 provenance ──
    rv: {
      protocol: PROTOCOL,
      frame: name,
      params: P,
      virtual: rvState,
      tree: ctx.tree,
      served: ctx.served,
      base: ctx.base,
      toolSha256: ctx.toolSha256,
      browser: ctx.browser,
      geometry: rt.geometry,
      nonCanonical: ctx.nonCanonical || undefined,
      sha256: sha256(buf),
      guards: g.checks,
      problems,
      ...extra,
    },
  };
  if (g.hud) sidecar.hud = g.hud;
  if (problems.length) {
    // Written under a REFUSED name so no packet builder can pick it up as a frame.
    writeFileSync(join(ctx.out, `REFUSED_${name}.png`), buf);
    writeFileSync(join(ctx.out, `REFUSED_${name}.png.capture.json`), JSON.stringify({ ...sidecar, painted: false }, null, 2));
    throw new Error(`rv_capture: ${name} REFUSED — ${problems.join(' | ')}`);
  }
  writeFileSync(path, buf);
  writeFileSync(`${path}.capture.json`, JSON.stringify(sidecar, null, 2));
  console.log(`   ✓ ${name}.png  stdev ${stats.stdev} mean ${stats.mean}  t=${rvState.now}ms  sha ${sidecar.rv.sha256.slice(0, 12)}`);
  return { path, sidecar, buf };
}

// ═════════════════════════════════════════════════════════════════════════════
// MENUS
// ═════════════════════════════════════════════════════════════════════════════

async function bootMenu(rt, base, screenParam) {
  await rt.page.goto(`${base}/?screen=${screenParam}&pointerLock=0`, { waitUntil: 'networkidle' });
  const fonts = await fontsLoaded(rt);
  // The first virtual second in single frames with a real gap, so ResizeObserver callbacks,
  // image decodes and the first shader links land between frames rather than racing them.
  await rt.runTo(1000, { batch: 1, gapMs: 15 });
  return fonts;
}

/** Turn the GPU draw on and render the PREROLL frames that end at the shutter. */
async function prerollTo(rt, t) {
  const start = t - P.PREROLL_FRAMES * P.FRAME_MS;
  if (rt.now > start) throw new Error(`rv_capture: preroll asked to start at ${start} but the clock is at ${rt.now}`);
  await rt.runTo(start, { batch: 8 });
  await rt.page.evaluate(() => window.__rv.setDraw(true));
  // Real gap: let the first real frames land (shader links, uploads) before the next one.
  for (let i = 0; i < P.PREROLL_FRAMES; i++) { await rt.frames(1); await sleep(30); }
}

async function shootHome(browser, ctx, { name = 'home', geometry } = {}) {
  console.log(`\n── ${name} ──`);
  const rt = await newRv(browser, { profile: ctx.profile, geometry });
  try {
    const fonts = await bootMenu(rt, ctx.base, 'home');
    await prerollTo(rt, P.MENU_CAPTURE_MS);
    return await shoot(rt, ctx, {
      name,
      label: `home, seeded profile, ${rt.geometry.W}x${rt.geometry.H}@${rt.geometry.DSF}`,
      extra: { route: '/?screen=home&pointerLock=0', fonts, geometry: rt.geometry },
      guards: async (r) => {
        const st = await r.page.evaluate(() => {
          const hint = document.querySelector('.fa-home [data-el="hint"]');
          const hs = hint ? getComputedStyle(hint) : null;
          return {
            screen: window.__screen ?? null,
            hintOpacity: hs ? Number(hs.opacity) : null,
            // ⚠️ AT HEAD THE HINT NO LONGER FADES OUT: `.home-stage-hint.is-faded` is
            // opacity 0.88 (a quieter state), so settle.mjs:waitForFaded's `<= 0.02` can
            // never be met on home. What is checked is the STATE: the class is on and its
            // transition has finished.
            hintSettled: !hint || hs.display === 'none'
              || (hint.classList.contains('is-faded') && !hint.getAnimations().some((a) => a.playState === 'running')),
            chip: document.querySelector('.fa-home')?.textContent?.includes('380') ?? false,
          };
        });
        const checks = [
          { name: 'screen is home', ok: st.screen === 'home', detail: String(st.screen) },
          { name: '"Tap to taunt" hint is in its settled is-faded state', ok: st.hintSettled, detail: `opacity ${st.hintOpacity}` },
          { name: 'the seeded profile reached the screen (380 trophies shown)', ok: st.chip, detail: String(st.chip) },
        ];
        return { ok: checks.every((c) => c.ok), checks };
      },
    });
  } finally { await rt.close(); }
}

async function shootSelect(browser, ctx, { name = 'select', geometry } = {}) {
  console.log(`\n── ${name} ──`);
  const rt = await newRv(browser, { profile: ctx.profile, geometry });
  try {
    const fonts = await bootMenu(rt, ctx.base, 'characters');
    await prerollTo(rt, P.MENU_CAPTURE_MS);
    return await shoot(rt, ctx, {
      name,
      label: `character select, seeded profile, ${rt.geometry.W}x${rt.geometry.H}@${rt.geometry.DSF}`,
      extra: { route: '/?screen=characters&pointerLock=0', fonts, geometry: rt.geometry },
      guards: async (r) => {
        const st = await r.page.evaluate(() => {
          const all = [...document.querySelectorAll('.chars-card[data-char]')];
          const painted = all.filter((c) => c.classList.contains('has-render')
            && !!c.querySelector('[data-el="render"]')?.getAttribute('src'));
          const decoded = painted.filter((c) => { const im = c.querySelector('[data-el="render"]'); return im.complete && im.naturalWidth > 0; });
          return { screen: window.__screen ?? null, total: all.length, painted: painted.length, decoded: decoded.length, flag: window.__thumbsReady === true };
        });
        const checks = [
          { name: 'screen is characters', ok: st.screen === 'characters', detail: String(st.screen) },
          { name: 'roster non-empty (a filter over [] passes)', ok: st.total > 0, detail: `${st.total} cards` },
          { name: 'every card painted', ok: st.painted === st.total, detail: `${st.painted}/${st.total}` },
          { name: 'every portrait decoded', ok: st.decoded === st.total, detail: `${st.decoded}/${st.total}` },
          { name: '__thumbsReady', ok: st.flag, detail: String(st.flag) },
        ];
        return { ok: checks.every((c) => c.ok), checks };
      },
    });
  } finally { await rt.close(); }
}

// ═════════════════════════════════════════════════════════════════════════════
// MATCHES
// ═════════════════════════════════════════════════════════════════════════════

/** One evaluate: advance `n` frames, then read the sim-side state the rules need. */
async function stepRead(rt, n) {
  await rt.quiesce();
  const r = await rt.page.evaluate(async ([k, dt]) => {
    const res = await window.__rv.frames(k, dt);
    const md = window.__matchDebug;
    const f = window.__vfxDebugFighters;
    const s = window.__vfxDebugScreen;
    const fd = window.__feelDebug;
    return {
      now: res.now,
      rvErrors: res.errors,
      phase: md ? md.phase : null,
      viewSubject: md ? md.viewSubject : null,
      loopFrames: md ? md.frames : null,
      attack: md ? md.attack : null,
      facing: md ? [+md.facingX.toFixed(3), +md.facingY.toFixed(3)] : null,
      weapon: md ? md.selectedWeapon : null,
      slots: f && f.slots ? f.slots.map((x) => ({ x: x.x, y: x.y, hp: x.hp, alive: x.alive })) : null,
      screen: s && s.slots ? s.slots.map((p) => (p ? { x: p.x, y: p.y } : null)) : null,
      damageNumbers: fd?.responses?.damageNumber ?? null,
      events: fd?.events ? { ...fd.events } : null,
      screenName: window.__screen ?? null,
    };
  }, [n, P.FRAME_MS]);
  rt.now = r.now;
  if (r.rvErrors > rt.rvErrors) {
    const errs = await rt.page.evaluate((from) => window.__rv.errors.slice(from), rt.rvErrors);
    for (const e of errs) console.log(`   RV-SWALLOWED: ${e.slice(0, 300)}`);
    rt.rvErrors = r.rvErrors;
  }
  return r;
}

/** Suppress camera shake on the match rig, once the match Stage exists. */
async function suppressShake(rt) {
  return rt.page.evaluate(() => {
    const st = window.__stage;
    if (!st || !st.rig || !document.getElementById('game')?.contains(st.canvas)) return { ok: false, why: 'no on-screen match stage' };
    const rig = st.rig;
    rig.shake = () => { window.__rv.shakeSuppressed++; };
    rig.shakeAmount = 0;
    if (rig.shakeOffset?.set) rig.shakeOffset.set(0, 0, 0);
    return { ok: true };
  });
}

/** WASD + mouse, applied only when they change; then one REAL frame so rAF-aligned input lands. */
function makeInput(rt) {
  const held = new Set();
  let firing = false;
  const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  return {
    weapon: 0,
    async apply(mx, my, aim, weapon = null) {
      if (weapon !== null && weapon !== this.weapon) {
        await rt.page.keyboard.press(String(weapon + 1));
        this.weapon = weapon;
      }
      const want = new Set();
      if (mx < 0) want.add(KEYS.left);
      if (mx > 0) want.add(KEYS.right);
      if (my < 0) want.add(KEYS.up);
      if (my > 0) want.add(KEYS.down);
      for (const k of [...held]) if (!want.has(k)) { await rt.page.keyboard.up(k); held.delete(k); }
      for (const k of [...want].sort()) if (!held.has(k)) { await rt.page.keyboard.down(k); held.add(k); }
      if (aim) {
        await rt.page.mouse.move(Math.max(2, Math.min(P.W - 2, Math.round(aim.x))), Math.max(2, Math.min(P.H - 2, Math.round(aim.y))));
      }
      if (!firing) { await rt.page.mouse.down(); firing = true; }
      await rt.page.evaluate(() => window.__rv.realFrame());
    },
    keys: () => [...held].sort(),
  };
}

/** q1_capture's drive loop, verbatim in intent: leash to the anchor, hold the band, strafe. */
export function driveQ1(p, e, anchor) {
  const toward = (tx, ty) => [tx > p.x + 12 ? 1 : tx < p.x - 12 ? -1 : 0, ty > p.y + 12 ? 1 : ty < p.y - 12 ? -1 : 0];
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  const dAnchor = anchor ? Math.hypot(p.x - anchor.x, p.y - anchor.y) : 0;
  if (anchor && dAnchor > P.LEASH) return toward(anchor.x, anchor.y);
  if (d < P.D_MIN + 20) return toward(p.x + (p.x - e.x), p.y + (p.y - e.y));
  if (d > P.D_MAX - 20) return toward(e.x, e.y);
  const sx = e.x > p.x ? 1 : -1;
  const sy = e.y > p.y ? 1 : -1;
  return [-sy, sx];
}

/**
 * THE SIX-SEAT DRIVER (rv/1): third-party the nearest fight. Bots target their nearest living
 * opponent (`state.ts:nearestLivingOpponent`), so a six-seat match pairs off into duels all
 * over a 2800x2000 map and three fighters inside one camera window is rare unless someone
 * joins a duel — which is what a human playing six-player does. Target = the midpoint of the
 * closest pair of living opponents standing within FIGHT_PAIR_WU of each other; failing
 * that, the centre feature (the anchor). Measured on HEAD while designing it: (a) walking to
 * the anchor and fighting whatever came — the local seat died at ~30 s with never more than
 * two fighters in the safe frame; (b) falling back to the NEAREST opponent — it walked the
 * 91 HP local seat into a 1v1 with a 143 HP bot and died at 16 s.
 */
const FIGHT_PAIR_WU = 240;
export function sixTarget(slots) {
  const p = slots[0];
  let best = null;
  for (let i = 1; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]; const b = slots[j];
      if (!a?.alive || !b?.alive) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > FIGHT_PAIR_WU) continue;
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
      const d = Math.hypot(mx - p.x, my - p.y);
      if (!best || d < best.d - 1e-9) best = { x: mx, y: my, d, pair: [i, j] };
    }
  }
  return best;
}

function nearestOpponent(slots) {
  const p = slots[0];
  let best = null;
  for (let i = 1; i < slots.length; i++) {
    const f = slots[i];
    if (!f?.alive) continue;
    const d = Math.hypot(f.x - p.x, f.y - p.y);
    if (!best || d < best.d || (d === best.d && i < best.i)) best = { i, d };
  }
  return best;
}

async function matchGuards(rt, ctx, seats) {
  const dom = await rt.page.evaluate(ctx.hud.hudProbeFn, ctx.hud.HUD_SELECTORS);
  const res = ctx.hud.judgeHud(dom, { seats });
  const checks = res.checks.map((c) => ({ name: `${c.arm} ${c.name}`, ok: c.ok, detail: c.detail }));
  return { ok: res.ok, checks, hud: ctx.hud.hudSidecar(dom, res) };
}

/**
 * The capture loop shared by both matches. `decide(r)` returns `{mx,my,aim}`; `judge(hist)`
 * returns `{eligible, score}`. There is NO fallback frame: a tree on which the rule never
 * fires inside the budget FAILS, loudly, with the per-step trace written beside the output.
 * A best-effort frame would be an ineligible frame wearing an eligible frame's name.
 */
async function fightAndShoot(rt, ctx, { name, label, seats, budgetMs, decide, judge, extra }) {
  const input = makeInput(rt);
  const hist = [];
  const trace = [];
  let best = null;
  let contactAt = null;
  let startHp = null;
  const tEnd = rt.now + budgetMs;
  for (;;) {
    const r = await stepRead(rt, P.CTRL_FRAMES);
    hist.push(r);
    if (hist.length > 64) hist.shift();
    if (r.phase === 'ended') {
      writeFileSync(join(ctx.out, `trace_${name}.json`), JSON.stringify({ name, firedAt: null, endedAt: r.now, contactAt, last: r, trace }, null, 1));
      throw new Error(`rv_capture: ${name}: the match ENDED at t=${r.now} before a frame qualified (hp ${JSON.stringify(r.slots?.map((f) => +f.hp.toFixed(1)))}) — trace_${name}.json`);
    }
    if (!r.slots) continue;
    if (r.slots[1] && contactAt === null && Math.hypot(r.slots[0].x - r.slots[1].x, r.slots[0].y - r.slots[1].y) <= P.D_MAX) contactAt = r.now;
    if (!startHp && r.phase === 'playing') startHp = r.slots.map((f) => f.hp);
    const v = judge(hist, contactAt, startHp);
    if (trace.length < 4000) {
      trace.push({ t: r.now, ok: v.eligible, score: v.score, why: v.why.join('; '), hp: r.slots.map((f) => +f.hp.toFixed(2)), alive: r.slots.map((f) => f.alive), pos: r.slots.map((f) => [Math.round(f.x), Math.round(f.y)]), attack: r.attack, facing: r.facing, weapon: r.weapon, ev: r.events, scr0: r.screen?.[0] ? [Math.round(r.screen[0].x), Math.round(r.screen[0].y)] : null });
    }
    if (ctx.debugAt?.length && r.now >= ctx.debugAt[0]) {
      ctx.debugAt.shift();
      await rt.page.evaluate(() => window.__rv.setDraw(true));
      const dr = await stepRead(rt, 1);
      hist.push(dr);
      const p = join(ctx.out, `debug_${name}_${dr.now}.png`);
      await rt.page.screenshot({ path: p });
      await rt.page.evaluate(() => window.__rv.setDraw(false));
      console.log(`   debug frame ${p}`);
      continue;
    }
    if (r.phase === 'playing') {
      if (v.eligible) {
        // Pre-roll: the GPU draw comes on and PREROLL_FRAMES ordinary loop frames run with
        // the inputs unchanged. The rule is judged AGAIN on the frame that will be shot; if
        // it no longer holds, the draw goes off and the fight continues.
        console.log(`   rule fired at t=${r.now}ms  ${JSON.stringify({ d: v.d && +v.d.toFixed(1), shown: v.shown })} — pre-rolling`);
        await rt.page.evaluate(() => window.__rv.setDraw(true));
        let rr = r;
        for (let i = 0; i < P.PREROLL_FRAMES; i++) {
          rr = await stepRead(rt, 1);
          hist.push(rr);
          trace.push({ t: rr.now, preroll: true, hp: rr.slots.map((f) => +f.hp.toFixed(2)), alive: rr.slots.map((f) => f.alive), pos: rr.slots.map((f) => [Math.round(f.x), Math.round(f.y)]) });
          await sleep(30);
        }
        const vv = judge(hist, contactAt, startHp);
        if (vv.eligible) {
          writeFileSync(join(ctx.out, `trace_${name}.json`), JSON.stringify({ name, firedAt: r.now, shotAt: rr.now, contactAt, trace }, null, 1));
          const shot = await shoot(rt, ctx, {
            name, label, guards: (x) => matchGuards(x, ctx, seats),
            extra: { ...extra, selection: { firedAt: r.now, t: rr.now, contactAt, verdict: vv, read: rr, inputKeys: input.keys(), trace: `trace_${name}.json` } },
          });
          return { shot, read: rr, contactAt };
        }
        console.log(`   …not eligible after the pre-roll (${vv.why.join('; ')}) — continuing`);
        await rt.page.evaluate(() => window.__rv.setDraw(false));
        continue;
      }
      if (!best || v.score > best.score) {
        best = { score: v.score, t: r.now };
      }
      const cmd = decide(r);
      if (trace.length) trace[trace.length - 1].cmd = [cmd.mx, cmd.my, cmd.aim ? [Math.round(cmd.aim.x), Math.round(cmd.aim.y)] : null, cmd.weapon ?? null, cmd.goal ?? null];
      await input.apply(cmd.mx, cmd.my, cmd.aim, cmd.weapon ?? null);
    }
    if (r.now >= tEnd) {
      writeFileSync(join(ctx.out, `trace_${name}.json`), JSON.stringify({ name, firedAt: null, contactAt, trace }, null, 1));
      throw new Error(`rv_capture: ${name}: budget ${budgetMs} ms exhausted without the rule firing (best score ${best?.score} at ${best?.t}) — trace_${name}.json`);
    }
    if (r.now % 4096 < P.FRAME_MS * P.CTRL_FRAMES) {
      const last = trace[trace.length - 1];
      console.log(`   t=${r.now}ms phase=${r.phase} why=[${last?.why}] hp=${JSON.stringify(last?.hp)}`);
    }
  }
}

async function shootArena(browser, ctx) {
  console.log('\n── arena (1v1) ──');
  const rt = await newRv(browser, { profile: ctx.profile });
  try {
    const q = new URLSearchParams({
      pointerLock: '0', player: P.MATCHUP.player, enemy: P.MATCHUP.enemy,
      px: String(ctx.anchor.x), py: String(ctx.anchor.y),
    });
    const route = `/?${q}`;
    await rt.page.goto(`${ctx.base}${route}`, { waitUntil: 'networkidle' });
    const fonts = await fontsLoaded(rt);
    await rt.runTo(600, { batch: 1, gapMs: 15 });
    const sh = await suppressShake(rt);
    if (!sh.ok) throw new Error(`rv_capture: arena: cannot suppress shake — ${sh.why}`);
    const res = await fightAndShoot(rt, ctx, {
      name: 'arena', label: `1v1 action frame, ${P.MATCHUP.player} vs ${P.MATCHUP.enemy}`, seats: 2,
      budgetMs: P.BUDGET_1V1_MS,
      judge: (hist, contactAt, startHp) => judge1v1(hist, contactAt, startHp),
      decide: (r) => {
        const [mx, my] = driveQ1(r.slots[0], r.slots[1], ctx.anchor);
        const d = Math.hypot(r.slots[0].x - r.slots[1].x, r.slots[0].y - r.slots[1].y);
        return { mx, my, aim: r.screen?.[1], weapon: weaponFor(d, ctx.reach) };
      },
      extra: { route, fonts, anchor: ctx.anchor, matchup: P.MATCHUP, reach: ctx.reach },
    });
    return res;
  } finally { await rt.close(); }
}

async function shootArena6(browser, ctx) {
  console.log('\n── arena6 (six seats, shipped route: home -> lobby -> 6 -> Start) ──');
  const rt = await newRv(browser, { profile: ctx.profile });
  const steps = [];
  try {
    await rt.page.goto(`${ctx.base}/?screen=home&pointerLock=0`, { waitUntil: 'networkidle' });
    const fonts = await fontsLoaded(rt);
    await rt.runTo(1500, { batch: 1, gapMs: 15 });
    const at = async (what) => {
      const st = await rt.page.evaluate(() => ({ screen: window.__screen ?? null, url: location.pathname + location.search }));
      steps.push({ t: rt.now, what, ...st });
      console.log(`   t=${rt.now}ms ${what}: screen=${st.screen} url=${st.url}`);
      return st;
    };
    if ((await at('home settled')).screen !== 'home') throw new Error('rv_capture: arena6: home did not mount');
    await rt.page.click('.fa-home [data-el="mode"]');
    await rt.runTo(rt.now + 1500, { batch: 1, gapMs: 10 });
    if ((await at('after tapping the mode block')).screen !== 'lobby') throw new Error('rv_capture: arena6: the mode block did not open the lobby');
    await rt.page.click(`.fa-lobby .lobby-opt[data-seats="${P.SEATS6}"]`);
    await rt.runTo(rt.now + 400, { batch: 1, gapMs: 10 });
    const count = await rt.page.evaluate(() => document.querySelector('.fa-lobby [data-el="count"]')?.textContent ?? null);
    steps.push({ t: rt.now, what: 'lobby count chip', count });
    if (count !== String(P.SEATS6)) throw new Error(`rv_capture: arena6: lobby count chip reads ${count}, want ${P.SEATS6}`);
    await rt.page.click('.fa-lobby [data-el="start"]');
    await rt.runTo(rt.now + 600, { batch: 1, gapMs: 15 });
    const m = await at('after Start');
    if (m.screen !== 'match') throw new Error('rv_capture: arena6: Start did not reach the match');
    const route = await rt.page.evaluate(() => window.__shell?.route?.() ?? null);
    steps.push({ t: rt.now, what: 'shell route', route });
    if (!route || route.seats !== P.SEATS6) throw new Error(`rv_capture: arena6: the route carries seats=${route?.seats}, want ${P.SEATS6}`);
    const sh = await suppressShake(rt);
    if (!sh.ok) throw new Error(`rv_capture: arena6: cannot suppress shake — ${sh.why}`);
    const res = await fightAndShoot(rt, ctx, {
      name: 'arena6', label: `six-seat action frame (${route.player} + 5 bots)`, seats: P.SEATS6,
      budgetMs: P.BUDGET_6_MS,
      judge: (hist) => judge6(hist),
      decide: (r) => {
        const p = r.slots[0];
        const tgt = nearestOpponent(r.slots);
        if (!tgt) return { mx: 0, my: 0, aim: null };
        const e = r.slots[tgt.i];
        // Goal: the nearest bot DUEL, else the centre feature (where the innermost spawn pair
        // meets and the ring drives everyone). NOT the nearest opponent: on HEAD that walked
        // the local seat (91 HP) into a 1v1 with a 143 HP bot that killed it at 16 s.
        const fight = sixTarget(r.slots);
        const goal = fight ?? { x: ctx.anchor.x, y: ctx.anchor.y, d: Math.hypot(p.x - ctx.anchor.x, p.y - ctx.anchor.y) };
        let mx; let my;
        if (goal.d > 130) {
          // Walk to the goal by the arena's own cover map; shoot the nearest on the way.
          const wp = navNext(ctx.nav, p.x, p.y, goal.x, goal.y);
          const tx = wp ? wp.x : goal.x; const ty = wp ? wp.y : goal.y;
          mx = tx > p.x + 4 ? 1 : tx < p.x - 4 ? -1 : 0;
          my = ty > p.y + 4 ? 1 : ty < p.y - 4 ? -1 : 0;
        } else {
          [mx, my] = driveQ1(p, e, null);
        }
        return { mx, my, aim: r.screen?.[tgt.i], weapon: weaponFor(tgt.d, ctx.reach), goal: fight ? fight.pair : null };
      },
      extra: { route: route ? `match ${JSON.stringify(route)}` : null, routeSteps: steps, fonts, anchor: ctx.anchor, reach: ctx.reach },
    });
    return res;
  } finally { await rt.close(); }
}

// ═════════════════════════════════════════════════════════════════════════════
// CAST — q1_crops.mjs, as a subprocess, with the centre from THIS capture
// ═════════════════════════════════════════════════════════════════════════════

function makeCast(ctx, arenaRes) {
  console.log('\n── cast (q1_crops of arena.png) ──');
  const r = arenaRes.read;
  const p = r.screen[0]; const e = r.screen[1];
  const cx = ((p.x + e.x) / 2) / P.W;
  const cy = ((p.y + e.y) / 2) / P.H;
  const tmpTag = 'rvtmp';
  execFileSync('node', [join(REPO, 'tools/tmp/q1_crops.mjs'), '--ours', join(ctx.out, 'arena.png'), '--out', ctx.out,
    '--tag', tmpTag, '--cx', String(cx), '--cy', String(cy)], { stdio: 'inherit', cwd: REPO });
  const from = join(ctx.out, `cast_${tmpTag}.png`);
  const to = join(ctx.out, 'cast.png');
  renameSync(from, to);
  const sc = JSON.parse(readFileSync(`${from}.capture.json`, 'utf8'));
  rmSync(`${from}.capture.json`);
  const buf = readFileSync(to);
  sc.rv = { protocol: PROTOCOL, frame: 'cast', sha256: sha256(buf), centre: { cx, cy }, from: 'arena.png', via: 'tools/tmp/q1_crops.mjs' };
  writeFileSync(`${to}.capture.json`, JSON.stringify(sc, null, 2));
  console.log(`   ✓ cast.png  ${JSON.stringify(sc.derivedFrom.box)}  painted=${sc.painted}  sha ${sc.rv.sha256.slice(0, 12)}`);
  return { path: to, sidecar: sc };
}

// ═════════════════════════════════════════════════════════════════════════════
// --compare : the capture's own noise
// ═════════════════════════════════════════════════════════════════════════════

export async function compareImages(a, b, sharp) {
  const [A, B] = await Promise.all([a, b].map((p) => sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    return { sameSize: false, a: [A.info.width, A.info.height], b: [B.info.width, B.info.height] };
  }
  const n = A.info.width * A.info.height;
  const ch = A.info.channels;
  let px = 0; let sum = 0; let max = 0; let px8 = 0;
  for (let i = 0; i < n; i++) {
    let dmax = 0;
    for (let c = 0; c < ch; c++) {
      const d = Math.abs(A.data[i * ch + c] - B.data[i * ch + c]);
      sum += d;
      if (d > dmax) dmax = d;
    }
    if (dmax > 0) px++;
    if (dmax > 8) px8++;
    if (dmax > max) max = dmax;
  }
  return {
    sameSize: true, pixels: n, diffPx: px, diffFrac: +(px / n).toFixed(6), diffPxOver8: px8,
    meanAbs: +(sum / (n * ch)).toFixed(4), maxAbs: max,
  };
}

async function compareDirs(dirA, dirB) {
  const sharp = (await import('sharp')).default;
  const rows = [];
  for (const f of FRAME_ORDER) {
    const a = join(dirA, `${f}.png`); const b = join(dirB, `${f}.png`);
    if (!existsSync(a) || !existsSync(b)) { rows.push({ frame: f, missing: [!existsSync(a) && a, !existsSync(b) && b].filter(Boolean) }); continue; }
    const ha = sha256(readFileSync(a)); const hb = sha256(readFileSync(b));
    const d = await compareImages(a, b, sharp);
    let ta = null; let tb = null;
    try { ta = JSON.parse(readFileSync(`${a}.capture.json`, 'utf8')).rv?.virtual?.now ?? null; } catch { /* */ }
    try { tb = JSON.parse(readFileSync(`${b}.capture.json`, 'utf8')).rv?.virtual?.now ?? null; } catch { /* */ }
    rows.push({ frame: f, identical: ha === hb, shaA: ha.slice(0, 16), shaB: hb.slice(0, 16), tA: ta, tB: tb, ...d });
  }
  return rows;
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════

async function selftest() {
  const checks = [];
  const add = (ok, name, detail = '') => checks.push({ ok: !!ok, name, detail });

  // §0 inputs read from other tools
  const prof = q1SeededProfile();
  add(prof.economy?.trophies === 380 && prof.selected === 'hamburger', 'q1 SEEDED_PROFILE parses (380 trophies, hamburger)', JSON.stringify({ t: prof.economy?.trophies, s: prof.selected }));
  const k = q1AnchorK();
  add(k === 1.684, 'q1 ANCHOR_K parses', String(k));
  const arena = arenaOf(REPO);
  const anchor = anchorOf(arena, k);
  add(anchor.x === 1560 && anchor.y === 1000, 'anchor derives to q1\'s (1560,1000) on this map', JSON.stringify(anchor));
  // KNOWN-BAD for the parse: a source without the literal must THROW, not default.
  let threw = false;
  try { q1SeededProfile('/nonexistent'); } catch { threw = true; }
  add(threw, 'KNOWN-BAD: a missing q1_capture.mjs throws rather than defaulting');

  // §0b the weapon policy, from the tree's own REACH
  const reach = reachOf(REPO);
  add(reach.meleeQuick === 58 && reach.rangedClose === 98, 'REACH parses (meleeQuick 58, rangedClose 98)', JSON.stringify(reach));
  add(weaponFor(40, reach) === 0 && weaponFor(80, reach) === 1 && weaponFor(120, reach) === 2,
    'weaponFor: melee at 40, short at 80, long at 120', [40, 80, 120].map((d) => weaponFor(d, reach)).join(','));
  // KNOWN-BAD: q1's policy (always slot 1 = melee since 8a51df9) at the band's centre.
  add(weaponFor(92, reach) !== 0 && weaponFor(65, reach) !== 0,
    'KNOWN-BAD: inside the 45-140 band the melee slot is NOT chosen past meleeQuick', `${weaponFor(65, reach)},${weaponFor(92, reach)}`);

  // §1 nav
  const nav = buildNav(arena);
  const open = nav.block.reduce((s, b) => s + (b ? 0 : 1), 0);
  add(open > 1000 && open < nav.block.length, 'nav grid has open AND blocked cells', `${open}/${nav.block.length} open`);
  const wp = navNext(nav, 300, 810, anchor.x, anchor.y);
  add(!!wp, 'a path exists from spawns[0] to the anchor', JSON.stringify(wp));
  // KNOWN-BAD: walking the path must never step into a blocked cell
  let x = 300; let y = 810; let bad = 0; let steps = 0;
  for (; steps < 400; steps++) {
    const w = navNext(nav, x, y, anchor.x, anchor.y, 1);
    if (!w || w.arrived) break;
    x = w.x; y = w.y;
    const c = Math.floor(x / NAV_CELL); const r = Math.floor(y / NAV_CELL);
    if (nav.block[r * nav.cols + c]) bad++;
  }
  add(bad === 0 && Math.hypot(x - anchor.x, y - anchor.y) < 40, 'following the path reaches the anchor through open cells only', `${steps} steps, ${bad} blocked, end (${x},${y})`);

  // §2 the rules
  const mk = (now, a, b, extra = {}) => ({ now, phase: 'playing', viewSubject: 0, slots: [a, b], screen: [{ x: 700, y: 450 }, { x: 900, y: 450 }], ...extra });
  const F = (x, y, hp, alive = true) => ({ x, y, hp, alive });
  const h = [mk(10000, F(0, 0, 100), F(100, 0, 100)), mk(10064, F(0, 0, 100), F(100, 0, 90))];
  add(judge1v1(h, 5000).eligible, 'HOLDS: an established fight with a fresh hit is eligible', judge1v1(h, 5000).why.join(';'));
  add(!judge1v1(h, 5000, [100, 100]).eligible, 'KNOWN-BAD: a one-sided beating (player never hurt) is refused', judge1v1(h, 5000, [100, 100]).why.join(';'));
  add(judge1v1(h, 5000, [120, 100]).eligible, 'HOLDS: both fighters below their start HP is an exchange', judge1v1(h, 5000, [120, 100]).why.join(';'));
  add(!judge1v1(h, 9000).eligible, 'KNOWN-BAD: a fight 1 s old is refused (AFTER_CONTACT_MS)', judge1v1(h, 9000).why.join(';'));
  const dead = [h[0], mk(10064, F(0, 0, 100), F(100, 0, 0, false))];
  add(!judge1v1(dead, 5000).eligible, 'KNOWN-BAD: a dead fighter is refused', judge1v1(dead, 5000).why.join(';'));
  const aged = (k) => [mk(9936, F(0, 0, 100), F(100, 0, 100)), mk(10000, F(0, 0, 100), F(100, 0, 90)),
    ...Array.from({ length: k }, (_, i) => mk(10064 + 64 * i, F(0, 0, 100), F(100, 0, 90)))];
  add(judge1v1(aged(2), 5000).eligible, 'HOLDS: a hit 128 ms old is still fresh', judge1v1(aged(2), 5000).why.join(';'));
  add(!judge1v1(aged(4), 5000).eligible, 'KNOWN-BAD: a hit 256 ms old is refused (window 192)', judge1v1(aged(4), 5000).why.join(';'));
  const far = [mk(10000, F(0, 0, 100), F(300, 0, 100)), mk(10064, F(0, 0, 100), F(300, 0, 90))];
  add(!judge1v1(far, 5000).eligible, 'KNOWN-BAD: outside the band is refused', judge1v1(far, 5000).why.join(';'));
  const off = [h[0], { ...h[1], screen: [{ x: 700, y: 450 }, { x: 1590, y: 450 }] }];
  add(!judge1v1(off, 5000).eligible, 'KNOWN-BAD: a fighter off screen is refused', judge1v1(off, 5000).why.join(';'));
  // six
  const six = (n, hpDrop) => {
    const slots = Array.from({ length: 6 }, (_, i) => F(i * 50, 0, 100));
    const screen = slots.map((_, i) => (i < n ? { x: 600 + i * 60, y: 450 } : { x: -500, y: -500 }));
    const a = { now: 20000, phase: 'playing', viewSubject: 0, slots, screen };
    const b = { ...a, now: 20064, slots: slots.map((f, i) => (i === 1 && hpDrop ? { ...f, hp: 80 } : f)) };
    return [a, b];
  };
  add(judge6(six(3, true)).eligible, 'HOLDS: 3 on screen with a fresh hit is eligible', judge6(six(3, true)).why.join(';'));
  add(!judge6(six(2, true)).eligible, 'KNOWN-BAD: 2 on screen is refused', judge6(six(2, true)).why.join(';'));
  add(!judge6(six(4, false)).eligible, 'KNOWN-BAD: no fresh hit is refused', judge6(six(4, false)).why.join(';'));
  const offHit = six(3, false);
  offHit[1].slots[5] = { ...offHit[1].slots[5], hp: 50 };
  add(!judge6(offHit).eligible, 'KNOWN-BAD: a hit on an OFF-screen fighter does not count', judge6(offHit).why.join(';'));
  // KNOWN-BAD from the first live six-seat run: feet at y=50 are "inside a 40 px margin"
  // and the body is under the zone pill / off the top edge.
  const topEdge = six(3, true).map((r) => ({ ...r, screen: r.screen.map((p, i) => (i === 2 ? { x: p.x, y: 50 } : p)) }));
  add(!judge6(topEdge).eligible, 'KNOWN-BAD: a fighter whose feet project at y=50 does not count as in frame', judge6(topEdge).why.join(';'));
  const two = six(3, true).map((r) => ({ ...r, slots: r.slots.slice(0, 2), screen: r.screen.slice(0, 2) }));
  add(!judge6(two).eligible, 'KNOWN-BAD: a two-seat read is refused by the six-seat rule', judge6(two).why.join(';'));

  // §3 the diff instrument
  const sharp = (await import('sharp')).default;
  const tmp = join(REPO, 'shots/rv/r0/.selftest');
  mkdirSync(tmp, { recursive: true });
  const base = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 40, g: 120, b: 200 } } }).png().toBuffer();
  writeFileSync(join(tmp, 'a.png'), base);
  writeFileSync(join(tmp, 'b.png'), base);
  const one = await sharp(base).composite([{ input: { create: { width: 1, height: 1, channels: 3, background: { r: 41, g: 120, b: 200 } } }, left: 10, top: 10 }]).png().toBuffer();
  writeFileSync(join(tmp, 'c.png'), one);
  const same = await compareImages(join(tmp, 'a.png'), join(tmp, 'b.png'), sharp);
  const diff1 = await compareImages(join(tmp, 'a.png'), join(tmp, 'c.png'), sharp);
  add(same.diffPx === 0, 'HOLDS: identical images diff to 0 px', JSON.stringify(same));
  add(diff1.diffPx === 1 && diff1.maxAbs === 1, 'KNOWN-BAD: a ONE-level change in ONE pixel is detected', JSON.stringify(diff1));
  rmSync(tmp, { recursive: true, force: true });

  // §4 the page clock, exercised under a minimal fake window in Node
  const fakeWin = { requestAnimationFrame: () => 0, Date };
  const g = globalThis;
  const saved = { window: g.window, document: g.document, localStorage: g.localStorage, performance: g.performance, random: Math.random, Date: g.Date, st: g.setTimeout, ct: g.clearTimeout, si: g.setInterval, ci: g.clearInterval };
  try {
    g.window = g;
    g.document = { getAnimations: () => [] };
    g.localStorage = { setItem() {} };
    g.requestAnimationFrame = () => 0;
    const perf = { now: () => 123 };
    Object.defineProperty(g, 'performance', { value: perf, configurable: true, writable: true });
    RV_INIT({ protocol: PROTOCOL, seed: 1, epoch: 1000, storage: {} });
    const log = [];
    g.setTimeout(() => log.push('t30'), 30);
    g.setTimeout(() => log.push('t0'), 0);
    const iv = g.setInterval(() => log.push('iv'), 20);
    g.requestAnimationFrame((t) => { log.push(`raf${t}`); g.setTimeout(() => log.push('zeroInTick'), 0); });
    await g.__rv.frames(1, 16);
    const after1 = [...log];
    await g.__rv.frames(2, 16);
    g.clearInterval(iv);
    add(after1.join(',') === 't0,raf16', 'clock: frame 1 runs due timers in order, then rAF with the virtual timestamp', after1.join(','));
    add(log.join(',') === 't0,raf16,zeroInTick,iv,t30,iv', 'clock: zero-delay-in-tick defers; interval and later timer fire in time order', log.join(','));
    add(performance.now() === 48 && Date.now() === 1048, 'clock: performance.now and Date.now follow virtual time only', `${performance.now()} ${Date.now()}`);
    const r1 = Math.random(); const r2 = Math.random();
    add(r1 !== r2 && r1 >= 0 && r1 < 1, 'clock: Math.random is the seeded stream', `${r1} ${r2}`);
  } finally {
    Math.random = saved.random;
    g.Date = saved.Date;
    g.setTimeout = saved.st; g.clearTimeout = saved.ct; g.setInterval = saved.si; g.clearInterval = saved.ci;
    Object.defineProperty(g, 'performance', { value: saved.performance, configurable: true, writable: true });
    delete g.__rv; delete g.requestAnimationFrame; delete g.cancelAnimationFrame; delete g.requestIdleCallback; delete g.cancelIdleCallback;
    if (saved.document === undefined) delete g.document; else g.document = saved.document;
    if (saved.localStorage === undefined) delete g.localStorage; else g.localStorage = saved.localStorage;
    if (saved.window === undefined) delete g.window; else g.window = saved.window;
  }

  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} - ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
  const nOk = checks.filter((c) => c.ok).length;
  console.log(`\n${nOk === checks.length ? '✅ PASS' : '🔴 FAIL'}  rv_capture selftest: ${nOk}/${checks.length}`);
  return nOk === checks.length;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = parseArgs(process.argv);
  if (args.selftest) { process.exitCode = (await selftest()) ? 0 : 1; return; }
  if (args.compare) {
    const [a, b] = [args.compare, args._[0]];
    if (!a || !b) { console.error('usage: --compare <dirA> <dirB>'); process.exitCode = 2; return; }
    const rows = await compareDirs(resolve(a), resolve(b));
    for (const r of rows) console.log(JSON.stringify(r));
    if (args.json) writeFileSync(resolve(args.json), JSON.stringify({ a: resolve(a), b: resolve(b), at: new Date().toISOString(), rows }, null, 2));
    return;
  }

  const base = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  if (!base) { console.error('need --url or PREVIEW_BASE'); process.exitCode = 2; return; }
  if (base.includes(':5173')) { console.error('!! --url is the SHARED dev server. Never measure there.'); process.exitCode = 2; return; }
  const out = resolve(args.out ?? join(REPO, 'shots/rv/r0/cap'));
  const treeRoot = args.tree ? resolve(args.tree) : null;
  const only = args.only ? String(args.only).split(',') : ['home', 'select', 'home_phone', 'select_phone', 'arena', 'arena6'];
  mkdirSync(out, { recursive: true });

  const { chromium } = await import('playwright');
  const settle = await import('./settle.mjs');
  const hud = await import('./hs_hudguard.mjs');

  const arenaRoot = treeRoot ?? REPO;
  const arena = arenaOf(arenaRoot);
  const anchorK = q1AnchorK();
  const anchor = anchorOf(arena, anchorK);
  const profile = q1SeededProfile();
  const ctx = {
    out, base, settle, hud, profile, anchor, nav: buildNav(arena),
    debugAt: args['debug-at'] ? String(args['debug-at']).split(',').map(Number).sort((a, b) => a - b) : [],
    reach: reachOf(arenaRoot),
    nonCanonical: !!args['debug-at'],
    tree: treeProvenance(treeRoot),
    served: servedFingerprint(process.env.SNAPSHOT_DIR),
    toolSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
  };
  console.log(`rv_capture ${PROTOCOL}  base=${base}  out=${out}`);
  console.log(`  tree ${JSON.stringify(ctx.tree)}`);
  console.log(`  served ${JSON.stringify(ctx.served)}`);
  console.log(`  anchor (${anchor.x},${anchor.y}) = centre + ${anchorK} x potR ${arena.pot.radius}, from ${relative(REPO, arena.path) || arena.path}`);
  if (ctx.tree.dirty) console.log('  ⚠️ THE TREE IS DIRTY — these frames describe no commit');

  const report = {
    protocol: PROTOCOL, params: P, startedAt: new Date().toISOString(), base, out, tree: ctx.tree, served: ctx.served,
    anchor, anchorK, arenaFile: arena.path, profileSha256: sha256(Buffer.from(JSON.stringify(profile))),
    frames: {}, errors: [],
  };
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  ctx.browser = { version: browser.version(), launchArgs: LAUNCH_ARGS, platform: `${process.platform}/${process.arch}`, node: process.version };
  report.browser = ctx.browser;
  report.toolSha256 = ctx.toolSha256;
  const t0 = Date.now();
  try {
    // Warm the snapshot: a fresh Vite server's FIRST client can eat a dep-optimisation reload.
    {
      const w = await browser.newPage();
      await w.goto(`${base}/?screen=home&pointerLock=0`, { waitUntil: 'networkidle' }).catch(() => {});
      await w.close();
    }
    const run = async (name, fn) => {
      const s = Date.now();
      try {
        const res = await fn();
        const sc = res.sidecar ?? res.shot?.sidecar ?? null;
        report.frames[name] = { ok: true, realMs: Date.now() - s, sha256: sc?.rv?.sha256 ?? null, virtualMs: sc?.rv?.virtual?.now ?? res.read?.now ?? null };
        return res;
      } catch (e) {
        console.error(`   ✗ ${name}: ${String(e && e.message || e).slice(0, 600)}`);
        report.frames[name] = { ok: false, realMs: Date.now() - s, error: String(e && e.message || e).slice(0, 2000) };
        report.errors.push(name);
        return null;
      }
    };
    if (only.includes('home')) await run('home', () => shootHome(browser, ctx));
    if (only.includes('select')) await run('select', () => shootSelect(browser, ctx));
    if (only.includes('home_phone')) await run('home_phone', () => shootHome(browser, ctx, { name: 'home_phone', geometry: P.PHONE }));
    if (only.includes('select_phone')) await run('select_phone', () => shootSelect(browser, ctx, { name: 'select_phone', geometry: P.PHONE }));
    if (only.includes('arena')) {
      const a = await run('arena', () => shootArena(browser, ctx));
      if (a) {
        report.frames.arena.selection = a.shot.sidecar.rv.selection ? { t: a.shot.sidecar.rv.selection.t, contactAt: a.contactAt, verdict: a.shot.sidecar.rv.selection.verdict } : null;
        const c = await run('cast', async () => makeCast(ctx, a));
        if (c) report.frames.cast.sha256 = c.sidecar.rv.sha256;
      }
    }
    if (only.includes('arena6')) {
      const a6 = await run('arena6', () => shootArena6(browser, ctx));
      if (a6) report.frames.arena6.selection = { t: a6.shot.sidecar.rv.selection.t, verdict: a6.shot.sidecar.rv.selection.verdict };
    }
  } finally {
    await browser.close();
    report.realMs = Date.now() - t0;
    report.finishedAt = new Date().toISOString();
    writeFileSync(join(out, 'capture-report.json'), JSON.stringify(report, null, 2));
  }
  console.log(`\n${report.errors.length ? `🔴 ${report.errors.length} frame(s) FAILED: ${report.errors.join(', ')}` : '✅ all requested frames captured'}  (${(report.realMs / 1000).toFixed(0)} s real) -> ${out}`);
  process.exitCode = report.errors.length ? 1 : 0;
}

const isMain = (() => {
  try { return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (isMain) await main();
