# Spec Delta

## Purpose

Keeps every participant's view of the lobby and tables consistent and responsive. The server is the single source of truth, hidden information is never sent to clients that should not see it, and connections recover transparently.

## ADDED Requirements

### Requirement: Authoritative server
The server SHALL be the single source of truth for lobby state, table state, card order, visibility and randomness. Clients SHALL submit action intents, and only the server SHALL decide their outcome.

#### Scenario: Client cannot forge state
- **WHEN** a modified client sends a message claiming a card is in its hand when the server's state does not agree
- **THEN** the server rejects the action and every client's state is unchanged

### Requirement: Per-viewer state filtering
For each recipient, the server SHALL send only information that recipient may see. Card identities, including copy numbers, SHALL be withheld for face-down cards, other players' hands, and unshown peeks. Hidden cards SHALL be referenced by identifiers that do not stay the same when the card moves between hidden positions.

#### Scenario: Network traffic hides opponent hand
- **WHEN** an observer inspects all WebSocket messages received by one player's client during a deal
- **THEN** no message contains the name, image or metadata of cards dealt to other players

#### Scenario: Copy numbers do not leak
- **WHEN** a client receives updates about face-down copies of a duplicated card
- **THEN** no message contains a copy number for any card whose face that client cannot see

#### Scenario: Cannot track shuffled card
- **WHEN** a face-down card is moved into a pile and the pile is shuffled
- **THEN** no identifier received by clients allows them to locate that card within the pile

### Requirement: Ordered state versions
Every accepted table change SHALL increment a table version number. Clients SHALL apply updates in version order, and SHALL request a full state snapshot when they detect a gap.

#### Scenario: Missed update
- **WHEN** a client receives version 42 after version 40
- **THEN** it requests and applies a fresh snapshot before continuing

### Requirement: Optimistic feedback with reconciliation
The client SHALL immediately animate a player's own actions (drags, moves, flips, drop previews) at the device's frame rate, before the server confirms them. It SHALL reconcile with the server's result, smoothly reverting any action the server rejects.

#### Scenario: Rejected optimistic move
- **WHEN** a player drags the last card of a pile that another player drew first
- **THEN** the card animates back and the player sees a brief notice explaining why

### Requirement: Live drag preview for others
While a player drags cards, other participants SHALL see a throttled live preview of the drag position (at least 10 updates per second), interpolated smoothly. The preview SHALL hide the identity of hidden cards.

#### Scenario: Watch a drag
- **WHEN** a player drags a face-down card across the table
- **THEN** other participants see a card back moving smoothly along the drag path

### Requirement: Reconnection
If a client disconnects, the server SHALL hold that player's seat and private state for a grace period of 2 minutes. A reconnecting client SHALL resume with a fresh snapshot without manual steps.

#### Scenario: Reconnect with several players in one browser
- **WHEN** the network drops for 30 seconds while "Alex" and "Sam" are seated at a table in two tabs of the same browser
- **THEN** each tab reconnects automatically as its own player to its own seat and hand

#### Scenario: Phone sleeps briefly
- **WHEN** a player's phone loses connection for 60 seconds and then reconnects
- **THEN** the player is back in the same seat with the same hand, and the table shows them as connected again

#### Scenario: Disconnection visible
- **WHEN** a seated player has been disconnected for more than 5 seconds
- **THEN** other participants see that seat marked as disconnected

### Requirement: Action latency
Under normal network conditions (round trip below 150 ms), a confirmed action SHALL be reflected on all other participants' clients within 300 ms of being sent.

#### Scenario: Responsive play
- **WHEN** a player flips a card on a typical home connection
- **THEN** other participants see the flip begin within 300 ms

### Requirement: Durable table state
The server SHALL persist table state so that a server restart does not lose tables, hands, logs or chat history.

#### Scenario: Server restart
- **WHEN** the server restarts while a table is in progress
- **THEN** after reconnecting, all participants see the same cards in the same zones and order as before the restart

### Requirement: Input validation and rate limits
The server SHALL validate every message against the protocol schema and SHALL reject malformed or oversized messages. It SHALL limit each connection's action rate so that one client cannot degrade a table for others.

#### Scenario: Malformed message
- **WHEN** a client sends a message missing required fields
- **THEN** the server responds with an error for that message and the connection stays open
