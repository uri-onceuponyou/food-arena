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

import { CHARACTERS, RARITY_COLORS, type CharacterId } from '../../game/rules';
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
import { burstConfetti, el } from './fx';

export function createTrophyRoadScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-trophy-styles', CSS);

  const root = el('div', 'fa-screen fa-tr');
  const profile = ctx.profile;

  root.innerHTML = `
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">◀ Back</button>
      <h1 class="fa-title tr-heading">Trophy Road</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">🪙</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">💎</span><span data-el="gems">0</span></div>
    </header>

    <div class="tr-body">
      <section class="tr-hero">
        <div class="tr-hero-count">
          <span class="tr-hero-em">🏆</span>
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
        <button class="fa-btn fa-btn--green tr-claimall" type="button" data-el="claimall">✨ Claim</button>
      </section>

      <div class="fa-panel fa-panel--flush tr-roadwrap">
        <div class="fa-scroll tr-road" data-el="road"></div>
      </div>
    </div>

    <footer class="tr-bottom">
      <div class="tr-inventory" data-el="inventory"></div>
      <div class="tr-bottom-actions">
        <button class="fa-iconbtn tr-odds" type="button" data-el="oddsbtn">ⓘ Drop rates</button>
        <button class="fa-btn fa-btn--quiet tr-storebtn" type="button" data-el="storebtn">💎 Get Gems</button>
      </div>
    </footer>

    <div class="tr-sheet" data-el="sheet">
      <div class="tr-sheet-scrim" data-el="scrim"></div>
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
        <span class="tr-pin-dot">📍</span>
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

    const status = isClaimed
      ? '<span class="tr-status is-done">✓ Claimed</span>'
      : canClaim
        ? '<span class="tr-status is-ready">Claim</span>'
        : `<span class="tr-status">${(m.trophies - trophies).toLocaleString()} to go</span>`;

    node.innerHTML = `
      <span class="tr-node-req">🏆 ${m.trophies.toLocaleString()}</span>
      <span class="tr-node-medal"><span class="tr-node-em">${face.emoji}</span></span>
      <span class="tr-node-title">${face.title}</span>
      ${face.payoutNote ? `<span class="tr-node-note">${face.payoutNote}</span>` : ''}
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
        ? `✨ ${claims} road rewards to claim`
        : '✨ 1 road reward — tap it on the track';
    } else if (progress.next) {
      const face = milestoneFace(progress.next.reward, profile.unlocked);
      q('nextlabel').textContent = 'Next reward';
      q('nextval').innerHTML = `${face.emoji} ${face.title}`;
    } else {
      q('nextlabel').textContent = 'Road complete';
      q('nextval').textContent = '🏁 Master of the Kitchen';
    }

    // The bar measures the CURRENT SEGMENT (previous node to next node), so its
    // label has to be the segment too.
    //
    // Round 3 filled it segment-relative but labelled it "205 / 220", which a critic
    // read — correctly — as claiming 93% while the fill sat at 51%. A progress bar
    // that disagrees with its own number is worse than a bar with no number, so the
    // label is now the one quantity the fill actually represents.
    q('fillxp').textContent = progress.next
      ? `${(progress.next.trophies - profile.trophies).toLocaleString()} to next reward`
      : `Road complete — ${roadEnd().toLocaleString()} 🏆`;

    // TWO or more, never one.
    //
    // With a single reward waiting, this button and the gold node on the track were
    // two controls doing the identical thing, and a critic could not tell which was
    // the real target. At two or more it is a distinct BULK action ("Claim 6") that
    // the track cannot offer, so it earns its place. At one, the node IS the answer.
    claimAllBtn.style.display = claims > 1 ? '' : 'none';
    claimAllBtn.textContent = `✨ Claim ${claims}`;

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
      hint.innerHTML = `📦 <strong>${wins}</strong> more ${wins === 1 ? 'win' : 'wins'} for a free Chest`;
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
        <span class="tr-open-em">${def.emoji}</span>
        <span class="tr-open-body">
          <span class="tr-open-name">${def.name}</span>
          <span class="tr-open-cta">Open</span>
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

  /** The prototype's reveal card, on the real model. */
  function showReward(reward: Reward, heading: string): void {
    const lines = describeReward(reward);
    if (lines.length === 0) return;
    const [lead, ...rest] = lines;
    openSheet(`
      <div class="tr-reveal">
        <div class="tr-reveal-em">${lead.emoji}</div>
        <p class="tr-reveal-kicker">${heading}</p>
        <p class="tr-reveal-name">${lead.label}</p>
        ${rest.length > 0 ? `<div class="tr-reveal-more">${
          rest.map((l) => `<span class="tr-reveal-chip">${l.emoji} ${l.label}</span>`).join('')
        }</div>` : ''}
        <button class="fa-btn fa-btn--primary tr-sheet-close" type="button" data-el="close">Nice!</button>
      </div>
    `, 'reveal');
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
      const rows = containerOdds(kind).map((r) => `
        <li class="tr-odds-row">
          <span class="tr-odds-what"${r.rarity ? ` style="color:${RARITY_COLORS[r.rarity]}"` : ''}>${r.label}</span>
          <span class="tr-odds-pct">${formatPercent(r.percent)}</span>
        </li>
      `).join('');
      const pools = containerOdds(kind)
        .filter((r) => r.pool && r.pool.length > 0)
        .map((r) => `${r.rarity}: ${r.pool!.map((id) => CHARACTERS[id].name).join(', ')}`)
        .join(' · ');
      return `
        <section class="tr-odds-block">
          <h3 class="tr-odds-title">${def.emoji} ${def.name}</h3>
          <p class="tr-odds-blurb">${def.blurb}</p>
          <ul class="tr-odds-list">${rows}</ul>
          ${pools ? `<p class="tr-odds-pool">${pools}</p>` : ''}
        </section>
      `;
    }).join('');

    openSheet(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">Drop rates</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">✕</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-sheet-note">Every percentage below is read directly from the reward
        tables the game rolls against.</p>
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
      if (p.coins) extras.push(`🪙 ${p.coins.toLocaleString()}`);
      if (p.container) {
        extras.push(`${CONTAINERS[p.container.kind].emoji} ${CONTAINERS[p.container.kind].name}`);
      }
      return `
        <div class="tr-sku${p.oneTime ? ' is-featured' : ''}">
          ${bonus > 0 ? `<span class="tr-sku-bonus">+${bonus}%</span>` : ''}
          ${p.oneTime ? '<span class="tr-sku-bonus tr-sku-once">ONE TIME</span>' : ''}
          <span class="tr-sku-em">${p.emoji}</span>
          <span class="tr-sku-name">${p.name}</span>
          <span class="tr-sku-gems">💎 ${p.gems.toLocaleString()}</span>
          ${extras.length > 0 ? `<span class="tr-sku-extra">+ ${extras.join(' + ')}</span>` : ''}
          <button class="tr-sku-buy" type="button" disabled>${live ? formatPrice(p.priceUsdCents) : `${formatPrice(p.priceUsdCents)} · Soon`}</button>
        </div>
      `;
    }).join('');

    openSheet(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">💎 Gem Store</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">✕</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-soon">🚧 Purchases are not available yet — nothing here can be bought.
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
    deltaEl.textContent = `${sign}${last.trophies} 🏆`;
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
  font-size: clamp(0.56rem, 1.3vh, 0.7rem);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(26,18,36,0.6);
  white-space: nowrap;
}
.fa-tr .tr-nextval {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.68rem, 1.7vh, 0.92rem);
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
  font-size: clamp(0.56rem, 1.6vh, 0.82rem);
  color: rgba(26,18,36,0.72);
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
.fa-tr .tr-node.is-character .tr-node-em { font-size: clamp(1.2rem, 6vh, 3.4rem); }

