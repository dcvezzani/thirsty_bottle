## Why

Scrubbing a pile by finger travel cannot reach the whole pile in one slide: at ordinary speeds a card takes about 12 px, so a 52-card pile needs more travel than the screen is wide, and the card in the loupe no longer matches where the finger is. A player must be able to scrub through the whole pile, however big, with the loupe showing the card under the finger.

## What Changes

- While a pile is scrubbed, it fans out across the full width of the board, top card at the left end and the last card at the right end, and the card under the finger is the card shown, highlighted in the fan and in the loupe. The whole pile is reachable in one slide.
- A fisheye lens makes aiming precise: the cards around a pinned point get wide slots (about 15 px each, about six cards across) and the rest are compressed so the pile still spans the board. The lens is pinned where the finger presses, and pinned again wherever the finger rests for about 300 ms.
- No slot is narrower than 2 px; a pile too big for the width gets a smaller lens.
- Dropping a carried card into a pile keeps its travel-based gap (it works), and the speed-based gain stays for that only.
- The "See face-down" chip, pull-out, stay-open mode and the other pile gestures are unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities
- `card-handling`: scrubbing a pile in place now follows the finger's position through a pinned lens instead of its travel.

## Impact

- `client/src/table/Zones.tsx` (the pile's scrub uses the lens mapping and a full-width fan), a new pure `client/src/table/scrubLens.ts` (the mapping), `client/src/table/scrubGain.ts` (kept for the drop slot), styles for the full-width fan.
- No server change.
- Tests: unit tests for the lens mapping, and an e2e that scrubs a 52-card pile from edge to edge, fine-tunes inside the lens and re-pins by resting.
