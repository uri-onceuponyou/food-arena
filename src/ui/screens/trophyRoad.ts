/**
 * Trophy Road.
 *
 * Information architecture is `reference/prototypes/trophy-road-screen.html`'s: a
 * big trophy counter with a floating delta, a horizontally scrolling track of
 * milestone nodes each showing its threshold / icon / reward / status, a "you are
 * here" pin dropped between the two nodes you sit between, and a reveal card with
 * confetti when a reward lands. All of it is still here and still in that order.
 *
 * Four deliberate changes of execution:
 *
 *  1. **Rewards are CLAIMED, not auto-granted.** The prototype queued reveal cards
 *     the instant you crossed a threshold. Every shipped brawler makes you tap the
 *     node, which is both more satisfying and the difference between a road that is
 *     a chart and a road that is a screen you can DO something on. It also means the
 *     loudest control here does something real on the very first visit.
 *  2. **The prototype's simulator panel is gone.** Six "finish in Nth place" buttons
 *     existed to demo the maths without a game attached. There is a game attached.
 *     Trophies come from `matchScreen.ts` banking a real result.
 *  3. **Chests are openable here.** A chest you cannot open is a number, and both
 *     menu critics punished controls that do nothing. Opening is the model's
 *     `openContainer`, seeded and deterministic, and every container publishes its
 *     drop rates from the same table the roll uses (the ⓘ button).
 *  4. **Landscape and thumbs.** The prototype was a scrolling portrait page; this is
 *     a fixed three-row grid with exactly one scrolling axis, inside
 *     `env(safe-area-inset-*)`, with 44px minimums throughout.
 *
 * Every number displayed here — thresholds, payouts, odds, prices — is read from
 * `game/economy/`. There is not one economy literal in this file.
 */

import { CHARACTERS, RARITY_COLORS, type CharacterId, type Rarity } from '../../game/rules';
import {
  CONTAINERS,
  CONTAINER_KINDS,
  containerOdds,
  describeReward,
  formatPercent,
  formatPrice,
  bonusPercent,
  milestoneFace,
  milestones,
  RARITY_MEANING,
  roadEnd,
  roadProgress,
  storeAvailable,
  storeProducts,
  type ContainerKind,
  type Milestone,
  type Reward,
} from '../../game/economy';
import type { Screen, ScreenContext } from './types';
import { injectStyles, rgba } from './theme';
import {
  containerIcon, emojiIcon, ensureIconStyles, hydratePortraits, icon, portraitMarkup,
} from '../icons';
import { burstConfetti, el } from './fx';

/**
 * ── Making the container ladder RANKABLE, without renaming anything ──────────
 *
 * The five containers are a strict ladder — Chest, Hamburger Box, Purple Pineapple
 * Box, Big Smile Box, Purple Fire Box — and NOTHING on screen said so. Their names
 * mix a food, a colour-plus-food, a facial expression and a colour-plus-element, so
 * no reader can order them; STATE.md records this as "an unrankable rarity ladder
 * that mixes themes into a rank sequence". On the road it was worse than unrankable:
 * four of the five draw the same box silhouette, and a claimed node greyscales its
 * icon, so three consecutive container nodes rendered as three identical grey boxes.
 *
 * The names are `economy/tuning.ts`'s and are not this file's to change (and
 * `economy.test.mjs` asserts against them). The RANK, though, is not naming — it is
 * derivable, and it is derivable from the same table the roller uses:
 *
 *   floor rarity = the character rarity a box pays out most often
 *   rank         = position when the five are sorted by that floor, then by how much
 *                  of the box is characters at all (which is what puts the
 *                  currency-heavy free Chest below the Hamburger Box despite both
 *                  bottoming out at Normal)
 *
 * So it cannot drift from the odds, exactly like `containerOdds()` itself: retune a
 * box and its position on the ladder moves with it. Rendered as pips plus the floor
 * rarity's own colour, which is the one visual channel this screen has NOT already
 * spent (fill = claim state, ring = character rarity — a contract an earlier critic
 * round established and this deliberately does not cross).
 */
const RARITY_ORDER: Rarity[] = ['Normal', 'Rare', 'Epic', 'Legendary', 'Neon', 'Cyber'];

interface ContainerTier {
  rank: number;
  of: number;
  floor: Rarity | null;
}

const TIERS: Record<string, ContainerTier> = (() => {
  const scored = CONTAINER_KINDS.map((kind) => {
    const rows = containerOdds(kind).filter((r) => r.rarity);
    let floor: Rarity | null = null;
    let best = -1;
    let charShare = 0;
    for (const r of rows) {
      charShare += r.percent;
      if (r.percent > best) { best = r.percent; floor = r.rarity ?? null; }
    }
    return { kind, floor, charShare };
  });
  scored.sort((a, b) => {
    const ra = a.floor ? RARITY_ORDER.indexOf(a.floor) : -1;
    const rb = b.floor ? RARITY_ORDER.indexOf(b.floor) : -1;
    return ra - rb || a.charShare - b.charShare;
  });
  const out: Record<string, ContainerTier> = {};
  scored.forEach((s, i) => { out[s.kind] = { rank: i + 1, of: scored.length, floor: s.floor }; });
  return out;
})();

/** Rank pips for one container, coloured by the rarity it bottoms out at. */
function tierPips(kind: ContainerKind, opts: { label?: boolean } = {}): string {
  const t = TIERS[kind];
  if (!t) return '';
  const colour = t.floor ? RARITY_COLORS[t.floor] : 'var(--ink)';
  const pips = Array.from({ length: t.of }, (_, i) => `<i class="tr-pip${i < t.rank ? ' is-on' : ''}"></i>`).join('');
  // "or better" until 2026-08-05, and it is now a false claim rather than a loose one:
  // rarity stopped conferring power at equal level (`rules.ts` DEVIATION #12). "or rarer"
  // is what the pips have always actually measured — the floor of the box's character
  // pool — and it is now also what rarity actually means.
  const aria = `Tier ${t.rank} of ${t.of}${t.floor ? `, ${t.floor} or rarer` : ''}`;
  return `<span class="tr-tier" style="--pip:${colour}" role="img" aria-label="${aria}">${pips}${
    opts.label && t.floor ? `<span class="tr-tier-txt">${t.floor}+</span>` : ''
  }</span>`;
}

