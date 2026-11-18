# Tasks

## 1. Update state and registration

- [x] 1.1 Add `client/src/update.ts`: register the service worker with `onNeedRefresh` and `onRegisteredSW`, a `useUpdate` store (`waiting`, `apply()`), 30-minute `reg.update()` checks, and a throttled check on return to the foreground; replace the bare `registerSW` call in `main.tsx`. Verify with a jsdom unit test that mocks `virtual:pwa-register`: `onNeedRefresh` sets `waiting`, `apply()` calls `updateSW(true)`, the interval and visibility checks call `reg.update()`.
- [x] 1.2 Update `server/test/app-shell.test.ts` so only `client/src/update.ts` may call `updateSW`, keeping the `sw.js` checks (no `clientsClaim`, `skipWaiting` only on the message). Verify with `npx vitest run server/test/app-shell.test.ts` after `npm run build`.

## 2. Notice and idle-lobby auto-apply

- [x] 2.1 Add the update notice (bottom bar; top bar on the table page) with "A new version is available" and a Reload button, `role="status"`, using existing color tokens. Verify with a component test (renders only while `waiting`, Reload calls `apply`) and by adding the notice to `e2e/contrast.spec.ts`.
- [x] 2.2 Add `UpdateGate` with `isIdleLobby()` (path `/`, no open dialog, no focused field), run on `waiting`, on route change, and while waiting on `/` (focusout, pointerup, 2-second interval). Verify with unit tests for `isIdleLobby()` covering a dialog open, a focused input, and other routes.

## 3. End-to-end verification

- [x] 3.1 Extend the "SW update" e2e test: at a table a simulated deploy shows the notice with no navigation, and Reload returns to the same table and hand on the new worker; in the lobby with the New table dialog open nothing reloads until the dialog closes; leaving a table with an update waiting reloads the lobby. Verify with `npx playwright test e2e/backfill.spec.ts --trace off`.
- [ ] 3.2 Run lint, all unit tests and the full e2e suite, push to `main`, and confirm after the deploy that an already-open production lobby picks up the new version without closing the tab.
