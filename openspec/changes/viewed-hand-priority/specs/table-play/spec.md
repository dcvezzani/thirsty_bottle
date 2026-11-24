## MODIFIED Requirements

### Requirement: What another player's view shows
A view of another seat SHALL show the shared zones as usual and that seat's copy of each per-player zone in its slot. That seat's hand SHALL take the main hand area at the size of the viewer's own hand, showing cards shown to the viewer first and face up, and cards hidden from the viewer as one small stack with their count. When no card is shown to the viewer, the viewed hand SHALL be a single slim line stating how many cards the player holds. An empty viewed hand SHALL say so by the owner's name. Card faces SHALL follow what the viewer may see: face rules in per-player zones, and hand cards hidden unless the cards were shown or peeked to the viewer. The viewer's own hand SHALL stay available as a slim one-line strip, from which cards can still be dragged to the viewed player's zones, and SHALL return to full size when the viewer returns to their own view.

#### Scenario: Sam's areas in place
- **WHEN** Alex views Sam's table while Sam's Tableau holds a face-up King and a face-down card, and Sam holds 5 cards
- **THEN** Alex sees Sam's Tableau with the King and one back in the Tableau slot, and Sam's hand as a slim line saying 5 cards, none shown

#### Scenario: A shown card is readable
- **WHEN** Sam shows two cards from a hand of 5 to Alex while Alex views Sam's table
- **THEN** Sam's hand grows to the full hand size, the two shown cards appear face up first, and the other three are one stack labelled "+3 hidden"

#### Scenario: Empty viewed hand
- **WHEN** Alex views Sam's table and Sam holds no cards
- **THEN** the hand area says "Sam's hand is empty", not "Your hand is empty"

#### Scenario: My own hand is a strip while viewing
- **WHEN** Alex holds 5 cards and views Sam's table
- **THEN** Alex's own hand is one slim line showing 5 cards, and dragging one onto Sam's Tableau passes it; tapping "Mine" restores the full-size hand
