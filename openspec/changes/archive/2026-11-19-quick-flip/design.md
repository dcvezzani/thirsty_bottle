# Design

## Context

- `ZoneGesture` (`client/src/table/gestures.ts`) classifies one press: tap, long press, scrub or drag. It fires `onTap(index)` on release when there was no movement and the press was shorter than the long press.
- **Tap handlers today:**
  - `CardRow` (hands, spreads, fanned piles in sheets), `ColumnZone` and `FreeZone` toggle selection on tap (`useUI.toggle`).
  - `Pile` opens the zone sheet on tap.
- **Flipping today:** `CardsSheet` (Actions…) sends `{ type: 'flip', cards }` with `predictFlip` for an optimistic update, then clears the selection.
- `SelectionBar` offers Select all, Clear, a "Send again" shortcut and Actions….
- **Server rules:** the reducer's `flip` accepts any reachable cards. Turn-mode `authorize` allows out-of-turn flips only for cards in the actor's own hand, and the server refusal already reaches the player as a toast.

## Goals / Non-Goals

**Goals:**
- Double tap flips one card, the whole selection when the tapped card is in it, or a pile's top card.
- No extra latency on single taps on cards.
- Flip in the selection bar.

**Non-Goals:**
- Triple tap, or flipping by swipe.
- Changing what a flip means on the server.
- Keyboard shortcuts (could follow later).

## Decisions

**D1. Double tap detection in `ZoneGesture`.**
- On every tap, the recognizer remembers `{ index, x, y, t }`.
- A second tap counts as a double tap when all of these hold:
  - it lands on the same index;
  - it is within 300 ms of the first tap's release;
  - it is within 12 px of the first tap.
- A double tap fires `onDoubleTap(index)` instead of `onTap`, and forgets the remembered tap, so a third tap starts fresh.
- Any scrub, drag, long press or cancel in between forgets it too.
- Pure and unit-testable with sample times, like the rest of the recognizer.

**D2. No delay for cards: undo the first tap.**
- `CardRow`, `ColumnZone` and `FreeZone` keep toggling selection on the first tap.
- On the double tap, they first toggle the same card back, which restores the selection exactly as it was before the first tap. Then they call `quickFlip(zoneId, h)`.
- `quickFlip` looks at the restored selection:
  - **The card is selected:** flip every selected card in that zone, in zone order, then clear the selection.
  - **The card is not selected:** flip just that card and leave the selection alone.
- *Alternative rejected:* delaying single taps by 300 ms. It would make selecting and painting feel sluggish, and those happen far more often than flips.

**D3. Piles: delay the single tap.**
- `Pile` gets a `delayTap` option. Its `onTap` schedules opening the zone sheet after 250 ms, and `onDoubleTap` cancels that timer and flips the top card (`zone.cards[0]`).
- A pile can't select cards by tapping, so there is no selection to restore.
- An empty pile does nothing on double tap; its single tap still opens the sheet.

**D4. One flip helper.** `quickFlip`, in a small module next to `drag.ts`:
- sends `{ type: 'flip', cards }` with `predictFlip`, so the card turns at once;
- relies on the server's refusal and the existing rollback when the flip isn't allowed (turn mode).
- The selection bar's Flip button and `CardsSheet`'s Flip button both call the same helper, so all three paths behave identically.
- Spectators never get here: zones are non-interactive for them.

**D5. Selection bar.** A Flip button sits between the "Send again" shortcut and Actions…. It flips the selection and clears it.

**D6. Mouse.** Pointer events already unify mouse and touch, so a double click arrives as two taps and takes the same path. The browser's native `dblclick` and text selection are suppressed on cards, which already have `user-select: none`.

## Risks / Trade-offs

- [The selection outline flashes for about 300 ms on the first tap of a double tap] → It's a brief and honest reflection of the first tap. The alternative, delaying every tap, is worse.
- [Two separate quick taps meant as select, then deselect, get read as a flip] → Toggling the same card twice within 300 ms has no useful meaning today, so nothing is lost.
- [Opening a pile's sheet feels slightly slower] → 250 ms. Accepted in exploration.
- [A face-down card in the player's own hand still shows its face to that player] → The existing face-down tint shows the new state, and flipping in hand is how a player pre-sets a face-down play.
