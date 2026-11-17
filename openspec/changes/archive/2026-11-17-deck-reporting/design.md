# Design

## Context

See the archived `virtual-card-table` design (`openspec/changes/archive/2026-11-17-virtual-card-table/design.md`), risk "public gallery may receive unwanted or infringing artwork". The behavior lives in `Decks.report()` (sets `hidden = 1` unless built in, `INSERT OR IGNORE` into `deck_reports`) and `server/src/admin.ts` (`reports`, `unhide`, `hide`).

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. Test the CLI as a separate process
The admin tool opens the same SQLite file the server uses. The test creates and reports a deck through the API, stops the server, runs `node server/dist/admin.js` with `DATA_DIR` pointing at the test directory, and then starts the server again to check the gallery.
**Alternative considered:** calling the SQL directly. Rejected, because it would not cover the shipped CLI.

## Risks / Trade-offs

- [The test describes behavior that already exists] → If a test reveals a gap, fix the code within this change and note it in tasks.md.
