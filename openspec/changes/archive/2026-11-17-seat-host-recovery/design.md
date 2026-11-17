# Design

## Context

`seatJoin` checks `vacated` for the joining player's seat before taking the first empty seat, and sets `hostId` to the joiner when the current host is not seated. `seatLeave` transfers host using `seatedOrder` filtered by connected players.

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. Unit tests on the pure reducer
These rules are pure state transitions, so they are tested in `shared/test/reducer.test.ts` with `TableEngine`. The existing presence integration test already covers transfer on grace expiry.

## Risks / Trade-offs

- [The test describes behavior that already exists] → If a test reveals a gap, fix the code within this change and note it in tasks.md.
