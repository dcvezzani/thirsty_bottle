## ADDED Requirements

### Requirement: Viewing another player's table
Any player or spectator SHALL be able to switch their board to another seat's view and back. A seat sheet SHALL offer "View table". While viewing, a banner SHALL name the viewed seat and offer previous, next (wrapping through the seats in table order) and "Mine". Spectators SHALL be able to rotate through every seat.

#### Scenario: Rotate through the seats
- **WHEN** Alex views Sam's table at a table with Alex, Sam and Kim, and taps next twice
- **THEN** Alex sees Kim's table and then Alex's own, and "Mine" returns to Alex's own view at any time

### Requirement: What another player's view shows
A view of another seat SHALL show the shared zones as usual, that seat's copy of each per-player zone in its slot, and that seat's hand as a row. Card faces SHALL follow what the viewer may see: face rules in per-player zones, and hand cards hidden unless open hands is on or the cards were shown to the viewer. The viewer's own hand SHALL stay available at the bottom.

#### Scenario: Sam's areas in place
- **WHEN** Alex views Sam's table while Sam's Tableau holds a face-up King and a face-down card, and Sam holds 5 cards
- **THEN** Alex sees Sam's Tableau with the King and one back in the Tableau slot, and 5 card backs as Sam's hand

### Requirement: Actions while viewing another player's table
While viewing another seat, the viewer's actions SHALL follow the existing rules. Taking cards from that seat's hand or per-player zones SHALL ask for consent unless open hands is on. Dropping cards onto them SHALL pass the cards. Flip, shuffle and peek SHALL NOT be offered on that seat's zones, and shared zones SHALL work as in the viewer's own view.

#### Scenario: Drag out asks
- **WHEN** Alex, viewing Sam's table, drags a card out of Sam's Tableau into Alex's hand with open hands off
- **THEN** Sam is asked to allow it

#### Scenario: Pass by dropping
- **WHEN** Alex, viewing Sam's table, drags a card from Alex's hand onto Sam's Tableau
- **THEN** the card moves to Sam's Tableau

### Requirement: Who is viewing whom
While anyone views another seat, that seat's player SHALL see an indicator naming each viewing player and counting viewing spectators. Every participant SHALL see, on a viewing player's seat, which seat they are viewing. The indicators SHALL disappear when the viewer returns to their own view, views another seat, leaves or disconnects.

#### Scenario: Sam can tell
- **WHEN** Alex views Sam's table
- **THEN** Sam sees an indicator naming Alex, and Kim sees "viewing Sam" on Alex's seat

#### Scenario: Indicator clears
- **WHEN** Alex returns to their own view
- **THEN** Sam's indicator and the label on Alex's seat disappear
