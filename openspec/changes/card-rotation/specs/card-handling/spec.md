## ADDED Requirements

### Requirement: Rotated cards fit their slot
A rotated card SHALL be drawn rotated and scaled so that it stays inside the slot an upright card has, about 100% at 0° and 180°, 71% at 90° and 270°, and 59% at the diagonals, in every kind of zone, in hands and while carried. Layouts and tap areas SHALL NOT change with rotation.

#### Scenario: A rotated card in a spread
- **WHEN** a card rotated 45° is in a spread of 6 cards
- **THEN** it is drawn tilted and smaller inside its own slot, and the other cards stay where they were

#### Scenario: Tapping a rotated card
- **WHEN** a player taps a rotated card
- **THEN** it is selected like any other card

### Requirement: Rotation controls
The selection toolbar SHALL have a Rotate button that adds 45° clockwise to the selected cards per tap. The selection actions sheet SHALL offer rotating back 45° and forward 45°, and Upright. A zone's sheet SHALL offer Rotate all and Upright all. Each control SHALL be one action, and none SHALL work on cards the player may not flip.

#### Scenario: Rotate from the toolbar
- **WHEN** a player selects a card and taps Rotate in the selection toolbar twice
- **THEN** the card is rotated 90°, and the selection is kept

#### Scenario: Upright from the sheet
- **WHEN** a player selects cards rotated differently and taps Upright in the selection actions sheet
- **THEN** all the selected cards are upright

#### Scenario: Rotate all in a zone
- **WHEN** a player taps Rotate all in a spread's sheet
- **THEN** every card in the spread is rotated 45° more

### Requirement: Rotate from the loupe
While a card is shown in the loupe, a quick second-finger swipe across the loupe SHALL rotate that card by 45°, clockwise for a swipe to the right and counter-clockwise for a swipe to the left. The stay-open loupe SHALL have ↺ and ↻ buttons for the same. It SHALL NOT work on a card the player may not rotate.

#### Scenario: Swipe on the loupe
- **WHEN** a player holds a card with one finger so that it shows in the loupe and swipes a second finger to the right across the loupe
- **THEN** the card is rotated 45° clockwise and every participant sees it

#### Scenario: A tap still switches the loupe view
- **WHEN** a player taps the loupe with a second finger without swiping
- **THEN** the loupe view switches and no card is rotated

### Requirement: Rotate while carrying
While a card or a selection is carried, a quick tap of a second finger SHALL add 45° to the carried cards, shown on the carried cards at once, while a second finger that moves still pans the board. It SHALL NOT work on cards the player may not rotate.

#### Scenario: Tap while carrying
- **WHEN** a player drags a card and taps a second finger once on the board, then drops the card in another zone
- **THEN** the card lands in that zone rotated 45°

#### Scenario: Second finger that moves
- **WHEN** a player drags a card and puts a second finger on the board and moves it
- **THEN** the board pans as before and no rotation is added

## MODIFIED Requirements

### Requirement: Switch the loupe between card and details
The loupe SHALL have three views of a card: the large card, the card's details, and the true full view. Card and Details show the card upright; True full shows it at full size with its current rotation. Until the player has chosen a view, the large card shows and holding still on a card peeks at its details until the finger moves on. Tapping the loupe (or its buttons) SHALL choose the next view in the order Card, Details, True full and back to Card, and the choice SHALL apply to every card shown in the loupe for the rest of the browser session, and a pause SHALL NOT change it.

#### Scenario: Choose details while scrubbing
- **WHEN** a player scrubs with one finger and taps the loupe with a second finger, and then slides on to the next card
- **THEN** the loupe shows the next card's details

#### Scenario: Go back to the card
- **WHEN** the player taps the loupe with the second finger two more times
- **THEN** the loupe shows the true full view and then the large card again

#### Scenario: A chosen card view wins over a pause
- **WHEN** a pause is peeking at a card's details, the player taps the loupe to go back to the large card, scrubs to another card and pauses on it
- **THEN** the loupe keeps showing the large card

#### Scenario: The choice lasts the session
- **WHEN** a player has chosen the details view, lifts, and scrubs another card later, even after reloading the page
- **THEN** the loupe shows that card's details

#### Scenario: True full shows the rotation
- **WHEN** a player has chosen the true full view and scrubs to a card rotated 90°
- **THEN** the loupe shows the card at full size rotated 90°, and in the Card and Details views the same card shows upright

### Requirement: Stay-open loupe
With the preference "Stay open", releasing a scrub SHALL leave the last card viewed: it SHALL have an outline that differs from the selection outline, the loupe SHALL stay up with Card, Details and True full buttons, rotate buttons and a close button, and the card SHALL NOT be selected, shown a toolbar or given card actions. Touches outside the loupe's controls SHALL reach the board.

#### Scenario: Keep looking
- **WHEN** the preference is "Stay open" and a player scrubs to a card and lifts the finger
- **THEN** the loupe stays showing that card, the card has the viewed outline, nothing is selected, and the buttons switch between the card, its details and its true full view

#### Scenario: Board stays usable
- **WHEN** a card is viewed and the player taps a card elsewhere
- **THEN** that card is selected as usual and the viewing ends
