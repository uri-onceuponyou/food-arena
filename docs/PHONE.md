# The phone problem — measured

**Question asked:** *"the phone experience is very bad. VFX looks clunky and the in browser gameplay
is not playable."* — then, after Uri played it again: *"as for gameplay, i played now, it's better
than i thought, it's mainly the browser interfering, and the weapon choosing is on the most critical
part of the screen where most gameplay happens."* → *"force full screen horizontal on game launch."*

**Answer, in one line: it is neither a frame-rate problem nor an input problem. It is a SCREEN-AREA
problem, and Uri's own revision is correct.** In portrait mobile Safari the game is rendered into
**34.5 % of the phone's screen**. Browser chrome takes 22 %; the game's own 4:3 aspect mask throws
away another 43 %. Frame time and input latency were both measured and both are fine.

> **And the second answer, which matters for §51a:** *"force full screen horizontal"* **cannot be
> granted to a browser tab on an iPhone.** Not by us, not by any code in `src/`. The two Web APIs
> that would do it are both absent from Safari on iPhone, with citations in §4. A **home-screen PWA
> gets the fullscreen half today for two lines in `index.html`**; the **landscape half needs the
> native wrapper**. So Uri's instinct to move to an app is right — for a different reason than the
> one he gave.

Everything below was measured on the **shipped production bundle** built from `3b7c080` with
`DEPLOY_BASE=./` and served by a static host (`tools/tmp/ph_serve.mjs`), never the dev server.

---

## 0. What is new about these numbers, and what you may quote

🚨 **This project has believed since its first perf pass that frame time cannot be measured here.**
`tools/perf.mjs`'s header, `src/render/quality.ts:21` and `docs/LESSONS.md` §10 all say so, and the
reason they give is correct **as written**: every tool in `tools/` launches Chromium with
`--use-angle=swiftshader`, a CPU rasteriser, so 9-10 fps is a property of the harness.

**It is a property of the FLAG, not of the machine.** `node tools/tmp/ph_gpu.mjs` probes four launch
configurations on this box:

```
headless-shell (what every tool here uses)     ANGLE (Google, Vulkan … SwiftShader driver)   timerQuery: false
headless + --use-angle=metal                   ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro)  timerQuery: true
channel:chromium (new headless) + metal        ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro)  timerQuery: true
channel:chromium HEADED + metal                ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro)  timerQuery: true
```

A real GPU, in headless, with `EXT_disjoint_timer_query_webgl2`. So the GPU-time column below is the
first one this project has ever had.

**Why an M5 Pro is the right proxy and SwiftShader never was:** Apple's desktop GPUs are the same
tile-based deferred-rendering family as the A-series in an iPhone — on-chip tile memory, hidden
surface removal, a bandwidth-first cost model. SwiftShader has none of those, so it cannot even rank
two passes correctly.

| quantity | status |
|---|---|
| draw calls, triangles, programs, texture bytes, drawing-buffer pixels, KB allocated per frame, GC count, which tier `auto` picks, **every ratio between two arms in the same run** | **device-independent — quote as-is** |
| the CSS-pixel geometry in §1 (screen, viewport, canvas rect) | **exact** — descriptor arithmetic plus our own deterministic layout |
| GPU ms | **≈4-6× optimistic** on GPU-core count alone, before the bandwidth gap and thermal throttling |
| CPU ms | CDP `Emulation.setCPUThrottlingRate`, a uniform script slowdown. Does not model a small cache, weak branch prediction, or little cores |
| **anything about Safari specifically** | **not measured. Chromium is not WebKit.** See §6 |

---

## 1. 🥇 THE HEADLINE — the game gets a third of the screen in portrait

`node tools/tmp/ph_chrome.mjs`. Screen and viewport come from Playwright's device descriptors,
which carry both the full CSS screen (`screen`) and the visible viewport Safari actually hands a
page (`viewport`), measured on real hardware by that project — so the chrome cost is **sourced**,
not recalled.

