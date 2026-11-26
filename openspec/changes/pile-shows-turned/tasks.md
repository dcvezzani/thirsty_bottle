# Tasks

## 1. Which cards, and their room

- [ ] 1.1 Add the pure `outline` and `pileShown` and make `zonePad` of a pile use the cards `pileShown` picks (D1, D3). Verify with unit tests: three alike cards then a different one draws the different one; a card turned 180° under an upright top is skipped; 45° and 135° are different outlines; four outlines draw at most three beneath the top; an empty and a one-card pile; the pile's room follows the drawn cards and returns when they are upright.

## 2. Drawing the pile

- [ ] 2.1 Give `CardFace` a decorative mode and draw the picked cards beneath a pile's top card with the generic slivers behind them (D2). Verify with an e2e test: a pile with a turned card under three alike ones shows that card sticking out; a turned top card over an upright face-up card shows the card's real face above and below; a same-outline card draws nothing extra; the zone's `[data-h]` count is the number of cards in it; tapping the part of a drawn card beneath opens the pile's actions as the top card does.

## 3. Checks

- [ ] 3.1 Run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, wait for CI to pass, verify the live version, then archive the change.
