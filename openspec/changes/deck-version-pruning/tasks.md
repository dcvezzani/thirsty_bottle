# Tasks

## 1. Implementation

- [x] 1.1 Add `Decks.pruneVersions(maxAgeMs)` in `server/src/decks.ts` and call it from the hourly timer in `server/src/app.ts`, before `images.gc()`. Verify that `npx tsc -b server` succeeds.
- [x] 1.2 Add tests in `server/test/decks.test.ts`: backdate versions with SQL; superseded old versions are deleted; current versions, versions in `table_decks`, recent versions and drafts are kept; an image used only by a pruned version is removed by the following `images.gc(0)`. Verify that the tests pass.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
