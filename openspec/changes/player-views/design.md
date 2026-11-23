# Design

## Context

- **Projection:** every participant already receives every zone, including other seats' hands and per-player copies. Faces are filtered by the visibility rules, and other hands carry `known: false` cards.
- **Permissions:** the reducer enforces them. Moving out of another player's hand or copy becomes a take request, moving in is allowed, and flip, shuffle and peek are refused (`OTHERS_HAND`).
- **Board:** the client board is built by `boardZones(view)` (`client/src/table/ui.ts`), which picks the viewer's own copy for each per-player slot. The hand row renders `hand:<me.seatId>`, and `SeatBar` lists the seats other than mine.
- **Live relay:** `table.drag` is relayed by `Table.drag()` in `server/src/tables.ts`. It is rate-limited per connection (`dragBucket`) and never touches state. `Table` already uses the name `viewers` for its per-player projection map.

## Goals / Non-Goals

**Goals:**
- Look at any seat's table as they see it, with the viewer's own permissions, rendered from the data already sent.
- Live, honest "who is viewing whom" presence with no persistence.

**Non-Goals:**
- Showing what the viewed player sees beyond the viewer's own visibility. Nothing hidden is revealed.
- Following the viewed player's scroll or zoom, or a "follow" mode.
- Letting players block being viewed.

## Decisions

**D1. Perspective lives on the client.**
- A UI state `viewSeat: string | null` (null means my own) decides what the board renders.
- `boardZones(view, seat = me.seatId)` picks `seat`'s copy for each per-player slot.
- No server rule changes are needed, because every action is still checked as the actor.
- Alternative considered: a server-side "view as" projection. Rejected, because it adds no information (the viewer may only see their own visibility anyway) and would duplicate projection logic.

**D2. Layout while viewing.**
- **Banner** above the board: "< Viewing Sam's table - 2 of 3 > [Mine]". Rotation follows `view.seats` order, skips empty seats, wraps around, and includes my own seat.
- **Seat bar:** shows every seat except the viewed one, so I appear as "Alex (you)" on it.
- **Viewed seat's hand:** shown as a compact row ("Sam's hand - 5"), using `CardRow` with the hand zone. Cards are backs unless known.
- **My hand row:** stays at the bottom, unchanged, so drags into Sam's zones still work.
- **Spectators:** they have no own view. `viewSeat` defaults to the first occupied seat and the banner shows no "Mine". The seats panel stays as it is today.
- **Resetting the view:** `viewSeat` resets to null when the viewed seat empties or the table changes.

**D3. Action filtering in the UI.**
- Zone sheets and selection sheets for a zone where `isOthersZone(view, z)` holds already offer only "Ask to take" / "Take" and passing.
- Zone sheets also hide Shuffle, Cut, Peek, Flip all and Deal for such zones.
- Quick flip (double tap) on another player's card does nothing.
- Drag and drop uses the existing move path. The server turns moves out into requests.

**D4. Presence protocol.**
- Client to server: `{ t: 'table.view', tableId, seat: string | null }`, rate-limited with the drag bucket.
- The server validates that `seat` exists, keeps `looking: Map<playerId, seatId>` on the `Table` (in memory), and on change broadcasts `{ t: 'table.viewers', tableId, viewers: { playerId, seat }[] }` to everyone at the table.
- `TableView` gains `viewers` with the same shape, filled from the map at snapshot time.
- Entries are cleared on `table.leave`, disconnect (connection close), kick, the seat being removed, or `seat: null`. A clear broadcasts the new list.
- Nothing is written to the table state, so saves, undo and the log are untouched.

**D5. Indicators.**
- **Viewed player:** a pill in the table top bar reads "👁 Alex, Kim" for viewing players, plus "+2 watching" for viewing spectators. Its accessible name is "Viewing your table: Alex, Kim and 2 spectators".
- **Everyone:** a viewing player's seat chip shows "viewing Sam", or "viewing you" on the viewed player's own screen.
- The client store applies `table.viewers` messages directly, outside the version sequence, as it does for drags.

## Risks / Trade-offs

- [Presence spam from fast rotation] → The rate limit applies, and the client debounces sends to 150 ms, so only the settled seat is announced.
- [Stale presence after a crash] → It is cleared on connection close. On a server restart the map starts empty.
- [Confusion about whose board is shown] → A persistent banner, plus the viewed seat's name on the per-player zone labels ("Sam's Tableau").

## Migration Plan

- No storage changes.
- Old clients ignore `table.viewers` and never send `table.view`. The update banner moves them to the new build.
