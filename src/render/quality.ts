/**
 * Render quality tiers — the one place that decides how much a device pays.
 *
 * ── Why this file exists, and why it is this small ──────────────────────────
 * `docs/STATE.md` carried "mobile quality tiers + DPR cap" as NOT BUILT, with an
 * honest note attached: the settings screen ships no graphics row *because* the
 * renderer exposed no tier, and `settings.ts`'s own rule is that every control on it
 * changes something today. This module is the thing that row was waiting for.
 *
 * It has **no imports**. That is deliberate and load-bearing:
 *   * `toon.ts` is imported by every character and arena module, and `stage.ts` drags
 *     in the whole `postprocessing` bundle. The tier used to live in `toon.ts` to keep
 *     the post chain out of everyone's dependency graph; a leaf module with zero
 *     imports keeps that property and lets `settings.ts` (a menu screen that must not
 *     pull three.js in) read and write the preference for the price of one string.
 *   * `stage.ts` imports this; this must never import `stage.ts`. Live application is
 *     done by SUBSCRIPTION (`onQualityChange`), which is what keeps the cycle broken.
 *
 * ── The numbers here are hardware-independent, on purpose ───────────────────
 * `docs/LESSONS.md` §10: frame time cannot be measured in this repo — SwiftShader is
 * a CPU rasteriser and ~9-10 fps is a property of the harness, not of the game. So no
 * knob below was chosen from a timing. Every one of them moves a counter that is the
 * same number on an iPhone as it is here: draw calls, post-chain fill, render-target
 * bytes, program links, drawing-buffer pixels. Measured deltas are tabulated in
 * `TIERS` below and reproduced by `tools/tmp/perf_tier.mjs`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** The tier actually in force. Three, because a settings row needs a middle. */
export type RenderTier = 'high' | 'medium' | 'low';

/** What the PLAYER chose. `auto` means "believe the detector". */
export type QualityChoice = 'auto' | RenderTier;

/**
 * Everything a tier decides. One flat record per tier — no inheritance, no deltas —
 * so the whole policy is readable in one screenful and a probe can print it.
 */
