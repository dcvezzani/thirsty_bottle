# Tasks

## 1. Gesture

- [ ] 1.1 Add `onSecondPress` and `onSecondPressDrag` to `ZoneGesture` (D3). Verify with unit tests:
  - tap, then a second press that moves fires `onSecondPress`, then `onSecondPressDrag`, with no `onDoubleTap` and no scrub;
  - tap, then a still second press fires `onDoubleTap` as before;
  - without `onSecondPressDrag`, a second press that moves is an ordinary drag or scrub;
  - a slow or distant second press is a normal press.

## 2. Piles

- [ ] 2.1 Show "Select all" for piles in the zone sheet, and show a selected pile (outline and count). The pile's drag carries its selected cards in pile order (D1, D2). Verify with e2e tests on a phone:
  - Select all on the deck shows 52 in the selection bar;
  - dragging the selected deck onto Discard moves all cards on top in their original order (compare names after "All face up");
  - the log gains one entry, and one undo restores both piles;
  - a plain drag of an unselected pile still moves one card.
- [ ] 2.2 Tap-then-drag on piles: cancel the pending sheet on the second press, and drag the whole pile on a second-press drag. Verify with e2e tests on a phone:
  - tap, then press-and-drag the deck into the Table spread moves every card there, and no sheet opens;
  - tap, then tap still flips only the top card.

## 3. Verification

- [ ] 3.1 Run lint, all unit tests and the full e2e suite (including `e2e/quick-flip.spec.ts` and `e2e/contrast.spec.ts`), push to `main`, and confirm the deploy.
