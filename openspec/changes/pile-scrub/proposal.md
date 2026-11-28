## Why

A pile cannot be browsed by scrubbing. Today any drag on a pile takes the top card, and looking through a pile means opening its action sheet and choosing "Fan out", a separate sheet. A player searching a deck needs to slide through the cards in place and, when the cards are face-down, to see their faces without leaving the scrub.

## What Changes

- A sideways slide on a pile fans it out into a spread in place and scrubs every card with the loupe, top card first, left to right. The pile collapses when the finger lifts, unless "Stay open" keeps the viewed card as it does for other zones. Pulling up or out still takes the top card; tap, double-tap and hold are unchanged.
- A "See face-down" chip on the loupe turns on private viewing of face-down cards for that pile. A second finger tapping the chip toggles it mid-scrub; in stay-open mode it is a button in the loupe's controls. It is off at the start of every scrub.
- Turning it on peeks the whole pile for the viewer, which logs one "peeked at N cards in <pile>" line for everyone. Turning it off, or ending the scrub, clears that peek for those cards.
- The chip appears only on a pile that has cards the viewer cannot see, and not for spectators or for a pile the viewer may not peek at.
- Out of scope: hands, spreads and columns; a saved preference for the chip.

## Capabilities

### New Capabilities

### Modified Capabilities
- `card-handling`: scrubbing a pile in place, and viewing face-down cards while scrubbing it.

## Impact

- `client/src/table/Zones.tsx` (the pile's gesture), `client/src/table/Loupe.tsx` and `loupeView.ts` (the chip), `client/src/table/ui.ts` (state for the pile scrub and the chip), `client/src/pages/Table.tsx` (the temporary spread).
- Existing `peek` and `unpeek` actions are reused; no server change.
- Tests: gesture classification for piles, the chip's toggle and cleanup, an e2e that scrubs a pile, toggles the chip and checks faces appear and then clear.
