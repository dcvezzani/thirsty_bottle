# Proposal

## Why

On a phone the table's shared zones often don't fit on screen, but scrolling them is nearly impossible. Every zone (card rows, free-layout areas, piles) takes over all touches so cards can be scrubbed and dragged. That leaves the thin iOS scroll indicator and the narrow gaps between zones as the only places a finger can scroll, as in the reported Solitaire screenshot with zones P2–P5. Dragging a card to a zone that is off screen is also impossible, because the board does not scroll while dragging.

## What Changes

The approach follows the established mobile conventions: native one-finger scrolling everywhere except on the objects you manipulate, two-finger panning over manipulable content (the "cooperative gestures" pattern used by embedded maps), and edge auto-scroll while dragging.

- **One finger scrolls anywhere that isn't a card.** Zone labels, empty space inside a zone (including the "Empty" area), and the gaps between zones scroll the board with native momentum. One finger on a card keeps today's gestures: scrub, drag, hold for info, tap to select.
- **Two fingers scroll anywhere on the board, including over cards.** Placing a second finger cancels whatever the first finger started on a card, so nothing moves or gets selected, and the board pans with both fingers and keeps gliding briefly after release.
- **Edge auto-scroll while dragging.** Holding dragged cards near the top or bottom edge of the board for a moment scrolls it in that direction, faster closer to the edge, so cards can be dropped on any zone.
- The player's own hand along the bottom, and the controls, are unchanged.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `card-handling`: adds three requirements: "One-finger scrolling outside cards", "Two-finger scrolling anywhere on the board" and "Scrolling while dragging". The existing requirement already says shared zones are "scrollable and zoomable"; these define how scrolling works on touch screens.

## Impact

- Client: `client/src/styles.css` (`touch-action` moves from whole zones to card elements), `client/src/table/Zones.tsx` and `CardRow.tsx` (cancel on a second finger), a new board-level two-finger pan handler, and edge auto-scroll in `client/src/table/drag.ts`.
- Tests: new e2e tests using multi-touch CDP events (the existing `touchPath` helper extended to several touch points), plus unit tests for the pan and auto-scroll math. Existing gesture e2e tests must keep passing.
- No server or protocol changes.
