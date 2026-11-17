# Proposal

## Why

The design promised that old deck versions would be pruned, but nothing prunes them: every Save keeps a version forever. Growth is slow (small JSON rows), but the design and the code disagree.

## What Changes

- Spec pruning of unreferenced old versions, and its safety rules.
- Implement `Decks.pruneVersions()` on the existing hourly maintenance timer, followed by image garbage collection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `deck-library`: adds requirements (no existing requirement text changes).

## Impact

- `server/src/decks.ts` (new `pruneVersions`), `server/src/app.ts` (hourly timer).
- Tests in `server/test/decks.test.ts`.
