## ADDED Requirements

### Requirement: Piles open under a held drag
While a player carries cards, holding still over a pile that has cards for about 300 ms SHALL fan the pile out in place with a gap showing where the cards would land. The gap SHALL start at the top slot and then follow how far the finger travels, slowly for one slot at a time and quickly to cover the pile. Releasing SHALL drop the cards at that depth, counted from the top, and the pile SHALL collapse. Releasing before the hold, or over an empty pile, SHALL drop the cards on top.

#### Scenario: Drop into the middle of a pile
- **WHEN** a player carries a card over a pile of 30 cards, holds for 300 ms, slides to a slot in the middle and releases
- **THEN** the card is inserted at that depth in the pile and the pile collapses

#### Scenario: Release without moving
- **WHEN** a player holds a carried card over a pile until it fans out and releases without moving the finger
- **THEN** the card is dropped on top of the pile

#### Scenario: Slow movement steps one slot at a time
- **WHEN** a player moves the finger slowly after the pile has fanned out
- **THEN** the gap moves about one slot for every 12 px of finger travel at ordinary speeds, up to about 800 px/s, so any single slot can be chosen; only a real flick covers the pile

#### Scenario: Pass over a pile
- **WHEN** a player drags a card across a pile without holding still
- **THEN** the pile does not fan out and a drop lands on top

#### Scenario: Return a card to its own pile
- **WHEN** a player lifts a card from a pile and drops it back into the same pile at a chosen slot
- **THEN** the slot is counted in the pile without the lifted card, and the card ends up there

### Requirement: The loupe follows the drop gap
While a carried card is held over an open pile, the loupe SHALL show the card at the gap, the one the dropped cards will sit directly above (the last card for the bottom slot), following it as the gap moves, and it SHALL go away with the drop or when the drag leaves the pile. The mouse does not get the loupe.

#### Scenario: The loupe follows the gap
- **WHEN** a player holds a carried card over a pile until it fans out and then moves the gap down the pile
- **THEN** the loupe shows the card at the gap, starting with the top card, and follows it card by card
