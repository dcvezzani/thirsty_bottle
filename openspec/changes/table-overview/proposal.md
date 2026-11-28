## Why

There is no single place to see everything that is public at the table. The board shows the shared zones and one player's per-player zones at a time, counters sit in a thin strip, notes are hidden in the settings sheet, and seat chips show only hand counts. Getting a good overview of the whole table means scrolling the board, rotating through each player's table and opening a sheet.

## What Changes

- An Overview button in the table header opens a full-screen scrolling page over the table, and closing it returns to the table as it was.
- The page lists, in order: the turn marker (turn-based mode), the shared zones in board order, each player (name, host crown, whose turn it is, hand count, and their per-player zones), the counters, and the shared notes.
- Each zone is drawn as it is defined on the table (its layout and width), with face-up cards showing faces and the rest as backs.
- Only public information appears. Hands show as counts, except cards their owner has shown to everyone, which appear under that player. The viewer's own hand appears as a count.
- The page is read-only. Scrubbing a strip shows the loupe and tapping a card opens its info sheet. Spectators can use it. It updates live while open.
- To tell "shown to everyone" from "shown only to me", cards the viewer can see publicly carry a `public` flag in the table view.

## Capabilities

### New Capabilities
- `table-overview`: the full-table overview page, its sections, what it shows and hides, and its read-only behavior.

### Modified Capabilities

## Impact

- `shared/src/protocol.ts` (`CardView.public`), `server/src/projection.ts` (set it from `isPublic`).
- `client`: an Overview page component, a header button, reuse of the card strip, loupe and card info sheet.
- Tests: projection unit tests for the flag and its leak safety, unit tests for what the overview lists, an e2e that opens it with several players and checks hidden cards stay hidden.
