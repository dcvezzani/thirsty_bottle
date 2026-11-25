## ADDED Requirements

### Requirement: Another seat's zones in view
A view of another seat SHALL show the shared zones as usual and that seat's copy of each per-player zone in its slot. Card faces SHALL follow what the viewer may see: the face rules in per-player zones, and hand cards hidden unless they were shown or peeked to the viewer.

#### Scenario: Sam's areas in place
- **WHEN** Alex views Sam's table while Sam's Tableau holds a face-up King and a face-down card
- **THEN** Alex sees Sam's Tableau in its slot with the King face up and one card back

### Requirement: Hand dock while viewing another table
While a player views another seat, the hand area SHALL be a dock as tall as the viewer's own hand area on their own table, whether or not cards are shown, so the board never resizes. The dock SHALL hold two columns of normal-size, full-height cards: the viewed player's hand on the left and the viewer's own hand on the right. The focused column SHALL take about two thirds of the width. A spectator SHALL get one full-width column.

#### Scenario: Same height as my own table
- **WHEN** Alex's hand area is a given height on Alex's own table and Alex views Sam's table, with and without cards shown to Alex
- **THEN** the dock is the same height in every case and the board does not move

#### Scenario: Their hand is focused by default
- **WHEN** Alex starts viewing Sam's table
- **THEN** Sam's column is the wide one and Alex's own column is the narrow one

#### Scenario: Spectator
- **WHEN** a spectator views Sam's table
- **THEN** the dock is one full-width column showing Sam's hand

### Requirement: Focusing a hand column
Sliding along the narrow column, or carrying cards over it, SHALL make it the focused wide column and the other the narrow one. The focus SHALL stay until the other column is slid along or carried over, and a tap SHALL NOT change it. Focus SHALL return to the viewed player's hand whenever the viewer starts viewing a different table. While the columns resize, the scrub preview SHALL pause briefly and then continue from the finger's position.

#### Scenario: Slide over my own hand
- **WHEN** Alex slides along their narrow hand while viewing Sam's table
- **THEN** Alex's column becomes wide, Sam's becomes narrow, and both stay that way after Alex lifts their finger

#### Scenario: Slide back
- **WHEN** Alex then slides along Sam's narrow column
- **THEN** Sam's column is the wide one again

#### Scenario: A tap does not change focus
- **WHEN** Alex taps a card in the narrow column
- **THEN** the card is selected and the column widths do not change

#### Scenario: Rotating resets the focus
- **WHEN** Alex has focused their own hand and rotates to Kim's table
- **THEN** Kim's column is the wide one

#### Scenario: Carrying a card to the other column
- **WHEN** Alex has focused their own hand and carries a card over Sam's narrow column
- **THEN** Sam's column widens, and dropping the card passes it to Sam

### Requirement: Cards in the viewed hand
The viewed hand's column SHALL show cards shown to the viewer first and face up, and cards hidden from the viewer as one small stack with their count. Each column SHALL carry a small badge with the owner's name, card count and how many are shown to the viewer, adding no height. An empty viewed hand SHALL say so by the owner's name. A card shown to the viewer while the viewed column is narrow SHALL make it pulse and update its badge, without changing the focus.

#### Scenario: A shown card is readable
- **WHEN** Sam shows two cards from a hand of 5 to Alex while Alex views Sam's table
- **THEN** the two shown cards appear first and face up in Sam's column, and the other three are one stack labelled "+3 hidden"

#### Scenario: Nothing shown
- **WHEN** Alex views Sam's table and none of Sam's 5 cards is shown to Alex
- **THEN** Sam's column shows the hidden stack and a badge saying 5 cards, none shown, at the same dock height

#### Scenario: Empty viewed hand
- **WHEN** Alex views Sam's table and Sam holds no cards
- **THEN** the column says "Sam's hand is empty", not "Your hand is empty"

#### Scenario: Shown while my hand is focused
- **WHEN** Alex has focused their own hand and Sam shows Alex a card
- **THEN** Sam's narrow column pulses and its badge counts the shown card, and the focus does not change

## REMOVED Requirements

### Requirement: What another player's view shows
**Reason**: Replaced by "Another seat's zones in view", "Hand dock while viewing another table", "Focusing a hand column" and "Cards in the viewed hand", which describe the hands as columns of one constant-height dock instead of a slim line and strip.
**Migration**: No data migration; this is a client layout change.