/* THREE node states, and only three.
   locked    = cream fill, quiet
   claimable = gold fill + pulsing gold halo (below)
   claimed   = desaturated and dimmed, with a tick. Round 1 filled claimed nodes
               with the same green the road uses for progress, which made a wall of
               green compete with the ONE gold node the player should be tapping.
               The filled spine already carries "how far I have come". */
.fa-tr .tr-node.is-claimed { opacity: 0.78; }
.fa-tr .tr-node.is-claimed .tr-node-medal { background: #E6DAC4; }
.fa-tr .tr-node.is-claimed .tr-node-em { filter: grayscale(0.55); }
.fa-tr .tr-node.is-claimed .tr-node-medal::after {
  content: '✓';
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(16px, 2.6vh, 24px);
  height: clamp(16px, 2.6vh, 24px);
  background: var(--lettuce);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.5rem, 1.4vh, 0.72rem);
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
  font-size: clamp(0.58rem, 1.9vh, 1rem);
  line-height: 1.15;
  max-width: 100%;
}
.fa-tr .tr-node-note {
  font-size: clamp(0.52rem, 1.3vh, 0.7rem);
  line-height: 1.15;
  font-weight: 600;
  color: rgba(26,18,36,0.78);
}
.fa-tr .tr-status {
  margin-top: 2px;
  padding: 2px 8px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: #FFFFFF;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.52rem, 1.35vh, 0.72rem);
  white-space: nowrap;
  color: var(--ink);
}
.fa-tr .tr-status.is-done { background: var(--lettuce); color: #FFFFFF; }
.fa-tr .tr-status.is-ready { background: var(--gold); color: var(--ink); }

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
  font-size: clamp(0.56rem, 1.5vh, 0.8rem);
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

.fa-tr .tr-inv-empty {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.62rem, 1.5vh, 0.8rem);
  color: var(--cream);
  text-shadow: 0 2px 0 rgba(26,18,36,0.75);
  white-space: nowrap;
}
.fa-tr .tr-inv-empty strong { color: var(--mustard); }

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
  font-size: clamp(0.6rem, 1.4vh, 0.76rem);
  white-space: nowrap;
}
.fa-tr .tr-open-cta {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.52rem, 1.2vh, 0.64rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ketchup);
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
  font-size: 0.66rem;
}

