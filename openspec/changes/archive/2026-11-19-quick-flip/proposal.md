# Proposal

## Why

Flipping a single card is one of the most common physical actions at a card table, but it currently takes three taps and a sheet: tap the card to select it, tap "Actions…", then tap Flip. A pile's top card has no direct flip at all: the zone sheet only offers "Flip all", so the card has to be dragged out first.

## What Changes

- **Double tap to flip.**
  - A double tap on a card in a spread, column, free zone or the player's own hand flips it.
  - If the card is part of the current selection, the double tap flips the whole selection instead.
  - A double tap on a pile flips its top card.
  - Each double tap is one flip action: one log entry and one undo.
- **No added delay for single taps** in rows, columns and free zones. The first tap still toggles selection immediately; the second tap restores that selection and flips. The selection outline may flash briefly.
- **Piles wait briefly.** A single tap on a pile still opens its zone sheet, but about 250 ms later than now, so that a second tap can be recognized as a double tap.
- **Flip in the selection bar.** While cards are selected, the selection bar offers Flip next to "Actions…" (2 taps to flip one card, and the obvious path for people who don't know the gesture).
- After a selection is flipped, by double tap or the Flip button, the selection clears, as it does today after Actions… then Flip.
- Actions… then Flip stays, so screen-reader users (for whom a double tap is a normal activation) keep a path.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `card-handling`: a new requirement "Quick flip" (double tap). "Selection controls" gains the Flip button. "Gesture disambiguation" names the double tap alongside the other gestures.

## Impact

- **Client:**
  - the gesture recognizer gains double-tap detection, shared by rows, columns, free zones and piles;
  - the zone components call a shared quick-flip handler;
  - the selection bar gets a Flip button.
  - Flips are applied optimistically through the existing `predictFlip`.
- **Server and protocol:** no changes. The existing `flip` action carries one card or a selection, and turn-mode authorization already limits out-of-turn flips to the player's own hand.
- **Tests:** gesture unit tests, and e2e tests on a phone and on desktop (mouse double-click) for:
  - a single card;
  - a selection;
  - a pile top;
  - the selection bar's Flip;
  - an out-of-turn refusal;
  - existing tap, scrub and long-press behavior staying as it is.
