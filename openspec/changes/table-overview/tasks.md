## 1. The public flag

- [x] 1.1 Add `public` to `CardView` and set it in the projection from `isPublic`, omitted when false. Projection tests: face-up shared and per-player cards, cards shown to everyone, and that hand cards, peeked cards and cards shown only to one player are never flagged for anyone else.

## 2. The overview page

- [x] 2.1 Add the pure `overviewSections(view)` (turn marker, shared zones in board order, each player with their per-player zones and publicly shown hand cards, counters, notes; hidden and privately visible cards as backs) with unit tests for each requirement of "Overview sections", "Zones in the overview" and "Only public information".
- [x] 2.2 Add the Overview layer and its header button: the sections with each zone drawn in its own layout and width through the board's zone renderers in a read-only mode, the loupe on scrub and card info on tap, no selection, drag or flip, live updates, spectator access, and return to the table unchanged on close.

## 3. Verification

- [x] 3.1 Add an e2e with several players: open the Overview and check the sections, that hands show counts only, that a card shown to everyone appears and a peeked card does not, that dragging does nothing, that it updates when another player moves a card, and that closing returns to the table. Include light and dark readability checks. Run lint, unit and the full e2e suites.
