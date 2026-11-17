# Tasks

## 1. Verification

- [ ] 1.1 Extend `server/test/decks.test.ts` with report idempotence (two reports by the same player create one row) and the built-in exemption. Verify that the tests pass.
- [ ] 1.2 Add `server/test/admin.test.ts`: report a deck, run `admin.js reports`, `unhide` and `hide` against the temp `DATA_DIR`, and assert the output and gallery visibility after each. Verify that the test passes.
- [ ] 1.3 Add a usage line for the admin CLI to `docs/deck-format.md` (lifecycle section). Verify that the documented commands run as written.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
