# turn-modes Specification

## Purpose
Lets each table choose, and change at any time, whether play is real-time (anyone acts at any moment) or turn-based (one active player at a time, passing in seat order).

## Requirements

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
The active player SHALL be able to end their turn. The turn passes to the next occupied seat in the configured direction (clockwise by default), whether or not that seat's player is connected, and waits for them. The host SHALL be able to reverse the direction, skip a seat, or set the active player directly.

#### Scenario: End turn
- **WHEN** the active player in seat 2 of 4 ends their turn with direction clockwise
- **THEN** the player in seat 3 becomes active and all participants see the active-player indicator move

#### Scenario: Active player leaves
- **WHEN** the active player leaves the table
- **THEN** the turn passes to the next occupied seat

### Requirement: Turn indicator
In turn-based mode, the client SHALL clearly indicate the active player to all participants and SHALL notify a player when their turn begins.

#### Scenario: Your turn notification
- **WHEN** a player becomes active
- **THEN** their client highlights their seat and shows a "Your turn" notice, plus a vibration on devices that support it

### Requirement: Pass to an absent player
In turn-based mode, ending a turn SHALL pass it to the next occupied seat even when that player is disconnected, and the turn SHALL wait for them until they return or the host skips them.

#### Scenario: Next player is offline
- **WHEN** the active player ends their turn and the next occupied seat's player is disconnected
- **THEN** that seat becomes active, the log records it, and the turn stays there until that player returns and acts or ends their turn, or the host skips them

#### Scenario: Nobody else is seated
- **WHEN** the active player is the only seated player and ends their turn
- **THEN** the turn stays with them

### Requirement: Seats are kept in turn-based mode
In turn-based mode, a player who disconnects SHALL keep their seat for as long as the table exists. The reconnect grace period that releases a disconnected player's seat SHALL apply only in real-time mode.

#### Scenario: Away for hours in a turn-based table
- **WHEN** a player in a turn-based table closes the app and returns hours later
- **THEN** they are still in their seat with their hand

#### Scenario: Away in a real-time table
- **WHEN** a player in a real-time table stays disconnected past the reconnect grace period
- **THEN** their seat is released as before

### Requirement: Idle turn-based tables close
A turn-based table SHALL close when no action has been performed on it for the table's inactive lifetime, whether or not anyone is connected. The lifetime counts from the last action, is set by the host in whole days from 1 to 30, and defaults to 1 day. A real-time table SHALL keep closing 30 minutes after nobody is connected.

#### Scenario: Idle for the lifetime
- **WHEN** a turn-based table with a 1-day lifetime has had no action for 24 hours
- **THEN** the table closes

#### Scenario: Activity restarts the clock
- **WHEN** a player acts on a turn-based table before its lifetime has passed
- **THEN** the lifetime counts again from that action

#### Scenario: Host changes the lifetime
- **WHEN** the host sets the lifetime to 7 days
- **THEN** it applies at once, including to a table already waiting on a player

#### Scenario: Out-of-range value
- **WHEN** a lifetime outside 1 to 30 days is submitted
- **THEN** it is refused and the setting is unchanged

#### Scenario: Mode switch
- **WHEN** a table is switched between real-time and turn-based
- **THEN** it uses the closing rule of the new mode from then on
