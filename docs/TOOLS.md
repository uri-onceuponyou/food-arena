# Tools runbook

Sixteen tools. Almost every one was built to answer a question that had already cost real
time. **Prefer reaching for one of these over inventing a new probe.**

```bash
npm run dev        # http://localhost:5173 — SHARED. Fine for a quick look, never for a number,
                   # and NEVER for actually playing (see below).
npx tsc --noEmit
node src/game/sim.test.mjs            # 253
node src/game/economy/economy.test.mjs # 220
```

---

## 🎮 To PLAY the game while agents are working

```bash
node tools/tmp/playtest.mjs          #  ▶  http://localhost:4321
```

**Do not play on `localhost:5173`.** Nothing in `src/` calls `import.meta.hot.accept`, so every
save by every agent becomes a Vite **full page reload**; and nothing in `src/` calls
`history.pushState`, so the URL never changes as you navigate — a reload therefore re-derives the
boot route from the original bare `/` and lands on **opening → home**. Mid-match, that presents
exactly as *"the game crashed and started over from the home screen."*

Measured on the shared dev server on 2026-08-05, one 7.7-minute session, no intervention:
**16 document loads — 15 Vite `full-reload` frames**, every one naming a peer's file
(`src/audio/director.ts` ×8, `src/game/ai.ts` ×6, `src/audio/sounds.ts` ×1). They are **bursty**:
nothing for the first 323 s, then **15 reloads in 140 s — one every 9.3 s**, against a **45 s
match**. Evidence: `shots/crash/wild/` (`before.png` is a live match at 0:45;
`after-reload-3.png` is the home screen) and `shots/crash/wild/report.json`.
The same 12-round-trip drive against `playtest.mjs`'s production build over the same period:
**1 load, 0 reloads, 0 websocket frames** (`shots/crash/prod/report.json`).

`playtest.mjs` freezes the tree, runs `vite build`, and serves the **production bundle** — which
contains no HMR client and opens no websocket, so no save can reach it. It **detaches into its own
session**, so unlike `tools/snapshot.mjs` it survives the shell that started it.

```bash
node tools/tmp/playtest.mjs              # freeze the working tree, build, serve, print the URL
node tools/tmp/playtest.mjs --from head  # build the COMMITTED tree instead
node tools/tmp/playtest.mjs              # re-run to pick up the latest work
node tools/tmp/playtest.mjs --status
node tools/tmp/playtest.mjs --stop
```

`tools/tmp/reload_watch.mjs` is the instrument that proved it: it leaves the real Vite HMR client
in place (which `journey.mjs` deliberately stubs out at line 224, making every e2e run so far
**structurally blind** to this failure) and logs every websocket frame, unload, GL context and
error to `sessionStorage`, so the record survives the reload it is catching.
`--trips N` reuses it as a menu↔match round-trip stress.

---

## Always start here

### `tools/snapshot.mjs` — frozen tree on a private port
Measurement contamination is a separate problem from write conflicts (`docs/LESSONS.md` §5).
**Anything you will quote a number from must run against a snapshot.**

```bash
node tools/tmp/with_snapshot.mjs -- node tools/arena-scan.mjs --url '$URL' --out shots/scan/x
```

⚠️ **The server dies with the shell that started it** — start it and measure in the *same*
invocation. Backgrounding it and measuring in the next call fails with
`ERR_CONNECTION_REFUSED`, which reads exactly like a broken build.

🚨 **The one-liner this file used to recommend DOES NOT WORK, and cost three separate agents
10–20 minutes each before any of them diagnosed it:**

```bash
# BROKEN — never returns. Do not use.
URL=$(node tools/snapshot.mjs --json | python3 -c "...")
```

`--json` prints the URL but **does not exit** — it must stay alive to hold the server up, and the
spawned Vite child keeps the event loop open. Command substitution waits for the *whole pipeline*
to finish, so `$(...)` blocks forever and `json.load(sys.stdin)` never sees EOF. It looks exactly
like a hung build. `tools/tmp/with_snapshot.mjs` owns both sides and runs N commands against one
snapshot; it exists because of this. If you must inline it, background and poll instead:

```bash
node tools/snapshot.mjs --json > /tmp/snap.json 2>/dev/null &
for i in $(seq 1 240); do [ -s /tmp/snap.json ] && break; node -e 'setTimeout(()=>{},500)'; done
URL=$(node -e "console.log(require('/tmp/snap.json').url)")
```

⚠️ **`tools/aspect.mjs` defaults to `localhost:5173` — the SHARED dev server** (`aspect.mjs:26`).
With peers running it fails with `window.__fairView is not a function` or a raw stack trace, which
reads like a broken camera and is not. Point it at a snapshot. Three agents hit this too.

