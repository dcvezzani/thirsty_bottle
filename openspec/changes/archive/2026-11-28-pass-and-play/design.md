## Context

A seat belongs to one account (`seat.playerId`), a device is one account with one connection, and the server builds a separate private view per player. The client already keeps several identities per browser (`vct.identities` in localStorage, the active token per tab in sessionStorage). Since `async-turns`, a turn-based seat is kept while its player is disconnected and the turn waits for it.

## Goals / Non-Goals

**Goals:** several people play on one phone in turn order, privately, alongside remote players.
**Non-Goals:** accounts or history for guests; push notifications; anti-cheating beyond not holding other hands on the device.

## Decisions

- **Guests are ordinary players.** A guest is a row in `players` with the host's id and the table id recorded (`guest_of`, `guest_table`, nullable columns added by a migration). Because they are normal players, the reducer, projection and permissions need no notion of "acting as" another seat.
- **Creation.** `POST /api/tables/:id/guests` (host only) creates the guest with a name and colour, seats it directly (so a password or lock does not block it), and returns its token. The seat limit still applies. `DELETE /api/tables/:id/guests/:playerId` (host only) releases the seat like a player leaving and deletes the guest.
- **Cleanup.** Closing a table deletes its guests. At startup, guests whose table is closed or missing are deleted.
- **Lobby.** Guests are excluded from the lobby player list.
- **One identity at a time.** The phone keeps the guests' tokens in localStorage keyed by table, with the host's own token as the way back. Switching sets the tab token and reconnects the socket, then rejoins the table, so the previous person's view leaves memory with the old connection. In turn mode the disconnected seats are kept (`async-turns`), so switching never loses a seat.
- **Marking.** The seat view carries `guest: true`. When a guest seat is disconnected, remote clients show "on a shared phone" instead of "disconnected".
- **Handoff cover.** A client-side state machine watches the turn: when `turn.active` becomes a seat on this phone other than the connected person, it raises the cover at once, switches identity, and waits for a tap; when it becomes a remote seat, it shows the waiting cover over the current view without rendering the hand. The cover renders in place of the table so nothing underneath is in the DOM.
- **Real-time.** No watcher; a "Who's playing" sheet lists the phone's people, shows the cover, and switches on tap.
- **Lost identity.** If a guest's token is gone from the phone, the seat cannot be reconnected. A guest's seat never expires by grace (the phone is one identity at a time, so guests are normally disconnected), so the host's "Players on this phone" list flags the guest as not on this phone and offers Remove, which vacates the seat when it holds cards.

## Risks / Trade-offs

- The cover is a UI guard: a person with the app's dev tools could look at memory for the connected person's own hand only, which they could see anyway.
- Reconnecting on every handoff adds a short delay; the cover hides it.
- Guest tokens in localStorage are readable by anyone using that phone, which is the nature of a shared phone.
- Remote players see a guest as "on a shared phone" even when the phone itself is off.
