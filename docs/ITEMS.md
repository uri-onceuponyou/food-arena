# Loadout items — the contract

Uri, 2026-08-31. Ten items, two equip slots, rarity, and acquisition through boxes and
the trophy road. **`src/game/rules.ts` is the source of truth** — `ITEMS`, `ITEM_TUNING`,
`ITEM_SLOTS`, `ITEM_STATUS_MS`. This file explains it and says who builds what.

> ⚠️ **This registry was written by hand by the orchestrator, after being delegated twice
> and dying twice.** Run one: the contract agent died on a connection error and four
> builders fanned out onto a foundation that did not exist — 945k tokens spent each
> inventing their own names (`Spore Bloom`, `Shiitake Shield`, `springboard`), none of
> them agreeing. Run two: two more deaths, 304k tokens, and the now-guarded fan-out
> correctly refused to start. The unmerged work is on branch **`items-groundwork`**
> (`3c30a3b`) and its VFX header is genuinely good — its lit-material rule is carried
> into `ItemDef.look` verbatim. **A contract four agents depend on cannot be the flaky
> thing.**

---

## The ten

| id | name | kind | rarity | what it does |
|---|---|---|---|---|
| `tenderiser` | Tenderiser | passive | Legendary | each hit on the same target hits harder |
| `springform` | Springform | active | Normal | bounce a long way, toward a fight or out of one |
| `warm_milk` | Warm Milk | active | Epic | sleep, longer the further away they were |
| `pompa` | Pompa | active | Rare | clogs a weapon for five seconds |
| `squid_ink` | Squid Ink | active | Rare | blots the victim's own screen |
| `disposal` | Disposal | active | Legendary | drops an enemy beside a different enemy |
| `blue_cheese` | Blue Cheese | passive | Rare | permanent stink cloud, small damage per second |
| `shiitake` | Shiitake Shield | active | Neon | long wind-up, then attackers take back what they deal |
| `liquorice` | Liquorice Rope | active | Epic | roots an enemy for five seconds |
| `leftovers` | **Leftovers** | triggered | **Cyber** | if your killer dies while the match goes on, you come back. Once. |

**Names come from what each item does**, per Uri's instruction. `pompa` keeps his own
word — it is a plunger, and it clogs. `Shiitake Shield` is inherited from the groundwork
branch because it was the better name; everything else there was overruled and this file
says so, so nobody mistakes that branch for authoritative.

### Rarity means something different here than it does on characters

⚠️ `DECISIONS §26`: character rarity is **acquisition** rarity and confers no power —
`rarityCostMultiplier` is 1.0 on every tier. **Item rarity is the opposite, deliberately.**
An item you equip in one of two slots *is* a power choice, so its tier gates the drop
pool. The two uses of one word are reconciled by what they gate: a character's tier gates
nothing, an item's tier gates how hard it is to get.

Tier order is not a taste call — it is `economy/tuning.ts`'s own box weights:
Normal 120 · Rare 260 · Epic 520 · Legendary 900 · Neon 1400 · **Cyber 2200**. So Cyber is
the rarest tier in the game, and Uri said Zombie Power is the rarest item.

---

## Who builds what

| track | owns | notes |
|---|---|---|
| **sim behaviour** | `sim.ts` `state.ts` `combat.ts` `movement.ts` | equip, activation, cooldowns, all ten effects. Ink is a **status flag only** here |
| **lobby loadout** | `ui/screens/lobby.ts`, `ui/icons/**` | pick 2 from what you own; must survive leaving and re-entering |
| **acquisition** | `economy/**`, `shop.ts`, `trophyRoad.ts` | box pools weighted by rarity; trophy-road drops are a **surprise, not a fixed node** |
| **VFX + ink** | `vfx.ts`, `vfx/**`, `render/stage.ts` | ten world effects, plus the screen-space ink |
| **AI + balance** | `ai.ts` | bots must use them, and somebody must price the feature |

Primitives that already exist — **use them, do not rebuild**: the displacement primitive
(`knockback` / `lure` / `selfLaunch`, `a975567`) for Springform and Disposal; the
cast/telegraph system for the Shiitake wind-up; `MEDIKIT` as the worked example of a
derived-constant consumable.

