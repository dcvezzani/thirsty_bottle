# Proposal

## Why

Players can report a public deck, which hides it from the gallery, and a server admin can review reports with a CLI. This was built from the design's risk note about unwanted or infringing artwork, but no spec requires it, so it could be removed or broken without notice.

## What Changes

- Spec the report action, gallery hiding, per-player idempotence and admin review.
- Add a test for the admin CLI (`server/dist/admin.js`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `deck-library`: adds requirements (no existing requirement text changes).

## Impact

- `server/src/decks.ts` (`report`, gallery query), `server/src/admin.ts`: no code change expected.
- New CLI test in `server/test/`.
