# Tasks

## 1. Size and drawing

- [x] 1.1 Add the pure `rotationPad` and `zonePad` (D1), draw rotated cards without scale on the table and keep the explicit fit for the loupe's True full view (D2), and update the CSS so a rotated slot overflows. Verify with unit tests: `rotationPad` at 0°, 45°, 90°, 135° and 180°, and the largest of several rotations; the table transform has no scale while an explicit fit still applies; and with an e2e check that a card rotated 90° is drawn as large as an upright one and still keeps its slot.

## 2. Rows and hands

- [x] 2.1 Reserve the room in `CardRow`: taller row, lower cards, fan edge padding, hit-test offset, and the hand dock's heights (D3). Verify with an e2e test: rotate a card in a spread and in the hand, the zone grows in height and width and the whole rotated card lies inside it, tapping the card's slot still selects it, and setting it upright returns the zone to its original size.

## 3. Columns, piles and the board

- [x] 3.1 Reserve the room in `ColumnZone` and `Pile`, and add `padX` to the board flow so a fit zone widens and its row-mates shrink or wrap (D3). Verify with unit tests of `flowRows` with and without `padX`, and an e2e test that a column grows wider and a pile bigger (only when the rotated card is on top), both returning to size, and that a widened zone's row-mates still fit the board.

## 4. Checks

- [x] 4.1 Update the existing rotation e2e test that expects a rotated card smaller than its slot, and run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, wait for CI to pass, verify the live version, then archive the change.
