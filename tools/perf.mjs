#!/usr/bin/env node
/**
 * perf.mjs — the repeatable performance harness for Food Fight Arena.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 *  READ THIS BEFORE TRUSTING ANY NUMBER THIS TOOL PRINTS
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Every headless browser available here rasterises with **SwiftShader, on the CPU**.
 * The project has measured ~9-10 fps under it. That number is not a performance
 * signal — it is a property of the harness. It has already caused one wrong
 * conclusion on this project (an agent polling an analyser from rAF at SwiftShader's
 * frame rate missed 4 of 5 audio events and reported the game as nearly silent).
 *
 * So this tool refuses to report frame time as performance. Instead it reports
 * quantities that a GPU cannot change:
 *
 *   HARDWARE-INDEPENDENT (report these; they are the same on an iPhone)
 *     • draw calls per frame, split per render pass
 *     • triangles per frame
 *     • shader programs, and how many link events boot costs
 *     • fullscreen fill — post-chain pixels shaded per frame (the mobile killer)
 *     • texture bytes uploaded to the GPU, split content vs render-target
 *     • live WebGL contexts
 *     • bytes allocated per frame by JS (GC pressure) — V8 allocation does not
 *       depend on the rasteriser
 *     • scene structure: meshes, unique geometries, materials, outline hulls
 *
 *   NOT TRUSTWORTHY HERE (printed only when asked, and always labelled)
 *     • fps, frame time, ms/pass, GPU timings — SwiftShader
 *     • shader COMPILE/LINK milliseconds — SwiftShader's compiler, not a real driver
 *     • anything derived from how many frames elapsed in a wall-clock window
 *
 * ═════════════════════════════════════════════════════════════════════════════
 *  USAGE
 * ═════════════════════════════════════════════════════════════════════════════
 *
 *   node tools/perf.mjs --mode counts  --scene match                 # default
 *   node tools/perf.mjs --mode counts  --scene all --device mobile
 *   node tools/perf.mjs --mode ablate  --scene match-vfx --samples 8 # costs vs shows
 *   node tools/perf.mjs --mode alloc   --scene match --frames 120    # GC pressure
 *   node tools/perf.mjs --mode boot    --scene match,home            # boot, by file
 *   node tools/perf.mjs --mode leak                                  # home->match->home
 *
 * Scenes: match, match-fast, match-vfx, home, characters, trophies,
 *         preview-arena, preview-char, or `all`.
 *
 * Common flags
 *   --url  http://localhost:5188   base URL (START YOUR OWN VITE; :5173 is shared)
 *   --w --h                        viewport (default 1300x740; --device mobile for 844x390)
 *   --device desktop|mobile|tablet|ultrawide
 *   --frames N                     frames to sample (default 60)
 *   --samples N                    ablate only: how many DIFFERENT combat moments to
 *                                  re-measure image contribution at (default 5). One
 *                                  frozen frame cannot answer "does this pass ever show".
 *   --json path                    write the full report as JSON
 *   --baseline path                compare against a previous --json and flag regressions
 *
 * Menus and preview plates render too slowly under SwiftShader (or not at all, for a
 * static plate) to hand over frames passively. The tool detects that and drives
 * `stage.render()` itself, marking the run `driven: true`. Counts are unaffected —
 * no counter here depends on who called render.
 *
 * REGRESSION USE: `--json perf/base.json` once, then `--baseline perf/base.json` on
 * every later run. Anything outside the tolerance is printed as a REGRESSION line and
 * the process exits 1, so this can gate a commit.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { settleScreen } from './tmp/settle.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────────────
const argv = process.argv;
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);

const MODE = arg('--mode', 'counts');
const BASE = arg('--url', 'http://localhost:5188').replace(/\/$/, '');
const FRAMES = Number(arg('--frames', 60));
const JSON_OUT = arg('--json', null);
const BASELINE = arg('--baseline', null);
const VERBOSE_TIMING = flag('--unsafe-timing');

const DEVICES = {
  desktop: { w: 1300, h: 740, dpr: 1 },
  mobile: { w: 844, h: 390, dpr: 2 }, // iPhone 14 landscape CSS px, DPR capped by Stage
  tablet: { w: 1024, h: 768, dpr: 2 },
  ultrawide: { w: 1720, h: 720, dpr: 1 },
};
const dev = DEVICES[arg('--device', 'desktop')] ?? DEVICES.desktop;
const W = Number(arg('--w', dev.w));
const H = Number(arg('--h', dev.h));
const DPR = Number(arg('--dpr', dev.dpr));

/** Scenes. `ready` is the in-page predicate that says "this scene is fully up". */
const SCENES = {
  match: {
    url: `/?player=hamburger&enemy=donut`,
    ready: `window.__gameReady === true`,
    settle: `document.querySelector('.hud-countdown')?.style.display === 'none'`,
  },
  'match-fast': {
    url: `/?player=hamburger&enemy=donut&simSpeed=12`,
    ready: `window.__gameReady === true`,
    settle: `document.querySelector('.hud-countdown')?.style.display === 'none'`,
  },
  // Lollipop's giantSlam is the brightest VFX in the game. Bloom exists for hot
  // highlights, so any claim that bloom contributes nothing has to survive THIS
  // matchup, not just a hamburger throwing patties.
  'match-vfx': {
    url: `/?player=lollipop&enemy=pizza&simSpeed=12`,
    ready: `window.__gameReady === true`,
    settle: `document.querySelector('.hud-countdown')?.style.display === 'none'`,
  },
  home: { url: `/?screen=home`, ready: `window.__screenReady === true && window.__screen === 'home'` },
  characters: {
    url: `/?screen=characters`,
    ready: `window.__screenReady === true && window.__screen === 'characters'`,
    settle: `window.__thumbsReady === true`,
  },
  trophies: { url: `/?screen=trophies`, ready: `window.__screenReady === true` },
  'preview-arena': { url: `/preview.html?piece=arena&view=gameplay`, ready: `window.__previewReady === true` },
  'preview-char': { url: `/preview.html?piece=character&id=hamburger&anim=idle&t=1.5`, ready: `window.__previewReady === true` },
};
const SCENE_ARG = arg('--scene', 'match');
const SCENE_NAMES = SCENE_ARG === 'all' ? Object.keys(SCENES) : SCENE_ARG.split(',');

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--js-flags=--expose-gc',
];

// ─────────────────────────────────────────────────────────────────────────────
// The in-page GL instrument.
//
// Installed with addInitScript so it wraps the prototypes BEFORE the app creates a
// context. It counts; it does not time. Every counter here survives a change of GPU.
//
// NOTE: it is deliberately NOT installed in `alloc` mode. Wrapper functions allocate,
// and measuring allocation through an allocating instrument is how you get a number
// that describes the instrument.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `Stage` publishes itself as `window.__stage`, a single slot, so the LAST stage
 * constructed wins. On the menus that is `thumbs.ts`'s short-lived offscreen stage,
 * which then disposes itself — leaving every QA probe in this project reading a dead
 * Stage on any menu route. Replace the slot with a registry so the tool can always
 * find the stage that is actually on screen. (Reported, not fixed — src/ is read-only
 * for this task.)
 */
const STAGE_REGISTRY = `
/**
 * "On screen" cannot be decided by isConnected — thumbs.ts parks its generator host
 * at left:-9999px, which is connected, laid out and 448px wide. Intersect the canvas
 * rect with the viewport instead; that is the only test the parked host fails.
 */
window.__onScreen = function (stage) {
  const c = stage && stage.canvas;
  if (!c || !c.isConnected) return false;
  const r = c.getBoundingClientRect();
  return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 &&
         r.left < window.innerWidth && r.top < window.innerHeight;
};
function installStageRegistry() {
  const stages = [];
  window.__stages = stages;
  Object.defineProperty(window, '__stage', {
    configurable: true,
    get() {
      const live = stages.filter((s) => !s.disposed);
      return live.filter(window.__onScreen).pop() || live.pop() || stages[stages.length - 1];
    },
    set(v) { if (v && !stages.includes(v)) stages.push(v); },
  });
}
`;

