# Shipping this as a mobile app — what a wrapper must supply

**Status: the bundle is ready. Nothing in `src/` needs to change to run inside a wrapper.**
That is the headline, and it is measured rather than assumed — see *The measurement* below.

This file is the interface between the game and whatever native shell eventually carries it. It
says what the shell must provide, what the game already provides, and — for every claim that could
be checked — how it was checked and what the number was. Where a number could not be obtained on
this machine, it says that instead.

> **Not a port.** Renderer, sim and UI stay exactly as they are. Nothing here asks for a change to
> `src/render/`, `src/game/` or `src/ui/`.
>
> **The wrapper choice is Uri's.** Capacitor vs a hand-rolled WebView vs something else is parked
> in `docs/DECISIONS-FOR-URI.md` **§51** with what each costs. This file is deliberately
> wrapper-agnostic: every requirement below is expressed as a capability, not as an API call in
> somebody's SDK.

---

## 0. The measurement

`node tools/tmp/ab_basepath.mjs --selftest` builds the shipped tree three times from **one** frozen
`git archive HEAD`, serves each build behind a host that **404s everything outside its base**, and
checks each one through three independent senses — a static audit of every emitted chunk, a crawl
of every route and every asset it references, and a live Playwright pass that requires the named
screen to mount with zero 4xx, zero failed requests and zero page errors.

Result on `3b75081`:

| cell | built at | served at | expected | got |
|---|---|---|---|---|
| **PAGES** | `/food-arena/` | `/food-arena/` | PASS | **PASS** |
| **WRAPPER** | `./` | `/app/v1/wrap/` | PASS | **PASS** |
| **BAD-BASE** | `/` | `/app/v1/wrap/` | FAIL | **FAIL** |
| **BAD-LITERAL** | `/food-arena/` + the historical `music.ts` literal | `/food-arena/` | FAIL | **FAIL** |

**4/4.** The two known-bad rows are not decoration: `docs/AGENT-BRIEF.md` §4 — a guard that has not
been shown to FAIL on the bug it guards against is not a guard. BAD-BASE proves the host really
does 404 outside its base (a lenient host would make every row green). BAD-LITERAL re-introduces
the exact literal that made the deployed build silent for as long as the theme existed, and
requires this tool to catch it — which it does, on two senses at once (`LITERAL
assets/main-*.js → /audio/bounce-and-bash.mp3`, and `http 404` live).

### The unrewritten-URL audit — the finding is that there are none

Vite rewrites the asset URLs it **resolves** (module imports, and `/x` inside HTML and CSS) and
never string literals in TypeScript. Every emitted chunk was scanned at all three bases for
root-absolute asset literals, `new URL(...)`, `fetch(...)`, CSS `url()`, worker and
service-worker construction, and any literal ending in an asset extension:

* **Zero** root-absolute asset literals at any base. The only `/`-leading literal in the
  `/food-arena/` build is `"/food-arena/"` itself — Vite's injected `BASE_URL`.
* The only asset URL constructed in TypeScript is the theme, and it is already built off
  `import.meta.env.BASE_URL` (`src/audio/music.ts:90-91`). That line carries a 40-line comment
  explaining why; **do not type a path next to it.**
* The `fetch(` calls in the vendor chunk are Vite's own modulepreload polyfill (which fetches
  `link.href`, already based) and three.js's `FileLoader` / `ImageBitmapLoader`, which nothing in
  this game calls — all geometry is procedural, there is no GLTF and no texture file.
* No service worker, no web app manifest, no `new Worker`, no CSS `url()` anywhere in the output.

**So the base is not the problem. The scheme is.**

---

## 1. A scheme, not a file path — this is the one hard requirement

🚨 **The bundle cannot be loaded over `file://`, and no change to the base fixes it.**

Measured (`ab_basepath.mjs --selftest`, informational row):

