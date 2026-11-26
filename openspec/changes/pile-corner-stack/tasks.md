# Tasks

## 1. The arrangement

- [x] 1.1 Add the pure `pileCorner` (D1) and make `zonePad` of a pile use it, so a mixed pile's room is one-sided. Verify with unit tests: upright over a 90° card gives room 0.4 on the right and none above; upright over a 45° card gives 0.7 right and 0.3 above; a 90° top over an upright card gives room 0.4 on the right (the landscape card is wider than the slot) and none above; one outline only is not a corner pile and keeps today's symmetric room; the offsets of each rotation (0° and 180° none; 90° and 45° as computed); the room goes when the cards are upright.

## 2. Drawing the pile

- [x] 2.1 Let `CardFace` take a shift for a rotated card, and have `Pile` place its drawn cards at the corner with one-sided margins and a tap area covering the L (D2). Verify with an e2e test: a pile whose top card is upright over a card turned 90° shows the two sharing their bottom-left corner with the turned card sticking out on the right; over a card turned 45° the diagonal card sticks out above and to the right; a turned top card over an upright one sits in the corner with the upright card above it; a pile with one outline is centred as before; the pile's box grows to the right and above only; a tap on the part that sticks out opens the pile's actions.

## 3. Checks

- [x] 3.1 Run lint, unit and e2e suites in full, including the earlier pile tests.

## Workflow follow-up

- Push to main to deploy, wait for CI to pass, verify the live version, then archive the change.
