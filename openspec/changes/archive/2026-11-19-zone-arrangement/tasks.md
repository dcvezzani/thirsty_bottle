# Tasks

## 1. Data, actions and migration

- [x] 1.1 Add `width`/`newRow` to `Zone`, `'column'` to `ZoneLayout`, `width`/`newRow` to `zoneUpdate`, the host-only `zoneMove { zone, index }` action, and resolved `width`/`newRow` in `ZoneView`/projection. Verify with reducer unit tests:
  - reorder among shared zones with hand zones untouched;
  - index clamping;
  - non-host refused;
  - width default derived from layout;
  - `width: null` resets;
  - log entry text.
- [x] 1.2 Add `migrateState` (stable sort of shared zones: piles first, then by `y`, then `x`; `zoneLayoutVersion`) and call it when tables load. Verify with a unit test on an old-format snapshot fixture (order matches the old visual order; idempotent), and with a server test that restarts a table created without the version and checks the zone order.

## 2. Flow layout and slim empty zones

- [x] 2.1 Implement `flowRows` with per-row card sizing (`MIN_CARD_W` 40px). Verify with unit tests: Solitaire at 375px and 1280px (seven columns in one row at 375px with `cardW` ≥ 40), half + half, `newRow`, a full zone mid-order, wrapping only below the minimum.
- [x] 2.2 Render the board from `view.zones` order through `flowRows`, removing the client sort and the pile-row special case, and pass each zone its row `cardW`. Verify with e2e tests: zones appear in server order on phone and desktop with no sideways page scroll, and the existing table, gesture and scrolling e2e tests still pass.
- [x] 2.3 Slim empty spread, column and free zones (44px bar, full size while it is the drop target, stable target during the size change). Verify with e2e tests: 4 empty spreads are each about 44px tall, and dragging a hand card over an empty bar opens it and drops the card in.

## 3. Column layout

- [x] 3.1 Implement `columnLayout` (sliver and corner steps, last card full, cap 2.5 × cardH with floors) and `columnMagnify`. Verify with unit tests: 6 face-down and 6 face-up cards stay within the cap; 6 face-down and 13 face-up keep every face-up step at least the rank-line floor (the column grows instead); the fisheye opens the focused card and its neighbours and the total compressed height is unchanged.
- [x] 3.2 Add `ColumnZone` and the `'column'` option in the add-zone and zone-sheet layout selects; add `axis: 'y'` to `ZoneGesture` (vertical scrub, sideways pick-up, run pick-up unless the card is selected) and y-based drop insertion. Verify with gesture unit tests for the y axis, and e2e tests on a phone:
  - a vertical scrub changes nothing on release;
  - sideways pick-up of the 3rd of 5 moves 3 cards in order to another column;
  - a selected single card moves alone;
  - mouse hover opens cards on desktop.

## 4. Arranging zones

- [x] 4.1 Zone sheet: replace the arrow buttons with Move earlier, Move later, a Fit/Half/Full choice and "Start a new row" (host only). Verify with e2e tests: Move earlier swaps P3 with the zone before it for a second player too, a width change reflows, and a non-host sees no arrange controls.
- [x] 4.2 Arrange mode: entry by long-pressing a label (host) or Settings "Arrange zones"; tiles with grip, width and new-row controls; drag with a gap indicator and `zoneMove` on drop; edge auto-scroll; Done, Escape and losing the host role exit it. Verify with e2e tests on a phone:
  - drag Discard from last to after Stock, and a second player sees the new order;
  - a card can't be dragged while arranging;
  - holding a tile at the bottom edge scrolls;
  - handing the host role closes arrange mode;
  - a non-host's long press does nothing.

## 5. Verification

- [x] 5.1 Build a Solitaire-style table in e2e (stock, waste, 4 foundations, 7 columns with "Start a new row" on P1) at 375px. All 13 zones fit without sideways scrolling, and the first screen shows at least the top two rows. Add arrange mode, a column scrub and the slim bars to `e2e/contrast.spec.ts`.
- [x] 5.2 Run lint, all unit tests and the full e2e suite, push to `main`, and confirm the deploy.
