## Why

A card dropped on a pile always lands on top. A player who wants to put a card somewhere inside a pile, such as back into the middle of a deck, has no way to choose the place. Holding a carried card over a spread already opens it so a slot can be aimed at; a pile does not open.

## What Changes

- Holding a carried card still over a pile for about 300 ms fans the pile out in place, as scrubbing a pile does, with a gap showing where the card will land. Only a pile with cards opens; an empty pile still takes the drop on top.
- The gap starts at the top slot, so releasing without moving drops on top as today. It then follows how far the finger travels, with the same speed-dependent gain as scrubbing a pile: slow movement is about one slot per 12 px, and a fast sweep covers the whole pile.
- Releasing drops the carried cards at that depth, counted from the top, and the pile collapses. Releasing before the hold still drops on top. Faces follow the usual move rules.
- Dropping a pile's own card back into the same pile uses the card's position after it is lifted out.
- Spreads, hands and columns keep their current behavior.

## Capabilities

### New Capabilities

### Modified Capabilities
- `card-handling`: piles open under a held drag and take a drop at the chosen depth.

## Impact

- `client/src/table/drag.ts` (which zones open under a held drag, and the gap's travel-based slot), `client/src/table/Zones.tsx` (the pile's drop resolver and fan overlay while a drag holds over it), `client/src/table/scrubGain.ts` (reused).
- No server change: `move` already takes an `index`.
- Tests: unit tests for the slot's travel-based rules and which zones open, and an e2e that holds a card over a pile, moves the slot and drops it at a chosen depth.
