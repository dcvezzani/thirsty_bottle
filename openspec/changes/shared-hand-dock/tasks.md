# Tasks

## 1. Dock and focus

- [x] 1.1 Add `handFocus` to the UI state (default `viewed`, reset when `viewSeat` changes) and the pure `nextFocus` helper (D3). Verify with unit tests: slide in the narrow column focuses it; carrying over the other column focuses that one; tap and actions in the focused column change nothing; changing `viewSeat` resets to `viewed`.
- [x] 1.2 Build `HandDock`: a constant-height dock of two columns, their hand on the left and mine on the right, focused column about 66%, with a width transition, replacing `ViewedHand` and the own-hand strip in `Table.tsx`. Spectators get one full-width column; my own table keeps the plain hand area (D1, D2, D7). Verify with e2e tests in 3.1: the dock is the same height on my own table, while viewing with nothing shown, and while viewing with cards shown; the board's top does not move.
- [x] 1.3 Wire the triggers: an `onScrubStart` prop on `CardRow` that focuses a narrow column, a subscription to `drag.over` for carried cards, and the 150 ms settle window that pauses scrub steps (D4). Verify with e2e tests in 3.1: sliding over each narrow column swaps the focus and it stays after release, and a tap does not change it.

## 2. Viewed column content

- [x] 2.1 Render the viewed column: shown cards first, the hidden stack with the count, no extra height when nothing is shown, and "Sam's hand is empty" when empty (D5). Verify with unit tests for the content and with e2e tests in 3.1.
- [x] 2.2 Add the corner badges and the pulse for a newly shown card while the viewed column is narrow, without changing focus (D6). Verify with unit tests for the badge text and the pulse condition, and with e2e tests in 3.1.

## 3. End-to-end and checks

- [x] 3.1 Update `e2e/player-views.spec.ts` for the new layout:
  - the dock's height is constant across my own table, viewing, and a shown card
  - their column is wide by default
  - sliding over my column focuses it and the focus stays, and sliding back restores it
  - a tap does not change the focus
  - rotating resets the focus
  - Sam shows Alex a card while Alex's hand is focused: the pulse and badge appear and the focus stays
  - carrying a card to Sam's narrow column widens it, and dropping passes the card
  - a spectator gets one column

  Remove the slim-line and strip assertions.
- [x] 3.2 Update `e2e/contrast.spec.ts` for the dock, the badges and the pulse. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