export function createTrophyRoadScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-trophy-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen fa-tr');
  const profile = ctx.profile;

  root.innerHTML = `
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${icon('back')} Back</button>
      <h1 class="fa-title tr-heading">Trophy Road</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${icon('coin')}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${icon('gem')}</span><span data-el="gems">0</span></div>
    </header>

    <div class="tr-body">
      <section class="tr-hero">
        <div class="tr-hero-count">
          <span class="tr-hero-em">${icon('trophy')}</span>
          <span class="tr-hero-num" data-el="trophies">0</span>
          <span class="tr-delta" data-el="delta"></span>
        </div>
        <div class="tr-hero-next">
          <div class="tr-nextline">
            <span class="tr-nextlabel" data-el="nextlabel">Next reward</span>
            <span class="tr-nextval" data-el="nextval"></span>
          </div>
          <div class="fa-level-track tr-track">
            <div class="fa-level-fill tr-fill" data-el="fill"></div>
            <span class="fa-level-xp" data-el="fillxp"></span>
          </div>
        </div>
        <button class="fa-btn fa-btn--green tr-claimall" type="button" data-el="claimall">${icon('sparkle')} Claim</button>
      </section>

      <div class="fa-panel fa-panel--flush tr-roadwrap">
        <div class="fa-scroll tr-road" data-el="road"></div>
      </div>
    </div>

    <footer class="tr-bottom">
      <div class="tr-inventory" data-el="inventory"></div>
      <div class="tr-bottom-actions">
        <!-- The mark was a raw U+24D8. It is not an emoji, so the emoji sweep passed
             it, but it is still an OS-drawn glyph that Rubik does not carry: the
             reader's fallback font decides what it looks like, which is the exact
             thing 65 authored icons exist to stop. The chest is what the sheet is
             ABOUT, and it ties the button to the inventory row beside it. -->
        <button class="fa-iconbtn tr-odds" type="button" data-el="oddsbtn">${icon('chest')} Drop rates</button>
        <button class="fa-btn fa-btn--quiet tr-storebtn" type="button" data-el="storebtn">${icon('gem')} Get Gems</button>
      </div>
    </footer>

    <div class="tr-sheet" data-el="sheet">
      <!-- 'data-clicksound=on' opts a NON-button into the shell's global UI click sound
           (shell.ts). Tapping outside a sheet to dismiss it is a committed action and is
           the one way out of the odds and store sheets on a phone, so it has to answer
           the same way the close button does. -->
      <div class="tr-sheet-scrim" data-el="scrim" data-clicksound="on"></div>
      <div class="tr-sheet-card" data-el="sheetcard"></div>
    </div>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`trophyRoad: missing element "${sel}"`);
    return node;
  };

  const roadEl = q<HTMLDivElement>('road');
  const invEl = q<HTMLDivElement>('inventory');
  const sheet = q<HTMLDivElement>('sheet');
  const sheetCard = q<HTMLDivElement>('sheetcard');
  const confetti = q<HTMLDivElement>('confetti');
  const claimAllBtn = q<HTMLButtonElement>('claimall');
  const deltaEl = q<HTMLSpanElement>('delta');

  // ── The road ───────────────────────────────────────────────────────────────

  /** Rebuilt wholesale on every change. 34 nodes of static markup is nothing next
   *  to the bookkeeping a diffing path would need, and it makes "claimed" state
   *  impossible to get out of sync with the model. */
  function renderRoad(centreOnPin = false): void {
    const trophies = profile.trophies;
    const owned = profile.unlocked;
    const claimed = new Set(profile.economy.claimed);
    roadEl.innerHTML = '';

    // The track is a real element rather than the scroller itself, because the ROAD
    // — one continuous line running the length of the journey, filled up to where
    // you stand — has to be drawn once across the whole scrollable width. Round 1
    // gave every node its own line segment; at desktop height that produced a row of
    // tiles at the top of a very tall empty cream panel, which is the exact
    // "unfinished build" read two menu critics have already punished on this project.
    const track = el('div', 'tr-roadtrack');
    const spine = el('div', 'tr-spine');
    const spineFill = el('div', 'tr-spine-fill');
    spine.appendChild(spineFill);
    track.appendChild(spine);

    let pinPlaced = false;
    const placePin = (): void => {
      const pin = el('div', 'tr-pin');
      pin.dataset.el = 'pin';
      pin.innerHTML = `
        <span class="tr-pin-dot">${icon('pin')}</span>
        <span class="tr-pin-label">${trophies.toLocaleString()}</span>
      `;
      track.appendChild(pin);
      pinPlaced = true;
    };

    // Nodes alternate above and below the line. Parity comes from the MILESTONE
    // index, not from `nth-child`, because the pin is spliced into the middle of the
    // list and would otherwise flip every node after it onto the same side.
    let index = 0;
    for (const m of milestones()) {
      if (!pinPlaced && trophies < m.trophies) placePin();
      const node = buildNode(m, trophies, claimed.has(m.trophies), owned);
      node.classList.add(index % 2 === 0 ? 'is-high' : 'is-low');
      track.appendChild(node);
      index++;
    }
    if (!pinPlaced) placePin();

    roadEl.appendChild(track);
    // Character nodes carry real portraits; fill in whatever is cached and subscribe
    // for the rest as `thumbs.ts` renders them.
    hydratePortraits(track);
    measureTrack();
    if (centreOnPin) centrePin();
  }

  /**
   * The one post-layout pass: fill the road up to the pin, and size every node's
   * stem to reach the road exactly.
   *
   * Both numbers are MEASURED rather than expressed in CSS, for the same reason: a
   * node's height is its content, so neither "how far along is the pin" nor "how far
   * is this node from the rail" can be written as a stylesheet value. The first
   * attempt at the stems used a fixed length and they shot straight through the road
   * and out the other side. One forced layout, 34 rects, once per render.
   */
  function measureTrack(): void {
    const track = roadEl.querySelector<HTMLElement>('.tr-roadtrack');
    const spine = roadEl.querySelector<HTMLElement>('.tr-spine');
    const fill = roadEl.querySelector<HTMLElement>('.tr-spine-fill');
    const pin = roadEl.querySelector<HTMLElement>('[data-el="pin"]');
    if (!track || !spine || !fill || !pin) return;

    fill.style.width = `${Math.max(0, pin.offsetLeft + pin.offsetWidth / 2)}px`;

    const spineRect = spine.getBoundingClientRect();
    if (spineRect.height === 0) return;
    const railY = spineRect.top + spineRect.height / 2;
    for (const node of track.querySelectorAll<HTMLElement>('.tr-node')) {
      const r = node.getBoundingClientRect();
      const gap = node.classList.contains('is-high') ? railY - r.bottom : r.top - railY;
      node.style.setProperty('--stem', `${Math.max(0, Math.round(gap))}px`);
    }
  }

  /**
   * Scroll the pin to the middle of the track.
   *
   * `scrollLeft`, not `scrollIntoView`: the latter walks every scrollable ancestor
   * and will happily shove the whole app layer sideways, which is exactly what
   * `menu_accept.mjs`'s no-page-scroll check exists to catch. This touches one
   * element and cannot escape it.
   */
  function centrePin(): void {
    const pin = roadEl.querySelector<HTMLElement>('[data-el="pin"]');
    if (!pin || roadEl.clientWidth === 0) return;
    roadEl.scrollLeft = Math.max(0, pin.offsetLeft - roadEl.clientWidth / 2 + pin.offsetWidth / 2);
  }

  function buildNode(
    m: Milestone,
    trophies: number,
    isClaimed: boolean,
    owned: ReadonlySet<CharacterId>,
  ): HTMLElement {
    const face = milestoneFace(m.reward, owned);
    const reached = trophies >= m.trophies;
    const canClaim = reached && !isClaimed;

    // A node you can act on is a BUTTON; a node you cannot is a div. Not cosmetic:
    // it is what keeps "every enabled control is a real control" true, and it keeps
    // 34 disabled buttons out of the tab order on a screen where three of them
    // matter.
    const node = canClaim ? el('button', 'tr-node is-claimable') : el('div', 'tr-node');
    if (canClaim) (node as HTMLButtonElement).type = 'button';
    if (isClaimed) node.classList.add('is-claimed');
    if (face.isCharacter) node.classList.add('is-character');
    node.dataset.trophies = String(m.trophies);

    if (m.reward.type === 'character') {
      const colour = RARITY_COLORS[CHARACTERS[m.reward.id].rarity];
      node.style.setProperty('--node-accent', colour);
      node.style.setProperty('--node-glow', rgba(colour, 0.55));
    }

    // The tick is an authored icon in a span, not a CSS `content: '✓'`.
    //
    // Generated content cannot hold SVG, so the claimed state was drawing a raw U+2713
    // — an OS-drawn glyph on a screen whose whole icon pass exists to have none, and
    // one that cannot take `--fa-ic-ink` so it could not flip on the green disc it
    // sits on.
    const status = isClaimed
      ? `<span class="tr-status is-done">${icon('check')} Claimed</span>`
      : canClaim
        ? '<span class="tr-status is-ready">Claim</span>'
        : `<span class="tr-status">${(m.trophies - trophies).toLocaleString()} to go</span>`;

    node.innerHTML = `
      <span class="tr-node-req">${icon('trophy')} ${m.trophies.toLocaleString()}</span>
      <span class="tr-node-medal"><span class="tr-node-em">${
        m.reward.type === 'character' ? portraitMarkup(m.reward.id, { crop: 'head' })
          : m.reward.type === 'container' ? containerIcon(m.reward.kind)
          : emojiIcon(face.emoji)
      }</span>${isClaimed ? `<span class="tr-node-tick">${icon('check')}</span>` : ''}</span>
      <span class="tr-node-title">${face.title}</span>
      ${m.reward.type === 'container' ? tierPips(m.reward.kind) : ''}
      ${face.payoutNote ? `<span class="tr-node-note">${
        face.payoutNote.replace('\u{1FA99}', icon('coin'))
      }</span>` : ''}
      ${status}
    `;
    return node;
  }

  // ── Hero strip, inventory, chips ───────────────────────────────────────────

  function render(): void {
    q('coins').textContent = profile.coins.toLocaleString();
    q('gems').textContent = profile.gems.toLocaleString();
    q('trophies').textContent = profile.trophies.toLocaleString();

    const progress = roadProgress(profile.trophies);
    const fill = q<HTMLDivElement>('fill');
    fill.style.width = `${(progress.progress01 * 100).toFixed(1)}%`;

    const claims = profile.claimable.length;

    // The headline states what the player should do NEXT, and "next" is not always
    // "the next node".
    //
    // Round 1 always showed the upcoming milestone here, so a player with unclaimed
    // rewards read "NEXT REWARD: Burrito — 15 to go" directly beside a lit CLAIM
    // button. A critic flagged that as "a direct logic contradiction the player has
    // to resolve themselves", and it is: the button and the headline were describing
    // two different rewards. When something is waiting, the headline says so and the
    // bar keeps the numbers; otherwise it names the next node as before.
    if (claims > 0) {
      q('nextlabel').textContent = 'Ready now';
      q('nextval').innerHTML = claims > 1
        ? `${icon('sparkle')} ${claims} road rewards to claim`
        : `${icon('sparkle')} 1 road reward — tap it on the track`;
    } else if (progress.next) {
      const nextReward = progress.next.reward;
      const face = milestoneFace(nextReward, profile.unlocked);
      const toGo = progress.next.trophies - profile.trophies;
      q('nextlabel').textContent = 'Next reward';
      q('nextval').innerHTML = `${
        nextReward.type === 'character' ? portraitMarkup(nextReward.id, { crop: 'head' })
          : nextReward.type === 'container' ? containerIcon(nextReward.kind)
          : emojiIcon(face.emoji)
      } ${face.title} <span class="tr-togo">${icon('trophy')} ${toGo.toLocaleString()} to go</span>`;
    } else {
      q('nextlabel').textContent = 'Road complete';
      q('nextval').innerHTML = `${icon('flag')} Master of the Kitchen`;
    }

    // ── THE BAR AND ITS LABEL MUST BE THE SAME QUANTITY ────────────────────────
    //
    // Third attempt, and the first one that can be checked by the person reading it.
    //
    //  * Round 3 filled the bar segment-relative and labelled it "205 / 220" — total
    //    trophies. A critic read that as claiming 93% next to a fill sitting at 51%.
    //  * Round 4 replaced the fraction with a REMAINING COUNT, "30 to next reward",
    //    which removed the contradiction by removing the check: a count has no
    //    denominator, so a bar sitting at 90% next to the number 30 cannot be
    //    reconciled by any reader. STATE.md recorded exactly that ("a progress bar
    //    reading ~100% while labelled 30 to next reward") and it is the same family
    //    as a HUD pill saying "safe" over a ring meaning "lethal".
    //
    // The fill is `progress01`, which is (trophies - from) / (to - from). So the
    // label is now literally those two numbers. 270 / 300 next to a 90% bar is a
    // statement a player can verify at a glance, and `screen_metrics.mjs` asserts
    // exactly that: |measured fill - label fraction| must stay under 0.02, with the
    // expected fraction derived INDEPENDENTLY from the road's own node thresholds.
    //
    // The actionable number — how many more trophies — did not disappear; it moved
    // up beside the reward it belongs to, in the same "N to go" vocabulary the nodes
    // on the track already use.
    q('fillxp').textContent = progress.next
      ? `${(profile.trophies - progress.from).toLocaleString()} / ${(progress.to - progress.from).toLocaleString()}`
      : `Road complete — ${roadEnd().toLocaleString()}`;

    // TWO or more, never one.
    //
    // With a single reward waiting, this button and the gold node on the track were
    // two controls doing the identical thing, and a critic could not tell which was
    // the real target. At two or more it is a distinct BULK action ("Claim 6") that
    // the track cannot offer, so it earns its place. At one, the node IS the answer.
    claimAllBtn.style.display = claims > 1 ? '' : 'none';
    claimAllBtn.innerHTML = `${icon('sparkle')} Claim ${claims}`;

    renderInventory();
  }

  /**
   * Held containers, each with a real Open button.
   *
   * When the player holds nothing this collapses to a single line telling them how
   * chests are earned — a stat, not a disabled button. An empty inventory is a
   * normal state, not an error, and it is the state a new player is in.
   */
  function renderInventory(): void {
    invEl.innerHTML = '';
    const held = CONTAINER_KINDS.filter((kind) => (profile.containers[kind] ?? 0) > 0);

    if (held.length === 0) {
      const wins = profile.winsToNextChest;
      const hint = el('p', 'tr-inv-empty');
      hint.innerHTML = `${icon('chest')} <strong>${wins}</strong> more ${wins === 1 ? 'win' : 'wins'} for a free Chest`;
      invEl.appendChild(hint);
      return;
    }

    for (const kind of held) {
      const def = CONTAINERS[kind];
      const count = profile.containers[kind] ?? 0;
      const btn = el('button', 'tr-open');
      btn.type = 'button';
      btn.dataset.open = kind;
      btn.innerHTML = `
        <span class="tr-open-em">${containerIcon(kind)}</span>
        <span class="tr-open-body">
          <span class="tr-open-name">${def.name}</span>
          <span class="tr-open-cta">Open ${tierPips(kind)}</span>
        </span>
        <span class="tr-open-count">${count}</span>
      `;
      invEl.appendChild(btn);
    }
  }

  // ── Sheets: reveal, drop rates, store ──────────────────────────────────────

  /** `variant` sizes the card. A reward reveal is a portrait-shaped celebration
   *  (the prototype capped it at 280px); a drop-rate table and a store grid are
   *  documents and want the width. Same element, two jobs. */
  function openSheet(html: string, variant: 'reveal' | 'wide' = 'wide'): void {
    sheetCard.innerHTML = html;
    sheetCard.classList.toggle('is-reveal', variant === 'reveal');
    sheet.classList.add('is-open');
  }

  function closeSheet(): void {
    sheet.classList.remove('is-open');
    sheetCard.innerHTML = '';
  }

  /**
   * Icons for a reward's lines, in exactly the order `describeReward()` emits them:
   * characters, then containers, then coins, then gems.
   *
   * Built from the `Reward` rather than from the emoji `describeReward` hands back,
   * because the model uses the SAME burger emoji for the Hamburger fighter and for
   * the Hamburger Box. An emoji lookup cannot tell those apart; the call site can,
   * and does.
   */
  function rewardIcons(reward: Reward): string[] {
    const out: string[] = [];
    for (const id of reward.characters) out.push(portraitMarkup(id, { crop: 'head' }));
    for (const [kind, n] of Object.entries(reward.containers) as [ContainerKind, number][]) {
      if (n) out.push(containerIcon(kind));
    }
    if (reward.coins > 0) out.push(icon('coin'));
    if (reward.gems > 0) out.push(icon('gem'));
    return out;
  }

  /** The prototype's reveal card, on the real model. */
  function showReward(reward: Reward, heading: string): void {
    const lines = describeReward(reward);
    if (lines.length === 0) return;
    const marks = rewardIcons(reward);
    const [lead, ...rest] = lines;
    openSheet(`
      <div class="tr-reveal">
        <div class="tr-reveal-em">${marks[0] ?? emojiIcon(lead.emoji)}</div>
        <p class="tr-reveal-kicker">${heading}</p>
        <p class="tr-reveal-name">${lead.label}</p>
        ${rest.length > 0 ? `<div class="tr-reveal-more">${
          rest.map((l, i) => `<span class="tr-reveal-chip">${marks[i + 1] ?? emojiIcon(l.emoji)} ${l.label}</span>`).join('')
        }</div>` : ''}
        <button class="fa-btn fa-btn--primary tr-sheet-close" type="button" data-el="close">Nice!</button>
      </div>
    `, 'reveal');
    hydratePortraits(sheetCard);
    burstConfetti(confetti, 50, 28);
  }

  /**
   * Published drop rates, computed from the live reward tables.
   *
   * This is a compliance surface, not a nicety: gems are (once the store is live)
   * bought with real money and buy boxes, so the box odds are real-money loot-box
   * odds and both major app stores require them to be disclosed. Every number here
   * comes from `containerOdds()`, which reads the same array `rollContainer()` rolls
   * against — there is deliberately no second copy to drift.
   */
  function showOdds(): void {
    const sections = CONTAINER_KINDS.map((kind) => {
      const def = CONTAINERS[kind];
      // The rarity colour is a SWATCH, never the ink.
      //
      // Measured on the shipped sheet: Cyber #00E5B0 on white is 1.64:1, Legendary
      // 2.08, Normal 2.76, Neon 3.20, Rare 3.81 — every single coloured row below AA,
      // on the one surface in this product that is a legal disclosure. The rarity
      // palette is authored for FILLS behind white type (see RARITY_CARD_COLORS); it
      // was never a text palette. A 10px dot carries the same channel at full chroma
      // and the label goes back to ink at 12:1.
      const rows = containerOdds(kind).map((r) => `
        <li class="tr-odds-row">
          <span class="tr-odds-what">${
            r.rarity ? `<i class="tr-odds-dot" style="background:${RARITY_COLORS[r.rarity]}"></i>` : ''
          }${r.label}</span>
          <span class="tr-odds-pct">${formatPercent(r.percent)}</span>
        </li>
      `).join('');
      const pools = containerOdds(kind)
        .filter((r) => r.pool && r.pool.length > 0)
        .map((r) => `${r.rarity}: ${r.pool!.map((id) => CHARACTERS[id].name).join(', ')}`)
        .join(' · ');
      return `
        <section class="tr-odds-block">
          <h3 class="tr-odds-title">${containerIcon(kind)} ${def.name} ${tierPips(kind, { label: true })}</h3>
          <p class="tr-odds-blurb">${def.blurb}</p>
          <ul class="tr-odds-list">${rows}</ul>
          ${pools ? `<p class="tr-odds-pool">${pools}</p>` : ''}
        </section>
      `;
    }).join('');

    openSheet(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">Drop rates</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-sheet-note">Every percentage below is read directly from the reward
        tables the game rolls against.</p>
        <p class="tr-sheet-note tr-sheet-note--rarity">${RARITY_MEANING}</p>
        ${sections}
      </div>
    `);
  }

  /**
   * The gem store — priced, modelled, and NOT AVAILABLE.
   *
   * `storeAvailable()` is false, so every product renders disabled with an explicit
   * "Coming soon" banner above them. That is deliberately different from a dead
   * control: a player is told exactly where they stand rather than tapping a live
   * looking Buy button that silently does nothing. The instant a payment processor
   * exists, `grantProduct()` in `economy/store.ts` is already written and tested.
   */
  function showStore(): void {
    const live = storeAvailable();
    const cards = storeProducts().map((p) => {
      const bonus = bonusPercent(p);
      const extras: string[] = [];
      if (p.coins) extras.push(`${icon('coin')} ${p.coins.toLocaleString()}`);
      if (p.container) {
        extras.push(`${containerIcon(p.container.kind)} ${CONTAINERS[p.container.kind].name}`);
      }
      return `
        <div class="tr-sku${p.oneTime ? ' is-featured' : ''}">
          ${bonus > 0 || p.oneTime ? `<span class="tr-sku-flags">
            ${bonus > 0 ? `<span class="tr-sku-bonus">+${bonus}%</span>` : ''}
            ${p.oneTime ? '<span class="tr-sku-bonus tr-sku-once">ONE TIME</span>' : ''}
          </span>` : ''}
          <span class="tr-sku-em">${p.container ? containerIcon(p.container.kind) : emojiIcon(p.emoji)}</span>
          <span class="tr-sku-name">${p.name}</span>
          <span class="tr-sku-gems">${icon('gem')} ${p.gems.toLocaleString()}</span>
          ${extras.length > 0 ? `<span class="tr-sku-extra">+ ${extras.join(' + ')}</span>` : ''}
          <button class="tr-sku-buy" type="button" disabled>${live ? formatPrice(p.priceUsdCents) : `${formatPrice(p.priceUsdCents)} · Soon`}</button>
        </div>
      `;
    }).join('');

    openSheet(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">${icon('gem')} Gem Store</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-soon">${icon('cone')} Purchases are not available yet — nothing here can be bought.
        Every gem in the game is earned on the Trophy Road and out of chests.</p>
        <div class="tr-skus">${cards}</div>
      </div>
    `);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  q<HTMLButtonElement>('back').addEventListener('click', () => ctx.navigate({ name: 'home' }));
  q<HTMLButtonElement>('oddsbtn').addEventListener('click', showOdds);
  q<HTMLButtonElement>('storebtn').addEventListener('click', showStore);
  q<HTMLDivElement>('scrim').addEventListener('click', closeSheet);

  claimAllBtn.addEventListener('click', () => {
    const reward = profile.claimAllMilestones();
    showReward(reward, 'You earned');
  });

  // One delegated handler for the whole screen: milestone claims, chest opens and
  // every sheet's close button. Adding a control is a data attribute, not another
  // listener to forget to remove.
  const onClick = (ev: MouseEvent): void => {
    const target = ev.target as HTMLElement;

    if (target.closest('[data-el="close"]')) { closeSheet(); return; }

    const node = target.closest<HTMLElement>('.tr-node.is-claimable');
    if (node) {
      const threshold = Number(node.dataset.trophies);
      const reward = profile.claimMilestone(threshold);
      if (reward) showReward(reward, 'You earned');
      return;
    }

    const openBtn = target.closest<HTMLElement>('[data-open]');
    if (openBtn) {
      const kind = openBtn.dataset.open as ContainerKind;
      const result = profile.openContainer(kind);
      if (result) {
        showReward(
          result.reward,
          result.duplicateOf
            ? `${CHARACTERS[result.duplicateOf].name} again — traded in`
            : `From a ${CONTAINERS[kind].name}`,
        );
      }
    }
  };
  root.addEventListener('click', onClick);

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape' && sheet.classList.contains('is-open')) closeSheet();
  };
  window.addEventListener('keydown', onKey);

  // ── Boot ───────────────────────────────────────────────────────────────────

  const unsubscribe = profile.onChange(() => { render(); renderRoad(); });
  render();
  renderRoad();
  // The shell parents `root` AFTER this factory returns, so at this point the road
  // has no layout and both `offsetLeft` and `clientWidth` are 0 — centring the pin
  // now would silently no-op. One frame later it is measurable.
  let disposed = false;
  requestAnimationFrame(() => { if (!disposed) { measureTrack(); centrePin(); } });

  // The prototype's floating trophy delta, driven by a real match instead of a
  // simulator button. `lastMatch.seen` makes it fire exactly once per match, so
  // bouncing home -> road -> home does not re-congratulate the player.
  const last = profile.lastMatch;
  if (last && !last.seen) {
    const sign = last.trophies > 0 ? '+' : '';
    deltaEl.innerHTML = `${sign}${last.trophies} ${icon('trophy')}`;
    deltaEl.className = `tr-delta is-on ${last.trophies > 0 ? 'is-up' : last.trophies < 0 ? 'is-down' : 'is-flat'}`;
    profile.markLastMatchSeen();
  }

  return {
    root,
    resize() { renderRoad(); centrePin(); },
    dispose() {
      disposed = true;
      unsubscribe();
      root.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

const CSS = `
.fa-tr .tr-heading { flex: 0 1 auto; }

.fa-tr .tr-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--gap);
  min-height: 0;
}