`--swap <path>` freezes everything *except* one file (symlinked live). This is the only way
a before/after A/B means anything while other work is in flight.

### `tools/verify-head.mjs` — verify the COMMITTED tree
```bash
node tools/verify-head.mjs            # imports resolve + tsc + sim, against git archive HEAD
node tools/verify-head.mjs --serve    # also boots Vite and fetches every route
node tools/verify-head.mjs --ref <sha>
```
The standing gates check your *working tree*. This checks what you are pushing. **Run before
every push.**

---

## Rendering and capture

| tool | use |
|---|---|
| `tools/shoot.mjs` | `--url <u> --out x.png --w 1600 --h 900`. Headless WebGL capture; **always foreground**. |
| `tools/compare.mjs` | `--tile "a.png,b.png" --labels "a,b" --cols 2 --out sheet.png` |
| `tools/review.mjs` | `--ours <png> --category character\|gameplay --out shots/review/x --n 2` — builds a **blind** A/B packet. The answer key is a separate `.json` a critic must never open. ⚠️ **Refuses any PNG with no `.capture.json` sidecar** — see the provenance block below. |

**Preview harness** — `preview.html?`
- `piece=character&id=<id>&anim=<state>&yaw=&t=&shot=1&fill=`
- `piece=roster` · `piece=roster&silhouette=1` (the most diagnostic single shot on this project)
- `piece=arena&tx=&ty=&view=overview|gameplay` · `piece=floor` · `piece=prop&kind=<kind>`
- ⚠️ `face=1` is **unusable for non-spherical heads** — assumes the rig's default face position.
- ⚠️ `mountProp()` fits the camera to the prop, so **prop views are NOT shipped scale.**

**Real game** — `/?player=<id>&enemy=<id>` plus QA params `simSpeed`, `fogRadius`, `px`, `py`,
`pointerLock=0`, `aimMode=free`, `screen=home|characters|trophies|settings|opening|match`.

---

## Measurement

| tool | answers |
|---|---|
| `tools/arena-scan.mjs` | **The whole-arena scoreboard.** 18 player-centred stations through the live game. Reports `playerRank` in a 16×9 salience grid, player-vs-surround luma/saturation, a hue histogram, channel clipping — **and the cumulative colour budget nobody was watching**: absolute mean saturation / warm chroma / cool chroma measured the same way the reference figures were, split ENVIRONMENT vs CAST by an exact matte, with a hue-collision number. `--list`, `--only`, `--sim-speed 0.02` for byte-comparable runs. See the colour-budget block below. |
| `tools/aspect.mjs` | Viewport fairness. Must PASS at **0.00wu spread** across 4:3 → 32:9 → portrait. |
| `tools/perf.mjs` | `--mode counts\|ablate\|alloc\|boot\|leak`. `--json` baselines, `--baseline` regression gate. **Hardware-independent numbers only** — it refuses to print timings as performance without `--unsafe-timing`. |
| `tools/audio-probe.mjs` | `--mode all\|depth\|identity\|live`. **319 assertions from real rendered samples** via `OfflineAudioContext` on the production path. |
| `tools/match-sim.mjs` | Real `sim.ts` in Node. `--all-matchups`, `--policy idle\|smart`, `--pathmap`, `--fog`, `--ranges`, `--occlusion`. A 180s match costs ~4ms. |
| `tools/match-play.mjs` | Drives the real game boot → menus → combat → result, sampling the HUD's own DOM. |
| `tools/tmp/journey.mjs` | **The only end-to-end gate.** `match-play` × N round trips in ONE page session, so it can see what LEAKS between a match and the menus — GL contexts, errors, profile state. Every gate above it is a unit gate, and HEAD was unbootable for 24 commits with all of them green. `--trips`, `--viewport portrait`, `--mode timeout\|idle`. |
| `tools/filmstrip.mjs` | Animation as a contact sheet. Auto-detects cycle length; labels one-shots "NOT A LOOP". |
| `tools/motion_probe.mjs` | Joint traces in the character's local frame — camera, framing and post chain out of the equation. |
| `tools/tmp/menu_accept.mjs` | **361 assertions**, 5 viewports × 5 screens × notch/no-notch. Also **parses all 88 modules in ~95ms** to catch the backtick trap. `PREVIEW_BASE=<url>` to point it at a snapshot. |

#### `arena-scan` colour budget — the guard rail on cumulative desaturation

