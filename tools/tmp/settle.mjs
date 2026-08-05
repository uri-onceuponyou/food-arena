/**
 * The one place that knows when a screen is actually ON SCREEN.
 *
 * ── The defect this exists to kill ──────────────────────────────────────────────
 * `window.__screenReady === true` DOES NOT MEAN THE SCREEN IS VISIBLE.
 *
 * `shell.ts:navigate` sets the flag in the same tick it drops the curtain:
 *
 *     unmount(); mount(route);
 *     curtain.classList.remove('is-on');   // opacity 1 -> 0 over 0.14s
 *     window.__screenReady = true;         // <- the flag, RIGHT HERE
 *
 * and the freshly-mounted `.fa-screen` then runs `fa-screen-in 0.26s`, which is
 * `from { opacity: 0; transform: translateY(10px) scale(0.992) }`. Measured by
 * `tools/tmp/e2e_boot_probe.mjs`: at the instant the flag flips, `.fa-screen`
 * opacity is **0** and the curtain is still opaque. The same screen captured at
 * `__screenReady` and 2.5 s later scores stdev 26.16 / mean 71.7 against
 * stdev 96.08 / mean 133.4 — a 3.7x contrast difference on identical content,
 * because the early frame is the screen faded over the orange `.fa-bg` backdrop.
 *
 * It survived because it is INTERMITTENT: it only appeared on the third round trip
 * of `journey.mjs`, when cached thumbnails made the capture 0.3 s faster than the
 * animation. Every earlier trip was accidentally slow enough.
 *
 * `window.__previewReady` is no better: `shell.ts:mount` sets it two rAFs after the
 * append, i.e. two frames INTO the same 0.26 s animation.
 *
 * ── Why waiting on computed opacity, and not on a longer sleep ──────────────────
 * A fixed sleep re-introduces exactly the timing dependence that hid this for a
 * whole session, and `docs/LESSONS.md` §10 already records a fixed timeout
 * manufacturing a fake "blank roster card" bug that a critic then scored twice.
 * The condition below is a statement about the page's own rendered state, so it is
 * correct at any machine speed rather than merely long enough on this one.
 *
 * ── What is checked, and why each clause is here ────────────────────────────────
 *  1. `#boot`  — index.html's boot overlay is z-index 200 and is never removed from
 *     the DOM, only faded (`transition: opacity .4s`) one rAF after main.ts runs.
 *     A capture inside that window is the purple boot gradient over everything.
 *     `journey.mjs`'s `settle()` does NOT check this.
 *  2. `.fa-curtain` — opacity must be down, not merely `.is-on` removed. The class
 *     comes off in the same tick as the flag; the 0.14 s transition has not started.
 *  3. The mounted screen's EFFECTIVE opacity (the product up the ancestor chain, so
 *     an inherited fade counts) must be >= 0.99.
 *  4. No finite animation may still be RUNNING on the screen root, `.fa-stack` or
 *     `.fa-root`. This is what actually pins `fa-screen-in`, `fa-open-slam` and
 *     `fa-sheet-in` to completion. Infinite animations (`fa-rays-spin`,
 *     `fa-btn-pulse`, `fa-card-sheen`, `fa-home-ready`) are skipped, or nothing on
 *     this project would ever settle.
 *  5. The screen's transform must be identity to within 0.5px / 0.002 scale.
 *     `getBoundingClientRect()` INCLUDES transforms, so every geometry assertion in
 *     `menu_accept` — tap targets against 44px, gutters, overlap — reads 0.992x its
 *     true size and 10px low while `fa-screen-in` runs. That is a silent 0.4px bias
 *     on a 44.0px minimum.
 *  6. The whole predicate must hold for two consecutive animation frames, so a
 *     value sampled exactly on a keyframe boundary cannot pass by accident.
 *
 * ── What the frame-statistics floor does and does NOT catch ─────────────────────
 * `assertFrame()` is a BACKSTOP, not the fade test. A mid-fade frame still scores
 * stdev 26 — well above any blank-screen floor — so the floor catches the flat
 * classes (white screen, black screen, curtain, boot overlay) and the opacity
 * bracket catches the fade. Both are checked, and `captureSettled()` re-reads the
 * paint state AFTER the screenshot as well as before, because a Playwright
 * screenshot is not instantaneous and a navigation racing it would otherwise be
 * invisible.
 */

import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

/** Thrown when a capture is refused. Never swallow this — it means the number is wrong. */
export class CaptureRefused extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'CaptureRefused';
    this.detail = detail;
  }
}

