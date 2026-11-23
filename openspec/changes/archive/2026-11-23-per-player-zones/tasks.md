# Tasks

## 1. Table model and rules (shared)

- [x] 1.1 Add zone kind `player` with `group`. `addZone({ perPlayer })` creates a copy per seat (D1, D3). `addSeat` and `removeSeat` maintain copies (refusing while a copy holds cards). Add `normalizeOrder` to keep copies adjacent (D2). Verify with reducer unit tests:
  - add with 2 seats gives 2 copies
  - a new seat gets a copy
  - a seat with cards in a copy can't be removed
  - copies stay adjacent after moveZone and arrange
- [x] 1.2 Make group edits apply to every copy: `setZone` (name, layout, color, width, newRow), `moveZone`, and `removeZone` (all copies empty) (D2). Verify with unit tests for each edit across copies.
- [x] 1.3 Visibility and control (D4, D5):
  - `isPublic` for non-hand faces
  - `isOthersOwned` gates for take, flip, shuffle, peek, draw and arrange
  - the open-hands bypass, passing in allowed, and take requests with a source zone
  - log names "<owner>'s <zone>"

  Verify with unit tests:
  - face-up visible to others and named in the log; face-down hidden from the owner too
  - another player's take creates a request; with open hands it moves
  - another player's flip is refused; passing in works

## 2. Server projection

- [x] 2.1 Project `group` on `ZoneView` and `zoneCounts` on `SeatView` (D6). Verify with a server test: two clients see each other's copies with face-down cards hidden, and counts in the seat views.

## 3. Client

- [x] 3.1 Board: render only the viewer's copy in the group slot, labelled "<name> - yours" with its count. Spectators see none (D7). Verify with e2e tests in 4.1.
- [x] 3.2 Seat bar counts per per-player zone. The seat sheet lists that seat's copies with cards, ask/take and pass. The zone sheet limits actions on others' copies (D7). Verify with e2e tests in 4.1.
- [x] 3.3 Add the "One per player" option to Add zone in table settings. Verify with e2e tests in 4.1.

## 4. Setups and end-to-end

- [x] 4.1 Add `e2e/per-player-zones.spec.ts` (two players, then a third joining):
  - host adds per-player "Tableau", and each player sees only their own in the same slot
  - Alex moves a face-up card in, Sam sees it in Alex's seat sheet and the log names it
  - a face-down card is hidden in both views
  - Sam's take asks Alex
  - Sam passes a card in
  - the seat bar shows counts
  - Kim joins and gets an empty Tableau
- [x] 4.2 Setups: per-seat zones expand to a per-player group with deals into each copy, and `recordSetup` records groups as per-seat (D8). Verify with unit tests in `shared` setups tests, and with a server apply-setup test for a late joiner getting an empty copy.
- [x] 4.3 Add a per-player zone and the seat sheet to `e2e/contrast.spec.ts`. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
- Explore the separate "rotating player views" change.
