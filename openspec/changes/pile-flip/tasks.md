# Tasks

## 1. Reducer

- [ ] 1.1 In `flipZone`, turn a pile over when no explicit `face` is given: reverse `cards`, toggle each card, animate, log "turned {zone} over". Other layouts and explicit `face` keep today's behavior. Verify with reducer unit tests:
  - an all-face-down pile A,B,C,D becomes D,C,B,A all face up;
  - a mixed pile A(down),B(down),C(up) becomes C(down),B(up),A(up);
  - a face-down spread keeps its order, all face up;
  - an explicit `face: 'up'` on a pile keeps the order;
  - undo restores order and faces;
  - the log text.

## 2. End-to-end

- [ ] 2.1 e2e on a phone: note the deck pile's bottom card (via the fan-out view or a peek), use "Flip all" on the pile, and the pile's visible top card is that former bottom card, face up. A spread's order is unchanged after "Flip all". Run the existing table e2e suites to confirm nothing else changed.

## 3. Verification

- [ ] 3.1 Run lint, all unit tests and the full e2e suite, push to `main`, and confirm the deploy.
