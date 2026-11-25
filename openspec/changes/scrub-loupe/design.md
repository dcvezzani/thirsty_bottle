# Design

## Context

- **Gestures today:** `ZoneGesture` (`client/src/table/gestures.ts`) is a pure state machine, one per zone: `idle → pressed → scrub | drag | longPress | tap`. A still hold of 450 ms before any movement is a long press (card info). Once a scrub starts there is no hold concept.
- **Preview today:** `useUI.preview` holds the scrubbed card; `CardRow`/`ColumnZone` enlarge it in place with `magnify` and part its neighbours. On a phone the result is still small.
- **One recognizer per zone:** a scrub cannot leave its zone, and nothing knows which zone is next to which.
- **Layout:** the board lays zones out in rows (`layout.ts`, row fitting, slim empty zones); `edgeScroll.ts` scrolls the board while dragging near an edge. Drags are rendered by a drag overlay (`drag.ts`).
- **Paint selection** (card-handling) already keeps a selection while a scrub crosses cards, and the selection toolbar is shown while anything is selected.

## Goals / Non-Goals

**Goals:** see any card large without a press-and-hold; slide across the whole table in one gesture; aim at small zones when scrubbing, selecting and dropping.

**Non-Goals:** no server, shared-rules or protocol change; no change to the desktop hover preview; no new zone-switching gesture other than sliding (vertical movement stays for pulling out to drag and for scrolling).

## Decisions

**D1. A loupe component, fixed place, side chosen at press.**
- A `Loupe` overlay renders the previewed card large (about two thirds of the screen width, capped by height). It is not interactive (`pointer-events: none`).
- Its side is decided once, on the first press of a gesture: top by default; bottom when the pressed zone's top lies in the upper 40% of the board's visible area. It is kept until release, so it never jumps and never covers the zone under the finger.
- The existing `useUI.preview` is reused as the source; the in-place enlargement remains for the desktop hover only.

**D2. Dwell is a gesture event.**
- `ZoneGesture` gains `onDwell(index)`: while in `scrub` (or `drag`), a still finger (movement under the slop) for `dwellMs = 300` fires it once per card, and moving re-arms it. It uses the existing `tick(t)` clock.
- In the loupe, a dwell during a scrub switches to the full details; moving on goes back to the large card. The 450 ms still hold before movement stays for card info.
- The same event opens a zone while dragging and pins it while scrubbing or selecting (D5, D6).

**D3. The strip is a pure ordering of the board's zones.**
- A new `strip.ts` builds the reading order from the board layout: rows top to bottom, zones left to right, only card-row (spread) zones that are not empty, and maps a card to `(zone, index)` and back. Wrapping is just the next or previous element in this list.
- A scrub that reaches the end of the current zone's cards hands over to the next strip entry. One recognizer per zone is kept; the active scrub moves to a board-level coordinator that owns the gesture from the first press to release, asks the strip which card is under the finger (hit-testing the zone under the pointer, then the card), and drives `preview`.
- The loupe names the zone and row ("Row 2 of 3 · Discard"). A haptic tick fires at each crossing, in addition to the per-card tick.

**D4. Selection stays in one zone.** The table's selection belongs to a single zone, so a stroke that paints a selection keeps painting only in the zone where it began; in other zones of the strip the scrub previews cards and the loupe follows, without selecting. A pull-out into a drag is not offered while the scrub is in another zone.

**D5. Zones widen in place; the layout is locked for the gesture.**
- A zone's open state is a per-zone width override in the row layout: the open zone takes the width it needs to fan its cards (up to the row width) and its neighbours shrink through the existing row-fitting rules.
- To avoid flicker, the open zone stays open until the finger has left it by a margin, and the row layout is locked for the rest of the gesture (as the loupe's side is), so shrinking neighbours cannot move the finger onto a different zone.
- During a drag, opening needs a dwell of 300 ms over the zone; passing over does not open it. Release drops at the slot and then closes it. The loupe shows the carried card.

**D6. Pinned open.**
- After a scrub or selection dwell, `useUI.pinnedZone` holds the zone id; it stays widened after release. Taps on its cards work as in any zone (toggle selection).
- It closes on: a tap on empty felt, the header or a control (the tap still does its own action, so nothing is swallowed); opening a sheet or drawer; clearing the selection; moving the cards out of it; pinning another zone; the table or view changing. Scrolling the board does not close it. Selection is kept when it closes.
- Implementation: one capture-phase `pointerdown` handler on the table screen closes it unless the target is inside the pinned zone, without stopping propagation.

**D7. Desktop and other modes.** Mouse keeps hover preview and right-click info. The loupe, dwell and pinned zones are touch features (pen counts as touch).

**D8. Reduced motion and readability.** Widening and the loupe fade respect `prefers-reduced-motion`; the loupe text uses the readability tokens and passes the contrast check.

## Risks / Trade-offs

- **Finger moves under the finger:** widening can shift what is under the finger. D5's lock and exit margin address it; the e2e test for a held drag guards it.
- **Coordinator rewrite:** moving scrub ownership to the board touches `CardRow`, `ColumnZone` and the dock. Mitigation: keep the pure `ZoneGesture` for per-zone logic, add the board coordinator on top, and migrate one zone type at a time behind the same tests.
- **Dwell vs long press:** both mean "a still finger", but one is after movement (dwell) and one before it (long press), so they do not overlap.
- **Hidden information:** the loupe uses the same visibility rules as card info; face-down cards show only the back and holder.
