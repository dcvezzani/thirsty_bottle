# Proposal

## Why

A pile and a fan layer their cards in opposite directions: the first card of a pile is on top, the last card of a hand, a spread or a column is on top. Moving cards keeps their list order, so a fanned hand moved onto a pile lands with its first card on top, which is not the stack the player saw. The previous attempt to hide this by flipping the order silently in one direction made moves behave differently depending on where the cards came from. Moves should behave the same everywhere, and a player who wants the opposite stacking should have a plain tool for it.

## What Changes

- **Moves keep the cards' order, everywhere.** The silent reordering of a group moved onto a pile (stack-order-to-pile) is undone: the cards keep their order in the list, so the first card moved onto a pile lands on top.
- **Reverse order, for a selection.** A button in the selection sheet reverses the order of the selected cards among the places they occupy in their zone, leaving unselected cards where they are. Selecting a whole hand reverses the hand. Faces and rotations do not change, and the selection is kept so the cards can be moved straight after.
- **Reverse order, for a zone.** A button in a zone's sheet reverses every card in the zone. On a pile this differs from "Flip all", which also turns the cards over.
- **Same rules as flipping.** Reversing is refused in another player's zone, is logged ("Alex reversed 4 cards") and can be undone.
- **The rule is written down.** The spec states that moves keep the cards' order and names Reverse order as the way to get the opposite stacking.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: new requirements "Moved cards keep their order" and "Reversing card order".
- `card-handling`: new requirement "Reverse order controls".

## Impact

- **Shared and client.** Two actions (`reverse`, `reverseZone`), the reducer cases with flip-style permissions, log and undo; the client's reverse buttons; and the removal of the reordering added in the last change (the reducer's group-to-pile ordering and the client's matching preview). Saved tables are not affected.
- **Housekeeping.** The unarchived `stack-order-to-pile` change is removed; this change replaces it.
- **Tests:** reducer tests for reversing a selection (in place, scattered selection, whole zone, faces kept, permissions, undo) and for moves keeping order; the tests written for the last change are replaced; e2e that selecting a hand, reversing it and moving it to a pile puts the uncovered card on top.
