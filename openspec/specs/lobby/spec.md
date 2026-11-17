# lobby Specification

## Purpose
Gives players an entry point where they establish an identity, see who is online, and find, create, join and manage game tables.

## Requirements

### Requirement: Lightweight player identity
A player SHALL enter the lobby by choosing a display name (1–24 characters) and a color. No password is required. The system SHALL issue a persistent player token, so that returning restores the same identity, owned decks and seats.

#### Scenario: First visit
- **WHEN** a new visitor enters the name "Alex"
- **THEN** they enter the lobby as Alex, and their identity persists in that window across reloads

### Requirement: Separate players per browser window
Each browser window or tab SHALL be able to act as a different player, so several players can be run side by side in one browser (for example, for debugging). A window keeps its own identity through reloads and network interruptions, independently of other windows.

#### Scenario: Two players in one browser
- **WHEN** a user opens the app in two tabs of the same browser and enters as "Alex" in one and "Sam" in the other
- **THEN** both are online as separate players who can sit at the same table, each seeing only their own hand

#### Scenario: Identity picker in a new window
- **WHEN** a user opens a new tab in a browser that has previously been used as "Alex" and "Sam"
- **THEN** the tab offers to continue as Alex, continue as Sam, or create a new player

#### Scenario: Same player opened twice
- **WHEN** a user continues as "Alex" in a second tab while Alex is already active in another tab
- **THEN** the new tab takes over Alex's session and the old tab shows "Alex is open in another window", with an option to take it back

#### Scenario: Reopen after closing the window
- **WHEN** a seated player closes their tab and opens the app again within the reconnect grace period, choosing to continue as themselves
- **THEN** they return to the same seat with the same hand

#### Scenario: Duplicate display name
- **WHEN** a player chooses a name already used by another online player
- **THEN** the system accepts it and shows a short distinguishing suffix (for example "Alex #2") wherever the names would collide

### Requirement: Presence
The lobby SHALL show the online players and, for each, whether they are idle in the lobby or seated at a table (and which one). The list SHALL update within 2 seconds of a change.

#### Scenario: Player joins a table
- **WHEN** Sam sits at the table "Friday Hearts"
- **THEN** other lobby viewers see Sam's status change to "at Friday Hearts"

### Requirement: Table list
The lobby SHALL list tables with their name, host, seated player count and seat limit (or "open seating" when no seat count was set), mode (real-time or turn-based), loaded deck names, whether the table is locked or private, and whether spectators are allowed.

#### Scenario: Browse tables
- **WHEN** a player opens the lobby
- **THEN** they see every public table with its name, host, "3/4 seats" or "3 players, open seating", mode and lock status

### Requirement: Create table
A player SHALL be able to create a table by giving it a name, visibility (public, or private by invite link), spectator permission, and optionally a seat count (1–12), a password, and a deck plus starting layout. The creator becomes host and takes a seat.

#### Scenario: Minimal table
- **WHEN** a player creates a table giving only the name "Quick Game"
- **THEN** a public table with open seating, no password and spectators allowed is created, and the creator is seated as host

#### Scenario: No password required
- **WHEN** a player creates a table and leaves the password empty
- **THEN** anyone who can see the table can join it without being asked for a password

### Requirement: Open seating
A table created without a seat count SHALL have open seating: a seat is added for each player who joins, up to the system maximum of 12, and the seat is removed when its player leaves (subject to the host's choice about their hand). The host SHALL be able to set or remove a seat count later, but not below the current number of seated players.

#### Scenario: Seats grow as players join
- **WHEN** a third player joins an open-seating table with 2 seated players
- **THEN** a third seat is added for them

#### Scenario: Open seating at the maximum
- **WHEN** a player tries to join an open-seating table that already has 12 seated players
- **THEN** they are offered to spectate (if allowed) instead of a seat

#### Scenario: Create private table
- **WHEN** a player creates a private table named "Family Night" with 6 seats
- **THEN** the table is omitted from the public list, an invite link is shown to the host, and the host is seated

### Requirement: Join, spectate and leave
A player SHALL be able to join an open seat, choose a specific seat, spectate if allowed, or leave a table. Leaving SHALL return them to the lobby. A seated player's hand SHALL stay at the seat until they leave voluntarily or are removed.

#### Scenario: Join mid-game
- **WHEN** a player joins an unlocked table while a game is in progress
- **THEN** they get a seat with an empty hand, placed last in seat order (the host can move them), and they are included in turn order from then on

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
The host SHALL be able to edit table settings (including adding, changing or removing the password and seat count), lock or unlock the table to new joiners, move players between seats, kick a player or spectator, load or unload decks, reset the table, and close it.

#### Scenario: Lock stops mid-game joins
- **WHEN** the host locks a table
- **THEN** new players can no longer join a seat, and seated players and spectators are unaffected

#### Scenario: Kick a player
- **WHEN** the host kicks a seated player
- **THEN** that player is returned to the lobby with a notice, and their hand is handled as for a voluntary leave

### Requirement: Designate a new host
The current host SHALL always be able to designate any other connected seated player as host, at any moment, regardless of table mode, whose turn it is, or game progress. The change takes effect immediately for all participants and is recorded in the log.

#### Scenario: Hand over host mid-game
- **WHEN** the host designates Sam as host during a turn-based game while it is someone else's turn
- **THEN** Sam immediately gains the host controls, the previous host becomes a regular seated player keeping their seat and hand, and all participants see "Alex made Sam the host"

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
