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
A newly deployed version SHALL NOT reload or navigate an open page on its own while the player is at a table, in the deck editor, or has a dialog open or a field focused. In those situations the new version SHALL take effect only when the player chooses to reload or the next time the app is launched.

#### Scenario: New version deployed mid-game
- **WHEN** a new version is deployed while a player has a table open
- **THEN** the open page keeps running without reloading, and the update notice is shown

#### Scenario: Player chooses to reload at a table
- **WHEN** a player at a table taps Reload on the update notice
- **THEN** the page reloads on the new version and returns to the same table and seat, with the same hand

#### Scenario: Deck editor is not interrupted
- **WHEN** a new version is waiting while a player is editing a deck
- **THEN** the page does not reload on its own, and the update notice is shown

### Requirement: Live data is never served from the offline cache
The offline cache SHALL hold only the app's static files. Requests to the API and the WebSocket endpoint SHALL always go to the server.

#### Scenario: API request while installed
- **WHEN** the installed app requests `/api/decks`
- **THEN** the response comes from the server, not the cache

### Requirement: Update notice
When a new version has been downloaded and is waiting, the app SHALL show a notice saying a new version is available, with a Reload button, on every page. The notice SHALL be announced to assistive technology, SHALL NOT block or cover the table's controls, and SHALL meet the app's contrast rules. Tapping Reload SHALL switch to the new version immediately.

#### Scenario: Notice appears when an update is waiting
- **WHEN** a new version finishes downloading while the app is open on any page
- **THEN** a "A new version is available" notice with a Reload button appears

#### Scenario: Reload switches versions
- **WHEN** the player taps Reload on the notice
- **THEN** the page reloads and runs the new version

### Requirement: Updates apply automatically in an idle lobby
When a new version is waiting and the player is in the lobby with no dialog open and no field focused, the app SHALL switch to the new version without the player acting. If the lobby is busy, the app SHALL do so as soon as it becomes idle. Returning to the lobby from a table SHALL count as entering the lobby.

#### Scenario: Opening the app after a deploy
- **WHEN** a player opens the app to the lobby while an older version is cached and a newer one is deployed
- **THEN** within a few seconds the lobby reloads on the new version without the player acting

#### Scenario: Busy lobby waits
- **WHEN** a new version becomes ready while the player is typing in the New table dialog
- **THEN** the page does not reload; the notice is shown, and the update applies once the dialog is closed

#### Scenario: Leaving a table
- **WHEN** a new version is waiting and the player leaves a table for the lobby
- **THEN** the lobby reloads on the new version

### Requirement: Checking for new versions
The app SHALL check the server for a new version at launch, whenever it returns to the foreground, and at least every 30 minutes while open.

#### Scenario: Long-open tab finds an update
- **WHEN** a new version is deployed while a tab has been open for an hour
- **THEN** that tab downloads it within 30 minutes, or immediately when it returns to the foreground, and the update rules above apply
