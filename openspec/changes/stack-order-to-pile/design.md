# Design

## Context

- **Layering:** a hand, a spread, a column and a free zone draw their cards in list order with later cards on top (`zIndex` follows the index), so the last card in the list is the uncovered one.
- **Pile order:** in a pile, index 0 is the top. `insert(s, zone, ids, index, loc)` puts the moved cards at index 0 for a pile when no index is given (`splice(0, 0, ...ids)`), so the first moved card ends on top.
- **Where order comes from:** the client sends the cards in source order for a selection (`orderedSelection`); `move` resolves them in that order.
- **The preview:** `predictMove` (`client/src/store/predict.ts`) mirrors the reducer's placement so a move shows at once; it must follow the same rule or the cards flick into another order when the server answers.

## Goals / Non-Goals

**Goals:** a stack moved onto a pile keeps the order it was seen in; the order does not depend on how the cards were chosen.

**Non-Goals:** no change to drops onto a spread, a hand or a column, to a moved pile, to gathering, dealing or drawing, or to what is stored.

## Decisions

**D1. The rule, in the reducer's `doMove`.**
- When the destination is a pile, no index is given, more than one card is moved, and all the cards come from one source zone that is not a pile, the cards are ordered by their position in that zone from last to first before they are inserted, so the last card (the one on top in the source) ends on top of the pile.
- Ordering by the source position makes the result independent of the order the cards were chosen in. Cards from several zones, from a pile, or a single card keep today's order.

**D2. The same rule in the client's preview.** `predictMove` applies the same ordering to the moving cards when the target is a pile, no index is given, and they all come from one non-pile zone, using their positions in the source before they are removed.

**D3. Tests.** Reducer tests: a hand, a spread, a column and a free zone each moved to a pile (the last card on top); chosen in a different order; one card; from a pile (order kept); to a spread, a hand and a column (unchanged); cards from two zones (unchanged). The existing tests that asserted the old order for a multi-card move onto a pile change. A unit test that `predictMove` agrees with the reducer. An e2e test that a fanned hand moved onto a pile has the uncovered card on top.

## Risks / Trade-offs

- **A change in behaviour:** anyone used to the first card landing on top will see the reverse. The spec states the new rule, and it matches the stack that is seen.
- **Free zones:** cards in a free zone are layered by their order in the list, as in a spread; the same rule applies.