/**
 * Evaluated IN THE PAGE. Returns a full diagnostic, not a boolean, so the same
 * function serves the wait, the pre/post capture bracket and the failure message.
 */
export function paintStateFn() {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 1; };
  const out = {
    t: Date.now(),
    hasShell: false,
    screenClass: null,
    screenOpacity: null,
    effectiveOpacity: null,
    curtainOpacity: null,
    bootOpacity: null,
    runningAnims: [],
    transform: null,
    rect: null,
    screenName: typeof window.__screen === 'string' ? window.__screen : null,
    screenReady: window.__screenReady === true,
    previewReady: window.__previewReady === true,
    why: [],
    ok: false,
  };

  const boot = document.getElementById('boot');
  if (boot) {
    const bs = getComputedStyle(boot);
    out.bootOpacity = bs.display === 'none' ? 0 : num(bs.opacity);
  }

  const root = document.querySelector('.fa-root');
  const stack = document.querySelector('.fa-stack');
  const curtain = document.querySelector('.fa-curtain');
  if (curtain) {
    const cs = getComputedStyle(curtain);
    out.curtainOpacity = cs.display === 'none' ? 0 : num(cs.opacity);
  }
  out.hasShell = !!stack;

  const screen = stack ? stack.lastElementChild : null;
  if (screen) {
    const cs = getComputedStyle(screen);
    out.screenClass = typeof screen.className === 'string' ? screen.className : '';
    out.screenOpacity = num(cs.opacity);
    out.transform = cs.transform;
    let eff = 1;
    for (let n = screen; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') { eff = 0; break; }
      eff *= num(s.opacity);
    }
    out.effectiveOpacity = eff;
    const r = screen.getBoundingClientRect();
    out.rect = { w: Math.round(r.width), h: Math.round(r.height) };

    // Only the shell chrome and the screen ROOT. `getAnimations()` without
    // `{subtree:true}` returns animations targeting that element alone, which is
    // exactly the entry animations and none of the decorative descendants.
    for (const el of [screen, stack, root]) {
      if (!el) continue;
      for (const a of el.getAnimations()) {
        let iterations = 1;
        try { iterations = a.effect?.getComputedTiming?.().iterations ?? 1; } catch { /* ignore */ }
        if (!Number.isFinite(iterations)) continue;      // infinite decoration
        if (a.playState !== 'running') continue;
        out.runningAnims.push(a.animationName ?? a.transitionProperty ?? a.constructor.name);
      }
    }
  }

  const why = [];
  if (out.bootOpacity !== null && out.bootOpacity > 0.01) {
    why.push(`#boot overlay still up (opacity ${out.bootOpacity.toFixed(3)})`);
  }
  if (out.curtainOpacity !== null && out.curtainOpacity > 0.01) {
    why.push(`.fa-curtain still up (opacity ${out.curtainOpacity.toFixed(3)})`);
  }
  if (stack) {
    if (!screen) {
      why.push('no screen mounted in .fa-stack');
    } else {
      if (!(out.effectiveOpacity >= 0.99)) {
        why.push(`screen effective opacity ${out.effectiveOpacity.toFixed(3)} (own ${out.screenOpacity.toFixed(3)})`);
      }
      if (!(out.rect.w >= 4 && out.rect.h >= 4)) why.push(`screen has no box (${out.rect.w}x${out.rect.h})`);
      if (out.runningAnims.length) why.push(`entry animation running: ${out.runningAnims.join(', ')}`);
      const m = out.transform && out.transform.startsWith('matrix')
        ? out.transform.replace(/^matrix3?d?\(|\)$/g, '').split(',').map(Number)
        : null;
      if (m && m.length === 6) {
        if (Math.abs(m[0] - 1) > 0.002 || Math.abs(m[3] - 1) > 0.002
          || Math.abs(m[4]) > 0.5 || Math.abs(m[5]) > 0.5) {
          why.push(`screen transform not identity: ${out.transform}`);
        }
      }
    }
  }
  out.why = why;
  out.ok = why.length === 0;
  return out;
}

/** One sample of the page's paint state. Cheap; safe to call around a capture. */
export async function paintState(page) {
  return page.evaluate(paintStateFn);
}

/**
 * Block until the screen is genuinely painted.
 *
 * Returns the final paint state. Throws `CaptureRefused` on timeout unless
 * `{ soft: true }`, in which case it returns the last state with `ok:false` — only
 * for probes that deliberately want to look at an unsettled page.
 */
