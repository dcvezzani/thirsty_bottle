## MODIFIED Requirements

### Requirement: Passing the turn
The active player SHALL be able to end their turn. The turn passes to the next occupied seat in the configured direction (clockwise by default), whether or not that seat's player is connected, and waits for them. The host SHALL be able to reverse the direction, skip a seat, or set the active player directly.

#### Scenario: End turn
- **WHEN** the active player in seat 2 of 4 ends their turn with direction clockwise
- **THEN** the player in seat 3 becomes active and all participants see the active-player indicator move

#### Scenario: Active player leaves
- **WHEN** the active player leaves the table
- **THEN** the turn passes to the next occupied seat

## ADDED Requirements

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