const GL_INSTRUMENT = STAGE_REGISTRY + `(() => {
  const P = {
    contexts: [],
    ctx2d: [],
    draws: 0, tris: 0, useProgram: 0, bindTexture: 0, bindFramebuffer: 0,
    fillPx: 0,
    programsCreated: 0, programsLinked: 0, shadersCompiled: 0,
    linkMsUnsafe: 0,
    texContent: [], texTarget: [], renderbuffers: [], texFreedBytes: 0,
    _texBytes: new Map(),
  };
  window.__perf = P;

  // bytes per pixel, keyed by the (format, type) or sized internalformat the app uses.
  const SIZED = {
    0x8058:4,   // RGBA8
    0x8F97:4,   // RGBA8_SNORM
    0x8C43:4,   // SRGB8_ALPHA8
    0x881A:8,   // RGBA16F
    0x8814:16,  // RGBA32F
    0x8815:12,  // RGB32F
    0x881B:6,   // RGB16F
    0x8C3A:4,   // R11F_G11F_B10F
    0x8229:1,   // R8
    0x822B:2,   // RG8
    0x822D:2,   // R16F
    0x822F:4,   // RG16F
    0x8236:4,   // R32F  (also RG32F 0x8230)
    0x8230:8,   // RG32F
    0x8D62:2,   // RGB565
    0x8051:3,   // RGB8
    0x8C41:3,   // SRGB8
    0x81A5:2,   // DEPTH_COMPONENT16
    0x81A6:4,   // DEPTH_COMPONENT24
    0x8CAC:4,   // DEPTH_COMPONENT32F
    0x88F0:4,   // DEPTH24_STENCIL8
    0x8CAD:8,   // DEPTH32F_STENCIL8
    0x8D48:2,   // STENCIL_INDEX8 (1, padded)
    0x8D46:2, 0x8D47:3, 0x8D49:2,
  };
  const TYPE_BYTES = { 0x1401:1, 0x1403:2, 0x8D61:2, 0x1406:4, 0x8033:2, 0x8034:2, 0x8363:2, 0x1405:4, 0x84FA:4 };
  const FMT_CH = { 0x1908:4, 0x1907:3, 0x1903:1, 0x8227:2, 0x1902:1, 0x84F9:1, 0x8D99:4, 0x8228:3, 0x8D98:3, 0x8D94:1 };
  function bytesFor(internalformat, format, type, w, h) {
    if (SIZED[internalformat]) return SIZED[internalformat] * w * h;
    const ch = FMT_CH[format] ?? 4;
    const tb = TYPE_BYTES[type] ?? 1;
    return ch * tb * w * h;
  }

  /** Labels that mean "nothing was ever uploaded here" — i.e. a render target. */
  const EMPTY = { allocated: 1, 'render-target/empty': 1 };
  function labelOf(pixels) {
    if (pixels == null) return 'render-target/empty';
    if (typeof HTMLCanvasElement !== 'undefined' && pixels instanceof HTMLCanvasElement) return 'canvas2d';
    if (typeof ImageBitmap !== 'undefined' && pixels instanceof ImageBitmap) return 'imagebitmap';
    if (typeof HTMLImageElement !== 'undefined' && pixels instanceof HTMLImageElement) return 'image';
    if (typeof ImageData !== 'undefined' && pixels instanceof ImageData) return 'imagedata';
    if (ArrayBuffer.isView(pixels)) return 'typedarray';
    return 'other';
  }

  function wrapContext(proto, tag) {
    if (!proto || proto.__perfWrapped) return;
    proto.__perfWrapped = true;

    const vp = new WeakMap();
    const ov = proto.viewport;
    proto.viewport = function (x, y, w, h) { vp.set(this, w * h); return ov.call(this, x, y, w, h); };

    const countDraw = (gl, tris) => { P.draws++; P.tris += tris; P.fillPx += vp.get(gl) || 0; };

    const oDE = proto.drawElements;
    proto.drawElements = function (mode, count, type, off) {
      countDraw(this, mode === 4 ? count / 3 : 0); return oDE.call(this, mode, count, type, off);
    };
    const oDA = proto.drawArrays;
    proto.drawArrays = function (mode, first, count) {
      countDraw(this, mode === 4 ? count / 3 : 0); return oDA.call(this, mode, first, count);
    };
    if (proto.drawElementsInstanced) {
      const o = proto.drawElementsInstanced;
      proto.drawElementsInstanced = function (mode, count, type, off, inst) {
        countDraw(this, (mode === 4 ? count / 3 : 0) * inst); return o.call(this, mode, count, type, off, inst);
      };
    }
    if (proto.drawArraysInstanced) {
      const o = proto.drawArraysInstanced;
      proto.drawArraysInstanced = function (mode, first, count, inst) {
        countDraw(this, (mode === 4 ? count / 3 : 0) * inst); return o.call(this, mode, first, count, inst);
      };
    }

    const oUP = proto.useProgram;
    proto.useProgram = function (p) { P.useProgram++; return oUP.call(this, p); };
    const oBT = proto.bindTexture;
    proto.bindTexture = function (t, tex) { P.bindTexture++; return oBT.call(this, t, tex); };
    const oBF = proto.bindFramebuffer;
    proto.bindFramebuffer = function (t, f) { P.bindFramebuffer++; return oBF.call(this, t, f); };

    const oCP = proto.createProgram;
    proto.createProgram = function () { P.programsCreated++; return oCP.call(this); };
    const oLP = proto.linkProgram;
    proto.linkProgram = function (p) {
      P.programsLinked++;
      const t0 = performance.now(); const r = oLP.call(this, p); P.linkMsUnsafe += performance.now() - t0; return r;
    };
    const oCS = proto.compileShader;
    proto.compileShader = function (s) { P.shadersCompiled++; return oCS.call(this, s); };

    // ── texture footprint ────────────────────────────────────────────────────
    const binding = { 0x0DE1: 0x8069, 0x8513: 0x8514, 0x8C1A: 0x8C1D, 0x806F: 0x806A };
    const bindingFor = (gl, target) => {
      const t = target >= 0x8515 && target <= 0x851A ? 0x8513 : target; // cube faces
      const p = binding[t]; return p ? gl.getParameter(p) : null;
    };
    // A texture is CONTENT if something was ever uploaded into it, and a RENDER
    // TARGET if it was only ever allocated. three.js on WebGL2 allocates with
    // texStorage2D and then fills with texSubImage2D, so the classification cannot
    // be made at allocation time — it has to be refined when (if) data arrives.
    const record = (gl, target, level, bytes, w, h, label) => {
      if (level !== 0 || !bytes) return null;
      const key = bindingFor(gl, target);
      if (!key) return null;
      const prev = P._texBytes.get(key);
      if (prev) {
        for (const arr of [P.texContent, P.texTarget]) { const i = arr.indexOf(prev); if (i >= 0) arr.splice(i, 1); }
      }
      const rec = { w, h, bytes, label, mip: false };
      P._texBytes.set(key, rec);
      (EMPTY[label] ? P.texTarget : P.texContent).push(rec);
      return rec;
    };
    const relabel = (gl, target, level, label) => {
      if (level !== 0) return;
      const key = bindingFor(gl, target);
      const rec = key && P._texBytes.get(key);
      if (!rec || !EMPTY[rec.label]) return;
      rec.label = label;
      const i = P.texTarget.indexOf(rec); if (i >= 0) P.texTarget.splice(i, 1);
      P.texContent.push(rec);
    };

    // Two overloads, and they are NOT distinguishable by argument TYPE — in the
    // 6-arg (DOM-source) form a[3] is \`format\`, which is also a number. Split on
    // arity only: 6/7 = source form, 9/10 = explicit-dimensions form.
    const oTI2 = proto.texImage2D;
    proto.texImage2D = function (...a) {
      try {
        if (a.length >= 9) {
          record(this, a[0], a[1], bytesFor(a[2], a[6], a[7], a[3], a[4]), a[3], a[4], labelOf(a[8]));
        } else if (a.length >= 6) {
          const src = a[5]; const w = src?.width ?? src?.videoWidth ?? 0; const h = src?.height ?? src?.videoHeight ?? 0;
          record(this, a[0], a[1], bytesFor(0, a[3], a[4], w, h), w, h, labelOf(src));
        }
      } catch (e) { /* instrumentation must never break the app */ }
      return oTI2.apply(this, a);
    };
    if (proto.texStorage2D) {
      const o = proto.texStorage2D;
      proto.texStorage2D = function (target, levels, ifmt, w, h) {
        try {
          const rec = record(this, target, 0, bytesFor(ifmt, 0, 0, w, h), w, h, 'allocated');
          if (rec && levels > 1) { rec.mip = true; rec.bytes = Math.round(rec.bytes * 1.3334); }
        } catch (e) {}
        return o.call(this, target, levels, ifmt, w, h);
      };
    }
    if (proto.texSubImage2D) {
      const o = proto.texSubImage2D;
      proto.texSubImage2D = function (...a) {
        try { relabel(this, a[0], a[1], labelOf(a.length >= 9 ? a[8] : a[6])); } catch (e) {}
        return o.apply(this, a);
      };
    }
    if (proto.generateMipmap) {
      const o = proto.generateMipmap;
      proto.generateMipmap = function (target) {
        try {
          const key = bindingFor(this, target); const rec = P._texBytes.get(key);
          if (rec && !rec.mip) { rec.mip = true; rec.bytes = Math.round(rec.bytes * 1.3334); }
        } catch (e) {}
        return o.call(this, target);
      };
    }
    if (proto.renderbufferStorage) {
      const o = proto.renderbufferStorage;
      proto.renderbufferStorage = function (t, ifmt, w, h) {
        try { P.renderbuffers.push({ w, h, bytes: bytesFor(ifmt, 0, 0, w, h) }); } catch (e) {}
        return o.call(this, t, ifmt, w, h);
      };
    }
    // Deletions matter: without them "texture bytes" is bytes EVER uploaded, which
    // on a screen that has torn down a generator stage overstates residency by tens
    // of megabytes. Tracking deletes turns it into what is actually still allocated.
    if (proto.deleteTexture) {
      const o = proto.deleteTexture;
      proto.deleteTexture = function (t) {
        try {
          const rec = P._texBytes.get(t);
          if (rec) {
            for (const arr of [P.texContent, P.texTarget]) { const i = arr.indexOf(rec); if (i >= 0) arr.splice(i, 1); }
            P._texBytes.delete(t);
            P.texFreedBytes += rec.bytes;
          }
        } catch (e) {}
        return o.call(this, t);
      };
    }
    if (proto.renderbufferStorageMultisample) {
      const o = proto.renderbufferStorageMultisample;
      proto.renderbufferStorageMultisample = function (t, s, ifmt, w, h) {
        try { P.renderbuffers.push({ w, h, samples: s, bytes: bytesFor(ifmt, 0, 0, w, h) * Math.max(1, s) }); } catch (e) {}
        return o.call(this, t, s, ifmt, w, h);
      };
    }
  }

  installStageRegistry();

  // Count contexts. Browsers cap live WebGL contexts, and a leaked one is invisible
  // until the cap is hit and the OLDEST context is killed — i.e. the bug shows up
  // somewhere else entirely.
  const oGC = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = oGC.call(this, type, ...rest);
    try {
      if (/webgl/.test(type) && ctx) {
        wrapContext(Object.getPrototypeOf(ctx), type);
        const entry = { type, w: this.width, h: this.height, lost: false, at: performance.now() };
        P.contexts.push(entry);
        this.addEventListener('webglcontextlost', () => { entry.lost = true; });
        const ext = ctx.getExtension('WEBGL_lose_context');
        if (ext && !ext.__perfWrapped) {
          ext.__perfWrapped = true;
          const ol = ext.loseContext.bind(ext);
          ext.loseContext = () => { entry.lost = true; return ol(); };
        }
      } else if (type === '2d' && ctx) {
        P.ctx2d.push({ w: this.width, h: this.height, at: performance.now() });
      }
    } catch (e) {}
    return ctx;
  };
})();`;