/* ── Hero strip ───────────────────────────────────────────────────────────── */
/* Horizontal, not the prototype's tall centred hero card. A 390px-tall landscape
   phone cannot spend 140px on a number, and the trophy count reads perfectly well at
   the left of a strip with the progress bar beside it — which also puts the count
   and the thing it is counting toward on the same line. */
.fa-tr .tr-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(10px, 2vw, 22px);
  padding: clamp(6px, 1.2vh, 12px) clamp(10px, 1.6vw, 18px);
  background: linear-gradient(180deg, #FFE9A8, var(--mustard));
  border: 3px solid var(--ink);
  border-radius: var(--radius-surface);
  box-shadow: 0 5px 0 rgba(0,0,0,0.35);
  min-height: var(--tap);
}
.fa-tr .tr-hero-count { position: relative; display: flex; align-items: center; gap: 6px; }
.fa-tr .tr-hero-em { font-size: clamp(1.1rem, 3vh, 1.8rem); line-height: 1; }
.fa-tr .tr-hero-num {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.3rem, 4.4vh, 2.6rem);
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

/* The prototype's floating delta, unchanged in behaviour: rises, fades, gone. */
.fa-tr .tr-delta {
  position: absolute;
  left: 50%;
  top: -2px;
  transform: translateX(-50%);
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.8rem, 2.2vh, 1.15rem);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
}
.fa-tr .tr-delta.is-on { animation: fa-tr-float 1.5s ease-out forwards; }
.fa-tr .tr-delta.is-up { color: #2E7D32; }
.fa-tr .tr-delta.is-down { color: var(--ketchup); }
.fa-tr .tr-delta.is-flat { color: #5a5a5a; }
@keyframes fa-tr-float {
  0% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -42px); }
}