```bash
node tools/arena-scan.mjs --url $URL --baseline tools/scan/colour-baseline.json  # exit 1 on a colour regression
node tools/arena-scan.mjs --url $URL --gate         # also exit 1 on an absolute rail FAIL
node tools/arena-scan.mjs --url $URL --json tools/scan/colour-baseline.json      # RE-baseline (deliberate only)
node tools/arena-scan.mjs --ref-plates reference/images/curated/gameplay         # re-derive the reference figures
node tools/arena-scan.mjs --selftest               # 105 assertions on synthetic frames, no browser (was 78)
node tools/arena-scan.mjs --no-role                # skip the cast matte / HUD-free capture
```

**Run the gate before and after any colour pass.** Two independently-correct desaturation passes
took warm chroma to 0.067 against a reference 0.145 because each only measured itself
(`docs/LESSONS.md` §7).

- Methodology is `tools/tmp/chroma.mjs` verbatim, so numbers compare directly to every recorded
  figure. `--ref-plates` re-derives 0.1449 / 0.3431 / 0.297 / 0.493 with the same code and fails
  loudly if it ever stops matching.
- The gate is **directional and drift-based**: moving toward the reference never fires it; moving
  further by more than tol does, band or no band. Tolerances are ~100× the measured noise floor.
  A baseline from a different station set is refused (exit 2), not compared.
- **`<id>.canvas.png` includes the DOM HUD** — Playwright element screenshots capture the
  composited page, so "canvas only, no HUD" has never been true. 13.4% of frame, ~25% of its warm
  chroma. Whole-frame numbers keep it (so do the reference plates, which carry their own HUDs);
  the role split uses `<id>.nohud.png` instead.
- **Open `<id>.matte.png` before believing any role number.** Cast coverage outside ~0.2–3% means
  the matte is wrong, not the arena.
- ⚠️ **`arena-scan` writes no `.capture.json`, so `review.mjs` REFUSES its PNGs.** This is the
  most likely way the new provenance gate bites you. Pass `--allow-unverified` and record the
  round as **provisional**; do not reach for `--allow-refused`, which means something else.
- `--sim-speed 0.02` freezes the sim, **not the shaders** — fog stations drift ±0.004 on
  `playerSalience` run to run. `playerRank` never moves.

**Where the arena stands as of this baseline:** meanSat **0.324** vs reference 0.493 (FAIL — below
the lowest of eleven plates at 0.370, and only 0.022 above the 0.302 three critics called "muddy");
warm chroma **0.064** vs 0.145 (FAIL, 44% of reference); cool 0.252 and warm *share* 0.214 both
PASS. The frame is **under-chromatic overall, not warm-heavy — there is nothing here to
desaturate.** Meanwhile 19.1% of all environment chroma sits inside the hero's ±30° hue band and
37% of the loudest non-player cells are wearing the cast's own hue.

### Scratch probes worth reusing (`tools/tmp/`)
`matcover.mjs` (exact share-of-frame per material, and the colour it *arrives* at) ·
`simfix.mjs` (override materials live, re-run salience — prices a change before you write it) ·
`caphex.mjs` (~20× cheaper than simfix for candidate colours) ·
`chroma.mjs` / `satmetrics.mjs` (reference-plate comparison) ·
`vfxdiag.mjs` (per-mesh world/screen/opacity dump, garish mode, pool-warm mode) ·
`lolliv.mjs` (virtual clock — hand-crank any effect in exact ms slices) ·
`rake.mjs` (runtime ablation + the HMR-stub pattern) · `chk.mjs` (names a broken dev-server URL in 2s)

**Added this session** — each was built to answer a question that had already cost time:
`with_snapshot.mjs` (**owns both sides of a snapshot and runs N commands against it — use this
instead of the broken `$(...)` idiom**) · `hud_harness.html` + `radar_probe.mjs` (mounts the real
`createHud` against a synthetic `MatchState`; the radar is pure DOM/CSS so the pixels are the
game's, but a sample costs ~80ms instead of ~40s of SwiftShader boot) · `zone_warn.mjs` (measures
whether a warning cries wolf, in world units) · `hud_fit.mjs` (text overflow, 5 viewports × 3
states) · `home_metrics.mjs` (WCAG contrast for every text run **against the pixels actually
behind it** — the only way an inherited opacity or a WebGL backdrop counts) · `hudshare.mjs`
(prices what the DOM HUD contributes to a "canvas-only" capture) · `charprobe.mjs` (per-joint
delivered-vs-possible pixels; **the instrument that found nine characters' limbs buried inside
their own bodies**) · `potvis.mjs` (silhouette visibility by two-clear-colour matte) ·
`simlayer_{probe,clock_sweep,ab}.mjs` (sim A/B with `rules.ts` held constant, so a logic change
and a constant change are never measured together)

---

## ⚠️ `__screenReady` IS NOT A PAINT — the single most contaminating capture bug found here

