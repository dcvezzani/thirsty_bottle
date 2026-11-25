# Tasks

## 1. Toolbar

- [ ] 1.1 Make `SelectionBar` the one-line toolbar (D2) and render it in the bottom row in place of the panel tabs and zoom buttons while a seated player has a selection (D1, D5). Verify with an e2e test (in 3.1): the row has the same height with and without a selection, and `.board` keeps the same size and the same zone positions through select, deselect and select again.
- [ ] 1.2 Add Select all, Clear and the Face down toggle to `CardsSheet`, and show the face down tag in the toolbar (D3). Verify with a unit test of the tag and with e2e tests in 3.1 that Select all and Face down work from the sheet.
- [ ] 1.3 Close an open chat drawer when a selection starts, and show the unread dot on the toolbar (D4). Verify with unit tests of the drawer rule and the dot, and an e2e test in 3.1 that selecting with the drawer open closes it.

## 2. Existing tests

- [ ] 2.1 Update the e2e tests that used the old bar: `contrast.spec.ts`, `hearts.spec.ts`, `pile-move.spec.ts`, `quick-flip.spec.ts`, `table-actions.spec.ts`, `table-board.spec.ts`, `table-gestures.spec.ts` and `player-views.spec.ts`. Select all, Clear and Face down move to the Actions sheet or the ✕; "Send again → Discard" becomes "→ Discard". Verify that they all pass again.

## 3. End-to-end and checks

- [ ] 3.1 Add `e2e/stable-selection.spec.ts`:
  - on a phone, double-tap an unselected card and a selected card, and each flips
  - the layout does not move through select, deselect and select
  - a stray tap where the bar used to be does not clear or send anything
  - selecting with the drawer open closes the drawer
- [ ] 3.2 Update `e2e/contrast.spec.ts` for the toolbar and its tag and dot states. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