export interface TierProfile {
  readonly tier: RenderTier;
  /** Player-facing name. `settings.ts` may relabel; nothing here reads it. */
  readonly label: string;
  /** One line of honest "what this actually changes", for a settings sub-row. */
  readonly blurb: string;
  /**
   * Hard ceiling on `renderer.setPixelRatio`. THE headline knob: phones report DPR
   * 3-4, so an uncapped buffer is 4-9x the pixels of a DPR-1 desktop, and this
   * project's post chain has a measured overdraw factor of 5.7 — every one of those
   * pixels is shaded ~6 times.
   */
  readonly pixelRatioCap: number;
  /** Scale on the shadow map's edge. 1 = 2048 in a match, i.e. exactly what shipped. */
  readonly shadowMapScale: number;
  /** Shadows at all. True on every shipped tier — see the note in `TIERS`. */
  readonly shadows: boolean;
  /** Bloom pass. Off on `low`: 16 draws and ~30% of the post chain's fill. */
  readonly bloom: boolean;
  /** SMAA. Off below `high`: 3 draws, 2 LUT textures, 1 program, ~4 Mpx of fill. */
  readonly smaa: boolean;
  /** MSAA samples on the composer's buffer, used where SMAA is not. Resolves on-chip. */
  readonly msaaSamples: number;
  /**
   * HalfFloat composer buffers. Kept on every tier — dropping to UnsignedByte on
   * `low` was measured and REJECTED; see the note in `TIERS`.
   */
  readonly halfFloatBuffers: boolean;
  /** Prop-scale ink outlines. Off on `low`: 318 hulls, 46 draws/frame. */
  readonly propInk: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// The policy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── What each tier costs, measured ──────────────────────────────────────────
 * `node tools/tmp/perf_tier.mjs --mode counts --scene match --query '&tier=X'`,
 * desktop 1300x740 @ DPR 1, against a frozen snapshot. Draw calls and triangles are
 * per frame; fill is post-chain megapixels shaded per frame.
 *
 *   tier    draws   tris    post fill  passes  shadowmap  content tex  rendertgt  progs
 *   high      574   336.4k   5.46 Mpx     3      2048      5.20 MB    70.93 MB    31
 *   medium    550   333.4k   2.57 Mpx     2      1536      4.85 MB    34.58 MB    28
 *   low       507   280.8k   0.96 Mpx     2      1024      4.85 MB    17.34 MB    25
 *
 * Read the fill column first — it is the one that matters on a phone. At DPR 1 the
 * draw buffer is 0.962 Mpx, so `high` shades every pixel 5.7 times and `low` shades it
 * once. Triangles wander ~0.3% run to run (live VFX); `low`'s -16% does not, and it is
 * not the post chain at all — it is the shadow pass losing casters, because halving the
 * map doubles `auditShadowCaster`'s texel-denominated cull radius. 105 outline hulls
 * survive on every tier: the arena's 318 prop hulls were merged to two draws by
 * `kitchen.ts` this session, which quietly took most of the value out of `propInk` as a
 * tier knob (it is now worth 1 draw, not 46).
 *
 * ...and the same three at a phone viewport (844x390 CSS) on a device reporting DPR 2
 * or more, where the DPR cap does the work it exists for:
 *
 *   tier    ratio   drawing buffer   buffer Mpx  draws  post fill   GPU total
 *   high     2.00      1688 x 780       1.317      601   7.46 Mpx   113.17 MB
 *   medium   1.50      1266 x 585       0.741      577   1.98 Mpx    83.66 MB
 *   low      1.25      1055 x 487       0.514      534   0.51 Mpx    51.25 MB
 *
 * -93% of post-chain fill and -55% of resident GPU memory, on hardware-independent
 * counters, for a tier a phone can be put on. Verified correct at `deviceScaleFactor`
 * 1, 2, 3 and 4 by `tools/tmp/dpr_probe.mjs` (24/24 combinations exact).
 *
 * One honest wrinkle in that memory column: MSAA is not free to allocate. On the
 * DESKTOP table `medium` totals 99.14 MB against `high`'s 95.13 — the 4x multisampled
 * renderbuffer (59.71 MB vs 19.00) costs more than the SMAA passes' render targets
 * save. It only comes out ahead once the DPR cap shrinks the buffer under it, which is
 * exactly the device it is for. Dropping `msaaSamples` to 2 would halve that
 * renderbuffer and is the obvious next knob if a phone turns out to be memory-bound.
 *
 * ── AND WHAT NO TIER COSTS: COLOUR ──────────────────────────────────────────
 * `docs/LESSONS.md` §7 — cumulative desaturation is a live concern on this project and
 * nobody was watching the sum. Measured with `tools/tmp/tier_colour.mjs` (six
 * `arena-scan` stations, ONE page load each, `requestAnimationFrame` frozen and the
 * tier driven live, so the three frames differ only by renderer configuration) and
 * scored by `tools/tmp/chroma.mjs`, the same code every colour figure on this project
 * came from:
 *
 *   tier      mean sat   chroma   warm 0-60   cool   mean luma
 *   high         0.396    0.278      0.0687  0.3226      0.360
 *   medium       0.396    0.278      0.0688  0.3227      0.360
 *   low          0.396    0.278      0.0688  0.3227      0.359
 *
 * Flat to the fourth decimal. A control capture (force the tier it is already on)
 * reproduced `low` exactly, so the freeze holds and those third-decimal wobbles are the
 * instrument, not the tiers.
 *
 * ── WHAT IS DELIBERATELY NOT A TIER KNOB, and why ───────────────────────────
 *
 * **Shadows stay on at every tier.** Turning the shadow pass off is by far the
 * largest single win available (measured 302 draws, 43.6% of a match frame) and it is
 * still the wrong trade: contact shadow is what grounds a character on this floor, and
 * `docs/STATE.md` records an entire bug class ("63% of prop grounding buried") that
 * exists because grounding cues went missing. The flag is here, wired, and set true
 * three times — the day someone wants a fourth "potato" tier it is a one-word change
 * with a known price. What `low` does instead is halve the map: 1024 across a 68 m
 * box is 4 MB instead of 16 MB of render target, and — because
 * `Stage.auditShadowCaster` expresses its cull threshold in TEXELS — the same 2.5
 * texels becomes a 16.6 cm world radius instead of 8.3 cm, so more sub-pixel casters
 * are demoted for free — measured, 524 casters on `high`, 484 on `medium`, 418 on `low`.
 *
 * ⚠️ A TRAP, recorded because it produced a plausible WRONG number here first. A probe
 * that sets `renderer.shadowMap.enabled = false` on a live frame reports **mean
 * 0.0000/255 — no image change whatsoever**, which reads exactly like "shadows are
 * worth nothing". They are not: the flag only takes effect when materials RECOMPILE,
 * so the frame is still sampling the shadow map that is already bound to it. Same
 * family as the `BlendFunction.SKIP` trap. The cost of turning shadows off was
 * therefore NOT measured here; the 302-draw figure above is `stage.ts`'s own recorded
 * measurement of the shadow PASS, which is a different quantity.
 *
 * **The rim light is not a tier knob.** A measured sweep at shipped framing put the
 * maximum available separation gain from touching it at +0.0024 / +0.0117 / 0.0000
 * across three characters, and it costs zero draw calls (a non-shadow directional
 * light adds uniforms, not passes). The only counter it could move is per-fragment
 * ALU, which is precisely what cannot be measured in this repo. Switching it off
 * would be an unmeasurable saving in exchange for a measured look cost.
 *
 * **SSAO is not a tier knob.** It is already off on every tier and contributed
 * EXACTLY 0.0000/255 at every framing in this project's history (see `buildPost`).
 * There is nothing for a tier to save.
 *
 * **8-bit composer buffers were measured and rejected.** `frameBufferType:
 * UnsignedByteType` on `low` would halve the two composer buffers — 4.1 MB back at a
 * phone-sized buffer, ~30% of `low`'s render-target budget — and with bloom already
 * off there is no HDR left in the chain that obviously needs the headroom. Measured
 * anyway, by mutating `__quality.tiers.low.halfFloatBuffers` on a frozen frame and
 * forcing a rebuild (`tools/tmp/ab_probe.mjs --name low-8bit`): **mean 0.8921/255, max
 * 74, 0.18% of pixels beyond 2**. That shape is the giveaway — a mean of 0.89 with
 * almost nothing above 2 is quantisation across the WHOLE frame, i.e. every smooth
 * gradient in the arena picking up a step, plus a real 74/255 excursion somewhere hot.
 * The grade is a saturation curve with a soft knee and the floor is one large smooth
 * gradient; this is precisely the image this project has spent the most rounds on. 4 MB
 * is not worth a band, so `halfFloatBuffers` is true on all three tiers and the knob is
 * left here, documented and priced, rather than deleted.
 */
export const TIERS: Readonly<Record<RenderTier, TierProfile>> = {
  high: {
    tier: 'high',
    label: 'High',
    blurb: 'Everything on. Full resolution, bloom and smooth edges.',
    pixelRatioCap: 2,
    shadowMapScale: 1,
    shadows: true,
    bloom: true,
    smaa: true,
    msaaSamples: 0,
    halfFloatBuffers: true,
    propInk: true,
  },
  medium: {
    tier: 'medium',
    label: 'Balanced',
    blurb: 'Lower resolution with hardware edge smoothing. Keeps bloom.',
    pixelRatioCap: 1.5,
    shadowMapScale: 0.75,
    shadows: true,
    bloom: true,
    smaa: false,
    msaaSamples: 4,
    halfFloatBuffers: true,
    propInk: true,
  },
  low: {
    tier: 'low',
    label: 'Battery saver',
    blurb: 'Lower resolution, no bloom, softer shadows. Best for phones.',
    pixelRatioCap: 1.25,
    shadowMapScale: 0.5,
    shadows: true,
    bloom: false,
    smaa: false,
    msaaSamples: 4,
    halfFloatBuffers: true,
    propInk: false,
  },
};

/** Row order for a settings control. `auto` first — it is the default. */
export const QUALITY_CHOICES: readonly QualityChoice[] = ['auto', 'high', 'medium', 'low'];

/** Player-facing name for any choice, including `auto`. */
export function qualityLabel(choice: QualityChoice): string {
  return choice === 'auto' ? 'Auto' : TIERS[choice].label;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'food-arena.quality.v1';

/**
 * Everything detection looked at, kept so a settings row can show its work and a bug
 * report can be diagnosed without the device in hand.
 *
 * `gpu` is filled in later by `Stage` (it needs a GL context, and this module must not
 * create one). It is DIAGNOSTIC ONLY — detection never reads it, because the first
 * Stage is built before any context exists and a tier that changed after the scene was
 * built would be a tier that half-applied.
 */
export interface QualitySignals {
  coarsePointer: boolean;
  maxTouchPoints: number;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  devicePixelRatio: number;
  screenShortEdgeCssPx: number;
  gpu: string | null;
}

let gpuName: string | null = null;

/** Called by `Stage` once, with `UNMASKED_RENDERER_WEBGL`. Diagnostics only. */
export function noteGpu(name: string | null): void {
  if (name && !gpuName) gpuName = name;
}

export function qualitySignals(): QualitySignals {
  const noWindow = typeof window === 'undefined' || typeof navigator === 'undefined';
  if (noWindow) {
    return {
      coarsePointer: false, maxTouchPoints: 0, deviceMemoryGb: null,
      hardwareConcurrency: null, devicePixelRatio: 1, screenShortEdgeCssPx: 9999, gpu: gpuName,
    };
  }
  const nav = navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number };
  return {
    coarsePointer: typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    devicePixelRatio: window.devicePixelRatio ?? 1,
    // Orientation-proof: iOS has swapped these between versions, so take the min of
    // both rather than trusting which one is "width".
    screenShortEdgeCssPx: Math.min(window.screen?.width ?? 9999, window.screen?.height ?? 9999),
    gpu: gpuName,
  };
}

/**
 * What `auto` picks, and the reasoning, in one place.
 *
 * ── The asymmetry that shapes this ──────────────────────────────────────────
 * A desktop wrongly demoted loses image quality nobody asked it to lose. A phone
 * wrongly promoted is exactly the situation shipped today. So detection is
 * conservative in ONE direction only: a device that is not clearly touch-primary
 * stays on `high`, and a phone starts low and lets the player upgrade.
 *
 * ── The signals, and what each is actually worth ────────────────────────────
 *   * `pointer: coarse` + `maxTouchPoints` — necessary but NOT sufficient: every
 *     touchscreen laptop reports both. Used only as a gate, never as evidence.
 *   * screen short edge in CSS px — the most reliable phone/tablet discriminator
 *     available without a GL context. A phone is ~360-430; a tablet is 768-1024.
 *   * `navigator.deviceMemory` — used in ONE direction only: <= 4 GB DEMOTES, and
 *     nothing here promotes on it. Three reasons, all of them things that were tried.
 *     It is undefined on every iPhone and iPad, so an iPhone 17 and a 2019 Android
 *     look identical to it. It is quantised to 0.25/0.5/1/2/4/8 and **8 is the spec's
 *     ceiling**, so a £150 Android reports the same 8 as a flagship. And under
 *     Chromium's own device emulation it reports the HOST's memory — a probe on an
 *     emulated phone read 16 GB and 18 cores, which promoted the phone and was caught
 *     only because `tools/tmp/quality_api.mjs` asserts the emulated tier. A signal
 *     that lies on the exact devices it is meant to describe may lower a tier and must
 *     never raise one.
 *   * `hardwareConcurrency` — kept in the signals for diagnostics, NOT used to pick.
 *     Same failure: 18 cores on an emulated phone.
 *   * `devicePixelRatio` — deliberately NOT used to pick a tier. A £120 Android
 *     reports DPR 3 exactly like a flagship does; it says how many pixels a device
 *     WANTS, not how many it can afford, and treating it as a capability signal
 *     would promote the cheapest hardware in the market.
 *
 * ⚠️ **The phone default is a judgement call, not a measurement**, and it is flagged
 * as such in the report that landed this file. Frame time cannot be measured here, so
 * "does a real iPhone hold 60 at `medium`?" is unanswerable in this repo. `low` is the
 * defensible default because it is the only one whose failure mode is "slightly softer
 * than it could have been" rather than "unplayable".
 */
export function detectTier(): RenderTier {
  const s = qualitySignals();
  // Touch is NECESSARY but not sufficient — every touchscreen laptop reports both.
  const touchPrimary = s.coarsePointer && s.maxTouchPoints > 0;
  if (!touchPrimary) return 'high';

  // A phone in CSS px. Nothing else is consulted: no signal available before a GL
  // context exists can tell a flagship phone from a cheap one, and guessing on one
  // that cannot is worse than a predictable floor the player can raise.
  if (s.screenShortEdgeCssPx <= 500) return 'low';

  // Tablet-sized touch device. Demoted only on a positive admission of weakness.
  // AUTO NEVER SELECTS `high` FOR A TOUCH DEVICE — that is the one direction this
  // asymmetry runs, and an iPad Pro owner reaches `high` through settings.
  if (s.deviceMemoryGb !== null && s.deviceMemoryGb <= 4) return 'low';
  return 'medium';
}

// ─────────────────────────────────────────────────────────────────────────────
// State: forced override > stored choice > detection
// ─────────────────────────────────────────────────────────────────────────────

let forced: RenderTier | null = null;
let storedChoice: QualityChoice | null = null;
let detected: RenderTier | null = null;
const listeners = new Set<(tier: RenderTier) => void>();

function readQuery(): RenderTier | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('tier');
    return q === 'low' || q === 'medium' || q === 'high' ? q : null;
  } catch {
    return null;
  }
}