`window.__screenReady === true` is set in the **same tick** the curtain drops, and `.fa-screen`
then runs a 0.26 s fade. **Measured opacity is 0.000 when the flag flips.** The flag is wrong on
**every** curtained navigation (2/2) and about half of first mounts (5/9).

A faded frame **compresses** contrast, so a reading taken on the flag is not merely noisy — a
contrast tool whose whole purpose is *"against the pixels actually behind it"* returns a number
for pixels that are not there yet. It survived so long because it is **intermittent**: it appears
only when caching makes the capture faster than the animation.

Re-measured on a frozen snapshot by `e2e_boot_probe.mjs` against a **proven-painted** control
rather than a 2.5 s sleep — character select, one page, one navigation:

```
at __screenReady   stdev 42.38  mean  87.7   painted=false
                   curtain 1.000 · screen opacity 0.000 · fa-screen-in running
                   · transform matrix(0.992, 0, 0, 0.992, 0, 10)
once PROVEN painted stdev 97.55 mean 131.0   settled in 275 ms
```

**2.3x on identical content**, and the control took 275 ms — so the old 2.5 s sleep was 9x longer
than needed and still not a condition.

→ **Wait on `tools/tmp/settle.mjs`, never on the flag.** One shared paint condition, correct at
any machine speed rather than merely longer — it returns in 23 ms on settings and 11.9 s on the
trophy road from the *same* predicate. `tools/tmp/capture_audit.mjs` audits which side a capture
site is on; **15 files are enforced and 27 still wait on a flag** (was 7 and 34).

`capture_audit` enforces a **per-ROLE** obligation, not a blanket one, because a capture tool, a
wait-only geometry battery and a packet consumer have three different ones and a rule loose enough
for all three guards nothing:

| role | obligation |
|---|---|
| `capture` | zero raw `.screenshot()`, ≥1 `captureSettled()` |
| `geometry` | imports `settle.mjs`, ≥1 settle call, **settles ≥ flag waits**, zero raw shots |
| `consumer` | imports the frame floor **and** reads the `<png>.capture.json` sidecar |

`// capture-audit: allow <reason>` on the shot's own line or the line above is the escape hatch,
for a probe whose SUBJECT is the unsettled frame (`e2e_boot_probe.mjs`, `settle_validate.mjs`).

⚠️ **Not every flag wait is a defect, and the fix is not uniform.** Decide per file:
`tools/aspect.mjs`'s verdict is `__fairView()`, a camera number a CSS transform cannot move — only
its optional `--out-dir` PNG ever needed a guard. `tools/filmstrip.mjs` shoots `preview.html`,
which mounts **no shell at all** — no `#boot`, no curtain, no `.fa-screen` — so the fade guard is a
no-op there and the **flat-frame floor** is the only part doing work. Conversely
`tools/tmp/name_accept.mjs` captures nothing and was still exposed: it clicks and types on a screen
that is at `translateY(10px) scale(0.992)` and still moving, which is how `menu_accept`'s
round-trip flow died on a 30 s `page.click` timeout.

### 🚨 `review.mjs` now REFUSES a PNG with no provenance — operational, affects every critic round

Any PNG without a `<png>.capture.json` sidecar is **refused by default**, `arena-scan` output
included. Two flags exist and they are **not interchangeable**:

```bash
node tools/review.mjs --ours x.png --category character --allow-unverified   # no provenance at all
node tools/review.mjs --ours x.png --category character --allow-refused      # provenance says BAD
```

`--allow-unverified` records `verified:false` in the manifest and the last line printed says the
score must be **recorded as provisional**. It does **not** launder a frame whose sidecar says the
capture was refused — `review_gate_validate.mjs` proves that with a mid-fade fixture that is
deliberately pixel-HEALTHY (stdev 54.25), so only provenance can catch it.

**The sidecar earns its keep on more than fades.** Its first run on `journey.mjs` wrote
`"screen": "opening"` into `06_desktop_home_after_reload.png.capture.json` — a healthy,
fully-painted frame under a label that says *home*. That named a pre-existing probe bug in one
line: a reload of a bare `/` **re-derives the boot route** (`main.ts`) and lands on opening, so
`window.__screen && __screenReady` was satisfied by a screen carrying none of home's DOM, and
`home-shows-the-persisted-record` was failing a claim about PERSISTENCE with a fact about ROUTING.
**Wait on the screen's NAME, never on "some screen is ready".**

---

## ⚠️ THE CRITIC — calibrated, and it has a floor

`tools/review.mjs` + **`tools/review.rubric.txt`** (`--rubric canonical`). Measured properties:

- **Resolution floor ±1.4 points.** σ = 0.50 over 16 fresh critics on one fixed image. A round's two
  panels are **n=1, not n=2** — one critic scores both and agreed with itself 4 of 4 times. Two
  *independent* critics bring it to ~1.0. **Do not act on a smaller difference.**
- **The rubric is worth 2.0 points.** The same sheet reads 5.0 under "overall visual quality" and 3.0
  under "character design only", with the reference unmoved. **Never compare across rubrics.**
- **Position bias 0.00** — our frame against itself tied 6/6.
- **Validated both ways:** a real Brawl Stars plate submitted *as ours* scores 8.67; a degraded frame
  scores 1.83 *below* its own clean original.
- **Ceiling 8–9, never 10** over 34 observations — so a 7+ bar sits ~1–1.5 below shipped Brawl Stars.
- ⚠️ Plates: `gameplay_topdown/` for gameplay (mixed-camera draws invalidated four rounds),
  `menus/` for screens. **Capture ACTION frames and a POPULATED profile** — idle frames and empty
  saves each cost ~1 point.
- ⚠️ Blindness is imperfect: critics name the reference titles on sight and `CLAUDE.md` is in every
  subagent's prompt. The instrument still discriminates; the caveat stands.

---

## THE GATE BATTERY — run all of these before you believe a change

The five gates in `CLAUDE.md` were the whole story when there were five. There are now
**twenty-five**, and every one exists because something shipped past its absence. Counts below
are current as of the capture-integrity follow-through; `screen_metrics` and `home_metrics` are
"ALL CLEAN / 0 below AA" batteries rather than assertion counts and sit with `chars_metrics`:

| gate | expect | covers |
|---|---|---|
| `npx tsc --noEmit` | clean | ⚠️ the **working tree**, incl. peers' half-saved files |
| `node tools/verify-head.mjs` | OK | **the COMMITTED tree** — the only one that matters before a push |
| `node src/game/sim.test.mjs` | **253** | sim, combat, AI, navigation, status, concealment rules |
| `node src/game/economy/economy.test.mjs` | **220** | economy, seeded and deterministic |
| `node tools/aspect.mjs` | PASS, **0.00wu** | viewport fairness — point at a **snapshot** |
| `tools/tmp/menu_accept.mjs` | **361** | 5 landscape viewports × screens, + the CSS-backtick parse |
| `tools/tmp/menu_accept_portrait.mjs` | **219** | portrait + the nested-`@media` lint. **Opt-in, not folded in** |
| `tools/tmp/input_accept.mjs` | **81** | real CDP keys/mouse asserted against **sim state**, both routes |
| `tools/tmp/shop_accept.mjs` | **168** | every displayed price/odd re-derived in Node |
| `tools/tmp/name_accept.mjs` | **29** | name sanitiser, both entry paths |
| `tools/tmp/chip_probe.mjs` | **72** | pause chip vs thumb zone, 6 viewports × 2 states |
| `node tools/audio-probe.mjs --mode all` | **389** | ⚠️ `--mode live` is flaky under load; judge by depth 91 / identity 77 |
| `node tools/arena-scan.mjs --selftest` | **105** | colour-budget metric + the station-placement guard |
| `node tools/match-sim.mjs --selftest` | **15** | the scripted policies, against a hand-derivable answer |
| `node tools/tmp/valuescan.mjs --selftest` | **105** | value-ladder metric on synthetic frames. ⚠️ Was **57** until `c3e3fbc`/`fc3d048` and **78** until the `dLcontact` pass; a run reporting 57 or 78 is an OLD TREE, not a pass. §L and §M are the two known-bad-input proofs — §L shows `dL` returning a confident **wrong** answer in both directions, §M shows a `__meta` stamp lifted off another file being **refused** |
| `node tools/tmp/p5_dlprobe.mjs` | **12** | the derivation behind §L. `--live <dir>` recomputes `dLcontact` for all 11 characters from an existing `--mode chars` output **with no browser**, and refuses any character whose recovered owner map does not reproduce the recorded contact counts exactly |
| `tools/tmp/quality_api.mjs` · `dpr_probe.mjs` | **20** · **24** | render tiers and the DPR cap |
| `node tools/perf.mjs --mode leak` | contexts flat at **1** | the leak that white-screened after ~8 round trips |
| `node tools/tmp/settle_validate.mjs` | **22** | the shared PAINT condition — correct at any machine speed, not merely longer |
| `node tools/tmp/review_gate_validate.mjs` | **8** | `review.mjs` refusing un-vouched PNGs |
| `node tools/tmp/capture_audit.mjs` | **13** + **15** | classifies every capture site as paint-waiting or flag-waiting; **`--selftest` for the 13** |
| `node tools/tmp/rarity_aa.mjs` | 0 below AA of **43** | `.fa-rarity` per rarity × home + character select × 3 viewports, **both** contrast models |
| `node tools/shoot.mjs --selftest` | **6** | the capture path itself |
| `node tools/tmp/snapsweep.mjs --selftest` | **5** | age parser for the leaked-snapshot sweeper |
| `node tools/tmp/sentinel.mjs` | **32** + 16 live | ⚠️ **the meta-guard.** MOVES / HOLDS / ORDERS / SELF-PAIR — each kind run against an instrument broken that way and REFUSED there. `VL.adjacency` covered as of the 32/16 counts, on **MUTANTS OF `VL_SRC` ITSELF** (5: dLcontact aliased to dL, dL "fixed" to the band, the bands swapped, a constant offset, luma-gated contacts) — plus its own control that an unmutated rebuild reproduces the real `VL` exactly. ⚠️ **`selfPair` without `identity` proves DETERMINISM ONLY** — `metric(a)` vs `metric(a)` is zero for any pure function, so name the identity answer whenever it is known |
| `node tools/tmp/driver_guard.mjs` | **86** | no 14th copy of the scripted driver; SHARED entries checked from the registry; RANK/HEAL/RANKKEY added with driver rev 4 |
| `node tools/tmp/capture_audit.mjs` | **43/43 owned** | 0 exposed, 14 `css-immune` (claimed by annotation, mechanically refused if the file screenshots) |
| `node tools/tmp/kit_lab.mjs --selftest` | **10** | matchup-profile divergence + behavioural fingerprint, calibrated on a literal clone |
| `node tools/tmp/level_lab.mjs --selftest` | **7** | the level ladder and its win-rate curve |
| `node tools/tmp/limbmatch.mjs --selftest` | **27** + 9 control | hull deficiency / appendages / share — **computable on a reference plate** |
| `node tools/tmp/sepscan.mjs --selftest` | **38** + 8 control | internal separation (neck pinch, chin notch, head:body area) |
| `node tools/tmp/trail_probe.mjs` | controls 3 | same-frame ablation of ground marks vs floor **and** cast |
| `node tools/tmp/aoband.mjs --selftest` | **25** | contact darkening binned by metres from the footprint |
| `node tools/tmp/haloprobe.mjs --selftest` | **27** | bloom-attributable halo as a paired `shipped − bloomOff`. ⚠️ Detects a rim via `userData.rimUniforms`, so it **counts a JSON-mangled corpse as live** after a plain `.clone()` — see `clonetoon_test` |
| `node tools/tmp/clonetoon_test.mjs` | **33** | ⚠️ **`Material.clone()` does not copy `onBeforeCompile`** — the root cause of the #1 defect. Asserts the DEFECT first, and was mutation-tested: drop the re-apply → 12 fail; keep the dead uniform handle → 1 fail (exactly its row); ignore `rim: false` → 5 fail |
| `node tools/tmp/kneeprice.mjs --selftest` | **21** | prices `highlightKnee` as a **paired** sweep inside one synchronous evaluate (drift control exactly 0.0000). `--plates [--whole]` offline. Its known-bad fixtures are the two quantities `stage.ts` conflated, **in both directions** |
| `node tools/tmp/rebind_accept.mjs` | **35** | key rebinding asserted against **sim state**, not the DOM |
| `node tools/tmp/touchfeel.mjs` | **79** | stick bearings, dead zone, multi-touch, `touchcancel` |
| `tools/tmp/nav_history_probe.mjs` | **44** | URL names the screen · reload lands there · back/forward · query params survive · a throwing screen cannot freeze the router |
| `tools/tmp/glloss_probe.mjs` | **29** | forces a REAL context loss via `WEBGL_lose_context`; asserts the restored frame is the SAME frame against a drift control |
| `node tools/tmp/driver_guard.mjs` | **86** | ⚠️ **This row said 49 and duplicated the row above it** — two counts for one gate, so either could be "confirmed" by reading the other. Measured **86** (driver rev 4 — the RANK, HEAL and RANKKEY sections landed with the `bestWeapon` fix; it was 60 at rev 3). Fails if a **14th** copy of the scripted driver appears, or a fixed copy loses its guard. Every check also runs against the historical driver and must FAIL there |
| `tools/tmp/floorprobe.mjs` | **5/5** | the floor's own gameplay test — breaks on any global value change |
| `tools/tmp/chars_metrics.mjs` | ALL CLEAN | roster card fill, face-in-card, WCAG |
| `tools/tmp/screen_metrics.mjs` | ALL CLEAN | settings/opening/trophies + `--screens home`, 3 viewports, WCAG from pixels |
| `tools/tmp/home_metrics.mjs` | **0** below AA | home staging, contrast and type. `--screens` n/a — home only |
| `tools/tmp/limbcheck.mjs` | see below | per-joint delivered pixels ⚠️ **at 22°, not the match's 58°** |