| device (as held) | screen CSS | Safari viewport | game canvas | **game / screen** |
|---|---|---|---|---|
| iPhone 14 portrait | 390×844 | 390×664 (−21.3 %) | **390×293** | **34.7 %** |
| iPhone 15 portrait | 393×852 | 393×659 (−22.7 %) | **393×295** | **34.6 %** |
| iPhone 16 Pro portrait | 402×874 | 402×681 (−22.1 %) | **402×302** | **34.6 %** |
| iPhone 16 Pro Max portrait | 440×956 | 440×763 (−20.2 %) | **440×330** | **34.5 %** |
| Pixel 7 portrait | 412×915 | 412×839 (−8.3 %) | **412×309** | **33.8 %** |
| iPhone 14 landscape | 844×390 | 750×340 (−22.5 %) | 750×340 | **77.5 %** |
| iPhone 15 landscape | 852×393 | 734×343 (−24.8 %) | 734×343 | **75.2 %** |
| iPhone 16 Pro landscape | 874×402 | 756×352 (−24.3 %) | 756×352 | **75.7 %** |
| iPhone 16 Pro Max landscape | 956×440 | 838×390 (−22.3 %) | 838×390 | **77.7 %** |
| Pixel 7 landscape | 915×412 | 863×360 (−17.6 %) | 840×360 | **80.2 %** |

**Read the two loss columns separately, because they have different owners.**

* **Browser chrome: 20-25 % on every iPhone, both orientations.** Not ours. In landscape it is
  ~50 CSS px of toolbar **plus ~118 px of Dynamic-Island bezel** taken off the *sides*.
* **The aspect mask: a further 43 % of the screen in portrait, and 0 % in landscape.** This one *is*
  ours. `SUPPORTED_ASPECT.min = 4/3` (`src/render/camera.ts:166`) and `Stage.resize()` hard-masks
  anything narrower, so a 393×659 portrait viewport renders into a 393×295 strip. That is the single
  largest item on this page and it is bigger than the browser's share.

🚨 **AND THE GAME PAYS THE WORST CASE OF THE CHROME COST, PERMANENTLY.** iOS Safari collapses its
toolbar when the page scrolls. This page can never scroll: `index.html:102` is
`html, body { overflow: hidden }` and `index.html:106` is `body { position: fixed; inset: 0;
overscroll-behavior: none }` — measured `scrollHeight === innerHeight` on both orientations, so the
document is exactly one viewport tall. That CSS is *correct* (a game must not scroll under a thumb),
and `src/game/touch.ts:289-292` sets `touch-action: none` for the same right reason. The consequence
is that **the collapsed-toolbar viewport is unreachable**, so the numbers above are not a worst case
— they are the only case. **This is a mechanism argument, flagged for device confirmation (§6).**

**Look at the two frames before reading further** — `docs/AGENT-BRIEF.md` §4.1:

* `shots/ph/chrome-match-iPhone_15.png` — portrait. The arena is a band across the middle; above it
  the HUD, below it the sticks and the weapon row, all on flat background. And this PNG does **not**
  include Safari's chrome, which sits above and below what you see.
* `shots/ph/chrome-match-iPhone_15_landscape.png` — landscape. Full-bleed, and it looks right.

---

## 2. Frame rate — a NEGATIVE result, and it corroborates Uri

`node tools/tmp/ph_frame.mjs`, production build, 844×390 CSS @ DPR 3, **uncapped pacing**
(`--disable-gpu-vsync --disable-frame-rate-limit`) so the frame interval *is* the cost rather than
"it fit in 16.7 ms". `auto` correctly resolves to **`low`** under mobile emulation.