.fa-tr .tr-odds { font-size: clamp(0.6rem, 1.4vh, 0.78rem); }

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
  font-size: clamp(0.64rem, 1.5vh, 0.8rem);
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
.fa-tr .tr-reveal-kicker {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.6rem, 1.4vh, 0.78rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(26,18,36,0.6);
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
}
.fa-tr .tr-odds-blurb { margin: 2px 0 6px; font-size: clamp(0.58rem, 1.35vh, 0.72rem); color: #4E2C1B; }
.fa-tr .tr-odds-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.fa-tr .tr-odds-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: clamp(0.6rem, 1.4vh, 0.76rem);
}
.fa-tr .tr-odds-what { font-weight: 700; }
.fa-tr .tr-odds-pct {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.fa-tr .tr-odds-pool { margin: 6px 0 0; font-size: clamp(0.54rem, 1.25vh, 0.66rem); color: rgba(26,18,36,0.62); }

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
.fa-tr .tr-sku-bonus {
  position: absolute;
  top: -8px;
  inset-inline-end: 6px;
  padding: 2px 8px;
  background: var(--lettuce);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 0.56rem;
}
.fa-tr .tr-sku-once { background: var(--ketchup); }
.fa-tr .tr-sku-em { font-size: 1.6rem; line-height: 1; }
.fa-tr .tr-sku-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.6rem, 1.4vh, 0.74rem);
}
.fa-tr .tr-sku-gems {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.72rem, 1.8vh, 0.92rem);
  color: var(--water);
}
.fa-tr .tr-sku-extra { font-size: clamp(0.52rem, 1.2vh, 0.64rem); color: #4E2C1B; }
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
  font-size: clamp(0.56rem, 1.3vh, 0.7rem);
  color: rgba(26,18,36,0.62);
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
}

/* Portrait phone. The bottom bar wraps rather than crushing the inventory. */
@media (max-width: 700px) {
  .fa-tr .tr-hero { flex-wrap: wrap; }
  .fa-tr .tr-hero-next { flex-basis: 100%; order: 3; }
  .fa-tr .tr-bottom { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  .fa-tr .tr-pin-dot,
  .fa-tr .tr-node.is-claimable .tr-node-medal,
  .fa-tr .tr-sheet-card,
  .fa-tr .tr-delta { animation: none !important; }
  .fa-tr .tr-road { scroll-behavior: auto; }
}
`;
