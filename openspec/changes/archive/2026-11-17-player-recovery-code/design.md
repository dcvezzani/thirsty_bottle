# Design

## Context

See the archived `virtual-card-table` design (`openspec/changes/archive/2026-11-17-virtual-card-table/design.md`), D8 and its risk note about lost browser storage. The code is the player token. The picker validates it with `GET /api/me`.

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. End-to-end test with two browser contexts
Read the code by granting clipboard permissions, or fall back to reading the tab's `sessionStorage` token, which is the same value. Enter it in a second context and assert that the identity and seat match.

## Risks / Trade-offs

- [The test describes behavior that already exists] → If a test reveals a gap, fix the code within this change and note it in tasks.md.