| CPU throttle | frame p50 | p95 | p99 | **JS main thread p50** | **GPU p50** | alloc/frame |
|---|---|---|---|---|---|---|
| ×1 | 2.2 ms (455 fps) | 3.0 | 6.7 | 1.9 ms | 1.29 ms | 296 KB |
| ×4 | 11.0 ms (91 fps) | 12.8 | 14.4 | 9.5 ms | 1.74 ms | 308 KB |
| ×5 | 17.1 ms (58 fps) | **33.2** | 34.9 | 15.1 ms | 1.74 ms | 312 KB |
| ×6 | 17.5 ms (57 fps) | **32.5** | 33.4 | 15.2 ms | 1.74 ms | 313 KB |

**Three findings, in order of importance.**

1. **The frame is CPU-bound by 5-9×, and it is not close.** At the tier a phone actually gets, the
   GPU finishes in **1.74 ms** while the main thread spends **9.5-15.2 ms**. Splitting the JS at the
   first GL draw call of each frame — an exact fence, because `this.stage.render(...)` is the last
   statement of `GameSession.loop` (`src/game/match.ts:1404`) — gives an almost even split:
   *sim + events + audio + model updates + VFX + HUD DOM* ≈ **7.6 ms** at ×6, *renderer submission*
   ≈ **7.5 ms**. Both halves are main-thread JS.
2. **60 fps holds until the CPU is about 4.5-5× slower than an M5 Pro P-core.** At ×4 the p95 is
   12.8 ms; at ×5 the p50 crosses 16.7 ms.
3. **The stutter appears before the average does, and that is the "clunky" signature.** At ×5 and ×6
   the p95 is almost exactly **2× the p50** — frames pairing up, i.e. one hitch in twenty, roughly
   every 0.7 s. An average frame rate would have called ×5 "58 fps, fine".

**Menus are not the problem.** `--scene home` at ×6: JS p50 5.1 ms, GPU 0.77 ms, 352 draws.

⚠️ **What this does NOT tell you:** whether a specific iPhone lands left or right of ×5, and nothing
at all about WebKit. See §6.

### 2b. 🚨 The tier system optimises the resource that is not the bottleneck

Same probe, same viewport, CPU pinned at ×4, tier forced:

| tier | draw buffer | draws/frame | tris/frame | **JS p50** | **GPU p50** |
|---|---|---|---|---|---|
| `low` (what every phone gets) | 1055×487 | **791** | 407 k | **10.2 ms** | 1.74 ms |
| `medium` | 1266×585 | 868 | 473 k | 10.8 ms | 4.24 ms |
| `high` | 1688×780 | 906 | 478 k | 11.5 ms | 5.23 ms |

`low` buys a **3.0× GPU saving** and a **1.13× CPU saving**. Every knob in
`src/render/quality.ts:209-221` — `pixelRatioCap`, `bloom`, `smaa`, `shadowMapScale` — is a **fill**
knob, and fill is the cheap half by a factor of six. **The tier a phone gets does not reduce the
number of draw calls in any material way** (906 → 791, −13 %), and draw-call submission is half the
frame.

The file already prices the one knob that would move it: *"Turning the shadow pass off is by far the
largest single win available (measured 302 draws, 43.6 % of a match frame)"* (`quality.ts:137-139`)
— and argues, reasonably, that contact shadow is what grounds a character. **That trade should now
be re-opened for `low` only, because the measurement it was refused on was a GPU measurement and the
constraint turns out to be CPU.** Reported, not decided.

### 2c. The documented per-frame counts are ~50 % stale

`src/render/quality.ts:101-104` records, for this exact phone viewport: `high` **601** draws,
`medium` 577, `low` **534**. Measured today on the production build at the same viewport: `high`
**906**, `medium` 868, `low` **791**.

Cross-validated against the project's own instrument, which is the point of quoting it:
`node tools/perf.mjs --mode counts --scene match --device mobile` on the same server reports **913
draws / 481,654 tris**, against this tool's 906 / 478 k — **0.8 % apart**, on two independently
written counters. The arena has simply grown since that table was written. The brief's *"868 draws,
~452 k tris at 1v1 today"* is also low; 868 is today's **`medium`**.

