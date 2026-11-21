# Design

## Context

- **`Pile`** (`client/src/table/Zones.tsx`):
  - `onDragStart` always starts a drag of `[cards[0]]`, ignoring any selection.
  - The free zone's drag carries the selection, but the pile's does not.
  - A single tap schedules the zone sheet after 250 ms; a double tap cancels it and flips the top card (quick-flip).
- **Zone sheet:** shows "Select all" only when `zone.layout !== 'pile'`.
- **`ZoneGesture`** (`gestures.ts`) remembers the last tap for double-tap detection and decides on release: `onDoubleTap` for a second still tap. A second press that moves becomes an ordinary drag or scrub of index 0, which on a pile is a top-card drag.
- **Drag and drop** (`drag.ts`): `startDrag(handles, from, …)`, `endDrag` → `moveCards(handles, from, to, { index })`, which sends one `move` with `predictMove`. `DragGhost` already shows a count badge for more than one card.
- **The reducer's `move`** inserts the cards at `index`, or for a pile target at index 0 (the top), in the order given.

## Goals / Non-Goals

**Goals:**
- Select-then-drag and tap-then-drag move a whole pile.
- The pile keeps its order, as one action.

**Non-Goals:**
- Dragging a whole spread or column by a gesture. Their cards are already selectable, and select-all-then-drag already works there.
- Moving part of a pile ("top N") by gesture. That is still Draw… into a zone.
- Changing two-finger scroll, hold, or a plain drag on an unselected pile.

## Decisions

**D1. Piles become selectable as a whole.**
- The zone sheet shows "Select all" for piles too. It selects every card of the pile, in pile order (top first), and closes the sheet.
- `Pile` renders a selected outline on the top card and the existing `sel-count` badge when the pile's cards are selected.
- Selecting part of a pile is still possible through Fan out. The pile shows as selected whenever any of its cards are selected, and its drag carries exactly the selected cards.

**D2. The pile's drag carries the selection.** `onDragStart` uses the selected cards of this pile, in pile order, when the top card is among them, and `[top]` otherwise. This is the same rule as the rows and free zones.

**D3. Tap-then-drag in the recognizer.**
- On `down`, if the press lands within the double-tap window and distance of the remembered tap on the same index, the recognizer marks it as a second press and calls a new `onSecondPress(index)`.
- If that press then moves past the slop, it calls `onSecondPressDrag(index, sample)` instead of starting a scrub or ordinary drag, and the rest of the gesture behaves as a drag (`onDragMove`, `onDragEnd`).
- If it is released without moving, `onDoubleTap` fires as today.
- Only callers that provide `onSecondPressDrag` get this behavior. Rows and columns don't, so their double tap and drag are unchanged.
- **Piles use the new callbacks:**
  - `onSecondPress`: cancel the pending sheet timer, so a slow drag can't open the sheet underneath it.
  - `onSecondPressDrag`: start a drag of every card in the pile, in order.

**D4. Landing.** No new drop logic. `moveCards` with the pile's handles in order lands them:
- on a pile target, at the top, as a block in the same order;
- in a spread, at the gap index from the drop registry;
- in a column, at the end;
- on a seat, through the existing pass or take-request path.
The log entry ("moved 40 cards from Standard 52 to Discard") and undo come from the single `move` action. Face states are kept, as for any move; the "face down" toggle still applies when playing from one's own hand.

## Risks / Trade-offs

- [A second press that drifts slightly turns a flip into a drag] → The slop is the usual 8 px, and a drag of a whole pile is visible and undoable within 10 seconds.
- [Moving a big face-down deck onto a face-up pile mixes faces] → That's correct physically. "All face up" and "All face down" can square it afterwards.
- [Selecting a pile, then forgetting it is selected, makes a later plain drag move everything] → The selected outline and selection bar show it clearly, which is the same trade-off rows already make. The selection clears after any move.
