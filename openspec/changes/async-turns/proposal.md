## Why

In turn-based mode, End turn silently does nothing when no other player is connected: the turn skips everyone offline and lands back on the player who pressed it. A turn-based table should also work asynchronously: pass the turn, close the app, and have the next player pick it up later.

## What Changes

- In turn-based mode, End turn passes the turn to the next occupied seat in the configured direction whether or not that player is connected. The turn waits for them; the host can still skip a seat or set the active player.
- In turn-based mode, a disconnected player keeps their seat for as long as the table exists. The 2-minute seat grace period applies to real-time mode only.
- A turn-based table closes after a number of whole days without any action. The host sets this in table settings, from 1 to 30 days, default 1. Real-time tables keep today's rules (30 minutes after the last person disconnects).
- **BREAKING (behavior)**: in turn-based mode the turn no longer skips disconnected players, and the active player's absence no longer passes the turn on by itself.
- Out of scope: push notifications for "Your turn" (the toast and vibration only reach open apps); a warning before an idle table closes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `turn-modes`: passing the turn no longer depends on connection; seats and table lifetime in turn mode; the idle-lifetime setting.

## Impact

- `shared/src/reducer.ts` (`endTurn`, `autoPass`, seat leave while active), `shared/src/table.ts` (settings schema and defaults).
- `server/src/tables.ts` (seat grace and empty-table timers by mode, idle-close timer), `server/src/app.ts`.
- `client/src/table/Sheets.tsx` (host setting), `client/src/pages/Table.tsx` (End turn).
- Tests: reducer unit tests, server timer tests, an e2e that taps End turn with two players and with the next player offline.
