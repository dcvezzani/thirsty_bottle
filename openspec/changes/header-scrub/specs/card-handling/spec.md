## ADDED Requirements

### Requirement: Scrub along zone headers
Pressing a zone's header and sliding sideways SHALL travel from zone to zone along the board in reading order, wrapping at the end of a row to the next row and back, for every kind of zone. Zones with no cards are passed over. The device SHALL tick at each crossing, and releasing SHALL change nothing.

#### Scenario: Slide along the headers
- **WHEN** a player presses the Draw pile's header and slides right across the headers of Discard and Table
- **THEN** the loupe shows the top card of Draw, then of Discard, then the first card of Table, each with its zone name and count, and releasing leaves the table unchanged

#### Scenario: Wrap to the next row
- **WHEN** the player slides past the last header in a row
- **THEN** the scrub continues at the first header of the next row, and sliding back returns to the row above

#### Scenario: Column zone
- **WHEN** the scrub reaches a column
- **THEN** the loupe shows the column's last card and slides on without picking anything up

#### Scenario: Empty zone
- **WHEN** a zone in the strip holds no cards
- **THEN** the scrub passes it without stopping on it

### Requirement: Header scrub loupe
During a header scrub the loupe SHALL show the zone's most relevant card (a pile's top card, a column's last card, otherwise its first card) with the zone's name, card count and row. Holding still for 300 ms SHALL show that card's details.

#### Scenario: Pause on a header
- **WHEN** the player holds still on a zone for 300 ms during a header scrub
- **THEN** the loupe shows that card's full details, as it does for a card scrub

### Requirement: Header scrub enters the cards
Sliding down from a header into the same zone's cards during a header scrub SHALL start that zone's own scrub in the same stroke, sideways along a row and vertically along a column. Pressing a header and tapping or holding SHALL keep their existing meaning: a tap opens the zone's actions, and a still hold by the host starts arrange mode; a slide cancels both.

#### Scenario: Go from the header into a row
- **WHEN** a player presses the Table spread's header, slides down onto its cards and then slides sideways
- **THEN** the loupe follows the cards of Table one by one

#### Scenario: Go from the header into a column
- **WHEN** a player presses a column's header and slides down onto its cards
- **THEN** the scrub moves vertically along the column and no cards are picked up

#### Scenario: Tap still opens actions
- **WHEN** a player taps a zone's header
- **THEN** the zone's actions open and no scrub starts

#### Scenario: Slide cancels arrange mode
- **WHEN** the host presses a header and slides before the still hold completes
- **THEN** arrange mode does not start and the zone's actions do not open

### Requirement: Zone header press area
A zone header SHALL be pressable from an area at least 44 px tall without changing the zone's layout.

#### Scenario: Press just above a header
- **WHEN** a player presses a few pixels above a header, in the zone's top margin
- **THEN** the press counts as a press on that header
