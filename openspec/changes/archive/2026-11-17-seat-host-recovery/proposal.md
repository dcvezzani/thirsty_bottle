# Proposal

## Why

The reducer gives a returning player back their own vacated seat (with their hand), and assigns the host role to the next player to sit when the host is gone. These rules were added during the build to make the "everyone leaves briefly" scenario work, but are not in the lobby spec.

## What Changes

- Spec seat preference on rejoin and host assignment when no host is seated.
- Add reducer unit tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `lobby`: adds requirements (no existing requirement text changes).

## Impact

- `shared/src/reducer.ts` (`seatJoin`, `seatLeave`): no code change expected.
- Tests in `shared/test/reducer.test.ts`.
