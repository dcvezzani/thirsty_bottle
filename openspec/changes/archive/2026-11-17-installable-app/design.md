# Design

## Context

See the archived `virtual-card-table` design (`openspec/changes/archive/2026-11-17-virtual-card-table/design.md`), D1 (`vite-plugin-pwa`). After an auto-update reload broke a test, `registerType` changed to `prompt` (no `skipWaiting`). `navigateFallbackDenylist` excludes `/api/` and `/ws`.

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. Inspect the generated service worker
The test reads the built `client/dist/sw.js` and asserts that it contains no `skipWaiting` or `clientsClaim` calls, that the precache manifest lists only static asset paths, and that the denylist covers `/api/` and `/ws`. A browser test also asserts that no `controllerchange` reload happens when the service worker updates.

## Risks / Trade-offs

- [The test describes behavior that already exists] → If a test reveals a gap, fix the code within this change and note it in tasks.md.
