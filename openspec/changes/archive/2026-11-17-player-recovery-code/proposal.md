# Proposal

## Why

Players can copy a recovery code and use it to continue as themselves in another window or browser. This came from design D8 but is not in the lobby spec, so losing browser storage could leave players without a documented way back.

## What Changes

- Spec copying and entering a recovery code.
- Add an end-to-end test.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `lobby`: adds requirements (no existing requirement text changes).

## Impact

- `client/src/pages/Lobby.tsx` ("Copy recovery code"), `client/src/pages/Onboarding.tsx` ("Continue with a recovery code"): no code change expected.
- New test in `e2e/identity.spec.ts`.
