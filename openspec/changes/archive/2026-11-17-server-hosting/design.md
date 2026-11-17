# Design

## Context

`server/src/main.ts` reads `PORT`/`DATA_DIR`, listens on `0.0.0.0`, prints `Local:`/`Network:` lines from `os.networkInterfaces()`, and calls `app.close()` on SIGINT/SIGTERM (`Tables.shutdown()` writes snapshots). `client/vite.config.ts` sets `server.host: true`.

## Goals / Non-Goals

**Goals:**
- Make the behavior a spec-level contract and lock it in with tests.

**Non-Goals:**
- Changing user-visible behavior beyond what the requirements state.

## Decisions

### D1. Spawn the built server
`server/test/hosting.test.ts` spawns `node server/dist/main.js` with a free `PORT` and a temp `DATA_DIR`, parses stdout, requests `/` and `/t/x`, opens a WebSocket to `/ws`, creates a table, sends SIGTERM, asserts exit code 0, and restarts to compare the table state.

## Risks / Trade-offs

- [Machines without a non-internal IPv4 address print no `Network:` line] → The test asserts the `Network:` lines match `os.networkInterfaces()` rather than requiring at least one.
