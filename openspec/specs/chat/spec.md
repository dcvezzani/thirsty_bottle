# chat Specification

## Purpose
Lets players talk to everyone in the lobby and to the people at their table. Lobby chat stays reachable from inside any game room.

## Requirements

### Requirement: Lobby chat
The system SHALL provide one lobby chat channel. Every connected player can read and post to it, whether they are in the lobby or at a table.

#### Scenario: Post from lobby
- **WHEN** a player in the lobby posts "anyone up for spades?"
- **THEN** every connected player, including those seated at tables, receives the message in lobby chat

### Requirement: Lobby chat available inside a table
While at a table, a participant SHALL be able to open lobby chat, read it and post to it without leaving the table or losing their view of the table.

#### Scenario: Post to lobby while seated
- **WHEN** a seated player opens the lobby chat panel at a table and posts "need one more for hearts"
- **THEN** the message appears in lobby chat for everyone, and the player is still seated with the table visible

### Requirement: Room chat
Each table SHALL have its own room chat. Only that table's current participants (seated players and spectators) can read and post to it.

#### Scenario: Room chat is private to the table
- **WHEN** a seated player posts in room chat
- **THEN** only participants at that table receive it, and lobby-only players do not

### Requirement: Distinct channels and unread indicators
The client SHALL clearly show which channel a message goes to. While a channel is not in view, the client SHALL show an unread count for it.

#### Scenario: Unread lobby messages while playing
- **WHEN** 3 lobby messages arrive while a seated player is viewing room chat
- **THEN** the lobby chat tab shows an unread badge of 3

### Requirement: Message history
On joining, a channel SHALL deliver its most recent 100 messages. Room chat history SHALL be kept for the life of the table, and lobby history SHALL be kept for at least 24 hours.

#### Scenario: Late joiner sees context
- **WHEN** a player joins a table whose room chat already has 20 messages
- **THEN** they see those 20 messages in order

### Requirement: Message content and limits
Messages SHALL be plain text up to 500 characters, rendered without interpreting HTML. Each player SHALL be limited to 5 messages per 5 seconds per channel.

#### Scenario: Script injection is inert
- **WHEN** a player posts `<script>alert(1)</script>`
- **THEN** the message displays as literal text and no script runs

#### Scenario: Flooding is throttled
- **WHEN** a player sends a sixth message within 5 seconds in one channel
- **THEN** the message is refused with a "slow down" notice

### Requirement: System messages
Room chat SHALL be able to show table log entries (joins, leaves, mode changes, and optionally card actions) inline as visually distinct system messages. Each player SHALL be able to toggle card-action entries on or off.

#### Scenario: Join announced
- **WHEN** a player joins the table
- **THEN** room chat shows a system message "Sam joined seat 3"

### Requirement: Mute
A player SHALL be able to mute another player, which hides that player's messages from them in all channels. The host SHALL be able to mute a participant in room chat for everyone.

#### Scenario: Personal mute
- **WHEN** Alex mutes Sam
- **THEN** Alex no longer sees Sam's lobby or room messages, and other players still do