/** Same context/2d bookkeeping, but no draw-call wrappers — for `alloc` mode. */
const LIGHT_INSTRUMENT = STAGE_REGISTRY + `(() => {
  const P = { contexts: [], ctx2d: [], draws: 0, tris: 0, useProgram: 0, bindTexture: 0,
    bindFramebuffer: 0, fillPx: 0, programsCreated: 0, programsLinked: 0, shadersCompiled: 0,
    linkMsUnsafe: 0, texContent: [], texTarget: [], renderbuffers: [], _texBytes: new Map() };
  window.__perf = P;
  installStageRegistry();
  const oGC = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = oGC.call(this, type, ...rest);
    try {
      if (/webgl/.test(type) && ctx) {
        const entry = { type, w: this.width, h: this.height, lost: false, at: performance.now() };
        P.contexts.push(entry);
        this.addEventListener('webglcontextlost', () => { entry.lost = true; });
      } else if (type === '2d' && ctx) P.ctx2d.push({ w: this.width, h: this.height, at: performance.now() });
    } catch (e) {}
    return ctx;
  };
})();`;

// ─────────────────────────────────────────────────────────────────────────────
// harness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Five other agents edit this repo live and every save fires a Vite HMR update that
 * full-reloads the app, wiping any in-page state a probe is holding. Documented in
 * PROGRESS.md as having cost one agent three sweeps. Stub the client out.
 */
async function stubHmr(page) {
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
}

async function newPage(browser, { instrument = 'full' } = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // Another agent's save triggers a Vite reload; the HMR stub above should prevent it,
  // but if one slips through every in-page measurement after it is garbage. Only the
  // FIRST navigation is expected.
  let navs = 0;
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame() || f.url() === 'about:blank') return;
    if (++navs > 1) errors.push('!! page reloaded mid-run — discard this run');
  });
  await stubHmr(page);
  if (instrument !== 'none') {
    await page.addInitScript(instrument === 'light' ? LIGHT_INSTRUMENT : GL_INSTRUMENT);
  }
  page.__errors = errors;
  return page;
}

async function gotoScene(page, name) {
  const s = SCENES[name];
  if (!s) throw new Error(`unknown scene "${name}". known: ${Object.keys(SCENES).join(', ')}`);
  await page.goto(BASE + s.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(s.ready, null, { timeout: 120_000 });
  // The scene's `ready` flag fires in the same tick shell.ts drops the curtain, 0.26s
  // before `fa-screen-in` finishes — so the first sampling window would otherwise include
  // an entry animation that is not part of what this measures. SOFT and time-boxed on
  // purpose: a perf harness must never die on a paint predicate, and `preview.html`
  // scenes mount no shell at all, where this returns immediately.
  const paint = await settleScreen(page, { soft: true, timeout: 8_000, label: `perf:${name}` });
  if (paint && !paint.ok) console.warn(`  (scene ${name} never reached full paint: ${paint.why.join('; ')})`);
  if (s.settle) {
    await page.waitForFunction(s.settle, null, { timeout: 180_000 }).catch(() => {
      console.warn(`  (settle predicate never fired for ${name} — continuing)`);
    });
  }
  await page.waitForTimeout(400);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-page collectors (kept as strings so they read as one unit)
// ─────────────────────────────────────────────────────────────────────────────

/** Structural census of the live scene. Pure topology — no GPU involved. */
const SCENE_CENSUS = (si) => {
  const stage = si == null ? window.__stage : (window.__stages || [])[si];
  if (!stage) return null;
  const r = stage.renderer;
  const out = {
    renderer: {
      pixelRatio: r.getPixelRatio(),
      drawBufferPx: [r.domElement.width, r.domElement.height],
      shadowsEnabled: r.shadowMap.enabled,
      // Never set anywhere in src/, so this is three's default `true`: the ENTIRE
      // shadow map is re-rendered every frame even though the arena never moves.
      shadowAutoUpdate: r.shadowMap.autoUpdate,
      shadowType: r.shadowMap.type,
      postFx: !!stage.composer,
      envIntensity: stage.scene.environmentIntensity ?? null,
      hasEnvironment: !!stage.scene.environment,
    },
    objects: 0, meshes: 0, visibleMeshes: 0, instanced: 0, instancesTotal: 0,
    outlineHulls: 0, castShadow: 0, receiveShadow: 0, transparent: 0, depthWriteTransparent: 0,
    trianglesStatic: 0, uniqueGeometries: 0, uniqueMaterials: 0, uniqueTextures: 0,
    lights: 0, shadowCasterLights: 0,
  };
  const geos = new Set(), mats = new Set(), texs = new Set();
  stage.scene.traverse((o) => {
    out.objects++;
    if (o.isLight) {
      out.lights++;
      if (o.castShadow) out.shadowCasterLights++;
    }
    if (!o.isMesh && !o.isInstancedMesh && !o.isPoints && !o.isLine) return;
    out.meshes++;
    let vis = o.visible, p = o.parent;
    while (vis && p) { vis = p.visible; p = p.parent; }
    if (vis) out.visibleMeshes++;
    if (o.castShadow) out.castShadow++;
    if (o.receiveShadow) out.receiveShadow++;
    if (/__outline$/.test(o.name || '')) out.outlineHulls++;
    const g = o.geometry;
    if (g) {
      geos.add(g);
      const idx = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
      const n = (idx / 3) * (o.isInstancedMesh ? o.count : 1);
      if (vis) out.trianglesStatic += n;
    }
    if (o.isInstancedMesh) { out.instanced++; out.instancesTotal += o.count; }
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mm) {
      if (!m) continue;
      mats.add(m);
      if (m.transparent) { out.transparent++; if (m.depthWrite) out.depthWriteTransparent++; }
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'gradientMap', 'bumpMap']) {
        if (m[k]) texs.add(m[k]);
      }
    }
  });
  out.uniqueGeometries = geos.size;
  out.uniqueMaterials = mats.size;
  out.uniqueTextures = texs.size;
  out.trianglesStatic = Math.round(out.trianglesStatic);

  // Every distinct texture the scene references, with its real pixel dimensions.
  const texList = [];
  for (const t of texs) {
    const img = t.image;
    texList.push({
      name: t.name || t.constructor?.name || 'tex',
      w: img?.width ?? 0, h: img?.height ?? 0,
      kind: t.isCanvasTexture ? 'canvas' : t.isDataTexture ? 'data' : 'other',
      mip: t.generateMipmaps !== false,
    });
  }
  return { ...out, texList };
};