function readStored(): QualityChoice {
  if (storedChoice) return storedChoice;
  let v: string | null = null;
  try {
    v = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-mode Safari throws on access. The session still runs, on `auto`.
  }
  storedChoice = v === 'high' || v === 'medium' || v === 'low' || v === 'auto' ? v : 'auto';
  return storedChoice;
}

/**
 * A tier pinned by `?tier=`, or null. A settings row MUST check this and disable
 * itself: while a URL override is in force the control cannot do what it says.
 */
export function forcedTier(): RenderTier | null {
  if (forced === null) forced = readQuery();
  return forced;
}

/** What `auto` resolves to on this device, cached — detection must not vary mid-frame. */
export function detectedTier(): RenderTier {
  if (!detected) detected = detectTier();
  return detected;
}

/** What the player picked. `auto` unless they have been to settings. */
export function qualityChoice(): QualityChoice {
  return readStored();
}

/** The tier in force right now. This is what the renderer reads. */
export function renderTier(): RenderTier {
  const f = forcedTier();
  if (f) return f;
  const c = readStored();
  return c === 'auto' ? detectedTier() : c;
}

/** The full knob set in force right now. */
export function tierProfile(): TierProfile {
  return TIERS[renderTier()];
}

/**
 * Set the player's choice, persist it, and apply it to every live Stage.
 *
 * ── What applies WHEN, stated because half of it is build-time ──────────────
 * Applied immediately, to every Stage already on screen: pixel-ratio cap (and the
 * resize that follows it), shadow-map resolution, and the post chain (rebuilt in
 * place — same renderer, same GL context, so `perf --mode leak` stays flat at 1).
 *
 * Applied at the NEXT scene build: ink outlines, because `outlineGroup` bakes hull
 * meshes when the character or the arena is constructed and there is nothing to
 * toggle afterwards. In practice this is invisible — settings is a menu route and the
 * match Stage and its arena are built on entering a match — but a player who changes
 * tier while a match is paused keeps that match's hulls until the next one.
 */
