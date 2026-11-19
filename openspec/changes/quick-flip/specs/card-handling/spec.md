## MODIFIED Requirements

### Requirement: Gesture disambiguation
The client SHALL classify a press by its first movement. In a hand or a spread, sideways movement is a scrub and movement up or out of the zone picks up cards to drag. In a column the axes are swapped: movement along the column is a scrub, and sideways movement out of the column picks up cards. In every zone, a stationary hold of about 450 ms opens card info, a quick tap toggles selection, and two quick taps on the same card flip it.

#### Scenario: Scrub then pull out
- **WHEN** a player scrubs to a card and then moves the finger upward out of the fan
- **THEN** the scrub ends and that card (or the current selection, if the card is selected) is picked up for dragging

#### Scenario: Hold still for info
- **WHEN** a player presses a card without moving for about 450 ms
- **THEN** the card info view opens and no selection or move occurs

#### Scenario: Column axes are swapped
- **WHEN** a player presses a card in a column and slides downward
- **THEN** the column is scrubbed and no card is picked up

### Requirement: Selection controls
While any cards are selected, the client SHALL show the selection count. It SHALL offer one-tap Select all (in the zone), Clear and Flip. The selection SHALL clear automatically after the selected cards are moved, passed, played or flipped.

#### Scenario: Select all in zone
- **WHEN** a player taps Select all while a spread of 8 cards is focused
- **THEN** all 8 cards are selected and the count shows 8

#### Scenario: Flip from the selection bar
- **WHEN** a player selects 3 face-down cards in a spread and taps Flip in the selection bar
- **THEN** all 3 cards turn face up in one action, and the selection clears

## ADDED Requirements

### Requirement: Quick flip
Two quick taps on the same card (within about 300 ms, with almost no movement) SHALL flip it. If that card is in the current selection, the whole selection SHALL be flipped instead. Two quick taps on a pile SHALL flip its top card. A quick flip SHALL be one action with one log entry and one undo, and SHALL follow the same permissions as any other flip. A single tap SHALL keep its immediate effect on cards; on a pile it MAY be delayed briefly so a second tap can be recognized.

#### Scenario: Flip one card
- **WHEN** a player double-taps a face-down card in a shared spread while nothing is selected
- **THEN** that card turns face up for everyone, nothing ends up selected, and the log records one flip

#### Scenario: Flip a selection
- **WHEN** a player has 3 cards selected and double-taps one of them
- **THEN** all 3 cards flip in one action and the selection clears

#### Scenario: Double tap outside the selection
- **WHEN** a player has 2 cards selected and double-taps a different, unselected card in the same zone
- **THEN** only that card flips, and the 2 cards stay selected

#### Scenario: Flip the top of a pile
- **WHEN** a player double-taps a face-down draw pile
- **THEN** its top card turns face up, and the zone sheet does not open

#### Scenario: Single tap on a pile still opens its sheet
- **WHEN** a player taps a pile once
- **THEN** the zone sheet opens after a short pause

#### Scenario: Out of turn
- **WHEN** a player who is not the active player double-taps a card in a shared zone in turn-based mode
- **THEN** the card does not flip and the player is told whose turn it is

#### Scenario: Mouse double-click
- **WHEN** a player double-clicks a card with a mouse
- **THEN** it flips as with a double tap
