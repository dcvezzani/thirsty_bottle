# Tasks

## 1. One-finger scrolling outside cards

- [x] 1.1 Move `touch-action: none` from `.card-row`, `.free-zone` and `.pile` to `.board .card`, giving the zones `pan-y` (free zone `pan-x pan-y`). Verify with an e2e test on a phone viewport: a one-finger CDP touch swipe starting on an empty zone's "Empty" area, and one starting on a zone label, scroll `.board` (`scrollTop` increases) without opening a sheet.
- [x] 1.2 Confirm card gestures are unchanged: run `e2e/table-gestures.spec.ts` and `e2e/table-actions.spec.ts`, and add an assertion that a sideways scrub on a row leaves `.board` `scrollTop` unchanged.

## 2. Two-finger pan

- [x] 2.1 Add `client/src/table/pan.ts` (midpoint delta, velocity over the last 100 ms, exponential glide) with unit tests for the delta, the velocity estimate and the glide coming to a stop.
- [x] 2.2 Add the `useBoardPan` hook on `.board` and a `cancel-card-gestures` event that `CardRow`, `Pile` and `FreeZone` handle with `gesture.cancel()` and `cancelDrag()`. Verify with an e2e test: one finger on a card, a second finger added, both moved up. The board scrolls, no card moves or is selected, and the table log has no new entry.

## 3. Edge auto-scroll while dragging

- [x] 3.1 Add edge bands (56px), a 250 ms dwell and depth-scaled speed to `drag.ts`, re-evaluating the drop target each frame. Verify with unit tests for the speed and dwell logic. Then add an e2e test on a phone with enough zones to scroll: drag a hand card, hold it in the bottom band until the last zone appears, drop it there, and the card lands in that zone. A second e2e test: a fast drag from the hand to a visible zone does not change `scrollTop`.

## 4. Verification

- [x] 4.1 Run lint, all unit tests and the full e2e suite (including `e2e/contrast.spec.ts`). Push to `main` and confirm the deploy.
