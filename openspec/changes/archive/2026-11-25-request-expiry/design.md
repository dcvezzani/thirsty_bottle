# Design

## Context

- **Requests today:** take requests (`TableState.requests`, created by a move out of another player's hand) and see requests (`TableState.seeRequests`) both carry `at`, the time they were made. Neither expires. They end when answered, cancelled, or a player leaves.
- **The reducer** is pure and has no timers. The server's table session (`TableSession`) already runs timers for disconnect grace and empty tables, and it applies system actions through `system()`.
- **Undo:** `TableEngine.dispatch` clears the undo window on any action that is not undoable, system actions included. `applyUndo` restores a saved copy of the table state, requests and all.
- **Messages to one player** exist for acks and snapshots; there is no general notice message. The undo timer already works from a server-reported "ms left", not from client clocks.

## Goals / Non-Goals

**Goals:**
- Every request lapses after 5 seconds with no further effect than "no answer".
- The countdown is the same on both devices and survives a server restart.

**Non-Goals:**
- A configurable lifetime (a fixed 5 seconds for now; it can become a table setting later).
- Auto-approving or auto-declining by policy.

## Decisions

**D1. One constant.**
- `REQUEST_TTL_MS = 5000` in `shared/`, used by the server's timers and projection. The server app takes an option `requestTtlMs` (default `REQUEST_TTL_MS`) so tests can use a short lifetime.

**D2. Server timers, one per request.**
- After every `apply`, the session compares the ids in `requests` and `seeRequests` with the timers it holds: it arms `setTimeout(max(0, at + ttl - now))` for new ids and clears timers for ids that are gone.
- When a table session is created from a saved table it arms timers for the requests already in it, so a request is given only its remaining time, or expires at once if overdue.
- Expiry does not depend on the owner's connection, so an offline owner's request lapses too.

**D3. A server-only `requestExpire { id }` action.**
- The reducer removes the take request or see request with that id. If it is no longer there (answered in the same instant) the action does nothing and logs nothing.
- Log line: "<asker>'s request to see <owner>'s hand expired", or "<asker>'s request to take cards from <owner>'s hand expired".
- It is a system action: never accepted from clients.

**D4. Undo ignores bookkeeping actions.**
- `TableEngine.dispatch` leaves `undo` as it is for `requestExpire` and `seeDrop`, instead of clearing it.
- `applyUndo` carries the current `requests` and `seeRequests` over into the restored state, so an undo can never bring back a request that has expired or been answered since.

**D5. Telling the asker.**
- A new server-to-client message `{ t: 'table.notice', tableId, text }` goes to one player. On expiry the session sends the asker "George didn't answer in time". The client shows it as a toast.
- The owner is not sent a notice: their prompt simply closes.

**D6. Remaining time, from the server.**
- `RequestView` gains `msLeft = max(0, at + ttl - now)`, computed when the view is built.
- The client records `deadline = performance.now() + msLeft` the first time it sees a request id and counts down from that, so later patches do not restart the countdown and phone clocks never matter.

**D7. The countdown UI.**
- The owner's alert dialog shows the seconds left and a thin bar that shrinks over the lifetime. With reduced motion it shows the seconds only.
- The asker's waiting banner appends the seconds left to its text. At zero both show "Expiring…" until the server's removal arrives.
- A late tap on Allow or Decline gets the existing "That request has expired" error.

## Risks / Trade-offs

- [Five seconds is short on a phone] → The countdown bar sets expectations, expiry costs nothing but a second ask, and a table setting is the natural next step if it proves too short.
- [Timers firing in step with other actions] → The expiry is a no-op if the request is already gone, so races with Allow, Decline or Cancel are harmless.
- [Restoring a saved copy on undo brings back old requests] → D4 carries the current requests over.

## Migration Plan

No data migration: requests already store `at`. Clients ignore a `table.notice` they do not know, and the update banner moves them to the new build.