```
file:///…/dist-rel/index.html?screen=home
screen=null canvases=0 boot="Heating the kitchen…" origin=file:// localStorage=ok
request: net::ERR_FAILED main-*.js
request: net::ERR_FAILED kitchen-*.js
⇒ BLOCKED — a module script cannot be fetched from an opaque file:// origin
```

The base resolved **perfectly** — the document asked for `./assets/main-*.js`, which is the correct
URL. Chromium refused it anyway: Vite emits `<script type="module">`, a module script is fetched
with CORS, and a `file://` document has an opaque origin. The page sits on the boot curtain
(*"Heating the kitchen…"*) with zero canvases, forever.

**What the wrapper must supply:** an origin. Any of these works, and all of them are what modern
wrappers do by default:

* a custom scheme mapped to the bundled assets (`capacitor://localhost`, `ionic://`, `app://`);
* `WKURLSchemeHandler` on iOS / `WebViewAssetLoader` on Android, serving the same files;
* a loopback HTTP server inside the app.

**What it must NOT do:** point a `WKWebView` at a `file://` URL and hope. That is the Cordova-era
default and it is exactly the configuration measured above.

## 2. The base path — `DEPLOY_BASE=./`, and nothing else changes

`vite.config.ts` already reads `DEPLOY_BASE` and defaults to `/`. Build the wrapper payload with:

```bash
DEPLOY_BASE=./ npx vite build          # → dist/, servable from ANY prefix
```

`./` makes every emitted reference relative to the **document URL**, which is why the WRAPPER cell
passes under a two-segment prefix (`/app/v1/wrap/`) that neither shipped base covers. A wrapper can
mount the bundle wherever it likes.

⚠️ **The one thing `./` depends on**, stated so it is not discovered later: relative URLs resolve
against `window.location`, so they stay correct only while the app's **pathname never gains a
segment**. It does not — `shell.ts:routeUrl()` writes routes into the *query string*
(`?screen=home`) and copies `window.location.pathname` through unchanged. If routing ever moves to
path segments, `./` breaks and the wrapper must switch to its own absolute base.

**Both existing targets keep working**, and the gate proves it in the same run: the PAGES cell is
the live GitHub Pages configuration, unchanged and passing. A change that fixed the wrapper and
broke Pages would fail that row.

## 3. Orientation — the app locks landscape; the web keeps both

**Decided by Uri** (`docs/DECISIONS-FOR-URI.md` §14): *"the game should be landscape. Portrait
can't serve the game. When it will be in an app, we'll force landscape."* Do not reopen it.

**What the wrapper must supply:** a hard landscape lock at the native level — an
`OrientationLock`/`screenOrientation` setting in the app manifest, not a CSS media query and not
`screen.orientation.lock()` from JS (which needs fullscreen and is unavailable on iOS Safari).

**What that does NOT do — read this before deleting anything:**

| target | portrait reachable? | which gate describes it |
|---|---|---|
| **web** (GitHub Pages, any mobile browser) | **yes** — a phone held upright | `menu_accept_portrait.mjs` (**219** assertions) **stays a shipped gate** |
| **app** (wrapper, landscape-locked) | no | `menu_accept.mjs` (**361**) is the one that describes it |

Forcing landscape in the app **does not retire the portrait path**, because the web build is not
going away and a browser on a phone will still render it. `menu_accept_portrait.mjs` and the
portrait layouts in `shop.ts`, `settings.ts`, `trophyRoad.ts` and `characterSelect.ts` all remain
load-bearing for the web target. Deleting them would be a regression *in web* justified by a
decision that was only ever about *app*.

Note also that portrait is not currently broken — it is *letterboxed*. `SUPPORTED_ASPECT` is
4:3 → 21:9 (`src/render/camera.ts:164`) and anything outside it is hard-masked by
`Stage.resize()`, which is what makes `tools/aspect.mjs` pass at **0.00wu spread** across every
viewport. §14 records the cost: at 390×844 the canvas is 292 px tall inside an 844 px viewport.
The landscape lock removes that experience from the app; it does not remove the code.