.fa-tr .tr-hero-next { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.fa-tr .tr-nextline { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.fa-tr .tr-nextlabel {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.3vh, 0.74rem);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  /* 0.6 measured 4.28:1 on the mustard card at desktop and 2.08:1 in portrait,
     where the strip's gradient is darkest under this line. 0.82 clears AA on both. */
  color: rgba(26,18,36,0.82);
  white-space: nowrap;
}
.fa-tr .tr-nextval {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.7vh, 0.95rem);
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
/* Reuses the level bar from theme.ts rather than inventing a second progress
   treatment — one meaning, one component. */
.fa-tr .tr-track { height: clamp(16px, 2.4vh, 22px); }
/* Deliberately NOT gold. Round 1 filled a cream trough on a mustard card with a
   gold stripe, and a critic measured the single most important pixel on the bar —
   the fill boundary — as "nearly invisible". Green is the project's progress colour
   everywhere else (the level bar, the road spine), so this is one meaning, one
   colour, and a boundary you can actually see. */
.fa-tr .tr-fill {
  background: repeating-linear-gradient(45deg, var(--lettuce) 0 10px, #9BE03A 10px 20px);
}

/* Only rendered when there IS something to claim. A permanently visible, mostly
   disabled CLAIM button is the exact shape of control both menu critics punished. */
.fa-tr .tr-claimall { flex: 0 0 auto; }

/* ── The road ─────────────────────────────────────────────────────────────── */
/* The panel HUGS the track instead of stretching to the row.
   A 34-node strip pinned to the top of a 640px cream slab is the same defect two
   critics have already named on this project's other screens: the empty two-thirds
   reads as an unfinished build, not as breathing room. Hugging it turns the road
   into a deliberate band with the warm backdrop above and below — which is what the
   backdrop is for. */
/* Round 2 hugged the track, which fixed an empty cream slab but produced its own
   defect: a critic measured the result as "a strip of UI floating on a gradient",
   with under half the canvas doing any work. So the panel fills the row again — but
   the track inside it is now tall enough (two staggered lanes of full-size nodes)
   that the remaining cream reads as the panel's own padding rather than as a void.
   Both failure modes have now been observed on this screen; this is the middle. */
.fa-tr .tr-roadwrap { min-height: 0; }
/* The ONE scrolling axis on this screen, and it is horizontal. Overrides .fa-scroll's
   vertical default; higher specificity, so injection order does not matter. */
.fa-tr .tr-road {
  display: block;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  /* Both ends of a 34-node track are always mid-node. Hard-clipped, a critic read
     that as "broken layout rather than scrollable content" — a fade is the standard
     idiom that turns the same clip into an affordance, and unlike a chevron button
     it cannot become a control that does nothing. */
  height: 100%;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%);
}
.fa-tr .tr-road::-webkit-scrollbar { height: 8px; }

/* How far a node sits off the road line. Half a node's height, so the node's inner
   edge lands ON the line — which is what makes the medallions read as beads on a
   string rather than as two unrelated rows. */
.fa-tr .tr-roadtrack {
  /* Scales hard with viewport HEIGHT: on a 390px landscape phone the two rows have
     to nest inside ~190px, and on a 900px desktop the band should command the frame
     rather than float in it. Everything else on this track is sized off the same
     axis for the same reason. */
  --stagger: clamp(30px, 12.5vh, 112px);
  position: relative;
  display: flex;
  align-items: center;
  width: max-content;
  min-width: 100%;
  min-height: 100%;
  padding: calc(var(--stagger) + clamp(6px, 1.2vh, 12px)) 20px;
}

/* The road itself: ONE line for the whole journey, drawn once. */
.fa-tr .tr-spine {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 6px;
  transform: translateY(-50%);
  background: rgba(26,18,36,0.15);
  border-radius: 3px;
  /* ABOVE the nodes, deliberately. Each node drops a stem toward the road (below)
     whose exact length cannot be expressed in CSS — the gap is
     "stagger minus half the node's own height", and the node's height is content.
     So the stems are drawn deliberately too long and the road paints over the
     overshoot. Costs one z-index; saves measuring every node in JavaScript. */
  z-index: 2;
}
/* Filled up to the pin. Width is measured off the pin's real position rather than
   counted in nodes, so the fill and the marker cannot disagree. */
.fa-tr .tr-spine-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--lettuce), #A6E24A);
  transition: width 0.4s ease-out;
}

