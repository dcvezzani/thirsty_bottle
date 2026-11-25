# Proposal

## Why

While viewing another player's table, the hand area changes height: a slim line when nothing is shown, a full hand when cards are shown, plus the viewer's own hand squeezed into a 36 px strip. The board jumps whenever that changes, the viewer's own cards become tiny, and the two hands compete for space in a way that is hard to predict. Players want the hand area to stay one consistent height, the two hands to share it, and the viewed player's hand to come first.

## What Changes

- **One hand dock with a constant height.** While viewing another seat, the hand area is a dock as tall as the viewer's own hand area on their own table, whether or not any card is shown. The board never resizes when viewing starts, stops, or a card is shown.
- **Two columns.** The dock holds the viewed player's hand (left) and the viewer's own hand (right), both with normal-size, full-height cards.
- **Their hand is focused by default.** The focused column takes about two thirds of the width and the other about one third.
- **Sliding changes the focus.** Sliding along the narrow column, or carrying cards over it, makes it the wide one. The focus is sticky, and a tap never changes it. It returns to the viewed player's hand whenever the viewer starts viewing a different table.
- **Shown cards stay prominent.** The viewed column shows cards shown to the viewer first and face up, and hidden cards as one small stack with their count. A newly shown card makes a narrow viewed column pulse, without taking the focus.
- **Badges instead of lines.** Each column carries a small badge over its corner with the owner's name, count and number shown, so labels add no height.
- **Spectators** get one full-width column.
- **Replaces** the slim line, the full-size switch and the 36 px strip from `viewed-hand-priority`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: the requirement "What another player's view shows" is replaced by four requirements covering another seat's zones, the hand dock, focusing a hand column, and the cards shown in the viewed hand.

## Impact

- **Client:**
  - `client/src/pages/Table.tsx`: a `HandDock` replaces the viewed hand and the own-hand strip
  - `client/src/table/ViewedHand.tsx`: reworked into a column
  - `client/src/table/CardRow.tsx`: a scrub-start hook and a settle window
  - `client/src/table/ui.ts`: a `handFocus` state
  - `client/src/styles.css`: the dock and its columns
- **Tests:** `e2e/player-views.spec.ts` and `e2e/contrast.spec.ts` for the new layout; unit tests for the focus rules.
- **No server or protocol changes.**
