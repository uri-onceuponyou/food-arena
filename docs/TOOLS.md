# Tools runbook

Almost every tool here was built to answer a question that had already cost real time.
**Prefer reaching for one of these over inventing a new probe.**

```bash
npm run dev        # http://localhost:5173 — SHARED. Fine for a quick look, never for a number,
                   # and NEVER for actually playing (see below).
npx tsc --noEmit
node src/game/sim.test.mjs
node src/game/economy/economy.test.mjs
node tools/tmp/gatecount.mjs           # every documented gate count, doc vs tree, in one table
```

🔴 **Expected counts are deliberately NOT repeated here.** They live in exactly one place — the
[GATE BATTERY](#the-gate-battery--run-all-of-these-before-you-believe-a-change) table below — and
`gatecount` refuses a second copy anywhere in this file or `CLAUDE.md`, **even one that agrees**.

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

🚨 **IT COPIES THE *WORKING* TREE, NOT A COMMIT — so "frozen" is not "clean".** It protects you from
changes *during* your measurement. It does **not** give you a tree without your peers' half-saved
work in it. With five agents editing, two arms of one A/B taken 40 minutes apart landed on **two
different trees** and the second pair was garbage.
→ **For any A/B you will quote a number from, snapshot a DETACHED WORKTREE of a known commit.**
That is also the only way to attribute an error to a specific tree — it is how a peer's
`MultiplyBlending` error was isolated: **0 occurrences on HEAD+own-change in a clean worktree,
207–210 against a snapshot of the live tree.**

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

⚠️ **`--swap` DOES NOT WORK ON AN HTML FILE CARRYING AN INLINE MODULE SCRIPT, and the failure
looks exactly like a broken build.** Vite's html-proxy keys on the **resolved (live)** path while
serving the **snapshot** path, so the two disagree, the page 500s, and `__ready` never fires. Found
by the icon pass on `tools/tmp/icon_legibility.html`. **Workaround: edit the HTML *before* freezing**
rather than swapping it. This is the same family as the other snapshot traps above — a tool that is
90% isolated invites you to trust the 10% that is not (`docs/LESSONS.md` §5).

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
| `tools/arena-scan.mjs` | **The whole-arena scoreboard.** 18 player-centred stations through the live game. Reports `playerRank` in a 16×9 salience grid, player-vs-surround luma/saturation, a hue histogram, channel clipping — **and the cumulative colour budget nobody was watching**: absolute mean saturation / warm chroma / cool chroma measured the same way the reference figures were, split ENVIRONMENT vs CAST by an exact matte, with a hue-collision number. `--list`, `--only`, `--sim-speed 0.02` for byte-comparable runs. See the colour-budget block below. 🚨 `--list` now prints a **still?** column — the three fog stations are **NOT still when sampled** and no pixel-identity claim may be quoted from them without `--still-hud`. |
| `tools/tmp/sc_fogstill.mjs` | **Why the three fog stations move when nothing is touched**, and the reusable fix. `gl_occl_ab` refused at `fog_inside` on a self-pair of **110,963–472,512 px of 1,440,000 with rAF already frozen** against **0 px** at `pot_south`. Measured cause: **100% `src/ui/hud.ts` CSS keyframes** (`hud-fogedge-breathe`, `hud-zone-alarm` ×2, `hud-safearrow-throb`) — **CSS runs on the document timeline, not on `requestAnimationFrame`**, and `locator('canvas').screenshot()` is a page capture clipped to the canvas box, so they land in every "canvas" PNG. *Freezing the loop is not freezing the page.* Three arms per station (rAF frozen / + CSS stilled / HUD hidden) with two known-still control stations; exports **`PAGE_STILL_HUD`** — three lines that take all three stations to **0 px**. Any probe here that stubs rAF and diffs two captures needs it. |
| `tools/aspect.mjs` | Viewport fairness. Must PASS at **0.00wu spread** across 4:3 → 32:9 → portrait. |
| `tools/perf.mjs` | `--mode counts\|ablate\|alloc\|boot\|leak`. `--json` baselines, `--baseline` regression gate. **Hardware-independent numbers only** — it refuses to print timings as performance without `--unsafe-timing`. |
| `tools/audio-probe.mjs` | `--mode all\|depth\|identity\|live`. **Assertions from real rendered samples** via `OfflineAudioContext` on the production path. ⚠️ **`OfflineAudioContext` has no media element, so NO offline assertion can ever see the theme track** — that is how a 404 on the deployed build survived every one of them (`docs/LESSONS.md` §3b). |
| `tools/match-sim.mjs` | Real `sim.ts` in Node. `--all-matchups`, `--policy idle\|smart`, `--pathmap`, `--fog`, `--ranges`, `--occlusion`. A 180s match costs ~4ms. |
| `tools/match-play.mjs` | Drives the real game boot → menus → combat → result, sampling the HUD's own DOM. |
| `tools/tmp/journey.mjs` | **The only end-to-end gate.** `match-play` × N round trips in ONE page session, so it can see what LEAKS between a match and the menus — GL contexts, errors, profile state. Every gate above it is a unit gate, and HEAD was unbootable for 24 commits with all of them green. `--trips`, `--viewport portrait`, `--mode timeout\|idle`. |
| `tools/filmstrip.mjs` | Animation as a contact sheet. Auto-detects cycle length; labels one-shots "NOT A LOOP". |
| `tools/motion_probe.mjs` | Joint traces in the character's local frame — camera, framing and post chain out of the equation. |
| `tools/tmp/menu_accept.mjs` | **The biggest single gate** — 5 viewports × 5 screens × notch/no-notch. Also **parses all 88 modules in ~95ms** to catch the backtick trap. `PREVIEW_BASE=<url>` to point it at a snapshot. |

#### `arena-scan` colour budget — the guard rail on cumulative desaturation

```bash
node tools/arena-scan.mjs --url $URL --baseline tools/scan/colour-baseline.json  # exit 1 on a colour regression
node tools/arena-scan.mjs --url $URL --gate         # also exit 1 on an absolute rail FAIL
node tools/arena-scan.mjs --url $URL --json tools/scan/colour-baseline.json      # RE-baseline (deliberate only)
node tools/arena-scan.mjs --ref-plates reference/images/curated/gameplay         # re-derive the reference figures
node tools/arena-scan.mjs --selftest               # synthetic frames, no browser — count in the gate table
node tools/arena-scan.mjs --no-role                # skip the cast matte / HUD-free capture
node tools/arena-scan.mjs --still-hud              # pause the HUD's CSS keyframes before capture
```

🚨 **RE-BASELINE THROUGH `headserve --ref <sha>`, NEVER BARE.** `--json` now records the commit it
measured, and `--baseline` reads it back and prints how far HEAD has moved since — but the only
authoritative answer comes from whatever served the URL. Run bare, the tool marks the sha
`trust=assumed` and says out loud that it is a guess. The previous baseline carried a *hand-written*
sha that nothing wrote and nothing read, which is exactly how it went stale unnoticed:

```bash
node tools/tmp/headserve.mjs --ref <sha> -- node tools/arena-scan.mjs --json tools/scan/colour-baseline.json
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
- 🚨 **AND IT DOES NOT FREEZE THE PAGE.** The three fog stations are **not still when sampled**:
  two captures with nothing touched differ by **10.5k / 478k / 14.2k px of 1,440,000** (two runs), and
  **100% of it is `src/ui/hud.ts` CSS keyframes**, which run on the document timeline and ignore a
  stubbed `requestAnimationFrame`. `--list` flags them; `--still-hud` takes all three to **0 px**.
  The colour numbers are unaffected (≤0.0001, ~100× under tolerance) — **pixel-identity claims are
  not.** See `tools/tmp/sc_fogstill.mjs`.
- 🔴 **`playerRankMedian` HAS A MEASURED RESOLUTION FLOOR OF ±1.5 PLACES — do not act inside it.**
  Four full sweeps of ONE pinned tree gave **29.5 / 29.5 / 31 / 30**. Seventeen of eighteen stations
  were rank-**identical** in all four; the whole spread is `fog_inside` alone (**27 / 26 / 37 / 30**),
  re-ranking with the phase of the HUD's screen-edge wash. The gate fires at **+4**, i.e. ~2.7× the
  floor — real, but nothing like the ~100× the chroma rails enjoy. `--still-hud` collapses it to
  zero. ⚠️ The header used to claim `playerRank` was "identical everywhere"; that is **falsified**.
- ⚠️ **A BASELINE IS ITSELF A MEASUREMENT.** The stored one manufactured a `player salience rank
  19.5 → 31 REGRESSION` for six days, on **both arms of a HEAD-to-HEAD drift control**, purely by
  being 238 commits old. Re-measuring `3dcbc9a` today reproduced its stored numbers to ≤0.0002 —
  it was never wrong, only **stale**. `--baseline` now prints the reference's commit and how many
  `src/` commits have landed since, and says whether a REGRESSION is attributable to your tree.

**Where the arena stands as of this baseline (2026-08-11 @ `36ee0a6`):** meanSat **0.4706** vs
reference 0.493 (PASS — was 0.324 at the previous baseline); mean chroma **0.3253** against a 0.325
target, arrived; cool **0.4078**, warm *share* **0.1258**, both PASS. **Warm chroma 0.0596 is the
one rail still FAILing** — 41% of the reference, below the 0.0725 floor. **Warm is the scarce
budget; adding cool is no longer a free lever** (cool is already 19% over target). 12.0% of
environment chroma sits inside the hero's ±30° hue band and 30% of the loudest non-player cells
wear the cast's own hue. **Baked in and now invisible: `playerRankMedian` 19.5 → 30**, a ten-place
salience loss accumulated over 104 `src/` commits and attributable to no single pass — see
`colour-baseline.json`'s `bakedInRegressions`.

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
site is on. Its old summary here read *"15 files are enforced and 27 still wait on a flag (was 7
and 34)"* — kept because packets quote it, but **it describes an output format the tool no longer
prints.** Since the per-role split it reports an OWNED SET against per-role obligations, plus the
css-immune claims and anything exposed elsewhere; the live numbers are in the gate table below and
nowhere else.

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

The five gates in `CLAUDE.md` were the whole story when there were five. There are now **102**, and
every one exists because something shipped past its absence.

### 🔴 This table is the SINGLE SOURCE for every expected count

Six documented counts went stale in one session — `valuescan` 57 vs 78, `arena-scan` 78 vs 105,
`driver_guard` 49 vs 60, `economy` 220 vs 227, `audio-probe` 389 vs 427 and 77 vs 78 — and **every
one was found by an agent tripping over it, never by a check.** Twice the same file disagreed with
itself: this file carried `economy 173` in its quick-start and `220` in this table, and
`driver_guard` had two rows here with different numbers. **Either copy could be "confirmed" by
reading the other.**

The root cause was never the individual numbers. It was that they lived in **three** places
(`CLAUDE.md`'s gate block, this file's quick-start, this table). They now live **here only**, and

```bash
node tools/tmp/gatecount.mjs              # parse the table, run every offline gate, diff. exit 1 on any fault
node tools/tmp/gatecount.mjs --docs-only  # the docs half alone, ~50ms, runs nothing
node tools/tmp/gatecount.mjs --list       # what it runs, what it skips, and why
```

- **A second copy is a fault even when it agrees.** Both same-file disagreements on record began
  life agreeing. `gatecount` scans this file and `CLAUDE.md` for any count-bearing mention of a
  gate outside its canonical row here and refuses it — before it runs anything.
- **The `expect` column is machine-read.** Every integer in a cell is part of the contract, **in
  order**: `gatecount` runs the gate and compares the vector elementwise. A row that gains a number
  the registry does not measure fails on ARITY instead of going quietly unchecked.
- **Every row must be registered**, either OFFLINE (run and diffed here) or SKIP with a reason
  (browser / non-numeric). A row in neither fails, so a new gate cannot arrive unchecked. Skipped
  rows are still **printed** — an invisible gap is the bug this whole section exists for.
- **A gate whose output format changes fails LOUDLY** as UNPARSEABLE. That is the `driver_guard`
  coverage-shrank shape (`docs/LESSONS.md` §13): a check that quietly stops checking.
- ⚠️ `gatecount` runs **no browser gate** — peers measure on the GPU in this tree and load
  contention corrupts *their* numbers. It is not a substitute for the browser half of the battery.

`screen_metrics` and `home_metrics` are "ALL CLEAN / 0 below AA" batteries rather than assertion
counts and sit with `chars_metrics`:

| gate | expect | covers |
|---|---|---|
| `npx tsc --noEmit` | clean | ⚠️ the **working tree**, incl. peers' half-saved files |
| `node tools/verify-head.mjs` | OK | **the COMMITTED tree** — the only one that matters before a push |
| `node src/game/sim.test.mjs` | **388** | sim, combat, AI, navigation, status, concealment rules. ⚠️ Was 253 before §29c — attacking breaks the cover and reveals you (§26(j)–(m)) — **287 before §27**, the N-fighter container (slot-array invariants, the perception matrix's index and identity, `damagedMask` per-victim, the event protocol's slot ids, and the timeout tiebreak **rung by rung against the two-way rule it replaced** — rung 3 is reached by no corpus, 0 of 3520 forced-immortal timeouts) — and **323 before §28**, which raises the cap: the `opponentOf` split checked against `opponentOf` itself as the N=2 oracle, `createMatch`'s compat overload against the fighter list field-for-field, broadcast vs per-slot input proven to DIVERGE at two human seats, the no-living-opponent branch proven unreachable while `playing`, and a six-seat knockout proven NOT to end the match. ⚠️ **Was 364 before `DECISIONS §49a`/`§49c`** — the timeout tiebreak gains "fewest deaths" as rung 3 (the old slot rung becomes rung 4; §27(c)'s longhand formula gains a rung and is asserted to COLLAPSE to the old two-rung one when the counts are equal, which is what keeps the duel bit-identical) and `createMatchFromList` flattens the seat dial above two fighters, so `ENEMY_MAX_HP` is a **bot-opponent** constant and §28(b)'s two "every slot above 0 gets the ENEMY dial" rows are reversed with their old wording kept above them. ⚠️ Both changes are INVISIBLE to any corpus — the deaths rung is inert while no respawn exists and nothing in `src/` seats three fighters — so their known-bad battery is `node tools/tmp/s49_mutants.mjs` (7 mutant sims, all caught), which is **not in `gatecount`'s registry and so is not run by it** |
| `node src/game/economy/economy.test.mjs` | **227** | economy, seeded and deterministic. ⚠️ Was 220 before `33a0048` added the rarity-sentence derivation |
| `node tools/aspect.mjs` | PASS, **0.00wu** | viewport fairness — point at a **snapshot** |
| `tools/tmp/menu_accept.mjs` | **361** | 5 landscape viewports × screens, + the CSS-backtick parse |
| `tools/tmp/menu_accept_portrait.mjs` | **219** | portrait + the nested-`@media` lint. **Opt-in, not folded in** |
| `tools/tmp/input_accept.mjs` | **81** | real CDP keys/mouse asserted against **sim state**, both routes |
| `tools/tmp/shop_accept.mjs` | **170** | every displayed price/odd re-derived in Node. ⚠️ Was 168 before `33a0048` added the rarity-sentence derivation. **`gatecount` cannot check this row — it is browser-bound and skipped**, which is why it went stale unnoticed |
| `tools/tmp/name_accept.mjs` | **29** | name sanitiser, both entry paths |
| `tools/tmp/chip_probe.mjs` | **72** | pause chip vs thumb zone, 6 viewports × 2 states |
| `node tools/audio-probe.mjs --mode all` | **427** | ⚠️ `--mode live`'s countdown-onset checks are **pre-existing load flake, PROVEN not assumed** — untouched HEAD on a clean isolated server gave **29/29, 27/29, 26/29 on three consecutive runs**. Do not attribute them to your change without that control. Judge by **depth 91 / identity 78**. |
| `node tools/arena-scan.mjs --selftest` | **132** | colour-budget metric + the station-placement guard + **§D2 baseline PROVENANCE** and **§D3 the non-still stations**. ⚠️ Was **105** before the 2026-08-11 re-baseline; a run reporting 105 is an OLD TREE. §D2's known-bads are the four ways a stored baseline lies about which tree it came from — no `HEADSERVE_SHA` (the sha is a *guess*), `--overlay` (the tree is the commit **plus** someone's uncommitted file), `--worktree` (not a commit at all), and a recorded sha that is not in the repo — plus the staleness count that would have named the six-day-old reference on sight. §D3 asserts the three fog stations stay flagged **from the fog geometry**, not from a hand-kept list |
| `node tools/match-sim.mjs --selftest` | **15** | the scripted policies, against a hand-derivable answer |
| `node tools/tmp/valuescan.mjs --selftest` | **105** | value-ladder metric on synthetic frames. ⚠️ Was **57** until `c3e3fbc`/`fc3d048` and **78** until the `dLcontact` pass; a run reporting 57 or 78 is an OLD TREE, not a pass. §L and §M are the two known-bad-input proofs — §L shows `dL` returning a confident **wrong** answer in both directions, §M shows a `__meta` stamp lifted off another file being **refused** |
| `node tools/tmp/p5_dlprobe.mjs` | **12** | the derivation behind §L. `--live <dir>` recomputes `dLcontact` for all 11 characters from an existing `--mode chars` output **with no browser**, and refuses any character whose recovered owner map does not reproduce the recorded contact counts exactly |
| `node tools/tmp/quality_api.mjs` | **20** | render tiers. ⚠️ Was one row with `dpr_probe` and two numbers; split so each has its own row |
| `node tools/tmp/dpr_probe.mjs` | **24** | the DPR cap |
| `node tools/perf.mjs --mode leak` | contexts flat at **1** | the leak that white-screened after ~8 round trips |
| `node tools/tmp/settle_validate.mjs` | **22** | the shared PAINT condition — correct at any machine speed, not merely longer |
| `node tools/tmp/review_gate_validate.mjs` | **8** | `review.mjs` refusing un-vouched PNGs |
| `node tools/tmp/capture_audit.mjs --selftest` | **25** | the CLASSIFIER itself, on fixtures — including that a validator which does not import the guard it validates is refused. ⚠️ **This row said 13 and shared a row with the bare run**, so two different quantities sat under one gate |
| `node tools/tmp/rarity_aa.mjs` | 0 below AA of **43** | `.fa-rarity` per rarity × home + character select × 3 viewports, **both** contrast models |
| `node tools/shoot.mjs --selftest` | **6** | the capture path itself |
| `node tools/tmp/snapsweep.mjs --selftest` | **5** | age parser for the leaked-snapshot sweeper |
| `node tools/tmp/sentinel.mjs` | **44** + 16 live | ⚠️ **the meta-guard.** MOVES / HOLDS / ORDERS / SELF-PAIR — each kind run against an instrument broken that way and REFUSED there. `VL.adjacency` covered as of the 32/16 counts, on **MUTANTS OF `VL_SRC` ITSELF** (5: dLcontact aliased to dL, dL "fixed" to the band, the bands swapped, a constant offset, luma-gated contacts) — plus its own control that an unmutated rebuild reproduces the real `VL` exactly. ⚠️ **`selfPair` without `identity` proves DETERMINISM ONLY** — `metric(a)` vs `metric(a)` is zero for any pure function, so name the identity answer whenever it is known |
| `node tools/tmp/driver_guard.mjs` | **86** | no 14th copy of the scripted driver; SHARED entries checked from the registry; RANK/HEAL/RANKKEY landed with driver rev 4 (it was 60 at rev 3, and 49 before that). Fails if a **14th** copy appears, or a fixed copy loses its guard. Every check also runs against the historical driver and must FAIL there. ⚠️ **This gate used to occupy TWO rows in this table carrying 49 and 86** — either could be "confirmed" by reading the other, which is the defect `gatecount` now refuses outright |
| `node tools/tmp/capture_audit.mjs` | **43/43 owned** · **15** css-immune | classifies every capture site as paint-waiting or flag-waiting, per ROLE; 0 exposed elsewhere. `css-immune` is claimed by annotation and mechanically refused if the file screenshots. ⚠️ This row said **14** css-immune |
| `node tools/tmp/gatecount.mjs --selftest` | **42** | ⚠️ **the guard on THIS TABLE.** Every documented count vs the tree, plus the collapse itself: a second copy anywhere in `CLAUDE.md` or this file, two rows for one gate, a row in neither registry, a doc number nothing measures, a gate whose output format drifted. Its selftest refuses each on a deliberately-broken fixture — including the real 220-vs-227 and 78-vs-105 defects — and pairs every refusal with a positive control, because a checker that always screams would otherwise "pass" every refusal test in the file |
| `node tools/tmp/kit_lab.mjs --selftest` | **10** | matchup-profile divergence + behavioural fingerprint, calibrated on a literal clone |
| `node tools/tmp/level_lab.mjs --selftest` | **7** | the level ladder and its win-rate curve |
| `node tools/tmp/conceal_lab.mjs --selftest` | **77** | walk-through concealment: bit-identity, the band whose centre is legal and near edge is not, and the "no arena is failing this today" control. **Was undocumented until `gatecount` went looking**. ⚠️ **Was 22 until 2026-08-10**, when `--bitid` stopped being a STATE-ONLY test: it now compares the `GameEvent[]` `stepMatch` returns as well. §E proves that extension does something (a sim whose only difference is `death` before `hit-landed` is passed by the old harness and failed by this one); §G proves the CORPUS can be blind — at `LEVEL_MIN` both `damageMul`s are exactly 1.0, so a sim that resolves the WRONG attacker is invisible until `--levels 15:1`; §F guards `--ablate`'s mask and perturbations. New modes: `--bitid --corpus normal,timeout,countdown`, `--levels p:e`, `--ablate`, and `--nfighter`. ⚠️ **Was 39 until 2026-08-11**, when the cap came off `MAX_FIGHTERS`: §H is the arm with **no baseline to be bit-identical to** — above two fighters no earlier commit can seat the match — so it asserts SELF-consistency at N=3..6 (determinism on both inputs and seed, no NaN, every fighter stepped exactly once per tick, slot order a pure function of `createMatch`'s argument order, and a knockout NOT ending a brawl). Its known-bad is a **reversed fighter loop**, which both halves must catch — the order recorder and the differ — because reversing turn order being invisible would mean slot order was not a game rule. `--nfighter` runs the same rows on the shipped arena over a far larger corpus and is not part of this count |
| `node tools/tmp/cw_conceal_view.mjs` | **19** | ⚠️ browser. A concealed enemy is gone on **all three** surfaces — radar blip, floating HP pill, 3D model (27.4% of its body box against a measured 4.79% drift floor, S/N 5.7×). Its known-bad input is separation 60wu ≤ `CONCEAL_REVEAL_RADIUS`: a wire that hid unconditionally passes the far case and FAILS here |
| `node tools/tmp/cw_verify_knownbad.mjs` | **13** | ⚠️ browser. Proves `arena_probe --verify` was BLIND to a dropped concealment list, as an ablation against a **derived** pre-fix ref so it survives a rebase. Carries a tripwire for the way the blindness got in: **zero boxes is indistinguishable from "no plates"** |
| `node tools/tmp/burger_lab.mjs --selftest` | **16** | where the two drivers' matches diverge for one character — the instrument behind the 50.6 pp Hamburger role split. **Was undocumented** |
| `node tools/tmp/roster_lab.mjs --selftest` | **9** | per-character strength, settled-matchup count and rarity roll-up on the FIXED driver. **Was undocumented.** ~26 s, the slowest offline gate |
| `node tools/tmp/ap_reach.mjs --selftest` | **39** | sealed pockets, **phantom** pockets, face gaps, clearance sweep. 🚨 **It exists because `arena_probe --truth` printed `ONE PIECE / 0.00% sealed` and was never wrong** — it answers a different question. A character is **drawn 19.1–36.1 wu wide** and **collides as `PLAYER_SIZE` = 42 for every one of them**, so any gap wider than the drawn body and narrower than 42 is floor you can see, that reads as standable, and that **nobody** can enter. 14 such regions shipped, in 7 point-symmetric pairs, deepest point 68 wu from anywhere standable. ⚠️ **Sweep the body width, do not pick one**: a fix at 26 wu (from a single pixel measurement) turned the probe green while **six more stayed open, two of them walked past by that same pass** |
| `node tools/tmp/s49_mutants.mjs` | **24** | 7 mutant sims + 10 positive controls for §49a/§49c — **all 7 caught**: the deaths rung deleted, hoisted above rung 2, hoisted above rung 1, reading `id` instead of `deaths`, `deaths++` dropped, §49c reverted, and §49c **over-applied (which would silently reverse AUTHORISED DEVIATION #9)**. ⚠️ It exists because **neither change is visible to any corpus**: `deaths ∈ {0,1}` and `deaths === 1` iff `hp === 0`, which rung 1 has already sorted, so the rung is unreachable in real play until respawns exist. **Mutation is the only evidence available** |
| `node tools/tmp/da_census.mjs --selftest` | **19** | the blast-radius census — 70 properties × every element × 5 screens. ⚠️ **`--owned` is now REQUIRED and validated against the screens actually captured**: it used to default to one pass's screens, so it did not report a wrong *number*, it **attached the wrong claim to a right one** — which is worse, because the number survives review and the label gets quoted. 🚨 Its nastiest arm is a **bare `--owned`**: that yields boolean `true`, `String(true).split(',')` is `['true']`, so nothing is owned and every real diff is filed as foreign — **a flag that reads as a declaration and means its opposite** |
| `node tools/tmp/nc_measure.mjs --selftest` | **18** | the netcode cost model, measured on this tree: serialised input and snapshot sizes at N=2/6, per-tick CPU, rollback depth per frame budget. 🚨 Its headline is that **`stepAI` is 93.5% of the tick at N=2 and 99.2% at N=6 — the sim is 150× cheaper without AI** (2.66 µs vs 399.50 µs), because `navBuildField` visits **22,736 BFS cells per tick at N=6 all-AI and ZERO on a human-only tick**. ⚠️ It also found that **`MatchState` does not survive a JSON round trip**: three alias invariants break **silently** (`player` stops being `fighters[0]`), seven `-Infinity` sentinels flatten to `null`, and `brokenConcealment`'s arena references vanish. `structuredClone` keeps all of it |
| `node tools/tmp/r2_probe.mjs --selftest` | **19** | the shoulder-bridge build, its three refusal branches, and `massAnchor`'s fallback bookkeeping |
| `node tools/tmp/r2_probe.mjs --mode anchor` | **0** known / 0 new / 0 stale | an **allowlist**, not a count, and it is now EMPTY — the cast is at zero bounding-box anchors, so **anything new fails, and a stale entry also fails**. ⚠️ **Was 2 known until 2026-08-11**, when `donut.ts` moved its two hole-axis icing drips from 0.90π/−0.86π to **±0.62π**, an azimuth where the ring exists (swept at construction time, 41 azimuths × 7 heights, and there are **two** failure bands: at \|az\| ≤ 0.20π or ≥ 0.80π the ray MISSES the torus and falls back to the box, while at 0.20–0.25π and 0.70–0.80π it HITS tangentially and the anchor collapses toward the axis — 0.75π returns reach 0.196 against a working drip's 0.56. Different mechanism, same visible defect). The stale-entry half of this gate is what made the fix land completely: it FAILED until the two entries were deleted. ⚠️ It exists because the obvious fix made things WORSE: a height search "succeeded by its contract" while landing both drips on the hole's **inner lip** (0.007 m and 0.033 m from the ring's axis), rendering as a pink shard in a dark socket, **6,615 px at p20**. A torus has **no surface on its own hole axis at any height** — so the tool refuses loudly instead of guessing |
| `node tools/tmp/ey_pacman.mjs --selftest` | **9** | pupil **solidity** at the lobby camera — the instrument that proved the Pac-Man pupil had **never** been fixed, **including on `egg.ts`, the file the other ten were measured against**. ⚠️ **Its own known-bad fired**: at `--dark 0.22` it reported a *fixed* eye as a regression, because a lit pupil's key-lit quadrant renders at 0.30–0.45 and 0.22 keeps only its shaded lobe. Default 0.55; 0.55 and 0.65 agree to 4 dp. ⚠️ Arm 7b asserts **pixel count, not solidity** — **a half-disc is convex and scores well**, which is exactly why the defect was invisible to a solidity-only test |
| `node tools/tmp/cf_taper.mjs --selftest` | **5** | joint-step continuity across a limb chain. Caught `sushi.ts`'s `taperedLimb` **silently discarding the `rBot` it was handed** — `capBot = min(rBot, len*capBotFrac)` was used as **both** the cap's height and its radius, so a `capBotFrac` of 0.10 turned the upper arm and thigh into **81%/82% tapers**. Elbow step **4.61× → 1.00×**, knee **4.73× → 1.00×**, with `forearm`/`shin` byte-identical (0 points moved). ⚠️ **`soup.ts` had found and fixed this exact bug one file over and it never crossed** |
| `node tools/tmp/hm_audit.mjs --selftest` | **12** | **EFFECTIVE REACH** — the largest separation at which one press still delivers against a *moving* target. `range` is two things wearing one number: `pickWeapon` gates on it (what a fighter BELIEVES) while `stepProjectiles` retires on it (the path budget it GETS), and they coincide only against a stationary target — which all 183 validated `press_value` cells are. Closed form `range − S·flight + hitRadius` predicts 58.2 where the sim measures 58. 🚨 **The range CANCELS: the penalty is `S × flight`, so a rung of `FLIGHT_MS` is a REACH TAX** — `drift` costs 210 wu against a fleeing human, more than `REACH.rangedMax` itself |
| `node tools/tmp/hw_ord.mjs --selftest` | ⚠️ browser, **5** | which `renderOrder` a transparent ground-stack material should take. ⚠️ **Pixels could not make this call**: 3 vs 8 is **0 px** at `pot_south` and separates only at 599 px with `--vfx`. The answer came from `fogRing.ts` — curtain **7**, canopy **8** — so a wisp at 8 **leaks the central hazard through the fog of war.** Shipped 3, costing 1.9% of the fix. ⚠️ **It ignores `--selftest` and runs the real probe** — the string does not appear in the file. Registered OFFLINE by mistake, which made `gatecount` boot a GPU probe every run |
| `node tools/tmp/hw_burner.mjs --selftest` | ⚠️ browser, **5** | the pot burner's 0-px ablation **with a positive control** — 0 px shipped vs **1,126/2,296 px with `pot_solid` hidden**. Establishes the cause as **containment, not foreshortening** (both cones are narrower than `pot_body` at every shared height). Without the control, "it delivers no pixels" is indistinguishable from a blind capture. ⚠️ **Also ignores `--selftest`** — browser, not offline |
| `node tools/tmp/dup_census.mjs --selftest` | **26** | normalised-function-BODY duplication across `src/`, which `sentinel`'s whole-file clone census structurally cannot see (it scans `tools/**.mjs`, 300-line minimum, 0.90 floor — the six files carrying a byte-identical `taperedSegment` peak at **0.0478** whole-file similarity). **Registration buys a SEAT, never a budget** — the `995417e` inversion refused by construction. ⚠️ Its floors sit in **measured gaps** and both shadows print every run: a first draft at `MIN_TOKENS = 60` hid an **eleven-copy** helper **by two tokens** |
| `node tools/tmp/rg_neckz.mjs --selftest` | **10** | whether a character's face can ever occlude the rig's neck column, by exact triangle clipping. **9 of 11 characters are exposed at pitch 20 against 4 at pitch 58, and the ordering is NOT preserved** — the reason the old neck table had its sign backwards. ⚠️ Its first implementation was a vertex scan and **failed its own known-bad**; that method is kept as a required failure |
| `node tools/tmp/rg_taper.mjs --selftest` | **8** | proves the shared `taperedSegment` is equivalent to BOTH divergent dialects it replaces — **832 comparisons, worst \|Δ\| exactly 0**. Known-bads require failure. This is what made the six-copy consolidation a refactor rather than a rewrite |
| `node tools/tmp/rg_gap.mjs --selftest` | **13** | `fitPelvis()` — 16 rays × 9 heights, deforming ring-by-ring and **re-centring as well as shrinking** (one cross-section is not enough; a mass curves back at its lowest pole). ⚠️ **It REFUSES when fewer than half the rays find a body**, which is the pelvis's whole reason to exist — no shipped character reaches that branch, so it is proved against a deliberately torso-less rig |
| `node tools/tmp/rg_solid.mjs --selftest` | **7** | ⚠️ **VALID AT PITCH 58 ONLY.** It frames the model's own bbox; `charStage` does not. At pitch 20 it reported burrito's neck column at 0.665 where the shipped capture measures **0 px**, and egg's pelvis at 0.941 where the capture measures **0** — **wrong by up to 35×, ranking not preserved.** Caught only by reading the PNG |
| `node tools/tmp/bw_brow.mjs --selftest` | ⚠️ browser, **6** | column-wise brow-to-eye gap and eye-region ink share, ablated through the shipped render path at either camera. ⚠️ **Never quote it for pupils — that is `ey_pacman`.** 🚨 **Its first version classified a LIT frame by dominant channel and reported `lid = 101,125 px` on a character with NO LID MESH** (a pale-blue bottle is `G && B && !R`) — and it **survived its own hidden-brow known-bad on 8 px of stray magenta.** The scene is blacked out first now, and two of its six arms exist only because of that |
| `node tools/tmp/si_gap.mjs --selftest` | ⚠️ browser, **8** | measures a shadowed CSS declaration on the **live element**. It is what let `characterSelect.ts`'s `gap: 1px` be **deleted rather than re-ordered**: Δh **0.00** at three viewports, because the declaration was authored for a `column` and ≤460 is a strict subset of ≤560 where the element is always a `nowrap` **row**. It bought 0.00 px of the vertical budget it was written for |
| `node tools/tmp/si_fit.mjs --selftest` | ⚠️ browser, **7** | what a larger icon costs its host — line box, `scrollWidth − clientWidth`, tap target. Used to prove **nothing came out of any text** when five icon sites grew: 0 clipped before, 0 after, at three viewports |
| `node tools/tmp/si_pair.mjs --selftest` | ⚠️ browser, **9** | a paired plate that can vary **SIZE** per arm. ⚠️ Exists because **`ic_pair` structurally cannot ask a size question** — its page keys box and plate off `SPEC.icons[name]`, so both arms of a subject share one size. It also **states when its own floor is unusable**: if the illegible twin splits 0 of 3 it was misread *consistently*, and only \|Δ\|≥2 resolves |
| `node tools/tmp/ft_faces.mjs --selftest` | ⚠️ browser, **21** | text-overflow census + font rulers, 5 screens × 4 viewports. ⚠️ **It failed on itself first**: `/rel="preload"/` matched `preview.html`'s *comment* saying it deliberately has none. Comments are stripped before any check now |
| `node tools/tmp/ft_glyphs.mjs --selftest --url <snapshot>` | ⚠️ browser, **5** | **which codepoints a loaded face actually DRAWS** — the question a network waterfall cannot ask. It found `heebo-symbols` and `heebo-math` drawing **0 of 44** candidates (←, →, ⚙, ✓, ▲, ⭐, 🏆 all fall through to the platform font): Chromium fetches them because the `unicode-range` **declaration** matches, then discards them. **38,016 bytes and two requests for nothing.** ⚠️ Its reference must be another face in the **SAME family** — cross-family is invalid for the negative direction, because Rubik draws its own `.notdef` |
| `node tools/tmp/ft_basepath.mjs --dist <dist> --base /food-arena/` | ⚠️ browser, **5/5** | `@font-face url()` at a non-root base. ⚠️ Exists because **`ab_basepath` structurally cannot see it** — that tool's literal audit reads `.js/.mjs/.css` and the `@font-face` is inline in HTML. Its known-bad strips the base from every font path and requires 404/404 **and** the ruler collapsing onto the fallback |
| `node tools/tmp/pj_probe.mjs --selftest` | ⚠️ browser, **7** | projectile legibility by **same-frame ablation**; its known-bad is a sculpt painted the background's own measured colour, which it must call invisible. 🚨 **It falsified the obvious diagnosis**: the tomato was not a hue collision but an AREA one — its bespoke sculpt delivered **36 px against the generic path's 686**, one nineteenth of the area, at a perfectly respectable **18.8° of hue**. **A hue rotation cannot fix an object that is not there**, which is why the file's four colour rules could never have caught it |
| `node tools/tmp/h49_ab.mjs --ref <sha>` | ⚠️ browser, **9 identical fields × 2 pairs** | the §49f 2-fighter identity battery. ⚠️ It overlays **only `hud.ts`**, not `np_ab`'s five files, because a peer was mid-edit in `src/game/**` and a wider overlay would have invited their saves in. ⚠️ **`--swap` is NOT its positive control** — that moves under a pristine tree too; the deliberate break is `h49_chips` passing on the overlay and **failing on pristine** |
| `node tools/tmp/h49_chips.mjs` | ⚠️ browser, **293** (+**156** `--touch`) | the chip rail above two seats. 🚨 **The `--touch` state is the one that caught a real defect**: on `html.fa-touch-capable` the radar moves to the **top-right — the corner the rail grows from** — and the rail overlapped it at all three portrait widths **and at none of them in the plain DOM state**. Its `top` was a constant derived from an assumed one-row bar; it is now derived from a published `--fa-topbar-b`. ⚠️ It **prints** the bar height (102 px at two seats, 151 px at six on a phone) rather than asserting it, precisely so no budget gets invented here and then quoted |
| `node tools/tmp/np_ab.mjs` | ⚠️ browser, **9 identical fields × 2 pairs** | the N=2 presentation identity battery — four arms served by `headserve` (pristine HEAD / the same again / HEAD + the five files / that overlay with two slots permuted), comparing png@58, png@20, HUD DOM, scene graph, nameplates, HP, selectors, rng draws, feel census. The known-bad moves **8 of 9** — `selectors` correctly stays SAME, because a roster swap must not add a selector. ⚠️ Its **per-file** tree control fired once and discarded a whole run when a tidy-up landed mid-battery |
| `node tools/tmp/np_nfighter.mjs` | ⚠️ browser, **62** | N=3..6 presentation self-consistency on the shipped kitchen: one nameplate/pill/blip per slot with names matched **in order**, per-slot HP text, 6 distinct blip positions, N status telegraphs, six distinct trail materials through the shipped accessor. Known-bad = slots 1↔2 swapped. `shots/np/nf6.png` is a real six-fighter frame |
| `node tools/tmp/ab_basepath.mjs --selftest` | ⚠️ browser, **4/4** | the shipped bundle at a **THIRD base**. One frozen tree, three builds, and a host that genuinely 404s outside its base; **three independent senses per cell** — literal audit / route+asset crawl / live page — because a 200 whose body is `index.html` is a *masked* 404 the crawl alone cannot see. `PAGES` is the live Pages deploy, `WRAPPER` is `./` under `/app/v1/wrap/`, and **both known-bad rows must FAIL**: a `/` build at a third base, and `music.ts`'s historical `/audio/…` literal re-injected verbatim (which fails on two senses at once, while the crawl sees neither). ⚠️ `--unlock` measures the audio gesture — and its header records that **`page.evaluate()` GRANTS USER ACTIVATION**, which once made its own no-tap control report sound with no tap |
| `node tools/perf.mjs --mode navselftest` | ⚠️ browser, **8** | the proof that `perf.mjs`'s reload guard FIRES. Runs a control arm **and** a real `page.reload()` arm in one invocation. ⚠️ **The control asserts that same-document router navs DID happen**, so it cannot pass vacuously — which is exactly how the old guard failed: it counted `framenavigated` and the app's own `history.pushState` made it a **100% false positive** (raw 2 navs vs 1 real load on `counts`; 8 vs 1 on `leak`) |
| `node tools/tmp/perf_tier.mjs --mode navselftest` | ⚠️ browser, **8** | **the same proof for the CLONE.** A fix proved in one copy is exactly what this file was caught not having: `9e1061c` fixed `perf.mjs`'s reload false-positive and the clone kept it for hours while `sentinel` reported PASS |
| `node tools/tmp/ir_outclaim.mjs --selftest` | **24** | exclusive-claim guard on a tool's OUTPUT DIRECTORY (`.ir-owner.json`: pid, runId, argv, host, `ps` start time). `FREE`/`SELF`/`STALE`/`RECYCLED` take it; `LIVE`/`CORRUPT`/`FOREIGN_HOST` refuse and name the flag that fixes it. **Seven inputs produce seven distinct codes, so the decider is not tautological** — validated against a real second node process, and against one SIGKILLed so its exit handler never ran |
| `node tools/tmp/ir_ladder_anchors.mjs --selftest` | **14** | dates when each `ai_ladder` rung's source anchor stopped matching — which nobody had. **`0d37e2f` 10/10 → `1c140c0` (concealment) 8/10 → `cdcdd65` (N-fighter) 6/10: concealment broke it, not the refactor.** `ai_ladder` pre-flights through this and **warns, never aborts** — a stale table must not block a working ladder |
| `node tools/tmp/ir_pathsweep.mjs --selftest` | **17** | census of every default output path in `tools/`. 119 sites. ⚠️ **It gave three confident wrong tables before it was right**, twice classifying `valuescan` itself as harmless; all three are now pinned by assertions. Worst cross-tool clusters: `shots/perpart` (10 readers), `shots/probe` (7), `shots/p1` (5 tools both writing and reading it) |
| `node tools/tmp/ax_layout.mjs --selftest` | **22** | builds a candidate arena layout at any size and sweeps 110 matchups × 8 seeds × 2 policies against it, Node-only. **Every assertion is shown to fail on a named input, including the 180° point-symmetry check** — whose first version required matching `kind` and correctly failed on the SHIPPED map, because `fryer_counter`/`sink_counter` are mirrored boxes with different dressing. The instrument behind §48's "do not ship the 4× arena into a 1v1 sim" |
| `node tools/tmp/cb_rig.mjs --selftest` | **17** | per-segment cap/radius arithmetic on the built rig — the tool that showed `taperedSegment`'s degenerate branch **never fires on egg or lollipop** (ratios 0.64–0.89), so reading the hamburger table as a clean bill of health would have skipped both. ⚠️ Carries a **retired method as a required failure**: a vertex-slab attachment test that reported lollipop's shoulder attached at +0.148 m while the PNG shows daylight, because `CylinderGeometry(…,16,1)` has vertices only at its end rings and it was reading the wrapper collar. The replacement is a raycast with a **mandatory** `bodyNames` argument |
| `node tools/tmp/dc_guard.mjs --selftest` | **40** | design-system component guard: that `.ds-bar`/`.fa-level-*` fills render **at all**, that a clipped caption cannot wrap, and that no declaration is dead by source order. ⚠️ **Every render check ABLATES the declaration it protects on each invocation** and requires the measurement to fail, then restores and requires it to pass — an ablation that passes exits non-zero as `TAUTOLOGICAL`. The browser arm (`--url <snapshot>`) is not gatecount-runnable and **expects 2 CASCADE faults today**, both cross-file in `characterSelect.ts` |
| `node tools/tmp/icon_score.mjs --selftest` | **9** | forced-choice blind naming scorer, confusion matrix, mutual swaps. ⚠️ **Never quote a score from it without the PROTOCOL** — see the acuity note in "Known instrument limits" |
| `node tools/tmp/ic_spec.mjs --selftest` | **24** | distils the delivered-size sweep into the spec the harness draws from, so nothing is hand-transcribed. Carries the SITE rule that fixed `boxFire` being drawn **2.56× larger than its three siblings**: occlusion invalidates a colour *sample*, not a *bounding box*. ⚠️ Also **refuses a merge whose sources overlap** — `delivered.json + lollipop.json` shared **260 of lollipop's 263 sites**, and since selection is smallest-wins a stale copy just *won*: a rebuild after `620bf7f` reported `boxBurger` at the old **14.39 px**. Agreement is not a defence (248 of the 260 agreed); `--superseded <file>` drops duplicates instead of picking a winner. 4 of the 24 run against that real historical pair |
| `node tools/tmp/ic_pair.mjs --selftest` | **7** | paired-plate scorer — both variants, one round, one judge. Exists because a 3-judge panel's swing on **byte-identical art** is the full range. Carries its own **twin floor** (byte-identical pairs must not disagree) |
| `node tools/tmp/ic_contrast.mjs` | ⚠️ browser, **no documented count** | ablation: is the icon actually painted. Deliberately unnumbered — its checked count is **not stable under GPU contention** (`0 of 24` with 36 icons silently unexamined, vs `0 of 57` on three quiet runs). A number that shrinks under load would present as doc drift and get "fixed" in the doc |
| `node tools/tmp/ic_plate.mjs --selftest --url <snapshot>` | ⚠️ browser | the delivered size/polarity fixture. **Known-bad input: it draws the harness AS IT HISTORICALLY SHIPPED** (20 px cream for everything) and requires the catch — `range` **by name, with polarity inverted**, plus `range` on size, `shards`, `heal` |
| `node tools/tmp/ac_engage.mjs --selftest` | **20** | how `stepAI` engages vs how the scripted player does — press rate, press separation, kit-expression share, blind-fire share, impatience. Built to find the Sushi role split and instead **refuted four candidate mechanisms**, including the favourite: the AI presses from *closer* (69 vs 90 wu) and expresses **65%** of its kit against the player's 50%. Its positioning is better, not worse |
| `node tools/tmp/ac_homing.mjs --selftest` | **11** | whether a homing projectile can close on a receding target given `range` as **cumulative path length**. **Predicted 47% before the mirror measured 47%** — two instruments sharing no code. This is the tool that found the systemic role asymmetry: `PLAYER_SPEED` 120 vs `AI_CHASE_SPEED` 70 means the human always shoots at the slow one |
| `node tools/tmp/hc_occluders.mjs --selftest` | **4** | ⚠️ **the guard for the silent-occluder class** — a `transparent: true` material that still writes depth and rejects whatever is beneath it. Sweeps the arena for the authoring mistake and **is shown to FAIL on the bug it guards**: 3/4 on the tree that had it, 4/4 after — ⚠️ and its `FLAT_MAX` now CLASSIFIES (`flat` buries what is under it, `tall` buries the floor behind it) rather than FILTERS, because the old predicate returned 4/4 on a tree carrying seven live tall occluders. Its injection also only ever asserted `some(name === 'puddle')`, true for the entire life of the hole, and its known-bad input re-injects the defect live. Found `M.dust` in `shared.ts` by the same sweep |
| `node tools/tmp/bl_vitals_gate.mjs --selftest` | **5** | prices a proposed vitals change against §22's structural bounds before it is measured. Every bound is shown to FAIL on a known-bad roster, so a green result means the bound was tested — not that it was skipped. Refused nothing in the Sushi/Legendary pass, which is how that pass established §22 was not the thing blocking it |
| `node tools/tmp/limbmatch.mjs --selftest` | **27** | hull deficiency / appendages / share — **computable on a reference plate**. `--mode control` adds 9 more, but they render in a browser and are not part of this contract |
| `node tools/tmp/sepscan.mjs --selftest` | **38** | internal separation (neck pinch, chin notch, head:body area). `--mode control` adds 8 more, browser-side and outside this contract |
| `node tools/tmp/trail_probe.mjs` | controls 3 | same-frame ablation of ground marks vs floor **and** cast |
| `node tools/tmp/aoband.mjs --selftest` | **25** | contact darkening binned by metres from the footprint |
| `node tools/tmp/haloprobe.mjs --selftest` | **27** | bloom-attributable halo as a paired `shipped − bloomOff`. ⚠️ Detects a rim via `userData.rimUniforms`, so it **counts a JSON-mangled corpse as live** after a plain `.clone()` — see `clonetoon_test` |
| `node tools/tmp/clonetoon_test.mjs` | **33** | ⚠️ **`Material.clone()` does not copy `onBeforeCompile`** — the root cause of the #1 defect. Asserts the DEFECT first, and was mutation-tested: drop the re-apply → 12 fail; keep the dead uniform handle → 1 fail (exactly its row); ignore `rim: false` → 5 fail |
| `node tools/tmp/tt_flatrim.mjs` | **24** | ⚠️ browser. **`toonMat({ flatShading: true })` was a shader that NEVER LINKED, so every mesh using it drew NOTHING** — `applyRimLight` reads `vNormal`, which three declares only inside `#ifndef FLAT_SHADED`. It survived three tuning rounds of the floor's chip layer because the **shadow-depth program carries no rim patch** and went on drawing every invisible chip's contact shadow. This guards the FACTORY, where the trap lives, rather than one caller (`ar_chipcheck` guards the chip layer): LINK from two independent instruments — GL `LINK_STATUS` and three's console — then DELIVERED PIXELS, facets actually happening, the rim answering its own uniform, and every shipped material configuration proven byte-identical to the pre-fix source. ⚠️ Its known-bad input is **that pre-fix source reproduced verbatim**, not `flatShading` itself, so the control cannot be fixed out from under it — which is exactly what happened to `ar_chipcheck`'s |
| `node tools/tmp/ds_inventory.mjs --selftest` | **29** | the design-system inventory: every radius/shadow/size/colour literal in `src/ui`, with counts. ⚠️ **Steer waves by TOKEN COVERAGE (4.4% → 21.2%), not by literal counts** — a distinct-value count only falls when the LAST user of a value converts, so it reads zero through an entire adoption wave |
| `node tools/tmp/cs_charcontact.mjs --selftest` | **31** | character contact shadow, measured on **two flanks mirrored about screen-vertical** — a directional cast darkens one, a centred contact darkens both. ⚠️ **Reference brawlers are NOT measurable**: every one stands inside a team-indicator decal ~3× its footprint drawn ON the contact band. `bs_06`'s vent props are the usable reference |
| `node tools/tmp/ds_neutral.mjs --selftest` | **10** | proves a `theme.ts` change is PIXEL-NEUTRAL: 70 computed properties × every element × 5 screens × 3 viewports, judged against a drift control rather than a guessed tolerance |
| `node tools/tmp/kneeprice.mjs --selftest` | **21** | prices `highlightKnee` as a **paired** sweep inside one synchronous evaluate (drift control exactly 0.0000). `--plates [--whole]` offline. Its known-bad fixtures are the two quantities `stage.ts` conflated, **in both directions** |
| `node tools/tmp/rebind_accept.mjs` | **35** | key rebinding asserted against **sim state**, not the DOM |
| `node tools/tmp/touchfeel.mjs` | **79** | stick bearings, dead zone, multi-touch, `touchcancel` |
| `tools/tmp/nav_history_probe.mjs` | **44** | URL names the screen · reload lands there · back/forward · query params survive · a throwing screen cannot freeze the router |
| `tools/tmp/glloss_probe.mjs` | **29** | forces a REAL context loss via `WEBGL_lose_context`; asserts the restored frame is the SAME frame against a drift control |
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
`policy_{trace,sensitivity}.mjs` · `screen_metrics.mjs` · `chars_metrics.mjs` ·
`up_click_audio.mjs` (does tapping a menu BUTTON make a sound? RMS off the master bus through
`__audio.connectTap`, with a dead-space cell and a paired suppressed/sibling cell as its
known-bad inputs — no offline assertion can see this, because the defect was the missing CALL,
not the sound) · `up_herofill.mjs` (hero height vs width fraction per viewport, and an
`--aspect-sweep` that widens only the panel's CSS — the demonstration that the width fraction
was a statement about the panel, not the hero) · `up_refhero.mjs` (the same two fractions read
off a REFERENCE lobby plate by colour mask, `--control` validates it against our own render
where `__charStage` knows the true answer)

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
  - 🚨 **AND IT IS NOW WRONG IN BOTH DIRECTIONS AT ONCE, IN ONE RUN, ON THE SAME DAY.** Everything
    above could still be read as *"noisy, but conservative"* — it fails characters that are fine. It
    is not conservative. Measured `3ad20e2`, `--ids egg,hamburger,pizza`, both columns printed side
    by side:

    | char | weakB% | weakBc% (contact-local) | verdict |
    |---|---|---|---|
    | egg | **61.8** | **0.0** | FAIL — and not one boundary pair is weak where it touches |
    | pizza | 32.1 | 17.0 | FAIL — about half the alarm is real |
    | hamburger | **4.3** | **9.0** | **PASS — while its contact count is more than double egg's** |

    **A false FAIL and a false PASS in the same table.** A metric that only over-reported would be a
    tax; one that also under-reports cannot be used as a gate verdict in either direction, and
    "well, it passed" is not evidence of anything. `minDL` is the quantity with a floor (**0.0039**,
    the 8-bit quantisation of `value.png`) and a target (0.15) — steer on it and on `dLcontact`.
    ⚠️ Note what this does **not** say: the underlying figure/ground concern is real and `dlBelow10`
    is now **0 of 11**, closed on merit. It is the *aggregate over whole-part medians* that is
    broken, not the idea of measuring adjacency.
- 🚨 **`valuescan` MEASURES PITCH 58, SO IT IS STRUCTURALLY BLIND TO ANYTHING THE LOBBY FRAMES.**
  Not noisy about it — blind. Measured by ablation on hamburger's patty: **9,886 px / 0.785% of the
  LOBBY frame against 240 px / 0.019% of the MATCH frame**, a **41× difference in delivered area**.
  That is why **three separate passes** could not close hamburger's hip read: every one of them
  steered on a gate that could barely see the element. **A flat `valuescan` result on a
  lobby-dominant element is not evidence a change did nothing** — it is the metric having nothing to
  express (`AGENT-BRIEF` rule 6, read backwards). **Ablate through the shipped lobby path instead.**
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