.fa-tr .tr-node {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: clamp(84px, 12vw, 132px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0 4px;
  text-align: center;
  background: none;
  border: none;
  font-family: inherit;
  color: var(--ink);
}
/* Alternate above and below the line.
   Offset with "top" rather than with a transform, deliberately: the hover and press
   states own the transform, and a relative "top" offsets the paint without touching
   layout — so the flex row still measures every node identically. column-reverse on
   the upper side keeps the threshold label adjacent to the road on BOTH sides, so
   the two rows are mirror images instead of two different designs.

   (This comment cost a dev-server outage the first time it was written: a backtick
   inside a CSS template literal terminates the string and 500s the whole app. Never
   quote an identifier with backticks below this line.) */
.fa-tr .tr-node.is-high { flex-direction: column-reverse; top: calc(-1 * var(--stagger)); }
.fa-tr .tr-node.is-low { top: var(--stagger); }

/* The stem. A blind critic could not reconstruct the reading order of the two lanes
   without parsing the trophy numbers — "nothing visually connects a node to the
   rail". This is that connection: every node is tied to a specific point on the
   road, so the zigzag reads as one sequence instead of two rows. It also carries the
   node's state, so the road, the stem and the medallion all agree at a glance. */
.fa-tr .tr-node::before {
  content: '';
  position: absolute;
  left: calc(50% - 3px);
  width: 6px;
  /* Set by measureTrack() after layout. 0 until then, so a stem is never drawn at
     the wrong length even for one frame. */
  height: var(--stem, 0px);
  background: rgba(26,18,36,0.15);
  border-radius: 3px;
}
.fa-tr .tr-node.is-high::before { top: 100%; }
.fa-tr .tr-node.is-low::before { bottom: 100%; }
.fa-tr .tr-node.is-claimed::before { background: var(--lettuce); }
.fa-tr .tr-node.is-claimable::before { background: var(--gold); }

.fa-tr .tr-node-req {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.6vh, 0.86rem);
  color: rgba(26,18,36,0.85);
  white-space: nowrap;
}
.fa-tr .tr-node-medal {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(38px, 10vh, 96px);
  height: clamp(38px, 10vh, 96px);
  border-radius: 50%;
  background: #FFFFFF;
  border: 3px solid var(--ink);
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
.fa-tr .tr-node-em { font-size: clamp(1rem, 5vh, 3rem); line-height: 1; }
/* A character node is the reason the road exists, so it gets a bigger medallion and
   its rarity — but the rarity lives on the RING, never on the fill.
   Round 1 painted the rarity straight onto the medallion background, which put
   Soup's Epic purple and Burrito's Rare blue into the same visual channel as the
   claimed/claimable/locked STATE colours. A blind critic could not tell the two
   systems apart and called it out as the node states "not reading as a system".
   Fill = state. Ring = rarity. Two channels, never crossed. */
.fa-tr .tr-node.is-character .tr-node-medal {
  width: clamp(44px, 11.5vh, 104px);
  height: clamp(44px, 11.5vh, 104px);
  box-shadow:
    0 0 0 4px var(--node-accent, var(--mustard)),
    0 3px 0 rgba(0,0,0,0.35),
    0 0 16px var(--node-glow, transparent);
}
/* Every non-character icon gets its own cream field inside a CLAIMABLE node.
   Three separate blind critics reported that the coin on the trophy road "does not
   match" the coin in the top-bar chip. It is the identical SVG; what differs is what
   is behind it. A claimable node fills gold, so a gold coin on it is a same-hue,
   same-value collision — and it happens in precisely the state the player is supposed
   to be drawn to. The medal keeps its gold FILL (fill = state, ring = rarity, which is
   a contract an earlier critic round established), and the icon gets a disc of its own
   inside it, so the mark reads identically at every node state and at every size. */
.fa-tr .tr-node.is-claimable:not(.is-character) .tr-node-em {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76%;
  height: 76%;
  border-radius: 50%;
  background: #FFF8EA;
  box-shadow: inset 0 0 0 2px rgba(26,18,36,0.22);
}

/* A character node's portrait FILLS its medallion.
   Round 1 dropped a whole standing body into a 50px box inside a 96px white ring,
   and a blind critic called the result an unreadable smear — correctly: the character
   was about 40px tall inside a widget twice that size, with the rest of the medal
   spent on empty fill. Head-cropped and edge-to-edge, the same widget becomes the
   fighter medallion the reference uses, and the medal's own ring keeps carrying
   rarity exactly as before. */
.fa-tr .tr-node.is-character .tr-node-em {
  display: flex;
  width: 100%;
  height: 100%;
  font-size: 0;
}
.fa-tr .tr-node.is-character .tr-node-em .fa-ic-portrait { width: 100%; height: 100%; }
.fa-tr .tr-node.is-character .tr-node-medal { overflow: hidden; }
/* Keep the claimed-state tick outside the clipped medal. */
.fa-tr .tr-node.is-character.is-claimed .tr-node-medal { overflow: visible; }

/* THREE node states, and only three.
   locked    = cream fill, quiet
   claimable = gold fill + pulsing gold halo (below)
   claimed   = desaturated and dimmed, with a tick. Round 1 filled claimed nodes
               with the same green the road uses for progress, which made a wall of
               green compete with the ONE gold node the player should be tapping.
               The filled spine already carries "how far I have come". */
/* ── "Claimed" is dimmed BY PART, never by a layer opacity ───────────────────
   This used to be a 0.78 layer opacity on the whole node, which is the single most
   expensive line this screen had. A container opacity composites the type together
   with its own plate, so it lowers the contrast of every run underneath it and no
   computed style anywhere reports that it happened: the threshold labels measured
   3.87-4.34:1 and the Claimed pill 2.02:1, all of them below AA, all of them looking
   correct in the source. It is precisely the "inherited opacity" case
   screen_metrics.mjs had to be built to see.

   The state reads exactly as before — grey medal, desaturated icon, quieter title,
   green tick — because those were always what carried it. The layer opacity was
   carrying nothing except the contrast loss. */
.fa-tr .tr-node.is-claimed .tr-node-medal { background: #E6DAC4; }
.fa-tr .tr-node.is-claimed .tr-node-em { filter: grayscale(0.55); opacity: 0.85; }
.fa-tr .tr-node.is-claimed .tr-node-title { color: rgba(26,18,36,0.66); }
.fa-tr .tr-node.is-claimed .tr-node-req { color: rgba(26,18,36,0.82); }
.fa-tr .tr-node.is-claimed .tr-tier { opacity: 0.6; }
.fa-tr .tr-node-tick {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(16px, 2.6vh, 24px);
  height: clamp(16px, 2.6vh, 24px);
  background: var(--lettuce);
  --fa-ic-ink: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-size: clamp(0.6rem, 1.6vh, 0.86rem);
  z-index: 2;
}
.fa-tr .tr-node.is-claimable .tr-node-medal {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  /* Physically larger, not just brighter. A critic could not tell which of the two
     claim affordances was the real target; the on-track node is the one the reward
     visually lives on, so it gets the size. */
  transform: scale(1.14);
}

.fa-tr .tr-node-title {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.9vh, 1rem);
  line-height: 1.15;
  max-width: 100%;
}
.fa-tr .tr-node-note {
  font-size: clamp(0.69rem, 1.3vh, 0.74rem);
  line-height: 1.15;
  font-weight: 700;
  color: rgba(26,18,36,0.82);
}
.fa-tr .tr-status {
  margin-top: 2px;
  padding: 2px 8px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: #FFFFFF;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.35vh, 0.76rem);
  white-space: nowrap;
  color: var(--ink);
}
/* White on '--lettuce' is 2.47:1 before the node's own dimming and measured 2.02:1
   after — the worst run on the screen, repeated once per claimed node (eight of them
   at desktop). Ink on the identical green is 7.0:1 and it matches the ready pill's
   ink beside it, so the two status colours now differ by HUE alone, which is the
   distinction the design was already making. */
.fa-tr .tr-status.is-done {
  background: var(--lettuce);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
}
.fa-tr .tr-status.is-ready { background: var(--gold); color: var(--ink); }
/* The pill holds an icon plus a word now, not a glyph plus a word. */
.fa-tr .tr-status { display: inline-flex; align-items: center; gap: 4px; }

/* ── Container rank ───────────────────────────────────────────────────────────
   Five pips, filled up to this box's position in the ladder, tinted with the rarity
   it bottoms out at. Deliberately NOT another badge: the node already carries a
   threshold, a medal, a title and a status pill, and a sixth labelled object would
   make the node the busiest thing on a screen whose subject is the road. A pip row
   is readable at 3px per dot and is the one thing on the node that answers "is this
   one better than that one". */
.fa-tr .tr-tier {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1;
}
/* The rarity-meaning line on the drop-rate sheet. Slightly stronger than the note above
   it because it is the sentence that stops the sheet implying rarity is power — a claim
   the game made until 2026-08-05 and no longer does. */
.fa-tr .tr-sheet-note--rarity {
  margin-top: 6px;
  font-weight: 700;
  color: var(--ink);
}

.fa-tr .tr-pip {
  width: clamp(4px, 0.8vh, 6px);
  height: clamp(4px, 0.8vh, 6px);
  border-radius: 50%;
  background: rgba(26,18,36,0.16);
  box-shadow: inset 0 0 0 1px rgba(26,18,36,0.28);
}
.fa-tr .tr-pip.is-on {
  background: var(--pip, var(--ink));
  box-shadow: inset 0 0 0 1px rgba(26,18,36,0.55);
}
.fa-tr .tr-tier-txt {
  margin-inline-start: 5px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.78rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(26,18,36,0.72);
}

/* Claimable nodes are the only interactive thing on the track, so they get the whole
   press vocabulary the rest of the menu uses — and a pulse, because a reward waiting
   to be collected is the single most important thing on this screen. */
.fa-tr .tr-node.is-claimable {
  cursor: pointer;
  min-height: var(--tap);
  transition: transform 0.1s;
}
.fa-tr .tr-node.is-claimable .tr-node-medal {
  animation: fa-tr-pulse 1.5s ease-in-out infinite;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 5px rgba(244,163,0,0.5), 0 0 20px rgba(244,163,0,0.6);
}
.fa-tr .tr-node.is-claimable:hover { transform: translateY(-3px); }
.fa-tr .tr-node.is-claimable:active { transform: translateY(2px); }
@keyframes fa-tr-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.09); }
}