export function setQualityChoice(choice: QualityChoice): void {
  const before = renderTier();
  storedChoice = choice;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Non-fatal: honoured for this session, just not remembered.
  }
  const after = renderTier();
  publish();
  if (after !== before) for (const fn of [...listeners]) fn(after);
}

/**
 * QA/probe hook: force a tier for this session without persisting, or pass null to
 * go back to the stored choice. Kept under the old name because `toon.ts` has
 * re-exported it since the two-tier scaffold landed.
 */
export function setRenderTier(t: RenderTier | null): void {
  const before = renderTier();
  forced = t;
  const after = renderTier();
  publish();
  if (after !== before) for (const fn of [...listeners]) fn(after);
}

/**
 * Subscribe to tier changes. Returns an unsubscribe.
 *
 * This is the seam that keeps the dependency graph acyclic: `Stage` subscribes in its
 * constructor and unsubscribes in `dispose()`, so this module never has to know that
 * `Stage` exists.
 */
export function onQualityChange(fn: (tier: RenderTier) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * QA mirror. `window.__renderTier` predates this file and probes read it; `__quality`
 * is the full picture, including the setter, so a Playwright probe can drive a live
 * tier change without a reload — which is the only way to A/B two tiers against a
 * byte-identical sim state.
 */
function publish(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __renderTier?: RenderTier;
    __quality?: Record<string, unknown>;
  };
  w.__renderTier = renderTier();
  w.__quality = {
    tier: renderTier(),
    choice: qualityChoice(),
    forced: forcedTier(),
    detected: detectedTier(),
    profile: tierProfile(),
    // The live table. Exposed so a probe can A/B a single knob against an otherwise
    // byte-identical frame — the 8-bit-buffer question above was answered exactly this
    // way, by mutating `tiers.low.halfFloatBuffers` and forcing a rebuild.
    tiers: TIERS,
    signals: qualitySignals(),
    set: (c: QualityChoice) => setQualityChoice(c),
    force: (t: RenderTier | null) => setRenderTier(t),
  };
}

publish();
