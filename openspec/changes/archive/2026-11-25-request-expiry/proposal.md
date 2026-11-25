# Proposal

## Why

A request to take cards from a hand, or to see a hand, puts a full-screen prompt in front of the owner and waits for an answer indefinitely. A request to an owner who has left the app or lost signal is still waiting when they return minutes later, and it blocks their screen until they deal with it. Requests should lapse on their own, quickly.

## What Changes

- **Requests expire after 5 seconds.** This applies to both kinds: taking cards out of another player's hand, and asking to see a hand. The time is a fixed 5 seconds from when the request is made.
- **Expiry means no answer.** Nothing is taken and nothing is shown. The owner's prompt closes, the asker's waiting banner goes away and their control comes back, so they can ask again at once. The log says the request expired, and the asker gets a short notice. A late Allow or Decline is refused as expired.
- **A visible countdown.** The owner's prompt shows the seconds left with a shrinking bar, and the asker's waiting banner counts down too. Both follow the server's remaining time, not the phones' clocks.
- **The server decides.** Expiry runs on the server, so it works if the owner's device is offline, and it is re-armed after a server restart from each request's creation time.
- **Undo is untouched.** An expiry does not end anyone's undo window.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: new requirements "Requests expire" and "Request countdown", covering both kinds of request. The existing requirements stay as they are.

## Impact

- **Shared:** a `REQUEST_TTL_MS` constant; a server-only `requestExpire` system action that removes the request and logs it; the undo engine ignores that action and keeps current requests when restoring.
- **Server:** a timer per pending request, armed after each change and when a table is loaded; remaining time reported with each request; a new `table.notice` message to tell the asker; an app option for the lifetime so tests can run quickly.
- **Client:** the countdown in the owner's prompt and the asker's banner, and the toast for a notice.
- **Tests:** reducer, server and client unit tests; e2e tests for both kinds; contrast.
