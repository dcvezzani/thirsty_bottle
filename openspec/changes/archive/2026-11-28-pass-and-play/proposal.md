## Why

Friends sitting around one table often have only one phone. Today every player needs their own account and device, and a hand is private only because each device is one player. Turn-based play already gives the turn order; what is missing is a way for several people to take their turns on the same phone, while remote players on their own devices keep playing in the same game.

## What Changes

- The host can add "players on this phone" to a table: guests with only a name and a colour, no sign-in. Each guest takes a normal seat and has a private hand like any other player.
- A guest is a lightweight player owned by the host's account and valid only for that table. Its identity is stored on that phone and removed when the table closes or the host removes the guest.
- The phone connects as one identity at a time, so only the active person's hand is ever on the device.
- In turn-based mode, when End turn lands on a seat on this phone, the screen shows a full cover ("Pass the phone to Kim") and the phone switches to that identity; the person taps to reveal. When the turn belongs to a remote player, the phone shows a cover ("Waiting for Alex") instead of a hand.
- In real-time mode there is no automatic handoff; a "Who's playing" switcher on the phone changes identity by hand.
- Remote players see guest seats as normal seats, marked "on a shared phone" instead of "disconnected".
- A guest whose identity is lost (phone storage cleared) becomes a vacated seat with its hand kept, for the host to resolve.
- Out of scope: guests keeping a history across tables; signing in with accounts on the shared phone; push notifications.

## Capabilities

### New Capabilities
- `shared-phone`: guest players on one device, one identity at a time, the handoff and waiting covers, the real-time switcher, and how guests appear to others and are cleaned up.

### Modified Capabilities

## Impact

- `server`: guest creation and removal endpoints, guest player records and cleanup on table close, the lobby player list excludes guests, the seat view carries a guest marker.
- `client`: guest store on the device, identity switching (tab token and socket), handoff and waiting covers, the host's "Players on this phone" controls, seat chip label.
- Tests: server tests for guest lifecycle and cleanup, unit tests for the handoff rules, an e2e with a host, two guests and a remote player.
