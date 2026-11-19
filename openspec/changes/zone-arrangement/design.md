# Design

## Context

- **Zone data** (`shared/src/table.ts`): `Zone` has `layout: 'pile' | 'spread' | 'free'`, `x`, `y` (0–1) and `color`. `TableState.zoneOrder` lists zone ids in creation order (hand zones included), and the projection (`server/src/projection.ts`) emits zones in that order.
- **Client layout** (`client/src/pages/Table.tsx`): the client sorts shared zones by `y`, then `x`. It renders piles in a wrapping `.pile-row` and every other zone as a full-width `ZoneBox` (`client/src/table/Zones.tsx`). The host moves zones with ↑ ↓ ← → buttons in the zone sheet (`Sheets.tsx`), which send `zoneUpdate { x | y ± 0.1 }`.
- **Host-only actions** go through the reducer's `isHost` check (`shared/src/reducer.ts`).
- **Persistence:** the server stores a JSON snapshot plus actions since then (`server/src/tables.ts`: `snapshot()`, `replay()`). Old snapshots must load.
- **Row components:**
  - Rows use `fanLayout`/`hitIndexXY`/`magnify` (`client/src/table/layout.ts`) and the `ZoneGesture` state machine (`gestures.ts`), which has one scrub axis: horizontal.
  - Drag, drop targets and edge auto-scroll live in `drag.ts` and `edgeScroll.ts`.
  - Only cards take touches on the board, so one finger elsewhere scrolls and two fingers pan anywhere (`useBoardPan`).
- **Card size:** `--card-w` is 64px on phones and 84px on larger screens, scaled by the client zoom.

## Goals / Non-Goals

**Goals:**
- One shared zone order with per-zone width and row breaks, wrapped per device.
- Host arrange mode plus accessible zone-sheet controls.
- Column layout with bounded height, a vertical scrub, and run pick-up.
- Slim empty zones, and rows of fit-width zones that shrink to fit.

**Non-Goals:**
- Wallet-style collapsed zone stacks (deferred).
- Free-form canvas positioning. `x, y` remain stored but unused for layout.
- Letting non-hosts arrange zones.
- Changing hand zones. The player's hand keeps its arc at the bottom.

## Decisions

**D1. Data and actions.**
- `Zone` gains `width?: 'fit' | 'half' | 'full'` and `newRow?: boolean`. Missing means "derive from layout": pile and column are fit, spread and free are full. Storing nothing for the default keeps old snapshots valid and lets a layout change carry the right default along.
- `ZoneLayout` gains `'column'`.
- `zoneUpdate` accepts `width` (or `null` to return to the default) and `newRow`.
- A new host-only action, `zoneMove { zone, index }`, sets the zone's position among the shared zones in `zoneOrder`. Hand zones keep their slots. It logs as a system entry ("Alex moved Discard"), like other zone edits.
- `ZoneView` exposes `width` (resolved, never missing) and `newRow`.
- *Alternative rejected:* encoding the order in `y` (sort keys). `zoneOrder` already exists and is authoritative, so reordering it is simpler and needs no renumbering.

**D2. One-time migration.**
- A pure `migrateState(s)` in `shared` runs when the server loads a snapshot, before replaying actions. If `s.zoneLayoutVersion` is missing, it re-sorts the shared ids in `zoneOrder` with a stable sort: piles first, then the others, each group by `(y, x)`. This reproduces today's visual order, where every pile sat in a row above the other zones.
- It then sets `zoneLayoutVersion = 1`.
- New tables start at version 1, and replayed actions are layout-neutral.

**D3. Flow layout with per-row card sizing.**
- A pure function `flowRows(zones, boardWidth, baseCardW, gap)` decides rows. It does this in code rather than in CSS so that rows can shrink their cards.
- It walks the order and starts a new row on `newRow`, on a full-width zone, or when the next zone won't fit.
- Natural widths:
  - Fit: one card plus zone padding.
  - Half: 50% of the board minus the gap.
  - Full: 100%.
- For a row made only of fit zones whose natural width exceeds the board, it computes `rowCardW = max(MIN_CARD_W, baseCardW * available / natural)` and keeps the row together. `MIN_CARD_W` is 40px. Seven columns at 375px need about 46px.
- Only if the row still doesn't fit at `MIN_CARD_W` does it wrap.
- The board renders rows as flex rows, and each zone receives its `cardW`, which the zone components already take as a parameter.
- Unit-tested with fixtures: the Solitaire layout at 375px and 1280px, a half/half row, row breaks, and a full zone in mid-row.

