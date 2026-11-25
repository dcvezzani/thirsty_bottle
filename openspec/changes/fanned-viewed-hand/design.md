# Design

## Context

- **Today (`shared-hand-dock`):** `HandDock` renders the viewed column as a `CardRow` (arc) holding only the cards shown to the viewer (`viewedHandDisplay(...).shown`), followed by a `hidden-stack` button ("+N hidden") for the rest. With nothing shown the row is empty.
- **Rows:** `CardRow` already fans any list of `CardView`s, hit-tests, scrubs and drags them. A back (a card with `known: false`) previews only its back image.
- **Takes:** moving cards out of another player's hand is already handled by the reducer: a request the owner answers, or an immediate move when open hands is on. The Actions sheet already offers "Ask to take" for a selection in another player's hand.
- **Toolbar:** the selection toolbar (`stable-selection-bar`) shows Flip and send again for any selection.

## Goals / Non-Goals

**Goals:**
- The viewed hand looks and behaves like the viewer's own hand, hidden cards included.

**Non-Goals:**
- Any change to what the viewer may see, or to how takes are approved.
- Reordering anyone's real hand.

## Decisions

**D1. One ordered list for the fan.**
- `viewedHandDisplay(cards)` returns `{ shown, hidden, total, ordered }`, with `ordered = [...shown, ...hidden cards]`. The shown cards keep hand order, then the hidden ones keep hand order.
- `HandDock` passes `ordered` to `CardRow` through the existing synthetic zone (`{ ...viewed, cards: ordered }`). The zone id is unchanged, so selection, drops and drags refer to the real zone and the real handles.
- The display order never reaches the server; actions send handles.

**D2. Remove the stack.**
- The `hidden-stack` button, its `+N hidden` label and its CSS are removed. The badge carries the count, and the seat chip opens the seat sheet.
- The empty text "<Name>'s hand is empty" is kept only for a hand with no cards. With nothing shown the row now holds backs, not nothing.

**D3. Interaction is the row's own.**
- No special-casing: tap selects, slide previews, drag out starts a drag, as for any row. The server turns the move into a request or, with open hands, performs it.
- Double-tap flip already does nothing on another player's cards (`quickFlip` guards `isOthersZone`).

**D4. The toolbar for another player's selection.**
- In `SelectionBar`, when `isOthersZone(view, selZone's zone)`, render the count, ✕, **Ask to take** (label **Take** when `settings.openHands`) and ⋯, and omit Flip and send again.
- Ask to take calls `moveCards(handles, selZone, hand:<my seat>)`, the same call the Actions sheet makes, and is disabled without a seat.
- This also makes the toolbar consistent with the existing requirement that Flip is not offered on another seat's zones.

## Risks / Trade-offs

- [Backs in the narrow column overlap heavily] → The same as the viewer's own narrow hand, and a slide over the column focuses it (`shared-hand-dock`).
- [A blind pick reveals nothing but still reaches the owner as a request] → That is the intended consent flow; the request shows only the count, as today.
- [Scrubbing backs previews only their back, which is repetitive] → An existing, specified behavior (hidden cards preview only their back).

## Migration Plan

Client-only. It ships with the normal update banner.
