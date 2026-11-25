# Tasks

## 1. Rules

- [x] 1.1 Add `REQUEST_TTL_MS` and the server-only `requestExpire` action (removes a take or see request, logs it, does nothing if it is gone), and make `TableEngine` leave the undo window alone for `requestExpire` and `seeDrop` and carry current requests across an undo (D1, D3, D4). Verify with reducer unit tests: expiry removes each kind and logs it; expiring a missing id changes nothing; an undoable move made before an expiry can still be undone afterwards; an undo does not bring back an expired or answered request.

## 2. Server

- [x] 2.1 Arm a timer per pending request after each apply and when a table is loaded, apply `requestExpire` when it fires, report `msLeft` on each `RequestView`, add the `table.notice` message and send it to the asker on expiry, and add the `requestTtlMs` app option (D1, D2, D5, D6). Verify with server tests using a short lifetime: a take request and a see request expire and the owner's request list empties; the notice goes to the asker only; a late `respondTake` or `seeRespond` is refused as expired; an answer before expiry cancels the timer; a table loaded with an overdue request expires it at once and one with time left keeps only that time.

## 3. Client

- [x] 3.1 Add the countdown: record each request's deadline from `msLeft` on first sight, show the bar and seconds in the owner's prompt and the seconds in the asker's banner, and show a toast for a `table.notice` (D6, D7). Verify with unit tests of the countdown (it follows `msLeft` and is not reset by later updates, it never goes below zero) and of the texts.

## 4. End-to-end and checks

- [x] 4.1 Add `e2e/request-expiry.spec.ts`: a take request and a see request each close the owner's prompt after about 5 seconds, the card has not moved and nothing is shown, the asker is told and can ask again at once, a late Allow does nothing, and the countdown text is shown while pending.
- [x] 4.2 Update `e2e/contrast.spec.ts` for the countdown bar and text. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
