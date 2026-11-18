## ADDED Requirements

### Requirement: One-finger scrolling outside cards
When the shared zones do not fit on screen, touching any part of the board that is not a card and moving SHALL scroll the board with the platform's native momentum. This includes zone labels, empty space inside a zone, and the space between zones. One finger on a card SHALL keep the card gestures defined in this capability. The player's own hand area outside the board SHALL NOT scroll the board.

#### Scenario: One finger on an empty zone scrolls
- **WHEN** a player on a phone swipes up with one finger starting on the "Empty" area of a zone
- **THEN** the board scrolls down to show the zones below

#### Scenario: One finger on a zone label scrolls
- **WHEN** a player swipes with one finger starting on a zone's label
- **THEN** the board scrolls, and the zone's actions sheet does not open

#### Scenario: One finger on a card still handles cards
- **WHEN** a player presses a card in a row and moves sideways
- **THEN** the cards are scrubbed as before and the board does not scroll

### Requirement: Two-finger scrolling anywhere on the board
Two fingers placed anywhere on the board, including over cards, and moved together SHALL scroll the board. The second finger SHALL cancel any card gesture the first finger started, without moving, selecting or revealing cards. After release the board SHALL keep moving briefly, slowing to a stop.

#### Scenario: Two fingers over cards scroll without moving them
- **WHEN** a player puts one finger on a card, adds a second finger, and moves both upward
- **THEN** the board scrolls, no card is picked up, moved or selected, and the log has no new entry

### Requirement: Scrolling while dragging
While a player drags cards, holding them within the top or bottom edge band of the board for a short pause SHALL scroll the board toward that edge. The closer the cards are to the edge, the faster it SHALL scroll. Scrolling SHALL stop when the cards leave the band or are dropped. Cards that pass through the band without pausing SHALL NOT scroll the board.

#### Scenario: Drag to an off-screen zone
- **WHEN** a player drags a card from the hand and holds it near the bottom edge of the board while the destination zone is below the visible area
- **THEN** the board scrolls until the zone is visible, and dropping the card there moves it into that zone

#### Scenario: Passing through the edge band does not scroll
- **WHEN** a dragged card crosses the bottom edge band without pausing, on its way from the hand to a visible zone
- **THEN** the board does not scroll
