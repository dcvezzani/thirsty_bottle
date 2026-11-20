# Proposal

## Why

Turning over a pile with "Flip all" turns every card face up but leaves the order unchanged, so the old top card is still on top. A real deck turned over puts the bottom card on top and turns every card, so a face-up card inside the stack ends up face down. Today the reducer instead forces every card in the zone to one face, in place.

## What Changes

- **"Flip all" on a pile turns the whole stack over.** The order reverses, so the bottom card becomes the top, and each card's face toggles. An all-face-down pile becomes all face up in reverse order. A mixed pile keeps its mix, inverted.
- **Spreads, columns and free zones are unchanged.** "Flip all" there still turns every card the same way in place (all face up, or all face down when they all already are).
- **Also unchanged:**
  - double-tapping a pile flips only its top card;
  - flipping selected cards toggles each in place, even when they came from a pile.
- **"All face up" and "All face down" in the zone sheet,** next to "Flip all", for every layout. They set every card in the zone to that face without changing the order: square up a mixed pile, or reveal a pile without reversing it. They use the action's existing explicit-face form, so the server is unchanged.
- **The log** says the pile was turned over (for example, "Alex turned Standard 52 over"). One action, one undo.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `table-play`: "Card face state" spells out what flipping every card in a zone means. A pile is turned over (order reversed, each card toggled); other layouts flip each card in place. A new requirement, "Set every card's face", covers making every card in a zone face up or face down without changing the order.

## Impact

- **Shared reducer** (`flipZone`): pile branch reverses `cards` and toggles each card. The explicit `face: 'up' | 'down'` form of the action keeps its current "set every card to this face, in place" meaning for any layout. No client sends it today; it stays for scripted use and tests.
- **No protocol changes.** The zone sheet already sends `flipZone`, and the flip animation and broadcast already carry the new order.
- **Client:** two buttons in the zone sheet send `flipZone` with `face: 'up'` or `face: 'down'`.
- **Tests:** reducer unit tests for an all-down pile, a mixed pile, a spread (unchanged) and undo. An e2e check that after "Flip all" on the deck pile, the visible top card is the former bottom card. An e2e check that "All face down" squares up a mixed pile without changing its order.