export async function settleScreen(page, opts = {}) {
  const timeout = opts.timeout ?? 30_000;
  const t0 = Date.now();
  let last = null;
  // Polled from Node rather than through `waitForFunction`, deliberately: the
  // predicate is a STATE, not an event, so nothing can be missed between polls, and
  // this keeps one copy of the predicate instead of a stringified second one.
  while (Date.now() - t0 < timeout) {
    // eslint-disable-next-line no-await-in-loop
    last = await paintState(page);
    if (last.ok) {
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      // eslint-disable-next-line no-await-in-loop
      const again = await paintState(page);
      if (again.ok) { again.settleMs = Date.now() - t0; return again; }
      last = again;
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(50);
  }
  if (opts.soft) return last;
  throw new CaptureRefused(
    `screen never reached full paint within ${timeout}ms${opts.label ? ` [${opts.label}]` : ''}: `
    + (last ? last.why.join('; ') : 'no state'),
    last,
  );
}

/**
 * Wait for the roster's ELEVEN portraits, by outcome rather than by flag.
 *
 * `window.__thumbsReady` is the documented condition and it is far better than a
 * timeout, but it is not airtight: `thumbs.ts:requestThumbnails` returns early at
 * `if (generating) return;` BEFORE it writes `__thumbsReady = false`, so a roster
 * mounted while home's single-portrait generation is still in flight can observe a
 * STALE `true`. `characterSelect.ts` adds `has-render` to a card the moment its
 * portrait lands, so counting those asks about the outcome instead of the symptom
 * (`docs/LESSONS.md` §13).
 *
 * Both are required: the flag, and then every card actually carrying its render.
 *
 * `[data-char]` is load-bearing, not tidiness: `characterSelect.ts` appends a TWELFTH
 * `.chars-card chars-card--locked` "More soon" tile which has no character and can
 * never gain `has-render`. Selecting on `.chars-card` alone would wait for a portrait
 * that does not exist and then fail the whole battery — the exact shape of bug this
 * helper exists to prevent.
 */
export async function waitForRoster(page, opts = {}) {
  const timeout = opts.timeout ?? 600_000;
  const t0 = Date.now();
  const count = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('.chars-card[data-char]')];
    return {
      total: all.length,
      painted: all.filter((c) => c.classList.contains('has-render')
        && !!c.querySelector('[data-el="render"]')?.getAttribute('src')).length,
      flag: window.__thumbsReady === true,
    };
  });
  await page.waitForFunction(
    () => {
      const all = [...document.querySelectorAll('.chars-card[data-char]')];
      if (all.length === 0) return false;
      const painted = all.filter((c) => c.classList.contains('has-render')
        && !!c.querySelector('[data-el="render"]')?.getAttribute('src')).length;
      return window.__thumbsReady === true && painted === all.length;
    },
    null,
    { timeout, polling: 1000 },
  );
  return { ms: Date.now() - t0, ...(await count()) };
}

/**
 * Wait for a timed CONTENT fade to finish, by outcome.
 *
 * `home.ts` fades its "Tap to taunt" hint on a `setTimeout(..., 4200)` plus a 0.6 s
 * CSS transition — a JS timeline no paint condition can predict, which is why
 * `home_metrics.mjs` sat on a 6000 ms sleep. The sleep stays as a floor, but this is
 * the actual condition, so a slow machine waits longer instead of measuring a
 * half-faded hint. Satisfied if the element is absent or `display:none` (several
 * viewports hide the hint entirely).
 */
export async function waitForFaded(page, selector, opts = {}) {
  const timeout = opts.timeout ?? 20_000;
  try {
    await page.waitForFunction(
      ({ sel, max }) => {
        const el = document.querySelector(sel);
        if (!el) return true;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return true;
        return Number(s.opacity) <= max;
      },
      { sel: selector, max: opts.max ?? 0.02 },
      { timeout, polling: 200 },
    );
    return true;
  } catch {
    return false;
  }
}

/** Max-channel stdev / mean / dynamic range of a PNG. Buffer or path. */
export async function frameStats(src) {
  const buf = Buffer.isBuffer(src) ? src : await readFile(src);
  const st = await sharp(buf).stats();
  const rgb = st.channels.slice(0, 3);
  return {
    stdev: +Math.max(...rgb.map((c) => c.stdev)).toFixed(2),
    mean: +(rgb.reduce((s, c) => s + c.mean, 0) / rgb.length).toFixed(1),
    min: Math.min(...rgb.map((c) => c.min)),
    max: Math.max(...rgb.map((c) => c.max)),
  };
}

