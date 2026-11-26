# Tasks

## 1. The rule

- [ ] 1.1 Order cards moved onto a pile by their position in the source zone, last first, when they come from one non-pile zone and no index is given (D1), and update the existing tests that asserted the old order. Verify with reducer unit tests: a hand, a spread, a column and a free zone each moved to a pile land with the last card on top; cards chosen in another order give the same pile; one card, a move from a pile, and moves to a spread, a hand and a column are unchanged; cards from two zones keep their order.

## 2. The preview and the whole flow

- [ ] 2.1 Apply the same ordering in the client's `predictMove` (D2). Verify with a unit test that `predictMove` and the reducer produce the same order for each source kind, and an e2e test: select all of a fanned hand, move it onto the Discard pile, and the card that was uncovered in the hand is the pile's top card, with no change of order when the server answers.

## 3. Checks

- [ ] 3.1 Run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, wait for CI to pass, verify the live version, then archive the change.
