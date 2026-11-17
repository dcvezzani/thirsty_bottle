# Tasks

## 1. Verification

- [ ] 1.1 Add `server/test/hosting.test.ts` covering startup output, single-port serving (HTML for `/` and `/t/x`, 200 from `/api/health`, WebSocket upgrade at `/ws`) and `PORT`/`DATA_DIR` (files created in the temp dir). Verify that the test passes.
- [ ] 1.2 Extend it: SIGTERM mid-game exits with 0, and a restart restores the table. Verify that the test passes.
- [ ] 1.3 Assert that `client/vite.config.ts` sets `server.host: true` (a config unit test). Verify that the test passes.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
