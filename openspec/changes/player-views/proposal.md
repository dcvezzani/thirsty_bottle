# Proposal

## Why

With per-player zones, each player's board shows only their own copies, and other players' areas are reached through the seat sheet as small thumbnails. To follow the game, a player should be able to look at another player's table as that player sees it: their per-player zones in place and their hand. They should be able to rotate through the seats quickly, while the existing permissions still decide what they may do there. Players should also be able to tell when someone is looking at their table.

## What Changes

- **View another player's table.** Any player or spectator can switch their board to another seat's view. They enter it with "View table" in a seat sheet, then rotate with previous and next arrows in a banner ("Viewing Sam's table - 2 of 3"), wrapping around the seats. "Mine" returns to their own view. Spectators can rotate through all seats and start at the first seat.
- **What a view shows.**
  - Shared zones are unchanged.
  - Each per-player zone shows the viewed seat's copy in its slot.
  - The viewed seat's hand shows as a row, with faces only where the viewer may see them (open hands, or cards shown to them).
  - The seat bar lists the other players from the viewed seat's point of view.
  - The viewer's own hand stays at the bottom.
- **Permissions apply.** Everything a viewer does is checked as it is today.
  - Moving cards out of the viewed seat's hand or per-player zones asks for consent, or takes with open hands.
  - Dropping cards onto them passes the cards.
  - Flip, shuffle and peek on another player's zones are not offered.
  - Shared zones work as on the viewer's own view.
  - Turn mode is unaffected.
- **Who is viewing whom.**
  - The viewed player sees an eye pill naming everyone viewing their table, with spectators counted.
  - Everyone sees "viewing Sam" on a viewer's seat.
  - This presence is live and kept only in memory: it is not part of the table state, the log or undo. It ends when the viewer returns, leaves or disconnects.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: adds viewing other players' tables, the actions available while viewing, and the indicators of who is viewing whom.
- `realtime-sync`: adds the live viewing-presence message, kept in memory and relayed to the table like drag previews.

## Impact

- **Shared:** `protocol.ts` gains a client message `table.view { tableId, seat | null }`, a server message `table.viewers`, and a `viewers` field in the snapshot.
- **Server:** `tables.ts` keeps an in-memory map of who views which seat. It relays changes to everyone at the table, includes the map in snapshots, clears entries on leave or disconnect, and rate-limits the message like drags.
- **Client:**
  - a `viewSeat` UI state
  - `boardZones(view, seat)` picks the viewed seat's copies
  - a view banner with rotation
  - the viewed seat's hand row
  - the seat bar from the viewed perspective, with viewing labels
  - the eye pill
  - "View table" in the seat sheet
  - action filtering on others' zones using the existing `isOthersZone`
- **No change** to the reducer, table state or persistence.
