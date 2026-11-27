# Tasks

## 1. Placement and sizes

- [x] 1.1 Change `pickLoupe` to take the whole view (side with more room, top on a tie, height clamped between 35% and 60% of the view, safe-area aware) and add the pure `loupeSizes` for the card in each view (D1, D3). Verify with unit tests: a zone low on the screen gets a tall top loupe; a zone high up a bottom one; a tie goes to the top; a zone in the middle gets the larger side at a reduced height never below the minimum; the 60% cap; safe-area insets move the box in; a short screen; card, Details and True full sizes for the plain and the stay-open loupe, and with the width limiting them.

## 2. The loupe

- [x] 2.1 Make the loupe docked and full width with safe-area offsets, size its card, Details and True full from `loupeSizes`, and have `placeLoupe` and the header scrub pass the view (D2, D4). Verify with an e2e test on a phone: scrubbing the hand puts the loupe at the top spanning the screen's width and covering the header, at most 60% of the height, with a card wider than 220 px, and not covering the hand; a zone in the upper part puts it at the bottom; Details has the card left of its text and True full is square; and on a wide screen it is about 720 px wide and centred. Update the earlier loupe tests that assumed a box inside the board.

## 3. Checks

- [ ] 3.1 Run lint, unit and e2e suites in full, including the second-finger, stay-open, header scrub and rotation loupe tests.

## Workflow follow-up

- Push to main to deploy, wait for CI to pass, verify the live version, then archive the change.
