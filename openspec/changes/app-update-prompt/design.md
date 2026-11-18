# Design

## Context

- `client/src/main.tsx` calls `registerSW({ immediate: true })` from `virtual:pwa-register` with `registerType: 'prompt'` (vite-plugin-pwa 0.21). A new service worker installs and waits. The generated `sw.js` activates it only when it receives a `SKIP_WAITING` message, which the app never sends.
- `server/test/app-shell.test.ts` enforces that the client source never sends `SKIP_WAITING` or calls `updateSW(`. `e2e/backfill.spec.ts` ("SW update") proves that a waiting worker does not navigate an open table page.
- Player identity is per tab in `sessionStorage`, and the table route `/t/:id` reconnects on load. So a reload at a table returns to the same seat and hand; the cloud-hosting live check verified the same path across a server restart.
- Routes: `/` is the lobby, `/decks` and `/decks/:id` are the deck library and editor, `/t/:id` is a table. Dialogs render `role="dialog"` or `role="alertdialog"` inside `.overlay`.

## Goals / Non-Goals

**Goals:**
- Tell the player when an update is waiting, and let them apply it with one tap.
- Apply it automatically only when nothing is lost: an idle lobby.
- Find updates in long-open tabs.

**Non-Goals:**
- Release notes or "what's new" content.
- Forcing updates on clients that are too old (no version handshake with the server).
- Changing what the service worker caches.

## Decisions

**D1. Keep `registerType: 'prompt'` and drive activation from the app.** `registerSW({ onNeedRefresh, onRegisteredSW })` returns `updateSW(reload=true)`, which posts `SKIP_WAITING` and reloads when the new worker takes control. The update flag goes into a small zustand slice (`useUpdate`: `{ waiting: boolean, apply(): void }`). `registerType: 'autoUpdate'` was rejected because it reloads every open page, including tables, which breaks the game rule.

**D2. Idle-lobby check.** `isIdleLobby()` is true when the path is `/`, there is no `.overlay [role=dialog], .overlay [role=alertdialog]`, and `document.activeElement` is not an `input`, `textarea`, `select` or `[contenteditable]`. An `UpdateGate` component mounted in `App` runs it:
- when `waiting` becomes true,
- on every route change,
- and on `focusout`, `pointerup` and a 2-second interval while `waiting` and on `/`, so a busy lobby applies the update as soon as it is idle.

When idle, it calls `apply()`. The deck library list (`/decks`) is excluded for simplicity; the notice covers it. Watching the DOM for dialogs was chosen over adding a store flag to every dialog, which would touch many components and would miss future dialogs.

**D3. Notice UI.** A bar at the top of every page, in normal layout flow directly under the connection banner, so it pushes content down instead of covering it. It holds "A new version is available" and a **Reload** primary button with a full-height tap target, and uses `role="status"` and `aria-live="polite"`. It has no dismiss button; it is small and the update is worth taking. Colors use the existing `--panel`/`--ink`/`--control-line` tokens and are checked by the contrast e2e. (A bottom bar was considered but rejected: the table's hand area occupies the bottom.)

**D4. Checking for updates.** In `onRegisteredSW(url, reg)`:
- call `reg.update()` every 30 minutes,
- and on `visibilitychange` when the page becomes visible, throttled to once a minute.

The browser already checks at launch (navigation). Errors from `update()` while offline are swallowed.

**D5. Test changes.** `app-shell.test.ts` changes from "never sends `SKIP_WAITING`" to "only `client/src/update.ts` may call `updateSW`". The `sw.js` assertions (no `clientsClaim`, `skipWaiting` only on the message) stay. The e2e test simulates a deploy the same way the existing test does: append to `client/dist/sw.js`, call `reg.update()`. It then asserts:
- at a table: no navigation and the notice is visible; Reload then returns to the same table with the same hand;
- in the lobby with the New table dialog open: no reload; closing the dialog reloads on the new worker;
- leaving a table with an update waiting: the lobby reloads.

## Risks / Trade-offs

- [An unsent chat message in the lobby drawer is lost if the field is not focused when the update applies] → The chat input counts as a field while focused, and the drawer is a dialog while open, so the lobby is not idle then. A draft left in a closed drawer is lost; this is accepted as rare.
- [Reload loops if a deploy is broken] → `updateSW` reloads once per new worker. The health smoke check in the Deploy workflow already blocks bad deploys.
- [Two tabs: activating in one tab switches the worker for all] → Other tabs keep their already-loaded page code until they reload. A table tab is not navigated by `controllerchange` because only the tab that called `updateSW` reloads.