## 4. Fullscreen / immersive chrome

The game does **not** request fullscreen on its own, and that is deliberate: the only
`requestFullscreen()` in the tree is an explicit, player-operated chip in
`src/game/pointerLock.ts:212`, offered alongside pointer lock and described in that file as
*"complementary, never forced"*. There is no code path that will fight a wrapper for the status bar.

**What the wrapper must supply:** immersive/edge-to-edge mode natively (Android
`WindowInsetsController` immersive-sticky; iOS `prefersStatusBarHidden` /
`prefersHomeIndicatorAutoHidden`). The web `Fullscreen` API is the wrong tool inside a WebView and
on iOS it does not exist.

## 5. Safe-area insets — already wired, but the wrapper has to turn them on

The game reads real notch and home-indicator insets and every screen already respects them:

* `index.html` sets `viewport-fit=cover`, with a comment recording that without it
  `env(safe-area-inset-*)` reports 0 on iOS;
* `src/ui/screens/theme.ts:87-90` declares `--fa-safe-t/r/b/l` from `env(safe-area-inset-*)`;
* those variables are consumed in `ui/hud.ts` (11 sites), `theme.ts`, `trophyRoad.ts` and
  `matchScreen.ts` — the HUD chips, the radar, the pause chip and every screen's padding.

**What the wrapper must supply:** a WebView configured so `env(safe-area-inset-*)` is non-zero.

* **iOS** — the default `WKWebView` in a full-screen view reports them correctly. Do not set
  `contentInsetAdjustmentBehavior = .always` and then also inset the view; the insets get counted
  twice.
* **Android** — `env()` returns **0** unless the activity opts out of fitting system windows:
  `WindowCompat.setDecorFitsSystemWindows(window, false)`, plus a display cutout mode of
  `shortEdges`. Without that, everything above degrades silently to a 0 px inset — which looks
  fine on a device with no notch and clips on one with.

⚠️ Not verified on hardware here: this machine has no notched device. The CSS plumbing is proven
(`menu_accept.mjs` asserts safe-area behaviour with the variables overridden on `<html>`, which is
how the notch cases are simulated); the *native* half of the contract is stated from the platform
rules, not measured.

## 6. Back button

`src/ui/screens/shell.ts` is already a history-driven router and its `popstate` handler names the
Android hardware back button explicitly (`shell.ts:648-665`). Back and forward move between screens,
a `popstate` arriving mid-transition is queued and drained rather than dropped, and
`writeHistory()` wraps `pushState` in a `try/catch` because *"`pushState` throws a SecurityError on
`file://` and inside a sandboxed iframe, and some embedded webviews rate-limit it"*.

**What the wrapper must supply:** nothing, for in-app navigation — but it must **decide what
happens at the root entry**. The first mount `replace`s rather than `push`es, so at the home screen
there is no history to go back to and the platform's default is to exit the app. Two options:

1. **Let it exit.** Correct and expected on Android.
2. **Intercept** (`App.addListener('backButton', …)` or `onBackPressed`) and require a second press
   / show a confirm. This is what most games do.

Either is fine; it is a wrapper-side choice, and it needs no change in `src/`. Parked with the
wrapper decision in §51.

⚠️ Note the interaction with §1: on `file://`, `pushState` **throws**, so back-button navigation
would be dead even if the bundle loaded. A real scheme fixes both at once.

## 7. Audio unlock — measured: the FIRST tap does unlock it

**Question:** menu audio is procedural synthesis plus one 4.1 MB theme asset, and mobile autoplay
policy requires a user gesture. Does the player's first tap unlock it, or do they have to tap twice?

**Answer: the first tap unlocks it, and the theme starts from it.**

Measured with `node tools/tmp/ab_basepath.mjs --unlock` — a `./` build served at `/app/v1/wrap/`,
Chromium launched with `--autoplay-policy=user-gesture-required`, an 844×390 touch viewport, and
the **cold-launch route** (bare path → the title card, which is what a wrapper opens):

