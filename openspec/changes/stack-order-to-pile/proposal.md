# Proposal

## Why

Cards in a hand, a spread or a column are layered by position: the last card is drawn on top of the others. Moving several of them onto a pile inserts them at the top of the pile in list order, so the first (the bottom of the visible stack) lands on top and the card that nothing covered goes to the bottom. The pile comes out stacked the opposite way to the stack the player saw: a player who moves a fanned hand onto the discard pile expects the card that was uncovered to be on top.

## What Changes

- **Moving several cards onto a pile keeps the stack as seen.** When several cards from one hand, spread, column or free zone are moved onto a pile, the card that was on top of the others in the source (the last card in a fan or spread, the fully visible last card of a column, the last card placed in a free zone) lands on top of the pile, and the rest follow in the order they were layered. Counted from the left, the cards go onto the pile in reverse.
- **It does not depend on how they were chosen.** The order follows the cards' places in the source, not the order they were tapped or dragged in.
- **Unchanged.** One card; moves from a pile (a moved pile keeps its order and lands on top, as the spec already says); drops onto a spread, a hand or a column; gathering; dealing and drawing.
- **Same everywhere.** "Move to…", Send again and dragging all use one move, and the client's immediate preview of the move follows the same rule.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: new requirement "Stacking cards onto a pile". The existing requirements stay as they are.

## Impact

- **Shared and client.** The move rule in the reducer and the client's optimistic move; no new fields or messages. Saved tables are not affected, since the order is decided when a move happens.
- **Tests:** reducer tests for each source kind and for the unchanged cases; the existing tests that assert the old order for a multi-card move onto a pile change; an e2e test that moving a fanned hand onto a pile puts the uncovered card on top.
