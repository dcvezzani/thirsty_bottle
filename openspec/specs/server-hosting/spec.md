# server-hosting Specification

## Purpose
Defines how the server is run and reached: one process and port for app, API and WebSocket, network listening, configuration, startup output and shutdown.

## Requirements

### Requirement: One process, one port
A single server process SHALL serve the web app, the HTTP API and the WebSocket endpoint on one port. Unknown non-API paths SHALL return the app so that deep links such as `/t/<id>` work.

#### Scenario: Deep link
- **WHEN** a browser requests `/t/abc123` directly from the server
- **THEN** the app's HTML is returned

### Requirement: Reachable on the local network
The server SHALL listen on all network interfaces. At startup it SHALL print the local address and each non-internal IPv4 network address with the port. The development server SHALL also listen on all interfaces.

#### Scenario: Startup output
- **WHEN** the server starts on a machine with a Wi-Fi address
- **THEN** the output includes a `Local:` line with `http://localhost:<port>/` and a `Network:` line with that address

### Requirement: Configuration
The listening port SHALL be configurable with `PORT` (default 3000), and the storage location for the database, images and secret key with `DATA_DIR` (default `./data`).

#### Scenario: Custom port and data directory
- **WHEN** the server starts with `PORT=8080` and `DATA_DIR=/srv/cards`
- **THEN** it listens on 8080 and creates its database and images under `/srv/cards`

### Requirement: Graceful shutdown
On SIGINT or SIGTERM the server SHALL save a snapshot of every open table, close connections and exit with status 0.

#### Scenario: Stop and restart
- **WHEN** the server receives SIGTERM during a game and is started again with the same data directory
- **THEN** the table is restored with the same state

### Requirement: Behind an HTTPS reverse proxy
When deployed behind a platform reverse proxy that terminates TLS, the server SHALL honor the proxy's forwarded protocol and client address headers. Absolute URLs it generates (such as image links in deck exports) SHALL then use `https`, and the client SHALL connect its WebSocket with `wss`.

#### Scenario: Export behind the proxy
- **WHEN** a player exports a deck as JSON through the production HTTPS address
- **THEN** the image URLs in the manifest start with `https://`
