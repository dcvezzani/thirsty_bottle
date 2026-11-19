# Tasks

## 1. Gesture and flip helper

- [x] 1.1 Add double-tap detection to `ZoneGesture`: `onDoubleTap`, same index, 300 ms, 12 px, forgotten after a scrub, drag, long press or cancel. Verify with unit tests: a double tap fires `onDoubleTap` once and not a second `onTap`; slow, far-apart or different-card taps stay single taps; a third tap starts fresh; a scrub in between resets.
- [x] 1.2 Add the `quickFlip(zoneId, h)` helper: whole selection when the card is in it (then clear), otherwise that card only, with `predictFlip`. Make `CardsSheet`'s Flip use it. Verify with a jsdom unit test of the selection rules, using a mocked send.

## 2. Zones and selection bar

- [x] 2.1 `CardRow`, `ColumnZone` and `FreeZone`: on a double tap, undo the first tap's toggle and call `quickFlip`. `Pile`: delay the single tap by 250 ms and flip the top card on a double tap. Verify with e2e tests on a phone:
  - double-tapping a face-down spread card flips it, nothing stays selected, and the log gains one flip entry;
  - double-tapping a card in a 3-card selection flips all 3 and clears the selection;
  - double-tapping an unselected card while 2 are selected flips only it and keeps the 2;
  - double-tapping the deck pile turns its top card face up without opening the sheet, while a single tap still opens it.
- [x] 2.2 Add Flip to the selection bar. Verify with an e2e test: select 3 face-down cards and tap Flip, and all 3 turn face up in one action and the selection clears. Add the selection bar to `e2e/contrast.spec.ts` if it is not already covered.
- [x] 2.3 Verify the edge cases with e2e tests:
  - a mouse double-click on desktop flips a card;
  - in turn-based mode, a non-active player's double tap on a shared card is refused with the turn message and the card stays as it was;
  - single tap, scrub and long press still behave as before (the existing gesture suites pass).

## 3. Verification

- [x] 3.1 Run lint, all unit tests and the full e2e suite, push to `main`, and confirm the deploy.
