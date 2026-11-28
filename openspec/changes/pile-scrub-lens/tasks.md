## 1. The lens

- [ ] 1.1 Add the pure lens mapping (screen x to card and back, slot starts for drawing): piecewise-linear, ends at the board edges, about 15 px slots across about six cards around the pin, equal compressed slots elsewhere, no slot under 2 px (a smaller lens when needed), clamped at the ends. Unit tests: monotonic and continuous, the ends, lens slot width, re-pinning keeps the finger on the same card, a pin at an edge, a very large pile.

## 2. Scrub by position

- [ ] 2.1 Draw the pile's scrub fan across the full board width at the lens's slot positions with the card under the finger raised, stop widening the zone for a scrub, and feed the pile gesture's `scrubAt` from the lens (pinned at the press, re-pinned on a rest). The drop slot keeps its travel-based gap. Unit tests for the wiring of press, move and rest.

## 3. Verification

- [ ] 3.1 Add an e2e: the fan spans the board; a slide from the left edge to the right edge passes the first card to the last card in order; small steps inside the lens move one card each; resting at the far end re-pins so small steps there move one card each; the loupe shows the card under the finger and the fan highlights it. Update the earlier pile-scrub e2e checks that assumed travel-based scrubbing. Run lint, unit and the full e2e suites.
