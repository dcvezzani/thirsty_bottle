# Design

## Context

- **Today:** `Table.tsx` renders the viewed seat's hand as `.viewed-hand` (a `CardRow` with `--card-w` 36 px, no fan) above the viewer's own `.hand-area` (a full-size arc row). `CardRow` shows "Your hand is empty" for any hand zone with no cards.
- **Visibility:** another seat's hand reaches the client with `known: true` only for cards shown or peeked to the viewer; the rest are backs.

## Goals / Non-Goals

**Goals:**
- Make shown cards readable and give the screen back when there is nothing to read.
- Keep passing cards to the viewed player possible from the viewer's own hand.

**Non-Goals:**
- Changing who can see which cards.
- Reordering the viewed player's real hand (the order is for display only).

## Decisions

**D1. One main hand slot, two modes.**
- While viewing another seat, the bottom `.hand-area` shows the viewed hand with `arc`, at the normal card size.
- The viewer's own hand moves into a slim strip above it (`.hand-strip`): a label "Your hand · N" and a one-row `CardRow` with cards of about 36 px, keeping `dropId` and drag so passing still works.
- Back on my own table, the layout is as today.

**D2. The viewed hand's display list.**
- `known` cards first, in their hand order, then the hidden cards as a single `CardFace` back with a count badge ("+3 hidden").
- The list is display-only; it does not reorder the zone or touch handles. Tapping a shown card works as now. Tapping the hidden stack opens the seat sheet.

**D3. Adaptive size.**
- With no shown cards: a slim line, "Dave's hand · 5 · none shown to you", with a small stack of backs. It is a single row (about 44 px).
- With one or more shown cards: the full hand area, with a short height transition. The transition is skipped for reduced motion.

**D4. Empty message by owner.**
- `CardRow` takes an `emptyText` prop. The viewer's own hand keeps "Your hand is empty". A viewed hand passes "<Name>'s hand is empty".

**D5. Spectators.** They have no own hand. They get only the viewed hand, using the same rules.

## Risks / Trade-offs

- [The board height jumps when a card is shown] → The transition is short, and the change is a deliberate cue that something was shown.
- [Small drag source in the own-hand strip] → The existing gesture code and 44 px row height are kept, so touch dragging works as on tables today.
- [Hidden stack hides which cards are hidden] → That is the point: they are hidden anyway, and the count is kept.

## Migration Plan

Client-only. It ships with the normal update banner.
