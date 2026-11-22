# Tasks

## 1. Setup model and expansion

- [x] 1.1 Add the `SetupContent` schema and `expandSetup` (D1, D2). Verify with unit tests:
  - Klondike for 1 player (zone deals, stock gets the rest);
  - a per-seat hand of 7 and per-seat counters for 3 players, with names substituted;
  - counts by player count;
  - 'rest' to 3 hands (18/17/17, extras to the first seats);
  - refusals: player range, too few cards, a fixed deal with the wrong player count;
  - a fixed-deal plan.

## 2. Table action

- [x] 2.1 Add the `applySetup` reducer action (D3): clear and rebuild zones, decks, cards and counters; shuffle; assign; set `lastSetup`; log; host only; undoable. Verify with reducer unit tests: seats and players kept, chat and log kept, counts and faces as planned, two applies give different deals with the same counts, a fixed deal is exact, undo restores the previous table, and replaying the action gives the same state.

## 3. Storage, API and table messages

- [x] 3.1 Add the setups tables and the service with deck-like lifecycle routes (D5). Verify with server tests: create, draft, save (versions), clone ("… (copy)", as for decks), archive, delete only when archived, owner-only access.
- [x] 3.2 Add the `table.applySetup` message and `setupId` on `table.create` (D6). Slots resolve through deck access rules, and refusals change nothing. Verify with server tests: apply with defaults and with a swapped deck, refusal for a small deck and for the player range, Play again with `lastSetup`, and the result surviving a server restart.
- [x] 3.3 Add record-setup from a live table (D4). Verify with a server test: a Klondike-like table records 13 zones with their deals; equal hands become a per-seat hand; "Alex score" and "Sam score" become a per-seat counter; the player range equals the current count.

## 4. Client

- [x] 4.1 Setups page and setup editor (D7). Verify with e2e tests: create from scratch, edit, discard or save (version), clone, archive, then delete.
- [x] 4.2 Table: Save table as setup, Apply setup… (with slot swapping), and Play again with confirmation. Verify with e2e tests on a phone:
  - build Klondike by hand, save it as a setup, and save the draft;
  - on a new table with 1 player, apply it and see the zones in order with P1..P7 holding 1..7 cards (the last face up);
  - Play again deals again with the same counts;
  - undo restores the previous table.
- [x] 4.3 New table dialog setup choice, plus multi-player checks. Verify with e2e tests: create a table from a per-seat setup with 3 seated players (each hand gets its count, per-seat counters by name); applying outside the player range shows the refusal; contrast checks for the Setups page, the editor and the Apply sheet.

## 5. Verification

- [ ] 5.1 Run lint, all unit and server tests and the full e2e suite, push to `main`, and confirm the deploy.
