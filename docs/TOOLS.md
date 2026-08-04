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
URL=$(node tools/snapshot.mjs --json | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])") \
  && node tools/arena-scan.mjs --url "$URL" --out shots/scan/x
```
⚠️ **The server dies with the shell that started it** — start it and measure in the *same*
invocation. Backgrounding it and measuring in the next call fails with
`ERR_CONNECTION_REFUSED`, which reads exactly like a broken build.

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
| `tools/arena-scan.mjs` | **The whole-arena scoreboard.** 18 player-centred stations through the live game. Reports `playerRank` in a 16×9 salience grid, player-vs-surround luma/saturation, a hue histogram, and channel clipping. `--list`, `--only`, `--sim-speed 0.02` for byte-comparable runs. |
| `tools/aspect.mjs` | Viewport fairness. Must PASS at **0.00wu spread** across 4:3 → 32:9 → portrait. |
| `tools/perf.mjs` | `--mode counts\|ablate\|alloc\|boot\|leak`. `--json` baselines, `--baseline` regression gate. **Hardware-independent numbers only** — it refuses to print timings as performance without `--unsafe-timing`. |
| `tools/audio-probe.mjs` | `--mode all\|depth\|identity\|live`. **319 assertions from real rendered samples** via `OfflineAudioContext` on the production path. |
| `tools/match-sim.mjs` | Real `sim.ts` in Node. `--all-matchups`, `--policy idle\|smart`, `--pathmap`, `--fog`, `--ranges`, `--occlusion`. A 180s match costs ~4ms. |
| `tools/match-play.mjs` | Drives the real game boot → menus → combat → result, sampling the HUD's own DOM. |
| `tools/filmstrip.mjs` | Animation as a contact sheet. Auto-detects cycle length; labels one-shots "NOT A LOOP". |
| `tools/motion_probe.mjs` | Joint traces in the character's local frame — camera, framing and post chain out of the equation. |
| `tools/tmp/menu_accept.mjs` | **315 assertions**, 5 viewports × 5 screens × notch/no-notch. Also **parses all 88 modules in ~95ms** to catch the backtick trap. `PREVIEW_BASE=<url>` to point it at a snapshot. |

### Scratch probes worth reusing (`tools/tmp/`)
`matcover.mjs` (exact share-of-frame per material, and the colour it *arrives* at) ·
`simfix.mjs` (override materials live, re-run salience — prices a change before you write it) ·
`caphex.mjs` (~20× cheaper than simfix for candidate colours) ·
`chroma.mjs` / `satmetrics.mjs` (reference-plate comparison) ·
`vfxdiag.mjs` (per-mesh world/screen/opacity dump, garish mode, pool-warm mode) ·
`lolliv.mjs` (virtual clock — hand-crank any effect in exact ms slices) ·
`rake.mjs` (runtime ablation + the HMR-stub pattern) · `chk.mjs` (names a broken dev-server URL in 2s)

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
