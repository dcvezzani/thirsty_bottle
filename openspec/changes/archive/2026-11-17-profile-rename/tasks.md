# Tasks

## 1. Verification

- [x] 1.1 Add a server test (`server/test/lobby.test.ts`): `profile` updates presence and the seat name at the player's table, later chat messages carry the new name, and empty or over-length names are refused. Verify that the test passes.
- [x] 1.2 Add an e2e test: rename in the "You" sheet, then check the new name on another player's seat marker and in the lobby Players tab. Verify that the test passes.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
