# Resume point

**Machine was disconnected deliberately. All agents were stopped cleanly first; nothing died
mid-write. Nothing is lost.**

```
main                            63e5446   clean tree, pushed, origin identical
wip/session-checkpoint-...      b3dda69   six agents' unfinished work, pushed
tsc                             clean
sim.test / economy.test         143 / 143   ·   173 / 173
verify-head                     OK — the committed tree builds
```

**57 commits on `main` this session**, every one verified with `tools/verify-head.mjs` before push.
`main`'s working tree is **completely clean** — everything unfinished lives on the branch.

---

## Start here on resume

1. **`main` is safe to build, run and ship from.** It contains only verified work.
2. **`wip/session-checkpoint-2026-08-05` holds six agents' unfinished work.** **Do not merge it.**
   Its commit message documents, per agent, what it was doing and **how far to trust it** — one of
   the six knew its own instrument was producing wrong images when it stopped.
3. **Re-fan-out** — take one file set at a time, re-run that item's acceptance measurement, and
   commit to `main` with the numbers, the way every commit this session landed.

---

## The six, ranked by how ready they are

| # | agent | files | trust | state |
|---|---|---|---|---|
| 1 | **value ladder** | `src/characters/*.ts` ×11 | **HIGH** | *"9/11 now pass (0/11 before), and the cast's minimum figure/ground went UP. Waiting on limbcheck."* This is the session's **#1 red item**. Owes: the limbcheck re-run and the per-character table. |
| 2 | **grade** | `src/render/stage.ts` | **HIGH** | *"Frames look right at a glance. Now banding, shadow crush, sooty cast."* `contrast` 0.62→0.72, worth +0.016 range on all 11. Owes: its own per-character delta, P95 at 0.899, clipping, re-baseline. |
| 3 | **capture integrity** | `tools/{review,shoot}.mjs`, 5 metrics tools | **MEDIUM** | Fixing the `__screenReady` race. ⚠️ **`menu_accept` (361) and `menu_accept_portrait` (219) are modified and were not re-run.** |
| 4 | **audio r2** | `src/audio/{engine,synth}.ts`, `tools/audio-probe.mjs` | **MEDIUM** | Reached `synth.ts`, so the Nyquist half is likely done. ⚠️ **`audio-probe`'s 389 baseline was not re-established.** |
| 5 | **weapon VFX** | `src/game/{match,vfx}.ts`, 2 weapon files | **LOW** | *"The judgement PNG exposes an instrument bug — the character is rendering magenta. My matte code double-captures shared materials."* **Its own measurements are untrustworthy; the code may be fine. Re-measure from scratch.** |
| 6 | **AI driver** | — none | n/a | Barely started. Its three tasks are fully specified below. |

---

## Work that was queued and never started

- **AI driver (task 6 above).** Three findings, all measured, none fixed:
  - 🔴 **A stun means two different things.** `rules.ts` says *"stunned = movement locked to 0"* and
    `sim.ts` implements that, but `ai.ts` also gates weapon choice on it — so a stunned AI is
    **rooted and silenced**. 11 of 11 characters; the stunned player fires 100% of its shots, the
    stunned AI 0%. Worth **−9.5 pp**, single matchups up to 84 pp. **A bug, not a difficulty
    setting — fix it, declare the consequence, do not compensate.**
  - Both drivers rank weapons by authored `damage`, not **damage per press**, so multi-pellet
    weapons are systematically under-used.
  - `pickSniperWeapon` requires `'ranged'`, so a **melee-only AI has no selectable weapon** in its
    flee branch. Third instance of this shape in that file.
- **A fresh blind scoring round.** The last one is superseded — arena colour, arena layout,
  character arms/legs/faces, the post-chain toe, the grease puddle and the roster crop have all
  landed since. Scores to beat: arena **5.33**, home **6.0**, character select **6.0**, characters
  **3.6**, against references at 8.3–9.0 and a bar of **7+**.
- **Colour re-baseline**, stale twice over. `tools/scan/colour-baseline.json` carries `stationKeys`,
  so a moved station makes it *incomparable* rather than silently wrong.
- **The Giant Lollipop whiteout** — three stacked effects from three owners, repainting **85.3%** of
  the player's own pixels. Constraint: its off-screen tell must stay readable, because that is what
  holds the fair-play radius at 199.2wu.

---

## The finding that most needs carrying forward

**`window.__screenReady === true` does not mean the screen is visible.** The flag is set in the same
tick the curtain drops; `.fa-screen` then runs a 0.26 s fade. Measured: **opacity is 0 when the flag
flips.** Same screen at the flag vs 2.5 s later — **stdev 26.16 against 96.08**, a 3.7× contrast
difference on identical content.

Every probe that waits on the flag and screenshots is exposed: `menu_accept`, the blind critic
packets, and the contrast tools whose whole purpose is measuring *"against the pixels actually
behind it"*. A faded frame **compresses** contrast, so those readings are conservative rather than
inverted — but their absolute values have been quoted all session. **Treat menu contrast numbers and
menu critic scores as provisional until agent 3's fix lands.**

It survived because it is intermittent: it appeared only on the *third* round trip of an end-to-end
run, when cached thumbnails made the capture 0.3 s faster than the animation.

---

## Operational notes for the next fan-out

- **Transport was unstable** — six agent terminations, all connection errors or stalls, never agent
  faults; orchestrator tooling ran fine throughout. When one dies: **assess the tree and resume via
  `SendMessage`**, do not discard. They die *mid-file, not mid-thought*, so the work is usually
  type-clean. Resume one at a time, and tell a twice-failed agent to **bank rather than extend**.
- **One owner per file set** remains the hardest constraint. It held all session across ~25 agents.
- **Every agent should validate its instrument against a known input before believing it.** This
  session found **eight** instruments returning confident wrong answers — including two that an
  agent caught in its own tooling mid-task.
