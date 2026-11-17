# Proposal

## Why

Running on a laptop for friends needed the server to listen on the network, print reachable addresses, and expose the dev server to phones. These operational behaviors (and `PORT`/`DATA_DIR`) are documented in the README but not specified.

## What Changes

- New `server-hosting` capability: single-port serving, network listening, configuration, startup output, graceful shutdown, dev-server reachability.
- Add a process-level test.

## Capabilities

### New Capabilities
- `server-hosting`: Defines how the server is run and reached: one process and port for app, API and WebSocket, network listening, configuration, startup output and shutdown.

### Modified Capabilities

None. Requirements are added only; no existing requirement changes.

## Impact

- `server/src/main.ts`, `server/src/app.ts`, `client/vite.config.ts` (`server.host`): no code change expected.
- New `server/test/hosting.test.ts`.