/* "You are here". The prototype's pin, kept exactly — it is the one element that
   tells a player where they sit on a 34-node track without reading any numbers. */
.fa-tr .tr-pin {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  width: clamp(52px, 7vw, 74px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.fa-tr .tr-pin-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(40px, 6.4vh, 62px);
  height: clamp(40px, 6.4vh, 62px);
  border-radius: 50%;
  background: var(--ketchup);
  border: 4px solid var(--ink);
  font-size: clamp(1.05rem, 3.2vh, 1.8rem);
  /* Gold halo rather than a red one. On a green-to-grey rail a red glow reads as an
     error state; gold is the colour this screen already uses for "yours / active",
     and the marker was measured as the weakest element on its own screen. */
  box-shadow: 0 0 0 5px rgba(244,163,0,0.55), 0 0 18px rgba(244,163,0,0.5), 0 3px 0 rgba(0,0,0,0.4);
  animation: fa-tr-pulse 1.5s ease-in-out infinite;
}
.fa-tr .tr-pin-label {
  padding: 2px 9px;
  background: var(--ink);
  color: var(--cream);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  white-space: nowrap;
}

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
.fa-tr .tr-bottom {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.6vw, 16px);
  min-height: var(--tap);
}
.fa-tr .tr-inventory {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.fa-tr .tr-inventory::-webkit-scrollbar { display: none; }
.fa-tr .tr-bottom-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

/* ── THE ORANGE PLATE IS SPENT. This is the move the size pass named and deferred ──
   The block further down ('WHAT THE SPACE WAS TAKEN FROM') closes with:

     "the plate is still available and giving this hint the same cream pill '.tr-open'
      already uses is the cheap move."

   It has now been measured twice by an icon pass and it is not optional. Every fill
   this glyph draws with, against its own backdrop:

     on the saturated orange   1.80 · 1.18 · 1.81 · 2.45      (the ink outline 4.82)
     on this cream pill        5.77 · 3.79 · 1.77 · 1.31 · 15.48

   NOT ONE FILL CLEARED 2:1 ON THE ORANGE. The '-webkit-text-stroke: 2px' that used to
   be here existed only to rescue legibility on that plate — an ink box drawn around
   every letterform because the letterform itself could not be seen. On a cream pill it
   is unnecessary, so it goes with the plate rather than being left behind as a habit.

   🚨 AND THERE IS A RECORD TO CORRECT. An earlier pass's commit message ('620bf7f')
   CLAIMED this hint had already moved to the cream chip. It never landed. A later round
   was then judged against a spec that recorded the chip while the game shipped the
   orange — i.e. there is a measurement on file for a plate that did not exist. Landing
   it is what makes that record true, which is why this is a fix and not a preference.

   The plate is '.tr-open''s, character for character, because these two are the same
   row in the same bar and the empty state should be the full state minus its contents.
   'strong' takes '--ketchup-ink' rather than '--mustard' for the reason stated on
   '.tr-open-cta' twenty lines below: on THIS gradient '--ketchup' measures 4.17:1 and
   '--ketchup-ink' 5.9:1 — mustard on cream is nearer 1.3 and was never a candidate once
   the backdrop changed. '--fa-ic-ink' is set for the same reason the active tab sets it:
   the chest glyph inherits its ink from that token, and a token left on cream would put
   a cream chest on a cream pill.

   ⚠️ This is a fix routed in from an icon pass that could not reach this file. It is
   local to '.tr-inv-empty': no shared token moves, so the blast radius is this rule. */
.fa-tr .tr-inv-empty {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-height: var(--tap);
  padding: 0 12px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
  white-space: nowrap;
}
.fa-tr .tr-inv-empty strong { color: var(--ketchup-ink); }

/* A held container is a button, always. There is no state in which one of these is
   drawn and cannot be opened — the row is built from what the player actually holds. */
.fa-tr .tr-open {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-height: var(--tap);
  padding: 0 10px 0 8px;
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  color: var(--ink);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-tr .tr-open:hover { filter: brightness(1.05); }
.fa-tr .tr-open:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }
.fa-tr .tr-open-em { font-size: 1.3rem; line-height: 1; }
.fa-tr .tr-open-body { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
.fa-tr .tr-open-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
  white-space: nowrap;
}
.fa-tr .tr-open-cta {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.2vh, 0.72rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 5px;
  /* --ketchup as INK on this pill's cream gradient measured 4.17:1. See the token's
     comment in theme.ts: same hue, value dropped, 5.9:1. */
  color: var(--ketchup-ink);
}
.fa-tr .tr-open-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: var(--ketchup);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 0.7rem;
}