**D4. Column layout and compression.** A pure `columnLayout(faces: boolean[], cardH, cap = 2.5 * cardH)` returns each card's y offset and the total height.
- Base steps: face-down 0.07 × cardH, face-up 0.22 × cardH (rank and suit), last card full height.
- If the total exceeds the cap, steps are scaled down, but no lower than 0.035 × cardH face-down and `4px + 0.125 × cardH` face-up. The face-up floor is the rank line: the corner sits 4px from the top in a font of 0.17 × card width.
- Beyond the floors the column grows past the cap rather than hiding ranks. For example, 6 face-down plus 13 face-up cards come to about 3 card heights, and the column still scrolls with the board.
- New component `ColumnZone`: absolutely positioned cards in a one-card-wide box whose height is the computed total.

**D5. Column gestures.** `ZoneGesture` gets `axis: 'x' | 'y'`.
- With `y`, movement along the column (vertical) scrubs, and sideways movement (or a scrub leaving the column's left or right edge by `pullOut`) becomes a drag.
- Tap, long press and paint selection reuse the existing logic.
- **Fisheye:** `columnMagnify(layout, focus)` adds extra offset after the focused card (up to 0.6 × cardH) and its neighbours (0.3 and 0.1). It is drawn as an overlay that does not reflow the board. The column box keeps its compressed height, and the opened cards draw above the zones below (raised z-index) until release.
- The scrub preview bubble used by rows is shown for columns too, which matters for small shrunk cards.
- Mouse hover drives the same fisheye.
- **Pick-up:** `onDragStart(i)` takes `cards[i..end]`, unless `cards[i]` is selected, in which case it takes the selection, following group-drag rules.
- **Drop into a column:** cards always go on the end (the bottom of the cascade), wherever they are released over the column. This matches how a cascade is built and the spec's "Move a run" scenario. Reordering inside a column goes through the existing Move to… or by moving cards out and back.

**D6. Slim empty zones.**
- An empty spread, column or free zone that is not the current drop target renders a 44px bar: the label plus an inline "Empty".
- When `drag.over` is this zone, it renders full size.
- **Hit-testing glitch:** the bar sits under the dragged cards, and its height changes at that moment. To avoid flicker, the drop registry keeps the zone as the target until the pointer leaves the expanded box.
- Empty piles keep their slot, since a pile's slot is its identity and is already compact.

**D7. Arrange mode.**
- Client UI state `useUI.arranging: boolean`, host only.
- **Entry:** a long press (500 ms, under 8px of movement) on a zone label, or "Arrange zones" in the Settings sheet. The label suppresses the long-press callout (`-webkit-touch-callout: none`) and keeps its tap-to-open behavior.
- **While arranging,** the board renders `ZoneTile`s in the same `flowRows` layout instead of zones. A tile shows:
  - a grip (`touch-action: none`);
  - name and count;
  - a Fit/Half/Full segmented control;
  - a "New row" toggle.
- Card components are not rendered, so cards can't be touched. A header bar shows "Arranging zones" and Done.
- **Dragging a tile:**
  - Pointer capture on the grip.
  - The insertion index is the nearest gap between tiles in flow order, found from the tiles' rects.
  - A placeholder gap opens there.
  - On drop, it sends `zoneMove`. Moves are not optimistic; they use the normal action round trip, which is fast and avoids reorder conflicts.
- Edge auto-scroll reuses `EdgeScroller` through a small adapter (the same bands and dwell).
- It exits on Done, Escape, leaving the table, or losing the host role (an effect on `view.me.isHost`).
- **Zone sheet:** Move earlier/later send `zoneMove(index ± 1)`, width and new-row send `zoneUpdate`, and the old arrow buttons are removed.

**D8. Rendering order.** The board renders `view.zones` (already in `zoneOrder`) filtered to shared zones, with no client-side sort. The `.pile-row` special case goes away: piles are fit-width zones in the flow.

## Risks / Trade-offs

- [Shrunk cards are hard to read at 40px] → The scrub preview bubble shows them enlarged, and long press opens info. The minimum keeps rank corners legible.
- [The fisheye overlay covers zones below during a scrub] → It is temporary and ends on release. That is preferable to reflowing the whole board under the finger.
- [Long press on a label vs native scrolling on labels] → Native panning starts on movement, and the long press requires staying still for 500 ms, so they don't collide. Non-hosts get no long-press action.
- [Migration correctness for running tables] → It is pure and unit-tested on a snapshot fixture with mixed `y`/`x`. It is idempotent through `zoneLayoutVersion`.
- [Two hosts can't conflict, but a host and a role handover can] → `zoneMove` is validated server-side, and arrange mode closes when the host role is lost.
- [The removed arrow buttons are a breaking UI change] → They are replaced by clearer controls in the same sheet. The only users are hosts.
