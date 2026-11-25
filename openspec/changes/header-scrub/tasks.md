# Tasks

## 1. Pure logic

- [x] 1.1 Add `zoneFocusCard(zone)` (a pile's top card, a column's last card, otherwise the first card, none for an empty zone), `ZoneGesture.beginScrub(sample)` (the recognizer starts already scrubbing on the nearest card), and a header press recognizer (tap, still hold, sideways slide, slide down out of the header) (D1, D2, D3). Verify with unit tests: the focus card for each layout and an empty zone; `beginScrub` reports the scrub start and then follows moves on both axes; the header recognizer: a tap, a still hold, a slide that cancels the hold, a slide down that reports the exit.

## 2. Header scrub

- [x] 2.1 Replace the label's handlers with the header gesture (tap opens actions, the host's still hold starts arrange mode, a slide cancels both and swallows the click), add the invisible press margin, and run a header strip over every zone with cards by letting `StripRun` walk header handles; show the focus card in the loupe with name, count and row, tick on crossings, and show details on a pause (D1, D2, D4). Verify with an e2e test sliding along the headers across a pile, a spread and a column, stepping to the next rows by holding at the screen edge and passing an empty zone, and with the existing zone-arrangement tests (tap opens actions, long press by the host starts arrange mode).

## 3. Into the cards

- [x] 3.1 Let rows and columns register `enter` handles and hand the pointer to the zone when the finger slides down from its header (D3). Verify with an e2e test: from a spread's header slide down and sideways and the loupe follows the cards; from a column's header slide down and the scrub runs vertically with no card moved.

## 4. Checks

- [x] 4.1 Update `e2e/contrast.spec.ts` or the loupe contrast test for header scrub, and run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