.fa-tr .tr-odds { font-size: clamp(0.69rem, 1.4vh, 0.8rem); }

/* ── THE GLYPH IS UNCOUPLED FROM ITS LABEL'S FONT-SIZE AT FOUR SITES ──────────
   🔴 'chest' AND 'boxBurger' WERE A DELIVERED-SIZE DEFECT, AND THIS FILE OWNS THE SIZE.

   Both glyphs carry the identical signature across every blind round ever run:
   **0 of 3 native on every arm ever drawn, 3 of 3 magnified.** Six drawing variables
   moved 'boxBurger' by Δ +0 each ('13fb98c', 'a77ff30'); both of 'chest''s in-file
   variables are spent — ink budget Δ +0/+0 and a plate-value move Δ +0 native and −2
   MAGNIFIED ('7f71f20'). Two glyphs failing the same way at 11.0–11.8 px and passing at
   magnification is a size result, not a drawing one, and every icon here is
   'width: 1em' on an '<svg>', so its size is whatever its LABEL's font-size happens to
   be. That is the whole bug: a 24-unit drawing with five stacked outlined shapes was
   being asked to survive at the size of the 11px caption beside it.

   'characterSelect.ts:1047' had already reached the same conclusion from the other end
   and shipped this exact mechanism — *"the glyph runs a little larger than its own text.
   11px was measured to be below the floor for any mark with internal structure."*

   ── WHERE 16 px COMES FROM. It is measured, and it is a POPULATION, not a promise ──
   Pooled over the two most recent native panels (r8 seed 13 + r9 seed 21, shipped arms
   only, 3 blind judges each), joined to 'shots/ic/spec.json''s delivered px:

       < 12 px   16 icons   59.8 %          14 – 17 px    4 icons   95.8 %
      12 – 14    11 icons   72.7 %          17 – 21       4 icons   96.7 %

   ⚠️ Bigger sites may host simpler glyphs, so this is a trend and not a controlled
   experiment; it is read as "aim for >=16 px", never as "16 px guarantees a read". The
   controlled half is the paired plate, which is what actually decided this change.

   ── WHAT THE SPACE WAS TAKEN FROM, MEASURED ('tools/tmp/si_fit.mjs') ─────────
   Delivered px at 844x390 / 1280x800 / 390x844, and the cost of each:

     .tr-odds         11.03 -> 16.55   11.19 -> 16.80   11.81 -> 17.72   FREE
                      the button is 'height: var(--tap)', so this costs zero height and
                      a few px of width in a bottom bar whose inventory row scrolls.
     .tr-inv-empty    11.03 -> 16.55   12.00 -> 18.00   12.66 -> 18.98
                      line box 13 -> 17.08. '.tr-bottom' is 'min-height: var(--tap)' and
                      absorbs it whole in landscape (44 -> 44); in PORTRAIT the bar
                      stacks and grows 67 -> 71.14, which comes out of '.tr-body', i.e.
                      out of the road panel, which is a scroller.
     .tr-nextval      11.52 -> 16.70   13.59 -> 19.72   14.34 -> 20.80
                      the only site with a real bill: '.tr-nextline' 14 -> 17.2 grows
                      '.tr-hero' 51 -> 54.2, and the hero takes its height out of the
                      road below it — '.tr-road''s vertical overflow goes 7px -> 10px at
                      844x390. It was ALREADY a scroller in both axes (2731px across).
     .tr-odds-title   11.83 -> 17.16   14.39 -> 20.88   15.03 -> 21.80
                      five titles in the drop-rates sheet; '.tr-sheet-scroll' goes
                      609 -> 625 / 232 -> 251 / 367 -> 401 px of scroll. Already a
                      scroller by construction.

   🔴 NOTHING WAS TAKEN FROM ANY TEXT. 'scrollWidth - clientWidth' on '.tr-nextval',
   '.tr-inv-empty', '.tr-odds' and '.tr-odds-title' is **0 before and 0 after at all
   three viewports** — not one run ellipsised — and no icon left its clipping ancestor.

   ⚠️ AND THE PLATE WAS THE OTHER CANDIDATE VARIABLE AND IS NOT SPENT. '.tr-inv-empty'
   is the only glyph in the game on a saturated orange plate, and every fill this glyph
   uses fails 2:1 against it (wood 1.88, woodHi 1.24, gold 1.73; the ink outline is
   5.05). That was NOT changed here: at 16.55 px the domed lid, the gold band and the
   clasp resolve on the orange anyway — read in 'shots/si/fit1/crop-inv-after.png' — so
   the size alone answered it. If a later round needs more, the plate is still available
   and giving this hint the same cream pill '.tr-open' already uses is the cheap move.

   🔵 THE PLATE IS NOW SPENT — a later round did need more. See the block on
   '.tr-inv-empty' above: the orange went, the cream pill landed, and the
   '-webkit-text-stroke' that was propping it up went with it. This paragraph is kept
   because it is the one that correctly identified the remaining variable and named the
   exact remedy; the only thing it got wrong was expecting not to need it.

   ⚠️ '.fa-ic-portrait' is listed with '.fa-ic' on '.tr-nextval' on purpose: when the
   next reward is a CHARACTER that slot renders a portrait, and scaling only one of the
   two would make the same slot two different sizes depending on what is next. */
.fa-tr .tr-odds .fa-ic { font-size: 1.5em; }
.fa-tr .tr-inv-empty .fa-ic { font-size: 1.5em; }
.fa-tr .tr-nextval .fa-ic,
.fa-tr .tr-nextval .fa-ic-portrait { font-size: 1.45em; }
.fa-tr .tr-odds-title .fa-ic { font-size: 1.45em; }

/* ── Sheets (reveal / drop rates / store) ─────────────────────────────────── */
.fa-tr .tr-sheet {
  position: absolute;
  inset: 0;
  z-index: 95;
  display: none;
  align-items: center;
  justify-content: center;
  padding: calc(var(--fa-safe-t) + 10px) calc(var(--fa-safe-r) + 12px)
           calc(var(--fa-safe-b) + 10px) calc(var(--fa-safe-l) + 12px);
}
.fa-tr .tr-sheet.is-open { display: flex; }
.fa-tr .tr-sheet-scrim { position: absolute; inset: 0; background: rgba(10,6,16,0.66); }
/* Confetti defaults to z-index 90 in theme.ts, which is UNDER this screen's sheet —
   so a reward reveal would burst confetti behind its own scrim. It is the only
   screen with a scrim above that layer, so the fix is local. */
