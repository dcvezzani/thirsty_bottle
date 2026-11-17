# Spec Delta

## Purpose

Lets each table choose, and change at any time, whether play is real-time (anyone acts at any moment) or turn-based (one active player at a time, passing in seat order).

## ADDED Requirements

### Requirement: Per-table mode
Every table SHALL be in exactly one mode: real-time or turn-based. New tables SHALL default to real-time.

#### Scenario: Default mode
- **WHEN** a host creates a new table
- **THEN** the table is in real-time mode

### Requirement: Switch mode at any time
The host SHALL be able to switch the table's mode at any moment, and can allow every seated player to switch it. The switch takes effect immediately for all participants and is recorded in the log.

#### Scenario: Switch to turn-based mid-game
- **WHEN** the host switches a real-time table to turn-based
- **THEN** all participants see the new mode, the host chooses the active player (default: the host's seat), and the log records the change

#### Scenario: Switch back to real-time
- **WHEN** the host switches a turn-based table to real-time
- **THEN** every seated player can immediately perform card actions

### Requirement: Real-time mode behavior
In real-time mode, every seated player SHALL be able to perform card actions concurrently. The server SHALL apply them in the order received.

#### Scenario: Simultaneous grabs
- **WHEN** two players try to draw the last card of a pile at the same moment
- **THEN** the server gives the card to the action that arrived first, and the other player is told the pile is empty

### Requirement: Turn-based mode behavior
In turn-based mode, only the active player SHALL be able to perform card actions that change shared zones or other players' zones. All players SHALL still be able to view cards, open card info, chat, rearrange their own hand, and respond to consent prompts.

#### Scenario: Out-of-turn action blocked
- **WHEN** a non-active player tries to draw from a shared pile in turn-based mode
- **THEN** the action is refused with "It's Sam's turn" and the table is unchanged

#### Scenario: Reorder own hand out of turn
- **WHEN** a non-active player reorders cards within their own hand
- **THEN** the reorder succeeds

### Requirement: Passing the turn
The active player SHALL be able to end their turn. The turn passes to the next occupied seat in the configured direction (clockwise by default). The host SHALL be able to reverse the direction, skip a seat, or set the active player directly.

#### Scenario: End turn
- **WHEN** the active player in seat 2 of 4 ends their turn with direction clockwise
- **THEN** the player in seat 3 becomes active and all participants see the active-player indicator move

#### Scenario: Active player leaves
- **WHEN** the active player disconnects for longer than the reconnect grace period
- **THEN** the turn passes to the next occupied seat

### Requirement: Turn indicator
In turn-based mode, the client SHALL clearly indicate the active player to all participants and SHALL notify a player when their turn begins.

#### Scenario: Your turn notification
- **WHEN** a player becomes active
- **THEN** their client highlights their seat and shows a "Your turn" notice, plus a vibration on devices that support it
