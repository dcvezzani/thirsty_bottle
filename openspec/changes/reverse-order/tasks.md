# Tasks

## 1. Rules

- [ ] 1.1 Add the `reverse` and `reverseZone` actions (schemas, reducer with flip-style permissions, turn-mode rule, log, touched cards, `UNDOABLE`) (D1) and remove the group-to-pile reordering from the reducer (D2). Verify with reducer unit tests: a scattered selection reverses in place and leaves the others; a whole zone; a pile reverses without turning faces; faces and rotations are kept; another player's hand is refused and one's own hand out of turn is allowed; undo restores; fewer than two cards does nothing and logs nothing; moves keep order (a hand onto a pile has the first card on top, a pile onto a spread keeps left-to-right order, a column run keeps order); reverse then move gives the other stacking. Replace the tests written for stack-order-to-pile.

## 2. Client

- [ ] 2.1 Remove the matching reordering from `predictMove` and replace its tests (D2), and add the Reverse order buttons to the selection sheet and the zone sheet (D3). Verify with a unit test that the preview keeps order for a group moved onto a pile, and an e2e test: select a whole fanned hand, tap Reverse order, move it to the Discard pile, and the card that was uncovered is the pile's top card; Reverse order on a zone's sheet reverses it; it is not offered for another player's zone.

## 3. Checks

- [ ] 3.1 Run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, wait for CI to pass, verify the live version, then archive the change.