/**
 * Wrap the composer and each of its passes so every frame reports exact per-pass
 * draw-call / triangle / fill numbers. `renderer.info.autoReset` MUST be turned off:
 * it resets at the start of every `renderer.render()`, and a composer calls that once
 * per pass — so reading `info` after `composer.render()` reports only the LAST pass.
 * Anyone reading renderer.info on a post-processed app without doing this is reading
 * the SMAA pass and calling it the frame.
 */
const INSTALL_FRAME_PROBE = () => {
  const stages = (window.__stages || []).filter((s) => !s.disposed);
  if (!stages.length) return false;
  const frames = [];
  window.__perfFrames = frames;
  window.__perfPass = [];
  const P = window.__perf;

  const passName = (p, i) => {
    const fx = p.effects ? p.effects.map((e) => e.name.replace(/Effect$/, '')).join('+') : null;
    return `${i}:${p.constructor.name}${fx ? `(${fx})` : ''}`;
  };

  // Instrument EVERY live stage, not just `window.__stage`. On the menus there can be
  // two, and picking the wrong one silently reports the offscreen thumbnail generator
  // as if it were the screen. Each frame is tagged with which stage produced it.
  stages.forEach((stage, si) => {
    if (stage.__perfWrapped) return;
    stage.__perfWrapped = true;
    const r = stage.renderer;
    r.info.autoReset = false;
    const composer = stage.composer;
    const record = (dt, run) => {
      window.__perfPass = [];
      const d0 = P.draws, t0 = P.tris, f0 = P.fillPx, u0 = P.useProgram, b0 = P.bindTexture, fb0 = P.bindFramebuffer;
      r.info.reset();
      const t = performance.now();
      run();
      frames.push({
        stage: si,
        onScreen: window.__onScreen(stage),
        cpuMsUnsafe: performance.now() - t,
        total: { draws: P.draws - d0, tris: P.tris - t0, fillPx: P.fillPx - f0,
                 useProgram: P.useProgram - u0, bindTexture: P.bindTexture - b0,
                 bindFramebuffer: P.bindFramebuffer - fb0,
                 infoCalls: r.info.render.calls, infoTris: r.info.render.triangles,
                 geometries: r.info.memory.geometries, textures: r.info.memory.textures,
                 programs: r.info.programs?.length ?? 0 },
        passes: window.__perfPass.slice(),
      });
    };

    if (!composer) {
      const orig = r.render.bind(r);
      r.render = (sc, cam) => record(0, () => orig(sc, cam));
      return;
    }
    composer.passes.forEach((p, i) => {
      const name = passName(p, i);
      const orig = p.render.bind(p);
      p.render = (...a) => {
        const d0 = P.draws, t0 = P.tris, f0 = P.fillPx, u0 = P.useProgram;
        const res = orig(...a);
        window.__perfPass.push({ name, draws: P.draws - d0, tris: P.tris - t0,
          fillPx: P.fillPx - f0, useProgram: P.useProgram - u0 });
        return res;
      };
    });
    const origC = composer.render.bind(composer);
    composer.render = (dt) => record(dt, () => origC(dt));
  });
  return true;
};

/** Drain IN PLACE. The composer wrapper closes over the array, so reassigning
 *  `window.__perfFrames` would leave the probe pushing into an orphan. */
const COLLECT_FRAMES = () => (window.__perfFrames || []).splice(0);

const SUMMARISE_PERF = () => {
  const P = window.__perf;
  const sum = (a) => a.reduce((s, x) => s + x.bytes, 0);
  const live = P.contexts.filter((c) => !c.lost).length;
  const stages = window.__stages || [];
  return {
    stages: { created: stages.length, live: stages.filter((s) => !s.disposed).length,
              onScreen: stages.filter((s) => !s.disposed && s.canvas?.isConnected).length },
    contexts: { created: P.contexts.length, live, lost: P.contexts.length - live,
                detail: P.contexts.map((c) => ({ type: c.type, lost: c.lost })) },
    canvas2d: { count: P.ctx2d.length, megapixels: +(P.ctx2d.reduce((s, c) => s + c.w * c.h, 0) / 1e6).toFixed(2) },
    programs: { created: P.programsCreated, linked: P.programsLinked, shadersCompiled: P.shadersCompiled,
                linkMsUnsafe: +P.linkMsUnsafe.toFixed(0) },
    textureBytes: {
      content: sum(P.texContent), contentCount: P.texContent.length,
      renderTarget: sum(P.texTarget), renderTargetCount: P.texTarget.length,
      renderbuffer: sum(P.renderbuffers), renderbufferCount: P.renderbuffers.length,
      total: sum(P.texContent) + sum(P.texTarget) + sum(P.renderbuffers),
      freed: P.texFreedBytes,
      biggestContent: P.texContent.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 14)
        .map((t) => ({ w: t.w, h: t.h, kb: Math.round(t.bytes / 1024), src: t.label, mip: t.mip })),
      biggestTargets: P.texTarget.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 14)
        .map((t) => ({ w: t.w, h: t.h, kb: Math.round(t.bytes / 1024) })),
      bySource: [...P.texContent.reduce((m, t) => m.set(t.label, (m.get(t.label) || 0) + t.bytes), new Map())]
        .sort((a, b) => b[1] - a[1]).map(([src, bytes]) => ({ src, mb: +(bytes / 1048576).toFixed(2) })),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const mb = (b) => `${(b / 1048576).toFixed(2)} MB`;
const pad = (s, n) => String(s).padEnd(n);
const num = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });

/** Run the app's own rAF loop for exactly `n` rendered frames and collect them. */
/**
 * Run the scene for `n` rendered frames and return the per-frame records.
 *
 * Two ways a scene fails to hand over frames, and neither is a defect in the scene:
 *  - it renders once and stops (`preview.html` static plates);
 *  - it renders so slowly under SwiftShader that 20 frames would take ten minutes
 *    (the menus, whose DOM shell is heavy to composite in software).
 * In both cases the tool drives `stage.render()` itself. Draw calls, triangles, fill
 * and texture bytes are identical either way — none of them depend on WHO called
 * render. `driven: true` is recorded so nobody mistakes it for a frame-rate result.
 */
async function sampleFrames(page, n) {
  const ok = await page.evaluate(INSTALL_FRAME_PROBE);
  if (!ok) throw new Error('frame probe could not install (no window.__stage on this scene)');
  await page.evaluate(COLLECT_FRAMES); // discard the install-frame

  const count = () => page.evaluate(() => (window.__perfFrames || []).length);
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (await count() >= Math.min(n, 4)) break;
    await page.waitForTimeout(1000);
  }
  if (await count() < Math.min(n, 4)) {
    const need = n - (await count());
    await page.evaluate(async (k) => {
      for (let i = 0; i < k; i++) { window.__stage.render(1 / 60); await new Promise((r) => setTimeout(r, 0)); }
    }, need);
    const frames = await page.evaluate(COLLECT_FRAMES);
    frames.driven = true;
    return Object.assign(frames, { driven: true });
  }
  try {
    await page.waitForFunction((k) => (window.__perfFrames || []).length >= k, n, { timeout: 240_000 });
  } catch { /* take whatever arrived */ }
  return page.evaluate(COLLECT_FRAMES);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: counts
