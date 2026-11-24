## ADDED Requirements

### Requirement: One-line seat chips
Each seat chip in the seat bar SHALL show only the player's name (with a crown for the host) and their hand count, on one line. Other details SHALL be in the seat's sheet: host and connection status, which table they are viewing, cards shown to the viewer, and their per-player zones. The chip's accessible name SHALL include the full status. Highlights that add no height, such as the active turn and a pass drop target, SHALL remain.

#### Scenario: Many per-player zones, one line
- **WHEN** George has seven per-player zones and is disconnected
- **THEN** George's chip shows only "George" and his hand count on one line, and his seat sheet lists the seven zones and says he is disconnected

#### Scenario: Status for screen readers
- **WHEN** a screen reader reads George's chip while he is disconnected and viewing Sam's table
- **THEN** it hears his name, that he is disconnected, that he is viewing Sam, and his hand count

## MODIFIED Requirements

### Requirement: Seeing other players' per-player zones
Each copy SHALL show its card count on its owner's board. A seat's sheet SHALL list that player's per-player zones with their counts and cards: face-up cards visible, face-down cards as backs. It SHALL offer the actions the viewer may take there: ask to take, take when open hands is on, and pass cards in.

#### Scenario: Counts in the seat bar
- **WHEN** Alex's Tableau holds 3 cards
- **THEN** Sam's seat bar shows only Alex's name and hand count, and Alex's seat sheet shows Tableau with 3 cards

#### Scenario: Seat sheet shows face-up cards
- **WHEN** Sam opens Alex's seat sheet while Alex's Tableau holds a face-up King and a face-down card
- **THEN** the sheet shows the King's face and one card back under Tableau

### Requirement: Who is viewing whom
While anyone views another seat, that seat's player SHALL see an indicator naming each viewing player and counting viewing spectators. Every participant SHALL be able to see, in a viewing player's seat sheet, which seat they are viewing. The indicators SHALL disappear when the viewer returns to their own view, views another seat, leaves or disconnects.

#### Scenario: Sam can tell
- **WHEN** Alex views Sam's table
- **THEN** Sam sees an indicator naming Alex, and Kim's seat sheet for Alex says "viewing Sam"

#### Scenario: Indicator clears
- **WHEN** Alex returns to their own view
- **THEN** Sam's indicator and the "viewing" line in Alex's seat sheet disappear

### Requirement: Per-player zone placement
A per-player zone SHALL take one slot in the shared zone order. Each seated player SHALL see their own copy in that slot, labelled with the zone's name, and SHALL NOT see other players' copies on their board. Arranging SHALL move the zone for everyone. Spectators SHALL see no copy on the board.

#### Scenario: Same slot, own cards
- **WHEN** the per-player Tableau sits between Stock and Discard
- **THEN** Alex sees their Tableau there and Sam sees their own Tableau in the same place

#### Scenario: Narrow zones keep their name
- **WHEN** a per-player zone named "P1.1" is shown at fit width on a phone
- **THEN** its label reads "P1.1", not a shortened "Your P1.1"
