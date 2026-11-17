# Design

## Context

See the archived `virtual-card-table` design (`openspec/changes/archive/2026-11-17-virtual-card-table/design.md`), D6 (image access) and D8 (per-window identity). `Images.canFetch` checks the uploader, a `table_decks` match for the player's table, and `Decks.canView` for decks whose current version or the owner's draft references the image. `App.imageKey` uses an HMAC with `DATA_DIR/secret.key`.

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. Cover each path in one test table
One parameterized test walks the access paths: uploader, private non-owner, public, link with and without a token, table participant, and forged key.

## Risks / Trade-offs

- [The test describes behavior that already exists] → If a test reveals a gap, fix the code within this change and note it in tasks.md.
