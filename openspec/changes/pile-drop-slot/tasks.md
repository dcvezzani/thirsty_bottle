## 1. Open piles under a held drag

- [x] 1.1 Let a pile that has cards open under a held drag, draw the fan overlay (shared with the scrub) and the gap for the carried cards, and keep an empty pile and a quick pass dropping on top. Unit tests for which zones open.

## 2. Choose the depth

- [x] 2.1 Register the pile's drop resolver with a travel-based slot (starting at the top, the scrub's speed-dependent gain) and drop at that depth, including returning a card to its own pile. Unit tests for the slot's rules: starts on top, slow steps, a fast sweep, staying within the pile, own-pile counting.

- [x] 2.2 Show the loupe with the card at the gap while a carried card is held over an open pile (touch and pen), evaluating the drop target as soon as the pile opens, and retune the gain so ordinary finger speeds stay fine for the drop and the scrub (slow up to 300 px/s, a flick at 2000 px/s, geometric in between). Unit tests for the gain at ordinary speeds and for flicks.

## 3. Verification

- [x] 3.1 Add an e2e: hold a carried card over a pile and see it fan out with a gap; release without moving and see the card on top; hold and slide slowly then fast and drop at a chosen depth; a quick pass over the pile drops on top; the loupe shows the card at the gap and follows it. Run lint, unit and the full e2e suites.
