# Tools runbook

Sixteen tools. Almost every one was built to answer a question that had already cost real
time. **Prefer reaching for one of these over inventing a new probe.**

```bash
npm run dev        # http://localhost:5173 — SHARED. Fine for a quick look, never for a number.
npx tsc --noEmit
node src/game/sim.test.mjs            # 51
node src/game/economy/economy.test.mjs # 173
```

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
| `tools/review.mjs` | `--ours <png> --category character\|gameplay --out shots/review/x --n 2` — builds a **blind** A/B packet. The answer key is a separate `.json` a critic must never open. |

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
| `tools/filmstrip.mjs` | Animation as a contact sheet. Auto-detects cycle length; labels one-shots "NOT A LOOP". |
| `tools/motion_probe.mjs` | Joint traces in the character's local frame — camera, framing and post chain out of the equation. |
| `tools/tmp/menu_accept.mjs` | **315 assertions**, 5 viewports × 5 screens × notch/no-notch. Also **parses all 88 modules in ~95ms** to catch the backtick trap. `PREVIEW_BASE=<url>` to point it at a snapshot. |

#### `arena-scan` colour budget — the guard rail on cumulative desaturation

```bash
node tools/arena-scan.mjs --url $URL --baseline tools/scan/colour-baseline.json  # exit 1 on a colour regression
node tools/arena-scan.mjs --url $URL --gate         # also exit 1 on an absolute rail FAIL
node tools/arena-scan.mjs --url $URL --json tools/scan/colour-baseline.json      # RE-baseline (deliberate only)
node tools/arena-scan.mjs --ref-plates reference/images/curated/gameplay         # re-derive the reference figures
node tools/arena-scan.mjs --selftest               # 78 assertions on synthetic frames, no browser
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
