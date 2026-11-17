# Proposal

## Why

Players can change their display name and color after onboarding, from the "You" sheet in the lobby, but the lobby spec only covers choosing them at first visit.

## What Changes

- Spec renaming after onboarding and where the new name appears.
- Add server and end-to-end tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `lobby`: adds requirements (no existing requirement text changes).

## Impact

- `server/src/hub.ts` (`profile` message, `renamePlayer` system action), `client/src/pages/Lobby.tsx` (`Profile`): no code change expected.
- Tests in `server/test/` and `e2e/`.