.fa-tr .fa-confetti-layer { z-index: 110; }
.fa-tr .tr-sheet-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(560px, 100%);
  max-height: 100%;
  padding: clamp(12px, 2.4vh, 22px);
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: 22px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 22px 44px rgba(0,0,0,0.5);
  animation: fa-tr-pop 0.28s cubic-bezier(0.2, 1.5, 0.4, 1);
  min-height: 0;
}
@keyframes fa-tr-pop {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: none; }
}
.fa-tr .tr-sheet-head { display: flex; align-items: center; gap: 10px; }
.fa-tr .tr-sheet-title {
  margin: 0;
  flex: 1 1 auto;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.92rem, 2.4vh, 1.3rem);
}
.fa-tr .tr-sheet-x { min-width: var(--tap); padding: 0; }
.fa-tr .tr-sheet-scroll { display: flex; flex-direction: column; gap: 10px; min-height: 0; padding-inline-end: 4px; }
.fa-tr .tr-sheet-note, .fa-tr .tr-soon {
  margin: 0;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  font-weight: 700;
  line-height: 1.35;
  color: #4E2C1B;
}
/* The honest label. Loud enough that nobody taps a price expecting a checkout. */
.fa-tr .tr-soon {
  padding: 9px 12px;
  background: var(--mustard);
  border: 3px solid var(--ink);
  border-radius: 12px;
  font-weight: 700;
  color: var(--ink);
}

/* Reveal */
.fa-tr .tr-sheet-card.is-reveal {
  width: min(340px, 100%);
  padding: clamp(16px, 3.2vh, 30px) clamp(18px, 2.4vw, 30px);
}
.fa-tr .tr-reveal { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.fa-tr .tr-reveal-em { font-size: clamp(3rem, 12vh, 5.6rem); line-height: 1; margin-bottom: 4px; }
.fa-tr .tr-reveal-em .fa-ic-portrait {
  border: 3px solid var(--ink);
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
/* Every chip in a multi-line reward, and every held-container button, is a dark or
   mid-tone plate; the icons' ink outline has to flip there or it vanishes into the
   plate. This is the dark-on-dark failure this project has now shipped three times. */
.fa-tr .tr-reveal-chip { --fa-ic-ink: #FFF3DE; }
.fa-tr .tr-reveal-kicker {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  /* Measured 4.49:1 against a 4.5 floor — one hundredth short, which is exactly the
     kind of number a critic never finds and an instrument always does. */
  color: rgba(26,18,36,0.75);
}
.fa-tr .tr-reveal-name {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.1rem, 3.4vh, 1.8rem);
  color: var(--ink);
}
.fa-tr .tr-reveal-more { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 4px; }
.fa-tr .tr-reveal-chip {
  padding: 3px 10px;
  background: var(--ink);
  color: var(--cream);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.58rem, 1.4vh, 0.74rem);
}
.fa-tr .tr-sheet-close { margin-top: clamp(10px, 2.2vh, 20px); align-self: center; }

/* Drop rates */
.fa-tr .tr-odds-block {
  padding: 9px 11px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 12px;
}
.fa-tr .tr-odds-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.74rem, 1.8vh, 0.94rem);
  display: flex;
  align-items: center;
  gap: 7px;
}
.fa-tr .tr-odds-blurb { margin: 2px 0 6px; font-size: clamp(0.69rem, 1.35vh, 0.76rem); font-weight: 600; color: #4E2C1B; }
.fa-tr .tr-odds-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.fa-tr .tr-odds-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
}
.fa-tr .tr-odds-what { font-weight: 700; display: flex; align-items: center; gap: 7px; }
/* The rarity channel, moved off the ink and onto a swatch — see showOdds(). */
.fa-tr .tr-odds-dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid rgba(26,18,36,0.55);
}
.fa-tr .tr-odds-pct {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.fa-tr .tr-odds-pool { margin: 6px 0 0; font-size: clamp(0.69rem, 1.25vh, 0.74rem); font-weight: 600; color: rgba(26,18,36,0.7); }

/* Store */
.fa-tr .tr-skus { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px; }
.fa-tr .tr-sku {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 8px 8px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 14px;
  text-align: center;
}
.fa-tr .tr-sku.is-featured { background: linear-gradient(180deg, #FFE9A8, var(--mustard)); }
/* Both badges in ONE positioned row.
   They were each absolutely positioned at the same 'top: -8px; inset-inline-end: 6px',
   so on the starter bundle — the only SKU that carries both — the green bonus badge
   and the red ONE TIME badge were stacked exactly on top of each other. Measured as a
   3.65:1 run: ink on ketchup, which is a combination this file never authored. */
.fa-tr .tr-sku-flags {
  position: absolute;
  top: -8px;
  inset-inline-end: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fa-tr .tr-sku-bonus {
  padding: 2px 8px;
  background: var(--lettuce);
  /* White on lettuce is 2.47:1 — the same defect as the claimed status pill, and it
     is carrying a percentage a buyer is meant to compare. */
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 0.7rem;
}
.fa-tr .tr-sku-once { background: var(--ketchup); color: #FFFFFF; }
.fa-tr .tr-sku-em { font-size: 1.6rem; line-height: 1; }
.fa-tr .tr-sku-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.78rem);
}
.fa-tr .tr-sku-gems {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.72rem, 1.8vh, 0.92rem);
  /* 3.48:1 on the white cards and 2.56:1 on the mustard starter card as '--water'.
     Same hue at a value that survives being type — see theme.ts. */
  color: var(--water-ink);
}
.fa-tr .tr-sku-extra { font-size: clamp(0.69rem, 1.2vh, 0.72rem); font-weight: 600; color: #4E2C1B; }
/* Disabled on purpose and permanently, until a payment processor exists. It reads
   as unavailable rather than as broken, and it carries the price so the offer is
   still legible. */
.fa-tr .tr-sku-buy {
  width: 100%;
  /* Pushed to the bottom so the price row lines up across cards of different
     heights — the starter bundle carries two extra lines the gem packs do not. */
  margin-top: auto;
  padding-top: 6px;
  min-height: 30px;
  padding: 0 8px;
  background: #DCD3C4;
  border: 2.5px solid rgba(26,18,36,0.5);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.3vh, 0.74rem);
  color: rgba(26,18,36,0.72);
  cursor: not-allowed;
}

/* ── Landscape phone ──────────────────────────────────────────────────────── */
/* Height is the binding constraint at 844x390. The heading and the next-reward
   caption are the two things whose absence costs the least: the road itself already
   names every reward, and the trophy count is the headline. */
@media (max-height: 460px) {
  .fa-tr .tr-heading { display: none; }
  .fa-tr .tr-nextlabel { display: none; }
  .fa-tr .tr-node-note { display: none; }
  /* The CLAIMED pill goes too, and only the claimed one.
     Raising every label to an 11px floor added ~9px to each node, which at 390px tall
     pushed the two lanes into the rail between them — the threshold captions were
     measured sitting ON the green spine at 3.2:1 — and pushed the lower lane's pills
     through the bottom of the panel. Something had to leave, and the claimed pill is
     the one line on the node that is pure duplication: the medal beside it is already
     grey, its icon is already desaturated and it already carries a green tick. The
     gold "Claim" and the "N to go" countdown both stay, because those are the two
     states the player can still act on. */
  .fa-tr .tr-status.is-done { display: none; }
  .fa-tr .tr-node { gap: 2px; }
}

/* Portrait phone. The bottom bar wraps rather than crushing the inventory. */
@media (max-width: 700px) {
  .fa-tr .tr-hero { flex-wrap: wrap; }
  .fa-tr .tr-hero-next { flex-basis: 100%; order: 3; }
  .fa-tr .tr-bottom { flex-wrap: wrap; }
}

/* ── Narrow portrait ──────────────────────────────────────────────────────────
   With '.fa-screen > * { min-width: 0 }' in theme.ts the top bar can finally shrink,
   and what it shrinks is the one item that carries no information the screen does
   not already give: the heading. At 430px the bar is Back + "Trophy Road" at 28px +
   two currency chips = 490px of content, so leaving the title in means either
   ellipsising it to "Trophy R..." or squeezing the counts the player came here to
   read. The hero strip below is a trophy icon beside a four-digit number above a
   road made of trophy thresholds; nobody arrives here unsure what screen they are on.
   Same reasoning as the existing max-height rule, on the other axis. */
@media (max-width: 520px) {
  .fa-tr .tr-heading { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .fa-tr .tr-pin-dot,
  .fa-tr .tr-node.is-claimable .tr-node-medal,
  .fa-tr .tr-sheet-card,
  .fa-tr .tr-delta { animation: none !important; }
  .fa-tr .tr-road { scroll-behavior: auto; }
}
`;