// ─────────────────────────────────────────────────────────────────────────────
async function modeCounts(browser) {
  const report = { mode: 'counts', viewport: { W, H, DPR }, scenes: {} };
  for (const name of SCENE_NAMES) {
    const page = await newPage(browser);
    console.log(`\n━━━ ${name} ━━━ ${BASE}${SCENES[name].url}`);
    try {
      await gotoScene(page, name);
      const all = await sampleFrames(page, FRAMES);

      // Several stages can render in the same tick (menus: the portrait plus the
      // offscreen thumbnail generator). Attribute frames to the stage that is
      // actually on screen; report the others separately rather than averaging them
      // into a number that describes neither.
      const byStage = new Map();
      for (const f of all) {
        const e = byStage.get(f.stage) ?? { onScreen: f.onScreen, frames: [] };
        e.frames.push(f); byStage.set(f.stage, e);
      }
      const onScreen = [...byStage].filter(([, v]) => v.onScreen);
      const chosen = (onScreen.length ? onScreen : [...byStage]).sort((a, b) => b[1].frames.length - a[1].frames.length)[0];
      const frames = chosen ? chosen[1].frames : [];
      const offscreenStages = [...byStage].filter(([k]) => !chosen || k !== chosen[0])
        .map(([k, v]) => ({ stage: k, onScreen: v.onScreen, frames: v.frames.length,
          medianDraws: median(v.frames.map((f) => f.total.draws)) }));

      const census = await page.evaluate(SCENE_CENSUS, chosen ? chosen[0] : null);
      const perf = await page.evaluate(SUMMARISE_PERF);

      const totals = frames.map((f) => f.total);
      const per = (k) => median(totals.map((t) => t[k] || 0));
      const passAgg = new Map();
      for (const f of frames) {
        for (const p of f.passes) {
          const e = passAgg.get(p.name) ?? { draws: [], tris: [], fillPx: [] };
          e.draws.push(p.draws); e.tris.push(p.tris); e.fillPx.push(p.fillPx);
          passAgg.set(p.name, e);
        }
      }
      // FILL is only meaningful for FULLSCREEN passes, where every draw genuinely
      // shades the whole viewport. For the scene pass it is `viewport area x draws`,
      // which is a wild over-count (most draws cover a handful of pixels) — so it is
      // reported as null there rather than as a number someone might quote.
      const isFullscreen = (n2) => !/RenderPass/.test(n2);
      const passes = [...passAgg].map(([n2, v]) => ({
        pass: n2, draws: median(v.draws), tris: Math.round(median(v.tris)),
        fillMPx: isFullscreen(n2) ? +(median(v.fillPx) / 1e6).toFixed(2) : null,
      }));
      const postFillMPx = +passes.filter((p) => p.fillMPx != null).reduce((s, p) => s + p.fillMPx, 0).toFixed(2);

      const bufPx = census?.renderer?.drawBufferPx;
      const bufMPx = +(((bufPx ? bufPx[0] * bufPx[1] : W * DPR * H * DPR)) / 1e6).toFixed(3) || 0.001;

      const scene = {
        frames: frames.length,
        driven: all.driven === true,
        otherStagesRendering: offscreenStages,
        perFrame: {
          drawCalls: per('draws'),
          triangles: Math.round(per('tris')),
          postFillMPx,
          // Denominator is the stage's ACTUAL drawing buffer, not the browser
          // viewport — the menu portrait renders into a panel, not the window, and
          // dividing by the window would understate its overdraw by ~2x.
          drawBufferMPx: bufMPx,
          postOverdrawFactor: +(postFillMPx / bufMPx).toFixed(1),
          programBinds: per('useProgram'),
          textureBinds: per('bindTexture'),
          framebufferBinds: per('bindFramebuffer'),
          threeInfoCallsLastPassOnly: per('infoCalls'),
        },
        passes, census, ...perf,
      };
      if (VERBOSE_TIMING) scene.cpuMsUnsafe = +median(frames.map((f) => f.cpuMsUnsafe || 0)).toFixed(2);
      report.scenes[name] = scene;
      printCounts(name, scene);
      if (page.__errors.length) console.log(`  page errors: ${page.__errors.slice(0, 3).join(' | ')}`);
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
      report.scenes[name] = { error: String(e) };
    } finally {
      await page.close();
    }
  }
  return report;
}