```
NO-TAP  control
  before tap : t=3416ms  engine=idle     ctx=null     screen="opening"  userActivation=false
  settled    : t=10607ms engine=idle     ctx=null     screen="home"     music.playing=false
  theme      : bus rms=null      (no AudioContext was ever created; no mp3 request)

ONE-TAP
  tap        : page-side pointerdown at t=3788 ms
  before tap : t=3604ms  engine=idle     ctx=null     screen="opening"  userActivation=false
  after tap  : t=3919ms  engine=running  ctx=running  userActivation=true
  settled    : t=11404ms engine=running  ctx=running  music.playing=true  clock=5.97s
  theme      : bus rms=0.021273   mp3 request: 200
```

The engine goes `idle → running` **inside 131 ms of the first pointerdown**, and the theme is
audible on the master bus at 0.021 RMS against a silence floor of 1e-4. The NO-TAP control stays
`idle` with no context at all for the whole 10.6 s — including after the title card auto-continues
to home — which is what proves the policy was actually being enforced and the ONE-TAP row is
measuring an unlock rather than a browser that never blocked anything.

**Why it works:** `src/ui/screens/opening.ts:146` calls `audio.unlock()` from the title card's
`enter()`, which is wired to the first key, the first pointer and a 4.5 s auto-continue; and
`src/audio/engine.ts:482` binds `pointerdown`/`touchend`/`keydown`/`click` on `window` in capture
phase and keeps listening until the context genuinely reports `running`. `music.ts` remembers a
refused `play()` and retries on unlock, so the theme is not lost to the refusal at boot.

**One documented nuance, and it is not a bug:** the *click sound* of that very first tap is
dropped. `resume()` is asynchronous, so the context is still `suspended` for the whole of the first
gesture's call stack and any voice scheduled from it is counted as `droppedNotRunning`
(`shell.ts:732`). The title card's "tap to start" is what spends that first tap, which is why home
is audible from its first button onward. **A wrapper that skips the title card and deep-links
straight to home would spend the player's first *menu* tap instead** — the theme would still start,
but that one button press would be silent.

**What the wrapper must supply:** nothing. Do not add a synthetic gesture, and do not deep-link
past the title card. ⚠️ On iOS specifically, `WKWebView` needs
`mediaTypesRequiringUserActionForPlayback` left at its default (i.e. *do* require a gesture) — the
app's unlock path depends on a real one arriving, and it will.

⚠️ Not verified here: real iOS/Android WebView autoplay behaviour. This is Chromium with the
policy forced on. Safari's rules for `createMediaElementSource` are stricter than Chromium's, and
the theme is the one asset that goes through a media element.

## 8. Fonts — the wrapper must bundle them, and here is the cost of not doing it

`index.html` loads **Rubik** and **Heebo** from `fonts.googleapis.com`. That is the only external
network request the game makes, and an app is offline-capable by definition.

Measured — the same home screen at 844×390, once with the font CDN reachable and once with it
blocked:

| | fonts reachable | fonts blocked |
|---|---|---|
| `document.fonts.size` | **33** faces | **0** |
| computed `font-family` | `Rubik, sans-serif` | `Rubik, sans-serif` (falls through to the system sans) |
| rendering | on-brand | legible but visibly off-brand |

Reading the two screenshots side by side: the whole UI shifts to the platform sans, pill widths
change, and **the weapon caption on the home screen clips** — with Rubik it reads
`Tomato Toss –  Slows enemies down` on two lines inside its pill; with the fallback the wider
metrics push it to `Tomato / Toss –` and the leading `T` is cut off at the pill's left edge. That
is a real layout defect that only exists when the fonts are missing, so no shipped gate sees it.

