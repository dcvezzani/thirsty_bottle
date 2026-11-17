# Tasks

## 1. Verification

- [x] 1.1 Keep the existing installability test, and add a test that reads `client/dist/sw.js` to assert no `skipWaiting`/`clientsClaim`, only static precache entries, and the `/api/`, `/ws` denylist. Verify that the test passes.
- [x] 1.2 Add an e2e test: with a table open, simulate a deploy by temporarily changing the served `sw.js` (route interception does not apply to the browser's service worker update fetch), after a reload so the page is controlled, and check that the page does not reload (a sentinel value on `window` survives). Verify that the test passes.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
