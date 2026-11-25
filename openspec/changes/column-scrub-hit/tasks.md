# Tasks

## 1. Column layout

- [ ] 1.1 Change `columnMagnify` to open only the steps from the focused card downwards and leave the steps above it as compressed (D1), and update the existing fisheye unit test. Verify with unit tests: the focused card's top and every card above it are where they are in the compressed layout; the cards below open by distance; no focus returns the layout unchanged; a finger path down and back up over a column of 12 mixed face-up and face-down cards (with the hit on the drawn layout and the focus fed back each step) always shows the card at the finger as the focus and never skips a card.

## 2. Wire it in

- [ ] 2.1 Keep the focus in a ref in `ColumnZone`, hit-test `columnMagnify(Lfull, focusRef)` for scrubbing and for mouse hover (D2). Verify with an e2e test: scrub a finger down a column of at least 10 mixed cards and back up, and at each step the card in the loupe is the card at the finger's position; hover with a mouse previews the card under the pointer.

## 3. Checks

- [ ] 3.1 Run lint, unit and e2e suites in full, including the zone-arrangement column tests.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
