# Design

## Context

- **Layering:** a hand, a spread, a column and a free zone draw their cards in list order with the last on top; a pile's index 0 is the top. `insert` puts moved cards at the end of a list, and at index 0 of a pile.
- **The last change (stack-order-to-pile):** added `stackedForPile` to the reducer's `move` and the same ordering to the client's `predictMove`, so a group moved from one non-pile zone to a pile is reversed silently. Moves from a pile, from several zones and to other zones are not. That is the inconsistency to remove.
- **Flip rules:** `flip` and `flipZone` refuse another player's zone unless hands are open (`isOthersOwned`, `othersZoneError`), appear in `UNDOABLE`, and are covered by the turn-mode `confined` check.

## Goals / Non-Goals

**Goals:** one rule for moves everywhere; a plain, explicit way to reverse cards; the rule written in the spec.

**Non-Goals:** no change to drawing, dealing, gathering, flipping a pile, or to how cards are layered.

## Decisions

**D1. Reverse actions (shared).**
- `reverseCards { cards }` (named so, because `reverse` already means reversing the turn direction): the cards are grouped by the zone they are in; in each zone the selected cards' positions are taken in list order and the cards are assigned back to those positions in reverse. The cards not selected do not move.
- `reverseZone { zone }`: `zone.cards.reverse()`. Free-zone positions belong to the cards, so they follow them.
- Fewer than two cards (after grouping, per zone, fewer than two selected) does nothing and is not logged.
- Both follow the flip permission rules and the turn-mode `confined` rule (a player's own hand out of turn), are added to `UNDOABLE`, mark the cards touched so projections update, and log a card action: "Alex reversed 4 cards" (card names when all are public, like flipping) and "Alex reversed Discard" for a zone.
- Faces, rotations and reveals are untouched.

**D2. Undoing the last change.** `stackedForPile` and its call in `move` are removed from the reducer; the matching reordering and its source bookkeeping are removed from `predictMove`. Moves are exactly as they were before stack-order-to-pile. The reducer and preview tests written for that change are replaced by tests that assert the documented rule (the first card moved onto a pile is on top), and the e2e test becomes the reverse-then-move flow.

**D3. Controls (client).** `reverseCards(handles)` and `reverseZone(zoneId)` send the actions. The selection sheet gets a "Reverse order" button beside Flip and the rotate buttons; it keeps the selection. A zone's sheet gets "Reverse order" (for the player's own and shared zones, with at least two cards).

**D4. Housekeeping.** The unarchived `stack-order-to-pile` change directory is removed with this change, so the main spec never gains its rule.

**D5. Tests.** Reducer: a scattered selection reverses in place; a whole zone; a pile (faces and order); faces and rotations kept; permissions (another player's hand refused, own hand out of turn allowed); undo; fewer than two cards is a no-op; moves keep order (hand to pile, pile to spread, spread to spread, column). Client: nothing to preview. E2e: select a hand, Reverse order, move to the pile, and the uncovered card is the pile's top card; Reverse order on a zone's sheet.

## Risks / Trade-offs

- **Another change of behaviour for hand-to-pile moves:** it goes back to what it was before the last change. The spec now states the rule and the way to the other stacking.
- **Two steps for the other stacking:** reverse, then move. Reversing is also useful alone, for example to re-fan a hand.