---

## 🚨 Two items are structurally invisible to the two-seat corpus

**Disposal** is unavailable at N=2 by Uri's own rule (`minAlive: 3`). **Leftovers** needs a
killer who then dies *while the match continues*, which cannot happen when there were only
two fighters.

Every balance number in this repo rests on a 110-cell two-seat matchup corpus. **It cannot
see either of these.** The medikit track hit exactly this shape and its first result read
*"0 of 110 moved, bit-identical"* — which looks like "the change did nothing" and was
really "the rig cannot see it". It proved the distinction by showing 882 kits dropped and
**0 taken** at N=2.

→ **Before reporting a null, prove the rig can see a change at all** by planting one you
know is large. Then measure at N=6 with `nf_ffa` (placement floor 0.978 places, seat
spread 0.315).

`sim.test.mjs` §41(c) asserts the gating is **declared** rather than hidden inside a
handler, so the loadout screen, the AI and any enumeration can all see it.

---

## Every number is derived, and the three that are not say so

`sim.test.mjs` §41 asserts the **derivations**, not the values — re-tune a source and a
stale constant becomes a red row instead of a silent lie.

* `ITEM_STATUS_MS = 5000` is **Uri's number, not a derived one**. He wrote "5 secons" for
  Pompa, "Lasts for 5 seconds" for the shield and "for 5 seconds" for the rope — three
  items, one duration, stated three times independently. Everything else that needs a
  duration derives from it.
* Warm Milk's range is `GUARANTEED_VISIBLE_RADIUS` — "half a screen" is the disc every
  supported aspect ratio guarantees. Springform is half of that.
* Blue Cheese and Disposal both work at `REACH.meleeHeavy`.
* Leftovers returns you with `MEDIKIT.heal × MEDIKIT.count` — one corpse's worth of kits.
* The Shiitake wind-up is `SUPER_MIN_COOLDOWN_MS`, and reflect is **1.0** — Uri said
  attackers take damage on *every* damage they do, not a fraction.

> ⚠️ **§41(e) went red within a minute of being written, and that is the point.**
> `blue_cheese.dps` is a literal (`CHARACTERS` is declared ~1,400 lines below the block,
> so a `Math.min` over it there is a TDZ `ReferenceError` — the same trap the medikit
> track hit). I typed `2` from a measurement taken *before* the 4-slot weapon pass added
> eleven weapons. The live minimum is **1**. The assertion caught it immediately. A
> literal is stale from the moment it is typed; this one was stale before it was
> committed.

---

## Parked for Uri — assumed, running, not blocking

1. **Stacking damage.** *"increases the damage by 1.3 up to x6 time (6x1.3)"* reads either
   as six compounding applications (**1.3⁶ = 4.827×**) or as **6 × 1.3 = 7.8×** flat.
   Assumed the first — the smaller of the two, and the one that makes "x6 time" mean a
   stack count. Also undefined and structurally required: **what breaks a streak.** Assumed
   a lapse of `SUPER_MIN_COOLDOWN_MS` without landing on that target again, because
   otherwise a stack laid at second ten is still live at the death of the match.
2. **"Up to 2 items"** — assumed two slots *total*, with a permanent passive (Blue Cheese,
   Tenderiser) occupying one. Otherwise passives are free and always correct.
3. **Squid Ink while spectating.** You can be dead and watching your killer. Whether the
   blots follow the camera, the corpse, or clear on death is undecided — the VFX track
   must pick one and say so.
4. **Duplicates.** What a second copy of an owned item does is the acquisition track's call.

---

## The rule that outranks everything else here

**There is no RNG in the sim. Not unseeded, not seeded.**
`grep -rn "Math.random" src/game/{sim,state,combat,ai,movement}.ts` returns nothing, and
the seeds every balance number rests on belong to the *driver*. Every item effect is a
deterministic function of match state at the instant it fires. Where one looks like it
wants a roll — Disposal's destination — the rule is an **ordering over a set the sim
already holds**.

Economy-side acquisition is a different question and **does** roll: that is
`economy/rng.ts`, which already exists with published box odds. Use it there, never here.
