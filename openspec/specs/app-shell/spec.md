# app-shell Specification

## Purpose
Defines how the web app installs and updates on devices: installability, when new versions take effect, and what the offline cache may serve.

## Requirements

### Requirement: Installable
The app SHALL be installable from supporting browsers. It SHALL provide a web app manifest with a name, a standalone display mode, icons at 192 and 512 pixels and a maskable icon, and a registered service worker.

#### Scenario: Install prompt available
- **WHEN** the app is opened over HTTPS or on localhost in a supporting browser
- **THEN** the browser reports no installability errors

### Requirement: Updates never interrupt a game
A newly deployed version SHALL take effect the next time the app is launched. It SHALL NOT reload or navigate an open page.

#### Scenario: New version deployed mid-game
- **WHEN** a new version is deployed while a player has a table open
- **THEN** the open page keeps running, and the new version is used after the app is closed and reopened

### Requirement: Live data is never served from the offline cache
The offline cache SHALL hold only the app's static files. Requests to the API and the WebSocket endpoint SHALL always go to the server.

#### Scenario: API request while installed
- **WHEN** the installed app requests `/api/decks`
- **THEN** the response comes from the server, not the cache