### 2d. 🐞 `perf.mjs --device mobile` has never measured a phone's tier

`tools/perf.mjs:491` creates the page with `{ viewport, deviceScaleFactor }` and **no `hasTouch`,
no `isMobile`**. `detectTier()` gates on `coarsePointer && maxTouchPoints > 0`
(`src/render/quality.ts:327-328`) and returns `'high'` when that gate fails. Confirmed live: the run
in §2c reports `pixelRatio 2`, SMAA and bloom present — that is `high`. **So every "mobile" number
this project owns describes the tier a phone never gets.**

**Fix:** `tools/perf.mjs:104-109`, give the `mobile` and `tablet` entries `hasTouch: true,
isMobile: true`, and pass them through at line 491. One line each. *(Not mine to edit — `tools/` is
outside this pass's file set except `ph_*`.)*

### 2e. Allocation: ~310 KB per frame

Steady, and identical across tiers (296-331 KB), so it is the sim/VFX/HUD path, not the renderer
configuration. Measured with `--enable-precise-memory-info`; **without that flag
`performance.memory` is bucketed to 100 KB and reported 0.0 KB/frame**, which is what this probe
printed on its first run. At 60 fps that is ~18 MB/s and a young-generation GC roughly every 50
frames — 4-6 heap drops per 200 frames at every rate tested. No `longtask` entry ever fired, so no
single GC exceeded 50 ms here; on a phone with a smaller nursery the same allocation rate collects
more often. **Device-independent as a rate; the pause length is not.**

---

## 3. Input — measured, and it is fine

`node tools/tmp/ph_touch.mjs`, iPhone 15 landscape.

| CPU | `touch.ts` handler cost | **touchmove → the sim reports movement** | in frames |
|---|---|---|---|
| ×1 | mean 0.00 ms, p95 0.00 | **8.3 ms** p50 / 9.4 p95 | 2 |
| ×4 | mean 0.04 ms, p95 0.60 | **14.4 ms** p50 / 18.4 p95 | 2 |
| ×6 | mean 0.09 ms, p95 0.80 | **20.3 ms** p50 / 24.5 p95 | 2 |

**Two frames, flat, at every CPU rate — that is the floor for any rAF-sampled input** (the event
lands, the next `GameSession.loop` samples it via `buildInput()`, the frame after that shows it).
There is no queue, no smoothing, no extra buffering. The handler itself is free. Listener wiring is
correct: `touchstart`/`touchmove` are registered `passive: false` on `window`
(`src/game/touch.ts:605-608`) with `touch-action: none` on the canvas and the surface
(`touch.ts:291-292`), which is exactly what stops the browser stealing a drag.

⚠️ **The absolute ms are a floor.** `Input.dispatchTouchEvent` injects downstream of the digitiser
scan (~8 ms at 120 Hz, ~16 ms at 60 Hz), the OS touch pipeline, and — on iOS Safari — a
cross-process hop. The **frame quantum of 2** is the device-independent part.

> 🚨 **Instrument note, recorded because it would have been a headline.** The first version of this
> probe measured `touchstart → the sim moves` and reported a flat **4-5 frames**. That was an
> artefact: `touch.ts` is a *floating* stick, so `touchstart` only plants the base and `moveX` is
> legitimately 0 until a `touchmove` arrives — which the probe sent as a **second CDP round trip**.
> The tell was that the number **did not change when the CPU was made six times slower**; a cost
> that survives a 6× CPU slowdown is not being paid by the CPU. Both readings are printed side by
> side now, and the header carries the old wording.

---

## 4. 🚨 "Force full screen horizontal" — the capability matrix

Verified against **MDN's `browser-compat-data`**, fetched from source rather than recalled:

| API | verdict | source |
|---|---|---|
| `Element.requestFullscreen()` | `safari_ios: 16.4, partial` — **"Only available on iPad, not on iPhone."** Also *"Shows an overlay button which can not be disabled. Swiping down exits fullscreen mode, making it unsuitable for some use cases like games."* | `api/Element.json` |
| `Element.webkitRequestFullscreen()` | `safari_ios: 12, partial` — **same iPad-only note** | `api/Element.json` |
| `Element.requestFullscreen()` in an **iOS WebView** | `webview_ios: version_added: false` | `api/Element.json` |
| `ScreenOrientation.lock()` | `safari: false` (desktop **and** iOS, via `mirror`). Chrome ships it but *"Always throws `NotSupportedError`"* on desktop; `chrome_android: 38` works | `api/ScreenOrientation.json` |
| manifest `orientation` | `safari: false` → `safari_ios: false` | `manifests/webapp/orientation.json` |
| manifest `display: standalone` | **`safari_ios: 11.3`** ✅ | `manifests/webapp/display.json` |
| manifest `display: fullscreen` | `safari: false` → falls back to `standalone` | `manifests/webapp/display.json` |

### What that means, per target

| | mobile Safari tab (iPhone) | home-screen PWA (iPhone) | Chrome tab (Android) | Capacitor / native |
|---|---|---|---|---|
| hide browser chrome | ❌ **impossible** | ✅ `display: standalone` | ✅ via Fullscreen API | ✅ native |
| lock to landscape | ❌ | ❌ **still impossible** | ✅ `lock()` after fullscreen | ✅ native |
| Fullscreen API at all | ❌ iPad only | ❌ | ✅ | n/a — already fullscreen |
| what a tab *can* do | `orientation` media query, a rotate prompt, `viewport-fit=cover` | + no chrome, + splash, + own icon | + true fullscreen landscape | everything |

**So Uri's sentence splits into two requests with two different answers:**

* **"full screen"** — available on iOS **today, for two lines**, via Add to Home Screen. See §5.1.
* **"horizontal"** — **only the native wrapper can lock it.** Not Safari, not a PWA, not any code in
  `src/`. This is the strongest argument on record for §51a's Capacitor decision, and it is
  independent of performance.

⚠️ Everything in this section is a platform-capability claim, not a measurement on Uri's device.
It is sourced, and the sources are named so they can be re-checked.

---

## 5. Ranked list of what to change, with file:line

Diagnosis only — **no `src/` file was edited by this pass.** Ranked by how much of Uri's actual
complaint each one removes.

### 5.1 🥇 Ship a web app manifest + the Apple meta tags — `index.html`

**Measured absence.** The served document has **no `<link rel="manifest">` and no
`<meta name="apple-mobile-web-app-capable">`** (page-side check on the production build; only
`viewport`, `theme-color` and the two font preloads are present, `index.html:4-9`, `68-69`). Without
either signal iOS opens a home-screen shortcut in **browser display mode**, i.e. with the chrome —
so *"Add to Home Screen"* currently buys nothing.

**Add:** `public/manifest.webmanifest` with `display: standalone`, `orientation: landscape`,
`start_url: "./?screen=home"`, `background_color`/`theme_color`, icons; plus in `index.html`
alongside line 9 —

```html
<link rel="manifest" href="./manifest.webmanifest" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

**Worth:** on iPhone, **+50 CSS px of height in landscape (+15 %)** and **+193 px in portrait**, and
it removes the *"browser interfering"* complaint entirely for anyone who installs it. `orientation:
landscape` is ignored on iOS and **honoured on Android Chrome**, where it also grants the lock.
⚠️ `start_url` must be relative — the base is `./` (`docs/APP.md` §2). ⚠️ `black-translucent` puts
content under the status bar, which the safe-area plumbing already handles
(`src/ui/screens/theme.ts:87-90`).

### 5.2 🥈 Portrait needs a decision, not a letterbox — `src/render/camera.ts:166`

`SUPPORTED_ASPECT.min = 4/3` costs **43 % of the phone's screen in portrait**, more than the browser
does. Three options, all outside this pass:

1. **A rotate prompt** when `matchMedia('(orientation: portrait)')` matches on a coarse pointer —
   cheapest, honest, and it is what §14's decision (*"portrait can't serve the game"*) implies.
2. **The wrapper's landscape lock**, which deletes the case (§51a).
3. Widening the mask, which §14 already rejected.

Note `tools/aspect.mjs` passes at 0.00 wu precisely *because* of the mask — this is a product
decision, not a bug, and the mask is what makes the fairness gate true.

### 5.3 🥉 The weapon row sits on the play area — `src/ui/hud.ts:2113-2120` *(a peer owns this)*

Measured at iPhone 15 landscape: `.hud-weapons` is **262×58 CSS px at (236, 267)** in a 734×343
viewport — horizontal centre **50 %**, vertical centre **86 %**, spanning **x 32-68 %** of the
width. The camera keeps the player at screen centre, so the row sits directly below the character.
Visible in `shots/ph/chrome-match-iPhone_15_landscape.png` and both `shots/ph/look-*-hit1.png`.

The CSS comment at `hud.ts:2109-2112` argues bottom-centre is *"the one band along the bottom edge
that neither thumb rests on — the sticks live in the two lower corners."* **The sticks are floating,
not cornered**: `touch.ts:506` claims a finger for a stick by `clientX < innerWidth * ZONE_SPLIT`
with `ZONE_SPLIT = 0.5` (`touch.ts:74`), so a right thumb landing anywhere in the right half plants
the aim stick — and the row's right half occupies **x 50-68 %, y 78-97 %**, which is squarely inside
the aim zone at thumb height. `ownsTarget()` (`touch.ts:504`) correctly stops a button from planting
a stick, so the failure is not a stuck stick — it is that a thumb aiming there **presses a weapon
instead**. Uri's complaint and the comment are both right; they are about different body parts.

### 5.4 The `low` tier should cut draw calls, not pixels — `src/render/quality.ts:209-221`

See §2b. The only knob in the file that moves the measured bottleneck is the shadow pass
(**302 draws, 43.6 % of a match frame**, priced at `quality.ts:137-139`). It was kept on every tier
for a good reason and on a GPU-shaped argument; the constraint is CPU. **Re-open for `low` only.**
Cheaper things to look at first, since both halves of the frame are ~7.5 ms at ×6: 1,148 meshes /
941 unique geometries / 288 materials in a 1v1 (`perf.mjs` scene block) is a lot of per-object
matrix and uniform work, and the arena's props are already partly merged (`kitchen.ts`) — more
merging is a pure CPU win with no visual cost.

### 5.5 Fix the harness before the next perf claim — `tools/perf.mjs:104-109, 491`

See §2d. Until the mobile profile emulates touch, it measures `high`.

### 5.6 Two visual defects, both tier-independent, both in a peer's files

Judged from `shots/ph/look-low-hit1.png` vs `shots/ph/look-high-hit1.png` (each captured on a frame
where `__feelDebug.hitStopBudgetMs > 0`, so an impact is guaranteed to be on screen):

* **The sticky-trail effect reads as a chain of hard-edged discs** stamped across the floor, not as
  a trail. Identical at `low` and `high`. `src/game/vfx.ts`.
* **The two floating HP pills collide into one bar** when the fighters are close — the player's and
  the enemy's pill overlap at frame centre. `src/ui/hud.ts` `updateFloatingBars`.

**And a negative worth recording: bloom is NOT why VFX looked clunky.** `low` disables bloom and
SMAA (`quality.ts:216-217`), which was the obvious suspect. Read side by side, `high` has a slightly
softer glow on the fog band and cleaner edges, and that is the whole difference. Whatever "clunky"
was, it survives the bloom.

---

## 6. What could NOT be verified here, and exactly what Uri should capture

**Chromium is not WebKit, and this is the one gap that could change a conclusion.** Two specific
risks, both un-measurable on this machine:

* **Draw-call submission cost.** ~790 draws per frame is the CPU half of the frame here. WebKit
  routes WebGL through a separate GPU process; if its per-call overhead is materially higher than
  Chromium's, §2's crossing point moves left and frame rate becomes a real problem again on iOS
  specifically.
* **JSC vs V8** on the sim/VFX/HUD half, and iOS's GC pause behaviour at ~310 KB/frame.

Also unverified: real `env(safe-area-inset-*)` values (Chromium reports 0 regardless), real thermal
behaviour over a 45 s match, and the toolbar-collapse claim in §1.

### The four things to capture, in priority order

1. **The device and iOS version** (Settings → General → About). Everything above is
   phone-class-dependent and this is one line.
2. **A screenshot in LANDSCAPE Safari, in a match.** The portrait one is already understood; the
   landscape one is the mode we would ship and nobody here has seen it on hardware. It also settles
   §1's toolbar claim directly: if Safari's bottom bar is visible while playing, the game is pinned
   to the expanded viewport as predicted.
3. **A 10-second screen recording of a match.** A recording shows stutter; a screenshot cannot. If
   the motion is smooth, §2's negative result is confirmed on hardware and frame rate is closed.
4. **Add the deployed URL to the Home Screen and open it from there, then screenshot.** That is the
   free experiment for §5.1: today it should *still* show browser chrome (no manifest, no Apple
   meta), which both confirms the diagnosis and gives a before/after for the fix.

Nothing here needs a debug build or a cable. If a cable is available, macOS Safari →
Develop → iPhone gives a Web Inspector against the deployed build with a real timeline, and that
would close the WebKit gap outright.

---

## 7. Reproducing this

```bash
node tools/tmp/ph_gpu.mjs                                   # which rasteriser is reachable
node tools/tmp/ph_serve.mjs --start --ref <sha>             # build DEPLOY_BASE=./ from a commit, serve it
node tools/tmp/ph_chrome.mjs --list                         # the sourced device geometry
node tools/tmp/ph_chrome.mjs --scene match                  # §1 + PNGs into shots/ph/
node tools/tmp/ph_frame.mjs --cpu 1,4,5,6 --tier auto       # §2
node tools/tmp/ph_frame.mjs --cpu 4 --tier low,medium,high  # §2b
node tools/tmp/ph_frame.mjs --swiftshader                   # the control: prove the flag, not the box
node tools/tmp/ph_touch.mjs --cpu 1,4,6                     # §3
node tools/tmp/ph_look.mjs --shots 3                        # §5.6
node tools/tmp/ph_serve.mjs --stop                          # kills by recorded PID, never by pattern
```

All of them run against `ph_serve`'s production bundle by default (`$TMPDIR/fa-ph/ph-serve.json`;
override the directory with `PH_SCRATCH`), or `--url`, or `PREVIEW_BASE`.

⚠️ **`shots/` is gitignored** (`.gitignore:22`), so every PNG named on this page is **local, not
committed** — 18 MB of them. They are reproducible from the two commands that write them
(`ph_chrome.mjs`, `ph_look.mjs`) against any build. Regenerate rather than hunt for them.

⚠️ **None of these tools export anything, so none carries an `IS_MAIN` guard** — importing one runs
its CLI path and, for `ph_serve`, exits the importing process. Keep them CLI-only.

**Gate status when this page landed** (`3b7c080` + seven peers mid-edit): `npx tsc --noEmit` clean,
`sim.test.mjs` **424 passed / 0 failed**, `verify-head` OK. `gatecount` reports **6 faults**, all in
`arena-scan`/`level_lab`/`conceal_lab`/`sp_place`/`sp_gate`/`ap_reach` — a peer's live §53 x4-arena
work: `tools/arena.gameplay.json` still records the 1400×1000 map (`MAX_SAFE_RADIUS 993`,
`ENEMY_SPAWN 1240,610`, 27 cover boxes) while `src/arena/` now builds the 2800×2000 one
(`1985`, `2500,1190`, 111 boxes). **Nothing on this page touched `src/`.**
