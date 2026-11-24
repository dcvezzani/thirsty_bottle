# Tasks

## 1. Viewed hand

- [x] 1.1 Build the viewed hand display: shown cards first (face up), hidden cards as one stack with "+N hidden", a slim line when nothing is shown, and the main hand area with the arc when something is shown (D2, D3). Verify with a unit test of the display-list function: ordering, counts, and the none-shown case.
- [x] 1.2 Add `emptyText` to `CardRow`, and use "<Name>'s hand is empty" for a viewed hand (D4). Verify with a unit test.

## 2. Layout and strip

- [x] 2.1 While viewing another seat, put the viewed hand in the main hand slot and the viewer's own hand in a slim strip that still accepts and starts drags; restore the full hand on Mine (D1, D5). Verify with e2e tests in 3.1.

## 3. End-to-end and checks

- [x] 3.1 Update `e2e/player-views.spec.ts`: while viewing, the viewed hand is slim with no cards shown, grows when Sam shows two cards (shown first, "+3 hidden"), the empty message names the owner, and Alex can drag from the own-hand strip onto Sam's Tableau.
- [x] 3.2 Update `e2e/contrast.spec.ts` for the slim lines and the enlarged viewed hand. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
