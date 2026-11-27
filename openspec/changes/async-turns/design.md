## Context

`nextSeat` in the reducer only picks seats whose player is in `ctx.connected`, so a pass to an offline player skips them and, with nobody else online, returns to the passer with no visible change. The server also releases a disconnected player's seat after `RECONNECT_GRACE_MS` (2 minutes) and closes a table `EMPTY_TABLE_TTL_MS` (30 minutes) after the last connection drops. Both rules fit real-time play and defeat asynchronous turns.

## Goals / Non-Goals

**Goals:** asynchronous turn-based play; a host-set idle lifetime; real-time behavior unchanged.
**Non-Goals:** push notifications; a warning before an idle table closes; a per-seat time limit.

## Decisions

- **Pass rule.** In turn mode, `endTurn` selects the next seat that has a player (`playerId` set), ignoring `ctx.connected`. With one seated player the turn stays. `autoPass` and the leave path use the same selection. Real-time mode has no active turn, so it is unaffected.
- **Seat grace by mode.** `onDisconnected` still marks the player disconnected after 5 seconds, but arms the expiry timer only when the table is real-time. On a switch to real-time the server arms grace timers for players who are currently disconnected; on a switch to turn it clears them.
- **Idle lifetime.** A new setting `idleDays` (integer 1 to 30, default 1) in table settings, changed through the existing settings action by the host only. The server keeps one timer per turn-mode table, re-armed after every applied action and every settings or mode change, and armed from the last action time on load so a restart keeps the remaining time (as `armRequestTimers` does for requests). The last action time comes from the newest entry in the persisted action history.
- **Empty-table rule.** `checkEmpty` applies to real-time tables only; a turn-based table is closed by the idle timer even when nobody is connected.
- **Migration.** Existing tables lack `idleDays`; the schema default (1) fills it.

## Risks / Trade-offs

- A player who never returns blocks the turn: the host's skip or set-active controls remain the way out.
- Tables stay in memory and storage for up to 30 days; the 30-day cap bounds this.
- Turn-mode seats never expire, so a closed table is the only cleanup for abandoned seats.
