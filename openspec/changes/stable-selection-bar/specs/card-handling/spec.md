## ADDED Requirements

### Requirement: Selecting never moves the board
Selecting or deselecting cards SHALL NOT change the size or scroll position of the board, and the selection controls SHALL NOT cover any part of it. The controls SHALL appear in the row that otherwise holds the table's panel tabs and zoom buttons, at the same height, and the tabs SHALL return when the selection clears. Starting a selection SHALL close an open chat drawer.

#### Scenario: Double tap flips whether or not the card is selected
- **WHEN** a player double-taps a card that is unselected, and then double-taps one that is already selected
- **THEN** each double tap flips its card or selection, because the cards do not move between the two taps

#### Scenario: Layout stays put
- **WHEN** a player selects a card and clears the selection
- **THEN** the board's size and the position of every zone are the same before, during and after

#### Scenario: Open drawer closes
- **WHEN** a player selects a card while the chat drawer is open
- **THEN** the drawer closes and the selection controls show in the bottom row

## MODIFIED Requirements

### Requirement: Selection controls
While any cards are selected, the client SHALL show the selection count with a one-tap clear, and one-tap Flip and Send again to the last destination, on one line. Select all (in the zone), Clear and the face-down setting SHALL be in the actions sheet, and the toolbar SHALL show a tag while face down is on. The toolbar SHALL show a dot when there is unread chat. The selection SHALL clear automatically after the selected cards are moved, passed, played or flipped.

#### Scenario: Select all in zone
- **WHEN** a player opens the actions sheet and taps Select all while a spread of 8 cards is focused
- **THEN** all 8 cards are selected and the count shows 8

#### Scenario: Flip from the selection bar
- **WHEN** a player selects 3 face-down cards in a spread and taps Flip in the selection toolbar
- **THEN** all 3 cards turn face up in one action, and the selection clears

#### Scenario: Clear from the toolbar
- **WHEN** a player has cards selected and taps the clear control next to the count
- **THEN** the selection clears and the panel tabs return in the same row

#### Scenario: Face down is visible
- **WHEN** a player turns on face down in the actions sheet
- **THEN** the toolbar shows a face down tag until it is turned off
