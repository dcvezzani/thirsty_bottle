# Tasks

## 1. Presence (protocol and server)

- [x] 1.1 Add `table.view` (client) and `table.viewers` (server) messages, plus `TableView.viewers` in `shared/src/protocol.ts`. In `server/src/tables.ts`, keep a `looking` map with validation, rate limiting, broadcast on change, snapshot inclusion, and clearing on leave, disconnect, kick and seat removal (D4). Verify with a server test:
  - Alex views Sam, and Sam and Kim receive the viewers list
  - a snapshot includes it
  - `seat: null` clears it, and disconnecting clears it
  - the persisted table state has no viewing data
  - an unknown seat is refused

## 2. Client view

- [x] 2.1 Add the `viewSeat` state, `boardZones(view, seat)`, the banner (previous, next, wrap, Mine), "View table" in the seat sheet, and the spectator default seat (D1, D2). Send `table.view` debounced at 150 ms. Verify with e2e tests in 3.1.
- [x] 2.2 While viewing: render the viewed seat's hand row, show the seat bar from the viewed perspective, label per-player zones with the owner's name, and keep my hand at the bottom. Hide Shuffle, Cut, Peek, Flip all and Deal on others' zones, and make quick flip on others' cards do nothing (D2, D3). Verify with a unit test for `boardZones` with a seat and for the rotation order (skipping empty seats, wrapping), and with e2e tests in 3.1.
- [x] 2.3 Indicators: the eye pill for the viewed player, with spectator count and accessible name, and "viewing Sam" / "viewing you" on seat chips, applied from `table.viewers` (D5). Verify with e2e tests in 3.1.

## 3. End-to-end and checks

- [x] 3.1 Add `e2e/player-views.spec.ts` with Alex, Sam and Kim:
  - Alex opens Sam's seat sheet and taps "View table", sees Sam's Tableau copy and Sam's hand backs, rotates next to Kim and then to Mine
  - Sam sees the eye pill naming Alex, and Kim sees "viewing Sam" on Alex's seat, both clearing on Mine
  - while viewing Sam, dragging out of Sam's Tableau asks Sam, and dropping from Alex's hand passes
  - Shuffle is not offered on Sam's Tableau
  - a spectator rotates through the seats
- [x] 3.2 Add the view banner, the eye pill and a viewing seat chip to `e2e/contrast.spec.ts`. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
