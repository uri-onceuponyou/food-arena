# Resume point

**Checkpoint taken while Uri is offline.** Everything that could be committed, is. Everything
still uncommitted belongs to a live agent and is listed below with what it owes.

```
HEAD          a3a3ec0   (pushed — origin/main is identical)
tsc           clean
sim.test      143 / 143
economy.test  173 / 173
verify-head   OK — the committed tree builds
```

**57 commits this session**, every one verified with `tools/verify-head.mjs` before pushing.

---

## If the session died and you are picking this up cold

1. **Nothing is lost.** The working tree persists on disk; the uncommitted changes below are
   real files, type-clean, with the full test suite green.
2. **Read `docs/STATE.md`** for where the project stands, then **`docs/DECISIONS-FOR-URI.md`** —
   its answer-sheet table is the fastest way back in.
3. **Do not commit the uncommitted work blind.** Each item below still owes its own acceptance
   measurement. Committing unverified visual or balance changes is the one thing this project's
   standards forbid, and the git log is its primary source.

---

## Uncommitted work in the tree, by owner

All of it is `tsc`-clean and the full suite passes. None of it has run its own acceptance test yet.

| files | agent | state | what it still owes |
|---|---|---|---|
| `src/characters/*.ts` ×11 | value ladder | resumed, was on "pass 3, the last weak pairs in the leg chain" | per-character `range`/`p05`/`steps`/`weakBoundaryPct`, how many pass `valuescan --mode gate` (0 of 11 at start), and **figure/ground proof it did not spend it** — the minimum is +0.1039 against a ≥0.10 floor |
| `src/render/stage.ts`, `tools/tmp/gradechroma.mjs` | grade | resumed | its **own** measured effect of `contrast` 0.62 → 0.72 (claim is +0.016 range, all 11), P95 unchanged at 0.899, clipping at both tails, and a colour re-baseline against a stated SHA |
| `src/game/{match,vfx}.ts`, `src/vfx/weapons/{hamburger,waterbottle}.ts` | weapon VFX | resumed twice, **told to bank rather than extend** | per-weapon table **with occlusion ratios** (so "unburied" ≠ "enlarged"), Giant Lollipop's repaint share **and its off-screen tell** |
| `src/audio/engine.ts`, `tools/audio-probe.mjs` | audio r2 | running | whether the pre-gesture AudioContext is a real defect or a stale comment; which voice exceeds Nyquist |
| — none yet | capture integrity | running | the `__screenReady` fix across every capture tool |
| — none yet | AI driver | just started | stun symmetry, weapon ranking, melee-only flee branch |

⚠️ **Two of these carry declared balance consequences** and must not be committed without their
numbers: the AI stun-symmetry fix is **−9.5 pp** of player win rate, and the grade change moves
colour rails. Both are bugs with consequences, not tuning — the consequence gets *declared*, never
silently compensated. `ENEMY_MAX_HP` is Uri's dial and is parked as `DECISIONS §12`.

---

## The single most important open finding

**`window.__screenReady === true` does not mean the screen is visible.** The flag is set in the
same tick the curtain drops; `.fa-screen` then runs a 0.26 s fade. Measured: **opacity is 0 when
the flag flips.** Same screen at the flag vs 2.5 s later — **stdev 26.16 vs 96.08**, a 3.7×
contrast difference on identical content.

Every probe that waits on the flag and screenshots is exposed: `menu_accept` (361 assertions), the
blind critic packets, and the contrast tools whose whole purpose is measuring *"against the pixels
actually behind it"*. A faded frame **compresses** contrast, so those readings are conservative
rather than inverted — but their absolute values have been quoted all session and several may need
re-stating. **An agent is fixing this now; treat menu contrast and menu critic scores as
provisional until it lands.**

It survived because it is intermittent: it only appeared on the *third* round trip of an
end-to-end run, when cached thumbnails made the capture 0.3 s faster than the animation.

---

## On Uri's call — suggested order

1. **Collect the six in-flight reports**, verify gates, commit each file set separately with its
   measurements in the message.
2. **Re-baseline colour** once the grade and character passes have both landed — it is stale twice
   over and `tools/scan/colour-baseline.json` carries `stationKeys` so a moved station makes it
   *incomparable* rather than silently wrong.
3. **Re-run the blind scoring round.** The last one is superseded: arena colour, arena layout,
   character arms/legs/faces, the post-chain toe, the grease puddle and the roster crop have all
   landed since. Scores to beat — arena **5.33**, home **6.0**, character select **6.0**,
   characters **3.6**, against references at 8.3–9.0 and a bar of **7+**.
4. **Then the value ladder's remaining gap**, which is the measured reason none of it has moved a
   blind score yet.

---

## Known transport instability

Six agent terminations this stretch — connection errors and stalls, not agent faults. My own
tooling ran fine throughout, so it is the agent stream specifically. The handling that worked:
**assess the tree, resume rather than discard** (work is type-clean and mid-file, not mid-thought),
**one at a time**, and tell a twice-failed agent to *bank what it has rather than open a new front*.