function printCounts(name, s) {
  const f = s.perFrame;
  console.log(`  PER FRAME (hardware-independent)${s.driven ? '  [render driven by the tool — scene\'s own loop was too slow/absent]' : ''}`);
  console.log(`    draw calls .............. ${num(f.drawCalls)}`);
  console.log(`    triangles ............... ${num(f.triangles)}`);
  console.log(`    post-chain fill ......... ${f.postFillMPx} Mpx  = ${f.postOverdrawFactor}x the ${f.drawBufferMPx} Mpx draw buffer`);
  console.log(`    program binds ........... ${num(f.programBinds)}`);
  console.log(`    texture binds ........... ${num(f.textureBinds)}`);
  console.log(`  PER PASS`);
  for (const p of s.passes) {
    console.log(`    ${pad(p.pass, 42)} draws ${pad(num(p.draws), 6)} tris ${pad(num(p.tris), 9)} fill ${p.fillMPx == null ? '—  (not fullscreen)' : `${p.fillMPx} Mpx`}`);
  }
  const c = s.census;
  if (c) {
    console.log(`  SCENE`);
    console.log(`    meshes ${c.meshes} (visible ${c.visibleMeshes}) · outline hulls ${c.outlineHulls} · instanced ${c.instanced} (${c.instancesTotal} instances)`);
    console.log(`    unique geometries ${c.uniqueGeometries} · materials ${c.uniqueMaterials} · textures ${c.uniqueTextures}`);
    console.log(`    shadow: ${c.castShadow} casters, ${c.receiveShadow} receivers, ${c.shadowCasterLights} shadow lights`);
    console.log(`    transparent materials ${c.transparent} (of which depthWrite:true ${c.depthWriteTransparent})`);
    const rc = c.renderer;
    if (rc) {
      console.log(`  RENDERER  buffer ${rc.drawBufferPx[0]}x${rc.drawBufferPx[1]} @ pixelRatio ${rc.pixelRatio} · shadows ${rc.shadowsEnabled ? 'on' : 'off'}, autoUpdate ${rc.shadowAutoUpdate} · IBL ${rc.hasEnvironment ? `on @${rc.envIntensity}` : 'off'}`);
      if (rc.shadowsEnabled && rc.shadowAutoUpdate) {
        console.log(`    ↑ autoUpdate:true means the whole shadow map re-renders EVERY frame, static arena included.`);
      }
    }
  }
  console.log(`  GPU MEMORY (bytes actually handed to the driver)`);
  console.log(`    content textures ........ ${mb(s.textureBytes.content)} in ${s.textureBytes.contentCount}`);
  console.log(`    render targets .......... ${mb(s.textureBytes.renderTarget)} in ${s.textureBytes.renderTargetCount}`);
  console.log(`    renderbuffers ........... ${mb(s.textureBytes.renderbuffer)} in ${s.textureBytes.renderbufferCount}`);
  console.log(`    TOTAL ................... ${mb(s.textureBytes.total)}`);
  if (s.textureBytes.freed) console.log(`    (deleted since load: ${mb(s.textureBytes.freed)} — the totals above are RESIDENT, not cumulative)`);
  if (s.otherStagesRendering?.length) {
    for (const o of s.otherStagesRendering) {
      console.log(`  ⚠ a SECOND Stage is also rendering (${o.frames} frames, ~${o.medianDraws} draws each, onScreen=${o.onScreen})`);
    }
  }
  console.log(`  SHADERS  programs linked ${s.programs.linked} · shaders compiled ${s.programs.shadersCompiled}`);
  console.log(`  CONTEXTS created ${s.contexts.created}, live ${s.contexts.live}, lost ${s.contexts.lost} · Stages ${s.stages.created} created / ${s.stages.live} live / ${s.stages.onScreen} on screen · 2D canvases ${s.canvas2d.count} (${s.canvas2d.megapixels} Mpx)`);
  if (s.textureBytes.bySource?.length) {
    console.log(`    content by source: ${s.textureBytes.bySource.map((b) => `${b.src} ${b.mb}MB`).join(' · ')}`);
  }
  const top = s.textureBytes.biggestContent.slice(0, 6);
  if (top.length) {
    console.log(`  LARGEST CONTENT TEXTURES`);
    for (const t of top) console.log(`    ${pad(`${t.w}x${t.h}`, 12)} ${pad(`${num(t.kb)} KB`, 12)} ${t.src}${t.mip ? ' +mip' : ''}`);
  }
  const tt = s.textureBytes.biggestTargets.slice(0, 6);
  if (tt.length) {
    console.log(`  LARGEST RENDER TARGETS`);
    for (const t of tt) console.log(`    ${pad(`${t.w}x${t.h}`, 12)} ${num(t.kb)} KB`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: ablate — what costs and does not show
//
// For each effect in the post chain, skip its blend, re-render, and diff the
// framebuffer. Anything whose removal changes the image by ~0 is pure cost. This is
// the measurement that found SSAO contributing exactly 0.0000/255 project-wide.
// Also removes whole PASSES, which reports the draw-call and fill saving.
// ─────────────────────────────────────────────────────────────────────────────
async function modeAblate(browser) {
  const report = { mode: 'ablate', viewport: { W, H, DPR }, scenes: {} };
  for (const name of SCENE_NAMES) {
    const page = await newPage(browser);
    console.log(`\n━━━ ablate: ${name} ━━━`);
    try {
      await gotoScene(page, name);
      // Freeze by QUEUEING rAF callbacks, not by returning 0 from a stub.
      // `GameSession.loop` re-arms itself by calling requestAnimationFrame at the end
      // of each frame; a stub that never invokes the callback drops that one pending
      // schedule and the loop is dead for good — so "unfreeze and let combat advance"
      // silently does nothing and every later sample repeats the first one exactly.
      const freeze = () => page.evaluate(() => {
        if (window.__rafQ) return;
        window.__rafQ = [];
        window.__rafOrig = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => { window.__rafQ.push(cb); return -1; };
      });
      const thaw = () => page.evaluate(() => {
        if (!window.__rafQ) return;
        const q = window.__rafQ; const o = window.__rafOrig;
        window.__rafQ = null;
        window.requestAnimationFrame = o;
        for (const cb of q.splice(0)) o(cb);
      });
      // Freeze the app's loop so A and B differ ONLY by the mutation.
      await freeze();
      await page.waitForTimeout(300);

      const res = await page.evaluate(async () => {
        const stage = window.__stage;
        const r = stage.renderer;
        const gl = r.getContext();
        const cv = r.domElement;
        const Wp = cv.width, Hp = cv.height;
        const buf = () => { const p = new Uint8Array(Wp * Hp * 4); gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
        const diff = (A, B) => {
          let sum = 0, max = 0, changed = 0;
          for (let i = 0; i < A.length; i += 4) {
            const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
            sum += d; if (d > max) max = d; if (d > 2) changed++;
          }
          const n = A.length / 4;
          return { mean: +(sum / n).toFixed(4), max, pct: +(100 * changed / n).toFixed(2) };
        };
        const P = window.__perf;
        const cost = () => {
          const d0 = P.draws, f0 = P.fillPx;
          stage.render(1 / 60);
          return { draws: P.draws - d0, fillPx: P.fillPx - f0 };
        };

        stage.render(1 / 60); stage.render(1 / 60);
        const base = buf();
        const baseCost = cost();

        const out = { baseline: baseCost, effects: [], passes: [] };
        const composer = stage.composer;
        if (!composer) return out;

        /**
         * Re-render the untouched tree and diff it against `base`. Anything other
         * than zero means the mutate/restore cycle did not restore, so every number
         * measured after it is suspect. This project has been burned by exactly one
         * plausible measurement taken once and believed; the instrument gets checked.
         */
        const restoreCheck = () => { stage.render(1 / 60); stage.render(1 / 60); return diff(base, buf()).mean; };

        // BlendFunction.SKIP is **9** in postprocessing 6.37. It is NOT 0 — 0 is ADD.
        // Read it off the live object rather than hardcoding, so a library bump that
        // renumbers the enum cannot silently turn this probe into a no-op.
        const SKIP = (() => {
          const bm = composer.passes.flatMap((p) => p.effects || [])[0]?.blendMode;
          if (!bm) return 9;
          const before = bm.blendFunction;
          bm.blendFunction = 9;
          const isSkip = bm.blendFunction === 9;
          bm.blendFunction = before;
          return isSkip ? 9 : 0;
        })();
        out.skipValue = SKIP;

        // ── per-effect A: does it change the IMAGE? (blend skipped) ──────────
        for (const pass of composer.passes) {
          for (const e of (pass.effects || [])) {
            const bm = e.blendMode;
            const prev = bm.blendFunction;
            bm.blendFunction = SKIP;
            stage.render(1 / 60); stage.render(1 / 60);
            const d = diff(base, buf());
            bm.blendFunction = prev;
            out.effects.push({ name: e.name, ...d, restoreDelta: restoreCheck() });
          }
        }

        // ── per-effect B: what does it COST? (pass rebuilt without it) ───────
        //
        // Skipping a blend does not stop an effect doing its work — BloomEffect
        // still runs its whole mipmap blur chain. The only way to price an effect is
        // to build the pass without it and count the draws that disappear.
        for (const pass of composer.passes.slice()) {
          const fx = pass.effects;
          if (!fx || fx.length < 2) continue;
          const Ctor = pass.constructor;
          for (const e of fx) {
            const idx = composer.passes.indexOf(pass);
            const subset = fx.filter((x) => x !== e);
            let alt;
            try { alt = new Ctor(stage.rig.camera, ...subset); } catch (err) { continue; }
            composer.removePass(pass);
            composer.addPass(alt, idx);
            stage.render(1 / 60); stage.render(1 / 60);
            const c = cost();
            composer.removePass(alt);
            composer.addPass(pass, idx);
            // NOT alt.dispose() — EffectPass.dispose() disposes its effects, which
            // are the live ones we just handed back.
            const rec = out.effects.find((o) => o.name === e.name);
            if (rec) {
              rec.drawsSaved = baseCost.draws - c.draws;
              rec.fillMPxSaved = +((baseCost.fillPx - c.fillPx) / 1e6).toFixed(2);
              rec.restoreDelta = restoreCheck();
            }
          }
        }

        // ── per-pass: remove the pass entirely ───────────────────────────────
        //
        // `enabled = false` is NOT enough: EffectComposer assigns `renderToScreen` to
        // the last pass once, at addPass time, and never recomputes it. Disable the
        // last pass and NOTHING writes the default framebuffer, so a readback returns
        // a stale buffer and the diff is garbage (this reads as "removing SMAA
        // changes 100% of pixels by 133/255", which is not a real measurement).
        // `removePass`/`addPass` maintain renderToScreen correctly.
        for (const p of composer.passes.slice()) {
          if (p.constructor.name === 'RenderPass') continue;
          const idx = composer.passes.indexOf(p);
          composer.removePass(p);
          stage.render(1 / 60); stage.render(1 / 60);
          const d = diff(base, buf());
          const c = cost();
          composer.addPass(p, idx);
          const fx = p.effects ? p.effects.map((e) => e.name.replace(/Effect$/, '')).join('+') : '';
          out.passes.push({ name: `${p.constructor.name}${fx ? `(${fx})` : ''}`, ...d,
            drawsSaved: baseCost.draws - c.draws, fillMPxSaved: +((baseCost.fillPx - c.fillPx) / 1e6).toFixed(2),
            restoreDelta: restoreCheck() });
        }

        // ── shadow map: what does it cost, and does it show? ─────────────────
        const lights = [];
        stage.scene.traverse((o) => { if (o.isLight && o.castShadow) lights.push(o); });
        if (lights.length) {
          for (const l of lights) l.castShadow = false;
          r.shadowMap.needsUpdate = true;
          stage.render(1 / 60); stage.render(1 / 60);
          const d = diff(base, buf());
          const c = cost();
          for (const l of lights) l.castShadow = true;
          r.shadowMap.needsUpdate = true;
          stage.render(1 / 60);
          out.shadows = { ...d, drawsSaved: baseCost.draws - c.draws,
            mapSize: lights[0].shadow.mapSize.x, lights: lights.length };
        }

        // ── IBL: the expensive one the art direction leans on ────────────────
        if (stage.scene.environment) {
          const env = stage.scene.environment;
          stage.scene.environment = null;
          stage.scene.traverse((o) => { const mm = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mm) if (m) m.needsUpdate = true; });
          stage.render(1 / 60); stage.render(1 / 60);
          const d = diff(base, buf());
          stage.scene.environment = env;
          stage.scene.traverse((o) => { const mm = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mm) if (m) m.needsUpdate = true; });
          stage.render(1 / 60);
          out.ibl = d;
        }

        // ── inverted-hull outlines ───────────────────────────────────────────
        const hulls = [];
        stage.scene.traverse((o) => { if (/__outline$/.test(o.name || '') && o.visible) hulls.push(o); });
        if (hulls.length) {
          for (const h of hulls) h.visible = false;
          stage.render(1 / 60); stage.render(1 / 60);
          const d = diff(base, buf());
          const c = cost();
          for (const h of hulls) h.visible = true;
          stage.render(1 / 60);
          out.outlines = { ...d, count: hulls.length, drawsSaved: baseCost.draws - c.draws };
        }
        return out;
      }, { frames: FRAMES });

      // ── the single-moment trap ───────────────────────────────────────────
      // Everything above was measured on ONE frozen frame. "Bloom contributes
      // nothing" is a claim about the whole game, and bloom exists for hot combat
      // VFX — so the frame it happened to be measured on decides the answer. Repeat
      // the image-contribution half at several different moments of live combat and
      // keep the WORST (largest) contribution, which is the only one that can
      // justify keeping a pass.
      const SAMPLES = Number(arg('--samples', 5));
      const worst = new Map(res.effects.map((e) => [e.name, { ...e }]));
      for (let s = 1; s < SAMPLES; s++) {
        await thaw();
        await page.waitForTimeout(1400);
        await freeze();
        await page.waitForTimeout(250);
        const round = await page.evaluate(() => {
          const stage = window.__stage;
          const gl = stage.renderer.getContext();
          const cv = stage.renderer.domElement;
          const Wp = cv.width, Hp = cv.height;
          const buf = () => { const p = new Uint8Array(Wp * Hp * 4); gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
          const diff = (A, B) => {
            let sum = 0, max = 0, changed = 0;
            for (let i = 0; i < A.length; i += 4) {
              const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
              sum += d; if (d > max) max = d; if (d > 2) changed++;
            }
            const n = A.length / 4;
            return { mean: +(sum / n).toFixed(4), max, pct: +(100 * changed / n).toFixed(2) };
          };
          stage.render(1 / 60); stage.render(1 / 60);
          const base = buf();
          const out = [];
          for (const pass of stage.composer.passes) {
            for (const e of (pass.effects || [])) {
              const bm = e.blendMode; const prev = bm.blendFunction;
              bm.blendFunction = 9;
              stage.render(1 / 60); stage.render(1 / 60);
              const d = diff(base, buf());
              bm.blendFunction = prev;
              stage.render(1 / 60);
              out.push({ name: e.name, ...d });
            }
          }
          return out;
        });
        for (const r of round) {
          const w = worst.get(r.name);
          if (w && r.mean > w.mean) { w.mean = r.mean; w.max = r.max; w.pct = r.pct; }
        }
      }
      res.samples = SAMPLES;
      res.effectsWorstOfSamples = [...worst.values()];

      report.scenes[name] = res;
      printAblate(res);
      if (SAMPLES > 1) {
        console.log(`  WORST CONTRIBUTION ACROSS ${SAMPLES} DIFFERENT COMBAT MOMENTS`);
        for (const e of res.effectsWorstOfSamples) {
          console.log(`    ${pad(e.name, 26)} Δimage mean ${pad(e.mean.toFixed(4), 8)} max ${pad(e.max, 5)} pixels>2 ${e.pct}%`);
        }
      }
      if (page.__errors.length) console.log(`  page errors: ${page.__errors.slice(0, 3).join(' | ')}`);
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
      report.scenes[name] = { error: String(e) };
    } finally {
      await page.close();
    }
  }
  return report;
}

function printAblate(r) {
  const row = (o) => `${pad(o.name, 26)} Δimage mean ${pad(o.mean.toFixed(4), 8)} max ${pad(o.max, 5)} pixels>2 ${pad(`${o.pct}%`, 8)}` +
    (o.drawsSaved !== undefined ? ` | saves ${pad(o.drawsSaved, 4)} draws, ${o.fillMPxSaved ?? '?'} Mpx` : '') +
    (o.restoreDelta > 0.01 ? `  ⚠ RESTORE DELTA ${o.restoreDelta.toFixed(3)} — measurement unreliable` : '');
  console.log(`  baseline: ${r.baseline.draws} draws, ${(r.baseline.fillPx / 1e6).toFixed(2)} Mpx fill · BlendFunction.SKIP resolved to ${r.skipValue}`);
  console.log(`  EFFECTS (blend skipped, pass still runs)`);
  for (const e of r.effects) console.log(`    ${row(e)}`);
  console.log(`  PASSES (removed entirely)`);
  for (const p of r.passes) console.log(`    ${row(p)}`);
  if (r.shadows) console.log(`  SHADOW MAP (${r.shadows.mapSize}px, ${r.shadows.lights} light)  ${row({ name: 'castShadow=false', ...r.shadows })}`);
  if (r.ibl) console.log(`  IBL  ${row({ name: 'scene.environment=null', ...r.ibl })}`);
  if (r.outlines) console.log(`  OUTLINES (${r.outlines.count} hulls)  ${row({ name: 'hidden', ...r.outlines })}`);
  console.log(`  → anything with mean ~0.00 and pixels>2 ~0% is PURE COST.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: alloc — GC pressure
//
// Bytes allocated per FRAME is hardware-independent: V8 allocation does not care
// what rasterises. Bytes per SECOND would not be, because SwiftShader sets the frame
// rate — so this mode never reports a rate.
// ─────────────────────────────────────────────────────────────────────────────
async function modeAlloc(browser) {
  const report = { mode: 'alloc', scenes: {} };
  for (const name of SCENE_NAMES) {
    const page = await newPage(browser, { instrument: 'light' });
    console.log(`\n━━━ alloc: ${name} ━━━`);
    try {
      await gotoScene(page, name);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.enable');
      await cdp.send('Runtime.enable');

      // Count frames with a counter that ALLOCATES NOTHING. Wrapping rAF allocates a
      // fresh closure every frame and lands at the top of the allocation profile —
      // an instrument that shows up as the thing it is measuring. Wrapping
      // `composer.render` creates exactly one closure, once.
      const counted = await page.evaluate(() => {
        const s = window.__stage;
        if (!s) return false;
        window.__fc = { n: 0 };
        if (s.composer) { const o = s.composer.render.bind(s.composer); s.composer.render = (dt) => { window.__fc.n++; o(dt); }; }
        else { const o = s.renderer.render.bind(s.renderer); s.renderer.render = (a, b) => { window.__fc.n++; o(a, b); }; }
        return true;
      });
      if (!counted) throw new Error('no stage to count frames on');

      await cdp.send('HeapProfiler.collectGarbage');
      const before = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      const f0 = await page.evaluate(() => window.__fc.n);

      // 1024 B interval: the default 32 KB samples too coarsely to separate the
      // ~4 KB/frame this app allocates from noise.
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024 });
      await page.waitForFunction((k) => window.__fc.n >= k, f0 + FRAMES, { timeout: 600_000 });
      const profile = (await cdp.send('HeapProfiler.stopSampling')).profile;

      const f1 = await page.evaluate(() => window.__fc.n);
      // GC on BOTH ends, so "net growth" means memory that survived collection —
      // i.e. retention — rather than uncollected garbage.
      await cdp.send('HeapProfiler.collectGarbage');
      const after = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      const nFrames = f1 - f0;

      // Flatten the sampling tree into per-function self bytes.
      const rows = [];
      (function walk(node) {
        const cf = node.callFrame;
        if (node.selfSize > 0) {
          const url = (cf.url || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
          rows.push({ fn: cf.functionName || '(anonymous)', url, line: cf.lineNumber + 1, bytes: node.selfSize });
        }
        for (const c of node.children || []) walk(c);
      })(profile.head);
      const total = rows.reduce((s, r) => s + r.bytes, 0);

      const byFile = new Map();
      for (const r of rows) {
        const k = r.url || '(native/host)';
        byFile.set(k, (byFile.get(k) || 0) + r.bytes);
      }
      const top = rows.sort((a, b) => b.bytes - a.bytes).slice(0, 20)
        .map((r) => ({ ...r, bytesPerFrame: Math.round(r.bytes / nFrames) }));
      const files = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([f, b]) => ({ file: f, bytesPerFrame: Math.round(b / nFrames) }));

      const s = {
        frames: nFrames,
        sampledBytesPerFrame: Math.round(total / nFrames),
        netHeapGrowthPerFrame: Math.round((after - before) / nFrames),
        heapBefore: before, heapAfter: after,
        topAllocators: top, byFile: files,
      };
      report.scenes[name] = s;
      console.log(`  frames sampled ......... ${nFrames}`);
      console.log(`  allocated / frame ...... ${num(s.sampledBytesPerFrame)} B   (sampling profiler, hardware-independent)`);
      console.log(`  net heap growth / frame  ${num(s.netHeapGrowthPerFrame)} B   (post-GC delta; >0 sustained = a real leak)`);
      console.log(`  BY FILE (bytes/frame)`);
      for (const f of files.slice(0, 10)) console.log(`    ${pad(`${num(f.bytesPerFrame)} B`, 12)} ${f.file}`);
      console.log(`  TOP ALLOCATING FUNCTIONS`);
      for (const t of top.slice(0, 12)) console.log(`    ${pad(`${num(t.bytesPerFrame)} B`, 12)} ${pad(t.fn, 28)} ${t.url}:${t.line}`);
      await cdp.detach();
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
      report.scenes[name] = { error: String(e) };
    } finally {
      await page.close();
    }
  }
  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: boot — time to first frame, and where the CPU went
//
// The CPU profile is sampled by V8 and attributed to source URLs, so "how much of
// boot is procedural texture generation" becomes a number with a filename on it.
// Caveat, stated plainly: any sample inside a GL call is charged to the JS frame that
// made it, and those GL calls are SwiftShader here. Read the JS-heavy files
// (textures.ts, arena/*, characters/*) as trustworthy; read stage.ts / three.js
// entries as inflated.
// ─────────────────────────────────────────────────────────────────────────────
async function modeBoot(browser) {
  const report = { mode: 'boot', scenes: {} };
  for (const name of SCENE_NAMES) {
    const page = await newPage(browser);
    console.log(`\n━━━ boot: ${name} ━━━`);
    try {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
      await cdp.send('Profiler.start');

      const t0 = Date.now();
      const s = SCENES[name];
      await page.goto(BASE + s.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForFunction(s.ready, null, { timeout: 120_000 });
      const tReady = Date.now() - t0;
      if (s.settle) await page.waitForFunction(s.settle, null, { timeout: 180_000 }).catch(() => {});
      const tSettle = Date.now() - t0;

      const { profile } = await cdp.send('Profiler.stop');
      const perf = await page.evaluate(SUMMARISE_PERF);
      const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null;
      });

      // Self-time by node id, then aggregated by source file.
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const selfTicks = new Map();
      for (const s2 of profile.samples || []) selfTicks.set(s2, (selfTicks.get(s2) || 0) + 1);
      const dtUs = (profile.endTime - profile.startTime) / Math.max(1, (profile.samples || []).length);
      const byFile = new Map();
      const byFn = [];
      for (const [id, ticks] of selfTicks) {
        const n = byId.get(id); if (!n) continue;
        const cf = n.callFrame;
        const url = (cf.url || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0] || '(native)';
        const ms = (ticks * dtUs) / 1000;
        byFile.set(url, (byFile.get(url) || 0) + ms);
        byFn.push({ fn: cf.functionName || '(anonymous)', url, line: cf.lineNumber + 1, ms });
      }
      const totalMs = [...byFile.values()].reduce((a, b) => a + b, 0);
      const files = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([f, ms]) => ({ file: f, ms: +ms.toFixed(1), pct: +(100 * ms / totalMs).toFixed(1) }));
      const fns = byFn.sort((a, b) => b.ms - a.ms).slice(0, 20)
        .map((f) => ({ ...f, ms: +f.ms.toFixed(1) }));

      const texMs = [...byFile].filter(([f]) => /textures\.ts|thumbs\.ts/.test(f)).reduce((a, b) => a + b[1], 0);

      const out = {
        msToReady: tReady, msToSettle: tSettle, nav,
        cpuProfileTotalMs: +totalMs.toFixed(0),
        proceduralTextureMs: +texMs.toFixed(0),
        proceduralTexturePctOfCpu: +(100 * texMs / totalMs).toFixed(1),
        canvas2d: perf.canvas2d,
        programs: perf.programs,
        textureBytes: { content: perf.textureBytes.content, renderTarget: perf.textureBytes.renderTarget, total: perf.textureBytes.total },
        byFile: files, byFunction: fns,
      };
      report.scenes[name] = out;
      console.log(`  ms to ready ............ ${tReady}  (NOT hardware-independent: SwiftShader compiles ${perf.programs.linked} programs during boot)`);
      console.log(`  ms to fully settled .... ${tSettle}`);
      console.log(`  shader programs linked . ${perf.programs.linked}  (count IS hardware-independent; the ${perf.programs.linkMsUnsafe}ms is not)`);
      console.log(`  2D canvases created .... ${perf.canvas2d.count} totalling ${perf.canvas2d.megapixels} Mpx`);
      console.log(`  texture upload ......... ${mb(perf.textureBytes.content)} content + ${mb(perf.textureBytes.renderTarget)} targets`);
      console.log(`  procedural texture CPU . ${out.proceduralTextureMs} ms = ${out.proceduralTexturePctOfCpu}% of profiled CPU`);
      console.log(`  CPU BY FILE`);
      for (const f of files.slice(0, 12)) console.log(`    ${pad(`${f.ms} ms`, 10)} ${pad(`${f.pct}%`, 7)} ${f.file}`);
      await cdp.detach();
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
      report.scenes[name] = { error: String(e) };
    } finally {
      await page.close();
    }
  }
  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: leak — home → characters → match → home
//
// The shell claims it destroys the menu's WebGL context before a match starts.
// This checks that it actually happens, and that a full round trip returns to the
// state it started in.
// ─────────────────────────────────────────────────────────────────────────────
async function modeLeak(browser) {
  const page = await newPage(browser);
  const steps = [];
  console.log(`\n━━━ leak: home → characters → match → home ━━━`);
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    await cdp.send('Runtime.enable');

    const snap = async (label) => {
      await cdp.send('HeapProfiler.collectGarbage');
      await page.waitForTimeout(200);
      const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      const d = await page.evaluate(() => {
        const P = window.__perf;
        const live = P.contexts.filter((c) => !c.lost).length;
        const st = window.__stage;
        return {
          contextsCreated: P.contexts.length,
          contextsLive: live,
          canvases: document.querySelectorAll('canvas').length,
          canvasesInDom: [...document.querySelectorAll('canvas')].filter((c) => c.isConnected).length,
          geometries: st?.renderer?.info?.memory?.geometries ?? null,
          textures: st?.renderer?.info?.memory?.textures ?? null,
          programs: st?.renderer?.info?.programs?.length ?? null,
          texUploadBytes: P.texContent.reduce((s, t) => s + t.bytes, 0) + P.texTarget.reduce((s, t) => s + t.bytes, 0),
          screen: window.__screen ?? null,
        };
      });
      const row = { label, heapMB: +(heap / 1048576).toFixed(2), ...d };
      steps.push(row);
      console.log(`  ${pad(label, 22)} heap ${pad(`${row.heapMB} MB`, 10)} ctx live ${pad(row.contextsLive, 3)}/${pad(row.contextsCreated, 3)} canvas(dom) ${pad(row.canvasesInDom, 3)} geo ${pad(row.geometries, 6)} tex ${pad(row.textures, 5)} prog ${row.programs}`);
      return row;
    };

    await gotoScene(page, 'home');
    await snap('boot: home');

    const nav = async (route, label, settle) => {
      await page.evaluate((r) => window.__shell.navigate(r), route);
      await page.waitForFunction(`window.__screenReady === true`, null, { timeout: 60_000 });
      if (settle) await page.waitForFunction(settle, null, { timeout: 180_000 }).catch(() => {});
      await page.waitForTimeout(700);
      return snap(label);
    };

    await nav({ name: 'characters' }, 'characters', `window.__thumbsReady === true`);
    await nav({ name: 'home' }, 'home (2nd)');
    await nav({ name: 'match', player: 'hamburger', enemy: 'donut' }, 'match',
      `document.querySelector('.hud-countdown')?.style.display === 'none'`);
    await nav({ name: 'home' }, 'home (3rd)');
    await nav({ name: 'match', player: 'pizza', enemy: 'taco' }, 'match (2nd)',
      `document.querySelector('.hud-countdown')?.style.display === 'none'`);
    await nav({ name: 'home' }, 'home (4th)');

    const a = steps.find((s) => s.label === 'home (2nd)');
    const b = steps.find((s) => s.label === 'home (4th)');
    const verdict = {
      heapDeltaMB: +(b.heapMB - a.heapMB).toFixed(2),
      contextsLeaked: b.contextsLive - a.contextsLive,
      canvasesLeaked: b.canvasesInDom - a.canvasesInDom,
      contextsCreatedTotal: b.contextsCreated,
      texUploadBytesTotal: b.texUploadBytes,
    };
    console.log(`\n  ROUND-TRIP (home 2nd → home 4th, two full matches in between)`);
    console.log(`    heap delta ........... ${verdict.heapDeltaMB} MB`);
    console.log(`    live contexts leaked . ${verdict.contextsLeaked}`);
    console.log(`    DOM canvases leaked .. ${verdict.canvasesLeaked}`);
    console.log(`    contexts EVER created  ${verdict.contextsCreatedTotal}`);
    if (page.__errors.length) console.log(`    page errors: ${page.__errors.slice(0, 4).join(' | ')}`);
    await cdp.detach();
    return { mode: 'leak', steps, verdict, errors: page.__errors };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// baseline comparison
// ─────────────────────────────────────────────────────────────────────────────
const WATCH = [
  ['perFrame.drawCalls', 0.10],
  ['perFrame.triangles', 0.10],
  ['perFrame.fullscreenFillMPx', 0.05],
  ['textureBytes.total', 0.10],
  ['programs.linked', 0.15],
  ['contexts.live', 0.0001],
];
const dig = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

function compareBaseline(base, now) {
  let bad = 0;
  for (const scene of Object.keys(now.scenes || {})) {
    const b = base.scenes?.[scene]; const n = now.scenes[scene];
    if (!b || !n || b.error || n.error) continue;
    for (const [path, tol] of WATCH) {
      const bv = dig(b, path), nv = dig(n, path);
      if (typeof bv !== 'number' || typeof nv !== 'number' || bv === 0) continue;
      const rel = (nv - bv) / bv;
      if (rel > tol) {
        bad++;
        console.log(`REGRESSION  ${scene}.${path}: ${num(bv, 2)} → ${num(nv, 2)}  (+${(rel * 100).toFixed(1)}%, tol ${(tol * 100).toFixed(0)}%)`);
      }
    }
  }
  return bad;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`perf.mjs  mode=${MODE}  scenes=${SCENE_NAMES.join(',')}  viewport=${W}x${H}@${DPR}  frames=${FRAMES}`);
  console.log(`RASTERISER: SwiftShader (CPU). Frame time is NOT reported as performance — see file header.\n`);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let report;
  try {
    if (MODE === 'counts') report = await modeCounts(browser);
    else if (MODE === 'ablate') report = await modeAblate(browser);
    else if (MODE === 'alloc') report = await modeAlloc(browser);
    else if (MODE === 'boot') report = await modeBoot(browser);
    else if (MODE === 'leak') report = await modeLeak(browser);
    else { console.error(`unknown --mode ${MODE}`); process.exit(2); }
  } finally {
    await browser.close();
  }

  report.meta = { at: new Date().toISOString(), base: BASE, viewport: { W, H, DPR }, frames: FRAMES, rasteriser: 'swiftshader-cpu' };
  if (JSON_OUT) {
    await mkdir(dirname(resolve(JSON_OUT)), { recursive: true });
    await writeFile(JSON_OUT, JSON.stringify(report, null, 2));
    console.log(`\nwrote ${JSON_OUT}`);
  }
  if (BASELINE) {
    const base = JSON.parse(await readFile(BASELINE, 'utf8'));
    console.log(`\n── baseline: ${BASELINE} ──`);
    const bad = compareBaseline(base, report);
    console.log(bad ? `\n${bad} regression(s).` : `\nno regressions.`);
    if (bad) process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
