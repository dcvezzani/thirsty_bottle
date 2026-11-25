## MODIFIED Requirements

### Requirement: Scrub to preview
Pressing and sliding along a fanned hand or spread SHALL show the card under the finger large in a loupe, at a fixed place that does not cover the zone being scrubbed. The loupe is at the top of the screen, or at the bottom when the pressed zone lies in the upper part of the board, chosen when the press starts and kept until it is dismissed. A scrub never changes the cards or the selection. On release the loupe goes away, unless the player's Card loupe preference is "Stay open".

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

### Requirement: Switch the loupe between card and details
The loupe SHALL have two views of a card: the large card and the card's details. The chosen view applies to every card scrubbed after the choice for the rest of the session. While the large card is chosen, holding still on a card still shows its details until the finger moves on.

#### Scenario: Choose details while scrubbing
- **WHEN** a player scrubs with one finger and taps the loupe with a second finger, and then slides on to the next card
- **THEN** the loupe shows the next card's details

#### Scenario: Go back to the card
- **WHEN** the player taps the loupe with the second finger again
- **THEN** the loupe shows the large card again

### Requirement: Loupe mode preference
A player SHALL be able to choose, for the device they are using, between "Second finger" and "Stay open" for the card loupe, from the table settings. The default is "Second finger" on a touch device that supports two or more touch points and "Stay open" otherwise. The choice SHALL be kept in the browser and SHALL NOT be shared with other players.

#### Scenario: Default on a phone
- **WHEN** a player opens the table settings for the first time on a phone
- **THEN** the Card loupe preference reads "Second finger"

#### Scenario: Default with a mouse
- **WHEN** a player opens the table settings for the first time on a desktop with only a mouse
- **THEN** the Card loupe preference reads "Stay open"

#### Scenario: The choice is kept
- **WHEN** a player chooses "Stay open" and reloads the page
- **THEN** the preference still reads "Stay open"

#### Scenario: Second finger mode
- **WHEN** the preference is "Second finger" and a player lifts the scrubbing finger
- **THEN** the loupe goes away; and a second finger that holds or moves instead of tapping does not switch the view

### Requirement: Stay-open loupe
With the preference "Stay open", releasing a scrub SHALL leave the last card viewed: it SHALL have an outline that differs from the selection outline, the loupe SHALL stay up with a Card/Details toggle and a close button, and the card SHALL NOT be selected, shown a toolbar or given card actions. Touches outside the loupe's controls SHALL reach the board.

#### Scenario: Keep looking
- **WHEN** the preference is "Stay open" and a player scrubs to a card and lifts the finger
- **THEN** the loupe stays showing that card, the card has the viewed outline, nothing is selected, and the toggle switches between the card and its details

#### Scenario: Board stays usable
- **WHEN** a card is viewed and the player taps a card elsewhere
- **THEN** that card is selected as usual and the viewing ends

### Requirement: Ending a stay-open view
A viewed card SHALL stop being viewed, and the loupe SHALL close, when the player taps the close button, presses Escape, starts another scrub or a drag, selects a card by tapping it, taps the viewed card again, taps empty table, or opens a sheet or drawer. Panning or scrolling the board SHALL NOT end it.

#### Scenario: Tap the felt
- **WHEN** a card is viewed and the player taps empty table
- **THEN** the loupe closes and the outline goes away

#### Scenario: Scroll the board
- **WHEN** a card is viewed and the player scrolls the board
- **THEN** the loupe and the outline stay

#### Scenario: Tap the viewed card
- **WHEN** a card is viewed and the player taps it
- **THEN** the viewing ends and the card is not selected
