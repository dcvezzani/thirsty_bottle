# Design

## Context

See the archived `virtual-card-table` design (`openspec/changes/archive/2026-11-17-virtual-card-table/design.md`), D7a risk "Deck versions accumulate storage", which promised this. `App.init` already runs `chat.purge()` and `images.gc()` every hour.

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. Single SQL delete
`pruneVersions(maxAgeMs = 30 days)` runs one `DELETE FROM deck_versions WHERE created_at < ? AND id NOT IN (SELECT current_version_id FROM decks) AND id NOT IN (SELECT version_id FROM table_decks WHERE version_id IS NOT NULL)` and returns the number deleted. It is called hourly before `images.gc()`, so images used only by pruned versions are collected in the same pass.

## Risks / Trade-offs

- [The test describes behavior that already exists] → If a test reveals a gap, fix the code within this change and note it in tasks.md.
