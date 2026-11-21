# Proposal

## Why

Moving a whole deck from one zone to another has no direct gesture. Dragging a pile takes only its top card. The menu routes are indirect:
- "Gather all here" pulls in every zone's cards, not just one pile's.
- Fan out → Select all → Actions… → Move to… takes four or more steps.
- Removing a zone moves its cards, but only as part of deleting the zone.

## What Changes

- **Select, then drag (the existing group-drag model, extended to piles).**
  - The zone sheet's "Select all" becomes available for piles. It is hidden for piles today.
  - A selected pile is shown as selected, and the selection bar shows its count, so "Move to…", "Send again", Flip and Clear apply to the whole pile.
  - Dragging a selected pile carries the whole stack, as dragging a selected card in a row carries the selection.
- **Tap, then drag (a shortcut on piles).**
  - Tap a pile, then within the double-tap window press it again and move: the whole pile follows the finger.
  - Press again and lift without moving: the top card flips, as today.
  - The pending tap that would open the pile's sheet is cancelled as soon as the second press lands.
- **How a moved pile lands:**
  - **On a pile:** on top, with its order unchanged.
  - **On a spread:** at the drop gap.
  - **On a column:** at the end.
  - **On a seat:** passed to that hand, or a take request for another player's hand, as for any drag.
  - It is one action with one log entry and one undo.
- **Unchanged:** dragging an unselected pile still takes only the top card; hold for info and two-finger scrolling behave as now.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `card-handling`: a new requirement, "Moving a whole pile", covers selecting a whole pile and dragging it, the tap-then-drag shortcut, how the pile lands, and that it is a single action.

## Impact

- **Client:**
  - the zone sheet shows "Select all" for piles;
  - `Pile` shows its selected state, and its drag carries the selection;
  - the gesture recognizer reports a second press that starts moving within the double-tap window, which piles turn into a whole-pile drag and use to cancel the pending sheet.
  - Drops reuse the existing move path (`moveCards`), which already sends one `move` action for many cards and predicts it optimistically.
- **No server or protocol changes.**
- **Tests:** gesture unit tests for the second-press drag, and e2e tests on a phone:
  - select all on the deck and drag it onto Discard, keeping the order;
  - drag it into a spread;
  - tap-then-drag;
  - tap-then-release still flips;
  - an unselected drag still takes one card;
  - one undo restores everything.
