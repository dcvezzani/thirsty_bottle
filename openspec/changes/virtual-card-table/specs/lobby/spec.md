# Spec Delta

## Purpose

Gives players an entry point where they establish an identity, see who is online, and find, create, join and manage game tables.

## ADDED Requirements

### Requirement: Lightweight player identity
A player SHALL enter the lobby by choosing a display name (1–24 characters) and a color. No password is required. The system SHALL issue a persistent device token, so that returning on the same device restores the same identity, owned decks and seats.

#### Scenario: First visit
- **WHEN** a new visitor enters the name "Alex"
- **THEN** they enter the lobby as Alex, and their identity persists on that device across reloads

#### Scenario: Duplicate display name
- **WHEN** a player chooses a name already used by another online player
- **THEN** the system accepts it and shows a short distinguishing suffix (for example "Alex #2") wherever the names would collide

### Requirement: Presence
The lobby SHALL show the online players and, for each, whether they are idle in the lobby or seated at a table (and which one). The list SHALL update within 2 seconds of a change.

#### Scenario: Player joins a table
- **WHEN** Sam sits at the table "Friday Hearts"
- **THEN** other lobby viewers see Sam's status change to "at Friday Hearts"

### Requirement: Table list
The lobby SHALL list tables with their name, host, seated and maximum player counts, mode (real-time or turn-based), loaded deck names, whether the table is locked or private, and whether spectators are allowed.

#### Scenario: Browse tables
- **WHEN** a player opens the lobby
- **THEN** they see every public table with its name, host, "3/4 seats", mode and lock status

### Requirement: Create table
A player SHALL be able to create a table by giving it a name, seat count (1–12), visibility (public, or private by invite link), optional password, spectator permission, and an optional deck plus starting layout. The creator becomes host and takes a seat.

#### Scenario: Create private table
- **WHEN** a player creates a private table named "Family Night" with 6 seats
- **THEN** the table is omitted from the public list, an invite link is shown to the host, and the host is seated

### Requirement: Join, spectate and leave
A player SHALL be able to join an open seat, choose a specific seat, spectate if allowed, or leave a table. Leaving SHALL return them to the lobby. A seated player's hand SHALL stay at the seat until they leave voluntarily or are removed.

#### Scenario: Join full table
- **WHEN** a player tries to join a table whose seats are all taken
- **THEN** they are offered to spectate (if allowed) instead of a seat

#### Scenario: Password required
- **WHEN** a player joins a password-protected table with the wrong password
- **THEN** they are refused with "Incorrect password" and remain in the lobby

#### Scenario: Leave with cards in hand
- **WHEN** a seated player leaves voluntarily
- **THEN** the host chooses whether that player's hand returns to a chosen pile or stays at the empty seat for a replacement player

### Requirement: Host management
The host SHALL be able to edit table settings, lock or unlock the table to new joiners, move players between seats, kick a player or spectator, transfer host to another seated player, load or unload decks, reset the table, and close it.

#### Scenario: Kick a player
- **WHEN** the host kicks a seated player
- **THEN** that player is returned to the lobby with a notice, and their hand is handled as for a voluntary leave

#### Scenario: Host disconnects
- **WHEN** the host has been disconnected longer than the reconnect grace period
- **THEN** host transfers to the longest-seated connected player and all participants are notified

### Requirement: Table lifecycle
A table SHALL persist while it has at least one connected participant. An empty table SHALL be kept for 30 minutes so that players can return, then closed. A closed table SHALL be removed from the list.

#### Scenario: Everyone leaves briefly
- **WHEN** all participants disconnect and one returns within 30 minutes
- **THEN** the table state, including hands, is exactly as it was left

### Requirement: Mobile-first lobby
The lobby SHALL be fully usable on a 360-pixel-wide touch screen, with tables, online players and lobby chat reachable through tabs or panels, and with touch targets at least 44 pixels in size.

#### Scenario: Phone layout
- **WHEN** the lobby is opened on a phone in portrait
- **THEN** tables, players and chat are each reachable with one tap, with no horizontal scrolling
