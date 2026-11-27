## 1. Guest players on the server

- [ ] 1.1 Add the guest columns (migration), guest creation and removal endpoints for the host with seating and the seat limit, cleanup on table close and at startup, exclusion from the lobby list, and the `guest` flag on the seat view. Server tests for each requirement of "Guest players on a phone" and "Guests among other players".

## 2. Switching and covers on the client

- [ ] 2.1 Add the device's guest store, identity switching (tab token, reconnect, rejoin), and the handoff and waiting covers driven by the turn, with unit tests for the handoff rules (next seat local, next seat remote, host-set turn, the end of the game).
- [ ] 2.2 Add the host's "Players on this phone" controls to table settings, the real-time "Who's playing" switcher, and the "on a shared phone" seat label.

## 3. Verification

- [ ] 3.1 Add an e2e with a host, two guests on one phone and a remote player: pass the turn through all of them, check no hand is visible behind a cover, a lost guest becomes vacated, and removing a guest frees its seat. Run lint, unit and the full e2e suites.
