# Design

## Context

- **Zones today:** a `Zone` is `kind: 'shared' | 'hand'`, and hand zones carry a `seatId`. `zoneOrder` lists every zone id. `locate()` walks it to find cards, so every zone must be listed in it.
- **Seats:** `addSeat` creates `hand:<seat>` and appends it to the order. `removeSeat` refuses while the hand holds cards.
- **Visibility:** `canSee` gives hand cards to their owner only. `isPublic` is `shared && faceUp`.
- **Control:** `isOthersHand` gates take requests (`OTHERS_HAND`, with the take-request flow) and refuses flip, shuffle and peek in someone else's hand unless `openHands` is on.
- **Setups:** `expandSetup` turns a per-seat zone into independent shared zones keyed `key#i`. `recordSetup` records shared zones only.
- **Client:** the board renders zones in `zoneOrder`, skipping hands, which render in the hand row. The seat bar reads `handCount`.

## Goals / Non-Goals

**Goals:**
- One definition gives one copy per seat, kept in sync with seats.
- Visibility uses the existing face rules, with no new visibility branch. Control reuses the hand gates.

**Non-Goals:**
- Rotating through other players' views (a separate change).
- Per-player zones for spectators.
- Per-copy names or layouts.

## Decisions

**D1. A new zone kind `player`, with `seatId` and `group`.**
- Each copy is a real `Zone`: `kind: 'player'`, `seatId`, `group: string` (the definition id), and `id = <group>:<seatId>`.
- Copies keep all existing per-zone machinery: cards, pos, counts, undo and snapshots.
- Alternative considered: one zone whose cards are keyed by seat. Rejected, because every card operation, `locate` and projection assume a card lives in exactly one zone.

**D2. Copies are adjacent in `zoneOrder`.**
- All copies of a group sit together in `zoneOrder`, in seat order, so `locate` keeps working.
- The board treats the run as one slot. It renders the viewer's copy where the group's first copy is, and skips the others.
- Group-level operations apply to every copy:
  - `moveZone` / arrange of any copy moves the whole run
  - `setZone` (name, layout, color, width, newRow) updates every copy
  - `removeZone` removes every copy, requiring them all empty, as for zones now
- `newRow` and `width` are read from the first copy.

**D3. Seats.**
- `addSeat` inserts a copy for each existing group, after the group's last copy.
- `removeSeat` refuses when any of the seat's copies hold cards (`SEAT_HAS_CARDS`), then deletes them.
- An `addZone` action with `perPlayer: true` creates a copy for every current seat.
- A vacated seat keeps its copies, like its hand.

**D4. Visibility is unchanged.**
- `canSee` already falls through to `card.faceUp` for non-hand zones, so per-player zones behave like shared zones for faces, owner included.
- `isPublic` changes from `kind === 'shared' && faceUp` to `kind !== 'hand' && faceUp`, so log naming follows the face.
- Log text names the zone as "<owner>'s <name>", and as "their <name>" for the actor.

**D5. Control reuses the hand gates.**
- `isOthersHand` becomes `isOthersOwned`, true for `hand` and `player` zones owned by another seated player. Every existing check then applies unchanged:
  - take-request on moves out
  - refusal for flip, shuffle, peek, arrange and draw
  - `openHands` bypass
- Moves *into* another player's copy stay allowed, matching passing to a hand.
- Messages read "That is another player's <zone>".
- Take requests gain an optional source zone. Today they assume `hand:<seat>`; `from` zone = `req.zone ?? handZoneId(seatId)`.

**D6. Projection and seat summary.**
- Projection sends every copy, as it does for hands today, with cards hidden by the normal rules. The client can then show others' copies in the seat sheet.
- `SeatView` gains `zoneCounts: { group: string; name: string; count: number }[]`, built from that seat's `player` copies.
- `ZoneView` passes through `group`.

**D7. Client.**
- `Board`/`flow`: in the order, a `player` zone renders only when `seatId === me.seatId`. Its label is "<name> - yours", with the count kept by zone-count-label. Spectators and players without a seat skip the group.
- `SeatBar`: after the hand count, show "<name> <count>" for each `zoneCounts` entry.
- Seat sheet: a section per copy of that seat, using the existing `CardRow` read-only rendering (faces per projection). It offers "Ask to take" / "Take" (open hands) through the existing take flow, and accepts drops or "Pass to" through the existing move into that zone id.
- Table settings: "Add zone" gains a "One per player" checkbox.
- The zone sheet on another player's copy, reached from the seat sheet, shows only the allowed actions.

**D8. Setups.**
- `expandSetup` produces a plan zone `{ key, perPlayer: true }` instead of `key#i` copies. Deals target `{ key, seat: i }`.
- `applyToTable` creates the group with `addZone(perPlayer)` and deals into each copy.
- `recordSetup` records each group (not each copy) as `perSeat: true`. Its deal is taken from the copies when they are equal, and from the first copy otherwise.
- Home zones still can't be per-seat (existing validation).

## Risks / Trade-offs

- [Order invariants (adjacency) could break through an existing path that splices `zoneOrder`] → A `normalizeOrder()` helper regroups copies after any order change, with a reducer test asserting adjacency after add, move, remove and seat changes.
- [Old clients seeing kind `player`] → The update banner and auto-apply already move clients to the new build. Unknown kinds would otherwise render as shared, which is acceptable.
- [Undo across seat add/remove] → Seat changes are already not undoable. Card moves into copies undo like any move.

## Migration Plan

- No storage migration. Table state gains optional fields, and snapshots without `player` zones are unchanged.
- Rollback: tables created with per-player zones would show their copies as ordinary zones on old code.