**What the wrapper must supply:** the two families as local assets. Either self-host the `woff2`
files and swap the `<link>` for an `@font-face` block, or accept the fallback knowingly. This is
the only item in this file that needs an edit to a file outside `tools/` — `index.html` — and it is
**not** made here, because that file is not this pass's to own. See *Out of scope, reported* below.

## 9. Payload

The whole shipped bundle, `DEPLOY_BASE=./`, measured on `3b75081`:

| file | bytes | gzip |
|---|---|---|
| `audio/bounce-and-bash.mp3` | 4,133,040 | — (already compressed) |
| `assets/kitchen-*.js` (three.js + postprocessing) | 1,162,094 | 351,272 |
| `assets/main-*.js` (the game) | 748,007 | 238,727 |
| `assets/preview-*.js` | 6,665 | 2,943 |
| `index.html` | 3,797 | — |
| `preview.html` | 1,076 | — |
| **total** | **≈6.0 MB** | — |

**68% of the payload is the theme track.** If an app-store download size ever becomes a
constraint, that is the only lever worth pulling and it is a re-encode, not a code change.

`preview.html` and `assets/preview-*.js` are the piece-preview harness used by `tools/`. They are
7.7 KB and cost nothing, but a wrapper may drop them from the payload if it wants; nothing in the
game links to them.

## 10. What the wrapper does NOT need to supply

Stated because each of these is a plausible thing to go build, and each is already handled:

* **Storage.** `localStorage` only, one JSON blob per concern, and **every** call site is inside a
  `try/catch` or a `typeof localStorage === 'undefined'` guard (`profile.ts`, `settings.ts`,
  `engine.ts`, `music.ts`, `quality.ts`). It also works on `file://` — measured `localStorage=ok`
  in the blocked-boot run above, so storage is not what stops that configuration.
* **A network layer.** There is no backend, no analytics, no telemetry and no fetch of anything but
  the bundle's own assets.
* **Touch input.** Twin floating sticks are shipped and proven with real touch events; the sticks
  claim a finger by which half of the width it lands in, which is orientation-independent.
* **Quality tiers.** `src/render/quality.ts` already detects device class and caps DPR.
* **Pause on background.** `input.ts` and `engine.ts` both bind `visibilitychange`; the sim
  releases held sticks and the audio context suspends.
* **A splash screen.** `index.html` paints its own boot curtain before any JS runs.

---

## Out of scope, reported

Found by this pass, in files it does not own. Each is a one-line change; none was made here.

1. **`index.html` — the Google Fonts `<link>` is the app's only external dependency.** §8 measures
   the cost. The fix is to self-host `Rubik` and `Heebo` as `woff2` under `public/fonts/` and
   replace the three `<link>` tags with an `@font-face` block. It benefits the *web* build too — it
   removes a render-blocking third-party request from the critical path.
2. **`docs/TOOLS.md` needs a gate-table row for `ab_basepath.mjs`**, and `tools/tmp/gatecount.mjs`
   a matching `SKIP` entry (it is browser-bound and runs four `vite build`s). The exact text is in
   this pass's report; neither file is owned here, and `gatecount` treats a table row as executable,
   so the release valve does not cover it.

## Running it

```bash
node tools/tmp/ab_basepath.mjs                 # PAGES + WRAPPER + BAD-BASE          (~4 min)
node tools/tmp/ab_basepath.mjs --selftest      # + BAD-LITERAL + the file:// row     (~6 min)
node tools/tmp/ab_basepath.mjs --unlock        # the audio gesture, phone-shaped     (~2 min)
node tools/tmp/ab_basepath.mjs --base /x/y/z/  # try some other third base
```

⚠️ It builds from `HEAD` by default. `--from worktree` includes every peer's live edits, which in a
six-agent session means a stranger's half-typed line can fail it on a file you have never opened.

🚨 **If you edit the unlock probe, read its header first.** `page.evaluate()` grants transient user
activation, and the first version of that probe handed the app a gesture it never received —
reporting the theme playing at rms 0.022 with **no tap at all**. The whole probe is structured
around avoiding that.
