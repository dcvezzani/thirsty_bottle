# Design

## Context

The `profile` socket message updates the player row, applies a `renamePlayer` system action to their table, and triggers a lobby broadcast. Validation uses `DisplayNameSchema`.

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. Server and UI tests
A WebSocket integration test checks presence, seat name and refusal of invalid names. An e2e test renames through the "You" sheet and checks a second player's seat marker.

## Risks / Trade-offs

- [The test describes behavior that already exists] → If a test reveals a gap, fix the code within this change and note it in tasks.md.
