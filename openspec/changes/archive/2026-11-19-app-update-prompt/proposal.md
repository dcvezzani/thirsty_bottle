# Proposal

## Why

A new deploy never reaches players who keep the app open or simply reload it. The service worker downloads the new version and then waits until every tab of the site is closed, and nothing tells the player an update is waiting. After the card-count-input deploy, a player reloaded several times and still saw the old controls. The rule that updates never interrupt a game is right; the missing parts are telling the player about an update and applying it when nothing is at stake.

## What Changes

- When a new version is waiting, the app shows a small "A new version is available" notice with a **Reload** button on every page. Tapping it switches to the new version right away. At a table, the reload brings the player back to the same table, seat and hand through the existing reconnect.
- In the lobby, with no dialog open and no field being typed in, a waiting version is applied automatically. This also happens when the player returns to the lobby from a table. Opening the app after a deploy therefore lands on the new version within seconds, with no action.
- At a table, in the deck editor, or in the lobby while a dialog or field is in use, the app never reloads on its own. It only shows the notice.
- The app checks for a new version at launch, when it comes back to the foreground, and every 30 minutes while open, so long-open tabs also find updates.
- The current rule that updates wait until the app is closed is replaced by the rules above. A game is still never interrupted unless the player taps Reload.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `app-shell`: "Updates never interrupt a game" now allows updates when the player chooses to reload, or automatically in an idle lobby. Added requirements cover the update notice, automatic updates in the lobby, and checking for new versions.

## Impact

- Client: service-worker registration in `client/src/main.tsx`, a new update notice component and store state, plus styles.
- Tests: `server/test/app-shell.test.ts` currently asserts the client never sends the skip-waiting message, so it changes to allow the one sanctioned path. The service-worker update e2e test in `e2e/backfill.spec.ts` is extended for the notice, the table reload and the lobby auto-apply.
- No server, API or data changes. The service worker's caching rules (static files only, never `/api` or `/ws`) are unchanged.
