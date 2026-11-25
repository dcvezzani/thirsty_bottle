# Design

## Context

- **Today (`viewed-hand-priority`):** while viewing another seat, `Table.tsx` renders `ViewedHand` (a slim line, or a full-size arc row with a fade-in when cards are shown) and then the viewer's own hand as a 36 px `.hand-strip`. The hand area's height therefore depends on whether anything is shown.
- **A lone hand:** on the viewer's own table the hand is a `CardRow` with `arc`, whose height is `1.75 x card width + 8 px`, inside `.hand-area` (4 px bottom padding plus the safe-area inset).
- **Gestures:** `CardRow` runs a `ZoneGesture` per row. A sideways move after about 8 px becomes a scrub (`onScrubStart`, with the preview magnifying the card), and pulling upward or out converts it into a card drag. `useUI.drag.over` holds the drop target under a carried card, found through `[data-drop-zone]` elements.
- **Measuring:** `CardRow` reads its card size from `--card-w` and re-lays out its fan when its width changes.

## Goals / Non-Goals

**Goals:**
- One hand dock whose height never changes while viewing, and equals the height of a lone hand.
- Normal-size cards in both columns; the viewed hand first.

**Non-Goals:**
- Changing who can see which cards, or the take and pass rules.
- A draggable divider, or user-set column sizes.

## Decisions

**D1. A constant-height dock.**
- `.hand-dock` has `height: calc(var(--card-w) * 1.75 + 12px + env(safe-area-inset-bottom))`, the same box a lone `.hand-area` has, and `display: flex`.
- Both columns fill the dock's height. Each hosts a `CardRow` with `arc`, and the row height is the same as a lone hand's, so cards keep their size.
- On the viewer's own table, and for spectators' single column, the dock is the existing hand area.
- Because the dock height never changes, the board never resizes, and a row's top does not move, so the press position used by a scrub stays valid.

**D2. Column widths.**
- The focused column gets `flex: 0 0 66%` and the other `flex: 1`, with a 150 ms width transition (none for reduced motion).
- Their hand is on the left and the viewer's on the right, always. Only the divider moves.
- `CardRow` already lays out its fan from its measured width, so a resizing column re-fans by itself.

**D3. Focus state.**
- `useUI.handFocus: 'viewed' | 'mine'`, default `'viewed'`.
- It resets to `'viewed'` whenever `viewSeat` changes, including returning to my own table.
- A pure helper `nextFocus(current, event)` decides changes so it can be unit tested:
  - `scrub` in the narrow column sets that column
  - `carry` over the other column's drop zone sets that column
  - `tap`, and anything in the focused column, change nothing

**D4. Triggers.**
- **Scrub:** `CardRow` gets an optional `onScrubStart` prop. The dock passes a handler that focuses its column when it is narrow. The scrub starts after the usual slop, so a tap never reaches it.
- **Carrying:** the dock subscribes to `useUI.drag.over`. When a drag is carrying cards and its target is the zone of the narrow column, that column is focused.
- **Settle:** focus changes set `useUI.dockSettleUntil = now + 150 ms`. `CardRow` ignores scrub steps until then, then resumes from the finger's current x in the new layout, which the gesture code already supports because it re-reads the card under the finger.

**D5. The viewed column's content.**
- Reuses `viewedHandDisplay`: shown cards first (face up, in hand order), then a hidden stack with `+N hidden`. With nothing shown there are no shown cards, just the stack, at the same height.
- Empty: the column says "Sam's hand is empty".
- The stack is a button that opens the seat sheet, as today.
- The shown-first list is display only; the zone's real order is untouched.

**D6. Badges and the pulse.**
- Each column has an absolutely positioned badge on its top corner: "Sam · 5 · 2 shown" and "You · 5". It adds no height.
- When the number of shown cards in the viewed hand rises while the viewed column is narrow, the column gets a 600 ms pulse class (an outline animation, none for reduced motion). Focus is not changed.

**D7. Removed.** The slim line, the full-size switch with its fade-in, and the 36 px `.hand-strip` are removed. The `.viewed-hand-*` CSS goes with them.

## Risks / Trade-offs

- [A narrow column crowds a large hand: 20 cards in a third of a phone's width] → That is what focusing is for. One slide over it widens it.
- [A tap on a small card in a narrow column] → The existing fan hit-testing and magnification apply; selecting still works, with tighter targets.
- [The pause while columns resize feels like a stutter] → It is 150 ms, and only at the moment of the focus change.
- [Carrying a card across changes the layout under the pointer] → Only widths change, and the drop target stays under the same screen area because the dock height and sides are fixed.

## Migration Plan

Client-only. It ships with the normal update banner.
