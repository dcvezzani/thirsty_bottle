## MODIFIED Requirements

### Requirement: Scrub to preview
Pressing and sliding along a fanned hand or spread SHALL show the card under the finger large in a loupe, at a fixed place that does not cover the zone being scrubbed. The loupe is at the top of the screen, or at the bottom when the pressed zone lies in the upper part of the board, chosen when the press starts and kept until release. Releasing changes nothing.

#### Scenario: Scrub through own hand
- **WHEN** a player presses on their hand and slides sideways across 6 overlapping cards
- **THEN** each card in turn appears large in the loupe as it passes, and on release the hand and selection are unchanged

#### Scenario: Scrub over hidden cards
- **WHEN** a player scrubs across a spread containing face-down cards
- **THEN** face-down cards preview only their back image

#### Scenario: Haptic tick
- **WHEN** the scrub moves onto a new card on a device that supports vibration
- **THEN** the device gives a short haptic tick

## ADDED Requirements

### Requirement: Loupe stays on one side
The loupe's side SHALL NOT change during a gesture.

#### Scenario: Zone near the top
- **WHEN** a player scrubs a zone in the upper part of the board and slides down into a zone lower on the board
- **THEN** the loupe stays at the bottom throughout and never covers the zone under the finger

### Requirement: Pause to inspect while scrubbing
While scrubbing, holding still over a card for about 300 ms SHALL show that card's full details in the loupe, as the card details view does. Moving on returns the loupe to the large card. A card whose face the viewer cannot see still shows only what the card details rules allow.

#### Scenario: Pause on a card
- **WHEN** a player scrubs a spread and holds the finger still on one card for 300 ms
- **THEN** the loupe shows that card's name, description, metadata and abilities, and sliding on shows the next card large again

#### Scenario: Pause on a hidden card
- **WHEN** the player pauses on a face-down card in another player's hand
- **THEN** the loupe shows only the back image and the holder's name

### Requirement: Scrub across zones
A sideways scrub over a row of cards SHALL continue into the next card-row zone in the row and, past the end of a row, into the first one of the next row; sliding back past the start goes to the row above. The loupe SHALL name the zone and the row, and the device SHALL tick at each zone crossing. Piles, columns and free zones are not part of the strip. A selection painted from the starting zone stays in that zone.

#### Scenario: Slide into the neighbouring zone
- **WHEN** a player scrubs to the last card of the Discard zone and keeps sliding right
- **THEN** the scrub continues onto the first card of the next zone, and the loupe names that zone

#### Scenario: Wrap to the next row
- **WHEN** the player slides past the last card of the last zone in a row
- **THEN** the scrub continues at the first card of the first zone in the next row, and sliding back returns to the row above

#### Scenario: Empty zones
- **WHEN** a zone in the strip holds no cards
- **THEN** the scrub passes it without stopping on it

### Requirement: Zones open under a held drag
While a player carries cards, holding still over a zone for about 300 ms SHALL widen that zone in place so its cards can be aimed at; the neighbouring zones make room. Releasing drops the cards at the slot under the finger and the zone closes. The loupe shows the carried card.

#### Scenario: Aim at a small zone
- **WHEN** a player drags a card over a narrow zone and holds still for 300 ms
- **THEN** the zone widens and fans its cards, the player slides to the slot they want, and releasing there drops the card in that slot

#### Scenario: Pass over a zone
- **WHEN** the player drags across a zone without holding still
- **THEN** the zone does not widen

### Requirement: Zones pinned open
Holding still over a zone while scrubbing or selecting SHALL widen it, and it SHALL stay widened after the finger lifts so that several cards can be tapped or painted. Only one zone is pinned at a time. Scrolling the board does not close it.

#### Scenario: Select several cards in a pinned zone
- **WHEN** a player pauses over a narrow zone while scrubbing, lifts the finger, and taps three of its cards
- **THEN** the zone stays widened and all three cards are selected

#### Scenario: Tap the felt
- **WHEN** a zone is pinned open with two cards selected and the player taps empty table
- **THEN** the zone returns to its normal size and the two cards stay selected

#### Scenario: Tap a control
- **WHEN** a zone is pinned open and the player taps the header's menu button
- **THEN** the menu opens and the zone closes

#### Scenario: Tap a card elsewhere
- **WHEN** a zone is pinned open and the player taps a card in another zone
- **THEN** that card's selection changes and the pinned zone closes, with the earlier selection kept

#### Scenario: Clear closes it
- **WHEN** a zone is pinned open and the player clears the selection
- **THEN** the zone closes

### Requirement: Closing a pinned zone
A pinned zone SHALL close when the player taps empty table, the header, a control, or a card in another zone (that tap still does its own action), opens a sheet or drawer, clears the selection, moves the cards out, or pins another zone. Closing keeps the selection.

#### Scenario: Selection survives closing
- **WHEN** a pinned zone closes while cards are selected
- **THEN** the same cards remain selected