**Colour and value are baseline-relative, not absolute:**
```bash
node tools/arena-scan.mjs --url $URL --baseline tools/scan/colour-baseline.json   # exit 1 on regression
node tools/tmp/valuescan.mjs --mode gate --out shots/vl                           # exit 1 on regression
```

### Instruments added later in the session

`headserve.mjs` (**serves `git archive HEAD` and runs a command as its CHILD** — the right way to
measure while peers are mid-edit; `--overlay <path>` for just your files) · `snap_hold.mjs` (holds
**one** snapshot across an edit, so before and after land on the same frozen tree) ·
`valuescan.mjs` + `valuelib.mjs` (value ladder + hero/ground separation, calibrated against 27
reference plates) · `limbcheck_pitch.mjs` (`limbcheck` with one changed line, so any delta **is**
pitch) · `postablate.mjs` (walks the post chain one knob at a time on a frozen frame, `--pair` for
A/B) · `gradechroma.mjs` (prices a grade change against `arena-scan`'s own budget) ·
`vfx_{coverage,ablate,layers,hue}.mjs` (**`ablate` separates *occluded* from *too small* in one
run** — the distinction that stops you enlarging an invisible effect) · `faceframe.mjs` (solves
card framing with **no renderer at all**; 33/33 agreement with the live tool) · `occluder.mjs` /
`detach.mjs` (ablate one mesh out of the **shipped** render — isolation cannot do this, because
`visible` is inherited) · `facemove.mjs` (hashes every mesh's world matrix, so a "pure reparent"
is provable) · `status_{census,grace_sweep,ab_report}.mjs` · `rules_census.mjs` +
`rules_sweep.mjs` (sweeps a constant on a **staged copy** of `rules.ts`) · `arena_probe.mjs`
(parses the layout straight out of `kitchen.ts` in ~20ms, `--verify` against the browser dump) ·
`policy_{trace,sensitivity}.mjs` · `screen_metrics.mjs` · `chars_metrics.mjs`

### ⚠️ Known instrument limits — read before trusting a number

- **`weakBoundaryPct` IS A CLIFF, NOT A BAND, and it is built on the WRONG QUANTITY.** Two separate
  faults in one gate key, both measured, neither previously recorded:
  - **The cliff.** It is a contact-weighted *count* over a hard 0.10 threshold, so its step size is
    the **contact share of whichever pair sits near the threshold**, not the size of any value
    change. Measured on real commits: pizza's `head|torso` moved **0.1095 → 0.0953** — 0.0142 of
    luma, 3.6× the 8-bit floor and invisible — and `weakBoundaryPct` moved **8.0 → 41.0**. The
    per-character cliff is that character's dominant weak pair: pizza **32.7 pp**, waterbottle
    **36.7**, burrito **23.5**, sushi **16.0**. **Never report a smaller move as a result.**
  - **The wrong quantity.** It gates on `dL = |p50(A) − p50(B)|`, the parts' **whole-part medians**,
    while the contacts it weights by are counted **at the boundary**. Those coincide only when both
    parts are uniform. `valuescan --selftest` §L proves `dL` wrong in both directions by
    construction, and on live HEAD the two disagree about the 0.10 verdict on **30 of 90 pairs**
    (`p5_dlprobe --live`), with per-character flip counts of 0 (waterbottle) to 5 (hotdog).
    **Steer on the per-pair `dLcontact`** (floor **0.0039**, the 8-bit quantisation of `value.png`),
    not on either aggregate. ⚠️ And the **15% cap was calibrated on the `dL` distribution** — it does
    **not** transfer to `weakBoundaryPctContact`, which is printed alongside for comparison only.
  - **And it is the wrong statistic for EVERY pair, not merely some.** Measured on HEAD: the
    narrowest adjacency pair on the entire cast has a p10–p90 spread of **0.119** (sushi
    `hipL|kneeL`); **not one part of any character is near-uniform**, which is exactly the condition
    under which a whole-part median stands in for a boundary. The gate's CONSTRUCTION CHECK
    therefore reports **n=0 / UNTESTED** on live data by design, and the agreement between the two
    is proved synthetically instead, in `--selftest` §L3 where uniformity is true by construction.
    ⚠️ That check was nearly shipped at **spread < 0.15 → agree within 0.02**, which is internally
    inconsistent — a 0.15 spread *permits* a 0.15 contact difference — and it "failed" at 0.1190 on
    hamburger `kneeL|footL` (spreads 0.141/0.136). **The test was wrong, not the metric.**
- **`limbcheck` measures the preview's 22°; the match camera is 58°.** At 58°, idle passes go
  **8/11 → 0/11**. Idle *ranking* survives (ρ 0.927); **run ranking does not** (ρ 0.673). And the
  shipped spawn faces every character at **profile to camera**, burying 5.3 of ~15 joints against
  0.8 in the pose `limbcheck` uses — its pose is the **best** case.
- ⚠️ **The "93.3% identical" clone-census figure for `limbcheck_pitch` OVERSTATES the divergence.**
  The old wording, kept because it is what several packets quote: *"`limbcheck.mjs` and
  `limbcheck_pitch.mjs` are 93.3% identical, while the latter's header claims byte-identity — every
  22°-vs-58° comparison rests on that claim."* **Measured by diffing the two files:** 25 differing
  lines, of which the only **executable** ones are (a) `const PITCH = Number(get('--pitch', 22))`,
  (b) one extra `console.log` banner, (c) `&pitch=${PITCH}` on the preview URL. Everything else that
  differs is comment prose, and the census's ratio is a *line* count over a file that is mostly
  comment. `src/preview.ts:185` defaults the character piece to `pitchDeg: 22`, so `limbcheck` **is**
  `limbcheck_pitch --pitch 22`, and the header's claim — explicitly scoped to "the chroma key, the
  hide-vs-isolate diff, the connected-component detachment test, the pass rule" — is **true**.
  The **real** limitation is the row above: 22° is not the match camera. That one stands.
- **`menu_accept` is only partly snapshot-isolated** — its CSS lint parses the **live** tree, so a
  peer mid-save fails your run on a file you never opened.
- **`<id>.canvas.png` has never been HUD-free** — Playwright element screenshots capture the
  composited page. 13.4% of frame, ~25% of its warm chroma.
- **`--sim-speed 0.02` freezes the sim, not the shaders** — fog stations drift ±0.004 run to run.
- **Resolution floors, measured:** win rate is unresolvable below **~9 pp** (a ±25wu spawn nudge
  swings it 50.0→59.1%); pacing below **~0.8 s** of contact or **~4 pp** of dead time (±15wu of
  cover jitter moves them that much). Do not claim a result inside those bands.
- **THREE contrast batteries share one WCAG split, and one of them was a commit behind.**
  `screen_metrics`, `chars_metrics` and `home_metrics` all measure ink "against the pixels actually
  behind it" — but a **stroked** glyph does not sit on the backdrop, it sits on its own stroke
  (`.fa-title`, `.chars-card-name`, `.fa-rarity`, all with `paint-order: stroke fill`). The first
  two gained that branch in `4ca1862`; `home_metrics` did not, and for one commit it scored the
  Normal rarity badge **2.53 while `screen_metrics` scored the same badge on the same snapshot at
  16.53**. 2.53 is exactly `contrast(#FFF3DE, #9B9B9B)` — the stroke ignored. Fixed, but the shape
  is the lesson: **when two batteries disagree about one element, suspect the MODEL before the
  pixels, and go and look at the pixels either way.** `tools/tmp/rarity_aa.mjs` prints both models
  side by side for exactly this reason.

---

## QA hooks in the app

| hook | gives |
|---|---|
| `window.__vfxDebugFighters` | per-tick positions, HP, alive, `terrainSlowFactor` |
| `window.__vfxQaCounts` | effect spawn counts by kind |
| `window.__vfxSpawnTest(kind,x,y,amount,color,who,weaponKey)` | spawn a **specific** weapon's bespoke effect — both impact and cast paths |
| `window.__audio` | `.engine`, `.tap()`, `.connectTap(node)`, `.stats()` |
| `window.__fairView()` | the camera's guaranteed ground window |
| `window.__stage` | ⚠️ single slot, overwritten by the last `Stage` built; on menus that is a throwaway that disposes |
| `window.__shell`, `__screen`, `__previewReady`, `__gameReady` | navigation and readiness |

---

## Capture gotchas

- **Effects are sub-300ms** and headless readback is slow enough to miss them. Freeze the
  clock or extend lifetimes to prove a pipeline renders *before* judging it.
- At `simSpeed > 1` **one rendered frame can consume 50ms × simSpeed of effect time.**
- **Driving a real hit through gameplay is unreliable** — fighters spawn 1080wu apart,
  weapons reach ≤140wu, and probes have timed out waiting. Use `__vfxSpawnTest`.
- `?px=`/`?py=` do **not** validate against cover — a probe can park the player inside a
  counter and film it half-buried.
- `--enemy` is ignored on the menu route (`characterSelect` picks randomly). Read the real
  matchup off the HUD.
- Stub Vite's HMR client in any probe holding in-page state.
