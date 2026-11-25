# Tasks

## 1. Rules (shared)

- [ ] 1.1 Add `CardInst.rot`, `rotNorm`, the `rotate` and `rotateZone` actions (schemas, reducer with flip-style permissions, log lines, touched cards, `UNDOABLE`) and the gather reset (D1), and the pure `rotationFit` (D3). Verify with reducer unit tests: rotate by 1 and by −1 wraps through 0..7; `to: 0` returns upright; a zone rotation changes every card; a refused rotation in another player's zone; undo restores; moves, draws, deals, shuffles, cuts and a pile turn-over keep the rotation; gather resets all cards, and with a deck only that deck's cards; saved states without `rot` read as upright. Verify `rotationFit` at 0°, 45°, 90°, 135° and 180°.

## 2. Projection (server)

- [ ] 2.1 Send `CardView.rot` for every visible card, omitted at 0, hidden cards included, and include rotated cards in patches (D2). Verify with projection unit tests (public, omitted at 0, present for a hidden card) and a server test over the wire: one player rotates a card and another sees it, then a move keeps it and a gather clears it.

## 3. Drawing and the loupe (client)

- [ ] 3.1 Draw rotated cards in an inner element scaled by `rotationFit` in rows, columns, piles, free zones, hands and the drag ghost (D3), and give the loupe its third view with the four-state `toggleView`, the True full drawing, the stored `'true'` choice and the three stay-open buttons (D4). Verify with unit tests of `toggleView` over card, details, true and the auto and peek starts, and component checks that Card and Details are upright while True full is rotated; with an e2e test that a rotated card keeps its slot and tap area in a spread and a column, and that the loupe cycles the three views showing the rotation only in True full.

## 4. Controls

- [ ] 4.1 Add the Rotate button to the selection toolbar, ↺, ↻ and Upright to the selection sheet, Rotate all and Upright all to the zone sheet, and ↺ and ↻ to the stay-open loupe (D5). Verify with an e2e test at 375 px that the toolbar still fits on one line with Rotate, that each control rotates the right cards by the right amount, that none is offered for cards in another player's zone, and that Gather returns them upright.

## 5. Gestures

- [ ] 5.1 Add the second-finger swipe on the loupe (classifier and handler) and the second-finger tap while carrying (the pending second pointer in `useBoardPan`, the carried cards' rotation) (D6, D7). Verify with unit tests of the swipe and tap classifiers and of the pending-pointer rule (a quick lift is a tap; movement becomes a pan; with no drag a second finger pans at once); with an e2e test using two CDP touches: swipe right and left on the loupe rotates the shown card ±45°; a second-finger tap while dragging, then a drop, lands the card rotated; a moving second finger still pans and adds no rotation; a tap on the loupe still switches the view.

## 6. Checks

- [ ] 6.1 Update `e2e/contrast.spec.ts` for the new buttons and the True full loupe, and run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, wait for CI to pass, verify the live version, then archive the change.
