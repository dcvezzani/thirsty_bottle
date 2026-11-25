# Proposal

## Why

While viewing another player's table, their hand shows only the cards shown to the viewer, fanned, plus one stack of backs labelled "+6 hidden". With nothing shown, the column is almost empty: one card back and a number. It does not look like a hand, the count has to be read as text, and the hidden cards cannot be reached individually. Players want their hand fanned like the viewer's own.

## What Changes

- **The whole viewed hand is fanned,** in the same arc, spacing and tilt as the viewer's own hand. Cards shown to the viewer come first, face up; the rest follow as backs. The "+N hidden" stack goes away, since the badge already carries the count.
- **Every card in the fan is interactive,** the backs included. Tapping selects, sliding previews (a back shows only its back), and dragging out is a take. Taking follows the existing rules: it asks the owner, or happens at once when open hands is on. A player can pick a card blindly by position, as in Old Maid or Go Fish.
- **The selection toolbar fits another player's cards.** While the selection is in another player's hand or zone, the toolbar offers Ask to take (Take with open hands) instead of Flip and the send-again button, which the table already refuses there.
- **Unchanged:** the order of the owner's real hand, the focus rules of the hand dock, the badges and pulse, and the take and pass permissions.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: "Cards in the viewed hand" now describes the full fan; a new requirement "Picking from the viewed hand" covers interaction and the toolbar.

## Impact

- **Client:**
  - `client/src/table/handFocus.ts`: the display list returns shown then hidden cards in one list
  - `client/src/table/HandDock.tsx`: the whole fan replaces the shown-only row and the stack
  - `client/src/table/Sheets.tsx`: the toolbar's controls for another player's selection
  - `client/src/styles.css`: the hidden-stack styles go
- **Tests:** unit tests for the display list and the toolbar; e2e tests for the fan, the blind pick and the toolbar; contrast.
- **No server or protocol changes.**
