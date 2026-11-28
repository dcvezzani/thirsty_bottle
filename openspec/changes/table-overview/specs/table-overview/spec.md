## ADDED Requirements

### Requirement: Overview page
The table SHALL offer an Overview that shows everything public at the table on one full-screen scrolling page. It SHALL open from a button in the table header and close back to the table exactly as it was. Spectators SHALL be able to use it.

#### Scenario: Open and close
- **WHEN** a player opens the Overview and closes it
- **THEN** the table is shown as it was, with the same selection and scroll position

#### Scenario: Spectator
- **WHEN** a spectator opens the Overview
- **THEN** the page opens and shows the same public information

### Requirement: Overview sections
The Overview SHALL list, in order, the turn marker in turn-based mode, the shared zones in board order, each player, the counters and the shared notes. Each player SHALL show their name, a host mark, whether it is their turn, their hand count and their per-player zones.

#### Scenario: Whole table at a glance
- **WHEN** a table has two shared zones, three players with a per-player zone each, two counters and notes
- **THEN** the Overview lists the shared zones, the three players with their zones, the counters and the notes in that order

#### Scenario: Turn marker
- **WHEN** the table is turn-based and it is Sam's turn
- **THEN** the Overview shows that it is Sam's turn and marks Sam in the players list

### Requirement: Zones in the overview
Each zone SHALL show its name, its card count and its cards as a compact strip, with face-up cards showing their faces and face-down cards their backs. A pile SHALL show its top card and its count.

#### Scenario: Spread and pile
- **WHEN** a spread holds four cards and a pile holds twenty
- **THEN** the spread shows four cards in a strip and the pile shows its top card with the count 20

### Requirement: Only public information
The Overview SHALL show only what is public. Hands SHALL appear as counts, except cards their owner has shown to everyone, which SHALL appear under that player. The viewer's own hand SHALL appear as a count. A card only the viewer can see, such as one they peeked at or one shown only to them, SHALL appear as a back.

#### Scenario: Hidden hands
- **WHEN** Sam holds five cards in hand and has shown one to everyone
- **THEN** the Overview shows Sam's hand count of five and the one shown card, and nothing of the other four

#### Scenario: Peeked card
- **WHEN** a player peeked at a face-down card in a pile
- **THEN** the Overview shows it as a back

### Requirement: Read-only overview
The Overview SHALL NOT let the viewer select, move, flip or otherwise change cards. Scrubbing a strip SHALL show the loupe, and tapping a card SHALL open its card info. It SHALL update live while open.

#### Scenario: Nothing changes
- **WHEN** a player presses and drags a card in the Overview
- **THEN** no card moves and no action is sent

#### Scenario: Live update
- **WHEN** another player moves a card while the Overview is open
- **THEN** the Overview shows the change without being reopened