/**
 * The frame-statistics floor.
 *
 * This is a BACKSTOP for the flat classes — a white screen, a black screen, the
 * curtain, the boot overlay, a screen that mounted and rendered nothing. It is NOT
 * the fade test: a mid-fade frame scores stdev ~26 and would clear any sane blank
 * floor. The fade is caught by the opacity bracket in `captureSettled`.
 *
 * 8.0 is ~2x `journey.mjs`'s `blank` threshold of 4 and ~4x below the lowest settled
 * menu frame measured by `tools/tmp/settle_validate.mjs`.
 */
export const FRAME_FLOOR = 8.0;

export function assertFrame(stats, opts = {}) {
  const floor = opts.floor ?? FRAME_FLOOR;
  if (stats.stdev < floor) {
    throw new CaptureRefused(
      `captured frame is FLAT (max-channel stdev ${stats.stdev} < floor ${floor})`
      + `${opts.label ? ` [${opts.label}]` : ''} — mean ${stats.mean}, range ${stats.min}..${stats.max}.`
      + ' A blank/curtain/boot frame was about to be measured as if it were the screen.',
      stats,
    );
  }
  return stats;
}

/**
 * Refuse a paint state that is not fully painted. This is the guard, and it is the
 * SAME call `captureSettled` makes, so `settle_validate.mjs` proving it rejects a
 * real mid-fade sample proves the production path rejects one too.
 */
export function assertPainted(state, label = '') {
  if (state && state.ok) return state;
  throw new CaptureRefused(
    `capture taken MID-FADE${label ? ` [${label}]` : ''}: `
    + `${state ? state.why.join('; ') : 'no paint state'}.`
    + ' This is the __screenReady defect — the flag flips in the same tick the curtain drops,'
    + ' 0.26s before .fa-screen finishes fa-screen-in.',
    state,
  );
}

/**
 * Settle, capture, and REFUSE the capture if the page was not painted on either
 * side of the shutter.
 *
 * `opts`:
 *   path       write the PNG here (optional)
 *   label      appears in every failure message
 *   floor      frame-statistics floor (default FRAME_FLOOR)
 *   element    an ElementHandle/Locator to shoot instead of the page
 *   timeout    screenshot timeout (default 120s — SwiftShader is slow)
 *   wait       false to shoot RIGHT NOW without settling (validation only)
 *   enforce    false to record the guards without throwing (validation only)
 */
export async function captureSettled(page, opts = {}) {
  const label = opts.label ?? '';
  const enforce = opts.enforce !== false;
  let settle = null;
  if (opts.wait !== false) settle = await settleScreen(page, { label, timeout: opts.settleTimeout });

  const before = await paintState(page);
  const target = opts.element ?? page;
  const buf = await target.screenshot({ timeout: opts.timeout ?? 120_000 });
  const after = await paintState(page);

  const stats = await frameStats(buf);
  if (opts.path) {
    await writeFile(opts.path, buf);
    // PROVENANCE. A PNG on disk carries no record of how it was taken, which is how a
    // washed frame ends up inside a blind critic packet with nobody able to tell. Every
    // guarded capture drops a sidecar beside itself; `tools/review.mjs` reads it and
    // refuses to build a packet from a capture that was NOT painted.
    await writeFile(`${opts.path}.capture.json`, JSON.stringify({
      tool: opts.tool ?? process.argv[1]?.split('/').pop() ?? 'unknown',
      label, takenAt: new Date().toISOString(),
      painted: before.ok && after.ok,
      enforced: enforce,
      stats,
      before: { ok: before.ok, why: before.why, effectiveOpacity: before.effectiveOpacity, screen: before.screenName },
      after: { ok: after.ok, why: after.why, effectiveOpacity: after.effectiveOpacity, screen: after.screenName },
    }, null, 2));
  }

  if (enforce) {
    assertPainted(before.ok ? after : before, label);
    assertFrame(stats, { floor: opts.floor, label });
  }
  return { buf, stats, before, after, settle, painted: before.ok && after.ok };
}

/**
 * Format a paint state for a log line.
 */
export function describe(state) {
  if (!state) return 'no state';
  const p = (v) => (v === null || v === undefined ? '-' : Number(v).toFixed(3));
  return `screen=${state.screenName} eff=${p(state.effectiveOpacity)} own=${p(state.screenOpacity)}`
    + ` curtain=${p(state.curtainOpacity)} boot=${p(state.bootOpacity)}`
    + ` anims=[${state.runningAnims.join(',')}] ${state.ok ? 'PAINTED' : `NOT-PAINTED (${state.why.join('; ')})`}`;
}
