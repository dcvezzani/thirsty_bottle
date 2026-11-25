# Tasks

## 1. The fan

- [x] 1.1 Make `viewedHandDisplay` return the ordered list (shown first, then hidden) and have `HandDock` fan it in the viewed column, removing the hidden stack and its styles (D1, D2). Verify with unit tests: the order puts shown cards first, the fan holds every card of the hand, there is no stack, and "<Name>'s hand is empty" appears only for an empty hand.

## 2. Taking from the fan

- [x] 2.1 In `SelectionBar`, show Ask to take (Take with open hands) instead of Flip and send again when the selection is in another player's hand or zone (D4). Verify with unit tests of the toolbar for own, other-player and open-hands selections.

## 3. End-to-end and checks

- [x] 3.1 Update `e2e/player-views.spec.ts` for the fan: the viewed column holds every card (shown face up first, then backs), the badge counts, and the `+N hidden` assertions go. Add: tap a back and use Ask to take, and Sam is asked for 1 card; with open hands on, dragging a back onto my own hand moves it at once; the toolbar offers Ask to take and not Flip.
- [x] 3.2 Update `e2e/contrast.spec.ts` for the fan of backs and the Ask to take toolbar. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
