# Tasks

## 1. Verification

- [ ] 1.1 Extend the "serves images only to players who can access them" test in `server/test/decks.test.ts` with link decks (refused without `share`, served with it) and table participants (served while seated, refused after leaving). Verify that the tests pass.
- [ ] 1.2 Add an e2e check that two tabs in one browser, as different players, each load images they have access to and that a private image does not load in the other tab. Verify that the e2e test passes.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
