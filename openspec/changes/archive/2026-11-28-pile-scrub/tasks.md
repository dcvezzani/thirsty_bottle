## 1. Scrub a pile

- [x] 1.1 Give the pile's gesture the sideways scrub (same classification as a spread) while keeping the pull-to-take drag, tap, double-tap and hold; fan the pile out in place during the scrub and collapse it on release, honoring stay-open mode. Unit tests for the classification and for the other gestures being unchanged.

- [x] 1.2 Scrub a pile by finger travel with a speed-dependent gain (slow = about one card per 12 px, fast = a screen-wide sweep covers the pile), through an optional `scrubAt` on the gesture recognizer. Unit tests for the gain, for slow stepping, fast sweeps, settling after a sweep and staying within the pile.

## 2. See face-down cards

- [x] 2.1 Add the "See face-down" chip to the loupe (second-finger tap, and a button in the stay-open controls), off at the start of every scrub, shown only where it can work. Peek the whole pile when turned on and un-peek exactly those cards when turned off or when the scrub ends, with unit tests for the chip's rules and the clean-up.

## 3. Verification

- [x] 3.1 Add an e2e: slide across a pile and see it fan out and collapse; slow movement steps one card at a time, a fast sweep reaches the end and slow movement settles on a card; turn on the chip with a second finger and see faces and one log line; end the scrub and see the cards face-down again; a new scrub starts with the chip off; pulling still takes the top card. Run lint, unit and the full e2e suites.
